'use strict';

// Phase 201 / Workstream D — deterministic institutional asset intelligence
// scoring. NOT a trading signal. For each registry asset it composes qualitative
// component sub-states (structure, tactical, liquidity, participation,
// cross-asset alignment, data quality) from VERIFIED artifacts into a 5-level
// score_label (very weak / weak / neutral / constructive / strong) — or
// `unavailable` when the asset has no per-asset evidence. No buy/sell, no price
// target, no numeric precision, no prediction. Degrades honestly.
//
// Output: data/intelligence/asset-intelligence.json
// Usage:  node tools/build-asset-intelligence.js [--write]

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const TACTICAL = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'asset-intelligence.json');
const WRITE = process.argv.includes('--write');

const SCORE_LABELS = {
  very_weak: ['very weak', 'ضعيف جداً'], weak: ['weak', 'ضعيف'], neutral: ['neutral', 'محايد'],
  constructive: ['constructive', 'بنّاء'], strong: ['strong', 'قوي'], unavailable: ['unavailable', 'غير متاح'],
};
const COMP_LABELS = {
  constructive: ['constructive', 'بنّاء'], neutral: ['neutral', 'محايد'],
  pressured: ['pressured', 'تحت ضغط'], unavailable: ['unavailable', 'غير متاح'],
};
const DQ_LABELS = { high: ['high', 'عالية'], medium: ['medium', 'متوسطة'], low: ['low', 'منخفضة'], unavailable: ['unavailable', 'غير متاح'] };
const RISK_ASSETS = new Set(['SPY', 'QQQ', 'IWM']); // the rest are defensive/macro hedges

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function comp(state, evidence) { return { state, label_en: COMP_LABELS[state][0], label_ar: COMP_LABELS[state][1], evidence }; }

function structureComponent(chart) {
  if (!chart) return comp('unavailable', ['no verified institutional chart for this asset']);
  const s = (chart.overlays || []).find((o) => o.type === 'structure');
  const st = s ? s.state : 'inside';
  const state = st === 'expansion_up' ? 'constructive' : st === 'expansion_down' ? 'pressured' : 'neutral';
  return comp(state, [`institutional-chart structure overlay: ${st} (as of ${chart.as_of})`]);
}

function tacticalComponent(tactical) {
  if (!tactical || tactical.available !== true) return comp('unavailable', ['tactical-context unavailable']);
  const bias = tactical.dimensions && tactical.dimensions.tactical_bias ? tactical.dimensions.tactical_bias.state : 'indeterminate';
  const state = bias === 'supportive' ? 'constructive' : ['cautious', 'defensive'].includes(bias) ? 'pressured' : 'neutral';
  return comp(state, [`tactical-context bias: ${bias}`]);
}

function liquidityComponent(regime) {
  const liq = regime ? regime.liquidity_state : null;
  if (!liq) return comp('unavailable', ['liquidity-regime unavailable']);
  const state = ['ample', 'supportive'].includes(liq) ? 'constructive' : ['tightening', 'draining', 'constrained'].includes(liq) ? 'pressured' : 'neutral';
  return comp(state, [`liquidity-regime: ${liq}`]);
}

function participationComponent(regime) {
  const breadth = regime && regime.sub_states ? regime.sub_states.breadth : null;
  if (!breadth) return comp('unavailable', ['breadth sub-state unavailable']);
  const b = String(breadth);
  const state = /broad|expand|healthy/i.test(b) ? 'constructive' : /narrow|deterior|weak|thin/i.test(b) ? 'pressured' : 'neutral';
  return comp(state, [`liquidity-regime breadth: ${b}`]);
}

function crossAlignmentComponent(asset, cross) {
  const row = ((cross && cross.assets) || []).find((a) => a.asset === asset.cross_key);
  const chg = row && typeof row.change_pct === 'number' && Number.isFinite(row.change_pct) ? row.change_pct : null;
  const direction = (cross && cross.coherence && cross.coherence.direction) || 'indeterminate';
  if (chg === null || direction === 'indeterminate') return comp('unavailable', [`cross-asset change/direction unavailable for ${asset.cross_key}`]);
  const isRisk = RISK_ASSETS.has(asset.symbol);
  // Aligned = moving coherently with the tape given the asset's risk role.
  const up = chg > 0;
  const aligned = direction === 'risk_on' ? (isRisk ? up : !up) : (isRisk ? !up : up);
  return comp(aligned ? 'constructive' : 'pressured', [`cross-asset: ${asset.cross_key}=${chg}% vs tape ${direction} (${isRisk ? 'risk' : 'defensive'} role)`]);
}

function aggregate(components, dataQuality) {
  if (dataQuality === 'unavailable') return 'unavailable';
  const vals = components.map((c) => (c.state === 'constructive' ? 1 : c.state === 'pressured' ? -1 : c.state === 'neutral' ? 0 : null)).filter((v) => v !== null);
  if (!vals.length) return 'unavailable';
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  if (avg >= 0.6) return 'strong';
  if (avg >= 0.2) return 'constructive';
  if (avg > -0.2) return 'neutral';
  if (avg > -0.6) return 'weak';
  return 'very_weak';
}

function build() {
  const chartsManifest = readJson(CHARTS, {});
  const regime = readJson(REGIME, {});
  const tactical = readJson(TACTICAL, {});
  const cross = readJson(CROSS, {});
  const chartBySymbol = new Map(((chartsManifest && chartsManifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));

  const assets = ASSETS.map((asset) => {
    const chart = chartBySymbol.get(asset.symbol) || null;
    const crossRow = ((cross && cross.assets) || []).find((a) => a.asset === asset.cross_key);
    const hasCross = crossRow && typeof crossRow.change_pct === 'number' && Number.isFinite(crossRow.change_pct);
    const dataQuality = chart ? 'high' : hasCross ? 'medium' : 'unavailable';

    const components = {
      structure: structureComponent(chart),
      tactical: tacticalComponent(tactical),
      liquidity: liquidityComponent(regime),
      participation: participationComponent(regime),
      cross_asset_alignment: crossAlignmentComponent(asset, cross),
    };
    // Per-asset signal requires the asset's OWN structure (chart) or its own
    // cross-asset move; global-only context never fabricates a per-asset score.
    const scoreList = [components.structure, components.tactical, components.liquidity, components.participation, components.cross_asset_alignment];
    const score = aggregate(scoreList, dataQuality);
    const unavailable_reason = score === 'unavailable'
      ? (chart ? null : (chartsManifest.unavailable || []).find((u) => u.symbol === asset.symbol)?.reason || 'no_asset_specific_evidence')
      : null;

    const evidence = Object.values(components).flatMap((c) => c.evidence);
    return {
      symbol: asset.symbol, slug: asset.slug,
      role_en: asset.role_en, role_ar: asset.role_ar,
      has_chart: !!chart,
      chart_id: chart ? chart.id : null,
      as_of: chart ? chart.as_of : null,
      series_hash: chart ? chart.series_hash : null,
      data_quality: dataQuality,
      data_quality_en: DQ_LABELS[dataQuality][0], data_quality_ar: DQ_LABELS[dataQuality][1],
      score_label: score,
      score_label_en: SCORE_LABELS[score][0], score_label_ar: SCORE_LABELS[score][1],
      score_components: components,
      unavailable_reason,
      evidence,
    };
  });

  const scored = assets.filter((a) => a.score_label !== 'unavailable').length;
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'asset-intelligence',
    available: scored > 0,
    assets_total: assets.length,
    assets_scored: scored,
    assets,
    attribution: {
      sources: ['data/visual/institutional-charts.json', 'data/intelligence/liquidity-regime.json', 'data/intelligence/tactical-context.json', 'data/intelligence/cross-asset-state.json'],
      note: 'Deterministic institutional asset scoring. Qualitative labels only — not a recommendation, forecast or trade instruction. Degrades to unavailable when per-asset evidence is missing.',
    },
  };
}

if (require.main === module) {
  const result = build();
  console.log(`[asset-intelligence] available=${result.available} scored=${result.assets_scored}/${result.assets_total}`);
  for (const a of result.assets) console.log(`  ${a.symbol.padEnd(4)} ${a.score_label.padEnd(12)} dq=${a.data_quality}${a.unavailable_reason ? ' reason=' + a.unavailable_reason : ''}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8'); console.log(`[asset-intelligence] wrote ${path.relative(ROOT, OUT)}`); }
}

module.exports = { build, SCORE_LABELS, COMP_LABELS, DQ_LABELS };
