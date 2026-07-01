# Substack Daily Newsletter — Semi-Automated Flow

**Why semi-auto?** Substack sits behind Cloudflare, which blocks HTTP requests
from GitHub Actions runner IPs with a JavaScript challenge that a plain HTTPS
client cannot solve. Rather than fight that arms race, the workflow does
everything up to (but not including) the final "Send" click in Substack.

Your daily commitment: **~30 seconds** to open Substack and paste.

---

## What the workflow does

Every morning at **08:00 UTC** (11:00 Riyadh / 04:00 New York), a GitHub
Actions job:

1. Collects everything published to your site in the last 24h
   (research articles + news + market outlooks)
2. Writes a public archive page at `https://www.tradealphaai.com/newsletter/YYYY-MM-DD.html`
   (also updates `/newsletter/` archive index — good SEO)
3. Builds a Substack-ready Markdown digest
4. Sends it to your Telegram as a copy-block + a one-tap link to Substack's
   "new post" editor

Your job:
5. Long-press the code block in Telegram → **Copy**
6. Tap the "Open Substack editor" link
7. Paste into the editor → click **Send** → done

---

## One-time setup

The workflow needs **two** secrets:

| Secret | What it is | Where to get it |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Your existing bot token (already set) | Already in repo |
| `TELEGRAM_ADMIN_CHAT_ID` | YOUR personal Telegram chat id — NOT the public channel | See below |

**Critical**: the digest contains copy-paste prep messages meant only for you.
If you set it to the public channel id, your subscribers will see the
workflow reminders. The code refuses to run without a dedicated admin id.

### Getting your personal chat id

1. Open Telegram → search for **@userinfobot** → tap Start
2. It replies with `Your ID: 123456789` — copy that number
3. **Very important**: also start a DM with the bot that publishes to your
   public channel. Search its name in Telegram, tap it, send `/start`. Bots
   cannot DM users who haven't messaged them first.
4. Add the number as a new GitHub secret:
   ```
   https://github.com/SkybridgeFlights/TradeAlphaAI/settings/secrets/actions
   → New repository secret
   → Name:  TELEGRAM_ADMIN_CHAT_ID
   → Value: <the number from step 2>
   ```

### Optional: delete the old Substack secrets

If you set up `SUBSTACK_SESSION_COOKIE` or `SUBSTACK_USER_ID` earlier, you can
delete them — they are no longer used and leaving them adds no value:

```
https://github.com/SkybridgeFlights/TradeAlphaAI/settings/secrets/actions
```

Click the ⋯ next to each and choose Remove.

---

## Test it now

1. Open https://github.com/SkybridgeFlights/TradeAlphaAI/actions
2. Click **Daily Newsletter** in the sidebar
3. Click **Run workflow** (top right)
4. Leave defaults (or set `window_hours = 168` to pull the last week) → **Run workflow**
5. Wait ~30s. Check your Telegram — the digest should arrive as one intro
   message + one or more code blocks

---

## Daily flow

**In Telegram**, when the message arrives:

1. Long-press the code block (the one that starts with "Good morning...")
   → **Copy**
2. Tap the "Open Substack editor" link in the intro message
3. In Substack:
   - Paste the copied content into the editor (Substack auto-parses the
     Markdown)
   - Adjust the title if you want (default is fine)
   - Click **Publish** → **Send to everyone** → done

Total time: ~30 seconds.

If the digest arrives on a quiet day (0 items), you can skip sending — the
archive page is still generated and the Telegram notification will say so.

---

## Optional: also on mobile

The Substack mobile app makes this even faster:

1. In Telegram mobile, long-press the code block → **Copy**
2. Open Substack app → **New post** (⊕ button)
3. Paste → hit **Send**

30 seconds on the phone, no laptop needed.

---

## Troubleshooting

### No Telegram message
Check the workflow run log. If it says `[telegram] TELEGRAM_BOT_TOKEN or
TELEGRAM_CHAT_ID missing` — verify both secrets exist in
`Settings → Secrets and variables → Actions`.

### Message split into multiple parts
Normal on busy days. Telegram caps messages at 4096 chars; the tool chunks on
paragraph boundaries. Copy each block in order and paste them into Substack
sequentially — the paragraph breaks stay intact.

### Substack doesn't auto-render the Markdown
Substack's editor understands `##`, `**bold**`, `[link](url)`, `---` out of
the box. If a paste looks broken:
- Use the ⊕ menu in the Substack editor → **Import Markdown** for reliable
  parsing on longer digests
- Or paste into `https://tradealphaai.substack.com/publish/post?type=newsletter`
  which is the direct link the Telegram intro sends you to

### I want to skip a day
Just don't tap **Send** in Substack. The archive page still gets committed to
your site (good — it's an SEO win either way). Nothing tries to send twice.

### I want to run it mid-day for a fresh batch
`Actions → Daily Newsletter → Run workflow → window_hours = 4` will pull just
the last 4 hours.

### I want to disable the automatic 08:00 UTC run
`Actions → Daily Newsletter → ··· → Disable workflow` (top right).

---

## When to revisit full automation

The current semi-auto flow is stable and free. Revisit full automation only
when **at least one** of these is true:

- You have 500+ Substack subscribers (30 s/day × 365 = enough time to be
  worth the engineering investment)
- Substack publishes an official public API for free-tier publications
- You want to move off Substack entirely (switch to Buttondown, Loops,
  Resend, Beehiiv, etc. — all have real APIs and free tiers up to
  100–1000 subscribers)

Until then, the semi-auto flow is the right level of automation for the
subscriber base.
