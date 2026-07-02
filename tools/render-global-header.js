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

  const skipText = ar ? 'انتقل إلى المحتوى الرئيسي' : 'Skip to main content';
  const html = `${MARKER_START}
<a class="skip-link" href="#top">${skipText}</a>
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
      <div class="header-search" role="search">
        <label class="header-search-label" for="header-search-input">
          <svg class="header-search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="header-search-input" class="header-search-input" type="search" placeholder="${ar ? 'ابحث في الموقع…' : 'Search…'}" autocomplete="off" aria-label="${ar ? 'بحث الموقع' : 'Site search'}" data-site-search />
        </label>
      </div>
      <a href="https://t.me/TradeAlphaSignals_bot" target="_blank" rel="noopener noreferrer" class="header-signal-cta">${ctaText}</a>
      <div class="locale-links" aria-label="${langLabel}">
        <a class="lang-switch" data-locale-route="ar" href="${escapeHtml(arHref)}">${arText}</a>
        <a class="lang-switch" data-locale-route="en" href="${escapeHtml(enHref)}">English</a>
      </div>
      <div class="header-account" data-account-action data-signed-in-label="${escapeHtml(accountLabel)}" data-signed-in-href="${escapeHtml(accountHref)}" data-locale="${ar ? 'ar' : 'en'}">
        <a class="header-account-link header-account-cta" data-account-signed-out href="${escapeHtml(signInHref)}">
          <span class="header-account-icon" aria-hidden="true">${ACCOUNT_ICON_SVG}</span>
          <span class="header-account-label">${signInLabel}</span>
        </a>
        <a class="header-account-dashboard" data-account-dashboard href="${escapeHtml(accountHref)}" hidden>
          <span class="header-account-icon" aria-hidden="true">${DASHBOARD_ICON_SVG}</span>
          <span class="header-account-label">${escapeHtml(accountLabel)}</span>
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
  <template data-mobile-cards>${renderMobileCards(ar, signInHref, accountHref, signInLabel, accountLabel)}</template>
</div>
${MARKER_END}`;

  return html;
}

// Mobile drawer cards — 6 grouped cards instead of a flat list.
// Cards are baked into a <template> inside the header and cloned by
// js/global-header.js when the drawer opens. Each card has 3-5 key
// links + a "View all" terminal anchor.
function renderMobileCards(ar, signInHref, accountHref, signInLabel, accountLabel) {
  const cards = ar ? MOBILE_CARDS_AR : MOBILE_CARDS_EN;
  const viewAllLabel = ar ? 'عرض الكل' : 'View all';
  const accountSubLabel = ar ? 'حسابي' : 'Account';
  const inHtml = cards.map((card) => {
    const items = card.items.map(([href, label]) => `<li><a class="m-card-link" href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('');
    return `
    <div class="m-card" data-card-key="${escapeHtml(card.key)}">
      <header class="m-card-head">
        <span class="m-card-icon" aria-hidden="true">${MOBILE_CARD_ICONS[card.key] || ''}</span>
        <h3 class="m-card-title">${escapeHtml(card.title)}</h3>
      </header>
      <ul class="m-card-list">${items}</ul>
      ${card.viewAll ? `<a class="m-card-viewall" href="${escapeHtml(card.viewAll[0])}">${escapeHtml(card.viewAll[1] || viewAllLabel)}<span aria-hidden="true">${ar ? '←' : '→'}</span></a>` : ''}
    </div>`;
  }).join('');
  // Account card — always last, with auth-state-aware buttons. The JS
  // swaps signed-out/signed-in classes based on Clerk session.
  const accountCard = `
    <div class="m-card m-card-account" data-card-key="account" data-mobile-account>
      <header class="m-card-head">
        <span class="m-card-icon" aria-hidden="true">${MOBILE_CARD_ICONS.account}</span>
        <h3 class="m-card-title">${escapeHtml(accountSubLabel)}</h3>
      </header>
      <ul class="m-card-list">
        <li><a class="m-card-link" href="${escapeHtml(accountHref)}profile/">${escapeHtml(ar ? 'الملف الشخصي' : 'Profile')}</a></li>
        <li><a class="m-card-link" href="${escapeHtml(accountHref)}watchlists/">${escapeHtml(ar ? 'قوائم المتابعة' : 'Watchlists')}</a></li>
        <li><a class="m-card-link" href="${escapeHtml(accountHref)}preferences/">${escapeHtml(ar ? 'التفضيلات' : 'Preferences')}</a></li>
        <li><a class="m-card-link" href="${escapeHtml(accountHref)}alerts/">${escapeHtml(ar ? 'التنبيهات' : 'Alerts')}</a></li>
      </ul>
      <div class="m-card-actions">
        <a class="m-card-cta m-card-cta-signin" data-mobile-signin href="${escapeHtml(signInHref)}">${escapeHtml(signInLabel)}</a>
        <a class="m-card-cta m-card-cta-dashboard" data-mobile-dashboard hidden href="${escapeHtml(accountHref)}">${escapeHtml(ar ? 'لوحة التحكم' : 'Dashboard')}</a>
        <button type="button" class="m-card-cta m-card-cta-signout" data-mobile-signout hidden>${escapeHtml(ar ? 'تسجيل الخروج' : 'Sign out')}</button>
      </div>
    </div>`;
  return inHtml + accountCard;
}

const MOBILE_CARDS_EN = [
  { key: 'markets', title: 'Markets', viewAll: ['/markets/', 'View all Markets'], items: [
    ['/markets/', 'Assets'],
    ['/sectors/', 'Sectors'],
    ['/equities/', 'Equities'],
    ['/etfs/', 'ETF Intelligence'],
  ]},
  { key: 'research', title: 'Research', viewAll: ['/research/', 'View all Research'], items: [
    ['/research/', 'Research Hub'],
    ['/research/feed/', 'Research Feed'],
    ['/insights/', 'Applied Research'],
    ['/glossary/', 'Glossary'],
  ]},
  { key: 'intelligence', title: 'Intelligence', viewAll: ['/intelligence/', 'View all Intelligence'], items: [
    ['/market-terminal/', 'Market Terminal'],
    ['/market-regime/', 'Market Regime'],
    ['/rankings/', 'Rankings'],
    ['/explorer/', 'Explorer'],
    ['/changes/', 'Changes'],
  ]},
  { key: 'tools', title: 'Tools', viewAll: ['/tools/', 'View all Tools'], items: [
    ['/ai-stock-screener.html', 'Screener'],
    ['/economic-calendar/', 'Economic Calendar'],
    ['/briefs/', 'Market Briefs'],
    ['/newsletter/', 'Newsletter'],
    ['/tools/compound-interest/', 'Compound Interest Calc'],
    ['/tools/retirement/', 'Retirement Calc'],
    ['/tools/cagr/', 'CAGR Calc'],
    ['/tools/dividend-yield/', 'Dividend Yield Calc'],
  ]},
  { key: 'workspace', title: 'Workspace', viewAll: ['/workspace/', 'Open workspace'], items: [
    ['/workspace/watchlists/', 'My Watchlists'],
    ['/workspace/monitoring/', 'Monitoring'],
    ['/workspace/regime/', 'Regime Monitoring'],
    ['/workspace/research/', 'Workspace Research'],
  ]},
];
const MOBILE_CARDS_AR = [
  { key: 'markets', title: 'الأسواق', viewAll: ['/ar/markets/', 'عرض كل الأسواق'], items: [
    ['/ar/markets/', 'الأصول'],
    ['/ar/sectors/', 'القطاعات'],
    ['/ar/equities/', 'الأسهم الفردية'],
    ['/ar/etfs/', 'استخبارات الصناديق'],
  ]},
  { key: 'research', title: 'الأبحاث', viewAll: ['/ar/research/', 'عرض كل الأبحاث'], items: [
    ['/ar/research/', 'مركز الأبحاث'],
    ['/ar/research/feed/', 'تغذية الأبحاث'],
    ['/ar/insights/', 'الأبحاث التطبيقية'],
    ['/ar/glossary/', 'قاموس المصطلحات'],
  ]},
  { key: 'intelligence', title: 'الاستخبارات', viewAll: ['/ar/intelligence/', 'عرض كل الاستخبارات'], items: [
    ['/ar/market-terminal/', 'طرفية السوق'],
    ['/ar/market-regime/', 'نظام السوق'],
    ['/ar/rankings/', 'الترتيب'],
    ['/ar/explorer/', 'المستكشف'],
    ['/ar/changes/', 'التغيّرات'],
  ]},
  { key: 'tools', title: 'الأدوات', viewAll: ['/ar/tools/', 'عرض كل الأدوات'], items: [
    ['/ar/ai-stock-screener.html', 'ماسح السوق'],
    ['/ar/economic-calendar/', 'التقويم الاقتصادي'],
    ['/ar/briefs/', 'الإحاطات'],
    ['/ar/newsletter/', 'النشرة اليومية'],
    ['/ar/tools/compound-interest/', 'الفائدة المركبة'],
    ['/ar/tools/retirement/', 'حاسبة التقاعد'],
    ['/ar/tools/cagr/', 'CAGR'],
    ['/ar/tools/dividend-yield/', 'عائد الأرباح'],
  ]},
  { key: 'workspace', title: 'مساحة المتابعة', viewAll: ['/ar/workspace/', 'افتح مساحة المتابعة'], items: [
    ['/ar/workspace/watchlists/', 'قوائم المتابعة'],
    ['/ar/workspace/monitoring/', 'المتابعة'],
    ['/ar/workspace/regime/', 'متابعة النظام'],
    ['/ar/workspace/research/', 'أبحاث المتابعة'],
  ]},
];
const MOBILE_CARD_ICONS = {
  markets:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  research:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  intelligence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  tools:        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6.3 6.3 2.6 2.6 6.3-6.3a4 4 0 0 0 5.4-5.4z"/></svg>',
  workspace:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  account:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
};

// Minimal inline user-circle icon — keeps the Account button visually
// anchored even before Clerk's UserButton image arrives.
const ACCOUNT_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>';
const DASHBOARD_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>';

// Mega-menu column icons (12x12, currentColor). Each column title is
// mapped to one via GROUP_TITLE_TO_ICON (works for both EN + AR titles).
const NAV_GROUP_ICONS = {
  intelligence: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  research:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
  changes:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>',
  explorer:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  workspace:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  account:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
  more:         '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  default:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>',
};
const GROUP_TITLE_TO_ICON = {
  // EN
  'Intelligence': 'intelligence', 'Research': 'research', 'Changes': 'changes',
  'Explorer': 'explorer', 'Workspace': 'workspace', 'Account': 'account',
  'More Surfaces': 'more',
  // AR
  'الاستخبارات': 'intelligence', 'الأبحاث': 'research', 'التغيّرات': 'changes',
  'المستكشف': 'explorer', 'مساحة المتابعة': 'workspace', 'الحساب': 'account',
  'أسطح إضافية': 'more',
};

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
    + '<script src="/js/search-autocomplete.js" defer></script>'
    // SW registration — also force an update check on every page load
    // so users on an older deploy immediately drop the stale HTML cache
    // and adopt the auth-safe v3 worker. Previous cached navigations
    // were the root cause of the "Sign in" flicker after sign-in.
    // SW registration with auto-update:
    //   1. Register the SW (or reuse the existing one).
    //   2. Force an update() check on every page load.
    //   3. When a new SW is installed, tell it to skipWaiting immediately.
    //   4. When the new SW takes control, reload the page ONE time so
    //      the user gets fresh CSS/JS without ever needing Ctrl+Shift+R.
    //      The __SW_RELOAD_GUARD__ flag prevents reload loops.
    + '<script>if ("serviceWorker" in navigator) { window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").then(function (reg) { try { reg.update(); } catch (e) {} reg.addEventListener("updatefound", function () { var nw = reg.installing; if (!nw) return; nw.addEventListener("statechange", function () { if (nw.state === "installed" && navigator.serviceWorker.controller) { try { nw.postMessage({ type: "SKIP_WAITING" }); } catch (e) {} } }); }); }).catch(function () {}); var reloaded = false; navigator.serviceWorker.addEventListener("controllerchange", function () { if (reloaded) return; reloaded = true; window.location.reload(); }); }); }</script>';
}

function englishLinks() {
  // 6-item focused top-level. Each non-Home item exposes a short
  // dropdown (≤7 items) with a "View all" terminal link. Account is
  // INTENTIONALLY absent — it lives in the right-side header action.
  return [
    { key: 'home', href: '/', label: 'Home' },
    {
      key: 'markets', href: '/markets/', label: 'Markets',
      activeKeys: ['stocks', 'etfs', 'markets', 'sectors', 'equities', 'compare'],
      children: [
        ['/markets/', 'Assets'],
        ['/sectors/', 'Sectors'],
        ['/equities/', 'Equities'],
        ['/etfs/', 'ETF Intelligence'],
        ['/stocks.html', 'Stocks Directory'],
        ['/etfs.html', 'ETFs Directory'],
      ],
      viewAll: ['/markets/', 'View all Markets'],
    },
    {
      key: 'research', href: '/research/', label: 'Research',
      activeKeys: ['research', 'insights', 'articles', 'briefs', 'market-news', 'market-outlook', 'market-structure', 'glossary'],
      children: [
        ['/research/', 'Research Hub'],
        ['/research/feed/', 'Research Feed'],
        ['/market-outlook/', 'Market Outlook'],
        ['/market-news/', 'Market News'],
        ['/market-structure/', 'Market Structure'],
        ['/insights/', 'Applied Research'],
        ['/articles/', 'Educational Articles'],
        ['/glossary/', 'Glossary'],
      ],
      viewAll: ['/research/', 'View all Research'],
    },
    {
      key: 'intelligence', href: '/intelligence/', label: 'Intelligence',
      activeKeys: ['intelligence', 'market-terminal', 'market-regime', 'relative-rankings', 'market-map', 'explorer', 'changes', 'market-structure', 'market-outlook'],
      children: [
        ['/market-terminal/', 'Market Terminal'],
        ['/market-regime/', 'Market Regime'],
        ['/rankings/', 'Rankings'],
        ['/market-map/assets/', 'Maps'],
        ['/explorer/', 'Explorer'],
        ['/changes/', 'Changes'],
      ],
      viewAll: ['/intelligence/', 'View all Intelligence'],
    },
    {
      key: 'tools', href: '/tools/', label: 'Tools',
      activeKeys: ['tools', 'screener', 'economic-calendar', 'briefs', 'newsletter', 'compound-interest', 'retirement', 'cagr', 'dividend-yield'],
      children: [
        ['/ai-stock-screener.html', 'Screener'],
        ['/economic-calendar/', 'Economic Calendar'],
        ['/briefs/', 'Market Briefs'],
        ['/newsletter/', 'Newsletter'],
        ['/tools/compound-interest/', 'Compound Interest Calculator'],
        ['/tools/retirement/', 'Retirement Calculator'],
        ['/tools/cagr/', 'CAGR Calculator'],
        ['/tools/dividend-yield/', 'Dividend Yield Calculator'],
        ['/methodology.html', 'Methodology'],
      ],
      viewAll: ['/tools/', 'View all Tools'],
    },
    { key: 'methodology', href: '/methodology.html', label: 'Methodology' },
  ];
}

function arabicLinks() {
  return [
    { key: 'home', href: '/ar/', label: 'الرئيسية' },
    {
      key: 'markets', href: '/ar/markets/', label: 'الأسواق',
      activeKeys: ['stocks', 'etfs', 'markets', 'sectors', 'equities', 'compare'],
      children: [
        ['/ar/markets/', 'الأصول'],
        ['/ar/sectors/', 'القطاعات'],
        ['/ar/equities/', 'الأسهم الفردية'],
        ['/ar/etfs/', 'استخبارات الصناديق'],
        ['/ar/stocks.html', 'دليل الأسهم'],
        ['/ar/etfs.html', 'دليل الصناديق'],
      ],
      viewAll: ['/ar/markets/', 'عرض كل الأسواق'],
    },
    {
      key: 'research', href: '/ar/research/', label: 'الأبحاث',
      activeKeys: ['research', 'insights', 'articles', 'briefs', 'market-news', 'market-outlook', 'market-structure', 'glossary'],
      children: [
        ['/ar/research/', 'مركز الأبحاث'],
        ['/ar/research/feed/', 'تغذية الأبحاث'],
        ['/ar/market-outlook/', 'نظرة السوق'],
        ['/ar/market-news/', 'أخبار السوق'],
        ['/ar/market-structure/', 'بنية السوق'],
        ['/ar/insights/', 'الأبحاث التطبيقية'],
        ['/ar/articles/', 'المقالات التعليمية'],
        ['/ar/glossary/', 'قاموس المصطلحات'],
      ],
      viewAll: ['/ar/research/', 'عرض كل الأبحاث'],
    },
    {
      key: 'intelligence', href: '/ar/intelligence/', label: 'الاستخبارات',
      activeKeys: ['intelligence', 'market-terminal', 'market-regime', 'relative-rankings', 'market-map', 'explorer', 'changes', 'market-structure', 'market-outlook'],
      children: [
        ['/ar/market-terminal/', 'طرفية السوق'],
        ['/ar/market-regime/', 'نظام السوق'],
        ['/ar/rankings/', 'الترتيب'],
        ['/ar/market-map/assets/', 'الخرائط'],
        ['/ar/explorer/', 'المستكشف'],
        ['/ar/changes/', 'التغيّرات'],
      ],
      viewAll: ['/ar/intelligence/', 'عرض كل الاستخبارات'],
    },
    {
      key: 'tools', href: '/ar/tools/', label: 'الأدوات',
      activeKeys: ['tools', 'screener', 'economic-calendar', 'briefs', 'newsletter', 'compound-interest', 'retirement', 'cagr', 'dividend-yield'],
      children: [
        ['/ar/ai-stock-screener.html', 'ماسح السوق'],
        ['/ar/economic-calendar/', 'التقويم الاقتصادي'],
        ['/ar/briefs/', 'الإحاطات'],
        ['/ar/newsletter/', 'النشرة اليومية'],
        ['/ar/tools/compound-interest/', 'حاسبة الفائدة المركبة'],
        ['/ar/tools/retirement/', 'حاسبة التقاعد'],
        ['/ar/tools/cagr/', 'حاسبة النمو السنوي المركب'],
        ['/ar/tools/dividend-yield/', 'حاسبة عائد الأرباح'],
        ['/ar/methodology.html', 'المنهجية'],
      ],
      viewAll: ['/ar/tools/', 'عرض كل الأدوات'],
    },
    { key: 'methodology', href: '/ar/methodology.html', label: 'المنهجية' },
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
    const columnsHtml = item.groups.map((group, idx) => {
      const iconKey = group.icon || GROUP_TITLE_TO_ICON[group.title] || 'default';
      const icon = NAV_GROUP_ICONS[iconKey] || NAV_GROUP_ICONS.default;
      return `
              <div class="nav-mega-column" style="--col-delay:${idx * 30}ms">
                <h4 class="nav-mega-title"><span class="nav-mega-icon" aria-hidden="true">${icon}</span><span>${escapeHtml(group.title)}</span></h4>
                <ul class="nav-mega-list">
                  ${group.items.map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`).join('\n                  ')}
                </ul>
              </div>`;
    }).join('');
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
  // Compact single-column dropdown — used by the new 4 top-level
  // categories (Markets / Research / Intelligence / Tools). Each ends
  // with a styled "View all" terminal link pointing to the section
  // hub page (set via item.viewAll = ['/href/', 'View all X']).
  const viewAllHtml = item.viewAll
    ? `<a href="${escapeHtml(item.viewAll[0])}" class="nav-dropdown-viewall">${escapeHtml(item.viewAll[1])}<span aria-hidden="true">${ar ? '←' : '→'}</span></a>`
    : '';
  return `<div class="nav-menu">
            <a href="${item.href}" class="nav-link nav-menu-trigger${activeClass}"${current}>${item.label}${badge}<span class="nav-caret" aria-hidden="true">▾</span></a>
            <div class="nav-dropdown nav-dropdown-compact">
              ${item.children.map(([href, label]) => `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`).join('\n              ')}
              ${viewAllHtml}
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
