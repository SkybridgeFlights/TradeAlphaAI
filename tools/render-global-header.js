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
  const nav = links.map((item) => renderNavItem(item, activePage, ar)).join('\n          ');

  const subtitleText = ar
    ? 'منصّة التداول وأبحاث السوق'
    : 'TRADING &amp; MARKET RESEARCH PLATFORM';

  const navLabel  = ar ? 'التنقل الرئيسي' : 'Primary';
  const ctaText   = ar ? 'موجزات السوق' : 'Market Briefs';
  const langLabel = ar ? 'اختيار اللغة' : 'Language';
  const arText    = ar ? 'العربية' : 'Arabic';
  const menuLabel = ar ? 'فتح القائمة' : 'Open menu';

  // Account header action — default "Sign in" link; JS swaps to UserButton
  // when Clerk loads + a session is active. Safe fallback when Clerk is
  // unavailable (the link remains useful).
  const signInLabel = ar ? 'تسجيل الدخول' : 'Sign in';
  const signInHref = ar ? '/ar/account/sign-in/' : '/account/sign-in/';
  const accountLabel = ar ? 'الحساب' : 'Account';
  const accountHref = ar ? '/ar/account/' : '/account/';

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
      <div class="header-account" data-account-action data-signed-in-label="${escapeHtml(accountLabel)}" data-signed-in-href="${escapeHtml(accountHref)}">
        <a class="header-account-link" data-account-default href="${escapeHtml(signInHref)}">
          <span class="header-account-icon" aria-hidden="true">${ACCOUNT_ICON_SVG}</span>
          <span class="header-account-label">${signInLabel}</span>
        </a>
        <div class="header-account-mount" data-account-mount hidden></div>
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

// Minimal inline user-circle icon — keeps the Account button visually
// anchored even before Clerk's UserButton image arrives.
const ACCOUNT_ICON_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';

function globalHeaderStyles() {
  return '<link rel="stylesheet" href="/css/global-header-canonical.css" />';
}

function globalHeaderHead() {
  return globalHeaderStyles();
}

function globalHeaderScripts() {
  // Phase 227 — register the service worker (PWA offline shell). The
  // service worker is the contract layer for push notifications; no
  // subscription is registered today. Manifest + theme are emitted via
  // the inline <link>/<meta> in the page <head> by page generators.
  //
  // Polish phase — also load Clerk config + bootstrap on every page so
  // the header Account action can detect the signed-in state platform-
  // wide (not just on /account/* surfaces). clerk-bootstrap.js is a
  // no-op when auth.mode !== 'hosted', so this is safe in all modes.
  return '<script src="/js/clerk-config.js"></script>'
    + '<script src="/js/clerk-bootstrap.js" defer></script>'
    + '<script src="/js/global-header.js" defer></script>'
    + '<script>if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); }); }</script>';
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
      // Mega-menu: 6 grouped columns instead of a 53-item flat list.
      // Each column has a title + 5-8 items. Renderer detects `groups`
      // and emits a multi-column dropdown.
      groups: [
        { title: 'Intelligence', items: [
          ['/market-terminal/', 'Market Terminal'],
          ['/market-regime/', 'Market Regime'],
          ['/rankings/', 'Rankings'],
          ['/market-map/assets/', 'Visual Maps'],
          ['/markets/', 'Assets'],
          ['/sectors/', 'Sectors'],
          ['/equities/', 'Equities'],
          ['/etfs/', 'ETFs'],
        ]},
        { title: 'Research', items: [
          ['/research/', 'Research Hub'],
          ['/research/feed/', 'Research Feed'],
          ['/research/regime/', 'Regime Research'],
          ['/research/assets/', 'Entity Research'],
          ['/research/etfs/', 'ETF Research'],
          ['/insights/', 'Applied Research'],
          ['/articles/', 'Educational Articles'],
        ]},
        { title: 'Changes', items: [
          ['/changes/', 'Changes Hub'],
          ['/changes/assets/', 'Asset Changes'],
          ['/changes/sectors/', 'Sector Changes'],
          ['/changes/equities/', 'Equity Changes'],
          ['/changes/etfs/', 'ETF Changes'],
          ['/changes/regime/', 'Regime Changes'],
          ['/changes/history/', 'Change History'],
        ]},
        { title: 'Explorer', items: [
          ['/explorer/', 'Explorer Home'],
          ['/explorer/events/', 'Event Explorer'],
          ['/explorer/entity/', 'Entity Explorer'],
          ['/explorer/network/', 'Network Explorer'],
          ['/explorer/research/', 'Research Explorer'],
          ['/explorer/search/', 'Search Explorer'],
        ]},
        { title: 'Workspace', items: [
          ['/workspace/', 'Workspace Home'],
          ['/workspace/watchlists/', 'Watchlists'],
          ['/workspace/monitoring/', 'Monitoring'],
          ['/workspace/research/', 'Workspace Research'],
          ['/workspace/regime/', 'Regime Monitoring'],
        ]},
        { title: 'Account', items: [
          ['/account/', 'Account Overview'],
          ['/account/profile/', 'Profile'],
          ['/account/preferences/', 'Preferences'],
          ['/account/watchlists/', 'My Watchlists'],
          ['/account/alerts/', 'Alerts'],
          ['/account/billing/', 'Billing'],
          ['/account/mobile/', 'Mobile App'],
        ]},
      ],
      // Secondary surfaces — kept reachable from the foot of the
      // mega-menu so existing internal links + sitemap surfaces are
      // never orphaned (e.g. market-news, market-structure, market-
      // outlook, market-map subviews, briefs, research history).
      footer: [
        { title: 'More Surfaces', items: [
          ['/market-news/', 'Market News'],
          ['/market-structure/', 'Market Structure'],
          ['/market-outlook/', 'Market Outlook'],
          ['/briefs/', 'Market Briefs'],
          ['/research/history/', 'Research History'],
          ['/market-map/regime/', 'Regime Map'],
          ['/market-map/network/', 'Network Map'],
          ['/market-map/history/', 'History Map'],
          ['/market-map/etfs/', 'ETF Map'],
        ]},
      ],
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
      __legacy_ar: [
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
        ['/ar/account/profile/', 'الملف الشخصي للحساب'],
        ['/ar/account/mobile/', 'تطبيق الجوال']
      ],
      groups: [
        { title: 'الاستخبارات', items: [
          ['/ar/market-terminal/', 'الطرفية المؤسسية'],
          ['/ar/market-regime/', 'نظام السوق'],
          ['/ar/rankings/', 'الترتيب النسبي'],
          ['/ar/market-map/assets/', 'الخرائط المرئية'],
          ['/ar/markets/', 'الأصول'],
          ['/ar/sectors/', 'القطاعات'],
          ['/ar/equities/', 'الأسهم الفردية'],
          ['/ar/etfs/', 'استخبارات الصناديق'],
        ]},
        { title: 'الأبحاث', items: [
          ['/ar/research/', 'مركز الأبحاث'],
          ['/ar/research/feed/', 'تغذية الأبحاث'],
          ['/ar/research/regime/', 'أبحاث النظام'],
          ['/ar/research/assets/', 'أبحاث الكيانات'],
          ['/ar/research/etfs/', 'أبحاث الصناديق'],
          ['/ar/insights/', 'الأبحاث التطبيقية'],
          ['/ar/articles/', 'المقالات التعليمية'],
        ]},
        { title: 'التغيّرات', items: [
          ['/ar/changes/', 'مركز التغيّرات'],
          ['/ar/changes/assets/', 'تغيّرات الأصول'],
          ['/ar/changes/sectors/', 'تغيّرات القطاعات'],
          ['/ar/changes/equities/', 'تغيّرات الأسهم'],
          ['/ar/changes/etfs/', 'تغيّرات الصناديق'],
          ['/ar/changes/regime/', 'تحوّلات النظام'],
          ['/ar/changes/history/', 'تاريخ التغيّرات'],
        ]},
        { title: 'المستكشف', items: [
          ['/ar/explorer/', 'صفحة المستكشف'],
          ['/ar/explorer/events/', 'مستكشف الأحداث'],
          ['/ar/explorer/entity/', 'مستكشف الكيانات'],
          ['/ar/explorer/network/', 'مستكشف الشبكة'],
          ['/ar/explorer/research/', 'مستكشف الأبحاث'],
          ['/ar/explorer/search/', 'مستكشف البحث'],
        ]},
        { title: 'مساحة المتابعة', items: [
          ['/ar/workspace/', 'مساحة المتابعة'],
          ['/ar/workspace/watchlists/', 'قوائم المتابعة'],
          ['/ar/workspace/monitoring/', 'المتابعة'],
          ['/ar/workspace/research/', 'أبحاث المتابعة'],
          ['/ar/workspace/regime/', 'متابعة النظام'],
        ]},
        { title: 'الحساب', items: [
          ['/ar/account/', 'نظرة عامة على الحساب'],
          ['/ar/account/profile/', 'الملف الشخصي'],
          ['/ar/account/preferences/', 'التفضيلات'],
          ['/ar/account/watchlists/', 'قوائمي'],
          ['/ar/account/alerts/', 'التنبيهات'],
          ['/ar/account/billing/', 'الفوترة'],
          ['/ar/account/mobile/', 'تطبيق الجوال'],
        ]},
      ],
      footer: [
        { title: 'أسطح إضافية', items: [
          ['/ar/market-news/', 'أخبار الأسواق'],
          ['/ar/market-structure/', 'بنية السوق'],
          ['/ar/market-outlook/', 'آفاق السوق'],
          ['/ar/briefs/', 'إحاطات السوق'],
          ['/ar/research/history/', 'سجل الأبحاث'],
          ['/ar/market-map/regime/', 'خريطة نظام السوق'],
          ['/ar/market-map/network/', 'خريطة الشبكة'],
          ['/ar/market-map/history/', 'الخريطة التاريخية'],
          ['/ar/market-map/etfs/', 'خريطة الصناديق'],
        ]},
      ],
    },
    { key: 'economic-calendar', href: '/ar/economic-calendar/', label: 'التقويم الاقتصادي' },
    { key: 'methodology', href: '/ar/methodology.html', label: 'المنهجية' }
  ];
}

function renderNavItem(item, active, ar) {
  const isActive = item.key === active || (item.activeKeys || []).includes(active);
  const activeClass = isActive ? ' is-active' : '';
  const current = item.key === active ? ' aria-current="page"' : '';
  if (!item.children && !item.groups) {
    return `<a href="${item.href}" class="nav-link${activeClass}"${current}>${item.label}</a>`;
  }
  const badge = item.badge ? `<span class="nav-badge">${item.badge}</span>` : '';
  // Mega-menu path — multi-column grouped dropdown.
  if (item.groups) {
    const columnsHtml = item.groups.map((group) => `
              <div class="nav-mega-column">
                <h4 class="nav-mega-title">${escapeHtml(group.title)}</h4>
                <ul class="nav-mega-list">
                  ${group.items.map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('\n                  ')}
                </ul>
              </div>`).join('');
    const footerHtml = (item.footer || []).map((group) => `
              <div class="nav-mega-footer-row">
                <span class="nav-mega-footer-title">${escapeHtml(group.title)}</span>
                <div class="nav-mega-footer-links">
                  ${group.items.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('')}
                </div>
              </div>`).join('');
    return `<div class="nav-menu nav-menu-mega">
            <a href="${item.href}" class="nav-link nav-menu-trigger${activeClass}"${current}>${item.label}${badge}<span class="nav-caret" aria-hidden="true">▾</span></a>
            <div class="nav-dropdown nav-mega-dropdown" role="menu">
              <div class="nav-mega-grid">${columnsHtml}
              </div>${footerHtml ? `\n              <div class="nav-mega-footer">${footerHtml}\n              </div>` : ''}
            </div>
          </div>`;
  }
  // Legacy single-column dropdown for items like Rankings.
  return `<div class="nav-menu">
            <a href="${item.href}" class="nav-link nav-menu-trigger${activeClass}"${current}>${item.label}${badge}<span class="nav-caret" aria-hidden="true">▾</span></a>
            <div class="nav-dropdown">
              ${item.children.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('\n              ')}
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
