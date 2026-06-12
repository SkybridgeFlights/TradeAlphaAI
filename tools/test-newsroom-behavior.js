'use strict';

// Phase 82 synthetic tests. Pure logic only; no artifact or homepage writes.

const { deriveNewsroomBehavior, BEHAVIOR_MODES } = require('./render-newsroom-modules');

let failures = 0;
function assert(name, condition) {
  if (condition) console.log(`  PASS ${name}`);
  else { failures += 1; console.error(`  FAIL ${name}`); }
}

const now = new Date('2026-06-12T12:00:00.000Z');
const base = {
  verified: true,
  dimensions: {},
  cognition: { alerts: [] },
  macro: { contradictions: [], pressure: { tracks: {} } },
  convergence: { coherence: { band: 'coherent' }, diverges: [] },
  catalysts: [],
  session: 'us-cash',
  now,
};

console.log('[behavior] unverified honesty');
{
  const result = deriveNewsroomBehavior({ ...base, verified: false });
  assert('unverified always calm', result.behavioral_mode === 'calm-monitoring');
  assert('unverified cannot escalate stress', result.stress_level === 0 && result.editorial_intensity === 'quiet');
  assert('unverified uses open pacing', result.pacing_density === 'open');
}

console.log('[behavior] elevated volatility');
{
  const result = deriveNewsroomBehavior({
    ...base,
    dimensions: { volatility_regime: 'stressed', liquidity_stress: 'tightening' },
    cognition: { alerts: [{ severity: 'high' }] },
  });
  assert('stress mode selected', result.behavioral_mode === 'elevated-volatility');
  assert('stress is elevated and compressed', result.editorial_intensity === 'elevated' && result.pacing_density === 'compressed');
  assert('risk leads bias', result.desk_priority_bias[0] === 'risk');

  const liquidity = deriveNewsroomBehavior({
    ...base,
    dimensions: { liquidity_stress: 'tightening' },
    catalysts: [{ name: 'CPI', time: '2026-06-12T18:00:00.000Z' }],
  });
  assert('verified liquidity stress overrides catalyst mode', liquidity.behavioral_mode === 'elevated-volatility');
  assert('liquidity stress compresses pacing', liquidity.pacing_density === 'compressed');
}

console.log('[behavior] catalyst mode');
{
  const result = deriveNewsroomBehavior({
    ...base,
    catalysts: [{ name: 'CPI', time: '2026-06-12T18:00:00.000Z' }],
  });
  assert('major catalyst selected', result.behavioral_mode === 'major-catalyst');
  assert('six-hour catalyst imminent', result.catalyst_focus === 'imminent');
  assert('catalyst desk leads bias', result.desk_priority_bias[0] === 'catalysts');
}

console.log('[behavior] cross-asset conflict');
{
  const result = deriveNewsroomBehavior({
    ...base,
    convergence: { coherence: { band: 'conflicted' }, diverges: [{ id: 'dollar-gold' }, { id: 'yields-growth' }] },
  });
  assert('conflict mode selected', result.behavioral_mode === 'cross-asset-conflict');
  assert('divergence focus elevated', result.divergence_focus === 'elevated');
  assert('cross-asset leads bias', result.desk_priority_bias[0] === 'crossasset');
}

console.log('[behavior] speculative and defensive modes');
{
  const speculative = deriveNewsroomBehavior({
    ...base,
    dimensions: { speculative_appetite: 'active', momentum_concentration: 'narrow-megacap' },
  });
  assert('speculative mode selected', speculative.behavioral_mode === 'speculative-momentum');
  assert('positioning leads speculative bias', speculative.desk_priority_bias[0] === 'positioning');

  const defensive = deriveNewsroomBehavior({
    ...base,
    dimensions: { defensive_rotation: 'active', risk_state: 'risk_off' },
  });
  assert('defensive mode selected', defensive.behavioral_mode === 'defensive-rotation');
  assert('risk leads defensive bias', defensive.desk_priority_bias[0] === 'risk');
}

console.log('[behavior] vocabulary integrity');
{
  const result = deriveNewsroomBehavior(base);
  assert('mode vocabulary valid', BEHAVIOR_MODES.includes(result.behavioral_mode));
  assert('stress bounded', Number.isInteger(result.stress_level) && result.stress_level >= 0 && result.stress_level <= 3);
  assert('session personality retained', result.session_personality === 'us-cash');
}

if (failures) {
  console.error(`[behavior] ${failures} test(s) failed.`);
  process.exit(1);
}
console.log('[behavior] all newsroom behavior tests passed.');
