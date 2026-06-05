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
    checks.layout_quality &&
    checks.has_directional_bias &&
    checks.has_scenarios &&
    checks.specificity &&
    checks.no_generic_filler
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
    layout_quality: requiredSections.every((id) => en.includes(`id="${id}"`) && ar.includes(`id="${id}"`)),
    has_directional_bias: /(cautiously bullish|cautiously bearish|neutral|mixed|elevated uncertainty|directional bias|الميل الاتجاهي|صاعد بحذر|هابط بحذر|محايد)/i.test(combined),
    has_scenarios: /(bullish scenario|bearish scenario|السيناريو الصاعد|السيناريو الهابط)/i.test(combined),
    specificity: checkSpecificity(enBody),
    no_generic_filler: checkNoGenericFiller(enBody),
  };
}

function checkSpecificity(enBody) {
  // Named instrument patterns (ETFs, tickers, specific rates)
  const INSTRUMENTS = [
    /\b(TLT|IEF|SHY|AGG|BND|LQD|HYG|TIP|TIPS|SCHP|ZROZ|EDV)\b/,
    /\b(QQQ|SPY|IWM|DIA|VOO|VTI|RSP|SPLG)\b/,
    /\b(SMH|SOXX|SOXL|XSD|NVDA|AMD|TSMC|TSM|ASML|INTC|QCOM)\b/,
    /\b(XLK|XLF|XLE|XLU|XLV|XLI|XLRE|XLP|XLB|XLY|XLC)\b/,
    /\b(MSFT|GOOGL|GOOG|META|AAPL|AMZN|TSLA|JPM|BAC|GS|MS)\b/,
    /\b(GLD|SLV|GDX|USO|DBA)\b/,
    /\b\d+[- ]?[Yy](ear)?\s*(Treasury|yield|note|bond)\b/i,
    /\b(Fed\s+funds|federal\s+funds|FOMC\s+rate)\b/i,
    /\b(yield\s+curve|2Y10Y|10Y2Y|inverted\s+curve|duration\s+risk|duration.sensitive)\b/i,
    /\b(VIX|CBOE\s+volatility)\b/i,
    /\b(DXY|dollar\s+index)\b/i,
  ];
  // Macro-analytical language patterns (institutional specificity without ticker names)
  const MACRO_ANALYSIS = [
    /\b(yield spread|basis point|curve steepen|curve flatten|curve normaliz|curve inversion)\b/i,
    /\b(breadth|participation|concentration risk|equal.weight|cap.weight|narrow leadership)\b/i,
    /\b(positioning|factor tilt|real yield|repricing|risk premium|net interest margin)\b/i,
    /\b(implied vol|vol regime|volatility regime|vol compression|vol expansion|hedging demand)\b/i,
    /\b(liquidity|risk appetite|credit spread|monetary transmission|rate.sensitive|terminal rate)\b/i,
    /\b(sector rotation|defensive rotation|growth.value|cross.asset|macro hedge|macro transmission)\b/i,
    /\b(transmission mechanism|transmission chain|policy path|rate path|monetary policy)\b/i,
  ];
  const instrHits = INSTRUMENTS.filter(p => p.test(enBody)).length;
  const macroHits = MACRO_ANALYSIS.filter(p => p.test(enBody)).length;
  // Pass if: ≥2 instrument patterns, OR ≥1 instrument + ≥2 macro patterns, OR ≥4 macro patterns (pure macro analysis)
  return instrHits >= 2 || (instrHits >= 1 && macroHits >= 2) || macroHits >= 4;
}

function checkNoGenericFiller(enBody) {
  const FILLER = [
    'various macroeconomic factors',
    'navigating a complex landscape',
    'market participants are closely monitoring',
    'it remains to be seen',
    'dynamic market landscape',
    'complex macro environment',
    'economic conditions can change',
    'broadly speaking',
    'at the end of the day',
  ];
  const lower = enBody.toLowerCase();
  return !FILLER.some(phrase => lower.includes(phrase));
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
  // Exclude intentionally-repeated legal/disclaimer text
  const ALLOWED_REPEATS = [
    'this analysis is educational market commentary',
    'هذا التحليل عبارة عن تعليق'
  ];
  const paragraphs = [...String(html || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => bodyText(match[1]).toLowerCase())
    .filter((text) => text.length > 40)
    .filter((text) => !ALLOWED_REPEATS.some(d => text.includes(d)));
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
