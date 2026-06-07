'use strict';

/**
 * Applies the canonical global header to all HTML pages site-wide.
 *
 * Replaces any existing header (topbar, site-header) with the output of
 * render-global-header.js, wrapped in GLOBAL_HEADER_START/END markers.
 * Ensures global-header.css and mobile-nav.js are in every processed page.
 *
 * Usage:
 *   node tools/apply-global-header.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderStyles, globalHeaderScripts, MARKER_START, MARKER_END } = require('./render-global-header');

const ROOT   = path.resolve(__dirname, '..');
const DRY    = process.argv.includes('--dry-run');

// All page roots to process
const ROOTS = [
  // Root pages
  'index.html',
  'ar/index.html',
  'stocks.html',
  'ar/stocks.html',
  'rankings.html',
  'ar/rankings.html',
  'etfs.html',
  'ar/etfs.html',
  'ai-stock-screener.html',
  'ar/ai-stock-screener.html',
  'methodology.html',
  'ar/methodology.html',
  // Directories
  'insights',
  'ar/insights',
  'en/insights',
  'market-outlook',
  'ar/market-outlook',
  'en/market-outlook',
  'economic-calendar',
  'ar/economic-calendar',
  'system-status',
  'stocks',
  'ar/stocks',
  'etfs',
  'ar/etfs',
  'compare',
  'ar/compare',
  // Phase 68: intelligence dashboards
  'market-dashboard',
  'ar/market-dashboard',
  'macro-dashboard',
  'ar/macro-dashboard',
  'etf-dashboard',
  'ar/etf-dashboard',
  // Phase 69: market replay
  'market-replay',
  'ar/market-replay',
];

let changed = 0;
let skipped = 0;

if (require.main === module) {
  for (const file of collectTargetFiles()) processFile(file);
  console.log(`[global-header] ${DRY ? '[dry-run] ' : ''}Applied to ${changed} page(s), skipped ${skipped}.`);
}

function processFile(file) {
  let html = fs.readFileSync(file, 'utf8');
  const relative = path.relative(ROOT, file).replaceAll('\\', '/');
  const ar = relative.startsWith('ar/');
  const active = detectActive(relative);
  const { arabicHref, englishHref } = computeLocaleHrefs(relative, ar);

  const header = renderGlobalHeader({ locale: ar ? 'ar' : 'en', activePage: active, arabicHref, englishHref });

  // Find and replace existing header region
  let newHtml;
  if (html.includes(MARKER_START) && html.includes(MARKER_END)) {
    // Already has markers — replace the block
    const before = html.slice(0, html.indexOf(MARKER_START));
    const after  = html.slice(html.indexOf(MARKER_END) + MARKER_END.length);
    newHtml = `${before}${header}${after}`;
  } else {
    const headerStart = findHeaderStart(html);
    const contentStart = findContentStart(html, headerStart);
    if (headerStart < 0 || contentStart < 0) {
      console.warn(`[global-header] Skipped ${relative}: header/content boundary not found`);
      skipped++;
      return;
    }
    newHtml = `${html.slice(0, headerStart)}${header}\n\n  ${html.slice(contentStart)}`;
  }

  // Ensure global-header.css is linked
  newHtml = removeAssetTags(newHtml, /\/?css\/global-header-canonical\.css(?:[?#][^"']*)?/i, 'link');
  newHtml = newHtml.replace('</head>', `  ${globalHeaderStyles()}\n</head>`);

  newHtml = removeAssetTags(newHtml, /\/?js\/(?:global-header|mobile-nav)\.js(?:[?#][^"']*)?/i, 'script');
  newHtml = newHtml.replace('</body>', `  ${globalHeaderScripts()}\n</body>`);

  if (html === newHtml) return; // No change

  if (!DRY) fs.writeFileSync(file, newHtml, 'utf8');
  changed++;
  if (DRY) console.log(`[global-header] [dry] would update: ${relative}`);
}

function findHeaderStart(html) {
  const patterns = [
    MARKER_START,
    '<div class="topbar"',
    '<div class="topbar "',
    '<header class="topbar"',
    '<header class="site-header"',
    '<div class="site-header"'
  ];
  const candidates = patterns
    .map((p) => html.indexOf(p))
    .filter((i) => i >= 0);
  return candidates.length ? Math.min(...candidates) : -1;
}

function findContentStart(html, after) {
  if (after < 0) return -1;
  const tail = html.slice(after);
  const candidates = [
    tail.search(/<main\b/i),
    tail.search(/<div class="site-shell"/i),
    tail.search(/<div class="market-shell"/i),
    tail.search(/<div class="page-shell"/i),
    tail.search(/<div class="wrap"/i),
    tail.search(/<section\b/i)
  ].filter((i) => i >= 0);
  return candidates.length ? after + Math.min(...candidates) : -1;
}

function detectActive(relative) {
  if (/^(?:ar\/)?index\.html$/.test(relative)) return 'home';
  if (/^(?:ar\/)?stocks\.html$/.test(relative)) return 'stocks';
  if (/^(?:ar\/)?rankings\.html$/.test(relative)) return 'rankings';
  if (/^(?:ar\/)?etfs\.html$/.test(relative)) return 'etfs';
  if (/^(?:ar\/)?ai-stock-screener\.html$/.test(relative)) return 'screener';
  if (/^(?:ar\/)?methodology\.html$/.test(relative)) return 'methodology';
  if (/(?:^|[/\\])insights[/\\]/.test(relative) || /^(?:ar\/|en\/)?insights\//.test(relative)) return 'insights';
  if (/market-outlook[/\\]/.test(relative)) return 'market-outlook';
  if (/economic-calendar[/\\]/.test(relative)) return 'economic-calendar';
  if (/^(?:ar\/)?stocks[/\\]/.test(relative)) return 'stocks';
  if (/^(?:ar\/)?etfs[/\\]/.test(relative)) return 'etfs';
  if (/^(?:ar\/)?compare[/\\]/.test(relative)) return 'stocks';
  return '';
}

function computeLocaleHrefs(relative, ar) {
  // For insight articles (not the index), point directly to the counterpart article
  const insightMatch = relative.match(/^(?:ar\/|en\/)?insights\/([^/]+\.html)$/);
  if (insightMatch && insightMatch[1] !== 'index.html') {
    const slug = insightMatch[1];
    return {
      arabicHref:  `/ar/insights/${slug}`,
      englishHref: `/insights/${slug}`
    };
  }
  // For market-outlook articles (not the index), point to the counterpart article
  const outlookMatch = relative.match(/^(?:ar\/|en\/)?market-outlook\/([^/]+\.html)$/);
  if (outlookMatch && outlookMatch[1] !== 'index.html') {
    const slug = outlookMatch[1];
    return {
      arabicHref:  `/ar/market-outlook/${slug}`,
      englishHref: `/market-outlook/${slug}`
    };
  }
  // For economic-calendar index, point to the counterpart section
  if (relative.match(/^(?:ar\/)?economic-calendar\//)) {
    return { arabicHref: '/ar/economic-calendar/', englishHref: '/economic-calendar/' };
  }
  // Default: let the renderer compute section-level counterpart
  return { arabicHref: undefined, englishHref: undefined };
}

function walkHtml(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkHtml(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function collectTargetFiles() {
  const files = new Set();
  for (const target of ROOTS) {
    const absolute = path.join(ROOT, target);
    if (!fs.existsSync(absolute)) continue;
    const stat = fs.statSync(absolute);
    if (stat.isDirectory()) {
      for (const file of walkHtml(absolute)) files.add(file);
    } else {
      files.add(absolute);
    }
  }
  return [...files].sort();
}

function removeAssetTags(html, assetPattern, tagName) {
  const tagPattern = tagName === 'link'
    ? /^[ \t]*<link\b[^>]*>[ \t]*(?:\r?\n)?/gim
    : /^[ \t]*<script\b[^>]*>[\s\S]*?<\/script>[ \t]*(?:\r?\n)?/gim;
  return html.replace(tagPattern, (tag) => assetPattern.test(tag) ? '' : tag);
}

module.exports = {
  ROOTS,
  collectTargetFiles
};
