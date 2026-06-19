'use strict';

// Phase 205 / Workstream F — per-sector intelligence pages.
// /sectors/<slug>/ + /ar/sectors/<slug>/ for every registry sector. Composes the
// sector structure/tactical/liquidity/participation states, rotation context,
// macro sensitivity, related assets, the real sector chart (or honest awaiting
// state), and related research. Deterministic, bilingual, RTL. No advice. Clones
// the validator-green market-outlook header/footer (no nav re-bake).
//
// Usage: node tools/generate-sector-pages.js [--write]

const fs = require('fs');
const path = require('path');
const { SECTORS } = require('./sector-registry');

const ROOT = path.resolve(__dirname, '..');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const SECTOR_CHARTS = path.join(ROOT, 'data', 'visual', 'sector-charts.json');
const SECTOR_RANKINGS = J('sector-rankings.json');
const RANKING_HISTORY = J('ranking-history.json');

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function buildHead(ar, sector) {
  const base = ar ? `https://www.tradealphaai.com/ar/sectors/${sector.slug}/` : `https://www.tradealphaai.com/sectors/${sector.slug}/`;
  const title = ar
    ? `قطاع ${sector.name_ar} — استخبارات القطاع المؤسسية | TradeAlphaAI`
    : `${sector.name_en} Sector — Institutional Sector Intelligence | TradeAlphaAI`;
  const desc = ar
    ? `قراءة مؤسسية لقطاع ${sector.name_ar}: ${sector.role_ar}. البنية والتكتيك والسيولة والمشاركة وسياق التدوير والحساسية الكلية وتوافر المخطط المرصود. سياق تعليمي وليس نصيحة استثمارية.`
    : `Institutional read of the ${sector.name_en} sector: ${sector.role_en}. Structure, tactical, liquidity and participation states, rotation context, macro sensitivity and observed-chart availability. Educational context, not investment advice.`;
  const css = ar
    ? ['/css/global-header.css', '../../../styles.css', '../../../landing.css', '../../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css']
    : ['/css/global-header.css', '../../styles.css', '../../landing.css', '../../css/market/market-portal.css', '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url: base, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'الطرفية المؤسسية' : 'Market Terminal', item: ar ? 'https://www.tradealphaai.com/ar/market-terminal/' : 'https://www.tradealphaai.com/market-terminal/' },
      { '@type': 'ListItem', position: 3, name: sector.name_en, item: base },
    ] } ] };
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${base}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/sectors/${sector.slug}/" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/sectors/${sector.slug}/" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/sectors/${sector.slug}/" />
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
  return `<figure class="institutional-chart" data-symbol="${esc(chart.symbol)}" data-chart-type="${esc(chart.chart_type || chart.visual_type)}" data-series-hash="${esc(chart.series_hash)}" data-as-of="${esc(chart.as_of)}" data-relevance-topic="${esc(chart.sector_slug || 'sector')}">
  <div class="ic-svg">${svg}</div>
  <figcaption class="ic-caption">
    <span class="ic-hook">${esc(title)}</span>
    <span class="ic-attrib">${esc(`${ar ? 'المصدر' : 'Source'}: ${provider} · ${ar ? 'بتاريخ' : 'As of'} ${chart.as_of}`)}</span>
  </figcaption>
</figure>`;
}

function stateOf(layerArt, symbol, ar) {
  const s = layerArt && Array.isArray(layerArt.sectors) ? layerArt.sectors.find((x) => x.symbol === symbol) : null;
  return s ? (ar ? s.label_ar : s.label_en) : (ar ? 'غير محدد' : 'indeterminate');
}

function rankingPositionBlock(ar, sector, rankings, history) {
  const t = (en, arT) => (ar ? arT : en);
  const item = rankings && Array.isArray(rankings.items) ? rankings.items.find((x) => x.symbol === sector.symbol) : null;
  if (!item) return '';
  const movement = (((history || {}).groups || {}).sector || []).find((x) => x.symbol === sector.symbol);
  const rank = ar ? item.rank_label_ar : item.rank_label_en;
  const direction = ar ? item.direction_ar : item.direction_en;
  const confirmation = ar ? item.confirmation_ar : item.confirmation_en;
  const move = ar ? (movement?.movement_ar || 'لا لقطة سابقة') : (movement?.movement_en || 'no prior snapshot');
  const evidence = (item.evidence || []).slice(0, 3).join(' · ');
  return `      <section class="market-section" id="sector-ranking-position">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Ranking context', 'سياق الترتيب'))}</span><h2>${esc(t('Sector leadership position', 'موضع قيادة القطاع'))}: ${esc(rank)}</h2></div>
        <p class="market-copy">${esc(t('This ranking compares observed sector structure, historical direction and confirmation state across the sector universe. It is relative context only, not a recommendation or forecast.', 'يقارن هذا الترتيب بنية القطاع المرصودة والاتجاه التاريخي وحالة التأكيد عبر عالم القطاعات. وهو سياق نسبي فقط، وليس توصية أو توقعاً.'))}</p>
        <div class="market-grid">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Current position', 'الموضع الحالي'))}</span><h3>${esc(rank)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Historical direction', 'الاتجاه التاريخي'))}</span><h3>${esc(direction)} · ${esc(move)}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Confirmation', 'التأكيد'))}</span><h3>${esc(confirmation)}</h3></article>
        </div>
        <p class="market-copy">${esc(t('Evidence', 'الأدلة'))}: ${esc(evidence || t('awaiting evidence', 'بانتظار الأدلة'))}</p>
      </section>`;
}

function buildMain(ar, sector, ctx) {
  const t = (en, arT) => (ar ? arT : en);
  const { chart, structure, tactical, liquidity, participation, rotation, cognitive, rankings, rankingHistory } = ctx;

  // 1) Intelligence states.
  const cards = [
    [t('Structure', 'البنية'), stateOf(structure, sector.symbol, ar)],
    [t('Tactical', 'التكتيك'), stateOf(tactical, sector.symbol, ar)],
    [t('Liquidity', 'السيولة'), stateOf(liquidity, sector.symbol, ar)],
    [t('Participation', 'المشاركة'), stateOf(participation, sector.symbol, ar)],
  ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
  const intelBlock = `      <section class="market-section" id="sector-intelligence">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Sector intelligence', 'استخبارات القطاع'))}</span><h2>${esc(t('Institutional read', 'القراءة المؤسسية'))}</h2></div>
        <p class="market-copy">${esc(t('Each state is derived independently from this sector’s own observed price structure — context, not a recommendation.', 'كل حالة مشتقة باستقلال من البنية السعرية المرصودة لهذا القطاع — سياق، وليست توصية.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;

  // 2) Chart or honest unavailable.
  const fig = chartFigure(chart, ar);
  const chartBlock = `      <section class="market-section" id="sector-chart">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Observed price structure', 'البنية السعرية المرصودة'))}</span><h2>${esc(t('Sector chart', 'مخطط القطاع'))}</h2></div>
        ${fig ? `<div class="market-panel">${fig}</div>` : `<div class="market-panel"><p class="market-copy">${esc(t('Awaiting approved provider data — no verified OHLCV chart is available for this sector yet. No placeholder chart is shown.', 'بانتظار بيانات مزوّد معتمدة — لا يتوفر مخطط OHLCV موثّق لهذا القطاع بعد. ولا يُعرض أي مخطط بديل.'))}</p></div>`}
      </section>`;

  // 3) Rotation context.
  const rotState = rotation && rotation.available ? (ar ? rotation.rotation_state_ar : rotation.rotation_state_en) : t('indeterminate', 'غير محدد');
  const myRow = rotation && Array.isArray(rotation.sectors) ? rotation.sectors.find((s) => s.symbol === sector.symbol) : null;
  const rs = myRow && myRow.relative_strength !== null && myRow.relative_strength !== undefined ? myRow.relative_strength : null;
  const isLeader = rotation && (rotation.leadership_sectors || []).some((s) => s.symbol === sector.symbol);
  const isWeak = rotation && (rotation.weakening_sectors || []).some((s) => s.symbol === sector.symbol);
  const tilt = isLeader ? t('currently leading the broad market', 'يقود السوق العريض حالياً') : isWeak ? t('currently lagging the broad market', 'يتخلّف عن السوق العريض حالياً') : t('roughly in line with the broad market', 'متوافق تقريباً مع السوق العريض');
  const rotationBlock = `      <section class="market-section" id="sector-rotation">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Rotation context', 'سياق التدوير'))}</span><h2>${esc(t('Where this sector sits in the rotation', 'موضع هذا القطاع في التدوير'))}</h2></div>
        <p class="market-copy">${esc(t('Market rotation reads', 'يقرأ تدوير السوق'))} ${esc(rotState)}. ${esc(sector.name_en === sector.name_en ? '' : '')}${esc(t(`${sector.name_en} is ${tilt}`, `${sector.name_ar} ${tilt}`))}${rs !== null ? ` (${t('relative strength', 'القوة النسبية')} ${esc(rs)}).` : '.'}</p>
      </section>`;

  // 4) Macro sensitivity + related assets.
  const related = (sector.related_assets || []).map((sym) => `<a href="${ar ? '/ar/markets/' : '/markets/'}${sym.toLowerCase()}/">${esc(sym)}</a>`).join(' · ');
  const macroBlock = `      <section class="market-section" id="sector-macro">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Macro sensitivity', 'الحساسية الكلية'))}</span><h2>${esc(t('What moves this sector', 'ما الذي يحرّك هذا القطاع'))}</h2></div>
        <p class="market-copy">${esc(t(`Macro sensitivity: ${sector.macro_sensitivity_en}. This sector is read against`, `الحساسية الكلية: ${sector.macro_sensitivity_ar}. يُقرأ هذا القطاع مقابل`))} ${related || esc(t('the broad market', 'السوق العريض'))}.</p>
      </section>`;

  // 4b) Historical context — observed trend through time.
  const sh = ctx.history && Array.isArray(ctx.history.items) ? ctx.history.items.find((x) => x.symbol === sector.symbol) : null;
  let historyBlock = '';
  if (sh && sh.available) {
    const dt = sh.dimension_trends || {};
    const cards = [
      [t('Overall', 'الإجمالي'), ar ? sh.overall.label_ar : sh.overall.label_en],
      [t('Structure', 'البنية'), dt.structure ? (ar ? dt.structure.label_ar : dt.structure.label_en) : t('indeterminate', 'غير محدد')],
      [t('Participation', 'المشاركة'), dt.participation ? (ar ? dt.participation.label_ar : dt.participation.label_en) : t('indeterminate', 'غير محدد')],
      [t('Score', 'الدرجة'), dt.score ? (ar ? dt.score.label_ar : dt.score.label_en) : t('indeterminate', 'غير محدد')],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    historyBlock = `      <section class="market-section" id="sector-history-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Historical context', 'السياق التاريخي'))}</span><h2>${esc(t('How this sector is changing through time', 'كيف يتغيّر هذا القطاع عبر الزمن'))}</h2></div>
        <p class="market-copy">${esc(t('Observed trends derived from this sector’s own price history (vs ~1 month ago). Context, not a forecast.', 'اتجاهات مرصودة مستمدة من تاريخ سعر هذا القطاع (مقابل نحو شهر مضى). سياق، وليس توقعاً.'))}</p>
        <div class="market-grid">
${cards}
        </div>
      </section>`;
  }

  // 4c) How this fits the market narrative.
  const nar = ctx.narrative;
  let narrativeBlock = '';
  if (nar && nar.available) {
    const cards = [
      [t('Market story', 'سردية السوق'), ar ? nar.dominant_story.label_ar : nar.dominant_story.label_en],
      [t('Sector driver', 'محرّك القطاعات'), ar ? nar.drivers.sector_driver.label_ar : nar.drivers.sector_driver.label_en],
      [t('Macro driver', 'المحرّك الكلي'), ar ? nar.drivers.macro_driver.label_ar : nar.drivers.macro_driver.label_en],
    ].map(([k, v]) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(v)}</h3></article>`).join('\n');
    narrativeBlock = `      <section class="market-section" id="sector-narrative-context">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Market narrative', 'سردية السوق'))}</span><h2>${esc(t('How this fits the market narrative', 'كيف يندرج هذا ضمن سردية السوق'))}</h2></div>
        <p class="market-copy">${esc(t('This sector sits inside the integrated market story — see the', 'يقع هذا القطاع ضمن قصة السوق المتكاملة — انظر'))} <a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('market terminal', 'الطرفية المؤسسية'))}</a>. ${esc(t('Context, not a forecast.', 'سياق، وليس توقعاً.'))}</p>
        <div class="market-grid three">
${cards}
        </div>
      </section>`;
  }

  // 5) Related links.
  const linksBlock = `      <section class="market-section" id="sector-links">
        <div class="market-section-head"><span class="eyebrow">${esc(t('Across the desk', 'عبر المكتب'))}</span><h2>${esc(t('Related institutional intelligence', 'استخبارات مؤسسية ذات صلة'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Terminal', 'الطرفية'))}</span><h3><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Institutional market terminal', 'الطرفية المؤسسية للسوق'))}</a></h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Structure', 'البنية'))}</span><h3><a href="${ar ? '/ar/market-structure/' : '/market-structure/'}">${esc(t('Market structure desk', 'مكتب بنية السوق'))}</a></h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Research', 'الأبحاث'))}</span><h3><a href="${ar ? '/ar/market-news/' : '/market-news/'}">${esc(t('Latest research & news', 'أحدث الأبحاث والأخبار'))}</a></h3></article>
        </div>
      </section>`;

  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(ar ? sector.name_ar : sector.name_en)}</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t('Institutional Sector Intelligence', 'استخبارات القطاع المؤسسية'))}</span>
          <h1>${esc(ar ? sector.name_ar : sector.name_en)} — ${esc(ar ? sector.role_ar : sector.role_en)}</h1>
          <p class="market-lead">${esc(t(`This is an institutional read of the ${sector.name_en} sector within the wider market — its observed structure, tactical and liquidity state, where it sits in the sector rotation, and what macro forces move it. A deterministic composition of verified signals. Educational context, not technical trading analysis, signals or investment advice.`, `هذه قراءة مؤسسية لقطاع ${sector.name_ar} ضمن السوق الأوسع — بنيته المرصودة وحالته التكتيكية والسيولة، وموضعه في تدوير القطاعات، والقوى الكلية التي تحرّكه. تركيب حتمي لإشارات موثّقة. سياق تعليمي وليس تحليل تداول فنياً أو إشارات أو نصيحة استثمارية.`))}</p>
        </div>
      </section>

${intelBlock}
${rankingPositionBlock(ar, sector, rankings, rankingHistory)}
${chartBlock}
${rotationBlock}
${macroBlock}
${historyBlock}
${narrativeBlock}
${linksBlock}

      <section class="market-section" id="sector-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t(`TradeAlphaAI sector intelligence presents institutional interpretation of observed conditions for the ${sector.name_en} sector only. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.`, `تقدم استخبارات القطاع في TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة لقطاع ${sector.name_ar} فقط، وليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.`))}</p></div>
      </section>
    </div>
  </main>`;
}

function generate(ar, sector, ctx) {
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
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/sectors/${sector.slug}/$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/sectors/${sector.slug}/$2`);
  const footer = template.slice(mainEndIdx);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, sector)}
${bodyTag}${headerBlock}

${buildMain(ar, sector, ctx)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  const manifest = readJson(SECTOR_CHARTS, {});
  const chartBySymbol = new Map(((manifest && manifest.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const structure = readJson(J('sector-structure.json'));
  const tactical = readJson(J('sector-tactical.json'));
  const liquidity = readJson(J('sector-liquidity.json'));
  const participation = readJson(J('sector-participation.json'));
  const rotation = readJson(J('sector-rotation.json'));
  const cognitive = readJson(J('sector-cognitive-network.json'));
  const history = readJson(J('sector-history.json'));
  const narrative = readJson(J('market-narrative.json'));
  const rankings = readJson(SECTOR_RANKINGS);
  const rankingHistory = readJson(RANKING_HISTORY);
  let count = 0;
  for (const sector of SECTORS) {
    const ctx = { chart: chartBySymbol.get(sector.symbol) || null, structure, tactical, liquidity, participation, rotation, cognitive, history, narrative, rankings, rankingHistory };
    for (const [ar, dir] of [[false, `sectors/${sector.slug}`], [true, `ar/sectors/${sector.slug}`]]) {
      const html = generate(ar, sector, ctx);
      if (write) { const outPath = path.join(ROOT, dir, 'index.html'); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, html, 'utf8'); count += 1; }
    }
  }
  console.log(write ? `[sector-pages] wrote ${count} pages (${SECTORS.length} sectors × EN/AR)` : `[sector-pages] dry-run ${SECTORS.length} sectors`);
}

if (require.main === module) main();

module.exports = { generate };
