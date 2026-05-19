export const PROVIDER_HEALTH = {
  healthy: {
    label: "Healthy",
    className: "health-healthy",
    message: "Provider is available."
  },
  degraded: {
    label: "Degraded",
    className: "health-degraded",
    message: "Provider is available with reduced confidence or stale/cache behavior."
  },
  unavailable: {
    label: "Unavailable",
    className: "health-unavailable",
    message: "Provider is unavailable. Fallback should be used."
  },
  "mock-only": {
    label: "Mock only",
    className: "health-mock",
    message: "Provider is in mock/demo mode."
  },
  unknown: {
    label: "Unknown",
    className: "health-unknown",
    message: "Provider health has not been checked."
  }
};

export function normalizeProviderHealth(input = {}) {
  const status = PROVIDER_HEALTH[input.status] ? input.status : "unknown";
  const base = PROVIDER_HEALTH[status];
  return {
    providerName: input.providerName || input.provider || "unknown",
    status,
    label: input.label || base.label,
    className: base.className,
    latencyMs: Number.isFinite(Number(input.latencyMs)) ? Number(input.latencyMs) : null,
    lastChecked: input.lastChecked || new Date().toISOString(),
    message: input.message || base.message,
    supportsLiveData: Boolean(input.supportsLiveData),
    requiresServerKey: Boolean(input.requiresServerKey),
    keyConfigured: Boolean(input.keyConfigured),
    fallbackAvailable: input.fallbackAvailable !== false,
    cacheTtlSeconds: Number.isFinite(Number(input.cacheTtlSeconds)) ? Number(input.cacheTtlSeconds) : 300
  };
}

export function normalizeProviderHealthList(items = []) {
  return items.map(normalizeProviderHealth);
}

