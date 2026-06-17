'use strict';

// Phase 206 / Workstream F — equity cognitive network. Classifies each equity ↔
// counterpart (peer equity or broad asset) relationship from observed change into
// confirmation/contradiction, grouped into leadership / sector-sensitivity /
// macro-sensitivity chains. Deterministic, evidence-backed; no forecast/signal.
//
// Output: data/intelligence/equity-cognitive-network.json
// Usage:  node tools/build-equity-cognitive-network.js [--write]

const fs = require('fs');
const path = require('path');
const { EQUITY_RELATIONSHIPS } = require('./equity-registry');

const ROOT = path.resolve(__dirname, '..');
const EQUITY_CHARTS = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const ASSET_CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'equity-cognitive-network.json');
const WRITE = process.argv.includes('--write');

const REL_STATE = { confirmation: ['confirmation', 'تأكيد'], contradiction: ['contradiction', 'تناقض'], evidence_unavailable: ['evidence unavailable', 'الأدلة غير متاحة'] };
const DOMINANT = {
  broad_confirmation: ['broad equity confirmation', 'تأكيد واسع بين الأسهم'], narrow_leadership: ['narrow leadership', 'قيادة ضيقة'],
  divergence: ['equity divergence', 'تباعد بين الأسهم'], risk_pressure: ['risk pressure', 'ضغط على المخاطر'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'],
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lastChange(chart) { const s = chart && Array.isArray(chart.series) ? chart.series : null; if (!s || s.length < 2) return null; const a = s.at(-1).close; const b = s.at(-2).close; return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? Number((((a - b) / b) * 100).toFixed(4)) : null; }
function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

function build() {
  const em = readJson(EQUITY_CHARTS, {});
  const am = readJson(ASSET_CHARTS, {});
  const cross = readJson(CROSS, {});
  const equityChart = new Map(((em && em.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const assetChart = new Map(((am && am.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const stamp = new Date().toISOString();
  const counterpartChange = (sym, type) => {
    if (type === 'equity') { const c = equityChart.get(sym); return c ? { value: lastChange(c), source: `equity-chart:${sym}` } : null; }
    const c = assetChart.get(sym); const v = c ? lastChange(c) : null;
    if (v !== null) return { value: v, source: `chart:${sym}` };
    const row = ((cross && cross.assets) || []).find((a) => a.asset === sym);
    return row && typeof row.change_pct === 'number' && Number.isFinite(row.change_pct) ? { value: row.change_pct, source: `cross-asset-state:${sym}` } : null;
  };

  const relationships = EQUITY_RELATIONSHIPS.map((rel) => {
    const eC = equityChart.get(rel.equity);
    const eChg = eC ? lastChange(eC) : null;
    const cC = counterpartChange(rel.counterpart, rel.type);
    let state = 'evidence_unavailable';
    if (eChg !== null && cC && cC.value !== null) {
      const same = sign(eChg) === sign(cC.value) && sign(eChg) !== 0;
      state = same ? 'confirmation' : 'contradiction';
    }
    const evidence = state === 'evidence_unavailable'
      ? [`${rel.equity} or ${rel.counterpart} observed change unavailable`]
      : [`${rel.equity}=${eChg}% , ${rel.counterpart}=${cC.value}% (${cC.source}) [${rel.kind}]`];
    return { id: rel.id, equity: rel.equity, counterpart: rel.counterpart, type: rel.type, kind: rel.kind, state, label_en: rel.en, label_ar: rel.ar, state_en: REL_STATE[state][0], state_ar: REL_STATE[state][1], evidence };
  });

  const withData = relationships.filter((r) => r.state !== 'evidence_unavailable');
  const chainOf = (pred) => relationships.filter(pred).filter((r) => r.state !== 'evidence_unavailable').map((r) => ({ id: r.id, label_en: r.label_en, label_ar: r.label_ar, state: r.state, evidence: r.evidence }));
  const confirmation_chains = chainOf((r) => r.state === 'confirmation');
  const contradiction_chains = chainOf((r) => r.state === 'contradiction');
  const leadership_chains = chainOf((r) => r.kind === 'leadership');
  const sector_sensitivity_chains = chainOf((r) => r.kind === 'peer');
  const macro_sensitivity_chains = chainOf((r) => r.kind === 'macro');

  let state;
  if (!withData.length) state = 'indeterminate';
  else if (contradiction_chains.length > confirmation_chains.length) state = 'divergence';
  else if (withData.every((r) => r.state === 'confirmation') && withData.filter((r) => sign(Number((r.evidence[0].match(/=(-?[\d.]+)%/) || [])[1])) < 0).length >= Math.ceil(withData.length * 0.6)) state = 'risk_pressure';
  else if (confirmation_chains.length >= Math.ceil(withData.length * 0.7)) state = 'broad_confirmation';
  else if (leadership_chains.filter((c) => c.state === 'confirmation').length && confirmation_chains.length < withData.length) state = 'narrow_leadership';
  else state = 'mixed';

  const coverage = withData.length / EQUITY_RELATIONSHIPS.length;
  const band = !withData.length ? 'indeterminate' : coverage >= 0.8 ? 'high' : coverage >= 0.5 ? 'moderate' : 'low';

  return {
    schema_version: '1.0', generated_at: stamp, source_layer: 'equity-cognitive-network', available: withData.length > 0,
    dominant_equity_state: { state, label_en: DOMINANT[state][0], label_ar: DOMINANT[state][1] },
    confidence_band: band, confidence_band_en: BAND[band][0], confidence_band_ar: BAND[band][1], coverage_pct: Math.round(coverage * 100),
    confirmation_chains, contradiction_chains, leadership_chains, sector_sensitivity_chains, macro_sensitivity_chains,
    relationships,
    evidence: [`${withData.length}/${EQUITY_RELATIONSHIPS.length} equity↔counterpart relationships with data`],
    attribution: { sources: ['data/visual/equity-charts.json', 'data/visual/institutional-charts.json', 'data/intelligence/cross-asset-state.json'], note: 'Deterministic equity↔counterpart relationship composition. Educational context, not a forecast or recommendation.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[equity-cognitive] dominant=${r.dominant_equity_state.state} band=${r.confidence_band} coverage=${r.coverage_pct}% | conf=${r.confirmation_chains.length} contra=${r.contradiction_chains.length} lead=${r.leadership_chains.length} peer=${r.sector_sensitivity_chains.length} macro=${r.macro_sensitivity_chains.length}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[equity-cognitive] wrote artifact'); }
}

module.exports = { build, REL_STATE, DOMINANT, BAND };
