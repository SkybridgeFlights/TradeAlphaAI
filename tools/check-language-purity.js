'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const BANNED_PHRASES = [
  'data is not currently sourced',
  'not currently sourced',
  'educational context:',
  'analysis uses structural context only',
  'editors should verify',
  'framework derived from',
  'placeholder',
  'TODO',
  'TBD',
  'lorem ipsum'
];
const ALLOWED_EN_IN_AR = [
  'TradeAlphaAI',
  'VIX',
  'NASDAQ',
  'S&P',
  'ETF',
  'CPI',
  'NFP',
  'PCE',
  'FOMC',
  'GDP',
  'DXY',
  'AI',
  'USD',
  'URL',
  'HTML'
];

scanDrafts();
scanDir(path.join(ROOT, 'market-outlook'), 'en');
scanDir(path.join(ROOT, 'en', 'market-outlook'), 'en');
scanDir(path.join(ROOT, 'ar', 'market-outlook'), 'ar');

if (failures.length) {
  console.error(`Language purity check FAILED (${failures.length} violation${failures.length === 1 ? '' : 's'}):`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Language purity check passed. Scanned EN and AR market-outlook pages.');

function scanDrafts() {
  const dir = path.join(ROOT, 'drafts', 'market-outlook');
  if (!fs.existsSync(dir)) return;
  for (const slug of fs.readdirSync(dir)) {
    const slugDir = path.join(dir, slug);
    if (!fs.statSync(slugDir).isDirectory()) continue;
    for (const [file, locale] of [['en.html', 'en'], ['ar.html', 'ar']]) {
      const full = path.join(slugDir, file);
      if (fs.existsSync(full)) checkFile(full, locale);
    }
  }
}

function scanDir(dir, locale) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    checkFile(path.join(dir, name), locale);
  }
}

function checkFile(file, locale) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const html = fs.readFileSync(file, 'utf8');
  const body = visibleBody(html);
  const lower = body.toLowerCase();

  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) failures.push(`${rel}: banned placeholder phrase found: "${phrase}"`);
  }

  if (/[\uFFFD]/.test(html) || /[\u00d8\u00d9\u00c3]/.test(html)) failures.push(`${rel}: mojibake or replacement character found`);

  if (locale === 'en') {
    const arabicCount = (body.match(/[\u0600-\u06ff]/g) || []).length;
    const ratio = arabicCount / Math.max(body.replace(/\s/g, '').length, 1);
    if (ratio > 0.03) failures.push(`${rel}: EN page contains Arabic visible body text (${(ratio * 100).toFixed(1)}%)`);
  }

  if (locale === 'ar') {
    if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(html)) failures.push(`${rel}: Arabic page missing lang=ar dir=rtl`);
    const cleaned = stripAllowedEnglish(body);
    if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){4,}/.test(cleaned)) failures.push(`${rel}: AR page contains full English sentence in visible body`);
  }
}

function visibleBody(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripAllowedEnglish(text) {
  let output = String(text || '');
  for (const term of ALLOWED_EN_IN_AR) {
    output = output.replace(new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi'), ' ');
  }
  return output
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[A-Z]{1,6}\b/g, ' ')
    .replace(/[\d.,:%-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
