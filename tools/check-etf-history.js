'use strict';

// Phase 214 CP6 - check:etf-history and check:etf-changelog.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const HIST_FILE = path.join(ROOT, 'data', 'intelligence', 'etf-history.json');
const CHANGE_FILE = path.join(ROOT, 'data', 'intelligence', 'etf-changelog.json');
const SYMBOLS = new Set(ETFS.map((etf) => etf.symbol));
const STATES = new Set(['improving', 'weakening', 'stable', 'deteriorating', 'indeterminate']);
// Phase 215 CP6 extended movement set to include accelerating (window-derived).
const MOVEMENTS = new Set(['improving', 'weakening', 'stable', 'deteriorating', 'accelerating', 'indeterminate', 'no_prior']);
const WINDOW_TRENDS = new Set(['improving', 'accelerating', 'weakening', 'deteriorating', 'stable', 'indeterminate']);
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bfabricated\b/i, /\bplaceholder\b/i, /\bbuy\b/i, /\bsell\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /[\u0634]\u0631\u0627\u0621|[\u0628]\u064a\u0639|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0645\u0636\u0645\u0648\u0646/
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateEntries(entries, failures, context) {
  if (!Array.isArray(entries) || entries.length !== ETFS.length) failures.push(`${context}: expected ${ETFS.length} entries`);
  const seen = new Set();
  for (const entry of entries || []) {
    const id = entry && entry.symbol || '?';
    if (!SYMBOLS.has(id)) failures.push(`${context}: unknown ETF ${id}`);
    if (seen.has(id)) failures.push(`${context}: duplicate ETF ${id}`);
    seen.add(id);
    if (!STATES.has(entry.current_state)) failures.push(`${context}: ${id} invalid current_state`);
    if (!MOVEMENTS.has(entry.movement)) failures.push(`${context}: ${id} invalid movement`);
    if (!entry.current_state_en || !ARABIC.test(String(entry.current_state_ar || ''))) failures.push(`${context}: ${id} missing bilingual state`);
    if (!entry.movement_en || !ARABIC.test(String(entry.movement_ar || ''))) failures.push(`${context}: ${id} missing bilingual movement`);
    if (!entry.summary_en || !ARABIC.test(String(entry.summary_ar || ''))) failures.push(`${context}: ${id} missing bilingual summary`);
    if (!Array.isArray(entry.evidence) || entry.evidence.length < 2) failures.push(`${context}: ${id} missing evidence`);
    if (entry.history_available !== true && entry.movement !== 'no_prior') failures.push(`${context}: ${id} unavailable history not no_prior`);
    // Phase 215 CP6 — window_trend field is optional but, when present, must be a known label.
    if (entry.window_trend !== undefined && !WINDOW_TRENDS.has(entry.window_trend)) failures.push(`${context}: ${id} invalid window_trend ${entry.window_trend}`);
  }
}

function validatePair(history, changelog) {
  const failures = [];
  if (!history || history.source_layer !== 'etf-history') failures.push('history bad source_layer');
  if (!changelog || changelog.source_layer !== 'etf-changelog') failures.push('changelog bad source_layer');
  if (history.schema_version !== '1.0' || changelog.schema_version !== '1.0') failures.push('schema_version mismatch');
  if (history.available !== true || changelog.available !== true) failures.push('available flag missing');
  const entities = Object.values(history.entities || {});
  validateEntries(entities, failures, 'history');
  validateEntries(changelog.entries, failures, 'changelog');
  if (history.has_prior !== (history.snapshot_count > 1)) failures.push('has_prior inconsistent with snapshot_count');
  if (history.has_prior === false) {
    for (const entry of entities) {
      // prior_state must remain no_prior when has_prior=false (only ledger
      // entries justify a non-no_prior prior_state).
      if (entry.prior_state !== 'no_prior') failures.push(`${entry.symbol}: prior state fabricated while has_prior=false`);
      // Phase 215 CP6 — movement may differ from no_prior ONLY when backed by
      // a determinate window_trend (real intraseries history from the ETF's
      // own OHLCV). Otherwise must be no_prior.
      const determinateWindow = entry.window_trend && entry.window_trend !== 'indeterminate';
      if (entry.movement !== 'no_prior' && !determinateWindow) failures.push(`${entry.symbol}: movement set without window_trend evidence while has_prior=false`);
    }
  }
  for (const bucketName of ['improving', 'weakening', 'stable', 'indeterminate']) {
    if (!Array.isArray((history.buckets || {})[bucketName])) failures.push(`history missing bucket ${bucketName}`);
    if (!Array.isArray((changelog.buckets || {})[bucketName])) failures.push(`changelog missing bucket ${bucketName}`);
  }
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(changelog.entries || [])).digest('hex');
  if (history.source_hash !== recomputed || changelog.source_hash !== recomputed) failures.push('source_hash mismatch');
  const text = JSON.stringify({ history, changelog });
  if (/\b(undefined|NaN|\[object Object\])\b/.test(text)) failures.push('history leaks undefined/NaN/[object Object]');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden ETF history language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(HIST_FILE) || !fs.existsSync(CHANGE_FILE)) {
    console.error('[etf-history] FAIL: missing etf-history.json or etf-changelog.json');
    process.exit(1);
  }
  let history; let changelog;
  try { history = readJson(HIST_FILE); changelog = readJson(CHANGE_FILE); } catch (error) {
    console.error(`[etf-history] FAIL: malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const failures = validatePair(history, changelog);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-history] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-history] check:etf-history passed (${Object.keys(history.entities).length} ETFs, has_prior=${history.has_prior}).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-etf-history');
  const base = build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['fabricated prior', (m) => { m.history.entities.VOO.prior_state = 'improving'; }, true],
    ['bad movement', (m) => { m.changelog.entries[0].movement = 'breakout'; }, true],
    ['missing evidence', (m) => { m.changelog.entries[0].evidence = []; }, true],
    ['bad Arabic', (m) => { m.changelog.entries[0].summary_ar = 'not Arabic'; }, true],
    ['forbidden language', (m) => { m.changelog.entries[0].evidence = ['buy signal']; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const failed = validatePair(copy.history, copy.changelog).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-history] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validatePair, run };
