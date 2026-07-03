'use strict';

// ── Confidence Engine ─────────────────────────────────────────────────────────
// Produces an educational confidence band from sourced market-state signals.
// Outputs are LABELS and SCORES for narrative use — never price targets or
// trading instructions.

const LABEL_MAP = [
  [75, 'constructive'],
  [60, 'improving breadth'],
  [45, 'cautious'],
  [30, 'defensive'],
  [15, 'volatile'],
  [0,  'elevated uncertainty']
];

const UNCERTAINTY_MAP = [
  [70, 'low uncertainty'],
  [50, 'moderate uncertainty'],
  [30, 'elevated uncertainty'],
  [0,  'high uncertainty']
];

const TONE_EMOJI = [
  [70, '📈'],
  [55, '📊'],
  [40, '⚠️'],
  [0,  '🛡️']
];

function calculateConfidence({ vix, volatilityState, riskState, aiMomentum, marketRegime, eventProximityDays }) {
  let score = 50;

  // VIX contribution (sourced — skip if null)
  if (typeof vix === 'number' && isFinite(vix)) {
    if (vix < 15)      score += 15;
    else if (vix < 20) score +=  5;
    else if (vix < 25) score -=  5;
    else if (vix < 30) score -= 15;
    else               score -= 25;
  }

  // Macro event proximity (days until nearest sourced event)
  if (typeof eventProximityDays === 'number' && isFinite(eventProximityDays)) {
    if (eventProximityDays <= 2)       score -= 20;
    else if (eventProximityDays <= 5)  score -= 10;
    else if (eventProximityDays <= 7)  score -=  5;
    else if (eventProximityDays > 14)  score +=  5;
  }

  // AI/semiconductor momentum
  if (aiMomentum === 'bullish')      score += 10;
  else if (aiMomentum === 'bearish') score -= 10;

  // Market regime
  if (marketRegime === 'risk-on')       score += 10;
  else if (marketRegime === 'risk-off') score -= 15;

  // Volatility state
  if (volatilityState === 'low')           score += 10;
  else if (volatilityState === 'elevated') score -= 15;

  // Risk state
  if (riskState === 'low')           score += 5;
  else if (riskState === 'elevated') score -= 10;

  score = Math.max(0, Math.min(100, score));

  return {
    confidence_score: score,
    uncertainty_score: 100 - score,
    label: resolveLabel(score, LABEL_MAP),
    uncertainty_label: resolveLabel(score, UNCERTAINTY_MAP),
    market_tone_emoji: resolveLabel(score, TONE_EMOJI)
  };
}

function resolveLabel(score, map) {
  for (const [threshold, label] of map) {
    if (score >= threshold) return label;
  }
  return map[map.length - 1][1];
}

// ── Scenario Builder ──────────────────────────────────────────────────────────
// Returns conditional educational scenario sentences.
// All scenarios use hedging language — no guaranteed outcomes.

function buildScenarios({ vix, aiMomentum, semiconductorMomentum, us10yYield, marketRegime, upcomingEvents, confidence }) {
  const scenarios = [];

  // Volatility scenario
  if (typeof vix === 'number') {
    if (vix > 25) {
      scenarios.push('Markets may remain volatile as the VIX suggests elevated uncertainty. Past spikes do not guarantee continuation.');
    } else if (vix < 15) {
      scenarios.push('Low volatility conditions may support a more stable near-term environment, though this can shift if macro conditions change.');
    }
  }

  // Macro event proximity scenario
  const nearEvent = (upcomingEvents || []).find((e) => {
    const days = (new Date(e.date + 'T00:00:00Z') - Date.now()) / 86400000;
    return days >= 0 && days <= 5;
  });
  if (nearEvent) {
    scenarios.push(`Markets may be cautious ahead of ${nearEvent.name} (${nearEvent.date}), a sourced macro event that could influence sentiment — though outcomes remain uncertain.`);
  }

  // AI/semiconductor momentum scenario
  if (aiMomentum === 'bullish') {
    scenarios.push('AI-related sector ETFs may maintain constructive momentum if the current trend continues, though past performance does not indicate future results.');
  } else if (aiMomentum === 'bearish') {
    scenarios.push('AI-sector ETFs face potential headwinds in the current context. Elevated uncertainty warrants additional caution in growth-oriented allocations.');
  }

  if (semiconductorMomentum === 'bullish' && aiMomentum !== 'bullish') {
    scenarios.push('Semiconductor momentum remains constructive while broader macro conditions appear stable — subject to change if yields or risk appetite shifts.');
  }

  // Yield pressure scenario
  if (typeof us10yYield === 'number' && us10yYield > 4.5) {
    scenarios.push('Higher yields may continue to apply valuation pressure on growth-heavy ETFs if they remain elevated — educational context only, not a prediction.');
  }

  // Regime scenario
  if (marketRegime === 'risk-off') {
    scenarios.push('A risk-off regime may favour defensive allocations over growth, though regime shifts can occur rapidly and without clear warning.');
  }

  // No fallback sentence here: telling readers "no sourced market data is
  // available" on a published page undermines the whole piece. An empty
  // return lets generate-market-intelligence substitute its bilingual
  // conditional-framework scenarios instead.
  return scenarios.slice(0, 3);
}

module.exports = { calculateConfidence, buildScenarios };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');

  const marketFile = path.join(ROOT, 'data', 'live-market-state.json');
  const calendarFile = path.join(ROOT, 'data', 'economic-calendar.json');
  const regimeFile = path.join(ROOT, 'data', 'market-regime-state.json');

  const market = fs.existsSync(marketFile) ? JSON.parse(fs.readFileSync(marketFile, 'utf8')) : {};
  const calendar = fs.existsSync(calendarFile) ? JSON.parse(fs.readFileSync(calendarFile, 'utf8')) : { events: [] };
  const regime = fs.existsSync(regimeFile) ? JSON.parse(fs.readFileSync(regimeFile, 'utf8')) : {};

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (calendar.events || []).filter((e) => e.date >= today && e.status === 'confirmed');
  const nearest = upcoming[0];
  const proximityDays = nearest
    ? Math.floor((new Date(nearest.date + 'T00:00:00Z') - Date.now()) / 86400000)
    : null;

  const state = market.metadata && market.metadata.status === 'live' ? market : {};
  const result = calculateConfidence({
    vix:                state.vix && state.vix.value,
    volatilityState:    state.volatility_state && state.volatility_state.value,
    riskState:          state.risk_state && state.risk_state.value,
    aiMomentum:         state.ai_sector_momentum && state.ai_sector_momentum.value,
    marketRegime:       state.market_regime && state.market_regime.value,
    eventProximityDays: proximityDays
  });

  const scenarios = buildScenarios({
    vix:                  state.vix && state.vix.value,
    aiMomentum:           state.ai_sector_momentum && state.ai_sector_momentum.value,
    semiconductorMomentum:state.semiconductor_momentum && state.semiconductor_momentum.value,
    us10yYield:           state.us10y_yield && state.us10y_yield.value,
    marketRegime:         state.market_regime && state.market_regime.value,
    upcomingEvents:       upcoming.slice(0, 3),
    confidence:           result
  });

  console.log(JSON.stringify({ ...result, scenarios }, null, 2));
}
