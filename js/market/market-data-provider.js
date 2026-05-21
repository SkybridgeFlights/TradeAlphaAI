import { getMockAssets } from "./mock-data.js";
import { normalizeAsset, normalizeAssets } from "./market-normalizer.js";
import { createMockStatus, normalizeDataStatus } from "./data-status.js";

const providerRegistry = {
  mock: {
    name: "Mock Market Data",
    async listAssets() {
      const mock = normalizeAssets(getMockAssets()).map((asset) => attachStatus(asset, createMockStatus()));
      return mergeCentralAssets(mock);
    },
    async getAsset(symbol) {
      const normalized = normalizeSymbol(symbol);
      const assets = await this.listAssets();
      return assets.find((item) => item.symbol === normalized) || null;
    }
  },
  serverless: {
    name: "Serverless Market Data",
    async listAssets() {
      return providerRegistry.mock.listAssets();
    },
    async getAsset(symbol) {
      const normalized = normalizeSymbol(symbol);
      const local = await providerRegistry.mock.getAsset(normalized);
      const type = local ? local.type : "stock";
      try {
        const response = await fetch(`/.netlify/functions/market-data?symbol=${encodeURIComponent(normalized)}&type=${encodeURIComponent(type)}`, {
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error(`Serverless provider returned ${response.status}`);
        const payload = await response.json();
        if (!payload || !payload.asset) throw new Error("Serverless provider returned no asset");
        return attachStatus(normalizeAsset({
          ...payload.asset,
          summary: payload.fallback
            ? `${payload.asset.summary} Serverless provider fallback is active, so this remains educational mock data.`
            : payload.asset.summary
        }), normalizeDataStatus(payload.metadata || {
          provider: payload.provider,
          status: payload.fallback ? "fallback" : "live",
          isFallback: payload.fallback,
          isMock: payload.provider === "mock"
        }));
      } catch (error) {
        console.info("TradeAlphaAI market data serverless fallback:", error.message);
        return local;
      }
    }
  }
};

export function normalizeSymbol(symbol) {
  return String(symbol || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
}

export function getConfiguredProvider() {
  const requested = typeof window !== "undefined" ? window.TRADEALPHA_MARKET_PROVIDER || "mock" : "mock";
  return providerRegistry[requested] || providerRegistry.mock;
}

export async function listMarketAssets(type) {
  const assets = await getConfiguredProvider().listAssets();
  return type ? assets.filter((asset) => asset.type === type) : assets;
}

export async function getMarketAsset(symbol) {
  const provider = getConfiguredProvider();
  return provider.getAsset(symbol);
}

export async function getRelatedAssets(symbol) {
  const asset = await getMarketAsset(symbol);
  const assets = await listMarketAssets();
  if (!asset) return [];
  return assets.filter((item) => (asset.related || []).includes(item.symbol));
}

export async function getMarketFacets() {
  const assets = await listMarketAssets();
  return {
    sectors: unique(assets.map((asset) => asset.sector)),
    risks: unique(assets.map((asset) => asset.risk)),
    sentiments: unique(assets.map((asset) => asset.sentiment)),
    types: unique(assets.map((asset) => asset.type))
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

let centralAssetsPromise;

async function mergeCentralAssets(mockAssets) {
  const central = await loadCentralAssets();
  const bySymbol = new Map(mockAssets.map((asset) => [asset.symbol, asset]));
  for (const asset of central) {
    const existing = bySymbol.get(asset.symbol);
    bySymbol.set(asset.symbol, existing ? enrichAsset(existing, asset) : centralToMarketAsset(asset));
  }
  return [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

async function loadCentralAssets() {
  if (typeof fetch !== "function") return [];
  if (!centralAssetsPromise) {
    centralAssetsPromise = fetch("/data/research-assets/index.json", { headers: { Accept: "application/json" } })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => [...(data?.stocks || []), ...(data?.etfs || [])])
      .catch(() => []);
  }
  return centralAssetsPromise;
}

function enrichAsset(existing, research) {
  return {
    ...existing,
    research,
    summary: research.overview || existing.summary,
    sector: research.sector || research.category || existing.sector,
    category: research.category || existing.category,
    related: [...new Set([...(research.relatedStocks || []), ...(research.relatedETFs || []), ...(existing.related || [])])].slice(0, 8),
    themes: research.themes || existing.themes || []
  };
}

function centralToMarketAsset(research) {
  const seed = [...research.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const type = research.type;
  const price = type === "etf" ? 60 + (seed % 460) : 35 + (seed % 620);
  const changePercent = ((seed % 90) - 35) / 10;
  const volatility = 0.16 + ((seed % 18) / 100);
  return normalizeAsset({
    symbol: research.symbol,
    name: research.name,
    type,
    exchange: type === "etf" ? "NYSE Arca" : "NASDAQ",
    sector: research.sector || research.category || "Market Research",
    industry: research.category || research.sector || "Research Asset",
    category: research.category,
    price,
    changePercent,
    marketCap: type === "etf" ? "ETF" : "Large Cap",
    rsi: 42 + (seed % 28),
    macdTrend: seed % 3 === 0 ? "bullish" : seed % 3 === 1 ? "neutral" : "bearish",
    ma50: price * 0.97,
    ma200: price * 0.9,
    volumeTrend: seed % 2 === 0 ? "rising" : "steady",
    trendDirection: seed % 3 === 0 ? "uptrend" : seed % 3 === 1 ? "neutral" : "pullback",
    peRatio: type === "etf" ? null : 18 + (seed % 36),
    revenueGrowth: type === "etf" ? 0 : 0.03 + ((seed % 18) / 100),
    expenseRatio: type === "etf" ? 0.03 + ((seed % 20) / 1000) : undefined,
    issuer: type === "etf" ? "Research ETF issuer" : undefined,
    volatility,
    risk: volatility > 0.28 ? "high" : volatility > 0.21 ? "medium" : "low",
    sentiment: seed % 3 === 0 ? "positive" : seed % 3 === 1 ? "neutral" : "mixed",
    heat: seed % 3 === 0 ? "hot" : seed % 3 === 1 ? "steady" : "cool",
    summary: research.overview,
    related: [...new Set([...(research.relatedStocks || []), ...(research.relatedETFs || [])])].slice(0, 8),
    holdings: type === "etf" ? (research.relatedStocks || []).slice(0, 5).map((symbol) => ({ symbol, weight: 12 - symbol.length })) : undefined,
    allocation: type === "etf" ? Object.fromEntries((research.themes || []).slice(0, 4).map((theme, index) => [theme, 35 - index * 6])) : undefined,
    themes: research.themes || [],
    research
  });
}

function attachStatus(asset, status) {
  return {
    ...asset,
    dataStatus: status
  };
}

// TODO: Add Yahoo Finance, Alpha Vantage, Polygon.io, and Finnhub providers
// behind this same listAssets/getAsset shape when API keys and backend proxy
// protections are available. Do not expose private API keys in static JS.
