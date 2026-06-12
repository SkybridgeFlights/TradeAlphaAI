'use strict';

const assert = require('assert');
const { buildEditorialMemory, LIFECYCLE_STATES } = require('./build-editorial-market-memory');

function input(date, dims = {}, convergence = {}) {
  return {
    now: new Date(`${date}T18:00:00.000Z`),
    pulse: { verified: true, dimensions: dims },
    cognition: { verified: true, run_date: date },
    macro: { verified: true, run_date: date },
    convergence: {
      verified: true,
      run_date: date,
      coherence: { band: 'mixed' },
      diverges: [],
      confirms: [],
      underpriced: [],
      ...convergence,
    },
    reactions: { event_reactions: [] },
  };
}

const narrow = {
  momentum_concentration: 'narrow-megacap',
  breadth_state: 'deteriorating',
  volatility_regime: 'compressed',
  risk_state: 'risk_on',
};

console.log('[editorial-memory-test] lifecycle persistence');
const day1 = buildEditorialMemory(input('2026-06-08', narrow), {});
const day1Repeat = buildEditorialMemory(input('2026-06-08', narrow), day1);
const day2 = buildEditorialMemory(input('2026-06-09', narrow), day1Repeat);
const day3 = buildEditorialMemory(input('2026-06-10', narrow), day2);
const day4 = buildEditorialMemory(input('2026-06-11', narrow), day3);
assert.equal(day1.narratives.find((item) => item.id === 'narrow-leadership').state, 'emerging');
assert.equal(day1Repeat.narratives.find((item) => item.id === 'narrow-leadership').sessions, 1);
assert.equal(day2.narratives.find((item) => item.id === 'narrow-leadership').state, 'strengthening');
assert.equal(day3.narratives.find((item) => item.id === 'narrow-leadership').state, 'dominant');
assert.equal(day4.narratives.find((item) => item.id === 'narrow-leadership').state, 'crowded');
console.log('  PASS date-idempotent emerging -> strengthening -> dominant -> crowded');

console.log('[editorial-memory-test] failed expectation discipline');
const failed = day2.failed_expectations.find((item) => item.id === 'narrow-leadership:breadth-broadening');
assert(failed);
assert.equal(failed.observed_value, 'deteriorating');
assert(day2.timeline.some((item) => item.kind === 'failed'));
console.log('  PASS failed confirmation requires a subsequent verified session');

console.log('[editorial-memory-test] invalidation');
const invalidated = buildEditorialMemory(input('2026-06-12', {
  momentum_concentration: 'broadening',
  breadth_state: 'confirming',
  volatility_regime: 'elevated',
  risk_state: 'neutral',
}), day4);
assert.equal(invalidated.narratives.find((item) => item.id === 'narrow-leadership').state, 'invalidated');
assert(invalidated.timeline.some((item) => item.kind === 'repriced'));
console.log('  PASS explicit contrary state invalidates and records repricing');

console.log('[editorial-memory-test] weakening and fading');
const dollar1 = buildEditorialMemory(input('2026-06-08', { dollar_pressure: 'firming' }), {});
const dollar2 = buildEditorialMemory(input('2026-06-09', { dollar_pressure: 'firming' }), dollar1);
const dollarWeak = buildEditorialMemory(input('2026-06-10', { dollar_pressure: 'stable' }), dollar2);
const dollarFade = buildEditorialMemory(input('2026-06-11', { dollar_pressure: 'stable' }), dollarWeak);
assert.equal(dollarWeak.narratives.find((item) => item.id === 'dollar-strength').state, 'weakening');
assert.equal(dollarFade.narratives.find((item) => item.id === 'dollar-strength').state, 'fading');
console.log('  PASS absent confirmation moves through weakening and fading');

console.log('[editorial-memory-test] unresolved and ignored tension');
const conflict1 = buildEditorialMemory(input('2026-06-08', { risk_state: 'risk_on' }, {
  coherence: { band: 'conflicted' },
  diverges: [{ id: 'dollar-gold' }],
  underpriced: [{ kind: 'divergence', id: 'dollar-gold', en: 'Gold/dollar divergence remains underpriced.', ar: 'لا يزال تباعد الذهب والدولار دون تسعير كامل.' }],
}), {});
const conflict2 = buildEditorialMemory(input('2026-06-09', { risk_state: 'risk_on' }, {
  coherence: { band: 'conflicted' },
  diverges: [{ id: 'dollar-gold' }],
  underpriced: [{ kind: 'divergence', id: 'dollar-gold', en: 'Gold/dollar divergence remains underpriced.', ar: 'لا يزال تباعد الذهب والدولار دون تسعير كامل.' }],
}), conflict1);
assert.equal(conflict2.narratives.find((item) => item.id === 'gold-resilience').state, 'unresolved');
assert.equal(conflict2.underpriced_memory[0].status, 'ignored-by-price');
assert(conflict2.timeline.some((item) => item.kind === 'ignored'));
console.log('  PASS persistent divergence becomes unresolved and records ignored warning');

console.log('[editorial-memory-test] unverified honesty');
const held = buildEditorialMemory({
  now: new Date('2026-06-13T18:00:00.000Z'),
  pulse: { verified: false },
  cognition: { verified: false, run_date: '2026-06-13' },
  macro: { verified: false, run_date: '2026-06-13' },
  convergence: { verified: false, run_date: '2026-06-13' },
}, conflict2);
assert.equal(held.status, 'holding_unverified');
assert.equal(held.continuity_available, false);
assert.equal(held.current_focus.length, 0);
assert.equal(held.failed_expectations.length, 0);
assert.equal(held.timeline.length, conflict2.timeline.length);
console.log('  PASS degraded run holds history without extending claims');

assert(day4.narratives.every((item) => LIFECYCLE_STATES.includes(item.state)));
assert(day4.current_focus.every((item) => item.en && /[\u0600-\u06ff]/.test(item.ar)));
console.log('[editorial-memory-test] all tests passed');
