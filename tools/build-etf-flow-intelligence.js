'use strict';

// Phase 62: ETF Flow + Positioning Intelligence Engine
// Generates institutional ETF interpretation covering allocation structure,
// macro sensitivity, positioning dynamics, and regime-aware analysis.
//
// Coverage: SPY, QQQ, DIA, IWM, XLV, XLE, XLF, XLU, XLP, GLD, TLT, UUP, SOXX
//
// Reads:
//   data/intelligence/market-regime.json
//   data/intelligence/rate-path-intelligence.json (if available)
//   data/live-market-state.json
//
// Output: data/intelligence/etf-flow-intelligence.json
//
// Usage:
//   node tools/build-etf-flow-intelligence.js           → dry run
//   node tools/build-etf-flow-intelligence.js --write   → write output

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const REGIME_PATH   = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const RATE_PATH     = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const OUT_PATH      = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');

const WRITE = process.argv.includes('--write');

// ── ETF Institutional Profile Library ────────────────────────────────────────

const ETF_PROFILES = {
  SPY: {
    full_name: 'SPDR S&P 500 ETF Trust',
    index: 'S&P 500',
    category: 'broad_market',
    aum_tier: 'mega',
    characteristics: {
      mega_cap_concentration: 'high',
      top10_weight_est_pct: 32,
      earnings_sensitivity: 'high',
      rate_sensitivity: 'moderate',
      duration_exposure: 'moderate',
      defensiveness: 'moderate',
      cyclicality: 'moderate_high',
      liquidity_tier: 'extremely_high',
      sector_concentration_risk: 'moderate'
    },
    sector_tilt: 'Technology-heavy due to market-cap weighting; ~29% tech sector as of 2025. Healthcare, financials, and consumer discretionary form secondary weights.',
    idiosyncratic_risks: 'Mega-cap concentration in 7-8 names (Mag-7 + 1) means SPY is disproportionately exposed to regulatory risk, AI capex cycles, and earnings disappointment in a handful of companies. A 1% drawdown in the top 5 positions equals ~0.3% SPY impact.',
    rate_transmission: 'Moderate rate sensitivity — financial sector (XLF ~13%) benefits from elevated short rates, while tech (~29%) suffers from discount rate pressure. Net sensitivity is moderate-negative in rising rate environments.',
    regime_profile: {
      risk_on: 'Participates broadly; cyclical sectors (XLF, XLE, XLY) contribute positively',
      risk_off: 'Defensive holdings (XLV, XLP, XLU ~18%) provide partial buffer; still underperforms TLT and GLD in acute risk-off',
      tightening_cycle: 'Neutral-to-negative on multiple; earnings growth can offset multiple compression if margins hold',
      easing_cycle: 'Positive — both multiple expansion and financial conditions easing support broad index',
      recession_risk: 'Underperforms significantly; earnings revision cycle is the dominant headwind',
      stagflation_risk: 'Challenged — margins compress from input costs while growth headwinds hit revenue estimates'
    },
    institutional_interpretation: 'SPY is the canonical beta exposure to the US equity market. Its value as an analytical unit is in identifying when active sector rotation is occurring — when SPY diverges significantly from its sector components, it signals breadth deterioration or sector-specific distortion. Institutional investors use SPY as the baseline against which to measure XLV/XLK/XLE/IWM spread trades.',
    comparison_note: 'Compared to IWM (small cap), SPY\'s mega-cap bias means it is less sensitive to domestic financing conditions but more exposed to global earnings cycles and regulatory risk. Compared to QQQ, SPY\'s broader sector diversification reduces concentration risk but also reduces upside in technology-led rallies.'
  },

  QQQ: {
    full_name: 'Invesco QQQ Trust',
    index: 'Nasdaq-100',
    category: 'large_cap_growth',
    aum_tier: 'mega',
    characteristics: {
      mega_cap_concentration: 'very_high',
      top10_weight_est_pct: 48,
      earnings_sensitivity: 'very_high',
      rate_sensitivity: 'high',
      duration_exposure: 'high',
      defensiveness: 'low',
      cyclicality: 'high',
      liquidity_tier: 'extremely_high',
      sector_concentration_risk: 'high'
    },
    sector_tilt: 'Technology ~58%, Communication Services ~16%. Healthcare ~6% is the largest non-tech allocation. Energy and Utilities effectively absent.',
    idiosyncratic_risks: 'MSFT, AAPL, NVDA, and AMZN collectively represent ~40% of QQQ. An earnings miss or regulatory action affecting any one of these names has material index-level impact. AI capex cycle sustainability is the dominant forward risk.',
    rate_transmission: 'High negative rate sensitivity — QQQ is a long-duration asset disguised as an equity. Its cash flows are heavily weighted toward 2027+ earnings (AI infrastructure monetization, SaaS scaling). A 50bp rise in the risk-free rate compresses QQQ\'s intrinsic value by 8-12% in a DCF framework assuming 15% terminal growth.',
    regime_profile: {
      risk_on: 'Significantly outperforms in genuine risk-on; momentum and growth factor alignment is strongest here',
      risk_off: 'Underperforms materially; high-beta and long-duration characteristics are dual headwinds',
      tightening_cycle: 'Structurally challenged — every 25bp of additional tightening is a headwind to the sector\'s embedded multiple',
      easing_cycle: 'Most direct beneficiary of rate relief among major index ETFs',
      recession_risk: 'Depends on earnings durability; cloud/SaaS subscription revenues more resilient than hardware/advertising in recessions',
      disinflation: 'Outperforms — falling rate pressure combined with intact growth thesis is ideal for QQQ'
    },
    institutional_interpretation: 'QQQ\'s analytical value is as a duration proxy for the equity market. When QQQ significantly underperforms SPY, it typically signals either: (1) rate headwinds increasing, (2) growth premium being questioned, or (3) mega-cap earnings cycle at risk. QQQ/SPY spread is a real-time sentiment indicator for the growth vs. value debate.',
    comparison_note: 'QQQ\'s concentration in technology introduces idiosyncratic earnings risk that differs materially from IVW (iShares S&P 500 Growth) or VUG. QQQ\'s zero utilities and minimal healthcare exposure means it has essentially no defensive buffer in risk-off environments — a characteristic often overlooked when using QQQ as a portfolio proxy for "the market."'
  },

  IWM: {
    full_name: 'iShares Russell 2000 ETF',
    index: 'Russell 2000',
    category: 'small_cap',
    aum_tier: 'large',
    characteristics: {
      mega_cap_concentration: 'none',
      top10_weight_est_pct: 4,
      earnings_sensitivity: 'very_high',
      rate_sensitivity: 'very_high',
      duration_exposure: 'low_equity_high_debt',
      defensiveness: 'low',
      cyclicality: 'very_high',
      liquidity_tier: 'high',
      sector_concentration_risk: 'low'
    },
    sector_tilt: 'Financials ~16%, Industrials ~15%, Healthcare ~16%, Information Technology ~14%. More balanced than SPY/QQQ but no single mega-cap dominance.',
    idiosyncratic_risks: 'Approximately 40% of Russell 2000 companies are unprofitable. Small caps carry disproportionate floating-rate debt — when short-term rates rise, debt service costs increase directly. In a credit contraction, small caps face both revenue risk and refinancing risk simultaneously.',
    rate_transmission: 'Very high rate sensitivity via the debt channel, not the equity duration channel. Unlike QQQ (discount rate sensitivity), IWM is sensitive because its constituent companies actually borrow at short rates. A 100bp rate rise can reduce IWM earnings by 3-5% through higher interest expense alone.',
    regime_profile: {
      risk_on: 'Outperforms significantly in genuine risk-on with liquidity expansion; IWM/SPY spread widening is a confirming signal of breadth',
      risk_off: 'Worst-performing major index ETF in risk-off; highest beta, highest credit sensitivity',
      tightening_cycle: 'Significant headwind — financing cost sensitivity compounds valuation pressure',
      easing_cycle: 'Major beneficiary — lower financing costs directly improve earnings for the ~40% of unprofitable small caps',
      recession_risk: 'Severely impacted — first to see credit tightening, revenue decline, and earnings revisions',
      liquidity_expansion: 'Best positioned — financing condition improvement is most direct in small caps'
    },
    institutional_interpretation: 'IWM functions as a leverage indicator for the equity market. When IWM significantly underperforms SPY for 3+ weeks, it historically precedes broader market weakness by signaling deteriorating financial conditions in the less-capitalized segment of the economy. IWM participation in a rally is required for confirmation that the move is fundamentally-driven rather than mega-cap rotation.',
    comparison_note: 'IWM\'s high-yield and financial sector exposure means its behavior differs systematically from SPY even when tracking the same nominal market direction. An SPY+IWM convergence trade is more sensitive to credit cycle dynamics than to macro data.'
  },

  XLV: {
    full_name: 'Health Care Select Sector SPDR Fund',
    index: 'S&P 500 Health Care Sector',
    category: 'sector_defensive',
    aum_tier: 'large',
    characteristics: {
      mega_cap_concentration: 'moderate',
      top10_weight_est_pct: 52,
      earnings_sensitivity: 'moderate',
      rate_sensitivity: 'low_to_moderate',
      duration_exposure: 'moderate',
      defensiveness: 'high',
      cyclicality: 'low',
      liquidity_tier: 'high',
      sector_concentration_risk: 'moderate'
    },
    sector_tilt: 'Pharmaceuticals ~28%, Healthcare Services ~22% (incl. UnitedHealth ~9%), Biotechnology ~17%, Medical Devices ~16%. High intra-sector dispersion in earnings drivers.',
    idiosyncratic_risks: 'XLV\'s concentration in UnitedHealth (~9%) and Eli Lilly (~9%) introduces idiosyncratic earnings sensitivity that differs materially from VHT (Vanguard Health Care ETF) which has a broader healthcare allocation structure. Drug pricing legislation, FDA approval cycles, and managed care regulatory changes are the primary non-market risks.',
    rate_transmission: 'Healthcare is less rate-sensitive than utilities — revenues are relatively inelastic and not debt-financed to the same degree. The primary rate channel is through the healthcare services sub-industry, which has meaningful debt loads. Pharma and biotech are more sensitive to equity financing conditions (secondary offerings, M&A deal financing).',
    regime_profile: {
      risk_on: 'Typically lags cyclicals in genuine risk-on; rotation out of defensives can create a headwind',
      risk_off: 'Outperforms in risk-off due to inelastic demand for healthcare services; recession-resistant revenue streams',
      tightening_cycle: 'Neutral — limited rate sensitivity, but managed care profitability faces headwinds from rising labor costs',
      easing_cycle: 'Modest tailwind — primarily through biotech multiple expansion and M&A activity financing',
      recession_risk: 'Historically one of the most defensive sectors; healthcare spending is the last to be cut'
    },
    institutional_interpretation: 'XLV is a tactical defensive allocation tool. The key analytical distinction is between its pharmaceutical and managed care sub-sectors — pharma (GLP-1 drug cycle, patent cliffs) is growth-like while managed care (UNH, CVS) is quasi-utility. Investors treating XLV as a monolithic defensive are missing the intra-sector dispersion that drives performance during earnings seasons.',
    comparison_note: 'XLV vs VHT: XLV\'s concentration in top 10 holdings (~52%) vs VHT\'s broader 500+ holdings creates materially different single-stock risk profiles. XLV\'s large-cap bias means lower pharmaceutical development risk but higher managed care regulatory exposure.'
  },

  TLT: {
    full_name: 'iShares 20+ Year Treasury Bond ETF',
    index: '20+ Year US Treasury Bond Index',
    category: 'long_duration_government_bond',
    aum_tier: 'large',
    characteristics: {
      mega_cap_concentration: 'n/a',
      top10_weight_est_pct: 35,
      earnings_sensitivity: 'none',
      rate_sensitivity: 'very_high',
      duration_exposure: 'very_high',
      defensiveness: 'high_in_equity_risk_off',
      cyclicality: 'inverse',
      liquidity_tier: 'very_high',
      sector_concentration_risk: 'n/a'
    },
    sector_tilt: 'US government bonds with 20+ year maturities. Interest rate duration of ~17-18 years. No sector exposure — pure rate and credit-risk-free instrument.',
    idiosyncratic_risks: 'TLT\'s extreme duration makes it a non-linear rate instrument. A 100bp rise in 20Y yields produces approximately 17% price decline. Supply dynamics (Treasury auction size, deficit financing needs) and term premium shifts are independent risk factors not captured by Fed rate expectations alone.',
    rate_transmission: 'TLT IS the rate transmission — it doesn\'t have a "rate sensitivity," it IS rate sensitivity in its most concentrated form. The 20Y-30Y portion of the curve is primarily driven by: term premium (inflation uncertainty), long-run growth expectations, and fiscal sustainability concerns. Fed rate changes transmit imperfectly to TLT — short-rate cuts often produce a bull steepening that benefits the front end more than TLT.',
    regime_profile: {
      risk_on: 'Typically underperforms — capital rotates from bonds to equities in risk-on environments',
      risk_off: 'Outperforms significantly — classic flight to safety; correlation with equities flips negative in acute risk-off',
      tightening_cycle: 'Structurally challenged — Fed hikes may be priced but term premium can expand independently',
      easing_cycle: 'Major beneficiary — particularly in early easing cycle when bull steepening begins',
      recession_risk: 'Outperforms — recession = easing + safety demand; dual support',
      stagflation_risk: 'Severely impacted — inflation erodes real returns while growth collapse suppresses risk demand for TLT'
    },
    institutional_interpretation: 'TLT is the market\'s primary risk-off lever in the equity investor\'s toolkit. Its bond-equity correlation is the most important structural relationship to monitor: when bonds and equities both sell off simultaneously (positive correlation), it signals a liquidity/inflation shock rather than growth fear — a regime change signal that fundamentally changes portfolio construction.',
    comparison_note: 'TLT vs IEF (7-10yr) vs SHY (1-3yr): Duration extension creates non-linear return profiles. In a 50bp rate decline, TLT gains ~8.5%, IEF gains ~4%, SHY gains ~1.5%. Conversely, TLT is the most volatile bond ETF in periods of rate uncertainty.'
  },

  GLD: {
    full_name: 'SPDR Gold Shares',
    category: 'commodity_precious_metal',
    aum_tier: 'large',
    characteristics: {
      earnings_sensitivity: 'none',
      rate_sensitivity: 'high_inverse',
      duration_exposure: 'infinite_no_cashflow',
      defensiveness: 'high',
      cyclicality: 'low',
      liquidity_tier: 'very_high'
    },
    sector_tilt: 'Pure physical gold exposure. No leverage, no mining operational risk. Price tracks spot gold less management fee.',
    idiosyncratic_risks: 'GLD has no earnings — its entire return profile is driven by the interplay of: (1) real yields (opportunity cost), (2) DXY (USD pricing inverse), (3) geopolitical/macro fear premium, (4) central bank demand (structural buyer over 2022-2025), (5) inflation expectations. Predicting GLD requires correctly forecasting all five simultaneously.',
    rate_transmission: 'Gold\'s rate transmission is through real yields (nominal yield minus inflation breakeven). When real yields rise, gold\'s zero-yield becomes relatively expensive to hold. When real yields fall, gold gains relative attractiveness. The DXY overlay adds a second channel — dollar strength forces gold lower in USD terms even if local-currency gold is stable.',
    regime_profile: {
      tightening_cycle: 'Headwind — rising real yields are the primary mechanism. Historical exception: 2022 when geopolitical demand offset rate pressure partially',
      easing_cycle: 'Tailwind — falling real yields + dollar weakness; historically gold performs well in early-to-mid easing cycles',
      risk_off: 'Outperforms — macro hedge premium activates; both real yield fall and haven demand drive price',
      stagflation_risk: 'Historically gold\'s best environment — inflation protection + policy bind reduces real yield headwind',
      risk_on: 'Underperforms — haven premium compresses; opportunity cost rises as equity alternatives improve',
      recession_risk: 'Complex — benefits from rate easing and haven demand, but broad commodity demand destruction partially offsets'
    },
    institutional_interpretation: 'GLD is simultaneously an inflation hedge, a currency debasement hedge, a geopolitical risk proxy, and a real-yield inverse trade. Its multi-factor nature means that correctly interpreting a GLD move requires decomposing which factor is driving the price. A GLD rally alongside DXY strength and rising yields is a geopolitical/systemic risk signal — fundamentally different from a GLD rally on falling real yields alone.',
    comparison_note: 'GLD vs IAU: Near-identical exposure, IAU has a slightly lower expense ratio. The choice is liquidity (GLD) vs cost optimization (IAU). GLD vs GDX (miners): Mining stocks amplify gold price moves (3-5x leverage effect) but introduce operational, labor, and energy cost risks that GLD does not have.'
  },

  SOXX: {
    full_name: 'iShares Semiconductor ETF',
    index: 'ICE Semiconductor Index',
    category: 'sector_technology_subsector',
    aum_tier: 'large',
    characteristics: {
      mega_cap_concentration: 'high',
      top10_weight_est_pct: 56,
      earnings_sensitivity: 'very_high',
      rate_sensitivity: 'high',
      duration_exposure: 'high',
      defensiveness: 'very_low',
      cyclicality: 'very_high',
      liquidity_tier: 'high',
      sector_concentration_risk: 'high'
    },
    sector_tilt: 'NVDA ~23%, AVGO ~8%, AMD ~5%, QCOM ~4%, TXN ~4%. Concentration in AI-infrastructure beneficiaries (NVDA, AVGO) plus legacy semiconductor cycle (TXN, QCOM, INTC).',
    idiosyncratic_risks: 'SOXX\'s NVDA concentration means it is effectively a leveraged AI infrastructure play with semiconductor cycle exposure as secondary driver. A 5% NVDA earnings miss creates approximately 1.1% direct SOXX impact before beta effects. The semiconductor inventory cycle (12-18 month duration) introduces non-market timing risk.',
    rate_transmission: 'Very high rate sensitivity through both the equity duration channel (long-horizon cash flows for AI semiconductor demand) and the enterprise capex channel (AI infrastructure investment is sensitive to cost of capital). When rates rise, hyperscaler AI capex growth slows, which is a direct negative for SOXX earnings.',
    regime_profile: {
      risk_on: 'Outperforms significantly — highest cyclical beta in the ETF universe among large, liquid products',
      risk_off: 'Most exposed major sector ETF; inventory cycle deterioration + rate headwind + growth concern compound',
      tightening_cycle: 'Significant challenge — both rate channel (valuation) and growth channel (enterprise capex) transmit negatively',
      easing_cycle: 'Major beneficiary — dual support from lower discount rates and recovering capex cycles',
      recession_risk: 'Severely impacted; semiconductor inventory cycles typically last 12-18 months into recession and are severe in magnitude',
      disinflation: 'Positive — stable growth + easing rate pressure allows semiconductor cycle recovery without inflation headwinds'
    },
    institutional_interpretation: 'SOXX is the highest-information semiconductor allocation in the ETF universe. The NVDA concentration vs the legacy semiconductor diversification creates a dual-beta product: AI infrastructure growth beta (NVDA/AVGO) stacked on top of traditional semiconductor cycle beta (TXN/QCOM). These two betas often diverge — identifying which is driving SOXX performance at a given time is essential for interpretation.',
    comparison_note: 'SOXX vs SMH (VanEck Semiconductor ETF): SOXX is cap-weighted with NVDA cap constrained at 20% at rebalance; SMH is modified market-cap with NVDA and TSMC often the top positions. SOXX\'s construction makes it slightly more diversified; SMH provides higher NVDA exposure if that is the desired unit. Neither product is passive in the traditional sense given concentration constraints.'
  }
};

// Add lighter profiles for remaining tickers
const LIGHT_PROFILES = {
  DIA: {
    full_name: 'SPDR Dow Jones Industrial Average ETF Trust',
    category: 'large_cap_value_industrial',
    interpretation: 'DIA\'s price-weighted construction overweights high-share-price stocks (Goldman Sachs, UnitedHealth) rather than high-market-cap ones. This creates a significant financial and healthcare tilt relative to SPY, making DIA more sensitive to NIM expansion (rate environment) and healthcare policy than would be implied by its "Dow Jones" label.',
    regime_note: 'DIA typically outperforms SPY in tightening cycles (financial sector overweight) and underperforms in AI/tech rallies (low tech concentration). DIA/QQQ spread is a real-time indicator of the value vs. growth regime.'
  },
  XLE: {
    full_name: 'Energy Select Sector SPDR Fund',
    category: 'sector_energy',
    interpretation: 'XLE\'s performance is primarily driven by crude oil and natural gas prices, which themselves are driven by: global demand expectations, OPEC+ supply policy, and USD strength. The equity layer (E&P companies, refiners, services) adds leverage to commodity prices and introduces operational and capex cycle risk.',
    regime_note: 'XLE outperforms in stagflation risk environments (energy inflation persistent) and in genuine risk-on with commodity demand. XLE underperforms in recessions (demand destruction) and in easing cycles (growth concerns suppress oil demand expectations).'
  },
  XLF: {
    full_name: 'Financial Select Sector SPDR Fund',
    category: 'sector_financials',
    interpretation: 'XLF captures: large banks (net interest margin, loan growth), insurance (investment portfolio yield), capital markets (deal activity), and payments (consumer spending). These sub-industries have very different rate sensitivities. Banks benefit from NIM expansion in tightening; capital markets improve in risk-on; payments are secular growth with modest cyclicality.',
    regime_note: 'XLF is one of the few sector ETFs that benefits unambiguously from rising rates (NIM expansion) — though a deeply inverted yield curve compresses NIM and is negative for banks specifically. XLF/SPY spread widening is a signal of financial sector rotation and often precedes credit cycle turns.'
  },
  XLU: {
    full_name: 'Utilities Select Sector SPDR Fund',
    category: 'sector_defensive_bond_proxy',
    interpretation: 'Utilities are bond proxies — they pay high dividends supported by regulated, inelastic revenue streams, but carry significant debt loads for infrastructure. When Treasury yields rise, XLU\'s dividend yield spread compresses, triggering capital rotation to bonds. The advent of AI data center power demand has introduced a growth catalyst for utilities that historically didn\'t exist.',
    regime_note: 'XLU is the most rate-sensitive sector ETF. A 50bp rise in 10Y yields typically creates a 4-7% headwind for XLU in the medium term. In risk-off regimes, XLU is a defensive safe haven within equities. AI power demand theme (2024-2025) created a hybrid growth/defensive profile that complicates traditional rate analysis.'
  },
  XLP: {
    full_name: 'Consumer Staples Select Sector SPDR Fund',
    category: 'sector_defensive',
    interpretation: 'Consumer staples provide defensive exposure with pricing power — companies can partially pass through inflation via price increases. The sector includes Procter & Gamble, Costco, Coca-Cola, PepsiCo, and Walmart. Demand is inelastic, dividends are reliable, and earnings are highly predictable.',
    regime_note: 'XLP outperforms in risk-off and recession-risk regimes but significantly lags in genuine risk-on when cyclicals lead. The sector\'s low beta (~0.55 vs SPY) makes it a dilution trade in a bull market but a meaningful hedge in drawdowns.'
  },
  UUP: {
    full_name: 'Invesco DB US Dollar Index Bullish Fund',
    category: 'currency_long_dollar',
    interpretation: 'UUP tracks the DXY basket (EUR 57.6%, JPY 13.6%, GBP 11.9%, CAD 9.1%, SEK 4.2%, CHF 3.6%). It provides direct long-dollar exposure without FX complexity. UUP gains when US rates are higher relative to G10 peers and when global risk appetite is risk-off (dollar safe haven flows).',
    regime_note: 'UUP is positively correlated with tightening cycle and risk-off regimes. In easing cycles, UUP underperforms as rate differentials compress. EM investors use UUP\'s direction as a leading indicator for EM equity and bond flows — DXY strength precedes EM outflows.'
  }
};

LIGHT_PROFILES.BND = {
  full_name: 'Vanguard Total Bond Market ETF',
  category: 'broad_investment_grade_bonds',
  characteristics: {
    mega_cap_concentration: 'not_applicable',
    top10_weight_est_pct: 8,
    rate_sensitivity: 'moderate',
    duration_exposure: 'intermediate',
    defensiveness: 'high',
    cyclicality: 'low',
    liquidity_tier: 'high'
  },
  interpretation: 'BND blends U.S. Treasuries, agency mortgage-backed securities, and investment-grade corporate bonds. Its broad construction dilutes issuer-specific credit risk, but it still carries meaningful duration and mortgage-extension risk when yields rise.',
  rate_transmission: 'The policy channel reaches BND through intermediate Treasury yields, mortgage prepayment assumptions, and corporate spreads. Falling yields generally support price returns, while widening credit spreads can offset part of that duration benefit.',
  comparison_note: 'BND vs IEF separates diversified aggregate-bond exposure from a cleaner Treasury-duration allocation. BND adds credit and mortgage channels; IEF isolates the 7-10 year Treasury segment more directly.',
  regime_note: 'BND is typically more resilient than long-duration Treasuries during moderate rate increases, but it can lag IEF when a growth shock produces a sharp Treasury rally.'
};

LIGHT_PROFILES.IEF = {
  full_name: 'iShares 7-10 Year Treasury Bond ETF',
  category: 'intermediate_treasury_duration',
  characteristics: {
    mega_cap_concentration: 'not_applicable',
    top10_weight_est_pct: 70,
    rate_sensitivity: 'high',
    duration_exposure: 'intermediate_to_long',
    defensiveness: 'high',
    cyclicality: 'very_low',
    liquidity_tier: 'high'
  },
  interpretation: 'IEF holds U.S. Treasuries concentrated in the 7-10 year maturity range. It removes most corporate-credit and mortgage-prepayment risk, making changes in real yields, inflation expectations, and term premium the dominant performance drivers.',
  rate_transmission: 'IEF responds directly to repricing in the intermediate Treasury curve. A dovish policy shift or weaker growth data can lower yields and support the fund, while inflation surprises and term-premium expansion create price pressure.',
  comparison_note: 'IEF vs TLT is primarily a duration comparison: IEF has lower interest-rate sensitivity and smaller price swings, while TLT provides a stronger response to large long-end yield moves.',
  regime_note: 'IEF can provide cleaner rate-path information than aggregate bond funds because credit-spread and mortgage effects are limited.'
};

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const regime = readJson(REGIME_PATH, { regime: 'unknown', confidence: 0.5 });
  const live   = readJson(LIVE_PATH,   { metadata: { status: 'fallback' } });

  const currentRegime = regime.regime || 'unknown';
  const etfProfiles = {};

  // Build full profiles
  for (const [ticker, profile] of Object.entries(ETF_PROFILES)) {
    etfProfiles[ticker] = {
      ...profile,
      regime_positioning: buildRegimePositioning(ticker, profile, currentRegime),
      current_signal: buildCurrentSignal(ticker, profile, currentRegime, live)
    };
  }

  // Add light profiles
  for (const [ticker, lp] of Object.entries(LIGHT_PROFILES)) {
    etfProfiles[ticker] = {
      ...lp,
      full_name: lp.full_name,
      category: lp.category,
      institutional_interpretation: lp.interpretation,
      regime_note: lp.regime_note,
      regime_positioning: buildLightRegimePositioning(ticker, lp, currentRegime),
      current_signal: null
    };
  }

  const output = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality: live?.metadata?.status === 'live' ? 'live' : 'scenario',
    regime_context: currentRegime,
    regime_confidence: regime.confidence || null,
    covered_etfs: Object.keys(etfProfiles),
    etf_profiles: etfProfiles,
    rotation_analysis: buildRotationAnalysis(currentRegime),
    positioning_matrix: buildPositioningMatrix(currentRegime)
  };

  if (!WRITE) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[etf-flow] wrote profiles for ${Object.keys(etfProfiles).length} ETFs in ${currentRegime} regime context`);
}

// ── Positioning builders ──────────────────────────────────────────────────────

function buildRegimePositioning(ticker, profile, regime) {
  const regimeView = profile.regime_profile?.[regime];
  const sensitivity = profile.characteristics?.rate_sensitivity || 'moderate';
  const defensiveness = profile.characteristics?.defensiveness || 'moderate';

  return {
    regime: regime,
    view: regimeView || 'neutral_to_regime',
    rate_sensitivity: sensitivity,
    defensiveness,
    tactical_note: buildTacticalNote(ticker, regime, regimeView)
  };
}

function buildLightRegimePositioning(ticker, profile, regime) {
  return {
    regime,
    view: 'see_institutional_interpretation',
    regime_note: profile.regime_note
  };
}

function buildTacticalNote(ticker, regime, view) {
  if (!view) return null;
  const notes = {
    'SPY_tightening_cycle': 'SPY\'s mixed sector composition means it is not a clean tightening-cycle hedge — overweight XLF and underweight XLU within SPY provides a more targeted tightening expression.',
    'QQQ_easing_cycle': 'QQQ is the highest-conviction beneficiary of an easing cycle among major index ETFs — duration extension in an easing environment provides both multiple expansion and momentum factor support.',
    'IWM_easing_cycle': 'IWM\'s financing cost sensitivity makes it the highest-beta beneficiary of near-term rate cuts, but the unprofitable-company proportion (~40%) means recovery requires confirmation in credit markets, not just equity markets.',
    'TLT_recession_risk': 'TLT is a double beneficiary in recession-risk scenarios — both flight-to-safety demand and easing expectations provide support. The key risk is term premium expansion (deficit concerns) that can offset the rate-cut benefit at the long end.',
    'GLD_stagflation_risk': 'Gold\'s historically strongest regime is stagflation — inflation protection + policy bind narrative. Real-yield compression in a stagflationary context reduces gold\'s opportunity cost even as nominal rates stay elevated.',
    'SOXX_tightening_cycle': 'SOXX faces a compound headwind in tightening cycles: equity duration compression (valuation channel) AND enterprise capex sensitivity (growth channel). Both transmission mechanisms work against SOXX simultaneously when rates are rising and AI capex growth is being questioned.'
  };
  return notes[`${ticker}_${regime}`] || null;
}

function buildCurrentSignal(ticker, profile, regime, live) {
  if (live?.metadata?.status !== 'live') return null;
  return {
    data_available: true,
    note: 'Live price data available — cross-reference with observed regime signals'
  };
}

function buildRotationAnalysis(regime) {
  const analyses = {
    tightening_cycle: {
      outperformers: ['XLF', 'XLE', 'XLP', 'UUP'],
      underperformers: ['TLT', 'XLU', 'SOXX', 'QQQ'],
      rotation_thesis: 'In tightening cycles, capital rotates from duration-sensitive assets (TLT, QQQ, XLU) toward rate beneficiaries (XLF NIM expansion) and inflation-linked assets (XLE). The rotation is most pronounced in the 3-12 months following the first rate hike.',
      key_spread: 'XLF/QQQ — financial vs growth relative performance is the cleanest tightening/easing cycle indicator'
    },
    easing_cycle: {
      outperformers: ['QQQ', 'IWM', 'TLT', 'GLD', 'SOXX'],
      underperformers: ['UUP', 'XLF (short-term)'],
      rotation_thesis: 'Easing cycles trigger a rotation into duration (TLT), long-growth (QQQ), and rate-sensitive small caps (IWM). Gold benefits from real yield compression and dollar weakness. The rotation leads equity bottoms by 3-6 months historically.',
      key_spread: 'IWM/SPY — when small caps begin outperforming large caps, easing expectations are being priced with conviction'
    },
    risk_on: {
      outperformers: ['SOXX', 'QQQ', 'IWM', 'XLY'],
      underperformers: ['TLT', 'GLD', 'XLU', 'XLP'],
      rotation_thesis: 'Risk-on regimes favor cyclical and growth exposures. The defensives (XLU, XLP, XLV) are typically sold in favor of technology and consumer cyclicals. Breadth must be confirmed — an SPY rally driven only by mega-cap is not a true risk-on rotation.',
      key_spread: 'SOXX/XLU — semiconductor vs utility relative performance is a real-time risk appetite gauge'
    },
    risk_off: {
      outperformers: ['TLT', 'GLD', 'XLU', 'XLP', 'XLV', 'UUP'],
      underperformers: ['SOXX', 'IWM', 'QQQ'],
      rotation_thesis: 'Risk-off regimes concentrate capital in haven assets and defensives. The speed of the move determines whether TLT or GLD leads — acute liquidity-driven selloffs favor UUP and TLT; sustained macro risk-off favors GLD as the hedge against policy response uncertainty.',
      key_spread: 'GLD/SPY — gold relative to equities is the cleanest risk-off barometer'
    },
    recession_risk: {
      outperformers: ['TLT', 'GLD', 'XLV', 'XLP', 'XLU'],
      underperformers: ['IWM', 'SOXX', 'XLE', 'XLF'],
      rotation_thesis: 'Recession-risk regimes front-load defense. Small caps (IWM) are the first to sell as financing concerns emerge. Semiconductors (SOXX) face the inventory cycle within the broader economic downturn. Defensive sectors and Treasuries absorb the capital.',
      key_spread: 'IWM/TLT — the widening gap between small cap performance and Treasury performance is the classic recession indicator'
    },
    stagflation_risk: {
      outperformers: ['GLD', 'XLE', 'XLP', 'TIPS (not covered, but reference)'],
      underperformers: ['TLT', 'QQQ', 'IWM'],
      rotation_thesis: 'Stagflation creates the most challenging rotation — traditional bonds fail (inflation destroys real returns) and growth equities fail (discount rate + earnings pressure). Real assets and energy are the primary beneficiaries. Gold outperforms both bonds and equities.',
      key_spread: 'GLD/TLT — gold outperforming Treasuries signals stagflationary dynamics vs benign recession'
    },
    disinflation: {
      outperformers: ['QQQ', 'TLT', 'SPY', 'XLV'],
      underperformers: ['XLE', 'UUP', 'GLD (modest)'],
      rotation_thesis: 'Disinflation is constructive for both bonds and growth equities. The soft-landing scenario — growth intact, inflation cooling — is the most asset-constructive macro backdrop. Broad participation with growth (QQQ) and duration (TLT) both advancing simultaneously is the confirming signal.',
      key_spread: 'QQQ/XLP — if growth outperforms staples in a falling-inflation environment, soft landing is being priced with conviction'
    },
    liquidity_expansion: {
      outperformers: ['IWM', 'SOXX', 'QQQ', 'GLD'],
      underperformers: ['UUP'],
      rotation_thesis: 'Liquidity expansion historically produces the broadest equity rally. IWM and SOXX show the strongest performance because financing conditions most directly benefit their underlying business models. GLD benefits from currency debasement concerns.',
      key_spread: 'IWM/SPY participation rate alongside breadth metrics (advancing/declining) confirms genuine liquidity expansion vs concentrated mega-cap rally'
    },
    defensive_rotation: {
      outperformers: ['XLV', 'XLP', 'XLU', 'GLD'],
      underperformers: ['SOXX', 'IWM', 'QQQ'],
      rotation_thesis: 'Defensive rotation is late-cycle positioning — investors are reducing risk but not yet full risk-off. The capital flows into dividend-paying defensive sectors, gold, and quality large-cap while exiting high-beta small cap and semiconductor names.',
      key_spread: 'XLU/SOXX — utilities vs semiconductors is the classic late-cycle rotation indicator'
    }
  };

  return analyses[regime] || {
    outperformers: [],
    underperformers: [],
    rotation_thesis: 'Regime not yet established — monitor macro data flow for rotation signals.',
    key_spread: null
  };
}

function buildPositioningMatrix(regime) {
  const overweight = (buildRotationAnalysis(regime).outperformers || []).slice(0, 5);
  const underweight = (buildRotationAnalysis(regime).underperformers || []).slice(0, 5);
  return {
    relative_strength_scenarios: overweight,
    relative_headwind_scenarios: underweight,
    regime,
    disclaimer: 'Relative-performance groupings are educational scenario frameworks based on historical regime analysis. They are not allocation recommendations.'
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main();
