'use strict';

// Phase 106 — Liquidity & Regime Intelligence engine (pure, deterministic).
//
// Reads the OBSERVED market dimensions (from live-market-state) and classifies
// the current STRUCTURAL environment — liquidity posture, regime, stability,
// cross-asset coherence, breadth — in which macro reactions occur. This is a
// context lens, NOT prediction and NOT a signal engine: no buy/sell, no targets,
// no retail TA. Every classification traces to observed dimensions; missing
// dimensions degrade to 'indeterminate' (never fabricated).

const REGIMES = [
  'healthy_risk_expansion', 'broad_risk_support', 'narrow_leadership',
  'crowded_growth_positioning', 'defensive_rotation', 'liquidity_stress',
  'unstable_rally', 'volatility_transition', 'yield_pressure_regime',
  'macro_fragility', 'indeterminate',
];
const LIQUIDITY = ['easing', 'tightening', 'yield_pressure', 'defensive_demand', 'volatility_absorption', 'volatility_rejection', 'neutral', 'indeterminate'];
const STABILITY = ['stable', 'fragile', 'deteriorating', 'unstable', 'strengthening', 'transition_state', 'indeterminate'];

const DEFENSIVE_SECTORS = ['XLU', 'XLP', 'XLRE', 'XLV'];
const CYCLICAL_SECTORS = ['XLK', 'XLY', 'XLF', 'XLI', 'XLE', 'XLC'];

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : null; }
function pct(field) { return field && typeof field === 'object' ? num(field.change_pct) : null; }
function val(field) { return field && typeof field === 'object' ? num(field.value) : null; }

// Normalize the live-market-state into the tracked dimension set.
function normalizeDimensions(state) {
  state = state || {};
  return {
    SPY: pct(state.sp500), QQQ: pct(state.nasdaq), IWM: pct(state.russell2000),
    VIX: val(state.vix), VIX_chg: pct(state.vix),
    US10Y: val(state.us10y_yield), US10Y_chg: pct(state.us10y_yield),
    US02Y: val(state.us2y_yield), US02Y_chg: pct(state.us2y_yield),
    yield_spread_bps: state.yield_spread_2y10y ? num(state.yield_spread_2y10y.spread_bps) : null,
    DXY: val(state.dxy), DXY_chg: pct(state.dxy),
    GOLD: pct(state.gold), OIL: pct(state.oil), TLT: pct(state.tlt),
    sector_leadership: Array.isArray(state.sector_leadership) ? state.sector_leadership : [],
  };
}

// ── Sub-states (each returns a label or 'indeterminate') ──────────────────────
function breadthState(d) {
  if (d.SPY === null || d.IWM === null) return 'indeterminate';
  if (d.SPY > 0.1) {
    if (d.IWM < d.SPY * 0.4) return 'narrow';
    if (d.IWM >= d.SPY) return 'broad';
    return 'mixed';
  }
  if (d.SPY < -0.1) return d.IWM < d.SPY ? 'broad_weakness' : 'mixed';
  return 'flat';
}
function volatilityState(d) {
  if (d.VIX === null && d.VIX_chg === null) return 'indeterminate';
  const chg = d.VIX_chg;
  if (chg !== null && chg > 6) return 'expansion';
  if (chg !== null && chg < -6) return 'compression';
  if (d.VIX !== null && d.VIX < 15) return 'compressed';
  if (d.VIX !== null && d.VIX > 22) return 'elevated'; // elevated but not actively expanding = unresolved
  return 'normal';
}
function yieldState(d) {
  const spread = d.yield_spread_bps;
  const y10 = d.US10Y_chg;
  if (spread === null && y10 === null) return 'indeterminate';
  if (y10 !== null && y10 > 1.5) return 'yield_pressure';
  if (spread !== null && spread < 0) return 'inversion';
  if (y10 !== null && y10 < -1.5) return 'yield_relief';
  return 'neutral';
}
function dollarState(d) {
  if (d.DXY_chg === null) return 'indeterminate';
  if (d.DXY_chg > 0.25) return 'tightening_proxy';
  if (d.DXY_chg < -0.25) return 'easing_proxy';
  return 'neutral';
}
function defensiveState(d) {
  const lead = d.sector_leadership || [];
  if (!lead.length) return 'indeterminate';
  const top = lead.slice(0, 3);
  const def = top.filter((s) => DEFENSIVE_SECTORS.includes(s)).length;
  const cyc = top.filter((s) => CYCLICAL_SECTORS.includes(s)).length;
  if (def > cyc) return 'defensive_rotation';
  if (cyc > def) return 'cyclical_leadership';
  return 'mixed';
}

// Cross-asset coherence: how consistently the observed dimensions point to one
// risk read (0..1). Risk-on = equities up, VIX down, gold down, dollar down.
function coherence(d) {
  const votes = [];
  if (d.SPY !== null) votes.push(d.SPY > 0 ? 1 : d.SPY < 0 ? -1 : 0);
  if (d.QQQ !== null) votes.push(d.QQQ > 0 ? 1 : d.QQQ < 0 ? -1 : 0);
  if (d.VIX_chg !== null) votes.push(d.VIX_chg < 0 ? 1 : d.VIX_chg > 0 ? -1 : 0);
  if (d.GOLD !== null) votes.push(d.GOLD < 0 ? 1 : d.GOLD > 0 ? -1 : 0);
  if (d.DXY_chg !== null) votes.push(d.DXY_chg < 0 ? 1 : d.DXY_chg > 0 ? -1 : 0);
  const real = votes.filter((v) => v !== 0);
  if (real.length < 2) return { score: null, n: real.length };
  const sum = real.reduce((a, b) => a + b, 0);
  return { score: Number((Math.abs(sum) / real.length).toFixed(2)), direction: sum > 0 ? 'risk_on' : sum < 0 ? 'risk_off' : 'mixed', n: real.length };
}

// ── Regime classification (deterministic, evidence-ordered) ───────────────────
function classifyRegime(d, sub, coh, reactionContext) {
  const dims = [d.SPY, d.IWM, d.VIX, d.US10Y, d.DXY].filter((x) => x !== null).length;
  if (dims < 2) return 'indeterminate';

  // Liquidity stress: yields up + equities down + volatility expansion.
  if (sub.yield === 'yield_pressure' && d.SPY !== null && d.SPY < -0.3 && sub.volatility === 'expansion') return 'liquidity_stress';
  if (reactionContext && reactionContext.liquidity_stress) return 'liquidity_stress';

  if (sub.defensive === 'defensive_rotation' && (d.SPY === null || d.SPY <= 0.1)) return 'defensive_rotation';
  if (sub.volatility === 'expansion' || sub.volatility === 'elevated') {
    if (d.SPY !== null && d.SPY > 0.1 && sub.breadth === 'narrow') return 'unstable_rally';
    return 'volatility_transition';
  }
  if (sub.yield === 'yield_pressure') return 'yield_pressure_regime';
  if (d.SPY !== null && d.SPY > 0.1) {
    if (sub.breadth === 'narrow') return d.QQQ !== null && d.QQQ > d.SPY ? 'crowded_growth_positioning' : 'narrow_leadership';
    if (sub.breadth === 'broad') return (sub.volatility === 'compressed' || sub.volatility === 'compression') && coh.score !== null && coh.score >= 0.6 ? 'healthy_risk_expansion' : 'broad_risk_support';
  }
  if (coh.score !== null && coh.score < 0.4) return 'macro_fragility';
  return 'indeterminate';
}

function liquidityState(d, sub) {
  if (sub.yield === 'yield_pressure') return 'yield_pressure';
  if (sub.defensive === 'defensive_rotation') return 'defensive_demand';
  if (sub.volatility === 'expansion') return 'volatility_rejection';
  if (sub.volatility === 'compression' || sub.volatility === 'compressed') return 'volatility_absorption';
  if (sub.dollar === 'tightening_proxy') return 'tightening';
  if (sub.dollar === 'easing_proxy') return 'easing';
  if (sub.dollar === 'indeterminate' && sub.yield === 'indeterminate' && sub.volatility === 'indeterminate') return 'indeterminate';
  return 'neutral';
}

function stabilityScore(regime, sub, coh) {
  if (regime === 'indeterminate') return 'indeterminate';
  if (regime === 'liquidity_stress' || regime === 'unstable_rally') return 'unstable';
  if (regime === 'volatility_transition') return 'transition_state';
  if (regime === 'defensive_rotation' || regime === 'macro_fragility') return 'deteriorating';
  if (regime === 'narrow_leadership' || regime === 'crowded_growth_positioning' || regime === 'yield_pressure_regime') return 'fragile';
  if (regime === 'healthy_risk_expansion') return 'stable';
  if (regime === 'broad_risk_support') return coh.score !== null && coh.score >= 0.6 ? 'strengthening' : 'stable';
  return 'transition_state';
}

function narrate(regime, liquidity, stability, sub, coh) {
  if (regime === 'indeterminate') return 'Insufficient observed cross-asset data to classify the current structural regime.';
  const M = {
    healthy_risk_expansion: 'Risk participation is broad with volatility compressed and cross-asset signals coherent.',
    broad_risk_support: 'Risk assets are supported across a broad set of participants, though confirmation is not yet complete.',
    narrow_leadership: 'Equity leadership remains narrow despite index-level stability, with limited breadth beneath the surface.',
    crowded_growth_positioning: 'Gains are concentrated in growth leadership while broader participation lags — positioning looks crowded.',
    defensive_rotation: 'Defensive sectors are leading, consistent with rotation away from cyclical risk.',
    liquidity_stress: 'Yields, equities and volatility are moving together in a way consistent with liquidity stress.',
    unstable_rally: 'Index strength is not confirmed by breadth or volatility, leaving the advance unstable.',
    volatility_transition: 'Volatility conditions are in transition, leaving the regime unresolved across assets.',
    yield_pressure_regime: 'Rising yields are exerting pressure across rate-sensitive assets.',
    macro_fragility: 'Cross-asset participation is incoherent beneath the surface, indicating macro fragility.',
  };
  let s = M[regime] || `Structural regime: ${regime.replace(/_/g, ' ')}.`;
  if (coh.score !== null) s += ` Cross-asset coherence ${coh.score}.`;
  return s;
}

function classify(state, reactionContext) {
  const d = normalizeDimensions(state);
  const sub = {
    breadth: breadthState(d), volatility: volatilityState(d), yield: yieldState(d),
    dollar: dollarState(d), defensive: defensiveState(d),
  };
  const coh = coherence(d);
  const regime = classifyRegime(d, sub, coh, reactionContext);
  const liquidity = liquidityState(d, sub);
  const stability = stabilityScore(regime, sub, coh);
  const narrative = narrate(regime, liquidity, stability, sub, coh);
  // confidence: how many dimensions were observable (0..100).
  const observed = [d.SPY, d.QQQ, d.IWM, d.VIX, d.US10Y, d.US02Y, d.DXY, d.GOLD, d.TLT].filter((x) => x !== null).length;
  const confidence = Math.round(Math.min(100, (observed / 9) * 100));
  return { regime, liquidity, stability, coherence: coh, sub_states: sub, dimensions: d, narrative, confidence, observed_dimensions: observed };
}

module.exports = { REGIMES, LIQUIDITY, STABILITY, DEFENSIVE_SECTORS, CYCLICAL_SECTORS, normalizeDimensions, coherence, classify, classifyRegime };
