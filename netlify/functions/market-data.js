const mockProvider = require("./providers/mock-provider");
const alphaVantage = require("./providers/alpha-vantage");
const finnhub = require("./providers/finnhub");
const polygon = require("./providers/polygon");
const yahooCompatible = require("./providers/yahoo-compatible");

const providers = {
  mock: mockProvider,
  "alpha-vantage": alphaVantage,
  finnhub,
  polygon,
  yahoo: yahooCompatible
};

// Module-level request stats (persists across warm serverless instances).
const _stats = { liveRequests: 0, fallbackRequests: 0, lastSuccessAt: null, lastFallbackAt: null };

exports.handler = async function handler(event) {
  const query = event.queryStringParameters || {};
  const symbol = normalizeSymbol(query.symbol);
  const type = normalizeType(query.type);

  if (!symbol) {
    return json(400, {
      error: "Invalid symbol.",
      message: "Provide a stock or ETF symbol using letters, numbers, dots, or dashes only."
    }, "no-store");
  }

  const requestedProvider = normalizeProvider(query.provider || process.env.MARKET_DATA_PROVIDER || "mock");
  const provider = providers[requestedProvider] || providers.mock;
  const requestStart = Date.now();

  try {
    const asset = await provider.getMarketData({ symbol, type, env: process.env });
    const latencyMs = Date.now() - requestStart;
    const responseProvider = asset.provider || requestedProvider;
    const isLive = requestedProvider !== "mock" && asset.dataMode !== "mock";
    const status = asset.quoteFallback ? "fallback_quote" : isLive ? "live" : "mock";
    const servedFromCache = Boolean(asset.servedFromCache);

    if (isLive) {
      _stats.liveRequests++;
      _stats.lastSuccessAt = new Date().toISOString();
    }

    return json(200, {
      ok: true,
      provider: responseProvider,
      metadata: buildMetadata({
        provider: responseProvider,
        status,
        isFallback: false,
        isMock: status === "mock",
        cacheTtlSeconds: requestedProvider === "mock" ? 300 : 60,
        cacheStatus: servedFromCache ? "cached" : "fresh",
        staleAfterSeconds: requestedProvider === "mock" ? 300 : 60,
        servedFromCache,
        latencyMs,
        attribution: attributionFor(responseProvider),
        warning: status === "mock" ? "Mock educational data is active. No live provider is configured." : "",
        stats: { ..._stats }
      }),
      asset: normalizeServerAsset(asset, symbol, type)
    }, cacheHeader(requestedProvider, servedFromCache));
  } catch (error) {
    const latencyMs = Date.now() - requestStart;
    const isRateLimit = Boolean(error.isRateLimit);
    if (type === "etf" && requestedProvider === "finnhub") {
      try {
        const fallbackAsset = await providers.yahoo.getMarketData({ symbol, type, env: process.env });
        const quoteLatencyMs = Date.now() - requestStart;
        const servedFromCache = Boolean(fallbackAsset.servedFromCache);

        _stats.liveRequests++;
        _stats.lastSuccessAt = new Date().toISOString();

        return json(200, {
          ok: true,
          provider: "yahoo-compatible",
          metadata: buildMetadata({
            provider: "yahoo-compatible",
            status: "fallback_quote",
            isFallback: false,
            isMock: false,
            cacheTtlSeconds: 60,
            cacheStatus: servedFromCache ? "cached" : "fresh",
            staleAfterSeconds: 60,
            servedFromCache,
            latencyMs: quoteLatencyMs,
            attribution: attributionFor("yahoo-compatible"),
            warning: "Finnhub ETF quote was unavailable. Returned a public Yahoo-compatible ETF quote.",
            stats: { ..._stats }
          }),
          asset: normalizeServerAsset(fallbackAsset, symbol, type)
        }, cacheHeader("yahoo-compatible", servedFromCache));
      } catch (_) {
        // Ranking UI refuses mock payloads and renders N/A, so fake values are not displayed.
      }
    }
    const fallback = await providers.mock.getMarketData({ symbol, type, env: process.env });

    _stats.fallbackRequests++;
    _stats.lastFallbackAt = new Date().toISOString();

    const warning = isRateLimit
      ? "Finnhub rate limit reached. Returned safe mock fallback data. Try again in 60 seconds."
      : "Configured provider unavailable. Returned educational mock fallback data.";

    return json(200, {
      ok: true,
      provider: "mock",
      fallback: true,
      isRateLimit,
      warning,
      metadata: buildMetadata({
        provider: "mock",
        status: "fallback",
        isFallback: true,
        isMock: true,
        cacheTtlSeconds: 0,
        cacheStatus: "fallback",
        staleAfterSeconds: 0,
        servedFromCache: false,
        latencyMs,
        attribution: "TradeAlphaAI serverless mock fallback",
        warning,
        stats: { ..._stats }
      }),
      asset: normalizeServerAsset(fallback, symbol, type)
    }, "no-store");
  }
};

function normalizeSymbol(value) {
  const symbol = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9.-]{1,12}$/.test(symbol) ? symbol : "";
}

function normalizeType(value) {
  return value === "etf" ? "etf" : "stock";
}

function normalizeProvider(value) {
  const provider = String(value || "mock").trim().toLowerCase();
  return providers[provider] ? provider : "mock";
}

function normalizeServerAsset(asset, symbol, type) {
  return {
    symbol,
    type,
    name: asset.name || symbol,
    exchange: asset.exchange || (type === "etf" ? "NYSE Arca" : "NASDAQ"),
    sector: asset.sector || (type === "etf" ? "ETF" : "Market"),
    industry: asset.industry || (type === "etf" ? "ETF" : "Equity"),
    issuer: asset.issuer || "",
    category: asset.category || asset.sector || "",
    price: numberOr(asset.price, 100),
    change: numberOr(asset.change, 0),
    changePercent: numberOr(asset.changePercent, 0),
    marketCap: asset.marketCap || (type === "etf" ? "ETF" : "N/A"),
    peRatio: numberOr(asset.peRatio, type === "etf" ? 22 : 30),
    revenueGrowth: numberOr(asset.revenueGrowth, 0.08),
    profitMargin: numberOr(asset.profitMargin, 0.15),
    rsi: numberOr(asset.rsi, 52),
    macdTrend: asset.macdTrend || "neutral",
    ma50: numberOr(asset.ma50, 98),
    ma200: numberOr(asset.ma200, 92),
    volumeTrend: asset.volumeTrend || "average",
    sentiment: asset.sentiment || "neutral",
    risk: asset.risk || "moderate",
    volatility: numberOr(asset.volatility, type === "etf" ? 0.18 : 0.28),
    trendDirection: asset.trendDirection || "range",
    heat: asset.heat || "steady",
    summary: asset.summary || `${symbol} serverless data fallback is available for educational screening.`,
    holdings: Array.isArray(asset.holdings) ? asset.holdings : [],
    allocation: asset.allocation || null,
    expenseRatio: numberOr(asset.expenseRatio, type === "etf" ? 0.0015 : 0),
    related: Array.isArray(asset.related) ? asset.related : [],
    dataMode: asset.dataMode || "mock",
    lastUpdated: asset.lastUpdated || new Date().toISOString()
  };
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cacheHeader(provider, servedFromCache) {
  if (servedFromCache) return "public, max-age=55, stale-while-revalidate=300";
  if (provider === "mock") return "public, max-age=300, stale-while-revalidate=600";
  return "public, max-age=60, stale-while-revalidate=300";
}

function buildMetadata({ provider, status, isFallback, isMock, cacheTtlSeconds, cacheStatus, staleAfterSeconds, servedFromCache, latencyMs, attribution, warning, stats }) {
  const now = new Date().toISOString();
  return {
    provider,
    status,
    generatedAt: now,
    updatedAt: now,
    isFallback,
    isMock,
    cacheTtlSeconds,
    cacheStatus: cacheStatus || "fresh",
    staleAfterSeconds: staleAfterSeconds || cacheTtlSeconds || 60,
    expiresAt: new Date(Date.now() + ((cacheTtlSeconds || 60) * 1000)).toISOString(),
    servedFromCache: Boolean(servedFromCache),
    latencyMs: Number.isFinite(Number(latencyMs)) ? Number(latencyMs) : null,
    attribution,
    warning: warning || "",
    confidence: status === "live" || status === "fallback_quote" ? "Provider" : status === "fallback" ? "Fallback" : "Demo",
    stats: stats || {}
  };
}

function attributionFor(provider) {
  if (provider === "finnhub") return "Finnhub.io — real-time market data, server-side proxy";
  if (provider === "alpha-vantage") return "Alpha Vantage provider, server-side integration pending";
  if (provider === "polygon") return "Polygon.io provider, server-side integration pending";
  if (provider === "yahoo" || provider === "yahoo-compatible") return "Yahoo-compatible public ETF quote endpoint, server-side proxy";
  return "TradeAlphaAI educational mock dataset";
}

function json(statusCode, body, cacheControl) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify(body)
  };
}
