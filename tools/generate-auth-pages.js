'use strict';

// Phase 220 CP3 + CP4 — Auth pages.
// /account/{sign-in,sign-up,verify,profile}/ EN+AR — informational
// static pages explaining the future hosted-UI flow. No SDK loaded,
// no <form> elements that simulate live auth, no client-side state.
// When the live wiring activates in a future phase, the local pages
// redirect to the hosted UI; until then they describe the flow.

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
  signIn: { rel: 'account/sign-in/', title_en: 'Account Sign In', title_ar: 'تسجيل الدخول للحساب',
    desc_en: 'Sign in to a future TradeAlphaAI account. Authentication is foundation-only — the live provider wiring is reserved for a future phase.',
    desc_ar: 'سجّل الدخول لحساب TradeAlphaAI المستقبلي. المصادقة في مرحلة التأسيس فقط — وصْل المزوّد الحيّ محجوز لمرحلة لاحقة.' },
  signUp: { rel: 'account/sign-up/', title_en: 'Account Sign Up', title_ar: 'إنشاء حساب جديد',
    desc_en: 'Create a future TradeAlphaAI account. Account creation is foundation-only — the live provider wiring is reserved for a future phase.',
    desc_ar: 'أنشئ حساب TradeAlphaAI مستقبلياً. إنشاء الحسابات في مرحلة التأسيس فقط — وصْل المزوّد الحيّ محجوز لمرحلة لاحقة.' },
  verify: { rel: 'account/verify/', title_en: 'Account Verify', title_ar: 'التحقق من الحساب',
    desc_en: 'The verify endpoint is where the hosted-UI flow will land after sign-in. Today it describes the future redirect contract.',
    desc_ar: 'نقطة التحقق هي وجهة عودة تدفّق الواجهة المستضافة بعد تسجيل الدخول. اليوم تصف عقد إعادة التوجيه المستقبلي.' },
  profile: { rel: 'account/profile/', title_en: 'Account Profile', title_ar: 'الملف الشخصي للحساب',
    desc_en: 'Future account profile surface — fields, scopes and tier visible to the account once live wiring activates.',
    desc_ar: 'سطح الملف الشخصي المستقبلي — الحقول والصلاحيات والطبقة الظاهرة للحساب عند تفعيل الربط الحيّ.' },
};

function head(ar, surface, relPath) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${relPath}`;
  const enUrl = `https://www.tradealphaai.com/${relPath}`;
  const arUrl = `https://www.tradealphaai.com/ar/${relPath}`;
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.desc_ar : surface.desc_en;
  const depth = (ar ? 1 : 0) + relPath.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  // Auth pages are explicitly noindexed — the foundation phase pages are
  // informational scaffolding, not content the search index should rank.
  // When live wiring activates, the canonical URL will redirect to the
  // hosted UI anyway.
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
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
  <meta name="robots" content="noindex,follow" />
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

function shell(ar, surface, body, relPath, mode) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({
    locale: lang,
    activePage: 'account',
    arabicHref: `/ar/${relPath}`,
    englishHref: `/${relPath}`,
  });
  const hosted = mode === 'hosted';
  // Clerk bootstrap is included on every auth page ONLY when the auth
  // mode is hosted. In contract mode the page stays a pure shell.
  const clerkScripts = hosted
    ? '\n  <script src="/js/clerk-config.js"></script>\n  <script src="/js/clerk-bootstrap.js" defer></script>'
    : '';
  const disclaimer = hosted
    ? t(ar,
        'Authentication is LIVE via the hosted Clerk UI. Clerk holds the session; this site reads only the granted scopes (account.read + preferences.read by default). The PUBLIC publishable key is embedded by design; the SECRET key never leaves Vercel server env. Not investment advice.',
        'المصادقة مفعّلة عبر واجهة Clerk المستضافة. يحتفظ Clerk بالجلسة؛ يقرأ هذا الموقع الصلاحيات الممنوحة فقط (account.read + preferences.read افتراضياً). المفتاح العام (publishable) مضمَّن بحكم التصميم؛ المفتاح السرّي لا يغادر بيئة Vercel أبداً. ليست نصيحة استثمارية.')
    : t(ar,
        'Authentication is foundation-only in this phase — no provider SDK is installed, no passwords or session tokens are stored in the repository, and the surface is informational. Future activation will redirect to the hosted provider UI. Not investment advice.',
        'المصادقة في مرحلة التأسيس فقط ضمن هذه المرحلة — لا توجد SDK مُثبَّتة، ولا تُخزَّن كلمات مرور أو رموز جلسة في المستودع، والصفحة تعريفية فقط. التفعيل المستقبلي سيعيد التوجيه إلى واجهة المزوّد المستضافة. ليست نصيحة استثمارية.');
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar, surface, relPath)}
<body>
${header}
  <main class="market-shell" data-account-surface="${esc(surface.rel)}" data-auth-mode="${esc(mode || 'contract')}">
    <section class="market-hero">
      <div class="market-hero-copy">
        <span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span>
        <h1>${esc(ar ? surface.title_ar : surface.title_en)}</h1>
        <p>${esc(ar ? surface.desc_ar : surface.desc_en)}</p>
      </div>
    </section>
${body}
    <section class="market-section" id="auth-disclaimer">
      <div class="market-panel"><p class="market-copy">${esc(disclaimer)}</p></div>
    </section>
  </main>
  ${globalHeaderScripts()}${clerkScripts}
</body>
</html>
`;
}

function card(ar, kicker, title, copy, href) {
  const h = href ? (ar && !href.startsWith('/ar/') && !href.startsWith('http') ? '/ar' + href : href) : null;
  const titleHtml = h ? `<a href="${esc(h)}">${esc(title)}</a>` : esc(title);
  return `          <article class="market-card"><span class="market-card-kicker">${esc(kicker)}</span><h3>${titleHtml}</h3>${copy ? `<p class="market-copy">${esc(copy)}</p>` : ''}</article>`;
}

function clerkMountSection(ar, kind, titleEn, titleAr) {
  // Renders a Clerk mount container with status pill + unconfigured
  // fallback. The bootstrap script unhides the mount node once Clerk
  // loads; until then a status message appears in its place.
  return `      <section class="market-section" id="auth-mount">
        <div class="market-section-head"><span class="eyebrow">${esc(ar ? titleAr : titleEn)}</span><h2>${esc(ar ? titleAr : titleEn)}</h2></div>
        <div class="market-panel">
          <div data-clerk-status="loading" style="margin-bottom:12px;font-size:13px;color:#7a808a">${esc(ar ? 'يتم تحميل واجهة المصادقة…' : 'Loading authentication UI…')}</div>
          <div data-clerk-mount="${esc(kind)}" hidden></div>
          <noscript><p class="market-copy">${esc(ar ? 'يتطلب تسجيل الدخول JavaScript مُفعَّلاً.' : 'Sign-in requires JavaScript enabled.')}</p></noscript>
        </div></section>`;
}

function signInBody(ar, data) {
  const provider = (data.auth && data.auth.providers && data.auth.providers[0]) || { id: 'clerk', label_en: 'Clerk', label_ar: 'Clerk' };
  const mode = (data.auth && data.auth.mode) || 'contract';
  const mountSection = mode === 'hosted' ? clerkMountSection(ar, 'sign-in', 'Sign in', 'تسجيل الدخول') : '';
  return `${mountSection}
      <section class="market-section" id="auth-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Sign-in status', 'حالة تسجيل الدخول'))}</span><h2>${esc(t(ar, mode === 'hosted' ? 'Live via Clerk hosted UI' : 'Foundation phase', mode === 'hosted' ? 'مفعّلة عبر واجهة Clerk المستضافة' : 'مرحلة التأسيس'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Mode', 'الوضع'))}</span><h3>${esc(mode)}</h3><p class="market-copy">${esc(t(ar, 'No live provider is wired yet — sign-in returns to this informational page.', 'لم يُربط مزوّد حيّ بعد — يعود تسجيل الدخول إلى هذه الصفحة التعريفية.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Provider', 'المزوّد'))}</span><h3>${esc(ar ? provider.label_ar : provider.label_en)}</h3><p class="market-copy">${esc(t(ar, 'Hosted UI flow planned for the live wiring.', 'تدفّق واجهة مستضافة مخطّط للربط الحيّ.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Credentials in repo', 'بيانات الاعتماد في المستودع'))}</span><h3>${esc(t(ar, 'none', 'لا شيء'))}</h3><p class="market-copy">${esc(t(ar, 'No passwords, no session tokens and no provider keys are stored.', 'لا كلمات مرور ولا رموز جلسة ولا مفاتيح مزوّد مخزَّنة.'))}</p></article>
        </div></section>
      <section class="market-section" id="auth-flow"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Future flow', 'التدفّق المستقبلي'))}</span><h2>${esc(t(ar, 'Hosted-UI flow', 'تدفّق الواجهة المستضافة'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(ar ? provider.flow_description_ar : provider.flow_description_en)}</p></div></section>
      <section class="market-section" id="auth-alt"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Alternatives', 'البدائل'))}</span><h2>${esc(t(ar, 'Need an account?', 'هل تحتاج حساباً؟'))}</h2></div>
        <div class="market-grid three">
${card(ar, t(ar, 'Sign up', 'حساب جديد'), t(ar, 'Create a future account', 'إنشاء حساب مستقبلي'), t(ar, 'The sign-up shell mirrors this surface; the live provider wiring is shared.', 'يعكس سطح إنشاء الحساب هذه الصفحة؛ ربط المزوّد الحيّ مشترك.'), '/account/sign-up/')}
${card(ar, t(ar, 'Browse without account', 'تصفّح دون حساب'), t(ar, 'Public intelligence', 'الاستخبارات العامة'), t(ar, 'All Phase 200-219 surfaces remain available without an account.', 'تبقى جميع أسطح المراحل 200-219 متاحة دون حساب.'), '/intelligence/')}
${card(ar, t(ar, 'Account overview', 'نظرة عامة على الحساب'), t(ar, 'What an account holds', 'ما يحتويه الحساب'), t(ar, 'Foundation contracts the future account will inherit.', 'العقود التأسيسية التي سيرثها الحساب المستقبلي.'), '/account/')}
        </div></section>`;
}

function signUpBody(ar, data) {
  const mode = (data.auth && data.auth.mode) || 'contract';
  const mountSection = mode === 'hosted' ? clerkMountSection(ar, 'sign-up', 'Create your account', 'أنشئ حسابك') : '';
  return `${mountSection}
      <section class="market-section" id="auth-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Sign-up status', 'حالة إنشاء الحساب'))}</span><h2>${esc(t(ar, mode === 'hosted' ? 'Live via Clerk hosted UI' : 'Foundation phase', mode === 'hosted' ? 'مفعّلة عبر واجهة Clerk المستضافة' : 'مرحلة التأسيس'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'Account creation runs through the same hosted-UI flow as sign-in. mode=' + mode + '. No personal data is collected here today.', 'يمرّ إنشاء الحساب بنفس تدفّق الواجهة المستضافة كتسجيل الدخول. mode=' + mode + '. لا تُجمع بيانات شخصية هنا اليوم.'))}</p></div></section>
      <section class="market-section" id="auth-fields"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Future shape', 'الهيكل المستقبلي'))}</span><h2>${esc(t(ar, 'Account identity fields', 'حقول هوية الحساب'))}</h2></div>
        <div class="market-grid three">
${card(ar, t(ar, 'account_id', 'account_id'), t(ar, 'opaque identifier', 'معرّف غامض'), t(ar, 'Issued by the auth provider; the platform never sees the raw email.', 'يصدره مزوّد المصادقة؛ المنصّة لا ترى البريد الإلكتروني الخام.'), null)}
${card(ar, t(ar, 'primary_email_hash', 'primary_email_hash'), t(ar, 'sha256 only', 'تجزئة sha256 فقط'), t(ar, 'Used to join alert subscriptions; the raw email stays at the provider.', 'تُستخدم لربط اشتراكات التنبيهات؛ ويبقى البريد الخام لدى المزوّد.'), null)}
${card(ar, t(ar, 'scopes', 'scopes'), t(ar, 'least privilege', 'أقل الصلاحيات'), t(ar, 'Default scopes: account.read + preferences.read. Write scopes opt-in.', 'الصلاحيات الافتراضية: account.read + preferences.read. صلاحيات الكتابة اختيارية.'), null)}
        </div></section>
      <section class="market-section" id="auth-alt"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Alternatives', 'البدائل'))}</span><h2>${esc(t(ar, 'Already have an account?', 'تملك حساباً مسبقاً؟'))}</h2></div>
        <div class="market-grid three">
${card(ar, t(ar, 'Sign in', 'تسجيل الدخول'), t(ar, 'Use existing account', 'استخدم حساباً موجوداً'), t(ar, 'Returns to the same hosted-UI flow.', 'يعود إلى نفس تدفّق الواجهة المستضافة.'), '/account/sign-in/')}
${card(ar, t(ar, 'Verify', 'التحقق'), t(ar, 'Callback endpoint', 'نقطة استدعاء'), t(ar, 'Where the hosted UI lands after sign-up.', 'الوجهة التي تحطّ عندها الواجهة المستضافة بعد إنشاء الحساب.'), '/account/verify/')}
${card(ar, t(ar, 'Account overview', 'نظرة عامة'), t(ar, 'Foundation status', 'حالة الأساس'), t(ar, 'What the future account will inherit.', 'ما سيرثه الحساب المستقبلي.'), '/account/')}
        </div></section>`;
}

function verifyBody(ar, data) {
  const endpoint = (data.auth && data.auth.providers && data.auth.providers[0] && data.auth.providers[0].endpoints) || {};
  const mode = (data.auth && data.auth.mode) || 'contract';
  const callbackHook = mode === 'hosted'
    ? `      <section class="market-section" id="auth-callback">
        <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Callback', 'الاستدعاء'))}</span><h2>${esc(t(ar, 'Processing sign-in', 'معالجة تسجيل الدخول'))}</h2></div>
        <div class="market-panel">
          <div data-clerk-status="loading" style="margin-bottom:8px;font-size:13px;color:#7a808a">${esc(t(ar, 'Verifying session…', 'يتم التحقق من الجلسة…'))}</div>
          <p class="market-copy" data-clerk-verify-callback data-not-signed-in-text="${esc(t(ar, 'Not signed in. Open the sign-in page to start.', 'لم يتم تسجيل الدخول. افتح صفحة تسجيل الدخول للبدء.'))}">${esc(t(ar, 'Verifying…', 'يتم التحقق…'))}</p>
          <p class="market-copy"><a href="${esc((ar ? '/ar' : '') + '/account/sign-in/')}">${esc(t(ar, 'Sign in', 'تسجيل الدخول'))}</a> · <a href="${esc((ar ? '/ar' : '') + '/account/profile/')}">${esc(t(ar, 'Open profile', 'افتح الملف الشخصي'))}</a></p>
        </div></section>`
    : '';
  return `${callbackHook}
      <section class="market-section" id="auth-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Verify status', 'حالة التحقق'))}</span><h2>${esc(t(ar, mode === 'hosted' ? 'Live callback endpoint' : 'Callback endpoint contract', mode === 'hosted' ? 'نقطة استدعاء مفعّلة' : 'عقد نقطة الاستدعاء'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, mode === 'hosted' ? 'The hosted Clerk UI redirects here after sign-in or sign-up. The Clerk SDK reads the URL params, creates the session, and the callback block above forwards you to /account/profile/.' : 'When live wiring activates, the hosted UI redirects here after sign-in or sign-up. Today this page is informational and contains no callback-handling logic.', mode === 'hosted' ? 'تعيد واجهة Clerk المستضافة التوجيه إلى هنا بعد تسجيل الدخول أو إنشاء الحساب. تقرأ Clerk SDK معاملات الرابط وتُنشئ الجلسة ويعيد البلوك أعلاه التوجيه إلى /account/profile/.' : 'عند تفعيل الربط الحيّ، تعيد الواجهة المستضافة التوجيه إلى هنا بعد تسجيل الدخول أو إنشاء الحساب. اليوم هذه الصفحة تعريفية ولا تتضمّن أي منطق معالجة استدعاء.'))}</p></div></section>
      <section class="market-section" id="auth-endpoints"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Endpoints', 'النقاط'))}</span><h2>${esc(t(ar, 'Local + hosted endpoint registry', 'سجلّ النقاط المحلية + المستضافة'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Endpoint', 'النقطة'))}</th><th>${esc(t(ar, 'URL', 'العنوان'))}</th></tr></thead><tbody>
${Object.entries(endpoint).map(([k, v]) => `<tr><td>${esc(k)}</td><td><code>${esc(v)}</code></td></tr>`).join('\n')}
        </tbody></table></div></section>`;
}

function profileBody(ar, data) {
  const fields = (data.identity && data.identity.fields) || {};
  const mode = (data.auth && data.auth.mode) || 'contract';
  const mountSection = mode === 'hosted' ? `      <section class="market-section" id="profile-mount">
        <div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Live profile', 'الملف الشخصي الحيّ'))}</span><h2>${esc(t(ar, 'Your Clerk profile', 'ملفك الشخصي عبر Clerk'))}</h2></div>
        <div class="market-panel">
          <div data-clerk-status="loading" style="margin-bottom:12px;font-size:13px;color:#7a808a">${esc(t(ar, 'Loading…', 'يتم التحميل…'))}</div>
          <div data-clerk-mount="user-profile" hidden></div>
          <div data-clerk-mount="user-button" hidden style="margin-top:12px"></div>
          <p class="market-copy" data-not-signed-in-message hidden>${esc(t(ar, 'Sign in to view your live profile.', 'سجّل الدخول لعرض ملفك الحيّ.'))} <a href="${esc((ar ? '/ar' : '') + '/account/sign-in/')}">${esc(t(ar, 'Sign in', 'تسجيل الدخول'))}</a></p>
        </div></section>` : '';
  return `${mountSection}
      <section class="market-section" id="profile-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Profile status', 'حالة الملف الشخصي'))}</span><h2>${esc(t(ar, mode === 'hosted' ? 'Live via Clerk' : 'Foundation phase', mode === 'hosted' ? 'مفعّل عبر Clerk' : 'مرحلة التأسيس'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, mode === 'hosted' ? 'Your live Clerk profile renders above when signed in. The field schema below documents which fields the platform reads (always: account_id + primary_email_hash + locale + scopes + tier; never: raw email or session tokens).' : 'No live account exists. The profile surface describes the fields a future account will carry; values are placeholders until the provider issues real session data.', mode === 'hosted' ? 'يظهر ملفك الحيّ عبر Clerk أعلاه عند تسجيل الدخول. يوثّق مخطط الحقول أدناه الحقول التي تقرأها المنصّة (دائماً: account_id + primary_email_hash + locale + scopes + tier؛ أبداً: البريد الخام أو رموز الجلسة).' : 'لا يوجد حساب حيّ. يصف سطح الملف الشخصي الحقول التي سيحملها الحساب المستقبلي؛ والقيم نوائب حتى يصدر المزوّد بيانات جلسة حقيقية.'))}</p></div></section>
      <section class="market-section" id="profile-fields"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Field schema', 'مخطّط الحقول'))}</span><h2>${esc(t(ar, 'Account identity fields', 'حقول هوية الحساب'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Field', 'الحقل'))}</th><th>${esc(t(ar, 'Type', 'النوع'))}</th><th>${esc(t(ar, 'Description', 'الوصف'))}</th></tr></thead><tbody>
${Object.entries(fields).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v.type || '')}</td><td>${esc(ar ? (v.note_ar || v.source || '') : (v.note_en || v.source || ''))}</td></tr>`).join('\n')}
        </tbody></table></div></section>
      <section class="market-section" id="profile-scopes"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Scopes', 'الصلاحيات'))}</span><h2>${esc(t(ar, 'Allowed scopes', 'الصلاحيات المسموح بها'))}</h2></div>
        <div class="market-panel"><ul class="market-copy">
${((data.identity && data.identity.allowed_scopes) || []).map((s) => `<li><code>${esc(s)}</code></li>`).join('\n')}
        </ul></div></section>
      <section class="market-section" id="profile-state"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Personal state', 'الحالة الشخصية'))}</span><h2>${esc(t(ar, 'Future per-account file layout', 'تخطيط ملفات كل حساب المستقبلي'))}</h2></div>
        <div class="market-panel"><p class="market-copy">${esc(t(ar, 'When the live wiring activates, each account will own a directory under ' + ((data.personalState && data.personalState.storage && data.personalState.storage.root_dir) || 'data/accounts/') + '<account_id>/ holding the following files. The directory is gitignored so per-account state is never committed.', 'عند تفعيل الربط الحيّ سيمتلك كل حساب دليلاً تحت ' + ((data.personalState && data.personalState.storage && data.personalState.storage.root_dir) || 'data/accounts/') + '<account_id>/ يحوي الملفات التالية. الدليل مُستبعَد عبر gitignore لذا لا يُحفظ بحالة حساب في المستودع.'))}</p>
        <ul class="market-copy">
${((data.personalState && data.personalState.storage && data.personalState.storage.file_layout) || []).map((f) => `<li><code>${esc(f)}</code></li>`).join('\n')}
        </ul></div></section>`;
}

function load() {
  return {
    auth: readJson(J('auth-foundation.json'), { providers: [{}] }),
    identity: readJson(J('account-identity.json'), { fields: {}, allowed_scopes: [] }),
    // Phase 221 — Personal state contracts (file layout future account writes).
    personalState: readJson(J('personal-state-contracts.json'), { storage: {}, example_template: { files: {} } }),
  };
}

function bodyFor(key, ar, data) {
  if (key === 'signIn') return signInBody(ar, data);
  if (key === 'signUp') return signUpBody(ar, data);
  if (key === 'verify') return verifyBody(ar, data);
  if (key === 'profile') return profileBody(ar, data);
  return '';
}

function main() {
  const data = load();
  let count = 0;
  for (const [key, surface] of Object.entries(SURFACES)) {
    for (const ar of [false, true]) {
      const html = shell(ar, surface, bodyFor(key, ar, data), surface.rel, (data.auth && data.auth.mode) || 'contract');
      if (WRITE) {
        const out = path.join(ROOT, ar ? `ar/${surface.rel}` : surface.rel, 'index.html');
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, html, 'utf8');
        count += 1;
      }
    }
  }
  console.log(WRITE ? `[auth-pages] wrote ${count} pages` : `[auth-pages] dry-run ${Object.keys(SURFACES).length * 2} pages`);
}

if (require.main === module) main();

module.exports = { SURFACES, load };
