'use strict';

// Phase 218 - static workspace pages.
// Renders the watchlist and monitoring workspace from existing artifacts only.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const J = (name) => path.join(ROOT, 'data', 'intelligence', name);
const WRITE = process.argv.includes('--write');

function readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }
function human(v) { return String(v || 'indeterminate').replace(/_/g, ' '); }
function evidenceText(refs) { return (refs || []).slice(0, 2).map((x) => typeof x === 'string' ? x : `${x.source || 'source'}:${x.field || 'field'}`).join(' · ') || 'artifact evidence'; }

function localHref(ar, href) {
  if (!href) return ar ? '/ar/workspace/' : '/workspace/';
  if (!ar) return href;
  if (href.startsWith('/ar/')) return href;
  return `/ar${href}`;
}

function label(ar, item, enKey = 'title_en', arKey = 'title_ar') {
  return ar ? (item[arKey] || item[enKey] || item.id || item.symbol) : (item[enKey] || item[arKey] || item.id || item.symbol);
}

function load() {
  return {
    workspace: readJson(J('workspace.json'), { watchlists: [], counts: {}, monitoring: {}, regime: {} }),
    watchlists: readJson(J('watchlists.json'), { watchlists: [] }),
    monitoring: readJson(J('watchlist-monitoring.json'), { watchlists: [] }),
    regime: readJson(J('market-regime-dashboard.json'), {}),
    regimeHistory: readJson(J('regime-history.json'), { timeline_entries: [] }),
    researchHub: readJson(J('research-hub.json'), { categories: [] }),
    // Phase 219 CP8 — surface the account-ready contracts on /workspace/.
    accountFoundation: readJson(J('account-foundation.json'), { contracts: {} }),
  };
}

const SURFACES = {
  home: {
    rel: 'workspace/',
    title_en: 'Intelligence Workspace',
    title_ar: 'مساحة المتابعة الاستخباراتية',
    desc_en: 'A monitored workspace for watchlists, research, changes and regime context derived from verified TradeAlphaAI intelligence artifacts.',
    desc_ar: 'مساحة متابعة تربط قوائم المتابعة والأبحاث والتغيرات وسياق النظام اعتماداً على ملفات استخبارات TradeAlphaAI الموثقة.',
  },
  watchlists: {
    rel: 'workspace/watchlists/',
    title_en: 'Workspace Watchlists',
    title_ar: 'قوائم المتابعة',
    desc_en: 'Default institutional watchlists for market core, technology, defensive assets and ETF core monitoring.',
    desc_ar: 'قوائم متابعة مؤسسية لمحور السوق والتكنولوجيا والدفاعيات ومحور الصناديق.',
  },
  monitoring: {
    rel: 'workspace/monitoring/',
    title_en: 'Monitoring Feed',
    title_ar: 'تغذية المتابعة',
    desc_en: 'Latest monitored changes, improvements, deteriorations and regime context for workspace entities.',
    desc_ar: 'أحدث التغيرات المرصودة والتحسن والتدهور وسياق النظام للكيانات داخل مساحة المتابعة.',
  },
  research: {
    rel: 'workspace/research/',
    title_en: 'Watchlist Research',
    title_ar: 'أبحاث قوائم المتابعة',
    desc_en: 'Research paths and entity research links for the monitored watchlist universe.',
    desc_ar: 'مسارات البحث وروابط أبحاث الكيانات داخل نطاق قوائم المتابعة.',
  },
  regime: {
    rel: 'workspace/regime/',
    title_en: 'Regime Monitoring',
    title_ar: 'متابعة النظام',
    desc_en: 'Current regime, confidence, narrative context and history for the workspace.',
    desc_ar: 'النظام الحالي والثقة والسياق السردي والتاريخ الخاص بمساحة المتابعة.',
  },
};

function pageHead(ar, surface, relPath) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${relPath}`;
  const enUrl = `https://www.tradealphaai.com/${relPath}`;
  const arUrl = `https://www.tradealphaai.com/ar/${relPath}`;
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.desc_ar : surface.desc_en;
  const depth = (ar ? 1 : 0) + relPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'مساحة المتابعة' : 'Workspace', item: ar ? 'https://www.tradealphaai.com/ar/workspace/' : 'https://www.tradealphaai.com/workspace/' },
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

function shell(ar, surface, body, relPath) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({
    locale: lang,
    activePage: 'workspace',
    arabicHref: `/ar/${relPath}`,
    englishHref: `/${relPath}`,
  });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${pageHead(ar, surface, relPath)}
<body>
${header}
  <main class="market-shell" data-workspace-surface="${esc(surface.rel)}">
    <section class="market-hero">
      <div class="market-hero-copy">
        <span class="eyebrow">${esc(t(ar, 'Intelligence Workspace', 'مساحة المتابعة الاستخباراتية'))}</span>
        <h1>${esc(ar ? surface.title_ar : surface.title_en)}</h1>
        <p>${esc(ar ? surface.desc_ar : surface.desc_en)}</p>
      </div>
    </section>
${body}
    <section class="market-section" id="workspace-disclaimer">
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Workspace monitoring is descriptive and evidence-backed. It is not investment advice, a recommendation or a trade instruction.', 'متابعة مساحة العمل وصفية ومدعومة بالأدلة. وهي ليست نصيحة استثمارية أو توصية أو تعليمات تداول.'))}</p></div>
    </section>
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function navCards(ar) {
  const items = [
    ['/workspace/watchlists/', t(ar, 'Watchlists', 'قوائم المتابعة'), t(ar, 'Monitored entity groups', 'مجموعات الكيانات المرصودة')],
    ['/workspace/monitoring/', t(ar, 'Monitoring', 'المتابعة'), t(ar, 'Changes, leadership and deterioration', 'التغيرات والقيادة والتدهور')],
    ['/workspace/research/', t(ar, 'Research', 'الأبحاث'), t(ar, 'Research paths for watched entities', 'مسارات بحث للكيانات المتابعة')],
    ['/workspace/regime/', t(ar, 'Regime Monitoring', 'متابعة النظام'), t(ar, 'Current regime and historical context', 'النظام الحالي والسياق التاريخي')],
  ];
  return items.map(([href, title, copy]) => card(ar, t(ar, 'Workspace', 'مساحة المتابعة'), title, copy, href)).join('\n');
}

function card(ar, kicker, title, copy, href) {
  const h = href ? localHref(ar, href) : '';
  return `          <article class="market-card"><span class="market-card-kicker">${esc(kicker)}</span><h3>${h ? `<a href="${esc(h)}">${esc(title)}</a>` : esc(title)}</h3>${copy ? `<p class="market-copy">${esc(copy)}</p>` : ''}</article>`;
}

function entityCard(ar, entity) {
  const title = `${entity.symbol} · ${ar ? entity.name_ar : entity.name_en}`;
  const copy = `${t(ar, 'rank', 'الترتيب')}: ${human(entity.rank_label || entity.ranking?.rank_label)} · ${t(ar, 'direction', 'الاتجاه')}: ${human(entity.direction || entity.ranking?.direction || entity.history?.observed_direction)} · ${t(ar, 'confirmation', 'التأكيد')}: ${human(entity.confirmation || entity.ranking?.confirmation)}`;
  return card(ar, `${entity.type} · ${entity.monitor_state || 'monitored'}`, title, copy, entity.href);
}

function homeBody(ar, data) {
  const counts = data.workspace.counts || {};
  const lists = (data.watchlists.watchlists || []).map((w) => card(ar, t(ar, 'Watchlist', 'قائمة متابعة'), label(ar, w), `${w.entity_count} ${t(ar, 'monitored entities', 'كيانات مرصودة')} · ${ar ? w.thesis_ar : w.thesis_en}`, `/workspace/watchlists/${w.id}/`)).join('\n');
  return `    <section class="market-section" id="workspace-overview">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Workspace', 'مساحة المتابعة'))}</span><h2>${esc(t(ar, 'A monitored layer above existing intelligence', 'طبقة متابعة فوق الاستخبارات القائمة'))}</h2></div>
      <p class="market-copy">${esc(t(ar, `Current workspace tracks ${counts.watchlists || 0} watchlists and ${counts.unique_symbols || 0} unique entities from verified artifacts.`, `تتابع مساحة العمل حالياً ${counts.watchlists || 0} قوائم و${counts.unique_symbols || 0} كياناً فريداً من ملفات موثقة.`))}</p>
      <div class="market-grid three">
${navCards(ar)}
      </div>
    </section>
    <section class="market-section" id="workspace-watchlist-preview">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Watchlists', 'قوائم المتابعة'))}</span><h2>${esc(t(ar, 'Default monitored groups', 'مجموعات المتابعة الافتراضية'))}</h2></div>
      <div class="market-grid three">
${lists}
      </div>
    </section>
    <section class="market-section" id="workspace-account-ready">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Account-ready capabilities', 'قدرات جاهزة للحساب'))}</span><h2>${esc(t(ar, 'Future personal layer', 'الطبقة الشخصية المستقبلية'))}</h2></div>
      <p class="market-copy">${esc(t(ar, 'The platform now exposes account-ready contracts for watchlists, preferences and alerts. Authentication is not yet enabled — these surfaces describe what personal accounts will plug into.', 'تعرض المنصة الآن عقوداً جاهزة للحساب لقوائم المتابعة والتفضيلات والتنبيهات. لم تُفعَّل المصادقة بعد — تصف هذه الأسطح ما ستتصل به الحسابات الشخصية.'))}</p>
      <div class="market-grid three">
${card(ar, t(ar, 'Watchlists', 'قوائم المتابعة'), t(ar, 'Saved + personal watchlists', 'قوائم محفوظة وشخصية'), t(ar, 'Account watchlist contracts — saved defaults are public; personal lists require an account.', 'عقود قوائم المتابعة للحساب — القوائم الافتراضية المحفوظة عامة؛ القوائم الشخصية تحتاج إلى حساب.'), '/account/watchlists/')}
${card(ar, t(ar, 'Preferences', 'التفضيلات'), t(ar, 'Language, homepage, focus', 'اللغة والصفحة الرئيسية والتركيز'), t(ar, 'Allowed preference enums and defaults; per-user overrides require an account.', 'قيم التفضيلات المسموح بها والافتراضية؛ تجاوزات كل مستخدم تحتاج إلى حساب.'), '/account/preferences/')}
${card(ar, t(ar, 'Alerts', 'التنبيهات'), t(ar, 'Contracts, no dispatch', 'عقود، لا إرسال'), t(ar, 'Seven allowed alert classes — observed transitions only, never forecasts or signals.', 'سبعة أصناف تنبيهات مسموح بها — تحوّلات مرصودة فقط، لا توقعات ولا إشارات.'), '/account/alerts/')}
      </div>
    </section>`;
}

function watchlistsBody(ar, data) {
  const rows = (data.watchlists.watchlists || []).map((w) => {
    const entities = (w.entities || []).map((e) => `<li><a href="${esc(localHref(ar, e.href))}">${esc(e.symbol)}</a> · ${esc(e.type)} · ${esc(human(e.ranking?.rank_label))}</li>`).join('\n');
    return `          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Watchlist', 'قائمة متابعة'))}</span><h3><a href="${esc(localHref(ar, `/workspace/watchlists/${w.id}/`))}">${esc(label(ar, w))}</a></h3><p class="market-copy">${esc(ar ? w.thesis_ar : w.thesis_en)}</p><ul class="market-copy">${entities}</ul></article>`;
  }).join('\n');
  return `    <section class="market-section" id="workspace-watchlists">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Watchlists', 'قوائم المتابعة'))}</span><h2>${esc(t(ar, 'Institutional monitoring groups', 'مجموعات متابعة مؤسسية'))}</h2></div>
      <div class="market-grid three">
${rows}
      </div>
    </section>`;
}

function watchlistDetailBody(ar, data, watchlist) {
  const mon = (data.monitoring.watchlists || []).find((w) => w.id === watchlist.id) || { entities: [], latest_changes: [], leadership: [], deterioration: [] };
  const entities = (mon.entities || watchlist.entities || []).map((e) => entityCard(ar, e)).join('\n');
  const changes = (mon.latest_changes || []).slice(0, 8).map((c) => card(ar, c.symbol || c.entity || 'change', ar ? (c.label_ar || c.change_type) : (c.label_en || c.change_type), `${t(ar, 'confidence', 'الثقة')}: ${c.confidence || 'observed'} · ${evidenceText(c.evidence)}`, c.href || '/changes/')).join('\n');
  return `    <section class="market-section" id="workspace-watchlist-detail">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Watchlist detail', 'تفاصيل قائمة المتابعة'))}</span><h2>${esc(label(ar, watchlist))}</h2></div>
      <p class="market-copy">${esc(ar ? watchlist.thesis_ar : watchlist.thesis_en)}</p>
      <div class="market-grid three">
${entities}
      </div>
    </section>
    <section class="market-section" id="workspace-watchlist-changes">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Monitoring', 'المتابعة'))}</span><h2>${esc(t(ar, 'Latest observed changes', 'أحدث التغيرات المرصودة'))}</h2></div>
      <div class="market-grid three">
${changes || card(ar, t(ar, 'Changes', 'التغيرات'), t(ar, 'No recent changes', 'لا توجد تغيرات حديثة'), t(ar, 'The change ledger has no current entry for this watchlist.', 'لا يحتوي سجل التغيرات على إدخال حالي لهذه القائمة.'), '/workspace/monitoring/')}
      </div>
    </section>`;
}

function monitoringBody(ar, data) {
  const watchlists = data.monitoring.watchlists || [];
  const changes = watchlists.flatMap((w) => (w.latest_changes || []).map((c) => ({ ...c, watchlist: ar ? w.title_ar : w.title_en }))).slice(0, 18);
  const leadership = watchlists.flatMap((w) => (w.leadership || []).map((e) => ({ ...e, watchlist: ar ? w.title_ar : w.title_en }))).slice(0, 12);
  const deterioration = watchlists.flatMap((w) => (w.deterioration || []).map((e) => ({ ...e, watchlist: ar ? w.title_ar : w.title_en }))).slice(0, 12);
  const changeCards = changes.map((c) => card(ar, c.watchlist, ar ? (c.label_ar || c.change_type) : (c.label_en || c.change_type), `${c.entity || c.symbol} · ${c.confidence || 'observed'} · ${evidenceText(c.evidence)}`, c.href || '/changes/')).join('\n');
  return `    <section class="market-section" id="workspace-monitoring-feed">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Monitoring', 'المتابعة'))}</span><h2>${esc(t(ar, 'Latest monitored changes', 'أحدث التغيرات المتابعة'))}</h2></div>
      <div class="market-grid three">
${changeCards || card(ar, t(ar, 'Monitoring', 'المتابعة'), t(ar, 'No current monitored changes', 'لا توجد تغيرات مرصودة حالياً'), t(ar, 'The feed remains quiet until existing change artifacts record a new state.', 'تبقى التغذية هادئة حتى تسجل ملفات التغير القائمة حالة جديدة.'), '/changes/')}
      </div>
    </section>
    <section class="market-section" id="workspace-leadership-deterioration">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Watchlist state', 'حالة القوائم'))}</span><h2>${esc(t(ar, 'Leadership and deterioration', 'القيادة والتدهور'))}</h2></div>
      <div class="market-grid two">
        <div class="market-panel"><h3>${esc(t(ar, 'Leadership / improvement', 'القيادة / التحسن'))}</h3><ul class="market-copy">${leadership.map((e) => `<li><a href="${esc(localHref(ar, e.href))}">${esc(e.symbol)}</a> · ${esc(e.watchlist)} · ${esc(human(e.monitor_state))}</li>`).join('\n') || `<li>${esc(t(ar, 'No leadership state recorded', 'لا توجد حالة قيادة مسجلة'))}</li>`}</ul></div>
        <div class="market-panel"><h3>${esc(t(ar, 'Deterioration / watching', 'التدهور / قيد المتابعة'))}</h3><ul class="market-copy">${deterioration.map((e) => `<li><a href="${esc(localHref(ar, e.href))}">${esc(e.symbol)}</a> · ${esc(e.watchlist)} · ${esc(human(e.monitor_state))}</li>`).join('\n') || `<li>${esc(t(ar, 'No deterioration state recorded', 'لا توجد حالة تدهور مسجلة'))}</li>`}</ul></div>
      </div>
    </section>`;
}

function researchBody(ar, data) {
  const entities = (data.watchlists.watchlists || []).flatMap((w) => (w.entities || []).map((e) => ({ ...e, watchlist: label(ar, w) })));
  const unique = [...new Map(entities.map((e) => [`${e.type}:${e.symbol}`, e])).values()];
  const cards = unique.map((e) => card(ar, `${e.type} · ${e.watchlist}`, ar ? e.name_ar : e.name_en, `${t(ar, 'Research path', 'مسار البحث')}: ${e.symbol} · ${evidenceText(e.evidence_refs)}`, e.research_href)).join('\n');
  const hub = (data.researchHub.categories || []).slice(0, 6).map((c) => card(ar, t(ar, 'Research hub', 'مركز الأبحاث'), label(ar, c), ar ? c.summary_ar : c.summary_en, (c.items || [])[0]?.href || '/research/')).join('\n');
  return `    <section class="market-section" id="workspace-research-entities">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Research', 'الأبحاث'))}</span><h2>${esc(t(ar, 'Research paths for monitored entities', 'مسارات بحث للكيانات المتابعة'))}</h2></div>
      <div class="market-grid three">
${cards}
      </div>
    </section>
    <section class="market-section" id="workspace-research-hub">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Research graph', 'مخطط الأبحاث'))}</span><h2>${esc(t(ar, 'Related research surfaces', 'أسطح بحث مرتبطة'))}</h2></div>
      <div class="market-grid three">
${hub}
      </div>
    </section>`;
}

function regimeBody(ar, data) {
  const r = data.regime || {};
  const hist = (data.regimeHistory.timeline_entries || []).slice(-6).reverse();
  const cards = [
    [t(ar, 'Current regime', 'النظام الحالي'), ar ? r.current_regime?.label_ar : r.current_regime?.label_en, 'current_regime'],
    [t(ar, 'Confidence', 'الثقة'), ar ? r.confidence_band?.label_ar : r.confidence_band?.label_en, 'confidence_band'],
    [t(ar, 'Risk state', 'حالة المخاطر'), ar ? r.risk_state?.label_ar : r.risk_state?.label_en, 'risk_state'],
    [t(ar, 'Dollar state', 'حالة الدولار'), ar ? r.dollar_state?.label_ar : r.dollar_state?.label_en, 'dollar_state'],
    [t(ar, 'Yield state', 'حالة العوائد'), ar ? r.yield_state?.label_ar : r.yield_state?.label_en, 'yield_state'],
    [t(ar, 'Volatility state', 'حالة التقلب'), ar ? r.volatility_state?.label_ar : r.volatility_state?.label_en, 'volatility_state'],
  ].map(([title, value, key]) => card(ar, t(ar, 'Regime', 'النظام'), title, `${value || 'indeterminate'} · ${evidenceText((r[key] || {}).evidence_refs)}`, '/market-regime/')).join('\n');
  const timeline = hist.map((x) => `<li><strong>${esc(x.date || '')}</strong> · ${esc(ar ? (x.regime_state_ar || x.regime_state) : (x.regime_state_en || x.regime_state))} · ${esc(ar ? (x.transition_marker_ar || x.transition_marker) : (x.transition_marker_en || x.transition_marker))}</li>`).join('\n');
  return `    <section class="market-section" id="workspace-regime-current">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Regime monitoring', 'متابعة النظام'))}</span><h2>${esc(t(ar, 'Current regime context', 'سياق النظام الحالي'))}</h2></div>
      <div class="market-grid three">
${cards}
      </div>
    </section>
    <section class="market-section" id="workspace-regime-history">
      <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'History', 'التاريخ'))}</span><h2>${esc(t(ar, 'Recent regime timeline', 'الخط الزمني الأخير للنظام'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">${timeline || `<li>${esc(t(ar, 'No prior regime timeline is available.', 'لا يوجد خط زمني سابق للنظام حالياً.'))}</li>`}</ul></div>
    </section>`;
}

function writePage(rel, html) {
  const file = path.join(ROOT, rel, 'index.html');
  if (WRITE) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html, 'utf8');
  }
  return file;
}

function renderSurface(ar, surface, body) {
  const relPath = surface.rel;
  return shell(ar, surface, body, relPath);
}

function main() {
  const data = load();
  const outputs = [];
  for (const ar of [false, true]) {
    const prefix = ar ? 'ar/' : '';
    outputs.push(writePage(`${prefix}${SURFACES.home.rel}`, renderSurface(ar, SURFACES.home, homeBody(ar, data))));
    outputs.push(writePage(`${prefix}${SURFACES.watchlists.rel}`, renderSurface(ar, SURFACES.watchlists, watchlistsBody(ar, data))));
    outputs.push(writePage(`${prefix}${SURFACES.monitoring.rel}`, renderSurface(ar, SURFACES.monitoring, monitoringBody(ar, data))));
    outputs.push(writePage(`${prefix}${SURFACES.research.rel}`, renderSurface(ar, SURFACES.research, researchBody(ar, data))));
    outputs.push(writePage(`${prefix}${SURFACES.regime.rel}`, renderSurface(ar, SURFACES.regime, regimeBody(ar, data))));
    for (const w of data.watchlists.watchlists || []) {
      const surface = {
        rel: `workspace/watchlists/${w.id}/`,
        title_en: `${w.title_en} Watchlist`,
        title_ar: `${w.title_ar} - قائمة متابعة`,
        desc_en: w.thesis_en,
        desc_ar: w.thesis_ar,
      };
      outputs.push(writePage(`${prefix}${surface.rel}`, renderSurface(ar, surface, watchlistDetailBody(ar, data, w))));
    }
  }
  console.log(`[workspace-pages] ${WRITE ? 'wrote' : 'prepared'} ${outputs.length} pages`);
}

if (require.main === module) main();

module.exports = { load, localHref };
