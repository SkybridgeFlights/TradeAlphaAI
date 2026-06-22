'use strict';

// Phase 94 — /briefs/ editorial surface generator.
// Builds the bilingual Briefs section index by cloning the proven, validator-
// green market-outlook index template (byte-identical baked global header +
// footer → no parity/runtime risk, no 568-page re-apply) and swapping only the
// SEO head, breadcrumb, hero, and body. The body presents the desk's briefing
// cadence (Morning Brief / Midday Pulse / Closing Flow / Weekend Macro Brief)
// and surfaces the latest verified daily intelligence brief — honest monitoring
// copy when unverified. No new autonomous publisher: briefs derive from the
// existing verified brief artifact.
//
// Output: briefs/index.html, ar/briefs/index.html
// Usage:  node tools/generate-briefs-index.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRIEF_PATH = path.join(ROOT, 'data', 'intelligence', 'daily-intelligence-brief.json');
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

const EDITIONS = {
  en: [
    ['Morning Brief', 'Pre-session positioning: what the desk is watching into the open — catalysts, regime state, and the overnight read.'],
    ['Midday Pulse', 'Intraday confirmation: whether breadth, volatility, and cross-asset flows are confirming or contradicting the morning read.'],
    ['Closing Flow', 'End-of-session flow digest: what actually traded, what shifted, and the continuation risk into the next session.'],
    ['Weekend Macro Brief', 'Regime reflection: the structural picture, unresolved tensions, and the macro calendar shaping the week ahead.'],
  ],
  ar: [
    ['الموجز الصباحي', 'تموضع ما قبل الجلسة: ما يراقبه المكتب قبل الافتتاح — المحفزات وحالة النظام وقراءة جلسة ما بعد الإغلاق.'],
    ['نبض منتصف الجلسة', 'تأكيد أثناء الجلسة: هل تؤكد مؤشرات الاتساع والتقلب والتدفقات عبر الأصول قراءة الصباح أم تناقضها.'],
    ['تدفقات الإغلاق', 'خلاصة تدفقات نهاية الجلسة: ما الذي تداوله السوق فعلياً، وما الذي تغيّر، ومخاطر الاستمرار إلى الجلسة التالية.'],
    ['الموجز الكلي الأسبوعي', 'تأمل في النظام: الصورة الهيكلية والتوترات غير المحسومة والمفكرة الكلية التي تشكّل الأسبوع المقبل.'],
  ],
};

function buildHead(ar) {
  const url = ar ? 'https://www.tradealphaai.com/ar/briefs/' : 'https://www.tradealphaai.com/briefs/';
  const title = ar ? 'الموجزات المؤسسية | الموجز الصباحي ونبض الجلسة وتدفقات الإغلاق | TradeAlphaAI'
    : 'Institutional Briefs | Morning Brief, Midday Pulse & Closing Flow | TradeAlphaAI';
  const desc = ar ? 'موجزات سوق مؤسسية بإيقاع منصة طرفية: الموجز الصباحي ونبض منتصف الجلسة وتدفقات الإغلاق والموجز الكلي الأسبوعي. سياق تعليمي وليس نصيحة استثمارية.'
    : 'Terminal-rhythm institutional market briefs: Morning Brief, Midday Pulse, Closing Flow, and Weekend Macro Brief. Educational context, not investment advice.';
  const css = ar
    ? ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../styles.css', '../landing.css', '../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'الموجزات' : 'Briefs', item: url },
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
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/briefs/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/briefs/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/briefs/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI institutional briefs preview" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function buildMain(ar, brief) {
  const t = (en, arT) => (ar ? arT : en);
  const verified = fresh(brief) && brief && brief.verified === true;
  const lead = verified && brief.desk_lead ? (ar ? brief.desk_lead.ar : brief.desk_lead.en) : null;
  const coherence = verified && brief.regime && brief.regime.coherence
    ? (ar ? brief.regime.coherence.ar : brief.regime.coherence.en) : null;

  const editionCards = EDITIONS[ar ? 'ar' : 'en'].map(([name, body]) => `          <article class="market-card"><span class="market-card-kicker">${esc(t('Briefing', 'موجز'))}</span><h3>${esc(name)}</h3><p class="market-copy">${esc(body)}</p></article>`).join('\n');

  const latestBlock = lead
    ? `      <section class="market-section" id="latest-brief">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Latest desk brief', 'أحدث موجز للمكتب'))}</span><h2>${esc(t('Latest desk brief', 'أحدث موجز للمكتب'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(lead)}</p>${coherence ? `<p class="market-copy"><strong>${esc(t('Regime coherence', 'اتساق النظام'))}:</strong> ${esc(coherence)}</p>` : ''}</div>
      </section>`
    : `      <section class="market-section" id="latest-brief">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Latest desk brief', 'أحدث موجز للمكتب'))}</span><h2>${esc(t('Latest desk brief', 'أحدث موجز للمكتب'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('The desk is in monitoring mode — the next verified brief publishes with the next sourced data cycle.', 'المكتب في وضع المراقبة — يصدر الموجز الموثق التالي مع دورة البيانات الموثقة القادمة.'))}</p></div>
      </section>`;

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Briefs', 'الموجزات'))}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Briefs', 'الموجزات المؤسسية'))}</span>
          <h1>${esc(t('Terminal-rhythm institutional market briefs', 'موجزات سوق مؤسسية بإيقاع المنصة الطرفية'))}</h1>
          <p class="market-lead">${esc(t('Short, dense, repeatable desk briefings across the trading day — derived only from verified market intelligence. Educational context, not investment advice.', 'موجزات قصيرة وكثيفة ومتكررة للمكتب عبر يوم التداول — مشتقة فقط من استخبارات سوق موثقة. سياق تعليمي وليس نصيحة استثمارية.'))}</p>
        </div>
      </section>

${latestBlock}

      ${require('./narrative-prose').composeFullBody(ar ? 'ar' : 'en', {})}

      <section class="market-section" id="briefing-cadence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Briefing cadence', 'إيقاع الموجزات'))}</span><h2>${esc(t('The desk briefing cadence', 'إيقاع موجزات المكتب'))}</h2></div>
        <div class="market-grid three">
${editionCards}
        </div>
      </section>

      <section class="market-section" id="briefs-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI briefs present educational market context and structural intelligence only. They are not investment advice, recommendations, or forecasts.', 'تقدم موجزات TradeAlphaAI سياقاً تعليمياً للأسواق واستخبارات هيكلية فقط، وليست نصيحة استثمارية أو توصيات أو توقعات.'))}</p></div>
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
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd); // <body class="market-page">
  // Baked header, byte-identical to the canonical → parity/runtime safe.
  // Neutralize the active-section so no nav tab is wrongly highlighted.
  const headerBlock = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="briefs"')
    // Localize ONLY the language-switch links to this surface (preserve nav).
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, '$1/ar/briefs/$2')
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, '$1/briefs/$2');
  const footer = template.slice(mainEndIdx); // </main> already excluded; footer + scripts + </html>

  const brief = readJson(BRIEF_PATH);
  const html = `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar)}
${bodyTag}${headerBlock}

${buildMain(ar, brief)}
${footer}`;
  return html;
}

function main() {
  const write = process.argv.includes('--write');
  for (const [ar, outRel] of [[false, 'briefs/index.html'], [true, 'ar/briefs/index.html']]) {
    const html = generate(ar);
    if (write) {
      const outPath = path.join(ROOT, outRel);
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html, 'utf8');
      console.log(`[briefs-index] wrote ${outRel} (${html.length} chars)`);
    } else {
      console.log(`[briefs-index] dry-run ${outRel}: ${html.length} chars`);
    }
  }
}

if (require.main === module) main();

module.exports = { generate };
