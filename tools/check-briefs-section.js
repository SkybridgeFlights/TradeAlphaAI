'use strict';

// Phase 94 validation — /briefs/ editorial surface integrity.
// Ensures the briefs surface stays a well-formed, distinct, bilingual section:
//   - EN + AR index pages exist with canonical header markers, canonical CSS,
//     correct lang/dir, canonical link, and breadcrumb
//   - distinct section identity (Briefs hero + briefing cadence), not a
//     market-outlook clone in content
//   - present in the EN + AR sitemaps
//   - no headline/identity collision with the market-outlook surface
//   - educational disclaimer present, no advice language

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } }

const PAGES = [
  { rel: 'briefs/index.html', lang: 'en', canonical: 'https://www.tradealphaai.com/briefs/', heroEn: 'institutional market briefs' },
  { rel: 'ar/briefs/index.html', lang: 'ar', canonical: 'https://www.tradealphaai.com/ar/briefs/', heroAr: 'موجزات' },
];

for (const page of PAGES) {
  const html = read(page.rel);
  if (!html) { failures.push(`${page.rel}: missing`); continue; }
  if (!html.includes('GLOBAL_HEADER_START') || !html.includes('GLOBAL_HEADER_END')) failures.push(`${page.rel}: global header markers missing`);
  if (!html.includes('/css/global-header-canonical.css')) failures.push(`${page.rel}: canonical header CSS missing`);
  if (!new RegExp(`<html lang="${page.lang}"`).test(html)) failures.push(`${page.rel}: wrong lang`);
  if (page.lang === 'ar' && !html.includes('dir="rtl"')) failures.push(`${page.rel}: AR page missing dir=rtl`);
  if (!html.includes(`<link rel="canonical" href="${page.canonical}"`)) failures.push(`${page.rel}: canonical link wrong/missing`);
  if (!html.includes('class="breadcrumb"')) failures.push(`${page.rel}: breadcrumb missing`);
  if (!html.includes('briefing-cadence')) failures.push(`${page.rel}: briefing cadence section missing (section identity)`);
  if (page.lang === 'ar' && !/[؀-ۿ]/.test(html)) failures.push(`${page.rel}: AR page has no Arabic text`);
  // Distinct identity: must not present itself as the market-outlook collection.
  if (/Market Outlook Research \| Macro/.test(html)) failures.push(`${page.rel}: carries market-outlook identity (section confusion)`);
  // No advice language.
  if (/\b(buy now|sell now|guaranteed returns?|price target)\b/i.test(html)) failures.push(`${page.rel}: advice language detected`);
  // Disclaimer present.
  if (!/not investment advice|ليست نصيحة استثمارية/.test(html)) failures.push(`${page.rel}: educational disclaimer missing`);
}

// Sitemap presence (EN core + AR).
const coreSitemap = read('sitemap-core.xml') || '';
const arSitemap = read('sitemap-ar.xml') || '';
if (!coreSitemap.includes('https://www.tradealphaai.com/briefs/')) failures.push('sitemap-core.xml: /briefs/ missing');
if (!arSitemap.includes('https://www.tradealphaai.com/ar/briefs/')) failures.push('sitemap-ar.xml: /ar/briefs/ missing');

if (failures.length) {
  failures.forEach((f) => console.error(`[briefs-section] FAIL: ${f}`));
  process.exit(1);
}
console.log('[briefs-section] check:briefs-section passed.');
