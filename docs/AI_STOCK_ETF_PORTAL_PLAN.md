# TradeAlphaAI AI Stock & ETF Analysis Portal Plan

Last updated: 2026-05-19

## Current Project Audit

TradeAlphaAI is currently a static website. The existing site must remain static for this phase and must not be rewritten or migrated to React/Next.js.

Current top-level structure:

- `index.html` - primary landing page, Arabic-first (`lang="ar"`, `dir="rtl"`), with premium dark fintech layout.
- `styles.css` - older/global styling used by secondary content pages.
- `landing.css` - main landing-page design system with dark background, gold accents, cards, nav, responsive rules, and footer styling.
- `script.js` - shared interaction logic.
- `landing-i18n.js` - language layer for Arabic, English, and German. It updates `lang`, `dir`, page metadata, and `[data-copy]` content.
- `landing-live.js` - live/performance field logic for landing/performance sections.
- `landing-contact.js` - contact/CTA related frontend logic.
- `tadawul.html` - standalone SEO/content page using `styles.css` and its own older i18n attributes.
- `performance/tradealpha-ai.html` - static performance page reusing `landing.css`, `landing-i18n.js`, and the landing header/footer pattern.
- `articles/` - static article pages.
- `Image/` - image assets and OpenGraph image.
- `sitemap.xml`, `robots.txt`, `netlify.toml`, `.htaccess`, `.env.example`, `site-metadata.json` - SEO, deployment, hosting, and environment metadata.

Important observations:

- The strongest reusable UI pattern is the `index.html` / `performance/tradealpha-ai.html` structure with `landing.css`.
- The existing navigation is a horizontal `.nav-group` inside `.topbar`.
- The active multilingual implementation is `landing-i18n.js`, using `data-copy` keys and `localStorage` key `ta_lang`.
- The site currently supports Arabic RTL and English/German LTR on the main landing/performance pages.
- Static SEO is already present through titles, descriptions, canonicals, OpenGraph tags, Twitter tags, JSON-LD, sitemap, and robots.
- `sitemap.xml` currently lists the home page, `tadawul.html`, and article pages, but not the performance page.
- `robots.txt` allows all crawling and references the sitemap. No immediate robots change is required for the portal.
- `netlify.toml` publishes the repo root and currently treats static assets with long cache headers.
- `.env.example` contains placeholder values only. Any market data provider keys must be placeholders only.
- Some existing Arabic text appears mojibake in file content, while runtime language replacement likely mitigates this on pages using `landing-i18n.js`. New portal content should be saved cleanly as UTF-8 and use the existing i18n pattern where practical.

## Product Goal

Build a free AI Stock & ETF Analysis Portal inside the existing static TradeAlphaAI website to attract organic search traffic, educate visitors, and create a conversion path into the TradeAlphaAI ecosystem.

The portal must use educational and screener language only. It must not provide financial advice, buy/sell recommendations, guaranteed predictions, or profit claims.

Required disclaimer:

> This analysis is for educational and informational purposes only and does not constitute financial advice.

## Compliance Language Rules

Use:

- AI analysis
- educational purposes
- stock screening
- ETF screening
- technical score
- fundamental score
- risk overview
- watchlist candidate

Avoid:

- guaranteed profit
- buy now
- sell now
- sure signal
- financial advice
- guaranteed prediction

Allowed labels:

- Strong Setup
- Neutral Setup
- Weak Setup
- High Risk
- Overextended
- Watchlist Candidate

Disallowed labels:

- Buy
- Sell
- Hold as a recommendation
- Guaranteed winner
- Profit signal

## Proposed Static Architecture

Use the current static structure and add clearly separated portal files.

Planned files:

- `stocks.html` - stock analyzer landing page.
- `stock.html` - individual stock analysis page driven by `?symbol=`.
- `etfs.html` - ETF analyzer landing page.
- `etf.html` - individual ETF analysis page driven by `?symbol=`.
- `ai-stock-screener.html` - free screener page for stock/ETF screening.
- `css/market-portal.css` - portal-specific styling layered on the existing visual identity.
- `js/market-data.js` - data provider abstraction and mock fallback selection.
- `js/technical-analysis.js` - RSI, MACD, moving average, Bollinger Band, volume trend, and trend calculations.
- `js/fundamental-analysis.js` - fundamental metric normalization and score helpers.
- `js/sentiment-analysis.js` - safe rule-based sentiment/news summary helpers.
- `js/scoring-engine.js` - transparent TradeAlpha Score calculation and labels.
- `js/seo-content.js` - dynamic title/meta/canonical/OpenGraph helpers and non-thin content generation.
- `data/mock-market-data.json` - clean mock data for popular stocks and ETFs.

This structure keeps the market portal separate from the current landing page and avoids changing the core site architecture.

## Data Provider Plan

Phase 1 will use mock data by default. `js/market-data.js` should expose a provider interface that can later connect to:

- Yahoo Finance
- Alpha Vantage
- Polygon.io
- Finnhub

Initial behavior:

- If no API key/provider config is present, load `data/mock-market-data.json`.
- Keep provider-specific code isolated behind a common function shape.
- Add TODO comments only where real provider integration belongs.
- Add placeholder env keys to `.env.example` in a later implementation step.

Potential `.env.example` additions:

- `ALPHA_VANTAGE_API_KEY=your-alpha-vantage-key`
- `POLYGON_API_KEY=your-polygon-key`
- `FINNHUB_API_KEY=your-finnhub-key`
- `MARKET_DATA_PROVIDER=mock`

## Page Plan

### `stocks.html`

Purpose:

- Target AI stock analyzer and stock screening search intent.
- Provide a ticker search box.
- Show popular stocks: AAPL, NVDA, TSLA, MSFT, AMZN, META, GOOGL.
- Link to `stock.html?symbol=SYMBOL`.
- Include CTA sections for TradeAlphaAI system, AI market alerts, watchlist placeholder, and premium signals placeholder.

### `etfs.html`

Purpose:

- Target AI ETF analyzer and ETF screening search intent.
- Provide ETF search.
- Show popular ETFs: SPY, QQQ, VTI, VOO, IWM, GLD, TLT.
- Link to `etf.html?symbol=SYMBOL`.
- Include conversion CTAs and educational disclaimer.

### `stock.html`

Purpose:

- Render individual stock analysis based on `?symbol=`.
- Show symbol, name, current price, daily change, market cap, sector, industry, score, indicators, fundamentals, sentiment summary, AI-style explanation, risk warnings, related assets, FAQ, and disclaimer.
- Use dynamic metadata where JavaScript can update it, while documenting static SEO limitations.

### `etf.html`

Purpose:

- Render individual ETF analysis based on `?symbol=`.
- Show symbol, fund name, current price, daily change, category/asset class, holdings or exposure where mock data supports it, score, technical setup, risk overview, FAQ, related ETFs, CTA, and disclaimer.

### `ai-stock-screener.html`

Purpose:

- Provide a static frontend screener over mock data.
- Filter/sort by asset type, score, risk label, sector/category, momentum, and setup label.
- Use watchlist candidate language only.

## Scoring Model

The TradeAlpha Score should be transparent and rule-based:

- Technical Score
- Fundamental Score
- Momentum Score
- Sentiment Score
- Risk Score
- Final Score out of 100

Suggested weighting for phase 1:

- Technical: 30%
- Fundamental: 25%
- Momentum: 20%
- Sentiment: 10%
- Risk: 15%

Risk should reduce or temper final labeling. A high technical score with high risk may become `Overextended` or `High Risk`, not an aggressive recommendation.

## Technical Indicators

Implement rule-based calculations where mock historical price data is available:

- RSI
- MACD
- MA50
- MA200
- Bollinger Bands
- Volume trend
- Trend direction

If data is incomplete:

- Show a clear unavailable/fallback state.
- Avoid fabricating precision.
- Explain that mock data is used for educational interface demonstration until a provider is connected.

## AI Explanation Layer

The first version should be deterministic and rule-based, not generative AI. It should explain:

- Why the score is high or low.
- Technical setup.
- Fundamental strengths/weaknesses.
- Risk factors.
- Sentiment overview.

It must not tell users to buy, sell, hold, or act.

## SEO Plan

Static SEO now:

- Add unique static titles/descriptions for `stocks.html`, `etfs.html`, and `ai-stock-screener.html`.
- Add base metadata for `stock.html` and `etf.html`, then update ticker-specific metadata with JavaScript.
- Add OpenGraph and Twitter tags where practical.
- Add canonical tags.
- Add FAQ sections and FAQ JSON-LD.
- Add internal links between stock, ETF, screener, home, and product CTA pages.
- Update `sitemap.xml` with new static entry pages.
- Add the performance page to the sitemap if still missing during sitemap update.
- Keep `robots.txt` unchanged unless new crawl restrictions are needed.

Static SEO limitations:

- `stock.html?symbol=NVDA` and `etf.html?symbol=SPY` can be useful to users, but Google may not index parameterized JavaScript-rendered pages as strongly as dedicated pre-rendered static pages.
- Dynamic JS metadata may not be treated as strongly as server-rendered metadata.
- A future Next.js or static-generation migration would improve ticker-level indexing by producing canonical URLs such as `/stocks/nvda/` and `/etfs/spy/`.

## Navigation Plan

Add links to the existing navigation without breaking Arabic layout:

- AI Stock Analyzer -> `stocks.html`
- ETF Analyzer -> `etfs.html`
- Market Screener -> `ai-stock-screener.html`

Implementation note:

- Update `index.html` and `performance/tradealpha-ai.html` navs carefully.
- Add `landing-i18n.js` translation keys for new navigation labels in Arabic, English, and German.
- If market pages get their own header, reuse the same `.topbar`, `.brand`, `.nav-group`, language switch pattern.

## UI/UX Plan

Use the TradeAlphaAI identity:

- Dark premium fintech style.
- Gold accents.
- Clean cards.
- Score card or gauge-like score panel.
- Chart placeholder area.
- Indicator cards.
- Risk badges.
- Mobile responsive layouts.
- Fast static loading.
- RTL-compatible spacing and text alignment.

Avoid:

- Heavy framework dependencies.
- Landing-page rewrite.
- Nested decorative cards.
- Buy/sell-style labels.
- Thin duplicate pages.

## Documentation Plan

Create and maintain:

- `docs/AI_STOCK_ETF_PORTAL_PLAN.md` - active implementation plan and progress log.
- `docs/AI_STOCK_ETF_PORTAL_ARCHITECTURE.md` - module/data/provider architecture.
- `docs/AI_STOCK_ETF_PORTAL_SEO.md` - SEO implementation, limitations, migration notes.
- `docs/AI_STOCK_ETF_PORTAL_ENV.md` - env placeholders and provider setup notes.

## Incremental Implementation Steps

1. Audit existing static project and create this plan.
2. Create architecture, SEO, and environment docs.
3. Add portal folders/files with mock data and JavaScript modules.
4. Build `stocks.html`, `etfs.html`, and `ai-stock-screener.html`.
5. Build `stock.html` and `etf.html` detail pages.
6. Add portal CSS and responsive/RTL support.
7. Add navigation links and i18n keys.
8. Update `.env.example` placeholders.
9. Update `sitemap.xml` and verify `robots.txt`.
10. Test locally by opening static pages or using a lightweight static server if needed.
11. Document deployment steps, SEO checklist, and remaining TODOs.

## Files Expected To Change In Later Steps

No feature code has been changed yet. Later implementation steps are expected to change or add:

- `index.html` - add market portal navigation links.
- `performance/tradealpha-ai.html` - add market portal navigation links if consistent with site nav.
- `landing-i18n.js` - add nav label translations for new portal links.
- `.env.example` - add placeholder-only market data provider keys.
- `sitemap.xml` - add new static portal pages.
- `netlify.toml` - possibly add clean redirects if needed for static hosting.
- New portal HTML/CSS/JS/data/docs files listed above.

## Progress Log

- 2026-05-19: Completed project structure audit.
- 2026-05-19: Confirmed static-site constraint and no React/Next.js migration for this phase.
- 2026-05-19: Created initial implementation plan in `docs/AI_STOCK_ETF_PORTAL_PLAN.md`.
- 2026-05-19: Phase 1 foundation implemented with `js/market/` modules, `css/market/market-portal.css`, `stocks.html`, `stock.html`, mock market data, navigation links, and sitemap entries.
- 2026-05-19: First working stock analyzer supports mock symbols including `NVDA` and `AAPL`, with educational-only TradeAlpha Score output and safe labels.
- 2026-05-19: Static SEO improved for the new stock portal pages with titles, descriptions, canonical tags, OpenGraph tags, FAQ content, and sitemap entries.
- 2026-05-19: Phase 2 ETF system implemented with `etfs.html` and `etf.html`, supporting SPY, QQQ, VTI, VOO, and GLD through expanded mock ETF data.
- 2026-05-19: Phase 2 market screener implemented with searchable/filterable/sortable stock and ETF screening by score, momentum, risk, sector, and sentiment.
- 2026-05-19: Added architecture and SEO documentation for provider scaling, programmatic SEO, static limitations, and future static-generation/Next.js migration.
- 2026-05-19: Phase 3 added dedicated static symbol pages for NVDA, AAPL, TSLA, SPY, and QQQ.
- 2026-05-19: Phase 3 added market hub pages for semiconductor stocks, AI stocks, dividend ETFs, and growth stocks.
- 2026-05-19: Phase 3 added `methodology.html`, reusable content templates, recently viewed symbols, and environment strategy documentation.
- 2026-05-19: Phase 4 added Node static generation workflow, market symbol config, templates, validation script, generated market sitemap, and clean URL redirects.
- 2026-05-19: Phase 5 completed mock data coverage for all configured stocks and ETFs, added normalized asset contract, schema generation, and hardened validation.
- 2026-05-19: Phase 6 added production readiness audit, Netlify serverless provider stubs, frontend serverless fallback adapter, caching notes, and production validation script.
- 2026-05-19: Phase 7 added visible data status model, badges, diagnostics page, provider metadata contract, and production checks for status hooks.
- 2026-05-19: Phase 8 added provider health modeling, a serverless health endpoint, diagnostics table, cache/stale metadata simulation, and production checks for health diagnostics.

## Current Status

Phase 8 is complete for provider health checks, cache/stale simulation, and diagnostics hardening.

Completed Phase 1 items:

- Created reusable market data provider abstraction with mock fallback.
- Created modular technical, fundamental, sentiment, scoring, SEO, and UI rendering modules.
- Created professional dark/gold market portal CSS foundation.
- Created `stocks.html` and `stock.html`.
- Added mock data for NVDA, AAPL, TSLA, MSFT, AMZN, META, SPY, and QQQ.
- Added safe navigation links to the stock analyzer and ETF placeholder.
- Added sitemap entries for the first stock portal pages.
- Added the required educational/non-advice disclaimer to market pages.

Completed Phase 2 items:

- Created `etfs.html`.
- Created `etf.html`.
- Created `ai-stock-screener.html`.
- Expanded mock market data with VTI, VOO, GLD, ETF holdings, allocation, expense ratios, volatility, trend direction, market session, analyst sentiment, and earnings sentiment fields.
- Added ETF overview, holdings, sector exposure, volatility, AI ETF summary, technical analysis, risk analysis, related ETFs, FAQ, and CTA sections.
- Added screener filters for score, risk, sector, sentiment, and sorting by score, momentum, risk, and symbol.
- Added premium UX elements: heat badges, trend arrows, mini chart placeholders, trust strip, allocation bars, animated score bars, and grid/table screener layout.
- Added stronger internal links between stocks, ETFs, screener, related symbols, educational sections, and TradeAlphaAI CTAs.
- Updated sitemap with ETF and screener static entry pages.
- Created `docs/AI_STOCK_ETF_PORTAL_ARCHITECTURE.md`.
- Created `docs/AI_STOCK_ETF_PORTAL_SEO.md`.

Completed Phase 3 items:

- Created dedicated static symbol pages under `stocks/` and `etfs/`.
- Created reusable content templates in `js/market/content-templates.js`.
- Added market hub pages for topical authority.
- Added `methodology.html` explaining TradeAlpha Score.
- Added frontend-only recently viewed symbols through localStorage.
- Added breadcrumbs and stronger internal links.
- Expanded sitemap with symbol pages, hub pages, and methodology page.
- Created `docs/AI_STOCK_ETF_PORTAL_ENV.md`.
- Updated architecture and SEO docs with multilingual/hreflang and future static-generation guidance.

Completed Phase 4 items:

- Created `data/market-symbols.json` with scalable stock, ETF, and hub configuration.
- Created reusable stock, ETF, and hub templates.
- Created `tools/generate-market-pages.js`.
- Created `tools/check-market-pages.js`.
- Created minimal `package.json` scripts.
- Generated `sitemap-market.xml`.
- Created `_redirects` for future clean URL paths.
- Updated `.env.example` with placeholder-only provider keys and frontend safety comments.
- Documented generation, validation, sitemap, and future provider workflow.

Completed Phase 5 items:

- Added `js/market/market-normalizer.js`.
- Completed mock data coverage for all configured stocks and ETFs.
- Normalized provider returns before rendering/scoring.
- Added symbol-specific content template coverage for all configured symbols.
- Added generated FAQ schema and breadcrumb schema to generated templates.
- Added dynamic FAQ and breadcrumb schema injection for parameterized pages.
- Hardened `tools/check-market-pages.js` for SEO, schema, disclaimer, sitemap, undefined/NaN, and forbidden wording checks.
- Regenerated all configured market pages with schema-compatible templates.

Completed Phase 6 items:

- Created `docs/AI_STOCK_ETF_PORTAL_PRODUCTION_AUDIT.md`.
- Created `netlify/functions/market-data.js`.
- Created serverless provider stubs for mock, Alpha Vantage, Finnhub, Polygon, and Yahoo-compatible providers.
- Added optional frontend serverless provider adapter with static mock fallback.
- Added `tools/check-production-readiness.js`.
- Added `npm.cmd run check:production`.
- Updated environment and architecture docs with serverless, security, caching, and local testing guidance.

Completed Phase 7 items:

- Created `js/market/data-status.js`.
- Created `market-data-status.html`.
- Added serverless response metadata fields.
- Added frontend data status badge rendering.
- Added status hooks to templates and market pages.
- Regenerated all configured market pages.
- Updated production checker to require data status files/hooks and serverless metadata.

Completed Phase 8 items:

- Created `js/market/provider-health.js`.
- Created `netlify/functions/market-health.js`.
- Added provider health diagnostics to `market-data-status.html`.
- Added refresh diagnostics action for serverless endpoint checks.
- Added cache/stale metadata fields to data status and serverless responses.
- Updated market portal CSS for responsive provider health tables and status badges.
- Hardened `tools/check-production-readiness.js` for health diagnostics and cache metadata.
- Updated architecture, environment, and production audit documentation.

Completed Phase 9 items:

- Replaced `netlify/functions/providers/finnhub.js` stub with full real implementation.
  - Fetches `/quote`, `/stock/profile2`, `/stock/metric` from Finnhub REST API.
  - 5-second timeout via AbortController.
  - Rate-limit detection (HTTP 429 → `error.isRateLimit = true`).
  - Module-level in-memory cache (55-second TTL, Map) to limit duplicate calls.
  - Derives MA50/MA200 from 52-week range, MACD from RSI, volume trend from 10d vs 3m averages.
  - Returns `dataMode: "live"` on success, full normalized contract.
- Updated `netlify/functions/market-data.js` with latency tracking (`latencyMs`), session stats (`_stats`), rate-limit-specific warning, improved attribution for Finnhub.
- Updated `netlify/functions/market-health.js` with `implementationStatus` per provider, `finnhubIntegration` metadata block, Finnhub health message distinguishing live vs stub.
- Updated `js/market/data-status.js` with `latencyMs`, `providerDisplayName`, provider-qualified live badge labels (e.g., "Live market data — Finnhub").
- Updated `js/market/ui-renderer.js` diagnostics with `data-provider-metrics` renderer, `data-provider-warning` renderer, `implementationStatus` badges in health table, Finnhub integration note.
- Updated `market-data-status.html` with Phase 9 diagnostics sections: metrics panel, warning banner, rate limit notes, integration status panel.
- Updated `tools/check-production-readiness.js` with Phase 9 Finnhub integration checks and smoke test instructions.
- Updated `.env.example` with Finnhub activation instructions and rate limit documentation.
- Updated all four architecture/env/audit/plan documentation files.

Remaining tasks:

- Add richer multilingual content for the market pages.
- Consider future static generation or Next.js migration for stronger ticker-level SEO.
- Add cross-instance cache (Netlify Edge KV or Redis) for production-scale Finnhub caching.
- Implement Alpha Vantage, Polygon, Yahoo-compatible provider stubs (Phase 10+).
- Add multi-provider failover strategy (try Finnhub → Alpha Vantage → mock) in Phase 10+.
- Connect real edge cache TTLs to the simulated cache metadata fields.
## CTR, Discover, and Engagement Layer

- Social metadata is standardized through the static templates for stock pages, ETF pages, hub pages, insight articles, the homepage, and the insights index.
- All page types use the existing `/Image/og-image.svg` as a durable placeholder so OG/Twitter previews never break when custom article images are unavailable.
- Featured content remains intentionally limited: the homepage receives one featured insights area, one AI research spotlight, one ETF education spotlight, and one screener/theme CTA.
- Engagement sections prioritize editorial pathways such as Continue Reading, Popular Research, Explore This Theme, related AI infrastructure research, related ETF education, and macro/risk research.
- The approach is incremental and static-site safe: no framework migration, backend, personalization store, subscriptions, or new dependency layer.
