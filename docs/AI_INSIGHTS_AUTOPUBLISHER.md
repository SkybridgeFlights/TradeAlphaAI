# AI Insights Autopublisher

TradeAlphaAI uses a controlled static publishing pipeline for finance education articles. The pipeline is designed to produce topic ideas, screen them for duplication, generate draft/review HTML, and only publish when quality checks pass.

## Topic Selection

Topic ideas come from `data/insight-topic-seeds.json`. Seeds are fixed finance clusters:

- AI infrastructure
- semiconductors
- GPU market
- cloud AI
- ETF education
- market cycles
- interest rates
- growth vs value
- diversification
- volatility
- dividend ETFs
- mega-cap tech
- macro risks

Run discovery:

```bash
npm run insights:discover
```

This updates `data/insight-topic-queue.json` with candidate topics containing slug, title, category, target keywords, related stocks, related ETFs, related hubs, article angle, audience intent, priority score, and status.

## Duplicate Prevention

Run:

```bash
node tools/check-insight-duplicates.js --slug=<queued-slug>
```

The duplicate guard compares queued topics against:

- `data/insight-topics.json`
- existing files in `insights/`
- other queued topics

It blocks duplicate slugs, duplicate titles, high text similarity, repeated keyword clusters, and repeated article angles.

## Publishing Modes

The default controlled pipeline mode is review.

- `draft`: generates static HTML with `noindex,nofollow`; does not add the article to sitemaps.
- `review`: generates static HTML with `noindex,nofollow`, marks the queued topic as `draft`, and sets `reviewStatus` to `needs-review`.
- `publish-if-safe`: generates, quality-checks, and only then writes indexable HTML and sitemap entries.

Draft and review pages are intentionally static but not indexable.

## Quality Gate

Run:

```bash
npm run insights:quality -- --slug=<queued-slug>
```

The quality checker rejects articles that are too short, missing Article/FAQ/Breadcrumb schema, missing disclaimer, missing internal links, missing stock/ETF/hub links, missing related insights, repeating phrases excessively, or containing forbidden promotional wording.

The checker allows only negative disclaimer usage of financial-advice language, such as "does not constitute investment or financial advice." Standalone advice claims are rejected.

## Manual Pipeline

Review mode:

```bash
npm run insights:pipeline
```

Safe publishing mode:

```bash
npm run insights:publish-safe -- --slug=<queued-slug>
```

The pipeline runs topic discovery, duplicate checks, article generation, quality checks, and optional sitemap publication.

## GitHub Actions

`.github/workflows/insight-pipeline.yml` is manual only via `workflow_dispatch`. There is no schedule. To enable scheduled publishing later, add a `schedule` trigger only after reviewing output quality and deciding an editorial cadence.

## Why Publishing Is Controlled

Finance SEO content can become thin or spammy if every generated idea is published automatically. This pipeline keeps topic generation separate from publication, requires duplicate and quality gates, keeps draft/review pages noindexed, and requires explicit publish-safe mode before sitemap inclusion.

Recommended safe frequency: 1 to 3 reviewed articles per week until editorial quality, indexing behavior, and engagement metrics are proven stable.
