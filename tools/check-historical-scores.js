'use strict';

// Phase 207 / Workstream F+K — check:historical-scores.
// Validates data/intelligence/historical-intelligence.json (the historical
// momentum/stability/persistence scoring). Named check:historical-scores to avoid
// colliding with the pre-existing Phase-69 check:historical-intelligence (which
// validates historical-memory / narrative-continuity / market-replay). HARD-FAILS
// on invalid labels, missing groups, evidence-less available entities, untranslated
// Arabic, or retail/forecast language. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { MOMENTUM, STABILITY, PERSISTENCE } = require('./build-historical-intelligence');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'historical-intelligence.json');
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'historical-intelligence') f.push('bad source_layer');
  const groups = a.groups || {};
  for (const g of ['asset', 'sector', 'equity']) {
    if (!Array.isArray(groups[g])) { f.push(`missing group ${g}`); continue; }
    for (const x of groups[g]) {
      if (!MOMENTUM[x.momentum && x.momentum.state]) f.push(`${g}/${x.symbol}: invalid momentum`);
      else if (!ARABIC.test(String(x.momentum.label_ar || ''))) f.push(`${g}/${x.symbol}: momentum label_ar not native`);
      if (!STABILITY[x.stability && x.stability.state]) f.push(`${g}/${x.symbol}: invalid stability`);
      if (!PERSISTENCE[x.persistence && x.persistence.state]) f.push(`${g}/${x.symbol}: invalid persistence`);
      if (x.available && (!Array.isArray(x.evidence) || !x.evidence.length)) f.push(`${g}/${x.symbol}: available without evidence`);
    }
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/forecast language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-historical-intelligence').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['bad source', (m) => { m.source_layer = 'x'; }],
    ['missing group', (m) => { delete m.groups.sector; }],
    ['invalid momentum', (m) => { m.groups.asset[0].momentum.state = 'zzz'; }],
    ['invalid persistence', (m) => { m.groups.asset[0].persistence.state = 'zzz'; }],
    ['available no evidence', (m) => { const x = m.groups.asset.find((e) => e.available); if (x) x.evidence = []; }],
    ['forbidden language', (m) => { m.groups.asset[0].evidence = ['strong buy']; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', validate(clone()));
  console.log(`[historical-scores] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[historical-scores] no artifact yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[historical-scores] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[historical-scores] FAIL: ${m}`)); process.exit(1); }
  console.log(`[historical-scores] check:historical-scores passed (${a.scored} entities; momentum/stability/persistence, evidence-backed, bilingual).`);
}

module.exports = { validate };
