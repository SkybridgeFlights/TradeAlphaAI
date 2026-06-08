'use strict';

/**
 * check-dashboard-route-dependencies.js
 *
 * Fails if any tracked HTML page links to a dashboard/replay route whose
 * index.html does not exist in the repository working tree.
 *
 * Routes checked:
 *   /market-replay/        → market-replay/index.html
 *   /market-dashboard/     → market-dashboard/index.html
 *   /macro-dashboard/      → macro-dashboard/index.html
 *   /etf-dashboard/        → etf-dashboard/index.html
 *   /ar/market-replay/     → ar/market-replay/index.html
 *   /ar/market-dashboard/  → ar/market-dashboard/index.html
 *   /ar/macro-dashboard/   → ar/macro-dashboard/index.html
 *   /ar/etf-dashboard/     → ar/etf-dashboard/index.html
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// Route → expected file mapping
const ROUTE_MAP = {
  '/market-replay/':       'market-replay/index.html',
  '/market-dashboard/':    'market-dashboard/index.html',
  '/macro-dashboard/':     'macro-dashboard/index.html',
  '/etf-dashboard/':       'etf-dashboard/index.html',
  '/ar/market-replay/':    'ar/market-replay/index.html',
  '/ar/market-dashboard/': 'ar/market-dashboard/index.html',
  '/ar/macro-dashboard/':  'ar/macro-dashboard/index.html',
  '/ar/etf-dashboard/':    'ar/etf-dashboard/index.html',
};

// Directories to scan for pages that might reference these routes
const SCAN_DIRS = [
  'intelligence',
  'en/intelligence',
  'ar/intelligence',
  'market-outlook',
  'ar/market-outlook',
  'en/market-outlook',
  'insights',
  'ar/insights',
  'en/insights',
];

// Build regex that matches href="/market-replay/" etc. in HTML
const routePattern = Object.keys(ROUTE_MAP)
  .map(r => r.replace(/\//g, '\\/'))
  .join('|');
const HREF_RE = new RegExp(`href="(${routePattern})"`, 'g');

function collectHtmlFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const results = [];
  for (const entry of fs.readdirSync(abs)) {
    if (entry.endsWith('.html')) results.push(path.join(dir, entry));
  }
  return results;
}

function main() {
  // Pre-check which routes are missing
  const missing = {};
  for (const [route, file] of Object.entries(ROUTE_MAP)) {
    if (!fs.existsSync(path.join(ROOT, file))) {
      missing[route] = file;
    }
  }

  if (Object.keys(missing).length === 0) {
    console.log('[check-dashboard-routes] All dashboard/replay routes exist on disk.');
  } else {
    console.log('[check-dashboard-routes] Missing route targets:');
    for (const [route, file] of Object.entries(missing)) {
      console.log(`  MISSING: ${file}  (needed for links to ${route})`);
    }
  }

  // Scan pages for broken links
  const failures = [];

  for (const dir of SCAN_DIRS) {
    for (const relPath of collectHtmlFiles(dir)) {
      const content = fs.readFileSync(path.join(ROOT, relPath), 'utf8');
      let match;
      HREF_RE.lastIndex = 0;
      while ((match = HREF_RE.exec(content)) !== null) {
        const route = match[1];
        if (missing[route]) {
          failures.push({ page: relPath, route, missing_file: missing[route] });
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log('[check-dashboard-routes] PASS — no pages link to missing dashboard/replay routes.');
    process.exit(0);
  }

  console.error('\n[check-dashboard-routes] FAIL — pages link to missing routes:');

  // Group by missing file for clarity
  const byFile = {};
  for (const f of failures) {
    if (!byFile[f.missing_file]) byFile[f.missing_file] = [];
    byFile[f.missing_file].push(f.page);
  }
  for (const [file, pages] of Object.entries(byFile)) {
    console.error(`  MISSING: ${file}`);
    const uniq = [...new Set(pages)];
    for (const p of uniq) console.error(`    linked from: ${p}`);
  }

  console.error('\n  Fix: commit the missing directories or remove the links.');
  process.exit(1);
}

main();
