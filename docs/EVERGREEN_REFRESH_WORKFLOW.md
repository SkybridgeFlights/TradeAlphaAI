# Evergreen Refresh Workflow

How to detect stale content, prioritize refresh candidates, and keep high-traffic pages earning impressions over time.

---

## 1. What Counts as Evergreen Content

Evergreen pages remain useful months after publication because their topic doesn't expire. On TradeAlphaAI, evergreen pages include:

- ETF hub pages (dividend-etfs.html, defensive-etfs.html, semiconductor-stocks.html, etc.)
- Comparison pages (spy-vs-qqq.html, jepi-vs-schd.html, etc.)
- Insight articles on structural topics (expense ratios, diversification, ETF methodology, sector rotation)
- Individual ETF profile pages (spy.html, qqq.html, schd.html)

Pages that are **not** evergreen: news-adjacent articles tied to specific earnings cycles, quarterly outlooks, or time-limited events.

---

## 2. Staleness Signals

A page should be flagged for refresh when **any two** of the following are true:

| Signal | Threshold |
|---|---|
| Last editorial update | > 6 months ago |
| Impressions trend | Falling >25% month-over-month for 2+ months |
| Average position | Slipped >5 positions from prior 90-day baseline |
| CTR | Below 2.5% with >500 impressions/month |
| FAQ content | References figures or conditions that are now outdated |
| Internal links | Fewer than 3 inbound links from current hub pages |
| Schema | Missing FAQPage or BreadcrumbList on a page with FAQ content |

Run `npm run check:seo-performance` monthly and compare against the prior run to identify pages crossing these thresholds.

---

## 3. Refresh Cadence

| Page type | Minimum refresh cadence | Trigger condition |
|---|---|---|
| Hub pages (hubs/*.html, root ETF/stock hubs) | Every 3 months | Any staleness signal |
| Comparison pages (compare/*.html) | Every 6 months | Position slip or schema gap |
| Insight articles (insights/*.html) | Every 6 months | Any staleness signal |
| ETF profile pages (etfs/*.html) | Every 6 months | Data or holdings context is outdated |
| Arabic counterparts (ar/**) | Within 2 weeks of EN refresh | EN refresh triggers AR parity check |

---

## 4. Refresh Scoring

Score each candidate on a 0–100 scale before scheduling work:

```
refresh_score = (traffic_weight * 40)
              + (position_opportunity * 30)
              + (schema_gap_bonus * 15)
              + (link_gap_penalty * 15)
```

**traffic_weight**: normalized impressions_28d / max(impressions_28d across all pages)

**position_opportunity**: 1.0 if avg_position_28d is 8–20; 0.5 if 21–50; 0 if ≤7 or >50

**schema_gap_bonus**: 1.0 if FAQPage or BreadcrumbList schema is missing; 0 otherwise

**link_gap_penalty**: 1.0 if inbound link count < 3; 0 otherwise

Pages scoring ≥ 50 should be refreshed in the current sprint. Pages scoring 30–49 go to the backlog.

---

## 5. What to Update in a Refresh

Refresh edits should be targeted — not rewrites. Work down this checklist:

### Always check
- [ ] Title and meta description: still within 50–60 / 140–155 character targets
- [ ] FAQPage JSON-LD: questions match current page content; answers are accurate
- [ ] BreadcrumbList JSON-LD: breadcrumb path is correct
- [ ] Internal links: 3+ inbound links from current hub pages; outbound links to relevant comparisons and insights
- [ ] Section completeness: Research Paths, Continue Learning, or Deep Research block present if applicable

### Check for data-bearing content
- [ ] ETF expense ratios: verify against current fund facts
- [ ] Top holdings: verify top-5 still accurate (major index rebalances change this)
- [ ] Sector weights: update if a major sector shift has occurred

### Check for language
- [ ] Avoid phrases that imply a specific time ("recently", "this year", "in 2024") unless the content is intentionally dated
- [ ] Freshen introductory paragraph if the context has changed materially

### After updating
- [ ] Re-request indexing via Google Search Console for the updated URL
- [ ] Update the `last_checked` field in `data/seo-performance-tracker.json`
- [ ] Check AR counterpart for parity (same section count, updated content parity)

---

## 6. Arabic Parity in Refresh

Every EN refresh must be followed by an AR parity check:

1. Run `npm run check:production` after the EN edit — it validates section counts
2. If section count diverges: add the equivalent section to the AR file before closing the refresh
3. Translate updated FAQ answers and intro paragraphs; update JSON-LD schema in AR file as well
4. Re-request AR URL indexing separately

---

## 7. When to Expand vs. Update

| Situation | Action |
|---|---|
| Page ranks 8–20 for the target query | Expand: add a FAQ question targeting the query; strengthen internal links |
| Page has impressions but low CTR | Update: rewrite title and meta description; add FAQ schema if missing |
| Page has no impressions after 90 days | Expand: add internal links from 2+ hub pages; add a relevant FAQ |
| Page is crawled but not indexed | Expand content to 600+ words; add schema; strengthen inbound links |
| Page ranks 1–7 but CTR is high | Monitor only; no refresh needed |

---

## 8. Link Reinforcement in Refresh

When refreshing a page, also check adjacent pages for link opportunities:

- If refreshing `insights/dividend-etfs-explained.html`: add a link from `dividend-etfs.html`, `compare/jepi-vs-schd.html`, and `compare/schd-vs-vig.html`
- If refreshing `etfs/spy.html`: ensure `etfs.html`, `compare/spy-vs-qqq.html`, and at least one insight article link to it
- If refreshing a comparison page: ensure both hub pages (for each symbol) link to it

Use `node tools/analyze-internal-authority.js` before and after to confirm inbound link counts improved.

---

## 9. Stale Detection Script Usage

```bash
# Check SEO performance against tracker data
npm run check:seo-performance

# Check internal link authority and orphan risk
node tools/analyze-internal-authority.js

# Check indexing status
npm run check:indexing

# Check schema and social meta
npm run check:social-meta
npm run check:seo
```

Compare consecutive monthly runs of `check:seo-performance` to identify position slippage. A position drop of >5 positions on a page with >200 monthly impressions is the primary trigger for a refresh.

---

## 10. Re-indexing After Refresh

After editing a page:

1. Open Google Search Console → URL Inspection
2. Enter the full URL (https://www.tradealphaai.com/...)
3. Click "Request Indexing"
4. Repeat for the AR counterpart URL
5. Update `last_checked` in `data/seo-performance-tracker.json`
6. Note the refresh in the editorial calendar (`docs/EDITORIAL_CALENDAR.md`)

Do not bulk-submit more than 10 URLs per day — prioritize the highest refresh_score pages.
