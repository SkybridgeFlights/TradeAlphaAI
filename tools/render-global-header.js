'use strict';

/**
 * Canonical global header renderer.
 * Export: renderGlobalHeader({ locale, activePage, basePath })
 *
 * locale    — 'en' | 'ar'
 * activePage — key string matching nav item keys (e.g. 'home', 'stocks', 'insights')
 * basePath  — unused, kept for API compat; all hrefs are absolute from site root
 *
 * Returns the complete header HTML including:
 *   <!-- GLOBAL_HEADER_START -->
 *   <div class="topbar" data-global-header ...>
 *   <!-- GLOBAL_HEADER_END -->
 *
 * Also exports:
 *   globalHeaderHead()    — <link> tag for global-header.css
 *   globalHeaderScripts() — <script> tag for mobile-nav.js
 */

const MARKER_START = '<!-- GLOBAL_HEADER_START -->';
const MARKER_END   = '<!-- GLOBAL_HEADER_END -->';

function renderGlobalHeader({ locale, activePage = '', basePath = '', arabicHref, englishHref } = {}) {
  const ar = locale === 'ar';
  const homeHref = ar ? '/ar/' : '/';
  const links = ar ? arabicLinks() : englishLinks();
  const nav = links.map((item) => renderNavItem(item, activePage)).join('\n          ');

  const subtitleText = ar
    ? 'منصّة التداول وأبحاث السوق'
    : 'TRADING &amp; MARKET RESEARCH PLATFORM';

  const navLabel  = ar ? 'التنقل الرئيسي' : 'Primary';
  const ctaText   = ar ? 'إشارات مجانية' : 'Free Signals';
  const langLabel = ar ? 'اختيار اللغة' : 'Language';
  const arText    = ar ? 'العربية' : 'Arabic';
  const menuLabel = ar ? 'فتح القائمة' : 'Open menu';

  const enHref = englishHref || counterpartEn(activePage);
  const arHref = arabicHref  || counterpartAr(activePage);

  const html = `${MARKER_START}
<div class="topbar" data-global-header data-locale="${ar ? 'ar' : 'en'}" data-active-section="${escapeHtml(activePage)}">
  <div class="wrap topbar-inner">
    <a class="brand" href="${homeHref}">
      <span class="brand-mark" aria-hidden="true"></span>
      <span class="brand-copy">
        <strong>TradeAlpha AI</strong>
        <span>${subtitleText}</span>
      </span>
    </a>

    <div class="top-actions">
      <nav class="nav-group" aria-label="${navLabel}">
        ${nav}
      </nav>
      <a href="https://t.me/TradeAlphaSignals_bot" target="_blank" rel="noopener noreferrer" class="header-signal-cta">${ctaText}</a>
      <div class="locale-links" aria-label="${langLabel}">
        <a class="lang-switch" data-locale-route="ar" href="${escapeHtml(arHref)}">${arText}</a>
        <a class="lang-switch" data-locale-route="en" href="${escapeHtml(enHref)}">English</a>
      </div>
      <button class="mobile-menu-toggle" type="button" aria-label="${menuLabel}" aria-expanded="false" aria-controls="mobile-nav-drawer">
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
        <span aria-hidden="true"></span>
      </button>
    </div>
  </div>
</div>
${MARKER_END}`;

  return html;
}

function globalHeaderHead() {
  return '<link rel="stylesheet" href="/css/global-header.css" />';
}

function globalHeaderScripts() {
  return '<script src="/js/global-header.js" defer></script>';
}

function englishLinks() {
  return [
    { key: 'home',              href: '/',                       label: 'Home' },
    { key: 'stocks',            href: '/stocks.html',            label: 'Global Stock Research' },
    { key: 'etfs',              href: '/etfs.html',              label: 'ETF Analyzer' },
    { key: 'screener',          href: '/ai-stock-screener.html', label: 'Market Screener' },
    {
      key: 'rankings', href: '/rankings.html', label: 'Top Picks', badge: 'Hot',
      children: [
        ['/rankings.html#top-stocks',          'Top 10 Stocks Right Now'],
        ['/rankings.html#top-ai-stocks',       'Best AI Stocks'],
        ['/rankings.html#top-semiconductor-stocks', 'Best Semiconductor Stocks'],
        ['/rankings.html#top-growth-stocks',   'Best Growth Stocks'],
        ['/rankings.html#top-dividend-etfs',   'Top Dividend ETFs'],
        ['/rankings.html#top-broad-market-etfs','Best ETFs for 2026']
      ]
    },
    { key: 'insights',          href: '/insights/',              label: 'Articles' },
    { key: 'market-outlook',    href: '/market-outlook/',        label: 'Market Outlook' },
    { key: 'economic-calendar', href: '/economic-calendar/',     label: 'Economic Calendar' },
    { key: 'methodology',       href: '/methodology.html',       label: 'Methodology' }
  ];
}

function arabicLinks() {
  return [
    { key: 'home',              href: '/ar/',                       label: 'الرئيسية' },
    { key: 'stocks',            href: '/ar/stocks.html',            label: 'بحث الأسهم العالمي' },
    { key: 'etfs',              href: '/ar/etfs.html',              label: 'محلل صناديق المؤشرات' },
    { key: 'screener',          href: '/ar/ai-stock-screener.html', label: 'ماسح السوق' },
    {
      key: 'rankings', href: '/ar/rankings.html',
      label: 'أفضل الاختيارات',
      badge: 'رائج',
      children: [
        ['/ar/rankings.html#top-stocks',       'أفضل 10 أسهم حالياً'],
        ['/ar/rankings.html#top-ai-stocks',    'أفضل أسهم الذكاء الاصطناعي'],
        ['/ar/rankings.html#top-semiconductors','أفضل أسهم أشباه الموصلات'],
        ['/ar/rankings.html#top-growth-stocks', 'أفضل أسهم النمو'],
        ['/ar/rankings.html#top-dividend-etfs', 'أفضل صناديق توزيعات الأرباح'],
        ['/ar/rankings.html#top-etfs',          'أفضل صناديق المؤشرات لعام 2026']
      ]
    },
    { key: 'insights',          href: '/ar/insights/',              label: 'المقالات' },
    { key: 'market-outlook',    href: '/ar/market-outlook/',        label: 'توقعات السوق' },
    { key: 'economic-calendar', href: '/ar/economic-calendar/',     label: 'التقويم الاقتصادي' },
    { key: 'methodology',       href: '/ar/methodology.html',       label: 'المنهجية' }
  ];
}

function renderNavItem(item, active) {
  const isActive = item.key === active;
  const activeClass = isActive ? ' is-active' : '';
  const current = isActive ? ' aria-current="page"' : '';
  if (!item.children) {
    return `<a href="${item.href}" class="nav-link${activeClass}"${current}>${item.label}</a>`;
  }
  return `<div class="nav-menu">
            <a href="${item.href}" class="nav-link nav-menu-trigger${activeClass}"${current}>${item.label}<span class="nav-badge">${item.badge}</span></a>
            <div class="nav-dropdown">
              ${item.children.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n              ')}
            </div>
          </div>`;
}

function counterpartEn(active) {
  const item = englishLinks().find((e) => e.key === active);
  return item ? item.href : '/';
}

function counterpartAr(active) {
  const item = arabicLinks().find((e) => e.key === active);
  return item ? item.href : '/ar/';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

module.exports = {
  renderGlobalHeader,
  globalHeaderHead,
  globalHeaderScripts,
  MARKER_START,
  MARKER_END
};
