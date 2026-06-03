'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const slug = argValue('--slug');
const execute = process.argv.includes('--execute');
const telegram = process.argv.includes('--telegram-dry-run') || process.argv.includes('--telegram-send');
const telegramSend = process.argv.includes('--telegram-send');

if (!slug) fail('Usage: node tools/publish-reviewed-article.js --slug=<slug> [--execute] [--telegram-dry-run|--telegram-send]');

const queue = readJson(QUEUE_PATH);
const topic = (queue.topics || []).find((item) => item.slug === slug);
if (!topic) fail(`Topic not found: ${slug}`);
if (topic.status !== 'reviewed') fail(`Refusing publish: ${slug} status must be reviewed, found ${topic.status}`);
if (topic.review_status !== 'approved') fail(`Refusing publish: ${slug} review_status must be approved`);

const draftDir = path.join(ROOT, 'drafts', 'editorial', slug);
const publicEn = path.join(ROOT, 'insights', `${slug}.html`);
const publicAr = path.join(ROOT, 'ar', 'insights', `${slug}.html`);
const draftEn = path.join(draftDir, 'en.html');
const draftAr = path.join(draftDir, 'ar.html');

if (!fs.existsSync(draftEn)) fail(`Missing reviewed EN draft: ${relative(draftEn)}`);
if (!fs.existsSync(draftAr)) fail(`Missing reviewed AR draft: ${relative(draftAr)}`);
if (!hasRequiredArticleParts(fs.readFileSync(draftEn, 'utf8'), false)) fail(`${relative(draftEn)} is missing required article metadata/schema/discovery`);
if (!hasRequiredArticleParts(fs.readFileSync(draftAr, 'utf8'), true)) fail(`${relative(draftAr)} is missing required Arabic article metadata/schema/discovery`);

console.log(execute ? 'EXECUTE mode requested.' : 'DRY_RUN active. No files will be published.');
console.log(`Would publish ${relative(draftEn)} -> ${relative(publicEn)}`);
console.log(`Would publish ${relative(draftAr)} -> ${relative(publicAr)}`);
console.log('Would refresh: article registry, search index, SEO sitemaps, and insight indexes.');

if (!execute) process.exit(0);

if (fs.existsSync(publicEn) || fs.existsSync(publicAr)) fail('Refusing to overwrite existing public article files.');
fs.copyFileSync(draftEn, publicEn);
fs.copyFileSync(draftAr, publicAr);
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';
run(NPM, ['run', 'article-registry:generate']);
run(NPM, ['run', 'search:generate']);
run(NPM, ['run', 'generate:seo-sitemaps']);
run(NPM, ['run', 'check:editorial']);
run(NPM, ['run', 'check:utf8']);
run(NPM, ['run', 'check:production']);
run(NPM, ['run', 'check:seo']);
run(NPM, ['run', 'check:indexing']);
run(NPM, ['run', 'check:social-meta']);

if (telegram) {
  const args = ['tools/telegram-publish-article.js', `--slug=${slug}`, '--locale=both'];
  if (telegramSend) args.push('--send');
  run(process.execPath, args);
}

function hasRequiredArticleParts(html, ar) {
  if (!/<meta name="robots" content="index,follow/.test(html)) return false;
  if (!/<link rel="canonical"/.test(html)) return false;
  if (!/<link rel="alternate" hreflang="en"/.test(html) || !/<link rel="alternate" hreflang="ar"/.test(html)) return false;
  if (!/<meta property="og:title"/.test(html) || !/<meta name="twitter:card"/.test(html)) return false;
  if (!/<script type="application\/ld\+json">[\s\S]*"Article"[\s\S]*<\/script>/.test(html)) return false;
  if (!/<script type="application\/ld\+json">[\s\S]*"FAQPage"[\s\S]*<\/script>/.test(html)) return false;
  if (!/id="related-research"/.test(html) || !/id="continue-learning"/.test(html)) return false;
  if (ar && !/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) return false;
  return true;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status || 1);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`${relative(file)}: ${error.message}`);
  }
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
