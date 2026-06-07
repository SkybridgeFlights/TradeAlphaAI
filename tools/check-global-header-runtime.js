'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT     = path.resolve(__dirname, '..');
const failures = [];
const warnings = [];

const REFERENCE_PAGES = [
  'index.html',
  'ar/index.html',
  'market-outlook/index.html',
  'ar/market-outlook/index.html',
  'stocks.html',
  'etfs.html',
  'rankings.html',
];

const MARKET_OUTLOOK_PAGES = htmlFiles('market-outlook').slice(0, 8);
const AR_MARKET_OUTLOOK_PAGES = htmlFiles('ar/market-outlook').slice(0, 8);
const INSIGHT_PAGES = htmlFiles('insights').slice(0, 8);

const ALL_PAGES = [
  ...REFERENCE_PAGES,
  ...MARKET_OUTLOOK_PAGES,
  ...AR_MARKET_OUTLOOK_PAGES,
  ...INSIGHT_PAGES,
].filter((rel) => rel !== 'index' && exists(rel));

for (const rel of ALL_PAGES) {
  checkPage(rel);
}

checkNoDuplicateMobileNav();

if (failures.length) {
  console.error(`Global header runtime check FAILED (${failures.length} issue${failures.length === 1 ? '' : 's'}):`);
  failures.slice(0, 60).forEach((f) => console.error(`  - ${f}`));
  if (warnings.length) {
    console.error('Warnings:');
    warnings.slice(0, 20).forEach((w) => console.error(`  - ${w}`));
  }
  process.exit(1);
}

console.log(`Global header runtime check passed. Checked ${ALL_PAGES.length} pages.`);
if (warnings.length) {
  console.log('Warnings:');
  warnings.slice(0, 20).forEach((w) => console.log(`  - ${w}`));
}

function checkPage(rel) {
  const html = read(rel);
  if (!html) return;

  if (!/<div[^>]+data-global-header/i.test(html)) {
    failures.push(`${rel}: missing data-global-header attribute`);
  }

  if (!/class="mobile-menu-toggle"/i.test(html)) {
    failures.push(`${rel}: missing .mobile-menu-toggle button`);
  }

  if (!/aria-controls="mobile-nav-drawer"/i.test(html)) {
    failures.push(`${rel}: mobile toggle missing aria-controls="mobile-nav-drawer"`);
  }

  const hasGlobalHeaderJs = /global-header\.js/i.test(html);
  const hasMobileNavJs    = /mobile-nav\.js/i.test(html);

  if (!hasGlobalHeaderJs && !hasMobileNavJs) {
    failures.push(`${rel}: neither global-header.js nor mobile-nav.js script found`);
  }

  if (hasGlobalHeaderJs && hasMobileNavJs) {
    warnings.push(`${rel}: both global-header.js and mobile-nav.js are loaded — risk of double-init`);
  }

  if (!/global-header\.css/i.test(html)) {
    failures.push(`${rel}: global-header.css not linked`);
  }
}

function checkNoDuplicateMobileNav() {
  const staticPages = [
    'market-outlook/index.html',
    'ar/market-outlook/index.html',
    'insights/index.html',
    'ar/insights/index.html',
  ];
  for (const rel of staticPages) {
    if (!exists(rel)) continue;
    const html = read(rel);
    const mobileNavCount = (html.match(/mobile-nav\.js/g) || []).length;
    const globalHeaderCount = (html.match(/global-header\.js/g) || []).length;
    if (mobileNavCount > 1) failures.push(`${rel}: mobile-nav.js loaded ${mobileNavCount} times`);
    if (globalHeaderCount > 1) failures.push(`${rel}: global-header.js loaded ${globalHeaderCount} times`);
  }
}

function htmlFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((n) => n.endsWith('.html') && n !== 'index.html')
    .map((n) => path.join(dir, n).replaceAll('\\', '/'));
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function read(rel) {
  const file = path.join(ROOT, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
