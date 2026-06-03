# GitHub Actions Editorial Automation

Phase 32 documentation. Generated 2026-06-03.

---

## Overview

`.github/workflows/editorial-publisher.yml` runs the editorial publishing pipeline automatically on a weekly schedule and supports manual on-demand execution. It is safe by default: all publishing steps are dry-run and no Telegram messages are sent unless explicitly enabled.

---

## Workflow file

`.github/workflows/editorial-publisher.yml`

---

## Triggers

### Manual (workflow_dispatch)

Run from **GitHub → Actions → Editorial Publisher → Run workflow**.

| Input | Type | Default | Description |
|---|---|---|---|
| `slug` | string | *(empty)* | Article slug to dry-run publish (e.g. `how-dividend-etfs-generate-income`). Leave empty to skip the publish step. |
| `dry_run_only` | choice | `true` | Set to `false` only when enabling real publishing (requires the commented real-publish steps to be uncommented). |

### Scheduled

Runs automatically every **Monday at 08:00 UTC**. Equivalent to a no-slug manual run: validators execute, upcoming publications are listed, and the Telegram preview dry-run fires. No article is published.

---

## Steps

| Step | What it does |
|---|---|
| Checkout repository | Clones the repo at the current commit |
| Setup Node.js | Installs Node.js 20 (no npm cache — zero dependencies, no lockfile) |
| Install dependencies | `npm install` (no-op if nothing to install) |
| Check editorial queue | `npm run check:editorial` |
| Check UTF-8 encoding | `npm run check:utf8` |
| Check production readiness | `npm run check:production` |
| Check SEO | `npm run check:seo` |
| Check indexing signals | `npm run check:indexing` |
| Check social meta | `npm run check:social-meta` |
| List upcoming publications | `node tools/list-upcoming-publications.js` — shows scheduled topics |
| Dry-run publish (conditional) | `node tools/publish-reviewed-article.js --slug="$SLUG"` — only runs if a slug was provided; dry-run mode because `--execute` is absent |
| Telegram preview | `node tools/telegram-publish-article.js --slug=etf-diversification-guide --locale=both` — formats the Telegram message but does not send it; dry-run because `--send` is absent |

---

## Why DRY_RUN is the default

The `publish-reviewed-article.js` tool copies a draft into the live `insights/` directory and triggers regeneration scripts. This is irreversible in the GitHub Actions context (there is no post-step cleanup). Running without `--execute` is the safe signal: the tool prints what it would do without touching the filesystem.

Similarly, `telegram-publish-article.js` without `--send` formats and prints the Telegram message preview without making any API call. No `TELEGRAM_BOT_TOKEN` environment variable is needed in dry-run mode.

---

## How to add GitHub secrets

Required only when enabling real Telegram publishing:

1. Go to **GitHub → your repository → Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Add:
   - `TELEGRAM_BOT_TOKEN` — bot token from BotFather
   - `TELEGRAM_CHANNEL_ID` — channel ID (e.g. `@tradealpha_ai` or numeric ID)

These secrets are only accessed in the commented real-publishing steps and only when `--send` is present in the command.

---

## How to enable real Telegram publishing

1. Add the two secrets above.
2. Confirm the target article has `status=published` and `review_status=approved` in `data/editorial-topic-queue.json`.
3. Open `.github/workflows/editorial-publisher.yml` and uncomment the two steps in the **Real publishing** section.
4. Trigger a manual run with the article slug and `dry_run_only=false`.

> **Do not set `dry_run_only=false` without uncommenting the real-publish steps.** The `dry_run_only` input alone does not change the behavior of the dry-run steps — it only gates the commented real-publish steps.

---

## Rollback safety

- The workflow has `permissions: contents: read` — it cannot push, create branches, or modify the repository.
- All file writes happen locally inside the runner and are discarded when the job ends.
- The `--execute` flag (real publish) and `--send` flag (real Telegram) are both gated behind the commented block. Accidentally running the workflow with `dry_run_only=false` on the current commented config has no effect.
- To roll back a real publish: revert the `insights/<slug>.html` file in your local repo and push the revert commit.

---

## Weekly schedule behavior

On scheduled Monday runs (no slug input):

1. All 6 validators run.
2. Upcoming publications are listed in the job log.
3. The Telegram message for `etf-diversification-guide` is formatted and printed (no send).
4. The conditional publish step is skipped (no slug).

This gives a weekly health check and editorial queue review without any side effects.

---

## Secrets required

| Secret | Required for | When |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Real Telegram send | Only when `--send` flag is present (commented block) |
| `TELEGRAM_CHANNEL_ID` | Real Telegram send | Only when `--send` flag is present (commented block) |

No secrets are required for dry-run operation.
