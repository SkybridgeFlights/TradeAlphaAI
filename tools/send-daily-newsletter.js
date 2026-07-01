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
    ? '<p class="empty">A quiet cycle. No new publications in the last 24 hours.</p>'
    : items.map((it) => `
        <article class="dn-item" data-bucket="${esc(it.bucketId)}">
          <div class="dn-badge">${esc(it.badge)}</div>
          <h3 class="dn-title"><a href="${esc(it.url)}">${esc(it.title)}</a></h3>
          ${it.description ? `<p class="dn-desc">${esc(it.description.slice(0, 220))}</p>` : ''}
        </article>`).join('');

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} — TradeAlphaAI Daily</title>
  <meta name="description" content="${esc(subtitle)} — TradeAlphaAI daily research digest." />
  <link rel="canonical" href="${SITE_URL}/newsletter/${esc(dateIso)}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(subtitle)}" />
  <meta property="og:image" content="${SITE_URL}/Image/1.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *,*::before,*::after{box-sizing:border-box}html,body{margin:0;padding:0}
    body{font-family:'Inter',-apple-system,BlinkMacSystemFont,sans-serif;background:radial-gradient(ellipse at top,#0d1a2a,#071021 60%);color:#e6f7f3;min-height:100vh;line-height:1.55}
    .container{max-width:760px;margin:0 auto;padding:3rem 1.25rem 4rem}
    .hero{text-align:center;padding-bottom:1.5rem;border-bottom:1px solid rgba(255,255,255,.08)}
    .eyebrow{color:#22d3c3;font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
    h1{margin:.5rem 0 .35rem;font-size:1.95rem;letter-spacing:-.02em}
    .subtitle{color:#9aa8b6;margin:0}
    .dn-item{padding:1.1rem 0;border-bottom:1px solid rgba(255,255,255,.06)}
    .dn-badge{display:inline-block;padding:.25rem .6rem;border-radius:6px;background:rgba(34,211,195,.12);color:#22d3c3;font-size:.7rem;font-weight:700;letter-spacing:.04em}
    .dn-title{margin:.5rem 0 .35rem;font-size:1.1rem}
    .dn-title a{color:#e6f7f3;text-decoration:none;border-bottom:1px solid transparent;transition:border-color .12s}
    .dn-title a:hover{border-bottom-color:#22d3c3}
    .dn-desc{margin:0;color:#9aa8b6;font-size:.9rem}
    .empty{color:#9aa8b6;padding:2rem 0;text-align:center}
    .cta-box{margin-top:2.5rem;padding:1.5rem;border:1px solid rgba(34,211,195,.28);border-radius:14px;background:rgba(34,211,195,.05);text-align:center}
    .cta-box h3{margin:0 0 .5rem;color:#22d3c3}
    .cta-box p{margin:0 0 1rem;color:#9aa8b6;font-size:.9rem}
    .cta-btn{display:inline-block;padding:.75rem 1.5rem;background:#22d3c3;color:#021018;border-radius:10px;text-decoration:none;font-weight:700}
    footer{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.08);font-size:.75rem;color:#6b7a8a;text-align:center}
    footer a{color:#9aa8b6;text-decoration:none}
  </style>
</head>
<body>
  <main class="container">
    <header class="hero">
      <div class="eyebrow">TradeAlpha Daily · ${esc(dateLabel)}</div>
      <h1>${esc(title)}</h1>
      <p class="subtitle">${esc(subtitle)}</p>
    </header>
    <section class="items">
      ${rows}
    </section>
    <div class="cta-box">
      <h3>Get this in your inbox</h3>
      <p>Daily research + news + outlooks. Free. Unsubscribe anytime.</p>
      <a class="cta-btn" href="https://${esc(SUBSTACK_HOSTNAME)}" target="_blank" rel="noopener">Subscribe on Substack</a>
    </div>
    <footer>
      <p>Educational market research only. Not financial advice.</p>
      <p><a href="${SITE_URL}/">tradealphaai.com</a> · <a href="${SITE_URL}/newsletter/">Archive</a></p>
    </footer>
  </main>
</body>
</html>
`;
}

function buildArchiveIndex(allArchives) {
  const rows = allArchives.map((a) => `
    <li><a href="${a.dateIso}.html"><span class="archive-date">${a.dateLabel}</span><span class="archive-title">${esc(a.title)}</span></a></li>`).join('');
  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Newsletter archive — TradeAlphaAI Daily</title>
  <meta name="description" content="Every TradeAlphaAI Daily newsletter — searchable archive of past digests." />
  <link rel="canonical" href="${SITE_URL}/newsletter/" />
  <style>
    body{font-family:'Inter',sans-serif;background:#071021;color:#e6f7f3;margin:0;padding:3rem 1.25rem}
    .wrap{max-width:680px;margin:0 auto}
    h1{font-size:1.8rem;margin:0 0 .5rem}
    .lead{color:#9aa8b6;margin:0 0 2rem}
    ul{list-style:none;padding:0;margin:0}
    li a{display:flex;justify-content:space-between;padding:1rem;border-bottom:1px solid rgba(255,255,255,.08);text-decoration:none;color:#e6f7f3;gap:1rem}
    li a:hover{background:rgba(34,211,195,.05);color:#22d3c3}
    .archive-date{color:#6b7a8a;font-size:.85rem;white-space:nowrap}
    .archive-title{flex:1;text-align:right;font-size:.95rem}
  </style>
</head>
<body>
  <main class="wrap">
    <h1>Newsletter archive</h1>
    <p class="lead">All TradeAlpha Daily digests, newest first.</p>
    <ul>${rows}</ul>
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
  fs.writeFileSync(path.join(ARCHIVE_DIR, 'index.html'), buildArchiveIndex(archives), 'utf8');
  return out;
}

// ── Telegram ──────────────────────────────────────────────────────────────────

function tgEscapeHtml(s) {
  // Telegram parse_mode=HTML only supports a tiny tag set; escape everything else.
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing — skipping notification');
    return Promise.resolve({ skipped: true });
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
