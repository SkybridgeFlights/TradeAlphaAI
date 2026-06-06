'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');

const ROOT        = path.resolve(__dirname, '..');
const OUT         = path.join(ROOT, 'data', 'economic-calendar.json');
const CACHE       = path.join(ROOT, 'data', 'cache', 'economic-calendar-cache.json');
const HEALTH      = path.join(ROOT, 'data', 'provider-health.json');
const DEGRADATION = path.join(ROOT, 'data', 'intelligence', 'provider-degradation.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const fetch = process.argv.includes('--fetch');

const allowedTypes = new Set([
  'CPI', 'Core CPI', 'PCE', 'Core PCE', 'NFP', 'Unemployment Rate',
  'FOMC Rate Decision', 'Fed Statement', 'Powell Speech', 'GDP',
  'Retail Sales', 'ISM PMI', 'Jobless Claims', 'Treasury Auction',
  'ECB Rate Decision', 'BoJ Rate Decision', 'BoE Rate Decision'
]);
const allowedImportance = new Set(['high', 'medium', 'low']);

async function main() {
  let events;
  let sourceLabel;

  if (sourcePath) {
    // Manual import path (unchanged)
    const sourceFile = path.resolve(ROOT, sourcePath);
    const input = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    events = (Array.isArray(input.events) ? input.events : []).map(normalizeEvent);
    sourceLabel = 'manual';
  } else if (fetch) {
    const apiKey = (process.env.FMP_API_KEY || '').trim();
    if (!apiKey) {
      console.warn('[calendar] FMP_API_KEY is not set — cannot fetch live calendar data.');
      console.warn('[calendar] entering degraded intelligence mode');
      events = writeDegradedMode('missing_api_key');
      sourceLabel = 'fallback';
    } else {
      events = await fetchFromFmp(apiKey);
      sourceLabel = events === null ? 'fallback' : 'fmp';
      if (sourceLabel === 'fallback') events = [];
    }
  } else {
    console.log('No economic calendar source provided. Use --source=<json> [--write] or --fetch [--write].');
    process.exit(0);
  }

  // In fallback/degraded mode the calendar file was already written by writeDegradedMode()
  if (sourceLabel === 'fallback') {
    console.warn('[calendar] continuing pipeline with empty calendar dataset');
    return;
  }

  const failures = events.filter((e) => e.error);
  if (failures.length) {
    failures.forEach((e) => console.error(`Invalid event ${e.id || '<missing>'}: ${e.error}`));
    if (sourceLabel === 'manual') process.exit(1);
    // For FMP live fetch, skip invalid events rather than aborting
    events = events.filter((e) => !e.error);
  }

  const enriched = events.map((e) => ({ ...e, ...analyzeEconomicSurprise(e) }));
  const output = {
    version: '2.0',
    updated_at: new Date().toISOString(),
    source: sourceLabel,
    source_policy: {
      requires_real_sources: true,
      manual_or_api_import_only: true,
      no_fabricated_values: true,
      allowed_event_types: [...allowedTypes],
      required_source_fields: ['source_name', 'source_url', 'fetched_at']
    },
    events: enriched.sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''))
  };

  if (!write) {
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[calendar] Updated data/economic-calendar.json with ${enriched.length} event(s) from ${sourceLabel}.`);
}

async function fetchFromFmp(apiKey) {
  const fetched_at = new Date().toISOString();

  // Try cache first if still fresh
  const cached = readCache();
  if (cached && isCacheFresh(cached)) {
    console.log(`[calendar] Using cached FMP data (age: ${cacheAgeMinutes(cached)}m)`);
    updateProviderHealth('fmp', 'cache_hit', null);
    return cached.events || [];
  }

  // Date range: yesterday through next 14 days
  const from = dateString(-1);
  const to = dateString(14);
  const url = `https://financialmodelingprep.com/api/v3/economic_calendar?from=${from}&to=${to}&apikey=${apiKey}`;

  console.log(`[calendar] Fetching FMP economic calendar ${from} to ${to}...`);
  let raw;
  try {
    raw = await httpGet(url);
  } catch (err) {
    const reason = err.message.startsWith('HTTP ') ? err.message.replace('HTTP ', 'http_').toLowerCase() : 'network_error';
    updateProviderHealth('fmp', 'error', err.message);
    if (cached) {
      console.warn(`[calendar] FMP fetch failed (${err.message}); falling back to cached data (age: ${cacheAgeMinutes(cached)}m)`);
      return cached.events || [];
    }
    console.warn(`[calendar] provider unavailable (${err.message})`);
    console.warn('[calendar] entering degraded intelligence mode');
    console.warn('[calendar] continuing pipeline with empty calendar dataset');
    writeDegradedMode(reason);
    return null; // signals caller to use empty fallback
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    updateProviderHealth('fmp', 'error', 'invalid JSON response');
    if (cached) {
      console.warn('[calendar] FMP returned invalid JSON; falling back to cache.');
      return cached.events || [];
    }
    console.warn('[calendar] provider unavailable (invalid JSON response)');
    console.warn('[calendar] entering degraded intelligence mode');
    console.warn('[calendar] continuing pipeline with empty calendar dataset');
    writeDegradedMode('invalid_json');
    return null;
  }

  if (!Array.isArray(data)) {
    updateProviderHealth('fmp', 'error', `unexpected response type: ${typeof data}`);
    if (cached) {
      console.warn('[calendar] Unexpected FMP response shape; falling back to cache.');
      return cached.events || [];
    }
    console.warn(`[calendar] provider unavailable (unexpected response: ${typeof data})`);
    console.warn('[calendar] entering degraded intelligence mode');
    console.warn('[calendar] continuing pipeline with empty calendar dataset');
    writeDegradedMode('unexpected_response');
    return null;
  }

  const FMP_SOURCE_URL = 'https://financialmodelingprep.com/financial-statements-and-filings/economic-calendar';

  const normalized = data
    .filter((item) => item && item.event)
    .map((item) => normalizeFmpEvent(item, fetched_at, FMP_SOURCE_URL));

  // Write to cache (raw normalized events before enrichment)
  writeCache({ fetched_at, events: normalized });
  updateProviderHealth('fmp', 'ok', null, normalized.length);
  console.log(`[calendar] FMP returned ${data.length} raw events; ${normalized.length} matched allowed types.`);
  return normalized;
}

function normalizeFmpEvent(item, fetched_at, source_url) {
  const eventName = (item.event || '').trim();
  const type = normalizeType(eventName);
  const importance = normalizeImportance(item.impact);
  const eventTime = normalizeDateTime(item.date);
  const out = {
    id: slugify(`${eventTime}-${eventName}`),
    event_name: eventName,
    name: eventName,
    type,
    country: item.country || null,
    importance,
    impact_level: importance,
    forecast: numberOrNull(item.estimate),
    previous: numberOrNull(item.previous),
    actual: numberOrNull(item.actual),
    unit: item.unit || null,
    event_time: eventTime,
    date: String(eventTime || '').slice(0, 10),
    timezone: 'America/New_York',
    status: item.actual != null ? 'released' : 'scheduled',
    market_expectation: null,
    historical_asset_sensitivity: defaultSensitivity(type),
    pre_event_regime: null,
    post_event_regime: null,
    source_name: 'Financial Modeling Prep',
    source_url,
    fetched_at
  };
  if (!allowedTypes.has(out.type)) out.error = `unsupported type: ${eventName}`;
  else if (!out.event_time || Number.isNaN(Date.parse(out.event_time))) out.error = `invalid event_time: ${item.date}`;
  else if (!out.country) out.error = 'missing country';
  else if (!allowedImportance.has(out.importance)) out.error = `unknown importance: ${item.impact}`;
  return out;
}

function normalizeEvent(event) {
  const eventName = event.event_name || event.name;
  const eventTime = event.event_time || toIso(event.event_date || event.date, event.time, event.timezone);
  const type = normalizeType(event.type || eventName);
  const importance = event.importance || event.impact_level;
  const out = {
    id: event.id || slugify(`${eventTime}-${eventName}`),
    event_name: eventName,
    name: eventName,
    type,
    country: event.country || null,
    importance,
    impact_level: importance,
    forecast: numberOrNull(event.forecast),
    previous: numberOrNull(event.previous),
    actual: numberOrNull(event.actual),
    unit: event.unit || null,
    event_time: eventTime,
    date: String(eventTime || '').slice(0, 10),
    timezone: event.timezone || 'UTC',
    status: event.status || (event.actual == null ? 'scheduled' : 'released'),
    market_expectation: event.market_expectation || null,
    historical_asset_sensitivity: event.historical_asset_sensitivity || defaultSensitivity(type),
    pre_event_regime: event.pre_event_regime || null,
    post_event_regime: event.post_event_regime || null,
    source_name: event.source_name,
    source_url: event.source_url,
    fetched_at: event.fetched_at || null,
    tags: Array.isArray(event.tags) ? event.tags : []
  };
  if (!allowedTypes.has(out.type)) out.error = `unsupported type ${out.type}`;
  else if (!out.event_name) out.error = 'missing event_name';
  else if (!out.event_time || Number.isNaN(Date.parse(out.event_time))) out.error = 'event_time must be an ISO date-time';
  else if (!out.country) out.error = 'missing country';
  else if (!allowedImportance.has(out.importance)) out.error = 'importance must be high, medium, or low';
  else if (!/^https?:\/\//.test(out.source_url || '')) out.error = 'missing real source_url';
  else if (!out.source_name) out.error = 'missing source_name';
  else if (!out.fetched_at || Number.isNaN(Date.parse(out.fetched_at))) out.error = 'fetched_at must be an ISO date-time';
  return out;
}

function normalizeType(value) {
  const text = String(value || '').toLowerCase();
  const mappings = [
    [/core.*cpi/, 'Core CPI'], [/\bcpi\b/, 'CPI'], [/core.*pce/, 'Core PCE'], [/\bpce\b/, 'PCE'],
    [/nonfarm|\bnfp\b/, 'NFP'], [/unemployment/, 'Unemployment Rate'], [/fed statement/, 'Fed Statement'],
    [/powell/, 'Powell Speech'], [/fomc|fed rate/, 'FOMC Rate Decision'], [/\bgdp\b/, 'GDP'],
    [/retail sales/, 'Retail Sales'], [/ism.*pmi|manufacturing pmi.*us|services pmi.*us/, 'ISM PMI'],
    [/jobless claims|initial claims/, 'Jobless Claims'], [/treasury.*auction/, 'Treasury Auction'],
    [/ecb/, 'ECB Rate Decision'], [/boj|bank of japan/, 'BoJ Rate Decision'],
    [/boe|bank of england/, 'BoE Rate Decision']
  ];
  return (mappings.find(([pattern]) => pattern.test(text)) || [null, value])[1];
}

function normalizeImportance(impact) {
  const v = String(impact || '').toLowerCase();
  if (v === 'high') return 'high';
  if (v === 'medium') return 'medium';
  if (v === 'low') return 'low';
  return v || 'medium';
}

function normalizeDateTime(dateStr) {
  if (!dateStr) return null;
  // FMP returns "2026-06-06 08:30:00" or "2026-06-06T08:30:00" format
  const s = String(dateStr).replace(' ', 'T');
  // Assume US Eastern if no tz — mark as offset -04:00 (EDT)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) return `${s.length === 16 ? s + ':00' : s}-04:00`;
  return new Date(s).toISOString();
}

function defaultSensitivity(type) {
  if (/CPI|PCE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'QQQ', 'TLT'];
  if (/NFP|Unemployment|Jobless/.test(type)) return ['Treasury yields', 'DXY', 'SPY', 'IWM', 'VIX'];
  if (/FOMC|Fed|ECB|BoJ|BoE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'SPY', 'QQQ', 'TLT', 'VIX'];
  if (/GDP|Retail|ISM/.test(type)) return ['Treasury yields', 'SPY', 'IWM', 'Oil', 'Defensive sectors'];
  return ['Treasury yields', 'DXY', 'SPY', 'VIX'];
}

// ── Degraded mode ────────────────────────────────────────────────────────────

function writeDegradedMode(reason) {
  const now = new Date().toISOString();
  // Write provider-degradation.json
  try {
    fs.mkdirSync(path.dirname(DEGRADATION), { recursive: true });
    fs.writeFileSync(DEGRADATION, JSON.stringify({
      calendar_provider: 'fmp',
      status: 'degraded',
      reason,
      timestamp: now,
      fallback_mode: true
    }, null, 2) + '\n', 'utf8');
  } catch (e) {
    console.warn('[calendar] Could not write provider-degradation.json:', e.message);
  }
  // Write empty calendar fallback so downstream tools have a valid file
  if (write) {
    try {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({
        generated_at: now,
        provider: 'fallback',
        status: 'degraded',
        events: []
      }, null, 2) + '\n', 'utf8');
      console.warn('[calendar] Wrote empty fallback calendar: data/economic-calendar.json');
    } catch (e) {
      console.warn('[calendar] Could not write fallback calendar:', e.message);
    }
  }
  updateProviderHealth('fmp', 'degraded', reason);
  return []; // empty events array for callers
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readCache() {
  try { return JSON.parse(fs.readFileSync(CACHE, 'utf8')); } catch { return null; }
}

function writeCache(data) {
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function isCacheFresh(cached) {
  if (!cached?.fetched_at) return false;
  return Date.now() - Date.parse(cached.fetched_at) < CACHE_MAX_AGE_MS;
}

function cacheAgeMinutes(cached) {
  if (!cached?.fetched_at) return '?';
  return Math.round((Date.now() - Date.parse(cached.fetched_at)) / 60000);
}

// ── Provider health ───────────────────────────────────────────────────────────

function updateProviderHealth(provider, status, errorMsg, eventCount) {
  let health = {};
  try { health = JSON.parse(fs.readFileSync(HEALTH, 'utf8')); } catch { /* create fresh */ }
  if (!health.providers) health.providers = {};
  health.providers[provider] = {
    last_checked: new Date().toISOString(),
    status,
    ...(errorMsg ? { last_error: errorMsg } : {}),
    ...(typeof eventCount === 'number' ? { last_event_count: eventCount } : {})
  };
  fs.writeFileSync(HEALTH, JSON.stringify(health, null, 2) + '\n', 'utf8');
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('timeout')); });
  });
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function toIso(date, time = '00:00', timezone = 'UTC') {
  if (!date) return null;
  if (String(date).includes('T')) return new Date(date).toISOString();
  if (timezone !== 'UTC') return `${date}T${time || '00:00'}:00${eventOffset(timezone)}`;
  return `${date}T${time || '00:00'}:00Z`;
}

function eventOffset(timezone) {
  return timezone === 'America/New_York' ? '-04:00' : 'Z';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[%,$]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function dateString(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return d.toISOString().slice(0, 10);
}

main().catch((err) => {
  console.warn('[calendar] Unhandled error:', err.message);
  console.warn('[calendar] entering degraded intelligence mode');
  writeDegradedMode('unhandled_error');
  process.exit(0); // never block the pipeline
});
