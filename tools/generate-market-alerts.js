'use strict';

const { buildSnapshot, readMemory } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { detectCrossAssetDivergence } = require('./detect-cross-asset-divergence');
const { extractMarketSignals } = require('./extract-market-signals');

function generateMarketAlerts(current = buildSnapshot(), memory = readMemory()) {
  const drift = detectNarrativeDrift(current, memory);
  const divergence = detectCrossAssetDivergence(current);
  const signals = extractMarketSignals(current, memory);
  const alerts = [];

  for (const signal of signals.signals.slice(0, 5)) {
    if (signal.confidence >= 68) {
      alerts.push(alert(signal.signal, signal.confidence, signal.commentary, signal.supporting_factors, signal.related_assets));
    }
  }
  if (drift.drift_score >= 35) {
    alerts.push(alert('regime_shift_watch', Math.min(90, drift.drift_score + 30), drift.notes[0], ['narrative drift detected'], ['SPY', 'QQQ', 'VIX', 'TLT']));
  }
  if (divergence.primary_tension && divergence.primary_tension.signal !== 'No major divergence detected') {
    alerts.push(alert('cross_asset_divergence', 75, divergence.primary_tension.commentary, [divergence.primary_tension.signal], ['QQQ', 'IWM', 'VIX', 'TLT', 'DXY']));
  }

  return {
    generated_at: new Date().toISOString(),
    alerts: dedupe(alerts).slice(0, 8),
    policy: 'Educational institutional monitoring only. No buy/sell signals, exact price predictions, or certainty language.'
  };
}

function alert(type, confidence, commentary, factors, assets) {
  return {
    type,
    severity: confidence >= 80 ? 'high' : confidence >= 68 ? 'medium' : 'watch',
    confidence,
    commentary,
    scenario_context: `If this condition persists, scenario work should test the transmission path through ${assets.slice(0, 3).join(', ')} while keeping uncertainty explicit.`,
    supporting_factors: factors,
    related_assets: assets,
    safety: 'Not a trading signal.'
  };
}

function dedupe(alerts) {
  const seen = new Set();
  return alerts.filter((item) => {
    if (seen.has(item.type)) return false;
    seen.add(item.type);
    return true;
  });
}

if (require.main === module) {
  console.log(JSON.stringify(generateMarketAlerts(), null, 2));
}

module.exports = { generateMarketAlerts };
