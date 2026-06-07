'use strict';

const fs = require('fs');
const path = require('path');
const { collectTargetFiles } = require('./apply-global-header');
const { MARKER_START, MARKER_END } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const pages = collectTargetFiles();
let mobileNavCount = 0;

for (const file of pages) {
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const html = fs.readFileSync(file, 'utf8');

  requireCount(relative, html, /<script\b[^>]*src=["'][^"']*\/js\/global-header\.js(?:[?#][^"']*)?["'][^>]*>\s*<\/script>/gi, 1, 'global-header.js');
  requireCount(relative, html, /<link\b[^>]*href=["'][^"']*\/css\/global-header-canonical\.css(?:[?#][^"']*)?["'][^>]*>/gi, 1, 'global-header-canonical.css');

  const legacyScripts = html.match(/<script\b[^>]*src=["'][^"']*\/js\/mobile-nav\.js(?:[?#][^"']*)?["'][^>]*>\s*<\/script>/gi) || [];
  mobileNavCount += legacyScripts.length;
  if (legacyScripts.length) failures.push(`${relative}: mobile-nav.js must not load on a canonical page`);

  requireCount(relative, html, /data-global-header\b/gi, 1, 'data-global-header');
  requireCount(relative, html, /class=["'][^"']*\bmobile-menu-toggle\b[^"']*["']/gi, 1, '.mobile-menu-toggle');
  requireCount(relative, html, new RegExp(escapeRegExp(MARKER_START), 'g'), 1, 'GLOBAL_HEADER_START marker');
  requireCount(relative, html, new RegExp(escapeRegExp(MARKER_END), 'g'), 1, 'GLOBAL_HEADER_END marker');

  const drawerMarkup = html.match(/class=["'][^"']*\bmobile-nav-(?:shell|panel)\b[^"']*["']/gi) || [];
  if (drawerMarkup.length > 1) failures.push(`${relative}: duplicate mobile drawer markup (${drawerMarkup.length} nodes)`);

  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  if (inlineScripts.some((match) => /\b(?:mobile-menu-toggle|mobile-nav-(?:shell|panel|open)|data-global-header)\b/.test(match[1]))) {
    failures.push(`${relative}: inline navigation drawer runtime detected`);
  }
}

if (failures.length) {
  console.error(`Header runtime integrity FAILED (${failures.length} issues across ${pages.length} pages):`);
  failures.slice(0, 100).forEach((failure) => console.error(`  - ${failure}`));
  if (failures.length > 100) console.error(`  ... ${failures.length - 100} more`);
  process.exit(1);
}

console.log(`Header runtime integrity passed. Checked ${pages.length} pages.`);
console.log(`Duplicate mobile-nav.js count: ${mobileNavCount}`);

function requireCount(relative, html, pattern, expected, label) {
  const count = (html.match(pattern) || []).length;
  if (count !== expected) failures.push(`${relative}: expected ${expected} ${label}, found ${count}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
