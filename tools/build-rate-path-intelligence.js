'use strict';

// Phase 62: Yield Curve + Fed Transmission Layer
// Analyzes the current rate path, yield curve configuration,
// and translates policy expectations into cross-asset implications.
//
// Derives regime from available signals:
//   - Macro narrative tones (from generate-macro-narrative.js)
//   - Recent macro releases (FOMC, CPI, NFP patterns)
//   - Market regime context
//   - Live market state (if available)
//
// Output: data/intelligence/rate-path-intelligence.json
//
// Usage:
//   node tools/build-rate-path-intelligence.js           → dry run
//   node tools/build-rate-path-intelligence.js --write   → write output

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '..');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const REGIME_PATH    = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const CAL_PATH       = path.join(ROOT, 'data', 'economic-calendar.json');
const LIVE_PATH      = path.join(ROOT, 'data', 'live-market-state.json');
const EXPECT_PATH    = path.join(ROOT, 'data', 'market-expectations.json');
const OUT_PATH       = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');

const WRITE = process.argv.includes('--write');

function main() {
  const narrative  = readJson(NARRATIVE_PATH, { release_narratives: [], active_themes: [] });
  const regime     = readJson(REGIME_PATH,    { regime: null, confidence: 0.5 });
  const calendar   = readJson(CAL_PATH,       { events: [] });
  const live       = readJson(LIVE_PATH,      { metadata: { status: 'fallback' } });

  const signals    = deriveRateSignals(narrative, regime, calendar, live);
  const fedPath    = deriveFedPath(signals, regime);
  const curveDiag  = deriveCurveDiagnostic(signals, regime);
  const duration   = buildDurationSensitivityMap(fedPath.stance);

  const output = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality: live?.metadata?.status === 'live' ? 'live' : 'derived',
    signal_sources: signals.sources,

    yield_curve: {
      inferred_shape: curveDiag.shape,
      inversion_status: curveDiag.inversion,
      curve_narrative: curveDiag.narrative,
      historical_context: curveDiag.historical_context,
      confirmation_needed: curveDiag.confirmation
    },

    fed_path: {
      current_stance: fedPath.stance,
      bias: fedPath.bias,
      probability_scenarios: fedPath.scenarios,
      key_drivers: fedPath.drivers,
      implied_path_narrative: fedPath.narrative,
      policy_risk: fedPath.risk
    },

    duration_sensitivity: duration,

    cross_asset_implications: buildCrossAssetImplications(fedPath.stance, fedPath.bias),

    monitoring_indicators: buildMonitoringIndicators(fedPath.stance),

    disclaimer: 'Fed path probabilities and yield curve diagnostics are educational inferences from available macro signals, not market pricing or forecasts. Actual rate path will be determined by the FOMC based on evolving data.'
  };

  if (!WRITE) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[rate-path] wrote intelligence: ${fedPath.stance} stance, ${fedPath.bias} bias`);
}

// ── Signal collection ─────────────────────────────────────────────────────────

function deriveRateSignals(narrative, regime, calendar, live) {
  const signals = { tightening: 0, easing: 0, holding: 0, sources: [] };

  // From narrative tones
  const releases = narrative.release_narratives || [];
  let hawkish = 0, dovish = 0;
  for (const n of releases) {
    if (n.policy_tone === 'hawkish_impulse') hawkish++;
    if (n.policy_tone === 'dovish_impulse')  dovish++;
  }
  if (hawkish > 0) {
    signals.tightening += hawkish * 2;
    signals.sources.push(`${hawkish} hawkish release(s) in recent macro narrative`);
  }
  if (dovish > 0) {
    signals.easing += dovish * 2;
    signals.sources.push(`${dovish} dovish release(s) in recent macro narrative`);
  }

  // From regime
  const r = regime?.regime;
  if (r === 'tightening_cycle') { signals.tightening += 4; signals.sources.push('Market regime: tightening cycle'); }
  if (r === 'easing_cycle')     { signals.easing += 4;     signals.sources.push('Market regime: easing cycle'); }
  if (r === 'disinflation')     { signals.easing += 2;     signals.sources.push('Market regime: disinflation (easing bias)'); }
  if (r === 'stagflation_risk') { signals.holding += 3;    signals.sources.push('Market regime: stagflation risk (hold bias)'); }
  if (r === 'recession_risk')   { signals.easing += 3;     signals.sources.push('Market regime: recession risk (easing demand)'); }

  // From recent calendar events
  const events = calendar.events || [];
  const recentCPI = events
    .filter((e) => /cpi|pce/.test(String(e.type).toLowerCase()) && e.status === 'released')
    .sort((a, b) => Date.parse(b.event_time || b.date) - Date.parse(a.event_time || a.date))
    .slice(0, 3);

  let cpiHot = 0, cpiSoft = 0;
  for (const e of recentCPI) {
    const actual = parseFloat(e.actual), forecast = parseFloat(e.forecast);
    if (!isNaN(actual) && !isNaN(forecast)) {
      if (actual > forecast) cpiHot++;
      else if (actual < forecast) cpiSoft++;
    }
  }
  if (cpiHot >= 2)  { signals.tightening += 3; signals.sources.push(`${cpiHot} recent CPI/PCE prints above consensus`); }
  if (cpiSoft >= 2) { signals.easing += 3;     signals.sources.push(`${cpiSoft} recent CPI/PCE prints below consensus`); }

  // From active themes
  const themes = narrative.active_themes || [];
  if (themes.includes('rate_path_recalibration'))  { signals.tightening += 1; }
  if (themes.includes('fomc_policy_focus'))         { signals.holding += 1;    }
  if (themes.includes('inflation_data_focus'))      { signals.tightening += 1; }

  // Default if no strong signals
  if (signals.tightening + signals.easing + signals.holding === 0) {
    signals.holding += 2;
    signals.sources.push('Default: no strong directional signal — holding baseline');
  }

  return signals;
}

// ── Fed path derivation ───────────────────────────────────────────────────────

function deriveFedPath(signals, regime) {
  const total = signals.tightening + signals.easing + signals.holding;
  const pTight = signals.tightening / total;
  const pEase  = signals.easing / total;
  const pHold  = signals.holding / total;

  let stance, bias;
  if (pTight > 0.55)      { stance = 'restrictive';     bias = 'hawkish'; }
  else if (pEase > 0.55)  { stance = 'accommodative';   bias = 'dovish'; }
  else if (pTight > 0.35) { stance = 'restrictive';     bias = 'hold_with_hawkish_bias'; }
  else if (pEase > 0.35)  { stance = 'transitioning';   bias = 'hold_with_dovish_bias'; }
  else                    { stance = 'neutral';          bias = 'data_dependent'; }

  const scenarios = buildProbabilityScenarios(bias, pTight, pEase, pHold);

  return {
    stance,
    bias,
    scenarios,
    drivers: signals.sources.slice(0, 4),
    narrative: buildFedNarrative(stance, bias, signals),
    risk: buildPolicyRisk(stance, bias)
  };
}

function buildProbabilityScenarios(bias, pT, pE, pH) {
  if (bias === 'hawkish') return {
    hold_or_hike: parseFloat((pT * 0.8 + pH * 0.3).toFixed(2)),
    cut_25bp: parseFloat((pE * 0.5).toFixed(2)),
    cut_50bp: parseFloat((pE * 0.3).toFixed(2)),
    hike_25bp: parseFloat((pT * 0.2).toFixed(2))
  };
  if (bias === 'dovish') return {
    hold: parseFloat((pH * 0.4 + pT * 0.2).toFixed(2)),
    cut_25bp: parseFloat((pE * 0.5).toFixed(2)),
    cut_50bp: parseFloat((pE * 0.4).toFixed(2)),
    hike_25bp: parseFloat((pT * 0.1).toFixed(2))
  };
  // Default: data-dependent
  return {
    hold: parseFloat((pH * 0.5 + 0.2).toFixed(2)),
    cut_25bp: parseFloat((pE * 0.4 + 0.1).toFixed(2)),
    cut_50bp: parseFloat((pE * 0.2).toFixed(2)),
    hike_25bp: parseFloat((pT * 0.1 + 0.05).toFixed(2))
  };
}

function buildFedNarrative(stance, bias, signals) {
  const narratives = {
    restrictive_hawkish: 'The available macro signals suggest the Fed is operating from a restrictive policy stance with a hawkish bias — multiple above-consensus inflation readings and a resilient labor market reduce the urgency for rate reduction. The terminal rate is likely being priced at or above current levels, with rate-cut probability concentrated beyond a 6-month horizon.',
    restrictive_hold_with_hawkish_bias: 'The Fed appears positioned in a data-dependent hold with a hawkish lean — the policy stance is restrictive, but the bar for further tightening is high given cumulative hikes already in the system. Rate cuts are possible but require sequential data improvement in both inflation and employment.',
    accommodative_dovish: 'The macro signal environment points toward an accommodative or easing-oriented Fed stance — recent inflation prints have been below consensus, and labor market softness is providing the dual-mandate permission structure for rate reduction. Rate-cut probability is rising within a 3-6 month horizon.',
    transitioning_hold_with_dovish_bias: 'The Fed appears in a transitional posture with a dovish lean — the direction of travel is toward easing, but the pace remains data-dependent. Markets are pricing cuts within the next 2-3 meetings, though the sequencing and magnitude are still being negotiated by incoming data.',
    neutral_data_dependent: 'The macro signal environment does not provide a clear directional read on Fed policy — incoming data is mixed, and the Fed\'s reaction function is being re-calibrated. The most likely near-term outcome is a hold with language that preserves optionality in both directions.'
  };

  const key = `${stance}_${bias}`;
  return narratives[key] || `Fed stance: ${stance}, bias: ${bias}. Signal composition: ${signals.tightening} tightening, ${signals.easing} easing, ${signals.holding} holding.`;
}

function buildPolicyRisk(stance, bias) {
  if (stance === 'restrictive' && bias === 'hawkish')
    return 'Primary risk: over-tightening into a growth slowdown — the Fed maintains high rates while the economy deteriorates, amplifying a recession-like outcome. Secondary risk: inflation re-acceleration invalidates cut expectations.';
  if (stance === 'accommodative' || bias === 'dovish')
    return 'Primary risk: premature easing reigniting inflation before the last mile is complete. Secondary risk: easing too slowly into a recession, failing to provide stimulus when needed most.';
  return 'Risk: policy error in either direction given mixed signals. Data dependency creates high-frequency repricing events around each CPI, NFP, and FOMC meeting.';
}

// ── Yield curve diagnostic ────────────────────────────────────────────────────

function deriveCurveDiagnostic(signals, regime) {
  const r = regime?.regime;

  let shape, inversion, narrative, historical;

  if (r === 'tightening_cycle' && signals.tightening > signals.easing) {
    shape = 'flat_to_inverted';
    inversion = 'probable';
    narrative = 'A tightening cycle with sustained restrictive policy typically flattens or inverts the yield curve — the short end (2Y) is pinned high by Fed rate expectations while the long end (10Y, 30Y) reflects falling growth expectations or terminal rate uncertainty. The 2Y/10Y inversion is the historically most predictive recession signal when sustained for 3+ months.';
    historical = 'The 2Y/10Y curve has been inverted for much of 2022-2024, the longest sustained inversion in the post-war period. Historical precedent suggests recession onset typically lags inversion by 12-18 months, with the yield curve often un-inverting (steepening) before and during the recession onset.';
  } else if (r === 'easing_cycle' || signals.easing > signals.tightening * 1.5) {
    shape = 'bull_steepening';
    inversion = 'resolving';
    narrative = 'An easing cycle typically produces bull steepening — the short end falls faster than the long end as rate cuts are priced. The 2Y yield leads the move lower while the 10Y remains anchored or falls more slowly. This is constructive for duration assets (TLT) and long-growth equities (QQQ) that were penalized by the flat/inverted curve.';
    historical = 'Bull steepening that follows yield curve inversion is a late-cycle signal — it often coincides with or slightly precedes recession onset, as the Fed begins cutting in response to growth deterioration. Not all bull steepenings are bearish; those driven by inflation falling without growth deterioration (disinflation) are more constructive.';
  } else if (r === 'disinflation') {
    shape = 'gradual_normalization';
    inversion = 'reducing';
    narrative = 'Disinflation without recession allows for gradual curve normalization — the short end eases as rate-cut expectations build, while the long end is relatively stable reflecting intact long-run growth expectations. This "goldilocks" curve configuration is constructive for both bonds and equities.';
    historical = 'The 1994-1996 and 2015-2016 disinflationary periods both featured gradual curve normalization that supported cross-asset performance. The key risk is that normalization stalls if inflation remains sticky or growth re-accelerates.';
  } else {
    shape = 'uncertain';
    inversion = 'unknown';
    narrative = 'Insufficient signal clarity to diagnose the yield curve shape with confidence. The curve\'s behavior is the most important confirmation signal to watch — direction of 2Y yield movements relative to 10Y will reveal whether the market is pricing tightening, easing, or a growth transition.';
    historical = 'Yield curve shape has been the most reliable leading economic indicator over the past 50 years, with every recession preceded by 2Y/10Y inversion. The current signal environment warrants careful monitoring of each Treasury auction and Fed communication.';
  }

  return {
    shape,
    inversion,
    narrative,
    historical_context: historical,
    confirmation: ['2Y Treasury yield direction relative to 10Y', 'DXY correlation to yield spread', 'Credit spread behavior (HYG/LQD vs TLT)']
  };
}

// ── Duration sensitivity map ──────────────────────────────────────────────────

function buildDurationSensitivityMap(stance) {
  const isTight = stance === 'restrictive';
  const isEase  = stance === 'accommodative' || stance === 'transitioning';

  return {
    QQQ: {
      sensitivity: 'very_high',
      direction: isTight ? 'negative_on_rate_rise' : 'positive_on_rate_fall',
      mechanism: 'Long-horizon growth cash flows discounted at higher rate reduces intrinsic value mechanically. A 50bp rate rise compresses QQQ intrinsic value by ~8-12% in a standard DCF framework.'
    },
    TLT: {
      sensitivity: 'very_high_direct',
      direction: isTight ? 'headwind' : 'tailwind',
      mechanism: 'TLT has a duration of ~17-18 years. Direct price-yield relationship. 100bp rate rise = ~17% TLT price decline. The most direct rate exposure in the ETF universe.'
    },
    XLU: {
      sensitivity: 'high',
      direction: isTight ? 'headwind_via_yield_spread_compression' : 'tailwind',
      mechanism: 'Utilities are bond proxies — when Treasury yields rise, XLU dividend yield spread compresses, triggering capital rotation to bonds. Also carries significant debt load sensitive to financing costs.'
    },
    GLD: {
      sensitivity: 'high_via_real_yield',
      direction: isTight ? 'headwind_via_opportunity_cost' : 'tailwind_via_real_yield_fall',
      mechanism: 'Gold has no yield. Rising real yields (nominal yield minus inflation breakeven) increase the opportunity cost of holding gold. DXY strength amplifies the headwind. Real yield > 2% historically creates structural gold headwind.'
    },
    XLF: {
      sensitivity: 'positive_on_rate_rise',
      direction: isTight ? 'net_interest_margin_expansion' : 'NIM_compression_short_term',
      mechanism: 'Bank net interest margins expand when the yield curve steepens (long-end rises relative to short-end). A flat or inverted curve compresses NIM. Rate hikes without steepening can be neutral-to-negative for banks.'
    },
    IWM: {
      sensitivity: 'high_via_debt_channel',
      direction: isTight ? 'negative_financing_cost' : 'positive_financing_relief',
      mechanism: 'Unlike QQQ (equity duration), IWM\'s rate sensitivity is via the debt channel — small caps actually borrow at short-term rates. 100bp rate rise = 3-5% EPS headwind through higher interest expense on floating-rate debt.'
    },
    SOXX: {
      sensitivity: 'high_dual_channel',
      direction: isTight ? 'double_headwind' : 'double_tailwind',
      mechanism: 'SOXX faces rate headwind through both equity duration (valuation) and enterprise capex cycle (AI infrastructure investment slows when cost of capital rises). The compounding of both channels makes SOXX the most rate-sensitive sector ETF.'
    },
    SPY: {
      sensitivity: 'moderate',
      direction: 'mixed',
      mechanism: 'SPY\'s sector diversification creates partially offsetting rate sensitivities. XLF benefits from rate rises, XLU and XLK suffer. Net sensitivity is moderate-negative in tightening environments when XLF NIM gains are insufficient to offset growth stock compression.'
    }
  };
}

// ── Cross-asset implications ──────────────────────────────────────────────────

function buildCrossAssetImplications(stance, bias) {
  const isHawkish = stance === 'restrictive' || bias === 'hawkish' || bias === 'hold_with_hawkish_bias';
  const isDovish  = stance === 'accommodative' || bias === 'dovish' || bias === 'hold_with_dovish_bias';

  if (isHawkish) {
    return {
      equities: 'Multiple compression risk across growth assets. Value and quality factors may outperform on relative basis. Financials (XLF) are a structural beneficiary if the yield curve steepens, but a flat/inverted curve limits NIM upside.',
      rates: 'Short-end yields elevated and likely to remain so. Long-end behavior depends on growth expectations — if growth holds, the curve may steepen moderately. TLT remains structurally challenged.',
      gold: 'Elevated real yields act as the primary gold headwind. DXY strength adds a currency-channel pressure. Gold may find support only from geopolitical or systemic risk premium.',
      dollar: 'Higher-for-longer Fed policy supports DXY relative to G10 peers pursuing easing. EM currencies face significant pressure from the rate differential.',
      volatility: 'VIX likely elevated. Each macro data point creates repricing events. Implied vol typically elevated across rates, equities, and FX in tightening regimes.'
    };
  }
  if (isDovish) {
    return {
      equities: 'Potential re-rating of long-duration growth assets. QQQ and IWM are the highest-conviction beneficiaries of rate relief. Quality earnings receive lower discount penalty — multiple expansion possible.',
      rates: 'Front-end leads the relief rally. Bull steepening: 2Y falls faster than 10Y. TLT benefits but the long-end is also influenced by term premium and fiscal dynamics — recovery may be more limited than the front-end move.',
      gold: 'Dual support: falling real yields reduce opportunity cost; weakening dollar provides currency-channel tailwind. Historically gold performs strongly in early easing cycles, particularly those accompanied by dollar weakness.',
      dollar: 'DXY faces downward pressure as rate differential with G10 peers narrows. EM carry trade revives. Commodity currencies benefit from both improved growth expectations and dollar softness.',
      volatility: 'VIX tends to compress in early easing cycles as the monetary policy uncertainty resolves. However, if easing is driven by recession fear, realized vol remains elevated even as the Fed is cutting.'
    };
  }
  return {
    equities: 'Mixed signal environment creates sector dispersion opportunity. Data-dependent Fed means each macro release is a high-volatility event. Cross-asset correlation structures are unstable.',
    rates: 'Yield curve at an inflection point — monitoring the direction of 2Y-10Y spread movement is the primary directional signal.',
    gold: 'Range-bound near-term. Real yield stability and dollar neutrality reduce gold\'s directional catalyst. Watch for breakouts driven by geopolitical events or policy surprises.',
    dollar: 'DXY directionless without a clear rate differential signal. G10 relative policy divergence is the key driver to monitor.',
    volatility: 'Elevated implied vol on major macro events (FOMC, CPI). VIX term structure reflects policy uncertainty premium. Options strategies that benefit from vol compression may face persistence of elevated pricing.'
  };
}

// ── Monitoring indicators ─────────────────────────────────────────────────────

function buildMonitoringIndicators(stance) {
  const core = [
    '2Y Treasury yield direction: Most sensitive near-term Fed expectations indicator',
    '10Y Treasury yield: Long-run growth and inflation expectations composite',
    '2Y/10Y spread: Inversion (negative) signals recession risk; steepening (positive) signals cycle transition',
    'DXY trend: Rate differential proxy; confirms or contradicts yield signals',
    'TIPS 5Y breakeven: Market inflation expectation; key input for real yield calculation (= nominal yield minus breakeven)'
  ];

  if (stance === 'restrictive') {
    core.push('Fed funds futures 1Y forward rate: Tracks market\'s terminal rate pricing across the cycle');
    core.push('TLT 200-day SMA: Technical confirmation of whether the market is positioned for sustained rate elevation');
    core.push('HYG/LQD spread: Credit market confirmation of whether financial conditions are actually tight (widening) vs priced-but-not-felt');
  } else {
    core.push('2Y Treasury 6-week rate of change: Speed and conviction of the rate relief move');
    core.push('TLT momentum: Confirms whether the easing expectation is being priced with conviction');
    core.push('GLD/USD correlation: In a genuine easing cycle, GLD should decouple positively from the rate move');
  }

  return core;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main();
