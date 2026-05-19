const defaultAllocation = {
  core: 45,
  growth: 25,
  defensive: 15,
  other: 15
};

export function normalizeAsset(asset = {}) {
  const type = asset.type === "etf" ? "etf" : "stock";
  const symbol = cleanSymbol(asset.symbol || "UNKNOWN");
  const price = numberOr(asset.price, 100);
  const ma50 = numberOr(asset.ma50, price * 0.97);
  const ma200 = numberOr(asset.ma200, price * 0.9);
  const volatility = numberOr(asset.volatility, type === "etf" ? 0.18 : 0.28);

  return {
    symbol,
    type,
    name: textOr(asset.name, symbol),
    exchange: textOr(asset.exchange, type === "etf" ? "NYSE Arca" : "NASDAQ"),
    sector: textOr(asset.sector, type === "etf" ? "ETF" : "Market"),
    industry: textOr(asset.industry, type === "etf" ? "ETF" : "Equity"),
    issuer: textOr(asset.issuer, type === "etf" ? "ETF Provider" : ""),
    category: textOr(asset.category, type === "etf" ? asset.sector || "ETF" : asset.industry || "Equity"),
    price,
    change: numberOr(asset.change, 0),
    changePercent: numberOr(asset.changePercent, 0),
    marketCap: textOr(asset.marketCap, type === "etf" ? "ETF" : "N/A"),
    peRatio: numberOr(asset.peRatio, type === "etf" ? 22 : 30),
    revenueGrowth: numberOr(asset.revenueGrowth, type === "etf" ? 0.08 : 0.1),
    profitMargin: numberOr(asset.profitMargin, type === "etf" ? 0.16 : 0.15),
    rsi: clamp(numberOr(asset.rsi, 52), 0, 100),
    macdTrend: oneOf(asset.macdTrend, ["bullish", "neutral", "bearish"], "neutral"),
    ma50,
    ma200,
    volumeTrend: oneOf(asset.volumeTrend, ["above average", "average", "below average"], "average"),
    sentiment: oneOf(asset.sentiment, ["positive", "neutral", "mixed", "negative"], "neutral"),
    risk: oneOf(asset.risk, ["low", "moderate", "elevated", "high"], "moderate"),
    volatility,
    trendDirection: textOr(asset.trendDirection, price >= ma50 ? "uptrend" : "range"),
    heat: textOr(asset.heat, volatility >= 0.35 ? "volatile" : "steady"),
    analystSentiment: textOr(asset.analystSentiment, "Rule-based mock sentiment is balanced."),
    earningsSentiment: textOr(asset.earningsSentiment, type === "etf" ? "portfolio-level" : "neutral"),
    summary: textOr(asset.summary, `${symbol} is available for educational screening with normalized mock market data.`),
    holdings: arrayOr(asset.holdings, type === "etf" ? ["Diversified exposure"] : []),
    allocation: asset.allocation ? { ...asset.allocation } : (type === "etf" ? { ...defaultAllocation } : null),
    expenseRatio: numberOr(asset.expenseRatio, type === "etf" ? 0.0015 : 0),
    related: arrayOr(asset.related, []),
    contentAngles: arrayOr(asset.contentAngles, [])
  };
}

export function normalizeAssets(assets = []) {
  return assets.map(normalizeAsset);
}

function cleanSymbol(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "") || "UNKNOWN";
}

function textOr(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function arrayOr(value, fallback) {
  return Array.isArray(value) ? [...value] : [...fallback];
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
