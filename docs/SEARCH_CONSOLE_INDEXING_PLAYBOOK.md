# Search Console Indexing Playbook

TradeAlphaAI — SEO Operations Reference

---

## 1. Which Sitemap to Submit

Submit the sitemap index to Google Search Console:

```
https://www.tradealphaai.com/sitemap.xml
```

This is the only URL you need to submit. It is a `<sitemapindex>` file that references all seven sub-sitemaps. Google will crawl and process each child sitemap automatically.

Do **not** submit individual split sitemaps to Search Console separately. They appear in `robots.txt` for crawler discovery, which is fine, but the Console submission should always be the index.

---

## 2. What sitemap.xml Includes

| Child Sitemap | Coverage | URL Count (approx) |
|---|---|---|
| `sitemap-core.xml` | Homepage, hub pages, screener, rankings, methodology | ~18 |
| `sitemap-stocks.xml` | 75 individual stock detail pages | 75 |
| `sitemap-etfs.xml` | 45 individual ETF detail pages | 45 |
| `sitemap-compare.xml` | 45 EN comparison pages (`/compare/*.html`) | 45 |
| `sitemap-insights.xml` | Insights index + published article pages | ~31 |
| `sitemap-ar.xml` | All Arabic locale pages (`/ar/**`) | ~213 |
| `sitemap-market.xml` | Hub/screener/compare compatibility URLs | ~211 |

**Total indexed URL entries:** approximately 427 (verified by `npm run check:seo`).

---

## 3. Search Console Setup Steps

### Step 1 — Add Property

Add the domain property:
- Property type: **Domain** (not URL prefix)
- Domain: `tradealphaai.com`

Domain properties cover `www`, non-www, HTTP, HTTPS, and all subdomains in one view.

### Step 2 — Verify Domain

Use DNS verification:
1. Copy the TXT record provided by Search Console
2. Add it to your domain DNS as a TXT record on the root domain
3. Click **Verify**

If DNS TXT is not available, use the URL prefix property for `https://www.tradealphaai.com/` with HTML tag verification.

### Step 3 — Submit Sitemap Index

1. Go to **Sitemaps** in the Search Console left menu
2. Enter: `sitemap.xml`
3. Click **Submit**
4. Wait 24–48 hours for Google to begin processing

### Step 4 — Monitor Indexed Pages

After 48 hours, check:
- **Sitemaps** panel: submitted URLs vs. discovered URLs vs. indexed URLs
- Target: indexed count should be trending toward 400+ over 2–4 weeks

### Step 5 — Inspect High-Value URLs

Use the **URL Inspection** tool on:
- `https://www.tradealphaai.com/` — homepage
- `https://www.tradealphaai.com/stocks/nvda.html` — top stock
- `https://www.tradealphaai.com/compare/nvda-vs-amd.html` — top comparison
- `https://www.tradealphaai.com/ar/` — Arabic homepage

Check each for: canonical, hreflang, rendered HTML, structured data.

### Step 6 — Request Manual Indexing for Priority URLs Only

Use the **Request Indexing** button (via URL Inspection) for selected high-priority pages. Do not mass-request indexing for hundreds of URLs — Google's quota is limited and it does not speed up the normal crawl significantly.

---

## 4. Initial Priority URLs for Manual Inspection

Request indexing only for these URLs in the first week:

| URL | Why |
|---|---|
| `https://www.tradealphaai.com/` | Homepage — highest authority |
| `https://www.tradealphaai.com/stocks.html` | Main stock hub |
| `https://www.tradealphaai.com/etfs.html` | Main ETF hub |
| `https://www.tradealphaai.com/rankings.html` | Rankings / top picks |
| `https://www.tradealphaai.com/insights/` | Insights index |
| `https://www.tradealphaai.com/compare/nvda-vs-amd.html` | High-intent comparison |
| `https://www.tradealphaai.com/compare/spy-vs-qqq.html` | High-intent comparison |
| `https://www.tradealphaai.com/stocks/nvda.html` | Highest-traffic stock |
| `https://www.tradealphaai.com/stocks/aapl.html` | High-traffic stock |
| `https://www.tradealphaai.com/etfs/spy.html` | Highest-traffic ETF |
| `https://www.tradealphaai.com/ar/` | Arabic homepage |
| `https://www.tradealphaai.com/ar/stocks.html` | Arabic stock hub |
| `https://www.tradealphaai.com/ar/rankings.html` | Arabic rankings |

Let the remaining 400+ pages be discovered organically through the sitemap index and internal links.

---

## 5. What NOT to Do

- **Do not** request manual indexing for hundreds of URLs. The quota is ~10/day for most new properties. Let the sitemap do the work.
- **Do not** submit individual split sitemaps (`sitemap-stocks.xml`, etc.) separately to Search Console unless you need to debug a specific sub-index.
- **Do not** use fake `<lastmod>` dates or repeatedly update sitemaps to signal "freshness" for static pages that have not changed.
- **Do not** create thin pages to inflate URL count. Every page must have substantive educational content.
- **Do not** block `/api/`, `/js/`, `/css/`, or any asset route in `robots.txt`. Google's renderer needs JavaScript and CSS to evaluate page experience.
- **Do not** add `noindex` to published pages. The production check (`npm run check:production`) guards against this.
- **Do not** disallow the `/compare/`, `/stocks/`, `/etfs/`, `/ar/`, or `/insights/` paths in `robots.txt`. All are currently wide open via `Allow: /`.

---

## 6. Weekly Monitoring Checklist

Check these in Search Console every week after launch:

| Signal | Where | Action If Bad |
|---|---|---|
| **Total indexed pages** | Coverage report | Add internal links if below 70% of submitted |
| **Discovered, not indexed** | Coverage > Excluded | Strengthen internal linking to those URLs |
| **Duplicate without user-selected canonical** | Coverage > Excluded | Inspect canonical tag on the affected page |
| **Alternate page with proper canonical** | Coverage > Excluded | This is expected for `/en/` and `/ar/` aliases — not a bug |
| **Crawled, not indexed** | Coverage > Excluded | Improve content uniqueness and depth |
| **Crawl stats — response time spike** | Settings > Crawl stats | Check Vercel function performance |
| **Core Web Vitals** | Experience report | Check LCP / CLS on Vercel |
| **Enhancement warnings** | Rich results / Schema | Fix any JSON-LD errors flagged |

---

## 7. Decision Rules

### Page is "Discovered, not indexed"
The page was found via sitemap or crawl but Google chose not to index it.
- Check: does it have enough unique, substantive content?
- Check: does it have inbound links from other indexed pages?
- Fix: add more internal links from hub pages, rankings, or insights to the affected page.

### Page shows "Duplicate without user-selected canonical"
Google found another URL that appears nearly identical.
- Check: is there a `<link rel="canonical">` tag on the page?
- Check: are `/en/` and root paths serving the same content? (Expected — canonical points to root.)
- Fix: verify canonical tag is present and points to the correct URL.

### Page shows "Crawled, not indexed"
Google crawled but decided the content was not useful enough to index.
- Check: does the page have a unique title, description, and at least 200 words of body content?
- Check: is the page linked from at least 3 internal pages?
- Fix: improve content depth on the specific page; link to it from at least one hub page.

### API fallback appears in Google's cache or rendering
The live Finnhub data was not available when Googlebot rendered the page.
- Check: `npm run check:seo` and inspect Vercel function logs.
- Fix: the page renders educational static content regardless of live data, so this is not a blocking issue. The score, sector, and descriptive content remain static even without live prices.

---

## 8. Sitemap Regeneration

When to regenerate sitemaps:

| Trigger | Command |
|---|---|
| New stock or ETF pages added | `npm run generate:market-pages` then `npm run generate:seo-sitemaps` |
| New insights published | `npm run insights:generate` (sitemaps regenerated automatically) |
| New compare pairs added | `npm run generate:comparisons` then `npm run generate:seo-sitemaps` |
| New hub pages added | Update `data/market-symbols.json`, then `npm run localize:generate` |

Always run `npm run check:seo` and `npm run check:production` after regeneration. Do not submit updated sitemaps to Search Console manually — Google re-crawls the sitemap index automatically.

---

## 9. Current robots.txt Status

The `robots.txt` file is correctly configured:

```
User-agent: *
Allow: /

Sitemap: https://www.tradealphaai.com/sitemap.xml
Sitemap: https://www.tradealphaai.com/sitemap-core.xml
...
```

The individual sitemap lines are redundant (since `sitemap.xml` is the index) but harmless. They give crawlers direct discovery paths without parsing the index first. No action required.

**Paths that must remain unblocked** (currently all open):
- `/api/` — Vercel function endpoint for live prices
- `/js/` — all frontend modules
- `/css/` — styles (needed for CWV)
- `/stocks/`, `/etfs/`, `/compare/`, `/ar/`, `/insights/`, `/en/`

---

## 10. Validation Commands

Before any deployment or after content changes:

```bash
npm run check:utf8       # Validates all 438+ files for encoding corruption
npm run check:production # Full production readiness: secrets, disclaimers, sitemaps, robots
npm run check:seo        # Sitemap coverage, canonical/hreflang, compare structure, authority mesh
npm run check:indexing   # Lightweight indexing readiness: sitemaps, robots, query routes
```

All four checks must pass before pushing to production.
