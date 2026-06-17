'use strict';

// Phase 206 / Workstream J — check:equity-network.
// Validates data/intelligence/equity-cognitive-network.json: every registry
// relationship present, allowed relationship state, evidence-backed chains,
// dominant_equity_state in the allowed set, bilingual-native, no retail/forecast.
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { EQUITY_RELATIONSHIPS } = require('./equity-registry');
const { REL_STATE, DOMINANT, BAND } = require('./build-equity-cognitive-network');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'equity-cognitive-network.json');
const ARABIC = /[؀-ۿ]/;
const CHAIN_KEYS = ['confirmation_chains', 'contradiction_chains', 'leadership_chains', 'sector_sensitivity_chains', 'macro_sensitivity_chains'];
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'equity-cognitive-network') f.push('bad source_layer');
  const dom = a.dominant_equity_state || {};
  if (!DOMINANT[dom.state]) f.push(`dominant_equity_state "${dom.state}" not allowed`);
  else if (!ARABIC.test(String(dom.label_ar || ''))) f.push('dominant label_ar not native');
  if (!BAND[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  const rels = Array.isArray(a.relationships) ? a.relationships : [];
  const ids = new Set(rels.map((r) => r.id));
  for (const rel of EQUITY_RELATIONSHIPS) if (!ids.has(rel.id)) f.push(`registry relationship "${rel.id}" missing`);
  for (const r of rels) {
    if (!REL_STATE[r.state]) f.push(`${r.id}: unknown state "${r.state}"`);
    if (!Array.isArray(r.evidence) || !r.evidence.length) f.push(`${r.id}: missing evidence`);
    if (r.label_ar && /[A-Za-z]{4,}/.test(String(r.label_ar).replace(/(NVDA|AMD|AVGO|SMCI|AAPL|MSFT|META|GOOGL|TSLA|PLTR|AMZN|QQQ|SPY|IWM)/g, ''))) f.push(`${r.id}: AR label not native`);
  }
  for (const key of CHAIN_KEYS) {
    if (!Array.isArray(a[key])) { f.push(`missing ${key} array`); continue; }
    for (const c of a[key]) if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`${key} ${c.id}: missing evidence`);
  }
  const text = JSON.stringify(a);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-equity-cognitive-network').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['bad dominant', (m) => { m.dominant_equity_state.state = 'zzz'; }],
    ['missing registry rel', (m) => { m.relationships = m.relationships.filter((r) => r.id !== EQUITY_RELATIONSHIPS[0].id); }],
    ['unknown rel state', (m) => { m.relationships[0].state = 'zzz'; }],
    ['rel no evidence', (m) => { m.relationships[0].evidence = []; }],
    ['chain no evidence', (m) => { if (!m.confirmation_chains.length) m.confirmation_chains.push({ id: 'x', evidence: [] }); else m.confirmation_chains[0].evidence = []; }],
    ['drop chain array', (m) => { delete m.leadership_chains; }],
    ['forbidden language', (m) => { m.evidence = (m.evidence || []).concat('strong buy'); }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', validate(clone()));
  console.log(`[equity-network] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[equity-network] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[equity-network] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[equity-network] FAIL: ${m}`)); process.exit(1); }
  console.log(`[equity-network] check:equity-network passed (dominant=${a.dominant_equity_state.state}, ${a.relationships.length} relationships; evidence-backed).`);
}

module.exports = { validate };
