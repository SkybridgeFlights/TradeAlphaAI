'use strict';

// ETF Intelligence Center — the TradeAlpha Score.
//
// Every parameter comes from config/etf-score.json. Nothing about the model is
// hard-coded here: weights, bands, scales, breadth tiers and tracking proxies
// are all read at build time, so changing the model is a config edit that the
// methodology page and the validator pick up automatically.
//
// Inputs are restricted to what the platform can evidence. A component whose
// inputs are unavailable is emitted as `indeterminate` with a stated reason,
// dropped from the total, and the remaining weights are renormalised. Where the
// evaluable weight falls below the configured floor, the headline score is
// withheld entirely rather than published from a fragment of the model.
//
// Usage: node tools/build-etf-score.js [--write]

const fs = require('fs');
const path = require('path');

const { UNIVERSE } = require('./etf-universe');
const P = require('./etf-provenance');
const m = require('./etf-metrics');
const { hash } = require('./build-institutional-charts');

const ROOT = path.join(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'config/etf-score.json');
const ANALYTICS = path.join(ROOT, 'data/intelligence/etf-analytics.json');
const FACTS = path.join(ROOT, 'data/intelligence/etf-facts.json');
const OUT = path.join(ROOT, 'data/intelligence/etf-score.json');
const SCHEMA_VERSION = 2;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Strip the $comment keys used to document the config in place. */
function stripComments(value) {
  if (Array.isArray(value)) return value.map(stripComments);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (key.startsWith('$comment')) continue;
      out[key] = stripComments(inner);
    }
    return out;
  }
  return value;
}

const clamp = (v) => Math.max(0, Math.min(100, v));

/** Map a measured value onto 0-100 using a configured scale. */
function onScale(value, scale) {
  if (!Number.isFinite(value) || !scale) return null;
  const { best, worst } = scale;
  if (!Number.isFinite(best) || !Number.isFinite(worst) || best === worst) return null;
  return clamp(((worst - value) / (worst - best)) * 100);
}

function indeterminate(reason) {
  return { value: null, status: 'indeterminate', reason, evidence: [] };
}

function computed(value, evidence) {
  return { value: Math.round(clamp(value) * 10) / 10, status: 'computed', evidence };
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function scoreCost(facts, config) {
  const ter = facts && facts.fields.ter_pct;
  if (!P.hasValue(ter)) {
    return indeterminate('expense ratio awaiting a verified source — no free provider publishes it');
  }
  const score = onScale(ter.value, config.scales.cost_ter_pct);
  if (score === null) return indeterminate('expense ratio outside the configured scale');
  return computed(score, [
    `total expense ratio ${ter.value}% per year (${ter.provenance})`,
    `scaled between ${config.scales.cost_ter_pct.best}% and ${config.scales.cost_ter_pct.worst}%`,
  ]);
}

function scoreDiversification(entry, analytics, marketVol, config) {
  const breadth = config.breadth_tiers[entry.category];
  if (breadth === undefined) return indeterminate(`no breadth tier configured for category "${entry.category}"`);

  const evidence = [`mandate breadth tier ${breadth.toFixed(2)} for TradeAlphaAI category "${entry.category}"`];
  let score = breadth * 100;

  const vol = analytics && analytics.risk ? analytics.risk.volatility_full : null;
  if (Number.isFinite(vol) && Number.isFinite(marketVol) && marketVol > 0) {
    const ratio = vol / marketVol;
    const cfg = config.scales.volatility_penalty;
    const penalty = Math.max(0, Math.min(cfg.max_points, (ratio - 1) * cfg.per_ratio_above_1));
    score -= penalty;
    evidence.push(`observed volatility ${(vol * 100).toFixed(1)}% versus broad-market reference ${(marketVol * 100).toFixed(1)}% (ratio ${ratio.toFixed(2)})`);
  } else {
    evidence.push('volatility comparison unavailable — structural tier used alone');
  }
  return computed(score, evidence);
}

function scoreLiquidity(analytics, config) {
  const liq = analytics && analytics.liquidity;
  if (!liq || !Number.isFinite(liq.median_daily_turnover)) {
    return indeterminate('no observed turnover for this listing');
  }
  const score = onScale(Math.log10(liq.median_daily_turnover), config.scales.liquidity_log10_turnover);
  if (score === null) return indeterminate('turnover outside the configured scale');
  return computed(score, [
    `median daily turnover ${(liq.median_daily_turnover / 1e6).toFixed(1)}M ${liq.currency} across ${liq.observations} trailing sessions`,
    'log-scaled across the configured turnover range',
  ]);
}

function scoreTracking(entry, facts, analytics, config) {
  const benchmark = facts && facts.fields.benchmark;
  if (!P.hasValue(benchmark)) {
    return indeterminate('benchmark index awaiting a verified source');
  }
  const proxy = config.tracking_proxies[benchmark.value];
  if (!proxy) return indeterminate(`no same-currency proxy configured for benchmark "${benchmark.value}"`);
  if (!analytics || !analytics.risk) return indeterminate('no computed risk block');
  if (analytics.currency !== proxy.currency) {
    return indeterminate(`fund quoted in ${analytics.currency}, proxy in ${proxy.currency} — the comparison would measure the exchange rate`);
  }
  if (entry.yahoo_symbol === proxy.proxy_symbol) {
    return indeterminate(`this fund is the reference proxy used for ${benchmark.value} — self-comparison withheld`);
  }

  const stats = analytics.risk.vs_benchmarks && analytics.risk.vs_benchmarks[proxy.key];
  if (!stats || stats.unavailable || !Number.isFinite(stats.tracking_error)) {
    return indeterminate(`tracking statistics unavailable versus ${benchmark.value}`);
  }
  const score = onScale(stats.tracking_error, config.scales.tracking_error);
  if (score === null) return indeterminate('tracking error outside the configured scale');
  return computed(score, [
    `annualised tracking error ${(stats.tracking_error * 100).toFixed(2)}% versus ${benchmark.value} proxy (${proxy.proxy_symbol}), ${stats.shared_observations} shared observations`,
    `benchmark provenance: ${benchmark.provenance}`,
  ]);
}

/**
 * Structural tax characteristics.
 *
 * Scored only from fields with a verified or derived provenance. With domicile
 * now awaiting a verified source, this component rests on distribution policy
 * alone where the provider's fund name states it, and is indeterminate
 * otherwise. The jurisdictional assumption is published on the methodology page.
 */
function scoreTaxCharacteristics(facts, config) {
  const distribution = facts && facts.fields.distribution;
  const domicile = facts && facts.fields.domicile;
  const haveDist = P.hasValue(distribution);
  const haveDom = P.hasValue(domicile);

  if (!haveDist && !haveDom) {
    return indeterminate('domicile and distribution policy both awaiting a verified source');
  }

  const cfg = config.tax_characteristics;
  let score = cfg.base;
  const evidence = [];

  if (haveDist) {
    if (distribution.value === 'accumulating') {
      score += cfg.accumulating_bonus;
      evidence.push(`accumulating share class, read from the provider fund name: "${distribution.from_text}"`);
    } else if (distribution.value === 'distributing') {
      evidence.push(`distributing share class, read from the provider fund name: "${distribution.from_text}"`);
    }
  }

  if (haveDom) {
    if (domicile.value === 'Ireland') {
      score += cfg.ireland_domicile_bonus;
      evidence.push('Irish domicile — treaty-based withholding treatment for many non-US holders');
    } else if (domicile.value === 'United States') {
      score -= cfg.us_domicile_penalty;
      evidence.push('US domicile — withholding and estate-tax treatment differ for non-US holders');
    }
  } else {
    evidence.push('fund domicile awaiting a verified source — scored on distribution policy alone');
  }

  return computed(score, evidence);
}

function scoreLongTerm(analytics, costScore, diversificationScore, config) {
  const parts = [];
  const evidence = [];

  if (costScore.status === 'computed') {
    parts.push(costScore.value);
    evidence.push(`cost component ${costScore.value.toFixed(1)}`);
  }
  if (diversificationScore.status === 'computed') {
    parts.push(diversificationScore.value);
    evidence.push(`diversification component ${diversificationScore.value.toFixed(1)}`);
  }

  const years = analytics && analytics.performance ? analytics.performance.observed_years : null;
  if (Number.isFinite(years)) {
    const record = onScale(years, config.scales.record_years);
    if (record !== null) {
      parts.push(record);
      evidence.push(`${years.toFixed(1)} years of observable price history`);
    }
  }

  const dd = analytics && analytics.risk ? analytics.risk.max_drawdown : null;
  if (Number.isFinite(dd)) {
    const resilience = onScale(Math.abs(dd), config.scales.drawdown_depth);
    if (resilience !== null) {
      parts.push(resilience);
      evidence.push(`deepest observed drawdown ${(dd * 100).toFixed(1)}%`);
    }
  }

  if (parts.length < 2) return indeterminate('too few components available for a long-horizon composite');
  return computed(parts.reduce((a, b) => a + b, 0) / parts.length, evidence);
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

function labelFor(overall, config) {
  if (overall === null) return config.indeterminate_label;
  for (const band of config.bands) {
    if (overall >= band.min) return band.label;
  }
  return config.bands[config.bands.length - 1].label;
}

function scoreEntry(entry, analytics, facts, marketVol, config) {
  const cost = scoreCost(facts, config);
  const diversification = scoreDiversification(entry, analytics, marketVol, config);
  const liquidity = scoreLiquidity(analytics, config);
  const tracking = scoreTracking(entry, facts, analytics, config);
  const tax = scoreTaxCharacteristics(facts, config);
  const longTerm = scoreLongTerm(analytics, cost, diversification, config);

  const subScores = {
    cost, diversification, liquidity,
    tracking_quality: tracking,
    tax_characteristics: tax,
    long_term_suitability: longTerm,
  };

  let weighted = 0;
  let weightUsed = 0;
  const evaluated = [];
  const skipped = [];
  for (const [key, weight] of Object.entries(config.weights)) {
    const sub = subScores[key];
    if (sub && sub.status === 'computed') {
      weighted += sub.value * weight;
      weightUsed += weight;
      evaluated.push(key);
    } else {
      skipped.push({ component: key, reason: sub ? sub.reason : 'component not produced' });
    }
  }

  const coverage = Math.round(weightUsed * 1000) / 1000;
  const overall = weightUsed >= config.min_weight_coverage
    ? Math.round((weighted / weightUsed) * 10) / 10
    : null;

  return {
    slug: entry.slug,
    symbol: entry.symbol,
    overall,
    label: labelFor(overall, config),
    model_coverage: coverage,
    components_evaluated: evaluated,
    components_skipped: skipped,
    sub_scores: subScores,
    evidence: [
      overall === null
        ? `overall score withheld — only ${(coverage * 100).toFixed(0)}% of the model could be evaluated (floor ${(config.min_weight_coverage * 100).toFixed(0)}%)`
        : `overall ${overall} from ${evaluated.length} of ${Object.keys(config.weights).length} components covering ${(coverage * 100).toFixed(0)}% of model weight`,
      `weights renormalised over evaluated components only; awaiting verified data: ${skipped.length ? skipped.map((s) => s.component).join(', ') : 'none'}`,
    ],
  };
}

function build() {
  const config = stripComments(readJson(CONFIG_FILE));
  const analytics = readJson(ANALYTICS);
  const facts = readJson(FACTS);
  const analyticsBySlug = new Map(analytics.etfs.map((e) => [e.slug, e]));
  const factsBySlug = new Map(facts.etfs.map((e) => [e.slug, e]));

  const reference = analyticsBySlug.get('voo') || analyticsBySlug.get('spy');
  const marketVol = reference && reference.risk ? reference.risk.volatility_full : null;

  const etfs = UNIVERSE.map((entry) => scoreEntry(
    entry,
    analyticsBySlug.get(entry.slug),
    factsBySlug.get(entry.slug),
    marketVol,
    config,
  ));

  const scored = etfs.filter((e) => e.overall !== null).length;
  const artifact = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_layer: 'derived_from_verified_and_computed_inputs',
    config_file: 'config/etf-score.json',
    method: {
      note_en: 'The TradeAlpha Score describes structural fund quality using only inputs this platform can evidence. Components whose inputs are awaiting a verified source are marked indeterminate and excluded, and the remaining weights are renormalised. It is educational research, not a ranking of expected return and not investment advice.',
      note_ar: 'يصف مؤشر TradeAlpha جودة الصندوق الهيكلية باستخدام مدخلات يمكن للمنصة إثباتها فقط. وتُصنَّف المكوّنات التي تنتظر مدخلاتها مصدرا موثّقا كغير محددة وتُستبعد، وتُعاد موازنة الأوزان المتبقية. وهو بحث تعليمي، وليس ترتيبا للعائد المتوقع ولا نصيحة استثمارية.',
      tax_assumption_en: 'Structural tax characteristics are assessed from the perspective of a non-US investor, because domicile and distribution policy change withholding treatment most for that audience. It is not tax advice and does not model any individual circumstances.',
      tax_assumption_ar: 'تُقيَّم الخصائص الضريبية الهيكلية من منظور مستثمر غير أميركي، لأن مقر الصندوق وسياسة التوزيع يغيّران معاملة الاستقطاع لهذه الفئة أكثر من غيرها. وهي ليست استشارة ضريبية ولا تمثل ظروف أي فرد.',
      coverage_note_en: 'Expense ratios have no free verifiable source, so the cost component is currently indeterminate for every fund and its weight is redistributed. Scores will change when a verified cost source is connected.',
      coverage_note_ar: 'لا يوجد مصدر مجاني موثّق لنسب المصاريف، لذا يبقى مكوّن التكلفة غير محدد لكل الصناديق ويُعاد توزيع وزنه. وستتغير الدرجات عند ربط مصدر تكلفة موثّق.',
      weights: config.weights,
      labels: config.bands.map((b) => b.label).concat(config.indeterminate_label),
      bands: config.bands,
      min_weight_coverage: config.min_weight_coverage,
      scales: config.scales,
      breadth_tiers: config.breadth_tiers,
      broad_market_volatility_reference: m.round(marketVol, 6),
    },
    coverage: { total: etfs.length, scored, withheld: etfs.length - scored },
    etfs,
    attribution: {
      sources: analytics.attribution.sources,
      derived_from: ['data/intelligence/etf-analytics.json', 'data/intelligence/etf-facts.json', 'config/etf-score.json'],
      computed_by: 'tools/build-etf-score.js',
    },
  };
  artifact.source_hash = hash(JSON.stringify(etfs));
  return artifact;
}

function main() {
  for (const file of [CONFIG_FILE, ANALYTICS, FACTS]) {
    if (!fs.existsSync(file)) {
      console.error(`[etf-score] FAILED: missing ${path.relative(ROOT, file)}`);
      process.exit(1);
    }
  }
  const artifact = build();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-score] wrote ${path.relative(ROOT, OUT)} (${artifact.coverage.scored}/${artifact.coverage.total} scored, config ${path.relative(ROOT, CONFIG_FILE)})`);
  } else {
    console.log(`[etf-score] dry run — ${artifact.coverage.scored}/${artifact.coverage.total} scored`);
  }
}

if (require.main === module) main();

module.exports = {
  build, scoreEntry, scoreCost, scoreDiversification, scoreLiquidity,
  scoreTracking, scoreTaxCharacteristics, scoreLongTerm, labelFor,
  stripComments, onScale, CONFIG_FILE,
};
