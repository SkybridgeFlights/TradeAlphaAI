const fallbackAssets = {
  NVDA: {
    symbol: "NVDA",
    type: "stock",
    name: "NVIDIA Corporation",
    exchange: "NASDAQ",
    sector: "Technology",
    industry: "Semiconductors",
    price: 134.82,
    change: 2.41,
    changePercent: 1.82,
    marketCap: "3.31T",
    peRatio: 42.8,
    revenueGrowth: 0.78,
    profitMargin: 0.49,
    rsi: 66,
    macdTrend: "bullish",
    ma50: 121.4,
    ma200: 104.7,
    volumeTrend: "above average",
    sentiment: "positive",
    risk: "elevated",
    volatility: 0.34,
    trendDirection: "uptrend",
    heat: "hot",
    summary: "Serverless mock fallback for NVDA educational analysis.",
    related: ["MSFT", "META", "AAPL", "QQQ"]
  },
  SPY: {
    symbol: "SPY",
    type: "etf",
    name: "SPDR S&P 500 ETF Trust",
    exchange: "NYSE Arca",
    sector: "Broad Market",
    industry: "Large Blend ETF",
    issuer: "State Street Global Advisors",
    category: "U.S. Large Blend",
    expenseRatio: 0.0009,
    price: 526.18,
    change: 1.38,
    changePercent: 0.26,
    marketCap: "ETF",
    peRatio: 24.7,
    revenueGrowth: 0.08,
    profitMargin: 0.14,
    rsi: 57,
    macdTrend: "bullish",
    ma50: 518.3,
    ma200: 494.6,
    volumeTrend: "average",
    sentiment: "neutral",
    risk: "moderate",
    volatility: 0.16,
    trendDirection: "uptrend",
    heat: "steady",
    summary: "Serverless mock fallback for SPY educational ETF analysis.",
    holdings: ["MSFT", "AAPL", "NVDA", "AMZN", "META"],
    allocation: { technology: 29, financials: 13, healthcare: 12, consumer: 10, communication: 9, industrials: 8, other: 19 },
    related: ["QQQ", "VOO", "VTI", "AAPL"]
  }
};

async function getMarketData({ symbol, type }) {
  const normalized = String(symbol || "NVDA").toUpperCase();
  const asset = fallbackAssets[normalized] || buildGenericFallback(normalized, type);
  return {
    ...asset,
    provider: "mock-serverless",
    dataMode: "mock",
    status: "mock",
    isMock: true,
    isFallback: false,
    attribution: "TradeAlphaAI serverless mock provider",
    lastUpdated: new Date().toISOString()
  };
}

function buildGenericFallback(symbol, type) {
  const isEtf = type === "etf";
  return {
    symbol,
    type: isEtf ? "etf" : "stock",
    name: isEtf ? `${symbol} ETF` : `${symbol} Inc.`,
    exchange: isEtf ? "NYSE Arca" : "NASDAQ",
    sector: isEtf ? "ETF" : "Market",
    industry: isEtf ? "ETF" : "Equity",
    price: 100,
    change: 0,
    changePercent: 0,
    marketCap: isEtf ? "ETF" : "N/A",
    peRatio: isEtf ? 22 : 30,
    revenueGrowth: 0.08,
    profitMargin: 0.15,
    rsi: 52,
    macdTrend: "neutral",
    ma50: 98,
    ma200: 92,
    volumeTrend: "average",
    sentiment: "neutral",
    risk: "moderate",
    volatility: isEtf ? 0.18 : 0.28,
    trendDirection: "range",
    heat: "steady",
    summary: `${symbol} is using serverless mock fallback data for educational screening.`,
    related: []
  };
}

module.exports = { getMarketData };
