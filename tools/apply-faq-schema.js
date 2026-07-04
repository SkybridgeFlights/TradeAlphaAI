#!/usr/bin/env node
'use strict';

// FAQPage JSON-LD injector.
//
// Compare pages (70 EN + 70 AR) render an FAQ section as <details>/<summary>
// pairs but never emitted FAQPage structured data — a missed rich-result
// opportunity in a site currently sitting at ~1% search CTR. This pass
// extracts the existing Q&A pairs from any page that has FAQ markup but no
// FAQPage schema and injects the JSON-LD idempotently (marker comment).
//
// Deliberately additive-only: pages that already declare FAQPage (articles,
// glossary, outlooks, stocks, hubs) are left untouched.
//
// Usage: node tools/apply-faq-schema.js [--dry-run]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const MARKER = '<!-- FAQ_SCHEMA:v1 -->';

const DIRS = ['compare', 'ar/compare', 'en/compare'];

function extractFaqPairs(html) {
  const pairs = [];
  const re = /<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(html))) {
    const q = clean(m[1]);
    const a = clean(m[2]);
    if (q && a) pairs.push([q, a]);
  }
  return pairs;
}

function clean(s) {
  return String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildJsonLd(pairs) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(([q, a]) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  });
}

let injected = 0;
let skipped = 0;

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const name of fs.readdirSync(abs)) {
    if (!name.endsWith('.html') || name === 'index.html') continue;
    const file = path.join(abs, name);
    let html = fs.readFileSync(file, 'utf8');

    // Strip a previous injection so re-runs refresh from current FAQ content.
    html = html.replace(new RegExp(`[ \\t]*${MARKER}\\s*<script type="application/ld\\+json">[\\s\\S]*?</script>[ \\t]*(?:\\r?\\n)?`), '');

    if (/"@type"\s*:\s*"FAQPage"/.test(html)) { skipped++; continue; } // native schema already present
    const pairs = extractFaqPairs(html);
    if (!pairs.length) { skipped++; continue; }

    const block = `  ${MARKER}\n  <script type="application/ld+json">${buildJsonLd(pairs)}</script>\n`;
    const out = html.replace('</head>', `${block}</head>`);
    if (out === html) { skipped++; continue; }
    if (!DRY) fs.writeFileSync(file, out, 'utf8');
    injected++;
  }
}

console.log(`[faq-schema] ${DRY ? '[dry-run] ' : ''}injected=${injected} skipped=${skipped}`);
