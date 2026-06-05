'use strict';

const { readMemory, buildSnapshot } = require('./macro-intelligence-core');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');
const { buildRegimeSequence } = require('./build-regime-sequence');

function extractMarketSignals(current = buildSnapshot(), memory = readMemory()) {
  const c = current.advanced_internals || {};
  const divergence = detectCrossAssetDivergence(current);
  const sequence = buildRegimeSequence(current, memory);
  const signals = [];

  add(signals, 'participation_deterioration', c.participation_deterioration, 78, [
    `breadth state ${c.rolling_breadth_persistence}`,
    `sector participation ${valueLabel(c.sector_participation_score)}`
  ], ['SPY', 'IWM', 'RSP', 'sector ETFs'], current);

  add(signals, 'volatility_instability', c.volatility_rate_state === 'expanding' || current.volatility_environment === 'high', 74, [
    `volatility state ${c.volatility_rate_state}`,
    `VIX ${valueLabel(current.vix_level)}`
  ], ['VIX', 'SPY', 'TLT'], current);

  add(signals, 'narrowing_leadership', c.concentration_risk === 'elevated', 80, [
    `concentration risk ${c.concentration_risk}`,
    `QQQ/IWM gap ${valueLabel(c.leadership_concentration)}`
  ], ['QQQ', 'IWM', 'XLK', 'SMH'], current);

  add(signals, 'defensive_rotation', c.defensive_participation === 'improving' || current.dominant_macro_narrative.includes('Defensive'), 76, [
    `defensive participation ${c.defensive_participation}`,
    `risk regime ${current.dominant_risk_regime}`
  ], ['XLU', 'XLV', 'XLP', 'TLT'], current);

  add(signals, 'growth_fragility', c.ai_semiconductor_participation === 'improving' && c.cyclical_participation !== 'improving', 69, [
    `AI participation ${c.ai_semiconductor_participation}`,
    `cyclical participation ${c.cyclical_participation}`
  ], ['QQQ', 'SMH', 'SOXX', 'IWM'], current);

  add(signals, 'liquidity_stabilization', c.volatility_rate_state === 'compressing' && current.dominant_risk_regime !== 'risk-off', 63, [
    `volatility ${c.volatility_rate_state}`,
    `risk regime ${current.dominant_risk_regime}`
  ], ['VIX', 'DXY', 'SPY'], current);

  add(signals, 'duration_support', current.tlt_change_pct > 0.25 || String(current.yield_curve_condition).includes('inverted'), 66, [
    `TLT change ${valueLabel(current.tlt_change_pct)}`,
    `yield curve ${current.yield_curve_condition}`
  ], ['TLT', 'IEF', '10Y Treasury', 'QQQ'], current);

  add(signals, 'macro_stress_building', current.dominant_risk_regime === 'risk-off' || c.volatility_rate_state === 'expanding' || c.defensive_participation === 'improving', 72, [
    `risk regime ${current.dominant_risk_regime}`,
    `primary divergence ${divergence.primary_tension.signal}`,
    `sequence ${sequence.primary_sequence.pattern}`
  ], ['VIX', 'DXY', 'TLT', 'XLU'], current);

  return {
    generated_at: new Date().toISOString(),
    signals: signals.sort((a, b) => b.confidence - a.confidence),
    primary_signal: signals.sort((a, b) => b.confidence - a.confidence)[0] || null,
    source_state: {
      regime: current.dominant_risk_regime,
      volatility: current.volatility_environment,
      breadth: current.breadth_state,
      concentration: current.concentration_risk
    }
  };
}

function add(target, name, active, confidence, factors, assets, current) {
  if (!active) return;
  target.push({
    signal: name,
    confidence,
    supporting_factors: factors.filter(Boolean),
    related_assets: assets,
    persistence_duration: estimatePersistence(name),
    regime_relevance: `${current.dominant_risk_regime || 'unverified'} / ${current.volatility_environment || 'unverified'}`,
    commentary: signalCommentary(name)
  });
}

function estimatePersistence(name) {
  const memory = readMemory();
  const snapshots = (memory.snapshots || []).slice().reverse();
  let count = 0;
  for (const snapshot of snapshots) {
    const text = JSON.stringify(snapshot).toLowerCase();
    if (text.includes(name.split('_')[0])) count += 1;
    else break;
  }
  return count;
}

function signalCommentary(name) {
  const map = {
    participation_deterioration: 'Participation is weakening beneath the index surface; scenario work should distinguish index performance from breadth quality.',
    volatility_instability: 'Volatility conditions are less stable; scenario ranges should remain conditional and event-aware.',
    narrowing_leadership: 'Leadership concentration is elevated, making the tape more sensitive to rotation out of dominant growth exposures.',
    defensive_rotation: 'Defensive sector behavior is expressing caution even if headline index levels appear stable.',
    growth_fragility: 'Growth leadership is not being confirmed broadly, which keeps duration and earnings transmission important.',
    liquidity_stabilization: 'Volatility compression suggests liquidity conditions may be stabilizing, but confirmation requires breadth and small-cap participation.',
    duration_support: 'Duration-sensitive assets have a potential support channel through yields, subject to policy and inflation catalysts.',
    macro_stress_building: 'Cross-asset stress is building across at least one risk, volatility, or defensive-participation channel.'
  };
  return map[name] || 'Institutional signal detected from current market state.';
}

function valueLabel(value) {
  return value == null ? 'unverified' : String(value);
}

if (require.main === module) {
  console.log(JSON.stringify(extractMarketSignals(), null, 2));
}

module.exports = { extractMarketSignals };
