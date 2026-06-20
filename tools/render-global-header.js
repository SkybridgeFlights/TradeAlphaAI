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
  const ctaText   = ar ? 'موجزات السوق' : 'Market Briefs';
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

function globalHeaderStyles() {
  return '<link rel="stylesheet" href="/css/global-header-canonical.css" />';
}

function globalHeaderHead() {
  return globalHeaderStyles();
}

function globalHeaderScripts() {
  return '<script src="/js/global-header.js" defer></script>';
}

function englishLinks() {
  return [
    { key: 'home',              href: '/',                       label: 'Home' },
    { key: 'stocks',            href: '/stocks.html',            label: 'Stocks' },
    { key: 'etfs',              href: '/etfs.html',              label: 'ETFs' },
    { key: 'screener',          href: '/ai-stock-screener.html', label: 'Screener' },
    {
      key: 'rankings', href: '/rankings.html', label: 'Rankings',
      children: [
        ['/rankings.html#top-stocks', 'Stock Rankings'],
        ['/rankings.html#top-ai-stocks', 'AI Leadership'],
        ['/rankings.html#top-semiconductor-stocks', 'Semiconductor Leadership'],
        ['/rankings.html#top-growth-stocks', 'Growth Stocks'],
        ['/rankings.html#top-dividend-etfs', 'Dividend ETFs'],
        ['/rankings.html#top-broad-market-etfs', 'Broad-Market ETFs']
      ]
    },
    {
      key: 'research',
      href: '/intelligence/',
      label: 'Market Intelligence',
      activeKeys: ['intelligence', 'articles', 'insights', 'market-news', 'market-structure', 'market-outlook', 'briefs', 'market-terminal', 'market-regime', 'markets', 'sectors', 'equities', 'relative-rankings', 'market-map', 'explorer', 'workspace', 'account'],
      children: [
        ['/market-terminal/', 'Market Terminal'],
        ['/explorer/', 'Explorer'],
        ['/explorer/events/', 'Event Explorer'],
        ['/explorer/entity/', 'Entity Explorer'],
        ['/explorer/research/', 'Research Explorer'],
        ['/explorer/network/', 'Network Explorer'],
        ['/explorer/search/', 'Search Explorer'],
        ['/workspace/', 'Workspace'],
        ['/workspace/watchlists/', 'Watchlists'],
        ['/workspace/monitoring/', 'Monitoring'],
        ['/workspace/research/', 'Workspace Research'],
        ['/workspace/regime/', 'Regime Monitoring'],
        ['/market-regime/', 'Market Regime'],
        ['/rankings/', 'Relative Rankings'],
        ['/etfs/', 'ETF Intelligence'],
        ['/research/etfs/', 'ETF Research'],
        ['/market-map/etfs/', 'ETF Map'],
        ['/market-news/', 'Market News'],
        ['/market-structure/', 'Market Structure'],
        ['/market-outlook/', 'Market Outlook'],
        ['/markets/', 'Assets'],
        ['/sectors/', 'Sectors'],
        ['/equities/', 'Equities'],
        ['/briefs/', 'Market Briefs'],
        ['/articles/', 'Educational Articles'],
        ['/insights/', 'Applied Research'],
        ['/market-map/assets/', 'Asset Map'],
        ['/market-map/sectors/', 'Sector Map'],
        ['/market-map/equities/', 'Equity Map'],
        ['/market-map/regime/', 'Regime Map'],
        ['/market-map/network/', 'Network Map'],
        ['/market-map/history/', 'History Map'],
        ['/research/', 'Research Hub'],
        ['/research/feed/', 'Research Feed'],
        ['/research/regime/', 'Regime Research'],
        ['/research/assets/', 'Assets Research'],
        ['/research/sectors/', 'Sectors Research'],
        ['/research/equities/', 'Equities Research'],
        ['/research/history/', 'Research History'],
        ['/changes/', 'Changes Hub'],
        ['/changes/assets/', 'Asset Changes'],
        ['/changes/sectors/', 'Sector Changes'],
        ['/changes/equities/', 'Equity Changes'],
        ['/changes/etfs/', 'ETF Changes'],
        ['/changes/regime/', 'Regime Changes'],
        ['/changes/history/', 'Change Timeline'],
        ['/account/', 'Account Overview'],
        ['/account/watchlists/', 'Account Watchlists'],
        ['/account/preferences/', 'Account Preferences'],
        ['/account/alerts/', 'Account Alerts'],
        ['/account/workspace/', 'Account Workspace'],
        ['/account/sign-in/', 'Sign In'],
        ['/account/sign-up/', 'Sign Up'],
        ['/account/profile/', 'Account Profile']
      ]
    },
    { key: 'economic-calendar', href: '/economic-calendar/', label: 'Economic Calendar' },
    { key: 'methodology', href: '/methodology.html', label: 'Methodology' }
  ];
}

function arabicLinks() {
  return [
    { key: 'home',              href: '/ar/',                       label: 'الرئيسية' },
    { key: 'stocks',            href: '/ar/stocks.html',            label: 'الأسهم' },
    { key: 'etfs',              href: '/ar/etfs.html',              label: 'الصناديق' },
    { key: 'screener',          href: '/ar/ai-stock-screener.html', label: 'ماسح السوق' },
    {
      key: 'rankings', href: '/ar/rankings.html', label: 'التصنيفات',
      children: [
        ['/ar/rankings.html#top-stocks', 'تصنيف الأسهم'],
        ['/ar/rankings.html#top-ai-stocks', 'قيادة الذكاء الاصطناعي'],
        ['/ar/rankings.html#top-semiconductor-stocks', 'قيادة أشباه الموصلات'],
        ['/ar/rankings.html#top-growth-stocks', 'أسهم النمو'],
        ['/ar/rankings.html#top-dividend-etfs', 'صناديق التوزيعات'],
        ['/ar/rankings.html#top-broad-market-etfs', 'صناديق السوق الواسع']
      ]
    },
    {
      key: 'research',
      href: '/ar/intelligence/',
      label: 'الأسواق والأبحاث',
      activeKeys: ['intelligence', 'articles', 'insights', 'market-news', 'market-structure', 'market-outlook', 'briefs', 'market-terminal', 'market-regime', 'markets', 'sectors', 'equities', 'relative-rankings', 'market-map', 'explorer', 'workspace', 'account'],
      children: [
        ['/ar/market-terminal/', 'الطرفية المؤسسية'],
        ['/ar/explorer/', 'مستكشف الاستخبارات'],
        ['/ar/explorer/events/', 'مستكشف الأحداث'],
        ['/ar/explorer/entity/', 'مستكشف الكيانات'],
        ['/ar/explorer/research/', 'مستكشف الأبحاث'],
        ['/ar/explorer/network/', 'مستكشف الشبكة'],
        ['/ar/explorer/search/', 'مستكشف البحث'],
        ['/ar/workspace/', 'مساحة المتابعة'],
        ['/ar/workspace/watchlists/', 'قوائم المتابعة'],
        ['/ar/workspace/monitoring/', 'المتابعة'],
        ['/ar/workspace/research/', 'أبحاث المتابعة'],
        ['/ar/workspace/regime/', 'متابعة النظام'],
        ['/ar/market-regime/', 'نظام السوق'],
        ['/ar/rankings/', 'الترتيب النسبي'],
        ['/ar/etfs/', 'استخبارات الصناديق'],
        ['/ar/research/etfs/', 'أبحاث الصناديق'],
        ['/ar/market-map/etfs/', 'خريطة الصناديق'],
        ['/ar/market-news/', 'أخبار الأسواق'],
        ['/ar/market-structure/', 'بنية السوق'],
        ['/ar/market-outlook/', 'آفاق السوق'],
        ['/ar/markets/', 'الأصول'],
        ['/ar/sectors/', 'القطاعات'],
        ['/ar/equities/', 'الأسهم الفردية'],
        ['/ar/briefs/', 'إحاطات السوق'],
        ['/ar/articles/', 'المقالات التعليمية'],
        ['/ar/insights/', 'الأبحاث التطبيقية'],
        ['/ar/market-map/assets/', 'خريطة الأصول'],
        ['/ar/market-map/sectors/', 'خريطة القطاعات'],
        ['/ar/market-map/equities/', 'خريطة الأسهم'],
        ['/ar/market-map/regime/', 'خريطة نظام السوق'],
        ['/ar/market-map/network/', 'خريطة الشبكة'],
        ['/ar/market-map/history/', 'الخريطة التاريخية'],
        ['/ar/research/', 'مركز الأبحاث'],
        ['/ar/research/feed/', 'تغذية الأبحاث'],
        ['/ar/research/regime/', 'أبحاث النظام'],
        ['/ar/research/assets/', 'أبحاث الأصول'],
        ['/ar/research/sectors/', 'أبحاث القطاعات'],
        ['/ar/research/equities/', 'أبحاث الأسهم'],
        ['/ar/research/history/', 'سجل الأبحاث'],
        ['/ar/changes/', 'مركز التغيّرات'],
        ['/ar/changes/assets/', 'تغيّرات الأصول'],
        ['/ar/changes/sectors/', 'تغيّرات القطاعات'],
        ['/ar/changes/equities/', 'تغيّرات الأسهم'],
        ['/ar/changes/etfs/', 'تغيّرات الصناديق'],
        ['/ar/changes/regime/', 'تحوّلات النظام'],
        ['/ar/changes/history/', 'الجدول الزمني للتغيّرات'],
        ['/ar/account/', 'نظرة عامة على الحساب'],
        ['/ar/account/watchlists/', 'قوائم متابعة الحساب'],
        ['/ar/account/preferences/', 'تفضيلات الحساب'],
        ['/ar/account/alerts/', 'تنبيهات الحساب'],
        ['/ar/account/workspace/', 'مساحة عمل الحساب'],
        ['/ar/account/sign-in/', 'تسجيل الدخول'],
        ['/ar/account/sign-up/', 'إنشاء حساب'],
        ['/ar/account/profile/', 'الملف الشخصي للحساب']
      ]
    },
    { key: 'economic-calendar', href: '/ar/economic-calendar/', label: 'التقويم الاقتصادي' },
    { key: 'methodology', href: '/ar/methodology.html', label: 'المنهجية' }
  ];
}

function renderNavItem(item, active) {
  const isActive = item.key === active || (item.activeKeys || []).includes(active);
  const activeClass = isActive ? ' is-active' : '';
  const current = item.key === active ? ' aria-current="page"' : '';
  if (!item.children) {
    return `<a href="${item.href}" class="nav-link${activeClass}"${current}>${item.label}</a>`;
  }
  const badge = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
  return `<div class="nav-menu">
            <a href="${item.href}" class="nav-link nav-menu-trigger${activeClass}"${current}>${item.label}${badge}</a>
            <div class="nav-dropdown">
              ${item.children.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n              ')}
            </div>
          </div>`;
}

function counterpartEn(active) {
  const section = {
    articles: '/articles/',
    insights: '/insights/',
    'market-news': '/market-news/',
    'market-structure': '/market-structure/',
    'market-outlook': '/market-outlook/',
    'market-regime': '/market-regime/',
    explorer: '/explorer/',
    workspace: '/workspace/',
    briefs: '/briefs/',
    intelligence: '/intelligence/',
    'relative-rankings': '/rankings/',
    'economic-calendar': '/economic-calendar/'
  }[active];
  if (section) return section;
  const item = englishLinks().find((e) => e.key === active);
  return item ? item.href : '/';
}

function counterpartAr(active) {
  const section = {
    articles: '/ar/articles/',
    insights: '/ar/insights/',
    'market-news': '/ar/market-news/',
    'market-structure': '/ar/market-structure/',
    'market-outlook': '/ar/market-outlook/',
    'market-regime': '/ar/market-regime/',
    explorer: '/ar/explorer/',
    workspace: '/ar/workspace/',
    briefs: '/ar/briefs/',
    intelligence: '/ar/intelligence/',
    'relative-rankings': '/ar/rankings/',
    'economic-calendar': '/ar/economic-calendar/'
  }[active];
  if (section) return section;
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
  globalHeaderStyles,
  globalHeaderHead,
  globalHeaderScripts,
  MARKER_START,
  MARKER_END
};
