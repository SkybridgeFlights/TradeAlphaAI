# Editorial Workflow

TradeAlphaAI editorial content is static-first, multilingual, and educational. The workflow is designed to prevent unreviewed auto-publishing, fake market commentary, and unsupported financial claims.

## Lifecycle

1. `draft`: Topic exists in `data/editorial-topic-queue.json`. A draft skeleton can be generated for editorial work.
2. `review`: Article copy, metadata, schema, related links, Arabic parity, and disclaimers are under human review.
3. `scheduled`: Final article is approved and has a target publishing date, but is not distributed automatically.
4. `published`: Public static pages, sitemap, registry, search index, and distribution preview are verified.

The generator only creates draft skeletons under `drafts/editorial/<slug>/`. It does not publish, update sitemaps, or alter public insight routes.

## Quality Review

Before any article can move beyond review:

- Confirm the article is evergreen and educational.
- Remove buy/sell language, price targets, performance promises, and unsourced news claims.
- Confirm EN and AR pages have equivalent structure.
- Confirm Arabic pages use `lang="ar"` and `dir="rtl"`.
- Confirm canonical, hreflang, title, description, OG/Twitter metadata, Article schema, Breadcrumb schema, FAQ blocks, and educational disclaimers.
- Confirm related stocks, ETFs, comparisons, hubs, rankings, and beginner guides are relevant and not broken.

Run:

```powershell
npm run check:editorial
npm run check:utf8
npm run check:production
npm run check:seo
npm run check:indexing
npm run check:social-meta
```

## SEO Review

Published articles should be added to the normal insight pipeline only after review:

- public EN route: `/insights/<slug>.html`
- public AR route: `/ar/insights/<slug>.html`
- canonical and hreflang coverage
- `sitemap-insights.xml` and Arabic sitemap coverage
- article registry and search index refresh
- no duplicate titles or descriptions
- no thin content

Draft files must remain `noindex,nofollow`.

## Multilingual Review

Arabic content should be written or reviewed as Arabic, not mixed placeholder text. Proper nouns and ticker symbols may remain English. Do not reverse ticker order or force translation of ticker symbols.

Review Arabic pages for:

- RTL markers
- Arabic navigation and labels
- no broken mixed-language boilerplate
- matching FAQ count and section structure
- equivalent related links using `/ar/` routes

## Telegram Distribution Flow

Telegram distribution is manual and dry-run by default.

1. Mark the queue item `published` only after public pages and SEO checks pass.
2. Preview the post:

```powershell
node tools/telegram-publish-article.js --slug=<slug>
```

3. Review EN and AR message text and article URLs.
4. Send only after manual approval:

```powershell
$env:TELEGRAM_BOT_TOKEN='<token>'
$env:TELEGRAM_CHANNEL_ID='<channel>'
node tools/telegram-publish-article.js --slug=<slug> --send
```

No Telegram secrets are stored in the repository.

## Rollback And Removal

If a published article is weak, outdated, or incorrect:

1. Remove or correct the public article.
2. Add `noindex,follow` if temporary retention is required.
3. Remove stale sitemap entries.
4. Refresh article registry and search index.
5. Remove or correct Telegram/social distribution references where possible.
6. Update the queue status and add an editorial note in the PR or deployment log.

## Noindex Workflow For Weak Content

Use `noindex,follow` for content that should remain reachable for users but should not be indexed. Use full removal when the content is misleading, duplicative, or not worth retaining.

Weak content should not be distributed through Telegram or future social channels.
