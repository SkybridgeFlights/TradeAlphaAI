# Substack Daily Newsletter — One-Time Setup

The `Daily Newsletter` GitHub Action publishes a digest to
`tradealphaai.substack.com` every morning at **08:00 UTC** and emails it to all
subscribers. It authenticates against Substack with a session cookie copied
from a logged-in browser tab.

You only need to do this **once every ~90 days**, when the cookie expires.

---

## What you'll do

1. Log in to Substack in Chrome (or any browser)
2. Copy three values from the developer console
3. Paste them as GitHub Secrets

That's it.

---

## Step 1 — Log in

Open https://substack.com and sign in to the account that owns
`tradealphaai.substack.com`.

Confirm you can reach the dashboard at:
```
https://tradealphaai.substack.com/publish/home
```

If you cannot reach the dashboard, you are not signed in as the right user.

---

## Step 2 — Extract `substack.sid`

1. While on any `substack.com` or `tradealphaai.substack.com` page, press **F12**
   (or right-click → Inspect) to open DevTools
2. Go to the **Application** tab (Chrome) or **Storage** tab (Firefox)
3. In the left sidebar expand **Cookies** → click `https://substack.com`
4. Find the row named **`substack.sid`**
5. Double-click the value column and copy the entire string
   (it's long — starts with `s%3A` and contains a random token)

Keep this value secret — it can authenticate as you for ~90 days.

---

## Step 3 — Find your `user_id`

In the same DevTools, go to the **Console** tab and paste:

```js
fetch('https://tradealphaai.substack.com/api/v1/subscription', { credentials: 'include' })
  .then((r) => r.json()).then((d) => console.log('user_id =', d?.user?.id, 'publication =', d?.publication?.id));
```

Press Enter. You'll see something like:
```
user_id = 12345678 publication = 4567890
```

Copy the number after `user_id =`.

---

## Step 4 — Add GitHub Secrets

Open the repo settings:
```
https://github.com/SkybridgeFlights/TradeAlphaAI/settings/secrets/actions
```

Click **New repository secret** for each of:

| Name | Value |
|---|---|
| `SUBSTACK_SESSION_COOKIE` | the long `substack.sid` value from Step 2 |
| `SUBSTACK_USER_ID` | the number from Step 3 (e.g. `12345678`) |

The publication hostname is hardcoded to `tradealphaai.substack.com`. If you
ever rename the publication, also add `SUBSTACK_HOSTNAME` with the new value.

---

## Step 5 — Test the cookie (optional but recommended)

Trigger the workflow manually with `dry_run = true`:

1. Open https://github.com/SkybridgeFlights/TradeAlphaAI/actions
2. Click **Daily Newsletter** in the sidebar
3. Click **Run workflow** (top right) → set `dry_run = true` → **Run workflow**

The smoke-test step will hit Substack's `/api/v1/subscription` and confirm
your cookie is valid. If it fails, re-do Step 2 (the cookie may have expired
or you copied it from the wrong domain).

---

## Step 6 — Send your first newsletter

Once dry-run passes, trigger the workflow again with all defaults (no inputs).
It will:

1. Collect the last 24 hours of publishes from your three history files
2. Build a digest with research + news + outlooks
3. Write the public archive page to `/newsletter/YYYY-MM-DD.html`
4. Create a Substack draft, prepublish, publish, and **email subscribers**
5. Telegram you a confirmation message

After this first manual run, the workflow runs automatically every morning.

---

## Troubleshooting

### Smoke test fails with 401 / 403
Your cookie expired or you copied the wrong value. Re-do Step 2.

### Draft creates but publish fails
Substack sometimes rejects drafts that exceed length limits or violate spam
heuristics. Check the workflow log for the response body. Most commonly: too
many external links in a single post. Reduce the window-hours and retry.

### No items in the digest
Normal on quiet news days. The digest still publishes with a short message
pointing to the site catalog. If you'd rather skip publishing entirely on
quiet days, edit `tools/send-daily-newsletter.js` and exit early when
`items.length === 0`.

### Skipping a day
Just disable the workflow temporarily:
```
Actions → Daily Newsletter → ··· → Disable workflow
```
Re-enable when you're ready.

### Sending an extra newsletter mid-day
Use **Run workflow** with `window_hours = 4` (or whatever interval covers
just-published content).

---

## Cookie rotation reminder

The `substack.sid` cookie typically lasts ~90 days, but Substack may
invalidate it sooner if you sign out, change your password, or sign in from a
new location. Plan to re-do Step 2 quarterly.

A future enhancement could send you a Telegram warning ~7 days before
expiration; for now, the workflow's smoke-test step will fail loudly with
`401 Unauthorized` if the cookie has lapsed.
