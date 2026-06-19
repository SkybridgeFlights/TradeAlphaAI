'use strict';

// Phase 214 CP4 - check:etf-rankings.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'etf-rankings.json');
const SYMBOLS = new Set(ETFS.map((etf) => etf.symbol));
const RANKS = new Set(['strongest', 'strong', 'constructive', 'neutral', 'weakening', 'weak', 'weakest', 'indeterminate']);
const STATES = new Set(['confirmed', 'mixed', 'divergent', 'constructive', 'neutral', 'pressured', 'indeterminate']);
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /\bforecast(?:s|ed|ing)?\b/i, /\brecommend(?:s|ed|ation)?\b/i,
  /[\u0634]\u0631\u0627\u0621|[\u0628]\u064a\u0639|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0625\u0634\u0627\u0631\u0629\s*\u062a\u062f\u0627\u0648\u0644|\u0645\u0636\u0645\u0648\u0646/
];

function validate(artifact) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['artifact not an object'];
  if (artifact.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (artifact.source_layer !== 'etf-rankings') failures.push(`unexpected source_layer "${artifact.source_layer}"`);
  const items = Array.isArray(artifact.items) ? artifact.items : [];
  if (artifact.total !== ETFS.length) failures.push(`total mismatch ${artifact.total}`);
  if (items.length !== ETFS.length) failures.push(`expected ${ETFS.length} ETF items, got ${items.length}`);
  const seen = new Set();
  const available = items.filter((item) => item.available === true);
  if (artifact.ranked_count !== available.length) failures.push('ranked_count mismatch');
  if (artifact.available !== (available.length > 0)) failures.push('available flag mismatch');

  for (const item of items) {
    const id = item && item.symbol || '?';
    if (!SYMBOLS.has(id)) failures.push(`${id}: unknown ETF`);
    if (seen.has(id)) failures.push(`${id}: duplicate ETF ranking`);
    seen.add(id);
    for (const field of ['slug', 'category', 'exposure_type', 'fund_name', 'rank_label', 'rank_label_en', 'rank_label_ar', 'direction', 'direction_en', 'direction_ar', 'confirmation', 'confirmation_en', 'confirmation_ar']) {
      if (!item[field] || typeof item[field] !== 'string') failures.push(`${id}: missing ${field}`);
    }
    if (!RANKS.has(item.rank_label)) failures.push(`${id}: invalid rank_label ${item.rank_label}`);
    if (!STATES.has(item.confirmation)) failures.push(`${id}: invalid confirmation ${item.confirmation}`);
    if (!ARABIC.test(String(item.rank_label_ar || ''))) failures.push(`${id}: rank_label_ar not Arabic`);
    if (!ARABIC.test(String(item.direction_ar || ''))) failures.push(`${id}: direction_ar not Arabic`);
    if (!ARABIC.test(String(item.confirmation_ar || ''))) failures.push(`${id}: confirmation_ar not Arabic`);
    if (!Array.isArray(item.evidence) || item.evidence.length < 2) failures.push(`${id}: insufficient evidence`);
    if (item.available === true && item.source_group === 'unranked') failures.push(`${id}: available from unranked source`);
    if (item.available !== true && item.rank_label !== 'indeterminate') failures.push(`${id}: unavailable item has ranked label`);
    if (item.available !== true && !(item.evidence || []).some((entry) => /proxy substitution suppressed/.test(entry))) failures.push(`${id}: unavailable item lacks proxy suppression evidence`);
  }

  for (const required of SYMBOLS) if (!seen.has(required)) failures.push(`missing ETF ${required}`);
  for (const field of ['strongest_etfs', 'weakest_etfs']) {
    if (!Array.isArray(artifact[field])) failures.push(`missing ${field}`);
    for (const symbol of artifact[field] || []) {
      if (!SYMBOLS.has(symbol)) failures.push(`${field} contains unknown ${symbol}`);
      const item = items.find((entry) => entry.symbol === symbol);
      if (!item || item.available !== true) failures.push(`${field} contains unavailable ${symbol}`);
    }
  }
  if (!Array.isArray(artifact.evidence_refs) || artifact.evidence_refs.length < 4) failures.push('missing evidence_refs');
  if (!artifact.attribution || !Array.isArray(artifact.attribution.sources) || artifact.attribution.sources.length < 4) failures.push('missing attribution sources');
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
  if (artifact.source_hash !== recomputed) failures.push('source_hash mismatch');
  const text = JSON.stringify(artifact);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(text)) failures.push('artifact leaks undefined/NaN/[object Object]');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden ETF ranking language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[etf-rankings] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let artifact;
  try { artifact = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (error) {
    console.error(`[etf-rankings] FAIL: malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const failures = validate(artifact);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-rankings] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-rankings] check:etf-rankings passed (ranked=${artifact.ranked_count}/${artifact.total}, direct coverage only).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-etf-rankings');
  const base = build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing item', (m) => { m.items.pop(); m.total = m.items.length; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['duplicate', (m) => { m.items.push({ ...m.items[0] }); m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['missing evidence', (m) => { m.items[0].evidence = []; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['proxy fabrication', (m) => { const u = m.items.find((x) => !x.available); u.rank_label = 'strong'; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['bad Arabic', (m) => { m.items[0].rank_label_ar = 'strong'; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['forbidden', (m) => { m.items[0].evidence = ['buy signal']; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.items)).digest('hex'); }, true],
    ['hash mismatch', (m) => { m.items[0].slug = 'changed'; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-rankings] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
