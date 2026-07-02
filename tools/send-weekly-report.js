#!/usr/bin/env node
'use strict';

// Weekly growth report — sends a compact summary of site + audience metrics
// to the admin's Telegram DM every Sunday morning. Purpose: give the operator
// a "did the needle move" signal without opening five different dashboards.
//
// Data sources (in order of reliability):
//   1. Local history files    — publish counts across editorial / news / outlooks
//   2. Directory listings     — total glossary / compare / insights pages
//   3. Telegram Bot API       — channel subscriber count via getChatMemberCount
//   4. Substack (best effort) — public metadata; may fail behind Cloudflare
//   5. GA4 / Search Console   — SKIPPED unless GOOGLE_SERVICE_ACCOUNT_JSON is
//      configured (OAuth service account not yet set up). Placeholder line
//      instructs the user how to enable it later.
//
// CLI:
//   --dry-run   Compute + print report, skip Telegram send
//
// Env (all optional except TELEGRAM_*):
//   TELEGRAM_BOT_TOKEN         required
//   TELEGRAM_ADMIN_CHAT_ID     required (private DM — never the channel!)
//   TELEGRAM_CHANNEL_ID        optional — pulls channel subscriber count
//   SUBSTACK_HOSTNAME          defaults to tradealphaai.substack.com
//   GOOGLE_SERVICE_ACCOUNT_JSON  optional — enables GA4/GSC integration (future)

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://www.tradealphaai.com';
const SUBSTACK_HOSTNAME = process.env.SUBSTACK_HOSTNAME || 'tradealphaai.substack.com';

const DRY_RUN = process.argv.includes('--dry-run');

// ── History readers ──────────────────────────────────────────────────────────

const HISTORY_FILES = [
  { id: 'editorial',                 file: 'data/published-history.json',               label: 'Research' },
  { id: 'market-outlook',            file: 'data/market-outlook-history.json',          label: 'Outlooks' },
  { id: 'continuous-intelligence',   file: 'data/continuous-intelligence-history.json', label: 'News' }
];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch { return fallback; }
}

function countInWindow(hoursBack) {
  const now = Date.now();
  const cutoff = now - hoursBack * 60 * 60 * 1000;
  const counts = { total: 0 };
  for (const bucket of HISTORY_FILES) {
    const history = readJson(bucket.file, { publications: [] });
    const inWindow = (history.publications || []).filter((pub) => {
      const ts = Date.parse(pub.published_at || `${pub.publish_date || ''}T12:00:00Z`);
      return Number.isFinite(ts) && ts >= cutoff && ts <= now;
    });
    counts[bucket.id] = inWindow.length;
    counts.total += inWindow.length;
  }
  return counts;
}

// ── Directory totals ─────────────────────────────────────────────────────────

function countHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return 0;
  try {
    return fs.readdirSync(abs).filter((f) => f.endsWith('.html') && f !== 'index.html').length;
  } catch { return 0; }
}

function siteTotals() {
  return {
    insights: countHtml('insights'),
    compare: countHtml('compare'),
    glossary: countHtml('glossary'),
    newsletter: countHtml('newsletter'),
    marketNews: countHtml('market-news') + countHtml('intelligence'),
    marketOutlook: countHtml('market-outlook'),
    articles: countHtml('articles')
  };
}

// ── Telegram Bot API ─────────────────────────────────────────────────────────

function tgApi(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.reject(new Error('TELEGRAM_BOT_TOKEN not set'));
  const url = new URL(`https://api.telegram.org/bot${token}/${method}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const body = JSON.parse(raw);
          if (body.ok) resolve(body.result);
          else reject(new Error(body.description || 'Telegram API error'));
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function telegramChannelSize() {
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;
  if (!chatId) return null;
  try {
    const count = await tgApi('getChatMemberCount', { chat_id: chatId });
    return typeof count === 'number' ? count : null;
  } catch (err) {
    console.warn('[report] Telegram getChatMemberCount failed:', err.message);
    return null;
  }
}

// ── Substack subscriber count (best effort) ──────────────────────────────────

function fetchWithBrowserHeaders(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    https.get({
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: raw });
      });
    }).on('error', reject);
  });
}

async function substackSubscribers() {
  try {
    const res = await fetchWithBrowserHeaders(`https://${SUBSTACK_HOSTNAME}/`);
    if (res.status !== 200) return null;
    // Substack embeds subscriber count in various places; grep for common patterns.
    const patterns = [
      /"subscriber_count":(\d+)/,
      /"subscriberCount":(\d+)/,
      /(\d[\d,]*)\s+subscribers?/i,
      /"active_subscription_count":(\d+)/
    ];
    for (const p of patterns) {
      const m = res.body.match(p);
      if (m) return Number(String(m[1]).replace(/,/g, ''));
    }
    return null;
  } catch { return null; }
}

// ── Report builder ───────────────────────────────────────────────────────────

function fmt(n) {
  return typeof n === 'number' ? n.toLocaleString('en-US') : (n ?? '—');
}

function fmtDelta(cur, prev) {
  if (typeof cur !== 'number' || typeof prev !== 'number') return '';
  const d = cur - prev;
  if (d === 0) return ' (=)';
  return d > 0 ? ` (+${d})` : ` (${d})`;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function buildReport() {
  const thisWeek = countInWindow(168);        // 7 days
  const lastWeek = countInWindow(336);        // 14 days
  const lastWeekOnly = {
    total: lastWeek.total - thisWeek.total,
    editorial: (lastWeek.editorial || 0) - (thisWeek.editorial || 0),
    'market-outlook': (lastWeek['market-outlook'] || 0) - (thisWeek['market-outlook'] || 0),
    'continuous-intelligence': (lastWeek['continuous-intelligence'] || 0) - (thisWeek['continuous-intelligence'] || 0)
  };
  const totals = siteTotals();
  const telegramSize = await telegramChannelSize();
  const substackSubs = await substackSubscribers();

  const weekLabel = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'
  }).format(new Date());

  const lines = [];
  lines.push(`📊 <b>TradeAlphaAI — Weekly Growth Report</b>`);
  lines.push(`<i>${esc(weekLabel)}</i>`);
  lines.push('');
  lines.push(`<b>Published this week:</b> ${thisWeek.total}${fmtDelta(thisWeek.total, lastWeekOnly.total)}`);
  lines.push(`  · Research: ${thisWeek.editorial || 0}`);
  lines.push(`  · News: ${thisWeek['continuous-intelligence'] || 0}`);
  lines.push(`  · Outlooks: ${thisWeek['market-outlook'] || 0}`);
  lines.push('');
  lines.push(`<b>Audience:</b>`);
  lines.push(`  · Telegram channel: ${telegramSize == null ? 'unknown' : fmt(telegramSize) + ' subscribers'}`);
  lines.push(`  · Substack: ${substackSubs == null ? 'unknown (Cloudflare)' : fmt(substackSubs) + ' subscribers'}`);
  lines.push('');
  lines.push(`<b>Site catalog totals:</b>`);
  lines.push(`  · Research articles: ${fmt(totals.insights)}`);
  lines.push(`  · Comparison pages: ${fmt(totals.compare)}`);
  lines.push(`  · Glossary terms: ${fmt(totals.glossary)}`);
  lines.push(`  · Newsletter archive: ${fmt(totals.newsletter)}`);
  lines.push(`  · Market news / intelligence: ${fmt(totals.marketNews)}`);
  lines.push(`  · Market outlook: ${fmt(totals.marketOutlook)}`);
  lines.push('');
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    lines.push(`<b>Not yet connected:</b>`);
    lines.push(`  · GA4 pageviews / sessions`);
    lines.push(`  · Search Console impressions / clicks / CTR`);
    lines.push(`<i>Set GOOGLE_SERVICE_ACCOUNT_JSON in repo secrets to enable.</i>`);
  }
  lines.push('');
  lines.push(`<b>Dashboards:</b>`);
  lines.push(`GA4: https://analytics.google.com/`);
  lines.push(`Search Console: https://search.google.com/search-console`);
  lines.push(`Substack: https://${esc(SUBSTACK_HOSTNAME)}/publish/home`);
  lines.push(`Site: ${SITE_URL}`);

  return lines.join('\n');
}

// ── Telegram send ────────────────────────────────────────────────────────────

function sendTelegram(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) {
    console.error('[report] TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID missing — refusing to send');
    console.error('[report] Do NOT set chatId to a public channel — this report is admin-only.');
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
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`Telegram ${res.statusCode}: ${raw.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const report = await buildReport();

  if (DRY_RUN) {
    console.log('--- DRY_RUN preview ---');
    console.log(report);
    return;
  }

  await sendTelegram(report);
  console.log('[report] weekly report delivered');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[report] fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { buildReport, countInWindow, siteTotals };
