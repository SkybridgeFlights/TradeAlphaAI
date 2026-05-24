'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'insight-topic-queue.json');
const mode = argValue('--mode') || 'review';
const selectedSlug = argValue('--slug');

if (!selectedSlug) run('node', ['tools/discover-insight-topics.js', '--limit=12']);

const queue = readJson(QUEUE_PATH, { topics: [] });
const topic = selectedSlug
  ? queue.topics.find((item) => item.slug === selectedSlug)
  : queue.topics.find((item) => ['approved', 'candidate'].includes(item.status));

if (!topic) {
  console.log('No candidate or approved insight topic is available.');
  process.exit(0);
}

run('node', ['tools/check-insight-duplicates.js', `--slug=${topic.slug}`]);

if (mode === 'publish-if-safe') {
  run('node', ['tools/generate-insights.js', '--queue', `--slug=${topic.slug}`, '--mode=review', '--force']);
  run('node', ['tools/generate-localized-pages.js']);
  run('node', ['tools/generate-article-registry.js']);
  run('node', ['tools/check-insight-quality.js', `--slug=${topic.slug}`]);
  run('node', ['tools/generate-insights.js', '--queue', `--slug=${topic.slug}`, '--mode=publish-if-safe', '--force']);
  run('node', ['tools/generate-localized-pages.js']);
  run('node', ['tools/generate-article-registry.js']);
  run('node', ['tools/check-insight-quality.js', `--slug=${topic.slug}`]);
  run('node', ['tools/check-article-pairs.js', '--refresh']);
} else {
  run('node', ['tools/generate-insights.js', '--queue', `--slug=${topic.slug}`, `--mode=${mode}`, '--force']);
  run('node', ['tools/generate-localized-pages.js']);
  run('node', ['tools/generate-article-registry.js']);
  run('node', ['tools/check-insight-quality.js', `--slug=${topic.slug}`]);
}

console.log(`Insight pipeline completed for ${topic.slug} in ${mode} mode.`);

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: false });
  if (result.status !== 0) process.exit(result.status || 1);
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}
