'use strict';

// Phase 75 — Macro cognition logic tests (synthetic state, no file writes).
// Verifies conviction precedence, contradiction persistence/escalation,
// pressure accumulation/decay/freeze, structural fragility evolution,
// scenario realism (conditional language, no predictions), and the
// unverified-suppression rules.

const {
  detectContradictions, persistContradictions, accumulatePressure,
  classifyStructure, deriveConviction, buildScenarios, deriveDeskFocus,
} = require('./build-macro-cognition');

let failures = 0;
function assert(name, condition) {
  if (condition) { console.log(`  PASS ${name}`); } else { failures += 1; console.error(`  FAIL ${name}`); }
}

const BASE_DIMS = {
  risk_state: 'neutral', volatility_regime: 'normal', dollar_pressure: 'stable',
  duration_pressure: 'neutral', momentum_concentration: 'balanced',
  ai_concentration_risk: 'contained', breadth_state: 'mixed',
  defensive_rotation: 'dormant', liquidity_stress: 'supportive',
  speculative_appetite: 'unverified', market_fragility: 'contained',
};

function dims(overrides = {}) { return { ...BASE_DIMS, ...overrides }; }
function shiftsByDim(map = {}) {
  const out = {};
  for (const [k, v] of Object.entries(map)) out[k] = { dimension: k, state: v.state, sessions_in_state: v.n, phase: v.n >= 5 ? 'extended' : v.n >= 3 ? 'established' : v.n === 2 ? 'strengthening' : 'emerging' };
  return out;
}
function cognitionStub(links, shifts) {
  return { verified: true, causal_links: links, regime_shifts: Object.values(shifts) };
}
const NO_PRESSURE = accumulatePressure(dims(), {}, null, true);

console.log('[test] contradiction engine');
{
  const found = detectContradictions(
    dims({ breadth_state: 'deteriorating', duration_pressure: 'building', volatility_regime: 'compressed', market_fragility: 'building', ai_concentration_risk: 'elevated' }),
    { spy: 0.5, gold: 0.4, dxy: -0.5, us10y: 0.8, qqq: 0.6, iwm: -0.5 }
  );
  assert('detects index-vs-breadth', found.includes('index-vs-breadth'));
  assert('detects gold-vs-yields', found.includes('gold-vs-yields'));
  assert('detects dollar-vs-yields', found.includes('dollar-vs-yields'));
  assert('detects calm-vs-fragility', found.includes('calm-vs-fragility'));
  assert('detects leadership-vs-participation', found.includes('leadership-vs-participation'));
  assert('detects concentration-vs-breadth', found.includes('concentration-vs-breadth'));
  assert('quiet tape yields none', detectContradictions(dims(), { spy: 0.1 }).length === 0);

  // Persistence: new day increments; same day holds; unverified freezes.
  const day1 = persistContradictions(['index-vs-breadth'], null, true);
  assert('first session = 1, not escalated', day1[0].sessions === 1 && day1[0].escalated === false);
  const prev2 = { run_date: '2026-01-01', contradictions: [{ ...day1[0], sessions: 2 }] };
  const day3 = persistContradictions(['index-vs-breadth'], prev2, true);
  assert('third session escalates', day3[0].sessions === 3 && day3[0].escalated === true);
  const sameDay = persistContradictions(['index-vs-breadth'], { run_date: new Date().toISOString().slice(0, 10), contradictions: day3 }, true);
  assert('same-day rerun does not double-count', sameDay[0].sessions === 3);
  const frozen = persistContradictions([], prev2, false);
  assert('unverified session holds without extending', frozen.length === 1 && frozen[0].sessions === 2 && frozen[0].active_today === false);
  assert('contradictions bilingual', day1.every((c) => c.en && /[؀-ۿ]/.test(c.ar)));
}

console.log('[test] pressure accumulation engine');
{
  const d = dims({ volatility_regime: 'compressed', duration_pressure: 'building', defensive_rotation: 'active' });
  const p1 = accumulatePressure(d, {}, null, true);
  assert('accumulates on condition', p1.tracks.volatility_pressure.score === 1 && p1.tracks.volatility_pressure.state === 'accumulating');
  const prev = { run_date: '2026-01-01', pressure: { tracks: { ...p1.tracks, volatility_pressure: { ...p1.tracks.volatility_pressure, score: 3, base_score: 2 } } } };
  const p2 = accumulatePressure(d, {}, prev, true);
  assert('builds across sessions', p2.tracks.volatility_pressure.score === 4);
  assert('elevated track flagged', p2.elevated.includes('volatility_pressure'));
  const release = accumulatePressure(dims({ volatility_regime: 'stressed' }), {}, prev, true);
  assert('releases on regime break', release.tracks.volatility_pressure.score === 2 && release.tracks.volatility_pressure.state === 'releasing');
  const frozen = accumulatePressure({}, {}, prev, false);
  assert('unverified freezes score', frozen.tracks.volatility_pressure.score === 3 && frozen.tracks.volatility_pressure.state === 'steady');
  const sameDay = accumulatePressure(d, {}, { run_date: new Date().toISOString().slice(0, 10), pressure: { tracks: p2.tracks } }, true);
  assert('same-day rerun rebuilds from base', sameDay.tracks.volatility_pressure.score === 4);
  const cap = accumulatePressure(d, {}, { run_date: '2026-01-01', pressure: { tracks: { volatility_pressure: { score: 5, base_score: 5 } } } }, true);
  assert('score capped at 5', cap.tracks.volatility_pressure.score === 5);
}

console.log('[test] structural fragility model');
{
  const none = [];
  assert('unstable-calm needs persistence', classifyStructure(
    dims({ volatility_regime: 'compressed', market_fragility: 'building' }), {},
    shiftsByDim({ volatility_regime: { state: 'compressed', n: 3 } }), NO_PRESSURE, none
  ).class === 'unstable-calm');
  assert('fresh compression is NOT unstable-calm', classifyStructure(
    dims({ volatility_regime: 'compressed', market_fragility: 'building' }), {},
    shiftsByDim({ volatility_regime: { state: 'compressed', n: 1 } }), NO_PRESSURE, none
  ).class !== 'unstable-calm');
  assert('crowded-trade from persistent concentration', classifyStructure(
    dims({ momentum_concentration: 'narrow-megacap', ai_concentration_risk: 'elevated' }), {},
    shiftsByDim({ momentum_concentration: { state: 'narrow-megacap', n: 4 } }), NO_PRESSURE, none
  ).class === 'crowded-trade');
  assert('liquidity-vacuum priority', classifyStructure(
    dims({ liquidity_stress: 'tightening', volatility_regime: 'elevated' }), {},
    {}, NO_PRESSURE, none
  ).class === 'liquidity-vacuum');
  assert('squeeze-behavior from sourced co-moves', classifyStructure(
    dims({ breadth_state: 'deteriorating' }), { vix: -6.2, spy: 0.9 },
    {}, NO_PRESSURE, none
  ).class === 'squeeze-behavior');
  assert('defensive-undercurrent', classifyStructure(
    dims({ defensive_rotation: 'active' }), { spy: 0.1 }, {}, NO_PRESSURE, none
  ).class === 'defensive-undercurrent');
  assert('healthy-trend when clean', classifyStructure(
    dims({ breadth_state: 'confirming' }), { spy: 0.5 }, {}, NO_PRESSURE, none
  ).class === 'healthy-trend');
  assert('stable-structure fallback', classifyStructure(dims(), {}, {}, NO_PRESSURE, none).class === 'stable-structure');
  assert('fragility bilingual', /[؀-ۿ]/.test(classifyStructure(dims(), {}, {}, NO_PRESSURE, none).ar));
}

console.log('[test] conviction engine');
{
  const confirming = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}`, state: 'confirming' }));
  const diverging = (n) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, state: 'diverging' }));
  const manyShifts = shiftsByDim(Object.fromEntries(Object.keys(BASE_DIMS).map((k) => [k, { state: 'x', n: 3 }])));
  const stable = { class: 'stable-structure', en: '', ar: '' };

  const healthy = deriveConviction(
    cognitionStub(confirming(3), manyShifts), dims({ breadth_state: 'confirming' }), [], stable, NO_PRESSURE
  );
  assert('healthy-trend-structure', healthy.state === 'healthy-trend-structure');
  assert('regime confidence high with persistence', healthy.regime_confidence === 'high');

  const crowded = deriveConviction(
    cognitionStub(confirming(3), manyShifts),
    dims({ momentum_concentration: 'narrow-megacap', ai_concentration_risk: 'elevated', speculative_appetite: 'expanding' }),
    [], stable, NO_PRESSURE
  );
  assert('crowding overrides confirmations', crowded.state === 'crowded-positioning');

  const deteriorating = deriveConviction(
    cognitionStub(diverging(3), manyShifts), dims(), [], stable, NO_PRESSURE
  );
  assert('deteriorating-confirmation on contradiction load', deteriorating.state === 'deteriorating-confirmation');

  const escalatedContradiction = [{ id: 'index-vs-breadth', sessions: 3, escalated: true, active_today: true }];
  const escalated = deriveConviction(
    cognitionStub(confirming(4), manyShifts), dims({ breadth_state: 'confirming' }), escalatedContradiction, stable, NO_PRESSURE
  );
  assert('escalated contradiction forces deterioration', escalated.state === 'deteriorating-confirmation');

  const unconfirmed = deriveConviction(
    cognitionStub(confirming(1), manyShifts), dims(),
    [{ id: 'index-vs-breadth', sessions: 1, escalated: false, active_today: true }], stable, NO_PRESSURE
  );
  assert('unconfirmed-move on thin confirmation', unconfirmed.state === 'unconfirmed-move');

  const unstable = deriveConviction(
    cognitionStub(confirming(3), manyShifts), dims({ volatility_regime: 'compressed' }), [], stable,
    { ...NO_PRESSURE, tracks: { ...NO_PRESSURE.tracks, volatility_pressure: { score: 4, state: 'accumulating' } } }
  );
  assert('unstable-continuation on stored compression', unstable.state === 'unstable-continuation');

  const unverified = deriveConviction({ verified: false }, {}, [], stable, NO_PRESSURE);
  assert('unverified suppression', unverified.state === 'unverified' && /[؀-ۿ]/.test(unverified.ar));
}

console.log('[test] scenario engine');
{
  const stable = { class: 'stable-structure', en: 'Stable.', ar: 'بنية مستقرة — لا نمط يهيمن.' };
  const conviction = { state: 'fragile-conviction', en: 'x', ar: 'القناعة هشة — صورة متباينة.' };
  const catalysts = [{ name: 'FOMC Rate Decision' }];
  const scenarios = buildScenarios(
    dims({ volatility_regime: 'compressed' }), conviction, stable,
    { ...NO_PRESSURE, tracks: { ...NO_PRESSURE.tracks, volatility_pressure: { score: 4, state: 'accumulating' } }, elevated: ['volatility_pressure'] },
    [], catalysts, true
  );
  const byId = Object.fromEntries(scenarios.map((s) => [s.id, s]));
  assert('base case always primary', byId['base-case'].status === 'primary');
  assert('volatility expansion active on stored pressure', byId['volatility-expansion'].status === 'active');
  assert('invalidation path present', byId['invalidation-path'] && byId['invalidation-path'].status === 'monitor');
  assert('catalyst dependency names real catalyst', byId['catalyst-dependency'].catalyst === 'FOMC Rate Decision');
  assert('scenarios carry derivation', scenarios.every((s) => Array.isArray(s.derived_from) && s.derived_from.length));
  assert('scenarios bilingual', scenarios.every((s) => s.en && /[؀-ۿ]/.test(s.ar)));
  assert('no probability language', scenarios.every((s) => !/\b\d+\s*%|probability|likely to (rise|fall)|will (rise|fall|rally|crash)/i.test(s.en)));

  const unverifiedScenarios = buildScenarios({}, conviction, stable, NO_PRESSURE, [], catalysts, false);
  assert('unverified: monitoring base case only + catalyst', unverifiedScenarios.length === 2 && unverifiedScenarios[0].en.includes('Monitoring'));
}

console.log('[test] adaptive desk focus');
{
  const stable = { class: 'stable-structure' };
  const calm = { class: 'unstable-calm' };
  assert('monitoring when unverified', deriveDeskFocus({}, stable, NO_PRESSURE, [], false).focus === 'monitoring');
  assert('contradictions lead when escalated', deriveDeskFocus({ state: 'x' }, stable, NO_PRESSURE, [{ id: 'x' }], true).focus === 'contradictions');
  assert('risk leads on unstable calm', deriveDeskFocus({ state: 'x' }, calm, NO_PRESSURE, [], true).focus === 'risk');
  assert('concentration leads on crowding', deriveDeskFocus({ state: 'crowded-positioning' }, stable, NO_PRESSURE, [], true).focus === 'concentration');
  assert('balanced default', deriveDeskFocus({ state: 'fragile-conviction' }, stable, NO_PRESSURE, [], true).focus === 'balanced');
}

if (failures) {
  console.error(`[test] ${failures} failure(s).`);
  process.exit(1);
}
console.log('[test] all macro-cognition logic tests passed.');
