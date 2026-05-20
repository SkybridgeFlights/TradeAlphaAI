'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'insight-topic-queue.json');
const EXISTING_PATH = path.join(ROOT, 'data', 'insight-topics.json');

const selectedSlug = argValue('--slug');
const queue = readJson(QUEUE_PATH, { topics: [] });
const existing = readJson(EXISTING_PATH, { articles: [] });
const failures = [];

const existingItems = [
  ...(existing.articles || []).map((a) => ({
    source: 'data/insight-topics.json',
    slug: a.slug,
    title: a.h1 || a.title || a.pageTitle,
    keywords: a.targetKeywords || topicWords(a),
    angle: a.angle || a.lead || ''
  })),
  ...listInsightFiles().map((item) => ({ ...item, source: 'insights/' }))
];

let topics = queue.topics || [];
if (selectedSlug) topics = topics.filter((topic) => topic.slug === selectedSlug);
if (selectedSlug && !topics.length) failures.push(`Queue topic not found: ${selectedSlug}`);

const queueSlugs = new Map();
const queueTitles = new Map();
for (const topic of queue.topics || []) {
  addSeen(queueSlugs, topic.slug, `queue:${topic.slug}`, 'duplicate queued slug');
  addSeen(queueTitles, normalize(topic.title), `queue:${topic.slug}`, 'duplicate queued title');
}

for (const topic of topics) {
  const titleKey = normalize(topic.title);
  for (const existingItem of existingItems) {
    const isOwnGeneratedFile = existingItem.source === 'insights/' && existingItem.slug === topic.slug && ['draft', 'published'].includes(topic.status);
    if (isOwnGeneratedFile) continue;
    if (topic.slug === existingItem.slug) failures.push(`${topic.slug}: duplicate slug already exists in ${existingItem.source}`);
    if (titleKey && titleKey === normalize(existingItem.title)) failures.push(`${topic.slug}: duplicate title already exists in ${existingItem.source}`);

    const topicText = `${topic.title} ${topic.angle} ${(topic.targetKeywords || []).join(' ')}`;
    const existingText = `${existingItem.title} ${existingItem.angle} ${(existingItem.keywords || []).join(' ')}`;
    const similarity = jaccard(words(topicText), words(existingText));
    if (similarity >= 0.72) failures.push(`${topic.slug}: very similar topic to ${existingItem.slug || existingItem.title} (${similarity.toFixed(2)})`);

    const keywordOverlap = jaccard(topic.targetKeywords || [], existingItem.keywords || []);
    if ((topic.targetKeywords || []).length >= 4 && keywordOverlap >= 0.8) {
      failures.push(`${topic.slug}: repeated keyword cluster overlaps ${existingItem.slug || existingItem.title} (${keywordOverlap.toFixed(2)})`);
    }

    if (normalize(topic.angle) && normalize(topic.angle) === normalize(existingItem.angle)) {
      failures.push(`${topic.slug}: repeated article angle already exists`);
    }
  }
}

if (failures.length) {
  console.error('Insight duplicate check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Insight duplicate check passed for ${topics.length} topic(s).`);

function addSeen(map, key, label, message) {
  if (!key) return;
  if (map.has(key)) failures.push(`${message}: ${key} (${map.get(key)} and ${label})`);
  else map.set(key, label);
}

function listInsightFiles() {
  const dir = path.join(ROOT, 'insights');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.html') && name !== 'index.html')
    .map((name) => {
      const html = fs.readFileSync(path.join(dir, name), 'utf8');
      return {
        slug: name.replace(/\.html$/, ''),
        title: (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '',
        keywords: words((html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || ''),
        angle: (html.match(/<p class="market-lead">([\s\S]*?)<\/p>/) || [])[1] || ''
      };
    });
}

function topicWords(item) {
  return words(`${item.h1 || ''} ${item.metaDescription || ''} ${item.lead || ''} ${item.category || ''}`);
}

function words(value) {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'what', 'when', 'where', 'market', 'research']);
  return String(value).toLowerCase().replace(/<[^>]+>/g, ' ').split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !stop.has(w));
}

function jaccard(a, b) {
  const as = new Set(a.map(normalize).filter(Boolean));
  const bs = new Set(b.map(normalize).filter(Boolean));
  if (!as.size || !bs.size) return 0;
  let overlap = 0;
  as.forEach((item) => { if (bs.has(item)) overlap += 1; });
  return overlap / new Set([...as, ...bs]).size;
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/&amp;/g, 'and').replace(/[^a-z0-9]+/g, ' ').trim();
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}
