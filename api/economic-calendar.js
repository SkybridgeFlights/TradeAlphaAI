'use strict';

// Vercel serverless API route: GET /api/economic-calendar
// Query params: ?date=YYYY-MM-DD  or  ?from=YYYY-MM-DD&to=YYYY-MM-DD
// Mirrors netlify/functions/economic-calendar.js for Netlify compatibility.

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
// Within the same rank, richness (non-null actual/forecast/previous) breaks ties.
const MERGE_RANK = { te: 0, fmp: 1, finnhub: 2, fred: 3 };

module.exports = async function handler(req, res) {
  console.log('[calendar-api] runtime=vercel');
  // Key diagnostics — presence only, never values
  ['TRADING_ECONOMICS_API_KEY', 'TRADING_ECONOMICS_CLIENT',
   'FMP_API_KEY', 'FINNHUB_API_KEY', 'FRED_API_KEY'].forEach(function (k) {
    console.log('[calendar-env] ' + k + '=' + (String(process.env[k] || '').trim() ? 'present' : 'missing'));
  });

  const q    = req.query || {};
  const from = q.from || q.date || addDays(today(), -1);
  const to   = q.to   || (q.date ? q.date : addDays(today(), 14));

  const context = { from, to, env: process.env };

  // Fetch all providers in parallel — one slow/failing provider does not block others
  const results = await Promise.allSettled(
    PROVIDERS.map(function (p) { return p.fetchCalendar(context); })
  );

  const providersMeta = {};
  const rawPool       = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const name   = PROVIDER_NAMES[i];
    const result = results[i];

    if (result.status === 'fulfilled') {
      const events   = result.value.events || [];
      const usable   = pickUsable(events);
      const rawCount = result.value.rawCount || events.length;

      // Completeness diagnostics: count events with each numeric field populated
      const withActual   = countWith(usable, 'actual');
      const withForecast = countWith(usable, 'forecast');
      const withPrevious = countWith(usable, 'previous');
      // Score: (filled fields) / (possible fields) × 100, rounded to integer
      const completenessScore = usable.length > 0
        ? Math.round((withActual + withForecast + withPrevious) / (usable.length * 3) * 100)
        : 0;

      providersMeta[name] = {
        status:             'ok',
        raw:                rawCount,
        normalized:         usable.length,
        with_actual:        withActual,
        with_forecast:      withForecast,
        with_previous:      withPrevious,
        completeness_score: completenessScore,
      };
      rawPool.push(...usable);
    } else {
      const reason = sanitize(result.reason && result.reason.message);
      providersMeta[name] = {
        status:             reason === 'missing_api_key' ? 'missing_key' : 'failed',
        raw:                0,
        normalized:         0,
        with_actual:        0,
        with_forecast:      0,
        with_previous:      0,
        completeness_score: 0,
      };
    }
  }

  const merged   = mergeEvents(rawPool);
  const enriched = merged.map(function (e) {
    return Object.assign({}, e, { error: undefined, intelligence: computeIntelligence(e) });
  });
  enriched.sort(function (a, b) { return (a.event_time || '').localeCompare(b.event_time || ''); });

  const hasLive = Object.values(providersMeta).some(function (p) { return p && p.status === 'ok'; });
  const status  = hasLive ? 200 : 503;

  const body = JSON.stringify({
    schema_version: '2.1',
    updated_at:     new Date().toISOString(),
    source:         hasLive ? 'live' : 'degraded',
    providers:      providersMeta,
    events:         enriched,
  });

  res.setHeader('Content-Type',                'application/json');
  res.setHeader('Cache-Control',               'public, max-age=900, stale-while-revalidate=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.statusCode = status;
  res.end(body);
};

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

// Richness score: how many numeric fields are non-null (actual and forecast
// weighted more than previous because they're the most visible to users).
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
    // Primary sort: provider rank (te=0, fmp=1, finnhub=2, fred=3)
    if (rankA !== rankB) return rankA - rankB;
    // Secondary sort: prefer the richer record (more non-null actual/forecast/previous)
    return richness(b) - richness(a);
  });
  const base    = Object.assign({}, sorted[0]);
  const sources = sorted.map(function (e) { return e.provider; }).filter(Boolean)
    .filter(function (v, i, a) { return a.indexOf(v) === i; });
  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];
    // FRED is a schedule-only provider — it never has real actual/forecast/previous values.
    // Explicitly block it from contributing numeric fields even if its null-fill logic
    // somehow produces non-null values in future.
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
