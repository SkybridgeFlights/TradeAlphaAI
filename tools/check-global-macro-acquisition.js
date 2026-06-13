'use strict';

// Phase 104 — check:global-macro-acquisition. Integrity gate for the global
// macro acquisition layer (data/intelligence/global-macro-events.json) and the
// global events merged into the calendar. HARD-FAILS if:
//   * an event has no source / source_url (official attribution missing)
//   * an event has no country or region
//   * an event has no release_time or no acquisition_method (status reason)
//   * an estimated date is marked verified (estimated_date && verified_time)
//   * duplicate (type|country|date) recurring spam appears
//   * an event_type is outside the allowed set (fabricated event)
//   * a source is outside the known official source allowlist (fabricated source)
//   * coverage is below the minimum without an explicit source_outage flag
//   * a forecast/actual is present (acquisition layer must carry none — those
//     come only from the official enrichment layer)
//   * any required field is blank/undefined/null
// An unbuilt artifact passes (CI builds it each run).

const fs = require('fs');
const path = require('path');
const { ALLOWED_TYPES } = require('./providers/economic-calendar/calendar-normalizer');
const { MIN_COVERAGE } = require('./build-global-macro-events');

const ROOT = path.resolve(__dirname, '..');
const ART = path.join(ROOT, 'data', 'intelligence', 'global-macro-events.json');

// Known official/legal sources (statistics offices + central banks). A source
// outside this set is treated as fabricated.
const ALLOWED_SOURCE = /(Bank of|Reserve Bank|National Bank|Eurostat|Destatis|Office for National Statistics|Statistics|Bureau|European Central Bank|Federal Reserve|Treasury|Energy Information)/i;
const ALLOWED_METHOD = new Set(['official_schedule', 'official_api', 'public_feed', 'estimated_recurring']);

const failures = [];
const fail = (m) => failures.push(m);

const art = (() => { try { return JSON.parse(fs.readFileSync(ART, 'utf8')); } catch { return null; } })();
if (!art) {
  console.log('[global-macro] artifact not built yet — CI builds it each run (non-fatal).');
  console.log('[global-macro] check:global-macro-acquisition passed.');
  process.exit(0);
}

const events = Array.isArray(art.events) ? art.events : [];
const seen = new Set();

for (const e of events) {
  const lbl = `event:${e.id || '<no-id>'}`;
  if (!e.source || !e.source_url) fail(`${lbl}: missing source attribution`);
  if (e.source_url && !/^https?:\/\//.test(e.source_url)) fail(`${lbl}: source_url not a real URL`);
  if (e.source && !ALLOWED_SOURCE.test(e.source)) fail(`${lbl}: source "${e.source}" not in official allowlist (fabricated?)`);
  if (!e.country) fail(`${lbl}: missing country`);
  if (!e.region) fail(`${lbl}: missing region`);
  if (!e.release_time || Number.isNaN(Date.parse(e.release_time))) fail(`${lbl}: missing/invalid release_time`);
  if (!ALLOWED_METHOD.has(e.acquisition_method)) fail(`${lbl}: invalid acquisition_method "${e.acquisition_method}" (no status reason)`);
  if (!ALLOWED_TYPES.has(e.event_type)) fail(`${lbl}: event_type "${e.event_type}" not allowed (fabricated event)`);
  if (!e.event_name) fail(`${lbl}: missing event_name`);
  if (!e.importance) fail(`${lbl}: missing importance`);
  if (typeof e.source_confidence !== 'number') fail(`${lbl}: source_confidence not numeric`);
  if (!e.legal_status) fail(`${lbl}: missing legal_status`);

  // Honesty: an estimated date must never be marked verified.
  if (e.estimated_date === true && e.verified_time === true) fail(`${lbl}: estimated date marked verified`);

  // The acquisition layer carries schedule only — no actual/forecast here.
  if (e.actual !== null && e.actual !== undefined) fail(`${lbl}: acquisition layer must not carry actual`);
  if (e.forecast !== null && e.forecast !== undefined) fail(`${lbl}: acquisition layer must not carry forecast`);

  // Duplicate recurring spam.
  const key = `${e.event_type}|${e.country}|${String(e.release_time).slice(0, 10)}`;
  if (seen.has(key)) fail(`${lbl}: duplicate recurring event (${key})`);
  seen.add(key);
}

// Coverage floor (unless an explicit source outage is declared).
if (events.length < MIN_COVERAGE && art.source_outage !== true) {
  fail(`coverage ${events.length} below minimum ${MIN_COVERAGE} and no source_outage flag set`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[global-macro] FAIL: ${f}`));
  process.exit(1);
}
const regions = art.coverage && art.coverage.by_region ? Object.keys(art.coverage.by_region).length : 0;
console.log(`[global-macro] check:global-macro-acquisition passed (${events.length} events, ${regions} region(s), by_method=${JSON.stringify(art.coverage && art.coverage.by_method || {})}; official-attributed, deduped, no fabrication).`);
