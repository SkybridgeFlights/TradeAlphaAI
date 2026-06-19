'use strict';

// Phase 209 / Workstream G — check:relative-strength.
// Validates relative-strength.json: each pair has an allowed state, evidence, and
// native bilingual labels; no retail/forecast language. Negative-tested.

const fs = require('fs');
const path = require('path');
const { STATE } = require('./build-relative-strength');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'relative-strength.json');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || a.source_layer !== 'relative-strength') f.push('bad source_layer');
  const groups = a && a.groups;
  if (!groups) { f.push('missing groups'); return f; }
  for (const g of ['asset', 'sector', 'equity']) {
    if (!Array.isArray(groups[g])) { f.push(`missing group ${g}`); continue; }
    for (const p of groups[g]) {
      if (!p.a || !p.b) f.push(`${p.id}: missing legs`);
      if (!STATE[p.state]) f.push(`${p.id}: invalid state "${p.state}"`);
      else if (!ARABIC.test(String(p.state_ar || ''))) f.push(`${p.id}: state_ar not native`);
      if (!Array.isArray(p.evidence) || !p.evidence.length) f.push(`${p.id}: missing evidence`);
    }
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-relative-strength').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('clean', validate(base).length === 0);
  const a1 = clone(); a1.groups.asset[0].state = 'zzz'; T('bad state', validate(a1).length > 0);
  const a2 = clone(); a2.groups.asset[0].evidence = []; T('no evidence', validate(a2).length > 0);
  const a3 = clone(); a3.groups.asset[0].evidence = ['strong buy']; T('forbidden', validate(a3).length > 0);
  const a4 = clone(); delete a4.groups.sector; T('missing group', validate(a4).length > 0);
  console.log(`[relative-strength] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[relative-strength] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[relative-strength] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[relative-strength] FAIL: ${m}`)); process.exit(1); }
  console.log('[relative-strength] check:relative-strength passed (pairs evidence-backed, allowed states, bilingual).');
}

module.exports = { validate };
