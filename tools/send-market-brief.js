'use strict';

// Reads latest market brief and sends formatted message to Telegram.
// Usage: node tools/send-market-brief.js [--locale=en|ar|both] [--send] [--dry-run] [--date=YYYY-MM-DD]
// Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or TELEGRAM_CHANNEL_ID) when --send is used.

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const { formatBrief } = require('./providers/market-brief/telegram-formatter');

const ROOT       = path.resolve(__dirname, '..');
const BRIEF_DIR  = path.join(ROOT, 'data', 'market-brief');

const dateArg   = argValue('--date');
const localeArg = argValue('--locale') || 'both';
const dryRun    = !process.argv.includes('--send');

if (!['en', 'ar', 'both'].includes(localeArg)) {
  fail('--locale must be en, ar, or both');
}

const brief = loadBrief(dateArg);
if (!brief) fail('No market brief found. Run: node tools/generate-market-brief.js --write');

const token = process.env.TELEGRAM_BOT_TOKEN || '';
const { chatId, source: chatIdSource, masked: chatIdMasked } = resolveTelegramTarget();

if (!dryRun && (!token || !chatId)) {
  fail('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (or TELEGRAM_CHANNEL_ID) are required when --send is used.');
}

const posts = [];
if (localeArg === 'en'   || localeArg === 'both') posts.push({ text: formatBrief(brief, 'en'), locale: 'en' });
if (localeArg === 'ar'   || localeArg === 'both') posts.push({ text: formatBrief(brief, 'ar'), locale: 'ar' });

if (dryRun) {
  console.log('[market-brief] DRY_RUN mode — pass --send to deliver to Telegram\n');
  posts.forEach((p) => {
    console.log(`\n--- Preview (${p.locale}) ---`);
    console.log(p.text);
    console.log('---');
  });
  process.exit(0);
}

console.log(`[market-brief] Telegram target: source=${chatIdSource} value=${chatIdMasked}`);

(async () => {
  for (const post of posts) {
    const result = await apiCall(token, 'sendMessage', {
      chat_id:                  chatId,
      text:                     post.text,
      disable_web_page_preview: false,
    });
    const msgId = result?.message_id || '?';
    console.log(`[market-brief] Sent (${post.locale}) message_id=${msgId}`);
  }
  console.log('[market-brief] Delivery complete.');
})().catch((err) => fail(err.message));

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadBrief(date) {
  if (date) {
    const p = path.join(BRIEF_DIR, `daily-brief-${date}.json`);
    return readJson(p);
  }
  const latestPath = path.join(BRIEF_DIR, 'latest-brief.json');
  if (fs.existsSync(latestPath)) return readJson(latestPath);

  // Fall back to most recent dated file
  if (!fs.existsSync(BRIEF_DIR)) return null;
  const files = fs.readdirSync(BRIEF_DIR)
    .filter((f) => /^daily-brief-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()
    .reverse();
  return files.length ? readJson(path.join(BRIEF_DIR, files[0])) : null;
}

function apiCall(tokenValue, method, params) {
  const body = JSON.stringify(params);
  const options = {
    hostname: 'api.telegram.org',
    path:     `/bot${tokenValue}/${method}`,
    method:   'POST',
    headers: {
      'Content-Type':   'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body, 'utf8'),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return reject(new Error(`Non-JSON: ${data.slice(0, 120)}`)); }
        if (!parsed.ok) return reject(new Error(`Telegram ${res.statusCode}: ${parsed.description || data.slice(0, 80)}`));
        resolve(parsed.result);
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Telegram API timeout')));
    req.write(body, 'utf8');
    req.end();
  });
}

function resolveTelegramTarget() {
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim()
    || (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  const source = (process.env.TELEGRAM_CHAT_ID || '').trim() ? 'CHAT_ID' : 'CHANNEL_ID';
  const masked = chatId ? chatId.slice(0, 6) + '***' : '(none)';
  return { chatId: chatId || null, source, masked };
}

function readJson(filePath) {
  try {
    return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null;
  } catch (_) { return null; }
}

function argValue(name) {
  const match = process.argv.find((a) => a.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(`[market-brief] Error: ${message}`);
  process.exit(1);
}
