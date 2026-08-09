'use strict';

// Read API over the sharded price layer.
//
// Loads lazily and caches per process: a serverless invocation that values a
// four-position portfolio reads four shards, not 64. Shards are small enough
// that this stays cheap even when several are touched.
//
// This module deliberately exposes ONLY a quote. It has no series, no score and
// no fund facts, so nothing downstream can mistake a priced symbol for a
// researched one — the separation is enforced by what the data physically is,
// not by a flag someone could set wrongly.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARD_DIR = path.join(ROOT, 'data/prices/shards');
const MANIFEST = path.join(ROOT, 'data/prices/manifest.json');
const SHARD_COUNT = 64;

const shardOf = (symbol) => {
  let h = 0;
  for (let i = 0; i < symbol.length; i += 1) h = ((h << 5) - h + symbol.charCodeAt(i)) | 0;
  return Math.abs(h) % SHARD_COUNT;
};

const _shards = new Map();
function loadShard(i) {
  if (_shards.has(i)) return _shards.get(i);
  let doc = { quotes: {} };
  try { doc = JSON.parse(fs.readFileSync(path.join(SHARD_DIR, `${String(i).padStart(2, '0')}.json`), 'utf8')); } catch { /* absent */ }
  _shards.set(i, doc);
  return doc;
}

/**
 * Latest observed quote for a symbol, or null.
 *
 * Returns null both when we have never fetched the symbol and when the fetch
 * did not resolve. Callers must treat both as "temporarily unpriced" — the
 * symbol remains recordable either way.
 */
function getQuote(symbol) {
  if (typeof symbol !== 'string' || !symbol) return null;
  const key = symbol.trim().toUpperCase();
  const q = loadShard(shardOf(key)).quotes[key];
  if (!q || q.status !== 'ok' || !Number.isFinite(q.price)) return null;
  return q;
}

/** Diagnostic form: returns the record even when unresolved, with its reason. */
function getRecord(symbol) {
  if (typeof symbol !== 'string' || !symbol) return null;
  const key = symbol.trim().toUpperCase();
  return loadShard(shardOf(key)).quotes[key] || null;
}

/** Load every shard — for validators and build tooling, not request paths. */
function loadAll() {
  const out = new Map();
  for (let i = 0; i < SHARD_COUNT; i += 1) {
    for (const [sym, q] of Object.entries(loadShard(i).quotes || {})) out.set(sym, q);
  }
  return out;
}

function manifest() {
  try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return null; }
}

module.exports = { getQuote, getRecord, loadAll, manifest, shardOf, SHARD_COUNT, SHARD_DIR, MANIFEST };
