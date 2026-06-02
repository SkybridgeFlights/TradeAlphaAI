# Search Intelligence Workflow

TradeAlphaAI uses a lightweight manual search intelligence layer to turn Search Console observations into editorial and SEO decisions. This workflow does not add tracking pixels, third-party analytics scripts, API keys, or database infrastructure.

## Weekly Review

Once per week, review Search Console for priority pages:

- Homepage and Arabic homepage
- Rankings
- Stock and ETF pages
- Comparison pages
- Sector hubs
- Educational insights
- Arabic equivalents of high-value pages

Update `data/seo-performance-tracker.json` with 7-day and 28-day Search Console values.

## Manual Tracker Fields

Each tracked page records:

- `url`
- `page_type`
- `locale`
- `cluster`
- `priority`
- `target_query_group`
- `impressions_7d`, `clicks_7d`, `ctr_7d`, `avg_position_7d`
- `impressions_28d`, `clicks_28d`, `ctr_28d`, `avg_position_28d`
- `indexing_status`
- `last_checked`
- `action_status`
- `recommended_action`

Use Search Console data directly when available. If a page is newly published, zero or low values are acceptable until the next review cycle.

## Decision Rules

- High impressions + low CTR: rewrite title/meta and improve result intent match.
- Position 8-20: add internal links, expand content, and improve FAQ/schema.
- Discovered not indexed: add stronger internal links and request indexing.
- Crawled not indexed: improve uniqueness, depth, and canonical clarity.
- Indexed but low clicks: improve related links, FAQ, schema, and title/meta.
- Low impressions + high priority: add related article, hub links, or rankings links.
- Weak Arabic pages: add links from Arabic hubs, Arabic rankings, Arabic insights, and Arabic comparison pages.

## Tooling

Run:

```powershell
npm run check:seo-performance
npm run editorial:priorities
```

`check:seo-performance` validates the tracker and prints opportunity buckets.

`editorial:priorities` is dry-run by default. It connects weak clusters to existing editorial queue topics and suggests priority updates. It only writes queue changes when `--write` is passed.

## Editorial Feedback Loop

1. Identify weak page clusters from `check:seo-performance`.
2. Run `editorial:priorities`.
3. If a matching queued topic exists, raise its review priority manually or with `--write`.
4. If no queued topic exists, add an evergreen topic to `data/editorial-topic-queue.json`.
5. Schedule the topic only after EN and AR drafts are ready for review.
6. Validate with editorial, SEO, indexing, and social metadata checks before publishing.

## Privacy And Safety

This workflow uses manual Search Console data only. It does not add browser tracking, user profiling, cookies, pixels, API integration, or external analytics scripts.
