'use strict';

// Phase 207 / Workstream K — check:regime-transitions.
// Validates data/intelligence/regime-transitions.json: transition_state in the
// allowed set, drivers present, valid confidence band, evidence-backed, bilingual-
// native, no retail/forecast/future-probability language. Negative-tested.

const fs = require('fs');
const path = require('path');
const { TRANSITION, BAND } = require('./build-regime-transitions');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'regime-transitions.json');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall|reach)\b/i, /\b\d{1,3}\s?% (chance|probability)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'regime-transitions') f.push('bad source_layer');
  if (!TRANSITION[a.transition_state]) f.push(`transition_state "${a.transition_state}" not allowed`);
  else { if (a.transition_state_en !== TRANSITION[a.transition_state][0]) f.push('transition_state_en mismatch'); if (!ARABIC.test(String(a.transition_state_ar || ''))) f.push('transition_state_ar not native'); }
  if (!BAND[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  if (!a.drivers || typeof a.drivers !== 'object') f.push('missing drivers');
  else for (const k of ['risk_trend', 'rates_trend', 'volatility_trend', 'dollar_trend', 'current_macro_regime']) if (!(k in a.drivers)) f.push(`drivers missing ${k}`);
  if (!Array.isArray(a.evidence) || !a.evidence.length) f.push('missing evidence');
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-regime-transitions').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['off-label state', (m) => { m.transition_state = 'zzz'; }],
    ['bad band', (m) => { m.confidence_band = 'cosmic'; }],
    ['missing drivers', (m) => { delete m.drivers; }],
    ['no evidence', (m) => { m.evidence = []; }],
    ['forbidden language', (m) => { m.evidence.push('high probability buy'); }],
    ['untranslated AR', (m) => { m.transition_state_ar = 'stable regime'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', validate(clone()));
  console.log(`[regime-transitions] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[regime-transitions] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[regime-transitions] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[regime-transitions] FAIL: ${m}`)); process.exit(1); }
  console.log(`[regime-transitions] check:regime-transitions passed (state=${a.transition_state}, band=${a.confidence_band}; evidence-backed, no forecast).`);
}

module.exports = { validate };
