'use strict';

// Phase 201 / Workstream B — per-asset institutional intelligence pages.
// /markets/<slug>/ + /ar/markets/<slug>/ for every registry asset. Composes the
// asset-intelligence score, the cognitive-network relationships involving the
// asset, the real institutional chart (when available — honest "awaiting
// approved provider data" otherwise, never a placeholder), and the global
// regime/tactical backdrop. Deterministic, bilingual, RTL. No buy/sell/target.
// Clones the validator-green market-outlook header/footer (no nav re-bake).
//
// Usage: node tools/generate-asset-pages.js [--write]

const fs = require('fs');
const path = require('path');
const { ASSETS, RELATIONSHIPS, BY_SYMBOL } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const ASSET_INTEL = path.join(ROOT, 'data', 'intelligence', 'asset-intelligence.json');
const COGNITIVE = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const DOLLAR_INTEL = path.join(ROOT, 'data', 'intelligence', 'dollar-intelligence.json');
const YIELD_INTEL = path.join(ROOT, 'data', 'intelligence', 'yield-intelligence.json');
const VOLATILITY_INTEL = path.join(ROOT, 'data', 'intelligence', 'volatility-intelligence.json');
const MACRO_REGIME = path.join(ROOT, 'data', 'intelligence', 'macro-regime.json');
const ASSET_HISTORY = path.join(ROOT, 'data', 'intelligence', 'asset-history.json');
const MARKET_NARRATIVE = path.join(ROOT, 'data', 'intelligence', 'market-narrative.json');
const CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const TACTICAL = path.join(ROOT, 'data', 'intelligence', 'tactical-context.json');

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const REGIME_AR = { crowded_growth_positioning: 'تموضع نمو مزدحم', risk_on: 'إقبال على المخاطر', risk_off: 'إحجام عن المخاطر', defensive_rotation: 'تدوير دفاعي', balanced: 'متوازن', fragile_expansion: 'توسّع هش', stable_expansion: 'توسّع مستقر', liquidity_tightening: 'تشديد سيولة', late_cycle: 'مرحلة متأخرة من الدورة', indeterminate: 'غير محدد' };
const LIQ_AR = { ample: 'وفيرة', tightening: 'متشددة', draining: 'تنزف', supportive: 'داعمة', neutral: 'محايدة', constrained: 'مقيّدة', indeterminate: 'غير محدد' };
const STAB_AR = { stable: 'مستقر', fragile: 'هش', deteriorating: 'يتدهور', improving: 'يتحسّن', firm: 'متين', indeterminate: 'غير محدد' };
function humanize(v) { return String(v ?? '').replace(/_/g, ' ').trim() || 'indeterminate'; }
function rv(map, v, ar, neutral) { if (v == null || v === '') return ar ? (neutral || 'غير محدد') : 'indeterminate'; return ar ? (map[v] || neutral || 'غير محدد') : humanize(v); }

function buildHead(ar, asset) {
  const base = ar ? `https://www.tradealphaai.com/ar/markets/${asset.slug}/` : `https://www.tradealphaai.com/markets/${asset.slug}/`;
  const title = ar
    ? `${asset.symbol} — استخبارات الأصل المؤسسية | ${esc(asset.role_ar)} | TradeAlphaAI`
    : `${asset.symbol} — Institutional Asset Intelligence | ${esc(asset.role_en)} | TradeAlphaAI`;
  const desc = ar
    ? `قراءة مؤسسية لـ ${asset.symbol}: ${asset.role_ar}. الحالة الهيكلية والسياق التكتيكي والسيولة والعلاقات عبر الأصول وتوافر المخطط المرصود. سياق تعليمي وليس نصيحة استثمارية أو إشارات تداول.`
    : `Institutional read of ${asset.symbol}: ${asset.role_en}. Structure state, tactical context, liquidity, cross-asset relationships and observed-chart availability. Educational context, not investment advice or trading signals.`;
  const css = ar
    ? ['/css/global-header.css', '../../../styles.css', '../../../landing.css', '../../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url: base, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'الطرفية المؤسسية' : 'Market Terminal', item: ar ? 'https://www.tradealphaai.com/ar/market-terminal/' : 'https://www.tradealphaai.com/market-terminal/' },
        { '@type': 'ListItem', position: 3, name: asset.symbol, item: base },
      ] },
    ],
  };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${base}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/markets/${asset.slug}/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/markets/${asset.slug}/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/markets/${asset.slug}/" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${base}" />
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

function chartFigure(chart, ar) {
  if (!chart || !chart.files || !chart.files[ar ? 'ar' : 'en']) return '';
  let svg = '';
  try { svg = fs.readFileSync(path.join(ROOT, chart.files[ar ? 'ar' : 'en']), 'utf8'); } catch { return ''; }
  svg = svg.replace(/(<svg\b[^>]*?)\s+width="\d+"\s+height="\d+"/, '$1');
  const title = ar ? chart.title_ar : chart.title_en;
  const hook = chart.narrative_hook && chart.narrative_hook[ar ? 'ar' : 'en'];
  const provider = (chart.attribution && chart.attribution.provider) || '—';
  const relevanceTopic = (chart.related_topics || [])[0] || chart.chart_type || chart.visual_type || 'structure';
  return `<figure class="institutional-chart" data-symbol="${esc(chart.symbol)}" data-chart-type="${esc(chart.chart_type || chart.visual_type)}" data-series-hash="${esc(chart.series_hash)}" data-as-of="${esc(chart.as_of)}" data-relevance-topic="${esc(relevanceTopic)}">
  <div class="ic-svg">${svg}</div>
  <figcaption class="ic-caption">
    <span class="ic-hook">${esc(hook || title)}</span>
    <span class="ic-attrib">${esc(`${ar ? 'المصدر' : 'Source'}: ${provider} · ${ar ? 'بتاريخ' : 'As of'} ${chart.as_of}`)}</span>
  </figcaption>
</figure>`;
}

function buildMain(ar, asset, ctx) {
  const t = (en, arT) => (ar ? arT : en);
  const { intel, cognitive, chart, regime, tactical } = ctx;
  const a = ((intel && intel.assets) || []).find((x) => x.symbol === asset.symbol) || null;

  // 1) Score block.
  const compHeads = { structure: t('Structure', 'البنية'), tactical: t('Tactical', 'التكتيك'), liquidity: t('Liquidity', 'السيولة'), participation: t('Participation', 'المشاركة'), cross_asset_alignment: t('Cross-asset', 'عبر الأصول') };
  let scoreBlock;
  if (a) {
    const comps = a.score_components || {};
    const cards = Object.keys(compHeads).filter((k) => comps[k]).map((k) => `          <article class="market-card"><span class="market-card-kicker">${esc(compHeads[k])}</span><h3>${esc(ar ? comps[k].label_ar : comps[k].label_en)}</h3></article>`).join('\n');
    const scoreLabel = ar ? a.score_label_ar : a.score_label_en;
    const dq = ar ? a.data_quality_ar : a.data_quality_en;
    scoreBlock = `      <section class="market-section" id="asset-score">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Asset intelligence', 'استخبارات الأصل'))}</span><h2>${esc(t('Institutional read', 'القراءة المؤسسية'))}: ${esc(scoreLabel)}</h2></div>
        <p class="market-copy">${esc(t('Data quality', 'جودة البيانات'))}: ${esc(dq)} · ${esc(t('a qualitative composition of verified signals — not a recommendation or trade instruction.', 'تركيب نوعي لإشارات موثّقة — وليس توصية أو تعليمات تداول.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
  } else {
    scoreBlock = `      <section class="market-section" id="asset-score">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Asset intelligence', 'استخبارات الأصل'))}</span><h2>${esc(t('Institutional read', 'القراءة المؤسسية'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('A per-asset read is not available right now and is reported plainly rather than inferred.', 'القراءة الخاصة بالأصل غير متاحة حالياً وتُذكر صراحة بدل استنتاجها.'))}</p></div>
      </section>`;
  }

  // 2) Chart or honest unavailable.
  const fig = chartFigure(chart, ar);
  const chartBlock = fig
    ? `      <section class="market-section" id="asset-chart">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Observed price structure', 'البنية السعرية المرصودة'))}</span><h2>${esc(t('Institutional chart', 'المخطط المؤسسي'))}</h2></div>
        <div class="market-panel">${fig}</div>
      </section>`
    : `      <section class="market-section" id="asset-chart">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Observed price structure', 'البنية السعرية المرصودة'))}</span><h2>${esc(t('Institutional chart', 'المخطط المؤسسي'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Awaiting approved provider data — no verified OHLCV chart is available for this asset yet. No placeholder chart is shown.', 'بانتظار بيانات مزوّد معتمدة — لا يتوفر مخطط OHLCV موثّق لهذا الأصل بعد. ولا يُعرض أي مخطط بديل.'))}</p></div>
      </section>`;

  // 3) Market context.
  const contextBlock = `      <section class="market-section" id="asset-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market context', 'سياق السوق'))}</span><h2>${esc(t('The backdrop this asset sits in', 'الخلفية التي يقع فيها هذا الأصل'))}</h2></div>
        <div class="market-grid">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Regime', 'النظام'))}</span><h3>${esc(rv(REGIME_AR, regime && regime.regime, ar, 'نظام مركّب'))}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Liquidity', 'السيولة'))}</span><h3>${esc(rv(LIQ_AR, regime && regime.liquidity_state, ar))}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Stability', 'الاستقرار'))}</span><h3>${esc(rv(STAB_AR, regime && regime.stability, ar))}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Tactical bias', 'الانحياز التكتيكي'))}</span><h3>${esc(tactical && tactical.available && tactical.dimensions && tactical.dimensions.tactical_bias ? (ar ? tactical.dimensions.tactical_bias.label_ar : tactical.dimensions.tactical_bias.label_en) : t('indeterminate', 'غير محدد'))}</h3></article>
        </div>
      </section>`;

  // 4) Cross-asset relationships involving this asset.
  const relDefs = RELATIONSHIPS.filter((r) => r.a === asset.symbol || r.b === asset.symbol);
  const relArtifacts = (cognitive && cognitive.relationships) || [];
  const relCards = relDefs.map((rd) => {
    const art = relArtifacts.find((x) => x.id === rd.id);
    const stateLabel = art ? (ar ? art.state_ar : art.state_en) : t('evidence unavailable', 'الأدلة غير متاحة');
    return `          <article class="market-card"><span class="market-card-kicker">${esc(ar ? rd.ar : rd.en)}</span><h3>${esc(stateLabel)}</h3></article>`;
  }).join('\n');
  const relBlock = relDefs.length
    ? `      <section class="market-section" id="asset-relationships">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Cross-asset relationships', 'العلاقات عبر الأصول'))}</span><h2>${esc(t('How this asset confirms or diverges', 'كيف يؤكّد هذا الأصل أو يتباعد'))}</h2></div>
        <div class="market-grid three">
${relCards}
        </div>
      </section>`
    : '';

  // 4b) Macro influence — the dollar / yield / volatility / regime backdrop this
  // asset sits within (context, not a recommendation).
  const { dollar, yieldArt, volatility, macro } = ctx;
  let macroBlock = '';
  if (macro) {
    const reg = (art, key) => (art ? (ar ? art[`${key}_ar`] : art[`${key}_en`]) : t('indeterminate', 'غير محدد'));
    const cards = [
      [t('Dollar', 'الدولار'), reg(dollar, 'dollar_regime')],
      [t('Yields', 'العوائد'), reg(yieldArt, 'yield_regime')],
      [t('Volatility', 'التقلب'), reg(volatility, 'volatility_regime')],
      [t('Macro regime', 'النظام الكلي'), reg(macro, 'macro_regime')],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    macroBlock = `      <section class="market-section" id="asset-macro-influence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Macro influence', 'التأثير الكلي'))}</span><h2>${esc(t('The macro backdrop around this asset', 'الخلفية الكلية المحيطة بهذا الأصل'))}</h2></div>
        <p class="market-copy">${esc(t('The dollar, yield and volatility regimes that shape how this asset behaves — context only, not a recommendation.', 'أنظمة الدولار والعوائد والتقلب التي تُشكّل سلوك هذا الأصل — سياق فقط، وليست توصية.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;
  }

  // 4c) Historical context — observed trend through time (real OHLCV windows).
  const hist = ctx.history && Array.isArray(ctx.history.items) ? ctx.history.items.find((x) => x.symbol === asset.symbol) : null;
  let historyBlock = '';
  if (hist && hist.available) {
    const dt = hist.dimension_trends || {};
    const cards = [
      [t('Overall', 'الإجمالي'), ar ? hist.overall.label_ar : hist.overall.label_en],
      [t('Structure', 'البنية'), dt.structure ? (ar ? dt.structure.label_ar : dt.structure.label_en) : t('indeterminate', 'غير محدد')],
      [t('Participation', 'المشاركة'), dt.participation ? (ar ? dt.participation.label_ar : dt.participation.label_en) : t('indeterminate', 'غير محدد')],
      [t('Liquidity', 'السيولة'), dt.liquidity ? (ar ? dt.liquidity.label_ar : dt.liquidity.label_en) : t('indeterminate', 'غير محدد')],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    historyBlock = `      <section class="market-section" id="asset-history-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Historical context', 'السياق التاريخي'))}</span><h2>${esc(t('How this asset is changing through time', 'كيف يتغيّر هذا الأصل عبر الزمن'))}</h2></div>
        <p class="market-copy">${esc(t('Observed trends derived from this asset’s own price history (vs ~1 month ago) — improvement, deterioration or persistence. Context, not a forecast.', 'اتجاهات مرصودة مستمدة من تاريخ سعر هذا الأصل (مقابل نحو شهر مضى) — تحسّن أو تدهور أو استمرار. سياق، وليس توقعاً.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;
  }

  // 4d) How this fits the market narrative (compact, links to the terminal story).
  const nar = ctx.narrative;
  let narrativeBlock = '';
  if (nar && nar.available) {
    const cards = [
      [t('Market story', 'سردية السوق'), ar ? nar.dominant_story.label_ar : nar.dominant_story.label_en],
      [t('Macro driver', 'المحرّك الكلي'), ar ? nar.drivers.macro_driver.label_ar : nar.drivers.macro_driver.label_en],
      [t('Cross-asset', 'عبر الأصول'), ar ? nar.drivers.asset_driver.label_ar : nar.drivers.asset_driver.label_en],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    narrativeBlock = `      <section class="market-section" id="asset-narrative-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market narrative', 'سردية السوق'))}</span><h2>${esc(t('How this fits the market narrative', 'كيف يندرج هذا ضمن سردية السوق'))}</h2></div>
        <p class="market-copy">${esc(t('This asset sits inside the integrated market story below — see the', 'يقع هذا الأصل ضمن قصة السوق المتكاملة أدناه — انظر'))} <a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('market terminal', 'الطرفية المؤسسية'))}</a>. ${esc(t('Context, not a forecast.', 'سياق، وليس توقعاً.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
  }

  // 5) Related links.
  const linksBlock = `      <section class="market-section" id="asset-links">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Across the desk', 'عبر المكتب'))}</span><h2>${esc(t('Related institutional intelligence', 'استخبارات مؤسسية ذات صلة'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Terminal', 'الطرفية'))}</span><h3><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Institutional market terminal', 'الطرفية المؤسسية للسوق'))}</a></h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Structure', 'البنية'))}</span><h3><a href="${ar ? '/ar/market-structure/' : '/market-structure/'}">${esc(t('Market structure desk', 'مكتب بنية السوق'))}</a></h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Research', 'الأبحاث'))}</span><h3><a href="${ar ? '/ar/market-news/' : '/market-news/'}">${esc(t('Latest research & news', 'أحدث الأبحاث والأخبار'))}</a></h3></article>
        </div>
      </section>`;

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(asset.symbol)}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Asset Intelligence', 'استخبارات الأصل المؤسسية'))}</span>
          <h1>${esc(asset.symbol)} — ${esc(ar ? asset.role_ar : asset.role_en)}</h1>
          <p class="market-lead">${esc(t(`This is an institutional read of ${asset.symbol} within the wider market structure — its role, its observed structure, the tactical and liquidity backdrop, and how it confirms or diverges from related assets. A deterministic composition of verified signals. Educational context, not technical trading analysis, signals or investment advice.`, `هذه قراءة مؤسسية لـ ${asset.symbol} ضمن بنية السوق الأوسع — دوره وبنيته المرصودة والخلفية التكتيكية والسيولة وكيف يؤكّد أو يتباعد عن الأصول ذات الصلة. تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس تحليل تداول فنياً أو إشارات أو نصيحة استثمارية.`))}</p>
        </div>
      </section>

${scoreBlock}
${chartBlock}
${contextBlock}
${relBlock}
${macroBlock}
${historyBlock}
${narrativeBlock}
${linksBlock}

      <section class="market-section" id="asset-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t(`TradeAlphaAI asset intelligence presents institutional interpretation of observed conditions for ${asset.symbol} only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.`, `تقدم استخبارات الأصل في TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة لـ ${asset.symbol} فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.`))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar, asset, ctx) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const headerBlock = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="market-structure"')
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/markets/${asset.slug}/$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/markets/${asset.slug}/$2`);
  const footer = template.slice(mainEndIdx);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, asset)}
${bodyTag}${headerBlock}

${buildMain(ar, asset, ctx)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  const intel = readJson(ASSET_INTEL);
  const cognitive = readJson(COGNITIVE);
  const chartsManifest = readJson(CHARTS, {});
  const regime = readJson(REGIME);
  const tactical = readJson(TACTICAL);
  const dollar = readJson(DOLLAR_INTEL);
  const yieldArt = readJson(YIELD_INTEL);
  const volatility = readJson(VOLATILITY_INTEL);
  const macro = readJson(MACRO_REGIME);
  const history = readJson(ASSET_HISTORY);
  const narrative = readJson(MARKET_NARRATIVE);
  const chartBySymbol = new Map(((chartsManifest && chartsManifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  let count = 0;
  for (const asset of ASSETS) {
    const ctx = { intel, cognitive, chart: chartBySymbol.get(asset.symbol) || null, regime, tactical, dollar, yieldArt, volatility, macro, history, narrative };
    for (const [ar, dir] of [[false, `markets/${asset.slug}`], [true, `ar/markets/${asset.slug}`]]) {
      const html = generate(ar, asset, ctx);
      if (write) {
        const outPath = path.join(ROOT, dir, 'index.html');
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html, 'utf8');
        count += 1;
      }
    }
  }
  console.log(write ? `[asset-pages] wrote ${count} pages (${ASSETS.length} assets × EN/AR)` : `[asset-pages] dry-run ${ASSETS.length} assets`);
}

if (require.main === module) main();

module.exports = { generate };
