'use strict';

// ── Market Intelligence Engine ────────────────────────────────────────────────
// Analyzes sourced market state, macro calendar, and regime signals to produce
// educational market narratives, sector context, and directional scenarios.
//
// LEGAL: All output is educational commentary. No financial advice.
// No guaranteed predictions. No price targets. No certainty language.

const { calculateConfidence, buildScenarios } = require('./calculate-market-confidence.js');

function generateIntelligence(liveMarket, calendar, regime) {
  const live = liveMarket && liveMarket.metadata && liveMarket.metadata.status === 'live';
  const state = live ? liveMarket : {};
  const regimeState = (regime && regime.state) || {};
  const today = new Date().toISOString().slice(0, 10);

  const upcomingEvents = (calendar.events || [])
    .filter((e) => e.date >= today && e.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const nearest = upcomingEvents[0];
  const proximityDays = nearest
    ? Math.floor((new Date(nearest.date + 'T00:00:00Z') - Date.now()) / 86400000)
    : null;

  const vix          = valueOf(state.vix);
  const sp500        = valueOf(state.sp500);
  const nasdaq       = valueOf(state.nasdaq);
  const us10y        = valueOf(state.us10y_yield);
  const dxy          = valueOf(state.dxy);
  const gold         = valueOf(state.gold);
  const bitcoin      = valueOf(state.bitcoin);
  const aiMom        = valueOf(state.ai_sector_momentum);
  const semiMom      = valueOf(state.semiconductor_momentum);
  const marketRegime = valueOf(state.market_regime) || regimeState.growth_value_bias || null;
  const riskState    = valueOf(state.risk_state) || regimeState.risk_regime || null;
  const volatState   = valueOf(state.volatility_state) || regimeState.volatility_regime || null;

  const confidence = calculateConfidence({
    vix,
    volatilityState:    volatState,
    riskState,
    aiMomentum:         aiMom,
    marketRegime,
    eventProximityDays: proximityDays
  });

  const scenarios = buildScenarios({
    vix, aiMomentum: aiMom, semiconductorMomentum: semiMom,
    us10yYield: us10y, marketRegime, upcomingEvents, confidence
  });

  const sourced = [
    live && sp500 !== null && 'sp500',
    live && nasdaq !== null && 'nasdaq',
    live && vix !== null && 'vix',
    live && us10y !== null && 'us10y_yield',
    live && dxy !== null && 'dxy',
    live && gold !== null && 'gold',
    live && bitcoin !== null && 'bitcoin',
    live && aiMom !== null && 'ai_sector_momentum',
    live && semiMom !== null && 'semiconductor_momentum'
  ].filter(Boolean);

  return {
    confidence,
    scenarios,
    sourced_fields: sourced,
    data_completeness: sourced.length >= 7 ? 'full' : sourced.length >= 3 ? 'partial' : 'minimal',
    narratives: {
      market_narrative:          buildMarketNarrative(live, sp500, nasdaq, vix, us10y, dxy, confidence),
      sector_narrative:          buildSectorNarrative(live, aiMom, semiMom, confidence),
      volatility_interpretation: buildVolatilityInterp(live, vix, volatState),
      macro_pressure:            buildMacroPressure(upcomingEvents, proximityDays),
      etf_rotation:              buildEtfRotation(live, aiMom, semiMom, marketRegime, us10y),
      ai_semiconductor_context:  buildAiSemiContext(live, aiMom, semiMom)
    },
    upcoming_events: upcomingEvents
  };
}

// ── Narrative builders ────────────────────────────────────────────────────────
// All functions return CONDITIONAL educational text. Never use certainty
// language, price targets, or guaranteed outcomes.

function buildMarketNarrative(live, sp500, nasdaq, vix, us10y, dxy, confidence) {
  if (!live) {
    return `No live market state is currently available. This educational commentary is based on structural market context only. The market outlook reflects the ${confidence.label} framework derived from regime signals.`;
  }
  const parts = [];
  if (sp500 !== null) parts.push(`S&P 500 at ${sp500}`);
  if (nasdaq !== null) parts.push(`NASDAQ at ${nasdaq}`);
  if (vix !== null)   parts.push(`VIX at ${vix}`);
  if (us10y !== null) parts.push(`US 10-year yield at ${us10y}%`);
  if (dxy !== null)   parts.push(`DXY at ${dxy}`);
  const dataStr = parts.length ? `With ${parts.join(', ')}, ` : '';
  return `${dataStr}the current market environment may be characterised as ${confidence.label}. This context is educational — conditions can shift rapidly and should be interpreted with appropriate uncertainty.`;
}

function buildSectorNarrative(live, aiMom, semiMom, confidence) {
  if (!live || (aiMom === null && semiMom === null)) {
    return 'Sector momentum data is not currently sourced. Educational commentary focuses on general sector dynamics without directional claims.';
  }
  const parts = [];
  if (aiMom !== null && aiMom !== 'unverified')   parts.push(`AI sector momentum is ${aiMom}`);
  if (semiMom !== null && semiMom !== 'unverified') parts.push(`semiconductor momentum is ${semiMom}`);
  if (!parts.length) return 'Sector momentum signals are currently unverified. No directional sector commentary can be made from this data.';
  return `${parts.join(' and ')}. These signals are educational indicators — they do not predict future performance and past momentum does not guarantee continuation.`;
}

function buildVolatilityInterp(live, vix, volatState) {
  if (!live || vix === null) {
    return 'Volatility data is not currently sourced. Educational context: VIX above 20 is historically associated with elevated market uncertainty. Editors should verify current conditions.';
  }
  if (vix > 30) return `VIX at ${vix} suggests elevated market stress. Historically, VIX above 30 has been associated with heightened uncertainty — not a prediction of direction or timing.`;
  if (vix > 20) return `VIX at ${vix} indicates above-average volatility. This is an educational observation about current conditions, not a trading signal.`;
  if (vix < 15) return `VIX at ${vix} suggests relatively low volatility. Educational note: low volatility can precede sudden moves in either direction.`;
  return `VIX at ${vix} is within a moderate historical range. Market conditions may shift and this data is for educational context only.`;
}

function buildMacroPressure(upcomingEvents, proximityDays) {
  if (!upcomingEvents.length) {
    return 'No sourced macro events are currently in the educational calendar. Analysis uses structural context only.';
  }
  const next = upcomingEvents[0];
  const urgency = proximityDays !== null && proximityDays <= 3 ? 'imminent (within 3 days)' : proximityDays !== null && proximityDays <= 7 ? 'near-term (within 7 days)' : 'upcoming';
  return `The nearest sourced macro event is ${next.name} on ${next.date} — classified as ${urgency}. Educational context: major data releases can create volatility in either direction. This is not predictive.`;
}

function buildEtfRotation(live, aiMom, semiMom, marketRegime, us10y) {
  if (!live) return 'ETF rotation context requires live data. Educational framework: regime and yield environments may influence relative performance across ETF categories.';
  const parts = [];
  if (marketRegime === 'risk-off') parts.push('risk-off regimes have historically been associated with flows toward defensive ETFs');
  if (typeof us10y === 'number' && us10y > 4.5) parts.push('elevated yields may apply valuation pressure on growth-oriented ETFs');
  if (aiMom === 'bullish') parts.push('constructive AI momentum may support technology-sector ETFs subject to broader market conditions');
  if (!parts.length) return 'Current ETF rotation signals are not sufficiently sourced for educational commentary. Structural diversification principles apply.';
  return `Educational ETF context: ${parts.join('; ')}. These are educational observations — not investment recommendations or guaranteed outcomes.`;
}

function buildAiSemiContext(live, aiMom, semiMom) {
  if (!live || (aiMom === null && semiMom === null)) {
    return 'AI and semiconductor data is not currently sourced. Educational note: these sectors are sensitive to earnings cycles, yield changes, and supply chain developments.';
  }
  const parts = [];
  if (aiMom && aiMom !== 'unverified')   parts.push(`AI sector momentum appears ${aiMom}`);
  if (semiMom && semiMom !== 'unverified') parts.push(`semiconductor momentum appears ${semiMom}`);
  return `${parts.join('. ')}. These are sourced educational signals — past momentum does not indicate future performance. Sector conditions can change rapidly on macro or earnings developments.`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function valueOf(entry) {
  return (entry && entry.value !== undefined && entry.value !== null) ? entry.value : null;
}

module.exports = { generateIntelligence };

// ── CLI mode ──────────────────────────────────────────────────────────────────
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');

  const marketFile   = path.join(ROOT, 'data', 'live-market-state.json');
  const calendarFile = path.join(ROOT, 'data', 'economic-calendar.json');
  const regimeFile   = path.join(ROOT, 'data', 'market-regime-state.json');

  const liveMarket = fs.existsSync(marketFile)   ? JSON.parse(fs.readFileSync(marketFile, 'utf8'))   : {};
  const calendar   = fs.existsSync(calendarFile) ? JSON.parse(fs.readFileSync(calendarFile, 'utf8')) : { events: [] };
  const regime     = fs.existsSync(regimeFile)   ? JSON.parse(fs.readFileSync(regimeFile, 'utf8'))   : {};

  const intelligence = generateIntelligence(liveMarket, calendar, regime);
  console.log(JSON.stringify(intelligence, null, 2));
}
