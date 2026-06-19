'use strict';

// Phase 209 / CP6 — validates the institutional ranking discovery pages.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const PAGES = [
  ['rankings/index.html', 'en', '/rankings/'],
  ['rankings/assets/index.html', 'en', '/rankings/assets/'],
  ['rankings/sectors/index.html', 'en', '/rankings/sectors/'],
  ['rankings/equities/index.html', 'en', '/rankings/equities/'],
  ['ar/rankings/index.html', 'ar', '/ar/rankings/'],
  ['ar/rankings/assets/index.html', 'ar', '/ar/rankings/assets/'],
  ['ar/rankings/sectors/index.html', 'ar', '/ar/rankings/sectors/'],
  ['ar/rankings/equities/index.html', 'ar', '/ar/rankings/equities/']
];

const REQUIRED_SECTIONS = ['ranking-overview', 'ranking-disclaimer'];
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bgo (long|short)\b/i, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري|إشارة\s*تداول)/
];
const INTERNAL = [/\/system-status(?:\/|$)/, /href="\/data\//i, /href="\/runtime\//i, /href="[^"]*\.json/i];

function text(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');
}

function routeToFile(href) {
  const route = href.split('#')[0];
  if (!route.startsWith('/')) return null;
  return route === '/' ? 'index.html' : route.endsWith('/') ? `${route.slice(1)}index.html` : route.slice(1);
}

function validateHtml(html, rel, lang, route, out) {
  const pageText = text(html);
  if (!html.includes(`data-ranking-page=`)) out.push(`${rel}: missing ranking page marker`);
  if (!html.includes(`rel="canonical" href="${DOMAIN}${route}"`)) out.push(`${rel}: bad canonical`);
  if (!html.includes('hreflang="en"') || !html.includes('hreflang="ar"')) out.push(`${rel}: missing hreflang pair`);
  if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) out.push(`${rel}: AR page is not RTL`);
  for (const id of REQUIRED_SECTIONS) if (!html.includes(`id="${id}"`)) out.push(`${rel}: missing section ${id}`);
  if (!/id="(?:asset|sector|equity)-ranking-table"/.test(html)) out.push(`${rel}: missing ranking table section`);
  if (!/class="market-card ranking-card"/.test(html)) out.push(`${rel}: no ranking cards rendered`);
  if (/\b(undefined|null|NaN)\b/i.test(pageText)) out.push(`${rel}: visible null/undefined/NaN leak`);
  for (const re of FORBIDDEN) if (re.test(pageText)) out.push(`${rel}: forbidden retail/advice language ${re}`);
  for (const re of INTERNAL) if (re.test(html)) out.push(`${rel}: internal/raw artifact exposed ${re}`);
  const switches = [...html.matchAll(/data-locale-route="(ar|en)" href="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);
  if (!switches.some((s) => s.startsWith('ar:/ar/rankings/')) || !switches.some((s) => s.startsWith('en:/rankings/'))) {
    out.push(`${rel}: locale switch does not stay inside ranking surface`);
  }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((href) => href.startsWith('/'));
  for (const href of hrefs) {
    if (href.startsWith('/data/') || href.startsWith('/runtime/') || href.includes('system-status')) out.push(`${rel}: unsafe href ${href}`);
    const file = routeToFile(href);
    if (file && !fs.existsSync(path.join(ROOT, file))) out.push(`${rel}: broken local link ${href}`);
  }
}

function run() {
  const failures = [];
  for (const [rel, lang, route] of PAGES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { failures.push(`${rel}: missing`); continue; }
    validateHtml(fs.readFileSync(file, 'utf8'), rel, lang, route, failures);
  }
  const enOrder = PAGES.filter((p) => p[1] === 'en').map((p) => p[2].replace(/^\/rankings\/?/, '/rankings/')).join('|');
  const arOrder = PAGES.filter((p) => p[1] === 'ar').map((p) => p[2].replace(/^\/ar\/rankings\/?/, '/rankings/')).join('|');
  if (enOrder !== arOrder) failures.push('EN/AR ranking page route parity mismatch');
  return failures;
}

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const sample = '<html dir="rtl"><head><link rel="canonical" href="https://www.tradealphaai.com/ar/rankings/" /><link rel="alternate" hreflang="en" /><link rel="alternate" hreflang="ar" /></head><body><div class="locale-links"><a data-locale-route="ar" href="/ar/rankings/"></a><a data-locale-route="en" href="/rankings/"></a></div><main data-ranking-page="overview"><section id="ranking-overview"></section><section id="asset-ranking-table"><article class="market-card ranking-card"></article></section><section id="ranking-disclaimer"></section></main></body></html>';
  const T = (name, fn) => { total += 1; const out = []; fn(out); if (out.length) ok += 1; else console.error(`SELF-TEST FAIL: ${name}`); };
  T('retail language', (out) => validateHtml(sample.replace('</main>', ' buy signal </main>'), 'x', 'ar', '/ar/rankings/', out));
  T('raw artifact', (out) => validateHtml(sample.replace('</main>', '<a href="/data/x.json">x</a></main>'), 'x', 'ar', '/ar/rankings/', out));
  T('missing table', (out) => validateHtml(sample.replace('id="asset-ranking-table"', 'id="x"'), 'x', 'ar', '/ar/rankings/', out));
  T('bad locale', (out) => validateHtml(sample.replace('/ar/rankings/', '/ar/'), 'x', 'ar', '/ar/rankings/', out));
  console.log(`[ranking-pages] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = run();
  if (failures.length) {
    failures.forEach((failure) => console.error(`[ranking-pages] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[ranking-pages] check:ranking-pages passed (${PAGES.length} pages; EN/AR parity, local links, no raw/internal routes, no advice language).`);
}

module.exports = { run };
