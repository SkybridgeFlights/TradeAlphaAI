'use strict';

// Vercel serverless API route: GET /api/economic-calendar
// Query params: ?date=YYYY-MM-DD  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD
//               ?ec_debug         — enables extended diagnostics in the JSON response
// Mirrors netlify/functions/economic-calendar.js for Netlify compatibility.

const fs      = require('fs');
const path    = require('path');
const fmp     = require('../tools/providers/economic-calendar/fmp-provider');
const finnhub = require('../tools/providers/economic-calendar/finnhub-provider');
const fred    = require('../tools/providers/economic-calendar/fred-provider');
const te      = require('../tools/providers/economic-calendar/trading-economics-provider');
const { inferImpact, computeIntelligence } =
  require('../tools/providers/economic-calendar/event-intelligence');

// Provider order for parallel fetch: TE → FMP → Finnhub → FRED
// TE is preferred for actual/forecast completeness; FRED is schedule-only.
const PROVIDERS      = [te, fmp, finnhub, fred];
const PROVIDER_NAMES = ['te', 'fmp', 'finnhub', 'fred'];

// Merge rank: lower = preferred as the base event record in deduplication.
const MERGE_RANK = { te: 0, fmp: 1, finnhub: 2, fred: 3 };

// Safe (key-free) endpoint URLs for diagnostics — never include API keys.
const PROVIDER_ENDPOINTS = {
  te:      'https://api.tradingeconomics.com/calendar',
  fmp:     'https://financialmodelingprep.com/stable/economic-calendar',
  finnhub: 'https://finnhub.io/api/v1/calendar/economic',
  fred:    'https://api.stlouisfed.org/fred/releases/dates',
};

// Which env keys each provider requires (primary + optional alias)
const ENV_KEY_CHECKS = [
  ['TRADING_ECONOMICS_API_KEY',  null],
  ['TRADING_ECONOMICS_CLIENT',   'TRADING_ECONOMICS_SECRET'],
  ['FMP_API_KEY',                'FINANCIAL_MODELING_PREP_API_KEY'],
  ['FINNHUB_API_KEY',            null],
  ['FRED_API_KEY',               null],
];

// Static cache bundled with the deployment (written by GitHub Actions calendar update)
const STATIC_CACHE_PATH  = path.join(__dirname, '..', 'data', 'economic-calendar.json');
const CACHE_MAX_AGE_HOURS = 24;

module.exports = async function handler(req, res) {
  console.log('[calendar-api] runtime=vercel');

  const q         = req.query || {};
  const debugMode = q.ec_debug !== undefined;
  const from      = q.from || q.date || addDays(today(), -1);
  const to        = q.to   || (q.date ? q.date : addDays(today(), 14));

  // Key diagnostics — presence only, never values; track for debug response
  const envPresent = [];
  const envMissing = [];
  for (const [primary, alias] of ENV_KEY_CHECKS) {
    const present = !!(
      String(process.env[primary] || '').trim() ||
      (alias && String(process.env[alias] || '').trim())
    );
    console.log('[calendar-env] ' + primary + '=' + (present ? 'present' : 'missing'));
    (present ? envPresent : envMissing).push(primary);
  }

  console.log(`[calendar-api] range=${from}..${to} debug=${debugMode} env_present=${envPresent.length}/${ENV_KEY_CHECKS.length}`);

  const context = { from, to, env: process.env };

  // Fetch all providers in parallel — one slow/failing provider does not block others
  const results = await Promise.allSettled(
    PROVIDERS.map(function (p) { return p.fetchCalendar(context); })
  );

  const providersMeta = {};
  const errorTypes    = {}; // always tracked for health scoring, not exposed unless debug
  const rawPool       = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const name   = PROVIDER_NAMES[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const events   = result.value.events || [];
      const usable   = pickUsable(events);
      const rawCount = result.value.rawCount || events.length;

      const withActual   = countWith(usable, 'actual');
      const withForecast = countWith(usable, 'forecast');
      const withPrevious = countWith(usable, 'previous');
      const completenessScore = usable.length > 0
        ? Math.round((withActual + withForecast + withPrevious) / (usable.length * 3) * 100)
        : 0;

      console.log(`[calendar-api] provider=${name} ok raw=${rawCount} normalized=${usable.length} completeness=${completenessScore}%`);

      errorTypes[name] = null;
      providersMeta[name] = {
        status:             'ok',
        raw:                rawCount,
        normalized:         usable.length,
        with_actual:        withActual,
        with_forecast:      withForecast,
        with_previous:      withPrevious,
        completeness_score: completenessScore,
        ...(debugMode ? { endpoint: PROVIDER_ENDPOINTS[name] || null, error_type: null } : {}),
      };
      rawPool.push(...usable);
    } else {
      const reason     = sanitize(result.reason && result.reason.message);
      const httpStatus = (result.reason && result.reason.statusCode) || null;
      const respSize   = (result.reason && result.reason.responseSize) || null;
      const errorType  = classifyProviderError(reason, httpStatus);
      const metaStatus = resolveProviderStatus(reason, httpStatus);

      errorTypes[name] = errorType;
      console.log(
        `[calendar-api] provider=${name} ${metaStatus}` +
        ` reason="${reason}"` +
        ` http_status=${httpStatus !== null ? httpStatus : 'N/A'}` +
        ` resp_size=${respSize !== null ? respSize + 'B' : 'N/A'}` +
        ` error_type=${errorType}`
      );

      providersMeta[name] = {
        status:             metaStatus,
        raw:                0,
        normalized:         0,
        with_actual:        0,
        with_forecast:      0,
        with_previous:      0,
        completeness_score: 0,
        ...(debugMode ? {
          reason,
          http_status:   httpStatus,
          response_size: respSize,
          error_type:    errorType,
          endpoint:      PROVIDER_ENDPOINTS[name] || null,
        } : {}),
      };
    }
  }

  const merged   = mergeEvents(rawPool);
  let enriched   = merged.map(function (e) {
    return Object.assign({}, e, { error: undefined, intelligence: computeIntelligence(e) });
  });
  enriched.sort(function (a, b) { return (a.event_time || '').localeCompare(b.event_time || ''); });

  // ── Static cache fallback ─────────────────────────────────────────────────
  // When live providers return zero events, attempt the deployment-bundled cache.
  // Only use it if it has events AND is under 24 hours old.
  const liveEventCount = enriched.length;
  const cacheResult    = readStaticCache();
  let fallbackDecision = { type: 'none', reason: null };

  if (liveEventCount === 0) {
    if (cacheResult.events.length > 0 && cacheResult.ageHours < CACHE_MAX_AGE_HOURS) {
      enriched = cacheResult.events;
      fallbackDecision = {
        type:   'static_cache',
        reason: `live_providers_empty cache_age=${Math.round(cacheResult.ageHours * 10) / 10}h`,
      };
      console.log(`[calendar-api] fallback=static_cache cache_events=${enriched.length} cache_age=${Math.round(cacheResult.ageHours)}h`);
    } else {
      fallbackDecision = {
        type:   'external_iframe',
        reason: cacheResult.events.length === 0
          ? 'no_live_events no_cache_events'
          : `no_live_events cache_stale cache_age=${Math.round(cacheResult.ageHours)}h`,
      };
      console.log(`[calendar-api] fallback=external_iframe cache_events=${cacheResult.events.length} cache_stale=${cacheResult.ageHours >= CACHE_MAX_AGE_HOURS}`);
    }
  }

  const hasLive        = Object.values(providersMeta).some(function (p) { return p && p.status === 'ok'; });
  const activeProviders = PROVIDER_NAMES.filter(function (n) {
    return providersMeta[n] && providersMeta[n].status === 'ok';
  });
  const providerHealth = calcProviderHealth(providersMeta, errorTypes, enriched.length);
  const httpStatus     = (hasLive || enriched.length > 0) ? 200 : 503;

  console.log(`[calendar-api] complete source=${hasLive ? 'live' : 'degraded'} health=${providerHealth} events=${enriched.length} active=${activeProviders.join(',') || 'none'} fallback=${fallbackDecision.type}`);

  const responseBody = {
    schema_version:  '2.1',
    updated_at:      new Date().toISOString(),
    source:          hasLive
      ? (fallbackDecision.type === 'static_cache' ? 'static_cache' : 'live')
      : 'degraded',
    provider_health: providerHealth,
    providers:       providersMeta,
    events:          enriched,
  };

  if (debugMode) {
    responseBody.debug = {
      date_range:        { from, to },
      env_keys:          { present: envPresent, missing: envMissing },
      provider_priority: PROVIDER_NAMES,
      active_providers:  activeProviders,
      live_events:       liveEventCount,
      total_events:      enriched.length,
      fallback_used:     fallbackDecision.type,
      cache_events:      cacheResult.events.length,
      cache_age_hours:   cacheResult.ageHours < Infinity
        ? Math.round(cacheResult.ageHours * 10) / 10
        : null,
      reason:            fallbackDecision.reason,
      provider_health:   providerHealth,
      note:              envMissing.length === ENV_KEY_CHECKS.length
        ? 'ALL env keys missing — no provider can authenticate'
        : null,
    };
  }

  const body = JSON.stringify(responseBody);

  res.setHeader('Content-Type',                'application/json');
  res.setHeader('Cache-Control',               'public, max-age=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = httpStatus;
  res.end(body);
};

// ── Provider classification ───────────────────────────────────────────────────

// Maps raw error reason + HTTP status to a clean provider status string.
// 402 = paid plan required (FMP quota) — disable, do not retry
// FRED no_matching / no_supported_events = informational, not a failure
function resolveProviderStatus(reason, httpStatus) {
  if (reason === 'missing_api_key') return 'missing_key';
  if (httpStatus === 402)           return 'disabled_paid_plan';
  if (reason === 'no_matching_release_dates' ||
      reason === 'no_supported_events')      return 'no_events';
  return 'failed';
}

function classifyProviderError(reason, httpStatus) {
  if (reason === 'missing_api_key')         return 'missing_key';
  if (httpStatus === 402)                   return 'disabled_paid_plan';
  if (httpStatus === 429)                   return 'rate_limited';
  if (httpStatus === 401 || httpStatus === 403) return 'auth_failed';
  if (httpStatus !== null && httpStatus >= 500) return 'provider_down';
  if (/invalid json/i.test(reason))         return 'schema_drift';
  if (/legacy_endpoint|unsupported_plan|unexpected_response/i.test(reason)) return 'schema_drift';
  if (/api_error/i.test(reason))            return 'auth_failed';
  if (/no_matching|no_supported_events/i.test(reason)) return 'empty_payload';
  if (/timeout/i.test(reason))              return 'timeout';
  return 'unknown';
}

// healthy  = at least one provider returned usable events
// degraded = providers attempted but hit real errors (not just missing keys/empty)
// offline  = no keys configured or all failures are informational
function calcProviderHealth(providersMeta, errorTypes, eventCount) {
  if (eventCount > 0) return 'healthy';
  const realFailures = Object.entries(errorTypes).filter(function ([, t]) {
    return t && t !== 'missing_key' && t !== 'empty_payload';
  });
  return realFailures.length > 0 ? 'degraded' : 'offline';
}

// ── Static cache ──────────────────────────────────────────────────────────────

function readStaticCache() {
  try {
    const raw      = JSON.parse(fs.readFileSync(STATIC_CACHE_PATH, 'utf8'));
    const events   = Array.isArray(raw.events) ? raw.events : [];
    const updAt    = raw.updated_at || null;
    const ageHours = updAt
      ? (Date.now() - new Date(updAt).getTime()) / 3600000
      : Infinity;
    return { events, updatedAt: updAt, ageHours };
  } catch (_) {
    return { events: [], updatedAt: null, ageHours: Infinity };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWith(events, field) {
  return events.filter(function (e) {
    return e[field] !== null && e[field] !== undefined;
  }).length;
}

// Accept events the static normalizer rejected only for "unsupported type"
function pickUsable(events) {
  const out = [];
  for (const e of events) {
    if (!e.event_name || !e.event_time || !e.country) continue;
    if (e.error && !e.error.startsWith('unsupported type')) continue;
    if (e.error) {
      const inferred = inferImpact(e.event_name);
      out.push(Object.assign({}, e, { importance: e.importance || inferred.impact, error: undefined }));
    } else {
      out.push(e);
    }
  }
  return out;
}

// Merge events from all providers, deduplicating on date+country+name
function mergeEvents(events) {
  const groups = new Map();
  for (const e of events) {
    const key = dedupeKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return Array.from(groups.values()).map(mergeGroup);
}

function dedupeKey(e) {
  const date    = String(e.event_time || e.date || '').slice(0, 10);
  const country = String(e.country || '').toUpperCase();
  const name    = String(e.event_name || e.name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return date + '|' + country + '|' + name;
}

function richness(e) {
  return (e.actual   !== null && e.actual   !== undefined ? 2 : 0)
       + (e.forecast !== null && e.forecast !== undefined ? 2 : 0)
       + (e.previous !== null && e.previous !== undefined ? 1 : 0);
}

function mergeGroup(group) {
  if (group.length === 1) return group[0];
  const sorted = group.slice().sort(function (a, b) {
    const rankA = MERGE_RANK[a.provider] !== undefined ? MERGE_RANK[a.provider] : 9;
    const rankB = MERGE_RANK[b.provider] !== undefined ? MERGE_RANK[b.provider] : 9;
    if (rankA !== rankB) return rankA - rankB;
    return richness(b) - richness(a);
  });
  const base    = Object.assign({}, sorted[0]);
  const sources = sorted.map(function (e) { return e.provider; }).filter(Boolean)
    .filter(function (v, i, a) { return a.indexOf(v) === i; });
  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];
    // FRED is schedule-only — never contributes numeric fields
    if (other.provider === 'fred') continue;
    if (base.actual   === null && other.actual   !== null) base.actual   = other.actual;
    if (base.forecast === null && other.forecast !== null) base.forecast = other.forecast;
    if (base.previous === null && other.previous !== null) base.previous = other.previous;
    if (!base.unit && other.unit) base.unit = other.unit;
  }
  base.sources = sources;
  return base;
}

function sanitize(value) {
  return String(value || 'unknown')
    .replace(/apikey=[^&\s]+/gi, 'apikey=[redacted]')
    .replace(/token=[^&\s]+/gi,  'token=[redacted]')
    .replace(/c=[^&\s]+/gi,      'c=[redacted]')
    .slice(0, 120);
}

function today() { return new Date().toISOString().slice(0, 10); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
