import { getMockAssets } from "./mock-data.js";
import { normalizeAsset, normalizeAssets } from "./market-normalizer.js";
import { createMockStatus, normalizeDataStatus } from "./data-status.js";

const providerRegistry = {
  mock: {
    name: "Mock Market Data",
    async listAssets() {
      return normalizeAssets(getMockAssets()).map((asset) => attachStatus(asset, createMockStatus()));
    },
    async getAsset(symbol) {
      const normalized = normalizeSymbol(symbol);
      const asset = getMockAssets().find((item) => item.symbol === normalized);
      return asset ? attachStatus(normalizeAsset(asset), createMockStatus()) : null;
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

function attachStatus(asset, status) {
  return {
    ...asset,
    dataStatus: status
  };
}

// TODO: Add Yahoo Finance, Alpha Vantage, Polygon.io, and Finnhub providers
// behind this same listAssets/getAsset shape when API keys and backend proxy
// protections are available. Do not expose private API keys in static JS.
