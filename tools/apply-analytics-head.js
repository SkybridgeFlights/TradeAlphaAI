#!/usr/bin/env node
'use strict';

// Inject Google Analytics 4 (gtag.js) snippet into every HTML page's <head>.
//
// Idempotent: marks each page with <!-- GA4_INSTALLED:G-XXXX --> after
// injection so subsequent runs skip cleanly. If you ever rotate the
// Measurement ID, bump GA4_ID below and the marker mismatch will trigger
// re-injection on the next workflow run.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GA4_ID = 'G-C8REB6WQP1';
const MARKER = `<!-- GA4_INSTALLED:${GA4_ID} -->`;

const SNIPPET = `${MARKER}
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA4_ID}', { anonymize_ip: true });
</script>
`;

// Directories to scan, recursively. Cover all public-facing surfaces.
const SCAN_DIRS = [
  '.',  // root-level *.html (index, stocks, etfs, rankings, etc.)
  'insights', 'ar/insights', 'en/insights',
  'market-outlook', 'ar/market-outlook', 'en/market-outlook',
  'intelligence', 'ar/intelligence', 'en/intelligence',
  'market-news', 'ar/market-news',
  'market-structure', 'ar/market-structure',
  'articles', 'ar/articles',
  'briefs', 'ar/briefs',
  'economic-calendar', 'ar/economic-calendar',
  'stocks', 'etfs', 'compare',
  'rankings', 'ar/rankings',
  'links', 'ar/links',
  'workspace', 'ar/workspace',
  'account', 'ar/account',
  'market-dashboard', 'ar/market-dashboard',
  'macro-dashboard', 'ar/macro-dashboard',
  'etf-dashboard', 'ar/etf-dashboard',
  'ar', 'en'
];

// Directories to SKIP even when reached by recursion.
const SKIP_DIRS = new Set(['node_modules', '.git', '.github', 'tools', 'data',
  'js', 'css', 'fonts', 'Image', 'icons', 'drafts', 'logs']);

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  const walk = (cur, depth = 0) => {
    if (depth > 6) return;
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(cur, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(full, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        out.push(full);
      }
    }
  };
  walk(abs);
  return out;
}

function injectInto(file) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return { skipped: true, reason: 'read_error' }; }

  // Already installed with current ID → nothing to do.
  if (html.includes(MARKER)) return { skipped: true, reason: 'already_installed' };

  // Strip any old marker with a different ID so we don't end up with two
  // gtag scripts after a rotation.
  html = html.replace(/<!-- GA4_INSTALLED:[^>]+ -->[\s\S]*?<\/script>\s*<script>[\s\S]*?gtag\('config'[^;]+;[\s\S]*?<\/script>\s*/g, '');

  // Find </head>, inject right before it.
  const headCloseIdx = html.search(/<\/head>/i);
  if (headCloseIdx === -1) return { skipped: true, reason: 'no_head_tag' };

  const before = html.slice(0, headCloseIdx);
  const after = html.slice(headCloseIdx);
  const updated = before + SNIPPET + after;
  fs.writeFileSync(file, updated, 'utf8');
  return { installed: true };
}

function relativize(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function main() {
  const seen = new Set();
  for (const dir of SCAN_DIRS) {
    for (const file of listHtml(dir)) seen.add(file);
  }
  const files = [...seen].sort();

  let installed = 0, skipped = 0, noHead = 0;
  for (const file of files) {
    const r = injectInto(file);
    if (r.installed) installed++;
    else if (r.reason === 'no_head_tag') { noHead++; }
    else { skipped++; }
  }

  console.log(`[analytics-head] GA4 ID: ${GA4_ID}`);
  console.log(`[analytics-head] scanned ${files.length} pages`);
  console.log(`[analytics-head] installed:        ${installed}`);
  console.log(`[analytics-head] already-present:  ${skipped}`);
  console.log(`[analytics-head] no <head> (skip): ${noHead}`);
}

if (require.main === module) main();

module.exports = { GA4_ID, MARKER, SNIPPET, injectInto };
