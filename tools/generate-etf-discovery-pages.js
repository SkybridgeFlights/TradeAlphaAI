'use strict';

// Phase 214 CP8 - ETF discovery pages at /etfs/ and /ar/etfs/.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function templateHeader(ar, slugPath) {
  const templatePath = path.join(ROOT, ar ? 'ar/etfs.html' : 'etfs.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const header = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${slugPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${slugPath}$2`);
  const footer = template.slice(mainEndIdx);
  return { bodyTag, header, footer };
}

function head(ar, slugPath) {
  const title = ar ? 'عالم صناديق المؤشرات | TradeAlphaAI' : 'ETF Intelligence Universe | TradeAlphaAI';
  const desc = ar
    ? 'بوابة اكتشاف لصناديق المؤشرات تربط بين التحليل التقليدي، أبحاث الصناديق، خريطة الصناديق والاستخبارات المؤسسية.'
    : 'A discovery surface for ETFs linking legacy ETF analysis, ETF research, ETF maps and institutional intelligence.';
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: title,
        description: desc,
        url,
        inLanguage: ar ? 'ar' : 'en',
        publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
          { '@type': 'ListItem', position: 2, name: ar ? 'عالم صناديق المؤشرات' : 'ETF Universe', item: url }
        ]
      }
    ]
  };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/${slugPath}" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/${slugPath}" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/${slugPath}" />
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
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="../styles.css" />
  <link rel="stylesheet" href="../landing.css" />
  <link rel="stylesheet" href="../css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function card(kicker, title, body, href) {
  return `          <article class="market-card"><span class="market-card-kicker">${esc(kicker)}</span><h3><a href="${esc(href)}">${esc(title)}</a></h3><p class="market-copy">${esc(body)}</p></article>`;
}

function page(ar) {
  const slugPath = 'etfs/';
  const parts = templateHeader(ar, slugPath);
  const t = (en, arText) => (ar ? arText : en);
  const cards = ETFS.map((etf) => card(etf.symbol, etf.fund_name, ar ? etf.role_ar : etf.role_en, `${ar ? '/ar' : ''}/research/etfs/${etf.slug}/`)).join('\n');
  const main = `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('ETF Universe', 'عالم صناديق المؤشرات'))}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('ETF Intelligence Universe', 'عالم استخبارات صناديق المؤشرات'))}</span><h1>${esc(t('ETF Intelligence Universe', 'عالم استخبارات صناديق المؤشرات'))}</h1><p class="market-lead">${esc(t('A clean discovery layer for ETF analysis, ETF research, visual ETF maps and institutional context. It extends the existing ETF surface without replacing legacy ETF analysis pages.', 'طبقة اكتشاف منظمة لتحليل صناديق المؤشرات وأبحاثها وخرائطها المرئية وسياقها المؤسسي. وهي توسع سطح الصناديق القائم دون استبدال صفحات التحليل القديمة.'))}</p></div></section>
      <section class="market-section" id="etf-discovery-paths"><div class="market-section-head"><span class="eyebrow">${esc(t('Discovery paths', 'مسارات الاكتشاف'))}</span><h2>${esc(t('ETF intelligence surfaces', 'أسطح استخبارات صناديق المؤشرات'))}</h2></div><div class="market-grid three">
${card(t('ETF analysis', 'تحليل الصناديق'), t('Legacy ETF analyzer', 'محلل الصناديق القائم'), t('The existing static ETF analysis and screening surface remains available.', 'يبقى سطح التحليل والفرز الثابت لصناديق المؤشرات متاحا.'), ar ? '/ar/etfs.html' : '/etfs.html')}
${card(t('ETF research', 'أبحاث الصناديق'), t('ETF Research Network', 'شبكة أبحاث الصناديق'), t('Institutional ETF research pages for each covered ETF.', 'صفحات أبحاث مؤسسية لكل صندوق مشمول.'), ar ? '/ar/research/etfs/' : '/research/etfs/')}
${card(t('Visual map', 'خريطة مرئية'), t('ETF Map', 'خريطة الصناديق'), t('Visual ETF universe based on rankings and confirmation context.', 'عالم مرئي للصناديق بناء على الترتيب وسياق التأكيد.'), ar ? '/ar/market-map/etfs/' : '/market-map/etfs/')}
        </div></section>
      <section class="market-section" id="etf-universe-list"><div class="market-section-head"><span class="eyebrow">${esc(t('ETF universe', 'عالم الصناديق'))}</span><h2>${esc(t('Research coverage', 'تغطية الأبحاث'))}</h2></div><div class="market-grid three">
${cards}
        </div></section>
      <section class="market-section" id="etf-discovery-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('ETF intelligence surfaces describe observed institutional context only. They are not trading signals or investment advice.', 'تصف أسطح استخبارات صناديق المؤشرات السياق المؤسسي المرصود فقط. وهي ليست إشارات تداول أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head(ar, slugPath)}
${parts.bodyTag}${parts.header}

${main}
${parts.footer}`;
}

function main() {
  const pages = [
    [path.join(ROOT, 'etfs/index.html'), page(false)],
    [path.join(ROOT, 'ar/etfs/index.html'), page(true)]
  ];
  if (WRITE) {
    for (const [out, html] of pages) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html, 'utf8');
    }
  }
  console.log(`[etf-discovery-pages] ${WRITE ? 'wrote' : 'dry-run'} ${pages.length} pages`);
}

if (require.main === module) main();

module.exports = { page };
