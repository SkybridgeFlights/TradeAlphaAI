// Finnhub provider — real market data via server-side proxy.
// Keys are read from process.env only. Never exposed to frontend.
//
// Free tier limits: 60 API calls/minute.
// This provider uses 2-3 calls per request (quote + profile + metrics).
// The module-level cache limits repeated calls for the same symbol within 55s.
//
// Rate-limit errors (HTTP 429) throw with error.isRateLimit = true so
// market-data.js can include a specific warning in the fallback response.

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 55 * 1000;

const _cache = new Map();

function getCached(key) {
  const entry = _cache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  _cache.delete(key);
  return null;
}

function setCached(key, data) {
  _cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (res.status === 429) {
      const err = new Error("Finnhub rate limit exceeded.");
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Finnhub API error: HTTP ${res.status}`);
    return res.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Finnhub request timed out after 5 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function getMarketData({ symbol, type, env }) {
  const apiKey = (env || process.env).FINNHUB_API_KEY;
  if (!apiKey) throw new Error("FINNHUB_API_KEY is not configured.");

  const cacheKey = `${symbol}:${type}`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, servedFromCache: true };

  const isEtf = type === "etf";
  const sym = encodeURIComponent(symbol);
  const tok = encodeURIComponent(apiKey);

  const [quote, profile, metrics] = await Promise.all([
    fetchJson(`${FINNHUB_BASE}/quote?symbol=${sym}&token=${tok}`),
    fetchJson(`${FINNHUB_BASE}/stock/profile2?symbol=${sym}&token=${tok}`),
    isEtf
      ? Promise.resolve(null)
      : fetchJson(`${FINNHUB_BASE}/stock/metric?symbol=${sym}&metric=all&token=${tok}`)
  ]);

  const price = n(quote.c, 0);
  if (!price || price <= 0) {
    throw new Error(`Finnhub returned no valid price for ${symbol}. Symbol may be unsupported or market may be closed.`);
  }

  const result = buildNormalized(symbol, type, quote, profile || {}, metrics || {});
  setCached(cacheKey, result);
  return result;
}

function buildNormalized(symbol, type, quote, profile, metricsResponse) {
  const isEtf = type === "etf";
  const m = (metricsResponse && metricsResponse.metric) || {};
  const p = profile || {};

  const price = n(quote.c, 100);
  const change = n(quote.d, 0);
  const changePercent = n(quote.dp, 0);

  const marketCapM = n(p.marketCapitalization, 0);
  const marketCap = marketCapM > 0
    ? formatMarketCap(marketCapM * 1e6)
    : isEtf ? "ETF" : "N/A";

  const peRatio = n(m.peBasicExclExtraTTM !== undefined ? m.peBasicExclExtraTTM : m.peInclExtraTTM, isEtf ? 22 : 30);

  const revenueGrowthRaw = n(m.revenueGrowthTTMYoy, null);
  const revenueGrowth = revenueGrowthRaw !== null
    ? (Math.abs(revenueGrowthRaw) > 1 ? revenueGrowthRaw / 100 : revenueGrowthRaw)
    : 0.08;

  const profitMarginRaw = n(m.netMarginTTM, null);
  const profitMargin = profitMarginRaw !== null
    ? (Math.abs(profitMarginRaw) > 1 ? profitMarginRaw / 100 : profitMarginRaw)
    : 0.15;

  const rsi = clamp(n(m.rsi14, 52), 0, 100);

  // Derive MA proxies from 52-week range (Finnhub basic metrics do not provide MAs directly).
  const weekHigh52 = n(m["52WeekHigh"], price * 1.15);
  const weekLow52 = n(m["52WeekLow"], price * 0.85);
  const rangeWidth = weekHigh52 - weekLow52;
  const ma200 = rangeWidth > 0 ? weekLow52 + rangeWidth * 0.5 : price * 0.93;
  const ma50 = price > ma200 ? ma200 * 1.04 : ma200 * 0.96;

  const vol10d = n(m["10DayAverageTradingVolume"], 0);
  const vol3m = n(m["3MonthAverageTradingVolume"], 0);
  const volumeTrend = vol10d > 0 && vol3m > 0
    ? vol10d > vol3m * 1.15 ? "above average"
    : vol10d < vol3m * 0.85 ? "below average"
    : "average"
    : "average";

  const trendDirection = price > ma200 ? "uptrend" : price < ma200 * 0.95 ? "downtrend" : "range";
  const macdTrend = rsi > 56 ? "bullish" : rsi < 44 ? "bearish" : "neutral";

  const beta = n(m.beta, isEtf ? 0.9 : 1.1);
  const volatility = Math.max(0.05, Math.min(1.5, beta * 0.25));
  const risk = beta > 1.5 ? "high" : beta > 1.2 ? "elevated" : beta > 0.8 ? "moderate" : "low";
  const heat = volatility > 0.35 ? "hot" : volatility > 0.25 ? "warm" : "steady";

  const sentiment = changePercent > 1.5 ? "positive"
    : changePercent < -1.5 ? "negative"
    : changePercent > 0.3 ? "positive"
    : changePercent < -0.3 ? "mixed"
    : "neutral";

  const name = p.name || symbol;
  const exchange = p.exchange || (isEtf ? "NYSE Arca" : "NASDAQ");
  const sector = p.finnhubIndustry || (isEtf ? "ETF" : "Market");

  return {
    symbol,
    type,
    name,
    exchange,
    sector,
    industry: sector,
    issuer: isEtf ? (p.name || "ETF Provider") : "",
    category: isEtf ? (sector || "ETF") : sector,
    price,
    change,
    changePercent,
    marketCap,
    peRatio,
    revenueGrowth,
    profitMargin,
    rsi,
    macdTrend,
    ma50,
    ma200,
    volumeTrend,
    sentiment,
    risk,
    volatility,
    trendDirection,
    heat,
    analystSentiment: `Finnhub live data — RSI ${rsi.toFixed(0)}, Beta ${beta.toFixed(2)}.`,
    earningsSentiment: isEtf ? "portfolio-level" : "neutral",
    summary: `${name} live market data via Finnhub. Price: $${price.toFixed(2)}, ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}% today. Educational and informational only.`,
    holdings: [],
    allocation: null,
    expenseRatio: 0,
    related: [],
    contentAngles: [],
    dataMode: "live",
    lastUpdated: new Date().toISOString(),
    provider: "finnhub",
    attribution: "Finnhub.io — real-time market data"
  };
}

function formatMarketCap(value) {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return `$${value}`;
}

function n(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = { getMarketData };
