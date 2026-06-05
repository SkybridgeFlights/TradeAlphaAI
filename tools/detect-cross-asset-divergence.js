'use strict';

const { buildSnapshot } = require('./macro-intelligence-core');

function detectCrossAssetDivergence(current = buildSnapshot()) {
  const c = current.advanced_internals || {};
  const tensions = [];

  if (current.qqq_change_pct > 0.35 && c.rolling_breadth_persistence === 'deteriorating') {
    tensions.push(block('QQQ rally with deteriorating breadth', 'Growth index strength is not being confirmed by broad participation, leaving the advance vulnerable to leadership rotation.'));
  }
  if (c.volatility_rate_state === 'compressing' && c.small_cap_confirmation === 'missing') {
    tensions.push(block('Falling VIX with weak small caps', 'Options markets are pricing calmer conditions while small-cap participation remains weak, a sign that risk appetite is still selective.'));
  }
  if (c.ai_semiconductor_participation === 'improving' && c.cyclical_participation === 'deteriorating') {
    tensions.push(block('Strong semis with weak cyclicals', 'AI and semiconductor participation is not translating into broader cyclical confirmation, keeping leadership concentration risk elevated.'));
  }
  if (current.tlt_change_pct < -0.25 && c.defensive_participation === 'improving') {
    tensions.push(block('Rising yields with defensive outperformance', 'Higher-rate pressure is coinciding with defensive sector demand, a cautious signal for equity duration and earnings confidence.'));
  }
  if (current.gold_change_pct > 0.25 && current.dxy_level > 102) {
    tensions.push(block('Gold and dollar strength together', 'Gold strength alongside a firm dollar suggests macro hedge demand is coexisting with USD liquidity preference.'));
  }
  if (current.qqq_change_pct > 0.35 && c.concentration_risk === 'elevated') {
    tensions.push(block('Mega-cap leadership concentration', 'Index performance is being driven by a narrow growth complex, which raises reversal risk if positioning unwinds.'));
  }
  if (!tensions.length) {
    tensions.push(block('No major divergence detected', 'Cross-asset signals are not showing a high-conviction contradiction across volatility, breadth, leadership, rates, and hedges.'));
  }

  return { generated_at: new Date().toISOString(), tensions: tensions.slice(0, 4), primary_tension: tensions[0] };
}

function block(signal, commentary) {
  return { signal, commentary };
}

if (require.main === module) {
  console.log(JSON.stringify(detectCrossAssetDivergence(), null, 2));
}

module.exports = { detectCrossAssetDivergence };
