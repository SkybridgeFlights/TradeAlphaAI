# Economic Calendar Provider Comparison

Last updated: 2026-06-10

## Current production status

| Provider | Status | Reason |
|---|---|---|
| Trading Economics (TE) | missing_key | No `TRADING_ECONOMICS_API_KEY` in GitHub Secrets |
| FMP | disabled_paid_plan | 402 — requires paid subscription |
| Finnhub | auth_failed | 403 — key invalid or free tier no longer includes `/calendar/economic` |
| Alpha Vantage | auth_failed | Key rejected — free tier may have dropped `ECONOMIC_CALENDAR` |
| FRED | no_events | Not a macro calendar; `/releases/dates` returns release history, not upcoming schedules |

**Active fallback:** `schedule_fallback` (8 deterministic events) → stale cache → static cache → external iframe

---

## Provider benchmark

### 1. Finnhub

| Field | Value |
|---|---|
| Endpoint | `https://finnhub.io/api/v1/calendar/economic` |
| Free tier | Yes (60 calls/min) |
| Actual / Forecast / Previous | Yes — all three |
| Upcoming events | Yes |
| Commercial use | Yes |
| Pricing | Free → paid plans from ~$50/month |
| Response format | JSON: `{ economicCalendar: [...] }` |
| Diagnosis | 403 indicates the key has expired, been invalidated, or the endpoint was moved to a paid tier in a 2024/2025 plan change. Generate a fresh key at https://finnhub.io and test the exact endpoint directly. |
| Fix | Rotate `FINNHUB_API_KEY` in GitHub Secrets. If the endpoint still returns 403 with a valid key, the free plan no longer covers economic calendar — upgrade to Starter plan (~$0-50/month) or switch provider. |

**To validate manually:**
```
curl "https://finnhub.io/api/v1/calendar/economic?from=2026-06-01&to=2026-06-30&token=YOUR_KEY"
```
Expected success: `{ "economicCalendar": [ { "event": "...", ... } ] }`
Expected plan error: `{ "error": "You don't have access to this resource." }` (HTTP 403)

---

### 2. Alpha Vantage

| Field | Value |
|---|---|
| Endpoint | `https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&horizon=3month` |
| Free tier | 25 requests/day (severe) |
| Actual / Forecast / Previous | Yes — CSV columns: Name,Country,Date,Actual,Previous,Estimate,Impact |
| Upcoming events | Yes — 3-month window |
| Commercial use | Paid plan required for commercial |
| Pricing | Free → Premium from ~$50/month |
| Response format | CSV (JSON error response on auth failure) |
| Diagnosis | Free tier returns `{ "Note": "..." }` (rate limit) or `{ "Information": "..." }` (auth/plan). Auth errors and rate limit errors look identical. Free-tier API key may have been created before the endpoint was gated. |
| Fix | Generate a new key at https://www.alphavantage.co/support/#api-key. Test directly with: `curl "https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&horizon=3month&apikey=YOUR_KEY"` — expect CSV, not JSON. If still gated, upgrade to Premium. |

**To validate manually:**
```
curl "https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&horizon=3month&apikey=YOUR_KEY"
```
Expected success: CSV starting with `name,country,releaseDate,...`
Expected rate limit: `{ "Note": "Thank you for using Alpha Vantage!" }`
Expected auth fail: `{ "Information": "Please claim your free API key..." }`

---

### 3. Trading Economics

| Field | Value |
|---|---|
| Endpoint | `https://api.tradingeconomics.com/calendar` |
| Free tier | Demo key available (`guest:guest`) but limited to ~10 events |
| Actual / Forecast / Previous | Yes — best coverage globally |
| Upcoming events | Yes — 30+ day look-ahead |
| Commercial use | No on free tier; requires subscription |
| Pricing | Plans from ~$75/month; API add-on from ~$99/month |
| Response format | JSON array |
| Diagnosis | No key configured. TE is premium-only for production volume. The demo key `guest:guest` can be used for testing only. |
| Fix | Subscribe at https://tradingeconomics.com/api or use demo key for smoke testing. |

---

### 4. FMP (Financial Modeling Prep)

| Field | Value |
|---|---|
| Endpoint | `https://financialmodelingprep.com/stable/economic-calendar` |
| Free tier | No — economic calendar is a paid feature |
| Actual / Forecast / Previous | Yes |
| Upcoming events | Yes |
| Commercial use | Yes |
| Pricing | Plans from $19/month |
| Response format | JSON array |
| Diagnosis | 402 response confirms this is behind a paywall. The endpoint changed to `/stable/` in 2024 and requires an active subscription. |
| Fix | Upgrade FMP subscription at https://financialmodelingprep.com/developer/docs/pricing or remove from provider list to stop 402 noise. |

---

### 5. FRED (Federal Reserve Economic Data)

| Field | Value |
|---|---|
| Endpoint | `https://api.stlouisfed.org/fred/releases/dates` |
| Free tier | Yes — completely free, no auth required |
| Actual / Forecast / Previous | Actuals only (no consensus forecasts) |
| Upcoming events | Partial — returns past release dates per series, not a forward calendar |
| Commercial use | Yes — public domain |
| Pricing | Free |
| Response format | JSON |
| Diagnosis | FRED is a time-series database, not an event calendar. `/releases/dates` lists historical release dates, not future scheduled events. It is not suitable as a macro calendar source. |
| Fix | Keep as supplement for US data validation only; do not use as primary calendar provider. For upcoming FRED release schedules, scrape https://www.stlouisfed.org/news-releases or use the FRED release calendar static JSON if ever published. |

---

## Alternative providers

### 6. BLS (Bureau of Labor Statistics) — US government

| Field | Value |
|---|---|
| API | `https://api.bls.gov/publicAPI/v2/` |
| Release calendar | Static schedule at https://www.bls.gov/bls/news-release/archives.htm |
| Free | Yes — public domain |
| Rate limit | 50 calls/day unregistered; 500/day registered (free) |
| Actual / Forecast / Previous | Actuals only |
| Upcoming events | Via schedule scrape only — no programmatic calendar API |
| Format | JSON (time series), HTML (schedule) |
| Notes | Good for NFP/CPI/PPI actuals but the release calendar must be parsed from HTML. Not practical as a real-time calendar source. |

### 7. ECB (European Central Bank)

| Field | Value |
|---|---|
| Source | https://www.ecb.europa.eu/press/calendars/mktcal/html/index.en.html |
| Free | Yes — public |
| Format | HTML only — no JSON/CSV API |
| Notes | Parseable but requires DOM scraping; EU-focused events only. |

### 8. UK ONS (Office for National Statistics)

| Field | Value |
|---|---|
| Source | https://www.ons.gov.uk/releasecalendar |
| Free | Yes — public domain |
| Format | HTML + ICS calendar feed |
| Notes | The ICS feed at `https://www.ons.gov.uk/generator?format=ics&uri=/releasecalendar` is machine-readable and parseable with an ICS parser. UK-focused only. |

### 9. Polygon.io

| Field | Value |
|---|---|
| Economic calendar | No dedicated endpoint |
| Notes | Equities/forex/crypto focused. Not viable for macro calendar. |

### 10. Nasdaq Data Link (formerly Quandl)

| Field | Value |
|---|---|
| Economic calendar | No — historical datasets only |
| Notes | No forward-looking calendar. Historical macro series available. |

---

## Recommended recovery plan

### Phase 1: Immediate (rotate keys, no code changes)

1. **Rotate `FINNHUB_API_KEY`** — generate a new key at finnhub.io and update GitHub Secret. Test with the curl above. If a fresh key still gets 403, the endpoint requires a paid plan.
2. **Rotate `ALPHAVANTAGE_API_KEY`** — generate a new key at alphavantage.co and update GitHub Secret. Test with the curl above.
3. If both still fail with valid keys → move to Phase 2.

### Phase 2: Cheap alternatives

**Option A — Trading Economics demo key (quick test)**
Set `TRADING_ECONOMICS_API_KEY=guest:guest` in GitHub Secrets. This is TE's public demo key. Limited to ~10 sample events but confirms the provider integration works. Upgrade to paid for production volume.

**Option B — Add a FRED-based release schedule parser**
The FRED API's `/releases` endpoint (no key required) returns release names and scheduled dates. Build a minimal adapter that maps release names to our event schema (CPI, NFP, GDP, etc.) and extracts the `realtime_start` as the scheduled release date.
- No auth required
- No rate limit risk
- US-only but covers the highest-impact events

**Option C — ONS ICS scraper**
Parse the ONS ICS calendar feed for UK macro events (BoE, CPI, GDP) as a supplement.

### Phase 3: Paid provider (if budget available)

Subscribe to one of:
- **Finnhub Starter** (~$0–50/month) — already integrated, just needs key upgrade
- **Trading Economics API** (~$99/month) — best global coverage
- **FMP Essential** (~$19/month) — already integrated, just needs plan upgrade

---

## Diagnosing provider failures with ?ec_debug=raw

Hit the live API with the raw diagnostic flag to see actual error bodies:

```
GET /api/economic-calendar?ec_debug=raw
```

Each failed provider in `providers[name]` will include:
- `raw_body_preview` — first 600 chars of the raw HTTP response body
- `response_headers` — content-type, x-ratelimit-limit, retry-after

This is the fastest way to confirm whether a 403 means "invalid key" vs "upgrade required".
