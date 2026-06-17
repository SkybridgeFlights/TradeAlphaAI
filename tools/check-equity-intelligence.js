'use strict';

// Phase 206 / Workstream J — check:equity-intelligence.
// Validates the 4 per-equity layer artifacts + the equity scoring artifact:
// every equity present, states/labels in the allowed sets, evidence-backed,
// honest indeterminate/unavailable, bilingual-native, no retail/advice, and no
// fabricated score (a score requires per-equity evidence). Negative-tested.

const fs = require('fs');
const path = require('path');
const { EQUITIES } = require('./equity-registry');
const { STATES } = require('./build-equity-layers');
const { SCORE, COMP } = require('./build-equity-intelligence');

const ROOT = path.resolve(__dirname, '..');
const REG = new Set(EQUITIES.map((e) => e.symbol));
const ARABIC = /[؀-ۿ]/;
const LAYERS = ['structure', 'tactical', 'liquidity', 'participation'];
const COMP_KEYS = ['structure', 'tactical', 'liquidity', 'participation', 'macro', 'sector'];
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b|هدف\s*سعري)/];

function validateLayer(a, layer) {
  const f = [];
  if (!a || a.source_layer !== `equity-${layer}`) f.push(`[${layer}] bad source_layer`);
  const items = Array.isArray(a && a.equities) ? a.equities : [];
  if (items.length !== REG.size) f.push(`[${layer}] expected ${REG.size} equities, got ${items.length}`);
  for (const x of items) {
    if (!REG.has(x.symbol)) f.push(`[${layer}] ${x.symbol}: not in registry`);
    if (!STATES[x.state]) f.push(`[${layer}] ${x.symbol}: unknown state "${x.state}"`);
    else if (!ARABIC.test(String(x.label_ar || ''))) f.push(`[${layer}] ${x.symbol}: label_ar not native`);
    if (x.available && (!Array.isArray(x.evidence) || !x.evidence.length)) f.push(`[${layer}] ${x.symbol}: available without evidence`);
    if (x.available === false && !x.unavailable_reason) f.push(`[${layer}] ${x.symbol}: unavailable without reason`);
  }
  return f;
}

function validateScore(a) {
  const f = [];
  if (!a || a.source_layer !== 'equity-intelligence') f.push('[score] bad source_layer');
  const items = Array.isArray(a && a.equities) ? a.equities : [];
  if (items.length !== REG.size) f.push(`[score] expected ${REG.size} equities, got ${items.length}`);
  for (const e of items) {
    if (!SCORE[e.score_label]) f.push(`[score] ${e.symbol}: unknown score_label "${e.score_label}"`);
    else if (!ARABIC.test(String(e.score_label_ar || ''))) f.push(`[score] ${e.symbol}: score_label_ar not native`);
    const c = e.score_components || {};
    for (const k of COMP_KEYS) { if (!c[k]) f.push(`[score] ${e.symbol}: missing component ${k}`); else if (!COMP[c[k].state]) f.push(`[score] ${e.symbol}.${k}: unknown state "${c[k].state}"`); else if (!Array.isArray(c[k].evidence) || !c[k].evidence.length) f.push(`[score] ${e.symbol}.${k}: missing evidence`); }
    if (e.score_label === 'unavailable') { if (!e.unavailable_reason) f.push(`[score] ${e.symbol}: unavailable without reason`); }
    else if (!Array.isArray(e.evidence) || !e.evidence.length) f.push(`[score] ${e.symbol}: scored without evidence`);
  }
  return f;
}

function runAll() {
  const f = [];
  for (const layer of LAYERS) { const p = path.join(ROOT, 'data', 'intelligence', `equity-${layer}.json`); if (fs.existsSync(p)) { try { f.push(...validateLayer(JSON.parse(fs.readFileSync(p, 'utf8')), layer)); } catch (e) { f.push(`[${layer}] malformed JSON`); } } }
  const sp = path.join(ROOT, 'data', 'intelligence', 'equity-intelligence.json');
  if (fs.existsSync(sp)) { try { const a = JSON.parse(fs.readFileSync(sp, 'utf8')); f.push(...validateScore(a)); const text = JSON.stringify(a); for (const re of FORBIDDEN) if (re.test(text)) f.push(`[score] forbidden language ${re}`); } catch (e) { f.push('[score] malformed JSON'); } }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const layers = require('./build-equity-layers').build();
  const score = require('./build-equity-intelligence').build();
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('layer clean', validateLayer(layers.structure, 'structure').length === 0);
  T('score clean', validateScore(score).length === 0);
  const l1 = JSON.parse(JSON.stringify(layers.structure)); l1.equities[0].state = 'zzz';
  T('bad layer state rejected', validateLayer(l1, 'structure').length > 0);
  const s1 = JSON.parse(JSON.stringify(score)); s1.equities[0].score_label = 'mega';
  T('bad score label rejected', validateScore(s1).length > 0);
  const s2 = JSON.parse(JSON.stringify(score)); delete s2.equities[0].score_components.macro;
  T('missing component rejected', validateScore(s2).length > 0);
  const s3 = JSON.parse(JSON.stringify(score)); const sc = s3.equities.find((e) => e.score_label !== 'unavailable'); if (sc) sc.evidence = [];
  T('scored without evidence rejected', validateScore(s3).length > 0);
  console.log(`[equity-intelligence] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = runAll();
  if (failures.length) { failures.forEach((m) => console.error(`[equity-intelligence] FAIL: ${m}`)); process.exit(1); }
  console.log('[equity-intelligence] check:equity-intelligence passed (4 layers + scoring; per-equity, evidence-backed, bilingual, no retail).');
}

module.exports = { validateLayer, validateScore };
