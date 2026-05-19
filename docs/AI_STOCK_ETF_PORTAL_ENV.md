# AI Stock & ETF Portal Environment Strategy

Last updated: 2026-05-19

## Current Phase

The portal currently uses mock data only. No real APIs, private keys, backend, authentication, subscriptions, or databases are connected.

## Future Placeholder Keys

When real providers are added, placeholders can be documented in `.env.example` only:

- `MARKET_DATA_PROVIDER=mock`
- `ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key`
- `POLYGON_API_KEY=your-polygon-key`
- `FINNHUB_API_KEY=your-finnhub-key`
- `OPENAI_API_KEY=your-openai-key`
- `YAHOO_FINANCE_PROXY_URL=your-serverless-proxy-url`

Phase 4 added placeholder keys to `.env.example`. They are empty by default and must not be filled with real secrets in committed files. Do not expose real keys in static JavaScript.

## Recommended Future Architecture

Use one of these safe approaches:

- Serverless function proxy with key protection.
- Backend data service with caching and rate limiting.
- Scheduled static build that generates JSON snapshots.
- Static generation pipeline that emits symbol pages and sitemap entries.

## Phase 6 Serverless Preparation

Phase 6 adds Netlify Function stubs:

- `netlify/functions/market-data.js`
- `netlify/functions/providers/mock-provider.js`
- `netlify/functions/providers/alpha-vantage.js`
- `netlify/functions/providers/finnhub.js`
- `netlify/functions/providers/polygon.js`
- `netlify/functions/providers/yahoo-compatible.js`

The function reads provider keys from server-side environment variables only. Frontend JavaScript must never contain provider keys.

Provider fallback order:

1. Requested/active provider from `MARKET_DATA_PROVIDER`.
2. Safe serverless mock fallback if provider is unavailable.
3. Frontend static mock fallback if the Netlify Function is unavailable.

## Static Site Constraint

Static browser JavaScript cannot safely protect private API keys. Any paid provider or rate-limited provider should be called server-side or during a build process.

## Generator Commands

Generate configured static market pages:

```powershell
npm.cmd run generate:market-pages
```

Validate generated pages:

```powershell
npm.cmd run check:market-pages
```

## Data Freshness Notes

Future pages should display:

- Provider name.
- Last refreshed timestamp.
- Data delay notice.
- Educational-only disclaimer.
- Clear fallback state if data is unavailable.

## Caching Strategy

Initial serverless cache headers:

- Mock/serverless fallback: `public, max-age=300, stale-while-revalidate=600`
- Future live price data: `public, max-age=60, stale-while-revalidate=300`
- Future fundamentals: recommended `max-age=3600` or longer depending on provider terms.

Future production options:

- Netlify edge cache.
- Scheduled static JSON snapshots.
- Server-side KV/cache layer.
- Database cache only after backend architecture exists.

## Local Testing Modes

Static mode:

```powershell
npx.cmd serve . -l 8098
```

Netlify/serverless mode:

```powershell
npx.cmd netlify dev
```

If Netlify CLI is not installed, document the command and install it only when needed. The static site remains usable without Netlify Functions because mock fallback remains active.

## Provider Diagnostics

Phase 7 adds:

- `market-data-status.html`

Use it to check:

- Frontend provider mode.
- Serverless endpoint availability.
- Mock fallback availability.
- Supported future providers.
- Last checked time.
- Security note that keys are server-side only.

The diagnostics page does not expose secrets and does not require a real provider.

## Phase 8 Health Endpoint

Phase 8 adds:

- `/.netlify/functions/market-health`

The endpoint returns configuration diagnostics for:

- Mock provider
- Alpha Vantage
- Finnhub
- Polygon
- Yahoo-compatible provider

It reports whether a required server-side key is configured, but never returns the key value. It also returns simulated latency, fallback availability, cache TTL, and a cache simulation object with stale metadata.

Future real-provider checklist:

- Keep all keys in Netlify/serverless environment variables.
- Add provider requests only inside serverless functions.
- Add rate-limit handling before production traffic.
- Add provider-specific attribution text.
- Add short cache windows for price data and longer cache windows for fundamentals.
- Preserve mock fallback for local static testing and provider outages.

## Phase 9 Finnhub Live Provider

Phase 9 implements the first real provider — Finnhub — in safe hybrid mode.

### Activation

Set these in Netlify environment variables only (never in committed files):

```
MARKET_DATA_PROVIDER=finnhub
FINNHUB_API_KEY=your-finnhub-key
```

Get a free Finnhub key at https://finnhub.io/register.

### Rate limits

Finnhub free tier: 60 API calls/minute.

Each stock request uses 3 API calls (quote + profile2 + metric).
Each ETF request uses 2 API calls (quote + profile2).

At 3 calls per request: approximately 20 unique stock requests per minute before rate limiting.
At 2 calls per request: approximately 30 unique ETF requests per minute.

The module-level in-memory cache prevents duplicate calls for the same symbol within 55 seconds. Under steady traffic this means each symbol costs 0–3 API calls per minute.

### Rate limit fallback behavior

On HTTP 429:

1. `finnhub.js` throws with `error.isRateLimit = true`.
2. `market-data.js` catches and returns safe mock fallback.
3. Response includes `isRateLimit: true` and a user-facing warning message.
4. Frontend renders "Provider fallback active" badge with the warning text.
5. The page remains functional with educational mock data.

### Caching strategy

| Data type         | Cache TTL | Notes                              |
|-------------------|-----------|------------------------------------|
| Price (quote)     | 55s in-memory, 60s CDN | Reset on warm instance restart |
| Profile + metrics | 55s in-memory, 60s CDN | Fundamentals change slowly         |
| Fallback response | 60s CDN | Mock data cached for 60 seconds    |
| Mock only mode    | 300s CDN | Static mock data cached 5 minutes  |

Future improvement: Move to Netlify Edge Cache or a KV store for cross-instance caching.

### Timeout

Each Finnhub API call has a 5-second timeout enforced by `AbortController`. On timeout, the function falls back to mock data safely.

### Normalization decisions

Finnhub basic metrics do not include MA50/MA200 directly. These are derived:

- `ma200` ≈ midpoint of 52-week range (`52WeekLow + (range * 0.5)`)
- `ma50` ≈ ±4% from ma200 based on whether price is above or below ma200

RSI is available directly from `metric.rsi14`. Beta is used to derive volatility and risk labels.
