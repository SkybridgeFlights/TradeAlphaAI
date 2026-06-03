# GitHub Actions Editorial Automation

Phase 33 documentation. Updated 2026-06-03.

---

## Overview

`.github/workflows/editorial-publisher.yml` runs the editorial publishing pipeline on a weekly autonomous schedule and supports manual on-demand execution.

**Default mode**: dry-run — validators run, upcoming publications are listed, message previews are shown. Nothing is written to the repo.

**Real-publish mode**: activated by scheduled cron (always) or manual `workflow_dispatch` with `dry_run_only=false`. Requires an article with `status=reviewed` and `review_status=approved` whose `target_publish_date <= today`.

**`REAL_PUBLISH` variable**: job-level env var that evaluates to `'true'` when `github.event_name == 'schedule'` OR `github.event.inputs.dry_run_only == 'false'`. All write steps are gated by this variable.

---

## Workflow file

`.github/workflows/editorial-publisher.yml`

---

## Triggers

### Manual (workflow_dispatch)

Run from **GitHub → Actions → Editorial Publisher → Run workflow**.

| Input | Type | Default | Description |
|---|---|---|---|
| `slug` | string | *(empty)* | Article slug to target. Leave empty to auto-detect the next approved article whose `target_publish_date <= today`. |
| `dry_run_only` | choice | `true` | Set to `false` to publish for real. Default `true` runs validators + previews only. |

### Scheduled (cron)

Runs automatically every **Monday at 08:00 UTC**.

Scheduled runs **always enter the real-publish path** (`REAL_PUBLISH=true`). If a publishable article is found (`status=reviewed`, `review_status=approved`, `target_publish_date <= today`), it is published automatically. If no qualifying article exists, the job exits cleanly — validators and queue preview still run.

---

## Step-by-step flow

### Every run (dry-run + real-publish)

| Step | What it does |
|---|---|
| Checkout repository | Clones at HEAD |
| Setup Node.js 20 | No `cache: 'npm'` — zero npm dependencies, no lockfile |
| Install dependencies | `npm install` (no-op if no new deps) |
| Check editorial queue | `npm run check:editorial` |
| Check UTF-8 encoding | `npm run check:utf8` |
| Check production readiness | `npm run check:production` |
| Check SEO | `npm run check:seo` |
| Check indexing signals | `npm run check:indexing` |
| Check social meta | `npm run check:social-meta` |
| List upcoming publications | Shows scheduled topics and their review state |

### Dry-run-only path (REAL_PUBLISH != 'true')

| Step | What it does |
|---|---|
| Dry-run publish preview | Prints what would be published (only if slug provided). No files written. |
| Telegram message preview | Formats the Telegram message. Never sends. |

### Real-publish path (REAL_PUBLISH == 'true')

| Step | id | What it does |
|---|---|---|
| Find publishable approved article | `find-article` | Scans queue for `status=reviewed`, `review_status=approved`, `target_publish_date <= today`. Sets `publish_slug` output. If none found: exits cleanly, all remaining steps skip. |
| Duplicate protection check | `dup-check` | Guard 1: checks `data/published-history.json` for existing slug entry. Guard 2: checks if `insights/<slug>.html` already exists on disk. Sets `already_published=true\|false`. |
| Publish reviewed article | `publish` | `publish-reviewed-article.js --slug=… --execute` — copies drafts → insights/, runs regeneration + validators. Guard 3: script itself refuses to overwrite existing files. |
| Mark article as published in queue | — | Updates `data/editorial-topic-queue.json`: `status → published`, adds `published_at` date |
| Update published history | — | Appends entry to `data/published-history.json`: slug, publish_date, workflow_run_id, languages |
| Commit and push | — | Stages exactly the generated/public files (see below). Commits with message `Publish article: <slug>`. Pushes. |
| Send Telegram announcement | — | Sends EN + AR messages with 3-second gap (`--delay-ms=3000`). Skipped gracefully if secrets not configured. |

---

## Published history log

`data/published-history.json` records every article published by the workflow.

```json
{
  "version": "1.0",
  "updated": "YYYY-MM-DD",
  "publications": [
    {
      "slug": "example-article-slug",
      "publish_date": "YYYY-MM-DD",
      "workflow_run_id": "12345678",
      "languages": ["en", "ar"]
    }
  ]
}
```

This file is appended on each real publish and committed as part of the publish commit. It serves as the first layer of duplicate protection.

---

## Duplicate protection (three layers)

An article slug can never be published twice, even if the workflow is triggered manually multiple times.

| Layer | Where | What it checks |
|---|---|---|
| 1 | `dup-check` step | `data/published-history.json` — slug already in publications array |
| 2 | `dup-check` step | `insights/<slug>.html` already exists on disk |
| 3 | `publish-reviewed-article.js` | Refuses to overwrite existing public article files |

Any layer alone is sufficient to abort the publish safely. No files are changed if duplication is detected.

---

## Safety guards

| Scenario | Behavior |
|---|---|
| No approved article in queue | Find-article step exits cleanly; all publish steps skipped |
| Article status not `reviewed+approved` | Find-article step prints reason and skips |
| Draft files missing (EN or AR) | `publish-reviewed-article.js` fails with clear message before touching anything |
| Article already in published-history.json | Duplicate protection exits safely — no files changed |
| Article HTML already exists on disk | Duplicate protection exits safely — no files changed |
| Any validator fails | Job exits with failure before commit step is reached |
| Telegram fails after publish | Article is already committed and live; Telegram can be retried manually |
| Manual `dry_run_only=true` (default) | `REAL_PUBLISH=false`; all write steps skipped |
| Telegram secrets not configured | Telegram step prints a skip message and exits 0; publish still succeeds |

**`permissions: contents: write`** is set at the workflow level. The write token is present but unused on dry-run paths — no git operations execute unless `REAL_PUBLISH == 'true'`.

---

## What gets committed

```
insights/<slug>.html
ar/insights/<slug>.html
data/editorial-topic-queue.json        (status → published, published_at added)
data/published-history.json            (new entry appended)
data/insights/article-registry.json   (regenerated)
data/search-index.json                 (regenerated)
data/research-assets/index.json        (regenerated)
sitemap*.xml                           (regenerated)
robots.txt                             (regenerated)
```

`drafts/` is never staged. No `.env` files, no secrets, no unrelated modified files.

Commit message format: `Publish article: <slug>`

---

## How to run a manual dry-run

1. Go to **GitHub → Actions → Editorial Publisher → Run workflow**
2. Leave `slug` empty or enter a slug
3. Keep `dry_run_only = true` (default)
4. Click **Run workflow**

Validators run, upcoming publications are listed, no files are changed.

---

## How to publish a real article manually

### Prerequisites

1. The article must have `status=reviewed` and `review_status=approved` in `data/editorial-topic-queue.json`
2. `target_publish_date` must be today or in the past
3. Both draft files must exist: `drafts/editorial/<slug>/en.html` and `drafts/editorial/<slug>/ar.html`
4. Both drafts must pass content checks (canonical, hreflang, OG, Article schema, FAQPage schema, `#related-research`, `#continue-learning`)

### Steps

1. Go to **GitHub → Actions → Editorial Publisher → Run workflow**
2. Enter the article slug in the `slug` field (or leave empty for auto-detect)
3. Set `dry_run_only = false`
4. Click **Run workflow**
5. Monitor the run — each step's output is visible in the Actions log

---

## Autonomous weekly publish

Every Monday at 08:00 UTC the workflow runs with `REAL_PUBLISH=true`. Auto-detection order:

1. Scan `data/editorial-topic-queue.json` for topics where:
   - `status === 'reviewed'`
   - `review_status === 'approved'`
   - `target_publish_date <= today`
2. Select the **first** matching topic (queue order)
3. Run duplicate protection checks
4. Publish, regenerate, commit, push, send Telegram

If no qualifying article is found, validators and queue preview still run — no failure.

---

## Required secrets

| Secret | Required for | How to add |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Real Telegram send | GitHub → Settings → Secrets and variables → Actions → New repository secret |
| `TELEGRAM_CHANNEL_ID` | Real Telegram send | Same path. Channel ID or `@handle`. |

Telegram secrets are optional. If not configured, the Telegram step exits cleanly and the publish still succeeds.

---

## Rollback steps

If an article is published incorrectly:

1. **Remove the article files locally:**
   ```
   del insights\<slug>.html
   del ar\insights\<slug>.html
   ```
2. **Revert the queue status:**
   Edit `data/editorial-topic-queue.json` — change `status` back to `reviewed`, remove `published_at`
3. **Remove from published-history.json:**
   Edit `data/published-history.json` — remove the entry for the slug
4. **Regenerate indexes:**
   ```
   npm run article-registry:generate
   npm run search:generate
   npm run generate:seo-sitemaps
   ```
5. **Commit the revert:**
   ```
   git add insights/<slug>.html ar/insights/<slug>.html data/
   git commit -m "Revert: unpublish <slug>"
   git push
   ```

---

## Publish flow diagram

```
Trigger: schedule (Mon 08:00 UTC) OR workflow_dispatch
│
├── Validators (always run — fail fast)
│   check:editorial → check:utf8 → check:production
│   check:seo → check:indexing → check:social-meta
│
├── List upcoming publications (always run)
│
├── [REAL_PUBLISH == 'false'] ──► dry-run previews → END
│
└── [REAL_PUBLISH == 'true']
    │
    ├── find-article
    │   ├── [no qualifying article] ──► EXIT (success, nothing published)
    │   └── publish_slug = <slug>
    │
    ├── dup-check
    │   ├── [published-history.json has slug] ──► EXIT (duplicate protection)
    │   ├── [insights/<slug>.html exists] ──► EXIT (duplicate protection)
    │   └── already_published = false
    │
    ├── publish-reviewed-article.js --execute
    │   (copies drafts → insights/, regenerates, validates)
    │
    ├── mark queue: status=published, published_at=today
    │
    ├── update published-history.json
    │
    ├── git add [safe file list] → commit "Publish article: <slug>" → push
    │
    └── telegram-publish-article.js --send --locale=both --delay-ms=3000
        (skipped gracefully if secrets not configured)
```
