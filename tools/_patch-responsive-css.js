'use strict';
// One-time patch: inject /css/responsive.css into every HTML page that doesn't already have it.
// Run: node tools/_patch-responsive-css.js
// Safe to run multiple times — skips pages that already have it.

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INJECT = '  <link rel="stylesheet" href="/css/responsive.css" />';
const MARKER = '/css/responsive.css';

// Directories to patch
const SCAN_DIRS = [
  '.',               // root HTML (index.html, stocks.html, etc.)
  'insights',
  'ar/insights',
  'en/insights',
  'market-outlook',
  'ar/market-outlook',
  'en/market-outlook',
  'economic-calendar',
  'ar/economic-calendar',
];

// Directories to skip within root-level scan
const SKIP_NAMES = new Set(['node_modules', 'drafts', '.git', 'tools', 'data', 'js', 'fonts', 'Image', 'icons', 'css']);

let patched = 0;
let skipped = 0;

for (const dir of SCAN_DIRS) {
  const absDir = path.join(ROOT, dir);
  if (!fs.existsSync(absDir)) continue;
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    // Skip inner dirs when scanning root
    if (dir === '.' && SKIP_NAMES.has(entry.name.split('/')[0])) continue;
    const file = path.join(absDir, entry.name);
    patchFile(file);
  }
}

console.log(`Patched: ${patched} files, skipped (already had it): ${skipped} files`);

function patchFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(MARKER)) { skipped++; return; }

  // Inject before </head>
  if (!content.includes('</head>')) {
    console.warn(`  SKIP (no </head>): ${path.relative(ROOT, file)}`);
    return;
  }
  content = content.replace('</head>', `${INJECT}\n</head>`);
  fs.writeFileSync(file, content, 'utf8');
  patched++;
  console.log(`  Patched: ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
}
