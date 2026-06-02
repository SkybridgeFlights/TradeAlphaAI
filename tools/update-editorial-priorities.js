'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TRACKER = path.join(ROOT, 'data', 'seo-performance-tracker.json');
const QUEUE = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const write = process.argv.includes('--write');

const tracker = JSON.parse(fs.readFileSync(TRACKER, 'utf8'));
const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
const pages = Array.isArray(tracker.pages) ? tracker.pages : [];
const topics = Array.isArray(queue.topics) ? queue.topics : [];
const clusterSignals = new Map();

for (const page of pages) {
  const cluster = page.cluster || 'unknown';
  const signal = clusterSignals.get(cluster) || { cluster, score: 0, pages: 0, reasons: new Set() };
  signal.pages += 1;
  if (page.indexing_status !== 'indexed') {
    signal.score += 30;
    signal.reasons.add('indexing coverage');
  }
  if (page.priority >= 85 && page.impressions_28d < 250) {
    signal.score += 18;
    signal.reasons.add('low impressions on priority pages');
  }
  if (page.impressions_28d >= 1000 && page.ctr_28d < 0.035) {
    signal.score += 22;
    signal.reasons.add('low CTR on visible pages');
  }
  if (page.avg_position_28d >= 8 && page.avg_position_28d <= 20) {
    signal.score += 16;
    signal.reasons.add('position 8-20 opportunity');
  }
  if (page.locale === 'ar' && (page.ctr_28d < 0.025 || page.avg_position_28d > 20)) {
    signal.score += 14;
    signal.reasons.add('Arabic reinforcement');
  }
  clusterSignals.set(cluster, signal);
}

const ranked = [...clusterSignals.values()].sort((a, b) => b.score - a.score);
const suggestions = [];

for (const signal of ranked) {
  const matching = topics.filter((topic) => (topic.discovery_cluster || '').toLowerCase() === signal.cluster.toLowerCase());
  const action = matching.length ? 'raise_existing_topic_priority' : 'add_new_editorial_topic';
  suggestions.push({
    cluster: signal.cluster,
    score: signal.score,
    reasons: [...signal.reasons],
    action,
    topics: matching.map((topic) => topic.slug)
  });
}

console.log(write ? 'WRITE mode: applying priority suggestions.' : 'DRY_RUN active. No editorial queue changes were written.');
for (const item of suggestions.slice(0, 10)) {
  console.log(`${item.score} | ${item.action} | ${item.cluster}`);
  console.log(`  reasons=${item.reasons.join(', ') || 'monitor'}`);
  console.log(`  topics=${item.topics.join(', ') || 'none'}`);
}

if (write) {
  const bySlug = new Map(topics.map((topic) => [topic.slug, topic]));
  for (const item of suggestions) {
    for (const slug of item.topics) {
      const topic = bySlug.get(slug);
      if (!topic || topic.status === 'published') continue;
      topic.priority_score = Math.min(100, Math.max(Number(topic.priority_score || 50), Math.round(item.score)));
      const note = `SEO performance signal: ${item.reasons.join(', ') || 'monitor'}`;
      topic.editor_notes = topic.editor_notes ? `${topic.editor_notes} ${note}` : note;
    }
  }
  queue.updated = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2) + '\n', 'utf8');
  console.log('Editorial priority suggestions written.');
}
