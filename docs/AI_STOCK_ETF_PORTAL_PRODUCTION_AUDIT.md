# AI Stock & ETF Portal Production Readiness Audit

Last updated: 2026-05-19

## Scope

Audited:

- Market portal pages.
- Generated stock and ETF pages.
- Hub pages.
- `sitemap.xml` and `sitemap-market.xml`.
- `robots.txt`.
- `_redirects`.
- `.env.example`.
- `package.json` scripts.
- Generator and checker workflow.
- SEO metadata and schema coverage.
- Disclaimers and forbidden wording.
- Static hosting constraints.
- Future real-data integration risks.

## Current Readiness Summary

The portal is production-safe as a static, mock-data educational market research portal. The generated market page validation currently passes for all configured pages.

Current validation:

```text
Market page validation passed for 25 configured pages.
Sitemap coverage verified via sitemap-market.xml and sitemap.xml.
```

## SEO Readiness

Strengths:

- Dedicated static symbol pages exist for configured stocks and ETFs.
- `sitemap-market.xml` exists and includes generated market URLs.
- `robots.txt` references both `sitemap.xml` and `sitemap-market.xml`.
- Generated pages include titles, meta descriptions, canonical URLs, FAQ schema, and breadcrumb schema.
- `_redirects` prepares clean URL paths such as `/stocks/nvda/`.
- Market pages include visible educational disclaimers.

Risks:

- Canonicals currently use `.html` URLs. Clean folder URLs are redirected but not canonical yet.
- Arabic/German localized SEO pages are not generated yet.
- Real-time data freshness is not available until a serverless/backend provider is connected.

## Compliance Readiness

Current state:

- Required disclaimer appears across generated pages.
- Validation checks forbidden phrases:
  - `buy now`
  - `guaranteed profit`
  - `sure signal`
  - `guaranteed prediction`

Risk:

- The phrase `financial advice` appears only inside disclaimers and validator/documentation context. This is expected.

## Static Hosting Constraints

The site remains static. Browser JavaScript cannot protect private API keys. Real providers must be called from:

- Netlify Functions.
- Another serverless layer.
- A backend API.
- A build-time data refresh pipeline.

## Real Data Integration Readiness

Ready:

- Normalized asset contract exists in `js/market/market-normalizer.js`.
- Mock fallback exists and must remain available.
- Generated pages work without real data.

Needed for future production real data:

- Serverless provider adapters.
- Rate limiting and cache headers.
- Provider error handling.
- Data freshness labels.
- Stale fallback handling.

## Phase 7 Data Transparency Readiness

Added:

- Visible data status badges on analyzer, detail, screener, generated symbol, and hub pages.
- Expandable explanation: what mock/live/stale/fallback/unavailable means.
- `market-data-status.html` diagnostics page.
- Serverless response metadata contract.
- Production checker validation for status hooks and metadata fields.

Trust benefit:

- Users can see when analysis uses mock educational data.
- Future live provider data can be labeled without redesigning the UI.
- Provider fallback can be disclosed without breaking the page.

## UX And Mobile Notes

Strengths:

- Responsive grid/card layouts exist.
- Screener uses a horizontal table layout where needed.
- Missing data is normalized to professional fallbacks.

Risks:

- Very dense generated pages should be QA-tested on small phones.
- Large navigation groups may wrap on narrow screens.
- Future live data error states should remain calm and educational.

## Deployment Notes

Static mode:

```powershell
npx.cmd serve . -l 8098
```

Future Netlify/serverless mode:

```powershell
npx.cmd netlify dev
```

If Netlify CLI is not installed, install/use it outside this repository workflow only when needed.

## Phase 8 Audit Additions

Added:

- Normalized provider health model in `js/market/provider-health.js`.
- Serverless health endpoint in `netlify/functions/market-health.js`.
- Provider health table on `market-data-status.html`.
- Refresh diagnostics action for endpoint and provider health checks.
- Cache/stale metadata fields in data status and serverless market data responses.
- Production checker rules for the health endpoint, provider health model, diagnostics hooks, and cache metadata.

Current behavior:

- Real paid APIs are not called.
- API keys are not exposed.
- Health checks report only whether server-side environment variables appear configured.
- Static mode still works when Netlify Functions are unavailable.

Remaining risks:

- Real provider latency, error types, and quota behavior still need production testing after provider integration.
- Cache metadata is currently simulated and must be connected to actual cache behavior later.

## Phase 9 Audit — Finnhub Live Integration

Status: implemented, production-safe.

### What changed

- `netlify/functions/providers/finnhub.js` — replaced stub with full Finnhub implementation using `/quote`, `/stock/profile2`, and `/stock/metric` endpoints.
- `netlify/functions/market-data.js` — added latency tracking (`latencyMs`), session stats (`_stats`), rate-limit-aware fallback, improved attribution.
- `netlify/functions/market-health.js` — added `implementationStatus` per provider, `finnhubIntegration` metadata block.
- `js/market/data-status.js` — added `latencyMs`, `providerDisplayName`, provider-qualified live badge labels.
- `js/market/ui-renderer.js` — updated diagnostics to render `data-provider-metrics`, `data-provider-warning`, `implementationStatus` badges in health table, Finnhub integration details.
- `market-data-status.html` — added Phase 9 diagnostics sections (metrics, warning banner, rate limit notes, integration status).
- `tools/check-production-readiness.js` — added Phase 9 validation rules and smoke test instructions.
- `.env.example` — documented Finnhub activation steps and rate limit information.

### Security

- `FINNHUB_API_KEY` never appears in frontend JS or HTML.
- Production checker verifies `finnhub.io` URLs are absent from `js/` directory.
- Production checker verifies `FINNHUB_API_KEY` patterns are absent from frontend files.
- Key is read from `process.env` only inside the serverless function.

### Fallback guarantees preserved

- If `FINNHUB_API_KEY` is not set: throws immediately, mock fallback returns.
- If Finnhub returns HTTP 429: `isRateLimit` fallback with specific warning.
- If request times out after 5s: `AbortError` caught, mock fallback returns.
- If symbol is invalid (price = 0): throws, mock fallback returns.
- If Netlify Function is unavailable: frontend mock from `mock-data.js` returns.

### Normalized contract unchanged

All existing rendering, scoring, and screener modules work without modification. The Finnhub adapter maps raw API responses into the established normalized contract. `normalizeServerAsset()` in `market-data.js` applies final safe fallbacks before returning.

### Current audit status

```
Production readiness check: PASSED
Phase 9 Finnhub integration checks: PASSED
Frontend secret scan: PASSED
Finnhub API URL in frontend: NONE FOUND
```

### Remaining risks for production Finnhub usage

- Free tier limit (60 calls/minute) may be reached under traffic spikes. Add CDN or edge caching for production.
- In-memory module cache is per-instance. Serverless cold starts clear the cache. Add a KV/Redis layer for cross-instance caching when traffic grows.
- Finnhub does not expose MA50/MA200 in basic metrics. Derived proxies are reasonable but not exact TA values.
- ETF coverage on Finnhub may be incomplete. Some ETF symbols may return empty profile or 0 price, triggering mock fallback.
- Test in Netlify dev before deploying to production: `FINNHUB_API_KEY=key MARKET_DATA_PROVIDER=finnhub npx netlify dev`.
