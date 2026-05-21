# TradeAlphaAI Platform Architecture

TradeAlphaAI remains a static-compatible financial research site. English pages are the source of truth, and Arabic pages are generated as same-structure localized equivalents with RTL rendering.

Core layers:
- Static HTML pages and generated stock/ETF/insight pages.
- `tools/generate-localized-pages.js` for English/Arabic parity, hreflang, canonical, metadata, schema, nav, mobile nav, and search script injection.
- `data/research-assets/**` for the central stock/ETF research database.
- `data/search-index.json` for static autocomplete/search.
- `js/market/*` for frontend-only analyzers, scoring, screener, and mock/provider-safe market data.

No runtime browser AI translation is used. No private API keys are exposed. Live provider integration remains behind serverless functions only.
