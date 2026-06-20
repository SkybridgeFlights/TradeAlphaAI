'use strict';

// Phase 214 CP5 - ETF research network pages.
// Generates /research/etfs/ and /research/etfs/<slug>/ (+ Arabic) from the
// ETF registry, intelligence, rankings and history artifacts.

const fs = require('fs');
const path = require('path');
const { ETFS, BY_SYMBOL } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);

function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(rel), 'utf8')); } catch { return fallback; }
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function bySymbol(list) {
  return new Map((list || []).map((entry) => [entry.symbol, entry]));
}

function templateHeader(ar, slugPath) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const header = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="research"')
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${slugPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${slugPath}$2`);
  const footer = template.slice(mainEndIdx);
  return { bodyTag, header, footer };
}

function head(ar, slugPath, titleEn, titleAr, descEn, descAr) {
  const depth = (ar ? 1 : 0) + slugPath.split('/').filter(Boolean).length;
  const rel = '../'.repeat(depth);
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const title = `${ar ? titleAr : titleEn} | TradeAlphaAI`;
  const desc = ar ? descAr : descEn;
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
  <link rel="stylesheet" href="${rel}styles.css" />
  <link rel="stylesheet" href="${rel}landing.css" />
  <link rel="stylesheet" href="${rel}css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
</head>`;
}

function card(kicker, title, body, href, color) {
  const linked = href ? `<a href="${esc(href)}">${esc(title)}</a>` : esc(title);
  return `          <article class="market-card"${color ? ` style="border-inline-start:4px solid ${esc(color)}"` : ''}><span class="market-card-kicker">${esc(kicker)}</span><h3>${linked}</h3>${body ? `<p class="market-copy">${esc(body)}</p>` : ''}</article>`;
}

const COLOR = {
  strongest: '#1f6f5c', strong: '#2f8f76', constructive: '#5a8f7a', neutral: '#46505f',
  mixed: '#b58b56', weakening: '#b58b56', weak: '#c2703c', weakest: '#b5523f',
  indeterminate: '#3a4250', unavailable: '#3a4250'
};

function labelNode(node, ar) {
  if (!node) return ar ? 'غير محدد' : 'indeterminate';
  return ar ? (node.label_ar || 'غير محدد') : (node.label_en || 'indeterminate');
}

function rankingLabel(rank, ar) {
  if (!rank) return ar ? 'غير محدد' : 'indeterminate';
  return ar ? rank.rank_label_ar : rank.rank_label_en;
}

function detailHref(etf, ar) {
  return `${ar ? '/ar' : ''}/research/etfs/${etf.slug}/`;
}

function indexBody(ar, intelligenceBySymbol, rankingBySymbol) {
  const t = (en, arText) => (ar ? arText : en);
  const cards = ETFS.map((etf) => {
    const intel = intelligenceBySymbol.get(etf.symbol);
    const rank = rankingBySymbol.get(etf.symbol);
    const state = rank && rank.available ? rank.rank_label : (intel && intel.confidence ? intel.confidence.state : 'indeterminate');
    const summary = `${t('State', 'الحالة')}: ${labelNode(intel && intel.structure, ar)} · ${t('Rank', 'الترتيب')}: ${rankingLabel(rank, ar)}`;
    return card(`${etf.symbol} · ${ar ? etf.role_ar : etf.role_en}`, etf.fund_name, summary, detailHref(etf, ar), COLOR[state] || COLOR.indeterminate);
  }).join('\n');
  return `      <section class="market-section" id="etf-research-index"><div class="market-section-head"><span class="eyebrow">${esc(t('ETF Research Network', 'شبكة أبحاث صناديق المؤشرات'))}</span><h2>${esc(t('ETF universe research', 'أبحاث عالم صناديق المؤشرات'))}</h2></div>
        <p class="market-copy">${esc(t('Institutional ETF research composed from the existing regime, ranking, relative-strength, history and narrative artifacts. Direct evidence is used when available; unavailable data remains explicitly indeterminate.', 'أبحاث مؤسسية لصناديق المؤشرات مركبة من مصادر النظام والترتيب والقوة النسبية والتاريخ والسردية القائمة. تستخدم الأدلة المباشرة عند توافرها، وتبقى البيانات غير المتاحة مصنفة بوضوح كغير محددة.'))}</p>
        <div class="market-grid three">
${cards}
        </div></section>`;
}

function chartFigure(ar, etf, intel, chart, audit) {
  const t = (en, arText) => (ar ? arText : en);
  if (!chart || intel.chart_available !== true) {
    const reason = (audit && audit.failure_reason) || (intel.unavailable_reason || 'approved_ohlcv_unavailable');
    return `<figure class="market-chart"><figcaption class="ic-caption">${esc(t('Verified OHLCV chart unavailable (' + reason + '); honestly omitted rather than substituted.', 'رسم OHLCV الموثق غير متاح (' + reason + ')؛ تم حذفه بصدق بدلا من استبداله.'))}</figcaption></figure>`;
  }
  const svgRel = '/data/visual/etf-charts/' + etf.slug + '-etf-' + (ar ? 'ar' : 'en') + '.svg';
  const provider = (chart.attribution && chart.attribution.provider) || (audit && audit.selected_source && audit.selected_source.provider) || 'unknown';
  const asOf = chart.as_of || 'unknown';
  const bars = chart.bar_count || (chart.series || []).length;
  const hashShort = (chart.series_hash || '').slice(0, 12);
  const captionEn = 'Verified OHLCV — ' + bars + ' bars from ' + provider + ', as of ' + asOf + '. series_hash=' + hashShort + '.';
  const captionAr = 'OHLCV موثق — ' + bars + ' شمعة من ' + provider + '، بتاريخ ' + asOf + '. series_hash=' + hashShort + '.';
  return `<figure class="market-chart"><img src="${esc(svgRel)}" alt="${esc(etf.symbol)} ${esc(t('verified OHLCV', 'OHLCV موثق'))}" loading="lazy" /><figcaption class="ic-caption">${esc(ar ? captionAr : captionEn)}</figcaption></figure>`;
}

function qBadge(label, valueEn, valueAr, ar) {
  return `<div class="market-grid-card"><span class="eyebrow">${esc(label)}</span><strong>${esc(ar ? valueAr : valueEn)}</strong></div>`;
}

function detailBody(ar, etf, intelligenceBySymbol, rankingBySymbol, history, chartsBySymbol, auditBySymbol, qualityBySymbol) {
  const t = (en, arText) => (ar ? arText : en);
  const intel = intelligenceBySymbol.get(etf.symbol) || {};
  const rank = rankingBySymbol.get(etf.symbol) || {};
  const historyState = (history.entities && history.entities[etf.symbol]) || null;
  const chart = chartsBySymbol.get(etf.symbol) || null;
  const audit = auditBySymbol.get(etf.symbol) || null;
  const quality = qualityBySymbol.get(etf.symbol) || null;
  const related = (etf.related || []).map((symbol) => {
    const rel = BY_SYMBOL.get(symbol);
    return rel ? `<a href="${detailHref(rel, ar)}">${esc(symbol)}</a>` : `<span>${esc(symbol)}</span>`;
  }).join(' · ');
  const externalResearch = (etf.research_links || []).map((href) => `<a href="${esc((ar ? '/ar' : '') + href)}">${esc(href.replace(/^\/insights\//, '').replace(/\/$/, ''))}</a>`).join(' · ');
  const evidence = (intel.evidence || []).concat(rank.evidence || []).slice(0, 8).map((entry) => `<li>${esc(entry)}</li>`).join('');
  const chartNote = intel.chart_available
    ? t('A verified OHLCV chart is available for this ETF in the chart manifest.', 'يتوافر لهذا الصندوق رسم OHLCV موثق ضمن سجل الرسوم.')
    : t('Verified ETF OHLCV chart coverage is not available in the current local manifest, so no chart is rendered here.', 'لا تتوافر تغطية رسم OHLCV موثقة لهذا الصندوق ضمن السجل المحلي الحالي، لذلك لا يتم عرض رسم هنا.');
  const auditText = quality ? t('Audit: ' + quality.bars + ' bars from ' + (quality.resolved_provider || 'no provider') + ' as of ' + (quality.as_of || 'no chart') + '. Observed coverage transparency, not a trading recommendation.', 'التدقيق: ' + quality.bars + ' شمعة من ' + (quality.resolved_provider || 'لا يوجد مزود') + ' بتاريخ ' + (quality.as_of || 'لا يوجد رسم') + '. شفافية تغطية مرصودة، وليست توصية تداول.') : '';
  const dataQualitySection = quality ? `      <section class="market-section" id="etf-data-quality"><div class="market-section-head"><span class="eyebrow">${esc(t('Data quality and provider status', 'جودة البيانات وحالة المزود'))}</span><h2>${esc(t('Verified coverage transparency', 'شفافية التغطية الموثقة'))}</h2></div>
        ${chartFigure(ar, etf, intel, chart, audit)}
        <div class="market-grid three">
${qBadge(t('Quality tier', 'مستوى الجودة'), quality.quality_tier_en, quality.quality_tier_ar, ar)}
${qBadge(t('Chart availability', 'توفر الرسم'), quality.chart_quality_en, quality.chart_quality_ar, ar)}
${qBadge(t('Coverage', 'التغطية'), quality.coverage_en, quality.coverage_ar, ar)}
${qBadge(t('Provider confidence', 'ثقة المزود'), quality.provider_confidence_en, quality.provider_confidence_ar, ar)}
${qBadge(t('Historical depth', 'العمق التاريخي'), quality.historical_depth_en, quality.historical_depth_ar, ar)}
${qBadge(t('Selected provider', 'المزود المختار'), quality.resolved_provider || t('unavailable', 'غير متاح'), quality.resolved_provider || 'غير متاح', ar)}
        </div>
        <p class="market-copy">${esc(auditText)}</p></section>` : '';
  return `${dataQualitySection}
      <section class="market-section" id="etf-current-state"><div class="market-section-head"><span class="eyebrow">${esc(etf.symbol)}</span><h2>${esc(t('Current ETF state', 'الحالة الحالية للصندوق'))}</h2></div>
        <p class="market-copy">${esc(ar ? etf.role_ar : etf.role_en)} ${esc(t('This page composes existing intelligence only; it does not create a separate ETF signal model.', 'تجمع هذه الصفحة مصادر الاستخبارات القائمة فقط؛ ولا تنشئ نموذج إشارات منفصلا لصناديق المؤشرات.'))}</p>
        <div class="market-grid three">
${card(t('Structure', 'البنية'), labelNode(intel.structure, ar), chartNote, null, COLOR[intel.structure && intel.structure.state] || COLOR.indeterminate)}
${card(t('Tactical context', 'السياق التكتيكي'), labelNode(intel.tactical, ar), t('Derived from regime alignment and existing ETF metadata.', 'مشتق من مواءمة النظام وبيانات الصندوق القائمة.'), null, COLOR[intel.tactical && intel.tactical.state] || COLOR.indeterminate)}
${card(t('Liquidity', 'السيولة'), labelNode(intel.liquidity, ar), t('Uses existing ETF flow profile when available.', 'يعتمد على ملف تدفقات الصندوق القائم عند توافره.'), null, COLOR[intel.liquidity && intel.liquidity.state] || COLOR.indeterminate)}
        </div></section>
      <section class="market-section" id="etf-regime-alignment"><div class="market-section-head"><span class="eyebrow">${esc(t('Regime alignment', 'مواءمة النظام'))}</span><h2>${esc(t('How this fits the current regime', 'كيف يندرج ضمن النظام الحالي'))}</h2></div><div class="market-grid three">
${card(t('Regime alignment', 'مواءمة النظام'), labelNode(intel.regime_alignment, ar), t('Composed from the Market Regime Command Center.', 'مركبة من مركز قيادة نظام السوق.'), ar ? '/ar/market-regime/' : '/market-regime/', COLOR[intel.regime_alignment && intel.regime_alignment.state] || COLOR.indeterminate)}
${card(t('Narrative alignment', 'المواءمة السردية'), labelNode(intel.narrative_alignment, ar), t('Uses the active market narrative when available.', 'تستخدم سردية السوق النشطة عند توافرها.'), ar ? '/ar/market-terminal/' : '/market-terminal/', COLOR.indeterminate)}
${card(t('Participation', 'المشاركة'), labelNode(intel.participation, ar), t('Contextual classification by ETF exposure type.', 'تصنيف سياقي حسب نوع تعرض الصندوق.'), null, COLOR[intel.participation && intel.participation.state] || COLOR.indeterminate)}
        </div></section>
      <section class="market-section" id="etf-ranking-position"><div class="market-section-head"><span class="eyebrow">${esc(t('Ranking position', 'موقع الترتيب'))}</span><h2>${esc(t('Relative position within the ETF universe', 'الموقع النسبي داخل عالم صناديق المؤشرات'))}</h2></div><div class="market-grid three">
${card(t('Rank label', 'تصنيف الترتيب'), rankingLabel(rank, ar), t('Direct ranking coverage only; no proxy substitution.', 'تغطية ترتيب مباشرة فقط؛ دون استبدال بمؤشر بديل.'), ar ? '/ar/rankings/' : '/rankings/', COLOR[rank.rank_label] || COLOR.indeterminate)}
${card(t('Historical direction', 'الاتجاه التاريخي'), ar ? (rank.direction_ar || 'غير محدد') : (rank.direction_en || 'indeterminate'), t('Uses ranking history only where the symbol exists directly.', 'يستخدم تاريخ الترتيب فقط عندما يظهر الرمز مباشرة.'), null, COLOR.indeterminate)}
${card(t('Confirmation', 'التأكيد'), ar ? (rank.confirmation_ar || 'غير محدد') : (rank.confirmation_en || 'indeterminate'), t('Confirmation state is inherited from existing ranking or regime context.', 'حالة التأكيد موروثة من الترتيب القائم أو سياق النظام.'), ar ? '/ar/market-map/network/' : '/market-map/network/', COLOR[rank.confirmation] || COLOR.indeterminate)}
        </div></section>
      <section class="market-section" id="etf-history"><div class="market-section-head"><span class="eyebrow">${esc(t('Historical context', 'السياق التاريخي'))}</span><h2>${esc(t('Change memory', 'ذاكرة التغير'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(historyState ? (ar ? historyState.summary_ar : historyState.summary_en) : t('ETF-specific history has not accumulated enough verified snapshots yet, so the page reports no prior state rather than inventing a path.', 'لم يتراكم بعد تاريخ خاص بالصندوق عبر لقطات موثقة كافية، لذلك تعرض الصفحة عدم وجود حالة سابقة بدلا من اختلاق مسار.'))}</p></div></section>
      <section class="market-section" id="etf-related-research"><div class="market-section-head"><span class="eyebrow">${esc(t('Related research', 'أبحاث ذات صلة'))}</span><h2>${esc(t('Research relationships', 'علاقات البحث'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Related ETFs', 'صناديق ذات صلة'))}: ${related || esc(t('none observed', 'لا يوجد مرصود'))}</p><p class="market-copy">${esc(t('Applied research links', 'روابط أبحاث تطبيقية'))}: ${externalResearch}</p></div>
        <div class="market-panel"><p class="market-copy">${esc(t('Evidence', 'الأدلة'))}:</p><ul class="market-copy">${evidence}</ul></div></section>`;
}

function page(ar, slugPath, titleEn, titleAr, descEn, descAr, body) {
  const parts = templateHeader(ar, slugPath);
  const t = (en, arText) => (ar ? arText : en);
  const crumb = `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/research/' : '/research/'}">${esc(t('Research Hub', 'مركز الأبحاث'))}</a><span>/</span><span>${esc(ar ? titleAr : titleEn)}</span></nav>`;
  const main = `  <main class="market-shell">
    <div class="wrap">
      ${crumb}
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('ETF Intelligence Universe', 'عالم استخبارات صناديق المؤشرات'))}</span><h1>${esc(ar ? titleAr : titleEn)}</h1><p class="market-lead">${esc(ar ? descAr : descEn)}</p></div></section>
${body}
      <section class="market-section" id="etf-research-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI ETF research describes observed institutional context only. It is not a trading signal, execution instruction or investment advice.', 'تصف أبحاث صناديق المؤشرات في TradeAlphaAI السياق المؤسسي المرصود فقط. وهي ليست إشارة تداول أو تعليمات تنفيذ أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head(ar, slugPath, titleEn, titleAr, descEn, descAr)}
${parts.bodyTag}${parts.header}

${main}
${parts.footer}`;
}

function buildPages() {
  const intelligence = readJson('etf-intelligence.json', {});
  const rankings = readJson('etf-rankings.json', {});
  const history = readJson('etf-history.json', {});
  const charts = readJson('etf-charts.json', {});
  const audit = readJson('etf-provider-audit.json', {});
  const quality = readJson('etf-data-quality.json', {});
  const intelligenceBySymbol = bySymbol(intelligence.etfs);
  const rankingBySymbol = bySymbol(rankings.items);
  const chartsBySymbol = new Map(((charts.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const auditBySymbol = new Map(((audit.etfs) || []).map((e) => [e.symbol, e]));
  const qualityBySymbol = new Map(((quality.etfs) || []).map((e) => [e.symbol, e]));
  const pages = [];
  for (const ar of [false, true]) {
    const slugPath = 'research/etfs/';
    const descEn = 'Institutional ETF research network composed from regime, ranking, relative-strength, history and narrative intelligence.';
    const descAr = 'شبكة أبحاث مؤسسية لصناديق المؤشرات مركبة من استخبارات النظام والترتيب والقوة النسبية والتاريخ والسردية.';
    pages.push({
      out: path.join(ROOT, ar ? 'ar/research/etfs/index.html' : 'research/etfs/index.html'),
      html: page(ar, slugPath, 'ETF Research', 'أبحاث صناديق المؤشرات', descEn, descAr, indexBody(ar, intelligenceBySymbol, rankingBySymbol))
    });
  }
  for (const etf of ETFS) {
    for (const ar of [false, true]) {
      const slugPath = `research/etfs/${etf.slug}/`;
      const descEn = `Institutional ETF research read for ${etf.symbol}: regime alignment, ranking position, history, liquidity and related research.`;
      const descAr = `قراءة بحثية مؤسسية لصندوق ${etf.symbol}: مواءمة النظام، موقع الترتيب، التاريخ، السيولة والأبحاث ذات الصلة.`;
      pages.push({
        out: path.join(ROOT, ar ? `ar/research/etfs/${etf.slug}/index.html` : `research/etfs/${etf.slug}/index.html`),
        html: page(ar, slugPath, `${etf.symbol} ETF Research`, `أبحاث ${etf.symbol}`, descEn, descAr, detailBody(ar, etf, intelligenceBySymbol, rankingBySymbol, history, chartsBySymbol, auditBySymbol, qualityBySymbol))
      });
    }
  }
  return pages;
}

function main() {
  const pages = buildPages();
  if (WRITE) {
    for (const p of pages) {
      fs.mkdirSync(path.dirname(p.out), { recursive: true });
      fs.writeFileSync(p.out, p.html, 'utf8');
    }
  }
  console.log(`[etf-research-pages] ${WRITE ? 'wrote' : 'dry-run'} ${pages.length} pages`);
}

if (require.main === module) main();

module.exports = { buildPages };
