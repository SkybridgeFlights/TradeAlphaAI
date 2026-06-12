'use strict';

// Phase 74 — Market cognition logic tests (synthetic sessions, no file writes).
// Verifies regime shift phases, streak memory, divergence persistence, causal
// link assessment, alert derivation, and the unverified-suppression rules.

const {
  detectRegimeShifts, buildMemoryObservations, assessCausalNetwork, buildSignals, buildAlerts,
} = require('./build-market-cognition');

let failures = 0;
function assert(name, condition) {
  if (condition) { console.log(`  PASS ${name}`); } else { failures += 1; console.error(`  FAIL ${name}`); }
}

function session(date, dims, moves = {}, divergences = [], verified = true) {
  const base = {
    risk_state: 'neutral', volatility_regime: 'normal', dollar_pressure: 'stable',
    duration_pressure: 'neutral', momentum_concentration: 'balanced',
    ai_concentration_risk: 'contained', breadth_state: 'mixed',
    defensive_rotation: 'dormant', liquidity_stress: 'supportive',
    speculative_appetite: 'unverified', market_fragility: 'contained',
  };
  return { date, verified, dims: { ...base, ...dims }, sourced_moves: moves, divergences };
}

console.log('[test] regime shift phases');
{
  const sessions = [
    session('2026-06-08', { breadth_state: 'confirming' }),
    session('2026-06-09', { breadth_state: 'deteriorating' }),
    session('2026-06-10', { breadth_state: 'deteriorating' }),
    session('2026-06-11', { breadth_state: 'deteriorating' }),
  ];
  const shifts = detectRegimeShifts(sessions);
  const breadth = shifts.find((s) => s.dimension === 'breadth_state');
  assert('streak counted', breadth.sessions_in_state === 3);
  assert('phase established', breadth.phase === 'established');
  assert('from recorded', breadth.from && breadth.from.state === 'confirming');

  const emerging = detectRegimeShifts([
    session('2026-06-10', { volatility_regime: 'compressed' }),
    session('2026-06-11', { volatility_regime: 'elevated' }),
  ]).find((s) => s.dimension === 'volatility_regime');
  assert('emerging on fresh transition', emerging.phase === 'emerging' && emerging.from.state === 'compressed');

  const unv = detectRegimeShifts([session('2026-06-11', { volatility_regime: 'unverified' })])
    .find((s) => s.dimension === 'volatility_regime');
  assert('unverified stays unverified', unv.phase === 'unverified' && unv.sessions_in_state === 0);

  // An unverified middle session must break the streak (missing data never extends a claim).
  const broken = detectRegimeShifts([
    session('2026-06-09', { breadth_state: 'deteriorating' }),
    session('2026-06-10', { breadth_state: 'unverified' }),
    session('2026-06-11', { breadth_state: 'deteriorating' }),
  ]).find((s) => s.dimension === 'breadth_state');
  assert('unverified session breaks streak', broken.sessions_in_state === 1);
}

console.log('[test] cross-session memory observations');
{
  const sessions = [
    session('2026-06-09', { breadth_state: 'deteriorating', volatility_regime: 'compressed' }, {}, ['gold-vs-dollar']),
    session('2026-06-10', { breadth_state: 'deteriorating', volatility_regime: 'compressed' }, {}, ['gold-vs-dollar']),
    session('2026-06-11', { breadth_state: 'deteriorating', volatility_regime: 'compressed' }, {}, ['gold-vs-dollar']),
  ];
  const shifts = detectRegimeShifts(sessions);
  const obs = buildMemoryObservations(sessions, shifts);
  assert('breadth streak observation present', obs.some((o) => o.kind === 'streak' && o.dimension === 'breadth_state' && o.en.includes('Third consecutive')));
  assert('compression observation present', obs.some((o) => o.dimension === 'volatility_regime' && o.en.includes('stored instability')));
  assert('divergence persistence tracked', obs.some((o) => o.kind === 'divergence' && o.sessions === 3));
  assert('observations bilingual', obs.every((o) => o.en && o.ar && /[؀-ۿ]/.test(o.ar)));

  const unverifiedObs = buildMemoryObservations(
    [session('2026-06-11', { breadth_state: 'deteriorating' }, {}, [], false)],
    detectRegimeShifts([session('2026-06-11', { breadth_state: 'deteriorating' }, {}, [], false)])
  );
  assert('no observations without verified pulse', unverifiedObs.length === 0);
}

console.log('[test] causal network assessment');
{
  const links = assessCausalNetwork(session('2026-06-11', {}, {
    us10y: 1.2, qqq: -0.8, dxy: 0.5, gold: 0.6, vix: null, spy: 0.3, iwm: 0.4, nvda: 3.0, btc: 0.02, tlt: -0.7,
  }));
  const byId = Object.fromEntries(links.map((l) => [l.id, l]));
  assert('inverse link confirming (yields vs growth)', byId['yields-growth'].state === 'confirming');
  assert('inverse link diverging (dollar vs gold up together)', byId['dollar-gold'].state === 'diverging');
  assert('missing leg unobserved', byId['vix-equities'].state === 'unobserved' && byId['vix-equities'].evidence === null);
  assert('flat leg neutral', byId['liquidity-beta'].state === 'neutral');
  assert('direct link confirming (yields vs bonds inverse)', byId['yields-bonds'].state === 'confirming');
  assert('evidence carried on observed links', byId['dollar-gold'].evidence.dxy === 0.5 && byId['dollar-gold'].evidence.gold === 0.6);
}

console.log('[test] cognition signals');
{
  const snap = session('2026-06-11', {
    breadth_state: 'deteriorating', market_fragility: 'building',
    momentum_concentration: 'narrow-megacap', liquidity_stress: 'tightening',
    dollar_pressure: 'firming', speculative_appetite: 'expanding',
  }, { dxy: 0.6, btc: -2.1, nvda: 3.1 });
  const sessions = [snap, snap, snap, snap, snap].map((s, i) => ({ ...s, date: `2026-06-0${i + 5}` }));
  const shifts = detectRegimeShifts(sessions);
  const signals = buildSignals(shifts, assessCausalNetwork(snap), snap);
  assert('contradiction from breadth', signals.contradiction.some((s) => s.source === 'breadth_state'));
  assert('fragility signal present', signals.fragility.some((s) => s.source === 'market_fragility'));
  assert('exhaustion on extended narrow leadership', signals.exhaustion.some((s) => s.source === 'momentum_concentration'));
  assert('liquidity combo signal with evidence', signals.liquidity.some((s) => s.source === 'dollar+crypto' && s.evidence));
  assert('speculative signal from sourced move', signals.speculative.some((s) => s.source === 'nvda_move'));
  assert('signal lists capped at 3', Object.values(signals).every((list) => list.length <= 3));
}

console.log('[test] alert layer');
{
  const sessions = [
    session('2026-06-09', { volatility_regime: 'compressed', breadth_state: 'deteriorating' }),
    session('2026-06-10', { volatility_regime: 'compressed', breadth_state: 'deteriorating' }),
    session('2026-06-11', { volatility_regime: 'stressed', breadth_state: 'deteriorating', market_fragility: 'elevated' }),
  ];
  const shifts = detectRegimeShifts(sessions);
  const alerts = buildAlerts(shifts, [], true);
  assert('volatility expansion alert (high)', alerts.some((a) => a.type === 'volatility-expansion' && a.severity === 'high'));
  assert('breadth deterioration alert', alerts.some((a) => a.type === 'breadth-deterioration'));
  assert('every alert carries derivation evidence', alerts.every((a) => Array.isArray(a.derived_from) && a.derived_from.length > 0));
  assert('alerts bilingual', alerts.every((a) => a.headline_en && /[؀-ۿ]/.test(a.headline_ar)));
  assert('high severity sorted first', alerts[0].severity === 'high');

  assert('no alerts when unverified', buildAlerts(shifts, [], false).length === 0);

  // A stable picture must not produce alerts.
  const quiet = detectRegimeShifts([session('2026-06-10', {}), session('2026-06-11', {})]);
  assert('stable regime produces no alerts', buildAlerts(quiet, [], true).length === 0);
}

if (failures) {
  console.error(`[test] ${failures} failure(s).`);
  process.exit(1);
}
console.log('[test] all market-cognition logic tests passed.');
