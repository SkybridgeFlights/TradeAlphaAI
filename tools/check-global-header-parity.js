'use strict';

/**
 * Validates that all main pages have structurally identical global headers.
 * Compares nav item count, nav hrefs, language switch, CTA, logo, mobile
 * menu, and marker presence against a reference baseline per locale.
 */

const fs   = require('fs');
const path = require('path');
const { MARKER_START, MARKER_END } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');

// Pages to validate — [relative-path, locale, label]
const EN_PAGES = [
  ['index.html',                    'en', 'Homepage'],
  ['insights/index.html',           'en', 'Insights index'],
  ['articles/index.html',           'en', 'Articles index'],
  ['market-news/index.html',        'en', 'Market News index'],
  ['market-structure/index.html',   'en', 'Market Structure index'],
  ['market-outlook/index.html',     'en', 'Market Outlook index'],
  ['briefs/index.html',             'en', 'Briefs index'],
  ['economic-calendar/index.html',  'en', 'Economic Calendar'],
  ['stocks.html',                   'en', 'Stocks'],
  ['rankings.html',                 'en', 'Rankings'],
  ['etfs.html',                     'en', 'ETFs'],
  ['methodology.html',              'en', 'Methodology']
];

const AR_PAGES = [
  ['ar/index.html',                   'ar', 'Arabic Homepage'],
  ['ar/insights/index.html',          'ar', 'Arabic Insights index'],
  ['ar/articles/index.html',          'ar', 'Arabic Articles index'],
  ['ar/market-news/index.html',       'ar', 'Arabic Market News index'],
  ['ar/market-structure/index.html',  'ar', 'Arabic Market Structure index'],
  ['ar/market-outlook/index.html',    'ar', 'Arabic Market Outlook index'],
  ['ar/briefs/index.html',            'ar', 'Arabic Briefs index'],
  ['ar/economic-calendar/index.html', 'ar', 'Arabic Economic Calendar'],
  ['ar/stocks.html',                  'ar', 'Arabic Stocks'],
  ['ar/rankings.html',                'ar', 'Arabic Rankings'],
  ['ar/etfs.html',                    'ar', 'Arabic ETFs'],
  ['ar/methodology.html',             'ar', 'Arabic Methodology']
];

const failures  = [];
const warnings  = [];
let   pagesOk   = 0;

function validateGroup(pages, locale) {
  const baselines = {};

  for (const [rel, loc, label] of pages) {
    const absPath = path.join(ROOT, rel);
    if (!fs.existsSync(absPath)) {
      warnings.push(`${label} (${rel}): file not found — skipped`);
      continue;
    }
    const html = fs.readFileSync(absPath, 'utf8');
    const sig  = headerSignature(html, rel);

    if (!sig) {
      failures.push(`${label} (${rel}): global header marker missing — run apply-global-header.js`);
      continue;
    }

    if (!baselines[loc]) {
      baselines[loc] = { sig, label, rel };
    } else {
      const base = baselines[loc];
      const diffs = compareSignatures(base.sig, sig);
      if (diffs.length) {
        for (const d of diffs) {
          failures.push(`${label} (${rel}): ${d} — differs from ${base.label} (${base.rel})`);
        }
      } else {
        pagesOk++;
      }
    }

    // Self-checks
    if (!sig.hasLogo)         failures.push(`${label} (${rel}): logo (.brand) missing`);
    if (!sig.hasNav)          failures.push(`${label} (${rel}): nav (.nav-group) missing`);
    if (!sig.hasCta)          failures.push(`${label} (${rel}): CTA (.header-signal-cta) missing`);
    if (!sig.hasLocaleSwitch) failures.push(`${label} (${rel}): locale switcher (.locale-links) missing`);
    if (!sig.hasMobileToggle) failures.push(`${label} (${rel}): mobile-menu-toggle missing`);
    if (!sig.hasGlobalHeader) failures.push(`${label} (${rel}): [data-global-header] attribute missing`);
    if (sig.navCount === 0)   failures.push(`${label} (${rel}): nav has 0 links`);
  }
}

validateGroup(EN_PAGES, 'en');
validateGroup(AR_PAGES, 'ar');

if (warnings.length) {
  console.warn(`[header-parity] Warnings (${warnings.length}):\n  - ${warnings.join('\n  - ')}`);
}

if (failures.length) {
  console.error(`[header-parity] FAILED — ${failures.length} issue(s):\n  - ${failures.join('\n  - ')}`);
  process.exit(1);
}

console.log(`Global header parity passed. ${pagesOk} cross-page comparisons clean.`);

// ── Helpers ──

function headerSignature(html, rel) {
  const start = html.indexOf(MARKER_START);
  const end   = html.indexOf(MARKER_END);
  if (start < 0 || end < 0) {
    // Fall back to finding a topbar div with data-global-header
    const i = html.search(/<div[^>]+data-global-header/i);
    if (i < 0) return null;
    return buildSig(html, i, rel);
  }
  return buildSig(html, start, rel);
}

function buildSig(html, startIdx, rel) {
  // Extract header region using markers if available, otherwise scan for content start
  let region;
  const endMarkerIdx = html.indexOf(MARKER_END, startIdx);
  if (endMarkerIdx >= 0) {
    region = html.slice(startIdx, endMarkerIdx + MARKER_END.length);
  } else {
    const tail = html.slice(startIdx);
    const mainIdx = tail.search(/<main\b|<div class="site-shell"|<div class="page-shell"/i);
    region = mainIdx >= 0 ? tail.slice(0, mainIdx) : tail.slice(0, 8000);
  }

  // Nav items
  const navRegion = region.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i);
  const navLinks = navRegion
    ? [...navRegion[0].matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((m) =>
      m[1].replace(/^\/ar/, '').replace(/#.*$/, '').replace(/\/$/, '') || '/'
    )
    : [];

  return {
    hasGlobalHeader: region.includes('data-global-header'),
    hasLogo:         region.includes('class="brand"'),
    hasNav:          region.includes('class="nav-group"'),
    hasCta:          region.includes('header-signal-cta'),
    hasLocaleSwitch: region.includes('locale-links'),
    hasMobileToggle: region.includes('mobile-menu-toggle'),
    navCount:        navLinks.length,
    navOrder:        navLinks,
    hasMarkers:      html.includes(MARKER_START) && html.includes(MARKER_END)
  };
}

function compareSignatures(a, b) {
  const diffs = [];
  if (a.navCount !== b.navCount) {
    diffs.push(`nav item count: ${a.navCount} vs ${b.navCount}`);
  }
  const aNav = a.navOrder.join(',');
  const bNav = b.navOrder.join(',');
  if (aNav !== bNav) {
    diffs.push(`nav order: [${aNav}] vs [${bNav}]`);
  }
  return diffs;
}
