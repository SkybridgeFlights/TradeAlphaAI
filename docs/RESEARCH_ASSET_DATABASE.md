# Research Asset Database

Central research assets live in:
- `data/research-assets/stocks/*.json`
- `data/research-assets/etfs/*.json`
- `data/research-assets/index.json`

Each asset includes:
- Symbol, name, type, sector/category, themes.
- English overview, business model or ETF methodology, why investors follow it, bull/bear factors, risks, valuation context.
- Arabic equivalents for descriptive fields.
- Related stocks, ETFs, insights.
- English and Arabic SEO fields.
- English and Arabic FAQ.

Use:
- `npm run research-assets:generate`
- `npm run research-assets:check`
- `npm run generate:market-pages -- --force`
- `npm run localize:generate`
