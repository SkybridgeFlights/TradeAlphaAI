'use strict';

/**
 * clean-arabic-market-copy.js
 *
 * Post-processing pass for Arabic market-outlook HTML.
 * Replaces unnatural or over-cautious Arabic label strings with
 * cleaner editorial equivalents before the file is written to disk.
 *
 * Called from generate-market-outlook-draft.js:
 *   const { cleanArabicMarketCopy } = require('./clean-arabic-market-copy');
 *   const arHtml = cleanArabicMarketCopy(rawArHtml);
 */

const REPLACEMENTS = [
  // Unnatural label → cleaner equivalent
  ['طبقة الاستخبارات', 'إطار التحليل'],
  ['استمرارية السرد', 'استمرارية السياق'],
  ['التسلسل الكلي المرتبط', 'ترابط المؤشرات الكلية'],
  ['سياق التباعد', 'مؤشرات التباين'],
  ['لقطة استخباراتية للسوق', 'نظرة تحليلية للسوق'],
  ['ترتبط هذه المقالة بطبقة الاستخبارات الكلية', 'يرتبط هذا التقرير بإطار التحليل الكلي'],
];

// Repeated disclaimers to deduplicate (keep only first occurrence)
const DEDUP_PATTERNS = [
  /(?:وليست? توصية استثمارية[^.]*\.\s*){2,}/g,
  /(?:لا يُعتبر نصيحة[^.]*\.\s*){2,}/g,
];

function cleanArabicMarketCopy(html) {
  let out = String(html || '');

  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to);
  }

  for (const pattern of DEDUP_PATTERNS) {
    out = out.replace(pattern, (match) => {
      const first = match.match(/[^.]+\.[^.]*\./);
      return first ? first[0] + ' ' : match;
    });
  }

  return out;
}

module.exports = { cleanArabicMarketCopy };

if (require.main === module) {
  const fs   = require('fs');
  const path = require('path');
  const args = process.argv.slice(2);

  if (!args.length) {
    console.error('Usage: node tools/clean-arabic-market-copy.js <file.html> [--write]');
    process.exit(1);
  }

  const file  = path.resolve(args[0]);
  const write = args.includes('--write');
  const html  = fs.readFileSync(file, 'utf8');
  const clean = cleanArabicMarketCopy(html);
  const changed = (clean !== html);

  if (write) {
    if (changed) { fs.writeFileSync(file, clean, 'utf8'); console.log(`Cleaned: ${file}`); }
    else console.log(`No changes: ${file}`);
  } else {
    if (changed) {
      const diffs = REPLACEMENTS.filter(([from]) => html.includes(from)).map(([from, to]) => `  "${from}" → "${to}"`);
      console.log(`Would change ${diffs.length} pattern(s) in ${file}:\n${diffs.join('\n')}`);
    } else {
      console.log(`No changes needed: ${file}`);
    }
  }
}
