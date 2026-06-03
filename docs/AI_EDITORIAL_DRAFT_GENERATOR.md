# AI Editorial Draft Generator

The AI editorial draft generator prepares one bilingual evergreen article draft at a time. It is intentionally draft-only: it does not publish public pages, update sitemaps, update search indexes, update registries, or send Telegram messages.

## How Draft Generation Works

Run:

```bash
npm run editorial:generate-draft
```

The tool reads `data/editorial-topic-queue.json` and selects the first topic with one of these statuses:

- `draft`
- `planned`
- `queued`

It writes:

- `drafts/editorial/<slug>/en.html`
- `drafts/editorial/<slug>/ar.html`
- `drafts/editorial/<slug>/metadata.json`

After generation, the queue item is moved to:

- `status: in_review`
- `review_status: pending`
- `revision_count: 0`
- `last_reviewed: null`

If no eligible topic exists, the tool exits successfully and prints:

```text
No draft topic available
```

## Review Process

Editors should review both language drafts before approval:

- Confirm the English article is clear, educational, and evergreen.
- Confirm the Arabic article is clean UTF-8 Arabic with correct RTL direction.
- Remove any language that sounds like financial advice.
- Remove unsourced news, earnings claims, analyst opinions, or performance predictions.
- Check all related research links.
- Check Article schema and FAQPage schema.
- Confirm the educational disclaimer remains present.

Drafts are local editorial workspace files. They are not public routes and must not be added to sitemaps, search indexes, or public registries.

## Approval And Publishing

After manual review, an editor may update the queue item to:

- `status: reviewed`
- `review_status: approved`
- `last_reviewed: YYYY-MM-DD`
- increment `revision_count` if edits were made

Publishing happens later through the reviewed-article publishing workflow. The draft generator never publishes automatically.

## Why Auto-Publish Is Disabled

The generator is deterministic today, and future AI output can still contain errors, weak phrasing, or claims that need human review. For that reason:

- Generated drafts are never marked approved.
- Generated drafts are never copied to `insights/`, `ar/insights/`, or `en/insights/`.
- Generated drafts never trigger Telegram.
- Generated drafts never update sitemaps, registry files, or search indexes.

## Scheduled Draft Generation

`.github/workflows/editorial-draft-generator.yml` can run manually or on a weekly schedule. It:

1. Runs `npm run check:editorial`.
2. Runs `node tools/generate-ai-editorial-draft.js`.
3. Runs `npm run check:editorial`.
4. Runs `npm run check:utf8`.
5. Commits generated draft files and the queue update only if changes exist.

The workflow has no publish or Telegram steps.

## Future AI API Integration

Future AI integration should keep the same safety boundaries:

- Use environment variables for API keys.
- Never commit secrets.
- Keep generated output in `drafts/editorial/`.
- Keep `status: in_review` and `review_status: pending`.
- Run editorial and UTF-8 checks after generation.
- Require manual approval before any public publishing.
- Avoid fake news, financial advice, performance promises, and unsourced market claims.
