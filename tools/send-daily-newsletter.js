#!/usr/bin/env node
'use strict';

// Daily newsletter generator — semi-automated Substack flow.
//
// Why semi-auto: Substack sits behind Cloudflare which blocks requests from
// GitHub Actions runner IPs (Azure ranges) with a JS challenge that a plain
// HTTPS client cannot solve. Rather than fight that arms race, this tool:
//
//   1. Collects items published in the last N hours across the 3 buckets
//   2. Writes a public archive page at /newsletter/YYYY-MM-DD.html (SEO)
//   3. Builds a Substack-ready Markdown body
//   4. Telegrams you the title + subtitle + a code-block containing the
//      Markdown so you can long-press to copy on mobile, then paste into
//      Substack's editor and hit Send (~30s of work)
//
// The tools/substack/ client is retained (unused) for the day CF relaxes or
// we move to Playwright-based automation.
//
// CLI:
//   --dry-run       Write archive only, skip Telegram
//   --window-hours  How far back to look. Default 24.
//
// Env (from GitHub Secrets, all optional except TELEGRAM_*):
//   TELEGRAM_BOT_TOKEN        required to notify
//   TELEGRAM_CHAT_ID          required to notify
//   SUBSTACK_HOSTNAME         e.g. tradealphaai.substack.com (default)

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');

const SITE_URL = 'https://www.tradealphaai.com';
const SUBSTACK_HOSTNAME = process.env.SUBSTACK_HOSTNAME || 'tradealphaai.substack.com';
const SUBSTACK_NEW_POST_URL = `https://${SUBSTACK_HOSTNAME}/publish/post?type=newsletter`;
const ARCHIVE_DIR = path.join(ROOT, 'newsletter');

// ── CLI parsing ──────────────────────────────────────────────────────────────

function arg(flag, def = null) {
  const m = process.argv.find((a) => a.startsWith(`--${flag}=`));
  if (m) return m.slice(flag.length + 3);
  return process.argv.includes(`--${flag}`) ? true : def;
}

const DRY_RUN = arg('dry-run') === true;
const WINDOW_HOURS = Number(arg('window-hours', '24')) || 24;

// ── History readers ──────────────────────────────────────────────────────────

const BUCKETS = [
  { id: 'editorial',                 historyFile: 'data/published-history.json',               dir: 'insights',       label: 'Research',  badge: 'Article'  },
  { id: 'market-outlook',            historyFile: 'data/market-outlook-history.json',          dir: 'market-outlook', label: 'Outlooks',  badge: 'Forecast' },
  { id: 'continuous-intelligence',   historyFile: 'data/continuous-intelligence-history.json', dir: 'intelligence',   label: 'News',      badge: 'News'     }
];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch { return fallback; }
}

function readArticleField(dir, slug, re) {
  const file = path.join(ROOT, dir, slug + '.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(re);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

function readTitle(dir, slug)       { return readArticleField(dir, slug, /<h1[^>]*>([\s\S]*?)<\/h1>/i); }
function readDescription(dir, slug) { return readArticleField(dir, slug, /<meta name="description" content="([^"]+)"/i); }

function collectRecent(windowHours) {
  const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
  const items = [];
  for (const bucket of BUCKETS) {
    const history = readJson(bucket.historyFile, { publications: [] });
    for (const pub of history.publications || []) {
      const slug = pub.slug;
      if (!slug) continue;
      const ts = Date.parse(pub.published_at || `${pub.publish_date || ''}T12:00:00Z`);
      if (!Number.isFinite(ts) || ts < cutoff) continue;
      const title = readTitle(bucket.dir, slug);
      if (!title) continue;
      items.push({
        bucketId: bucket.id,
        bucketLabel: bucket.label,
        badge: bucket.badge,
        slug,
        title,
        description: readDescription(bucket.dir, slug),
        publishedAt: pub.published_at || pub.publish_date,
        url: `${SITE_URL}/${bucket.dir}/${slug}.html`
      });
    }
  }
  items.sort((a, b) => Date.parse(b.publishedAt || 0) - Date.parse(a.publishedAt || 0));
  return items;
}

function todayLabel() {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date());
}

function isoDateUTC() {
  return new Date().toISOString().slice(0, 10);
}

function groupBy(items, key) {
  const out = {};
  for (const it of items) (out[it[key]] = out[it[key]] || []).push(it);
  return out;
}

function buildSubtitle(items) {
  if (!items.length) return 'A quiet cycle — site research catalog inside.';
  const counts = groupBy(items, 'bucketId');
  const parts = [];
  if (counts['editorial'])               parts.push(`${counts['editorial'].length} research`);
  if (counts['continuous-intelligence']) parts.push(`${counts['continuous-intelligence'].length} news`);
  if (counts['market-outlook'])          parts.push(`${counts['market-outlook'].length} outlook${counts['market-outlook'].length === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

// ── Markdown builder (Substack-editor-friendly) ───────────────────────────────

function buildMarkdown(items, dateLabel) {
  const lines = [];
  lines.push(`Good morning. Here is your TradeAlphaAI brief for ${dateLabel}.`);
  lines.push(`We tracked ${items.length} new item${items.length === 1 ? '' : 's'} across research, news, and forecasts.`);
  lines.push('');
  lines.push('---');
  lines.push('');

  const groups = groupBy(items, 'bucketId');
  const order = [
    { id: 'editorial',               title: 'Research articles' },
    { id: 'continuous-intelligence', title: 'Market news' },
    { id: 'market-outlook',          title: 'Market outlooks' }
  ];

  let anything = false;
  for (const section of order) {
    const list = groups[section.id];
    if (!list || !list.length) continue;
    anything = true;
    lines.push(`## ${section.title}`);
    lines.push('');
    for (const it of list) {
      lines.push(`**[${it.title}](${it.url})**`);
      if (it.description) lines.push(it.description.slice(0, 220));
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  if (!anything) {
    lines.push('A quiet news cycle today. Visit the research catalog:');
    lines.push(`[${SITE_URL.replace(/^https?:\/\//, '')}](${SITE_URL})`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('You are receiving this because you subscribed to TradeAlphaAI.');
  lines.push('Educational research only — not financial advice.');
  lines.push('');
  lines.push(`More: [${SITE_URL.replace(/^https?:\/\//, '')}](${SITE_URL})`);
  return lines.join('\n');
}

// ── Public archive page ───────────────────────────────────────────────────────

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildArchiveHtml(items, dateLabel, dateIso, title, subtitle) {
  const rows = items.length === 0
    ? '<p class="market-copy" style="color:var(--muted);padding:2rem 0;text-align:center">A quiet cycle. No new publications in the last 24 hours.</p>'
    : items.map((it) => `
          <article class="insight-stat-card">
            <span>${esc(it.badge)}</span>
            <strong><a href="${esc(it.url)}" style="color:inherit;text-decoration:none">${esc(it.title)}</a></strong>
            ${it.description ? `<p>${esc(it.description.slice(0, 220))}</p>` : ''}
          </article>`).join('');

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI Daily</title>
  <meta name="description" content="${esc(subtitle)} — TradeAlphaAI daily research digest." />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${SITE_URL}/newsletter/${esc(dateIso)}.html" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(subtitle)}" />
  <meta property="og:url" content="${SITE_URL}/newsletter/${esc(dateIso)}.html" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/newsletter/">Newsletter</a><span>/</span><span>${esc(dateLabel)}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">Newsletter</span>
            <span class="insight-category-badge muted">${esc(dateLabel)}</span>
          </div>
          <h1>${esc(title)}</h1>
          <p class="market-lead">${esc(subtitle)}</p>
          <p class="insight-hero-disclaimer">Educational market research only. Not financial advice.</p>
        </div>
      </section>

      <section class="market-section">
        <h2 style="color:var(--accent);margin-bottom:16px">Today's items</h2>
        <div class="insight-stat-grid">
          ${rows}
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel" style="text-align:center;padding:32px">
          <h2 style="color:var(--accent);margin:0 0 8px">Get this in your inbox</h2>
          <p class="market-copy" style="max-width:520px;margin:0 auto 20px">Daily research + news + outlooks delivered to your email. Free. Unsubscribe anytime.</p>
          <a class="cta" href="https://${esc(SUBSTACK_HOSTNAME)}" target="_blank" rel="noopener">Subscribe on Substack</a>
        </div>
      </section>

    </div>
  </main>
</body>
</html>
`;
}

function buildArchiveIndex(allArchives, isAr = false) {
  const rowHrefPrefix = isAr ? '/newsletter/' : '';
  const rows = allArchives.map((a) => `
          <a class="insight-stat-card" href="${rowHrefPrefix}${a.dateIso}.html" style="text-decoration:none">
            <span>${esc(a.dateLabel)}</span>
            <strong>${esc(a.title)}</strong>
          </a>`).join('');
  const t = (en, ar) => isAr ? ar : en;
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const canonical = `${SITE_URL}/${isAr ? 'ar/' : ''}newsletter/`;
  const title = t('Newsletter archive | TradeAlphaAI Daily', 'أرشيف النشرة | TradeAlphaAI Daily');
  const desc = t(
    'Every TradeAlphaAI Daily newsletter — searchable archive of past digests.',
    'كل نشرات TradeAlphaAI اليومية — أرشيف قابل للبحث للنشرات السابقة.'
  );
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/newsletter/" />
  <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar/newsletter/" />
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/newsletter/" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${t('Home', 'الرئيسية')}</a><span>/</span><span>${t('Newsletter', 'النشرة')}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${t('Newsletter', 'النشرة')}</span>
          </div>
          <h1>${t('Newsletter Archive', 'أرشيف النشرة')}</h1>
          <p class="market-lead">${t(
            'Every TradeAlpha Daily digest — research, news, and market outlooks delivered each morning.',
            'كل نشرات TradeAlpha Daily — أبحاث وأخبار وتوقعات سوق تصل كل صباح.'
          )}</p>
          ${isAr ? '<p class="insight-hero-disclaimer">محتوى النشرات باللغة الإنجليزية حالياً.</p>' : ''}
        </div>
      </section>

      <section class="market-section">
        <h2 style="color:var(--accent);margin-bottom:16px">${t('All past digests', 'كل النشرات السابقة')}</h2>
        <div class="insight-stat-grid">
          ${rows || `<p class="market-copy" style="color:var(--muted)">${t('No digests yet.', 'لا توجد نشرات بعد.')}</p>`}
        </div>
      </section>

    </div>
  </main>
</body>
</html>
`;
}

function writeArchive(items, dateLabel, dateIso, title, subtitle) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  const html = buildArchiveHtml(items, dateLabel, dateIso, title, subtitle);
  const out = path.join(ARCHIVE_DIR, `${dateIso}.html`);
  fs.writeFileSync(out, html, 'utf8');

  const archives = fs.readdirSync(ARCHIVE_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .map((f) => {
      const iso = f.replace(/\.html$/, '');
      const d = new Date(iso + 'T00:00:00Z');
      return {
        dateIso: iso,
        dateLabel: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(d),
        title: `Daily digest — ${iso}`
      };
    })
    .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  fs.writeFileSync(path.join(ARCHIVE_DIR, 'index.html'), buildArchiveIndex(archives, false), 'utf8');
  // AR mirror index — same digest list, Arabic UI labels. Digests themselves
  // stay EN-only for now (workflow generates only one language per day).
  const arDir = path.join(ROOT, 'ar', 'newsletter');
  fs.mkdirSync(arDir, { recursive: true });
  fs.writeFileSync(path.join(arDir, 'index.html'), buildArchiveIndex(archives, true), 'utf8');

  // The archive pages above are written with EMPTY GLOBAL_HEADER markers.
  // check:surface-discovery requires the canonical navigation block inside
  // them, so bake it here — the newsletter workflow commits newsletter/
  // directly and never runs the site-wide header pass on its own.
  const bake = require('child_process').spawnSync(
    process.execPath, [path.join(__dirname, 'apply-global-header.js')],
    { stdio: 'inherit' }
  );
  if (bake.status !== 0) throw new Error('apply-global-header failed — archive pages would fail surface-discovery');
  return out;
}

// ── Telegram ──────────────────────────────────────────────────────────────────

function tgEscapeHtml(s) {
  // Telegram parse_mode=HTML only supports a tiny tag set; escape everything else.
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  // IMPORTANT: newsletter digest is an admin task reminder, NOT public content.
  // Must go to the owner's private DM (TELEGRAM_ADMIN_CHAT_ID) — never to
  // TELEGRAM_CHAT_ID / TELEGRAM_CHANNEL_ID (those are the public channel and
  // would leak the copy-paste workflow to subscribers).
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.error('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing — refusing to send');
    console.error('[telegram] Set TELEGRAM_ADMIN_CHAT_ID to your PERSONAL chat id (from @userinfobot).');
    console.error('[telegram] Do NOT set it to the public channel id or subscribers will see the digest prep messages.');
    throw new Error('TELEGRAM_ADMIN_CHAT_ID not set');
  }
  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true
  });
  return new Promise((resolve, reject) => {
    const req = https.request({
      method: 'POST',
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve({ ok: true });
        else reject(new Error(`Telegram ${res.statusCode}: ${raw.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Telegram caps messages at 4096 chars. Chunk on paragraph boundaries.
async function sendTelegramLong(intro, markdownBody) {
  await sendTelegram(intro);
  const MAX = 3800;
  const wrap = (chunk) => `<pre>${tgEscapeHtml(chunk)}</pre>`;

  if (markdownBody.length <= MAX) {
    await sendTelegram(wrap(markdownBody));
    return;
  }

  // Chunk by paragraph blocks so nothing splits mid-heading.
  const paragraphs = markdownBody.split(/\n\n/);
  let buf = '';
  const flush = async () => { if (buf) { await sendTelegram(wrap(buf)); buf = ''; } };
  for (const p of paragraphs) {
    if ((buf.length + p.length + 2) > MAX) await flush();
    buf += (buf ? '\n\n' : '') + p;
  }
  await flush();
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const dateLabel = todayLabel();
  const dateIso = isoDateUTC();

  const items = collectRecent(WINDOW_HOURS);
  const title = `TradeAlpha Daily — ${dateLabel}`;
  const subtitle = buildSubtitle(items);
  const markdown = buildMarkdown(items, dateLabel);

  console.log(`[newsletter] ${dateLabel}: ${items.length} items in last ${WINDOW_HOURS}h`);

  const archiveFile = writeArchive(items, dateLabel, dateIso, title, subtitle);
  console.log(`[newsletter] archive written: ${path.relative(ROOT, archiveFile)}`);

  if (DRY_RUN) {
    console.log('[newsletter] DRY_RUN — skipping Telegram');
    console.log('--- Markdown preview ---');
    console.log(markdown);
    return;
  }

  const archiveUrl = `${SITE_URL}/newsletter/${dateIso}.html`;
  const intro =
    `📰 <b>${tgEscapeHtml(title)}</b>\n` +
    `${tgEscapeHtml(subtitle)}\n\n` +
    `<b>Archive:</b> ${tgEscapeHtml(archiveUrl)}\n` +
    `<b>Open Substack editor:</b> ${tgEscapeHtml(SUBSTACK_NEW_POST_URL)}\n\n` +
    `Long-press the block below to copy → paste into Substack → Publish.`;

  try {
    await sendTelegramLong(intro, markdown);
    console.log('[newsletter] Telegram notification sent');
  } catch (err) {
    console.error('[newsletter] Telegram failed:', err.message);
    process.exit(3);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[newsletter] fatal:', err);
    process.exit(1);
  });
}

module.exports = { collectRecent, buildMarkdown, buildArchiveHtml, buildSubtitle };
