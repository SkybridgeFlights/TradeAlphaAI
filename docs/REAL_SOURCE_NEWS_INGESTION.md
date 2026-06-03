# Real-Source News Ingestion — Phase 37

## Purpose

This system generates educational news-analysis drafts **only when real, verifiable official sources exist**. No news, data, or quotes are fabricated at any point in the pipeline.

---

## Allowed Source Types

| `source_type` | Description | Example origin |
|---|---|---|
| `sec_filing` | SEC EDGAR filing (8-K, 10-Q, 10-K, proxy) | sec.gov/cgi-bin/browse-edgar |
| `official_earnings_report` | Company investor relations earnings release | company IR page |
| `federal_reserve_release` | FOMC statement, minutes, or Fed board publication | federalreserve.gov/releases |
| `cpi_release` | BLS CPI report | bls.gov/cpi |
| `nfp_release` | BLS non-farm payrolls report | bls.gov/news.release/empsit |
| `gdp_release` | BEA GDP advance/preliminary/final estimate | bea.gov/data/gdp |
| `pce_release` | BEA personal consumption expenditures | bea.gov/data/personal-consumption-expenditures-price-index |
| `etf_provider_update` | Official ETF provider announcement or prospectus amendment | fund provider IR site |
| `platform_market_data` | Verified endpoint already integrated into the platform | see market-symbols.json |

Any other source type is rejected at ingestion time.

---

## How to Add a Source Manually

1. Open `data/news-source-registry.json`.
2. Add a new entry to the `sources` array. All fields are required:

```json
{
  "source_type": "sec_filing",
  "source_name": "Apple Inc. 8-K — Q2 2026 Earnings Release",
  "source_url": "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=AAPL&type=8-K",
  "fetched_at": "2026-05-02",
  "related_tickers": ["AAPL"],
  "event_type": "earnings_release",
  "reliability_level": "official"
}
```

3. Validate the entry before committing:
```
npm run news-analysis:check-sources
```

4. Ingest into the news-analysis queue:
```
npm run news-analysis:ingest-sources
```

5. Generate a draft:
```
npm run news-analysis:generate-draft
```

### Field rules

- `source_url` — must be the real URL of the official document (not a search result page or news aggregator)
- `fetched_at` — the date you verified the source exists, in `YYYY-MM-DD` format
- `related_tickers` — uppercase ticker symbols only, e.g. `["AAPL", "QQQ"]`
- `reliability_level` — must be one of: `high`, `official`, `verified`

---

## How Draft Generation Works

```
data/news-source-registry.json
         │
         ▼
tools/ingest-news-sources.js  ──validates sources──►  data/news-analysis-queue.json
                                                                │
                                                                ▼
                                             tools/generate-news-analysis-draft.js
                                                                │
                                                    ┌───────────┼───────────┐
                                                    ▼           ▼           ▼
                                               en.html      ar.html   metadata.json
                                          (drafts/news-analysis/<slug>/)
```

The draft generator:
1. Picks the next `planned` topic from `news-analysis-queue.json`
2. Re-validates all attached sources (type and URL)
3. Generates bilingual EN + AR drafts as `noindex,nofollow` HTML
4. Includes an explicit source citation section (`id="sources"`) with source type labels
5. Sets `status = in_review` and `review_status = pending` in the queue
6. Never touches public files, sitemaps, registries, or Telegram

---

## Safety Gates

The following checks run automatically in the workflow and CI:

| Check | Tool | What it catches |
|---|---|---|
| Source type validation | `ingest-news-sources.js` | Unsupported or missing `source_type` |
| Source URL validation | `ingest-news-sources.js` | Non-`https://` or missing URLs |
| Queue source checks | `check-publishing-safety.js` | Topics with no sources, invalid URLs, bad source types |
| Source registry checks | `check-publishing-safety.js` | Invalid registry entries |
| Draft disclaimer check | `check-publishing-safety.js` | Missing `educational-disclaimer` class |
| Draft Arabic check | `check-publishing-safety.js` | Missing RTL marker, missing Arabic text |
| Draft source section | `check-publishing-safety.js` | Missing `id="sources"` section |
| Forbidden advice language | `check-publishing-safety.js` | `buy now`, `sell now`, `guaranteed`, etc. |
| Fabricated stats language | `check-publishing-safety.js` | `according to unnamed sources`, `rumored data`, etc. |
| Fake quote patterns | `check-publishing-safety.js` | `as told to us`, `market insider told`, etc. |
| Unsupported market claims | `check-publishing-safety.js` | `markets will`, `inevitable crash`, price targets, etc. |
| UTF-8 integrity | `check-utf8-integrity.js` | Encoding corruption or mojibake |

---

## Why Auto-Publishing Is Disabled

News-analysis drafts are never automatically published. Reasons:

1. **Time-sensitivity** — market events require editorial judgment about whether the educational angle is still relevant by publish time.
2. **Source verification** — even a valid official URL can be superseded, corrected, or retracted after ingestion.
3. **AR quality** — the Arabic draft contains placeholder sections that must be reviewed by a bilingual editor before publication.
4. **Financial responsibility** — news-adjacent content carries higher risk of being misread as investment advice. Human sign-off is mandatory.

---

## How to Approve for Publishing Later

This is a manual process — there is no autonomous approval for news-analysis content.

1. Review `drafts/news-analysis/<slug>/en.html` and `ar.html`
2. Complete the `[Editor completes here: ...]` sections in both files
3. Verify all source URLs still resolve to the correct documents
4. In `data/news-analysis-queue.json`, set:
   - `"status": "reviewed"`
   - `"review_status": "approved"`
   - `"last_reviewed": "<today's date>"`
5. Publishing is a separate manual step — news-analysis articles do not use the editorial publisher workflow.

---

## Workflow

The `news-analysis-draft` GitHub Actions workflow (`.github/workflows/news-analysis-draft.yml`) is **manual-only** (`workflow_dispatch`). It runs:

1. Validate source registry (`ingest-news-sources.js --validate-only`)
2. Ingest sources into queue (`ingest-news-sources.js`)
3. Pre-generation safety check (`npm run check:editorial`)
4. Generate draft (`generate-news-analysis-draft.js`)
5. Post-generation safety check (`npm run check:editorial`)
6. UTF-8 check (`npm run check:utf8`)
7. Commit only `data/news-analysis-queue.json` and `drafts/news-analysis/`

There is no scheduled cron. No public files are ever committed by this workflow.
