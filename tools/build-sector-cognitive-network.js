'use strict';

// Phase 205 / Workstream E — sector cognitive network. Classifies each sector ↔
// broad-asset relationship (confirm/inverse) from observed change, grouped into
// leadership / defensive / cyclical / macro-sensitivity / confirmation /
// contradiction chains. Deterministic, evidence-backed; no forecast/signal.
//
// Output: data/intelligence/sector-cognitive-network.json
// Usage:  node tools/build-sector-cognitive-network.js [--write]

const fs = require('fs');
const path = require('path');
const { SECTOR_RELATIONSHIPS } = require('./sector-registry');

const ROOT = path.resolve(__dirname, '..');
const SECTOR_CHARTS = path.join(ROOT, 'data', 'visual', 'sector-charts.json');
const ASSET_CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'sector-cognitive-network.json');
const WRITE = process.argv.includes('--write');

const REL_STATE = { confirmation: ['confirmation', 'تأكيد'], contradiction: ['contradiction', 'تناقض'], evidence_unavailable: ['evidence unavailable', 'الأدلة غير متاحة'] };
const DOMINANT = {
  broad_confirmation: ['broad sector confirmation', 'تأكيد قطاعي واسع'],
  cyclical_tilt: ['cyclical tilt', 'ميل دوري'], defensive_tilt: ['defensive tilt', 'ميل دفاعي'],
  cross_sector_divergence: ['cross-sector divergence', 'تباعد بين القطاعات'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'],
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lastChange(chart) { const s = chart && Array.isArray(chart.series) ? chart.series : null; if (!s || s.length < 2) return null; const a = s.at(-1).close; const b = s.at(-2).close; return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? Number((((a - b) / b) * 100).toFixed(4)) : null; }
function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

function build() {
  const sm = readJson(SECTOR_CHARTS, {});
  const am = readJson(ASSET_CHARTS, {});
  const cross = readJson(CROSS, {});
  const sectorChart = new Map(((sm && sm.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const assetChart = new Map(((am && am.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const stamp = new Date().toISOString();
  const assetChange = (sym) => {
    const c = assetChart.get(sym); const v = c ? lastChange(c) : null;
    if (v !== null) return { value: v, source: `chart:${sym}` };
    const row = ((cross && cross.assets) || []).find((a) => a.asset === sym);
    return row && typeof row.change_pct === 'number' && Number.isFinite(row.change_pct) ? { value: row.change_pct, source: `cross-asset-state:${sym}` } : null;
  };

  const relationships = SECTOR_RELATIONSHIPS.map((rel) => {
    const sChart = sectorChart.get(rel.sector);
    const sChg = sChart ? lastChange(sChart) : null;
    const aC = assetChange(rel.asset);
    let state = 'evidence_unavailable';
    if (sChg !== null && aC) {
      const same = sign(sChg) === sign(aC.value) && sign(sChg) !== 0;
      const opposite = sign(sChg) === -sign(aC.value) && sign(sChg) !== 0;
      state = rel.mode === 'inverse' ? (opposite ? 'confirmation' : 'contradiction') : (same ? 'confirmation' : 'contradiction');
    }
    const evidence = state === 'evidence_unavailable'
      ? [`${rel.sector} or ${rel.asset} observed change unavailable`]
      : [`${rel.sector}=${sChg}% , ${rel.asset}=${aC.value}% (${aC.source}) [${rel.mode}]`];
    return { id: rel.id, sector: rel.sector, asset: rel.asset, kind: rel.kind, mode: rel.mode, state, label_en: rel.en, label_ar: rel.ar, state_en: REL_STATE[state][0], state_ar: REL_STATE[state][1], evidence };
  });

  const withData = relationships.filter((r) => r.state !== 'evidence_unavailable');
  const chainOf = (pred) => relationships.filter(pred).filter((r) => r.state !== 'evidence_unavailable').map((r) => ({ id: r.id, label_en: r.label_en, label_ar: r.label_ar, state: r.state, evidence: r.evidence }));
  const confirmation_chains = chainOf((r) => r.state === 'confirmation');
  const contradiction_chains = chainOf((r) => r.state === 'contradiction');
  const leadership_chains = chainOf((r) => r.kind === 'leadership');
  const defensive_chains = chainOf((r) => r.kind === 'defensive');
  const cyclical_chains = chainOf((r) => r.kind === 'cyclical');
  const macro_sensitivity_chains = chainOf((r) => r.kind === 'macro');

  let state;
  if (!withData.length) state = 'indeterminate';
  else if (contradiction_chains.length > confirmation_chains.length) state = 'cross_sector_divergence';
  else if (defensive_chains.filter((c) => c.state === 'confirmation').length > cyclical_chains.filter((c) => c.state === 'confirmation').length) state = 'defensive_tilt';
  else if (cyclical_chains.filter((c) => c.state === 'confirmation').length > defensive_chains.filter((c) => c.state === 'confirmation').length) state = 'cyclical_tilt';
  else if (confirmation_chains.length >= Math.ceil(withData.length * 0.6)) state = 'broad_confirmation';
  else state = 'mixed';

  const coverage = withData.length / SECTOR_RELATIONSHIPS.length;
  const band = !withData.length ? 'indeterminate' : coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'moderate' : 'low';

  return {
    schema_version: '1.0', generated_at: stamp, source_layer: 'sector-cognitive-network', available: withData.length > 0,
    dominant_sector_state: { state, label_en: DOMINANT[state][0], label_ar: DOMINANT[state][1] },
    confidence_band: band, confidence_band_en: BAND[band][0], confidence_band_ar: BAND[band][1], coverage_pct: Math.round(coverage * 100),
    confirmation_chains, contradiction_chains, leadership_chains, defensive_chains, cyclical_chains, macro_sensitivity_chains,
    relationships,
    evidence: [`${withData.length}/${SECTOR_RELATIONSHIPS.length} sector↔asset relationships with data`],
    attribution: { sources: ['data/visual/sector-charts.json', 'data/visual/institutional-charts.json', 'data/intelligence/cross-asset-state.json'], note: 'Deterministic sector↔asset relationship composition. Educational context, not a forecast or recommendation.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[sector-cognitive] dominant=${r.dominant_sector_state.state} band=${r.confidence_band} coverage=${r.coverage_pct}% | conf=${r.confirmation_chains.length} contra=${r.contradiction_chains.length} lead=${r.leadership_chains.length} def=${r.defensive_chains.length} cyc=${r.cyclical_chains.length} macro=${r.macro_sensitivity_chains.length}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[sector-cognitive] wrote artifact'); }
}

module.exports = { build, REL_STATE, DOMINANT, BAND };
