# Telegram Distribution Setup

The Telegram publisher is intentionally manual and dry-run first. It does not auto-send messages unless `--send` is passed.

## Environment Variables

Required only when sending:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHANNEL_ID`

Optional:

- `SITE_URL`, defaults to `https://www.tradealphaai.com`

Never commit tokens or channel secrets.

## Dry Run Preview

Preview both English and Arabic messages:

```powershell
node tools/telegram-publish-article.js --slug=<slug> --allow-unpublished
```

Preview one locale:

```powershell
node tools/telegram-publish-article.js --slug=<slug> --locale=en --allow-unpublished
node tools/telegram-publish-article.js --slug=<slug> --locale=ar --allow-unpublished
```

The tool prints the Telegram message body and article URL without contacting Telegram.

## Manual Send

Only send after the article is public, reviewed, and marked `published` in `data/editorial-topic-queue.json`.

```powershell
$env:TELEGRAM_BOT_TOKEN='<token>'
$env:TELEGRAM_CHANNEL_ID='<channel>'
node tools/telegram-publish-article.js --slug=<slug> --send
```

Add a manual delay between EN and AR posts if needed:

```powershell
node tools/telegram-publish-article.js --slug=<slug> --send --delay-ms=5000
```

## Formatting Rules

- Keep posts short.
- Include the article title.
- Include a clear educational disclaimer.
- Use the canonical public article URL.
- Do not include price targets, buy/sell wording, or performance promises.
- Keep social previews enabled unless a preview image is broken.

## Safety Behavior

- Dry run is the default.
- The tool refuses to send unless the topic status is `published`.
- `--allow-unpublished` is for local preview only.
- Secrets are read from environment variables only.
