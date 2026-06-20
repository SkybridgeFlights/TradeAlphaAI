'use strict';

// Phase 206 / Workstream G — per-equity intelligence pages.
// /equities/<slug>/ + /ar/equities/<slug>/ for every registry equity. Composes
// the company profile, intelligence score, structure/tactical/liquidity/
// participation states, macro + sector influence, related assets/sectors/
// equities, the real equity chart (or honest awaiting state), and disclaimer.
// Deterministic, bilingual, RTL. No advice. Clones the market-outlook header.
//
// Usage: node tools/generate-equity-pages.js [--write]

const fs = require('fs');
const path = require('path');
const { EQUITIES } = require('./equity-registry');
const { BY_SYMBOL: SECTOR_BY_SLUG } = (() => { const r = require('./sector-registry'); return { BY_SYMBOL: new Map(r.SECTORS.map((s) => [s.slug, s])) }; })();
const { relatedResearchBlock } = require('./related-research');
const { recentChangesBlock } = require('./recent-changes');

const ROOT = path.resolve(__dirname, '..');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const EQUITY_CHARTS = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const EQUITY_RANKINGS = J('equity-rankings.json');
const RANKING_HISTORY = J('ranking-history.json');
const MARKET_REGIME_DASHBOARD = J('market-regime-dashboard.json');

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function buildHead(ar, eq) {
  const base = ar ? `https://www.tradealphaai.com/ar/equities/${eq.slug}/` : `https://www.tradealphaai.com/equities/${eq.slug}/`;
  const title = ar ? `${eq.name_ar} (${eq.symbol}) — استخبارات السهم المؤسسية | TradeAlphaAI` : `${eq.name_en} (${eq.symbol}) — Institutional Equity Intelligence | TradeAlphaAI`;
  const desc = ar
    ? `قراءة مؤسسية لسهم ${eq.name_ar} (${eq.symbol}): البنية والتكتيك والسيولة والمشاركة والتأثير الكلي والقطاعي ودرجة الاستخبارات. سياق تعليمي وليس نصيحة استثمارية.`
    : `Institutional read of ${eq.name_en} (${eq.symbol}): structure, tactical, liquidity and participation states, macro and sector influence, and an intelligence score. Educational context, not investment advice.`;
  const css = ar
    ? ['/css/global-header.css', '../../../styles.css', '../../../landing.css', '../../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url: base, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'الطرفية المؤسسية' : 'Market Terminal', item: ar ? 'https://www.tradealphaai.com/ar/market-terminal/' : 'https://www.tradealphaai.com/market-terminal/' },
      { '@type': 'ListItem', position: 3, name: eq.symbol, item: base },
    ] } ] };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${base}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/equities/${eq.slug}/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/equities/${eq.slug}/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/equities/${eq.slug}/" />
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
  const provider = (chart.attribution && chart.attribution.provider) || '—';
  return `<figure class="institutional-chart" data-symbol="${esc(chart.symbol)}" data-chart-type="${esc(chart.chart_type || chart.visual_type)}" data-series-hash="${esc(chart.series_hash)}" data-as-of="${esc(chart.as_of)}" data-relevance-topic="${esc(chart.equity_slug || 'equity')}">
  <div class="ic-svg">${svg}</div>
  <figcaption class="ic-caption">
    <span class="ic-hook">${esc(title)}</span>
    <span class="ic-attrib">${esc(`${ar ? 'المصدر' : 'Source'}: ${provider} · ${ar ? 'بتاريخ' : 'As of'} ${chart.as_of}`)}</span>
  </figcaption>
</figure>`;
}

function layerState(art, sym, ar) { const x = art && Array.isArray(art.equities) ? art.equities.find((e) => e.symbol === sym) : null; return x ? (ar ? x.label_ar : x.label_en) : (ar ? 'غير محدد' : 'indeterminate'); }

function rankingPositionBlock(ar, eq, rankings, history) {
  const t = (en, arT) => (ar ? arT : en);
  const item = rankings && Array.isArray(rankings.items) ? rankings.items.find((x) => x.symbol === eq.symbol) : null;
  if (!item) return '';
  const movement = (((history || {}).groups || {}).equity || []).find((x) => x.symbol === eq.symbol);
  const rank = ar ? item.rank_label_ar : item.rank_label_en;
  const direction = ar ? item.direction_ar : item.direction_en;
  const confirmation = ar ? item.confirmation_ar : item.confirmation_en;
  const move = ar ? (movement?.movement_ar || 'لا لقطة سابقة') : (movement?.movement_en || 'no prior snapshot');
  const evidence = (item.evidence || []).slice(0, 3).join(' · ');
  return `      <section class="market-section" id="equity-ranking-position">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Ranking context', 'سياق الترتيب'))}</span><h2>${esc(t('Relative position within the market', 'الموضع النسبي داخل السوق'))}: ${esc(rank)}</h2></div>
        <p class="market-copy">${esc(t('This ranking compares observed single-name structure, historical direction and confirmation state across the equity universe. It is relative context only, not a recommendation or trade instruction.', 'يقارن هذا الترتيب بنية السهم المرصودة والاتجاه التاريخي وحالة التأكيد عبر عالم الأسهم. وهو سياق نسبي فقط، وليس توصية أو تعليمات تداول.'))}</p>
        <div class="market-grid">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Current position', 'الموضع الحالي'))}</span><h3>${esc(rank)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Historical direction', 'الاتجاه التاريخي'))}</span><h3>${esc(direction)} · ${esc(move)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Confirmation', 'التأكيد'))}</span><h3>${esc(confirmation)}</h3></article>
        </div>
        <p class="market-copy">${esc(t('Evidence', 'الأدلة'))}: ${esc(evidence || t('awaiting evidence', 'بانتظار الأدلة'))}</p>
      </section>`;
}

function regimeFitBlock(ar, eq, dashboard) {
  const t = (en, arT) => (ar ? arT : en);
  if (!dashboard || dashboard.source_layer !== 'market-regime-dashboard') return '';
  const node = (key, fallback) => dashboard[key] || { label_en: fallback, label_ar: 'غير محدد', state: fallback };
  const current = node('current_regime', 'indeterminate');
  const risk = node('risk_state', 'indeterminate');
  const confirmation = node('dominant_confirmation_state', 'indeterminate');
  const transition = node('historical_transition_state', 'indeterminate');
  const evidence = (dashboard.evidence_refs || []).slice(0, 3).map((ref) => `${ref.source || 'source'}: ${ref.value || 'observed'}`).join(' · ');
  return `      <section class="market-section" id="equity-regime-fit">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Regime context', 'سياق النظام'))}</span><h2>${esc(t('How this fits the current regime', 'كيف ينسجم هذا مع النظام الحالي'))}</h2></div>
        <p class="market-copy">${esc(t(`${eq.name_en} is read through the current command-center regime, market risk state and confirmation backdrop. This is context classification only.`, `يُقرأ سهم ${eq.name_ar} عبر نظام مركز القيادة الحالي وحالة مخاطر السوق وخلفية التأكيد. هذا تصنيف سياقي فقط.`))}</p>
        <div class="market-grid">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Current regime', 'النظام الحالي'))}</span><h3>${esc(ar ? current.label_ar : current.label_en)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Risk state', 'حالة المخاطر'))}</span><h3>${esc(ar ? risk.label_ar : risk.label_en)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Confirmation state', 'حالة التأكيد'))}</span><h3>${esc(ar ? confirmation.label_ar : confirmation.label_en)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Transition state', 'حالة الانتقال'))}</span><h3>${esc(ar ? transition.label_ar : transition.label_en)}</h3></article>
        </div>
        <p class="market-copy">${esc(t('Evidence', 'الأدلة'))}: ${esc(evidence || t('awaiting evidence', 'بانتظار الأدلة'))}</p>
      </section>`;
}

function buildMain(ar, eq, ctx) {
  const t = (en, arT) => (ar ? arT : en);
  const { chart, structure, tactical, liquidity, participation, intelligence, macro, sectorStructure, rankings, rankingHistory, marketRegime } = ctx;
  const sector = SECTOR_BY_SLUG.get(eq.sector);
  const scored = intelligence && Array.isArray(intelligence.equities) ? intelligence.equities.find((e) => e.symbol === eq.symbol) : null;
  const scoreLabel = scored ? (ar ? scored.score_label_ar : scored.score_label_en) : t('indeterminate', 'غير محدد');

  const scoreBlock = `      <section class="market-section" id="equity-score">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Equity intelligence', 'استخبارات السهم'))}</span><h2>${esc(t('Institutional read', 'القراءة المؤسسية'))}: ${esc(scoreLabel)}</h2></div>
        <p class="market-copy">${esc(t('A qualitative composition of structure, tactical, liquidity, participation, macro and sector context — not a recommendation or trade instruction.', 'تركيب نوعي للبنية والتكتيك والسيولة والمشاركة والسياق الكلي والقطاعي — وليس توصية أو تعليمات تداول.'))}</p>
      </section>`;

  const fig = chartFigure(chart, ar);
  const chartBlock = `      <section class="market-section" id="equity-chart">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Observed price structure', 'البنية السعرية المرصودة'))}</span><h2>${esc(t('Equity chart', 'مخطط السهم'))}</h2></div>
        ${fig ? `<div class="market-panel">${fig}</div>` : `<div class="market-panel"><p class="market-copy">${esc(t('Awaiting approved provider data — no verified OHLCV chart is available for this equity yet. No placeholder chart is shown.', 'بانتظار بيانات مزوّد معتمدة — لا يتوفر مخطط OHLCV موثّق لهذا السهم بعد. ولا يُعرض أي مخطط بديل.'))}</p></div>`}
      </section>`;

  const cards = [
    [t('Structure', 'البنية'), layerState(structure, eq.symbol, ar)],
    [t('Tactical', 'التكتيك'), layerState(tactical, eq.symbol, ar)],
    [t('Liquidity', 'السيولة'), layerState(liquidity, eq.symbol, ar)],
    [t('Participation', 'المشاركة'), layerState(participation, eq.symbol, ar)],
  ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
  const contextBlock = `      <section class="market-section" id="equity-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Intelligence layers', 'طبقات الاستخبارات'))}</span><h2>${esc(t('Per-equity read', 'قراءة خاصة بالسهم'))}</h2></div>
        <div class="market-grid">
${cards}
        </div>
      </section>`;

  const macroReg = macro && macro.available ? (ar ? macro.macro_regime_ar : macro.macro_regime_en) : t('indeterminate', 'غير محدد');
  const secState = sectorStructure && Array.isArray(sectorStructure.sectors) ? (() => { const s = sectorStructure.sectors.find((x) => x.slug === eq.sector); return s ? (ar ? s.label_ar : s.label_en) : t('indeterminate', 'غير محدد'); })() : t('indeterminate', 'غير محدد');
  const macroBlock = `      <section class="market-section" id="equity-macro">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Macro & sector influence', 'التأثير الكلي والقطاعي'))}</span><h2>${esc(t('What shapes this equity', 'ما الذي يُشكّل هذا السهم'))}</h2></div>
        <div class="market-grid">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Macro regime', 'النظام الكلي'))}</span><h3>${esc(macroReg)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Sector', 'القطاع'))}</span><h3><a href="${ar ? '/ar/sectors/' : '/sectors/'}${esc(eq.sector)}/">${esc(sector ? (ar ? sector.name_ar : sector.name_en) : eq.sector)}</a> · ${esc(secState)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Macro sensitivity', 'الحساسية الكلية'))}</span><h3>${esc(ar ? eq.macro_sensitivity_ar : eq.macro_sensitivity_en)}</h3></article>
        </div>
      </section>`;

  // Historical context — observed trend through time.
  const eh = ctx.history && Array.isArray(ctx.history.items) ? ctx.history.items.find((x) => x.symbol === eq.symbol) : null;
  let historyBlock = '';
  if (eh && eh.available) {
    const dt = eh.dimension_trends || {};
    const hcards = [
      [t('Overall', 'الإجمالي'), ar ? eh.overall.label_ar : eh.overall.label_en],
      [t('Structure', 'البنية'), dt.structure ? (ar ? dt.structure.label_ar : dt.structure.label_en) : t('indeterminate', 'غير محدد')],
      [t('Participation', 'المشاركة'), dt.participation ? (ar ? dt.participation.label_ar : dt.participation.label_en) : t('indeterminate', 'غير محدد')],
      [t('Score', 'الدرجة'), dt.score ? (ar ? dt.score.label_ar : dt.score.label_en) : t('indeterminate', 'غير محدد')],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    historyBlock = `      <section class="market-section" id="equity-history-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Historical context', 'السياق التاريخي'))}</span><h2>${esc(t('How this equity is changing through time', 'كيف يتغيّر هذا السهم عبر الزمن'))}</h2></div>
        <p class="market-copy">${esc(t('Observed trends derived from this equity’s own price history (vs ~1 month ago). Context, not a forecast.', 'اتجاهات مرصودة مستمدة من تاريخ سعر هذا السهم (مقابل نحو شهر مضى). سياق، وليس توقعاً.'))}</p>
        <div class="market-grid">
${hcards}
        </div>
      </section>`;
  }

  // How this fits the market narrative.
  const nar = ctx.narrative;
  let narrativeBlock = '';
  if (nar && nar.available) {
    const ncards = [
      [t('Market story', 'سردية السوق'), ar ? nar.dominant_story.label_ar : nar.dominant_story.label_en],
      [t('Single-name driver', 'محرّك الأسهم'), ar ? nar.drivers.equity_driver.label_ar : nar.drivers.equity_driver.label_en],
      [t('Macro driver', 'المحرّك الكلي'), ar ? nar.drivers.macro_driver.label_ar : nar.drivers.macro_driver.label_en],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    narrativeBlock = `      <section class="market-section" id="equity-narrative-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market narrative', 'سردية السوق'))}</span><h2>${esc(t('How this fits the market narrative', 'كيف يندرج هذا ضمن سردية السوق'))}</h2></div>
        <p class="market-copy">${esc(t('This equity sits inside the integrated macro → sector → equity story — see the', 'يقع هذا السهم ضمن قصة الكلي ← القطاع ← السهم المتكاملة — انظر'))} <a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('market terminal', 'الطرفية المؤسسية'))}</a>. ${esc(t('Context, not a forecast.', 'سياق، وليس توقعاً.'))}</p>
        <div class="market-grid three">
${ncards}
        </div>
      </section>`;
  }

  const relAssets = `<a href="${ar ? '/ar/markets/' : '/markets/'}${eq.related_asset.toLowerCase()}/">${esc(eq.related_asset)}</a>`;
  const relEquities = (eq.related_equities || []).map((s) => `<a href="${ar ? '/ar/equities/' : '/equities/'}${s.toLowerCase()}/">${esc(s)}</a>`).join(' · ') || esc(t('none', 'لا يوجد'));
  const linksBlock = `      <section class="market-section" id="equity-relations">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Related intelligence', 'استخبارات ذات صلة'))}</span><h2>${esc(t('Across the desk', 'عبر المكتب'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Related asset', 'الأصل المرتبط'))}</span><h3>${relAssets}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Related equities', 'أسهم مرتبطة'))}</span><h3>${relEquities}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Terminal', 'الطرفية'))}</span><h3><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market terminal', 'الطرفية المؤسسية'))}</a></h3></article>
        </div>
      </section>`;

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(eq.symbol)}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Equity Intelligence', 'استخبارات السهم المؤسسية'))}</span>
          <h1>${esc(ar ? eq.name_ar : eq.name_en)} (${esc(eq.symbol)})</h1>
          <p class="market-lead">${esc(t(`An institutional read of ${eq.name_en} within the macro → sector → equity chain — its observed structure, tactical and liquidity state, the macro and sector forces shaping it, and how it relates to its peers. A deterministic composition of verified signals. Educational context, not technical trading analysis, signals or investment advice.`, `قراءة مؤسسية لسهم ${eq.name_ar} ضمن سلسلة الكلي ← القطاع ← السهم — بنيته المرصودة وحالته التكتيكية والسيولة، والقوى الكلية والقطاعية التي تُشكّله، وعلاقته بنظرائه. تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس تحليل تداول فنياً أو إشارات أو نصيحة استثمارية.`))}</p>
        </div>
      </section>

${scoreBlock}
${rankingPositionBlock(ar, eq, rankings, rankingHistory)}
${regimeFitBlock(ar, eq, marketRegime)}
${chartBlock}
${contextBlock}
${macroBlock}
${historyBlock}
${narrativeBlock}
${recentChangesBlock(ar, 'equity', eq.symbol)}
${relatedResearchBlock(ar, 'equity', eq.symbol)}
${linksBlock}

      <section class="market-section" id="equity-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t(`TradeAlphaAI equity intelligence presents institutional interpretation of observed conditions for ${eq.name_en} (${eq.symbol}) only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.`, `تقدم استخبارات الأسهم في TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة لسهم ${eq.name_ar} (${eq.symbol}) فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.`))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar, eq, ctx) {
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
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/equities/${eq.slug}/$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/equities/${eq.slug}/$2`);
  const footer = template.slice(mainEndIdx);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, eq)}
${bodyTag}${headerBlock}

${buildMain(ar, eq, ctx)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  const manifest = readJson(EQUITY_CHARTS, {});
  const chartBySymbol = new Map(((manifest && manifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const ctxBase = {
    structure: readJson(J('equity-structure.json')), tactical: readJson(J('equity-tactical.json')),
    liquidity: readJson(J('equity-liquidity.json')), participation: readJson(J('equity-participation.json')),
    intelligence: readJson(J('equity-intelligence.json')), macro: readJson(J('macro-regime.json')), sectorStructure: readJson(J('sector-structure.json')),
    history: readJson(J('equity-history.json')), narrative: readJson(J('market-narrative.json')),
    rankings: readJson(EQUITY_RANKINGS), rankingHistory: readJson(RANKING_HISTORY),
    marketRegime: readJson(MARKET_REGIME_DASHBOARD),
  };
  let count = 0;
  for (const eq of EQUITIES) {
    const ctx = { ...ctxBase, chart: chartBySymbol.get(eq.symbol) || null };
    for (const [ar, dir] of [[false, `equities/${eq.slug}`], [true, `ar/equities/${eq.slug}`]]) {
      const html = generate(ar, eq, ctx);
      if (write) { const outPath = path.join(ROOT, dir, 'index.html'); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, html, 'utf8'); count += 1; }
    }
  }
  console.log(write ? `[equity-pages] wrote ${count} pages (${EQUITIES.length} equities × EN/AR)` : `[equity-pages] dry-run ${EQUITIES.length} equities`);
}

if (require.main === module) main();

module.exports = { generate };
