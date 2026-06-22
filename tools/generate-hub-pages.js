'use strict';

// Premium hub pages for "View all" destinations from the redesigned
// navigation. Replaces the thin /markets/ landing and creates the
// missing /tools/ hub. Both EN + AR, RTL-correct.
//
//   /markets/  — Markets Hub
//   /tools/    — Tools Hub
//
// Research / Intelligence / Workspace hubs are already real hubs and
// not touched here. Account hub lives at /account/ and is rendered by
// js/account-dashboard.js (Clerk-aware).
//
// Usage: node tools/generate-hub-pages.js --write

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');
const { ASSETS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }

// ── Hub shape ─────────────────────────────────────────────────────
// Each hub is data-only; render() walks the data into a consistent
// premium layout: hero, primary destinations, supporting links,
// related hubs, disclaimer.
const HUBS = {
  markets: {
    rel: 'markets/',
    activePage: 'markets',
    title_en: 'Markets Hub',
    title_ar: 'مركز الأسواق',
    eyebrow_en: 'Markets',
    eyebrow_ar: 'الأسواق',
    lead_en: 'A complete view of the market — assets, sectors, equities, ETFs, with deep research and live institutional context for each. Start anywhere, drill into anything.',
    lead_ar: 'رؤية كاملة للسوق — الأصول والقطاعات والأسهم والصناديق، مع أبحاث متعمّقة وسياق مؤسسي حيّ لكل منها. ابدأ من أي مكان، وتعمّق في أي شيء.',
    primary: {
      title_en: 'Coverage', title_ar: 'التغطية',
      heading_en: 'Where do you want to start?', heading_ar: 'من أين تريد أن تبدأ؟',
      cards: [
        { kicker_en: 'Core ETFs', kicker_ar: 'الصناديق الأساسية', title_en: 'Assets', title_ar: 'الأصول', desc_en: 'GLD, UUP, TLT, SPY, QQQ and the rest of the macro framework — structure, tactical, liquidity and historical context for each.', desc_ar: 'GLD وUUP وTLT وSPY وQQQ وبقية الإطار الكلي — البنية والتكتيك والسيولة والسياق التاريخي لكل أصل.', href_en: '/markets/assets/', href_ar: '/ar/markets/assets/', icon: 'gauge' },
        { kicker_en: 'SPDR sectors', kicker_ar: 'قطاعات SPDR', title_en: 'Sectors', title_ar: 'القطاعات', desc_en: 'Per-sector institutional reads and rotation context across the 10 SPDR sectors.', desc_ar: 'قراءات مؤسسية لكل قطاع وسياق التدوير عبر قطاعات SPDR العشرة.', href_en: '/sectors/', href_ar: '/ar/sectors/', icon: 'sector' },
        { kicker_en: 'Leading names', kicker_ar: 'الأسماء الرائدة', title_en: 'Equities', title_ar: 'الأسهم الفردية', desc_en: 'Per-equity reads that connect macro → sector → single name across leading US equities.', desc_ar: 'قراءات لكل سهم تربط الكلي ← القطاع ← السهم الفردي عبر أبرز الأسهم الأمريكية.', href_en: '/equities/', href_ar: '/ar/equities/', icon: 'equity' },
        { kicker_en: 'ETF intelligence', kicker_ar: 'استخبارات الصناديق', title_en: 'ETFs', title_ar: 'الصناديق', desc_en: 'Curated ETF intelligence — flows, breadth, rotation, leadership and the maps that connect them.', desc_ar: 'استخبارات صناديق منسّقة — التدفقات والاتساع والتدوير والقيادة والخرائط التي تربطها.', href_en: '/etfs/', href_ar: '/ar/etfs/', icon: 'etf' },
      ],
    },
    secondary: {
      title_en: 'Go deeper', title_ar: 'تعمّق أكثر',
      heading_en: 'Research, maps and live terminal', heading_ar: 'الأبحاث والخرائط والطرفية الحيّة',
      cards: [
        { title_en: 'Stock research', title_ar: 'أبحاث الأسهم', desc_en: 'Live institutional research per equity, including macro and sector context.', desc_ar: 'أبحاث مؤسسية حيّة لكل سهم، تشمل السياق الكلي والقطاعي.', href_en: '/research/', href_ar: '/ar/research/' },
        { title_en: 'ETF research', title_ar: 'أبحاث الصناديق', desc_en: 'Per-ETF research with flows, holdings overlap and regime fit.', desc_ar: 'أبحاث لكل صندوق مع التدفقات وتداخل الحيازات وملاءمة النظام.', href_en: '/research/etfs/', href_ar: '/ar/research/etfs/' },
        { title_en: 'Market maps', title_ar: 'خرائط السوق', desc_en: 'Cross-asset and sector-rotation maps showing where capital is moving.', desc_ar: 'خرائط الأصول والتدوير القطاعي توضح أين يتحرك رأس المال.', href_en: '/maps/', href_ar: '/ar/maps/' },
        { title_en: 'Market terminal', title_ar: 'طرفية السوق', desc_en: 'Single live console: regime, breadth, leadership, macro and intraday context.', desc_ar: 'وحدة تحكّم حيّة واحدة: النظام والاتساع والقيادة والكلي والسياق اللحظي.', href_en: '/market-terminal/', href_ar: '/ar/market-terminal/' },
      ],
    },
    related: [
      { label_en: 'Market Regime', label_ar: 'نظام السوق', href_en: '/market-regime/', href_ar: '/ar/market-regime/' },
      { label_en: 'Rankings', label_ar: 'الترتيبات', href_en: '/rankings/', href_ar: '/ar/rankings/' },
      { label_en: 'Explorer', label_ar: 'المستكشف', href_en: '/explorer/', href_ar: '/ar/explorer/' },
      { label_en: 'Changes', label_ar: 'التغيّرات', href_en: '/changes/', href_ar: '/ar/changes/' },
    ],
  },

  tools: {
    rel: 'tools/',
    activePage: 'tools',
    title_en: 'Tools Hub',
    title_ar: 'مركز الأدوات',
    eyebrow_en: 'Tools',
    eyebrow_ar: 'الأدوات',
    lead_en: 'Practical tools to scan, schedule and act on market intelligence — screeners, calendars, briefs and the methodology behind every interpretation.',
    lead_ar: 'أدوات عملية للمسح والجدولة والعمل على استخبارات السوق — ماسحات وتقاويم وإحاطات والمنهجية وراء كل تفسير.',
    primary: {
      title_en: 'Core tools', title_ar: 'الأدوات الأساسية',
      heading_en: 'Scan, schedule, brief', heading_ar: 'امسح، جدول، أحط علماً',
      cards: [
        { kicker_en: 'Screener', kicker_ar: 'الماسح', title_en: 'AI Stock Screener', title_ar: 'ماسح الأسهم بالذكاء', desc_en: 'Filter equities by sector, leadership, regime fit and breadth context — institutional reads, not buy/sell signals.', desc_ar: 'صفِّ الأسهم حسب القطاع والقيادة وملاءمة النظام وسياق الاتساع — قراءات مؤسسية لا إشارات شراء/بيع.', href_en: '/ai-stock-screener.html', href_ar: '/ar/ai-stock-screener.html', icon: 'filter' },
        { kicker_en: 'Calendar', kicker_ar: 'التقويم', title_en: 'Economic Calendar', title_ar: 'التقويم الاقتصادي', desc_en: 'Macro releases with prior, consensus and actual — annotated by regime importance.', desc_ar: 'إصدارات الكلي مع السابق والتوقعات والفعلي — مع تعليقات حسب أهمية النظام.', href_en: '/economic-calendar/', href_ar: '/ar/economic-calendar/', icon: 'calendar' },
        { kicker_en: 'Briefs', kicker_ar: 'الإحاطات', title_en: 'Market Briefs', title_ar: 'إحاطات السوق', desc_en: 'Daily and weekly institutional reads written for serious operators, not retail noise.', desc_ar: 'إحاطات يومية وأسبوعية مكتوبة للمشغّلين الجادّين، لا للضوضاء الاستهلاكية.', href_en: '/briefs/', href_ar: '/ar/briefs/', icon: 'doc' },
        { kicker_en: 'Methodology', kicker_ar: 'المنهجية', title_en: 'How we read the market', title_ar: 'كيف نقرأ السوق', desc_en: 'The framework: regime → leadership → liquidity → confirmation. Read once, recognize it everywhere on the platform.', desc_ar: 'الإطار: النظام ← القيادة ← السيولة ← التأكيد. اقرأه مرة وتعرّف عليه في كل أنحاء المنصّة.', href_en: '/methodology.html', href_ar: '/ar/methodology.html', icon: 'compass' },
      ],
    },
    secondary: {
      title_en: 'Personal layer', title_ar: 'الطبقة الشخصية',
      heading_en: 'When you sign in', heading_ar: 'عند تسجيل الدخول',
      cards: [
        { title_en: 'My Watchlists', title_ar: 'قوائم متابعتي', desc_en: 'Save your own groupings; the platform threads them through every research surface.', desc_ar: 'احفظ مجموعاتك الخاصة؛ تربطها المنصّة عبر كل أسطح الأبحاث.', href_en: '/workspace/watchlists/', href_ar: '/ar/workspace/watchlists/' },
        { title_en: 'Monitoring', title_ar: 'المتابعة', desc_en: 'A monitored layer above the public intelligence — alerts when context changes.', desc_ar: 'طبقة متابعة فوق الاستخبارات العامة — تنبيهات عند تغيّر السياق.', href_en: '/workspace/monitoring/', href_ar: '/ar/workspace/monitoring/' },
        { title_en: 'Workspace', title_ar: 'مساحة المتابعة', desc_en: 'Your dashboard of saved workspaces, followed entities, research and regimes.', desc_ar: 'لوحتك من مساحات العمل المحفوظة والكيانات والأبحاث والأنظمة المتابعة.', href_en: '/workspace/', href_ar: '/ar/workspace/' },
        { title_en: 'Account', title_ar: 'الحساب', desc_en: 'Sign in to personalize the platform — Free, Premium and Institutional tiers.', desc_ar: 'سجّل الدخول لتخصيص المنصّة — طبقات مجانية وبريميوم ومؤسسية.', href_en: '/account/', href_ar: '/ar/account/' },
      ],
    },
    related: [
      { label_en: 'Market Terminal', label_ar: 'طرفية السوق', href_en: '/market-terminal/', href_ar: '/ar/market-terminal/' },
      { label_en: 'Explorer', label_ar: 'المستكشف', href_en: '/explorer/', href_ar: '/ar/explorer/' },
      { label_en: 'Research Hub', label_ar: 'مركز الأبحاث', href_en: '/research/', href_ar: '/ar/research/' },
      { label_en: 'Intelligence Hub', label_ar: 'مركز الاستخبارات', href_en: '/intelligence/', href_ar: '/ar/intelligence/' },
    ],
  },
};

// Compact, currentColor inline SVG icons keyed off card.icon strings.
const ICONS = {
  gauge:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 13l4-3"/><path d="M12 5V3"/></svg>',
  sector:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="13" width="4" height="8"/><rect x="10" y="9" width="4" height="12"/><rect x="17" y="5" width="4" height="16"/></svg>',
  equity:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19h16"/><path d="M4 5l5 7 4-3 7 8"/></svg>',
  etf:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></svg>',
  filter:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 9v5l-4 2v-7z"/></svg>',
  calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/></svg>',
  doc:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M9 13h6M9 17h4"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M16 8l-2 6-6 2 2-6z"/></svg>',
};

function buildHead(ar, hub) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${hub.rel}`;
  const enUrl = `https://www.tradealphaai.com/${hub.rel}`;
  const arUrl = `https://www.tradealphaai.com/ar/${hub.rel}`;
  const title = `${ar ? hub.title_ar : hub.title_en} | TradeAlphaAI`;
  const desc = ar ? hub.lead_ar : hub.lead_en;
  const depth = (ar ? 1 : 0) + hub.rel.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css', '/css/hub-pages.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? hub.title_ar : hub.title_en, item: url },
    ] } ] };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${enUrl}" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function primaryCard(ar, c) {
  const href = ar ? c.href_ar : c.href_en;
  const icon = ICONS[c.icon] || ICONS.gauge;
  return `      <a class="hub-primary-card" href="${esc(href)}">
        <span class="hub-card-icon" aria-hidden="true">${icon}</span>
        <div class="hub-card-body">
          <span class="hub-card-kicker">${esc(ar ? c.kicker_ar : c.kicker_en)}</span>
          <h3 class="hub-card-title">${esc(ar ? c.title_ar : c.title_en)}</h3>
          <p class="hub-card-desc">${esc(ar ? c.desc_ar : c.desc_en)}</p>
        </div>
        <span class="hub-card-arrow" aria-hidden="true">${ar ? '←' : '→'}</span>
      </a>`;
}

function secondaryCard(ar, c) {
  const href = ar ? c.href_ar : c.href_en;
  return `      <a class="hub-secondary-card" href="${esc(href)}">
        <h4 class="hub-secondary-title">${esc(ar ? c.title_ar : c.title_en)}</h4>
        <p class="hub-secondary-desc">${esc(ar ? c.desc_ar : c.desc_en)}</p>
        <span class="hub-secondary-arrow" aria-hidden="true">${ar ? '←' : '→'}</span>
      </a>`;
}

function buildMain(ar, hub) {
  return `  <main class="market-shell hub-shell" data-hub="${esc(hub.activePage)}">
    <section class="hub-hero">
      <span class="hub-eyebrow">${esc(ar ? hub.eyebrow_ar : hub.eyebrow_en)}</span>
      <h1 class="hub-h1">${esc(ar ? hub.title_ar : hub.title_en)}</h1>
      <p class="hub-lead">${esc(ar ? hub.lead_ar : hub.lead_en)}</p>
    </section>

    <section class="hub-section" id="hub-primary">
      <header class="hub-section-head">
        <span class="hub-section-eyebrow">${esc(ar ? hub.primary.title_ar : hub.primary.title_en)}</span>
        <h2 class="hub-section-h2">${esc(ar ? hub.primary.heading_ar : hub.primary.heading_en)}</h2>
      </header>
      <div class="hub-primary-grid">
${hub.primary.cards.map((c) => primaryCard(ar, c)).join('\n')}
      </div>
    </section>

    <section class="hub-section" id="hub-secondary">
      <header class="hub-section-head">
        <span class="hub-section-eyebrow">${esc(ar ? hub.secondary.title_ar : hub.secondary.title_en)}</span>
        <h2 class="hub-section-h2">${esc(ar ? hub.secondary.heading_ar : hub.secondary.heading_en)}</h2>
      </header>
      <div class="hub-secondary-grid">
${hub.secondary.cards.map((c) => secondaryCard(ar, c)).join('\n')}
      </div>
    </section>

    <section class="hub-section" id="hub-related">
      <header class="hub-section-head">
        <span class="hub-section-eyebrow">${esc(t(ar, 'Related', 'مرتبط'))}</span>
        <h2 class="hub-section-h2">${esc(t(ar, 'Keep exploring', 'تابع الاستكشاف'))}</h2>
      </header>
      <ul class="hub-related-list">
${hub.related.map((r) => `        <li><a href="${esc(ar ? r.href_ar : r.href_en)}">${esc(ar ? r.label_ar : r.label_en)}<span aria-hidden="true">${ar ? '←' : '→'}</span></a></li>`).join('\n')}
      </ul>
    </section>

${hub.activePage === 'markets' ? renderAssetQuickAccess(ar) : ''}

    <section class="hub-section hub-disclaimer">
      <p>${esc(t(ar, 'TradeAlphaAI presents institutional interpretation of observed conditions. No signals, no price targets, no recommendations, no investment advice.', 'تقدم TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة. لا إشارات ولا أهداف سعرية ولا توصيات ولا نصيحة استثمارية.'))}</p>
    </section>
  </main>`;
}

// Markets Hub: full registry of individual asset jump-links. Keeps the
// /markets/<slug>/ discoverable from the hub (covers the
// check:intelligence-indexes "≥ N entity links" rule) AND lets the
// user jump straight to any single asset without going through the
// /markets/assets/ index.
function renderAssetQuickAccess(ar) {
  if (!Array.isArray(ASSETS) || ASSETS.length === 0) return '';
  const prefix = ar ? '/ar/markets' : '/markets';
  const items = ASSETS.map((a) => {
    const role = ar ? (a.role_ar || a.role_en || '') : (a.role_en || a.role_ar || '');
    return `        <li><a href="${prefix}/${esc(a.slug)}/"><span class="hub-quick-symbol">${esc(a.symbol)}</span><span class="hub-quick-role">${esc(role)}</span></a></li>`;
  }).join('\n');
  return `
    <section class="hub-section" id="hub-quick-assets">
      <header class="hub-section-head">
        <span class="hub-section-eyebrow">${esc(t(ar, 'Direct access', 'وصول مباشر'))}</span>
        <h2 class="hub-section-h2">${esc(t(ar, 'Jump to any asset', 'انتقل إلى أي أصل'))}</h2>
      </header>
      <ul class="hub-quick-list">
${items}
      </ul>
    </section>
`;
}

function shell(ar, hub) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({
    locale: lang,
    activePage: hub.activePage,
    arabicHref: `/ar/${hub.rel}`,
    englishHref: `/${hub.rel}`,
  });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${buildHead(ar, hub)}
<body>
${header}
${buildMain(ar, hub)}
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function main() {
  let count = 0;
  for (const hub of Object.values(HUBS)) {
    for (const ar of [false, true]) {
      const html = shell(ar, hub);
      if (WRITE) {
        const out = path.join(ROOT, ar ? `ar/${hub.rel}` : hub.rel, 'index.html');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, html, 'utf8');
        count += 1;
      }
    }
  }
  console.log(WRITE ? `[hub-pages] wrote ${count} pages` : `[hub-pages] dry-run ${Object.keys(HUBS).length * 2} pages`);
}

if (require.main === module) main();

module.exports = { HUBS };
