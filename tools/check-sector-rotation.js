'use strict';

// Phase 205 / Workstream I — check:sector-rotation.
// Validates data/intelligence/sector-rotation.json: rotation_state in the allowed
// set, leadership/weakening entries evidence-backed and registry sectors, boolean
// rotation flags, bilingual-native, no retail/forecast language. Negative-tested.

const fs = require('fs');
const path = require('path');
const { SECTORS } = require('./sector-registry');
const { ROTATION, BAND } = require('./build-sector-rotation');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'sector-rotation.json');
const REGISTRY = new Set(SECTORS.map((s) => s.symbol));
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bsell signal\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'sector-rotation') f.push('bad source_layer');
  if (!ROTATION[a.rotation_state]) f.push(`rotation_state "${a.rotation_state}" not in allowed set`);
  else { if (a.rotation_state_en !== ROTATION[a.rotation_state][0]) f.push('rotation_state_en mismatch'); if (!ARABIC.test(String(a.rotation_state_ar || ''))) f.push('rotation_state_ar not native'); }
  if (!BAND[a.confidence_band]) f.push(`invalid confidence_band "${a.confidence_band}"`);
  for (const key of ['defensive_rotation', 'cyclical_rotation', 'narrow_leadership', 'broad_participation']) if (typeof a[key] !== 'boolean') f.push(`${key} not boolean`);
  for (const key of ['leadership_sectors', 'weakening_sectors']) {
    if (!Array.isArray(a[key])) { f.push(`${key} not an array`); continue; }
    for (const x of a[key]) {
      if (!REGISTRY.has(x.symbol)) f.push(`${key}: "${x.symbol}" not a registry sector`);
      if (!Array.isArray(x.evidence) || !x.evidence.length) f.push(`${key} ${x.symbol}: missing evidence`);
    }
  }
  if (a.available === true && !Array.isArray(a.sectors)) f.push('available but no sectors array');
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-sector-rotation').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['off-label state', (m) => { m.rotation_state = 'zzz'; }],
    ['bad band', (m) => { m.confidence_band = 'cosmic'; }],
    ['non-boolean flag', (m) => { m.defensive_rotation = 'yes'; }],
    ['leader not registry', (m) => { (m.leadership_sectors[0] || (m.leadership_sectors[0] = { symbol: 'X', evidence: ['e'] })).symbol = 'DOGE'; }],
    ['leader no evidence', (m) => { if (!m.leadership_sectors.length) m.leadership_sectors.push({ symbol: 'XLK', evidence: [] }); else m.leadership_sectors[0].evidence = []; }],
    ['forbidden language', (m) => { m.evidence = (m.evidence || []).concat('strong buy'); }],
    ['untranslated AR', (m) => { m.rotation_state_ar = 'defensive rotation'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', validate(clone()));
  console.log(`[sector-rotation] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[sector-rotation] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[sector-rotation] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[sector-rotation] FAIL: ${m}`)); process.exit(1); }
  console.log(`[sector-rotation] check:sector-rotation passed (state=${a.rotation_state}, band=${a.confidence_band}; evidence-backed, bilingual).`);
}

module.exports = { validate };
