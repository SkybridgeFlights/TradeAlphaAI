'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const failures = [];
const files = collectArabicMarketOutlookFiles();
const knownEnglishTitles = loadKnownEnglishTitles();
const prohibitedPhrases = [
  'AI Inference vs Training',
  'Understanding the Two Phases',
];
const allowedEnglishTokens = [
  'TradeAlphaAI', 'TradeAlpha', 'AI', 'ETF', 'ETFs', 'GDP', 'CPI', 'PCE',
  'NFP', 'FOMC', 'VIX', 'DXY', 'USD', 'GPU', 'NASDAQ', 'English',
];

for (const file of files) validateFile(file);

if (failures.length) {
  console.error(`Market outlook localization check FAILED (${failures.length} violation${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Market outlook localization check passed. Scanned ${files.length} Arabic draft/public page(s).`);

function collectArabicMarketOutlookFiles() {
  const found = [];
  const drafts = path.join(ROOT, 'drafts', 'market-outlook');
  if (fs.existsSync(drafts)) {
    for (const slug of fs.readdirSync(drafts)) {
      const file = path.join(drafts, slug, 'ar.html');
      if (fs.existsSync(file)) found.push(file);
    }
  }

  const publicDir = path.join(ROOT, 'ar', 'market-outlook');
  if (fs.existsSync(publicDir)) {
    for (const name of fs.readdirSync(publicDir)) {
      if (name.endsWith('.html')) found.push(path.join(publicDir, name));
    }
  }
  return found;
}

function loadKnownEnglishTitles() {
  try {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    return (registry.articles || [])
      .map((article) => article.languages?.en?.title || '')
      .map((title) => title.replace(/\s*\|\s*TradeAlphaAI\s*$/i, '').trim())
      .filter((title) => title.length >= 20 && title.split(/\s+/).length >= 4);
  } catch {
    return [];
  }
}

function validateFile(file) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const html = fs.readFileSync(file, 'utf8');
  const body = visibleBody(html);

  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(html)) {
    failures.push(`${rel}: missing lang="ar" dir="rtl"`);
  }

  for (const phrase of prohibitedPhrases) {
    if (html.toLowerCase().includes(phrase.toLowerCase())) {
      failures.push(`${rel}: prohibited English phrase found: "${phrase}"`);
    }
  }

  for (const title of knownEnglishTitles) {
    if (body.toLowerCase().includes(title.toLowerCase())) {
      failures.push(`${rel}: English article title found: "${title}"`);
    }
  }

  const normalized = stripAllowedTokens(body);
  const englishRun = normalized.match(/\b[A-Za-z]{2,}(?:[\s:–—-]+[A-Za-z]{2,}){3,}\b/);
  if (englishRun) {
    failures.push(`${rel}: more than 3 consecutive English words: "${englishRun[0].slice(0, 120)}"`);
  }
}

function visibleBody(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAllowedTokens(text) {
  let output = String(text || '');
  for (const token of allowedEnglishTokens) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(token)}\\b`, 'gi'), ' ');
  }
  return output
    .replace(/\b[A-Z]{1,6}\b/g, ' ')
    .replace(/[\d.,:%]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
