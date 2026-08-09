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

// Mobile drawer mirrors the desktop IA exactly: same five destinations, same
// ordering, same names. A visitor who learns the structure on one device does
// not have to relearn it on the other.
const MOBILE_CARDS_EN = [
  { key: 'intelligence', title: 'Market Intelligence', viewAll: ['/intelligence/', 'Open Market Intelligence'], items: [
    ['/market-terminal/', 'Market Terminal'],
    ['/market-regime/', 'Market Regime'],
    ['/markets/', 'Assets'],
    ['/sectors/', 'Sectors'],
    ['/explorer/', 'Intelligence Explorer'],
  ]},
  { key: 'markets', title: 'ETF Center', viewAll: ['/etfs/', 'Open ETF Center'], items: [
    ['/etfs/finder/', 'ETF Finder'],
    ['/etfs/compare/', 'ETF Compare'],
    ['/etfs/rankings/', 'ETF Rankings'],
    ['/etfs/categories/', 'ETF Categories'],
    ['/etfs/portfolio-models/', 'Portfolio Models'],
    ['/etfs/methodology/', 'Methodology'],
  ]},
  { key: 'workspace', title: 'My Investments', viewAll: ['/account/portfolios/', 'Open My Investments'], items: [
    ['/account/portfolios/', 'My Portfolios'],
    ['/account/watchlists/', 'Watchlists'],
    ['/account/alerts/', 'Alerts'],
    ['/workspace/', 'Workspace'],
  ]},
  { key: 'research', title: 'Research', viewAll: ['/research/', 'View all Research'], items: [
    ['/research/', 'Research Hub'],
    ['/research/feed/', 'Research Feed'],
    ['/insights/', 'Applied Research'],
    ['/articles/', 'Educational Articles'],
    ['/glossary/', 'Glossary'],
  ]},
  { key: 'tools', title: 'Tools', viewAll: ['/tools/', 'View all Tools'], items: [
    ['/ai-stock-screener.html', 'AI Screener'],
    ['/economic-calendar/', 'Economic Calendar'],
    ['/briefs/', 'Market Briefs'],
    ['/tools/compound-interest/', 'Compound Interest'],
  ]},
];

const MOBILE_CARDS_AR = [
  { key: 'intelligence', title: 'استخبارات السوق', viewAll: ['/ar/intelligence/', 'افتح استخبارات السوق'], items: [
    ['/ar/market-terminal/', 'منصة السوق'],
    ['/ar/market-regime/', 'نظام السوق'],
    ['/ar/markets/', 'الأصول'],
    ['/ar/sectors/', 'القطاعات'],
    ['/ar/explorer/', 'مستكشف الاستخبارات'],
  ]},
  { key: 'markets', title: 'مركز الصناديق', viewAll: ['/ar/etfs/', 'افتح مركز الصناديق'], items: [
    ['/ar/etfs/finder/', 'باحث الصناديق'],
    ['/ar/etfs/compare/', 'مقارنة الصناديق'],
    ['/ar/etfs/rankings/', 'ترتيبات الصناديق'],
    ['/ar/etfs/categories/', 'فئات الصناديق'],
    ['/ar/etfs/portfolio-models/', 'نماذج المحافظ'],
    ['/ar/etfs/methodology/', 'المنهجية'],
  ]},
  { key: 'workspace', title: 'استثماراتي', viewAll: ['/ar/account/portfolios/', 'افتح استثماراتي'], items: [
    ['/ar/account/portfolios/', 'محافظي'],
    ['/ar/account/watchlists/', 'قوائم المتابعة'],
    ['/ar/account/alerts/', 'التنبيهات'],
    ['/ar/workspace/', 'مساحة العمل'],
  ]},
  { key: 'research', title: 'الأبحاث', viewAll: ['/ar/research/', 'عرض كل الأبحاث'], items: [
    ['/ar/research/', 'مركز الأبحاث'],
    ['/ar/research/feed/', 'تدفق الأبحاث'],
    ['/ar/insights/', 'الأبحاث التطبيقية'],
    ['/ar/articles/', 'مقالات تعليمية'],
    ['/ar/glossary/', 'المسرد'],
  ]},
  { key: 'tools', title: 'الأدوات', viewAll: ['/ar/tools/', 'عرض كل الأدوات'], items: [
    ['/ar/ai-stock-screener.html', 'الفارز الذكي'],
    ['/ar/economic-calendar/', 'التقويم الاقتصادي'],
    ['/ar/briefs/', 'موجزات السوق'],
    ['/ar/tools/compound-interest/', 'الفائدة المركبة'],
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
  // BOTH stylesheets are required: global-header.css carries the component
  // styling (search-icon sizing, dropdown chrome, mobile drawer) while the
  // canonical file pins the layout contract. Newly published pages that only
  // received the canonical link rendered a giant unstyled search icon and a
  // broken header — the header must never depend on the page template
  // happening to link the base stylesheet on its own.
  return '<link rel="stylesheet" href="/css/global-header.css" />\n  <link rel="stylesheet" href="/css/global-header-canonical.css" />';
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
  // Phase 230 — navigation organised around the QUESTION a visitor arrived
  // with, not the content type the platform happens to publish.
  //
  //   Market Intelligence  what's happening        (observed market state)
  //   ETF Center           what should I own       (fund research product)
  //   My Investments       what do I own           (the holder's own data)
  //   Research             why should I believe it (written analysis)
  //   Tools                do the work for me      (utilities)
  //
  // The old top level — Markets / Research / Intelligence / Tools — sorted by
  // publishing category, and three of those four read as synonyms to anyone
  // outside the company: a visitor could not predict whether "market regime"
  // lived under Markets, Research or Intelligence. Worse, it had no concept for
  // "mine", which is why the portfolio product ended up filed under Account
  // next to billing, with a single inbound link.
  //
  // Research and Intelligence ARE merged, but along a better seam than simply
  // concatenating them: Market Intelligence holds what the platform OBSERVES
  // (terminal, regime, maps, explorer, changes), Research holds what it WRITES
  // (hub, feed, insights, articles, glossary). Pouring both into one menu would
  // have produced a fourteen-item dropdown — the exact clutter to avoid.
  return [
    { key: 'home', href: '/', label: 'Home' },
    {
      key: 'intelligence', href: '/intelligence/', label: 'Market Intelligence',
      activeKeys: ['intelligence', 'markets', 'sectors', 'equities', 'stocks', 'market-terminal',
        'market-regime', 'relative-rankings', 'market-map', 'explorer', 'changes', 'economic-calendar'],
      groups: [
        { title: 'Live market state', items: [
          ['/market-terminal/', 'Market Terminal'],
          ['/market-regime/', 'Market Regime'],
          ['/market-map/assets/', 'Market Maps'],
          ['/economic-calendar/', 'Economic Calendar'],
        ] },
        { title: 'Coverage', items: [
          ['/markets/', 'Assets'],
          ['/sectors/', 'Sectors'],
          ['/equities/', 'Equities'],
          ['/rankings/', 'Cross-Asset Rankings'],
        ] },
        { title: 'Signals', items: [
          ['/explorer/', 'Intelligence Explorer'],
          ['/changes/', 'Change Intelligence'],
          ['/market-structure/', 'Market Structure'],
        ] },
      ],
      footer: [{ title: 'Directories', items: [['/stocks.html', 'Stocks'], ['/etfs.html', 'ETFs']] }],
      viewAll: ['/intelligence/', 'Open Market Intelligence'],
    },
    {
      // The ETF Center is a product, and its menu is its table of contents.
      // DISCOVER / LEARN / TRUST are the three jobs a fund researcher does.
      // The TRUST column is deliberate: this platform's edge is that it
      // withholds what it cannot verify, and that discipline was invisible —
      // Methodology sat two clicks deep and Coverage had one inbound link.
      key: 'etfs', href: '/etfs/', label: 'ETF Center',
      activeKeys: ['etfs', 'etf-finder', 'etf-compare', 'etf-rankings', 'etf-categories',
        'etf-learn', 'etf-methodology', 'etf-coverage', 'etf-data-audit', 'portfolio-models'],
      groups: [
        { title: 'Discover', items: [
          ['/etfs/finder/', 'ETF Finder'],
          ['/etfs/compare/', 'ETF Compare'],
          ['/etfs/rankings/', 'ETF Rankings'],
        ] },
        { title: 'Learn', items: [
          ['/etfs/categories/', 'ETF Categories'],
          ['/etfs/portfolio-models/', 'Portfolio Models'],
          ['/etfs/learn/', 'ETF Learn'],
        ] },
        { title: 'Trust', items: [
          ['/etfs/methodology/', 'Methodology'],
          ['/etfs/coverage/', 'Coverage'],
          ['/etfs/data-audit/', 'Data Audit'],
        ] },
      ],
      viewAll: ['/etfs/', 'Open ETF Center'],
    },
    {
      // Promoted out of Account. This is the only section that acts on the
      // visitor's own data, and it had one inbound link before this change.
      // Named "My Investments" rather than "Portfolio" because it also holds
      // watchlists, alerts and the workspace, none of which are portfolios.
      key: 'investments', href: '/account/portfolios/', label: 'My Investments',
      activeKeys: ['portfolios', 'account-portfolios', 'watchlists', 'alerts', 'workspace'],
      groups: [
        { title: 'Portfolios', items: [
          ['/account/portfolios/', 'My Portfolios'],
          ['/etfs/portfolio-models/', 'Portfolio Models'],
        ] },
        { title: 'Tracking', items: [
          ['/account/watchlists/', 'Watchlists'],
          ['/account/alerts/', 'Alerts'],
          ['/workspace/', 'Workspace'],
        ] },
        { title: 'Account', items: [
          ['/account/', 'Account Overview'],
          ['/account/preferences/', 'Preferences'],
          ['/account/profile/', 'Profile'],
        ] },
      ],
      viewAll: ['/account/portfolios/', 'Open My Investments'],
    },
    {
      key: 'research', href: '/research/', label: 'Research',
      activeKeys: ['research', 'insights', 'articles', 'briefs', 'market-news', 'market-outlook', 'glossary', 'newsletter'],
      children: [
        ['/research/', 'Research Hub'],
        ['/research/feed/', 'Research Feed'],
        ['/market-outlook/', 'Market Outlook'],
        ['/market-news/', 'Market News'],
        ['/insights/', 'Applied Research'],
        ['/articles/', 'Educational Articles'],
        ['/glossary/', 'Glossary'],
      ],
      viewAll: ['/research/', 'View all Research'],
    },
    {
      key: 'tools', href: '/tools/', label: 'Tools',
      activeKeys: ['tools', 'screener', 'compound-interest', 'retirement', 'cagr', 'dividend-yield', 'methodology'],
      children: [
        ['/ai-stock-screener.html', 'AI Screener'],
        ['/briefs/', 'Market Briefs'],
        ['/newsletter/', 'Newsletter'],
        ['/tools/compound-interest/', 'Compound Interest'],
        ['/tools/retirement/', 'Retirement'],
        ['/tools/cagr/', 'CAGR'],
        ['/tools/dividend-yield/', 'Dividend Yield'],
        ['/methodology.html', 'Platform Methodology'],
      ],
      viewAll: ['/tools/', 'View all Tools'],
    },
  ];
}

function arabicLinks() {
  // Arabic mirrors the English information architecture exactly — same five
  // destinations, same three ETF Center groups, same promotion of the personal
  // investing surface. Parity is structural, not a translation afterthought.
  return [
    { key: 'home', href: '/ar/', label: 'الرئيسية' },
    {
      key: 'intelligence', href: '/ar/intelligence/', label: 'استخبارات السوق',
      activeKeys: ['intelligence', 'markets', 'sectors', 'equities', 'stocks', 'market-terminal',
        'market-regime', 'relative-rankings', 'market-map', 'explorer', 'changes', 'economic-calendar'],
      groups: [
        { title: 'حالة السوق الحية', items: [
          ['/ar/market-terminal/', 'منصة السوق'],
          ['/ar/market-regime/', 'نظام السوق'],
          ['/ar/market-map/assets/', 'خرائط السوق'],
          ['/ar/economic-calendar/', 'التقويم الاقتصادي'],
        ] },
        { title: 'التغطية', items: [
          ['/ar/markets/', 'الأصول'],
          ['/ar/sectors/', 'القطاعات'],
          ['/ar/equities/', 'الأسهم الفردية'],
          ['/ar/rankings/', 'الترتيبات عبر الأصول'],
        ] },
        { title: 'الإشارات', items: [
          ['/ar/explorer/', 'مستكشف الاستخبارات'],
          ['/ar/changes/', 'استخبارات التغيّرات'],
          ['/ar/market-structure/', 'بنية السوق'],
        ] },
      ],
      footer: [{ title: 'الأدلة', items: [['/ar/stocks.html', 'الأسهم'], ['/ar/etfs.html', 'الصناديق']] }],
      viewAll: ['/ar/intelligence/', 'افتح استخبارات السوق'],
    },
    {
      key: 'etfs', href: '/ar/etfs/', label: 'مركز الصناديق',
      activeKeys: ['etfs', 'etf-finder', 'etf-compare', 'etf-rankings', 'etf-categories',
        'etf-learn', 'etf-methodology', 'etf-coverage', 'etf-data-audit', 'portfolio-models'],
      groups: [
        { title: 'اكتشف', items: [
          ['/ar/etfs/finder/', 'باحث الصناديق'],
          ['/ar/etfs/compare/', 'مقارنة الصناديق'],
          ['/ar/etfs/rankings/', 'ترتيبات الصناديق'],
        ] },
        { title: 'تعلّم', items: [
          ['/ar/etfs/categories/', 'فئات الصناديق'],
          ['/ar/etfs/portfolio-models/', 'نماذج المحافظ'],
          ['/ar/etfs/learn/', 'تعلّم الصناديق'],
        ] },
        { title: 'الثقة', items: [
          ['/ar/etfs/methodology/', 'المنهجية'],
          ['/ar/etfs/coverage/', 'التغطية'],
          ['/ar/etfs/data-audit/', 'تدقيق البيانات'],
        ] },
      ],
      viewAll: ['/ar/etfs/', 'افتح مركز الصناديق'],
    },
    {
      key: 'investments', href: '/ar/account/portfolios/', label: 'استثماراتي',
      activeKeys: ['portfolios', 'account-portfolios', 'watchlists', 'alerts', 'workspace'],
      groups: [
        { title: 'المحافظ', items: [
          ['/ar/account/portfolios/', 'محافظي'],
          ['/ar/etfs/portfolio-models/', 'نماذج المحافظ'],
        ] },
        { title: 'المتابعة', items: [
          ['/ar/account/watchlists/', 'قوائم المتابعة'],
          ['/ar/account/alerts/', 'التنبيهات'],
          ['/ar/workspace/', 'مساحة العمل'],
        ] },
        { title: 'الحساب', items: [
          ['/ar/account/', 'نظرة عامة على الحساب'],
          ['/ar/account/preferences/', 'التفضيلات'],
          ['/ar/account/profile/', 'الملف الشخصي'],
        ] },
      ],
      viewAll: ['/ar/account/portfolios/', 'افتح استثماراتي'],
    },
    {
      key: 'research', href: '/ar/research/', label: 'الأبحاث',
      activeKeys: ['research', 'insights', 'articles', 'briefs', 'market-news', 'market-outlook', 'glossary', 'newsletter'],
      children: [
        ['/ar/research/', 'مركز الأبحاث'],
        ['/ar/research/feed/', 'تدفق الأبحاث'],
        ['/ar/market-outlook/', 'نظرة السوق'],
        ['/ar/market-news/', 'أخبار السوق'],
        ['/ar/insights/', 'الأبحاث التطبيقية'],
        ['/ar/articles/', 'مقالات تعليمية'],
        ['/ar/glossary/', 'المسرد'],
      ],
      viewAll: ['/ar/research/', 'عرض كل الأبحاث'],
    },
    {
      key: 'tools', href: '/ar/tools/', label: 'الأدوات',
      activeKeys: ['tools', 'screener', 'compound-interest', 'retirement', 'cagr', 'dividend-yield', 'methodology'],
      children: [
        ['/ar/ai-stock-screener.html', 'الفارز الذكي'],
        ['/ar/briefs/', 'موجزات السوق'],
        ['/ar/newsletter/', 'النشرة'],
        ['/ar/tools/compound-interest/', 'الفائدة المركبة'],
        ['/ar/tools/retirement/', 'التقاعد'],
        ['/ar/tools/cagr/', 'معدل النمو السنوي'],
        ['/ar/tools/dividend-yield/', 'عائد التوزيعات'],
        ['/ar/methodology.html', 'منهجية المنصّة'],
      ],
      viewAll: ['/ar/tools/', 'عرض كل الأدوات'],
    },
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
