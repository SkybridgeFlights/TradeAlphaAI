'use strict';

const fs = require('fs');
const path = require('path');
const { ensureProductionEditorialLayout, hasProductionEditorialLayout } = require('./editorial-layout-renderer');

const ROOT = path.resolve(__dirname, '..');
const slug = argValue('--slug');
if (!slug) fail('Usage: node tools/repair-editorial-layout.js --slug=<slug>');

const queue = readJson(path.join(ROOT, 'data', 'editorial-topic-queue.json'), { topics: [] });
const topic = (queue.topics || []).find((item) => item.slug === slug);
if (!topic) fail(`Topic not found in editorial queue: ${slug}`);

const targets = [
  { file: path.join(ROOT, 'drafts', 'editorial', slug, 'en.html'), locale: 'en' },
  { file: path.join(ROOT, 'drafts', 'editorial', slug, 'ar.html'), locale: 'ar' },
  { file: path.join(ROOT, 'insights', `${slug}.html`), locale: 'en' },
  { file: path.join(ROOT, 'ar', 'insights', `${slug}.html`), locale: 'ar' },
  { file: path.join(ROOT, 'en', 'insights', `${slug}.html`), locale: 'en' }
];

let repaired = 0;
for (const target of targets) {
  if (!fs.existsSync(target.file)) {
    console.log(`Missing, skipped: ${relative(target.file)}`);
    continue;
  }
  const original = fs.readFileSync(target.file, 'utf8');
  const repairedHtml = ensureProductionEditorialLayout(original, topic, target.locale);
  if (!hasProductionEditorialLayout(repairedHtml, target.locale === 'ar')) fail(`${relative(target.file)} still lacks production layout after repair`);
  if (repairedHtml !== original) {
    fs.writeFileSync(target.file, repairedHtml, 'utf8');
    repaired++;
    console.log(`Repaired layout: ${relative(target.file)}`);
  } else {
    console.log(`Already production layout: ${relative(target.file)}`);
  }
}

console.log(`Editorial layout repair complete. Files changed: ${repaired}`);

function argValue(name) {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : '';
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function relative(file) {
  return path.relative(ROOT, file).replaceAll('\\', '/');
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
