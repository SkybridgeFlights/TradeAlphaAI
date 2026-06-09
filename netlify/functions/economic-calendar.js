'use strict';

const fmp       = require('../../tools/providers/economic-calendar/fmp-provider');
const finnhub   = require('../../tools/providers/economic-calendar/finnhub-provider');
const fred      = require('../../tools/providers/economic-calendar/fred-provider');
const { inferImpact, computeIntelligence } = require('../../tools/providers/economic-calendar/event-intelligence');

const PROVIDERS      = [fmp, finnhub, fred];
const PROVIDER_NAMES = ['fmp', 'finnhub', 'fred'];

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
  'Access-Control-Allow-Origin': '*',
};

exports.handler = async function(event) {
  const q    = event.queryStringParameters || {};
  const from = q.from || q.date || addDays(today(), -1);
  const to   = q.to   || (q.date ? q.date : addDays(today(), 14));

  // Fetch all providers in parallel
  const results = await Promise.allSettled(
    PROVIDERS.map(p => p.fetchCalendar({ from, to, env: process.env }))
  );

  const providersMeta = {};
  const rawPool = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const name   = PROVIDER_NAMES[i];
    const result = results[i];
    if (result.status === 'fulfilled') {
      const events   = result.value.events || [];
      const usable   = pickUsable(events);
      const rawCount = result.value.rawCount || events.length;
      providersMeta[name] = { status: 'ok', raw: rawCount, normalized: usable.length };
      rawPool.push(...usable);
    } else {
      const reason = sanitize(result.reason?.message);
      providersMeta[name] = {
        status: reason === 'missing_api_key' ? 'missing_key' : 'failed',
        raw: 0,
        normalized: 0,
      };
    }
  }

  const merged   = mergeEvents(rawPool);
  const enriched = merged.map(e => ({ ...e, error: undefined, intelligence: computeIntelligence(e) }));
  // Sort by event_time
  enriched.sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));

  const hasLive = Object.values(providersMeta).some(p => p.status === 'ok');

  return {
    statusCode: hasLive ? 200 : 503,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      schema_version: '2.1',
      updated_at: new Date().toISOString(),
      source: hasLive ? 'live' : 'degraded',
      providers: providersMeta,
      events: enriched,
    }),
  };
};

// Accept events that the static normalizer rejected only for "unsupported type".
// Truly broken events (missing required fields, non-type errors) are excluded.
function pickUsable(events) {
  const out = [];
  for (const e of events) {
    if (!e.event_name || !e.event_time || !e.country) continue;
    if (e.error && !e.error.startsWith('unsupported type')) continue;
    if (e.error) {
      // Restore events rejected for type only — infer impact from name
      const inferred = inferImpact(e.event_name);
      out.push({ ...e, importance: e.importance || inferred.impact, error: undefined });
    } else {
      out.push(e);
    }
  }
  return out;
}

// Merge events from all providers, deduplicating on date+country+name.
// Prefer richer fields: actual/forecast from FMP/Finnhub, schedule from FRED.
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
  return `${date}|${country}|${name}`;
}

function mergeGroup(group) {
  if (group.length === 1) return group[0];
  // FMP and Finnhub carry actuals/forecasts; FRED carries only release schedule
  const sorted = [...group].sort((a, b) => {
    const rank = { fmp: 0, finnhub: 1, fred: 2 };
    return (rank[a.provider] ?? 9) - (rank[b.provider] ?? 9);
  });
  const base    = { ...sorted[0] };
  const sources = [...new Set(sorted.map(e => e.provider).filter(Boolean))];
  for (const other of sorted.slice(1)) {
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
    .slice(0, 120);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
