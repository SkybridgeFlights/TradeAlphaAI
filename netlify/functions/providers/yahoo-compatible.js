// Yahoo-compatible quote provider.
// Quote-only server-side fallback for public ETF symbols when the primary
// Finnhub quote is unavailable. No API keys are required or exposed.

const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
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

async function getMarketData({ symbol, type }) {
  if (type !== "etf") {
    throw new Error("Yahoo-compatible quote fallback is limited to ETF symbols.");
  }

  const cacheKey = `${symbol}:etf:quote`;
  const cached = getCached(cacheKey);
  if (cached) return { ...cached, servedFromCache: true };

  const quote = await fetchChartQuote(symbol);
  const result = buildNormalized(symbol, quote);
  setCached(cacheKey, result);
  return result;
}

async function fetchChartQuote(symbol) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "TradeAlphaAI market-data proxy"
      }
    });
    if (!res.ok) throw new Error(`Yahoo-compatible chart quote error: HTTP ${res.status}`);
    const body = await res.json();
    const result = body?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta) throw new Error(`Yahoo-compatible chart returned no result for ${symbol}.`);
    return meta;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Yahoo-compatible quote timed out after 5 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function buildNormalized(symbol, quote) {
  const price = n(quote.regularMarketPrice, null);
  const previousClose = n(quote.previousClose, n(quote.chartPreviousClose, null));
  const change = n(
    quote.regularMarketChange,
    price !== null && previousClose !== null ? price - previousClose : null
  );
  const changePercent = n(
    quote.regularMarketChangePercent,
    change !== null && previousClose ? (change / previousClose) * 100 : null
  );

  if (price === null || price <= 0 || changePercent === null) {
    throw new Error(`Yahoo-compatible quote returned unusable ETF data for ${symbol}.`);
  }

  const name = quote.longName || quote.shortName || symbol;
  const exchange = quote.fullExchangeName || quote.exchangeName || "ETF Exchange";
  const rsi = changePercent > 1.5 ? 58 : changePercent < -1.5 ? 42 : 52;
  const ma200 = previousClose && previousClose > 0 ? previousClose : price;
  const ma50 = price > ma200 ? ma200 * 1.02 : ma200 * 0.98;
  const volatility = 0.18;

  return {
    symbol,
    type: "etf",
    name,
    exchange,
    sector: "ETF",
    industry: "ETF",
    issuer: name,
    category: "ETF",
    price,
    change,
    changePercent,
    marketCap: "ETF",
    peRatio: null,
    revenueGrowth: 0,
    profitMargin: 0,
    rsi,
    macdTrend: changePercent > 0.5 ? "bullish" : changePercent < -0.5 ? "bearish" : "neutral",
    ma50,
    ma200,
    volumeTrend: "average",
    sentiment: changePercent > 0.3 ? "positive" : changePercent < -0.3 ? "mixed" : "neutral",
    risk: "moderate",
    volatility,
    trendDirection: price > ma200 ? "uptrend" : price < ma200 * 0.98 ? "downtrend" : "range",
    heat: Math.abs(changePercent) > 2 ? "warm" : "steady",
    analystSentiment: `Yahoo-compatible quote fallback - ${changePercent.toFixed(2)}% regular-market change.`,
    earningsSentiment: "portfolio-level",
    summary: `${name} public ETF quote via Yahoo-compatible fallback. Price: $${price.toFixed(2)}, ${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(2)}%. Educational and informational only.`,
    holdings: [],
    allocation: null,
    expenseRatio: null,
    related: [],
    contentAngles: [],
    dataMode: "live",
    quoteFallback: true,
    lastUpdated: new Date().toISOString(),
    provider: "yahoo-compatible",
    attribution: "Yahoo-compatible public quote endpoint"
  };
}

function n(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

module.exports = { getMarketData };
