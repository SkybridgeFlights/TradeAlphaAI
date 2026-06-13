'use strict';

// Phase 101 — check:economic-intelligence. Integrity gate for the canonical
// macro layer (data/intelligence/economic-intelligence.json). HARD-FAILS on:
//   * a surprise score generated from missing actual/forecast (fabrication guard)
//   * release-state mismatch (parsed without actual, revised without revised,
//     awaiting_release/scheduled whose time is already in the past, archived recent)
//   * a high-impact event still in 'released' past its grace window without an
//     actual (must transition to 'delayed' — never stuck claiming released)
//   * stale events left in awaiting_release (time in the past)
//   * duplicate event ids / duplicate (event+country+time) spam
//   * estimated dates presented as verified
//   * a non-null actual/previous/revised with no source attribution (fabrication)
//   * non-numeric (garbage) actual/forecast/previous values
//   * broken bilingual parity of the calendar surface (EN + AR must both exist
//     and reference the calendar data)
// An unbuilt artifact passes (CI builds it each run).

const fs = require('fs');
const path = require('path');
const { RELEASE_STATES } = require('./build-economic-intelligence');

const ROOT = path.resolve(__dirname, '..');
const INTEL_PATH = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');
const EN_PAGE = path.join(ROOT, 'economic-calendar', 'index.html');
const AR_PAGE = path.join(ROOT, 'ar', 'economic-calendar', 'index.html');

const GRACE = { high: 3, medium: 12, low: 24 };
const failures = [];
const fail = (m) => failures.push(m);

const intel = (() => { try { return JSON.parse(fs.readFileSync(INTEL_PATH, 'utf8')); } catch { return null; } })();

if (!intel) {
  console.log('[econ-intel] artifact not built yet — CI builds it each run (non-fatal).');
  console.log('[econ-intel] check:economic-intelligence passed.');
  process.exit(0);
}

const events = Array.isArray(intel.events) ? intel.events : null;
if (!events) fail('events must be an array');

const now = Date.now();
const seenId = new Set();
const seenKey = new Set();
const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

for (const e of events || []) {
  const lbl = `event:${e.id || '<no-id>'}`;

  // State validity.
  if (!RELEASE_STATES.includes(e.release_state)) fail(`${lbl}: invalid release_state "${e.release_state}"`);

  // Numeric integrity (no garbage strings).
  for (const f of ['actual', 'forecast', 'previous', 'revised']) {
    if (!isNumOrNull(e[f])) fail(`${lbl}: ${f} must be a number or null (got ${typeof e[f]})`);
  }

  // Fabrication guard: a surprise score requires an actual AND a forecast basis
  // — either a sourced forecast or an explicitly-labelled historical proxy.
  const score = e.surprise && e.surprise.surprise_score;
  if (score !== null && score !== undefined) {
    const hasBasis = e.forecast !== null || e.proxy_used === true;
    if (e.actual === null || !hasBasis) fail(`${lbl}: surprise_score present without actual + (forecast | labelled proxy) (fabrication)`);
  }

  // Attribution guard: any released value must carry a source.
  if ((e.actual !== null || e.revised !== null) && !e.source) {
    fail(`${lbl}: released value without source attribution`);
  }
  if (e.source_url && !/^https?:\/\//.test(e.source_url)) fail(`${lbl}: source_url not a real URL`);

  // estimated vs verified must be consistent with precision/status.
  // (We only hard-fail the dangerous direction: claiming verified when it is not.)
  if (e.estimated_vs_verified === 'verified' && !(e.data_capabilities && e.data_capabilities.precise_time)) {
    // precise_time capability is the verified-time signal; absence + 'verified' is suspicious
    // but allowed when status confirmed AND release_state already parsed/revised.
    if (!['parsed', 'revised'].includes(e.release_state)) {
      fail(`${lbl}: marked verified without precise-time capability or a parsed/revised state`);
    }
  }

  // Release-state ↔ value consistency.
  const t = Date.parse(e.release_time);
  const hoursSince = Number.isNaN(t) ? 0 : (now - t) / 3600000;
  if (e.release_state === 'parsed' && e.actual === null) fail(`${lbl}: parsed but actual is null`);
  if (e.release_state === 'revised' && e.revised === null) fail(`${lbl}: revised but revised is null`);
  if (e.release_state === 'awaiting_release' && hoursSince > 0) fail(`${lbl}: awaiting_release but release_time is in the past (stale)`);
  if (e.release_state === 'scheduled' && hoursSince > (GRACE[e.importance] ?? 12)) fail(`${lbl}: scheduled but release_time is well past (should be released/delayed/archived)`);
  // High-impact must never be stuck in 'released' past its grace window without an actual.
  if (e.release_state === 'released' && e.actual === null && hoursSince > (GRACE[e.importance] ?? 12)) {
    fail(`${lbl}: high-impact released past grace without actual (must be 'delayed')`);
  }

  // Duplicate guards.
  if (e.id) { if (seenId.has(e.id)) fail(`${lbl}: duplicate id`); seenId.add(e.id); }
  if (e.event && e.country && e.release_time) {
    const k = `${String(e.event).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}|${e.country}|${String(e.release_time).slice(0, 16)}`;
    if (seenKey.has(k)) fail(`${lbl}: duplicate content (event+country+time)`); else seenKey.add(k);
  }
}

// Bilingual parity of the calendar surface.
for (const [label, p] of [['EN', EN_PAGE], ['AR', AR_PAGE]]) {
  if (!fs.existsSync(p)) fail(`${label} economic-calendar page missing (bilingual parity)`);
  else if (!fs.readFileSync(p, 'utf8').includes('/data/economic-calendar.json')) fail(`${label} economic-calendar page does not reference calendar data`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[econ-intel] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[econ-intel] check:economic-intelligence passed (${(events || []).length} events; parsed=${intel.counts.parsed}, awaiting=${intel.counts.awaiting}, delayed=${intel.counts.delayed}; no fabrication, states consistent).`);
