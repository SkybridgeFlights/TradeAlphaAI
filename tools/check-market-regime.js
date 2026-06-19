'use strict';

// Phase 210 CP8 — check:market-regime.
// Validates command-center pages, discovery links and sitemap coverage.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PAGES = [
  ['market-regime/index.html', 'en', ['Current Regime', 'Confirmation Matrix', 'Leadership Dashboard', 'What Changed', 'Historical Transition']],
  ['ar/market-regime/index.html', 'ar', ['النظام الحالي', 'مصفوفة التأكيد', 'لوحة القيادة النسبية', 'ما الذي تغير', 'الانتقال التاريخي']],
  ['market-regime/history/index.html', 'en', ['Regime Timeline', 'Historical Changes', 'Transition Evolution']],
  ['ar/market-regime/history/index.html', 'ar', ['التسلسل الزمني للنظام', 'التغيرات التاريخية', 'تطور الانتقال']]
];
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function read(rel) {
  const abs = path.join(ROOT, rel);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
}

function validatePage(rel, locale, required, html, failures) {
  if (!html) { failures.push(`${rel}: missing page`); return; }
  const mainHtml = html.replace(/<!-- GLOBAL_HEADER_START -->[\s\S]*?<!-- GLOBAL_HEADER_END -->/, '');
  const expectedAr = rel.includes('/history/') ? '/ar/market-regime/history/' : '/ar/market-regime/';
  const expectedEn = rel.includes('/history/') ? '/market-regime/history/' : '/market-regime/';
  if (!html.includes('<!-- GLOBAL_HEADER_START -->') || !html.includes('<!-- GLOBAL_HEADER_END -->')) failures.push(`${rel}: missing global header markers`);
  if (locale === 'ar') {
    if (!/<html[^>]+lang="ar"[^>]+dir="rtl"/.test(html)) failures.push(`${rel}: missing lang=ar dir=rtl`);
    if (!html.includes(`href="${expectedEn}"`)) failures.push(`${rel}: missing EN counterpart link`);
  } else {
    if (!/<html[^>]+lang="en"[^>]+dir="ltr"/.test(html)) failures.push(`${rel}: missing lang=en dir=ltr`);
    if (!html.includes(`href="${expectedAr}"`)) failures.push(`${rel}: missing AR counterpart link`);
  }
  for (const text of required) if (!html.includes(text)) failures.push(`${rel}: missing required section "${text}"`);
  if (!html.includes(locale === 'ar' ? '/ar/market-regime/' : '/market-regime/')) failures.push(`${rel}: missing market-regime nav link`);
  if (/href="[^"]*system-status/i.test(html)) failures.push(`${rel}: system-status exposed in nav/body link`);
  if (/data-intelligence-artifact|\.json["']/.test(mainHtml)) failures.push(`${rel}: raw artifact exposure`);
  if (/\b(undefined|NaN|null)\b/.test(mainHtml)) failures.push(`${rel}: null/undefined leak`);
  for (const re of FORBIDDEN) if (re.test(mainHtml)) failures.push(`${rel}: forbidden advice/forecast language ${re}`);
}

function validate(input = null) {
  const failures = [];
  const source = input || Object.fromEntries(PAGES.map(([rel]) => [rel, read(rel)]));
  for (const [rel, locale, required] of PAGES) validatePage(rel, locale, required, source[rel], failures);
  const header = input?.header || read('tools/render-global-header.js') || '';
  if (!header.includes("['/market-regime/', 'Market Regime']")) failures.push('global header missing EN Market Regime dropdown link');
  if (!header.includes("['/ar/market-regime/', 'نظام السوق']")) failures.push('global header missing AR Market Regime dropdown link');
  if (/system-status/.test(header)) failures.push('global header exposes system-status');
  const core = input?.coreSitemap || read('sitemap-core.xml') || '';
  const ar = input?.arSitemap || read('sitemap-ar.xml') || '';
  for (const loc of ['https://www.tradealphaai.com/market-regime/', 'https://www.tradealphaai.com/market-regime/history/']) {
    if (!core.includes(`<loc>${loc}</loc>`)) failures.push(`sitemap-core missing ${loc}`);
  }
  for (const loc of ['https://www.tradealphaai.com/ar/market-regime/', 'https://www.tradealphaai.com/ar/market-regime/history/']) {
    if (!ar.includes(`<loc>${loc}</loc>`)) failures.push(`sitemap-ar missing ${loc}`);
  }
  return failures;
}

function run() {
  const failures = validate();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[market-regime] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[market-regime] check:market-regime passed (pages, header discovery, sitemaps, EN/AR, no internal exposure).');
}

if (require.main === module && process.argv.includes('--self-test')) {
  const clean = Object.fromEntries(PAGES.map(([rel]) => [rel, read(rel)]));
  clean.header = read('tools/render-global-header.js');
  clean.coreSitemap = read('sitemap-core.xml');
  clean.arSitemap = read('sitemap-ar.xml');
  let ok = 0; let total = 0;
  const cases = [
    ['clean', (m) => m, false],
    ['missing section', (m) => { m['market-regime/index.html'] = m['market-regime/index.html'].replace('Confirmation Matrix', ''); }, true],
    ['bad rtl', (m) => { m['ar/market-regime/index.html'] = m['ar/market-regime/index.html'].replace('dir="rtl"', 'dir="ltr"'); }, true],
    ['system status exposure', (m) => { m['market-regime/index.html'] += '<a href="/system-status/">status</a>'; }, true],
    ['raw json exposure', (m) => { m['market-regime/index.html'] += '<a href="/data/intelligence/market-regime-dashboard.json">json</a>'; }, true],
    ['forbidden language', (m) => { m['market-regime/index.html'] += ' buy signal'; }, true],
    ['missing header link', (m) => { m.header = m.header.replace("['/market-regime/', 'Market Regime'],", ''); }, true],
    ['missing sitemap', (m) => { m.coreSitemap = m.coreSitemap.replace('https://www.tradealphaai.com/market-regime/', ''); }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(clean));
    mutate(copy);
    const failed = validate(copy).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[market-regime] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
