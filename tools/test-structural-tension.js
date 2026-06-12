'use strict';

const assert = require('assert');
const { buildStructuralTension, REGIME_CONDITIONS, TENSION_LEVELS } = require('./build-structural-tension');

function verified(date, options = {}) {
  const dims = options.dims || {};
  return {
    now: new Date(`${date}T12:00:00.000Z`),
    pulse: { verified: true, dimensions: dims },
    cognition: { verified: true, run_date: date },
    macro: {
      verified: true,
      run_date: date,
      contradictions: options.contradictions || [],
      pressure: { tracks: options.pressure || {} },
    },
    convergence: {
      verified: true,
      run_date: date,
      coherence: options.coherence || { score: 80, band: 'coherent' },
      diverges: options.diverges || [],
      preparing_for: options.catalysts || [],
    },
    memory: {
      verified: true,
      run_date: date,
      narratives: options.narratives || [],
      failed_expectations: options.failed || [],
    },
  };
}

console.log('[structural-tension-test] stable regime');
const stable = buildStructuralTension(verified('2026-06-08', {
  dims: { breadth_state: 'confirming', momentum_concentration: 'broadening', volatility_regime: 'normal', liquidity_stress: 'supportive', risk_state: 'risk_on' },
}), {});
assert.equal(stable.regime_condition, 'stable-regime');
assert.equal(stable.tension_level, 'contained');
console.log('  PASS coherent broad participation stays stable');

const stressedInput = (date) => verified(date, {
  dims: {
    breadth_state: 'deteriorating',
    momentum_concentration: 'narrow-megacap',
    volatility_regime: 'compressed',
    liquidity_stress: 'tightening',
    defensive_rotation: 'active',
    risk_state: 'risk_on',
  },
  pressure: {
    volatility_pressure: { score: 4 },
    concentration_pressure: { score: 4 },
    liquidity_pressure: { score: 3 },
  },
  contradictions: [
    { id: 'index-vs-breadth', active_today: true, escalated: true },
    { id: 'calm-vs-fragility', active_today: true, escalated: false },
  ],
  coherence: { score: 32, band: 'conflicted' },
  diverges: [{ id: 'dollar-gold', chain_strength: 2 }],
  narratives: [
    { id: 'volatility-compression', active: true, sessions: 3, state: 'dominant' },
    { id: 'narrow-leadership', active: true, sessions: 4, state: 'crowded' },
  ],
  failed: [{ id: 'breadth-broadening', status: 'failed' }],
});

console.log('[structural-tension-test] persistence and conflict');
const tense1 = buildStructuralTension(stressedInput('2026-06-08'), {});
const tense1Repeat = buildStructuralTension(stressedInput('2026-06-08'), tense1);
const tense2 = buildStructuralTension(stressedInput('2026-06-09'), tense1Repeat);
assert.equal(tense1Repeat.tracks['participation-strain'].sessions, 1);
assert.equal(tense2.tracks['participation-strain'].sessions, 2);
assert.equal(tense2.regime_condition, 'internally-conflicted-regime');
assert(tense2.tension_score >= 50);
assert(tense2.strain_map.some((item) => item.state === 'persistent' || item.state === 'accumulating'));
console.log('  PASS date-idempotent persistence and conflicted classification');

console.log('[structural-tension-test] transition-forming is evidence-bounded');
const formingInput = stressedInput('2026-06-10');
formingInput.convergence.coherence = { score: 48, band: 'tense' };
const forming = buildStructuralTension(formingInput, tense2);
assert.equal(forming.regime_condition, 'transition-forming-regime');
assert(forming.active_strains.length >= 3);
assert(!/probability|will crash|likely breakout|expect rally/i.test(forming.summary_en));
console.log('  PASS transition pressure requires persistent multi-track evidence and remains non-predictive');

console.log('[structural-tension-test] resolution');
const resolving = buildStructuralTension(verified('2026-06-11', {
  dims: { breadth_state: 'confirming', momentum_concentration: 'broadening', volatility_regime: 'normal', liquidity_stress: 'supportive', risk_state: 'neutral' },
}), forming);
assert.equal(resolving.tracks['participation-strain'].state, 'resolving');
assert(resolving.tension_score < forming.tension_score);
assert.equal(resolving.pressure_memory.at(-1).change, 'faded');
console.log('  PASS resolved evidence lowers current tension without erasing pressure memory');

console.log('[structural-tension-test] resolved track restart');
const restarted = buildStructuralTension(verified('2026-06-12', {
  dims: { breadth_state: 'deteriorating', momentum_concentration: 'balanced', volatility_regime: 'normal', liquidity_stress: 'supportive', risk_state: 'neutral' },
}), resolving);
assert.equal(restarted.tracks['participation-strain'].sessions, 1);
assert.equal(restarted.tracks['participation-strain'].state, 'emerging');
console.log('  PASS reactivated pressure starts a new persistence run');

console.log('[structural-tension-test] catalyst fragility');
const catalyst = buildStructuralTension({
  ...formingInput,
  now: new Date('2026-06-10T12:00:00.000Z'),
  convergence: {
    ...formingInput.convergence,
    preparing_for: [{ name: 'CPI', time: '2026-06-11T12:00:00.000Z' }],
  },
}, tense2);
assert.equal(catalyst.catalyst_fragility.level, 'elevated');
assert.equal(catalyst.catalyst_fragility.next.hours, 24);
console.log('  PASS nearby catalyst sensitivity rises only with existing structural strain');

console.log('[structural-tension-test] unverified honesty');
const held = buildStructuralTension({
  now: new Date('2026-06-12T12:00:00.000Z'),
  pulse: { verified: false },
  cognition: { verified: false, run_date: '2026-06-12' },
  macro: { verified: false, run_date: '2026-06-12' },
  convergence: { verified: false, run_date: '2026-06-12' },
  memory: { verified: false, run_date: '2026-06-12' },
}, restarted);
assert.equal(held.status, 'holding_unverified');
assert.equal(held.tension_score, null);
assert.equal(held.active_strains.length, 0);
assert.equal(held.pressure_memory.length, restarted.pressure_memory.length);
console.log('  PASS degraded state holds history without asserting current tension');

assert(REGIME_CONDITIONS.includes(forming.regime_condition));
assert(TENSION_LEVELS.includes(forming.tension_level));
console.log('[structural-tension-test] all tests passed');
