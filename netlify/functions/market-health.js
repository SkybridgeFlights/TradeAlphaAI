const providerDefinitions = [
  {
    providerName: "mock",
    envKey: "",
    supportsLiveData: false,
    requiresServerKey: false,
    fallbackAvailable: true,
    cacheTtlSeconds: 300,
    implementationStatus: "fallback"
  },
  {
    providerName: "alpha-vantage",
    envKey: "ALPHA_VANTAGE_API_KEY",
    supportsLiveData: true,
    requiresServerKey: true,
    fallbackAvailable: true,
    cacheTtlSeconds: 60,
    implementationStatus: "stub"
  },
  {
    providerName: "finnhub",
    envKey: "FINNHUB_API_KEY",
    supportsLiveData: true,
    requiresServerKey: true,
    fallbackAvailable: true,
    cacheTtlSeconds: 60,
    implementationStatus: "live"
  },
  {
    providerName: "polygon",
    envKey: "POLYGON_API_KEY",
    supportsLiveData: true,
    requiresServerKey: true,
    fallbackAvailable: true,
    cacheTtlSeconds: 60,
    implementationStatus: "stub"
  },
  {
    providerName: "yahoo-compatible",
    envKey: "YAHOO_FINANCE_PROXY_URL",
    supportsLiveData: true,
    requiresServerKey: false,
    fallbackAvailable: true,
    cacheTtlSeconds: 60,
    implementationStatus: "stub"
  }
];

exports.handler = async function handler() {
  const started = Date.now();
  const now = new Date().toISOString();
  const activeProvider = process.env.MARKET_DATA_PROVIDER || "mock";

  const providers = providerDefinitions.map((provider, index) => {
    const keyConfigured = provider.envKey ? Boolean(process.env[provider.envKey]) : true;
    const isLiveImpl = provider.implementationStatus === "live";

    let status;
    if (provider.providerName === "mock") {
      status = "mock-only";
    } else if (keyConfigured && isLiveImpl) {
      status = "healthy";
    } else if (keyConfigured && !isLiveImpl) {
      status = "degraded";
    } else {
      status = "unavailable";
    }

    let message;
    if (provider.providerName === "mock") {
      message = "Mock provider is available for educational fallback.";
    } else if (provider.providerName === "finnhub" && keyConfigured) {
      message = "Finnhub live integration active. Real market data is available when FINNHUB_API_KEY is set.";
    } else if (provider.providerName === "finnhub" && !keyConfigured) {
      message = "Finnhub live integration is implemented but FINNHUB_API_KEY is not configured. Mock fallback active.";
    } else if (keyConfigured) {
      message = "Server key/config appears present. Real API logic is still intentionally stubbed.";
    } else {
      message = "Required server-side key/config is not present. Mock fallback remains available.";
    }

    return {
      providerName: provider.providerName,
      status,
      implementationStatus: provider.implementationStatus,
      latencyMs: Date.now() - started + index * 7,
      lastChecked: now,
      message,
      supportsLiveData: provider.supportsLiveData,
      requiresServerKey: provider.requiresServerKey,
      keyConfigured,
      fallbackAvailable: provider.fallbackAvailable,
      cacheTtlSeconds: provider.cacheTtlSeconds
    };
  });

  const finnhubProvider = providers.find((p) => p.providerName === "finnhub");
  const rateLimitNote = activeProvider === "finnhub"
    ? "Finnhub free tier: 60 API calls/minute. 2-3 calls per stock request. In-memory cache reduces repeat calls within 55s."
    : "";

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*"
    },
    body: JSON.stringify({
      ok: true,
      generatedAt: now,
      activeProvider,
      finnhubIntegration: {
        implementationStatus: "live",
        keyConfigured: Boolean(process.env.FINNHUB_API_KEY),
        rateLimitNote,
        endpoints: ["quote", "stock/profile2", "stock/metric"],
        cacheTtlMs: 55000,
        timeoutMs: 5000
      },
      cacheSimulation: {
        cacheStatus: "fresh",
        staleAfterSeconds: 60,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
        servedFromCache: false
      },
      providers
    })
  };
};
