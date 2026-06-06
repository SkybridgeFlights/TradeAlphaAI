'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');
const { ALLOWED_TYPES, normalizeManualEvent } = require('./providers/economic-calendar/calendar-normalizer');
const { fetchEconomicCalendar } = require('./providers/economic-calendar/provider-router');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'economic-calendar.json');
const DEGRADATION = path.join(ROOT, 'data', 'intelligence', 'provider-degradation.json');
const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const fetch = process.argv.includes('--fetch');

async function main() {
  let events = [];
  let source = 'manual';
  let providerMetadata = {};

  if (sourcePath) {
    const sourceFile = path.resolve(ROOT, sourcePath);
    const input = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
    events = (Array.isArray(input.events) ? input.events : []).map(normalizeManualEvent);
  } else if (fetch) {
    const routed = await fetchEconomicCalendar({
      from: dateString(-1),
      to: dateString(14),
      env: process.env
    });
    events = routed.events || [];
    source = routed.provider;
    providerMetadata = {
      endpoint: routed.endpoint || null,
      fallback_used: routed.fallbackUsed === true,
      cache_used: routed.cacheUsed === true,
      attempts: routed.attempts || []
    };
    writeDegradationState(routed);
  } else {
    console.log('No economic calendar source provided. Use --source=<json> [--write] or --fetch [--write].');
    return;
  }

  const failures = events.filter((event) => event.error);
  for (const event of failures) {
    console.warn(`[calendar] Skipped invalid event ${event.id || '<missing>'}: ${event.error}`);
  }
  events = deduplicate(events.filter((event) => !event.error));
  const enriched = events.map((event) => ({
    ...event,
    ...analyzeEconomicSurprise(event)
  }));
  const output = {
    version: '2.0',
    updated_at: new Date().toISOString(),
    source,
    provider_metadata: providerMetadata,
    source_policy: {
      requires_real_sources: true,
      manual_or_api_import_only: true,
      no_fabricated_values: true,
      allowed_event_types: [...ALLOWED_TYPES],
      required_source_fields: ['source_name', 'source_url', 'fetched_at']
    },
    events: enriched.sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''))
  };

  if (!write) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[calendar] Updated data/economic-calendar.json with ${enriched.length} event(s) from ${source}.`);
  if (!enriched.length) console.warn('[calendar] No supported live events available; downstream macro tools will remain in degraded mode.');
}

function writeDegradationState(result) {
  const degraded = result.provider === 'degraded' || result.cacheUsed === true;
  const state = {
    calendar_provider: result.provider,
    status: degraded ? 'degraded' : 'live',
    reason: degraded ? (result.cacheUsed ? 'live_providers_unavailable_cache_used' : 'all_providers_unavailable') : null,
    endpoint: result.endpoint || null,
    fallback_used: result.fallbackUsed === true,
    fallback_mode: degraded,
    timestamp: new Date().toISOString()
  };
  try {
    fs.mkdirSync(path.dirname(DEGRADATION), { recursive: true });
    fs.writeFileSync(DEGRADATION, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  } catch (error) {
    console.warn(`[PROVIDER_ROUTER] unable to write degradation state: ${sanitize(error.message)}`);
  }
}

function deduplicate(events) {
  const seen = new Set();
  return events.filter((event) => {
    const key = `${event.type}|${event.country}|${event.event_time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function dateString(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

main().catch((error) => {
  console.warn(`[PROVIDER_ROUTER] non-fatal calendar update error=${sanitize(error.message)}`);
  writeDegradationState({ provider: 'degraded', endpoint: '', fallbackUsed: true });
  if (write) {
    const fallback = {
      version: '2.0',
      updated_at: new Date().toISOString(),
      source: 'degraded',
      provider_metadata: { fallback_used: true, reason: 'unhandled_router_error' },
      source_policy: {
        requires_real_sources: true,
        manual_or_api_import_only: true,
        no_fabricated_values: true,
        allowed_event_types: [...ALLOWED_TYPES],
        required_source_fields: ['source_name', 'source_url', 'fetched_at']
      },
      events: []
    };
    try {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, `${JSON.stringify(fallback, null, 2)}\n`, 'utf8');
    } catch (writeError) {
      console.warn(`[PROVIDER_ROUTER] unable to write degraded calendar: ${sanitize(writeError.message)}`);
    }
  }
  process.exitCode = 0;
});

function sanitize(value) {
  return String(value || '').replace(/apikey=[^&\s]+/gi, 'apikey=[redacted]').replace(/token=[^&\s]+/gi, 'token=[redacted]');
}
