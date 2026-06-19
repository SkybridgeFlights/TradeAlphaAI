'use strict';

// Phase 211 / CP1 — visual market map engine. Transforms the existing ranking /
// relative-strength / regime / historical intelligence into visualization-ready
// cell structures (one cell per entity, colour-encoded by qualitative rank — NOT
// a prediction gauge). Consumes only existing artifacts; no fabricated values, no
// synthetic rankings.
//
// Outputs: data/visual/{asset,sector,equity}-map.json
// Usage:   node tools/build-visual-market-maps.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = (g) => path.join(ROOT, 'data', 'visual', `${g}-map.json`);
const WRITE = process.argv.includes('--write');

// Institutional strength palette (encodes the qualitative rank, not a forecast).
const COLOR = {
  strongest: '#1f6f5c', strong: '#2f8f76', constructive: '#5a8f7a', neutral: '#46505f',
  weakening: '#b58b56', weak: '#c2703c', weakest: '#b5523f', indeterminate: '#3a4250',
};
const DIR_GLYPH = { improving: '▲', stable: '▬', deteriorating: '▼', indeterminate: '·' };
const GROUPS = {
  asset: { rankings: 'asset-rankings.json', registry: './asset-registry', key: 'ASSETS' },
  sector: { rankings: 'sector-rankings.json', registry: './sector-registry', key: 'SECTORS' },
  equity: { rankings: 'equity-rankings.json', registry: './equity-registry', key: 'EQUITIES' },
};

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function regimeAlignment(direction, regimeState) {
  if (!direction || direction === 'indeterminate' || !regimeState || regimeState === 'indeterminate') return 'indeterminate';
  const riskOn = /risk_expansion|broad_risk|cyclical_recovery/.test(regimeState);
  const riskOff = /defensive_rotation|liquidity_stress|macro_fragility/.test(regimeState);
  if (riskOn && direction === 'improving') return 'aligned';
  if (riskOff && direction === 'deteriorating') return 'aligned';
  if ((riskOn && direction === 'deteriorating') || (riskOff && direction === 'improving')) return 'divergent';
  return 'neutral';
}

function buildGroup(group) {
  const g = GROUPS[group];
  const rankings = readJson(J(g.rankings), {});
  const macro = readJson(J('macro-regime.json'), {});
  const regimeState = macro && macro.available ? macro.macro_regime : 'indeterminate';
  const reg = require(g.registry)[g.key];
  const nameBy = new Map(reg.map((e) => [e.symbol, e.name_en || e.symbol]));
  const nameArBy = new Map(reg.map((e) => [e.symbol, e.name_ar || e.symbol]));

  const items = ((rankings && rankings.items) || []);
  const cells = items.map((x) => ({
    symbol: x.symbol, slug: x.slug,
    name_en: nameBy.get(x.symbol) || x.symbol, name_ar: nameArBy.get(x.symbol) || x.symbol,
    rank_label: x.rank_label, rank_label_en: x.rank_label_en, rank_label_ar: x.rank_label_ar,
    direction: x.direction, direction_en: x.direction_en, direction_ar: x.direction_ar, direction_glyph: DIR_GLYPH[x.direction] || '·',
    confirmation: x.confirmation, confirmation_en: x.confirmation_en, confirmation_ar: x.confirmation_ar,
    regime_alignment: regimeAlignment(x.direction, regimeState),
    color: COLOR[x.rank_label] || COLOR.indeterminate,
    href: `/${group === 'asset' ? 'markets' : group === 'sector' ? 'sectors' : 'equities'}/${x.slug}/`,
    available: x.available !== false,
    evidence: x.evidence || [],
  }));
  const legend = Object.entries(COLOR).filter(([k]) => k !== 'indeterminate').map(([k, c]) => ({ label_en: k, color: c }));
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: `${group}-map`,
    group, available: cells.some((c) => c.available), count: cells.length,
    regime_state: regimeState, cells, legend,
    attribution: { sources: [`data/intelligence/${g.rankings}`, 'data/intelligence/macro-regime.json'], note: 'Visualization-ready map derived from existing rankings + regime intelligence. Colour encodes qualitative strength, not a forecast. Educational context, not a recommendation or signal.' },
  };
}

function build() { return { asset: buildGroup('asset'), sector: buildGroup('sector'), equity: buildGroup('equity') }; }

if (require.main === module) {
  const r = build();
  for (const g of ['asset', 'sector', 'equity']) { console.log(`[visual-market-maps] ${g}: ${r[g].count} cells, regime=${r[g].regime_state}`); if (WRITE) fs.writeFileSync(OUT(g), `${JSON.stringify(r[g], null, 2)}\n`); }
  if (WRITE) console.log('[visual-market-maps] wrote 3 map artifacts');
}

module.exports = { build, buildGroup, COLOR, DIR_GLYPH };
