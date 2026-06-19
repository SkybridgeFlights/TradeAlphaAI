'use strict';

// Phase 209 / Workstream G — check:rankings.
// Validates the ranking artifacts (rankings.json + asset/sector/equity-rankings.json):
// allowed rank/direction/confirmation labels, evidence-backed available items,
// strongest/weakest from the registry, bilingual-native, no retail/forecast.
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { RANK, DIR, CONF } = require('./build-rankings');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const ARABIC = /[؀-ۿ]/;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];
const REG = {
  asset: new Set(require('./asset-registry').ASSETS.map((e) => e.symbol)),
  sector: new Set(require('./sector-registry').SECTORS.map((e) => e.symbol)),
  equity: new Set(require('./equity-registry').EQUITIES.map((e) => e.symbol)),
};

function validateGroup(a, type) {
  const f = [];
  if (!a || a.source_layer !== `${type}-rankings`) f.push(`[${type}] bad source_layer`);
  const items = Array.isArray(a && a.items) ? a.items : [];
  if (items.length !== REG[type].size) f.push(`[${type}] expected ${REG[type].size} items, got ${items.length}`);
  for (const x of items) {
    if (!REG[type].has(x.symbol)) f.push(`[${type}] ${x.symbol}: not in registry`);
    if (!RANK[x.rank_label]) f.push(`[${type}] ${x.symbol}: invalid rank_label "${x.rank_label}"`);
    else if (!ARABIC.test(String(x.rank_label_ar || ''))) f.push(`[${type}] ${x.symbol}: rank_label_ar not native`);
    if (!DIR[x.direction]) f.push(`[${type}] ${x.symbol}: invalid direction`);
    if (!CONF[x.confirmation]) f.push(`[${type}] ${x.symbol}: invalid confirmation`);
    if (x.available && (!Array.isArray(x.evidence) || !x.evidence.length)) f.push(`[${type}] ${x.symbol}: available without evidence`);
  }
  for (const k of ['strongest', 'weakest']) { if (!Array.isArray(a[k])) f.push(`[${type}] missing ${k}`); else for (const s of a[k]) if (!REG[type].has(s)) f.push(`[${type}] ${k} "${s}" not in registry`); }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push(`[${type}] leaks undefined/NaN`);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`[${type}] forbidden retail/forecast language ${re}`);
  return f;
}

function runAll() {
  const f = [];
  for (const t of ['asset', 'sector', 'equity']) { const p = J(`${t}-rankings.json`); if (fs.existsSync(p)) { try { f.push(...validateGroup(JSON.parse(fs.readFileSync(p, 'utf8')), t)); } catch (e) { f.push(`[${t}] malformed JSON`); } } }
  const cp = J('rankings.json');
  if (fs.existsSync(cp)) { try { const c = JSON.parse(fs.readFileSync(cp, 'utf8')); if (c.source_layer !== 'rankings') f.push('[combined] bad source_layer'); for (const t of ['asset', 'sector', 'equity']) if (!c.groups || !c.groups[t]) f.push(`[combined] missing group ${t}`); } catch (e) { f.push('[combined] malformed JSON'); } }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const built = require('./build-rankings').build();
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('asset clean', validateGroup(built.asset, 'asset').length === 0);
  T('sector clean', validateGroup(built.sector, 'sector').length === 0);
  T('equity clean', validateGroup(built.equity, 'equity').length === 0);
  const a1 = JSON.parse(JSON.stringify(built.asset)); a1.items[0].rank_label = 'mega'; T('bad rank label', validateGroup(a1, 'asset').length > 0);
  const a2 = JSON.parse(JSON.stringify(built.asset)); a2.strongest = ['DOGE']; T('bad strongest', validateGroup(a2, 'asset').length > 0);
  const a3 = JSON.parse(JSON.stringify(built.asset)); const av = a3.items.find((x) => x.available); if (av) av.evidence = []; T('available no evidence', validateGroup(a3, 'asset').length > 0);
  const a4 = JSON.parse(JSON.stringify(built.asset)); a4.items[0].evidence = ['strong buy']; T('forbidden', validateGroup(a4, 'asset').length > 0);
  console.log(`[rankings] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = runAll();
  if (failures.length) { failures.forEach((m) => console.error(`[rankings] FAIL: ${m}`)); process.exit(1); }
  console.log('[rankings] check:rankings passed (asset/sector/equity ranked; allowed labels, evidence-backed, bilingual, no retail).');
}

module.exports = { validateGroup };
