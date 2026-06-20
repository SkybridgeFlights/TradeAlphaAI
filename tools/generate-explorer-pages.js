'use strict';

// Phase 217 - static Intelligence Explorer pages.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }
function localHref(ar, href) {
  if (!href) return ar ? '/ar/explorer/' : '/explorer/';
  if (!ar) return href;
  if (href.startsWith('/ar/')) return href;
  return `/ar${href}`;
}

function pluralType(type) {
  return type === 'equity' ? 'equities' : `${type}s`;
}

const SURFACES = {
  home: { slug: '', title_en: 'Intelligence Explorer', title_ar: 'مستكشف الاستخبارات', lead_en: 'A connected exploration surface for research, changes, rankings, regimes, entities, ETFs, narrative and historical intelligence.', lead_ar: 'سطح استكشاف مترابط للأبحاث والتغيّرات والترتيبات والأنظمة والكيانات وصناديق المؤشرات والسردية والاستخبارات التاريخية.' },
  events: { slug: 'events', title_en: 'Event Explorer', title_ar: 'مستكشف الأحداث', lead_en: 'Latest observed change events grouped with confidence, evidence and related entities. No fabricated events.', lead_ar: 'أحدث أحداث التغيير المرصودة مع الثقة والأدلة والكيانات المرتبطة. بلا أحداث مختلقة.' },
  entity: { slug: 'entity', title_en: 'Entity Explorer', title_ar: 'مستكشف الكيانات', lead_en: 'Single intelligence views for assets, sectors, equities and ETFs, composed from research, rankings, events, regime alignment and history.', lead_ar: 'عروض استخبارات موحّدة للأصول والقطاعات والأسهم وصناديق المؤشرات، مركّبة من الأبحاث والترتيب والأحداث ومواءمة النظام والتاريخ.' },
  network: { slug: 'network', title_en: 'Network Explorer', title_ar: 'مستكشف الشبكة', lead_en: 'Evidence-backed relationships from the research graph, entity graph, cognitive networks and event graph.', lead_ar: 'علاقات مدعومة بالأدلة من مخطط الأبحاث ومخطط الكيانات والشبكات المعرفية ومخطط الأحداث.' },
  research: { slug: 'research', title_en: 'Research Explorer', title_ar: 'مستكشف الأبحاث', lead_en: 'A traversal surface for research categories, related research, graph neighbors and latest institutional research.', lead_ar: 'سطح عبور لفئات الأبحاث والأبحاث المرتبطة وجيران المخطط وأحدث الأبحاث المؤسسية.' },
  search: { slug: 'search', title_en: 'Search Explorer', title_ar: 'مستكشف البحث', lead_en: 'A static generated search index across assets, sectors, equities, ETFs, research and change events.', lead_ar: 'فهرس بحث ثابت مولّد عبر الأصول والقطاعات والأسهم وصناديق المؤشرات والأبحاث وأحداث التغيير.' },
};

function load() {
  return {
    explorer: readJson(J('explorer-index.json'), { entities: [], events: [], research: [], counts: {} }),
    search: readJson(J('explorer-search-index.json'), { entries: [] }),
    eventGraph: readJson(J('event-graph.json'), { nodes: [], edges: [] }),
    paths: readJson(J('intelligence-paths.json'), { paths: [] }),
    researchGraph: readJson(J('research-graph.json'), { nodes: [], edges: [] }),
    entityGraph: readJson(J('entity-research-graph.json'), { nodes: [], edges: [] }),
  };
}

function templateParts(ar) {
  const file = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const html = fs.readFileSync(file, 'utf8');
  const bodyOpenIdx = html.indexOf('<body');
  const bodyOpenTagEnd = html.indexOf('>', bodyOpenIdx) + 1;
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = html.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = html.indexOf('</main>') + '</main>'.length;
  return {
    bodyTag: html.slice(bodyOpenIdx, bodyOpenTagEnd),
    header: html.slice(bodyOpenTagEnd, headerEndIdx)
      .replace('data-active-section="market-outlook"', 'data-active-section="research"')
      .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, '$1/ar/explorer/$2')
      .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, '$1/explorer/$2'),
    footer: html.slice(mainEndIdx),
  };
}

function head(ar, surface, relPath) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${relPath}`;
  const enUrl = `https://www.tradealphaai.com/${relPath}`;
  const arUrl = `https://www.tradealphaai.com/ar/${relPath}`;
  const depth = (ar ? 1 : 0) + relPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.lead_ar : surface.lead_en;
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'مستكشف الاستخبارات' : 'Intelligence Explorer', item: ar ? 'https://www.tradealphaai.com/ar/explorer/' : 'https://www.tradealphaai.com/explorer/' },
        { '@type': 'ListItem', position: 3, name: ar ? surface.title_ar : surface.title_en, item: url },
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
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${enUrl}" />
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

function card(ar, kicker, title, copy, href) {
  const h = href ? localHref(ar, href) : '';
  return `          <article class="market-card"><span class="market-card-kicker">${esc(kicker)}</span><h3>${h ? `<a href="${esc(h)}">${esc(title)}</a>` : esc(title)}</h3>${copy ? `<p class="market-copy">${esc(copy)}</p>` : ''}</article>`;
}

function navCards(ar) {
  const items = [
    ['/explorer/events/', t(ar, 'Event Explorer', 'مستكشف الأحداث'), t(ar, 'Change events and related entities', 'أحداث التغيير والكيانات المرتبطة')],
    ['/explorer/entity/', t(ar, 'Entity Explorer', 'مستكشف الكيانات'), t(ar, 'Assets, sectors, equities and ETFs', 'الأصول والقطاعات والأسهم والصناديق')],
    ['/explorer/research/', t(ar, 'Research Explorer', 'مستكشف الأبحاث'), t(ar, 'Research graph and latest notes', 'مخطط الأبحاث وأحدث الملاحظات')],
    ['/explorer/network/', t(ar, 'Network Explorer', 'مستكشف الشبكة'), t(ar, 'Evidence-backed relationships', 'العلاقات المدعومة بالأدلة')],
    ['/explorer/search/', t(ar, 'Search Explorer', 'مستكشف البحث'), t(ar, 'Static search index', 'فهرس بحث ثابت')],
  ];
  return items.map(([href, title, sub]) => card(ar, t(ar, 'Explorer', 'المستكشف'), title, sub, href)).join('\n');
}

function homeBody(ar, data) {
  const c = data.explorer.counts || {};
  return `      <section class="market-section" id="explorer-overview"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Explorer', 'المستكشف'))}</span><h2>${esc(t(ar, 'Connected intelligence surfaces', 'أسطح استخبارات مترابطة'))}</h2></div>
        <p class="market-copy">${esc(t(ar, `Current explorer index: ${c.entities || 0} entities, ${c.events || 0} events and ${c.research || 0} research nodes.`, `فهرس المستكشف الحالي: ${c.entities || 0} كياناً، ${c.events || 0} حدثاً، و${c.research || 0} عقدة بحثية.`))}</p>
        <div class="market-grid three">
${navCards(ar)}
        </div></section>`;
}

function eventsBody(ar, data) {
  const events = (data.explorer.events || []).slice(0, 36);
  const cards = events.map((e) => card(ar, `${e.entity_type || 'event'} · ${e.confidence}`, ar ? e.label_ar : e.label_en, `${e.entity || ''} · ${e.change_type || ''}`, e.href || '/changes/')).join('\n');
  return `      <section class="market-section" id="explorer-events"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Events', 'الأحداث'))}</span><h2>${esc(t(ar, 'Latest observed events', 'أحدث الأحداث المرصودة'))}</h2></div>
        <div class="market-grid three">
${cards || card(ar, t(ar, 'Events', 'الأحداث'), t(ar, 'No events available', 'لا توجد أحداث متاحة'), t(ar, 'The event ledger is currently empty.', 'سجل الأحداث فارغ حالياً.'), '/changes/')}
        </div></section>`;
}

function entityHubBody(ar, data) {
  const groups = ['asset', 'sector', 'equity', 'etf'];
  return groups.map((g) => {
    const list = (data.explorer.entities || []).filter((e) => e.type === g).slice(0, 24);
    return `      <section class="market-section" id="explorer-entity-${g}"><div class="market-section-head"><span class="eyebrow">${esc(g)}</span><h2>${esc(t(ar, `${g.toUpperCase()} explorer`, `${g.toUpperCase()} مستكشف`))}</h2></div>
        <div class="market-grid three">
${list.map((e) => card(ar, `${e.symbol} · ${e.ranking.rank_label}`, ar ? e.name_ar : e.name_en, `${e.current_state} · ${e.historical_direction}`, e.explorer_href)).join('\n')}
        </div></section>`;
  }).join('\n');
}

function entityDetailBody(ar, data, entity) {
  const pathItem = (data.paths.paths || []).find((p) => p.entity_id === entity.id);
  const eventCards = (entity.events || []).map((e) => card(ar, e.change_type, ar ? e.label_ar : e.label_en, (e.evidence_refs || []).slice(0, 1).join(' · '), e.href)).join('\n');
  const steps = (pathItem ? pathItem.steps : []).map((s) => card(ar, s.kind, ar ? s.label_ar : s.label_en, (s.evidence_refs || []).slice(0, 2).join(' · '), s.href)).join('\n');
  return `      <section class="market-section" id="explorer-entity-summary"><div class="market-section-head"><span class="eyebrow">${esc(entity.type)} · ${esc(entity.symbol)}</span><h2>${esc(ar ? entity.name_ar : entity.name_en)}</h2></div>
        <div class="market-grid three">
${card(ar, t(ar, 'Current state', 'الحالة الحالية'), entity.current_state, `${t(ar, 'Confidence', 'الثقة')}: ${entity.confidence}`, entity.href)}
${card(ar, t(ar, 'Ranking', 'الترتيب'), entity.ranking.rank_label, `${t(ar, 'Confirmation', 'التأكيد')}: ${entity.ranking.confirmation_state}`, '/rankings/')}
${card(ar, t(ar, 'Regime alignment', 'مواءمة النظام'), entity.regime_alignment, `${t(ar, 'History', 'التاريخ')}: ${entity.historical_direction}`, '/market-regime/')}
        </div></section>
      <section class="market-section" id="explorer-entity-path"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Intelligence path', 'مسار الاستخبارات'))}</span><h2>${esc(t(ar, 'How to traverse this entity', 'كيفية عبور هذا الكيان'))}</h2></div><div class="market-grid three">
${steps}
        </div></section>
      <section class="market-section" id="explorer-entity-events"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Related events', 'الأحداث المرتبطة'))}</span><h2>${esc(t(ar, 'Observed changes', 'التغيّرات المرصودة'))}</h2></div><div class="market-grid three">
${eventCards || card(ar, t(ar, 'Events', 'الأحداث'), t(ar, 'No related events', 'لا توجد أحداث مرتبطة'), t(ar, 'No observed events are linked to this entity yet.', 'لا توجد أحداث مرصودة مرتبطة بهذا الكيان بعد.'), '/explorer/events/')}
        </div></section>`;
}

function networkSvg(ar, graph) {
  const nodes = (graph.nodes || []).slice(0, 18);
  const edges = (graph.edges || []).filter((e) => nodes.some((n) => n.id === e.from) && nodes.some((n) => n.id === e.to)).slice(0, 28);
  const width = 1120; const height = 520; const cx = width / 2; const cy = height / 2; const r = 205;
  const pos = new Map();
  nodes.forEach((n, i) => {
    const a = (Math.PI * 2 * i) / Math.max(1, nodes.length) + (ar ? Math.PI : 0);
    pos.set(n.id, { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  });
  const lines = edges.map((e) => {
    const a = pos.get(e.from); const b = pos.get(e.to);
    if (!a || !b) return '';
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#6f7c8d" stroke-width="1.2" opacity="0.55"/>`;
  }).join('\n');
  const dots = nodes.map((n) => {
    const p = pos.get(n.id);
    const label = (ar ? n.label_ar : n.label_en) || n.id;
    return `<g><circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="20" fill="#121923" stroke="#b8a46a" stroke-width="1.2"/><text x="${p.x.toFixed(1)}" y="${(p.y + 39).toFixed(1)}" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="13" fill="#e6ebef">${esc(label).slice(0, 28)}</text></g>`;
  }).join('\n');
  return `<svg class="market-map-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(t(ar, 'Evidence-backed network', 'شبكة مدعومة بالأدلة'))}" preserveAspectRatio="xMidYMid meet"><rect width="${width}" height="${height}" fill="#0b0e13" rx="16"/>${lines}${dots}</svg>`;
}

function networkBody(ar, data) {
  const graph = data.eventGraph || { nodes: [], edges: [] };
  const edgeCards = (graph.edges || []).slice(0, 18).map((e) => card(ar, e.relation, e.from + ' → ' + e.to, (e.evidence_refs || []).slice(0, 2).join(' · '), '/explorer/network/')).join('\n');
  return `      <section class="market-section" id="explorer-network"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Network', 'الشبكة'))}</span><h2>${esc(t(ar, 'Event graph relationships', 'علاقات مخطط الأحداث'))}</h2></div>
        <div class="market-panel"><div class="ic-svg">${networkSvg(ar, graph)}</div></div></section>
      <section class="market-section" id="explorer-network-edges"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Edges', 'الحواف'))}</span><h2>${esc(t(ar, 'Evidence-backed links', 'روابط مدعومة بالأدلة'))}</h2></div><div class="market-grid three">
${edgeCards || card(ar, t(ar, 'Network', 'الشبكة'), t(ar, 'No edges available', 'لا توجد حواف متاحة'), t(ar, 'No evidence-backed graph edges are available.', 'لا توجد حواف مخطط مدعومة بالأدلة.'), '/explorer/')}
        </div></section>`;
}

function researchBody(ar, data) {
  const items = (data.explorer.research || []).slice(0, 36);
  return `      <section class="market-section" id="explorer-research"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Research', 'الأبحاث'))}</span><h2>${esc(t(ar, 'Research graph traversal', 'عبور مخطط الأبحاث'))}</h2></div>
        <div class="market-grid three">
${items.map((r) => card(ar, 'research', ar ? r.label_ar : r.label_en, (r.evidence_refs || []).join(' · '), r.href)).join('\n')}
        </div></section>`;
}

function searchBody(ar, data) {
  const entries = (data.search.entries || []).slice(0, 80);
  return `      <section class="market-section" id="explorer-search"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Search index', 'فهرس البحث'))}</span><h2>${esc(t(ar, 'Static generated search universe', 'كون بحث ثابت مولّد'))}</h2></div>
        <p class="market-copy">${esc(t(ar, 'This page exposes the indexed universe without external search services or client framework dependency.', 'تعرض هذه الصفحة الكون المفهرس دون خدمات بحث خارجية أو اعتماد على إطار عمل في المتصفح.'))}</p>
        <div class="market-grid three">
${entries.map((e) => card(ar, e.type, ar ? e.title_ar : e.title_en, (e.keywords || []).slice(0, 4).join(' · '), e.href)).join('\n')}
        </div></section>`;
}

function body(ar, surface, data, detailEntity) {
  const crumbTail = detailEntity ? `${detailEntity.type} · ${detailEntity.symbol}` : (ar ? surface.title_ar : surface.title_en);
  let content = '';
  if (detailEntity) content = entityDetailBody(ar, data, detailEntity);
  else if (surface.slug === '') content = homeBody(ar, data);
  else if (surface.slug === 'events') content = eventsBody(ar, data);
  else if (surface.slug === 'entity') content = entityHubBody(ar, data);
  else if (surface.slug === 'network') content = networkBody(ar, data);
  else if (surface.slug === 'research') content = researchBody(ar, data);
  else if (surface.slug === 'search') content = searchBody(ar, data);
  return `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t(ar, 'Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/explorer/' : '/explorer/'}">${esc(t(ar, 'Explorer', 'المستكشف'))}</a><span>/</span><span>${esc(crumbTail)}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t(ar, 'Intelligence Explorer', 'مستكشف الاستخبارات'))}</span><h1>${esc(detailEntity ? `${detailEntity.symbol} ${t(ar, 'Explorer', 'مستكشف')}` : (ar ? surface.title_ar : surface.title_en))}</h1><p class="market-lead">${esc(detailEntity ? t(ar, 'A single connected view composed from existing verified research, rankings, changes, regime alignment and history.', 'عرض مترابط واحد مركّب من الأبحاث والترتيبات والتغيّرات ومواءمة النظام والتاريخ الموثقة القائمة.') : (ar ? surface.lead_ar : surface.lead_en))}</p></div></section>
${content}
      <section class="market-section" id="explorer-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(ar, 'TradeAlphaAI explorer surfaces organize observed intelligence relationships only. They are not execution instructions, predictive claims, recommendations or investment advice.', 'تنظّم أسطح مستكشف TradeAlphaAI علاقات استخبارات مرصودة فقط. وهي ليست تعليمات تنفيذ أو ادعاءات تنبؤية أو توصيات أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
}

function render(ar, surface, relPath, data, detailEntity) {
  const parts = templateParts(ar);
  const header = parts.header
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${relPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${relPath}$2`);
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head(ar, surface, relPath)}
${parts.bodyTag}${header}

${body(ar, surface, data, detailEntity)}
${parts.footer}`;
}

function writePage(rel, html) {
  const out = path.join(ROOT, rel, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html, 'utf8');
}

function main() {
  const data = load();
  let count = 0;
  for (const surface of Object.values(SURFACES)) {
    const rel = surface.slug ? `explorer/${surface.slug}/` : 'explorer/';
    for (const ar of [false, true]) {
      const pathRel = ar ? `ar/${rel}` : rel;
      if (WRITE) writePage(pathRel, render(ar, surface, rel, data));
      count += 1;
    }
  }
  for (const entity of data.explorer.entities || []) {
    const rel = `explorer/entity/${pluralType(entity.type)}/${entity.slug}/`;
    const surface = { ...SURFACES.entity, title_en: `${entity.symbol} Explorer`, title_ar: `مستكشف ${entity.symbol}`, lead_en: SURFACES.entity.lead_en, lead_ar: SURFACES.entity.lead_ar };
    for (const ar of [false, true]) {
      const pathRel = ar ? `ar/${rel}` : rel;
      if (WRITE) writePage(pathRel, render(ar, surface, rel, data, entity));
      count += 1;
    }
  }
  console.log(WRITE ? `[explorer-pages] wrote ${count} pages` : `[explorer-pages] dry-run ${count} pages`);
}

if (require.main === module) main();

module.exports = { render, load, SURFACES };
