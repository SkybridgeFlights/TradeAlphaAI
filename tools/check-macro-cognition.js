'use strict';

// Phase 75 validation — macro cognition integrity.
// Guards the autonomous macro intelligence layer: conviction realism
// (vocabulary + verified-only claims), contradiction continuity (persistence
// counted only across verified sessions, escalation thresholds honored),
// pressure accumulation integrity (bounded scores, freeze-on-unverified),
// scenario consistency (vocabulary, derivation, conditional language — no
// probabilities or predictions), and adaptive desk-focus coherence.
// Files not built yet pass with a note (CI builds them each run).

const fs = require('fs');
const path = require('path');
const {
  CONVICTION_STATES, FRAGILITY_CLASSES, PRESSURE_TRACKS, PRESSURE_STATES,
  CONTRADICTION_IDS, SCENARIO_IDS, SCENARIO_STATUSES,
} = require('./build-macro-cognition');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    failures.push(`${rel}: parse error ${e.message}`);
    return null;
  }
}

const macro = readJson('data/intelligence/macro-cognition.json');
const cognition = readJson('data/intelligence/market-cognition.json');

if (macro) {
  if (typeof macro.verified !== 'boolean') failures.push('macro: missing verified flag');

  // ── Conviction realism ────────────────────────────────────────────────────
  const conviction = macro.conviction || {};
  if (!CONVICTION_STATES.includes(conviction.state)) failures.push(`macro: conviction state "${conviction.state}" outside vocabulary`);
  if (macro.verified === false && conviction.state !== 'unverified') failures.push('macro: conviction asserted without verified inputs');
  if (macro.verified === true && conviction.state === 'unverified') failures.push('macro: verified run produced unverified conviction');
  if (!['high', 'moderate', 'low', 'unverified'].includes(conviction.regime_confidence)) failures.push(`macro: regime_confidence "${conviction.regime_confidence}" outside vocabulary`);
  if (conviction.en === undefined || conviction.ar === undefined) failures.push('macro: conviction missing bilingual text');
  if (conviction.ar && !/[؀-ۿ]/.test(conviction.ar)) failures.push('macro: conviction Arabic text contains no Arabic');
  if (/will (rally|crash|rise|fall)|guaranteed|certain to/i.test(String(conviction.en))) failures.push('macro: conviction reads like a forecast');

  // ── Contradiction continuity ──────────────────────────────────────────────
  const ids = new Set();
  for (const c of macro.contradictions || []) {
    if (!CONTRADICTION_IDS.includes(c.id)) failures.push(`macro: contradiction id "${c.id}" outside vocabulary`);
    if (ids.has(c.id)) failures.push(`macro: duplicate contradiction ${c.id}`);
    ids.add(c.id);
    if (!Number.isFinite(c.sessions) || c.sessions < 1) failures.push(`macro: contradiction ${c.id} has invalid session count`);
    if (c.escalated !== (c.sessions >= 3)) failures.push(`macro: contradiction ${c.id} escalation does not match threshold (sessions=${c.sessions}, escalated=${c.escalated})`);
    if (typeof c.active_today !== 'boolean') failures.push(`macro: contradiction ${c.id} missing active_today`);
    if (macro.verified === false && c.active_today === true) failures.push(`macro: contradiction ${c.id} active without verified inputs`);
    if (!c.en || !c.ar || !/[؀-ۿ]/.test(c.ar)) failures.push(`macro: contradiction ${c.id} missing bilingual text`);
    if (c.first_seen && c.last_seen && String(c.first_seen) > String(c.last_seen)) failures.push(`macro: contradiction ${c.id} first_seen after last_seen`);
  }

  // ── Structural fragility ──────────────────────────────────────────────────
  const structure = macro.structure || {};
  if (!FRAGILITY_CLASSES.includes(structure.class)) failures.push(`macro: structure class "${structure.class}" outside vocabulary`);
  if (macro.verified === false && structure.class !== 'unverified') failures.push('macro: structure classified without verified inputs');

  // ── Pressure accumulation integrity ───────────────────────────────────────
  const tracks = (macro.pressure && macro.pressure.tracks) || {};
  for (const key of PRESSURE_TRACKS) {
    const track = tracks[key];
    if (!track) { failures.push(`macro: pressure track ${key} missing`); continue; }
    if (!Number.isFinite(track.score) || track.score < 0 || track.score > 5) failures.push(`macro: pressure ${key} score ${track.score} out of bounds`);
    if (!PRESSURE_STATES.includes(track.state)) failures.push(`macro: pressure ${key} state "${track.state}" outside vocabulary`);
    if (Number.isFinite(track.base_score) && Math.abs(track.score - track.base_score) > 1) failures.push(`macro: pressure ${key} moved more than one step in a single session`);
    if (macro.verified === false && Number.isFinite(track.base_score) && track.score !== track.base_score) failures.push(`macro: pressure ${key} accumulated without verified inputs`);
  }
  const elevated = (macro.pressure && macro.pressure.elevated) || [];
  for (const key of elevated) {
    if (!tracks[key] || tracks[key].score < 3) failures.push(`macro: ${key} flagged elevated below threshold`);
  }

  // ── Scenario consistency ──────────────────────────────────────────────────
  const scenarioIds = new Set();
  const scenarios = macro.scenarios || [];
  if (!scenarios.some((s) => s.id === 'base-case' && s.status === 'primary')) failures.push('macro: base-case primary scenario missing');
  for (const s of scenarios) {
    if (!SCENARIO_IDS.includes(s.id)) failures.push(`macro: scenario id "${s.id}" outside vocabulary`);
    if (scenarioIds.has(s.id)) failures.push(`macro: duplicate scenario ${s.id}`);
    scenarioIds.add(s.id);
    if (!SCENARIO_STATUSES.includes(s.status)) failures.push(`macro: scenario ${s.id} status "${s.status}" outside vocabulary`);
    if (!Array.isArray(s.derived_from) || !s.derived_from.length) failures.push(`macro: scenario ${s.id} missing derivation`);
    if (!s.en || !s.ar || !/[؀-ۿ]/.test(s.ar)) failures.push(`macro: scenario ${s.id} missing bilingual text`);
    if (/\b\d+(\.\d+)?\s*%\s*(chance|probability|odds)|probability|will (rally|crash|surge|plunge)/i.test(String(s.en))) {
      failures.push(`macro: scenario ${s.id} contains probability/prediction language`);
    }
    if (s.id === 'catalyst-dependency' && !s.catalyst) failures.push('macro: catalyst-dependency scenario without a named catalyst');
  }
  if (macro.verified === false) {
    const active = scenarios.filter((s) => s.status === 'active');
    if (active.length) failures.push('macro: active scenarios asserted without verified inputs');
  }

  // ── Adaptive desk-focus coherence ─────────────────────────────────────────
  const focus = macro.desk_focus || {};
  const FOCI = ['monitoring', 'contradictions', 'risk', 'concentration', 'pressure', 'macro', 'balanced'];
  if (!FOCI.includes(focus.focus)) failures.push(`macro: desk focus "${focus.focus}" outside vocabulary`);
  if (macro.verified === false && focus.focus !== 'monitoring') failures.push('macro: adaptive focus asserted without verified inputs');
  if (focus.focus === 'contradictions' && !(macro.contradictions || []).some((c) => c.escalated && c.active_today)) {
    failures.push('macro: contradiction focus without an escalated active contradiction');
  }
  if (!focus.reason_en || !focus.reason_ar) failures.push('macro: desk focus missing bilingual reason');

  // ── Cross-layer coherence with the cognition engine ───────────────────────
  if (cognition && macro.verified === true && cognition.verified !== true) {
    failures.push('macro: verified=true while cognition layer is unverified — one market brain violated');
  }

  console.log(`[macro-check] macro-cognition ok (verified=${macro.verified}, conviction=${conviction.state}, structure=${structure.class}, scenarios=${scenarios.length})`);
} else {
  console.log('[macro-check] macro-cognition not built yet — CI builds it each run (non-fatal)');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[macro-check] FAIL: ${f}`));
  process.exit(1);
}
console.log('[macro-check] check:macro-cognition passed.');
