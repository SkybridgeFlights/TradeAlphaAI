'use strict';

function renderSiteHeader(options = {}) {
  const ar = options.locale === 'ar';
  const active = options.active || '';
  const languageHref = options.languageHref || (ar ? '/' : '/ar/');
  const homeHref = ar ? '/ar/' : '/';
  const links = ar ? arabicLinks() : englishLinks();
  const nav = links.map((item) => renderNavItem(item, active)).join('\n          ');

  return `<div class="topbar" data-global-header="homepage" data-active-section="${escapeHtml(active)}">
    <div class="wrap topbar-inner">
      <a class="brand" href="${homeHref}">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy">
          <strong>TradeAlpha AI</strong>
          <span>${ar ? '&#1605;&#1606;&#1589;&#1577; &#1575;&#1604;&#1578;&#1583;&#1575;&#1608;&#1604; &#1608;&#1571;&#1576;&#1581;&#1575;&#1579; &#1575;&#1604;&#1587;&#1608;&#1602;' : 'TRADING &amp; MARKET RESEARCH PLATFORM'}</span>
        </span>
      </a>

      <div class="top-actions">
        <nav class="nav-group" aria-label="${ar ? '&#1575;&#1604;&#1578;&#1606;&#1602;&#1604; &#1575;&#1604;&#1585;&#1574;&#1610;&#1587;&#1610;' : 'Primary'}">
          ${nav}
        </nav>
        <a href="https://t.me/TradeAlphaSignals_bot" target="_blank" rel="noopener noreferrer" class="header-signal-cta">${ar ? '&#1573;&#1588;&#1575;&#1585;&#1575;&#1578; &#1605;&#1580;&#1575;&#1606;&#1610;&#1577;' : 'Free Signals'}</a>
        <div class="locale-links" aria-label="${ar ? '&#1575;&#1582;&#1578;&#1610;&#1575;&#1585; &#1575;&#1604;&#1604;&#1594;&#1577;' : 'Language'}">
          <a class="lang-switch" data-locale-route="ar" href="${ar ? escapeHtml(options.arabicHref || currentArabicHref(active)) : escapeHtml(languageHref)}">${ar ? '&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;' : 'Arabic'}</a>
          <a class="lang-switch" data-locale-route="en" href="${ar ? escapeHtml(languageHref) : escapeHtml(options.englishHref || currentEnglishHref(active))}">English</a>
        </div>
        <button class="mobile-menu-toggle" type="button" aria-label="${ar ? '&#1601;&#1578;&#1581; &#1575;&#1604;&#1602;&#1575;&#1574;&#1605;&#1577;' : 'Open menu'}" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>`;
}

function englishLinks() {
  return [
    { key: 'home', href: '/', label: 'Home' },
    { key: 'stocks', href: '/stocks.html', label: 'Global Stock Research' },
    { key: 'etfs', href: '/etfs.html', label: 'ETF Analyzer' },
    { key: 'screener', href: '/ai-stock-screener.html', label: 'Market Screener' },
    {
      key: 'rankings',
      href: '/rankings.html',
      label: 'Top Picks',
      badge: 'Hot',
      children: [
        ['/rankings.html#top-stocks', 'Top 10 Stocks Right Now'],
        ['/rankings.html#top-ai-stocks', 'Best AI Stocks'],
        ['/rankings.html#top-semiconductor-stocks', 'Best Semiconductor Stocks'],
        ['/rankings.html#top-growth-stocks', 'Best Growth Stocks'],
        ['/rankings.html#top-dividend-etfs', 'Top Dividend ETFs'],
        ['/rankings.html#top-broad-market-etfs', 'Best ETFs for 2026']
      ]
    },
    { key: 'insights', href: '/insights/', label: 'Articles' },
    { key: 'market-outlook', href: '/market-outlook/', label: 'Market Outlook' },
    { key: 'economic-calendar', href: '/economic-calendar/', label: 'Economic Calendar' },
    { key: 'methodology', href: '/methodology.html', label: 'Methodology' }
  ];
}

function arabicLinks() {
  return [
    { key: 'home', href: '/ar/', label: '&#1575;&#1604;&#1585;&#1574;&#1610;&#1587;&#1610;&#1577;' },
    { key: 'stocks', href: '/ar/stocks.html', label: '&#1576;&#1581;&#1579; &#1575;&#1604;&#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1593;&#1575;&#1604;&#1605;&#1610;' },
    { key: 'etfs', href: '/ar/etfs.html', label: '&#1605;&#1581;&#1604;&#1604; &#1589;&#1606;&#1575;&#1583;&#1610;&#1602; &#1575;&#1604;&#1605;&#1572;&#1588;&#1585;&#1575;&#1578;' },
    { key: 'screener', href: '/ar/ai-stock-screener.html', label: '&#1605;&#1575;&#1587;&#1581; &#1575;&#1604;&#1587;&#1608;&#1602;' },
    {
      key: 'rankings',
      href: '/ar/rankings.html',
      label: '&#1571;&#1601;&#1590;&#1604; &#1575;&#1604;&#1575;&#1582;&#1578;&#1610;&#1575;&#1585;&#1575;&#1578;',
      badge: '&#1585;&#1575;&#1574;&#1580;',
      children: [
        ['/ar/rankings.html#top-stocks', '&#1571;&#1601;&#1590;&#1604; 10 &#1571;&#1587;&#1607;&#1605; &#1581;&#1575;&#1604;&#1610;&#1575;&#1611;'],
        ['/ar/rankings.html#top-ai-stocks', '&#1571;&#1601;&#1590;&#1604; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610;'],
        ['/ar/rankings.html#top-semiconductors', '&#1571;&#1601;&#1590;&#1604; &#1571;&#1587;&#1607;&#1605; &#1571;&#1588;&#1576;&#1575;&#1607; &#1575;&#1604;&#1605;&#1608;&#1589;&#1604;&#1575;&#1578;'],
        ['/ar/rankings.html#top-growth-stocks', '&#1571;&#1601;&#1590;&#1604; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1606;&#1605;&#1608;'],
        ['/ar/rankings.html#top-dividend-etfs', '&#1571;&#1601;&#1590;&#1604; &#1589;&#1606;&#1575;&#1583;&#1610;&#1602; &#1578;&#1608;&#1586;&#1610;&#1593;&#1575;&#1578; &#1575;&#1604;&#1571;&#1585;&#1576;&#1575;&#1581;'],
        ['/ar/rankings.html#top-etfs', '&#1571;&#1601;&#1590;&#1604; &#1589;&#1606;&#1575;&#1583;&#1610;&#1602; &#1575;&#1604;&#1605;&#1572;&#1588;&#1585;&#1575;&#1578; &#1604;&#1593;&#1575;&#1605; 2026']
      ]
    },
    { key: 'insights', href: '/ar/insights/', label: 'المقالات' },
    { key: 'market-outlook', href: '/ar/market-outlook/', label: '&#1578;&#1608;&#1602;&#1593;&#1575;&#1578; &#1575;&#1604;&#1587;&#1608;&#1602;' },
    { key: 'economic-calendar', href: '/ar/economic-calendar/', label: '&#1575;&#1604;&#1578;&#1602;&#1608;&#1610;&#1605; &#1575;&#1604;&#1575;&#1602;&#1578;&#1589;&#1575;&#1583;&#1610;' },
    { key: 'methodology', href: '/ar/methodology.html', label: '&#1575;&#1604;&#1605;&#1606;&#1607;&#1580;&#1610;&#1577;' }
  ];
}

function renderNavItem(item, active) {
  const activeClass = item.key === active ? ' is-active' : '';
  const current = item.key === active ? ' aria-current="page"' : '';
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

function currentEnglishHref(active) {
  const item = englishLinks().find((entry) => entry.key === active);
  return item ? item.href : '/';
}

function currentArabicHref(active) {
  const item = arabicLinks().find((entry) => entry.key === active);
  return item ? item.href : '/ar/';
}

function renderSiteFooter(options = {}) {
  const ar = options.locale === 'ar';
  const year = new Date().getUTCFullYear();
  return `<footer class="site-footer">
  <div class="wrap site-footer-inner">
    <div><strong>TradeAlpha AI</strong><p>${ar ? '&#1571;&#1576;&#1581;&#1575;&#1579; &#1605;&#1575;&#1604;&#1610;&#1577; &#1578;&#1593;&#1604;&#1610;&#1605;&#1610;&#1577; &#1608;&#1594;&#1610;&#1585; &#1575;&#1587;&#1578;&#1588;&#1575;&#1585;&#1610;&#1577;.' : 'Educational, non-advisory financial research.'}</p></div>
    <nav aria-label="${ar ? '&#1585;&#1608;&#1575;&#1576;&#1591; &#1575;&#1604;&#1578;&#1584;&#1610;&#1610;&#1604;' : 'Footer navigation'}">
      <a href="${ar ? '/ar/insights/' : '/insights/'}">${ar ? '&#1575;&#1604;&#1605;&#1602;&#1575;&#1604;&#1575;&#1578;' : 'Articles'}</a>
      <a href="${ar ? '/ar/market-outlook/' : '/market-outlook/'}">${ar ? '&#1578;&#1608;&#1602;&#1593;&#1575;&#1578; &#1575;&#1604;&#1587;&#1608;&#1602;' : 'Market Outlook'}</a>
      <a href="${ar ? '/ar/economic-calendar/' : '/economic-calendar/'}">${ar ? '&#1575;&#1604;&#1578;&#1602;&#1608;&#1610;&#1605;' : 'Economic Calendar'}</a>
      <a href="${ar ? '/ar/methodology.html' : '/methodology.html'}">${ar ? '&#1575;&#1604;&#1605;&#1606;&#1607;&#1580;&#1610;&#1577;' : 'Methodology'}</a>
    </nav>
    <small>&copy; ${year} TradeAlphaAI</small>
  </div>
</footer>`;
}

function globalLayoutHead() {
  return '<link rel="stylesheet" href="/css/global-layout.css" />';
}

function globalLayoutScripts() {
  return '<script src="/js/mobile-nav.js" defer></script>';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const { renderGlobalHeader, globalHeaderHead, globalHeaderScripts } = require('./render-global-header');

function renderSiteHeaderCompat(options = {}) {
  return renderGlobalHeader({
    locale: options.locale,
    activePage: options.active || options.activePage || '',
    basePath: options.basePath || ''
  });
}

module.exports = {
  globalLayoutHead,
  globalLayoutScripts,
  renderSiteFooter,
  renderSiteHeader: renderSiteHeaderCompat
};
