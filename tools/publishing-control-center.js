'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readJson(filePath, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return fallback; }
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
  const today = new Date().toISOString().slice(0, 10);

  const byStatus = {};
  for (const t of topics) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  const approvedAndReady = topics.filter(t =>
    t.status === 'reviewed' &&
    t.review_status === 'approved' &&
    t.target_publish_date <= today &&
    !publishedSlugs.has(t.slug) &&
    !fs.existsSync(path.join(ROOT, publicDir, `${t.slug}.html`))
  );

  const approvedAnyDate = topics.filter(t =>
    t.status === 'reviewed' &&
    t.review_status === 'approved' &&
    !publishedSlugs.has(t.slug) &&
    !fs.existsSync(path.join(ROOT, publicDir, `${t.slug}.html`))
  );

  const overdue = approvedAndReady.filter(t => t.target_publish_date < today);

  console.log(`\n  ${label}`);
  console.log('  ' + '─'.repeat(52));
  console.log(`  ${pad('Total topics:', 26)} ${topics.length}`);

  const statusOrder = ['planned', 'draft', 'in_review', 'reviewed', 'published'];
  const extraStatuses = Object.keys(byStatus).filter(s => !statusOrder.includes(s));
  for (const status of [...statusOrder, ...extraStatuses]) {
    if (!byStatus[status]) continue;
    let suffix = '';
    if (status === 'reviewed') {
      const approved = topics.filter(t => t.status === 'reviewed' && t.review_status === 'approved').length;
      const pending  = topics.filter(t => t.status === 'reviewed' && t.review_status !== 'approved').length;
      if (approved)  suffix += ` (${approved} approved)`;
      if (pending)   suffix += ` (${pending} pending)`;
    }
    console.log(`  ${pad('  ' + status + ':', 26)} ${byStatus[status]}${suffix}`);
  }

  if (approvedAnyDate.length > 0) {
    const overdueSuffix = overdue.length > 0 ? ` — ${overdue.length} overdue` : '';
    const futureSuffix  = approvedAnyDate.length > approvedAndReady.length
      ? ` (${approvedAnyDate.length - approvedAndReady.length} future-dated, publishable via full_pipeline)`
      : '';
    console.log(`  ${pad('Ready (date-gated):', 26)} ${approvedAndReady.length}${overdueSuffix}`);
    console.log(`  ${pad('Approved (any date):', 26)} ${approvedAnyDate.length}${futureSuffix}`);

    const nextPublishable = approvedAndReady[0] || approvedAnyDate[0];
    if (nextPublishable) {
      const dateSuffix = approvedAndReady.includes(nextPublishable) ? '' : ' [future-dated]';
      console.log(`  ${pad('Next to publish:', 26)} ${nextPublishable.slug} (${nextPublishable.target_publish_date})${dateSuffix}`);
    }
  } else {
    console.log(`  ${pad('Ready to publish:', 26)} 0`);
    const eligible = topics.find(t => t.status === 'planned' || t.status === 'draft');
    if (eligible) {
      console.log(`  ${pad('Next pipeline target:', 26)} ${eligible.slug} (${eligible.status})`);
    }
  }

  const recent = [...(history.publications || [])].sort((a, b) =>
    (b.publish_date || '').localeCompare(a.publish_date || '')
  ).slice(0, 3);

  if (recent.length > 0) {
    console.log(`  ${pad('Recently published:', 26)}`);
    for (const p of recent) console.log(`    ✓ ${p.slug} (${p.publish_date})`);
  }
}

function printNewsAnalysisSection() {
  const queue = readJson(path.join(ROOT, 'data/news-analysis-queue.json'), { topics: [] });
  const topics = queue.topics || [];

  console.log('\n  NEWS ANALYSIS');
  console.log('  ' + '─'.repeat(52));

  if (topics.length === 0) {
    console.log('  Queue is empty — no sourced topics yet.');
    const registry = readJson(path.join(ROOT, 'data/news-source-registry.json'), { sources: [] });
    console.log(`  ${pad('Registered sources:', 26)} ${(registry.sources || []).length}`);
    return;
  }

  const byStatus = {};
  for (const t of topics) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  }

  console.log(`  ${pad('Total topics:', 26)} ${topics.length}`);
  for (const [status, count] of Object.entries(byStatus).sort()) {
    console.log(`  ${pad('  ' + status + ':', 26)} ${count}`);
  }

  const registry = readJson(path.join(ROOT, 'data/news-source-registry.json'), { sources: [] });
  console.log(`  ${pad('Registered sources:', 26)} ${(registry.sources || []).length}`);
}

function printDraftsSummary() {
  const editorial = listDraftDirs(path.join(ROOT, 'drafts/editorial'));
  const outlook   = listDraftDirs(path.join(ROOT, 'drafts/market-outlook'));
  const news      = listDraftDirs(path.join(ROOT, 'drafts/news-analysis'));

  console.log('\n  DRAFT FILES ON DISK');
  console.log('  ' + '─'.repeat(52));

  console.log(`  ${pad('Editorial drafts:', 26)} ${editorial.length}`);
  for (const d of editorial.slice(0, 5)) console.log(`    • ${d}`);
  if (editorial.length > 5) console.log(`    ... and ${editorial.length - 5} more`);

  console.log(`  ${pad('Market outlook:', 26)} ${outlook.length}`);
  for (const d of outlook.slice(0, 5)) console.log(`    • ${d}`);

  console.log(`  ${pad('News analysis:', 26)} ${news.length}`);
  for (const d of news.slice(0, 5)) console.log(`    • ${d}`);
}

function printPublishedOutlooks() {
  const published = readJson(path.join(ROOT, 'data/market-outlook-published.json'), { articles: [] });
  const articles  = published.articles || [];

  if (articles.length === 0) return;

  console.log('\n  PUBLISHED MARKET OUTLOOKS');
  console.log('  ' + '─'.repeat(52));
  console.log(`  ${pad('Total published:', 26)} ${articles.length}`);

  const recent = [...articles].sort((a, b) =>
    (b.publish_date || '').localeCompare(a.publish_date || '')
  ).slice(0, 3);

  for (const a of recent) {
    console.log(`    ✓ ${a.slug} (${a.publish_date})`);
    console.log(`      EN: /market-outlook/${a.slug}.html`);
    console.log(`      AR: /ar/market-outlook/${a.slug}.html`);
  }
}

function printMarketContext() {
  const regime     = readJson(path.join(ROOT, 'data/market-regime-state.json'), {});
  const liveMarket = readJson(path.join(ROOT, 'data/live-market-state.json'), { metadata: { status: 'unknown' } });
  const calendar   = readJson(path.join(ROOT, 'data/economic-calendar.json'), { events: [] });
  const today      = new Date().toISOString().slice(0, 10);

  const upcoming = (calendar.events || [])
    .filter(e => e.date >= today)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .slice(0, 4);

  console.log('\n  MARKET CONTEXT');
  console.log('  ' + '─'.repeat(52));
  console.log(`  ${pad('Regime:', 26)} ${regime.regime || '(unknown)'}`);
  console.log(`  ${pad('Live market status:', 26)} ${(liveMarket.metadata || {}).status || '(unknown)'}`);

  if (upcoming.length > 0) {
    console.log(`  ${pad('Upcoming events:', 26)}`);
    for (const e of upcoming) {
      const name = e.name || e.event || e.title || '(unnamed)';
      console.log(`    ► ${e.date}: ${name}`);
    }
  } else {
    console.log(`  ${pad('Upcoming events:', 26)} none in calendar`);
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

printPublishedOutlooks();
printNewsAnalysisSection();
printDraftsSummary();
printMarketContext();

console.log('\n======================================================');
console.log('  PIPELINE MODES (GitHub Actions → Publishing Control Center)');
console.log('  status        — this report');
console.log('  validate      — run all quality gates');
console.log('  full_pipeline — seed → generate → approve → publish (market-outlook)');
console.log('  generate-draft + publish — two-step for any content type');
console.log('  seed-topics   — seed market-outlook topics only');
console.log('======================================================\n');
