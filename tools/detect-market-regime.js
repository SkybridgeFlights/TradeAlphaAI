'use strict';

// Phase 62: Market Regime Detection Engine
// Derives the current macro regime from available signals:
//   - macro narrative tones (from generate-macro-narrative.js output)
//   - economic calendar surprise history
//   - live market state (if available)
//   - market expectations context
//
// Supported regimes:
//   risk_on, risk_off, tightening_cycle, easing_cycle,
//   stagflation_risk, disinflation, recession_risk,
//   liquidity_expansion, defensive_rotation
//
// Output: data/intelligence/market-regime.json
//
// Usage:
//   node tools/detect-market-regime.js           → dry run
//   node tools/detect-market-regime.js --write   → write output

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const CAL_PATH      = path.join(ROOT, 'data', 'economic-calendar.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const EXPECT_PATH   = path.join(ROOT, 'data', 'market-expectations.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const OUT_PATH      = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');

const WRITE = process.argv.includes('--write');

// Regime definitions with their signal affinities
const REGIME_DEFS = {
  tightening_cycle: {
    label: 'Tightening Cycle',
    description: 'Fed maintaining or increasing restrictive policy. Rate-cut expectations delayed or repriced.'
  },
  easing_cycle: {
    label: 'Easing Cycle',
    description: 'Fed cutting rates or signaling easing. Liquidity improving. Duration assets benefiting.'
  },
  risk_on: {
    label: 'Risk-On',
    description: 'Equities bid, VIX subdued, cyclicals outperforming. Growth expectations stable or improving.'
  },
  risk_off: {
    label: 'Risk-Off',
    description: 'Flight to safety. Defensive assets (TLT, GLD, XLU) outperforming. VIX elevated.'
  },
  stagflation_risk: {
    label: 'Stagflation Risk',
    description: 'Inflation elevated while growth disappointing. Policy in a bind — cannot ease without worsening inflation, cannot tighten without crushing growth.'
  },
  disinflation: {
    label: 'Disinflation',
    description: 'CPI/PCE trending lower toward target. Rate-cut window narrowing from inflation side. Supports soft-landing narrative.'
  },
  recession_risk: {
    label: 'Recession Risk',
    description: 'Growth slowing materially. Labor market weakening. ISM below 50. Yield curve inversion sustained.'
  },
  liquidity_expansion: {
    label: 'Liquidity Expansion',
    description: 'Financial conditions loosening. Credit spreads tight. Risk appetite elevated. Breadth participation broad.'
  },
  defensive_rotation: {
    label: 'Defensive Rotation',
    description: 'Capital shifting from cyclicals/growth to defensive sectors (XLU, XLP, XLV). VIX elevated but not extreme.'
  }
};

function main() {
  const narrative  = readJson(NARRATIVE_PATH, { release_narratives: [], preview_narratives: [], active_themes: [], regime_narrative: null });
  const calendar   = readJson(CAL_PATH,       { events: [] });
  const live       = readJson(LIVE_PATH,      { metadata: { status: 'fallback' } });
  const memory     = readJson(MEMORY_PATH,    { event_reactions: [], historical_patterns: {} });

  const signals = collectSignals(narrative, calendar, live, memory);
  const scores  = scoreRegimes(signals);
  const winner  = pickWinner(scores);
  const output  = buildOutput(winner, scores, signals, narrative, live);

  if (!WRITE) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[regime] Detected: ${output.regime} (confidence: ${(output.confidence * 100).toFixed(0)}%)`);
}

// ── Signal collection ─────────────────────────────────────────────────────────

function collectSignals(narrative, calendar, live, memory) {
  const signals = [];
  const now = Date.now();
  const events = calendar.events || [];

  // ── Signals from recent macro releases ─────────────────────────────────────
  const recentReleased = events
    .filter((e) => e.status === 'released' && e.actual !== null && Date.parse(e.event_time || e.date) >= now - 14 * 86400000)
    .sort((a, b) => Date.parse(b.event_time || b.date) - Date.parse(a.event_time || a.date));

  for (const e of recentReleased.slice(0, 10)) {
    const t = String(e.type || '').toLowerCase();
    const actual = parseFloat(e.actual);
    const forecast = parseFloat(e.forecast);
    const dir = actual > forecast ? 'hot' : actual < forecast ? 'soft' : 'neutral';

    if (/cpi|pce/.test(t)) {
      if (dir === 'hot') {
        signals.push({ regime: 'tightening_cycle', weight: 3, source: `${e.event_name}: above-consensus inflation`, type: 'calendar' });
        signals.push({ regime: 'stagflation_risk', weight: 1, source: `${e.event_name}: hot print adds stagflation dimension`, type: 'calendar' });
      } else if (dir === 'soft') {
        signals.push({ regime: 'disinflation', weight: 3, source: `${e.event_name}: below-consensus inflation`, type: 'calendar' });
        signals.push({ regime: 'easing_cycle', weight: 1, source: `${e.event_name}: softer CPI supports easing path`, type: 'calendar' });
      }
    }

    if (/nfp|payroll/.test(t)) {
      if (dir === 'hot') {
        signals.push({ regime: 'tightening_cycle', weight: 2, source: `${e.event_name}: strong labor sustains restrictive stance`, type: 'calendar' });
        signals.push({ regime: 'risk_on', weight: 1, source: `${e.event_name}: strong jobs supports growth`, type: 'calendar' });
      } else if (dir === 'soft') {
        signals.push({ regime: 'recession_risk', weight: 2, source: `${e.event_name}: labor market softening`, type: 'calendar' });
        signals.push({ regime: 'easing_cycle', weight: 1, source: `${e.event_name}: soft jobs reinforces easing argument`, type: 'calendar' });
      }
    }

    if (/unemployment/.test(t)) {
      if (dir === 'hot') {
        signals.push({ regime: 'recession_risk', weight: 2, source: `${e.event_name}: unemployment rising`, type: 'calendar' });
      } else if (dir === 'soft') {
        signals.push({ regime: 'tightening_cycle', weight: 1, source: `${e.event_name}: unemployment falling — tight labor market`, type: 'calendar' });
      }
    }

    if (/gdp/.test(t)) {
      if (dir === 'hot') {
        signals.push({ regime: 'risk_on', weight: 2, source: `${e.event_name}: above-consensus GDP supports soft landing`, type: 'calendar' });
        signals.push({ regime: 'tightening_cycle', weight: 1, source: `${e.event_name}: strong growth may complicate easing path`, type: 'calendar' });
      } else if (dir === 'soft') {
        signals.push({ regime: 'recession_risk', weight: 2, source: `${e.event_name}: below-consensus GDP raises growth risk`, type: 'calendar' });
        signals.push({ regime: 'stagflation_risk', weight: 1, source: `${e.event_name}: growth weakness alongside elevated inflation`, type: 'calendar' });
      }
    }

    if (/ism|pmi/.test(t)) {
      if (actual < 50) {
        signals.push({ regime: 'recession_risk', weight: 1, source: `${e.event_name}: ISM/PMI below 50 (contraction territory)`, type: 'calendar' });
        signals.push({ regime: 'defensive_rotation', weight: 1, source: `${e.event_name}: manufacturing contraction signals rotation`, type: 'calendar' });
      }
    }

    if (/fomc|fed rate/.test(t)) {
      signals.push({ regime: 'tightening_cycle', weight: 1, source: `${e.event_name}: FOMC event in recent window`, type: 'calendar' });
    }
  }

  // ── Signals from narrative tones ────────────────────────────────────────────
  const releaseNarratives = narrative.release_narratives || [];
  let hawkishCount = 0;
  let dovishCount  = 0;
  for (const n of releaseNarratives) {
    if (n.policy_tone === 'hawkish_impulse') hawkishCount++;
    if (n.policy_tone === 'dovish_impulse')  dovishCount++;
  }

  if (hawkishCount >= 2) {
    signals.push({ regime: 'tightening_cycle', weight: 2, source: `${hawkishCount} hawkish macro surprises in recent window`, type: 'narrative' });
    signals.push({ regime: 'risk_off', weight: 1, source: 'Hawkish macro tone elevates rate risk', type: 'narrative' });
  }
  if (dovishCount >= 2) {
    signals.push({ regime: 'easing_cycle', weight: 2, source: `${dovishCount} dovish macro surprises in recent window`, type: 'narrative' });
    signals.push({ regime: 'risk_on', weight: 1, source: 'Dovish macro tone supports risk appetite', type: 'narrative' });
    signals.push({ regime: 'liquidity_expansion', weight: 1, source: 'Dovish tone suggests loosening financial conditions', type: 'narrative' });
  }

  // ── Signals from active themes ───────────────────────────────────────────────
  const themes = narrative.active_themes || [];
  if (themes.includes('rate_path_recalibration')) {
    signals.push({ regime: 'tightening_cycle', weight: 1, source: 'Active theme: rate path recalibration', type: 'theme' });
  }
  if (themes.includes('inflation_data_focus')) {
    signals.push({ regime: 'tightening_cycle', weight: 1, source: 'Active theme: inflation data focus', type: 'theme' });
  }
  if (themes.includes('labor_market_evolution') && dovishCount > hawkishCount) {
    signals.push({ regime: 'easing_cycle', weight: 1, source: 'Active theme: labor market evolution (dovish context)', type: 'theme' });
  }
  if (themes.includes('safe_haven_demand')) {
    signals.push({ regime: 'risk_off', weight: 2, source: 'Active theme: safe haven demand', type: 'theme' });
    signals.push({ regime: 'defensive_rotation', weight: 1, source: 'Active theme: safe haven demand', type: 'theme' });
  }
  if (themes.includes('growth_risk_monitor')) {
    signals.push({ regime: 'recession_risk', weight: 1, source: 'Active theme: growth risk under watch', type: 'theme' });
    signals.push({ regime: 'defensive_rotation', weight: 1, source: 'Active theme: growth risk monitor', type: 'theme' });
  }

  // ── Signals from live market state (if available) ───────────────────────────
  if (live?.metadata?.status === 'live') {
    const prices = live.prices || {};
    const vix = prices.VIX?.price || prices['VIX']?.price;
    const spy = prices.SPY?.change_pct;
    const gld = prices.GLD?.change_pct;
    const tlt = prices.TLT?.change_pct;

    if (Number.isFinite(vix)) {
      if (vix > 25) {
        signals.push({ regime: 'risk_off', weight: 3, source: `VIX elevated (${vix.toFixed(1)}) — fear premium elevated`, type: 'live' });
        signals.push({ regime: 'defensive_rotation', weight: 2, source: `VIX > 25 triggers defensive rotation dynamics`, type: 'live' });
      } else if (vix < 16) {
        signals.push({ regime: 'risk_on', weight: 2, source: `VIX subdued (${vix.toFixed(1)}) — complacency or genuine low-risk environment`, type: 'live' });
        signals.push({ regime: 'liquidity_expansion', weight: 1, source: `Low VIX consistent with ample liquidity conditions`, type: 'live' });
      }
    }

    if (Number.isFinite(spy)) {
      if (spy > 0.5) {
        signals.push({ regime: 'risk_on', weight: 1, source: `SPY advancing (+${spy.toFixed(2)}%)`, type: 'live' });
      } else if (spy < -0.5) {
        signals.push({ regime: 'risk_off', weight: 1, source: `SPY declining (${spy.toFixed(2)}%)`, type: 'live' });
      }
    }

    if (Number.isFinite(gld) && gld > 0.5) {
      signals.push({ regime: 'risk_off', weight: 1, source: `Gold advancing — hedge demand active`, type: 'live' });
    }
    if (Number.isFinite(tlt) && tlt > 0.5) {
      signals.push({ regime: 'risk_off', weight: 1, source: `TLT advancing — flight to duration/safety`, type: 'live' });
      signals.push({ regime: 'easing_cycle', weight: 1, source: `Bond rally consistent with rate-cut expectation building`, type: 'live' });
    }
  }

  return signals;
}

// ── Regime scoring ────────────────────────────────────────────────────────────

function scoreRegimes(signals) {
  const scores = {};
  for (const r of Object.keys(REGIME_DEFS)) scores[r] = 0;
  for (const sig of signals) {
    if (scores[sig.regime] !== undefined) {
      scores[sig.regime] += sig.weight;
    }
  }
  return scores;
}

function pickWinner(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [regime, score] = sorted[0];
  const total = Object.values(scores).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return { regime: 'unverified', score: 0, confidence: 0, secondary: null, allScores: scores };
  }
  const confidence = total > 0 ? Math.min(0.95, score / total) : 0.5;
  const secondary = sorted[1][1] > 0 ? sorted[1][0] : null;
  return { regime, score, confidence, secondary, allScores: scores };
}

// ── Output builder ────────────────────────────────────────────────────────────

function buildOutput(winner, scores, signals, narrative, live) {
  if (winner.regime === 'unverified') {
    return {
      version: '1.0',
      detected_at: new Date().toISOString(),
      data_quality: 'insufficient',
      regime: 'unverified',
      regime_label: 'Unverified',
      confidence: 0,
      secondary_regime: null,
      regime_stability: 'unverified',
      supporting_signals: [],
      contradictory_signals: [],
      regime_summary: 'Available live-market and economic-event inputs are insufficient to classify the current macro regime. Scenario frameworks remain conditional until data-backed confirmation is available.',
      implications: {},
      signal_count: 0
    };
  }
  const supporting     = signals.filter((s) => s.regime === winner.regime).map((s) => s.source);
  const contradictory  = signals.filter((s) => s.regime !== winner.regime && scores[s.regime] > 0).slice(0, 4).map((s) => s.source);
  const dataQuality    = live?.metadata?.status === 'live' ? 'live' : signals.some((s) => s.type === 'calendar') ? 'calendar_based' : 'scenario';
  const def            = REGIME_DEFS[winner.regime] || {};

  return {
    version: '1.0',
    detected_at: new Date().toISOString(),
    data_quality: dataQuality,
    regime: winner.regime,
    regime_label: def.label || winner.regime,
    confidence: parseFloat(winner.confidence.toFixed(3)),
    secondary_regime: winner.secondary,
    regime_stability: winner.confidence > 0.6 ? 'established' : winner.confidence > 0.4 ? 'transitional' : 'contested',
    supporting_signals: supporting.slice(0, 5),
    contradictory_signals: contradictory.slice(0, 3),
    regime_summary: buildRegimeSummary(winner.regime, winner.confidence, winner.secondary),
    implications: buildImplications(winner.regime),
    signal_count: signals.length
  };
}

function buildRegimeSummary(regime, confidence, secondary) {
  const confStr = confidence > 0.65 ? 'with elevated confidence' : confidence > 0.45 ? 'with moderate confidence' : 'tentatively';
  const secondaryNote = secondary ? ` Secondary dynamics associated with ${REGIME_DEFS[secondary]?.label || secondary} are also present.` : '';

  const summaries = {
    tightening_cycle: `The macro environment resembles a late tightening cycle ${confStr}: inflation data has been running above consensus, labor market conditions remain resilient, and the Fed's forward guidance has sustained a higher-for-longer rate framework. Rate-sensitive assets — long-duration bonds, growth stocks, and commodities — face the continued headwind of elevated real yields.${secondaryNote}`,
    easing_cycle: `The macro regime has shifted toward an easing cycle ${confStr}: recent inflation data came in below consensus, the labor market is showing slack, and the Fed's reaction function has pivoted toward the growth mandate. Duration assets and rate-sensitive equities stand to benefit from the improving rate path.${secondaryNote}`,
    risk_on: `The current macro configuration supports a risk-on regime ${confStr}: growth expectations are intact, volatility is subdued, and cyclical assets are participating broadly. The macro backdrop is consistent with continued equity exposure across growth and value factors.${secondaryNote}`,
    risk_off: `The macro environment has shifted to risk-off ${confStr}: elevated volatility, flight to safety in bonds and gold, and reduced cyclical participation are the dominant signals. Defensive sectors and safe-haven assets are absorbing capital flows.${secondaryNote}`,
    stagflation_risk: `Stagflationary dynamics are emerging ${confStr}: inflation remains above target while growth is disappointing consensus expectations. The Fed faces a policy bind — further tightening would worsen growth, while easing risks reigniting inflation. Real assets and TIPS may outperform nominal bonds.${secondaryNote}`,
    disinflation: `A disinflationary regime is the current base case ${confStr}: sequential CPI/PCE softening suggests the final mile toward target is progressing, supporting the soft-landing narrative. Rate-cut expectations may firm, benefiting duration assets without requiring a growth shock to trigger easing.${secondaryNote}`,
    recession_risk: `Recession risk is elevating ${confStr}: labor market softening, below-consensus activity data, and sustained ISM readings in contraction territory are aligning. The yield curve inversion pattern is consistent with historical pre-recession configurations, though the timing of the transition remains uncertain.${secondaryNote}`,
    liquidity_expansion: `Liquidity conditions are expanding ${confStr}: financial conditions are loosening, credit spreads are tight, and risk assets are broadly bid. The backdrop favors continued equity exposure, particularly in sectors with high earnings sensitivity and moderate balance sheet leverage.${secondaryNote}`,
    defensive_rotation: `A defensive rotation is underway ${confStr}: capital is shifting from cyclical and growth sectors toward utilities, consumer staples, and healthcare. This pattern is consistent with late-cycle positioning or an elevated near-term risk premium rather than a full risk-off episode.${secondaryNote}`
  };

  return summaries[regime] || `Current regime: ${regime}. Confidence: ${(confidence * 100).toFixed(0)}%.`;
}

function buildImplications(regime) {
  const impl = {
    tightening_cycle: {
      equities: 'Multiple compression risk for high-valuation growth stocks. Value and quality factors may outperform. Financials can benefit from net interest margin expansion.',
      rates: 'Short-end yields remain elevated. Long-end curve behavior depends on growth expectations. Duration assets (TLT) remain under structural pressure.',
      gold: 'Elevated real yields act as an opportunity cost headwind for gold unless geopolitical hedge demand is elevated.',
      dollar: 'Higher-for-longer Fed policy supports DXY strength relative to G10 peers pursuing easing. EM currencies under pressure.',
      volatility: 'VIX likely to remain above structural floor. Vol spikes around each macro release as markets reprice the terminal rate.'
    },
    easing_cycle: {
      equities: 'Re-rating opportunity for long-duration growth assets. Small caps (IWM) can benefit from cheaper financing. Quality earnings less penalized by discounting.',
      rates: 'Front-end rates lead the move lower. Bull steepening pattern typical — short-end falls faster than long-end. TLT can rally.',
      gold: 'Falling real yields reduce gold opportunity cost. Weakening dollar provides additional upside catalyst. Gold historically performs well in early easing cycles.',
      dollar: 'Fed easing relative to global peers weakens DXY. EM carry trade revives. Commodity currencies benefit.',
      volatility: 'VIX tends to compress in early easing cycles as policy uncertainty resolves. However, if easing is recession-driven, vol remains elevated.'
    },
    risk_on: {
      equities: 'Broad equity participation. Cyclicals (XLF, XLE, IWM) leading. Growth (QQQ) contributing. Defensive underperformance is confirmation of genuine risk appetite.',
      rates: 'Rates stable to slightly higher on growth optimism. Curve may steepen mildly. TLT underperforms equities.',
      gold: 'Gold may lag as real assets and equities compete for capital. Safe-haven premium compresses.',
      dollar: 'Mixed — growth supports USD, but risk-on appetite can weaken safe-haven flows. Net effect depends on relative growth differentials.',
      volatility: 'VIX trending toward or below 15. Credit spreads tight. Risk-on regimes can sustain low vol for extended periods.'
    },
    risk_off: {
      equities: 'Defensive sectors (XLU, XLP, XLV) outperform. Growth and cyclicals under pressure. SMID underperforms mega-cap. Flight to quality within equities.',
      rates: 'Bull flattening or bull steepening as investors bid Treasuries. TLT potentially significant outperformer.',
      gold: 'Gold benefits as a dual hedge — against both equity risk and dollar weakness. Historically outperforms in risk-off unless the trigger is a growth shock.',
      dollar: 'DXY typically strengthens in acute risk-off (EM selling, liquidity demand). In prolonged risk-off driven by US-specific stress, dollar may weaken.',
      volatility: 'VIX elevated (>20). Vol term structure in backwardation. Hedging demand elevated. Tail risk protection expensive.'
    },
    stagflation_risk: {
      equities: 'Margin pressure from elevated input costs without pricing power. Nominal earnings can mask real return erosion. Energy and materials may outperform nominal.',
      rates: 'Policy bind: rates cannot fall due to inflation, but cannot rise without crushing growth. Curve may flatten or invert further. TIPS outperform nominal bonds.',
      gold: 'Gold historically one of the best-performing assets in stagflationary environments — benefits from both inflation protection and rate policy ambiguity.',
      dollar: 'Ambiguous — inflation favors dollar weakness vs commodities, but policy uncertainty may support dollar vs EM. Net depends on relative stagflation differentials.',
      volatility: 'VIX structurally elevated. Market unable to price a clear resolution path. Realized vol above implied — hedging inefficient.'
    },
    disinflation: {
      equities: 'Soft landing conditions are constructive for equities. Growth stocks benefit from lower discount rates. Value and quality both viable — sector agnostic.',
      rates: 'Real yields stabilize as nominal yields fall with inflation expectations. Gradual bull steepening. Duration assets see moderate upside.',
      gold: 'Benign for gold — inflation protection premium falls, but rate cut expectations provide modest support. Gold likely range-bound to mildly positive.',
      dollar: 'DXY may weaken modestly as rate differentials narrow. Not a sharp move unless growth significantly underperforms.',
      volatility: 'VIX compresses toward structural lows. Soft landing narrative reduces tail risk pricing. Realized vol likely falls below implied.'
    },
    recession_risk: {
      equities: 'Defensive sectors significantly outperform. IWM (small cap) typically leads declines due to financing sensitivity. Earnings revision cycle negatively inflects.',
      rates: 'Bull steepening as front-end falls faster than long-end on rate-cut expectations. Long-end may face competing pressure from deficit concerns.',
      gold: 'Gold outperforms in recessions driven by financial stress and Fed easing. If recession is supply-driven, gold response more muted.',
      dollar: 'Dollar typically strengthens initially in recession (liquidity demand) then weakens as Fed cuts. Trajectory depends on whether US leads or lags global slowdown.',
      volatility: 'VIX elevated and sustained. Vol surface shifts structurally higher. Recession regimes typically exhibit the highest sustained realized vol.'
    },
    liquidity_expansion: {
      equities: 'Broad-based equity participation. Leverage and momentum factors work well. Small caps and microcaps outperform as financing conditions ease.',
      rates: 'Short-end rates fall on liquidity injection. Long-end stable. Yield curve steepens. Carry trades revive.',
      gold: 'Gold benefits from dollar weakness and monetary expansion. Bitcoin and real assets also benefit in liquidity expansion environments.',
      dollar: 'DXY tends to weaken as liquidity injection reduces dollar scarcity. EM currencies and commodity-linked FX benefit.',
      volatility: 'VIX falls sharply. Liquidity expansion suppresses volatility across all assets. Structured products and short-vol strategies perform well.'
    },
    defensive_rotation: {
      equities: 'XLU, XLP, XLV outperforming XLK, XLY, XLF. IWM underperforming SPY. Mega-cap quality names providing relative stability.',
      rates: 'Mild bond rally as investors position for potential Fed support. 10Y yield may retrace recent highs. TLT stabilizes.',
      gold: 'Gold benefits as a macro hedge alongside defensive equities. The rotation pattern is consistent with late-cycle risk awareness.',
      dollar: 'Dollar may strengthen modestly as investors exit EM carry and position for risk-off. Not a sharp move in defensive rotation absent a macro shock.',
      volatility: 'VIX elevated in the 18-25 range. Not extreme, but above the structural floor. Defensive rotation is consistent with pre-shock vol levels.'
    }
  };

  return impl[regime] || {
    equities: 'Monitor sector rotation signals for positioning guidance.',
    rates: 'Yield curve and Fed communication are the primary rate signals.',
    gold: 'Gold behavior depends on the interaction of real yields and risk appetite.',
    dollar: 'Dollar direction depends on relative policy divergence and global risk appetite.',
    volatility: 'Monitor VIX levels and term structure for regime transition signals.'
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main();
