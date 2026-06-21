'use strict';

// Phase 227 — /account/mobile/ EN+AR.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const REL = 'account/mobile/';

function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }

function head(ar) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${REL}`;
  const title = `${ar ? 'تطبيق الجوال (PWA)' : 'Mobile App (PWA)'} | TradeAlphaAI`;
  const desc = ar ? 'تطبيق الويب التقدّمي (PWA) — تركيب من الشاشة الرئيسية وعمل بدون اتصال وعقد إشعارات الدفع. الإشعارات في مرحلة العقد فقط.' : 'Progressive Web App — install to home screen, offline shell, push notification contract. Push is contract-only.';
  const depth = (ar ? 1 : 0) + REL.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css', '/css/account-premium.css'];
  return `<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/${REL}" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/${REL}" />
  <link rel="manifest" href="/manifest.json" />
  <meta name="theme-color" content="#1f6f5c" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>`;
}

function body(ar) {
  return `    <section class="market-section" id="mobile-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'PWA status', 'حالة PWA'))}</h2></div>
      <div class="market-grid three">
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Manifest', 'البيان'))}</span><h3>${esc(t(ar, 'installed', 'مُثبَّت'))}</h3><p class="market-copy">${esc(t(ar, '/manifest.json declares standalone display, theme + 4 shortcuts.', '/manifest.json يعلن العرض المستقل والسمة و4 اختصارات.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Service worker', 'عامل الخدمة'))}</span><h3>${esc(t(ar, 'registered', 'مسجَّل'))}</h3><p class="market-copy">${esc(t(ar, '/sw.js caches the core nav pages on install + offline-fallback on navigate.', '/sw.js يخزّن صفحات التصفّح الرئيسية عند التثبيت + احتياطي بدون اتصال عند التنقّل.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Push', 'الإشعارات'))}</span><h3>${esc(t(ar, 'contract only', 'عقد فقط'))}</h3><p class="market-copy">${esc(t(ar, 'No subscription registered today. Future opt-in gesture will activate push.', 'لا اشتراك مسجَّل اليوم. ستفعّل لفتة الموافقة المستقبلية الإشعارات.'))}</p></article>
      </div></section>
    <section class="market-section" id="mobile-install"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Install', 'التثبيت'))}</span><h2>${esc(t(ar, 'Install to home screen', 'ثبّت على الشاشة الرئيسية'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">
        <li>${esc(t(ar, 'iOS Safari: Share → Add to Home Screen.', 'iOS Safari: شارك → أضف إلى الشاشة الرئيسية.'))}</li>
        <li>${esc(t(ar, 'Android Chrome: ⋮ menu → Install app.', 'Android Chrome: قائمة ⋮ → تثبيت التطبيق.'))}</li>
        <li>${esc(t(ar, 'Desktop Chrome / Edge: address bar install icon.', 'سطح المكتب Chrome / Edge: أيقونة التثبيت في شريط العنوان.'))}</li>
      </ul></div></section>
    <section class="market-section" id="mobile-offline"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Offline', 'بدون اتصال'))}</span><h2>${esc(t(ar, 'Offline shell', 'الهيكل بدون اتصال'))}</h2></div>
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'When the network fails, navigation requests fall back to a cached page (the last visited core page or the homepage). Static assets cache opportunistically.', 'عند فشل الشبكة، تعود طلبات التنقّل إلى صفحة مخزّنة (آخر صفحة رئيسية تمّت زيارتها أو الصفحة الرئيسية). تُخزَّن الأصول الثابتة بشكل انتهازي.'))}</p></div></section>
    <section class="market-section" id="mobile-push"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Push contract', 'عقد الدفع'))}</span><h2>${esc(t(ar, 'Future push notifications', 'إشعارات الدفع المستقبلية'))}</h2></div>
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'The service worker has a push handler ready. No subscription is registered today; future opt-in will hook into the existing alert-dispatch contract (Phase 222 + 224) so push uses the same throttling, confidence floors and per-tier rate limits as Telegram + email.', 'لدى عامل الخدمة معالج دفع جاهز. لا يُسجَّل اشتراك اليوم؛ سيربط الانضمام المستقبلي بعقد إرسال التنبيهات القائم (Phase 222 + 224) بحيث يستخدم الدفع نفس التحديد وحدود الثقة وحصص الطبقات كـ Telegram والبريد.'))}</p></div></section>
    <section class="market-section" id="mobile-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(ar, 'PWA install is optional; the public site remains accessible without it. No analytics or tracking are added by the service worker. Not investment advice.', 'تثبيت PWA اختياري؛ ويبقى الموقع العام متاحاً دونه. لا تُضيف عامل الخدمة أي تحليلات أو تتبّع. ليست نصيحة استثمارية.'))}</p></div></section>`;
}

function shell(ar) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({ locale: lang, activePage: 'account', arabicHref: `/ar/${REL}`, englishHref: `/${REL}` });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar)}
<body>
${header}
  <main class="market-shell">
    <section class="market-hero"><div class="market-hero-copy"><span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span><h1>${esc(t(ar, 'Mobile App (PWA)', 'تطبيق الجوال (PWA)'))}</h1><p>${esc(t(ar, 'Install TradeAlphaAI to your home screen. Offline shell + push notification contract. No subscription registered today.', 'ثبّت TradeAlphaAI على شاشتك الرئيسية. هيكل بدون اتصال وعقد إشعارات. لا اشتراك مسجَّل اليوم.'))}</p></div></section>
${body(ar)}
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function main() {
  let count = 0;
  for (const ar of [false, true]) {
    const html = shell(ar);
    if (WRITE) { const out = path.join(ROOT, ar ? `ar/${REL}` : REL, 'index.html'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html, 'utf8'); count += 1; }
  }
  console.log(WRITE ? `[account-mobile-page] wrote ${count} pages` : '[account-mobile-page] dry-run 2 pages');
}

if (require.main === module) main();
