'use strict';

// Phase 229 — guards the two-universe symbol architecture.
//
//   node tools/check-symbol-registry.js            structural check
//   node tools/check-symbol-registry.js --self-test negative tests
//
// The rules here protect three things that are easy to erode:
//
//  1. The recordable registry stays GENERATED. The moment someone hand-edits it
//     or adds a parallel list, "single source of truth" stops being true.
//  2. Nothing fabricates fundamentals. The registry may carry identity only;
//     a TER or ISIN appearing in it would mean a source column was invented.
//  3. Basic coverage is never described as a failure. A holder recording a
//     legitimate listing we have not researched must not be told it is
//     unsupported, unknown or unavailable.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data/intelligence/symbol-registry.json');
const GENERATOR = 'tools/build-symbol-registry.js';
const API = 'tools/symbol-registry.js';

const FORBIDDEN_FIELDS = ['ter', 'isin', 'aum', 'holdings', 'benchmark', 'domicile', 'distribution_policy', 'expense_ratio'];

// Words that would frame an unresearched-but-valid holding as a defect.
const DISMISSIVE = /\b(unsupported|not supported|unknown symbol|unavailable symbol|invalid symbol)\b/i;

const read = (rel) => {
  const f = path.join(ROOT, rel);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
};

function validateRegistry(doc = null) {
  const failures = [];
  let parsed = doc;
  if (parsed === null) {
    if (!fs.existsSync(REGISTRY)) return ['data/intelligence/symbol-registry.json missing — run build-symbol-registry.js --write'];
    try { parsed = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); } catch (e) { return [`registry unparseable: ${e.message}`]; }
  }

  if (parsed.universe !== 'recordable') failures.push(`universe must be "recordable", got ${parsed.universe}`);
  if (!parsed.generated_at) failures.push('no generated_at');

  // Provenance: the registry must name where it came from and what it refuses.
  const p = parsed.provenance || {};
  if (p.basis !== 'fetched') failures.push('provenance.basis must be "fetched"');
  if (!Array.isArray(p.sources) || !p.sources.length) failures.push('provenance.sources empty');
  for (const s of p.sources || []) {
    if (!s.url || !/^https:\/\//.test(s.url)) failures.push(`source ${s.id} has no https url`);
    if (!s.retrieved_at) failures.push(`source ${s.id} has no retrieved_at`);
  }
  if (!Array.isArray(p.fields_never_inferred) || !p.fields_never_inferred.length) {
    failures.push('provenance must state which fields are never inferred');
  }

  const rows = parsed.symbols || [];
  if (rows.length < 3000) failures.push(`only ${rows.length} symbols — expansion regressed`);

  // Identity only. A fundamentals field here means something was fabricated.
  const sample = rows.slice(0, 500);
  for (const row of sample) {
    for (const f of FORBIDDEN_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(row, f)) {
        failures.push(`registry row ${row.symbol} carries "${f}" — the recordable universe is identity only`);
        break;
      }
    }
  }
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.symbol)) { failures.push(`duplicate symbol ${row.symbol}`); break; }
    seen.add(row.symbol);
  }
  for (const anchor of ['AAPL', 'SPY', 'VOO']) {
    if (!seen.has(anchor)) failures.push(`sanity anchor missing: ${anchor}`);
  }
  return failures;
}

function validateArchitecture(sources = null) {
  const failures = [];
  const s = sources || { generator: read(GENERATOR), api: read(API), artifacts: read('tools/portfolio-artifacts.js') };

  if (!s.generator) failures.push(`${GENERATOR} missing — the registry would become hand-maintained`);
  if (!s.api) failures.push(`${API} missing — no single resolution point`);

  if (s.api) {
    // The three coverage levels are the contract the UI renders against.
    for (const level of ['basic', 'research', 'full_intelligence']) {
      if (!s.api.includes(`'${level}'`)) failures.push(`${API}: coverage level ${level} not defined`);
    }
    // Bilingual labels are required — this surface ships EN and AR.
    if (!/ar:/.test(s.api)) failures.push(`${API}: coverage labels are not bilingual`);
    // Coverage must be judged from artifacts, not declared in a list.
    if (!/function assessCoverage/.test(s.api)) failures.push(`${API}: no evidence-driven assessCoverage`);
  }

  // Resolution must go through the one registry, not a private symbol map.
  if (s.artifacts && !/require\('\.\/symbol-registry'\)/.test(s.artifacts)) {
    failures.push('tools/portfolio-artifacts.js: resolveSymbol must delegate to symbol-registry.js');
  }
  return failures;
}

function validateLanguage(sources = null) {
  const failures = [];
  const files = sources || {
    'db/portfolios.js': read('db/portfolios.js'),
    'js/account-portfolios.js': read('js/account-portfolios.js'),
  };
  for (const [rel, src] of Object.entries(files)) {
    if (!src) continue;
    // Only inspect user-facing strings, not comments explaining the rule.
    const codeOnly = src.replace(/^\s*(\/\/|\*|\/\*).*$/gm, ' ');
    const m = DISMISSIVE.exec(codeOnly);
    if (m) failures.push(`${rel}: user-facing text calls a symbol "${m[0]}" — basic coverage is not a failure state`);
  }
  return failures;
}

const CHECKS = {
  registry: () => ({ name: 'check:symbol-registry', failures: validateRegistry() }),
  architecture: () => ({ name: 'check:symbol-architecture', failures: validateArchitecture() }),
  language: () => ({ name: 'check:symbol-language', failures: validateLanguage() }),
};

function selfTest() {
  const good = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const clone = () => JSON.parse(JSON.stringify(good));
  const cases = [
    ['registry clean', () => validateRegistry(), false],
    ['registry with a fabricated TER', () => {
      const m = clone(); m.symbols[0].ter = 0.03; return validateRegistry(m);
    }, true],
    ['registry with an invented ISIN', () => {
      const m = clone(); m.symbols[0].isin = 'IE00B4L5Y983'; return validateRegistry(m);
    }, true],
    ['registry without provenance sources', () => {
      const m = clone(); m.provenance.sources = []; return validateRegistry(m);
    }, true],
    ['registry not declaring uninferred fields', () => {
      const m = clone(); delete m.provenance.fields_never_inferred; return validateRegistry(m);
    }, true],
    ['registry truncated', () => {
      const m = clone(); m.symbols = m.symbols.slice(0, 10); return validateRegistry(m);
    }, true],
    ['registry declared as intelligence universe', () => {
      const m = clone(); m.universe = 'intelligence'; return validateRegistry(m);
    }, true],

    ['architecture clean', () => validateArchitecture(), false],
    ['architecture without generator', () => validateArchitecture({ generator: null, api: read(API), artifacts: read('tools/portfolio-artifacts.js') }), true],
    ['architecture with a coverage level removed', () => validateArchitecture({
      generator: read(GENERATOR), api: read(API).replace(/'research'/g, "'x'"), artifacts: read('tools/portfolio-artifacts.js'),
    }), true],
    ['architecture bypassing the registry', () => validateArchitecture({
      generator: read(GENERATOR), api: read(API), artifacts: 'function resolveSymbol(){ return null; }',
    }), true],

    ['language clean', () => validateLanguage(), false],
    ['language calling a symbol unsupported', () => validateLanguage({ 'x.js': 'return { error: "symbol is not supported" };' }), true],
    ['language calling a symbol unknown', () => validateLanguage({ 'x.js': 'msg("unknown symbol");' }), true],
  ];

  let ok = 0;
  for (const [label, run, shouldFail] of cases) {
    let failed;
    try { failed = run().length > 0; } catch { failed = true; }
    if (failed === shouldFail) ok += 1;
    else console.error(`[symbol-registry] self-test MISMATCH: ${label} (expected ${shouldFail ? 'fail' : 'pass'})`);
  }
  console.log(`[symbol-registry] self-test: ${ok}/${cases.length} passed`);
  return ok === cases.length;
}

function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const arg = (process.argv.find((a) => a.startsWith('--check=')) || '').split('=')[1];
  const run = arg ? { [arg]: CHECKS[arg] } : CHECKS;
  if (arg && !CHECKS[arg]) {
    console.error(`usage: --check=<${Object.keys(CHECKS).join('|')}> | --self-test`);
    process.exit(2);
  }
  let bad = 0;
  for (const fn of Object.values(run)) {
    const { name, failures } = fn();
    if (failures.length) {
      bad += 1;
      for (const f of failures.slice(0, 8)) console.error(`[${name}] FAIL: ${f}`);
    } else console.log(`[${name}] OK`);
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();

module.exports = { validateRegistry, validateArchitecture, validateLanguage };
