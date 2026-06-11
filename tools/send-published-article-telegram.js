'use strict';

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT        = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'telegram-delivery-ledger.json');
const SITE_URL    = 'https://www.tradealphaai.com';

// ── CLI parsing ──────────────────────────────────────────────────────────────

function arg(flag) {
  const m = process.argv.find(a => a.startsWith(`--${flag}=`));
  return m ? m.slice(flag.length + 3) : null;
}

const SMOKE_TEST = process.argv.includes('--smoke-test');
const SLUG         = arg('slug');
const CONTENT_TYPE = arg('content-type');
const SOURCE       = arg('source') || 'primary';
const DRY_RUN      = !SMOKE_TEST && (process.argv.includes('--dry-run') || !process.argv.includes('--send'));

// ── Validation ───────────────────────────────────────────────────────────────

const SUPPORTED_TYPES = ['editorial', 'market-outlook', 'continuous-intelligence'];

if (!SMOKE_TEST) {
  if (!SLUG) {
    console.error('[TELEGRAM DELIVERY] --slug is required');
    process.exit(1);
  }
  if (!CONTENT_TYPE || !SUPPORTED_TYPES.includes(CONTENT_TYPE)) {
    console.error(`[TELEGRAM DELIVERY] --content-type must be one of: ${SUPPORTED_TYPES.join(', ')}`);
    process.exit(1);
  }
  if (!['primary', 'recovery'].includes(SOURCE)) {
    console.error('[TELEGRAM DELIVERY] --source must be primary or recovery');
    process.exit(1);
  }
}

// ── Ledger ───────────────────────────────────────────────────────────────────

function readLedger() {
  try {
    return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
  } catch {
    return { schema_version: '1.0', deliveries: [] };
  }
}

function appendLedger(entry) {
  const ledger = readLedger();
  ledger.deliveries.push(entry);
  fs.writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
}

function isDuplicate() {
  const ledger = readLedger();
  return ledger.deliveries.some(
    d => d.slug === SLUG && d.content_type === CONTENT_TYPE && d.status === 'sent'
  );
}

// ── URL resolution ───────────────────────────────────────────────────────────

const PATH_BY_TYPE = {
  'editorial':               { en: `insights/${SLUG}.html`,      ar: `ar/insights/${SLUG}.html` },
  'market-outlook':          { en: `market-outlook/${SLUG}.html`, ar: `ar/market-outlook/${SLUG}.html` },
  'continuous-intelligence': { en: `intelligence/${SLUG}.html`,   ar: `ar/intelligence/${SLUG}.html` },
};

function resolveUrls() {
  const p = PATH_BY_TYPE[CONTENT_TYPE];
  return { url: `${SITE_URL}/${p.en}`, ar_url: `${SITE_URL}/${p.ar}` };
}

// ── Metadata resolution ──────────────────────────────────────────────────────

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function extractHtmlMeta(htmlPath, name) {
  try {
    const html = fs.readFileSync(htmlPath, 'utf8');
    const hit = html.match(new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'))
             || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["']`, 'i'));
    return hit ? hit[1].trim() : null;
  } catch { return null; }
}

function resolveMeta() {
  let titleEn = null, titleAr = null, summaryEn = null, summaryAr = null, extra = {};

  if (CONTENT_TYPE === 'market-outlook') {
    const queue = readJson(path.join(ROOT, 'data', 'market-outlook-queue.json'));
    const topic = (queue && queue.topics || []).find(t => t.slug === SLUG);
    if (topic) {
      titleEn   = topic.title_en;
      titleAr   = topic.title_ar;
      summaryEn = topic.summary_en;
      summaryAr = topic.summary_ar;
      extra.directional_bias = topic.directional_bias;
    }
  }

  if (CONTENT_TYPE === 'editorial') {
    const registry = readJson(path.join(ROOT, 'data', 'insights', 'article-registry.json'));
    const article  = (registry && registry.articles || []).find(a => a.slug === SLUG);
    if (article && article.languages) {
      titleEn   = article.languages.en && article.languages.en.title;
      titleAr   = article.languages.ar && article.languages.ar.title;
      summaryEn = article.languages.en && article.languages.en.summary;
      summaryAr = article.languages.ar && article.languages.ar.summary;
    }
  }

  if (CONTENT_TYPE === 'continuous-intelligence') {
    const ci  = readJson(path.join(ROOT, 'data', 'continuous-intelligence-history.json'));
    const pub = (ci && ci.publications || []).find(p => p.slug === SLUG);
    if (pub) {
      titleEn   = pub.title_en;
      titleAr   = pub.title_ar;
      summaryEn = pub.summary_en || null;
      summaryAr = pub.summary_ar || null;
      extra.family     = pub.family;
      extra.confidence = pub.confidence;
    }
  }

  // HTML meta fallback for title and summary
  if (!titleEn) {
    const htmlPath = path.join(ROOT, PATH_BY_TYPE[CONTENT_TYPE].en);
    titleEn   = extractHtmlMeta(htmlPath, 'twitter:title')
             || extractHtmlMeta(htmlPath, 'og:title')
             || SLUG;
    summaryEn = extractHtmlMeta(htmlPath, 'description')
             || extractHtmlMeta(htmlPath, 'og:description')
             || '';
  }

  return { titleEn: titleEn || SLUG, titleAr, summaryEn: summaryEn || '', summaryAr, ...extra };
}

// ── Message builder ──────────────────────────────────────────────────────────

function oneLineTakeaway(text) {
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const first = (sentences[0] || text).trim();
  // Strip leading boilerplate so the takeaway reads like analyst commentary.
  return first
    .replace(/^(Educational (overview|analysis|context) (of|for)\s*)/i, '')
    .replace(/^./, (c) => c.toUpperCase())
    .slice(0, 220)
    .trim();
}

// Per-vertical Telegram identity comes from the Phase 69 persona registry so
// every desk keeps a distinct voice from a single source of truth.
const { verticalForContentType } = require('./editorial-personas');

function verticalConfig(type) {
  const vertical = verticalForContentType(type);
  if (vertical && vertical.telegram) return vertical.telegram;
  return {
    emoji: '📈',
    label: 'TradeAlphaAI Research',
    hashtags: '#TradeAlphaAI',
    hooks: ['New from the research desk.'],
  };
}

function pickHook(type, slug) {
  const pool = verticalConfig(type).hooks;
  let hash = 0;
  for (const ch of String(slug || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return pool[hash % pool.length];
}

function buildMessage(meta, urls) {
  const takeaway = oneLineTakeaway(meta.summaryEn);
  const hook = pickHook(CONTENT_TYPE, SLUG);
  const desk = verticalConfig(CONTENT_TYPE);

  if (CONTENT_TYPE === 'editorial') {
    const parts = [
      `${desk.emoji} ${desk.label} | ${hook}`,
      '',
      meta.titleEn,
      '',
      takeaway ? `Desk take: ${takeaway}` : '',
      '',
      `🔗 EN: ${urls.url}`,
      `🌐 AR: ${urls.ar_url}`,
      '',
      desk.hashtags,
    ];
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  if (CONTENT_TYPE === 'market-outlook') {
    const parts = [
      `${desk.emoji} ${desk.label} | ${hook}`,
      '',
      meta.titleEn,
      '',
      takeaway ? `Desk take: ${takeaway}` : '',
    ];
    if (meta.directional_bias) {
      parts.push('', `🧭 Bias: ${meta.directional_bias}`);
    }
    parts.push(
      '',
      `🔗 EN: ${urls.url}`,
      `🌐 AR: ${urls.ar_url}`,
      '',
      'Educational commentary — not investment advice.',
      desk.hashtags
    );
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  if (CONTENT_TYPE === 'continuous-intelligence') {
    const parts = [
      `${desk.emoji} ${desk.label} | ${hook}`,
      '',
      meta.titleEn,
      '',
      takeaway ? `Desk take: ${takeaway}` : '',
    ];
    if (meta.family) {
      parts.push('', `📡 Signal family: ${meta.family.replace(/_/g, ' ')}`);
    }
    parts.push(
      '',
      `🔗 EN: ${urls.url}`,
      `🌐 AR: ${urls.ar_url}`,
      '',
      'Educational market research — not investment advice.',
      desk.hashtags
    );
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  return `${meta.titleEn}\n\n${urls.url}`;
}

// ── Telegram send ────────────────────────────────────────────────────────────

function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return Promise.resolve(null);

  const payload = JSON.stringify({ chat_id: chatId, text });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) resolve(parsed.result);
          else reject(new Error(`Telegram API error: ${parsed.description || JSON.stringify(parsed)}`));
        } catch { reject(new Error('Invalid Telegram response')); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[TELEGRAM DELIVERY] slug=${SLUG} content_type=${CONTENT_TYPE} source=${SOURCE} dry_run=${DRY_RUN}`);

  if (isDuplicate()) {
    console.log(`[TELEGRAM DELIVERY] skipped duplicate slug=${SLUG} content_type=${CONTENT_TYPE}`);
    process.exit(0);
  }

  const urls = resolveUrls();
  const meta = resolveMeta();
  const text = buildMessage(meta, urls);

  console.log(`[TELEGRAM DELIVERY] title="${meta.titleEn}"`);
  console.log(`[TELEGRAM DELIVERY] url=${urls.url}`);
  console.log('[TELEGRAM DELIVERY] message preview:\n---');
  console.log(text);
  console.log('---');

  if (DRY_RUN) {
    console.log('[TELEGRAM DELIVERY] dry-run — pass --send to actually deliver');
    process.exit(0);
  }

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.log('[TELEGRAM DELIVERY] credentials unavailable — skipping send');
    process.exit(0);
  }

  const entry = {
    slug: SLUG,
    content_type: CONTENT_TYPE,
    url: urls.url,
    ar_url: urls.ar_url,
    sent_at: null,
    message_id: null,
    source: SOURCE,
    status: 'failed',
    reason: null,
  };

  try {
    const result = await sendTelegram(text);
    if (result && result.message_id) {
      entry.message_id = result.message_id;
      entry.sent_at    = new Date().toISOString();
      entry.status     = 'sent';
      entry.reason     = null;
      console.log(`[TELEGRAM DELIVERY] sent — message_id=${result.message_id}`);
    } else {
      entry.reason = 'no_message_id';
      console.error('[TELEGRAM DELIVERY] send returned no message_id — marking failed');
    }
  } catch (err) {
    entry.reason = err.message;
    console.error(`[TELEGRAM DELIVERY] send error: ${err.message}`);
  }

  appendLedger(entry);
  console.log(`[TELEGRAM DELIVERY] ledger updated — status=${entry.status}`);

  if (entry.status !== 'sent') process.exit(1);
}

// ── Smoke test ───────────────────────────────────────────────────────────────

async function runSmokeTest() {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('[TELEGRAM SMOKE TEST] credentials unavailable — set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID/TELEGRAM_CHANNEL_ID');
    process.exit(1);
  }

  const timestamp = new Date().toISOString();
  const text = `✅ TradeAlphaAI Telegram delivery test passed · ${timestamp}`;

  console.log('[TELEGRAM SMOKE TEST] sending test message...');
  let result;
  try {
    result = await sendTelegram(text);
  } catch (err) {
    console.error(`[TELEGRAM SMOKE TEST] FAIL: ${err.message}`);
    process.exit(1);
  }

  if (!result || !result.message_id) {
    console.error('[TELEGRAM SMOKE TEST] FAIL: no message_id returned');
    process.exit(1);
  }

  const smokeResult = {
    status: 'ok',
    message_id: result.message_id,
    timestamp,
    tested_at: new Date().toISOString(),
  };

  const smokePath = path.join(ROOT, 'data', 'telegram-smoke-test.json');
  fs.writeFileSync(smokePath, JSON.stringify(smokeResult, null, 2) + '\n', 'utf8');

  console.log(`[TELEGRAM SMOKE TEST] PASS — message_id=${result.message_id}`);
  console.log('[TELEGRAM SMOKE TEST] result written to data/telegram-smoke-test.json');
}

// ── Entry point ───────────────────────────────────────────────────────────────

const _runner = SMOKE_TEST ? runSmokeTest() : main();
_runner.catch(err => {
  console.error(`[TELEGRAM DELIVERY] fatal: ${err.message}`);
  process.exit(1);
});
