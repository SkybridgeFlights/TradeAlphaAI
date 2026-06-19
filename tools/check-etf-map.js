'use strict';

// Phase 214 CP7 - check:etf-map.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const MAP_FILE = path.join(ROOT, 'data', 'visual', 'etf-map.json');
const EN_PAGE = path.join(ROOT, 'market-map', 'etfs', 'index.html');
const AR_PAGE = path.join(ROOT, 'ar', 'market-map', 'etfs', 'index.html');
const SYMBOLS = new Set(ETFS.map((etf) => etf.symbol));
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bentry point\b/i, /\bstop[- ]?loss\b/i,
  /\bprice target\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|crash)\b/i,
  /[\u0634]\u0631\u0627\u0621\s+\u0627\u0644\u0622\u0646|[\u0628]\u064a\u0639\s+\u0627\u0644\u0622\u0646|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0645\u0636\u0645\u0648\u0646/
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function validateArtifact(map) {
  const failures = [];
  if (!map || map.source_layer !== 'etf-map') failures.push('bad source_layer');
  if (map.schema_version !== '1.0') failures.push('bad schema_version');
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  if (nodes.length !== ETFS.length) failures.push(`expected ${ETFS.length} nodes, got ${nodes.length}`);
  if (map.nodes_total !== nodes.length) failures.push('nodes_total mismatch');
  const seen = new Set();
  for (const node of nodes) {
    const id = node && node.symbol || '?';
    if (!SYMBOLS.has(id)) failures.push(`unknown ETF ${id}`);
    if (seen.has(id)) failures.push(`duplicate ETF ${id}`);
    seen.add(id);
    for (const field of ['slug', 'category', 'exposure_type', 'rank_label', 'rank_label_en', 'rank_label_ar', 'direction', 'direction_en', 'direction_ar', 'confirmation', 'confirmation_en', 'confirmation_ar']) {
      if (!node[field] && node[field] !== false) failures.push(`${id}: missing ${field}`);
    }
    if (!ARABIC.test(String(node.rank_label_ar || ''))) failures.push(`${id}: rank_label_ar not Arabic`);
    if (!Array.isArray(node.evidence) || node.evidence.length < 3) failures.push(`${id}: missing evidence`);
    if (typeof node.visual_weight !== 'number') failures.push(`${id}: missing visual_weight`);
  }
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(nodes)).digest('hex');
  if (map.source_hash !== recomputed) failures.push('source_hash mismatch');
  const text = JSON.stringify(map);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(text)) failures.push('map leaks undefined/NaN/[object Object]');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden ETF map language ${re}`);
  return failures;
}

function validatePage(file, ar) {
  const failures = [];
  if (!fs.existsSync(file)) return [`${path.relative(ROOT, file)} missing`];
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);
  if (!/<svg\b[^>]*viewBox=/.test(html)) failures.push(`${rel}: missing responsive SVG map`);
  if (/<table\b/i.test(html)) failures.push(`${rel}: map rendered as table`);
  if (!/id="etf-map"/.test(html)) failures.push(`${rel}: missing etf-map section`);
  if (!/market-map\/etfs\//.test(html)) failures.push(`${rel}: missing ETF map route`);
  if (!/research\/etfs\//.test(html)) failures.push(`${rel}: missing ETF research links`);
  if (!/not a trading signal|ليست إشارة تداول/.test(html)) failures.push(`${rel}: missing safety disclaimer`);
  if (ar && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing AR RTL`);
  if (!ar && !/<html lang="en" dir="ltr">/.test(html)) failures.push(`${rel}: missing EN LTR`);
  if (ar && !ARABIC.test(html)) failures.push(`${rel}: Arabic page lacks Arabic`);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(html)) failures.push(`${rel}: leaks undefined/NaN/[object Object]`);
  for (const re of FORBIDDEN) if (re.test(html)) failures.push(`${rel}: forbidden ETF map language ${re}`);
  return failures;
}

function validate() {
  const failures = [];
  if (!fs.existsSync(MAP_FILE)) failures.push('missing data/visual/etf-map.json');
  else failures.push(...validateArtifact(readJson(MAP_FILE)));
  failures.push(...validatePage(EN_PAGE, false));
  failures.push(...validatePage(AR_PAGE, true));
  return failures;
}

function run() {
  const failures = validate();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-map] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[etf-map] check:etf-map passed (artifact + EN/AR visual pages).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-etf-map');
  const base = build();
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing node', (m) => { m.nodes.pop(); m.nodes_total = m.nodes.length; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.nodes)).digest('hex'); }, true],
    ['unknown symbol', (m) => { m.nodes[0].symbol = 'XYZ'; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.nodes)).digest('hex'); }, true],
    ['missing evidence', (m) => { m.nodes[0].evidence = []; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.nodes)).digest('hex'); }, true],
    ['forbidden', (m) => { m.nodes[0].evidence = ['buy now']; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.nodes)).digest('hex'); }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const failed = validateArtifact(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-map] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
