'use strict';

// Phase 209 / CP5 — institutional ranking discovery pages.
// Builds /rankings/ plus asset/sector/equity child surfaces in EN/AR from the
// verified ranking, relative-strength and ranking-history artifacts. The legacy
// /rankings.html page remains untouched.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');
const { ASSETS, BY_SYMBOL: ASSET_BY_SYMBOL } = require('./asset-registry');
const { SECTORS, BY_SYMBOL: SECTOR_BY_SYMBOL } = require('./sector-registry');
const { EQUITIES, BY_SYMBOL: EQUITY_BY_SYMBOL } = require('./equity-registry');

const ROOT = path.resolve(__dirname, '..');
const J = (name) => path.join(ROOT, 'data', 'intelligence', name);
const WRITE = process.argv.includes('--write');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function t(ar, en, arText) { return ar ? arText : en; }

function pageRoute(kind, ar) {
  const base = ar ? '/ar/rankings/' : '/rankings/';
  return kind === 'overview' ? base : `${base}${kind}/`;
}

function labelFor(type, item, ar) {
  if (type === 'asset') {
    const asset = ASSET_BY_SYMBOL.get(item.symbol);
    return asset ? (ar ? asset.role_ar.split(' — ')[0] : asset.role_en.split(' — ')[0]) : item.symbol;
  }
  if (type === 'sector') {
    const sector = SECTOR_BY_SYMBOL.get(item.symbol);
    return sector ? (ar ? sector.name_ar : sector.name_en) : item.symbol;
  }
  const equity = EQUITY_BY_SYMBOL.get(item.symbol);
  return equity ? (ar ? equity.name_ar : equity.name_en) : item.symbol;
}

function detailHref(type, item, ar) {
  const slug = item.slug || String(item.symbol || '').toLowerCase();
  if (type === 'asset') return `${ar ? '/ar' : ''}/markets/${slug}/`;
  if (type === 'sector') return `${ar ? '/ar' : ''}/sectors/${slug}/`;
  return `${ar ? '/ar' : ''}/equities/${slug}/`;
}

function historyFor(history, type, symbol) {
  return ((((history || {}).groups || {})[type]) || []).find((row) => row.symbol === symbol) || null;
}

function evidenceText(item, ar) {
  const evidence = (item.evidence || []).slice(0, 3).join(' · ');
  return evidence || t(ar, 'Awaiting evidence refresh', 'بانتظار تحديث الأدلة');
}

function head(ar, kind) {
  const url = `https://www.tradealphaai.com${pageRoute(kind, ar)}`;
  const title = kind === 'overview'
    ? t(ar, 'Institutional Relative Rankings | TradeAlphaAI', 'الترتيب النسبي المؤسسي | TradeAlphaAI')
    : t(ar, `${titleForKind(kind, false)} | Institutional Rankings | TradeAlphaAI`, `${titleForKind(kind, true)} | الترتيب المؤسسي | TradeAlphaAI`);
  const desc = t(
    ar,
    'Institutional rankings and relative-strength context across assets, sectors and equities. Evidence-backed market structure context, not financial advice.',
    'ترتيب مؤسسي وسياق قوة نسبية عبر الأصول والقطاعات والأسهم. قراءة مدعومة بالأدلة لبنية السوق، وليست نصيحة مالية.'
  );
  const enHref = `https://www.tradealphaai.com${pageRoute(kind, false)}`;
  const arHref = `https://www.tradealphaai.com${pageRoute(kind, true)}`;
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enHref}" />
  <link rel="alternate" hreflang="ar" href="${arHref}" />
  <link rel="alternate" hreflang="x-default" href="${enHref}" />
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
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
</head>`;
}

function titleForKind(kind, ar) {
  return {
    overview: t(ar, 'Relative Rankings', 'الترتيب النسبي'),
    assets: t(ar, 'Asset Rankings', 'ترتيب الأصول'),
    sectors: t(ar, 'Sector Rankings', 'ترتيب القطاعات'),
    equities: t(ar, 'Equity Rankings', 'ترتيب الأسهم')
  }[kind];
}

function groupType(kind) {
  return kind === 'assets' ? 'asset' : kind === 'sectors' ? 'sector' : 'equity';
}

function cardFor(ar, type, item, history) {
  const movement = historyFor(history, type, item.symbol);
  const rank = ar ? item.rank_label_ar : item.rank_label_en;
  const direction = ar ? item.direction_ar : item.direction_en;
  const confirmation = ar ? item.confirmation_ar : item.confirmation_en;
  const move = ar ? (movement?.movement_ar || 'لا لقطة سابقة') : (movement?.movement_en || 'no prior snapshot');
  return `          <article class="market-card ranking-card" data-ranking-item="${esc(type)}:${esc(item.symbol)}">
            <span class="market-card-kicker">${esc(item.symbol)} · ${esc(rank)}</span>
            <h3><a href="${detailHref(type, item, ar)}">${esc(labelFor(type, item, ar))}</a></h3>
            <p>${esc(t(ar, 'Direction', 'الاتجاه'))}: ${esc(direction)} · ${esc(t(ar, 'Movement', 'الحركة'))}: ${esc(move)} · ${esc(t(ar, 'Confirmation', 'التأكيد'))}: ${esc(confirmation)}</p>
            <p>${esc(evidenceText(item, ar))}</p>
          </article>`;
}

function groupSection(ar, type, artifact, history, limit = null) {
  const items = ((artifact || {}).items || []).filter((item) => item.available !== false);
  if (!items.length) {
    return `      <section class="market-section" id="${type}-ranking-table">
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Ranking evidence is currently unavailable for this group.', 'أدلة الترتيب غير متاحة حالياً لهذه المجموعة.'))}</p></div>
      </section>`;
  }
  const rendered = (limit ? items.slice(0, limit) : items).map((item) => cardFor(ar, type, item, history)).join('\n');
  return `      <section class="market-section" id="${type}-ranking-table">
        <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Evidence-backed ranking', 'ترتيب مدعوم بالأدلة'))}</span><h2>${esc(titleForKind(type === 'asset' ? 'assets' : type === 'sector' ? 'sectors' : 'equities', ar))}</h2></div>
        <div class="market-grid three">
${rendered}
        </div>
      </section>`;
}

function relativeStrengthSection(ar, rs) {
  const groups = (rs && rs.groups) || {};
  const rows = Object.entries(groups).flatMap(([type, items]) => (items || []).slice(0, 3).map((item) => ({ type, item })));
  if (!rows.length) return '';
  return `      <section class="market-section" id="ranking-relative-strength">
        <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Relative strength', 'القوة النسبية'))}</span><h2>${esc(t(ar, 'Observed leadership relationships', 'علاقات القيادة المرصودة'))}</h2></div>
        <div class="market-grid three">
${rows.map(({ type, item }) => `          <article class="market-card" data-relative-strength="${esc(type)}:${esc(item.id)}">
            <span class="market-card-kicker">${esc(ar ? item.state_ar : item.state_en)}</span>
            <h3>${esc(ar ? item.label_ar : item.label_en)}</h3>
            <p>${esc((item.evidence || [])[0] || t(ar, 'Evidence awaiting refresh', 'بانتظار تحديث الأدلة'))}</p>
          </article>`).join('\n')}
        </div>
      </section>`;
}

function discoveryLinks(ar) {
  const links = [
    ['assets', titleForKind('assets', ar), t(ar, 'Cross-asset leadership, defensive pressure and macro-sensitive proxies.', 'قيادة عبر الأصول وضغط دفاعي ومؤشرات حساسة للكلّي.')],
    ['sectors', titleForKind('sectors', ar), t(ar, 'Sector leadership position, rotation context and confirmation state.', 'موضع قيادة القطاعات وسياق التدوير وحالة التأكيد.')],
    ['equities', titleForKind('equities', ar), t(ar, 'Single-name relative position inside the market structure.', 'الموضع النسبي للأسهم الفردية داخل بنية السوق.')]
  ];
  return `      <section class="market-section" id="ranking-discovery">
        <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Discovery', 'الاكتشاف'))}</span><h2>${esc(t(ar, 'Ranking surfaces', 'أسطح الترتيب'))}</h2></div>
        <div class="market-grid three">
${links.map(([kind, title, copy]) => `          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Institutional context', 'سياق مؤسسي'))}</span><h3><a href="${pageRoute(kind, ar)}">${esc(title)}</a></h3><p>${esc(copy)}</p></article>`).join('\n')}
        </div>
      </section>`;
}

function body(ar, kind, data) {
  const header = renderGlobalHeader({
    locale: ar ? 'ar' : 'en',
    activePage: 'relative-rankings',
    arabicHref: pageRoute(kind, true),
    englishHref: pageRoute(kind, false)
  });
  const title = titleForKind(kind, ar);
  const lead = t(
    ar,
    'A verified relative-strength layer for comparing assets, sectors and equities by observed structure, direction, confirmation and ranking history. This is institutional context only, not trading advice.',
    'طبقة قوة نسبية موثقة لمقارنة الأصول والقطاعات والأسهم وفق البنية المرصودة والاتجاه والتأكيد وسجل الترتيب. هذا سياق مؤسسي فقط، وليس نصيحة تداول.'
  );
  const main = kind === 'overview'
    ? `${discoveryLinks(ar)}
${groupSection(ar, 'asset', data.asset, data.history, 6)}
${groupSection(ar, 'sector', data.sector, data.history, 6)}
${groupSection(ar, 'equity', data.equity, data.history, 6)}
${relativeStrengthSection(ar, data.rs)}`
    : `${groupSection(ar, groupType(kind), data[groupType(kind)], data.history)}
${relativeStrengthSection(ar, data.rs)}`;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head(ar, kind)}
<body>
${header}
  <main class="market-shell" data-ranking-page="${esc(kind)}">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t(ar, 'Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t(ar, 'Market Terminal', 'الطرفية المؤسسية'))}</a><span>/</span><span>${esc(title)}</span></nav>
      <section class="market-hero" id="ranking-overview">
        <div class="market-hero-panel">
          <span class="eyebrow">${esc(t(ar, 'Rankings & Relative Strength', 'الترتيب والقوة النسبية'))}</span>
          <h1>${esc(title)}</h1>
          <p class="market-lead">${esc(lead)}</p>
        </div>
      </section>
${main}
      <section class="market-section" id="ranking-disclaimer">
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'TradeAlphaAI rankings are evidence-backed market-structure context derived from verified internal artifacts. They are not forecasts, recommendations, price targets or trading instructions.', 'تعرض ترتيبات TradeAlphaAI سياقاً لبنية السوق مدعوماً بالأدلة ومشتقاً من artifacts داخلية موثقة. وهي ليست توقعات أو توصيات أو أهدافاً سعرية أو تعليمات تداول.'))}</p></div>
      </section>
    </div>
  </main>
  ${globalHeaderScripts()}
</body>
</html>`;
}

function writePage(rel, html) {
  const out = path.join(ROOT, rel, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
}

function main() {
  const data = {
    asset: readJson(J('asset-rankings.json'), {}),
    sector: readJson(J('sector-rankings.json'), {}),
    equity: readJson(J('equity-rankings.json'), {}),
    rs: readJson(J('relative-strength.json'), {}),
    history: readJson(J('ranking-history.json'), {})
  };
  const pages = ['overview', 'assets', 'sectors', 'equities'];
  let count = 0;
  for (const kind of pages) {
    for (const ar of [false, true]) {
      const rel = pageRoute(kind, ar).replace(/^\//, '').replace(/\/$/, '');
      const html = body(ar, kind, data);
      if (WRITE) writePage(rel, html);
      count += 1;
    }
  }
  console.log(WRITE ? `[ranking-pages] wrote ${count} pages` : `[ranking-pages] dry-run ${count} pages`);
}

if (require.main === module) main();

module.exports = { body, pageRoute };
