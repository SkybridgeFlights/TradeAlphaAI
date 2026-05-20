# Arabic Localization Audit

Date: 2026-05-20

## Scope

Reviewed the static English and Arabic localization architecture for:

- Homepage and core market pages
- Insights index and published insight articles
- Market hubs
- Configured stock pages
- Configured ETF pages
- Screener, methodology, and market data status pages

## Findings

- Arabic coverage was partial. Only the homepage, methodology, insights index, three articles, four hubs, three stocks, and three ETFs had Arabic equivalents.
- Arabic navigation was not fully localized. Some Arabic pages linked to English routes such as `/stocks.html`, `/etfs.html`, and `/ai-stock-screener.html`.
- Arabic pages could load English-only dynamic related-content/research-layer text through client-side components.
- The Arabic insights index did not list every localized published insight article.
- Some generated Arabic titles used weak hybrid wording because they were derived from English titles without a controlled terminology layer.
- English `/en/` alias pages could inherit Arabic body copy from the shared localization config.
- Hreflang coverage existed for the first localization batch but did not cover all public stock, ETF, hub, core, and published insight pages.
- Validation did not yet enforce full Arabic route coverage or language isolation across all localized pages.

## Fix Strategy

- Keep English as the primary market version and generate Arabic pages under `/ar/`.
- Expand Arabic coverage gradually through controlled static generation, not browser translation.
- Add a reusable Arabic terminology map for finance labels and disclaimers.
- Generate Arabic pages for all currently configured public stocks, ETFs, hubs, core pages, and published insights.
- Generate language-router mappings from localization data so equivalent language switching stays synchronized.
- Render Arabic related links statically to prevent English text injection from English-only dynamic components.
- Keep Arabic pages RTL and English aliases LTR.
- Strengthen production checks for Arabic nav, hreflang, sitemap, route coverage, internal links, and review draft exclusion.

## Current Arabic Coverage

- Core: homepage, stocks, ETFs, screener, market data status, methodology, insights index.
- Hubs: AI stocks, semiconductor stocks, growth stocks, dividend ETFs.
- Stocks: all configured stock pages.
- ETFs: all configured ETF pages.
- Insights: all published insight article pages in `/insights/`, excluding index and noindex drafts.

## Remaining Manual Review Needs

- Some article body pages use concise professional Arabic summaries rather than full human editorial translations of every English paragraph.
- Analyzer pages have Arabic static landing content and route parity, while the detailed interactive analyzer UI remains primarily implemented in the English tool pages.
- Arabic finance copy should be reviewed periodically by a native finance editor before large-scale expansion.
