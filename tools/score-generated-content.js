'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slug = argValue('--slug');
const type = argValue('--type') || 'editorial';
const minScore = Number(argValue('--min-score') || 0);
const targetDir = type === 'market_outlook' ? 'drafts/market-outlook' : 'drafts/editorial';
const dirs = slug ? [path.join(ROOT, targetDir, slug)] : listDirs(path.join(ROOT, targetDir));
const results = [];

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const result = scoreDraft(dir);
  results.push(result);
}

if (!results.length) {
  console.log('No generated content drafts found for scoring.');
  process.exit(0);
}

console.log(JSON.stringify({ version: '1.0', scored_at: new Date().toISOString(), minimum_required_score: minScore || null, results }, null, 2));
if (minScore && results.some((result) => result.quality_score < minScore)) {
  console.error(`Generated content quality score below required threshold ${minScore}.`);
  process.exit(1);
}

function scoreDraft(dir) {
  const slugValue = path.basename(dir);
  const en = read(path.join(dir, 'en.html'));
  const ar = read(path.join(dir, 'ar.html'));
  const combined = `${strip(en)} ${strip(ar)}`;
  const checks = {
    originality: !hasExcessiveRepetition(combined),
    duplication_risk: !nearDuplicateTitle(slugValue, en),
    seo_completeness: has(en, '<title>') && has(en, 'meta name="description"') && has(en, 'rel="canonical"'),
    readability: wordCount(en) >= 250 || type === 'market_outlook',
    arabic_quality: /<html[^>]+lang="ar"[^>]+dir="rtl"/.test(ar) && /[\u0600-\u06ff]/.test(ar) && !/[\uFFFD]|\?{3,}/.test(ar),
    schema_completeness: has(en, 'application/ld+json') && has(ar, 'application/ld+json'),
    hallucination_risk: !/(according to unnamed sources|rumored data|fabricated|made-up)/i.test(combined),
    educational_compliance: !/(buy now|sell now|guaranteed returns?|must buy|must sell)/i.test(combined),
    disclaimer_presence: /(Educational disclaimer|educational-disclaimer|تنبيه تعليمي|إخلاء المسؤولية التعليمي|educational market commentary|تعليق تعليمي)/.test(`${en} ${ar}`)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const quality_score = Math.round((passed / Object.keys(checks).length) * 100);
  return {
    slug: slugValue,
    type,
    checks,
    quality_score,
    publish_recommendation: quality_score >= 85 ? 'eligible_after_human_review' : 'manual_revision_required'
  };
}

function nearDuplicateTitle(slugValue, html) {
  const title = ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || slugValue).toLowerCase();
  return title.split(/\s+/).length < 4;
}

function hasExcessiveRepetition(text) {
  const words = text.toLowerCase().split(/\s+/).filter((word) => word.length > 4);
  const counts = new Map();
  for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  return [...counts.values()].some((count) => count > 30);
}

function listDirs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(dir, entry.name));
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

function has(value, part) {
  return String(value || '').includes(part);
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function wordCount(html) {
  return strip(html).split(/\s+/).filter(Boolean).length;
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
