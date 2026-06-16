'use strict';

// Phase 202 — real per-asset intelligence layers. Derives INDEPENDENT structure,
// tactical and liquidity reads for each registry asset directly from THAT asset's
// own sourced OHLCV series (trend, range position, ATR, volume) — not shared
// global labels. An asset with no verified chart is honestly `indeterminate`
// (no fabrication). Also emits a per-asset availability matrix.
//
// Outputs:
//   data/intelligence/asset-structure.json
//   data/intelligence/asset-tactical.json
//   data/intelligence/asset-liquidity.json
// Usage: node tools/build-asset-layers.js [--write]

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const OUT = {
  structure: path.join(ROOT, 'data', 'intelligence', 'asset-structure.json'),
  tactical: path.join(ROOT, 'data', 'intelligence', 'asset-tactical.json'),
  liquidity: path.join(ROOT, 'data', 'intelligence', 'asset-liquidity.json'),
};
const WRITE = process.argv.includes('--write');

// ── Label maps (EN/AR) — exported for the validators. ──
const STRUCTURE_STATES = {
  expansion: ['range expansion higher', 'توسّع النطاق صعوداً'],
  breakdown: ['range breakdown lower', 'كسر النطاق هبوطاً'],
  range_bound: ['holding inside the observed range', 'ضمن النطاق المرصود'],
  indeterminate: ['indeterminate', 'غير محدد'],
};
const TACTICAL_DIMS = {
  directional_pressure: { building: ['building', 'متصاعد'], steady: ['steady', 'ثابت'], fading: ['fading', 'متلاشٍ'], indeterminate: ['indeterminate', 'غير محدد'] },
  continuation: { continuation: ['continuation', 'استمرار'], fragile_continuation: ['fragile continuation', 'استمرار هش'], exhaustion_risk: ['exhaustion risk', 'خطر استنفاد'], indeterminate: ['indeterminate', 'غير محدد'] },
  participation_quality: { broad: ['broad', 'واسعة'], narrowing: ['narrowing', 'آخذة في التضيّق'], mixed: ['mixed', 'مختلطة'], indeterminate: ['indeterminate', 'غير محدد'] },
  confirmation_quality: { confirmed: ['confirmed', 'مؤكَّد'], partial: ['partial', 'جزئي'], divergent: ['divergent', 'متباعد'], indeterminate: ['indeterminate', 'غير محدد'] },
  liquidity_support: { supportive: ['supportive', 'داعمة'], neutral: ['neutral', 'محايدة'], draining: ['draining', 'تنزف'], indeterminate: ['indeterminate', 'غير محدد'] },
  positioning_fragility: { contained: ['contained', 'محتواة'], elevated: ['elevated', 'مرتفعة'], fragile: ['fragile', 'هشّة'], indeterminate: ['indeterminate', 'غير محدد'] },
};
const LIQUIDITY_DIMS = {
  condition: { stable: ['stable', 'مستقرة'], thinning: ['thinning', 'متناقصة'], indeterminate: ['indeterminate', 'غير محدد'] },
  quality: { healthy: ['healthy', 'سليمة'], deteriorating: ['deteriorating', 'تتدهور'], indeterminate: ['indeterminate', 'غير محدد'] },
  stress: { contained: ['contained', 'محتوى'], elevated: ['elevated', 'مرتفع'], indeterminate: ['indeterminate', 'غير محدد'] },
  support: { supportive: ['supportive', 'داعمة'], neutral: ['neutral', 'محايدة'], draining: ['draining', 'تنزف'], indeterminate: ['indeterminate', 'غير محدد'] },
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function avg(a) { const c = a.filter(Number.isFinite); return c.length ? c.reduce((s, v) => s + v, 0) / c.length : null; }
function trueRanges(series) { return series.map((b, i) => { const prior = i ? series[i - 1].close : b.open; return Math.max(b.high - b.low, Math.abs(b.high - prior), Math.abs(b.low - prior)); }); }

// Per-asset computed features from the asset's OWN series.
function features(series) {
  if (!Array.isArray(series) || series.length < 35) return null;
  const last = series.at(-1);
  const prior = series.slice(-40, -20);
  const recent = series.slice(-20);
  const priorHigh = Math.max(...prior.map((b) => b.high));
  const priorLow = Math.min(...prior.map((b) => b.low));
  const ranges = trueRanges(series);
  const recentAtr = avg(ranges.slice(-10));
  const priorAtr = avg(ranges.slice(-40, -10));
  const recentVol = avg(recent.slice(-10).map((b) => b.volume).filter((v) => v > 0));
  const priorVol = avg(series.slice(-40, -10).map((b) => b.volume).filter((v) => v > 0));
  const last5 = avg(series.slice(-5).map((b) => b.close));
  const prev5 = avg(series.slice(-10, -5).map((b) => b.close));
  return {
    as_of: last.date,
    structure: last.close > priorHigh ? 'expansion' : last.close < priorLow ? 'breakdown' : 'range_bound',
    trend: last5 != null && prev5 != null ? (last5 > prev5 * 1.004 ? 'up' : last5 < prev5 * 0.996 ? 'down' : 'flat') : 'flat',
    compression: recentAtr != null && priorAtr != null && priorAtr > 0 ? recentAtr / priorAtr <= 0.72 : false,
    expansionVol: recentAtr != null && priorAtr != null && priorAtr > 0 ? recentAtr / priorAtr >= 1.3 : false,
    thinning: recentVol != null && priorVol != null && priorVol > 0 ? recentVol / priorVol <= 0.72 : false,
    volRatio: recentVol != null && priorVol != null && priorVol > 0 ? Number((recentVol / priorVol).toFixed(2)) : null,
    atrRatio: recentAtr != null && priorAtr != null && priorAtr > 0 ? Number((recentAtr / priorAtr).toFixed(2)) : null,
  };
}

function dim(map, key, state, evidence) { return { state, label_en: map[key][state][0], label_ar: map[key][state][1], evidence }; }

function deriveStructure(symbol, f) {
  if (!f) return { symbol, available: false, state: 'indeterminate', label_en: STRUCTURE_STATES.indeterminate[0], label_ar: STRUCTURE_STATES.indeterminate[1], confidence_band: 'indeterminate', confidence_band_en: BAND.indeterminate[0], confidence_band_ar: BAND.indeterminate[1], supporting: {}, evidence: ['no verified OHLCV chart for this asset'] };
  const evidence = [`observed close vs prior 20-session range (as of ${f.as_of})`, `trend(5v5)=${f.trend}`, `ATR ratio=${f.atrRatio}`];
  return {
    symbol, available: true, state: f.structure,
    label_en: STRUCTURE_STATES[f.structure][0], label_ar: STRUCTURE_STATES[f.structure][1],
    confidence_band: 'high', confidence_band_en: BAND.high[0], confidence_band_ar: BAND.high[1],
    supporting: { trend: f.trend, volatility: f.compression ? 'compressing' : f.expansionVol ? 'expanding' : 'steady' },
    evidence,
  };
}

function deriveTactical(symbol, f, crossRow, coherence) {
  if (!f) return { symbol, available: false, confidence_band: 'indeterminate', confidence_band_en: BAND.indeterminate[0], confidence_band_ar: BAND.indeterminate[1], dimensions: {}, evidence: ['no verified OHLCV chart for this asset'] };
  const dp = f.trend === 'up' ? 'building' : f.trend === 'down' ? 'fading' : 'steady';
  const cont = f.structure === 'breakdown' ? 'exhaustion_risk' : (f.structure === 'range_bound' && f.compression) ? 'fragile_continuation' : f.structure === 'expansion' ? 'continuation' : 'fragile_continuation';
  const part = f.thinning ? 'narrowing' : 'mixed';
  const chg = crossRow && typeof crossRow.change_pct === 'number' ? crossRow.change_pct : null;
  const dir = (coherence && coherence.direction) || 'indeterminate';
  let conf = 'indeterminate';
  if (chg !== null && dir !== 'indeterminate') {
    const agree = (dir === 'risk_on' && chg > 0) || (dir === 'risk_off' && chg < 0);
    conf = agree ? 'confirmed' : 'divergent';
  } else if (chg !== null) conf = 'partial';
  const liq = f.thinning ? 'draining' : 'neutral';
  const frag = f.compression ? 'elevated' : f.expansionVol ? 'elevated' : 'contained';
  const dims = {
    directional_pressure: dim(TACTICAL_DIMS, 'directional_pressure', dp, [`trend(5v5)=${f.trend}`]),
    continuation: dim(TACTICAL_DIMS, 'continuation', cont, [`structure=${f.structure}`, `compression=${f.compression}`]),
    participation_quality: dim(TACTICAL_DIMS, 'participation_quality', part, [`volume ratio=${f.volRatio}`]),
    confirmation_quality: dim(TACTICAL_DIMS, 'confirmation_quality', conf, [chg !== null ? `cross-asset change=${chg}% vs tape ${dir}` : 'no cross-asset change']),
    liquidity_support: dim(TACTICAL_DIMS, 'liquidity_support', liq, [`volume ratio=${f.volRatio}`]),
    positioning_fragility: dim(TACTICAL_DIMS, 'positioning_fragility', frag, [`ATR ratio=${f.atrRatio}`]),
  };
  return { symbol, available: true, confidence_band: 'high', confidence_band_en: BAND.high[0], confidence_band_ar: BAND.high[1], dimensions: dims, evidence: [`derived from ${symbol} observed OHLCV (as of ${f.as_of})`] };
}

function deriveLiquidity(symbol, f) {
  if (!f) return { symbol, available: false, confidence_band: 'indeterminate', confidence_band_en: BAND.indeterminate[0], confidence_band_ar: BAND.indeterminate[1], dimensions: {}, evidence: ['no verified OHLCV chart for this asset'] };
  const condition = f.thinning ? 'thinning' : 'stable';
  const quality = f.thinning ? 'deteriorating' : 'healthy';
  const stress = (f.thinning && (f.compression || f.expansionVol)) ? 'elevated' : 'contained';
  const support = f.thinning ? 'draining' : 'neutral';
  const dims = {
    condition: dim(LIQUIDITY_DIMS, 'condition', condition, [`recent vs prior volume ratio=${f.volRatio}`]),
    quality: dim(LIQUIDITY_DIMS, 'quality', quality, [`volume ratio=${f.volRatio}`]),
    stress: dim(LIQUIDITY_DIMS, 'stress', stress, [`volume ratio=${f.volRatio}`, `ATR ratio=${f.atrRatio}`]),
    support: dim(LIQUIDITY_DIMS, 'support', support, [`volume ratio=${f.volRatio}`]),
  };
  return { symbol, available: true, confidence_band: 'high', confidence_band_en: BAND.high[0], confidence_band_ar: BAND.high[1], dimensions: dims, evidence: [`derived from ${symbol} observed volume/ATR (as of ${f.as_of})`] };
}

function build() {
  const chartsManifest = readJson(CHARTS, {});
  const cross = readJson(CROSS, {});
  const coherence = (cross && cross.coherence) || {};
  const chartBySymbol = new Map(((chartsManifest && chartsManifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));

  const structure = []; const tactical = []; const liquidity = []; const matrix = [];
  for (const asset of ASSETS) {
    const chart = chartBySymbol.get(asset.symbol) || null;
    const f = chart ? features(chart.series) : null;
    const crossRow = ((cross && cross.assets) || []).find((a) => a.asset === asset.cross_key);
    structure.push(deriveStructure(asset.symbol, f));
    tactical.push(deriveTactical(asset.symbol, f, crossRow, coherence));
    liquidity.push(deriveLiquidity(asset.symbol, f));
    matrix.push({
      symbol: asset.symbol,
      chart: !!chart,
      structure: !!f,
      tactical: !!f,
      liquidity: !!f,
      cross_asset: !!(crossRow && typeof crossRow.change_pct === 'number' && Number.isFinite(crossRow.change_pct)),
    });
  }
  const stamp = new Date().toISOString();
  const wrap = (layer, items) => ({
    schema_version: '1.0', generated_at: stamp, source_layer: `asset-${layer}`,
    available: items.some((x) => x.available), assets_total: items.length, assets_available: items.filter((x) => x.available).length,
    assets: items, availability_matrix: matrix,
    attribution: { sources: ['data/visual/institutional-charts.json', 'data/intelligence/cross-asset-state.json'], note: 'Deterministic per-asset read from observed OHLCV. Educational context, not a recommendation, forecast or trade instruction.' },
  });
  return { structure: wrap('structure', structure), tactical: wrap('tactical', tactical), liquidity: wrap('liquidity', liquidity) };
}

if (require.main === module) {
  const r = build();
  for (const k of ['structure', 'tactical', 'liquidity']) console.log(`[asset-layers] ${k}: available=${r[k].available} ${r[k].assets_available}/${r[k].assets_total}`);
  if (WRITE) { for (const k of ['structure', 'tactical', 'liquidity']) fs.writeFileSync(OUT[k], `${JSON.stringify(r[k], null, 2)}\n`, 'utf8'); console.log('[asset-layers] wrote 3 artifacts'); }
}

module.exports = { build, features, deriveStructure, deriveTactical, deriveLiquidity, STRUCTURE_STATES, TACTICAL_DIMS, LIQUIDITY_DIMS, BAND };
