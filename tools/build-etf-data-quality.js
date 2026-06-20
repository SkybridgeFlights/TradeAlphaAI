'use strict';

// Phase 215 CP4 — ETF data quality layer.
// Derives per-ETF qualitative quality bands (coverage / chart / historical
// depth / provider confidence) from the activated ETF chart manifest, the
// provider audit, ETF intelligence and the snapshot ledger. Qualitative only;
// no fabricated precision and no hidden ranking.
//
// Output: data/intelligence/etf-data-quality.json
// Usage: node tools/build-etf-data-quality.js [--write]

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const OUT = J('etf-data-quality.json');
const WRITE = process.argv.includes('--write');
const KEYED_PROVIDERS = new Set(['FMP', 'Finnhub', 'AlphaVantage']);
const KEYLESS_PROVIDERS = new Set(['Yahoo']);

const COVERAGE = {
  full: ['full', 'كاملة'],
  partial: ['partial', 'جزئية'],
  none: ['none', 'لا تغطية'],
};
const CHART = {
  verified: ['verified', 'موثّقة'],
  partial: ['partial', 'جزئية'],
  unavailable: ['unavailable', 'غير متاحة'],
};
const HISTORY_DEPTH = {
  multi_snapshot: ['multi snapshot', 'عدة لقطات'],
  single_snapshot: ['single snapshot', 'لقطة واحدة'],
  window_only: ['intraseries window only', 'نافذة داخل السلسلة فقط'],
  unavailable: ['unavailable', 'غير متاحة'],
};
const PROVIDER_CONFIDENCE = {
  verified_provider: ['verified provider', 'مزوّد موثّق'],
  keyless_fallback: ['keyless fallback', 'مصدر احتياطي بلا مفتاح'],
  unavailable: ['unavailable', 'غير متاح'],
};
const QUALITY_TIER = {
  high: ['high', 'عالية'],
  medium: ['medium', 'متوسطة'],
  low: ['low', 'منخفضة'],
  unavailable: ['unavailable', 'غير متاحة'],
};

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function build() {
  const charts = readJson(J('etf-charts.json'), {});
  const audit = readJson(J('etf-provider-audit.json'), {});
  const intel = readJson(J('etf-intelligence.json'), {});
  const ledger = readJson(J('historical-snapshots.json'), { snapshots: [] });
  const snapshotCount = Array.isArray(ledger.snapshots) ? ledger.snapshots.length : 0;
  const chartBySymbol = new Map((charts.charts || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const auditBySymbol = new Map((audit.etfs || []).map((e) => [e.symbol, e]));
  const intelBySymbol = new Map((intel.etfs || []).map((e) => [e.symbol, e]));
  const stamp = new Date().toISOString();

  const etfs = ETFS.map((etf) => {
    const chart = chartBySymbol.get(etf.symbol) || null;
    const a = auditBySymbol.get(etf.symbol) || null;
    const i = intelBySymbol.get(etf.symbol) || null;
    const bars = chart ? (chart.bar_count || (chart.series || []).length) : 0;
    const coverage = bars >= 80 ? 'full' : bars >= 40 ? 'partial' : 'none';
    const chartQuality = chart ? (bars >= 80 ? 'verified' : 'partial') : 'unavailable';
    const provider = (chart && chart.attribution && chart.attribution.provider) || (a && a.selected_source && a.selected_source.provider) || null;
    const providerConfidence = !provider ? 'unavailable' : KEYED_PROVIDERS.has(provider) ? 'verified_provider' : KEYLESS_PROVIDERS.has(provider) ? 'keyless_fallback' : 'verified_provider';
    const historyDepth = !chart ? 'unavailable' : snapshotCount > 1 ? 'multi_snapshot' : snapshotCount === 1 ? 'single_snapshot' : 'window_only';
    // Composed qualitative tier — never a ranking, never a score.
    let tier;
    if (!chart) tier = 'unavailable';
    else if (coverage === 'full' && providerConfidence === 'verified_provider' && historyDepth === 'multi_snapshot') tier = 'high';
    else if (coverage === 'full' && historyDepth !== 'unavailable') tier = 'medium';
    else if (coverage === 'partial' || providerConfidence === 'keyless_fallback') tier = 'medium';
    else tier = 'low';
    const evidence = [];
    if (chart) {
      evidence.push(`${bars} sourced bars as of ${chart.as_of}`);
      if (provider) evidence.push(`provider=${provider}`);
      if (chart.series_hash) evidence.push(`series_hash=${chart.series_hash.slice(0, 12)}`);
    } else {
      evidence.push(`no verified chart (${(a && a.failure_reason) || 'unavailable'})`);
    }
    if (i && i.confidence) evidence.push(`intelligence confidence=${i.confidence.state}`);
    evidence.push(`snapshot ledger entries=${snapshotCount}`);
    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      coverage_label: coverage,
      coverage_en: COVERAGE[coverage][0], coverage_ar: COVERAGE[coverage][1],
      chart_quality: chartQuality,
      chart_quality_en: CHART[chartQuality][0], chart_quality_ar: CHART[chartQuality][1],
      historical_depth: historyDepth,
      historical_depth_en: HISTORY_DEPTH[historyDepth][0], historical_depth_ar: HISTORY_DEPTH[historyDepth][1],
      provider_confidence: providerConfidence,
      provider_confidence_en: PROVIDER_CONFIDENCE[providerConfidence][0], provider_confidence_ar: PROVIDER_CONFIDENCE[providerConfidence][1],
      quality_tier: tier,
      quality_tier_en: QUALITY_TIER[tier][0], quality_tier_ar: QUALITY_TIER[tier][1],
      bars,
      series_hash: chart ? chart.series_hash : null,
      as_of: chart ? chart.as_of : null,
      resolved_provider: provider,
      evidence,
    };
  });

  const summary = {
    quality_high: etfs.filter((e) => e.quality_tier === 'high').length,
    quality_medium: etfs.filter((e) => e.quality_tier === 'medium').length,
    quality_low: etfs.filter((e) => e.quality_tier === 'low').length,
    quality_unavailable: etfs.filter((e) => e.quality_tier === 'unavailable').length,
    full_coverage: etfs.filter((e) => e.coverage_label === 'full').length,
    verified_chart: etfs.filter((e) => e.chart_quality === 'verified').length,
    keyed_provider: etfs.filter((e) => e.provider_confidence === 'verified_provider').length,
    keyless_fallback: etfs.filter((e) => e.provider_confidence === 'keyless_fallback').length,
  };

  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'etf-data-quality',
    etfs_total: ETFS.length,
    snapshot_ledger_entries: snapshotCount,
    summary,
    etfs,
    attribution: {
      sources: [
        'data/intelligence/etf-charts.json',
        'data/intelligence/etf-provider-audit.json',
        'data/intelligence/etf-intelligence.json',
        'data/intelligence/historical-snapshots.json',
      ],
      note: 'Qualitative ETF data quality, derived from the activated chart manifest, provider audit and snapshot ledger. No fabricated precision; an ETF without a verified chart is honestly unavailable.',
    },
  };
}

if (require.main === module) {
  const q = build();
  console.log(`[etf-data-quality] high=${q.summary.quality_high} medium=${q.summary.quality_medium} low=${q.summary.quality_low} unavailable=${q.summary.quality_unavailable}`);
  console.log(`  full_coverage=${q.summary.full_coverage} verified_chart=${q.summary.verified_chart} keyless_fallback=${q.summary.keyless_fallback}`);
  if (WRITE) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(q, null, 2)}\n`, 'utf8');
    console.log(`[etf-data-quality] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build, COVERAGE, CHART, HISTORY_DEPTH, PROVIDER_CONFIDENCE, QUALITY_TIER };
