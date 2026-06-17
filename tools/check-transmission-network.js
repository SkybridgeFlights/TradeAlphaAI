'use strict';

// Phase 204 / Workstream H — check:transmission-network.
// Validates the cross-asset transmission_chains in cognitive-network.json: each
// chain links a MACRO leg (UUP/TLT/VIXY/GLD) to a RISK leg (SPY/QQQ/IWM), carries
// an allowed relationship state and evidence, and references only registry
// assets. HARD-FAILS on a fabricated transmission (legs not macro→risk), an
// unknown state, missing evidence, or retail/prediction language. Negative-tested.

const fs = require('fs');
const path = require('path');
const { MACRO_LEG, RISK_LEG } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const STATES = new Set(['confirmation', 'contradiction', 'stress', 'evidence_unavailable']);
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bstrong buy\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  const chains = Array.isArray(a.transmission_chains) ? a.transmission_chains : null;
  if (!chains) { f.push('missing transmission_chains array'); return f; }
  for (const c of chains) {
    if (!c.from || !MACRO_LEG.has(c.from)) f.push(`${c.id}: "from" leg "${c.from}" is not a macro leg`);
    if (!c.to || !RISK_LEG.has(c.to)) f.push(`${c.id}: "to" leg "${c.to}" is not a risk leg`);
    if (!STATES.has(c.state)) f.push(`${c.id}: unknown state "${c.state}"`);
    if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`${c.id}: missing evidence`);
    if (!c.label_ar || /[A-Za-z]{4,}/.test(String(c.label_ar).replace(/(SPY|QQQ|IWM|GLD|TLT|UUP|VIXY)/g, ''))) f.push(`${c.id}: AR label not native`);
  }
  const text = JSON.stringify(chains);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/prediction language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-cognitive-network').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['missing array', (m) => { delete m.transmission_chains; }],
    ['bad from leg', (m) => { if (!m.transmission_chains.length) m.transmission_chains.push({ id: 'x', from: 'SPY', to: 'SPY', state: 'confirmation', evidence: ['e'], label_ar: 'س' }); else m.transmission_chains[0].from = 'SPY'; }],
    ['bad to leg', (m) => { if (m.transmission_chains.length) m.transmission_chains[0].to = 'UUP'; else m.transmission_chains.push({ id: 'x', from: 'UUP', to: 'TLT', state: 'confirmation', evidence: ['e'], label_ar: 'س' }); }],
    ['unknown state', (m) => { if (m.transmission_chains.length) m.transmission_chains[0].state = 'zzz'; else m.transmission_chains.push({ id: 'x', from: 'UUP', to: 'SPY', state: 'zzz', evidence: ['e'], label_ar: 'س' }); }],
    ['missing evidence', (m) => { if (m.transmission_chains.length) m.transmission_chains[0].evidence = []; else m.transmission_chains.push({ id: 'x', from: 'UUP', to: 'SPY', state: 'stress', evidence: [], label_ar: 'س' }); }],
    ['forbidden language', (m) => { (m.transmission_chains[0] || (m.transmission_chains[0] = { id: 'x', from: 'UUP', to: 'SPY', state: 'stress', evidence: ['e'], label_ar: 'س' })).evidence.push('strong buy'); }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean rejected:', validate(clone()));
  console.log(`[transmission-network] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[transmission-network] no artifact yet — nothing to validate (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[transmission-network] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[transmission-network] FAIL: ${m}`)); process.exit(1); }
  console.log(`[transmission-network] check:transmission-network passed (${a.transmission_chains.length} macro→risk transmission chain(s); evidence-backed).`);
}

module.exports = { validate };
