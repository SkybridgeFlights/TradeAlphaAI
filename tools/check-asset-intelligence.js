'use strict';

// Phase 201 / Workstream G — check:asset-intelligence.
// Integrity + anti-fabrication gate for data/intelligence/asset-intelligence.json.
// HARD-FAILS on: an asset outside the registry, a score_label outside the
// allowed 5-level set (+unavailable), a component with an unknown state or no
// evidence, a scored asset (label != unavailable) whose data_quality is
// unavailable or that has no evidence, an `unavailable` label with no
// unavailable_reason, a structure component claiming constructive/pressured
// WITHOUT a real verified chart (fabricated per-asset structure), a series_hash
// not present in the institutional-charts manifest, untranslated Arabic, null
// leaks, or retail/advice language (buy/sell/strong buy/price target/...).
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');
const { SCORE_LABELS, COMP_LABELS, DQ_LABELS } = require('./build-asset-intelligence');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'asset-intelligence.json');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const ARABIC = /[؀-ۿ]/;
const REGISTRY = new Set(ASSETS.map((a) => a.symbol));
const COMPONENT_KEYS = ['structure', 'tactical', 'liquidity', 'participation', 'cross_asset_alignment'];
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\btarget price\b/i, /\bstrong buy\b/i, /\bstrong sell\b/i,
  /\bguaranteed\b/i, /\bwill (rise|fall|rally|drop|surge|plunge)\b/i, /\bRSI\b/, /\bMACD\b/,
];

function manifestHashes() {
  try { return new Set((JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).charts || []).map((c) => c.series_hash).filter(Boolean)); } catch { return new Set(); }
}

function validate(a, hashes = new Set()) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'asset-intelligence') f.push(`unexpected source_layer "${a.source_layer}"`);
  if (a.schema_version !== '1.0') f.push(`unexpected schema_version ${a.schema_version}`);
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) f.push('missing attribution.sources');
  const assets = Array.isArray(a.assets) ? a.assets : [];
  if (!assets.length) f.push('no assets array');

  for (const asset of assets) {
    const id = asset.symbol || '?';
    if (!REGISTRY.has(asset.symbol)) f.push(`${id}: asset not in registry`);
    if (!SCORE_LABELS[asset.score_label]) { f.push(`${id}: unknown score_label "${asset.score_label}"`); continue; }
    if (asset.score_label_en !== SCORE_LABELS[asset.score_label][0]) f.push(`${id}: score_label_en mismatch`);
    if (!ARABIC.test(String(asset.score_label_ar || ''))) f.push(`${id}: score_label_ar not native Arabic`);
    if (!DQ_LABELS[asset.data_quality]) f.push(`${id}: invalid data_quality "${asset.data_quality}"`);

    const comps = asset.score_components || {};
    for (const key of COMPONENT_KEYS) {
      const c = comps[key];
      if (!c) { f.push(`${id}: missing component "${key}"`); continue; }
      if (!COMP_LABELS[c.state]) f.push(`${id}.${key}: unknown state "${c.state}"`);
      if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`${id}.${key}: missing evidence`);
      if (c.label_ar && /[A-Za-z]{4,}/.test(c.label_ar)) f.push(`${id}.${key}: AR label not translated`);
    }

    // Anti-fabrication: a determinate structure component requires a real chart.
    const structState = comps.structure && comps.structure.state;
    if (['constructive', 'pressured'].includes(structState) && asset.has_chart !== true) {
      f.push(`${id}: structure component "${structState}" without a real chart (fabricated per-asset structure)`);
    }
    if (asset.has_chart) {
      if (!asset.series_hash) f.push(`${id}: has_chart but no series_hash`);
      else if (hashes.size && !hashes.has(asset.series_hash)) f.push(`${id}: series_hash not in institutional-charts manifest`);
    }

    if (asset.score_label === 'unavailable') {
      if (!asset.unavailable_reason) f.push(`${id}: unavailable score without unavailable_reason`);
    } else {
      if (asset.data_quality === 'unavailable') f.push(`${id}: scored "${asset.score_label}" but data_quality unavailable`);
      if (!Array.isArray(asset.evidence) || !asset.evidence.length) f.push(`${id}: scored without evidence`);
      const determinate = COMPONENT_KEYS.some((k) => comps[k] && comps[k].state !== 'unavailable');
      if (!determinate) f.push(`${id}: scored but every component is unavailable`);
    }
  }

  if (a.available === true && !assets.some((x) => x.score_label !== 'unavailable')) f.push('available=true but no asset scored');
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/advice language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-asset-intelligence').build();
  const hashes = manifestHashes();
  const clone = () => JSON.parse(JSON.stringify(base));
  const firstScored = (m) => m.assets.find((x) => x.score_label !== 'unavailable');
  const firstUnavail = (m) => m.assets.find((x) => x.score_label === 'unavailable');
  const cases = [
    ['unknown score_label', (m) => { m.assets[0].score_label = 'mega'; }],
    ['component no evidence', (m) => { m.assets[0].score_components.tactical.evidence = []; }],
    ['unknown component state', (m) => { m.assets[0].score_components.liquidity.state = 'spicy'; }],
    ['fabricated structure', (m) => { const a = m.assets.find((x) => !x.has_chart); a.score_components.structure.state = 'constructive'; }],
    ['scored but dq unavailable', (m) => { const a = firstScored(m); a.data_quality = 'unavailable'; }],
    ['unavailable without reason', (m) => { const a = firstUnavail(m); if (a) a.unavailable_reason = null; else m.assets[0].score_label = 'unavailable', m.assets[0].unavailable_reason = null; }],
    ['forbidden language', (m) => { m.assets[0].evidence.push('strong buy now'); }],
    ['untranslated AR', (m) => { m.assets[0].score_label_ar = 'neutral'; }],
    ['asset off-registry', (m) => { m.assets[0].symbol = 'DOGE'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c, hashes).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone(), hashes).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean rejected:', validate(clone(), hashes));
  console.log(`[asset-intelligence] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[asset-intelligence] no artifact yet — nothing to validate (non-fatal).'); process.exit(0); }
  let artifact;
  try { artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[asset-intelligence] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(artifact, manifestHashes());
  if (failures.length) { failures.forEach((m) => console.error(`[asset-intelligence] FAIL: ${m}`)); process.exit(1); }
  console.log(`[asset-intelligence] check:asset-intelligence passed (${artifact.assets_scored}/${artifact.assets_total} scored; evidence-grounded, no fabricated structure, no retail language, bilingual).`);
}

module.exports = { validate };
