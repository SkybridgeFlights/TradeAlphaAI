'use strict';

// Phase 204 / Workstream H — check:dollar-intelligence / yield-intelligence /
// volatility-intelligence / macro-regime (one impl, --layer selector).
// Validates the macro intelligence artifacts: primary regime in the allowed
// label set, native bilingual labels, valid confidence band, available
// consistency, dimensions with allowed states + evidence, and NO retail /
// forecast / certainty language. Honest indeterminate passes. Negative-tested.

const fs = require('fs');
const path = require('path');
const { BAND, DOLLAR, YIELD, VOL, MACRO, SUB } = require('./build-macro-layers');

const ROOT = path.resolve(__dirname, '..');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\bstrong buy\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|drop|surge|plunge)\b/i,
  /\bdefinitely\b/i, /\bwill reach\b/i, /\bRSI\b/, /\bMACD\b/, /(?:\bشراء\b|\bبيع\b|هدف\s*سعري)/,
];
const LAYERS = {
  dollar: { file: 'data/intelligence/dollar-intelligence.json', source: 'dollar-intelligence', regimeKey: 'dollar_regime', regimeMap: DOLLAR,
    dims: { dollar_pressure: DOLLAR, dollar_confirmation: SUB, dollar_fragility: SUB } },
  yield: { file: 'data/intelligence/yield-intelligence.json', source: 'yield-intelligence', regimeKey: 'yield_regime', regimeMap: YIELD,
    dims: { duration_pressure: YIELD, curve_pressure: YIELD, rate_sensitivity: YIELD } },
  volatility: { file: 'data/intelligence/volatility-intelligence.json', source: 'volatility-intelligence', regimeKey: 'volatility_regime', regimeMap: VOL,
    dims: { compression: VOL, expansion: VOL, fragility: SUB, stress_state: VOL } },
  macro: { file: 'data/intelligence/macro-regime.json', source: 'macro-regime', regimeKey: 'macro_regime', regimeMap: MACRO, dims: {} },
};

function validate(a, layer) {
  const spec = LAYERS[layer];
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== spec.source) f.push(`unexpected source_layer "${a.source_layer}"`);
  if (a.schema_version !== '1.0') f.push(`unexpected schema_version ${a.schema_version}`);
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) f.push('missing attribution.sources');
  if (!BAND[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  const state = a[spec.regimeKey];
  if (!spec.regimeMap[state]) f.push(`${spec.regimeKey} "${state}" not in allowed label set`);
  else {
    if (a[`${spec.regimeKey}_en`] !== spec.regimeMap[state][0]) f.push(`${spec.regimeKey}_en mismatch`);
    if (!ARABIC.test(String(a[`${spec.regimeKey}_ar`] || ''))) f.push(`${spec.regimeKey}_ar not native Arabic`);
  }
  if (a.available === false && state !== 'indeterminate') f.push('available=false but regime not indeterminate');
  if (a.available === true && state === 'indeterminate' && layer !== 'macro') f.push('available=true but regime indeterminate');
  if (!Array.isArray(a.evidence) || !a.evidence.length) f.push('missing evidence');
  const dims = a.dimensions || {};
  for (const [key, map] of Object.entries(spec.dims)) {
    const d = dims[key];
    if (!d) { f.push(`missing dimension "${key}"`); continue; }
    if (!map[d.state]) f.push(`${key}: unknown state "${d.state}"`);
    else if (d.label_en !== map[d.state][0]) f.push(`${key}: label_en mismatch`);
    if (d.label_ar && /[A-Za-z]{4,}/.test(d.label_ar)) f.push(`${key}: label_ar not native`);
    if (!Array.isArray(d.evidence) || !d.evidence.length) f.push(`${key}: missing evidence`);
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast/certainty language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const built = require('./build-macro-layers').build();
  const map = { dollar: built.dollar, yield: built.yield, volatility: built.volatility, macro: built.macro };
  let ok = 0; let total = 0;
  for (const layer of Object.keys(LAYERS)) {
    const base = map[layer];
    const clone = () => JSON.parse(JSON.stringify(base));
    const cases = [
      ['bad source', (m) => { m.source_layer = 'x'; }],
      ['off-label regime', (m) => { m[LAYERS[layer].regimeKey] = 'zzz'; }],
      ['invalid band', (m) => { m.confidence_band = 'cosmic'; }],
      ['forbidden language', (m) => { m.evidence.push('strong buy — price target hit'); }],
      ['untranslated AR', (m) => { m[`${LAYERS[layer].regimeKey}_ar`] = 'risk expansion'; }],
    ];
    for (const [, mut] of cases) { total += 1; const c = clone(); mut(c); if (validate(c, layer).length) ok += 1; else console.error(`SELF-TEST FAIL [${layer}]`); }
    total += 1; if (validate(clone(), layer).length === 0) ok += 1; else console.error(`SELF-TEST FAIL [${layer}] clean:`, validate(clone(), layer));
  }
  console.log(`[macro-layers] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const arg = process.argv.find((x) => x.startsWith('--layer='));
  const layer = arg ? arg.slice(8) : null;
  if (!layer || !LAYERS[layer]) { console.error('[macro-layers] usage: --layer=dollar|yield|volatility|macro'); process.exit(2); }
  const abs = path.join(ROOT, LAYERS[layer].file);
  const name = layer === 'macro' ? 'macro-regime' : `${layer}-intelligence`;
  if (!fs.existsSync(abs)) { console.log(`[${name}] no artifact yet — nothing to validate (non-fatal).`); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { console.error(`[${name}] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a, layer);
  if (failures.length) { failures.forEach((m) => console.error(`[${name}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${name}] check:${name} passed (${a[LAYERS[layer].regimeKey]}, band ${a.confidence_band}; evidence-backed, bilingual, no retail/forecast language).`);
}

module.exports = { validate };
