# Content Quality Audit — Phase 21

**Platform:** TradeAlphaAI  
**Phase:** 21 — Content Quality Consolidation  
**Generated:** 2026-06-01  
**Scope:** All indexed insight pages (insights/*.html) — 42 pages audited (excluding index.html)

---

## Summary

| Category | Count |
|----------|-------|
| KEEP (strong, no action needed) | 22 |
| IMPROVE (high-value, needs depth/signals) | 7 |
| NOINDEX (already done) | 8 |
| NOINDEX + REMOVE_FROM_SITEMAP (template-style or duplicate, still indexed) | 5 |

Total audited: 42

---

## NOINDEX — Already Done (8 pages)

These pages already have `content="noindex,nofollow"` in the robots meta tag. No action needed.

| Page | Reason |
|------|--------|
| insights/gpu-market-research-accelerator-competition-across-ai-workloads.html | Template stub; thin; GPU cluster with narrower scope |
| insights/gpu-market-research-gpu-market-share-and-product-cycle-research.html | Template stub; thin |
| insights/gpu-market-research-gpu-supply-and-demand-signals.html | Template stub; thin |
| insights/ai-infrastructure-research-ai-inference-demand-and-capacity-planning.html | Template stub; thin; redundant with ai-infrastructure cluster |
| insights/ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand.html | Template stub; thin |
| insights/ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure.html | Template stub; thin |
| insights/semiconductor-market-research-inventory-cycles-in-ai-chip-markets.html | Template stub; thin |
| insights/semiconductor-market-research-semiconductor-concentration-risk.html | Template stub; thin |

---

## NOINDEX + REMOVE_FROM_SITEMAP (5 pages — action required in Task 3)

These pages are currently indexed (`robots: index,follow`) but are template-style stubs or near-duplicates of stronger canonical pages. They should be noindexed and removed from `sitemap-insights.xml`.

| Page | Issue | Canonical to prefer |
|------|-------|---------------------|
| insights/etf-education-etf-structure-and-index-methodology.html | Template-style; thin; exists alongside stronger `dividend-etfs-explained.html` | dividend-etfs-explained.html |
| insights/etf-education-expense-ratios-and-tracking-differences.html | Template-style; thin; duplicate intent with expense ratio content in etf-risk-comparison-guide | etf-risk-comparison-guide.html |
| insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html | Near-duplicate of `interest-rates-and-tech-stocks.html` (~27KB); both indexed with overlapping intent | interest-rates-and-tech-stocks.html |
| insights/mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html | Near-duplicate of `mega-cap-tech-index-concentration.html`; both indexed with same search intent | mega-cap-tech-index-concentration.html |
| insights/semiconductor-market-research-ai-chip-supply-chain-constraints.html | Only indexed semiconductor-market-research page; weaker than `semiconductor-cycle-risks.html` (~34KB) | semiconductor-cycle-risks.html |

**In sitemap-insights.xml:** All 5 of these pages are present and need to be removed.

---

## IMPROVE — High-Value Pages (7 pages — action required in Task 2)

These are the strongest candidate pages for organic search. They have good structure but need additional depth, richer FAQ, stronger internal linking, and "continue reading" sections.

| Page | Priority | Improvement focus |
|------|----------|------------------|
| insights/spy-vs-qqq-etf-comparison-guide.html | 1 | Deeper methodology comparison; expand FAQ section; add related comparison links |
| insights/defensive-investing-explained.html | 2 | Add sector allocation table; expand FAQ; add sector rotation cross-link |
| insights/sector-rotation-explained.html | 3 | Add cycle phase diagram (text-based); expand FAQ; cross-link defensive-investing |
| insights/etf-risk-comparison-guide.html | 4 | Add beta/volatility table; expand Q&A on specific ETF pairs; cross-link comparison pages |
| insights/dividend-etfs-explained.html | 5 | Expand yield mechanics section; add SCHD/VIG/JEPI cross-links; deepen payout ratio section |
| insights/growth-etfs-vs-value-etfs.html | 6 | Add historical performance context; deepen factor explanation; cross-link spy-vs-qqq guide |
| insights/semiconductor-stocks-outlook.html | 7 | Expand AI capex narrative; add inventory cycle section; cross-link semiconductor-cycle-risks |

---

## KEEP — Strong Pages (22 pages)

These pages have sufficient content depth, clear search intent alignment, and correct indexing status. No structural changes needed.

| Page | Category |
|------|----------|
| insights/interest-rates-and-tech-stocks.html | Market Research |
| insights/mega-cap-tech-index-concentration.html | Market Research |
| insights/semiconductor-cycle-risks.html | AI & Technology |
| insights/value-vs-growth-market-regimes.html | Market Research |
| insights/growth-stocks-vs-value-stocks.html | Market Research |
| insights/etf-diversification-explained.html | ETF Research |
| insights/what-is-beta-in-stocks.html | Market Research |
| insights/how-to-read-pe-ratios.html | Market Research |
| insights/understanding-dividend-yield.html | ETF Research |
| insights/market-cap-explained.html | Market Research |
| insights/what-is-a-stock-index.html | Market Research |
| insights/bond-etfs-explained.html | ETF Research |
| insights/fed-rate-decisions-and-markets.html | Market Research |
| insights/inflation-and-stock-market.html | Market Research |
| insights/sector-investing-overview.html | Market Research |
| insights/earnings-season-explained.html | Market Research |
| insights/options-basics-explained.html | Market Research |
| insights/short-selling-explained.html | Market Research |
| insights/dollar-cost-averaging-explained.html | Market Research |
| insights/rebalancing-explained.html | Market Research |
| insights/etf-creation-redemption.html | ETF Research |
| insights/passive-vs-active-investing.html | Market Research |

---

## Duplicate Pairs Identified

| Weaker (NOINDEX) | Stronger (canonical) | Overlap |
|-----------------|---------------------|---------|
| interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html | interest-rates-and-tech-stocks.html | Near-identical topic; interest rate + tech stock sensitivity |
| mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html | mega-cap-tech-index-concentration.html | Near-identical topic; mega-cap concentration in indexes |
| etf-education-expense-ratios-and-tracking-differences.html | etf-risk-comparison-guide.html | Expense ratio discussion overlaps significantly |
| etf-education-etf-structure-and-index-methodology.html | dividend-etfs-explained.html + etf-diversification-explained.html | ETF structure basics; split intent |
| semiconductor-market-research-ai-chip-supply-chain-constraints.html | semiconductor-cycle-risks.html | Supply chain constraints covered in cycle risks; shorter/thinner |

---

## Notes

- All NOINDEX decisions avoid deleting any HTML files — files remain on disk to preserve routes
- Removing from `sitemap-insights.xml` reduces sitemap crawl waste without 404ing URLs
- Removing from `insights/index.html` grid removes the orphan entry point for low-value pages
- `check:article-pairs.js` automatically skips noindexed pages — EN noindex does NOT break AR parity
- Phase 21 Task 3 will execute all NOINDEX + sitemap removal actions
- Phase 21 Task 2 will strengthen the 7 IMPROVE pages
