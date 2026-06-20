'use strict';

// Phase 219 CP6 — Account pages.
// /account/ + /account/{watchlists,preferences,alerts,workspace}/ EN+AR.
// Static informational surfaces only — no auth, no forms, no client JS for
// state. Reads from the account-foundation contracts and existing workspace.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

function readJson(p, f = {}) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }

const SURFACES = {
  overview: { rel: 'account/', title_en: 'Account Overview', title_ar: 'نظرة عامة على الحساب',
    desc_en: 'The TradeAlphaAI account-ready foundation — watchlists, preferences, alert contracts, personal workspace state and personalization framework. Accounts are not yet enabled; this surface describes what the platform will support.',
    desc_ar: 'الأساس الجاهز للحسابات في TradeAlphaAI — قوائم المتابعة والتفضيلات وعقود التنبيهات وحالة مساحة العمل الشخصية وإطار التخصيص. لم تُفعَّل الحسابات بعد؛ تصف هذه الصفحة ما ستدعمه المنصة.' },
  watchlists: { rel: 'account/watchlists/', title_en: 'Account Watchlists', title_ar: 'قوائم المتابعة للحساب',
    desc_en: 'Watchlist contracts that future accounts will personalize — personal_watchlists, saved_watchlists, favorite_assets, favorite_sectors, favorite_equities and favorite_etfs. Today the saved watchlists mirror the public workspace.',
    desc_ar: 'عقود قوائم المتابعة التي ستخصّصها الحسابات المستقبلية — قوائم المتابعة الشخصية والمحفوظة، والأصول والقطاعات والأسهم والصناديق المفضلة. اليوم تعكس القوائم المحفوظة مساحة العمل العامة.' },
  preferences: { rel: 'account/preferences/', title_en: 'Account Preferences', title_ar: 'تفضيلات الحساب',
    desc_en: 'Allowed preference enums and defaults — preferred language, homepage, entity type, research view, workspace layout and market focus. Per-user overrides require an account.',
    desc_ar: 'قيم التفضيلات المسموح بها وقيمها الافتراضية — اللغة والصفحة الرئيسية ونوع الكيان وعرض الأبحاث وتخطيط مساحة العمل وتركيز السوق. تحتاج تجاوزات كل مستخدم إلى حساب.' },
  alerts: { rel: 'account/alerts/', title_en: 'Account Alerts', title_ar: 'تنبيهات الحساب',
    desc_en: 'Allowed alert classes and their source artifacts — contracts only, no dispatch. Future Premium features will subscribe to these classes.',
    desc_ar: 'أصناف التنبيهات المسموح بها ومصادرها — عقود فقط دون إرسال. ستشترك ميزات Premium المستقبلية في هذه الأصناف.' },
  workspace: { rel: 'account/workspace/', title_en: 'Account Workspace', title_ar: 'مساحة عمل الحساب',
    desc_en: 'Personal workspace state contract — saved workspaces, monitored entities, followed research, followed regimes and followed watchlists. Future accounts plug into this surface.',
    desc_ar: 'عقد حالة مساحة العمل الشخصية — مساحات العمل المحفوظة والكيانات المرصودة والأبحاث والأنظمة وقوائم المتابعة المُتابَعة. ستتصل الحسابات المستقبلية بهذا السطح.' },
};

function load() {
  return {
    foundation: readJson(J('account-foundation.json'), {}),
    watchlistContracts: readJson(J('watchlist-contracts.json'), {}),
    preferences: readJson(J('preferences.json'), {}),
    alertContracts: readJson(J('alert-contracts.json'), {}),
    workspaceState: readJson(J('workspace-state.json'), {}),
    personalization: readJson(J('personalization.json'), {}),
  };
}

function head(ar, surface, relPath) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${relPath}`;
  const enUrl = `https://www.tradealphaai.com/${relPath}`;
  const arUrl = `https://www.tradealphaai.com/ar/${relPath}`;
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.desc_ar : surface.desc_en;
  const depth = (ar ? 1 : 0) + relPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
      { '@type': 'ListItem', position: 2, name: ar ? 'الحساب' : 'Account', item: ar ? 'https://www.tradealphaai.com/ar/account/' : 'https://www.tradealphaai.com/account/' },
      { '@type': 'ListItem', position: 3, name: ar ? surface.title_ar : surface.title_en, item: url },
    ] } ] };
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
  const h = href ? (ar && !href.startsWith('/ar/') ? '/ar' + href : href) : null;
  const titleHtml = h ? `<a href="${esc(h)}">${esc(title)}</a>` : esc(title);
  return `          <article class="market-card"><span class="market-card-kicker">${esc(kicker)}</span><h3>${titleHtml}</h3>${copy ? `<p class="market-copy">${esc(copy)}</p>` : ''}</article>`;
}

function shell(ar, surface, body, relPath) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({
    locale: lang,
    activePage: 'account',
    arabicHref: `/ar/${relPath}`,
    englishHref: `/${relPath}`,
  });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar, surface, relPath)}
<body>
${header}
  <main class="market-shell" data-account-surface="${esc(surface.rel)}">
    <section class="market-hero">
      <div class="market-hero-copy">
        <span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span>
        <h1>${esc(ar ? surface.title_ar : surface.title_en)}</h1>
        <p>${esc(ar ? surface.desc_ar : surface.desc_en)}</p>
      </div>
    </section>
${body}
    <section class="market-section" id="account-disclaimer">
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Account contracts are foundational only — no authentication, no payments, no live alert dispatch. They describe what future Premium features will sit on, derived from existing intelligence artifacts. Not investment advice.', 'عقود الحساب تأسيسية فقط — لا توجد مصادقة ولا مدفوعات ولا إرسال تنبيهات حيّ. تصف ما ستقوم عليه ميزات Premium المستقبلية، مشتقّة من ملفات الاستخبارات القائمة. ليست نصيحة استثمارية.'))}</p></div>
    </section>
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function overviewBody(ar, data) {
  const f = data.foundation || {};
  const summary = f.contracts || {};
  const sections = [
    ['/account/watchlists/', t(ar, 'Watchlists', 'قوائم المتابعة'), t(ar, `${(summary.watchlists && summary.watchlists.summary && summary.watchlists.summary.saved) || 0} saved watchlists; personal watchlists require an account.`, `${(summary.watchlists && summary.watchlists.summary && summary.watchlists.summary.saved) || 0} قائمة محفوظة؛ تتطلب قوائم المتابعة الشخصية حساباً.`)],
    ['/account/preferences/', t(ar, 'Preferences', 'التفضيلات'), t(ar, `${(summary.preferences && summary.preferences.summary && summary.preferences.summary.defaults) || 0} defaults; overrides require an account.`, `${(summary.preferences && summary.preferences.summary && summary.preferences.summary.defaults) || 0} قيمة افتراضية؛ تتطلب التجاوزات حساباً.`)],
    ['/account/alerts/', t(ar, 'Alerts', 'التنبيهات'), t(ar, `${(summary.alerts && summary.alerts.summary && summary.alerts.summary.classes) || 0} allowed alert classes — contracts only, no dispatch.`, `${(summary.alerts && summary.alerts.summary && summary.alerts.summary.classes) || 0} صنف تنبيهات مسموح به — عقود فقط دون إرسال.`)],
    ['/account/workspace/', t(ar, 'Workspace', 'مساحة العمل'), t(ar, `${(summary.workspace && summary.workspace.summary && summary.workspace.summary.monitored) || 0} monitored entities in the default workspace.`, `${(summary.workspace && summary.workspace.summary && summary.workspace.summary.monitored) || 0} كيان مرصود في مساحة العمل الافتراضية.`)],
  ];
  const cards = sections.map(([href, title, copy]) => card(ar, t(ar, 'Account', 'الحساب'), title, copy, href)).join('\n');
  const governance = (f.governance && Object.entries(f.governance).filter(([, v]) => v === true).map(([k]) => k)) || [];
  return `      <section class="market-section" id="account-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'Foundation status', 'حالة الأساس'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Authentication', 'المصادقة'))}</span><h3>${esc(t(ar, 'disabled', 'معطّلة'))}</h3><p class="market-copy">${esc(t(ar, 'No login providers are wired. Foundation phase only.', 'لم تُوصل أي مزودات تسجيل دخول. مرحلة التأسيس فقط.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'User database', 'قاعدة بيانات المستخدم'))}</span><h3>${esc(t(ar, 'none', 'غير موجودة'))}</h3><p class="market-copy">${esc(t(ar, 'No per-user state is stored or fabricated.', 'لا تُخزَّن أو تُصطنع أي حالة لكل مستخدم.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Billing', 'الفوترة'))}</span><h3>${esc(t(ar, 'none', 'غير موجودة'))}</h3><p class="market-copy">${esc(t(ar, 'No payments, no subscriptions, no premium gating.', 'لا مدفوعات، ولا اشتراكات، ولا حواجز للوصول المميز.'))}</p></article>
        </div></section>
      <section class="market-section" id="account-contracts"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Contracts', 'العقود'))}</span><h2>${esc(t(ar, 'Account-ready surfaces', 'الأسطح الجاهزة للحساب'))}</h2></div>
        <div class="market-grid three">
${cards}
        </div></section>
      <section class="market-section" id="account-governance"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Governance', 'الحوكمة'))}</span><h2>${esc(t(ar, 'Foundation governance flags', 'أعلام حوكمة الأساس'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">${governance.map((g) => `<li>${esc(g.replace(/_/g, ' '))}</li>`).join('')}</ul></div></section>`;
}

function watchlistsBody(ar, data) {
  const wc = data.watchlistContracts || {};
  const saved = (wc.saved_watchlists && wc.saved_watchlists.items) || [];
  const savedHtml = saved.map((w) => card(ar, t(ar, 'Saved watchlist', 'قائمة محفوظة'), `${esc(ar ? w.title_ar : w.title_en)} · ${w.entity_count}`, t(ar, w.thesis_en, w.thesis_ar), w.href)).join('\n');
  return `      <section class="market-section" id="account-watchlists-personal"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Personal', 'شخصية'))}</span><h2>${esc(t(ar, 'Personal watchlists', 'قوائم المتابعة الشخصية'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, (wc.personal_watchlists && wc.personal_watchlists.note_en) || 'Personal watchlists require an account.', (wc.personal_watchlists && wc.personal_watchlists.note_ar) || 'تتطلب قوائم المتابعة الشخصية حساباً.'))}</p></div></section>
      <section class="market-section" id="account-watchlists-saved"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Saved', 'محفوظة'))}</span><h2>${esc(t(ar, 'Saved watchlists (public defaults)', 'قوائم المتابعة المحفوظة (الافتراضات العامة)'))}</h2></div>
        <div class="market-grid three">
${savedHtml || `<p class="market-copy">${esc(t(ar, 'No saved watchlists available.', 'لا توجد قوائم متابعة محفوظة.'))}</p>`}
        </div></section>
      <section class="market-section" id="account-watchlists-favorites"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Favorites', 'المفضّلات'))}</span><h2>${esc(t(ar, 'Favorite shapes', 'هياكل المفضّلات'))}</h2></div>
        <div class="market-grid three">
${['favorite_assets', 'favorite_sectors', 'favorite_equities', 'favorite_etfs'].map((k) => card(ar, t(ar, 'Future shape', 'هيكل مستقبلي'), k, t(ar, `count=${(wc[k] && wc[k].count) || 0} — populated per account.`, `العدد=${(wc[k] && wc[k].count) || 0} — يُملأ لكل حساب.`), null)).join('\n')}
        </div></section>`;
}

function preferencesBody(ar, data) {
  const p = data.preferences || {};
  const enums = p.allowed || {};
  const defaults = p.defaults || {};
  const rows = Object.entries(enums).map(([key, vals]) => `<tr><td>${esc(key)}</td><td>${esc((vals || []).join(' · '))}</td><td><strong>${esc(defaults[key] || '')}</strong></td></tr>`).join('\n');
  return `      <section class="market-section" id="account-preferences-allowed"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Allowed values', 'القيم المسموح بها'))}</span><h2>${esc(t(ar, 'Preference enums', 'قيم التفضيلات'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Preference', 'التفضيل'))}</th><th>${esc(t(ar, 'Allowed', 'المسموح'))}</th><th>${esc(t(ar, 'Default', 'الافتراضي'))}</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="market-section" id="account-preferences-overrides"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Overrides', 'التجاوزات'))}</span><h2>${esc(t(ar, 'Per-user overrides', 'تجاوزات لكل مستخدم'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, (p.overrides && p.overrides.note_en) || 'Per-user overrides require an account.', (p.overrides && p.overrides.note_ar) || 'تتطلب التجاوزات حساباً.'))}</p></div></section>`;
}

function alertsBody(ar, data) {
  const a = data.alertContracts || {};
  const classes = a.classes || {};
  const rows = (a.allowed_classes || []).map((k) => {
    const c = classes[k] || {};
    return `<tr><td>${esc(k)}</td><td>${esc(c.source || '')}</td><td>${esc(ar ? (c.trigger_ar || '') : (c.trigger_en || ''))}</td></tr>`;
  }).join('\n');
  return `      <section class="market-section" id="account-alerts-classes"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Classes', 'الأصناف'))}</span><h2>${esc(t(ar, 'Allowed alert classes', 'أصناف التنبيهات المسموح بها'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Class', 'الصنف'))}</th><th>${esc(t(ar, 'Source artifact', 'الملف المصدر'))}</th><th>${esc(t(ar, 'Trigger', 'المُحفِّز'))}</th></tr></thead><tbody>${rows}</tbody></table></div></section>
      <section class="market-section" id="account-alerts-dispatch"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Dispatch', 'الإرسال'))}</span><h2>${esc(t(ar, 'Dispatch status', 'حالة الإرسال'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, (a.dispatch && a.dispatch.note_en) || 'Dispatch disabled.', (a.dispatch && a.dispatch.note_ar) || 'الإرسال معطّل.'))}</p></div></section>`;
}

function workspaceBody(ar, data) {
  const ws = data.workspaceState || {};
  const saved = (ws.saved_workspaces && ws.saved_workspaces.items) || [];
  const savedHtml = saved.map((w) => card(ar, t(ar, 'Saved workspace', 'مساحة محفوظة'), ar ? w.title_ar : w.title_en, t(ar, `Sections: ${(w.sections || []).join(', ')}`, `الأقسام: ${(w.sections || []).join('، ')}`), ar ? w.href_ar : w.href)).join('\n');
  return `      <section class="market-section" id="account-workspace-saved"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Saved workspaces', 'مساحات العمل المحفوظة'))}</span><h2>${esc(t(ar, 'Default workspace + future saved workspaces', 'مساحة العمل الافتراضية ومساحات العمل المستقبلية'))}</h2></div>
        <div class="market-grid three">
${savedHtml || `<p class="market-copy">${esc(t(ar, 'No saved workspaces available.', 'لا توجد مساحات عمل محفوظة.'))}</p>`}
        </div></section>
      <section class="market-section" id="account-workspace-followed"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Followed surfaces', 'الأسطح المُتابَعة'))}</span><h2>${esc(t(ar, 'Followed research, regimes and watchlists', 'الأبحاث والأنظمة وقوائم المتابعة المُتابَعة'))}</h2></div>
        <div class="market-grid three">
${['followed_research', 'followed_regimes', 'followed_watchlists'].map((k) => card(ar, t(ar, 'Future capability', 'قدرة مستقبلية'), k, t(ar, (ws[k] && ws[k].note_en) || 'Requires an account.', (ws[k] && ws[k].note_ar) || 'يتطلب حساباً.'), null)).join('\n')}
        </div></section>
      <section class="market-section" id="account-workspace-monitored"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Monitored', 'مرصودة'))}</span><h2>${esc(t(ar, 'Monitored entities (default workspace)', 'الكيانات المرصودة (مساحة العمل الافتراضية)'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, `${(ws.monitored_entities && ws.monitored_entities.count) || 0} entities are monitored in the default workspace today. Personal monitored sets require an account.`, `${(ws.monitored_entities && ws.monitored_entities.count) || 0} كيان مرصود في مساحة العمل الافتراضية اليوم. تتطلب المجموعات الشخصية حساباً.`))}</p></div></section>`;
}

function bodyFor(key, ar, data) {
  if (key === 'overview') return overviewBody(ar, data);
  if (key === 'watchlists') return watchlistsBody(ar, data);
  if (key === 'preferences') return preferencesBody(ar, data);
  if (key === 'alerts') return alertsBody(ar, data);
  if (key === 'workspace') return workspaceBody(ar, data);
  return '';
}

function main() {
  const data = load();
  let count = 0;
  for (const [key, surface] of Object.entries(SURFACES)) {
    for (const ar of [false, true]) {
      const html = shell(ar, surface, bodyFor(key, ar, data), surface.rel);
      if (WRITE) {
        const out = path.join(ROOT, ar ? `ar/${surface.rel}` : surface.rel, 'index.html');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, html, 'utf8');
        count += 1;
      }
    }
  }
  console.log(WRITE ? `[account-pages] wrote ${count} pages` : `[account-pages] dry-run ${Object.keys(SURFACES).length * 2} pages`);
}

if (require.main === module) main();

module.exports = { SURFACES, load };
