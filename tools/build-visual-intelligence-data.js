'use strict';

/**
 * build-visual-intelligence-data.js — Phase 68 Part B
 *
 * Reads all intelligence sources and builds static JSON artifacts for
 * client-side dashboard rendering. No API keys or live fetches.
 *
 * Output: data/visual/
 *   regime-gauge.json
 *   sector-rotation-map.json
 *   cross-asset-impact-map.json
 *   yield-curve-context.json
 *   volatility-dashboard.json
 *   etf-relationship-map.json
 *
 * Usage: node tools/build-visual-intelligence-data.js [--write] [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PATHS = {
  regime:       path.join(ROOT, 'data', 'intelligence', 'regime-engine-v2.json'),
  context:      path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json'),
  status:       path.join(ROOT, 'data', 'system-status', 'market-intelligence-status.json'),
  ratePath:     path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json'),
  transmission: path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json'),
  etfFlow:      path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json'),
  memory:       path.join(ROOT, 'data', 'narrative-memory.json'),
  outDir:       path.join(ROOT, 'data', 'visual'),
};

const WRITE   = process.argv.includes('--write');
const DRY_RUN = process.argv.includes('--dry-run');

main();

function main() {
  const regime    = readJson(PATHS.regime,       { classifications: {}, summary: {}, data_quality: 'none' });
  const ctx       = readJson(PATHS.context,      {});
  const status    = readJson(PATHS.status,       {});
  const ratePath  = readJson(PATHS.ratePath,     {});
  const transmit  = readJson(PATHS.transmission, {});
  const etfFlow   = readJson(PATHS.etfFlow,      {});
  const memory    = readJson(PATHS.memory,       { snapshots: [] });

  const artifacts = {
    'regime-gauge.json':          buildRegimeGauge(regime, status),
    'sector-rotation-map.json':   buildSectorRotationMap(ctx, memory, status),
    'cross-asset-impact-map.json':buildCrossAssetMap(ctx, transmit, regime),
    'yield-curve-context.json':   buildYieldCurveContext(ctx, ratePath, regime),
    'volatility-dashboard.json':  buildVolatilityDashboard(ctx, regime),
    'etf-relationship-map.json':  buildEtfRelationshipMap(ctx, etfFlow, transmit),
  };

  if (WRITE && !DRY_RUN) {
    fs.mkdirSync(PATHS.outDir, { recursive: true });
    for (const [filename, data] of Object.entries(artifacts)) {
      const outPath = path.join(PATHS.outDir, filename);
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
      console.log(`[visual-intelligence-data] Written: data/visual/${filename}`);
    }
  } else {
    console.log('[visual-intelligence-data] Dry run — not written.');
    for (const [filename, data] of Object.entries(artifacts)) {
      console.log(`  ${filename}: data_quality=${data.data_quality}`);
    }
  }
}

// ── Regime gauge ──────────────────────────────────────────────────────────────

function buildRegimeGauge(regime, status) {
  const c   = regime.classifications || {};
  const now = new Date().toISOString();

  function gauge(dim, labelMap, min, max) {
    const cls   = c[dim] || {};
    const label = cls.label || 'uncertain';
    const conf  = cls.confidence || 0;
    const value = (labelMap[label] !== undefined) ? labelMap[label] : 50;
    return {
      label,
      label_ar: dim !== 'rate_path' ? (labelMap[`${label}_ar`] || label) : (labelMap[`${label}_ar`] || label),
      confidence: conf,
      value: Math.round(value),
      min, max,
      reason_en: cls.reason_en || '',
      reason_ar: cls.reason_ar || '',
      data_quality: cls.data_quality || regime.data_quality,
    };
  }

  const RISK_VALUES    = { risk_on: 80, neutral: 50, risk_off: 20, uncertain: 50,
                           risk_on_ar: 'إقبال على المخاطرة', neutral_ar: 'محايد', risk_off_ar: 'نفور من المخاطرة', uncertain_ar: 'غير مؤكد' };
  const VOL_VALUES     = { volatility_compression: 20, volatility_expansion: 80, uncertain: 50,
                           volatility_compression_ar: 'تقلب منخفض', volatility_expansion_ar: 'تقلب مرتفع', uncertain_ar: 'غير مؤكد' };
  const RATE_VALUES    = { rate_hike_bias: 85, hold_bias: 50, rate_cut_bias: 15, uncertain: 50,
                           rate_hike_bias_ar: 'تحيز للرفع', hold_bias_ar: 'ثبات', rate_cut_bias_ar: 'تحيز للخفض', uncertain_ar: 'غير مؤكد' };
  const GROWTH_VALUES  = { growth_resilience: 75, uncertain: 50, growth_slowdown: 25,
                           growth_resilience_ar: 'مرونة اقتصادية', uncertain_ar: 'غير مؤكد', growth_slowdown_ar: 'تباطؤ اقتصادي' };
  const INFLATION_VAL  = { inflation_pressure: 80, uncertain: 50, disinflation: 20,
                           inflation_pressure_ar: 'ضغط تضخمي', uncertain_ar: 'غير مؤكد', disinflation_ar: 'تراجع تضخم' };
  const DOLLAR_VALUES  = { dollar_strength: 75, uncertain: 50, dollar_weakness: 25,
                           dollar_strength_ar: 'دولار قوي', uncertain_ar: 'غير مؤكد', dollar_weakness_ar: 'دولار ضعيف' };
  const DURATION_VALUES= { duration_pressure: 25, uncertain: 50, duration_supportive: 75,
                           duration_pressure_ar: 'ضغط على المدة', uncertain_ar: 'غير مؤكد', duration_supportive_ar: 'دعم للمدة' };

  return {
    generated_at:  now,
    data_quality:  regime.data_quality || 'structural',
    freshness_score: regime.freshness_score,
    headline_en:   (regime.summary || {}).headline_en || 'Market tone: Unverified · Intelligence confidence low',
    headline_ar:   (regime.summary || {}).headline_ar || 'نبرة السوق: غير مؤكدة · ثقة الذكاء المنخفضة',
    gauges: {
      risk_appetite:    gauge('risk_appetite',    RISK_VALUES,     0, 100),
      volatility_regime:gauge('volatility_regime',VOL_VALUES,      0, 100),
      rate_path:        gauge('rate_path',         RATE_VALUES,     0, 100),
      growth_regime:    gauge('growth_regime',     GROWTH_VALUES,   0, 100),
      inflation_regime: gauge('inflation_regime',  INFLATION_VAL,   0, 100),
      dollar_regime:    gauge('dollar_regime',     DOLLAR_VALUES,   0, 100),
      duration_regime:  gauge('duration_regime',   DURATION_VALUES, 0, 100),
    },
  };
}

// ── Sector rotation map ───────────────────────────────────────────────────────

function buildSectorRotationMap(ctx, memory, status) {
  const latest   = (memory.snapshots || []).slice(-1)[0] || {};
  const internals= latest.advanced_internals || {};
  const breadth  = (ctx.breadth) || {};
  const slStatus = (status.sector_leadership) || {};

  const SECTORS = [
    { id: 'technology',    name_en: 'Technology',     name_ar: 'التكنولوجيا',      etf: 'XLK' },
    { id: 'semiconductors',name_en: 'Semiconductors', name_ar: 'أشباه الموصلات',  etf: 'SOXX' },
    { id: 'financials',    name_en: 'Financials',     name_ar: 'الخدمات المالية',  etf: 'XLF' },
    { id: 'healthcare',    name_en: 'Healthcare',     name_ar: 'الرعاية الصحية',   etf: 'XLV' },
    { id: 'energy',        name_en: 'Energy',         name_ar: 'الطاقة',           etf: 'XLE' },
    { id: 'utilities',     name_en: 'Utilities',      name_ar: 'المرافق',          etf: 'XLU' },
    { id: 'industrials',   name_en: 'Industrials',    name_ar: 'الصناعات',         etf: 'XLI' },
    { id: 'consumer_disc', name_en: 'Cons. Discretionary', name_ar: 'الإنفاق التقديري', etf: 'XLY' },
  ];

  const leaderIds = (slStatus.leaders || []).map((l) =>
    l.toLowerCase().replace(/\s+/g, '_').replace('semiconductors', 'semiconductors')
  );

  const aiParticipation = internals.ai_semiconductor_participation || 'unverified';
  const defParticipation= internals.defensive_participation || 'unverified';
  const cycParticipation= internals.cyclical_participation || 'unverified';

  const sectors = SECTORS.map((s) => {
    let momentum = 'neutral';
    let signal   = 'unverified';

    if (leaderIds.includes(s.id) || (s.id === 'technology' && aiParticipation === 'improving')) {
      momentum = 'leading'; signal = 'improving';
    } else if (s.id === 'utilities' && defParticipation === 'improving') {
      momentum = 'rotating-in'; signal = 'improving';
    } else if (s.id === 'healthcare' && defParticipation === 'improving') {
      momentum = 'rotating-in'; signal = 'improving';
    } else if (s.id === 'industrials' && cycParticipation === 'improving') {
      momentum = 'rotating-in'; signal = 'improving';
    } else if (s.id === 'financials' && cycParticipation === 'improving') {
      momentum = 'rotating-in'; signal = 'improving';
    }

    return { ...s, momentum, signal };
  });

  return {
    generated_at:  new Date().toISOString(),
    data_quality:  ctx.data_quality || 'structural',
    rotation_type: breadth.sector_rotation || 'mixed',
    rotation_type_ar: rotationAr(breadth.sector_rotation || 'mixed'),
    breadth_quality: breadth.breadth_quality || 'unverified',
    sectors,
    disclaimer_en: 'Educational only. Sector momentum derived from institutional participation signals.',
    disclaimer_ar: 'للأغراض التعليمية فقط. زخم القطاعات مستمد من إشارات المشاركة المؤسسية.',
  };
}

// ── Cross-asset impact map ────────────────────────────────────────────────────

function buildCrossAssetMap(ctx, transmit, regime) {
  const crossAsset = ctx.cross_asset || {};
  const lib = transmit.transmission_library || {};

  const ASSETS = [
    { id: 'spy',  name: 'S&P 500', name_ar: 'ستاندرد آند بورز 500', category: 'equity' },
    { id: 'qqq',  name: 'NASDAQ',  name_ar: 'ناسداك',               category: 'equity' },
    { id: 'xlk',  name: 'Tech ETF (XLK)', name_ar: 'تقنية (XLK)',   category: 'equity' },
    { id: 'soxx', name: 'Semis (SOXX)',    name_ar: 'رقائق (SOXX)',  category: 'equity' },
    { id: 'tlt',  name: 'Long Bonds (TLT)', name_ar: 'سندات طويلة (TLT)', category: 'bonds' },
    { id: 'dxy',  name: 'USD Index (DXY)', name_ar: 'الدولار (DXY)', category: 'currency' },
  ];

  const assets = ASSETS.map((a) => {
    const data = crossAsset[a.id] || {};
    return {
      ...a,
      trend:      data.trend || 'unverified',
      change_pct: data.change_pct,
      value:      data.value,
      data_quality: data.trend && data.trend !== 'unverified' ? 'live' : 'structural',
    };
  });

  const chains = Object.entries(lib).slice(0, 8).map(([trigger, def]) => ({
    trigger,
    trigger_ar:      triggerAr(trigger),
    primary_channel: def.primary_channel || 'unknown',
    mechanism:       def.mechanism || '',
    chain:           (def.asset_chain || []).slice(0, 4).map((a) => ({
      asset:     a.asset,
      direction: a.direction,
      reason:    a.reason,
    })),
  }));

  return {
    generated_at:  new Date().toISOString(),
    data_quality:  ctx.data_quality || 'structural',
    assets,
    transmission_chains: chains,
    regime_context: {
      risk_appetite: (regime.classifications || {}).risk_appetite?.label || 'uncertain',
      dollar_regime: (regime.classifications || {}).dollar_regime?.label || 'uncertain',
    },
  };
}

// ── Yield curve context ───────────────────────────────────────────────────────

function buildYieldCurveContext(ctx, ratePath, regime) {
  const macro  = ctx.macro || {};
  const fp     = ratePath.fed_path || {};
  const yc     = ratePath.yield_curve || {};
  const durationSens = ratePath.duration_sensitivity || {};

  return {
    generated_at: new Date().toISOString(),
    data_quality: ctx.data_quality || 'structural',
    curve: {
      state:        macro.yield_curve_state || yc.inferred_shape || 'uncertain',
      state_ar:     yieldCurveStateAr(macro.yield_curve_state || yc.inferred_shape || 'uncertain'),
      spread_bps:   macro.yield_spread_bps,
      us10y:        macro.us10y_yield,
      us2y:         null,
      narrative:    yc.curve_narrative || 'Yield curve data unavailable.',
      confirmation: yc.confirmation_needed || [],
    },
    fed_path: {
      bias:       fp.bias || 'unknown',
      bias_ar:    fedBiasAr(fp.bias || 'unknown'),
      hold_pct:   Math.round((fp.probability_scenarios?.hold || 0) * 100),
      cut_pct:    Math.round(((fp.probability_scenarios?.cut_25bp || 0) + (fp.probability_scenarios?.cut_50bp || 0)) * 100),
      hike_pct:   Math.round((fp.probability_scenarios?.hike_25bp || 0) * 100),
      narrative:  fp.implied_path_narrative || '',
    },
    duration_sensitivity: Object.entries(durationSens).slice(0, 6).map(([asset, d]) => ({
      asset,
      sensitivity: d.sensitivity || 'unknown',
      direction:   d.direction || 'unknown',
      direction_ar: d.direction === 'positive_on_rate_fall' ? 'إيجابي عند انخفاض الفائدة' : 'سلبي عند ارتفاع الفائدة',
    })),
    duration_regime: (regime.classifications || {}).duration_regime || {},
  };
}

// ── Volatility dashboard ──────────────────────────────────────────────────────

function buildVolatilityDashboard(ctx, regime) {
  const vix   = (ctx.cross_asset || {}).vix || {};
  const vol   = regime.classifications?.volatility_regime || {};

  const REGIMES = [
    { label: 'complacency', threshold: 13, color: 'green',  label_ar: 'انعدام الحذر' },
    { label: 'calm',        threshold: 18, color: 'teal',   label_ar: 'هادئ' },
    { label: 'elevated',    threshold: 25, color: 'amber',  label_ar: 'مرتفع' },
    { label: 'high',        threshold: 35, color: 'orange', label_ar: 'عالٍ' },
    { label: 'extreme',     threshold: 99, color: 'red',    label_ar: 'متطرف' },
  ];

  const currentLevel  = vix.level;
  const currentRegime = REGIMES.find((r) => currentLevel !== null && currentLevel <= r.threshold)
    || { label: 'unverified', color: 'gray', label_ar: 'غير مؤكد' };

  return {
    generated_at: new Date().toISOString(),
    data_quality: ctx.data_quality || 'structural',
    vix: {
      level:        currentLevel,
      change_pct:   vix.change_pct,
      regime:       currentRegime.label,
      regime_ar:    currentRegime.label_ar,
      regime_color: currentRegime.color,
    },
    regime_spectrum: REGIMES,
    volatility_regime: {
      label:       vol.label || 'uncertain',
      label_ar:    vol.label === 'volatility_compression' ? 'ضغط تقلب' : vol.label === 'volatility_expansion' ? 'توسع تقلب' : 'غير مؤكد',
      confidence:  vol.confidence || 0,
      reason_en:   vol.reason_en || '',
      reason_ar:   vol.reason_ar || '',
    },
    vix_zone_bands: [
      { zone: 'fear',       min: 30, max: 100, color: 'red',   label_en: 'Fear zone',       label_ar: 'منطقة الخوف' },
      { zone: 'caution',    min: 20, max: 30,  color: 'amber', label_en: 'Caution zone',    label_ar: 'منطقة الحذر' },
      { zone: 'normal',     min: 15, max: 20,  color: 'teal',  label_en: 'Normal range',    label_ar: 'النطاق الطبيعي' },
      { zone: 'complacent', min: 0,  max: 15,  color: 'green', label_en: 'Complacency zone',label_ar: 'منطقة الاطمئنان' },
    ],
    historical_context_en: 'VIX below 20 has historically corresponded with positive equity returns. VIX above 25 has preceded major drawdowns in 70% of cases since 1990.',
    historical_context_ar: 'مؤشر VIX أقل من 20 يرتبط تاريخياً بعوائد أسهم إيجابية. VIX أعلى من 25 سبق انهيارات كبرى في 70% من الحالات منذ عام 1990.',
  };
}

// ── ETF relationship map ──────────────────────────────────────────────────────

function buildEtfRelationshipMap(ctx, etfFlow, transmit) {
  const crossAsset = ctx.cross_asset || {};
  const flows      = etfFlow.etf_flows || etfFlow.flows || {};

  const ETF_NODES = [
    { id: 'QQQ',  name_en: 'QQQ — NASDAQ 100',     name_ar: 'ناسداك 100',    category: 'broad_equity',   risk: 'high' },
    { id: 'SPY',  name_en: 'SPY — S&P 500',         name_ar: 'ستاندرد آند بورز 500', category: 'broad_equity', risk: 'medium' },
    { id: 'XLK',  name_en: 'XLK — Technology',      name_ar: 'التكنولوجيا',    category: 'sector',         risk: 'high' },
    { id: 'SOXX', name_en: 'SOXX — Semiconductors', name_ar: 'أشباه الموصلات', category: 'sector',         risk: 'very_high' },
    { id: 'SMH',  name_en: 'SMH — Semis Alt',       name_ar: 'رقائق بديل',     category: 'sector',         risk: 'very_high' },
    { id: 'TLT',  name_en: 'TLT — Long Bonds',      name_ar: 'سندات طويلة',    category: 'fixed_income',  risk: 'medium' },
    { id: 'XLE',  name_en: 'XLE — Energy',          name_ar: 'الطاقة',          category: 'sector',         risk: 'high' },
    { id: 'XLV',  name_en: 'XLV — Healthcare',      name_ar: 'الرعاية الصحية',  category: 'sector',         risk: 'low' },
    { id: 'GLD',  name_en: 'GLD — Gold',            name_ar: 'الذهب',           category: 'commodity',      risk: 'medium' },
  ];

  const RELATIONSHIPS = [
    { from: 'QQQ',  to: 'XLK',  type: 'constituent', strength: 0.95, description_en: 'XLK is the largest QQQ constituent sector', description_ar: 'XLK هو أكبر قطاع مكوّن في QQQ' },
    { from: 'QQQ',  to: 'SOXX', type: 'correlated',  strength: 0.85, description_en: 'Semiconductor leadership drives NASDAQ returns', description_ar: 'قيادة أشباه الموصلات تحرك عوائد ناسداك' },
    { from: 'SOXX', to: 'SMH',  type: 'peer',        strength: 0.92, description_en: 'Alternative semiconductor index — high overlap', description_ar: 'مؤشر أشباه الموصلات البديل — تداخل كبير' },
    { from: 'TLT',  to: 'QQQ',  type: 'inverse',     strength: 0.70, description_en: 'Rate sensitivity: rising yields pressure QQQ valuations', description_ar: 'حساسية الفائدة: ارتفاع العوائد يضغط على تقييمات QQQ' },
    { from: 'TLT',  to: 'GLD',  type: 'correlated',  strength: 0.55, description_en: 'Safe-haven flows often lift both gold and bonds', description_ar: 'تدفقات الملاذ الآمن ترفع الذهب والسندات معاً' },
    { from: 'SPY',  to: 'XLK',  type: 'constituent', strength: 0.80, description_en: 'Technology is the largest S&P 500 sector weight', description_ar: 'التكنولوجيا هي أكبر قطاع بالوزن في ستاندرد آند بورز 500' },
  ];

  const nodes = ETF_NODES.map((n) => {
    const caData = crossAsset[n.id.toLowerCase()] || {};
    const flowData = flows[n.id] || {};
    return {
      ...n,
      trend:       caData.trend || 'unverified',
      change_pct:  caData.change_pct,
      flow_signal: flowData.flow_signal || flowData.signal || 'unverified',
      flow_ar:     flowData.flow_signal === 'inflow' ? 'تدفق داخل' : flowData.flow_signal === 'outflow' ? 'تدفق خارج' : 'غير مؤكد',
    };
  });

  return {
    generated_at:  new Date().toISOString(),
    data_quality:  ctx.data_quality || 'structural',
    nodes,
    relationships: RELATIONSHIPS,
    disclaimer_en: 'ETF relationships are structural and educational. Not investment advice.',
    disclaimer_ar: 'علاقات الصناديق هيكلية وتعليمية. ليست توصية استثمارية.',
  };
}

// ── Label translators ─────────────────────────────────────────────────────────

function rotationAr(v) {
  const m = { 'growth-leadership': 'قيادة النمو', 'defensive-rotation': 'دوران دفاعي',
              'broad-growth': 'نمو واسع', mixed: 'متنوع', unverified: 'غير مؤكد' };
  return m[v] || v;
}

function yieldCurveStateAr(v) {
  const m = { steep: 'منحدر', normal: 'طبيعي', flat: 'مسطح', inverted: 'مقلوب', uncertain: 'غير مؤكد', unverified: 'غير مؤكد' };
  return m[v] || v;
}

function fedBiasAr(v) {
  const m = { data_dependent: 'مرتبط بالبيانات', hawkish: 'تشددي', dovish: 'تيسيري',
              neutral: 'محايد', unknown: 'غير معروف' };
  return m[v] || v;
}

function triggerAr(t) {
  const m = { CPI_hot: 'تضخم مرتفع', CPI_cool: 'تضخم منخفض', NFP_strong: 'وظائف قوية',
              NFP_weak: 'وظائف ضعيفة', FOMC_hawkish: 'احتياطي تشددي', FOMC_dovish: 'احتياطي تيسيري',
              GDP_miss: 'نمو أقل من المتوقع', VIX_spike: 'ارتفاع مفاجئ للتقلب' };
  return m[t] || t;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
