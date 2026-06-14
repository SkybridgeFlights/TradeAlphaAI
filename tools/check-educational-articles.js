'use strict';

// Phase 96 validation — /articles/ surface + Educational Brain integrity.
// Section: bilingual /articles/ pages, canonical header markers + CSS,
// breadcrumb, sitemap presence, distinct identity (institutional structure,
// not /insights/), disclaimer. HARD FAIL on beginner-finance, listicle,
// SEO-spam/clickbait, motivational-finance, or advice language.
// Topic engine: anti-repetition integrity (coverage floor, cooldown), no
// duplicate eligible families, bilingual titles.

const fs = require('fs');
const path = require('path');
const { MAX_ELIGIBLE } = require('./build-educational-topics');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } }
function readJson(rel) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; } }

// Forbidden retail/SEO-spam patterns in the institutional research surface.
const BEGINNER = /\b(what is an? (etf|stock|inflation|bond)|beginner'?s? guide|beginner investing guide|investing for beginners|easy investing|how to (get rich|start investing)|investing 101|explained for beginners)\b/i;
const LISTICLE = /\b(top \d+|\d+ (best|reasons|ways|tips|stocks to))\b/i;
const HYPE = /\b(get rich|make money fast|guaranteed returns?|millionaire|huge gains|you won'?t believe|secret to)\b/i;
const SEO_SPAM = /\b(ultimate guide|complete guide|must[- ]read|game[- ]changer|unlock (the )?secret|everything you need to know)\b/i;
const ADVICE = /\b(buy now|sell now|you should (buy|sell)|price target|will (rally|crash|soar|plunge))\b/i;

function institutionalLanguageFailures(body, label) {
  const found = [];
  if (BEGINNER.test(body)) found.push(`${label}: beginner-finance language detected`);
  if (LISTICLE.test(body)) found.push(`${label}: listicle structure detected`);
  if (HYPE.test(body)) found.push(`${label}: motivational/SEO-hype language detected`);
  if (SEO_SPAM.test(body)) found.push(`${label}: generic SEO-hype language detected`);
  if (ADVICE.test(body)) found.push(`${label}: advice/trading language detected`);
  return found;
}

const negativeFixture = process.argv.find((arg) => arg.startsWith('--negative-fixture='));
if (negativeFixture) {
  const fixtures = {
    beginner: '<main><h1>Beginner investing guide</h1></main>',
    listicle: '<main><h1>Top 10 market ideas</h1></main>',
    retail: '<main><p>Easy investing can help you get rich. Buy now.</p></main>',
    seo: '<main><h1>The ultimate guide: everything you need to know</h1></main>',
  };
  const key = negativeFixture.split('=')[1];
  const fixture = fixtures[key];
  if (!fixture) {
    console.error(`[educational-articles] Unknown negative fixture: ${key}`);
    process.exit(2);
  }
  const fixtureFailures = institutionalLanguageFailures(fixture, `negative-fixture:${key}`);
  if (fixtureFailures.length) {
    fixtureFailures.forEach((failure) => console.error(`[educational-articles] FAIL: ${failure}`));
    process.exit(1);
  }
  console.error(`[educational-articles] FAIL: negative fixture "${key}" was not rejected`);
  process.exit(0);
}

const PAGES = [
  { rel: 'articles/index.html', lang: 'en', canonical: 'https://www.tradealphaai.com/articles/' },
  { rel: 'ar/articles/index.html', lang: 'ar', canonical: 'https://www.tradealphaai.com/ar/articles/' },
];

for (const page of PAGES) {
  const html = read(page.rel);
  if (!html) { failures.push(`${page.rel}: missing`); continue; }
  if (!html.includes('GLOBAL_HEADER_START') || !html.includes('GLOBAL_HEADER_END')) failures.push(`${page.rel}: header markers missing`);
  if (!html.includes('/css/global-header-canonical.css')) failures.push(`${page.rel}: canonical header CSS missing`);
  if (!new RegExp(`<html lang="${page.lang}"`).test(html)) failures.push(`${page.rel}: wrong lang`);
  if (page.lang === 'ar' && !html.includes('dir="rtl"')) failures.push(`${page.rel}: AR missing dir=rtl`);
  if (!html.includes(`<link rel="canonical" href="${page.canonical}"`)) failures.push(`${page.rel}: canonical link wrong/missing`);
  if (!html.includes('class="breadcrumb"')) failures.push(`${page.rel}: breadcrumb missing`);
  if (!html.includes('research-program')) failures.push(`${page.rel}: research program section missing (identity)`);
  if (!html.includes('articles-distinction')) failures.push(`${page.rel}: missing /insights/ distinction (section confusion risk)`);
  if (page.lang === 'ar' && !/[؀-ۿ]/.test(html)) failures.push(`${page.rel}: AR has no Arabic`);
  if (/Market Outlook Research \| Macro/.test(html)) failures.push(`${page.rel}: carries market-outlook identity`);
  // Scan only the article <main> body — never the cloned global-header nav
  // (which legitimately contains rankings links like "Top 10 Stocks").
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const body = (mainMatch ? mainMatch[0] : html).replace(/<script[\s\S]*?<\/script>/gi, ' ');
  failures.push(...institutionalLanguageFailures(body, page.rel));
  if (!/not investment advice|ليست نصيحة استثمارية/.test(html)) failures.push(`${page.rel}: disclaimer missing`);
}

const coreSitemap = read('sitemap-core.xml') || '';
const arSitemap = read('sitemap-ar.xml') || '';
if (!coreSitemap.includes('https://www.tradealphaai.com/articles/')) failures.push('sitemap-core.xml: /articles/ missing');
if (!arSitemap.includes('https://www.tradealphaai.com/ar/articles/')) failures.push('sitemap-ar.xml: /ar/articles/ missing');

// Topic engine integrity.
const topics = readJson('data/intelligence/educational-topics.json');
if (!topics) {
  failures.push('data/intelligence/educational-topics.json: missing or invalid');
} else {
  const eligible = topics.eligible || [];
  if (topics.scope !== 'institutional-market-structure-education') failures.push('educational-topics: scope is not institutional market-structure education');
  if (topics.distinct_from !== '/insights/ (applied ETF/sector/stock research)') failures.push('educational-topics: /articles/ and /insights/ distinction is missing');
  if (topics.policy?.supervised_publish !== true) failures.push('educational-topics: supervised publishing gate must remain enabled');
  if (!Array.isArray(topics.history)) failures.push('educational-topics: anti-repetition history is missing');
  if (topics.anti_repetition?.cooldown_days < 7) failures.push('educational-topics: cooldown is too short');
  if (topics.anti_repetition?.coverage_floor !== 0.5) failures.push('educational-topics: coverage floor must remain 0.5');
  if (eligible.length > MAX_ELIGIBLE) failures.push(`educational-topics: ${eligible.length} eligible exceeds cap ${MAX_ELIGIBLE}`);
  const ids = new Set();
  for (const e of eligible) {
    if (!e.title_en || !e.title_ar || !/[؀-ۿ]/.test(e.title_ar)) failures.push(`educational-topics: ${e.id} missing bilingual title`);
    if (e.coverage_score >= 0.5) failures.push(`educational-topics: ${e.id} eligible despite coverage ${e.coverage_score} (anti-repetition breach)`);
    if (e.on_cooldown) failures.push(`educational-topics: ${e.id} eligible while on cooldown`);
    if (ids.has(e.id)) failures.push(`educational-topics: duplicate eligible family ${e.id}`);
    ids.add(e.id);
    // No beginner/listicle topic titles.
    failures.push(...institutionalLanguageFailures(e.title_en, `educational-topics:${e.id}`));
  }
  console.log(`[educational-articles] topic engine ok (eligible=${eligible.length}/${(topics.candidates || []).length})`);
}

const publishedEn = fs.existsSync(path.join(ROOT, 'articles'))
  ? fs.readdirSync(path.join(ROOT, 'articles')).filter((file) => file.endsWith('.html') && file !== 'index.html' && (read(`articles/${file}`) || '').includes('data-educational-article='))
  : [];
// Phase 118 — autonomous Educational Intelligence Engine: the prior single-
// publication supervised gate is replaced by a corpus-bounded guard. The engine
// publishes one concept per run with topic-engine cooldown + near-duplicate
// checks; it can never publish more distinct articles than concepts exist, so a
// count beyond the candidate corpus signals runaway/duplicate spam.
const educationalCorpusCap = (topics.candidates || []).length || 30;
if (publishedEn.length > educationalCorpusCap) failures.push(`educational articles: ${publishedEn.length} published exceeds concept corpus ${educationalCorpusCap} (runaway/duplicate spam)`);
for (const file of publishedEn) {
  const slug = file.replace(/\.html$/, '');
  const en = read(`articles/${file}`) || '';
  const ar = read(`ar/articles/${file}`) || '';
  if (!ar) failures.push(`ar/articles/${file}: bilingual counterpart missing`);
  if (!en.includes(`https://www.tradealphaai.com/articles/${file}`)) failures.push(`articles/${file}: canonical URL missing`);
  if (!ar.includes(`https://www.tradealphaai.com/ar/articles/${file}`)) failures.push(`ar/articles/${file}: canonical URL missing`);
  if (!en.includes('data-editorial-intelligence="v2"') || !ar.includes('data-editorial-intelligence="v2"')) failures.push(`${slug}: institutional reasoning contract missing`);
  if ((en.match(/<section\b/g) || []).length < 9 || (ar.match(/<section\b/g) || []).length < 9) failures.push(`${slug}: insufficient bilingual structural depth`);
  if ((en.match(/<p\b/g) || []).length < 18 || (ar.match(/<p\b/g) || []).length < 18) failures.push(`${slug}: insufficient bilingual paragraph depth`);
  const enMain = (en.match(/<main[\s\S]*?<\/main>/i) || [''])[0];
  const arMain = (ar.match(/<main[\s\S]*?<\/main>/i) || [''])[0];
  failures.push(...institutionalLanguageFailures(enMain, `articles/${file}`));
  failures.push(...institutionalLanguageFailures(arMain, `ar/articles/${file}`));
  if (!(read('articles/index.html') || '').includes(`/articles/${file}`)) failures.push(`articles/index.html: ${file} not linked`);
  if (!(read('ar/articles/index.html') || '').includes(`/ar/articles/${file}`)) failures.push(`ar/articles/index.html: ${file} not linked`);
  if (!coreSitemap.includes(`https://www.tradealphaai.com/articles/${file}`)) failures.push(`sitemap-core.xml: ${file} missing`);
  if (!arSitemap.includes(`https://www.tradealphaai.com/ar/articles/${file}`)) failures.push(`sitemap-ar.xml: ${file} missing`);
  if (fs.existsSync(path.join(ROOT, 'insights', file)) || fs.existsSync(path.join(ROOT, 'ar', 'insights', file))) failures.push(`${slug}: duplicate exists under /insights/`);
  const history = topics?.history || [];
  // Phase 118 — a publication record must exist (supervised OR autonomous).
  if (!history.some((item) => item.slug === slug && item.status === 'published')) failures.push(`${slug}: publication history record missing`);
  if ((topics?.eligible || []).some((item) => item.id === slug)) failures.push(`${slug}: published concept remains eligible despite cooldown`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[educational-articles] FAIL: ${f}`));
  process.exit(1);
}
console.log('[educational-articles] check:educational-articles passed.');
