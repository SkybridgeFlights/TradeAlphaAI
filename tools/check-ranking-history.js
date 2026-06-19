'use strict';

// Phase 209 / Workstream G — check:ranking-history.
// Validates ranking-history.json: each entity has an allowed movement label, a
// current rank, observed direction, evidence; movement is snapshot-derived (no
// invented history — a rising/falling/stable movement REQUIRES has_prior with
// from/to states); bilingual-native; no retail/forecast. Negative-tested.

const fs = require('fs');
const path = require('path');
const { MOVE } = require('./build-ranking-history');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'ranking-history.json');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || a.source_layer !== 'ranking-history') f.push('bad source_layer');
  const groups = a && a.groups;
  if (!groups) { f.push('missing groups'); return f; }
  for (const g of ['asset', 'sector', 'equity']) {
    if (!Array.isArray(groups[g])) { f.push(`missing group ${g}`); continue; }
    for (const x of groups[g]) {
      if (!MOVE[x.movement]) f.push(`${g}/${x.symbol}: invalid movement "${x.movement}"`);
      else if (!ARABIC.test(String(x.movement_ar || ''))) f.push(`${g}/${x.symbol}: movement_ar not native`);
      if (!x.current_rank) f.push(`${g}/${x.symbol}: missing current_rank`);
      if (!Array.isArray(x.evidence) || !x.evidence.length) f.push(`${g}/${x.symbol}: missing evidence`);
      // Anti-fabrication: a directional movement must be snapshot-derived.
      if (['rising', 'falling', 'stable'].includes(x.movement) && (!a.has_prior || x.from_state == null || x.to_state == null)) {
        f.push(`${g}/${x.symbol}: ${x.movement} movement without a prior snapshot (fabricated history)`);
      }
    }
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text.replace(/"(from|to)_state":null/g, ''))) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-ranking-history').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('clean', validate(base).length === 0);
  const a1 = clone(); a1.groups.asset[0].movement = 'zzz'; T('bad movement', validate(a1).length > 0);
  const a2 = clone(); a2.groups.asset[0].evidence = []; T('no evidence', validate(a2).length > 0);
  const a3 = clone(); a3.has_prior = false; a3.groups.asset[0].movement = 'rising'; a3.groups.asset[0].from_state = null; T('fabricated movement', validate(a3).length > 0);
  const a4 = clone(); a4.groups.asset[0].evidence = ['strong buy']; T('forbidden', validate(a4).length > 0);
  console.log(`[ranking-history] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[ranking-history] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[ranking-history] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[ranking-history] FAIL: ${m}`)); process.exit(1); }
  console.log(`[ranking-history] check:ranking-history passed (snapshots=${a.snapshot_count}, has_prior=${a.has_prior}; movement snapshot-derived, no invented history).`);
}

module.exports = { validate };
