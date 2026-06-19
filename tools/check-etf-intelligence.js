'use strict';

// Phase 214 CP3 - check:etf-intelligence.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'etf-intelligence.json');
const CHARTS_FILE = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const SYMBOLS = new Set(ETFS.map((etf) => etf.symbol));
const STATES = new Set(['constructive', 'neutral', 'pressured', 'mixed', 'indeterminate', 'unavailable', 'available', 'moderate', 'low']);
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /\bforecast(?:s|ed|ing)?\b/i, /\brecommend(?:s|ed|ation)?\b/i,
  /[\u0634]\u0631\u0627\u0621|[\u0628]\u064a\u0639|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0625\u0634\u0627\u0631\u0629\s*\u062a\u062f\u0627\u0648\u0644|\u0645\u0636\u0645\u0648\u0646/
];

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function validateNode(node, id, field, failures) {
  if (!node || typeof node !== 'object') {
    failures.push(`${id}: ${field} not an object`);
    return;
  }
  if (!STATES.has(node.state)) failures.push(`${id}: ${field} invalid state ${node.state}`);
  if (!node.label_en || typeof node.label_en !== 'string') failures.push(`${id}: ${field} missing label_en`);
  if (!node.label_ar || !ARABIC.test(String(node.label_ar))) failures.push(`${id}: ${field} missing Arabic label`);
  if (!Array.isArray(node.evidence) || !node.evidence.length) failures.push(`${id}: ${field} missing evidence`);
}

function validate(artifact, opts = {}) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['artifact not an object'];
  if (artifact.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (artifact.source_layer !== 'etf-intelligence') failures.push(`unexpected source_layer "${artifact.source_layer}"`);
  if (artifact.available !== true) failures.push('artifact not marked available');
  if (artifact.etfs_total !== ETFS.length) failures.push(`etfs_total mismatch ${artifact.etfs_total}`);
  const etfs = Array.isArray(artifact.etfs) ? artifact.etfs : [];
  if (etfs.length !== ETFS.length) failures.push(`expected ${ETFS.length} ETF entries, got ${etfs.length}`);
  const seen = new Set();
  const chartManifest = opts.chartManifest || readJson(CHARTS_FILE, { charts: [], unavailable: [] });
  const chartSymbols = new Set((chartManifest.charts || []).map((chart) => chart.symbol));
  const unavailableSymbols = new Set((chartManifest.unavailable || []).map((entry) => entry.symbol));

  for (const etf of etfs) {
    const id = etf && etf.symbol || '?';
    if (!SYMBOLS.has(id)) failures.push(`${id}: unknown ETF`);
    if (seen.has(id)) failures.push(`${id}: duplicate ETF entry`);
    seen.add(id);
    for (const field of ['slug', 'category', 'exposure_type', 'fund_name', 'role_en', 'role_ar']) {
      if (!etf[field] || typeof etf[field] !== 'string') failures.push(`${id}: missing ${field}`);
    }
    if (!ARABIC.test(String(etf.role_ar || ''))) failures.push(`${id}: role_ar not Arabic`);
    for (const field of ['structure', 'tactical', 'liquidity', 'participation', 'confidence', 'regime_alignment']) {
      validateNode(etf[field], id, field, failures);
    }
    if (!etf.narrative_alignment || typeof etf.narrative_alignment !== 'object') failures.push(`${id}: missing narrative_alignment`);
    else {
      if (!['available', 'indeterminate'].includes(etf.narrative_alignment.state)) failures.push(`${id}: invalid narrative_alignment state`);
      if (!etf.narrative_alignment.label_en) failures.push(`${id}: narrative_alignment missing label_en`);
      if (!ARABIC.test(String(etf.narrative_alignment.label_ar || ''))) failures.push(`${id}: narrative_alignment missing Arabic label`);
      if (!Array.isArray(etf.narrative_alignment.evidence) || !etf.narrative_alignment.evidence.length) failures.push(`${id}: narrative_alignment missing evidence`);
    }
    if (!Array.isArray(etf.evidence) || etf.evidence.length < 3) failures.push(`${id}: insufficient evidence`);
    if (!Array.isArray(etf.related) || !etf.related.length) failures.push(`${id}: missing related`);
    if (!Array.isArray(etf.research_links) || !etf.research_links.length) failures.push(`${id}: missing research_links`);
    if (etf.chart_available === true && !chartSymbols.has(id)) failures.push(`${id}: chart_available true but no chart in manifest`);
    if (etf.chart_available === false && chartSymbols.has(id)) failures.push(`${id}: chart_available false but chart exists`);
    if (etf.chart_available === false && !etf.unavailable_reason) failures.push(`${id}: missing unavailable_reason`);
    if (etf.chart_available === false && !chartSymbols.has(id) && !unavailableSymbols.has(id)) failures.push(`${id}: missing chart unavailable entry`);
  }

  for (const required of SYMBOLS) {
    if (!seen.has(required)) failures.push(`missing ETF entry ${required}`);
  }
  if (!Array.isArray(artifact.evidence_refs) || artifact.evidence_refs.length < 4) failures.push('missing evidence_refs');
  if (!artifact.attribution || !Array.isArray(artifact.attribution.sources) || artifact.attribution.sources.length < 4) failures.push('missing attribution sources');
  const recomputed = crypto.createHash('sha256').update(JSON.stringify(etfs)).digest('hex');
  if (artifact.source_hash !== recomputed) failures.push('source_hash mismatch');
  const text = JSON.stringify(artifact);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(text)) failures.push('artifact leaks undefined/NaN/[object Object]');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden ETF intelligence language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[etf-intelligence] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let artifact;
  try { artifact = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (error) {
    console.error(`[etf-intelligence] FAIL: malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const failures = validate(artifact);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-intelligence] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-intelligence] check:etf-intelligence passed (${artifact.etfs.length} ETFs, evidence-backed, no signal language).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const { build } = require('./build-etf-intelligence');
  const base = build();
  const chartManifest = readJson(CHARTS_FILE, { charts: [], unavailable: [] });
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing ETF', (m) => { m.etfs.pop(); m.etfs_total = m.etfs.length; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.etfs)).digest('hex'); }, true],
    ['duplicate ETF', (m) => { m.etfs.push({ ...m.etfs[0] }); m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.etfs)).digest('hex'); }, true],
    ['missing evidence', (m) => { m.etfs[0].structure.evidence = []; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.etfs)).digest('hex'); }, true],
    ['bad Arabic', (m) => { m.etfs[0].role_ar = 'ETF role'; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.etfs)).digest('hex'); }, true],
    ['forbidden language', (m) => { m.etfs[0].tactical.label_en = 'buy signal'; m.source_hash = crypto.createHash('sha256').update(JSON.stringify(m.etfs)).digest('hex'); }, true],
    ['hash mismatch', (m) => { m.etfs[0].slug = 'changed'; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(base));
    mutate(copy);
    const failed = validate(copy, { chartManifest }).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-intelligence] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
