'use strict';

// Dedicated fetch entry-point for economic calendar data.
// Used by the publishing workflow before check:economic-calendar to ensure
// the calendar is as fresh as possible before structural validation runs.
// Falls back to the existing data file when all live providers are unavailable.

const fs   = require('fs');
const path = require('path');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');
const { ALLOWED_TYPES }           = require('./providers/economic-calendar/calendar-normalizer');
const { fetchEconomicCalendar }   = require('./providers/economic-calendar/provider-router');
const { getGlobalEventsForCalendar } = require('./build-global-macro-events');
const scheduleFallback            = require('./providers/economic-calendar/schedule-fallback-provider');

const ROOT  = path.resolve(__dirname, '..');
const OUT   = path.join(ROOT, 'data', 'economic-calendar.json');
const WRITE = process.argv.includes('--write');

// ── Helpers ───────────────────────────────────────────────────────────────────

function dateStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function sanitize(v) {
  return String(v || '')
    .replace(/apikey=[^&\s]+/gi, 'apikey=[redacted]')
    .replace(/token=[^&\s]+/gi,  'token=[redacted]')
    .slice(0, 240);
}

function readExisting() {
  try {
    const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    return Array.isArray(data.events) && data.events.length > 0 ? data : null;
  } catch { return null; }
}

function deduplicate(events) {
  const seenId  = new Set();
  const seenKey = new Set();
  return events.filter(e => {
    if (seenId.has(e.id)) return false;
    seenId.add(e.id);
    const title = String(e.event_name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const key   = `${title}|${e.country}|${String(e.event_time || '').slice(0, 16)}`;
    if (seenKey.has(key)) return false;
    seenKey.add(key);
    return true;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const from = dateStr(-7);  // Keep last week of releases in-window for reaction interpretation.
  const to   = dateStr(90);  // 90-day forward horizon — Investing.com-level depth from the schedule-fallback path. UI still filters to 7d/week.
  console.log(`[calendar:fetch] target range=${from}..${to}`);

  let result;
  try {
    result = await fetchEconomicCalendar({ from, to, env: process.env });
  } catch (err) {
    console.warn(`[calendar:fetch] provider router error: ${sanitize(err.message)}`);
    result = { provider: 'degraded', events: [], fallbackUsed: true, attempts: [] };
  }

  const rawCount        = result.rawCount       || (result.events || []).length;
  const normalizedCount = (result.events || []).length;
  let   validEvents     = (result.events || []).filter(e => !e.error);
  // Phase 104: always include the deterministic US recurring schedule and the
  // global macro acquisition supplement (official central-bank schedules +
  // recurring official statistical releases), then dedupe so any live/router
  // data takes priority. Free/official only; degrades gracefully on error.
  let globalCount = 0; let usScheduleCount = 0;
  try {
    const sched = await scheduleFallback.fetchCalendar({ from, to, env: process.env });
    const usSchedule = (sched.events || []).filter(e => !e.error);
    const globalEvents = getGlobalEventsForCalendar({ from, to }).filter(e => !e.error);
    usScheduleCount = usSchedule.length; globalCount = globalEvents.length;
    validEvents = validEvents.concat(usSchedule, globalEvents);
    console.log(`[calendar:fetch] merged ${usScheduleCount} US schedule + ${globalCount} global macro event(s)`);
  } catch (err) {
    console.warn(`[calendar:fetch] schedule/global merge degraded: ${sanitize(err.message)}`);
  }
  const rejectedCount   = normalizedCount - (result.events || []).filter(e => !e.error).length;
  console.log(`[calendar:fetch] provider=${result.provider} raw=${rawCount} normalized=${normalizedCount} valid=${validEvents.length} rejected=${rejectedCount}`);
  if (rejectedCount > 0) {
    const reasons = {};
    (result.events || []).filter(e => e.error).forEach(e => {
      const key = (e.error || 'unknown').slice(0, 60);
      reasons[key] = (reasons[key] || 0) + 1;
    });
    Object.entries(reasons).forEach(([r, n]) => console.log(`[calendar:fetch]   rejected reason: ${r} (×${n})`));
  }

  const valid = deduplicate(validEvents);

  // If no live data, retain existing file rather than overwriting with empty data.
  if (!valid.length) {
    const existing = readExisting();
    if (existing) {
      const age = existing.updated_at
        ? Math.round((Date.now() - Date.parse(existing.updated_at)) / 3600000)
        : null;
      console.log(
        `[calendar:fetch] providers unavailable — retaining existing data` +
        ` (${existing.events.length} events, source=${existing.source || 'cache'}` +
        (age !== null ? `, age=${age}h` : '') + ')'
      );
      return;
    }
    console.warn('[calendar:fetch] no live data and no valid cache — writing empty calendar');
  }

  const enriched = valid
    .map(e => ({ ...e, ...analyzeEconomicSurprise(e) }))
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''));

  // When live providers are degraded but the deterministic schedule + global
  // supplement produced events, label the source honestly as the composite
  // official-schedule acquisition rather than 'degraded'.
  const sourceLabel = (result.provider === 'degraded' && enriched.length) ? 'schedule_fallback' : result.provider;

  const output = {
    version: '2.0',
    updated_at: new Date().toISOString(),
    source: sourceLabel,
    provider_metadata: {
      endpoint:     result.endpoint    || null,
      fallback_used: result.fallbackUsed === true,
      cache_used:    result.cacheUsed   === true,
      attempts:      result.attempts   || [],
    },
    source_policy: {
      requires_real_sources:     true,
      manual_or_api_import_only: true,
      no_fabricated_values:      true,
      allowed_event_types:       [...ALLOWED_TYPES],
      required_source_fields:    ['source_name', 'source_url', 'fetched_at'],
    },
    events: enriched,
  };

  if (!WRITE) {
    console.log(`[calendar:fetch] dry-run — ${enriched.length} event(s) from ${result.provider}`);
    return;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[calendar:fetch] wrote ${enriched.length} event(s) from ${result.provider} → data/economic-calendar.json`);

  if (!enriched.length) {
    console.warn('[calendar:fetch] WARNING: calendar is empty — downstream tools remain in degraded mode');
  }
}

main().catch(err => {
  console.warn(`[calendar:fetch] unhandled error: ${sanitize(err.message)}`);
  const existing = readExisting();
  if (existing) {
    console.log('[calendar:fetch] retaining existing data after unhandled error');
  } else {
    console.warn('[calendar:fetch] no fallback available — calendar will be empty');
  }
  process.exitCode = 0;
});
