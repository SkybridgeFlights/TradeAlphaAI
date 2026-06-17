'use strict';

// Phase 207 / Workstreams B+C+D — asset / sector / equity history engines.
// For every entity, derives REAL historical trends from its own sourced OHLCV
// series (overall strength trend + per-dimension structure/tactical/liquidity/
// participation/score trends + per-window strength). Honest indeterminate when
// the series is too short. No predictions.
//
// Outputs: data/intelligence/{asset,sector,equity}-history.json
// Usage:   node tools/build-history-engines.js [--write]

const fs = require('fs');
const path = require('path');
const { seriesHistory, dimensionTrends, TREND, BAND, WINDOWS } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const OUT = (type) => path.join(ROOT, 'data', 'intelligence', `${type}-history.json`);
const WRITE = process.argv.includes('--write');

const SOURCES = {
  asset: { registry: './asset-registry', key: 'ASSETS', charts: 'data/visual/institutional-charts.json' },
  sector: { registry: './sector-registry', key: 'SECTORS', charts: 'data/visual/sector-charts.json' },
  equity: { registry: './equity-registry', key: 'EQUITIES', charts: 'data/visual/equity-charts.json' },
};

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function trendObj(state) { return { state, label_en: TREND[state][0], label_ar: TREND[state][1] }; }

function entityHistory(symbol, slug, chart) {
  if (!chart || !Array.isArray(chart.series)) {
    return { symbol, slug, available: false, overall: trendObj('indeterminate'), confidence_band: 'indeterminate', confidence_band_en: BAND.indeterminate[0], confidence_band_ar: BAND.indeterminate[1], dimension_trends: {}, windows: {}, evidence: ['no verified chart'] };
  }
  const hist = seriesHistory(chart.series);
  const dims = dimensionTrends(chart.series) || {};
  const dimension_trends = {};
  for (const k of ['structure', 'tactical', 'liquidity', 'participation', 'score']) dimension_trends[k] = trendObj(dims[k] || 'indeterminate');
  return {
    symbol, slug, available: hist.now !== null,
    overall: trendObj(hist.overall),
    confidence_band: hist.band, confidence_band_en: BAND[hist.band][0], confidence_band_ar: BAND[hist.band][1],
    dimension_trends,
    windows: hist.windows,
    evidence: [dims._evidence || `current strength ${hist.now}`, `windows resolved ${hist.resolved}/${Object.keys(WINDOWS).length}`],
  };
}

function buildType(type) {
  const src = SOURCES[type];
  const reg = require(src.registry);
  const entities = reg[src.key];
  const manifest = readJson(path.join(ROOT, src.charts), {});
  const chartBySymbol = new Map(((manifest && manifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const items = entities.map((e) => entityHistory(e.symbol, e.slug, chartBySymbol.get(e.symbol) || null));
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: `${type}-history`,
    available: items.some((x) => x.available), total: items.length, available_count: items.filter((x) => x.available).length,
    windows: Object.keys(WINDOWS), items,
    attribution: { sources: [src.charts], note: 'Deterministic historical trends from observed OHLCV windows. Educational context, not a forecast or recommendation.' },
  };
}

function build() { return { asset: buildType('asset'), sector: buildType('sector'), equity: buildType('equity') }; }

if (require.main === module) {
  const r = build();
  for (const t of ['asset', 'sector', 'equity']) { console.log(`[history-engines] ${t}: ${r[t].available_count}/${r[t].total} | sample:`, r[t].items.slice(0, 3).map((x) => `${x.symbol}=${x.overall.state}`).join(', ')); if (WRITE) fs.writeFileSync(OUT(t), `${JSON.stringify(r[t], null, 2)}\n`); }
  if (WRITE) console.log('[history-engines] wrote 3 artifacts');
}

module.exports = { build, buildType, entityHistory };
