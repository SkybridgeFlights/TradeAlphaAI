'use strict';

// Phase 225 — /account/billing/ + /account/subscription/ EN+AR (4 pages).

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
  billing: { rel: 'account/billing/', title_en: 'Account Billing', title_ar: 'فوترة الحساب',
    desc_en: 'Billing contract — provider, env vars, hosted-checkout flow. Foundation only; no payments collected, no subscriptions stored.',
    desc_ar: 'عقد الفوترة — المزوّد وأسماء متغيرات البيئة وتدفّق المحفظة المستضافة. مرحلة التأسيس فقط؛ لا تُجمع مدفوعات ولا تُخزَّن اشتراكات.' },
  subscription: { rel: 'account/subscription/', title_en: 'Account Subscription', title_ar: 'اشتراك الحساب',
    desc_en: 'Tier comparison — free, premium, institutional. Public intelligence stays free at every tier; tiers modulate personal scope only.',
    desc_ar: 'مقارنة الطبقات — مجاني وبريميوم ومؤسسي. تبقى الاستخبارات العامة مجانية في كل طبقة؛ تعدّل الطبقات النطاق الشخصي فقط.' },
};

function head(ar, surface) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${surface.rel}`;
  const enUrl = `https://www.tradealphaai.com/${surface.rel}`;
  const arUrl = `https://www.tradealphaai.com/ar/${surface.rel}`;
  const depth = (ar ? 1 : 0) + surface.rel.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css', '/css/account-premium.css'];
  const title = `${ar ? surface.title_ar : surface.title_en} | TradeAlphaAI`;
  const desc = ar ? surface.desc_ar : surface.desc_en;
  return `<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" /><meta property="og:title" content="${esc(title)}" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>`;
}

function shell(ar, surface, body) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({ locale: lang, activePage: 'account', arabicHref: `/ar/${surface.rel}`, englishHref: `/${surface.rel}` });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar, surface)}
<body>
${header}
  <main class="market-shell">
    <section class="market-hero"><div class="market-hero-copy"><span class="eyebrow">${esc(t(ar, 'Your account', 'حسابك'))}</span><h1>${esc(ar ? surface.title_ar : surface.title_en)}</h1><p>${esc(ar ? surface.desc_ar : surface.desc_en)}</p></div></section>
${body}
    <section class="market-section" id="billing-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(ar, 'Billing is foundation-only — no payments are collected, no subscriptions stored, no card numbers in this repo. Public intelligence remains FREE at every tier; subscriptions only modulate the personal scope (watchlist counts, alert breadth, copilot quota). Not investment advice.', 'الفوترة في مرحلة التأسيس فقط — لا تُجمع مدفوعات ولا تُخزَّن اشتراكات ولا أرقام بطاقات في هذا المستودع. تبقى الاستخبارات العامة مجانية في كل طبقة؛ تعدّل الاشتراكات النطاق الشخصي فقط (عدد قوائم المتابعة، نطاق التنبيهات، حصة المساعد). ليست نصيحة استثمارية.'))}</p></div></section>
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function billingBody(ar, data) {
  const b = data.billing || {};
  const provider = (b.providers && b.providers[0]) || {};
  const envRows = (provider.env_vars || []).map((v) => `<tr><td><code>${esc(v.name)}</code></td><td>${esc(v.surface)}</td><td>${esc(v.required ? 'required' : 'optional')}</td><td>${esc(v.value_present ? 'present' : 'absent')}</td></tr>`).join('\n');
  return `    <section class="market-section" id="billing-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'Billing status', 'حالة الفوترة'))}</h2></div>
      <div class="market-grid three">
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Mode', 'الوضع'))}</span><h3>${esc(b.mode || 'contract')}</h3><p class="market-copy">${esc(t(ar, 'Contract phase — no live Stripe wiring.', 'مرحلة العقد — لا ربط Stripe حيّ.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Provider', 'المزوّد'))}</span><h3>${esc(provider.label_en || 'Stripe')}</h3><p class="market-copy">${esc(t(ar, 'Hosted checkout flow planned for live wiring.', 'تدفّق محفظة مستضافة مخطّط للربط الحيّ.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Card numbers in repo', 'أرقام البطاقات في المستودع'))}</span><h3>${esc(t(ar, 'none', 'لا شيء'))}</h3><p class="market-copy">${esc(t(ar, 'No payment data ever stored in this repo.', 'لا تُخزَّن بيانات دفع في هذا المستودع أبداً.'))}</p></article>
      </div></section>
    <section class="market-section" id="billing-env"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Env vars', 'متغيرات البيئة'))}</span><h2>${esc(t(ar, 'Env-var contract (names only)', 'عقد متغيرات البيئة (الأسماء فقط)'))}</h2></div>
      <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Name', 'الاسم'))}</th><th>${esc(t(ar, 'Surface', 'السطح'))}</th><th>${esc(t(ar, 'Required', 'مطلوب'))}</th><th>${esc(t(ar, 'Value', 'القيمة'))}</th></tr></thead><tbody>
${envRows}
      </tbody></table></div></section>
    <section class="market-section" id="billing-flow"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Flow', 'التدفّق'))}</span><h2>${esc(t(ar, 'Future hosted-checkout flow', 'تدفّق المحفظة المستضافة المستقبلي'))}</h2></div>
      <div class="market-panel"><p class="market-copy">${esc(ar ? provider.flow_description_ar : provider.flow_description_en)}</p></div></section>`;
}

function subscriptionBody(ar, data) {
  const b = data.billing || {};
  const tiers = b.tiers || {};
  return `    <section class="market-section" id="subscription-tiers"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Tiers', 'الطبقات'))}</span><h2>${esc(t(ar, 'Tier comparison', 'مقارنة الطبقات'))}</h2></div>
      <div class="market-grid three">
${Object.entries(tiers).map(([id, ti]) => `        <article class="market-card"><span class="market-card-kicker">${esc(ar ? ti.label_ar : ti.label_en)}</span><h3>${esc(ti.monthly_usd === 0 ? (ar ? 'مجاناً' : 'Free') : (ti.monthly_usd === null ? (ar ? 'بانتظار التسعير' : 'pricing TBD') : ('$' + ti.monthly_usd + '/mo')))}</h3><ul class="market-copy">
  <li>${esc(t(ar, 'Personal watchlists', 'قوائم متابعة شخصية'))}: ${esc(ti.capabilities.personal_watchlists_max)}</li>
  <li>${esc(t(ar, 'Alert classes', 'أصناف التنبيهات'))}: ${esc(ti.capabilities.alert_classes.length)} / 7</li>
  <li>${esc(t(ar, 'Channels', 'القنوات'))}: ${esc((ti.capabilities.alert_channels || []).join(', '))}</li>
  <li>${esc(t(ar, 'Copilot queries/day', 'استعلامات المساعد/يوم'))}: ${esc(ti.capabilities.copilot_queries_per_day)}</li>
        </ul></article>`).join('\n')}
      </div></section>
    <section class="market-section" id="subscription-no-gates"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Public content', 'المحتوى العام'))}</span><h2>${esc(t(ar, 'No public content gates', 'لا حواجز للمحتوى العام'))}</h2></div>
      <div class="market-panel"><p class="market-copy">${esc(t(ar, 'All Phase 200-224 surfaces (research, changes, explorer, workspace, market terminal, ETF intelligence, regime, narratives, rankings, history) remain ACCESSIBLE at every tier including free. Subscriptions only modulate the per-account PERSONAL scope.', 'تبقى جميع أسطح المراحل 200-224 (الأبحاث، التغيّرات، المستكشف، مساحة العمل، الطرفية، استخبارات الصناديق، النظام، السرديات، الترتيب، التاريخ) متاحة في كل طبقة بما فيها المجانية. تعدّل الاشتراكات النطاق الشخصي لكل حساب فقط.'))}</p></div></section>`;
}

function load() { return { billing: readJson(J('billing-contracts.json'), {}) }; }
function bodyFor(key, ar, data) { if (key === 'billing') return billingBody(ar, data); if (key === 'subscription') return subscriptionBody(ar, data); return ''; }

function main() {
  const data = load();
  let count = 0;
  for (const [key, surface] of Object.entries(SURFACES)) {
    for (const ar of [false, true]) {
      const html = shell(ar, surface, bodyFor(key, ar, data));
      if (WRITE) { const out = path.join(ROOT, ar ? `ar/${surface.rel}` : surface.rel, 'index.html'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html, 'utf8'); count += 1; }
    }
  }
  console.log(WRITE ? `[account-billing-pages] wrote ${count} pages` : `[account-billing-pages] dry-run ${Object.keys(SURFACES).length * 2} pages`);
}

if (require.main === module) main();
