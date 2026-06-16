'use strict';

// Phase 203 / Workstream G — check:provider-coverage / data-quality /
// asset-activation / chart-coverage (one impl, selected via --check=...).
// Anti-fabrication gates over the provider-coverage + data-quality artifacts and
// the institutional-charts manifest. Key invariant: NO fake activation — an asset
// is only "active"/"covered" when a real verified chart with a manifest-matching
// series_hash and on-disk responsive SVGs exists. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');
const { COVERAGE_LABELS, FRESH_LABELS, RELIABILITY_LABELS, COMPLETENESS_LABELS, ACTIVATION_LABELS, PROVIDERS } = require('./build-data-coverage');

const ROOT = path.resolve(__dirname, '..');
const F = {
  coverage: path.join(ROOT, 'data', 'intelligence', 'provider-coverage.json'),
  quality: path.join(ROOT, 'data', 'intelligence', 'data-quality.json'),
  manifest: path.join(ROOT, 'data', 'visual', 'institutional-charts.json'),
};
const REGISTRY = new Set(ASSETS.map((a) => a.symbol));
const APPROVED_PROVIDERS = new Set([...PROVIDERS, 'Approved fixture', 'cached', 'unknown']);

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; } }
function manifestCharts() { const m = readJson(F.manifest) || {}; return new Map((m.charts || []).filter((c) => c.verified === true).map((c) => [c.symbol, c])); }

function validateProviderCoverage(a, charts) {
  const f = [];
  if (!a || a.source_layer !== 'provider-coverage') f.push('bad source_layer');
  for (const p of (a.providers || [])) {
    if (!APPROVED_PROVIDERS.has(p.name)) f.push(`provider "${p.name}" not approved`);
    if (typeof p.key_present !== 'boolean') f.push(`${p.name}: key_present not boolean`);
    if (typeof p.assets_resolved !== 'number' || p.assets_resolved < 0) f.push(`${p.name}: bad assets_resolved`);
  }
  for (const pa of (a.per_asset || [])) {
    if (!REGISTRY.has(pa.symbol)) f.push(`coverage for non-registry asset ${pa.symbol}`);
    const hasChart = charts.has(pa.symbol);
    if (pa.covered !== hasChart) f.push(`${pa.symbol}: covered=${pa.covered} but manifest chart=${hasChart} (fabricated coverage)`);
    if (pa.resolved_provider && pa.covered) {
      const chart = charts.get(pa.symbol);
      const prov = chart && chart.attribution && chart.attribution.provider;
      if (prov && pa.resolved_provider !== prov && pa.resolved_provider !== 'cached') f.push(`${pa.symbol}: resolved_provider "${pa.resolved_provider}" != manifest provider "${prov}"`);
    }
    if (pa.covered && !pa.resolved_provider) f.push(`${pa.symbol}: covered but no resolved_provider`);
  }
  return f;
}

function validateDataQuality(a, charts) {
  const f = [];
  if (!a || a.source_layer !== 'data-quality') f.push('bad source_layer');
  for (const x of (a.assets || [])) {
    if (!REGISTRY.has(x.symbol)) f.push(`quality for non-registry asset ${x.symbol}`);
    if (!ACTIVATION_LABELS[x.activation_status]) f.push(`${x.symbol}: bad activation_status`);
    if (!COVERAGE_LABELS[x.coverage_label]) f.push(`${x.symbol}: bad coverage_label`);
    if (!FRESH_LABELS[x.freshness]) f.push(`${x.symbol}: bad freshness`);
    if (!RELIABILITY_LABELS[x.provider_reliability]) f.push(`${x.symbol}: bad reliability`);
    if (!COMPLETENESS_LABELS[x.chart_completeness]) f.push(`${x.symbol}: bad completeness`);
    if (!Array.isArray(x.evidence) || !x.evidence.length) f.push(`${x.symbol}: missing evidence`);
    const hasChart = charts.has(x.symbol);
    // Anti-fake-activation: active ⇒ real chart whose series_hash matches.
    if (x.activation_status === 'active') {
      if (!hasChart) f.push(`${x.symbol}: active but no verified chart (fake activation)`);
      else if (x.series_hash !== charts.get(x.symbol).series_hash) f.push(`${x.symbol}: active but series_hash mismatch`);
      if (x.coverage_label === 'none') f.push(`${x.symbol}: active but coverage none (contradiction)`);
    } else {
      if (hasChart) f.push(`${x.symbol}: awaiting but a chart exists (should be active)`);
      if (x.freshness !== 'unavailable') f.push(`${x.symbol}: awaiting but freshness not unavailable`);
    }
  }
  return f;
}

function validateAssetActivation(quality, charts) {
  const f = [];
  const active = (quality.assets || []).filter((x) => x.activation_status === 'active');
  for (const x of active) {
    if (!charts.has(x.symbol)) f.push(`${x.symbol}: activation claims active without a manifest chart`);
    else {
      const c = charts.get(x.symbol);
      if (c.series_hash !== x.series_hash) f.push(`${x.symbol}: activation series_hash does not match manifest`);
      if ((c.bar_count || (c.series || []).length) < 35) f.push(`${x.symbol}: activated chart has too few bars`);
    }
  }
  if (!active.length && charts.size) f.push('charts exist but no asset marked active');
  return f;
}

function validateChartCoverage(charts) {
  const f = [];
  for (const [sym, c] of charts) {
    if (!c.series_hash) f.push(`${sym}: chart missing series_hash`);
    if (!c.as_of) f.push(`${sym}: chart missing as_of`);
    if (!c.attribution || !c.attribution.provider) f.push(`${sym}: chart missing provider attribution`);
    if (!Array.isArray(c.overlays) || c.overlays.length < 1) f.push(`${sym}: chart missing overlays`);
    if (!(c.overlays || []).some((o) => o.type === 'support_resistance_zone')) f.push(`${sym}: chart missing support/resistance zone`);
    for (const loc of ['en', 'ar']) {
      const rel = c.files && c.files[loc];
      if (!rel) { f.push(`${sym}: missing ${loc} SVG ref`); continue; }
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) { f.push(`${sym}: ${loc} SVG missing on disk`); continue; }
      const svg = fs.readFileSync(abs, 'utf8');
      if (!/viewBox="0 0 \d+ \d+"/.test(svg)) f.push(`${sym}: ${loc} SVG not responsive`);
      if (!svg.includes(`data-series-hash="${c.series_hash}"`)) f.push(`${sym}: ${loc} SVG hash mismatch`);
    }
  }
  return f;
}

function runCheck(which) {
  const charts = manifestCharts();
  if (which === 'provider-coverage') return validateProviderCoverage(readJson(F.coverage) || {}, charts);
  if (which === 'data-quality') return validateDataQuality(readJson(F.quality) || {}, charts);
  if (which === 'asset-activation') return validateAssetActivation(readJson(F.quality) || {}, charts);
  if (which === 'chart-coverage') return validateChartCoverage(charts);
  return ['unknown check'];
}

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-data-coverage');
  const built = build();
  const charts = manifestCharts();
  let ok = 0; let total = 0;
  const T = (name, cond) => { total += 1; if (cond) ok += 1; else console.error(`SELF-TEST FAIL: ${name}`); };
  // clean
  T('provider-coverage clean', validateProviderCoverage(built.coverage, charts).length === 0);
  T('data-quality clean', validateDataQuality(built.quality, charts).length === 0);
  T('asset-activation clean', validateAssetActivation(built.quality, charts).length === 0);
  T('chart-coverage clean', validateChartCoverage(charts).length === 0);
  // negatives
  const c1 = JSON.parse(JSON.stringify(built.coverage)); c1.per_asset[0].covered = !c1.per_asset[0].covered;
  T('fabricated coverage rejected', validateProviderCoverage(c1, charts).length > 0);
  const q1 = JSON.parse(JSON.stringify(built.quality)); const act = q1.assets.find((x) => x.activation_status === 'active'); if (act) act.series_hash = 'deadbeef';
  T('activation hash mismatch rejected', validateDataQuality(q1, charts).length > 0);
  const q2 = JSON.parse(JSON.stringify(built.quality)); const aw = q2.assets.find((x) => x.activation_status !== 'active'); if (aw) { aw.activation_status = 'active'; aw.series_hash = null; } else { q2.assets[0].series_hash = 'x'; }
  T('fake activation rejected', validateAssetActivation(q2, charts).length > 0 || validateDataQuality(q2, charts).length > 0);
  const q3 = JSON.parse(JSON.stringify(built.quality)); q3.assets[0].coverage_label = 'spicy';
  T('bad label rejected', validateDataQuality(q3, charts).length > 0);
  console.log(`[data-coverage] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const arg = process.argv.find((x) => x.startsWith('--check='));
  const which = arg ? arg.slice(8) : null;
  if (!which) { console.error('[data-coverage] usage: --check=provider-coverage|data-quality|asset-activation|chart-coverage'); process.exit(2); }
  if (!fs.existsSync(F.manifest)) { console.log(`[${which}] no manifest yet — nothing to validate (non-fatal).`); process.exit(0); }
  const failures = runCheck(which);
  if (failures.length) { failures.forEach((m) => console.error(`[${which}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${which}] check:${which} passed.`);
}

module.exports = { validateProviderCoverage, validateDataQuality, validateAssetActivation, validateChartCoverage };
