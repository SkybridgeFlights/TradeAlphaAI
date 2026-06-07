'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const QUEUE_PATH  = path.join(ROOT, 'data', 'market-outlook-queue.json');
const FEEDS_DIR   = path.join(ROOT, 'data', 'feeds');
const failures    = [];

const queue   = readJson(QUEUE_PATH, { topics: [] });
const published = (queue.topics || []).filter((t) => t.status === 'published');

checkFeedFiles();
checkOutlookPages();
checkListingCoverage();
checkHomepage();

if (failures.length) {
  console.error(`Content feeds check FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

console.log(`Content feeds check passed. ${published.length} published market outlooks verified.`);

// ── Checks ────────────────────────────────────────────────────────────────────

function checkFeedFiles() {
  for (const name of ['latest-market-outlooks.json', 'latest-insights.json', 'homepage-featured.json']) {
    if (!exists(path.join('data', 'feeds', name))) {
      failures.push(`data/feeds/${name} missing — run node tools/update-content-feeds.js`);
    }
  }
}

function checkOutlookPages() {
  for (const topic of published) {
    const enPath = `market-outlook/${topic.slug}.html`;
    const arPath = `ar/market-outlook/${topic.slug}.html`;
    if (!exists(enPath)) failures.push(`Published topic ${topic.slug} has no public EN page: ${enPath}`);
    if (!exists(arPath)) failures.push(`Published topic ${topic.slug} has no public AR page: ${arPath}`);
  }
}

function checkListingCoverage() {
  const feed = readJson(path.join(FEEDS_DIR, 'latest-market-outlooks.json'), []);
  const feedSlugs = new Set(feed.map((item) => item.slug));

  for (const topic of published) {
    if (!feedSlugs.has(topic.slug)) {
      failures.push(`Published topic ${topic.slug} missing from data/feeds/latest-market-outlooks.json`);
    }
  }

  const enIndex = read('market-outlook/index.html');
  const arIndex = read('ar/market-outlook/index.html');

  if (!enIndex.includes('<!-- generated:outlook-feed:start -->')) {
    failures.push('market-outlook/index.html missing generated:outlook-feed markers');
  }
  if (!arIndex.includes('<!-- generated:outlook-feed:start -->')) {
    failures.push('ar/market-outlook/index.html missing generated:outlook-feed markers');
  }

  for (const topic of published.slice(0, 6)) {
    if (!enIndex.includes(`/market-outlook/${topic.slug}.html`)) {
      failures.push(`market-outlook/index.html does not link to published: ${topic.slug}`);
    }
    if (!arIndex.includes(`/ar/market-outlook/${topic.slug}.html`)) {
      failures.push(`ar/market-outlook/index.html does not link to published AR: ${topic.slug}`);
    }
  }
}

function checkHomepage() {
  const featured = readJson(path.join(FEEDS_DIR, 'homepage-featured.json'), []);
  if (!featured.length) {
    failures.push('data/feeds/homepage-featured.json is empty');
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exists(rel) {
  return fs.existsSync(typeof rel === 'string' && rel.startsWith(ROOT) ? rel : path.join(ROOT, rel));
}

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function readJson(fileOrRel, fallback) {
  try {
    const file = path.isAbsolute(fileOrRel) ? fileOrRel : path.join(ROOT, fileOrRel);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  } catch { return fallback; }
}
