'use strict';

// Phase 210 CP4 — check:regime-history.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'regime-history.json');
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function validate(history) {
  const failures = [];
  if (!history || typeof history !== 'object') return ['artifact not an object'];
  if (history.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (history.source_layer !== 'regime-history') failures.push(`unexpected source_layer "${history.source_layer}"`);
  if (!history.generated_at || Number.isNaN(Date.parse(history.generated_at))) failures.push('missing valid generated_at');
  if (!history.source_hash || !/^[a-f0-9]{64}$/.test(history.source_hash)) failures.push('missing deterministic source_hash');
  const timeline = Array.isArray(history.timeline_entries) ? history.timeline_entries : [];
  if (!timeline.length) failures.push('missing timeline_entries');
  let priorDate = '';
  for (const entry of timeline) {
    if (!entry.date) failures.push('timeline entry missing date');
    if (priorDate && String(entry.date) < priorDate) failures.push('timeline entries not sorted');
    priorDate = String(entry.date || priorDate);
    if (!entry.regime_state || !entry.regime_state_en || !ARABIC.test(String(entry.regime_state_ar || ''))) failures.push(`${entry.date || '?'}: missing bilingual regime state`);
    if (!['initial_snapshot', 'changed', 'persisted'].includes(entry.transition_marker)) failures.push(`${entry.date || '?'}: invalid transition_marker`);
    if (!Array.isArray(entry.evidence) || !entry.evidence.length) failures.push(`${entry.date || '?'}: missing evidence`);
  }
  const state = history.historical_regime_states || {};
  if (state.snapshot_count !== timeline.length) failures.push('snapshot_count does not match timeline length');
  if (timeline.length <= 1 && state.ledger_state !== 'no_prior') failures.push('thin history must be ledger_state no_prior');
  if (!state.current_state || !ARABIC.test(String(state.current_state_ar || ''))) failures.push('missing bilingual current state');
  const transitions = Array.isArray(history.transition_history) ? history.transition_history : [];
  if (!transitions.length) failures.push('missing transition_history');
  for (const item of transitions) {
    if (!item.date || !item.to_state) failures.push('transition item missing date/to_state');
    if (!ARABIC.test(String(item.label_ar || ''))) failures.push(`${item.date || '?'}: transition label_ar not Arabic`);
    if (!Array.isArray(item.evidence) || !item.evidence.length) failures.push(`${item.date || '?'}: transition missing evidence`);
  }
  const confidence = Array.isArray(history.confidence_evolution) ? history.confidence_evolution : [];
  if (!confidence.length) failures.push('missing confidence_evolution');
  for (const item of confidence) {
    if (!item.confidence_band || !item.history_depth) failures.push('confidence item missing band/history_depth');
    if (!ARABIC.test(String(item.confidence_band_ar || ''))) failures.push('confidence item missing Arabic band');
    if (!Array.isArray(item.evidence) || !item.evidence.length) failures.push('confidence item missing evidence');
  }
  const sources = history.attribution && Array.isArray(history.attribution.sources) ? history.attribution.sources : [];
  for (const required of ['data/market-regime-history.json', 'data/intelligence/historical-snapshots.json', 'data/intelligence/regime-transitions.json']) {
    if (!sources.includes(required)) failures.push(`missing attribution source ${required}`);
  }
  if (!Array.isArray(history.evidence_refs) || history.evidence_refs.length < 3) failures.push('top-level evidence_refs too sparse');
  const text = JSON.stringify(history);
  if (/\b(undefined|NaN)\b/.test(text)) failures.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden advice/forecast language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[regime-history] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let history;
  try { history = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (err) {
    console.error(`[regime-history] FAIL: malformed JSON: ${err.message}`);
    process.exit(1);
  }
  const failures = validate(history);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[regime-history] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[regime-history] check:regime-history passed (timeline, transitions, confidence depth, no fabricated history).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const sample = require('./build-regime-history').build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['unsorted timeline', (m) => { if (m.timeline_entries.length > 1) m.timeline_entries.reverse(); }, true],
    ['bad marker', (m) => { m.timeline_entries[0].transition_marker = 'predicted'; }, true],
    ['missing evidence', (m) => { m.timeline_entries[0].evidence = []; }, true],
    ['bad count', (m) => { m.historical_regime_states.snapshot_count = 999; }, true],
    ['english arabic', (m) => { m.timeline_entries[0].regime_state_ar = 'risk on'; }, true],
    ['forbidden language', (m) => { m.timeline_entries[0].evidence = ['buy signal']; }, true],
    ['missing attribution', (m) => { m.attribution.sources = []; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(sample));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[regime-history] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
