'use strict';

// Phase 205 / Workstream D — sector rotation engine. Deterministic relative-
// strength read of each sector vs the broad market (SPY), grouped into leadership
// / weakening / defensive / cyclical rotation. Observed change only; no forecast,
// no signals. Honest indeterminate when data is missing.
//
// Output: data/intelligence/sector-rotation.json
// Usage:  node tools/build-sector-rotation.js [--write]

const fs = require('fs');
const path = require('path');
const { SECTORS } = require('./sector-registry');

const ROOT = path.resolve(__dirname, '..');
const SECTOR_CHARTS = path.join(ROOT, 'data', 'visual', 'sector-charts.json');
const ASSET_CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'sector-rotation.json');
const WRITE = process.argv.includes('--write');

const ROTATION = {
  broad_risk_participation: ['broad risk participation', 'مشاركة واسعة في المخاطر'],
  narrow_growth_leadership: ['narrow growth leadership', 'قيادة نمو ضيقة'],
  defensive_rotation: ['defensive rotation', 'تدوير دفاعي'],
  cyclical_recovery: ['cyclical recovery', 'تعافٍ دوري'],
  energy_led_inflation_pressure: ['energy-led inflation pressure', 'ضغط تضخمي بقيادة الطاقة'],
  mixed_rotation: ['mixed rotation', 'تدوير مختلط'],
  indeterminate: ['indeterminate', 'غير محدد'],
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lastChange(chart) {
  const s = chart && Array.isArray(chart.series) ? chart.series : null;
  if (!s || s.length < 2) return null;
  const last = s.at(-1).close; const prior = s.at(-2).close;
  return Number.isFinite(last) && Number.isFinite(prior) && prior !== 0 ? ((last - prior) / prior) * 100 : null;
}
function avg(a) { const c = a.filter((x) => Number.isFinite(x)); return c.length ? c.reduce((s, v) => s + v, 0) / c.length : null; }

function build() {
  const sm = readJson(SECTOR_CHARTS, {});
  const am = readJson(ASSET_CHARTS, {});
  const sectorChart = new Map(((sm && sm.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const spy = ((am && am.charts) || []).find((c) => c.symbol === 'SPY' && c.verified === true);
  const spyChg = lastChange(spy);
  const stamp = new Date().toISOString();

  const rows = SECTORS.map((sector) => {
    const chart = sectorChart.get(sector.symbol);
    const chg = chart ? lastChange(chart) : null;
    const rs = (chg !== null && spyChg !== null) ? Number((chg - spyChg).toFixed(4)) : null;
    return { symbol: sector.symbol, slug: sector.slug, group: sector.group, change_pct: chg !== null ? Number(chg.toFixed(4)) : null, relative_strength: rs };
  });
  const withData = rows.filter((r) => r.relative_strength !== null);
  const available = withData.length > 0 && spyChg !== null;
  if (!available) {
    return { schema_version: '1.0', generated_at: stamp, source_layer: 'sector-rotation', available: false, rotation_state: 'indeterminate', rotation_state_en: ROTATION.indeterminate[0], rotation_state_ar: ROTATION.indeterminate[1], confidence_band: 'indeterminate', confidence_band_en: BAND.indeterminate[0], confidence_band_ar: BAND.indeterminate[1], leadership_sectors: [], weakening_sectors: [], defensive_rotation: false, cyclical_rotation: false, narrow_leadership: false, broad_participation: false, sectors: rows, evidence: ['SPY or sector change unavailable'], attribution: { sources: ['data/visual/sector-charts.json', 'data/visual/institutional-charts.json'], note: 'Sector rotation is indeterminate without SPY + sector data.' } };
  }
  const sorted = [...withData].sort((a, b) => b.relative_strength - a.relative_strength);
  const leadership = sorted.filter((r) => r.relative_strength > 0).slice(0, 4).map((r) => ({ symbol: r.symbol, slug: r.slug, relative_strength: r.relative_strength, evidence: [`${r.symbol} change=${r.change_pct}% vs SPY=${Number(spyChg.toFixed(4))}% → RS=${r.relative_strength}`] }));
  const weakening = sorted.filter((r) => r.relative_strength < 0).slice(-4).reverse().map((r) => ({ symbol: r.symbol, slug: r.slug, relative_strength: r.relative_strength, evidence: [`${r.symbol} change=${r.change_pct}% vs SPY=${Number(spyChg.toFixed(4))}% → RS=${r.relative_strength}`] }));

  const groupRS = (g) => avg(withData.filter((r) => r.group === g).map((r) => r.relative_strength));
  const defRS = groupRS('defensive'); const rateRS = groupRS('rate_sensitive'); const cycRS = groupRS('cyclical'); const growthRS = groupRS('growth');
  const defensiveAvg = avg([defRS, rateRS].filter((x) => x !== null));
  const positives = withData.filter((r) => r.change_pct > 0).length;
  const broad_participation = positives >= Math.ceil(withData.length * 0.6);
  const energy = withData.find((r) => r.symbol === 'XLE');
  const energyLeads = energy && sorted[0] && sorted[0].symbol === 'XLE' && energy.change_pct > 0;
  const xlk = withData.find((r) => r.symbol === 'XLK');
  const narrow_leadership = !!(xlk && xlk.relative_strength > 0 && positives <= Math.floor(withData.length * 0.4));
  const defensive_rotation = defensiveAvg !== null && cycRS !== null && defensiveAvg > cycRS && defensiveAvg > 0;
  const cyclical_rotation = cycRS !== null && defensiveAvg !== null && cycRS > defensiveAvg && cycRS > 0;

  let state;
  if (energyLeads) state = 'energy_led_inflation_pressure';
  else if (defensive_rotation) state = 'defensive_rotation';
  else if (broad_participation) state = 'broad_risk_participation';
  else if (narrow_leadership && (growthRS === null || growthRS >= 0)) state = 'narrow_growth_leadership';
  else if (cyclical_rotation) state = 'cyclical_recovery';
  else state = 'mixed_rotation';

  return {
    schema_version: '1.0', generated_at: stamp, source_layer: 'sector-rotation', available: true,
    rotation_state: state, rotation_state_en: ROTATION[state][0], rotation_state_ar: ROTATION[state][1],
    confidence_band: withData.length >= 8 ? 'high' : 'moderate', confidence_band_en: BAND[withData.length >= 8 ? 'high' : 'moderate'][0], confidence_band_ar: BAND[withData.length >= 8 ? 'high' : 'moderate'][1],
    leadership_sectors: leadership, weakening_sectors: weakening,
    defensive_rotation, cyclical_rotation, narrow_leadership, broad_participation,
    sectors: rows,
    evidence: [
      `SPY change=${Number(spyChg.toFixed(4))}%`,
      `defensive avg RS=${defensiveAvg !== null ? defensiveAvg.toFixed(3) : 'n/a'} vs cyclical avg RS=${cycRS !== null ? cycRS.toFixed(3) : 'n/a'}`,
      `${positives}/${withData.length} sectors positive on the session`,
    ],
    attribution: { sources: ['data/visual/sector-charts.json', 'data/visual/institutional-charts.json'], note: 'Deterministic relative-strength rotation read. Observed only — not a forecast, signal or recommendation.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[sector-rotation] state=${r.rotation_state} band=${r.confidence_band} | leaders=${r.leadership_sectors.map((x) => x.symbol).join(',') || 'none'} | weak=${r.weakening_sectors.map((x) => x.symbol).join(',') || 'none'}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[sector-rotation] wrote artifact'); }
}

module.exports = { build, ROTATION, BAND };
