# AI Stock & ETF Portal Architecture

Last updated: 2026-05-19

## Current Architecture

The portal remains a static HTML/CSS/JavaScript system. It does not use React, Next.js, a backend, authentication, subscriptions, or real market APIs.

Current portal files:

- `stocks.html` - stock analyzer landing page.
- `stock.html` - stock detail page using `?symbol=`.
- `etfs.html` - ETF analyzer landing page.
- `etf.html` - ETF detail page using `?symbol=`.
- `ai-stock-screener.html` - stock and ETF screener.
- `css/market/market-portal.css` - shared portal UI system.
- `js/market/mock-data.js` - browser-importable mock market universe.
- `js/market/market-data-provider.js` - provider abstraction.
- `js/market/technical-analysis.js` - technical and momentum calculations.
- `js/market/fundamental-analysis.js` - fundamental scoring helpers.
- `js/market/sentiment-engine.js` - safe sentiment summary helpers.
- `js/market/scoring-engine.js` - TradeAlpha Score and safe setup labels.
- `js/market/seo-engine.js` - metadata helpers for static pages.
- `js/market/ui-renderer.js` - reusable rendering, detail pages, ETF sections, screener filters.
- `data/mock-market-data.json` - portable mock seed metadata.

## Data Flow

1. HTML page loads static CSS and `script.js`.
2. Page imports `js/market/ui-renderer.js` as an ES module.
3. `ui-renderer.js` requests assets from `market-data-provider.js`.
4. Provider returns mock assets from `mock-data.js`.
5. Scoring modules calculate technical, fundamental, momentum, sentiment, risk, and final score.
6. Renderer updates cards, detail pages, FAQ, related links, allocation bars, screener filters, and safe explanatory text.
7. `seo-engine.js` updates browser metadata where JavaScript can help.

## Provider Abstraction

The provider shape is intentionally small:

- `listAssets()`
- `getAsset(symbol)`

Future providers should keep this shape so the UI does not care whether data comes from mock data, Yahoo Finance, Alpha Vantage, Polygon.io, Finnhub, or a proprietary backend.

## Future API Integration

Real providers should not be connected directly from static browser JavaScript if API keys are private. Use one of these safer paths:

- Serverless function proxy with rate limiting.
- Backend market data service.
- Static scheduled build that fetches public data and emits JSON.
- Edge function with provider-key protection.

Provider integrations should normalize data into the same asset fields used by the mock universe:

- `symbol`
- `type`
- `name`
- `price`
- `changePercent`
- `sector`
- `industry`
- `rsi`
- `macdTrend`
- `ma50`
- `ma200`
- `volumeTrend`
- `sentiment`
- `risk`
- `volatility`
- ETF fields such as `expenseRatio`, `category`, `holdings`, `allocation`, and `issuer`

## Programmatic Scaling

The current static parameter model can support more symbols in the mock universe, but it is not ideal for SEO at scale.

Short-term scaling:

- Add new symbols to `js/market/mock-data.js`.
- Add related links for internal discovery.
- Add ETF allocation/holdings for ETF symbols.
- Keep using `stock.html?symbol=NVDA` and `etf.html?symbol=SPY`.

Medium-term scaling:

- Generate static HTML files for top symbols, such as `stocks/nvda.html` and `etfs/spy.html`.
- Generate sitemap entries for each pre-rendered symbol.
- Keep `stock.html?symbol=` as a fallback.

Long-term scaling:

- Migrate the portal portion to static generation or Next.js when the site needs thousands of indexable pages.
- Use canonical URLs such as `/stocks/nvda/` and `/etfs/spy/`.
- Pre-render title, description, FAQ schema, OpenGraph, and body content at build time.

## Phase 3 Static SEO Pages

Phase 3 added dedicated static priority pages without changing frameworks:

- `stocks/nvda.html`
- `stocks/aapl.html`
- `stocks/tsla.html`
- `etfs/spy.html`
- `etfs/qqq.html`

These pages keep JavaScript rendering for score widgets but include unique static titles, descriptions, canonicals, breadcrumbs, intros, internal links, and topic-specific sections.

## Phase 4 Static Generator

Phase 4 adds a Node-based static generation workflow:

- Config: `data/market-symbols.json`
- Generator: `tools/generate-market-pages.js`
- Validator: `tools/check-market-pages.js`
- Templates:
  - `templates/stock-page-template.html`
  - `templates/etf-page-template.html`
  - `templates/hub-page-template.html`
- Generated sitemap: `sitemap-market.xml`
- Clean redirects: `_redirects`

Generation command:

```powershell
npm.cmd run generate:market-pages
```

Validation command:

```powershell
npm.cmd run check:market-pages
```

The generator avoids overwriting manually customized pages unless the page contains a generator marker or the generator is run with `--force`.

To add a new symbol:

1. Add the symbol object to `data/market-symbols.json`.
2. Include `symbol`, `name`, `type`, `sector`, `priority`, `pagePath`, `relatedSymbols`, `seoTitle`, `seoDescription`, `faqSeeds`, and `contentAngle`.
3. Run `npm.cmd run generate:market-pages`.
4. Run `npm.cmd run check:market-pages`.
5. Test the generated page locally.

## Phase 5 Normalized Data Contract

Phase 5 added `js/market/market-normalizer.js`. All provider output should normalize into this shape before rendering or scoring:

- `symbol`
- `type`
- `name`
- `exchange`
- `sector`
- `industry`
- `issuer`
- `category`
- `price`
- `change`
- `changePercent`
- `marketCap`
- `peRatio`
- `revenueGrowth`
- `profitMargin`
- `rsi`
- `macdTrend`
- `ma50`
- `ma200`
- `volumeTrend`
- `sentiment`
- `risk`
- `volatility`
- `trendDirection`
- `heat`
- `analystSentiment`
- `earningsSentiment`
- `summary`
- `holdings`
- `allocation`
- `expenseRatio`
- `related`
- `contentAngles`

The normalizer supplies professional fallback values for missing fields and prevents `undefined`, `NaN`, broken metric cards, and missing screener fields.

## Mock-To-Real Provider Migration

Future real providers should map raw data into the normalized contract before calling scoring/rendering modules. Provider-specific inconsistencies should stay inside provider adapters, not leak into UI components.

## Phase 6 Serverless Data Architecture

Phase 6 adds a static-site-safe serverless architecture for future real data:

- Browser calls optional endpoint: `/.netlify/functions/market-data?symbol=NVDA&type=stock`
- Netlify Function validates symbol/type.
- Function selects provider server-side.
- Provider reads API keys from environment variables only.
- Provider returns normalized asset-like data.
- Function returns mock fallback if provider is unavailable.
- Frontend falls back to local mock data if the function is unavailable.

No API keys are exposed in frontend JavaScript.

Provider stubs:

- Alpha Vantage
- Finnhub
- Polygon
- Yahoo-compatible provider
- Mock provider

The frontend provider supports `window.TRADEALPHA_MARKET_PROVIDER = "serverless"` for future testing, but default behavior remains `mock`.

## Phase 7 Data Status Model

Phase 7 adds `js/market/data-status.js` with normalized statuses:

- `mock`
- `live`
- `stale`
- `fallback`
- `unavailable`

Each status contains:

- Label.
- Short description.
- Timestamp.
- Provider name.
- Confidence level.
- User-facing explanation.
- CSS class.
- Attribution.
- Cache TTL.

Serverless responses include metadata with provider, status, generated/updated timestamps, fallback/mock flags, cache TTL, attribution, and warnings. Frontend static mock data also receives status metadata.

## Hub Architecture

Topic hubs now support topical authority and internal linking:

- `semiconductor-stocks.html`
- `ai-stocks.html`
- `dividend-etfs.html`
- `growth-stocks.html`

Hub data lives in `js/market/content-templates.js` and renders curated asset lists through `initHubPage()`.

## Engagement Architecture

Recently viewed symbols are stored in browser `localStorage` under `ta_recent_symbols`. This is frontend-only, private to the browser, and does not require a backend.

## Multilingual Architecture Notes

Future multilingual SEO should use:

- `/en/`, `/ar/`, `/de/` URL groups or equivalent static folders.
- Language-specific titles and descriptions.
- `hreflang` tags between localized versions.
- Separate localized sitemap files or sitemap indexes.
- RTL-specific QA for Arabic pages.

Do not mix all languages on one canonical URL when targeting multilingual organic traffic at scale.

## Compliance Architecture

The scoring engine returns screening labels only:

- Strong Setup
- Neutral Setup
- Weak Setup
- Watchlist Candidate
- High Risk
- Overextended

The UI must not convert those labels into buy/sell/hold recommendations.

Every analysis page includes:

> This analysis is for educational and informational purposes only and does not constitute financial advice.

## Phase 8 Provider Health And Cache Simulation

Phase 8 adds `js/market/provider-health.js` and `netlify/functions/market-health.js`.

Provider health states:

- `healthy`
- `degraded`
- `unavailable`
- `mock-only`
- `unknown`

Each provider health object includes provider name, status, latency, last checked time, user-facing message, live-data support, server-key requirement, key configured yes/no, fallback availability, and cache TTL.

The health endpoint does not call paid APIs yet. It checks only server-side configuration availability and returns safe diagnostics without exposing secret values.

Cache/stale metadata contract:

- `cacheStatus`
- `staleAfterSeconds`
- `expiresAt`
- `servedFromCache`
- `cacheTtlSeconds`

The frontend data status renderer can now display mock, live, stale, fallback, and unavailable states with cache context. This prepares the UI for future real providers while keeping the mock fallback intact.

## Phase 9 Real Provider Integration — Finnhub

Phase 9 connects the first real market data provider (Finnhub) through the serverless proxy in safe hybrid mode.

### Provider selected: Finnhub

Finnhub was chosen for Phase 9 because it has a free tier (60 calls/minute), a clean REST API, and an existing key placeholder in `.env.example`. The integration remains modular: other providers can be added behind the same `getMarketData({ symbol, type, env })` shape.

### Live data flow

```
Frontend (browser)
  → /.netlify/functions/market-data?symbol=NVDA&type=stock
  → netlify/functions/market-data.js (validates symbol, selects provider)
  → netlify/functions/providers/finnhub.js
      → GET finnhub.io/api/v1/quote          (price, change, changePercent)
      → GET finnhub.io/api/v1/stock/profile2  (name, exchange, sector)
      → GET finnhub.io/api/v1/stock/metric    (P/E, RSI, beta, volume, growth)
  → normalizeServerAsset() → normalized asset
  → JSON response with metadata.status = "live"
  → Frontend renders with "Live market data — Finnhub" badge
```

### Fallback flow

```
Provider call fails (timeout / rate limit / invalid symbol / no key)
  → market-data.js catch block
  → providers.mock.getMarketData() — serverless mock fallback
  → JSON response with fallback: true, metadata.status = "fallback"
  → Warning in metadata.warning (rate-limit-specific or generic)
  → Frontend renders with "Provider fallback active" badge
```

If the Netlify Function itself is unavailable:

```
Frontend fetch fails
  → market-data-provider.js catch block
  → local mock data from js/market/mock-data.js
  → "Mock educational data" badge
```

### Normalization pipeline

All Finnhub API responses are mapped inside `finnhub.js` into the same normalized contract used by mock data, the renderer, the screener, and the scoring engine. Provider-specific inconsistencies (percentage values expressed as 0–100 vs 0–1, market cap in millions, etc.) are handled inside the provider adapter and never leak into UI components.

Technical indicators not directly available from Finnhub basic metrics are derived:

- `ma200` — derived from 52-week range midpoint.
- `ma50` — derived from relative position of current price to `ma200`.
- `macdTrend` — derived from RSI signal (>56 = bullish, <44 = bearish).
- `volumeTrend` — derived from 10-day vs 3-month average volume ratio.

### Provider safety

- `FINNHUB_API_KEY` is read from `process.env` only inside `netlify/functions/providers/finnhub.js`.
- Frontend JavaScript never contains or fetches the key.
- `AbortController` enforces a 5-second timeout per HTTP call.
- HTTP 429 throws `error.isRateLimit = true` for specific warning messaging.
- Module-level in-memory cache (Map, 55-second TTL) limits duplicate calls for the same symbol across warm function instances.
- Raw Finnhub errors are never forwarded to the frontend.

### New metadata fields in Phase 9

- `latencyMs` — provider response time in milliseconds.
- `stats.liveRequests`, `stats.fallbackRequests` — session counters.
- `stats.lastSuccessAt`, `stats.lastFallbackAt` — timestamps.
- `implementationStatus` per provider in health endpoint (`live`, `stub`, `fallback`).
- `finnhubIntegration` metadata block in health endpoint.

### Provider activation

Set in Netlify environment variables (never in committed files):

```
MARKET_DATA_PROVIDER=finnhub
FINNHUB_API_KEY=your-key
```

Default remains `MARKET_DATA_PROVIDER=mock` when no key is configured.

### Finnhub rate limits

Free tier: 60 API calls/minute. This provider uses 2–3 calls per stock request and 2 calls per ETF request (no metrics for ETFs). The in-memory cache reduces this to 0 calls for repeat requests within 55 seconds.
## Featured Content Architecture

- The CTR and engagement layer is implemented with existing static templates, `data/insight-topics.json`, `tools/generate-insights.js`, and `js/related-content.js`.
- Stock, ETF, and hub pages inherit social metadata from `templates/stock-page-template.html`, `templates/etf-page-template.html`, and `templates/hub-page-template.html`.
- Insight articles inherit article metadata, editorial hero fields, related symbol chips, topic tags, and Continue Reading sections from `templates/insight-template.html`.
- Homepage and insights index featured modules are static HTML using shared `market-portal.css` components for premium dark panels, gold accents, responsive grids, and glass-style cards.
- Internal-linking logic remains client-side and static. It uses the existing related-content graph and does not require a backend.
