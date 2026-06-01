'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_DIR = path.join(ROOT, 'drafts', 'editorial');
const failures = [];

const queue = readJson(QUEUE_PATH);
const topics = Array.isArray(queue.topics) ? queue.topics : [];
const slugs = new Set();
const allowedStatuses = new Set(queue.policy?.allowed_statuses || ['draft', 'review', 'scheduled', 'published']);

if (!topics.length) failures.push('data/editorial-topic-queue.json: topics must not be empty');
if (queue.policy?.auto_publish !== false) failures.push('data/editorial-topic-queue.json: policy.auto_publish must be false');

for (const topic of topics) {
  checkTopic(topic, slugs);
  checkDraftIfPresent(topic);
}

if (failures.length) {
  console.error('Editorial quality check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Editorial quality check passed for ${topics.length} queued topic(s).`);

function checkTopic(topic, slugs) {
  const label = topic.slug || '<missing slug>';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.slug || '')) failures.push(`${label}: malformed editorial slug`);
  if (slugs.has(topic.slug)) failures.push(`${label}: duplicate editorial slug`);
  slugs.add(topic.slug);
  if (!topic.title_en || !topic.title_ar) failures.push(`${label}: missing bilingual titles`);
  if (!topic.category) failures.push(`${label}: missing category`);
  if (!Array.isArray(topic.tags) || topic.tags.length < 2) failures.push(`${label}: needs at least 2 tags`);
  if (!Array.isArray(topic.language_support) || !topic.language_support.includes('en') || !topic.language_support.includes('ar')) failures.push(`${label}: must include EN and AR language support`);
  if (!allowedStatuses.has(topic.status)) failures.push(`${label}: invalid status ${topic.status}`);
  if (topic.status === 'published') failures.push(`${label}: queue should not mark generated editorial topics as published without release review`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(topic.target_publish_date || '')) failures.push(`${label}: target_publish_date must be YYYY-MM-DD`);
  if (!Number.isInteger(topic.estimated_read_time) || topic.estimated_read_time < 4 || topic.estimated_read_time > 15) failures.push(`${label}: estimated_read_time must be 4-15 minutes`);
  if (!topic.evergreen_category) failures.push(`${label}: missing evergreen_category`);
  if (!topic.discovery_cluster) failures.push(`${label}: missing discovery_cluster`);
  if (!Array.isArray(topic.related_comparisons)) failures.push(`${label}: related_comparisons must be an array`);
  if (!Array.isArray(topic.related_hubs) || topic.related_hubs.length < 1) failures.push(`${label}: needs at least one related hub`);
  if ([...(topic.related_stocks || []), ...(topic.related_etfs || [])].some((symbol) => !/^[A-Z0-9.]+$/.test(symbol))) failures.push(`${label}: related symbols must be uppercase tickers`);
  if (forbiddenClaims(JSON.stringify(topic))) failures.push(`${label}: forbidden promotional or advice wording found`);
}

function checkDraftIfPresent(topic) {
  const dir = path.join(DRAFT_DIR, topic.slug || '');
  if (!fs.existsSync(dir)) return;
  const files = ['en.html', 'ar.html', 'metadata.json'];
  for (const file of files) {
    if (!fs.existsSync(path.join(dir, file))) failures.push(`${relative(dir)}: missing ${file}`);
  }
  for (const locale of ['en', 'ar']) {
    const file = path.join(dir, `${locale}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const rel = relative(file);
    if (!/<meta name="robots" content="noindex,nofollow"/.test(html)) failures.push(`${rel}: draft must remain noindex,nofollow`);
    if (!/<meta property="og:title"/.test(html) || !/<meta property="og:description"/.test(html)) failures.push(`${rel}: missing social metadata`);
    if (!/<script type="application\/ld\+json">[\s\S]*"@type": "Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
    if ((html.match(/<details/g) || []).length < 3) failures.push(`${rel}: missing FAQ blocks`);
    if (!/id="related-research"/.test(html)) failures.push(`${rel}: missing related research section`);
    if (!/id="discovery"/.test(html)) failures.push(`${rel}: missing discovery section`);
    if (locale === 'ar' && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing Arabic RTL markers`);
    if (forbiddenClaims(stripHtml(html))) failures.push(`${rel}: forbidden promotional or advice wording found`);
  }
}

function forbiddenClaims(value) {
  return /\b(?:guaranteed profit|best stock to buy|buy now|sure signal|price target|will outperform|must own)\b/i.test(value || '');
}

function stripHtml(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${relative(file)}: ${error.message}`);
    return {};
  }
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}
