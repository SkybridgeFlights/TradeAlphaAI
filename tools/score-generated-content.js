'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slug = argValue('--slug');
const type = argValue('--type') || 'editorial';
const minScore = Number(argValue('--min-score') || 0);
const targetDir = type === 'market_outlook' ? 'drafts/market-outlook' : 'drafts/editorial';
const dirs = slug ? [path.join(ROOT, targetDir, slug)] : listDirs(path.join(ROOT, targetDir));
const results = dirs.filter(fs.existsSync).map(scoreDraft);

if (!results.length) {
  console.log('No generated content drafts found for scoring.');
  process.exit(0);
}

const report = { version: '2.0', scored_at: new Date().toISOString(), minimum_required_score: minScore || null, results };
console.log(JSON.stringify(report, null, 2));

if (minScore && results.some((result) => result.quality_score < minScore || result.publish_recommendation !== 'eligible_after_human_review')) {
  console.error(`Generated content quality score below required threshold ${minScore}, or a hard-gate check failed.`);
  process.exit(1);
}

function scoreDraft(dir) {
  const slugValue = path.basename(dir);
  const en = read(path.join(dir, 'en.html'));
  const ar = read(path.join(dir, 'ar.html'));
  const enBody = bodyText(en);
  const arBody = bodyText(ar);
  const combined = `${enBody} ${arBody}`;
  const checks = {
    originality: !hasExcessiveRepetition(combined),
    duplication_risk: !nearDuplicateTitle(slugValue, en),
    seo_completeness: has(en, '<title>') && has(en, 'meta name="description"') && has(en, 'rel="canonical"'),
    readability: wordCount(enBody) >= 250 || type === 'market_outlook',
    arabic_quality: /<html[^>]+lang="ar"[^>]+dir="rtl"/.test(ar) && /[\u0600-\u06ff]/.test(arBody) && !hasMojibake(ar),
    schema_completeness: has(en, 'application/ld+json') && has(ar, 'application/ld+json'),
    hallucination_risk: !/(according to unnamed sources|rumored data|fabricated|made-up|fake catalyst)/i.test(combined),
    educational_compliance: !/(buy now|sell now|guaranteed returns?|must buy|must sell|certain to|definitely will)/i.test(combined),
    disclaimer_presence: /(Educational Disclaimer|educational-disclaimer|إخلاء المسؤولية التعليمي|تعليق تعليمي حول الأسواق المالية)/.test(`${en} ${ar}`)
  };

  if (type === 'market_outlook') {
    Object.assign(checks, marketOutlookChecks(en, ar, enBody, arBody, combined));
  }

  const passed = Object.values(checks).filter(Boolean).length;
  const quality_score = Math.round((passed / Object.keys(checks).length) * 100);
  const hardGatePass = type !== 'market_outlook' || (
    checks.language_purity &&
    checks.public_placeholder_risk &&
    checks.semantic_depth &&
    checks.layout_quality
  );
  return {
    slug: slugValue,
    type,
    checks,
    quality_score,
    publish_recommendation: hardGatePass && quality_score >= (type === 'market_outlook' ? 90 : 85)
      ? 'eligible_after_human_review'
      : 'manual_revision_required'
  };
}

function marketOutlookChecks(en, ar, enBody, arBody, combined) {
  const banned = [
    'data is not currently sourced',
    'not currently sourced',
    'educational context:',
    'analysis uses structural context only',
    'editors should verify',
    'framework derived from',
    'placeholder',
    'todo',
    'tbd',
    'lorem ipsum'
  ];
  const lower = combined.toLowerCase();
  const uniqueWords = new Set(enBody.toLowerCase().split(/\s+/).filter((word) => word.length > 4));
  const requiredSections = ['market-narrative', 'volatility-context', 'key-drivers', 'scenario-outlook', 'risk-factors', 'watch-next', 'related-research'];
  return {
    semantic_depth: uniqueWords.size >= 55,
    language_purity: englishPurity(enBody) && arabicPurity(ar, arBody),
    human_readability: averageSentenceLength(enBody) >= 8 && averageSentenceLength(enBody) <= 34,
    template_repetition_risk: !hasRepeatedParagraphs(en),
    public_placeholder_risk: !banned.some((phrase) => lower.includes(phrase)),
    market_context_quality: /(policy|inflation|earnings|volatility|sector|ETF|risk|liquidity|rates|Federal Reserve)/i.test(enBody),
    layout_quality: requiredSections.every((id) => en.includes(`id="${id}"`) && ar.includes(`id="${id}"`))
  };
}

function englishPurity(text) {
  const arabicCount = (text.match(/[\u0600-\u06ff]/g) || []).length;
  return arabicCount / Math.max(text.replace(/\s/g, '').length, 1) < 0.03;
}

function arabicPurity(html, text) {
  if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) return false;
  if (hasMojibake(html)) return false;
  const cleaned = text
    .replace(/\b(TradeAlphaAI|VIX|NASDAQ|S&P|ETF|CPI|NFP|PCE|FOMC|GDP|DXY|AI|USD)\b/gi, ' ')
    .replace(/\b[A-Z]{1,6}\b/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\d.,:%-]+/g, ' ');
  return !/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){4,}/.test(cleaned);
}

function hasMojibake(value) {
  return /[\uFFFD]|\?{3,}|[\u00d8\u00d9\u00c3]/.test(String(value || ''));
}

function hasRepeatedParagraphs(html) {
  const paragraphs = [...String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => bodyText(match[1]).toLowerCase())
    .filter((text) => text.length > 40);
  const seen = new Set();
  for (const paragraph of paragraphs) {
    if (seen.has(paragraph)) return true;
    seen.add(paragraph);
  }
  return false;
}

function nearDuplicateTitle(slugValue, html) {
  const title = bodyText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || slugValue);
  return title.split(/\s+/).filter(Boolean).length < 4;
}

function hasExcessiveRepetition(text) {
  const counts = new Map();
  for (const word of String(text || '').toLowerCase().split(/\s+/).filter((item) => item.length > 4)) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.values()].some((count) => count > 30);
}

function averageSentenceLength(text) {
  const sentences = String(text || '').split(/[.!?؟]+/).map((item) => item.trim()).filter(Boolean);
  if (!sentences.length) return 0;
  return wordCount(text) / sentences.length;
}

function bodyText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
