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

const PROVIDERS      = [te, fmp, finnhub, fred];
const PROVIDER_NAMES = ['te', 'fmp', 'finnhub', 'fred'];
const MERGE_RANK     = { te: 0, fmp: 1, finnhub: 2, fred: 3 };

const PROVIDER_ENDPOINTS = {
  te:      'https://api.tradingeconomics.com/calendar',
  fmp:     'https://financialmodelingprep.com/stable/economic-calendar',
  finnhub: 'https://finnhub.io/api/v1/calendar/economic',
  fred:    'https://api.stlouisfed.org/fred/releases/dates',
};

const ENV_KEY_CHECKS = [
  ['TRADING_ECONOMICS_API_KEY',  null],
  ['TRADING_ECONOMICS_CLIENT',   'TRADING_ECONOMICS_SECRET'],
  ['FMP_API_KEY',                'FINANCIAL_MODELING_PREP_API_KEY'],
  ['FINNHUB_API_KEY',            null],
  ['FRED_API_KEY',               null],
];

const COOLDOWN_MS         = 15 * 60 * 1000;       // 15 minutes per 5xx failure
const TMP_LIVE_CACHE      = '/tmp/ec-live-cache.json';
const STATIC_CACHE_PATH   = path.join(__dirname, '..', 'data', 'economic-calendar.json');
const CACHE_MAX_AGE_HOURS = 24;

// ── Module-level state (survives warm container reuse, resets on cold start) ──

// Provider cooldown + uptime tracking
const PROVIDER_STATE = {};
for (const name of PROVIDER_NAMES) {
  PROVIDER_STATE[name] = { failures: 0, cooldownUntil: 0, lastSuccessAt: null };
}

// Live cache: populated after any successful fetch with events > 0.
// Also loaded from /tmp on first invocation so warm restarts preserve it.
let liveCacheLoaded = false;
let liveCache       = null; // { events: [], updatedAt: string, providers: {} }

function ensureLiveCacheLoaded() {
  if (liveCacheLoaded) return;
  liveCacheLoaded = true;
  try {
    const raw = JSON.parse(fs.readFileSync(TMP_LIVE_CACHE, 'utf8'));
    if (raw && Array.isArray(raw.events) && raw.events.length > 0 && raw.updatedAt) {
      liveCache = raw;
      const ageH = Math.round((Date.now() - new Date(raw.updatedAt).getTime()) / 360000) / 10;
      console.log(`[calendar-api] live-cache loaded from /tmp events=${raw.events.length} age=${ageH}h`);
    }
  } catch (_) { /* no /tmp cache yet — starts empty */ }
}

function writeLiveCache(events, providersMeta) {
  const cache = { events, updatedAt: new Date().toISOString(), providers: providersMeta };
  liveCache = cache;
  try {
    fs.writeFileSync(TMP_LIVE_CACHE, JSON.stringify(cache), 'utf8');
  } catch (_) { /* /tmp write failed — module-level liveCache still works */ }
}

// ── Request handler ───────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  console.log('[calendar-api] runtime=vercel');
  ensureLiveCacheLoaded();

  const q         = req.query || {};
  const debugMode = q.ec_debug !== undefined;
  const from      = q.from || q.date || addDays(today(), -1);
  const to        = q.to   || (q.date ? q.date : addDays(today(), 14));
  const now       = Date.now();

  // Key diagnostics — presence only, never values
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

  // Fetch all providers in parallel.
  // Providers in active cooldown (5xx within last 15 min) are skipped immediately.
  const results = await Promise.allSettled(
    PROVIDERS.map(function (p, i) {
      const name  = PROVIDER_NAMES[i];
      const state = PROVIDER_STATE[name];
      if (state && now < state.cooldownUntil) {
        const err       = new Error('provider_cooldown');
        err.cooldown    = true;
        err.cooldownEnd = state.cooldownUntil;
        return Promise.reject(err);
      }
      return p.fetchCalendar(context);
    })
  );

  const providersMeta = {};
  const errorTypes    = {}; // tracked for health scoring regardless of debug mode
  const rawPool       = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const name   = PROVIDER_NAMES[i];
    const result = results[i];
    const state  = PROVIDER_STATE[name];

    if (result.status === 'fulfilled') {
      // Success: reset cooldown tracking
      state.failures    = 0;
      state.cooldownUntil = 0;
      state.lastSuccessAt = new Date().toISOString();

      const events   = result.value.events || [];
      const usable   = pickUsable(events);
      const rawCount = result.value.rawCount || events.length;

      const withActual        = countWith(usable, 'actual');
      const withForecast      = countWith(usable, 'forecast');
      const withPrevious      = countWith(usable, 'previous');
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

    } else if (result.reason && result.reason.cooldown) {
      // Skipped — active cooldown (do not increment failures)
      const remaining = Math.max(0, Math.floor((state.cooldownUntil - now) / 1000));
      console.log(`[calendar-api] provider=${name} skipped cooldown_remaining=${remaining}s`);

      errorTypes[name] = 'provider_cooldown';
      providersMeta[name] = {
        status:             'cooldown',
        raw:                0,
        normalized:         0,
        with_actual:        0,
        with_forecast:      0,
        with_previous:      0,
        completeness_score: 0,
        ...(debugMode ? {
          error_type:            'provider_cooldown',
          cooldown_remaining_sec: remaining,
          endpoint:              PROVIDER_ENDPOINTS[name] || null,
        } : {}),
      };

    } else {
      // Real failure: classify, possibly set cooldown
      const reason     = sanitize(result.reason && result.reason.message);
      const httpStatus = (result.reason && result.reason.statusCode) || null;
      const respSize   = (result.reason && result.reason.responseSize) || null;
      const errorType  = classifyProviderError(reason, httpStatus);
      const metaStatus = resolveProviderStatus(reason, httpStatus);

      state.failures++;
      if (httpStatus !== null && httpStatus >= 500) {
        state.cooldownUntil = now + COOLDOWN_MS;
        console.log(`[calendar-api] provider=${name} cooldown_set duration=15min http_status=${httpStatus} failures=${state.failures}`);
      }

      console.log(
        `[calendar-api] provider=${name} ${metaStatus}` +
        ` reason="${reason}"` +
        ` http_status=${httpStatus !== null ? httpStatus : 'N/A'}` +
        ` resp_size=${respSize !== null ? respSize + 'B' : 'N/A'}` +
        ` error_type=${errorType}`
      );

      errorTypes[name] = errorType;
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

  let enriched = mergeEvents(rawPool).map(function (e) {
    return Object.assign({}, e, { error: undefined, intelligence: computeIntelligence(e) });
  });
  enriched.sort(function (a, b) { return (a.event_time || '').localeCompare(b.event_time || ''); });

  const liveEventCount = enriched.length;

  // Persist successful live result to /tmp for stale-cache fallback
  if (liveEventCount > 0) {
    writeLiveCache(enriched, providersMeta);
  }

  // ── Fallback hierarchy ────────────────────────────────────────────────────
  // live providers → stale live cache (/tmp) → static cache (data/) → external iframe
  let fallbackDecision = { type: 'none', reason: null };
  let cacheAgeHours    = null;

  if (liveEventCount === 0) {
    // 1. Stale live cache — most recent successful live response
    const liveCacheAge = (liveCache && liveCache.updatedAt)
      ? (now - new Date(liveCache.updatedAt).getTime()) / 3600000
      : Infinity;

    if (liveCache && liveCache.events.length > 0 && liveCacheAge < CACHE_MAX_AGE_HOURS) {
      enriched         = liveCache.events;
      cacheAgeHours    = Math.round(liveCacheAge * 10) / 10;
      fallbackDecision = {
        type:   'stale_live_cache',
        reason: `live_providers_empty live_cache_age=${cacheAgeHours}h`,
      };
      console.log(`[calendar-api] fallback=stale_live_cache events=${enriched.length} age=${cacheAgeHours}h`);

    } else {
      // 2. Static cache bundled at deploy time
      const staticCache = readStaticCache();

      if (staticCache.events.length > 0 && staticCache.ageHours < CACHE_MAX_AGE_HOURS) {
        enriched         = staticCache.events;
        cacheAgeHours    = Math.round(staticCache.ageHours * 10) / 10;
        fallbackDecision = {
          type:   'static_cache',
          reason: `live_providers_empty no_live_cache static_cache_age=${cacheAgeHours}h`,
        };
        console.log(`[calendar-api] fallback=static_cache events=${enriched.length} age=${cacheAgeHours}h`);

      } else {
        // 3. Nothing usable — signal frontend to show external iframe
        const liveCacheReason = liveCache
          ? `live_cache_stale age=${Math.round(liveCacheAge)}h`
          : 'no_live_cache';
        const staticReason = staticCache.events.length === 0
          ? 'no_static_events'
          : `static_cache_stale age=${Math.round(staticCache.ageHours)}h`;
        fallbackDecision = {
          type:   'external_iframe',
          reason: `live_providers_empty ${liveCacheReason} ${staticReason}`,
        };
        console.log(`[calendar-api] fallback=external_iframe reason="${fallbackDecision.reason}"`);
      }
    }
  }

  const hasLive        = Object.values(providersMeta).some(function (p) { return p && p.status === 'ok'; });
  const activeProviders = PROVIDER_NAMES.filter(function (n) {
    return providersMeta[n] && providersMeta[n].status === 'ok';
  });
  const providerHealth = calcProviderHealth(providersMeta, errorTypes, enriched.length);

  // source: 'live' = fresh data | 'stale_cache' = any cache | 'degraded' = no data
  const source = liveEventCount > 0 ? 'live'
    : enriched.length > 0            ? 'stale_cache'
    :                                  'degraded';

  const httpStatus = (source !== 'degraded') ? 200 : 503;

  console.log(`[calendar-api] complete source=${source} health=${providerHealth} events=${enriched.length} active=${activeProviders.join(',') || 'none'} fallback=${fallbackDecision.type}`);

  const responseBody = {
    schema_version:  '2.1',
    updated_at:      new Date().toISOString(),
    source,
    provider_health: providerHealth,
    providers:       providersMeta,
    events:          enriched,
  };

  if (debugMode) {
    const providerUptime = {};
    for (const name of PROVIDER_NAMES) {
      const state = PROVIDER_STATE[name] || {};
      providerUptime[name] = {
        consecutive_failures:   state.failures || 0,
        cooldown_remaining_sec: Math.max(0, Math.floor((state.cooldownUntil - now) / 1000)),
        last_success_at:        state.lastSuccessAt || null,
      };
    }

    responseBody.debug = {
      date_range:        { from, to },
      env_keys:          { present: envPresent, missing: envMissing },
      provider_priority: PROVIDER_NAMES,
      active_providers:  activeProviders,
      live_events:       liveEventCount,
      total_events:      enriched.length,
      fallback_used:     fallbackDecision.type,
      cache_age_hours:   cacheAgeHours,
      reason:            fallbackDecision.reason,
      provider_health:   providerHealth,
      provider_uptime:   providerUptime,
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

function resolveProviderStatus(reason, httpStatus) {
  if (reason === 'missing_api_key') return 'missing_key';
  if (httpStatus === 402)           return 'disabled_paid_plan';
  if (reason === 'no_matching_release_dates' ||
      reason === 'no_supported_events')      return 'no_events';
  return 'failed';
}

function classifyProviderError(reason, httpStatus) {
  if (reason === 'missing_api_key')             return 'missing_key';
  if (httpStatus === 402)                       return 'disabled_paid_plan';
  if (httpStatus === 429)                       return 'rate_limited';
  if (httpStatus === 401 || httpStatus === 403) return 'auth_failed';
  if (httpStatus !== null && httpStatus >= 500) return 'provider_down';
  if (/invalid json/i.test(reason))             return 'schema_drift';
  if (/legacy_endpoint|unsupported_plan|unexpected_response/i.test(reason)) return 'schema_drift';
  if (/api_error/i.test(reason))                return 'auth_failed';
  if (/no_matching|no_supported_events/i.test(reason)) return 'empty_payload';
  if (/timeout/i.test(reason))                  return 'timeout';
  return 'unknown';
}

// healthy  = events available (live or stale cache)
// degraded = real provider errors (5xx, 403, cooldown) — known causes
// offline  = all providers missing keys or returned empty (effectively unconfigured)
function calcProviderHealth(providersMeta, errorTypes, eventCount) {
  if (eventCount > 0) return 'healthy';
  const realFailures = Object.entries(errorTypes).filter(function ([, t]) {
    return t && t !== 'missing_key' && t !== 'empty_payload';
  });
  return realFailures.length > 0 ? 'degraded' : 'offline';
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

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

// ── Event helpers ─────────────────────────────────────────────────────────────

function countWith(events, field) {
  return events.filter(function (e) {
    return e[field] !== null && e[field] !== undefined;
  }).length;
}

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
    if (other.provider === 'fred') continue; // schedule-only, no numeric fields
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
