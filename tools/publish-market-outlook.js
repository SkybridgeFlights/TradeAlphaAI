'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'market-outlook-history.json');
const slugArg = argValue('--slug');
const execute = process.argv.includes('--execute');
const today = new Date().toISOString().slice(0, 10);

const queue = readJson(QUEUE_PATH, { topics: [] });
const history = readJson(HISTORY_PATH, { version: '1.0', updated: '', publications: [] });
const published = new Set((history.publications || []).map((item) => item.slug));
const topic = slugArg ? findBySlug(slugArg) : (queue.topics || []).find(isPublishable);

if (!topic) {
  console.log('No approved market outlook ready for publishing');
  process.exit(0);
}

const slug = topic.slug;
const draftEn = path.join(ROOT, 'drafts', 'market-outlook', slug, 'en.html');
const draftAr = path.join(ROOT, 'drafts', 'market-outlook', slug, 'ar.html');
const outEn = path.join(ROOT, 'market-outlook', `${slug}.html`);
const outAr = path.join(ROOT, 'ar', 'market-outlook', `${slug}.html`);
const outEnLocale = path.join(ROOT, 'en', 'market-outlook', `${slug}.html`);

for (const file of [draftEn, draftAr]) if (!fs.existsSync(file)) fail(`${slug}: missing draft ${relative(file)}`);
if (fs.existsSync(outEn) || fs.existsSync(outAr)) fail(`${slug}: public market outlook already exists`);

console.log(execute ? `Publishing market outlook: ${slug}` : `DRY_RUN market outlook publish: ${slug}`);
if (!execute) process.exit(0);

fs.copyFileSync(draftEn, outEn);
fs.copyFileSync(draftAr, outAr);
fs.copyFileSync(draftEn, outEnLocale);
topic.status = 'published';
topic.published_at = today;
queue.updated = today;
fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n', 'utf8');

history.updated = today;
history.publications = history.publications || [];
history.publications.push({ slug, publish_date: today, languages: ['en', 'ar'], content_type: 'market_outlook' });
fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');

run('npm', ['run', 'generate:seo-sitemaps']);
console.log(`Published market outlook: ${slug}`);

function isPublishable(item) {
  return Boolean(
    item &&
    item.status === 'reviewed' &&
    item.review_status === 'approved' &&
    item.target_publish_date <= today &&
    !published.has(item.slug) &&
    !fs.existsSync(path.join(ROOT, 'market-outlook', `${item.slug}.html`))
  );
}

function findBySlug(slug) {
  const topic = (queue.topics || []).find((item) => item.slug === slug);
  if (!topic) fail(`Market outlook topic not found: ${slug}`);
  if (!isPublishable(topic)) {
    console.log('No approved market outlook ready for publishing');
    process.exit(0);
  }
  return topic;
}

function run(command, args) {
  const cmd = process.platform === 'win32' && command === 'npm' ? 'npm.cmd' : command;
  const result = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
