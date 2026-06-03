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
  const title = isAr ? topic.title_ar : topic.title_en;
  const url = `${siteUrl}${isAr ? '/ar' : ''}/insights/${topic.slug}.html`;
  const cluster = topic.discovery_cluster || topic.category;
  const text = isAr
    ? `${title}\n\nبحث تعليمي جديد من TradeAlphaAI ضمن مكتبة أبحاث السوق. لا يمثل نصيحة مالية.\n\n${url}`
    : `${title}\n\nNew TradeAlphaAI educational research on ${cluster}. No financial advice.\n\n${url}`;
  return { locale, text };
}

function sendTelegram(token, chatId, text) {
  const body = JSON.stringify({
    chat_id: chatId,
    text,
    disable_web_page_preview: false
  });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Telegram API failed with ${res.statusCode}: ${data}`));
      });
    });
    req.on('error', reject);
    req.write(body);
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
