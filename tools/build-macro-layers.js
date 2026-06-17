'use strict';

// Phase 204 — cross-asset MACRO intelligence layers. Deterministic, evidence-
// backed reads derived from the per-asset structure/tactical artifacts (which are
// themselves derived from real OHLCV): dollar (UUP), yield (TLT, inverse to
// yields), volatility (VIXY) and a composed macro regime. Explains WHY the asset
// state exists — no prediction, no signals, no targets. Honest indeterminate when
// the backing asset is unavailable.
//
// Outputs: data/intelligence/{dollar,yield,volatility,macro-regime}-intelligence.json
//          (macro-regime.json for the regime engine)
// Usage:   node tools/build-macro-layers.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRUCT = path.join(ROOT, 'data', 'intelligence', 'asset-structure.json');
const TACT = path.join(ROOT, 'data', 'intelligence', 'asset-tactical.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const OUT = {
  dollar: path.join(ROOT, 'data', 'intelligence', 'dollar-intelligence.json'),
  yield: path.join(ROOT, 'data', 'intelligence', 'yield-intelligence.json'),
  volatility: path.join(ROOT, 'data', 'intelligence', 'volatility-intelligence.json'),
  macro: path.join(ROOT, 'data', 'intelligence', 'macro-regime.json'),
};
const WRITE = process.argv.includes('--write');

const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };
const DOLLAR = { strengthening: ['strengthening', 'يتقوّى'], weakening: ['weakening', 'يضعف'], stable: ['stable', 'مستقر'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'] };
const YIELD = { supportive: ['supportive', 'داعم'], restrictive: ['restrictive', 'مقيِّد'], neutral: ['neutral', 'محايد'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'] };
const VOL = { calm: ['calm', 'هادئ'], expanding: ['expanding', 'يتوسّع'], elevated: ['elevated', 'مرتفع'], stressed: ['stressed', 'متوتر'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'] };
const MACRO = {
  risk_expansion: ['risk expansion', 'توسّع المخاطر'], selective_risk: ['selective risk', 'مخاطرة انتقائية'],
  defensive_rotation: ['defensive rotation', 'تدوير دفاعي'], liquidity_stress: ['liquidity stress', 'ضغط سيولة'],
  macro_fragility: ['macro fragility', 'هشاشة كلية'], mixed_regime: ['mixed regime', 'نظام مختلط'], indeterminate: ['indeterminate', 'غير محدد'],
};
const SUB = { // shared small enums for sub-dimensions
  confirmed: ['confirmed', 'مؤكَّد'], divergent: ['divergent', 'متباعد'], mixed: ['mixed', 'مختلط'], indeterminate: ['indeterminate', 'غير محدد'],
  contained: ['contained', 'محتواة'], elevated: ['elevated', 'مرتفعة'], fragile: ['fragile', 'هشّة'],
  building: ['building', 'متصاعد'], easing: ['easing', 'متراجع'], steady: ['steady', 'ثابت'],
};

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function bandObj(b) { return { confidence_band: b, confidence_band_en: BAND[b][0], confidence_band_ar: BAND[b][1] }; }
function dimObj(map, state, evidence) { return { state, label_en: map[state][0], label_ar: map[state][1], evidence }; }
function findAsset(art, sym) { return art && Array.isArray(art.assets) ? art.assets.find((a) => a.symbol === sym) : null; }
function trendOf(structAsset) { return structAsset && structAsset.available ? (structAsset.supporting && structAsset.supporting.trend) : null; }
function dimState(tactAsset, key) { return tactAsset && tactAsset.available && tactAsset.dimensions && tactAsset.dimensions[key] ? tactAsset.dimensions[key].state : null; }

function build() {
  const struct = readJson(STRUCT, {});
  const tact = readJson(TACT, {});
  const cross = readJson(CROSS, {});
  const regime = readJson(REGIME, {});
  const stamp = new Date().toISOString();
  const coherence = (cross && cross.coherence) || {};

  const uupS = findAsset(struct, 'UUP'); const uupT = findAsset(tact, 'UUP');
  const tltS = findAsset(struct, 'TLT'); const tltT = findAsset(tact, 'TLT');
  const vixS = findAsset(struct, 'VIXY'); const vixT = findAsset(tact, 'VIXY');
  const gldS = findAsset(struct, 'GLD'); const qqqS = findAsset(struct, 'QQQ'); const spyS = findAsset(struct, 'SPY'); const spyT = findAsset(tact, 'SPY');

  // ── Dollar (UUP). ──
  const dollarAvail = !!(uupS && uupS.available);
  const dTrend = trendOf(uupS);
  const dRegime = !dollarAvail ? 'indeterminate' : dTrend === 'up' ? 'strengthening' : dTrend === 'down' ? 'weakening' : 'stable';
  const dPressureSt = dimState(uupT, 'directional_pressure');
  const dPressure = !dollarAvail ? 'indeterminate' : dPressureSt === 'building' ? 'strengthening' : dPressureSt === 'fading' ? 'weakening' : 'stable';
  // dollar vs gold confirmation (classic inverse).
  const gTrend = trendOf(gldS);
  const dConf = (!dollarAvail || !gTrend || dTrend === 'flat') ? 'indeterminate' : (dTrend !== gTrend ? 'confirmed' : 'divergent');
  const dFrag = dimState(uupT, 'positioning_fragility') || 'indeterminate';
  const dollar = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'dollar-intelligence', available: dollarAvail,
    dollar_regime: dRegime, dollar_regime_en: DOLLAR[dRegime][0], dollar_regime_ar: DOLLAR[dRegime][1],
    ...bandObj(dollarAvail ? 'high' : 'indeterminate'),
    dimensions: {
      dollar_pressure: dimObj(DOLLAR, dPressure, [`UUP directional pressure=${dPressureSt || 'n/a'}`]),
      dollar_confirmation: dimObj(SUB, dConf, [`UUP trend=${dTrend || 'n/a'} vs GLD trend=${gTrend || 'n/a'}`]),
      dollar_fragility: dimObj(SUB, dFrag === 'indeterminate' ? 'indeterminate' : dFrag, [`UUP positioning fragility=${dFrag}`]),
    },
    evidence: [`derived from UUP observed structure (trend=${dTrend || 'n/a'}, state=${uupS ? uupS.state : 'unavailable'})`],
    attribution: { sources: ['data/intelligence/asset-structure.json', 'data/intelligence/asset-tactical.json'], note: 'Dollar regime via UUP proxy. Institutional context, not a forecast or recommendation.' },
  };

  // ── Yield (TLT, inverse to yields). ──
  const yieldAvail = !!(tltS && tltS.available);
  const tTrend = trendOf(tltS);
  // TLT up → bond prices up → yields easing → supportive; TLT down → yields rising → restrictive.
  const yRegime = !yieldAvail ? 'indeterminate' : tTrend === 'up' ? 'supportive' : tTrend === 'down' ? 'restrictive' : 'neutral';
  const tPressureSt = dimState(tltT, 'directional_pressure');
  const durationPressure = !yieldAvail ? 'indeterminate' : tPressureSt === 'building' ? 'supportive' : tPressureSt === 'fading' ? 'restrictive' : 'neutral';
  const spread = cross && typeof cross.yield_spread_bps === 'number' && Number.isFinite(cross.yield_spread_bps) ? cross.yield_spread_bps : null;
  const curvePressure = spread === null ? 'indeterminate' : spread < 0 ? 'restrictive' : 'neutral';
  const qTrend = trendOf(qqqS);
  const rateSens = (!yieldAvail || !qTrend) ? 'indeterminate' : (tTrend === 'down' && qTrend === 'down') ? 'restrictive' : (tTrend === 'up' && qTrend === 'up') ? 'supportive' : 'mixed';
  const yieldArt = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'yield-intelligence', available: yieldAvail,
    yield_regime: yRegime, yield_regime_en: YIELD[yRegime][0], yield_regime_ar: YIELD[yRegime][1],
    ...bandObj(yieldAvail ? 'high' : 'indeterminate'),
    dimensions: {
      duration_pressure: dimObj(YIELD, durationPressure, [`TLT directional pressure=${tPressureSt || 'n/a'}`]),
      curve_pressure: dimObj(YIELD, curvePressure, [spread === null ? 'yield_spread_bps unavailable in cross-asset-state' : `yield_spread_bps=${spread}`]),
      rate_sensitivity: dimObj(YIELD, rateSens, [`TLT trend=${tTrend || 'n/a'} vs QQQ trend=${qTrend || 'n/a'}`]),
    },
    evidence: [`derived from TLT observed structure (trend=${tTrend || 'n/a'}); TLT rising implies easing yields`],
    attribution: { sources: ['data/intelligence/asset-structure.json', 'data/intelligence/cross-asset-state.json'], note: 'Yield/duration regime via TLT (inverse to yields). Institutional context, not a forecast.' },
  };

  // ── Volatility (VIXY level direction). ──
  const volAvail = !!(vixS && vixS.available);
  const vTrend = trendOf(vixS);
  // VIXY rising = volatility expanding; VIXY falling/breakdown = calming.
  let vRegime = 'indeterminate';
  if (volAvail) {
    if (vixS.state === 'expansion' || vTrend === 'up') vRegime = 'expanding';
    else if (vixS.state === 'breakdown' || vTrend === 'down') vRegime = 'calm';
    else vRegime = 'mixed';
  }
  const spyFrag = dimState(spyT, 'positioning_fragility');
  const stressState = !volAvail ? 'indeterminate' : (vRegime === 'expanding' && spyS && spyS.state === 'breakdown') ? 'stressed' : (vRegime === 'expanding' ? 'elevated' : vRegime === 'calm' ? 'calm' : 'mixed');
  const volatility = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'volatility-intelligence', available: volAvail,
    volatility_regime: vRegime, volatility_regime_en: VOL[vRegime][0], volatility_regime_ar: VOL[vRegime][1],
    ...bandObj(volAvail ? 'high' : 'indeterminate'),
    dimensions: {
      compression: dimObj(VOL, !volAvail ? 'indeterminate' : (vRegime === 'calm' ? 'calm' : 'mixed'), [`VIXY state=${vixS ? vixS.state : 'n/a'} trend=${vTrend || 'n/a'}`]),
      expansion: dimObj(VOL, !volAvail ? 'indeterminate' : (vRegime === 'expanding' ? 'expanding' : 'calm'), [`VIXY trend=${vTrend || 'n/a'}`]),
      fragility: dimObj(SUB, !spyFrag ? 'indeterminate' : (spyFrag === 'fragile' ? 'fragile' : spyFrag === 'elevated' ? 'elevated' : 'contained'), [`SPY positioning fragility=${spyFrag || 'n/a'}`]),
      stress_state: dimObj(VOL, stressState === 'stressed' ? 'stressed' : stressState === 'elevated' ? 'elevated' : stressState === 'calm' ? 'calm' : stressState === 'mixed' ? 'mixed' : 'indeterminate', [`VIXY regime=${vRegime}, SPY state=${spyS ? spyS.state : 'n/a'}`]),
    },
    evidence: [`derived from VIXY observed level direction (state=${vixS ? vixS.state : 'unavailable'}, trend=${vTrend || 'n/a'})`],
    attribution: { sources: ['data/intelligence/asset-structure.json', 'data/intelligence/asset-tactical.json'], note: 'Volatility regime via VIXY proxy. Institutional context, not a forecast.' },
  };

  // ── Macro regime (composition of dollar/yield/volatility + liquidity/coherence). ──
  const dir = coherence.direction || 'indeterminate';
  const breadth = regime && regime.sub_states ? regime.sub_states.breadth : null;
  const spyIwmDiverge = (() => { const i = findAsset(struct, 'IWM'); return spyS && i && spyS.available && i.available && spyS.state !== i.state; })();
  let macroState = 'indeterminate';
  const anyAvail = dollarAvail || yieldAvail || volAvail;
  if (!anyAvail) macroState = 'indeterminate';
  else if (stressState === 'stressed') macroState = 'liquidity_stress';
  else if (vRegime === 'expanding' && yRegime === 'restrictive') macroState = 'macro_fragility';
  else if (dir === 'risk_off' || (yRegime === 'supportive' && dRegime === 'strengthening')) macroState = 'defensive_rotation';
  else if (spyIwmDiverge) macroState = 'selective_risk';
  else if (dir === 'risk_on' && vRegime === 'calm') macroState = 'risk_expansion';
  else macroState = 'mixed_regime';
  const macroBand = anyAvail ? ([dollarAvail, yieldAvail, volAvail].filter(Boolean).length >= 3 ? 'high' : 'moderate') : 'indeterminate';
  const macro = {
    schema_version: '1.0', generated_at: stamp, source_layer: 'macro-regime', available: anyAvail,
    macro_regime: macroState, macro_regime_en: MACRO[macroState][0], macro_regime_ar: MACRO[macroState][1],
    ...bandObj(macroBand),
    inputs: { dollar_regime: dRegime, yield_regime: yRegime, volatility_regime: vRegime, coherence_direction: dir },
    evidence: [
      `dollar=${dRegime}, yield=${yRegime}, volatility=${vRegime}`,
      `cross-asset coherence direction=${dir}`,
      `liquidity-regime: ${regime.regime || 'n/a'} / stability ${regime.stability || 'n/a'} / breadth ${breadth || 'n/a'}`,
    ],
    attribution: { sources: ['dollar-intelligence', 'yield-intelligence', 'volatility-intelligence', 'cross-asset-state', 'liquidity-regime'], note: 'Composed macro regime explaining the prevailing cross-asset state. Deterministic, evidence-backed; not a forecast, probability or recommendation.' },
  };

  return { dollar, yield: yieldArt, volatility, macro };
}

if (require.main === module) {
  const r = build();
  console.log(`[macro-layers] dollar=${r.dollar.dollar_regime} yield=${r.yield.yield_regime} volatility=${r.volatility.volatility_regime} → macro=${r.macro.macro_regime} (${r.macro.confidence_band})`);
  if (WRITE) { fs.writeFileSync(OUT.dollar, `${JSON.stringify(r.dollar, null, 2)}\n`); fs.writeFileSync(OUT.yield, `${JSON.stringify(r.yield, null, 2)}\n`); fs.writeFileSync(OUT.volatility, `${JSON.stringify(r.volatility, null, 2)}\n`); fs.writeFileSync(OUT.macro, `${JSON.stringify(r.macro, null, 2)}\n`); console.log('[macro-layers] wrote 4 artifacts'); }
}

module.exports = { build, BAND, DOLLAR, YIELD, VOL, MACRO, SUB };
