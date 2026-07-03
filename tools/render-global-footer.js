'use strict';

// Canonical global footer — the trust block every content page must carry.
//
// The visual-design audit (2026-07-03) found six page families shipping with
// NO footer at all (glossary, compare, newsletter, /links/, hub pages, stock
// pages) and several more missing the education/no-advice disclaimer. A
// professional research destination signals trust on every page: brand,
// navigation, disclaimer, copyright — identical everywhere.
//
// Same pattern as render-global-header.js: pure HTML emission wrapped in
// markers so apply-global-header.js can bake it idempotently site-wide.

const FOOTER_MARKER_START = '<!-- GLOBAL_FOOTER_START -->';
const FOOTER_MARKER_END = '<!-- GLOBAL_FOOTER_END -->';

const NAV_LINKS = {
  en: [
    ['/insights/', 'Research Library'],
    ['/market-outlook/', 'Market Outlook'],
    ['/market-news/', 'Market News'],
    ['/economic-calendar/', 'Economic Calendar'],
    ['/glossary/', 'Glossary'],
    ['/newsletter/', 'Newsletter'],
    ['/methodology.html', 'Methodology'],
  ],
  ar: [
    ['/ar/insights/', 'مكتبة الأبحاث'],
    ['/ar/market-outlook/', 'نظرة السوق'],
    ['/ar/market-news/', 'أخبار السوق'],
    ['/ar/economic-calendar/', 'المفكرة الاقتصادية'],
    ['/ar/glossary/', 'المصطلحات'],
    ['/ar/newsletter/', 'النشرة البريدية'],
    ['/ar/methodology.html', 'المنهجية'],
  ],
};

const COPY = {
  en: {
    tagline: 'Educational, non-advisory financial research and market intelligence.',
    disclaimer: 'All content on this site is educational research and market context — not investment advice, a recommendation, or a solicitation. Trading involves substantial risk of loss.',
    rights: 'All rights reserved.',
  },
  ar: {
    tagline: 'أبحاث مالية تعليمية وذكاء سوق — دون تقديم توصيات استثمارية.',
    disclaimer: 'كل محتوى هذا الموقع بحث تعليمي وسياق سوقي — وليس نصيحة استثمارية أو توصية أو دعوة للتداول. التداول ينطوي على مخاطر خسارة كبيرة.',
    rights: 'جميع الحقوق محفوظة.',
  },
};

function renderGlobalFooter(locale) {
  const ar = locale === 'ar';
  const t = COPY[ar ? 'ar' : 'en'];
  const links = NAV_LINKS[ar ? 'ar' : 'en']
    .map(([href, label]) => `      <a href="${href}">${label}</a>`)
    .join('\n');
  return `${FOOTER_MARKER_START}
<footer class="site-footer" data-global-footer>
  <div class="wrap site-footer-inner">
    <div>
      <strong>TradeAlpha AI</strong>
      <p>${t.tagline}</p>
    </div>
    <nav aria-label="${ar ? 'روابط تذييل الصفحة' : 'Footer navigation'}">
${links}
    </nav>
    <p class="site-footer-disclaimer">${t.disclaimer}</p>
    <small>&copy; ${new Date().getUTCFullYear()} TradeAlphaAI — ${t.rights}</small>
  </div>
</footer>
${FOOTER_MARKER_END}`;
}

function globalFooterStyles() {
  return '<link rel="stylesheet" href="/css/global-footer.css" />';
}

module.exports = { renderGlobalFooter, globalFooterStyles, FOOTER_MARKER_START, FOOTER_MARKER_END };
