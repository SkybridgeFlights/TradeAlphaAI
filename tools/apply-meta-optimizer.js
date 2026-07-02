#!/usr/bin/env node
'use strict';

// Meta title & description optimizer.
//
// Google SERPs truncate titles around ~60 chars and descriptions around ~155.
// Pages with titles that are too short lack keyword coverage; pages with
// titles that are too long get truncated. Descriptions under ~100 chars
// leave dead space; over ~170 get cut mid-sentence.
//
// This pass applies SAFE, conservative rewrites only:
//   1. Titles between 25-70 chars stay untouched (already near-optimal)
//   2. Titles under 25 chars get a benefit-clause appended, extracted from H1
//   3. Titles over 70 chars get intelligently trimmed at word boundaries
//   4. Descriptions under 100 chars get expanded from H1 + first market-copy
//   5. Descriptions over 170 chars trim at word boundary near 155
//   6. Year signal "(2026)" added ONLY to pages that lack a year and are the
//      right content type (comparisons, glossary, guides — not news/outlooks
//      which need to look time-fresh)
//
// A marker at the end of <head> tracks version so re-runs are idempotent
// and the rewrite dataset can be extended without duplicating fixes.
//
// Never touches:
//   - og:title / twitter:title (mirrors the page title, updated together)
//   - Pages the tool already processed at current version (marker match)
//   - Pages whose current title contains editorial signals suggesting a
//     human has already tuned it (specific years, [Guide], "Complete", etc.)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VERSION = 'v1';
const MARKER = `<!-- META_OPTIMIZED:${VERSION} -->`;
const CURRENT_YEAR = new Date().getUTCFullYear();

const DRY_RUN = process.argv.includes('--dry-run');

// Content roots we tune. Deliberately skips workspace / account / dashboard
// pages where meta text is intentionally functional, not SEO-driven.
const CONTENT_DIRS = [
  'insights', 'ar/insights', 'en/insights',
  'market-outlook', 'ar/market-outlook', 'en/market-outlook',
  'intelligence', 'ar/intelligence', 'en/intelligence',
  'market-news', 'ar/market-news',
  'market-structure', 'ar/market-structure',
  'articles', 'ar/articles',
  'briefs', 'ar/briefs',
  'compare', 'ar/compare',
  'glossary', 'ar/glossary',
  'stocks', 'etfs'
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html'))
    .map((f) => path.join(abs, f));
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : null;
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function encodeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Words that must never be the last token of a trimmed title/description.
// Ending on a preposition, article, or conjunction reads as a broken snippet
// in a SERP even when the letters technically fit the pixel budget.
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'for', 'nor', 'yet', 'so',
  'of', 'to', 'in', 'on', 'at', 'by', 'from', 'as', 'is', 'with',
  'that', 'this', 'these', 'those', 'it', 'its',
  'ال', 'في', 'من', 'إلى', 'على', 'مع', 'عن', 'و', 'أو'
]);

function trimAtWord(s, maxLen) {
  if (s.length <= maxLen) return s;
  let cut = s.slice(0, maxLen);
  let lastSpace = cut.lastIndexOf(' ');
  if (lastSpace <= maxLen * 0.7) return cut;
  cut = cut.slice(0, lastSpace);
  // Walk backwards over trailing stopwords and punctuation until we land on
  // a substantive word. Guards against "AAPL vs MSFT: comparison for" etc.
  for (let i = 0; i < 4; i++) {
    const trimmedPunct = cut.replace(/[,;:!?\-–—\s]+$/, '');
    const lastWord = trimmedPunct.split(/\s+/).pop() || '';
    if (!STOP_WORDS.has(lastWord.toLowerCase())) return trimmedPunct;
    const prevSpace = trimmedPunct.lastIndexOf(' ');
    if (prevSpace < 0) return trimmedPunct;
    cut = trimmedPunct.slice(0, prevSpace);
  }
  return cut;
}

function isArabic(s) {
  return /[؀-ۿ]/.test(s || '');
}

function hasYear(s) {
  return /\b(202[0-9])\b/.test(s || '');
}

function hasEditorialSignal(title) {
  // Human tuners tend to add these markers — respect them.
  return /\[Guide\]|Complete Guide|Deep Dive|\(202[0-9]\)|The Definitive|Ultimate/i.test(title);
}

// ── Rewrite rules ────────────────────────────────────────────────────────────

function improveTitle(current, h1, contentDir, isAr) {
  const decoded = decodeEntities(current);
  if (hasEditorialSignal(decoded)) return null;  // human-tuned, leave alone

  const len = decoded.length;
  // Wider "safe zone" — Google's actual truncation is pixel-based, so any
  // title 20-80 chars typically renders cleanly. Only rewrite outliers.
  if (len >= 20 && len <= 80 && hasYear(decoded)) return null;

  // Determine strategy by section
  const section = contentDir.replace(/^ar\//, '').replace(/^en\//, '');
  const brand = ' | TradeAlphaAI';

  // Strip existing brand suffix so we can re-append it cleanly
  const stripped = decoded.replace(/\s*\|\s*TradeAlphaAI(?:\s+Insights?)?\s*$/i, '').trim();

  let newBase;
  if (len < 20 && h1) {
    newBase = trimAtWord(h1, 55);
  } else if (len > 80) {
    // Only trim titles that genuinely exceed SERP budget. Preserve everything
    // meaningful — no fragment endings like "for" or "the".
    newBase = trimAtWord(stripped, 60);
    if (newBase.length < stripped.length * 0.5) return null;  // trim was too destructive
  } else if (!hasYear(decoded) && (section === 'compare' || section === 'glossary' || section === 'insights')) {
    // Add year signal to evergreen content only. News/outlooks are time-stamped.
    if (stripped.length + 7 > 65) return null;  // no room without pushing over budget
    newBase = `${stripped} (${CURRENT_YEAR})`;
  } else {
    return null;  // no change
  }

  const candidate = `${newBase}${brand}`;
  if (candidate === current || candidate === decoded) return null;
  // Guard: the rewrite must actually be an improvement in length distance from 55.
  const idealDist = (v) => Math.abs(v - 55);
  if (idealDist(candidate.length) >= idealDist(decoded.length)) return null;
  return candidate;
}

function improveDescription(current, h1, firstParagraph, isAr) {
  const decoded = decodeEntities(current || '');
  const len = decoded.length;

  // Safe zone widened to match real SERP truncation observation.
  if (len >= 90 && len <= 175) return null;

  if (len > 175) {
    const trimmed = trimAtWord(decoded, 155);
    if (trimmed.length < decoded.length * 0.7) return null;  // destructive
    const closing = /[.!?]$/.test(trimmed) ? '' : '.';
    return trimmed + closing;
  }

  if (len < 90 && firstParagraph) {
    // Extend with content-derived sentence, subject to length cap
    const seed = decoded.trim();
    const extra = firstParagraph.slice(0, 200);
    const joiner = seed && !/[.!?]$/.test(seed) ? '. ' : ' ';
    const extension = seed + joiner + extra;
    const trimmed = trimAtWord(extension, 155);
    if (trimmed.length <= len + 20) return null;  // not enough gain
    const closing = /[.!?]$/.test(trimmed) ? '' : '.';
    return trimmed + closing;
  }

  return null;
}

// ── Per-file processing ─────────────────────────────────────────────────────

function processFile(file) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return { skipped: 'read_error' }; }

  if (html.includes(MARKER)) return { skipped: 'already_processed' };

  const title = extract(html, /<title>([\s\S]*?)<\/title>/i);
  const desc = extract(html, /<meta\s+name="description"\s+content="([^"]*)"[^>]*>/i);
  const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const firstPara = extract(html, /<p class="market-copy">([\s\S]*?)<\/p>/i);

  if (!title) return { skipped: 'no_title' };

  const h1Clean = h1 ? decodeEntities(h1).replace(/<[^>]+>/g, '').trim() : '';
  const paraClean = firstPara ? decodeEntities(firstPara).replace(/<[^>]+>/g, '').trim() : '';
  const relative = path.relative(ROOT, file).replace(/\\/g, '/');
  const contentDir = relative.split('/')[0] === 'ar' || relative.split('/')[0] === 'en'
    ? relative.split('/').slice(0, 2).join('/')
    : relative.split('/')[0];
  const isAr = relative.startsWith('ar/') || isArabic(title);

  const newTitle = improveTitle(title, h1Clean, contentDir, isAr);
  const newDesc = improveDescription(desc, h1Clean, paraClean, isAr);

  if (!newTitle && !newDesc) return { skipped: 'no_change_needed' };

  let updated = html;

  if (newTitle) {
    updated = updated.replace(/<title>[\s\S]*?<\/title>/i, `<title>${encodeAttr(newTitle)}</title>`);
    // Mirror to OG + Twitter title (they should never diverge from page title).
    updated = updated.replace(/<meta\s+property="og:title"\s+content="[^"]*"([^>]*)>/i, `<meta property="og:title" content="${encodeAttr(newTitle)}"$1>`);
    updated = updated.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"([^>]*)>/i, `<meta name="twitter:title" content="${encodeAttr(newTitle)}"$1>`);
  }

  if (newDesc) {
    updated = updated.replace(/<meta\s+name="description"\s+content="[^"]*"([^>]*)>/i, `<meta name="description" content="${encodeAttr(newDesc)}"$1>`);
    updated = updated.replace(/<meta\s+property="og:description"\s+content="[^"]*"([^>]*)>/i, `<meta property="og:description" content="${encodeAttr(newDesc)}"$1>`);
    updated = updated.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"([^>]*)>/i, `<meta name="twitter:description" content="${encodeAttr(newDesc)}"$1>`);
  }

  // Append marker just before </head>
  updated = updated.replace(/<\/head>/i, `  ${MARKER}\n</head>`);

  if (!DRY_RUN) fs.writeFileSync(file, updated, 'utf8');

  return {
    changed: true,
    file: relative,
    titleBefore: title,
    titleAfter: newTitle,
    descBefore: desc,
    descAfter: newDesc
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const seen = new Set();
  for (const dir of CONTENT_DIRS) {
    for (const f of listHtml(dir)) seen.add(f);
  }

  const results = [];
  let scanned = 0, changed = 0, skipped = 0;
  for (const file of seen) {
    scanned++;
    const r = processFile(file);
    if (r.changed) { changed++; results.push(r); }
    else skipped++;
  }

  console.log(`[meta-opt] version:  ${VERSION}`);
  console.log(`[meta-opt] mode:     ${DRY_RUN ? 'DRY_RUN (no writes)' : 'APPLIED'}`);
  console.log(`[meta-opt] scanned:  ${scanned}`);
  console.log(`[meta-opt] changed:  ${changed}`);
  console.log(`[meta-opt] skipped:  ${skipped}`);

  // Print a small sample of diffs so the reader can spot-check.
  const sample = results.slice(0, 5);
  for (const r of sample) {
    console.log('\n----');
    console.log('file:', r.file);
    if (r.titleAfter) {
      console.log('  T-BEFORE:', r.titleBefore);
      console.log('  T-AFTER: ', r.titleAfter);
    }
    if (r.descAfter) {
      console.log('  D-BEFORE:', (r.descBefore || '').slice(0, 100));
      console.log('  D-AFTER: ', r.descAfter.slice(0, 100));
    }
  }
}

if (require.main === module) main();

module.exports = { improveTitle, improveDescription, processFile };
