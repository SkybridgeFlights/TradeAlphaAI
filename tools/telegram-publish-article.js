'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const slug = argValue('--slug');
const localeArg = argValue('--locale') || 'both';
const dryRun = !process.argv.includes('--send');
const forceSend = process.argv.includes('--force-send');
const delayMs = Number(argValue('--delay-ms') || 0);
const siteUrl = (process.env.SITE_URL || 'https://www.tradealphaai.com').replace(/\/$/, '');

if (!slug) fail('Usage: node tools/telegram-publish-article.js --slug=<published-slug> [--locale=en|ar|both] [--send] [--force-send] [--delay-ms=5000]');
if (!['en', 'ar', 'both'].includes(localeArg)) fail('--locale must be en, ar, or both');

const queue = readJson(QUEUE_PATH);
const topic = queue.topics.find((item) => item.slug === slug);
if (!topic) fail(`Editorial topic not found: ${slug}`);
if (!forceSend && !['published', 'reviewed'].includes(topic.status)) {
  fail(`Refusing to post topic with status=${topic.status}. Telegram announcements require status=published or status=reviewed. Use --force-send only for manual recovery.`);
}

const posts = [];
if (localeArg === 'en' || localeArg === 'both') posts.push(formatPost(topic, 'en'));
if (localeArg === 'ar' || localeArg === 'both') posts.push(formatPost(topic, 'ar'));

if (dryRun) {
  console.log('DRY_RUN active. No Telegram message was sent.');
  posts.forEach((post, index) => {
    console.log(`\n--- Telegram preview ${index + 1} (${post.locale}) ---`);
    console.log(post.text);
  });
  process.exit(0);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHANNEL_ID;
if (!token || !chatId) fail('TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID are required when --send is used.');

(async () => {
  for (const post of posts) {
    if (delayMs > 0) await wait(delayMs);
    await sendTelegram(token, chatId, post.text);
    console.log(`Sent Telegram post for ${topic.slug} (${post.locale}).`);
  }
})().catch((error) => fail(error.message));

function formatPost(topic, locale) {
  const isAr = locale === 'ar';
  const title = resolveTitle(topic, locale);
  const summary = resolveSummary(topic, locale);
  const url = `${siteUrl}${isAr ? '/ar' : ''}/insights/${topic.slug}.html`;
  const tags = isAr ? '#TradeAlphaAI #ETF #استثمار' : '#TradeAlphaAI #ETF #Investing';
  return {
    locale,
    text: `${title}\n\n${summary}\n\n${url}\n\n${tags}`
  };
}

function resolveTitle(topic, locale) {
  const isAr = locale === 'ar';
  const candidates = isAr
    ? [
        extractHtmlMeta(`ar/insights/${topic.slug}.html`, ['og:title', 'twitter:title']),
        extractHtmlTitle(`ar/insights/${topic.slug}.html`),
        extractHtmlMeta(`drafts/editorial/${topic.slug}/ar.html`, ['og:title', 'twitter:title']),
        extractHtmlTitle(`drafts/editorial/${topic.slug}/ar.html`),
        topic.title_ar
      ]
    : [
        topic.title_en,
        extractHtmlMeta(`insights/${topic.slug}.html`, ['og:title', 'twitter:title']),
        extractHtmlTitle(`insights/${topic.slug}.html`),
        extractHtmlMeta(`drafts/editorial/${topic.slug}/en.html`, ['og:title', 'twitter:title']),
        extractHtmlTitle(`drafts/editorial/${topic.slug}/en.html`)
      ];

  for (const candidate of candidates) {
    const clean = cleanText(candidate, { requireArabic: isAr, stripBrand: true });
    if (isSafeText(clean, isAr)) return clean;
  }

  return isAr
    ? 'بحث تعليمي جديد من TradeAlphaAI'
    : topic.title_en || 'New TradeAlphaAI Educational Research';
}

function resolveSummary(topic, locale) {
  const isAr = locale === 'ar';
  const cluster = topic.discovery_cluster || topic.category || 'market research';
  const candidates = isAr
    ? [
        readArLocalizationSummary(topic.slug),
        extractHtmlDescription(`ar/insights/${topic.slug}.html`),
        extractHtmlDescription(`drafts/editorial/${topic.slug}/ar.html`)
      ]
    : [
        extractHtmlDescription(`insights/${topic.slug}.html`),
        extractHtmlDescription(`drafts/editorial/${topic.slug}/en.html`)
      ];

  for (const candidate of candidates) {
    const clean = cleanText(candidate, { requireArabic: isAr });
    if (isSafeText(clean, isAr)) return truncate(clean, isAr ? 180 : 170);
  }

  return isAr
    ? 'ملخص تعليمي قصير من TradeAlphaAI يوضح الفكرة البحثية دون تقديم نصيحة مالية.'
    : `Short educational summary from TradeAlphaAI on ${cluster}. No financial advice.`;
}

function readArLocalizationSummary(slugValue) {
  const file = path.join(ROOT, 'data', 'localization', 'ar-insight-content', `${slugValue}.json`);
  if (!fs.existsSync(file)) return '';
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data.summary || data.description || '';
  } catch (_) {
    return '';
  }
}

function extractHtmlDescription(relPath) {
  return extractHtmlMeta(relPath, ['description', 'og:description', 'twitter:description']);
}

function extractHtmlTitle(relPath) {
  const html = readTextIfExists(relPath);
  if (!html) return '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return h1[1];
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title ? title[1] : '';
}

function extractHtmlMeta(relPath, names) {
  const html = readTextIfExists(relPath);
  if (!html) return '';
  for (const name of names) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, 'i')
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) return match[1];
    }
  }
  return '';
}

function readTextIfExists(relPath) {
  const file = path.join(ROOT, relPath);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function cleanText(value, options = {}) {
  if (!value) return '';
  let text = String(value);
  text = decodeHtmlEntities(text.replace(/<[^>]+>/g, ' '));
  text = repairMojibake(text);
  text = decodeHtmlEntities(text);
  text = text.replace(/\s+/g, ' ').trim();
  if (options.stripBrand) text = text.replace(/\s*\|\s*TradeAlphaAI\s*$/i, '').trim();
  return text;
}

function repairMojibake(value) {
  if (!/[\u00d8\u00d9\u00c2\u00e2]/.test(value)) return value;
  try {
    const repaired = Buffer.from(value, 'latin1').toString('utf8');
    return scoreText(repaired) > scoreText(value) ? repaired : value;
  } catch (_) {
    return value;
  }
}

function scoreText(value) {
  const arabic = (value.match(/[\u0600-\u06ff]/g) || []).length;
  const broken = (value.match(/[\ufffd\u00d8\u00d9\u00c2\u00e2]|\?{2,}/g) || []).length;
  return arabic * 3 - broken * 4;
}

function isSafeText(value, requireArabic) {
  if (!value) return false;
  if (/[\ufffd]/.test(value) || /\?{2,}/.test(value)) return false;
  if (/[\u00d8\u00d9\u00c2\u00e2]/.test(value)) return false;
  if (requireArabic && !/[\u0600-\u06ff]/.test(value)) return false;
  return value.length >= 8;
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 1).replace(/\s+\S*$/, '') + '…';
}

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sendTelegram(tokenValue, chatIdValue, text) {
  const body = JSON.stringify({
    chat_id: chatIdValue,
    text,
    disable_web_page_preview: false
  });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${tokenValue}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body, 'utf8')
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Telegram API failed with ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body, 'utf8');
    req.end();
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`Unable to read ${path.relative(ROOT, file)}: ${error.message}`);
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
