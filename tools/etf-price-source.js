'use strict';

// ETF Intelligence Center — keyless daily price source.
//
// Reuses the request/hash primitives already exported by the institutional chart
// pipeline so there is one HTTP posture across the codebase. It deliberately does
// NOT reuse that module's fetchYahoo(): that helper is pinned to range=1y and its
// output feeds hash-verified chart artifacts, so widening it there would churn
// check:etf-charts. This module asks the same public endpoint for longer windows.
//
// Anti-fabrication: a symbol that does not resolve returns null. Callers record
// the ETF as unavailable with a reason. No synthetic bars, ever.

const fs = require('fs');
const path = require('path');

const { requestJson, hash } = require('./build-institutional-charts');

// --- scale controls ---------------------------------------------------------
//
// The universe is data-driven and expected to grow. Two mechanisms keep the
// fetch stage viable at thousands of symbols:
//
//   * a bounded concurrency pool, so wall-clock time grows sub-linearly without
//     hammering the public endpoint;
//   * a same-day on-disk response cache, so a rerun (or a resumed run after a
//     failure) costs nothing for symbols already fetched.
//
// The cache is keyed by symbol + range + UTC date, so it self-expires daily and
// can never serve a stale series into a published artifact.

const CACHE_DIR = path.join(__dirname, '..', 'data/cache/etf-series');
const DEFAULT_CONCURRENCY = 6;

function cachePath(symbol, range) {
  const day = new Date().toISOString().slice(0, 10);
  const safe = String(symbol).replace(/[^A-Za-z0-9.^-]/g, '_');
  return path.join(CACHE_DIR, `${safe}__${range}__${day}.json`);
}

function readCache(symbol, range) {
  try {
    return JSON.parse(fs.readFileSync(cachePath(symbol, range), 'utf8'));
  } catch {
    return null;
  }
}

function writeCache(symbol, range, payload) {
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cachePath(symbol, range), JSON.stringify(payload), 'utf8');
  } catch {
    // A cache miss must never fail a build.
  }
}

/** Remove cache entries from previous days so the directory cannot grow forever. */
function pruneCache() {
  const day = new Date().toISOString().slice(0, 10);
  try {
    for (const name of fs.readdirSync(CACHE_DIR)) {
      if (!name.endsWith(`__${day}.json`)) fs.unlinkSync(path.join(CACHE_DIR, name));
    }
  } catch {
    // Directory may not exist yet.
  }
}

/**
 * Map over items with a bounded number of in-flight operations.
 * Results preserve input order.
 */
async function mapWithConcurrency(items, worker, limit = DEFAULT_CONCURRENCY) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const SOURCE_URL = 'https://finance.yahoo.com/';
const UA = 'Mozilla/5.0 (compatible; TradeAlphaAI/1.0)';

// 13-week US Treasury bill yield — the observed risk-free rate for Sharpe and
// Sortino. Quoted by Yahoo in percent (e.g. 4.31 = 4.31%).
const RISK_FREE_SYMBOL = '^IRX';

// Benchmark proxies used for relative performance. Each is a real, liquid,
// keyless-resolvable instrument — not a modelled index.
const BENCHMARKS = {
  sp500: { symbol: 'SPY', label_en: 'S&P 500', label_ar: 'مؤشر S&P 500' },
  nasdaq100: { symbol: 'QQQ', label_en: 'Nasdaq-100', label_ar: 'مؤشر ناسداك 100' },
  world: { symbol: 'URTH', label_en: 'MSCI World', label_ar: 'مؤشر MSCI العالمي' },
};

/**
 * Fetch a daily series for one symbol.
 *
 * Prefers adjusted closes (dividends and splits reinvested) so distributing
 * share classes are not understated against accumulating ones. Which basis was
 * used is recorded on the result and surfaced in the UI — never silently mixed.
 */
async function fetchDailySeries(symbol, range = '10y', options = {}) {
  const url = `${CHART_BASE}${encodeURIComponent(symbol)}?interval=1d&range=${encodeURIComponent(range)}&events=div%2Csplit`;

  const cached = options.noCache ? null : readCache(symbol, range);
  if (cached) return { ...cached, from_cache: true };

  let response;
  try {
    response = await requestJson(url, { 'User-Agent': UA });
  } catch (error) {
    return { ok: false, symbol, reason: `fetch failed: ${error.message}` };
  }

  const result = response.parsed
    && response.parsed.chart
    && Array.isArray(response.parsed.chart.result)
    ? response.parsed.chart.result[0]
    : null;

  if (!result || !Array.isArray(result.timestamp) || !result.indicators) {
    return { ok: false, symbol, reason: 'no chart result' };
  }

  const quote = (result.indicators.quote && result.indicators.quote[0]) || {};
  const adjBlock = Array.isArray(result.indicators.adjclose) ? result.indicators.adjclose[0] : null;
  const adjCloses = adjBlock && Array.isArray(adjBlock.adjclose) ? adjBlock.adjclose : null;
  const returnBasis = adjCloses ? 'total_return' : 'price_only';

  const rows = [];
  for (let i = 0; i < result.timestamp.length; i += 1) {
    const close = adjCloses ? adjCloses[i] : (quote.close ? quote.close[i] : null);
    if (typeof close !== 'number' || !Number.isFinite(close) || close <= 0) continue;
    rows.push({
      date: new Date(result.timestamp[i] * 1000).toISOString().slice(0, 10),
      close,
      volume: quote.volume && Number.isFinite(quote.volume[i]) ? quote.volume[i] : null,
    });
  }

  if (!rows.length) return { ok: false, symbol, reason: 'no usable bars' };

  const meta = result.meta || {};
  const payload = {
    ok: true,
    symbol,
    rows,
    return_basis: returnBasis,
    meta: {
      currency: meta.currency || null,
      exchange_name: meta.exchangeName || null,
      full_exchange_name: meta.fullExchangeName || null,
      instrument_type: meta.instrumentType || null,
      long_name: meta.longName || null,
      short_name: meta.shortName || null,
      first_trade_date: Number.isFinite(meta.firstTradeDate)
        ? new Date(meta.firstTradeDate * 1000).toISOString().slice(0, 10)
        : null,
    },
    source: {
      provider: 'Yahoo',
      source_url: SOURCE_URL,
      endpoint: url,
      fetched_at: new Date().toISOString(),
      response_hash: hash(response.body),
      range,
    },
  };
  if (!options.noCache) writeCache(symbol, range, payload);
  return payload;
}

/**
 * Observed risk-free rate as a decimal (0.0431 = 4.31%).
 * Returns null when unavailable — callers must then mark Sharpe/Sortino
 * indeterminate rather than defaulting to zero.
 */
async function fetchRiskFreeRate() {
  const series = await fetchDailySeries(RISK_FREE_SYMBOL, '1mo');
  if (!series.ok || !series.rows.length) return null;
  const latest = series.rows[series.rows.length - 1];
  if (!Number.isFinite(latest.close)) return null;
  return {
    rate: latest.close / 100,
    as_of: latest.date,
    symbol: RISK_FREE_SYMBOL,
    source_url: SOURCE_URL,
  };
}

/** Closes on or after a cut-off date. */
function sliceFrom(rows, isoDate) {
  return (rows || []).filter((r) => r.date >= isoDate);
}

/** ISO date `years` before the last observation in the series. */
function windowStart(rows, years) {
  if (!rows || !rows.length) return null;
  const last = new Date(`${rows[rows.length - 1].date}T00:00:00Z`);
  const start = new Date(Date.UTC(last.getUTCFullYear() - years, last.getUTCMonth(), last.getUTCDate()));
  return start.toISOString().slice(0, 10);
}

/**
 * Restrict a series to a trailing window. Returns null when the fund did not
 * exist for the full window — a 3-year figure for a 1-year-old fund is not a
 * 3-year figure, so it is withheld rather than approximated.
 */
function trailingWindow(rows, years) {
  if (!rows || rows.length < 2) return null;
  const start = windowStart(rows, years);
  if (!start) return null;
  if (rows[0].date > start) return null;
  const slice = sliceFrom(rows, start);
  return slice.length >= 2 ? slice : null;
}

/** Align two series on their common dates, preserving order. */
function alignByDate(a, b) {
  const bIndex = new Map((b || []).map((r) => [r.date, r.close]));
  const outA = [];
  const outB = [];
  for (const row of a || []) {
    const match = bIndex.get(row.date);
    if (typeof match === 'number') {
      outA.push(row.close);
      outB.push(match);
    }
  }
  return { a: outA, b: outB };
}

/** Actual elapsed years between the first and last observation. */
function windowYears(rows) {
  if (!rows || rows.length < 2) return null;
  const first = Date.parse(`${rows[0].date}T00:00:00Z`);
  const last = Date.parse(`${rows[rows.length - 1].date}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last <= first) return null;
  return (last - first) / (365.2425 * 24 * 3600 * 1000);
}

module.exports = {
  CHART_BASE, SOURCE_URL, RISK_FREE_SYMBOL, BENCHMARKS,
  CACHE_DIR, DEFAULT_CONCURRENCY,
  fetchDailySeries, fetchRiskFreeRate,
  sliceFrom, windowStart, trailingWindow, alignByDate, windowYears,
  mapWithConcurrency, pruneCache, cachePath,
};
