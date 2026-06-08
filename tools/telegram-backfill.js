'use strict';

/**
 * telegram-backfill.js
 *
 * Scans all published article sources, finds articles not yet delivered
 * to Telegram (by ledger check), verifies public files exist on disk,
 * and dispatches send-published-article-telegram.js for each missing article.
 *
 * Used by: .github/workflows/telegram-backfill.yml
 */

const fs   = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(ROOT, 'data', 'telegram-delivery-ledger.json');

const DRY_RUN = process.argv.includes('--dry-run=true') || process.argv.includes('--dry-run');

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function readLedger() {
  const l = readJson(LEDGER_PATH);
  return l || { schema_version: '1.0', deliveries: [] };
}

function isDelivered(ledger, slug, contentType) {
  return ledger.deliveries.some(
    d => d.slug === slug && d.content_type === contentType && d.status === 'sent'
  );
}

function publicFileExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function verifyPublicFiles(slug, contentType) {
  const paths = {
    'editorial':               [`insights/${slug}.html`],
    'market-outlook':          [`market-outlook/${slug}.html`],
    'continuous-intelligence': [`intelligence/${slug}.html`],
  };
  return (paths[contentType] || []).every(p => publicFileExists(p));
}

// ── Source scanners ──────────────────────────────────────────────────────────

function scanEditorial(ledger) {
  const registry = readJson(path.join(ROOT, 'data', 'insights', 'article-registry.json'));
  const results  = [];
  for (const article of (registry && registry.articles || [])) {
    if (article.status !== 'published') continue;
    const slug = article.slug;
    if (!slug || isDelivered(ledger, slug, 'editorial')) continue;
    if (!verifyPublicFiles(slug, 'editorial')) {
      console.log(`[backfill] skip editorial ${slug} — public file missing`);
      continue;
    }
    results.push({ slug, content_type: 'editorial' });
  }
  return results;
}

function scanMarketOutlook(ledger) {
  const queue   = readJson(path.join(ROOT, 'data', 'market-outlook-queue.json'));
  const results = [];
  for (const topic of (queue && queue.topics || [])) {
    if (topic.status !== 'published') continue;
    const slug = topic.slug;
    if (!slug || isDelivered(ledger, slug, 'market-outlook')) continue;
    if (!verifyPublicFiles(slug, 'market-outlook')) {
      console.log(`[backfill] skip market-outlook ${slug} — public file missing`);
      continue;
    }
    results.push({ slug, content_type: 'market-outlook' });
  }
  return results;
}

function scanContinuousIntelligence(ledger) {
  const history = readJson(path.join(ROOT, 'data', 'continuous-intelligence-history.json'));
  const results = [];
  for (const pub of (history && history.publications || [])) {
    const slug = pub.slug;
    if (!slug || isDelivered(ledger, slug, 'continuous-intelligence')) continue;
    if (!verifyPublicFiles(slug, 'continuous-intelligence')) {
      console.log(`[backfill] skip continuous-intelligence ${slug} — public file missing`);
      continue;
    }
    results.push({ slug, content_type: 'continuous-intelligence' });
  }
  return results;
}

// ── Send ─────────────────────────────────────────────────────────────────────

function dispatchSend(slug, contentType) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(ROOT, 'tools', 'send-published-article-telegram.js'),
      `--slug=${slug}`,
      `--content-type=${contentType}`,
      '--source=recovery',
      '--send',
    ],
    { stdio: 'inherit', env: process.env }
  );
  return result.status === 0;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  console.log(`[telegram-backfill] Starting — dry_run=${DRY_RUN}`);

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHANNEL_ID || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.log('[telegram-backfill] Telegram credentials not available — skipping backfill');
    process.exit(0);
  }

  const ledger  = readLedger();
  const missing = [
    ...scanEditorial(ledger),
    ...scanMarketOutlook(ledger),
    ...scanContinuousIntelligence(ledger),
  ];

  console.log(`[telegram-backfill] ${missing.length} article(s) pending delivery`);

  if (missing.length === 0) {
    console.log('[telegram-backfill] All published articles already delivered — nothing to do.');
    process.exit(0);
  }

  let sent   = 0;
  let failed = 0;

  for (const { slug, content_type } of missing) {
    console.log(`\n[telegram-backfill] Processing slug=${slug} content_type=${content_type}`);
    if (DRY_RUN) {
      console.log(`[telegram-backfill] dry-run — would send: ${slug} (${content_type})`);
      continue;
    }
    if (dispatchSend(slug, content_type)) {
      sent++;
    } else {
      console.error(`[telegram-backfill] failed to send slug=${slug}`);
      failed++;
    }
  }

  if (!DRY_RUN) {
    console.log(`\n[telegram-backfill] Done — sent=${sent} failed=${failed}`);
    if (failed > 0) process.exit(1);
  } else {
    console.log(`\n[telegram-backfill] Dry-run complete — ${missing.length} would be sent`);
  }
}

main();
