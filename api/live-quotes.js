'use strict';

// Phase 75-RT — Live terminal quote orchestrator (Vercel serverless).
// Batch endpoint powering the homepage live market matrix and intraday pulse
// refresh. Orchestrates multiple providers per asset with health scoring,
// automatic failover, retry backoff, freshness scoring, and stale-data
// suppression. Fallback is a LAST RESORT and is always explicit:
// a symbol with no live verified quote returns null values — never a
// fabricated number, never a mock price.
//
// Provider chain (keyless providers make live data the default, keys upgrade):
//   finnhub   — FINNHUB_API_KEY    (equities/ETFs: SPY QQQ NVDA IWM)
//   yahoo     — keyless            (all symbols incl. futures/indices/crypto)
//   coingecko — keyless            (BTC)
//   twelvedata— TWELVEDATA_API_KEY (optional equities/forex upgrade)
//
// GET /api/live-quotes        → all terminal assets
// GET /api/live-quotes?assets=gold,vix → subset

const TIMEOUT_MS = 4500;
const RETRY_DELAY_MS = 280;
const STALE_QUOTE_HOURS = 72; // weekend gap tolerance; older market times are suppressed
const CDN_CACHE = 'public, s-maxage=30, max-age=15, stale-while-revalidate=90';

// ── Terminal asset registry ──────────────────────────────────────────────────
const ASSETS = {
  gold: { yahoo: 'GC=F', label: 'GOLD', kind: 'commodity' },
  dxy: { yahoo: 'DX-Y.NYB', label: 'DXY', kind: 'index' },
  // ^TNX historically quotes yield*10 (44.6) but some feeds return the yield
  // directly (4.46) — normalize either form; a 10Y yield above 25% is not
  // plausible, so values above 25 are the *10 convention.
  us10y: { yahoo: '^TNX', label: 'US10Y', kind: 'yield', transform: (v) => (v > 25 ? v / 10 : v) },
  spy: { yahoo: 'SPY', finnhub: 'SPY', twelvedata: 'SPY', label: 'SPY', kind: 'etf' },
  qqq: { yahoo: 'QQQ', finnhub: 'QQQ', twelvedata: 'QQQ', label: 'QQQ', kind: 'etf' },
  nvda: { yahoo: 'NVDA', finnhub: 'NVDA', twelvedata: 'NVDA', label: 'NVDA', kind: 'stock' },
  btc: { yahoo: 'BTC-USD', coingecko: 'bitcoin', label: 'BTC', kind: 'crypto' },
  vix: { yahoo: '^VIX', label: 'VIX', kind: 'index' },
  oil: { yahoo: 'CL=F', label: 'OIL', kind: 'commodity' },
  iwm: { yahoo: 'IWM', finnhub: 'IWM', twelvedata: 'IWM', label: 'IWM', kind: 'etf' },
};

// ── Provider health registry (persists across warm instances) ───────────────
const _health = {};
function health(name) {
  if (!_health[name]) {
    _health[name] = { successes: 0, failures: 0, consecutive_failures: 0, last_success_at: null, last_error: null };
  }
  return _health[name];
}
function healthScore(name) {
  const h = health(name);
  const total = h.successes + h.failures;
  const rate = total ? h.successes / total : 1;
  // Consecutive failures push a provider down the failover order fast.
  return rate - h.consecutive_failures * 0.2;
}
function recordSuccess(name) {
  const h = health(name);
  h.successes += 1;
  h.consecutive_failures = 0;
  h.last_success_at = new Date().toISOString();
}
function recordFailure(name, error) {
  const h = health(name);
  h.failures += 1;
  h.consecutive_failures += 1;
  h.last_error = String(error && error.message ? error.message : error).slice(0, 160);
}

// ── Fetch helpers ────────────────────────────────────────────────────────────
async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'TradeAlphaAI live-terminal proxy', ...headers },
    });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.isRateLimit = res.status === 429;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// One retry with backoff per provider call; rate limits are not retried.
async function withRetry(fn) {
  try { return await fn(); } catch (error) {
    if (error.isRateLimit || (error.name === 'AbortError')) throw error;
    await delay(RETRY_DELAY_MS);
    return fn();
  }
}

function finiteOr(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// ── Providers ────────────────────────────────────────────────────────────────
// Every provider returns the same normalized shape or throws:
// { value, change_pct, market_time, source, attribution }

async function yahooQuote(symbol) {
  const body = await withRetry(() => fetchJson(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
  ));
  const meta = body && body.chart && body.chart.result && body.chart.result[0] && body.chart.result[0].meta;
  if (!meta) throw new Error(`yahoo: no result for ${symbol}`);
  const price = finiteOr(meta.regularMarketPrice);
  const prev = finiteOr(meta.previousClose, finiteOr(meta.chartPreviousClose));
  if (price === null || price <= 0 || prev === null || prev <= 0) throw new Error(`yahoo: unusable quote for ${symbol}`);
  return {
    value: price,
    change_pct: ((price - prev) / prev) * 100,
    market_time: finiteOr(meta.regularMarketTime) ? new Date(meta.regularMarketTime * 1000).toISOString() : null,
    source: 'yahoo',
    attribution: 'Yahoo Finance public quote endpoint (server-side proxy)',
  };
}

async function finnhubQuote(symbol, env) {
  const key = env.FINNHUB_API_KEY;
  if (!key) throw new Error('finnhub: no API key configured');
  const q = await withRetry(() => fetchJson(
    `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${key}`
  ));
  const price = finiteOr(q && q.c);
  const changePct = finiteOr(q && q.dp);
  if (price === null || price <= 0 || changePct === null) throw new Error(`finnhub: unusable quote for ${symbol}`);
  return {
    value: price,
    change_pct: changePct,
    market_time: finiteOr(q.t) ? new Date(q.t * 1000).toISOString() : null,
    source: 'finnhub',
    attribution: 'Finnhub.io real-time quote (server-side proxy)',
  };
}

async function coingeckoQuote(id) {
  const body = await withRetry(() => fetchJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`
  ));
  const node = body && body[id];
  const price = finiteOr(node && node.usd);
  const changePct = finiteOr(node && node.usd_24h_change);
  if (price === null || price <= 0 || changePct === null) throw new Error(`coingecko: unusable quote for ${id}`);
  return {
    value: price,
    change_pct: changePct,
    market_time: new Date().toISOString(),
    source: 'coingecko',
    attribution: 'CoinGecko public API (24h change, server-side proxy)',
  };
}

async function twelvedataQuote(symbol, env) {
  const key = env.TWELVEDATA_API_KEY;
  if (!key) throw new Error('twelvedata: no API key configured');
  const q = await withRetry(() => fetchJson(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${key}`
  ));
  const price = finiteOr(q && q.close);
  const changePct = finiteOr(q && q.percent_change);
  if (price === null || price <= 0 || changePct === null) throw new Error(`twelvedata: unusable quote for ${symbol}`);
  return {
    value: price,
    change_pct: changePct,
    market_time: q.timestamp ? new Date(Number(q.timestamp) * 1000).toISOString() : null,
    source: 'twelvedata',
    attribution: 'Twelve Data quote API (server-side proxy)',
  };
}

// Provider chain per asset, re-ordered live by health score.
function providerChain(key, def, env) {
  const chain = [];
  if (def.finnhub && env.FINNHUB_API_KEY) chain.push({ name: 'finnhub', run: () => finnhubQuote(def.finnhub, env) });
  if (def.twelvedata && env.TWELVEDATA_API_KEY) chain.push({ name: 'twelvedata', run: () => twelvedataQuote(def.twelvedata, env) });
  if (def.coingecko) chain.push({ name: 'coingecko', run: () => coingeckoQuote(def.coingecko) });
  if (def.yahoo) chain.push({ name: 'yahoo', run: () => yahooQuote(def.yahoo) });
  chain.sort((a, b) => healthScore(b.name) - healthScore(a.name));
  return chain;
}

// Freshness: a quote whose market time is older than the stale window is
// suppressed (returned as null) rather than displayed as live.
function freshnessOk(quote) {
  if (!quote.market_time) return true; // providers without timestamps already passed live checks
  const age = Date.now() - new Date(quote.market_time).getTime();
  return Number.isFinite(age) && age <= STALE_QUOTE_HOURS * 3600000;
}

async function resolveAsset(key, env) {
  const def = ASSETS[key];
  const errors = [];
  for (const provider of providerChain(key, def, env)) {
    try {
      const quote = await provider.run();
      if (!freshnessOk(quote)) {
        errors.push(`${provider.name}: quote older than ${STALE_QUOTE_HOURS}h — suppressed`);
        continue;
      }
      recordSuccess(provider.name);
      const transform = def.transform || ((v) => v);
      return {
        symbol: def.label,
        value: transform(quote.value),
        change_pct: Math.round(quote.change_pct * 100) / 100,
        direction: quote.change_pct > 0.05 ? 'up' : quote.change_pct < -0.05 ? 'down' : 'flat',
        kind: def.kind,
        source: quote.source,
        attribution: quote.attribution,
        market_time: quote.market_time,
        fetched_at: new Date().toISOString(),
        live: true,
      };
    } catch (error) {
      recordFailure(provider.name, error);
      errors.push(`${provider.name}: ${String(error.message).slice(0, 80)}`);
    }
  }
  // Last resort — explicit absence. Never a fabricated value.
  return {
    symbol: def.label,
    value: null,
    change_pct: null,
    direction: null,
    kind: def.kind,
    source: null,
    attribution: null,
    market_time: null,
    fetched_at: new Date().toISOString(),
    live: false,
    unavailable_reasons: errors.slice(0, 4),
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.status(204).end();
    return;
  }

  const requested = String((req.query && req.query.assets) || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter((s) => ASSETS[s]);
  const keys = requested.length ? requested : Object.keys(ASSETS);

  const entries = await Promise.all(keys.map(async (key) => [key, await resolveAsset(key, process.env)]));
  const assets = Object.fromEntries(entries);
  const liveCount = entries.filter(([, a]) => a.live).length;

  const payload = {
    ok: true,
    updated_at: new Date().toISOString(),
    status: liveCount === keys.length ? 'live' : liveCount > 0 ? 'partial' : 'unavailable',
    live_count: liveCount,
    asset_count: keys.length,
    assets,
    providers: Object.fromEntries(Object.entries(_health).map(([name, h]) => [name, {
      score: Math.round(healthScore(name) * 100) / 100,
      successes: h.successes,
      failures: h.failures,
      consecutive_failures: h.consecutive_failures,
      last_success_at: h.last_success_at,
      last_error: h.last_error,
    }])),
    policy: 'Sourced provider quotes only. Assets without a live verified quote return null — values are never fabricated.',
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', liveCount > 0 ? CDN_CACHE : 'no-store');
  res.status(200).send(JSON.stringify(payload));
};

module.exports.ASSETS = ASSETS;
