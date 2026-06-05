'use strict';

const { readMemory, buildSnapshot } = require('./macro-intelligence-core');

function detectNarrativeDrift(current = buildSnapshot(), memory = readMemory()) {
  const previous = (memory.snapshots || []).slice(-1)[0];
  const recent = (memory.snapshots || []).slice(-5);
  const notes = [];

  if (!previous) {
    notes.push('Narrative baseline initialized; subsequent runs will compare breadth, volatility, leadership, duration, and risk appetite against this state.');
    return { current, previous: null, notes, drift_score: 10 };
  }

  const c = current.advanced_internals || {};
  const p = previous.advanced_internals || {};

  if (improved(c.sector_participation_score, p.sector_participation_score, 15) && c.concentration_risk !== 'elevated') {
    notes.push('Breadth participation is improving while concentration risk is no longer the dominant index driver, suggesting healthier internal confirmation.');
  }
  if (c.defensive_participation === 'improving' && c.volatility_rate_state === 'compressing') {
    notes.push('Defensive sectors are outperforming despite volatility compression, a cross-asset contradiction that implies caution beneath calmer options pricing.');
  }
  if (p.ai_semiconductor_participation === 'improving' && c.ai_semiconductor_participation !== 'improving') {
    notes.push('AI and semiconductor leadership is narrowing relative to the previous state, reducing the quality of growth participation.');
  }
  if (current.tlt_change_pct > 0.3 && c.small_cap_confirmation === 'missing') {
    notes.push('Duration is rallying without small-cap confirmation, implying falling-yield support is not yet translating into broad cyclical risk appetite.');
  }
  if (current.dominant_risk_regime !== previous.dominant_risk_regime && current.dominant_risk_regime !== 'unverified') {
    notes.push(`Risk regime changed from ${previous.dominant_risk_regime} to ${current.dominant_risk_regime}, marking a material shift in market risk appetite.`);
  }
  if (current.volatility_environment !== previous.volatility_environment && current.volatility_environment !== 'unverified') {
    notes.push(`Volatility environment moved from ${previous.volatility_environment} to ${current.volatility_environment}, changing the interpretation of scenario risk.`);
  }
  if (current.yield_curve_condition !== previous.yield_curve_condition && current.yield_curve_condition !== 'unverified') {
    notes.push(`Yield-curve condition shifted from ${previous.yield_curve_condition} to ${current.yield_curve_condition}, altering the duration and cyclicals transmission channel.`);
  }
  if (recent.length >= 3) {
    const breadth = recent.map((s) => s.breadth_quality).filter(Number.isFinite);
    if (breadth.length >= 3 && c.sector_participation_score != null && c.sector_participation_score > avg(breadth) + 10) {
      notes.push('Rolling breadth is improving versus the recent memory window, making current participation broader than the medium-term baseline.');
    }
  }
  if (!notes.length) {
    notes.push('Narrative drift is limited; the current macro configuration mostly extends the prior regime rather than replacing it.');
  }

  return { current, previous, notes: unique(notes).slice(0, 5), drift_score: Math.min(100, notes.length * 18) };
}

function improved(current, previous, threshold) {
  return typeof current === 'number' && typeof previous === 'number' && current - previous >= threshold;
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique(values) {
  return [...new Set(values)];
}

if (require.main === module) {
  console.log(JSON.stringify(detectNarrativeDrift(), null, 2));
}

module.exports = { detectNarrativeDrift };
