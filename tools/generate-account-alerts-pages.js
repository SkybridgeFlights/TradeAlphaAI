'use strict';

// Phase 222 (+ later 224) — Account alert subpages.
// /account/alerts/regime/ + /account/alerts/inbox/ EN+AR.

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
  regime: { rel: 'account/alerts/regime/', title_en: 'Regime Change Alerts', title_ar: 'تنبيهات تحوّل النظام',
    desc_en: 'Contract for the first dispatchable alert class — regime_change. Sparsest, highest confidence, lowest blast radius. dispatch is currently DISABLED; this page documents what the live wiring will deliver.',
    desc_ar: 'عقد أول صنف تنبيهات قابل للإرسال — regime_change. الأقل تواتراً والأعلى ثقة والأقل أثراً. الإرسال معطّل حالياً؛ تشرح هذه الصفحة ما سيُقدّمه الربط الحيّ.' },
  inbox: { rel: 'account/alerts/inbox/', title_en: 'Alerts Inbox', title_ar: 'صندوق التنبيهات',
    desc_en: 'In-app inbox surface (no push). Future per-account alerts land here as pull. Empty today.',
    desc_ar: 'سطح صندوق داخل التطبيق (دون دفع). تصل تنبيهات كل حساب المستقبلية هنا كسحب. فارغ اليوم.' },
};

function head(ar, surface, relPath) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${relPath}`;
  const enUrl = `https://www.tradealphaai.com/${relPath}`;
  const arUrl = `https://www.tradealphaai.com/ar/${relPath}`;
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.desc_ar : surface.desc_en;
  const depth = (ar ? 1 : 0) + relPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css', '/css/account-premium.css'];
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${enUrl}" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>`;
}

function shell(ar, surface, body, relPath) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({ locale: lang, activePage: 'account', arabicHref: `/ar/${relPath}`, englishHref: `/${relPath}` });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar, surface, relPath)}
<body>
${header}
  <main class="market-shell">
    <section class="market-hero"><div class="market-hero-copy">
      <span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span>
      <h1>${esc(ar ? surface.title_ar : surface.title_en)}</h1>
      <p>${esc(ar ? surface.desc_ar : surface.desc_en)}</p>
    </div></section>
${body}
    <section class="market-section" id="alerts-disclaimer">
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Alert dispatch is foundation-only in this phase. No message is sent. The existing controlled Telegram pipeline is not touched. Not investment advice.', 'إرسال التنبيهات في مرحلة التأسيس فقط. لا تُرسَل أي رسالة. لا يُمسّ خطّ Telegram المحكوم القائم. ليست نصيحة استثمارية.'))}</p></div>
    </section>
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function regimeBody(ar, data) {
  const d = data.dispatch || {};
  const c = (d.classes && d.classes.regime_change) || {};
  const channels = d.channels || {};
  return `      <section class="market-section" id="alerts-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'Dispatch status', 'حالة الإرسال'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Mode', 'الوضع'))}</span><h3>${esc(d.mode || 'contract')}</h3><p class="market-copy">${esc(t(ar, 'Contract phase — no dispatch.', 'مرحلة العقد — لا إرسال.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Class', 'الصنف'))}</span><h3>${esc(d.primary_class || 'regime_change')}</h3><p class="market-copy">${esc(t(ar, 'Sparsest and highest confidence — first class to ship.', 'الأقل تواتراً والأعلى ثقة — أول صنف يُشحن.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Min confidence', 'الحدّ الأدنى للثقة'))}</span><h3>${esc(c.min_confidence || 'high')}</h3><p class="market-copy">${esc(t(ar, 'Below this threshold the event never becomes an alert.', 'تحت هذه العتبة لا يصبح الحدث تنبيهاً أبداً.'))}</p></article>
        </div></section>
      <section class="market-section" id="alerts-channels"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Channels', 'القنوات'))}</span><h2>${esc(t(ar, 'Allowed channels', 'القنوات المسموح بها'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Channel', 'القناة'))}</th><th>${esc(t(ar, 'Enabled', 'مفعّلة'))}</th><th>${esc(t(ar, 'Rate limit', 'الحدّ الأقصى'))}</th></tr></thead><tbody>
${Object.entries(channels).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.enabled ? 'true' : 'false')}</td><td>${esc(v.rate_limit_per_account || '')}</td></tr>`).join('\n')}
        </tbody></table></div></section>
      <section class="market-section" id="alerts-throttle"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Throttling', 'التحديد'))}</span><h2>${esc(t(ar, 'Per-account throttle', 'تحديد لكل حساب'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${Object.entries(c.throttle || {}).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('\n')}
        </ul></div></section>
      <section class="market-section" id="alerts-payload"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Payload', 'الحمولة'))}</span><h2>${esc(t(ar, 'Payload shape', 'هيكل الحمولة'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Field', 'الحقل'))}</th><th>${esc(t(ar, 'Type / example', 'النوع / المثال'))}</th></tr></thead><tbody>
${Object.entries(c.payload_shape || {}).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v)}</td></tr>`).join('\n')}
        </tbody></table></div></section>`;
}

function inboxBody(ar) {
  return `      <section class="market-section" id="alerts-inbox-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Inbox', 'الصندوق'))}</span><h2>${esc(t(ar, 'In-app inbox surface', 'سطح الصندوق داخل التطبيق'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'The inbox is the pull surface for per-account alerts. It is empty in the foundation phase. Future writes land under data/accounts/<account_id>/alerts-subscriptions.json and surface here via a server render.', 'الصندوق هو سطح السحب لتنبيهات كل حساب. إنه فارغ في مرحلة التأسيس. تصل الكتابات المستقبلية تحت data/accounts/<account_id>/alerts-subscriptions.json وتظهر هنا عبر تصيير من الخادم.'))}</p></div></section>
      <section class="market-section" id="alerts-inbox-empty"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Empty state', 'الحالة الفارغة'))}</span><h2>${esc(t(ar, 'No alerts yet', 'لا توجد تنبيهات بعد'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Until an account exists and at least one alert class subscribes, the inbox stays honestly empty rather than showing placeholder content.', 'حتى وجود حساب واشتراك بصنف تنبيه واحد على الأقل، يبقى الصندوق فارغاً بصدق بدلاً من عرض محتوى نائب.'))}</p></div></section>`;
}

function load() { return { dispatch: readJson(J('alert-dispatch.json'), {}) }; }
function bodyFor(key, ar, data) { if (key === 'regime') return regimeBody(ar, data); if (key === 'inbox') return inboxBody(ar); return ''; }

function main() {
  const data = load();
  let count = 0;
  for (const [key, surface] of Object.entries(SURFACES)) {
    for (const ar of [false, true]) {
      const html = shell(ar, surface, bodyFor(key, ar, data), surface.rel);
      if (WRITE) { const out = path.join(ROOT, ar ? `ar/${surface.rel}` : surface.rel, 'index.html'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html, 'utf8'); count += 1; }
    }
  }
  console.log(WRITE ? `[account-alerts-pages] wrote ${count} pages` : `[account-alerts-pages] dry-run ${Object.keys(SURFACES).length * 2} pages`);
}

if (require.main === module) main();
module.exports = { SURFACES };
