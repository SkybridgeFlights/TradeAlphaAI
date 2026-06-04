'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function pad(str, len) {
  return String(str).padEnd(len);
}

function listDraftDirs(base) {
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base).filter(f =>
    fs.statSync(path.join(base, f)).isDirectory()
  );
}

function printQueueSection(label, queuePath, historyPath, publicDir) {
  const queue = readJson(queuePath, { topics: [] });
  const topics = queue.topics || [];
  const history = readJson(historyPath, { publications: [] });
  const publishedSlugs = new Set((history.publications || []).map(p => p.slug));

  const byStatus = {};
  for (const t of topics) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  const today = new Date().toISOString().slice(0, 10);

  const readyToPublish = topics.filter(t =>
    t.status === 'reviewed' &&
    t.review_status === 'approved' &&
    t.target_publish_date <= today &&
    !publishedSlugs.has(t.slug) &&
    !fs.existsSync(path.join(ROOT, publicDir, `${t.slug}.html`))
  );

  const overdue = readyToPublish.filter(t => t.target_publish_date < today);

  console.log(`\n  ${label}`);
  console.log('  ' + '─'.repeat(52));
  console.log(`  ${pad('Total topics:', 24)} ${topics.length}`);

  const statusOrder = ['planned', 'draft', 'in_review', 'reviewed', 'published'];
  const extraStatuses = Object.keys(byStatus).filter(s => !statusOrder.includes(s));
  for (const status of [...statusOrder, ...extraStatuses]) {
    if (byStatus[status]) {
      console.log(`  ${pad('  ' + status + ':', 24)} ${byStatus[status]}`);
    }
  }

  if (readyToPublish.length > 0) {
    const overdueSuffix = overdue.length > 0 ? ` — ${overdue.length} overdue` : '';
    console.log(`  ${pad('Ready to publish:', 24)} ${readyToPublish.length}${overdueSuffix}`);
    for (const t of readyToPublish.slice(0, 4)) {
      const flag = t.target_publish_date < today ? ' [OVERDUE]' : '';
      console.log(`    → ${t.slug} (${t.target_publish_date})${flag}`);
    }
  } else {
    console.log(`  ${pad('Ready to publish:', 24)} 0`);
  }

  const recent = [...(history.publications || [])].sort((a, b) =>
    (b.publish_date || '').localeCompare(a.publish_date || '')
  ).slice(0, 3);

  if (recent.length > 0) {
    console.log(`  ${pad('Recently published:', 24)}`);
    for (const p of recent) {
      console.log(`    ✓ ${p.slug} (${p.publish_date})`);
    }
  }
}

function printNewsAnalysisSection() {
  const queue = readJson(path.join(ROOT, 'data/news-analysis-queue.json'), { topics: [] });
  const topics = queue.topics || [];

  console.log('\n  NEWS ANALYSIS');
  console.log('  ' + '─'.repeat(52));

  if (topics.length === 0) {
    console.log('  Queue is empty — no sourced topics yet.');
    return;
  }

  const byStatus = {};
  for (const t of topics) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  console.log(`  ${pad('Total topics:', 24)} ${topics.length}`);
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`  ${pad('  ' + status + ':', 24)} ${count}`);
  }

  const newsSourceRegistry = readJson(path.join(ROOT, 'data/news-source-registry.json'), { sources: [] });
  const sources = newsSourceRegistry.sources || [];
  console.log(`  ${pad('Registered sources:', 24)} ${sources.length}`);
}

function printDraftsSummary() {
  const editorial = listDraftDirs(path.join(ROOT, 'drafts/editorial'));
  const outlook = listDraftDirs(path.join(ROOT, 'drafts/market-outlook'));
  const news = listDraftDirs(path.join(ROOT, 'drafts/news-analysis'));

  console.log('\n  DRAFT FILES ON DISK');
  console.log('  ' + '─'.repeat(52));

  console.log(`  ${pad('Editorial drafts:', 24)} ${editorial.length}`);
  for (const d of editorial.slice(0, 5)) console.log(`    • ${d}`);
  if (editorial.length > 5) console.log(`    ... and ${editorial.length - 5} more`);

  console.log(`  ${pad('Market outlook:', 24)} ${outlook.length}`);
  for (const d of outlook.slice(0, 5)) console.log(`    • ${d}`);

  console.log(`  ${pad('News analysis:', 24)} ${news.length}`);
  for (const d of news.slice(0, 5)) console.log(`    • ${d}`);
}

function printMarketContext() {
  const regime = readJson(path.join(ROOT, 'data/market-regime-state.json'), {});
  const liveMarket = readJson(path.join(ROOT, 'data/live-market-state.json'), { metadata: { status: 'unknown' } });
  const calendar = readJson(path.join(ROOT, 'data/economic-calendar.json'), { events: [] });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (calendar.events || [])
    .filter(e => e.date >= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 4);

  console.log('\n  MARKET CONTEXT');
  console.log('  ' + '─'.repeat(52));
  console.log(`  ${pad('Regime:', 24)} ${regime.regime || '(unknown)'}`);
  console.log(`  ${pad('Live market status:', 24)} ${(liveMarket.metadata || {}).status || '(unknown)'}`);

  if (upcoming.length > 0) {
    console.log(`  ${pad('Upcoming events:', 24)}`);
    for (const e of upcoming) {
      const name = e.name || e.event || e.title || '(unnamed)';
      console.log(`    ► ${e.date}: ${name}`);
    }
  } else {
    console.log(`  ${pad('Upcoming events:', 24)} none in calendar`);
  }
}

// ── Main output ───────────────────────────────────────────────────────────────

const now = new Date();
console.log('\n======================================================');
console.log('  TRADEALPHAAI PUBLISHING CONTROL CENTER');
console.log(`  Report: ${now.toISOString().replace('T', ' ').slice(0, 19)} UTC`);
console.log('======================================================');

printQueueSection(
  'EDITORIAL ARTICLES',
  path.join(ROOT, 'data/editorial-topic-queue.json'),
  path.join(ROOT, 'data/published-history.json'),
  'insights'
);

printQueueSection(
  'MARKET OUTLOOK',
  path.join(ROOT, 'data/market-outlook-queue.json'),
  path.join(ROOT, 'data/market-outlook-history.json'),
  'market-outlook'
);

printNewsAnalysisSection();
printDraftsSummary();
printMarketContext();

console.log('\n======================================================\n');
