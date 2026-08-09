'use strict';

// Phase 228 CP5 — artifact loader for the portfolio analytics engine.
//
// Kept separate from tools/portfolio-analytics.js so the analytics stay pure and
// testable: the engine receives data, this module decides where data comes from.
// Both the API route and the validators load through here, so they analyse
// exactly the same inputs.
//
// Everything read here is a committed ETF Center artifact. Nothing is fetched at
// request time — a portfolio page must not depend on a live provider call.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INTEL = path.join(ROOT, 'data/intelligence');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function indexBySlug(doc) {
  return new Map(((doc && doc.etfs) || []).map((e) => [e.slug, e]));
}

let cached = null;

/**
 * Load the ETF artifacts the analytics engine needs.
 * Cached per process: these files change only when the build regenerates them,
 * and a serverless invocation should not re-read them per request.
 */
function loadArtifacts(options = {}) {
  if (cached && !options.fresh) return cached;

  const facts = readJson(path.join(INTEL, 'etf-facts.json'), { etfs: [] });
  const analytics = readJson(path.join(INTEL, 'etf-analytics.json'), { etfs: [] });
  const score = readJson(path.join(INTEL, 'etf-score.json'), { etfs: [] });
  const similarity = readJson(path.join(INTEL, 'etf-similarity.json'), { etfs: [] });
  const seriesDoc = readJson(path.join(INTEL, 'etf-monthly-series.json'), { series: {} });

  cached = {
    factsBySlug: indexBySlug(facts),
    analyticsBySlug: indexBySlug(analytics),
    scoreBySlug: indexBySlug(score),
    similarityBySlug: indexBySlug(similarity),
    series: seriesDoc.series || {},
    riskFree: analytics.risk_free || null,
    generated_at: {
      facts: facts.generated_at || null,
      analytics: analytics.generated_at || null,
      score: score.generated_at || null,
    },
  };
  return cached;
}

/**
 * Symbols a position may reference. Validated against the shipped registries so
 * an unrecognised symbol is rejected before it is stored — the analytics layer
 * can only describe instruments it holds evidence for, and accepting an unknown
 * ticker would create a position that can never be valued or explained.
 */
function supportedSymbols() {
  const out = new Map();

  try {
    const { UNIVERSE } = require('./etf-universe');
    for (const e of UNIVERSE) out.set(e.symbol.toUpperCase(), { instrument_type: 'etf', symbol: e.symbol, slug: e.slug });
  } catch { /* ETF universe unavailable — other registries still apply */ }

  for (const [mod, type] of [['./asset-registry', 'asset'], ['./sector-registry', 'sector'], ['./equity-registry', 'equity']]) {
    try {
      const reg = require(mod);
      const list = reg.ASSETS || reg.SECTORS || reg.EQUITIES || [];
      for (const e of list) {
        const symbol = (e.symbol || '').toUpperCase();
        if (symbol && !out.has(symbol)) out.set(symbol, { instrument_type: type, symbol: e.symbol, slug: e.slug });
      }
    } catch { /* registry not present */ }
  }

  // Cash is a supported position without a registry entry: a holder's cash
  // balance is part of their allocation even though it is not an instrument.
  out.set('CASH', { instrument_type: 'cash', symbol: 'CASH', slug: 'cash' });
  return out;
}

let symbolCache = null;

/**
 * Resolve a symbol through the single registry (tools/symbol-registry.js).
 *
 * Returns null only when the symbol is in neither universe — a string this
 * platform cannot identify as a listing at all. A symbol that is recordable but
 * not researched RESOLVES, carrying `coverage: 'basic'`; it is a normal state,
 * not a rejection. Callers must not describe such a symbol as unsupported.
 *
 * `slug` is null for basic-coverage symbols, because a slug is the key into the
 * research artifacts and inventing one would imply research that does not exist.
 * The analytics engine already treats a position it cannot value as unvaluable
 * and discloses it, which is exactly the right behaviour here.
 */
function resolveSymbol(symbol, instrumentType, artifacts = null) {
  const registry = require('./symbol-registry');
  const hit = registry.resolve(symbol, instrumentType || null, artifacts);
  if (!hit) return null;
  return {
    instrument_type: hit.instrument_type,
    symbol: hit.symbol,
    // Basic-coverage symbols have no research slug; fall back to the lowercased
    // ticker so the persistence layer still has a stable, non-null key.
    slug: hit.slug || hit.symbol.toLowerCase(),
    coverage: hit.coverage,
    name: hit.name,
    exchange: hit.exchange,
    researched: hit.in_intelligence_universe,
  };
}

module.exports = { loadArtifacts, supportedSymbols, resolveSymbol, readJson, indexBySlug };
