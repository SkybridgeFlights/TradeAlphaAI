'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

const STALE_IN_REVIEW_DAYS = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

function readJson(p, fallback = {}) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return { ...fallback, _parse_error: true }; }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function daysBetween(isoA, isoB) {
  if (!isoA || !isoB) return null;
  return Math.floor((new Date(isoB) - new Date(isoA)) / 86400000);
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

const arg = (flag) => process.argv.includes(flag);

// ── Public page paths ─────────────────────────────────────────────────────────

function publicPagesFor(contentType, slug) {
  switch (contentType) {
    case 'editorial':
      return [`insights/${slug}.html`, `ar/insights/${slug}.html`, `en/insights/${slug}.html`];
    case 'market-outlook':
      return [`market-outlook/${slug}.html`, `ar/market-outlook/${slug}.html`, `en/market-outlook/${slug}.html`];
    case 'continuous-intelligence':
      return [`intelligence/${slug}.html`, `ar/intelligence/${slug}.html`, `en/intelligence/${slug}.html`];
    default:
      return [];
  }
}

// ── Checks ────────────────────────────────────────────────────────────────────

const issues  = [];
const repairs = [];

function issue(severity, category, slug, message) {
  issues.push({ severity, category, slug, message });
  console.log(`  [${severity}] ${category}/${slug || '-'}: ${message}`);
}

function repaired(category, slug, message) {
  repairs.push({ category, slug, message });
  console.log(`  [REPAIRED] ${category}/${slug || '-'}: ${message}`);
}

// Market-outlook queue
function checkMarketOutlookQueue(mode) {
  const q = readJson(path.join(ROOT, 'data/market-outlook-queue.json'), { topics: [] });
  const topics = q.topics || [];
  const seen = new Set();

  for (const t of topics) {
    const { slug, status } = t;

    // Duplicate slugs
    if (seen.has(slug)) {
      issue('ERROR', 'market-outlook-queue', slug, 'duplicate slug');
    }
    seen.add(slug);

    // Published but file missing
    if (status === 'published') {
      const pages = publicPagesFor('market-outlook', slug);
      const missing = pages.filter(p => !fileExists(p));
      if (missing.length > 0) {
        issue('WARN', 'market-outlook-queue', slug, `marked published but missing pages: ${missing.join(', ')}`);
      }
    }

    // Stale in_review
    if (status === 'in_review') {
      const days = daysBetween(t.created_at || t.added_at, new Date().toISOString());
      if (days !== null && days > STALE_IN_REVIEW_DAYS) {
        issue('WARN', 'market-outlook-queue', slug, `stale in_review for ${days} days`);
        if (mode === 'repair') {
          t.status = 'planned';
          t.review_notes = `Auto-reset from stale in_review (${days} days) on ${TODAY}`;
          repaired('market-outlook-queue', slug, `reset in_review → planned`);
        }
      }
    }
  }

  if (mode === 'repair' && repairs.some(r => r.category === 'market-outlook-queue')) {
    q.updated = new Date().toISOString();
    writeJson(path.join(ROOT, 'data/market-outlook-queue.json'), q);
  }
}

// Editorial queue
function checkEditorialQueue(mode) {
  const q = readJson(path.join(ROOT, 'data/editorial-topic-queue.json'), { topics: [] });
  const topics = q.topics || [];
  const seen = new Set();

  for (const t of topics) {
    const { slug, status } = t;
    if (seen.has(slug)) {
      issue('ERROR', 'editorial-queue', slug, 'duplicate slug');
    }
    seen.add(slug);

    if (status === 'published') {
      const pages = publicPagesFor('editorial', slug);
      const missing = pages.filter(p => !fileExists(p));
      if (missing.length > 0) {
        issue('WARN', 'editorial-queue', slug, `marked published but missing pages: ${missing.join(', ')}`);
      }
    }

    // Draft exists but not in queue as draft/in_review
    if (!['draft', 'in_review', 'reviewed', 'approved', 'published', 'manual_revision_required'].includes(status)) {
      const draftEn = `drafts/editorial/${slug}/en.html`;
      if (fileExists(draftEn)) {
        issue('INFO', 'editorial-queue', slug, `draft exists on disk but status=${status}`);
      }
    }

    // Stale in_review
    if (status === 'in_review') {
      const days = daysBetween(t.autonomous_reviewed_at || t.created_at, new Date().toISOString());
      if (days !== null && days > STALE_IN_REVIEW_DAYS) {
        issue('WARN', 'editorial-queue', slug, `stale in_review for ${days} days`);
        if (mode === 'repair') {
          t.status = 'planned';
          repaired('editorial-queue', slug, 'reset in_review → planned');
        }
      }
    }
  }

  if (mode === 'repair' && repairs.some(r => r.category === 'editorial-queue')) {
    q.updated = new Date().toISOString();
    writeJson(path.join(ROOT, 'data/editorial-topic-queue.json'), q);
  }
}

// Continuous intelligence queue
function checkCIQueue(mode) {
  if (!fs.existsSync(path.join(ROOT, 'data/continuous-intelligence-queue.json'))) {
    console.log('  [INFO] continuous-intelligence-queue.json not yet created.');
    return;
  }
  const q = readJson(path.join(ROOT, 'data/continuous-intelligence-queue.json'), { topics: [] });
  const topics = q.topics || [];
  const seen = new Set();

  for (const t of topics) {
    const { slug, status, family, confidence } = t;

    if (seen.has(slug)) {
      issue('ERROR', 'ci-queue', slug, 'duplicate slug');
    }
    seen.add(slug);

    if (!family) {
      issue('ERROR', 'ci-queue', slug, 'missing family field');
    }
    if (typeof confidence !== 'number') {
      issue('ERROR', 'ci-queue', slug, 'confidence must be a number');
    }

    if (status === 'published') {
      const pages = publicPagesFor('continuous-intelligence', slug);
      const missing = pages.filter(p => !fileExists(p));
      if (missing.length > 0) {
        issue('WARN', 'ci-queue', slug, `marked published but missing pages: ${missing.join(', ')}`);
      }
    }

    // Stale in_review
    if (status === 'in_review') {
      const days = daysBetween(t.created_at, new Date().toISOString());
      if (days !== null && days > STALE_IN_REVIEW_DAYS) {
        issue('WARN', 'ci-queue', slug, `stale in_review for ${days} days`);
        if (mode === 'repair') {
          t.status = 'planned';
          repaired('ci-queue', slug, 'reset in_review → planned');
        }
      }
    }
  }

  if (mode === 'repair' && repairs.some(r => r.category === 'ci-queue')) {
    q.updated = new Date().toISOString();
    writeJson(path.join(ROOT, 'data/continuous-intelligence-queue.json'), q);
  }
}

// Publication history
function checkPublicationHistory() {
  const history = readJson(path.join(ROOT, 'data/published-history.json'), { entries: [] });
  const entries = history.entries || [];

  for (const e of entries) {
    const { slug, content_type } = e;
    if (!slug) { issue('WARN', 'published-history', '', 'entry missing slug'); continue; }
    const pages = publicPagesFor(content_type || 'editorial', slug);
    if (pages.length > 0) {
      const missing = pages.filter(p => !fileExists(p));
      if (missing.length > 0) {
        issue('WARN', 'published-history', slug, `history entry exists but missing files: ${missing.join(', ')}`);
      }
    }
  }

  // Check market-outlook history too
  const moHistory = readJson(path.join(ROOT, 'data/market-outlook-history.json'), { entries: [] });
  for (const e of (moHistory.entries || [])) {
    const { slug } = e;
    if (!slug) continue;
    const pages = publicPagesFor('market-outlook', slug);
    const missing = pages.filter(p => !fileExists(p));
    if (missing.length > 0) {
      issue('WARN', 'market-outlook-history', slug, `history entry exists but missing files: ${missing.join(', ')}`);
    }
  }

  // Check CI history
  if (fs.existsSync(path.join(ROOT, 'data/continuous-intelligence-history.json'))) {
    const ciHistory = readJson(path.join(ROOT, 'data/continuous-intelligence-history.json'), { entries: [] });
    for (const e of (ciHistory.entries || [])) {
      const { slug } = e;
      if (!slug) continue;
      const pages = publicPagesFor('continuous-intelligence', slug);
      const missing = pages.filter(p => !fileExists(p));
      if (missing.length > 0) {
        issue('WARN', 'ci-history', slug, `history entry exists but missing files: ${missing.join(', ')}`);
      }
    }
  }
}

// Content feeds
function checkContentFeeds() {
  const feedsDir = path.join(ROOT, 'data', 'feeds');
  if (!fs.existsSync(feedsDir)) {
    issue('ERROR', 'feeds', '', 'data/feeds directory missing');
    return;
  }
  const files = fs.readdirSync(feedsDir).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    issue('WARN', 'feeds', '', 'no feed files in data/feeds');
  }
}

// Sitemap references
function checkSitemapReferences() {
  const sitemapPath = path.join(ROOT, 'sitemap-core.xml');
  if (!fs.existsSync(sitemapPath)) {
    issue('WARN', 'sitemap', '', 'sitemap-core.xml not found');
    return;
  }
  const content = fs.readFileSync(sitemapPath, 'utf8');
  // Extract all loc URLs
  const locs = [...content.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  for (const loc of locs) {
    const rel = loc.replace('https://www.tradealphaai.com/', '');
    if (rel && !fileExists(rel) && !fileExists(rel + '.html')) {
      // Tolerate if it's just the root or known directory index
      if (rel !== '' && !rel.endsWith('/')) {
        issue('INFO', 'sitemap', rel, `sitemap entry has no corresponding file`);
      }
    }
  }
}

// Duplicate slugs across content types
function checkCrossQueueDuplicates() {
  const queues = [
    { path: 'data/editorial-topic-queue.json',         type: 'editorial' },
    { path: 'data/market-outlook-queue.json',           type: 'market-outlook' },
    { path: 'data/continuous-intelligence-queue.json',  type: 'continuous-intelligence' },
    { path: 'data/news-analysis-queue.json',            type: 'news-analysis' },
  ];

  const globalSlugs = {};
  for (const { path: qPath, type } of queues) {
    const q = readJson(path.join(ROOT, qPath), { topics: [] });
    for (const t of (q.topics || [])) {
      const slug = t.slug;
      if (globalSlugs[slug]) {
        issue('WARN', 'cross-queue', slug, `slug appears in both ${globalSlugs[slug]} and ${type}`);
      } else {
        globalSlugs[slug] = type;
      }
    }
  }
}

// Orphan draft directories (draft on disk but not in any queue)
function checkOrphanDrafts() {
  const draftTypes = ['editorial', 'market-outlook', 'continuous-intelligence', 'news-analysis'];
  const queues = {
    'editorial':              readJson(path.join(ROOT, 'data/editorial-topic-queue.json'), { topics: [] }),
    'market-outlook':         readJson(path.join(ROOT, 'data/market-outlook-queue.json'), { topics: [] }),
    'continuous-intelligence':readJson(path.join(ROOT, 'data/continuous-intelligence-queue.json'), { topics: [] }),
    'news-analysis':          readJson(path.join(ROOT, 'data/news-analysis-queue.json'), { topics: [] }),
  };

  for (const type of draftTypes) {
    const draftDir = path.join(ROOT, 'drafts', type);
    if (!fs.existsSync(draftDir)) continue;

    const slugs = fs.readdirSync(draftDir).filter(d =>
      fs.statSync(path.join(draftDir, d)).isDirectory()
    );
    const queueSlugs = new Set((queues[type].topics || []).map(t => t.slug));

    for (const slug of slugs) {
      if (!queueSlugs.has(slug)) {
        issue('INFO', 'orphan-draft', slug, `draft exists at drafts/${type}/${slug} but not in ${type} queue`);
      }
    }
  }
}

// Broken localized pairs (en exists but ar missing or vice versa)
function checkLocalizedPairs() {
  const draftTypes = ['editorial', 'market-outlook', 'continuous-intelligence'];
  for (const type of draftTypes) {
    const draftDir = path.join(ROOT, 'drafts', type);
    if (!fs.existsSync(draftDir)) continue;
    const slugs = fs.readdirSync(draftDir).filter(d =>
      fs.statSync(path.join(draftDir, d)).isDirectory()
    );
    for (const slug of slugs) {
      const hasEn = fileExists(`drafts/${type}/${slug}/en.html`);
      const hasAr = fileExists(`drafts/${type}/${slug}/ar.html`);
      if (hasEn && !hasAr) {
        issue('WARN', 'localization-parity', slug, `${type} draft has en.html but no ar.html`);
      }
      if (!hasEn && hasAr) {
        issue('WARN', 'localization-parity', slug, `${type} draft has ar.html but no en.html`);
      }
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const mode = arg('--repair') ? 'repair' : 'check';
  console.log(`[queue-reconciliation] mode=${mode} timestamp=${new Date().toISOString()}`);
  console.log('');

  console.log('[queue-reconciliation] Market-outlook queue...');
  checkMarketOutlookQueue(mode);

  console.log('[queue-reconciliation] Editorial queue...');
  checkEditorialQueue(mode);

  console.log('[queue-reconciliation] Continuous-intelligence queue...');
  checkCIQueue(mode);

  console.log('[queue-reconciliation] Publication history...');
  checkPublicationHistory();

  console.log('[queue-reconciliation] Content feeds...');
  checkContentFeeds();

  console.log('[queue-reconciliation] Sitemap references...');
  checkSitemapReferences();

  console.log('[queue-reconciliation] Cross-queue duplicate slugs...');
  checkCrossQueueDuplicates();

  console.log('[queue-reconciliation] Orphan drafts...');
  checkOrphanDrafts();

  console.log('[queue-reconciliation] Localized pairs...');
  checkLocalizedPairs();

  console.log('');

  const errors   = issues.filter(i => i.severity === 'ERROR');
  const warnings = issues.filter(i => i.severity === 'WARN');
  const infos    = issues.filter(i => i.severity === 'INFO');

  console.log(`[queue-reconciliation] ${issues.length} issue(s): ${errors.length} ERROR, ${warnings.length} WARN, ${infos.length} INFO`);
  if (mode === 'repair' && repairs.length > 0) {
    console.log(`[queue-reconciliation] ${repairs.length} repair(s) applied.`);
  }

  if (errors.length > 0) {
    console.error('[queue-reconciliation] FAIL — ERROR issues found. See above.');
    process.exit(1);
  }
  console.log('[queue-reconciliation] PASS — no blocking errors found.');
  process.exit(0);
}

main();
