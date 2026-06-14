'use strict';

// Phase 96 — /articles/ institutional research & education surface generator.
// Same production-safe strategy as /briefs/ and /market-news/: clone the
// validator-green market-outlook index template (byte-identical baked header +
// footer → no global-nav re-bake, parity untouched), swapping SEO head,
// breadcrumb, hero, and body. Distinct identity: institutional market-STRUCTURE
// education — explicitly the deep tier, separate from /insights/ (applied ETF/
// sector/stock research). The body presents the educational program scope from
// the Educational Brain's concept taxonomy.
//
// Output: articles/index.html, ar/articles/index.html
// Usage:  node tools/generate-articles-index.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TOPICS_PATH = path.join(ROOT, 'data', 'intelligence', 'educational-topics.json');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildHead(ar) {
  const url = ar ? 'https://www.tradealphaai.com/ar/articles/' : 'https://www.tradealphaai.com/articles/';
  const title = ar ? 'أبحاث وتعليم مؤسسي في بنية السوق | TradeAlphaAI'
    : 'Institutional Market-Structure Research & Education | TradeAlphaAI';
  const desc = ar ? 'تعليم مؤسسي عميق في بنية السوق: اتساع السوق وحساسية الفائدة وانضغاط التقلب والتركز وأنظمة السيولة والتأكيد عبر الأصول. تحليل سببي لا شروح للمبتدئين. سياق تعليمي وليس نصيحة استثمارية.'
    : 'Deep institutional market-structure education: breadth, duration sensitivity, volatility compression, concentration, liquidity regimes, and cross-asset confirmation. Causal analysis, not beginner explainers. Educational context, not investment advice.';
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'الأبحاث' : 'Research Articles', item: url },
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
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/articles/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/articles/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/articles/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI institutional research preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function buildMain(ar, topics) {
  const t = (en, arT) => (ar ? arT : en);
  const families = (topics && topics.candidates) || [];
  const familyIds = new Set(families.map((family) => family.id));
  const publishedExtras = fs.readdirSync(path.join(ROOT, 'articles'))
    .filter((file) => file.endsWith('.html') && file !== 'index.html')
    .map((file) => file.replace(/\.html$/, ''))
    .filter((slug) => !familyIds.has(slug))
    .filter((slug) => {
      const html = fs.readFileSync(path.join(ROOT, 'articles', `${slug}.html`), 'utf8');
      return html.includes('data-educational-article=');
    })
    .map((slug) => {
      const titleFrom = (localePath) => {
        try {
          const html = fs.readFileSync(localePath, 'utf8');
          return ((html.match(/<h1>([\s\S]*?)<\/h1>/i) || [])[1] || slug).replace(/<[^>]+>/g, '').trim();
        } catch { return slug; }
      };
      return {
        id: slug,
        title_en: titleFrom(path.join(ROOT, 'articles', `${slug}.html`)),
        title_ar: titleFrom(path.join(ROOT, 'ar', 'articles', `${slug}.html`)),
      };
    });
  const displayFamilies = [...families, ...publishedExtras].sort((left, right) => {
    const leftPublished = fs.existsSync(path.join(ROOT, 'articles', `${left.id}.html`));
    const rightPublished = fs.existsSync(path.join(ROOT, 'articles', `${right.id}.html`));
    return Number(rightPublished) - Number(leftPublished);
  });
  // Present the institutional education program as the editorial scope.
  const scopeCards = displayFamilies.map((f) => {
    const published = fs.existsSync(path.join(ROOT, ar ? 'ar/articles' : 'articles', `${f.id}.html`));
    const title = esc(ar ? f.title_ar : f.title_en);
    const heading = published ? `<a href="${ar ? '/ar' : ''}/articles/${f.id}.html">${title}</a>` : title;
    return `          <article class="market-card"><span class="market-card-kicker">${esc(published ? t('Published research', 'بحث منشور') : t('Market structure', 'بنية السوق'))}</span><h3>${heading}</h3></article>`;
  }).join('\n');

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Research Articles', 'الأبحاث'))}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Research & Education', 'الأبحاث والتعليم المؤسسي'))}</span>
          <h1>${esc(t('How institutional markets actually behave', 'كيف تتصرف الأسواق المؤسسية فعلياً'))}</h1>
          <p class="market-lead">${esc(t('Deep, evergreen market-structure education — breadth, duration sensitivity, volatility compression, concentration, liquidity regimes, and cross-asset confirmation — written as a macro strategist teaching structure, not a beginner explainer. Educational context, not investment advice.', 'تعليم عميق ومستدام في بنية السوق — الاتساع وحساسية الفائدة وانضغاط التقلب والتركز وأنظمة السيولة والتأكيد عبر الأصول — مكتوب كاستراتيجي ماكرو يشرح البنية، لا كدليل للمبتدئين. سياق تعليمي وليس نصيحة استثمارية.'))}</p>
        </div>
      </section>

      <section class="market-section" id="research-program">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Research program', 'برنامج الأبحاث'))}</span><h2>${esc(t('The institutional education program', 'برنامج التعليم المؤسسي'))}</h2><p class="market-copy">${esc(t('Each theme teaches a structural relationship — causal, cross-asset, and grounded in how desks actually read markets.', 'يعلّم كل محور علاقة هيكلية — سببية وعبر الأصول ومبنية على كيفية قراءة المكاتب للأسواق فعلياً.'))}</p></div>
        <div class="market-grid three">
${scopeCards}
        </div>
      </section>

      <section class="market-section" id="articles-distinction">
        <div class="market-panel"><p class="market-copy">${esc(t('This desk publishes institutional market-structure research. For applied ETF, sector, and stock research, see the Insights library. Articles here explain causal market behavior — never beginner finance, listicles, or product explainers.', 'ينشر هذا المكتب أبحاثاً مؤسسية في بنية السوق. وللأبحاث التطبيقية حول صناديق المؤشرات والقطاعات والأسهم، راجع مكتبة الرؤى. تشرح المقالات هنا السلوك السببي للسوق — وليست تمويلاً للمبتدئين أو قوائم أو شروح منتجات.'))}</p></div>
      </section>

      <section class="market-section" id="articles-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI research articles present educational market-structure analysis only. They are not investment advice, recommendations, or forecasts.', 'تقدم مقالات أبحاث TradeAlphaAI تحليلاً تعليمياً لبنية السوق فقط، وليست نصيحة استثمارية أو توصيات أو توقعات.'))}</p></div>
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
    .replace('data-active-section="market-outlook"', 'data-active-section="articles"')
    .replace(/class="nav-link is-active" aria-current="page">Market Outlook/g, 'class="nav-link">Market Outlook')
    .replace(/class="nav-link is-active" aria-current="page">توقعات السوق/g, 'class="nav-link">توقعات السوق')
    .replace(/href="\/ar\/market-outlook\/"/g, 'href="/ar/articles/"')
    .replace(/href="\/market-outlook\/"/g, 'href="/articles/"');
  const footer = template.slice(mainEndIdx);
  const topics = readJson(TOPICS_PATH);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar)}
${bodyTag}${headerBlock}

${buildMain(ar, topics)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  for (const [ar, outRel] of [[false, 'articles/index.html'], [true, 'ar/articles/index.html']]) {
    const html = generate(ar);
    if (write) {
      const outPath = path.join(ROOT, outRel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`[articles-index] wrote ${outRel} (${html.length} chars)`);
    } else {
      console.log(`[articles-index] dry-run ${outRel}: ${html.length} chars`);
    }
  }
}

if (require.main === module) main();

module.exports = { generate };
