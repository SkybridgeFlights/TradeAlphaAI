'use strict';

/**
 * check-featured-content-links.js
 *
 * Validates that all internal HTML links in the homepage files resolve to
 * files that exist on disk, and that the AR homepage does not link to EN-only
 * routes when an equivalent AR route is available.
 *
 * Checks:
 *   - index.html    — all internal .html hrefs must resolve
 *   - ar/index.html — all internal .html hrefs must resolve
 *                     EN-only routes flagged when AR equivalent exists
 *
 * Usage:
 *   node tools/check-featured-content-links.js
 *   npm run check:featured-links
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let issues = 0;
let warns  = 0;

function fail(msg) { console.error(`  ✗ ${msg}`); issues++; }
function warn(msg) { console.warn(`  ⚠ ${msg}`); warns++; }
function pass(msg) { console.log(`  ✓ ${msg}`); }

function diskExists(siteHref) {
  const rel = siteHref.replace(/^\//, '');
  return fs.existsSync(path.join(ROOT, rel));
}

function isInternalHtml(href) {
  return typeof href === 'string' &&
    href.startsWith('/') &&
    href.endsWith('.html') &&
    !href.startsWith('//');
}

function extractHrefs(html) {
  const hrefs = [];
  const re = /href="(\/[^"#?]+\.html)"/g;
  let m;
  while ((m = re.exec(html)) !== null) hrefs.push(m[1]);
  return [...new Set(hrefs)];
}

// ── Check a single page ───────────────────────────────────────────────────────

function checkPage(relPath, opts = {}) {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    fail(`${relPath}: file not found`);
    return;
  }

  const html  = fs.readFileSync(absPath, 'utf8');
  const hrefs = extractHrefs(html).filter(isInternalHtml);
  let   bad   = 0;

  for (const href of hrefs) {
    if (!diskExists(href)) {
      fail(`${relPath}: link does not resolve → ${href}`);
      bad++;
      continue;
    }

    // AR page: flag EN-only route when an AR equivalent actually exists
    if (opts.arPage && !href.startsWith('/ar/')) {
      const arEquiv = `/ar${href}`;
      if (diskExists(arEquiv)) {
        fail(`${relPath}: EN-only route when AR equivalent exists → ${href}  (use ${arEquiv})`);
        bad++;
      }
    }
  }

  if (bad === 0) pass(`${relPath}: all ${hrefs.length} internal link(s) resolve correctly`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log('[check:featured-links] Checking homepage featured-content links...\n');

checkPage('index.html');
checkPage('ar/index.html', { arPage: true });

console.log(`\n[check:featured-links] ${issues} error(s), ${warns} warning(s).`);

if (issues > 0) {
  console.error('[FAIL] Homepage has unresolved or mis-routed featured-content links.');
  process.exit(1);
}

console.log('[PASS] All homepage featured-content links resolve correctly.');
process.exit(0);
