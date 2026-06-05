'use strict';

// Phase 50: Institutional Market Narrative Engine
// Converts live-market-state.json into interpretive cross-asset narrative blocks.
// Derives relationships from verified data only — no fabrication, no speculation.
//
// Usage (module):
//   const { buildNarrative } = require('./build-market-narrative');
//   const narrative = buildNarrative(live, regime, topicCluster);
//
// Usage (CLI):
//   node tools/build-market-narrative.js [--topic-cluster=ai]

'use strict';

const fs   = require('fs');
const path = require('path');
const { buildAdvancedInternals } = require('./macro-intelligence-core');

const ROOT        = path.resolve(__dirname, '..');
const LIVE_PATH   = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');

// ── Public API ────────────────────────────────────────────────────────────────

function buildNarrative(live, regime, topicCluster = '') {
  const status = live && live.metadata && live.metadata.status;
  if (!status || status === 'fallback') {
    return buildStructuralNarrative(regime, topicCluster);
  }
  return buildLiveNarrative(live, regime, topicCluster);
}

// ── Market internals (computed from available data) ───────────────────────────

function computeInternals(live, sectorEtfs) {
  const spyChg = pct(live, 'sp500');
  const qqqChg = pct(live, 'nasdaq');
  const iwmChg = pct(live, 'russell2000');

  const sectorChanges = Object.values(sectorEtfs)
    .filter(s => s && s.change_pct != null)
    .map(s => s.change_pct);

  const sectorsPositive = sectorChanges.filter(c => c > 0).length;
  const sectorsTotal    = sectorChanges.length;

  const sectorBreadthScore = sectorsTotal > 0
    ? Math.round((sectorsPositive / sectorsTotal) * 100)
    : null;

  const broadChanges = [spyChg, qqqChg, iwmChg, ...sectorChanges].filter(c => c != null);
  const equalWeightProxy = broadChanges.length > 0
    ? broadChanges.reduce((a, b) => a + b, 0) / broadChanges.length
    : null;

  const ewVsCwDivergence = (equalWeightProxy != null && spyChg != null)
    ? parseFloat((equalWeightProxy - spyChg).toFixed(2))
    : null;

  const smallCapsRS = (iwmChg != null && spyChg != null)
    ? parseFloat((iwmChg - spyChg).toFixed(2))
    : null;

  const concentrationScore = (qqqChg != null && iwmChg != null)
    ? parseFloat((qqqChg - iwmChg).toFixed(2))
    : null;

  let breadthSignal = 'unverified';
  if (sectorBreadthScore != null) {
    breadthSignal = sectorBreadthScore >= 75 ? 'broad_participation'
      : sectorBreadthScore >= 50 ? 'moderate_breadth'
      : sectorBreadthScore >= 25 ? 'narrow_breadth'
      : 'deteriorating';
  }

  let participationQuality = 'unverified';
  if (concentrationScore != null) {
    participationQuality = concentrationScore > 1.5 ? 'concentrated_mega_cap'
      : concentrationScore > 0.5 ? 'growth_biased'
      : concentrationScore < -1.5 ? 'value_breadth_rotation'
      : concentrationScore < -0.5 ? 'small_cap_leadership'
      : 'balanced';
  }

  const advanced = buildAdvancedInternals(live, { snapshots: [] });
  return {
    sector_breadth_score: sectorBreadthScore,
    breadth_signal: breadthSignal,
    equal_weight_vs_cap_weight: ewVsCwDivergence,
    small_caps_relative_strength: smallCapsRS,
    concentration_score: concentrationScore,
    participation_quality: participationQuality,
    sectors_positive: sectorsPositive,
    sectors_total: sectorsTotal,
    equal_weight_vs_cap_weight_divergence: advanced.equal_weight_vs_cap_weight_divergence,
    rolling_breadth_persistence: advanced.rolling_breadth_persistence,
    participation_deterioration: advanced.participation_deterioration,
    leadership_concentration: advanced.leadership_concentration,
    concentration_risk: advanced.concentration_risk,
    momentum_diffusion: advanced.momentum_diffusion,
    sector_participation_score: advanced.sector_participation_score,
    volatility_compression_expansion_rate: advanced.volatility_compression_expansion_rate,
    volatility_rate_state: advanced.volatility_rate_state,
    ai_semiconductor_participation: advanced.ai_semiconductor_participation,
    cyclical_participation: advanced.cyclical_participation,
    defensive_participation: advanced.defensive_participation,
    small_cap_confirmation: advanced.small_cap_confirmation
  };
}

// ── Live narrative (data-grounded) ────────────────────────────────────────────

function buildLiveNarrative(live, regime, topicCluster) {
  const cr = live.computed_regime || {};

  const vixVal   = v(live, 'vix');
  const us10y    = v(live, 'us10y_yield');
  const us2y     = v(live, 'us2y_yield');
  const dxy      = v(live, 'dxy');
  const gold     = v(live, 'gold');
  const fed      = v(live, 'fed_funds_rate');

  const spyChg   = pct(live, 'sp500');
  const qqqChg   = pct(live, 'nasdaq');
  const iwmChg   = pct(live, 'russell2000');
  const goldChg  = pct(live, 'gold');
  const tltChg   = pct(live, 'tlt');
  const nvdaChg  = pct(live, 'nvda');

  const spread     = live.yield_spread_2y10y || {};
  const spreadBps  = spread.spread_bps;
  const spreadReg  = spread.spread_regime;

  const sectorEtfs = live.sector_etfs || {};
  const internals  = computeInternals(live, sectorEtfs);

  return {
    data_source:              'live',
    generated_at:             new Date().toISOString(),
    market_internals:         internals,
    macro_narrative:          macroNarrative(vixVal, us10y, us2y, spreadBps, spreadReg, fed, spyChg, qqqChg, iwmChg, cr),
    risk_narrative:           riskNarrative(vixVal, cr, spyChg, qqqChg, iwmChg, internals, sectorEtfs),
    cross_asset_narrative:    crossAssetNarrative(vixVal, us10y, dxy, gold, goldChg, tltChg, qqqChg, spreadBps),
    yield_curve_narrative:    yieldCurveNarrative(us10y, us2y, spreadBps, spreadReg, fed),
    volatility_context:       volatilityContext(vixVal, cr.volatility_regime, spyChg, tltChg),
    breadth_narrative:        breadthNarrative(internals, spyChg, qqqChg, iwmChg, sectorEtfs),
    positioning_observations: positioningObservations(cr, internals, qqqChg, iwmChg, goldChg, tltChg, dxy),
    ai_semis_context:         aiSemisContext(nvdaChg, qqqChg, sectorEtfs, cr),
    topic_cluster:            topicCluster,
  };
}

// ── Narrative block builders ──────────────────────────────────────────────────

function macroNarrative(vixVal, us10y, us2y, spreadBps, spreadReg, fed, spyChg, qqqChg, iwmChg, cr) {
  const parts = [];

  // Rate environment
  if (us10y != null) {
    let rateCtx = `The 10-year Treasury yield at ${us10y.toFixed(2)}%`;
    if (fed != null) {
      const spread = parseFloat((us10y - fed).toFixed(2));
      const direction = spread > 0 ? `${spread.toFixed(2)}pp above` : `${Math.abs(spread).toFixed(2)}pp below`;
      rateCtx += ` stands ${direction} the Fed funds target of ${fed.toFixed(2)}%`;
    }
    if (spreadBps != null) {
      const curveDesc = spreadBps < -50 ? 'deeply inverted curve'
        : spreadBps < 0   ? 'modestly inverted curve'
        : spreadBps < 50  ? 'flat curve'
        : spreadBps < 150 ? 'normalizing curve'
        : 'steep curve';
      rateCtx += `, with a ${curveDesc} at ${spreadBps >= 0 ? '+' : ''}${spreadBps}bps (2Y/10Y)`;
    }
    rateCtx += '.';
    parts.push(rateCtx);
  }

  // VIX / volatility regime
  if (vixVal != null) {
    const volDesc = vixVal < 12  ? 'VIX below 12 indicates extreme volatility compression — historically associated with elevated complacency risk'
      : vixVal < 15  ? `VIX at ${vixVal.toFixed(1)} places the volatility regime in low-vol territory, consistent with broadly supportive risk conditions`
      : vixVal < 20  ? `VIX at ${vixVal.toFixed(1)} reflects normal-range uncertainty pricing`
      : vixVal < 25  ? `VIX at ${vixVal.toFixed(1)} signals elevated uncertainty, approaching the threshold where institutional hedging programs typically activate`
      : vixVal < 35  ? `VIX at ${vixVal.toFixed(1)} represents acute hedging demand, consistent with risk-off positioning pressure`
      : `VIX at ${vixVal.toFixed(1)} reflects crisis-level fear premium — this magnitude historically coincides with forced deleveraging and liquidity impairment`;
    parts.push(volDesc + '.');
  }

  // Equity breadth
  if (spyChg != null && qqqChg != null && iwmChg != null) {
    const broadPositive = [spyChg, qqqChg, iwmChg].filter(c => c > 0).length;
    const broadDesc = broadPositive === 3 ? 'broad-based equity advance across large-cap, growth, and small-cap proxies'
      : broadPositive === 2 ? 'mixed equity tape with partial breadth'
      : broadPositive === 1 ? 'narrow equity participation — only one of three major indices advancing'
      : 'broad-based equity retreat';
    parts.push(`The current session reflects a ${broadDesc} (SPY ${fmt(spyChg)}, QQQ ${fmt(qqqChg)}, IWM ${fmt(iwmChg)}).`);
  }

  // Overall regime
  if (cr.market_regime && cr.market_regime !== 'unverified') {
    const regimeText = {
      'risk-on':           'Computed market regime: risk-on — cross-asset signals support continued equity participation.',
      'risk-off':          'Computed market regime: risk-off — cross-asset signals indicate defensive positioning pressure.',
      'growth_momentum':   'Computed market regime: growth momentum — technology and growth factor outperformance is dominant.',
      'defensive_rotation':'Computed market regime: defensive rotation — utilities and healthcare leadership signals caution.',
      'volatility_spike':  'Computed market regime: volatility spike — rapid VIX expansion is disrupting normal cross-asset correlations.',
      'rates_pressure':    'Computed market regime: rates pressure — yield curve inversion combined with elevated VIX is compressing risk multiples.',
      'mixed':             'Computed market regime: mixed — cross-asset signals are conflicting; no dominant directional regime is evident.',
    }[cr.market_regime] || `Computed market regime: ${cr.market_regime}.`;
    parts.push(regimeText);
  }

  return parts.join(' ') || null;
}

function riskNarrative(vixVal, cr, spyChg, qqqChg, iwmChg, internals, sectorEtfs) {
  const parts = [];

  // Defensive sector activity
  const xluChg = sectorEtfs.XLU && sectorEtfs.XLU.change_pct;
  const xlvChg = sectorEtfs.XLV && sectorEtfs.XLV.change_pct;
  const xleChg = sectorEtfs.XLE && sectorEtfs.XLE.change_pct;

  if (xluChg != null && xlvChg != null && spyChg != null) {
    const defAvg = (xluChg + xlvChg) / 2;
    if (defAvg > spyChg + 0.4) {
      parts.push(`Defensive sector outperformance — utilities (XLU ${fmt(xluChg)}) and healthcare (XLV ${fmt(xlvChg)}) ahead of SPY — is consistent with risk-averse capital rotation.`);
    } else if (defAvg < spyChg - 0.4) {
      parts.push(`Defensive sector underperformance against the broader tape (XLU ${fmt(xluChg)}, XLV ${fmt(xlvChg)} vs SPY ${fmt(spyChg)}) is consistent with risk-on rotation away from capital-preservation positioning.`);
    }
  }

  // Breadth-based risk signal
  if (internals.breadth_signal && internals.breadth_signal !== 'unverified') {
    const breadthRisk = {
      'broad_participation': `Sector breadth score of ${internals.sector_breadth_score}% (${internals.sectors_positive}/${internals.sectors_total} sectors advancing) suggests healthy market participation — a supportive technical backdrop for near-term risk.`,
      'moderate_breadth':    `Sector breadth at ${internals.sector_breadth_score}% is moderate — neither a risk-on confirmation nor a deterioration signal.`,
      'narrow_breadth':      `Narrow sector breadth (${internals.sector_breadth_score}%, ${internals.sectors_positive}/${internals.sectors_total} sectors positive) indicates concentrated leadership — historically associated with increased fragility if leaders rotate.`,
      'deteriorating':       `Deteriorating breadth (${internals.sector_breadth_score}%, ${internals.sectors_positive}/${internals.sectors_total} sectors positive) is a caution signal — broad market weakness tends to precede index-level recognition.`,
    }[internals.breadth_signal];
    if (breadthRisk) parts.push(breadthRisk);
  }

  // VIX-based risk state
  if (vixVal != null) {
    if (vixVal > 25) {
      parts.push(`At VIX ${vixVal.toFixed(1)}, options markets are pricing elevated event premium; hedging costs are elevated and may suppport demand for protective structures.`);
    } else if (vixVal < 14) {
      parts.push(`VIX compression to ${vixVal.toFixed(1)} implies low near-term uncertainty pricing — a historically mean-reverting state that can precede sudden volatility expansion.`);
    }
  }

  return parts.join(' ') || null;
}

function crossAssetNarrative(vixVal, us10y, dxy, gold, goldChg, tltChg, qqqChg, spreadBps) {
  const parts = [];

  // TLT / QQQ relationship (duration proxy vs growth)
  if (tltChg != null && qqqChg != null) {
    if (tltChg > 0.3 && qqqChg > 0.3) {
      parts.push(`TLT advancing ${fmt(tltChg)} alongside QQQ ${fmt(qqqChg)} signals a falling-yields / rising-growth environment — historically the most constructive cross-asset configuration for duration-sensitive growth assets.`);
    } else if (tltChg < -0.3 && qqqChg < -0.3) {
      parts.push(`TLT pressure (${fmt(tltChg)}) combined with QQQ weakness (${fmt(qqqChg)}) reflects simultaneous yield and equity risk-off — a more challenging environment for duration and growth multiples.`);
    } else if (tltChg > 0.3 && qqqChg < -0.3) {
      parts.push(`TLT bid (${fmt(tltChg)}) alongside QQQ selling (${fmt(qqqChg)}) represents a classic flight-to-duration, risk-off cross-asset pattern — bonds functioning as equity hedge.`);
    } else if (tltChg < -0.3 && qqqChg > 0.5) {
      parts.push(`Rising yields (TLT ${fmt(tltChg)}) paired with QQQ strength (${fmt(qqqChg)}) suggests the market is tolerating higher rates in a growth-positive environment — a regime that historically compresses growth multiples gradually.`);
    }
  }

  // Dollar / commodities / gold
  if (dxy != null && goldChg != null) {
    if (dxy > 105 && goldChg < -0.3) {
      parts.push(`Dollar strength at DXY ${dxy.toFixed(1)} combined with gold pressure (${fmt(goldChg)}) is consistent with a liquidity-tightening environment — elevated USD reduces the attractiveness of non-yielding macro hedges.`);
    } else if (dxy < 98 && goldChg > 0.3) {
      parts.push(`Dollar softness at DXY ${dxy.toFixed(1)} with gold advancing (${fmt(goldChg)}) reflects a macro hedging / dollar-debasement environment — historically supportive of commodity and GLD positioning.`);
    } else if (goldChg != null && Math.abs(goldChg) < 0.2 && dxy > 100) {
      parts.push(`Gold's muted response to DXY ${dxy.toFixed(1)} may indicate reduced macro hedging demand, or equilibrium between dollar and inflation expectations.`);
    }
  }

  // Yield curve context
  if (spreadBps != null) {
    if (spreadBps < -50) {
      parts.push(`A deeply inverted 2Y/10Y curve at ${spreadBps}bps continues to price rate-cutting expectations into the short end, maintaining pressure on financial sector net interest margins (XLF) and signaling growth concerns that the long end has not fully resolved.`);
    } else if (spreadBps >= 0 && spreadBps < 50) {
      parts.push(`The curve's transition from inversion to a ${spreadBps}bps spread marks an important structural shift — curve normalization historically coincides with the market beginning to price sustained growth recovery, with complex implications for rate-sensitive equity sectors.`);
    }
  }

  return parts.join(' ') || null;
}

function yieldCurveNarrative(us10y, us2y, spreadBps, spreadReg, fed) {
  const parts = [];

  if (us10y == null && us2y == null) return null;

  if (us10y != null && us2y != null) {
    parts.push(`The 10-year Treasury at ${us10y.toFixed(2)}% and 2-year at ${us2y.toFixed(2)}% define the current rate structure.`);
  } else if (us10y != null) {
    parts.push(`The 10-year Treasury yield stands at ${us10y.toFixed(2)}%.`);
  }

  if (spreadBps != null) {
    const curveContext = spreadBps < -100
      ? `deep inversion of ${Math.abs(spreadBps)}bps — the most historically reliable leading indicator of growth deceleration, though with notoriously variable lead times`
      : spreadBps < -25
      ? `modest inversion of ${Math.abs(spreadBps)}bps — sustained inversion implies the market continues to price eventual Fed rate cuts`
      : spreadBps < 25
      ? `near-zero spread of ${spreadBps}bps — a flat curve signals the market is roughly pricing current policy as near-neutral terminal`
      : spreadBps < 100
      ? `positive spread of +${spreadBps}bps — normalization from prior inversion, historically associated with an improving growth outlook`
      : `steep spread of +${spreadBps}bps — steepening curves often reflect either reflationary expectations or a rapidly normalizing monetary cycle`;
    parts.push(`The 2Y/10Y reflects ${curveContext}.`);
  }

  if (fed != null && us2y != null) {
    const gap = parseFloat((us2y - fed).toFixed(2));
    if (gap < -0.5) {
      parts.push(`The 2-year yield ${Math.abs(gap).toFixed(2)}pp below Fed funds signals that rate markets are pricing meaningful easing ahead — a potential tailwind for duration assets if the policy path delivers.`);
    } else if (gap > 0.3) {
      parts.push(`The 2-year yield trading above Fed funds at a ${gap.toFixed(2)}pp premium suggests the market has shifted toward pricing either a delayed cut or a higher-for-longer terminal rate.`);
    } else {
      parts.push(`The 2-year yield near the Fed funds target at ${gap >= 0 ? '+' : ''}${gap.toFixed(2)}pp suggests well-anchored near-term policy expectations.`);
    }
  }

  return parts.join(' ') || null;
}

function volatilityContext(vixVal, volRegime, spyChg, tltChg) {
  if (vixVal == null) return null;
  const parts = [];

  // Absolute VIX interpretation
  const absContext = vixVal < 12
    ? `VIX at ${vixVal.toFixed(1)} represents extreme vol compression. Historically, this level precedes rapid expansion when sentiment shifts — complacency is a risk.`
    : vixVal < 15
    ? `VIX at ${vixVal.toFixed(1)} prices limited near-term uncertainty. The absence of meaningful implied vol premium typically reflects institutional hedging demand at lows.`
    : vixVal < 20
    ? `VIX at ${vixVal.toFixed(1)} is in the normal operating range — options markets are pricing contained uncertainty without crisis premium.`
    : vixVal < 25
    ? `VIX at ${vixVal.toFixed(1)} approaches the 20+ threshold where systematic hedging programs typically increase allocation to protective structures.`
    : vixVal < 35
    ? `VIX at ${vixVal.toFixed(1)} reflects significant hedging demand — this level often corresponds to institutional demand for downside protection that itself can become self-reinforcing.`
    : `VIX at ${vixVal.toFixed(1)} is at crisis-register levels, implying substantial disruption to normal risk-parity and volatility-targeting strategies.`;
  parts.push(absContext);

  // Equity/bond correlation context
  if (spyChg != null && tltChg != null) {
    const corr = spyChg > 0 && tltChg < 0 ? 'negative correlation (equities up, bonds down) — a risk-on / inflation-tolerant environment'
      : spyChg > 0 && tltChg > 0 ? 'positive stock-bond correlation — bonds and equities advancing together, typical of falling-yield / risk-on sessions'
      : spyChg < 0 && tltChg > 0 ? 'negative correlation (equities down, bonds up) — classic flight-to-quality dynamic, bonds functioning as portfolio hedge'
      : 'positive correlation (equities and bonds both under pressure) — simultaneous selling of traditional risk-parity positions, associated with inflation or liquidity shocks';
    parts.push(`Cross-asset signals reflect ${corr}.`);
  }

  return parts.join(' ') || null;
}

function breadthNarrative(internals, spyChg, qqqChg, iwmChg, sectorEtfs) {
  if (internals.sectors_total === 0) return null;
  const parts = [];

  // Headline breadth
  const breadthContext = {
    'broad_participation': `Broad sector participation (${internals.sectors_positive}/${internals.sectors_total} sectors advancing, breadth ${internals.sector_breadth_score}%) suggests genuine risk appetite rather than concentrated positioning — this is the type of breadth that supports sustained index moves.`,
    'moderate_breadth':    `Moderate sector breadth (${internals.sectors_positive}/${internals.sectors_total} sectors positive, ${internals.sector_breadth_score}%) indicates mixed participation — the tape is not broadly constructive, but also not experiencing concentrated deterioration.`,
    'narrow_breadth':      `Narrow market breadth (${internals.sectors_positive}/${internals.sectors_total} sectors positive, ${internals.sector_breadth_score}%) signals leadership concentration — index-level gains that mask sector-level divergence historically carry higher reversal risk.`,
    'deteriorating':       `Deteriorating market breadth (${internals.sectors_positive}/${internals.sectors_total} sectors positive, ${internals.sector_breadth_score}%) is a technical warning signal — historically, broad sector weakness precedes broader index recognition by days to weeks.`,
  }[internals.breadth_signal];
  if (breadthContext) parts.push(breadthContext);

  // Equal-weight vs cap-weight
  if (internals.equal_weight_vs_cap_weight != null) {
    const ewDiv = internals.equal_weight_vs_cap_weight;
    if (ewDiv > 0.3) {
      parts.push(`Equal-weight participation outpacing cap-weight proxies by approximately ${ewDiv.toFixed(1)}pp suggests broader market participation — a positive divergence for the quality of the advance.`);
    } else if (ewDiv < -0.4) {
      parts.push(`Cap-weight proxies outpacing the broader tape by ${Math.abs(ewDiv).toFixed(1)}pp signals mega-cap concentration, where index performance is driven by a small number of large constituents rather than broad participation.`);
    }
  }

  // Small cap relative strength
  if (internals.small_caps_relative_strength != null) {
    const sc = internals.small_caps_relative_strength;
    if (sc > 0.5) {
      parts.push(`IWM outperforming SPY by ${sc.toFixed(1)}pp is consistent with a risk-on, cyclical-growth environment where smaller-cap names participate meaningfully — typically a healthier breadth signal than large-cap-only rallies.`);
    } else if (sc < -0.8) {
      parts.push(`Small-cap underperformance (IWM ${Math.abs(sc).toFixed(1)}pp behind SPY) reflects ongoing preference for large-cap quality — a pattern that often accompanies cautious risk repositioning or macro uncertainty.`);
    }
  }

  // Concentration risk
  if (internals.concentration_score != null) {
    const cc = internals.concentration_score;
    if (cc > 2.0) {
      parts.push(`The QQQ/IWM performance gap of ${cc.toFixed(1)}pp indicates highly concentrated mega-cap technology leadership — narrow leadership risk that leaves the market more exposed to rotation out of top-weight constituents.`);
    }
  }

  return parts.join(' ') || null;
}

function positioningObservations(cr, internals, qqqChg, iwmChg, goldChg, tltChg, dxy) {
  const parts = [];

  // Duration positioning
  if (tltChg != null) {
    const tltObs = tltChg > 0.5 ? 'TLT bidding suggests active demand for duration — positioning consistent with expecting rate normalisation or risk-off protection'
      : tltChg < -0.5 ? 'TLT selling reflects reduced duration appetite — positioning consistent with either rate-rise expectations or risk-on rotation out of bonds'
      : null;
    if (tltObs) parts.push(tltObs + '.');
  }

  // Commodities / macro hedge
  if (goldChg != null && dxy != null) {
    if (goldChg > 0.5 && dxy < 100) {
      parts.push('Gold strength in a weaker-dollar environment is consistent with macro hedge demand or inflation expectations driving cross-asset allocation.');
    } else if (goldChg < -0.5 && dxy > 102) {
      parts.push('Gold weakness alongside dollar strength is consistent with reduced macro hedge allocation — potentially reflecting USD-denominated liquidity preference over real asset hedging.');
    }
  }

  // Growth vs value positioning signal
  if (cr.growth_value_bias && cr.growth_value_bias !== 'unverified') {
    const gvText = {
      'growth':               'Cross-asset signals reflect a growth factor bias — positioning appears tilted toward growth/duration-sensitive assets.',
      'value':                'Cross-asset signals reflect a value factor rotation — positioning appears tilted toward cyclicals, financials, and rate beneficiaries.',
      'balanced':             'Growth and value signals are roughly balanced — no dominant factor tilt is apparent from current cross-asset signals.',
      'mixed':                'Growth and value signals are conflicting — factor positioning appears uncertain or in transition.',
    }[cr.growth_value_bias];
    if (gvText) parts.push(gvText);
  }

  // AI/semi positioning
  if (cr.ai_sector_momentum && cr.ai_sector_momentum !== 'unverified') {
    const aiText = {
      'positive': 'AI and semiconductor sector signals are positive — risk positioning in the technology complex appears constructive.',
      'negative': 'AI and semiconductor sector signals are under pressure — growth factor exposure is being tested by the current tape.',
      'neutral':  null,
    }[cr.ai_sector_momentum];
    if (aiText) parts.push(aiText);
  }

  return parts.join(' ') || null;
}

function aiSemisContext(nvdaChg, qqqChg, sectorEtfs, cr) {
  const parts = [];
  const xlkChg = sectorEtfs.XLK && sectorEtfs.XLK.change_pct;

  if (nvdaChg == null && xlkChg == null) return null;

  // NVDA as AI capex cycle proxy
  if (nvdaChg != null) {
    const nvdaCtx = nvdaChg > 3 ? `NVDA ${fmt(nvdaChg)} — a move of this magnitude typically signals either earnings-driven repricing or hyperscaler capex sentiment shift. The AI infrastructure cycle is pricing in sustained demand expansion.`
      : nvdaChg > 1 ? `NVDA ${fmt(nvdaChg)} reflects positive AI capex cycle sentiment — the market is pricing continued GPU demand from hyperscaler infrastructure investment.`
      : nvdaChg < -3 ? `NVDA ${fmt(nvdaChg)} — pressure of this magnitude in the AI proxy often reflects either earnings risk, export control concern, or hyperscaler capex guidance uncertainty.`
      : nvdaChg < -1 ? `NVDA pressure at ${fmt(nvdaChg)} signals caution in AI infrastructure expectations — market participants may be reassessing near-term hyperscaler capex trajectory.`
      : `NVDA flat (${fmt(nvdaChg)}) — the primary AI infrastructure proxy is consolidating, offering limited directional signal for the near-term cycle.`;
    parts.push(nvdaCtx);
  }

  // XLK vs QQQ divergence (AI/semi concentration)
  if (xlkChg != null && qqqChg != null) {
    const gap = parseFloat((xlkChg - qqqChg).toFixed(2));
    if (gap > 0.4) {
      parts.push(`XLK outperforming QQQ by ${gap.toFixed(1)}pp suggests technology sector is generating excess return relative to the broader growth index — consistent with AI/semiconductor-driven concentration.`);
    } else if (gap < -0.4) {
      parts.push(`QQQ outperforming XLK by ${Math.abs(gap).toFixed(1)}pp signals non-tech growth leadership — the advance is broader than technology alone, which can be a positive breadth signal.`);
    }
  }

  // Narrow vs broad AI leadership
  if (nvdaChg != null && qqqChg != null) {
    const nvdaVsQQQ = parseFloat((nvdaChg - qqqChg).toFixed(2));
    if (nvdaVsQQQ > 2.5) {
      parts.push('NVDA outperforming QQQ by more than 2.5pp indicates highly concentrated AI leadership — single-name concentration risk is elevated; the theme is working but the breadth of participation is narrow.');
    }
  }

  return parts.join(' ') || null;
}

// ── Structural fallback (no live data) ───────────────────────────────────────

function buildStructuralNarrative(regime, topicCluster) {
  const state = (regime && regime.state) || {};
  const parts  = [];

  if (state.volatility_regime && state.volatility_regime !== 'unverified') {
    parts.push(`Volatility regime: ${state.volatility_regime}.`);
  }
  if (state.risk_regime && state.risk_regime !== 'unverified') {
    parts.push(`Risk regime: ${state.risk_regime}.`);
  }
  if (state.rates_trend && state.rates_trend !== 'unverified') {
    parts.push(`Rates trend: ${state.rates_trend}.`);
  }

  return {
    data_source:              'structural_fallback',
    generated_at:             new Date().toISOString(),
    market_internals:         null,
    macro_narrative:          parts.length ? parts.join(' ') : null,
    risk_narrative:           null,
    cross_asset_narrative:    null,
    yield_curve_narrative:    null,
    volatility_context:       null,
    breadth_narrative:        null,
    positioning_observations: null,
    ai_semis_context:         null,
    topic_cluster:            topicCluster,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function v(live, field) {
  return live && live[field] && live[field].value != null ? live[field].value : null;
}

function pct(live, field) {
  return live && live[field] && live[field].change_pct != null ? live[field].change_pct : null;
}

function fmt(pctVal) {
  return `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`;
}

// ── CLI entry point ───────────────────────────────────────────────────────────

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

if (require.main === module) {
  const cluster = (process.argv.find(a => a.startsWith('--topic-cluster=')) || '').replace('--topic-cluster=', '');
  const live    = readJson(LIVE_PATH,   { metadata: { status: 'fallback' } });
  const regime  = readJson(REGIME_PATH, {});
  const result  = buildNarrative(live, regime, cluster);
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { buildNarrative, computeInternals };
