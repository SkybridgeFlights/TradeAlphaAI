'use strict';

// Phase 223 — /account/research/ + /ar/account/research/.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

function readJson(p, f = {}) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function esc(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function t(ar, en, arText) { return ar ? arText : en; }

const REL = 'account/research/';

function head(ar) {
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${REL}`;
  const title = `${ar ? 'الأبحاث الشخصية' : 'Personal Research'} | TradeAlphaAI`;
  const desc = ar ? 'سطح الأبحاث الشخصية — بطاقات مشتقّة من قوائم متابعة كل حساب وجيران entity-research-graph المدعومين بأدلة. تتطلب النتائج لكل حساب حساباً حقيقياً.' : 'Personal research surface — cards derived from per-account watchlist symbols + evidence-backed entity-research-graph neighbours. Per-account results require a real account.';
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
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:title" content="${esc(title)}" />
${css.map((href) => `  <link rel="stylesheet" href="${href}" />`).join('\n')}
</head>`;
}

function body(ar, data) {
  const eng = data.engine || {};
  const ex = (eng.accounts && eng.accounts.example) || { cards: [], cards_count: 0, seed_symbols: [], note_en: '', note_ar: '' };
  const cards = (ex.cards || []).map((c) => `        <article class="market-card"><span class="market-card-kicker">${esc(c.from_symbol)} → ${esc(c.to_symbol)}</span><h3><a href="${esc(c.research_href)}">${esc(c.to_symbol)}</a></h3><p class="market-copy">${esc(c.kind)} · ${esc((c.evidence || []).slice(0, 1)[0] || '')}</p></article>`).join('\n');
  return `    <section class="market-section" id="account-research-status"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Status', 'الحالة'))}</span><h2>${esc(t(ar, 'Personal research engine status', 'حالة محرّك الأبحاث الشخصية'))}</h2></div>
      <div class="market-grid three">
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Engine', 'المحرّك'))}</span><h3>${esc(eng.engine_enabled ? 'enabled' : 'disabled')}</h3><p class="market-copy">${esc(t(ar, 'The engine runs on every build. With no account it falls back to a public-watchlist demo.', 'يعمل المحرّك في كل بناء. بدون حساب يعود إلى عرض توضيحي من قائمة عامة.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Real accounts', 'حسابات حقيقية'))}</span><h3>${esc(((eng.accounts && eng.accounts.real_count) || 0))}</h3><p class="market-copy">${esc(t(ar, 'Real per-account results require an account.', 'تتطلب نتائج كل حساب الحقيقية حساباً.'))}</p></article>
        <article class="market-card"><span class="market-card-kicker">${esc(t(ar, 'Example cards', 'بطاقات توضيحية'))}</span><h3>${esc(ex.cards_count)}</h3><p class="market-copy">${esc(t(ar, 'From ' + ((ex.seed_symbols || []).length) + ' seed symbols via evidence-backed graph neighbours.', 'من ' + ((ex.seed_symbols || []).length) + ' رمزاً جذراً عبر جيران مدعومين بأدلة.'))}</p></article>
      </div></section>
    <section class="market-section" id="account-research-cards"><div class="market-section-head"><span class="eyebrow">${esc(t(ar, 'Example', 'المثال'))}</span><h2>${esc(t(ar, 'Example personalization (public seed)', 'تخصيص توضيحي (جذر عام)'))}</h2></div>
      <div class="market-grid three">
${cards || `        <p class="market-copy">${esc(ar ? ex.note_ar : ex.note_en)}</p>`}
      </div>
      <p class="market-copy">${esc(t(ar, ex.note_en, ex.note_ar))}</p></section>
    <section class="market-section" id="account-research-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(ar, 'Personalized research is foundation-only in this phase. Cards link to existing research surfaces; no signals, no forecasts, no recommendations.', 'الأبحاث الشخصية في مرحلة التأسيس فقط. تربط البطاقات بأسطح الأبحاث القائمة؛ لا إشارات ولا توقعات ولا توصيات.'))}</p></div></section>`;
}

function shell(ar, data) {
  const lang = ar ? 'ar' : 'en';
  const header = renderGlobalHeader({ locale: lang, activePage: 'account', arabicHref: `/ar/${REL}`, englishHref: `/${REL}` });
  return `<!doctype html>
<html lang="${lang}"${ar ? ' dir="rtl"' : ''}>
${head(ar)}
<body>
${header}
  <main class="market-shell">
    <section class="market-hero"><div class="market-hero-copy"><span class="eyebrow">${esc(t(ar, 'Account Foundation', 'أساس الحساب'))}</span><h1>${esc(t(ar, 'Personal Research', 'الأبحاث الشخصية'))}</h1><p>${esc(t(ar, 'Cards derived from per-account watchlist symbols + evidence-backed graph neighbours. Per-account results require an account.', 'بطاقات مشتقّة من رموز قوائم متابعة كل حساب وجيران مدعومين بأدلة. تتطلب نتائج كل حساب حساباً.'))}</p></div></section>
${body(ar, data)}
  </main>
  ${globalHeaderScripts()}
</body>
</html>
`;
}

function main() {
  const data = { engine: readJson(J('personalized-research.json'), {}) };
  let count = 0;
  for (const ar of [false, true]) {
    const html = shell(ar, data);
    if (WRITE) { const out = path.join(ROOT, ar ? `ar/${REL}` : REL, 'index.html'); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html, 'utf8'); count += 1; }
  }
  console.log(WRITE ? `[account-research-page] wrote ${count} pages` : '[account-research-page] dry-run 2 pages');
}

if (require.main === module) main();
