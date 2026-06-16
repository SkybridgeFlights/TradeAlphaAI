'use strict';

// Phase 203 / Workstreams A+D — deterministic provider coverage matrix +
// per-asset data quality intelligence, derived from the institutional-charts
// manifest diagnostics (no fabrication). Qualitative labels only.
//
// Outputs:
//   data/intelligence/provider-coverage.json
//   data/intelligence/data-quality.json
// Usage: node tools/build-data-coverage.js [--write]

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const OUT_COVERAGE = path.join(ROOT, 'data', 'intelligence', 'provider-coverage.json');
const OUT_QUALITY = path.join(ROOT, 'data', 'intelligence', 'data-quality.json');
const WRITE = process.argv.includes('--write');
const PROVIDERS = ['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo'];
const KEYED = new Set(['FMP', 'Finnhub', 'AlphaVantage']);

const COVERAGE_LABELS = { full: ['full', 'كاملة'], partial: ['partial', 'جزئية'], none: ['none', 'لا تغطية'] };
const FRESH_LABELS = { fresh: ['fresh', 'حديثة'], recent: ['recent', 'قريبة'], stale: ['stale', 'قديمة'], unavailable: ['unavailable', 'غير متاحة'] };
const RELIABILITY_LABELS = { verified_provider: ['verified provider', 'مزوّد موثّق'], keyless_fallback: ['keyless fallback', 'مصدر احتياطي بلا مفتاح'], unavailable: ['unavailable', 'غير متاح'] };
const COMPLETENESS_LABELS = { complete: ['complete', 'مكتملة'], partial: ['partial', 'جزئية'], none: ['none', 'غير متوفرة'] };
const ACTIVATION_LABELS = { active: ['active', 'مُفعّل'], awaiting: ['awaiting approved provider data', 'بانتظار بيانات مزوّد معتمدة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function daysBetween(aDate, bMs) { const t = Date.parse(aDate); return Number.isFinite(t) ? (bMs - t) / 86400000 : null; }

function build() {
  const manifest = readJson(CHARTS, {});
  const diagnostics = Array.isArray(manifest.diagnostics) ? manifest.diagnostics : [];
  const charts = Array.isArray(manifest.charts) ? manifest.charts : [];
  const chartBySymbol = new Map(charts.filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const diagBySymbol = new Map(diagnostics.map((d) => [d.symbol, d]));
  const ph = manifest.provider_health || {};
  const now = Date.now();
  const stamp = new Date().toISOString();

  // ── Provider coverage matrix. ──
  const providers = PROVIDERS.map((name) => {
    let attempted = 0; let resolved = 0; let keyPresent = !KEYED.has(name); // keyless → always "present"
    for (const d of diagnostics) {
      const att = (d.attempts || []).filter((a) => a.provider === name);
      if (att.length) attempted += 1;
      if (att.some((a) => a.outcome !== 'no_key')) keyPresent = keyPresent || true;
      if (KEYED.has(name) && att.some((a) => a.outcome === 'no_key')) keyPresent = keyPresent && false;
      if (d.resolved && d.resolved.provider === name) resolved += 1;
    }
    // keyPresent inference: a keyed provider that only ever returned no_key has no key.
    if (KEYED.has(name)) keyPresent = diagnostics.some((d) => (d.attempts || []).some((a) => a.provider === name && a.outcome !== 'no_key'));
    return { name, keyed: KEYED.has(name), key_present: keyPresent, assets_attempted: attempted, assets_resolved: resolved };
  });
  const perAssetCoverage = ASSETS.map((asset) => {
    const d = diagBySymbol.get(asset.symbol);
    const resolvedProvider = d && d.resolved ? d.resolved.provider : null;
    return { symbol: asset.symbol, resolved_provider: resolvedProvider, covered: !!chartBySymbol.get(asset.symbol) };
  });
  const coverage = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'provider-coverage',
    mode: ph.mode || 'offline',
    assets_total: ASSETS.length, assets_covered: perAssetCoverage.filter((a) => a.covered).length,
    providers, per_asset: perAssetCoverage,
    attribution: { sources: ['data/visual/institutional-charts.json'], note: 'Deterministic provider coverage from chart-build diagnostics. Honest — a provider is only credited where it actually resolved sourced bars.' },
  };

  // ── Per-asset data quality. ──
  const qAssets = ASSETS.map((asset) => {
    const chart = chartBySymbol.get(asset.symbol) || null;
    const d = diagBySymbol.get(asset.symbol);
    if (!chart) {
      return {
        symbol: asset.symbol, activation_status: 'awaiting',
        activation_en: ACTIVATION_LABELS.awaiting[0], activation_ar: ACTIVATION_LABELS.awaiting[1],
        coverage_label: 'none', coverage_en: COVERAGE_LABELS.none[0], coverage_ar: COVERAGE_LABELS.none[1],
        freshness: 'unavailable', freshness_en: FRESH_LABELS.unavailable[0], freshness_ar: FRESH_LABELS.unavailable[1],
        provider_reliability: 'unavailable', reliability_en: RELIABILITY_LABELS.unavailable[0], reliability_ar: RELIABILITY_LABELS.unavailable[1],
        chart_completeness: 'none', completeness_en: COMPLETENESS_LABELS.none[0], completeness_ar: COMPLETENESS_LABELS.none[1],
        series_hash: null, as_of: null,
        evidence: [`no verified chart (${(d && d.reason) || 'unavailable'})`],
      };
    }
    const bars = chart.bar_count || (chart.series || []).length;
    const cov = bars >= 80 ? 'full' : bars >= 50 ? 'partial' : 'none';
    const age = daysBetween(chart.as_of, now);
    const fresh = age === null ? 'unavailable' : age <= 4 ? 'fresh' : age <= 10 ? 'recent' : 'stale';
    const provider = (chart.attribution && chart.attribution.provider) || (d && d.resolved && d.resolved.provider) || 'unknown';
    const reliability = KEYED.has(provider) ? 'verified_provider' : provider === 'Yahoo' ? 'keyless_fallback' : 'verified_provider';
    const overlays = Array.isArray(chart.overlays) ? chart.overlays.length : 0;
    const completeness = (bars >= 80 && overlays >= 2) ? 'complete' : (bars >= 50 ? 'partial' : 'none');
    return {
      symbol: asset.symbol, activation_status: 'active',
      activation_en: ACTIVATION_LABELS.active[0], activation_ar: ACTIVATION_LABELS.active[1],
      coverage_label: cov, coverage_en: COVERAGE_LABELS[cov][0], coverage_ar: COVERAGE_LABELS[cov][1],
      freshness: fresh, freshness_en: FRESH_LABELS[fresh][0], freshness_ar: FRESH_LABELS[fresh][1],
      provider_reliability: reliability, reliability_en: RELIABILITY_LABELS[reliability][0], reliability_ar: RELIABILITY_LABELS[reliability][1],
      chart_completeness: completeness, completeness_en: COMPLETENESS_LABELS[completeness][0], completeness_ar: COMPLETENESS_LABELS[completeness][1],
      series_hash: chart.series_hash, as_of: chart.as_of,
      evidence: [`${bars} sourced bars from ${provider}`, `as of ${chart.as_of}`, `${overlays} institutional overlays`],
    };
  });
  const quality = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'data-quality',
    assets_total: ASSETS.length, assets_active: qAssets.filter((a) => a.activation_status === 'active').length,
    assets: qAssets,
    attribution: { sources: ['data/visual/institutional-charts.json'], note: 'Qualitative per-asset data quality. No fabricated precision; activation requires a real verified chart.' },
  };

  return { coverage, quality };
}

if (require.main === module) {
  const r = build();
  console.log(`[data-coverage] covered=${r.coverage.assets_covered}/${r.coverage.assets_total} active=${r.quality.assets_active}/${r.quality.assets_total}`);
  for (const p of r.coverage.providers) console.log(`  ${p.name.padEnd(13)} key=${p.key_present} resolved=${p.assets_resolved}`);
  if (WRITE) { fs.writeFileSync(OUT_COVERAGE, `${JSON.stringify(r.coverage, null, 2)}\n`, 'utf8'); fs.writeFileSync(OUT_QUALITY, `${JSON.stringify(r.quality, null, 2)}\n`, 'utf8'); console.log('[data-coverage] wrote 2 artifacts'); }
}

module.exports = { build, COVERAGE_LABELS, FRESH_LABELS, RELIABILITY_LABELS, COMPLETENESS_LABELS, ACTIVATION_LABELS, PROVIDERS };
