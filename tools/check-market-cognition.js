'use strict';

// Phase 74 validation — market cognition integrity.
// Guards the cognitive layer the same way check:newsroom-intelligence guards
// the pulse: vocabulary enforcement, transition integrity, alert realism
// (alerts must rest on verified derivation evidence), causal coherence
// (observed links must carry sourced numbers), regime continuity (session
// history and timeline stay chronological and deduplicated), and cross-asset
// consistency between cognition and the pulse it derives from.
// Files not built yet pass with a note (CI builds them each run).

const fs = require('fs');
const path = require('path');
const { DIMENSIONS, ALERT_TYPES, ALERT_SEVERITIES, CAUSAL_EDGES } = require('./build-market-cognition');

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

const PHASES = ['emerging', 'strengthening', 'established', 'extended', 'baseline', 'unverified'];
const STATE_VOCAB = {
  volatility_regime: ['compressed', 'normal', 'elevated', 'stressed', 'unverified'],
  dollar_pressure: ['firming', 'easing', 'stable', 'rising', 'falling', 'sideways', 'unverified'],
  duration_pressure: ['building', 'relaxing', 'neutral', 'unverified'],
  momentum_concentration: ['narrow-megacap', 'broadening', 'balanced', 'unverified'],
  breadth_state: ['deteriorating', 'confirming', 'mixed', 'unverified'],
  market_fragility: ['elevated', 'building', 'contained', 'unverified'],
};
const LINK_STATES = ['confirming', 'diverging', 'neutral', 'unobserved'];
const EDGE_IDS = new Set(CAUSAL_EDGES.map((e) => e.id));

const cognition = readJson('data/intelligence/market-cognition.json');
const history = readJson('data/intelligence/session-history.json');
const timeline = readJson('data/intelligence/market-timeline.json');
const pulse = readJson('data/intelligence/market-pulse.json');

// ── Session history: regime continuity ───────────────────────────────────────
if (history) {
  const sessions = history.sessions || [];
  const dates = sessions.map((s) => s.date);
  if (new Set(dates).size !== dates.length) failures.push('session-history: duplicate session dates');
  const sorted = [...dates].sort();
  if (JSON.stringify(sorted) !== JSON.stringify(dates)) failures.push('session-history: sessions not chronological');
  if (sessions.length > 40) failures.push(`session-history: ${sessions.length} sessions exceeds cap of 40`);
  for (const s of sessions) {
    if (typeof s.verified !== 'boolean') failures.push(`session-history: ${s.date} missing verified flag`);
    for (const [dim, allowed] of Object.entries(STATE_VOCAB)) {
      const value = s.dims && s.dims[dim];
      if (value && !allowed.includes(value)) failures.push(`session-history: ${s.date} ${dim}="${value}" outside vocabulary`);
    }
  }
  console.log(`[cognition-check] session-history ok (sessions=${sessions.length})`);
} else {
  console.log('[cognition-check] session-history not built yet — CI builds it each run (non-fatal)');
}

// ── Timeline: transition integrity ───────────────────────────────────────────
if (timeline) {
  const events = timeline.events || [];
  const eventDates = events.map((e) => e.date);
  if (JSON.stringify([...eventDates].sort()) !== JSON.stringify(eventDates)) failures.push('timeline: events not chronological');
  if (events.length > 60) failures.push(`timeline: ${events.length} events exceeds cap of 60`);
  const seen = new Set();
  for (const e of events) {
    if (!e.date || !e.dimension || !e.from || !e.to) failures.push(`timeline: malformed event ${JSON.stringify(e).slice(0, 80)}`);
    if (e.from === e.to) failures.push(`timeline: non-transition recorded (${e.dimension} ${e.from} -> ${e.to})`);
    if (e.from === 'unverified' || e.to === 'unverified') failures.push(`timeline: unverified state in transition (${e.dimension} ${e.date})`);
    if (e.dimension && !DIMENSIONS.includes(e.dimension)) failures.push(`timeline: unknown dimension ${e.dimension}`);
    const key = `${e.date}:${e.dimension}`;
    if (seen.has(key)) failures.push(`timeline: duplicate transition for ${key}`);
    seen.add(key);
  }
  console.log(`[cognition-check] timeline ok (events=${events.length})`);
} else {
  console.log('[cognition-check] timeline not built yet — CI builds it each run (non-fatal)');
}

// ── Cognition artifact ───────────────────────────────────────────────────────
if (cognition) {
  if (typeof cognition.verified !== 'boolean') failures.push('cognition: missing verified flag');
  if (!Array.isArray(cognition.regime_shifts)) failures.push('cognition: regime_shifts missing');

  for (const shift of cognition.regime_shifts || []) {
    if (!DIMENSIONS.includes(shift.dimension)) failures.push(`cognition: unknown shift dimension ${shift.dimension}`);
    if (!PHASES.includes(shift.phase)) failures.push(`cognition: phase "${shift.phase}" outside vocabulary`);
    if (shift.phase === 'unverified' && shift.sessions_in_state !== 0) failures.push(`cognition: unverified ${shift.dimension} carries a streak`);
    if (shift.phase === 'emerging' && !shift.from) failures.push(`cognition: emerging ${shift.dimension} missing "from" state`);
    if (shift.from && shift.from.state === shift.state) failures.push(`cognition: ${shift.dimension} transition to identical state`);
  }

  // Alert realism: typed, severity-bounded, evidence-backed, suppressed when unverified.
  const alerts = cognition.alerts || [];
  if (cognition.verified === false && alerts.length) failures.push('cognition: alerts emitted without verified inputs');
  for (const a of alerts) {
    if (!ALERT_TYPES.includes(a.type)) failures.push(`cognition: alert type "${a.type}" outside vocabulary`);
    if (!ALERT_SEVERITIES.includes(a.severity)) failures.push(`cognition: alert severity "${a.severity}" outside vocabulary`);
    if (!Array.isArray(a.derived_from) || !a.derived_from.length) failures.push(`cognition: alert ${a.type} missing derivation evidence`);
    for (const d of a.derived_from || []) {
      if (d.from === 'unverified' || d.to === 'unverified' || d.state === 'unverified') failures.push(`cognition: alert ${a.type} derived from unverified state`);
    }
    if (!a.headline_en || !a.headline_ar) failures.push(`cognition: alert ${a.type} missing bilingual headlines`);
    if (a.headline_ar && !/[؀-ۿ]/.test(a.headline_ar)) failures.push(`cognition: alert ${a.type} Arabic headline contains no Arabic`);
    if (/buy|sell|long|short|target price|اشترِ|بِع/i.test(String(a.headline_en))) failures.push(`cognition: alert ${a.type} reads like a trading signal`);
  }

  // Causal coherence: observed links need sourced two-leg evidence.
  for (const link of cognition.causal_links || []) {
    if (!EDGE_IDS.has(link.id)) failures.push(`cognition: unknown causal edge ${link.id}`);
    if (!LINK_STATES.includes(link.state)) failures.push(`cognition: causal state "${link.state}" outside vocabulary`);
    if (['confirming', 'diverging', 'neutral'].includes(link.state)) {
      const values = Object.values(link.evidence || {});
      if (values.length !== 2 || !values.every((v) => Number.isFinite(v))) {
        failures.push(`cognition: causal link ${link.id} state=${link.state} lacks two sourced legs`);
      }
    }
    if (link.state === 'unobserved' && link.evidence) failures.push(`cognition: unobserved link ${link.id} carries evidence`);
  }

  // Memory observations: verified-only, bilingual, streak-backed.
  if (cognition.verified === false && (cognition.memory_observations || []).length) {
    failures.push('cognition: memory observations emitted without verified inputs');
  }
  for (const o of cognition.memory_observations || []) {
    if (!o.en || !o.ar || !/[؀-ۿ]/.test(o.ar)) failures.push(`cognition: observation missing bilingual text (${o.kind}/${o.dimension || o.flag})`);
    if (o.kind === 'streak' && (!Number.isFinite(o.sessions) || o.sessions < 2)) failures.push('cognition: streak observation without a >=2 session streak');
  }

  // Cross-asset consistency: cognition shifts must mirror the pulse dimensions.
  if (pulse && pulse.dimensions && cognition.run_date === new Date(pulse.updated_at || 0).toISOString().slice(0, 10)) {
    for (const shift of cognition.regime_shifts || []) {
      const pulseValue = pulse.dimensions[shift.dimension];
      if (pulseValue && shift.state !== pulseValue) {
        failures.push(`cognition: ${shift.dimension} state "${shift.state}" disagrees with pulse "${pulseValue}" — one market brain violated`);
      }
    }
  }

  // Regime continuity: latest history session must match cognition run.
  if (history && (history.sessions || []).length) {
    const last = history.sessions[history.sessions.length - 1];
    if (cognition.run_date && last.date !== cognition.run_date) failures.push(`cognition: run_date ${cognition.run_date} does not match latest session ${last.date}`);
  }

  console.log(`[cognition-check] cognition ok (verified=${cognition.verified}, alerts=${alerts.length}, observations=${(cognition.memory_observations || []).length})`);
} else {
  console.log('[cognition-check] market-cognition not built yet — CI builds it each run (non-fatal)');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[cognition-check] FAIL: ${f}`));
  process.exit(1);
}
console.log('[cognition-check] check:market-cognition passed.');
