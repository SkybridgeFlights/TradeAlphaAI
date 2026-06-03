'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'news-source-registry.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'news-analysis-queue.json');

const ALLOWED_SOURCE_TYPES = new Set([
  'sec_filing',
  'official_earnings_report',
  'federal_reserve_release',
  'cpi_release',
  'nfp_release',
  'gdp_release',
  'pce_release',
  'etf_provider_update',
  'platform_market_data'
]);

const ALLOWED_RELIABILITY = new Set(['high', 'official', 'verified']);
const validateOnly = process.argv.includes('--validate-only');

const registry = readJson(REGISTRY_PATH);
const sources = registry.sources || [];

if (!sources.length) {
  console.log('News source registry is empty — no sources to ingest.');
  process.exit(0);
}

const failures = [];

for (const source of sources) {
  const issues = validateSource(source);
  if (issues.length) failures.push(...issues.map((msg) => `[${source.source_name || '<unnamed>'}] ${msg}`));
}

if (failures.length) {
  console.error('Source registry validation failed:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}

if (validateOnly) {
  console.log(`All ${sources.length} source(s) passed validation.`);
  process.exit(0);
}

const queue = readJson(QUEUE_PATH);
const existingUrls = new Set(
  (queue.topics || []).flatMap((t) => (t.sources || []).map((s) => s.url))
);

const added = [];

for (const source of sources) {
  if (existingUrls.has(source.source_url)) {
    console.log(`Skipping already-queued source: ${source.source_url}`);
    continue;
  }
  const topic = buildTopic(source);
  (queue.topics = queue.topics || []).push(topic);
  existingUrls.add(source.source_url);
  added.push(topic.slug);
  console.log(`Queued: ${topic.slug} (${source.source_type})`);
}

if (!added.length) {
  console.log('No new sources to add — queue is up to date.');
  process.exit(0);
}

queue.updated = new Date().toISOString().slice(0, 10);
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');
console.log(`Added ${added.length} topic(s) to data/news-analysis-queue.json: ${added.join(', ')}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateSource(source) {
  const issues = [];
  if (!source.source_type) {
    issues.push('missing source_type');
  } else if (!ALLOWED_SOURCE_TYPES.has(source.source_type)) {
    issues.push(`unsupported source_type "${source.source_type}". Allowed: ${[...ALLOWED_SOURCE_TYPES].join(', ')}`);
  }
  if (!source.source_name || !source.source_name.trim()) issues.push('missing source_name');
  if (!source.source_url || !/^https?:\/\/.+/.test(source.source_url)) issues.push('source_url must be a valid https:// URL');
  if (!source.fetched_at || !/^\d{4}-\d{2}-\d{2}/.test(source.fetched_at)) issues.push('fetched_at must be YYYY-MM-DD');
  if (!Array.isArray(source.related_tickers) || !source.related_tickers.length) issues.push('related_tickers must be a non-empty array of ticker symbols');
  for (const ticker of source.related_tickers || []) {
    if (!/^[A-Z0-9.]+$/.test(ticker)) issues.push(`related_tickers: "${ticker}" must be uppercase ticker format`);
  }
  if (!source.event_type || !source.event_type.trim()) issues.push('missing event_type');
  if (!source.reliability_level) {
    issues.push('missing reliability_level');
  } else if (!ALLOWED_RELIABILITY.has(source.reliability_level)) {
    issues.push(`reliability_level must be one of: ${[...ALLOWED_RELIABILITY].join(', ')}`);
  }
  return issues;
}

function buildTopic(source) {
  const datePart = source.fetched_at.slice(0, 10).replace(/-/g, '');
  const tickerPart = slugify(source.related_tickers[0] || 'market');
  const typePart = source.source_type.replace(/_/g, '-');
  const slug = `${typePart}-${tickerPart}-${datePart}`.slice(0, 80);

  return {
    slug,
    title_en: `${source.source_name}: Educational Market Analysis`,
    title_ar: `${source.source_name}: تحليل تعليمي للسوق`,
    status: 'planned',
    review_status: 'pending',
    content_type: 'news_analysis',
    event_type: source.event_type,
    target_publish_date: source.fetched_at.slice(0, 10),
    related_tickers: source.related_tickers,
    auto_publish: false,
    sources: [
      {
        type: source.source_type,
        title: source.source_name,
        url: source.source_url,
        fetched_at: source.fetched_at,
        reliability_level: source.reliability_level
      }
    ]
  };
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`Cannot read ${path.relative(ROOT, file)}: ${err.message}`);
    process.exit(1);
  }
}
