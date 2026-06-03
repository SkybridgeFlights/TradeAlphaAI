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
const allowedStatuses = new Set(queue.policy?.allowed_statuses || ['draft', 'planned', 'queued', 'in_review', 'review', 'reviewed', 'scheduled', 'published']);

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
  if (topic.status === 'published') checkPublishedTopic(topic);
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
  // Published topics: draft folder is stale staging; published files are validated by checkPublishedTopic
  if (topic.status === 'published') return;
  const files = ['en.html', 'ar.html', 'metadata.json'];
  for (const file of files) {
    if (!fs.existsSync(path.join(dir, file))) failures.push(`${relative(dir)}: missing ${file}`);
  }
  for (const locale of ['en', 'ar']) {
    const file = path.join(dir, `${locale}.html`);
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const rel = relative(file);
    // Drafts are copied as-is to insights/ by publish-reviewed-article.js — they must be publication-ready
    if (hasCorruptedText(html)) failures.push(`${rel}: corrupted or mojibake text found`);
    if (!/<title>[^<]{10,}<\/title>/.test(html)) failures.push(`${rel}: missing meaningful title`);
    if (!/<meta name="description" content="[^"]{50,}"/.test(html)) failures.push(`${rel}: missing meaningful meta description`);
    if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: must have index,follow robots (draft is copied directly to insights/ on publish)`);
    if (!/<link rel="canonical"/.test(html)) failures.push(`${rel}: missing canonical link`);
    if (!/<link rel="alternate" hreflang="en"/.test(html) || !/<link rel="alternate" hreflang="ar"/.test(html)) failures.push(`${rel}: missing bilingual hreflang`);
    if (!/<meta property="og:title"/.test(html) || !/<meta property="og:description"/.test(html)) failures.push(`${rel}: missing social metadata`);
    if (!/<meta name="twitter:card"/.test(html)) failures.push(`${rel}: missing twitter:card`);
    if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
    if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing FAQPage schema`);
    if ((html.match(/<details/g) || []).length < 3) failures.push(`${rel}: needs at least 3 FAQ blocks`);
    if (!/id="related-research"/.test(html)) failures.push(`${rel}: missing related-research section`);
    if (!/id="continue-learning"/.test(html)) failures.push(`${rel}: missing continue-learning section`);
    if (!/educational-disclaimer|Educational disclaimer|insight-disclaimer|إخلاء المسؤولية التعليمي|تنبيه تعليمي/.test(html)) failures.push(`${rel}: missing educational disclaimer`);
    if (locale === 'ar' && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) failures.push(`${rel}: missing Arabic RTL markers`);
    if (forbiddenClaims(stripHtml(html))) failures.push(`${rel}: forbidden promotional or advice wording found`);
  }
  const metadata = path.join(dir, 'metadata.json');
  if (fs.existsSync(metadata)) {
    const data = readJson(metadata);
    const rel = relative(metadata);
    if (hasCorruptedText(JSON.stringify(data))) failures.push(`${rel}: corrupted or mojibake text found`);
    if (data.auto_publish !== false) failures.push(`${rel}: auto_publish must be false`);
    if (topic.status === 'in_review' && data.public_site_updated !== false) failures.push(`${rel}: public_site_updated must be false for generated drafts`);
    if (!Array.isArray(data.languages) || !data.languages.includes('en') || !data.languages.includes('ar')) failures.push(`${rel}: missing bilingual language metadata`);
  }
}

function checkPublishedTopic(topic) {
  const slug = topic.slug || '';
  const enFile = path.join(ROOT, 'insights', `${slug}.html`);
  const arFile = path.join(ROOT, 'ar', 'insights', `${slug}.html`);
  const registryFile = path.join(ROOT, 'data', 'insights', 'article-registry.json');
  if (!fs.existsSync(enFile)) failures.push(`${slug}: published status requires insights/${slug}.html`);
  if (!fs.existsSync(arFile)) failures.push(`${slug}: published status requires ar/insights/${slug}.html`);
  if (!fs.existsSync(registryFile)) failures.push(`${slug}: published status requires article registry`);
  for (const file of [enFile, arFile]) {
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const rel = relative(file);
    if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: published article must be indexable`);
    if (!/<link rel="canonical"/.test(html)) failures.push(`${rel}: missing canonical`);
    if (!/<link rel="alternate" hreflang="ar"/.test(html) || !/<link rel="alternate" hreflang="en"/.test(html)) failures.push(`${rel}: missing bilingual hreflang`);
    if (!/<meta property="og:title"/.test(html) || !/<meta name="twitter:card"/.test(html)) failures.push(`${rel}: missing social metadata`);
    if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing Article schema`);
    if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) failures.push(`${rel}: missing FAQ schema`);
    if ((html.match(/<details/g) || []).length < 3) failures.push(`${rel}: missing FAQ blocks`);
    if (!/id="related-research"/.test(html) || !/id="continue-learning"/.test(html)) failures.push(`${rel}: missing related/discovery sections`);
  }
}

function forbiddenClaims(value) {
  return /\b(?:guaranteed profit|best stock to buy|buy now|sure signal|price target|will outperform|must own)\b/i.test(value || '');
}

function hasCorruptedText(value) {
  const text = String(value || '');
  return /[\uFFFD]/.test(text) || /(?:\?{3,}|\u00D8|\u00D9|\u00E2\u20AC|\u00C3)/.test(text);
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
