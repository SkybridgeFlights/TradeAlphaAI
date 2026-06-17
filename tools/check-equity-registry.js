'use strict';

// Phase 206 / Workstream J — check:equity-registry.
// Validates equity-registry.js integrity: 11 unique equities, native bilingual
// names, a sector slug that exists in the sector registry, a related broad asset,
// a valid cap tier, and well-formed equity↔counterpart relationships. No data,
// just registry sanity. Negative-tested via --self-test.

const { EQUITIES, EQUITY_RELATIONSHIPS } = require('./equity-registry');
const { SLUGS: SECTOR_SLUGS } = require('./sector-registry');

const ARABIC = /[؀-ۿ]/;
const TIERS = new Set(['mega', 'large', 'mid', 'small']);
const SECTORS = new Set(SECTOR_SLUGS);
const KINDS = new Set(['peer', 'leadership', 'sector', 'macro']);
const TYPES = new Set(['equity', 'asset']);

function validate(equities = EQUITIES, rels = EQUITY_RELATIONSHIPS) {
  const f = [];
  if (!Array.isArray(equities) || equities.length < 1) return ['no equities'];
  const syms = new Set(); const slugs = new Set();
  for (const e of equities) {
    if (syms.has(e.symbol)) f.push(`duplicate symbol ${e.symbol}`); syms.add(e.symbol);
    if (slugs.has(e.slug)) f.push(`duplicate slug ${e.slug}`); slugs.add(e.slug);
    if (!e.name_en || !e.name_ar || !ARABIC.test(e.name_ar)) f.push(`${e.symbol}: missing native bilingual name`);
    if (!SECTORS.has(e.sector)) f.push(`${e.symbol}: sector "${e.sector}" not a registry sector`);
    if (!e.related_asset) f.push(`${e.symbol}: missing related_asset`);
    if (!TIERS.has(e.cap_tier)) f.push(`${e.symbol}: invalid cap_tier "${e.cap_tier}"`);
    if (!Array.isArray(e.related_equities)) f.push(`${e.symbol}: related_equities not an array`);
    if (!e.macro_sensitivity_en || !e.macro_sensitivity_ar || !ARABIC.test(e.macro_sensitivity_ar)) f.push(`${e.symbol}: missing native macro_sensitivity`);
  }
  for (const r of rels) {
    if (!syms.has(r.equity)) f.push(`relationship ${r.id}: equity "${r.equity}" not in registry`);
    if (!TYPES.has(r.type)) f.push(`relationship ${r.id}: invalid type "${r.type}"`);
    if (r.type === 'equity' && !syms.has(r.counterpart)) f.push(`relationship ${r.id}: peer "${r.counterpart}" not in registry`);
    if (!KINDS.has(r.kind)) f.push(`relationship ${r.id}: invalid kind "${r.kind}"`);
    if (!r.en || !r.ar || !ARABIC.test(r.ar)) f.push(`relationship ${r.id}: missing native bilingual label`);
  }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('clean registry', validate().length === 0);
  T('bad sector rejected', validate(EQUITIES.map((e, i) => (i === 0 ? { ...e, sector: 'nope' } : e))).length > 0);
  T('bad tier rejected', validate(EQUITIES.map((e, i) => (i === 0 ? { ...e, cap_tier: 'huge' } : e))).length > 0);
  T('duplicate symbol rejected', validate(EQUITIES.concat([EQUITIES[0]])).length > 0);
  T('bad relationship equity rejected', validate(EQUITIES, EQUITY_RELATIONSHIPS.concat([{ id: 'x', equity: 'ZZZZ', counterpart: 'QQQ', type: 'asset', kind: 'macro', en: 'x', ar: 'س' }])).length > 0);
  console.log(`[equity-registry] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = validate();
  if (failures.length) { failures.forEach((m) => console.error(`[equity-registry] FAIL: ${m}`)); process.exit(1); }
  console.log(`[equity-registry] check:equity-registry passed (${EQUITIES.length} equities, ${EQUITY_RELATIONSHIPS.length} relationships; bilingual, sector-linked).`);
}

module.exports = { validate };
