'use strict';

// Phase 214 CP1 — check:etf-registry.

const REQUIRED = ['VOO', 'VTI', 'QQQ', 'SCHD', 'SOXX', 'SMH', 'XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLU', 'XLP', 'XLY', 'XLB', 'XLRE', 'IEF', 'TLT', 'HYG', 'LQD'];
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function validate(registry) {
  const failures = [];
  const etfs = Array.isArray(registry && registry.ETFS) ? registry.ETFS : [];
  if (etfs.length < 20) failures.push(`expected at least 20 ETFs, got ${etfs.length}`);
  const symbols = new Set();
  for (const required of REQUIRED) {
    if (!etfs.some((etf) => etf.symbol === required)) failures.push(`missing required ETF ${required}`);
  }
  for (const etf of etfs) {
    const id = etf && etf.symbol || '?';
    if (!/^[A-Z]{2,5}$/.test(String(id))) failures.push(`${id}: invalid symbol`);
    if (symbols.has(id)) failures.push(`${id}: duplicate symbol`);
    symbols.add(id);
    for (const field of ['slug', 'issuer', 'fund_name', 'category', 'exposure_type', 'benchmark', 'role_en', 'role_ar']) {
      if (!etf[field] || typeof etf[field] !== 'string') failures.push(`${id}: missing ${field}`);
    }
    if (!ARABIC.test(String(etf.role_ar || ''))) failures.push(`${id}: role_ar not Arabic`);
    for (const field of ['regime_sensitivity', 'related', 'research_links']) {
      if (!Array.isArray(etf[field]) || !etf[field].length) failures.push(`${id}: missing ${field}`);
    }
    for (const related of etf.related || []) {
      if (!REQUIRED.includes(related) && !['SPY', 'IWM', 'UUP'].includes(related)) failures.push(`${id}: unsupported related ETF/proxy ${related}`);
    }
    for (const link of etf.research_links || []) {
      if (!String(link).startsWith('/insights/')) failures.push(`${id}: research link must be an insights URL`);
    }
  }
  const text = JSON.stringify(etfs);
  if (/\b(undefined|NaN|null)\b/.test(text)) failures.push('registry leaks undefined/NaN/null');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden registry language ${re}`);
  return failures;
}

function run() {
  const registry = require('./etf-registry');
  const failures = validate(registry);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-registry] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-registry] check:etf-registry passed (${registry.ETFS.length} ETFs, complete metadata, no advice language).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = require('./etf-registry');
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing required', (m) => { m.ETFS = m.ETFS.filter((e) => e.symbol !== 'VOO'); }, true],
    ['duplicate', (m) => { m.ETFS.push({ ...m.ETFS[0] }); }, true],
    ['missing Arabic', (m) => { m.ETFS[0].role_ar = 'broad beta'; }, true],
    ['placeholder', (m) => { m.ETFS[0].role_en = 'placeholder'; }, true],
    ['forbidden', (m) => { m.ETFS[0].role_en = 'buy signal'; }, true],
    ['bad relation', (m) => { m.ETFS[0].related = ['XYZ']; }, true],
    ['bad link', (m) => { m.ETFS[0].research_links = ['/data/raw.json']; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify({ ETFS: base.ETFS }));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-registry] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
