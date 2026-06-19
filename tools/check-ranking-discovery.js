'use strict';

// Phase 209 / CP6 — discovery validator for the new /rankings/ directory
// surface. Keeps it distinct from the legacy /rankings.html page.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const ROUTES = ['/rankings/', '/rankings/assets/', '/rankings/sectors/', '/rankings/equities/'];
const AR_ROUTES = ROUTES.map((route) => `/ar${route}`);
const FORBIDDEN = [/\/system-status(?:\/|$)/, /^\/data\//, /^\/runtime\//, /\.json(?:$|[?#])/];

function hrefs(html) {
  return [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

function routeToFile(route) {
  return route === '/' ? 'index.html' : route.endsWith('/') ? `${route.slice(1)}index.html` : route.slice(1);
}

function sitemapText() {
  return fs.readdirSync(ROOT)
    .filter((name) => /^sitemap-.*\.xml$/.test(name))
    .map((name) => fs.readFileSync(path.join(ROOT, name), 'utf8'))
    .join('\n');
}

function validate(out) {
  const enHeader = renderGlobalHeader({ locale: 'en' });
  const arHeader = renderGlobalHeader({ locale: 'ar' });
  const enHrefs = hrefs(enHeader);
  const arHrefs = hrefs(arHeader);
  if (!enHrefs.includes('/rankings/')) out.push('EN global header missing /rankings/');
  if (!arHrefs.includes('/ar/rankings/')) out.push('AR global header missing /ar/rankings/');
  for (const href of enHrefs.concat(arHrefs)) {
    if (FORBIDDEN.some((re) => re.test(href))) out.push(`internal route exposed in header: ${href}`);
  }
  for (const route of ROUTES.concat(AR_ROUTES)) {
    if (!fs.existsSync(path.join(ROOT, routeToFile(route)))) out.push(`missing ranking route ${route}`);
  }
  const overview = fs.existsSync(path.join(ROOT, 'rankings/index.html')) ? fs.readFileSync(path.join(ROOT, 'rankings/index.html'), 'utf8') : '';
  const arOverview = fs.existsSync(path.join(ROOT, 'ar/rankings/index.html')) ? fs.readFileSync(path.join(ROOT, 'ar/rankings/index.html'), 'utf8') : '';
  for (const route of ROUTES.slice(1)) if (!overview.includes(`href="${route}"`)) out.push(`overview missing discovery link ${route}`);
  for (const route of AR_ROUTES.slice(1)) if (!arOverview.includes(`href="${route}"`)) out.push(`AR overview missing discovery link ${route}`);
  const maps = sitemapText();
  for (const route of ROUTES.concat(AR_ROUTES)) {
    if (!maps.includes(`<loc>${DOMAIN}${route}</loc>`)) out.push(`sitemap missing ${route}`);
  }
  const legacy = fs.existsSync(path.join(ROOT, 'rankings.html')) ? fs.readFileSync(path.join(ROOT, 'rankings.html'), 'utf8') : '';
  if (!legacy) out.push('legacy rankings.html missing');
  else if (!legacy.includes('https://www.tradealphaai.com/rankings.html')) out.push('legacy rankings.html canonical appears clobbered');
}

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (name, condition) => { total += 1; if (condition) ok += 1; else console.error(`SELF-TEST FAIL: ${name}`); };
  T('forbidden catches system status', FORBIDDEN.some((re) => re.test('/system-status/')));
  T('forbidden catches json', FORBIDDEN.some((re) => re.test('/data/x.json')));
  T('route conversion', routeToFile('/rankings/assets/') === 'rankings/assets/index.html');
  console.log(`[ranking-discovery] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = [];
  validate(failures);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[ranking-discovery] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log('[ranking-discovery] check:ranking-discovery passed (header discovery, EN/AR pages, sitemaps, legacy rankings.html preserved).');
}

module.exports = { validate };
