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

// Phase 117 — daily-research notes (published under /market-news/) and
// market-structure notes (published under /market-structure/) join the
// controlled Telegram channel. Both are bilingual EN/AR.
const SUPPORTED_TYPES = ['editorial', 'market-outlook', 'continuous-intelligence', 'daily-research', 'market-structure', 'educational'];

// Phase 117 — safety caps for controlled activation (ledger-enforced).
const PER_DAY_CAP = Number(process.env.TELEGRAM_PER_DAY_CAP || 6);
const PER_TYPE_COOLDOWN_HOURS = Number(process.env.TELEGRAM_TYPE_COOLDOWN_HOURS || 6);

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

// Phase 117 — ledger-enforced anti-spam: per-day cap + per-content-type cooldown.
function sentToday() {
  const today = new Date().toISOString().slice(0, 10);
  return readLedger().deliveries.filter(d => d.status === 'sent' && String(d.sent_at || '').slice(0, 10) === today).length;
}
function cooldownActive() {
  const last = readLedger().deliveries
    .filter(d => d.status === 'sent' && d.content_type === CONTENT_TYPE && d.sent_at)
    .map(d => Date.parse(d.sent_at)).sort((a, b) => b - a)[0];
  if (!last) return false;
  return (Date.now() - last) < PER_TYPE_COOLDOWN_HOURS * 3600000;
}

// Phase 117 — controlled activation requires the live EN URL to return 200 and
// (for bilingual content) the AR page to exist on disk before any send.
function verifyUrl(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// ── URL resolution ───────────────────────────────────────────────────────────

const PATH_BY_TYPE = {
  'editorial':               { en: `insights/${SLUG}.html`,      ar: `ar/insights/${SLUG}.html` },
  'market-outlook':          { en: `market-outlook/${SLUG}.html`, ar: `ar/market-outlook/${SLUG}.html` },
  'continuous-intelligence': { en: `intelligence/${SLUG}.html`,   ar: `ar/intelligence/${SLUG}.html` },
  'daily-research':          { en: `market-news/${SLUG}.html`,    ar: `ar/market-news/${SLUG}.html` },
  'market-structure':        { en: `market-structure/${SLUG}.html`, ar: `ar/market-structure/${SLUG}.html` },
  'educational':             { en: `articles/${SLUG}.html`,        ar: `ar/articles/${SLUG}.html` },
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

function extractH1(htmlPath) {
  try {
    const m = fs.readFileSync(htmlPath, 'utf8').match(/<h1>([\s\S]*?)<\/h1>/i);
    return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
  } catch { return null; }
}

function resolveMeta() {
  let titleEn = null, titleAr = null, summaryEn = null, summaryAr = null, extra = {};

  // Phase 117 — research / structure notes carry their title in the <h1> and the
  // institutional summary in the description meta (bilingual EN/AR pages).
  if (CONTENT_TYPE === 'daily-research' || CONTENT_TYPE === 'market-structure' || CONTENT_TYPE === 'educational') {
    titleEn = extractH1(path.join(ROOT, PATH_BY_TYPE[CONTENT_TYPE].en));
    titleAr = extractH1(path.join(ROOT, PATH_BY_TYPE[CONTENT_TYPE].ar));
    summaryEn = null; // the page description is just "title — disclaimer"; use a clean topic-named line instead
  }

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

// Market framing before links — newsroom register keyed to the desk's bias.
const BIAS_FRAMING = {
  'cautiously bullish': 'The desk leans constructive — conditional on the catalyst path holding.',
  'cautiously bearish': 'The desk leans defensive — risk skew matters more than direction here.',
  'neutral': 'The desk sees a contested tape — positioning, not conviction, drives the next move.',
  'neutral-to-constructive': 'Constructive undertone, but the desk wants confirmation before leaning in.',
  'selective risk-on': 'Risk appetite is selective — leadership quality is the tell.',
  'defensive': 'Defensive posture: the desk is watching where hedges are being built.',
  'risk-off stabilization': 'Stabilization phase — the desk is tracking whether the selling is exhausted.',
  'elevated uncertainty': 'Uncertainty premium is the story — the desk maps both tails.',
  'mixed / range-bound': 'Range logic rules — the desk frames the breakout conditions.',
};

function marketFraming(bias) {
  return BIAS_FRAMING[String(bias || '').toLowerCase()] || null;
}

// Newsroom pulse context: verified session commentary plus urgency awareness.
// Only verified pulse output is quoted — degraded/unverified pulse stays out
// of public deliveries.
function pulseContext() {
  const pulse = readJson(path.join(ROOT, 'data', 'intelligence', 'market-pulse.json'));
  if (!pulse || pulse.verified !== true) return { line: null, urgent: false };
  return {
    line: pulse.pulse_banner || null,
    urgent: pulse.dimensions && pulse.dimensions.volatility_regime === 'stressed',
  };
}

function buildMessage(meta, urls) {
  const takeaway = oneLineTakeaway(meta.summaryEn);
  const pulse = pulseContext();
  const hook = `${pulse.urgent ? '⚡ ' : ''}${pickHook(CONTENT_TYPE, SLUG)}`;
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
      const framing = marketFraming(meta.directional_bias);
      if (framing) parts.push(framing);
    }
    if (pulse.line) parts.push('', `📡 Pulse: ${pulse.line}`);
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

  // Phase 117 — restrained institutional style for research / structure notes:
  // type label, title, one-sentence summary, EN/AR links. No advice, no hype.
  if (CONTENT_TYPE === 'daily-research' || CONTENT_TYPE === 'market-structure' || CONTENT_TYPE === 'educational') {
    const typeLabel = CONTENT_TYPE === 'daily-research' ? 'Research Note' : CONTENT_TYPE === 'market-structure' ? 'Market Structure' : 'Educational';
    const summary = takeaway || `A new TradeAlphaAI ${typeLabel.toLowerCase()} examines ${String(meta.titleEn || '').toLowerCase()}.`;
    const parts = [
      `${typeLabel} — ${meta.titleEn}`,
      '',
      summary,
      '',
      `EN: ${urls.url}`,
    ];
    if (meta.titleAr || urls.ar_url) parts.push(`AR: ${urls.ar_url}`);
    parts.push('', 'Educational market analysis — not investment advice.');
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

  // Anti-spam: per-day cap + per-type cooldown (skip green, never error).
  if (sentToday() >= PER_DAY_CAP) {
    console.log(`[TELEGRAM DELIVERY] per-day cap reached (${PER_DAY_CAP}) — skipping`);
    process.exit(0);
  }
  if (cooldownActive()) {
    console.log(`[TELEGRAM DELIVERY] per-type cooldown active (${PER_TYPE_COOLDOWN_HOURS}h for ${CONTENT_TYPE}) — skipping`);
    process.exit(0);
  }

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

  // URL-200 gate: never post a link that is not live. For bilingual content the
  // AR page must also exist on disk before we advertise an AR link.
  const arDiskPath = path.join(ROOT, PATH_BY_TYPE[CONTENT_TYPE].ar);
  if (!fs.existsSync(arDiskPath)) {
    console.error(`[TELEGRAM DELIVERY] AR page missing on disk (${PATH_BY_TYPE[CONTENT_TYPE].ar}) — refusing to send bilingual post`);
    process.exit(1);
  }
  const live = await verifyUrl(urls.url);
  if (!live) {
    console.error(`[TELEGRAM DELIVERY] EN URL not live (200) yet: ${urls.url} — refusing to send`);
    process.exit(1);
  }
  console.log(`[TELEGRAM DELIVERY] URL-200 verified: ${urls.url}`);

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
