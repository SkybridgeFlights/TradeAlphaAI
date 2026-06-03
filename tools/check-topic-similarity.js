'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const memory = readJson('data/topic-memory.json', { policy: {}, recent_topics: [] });
const queues = [
  ['editorial', readJson('data/editorial-topic-queue.json', { topics: [] }).topics || []],
  ['market_outlook', readJson('data/market-outlook-queue.json', { topics: [] }).topics || []]
];
const threshold = memory.policy?.similarity_threshold || 0.82;
const failures = [];
const warnings = [];

for (const [type, topics] of queues) {
  for (const topic of topics) {
    const text = topicText(topic);
    for (const previous of memory.recent_topics || []) {
      const score = similarity(text, topicText(previous));
      if (score >= threshold) {
        const msg = `${type}:${topic.slug}: similarity ${score.toFixed(2)} with recent topic ${previous.slug}`;
        if (['reviewed', 'published'].includes(topic.status)) failures.push(msg);
        else warnings.push(msg);
      }
    }
  }
}

if (warnings.length) {
  console.warn('Topic similarity warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
if (failures.length) {
  console.error('Topic similarity check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('Topic similarity check passed.');

function topicText(topic) {
  return normalize(`${topic.title_en || topic.title || ''} ${topic.category || ''} ${topic.discovery_cluster || topic.topic_cluster || ''} ${(topic.tags || []).join(' ')}`);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function similarity(a, b) {
  const aSet = new Set(a.split(' ').filter(Boolean));
  const bSet = new Set(b.split(' ').filter(Boolean));
  if (!aSet.size || !bSet.size) return 0;
  const overlap = [...aSet].filter((word) => bSet.has(word)).length;
  return overlap / Math.max(aSet.size, bSet.size);
}

function readJson(rel, fallback) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
}
