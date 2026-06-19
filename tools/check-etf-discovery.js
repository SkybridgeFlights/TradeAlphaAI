'use strict';

// Phase 214 CP8 - check:etf-discovery.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const EN = path.join(ROOT, 'etfs', 'index.html');
const AR = path.join(ROOT, 'ar', 'etfs', 'index.html');
const ARABIC = /[\u0600-\u06ff]/;
const FORBIDDEN = [
  /system-status/i, /data\/intelligence/i, /data\/visual/i, /check-/i,
  /\bbuy now\b/i, /\bsell now\b/i, /\bprice target\b/i, /\bguaranteed\b/i,
  /[\u0634]\u0631\u0627\u0621\s+\u0627\u0644\u0622\u0646|[\u0628]\u064a\u0639\s+\u0627\u0644\u0622\u0646|\u0647\u062f\u0641\s*\u0633\u0639\u0631\u064a|\u0645\u0636\u0645\u0648\u0646/
];

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

function validatePage(file, ar) {
  const failures = [];
  const html = read(file);
  const rel = path.relative(ROOT, file);
  if (!html) return [`${rel}: missing`];
  if (ar && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing AR RTL`);
  if (!ar && !/<html lang="en" dir="ltr">/.test(html)) failures.push(`${rel}: missing EN LTR`);
  if (!/<link rel="canonical" href="https:\/\/www\.tradealphaai\.com\/(?:ar\/)?etfs\/"/.test(html)) failures.push(`${rel}: missing canonical`);
  if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) failures.push(`${rel}: missing hreflang parity`);
  if (!/ETF Intelligence Universe|عالم استخبارات صناديق المؤشرات/.test(html)) failures.push(`${rel}: missing ETF universe identity`);
  for (const route of ['research/etfs/', 'market-map/etfs/']) {
    const expected = ar ? `/ar/${route}` : `/${route}`;
    if (!html.includes(`href="${expected}"`)) failures.push(`${rel}: missing ${expected}`);
  }
  for (const etf of ETFS) {
    const expected = ar ? `/ar/research/etfs/${etf.slug}/` : `/research/etfs/${etf.slug}/`;
    if (!html.includes(`href="${expected}"`)) failures.push(`${rel}: missing ${etf.symbol} research link`);
  }
  if (!/not trading signals|ليست إشارات تداول/.test(html)) failures.push(`${rel}: missing safety disclaimer`);
  if (ar && !ARABIC.test(html)) failures.push(`${rel}: Arabic page lacks Arabic`);
  if (/\b(undefined|NaN|\[object Object\])\b/.test(html)) failures.push(`${rel}: leaks undefined/NaN/[object Object]`);
  for (const re of FORBIDDEN) if (re.test(html)) failures.push(`${rel}: forbidden discovery language ${re}`);
  return failures;
}

function validateSitemaps() {
  const failures = [];
  const core = read(path.join(ROOT, 'sitemap-core.xml')) || '';
  const ar = read(path.join(ROOT, 'sitemap-ar.xml')) || '';
  const requiredCore = ['/etfs/', '/research/etfs/', '/market-map/etfs/'];
  const requiredAr = ['/ar/etfs/', '/ar/research/etfs/', '/ar/market-map/etfs/'];
  for (const route of requiredCore) if (!core.includes(`https://www.tradealphaai.com${route}`)) failures.push(`sitemap-core missing ${route}`);
  for (const route of requiredAr) if (!ar.includes(`https://www.tradealphaai.com${route}`)) failures.push(`sitemap-ar missing ${route}`);
  for (const etf of ETFS) {
    if (!core.includes(`https://www.tradealphaai.com/research/etfs/${etf.slug}/`)) failures.push(`sitemap-core missing ${etf.symbol} research`);
    if (!ar.includes(`https://www.tradealphaai.com/ar/research/etfs/${etf.slug}/`)) failures.push(`sitemap-ar missing ${etf.symbol} research`);
  }
  return failures;
}

function validate() {
  return [
    ...validatePage(EN, false),
    ...validatePage(AR, true),
    ...validateSitemaps()
  ];
}

function run() {
  const failures = validate();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-discovery] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[etf-discovery] check:etf-discovery passed (/etfs/ + AR, sitemap coverage, no internal exposure).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const good = '<html lang="ar" dir="rtl"><link rel="canonical" href="https://www.tradealphaai.com/ar/etfs/"><link rel="alternate" hreflang="en"><link rel="alternate" hreflang="ar">عالم استخبارات صناديق المؤشرات href="/ar/research/etfs/" href="/ar/market-map/etfs/" ليست إشارات تداول</html>';
  const bad = good.replace('/ar/research/etfs/', '/data/intelligence/etf.json');
  const failuresGood = [];
  fs.writeFileSync(path.join(ROOT, '.tmp-etf-discovery-good.html'), good, 'utf8');
  fs.writeFileSync(path.join(ROOT, '.tmp-etf-discovery-bad.html'), bad, 'utf8');
  failuresGood.push(...validatePage(path.join(ROOT, '.tmp-etf-discovery-good.html'), true).filter((failure) => !/missing [A-Z]/.test(failure)));
  const failuresBad = validatePage(path.join(ROOT, '.tmp-etf-discovery-bad.html'), true);
  fs.unlinkSync(path.join(ROOT, '.tmp-etf-discovery-good.html'));
  fs.unlinkSync(path.join(ROOT, '.tmp-etf-discovery-bad.html'));
  const ok = failuresGood.length === 0 && failuresBad.length > 0;
  console.log(`[etf-discovery] self-test: ${ok ? '1/1' : '0/1'} passed`);
  process.exit(ok ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
