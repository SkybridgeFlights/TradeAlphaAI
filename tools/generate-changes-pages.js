'use strict';

// Phase 216 CP3+CP4+CP5+CP6 — Changes Hub pages.
//   /changes/                  hub (latest + significant + counts)
//   /changes/assets/           category — asset events
//   /changes/sectors/          category — sector events
//   /changes/equities/         category — equity events
//   /changes/etfs/             category — ETF events
//   /changes/regime/           regime change center
//   /changes/history/          chronological change timeline
// + AR equivalents under /ar/changes/...
// Clones the market-outlook header, bilingual, RTL on AR, depth-aware css.
// All content composed from data/intelligence/change-events.json +
// change-classifications.json + change-timeline.json + regime-history +
// market-narrative. No fabricated events, no signals, no forecasts.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

function readJson(p, f = {}) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function arHref(ar, href) { if (!href) return href; return (ar ? '/ar' : '') + href; }

const COLOR = {
  improving: '#1f6f5c', stable: '#46505f', weakening: '#b58b56',
  deteriorating: '#b5523f', leadership_gain: '#2f8f76', leadership_loss: '#c2703c',
  confirmation_gain: '#5a8f7a', confirmation_loss: '#b58b56',
  regime_shift: '#3a4250', narrative_shift: '#46505f',
};

const SURFACES = [
  { slug: '', kind: 'hub', dir: 'changes', title_en: 'Changes Hub', title_ar: 'مركز التغيّرات',
    lead_en: 'Latest, most significant and per-category intelligence changes — composed from existing change-events, leadership, ranking history and regime intelligence. Educational context, not signals.',
    lead_ar: 'أحدث التغيّرات وأكثرها أهمية حسب الفئة — مركّبة من أحداث التغيير والقيادة وتاريخ الترتيب واستخبارات النظام القائمة. سياق تعليمي وليس إشارات.' },
  { slug: 'assets', kind: 'category', dir: 'changes/assets', category: 'asset', title_en: 'Asset Changes', title_ar: 'تغيّرات الأصول',
    lead_en: 'Per-asset change events derived from observed asset-history and leadership data. Each event carries a class, confidence and evidence.',
    lead_ar: 'أحداث تغيّر لكل أصل مشتقّة من تاريخ الأصل وبيانات القيادة المرصودة. يحمل كل حدث صنفاً وثقة وأدلة.' },
  { slug: 'sectors', kind: 'category', dir: 'changes/sectors', category: 'sector', title_en: 'Sector Changes', title_ar: 'تغيّرات القطاعات',
    lead_en: 'Per-sector change events derived from observed sector-history and leadership data.',
    lead_ar: 'أحداث تغيّر لكل قطاع مشتقّة من تاريخ القطاع وبيانات القيادة المرصودة.' },
  { slug: 'equities', kind: 'category', dir: 'changes/equities', category: 'equity', title_en: 'Equity Changes', title_ar: 'تغيّرات الأسهم',
    lead_en: 'Per-equity change events derived from observed equity-history and leadership data.',
    lead_ar: 'أحداث تغيّر لكل سهم مشتقّة من تاريخ السهم وبيانات القيادة المرصودة.' },
  { slug: 'etfs', kind: 'category', dir: 'changes/etfs', category: 'etf', title_en: 'ETF Changes', title_ar: 'تغيّرات صناديق المؤشرات',
    lead_en: 'Per-ETF change events derived from intraseries window trends + the append-only ETF snapshot ledger.',
    lead_ar: 'أحداث تغيّر لكل صندوق مشتقّة من اتجاهات النوافذ الزمنية وسجل لقطات الصناديق التراكمي.' },
  { slug: 'regime', kind: 'regime', dir: 'changes/regime', title_en: 'Regime Change Center', title_ar: 'مركز تحوّلات النظام',
    lead_en: 'Current regime, prior regime, real transitions from the regime history ledger, plus confirmation/contradiction and narrative context. No forecasts.',
    lead_ar: 'النظام الحالي والسابق والتحوّلات الحقيقية من سجل النظام، إضافة إلى التأكيد/التناقض وسياق السردية. دون توقعات.' },
  { slug: 'history', kind: 'history', dir: 'changes/history', title_en: 'Change Timeline', title_ar: 'الجدول الزمني للتغيّرات',
    lead_en: 'Chronological change stream — every recorded change event with timestamp and evidence. Only from real history.',
    lead_ar: 'تدفّق التغيّرات الزمني — كل حدث مسجّل بزمن ودليل. من تاريخ حقيقي فقط.' },
];

function loadAll() {
  return {
    events: readJson(J('change-events.json'), { events: [] }),
    classifications: readJson(J('change-classifications.json'), { classes: {} }),
    timeline: readJson(J('change-timeline.json'), { entries: [] }),
    regimeHistory: readJson(J('regime-history.json'), { timeline_entries: [], transition_history: [] }),
    regimeDashboard: readJson(J('market-regime-dashboard.json'), {}),
    regimeTransitions: readJson(J('regime-transitions.json'), {}),
    narrative: readJson(J('market-narrative.json'), {}),
    confirmation: readJson(J('confirmation-matrix.json'), {}),
  };
}

function eventCard(ev, ar) {
  const t = (en, arT) => (ar ? arT : en);
  const kicker = t(ev.label_en || ev.change_type, ev.label_ar || ev.change_type);
  const conf = ev.confidence_en ? `${t('confidence', 'الثقة')}: ${ar ? ev.confidence_ar : ev.confidence_en}` : '';
  const time = ev.timestamp ? new Date(ev.timestamp).toISOString().slice(0, 10) : '';
  const title = ev.entity + (ev.entity_type ? ' · ' + ev.entity_type : '');
  const href = ev.href || ev.research_href || null;
  const evidenceLine = (ev.evidence || []).slice(0, 2).map((e) => esc(e)).join(' · ');
  const color = COLOR[ev.change_type] || '#3a4250';
  const titleHtml = href ? `<a href="${esc(arHref(ar, href))}">${esc(title)}</a>` : esc(title);
  return `          <article class="market-card" style="border-inline-start:4px solid ${esc(color)}"><span class="market-card-kicker">${esc(kicker)}${time ? ' · ' + esc(time) : ''}</span><h3>${titleHtml}</h3><p class="market-copy">${evidenceLine}${conf ? ' · ' + esc(conf) : ''}</p></article>`;
}

function summaryCards(data, ar) {
  const t = (en, arT) => (ar ? arT : en);
  const counts = data.classifications.counts || {};
  const tiles = [
    ['improving', t('Improving', 'يتحسّن')],
    ['weakening', t('Weakening', 'يضعف')],
    ['deteriorating', t('Deteriorating', 'يتدهور')],
    ['stable', t('Stable', 'مستقر')],
    ['leadership_gain', t('Leadership gain', 'اكتساب قيادة')],
    ['leadership_loss', t('Leadership loss', 'فقدان قيادة')],
    ['regime_shift', t('Regime shifts', 'تحوّلات النظام')],
    ['narrative_shift', t('Narrative shifts', 'تحوّلات السردية')],
  ];
  return tiles.map(([k, label]) => `          <article class="market-card" style="border-inline-start:4px solid ${COLOR[k] || '#3a4250'}"><span class="market-card-kicker">${esc(label)}</span><h3>${esc(counts[k] || 0)}</h3></article>`).join('\n');
}

function hubBody(ar, data) {
  const t = (en, arT) => (ar ? arT : en);
  const events = data.events.events || [];
  const significantIds = new Set(data.events.significant || []);
  const significant = events.filter((e) => significantIds.has(e.id)).slice(0, 8);
  const latest = events.slice(0, 10);
  return `      <section class="market-section" id="changes-summary"><div class="market-section-head"><span class="eyebrow">${esc(t('Summary', 'الملخص'))}</span><h2>${esc(t('Change classification counts', 'إحصاءات تصنيف التغيير'))}</h2></div>
        <p class="market-copy">${esc(t('Counts are observed classifications across the closed allowed set; empty buckets remain honestly empty.', 'الإحصاءات تصنيفات مرصودة ضمن المجموعة المغلقة المسموح بها؛ تبقى الفئات الفارغة فارغة بصدق.'))}</p>
        <div class="market-grid three">
${summaryCards(data, ar)}
        </div></section>
      <section class="market-section" id="changes-significant"><div class="market-section-head"><span class="eyebrow">${esc(t('Most significant', 'الأكثر أهمية'))}</span><h2>${esc(t('Top observed changes right now', 'أبرز التغيّرات المرصودة الآن'))}</h2></div>
        <div class="market-grid three">
${significant.map((e) => eventCard(e, ar)).join('\n') || `          <p class="market-copy">${esc(t('No significant changes recorded yet.', 'لا توجد تغيّرات مهمة مسجّلة بعد.'))}</p>`}
        </div></section>
      <section class="market-section" id="changes-latest"><div class="market-section-head"><span class="eyebrow">${esc(t('Latest', 'الأحدث'))}</span><h2>${esc(t('Latest change events', 'أحدث أحداث التغيير'))}</h2></div>
        <div class="market-grid three">
${latest.map((e) => eventCard(e, ar)).join('\n')}
        </div>
        <p class="market-copy"><a href="${ar ? '/ar/changes/history/' : '/changes/history/'}">${esc(t('Open the full change timeline', 'افتح الجدول الزمني الكامل'))}</a></p></section>
      <section class="market-section" id="changes-paths"><div class="market-section-head"><span class="eyebrow">${esc(t('Browse by category', 'تصفح حسب الفئة'))}</span><h2>${esc(t('Per-category change centers', 'مراكز التغيير لكل فئة'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card" style="border-inline-start:4px solid #2f8f76"><span class="market-card-kicker">${esc(t('Assets', 'الأصول'))}</span><h3><a href="${ar ? '/ar/changes/assets/' : '/changes/assets/'}">${esc(t('Asset Changes', 'تغيّرات الأصول'))}</a></h3></article>
          <article class="market-card" style="border-inline-start:4px solid #5a8f7a"><span class="market-card-kicker">${esc(t('Sectors', 'القطاعات'))}</span><h3><a href="${ar ? '/ar/changes/sectors/' : '/changes/sectors/'}">${esc(t('Sector Changes', 'تغيّرات القطاعات'))}</a></h3></article>
          <article class="market-card" style="border-inline-start:4px solid #b58b56"><span class="market-card-kicker">${esc(t('Equities', 'الأسهم'))}</span><h3><a href="${ar ? '/ar/changes/equities/' : '/changes/equities/'}">${esc(t('Equity Changes', 'تغيّرات الأسهم'))}</a></h3></article>
          <article class="market-card" style="border-inline-start:4px solid #46505f"><span class="market-card-kicker">${esc(t('ETFs', 'صناديق المؤشرات'))}</span><h3><a href="${ar ? '/ar/changes/etfs/' : '/changes/etfs/'}">${esc(t('ETF Changes', 'تغيّرات صناديق المؤشرات'))}</a></h3></article>
          <article class="market-card" style="border-inline-start:4px solid #3a4250"><span class="market-card-kicker">${esc(t('Regime', 'النظام'))}</span><h3><a href="${ar ? '/ar/changes/regime/' : '/changes/regime/'}">${esc(t('Regime Change Center', 'مركز تحوّلات النظام'))}</a></h3></article>
          <article class="market-card" style="border-inline-start:4px solid #46505f"><span class="market-card-kicker">${esc(t('Timeline', 'الجدول الزمني'))}</span><h3><a href="${ar ? '/ar/changes/history/' : '/changes/history/'}">${esc(t('Change Timeline', 'الجدول الزمني للتغيّرات'))}</a></h3></article>
        </div></section>`;
}

function categoryBody(ar, data, category) {
  const t = (en, arT) => (ar ? arT : en);
  const events = (data.events.events || []).filter((e) => e.entity_type === category);
  return `      <section class="market-section" id="changes-category"><div class="market-section-head"><span class="eyebrow">${esc(category)}</span><h2>${esc(t(category + ' change events', 'أحداث تغيير ' + category))}</h2></div>
        <p class="market-copy">${esc(t('Total events for this category: ' + events.length + '. Empty events list means no determinate change was observed for this category yet.', 'عدد الأحداث الإجمالي لهذه الفئة: ' + events.length + '. القائمة الفارغة تعني عدم رصد تغيير حاسم لهذه الفئة بعد.'))}</p>
        <div class="market-grid three">
${events.length ? events.map((e) => eventCard(e, ar)).join('\n') : `          <p class="market-copy">${esc(t('No events observed.', 'لا توجد أحداث مرصودة.'))}</p>`}
        </div></section>
      <section class="market-section" id="changes-other"><div class="market-section-head"><span class="eyebrow">${esc(t('Other categories', 'فئات أخرى'))}</span><h2>${esc(t('Open other category centers', 'افتح مراكز الفئات الأخرى'))}</h2></div><div class="market-grid three">
${['assets', 'sectors', 'equities', 'etfs'].filter((c) => c !== category + 's').slice(0, 4).map((c) => `          <article class="market-card"><h3><a href="${ar ? '/ar/changes/' + c + '/' : '/changes/' + c + '/'}">${esc(c)}</a></h3></article>`).join('\n')}
        </div></section>`;
}

function regimeBody(ar, data) {
  const t = (en, arT) => (ar ? arT : en);
  const current = (data.regimeDashboard && data.regimeDashboard.current_regime) || {};
  const transitions = (data.regimeHistory.transition_history || []).slice(-5).reverse();
  const timeline = (data.regimeHistory.timeline_entries || []).slice(-8).reverse();
  const narrative = data.narrative && data.narrative.dominant_story;
  const confirmationCounts = (data.confirmation && data.confirmation.classification_counts) || {};
  const transitionState = data.regimeTransitions && data.regimeTransitions.transition_state;
  return `      <section class="market-section" id="changes-regime-current"><div class="market-section-head"><span class="eyebrow">${esc(t('Current regime', 'النظام الحالي'))}</span><h2>${esc(t('Where the market is now', 'أين السوق الآن'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card" style="border-inline-start:4px solid #1f6f5c"><span class="market-card-kicker">${esc(t('Current regime', 'النظام الحالي'))}</span><h3>${esc((ar ? current.label_ar : current.label_en) || current.state || (ar ? 'غير محدد' : 'indeterminate'))}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Transition state', 'حالة التحوّل'))}</span><h3>${esc(transitionState || (ar ? 'مستقر' : 'stable'))}</h3></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Dominant narrative', 'السردية المهيمنة'))}</span><h3>${esc((narrative && (ar ? narrative.label_ar : narrative.label_en)) || (ar ? 'غير محدد' : 'indeterminate'))}</h3></article>
        </div></section>
      <section class="market-section" id="changes-regime-transitions"><div class="market-section-head"><span class="eyebrow">${esc(t('Recorded transitions', 'التحوّلات المسجّلة'))}</span><h2>${esc(t('Regime transitions in the ledger', 'تحوّلات النظام في السجل'))}</h2></div>
        <div class="market-grid three">
${transitions.length ? transitions.map((tr) => `          <article class="market-card"><span class="market-card-kicker">${esc(tr.date || '')}</span><h3>${esc((tr.from_state || (ar ? 'بدون سابق' : 'no_prior')) + ' → ' + (tr.to_state || ''))}</h3><p class="market-copy">${esc((tr.evidence || []).slice(0, 2).join(' · '))}</p></article>`).join('\n') : `          <p class="market-copy">${esc(t('No transitions recorded yet.', 'لا توجد تحوّلات مسجّلة بعد.'))}</p>`}
        </div></section>
      <section class="market-section" id="changes-regime-timeline"><div class="market-section-head"><span class="eyebrow">${esc(t('Regime timeline', 'الجدول الزمني للنظام'))}</span><h2>${esc(t('Regime ledger entries', 'سجل النظام'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${timeline.map((e) => `<li><strong>${esc(e.date)}</strong> · ${esc(ar ? (e.regime_state_ar || e.regime_state) : (e.regime_state_en || e.regime_state))} · ${esc(ar ? (e.transition_marker_ar || e.transition_marker) : (e.transition_marker_en || e.transition_marker))}</li>`).join('\n')}
        </ul></div></section>
      <section class="market-section" id="changes-regime-confirmation"><div class="market-section-head"><span class="eyebrow">${esc(t('Confirmation matrix', 'مصفوفة التأكيد'))}</span><h2>${esc(t('Confirmation versus contradiction', 'التأكيد مقابل التناقض'))}</h2></div>
        <div class="market-grid three">
${Object.keys(confirmationCounts).slice(0, 6).map((k) => `          <article class="market-card"><span class="market-card-kicker">${esc(k)}</span><h3>${esc(confirmationCounts[k])}</h3></article>`).join('\n') || `          <p class="market-copy">${esc(t('Confirmation counts not available.', 'إحصاءات التأكيد غير متاحة.'))}</p>`}
        </div>
        <p class="market-copy"><a href="${ar ? '/ar/market-regime/' : '/market-regime/'}">${esc(t('Open the Market Regime Command Center', 'افتح مركز قيادة نظام السوق'))}</a> · <a href="${ar ? '/ar/research/regime/' : '/research/regime/'}">${esc(t('Regime research center', 'مركز أبحاث النظام'))}</a></p></section>`;
}

function historyBody(ar, data) {
  const t = (en, arT) => (ar ? arT : en);
  const entries = (data.timeline && data.timeline.entries) || [];
  return `      <section class="market-section" id="changes-timeline-summary"><div class="market-section-head"><span class="eyebrow">${esc(t('Timeline summary', 'ملخص الجدول الزمني'))}</span><h2>${esc(t('Recorded change stream', 'تدفّق التغيّرات المسجّل'))}</h2></div>
        <p class="market-copy">${esc(t('Total recorded entries: ' + entries.length + '. The timeline only carries real events derived from the existing history ledgers.', 'إجمالي الإدخالات المسجلة: ' + entries.length + '. يحمل الجدول الأحداث الحقيقية المشتقّة من سجلات التاريخ القائمة فقط.'))}</p></section>
      <section class="market-section" id="changes-timeline-stream"><div class="market-section-head"><span class="eyebrow">${esc(t('Chronological stream', 'تدفّق زمني'))}</span><h2>${esc(t('Most recent first', 'الأحدث أولاً'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${entries.slice(0, 80).map((e) => `<li><strong>${esc(e.timestamp ? new Date(e.timestamp).toISOString().slice(0, 10) : '')}</strong> · ${esc((e.entity_type || '') + ': ' + (e.entity || ''))} → ${esc(e.label_en || e.change_type)} ${e.href ? '<a href="' + esc(arHref(ar, e.href)) + '">→</a>' : ''}</li>`).join('\n') || `<li>${esc(t('No entries recorded yet.', 'لا توجد إدخالات مسجّلة بعد.'))}</li>`}
        </ul></div>
        <p class="market-copy"><a href="${ar ? '/ar/changes/' : '/changes/'}">${esc(t('Back to Changes Hub', 'العودة إلى مركز التغيّرات'))}</a></p></section>`;
}

function buildHead(ar, surf, depth) {
  const rel = '../'.repeat(depth);
  const slugPath = surf.slug ? `changes/${surf.slug}/` : 'changes/';
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const title = `${ar ? surf.title_ar : surf.title_en} | TradeAlphaAI`;
  const desc = ar ? surf.lead_ar : surf.lead_en;
  const css = ['/css/global-header.css', `${rel}styles.css`, `${rel}landing.css`, `${rel}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'مركز التغيّرات' : 'Changes Hub', item: ar ? 'https://www.tradealphaai.com/ar/changes/' : 'https://www.tradealphaai.com/changes/' },
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

function buildMain(ar, surf, data) {
  const t = (en, arT) => (ar ? arT : en);
  let body;
  if (surf.kind === 'hub') body = hubBody(ar, data);
  else if (surf.kind === 'category') body = categoryBody(ar, data, surf.category);
  else if (surf.kind === 'regime') body = regimeBody(ar, data);
  else body = historyBody(ar, data);
  const crumb = surf.slug
    ? `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/changes/' : '/changes/'}">${esc(t('Changes Hub', 'مركز التغيّرات'))}</a><span>/</span><span>${esc(ar ? surf.title_ar : surf.title_en)}</span></nav>`
    : `<nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><span>${esc(t('Changes Hub', 'مركز التغيّرات'))}</span></nav>`;
  return `  <main class="market-shell">
    <div class="wrap">
      ${crumb}
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('Change Intelligence', 'استخبارات التغيير'))}</span><h1>${esc(ar ? surf.title_ar : surf.title_en)}</h1><p class="market-lead">${esc(ar ? surf.lead_ar : surf.lead_en)}</p></div></section>
${body}
      <section class="market-section" id="changes-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('TradeAlphaAI change intelligence describes observed transitions composed from existing institutional intelligence. It is not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice.', 'تصف استخبارات التغيير في TradeAlphaAI التحوّلات المرصودة المركّبة من الاستخبارات المؤسسية القائمة. وهي ليست تحليل تداول فنياً أو إشارات أو أهدافاً سعرية أو توقعات أو توصيات أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
}

function generate(ar, surf, data) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const slugPath = surf.slug ? `changes/${surf.slug}/` : 'changes/';
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

${buildMain(ar, surf, data)}
${footer}`;
}

function main() {
  const data = loadAll();
  let count = 0;
  for (const surf of SURFACES) {
    for (const [ar, baseDir] of [[false, surf.dir], [true, `ar/${surf.dir}`]]) {
      const html = generate(ar, surf, data);
      if (WRITE) { const out = path.join(ROOT, baseDir, 'index.html'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html, 'utf8'); count += 1; }
    }
  }
  console.log(WRITE ? `[changes-pages] wrote ${count} pages` : `[changes-pages] dry-run ${SURFACES.length * 2} pages`);
}

if (require.main === module) main();

module.exports = { generate, SURFACES, loadAll };
