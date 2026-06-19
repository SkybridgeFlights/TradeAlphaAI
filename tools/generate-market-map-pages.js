'use strict';

// Phase 211 / CP2-CP7 — visual market map pages.
// /market-map/{assets,sectors,equities,regime,network,history}/ + AR. Renders the
// existing intelligence as responsive SVG heatmaps + visual panels (no plain
// tables, no prediction gauges). Deterministic, bilingual, RTL, evidence-backed,
// links to detail pages only (no raw artifacts). Clones the market-outlook header.
//
// Usage: node tools/generate-market-map-pages.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const V = (n) => path.join(ROOT, 'data', 'visual', n);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const SURFACES = {
  assets: { slug: 'assets', kind: 'entity', map: 'asset-map.json', title_en: 'Asset Map', title_ar: 'خريطة الأصول', lead_en: 'A visual map of the broad-market assets, colour-encoded by institutional strength with historical direction and confirmation. Educational context, not signals.', lead_ar: 'خريطة بصرية لأصول السوق العريض، ملوّنة حسب القوة المؤسسية مع الاتجاه التاريخي والتأكيد. سياق تعليمي وليس إشارات.' },
  sectors: { slug: 'sectors', kind: 'entity', map: 'sector-map.json', title_en: 'Sector Map', title_ar: 'خريطة القطاعات', lead_en: 'A visual map of the 10 sectors grouped by leadership and strength with direction and confirmation. Educational context, not signals.', lead_ar: 'خريطة بصرية للقطاعات العشرة مجمّعة حسب القيادة والقوة مع الاتجاه والتأكيد. سياق تعليمي وليس إشارات.' },
  equities: { slug: 'equities', kind: 'entity', map: 'equity-map.json', title_en: 'Equity Leadership Map', title_ar: 'خريطة قيادة الأسهم', lead_en: 'A visual leadership map of leading equities positioned by ranking, historical direction and sector alignment. Educational context, not signals.', lead_ar: 'خريطة قيادة بصرية لأبرز الأسهم مرتّبة حسب التصنيف والاتجاه التاريخي والمواءمة القطاعية. سياق تعليمي وليس إشارات.' },
  regime: { slug: 'regime', kind: 'regime', title_en: 'Regime Map', title_ar: 'خريطة النظام', lead_en: 'A visual view of the current market regime — dollar, yields, volatility, narrative and historical transition. No gauges, no probabilities. Educational context.', lead_ar: 'عرض بصري للنظام الحالي للسوق — الدولار والعوائد والتقلب والسردية والتحوّل التاريخي. دون مقاييس أو احتمالات. سياق تعليمي.' },
  network: { slug: 'network', kind: 'network', title_en: 'Confirmation Network Map', title_ar: 'خريطة شبكة التأكيد', lead_en: 'A visual view of the cross-asset confirmation and contradiction relationships — evidence-backed links only. Educational context, not signals.', lead_ar: 'عرض بصري لعلاقات التأكيد والتناقض عبر الأصول — روابط مدعومة بالأدلة فقط. سياق تعليمي وليس إشارات.' },
  history: { slug: 'history', kind: 'history', title_en: 'Historical Evolution Map', title_ar: 'خريطة التطوّر التاريخي', lead_en: 'A visual view of what is improving, stable, weakening or deteriorating across the desk. If history is insufficient it is shown honestly. Educational context.', lead_ar: 'عرض بصري لما يتحسّن أو يستقر أو يضعف أو يتدهور عبر المكتب. وإن كان التاريخ غير كافٍ يُعرض ذلك بصدق. سياق تعليمي.' },
};

// ── Responsive SVG heatmap of entity cells. ──
function heatmapSvg(cells, ar) {
  const cols = 4; const cw = 286; const ch = 116; const gap = 12; const padX = 20; const padY = 20;
  const rows = Math.ceil(cells.length / cols);
  const width = padX * 2 + cols * cw + (cols - 1) * gap;
  const height = padY * 2 + rows * ch + (rows - 1) * gap + 8;
  const font = ar ? "'Tajawal','Cairo','Segoe UI',Arial,sans-serif" : "'Inter','Segoe UI',Arial,sans-serif";
  const parts = [`<rect width="${width}" height="${height}" fill="#0b0e13"/>`];
  cells.forEach((c, i) => {
    const col = ar ? (cols - 1 - (i % cols)) : (i % cols); const row = Math.floor(i / cols);
    const x = padX + col * (cw + gap); const y = padY + row * (ch + gap);
    const cx = x + cw / 2;
    parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="10" fill="${c.color}" opacity="0.92"/>`);
    parts.push(`<text x="${cx}" y="${y + 40}" text-anchor="middle" font-family="${font}" font-size="26" font-weight="760" fill="#f4f7f1">${esc(c.symbol)} ${esc(c.direction_glyph)}</text>`);
    parts.push(`<text x="${cx}" y="${y + 70}" text-anchor="middle" font-family="${font}" font-size="15" fill="#eef2ec">${esc(ar ? c.rank_label_ar : c.rank_label_en)}</text>`);
    parts.push(`<text x="${cx}" y="${y + 95}" text-anchor="middle" font-family="${font}" font-size="13" fill="#d7ded6">${esc(ar ? c.direction_ar : c.direction_en)} · ${esc(ar ? c.confirmation_ar : c.confirmation_en)}</text>`);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ar ? 'خريطة' : 'map')}" preserveAspectRatio="xMidYMid meet"${ar ? ' direction="rtl"' : ''} class="market-map-svg">
${parts.join('\n')}
</svg>`;
}

function chip(label, value, color) { return `          <article class="market-card" style="border-inline-start:4px solid ${esc(color)}"><span class="market-card-kicker">${esc(label)}</span><h3>${esc(value)}</h3></article>`; }

function entityBody(ar, surf, t) {
  const map = readJson(V(surf.map), {});
  const cells = (map && map.cells) || [];
  const svg = cells.length ? `<div class="market-panel"><div class="ic-svg">${heatmapSvg(cells, ar)}</div></div>` : `<div class="market-panel"><p class="market-copy">${esc(t('Map data is not available right now and is reported plainly.', 'بيانات الخريطة غير متاحة حالياً وتُذكر صراحة.'))}</p></div>`;
  const links = cells.map((c) => `          <article class="market-card" style="border-inline-start:4px solid ${esc(c.color)}"><span class="market-card-kicker">${esc(c.symbol)} ${esc(c.direction_glyph)}</span><h3><a href="${ar ? '/ar' : ''}${esc(c.href)}">${esc(ar ? c.rank_label_ar : c.rank_label_en)}</a></h3></article>`).join('\n');
  return `      <section class="market-section" id="market-map"><div class="market-section-head"><span class="eyebrow">${esc(t('Visual map', 'خريطة بصرية'))}</span><h2>${esc(t('Strength map', 'خريطة القوة'))}</h2></div>${svg}</section>
      <section class="market-section" id="market-map-links"><div class="market-section-head"><span class="eyebrow">${esc(t('Open a detailed read', 'افتح قراءة مفصّلة'))}</span><h2>${esc(t('Entities', 'الكيانات'))}</h2></div><div class="market-grid three">
${links}
        </div></section>`;
}

function regimeBody(ar, t) {
  const macro = readJson(J('macro-regime.json'), {});
  const dollar = readJson(J('dollar-intelligence.json'), {});
  const yieldA = readJson(J('yield-intelligence.json'), {});
  const vol = readJson(J('volatility-intelligence.json'), {});
  const narr = readJson(J('market-narrative.json'), {});
  const trans = readJson(J('regime-transitions.json'), {});
  const lv = (o, k) => (o && o[`${k}_${ar ? 'ar' : 'en'}`] ? o[`${k}_${ar ? 'ar' : 'en'}`] : (ar ? 'غير محدد' : 'indeterminate'));
  const chips = [
    [t('Macro regime', 'النظام الكلي'), lv(macro, 'macro_regime'), '#2f8f76'],
    [t('Dollar', 'الدولار'), lv(dollar, 'dollar_regime'), '#5a8f7a'],
    [t('Yields', 'العوائد'), lv(yieldA, 'yield_regime'), '#46505f'],
    [t('Volatility', 'التقلب'), lv(vol, 'volatility_regime'), '#b58b56'],
    [t('Narrative', 'السردية'), narr && narr.dominant_story ? (ar ? narr.dominant_story.label_ar : narr.dominant_story.label_en) : t('indeterminate', 'غير محدد'), '#2f8f76'],
    [t('Historical transition', 'التحوّل التاريخي'), lv(trans, 'transition_state'), '#c2703c'],
  ].map(([k, v, c]) => chip(k, v, c)).join('\n');
  return `      <section class="market-section" id="market-map"><div class="market-section-head"><span class="eyebrow">${esc(t('Regime map', 'خريطة النظام'))}</span><h2>${esc(t('Current regime components', 'مكوّنات النظام الحالي'))}</h2></div>
        <p class="market-copy">${esc(t('Each component is a state read, not a gauge or probability.', 'كل مكوّن قراءة حالة، وليس مقياساً أو احتمالاً.'))}</p>
        <div class="market-grid three">
${chips}
        </div></section>`;
}

function networkBody(ar, t) {
  const net = readJson(J('cognitive-network.json'), {});
  const rels = (net && net.relationships) || [];
  const colorOf = (s) => (s === 'confirmation' ? '#2f8f76' : s === 'contradiction' ? '#b5523f' : s === 'stress' ? '#c2703c' : '#46505f');
  const cards = rels.map((r) => chip(ar ? r.label_ar : r.label_en, ar ? (r.state_ar || r.state) : (r.state_en || r.state), colorOf(r.state))).join('\n');
  const body = rels.length ? `<div class="market-grid three">\n${cards}\n        </div>` : `<div class="market-panel"><p class="market-copy">${esc(t('No evidence-backed relationships are available right now.', 'لا توجد علاقات مدعومة بالأدلة متاحة حالياً.'))}</p></div>`;
  return `      <section class="market-section" id="market-map"><div class="market-section-head"><span class="eyebrow">${esc(t('Confirmation network', 'شبكة التأكيد'))}</span><h2>${esc(t('Cross-asset relationships', 'العلاقات عبر الأصول'))}</h2></div>
        <p class="market-copy">${esc(t('Evidence-backed links only — confirmation, contradiction or stress. No fabricated edges.', 'روابط مدعومة بالأدلة فقط — تأكيد أو تناقض أو ضغط. دون حواف مُفبركة.'))}</p>
        ${body}</section>`;
}

function historyBody(ar, t) {
  const hist = readJson(J('historical-intelligence.json'), {});
  const buckets = { improving: [], stable: [], weakening: [], deteriorating: [] };
  for (const g of ['asset', 'sector', 'equity']) for (const x of ((hist.groups && hist.groups[g]) || [])) {
    const m = x.momentum && x.momentum.state;
    if (/strong_positive|positive/.test(m)) buckets.improving.push(x.symbol);
    else if (m === 'neutral') buckets.stable.push(x.symbol);
    else if (/strong_negative|negative/.test(m)) buckets.deteriorating.push(x.symbol);
  }
  const any = Object.values(buckets).some((b) => b.length);
  if (!any) return `      <section class="market-section" id="market-map"><div class="market-section-head"><span class="eyebrow">${esc(t('Historical evolution', 'التطوّر التاريخي'))}</span><h2>${esc(t('Historical evolution', 'التطوّر التاريخي'))}</h2></div><div class="market-panel"><p class="market-copy">${esc(t('Insufficient history is available; this is reported honestly rather than fabricated.', 'التاريخ المتاح غير كافٍ؛ ويُذكر ذلك بصدق بدل اختلاقه.'))}</p></div></section>`;
  const cards = [
    [t('Improving', 'يتحسّن'), buckets.improving, '#2f8f76'],
    [t('Stable', 'مستقر'), buckets.stable, '#46505f'],
    [t('Deteriorating', 'يتدهور'), buckets.deteriorating, '#b5523f'],
  ].map(([k, arr, c]) => chip(k, arr.length ? arr.join(' · ') : t('none', 'لا يوجد'), c)).join('\n');
  return `      <section class="market-section" id="market-map"><div class="market-section-head"><span class="eyebrow">${esc(t('Historical evolution', 'التطوّر التاريخي'))}</span><h2>${esc(t('What is changing', 'ما الذي يتغيّر'))}</h2></div>
        <p class="market-copy">${esc(t('Observed momentum across assets, sectors and equities. Context, not a forecast.', 'الزخم المرصود عبر الأصول والقطاعات والأسهم. سياق، وليس توقعاً.'))}</p>
        <div class="market-grid three">
${cards}
        </div></section>`;
}

function buildHead(ar, surf) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}market-map/${surf.slug}/`;
  const title = `${ar ? surf.title_ar : surf.title_en} | TradeAlphaAI`;
  const desc = ar ? surf.lead_ar : surf.lead_en;
  const css = ar
    ? ['/css/global-header.css', '../../../styles.css', '../../../landing.css', '../../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'الطرفية المؤسسية' : 'Market Terminal', item: ar ? 'https://www.tradealphaai.com/ar/market-terminal/' : 'https://www.tradealphaai.com/market-terminal/' },
      { '@type': 'ListItem', position: 3, name: ar ? surf.title_ar : surf.title_en, item: url },
    ] } ] };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/market-map/${surf.slug}/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/market-map/${surf.slug}/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/market-map/${surf.slug}/" />
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
  let body;
  if (surf.kind === 'entity') body = entityBody(ar, surf, t);
  else if (surf.kind === 'regime') body = regimeBody(ar, t);
  else if (surf.kind === 'network') body = networkBody(ar, t);
  else body = historyBody(ar, t);
  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(ar ? surf.title_ar : surf.title_en)}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('Visual Market Maps', 'خرائط السوق البصرية'))}</span><h1>${esc(ar ? surf.title_ar : surf.title_en)}</h1><p class="market-lead">${esc(ar ? surf.lead_ar : surf.lead_en)}</p></div></section>
${body}
      <section class="market-section" id="market-map-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI visual maps present institutional interpretation of observed conditions only. They are not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم خرائط TradeAlphaAI البصرية تفسيراً مؤسسياً للظروف المرصودة فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div></section>
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
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/market-map/${surf.slug}/$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/market-map/${surf.slug}/$2`);
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
    for (const [ar, dir] of [[false, `market-map/${surf.slug}`], [true, `ar/market-map/${surf.slug}`]]) {
      const html = generate(ar, surf);
      if (write) { const outPath = path.join(ROOT, dir, 'index.html'); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, html, 'utf8'); count += 1; }
    }
  }
  console.log(write ? `[market-map-pages] wrote ${count} pages` : `[market-map-pages] dry-run`);
}

if (require.main === module) main();

module.exports = { generate, SURFACES };
