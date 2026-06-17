'use strict';

// Phase 206 / Workstream E — equity intelligence scoring. Composes per-equity
// structure/tactical/liquidity/participation (from equity layers) plus macro
// (macro-regime) and sector (sector-structure of the equity's sector) into a
// 5-level score label. Evidence-backed, qualitative — no fabricated precision,
// no buy/sell. Degrades to unavailable without per-equity evidence.
//
// Output: data/intelligence/equity-intelligence.json
// Usage:  node tools/build-equity-intelligence.js [--write]

const fs = require('fs');
const path = require('path');
const { EQUITIES } = require('./equity-registry');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('equity-intelligence.json');
const WRITE = process.argv.includes('--write');

const SCORE = { very_weak: ['very weak', 'ضعيف جداً'], weak: ['weak', 'ضعيف'], neutral: ['neutral', 'محايد'], constructive: ['constructive', 'بنّاء'], strong: ['strong', 'قوي'], unavailable: ['unavailable', 'غير متاح'] };
const COMP = { constructive: ['constructive', 'بنّاء'], neutral: ['neutral', 'محايد'], pressured: ['pressured', 'تحت ضغط'], unavailable: ['unavailable', 'غير متاح'] };
const LAYER_VAL = { strong: 1, constructive: 0.5, neutral: 0, weak: -0.5, fragile: -1 };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function layerStateFor(art, sym) { const x = art && Array.isArray(art.equities) ? art.equities.find((e) => e.symbol === sym) : null; return x && x.available ? x.state : null; }
function sectorStateFor(art, slug) { const x = art && Array.isArray(art.sectors) ? art.sectors.find((s) => s.slug === slug) : null; return x && x.available ? x.state : null; }
function toComp(v) { return v > 0.1 ? 'constructive' : v < -0.1 ? 'pressured' : 'neutral'; }
function comp(state, evidence) { return { state, label_en: COMP[state][0], label_ar: COMP[state][1], evidence }; }

function macroValue(macro) {
  if (!macro || macro.available !== true) return null;
  return { risk_expansion: 1, cyclical_recovery: 0.5, mixed_regime: 0, selective_risk: 0, defensive_rotation: -0.5, liquidity_stress: -1, macro_fragility: -1 }[macro.macro_regime] ?? null;
}

function build() {
  const structure = readJson(J('equity-structure.json'));
  const tactical = readJson(J('equity-tactical.json'));
  const liquidity = readJson(J('equity-liquidity.json'));
  const participation = readJson(J('equity-participation.json'));
  const macro = readJson(J('macro-regime.json'));
  const sectorStructure = readJson(J('sector-structure.json'));
  const stamp = new Date().toISOString();
  const mVal = macroValue(macro);

  const equities = EQUITIES.map((eq) => {
    const sStr = layerStateFor(structure, eq.symbol);
    const sTac = layerStateFor(tactical, eq.symbol);
    const sLiq = layerStateFor(liquidity, eq.symbol);
    const sPar = layerStateFor(participation, eq.symbol);
    const secState = sectorStateFor(sectorStructure, eq.sector);
    const secVal = secState != null && secState in LAYER_VAL ? LAYER_VAL[secState] : (secState === 'defensive' || secState === 'cyclical' ? 0 : null);

    const contributions = {
      structure: comp(sStr ? toComp(LAYER_VAL[sStr] ?? 0) : 'unavailable', [sStr ? `equity-structure=${sStr}` : 'structure unavailable']),
      tactical: comp(sTac ? toComp(LAYER_VAL[sTac] ?? 0) : 'unavailable', [sTac ? `equity-tactical=${sTac}` : 'tactical unavailable']),
      liquidity: comp(sLiq ? toComp(LAYER_VAL[sLiq] ?? 0) : 'unavailable', [sLiq ? `equity-liquidity=${sLiq}` : 'liquidity unavailable']),
      participation: comp(sPar ? toComp(LAYER_VAL[sPar] ?? 0) : 'unavailable', [sPar ? `equity-participation=${sPar}` : 'participation unavailable']),
      macro: comp(mVal === null ? 'unavailable' : toComp(mVal), [macro && macro.available ? `macro-regime=${macro.macro_regime}` : 'macro unavailable']),
      sector: comp(secVal === null ? 'unavailable' : toComp(secVal), [secState ? `sector(${eq.sector})-structure=${secState}` : 'sector unavailable']),
    };

    const vals = [sStr, sTac, sLiq, sPar].map((s) => (s && s in LAYER_VAL ? LAYER_VAL[s] : null)).filter((v) => v !== null);
    if (mVal !== null) vals.push(mVal);
    if (secVal !== null) vals.push(secVal);
    const hasOwn = sStr !== null || sTac !== null; // per-equity evidence required
    let label = 'unavailable';
    if (hasOwn && vals.length) {
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      label = avg >= 0.6 ? 'strong' : avg >= 0.2 ? 'constructive' : avg > -0.2 ? 'neutral' : avg > -0.6 ? 'weak' : 'very_weak';
    }
    return {
      symbol: eq.symbol, slug: eq.slug, sector: eq.sector,
      score_label: label, score_label_en: SCORE[label][0], score_label_ar: SCORE[label][1],
      unavailable_reason: label === 'unavailable' ? 'no_per_equity_evidence' : null,
      score_components: contributions,
      evidence: Object.values(contributions).flatMap((c) => c.evidence),
    };
  });

  const scored = equities.filter((e) => e.score_label !== 'unavailable').length;
  return {
    schema_version: '1.0', generated_at: stamp, source_layer: 'equity-intelligence', available: scored > 0,
    equities_total: equities.length, equities_scored: scored, equities,
    attribution: { sources: ['equity-structure/tactical/liquidity/participation', 'macro-regime', 'sector-structure'], note: 'Deterministic equity scoring. Qualitative labels only — not a recommendation, forecast or trade instruction. Degrades to unavailable without per-equity evidence.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[equity-intelligence] scored=${r.equities_scored}/${r.equities_total}`);
  for (const e of r.equities) console.log(`  ${e.symbol.padEnd(5)} ${e.score_label}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[equity-intelligence] wrote artifact'); }
}

module.exports = { build, SCORE, COMP };
