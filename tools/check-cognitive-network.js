'use strict';

// Phase 201 / Workstream G — check:cognitive-network.
// Integrity + anti-fabrication gate for data/intelligence/cognitive-network.json.
// HARD-FAILS on: bad source_layer/schema, a dominant state outside the allowed
// label set, an invalid confidence band, a relationship/chain with an unknown
// state or NO evidence, a fragility chain missing its tactical/structure
// evidence, available↔data inconsistency, untranslated Arabic labels, null
// leaks, or retail/advice/prediction/certainty language. Observed cross-asset
// percentage moves in evidence are allowed (real data, not fabricated
// precision). An honest empty (no relationship data) artifact passes.
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { NETWORK_LABELS, REL_STATE_LABELS, BAND_LABELS } = require('./build-cognitive-network');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\blong\b/i, /\bshort\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i,
  /\btake[- ]?profit\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bstrong buy\b/i,
  /\bguaranteed\b/i, /\bwill (rise|fall|rally|drop|surge|plunge|reverse)\b/i, /\bdefinitely\b/i,
  /\bpredicted? returns?\b/i, /\bRSI\b/, /\bMACD\b/,
];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'cognitive-network') f.push(`unexpected source_layer "${a.source_layer}"`);
  if (a.schema_version !== '1.0') f.push(`unexpected schema_version ${a.schema_version}`);
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) f.push('missing attribution.sources');
  if (!BAND_LABELS[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);

  const dom = a.dominant_network_state || {};
  if (!NETWORK_LABELS[dom.state]) f.push(`dominant state "${dom.state}" not in allowed label set`);
  else {
    if (dom.label_en !== NETWORK_LABELS[dom.state][0]) f.push('dominant label_en mismatch');
    if (!ARABIC.test(String(dom.label_ar || ''))) f.push('dominant label_ar not native Arabic');
  }

  const rels = Array.isArray(a.relationships) ? a.relationships : [];
  if (!rels.length) f.push('no relationships array');
  const withData = [];
  for (const r of rels) {
    if (!REL_STATE_LABELS[r.state]) { f.push(`relationship ${r.id}: unknown state "${r.state}"`); continue; }
    if (!Array.isArray(r.evidence) || !r.evidence.length) f.push(`relationship ${r.id}: missing evidence`);
    if (r.label_ar && /[A-Za-z]{4,}/.test(r.label_ar.replace(/(SPY|QQQ|IWM|GLD|TLT|UUP|VIXY|DXY|VIX|GOLD)/g, ''))) f.push(`relationship ${r.id}: AR label not translated`);
    if (r.state !== 'evidence_unavailable') withData.push(r);
  }
  if (a.available === true && !withData.length) f.push('available=true but no relationship has data');
  if (a.available === false && withData.length) f.push('available=false but relationships have data');

  // Chains must carry evidence; fragility chains must cite tactical/structure.
  for (const key of ['confirmation_chains', 'contradiction_chains', 'stress_chains', 'fragility_chains']) {
    const chains = Array.isArray(a[key]) ? a[key] : [];
    for (const c of chains) {
      if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`${key} ${c.id}: missing evidence`);
      if (key === 'fragility_chains' && !c.evidence.some((e) => /tactical-context|market-structure/.test(e))) f.push(`fragility chain ${c.id}: missing tactical/structure evidence`);
    }
  }

  const text = JSON.stringify(a);
  if (/\b(undefined|NaN|null)\b/.test(text.replace(/"[a-z_]*":null/g, ''))) f.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/advice/prediction language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-cognitive-network').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['bad source_layer', (m) => { m.source_layer = 'x'; }],
    ['dominant off-label', (m) => { m.dominant_network_state.state = 'rocket'; }],
    ['relationship unknown state', (m) => { m.relationships[0].state = 'vibes'; }],
    ['relationship no evidence', (m) => { m.relationships[0].evidence = []; }],
    ['invalid band', (m) => { m.confidence_band = 'cosmic'; }],
    ['forbidden language', (m) => { m.evidence.push('strong buy signal here'); }],
    ['available contradiction', (m) => { m.available = false; }],
    ['untranslated AR', (m) => { m.dominant_network_state.label_ar = 'defensive rotation'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean rejected:', validate(clone()));
  console.log(`[cognitive-network] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[cognitive-network] no artifact yet — nothing to validate (non-fatal).'); process.exit(0); }
  let artifact;
  try { artifact = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[cognitive-network] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(artifact);
  if (failures.length) { failures.forEach((m) => console.error(`[cognitive-network] FAIL: ${m}`)); process.exit(1); }
  console.log(`[cognitive-network] check:cognitive-network passed (state=${artifact.dominant_network_state.state}, band=${artifact.confidence_band}; evidence-grounded, bilingual, no retail/prediction language).`);
}

module.exports = { validate };
