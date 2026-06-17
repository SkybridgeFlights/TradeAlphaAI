'use strict';

// Phase 207 / Workstream K — check:asset-history / sector-history / equity-history
// (one impl, --type selector). Validates the per-entity historical trend artifacts:
// every registry entity present, overall + dimension trends in the allowed label
// set, evidence-backed when available, honest indeterminate, bilingual-native, no
// retail/prediction language. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { TREND, BAND } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const ARABIC = /[؀-ۿ]/;
const DIMS = ['structure', 'tactical', 'liquidity', 'participation', 'score'];
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b)/];
const TYPES = {
  asset: { file: 'data/intelligence/asset-history.json', registry: './asset-registry', key: 'ASSETS' },
  sector: { file: 'data/intelligence/sector-history.json', registry: './sector-registry', key: 'SECTORS' },
  equity: { file: 'data/intelligence/equity-history.json', registry: './equity-registry', key: 'EQUITIES' },
};

function validate(a, type) {
  const f = [];
  const reg = new Set(require(TYPES[type].registry)[TYPES[type].key].map((e) => e.symbol));
  if (!a || a.source_layer !== `${type}-history`) f.push('bad source_layer');
  if (a && a.schema_version !== '1.0') f.push('unexpected schema_version');
  const items = Array.isArray(a && a.items) ? a.items : [];
  if (items.length !== reg.size) f.push(`expected ${reg.size} items, got ${items.length}`);
  for (const x of items) {
    if (!reg.has(x.symbol)) f.push(`${x.symbol}: not in registry`);
    if (!x.overall || !TREND[x.overall.state]) f.push(`${x.symbol}: invalid overall trend`);
    else if (!ARABIC.test(String(x.overall.label_ar || ''))) f.push(`${x.symbol}: overall label_ar not native`);
    if (!BAND[x.confidence_band]) f.push(`${x.symbol}: invalid confidence_band`);
    if (x.available) {
      if (!Array.isArray(x.evidence) || !x.evidence.length) f.push(`${x.symbol}: available without evidence`);
      const dt = x.dimension_trends || {};
      for (const d of DIMS) { if (!dt[d]) f.push(`${x.symbol}: missing dimension trend ${d}`); else if (!TREND[dt[d].state]) f.push(`${x.symbol}.${d}: unknown trend "${dt[d].state}"`); }
    }
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/prediction language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const built = require('./build-history-engines').build();
  let ok = 0; let total = 0;
  for (const type of Object.keys(TYPES)) {
    const base = built[type]; const clone = () => JSON.parse(JSON.stringify(base));
    const cases = [
      ['bad source', (m) => { m.source_layer = 'x'; }],
      ['bad overall trend', (m) => { m.items[0].overall.state = 'zzz'; }],
      ['missing dim trend', (m) => { const a = m.items.find((x) => x.available); if (a) delete a.dimension_trends.structure; }],
      ['available no evidence', (m) => { const a = m.items.find((x) => x.available); if (a) a.evidence = []; }],
      ['forbidden language', (m) => { m.items[0].evidence = ['strong buy']; }],
    ];
    for (const [, mut] of cases) { total += 1; const c = clone(); mut(c); if (validate(c, type).length) ok += 1; else console.error(`SELF-TEST FAIL [${type}]`); }
    total += 1; if (validate(clone(), type).length === 0) ok += 1; else console.error(`SELF-TEST FAIL [${type}] clean:`, validate(clone(), type));
  }
  console.log(`[history-engines] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const arg = process.argv.find((x) => x.startsWith('--type='));
  const type = arg ? arg.slice(7) : null;
  if (!type || !TYPES[type]) { console.error('[history-engines] usage: --type=asset|sector|equity'); process.exit(2); }
  const abs = path.join(ROOT, TYPES[type].file);
  if (!fs.existsSync(abs)) { console.log(`[${type}-history] no artifact yet (non-fatal).`); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(abs, 'utf8')); } catch (e) { console.error(`[${type}-history] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a, type);
  if (failures.length) { failures.forEach((m) => console.error(`[${type}-history] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${type}-history] check:${type}-history passed (${a.available_count}/${a.total} with historical trends; evidence-backed, bilingual, no prediction language).`);
}

module.exports = { validate };
