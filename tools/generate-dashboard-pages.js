'use strict';

/**
 * generate-dashboard-pages.js — Phase 68 Part C
 *
 * Generates the six dashboard index pages (EN + AR for each of three types).
 *   /market-dashboard/index.html
 *   /ar/market-dashboard/index.html
 *   /macro-dashboard/index.html
 *   /ar/macro-dashboard/index.html
 *   /etf-dashboard/index.html
 *   /ar/etf-dashboard/index.html
 *
 * Pages load data client-side from data/visual/*.json via js/visual-intelligence.js.
 * Global header is applied by apply-global-header.js after generation.
 *
 * Usage: node tools/generate-dashboard-pages.js [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const DASHBOARDS = [
  {
    type:     'market-dashboard',
    slug:     'market-dashboard',
    title_en: 'Market Dashboard — TradeAlphaAI',
    title_ar: 'لوحة تحكم السوق — TradeAlphaAI',
    desc_en:  'Live market intelligence dashboard: regime gauge, sector rotation, breadth analysis, and cross-asset signals.',
    desc_ar:  'لوحة تحكم استخباراتية للسوق: مقياس النظام، دوران القطاعات، تحليل الاتساع، وإشارات الأصول المتقاطعة.',
    eyebrow_en: 'Market Intelligence',
    eyebrow_ar: 'الذكاء السوقي',
    h1_en:    'Market Dashboard',
    h1_ar:    'لوحة تحكم السوق',
    focus:    ['regime', 'sector_rotation', 'cross_asset', 'volatility'],
  },
  {
    type:     'macro-dashboard',
    slug:     'macro-dashboard',
    title_en: 'Macro Dashboard — TradeAlphaAI',
    title_ar: 'لوحة التحكم الكلي — TradeAlphaAI',
    desc_en:  'Macro intelligence dashboard: yield curve context, Fed rate path, inflation regime, and duration sensitivity.',
    desc_ar:  'لوحة تحكم الاقتصاد الكلي: سياق منحنى العائد، مسار فائدة الاحتياطي الفيدرالي، نظام التضخم، وحساسية المدة.',
    eyebrow_en: 'Macro Intelligence',
    eyebrow_ar: 'الذكاء الكلي',
    h1_en:    'Macro Dashboard',
    h1_ar:    'لوحة التحكم الكلي',
    focus:    ['yield_curve', 'rate_path', 'regime', 'cross_asset'],
  },
  {
    type:     'etf-dashboard',
    slug:     'etf-dashboard',
    title_en: 'ETF Dashboard — TradeAlphaAI',
    title_ar: 'لوحة تحكم الصناديق — TradeAlphaAI',
    desc_en:  'ETF intelligence dashboard: sector ETF trends, relationship map, flow signals, and rotation context.',
    desc_ar:  'لوحة تحكم صناديق الاستثمار المتداولة: اتجاهات صناديق القطاعات، خريطة العلاقات، إشارات التدفق، وسياق الدوران.',
    eyebrow_en: 'ETF Intelligence',
    eyebrow_ar: 'ذكاء الصناديق',
    h1_en:    'ETF Dashboard',
    h1_ar:    'لوحة تحكم الصناديق',
    focus:    ['etf_map', 'sector_rotation', 'cross_asset', 'volatility'],
  },
];

let generated = 0;

for (const dash of DASHBOARDS) {
  for (const locale of ['en', 'ar']) {
    const ar      = locale === 'ar';
    const relDir  = ar ? `ar/${dash.type}` : dash.type;
    const outDir  = path.join(ROOT, relDir);
    const outFile = path.join(outDir, 'index.html');

    const html = renderDashboard(dash, ar);

    if (DRY_RUN) {
      console.log(`[generate-dashboard-pages] [dry] would write: ${relDir}/index.html`);
    } else {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, html, 'utf8');
      console.log(`[generate-dashboard-pages] Written: ${relDir}/index.html`);
    }
    generated++;
  }
}

console.log(`[generate-dashboard-pages] ${DRY_RUN ? '[dry] would generate' : 'Generated'} ${generated} pages.`);

// ── HTML renderer ─────────────────────────────────────────────────────────────

function renderDashboard(dash, ar) {
  const lang     = ar ? 'ar' : 'en';
  const dir      = ar ? 'rtl' : 'ltr';
  const title    = ar ? dash.title_ar    : dash.title_en;
  const desc     = ar ? dash.desc_ar     : dash.desc_en;
  const eyebrow  = ar ? dash.eyebrow_ar  : dash.eyebrow_en;
  const h1       = ar ? dash.h1_ar       : dash.h1_en;
  const slug     = dash.slug;

  const canonical = ar
    ? `https://www.tradealphaai.com/ar/${slug}/`
    : `https://www.tradealphaai.com/${slug}/`;

  const altHref = ar
    ? `/${slug}/`
    : `/ar/${slug}/`;

  const disclaimerEn = 'Educational and informational content only. Not financial or investment advice. Past performance does not predict future results.';
  const disclaimerAr = 'محتوى تعليمي ومعلوماتي فقط. ليست نصيحة مالية أو استثمارية. الأداء السابق لا يتنبأ بالنتائج المستقبلية.';

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(desc)}">
  <meta property="og:title" content="${escHtml(title)}">
  <meta property="og:description" content="${escHtml(desc)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="${ar ? 'en' : 'ar'}" href="https://www.tradealphaai.com${altHref}">
  <link rel="stylesheet" href="../styles.css">
  <link rel="stylesheet" href="../landing.css">
  <link rel="stylesheet" href="/css/global-header.css">
  <link rel="stylesheet" href="/css/global-layout.css">
  <link rel="stylesheet" href="/css/responsive.css">
  <link rel="stylesheet" href="/css/visual-intelligence.css">
  <script>window.DASHBOARD_TYPE="${escHtml(slug)}";window.DASHBOARD_LOCALE="${lang}";</script>
</head>
<body class="dashboard-page">
  <div class="reading-progress"><span></span></div>
<!-- GLOBAL_HEADER_START -->
<!-- GLOBAL_HEADER_END -->

  <main class="dashboard-shell" id="main-content">
    <div class="dashboard-hero">
      <div class="section-panel">
        <span class="eyebrow">${escHtml(eyebrow)}</span>
        <h1 class="dashboard-title">${escHtml(h1)}</h1>
        <p class="dashboard-subtitle" id="dashboard-headline">${ar ? 'جارٍ تحميل بيانات الذكاء...' : 'Loading intelligence data...'}</p>
        <div class="dashboard-meta" id="dashboard-meta">
          <span class="data-quality-badge" data-quality="loading">${ar ? 'جاري التحميل' : 'Loading'}</span>
          <span class="data-freshness" id="data-freshness"></span>
        </div>
      </div>
    </div>

    <!-- Section 1: Market Regime Gauge -->
    <section class="dashboard-section" id="section-regime" aria-label="${ar ? 'مقياس نظام السوق' : 'Market Regime Gauge'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'تحليل النظام' : 'Regime Analysis'}</span>
          <h2>${ar ? 'مقياس نظام السوق' : 'Market Regime Gauge'}</h2>
          <p class="market-copy">${ar ? 'تصنيف شامل للنظام الكلي السائد عبر سبعة أبعاد. للأغراض التعليمية فقط.' : 'Comprehensive classification of the prevailing macro regime across seven dimensions. Educational only.'}</p>
        </div>
        <div class="regime-gauge-grid" id="regime-gauge-grid" role="list">
          ${renderLoadingPlaceholders(7, ar)}
        </div>
      </div>
    </section>

    <!-- Section 2: Cross-Asset Impact Map -->
    <section class="dashboard-section" id="section-cross-asset" aria-label="${ar ? 'خريطة تأثير الأصول المتقاطعة' : 'Cross-Asset Impact Map'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'الأصول المتقاطعة' : 'Cross-Asset'}</span>
          <h2>${ar ? 'خريطة الأصول والتأثيرات' : 'Cross-Asset Impact Map'}</h2>
          <p class="market-copy">${ar ? 'اتجاهات الأصول الرئيسية وسلاسل انتقال الصدمات الكلية.' : 'Key asset trends and macro shock transmission chains.'}</p>
        </div>
        <div class="cross-asset-grid" id="cross-asset-grid" role="list">
          ${renderLoadingPlaceholders(6, ar)}
        </div>
        <div class="transmission-chains" id="transmission-chains">
          <h3 class="sub-heading">${ar ? 'سلاسل الانتقال' : 'Transmission Chains'}</h3>
          <div class="chain-list" id="chain-list">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
        </div>
      </div>
    </section>

    <!-- Section 3: Sector Rotation View -->
    <section class="dashboard-section" id="section-sectors" aria-label="${ar ? 'دوران القطاعات' : 'Sector Rotation View'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'دوران القطاعات' : 'Sector Rotation'}</span>
          <h2>${ar ? 'خريطة دوران القطاعات' : 'Sector Rotation View'}</h2>
          <p class="market-copy">${ar ? 'مشاركة القطاعات ومؤشرات الزخم المستخرجة من إشارات الأموال المؤسسية.' : 'Sector participation and momentum signals derived from institutional flow indicators.'}</p>
        </div>
        <div class="sector-heatmap" id="sector-heatmap" role="list">
          ${renderLoadingPlaceholders(8, ar)}
        </div>
      </div>
    </section>

    <!-- Section 4: Yield Curve Context -->
    <section class="dashboard-section" id="section-yield-curve" aria-label="${ar ? 'سياق منحنى العائد' : 'Yield Curve Context'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'منحنى العائد والفائدة' : 'Yield Curve &amp; Rates'}</span>
          <h2>${ar ? 'سياق منحنى العائد' : 'Yield Curve Context'}</h2>
          <p class="market-copy">${ar ? 'شكل منحنى العائد وتوقعات مسار الفائدة وحساسية المدة.' : 'Yield curve shape, Fed rate path expectations, and duration sensitivity.'}</p>
        </div>
        <div class="yield-curve-layout" id="yield-curve-layout">
          <div class="yield-state-card" id="yield-state-card">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
          <div class="fed-path-card" id="fed-path-card">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
          <div class="duration-sensitivity-card" id="duration-sensitivity-card">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
        </div>
      </div>
    </section>

    <!-- Section 5: Volatility State -->
    <section class="dashboard-section" id="section-volatility" aria-label="${ar ? 'حالة التقلب' : 'Volatility State'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'نظام التقلب' : 'Volatility Regime'}</span>
          <h2>${ar ? 'لوحة حالة التقلب' : 'Volatility State'}</h2>
          <p class="market-copy">${ar ? 'مستوى VIX ونظام التقلب الحالي والسياق التاريخي.' : 'VIX level, current volatility regime, and historical context.'}</p>
        </div>
        <div class="volatility-layout" id="volatility-layout">
          <div class="vix-gauge-container" id="vix-gauge-container">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
          <div class="vol-regime-detail" id="vol-regime-detail">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
        </div>
      </div>
    </section>

    <!-- Section 6: ETF Relationship Map -->
    <section class="dashboard-section" id="section-etf-map" aria-label="${ar ? 'خريطة علاقات الصناديق' : 'ETF Relationship Map'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'علاقات الصناديق' : 'ETF Relationships'}</span>
          <h2>${ar ? 'خريطة علاقات صناديق الاستثمار المتداولة' : 'ETF Relationship Map'}</h2>
          <p class="market-copy">${ar ? 'العلاقات الهيكلية بين الصناديق الرئيسية وإشارات التدفق وسياق الدوران.' : 'Structural relationships between key ETFs, flow signals, and rotation context.'}</p>
        </div>
        <div class="etf-grid" id="etf-grid" role="list">
          ${renderLoadingPlaceholders(9, ar)}
        </div>
        <div class="etf-relationships" id="etf-relationships">
          <h3 class="sub-heading">${ar ? 'العلاقات الرئيسية' : 'Key Relationships'}</h3>
          <div class="relationship-list" id="relationship-list">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
        </div>
      </div>
    </section>

    <!-- Section 7: Latest Market Outlook -->
    <section class="dashboard-section" id="section-outlook-links" aria-label="${ar ? 'أحدث تقارير توقعات السوق' : 'Latest Market Outlook'}">
      <div class="section-panel">
        <div class="section-head">
          <span class="eyebrow">${ar ? 'تقارير الأبحاث' : 'Research Reports'}</span>
          <h2>${ar ? 'أحدث تقارير توقعات السوق' : 'Latest Market Outlook'}</h2>
        </div>
        <div class="outlook-links" id="outlook-links">${ar ? 'جارٍ التحميل...' : 'Loading...'}</div>
        <div class="view-all-link">
          <a href="${ar ? '/ar/market-outlook/' : '/market-outlook/'}" class="btn-secondary">
            ${ar ? 'عرض جميع التقارير' : 'View All Reports'}
          </a>
        </div>
      </div>
    </section>

    <!-- Educational disclaimer -->
    <section class="dashboard-section section-tight">
      <div class="section-panel">
        <p class="disclaimer-text">
          <strong>${ar ? 'إشعار قانوني:' : 'Legal Notice:'}</strong>
          ${ar ? escHtml(disclaimerAr) : escHtml(disclaimerEn)}
        </p>
      </div>
    </section>
  </main>

  <script src="/js/visual-intelligence.js" defer></script>
  <script src="/js/mobile-nav.js" defer></script>
</body>
</html>`;
}

function renderLoadingPlaceholders(count, ar) {
  return Array.from({ length: count }, (_, i) =>
    `<div class="vi-card vi-card--loading" role="listitem" aria-label="${ar ? 'جارٍ التحميل' : 'Loading'}">
        <span class="vi-card__skeleton"></span>
      </div>`
  ).join('\n      ');
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
