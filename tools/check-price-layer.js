'use strict';

// Phase 229 — price layer validators.
//
//   --check=coverage    manifest agrees with the shards and the registry
//   --check=freshness   no future dates, no silently ancient quotes
//   --check=integrity   shard structure, no duplicates, no fabricated fields
//   --check=currency    every priced quote names a plausible currency
//   --check=fallback    valuation uses the price layer without granting coverage
//   --self-test         negative tests for every rule above

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data/intelligence/symbol-registry.json');
const layer = require('./price-layer');

const FORBIDDEN = ['ter', 'isin', 'aum', 'holdings', 'benchmark', 'score', 'series'];
const MAX_AGE_DAYS = 14;

const readRegistry = () => {
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf8')); } catch { return { symbols: [] }; }
};

function validateCoverage(quotes = null, manifest = null) {
  const failures = [];
  const q = quotes || layer.loadAll();
  const m = manifest === null ? layer.manifest() : manifest;
  if (!m) return ['data/prices/manifest.json missing — run build-price-layer.js'];

  if (m.layer !== 'price') failures.push(`manifest.layer must be "price", got ${m.layer}`);
  if (m.universe !== 'recordable') failures.push(`manifest.universe must be "recordable", got ${m.universe}`);
  if (!m.provenance || m.provenance.basis !== 'fetched') failures.push('manifest provenance.basis must be "fetched"');
  if (!m.provenance || !m.provenance.provider) failures.push('manifest must name its provider');

  const priced = [...q.values()].filter((x) => x.status === 'ok').length;
  const declared = (m.counts && m.counts.priced) || 0;
  if (priced !== declared) failures.push(`manifest says priced=${declared} but shards hold ${priced}`);

  // Every priced symbol must still be in the recordable registry — a quote for
  // a symbol that has left the registry is an orphan the resolver can't reach.
  const registry = new Set((readRegistry().symbols || []).map((r) => r.symbol));
  if (registry.size) {
    const orphans = [...q.keys()].filter((s) => !registry.has(s));
    if (orphans.length) failures.push(`${orphans.length} quotes for symbols absent from the registry (e.g. ${orphans.slice(0, 3).join(',')})`);
  }
  return failures;
}

function validateFreshness(quotes = null, now = Date.now()) {
  const failures = [];
  const q = quotes || layer.loadAll();
  const today = new Date(now).toISOString().slice(0, 10);
  let stale = 0;
  for (const [sym, rec] of q) {
    if (rec.status !== 'ok') continue;
    // A price dated in the future is never a real observation.
    if (rec.as_of && rec.as_of > today) { failures.push(`${sym}: as_of ${rec.as_of} is in the future`); continue; }
    if (rec.fetched_at && new Date(rec.fetched_at).getTime() > now + 60000) {
      failures.push(`${sym}: fetched_at is in the future`);
      continue;
    }
    if (rec.fetched_at && (now - new Date(rec.fetched_at).getTime()) > MAX_AGE_DAYS * 86400000) stale += 1;
  }
  // Staleness is reported as a single aggregate: one old quote is normal, a
  // wholesale stall means the refresh job stopped running.
  if (q.size && stale / q.size > 0.5) {
    failures.push(`${stale}/${q.size} quotes older than ${MAX_AGE_DAYS} days — refresh has stalled`);
  }
  return failures;
}

function validateIntegrity(quotes = null) {
  const failures = [];
  const q = quotes || layer.loadAll();

  for (const [sym, rec] of q) {
    if (!rec.provider) { failures.push(`${sym}: no provider recorded`); break; }
    if (!rec.fetched_at) { failures.push(`${sym}: no fetched_at`); break; }
    for (const f of FORBIDDEN) {
      if (Object.prototype.hasOwnProperty.call(rec, f)) {
        failures.push(`${sym}: carries "${f}" — the price layer is quotes only and must not imply research`);
        break;
      }
    }
    if (rec.status === 'ok') {
      if (!Number.isFinite(rec.price) || rec.price <= 0) { failures.push(`${sym}: status ok but price is ${rec.price}`); break; }
      if (!rec.series_hash) { failures.push(`${sym}: priced without a series_hash`); break; }
    } else if (!rec.reason) { failures.push(`${sym}: unresolved without a reason`); break; }
    // An unresolved record must never carry a price.
    if (rec.status !== 'ok' && rec.price !== undefined) { failures.push(`${sym}: unresolved yet carries a price`); break; }
  }

  // Sharding must be deterministic: a symbol may live in exactly one shard.
  const seen = new Map();
  for (let i = 0; i < layer.SHARD_COUNT; i += 1) {
    const f = path.join(layer.SHARD_DIR, `${String(i).padStart(2, '0')}.json`);
    if (!fs.existsSync(f)) continue;
    let doc;
    try { doc = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { failures.push(`shard ${i} unparseable: ${e.message}`); continue; }
    for (const sym of Object.keys(doc.quotes || {})) {
      if (seen.has(sym)) failures.push(`duplicate symbol ${sym} in shards ${seen.get(sym)} and ${i}`);
      seen.set(sym, i);
      if (layer.shardOf(sym) !== i) failures.push(`${sym} stored in shard ${i} but hashes to ${layer.shardOf(sym)}`);
    }
  }
  return failures;
}

function validateCurrency(quotes = null) {
  const failures = [];
  const q = quotes || layer.loadAll();
  for (const [sym, rec] of q) {
    if (rec.status !== 'ok') continue;
    if (!rec.currency || !/^[A-Z]{3}$/.test(rec.currency)) {
      failures.push(`${sym}: currency "${rec.currency}" is not a 3-letter ISO code`);
      break;
    }
  }
  return failures;
}

// The behavioural contract: a priced-but-unresearched holding is valued, and
// stays at basic coverage. Checked against the real modules.
function validateFallback() {
  const failures = [];
  const analytics = fs.readFileSync(path.join(ROOT, 'tools/portfolio-analytics.js'), 'utf8');
  if (!/artifacts\.prices/.test(analytics)) failures.push('portfolio-analytics.js: valuePosition does not consult the price layer');

  const registryApi = fs.readFileSync(path.join(ROOT, 'tools/symbol-registry.js'), 'utf8');
  const assess = /function assessCoverage[\s\S]*?\n}/.exec(registryApi);
  if (!assess) failures.push('symbol-registry.js: assessCoverage not found');
  else if (/price|quote/i.test(assess[0])) {
    failures.push('symbol-registry.js: assessCoverage consults pricing — a quote must never grant research coverage');
  }

  // Live behaviour: a symbol we priced but never researched must value and stay basic.
  try {
    const { loadArtifacts } = require('./portfolio-artifacts');
    const { valuePosition } = require('./portfolio-analytics');
    const reg = require('./symbol-registry');
    const art = loadArtifacts();
    const all = layer.loadAll();
    const candidate = [...all.entries()].find(([sym, rec]) => {
      if (rec.status !== 'ok') return false;
      const hit = reg.resolve(sym, null, art);
      return hit && !hit.in_intelligence_universe;
    });
    if (candidate) {
      const [sym] = candidate;
      const v = valuePosition({ symbol: sym, slug: sym.toLowerCase(), instrument_type: 'equity', quantity: 2 }, art);
      if (!Number.isFinite(v.value)) failures.push(`${sym}: priced in the layer but valuePosition returned no value`);
      if (v.basis !== 'observed_price') failures.push(`${sym}: valued with basis "${v.basis}" instead of observed_price`);
      const cov = reg.resolve(sym, null, art).coverage;
      if (cov !== 'basic') failures.push(`${sym}: pricing promoted coverage to "${cov}"`);
    }
  } catch (e) { failures.push(`fallback probe failed: ${e.message}`); }
  return failures;
}

const CHECKS = {
  coverage: () => ({ name: 'check:price-coverage', failures: validateCoverage() }),
  freshness: () => ({ name: 'check:price-freshness', failures: validateFreshness() }),
  integrity: () => ({ name: 'check:price-integrity', failures: validateIntegrity() }),
  currency: () => ({ name: 'check:price-currency', failures: validateCurrency() }),
  fallback: () => ({ name: 'check:price-fallback', failures: validateFallback() }),
};

function selfTest() {
  const real = layer.loadAll();
  const m = layer.manifest();
  const one = [...real.entries()].find(([, r]) => r.status === 'ok');
  const mk = (over = {}) => new Map([[one[0], { ...one[1], ...over }]]);

  const cases = [
    ['coverage clean', () => validateCoverage(), false],
    ['coverage manifest missing', () => validateCoverage(real, false), true],
    ['coverage count mismatch', () => validateCoverage(real, { ...m, counts: { ...m.counts, priced: 1 } }), true],
    ['coverage wrong layer', () => validateCoverage(real, { ...m, layer: 'research' }), true],

    ['freshness clean', () => validateFreshness(), false],
    ['freshness future as_of', () => validateFreshness(mk({ as_of: '2099-01-01' })), true],
    ['freshness future fetched_at', () => validateFreshness(mk({ fetched_at: '2099-01-01T00:00:00Z' })), true],
    ['freshness wholesale stall', () => validateFreshness(mk({ fetched_at: '2020-01-01T00:00:00Z' })), true],

    ['integrity clean', () => validateIntegrity(), false],
    ['integrity fabricated TER', () => validateIntegrity(mk({ ter: 0.03 })), true],
    ['integrity research leak', () => validateIntegrity(mk({ score: 88 })), true],
    ['integrity priced without hash', () => validateIntegrity(mk({ series_hash: undefined })), true],
    ['integrity unresolved with a price', () => validateIntegrity(mk({ status: 'unresolved', reason: 'x', price: 10 })), true],
    ['integrity no provider', () => validateIntegrity(mk({ provider: undefined })), true],

    ['currency clean', () => validateCurrency(), false],
    ['currency malformed', () => validateCurrency(mk({ currency: 'dollars' })), true],
    ['currency missing', () => validateCurrency(mk({ currency: undefined })), true],

    ['fallback clean', () => validateFallback(), false],
  ];

  let ok = 0;
  for (const [label, run, shouldFail] of cases) {
    let failed;
    try { failed = run().length > 0; } catch { failed = true; }
    if (failed === shouldFail) ok += 1;
    else console.error(`[price-layer] self-test MISMATCH: ${label} (expected ${shouldFail ? 'fail' : 'pass'})`);
  }
  console.log(`[price-layer] self-test: ${ok}/${cases.length} passed`);
  return ok === cases.length;
}

function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  const a = (process.argv.find((x) => x.startsWith('--check=')) || '').split('=')[1];
  if (a && !CHECKS[a]) { console.error(`usage: --check=<${Object.keys(CHECKS).join('|')}> | --self-test`); process.exit(2); }
  let bad = 0;
  for (const fn of Object.values(a ? { [a]: CHECKS[a] } : CHECKS)) {
    const { name, failures } = fn();
    if (failures.length) { bad += 1; for (const f of failures.slice(0, 6)) console.error(`[${name}] FAIL: ${f}`); }
    else console.log(`[${name}] OK`);
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();

module.exports = { validateCoverage, validateFreshness, validateIntegrity, validateCurrency, validateFallback };
