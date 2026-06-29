# Social Distribution Setup Guide

When the TradeAlpha Workflow publishes an article, the system also routes it
to Facebook, Instagram, X (Twitter), and LinkedIn — but only after each
platform's credentials are in place and its posting flag is enabled.

The default posture is **preview-only**. Adding credentials does not start
posting until you also set the per-platform posting flag.

---

## Safety model

For each platform, two things must be true before a real post can occur:

1. **Credentials** are present in GitHub Secrets (see per-platform sections below).
2. **Posting flag** `ENABLE_<PLATFORM>_POSTING` is set to `true` in GitHub Variables.

Until both are true, the adapter stays in `disabled` mode and never touches
the network. You can also set `SOCIAL_DRY_RUN=true` to validate everything
end-to-end without actually delivering.

All four platforms are independent: enabling Facebook does not affect X.

---

## 1. Facebook Page

**Free.** Requires a Facebook Page (not a personal profile).

### Get the credentials

1. Go to <https://developers.facebook.com/>, create an app of type **Business**.
2. Add the **Facebook Login** product to your app.
3. In the **App Settings**, go to **Permissions and Features** and request:
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
4. In **Tools > Graph API Explorer**:
   - Select your app.
   - Get a **User Access Token** with the three permissions above.
   - Then call `GET /me/accounts` — find your page and copy its `access_token` and `id`.
   - The page token is **short-lived** (~1 hour). Exchange it for a long-lived token using:
     ```
     GET /oauth/access_token?
       grant_type=fb_exchange_token&
       client_id={app-id}&
       client_secret={app-secret}&
       fb_exchange_token={short-lived-token}
     ```
   - Long-lived page tokens **never expire** (as long as you use them at least once every 60 days).

### Set GitHub secrets

| Name | Value |
|---|---|
| `FACEBOOK_PAGE_ID` | The page's numeric ID |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | The long-lived page token |

### Enable

In GitHub **Variables**: set `ENABLE_FACEBOOK_POSTING=true`.

---

## 2. Instagram Business

**Free.** Requires:
- Instagram **Business** or **Creator** account (not personal).
- Account linked to the same Facebook Page above.

### Get the credentials

1. In <https://business.facebook.com/>, go to **Business Settings > Accounts > Instagram accounts**, click **Add**, and connect the Instagram Business account to your Page.
2. Use the same app from the Facebook section, but also request the permissions:
   - `instagram_basic`
   - `instagram_content_publish`
3. With the same long-lived Page token, find the Instagram Business Account ID:
   ```
   GET /{page-id}?fields=instagram_business_account
   ```
   It returns something like `{ "instagram_business_account": { "id": "1784..." } }`.

### Set GitHub secrets

| Name | Value |
|---|---|
| `INSTAGRAM_BUSINESS_ACCOUNT_ID` | The IG Business Account numeric ID |
| `INSTAGRAM_ACCESS_TOKEN` | Same long-lived page token as Facebook |

### Enable

In GitHub **Variables**: set `ENABLE_INSTAGRAM_POSTING=true`.

> **Important:** Instagram is image-required. The system uses
> `data/social/exports/<slug>.png` if present, or falls back to
> `/Image/og-image.svg`. Make sure your site hosts the image at a public
> URL Instagram's crawler can reach (the production site URL works).

---

## 3. X (Twitter)

**Costs $200/month** for the Basic tier (writes ≥ 500/month). The Free tier
is severely limited (~500 writes/month total across all apps) and has very
restrictive read limits.

### Get the credentials

1. Go to <https://developer.x.com/>, create a project + app.
2. In **User Authentication Settings**, enable **OAuth 1.0a** and set
   permissions to **Read and Write**.
3. Set the **App permissions** to **Read and Write**.
4. From your app's **Keys and Tokens** page, generate:
   - **API Key** + **API Key Secret** (Consumer Keys)
   - **Access Token** + **Access Token Secret** (under "Access Token and Secret" — click Generate)

### Set GitHub secrets

| Name | Value |
|---|---|
| `X_API_KEY` | Consumer Key |
| `X_API_SECRET` | Consumer Secret |
| `X_ACCESS_TOKEN` | User Access Token |
| `X_ACCESS_SECRET` | User Access Token Secret |

### Enable

In GitHub **Variables**: set `ENABLE_X_POSTING=true`.

> The post uses OAuth 1.0a HMAC-SHA1 signing internally (no extra library
> needed; Node's built-in `crypto` handles it). Images are uploaded via the
> v1.1 `media/upload.json` endpoint, then referenced in the v2 tweet by
> `media_ids`.

---

## 4. LinkedIn

**Free** for personal pages; Company Pages need additional approval.

### Get the credentials

1. Go to <https://www.linkedin.com/developers/>, create an app.
2. Under **Products**, request the **Share on LinkedIn** product (instant approval).
3. For personal page: also request **Sign In with LinkedIn using OpenID Connect**.
4. Generate an OAuth 2.0 access token with these scopes:
   - `w_member_social` (for personal page) **OR**
   - `w_organization_social` (for company page)
5. Get your URN:
   - Personal: `urn:li:person:{your-member-id}` — find your member ID at <https://api.linkedin.com/v2/me?oauth2_access_token={token}>.
   - Company: `urn:li:organization:{org-id}` — your company page ID.

> Personal access tokens **expire after 60 days**. You'll need to regenerate
> the token periodically. Company tokens via 3-legged OAuth refresh
> automatically if you store the refresh token.

### Set GitHub secrets

| Name | Value |
|---|---|
| `LINKEDIN_ACCESS_TOKEN` | OAuth 2.0 access token |
| `LINKEDIN_AUTHOR_URN` | Either `urn:li:person:{id}` or `urn:li:organization:{id}` |

### Enable

In GitHub **Variables**: set `ENABLE_LINKEDIN_POSTING=true`.

---

## Recommended rollout

Start with the **safest, lowest-risk** flow:

1. Set credentials for **Facebook** only (free, low-stakes).
2. Set `ENABLE_FACEBOOK_POSTING=true` AND `SOCIAL_DRY_RUN=true`.
3. Trigger the workflow manually from GitHub Actions and verify the dry-run
   shows "all gates passed; not delivering".
4. Once dry-run looks clean, set `SOCIAL_DRY_RUN=false`. Next publish will
   actually post to Facebook.
5. Watch Facebook for one publish cycle to confirm the post looks right.
6. Repeat for Instagram, LinkedIn. **Add X last** because of cost and the
   higher penalty for misconfigured tweets.

## Variables vs Secrets in GitHub

- **Secrets** (Settings → Secrets and variables → Actions → Secrets) — for
  tokens / keys / passwords. Encrypted at rest, never shown again.
- **Variables** (same page → Variables tab) — for flags like
  `ENABLE_X_POSTING=true`. Visible in workflow logs as plain text.

## Approval gate (optional)

You can require manual approval before any post goes live:

- Set GitHub Variable `REQUIRE_SOCIAL_APPROVAL=true`.
- The system will then refuse to post any item whose `approval_status` is
  not `approved`. Currently the orchestrator sets it to `approved` for all
  freshly-published articles; flip this if you want a human gate.

## Disabling everything quickly

If anything goes wrong, set **`SOCIAL_DRY_RUN=true`** as a GitHub Variable.
Every adapter immediately stops touching the network. No need to remove
credentials or flip individual platform flags.

## Per-post ledger

Every delivery attempt (success or skip) lands in
`data/social/delivery-ledger.json`. The workflow commits this file
automatically so you have an auditable record:

```json
{
  "platform": "facebook",
  "slug": "nfp-preview-2026-06-22",
  "content_type": "market-outlook",
  "status": "posted",
  "external_post_id": "1234567890123456_98765",
  "posted_at": "2026-06-30T10:23:11.456Z"
}
```

## Where the live code lives

- Adapters (one file per platform): `tools/social/adapters/`
- Gating + flag resolution: `tools/social/social-flags.js`
- Caption + length rules: `tools/social/platform-content-rules.js`
- Per-publish entry point: `tools/send-published-article-social.js`
- Workflow wiring: `.github/workflows/tradealpha-workflow.yml`
  (3 "Slot — X — Social distribution" steps, one per content bucket)
