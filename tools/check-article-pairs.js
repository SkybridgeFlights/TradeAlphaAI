'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const SITE = 'https://www.tradealphaai.com';
const failures = [];

if (!fs.existsSync(REGISTRY_PATH) || process.argv.includes('--refresh')) {
  const result = spawnSync(process.execPath, ['tools/generate-article-registry.js'], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

const registry = readJson(REGISTRY_PATH, { articles: [] });
const published = (registry.articles || []).filter((entry) => entry.status === 'published');
const enFiles = articleFiles('insights');
const arFiles = articleFiles(path.join('ar', 'insights'));
const enPublishedSlugs = enFiles.filter((slug) => isIndexable(read(`insights/${slug}.html`)));
const arPublishedSlugs = arFiles.filter((slug) => isIndexable(read(`ar/insights/${slug}.html`)));

sameSet('published English files and registry', enPublishedSlugs, published.map((entry) => entry.slug));
sameSet('published Arabic files and registry', arPublishedSlugs, published.map((entry) => entry.slug));
sameSet('published English and Arabic article files', enPublishedSlugs, arPublishedSlugs);

for (const entry of published) checkPair(entry);
checkIndexes(published);
checkSitemaps(published);

if (failures.length) {
  console.error('Article pair contract check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Article pair contract passed for ${published.length} published bilingual article pair(s).`);

function checkPair(entry) {
  const slug = entry.slug;
  const enPath = `insights/${slug}.html`;
  const arPath = `ar/insights/${slug}.html`;
  const enHtml = read(enPath);
  const arHtml = read(arPath);
  if (!enHtml) failures.push(`${slug}: missing English article file`);
  if (!arHtml) failures.push(`${slug}: missing Arabic article file`);
  if (!enHtml || !arHtml) return;

  if (!entry.languages?.en?.path || entry.languages.en.path !== enPath) failures.push(`${slug}: registry English path mismatch`);
  if (!entry.languages?.ar?.path || entry.languages.ar.path !== arPath) failures.push(`${slug}: registry Arabic path mismatch`);
  if (!isIndexable(enHtml)) failures.push(`${enPath}: English published article is not indexable`);
  if (!isIndexable(arHtml)) failures.push(`${arPath}: Arabic published article is not indexable`);
  if (!/<html[^>]+lang="en"[^>]+dir="ltr"/i.test(enHtml)) failures.push(`${enPath}: missing English LTR html markers`);
  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(arHtml)) failures.push(`${arPath}: missing Arabic RTL html markers`);

  expect(enHtml, `<link rel="canonical" href="${SITE}/${enPath}"`, enPath, 'missing English canonical');
  expect(arHtml, `<link rel="canonical" href="${SITE}/${arPath}"`, arPath, 'missing Arabic canonical');
  expect(enHtml, `hreflang="ar" href="${SITE}/${arPath}"`, enPath, 'missing Arabic hreflang');
  expect(arHtml, `hreflang="en" href="${SITE}/${enPath}"`, arPath, 'missing English hreflang');
  expect(enHtml, `href="/ar/insights/${slug}.html"`, enPath, 'English language switch does not target Arabic counterpart');
  expect(arHtml, `href="/insights/${slug}.html"`, arPath, 'Arabic language switch does not target English counterpart');

  const enSections = count(enHtml, /<section\b/g);
  const arSections = count(arHtml, /<section\b/g);
  if (enSections !== arSections) failures.push(`${slug}: section count mismatch en=${enSections} ar=${arSections}`);
  const enH2 = count(enHtml, /<h2\b/g);
  const arH2 = count(arHtml, /<h2\b/g);
  if (enH2 < 5) failures.push(`${enPath}: expected at least 5 article H2 sections`);
  if (arH2 < 5) failures.push(`${arPath}: expected at least 5 Arabic article H2 sections`);
  const enFaq = count(enHtml, /<details\b/g);
  const arFaq = count(arHtml, /<details\b/g);
  if (enFaq !== arFaq || enFaq < 3) failures.push(`${slug}: FAQ count invalid en=${enFaq} ar=${arFaq}`);

  for (const marker of ['"Article"', '"FAQPage"', '"BreadcrumbList"']) {
    expect(enHtml, marker, enPath, `missing schema marker ${marker}`);
    expect(arHtml, marker, arPath, `missing schema marker ${marker}`);
  }

  const enVisible = stripNonVisible(enHtml);
  const arVisible = stripNonVisible(arHtml);
  if (/[\u0600-\u06FF]/.test(enVisible)) failures.push(`${enPath}: English article contains Arabic visible text`);
  if (!/[\u0600-\u06FF]/.test(arVisible)) failures.push(`${arPath}: Arabic article has no Arabic body text`);
  if (count(arHtml, /[\u0600-\u06FF]/g) < 900) failures.push(`${arPath}: Arabic body appears incomplete`);
  const arBodyMatch = arVisible.match(/\b(Executive Summary|Market Context|Frequently Asked Questions|Related Research|Read article|This article|investment advice|security recommendations|price targets)\b/i);
  if (arBodyMatch) {
    failures.push(`${arPath}: Arabic article contains untranslated English body/UI text — matched "${arBodyMatch[0]}"`);
  }
  const arMeta = `${entry.languages?.ar?.title || ''} ${entry.languages?.ar?.summary || ''}`;
  const arMetaMatch = arMeta.match(/\b(Interest Rate|Research|Market Context|Executive Summary|Growth Stocks| In )\b/i);
  if (arMetaMatch) {
    failures.push(`${arPath}: Arabic registry metadata contains untranslated English text — matched "${arMetaMatch[0]}" in title: "${(entry.languages?.ar?.title || '').slice(0, 120)}"`);
  }
  if (/placeholder|lorem ipsum/i.test(arVisible)) failures.push(`${arPath}: Arabic article contains placeholder wording`);
}

function checkIndexes(entries) {
  const enIndex = read('insights/index.html');
  const arIndex = read('ar/insights/index.html');
  if (!enIndex) failures.push('insights/index.html missing');
  if (!arIndex) failures.push('ar/insights/index.html missing');
  if (!enIndex || !arIndex) return;
  if (/href="\/ar\/insights\/[^"]+\.html"/i.test(enIndex)) failures.push('English insights index links to Arabic article URL');
  if (/href="(?:\/)?insights\/[^"]+\.html"/i.test(arIndex)) failures.push('Arabic insights index links to English article URL');
  for (const entry of entries) {
    const slug = entry.slug;
    if (!new RegExp(`href="(?:/)?insights/${escapeRegExp(slug)}\\.html"|href="${escapeRegExp(slug)}\\.html"`).test(enIndex)) {
      failures.push(`insights/index.html: missing English article link for ${slug}`);
    }
    if (!arIndex.includes(`href="/ar/insights/${slug}.html"`) && !arIndex.includes(`href="${slug}.html"`)) {
      failures.push(`ar/insights/index.html: missing Arabic article link for ${slug}`);
    }
  }
}

function checkSitemaps(entries) {
  const sitemap = `${read('sitemap.xml')}\n${read('sitemap-market.xml')}\n${read('sitemap-insights.xml')}`;
  const sitemapAr = read('sitemap-ar.xml');
  for (const entry of entries) {
    const enUrl = `${SITE}/insights/${entry.slug}.html`;
    const arUrl = `${SITE}/ar/insights/${entry.slug}.html`;
    if (!sitemap.includes(`<loc>${enUrl}</loc>`)) failures.push(`${entry.slug}: English URL missing from English sitemap set`);
    if (!sitemapAr.includes(`<loc>${arUrl}</loc>`)) failures.push(`${entry.slug}: Arabic URL missing from sitemap-ar.xml`);
  }
}

function sameSet(label, a, b) {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  for (const item of left) if (!right.includes(item)) failures.push(`${label}: ${item} missing from right side`);
  for (const item of right) if (!left.includes(item)) failures.push(`${label}: ${item} missing from left side`);
}

function articleFiles(relDir) {
  const dir = path.join(ROOT, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'index.html')
    .map((entry) => path.basename(entry.name, '.html'))
    .sort();
}

function isIndexable(html) {
  const robots = (String(html || '').match(/<meta\s+name="robots"\s+content="([^"]+)"/i) || [])[1] || '';
  return /index,follow/i.test(robots) && !/noindex/i.test(robots);
}

function expect(html, needle, rel, message) {
  if (!String(html || '').includes(needle)) failures.push(`${rel}: ${message}`);
}

function count(html, pattern) {
  return (String(html || '').match(pattern) || []).length;
}

function stripNonVisible(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function readJson(file, fallback) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) : fallback;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
