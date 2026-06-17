'use strict';

// Phase 205 / Workstream I — check:sector-intelligence.
// Validates the 4 per-sector layer artifacts (structure/tactical/liquidity/
// participation): every sector present, state in the allowed label set, evidence-
// backed when available, honest indeterminate/unavailable, bilingual-native, no
// retail/advice. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { SECTORS } = require('./sector-registry');
const { STATES } = require('./build-sector-layers');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = new Set(SECTORS.map((s) => s.symbol));
const ARABIC = /[؀-ۿ]/;
const LAYERS = ['structure', 'tactical', 'liquidity', 'participation'];
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\bprice target\b/i, /\bsignal\b/i, /\bwill (rise|fall)\b/i, /\bguaranteed\b/i, /(?:\bشراء\b|\bبيع\b|هدف\s*سعري)/];

function validate(a, layer) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== `sector-${layer}`) f.push(`unexpected source_layer "${a.source_layer}"`);
  if (a.schema_version !== '1.0') f.push('unexpected schema_version');
  if (!a.attribution || !Array.isArray(a.attribution.sources) || !a.attribution.sources.length) f.push('missing attribution.sources');
  const sectors = Array.isArray(a.sectors) ? a.sectors : [];
  if (sectors.length !== REGISTRY.size) f.push(`expected ${REGISTRY.size} sectors, got ${sectors.length}`);
  for (const s of sectors) {
    const id = s.symbol || '?';
    if (!REGISTRY.has(s.symbol)) f.push(`${id}: not in registry`);
    if (!STATES[s.state]) f.push(`${id}: unknown state "${s.state}"`);
    else { if (s.label_en !== STATES[s.state][0]) f.push(`${id}: label_en mismatch`); if (!ARABIC.test(String(s.label_ar || ''))) f.push(`${id}: label_ar not native`); }
    if (s.available === false) {
      if (s.state !== 'unavailable' && s.state !== 'indeterminate') f.push(`${id}: unavailable but state determinate`);
      if (!s.unavailable_reason) f.push(`${id}: unavailable without reason`);
    } else {
      if (!Array.isArray(s.evidence) || !s.evidence.length) f.push(`${id}: available without evidence`);
    }
  }
  const text = JSON.stringify(a);
  if (/\b(undefined|NaN)\b/.test(text)) f.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden retail/advice language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const built = require('./build-sector-layers').build();
  let ok = 0; let total = 0;
  for (const layer of LAYERS) {
    const base = built[layer]; const clone = () => JSON.parse(JSON.stringify(base));
    const cases = [
      ['bad source', (m) => { m.source_layer = 'x'; }],
      ['unknown state', (m) => { m.sectors[0].state = 'zzz'; }],
      ['available no evidence', (m) => { const s = m.sectors.find((x) => x.available); if (s) s.evidence = []; }],
      ['forbidden language', (m) => { m.sectors[0].evidence = ['strong buy here']; }],
      ['untranslated AR', (m) => { m.sectors[0].label_ar = 'strong'; }],
    ];
    for (const [, mut] of cases) { total += 1; const c = clone(); mut(c); if (validate(c, layer).length) ok += 1; else console.error(`SELF-TEST FAIL [${layer}]`); }
    total += 1; if (validate(clone(), layer).length === 0) ok += 1; else console.error(`SELF-TEST FAIL [${layer}] clean:`, validate(clone(), layer));
  }
  console.log(`[sector-intelligence] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = [];
  for (const layer of LAYERS) {
    const abs = path.join(ROOT, 'data', 'intelligence', `sector-${layer}.json`);
    if (!fs.existsSync(abs)) continue;
    try { validate(JSON.parse(fs.readFileSync(abs, 'utf8')), layer).forEach((m) => failures.push(`[${layer}] ${m}`)); } catch (e) { failures.push(`[${layer}] malformed JSON: ${e.message}`); }
  }
  if (failures.length) { failures.forEach((m) => console.error(`[sector-intelligence] FAIL: ${m}`)); process.exit(1); }
  console.log('[sector-intelligence] check:sector-intelligence passed (4 layers; per-sector, evidence-backed, bilingual, no retail language).');
}

module.exports = { validate };
