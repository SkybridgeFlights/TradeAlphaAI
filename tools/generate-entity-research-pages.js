'use strict';

// Phase 213 / CP3 + CP4 + CP5 + CP8 — entity research pages.
//   /research/assets/   + /research/assets/<slug>/   (+ AR)
//   /research/sectors/  + /research/sectors/<slug>/  (+ AR)
//   /research/equities/ + /research/equities/<slug>/ (+ AR)
//   /research/history/  (+ AR)  — change timeline (CP8)
// Composes the entity-research-* / entity-changelog / change-intelligence
// artifacts + the graph-driven Related Research section. Clones the market-outlook
// header; bilingual; RTL; depth-aware css; links to existing pages only.
//
// Usage: node tools/generate-entity-research-pages.js [--write]

const fs = require('fs');
const path = require('path');
const { relatedResearchBlock } = require('./related-research');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const RANK_COLOR = { strongest: '#1f6f5c', strong: '#2f8f76', constructive: '#5a8f7a', neutral: '#46505f', weakening: '#b58b56', weak: '#c2703c', weakest: '#b5523f', indeterminate: '#3a4250' };
const GROUPS = {
  assets: { group: 'asset', artifact: 'entity-research-assets.json', title_en: 'Asset Research', title_ar: 'أبحاث الأصول', singular_en: 'asset', singular_ar: 'أصل' },
  sectors: { group: 'sector', artifact: 'entity-research-sectors.json', title_en: 'Sector Research', title_ar: 'أبحاث القطاعات', singular_en: 'sector', singular_ar: 'قطاع' },
  equities: { group: 'equity', artifact: 'entity-research-equities.json', title_en: 'Equity Research', title_ar: 'أبحاث الأسهم', singular_en: 'equity', singular_ar: 'سهم' },
};

function card(kicker, value, href, color, ar) {
  const inner = href ? `<a href="${esc((ar ? '/ar' : '') + href)}">${esc(value)}</a>` : esc(value);
  return `          <article class="market-card"${color ? ` style="border-inline-start:4px solid ${esc(color)}"` : ''}><span class="market-card-kicker">${esc(kicker)}</span><h3>${inner}</h3></article>`;
}

// ── index page body ──
function indexBody(ar, gkey, t) {
  const g = GROUPS[gkey];
  const data = readJson(J(g.artifact), {});
  const cards = (data.entities || []).map((e) => card(`${e.symbol} · ${esc(ar ? e.current_state.label_ar : e.current_state.label_en)}`, ar ? e.name_ar : e.name_en, e.research_href, RANK_COLOR[e.current_state.state] || RANK_COLOR.indeterminate, ar)).join('\n');
  return `      <section class="market-section" id="entity-research-index"><div class="market-section-head"><span class="eyebrow">${esc(ar ? g.title_ar : g.title_en)}</span><h2>${esc(t('Entity research', 'أبحاث الكيانات'))}</h2></div>
        <p class="market-copy">${esc(t('Per-entity research composed from the existing ranking, regime, historical and narrative intelligence. Each card opens a full research read.', 'أبحاث لكل كيان مركّبة من استخبارات الترتيب والنظام والتاريخ والسردية القائمة. تفتح كل بطاقة قراءة بحثية كاملة.'))}</p>
        <div class="market-grid three">
${cards}
        </div></section>`;
}

// ── detail page body ──
function detailBody(ar, gkey, ent, t) {
  const g = GROUPS[gkey];
  const changelog = readJson(J('entity-changelog.json'), {});
  const cl = (changelog.entities || {})[ent.symbol] || null;
  const summary = [
    card(t('Current state', 'الحالة الحالية'), ar ? ent.current_state.label_ar : ent.current_state.label_en, ent.entity_href, RANK_COLOR[ent.current_state.state] || RANK_COLOR.indeterminate, ar),
    card(t('Confidence', 'الثقة'), ar ? ent.confidence.ar : ent.confidence.en, null, '#46505f', ar),
    card(t('Regime alignment', 'مواءمة النظام'), ar ? regimeLabel(ent.regime_alignment, true) : regimeLabel(ent.regime_alignment, false), '/research/regime/', '#5a8f7a', ar),
  ].join('\n');
  const ranking = [
    card(t('Ranking', 'الترتيب'), ar ? ent.ranking_state.label_ar : ent.ranking_state.label_en, null, RANK_COLOR[ent.ranking_state.rank_label] || RANK_COLOR.indeterminate, ar),
    card(t('Direction', 'الاتجاه'), ar ? ent.ranking_state.direction_ar : ent.ranking_state.direction_en, null, '#2f8f76', ar),
    card(t('Confirmation', 'التأكيد'), ar ? ent.ranking_state.confirmation_ar : ent.ranking_state.confirmation_en, '/market-map/network/', '#5a8f7a', ar),
  ].join('\n');
  const historical = [
    card(t('Historical direction', 'الاتجاه التاريخي'), ar ? ent.historical_direction.label_ar : ent.historical_direction.label_en, '/market-map/history/', '#c2703c', ar),
  ].join('\n');
  const narr = [
    card(t('Market narrative', 'سردية السوق'), ar ? ent.narrative_state.story_ar : ent.narrative_state.story_en, '/market-terminal/', '#46505f', ar),
    card(t('Alignment', 'المواءمة'), ar ? ent.narrative_state.alignment_ar : ent.narrative_state.alignment_en, null, '#2f8f76', ar),
  ].join('\n');
  const evidence = (ent.evidence || []).map((e) => `<li>${esc(e)}</li>`).join('');
  // Changelog: honest unavailable when only one snapshot exists.
  let changelogBody;
  if (cl && cl.history_available) {
    const rows = cl.history.map((h) => `          <article class="market-card"><span class="market-card-kicker">${esc(h.date)}</span><h3>${esc(h.state)}</h3></article>`).join('\n');
    changelogBody = `<div class="market-grid three">\n${rows}\n        </div>`;
  } else {
    const mv = cl ? (ar ? cl.current.movement_ar : cl.current.movement_en) : (ar ? 'لا لقطة سابقة' : 'no prior snapshot');
    changelogBody = `<div class="market-panel"><p class="market-copy">${esc(t('A single snapshot has accumulated so far, so historical movement is reported honestly as unavailable rather than fabricated', 'تراكمت لقطة واحدة حتى الآن، لذا تُذكر الحركة التاريخية بصدق كغير متاحة بدل اختلاقها'))} (${esc(mv)}).</p></div>`;
  }
  return `      <section class="market-section" id="entity-research-summary"><div class="market-section-head"><span class="eyebrow">${esc(t('Research summary', 'ملخص البحث'))}</span><h2>${esc(t('Current research read', 'القراءة البحثية الحالية'))}</h2></div>
        <p class="market-copy">${esc(t('A composed research read of', 'قراءة بحثية مركّبة لـ'))} ${esc(ent.symbol)} — ${esc(ar ? ent.name_ar : ent.name_en)}. ${esc(t('Description from observed intelligence, not a forecast or recommendation.', 'وصف من استخبارات مرصودة، وليس توقعاً أو توصية.'))}</p>
        <div class="market-grid three">
${summary}
        </div></section>
      <section class="market-section" id="entity-research-ranking"><div class="market-section-head"><span class="eyebrow">${esc(t('Ranking position', 'الموضع في الترتيب'))}</span><h2>${esc(t('Where it ranks', 'أين يقع في الترتيب'))}</h2></div><div class="market-grid three">
${ranking}
        </div></section>
      <section class="market-section" id="entity-research-historical"><div class="market-section-head"><span class="eyebrow">${esc(t('Historical evolution', 'التطوّر التاريخي'))}</span><h2>${esc(t('How it has evolved', 'كيف تطوّر'))}</h2></div><div class="market-grid three">
${historical}
        </div></section>
      <section class="market-section" id="entity-research-narrative"><div class="market-section-head"><span class="eyebrow">${esc(t('Narrative', 'السردية'))}</span><h2>${esc(t('How it fits the market narrative', 'كيف يندرج ضمن سردية السوق'))}</h2></div><div class="market-grid three">
${narr}
        </div>
        <div class="market-panel"><p class="market-copy">${esc(t('Evidence', 'الأدلة'))}:</p><ul class="market-copy">${evidence}</ul></div></section>
      <section class="market-section" id="entity-research-changelog"><div class="market-section-head"><span class="eyebrow">${esc(t('Changelog', 'سجل التغيّر'))}</span><h2>${esc(t('State through time', 'الحالة عبر الوقت'))}</h2></div>
        ${changelogBody}</section>
${relatedResearchBlock(ar, g.group, ent.symbol)}`;
}

function regimeLabel(state, ar) {
  const map = { aligned: ['aligned', 'متوائم'], divergent: ['divergent', 'متباعد'], neutral: ['neutral', 'محايد'], indeterminate: ['indeterminate', 'غير محدد'] };
  const m = map[state] || map.indeterminate; return ar ? m[1] : m[0];
}

// ── research history (CP8) ──
function historyBody(ar, t) {
  const ci = readJson(J('change-intelligence.json'), {});
  const bucket = (key, label, color) => {
    const arr = (ci.buckets && ci.buckets[key]) || [];
    const value = arr.length ? arr.map((x) => x.symbol).join(' · ') : t('none observed', 'لا يوجد مرصود');
    return card(label, value, null, color, ar);
  };
  const cards = [
    bucket('improving', t('Strongest improvements', 'أقوى التحسّنات'), '#2f8f76'),
    bucket('deteriorating', t('Largest deteriorations', 'أكبر التدهورات'), '#b5523f'),
    bucket('stable', t('Stable', 'مستقر'), '#46505f'),
    bucket('weakening', t('Weakening', 'يضعف'), '#b58b56'),
  ].join('\n');
  const trans = (ci.recent_transitions || []).map((tr) => card(t('Recent transition', 'تحوّل حديث'), ar ? tr.state_ar : tr.state_en, '/market-map/history/', '#c2703c', ar)).join('\n');
  const timeline = (ci.regime_timeline || []).map((r) => `          <article class="market-card"><span class="market-card-kicker">${esc(r.date)}</span><h3>${esc(String(r.macro_regime || '').replace(/_/g, ' '))}</h3></article>`).join('\n');
  const tlBlock = timeline ? `<section class="market-section" id="research-history-timeline"><div class="market-section-head"><span class="eyebrow">${esc(t('Regime timeline', 'الخط الزمني للنظام'))}</span><h2>${esc(t('Regime through recent snapshots', 'النظام عبر اللقطات الأخيرة'))}</h2></div><div class="market-grid three">\n${timeline}\n        </div></section>` : '';
  const histNote = ci.snapshot_count > 1 ? t('Changes are measured across the accumulated snapshot ledger.', 'تُقاس التغيّرات عبر سجل اللقطات المتراكم.') : t('The snapshot ledger holds a single snapshot; observed direction is reported now, deeper history accumulates over time.', 'يحتفظ سجل اللقطات بلقطة واحدة؛ ويُذكر الاتجاه المرصود الآن، ويتراكم تاريخ أعمق مع الوقت.');
  return `      <section class="market-section" id="research-history"><div class="market-section-head"><span class="eyebrow">${esc(t('Change intelligence', 'استخبارات التغيّر'))}</span><h2>${esc(t('Latest changes across the desk', 'أحدث التغيّرات عبر المكتب'))}</h2></div>
        <p class="market-copy">${esc(histNote)}</p>
        <div class="market-grid three">
${cards}
${trans}
        </div></section>
      ${tlBlock}`;
}

function buildHead(ar, slugPath, title_en, title_ar, lead_en, lead_ar) {
  const depth = (ar ? 1 : 0) + slugPath.split('/').filter(Boolean).length;
  const rel = '../'.repeat(depth);
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const title = `${ar ? title_ar : title_en} | TradeAlphaAI`;
  const desc = ar ? lead_ar : lead_en;
  const css = ['/css/global-header.css', `${rel}styles.css`, `${rel}landing.css`, `${rel}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'مركز الأبحاث' : 'Research Hub', item: ar ? 'https://www.tradealphaai.com/ar/research/' : 'https://www.tradealphaai.com/research/' },
      { '@type': 'ListItem', position: 3, name: ar ? title_ar : title_en, item: url },
    ] } ] };
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
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function page(ar, { slugPath, title_en, title_ar, lead_en, lead_ar, body, parentCrumb }) {
  const t = (en, arT) => (ar ? arT : en);
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
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${slugPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${slugPath}$2`);
  const footer = template.slice(mainEndIdx);
  const crumb = `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/research/' : '/research/'}">${esc(t('Research Hub', 'مركز الأبحاث'))}</a>${parentCrumb ? `<span>/</span><a href="${ar ? '/ar' : ''}${parentCrumb.href}">${esc(ar ? parentCrumb.ar : parentCrumb.en)}</a>` : ''}<span>/</span><span>${esc(ar ? title_ar : title_en)}</span></nav>`;
  const main = `  <main class="market-shell">
    <div class="wrap">
      ${crumb}
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('Entity Research Network', 'شبكة أبحاث الكيانات'))}</span><h1>${esc(ar ? title_ar : title_en)}</h1><p class="market-lead">${esc(ar ? lead_ar : lead_en)}</p></div></section>
${body}
      <section class="market-section" id="entity-research-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI entity research presents institutional interpretation of observed conditions only, composed from existing intelligence. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم أبحاث الكيانات في TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة فقط، مركّبة من الاستخبارات القائمة. وهي ليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, slugPath, title_en, title_ar, lead_en, lead_ar)}
${bodyTag}${headerBlock}

${main}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  let count = 0;
  const out = (baseDir, html) => { if (!write) return; const p = path.join(ROOT, baseDir, 'index.html'); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html, 'utf8'); count += 1; };
  for (const [gkey, g] of Object.entries(GROUPS)) {
    const data = readJson(J(g.artifact), {});
    const idxLead = { en: `Per-entity research for every ${g.singular_en}, composed from the existing intelligence. Educational context, not signals.`, ar: `أبحاث لكل ${g.singular_ar} مركّبة من الاستخبارات القائمة. سياق تعليمي وليس إشارات.` };
    for (const ar of [false, true]) {
      out(`${ar ? 'ar/' : ''}research/${gkey}`, page(ar, { slugPath: `research/${gkey}/`, title_en: g.title_en, title_ar: g.title_ar, lead_en: idxLead.en, lead_ar: idxLead.ar, body: indexBody(ar, gkey, (en, arT) => (ar ? arT : en)) }));
    }
    for (const ent of (data.entities || [])) {
      const lead = { en: `Institutional research read of ${ent.symbol} — ${ent.name_en}: its current state, ranking, regime alignment, historical evolution and related research.`, ar: `قراءة بحثية مؤسسية لـ ${ent.symbol} — ${ent.name_ar}: حالته الحالية وترتيبه ومواءمة النظام والتطوّر التاريخي والأبحاث ذات الصلة.` };
      for (const ar of [false, true]) {
        out(`${ar ? 'ar/' : ''}research/${gkey}/${ent.slug}`, page(ar, { slugPath: `research/${gkey}/${ent.slug}/`, title_en: `${ent.symbol} — ${ent.name_en}`, title_ar: `${ent.symbol} — ${ent.name_ar}`, lead_en: lead.en, lead_ar: lead.ar, body: detailBody(ar, gkey, ent, (en, arT) => (ar ? arT : en)), parentCrumb: { href: `/research/${gkey}/`, en: g.title_en, ar: g.title_ar } }));
      }
    }
  }
  // Research history timeline (CP8).
  const hLead = { en: 'The latest changes across the desk — strongest improvements, largest deteriorations, recent transitions and the regime timeline. Educational context, not signals.', ar: 'أحدث التغيّرات عبر المكتب — أقوى التحسّنات وأكبر التدهورات والتحوّلات الأخيرة والخط الزمني للنظام. سياق تعليمي وليس إشارات.' };
  for (const ar of [false, true]) {
    out(`${ar ? 'ar/' : ''}research/history`, page(ar, { slugPath: 'research/history/', title_en: 'Research History', title_ar: 'سجل الأبحاث', lead_en: hLead.en, lead_ar: hLead.ar, body: historyBody(ar, (en, arT) => (ar ? arT : en)) }));
  }
  console.log(write ? `[entity-research-pages] wrote ${count} pages` : '[entity-research-pages] dry-run');
}

if (require.main === module) main();

module.exports = { main, GROUPS };
