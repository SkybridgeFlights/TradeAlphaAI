'use strict';

// Phase 214 CP2 — ETF OHLCV chart builder.
// Reuses the institutional chart engine and approved provider fetch helpers.
// Real OHLCV only; missing provider data is recorded as unavailable, never
// replaced with synthetic or placeholder bars.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');
const eng = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const OUT_DIR = path.join(ROOT, 'data', 'visual', 'etf-charts');
const WRITE = process.argv.includes('--write');
const FETCH = process.argv.includes('--fetch');
const MIN_BARS = eng.MIN_BARS;

function chartId(symbol) { return `${String(symbol).toLowerCase()}-etf`; }

function specFor(etf) {
  return {
    id: chartId(etf.symbol),
    symbol: etf.symbol,
    visual_type: 'etf_structure',
    title_en: `${etf.symbol} ETF observed structure`,
    title_ar: `البنية المرصودة لصندوق ${etf.symbol}`,
    allowed_surfaces: ['etfs', 'research/etfs', 'market-map/etfs'],
    related_topics: [etf.slug, etf.category, etf.exposure_type]
  };
}

async function sourceForEtf(symbol) {
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
    } catch { /* no cached manifest */ }
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
    { name: 'Yahoo', keyless: true, run: () => eng.fetchYahoo(symbol) }
  ];
  for (const provider of providers) {
    if (!provider.keyless && !provider.key) { diagnostic.attempts.push({ provider: provider.name, outcome: 'no_key' }); continue; }
    try {
      const result = await provider.run();
      const bars = result ? eng.normalizeSeries(result.rows).length : 0;
      if (result && bars >= MIN_BARS) {
        diagnostic.attempts.push({ provider: provider.name, outcome: 'ok', bars_found: bars });
        diagnostic.resolved = { provider: provider.name, bars_found: bars, response_hash: result.source.response_hash };
        return { result, diagnostic };
      }
      diagnostic.attempts.push({ provider: provider.name, outcome: bars > 0 ? 'insufficient_bars' : 'empty', bars_found: bars });
    } catch (error) {
      const outcome = eng.classifyProviderError(error.message);
      if (outcome === 'rate_limited') diagnostic.rate_limited = true;
      diagnostic.attempts.push({ provider: provider.name, outcome, note: String(error.message || '').slice(0, 100) });
    }
  }
  diagnostic.reason = diagnostic.rate_limited ? 'rate_limited' : 'approved_ohlcv_unavailable';
  return { result: null, diagnostic };
}

async function build() {
  const rendered = [];
  const unavailable = [];
  const diagnostics = [];
  for (const etf of ETFS) {
    const { result: sourced, diagnostic } = await sourceForEtf(etf.symbol);
    diagnostics.push(diagnostic);
    if (!sourced) { unavailable.push({ symbol: etf.symbol, reason: diagnostic.reason || 'approved_ohlcv_unavailable' }); continue; }
    const built = eng.buildChart(specFor(etf), sourced.rows, sourced.source);
    if (!built) { diagnostic.reason = 'insufficient_valid_bars'; unavailable.push({ symbol: etf.symbol, reason: 'insufficient_valid_bars' }); continue; }
    const id = chartId(etf.symbol);
    built.chart.files = { en: `data/visual/etf-charts/${id}-en.svg`, ar: `data/visual/etf-charts/${id}-ar.svg` };
    built.chart.etf_slug = etf.slug;
    built.chart.etf_category = etf.category;
    rendered.push(built);
  }
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-charts',
    status: rendered.length ? (unavailable.length ? 'partial' : 'available') : 'unavailable',
    source_policy: 'Approved provider OHLCV only; unavailable symbols remain unavailable.',
    charts: rendered.map((item) => item.chart),
    unavailable,
    provider_health: {
      mode: FETCH ? 'fetch' : 'offline',
      checked_at: new Date().toISOString(),
      etfs_total: ETFS.length,
      etfs_available: rendered.length,
      etfs_unavailable: unavailable.length,
      rate_limited: diagnostics.some((item) => item.rate_limited)
    },
    diagnostics,
    _svg: rendered.map((item) => ({ files: item.chart.files, svg: item.svg }))
  };
}

async function main() {
  const result = await build();
  console.log(`[etf-charts] status=${result.status} charts=${result.charts.length} unavailable=${result.unavailable.length}`);
  if (!WRITE) return;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const keep = new Set();
  for (const item of result._svg) {
    for (const loc of ['en', 'ar']) {
      const abs = path.join(ROOT, item.files[loc]);
      keep.add(path.basename(abs));
      fs.writeFileSync(abs, item.svg[loc], 'utf8');
    }
  }
  for (const file of fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []) {
    if (file.endsWith('.svg') && !keep.has(file)) fs.unlinkSync(path.join(OUT_DIR, file));
  }
  const persisted = { ...result };
  delete persisted._svg;
  fs.writeFileSync(OUT, `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  console.log(`[etf-charts] wrote manifest + ${result.charts.length * 2} SVG(s)`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[etf-charts] ${error.stack || error.message}`);
    process.exit(1);
  });
}

module.exports = { build, specFor, chartId };
