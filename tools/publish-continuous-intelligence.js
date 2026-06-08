'use strict';

/**
 * Phase 70 Part D — Continuous Intelligence Publisher
 * Promotes a reviewed draft to public pages and updates the queue and history.
 *
 * Usage:
 *   node tools/publish-continuous-intelligence.js --slug=<slug> --execute
 *   node tools/publish-continuous-intelligence.js --slug=<slug>   (dry-run)
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const TODAY   = new Date().toISOString().slice(0, 10);
const EXECUTE = process.argv.includes('--execute');

const QUEUE_PATH   = path.join(ROOT, 'data', 'continuous-intelligence-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'continuous-intelligence-history.json');
const SITEMAP_PATH = path.join(ROOT, 'sitemap-core.xml');

function argValue(name) {
  const prefix = `${name}=`;
  const found  = process.argv.find(a => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const slugArg = argValue('--slug');
  if (!slugArg) {
    console.error('[continuous-intelligence-publish] --slug=<slug> required');
    process.exit(1);
  }

  const draftDir = path.join(ROOT, 'drafts', 'continuous-intelligence', slugArg);
  const enDraft  = path.join(draftDir, 'en.html');
  const arDraft  = path.join(draftDir, 'ar.html');
  const metaFile = path.join(draftDir, 'metadata.json');

  if (!fs.existsSync(enDraft) || !fs.existsSync(arDraft)) {
    console.error(`[continuous-intelligence-publish] Draft missing for: ${slugArg}`);
    process.exit(1);
  }

  const meta  = readJson(metaFile, {});
  const queue = readJson(QUEUE_PATH, { topics: [] });
  const topic = (queue.topics || []).find(t => t.slug === slugArg);

  if (!topic) {
    console.error(`[continuous-intelligence-publish] Topic not found in queue: ${slugArg}`);
    process.exit(1);
  }

  // Public destination paths
  const publicPaths = [
    { dir: path.join(ROOT, 'intelligence'),     file: `${slugArg}.html`, src: enDraft },
    { dir: path.join(ROOT, 'en', 'intelligence'), file: `${slugArg}.html`, src: enDraft },
    { dir: path.join(ROOT, 'ar', 'intelligence'), file: `${slugArg}.html`, src: arDraft },
  ];

  const relPaths = publicPaths.map(p => path.join(p.dir.replace(ROOT + path.sep, ''), p.file).replaceAll('\\', '/'));

  console.log('[continuous-intelligence-publish]');
  console.log(`slug=${slugArg}`);
  console.log(`execute=${EXECUTE}`);
  console.log(`public_paths=${relPaths.join(', ')}`);

  if (!EXECUTE) {
    console.log('[continuous-intelligence-publish] Dry-run — pass --execute to publish.');
    return;
  }

  // Copy to public
  for (const dest of publicPaths) {
    ensureDir(dest.dir);
    fs.copyFileSync(dest.src, path.join(dest.dir, dest.file));
    console.log(`[continuous-intelligence-publish] Published: ${path.relative(ROOT, path.join(dest.dir, dest.file)).replaceAll('\\', '/')}`);
  }

  console.log('[CI PUBLIC PAGES]');
  console.log(`count=${relPaths.length}`);
  console.log(`paths=${relPaths.join(', ')}`);

  // Update queue status
  topic.status      = 'published';
  topic.published_at = new Date().toISOString();
  queue.updated     = new Date().toISOString();
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

  // Update history
  const history = readJson(HISTORY_PATH, { schema_version: '1.0', publications: [] });
  history.publications = (history.publications || []).filter(p => p.slug !== slugArg);
  history.publications.unshift({
    slug:           slugArg,
    content_type:   'continuous-intelligence',
    title_en:       topic.title_en || meta.title_en,
    title_ar:       topic.title_ar || meta.title_ar,
    family:         topic.family   || meta.family,
    confidence:     topic.confidence || meta.confidence,
    publish_date:   TODAY,
    published_at:   new Date().toISOString(),
    public_pages:   relPaths,
    url:            `https://www.tradealphaai.com/intelligence/${slugArg}.html`,
    ar_url:         `https://www.tradealphaai.com/ar/intelligence/${slugArg}.html`,
  });
  history.schema_version = '1.0';
  history.updated        = new Date().toISOString();
  ensureDir(path.dirname(HISTORY_PATH));
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
  console.log(`[continuous-intelligence-publish] History updated: data/continuous-intelligence-history.json`);

  // Update sitemap (append if not already present)
  if (fs.existsSync(SITEMAP_PATH)) {
    let sitemap = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const enLoc = `https://www.tradealphaai.com/intelligence/${slugArg}.html`;
    const arLoc = `https://www.tradealphaai.com/ar/intelligence/${slugArg}.html`;
    if (!sitemap.includes(enLoc)) {
      const entry = `
  <url>
    <loc>${enLoc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.80</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}"/>
    <xhtml:link rel="alternate" hreflang="ar" href="${arLoc}"/>
  </url>
  <url>
    <loc>${arLoc}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.80</priority>
    <xhtml:link rel="alternate" hreflang="ar" href="${arLoc}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${enLoc}"/>
  </url>`;
      sitemap = sitemap.replace('</urlset>', entry + '\n</urlset>');
      fs.writeFileSync(SITEMAP_PATH, sitemap, 'utf8');
      console.log(`[continuous-intelligence-publish] Sitemap updated with ${slugArg}`);
    }
  }

  // Write publishing report for Telegram integration
  const reportPath = path.join(ROOT, 'data', 'intelligence', 'publishing-report.json');
  const report     = readJson(reportPath, {});
  const updated = {
    ...report,
    published:            true,
    content_type:         'continuous-intelligence',
    selected_content_type: 'continuous-intelligence',
    selected_topic:       slugArg,
    timestamp:            new Date().toISOString(),
    public_pages_created: relPaths,
    title_en:             topic.title_en || meta.title_en,
    title_ar:             topic.title_ar || meta.title_ar,
    family:               topic.family   || meta.family,
    confidence:           topic.confidence || meta.confidence,
  };
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
  console.log(`[continuous-intelligence-publish] Publishing report updated.`);

  console.log(`[continuous-intelligence-publish] SUCCESS: ${slugArg} published.`);
}

main();
