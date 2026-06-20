'use strict';

// Phase 226 — /account/copilot/ + /ar/account/copilot/.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');
const REL = 'account/copilot/';

function readJson(p, f = {}) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }

function head(ar) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${REL}`;
  const title = `${ar ? 'مساعد الحساب الذكي' : 'Account AI Copilot'} | TradeAlphaAI`;
  const desc = ar ? 'عقد مساعد الذكاء الاصطناعي للحساب — اختيار النموذج، النطاقات المسموح بها، الأدوات المسموح بها، الحوكمة. مرحلة التأسيس فقط؛ لا مفتاح API، لا استعلامات.' : 'Account AI copilot contract — model selection, allowed scopes, allowed tools, governance. Foundation only; no API key, no queries.';
  const depth = (ar ? 1 : 0) + REL.split('/').filter(Boolean).length;
  const prefix = '../'.repeat(depth);
  const css = ['/css/global-header.css', `${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`, '/css/global-layout.css', '/css/responsive.css', '/css/global-header-canonical.css'];
  return `<head>
  <meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="noindex,follow" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/${REL}" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/${REL}" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>`;
}

function body(ar, c) {
  const ctx = c.context || {};
  const gov = c.response_governance || {};
  const rate = c.rate_limiting || {};
  return `    <section class="market-section" id="copilot-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'Copilot status', 'حالة المساعد'))}</h2></div>
      <div class="market-grid three">
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Mode', 'الوضع'))}</span><h3>${esc(c.mode || 'contract')}</h3><p class="market-copy">${esc(t(ar, 'Contract phase — no model loaded.', 'مرحلة العقد — لا نموذج محمّل.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Model', 'النموذج'))}</span><h3>${esc(c.primary_model || 'claude-haiku-4-5-20251001')}</h3><p class="market-copy">${esc(t(ar, 'Default cost-efficient choice; tier escalates to larger models for institutional.', 'الاختيار الافتراضي المنخفض التكلفة؛ تترقّى الطبقة المؤسسية إلى نماذج أكبر.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'API key in repo', 'مفتاح API في المستودع'))}</span><h3>${esc(t(ar, 'none', 'لا شيء'))}</h3><p class="market-copy">${esc(t(ar, 'ANTHROPIC_API_KEY must arrive at runtime only via Vercel env.', 'يصل ANTHROPIC_API_KEY في وقت التشغيل فقط عبر متغيرات Vercel.'))}</p></article>
      </div></section>
    <section class="market-section" id="copilot-scope"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Scope', 'النطاق'))}</span><h2>${esc(t(ar, 'What the copilot may read', 'ما يحقّ للمساعد قراءته'))}</h2></div>
      <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t(ar, 'Source', 'المصدر'))}</th><th>${esc(t(ar, 'Allowed', 'مسموح'))}</th></tr></thead><tbody>
${Object.entries(ctx).filter(([k]) => k.startsWith('reads_')).map(([k, v]) => `<tr><td><code>${esc(k)}</code></td><td>${esc(v ? 'YES' : 'NO')}</td></tr>`).join('\n')}
      </tbody></table></div></section>
    <section class="market-section" id="copilot-governance"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Governance', 'الحوكمة'))}</span><h2>${esc(t(ar, 'Response governance', 'حوكمة الإجابات'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">
${Object.entries(gov).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('\n')}
      </ul></div></section>
    <section class="market-section" id="copilot-tools"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Tools', 'الأدوات'))}</span><h2>${esc(t(ar, 'Allowed tools', 'الأدوات المسموح بها'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">
${(c.allowed_tools || []).map((tool) => `<li><code>${esc(tool)}</code></li>`).join('\n')}
      </ul></div></section>
    <section class="market-section" id="copilot-rate"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Rate', 'المعدل'))}</span><h2>${esc(t(ar, 'Per-tier rate limits', 'حدود المعدل لكل طبقة'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">
${Object.entries(rate).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('\n')}
      </ul></div></section>
    <section class="market-section" id="copilot-forbidden"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Forbidden', 'محظور'))}</span><h2>${esc(t(ar, 'Forbidden prompt patterns', 'أنماط المحفّزات المحظورة'))}</h2></div>
      <div class="market-panel"><ul class="market-copy">
${(c.forbidden_prompts || []).map((p) => `<li><code>${esc(p)}</code></li>`).join('\n')}
      </ul></div></section>
    <section class="market-section" id="copilot-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(ar, 'Copilot is foundation-only — no model is loaded, no queries are dispatched. When activated, it will only read public + per-account sources, never raw emails / session tokens / billing data / other accounts. Every response will cite evidence; no signals, no forecasts, no recommendations.', 'المساعد في مرحلة التأسيس فقط — لا نموذج محمّل ولا استعلامات. عند التفعيل سيقرأ المصادر العامة وحالة الحساب فقط، لا الرسائل الخام ولا الرموز ولا الفوترة ولا حسابات أخرى. كل إجابة ستستشهد بدليل؛ لا إشارات ولا توقعات ولا توصيات.'))}</p></div></section>`;
}

function shell(ar) {
  const lang = ar ? 'ar' : 'en';
  const c = readJson(J('copilot-contracts.json'), {});
  const header = renderGlobalHeader({ locale: lang, activePage: 'account', arabicHref: `/ar/${REL}`, englishHref: `/${REL}` });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar)}
<body>
${header}
  <main class="market-shell">
    <section class="market-hero"><div class="market-hero-copy"><span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span><h1>${esc(t(ar, 'Account AI Copilot', 'مساعد الحساب الذكي'))}</h1><p>${esc(t(ar, 'Foundation-only AI copilot — model, scope, tools and governance contracts. Live activation in a later phase.', 'مساعد ذكاء اصطناعي في مرحلة التأسيس — عقود النموذج والنطاق والأدوات والحوكمة. التفعيل الحيّ في مرحلة لاحقة.'))}</p></div></section>
${body(ar, c)}
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
  console.log(WRITE ? `[account-copilot-page] wrote ${count} pages` : '[account-copilot-page] dry-run 2 pages');
}

if (require.main === module) main();
