'use strict';

// Phase 210 CP3 — check:leadership-dashboard.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'leadership-dashboard.json');
const GROUPS = ['asset', 'sector', 'equity'];
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function validateItem(item, group, side, failures) {
  const id = `${group}.${side}.${item && item.symbol || '?'}`;
  if (!item || typeof item !== 'object') { failures.push(`${id}: item not object`); return; }
  if (!item.symbol || !item.slug) failures.push(`${id}: missing symbol/slug`);
  for (const key of ['rank_label', 'rank_label_en', 'rank_label_ar', 'historical_direction', 'confirmation_state']) {
    if (!item[key]) failures.push(`${id}: missing ${key}`);
  }
  if (!ARABIC.test(String(item.rank_label_ar || ''))) failures.push(`${id}: rank_label_ar not Arabic`);
  if (!ARABIC.test(String(item.confirmation_ar || ''))) failures.push(`${id}: confirmation_ar not Arabic`);
  if (!item.links || item.links.en !== expectedRoute(group, item, false) || item.links.ar !== expectedRoute(group, item, true)) {
    failures.push(`${id}: invalid detail links`);
  }
  if (!Array.isArray(item.evidence) || !item.evidence.length) failures.push(`${id}: missing evidence`);
  if (!item.movement || !item.movement.label_en || !ARABIC.test(String(item.movement.label_ar || ''))) failures.push(`${id}: missing bilingual movement`);
  const refs = Array.isArray(item.relative_strength_refs) ? item.relative_strength_refs : [];
  for (const ref of refs) {
    if (!ref.id || !ref.state) failures.push(`${id}: malformed relative strength ref`);
    if (!ARABIC.test(String(ref.label_ar || ref.state_ar || ''))) failures.push(`${id}: relative strength ref missing Arabic`);
  }
}

function expectedRoute(group, item, ar) {
  const slug = item.slug || String(item.symbol || '').toLowerCase();
  if (group === 'asset') return `${ar ? '/ar' : ''}/markets/${slug}/`;
  if (group === 'sector') return `${ar ? '/ar' : ''}/sectors/${slug}/`;
  return `${ar ? '/ar' : ''}/equities/${slug}/`;
}

function validate(dashboard) {
  const failures = [];
  if (!dashboard || typeof dashboard !== 'object') return ['artifact not an object'];
  if (dashboard.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (dashboard.source_layer !== 'leadership-dashboard') failures.push(`unexpected source_layer "${dashboard.source_layer}"`);
  if (!dashboard.generated_at || Number.isNaN(Date.parse(dashboard.generated_at))) failures.push('missing valid generated_at');
  if (!dashboard.source_hash || !/^[a-f0-9]{64}$/.test(dashboard.source_hash)) failures.push('missing deterministic source_hash');
  const groups = dashboard.groups || {};
  for (const group of GROUPS) {
    const data = groups[group];
    if (!data) { failures.push(`missing group ${group}`); continue; }
    if (!data.title_en || !ARABIC.test(String(data.title_ar || ''))) failures.push(`${group}: missing bilingual title`);
    if (!Array.isArray(data.strongest) || !data.strongest.length) failures.push(`${group}: missing strongest list`);
    if (!Array.isArray(data.weakest) || !data.weakest.length) failures.push(`${group}: missing weakest list`);
    if ((data.strongest || []).length > 5 || (data.weakest || []).length > 5) failures.push(`${group}: list exceeds max 5`);
    for (const item of data.strongest || []) validateItem(item, group, 'strongest', failures);
    for (const item of data.weakest || []) validateItem(item, group, 'weakest', failures);
  }
  const sources = dashboard.attribution && Array.isArray(dashboard.attribution.sources) ? dashboard.attribution.sources : [];
  for (const required of ['rankings.json', 'relative-strength.json', 'ranking-history.json']) {
    if (!sources.includes(required)) failures.push(`missing attribution source ${required}`);
  }
  if (!Array.isArray(dashboard.evidence_refs) || dashboard.evidence_refs.length < 6) failures.push('top-level evidence_refs too sparse');
  const text = JSON.stringify(dashboard);
  if (/\b(undefined|NaN)\b/.test(text)) failures.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden advice/forecast language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[leadership-dashboard] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let dashboard;
  try { dashboard = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (err) {
    console.error(`[leadership-dashboard] FAIL: malformed JSON: ${err.message}`);
    process.exit(1);
  }
  const failures = validate(dashboard);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[leadership-dashboard] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[leadership-dashboard] check:leadership-dashboard passed (rankings-sourced, linked, bilingual, no advice language).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const sample = require('./build-leadership-dashboard').build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing group', (m) => { delete m.groups.asset; }, true],
    ['empty strongest', (m) => { m.groups.asset.strongest = []; }, true],
    ['bad route', (m) => { m.groups.asset.strongest[0].links.en = '/x/'; }, true],
    ['missing evidence', (m) => { m.groups.asset.strongest[0].evidence = []; }, true],
    ['english arabic', (m) => { m.groups.asset.strongest[0].rank_label_ar = 'strong'; }, true],
    ['forbidden language', (m) => { m.groups.asset.strongest[0].evidence = ['buy signal']; }, true],
    ['missing attribution', (m) => { m.attribution.sources = []; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(sample));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[leadership-dashboard] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
