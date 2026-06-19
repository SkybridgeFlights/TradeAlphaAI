'use strict';

// Phase 208 / Workstream G — intelligence index pages.
// /markets/ + /sectors/ + /equities/ (and AR) — clean landing pages listing each
// registry entity with an institutional summary + link to its detail page. Needed
// so header nav links resolve (no 404). Clones the validator-green market-outlook
// header/footer. Deterministic, bilingual, RTL. No clutter, no signals.
//
// Usage: node tools/generate-intelligence-indexes.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');

const SURFACES = {
  markets: {
    base: 'markets', title_en: 'Institutional Asset Intelligence', title_ar: 'استخبارات الأصول المؤسسية',
    lead_en: 'Per-asset institutional reads across the broad market — structure, tactical, liquidity and historical context for each core ETF. Educational context, not investment advice.',
    lead_ar: 'قراءات مؤسسية لكل أصل عبر السوق العريض — البنية والتكتيك والسيولة والسياق التاريخي لكل صندوق أساسي. سياق تعليمي وليس نصيحة استثمارية.',
    items: () => ASSETS.map((a) => ({ slug: a.slug, name_en: a.symbol, name_ar: a.symbol, role_en: a.role_en, role_ar: a.role_ar })),
  },
  sectors: {
    base: 'sectors', title_en: 'Institutional Sector Intelligence', title_ar: 'استخبارات القطاعات المؤسسية',
    lead_en: 'Per-sector institutional reads and rotation context across the 10 SPDR sectors. Educational context, not investment advice.',
    lead_ar: 'قراءات مؤسسية لكل قطاع وسياق التدوير عبر قطاعات SPDR العشرة. سياق تعليمي وليس نصيحة استثمارية.',
    items: () => SECTORS.map((s) => ({ slug: s.slug, name_en: s.name_en, name_ar: s.name_ar, role_en: s.role_en, role_ar: s.role_ar })),
  },
  equities: {
    base: 'equities', title_en: 'Institutional Equity Intelligence', title_ar: 'استخبارات الأسهم المؤسسية',
    lead_en: 'Per-equity institutional reads connecting macro → sector → single name across leading US equities. Educational context, not investment advice.',
    lead_ar: 'قراءات مؤسسية لكل سهم تربط الكلي ← القطاع ← السهم عبر أبرز الأسهم الأمريكية. سياق تعليمي وليس نصيحة استثمارية.',
    items: () => EQUITIES.map((e) => ({ slug: e.slug, name_en: `${e.name_en} (${e.symbol})`, name_ar: `${e.name_ar} (${e.symbol})`, role_en: e.sector, role_ar: e.sector })),
  },
};

function buildHead(ar, surf) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${surf.base}/`;
  const title = `${ar ? surf.title_ar : surf.title_en} | TradeAlphaAI`;
  const desc = ar ? surf.lead_ar : surf.lead_en;
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? surf.title_ar : surf.title_en, item: url },
    ] } ] };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/${surf.base}/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/${surf.base}/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/${surf.base}/" />
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

function buildMain(ar, surf) {
  const t = (en, arT) => (ar ? arT : en);
  const items = surf.items();
  const cards = items.map((i) => `          <article class="market-card"><span class="market-card-kicker">${esc(ar ? i.name_ar : i.name_en)}</span><h3><a href="${ar ? '/ar/' : '/'}${surf.base}/${esc(i.slug)}/">${esc(ar ? i.role_ar : i.role_en)}</a></h3></article>`).join('\n');
  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(ar ? surf.title_ar : surf.title_en)}</span></nav>
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(ar ? surf.title_ar : surf.title_en)}</span>
          <h1>${esc(ar ? surf.title_ar : surf.title_en)}</h1>
          <p class="market-lead">${esc(ar ? surf.lead_ar : surf.lead_en)}</p>
        </div>
      </section>
      <section class="market-section" id="intelligence-index">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Coverage', 'التغطية'))}</span><h2>${esc(t('Open a detailed read', 'افتح قراءة مفصّلة'))}</h2></div>
        <div class="market-grid three">
${cards}
        </div>
      </section>
      <section class="market-section" id="intelligence-index-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI intelligence presents institutional interpretation of observed conditions only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم استخبارات TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar, surf) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const headerBlock = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="research"')
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${surf.base}/$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${surf.base}/$2`);
  const footer = template.slice(mainEndIdx);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, surf)}
${bodyTag}${headerBlock}

${buildMain(ar, surf)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  let count = 0;
  for (const surf of Object.values(SURFACES)) {
    for (const [ar, dir] of [[false, surf.base], [true, `ar/${surf.base}`]]) {
      const html = generate(ar, surf);
      if (write) { const outPath = path.join(ROOT, dir, 'index.html'); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, html, 'utf8'); count += 1; }
    }
  }
  console.log(write ? `[intelligence-indexes] wrote ${count} index pages` : `[intelligence-indexes] dry-run`);
}

if (require.main === module) main();

module.exports = { generate, SURFACES };
