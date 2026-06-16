'use strict';

// Phase 202 / Workstream G — check:asset-structure / asset-tactical / asset-liquidity.
// One implementation, selected via --layer=structure|tactical|liquidity. Validates
// the per-asset intelligence artifacts: every registry asset present, states from
// the allowed label sets, evidence-backed when available, honestly indeterminate
// (available=false) when the asset has no verified chart, bilingual-native, an
// availability matrix, and NO retail/advice/prediction language. Observed
// percentage moves in evidence are allowed (real data). Negative-tested.

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');
const { STRUCTURE_STATES, TACTICAL_DIMS, LIQUIDITY_DIMS, BAND } = require('./build-asset-layers');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = new Set(ASSETS.map((a) => a.symbol));
const ARABIC = /[؀-ۿ]/;
const FILES = {
  structure: 'data/intelligence/asset-structure.json',
  tactical: 'data/intelligence/asset-tactical.json',
  liquidity: 'data/intelligence/asset-liquidity.json',
};
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\bstrong buy\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|drop)\b/i,
  /\bRSI\b/, /\bMACD\b/, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/,
];

function arNotTranslated(s) { return /[A-Za-z]{4,}/.test(String(s || '').replace(/(SPY|QQQ|IWM|GLD|TLT|UUP|VIXY|DXY|VIX|GOLD|OHLCV|ATR)/g, '')); }

function validateAsset(layer, a) {
  const f = [];
  const id = a.symbol || '?';
  if (!REGISTRY.has(a.symbol)) f.push(`${id}: not in registry`);
  if (!BAND[a.confidence_band]) f.push(`${id}: invalid confidence_band "${a.confidence_band}"`);
  if (a.available === false) {
    if (layer === 'structure' && a.state !== 'indeterminate') f.push(`${id}: unavailable but structure state not indeterminate`);
    if (a.confidence_band !== 'indeterminate') f.push(`${id}: unavailable but confidence_band not indeterminate`);
    if (!Array.isArray(a.evidence) || !a.evidence.length) f.push(`${id}: unavailable without evidence note`);
    return f;
  }
  // Available → determinate + evidence-backed.
  if (layer === 'structure') {
    if (!STRUCTURE_STATES[a.state]) f.push(`${id}: unknown structure state "${a.state}"`);
    else { if (a.label_en !== STRUCTURE_STATES[a.state][0]) f.push(`${id}: structure label_en mismatch`); if (arNotTranslated(a.label_ar)) f.push(`${id}: structure label_ar not native`); }
    if (!Array.isArray(a.evidence) || !a.evidence.length) f.push(`${id}: structure missing evidence`);
  } else {
    const map = layer === 'tactical' ? TACTICAL_DIMS : LIQUIDITY_DIMS;
    const dims = a.dimensions || {};
    for (const key of Object.keys(map)) {
      const d = dims[key];
      if (!d) { f.push(`${id}: missing dimension "${key}"`); continue; }
      if (!map[key][d.state]) f.push(`${id}.${key}: unknown state "${d.state}"`);
      else if (d.label_en !== map[key][d.state][0]) f.push(`${id}.${key}: label_en mismatch`);
      if (arNotTranslated(d.label_ar)) f.push(`${id}.${key}: label_ar not native`);
      if (!Array.isArray(d.evidence) || !d.evidence.length) f.push(`${id}.${key}: missing evidence`);
    }
  }
  return f;
}

function validate(artifact, layer) {
  const f = [];
  if (!artifact || typeof artifact !== 'object') return ['artifact not an object'];
  if (artifact.source_layer !== `asset-${layer}`) f.push(`unexpected source_layer "${artifact.source_layer}"`);
  if (artifact.schema_version !== '1.0') f.push(`unexpected schema_version ${artifact.schema_version}`);
  if (!artifact.attribution || !Array.isArray(artifact.attribution.sources) || !artifact.attribution.sources.length) f.push('missing attribution.sources');
  const assets = Array.isArray(artifact.assets) ? artifact.assets : [];
  if (assets.length !== REGISTRY.size) f.push(`expected ${REGISTRY.size} assets, got ${assets.length}`);
  if (!Array.isArray(artifact.availability_matrix) || artifact.availability_matrix.length !== REGISTRY.size) f.push('missing/incomplete availability_matrix');
  for (const a of assets) validateAsset(layer, a).forEach((m) => f.push(m));
  const anyAvail = assets.some((a) => a.available);
  if (artifact.available !== anyAvail) f.push(`available=${artifact.available} but assets availability=${anyAvail}`);
  const text = JSON.stringify(artifact);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/advice/prediction language ${re}`);
  return f;
}

function argLayer() { const a = process.argv.find((x) => x.startsWith('--layer=')); return a ? a.slice(8) : null; }

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-asset-layers');
  const built = build();
  let ok = 0; let total = 0;
  for (const layer of ['structure', 'tactical', 'liquidity']) {
    const base = built[layer];
    const clone = () => JSON.parse(JSON.stringify(base));
    const avail = (m) => m.assets.find((x) => x.available);
    const cases = [
      ['bad source_layer', (m) => { m.source_layer = 'x'; }],
      ['drop availability matrix', (m) => { m.availability_matrix = []; }],
      ['forbidden language', (m) => { m.assets[0].evidence = (m.assets[0].evidence || []).concat('strong buy now'); }],
      ['available flag wrong', (m) => { m.available = !m.available; }],
      [layer === 'structure' ? 'unknown structure state' : 'unknown dim state', (m) => { const a = avail(m); if (layer === 'structure') a.state = 'zzz'; else { const k = Object.keys(a.dimensions)[0]; a.dimensions[k].state = 'zzz'; } }],
      ['missing evidence', (m) => { const a = avail(m); if (layer === 'structure') a.evidence = []; else a.dimensions[Object.keys(a.dimensions)[0]].evidence = []; }],
    ];
    for (const [, mut] of cases) { total += 1; const c = clone(); mut(c); if (validate(c, layer).length) ok += 1; else console.error(`SELF-TEST FAIL [${layer}]: not rejected`); }
    total += 1; if (validate(clone(), layer).length === 0) ok += 1; else console.error(`SELF-TEST FAIL [${layer}] clean rejected:`, validate(clone(), layer));
  }
  console.log(`[asset-layers] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const layer = argLayer();
  if (!layer || !FILES[layer]) { console.error('[asset-layers] usage: --layer=structure|tactical|liquidity'); process.exit(2); }
  const abs = path.join(ROOT, FILES[layer]);
  if (!fs.existsSync(abs)) { console.log(`[asset-${layer}] no artifact yet — nothing to validate (non-fatal).`); process.exit(0); }
  let artifact;
  try { artifact = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { console.error(`[asset-${layer}] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(artifact, layer);
  if (failures.length) { failures.forEach((m) => console.error(`[asset-${layer}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[asset-${layer}] check:asset-${layer} passed (${artifact.assets_available}/${artifact.assets_total} available; per-asset, evidence-backed, honest indeterminate, bilingual, no retail language).`);
}

module.exports = { validate };
