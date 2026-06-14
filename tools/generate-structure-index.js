'use strict';

// Phase 116 — /market-structure/ institutional structure-analysis surface.
// Same production-safe clone strategy as /market-news/ and /briefs/: clone the
// validator-green market-outlook index template (byte-identical baked global
// header + footer → no nav re-bake, parity untouched), swapping only SEO head,
// breadcrumb, hero and body. Surfaces the current deterministic structure read
// from market-structure.json and lists published structure notes — honest
// "structure read unavailable" copy when the upstream regime is indeterminate.
//
// Output: market-structure/index.html, ar/market-structure/index.html
// Usage:  node tools/generate-structure-index.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STRUCTURE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-structure.json');
const STALE_HOURS = 48;

function readJson(p, fallback = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function fresh(a) { return a && a.generated_at && (Date.now() - new Date(a.generated_at).getTime()) / 3600000 <= STALE_HOURS; }

const COVERAGE = {
  en: [
    ['Participation & breadth', 'Whether index strength is shared across the market or carried by a narrow set of leaders — read through leadership, regime breadth and multi-session memory, not oscillators.'],
    ['Volatility & coherence', 'Volatility structure and cross-asset coherence: whether the tape transmits a shock cleanly or fragments it, and whether quiet reflects balance or a temporary absence of force.'],
    ['Rotation & concentration', 'Defensive versus cyclical leadership and how much of the move depends on a small set of names — the structural composition beneath the level.'],
    ['Stability & liquidity', 'How much stress the structure can absorb before it changes character, whether real flow is behind the move, and how many verified sessions support the read.'],
  ],
  ar: [
    ['المشاركة والاتساع', 'ما إذا كانت قوة المؤشر موزّعة عبر السوق أم محمولة على مجموعة ضيقة من القادة — تُقرأ عبر القيادة واتساع النظام والذاكرة متعددة الجلسات، لا عبر المذبذبات.'],
    ['التذبذب والاتساق', 'بنية التذبذب والاتساق عبر الأصول: هل ينقل السوق الصدمة بوضوح أم يجزّئها، وهل يعكس الهدوء توازناً أم غياباً مؤقتاً للقوة.'],
    ['التدوير والتركّز', 'القيادة الدفاعية مقابل الدورية ومقدار اعتماد الحركة على مجموعة صغيرة من الأسماء — التركيب الهيكلي تحت المستوى.'],
    ['الاستقرار والسيولة', 'مقدار الضغط الذي تمتصه البنية قبل أن تتغير طبيعتها، وهل تدفق حقيقي خلف الحركة، وكم جلسة موثّقة تدعم القراءة.'],
  ],
};

function buildHead(ar) {
  const url = ar ? 'https://www.tradealphaai.com/ar/market-structure/' : 'https://www.tradealphaai.com/market-structure/';
  const title = ar ? 'تحليل بنية السوق المؤسسي | المشاركة والتذبذب والاتساق عبر الأصول | TradeAlphaAI'
    : 'Institutional Market Structure Analysis | Participation, Volatility & Cross-Asset Coherence | TradeAlphaAI';
  const desc = ar ? 'تفسير مؤسسي لبنية السوق: المشاركة والاتساع والتذبذب والاتساق عبر الأصول والتدوير والتركّز والاستقرار الهيكلي — تركيب حتمي لإشارات موثّقة لا تحليل تداول أو إشارات. سياق تعليمي وليس نصيحة استثمارية.'
    : 'Institutional interpretation of market structure: participation, breadth, volatility structure, cross-asset coherence, rotation, concentration and stability — a deterministic composition of verified signals, not trading analysis or signals. Educational context, not investment advice.';
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'بنية السوق' : 'Market Structure', item: url },
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
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/market-structure/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/market-structure/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/market-structure/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI institutional market structure preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function publishedArticles(ar) {
  const dir = path.join(ROOT, ar ? 'ar/market-structure' : 'market-structure');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html'); } catch { return []; }
  return files.map((f) => {
    let title = f.replace(/\.html$/, '');
    try { const m = fs.readFileSync(path.join(dir, f), 'utf8').match(/<h1>([\s\S]*?)<\/h1>/i); if (m) title = m[1].replace(/<[^>]+>/g, '').trim(); } catch { /* keep slug */ }
    return { href: `${ar ? '/ar/market-structure/' : '/market-structure/'}${f}`, title };
  }).sort((a, b) => b.href.localeCompare(a.href));
}

// Current structure read cards from the deterministic engine artifact (honest).
function currentReadBlock(ar, structure) {
  const t = (en, arT) => (ar ? arT : en);
  if (!fresh(structure) || !structure.available) {
    return `      <section class="market-section" id="current-structure">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Structure read', 'قراءة البنية'))}</span><h2>${esc(t('Structure read', 'قراءة البنية'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('The structural read is currently indeterminate on the observed dimensions. The structure desk reports this plainly rather than asserting a structure the evidence does not support.', 'القراءة الهيكلية غير محددة حالياً وفق الأبعاد المرصودة. ويذكر مكتب البنية ذلك صراحة بدل تأكيد بنية لا تدعمها الأدلة.'))}</p></div>
      </section>`;
  }
  const dims = structure.dimensions || {};
  const order = ['participation', 'volatility_structure', 'cross_asset', 'rotation', 'concentration', 'stability'];
  const heads = {
    participation: t('Participation', 'المشاركة'), volatility_structure: t('Volatility', 'التذبذب'), cross_asset: t('Cross-asset', 'عبر الأصول'),
    rotation: t('Rotation', 'التدوير'), concentration: t('Concentration', 'التركّز'), stability: t('Stability', 'الاستقرار'),
  };
  const cards = order.filter((d) => dims[d]).map((d) => {
    const label = ar ? dims[d].label_ar : dims[d].label_en;
    return `          <article class="market-card"><span class="market-card-kicker">${esc(heads[d])}</span><h3>${esc(label)}</h3></article>`;
  }).join('\n');
  const asOf = (structure.generated_at || '').slice(0, 10) || '—';
  return `      <section class="market-section" id="current-structure">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Current structure read', 'قراءة البنية الحالية'))}</span><h2>${esc(t('What the structure desk reads now', 'ما يقرأه مكتب البنية الآن'))}</h2></div>
        <p class="market-copy">${esc(t('Snapshot · as of', 'لقطة · بتاريخ'))} ${esc(asOf)} · ${esc(t('structural confidence', 'الثقة الهيكلية'))} ${esc(structure.structural_confidence != null ? structure.structural_confidence : '—')}/100 · ${esc(t('deterministic composition of verified signals', 'تركيب حتمي لإشارات موثّقة'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
}

function buildMain(ar, structure) {
  const t = (en, arT) => (ar ? arT : en);
  const published = publishedArticles(ar);
  const publishedBlock = published.length
    ? `      <section class="market-section" id="published-structure">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Published structure notes', 'مذكرات بنية منشورة'))}</span><h2>${esc(t('Published structure analysis', 'تحليلات البنية المنشورة'))}</h2></div>
        <div class="market-grid three">
${published.map((a) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Structure', 'بنية'))}</span><h3><a href="${esc(a.href)}">${esc(a.title)}</a></h3></article>`).join('\n')}
        </div>
      </section>`
    : '';
  const coverageCards = COVERAGE[ar ? 'ar' : 'en'].map(([name, body]) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Reads', 'يقرأ'))}</span><h3>${esc(name)}</h3><p class="market-copy">${esc(body)}</p></article>`).join('\n');

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Market Structure', 'بنية السوق'))}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Market Structure', 'بنية السوق المؤسسية'))}</span>
          <h1>${esc(t('Structure beneath the level, not signals on top of it', 'البنية تحت المستوى، لا إشارات فوقه'))}</h1>
          <p class="market-lead">${esc(t('The structure desk reads participation, volatility structure, cross-asset coherence, rotation, concentration and stability — what the surface level is built on, not where it goes next. A deterministic composition of verified signals. Educational context, not technical trading analysis, signals or investment advice.', 'يقرأ مكتب البنية المشاركة وبنية التذبذب والاتساق عبر الأصول والتدوير والتركّز والاستقرار — ما يستند إليه المستوى السطحي لا وجهته التالية. تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس تحليل تداول فنياً أو إشارات أو نصيحة استثمارية.'))}</p>
        </div>
      </section>

${currentReadBlock(ar, structure)}
${publishedBlock}

      <section class="market-section" id="structure-coverage">
        <div class="market-section-head"><span class="eyebrow">${esc(t('What the structure desk reads', 'ما يقرأه مكتب البنية'))}</span><h2>${esc(t('Structure dimensions', 'أبعاد البنية'))}</h2></div>
        <div class="market-grid three">
${coverageCards}
        </div>
      </section>

      <section class="market-section" id="structure-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI market structure presents institutional structural interpretation only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم بنية سوق TradeAlphaAI تفسيراً هيكلياً مؤسسياً فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div>
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
    .replace('data-active-section="market-outlook"', 'data-active-section="market-structure"');
  const footer = template.slice(mainEndIdx);
  const structure = readJson(STRUCTURE_PATH);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar)}
${bodyTag}${headerBlock}

${buildMain(ar, structure)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  for (const [ar, outRel] of [[false, 'market-structure/index.html'], [true, 'ar/market-structure/index.html']]) {
    const html = generate(ar);
    if (write) {
      const outPath = path.join(ROOT, outRel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`[structure-index] wrote ${outRel} (${html.length} chars)`);
    } else {
      console.log(`[structure-index] dry-run ${outRel}: ${html.length} chars`);
    }
  }
}

if (require.main === module) main();

module.exports = { generate };
