'use strict';

// Phase 95 — /market-news/ editorial surface generator.
// Same production-safe strategy as /briefs/: clone the validator-green
// market-outlook index template (byte-identical baked header + footer → no
// global-nav re-bake, parity untouched), swapping only the SEO head,
// breadcrumb, hero, and body. The body presents the News desk identity and
// the currently eligible institutional reactions from the News Brain — honest
// "desk quiet" monitoring copy when no event clears the threshold.
//
// Output: market-news/index.html, ar/market-news/index.html
// Usage:  node tools/generate-market-news-index.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ELIGIBILITY_PATH = path.join(ROOT, 'data', 'intelligence', 'news-eligibility.json');
const STALE_HOURS = 48;

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function fresh(a) {
  return a && a.updated_at && (Date.now() - new Date(a.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

const COVERAGE = {
  en: [
    ['Inflation prints', 'CPI, Core CPI, and PCE reactions — what the surprise does to rate-path pricing and which assets confirm or reject the move.'],
    ['Labor & growth', 'NFP, jobless claims, and GDP reactions read through breadth, duration, and risk appetite, not headline beats.'],
    ['Policy & the Fed', 'FOMC decisions and Powell remarks interpreted through the curve, the dollar, and positioning — not transcript rewriting.'],
    ['Cross-asset shocks', 'Yield dislocations, dollar moves, oil events, volatility spikes, and AI-leadership shifts, framed as transmission, not headlines.'],
  ],
  ar: [
    ['بيانات التضخم', 'تفاعلات مؤشر أسعار المستهلك الأساسي ونفقات الاستهلاك — أثر المفاجأة على تسعير مسار الفائدة وأي الأصول يؤكد التحرك أو يرفضه.'],
    ['العمل والنمو', 'تفاعلات الوظائف وطلبات البطالة والناتج المحلي تُقرأ عبر الاتساع وحساسية الفائدة وشهية المخاطرة، لا عبر العناوين.'],
    ['السياسة والفيدرالي', 'قرارات اللجنة وتصريحات باول تُفسَّر عبر منحنى العائد والدولار والتمركزات، لا بإعادة صياغة المحاضر.'],
    ['صدمات عبر الأصول', 'اضطرابات العوائد وتحركات الدولار وأحداث النفط وقفزات التقلب وتحولات قيادة الذكاء الاصطناعي، مؤطّرة كانتقال لا كعناوين.'],
  ],
};

function buildHead(ar) {
  const url = ar ? 'https://www.tradealphaai.com/ar/market-news/' : 'https://www.tradealphaai.com/market-news/';
  const title = ar ? 'تحليل أخبار السوق المؤسسي | تفاعلات الماكرو عبر الأصول | TradeAlphaAI'
    : 'Institutional Market News Analysis | Cross-Asset Macro Reaction | TradeAlphaAI';
  const desc = ar ? 'تحليل مؤسسي سريع لتفاعلات السوق مع التضخم والوظائف والفيدرالي وصدمات العوائد والدولار والنفط والتقلب — تفسير عبر الأصول لا إعادة صياغة أخبار. سياق تعليمي وليس نصيحة استثمارية.'
    : 'Fast institutional analysis of market reactions to inflation, labor, the Fed, yield/dollar/oil shocks and volatility — cross-asset interpretation, not news rewriting. Educational context, not investment advice.';
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'أخبار السوق' : 'Market News', item: url },
      ] },
    ],
  };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/market-news/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/market-news/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/market-news/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI institutional market news preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

// Phase 107: list published market-news articles (scan the section directory).
function publishedArticles(ar) {
  const dir = path.join(ROOT, ar ? 'ar/market-news' : 'market-news');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html'); } catch { return []; }
  return files.map((f) => {
    let title = f.replace(/\.html$/, '');
    try { const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/<h1>([\s\S]*?)<\/h1>/i); if (m) title = m[1].replace(/<[^>]+>/g, '').trim(); } catch { /* keep slug */ }
    return { href: `${ar ? '/ar/market-news/' : '/market-news/'}${f}`, title };
  }).sort((a, b) => b.href.localeCompare(a.href));
}

function buildMain(ar, eligibility) {
  const t = (en, arT) => (ar ? arT : en);
  const eligible = fresh(eligibility) ? (eligibility.eligible || []) : [];
  const published = publishedArticles(ar);
  const publishedBlock = published.length
    ? `      <section class="market-section" id="published-analysis">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Published analysis', 'تحليلات منشورة'))}</span><h2>${esc(t('Published reaction analysis', 'تحليلات التفاعل المنشورة'))}</h2></div>
        <div class="market-grid three">
${published.map((a) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Analysis', 'تحليل'))}</span><h3><a href="${esc(a.href)}">${esc(a.title)}</a></h3></article>`).join('\n')}
        </div>
      </section>`
    : '';

  const reactionBlock = eligible.length
    ? `      <section class="market-section" id="active-reactions">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Active desk reactions', 'تفاعلات المكتب النشطة'))}</span><h2>${esc(t('Active desk reactions', 'تفاعلات المكتب النشطة'))}</h2></div>
        <div class="market-grid three">
${eligible.map((e) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Reaction', 'تفاعل'))}</span><h3>${esc(e.headline)}</h3><p class="market-copy">${esc(t('Significance', 'الأهمية'))}: ${esc(e.significance)}/100 · ${esc(t('cross-asset context verified', 'سياق عبر الأصول موثق'))}: ${e.cross_asset_context ? t('yes', 'نعم') : t('pending', 'قيد الانتظار')}</p></article>`).join('\n')}
        </div>
      </section>`
    : `      <section class="market-section" id="active-reactions">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Desk status', 'حالة المكتب'))}</span><h2>${esc(t('Desk status', 'حالة المكتب'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('No market-moving event currently clears the desk significance threshold. The News desk reacts to released, surprising, cross-asset-confirmed events — it does not publish for activity.', 'لا يوجد حالياً حدث محرّك للسوق يتجاوز عتبة الأهمية لدى المكتب. يتفاعل مكتب الأخبار مع الأحداث الصادرة والمفاجئة والمؤكَّدة عبر الأصول، ولا ينشر من أجل النشاط.'))}</p></div>
      </section>`;

  const coverageCards = COVERAGE[ar ? 'ar' : 'en'].map(([name, body]) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Coverage', 'التغطية'))}</span><h3>${esc(name)}</h3><p class="market-copy">${esc(body)}</p></article>`).join('\n');

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Market News', 'أخبار السوق'))}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Market News', 'أخبار السوق المؤسسية'))}</span>
          <h1>${esc(t('Fast institutional reaction analysis, not news rewriting', 'تحليل تفاعلي مؤسسي سريع، لا إعادة صياغة للأخبار'))}</h1>
          <p class="market-lead">${esc(t('When a market-moving event lands, the desk explains the reaction: what changed, why markets moved, what confirms or diverges across assets, and what the move implies for positioning. Educational context, not investment advice.', 'عند وقوع حدث محرّك للسوق، يشرح المكتب التفاعل: ما الذي تغيّر، ولماذا تحرك السوق، وما الذي يؤكد أو ينفصل عبر الأصول، وما الذي يعنيه التحرك للتمركزات. سياق تعليمي وليس نصيحة استثمارية.'))}</p>
        </div>
      </section>

${reactionBlock}
${publishedBlock}

      <section class="market-section" id="news-coverage">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Coverage scope', 'نطاق التغطية'))}</span><h2>${esc(t('What the News desk covers', 'ما يغطيه مكتب الأخبار'))}</h2></div>
        <div class="market-grid three">
${coverageCards}
        </div>
      </section>

      <section class="market-section" id="market-news-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI market news presents educational reaction analysis and cross-asset interpretation only. It is not investment advice, recommendations, forecasts, or breaking-news reporting.', 'تقدم أخبار سوق TradeAlphaAI تحليلاً تفاعلياً تعليمياً وتفسيراً عبر الأصول فقط، وليست نصيحة استثمارية أو توصيات أو توقعات أو تغطية أخبار عاجلة.'))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const headerBlock = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="market-news"');
  const footer = template.slice(mainEndIdx);
  const eligibility = readJson(ELIGIBILITY_PATH);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar)}
${bodyTag}${headerBlock}

${buildMain(ar, eligibility)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  for (const [ar, outRel] of [[false, 'market-news/index.html'], [true, 'ar/market-news/index.html']]) {
    const html = generate(ar);
    if (write) {
      const outPath = path.join(ROOT, outRel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`[market-news-index] wrote ${outRel} (${html.length} chars)`);
    } else {
      console.log(`[market-news-index] dry-run ${outRel}: ${html.length} chars`);
    }
  }
}

if (require.main === module) main();

module.exports = { generate };
