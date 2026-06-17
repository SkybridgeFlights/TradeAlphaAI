'use strict';

// Phase 205 / Workstreams B+C — isolated equity institutional chart pipeline.
// Reuses the asset chart engine (buildChart/renderSvg) + fetch helpers, writing a
// SEPARATE manifest (data/visual/equity-charts.json) + SVG dir so the asset
// pipeline is untouched. Real OHLCV only (Yahoo keyless resilience tier + keyed
// providers when present); honest unavailable, no placeholder charts.
//
// Output: data/visual/equity-charts.json + data/visual/equity-charts/<id>-{en,ar}.svg
// Usage:  node tools/build-equity-charts.js [--fetch] [--write]

const fs = require('fs');
const path = require('path');
const { EQUITIES, chartId } = require('./equity-registry');
const eng = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const OUT_DIR = path.join(ROOT, 'data', 'visual', 'equity-charts');
const WRITE = process.argv.includes('--write');
const FETCH = process.argv.includes('--fetch');
const MIN_BARS = eng.MIN_BARS;

function specFor(sector) {
  return {
    id: chartId(sector.symbol), symbol: sector.symbol, visual_type: 'equity_structure',
    title_en: `${sector.name_en} observed price structure`,
    title_ar: `البنية المرصودة لسهم ${sector.name_ar}`,
    allowed_surfaces: ['equities'], related_topics: [sector.slug],
  };
}

async function sourceForSector(symbol) {
  const diagnostic = { symbol, attempts: [], resolved: null, rate_limited: false, checked_at: new Date().toISOString() };
  if (!FETCH) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
      const chart = (existing.charts || []).find((c) => c.symbol === symbol && Array.isArray(c.series));
      if (chart) {
        diagnostic.attempts.push({ provider: 'cached manifest', outcome: 'cached', bars_found: chart.series.length });
        diagnostic.resolved = { provider: (chart.attribution && chart.attribution.provider) || 'cached', bars_found: chart.series.length, cached: true };
        return { result: { rows: chart.series, source: chart.attribution }, diagnostic };
      }
    } catch { /* none */ }
    diagnostic.attempts.push({ provider: 'offline', outcome: 'not_attempted' });
    diagnostic.reason = 'unavailable_offline';
    return { result: null, diagnostic };
  }
  const now = Math.floor(Date.now() / 1000);
  const fromS = now - 220 * 86400;
  const fromD = new Date(fromS * 1000).toISOString().slice(0, 10);
  const toD = new Date(now * 1000).toISOString().slice(0, 10);
  const providers = [
    { name: 'FMP', key: process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY, run: () => eng.fetchFmp(symbol, fromD, toD, process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY) },
    { name: 'Finnhub', key: process.env.FINNHUB_API_KEY, run: () => eng.fetchFinnhub(symbol, fromS, now, process.env.FINNHUB_API_KEY) },
    { name: 'AlphaVantage', key: process.env.ALPHAVANTAGE_API_KEY, run: () => eng.fetchAlphaVantage(symbol, process.env.ALPHAVANTAGE_API_KEY) },
    { name: 'Yahoo', keyless: true, run: () => eng.fetchYahoo(symbol) },
  ];
  for (const p of providers) {
    if (!p.keyless && !p.key) { diagnostic.attempts.push({ provider: p.name, outcome: 'no_key' }); continue; }
    try {
      const result = await p.run();
      const bars = result ? eng.normalizeSeries(result.rows).length : 0;
      if (result && bars >= MIN_BARS) { diagnostic.attempts.push({ provider: p.name, outcome: 'ok', bars_found: bars }); diagnostic.resolved = { provider: p.name, bars_found: bars, response_hash: result.source.response_hash }; return { result, diagnostic }; }
      diagnostic.attempts.push({ provider: p.name, outcome: bars > 0 ? 'insufficient_bars' : 'empty', bars_found: bars });
    } catch (error) {
      const outcome = eng.classifyProviderError(error.message);
      if (outcome === 'rate_limited') diagnostic.rate_limited = true;
      diagnostic.attempts.push({ provider: p.name, outcome, note: String(error.message || '').slice(0, 100) });
    }
  }
  diagnostic.reason = diagnostic.rate_limited ? 'rate_limited' : 'approved_ohlcv_unavailable';
  return { result: null, diagnostic };
}

async function build() {
  const rendered = []; const unavailable = []; const diagnostics = [];
  for (const sector of EQUITIES) {
    const { result: sourced, diagnostic } = await sourceForSector(sector.symbol);
    diagnostics.push(diagnostic);
    if (!sourced) { unavailable.push({ symbol: sector.symbol, reason: diagnostic.reason || 'approved_ohlcv_unavailable' }); continue; }
    const built = eng.buildChart(specFor(sector), sourced.rows, sourced.source);
    if (!built) { diagnostic.reason = 'insufficient_valid_bars'; unavailable.push({ symbol: sector.symbol, reason: 'insufficient_valid_bars' }); continue; }
    const id = chartId(sector.symbol);
    built.chart.files = { en: `data/visual/equity-charts/${id}-en.svg`, ar: `data/visual/equity-charts/${id}-ar.svg` };
    built.chart.equity_slug = sector.slug;
    rendered.push(built);
  }
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(),
    status: rendered.length ? (unavailable.length ? 'partial' : 'available') : 'unavailable',
    source_policy: 'Approved provider OHLCV only; no inferred or placeholder bars.',
    max_charts_per_article: 2, max_overlays_per_chart: eng.MAX_OVERLAYS,
    charts: rendered.map((r) => r.chart), unavailable,
    provider_health: { mode: FETCH ? 'fetch' : 'offline', checked_at: new Date().toISOString(), assets_total: EQUITIES.length, assets_available: rendered.length, assets_unavailable: unavailable.length, rate_limited: diagnostics.some((d) => d.rate_limited) },
    diagnostics,
    _svg: rendered.map((r) => ({ files: r.chart.files, svg: r.svg })),
  };
}

async function main() {
  const result = await build();
  console.log(`[equity-charts] status=${result.status} charts=${result.charts.length} unavailable=${result.unavailable.length}`);
  if (!WRITE) return;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const keep = new Set();
  for (const item of result._svg) for (const loc of ['en', 'ar']) { const abs = path.join(ROOT, item.files[loc]); keep.add(path.basename(abs)); fs.writeFileSync(abs, item.svg[loc], 'utf8'); }
  for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.svg') && !keep.has(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  const persisted = { ...result }; delete persisted._svg;
  fs.writeFileSync(OUT, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  console.log(`[equity-charts] wrote manifest + ${result.charts.length * 2} SVG(s)`);
}

if (require.main === module) { main().catch((e) => { console.error(`[equity-charts] ${e.stack || e.message}`); process.exit(1); }); }

module.exports = { build, specFor };
