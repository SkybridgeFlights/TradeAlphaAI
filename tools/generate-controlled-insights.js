#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BASE_URL = 'https://www.tradealphaai.com';
const DATE = '2026-05-31';

const ARTICLES = [
  article({
    slug: 'ai-stocks-market-overview',
    type: 'Market Snapshot',
    category: 'AI Stocks',
    title: 'AI Stocks Market Overview: Infrastructure, Software, and ETF Exposure',
    arTitle: 'نظرة عامة على أسهم الذكاء الاصطناعي: البنية التحتية والبرمجيات وصناديق المؤشرات',
    description: 'Educational AI stocks market overview covering infrastructure, software platforms, ETF exposure, risks, and related TradeAlphaAI research links.',
    arDescription: 'نظرة تعليمية على أسهم الذكاء الاصطناعي تغطي البنية التحتية والبرمجيات وصناديق المؤشرات والمخاطر وروابط أبحاث TradeAlphaAI.',
    focus: 'AI infrastructure and software exposure',
    arFocus: 'تعرض البنية التحتية والبرمجيات للذكاء الاصطناعي',
    symbols: ['NVDA', 'MSFT', 'META', 'GOOGL', 'QQQ'],
    links: [
      l('/ai-stocks.html', 'AI Stocks Hub', 'محور أسهم الذكاء الاصطناعي'),
      l('/stocks/nvda.html', 'NVDA stock research', 'أبحاث سهم NVDA'),
      l('/stocks/msft.html', 'MSFT stock research', 'أبحاث سهم MSFT'),
      l('/etfs/qqq.html', 'QQQ ETF research', 'أبحاث صندوق QQQ'),
      l('/rankings.html#top-ai-stocks', 'Best AI stocks ranking', 'تصنيف أفضل أسهم الذكاء الاصطناعي')
    ]
  }),
  article({
    slug: 'semiconductor-stocks-outlook',
    type: 'Sector Outlook',
    category: 'Semiconductors',
    title: 'Semiconductor Stocks Outlook: AI Chips, Cycles, and Supply Chain Risk',
    arTitle: 'توقعات قطاع أشباه الموصلات: رقائق الذكاء الاصطناعي والدورات ومخاطر سلسلة التوريد',
    description: 'Educational semiconductor stocks outlook focused on AI chip demand, inventory cycles, supply-chain constraints, ETF exposure, and risk context.',
    arDescription: 'نظرة تعليمية على أسهم أشباه الموصلات تركز على طلب رقائق الذكاء الاصطناعي ودورات المخزون وسلسلة التوريد وسياق المخاطر.',
    focus: 'AI chip demand and semiconductor cycle risk',
    arFocus: 'طلب رقائق الذكاء الاصطناعي ومخاطر دورة أشباه الموصلات',
    symbols: ['NVDA', 'AMD', 'AVGO', 'SOXX', 'SMH'],
    links: [
      l('/semiconductor-stocks.html', 'Semiconductor stocks hub', 'محور أسهم أشباه الموصلات'),
      l('/compare/nvda-vs-amd.html', 'NVDA vs AMD comparison', 'مقارنة NVDA و AMD'),
      l('/stocks/amd.html', 'AMD stock research', 'أبحاث سهم AMD'),
      l('/etfs/soxx.html', 'SOXX ETF research', 'أبحاث صندوق SOXX'),
      l('/insights/semiconductor-cycle-risks.html', 'Semiconductor cycle risks', 'مخاطر دورة أشباه الموصلات')
    ]
  }),
  article({
    slug: 'cybersecurity-stocks-to-watch',
    type: 'Sector Outlook',
    category: 'Cybersecurity',
    title: 'Cybersecurity Stocks to Watch: Platform Demand, Cloud Security, and Risk Context',
    arTitle: 'أسهم الأمن السيبراني للمتابعة البحثية: طلب المنصات وأمن السحابة وسياق المخاطر',
    description: 'Educational cybersecurity stocks article covering platform demand, cloud security themes, valuation sensitivity, and related research links.',
    arDescription: 'مقال تعليمي عن أسهم الأمن السيبراني يغطي طلب المنصات وأمن السحابة وحساسية التقييم وروابط الأبحاث المرتبطة.',
    focus: 'cybersecurity platform demand and cloud security',
    arFocus: 'طلب منصات الأمن السيبراني وأمن السحابة',
    symbols: ['CRWD', 'PANW', 'ZS', 'FTNT'],
    links: [
      l('/cybersecurity-stocks.html', 'Cybersecurity stocks hub', 'محور أسهم الأمن السيبراني'),
      l('/stocks/crwd.html', 'CRWD stock research', 'أبحاث سهم CRWD'),
      l('/stocks/panw.html', 'PANW stock research', 'أبحاث سهم PANW'),
      l('/stocks/zs.html', 'ZS stock research', 'أبحاث سهم ZS'),
      l('/rankings.html', 'Market rankings', 'تصنيفات السوق')
    ]
  }),
  article({
    slug: 'cloud-computing-stocks-overview',
    type: 'Sector Outlook',
    category: 'Cloud Computing',
    title: 'Cloud Computing Stocks Overview: Hyperscalers, Software, and AI Capacity',
    arTitle: 'نظرة عامة على أسهم الحوسبة السحابية: مزودو السحابة والبرمجيات وسعة الذكاء الاصطناعي',
    description: 'Educational cloud computing stocks overview linking hyperscaler capital spending, software demand, margins, and AI infrastructure exposure.',
    arDescription: 'نظرة تعليمية على أسهم الحوسبة السحابية تربط إنفاق مزودي السحابة وطلب البرمجيات والهوامش وتعرض البنية التحتية للذكاء الاصطناعي.',
    focus: 'hyperscaler spending and cloud software demand',
    arFocus: 'إنفاق مزودي السحابة وطلب برمجيات السحابة',
    symbols: ['MSFT', 'AMZN', 'GOOGL', 'CRM', 'NOW'],
    links: [
      l('/cloud-stocks.html', 'Cloud stocks hub', 'محور أسهم الحوسبة السحابية'),
      l('/stocks/msft.html', 'MSFT stock research', 'أبحاث سهم MSFT'),
      l('/stocks/amzn.html', 'AMZN stock research', 'أبحاث سهم AMZN'),
      l('/stocks/googl.html', 'GOOGL stock research', 'أبحاث سهم GOOGL'),
      l('/insights/cloud-computing-ai-market-structure.html', 'Cloud computing market structure', 'هيكل سوق الحوسبة السحابية')
    ]
  }),
  article({
    slug: 'spy-vs-qqq-etf-comparison-guide',
    type: 'ETF Comparison Article',
    category: 'ETF Education',
    title: 'SPY vs QQQ: ETF Comparison Guide for Index Exposure Research',
    arTitle: 'مقارنة SPY و QQQ: دليل بحثي لتعرض المؤشرات',
    description: 'Educational SPY vs QQQ comparison guide covering index methodology, sector concentration, cost context, and related ETF research paths.',
    arDescription: 'دليل تعليمي لمقارنة SPY و QQQ يغطي منهجية المؤشر والتركيز القطاعي وسياق التكلفة ومسارات أبحاث الصناديق المرتبطة.',
    focus: 'S&P 500 and Nasdaq-100 ETF exposure',
    arFocus: 'تعرض صندوقي S&P 500 وناسداك 100',
    symbols: ['SPY', 'QQQ', 'VTI', 'VOO'],
    links: [
      l('/compare/spy-vs-qqq.html', 'SPY vs QQQ comparison page', 'صفحة مقارنة SPY و QQQ'),
      l('/etfs/spy.html', 'SPY ETF research', 'أبحاث صندوق SPY'),
      l('/etfs/qqq.html', 'QQQ ETF research', 'أبحاث صندوق QQQ'),
      l('/rankings.html#top-broad-market-etfs', 'Broad market ETF rankings', 'تصنيف صناديق السوق الواسع'),
      l('/insights/spy-vs-qqq-explained.html', 'SPY vs QQQ explained', 'شرح SPY مقابل QQQ')
    ]
  }),
  article({
    slug: 'voo-vs-vti-long-term-etf-comparison',
    type: 'ETF Comparison Article',
    category: 'ETF Education',
    title: 'VOO vs VTI: Long-Term ETF Comparison for Market Coverage',
    arTitle: 'مقارنة VOO و VTI: بحث طويل الأجل لتغطية السوق',
    description: 'Educational VOO vs VTI comparison for long-term market coverage research, including index scope, diversification, cost, and overlap context.',
    arDescription: 'مقارنة تعليمية بين VOO و VTI لأبحاث تغطية السوق طويلة الأجل، مع سياق نطاق المؤشر والتنويع والتكلفة والتداخل.',
    focus: 'large-cap versus total-market ETF coverage',
    arFocus: 'تغطية الأسهم الكبرى مقابل السوق الكلي في صناديق المؤشرات',
    symbols: ['VOO', 'VTI', 'SPY'],
    links: [
      l('/etfs/voo.html', 'VOO ETF research', 'أبحاث صندوق VOO'),
      l('/etfs/vti.html', 'VTI ETF research', 'أبحاث صندوق VTI'),
      l('/etfs/spy.html', 'SPY ETF research', 'أبحاث صندوق SPY'),
      l('/rankings.html#top-broad-market-etfs', 'Broad market ETF rankings', 'تصنيف صناديق السوق الواسع'),
      l('/insights/etf-expense-ratios-explained.html', 'ETF expense ratios explained', 'شرح نسب مصاريف الصناديق')
    ]
  }),
  article({
    slug: 'nvda-vs-amd-ai-chip-stocks-compared',
    type: 'Stock Comparison Article',
    category: 'Stock Comparison',
    title: 'NVDA vs AMD: AI Chip Stocks Compared Through an Educational Lens',
    arTitle: 'مقارنة NVDA و AMD: أسهم رقائق الذكاء الاصطناعي بمنظور تعليمي',
    description: 'Educational NVDA vs AMD stock comparison covering AI accelerators, data-center demand, margins, competition, and ETF exposure.',
    arDescription: 'مقارنة تعليمية بين NVDA و AMD تغطي مسرعات الذكاء الاصطناعي وطلب مراكز البيانات والهوامش والمنافسة وتعرض الصناديق.',
    focus: 'AI accelerator competition',
    arFocus: 'منافسة مسرعات الذكاء الاصطناعي',
    symbols: ['NVDA', 'AMD', 'SOXX', 'SMH'],
    links: [
      l('/compare/nvda-vs-amd.html', 'NVDA vs AMD comparison page', 'صفحة مقارنة NVDA و AMD'),
      l('/stocks/nvda.html', 'NVDA stock research', 'أبحاث سهم NVDA'),
      l('/stocks/amd.html', 'AMD stock research', 'أبحاث سهم AMD'),
      l('/semiconductor-stocks.html', 'Semiconductor stocks hub', 'محور أسهم أشباه الموصلات'),
      l('/etfs/soxx.html', 'SOXX ETF research', 'أبحاث صندوق SOXX')
    ]
  }),
  article({
    slug: 'aapl-vs-msft-mega-cap-tech-comparison',
    type: 'Stock Comparison Article',
    category: 'Stock Comparison',
    title: 'AAPL vs MSFT: Mega-Cap Tech Comparison for Platform Research',
    arTitle: 'مقارنة AAPL و MSFT: بحث في منصات التكنولوجيا الكبرى',
    description: 'Educational AAPL vs MSFT comparison focused on platform economics, cloud exposure, ecosystem durability, valuation sensitivity, and ETF context.',
    arDescription: 'مقارنة تعليمية بين AAPL و MSFT تركز على اقتصاديات المنصات وتعرض السحابة ومتانة النظام البيئي وحساسية التقييم وسياق الصناديق.',
    focus: 'mega-cap technology platform exposure',
    arFocus: 'تعرض منصات التكنولوجيا الكبرى',
    symbols: ['AAPL', 'MSFT', 'SPY', 'QQQ'],
    links: [
      l('/stocks/aapl.html', 'AAPL stock research', 'أبحاث سهم AAPL'),
      l('/stocks/msft.html', 'MSFT stock research', 'أبحاث سهم MSFT'),
      l('/etfs/qqq.html', 'QQQ ETF research', 'أبحاث صندوق QQQ'),
      l('/rankings.html#top-stocks', 'Top stock rankings', 'تصنيف أفضل الأسهم'),
      l('/insights/mega-cap-tech-index-concentration.html', 'Mega-cap index concentration', 'تركيز التكنولوجيا الكبرى في المؤشرات')
    ]
  }),
  article({
    slug: 'dividend-etfs-explained',
    type: 'Educational Explainer',
    category: 'ETF Education',
    title: 'Dividend ETFs Explained: Yield, Quality Screens, and Risk Trade-offs',
    arTitle: 'شرح صناديق توزيعات الأرباح: العائد وفلاتر الجودة ومقايضات المخاطر',
    description: 'Educational dividend ETF explainer covering yield, quality screens, concentration, rate sensitivity, and related ETF research links.',
    arDescription: 'شرح تعليمي لصناديق توزيعات الأرباح يغطي العائد وفلاتر الجودة والتركيز وحساسية الفائدة وروابط أبحاث الصناديق المرتبطة.',
    focus: 'dividend ETF construction and risk context',
    arFocus: 'بناء صناديق توزيعات الأرباح وسياق المخاطر',
    symbols: ['SCHD', 'DGRO', 'SPY'],
    links: [
      l('/dividend-etfs.html', 'Dividend ETFs hub', 'محور صناديق توزيعات الأرباح'),
      l('/etfs/schd.html', 'SCHD ETF research', 'أبحاث صندوق SCHD'),
      l('/etfs/dgro.html', 'DGRO ETF research', 'أبحاث صندوق DGRO'),
      l('/rankings.html#top-dividend-etfs', 'Dividend ETF rankings', 'تصنيف صناديق توزيعات الأرباح'),
      l('/insights/etf-expense-ratios-explained.html', 'ETF expense ratios explained', 'شرح نسب مصاريف الصناديق')
    ]
  }),
  article({
    slug: 'growth-etfs-vs-value-etfs',
    type: 'Educational Explainer',
    category: 'ETF Education',
    title: 'Growth ETFs vs Value ETFs: Factor Exposure, Valuation, and Risk Context',
    arTitle: 'صناديق النمو مقابل صناديق القيمة: العوامل والتقييم وسياق المخاطر',
    description: 'Educational growth ETFs vs value ETFs explainer covering factor exposure, sector tilts, valuation sensitivity, and diversification trade-offs.',
    arDescription: 'شرح تعليمي لصناديق النمو مقابل صناديق القيمة يغطي التعرض للعوامل والميل القطاعي وحساسية التقييم ومقايضات التنويع.',
    focus: 'growth and value ETF factor exposure',
    arFocus: 'تعرض صناديق النمو والقيمة لعوامل السوق',
    symbols: ['VUG', 'VTV', 'QQQ', 'SPY'],
    links: [
      l('/growth-stocks.html', 'Growth stocks hub', 'محور أسهم النمو'),
      l('/etfs/vug.html', 'VUG ETF research', 'أبحاث صندوق VUG'),
      l('/etfs/vtv.html', 'VTV ETF research', 'أبحاث صندوق VTV'),
      l('/rankings.html#top-broad-market-etfs', 'ETF rankings', 'تصنيفات صناديق المؤشرات'),
      l('/insights/growth-stocks-vs-value-stocks.html', 'Growth vs value stocks', 'أسهم النمو مقابل أسهم القيمة')
    ]
  })
];

run();

function run() {
  ensureDir(path.join(ROOT, 'insights'));
  ensureDir(path.join(ROOT, 'en', 'insights'));
  ensureDir(path.join(ROOT, 'ar', 'insights'));

  for (const item of ARTICLES) {
    fs.writeFileSync(path.join(ROOT, 'insights', `${item.slug}.html`), renderArticle(item, 'en'), 'utf8');
    fs.writeFileSync(path.join(ROOT, 'en', 'insights', `${item.slug}.html`), renderArticle(item, 'en-US'), 'utf8');
    fs.writeFileSync(path.join(ROOT, 'ar', 'insights', `${item.slug}.html`), renderArticle(item, 'ar'), 'utf8');
    writeArabicContentFile(item);
  }

  writeIndexes();
  updateResearchLayer();
  console.log(`Generated ${ARTICLES.length} controlled English insight articles and ${ARTICLES.length} Arabic equivalents.`);
}

function renderArticle(item, locale) {
  const isAr = locale === 'ar';
  const isEnAlias = locale === 'en-US';
  const prefix = isAr ? '/ar' : '';
  const pathPrefix = isAr ? '/ar/insights' : (isEnAlias ? '/en/insights' : '/insights');
  const title = isAr ? item.arTitle : item.title;
  const description = isAr ? item.arDescription : item.description;
  const canonical = `${BASE_URL}${pathPrefix}/${item.slug}.html`;
  const counterpart = `${BASE_URL}${isAr ? '/insights' : '/ar/insights'}/${item.slug}.html`;
  const body = isAr ? renderArabicBody(item) : renderEnglishBody(item);
  const jsonLd = buildJsonLd(item, locale, canonical);

  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${BASE_URL}/insights/${item.slug}.html" />
  <link rel="alternate" hreflang="en-US" href="${BASE_URL}/en/insights/${item.slug}.html" />
  <link rel="alternate" hreflang="ar" href="${BASE_URL}/ar/insights/${item.slug}.html" />
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}/insights/${item.slug}.html" />
  <meta property="og:locale" content="${isAr ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${BASE_URL}/Image/og-image.svg" />
  <meta property="article:published_time" content="${DATE}" />
  <meta property="article:modified_time" content="${DATE}" />
  <meta property="article:section" content="${esc(isAr ? arCategory(item.category) : item.category)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${BASE_URL}/Image/og-image.svg" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}styles.css" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}landing.css" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}css/market/market-portal.css" />
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body class="market-page${isAr ? ' localized-page localized-ar" data-locale="ar' : ''}">
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="${prefix}/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>${isAr ? 'منصة الأبحاث' : 'Research Platform'}</span></span></a>
      <div class="top-actions">
        ${nav(isAr)}
        <div class="locale-links" aria-label="${isAr ? 'اختيار اللغة' : 'Language'}">
          <a class="lang-switch" data-locale-route="${isAr ? 'en' : 'ar'}" href="${counterpart.replace(BASE_URL, '')}">${isAr ? 'English' : 'Arabic'}</a>
          <a class="lang-switch" data-locale-route="${isAr ? 'ar' : 'en'}" href="${canonical.replace(BASE_URL, '')}">${isAr ? 'العربية' : 'English'}</a>
        </div>
      </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${prefix}/">${isAr ? 'الرئيسية' : 'Home'}</a><span>/</span><a href="${prefix}/insights/">${isAr ? 'المقالات' : 'Articles'}</a><span>/</span><span>${esc(title)}</span></nav>
      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${esc(isAr ? arCategory(item.category) : item.category)}</span>
            <span class="insight-category-badge muted">${esc(isAr ? arType(item.type) : item.type)}</span>
          </div>
          <h1>${esc(title)}</h1>
          <div class="insight-meta-bar">
            <span>${isAr ? 'نشر' : 'Published'} <strong><time datetime="${DATE}">${DATE}</time></strong></span>
            <span>${isAr ? 'تحديث' : 'Updated'} <strong><time datetime="${DATE}">${DATE}</time></strong></span>
            <span><strong>${isAr ? 'قراءة تعليمية' : 'Educational research'}</strong></span>
          </div>
          <p class="market-lead">${esc(isAr ? item.arDescription : item.description)}</p>
          <div class="insight-summary-box">
            <span>${isAr ? 'موجز البحث' : 'Research brief'}</span>
            <p>${esc(isAr ? `يركز هذا المقال على ${item.arFocus} مع ربط القارئ بصفحات الأسهم والصناديق والمقارنات والمحاور ذات الصلة.` : `This article focuses on ${item.focus} and connects readers to related stock, ETF, comparison, ranking, and hub pages.`)}</p>
          </div>
          <div class="insight-meta-clusters">
            <div><strong>${isAr ? 'الأصول المرتبطة' : 'Related symbols'}</strong><div class="insight-chip-row">${chips(item.symbols)}</div></div>
            <div><strong>${isAr ? 'مسارات البحث' : 'Research paths'}</strong><div class="insight-chip-row">${chips(isAr ? [arType(item.type), arCategory(item.category)] : [item.type, item.category])}</div></div>
          </div>
          <p class="insight-hero-disclaimer">${isAr ? 'محتوى تعليمي فقط. لا يقدم هذا المقال نصيحة مالية أو أهداف أسعار أو توصيات بشراء أو بيع أوراق مالية.' : 'Educational content only. This article does not provide financial advice, price targets, or security recommendations.'}</p>
        </div>
      </section>
      <section class="market-section">
        <div class="insight-layout">
          <article class="insight-article-body">
${body}
            <div class="insight-disclaimer"><strong>${isAr ? 'تنبيه تعليمي:' : 'Educational disclaimer:'}</strong> ${isAr ? 'هذا المحتوى لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أي ورقة مالية. يجب التحقق من البيانات الحالية من مصادر مستقلة واستشارة مختص مؤهل عند الحاجة.' : 'All Market Insights content is for educational and informational purposes only and does not constitute investment or financial advice. TradeAlphaAI does not recommend securities, provide price targets, or predict future performance.'}</div>
          </article>
          <aside class="insight-sidebar">
            <div class="insight-toc">
              <h3>${isAr ? 'المحتويات' : 'Contents'}</h3>
              <ol>
                <li><a href="#context">${isAr ? 'السياق' : 'Context'}</a></li>
                <li><a href="#assets">${isAr ? 'الأصول والروابط' : 'Assets and links'}</a></li>
                <li><a href="#risks">${isAr ? 'المخاطر' : 'Risks'}</a></li>
                <li><a href="#workflow">${isAr ? 'طريقة الاستخدام' : 'Research workflow'}</a></li>
                <li><a href="#faq">${isAr ? 'أسئلة شائعة' : 'FAQ'}</a></li>
              </ol>
            </div>
            <div class="market-panel" style="padding:20px;margin-top:20px">
              <span class="eyebrow" style="font-size:10px">${isAr ? 'روابط مرتبطة' : 'Related Links'}</span>
              <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
${sidebarLinks(item, isAr)}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  </main>
  <script src="${isAr ? '/' : '../'}js/language-router.js" defer></script>
  <script src="${isAr ? '/' : '../'}js/mobile-nav.js" defer></script>
</body>
</html>
`;
}

function renderEnglishBody(item) {
  return `            <h2 id="context">Market context</h2>
            <p>${esc(item.title)} is an educational research page, not a forecast. It frames ${esc(item.focus)} through market structure, asset exposure, index methodology, and risk variables that readers can verify independently.</p>
            <p>The purpose is to connect related TradeAlphaAI research paths. A reader can move from this article into stock pages, ETF pages, comparison pages, rankings, and sector hubs without relying on thin or isolated content.</p>
            <h2 id="assets">Related assets and platform links</h2>
            <p>The most useful starting points are ${inlineLinks(item.links.slice(0, 3), false)}. These pages provide static research context, live market-data hooks where supported, and internal navigation to adjacent assets.</p>
            <p>For broader discovery, continue to ${inlineLinks(item.links.slice(3), false)}. This keeps the article connected to the platform architecture rather than acting as a standalone opinion page.</p>
            <h2 id="risks">Research risks to review</h2>
            <p>Important risks include valuation sensitivity, index concentration, sector cyclicality, liquidity conditions, and the possibility that popular narratives are already reflected in prices. None of those risks create a direct buy or sell conclusion.</p>
            <p>ETF readers should also review holdings overlap, expense ratios, tracking differences, liquidity, and drawdown history. Stock readers should review business model durability, margins, competitive position, and earnings sensitivity.</p>
            <h2 id="workflow">How to use this research path</h2>
            <p>Use this article as a map. Start with the theme, open the linked asset pages, compare ETF exposure, review rankings for broader context, and then verify current market data through independent sources.</p>
            <p>This workflow is intentionally educational. It avoids price targets, personalized allocation guidance, and claims that a theme will outperform.</p>
            <h2 id="faq">FAQ</h2>
            <details open><summary>Is this article financial advice?</summary><p>No. It is educational market research only and does not recommend buying or selling any security.</p></details>
            <details><summary>Does this article use live news or earnings claims?</summary><p>No. The article is evergreen and uses only static platform context and internal research links.</p></details>
            <details><summary>Which pages should I read next?</summary><p>Use the related links in the sidebar to continue into stock, ETF, comparison, ranking, and hub pages.</p></details>
`;
}

function renderArabicBody(item) {
  return `            <h2 id="context">السياق البحثي</h2>
            <p>${esc(item.arTitle)} صفحة بحث تعليمية وليست توقعا للسعر أو توصية. يشرح المقال ${esc(item.arFocus)} من خلال بنية السوق، تعرض الأصول، منهجية المؤشرات، ومتغيرات المخاطر التي يمكن للقارئ مراجعتها بشكل مستقل.</p>
            <p>الهدف هو بناء مسار واضح داخل TradeAlphaAI. يستطيع القارئ الانتقال من المقال إلى صفحات الأسهم وصناديق المؤشرات والمقارنات والتصنيفات والمحاور دون الاعتماد على محتوى منفصل أو سطحي.</p>
            <h2 id="assets">الأصول والروابط المرتبطة</h2>
            <p>نقاط البداية الأكثر فائدة هي ${inlineLinks(item.links.slice(0, 3), true)}. توفر هذه الصفحات سياقا بحثيا ثابتا وروابط داخلية إلى الأصول والمفاهيم القريبة.</p>
            <p>للتوسع في البحث يمكن متابعة ${inlineLinks(item.links.slice(3), true)}. هذا يحافظ على ترابط المقال مع بنية المنصة بدلا من أن يكون صفحة رأي منفصلة.</p>
            <h2 id="risks">مخاطر يجب مراجعتها</h2>
            <p>تشمل المخاطر المهمة حساسية التقييم، تركز المؤشرات، دورية القطاعات، ظروف السيولة، واحتمال أن تكون الرواية الشائعة منعكسة بالفعل في الأسعار. لا تؤدي هذه العوامل إلى استنتاج مباشر بالشراء أو البيع.</p>
            <p>بالنسبة لصناديق المؤشرات يجب مراجعة تداخل الحيازات ونسب المصاريف وفروق التتبع والسيولة وسجل التراجعات. وبالنسبة للأسهم يجب مراجعة متانة نموذج الأعمال والهوامش والموقع التنافسي وحساسية الأرباح.</p>
            <h2 id="workflow">طريقة استخدام هذا المسار</h2>
            <p>استخدم هذا المقال كخريطة بحث. ابدأ بالمحور، ثم افتح صفحات الأصول المرتبطة، وقارن تعرض الصناديق، وراجع التصنيفات للسياق الأوسع، ثم تحقق من البيانات الحالية من مصادر مستقلة.</p>
            <p>هذا المسار تعليمي عمدا. لا يقدم أهداف أسعار، ولا يحدد أوزانا لمحفظة شخصية، ولا يدعي أن محورا معينا سيتفوق مستقبلا.</p>
            <h2 id="faq">أسئلة شائعة</h2>
            <details open><summary>هل هذا المقال نصيحة مالية؟</summary><p>لا. هذا بحث سوق تعليمي فقط ولا يوصي بشراء أو بيع أي ورقة مالية.</p></details>
            <details><summary>هل يعتمد المقال على أخبار أو أرباح مباشرة؟</summary><p>لا. المقال دائم الصلاحية ويستخدم سياقا ثابتا من المنصة وروابط بحث داخلية فقط.</p></details>
            <details><summary>ما الصفحات التي يمكن قراءتها بعد ذلك؟</summary><p>استخدم الروابط المرتبطة في الشريط الجانبي للانتقال إلى صفحات الأسهم والصناديق والمقارنات والتصنيفات والمحاور.</p></details>
`;
}

function writeIndexes() {
  fs.writeFileSync(path.join(ROOT, 'insights', 'index.html'), renderIndex(false), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'ar', 'insights', 'index.html'), renderIndex(true), 'utf8');
}

function renderIndex(isAr) {
  const prefix = isAr ? '/ar' : '';
  const cards = indexArticles(isAr).map((item) => {
    const title = isAr ? item.arTitle : item.title;
    const description = isAr ? item.arDescription : item.description;
    const href = `${prefix}/insights/${item.slug}.html`;
    return `<article class="market-card"><span class="market-card-kicker">${esc(isAr ? arCategory(item.category) : item.category)}</span><h3>${esc(title)}</h3><p>${esc(description)}</p><a class="market-card-link" href="${href}">${isAr ? 'اقرأ المقال' : 'Read article'}</a></article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${isAr ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${isAr ? 'المقالات | مكتبة أبحاث السوق التعليمية' : 'Articles | Educational Market Research Library'} | TradeAlphaAI</title>
  <meta name="description" content="${isAr ? 'مكتبة أبحاث تعليمية من TradeAlphaAI تغطي الأسهم وصناديق المؤشرات والمقارنات والمحاور القطاعية دون تقديم نصيحة مالية.' : 'TradeAlphaAI educational research articles covering stocks, ETFs, comparisons, sector hubs, and market explainers without financial advice.'}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${BASE_URL}${prefix}/insights/" />
  <link rel="alternate" hreflang="en" href="${BASE_URL}/insights/" />
  <link rel="alternate" hreflang="en-US" href="${BASE_URL}/en/insights/" />
  <link rel="alternate" hreflang="ar" href="${BASE_URL}/ar/insights/" />
  <link rel="alternate" hreflang="x-default" href="${BASE_URL}/insights/" />
  <meta property="og:locale" content="${isAr ? 'ar_AR' : 'en_US'}" />
  <meta property="og:title" content="${isAr ? 'المقالات | مكتبة أبحاث السوق التعليمية' : 'Articles | Educational Market Research Library'}" />
  <meta property="og:description" content="${isAr ? 'مكتبة أبحاث تعليمية تغطي الأسهم وصناديق المؤشرات والمقارنات والمحاور القطاعية.' : 'Educational market research articles covering stocks, ETFs, comparisons, and sector hubs.'}" />
  <meta property="og:url" content="${BASE_URL}${prefix}/insights/" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${BASE_URL}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${isAr ? 'المقالات | مكتبة أبحاث السوق التعليمية' : 'Articles | Educational Market Research Library'}" />
  <meta name="twitter:description" content="${isAr ? 'مكتبة أبحاث تعليمية تغطي الأسهم وصناديق المؤشرات والمقارنات والمحاور القطاعية.' : 'Educational market research articles covering stocks, ETFs, comparisons, and sector hubs.'}" />
  <meta name="twitter:image" content="${BASE_URL}/Image/og-image.svg" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}styles.css" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}landing.css" />
  <link rel="stylesheet" href="${isAr ? '/' : '../'}css/market/market-portal.css" />
</head>
<body class="market-page${isAr ? ' localized-page localized-ar" data-locale="ar' : ''}">
  <div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="${prefix}/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>${isAr ? 'منصة الأبحاث' : 'Research Platform'}</span></span></a><div class="top-actions">${nav(isAr)}<div class="locale-links" aria-label="${isAr ? 'اختيار اللغة' : 'Language'}"><a class="lang-switch" data-locale-route="${isAr ? 'en' : 'ar'}" href="${isAr ? '/insights/' : '/ar/insights/'}">${isAr ? 'English' : 'Arabic'}</a><a class="lang-switch" data-locale-route="${isAr ? 'ar' : 'en'}" href="${isAr ? '/ar/insights/' : '/insights/'}">${isAr ? 'العربية' : 'English'}</a></div></div></div></div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${prefix}/">${isAr ? 'الرئيسية' : 'Home'}</a><span>/</span><span>${isAr ? 'المقالات' : 'Articles'}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${isAr ? 'مكتبة الأبحاث' : 'Research Library'}</span><h1>${isAr ? 'مقالات تعليمية للأسهم وصناديق المؤشرات والمقارنات.' : 'Educational articles for stocks, ETFs, comparisons, and sector research.'}</h1><p class="market-lead">${isAr ? 'اقرأ مقالات دائمة الصلاحية تربط بين الأصول والمحاور والمقارنات دون تقديم نصيحة مالية.' : 'Read evergreen research articles that connect assets, themes, comparisons, and rankings without financial advice.'}</p><div class="market-actions"><a class="market-btn primary" href="${prefix}/stocks.html">${isAr ? 'استكشف الأسهم' : 'Explore Stocks'}</a><a class="market-btn" href="${prefix}/etfs.html">${isAr ? 'استكشف صناديق المؤشرات' : 'Explore ETFs'}</a></div></div></section>
      <section class="market-section"><div class="market-section-head"><span class="eyebrow">${isAr ? 'أحدث المقالات' : 'Latest Articles'}</span><h2>${isAr ? 'دفعة محتوى خاضعة للتحكم' : 'Controlled content batch'}</h2><p>${isAr ? 'كل مقال يرتبط بصفحات الأسهم والصناديق والمقارنات والمحاور ذات الصلة.' : 'Each article links into relevant stock, ETF, comparison, ranking, and sector hub pages.'}</p></div><div class="market-grid three">${cards}</div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">${isAr ? 'تنبيه تعليمي' : 'Educational disclaimer'}</span><p class="market-copy">${isAr ? 'المحتوى تعليمي ومعلوماتي فقط ولا يعد نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أوراق مالية.' : 'Content is educational and informational only and does not constitute financial advice, investment advice, or a recommendation to buy or sell securities.'}</p><div data-research-timeline></div><div data-research-themes></div></div></section>
    </div>
  </main>
  <script src="${isAr ? '/' : '../'}js/language-router.js" defer></script>
  <script src="${isAr ? '/' : '../'}js/mobile-nav.js" defer></script>
  <script src="${isAr ? '/' : '../'}js/research-layer.js" defer></script>
</body>
</html>
`;
}

function indexArticles(isAr) {
  const bySlug = new Map(ARTICLES.map((item) => [item.slug, item]));
  const dir = path.join(ROOT, 'insights');
  if (!fs.existsSync(dir)) return ARTICLES;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html') || name === 'index.html') continue;
    const slug = name.replace(/\.html$/, '');
    if (bySlug.has(slug)) continue;
    const enHtml = fs.readFileSync(path.join(ROOT, 'insights', name), 'utf8');
    const arPath = path.join(ROOT, 'ar', 'insights', name);
    const arHtml = fs.existsSync(arPath) ? fs.readFileSync(arPath, 'utf8') : '';
    if (!isIndexable(enHtml) || !isIndexable(arHtml)) continue;
    bySlug.set(slug, {
      slug,
      category: extractCategory(enHtml) || 'Market Research',
      title: extractTitle(enHtml) || titleFromSlug(slug),
      arTitle: extractTitle(arHtml) || titleFromSlug(slug),
      description: extractDescription(enHtml) || 'Educational market research article from TradeAlphaAI.',
      arDescription: extractDescription(arHtml) || 'مقال بحثي تعليمي من TradeAlphaAI.'
    });
  }
  return [...ARTICLES, ...[...bySlug.values()].filter((item) => !ARTICLES.some((batch) => batch.slug === item.slug))]
    .filter((item) => isAr ? item.arTitle : item.title);
}

function writeArabicContentFile(item) {
  const dir = path.join(ROOT, 'data', 'localization', 'ar-insight-content');
  ensureDir(dir);
  const content = {
    title: item.arTitle,
    category: arCategory(item.category),
    summary: item.arDescription,
    lead: item.arDescription,
    sections: [
      { heading: 'السياق البحثي', body: [`يركز هذا المقال على ${item.arFocus} ضمن إطار تعليمي لا يقدم نصيحة مالية.`] },
      { heading: 'الأصول المرتبطة', body: ['يربط المقال بين صفحات الأسهم وصناديق المؤشرات والمقارنات والمحاور ذات الصلة داخل TradeAlphaAI.'] },
      { heading: 'المخاطر', body: ['تشمل المخاطر حساسية التقييم، التركز، ظروف السيولة، وتغير الروايات السوقية بمرور الوقت.'] },
      { heading: 'طريقة الاستخدام', body: ['يمكن استخدام هذا المحتوى لفهم العلاقة بين الأصول والصناديق والقطاعات والمقارنات داخل منصة أبحاث السوق. يبقى التحليل تعليميا ومعلوماتيا فقط، ويجب مراجعة البيانات الحديثة ومصادر المخاطر قبل أي قرار شخصي.'] },
      { heading: 'الربط الداخلي', body: ['توفر الروابط المرتبطة مسارات للانتقال بين صفحات الأسهم وصفحات الصناديق والتصنيفات والمحاور القطاعية. هذا يجعل المقال جزءا من رسم تعليمي أوسع لأبحاث السوق، وليس توصية بشراء أو بيع أي ورقة مالية.'] }
    ],
    faq: [
      { question: 'هل هذا المقال نصيحة مالية؟', answer: 'لا. هذا المقال لأغراض تعليمية ومعلوماتية فقط ولا يعد نصيحة مالية.' }
    ]
  };
  fs.writeFileSync(path.join(dir, `${item.slug}.json`), JSON.stringify(content, null, 2) + '\n', 'utf8');
}

function updateResearchLayer() {
  const file = path.join(ROOT, 'data', 'research-layer.json');
  const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { insights: [], themes: [], linkLabels: {} };
  const newEntries = ARTICLES.map((item) => ({
    title: item.title,
    href: `insights/${item.slug}.html`,
    category: item.category,
    readingTime: '5 min',
    updated: DATE,
    symbols: item.symbols,
    signal: 'Market Focus',
    summary: item.description
  }));
  const existing = (data.insights || []).filter((entry) => !newEntries.some((next) => next.href === entry.href));
  data.updatedAt = DATE;
  data.insights = [...newEntries, ...existing].slice(0, 40);
  data.linkLabels = data.linkLabels || {};
  for (const item of ARTICLES) data.linkLabels[`insights/${item.slug}.html`] = item.title;
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function buildJsonLd(item, locale, canonical) {
  const isAr = locale === 'ar';
  const isEnAlias = locale === 'en-US';
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: isAr ? 'الرئيسية' : 'Home', item: `${BASE_URL}${isAr ? '/ar/' : '/'}` },
          { '@type': 'ListItem', position: 2, name: isAr ? 'المقالات' : 'Articles', item: `${BASE_URL}${isAr ? '/ar' : ''}/insights/` },
          { '@type': 'ListItem', position: 3, name: isAr ? item.arTitle : item.title, item: canonical }
        ]
      },
      {
        '@type': 'Article',
        headline: isAr ? item.arTitle : item.title,
        description: isAr ? item.arDescription : item.description,
        datePublished: DATE,
        dateModified: DATE,
        inLanguage: isEnAlias ? 'en-US' : locale,
        author: { '@type': 'Organization', name: 'TradeAlphaAI' },
        publisher: { '@type': 'Organization', name: 'TradeAlphaAI', logo: { '@type': 'ImageObject', url: `${BASE_URL}/Image/og-image.svg` } },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical }
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          { '@type': 'Question', name: isAr ? 'هل هذا المقال نصيحة مالية؟' : 'Is this article financial advice?', acceptedAnswer: { '@type': 'Answer', text: isAr ? 'لا. هذا بحث سوق تعليمي فقط.' : 'No. This is educational market research only.' } },
          { '@type': 'Question', name: isAr ? 'هل يعتمد على أخبار مباشرة؟' : 'Does it use live news?', acceptedAnswer: { '@type': 'Answer', text: isAr ? 'لا. يستخدم المقال سياقا ثابتا وروابط داخلية.' : 'No. The article uses evergreen static context and internal links.' } }
        ]
      }
    ]
  };
}

function nav(isAr) {
  if (isAr) {
    return `<nav class="nav-group" aria-label="التنقل الرئيسي"><a href="/ar/" class="nav-link">الرئيسية</a><a href="/ar/stocks.html" class="nav-link">بحث الأسهم العالمي</a><a href="/ar/etfs.html" class="nav-link">محلل صناديق المؤشرات</a><a href="/ar/ai-stock-screener.html" class="nav-link">ماسح السوق</a><a href="/ar/rankings.html" class="nav-link">أفضل الاختيارات</a><a href="/ar/insights/" class="nav-link">المقالات</a><a href="/ar/methodology.html" class="nav-link">المنهجية</a></nav>`;
  }
  return `<nav class="nav-group" aria-label="Primary"><a href="/" class="nav-link">Home</a><a href="/stocks.html" class="nav-link">Global Stock Research</a><a href="/etfs.html" class="nav-link">ETF Analyzer</a><a href="/ai-stock-screener.html" class="nav-link">Market Screener</a><a href="/rankings.html" class="nav-link">Top Picks</a><a href="/insights/" class="nav-link">Articles</a><a href="/methodology.html" class="nav-link">Methodology</a></nav>`;
}

function sidebarLinks(item, isAr) {
  return item.links.map((linkItem) => {
    const href = isAr ? arHref(linkItem.href) : linkItem.href;
    const label = isAr ? linkItem.arLabel : linkItem.label;
    return `                <a href="${href}" class="related-link"><strong>${esc(label)}</strong><span>${isAr ? 'مسار بحث مرتبط' : 'Related research path'}</span></a>`;
  }).join('\n');
}

function inlineLinks(links, isAr) {
  return links.map((linkItem) => `<a href="${isAr ? arHref(linkItem.href) : linkItem.href}">${esc(isAr ? linkItem.arLabel : linkItem.label)}</a>`).join(isAr ? '، ' : ', ');
}

function arHref(href) {
  if (href.startsWith('/ar/')) return href;
  if (href.startsWith('/insights/')) return `/ar${href}`;
  return `/ar${href}`;
}

function chips(values) {
  return values.map((value) => `<span class="insight-chip">${esc(value)}</span>`).join('');
}

function l(href, label, arLabel) {
  return { href, label, arLabel };
}

function article(input) {
  return input;
}

function arCategory(value) {
  return {
    'AI Stocks': 'أسهم الذكاء الاصطناعي',
    Semiconductors: 'أشباه الموصلات',
    Cybersecurity: 'الأمن السيبراني',
    'Cloud Computing': 'الحوسبة السحابية',
    'ETF Education': 'تعليم صناديق المؤشرات',
    'Stock Comparison': 'مقارنة الأسهم'
  }[value] || value;
}

function arType(value) {
  return {
    'Market Snapshot': 'لقطة سوق',
    'Sector Outlook': 'نظرة قطاعية',
    'Stock Comparison Article': 'مقال مقارنة أسهم',
    'ETF Comparison Article': 'مقال مقارنة صناديق',
    'Educational Explainer': 'شرح تعليمي'
  }[value] || value;
}

function extractTitle(html) {
  return clean((String(html || '').match(/<title>([^<]+)<\/title>/i) || [])[1] || '').replace(/\s*\|\s*TradeAlphaAI\s*$/i, '');
}

function extractDescription(html) {
  return clean((String(html || '').match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '');
}

function extractCategory(html) {
  return clean((String(html || '').match(/<span class="insight-category-badge">([^<]+)<\/span>/i) || [])[1] || '');
}

function titleFromSlug(slug) {
  return String(slug || '').split('-').map((part) => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
}

function clean(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function isIndexable(html) {
  const robots = (String(html || '').match(/<meta\s+name="robots"\s+content="([^"]+)"/i) || [])[1] || '';
  return /index,follow/i.test(robots) && !/noindex/i.test(robots);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
