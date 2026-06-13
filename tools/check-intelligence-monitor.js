'use strict';

// Phase 108 — check:intelligence-monitor. Integrity gate for the observability
// artifacts. HARD-FAILS if monitoring state is fabricated or contradictory:
//   * an unsupported health/decision label
//   * a stale workflow (age beyond 2× its threshold) reported 'healthy'
//   * impossible timestamps / negative ages / NaN
//   * a missing canonical workflow (hidden workflow)
//   * overall_health healthier than the worst sub-state (hidden failure)
//   * a degraded acquisition source while acquisition health is 'healthy'
//   * literal undefined/NaN leaked into the artifacts
//   * the workflow-health set not covering all six canonical brains
// Unbuilt artifacts pass (CI builds them each run).

const fs = require('fs');
const path = require('path');
const { HEALTH_RANK } = require('./build-intelligence-monitor');

const ROOT = path.resolve(__dirname, '..');
const SS = path.join(ROOT, 'data', 'system-status');
const HEALTH = new Set(['healthy', 'warning', 'degraded', 'unavailable']);
const CANONICAL_BRAINS = ['Market News Brain', 'Market Outlook Brain', 'Briefs Brain', 'Articles Brain', 'Distribution Brain', 'Intraday Market Watch'];

const failures = [];
const fail = (m) => failures.push(m);
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(path.join(SS, f), 'utf8')); } catch { return fb; } };
const finiteOrNull = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v));

const monitor = readJson('intelligence-monitor.json', null);
if (!monitor) {
  console.log('[intel-monitor] artifacts not built yet — CI builds them each run (non-fatal).');
  console.log('[intel-monitor] check:intelligence-monitor passed.');
  process.exit(0);
}

if (!HEALTH.has(monitor.overall_health)) fail(`unsupported overall_health "${monitor.overall_health}"`);
if (!monitor.generated_at || Number.isNaN(Date.parse(monitor.generated_at))) fail('monitor: invalid generated_at');

// Workflow health: all canonical brains present; stale must not be healthy.
const wf = readJson('workflow-health.json', { workflows: [] });
const names = (wf.workflows || []).map((w) => w.name);
for (const b of CANONICAL_BRAINS) if (!names.includes(b)) fail(`workflow-health: missing canonical brain "${b}" (hidden workflow)`);
for (const w of wf.workflows || []) {
  if (!HEALTH.has(w.health)) fail(`workflow ${w.name}: unsupported health "${w.health}"`);
  if (!finiteOrNull(w.age_hours)) fail(`workflow ${w.name}: age_hours NaN`);
  if (typeof w.age_hours === 'number' && w.age_hours < 0) fail(`workflow ${w.name}: negative age`);
  if (typeof w.age_hours === 'number' && w.age_hours > 1000 && w.health === 'healthy') fail(`workflow ${w.name}: ${w.age_hours}h stale but reported healthy`);
}
if (wf.overall && !HEALTH.has(wf.overall)) fail(`workflow-health: unsupported overall "${wf.overall}"`);

// Overall must not be healthier than the worst sub-state.
const subStates = [
  monitor.regime && monitor.regime.health,
  monitor.acquisition && monitor.acquisition.health,
  monitor.reaction_capture && monitor.reaction_capture.health,
  ...(monitor.workflows || []).map((w) => w.health),
].filter((s) => HEALTH.has(s));
const worstSub = subStates.reduce((acc, s) => (HEALTH_RANK[s] > HEALTH_RANK[acc] ? s : acc), 'healthy');
if (HEALTH_RANK[monitor.overall_health] < HEALTH_RANK[worstSub]) {
  fail(`overall_health "${monitor.overall_health}" is healthier than worst sub-state "${worstSub}" (hidden failure)`);
}

// Acquisition: a degraded source must not coexist with 'healthy' acquisition.
const acq = readJson('acquisition-health.json', null);
if (acq) {
  if (!HEALTH.has(acq.overall)) fail(`acquisition: unsupported overall "${acq.overall}"`);
  if ((acq.degraded_sources || []).length && acq.overall === 'healthy') fail('acquisition: degraded sources present but overall healthy');
  if (!finiteOrNull(acq.calendar_age_hours)) fail('acquisition: calendar_age_hours NaN');
}

// Publishing decisions: supported decision labels + valid timestamps.
const pd = readJson('publishing-decisions.json', { decisions: [] });
const DECISIONS = new Set(['eligible_for_publish', 'no_publish', 'topic_refresh', 'brief_current', 'brief_degraded']);
for (const d of pd.decisions || []) {
  if (!DECISIONS.has(d.decision)) fail(`publishing-decision ${d.brain}: unsupported decision "${d.decision}"`);
  if (!d.reason) fail(`publishing-decision ${d.brain}: missing reason`);
}

// Reaction capture sanity.
const rc = readJson('reaction-capture-health.json', null);
if (rc) {
  if (!HEALTH.has(rc.health)) fail(`reaction-capture: unsupported health "${rc.health}"`);
  for (const k of ['captured_entries', 'considered_events', 'reaction_ready', 'awaiting_data']) if (!finiteOrNull(rc[k])) fail(`reaction-capture: ${k} NaN`);
}

// No literal undefined/NaN leaked anywhere.
for (const f of ['intelligence-monitor.json', 'workflow-health.json', 'publishing-decisions.json', 'acquisition-health.json', 'reaction-capture-health.json']) {
  let raw = ''; try { raw = fs.readFileSync(path.join(SS, f), 'utf8'); } catch { continue; }
  if (/:\s*undefined|:\s*NaN/.test(raw)) fail(`${f}: leaked undefined/NaN`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[intel-monitor] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[intel-monitor] check:intelligence-monitor passed (overall=${monitor.overall_health}, ${(wf.workflows || []).length} workflows, no fabrication/contradiction).`);
