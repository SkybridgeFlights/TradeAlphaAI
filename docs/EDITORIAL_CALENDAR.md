# Editorial Calendar

TradeAlphaAI publishes evergreen educational research on a controlled cadence. The goal is consistency and topical breadth, not volume for its own sake.

## Weekly Cadence

Target cadence: 1 to 3 high-quality bilingual articles per week.

Recommended rhythm:

- Monday: ETF education, beginner investing, or risk framework article.
- Wednesday: sector research, defensive investing, dividend investing, or comparison education.
- Friday: optional deeper comparison or methodology article when editorial review capacity is available.

Do not publish more than one article per day unless there is an explicit editorial reason. Do not publish more than three articles in one week.

## Topic Rotation

Rotate categories so the research library remains broad:

- ETF education
- Beginner investing
- Stock comparisons
- ETF comparisons
- Sector research
- Defensive investing
- Dividend investing
- Risk and methodology

Avoid repeating the same discovery cluster more than twice in one week. Avoid back-to-back ETF-only weeks unless the editorial calendar explicitly calls for an ETF education sprint.

## Evergreen Refresh Schedule

Every published evergreen article should be reviewed on a recurring cycle:

- Core beginner guides: every 180 days.
- ETF methodology and risk guides: every 180 days.
- Sector outlooks: every 120 days.
- Comparison guides: every 180 days.
- Dividend and defensive investing guides: every 180 days.

Refreshes should update educational clarity, internal links, metadata, and outdated wording. Do not add fake news, unsourced claims, or market predictions during refreshes.

## Multilingual Schedule

EN and AR should publish together whenever possible.

Required before scheduling:

- English draft complete.
- Arabic equivalent complete.
- Arabic reviewed for RTL, no reversed text, and no broken mixed-language boilerplate.
- Canonical and hreflang planned.
- Related links localized.

If Arabic is not ready, the article should remain in draft or review. Do not publish an English-only editorial article.

## Workflow

1. Add or update the topic in `data/editorial-topic-queue.json`.
2. Generate a draft into `drafts/editorial/<slug>/`.
3. Review content, metadata, schema, FAQ, internal links, and disclaimers.
4. Move queue item to `reviewed` only after EN and AR are ready.
5. Use `tools/publish-reviewed-article.js --slug=<slug>` for a dry-run publishing checklist.
6. Execute publishing only after manual approval.
7. Run all validation checks.
8. Run Telegram dry-run.
9. Send Telegram only after explicit approval.

## SEO Review Timing

SEO review happens before a topic moves from `review` to `reviewed`.

Review:

- Title and description uniqueness.
- Canonical and hreflang parity.
- Article and FAQ schema.
- Related stocks, ETFs, comparisons, hubs, rankings, and beginner guides.
- Sitemap inclusion plan.
- Search index and registry update plan.

## Telegram Timing

Telegram posts should be manual and normally sent after the article is live and validations pass.

Suggested timing:

- EN/AR article publish: morning US market pre-open or early afternoon UTC.
- Telegram dry-run: immediately after validation.
- Telegram send: only after preview approval.

Never store Telegram tokens in the repository.
