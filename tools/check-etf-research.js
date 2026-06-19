'use strict';

// Phase 214 CP5 - check:etf-research.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bentry point\b/i, /\bstop[- ]?loss\b/i,
  /\bprice target\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|crash)\b/i,
  /[\u0634]\u0631\u0627\u0621\s+\u0627\u0644\u0622\u0646|[\u0628]\u064a\u0639\s+\u0627\u0644\u0622\u0646|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0645\u0636\u0645\u0648\u0646/
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function detailPath(etf, ar) {
  return path.join(ROOT, ar ? `ar/research/etfs/${etf.slug}/index.html` : `research/etfs/${etf.slug}/index.html`);
}

function validateHtml(html, rel, ar, failures) {
  if (!html) {
    failures.push(`${rel}: missing`);
    return;
  }
  if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: missing indexable robots`);
  if (!/<link rel="canonical" href="https:\/\/www\.tradealphaai\.com\//.test(html)) failures.push(`${rel}: missing canonical`);
  if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) failures.push(`${rel}: missing hreflang parity`);
  if (ar && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing AR RTL html`);
  if (!ar && !/<html lang="en" dir="ltr">/.test(html)) failures.push(`${rel}: missing EN LTR html`);
  if (!/ETF Intelligence Universe|عالم استخبارات صناديق المؤشرات/.test(html)) failures.push(`${rel}: missing ETF intelligence identity`);
  if (!/Research Hub|مركز الأبحاث/.test(html)) failures.push(`${rel}: missing research hub breadcrumb`);
  if (!/not a trading signal|ليست إشارة تداول/.test(html)) failures.push(`${rel}: missing safety disclaimer`);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(html)) failures.push(`${rel}: leaks undefined/NaN/[object Object]`);
  if (ar && !ARABIC.test(html)) failures.push(`${rel}: Arabic page lacks Arabic text`);
  for (const re of FORBIDDEN) if (re.test(html)) failures.push(`${rel}: forbidden ETF research language ${re}`);
}

function validate() {
  const failures = [];
  for (const ar of [false, true]) {
    const indexRel = ar ? 'ar/research/etfs/index.html' : 'research/etfs/index.html';
    const indexHtml = read(path.join(ROOT, indexRel));
    validateHtml(indexHtml, indexRel, ar, failures);
    if (indexHtml) {
      for (const etf of ETFS) {
        const href = `${ar ? '/ar' : ''}/research/etfs/${etf.slug}/`;
        if (!indexHtml.includes(`href="${href}"`)) failures.push(`${indexRel}: missing ${etf.symbol} detail link`);
      }
    }
    for (const etf of ETFS) {
      const rel = ar ? `ar/research/etfs/${etf.slug}/index.html` : `research/etfs/${etf.slug}/index.html`;
      const html = read(detailPath(etf, ar));
      validateHtml(html, rel, ar, failures);
      if (html) {
        for (const required of ['etf-current-state', 'etf-regime-alignment', 'etf-ranking-position', 'etf-history', 'etf-related-research']) {
          if (!html.includes(`id="${required}"`)) failures.push(`${rel}: missing section ${required}`);
        }
        if (!html.includes(etf.symbol)) failures.push(`${rel}: missing symbol ${etf.symbol}`);
        if (!/proxy substitution|دون استبدال/.test(html)) failures.push(`${rel}: missing proxy-substitution discipline`);
        if (!/Evidence|الأدلة/.test(html)) failures.push(`${rel}: missing evidence section`);
      }
    }
  }
  return failures;
}

function run() {
  const failures = validate();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-research] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-research] check:etf-research passed (${ETFS.length * 2 + 2} EN/AR pages, RTL, evidence and safety discipline).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const good = '<html lang="ar" dir="rtl"><meta name="robots" content="index,follow"><link rel="canonical" href="https://www.tradealphaai.com/ar/research/etfs/"><link rel="alternate" hreflang="en"><link rel="alternate" hreflang="ar">عالم استخبارات صناديق المؤشرات مركز الأبحاث ليست إشارة تداول</html>';
  const bad = good.replace('dir="rtl"', 'dir="ltr"');
  const failuresGood = [];
  validateHtml(good, 'fixture', true, failuresGood);
  const failuresBad = [];
  validateHtml(bad, 'fixture', true, failuresBad);
  const ok = failuresGood.length === 0 && failuresBad.length > 0;
  console.log(`[etf-research] self-test: ${ok ? '1/1' : '0/1'} passed`);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
