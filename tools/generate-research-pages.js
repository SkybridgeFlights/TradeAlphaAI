'use strict';

// Phase 212 / CP1 + CP5 + CP7 + CP9 — research network pages.
//   /research/        + /ar/research/        — research hub (categories + briefs)
//   /research/feed/   + /ar/research/feed/   — latest research + latest changes
//   /research/regime/ + /ar/research/regime/ — regime research center
// Reuses the research-hub / research-graph / intelligence-briefs / research-
// authority artifacts and the existing regime/narrative/leadership intelligence.
// Clones the market-outlook header; bilingual; RTL; links only to existing pages.
//
// Usage: node tools/generate-research-pages.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

const SURFACES = {
  hub: { slug: '', kind: 'hub', dir: 'research', title_en: 'Research Hub', title_ar: 'مركز الأبحاث', lead_en: 'A living institutional research network — macro, regime, asset, sector, equity and historical research, all derived from observed intelligence. Educational context, not signals.', lead_ar: 'شبكة أبحاث مؤسسية حيّة — أبحاث الماكرو والنظام والأصول والقطاعات والأسهم والتاريخ، مشتقة جميعها من استخبارات مرصودة. سياق تعليمي وليس إشارات.' },
  feed: { slug: 'feed', kind: 'feed', dir: 'research/feed', title_en: 'Research Feed', title_ar: 'تغذية الأبحاث', lead_en: 'The latest research, regime, ranking, historical and leadership changes — composed from the existing intelligence artifacts. Educational context, not signals.', lead_ar: 'أحدث تغيّرات الأبحاث والنظام والترتيب والتاريخ والقيادة — مركّبة من مصادر الاستخبارات القائمة. سياق تعليمي وليس إشارات.' },
  regime: { slug: 'regime', kind: 'regime', dir: 'research/regime', title_en: 'Regime Research Center', title_ar: 'مركز أبحاث النظام', lead_en: 'The current regime, its historical transition, narrative, confirmation, contradiction and leadership — one research read of the environment. No forecasts.', lead_ar: 'النظام الحالي وتحوّله التاريخي والسردية والتأكيد والتناقض والقيادة — قراءة بحثية واحدة للبيئة. دون توقعات.' },
};

const lv = (o, k, ar) => (o && o[`${k}_${ar ? 'ar' : 'en'}`] ? o[`${k}_${ar ? 'ar' : 'en'}`] : (ar ? 'غير محدد' : 'indeterminate'));
function card(kicker, title, href, color, ar) {
  const inner = href ? `<a href="${esc((ar ? '/ar' : '') + href)}">${esc(title)}</a>` : esc(title);
  return `          <article class="market-card"${color ? ` style="border-inline-start:4px solid ${esc(color)}"` : ''}><span class="market-card-kicker">${esc(kicker)}</span><h3>${inner}</h3></article>`;
}

function hubBody(ar, t) {
  const hub = readJson(J('research-hub.json'), {});
  const briefs = readJson(J('intelligence-briefs.json'), {});
  const cats = (hub.categories || []).map((c) => {
    const links = (c.items || []).map((it) => `<a href="${esc((ar ? '/ar' : '') + it.href)}">${esc(ar ? it.title_ar : it.title_en)}</a>`).join(' · ');
    return `          <article class="market-card"><span class="market-card-kicker">${esc(ar ? c.title_ar : c.title_en)}</span><p class="market-copy">${esc(ar ? c.summary_ar : c.summary_en)}</p><p class="market-copy">${links}</p></article>`;
  }).join('\n');
  const briefCards = (briefs.briefs || []).map((b) => card(ar ? b.title_ar : b.title_en, ar ? b.summary_ar : b.summary_en, b.href, '#2f8f76', ar)).join('\n');
  return `      <section class="market-section" id="research-categories"><div class="market-section-head"><span class="eyebrow">${esc(t('Research categories', 'فئات الأبحاث'))}</span><h2>${esc(t('Explore the research network', 'استكشف شبكة الأبحاث'))}</h2></div>
        <p class="market-copy">${esc(t('Each category orchestrates the existing intelligence into research — no duplicated engines, every link reaches a live intelligence surface.', 'كل فئة تنظّم الاستخبارات القائمة في صورة أبحاث — دون محرّكات مكرّرة، وكل رابط يصل إلى سطح استخبارات حيّ.'))}</p>
        <div class="market-grid three">
${cats}
        </div></section>
      <section class="market-section" id="research-briefs"><div class="market-section-head"><span class="eyebrow">${esc(t('Institutional briefs', 'إحاطات مؤسسية'))}</span><h2>${esc(t('What changed', 'ما الذي تغيّر'))}</h2></div><div class="market-grid three">
${briefCards}
        </div>
        <p class="market-copy"><a href="${ar ? '/ar/research/feed/' : '/research/feed/'}">${esc(t('Open the research feed', 'افتح تغذية الأبحاث'))}</a> · <a href="${ar ? '/ar/research/regime/' : '/research/regime/'}">${esc(t('Regime research center', 'مركز أبحاث النظام'))}</a></p>
      </section>`;
}

function feedBody(ar, t) {
  const briefs = readJson(J('intelligence-briefs.json'), {});
  const dash = readJson(J('market-regime-dashboard.json'), {});
  const transitions = readJson(J('regime-transitions.json'), {});
  const snap = (dash && dash.leadership_snapshot) || {};
  const items = [];
  for (const b of (briefs.briefs || [])) items.push(card(t('Latest research', 'أحدث الأبحاث'), ar ? b.title_ar : b.title_en, b.href, '#2f8f76', ar));
  if (dash && dash.current_regime) items.push(card(t('Regime', 'النظام'), ar ? dash.current_regime.label_ar : dash.current_regime.label_en, '/research/regime/', '#5a8f7a', ar));
  if (transitions && transitions.available) items.push(card(t('Historical transition', 'التحوّل التاريخي'), lv(transitions, 'transition_state', ar), '/market-map/history/', '#c2703c', ar));
  if (snap.strongest_assets) items.push(card(t('Leadership change', 'تغيّر القيادة'), (snap.strongest_assets || []).join(' · '), '/rankings/', '#2f8f76', ar));
  if (snap.weakest_assets) items.push(card(t('Weakening', 'يضعف'), (snap.weakest_assets || []).join(' · '), '/rankings/', '#b5523f', ar));
  const prior = readJson(J('ranking-history.json'), {});
  const histNote = prior && prior.has_prior === true ? t('Ranking movement is measured against the prior snapshot.', 'تُقاس حركة الترتيب مقابل اللقطة السابقة.') : t('Ranking history begins accumulating; movement is reported honestly as it builds.', 'بدأ تاريخ الترتيب بالتراكم؛ وتُذكر الحركة بصدق مع تكوّنها.');
  // Phase 216 CP7 — Latest Intelligence Changes panel from change-events.
  const changeEvents = readJson(J('change-events.json'), { events: [], significant: [] });
  const sigIds = new Set(changeEvents.significant || []);
  const sigEvents = (changeEvents.events || []).filter((e) => sigIds.has(e.id)).slice(0, 6);
  const sigCards = sigEvents.map((e) => {
    const labelEn = e.label_en || e.change_type;
    const labelAr = e.label_ar || e.change_type;
    const title = `${e.entity} · ${e.entity_type}`;
    const href = e.href || e.research_href || '/changes/';
    return card(t(labelEn, labelAr), title, href, '#1f6f5c', ar);
  }).join('\n');
  const totalChanges = (changeEvents.events || []).length;
  return `      <section class="market-section" id="research-feed"><div class="market-section-head"><span class="eyebrow">${esc(t('Latest', 'الأحدث'))}</span><h2>${esc(t('Latest research and changes', 'أحدث الأبحاث والتغيّرات'))}</h2></div>
        <p class="market-copy">${esc(histNote)}</p>
        <div class="market-grid three">
${items.join('\n')}
        </div></section>
      <section class="market-section" id="research-feed-changes"><div class="market-section-head"><span class="eyebrow">${esc(t('Latest Intelligence Changes', 'أحدث تغيّرات الاستخبارات'))}</span><h2>${esc(t('Significant change events', 'أحداث التغيّر المهمّة'))}</h2></div>
        <p class="market-copy">${esc(t('Composed from the change-events artifact (total ' + totalChanges + ' events). Each event carries an allowed change class and observed evidence. Educational context only.', 'مركّبة من بيان أحداث التغيير (إجمالي ' + totalChanges + ' حدث). يحمل كل حدث صنف تغيير مسموحاً به وأدلة مرصودة. سياق تعليمي فقط.'))}</p>
        <div class="market-grid three">
${sigCards || `          <p class="market-copy">${esc(t('No significant changes observed yet.', 'لا توجد تغيّرات مهمّة مرصودة بعد.'))}</p>`}
        </div>
        <p class="market-copy"><a href="${ar ? '/ar/changes/' : '/changes/'}">${esc(t('Open the Changes Hub', 'افتح مركز التغيّرات'))}</a> · <a href="${ar ? '/ar/changes/history/' : '/changes/history/'}">${esc(t('View change timeline', 'عرض الجدول الزمني'))}</a></p>
      </section>`;
}

function regimeBody(ar, t) {
  const dash = readJson(J('market-regime-dashboard.json'), {});
  const narrative = readJson(J('market-narrative.json'), {});
  const transitions = readJson(J('regime-transitions.json'), {});
  const confirmation = readJson(J('confirmation-matrix.json'), {});
  const snap = (dash && dash.leadership_snapshot) || {};
  const cur = dash && dash.current_regime ? (ar ? dash.current_regime.label_ar : dash.current_regime.label_en) : t('indeterminate', 'غير محدد');
  const story = narrative && narrative.dominant_story ? (ar ? narrative.dominant_story.label_ar : narrative.dominant_story.label_en) : t('indeterminate', 'غير محدد');
  const chips = [
    card(t('Current regime', 'النظام الحالي'), cur, '/market-regime/', '#2f8f76', ar),
    card(t('Narrative', 'السردية'), story, '/market-terminal/', '#5a8f7a', ar),
    card(t('Historical transition', 'التحوّل التاريخي'), lv(transitions, 'transition_state', ar), '/market-map/history/', '#c2703c', ar),
    card(t('Confirmation', 'التأكيد'), narrative && narrative.confirmation_story ? (ar ? narrative.confirmation_story.label_ar : narrative.confirmation_story.label_en) : t('indeterminate', 'غير محدد'), '/market-map/network/', '#2f8f76', ar),
    card(t('Contradiction', 'التناقض'), narrative && narrative.contradiction_story ? (ar ? narrative.contradiction_story.label_ar : narrative.contradiction_story.label_en) : t('none observed', 'لا يوجد مرصود'), '/market-map/network/', '#b5523f', ar),
    card(t('Leadership', 'القيادة'), (snap.strongest_assets || []).concat(snap.strongest_sectors || []).slice(0, 4).join(' · ') || t('indeterminate', 'غير محدد'), '/rankings/', '#46505f', ar),
  ].join('\n');
  const matrix = confirmation && confirmation.matrix_state ? `<p class="market-copy">${esc(t('Confirmation matrix state', 'حالة مصفوفة التأكيد'))}: ${esc(confirmation.matrix_state)}</p>` : '';
  return `      <section class="market-section" id="regime-research"><div class="market-section-head"><span class="eyebrow">${esc(t('Regime research', 'أبحاث النظام'))}</span><h2>${esc(t('One research read of the environment', 'قراءة بحثية واحدة للبيئة'))}</h2></div>
        <p class="market-copy">${esc(t('The regime, its transition, narrative, confirmation, contradiction and leadership — described from observed intelligence, not predicted.', 'النظام وتحوّله والسردية والتأكيد والتناقض والقيادة — موصوفة من استخبارات مرصودة، وليست متوقّعة.'))}</p>
        ${matrix}
        <div class="market-grid three">
${chips}
        </div></section>`;
}

function buildHead(ar, surf, depth) {
  const rel = '../'.repeat(depth);
  const slugPath = surf.slug ? `research/${surf.slug}/` : 'research/';
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const title = `${ar ? surf.title_ar : surf.title_en} | TradeAlphaAI`;
  const desc = ar ? surf.lead_ar : surf.lead_en;
  const css = ['/css/global-header.css', `${rel}styles.css`, `${rel}landing.css`, `${rel}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'مركز الأبحاث' : 'Research Hub', item: ar ? 'https://www.tradealphaai.com/ar/research/' : 'https://www.tradealphaai.com/research/' },
      { '@type': 'ListItem', position: 3, name: ar ? surf.title_ar : surf.title_en, item: url },
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

function buildMain(ar, surf) {
  const t = (en, arT) => (ar ? arT : en);
  let body;
  if (surf.kind === 'hub') body = hubBody(ar, t);
  else if (surf.kind === 'feed') body = feedBody(ar, t);
  else body = regimeBody(ar, t);
  const crumb = surf.slug
    ? `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/research/' : '/research/'}">${esc(t('Research Hub', 'مركز الأبحاث'))}</a><span>/</span><span>${esc(ar ? surf.title_ar : surf.title_en)}</span></nav>`
    : `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Research Hub', 'مركز الأبحاث'))}</span></nav>`;
  return `  <main class="market-shell">
    <div class="wrap">
      ${crumb}
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('Institutional Research Network', 'شبكة الأبحاث المؤسسية'))}</span><h1>${esc(ar ? surf.title_ar : surf.title_en)}</h1><p class="market-lead">${esc(ar ? surf.lead_ar : surf.lead_en)}</p></div></section>
${body}
      <section class="market-section" id="research-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI research presents institutional interpretation of observed conditions only, composed from existing intelligence. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تقدم أبحاث TradeAlphaAI تفسيراً مؤسسياً للظروف المرصودة فقط، مركّبة من الاستخبارات القائمة. وهي ليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
}

function generate(ar, surf) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const slugPath = surf.slug ? `research/${surf.slug}/` : 'research/';
  const depth = (ar ? 1 : 0) + slugPath.split('/').filter(Boolean).length;
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
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${buildHead(ar, surf, depth)}
${bodyTag}${headerBlock}

${buildMain(ar, surf)}
${footer}`;
}

function main() {
  const write = process.argv.includes('--write');
  let count = 0;
  for (const surf of Object.values(SURFACES)) {
    for (const [ar, baseDir] of [[false, surf.dir], [true, `ar/${surf.dir}`]]) {
      const html = generate(ar, surf);
      if (write) { const outPath = path.join(ROOT, baseDir, 'index.html'); fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, html, 'utf8'); count += 1; }
    }
  }
  console.log(write ? `[research-pages] wrote ${count} pages` : '[research-pages] dry-run');
}

if (require.main === module) main();

module.exports = { generate, SURFACES };
