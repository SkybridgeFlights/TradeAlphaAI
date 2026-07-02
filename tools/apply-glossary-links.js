#!/usr/bin/env node
'use strict';

// Internal linking pass: scans content pages and links the first mention of
// each glossary term to /glossary/{slug}.html (or /ar/glossary/... for AR
// pages). Boosts crawl efficiency, dwell time, and topical authority signals.
//
// Design rules (kept conservative to avoid link spam or false positives):
//   - Only touches text inside <p class="market-copy">...</p> paragraphs.
//     The site uses this class site-wide for article body copy, so limiting
//     to it avoids matching titles, breadcrumbs, meta, or component chrome.
//   - Skips paragraphs that already contain an <a> — never doubles up.
//   - Only the FIRST mention of each term per page is linked. Max 5 links
//     per page total, so a keyword-dense article does not become a hyperlink
//     forest.
//   - Uses word-boundary matching. Generic short terms (alpha, beta, bond)
//     are omitted from the alias table because false positives outweigh SEO
//     value ("beta" matches inside "database", etc.).
//   - Adds a per-version marker so subsequent runs (with new terms) can
//     re-scan the pages cleanly without duplicating existing links.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'data', 'glossary-terms.json');

const VERSION = 'v1';
const MARKER_RE = /<!-- GLOSSARY_LINKS:[^>]+ -->/g;

const MAX_LINKS_PER_PAGE = 5;

// Alias table — only distinctive, unambiguous phrases. Short/ambiguous
// single-word terms are intentionally NOT auto-linked here (they can still
// be manually linked by editors).
const TERM_ALIASES_EN = {
  'etf': ['exchange-traded fund', 'exchange-traded funds', 'ETFs', 'ETF'],
  'pe-ratio': ['price-to-earnings ratio', 'P/E ratio', 'PE ratio'],
  'sharpe-ratio': ['Sharpe ratio'],
  'market-cap': ['market capitalization', 'market cap'],
  'yield-curve': ['yield curve'],
  'dividend-yield': ['dividend yield'],
  'volatility': ['implied volatility', 'realized volatility'],
  'inflation': ['inflation'],
  'diversification': ['diversification'],
  'compound-interest': ['compound interest'],
  'bull-market': ['bull market'],
  'bear-market': ['bear market'],
  'ipo': ['initial public offering', 'IPO'],
  'short-selling': ['short selling', 'short sale'],
  'moving-average': ['moving average'],
  'rsi': ['Relative Strength Index', 'RSI'],
  'ebitda': ['EBITDA'],
  'free-cash-flow': ['free cash flow', 'FCF'],
  'roe': ['return on equity', 'ROE'],
  'bid-ask-spread': ['bid-ask spread', 'bid/ask spread'],
  'call-option': ['call option'],
  'put-option': ['put option'],
  'recession': ['recession'],
  'stock-split': ['stock split'],
  'dividend': ['dividend payments', 'dividend payment', 'dividends']
};

const TERM_ALIASES_AR = {
  'etf': ['صناديق ETF', 'صندوق ETF', 'صناديق المؤشرات المتداولة'],
  'pe-ratio': ['نسبة السعر إلى الأرباح', 'نسبة P/E', 'مضاعف الربحية'],
  'sharpe-ratio': ['نسبة شارب'],
  'market-cap': ['القيمة السوقية'],
  'yield-curve': ['منحنى العائد'],
  'dividend-yield': ['عائد الأرباح'],
  'volatility': ['التقلب الضمني', 'التقلب المحقق'],
  'inflation': ['التضخم'],
  'diversification': ['التنويع'],
  'compound-interest': ['الفائدة المركبة'],
  'bull-market': ['السوق الصاعد'],
  'bear-market': ['السوق الهابط'],
  'ipo': ['الطرح العام الأولي'],
  'short-selling': ['البيع على المكشوف'],
  'moving-average': ['المتوسط المتحرك'],
  'rsi': ['مؤشر القوة النسبية'],
  'ebitda': ['EBITDA'],
  'free-cash-flow': ['التدفق النقدي الحر'],
  'roe': ['العائد على حقوق الملكية'],
  'bid-ask-spread': ['فارق العرض والطلب'],
  'call-option': ['خيار الشراء'],
  'put-option': ['خيار البيع'],
  'recession': ['الركود الاقتصادي', 'الركود'],
  'stock-split': ['تجزئة السهم'],
  'dividend': ['توزيعات الأرباح']
};

// Content roots we touch. Only bodies with <p class="market-copy"> matter —
// but we intentionally do NOT touch glossary pages themselves (self-link) or
// dashboards/workspace/account.
const CONTENT_DIRS = [
  'insights', 'ar/insights', 'en/insights',
  'market-outlook', 'ar/market-outlook', 'en/market-outlook',
  'intelligence', 'ar/intelligence', 'en/intelligence',
  'market-news', 'ar/market-news',
  'market-structure', 'ar/market-structure',
  'articles', 'ar/articles',
  'briefs', 'ar/briefs'
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readTerms() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).terms || [];
}

function buildAliasMap(isAr) {
  const src = isAr ? TERM_ALIASES_AR : TERM_ALIASES_EN;
  // Flatten to [{alias, slug}], sort by length desc so longer matches take
  // precedence ("dividend yield" beats "dividend").
  const pairs = [];
  for (const slug of Object.keys(src)) {
    for (const alias of src[slug]) pairs.push({ alias, slug });
  }
  pairs.sort((a, b) => b.alias.length - a.alias.length);
  return pairs;
}

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => path.join(abs, f));
}

function detectArabic(file, html) {
  if (file.includes(`${path.sep}ar${path.sep}`)) return true;
  const htmlOpen = html.match(/<html\b[^>]*>/i);
  if (!htmlOpen) return false;
  return /\blang=["']ar/i.test(htmlOpen[0]) || /\bdir=["']rtl/i.test(htmlOpen[0]);
}

function linkifyParagraph(paragraphText, aliases, usedSlugs, isAr, remainingBudget) {
  // Skip if this paragraph already contains any anchor. Prevents double-linking
  // and preserves any manual editorial links.
  if (/<a\b/i.test(paragraphText)) return { text: paragraphText, added: 0 };

  let text = paragraphText;
  let added = 0;
  const glossaryBase = isAr ? '/ar/glossary' : '/glossary';

  for (const { alias, slug } of aliases) {
    if (usedSlugs.has(slug)) continue;
    if (added >= remainingBudget) break;

    // Case-insensitive match with word boundaries. \b behaves oddly with
    // Arabic + punctuation, so we use explicit lookaround for non-letter
    // neighbors on both sides.
    const re = new RegExp(`(^|[^A-Za-z0-9\\u0600-\\u06FF])(${escapeRegex(alias)})(?![A-Za-z0-9\\u0600-\\u06FF])`, 'i');
    const m = text.match(re);
    if (!m) continue;

    const before = text.slice(0, m.index) + m[1];
    const after = text.slice(m.index + m[0].length);
    const anchor = `<a class="glossary-link" href="${glossaryBase}/${slug}.html">${m[2]}</a>`;
    text = before + anchor + after;

    usedSlugs.add(slug);
    added++;
  }

  return { text, added };
}

function processFile(file, aliases) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return { skipped: true }; }

  const isAr = detectArabic(file, html);
  const localAliases = isAr ? aliases.ar : aliases.en;

  // Strip previous marker(s) so we can compute fresh state each run.
  html = html.replace(MARKER_RE, '');

  const usedSlugs = new Set();
  let totalAdded = 0;

  const newHtml = html.replace(/<p class="market-copy">([\s\S]*?)<\/p>/g, (full, inner) => {
    if (totalAdded >= MAX_LINKS_PER_PAGE) return full;
    const { text, added } = linkifyParagraph(inner, localAliases, usedSlugs, isAr, MAX_LINKS_PER_PAGE - totalAdded);
    if (added === 0) return full;
    totalAdded += added;
    return `<p class="market-copy">${text}</p>`;
  });

  if (totalAdded === 0) return { linked: 0 };

  // Persist marker so we know which slugs were auto-linked. Useful for debug
  // and lets us extend later without duplicating.
  const marker = `<!-- GLOSSARY_LINKS:${VERSION}:${[...usedSlugs].sort().join(',')} -->`;
  const withMarker = newHtml.replace(/<\/body>/i, `${marker}\n</body>`);

  fs.writeFileSync(file, withMarker, 'utf8');
  return { linked: totalAdded, slugs: [...usedSlugs] };
}

function main() {
  const terms = readTerms();
  if (!terms.length) { console.error('[glossary-links] no terms'); process.exit(1); }

  const aliases = { en: buildAliasMap(false), ar: buildAliasMap(true) };

  const seen = new Set();
  for (const dir of CONTENT_DIRS) {
    for (const f of listHtml(dir)) seen.add(f);
  }

  let filesProcessed = 0;
  let filesLinked = 0;
  let totalLinks = 0;
  for (const file of seen) {
    const r = processFile(file, aliases);
    filesProcessed++;
    if (r.linked && r.linked > 0) {
      filesLinked++;
      totalLinks += r.linked;
    }
  }

  console.log(`[glossary-links] version:         ${VERSION}`);
  console.log(`[glossary-links] max per page:    ${MAX_LINKS_PER_PAGE}`);
  console.log(`[glossary-links] EN aliases:      ${aliases.en.length}`);
  console.log(`[glossary-links] AR aliases:      ${aliases.ar.length}`);
  console.log(`[glossary-links] files scanned:   ${filesProcessed}`);
  console.log(`[glossary-links] files linked:    ${filesLinked}`);
  console.log(`[glossary-links] total links:     ${totalLinks}`);
}

if (require.main === module) main();

module.exports = { linkifyParagraph, buildAliasMap };
