'use strict';

// Phase 116 — check:market-structure. Integrity + anti-fabrication gate for the
// Technical Structure Engine artifact (data/intelligence/market-structure.json).
// HARD-FAILS on: unknown dimension state (outside the engine enum), a determinate
// dimension with NO evidence trail (unsupported structure claim), available with
// zero determinate dimensions (contradiction), structural confidence out of range
// or unsupported by coverage (fabricated confidence), a dominant pointer that does
// not match its dimension, stale structure presented with high confidence
// (stale-as-live), untranslated Arabic labels, null/NaN/undefined leaks, and
// missing attribution. Passes green when the artifact is absent (nothing built).

const fs = require('fs');
const path = require('path');
const { LABELS, DIMENSIONS } = require('./market-structure-engine');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'market-structure.json');

const failures = [];
const fail = (m) => failures.push(m);

// Validate one artifact object (factored out so negative tests can call it).
function validate(a) {
  const f = [];
  const add = (m) => f.push(m);
  if (!a || typeof a !== 'object') { add('artifact not an object'); return f; }
  if (a.source_layer !== 'market-structure') add(`unexpected source_layer "${a.source_layer}"`);
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) add('missing attribution.sources');

  const conf = a.structural_confidence;
  if (typeof conf !== 'number' || Number.isNaN(conf) || conf < 0 || conf > 100) add(`structural_confidence out of range: ${conf}`);
  const cov = a.coverage_pct;
  if (typeof cov !== 'number' || Number.isNaN(cov) || cov < 0 || cov > 100) add(`coverage_pct out of range: ${cov}`);

  const dims = a.dimensions || {};
  let determinate = 0;
  for (const d of DIMENSIONS) {
    const dd = dims[d];
    if (!dd) { add(`missing dimension "${d}"`); continue; }
    if (!LABELS[d] || !LABELS[d][dd.state]) { add(`dimension "${d}" has unknown state "${dd.state}"`); continue; }
    if (/\b(undefined|NaN|null)\b/.test(String(dd.label_en)) || /\b(undefined|NaN|null)\b/.test(String(dd.label_ar))) add(`dimension "${d}" label leaks null/undefined/NaN`);
    // Arabic label must be native (no long English runs).
    if (/[A-Za-z]{4,}/.test(String(dd.label_ar || ''))) add(`dimension "${d}" AR label not translated ("${dd.label_ar}")`);
    if (dd.state !== 'indeterminate') {
      determinate += 1;
      // Unsupported structure claim: a determinate state with no evidence trail.
      if (!Array.isArray(dd.evidence) || dd.evidence.length === 0) add(`dimension "${d}" is determinate ("${dd.state}") but carries no evidence (unsupported claim)`);
    }
  }

  // available must agree with determinacy.
  if (a.available && determinate === 0) add('available=true but zero determinate dimensions (contradiction)');
  if (a.available === false && determinate > 0) add('available=false but has determinate dimensions (contradiction)');

  // Fabricated confidence: high confidence on thin coverage.
  if (a.available && typeof conf === 'number' && typeof cov === 'number' && conf >= 70 && cov < 40) add(`structural_confidence ${conf} unsupported by coverage ${cov} (fabricated confidence)`);

  // Dominant pointer must match its dimension's state.
  if (a.dominant) {
    const dom = a.dominant;
    if (!DIMENSIONS.includes(dom.dimension)) add(`dominant references unknown dimension "${dom.dimension}"`);
    else if (dims[dom.dimension] && dims[dom.dimension].state !== dom.state) add(`dominant state "${dom.state}" does not match dimension "${dom.dimension}" state "${dims[dom.dimension].state}"`);
  }

  // Stale-as-live: an old market state must not carry high structural confidence.
  const ageH = a.attribution && a.attribution.market_state_age_hours;
  if (typeof ageH === 'number' && ageH > 240 && a.available && typeof conf === 'number' && conf >= 60) add(`stale market state (${ageH}h) presented with high structural confidence ${conf} (stale-as-live)`);

  return f;
}

if (!fs.existsSync(ARTIFACT)) {
  console.log('[market-structure] no market-structure.json yet — nothing to validate (non-fatal).');
  console.log('[market-structure] check:market-structure passed.');
  process.exit(0);
}

let artifact;
try { artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[market-structure] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
validate(artifact).forEach(fail);

// ── Self-tests (negative): the validator must reject fabricated artifacts. ──
if (process.argv.includes('--self-test')) {
  const base = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8'));
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['unknown state', (a) => { a.dimensions.participation.state = 'rocket_launch'; }],
    ['determinate no evidence', (a) => { a.dimensions.stability.state = 'stable'; a.dimensions.stability.evidence = []; }],
    ['fabricated confidence', (a) => { a.structural_confidence = 95; a.coverage_pct = 20; a.available = true; }],
    ['dominant mismatch', (a) => { a.dominant = { dimension: 'stability', state: 'unstable' }; a.dimensions.stability.state = 'stable'; }],
    ['untranslated AR label', (a) => { a.dimensions.participation.label_ar = 'broad participation'; }],
    ['stale-as-live', (a) => { a.attribution.market_state_age_hours = 999; a.structural_confidence = 80; a.available = true; }],
    ['available contradiction', (a) => { a.available = true; for (const d of DIMENSIONS) a.dimensions[d].state = 'indeterminate'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) {
    const c = clone(); mut(c);
    if (validate(c).length > 0) ok += 1; else console.error(`[market-structure] SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (validate(base).length === 0) ok += 1; else console.error('[market-structure] SELF-TEST FAIL: clean artifact rejected');
  console.log(`[market-structure] self-tests: ${ok}/${cases.length + 1} passed`);
  if (ok !== cases.length + 1) process.exit(1);
}

if (failures.length) {
  failures.forEach((m) => console.error(`[market-structure] FAIL: ${m}`));
  process.exit(1);
}
const det = DIMENSIONS.filter((d) => artifact.dimensions[d] && artifact.dimensions[d].state !== 'indeterminate').length;
console.log(`[market-structure] check:market-structure passed (available=${artifact.available}, ${det}/${DIMENSIONS.length} determinate, confidence ${artifact.structural_confidence}; enum-valid, evidence-backed, bilingual, honest freshness).`);
