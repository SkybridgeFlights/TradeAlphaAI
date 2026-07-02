#!/usr/bin/env node
'use strict';

// Programmatic SEO: generates additional /compare/ pages from a curated
// pairs table. Complements the 45 hand-authored comparison pages already in
// the repo — each new pair targets a distinct high-search-volume query
// ("AAPL vs MSFT", "VOO vs IVV", etc.).
//
// Emits both EN and AR versions per pair, following the site's canonical
// design system: <body class="market-page"> + GLOBAL_HEADER markers + the
// .market-shell / .market-panel / .insight-* / .comparison-* class stack
// that the pre-existing compare pages use.
//
// Only creates a page if the file doesn't already exist — this respects any
// hand-authored version.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.tradealphaai.com';
const DATA_PATH = path.join(ROOT, 'data', 'comparisons-extra.json');

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function slugPair(a, b) {
  return `${a}-vs-${b}`.toLowerCase();
}

function readPairs() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).pairs || [];
}

function jsonLd(pair, isAr) {
  const url = `${SITE}/${isAr ? 'ar/' : ''}compare/${slugPair(pair.a, pair.b)}.html`;
  const name = isAr
    ? `${pair.a} مقابل ${pair.b} — مقارنة تعليمية`
    : `${pair.a} vs ${pair.b}: Comparison`;
  const desc = isAr
    ? `مقارنة تعليمية بين ${pair.name_a_ar} (${pair.a}) و${pair.name_b_ar} (${pair.b}) — الموضوعات والقطاع وسياق البحث. ليست نصيحة استثمارية.`
    : `Educational comparison of ${pair.name_a} (${pair.a}) and ${pair.name_b} (${pair.b}) — themes, sector, and research context. Not investment advice.`;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name, description: desc, url, inLanguage: isAr ? 'ar' : 'en' },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: isAr ? 'المقارنات' : 'Comparisons', item: `${SITE}/${isAr ? 'ar/' : ''}compare/` },
          { '@type': 'ListItem', position: 3, name: `${pair.a} ${isAr ? 'مقابل' : 'vs'} ${pair.b}`, item: url }
        ]
      }
    ]
  }, null, 2);
}

function themeRow(themes) {
  return themes.map((t) => `<li>${esc(t)}</li>`).join('');
}

function renderPage(pair, allPairs, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const slug = slugPair(pair.a, pair.b);
  const canonical = `${SITE}/${isAr ? 'ar/' : ''}compare/${slug}.html`;
  const altEn = `${SITE}/compare/${slug}.html`;
  const altAr = `${SITE}/ar/compare/${slug}.html`;

  const title = isAr
    ? `${pair.a} مقابل ${pair.b}: مقارنة الأداء والموضوعات والمخاطر | TradeAlphaAI`
    : `${pair.a} vs ${pair.b} Comparison: Performance, Themes & Risk | TradeAlphaAI`;

  const description = isAr
    ? `مقارنة تعليمية بين ${pair.name_a_ar} (${pair.a}) و${pair.name_b_ar} (${pair.b}): التموضع القطاعي، سياق الأداء، عوامل المخاطرة. ليست نصيحة مالية.`
    : `Compare ${pair.name_a} (${pair.a}) vs ${pair.name_b} (${pair.b}): sector positioning, performance context, risk factors. Not financial advice.`;

  const homeLabel = isAr ? 'الرئيسية' : 'Home';
  const compareLabel = isAr ? 'المقارنات' : 'Comparisons';
  const vs = isAr ? 'مقابل' : 'vs';
  const name_a = isAr ? pair.name_a_ar : pair.name_a;
  const name_b = isAr ? pair.name_b_ar : pair.name_b;
  const themes_a = isAr ? pair.themes_a_ar : pair.themes_a;
  const themes_b = isAr ? pair.themes_b_ar : pair.themes_b;
  const sector = isAr ? pair.sector_ar : pair.sector;

  const type = pair.type || 'stock';
  const typeLabel = isAr ? (type === 'etf' ? 'صندوق ETF' : 'سهم') : (type === 'etf' ? 'ETF' : 'Stock');

  const nearby = allPairs
    .filter((p) => p !== pair && (p.sector === pair.sector))
    .slice(0, 4)
    .map((p) => `<a class="compare-card" href="/${isAr ? 'ar/' : ''}compare/${slugPair(p.a, p.b)}.html"><strong>${p.a} ${vs} ${p.b}</strong><span>${esc(isAr ? p.sector_ar : p.sector)}</span><small>${isAr ? 'افتح المقارنة' : 'Open comparison'}</small></a>`).join('');

  const items = JSON.stringify([{ symbol: pair.a, type }, { symbol: pair.b, type }]);

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${altEn}" />
  <link rel="alternate" hreflang="ar" href="${altAr}" />
  <link rel="alternate" hreflang="x-default" href="${altEn}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta property="og:locale" content="${isAr ? 'ar_SA' : 'en_US'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${jsonLd(pair, isAr)}
  </script>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${homeLabel}</a><span>/</span><a href="/${isAr ? 'ar/' : ''}compare/">${compareLabel}</a><span>/</span><span>${pair.a} ${vs} ${pair.b}</span></nav>

      <section class="market-section">
        <div class="market-panel detail-header comparison-header">
          <div class="detail-title">
            <span class="eyebrow">${isAr ? 'محرك المقارنة' : 'Comparison Engine'}</span>
            <h1>${pair.a} ${vs} ${pair.b}</h1>
            <p class="market-lead">${isAr
              ? `تقارن هذه الصفحة ${pair.a} و${pair.b} من خلال سياق البحث التعليمي، لا كتوصية شراء أو بيع.`
              : `This page compares ${pair.a} and ${pair.b} through educational research context, not as a buy or sell recommendation.`}</p>
            <div class="detail-meta"><span>${pair.a} / ${pair.b}</span><span class="risk-badge">${typeLabel} ${isAr ? 'مقارنة' : 'comparison'}</span></div>
          </div>
          <aside class="market-card score-card">
            <h2>${isAr ? 'أسعار حية' : 'Live price hooks'}</h2>
            <p>${isAr ? 'تُحدَّث الأسعار من نقطة نهاية بيانات السوق عند توفرها.' : 'Prices update from the serverless market-data endpoint when available.'}</p>
            <div class="price-line comparison-price-line"><strong data-live-price="${pair.a}">${isAr ? 'جارٍ التحميل' : 'Loading price'}</strong><span class="setup-badge" data-live-change="${pair.a}">${isAr ? 'جارٍ' : 'Loading'}</span></div>
            <div class="price-line comparison-price-line"><strong data-live-price="${pair.b}">${isAr ? 'جارٍ التحميل' : 'Loading price'}</strong><span class="setup-badge" data-live-change="${pair.b}">${isAr ? 'جارٍ' : 'Loading'}</span></div>
          </aside>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <span class="eyebrow">${isAr ? 'جدول المقارنة' : 'Comparison Table'}</span>
          <h2>${pair.a} ${vs} ${pair.b} ${isAr ? 'مقارنة سريعة' : 'quick comparison'}</h2>
          <div class="comparison-table-wrap">
            <table class="comparison-table">
              <thead><tr><th>${isAr ? 'المقياس' : 'Metric'}</th><th>${pair.a}</th><th>${pair.b}</th></tr></thead>
              <tbody>
                <tr><td>${isAr ? 'الاسم' : 'Name'}</td><td>${esc(name_a)}</td><td>${esc(name_b)}</td></tr>
                <tr><td>${isAr ? 'النوع' : 'Type'}</td><td>${typeLabel}</td><td>${typeLabel}</td></tr>
                <tr><td>${isAr ? 'القطاع أو الفئة' : 'Sector or category'}</td><td>${esc(sector)}</td><td>${esc(sector)}</td></tr>
                <tr><td>${isAr ? 'الموضوعات الرئيسية' : 'Primary themes'}</td><td>${esc(themes_a.join(', '))}</td><td>${esc(themes_b.join(', '))}</td></tr>
                <tr><td>${isAr ? 'زاوية البحث' : 'Research angle'}</td><td>${isAr
                  ? `يتابع المستثمرون ${pair.a} لإشارات حول ${esc(themes_a[0])} ومتانة الإيرادات والتموضع التنافسي وحساسية التقييم وقيادة القطاع.`
                  : `Investors follow ${pair.a} for signals about ${esc(themes_a[0].toLowerCase())}, revenue durability, competitive positioning, valuation sensitivity, and sector leadership.`}</td>
                <td>${isAr
                  ? `يتابع المستثمرون ${pair.b} لإشارات حول ${esc(themes_b[0])} ومتانة الإيرادات والتموضع التنافسي وحساسية التقييم وقيادة القطاع.`
                  : `Investors follow ${pair.b} for signals about ${esc(themes_b[0].toLowerCase())}, revenue durability, competitive positioning, valuation sensitivity, and sector leadership.`}</td></tr>
                <tr><td>${isAr ? 'عوامل الخطر' : 'Risk factors'}</td><td>${isAr ? 'مخاطر التقييم، حساسية الأرباح، تقلب القطاع' : 'valuation risk, earnings sensitivity, sector volatility'}</td><td>${isAr ? 'مخاطر التقييم، حساسية الأرباح، تقلب القطاع' : 'valuation risk, earnings sensitivity, sector volatility'}</td></tr>
                <tr><td>${isAr ? 'سياق التقييم' : 'Valuation context'}</td><td>${isAr
                  ? `يُقيَّم ${pair.a} عبر نمو الإيرادات وجودة الهامش ومتانة التدفق النقدي الحر ومضاعفات الأقران، لا كإشارة شراء أو بيع.`
                  : `${pair.a} should be evaluated through revenue growth, margin quality, free cash flow durability, and peer-relative multiples, not as a buy or sell signal.`}</td>
                <td>${isAr
                  ? `يُقيَّم ${pair.b} عبر نمو الإيرادات وجودة الهامش ومتانة التدفق النقدي الحر ومضاعفات الأقران، لا كإشارة شراء أو بيع.`
                  : `${pair.b} should be evaluated through revenue growth, margin quality, free cash flow durability, and peer-relative multiples, not as a buy or sell signal.`}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="market-section">
        <div class="content-columns">
          <article class="market-panel">
            <span class="eyebrow">${pair.a}</span>
            <h2>${esc(name_a)}</h2>
            <p class="market-copy">${isAr
              ? `يُتابَع ${esc(name_a)} كأصل بحث تعليمي لأنه يتصل بموضوعات ${esc(themes_a.slice(0, 2).join(' و'))} داخل أسواق الأسهم العامة.`
              : `${esc(name_a)} is tracked as an educational research asset because it connects to ${esc(themes_a.slice(0, 2).join(' and '))} themes within public equity markets.`}</p>
            <ul class="insight-list">${themeRow(themes_a)}</ul>
          </article>
          <article class="market-panel">
            <span class="eyebrow">${pair.b}</span>
            <h2>${esc(name_b)}</h2>
            <p class="market-copy">${isAr
              ? `يُتابَع ${esc(name_b)} كأصل بحث تعليمي لأنه يتصل بموضوعات ${esc(themes_b.slice(0, 2).join(' و'))} داخل أسواق الأسهم العامة.`
              : `${esc(name_b)} is tracked as an educational research asset because it connects to ${esc(themes_b.slice(0, 2).join(' and '))} themes within public equity markets.`}</p>
            <ul class="insight-list">${themeRow(themes_b)}</ul>
          </article>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <span class="eyebrow">${isAr ? 'مسارات البحث ذات الصلة' : 'Related research paths'}</span>
          <h2>${isAr ? 'تابع بحث المقارنة' : 'Continue comparison research'}</h2>
          <div class="cta-actions">
            <a class="market-btn primary" href="/${isAr ? 'ar/' : ''}${type === 'etf' ? 'etfs' : 'stocks'}/${pair.a.toLowerCase()}.html">${pair.a}</a>
            <a class="market-btn primary" href="/${isAr ? 'ar/' : ''}${type === 'etf' ? 'etfs' : 'stocks'}/${pair.b.toLowerCase()}.html">${pair.b}</a>
            <a class="market-btn" href="/${isAr ? 'ar/' : ''}rankings.html">${isAr ? 'الترتيب' : 'Rankings'}</a>
            <a class="market-btn" href="/${isAr ? 'ar/' : ''}ai-stock-screener.html">${isAr ? 'ماسح السوق' : 'Market Screener'}</a>
          </div>
        </div>
      </section>

      ${nearby ? `<section class="market-section">
        <div class="market-panel compare-panel">
          <span class="eyebrow">${isAr ? 'مقارنات ذات صلة' : 'Related comparisons'}</span>
          <h2>${isAr ? 'تابع مع صفحات مقارنة قريبة' : 'Continue with nearby comparison pages'}</h2>
          <div class="compare-grid">${nearby}</div>
        </div>
      </section>` : ''}

      <section class="market-section">
        <div class="market-panel stock-faq">
          <span class="eyebrow">FAQ</span>
          <h2>${pair.a} ${vs} ${pair.b} FAQ</h2>
          <details open><summary>${isAr ? `هل هذه المقارنة نصيحة مالية؟` : `Is the ${pair.a} vs ${pair.b} comparison financial advice?`}</summary><p>${isAr ? 'لا. هذه الصفحة تعليمية ومعلوماتية فقط ولا تقدم نصيحة مالية أو استثمارية.' : 'No. This page is educational and informational only and does not provide financial or investment advice.'}</p></details>
          <details><summary>${isAr ? `كيف أستخدم هذه المقارنة؟` : `How should I use this ${pair.a} vs ${pair.b} comparison?`}</summary><p>${isAr ? 'استخدمها لمراجعة الاختلافات في الموضوعات والمخاطر وسياق البحث قبل فتح صفحات الأصول والمنهجية.' : 'Use it to review differences in themes, risks, and research context before opening the asset pages and methodology.'}</p></details>
          <details><summary>${isAr ? 'هل تستخدم الصفحة بيانات حية؟' : 'Does this page use live data?'}</summary><p>${isAr ? 'تحاول الصفحة تحديث حقول الأسعار من /api/market-data عند توفرها مع الإبقاء على محتوى البحث ثابتاً.' : 'The page attempts to update price fields from /api/market-data when available while keeping the research content static.'}</p></details>
        </div>
      </section>

    </div>
  </main>

  <script>
  (() => {
    const items = ${items};
    const money = (value) => Number(value).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
    const change = (value) => \`\${Number(value) >= 0 ? "+" : ""}\${Number(value).toFixed(2)}%\`;
    items.forEach((item) => {
      fetch(\`/api/market-data?symbol=\${encodeURIComponent(item.symbol)}&type=\${encodeURIComponent(item.type)}\`, { headers: { Accept: "application/json" } })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (!payload || !payload.asset) return;
          document.querySelectorAll(\`[data-live-price="\${item.symbol}"]\`).forEach((node) => { node.textContent = money(payload.asset.price); });
          document.querySelectorAll(\`[data-live-change="\${item.symbol}"]\`).forEach((node) => {
            node.textContent = change(payload.asset.changePercent);
            node.classList.toggle("positive", Number(payload.asset.changePercent) >= 0);
            node.classList.toggle("negative", Number(payload.asset.changePercent) < 0);
          });
        })
        .catch(() => {});
    });
  })();
  </script>
</body>
</html>
`;
}

function main() {
  const pairs = readPairs();
  if (!pairs.length) { console.error('[comparisons] no pairs'); process.exit(1); }

  const enDir = path.join(ROOT, 'compare');
  const arDir = path.join(ROOT, 'ar', 'compare');
  fs.mkdirSync(enDir, { recursive: true });
  fs.mkdirSync(arDir, { recursive: true });

  let written = 0, skipped = 0;
  for (const pair of pairs) {
    const slug = slugPair(pair.a, pair.b);
    const enFile = path.join(enDir, `${slug}.html`);
    const arFile = path.join(arDir, `${slug}.html`);

    // Never overwrite hand-authored pages that predate this generator.
    if (fs.existsSync(enFile)) { skipped++; }
    else { fs.writeFileSync(enFile, renderPage(pair, pairs, false), 'utf8'); written++; }

    if (fs.existsSync(arFile)) { skipped++; }
    else { fs.writeFileSync(arFile, renderPage(pair, pairs, true), 'utf8'); written++; }
  }

  console.log(`[comparisons] pairs in dataset:  ${pairs.length}`);
  console.log(`[comparisons] pages written:     ${written}`);
  console.log(`[comparisons] pages preserved:   ${skipped}`);
}

if (require.main === module) main();

module.exports = { renderPage, slugPair };
