'use strict';

/**
 * market-outlook-post-processor.js
 *
 * Post-rendering passes applied to every generated market-outlook HTML page:
 *   1. Ticker suppression: caps mentions of watched tickers to TICKER_BODY_MAX
 *      by replacing excess occurrences with generic descriptive terms.
 *   2. (Future) Additional structural checks.
 *
 * Applied AFTER all rendering passes (AI content + AR localization transforms)
 * to avoid interfering with content generation quality.
 *
 * Used by: generate-market-outlook-draft.js, test-market-intelligence-quality-gates.js
 */

const TICKER_BODY_MAX = 5;

const EN_TICKER_SUBS = {
  NVDA: ['large AI infrastructure names', 'AI-linked semiconductor leaders', 'leading AI chip designers'],
  QQQ:  ['broad technology indices', 'tech-heavy index exposure', 'large-cap tech benchmarks'],
  AMD:  ['AI chip competitors', 'semiconductor peers', 'leading chip designers'],
  SOXX: ['semiconductor index benchmarks', 'chip sector ETFs'],
  XLK:  ['tech sector ETFs', 'technology weight benchmarks'],
  SPY:  ['broad market benchmarks', 'large-cap equity indices'],
  TLT:  ['long-duration Treasuries', 'rate-sensitive bond proxies'],
  SMH:  ['semiconductor ETFs', 'chip equipment indices'],
};

const AR_TICKER_SUBS = {
  NVDA: ['الأسماء الكبرى للبنية التحتية للذكاء الاصطناعي', 'رواد أشباه الموصلات المرتبطة بالذكاء الاصطناعي'],
  QQQ:  ['مؤشرات التقنية الواسعة', 'مؤشرات التقنية الكبرى'],
  AMD:  ['منافسو رقائق الذكاء الاصطناعي', 'أقران أشباه الموصلات'],
  SOXX: ['مؤشر أشباه الموصلات', 'صناديق قطاع الرقائق'],
  XLK:  ['صناديق القطاع التقني', 'مرجع وزن التقنية'],
  SPY:  ['المعايير السوقية الواسعة', 'مؤشرات السوق الرئيسية'],
  TLT:  ['سندات الخزانة طويلة الأجل', 'وكلاء السندات الحساسة للفائدة'],
  SMH:  ['صناديق أشباه الموصلات', 'مؤشرات معدات الرقائق'],
};

/**
 * Cap ticker mentions to TICKER_BODY_MAX in the rendered HTML.
 * Mirrors the counting logic in check-market-intelligence-quality.js:
 * script/style blocks are excluded; excess occurrences in body text are
 * replaced with locale-appropriate generic terms, cycling through the
 * replacements array.
 *
 * @param {string} html   - Fully rendered HTML string
 * @param {'en'|'ar'} locale
 * @returns {string} HTML with excess ticker mentions replaced
 */
function suppressExcessTickersInHtml(html, locale) {
  const subs = locale === 'ar' ? AR_TICKER_SUBS : EN_TICKER_SUBS;
  let result = html;
  for (const [ticker, replacements] of Object.entries(subs)) {
    const re = new RegExp(`\\b${ticker}\\b`, 'g');
    // Count in body text only (strip script/style blocks + tags, same as checker)
    const bodyText = result
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ');
    const bodyCount = (bodyText.match(re) || []).length;
    if (bodyCount <= TICKER_BODY_MAX) continue;
    result = _suppressTickerInHtml(result, re, replacements, TICKER_BODY_MAX);
  }
  return result;
}

/**
 * Replace occurrences of `re` beyond `keepMax` in non-script/style segments.
 * Script and style blocks are passed through unchanged.
 */
function _suppressTickerInHtml(html, re, replacements, keepMax) {
  // Split preserves the script/style blocks at odd indices
  const parts = html.split(/(<(?:script|style)[\s\S]*?<\/(?:script|style)>)/gi);
  let seen = 0;
  let subIdx = 0;
  for (let i = 0; i < parts.length; i += 2) { // even indices = non-block content
    parts[i] = parts[i].replace(re, (m) => {
      seen++;
      if (seen <= keepMax) return m;
      return replacements[(subIdx++) % replacements.length];
    });
  }
  return parts.join('');
}

module.exports = {
  suppressExcessTickersInHtml,
  TICKER_BODY_MAX,
  EN_TICKER_SUBS,
  AR_TICKER_SUBS,
};
