'use strict';

// Phase 206 / Workstream D — per-equity intelligence layers derived from each
// sector ETF's own sourced OHLCV (reuses the asset engine's features()). Honest
// indeterminate/unavailable when a sector has no verified chart. No advice.
//
// Outputs: data/intelligence/sector-{structure,tactical,liquidity,participation}.json
// Usage:   node tools/build-sector-layers.js [--write]

const fs = require('fs');
const path = require('path');
const { EQUITIES } = require('./equity-registry');
const { features } = require('./build-asset-layers');

const ROOT = path.resolve(__dirname, '..');
const CHARTS = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const OUT = (layer) => path.join(ROOT, 'data', 'intelligence', `equity-${layer}.json`);
const WRITE = process.argv.includes('--write');

const STATES = {
  strong: ['strong', 'قوي'], constructive: ['constructive', 'بنّاء'], neutral: ['neutral', 'محايد'],
  weak: ['weak', 'ضعيف'], defensive: ['defensive', 'دفاعي'], cyclical: ['cyclical', 'دوري'],
  fragile: ['fragile', 'هشّ'], indeterminate: ['indeterminate', 'غير محدد'], unavailable: ['unavailable', 'غير متاح'],
};
const BAND = { high: ['high', 'عالية'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function structureState(f) {
  if (!f) return 'unavailable';
  if (f.structure === 'expansion' && f.trend === 'up') return 'strong';
  if (f.structure === 'breakdown' && (f.compression || f.expansionVol)) return 'fragile';
  if (f.structure === 'expansion' || f.trend === 'up') return 'constructive';
  if (f.structure === 'breakdown' || f.trend === 'down') return 'weak';
  return 'neutral';
}
function tacticalState(f) {
  if (!f) return 'unavailable';
  if (f.structure === 'breakdown') return 'fragile';
  if (f.trend === 'up' && f.structure !== 'breakdown') return 'constructive';
  if (f.trend === 'down') return 'weak';
  return 'neutral';
}
function liquidityState(f) {
  if (!f) return 'unavailable';
  if (f.thinning && (f.compression || f.expansionVol)) return 'fragile';
  if (f.thinning) return 'weak';
  return 'constructive';
}
function participationState(f) {
  if (!f) return 'unavailable';
  if (f.thinning) return 'weak';
  if (f.trend === 'up') return 'strong';
  return 'constructive';
}

function entry(item, state, evidence) {
  const available = state !== 'unavailable';
  return {
    symbol: item.symbol, slug: item.slug, available,
    state, label_en: STATES[state][0], label_ar: STATES[state][1],
    confidence_band: available ? 'high' : 'indeterminate',
    confidence_band_en: BAND[available ? 'high' : 'indeterminate'][0], confidence_band_ar: BAND[available ? 'high' : 'indeterminate'][1],
    unavailable_reason: available ? null : 'no_verified_chart',
    evidence,
  };
}

function build() {
  const manifest = readJson(CHARTS, {});
  const chartBySymbol = new Map(((manifest && manifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const stamp = new Date().toISOString();
  const layers = { structure: [], tactical: [], liquidity: [], participation: [] };
  for (const item of EQUITIES) {
    const chart = chartBySymbol.get(item.symbol) || null;
    const f = chart ? features(chart.series) : null;
    const ev = f ? [`derived from ${item.symbol} observed OHLCV (as of ${f.as_of}); structure=${f.structure}, trend=${f.trend}, volRatio=${f.volRatio}`] : ['no verified equity chart'];
    layers.structure.push(entry(item, structureState(f), ev));
    layers.tactical.push(entry(item, tacticalState(f), ev));
    layers.liquidity.push(entry(item, liquidityState(f), ev));
    layers.participation.push(entry(item, participationState(f), ev));
  }
  const wrap = (layer, items) => ({
    schema_version: '1.0', generated_at: stamp, source_layer: `equity-${layer}`,
    available: items.some((x) => x.available), items_total: items.length, items_available: items.filter((x) => x.available).length,
    equities: items,
    attribution: { sources: ['data/visual/equity-charts.json'], note: 'Deterministic per-sector read from observed OHLCV. Educational context, not a recommendation, forecast or trade instruction.' },
  });
  return { structure: wrap('structure', layers.structure), tactical: wrap('tactical', layers.tactical), liquidity: wrap('liquidity', layers.liquidity), participation: wrap('participation', layers.participation) };
}

if (require.main === module) {
  const r = build();
  for (const k of ['structure', 'tactical', 'liquidity', 'participation']) console.log(`[equity-layers] ${k}: ${r[k].items_available}/${r[k].items_total} available`);
  if (WRITE) { for (const k of ['structure', 'tactical', 'liquidity', 'participation']) fs.writeFileSync(OUT(k), `${JSON.stringify(r[k], null, 2)}\n`); console.log('[equity-layers] wrote 4 artifacts'); }
}

module.exports = { build, STATES, BAND };
