'use strict';

/**
 * test-market-intelligence-quality-gates.js
 *
 * Regression tests ensuring market-outlook generated HTML never exceeds
 * ticker mention limits or disclaimer phrase limits.
 *
 * Mirrors the exact detection logic in check-market-intelligence-quality.js
 * (TICKER_MAX=5, EN_DISCLAIMER_MAX=3, AR_DISCLAIMER_MAX=3).
 */

const { suppressExcessTickersInHtml, TICKER_BODY_MAX } = require('./market-outlook-post-processor');

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ── Helpers matching check-market-intelligence-quality.js exactly ────────────

const EN_DISCLAIMER_MAX = 3;
const AR_DISCLAIMER_MAX = 3;

const EN_DISCLAIMER_PATTERNS = [
  /not financial advice/gi,
  /not investment advice/gi,
  /educational[^.]{0,40}only/gi,
  /not a recommendation to buy or sell/gi,
  /market conditions can change/gi,
];
const AR_DISCLAIMER_PATTERNS = [
  /ليست? توصية/gi,
  /تعليمي فقط/gi,
  /للتعليم والتوعية/gi,
  /ليست? نصيحة/gi,
  /لا يُعتبر نصيحة/gi,
  /هذا التحليل عبارة عن تعليق تعليمي/gi,
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function countTicker(html, ticker) {
  const text = stripHtml(html);
  return (text.match(new RegExp(`\\b${ticker}\\b`, 'g')) || []).length;
}

function countEnDisclaimers(html) {
  const text = stripHtml(html);
  let n = 0;
  for (const p of EN_DISCLAIMER_PATTERNS) n += (text.match(p) || []).length;
  return n;
}

function countArDisclaimers(html) {
  const text = stripHtml(html);
  let n = 0;
  for (const p of AR_DISCLAIMER_PATTERNS) n += (text.match(p) || []).length;
  return n;
}

// ── Fixture builders ─────────────────────────────────────────────────────────

const DISCLAIMER_EN = 'This analysis is educational market commentary only. It is not investment advice, financial advice, or a recommendation to buy or sell any asset. Market conditions can change rapidly and uncertainty remains present.';
const DISCLAIMER_AR = 'هذا التحليل عبارة عن تعليق تعليمي حول الأسواق المالية فقط، ولا يُعتبر نصيحة استثمارية أو مالية أو توصية شراء أو بيع لأي أصل مالي. قد تتغير ظروف السوق بسرعة وتبقى حالة عدم اليقين قائمة.';

function makeEnFixture(nvdaCount, qqqCount, disclaimerBlockCount) {
  const nvdaBlock = Array(nvdaCount).fill('<p class="market-copy">NVDA leads GPU demand this quarter.</p>').join('\n');
  const qqqBlock  = Array(qqqCount).fill('<p class="market-copy">QQQ tracks technology sector performance.</p>').join('\n');
  const discBlock = Array(disclaimerBlockCount)
    .fill(`<p class="market-copy educational-disclaimer">${DISCLAIMER_EN}</p>`).join('\n');
  return `<!doctype html><html lang="en"><head>
    <script type="application/ld+json">{"@type":"Article","headline":"Test"}</script>
  </head><body>
    <section id="disclaimer-block">${discBlock}</section>
    <section id="market-narrative">${nvdaBlock}</section>
    <section id="risk-factors">${qqqBlock}</section>
  </body></html>`;
}

function makeArFixture(nvdaCount, qqqCount, disclaimerBlockCount) {
  const nvdaBlock = Array(nvdaCount).fill('<p class="market-copy">NVDA يقود الطلب على وحدات معالجة الرسوميات.</p>').join('\n');
  const qqqBlock  = Array(qqqCount).fill('<p class="market-copy">QQQ يتتبع أداء القطاع التقني.</p>').join('\n');
  const discBlock = Array(disclaimerBlockCount)
    .fill(`<p class="market-copy educational-disclaimer">${DISCLAIMER_AR}</p>`).join('\n');
  return `<!doctype html><html lang="ar"><head>
    <script type="application/ld+json">{"@type":"Article","headline":"اختبار"}</script>
  </head><body>
    <section id="disclaimer-block">${discBlock}</section>
    <section id="market-narrative">${nvdaBlock}</section>
    <section id="risk-factors">${qqqBlock}</section>
  </body></html>`;
}

// ── 1. Content within limit passes unchanged ─────────────────────────────────

console.log('\n[test] 1. Ticker suppressor — content within limit passes unchanged');

const okEn = makeEnFixture(5, 4, 1);
const processedOkEn = suppressExcessTickersInHtml(okEn, 'en');
assert('NVDA at limit (5) — body count unchanged',  countTicker(processedOkEn, 'NVDA') === 5);
assert('QQQ below limit (4) — body count unchanged', countTicker(processedOkEn, 'QQQ')  === 4);

// ── 2. EN excess mentions are capped ────────────────────────────────────────

console.log('\n[test] 2. Ticker suppressor — EN excess NVDA+QQQ capped to 5');

const overEn = makeEnFixture(8, 7, 1);
const processedOverEn = suppressExcessTickersInHtml(overEn, 'en');
const nvdaAfter = countTicker(processedOverEn, 'NVDA');
const qqqAfter  = countTicker(processedOverEn, 'QQQ');
assert(`NVDA capped to ≤5 (was 8, got ${nvdaAfter})`,  nvdaAfter <= TICKER_BODY_MAX);
assert(`QQQ capped to ≤5 (was 7, got ${qqqAfter})`,   qqqAfter  <= TICKER_BODY_MAX);
assert('EN NVDA generic replacement present',
  processedOverEn.includes('large AI infrastructure names') ||
  processedOverEn.includes('AI-linked semiconductor leaders') ||
  processedOverEn.includes('leading AI chip designers'));
assert('EN QQQ generic replacement present',
  processedOverEn.includes('broad technology indices') ||
  processedOverEn.includes('tech-heavy index exposure') ||
  processedOverEn.includes('large-cap tech benchmarks'));

// ── 3. AR excess mentions are capped ────────────────────────────────────────

console.log('\n[test] 3. Ticker suppressor — AR excess NVDA+QQQ capped to 5');

const overAr = makeArFixture(8, 7, 1);
const processedOverAr = suppressExcessTickersInHtml(overAr, 'ar');
const nvdaArAfter = countTicker(processedOverAr, 'NVDA');
const qqqArAfter  = countTicker(processedOverAr, 'QQQ');
assert(`AR NVDA capped to ≤5 (was 8, got ${nvdaArAfter})`,  nvdaArAfter <= TICKER_BODY_MAX);
assert(`AR QQQ capped to ≤5 (was 7, got ${qqqArAfter})`,   qqqArAfter  <= TICKER_BODY_MAX);
assert('AR NVDA generic replacement present',
  processedOverAr.includes('الأسماء الكبرى للبنية التحتية للذكاء الاصطناعي') ||
  processedOverAr.includes('رواد أشباه الموصلات المرتبطة بالذكاء الاصطناعي'));
assert('AR QQQ generic replacement present',
  processedOverAr.includes('مؤشرات التقنية الواسعة') ||
  processedOverAr.includes('مؤشرات التقنية الكبرى'));

// ── 4. Script-block tickers are not counted toward the limit ─────────────────

console.log('\n[test] 4. Ticker suppressor — tickers inside <script> blocks are not counted');

const scriptHtml = `<html><head>
  <script type="application/ld+json">{"about":["NVDA","NVDA","NVDA","NVDA","NVDA","NVDA"]}</script>
</head><body>
  <p>NVDA leads AI chip demand.</p>
  <p>NVDA revenue grew this quarter.</p>
  <p>NVDA performance was strong.</p>
</body></html>`;
const processedScript = suppressExcessTickersInHtml(scriptHtml, 'en');
const nvdaBodyAfter = countTicker(processedScript, 'NVDA');
assert(`Script-block tickers excluded — body count ${nvdaBodyAfter} ≤ 5`, nvdaBodyAfter <= TICKER_BODY_MAX);

// ── 5. Supressor is idempotent ────────────────────────────────────────────────

console.log('\n[test] 5. Ticker suppressor — idempotent (running twice gives same result)');

const run1 = suppressExcessTickersInHtml(overEn, 'en');
const run2 = suppressExcessTickersInHtml(run1,   'en');
assert('Suppressor is idempotent (run twice = run once)', run1 === run2);

// ── 6. EN disclaimer — single block is within limit ──────────────────────────

console.log('\n[test] 6. Disclaimer gate — single EN block is within limit');

const singleDiscEn = makeEnFixture(1, 1, 1);
const enDiscCount = countEnDisclaimers(singleDiscEn);
assert(`Single EN disclaimer block has ${enDiscCount} phrase hits ≤ ${EN_DISCLAIMER_MAX}`,
  enDiscCount <= EN_DISCLAIMER_MAX, `got ${enDiscCount}`);

// ── 7. EN disclaimer — duplicate footer disclaimer exceeds limit ──────────────

console.log('\n[test] 7. Disclaimer gate — duplicate EN disclaimer exceeds limit');

const doubleDiscEn = makeEnFixture(1, 1, 2);
const doubleEnCount = countEnDisclaimers(doubleDiscEn);
assert(`Two EN disclaimer blocks have ${doubleEnCount} phrase hits > ${EN_DISCLAIMER_MAX}`,
  doubleEnCount > EN_DISCLAIMER_MAX, `got ${doubleEnCount}`);

// ── 8. AR disclaimer — single block is within limit ──────────────────────────

console.log('\n[test] 8. Disclaimer gate — single AR block is within limit');

const singleDiscAr = makeArFixture(1, 1, 1);
const arDiscCount = countArDisclaimers(singleDiscAr);
assert(`Single AR disclaimer block has ${arDiscCount} phrase hits ≤ ${AR_DISCLAIMER_MAX}`,
  arDiscCount <= AR_DISCLAIMER_MAX, `got ${arDiscCount}`);

// ── 9. AR disclaimer — duplicate footer disclaimer exceeds limit ──────────────

console.log('\n[test] 9. Disclaimer gate — duplicate AR disclaimer exceeds limit');

const doubleDiscAr = makeArFixture(1, 1, 2);
const doubleArCount = countArDisclaimers(doubleDiscAr);
assert(`Two AR disclaimer blocks have ${doubleArCount} phrase hits > ${AR_DISCLAIMER_MAX}`,
  doubleArCount > AR_DISCLAIMER_MAX, `got ${doubleArCount}`);

// ── 10. TICKER_BODY_MAX constant matches quality checker TICKER_MAX ───────────

console.log('\n[test] 10. TICKER_BODY_MAX constant matches quality checker threshold');

assert(`TICKER_BODY_MAX = ${TICKER_BODY_MAX} (must equal quality checker TICKER_MAX=5)`,
  TICKER_BODY_MAX === 5);

// ── Summary ───────────────────────────────────────────────────────────────────

console.log(`\n[test-quality-gates] ${passed} passed, ${failed} failed.\n`);

if (failed > 0) {
  console.error(`[FAIL] ${failed} test(s) failed.`);
  process.exit(1);
}
console.log('[PASS] All quality gate tests passed.');
process.exit(0);
