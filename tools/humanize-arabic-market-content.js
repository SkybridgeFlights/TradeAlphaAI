'use strict';

/**
 * humanize-arabic-market-content.js
 *
 * Post-processing pass that reduces AI-generated feel in Arabic market-outlook HTML.
 * All transformations are fully deterministic: same input → same output.
 *
 * Called from generate-market-outlook-draft.js after cleanArabicMarketCopy().
 */

// ── Deterministic hash ────────────────────────────────────────────────────────

function djb2(str, mod) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return Math.abs(h >>> 0) % mod;
}

function pick(pool, key) {
  return pool[djb2(String(key), pool.length)];
}

// ── Variation pools ───────────────────────────────────────────────────────────

const TRANSITIONS = [
  'في هذا السياق،',
  'انطلاقاً من هذا الإطار،',
  'بالنظر إلى المعطيات الراهنة،',
  'ضمن هذه الديناميكيات،',
  'على هذه الخلفية،',
  'بالتوازي مع ذلك،',
  'من هذا المنظور،',
  'وفي إطار هذه المعطيات،',
];

const MACRO_OPENINGS = [
  'تشير البيانات الكلية إلى',
  'يُلمح المشهد الاقتصادي إلى',
  'يعكس الإطار الكلي الحالي',
  'تُقدّم المؤشرات الاقتصادية',
  'تُظهر خلفية السوق الكلية',
  'يُشير التحليل الكلي إلى',
];

const RISK_OPENINGS = [
  'تجدر الإشارة إلى أن',
  'ينبغي مراعاة أن',
  'من المهم ملاحظة أن',
  'لا يمكن إغفال أن',
  'يستدعي الانتباه أن',
  'يبرز في هذا السياق أن',
];

const UNCERTAINTY_OPENINGS = [
  'في ظل عدم اليقين الراهن،',
  'في غياب توجيه حاسم،',
  'مع استمرار التذبذب،',
  'دون حسم واضح للاتجاه،',
  'رغم غموض المسار المقبل،',
  'في ظل تباين الإشارات،',
];

const IMPACT_POSITIVE_ALT = [
  'ينعكس إيجاباً على',
  'يُعزز مسار',
  'يدعم ديناميكية',
  'يُشكّل دفعة إيجابية لـ',
  'يصبّ في مصلحة',
];

const IMPACT_NEGATIVE_ALT = [
  'يُلقي بظلاله على',
  'يُثقل كاهل',
  'يُشكّل ضغطاً على',
  'يُضيّق هامش',
  'يُعيق مسار',
];

// ── Ticker reduction: after threshold, replace with context-aware generic label ──

const TICKER_REPLACEMENTS = {
  NVDA: ['الشركة', 'عملاق الرقائق', 'مزوّد العتاد'],
  AMD:  ['المنافس', 'الشركة', 'مُصنّع الرقائق'],
  QQQ:  ['الصندوق', 'أداة المتابعة', 'مرجع القطاع'],
  SOXX: ['الصندوق', 'أداة القطاع', 'مقياس القطاع'],
  XLK:  ['الصندوق', 'أداة التتبع', 'مرجع التكنولوجيا'],
  SPY:  ['الصندوق', 'المؤشر', 'مرجع السوق'],
  TLT:  ['الصندوق', 'أداة المدة', 'مرجع الخزينة'],
  SMH:  ['الصندوق', 'أداة القطاع', 'مرجع المجال'],
};
const TICKER_THRESHOLD = 3;

// Robotic phrases to vary (more than 1 occurrence triggers replacement of subsequent ones)
const ROBOTIC_PHRASE_POOLS = [
  {
    canonical: 'يُشير المشهد الحالي إلى',
    pool: MACRO_OPENINGS,
  },
  {
    canonical: 'يعكس المشهد الحالي',
    pool: MACRO_OPENINGS,
  },
  {
    canonical: 'تجدر الإشارة إلى أن',
    pool: RISK_OPENINGS,
  },
  {
    canonical: 'في ظل عدم اليقين',
    pool: UNCERTAINTY_OPENINGS,
  },
  {
    canonical: 'وفي هذا السياق،',
    pool: TRANSITIONS,
  },
  {
    canonical: 'في هذا الإطار،',
    pool: TRANSITIONS,
  },
];

// Disclaimer phrase patterns to deduplicate (keep first occurrence only)
const DISCLAIMER_DEDUP = [
  /(?:هذا التحليل عبارة عن تعليق تعليمي[^.]*\.[^.]*\.?\s*){2,}/g,
  /(?:ليست توصية استثمارية[^.]*\.\s*){2,}/g,
  /(?:لا يُعتبر نصيحة[^.]*\.\s*){2,}/g,
  /(?:ليست نصيحة مالية[^.]*\.\s*){2,}/g,
];

// ── Main export ───────────────────────────────────────────────────────────────

function humanizeArabicMarketContent(html) {
  let out = String(html || '');

  out = reduceTickerRepetition(out);
  out = varyImpactPhrases(out);
  out = varyRoboticPhrases(out);
  out = deduplicateDisclaimers(out);
  out = reduceRoboticSymmetry(out);

  return out;
}

// ── Transformations ───────────────────────────────────────────────────────────

function reduceTickerRepetition(html) {
  let out = html;
  for (const [ticker, replacements] of Object.entries(TICKER_REPLACEMENTS)) {
    // Match ticker as standalone word, not inside HTML attribute values
    const pattern = new RegExp(`(?<![="'\\w])${ticker}(?![\\w"'=])`, 'g');
    let count = 0;
    out = out.replace(pattern, (match) => {
      count++;
      if (count <= TICKER_THRESHOLD) return match;
      const idx = (count - TICKER_THRESHOLD - 1) % replacements.length;
      return replacements[idx];
    });
  }
  return out;
}

function varyImpactPhrases(html) {
  let out = html;
  let posCount = 0;
  let negCount = 0;

  // Vary "سيؤثر إيجابياً على" after first occurrence
  out = out.replace(/سيؤثر إيجابياً على/g, (match) => {
    posCount++;
    if (posCount === 1) return match;
    return pick(IMPACT_POSITIVE_ALT, `pos-${posCount}`) + ' ';
  });

  // Vary "سيؤثر سلبياً على" after first occurrence
  out = out.replace(/سيؤثر سلبياً على/g, (match) => {
    negCount++;
    if (negCount === 1) return match;
    return pick(IMPACT_NEGATIVE_ALT, `neg-${negCount}`) + ' ';
  });

  // Vary "ينعكس إيجاباً على" when repeated
  let posAlt = 0;
  out = out.replace(/ينعكس إيجاباً على/g, (match) => {
    posAlt++;
    if (posAlt === 1) return match;
    return pick(IMPACT_POSITIVE_ALT, `posalt-${posAlt}`);
  });

  return out;
}

function varyRoboticPhrases(html) {
  let out = html;

  for (const { canonical, pool } of ROBOTIC_PHRASE_POOLS) {
    const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, 'g');
    let count = 0;
    out = out.replace(re, (match, offset) => {
      count++;
      if (count === 1) return match;
      // Use canonical + count as hash key for stable output
      return pick(pool, canonical + count);
    });
  }

  return out;
}

function deduplicateDisclaimers(html) {
  let out = html;
  for (const pattern of DISCLAIMER_DEDUP) {
    out = out.replace(pattern, (match) => {
      // Keep only up to the first full sentence
      const firstSentence = match.match(/[^\n.!?]*[.!?]/);
      return firstSentence ? firstSentence[0] + ' ' : match;
    });
  }
  return out;
}

function reduceRoboticSymmetry(html) {
  let out = html;

  // Remove consecutive identical sentence structures: "X يرتبط بـ Y. Z يرتبط بـ W."
  // This is a light pass - only handle clear patterns without complex parsing
  out = out.replace(/(يرتبط بـ [^.]+\.\s*){3,}/g, (match) => {
    const parts = match.split(/(?<=\.)\s+/);
    return parts.slice(0, 2).join(' ') + ' ';
  });

  // Reduce sequences of "يُعدّ X مهماً. يُعدّ Y مهماً."
  out = out.replace(/(يُعدّ [^.]+مهماً\.\s*){2,}/g, (match) => {
    const parts = match.split(/(?<=\.)\s+/);
    return parts.slice(0, 1).join(' ') + ' ';
  });

  // Soften over-repeated "تعليمي فقط" when it appears in close proximity
  let eduCount = 0;
  out = out.replace(/تعليمي فقط/g, (match) => {
    eduCount++;
    if (eduCount === 1) return match;
    if (eduCount === 2) return 'للتعليم والتوعية فقط';
    return 'تعليمي';
  });

  return out;
}

module.exports = { humanizeArabicMarketContent };

// ── CLI mode ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const fs   = require('fs');
  const path = require('path');
  const args = process.argv.slice(2);

  if (!args.length) {
    console.error('Usage: node tools/humanize-arabic-market-content.js <file.html> [--write]');
    process.exit(1);
  }

  const file  = path.resolve(args[0]);
  const write = args.includes('--write');
  const html  = fs.readFileSync(file, 'utf8');
  const clean = humanizeArabicMarketContent(html);
  const changed = clean !== html;

  if (write) {
    if (changed) { fs.writeFileSync(file, clean, 'utf8'); console.log(`Humanized: ${file}`); }
    else console.log(`No changes needed: ${file}`);
  } else {
    console.log(changed ? `Would change content in ${file}` : `No changes needed: ${file}`);
  }
}
