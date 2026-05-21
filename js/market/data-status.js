export const DATA_STATUS = {
  mock: {
    label: "Static research dataset",
    description: "Static educational research data is being used for platform analysis and comparison.",
    confidence: "Research",
    className: "status-mock"
  },
  live: {
    label: "Live market data",
    description: "Data is coming from a configured server-side market data provider.",
    confidence: "Provider",
    className: "status-live"
  },
  stale: {
    label: "Cached response",
    description: "Cached provider data is being shown. This is still real provider data served efficiently.",
    confidence: "Cached",
    className: "status-stale"
  },
  fallback: {
    label: "Provider fallback active",
    description: "The configured provider was unavailable, so safe fallback data is being shown.",
    confidence: "Fallback",
    className: "status-fallback"
  },
  unavailable: {
    label: "Provider unavailable",
    description: "Market data is not available right now. The page remains available for educational context.",
    confidence: "Unavailable",
    className: "status-unavailable"
  }
};

const PROVIDER_DISPLAY_NAMES = {
  finnhub: "Finnhub",
  "alpha-vantage": "Alpha Vantage",
  polygon: "Polygon.io",
  yahoo: "Yahoo-compatible",
  mock: "Static dataset",
  "mock-serverless": "Static dataset"
};

export function normalizeDataStatus(metadata = {}) {
  const status = DATA_STATUS[metadata.status] ? metadata.status : metadata.isFallback ? "fallback" : metadata.isMock ? "mock" : "mock";
  const base = DATA_STATUS[status];
  const timestamp = metadata.updatedAt || metadata.generatedAt || new Date().toISOString();
  const providerKey = metadata.provider || "mock";
  const providerDisplayName = PROVIDER_DISPLAY_NAMES[providerKey] || providerKey;

  const label = (status === "live" && providerDisplayName !== "Static dataset")
    ? `Live market data — ${providerDisplayName}`
    : (status === "stale" && providerDisplayName !== "Static dataset")
    ? `Cached response — ${providerDisplayName}`
    : base.label;

  const latencyMs = Number.isFinite(Number(metadata.latencyMs)) ? Number(metadata.latencyMs) : null;

  return {
    status,
    label,
    shortDescription: metadata.description || base.description,
    timestamp,
    providerName: metadata.provider || "mock",
    providerDisplayName,
    confidenceLevel: metadata.confidence || base.confidence,
    explanation: metadata.warning || base.description,
    className: base.className,
    isFallback: Boolean(metadata.isFallback || status === "fallback"),
    isMock: Boolean(metadata.isMock || status === "mock"),
    cacheTtlSeconds: Number.isFinite(Number(metadata.cacheTtlSeconds)) ? Number(metadata.cacheTtlSeconds) : 300,
    attribution: metadata.attribution || "TradeAlphaAI static educational dataset",
    cacheStatus: metadata.cacheStatus || (metadata.servedFromCache ? "cached" : "fresh"),
    staleAfterSeconds: Number.isFinite(Number(metadata.staleAfterSeconds)) ? Number(metadata.staleAfterSeconds) : 60,
    expiresAt: metadata.expiresAt || new Date(Date.now() + 60000).toISOString(),
    servedFromCache: Boolean(metadata.servedFromCache),
    latencyMs
  };
}

export function createMockStatus(provider = "mock") {
  return normalizeDataStatus({
    provider,
    status: "mock",
    isMock: true,
    generatedAt: new Date().toISOString(),
    cacheTtlSeconds: 300,
    cacheStatus: "fresh",
    staleAfterSeconds: 300,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    servedFromCache: false,
    attribution: "TradeAlphaAI static educational dataset"
  });
}
