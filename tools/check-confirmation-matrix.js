'use strict';

// Phase 210 CP2 — check:confirmation-matrix.
// Validates the command-center confirmation matrix for evidence-backed layers,
// bilingual labels, no retail/advice phrasing and no fabricated empty states.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'confirmation-matrix.json');
const ARABIC = /[\u0600-\u06ff]/;
const LAYERS = ['macro', 'assets', 'sectors', 'equities', 'rankings', 'historical'];
const STATES = new Set(['confirming', 'contradicting', 'mixed', 'indeterminate']);
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function validate(matrix) {
  const failures = [];
  if (!matrix || typeof matrix !== 'object') return ['artifact not an object'];
  if (matrix.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (matrix.source_layer !== 'confirmation-matrix') failures.push(`unexpected source_layer "${matrix.source_layer}"`);
  if (!matrix.generated_at || Number.isNaN(Date.parse(matrix.generated_at))) failures.push('missing valid generated_at');
  if (!STATES.has(matrix.matrix_state)) failures.push(`invalid matrix_state "${matrix.matrix_state}"`);
  if (!matrix.source_hash || !/^[a-f0-9]{64}$/.test(matrix.source_hash)) failures.push('missing deterministic source_hash');

  const layers = Array.isArray(matrix.layers) ? matrix.layers : [];
  for (const layer of LAYERS) {
    if (!layers.some((x) => x.layer === layer)) failures.push(`missing layer ${layer}`);
  }
  for (const layer of layers) {
    const id = layer.layer || '?';
    if (!LAYERS.includes(id)) failures.push(`unexpected layer ${id}`);
    if (!STATES.has(layer.state)) failures.push(`${id}: invalid state "${layer.state}"`);
    if (!layer.label_en || typeof layer.label_en !== 'string') failures.push(`${id}: missing label_en`);
    if (!ARABIC.test(String(layer.label_ar || ''))) failures.push(`${id}: label_ar not Arabic`);
    if (!layer.title_en || !layer.title_ar) failures.push(`${id}: missing title`);
    if (!ARABIC.test(String(layer.title_ar || ''))) failures.push(`${id}: title_ar not Arabic`);
    if (!layer.counts || typeof layer.counts !== 'object') failures.push(`${id}: missing counts`);
    const evidence = Array.isArray(layer.evidence_refs) ? layer.evidence_refs : [];
    if (!evidence.length) failures.push(`${id}: missing evidence_refs`);
    for (const ref of evidence) {
      if (!ref.source || !ref.field) failures.push(`${id}: evidence ref missing source/field`);
      if (ref.value == null || String(ref.value) === '') failures.push(`${id}: evidence ref missing value`);
    }
  }

  const topRefs = Array.isArray(matrix.evidence_refs) ? matrix.evidence_refs : [];
  if (topRefs.length < LAYERS.length) failures.push('top-level evidence_refs too sparse');
  const sources = matrix.attribution && Array.isArray(matrix.attribution.sources) ? matrix.attribution.sources : [];
  for (const required of ['macro-regime.json', 'rankings.json', 'relative-strength.json', 'ranking-history.json', 'regime-transitions.json']) {
    if (!sources.includes(required)) failures.push(`missing attribution source ${required}`);
  }

  const text = JSON.stringify(matrix);
  if (/\b(undefined|NaN)\b/.test(text)) failures.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden advice/forecast language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[confirmation-matrix] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let matrix;
  try { matrix = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (err) {
    console.error(`[confirmation-matrix] FAIL: malformed JSON: ${err.message}`);
    process.exit(1);
  }
  const failures = validate(matrix);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[confirmation-matrix] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[confirmation-matrix] check:confirmation-matrix passed (6 layers, evidence-backed, bilingual, no advice language).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const sample = require('./build-confirmation-matrix').build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean build', (m) => m, false],
    ['missing layer', (m) => { m.layers = m.layers.filter((x) => x.layer !== 'macro'); }, true],
    ['bad state', (m) => { m.layers[0].state = 'bullish'; }, true],
    ['missing evidence', (m) => { m.layers[0].evidence_refs = []; }, true],
    ['english ar label', (m) => { m.layers[0].label_ar = 'mixed'; }, true],
    ['forbidden language', (m) => { m.attribution.note = 'buy signal'; }, true],
    ['missing attribution', (m) => { m.attribution.sources = []; }, true],
    ['bad hash', (m) => { m.source_hash = 'x'; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(sample));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[confirmation-matrix] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
