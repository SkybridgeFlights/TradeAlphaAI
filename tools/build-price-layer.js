'use strict';

// Phase 229 — price layer for the Recordable Universe.
//
// WHAT THIS IS NOT: a second research pipeline. The intelligence universe keeps
// its full 10-year monthly series, because risk, correlation and drawdown need
// history. This layer answers a narrower question — "what is one share worth
// right now, in what currency?" — for every recordable symbol.
//
// That distinction is what keeps the artifacts small. A quote is ~120 bytes; a
// decade of daily bars is ~40 KB. Storing quotes for 11,589 symbols costs about
// 1.5 MB. Storing series for them would cost hundreds of megabytes and would
// also blur the two universes, since a symbol with a full series looks
// researched. Pricing must never promote coverage, and the cheapest way to
// guarantee that is to not have the data that would.
//
// SHARDING: symbols are distributed across 64 shards by a stable hash, so no
// single file is large, a partial refresh rewrites only the shards it touched,
// and git diffs stay reviewable. A manifest indexes them.
//
// SCALE CONTROLS (requirement: do not fetch 11,589 symbols every build):
//   --stale-days=N   refresh only quotes older than N days (default 1)
//   --max=N          hard cap on fetches this run
//   --shard=k/n      refresh only rotation slice k of n, for daily rotation
//   --symbols=A,B    explicit list, for on-demand refresh of held positions
//   --all            ignore staleness (full rebuild)
//
// ANTI-FABRICATION: a symbol that does not resolve is written with status and a
// reason. It is never given a price, never dropped from the registry, and never
// described as unsupported — it is recordable and temporarily unpriced.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY = path.join(ROOT, 'data/intelligence/symbol-registry.json');
const OUT_DIR = path.join(ROOT, 'data/prices');
const SHARD_DIR = path.join(OUT_DIR, 'shards');
const MANIFEST = path.join(OUT_DIR, 'manifest.json');

const SHARD_COUNT = 64;
const PROVIDER = 'yahoo-chart-v8';
const CONCURRENCY = Number(arg('concurrency') || 6);

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
}
const has = (name) => process.argv.includes(`--${name}`);

const shardOf = (symbol) => {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  return Math.abs(h) % SHARD_COUNT;
};
const rotationIndex = (n) => Math.floor(Date.now() / 86400000) % n;
const shardPath = (i) => path.join(SHARD_DIR, `${String(i).padStart(2, '0')}.json`);

function readShard(i) {
  try { return JSON.parse(fs.readFileSync(shardPath(i), 'utf8')); } catch { return { shard: i, quotes: {} }; }
}

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

async function fetchQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1mo&interval=1d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TradeAlphaAI/1.0 (+https://www.tradealphaai.com)' } });
    if (!res.ok) return { status: 'unresolved', reason: `http_${res.status}` };
    const j = await res.json();
    const r = j && j.chart && j.chart.result && j.chart.result[0];
    if (!r || !r.meta) return { status: 'unresolved', reason: 'no_meta' };

    const closes = ((r.indicators && r.indicators.quote && r.indicators.quote[0] && r.indicators.quote[0].close) || [])
      .filter((c) => Number.isFinite(c));
    const stamps = r.timestamp || [];
    const price = Number.isFinite(r.meta.regularMarketPrice)
      ? r.meta.regularMarketPrice
      : (closes.length ? closes[closes.length - 1] : null);
    if (!Number.isFinite(price) || price <= 0) return { status: 'unresolved', reason: 'no_price' };
    if (!r.meta.currency) return { status: 'unresolved', reason: 'no_currency' };

    const asOfSec = r.meta.regularMarketTime || (stamps.length ? stamps[stamps.length - 1] : null);
    return {
      status: 'ok',
      price: Math.round(price * 1e6) / 1e6,
      currency: r.meta.currency,
      exchange: r.meta.fullExchangeName || r.meta.exchangeName || null,
      as_of: asOfSec ? new Date(asOfSec * 1000).toISOString().slice(0, 10) : null,
      // Hash of the observed window: lets a later run detect that nothing moved
      // without storing the window itself.
      series_hash: crypto.createHash('sha256').update(closes.join(',')).digest('hex').slice(0, 16),
      observations: closes.length,
    };
  } catch (e) {
    return { status: 'unresolved', reason: `error_${String(e.message || 'unknown').slice(0, 40).replace(/\W+/g, '_')}` };
  }
}

// ---------------------------------------------------------------------------
// Selection — which symbols actually need fetching this run
// ---------------------------------------------------------------------------

// Returns { targets, skippedFresh, mode }. skippedFresh counts ONLY symbols
// excluded because their quote was still current — the genuine cache saving.
// Symbols outside an explicit list or rotation slice were never candidates and
// are not counted as savings, because reporting them as such would overstate
// what the cache is doing.
function selectSymbols(all, existing) {
  const explicit = arg('symbols');
  if (explicit) {
    // Explicit lists are a FORCED refresh: the caller is asking for current
    // prices for specific holdings, so staleness is deliberately not applied.
    const want = new Set(explicit.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean));
    return { targets: all.filter((s) => want.has(s)), skippedFresh: 0, mode: 'explicit (forced refresh)' };
  }

  let pool = all;

  // --rotate=N derives today's slice from the UTC day number, so a daily job
  // needs no state and no cursor: day D always maps to the same slice, a missed
  // run resumes on schedule, and two runs on one day are idempotent.
  // --shard=k/n stays available for manual targeting.
  let rotation = arg('shard');
  if (!rotation && arg('rotate')) {
    const n = Number(arg('rotate'));
    if (!Number.isInteger(n) || n < 1) throw new Error('--rotate must be a positive integer');
    rotation = `${rotationIndex(n)}/${n}`;
  }
  if (rotation) {
    const [k, n] = rotation.split('/').map(Number);
    if (!Number.isInteger(k) || !Number.isInteger(n) || n < 1 || k < 0 || k >= n) {
      throw new Error('--shard must be k/n with 0 <= k < n');
    }
    pool = pool.filter((s) => shardOf(s) % n === k);
  }

  const candidates = pool.length;
  let skippedFresh = 0;
  if (!has('all')) {
    const staleDays = Number(arg('stale-days') || 1);
    const cutoff = Date.now() - staleDays * 86400000;
    pool = pool.filter((s) => {
      const q = existing.get(s);
      if (!q || !q.fetched_at) return true;
      return new Date(q.fetched_at).getTime() < cutoff;
    });
    skippedFresh = candidates - pool.length;
  }

  // Never-attempted symbols first: those are the ones a holder cannot value at
  // all, whereas a stale quote still yields a figure. Coverage therefore grows
  // as fast as the daily budget allows.
  pool.sort((a, b) => ((existing.has(a) ? 1 : 0) - (existing.has(b) ? 1 : 0)) || a.localeCompare(b));

  const max = Number(arg('max') || 0);
  const targets = max > 0 ? pool.slice(0, max) : pool;
  return { targets, skippedFresh, mode: rotation ? `rotation ${rotation}` : 'staleness', rotation };
}

// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));
  const all = (reg.symbols || []).map((r) => r.symbol);

  // Load every shard once so staleness can be judged and untouched quotes kept.
  const shards = new Map();
  const existing = new Map();
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    const s = readShard(i);
    shards.set(i, s);
    for (const [sym, q] of Object.entries(s.quotes || {})) existing.set(sym, q);
  }

  const { targets, skippedFresh, mode, rotation } = selectSymbols(all, existing);
  console.log(`[price-layer] registry=${all.length} mode=${mode} to_fetch=${targets.length} skipped_still_fresh=${skippedFresh} concurrency=${CONCURRENCY}`);
  if (has('dry-run')) { console.log('[price-layer] dry-run — no fetches, no writes'); return; }

  let ok = 0; let unresolved = 0; let done = 0;
  const touched = new Set();
  const queue = targets.slice();

  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const symbol = queue.shift();
      const q = await fetchQuote(symbol);
      const shard = shardOf(symbol);
      touched.add(shard);
      shards.get(shard).quotes[symbol] = { ...q, provider: PROVIDER, fetched_at: new Date().toISOString() };
      if (q.status === 'ok') ok += 1; else unresolved += 1;
      done += 1;
      if (done % 500 === 0) console.log(`[price-layer]   ${done}/${targets.length} (${ok} ok, ${unresolved} unresolved)`);
    }
  }));

  // Write only the shards this run actually changed.
  fs.mkdirSync(SHARD_DIR, { recursive: true });
  let bytes = 0;
  for (const i of touched) {
    const s = shards.get(i);
    s.shard = i;
    s.updated_at = new Date().toISOString();
    fs.writeFileSync(shardPath(i), `${JSON.stringify(s)}\n`, 'utf8');
  }
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    if (fs.existsSync(shardPath(i))) bytes += fs.statSync(shardPath(i)).size;
  }

  // Recount across every shard, not just the touched ones.
  let totalOk = 0; let totalUnresolved = 0; const currencies = {};
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    for (const q of Object.values(shards.get(i).quotes || {})) {
      if (q.status === 'ok') { totalOk += 1; currencies[q.currency] = (currencies[q.currency] || 0) + 1; }
      else totalUnresolved += 1;
    }
  }

  const manifest = {
    generated_at: new Date().toISOString(),
    universe: 'recordable',
    layer: 'price',
    note_en: 'Latest observed quote per recordable symbol. Pricing only — it confers no research coverage.',
    provenance: {
      basis: 'fetched',
      provider: PROVIDER,
      endpoint: 'https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=1mo&interval=1d',
      fields_from_source: ['price', 'currency', 'exchange', 'as_of'],
      fields_never_inferred: ['ter', 'isin', 'aum', 'holdings', 'benchmark'],
    },
    shard_count: SHARD_COUNT,
    shard_files: 'data/prices/shards/NN.json',
    counts: {
      registry: all.length,
      priced: totalOk,
      unresolved: totalUnresolved,
      never_attempted: all.length - totalOk - totalUnresolved,
      by_currency: currencies,
    },
    last_run: {
      fetched: targets.length,
      skipped_still_fresh: skippedFresh,
      shards_written: touched.size,
      duration_ms: Date.now() - t0,
    },
  };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  // Operational coverage report — published every run so progress toward full
  // price coverage is visible without reading 64 shards.
  const report = {
    generated_at: new Date().toISOString(),
    shard_processed: rotation || null,
    recordable: all.length,
    priced: totalOk,
    unresolved: totalUnresolved,
    not_yet_attempted: all.length - totalOk - totalUnresolved,
    cache_hits_still_fresh: skippedFresh,
    fetched_this_run: targets.length,
    shards_written: touched.size,
    runtime_ms: Date.now() - t0,
    artifact_bytes: bytes,
    priced_pct: Math.round((totalOk / all.length) * 1000) / 10,
    provider: PROVIDER,
    paid_provider_required: false,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'coverage-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log('[price-layer] REPORT ' + JSON.stringify(report));


  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[price-layer] fetched=${targets.length} ok=${ok} unresolved=${unresolved} in ${secs}s`);
  console.log(`[price-layer] priced=${totalOk}/${all.length} shards_written=${touched.size} total_artifact=${Math.round(bytes / 1024)} KB`);
  console.log(`[price-layer] currencies: ${Object.entries(currencies).map(([c, n]) => `${c}=${n}`).join(' ')}`);
}

if (require.main === module) {
  main().catch((e) => { console.error('[price-layer] FAIL:', e.message); process.exit(1); });
}

module.exports = { shardOf, SHARD_COUNT, fetchQuote, selectSymbols, rotationIndex };
