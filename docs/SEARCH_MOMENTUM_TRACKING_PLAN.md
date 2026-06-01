# Search Momentum Tracking Plan — Phase 20

**Platform:** TradeAlphaAI  
**Phase:** 20 — Search Momentum + Ranking Acceleration  
**Generated:** 2026-06-01  
**Review cadence:** Weekly for 30 days, then monthly

---

## Priority URLs to Inspect in Search Console

### Tier 1 — Highest Priority (monitor weekly)

| URL | Intent | Expected query pattern |
|-----|--------|----------------------|
| `/rankings.html` | Platform discovery | "top stock ETF rankings", "research watchlist" |
| `/compare/nvda-vs-amd.html` | Comparison search | "nvda vs amd", "nvidia vs amd chip comparison" |
| `/compare/spy-vs-qqq.html` | Comparison search | "spy vs qqq", "spy vs qqq difference" |
| `/compare/schd-vs-vig.html` | Dividend research | "schd vs vig", "best dividend etf comparison" |
| `/compare/spy-vs-voo.html` | ETF research | "spy vs voo", "vanguard vs blackrock s&p 500" |
| `/semiconductor-stocks.html` | Sector research | "semiconductor stocks", "AI chip stocks research" |
| `/dividend-etfs.html` | Income investing | "dividend ETFs", "best dividend ETF watchlist" |
| `/defensive-stocks.html` | Defensive investing | "defensive stocks", "low beta stocks research" |
| `/insights/defensive-investing-explained.html` | Market education | "defensive investing explained", "what is defensive investing" |
| `/insights/sector-rotation-explained.html` | Market education | "sector rotation explained", "how sector rotation works" |
| `/insights/etf-risk-comparison-guide.html` | Market education | "ETF risk comparison", "ETF beta volatility comparison" |
| `/insights/spy-vs-qqq-etf-comparison-guide.html` | Market education | "spy vs qqq guide", "SPY QQQ difference explained" |

### Tier 2 — Secondary Priority (monitor bi-weekly)

| URL | Intent |
|-----|--------|
| `/stocks/nvda.html` | Stock page traffic |
| `/stocks/aapl.html` | Stock page traffic |
| `/etfs/spy.html` | ETF page traffic |
| `/etfs/schd.html` | ETF page traffic |
| `/etfs/soxx.html` | ETF page traffic |
| `/defensive-etfs.html` | Hub traffic |
| `/healthcare-stocks.html` | Hub traffic |
| `/compare/ko-vs-pep.html` | Comparison traffic |
| `/compare/crwd-vs-panw.html` | Comparison traffic |
| `/ar/insights/defensive-investing-explained.html` | Arabic traffic |
| `/ar/insights/sector-rotation-explained.html` | Arabic traffic |

---

## Metrics to Watch

### In Search Console (Performance tab)

| Metric | What to watch for |
|--------|------------------|
| **Impressions** | Are pages being discovered? Rising impressions = Google is indexing and serving |
| **Clicks** | Actual visit traffic from organic search |
| **CTR** | Click-through rate: clicks ÷ impressions. Industry baseline: 2–5% for positions 5–15 |
| **Average Position** | Lower number = higher ranking. Target: reach page 1 (positions 1–10) for head terms |

### In Coverage / Indexing Report

| Status | What to do |
|--------|-----------|
| **Discovered — currently not indexed** | Add stronger internal links from hub pages; improve content depth |
| **Crawled — currently not indexed** | Improve content uniqueness; ensure page is not near-duplicate; strengthen topical authority |
| **Excluded — noindex** | Verify intentional; check robots meta tag |
| **Valid** | Monitor for drops; reinforce with internal links |

---

## 30-Day Weekly Action Plan

### Week 1 — Baseline

- [ ] Submit sitemap to Search Console: `https://www.tradealphaai.com/sitemap.xml`
- [ ] Request indexing for all Tier 1 URLs via Search Console URL Inspection tool
- [ ] Record baseline impressions and position for Tier 1 URLs
- [ ] Verify all Tier 1 URLs show "Valid" in Coverage report
- [ ] Check that AR versions of Tier 1 pages appear in international targeting section

### Week 2 — Discovery Check

- [ ] Review which Tier 1 URLs show impressions > 0
- [ ] Flag URLs with 0 impressions after 14 days → these need stronger internal links
- [ ] Check "Discovered — not indexed" list: add more inbound links from homepage or rankings
- [ ] Review which queries are triggering impressions — note branded vs non-branded split
- [ ] Check mobile usability: no issues expected (responsive CSS), but verify

### Week 3 — CTR Monitoring

- [ ] For any page with impressions > 10 but CTR < 1%, audit title and description
- [ ] Compare: title/description vs the query that triggered the impression
- [ ] For comparison pages (nvda-vs-amd, spy-vs-qqq): if avg position > 20, add more FAQ schema
- [ ] For hub pages (semiconductor-stocks, dividend-etfs): if impressions rising but position > 15, reinforce with 2–3 more internal links from high-PageRank pages

### Week 4 — Authority Reinforcement

- [ ] Identify pages moving from position 15–20 to position 8–15 → these are ready for reinforcement
- [ ] Add fresh outbound internal links from rankings.html and insights/index.html to rising pages
- [ ] Check AR (Arabic) indexing: verify all `/ar/insights/` pages appear in Coverage
- [ ] Document which comparison pages have received rich snippet display (FAQ boxes)
- [ ] Review top 5 performing pages and identify opportunities to add more depth or related comparisons

---

## Decision Rules

### If impressions but low CTR (< 1.5%)

**Diagnosis:** Title or description doesn't match search intent.

**Actions:**
1. Run the query in Google and look at competitor titles
2. Improve title to match user intent more directly
3. Make description more specific — include the ticker symbols, category, or topic
4. Avoid vague terms like "hub", "screener", "research platform" in isolation

**Example:** If `/dividend-etfs.html` shows for "best dividend ETF" but CTR is low:
- New title: "Dividend ETFs Research: SCHD, VIG & JEPI Comparison Watchlist"
- New desc: "Compare SCHD, VIG, and JEPI: yield, quality screens, expense ratios and rate sensitivity explained"

---

### If Discovered — Currently Not Indexed

**Diagnosis:** Google found the URL but decided not to index it. Usually: low perceived content quality, near-duplicate, or insufficient internal links.

**Actions:**
1. Add 3–5 more internal links from authoritative pages (rankings, hubs)
2. Verify the page has unique, substantial content (not just a widget + disclaimer)
3. Check: is there a stronger canonical page that Google is preferring?
4. If the page is an auto-generated stub: either improve it or remove the link from sitemaps

---

### If Crawled — Currently Not Indexed

**Diagnosis:** Google crawled the page but didn't index it. Usually content quality or duplication.

**Actions:**
1. Review page: does it have unique content beyond the template?
2. Add 1–2 paragraphs of unique educational text specific to that page's topic
3. Add FAQPage schema to signal Q&A structure
4. Verify the page is not near-duplicate of another page with different URL

---

### If Wrong Canonical

**Diagnosis:** Google is indexing the wrong URL (e.g., an `/en/` stub instead of the canonical).

**Actions:**
1. Verify `<link rel="canonical">` points to the correct URL
2. Check hreflang: `hreflang="x-default"` should point to the canonical
3. In Search Console > URL Inspection: check "Google-selected canonical" vs "User-declared canonical"
4. If Google disagrees: add more internal links pointing to the correct canonical; reduce links to the wrong one

---

### If AR Pages Not Indexed

**Diagnosis:** Arabic locale pages (ar/insights/, ar/compare/) not appearing in Search Console.

**Actions:**
1. Submit `sitemap-ar.xml` explicitly in Search Console
2. Check that AR pages have correct `<html lang="ar" dir="rtl">` attributes
3. Verify hreflang pairs are symmetric: EN page has `hreflang="ar"` pointing to AR, and AR page has `hreflang="en"` pointing to EN
4. Request indexing for top AR URLs via URL Inspection tool

---

## Key Risk Flags

| Risk | Signal | Action |
|------|--------|--------|
| Index dilution | Many similar pages not indexed | Consolidate thin stub pages; strengthen unique content |
| Ranking plateau | Position 8–12 with no movement for 2+ weeks | Add more unique content depth; improve internal linking |
| CTR decline | Impressions stable but clicks falling | Competitor title improvement; refresh meta description |
| Coverage regression | Previously indexed page drops to "not indexed" | Check for accidental noindex, broken canonical, or link loss |
| Hreflang mismatch | AR pages showing in EN results or vice versa | Audit hreflang on all pages with hreflang checker |

---

## Tools

- **Google Search Console** — primary monitoring dashboard
- **Google URL Inspection** — individual page crawl/index status
- **Sitemap files:** `sitemap.xml` (index), `sitemap-stocks.xml`, `sitemap-etfs.xml`, `sitemap-compare.xml`, `sitemap-insights.xml`, `sitemap-ar.xml`, `sitemap-market.xml`
- **Internal tools:** `npm run check:seo`, `npm run check:indexing`, `npm run check:production`

---

## Notes

- Phase 20 added FAQPage schema to 6 top comparison pages: nvda-vs-amd, spy-vs-qqq, schd-vs-vig, spy-vs-voo, ko-vs-pep, smh-vs-soxx. FAQ rich snippets may take 2–6 weeks to appear.
- Rankings page received JSON-LD schema (BreadcrumbList + WebPage + FAQPage) for the first time in Phase 20.
- 12 comparison pages received educational context link sections pointing to related insight articles.
- Priority hub page titles were improved for CTR in Phase 20: dividend-etfs, semiconductor-stocks, defensive-stocks, defensive-etfs, healthcare-etfs.
- All `check:seo`, `check:production`, `check:indexing` validations pass as of Phase 20 completion.
