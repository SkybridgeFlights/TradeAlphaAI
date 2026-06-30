#!/usr/bin/env node
'use strict';

// Generates /links/index.html — a mobile-first "link hub" page intended for
// the Instagram bio. Lists the most recent published items across all three
// buckets (editorial / market-outlook / continuous-intelligence) with:
//   * Hero with TradeAlphaAI brand + tagline
//   * Telegram subscribe CTA (primary)
//   * Social presence row (Facebook / Instagram / X / LinkedIn / Telegram)
//   * Filter pills (All / Articles / News / Forecasts)
//   * Up to 15 article cards with title, date, type badge, "Read →"
//   * Footer with disclaimer
//
// Regenerates on every workflow publish so the page always reflects the
// freshest content. Output:
//   - links/index.html              (English, primary)
//   - ar/links/index.html           (Arabic mirror)
// The /Image/og-image.svg brand mark is reused; no extra assets needed.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://www.tradealphaai.com';
const TELEGRAM_URL = 'https://t.me/TradeAlphaAI';
const SUBSTACK_URL = 'https://tradealphaai.substack.com';

const SOCIAL_LINKS = [
  { id: 'telegram',  label: 'Telegram',  url: TELEGRAM_URL,                                       icon: '✈️' },
  { id: 'facebook',  label: 'Facebook',  url: 'https://www.facebook.com/profile.php?id=61583281783652', icon: 'f' },
  { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/tradealpha_ai/',         icon: '◎' },
  { id: 'x',         label: 'X',         url: 'https://x.com/TradeAlpha_AI',                      icon: '𝕏' },
  // LinkedIn intentionally omitted until a Company Page exists.
];

const BUCKETS = [
  {
    id: 'editorial',
    label: 'Research Articles',
    label_ar: 'مقالات بحثية',
    dir: 'insights',
    historyFile: 'data/published-history.json',
    badge: 'Article',
    badge_ar: 'مقال',
    color: '#22d3c3'
  },
  {
    id: 'market-outlook',
    label: 'Market Outlooks',
    label_ar: 'توقعات السوق',
    dir: 'market-outlook',
    historyFile: 'data/market-outlook-history.json',
    badge: 'Forecast',
    badge_ar: 'توقّع',
    color: '#fbbf24'
  },
  {
    id: 'continuous-intelligence',
    label: 'Market News',
    label_ar: 'أخبار السوق',
    dir: 'intelligence',
    historyFile: 'data/continuous-intelligence-history.json',
    badge: 'News',
    badge_ar: 'خبر',
    color: '#60a5fa'
  }
];

const MAX_ITEMS = 15;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
  catch { return fallback; }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readArticleTitle(dir, slug) {
  const file = path.join(ROOT, dir, slug + '.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : null;
}

function readArticleMeta(dir, slug) {
  const file = path.join(ROOT, dir, slug + '.html');
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<meta name="description" content="([^"]+)"/);
  return m ? m[1].trim() : null;
}

function collectItems(locale) {
  const items = [];
  for (const bucket of BUCKETS) {
    const history = readJson(bucket.historyFile, { publications: [] });
    const arDir = locale === 'ar' ? 'ar/' + bucket.dir : bucket.dir;
    for (const pub of (history.publications || [])) {
      const slug = pub.slug;
      if (!slug) continue;
      const articleDir = fs.existsSync(path.join(ROOT, arDir, slug + '.html')) ? arDir : bucket.dir;
      const title = readArticleTitle(articleDir, slug);
      if (!title) continue;
      const desc = readArticleMeta(articleDir, slug);
      const publishDate = pub.publish_date || (pub.published_at || '').slice(0, 10);
      items.push({
        bucketId: bucket.id,
        bucketLabel: locale === 'ar' ? bucket.label_ar : bucket.label,
        badge: locale === 'ar' ? bucket.badge_ar : bucket.badge,
        color: bucket.color,
        slug,
        title,
        description: desc,
        publishDate,
        url: `${SITE_URL}/${articleDir}/${slug}.html`
      });
    }
  }
  // Newest first, cap to MAX_ITEMS
  items.sort((a, b) => String(b.publishDate || '').localeCompare(String(a.publishDate || '')));
  return items.slice(0, MAX_ITEMS);
}

function formatDate(s, locale) {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  try {
    const d = new Date(s + 'T00:00:00Z');
    const opts = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' };
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', opts).format(d);
  } catch { return s; }
}

function renderPage(locale) {
  const ar = locale === 'ar';
  const items = collectItems(locale);
  const lang = ar ? 'ar' : 'en';
  const dir = ar ? 'rtl' : 'ltr';

  const t = (en, arT) => ar ? arT : en;
  const tagline = t(
    'Institutional market research — stocks, ETFs, and macro analysis.',
    'أبحاث سوق مؤسسية — أسهم وصناديق ETF وتحليل ماكرو.'
  );
  const subscribeText = t('Get daily research on Telegram', 'احصل على أبحاث يومية على Telegram');
  const newsletterTitle = t('Get the newsletter by email', 'احصل على النشرة عبر البريد');
  const newsletterBlurb = t('Daily institutional analysis. Free. Unsubscribe anytime.', 'تحليل يومي مؤسسي. مجاناً. ألغِ الاشتراك في أي وقت.');
  const newsletterPh = t('your@email.com', 'بريدك الإلكتروني');
  const newsletterBtn = t('Subscribe', 'اشترك');
  const filterAll = t('All', 'الكل');
  const filterArt = t('Articles', 'مقالات');
  const filterNews = t('News', 'أخبار');
  const filterFcst = t('Forecasts', 'توقعات');
  const recentLabel = t('Recent research', 'أحدث الأبحاث');
  const readText = t('Read', 'اقرأ');
  const visitSite = t('Visit tradealphaai.com', 'زيارة tradealphaai.com');

  const socialRow = SOCIAL_LINKS.map((s) =>
    `<a class="social-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.label)}"><span class="social-icon">${s.icon}</span><span class="social-name">${escapeHtml(s.label)}</span></a>`
  ).join('');

  const filters = `
    <button class="filter-pill active" data-filter="all">${filterAll}</button>
    <button class="filter-pill" data-filter="editorial">${filterArt}</button>
    <button class="filter-pill" data-filter="continuous-intelligence">${filterNews}</button>
    <button class="filter-pill" data-filter="market-outlook">${filterFcst}</button>
  `;

  const cards = items.map((it) => `
    <article class="link-card" data-bucket="${escapeHtml(it.bucketId)}">
      <a class="link-card-inner" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">
        <div class="link-badge" style="--badge-color:${it.color}">${escapeHtml(it.badge)}</div>
        <h2 class="link-title">${escapeHtml(it.title)}</h2>
        ${it.description ? `<p class="link-desc">${escapeHtml(it.description.slice(0, 140))}${it.description.length > 140 ? '…' : ''}</p>` : ''}
        <div class="link-meta">
          <span class="link-date">${escapeHtml(formatDate(it.publishDate, locale))}</span>
          <span class="link-read">${readText} →</span>
        </div>
      </a>
    </article>
  `).join('');

  const titleText = ar ? 'TradeAlphaAI · الروابط' : 'TradeAlphaAI · Links';
  const description = ar
    ? 'كل روابط TradeAlphaAI — أحدث المقالات والأخبار والتوقعات + قنوات السوشيال.'
    : 'All TradeAlphaAI links — latest articles, news, forecasts, and social channels.';

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(titleText)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#071021" />
  <link rel="canonical" href="${SITE_URL}/${ar ? 'ar/' : ''}links/" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/links/" />
  <link rel="alternate" hreflang="ar" href="${SITE_URL}/ar/links/" />
  <link rel="alternate" hreflang="x-default" href="${SITE_URL}/links/" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="${ar ? 'ar_SA' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${escapeHtml(titleText)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${SITE_URL}/${ar ? 'ar/' : ''}links/" />
  <meta property="og:image" content="${SITE_URL}/Image/1.png" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(titleText)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${SITE_URL}/Image/1.png" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: ${ar ? "'Cairo'," : "'Inter',"} -apple-system, BlinkMacSystemFont, sans-serif;
      background: radial-gradient(ellipse at top, #0d1a2a 0%, #071021 60%);
      color: #e6f7f3;
      min-height: 100vh;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 2rem 1.25rem 4rem;
    }
    /* Hero */
    .hero {
      text-align: center;
      padding: 1.5rem 0 1.75rem;
    }
    .hero-mark {
      width: 96px;
      height: 96px;
      margin: 0 auto 1rem;
      border-radius: 24px;
      background: linear-gradient(135deg, #0d1a2a 0%, #1a2e44 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 12px 40px rgba(34, 211, 195, 0.18);
      border: 1px solid rgba(34, 211, 195, 0.25);
    }
    .hero-mark img { width: 56px; height: 56px; object-fit: contain; }
    .hero h1 {
      margin: 0.5rem 0 0.25rem;
      font-size: 1.65rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .hero .tagline {
      margin: 0 auto;
      color: #9aa8b6;
      font-size: 0.95rem;
      max-width: 420px;
    }
    /* Primary CTA */
    .cta-primary {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      width: 100%;
      padding: 1rem 1.25rem;
      margin: 1.75rem 0 1.25rem;
      background: linear-gradient(135deg, #22d3c3 0%, #4dd0e1 100%);
      color: #021018;
      border-radius: 14px;
      font-weight: 700;
      font-size: 1rem;
      text-decoration: none;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      box-shadow: 0 8px 24px rgba(34, 211, 195, 0.25);
    }
    .cta-primary:hover { transform: translateY(-1px); box-shadow: 0 12px 32px rgba(34, 211, 195, 0.35); }
    .cta-primary:active { transform: translateY(0); }
    /* Social row */
    .social-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      margin: 0.5rem 0 2rem;
    }
    .social-link {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.35rem;
      padding: 0.85rem 0.5rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      color: #e6f7f3;
      text-decoration: none;
      transition: background 0.12s ease, border-color 0.12s ease, transform 0.12s ease;
    }
    .social-link:hover {
      background: rgba(34, 211, 195, 0.08);
      border-color: rgba(34, 211, 195, 0.35);
      transform: translateY(-2px);
    }
    .social-icon {
      font-size: 1.25rem;
      font-weight: 700;
      color: #22d3c3;
      line-height: 1;
    }
    .social-name { font-size: 0.7rem; font-weight: 500; color: #9aa8b6; }
    /* Newsletter card */
    .newsletter-card {
      margin: 0 0 1.25rem;
      padding: 1.1rem 1.1rem 1.25rem;
      background: rgba(34, 211, 195, 0.05);
      border: 1px solid rgba(34, 211, 195, 0.28);
      border-radius: 14px;
    }
    .newsletter-title {
      margin: 0 0 0.35rem;
      font-size: 0.95rem;
      font-weight: 700;
      color: #22d3c3;
    }
    .newsletter-blurb {
      margin: 0 0 0.7rem;
      font-size: 0.82rem;
      color: #9aa8b6;
      line-height: 1.45;
    }
    .newsletter-form { min-height: 44px; }
    .newsletter-form input[type="email"] {
      background: rgba(7, 16, 33, 0.7) !important;
      color: #e6f7f3 !important;
      border-color: rgba(34, 211, 195, 0.35) !important;
    }
    /* Recent section */
    .recent-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 1rem 0 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }
    .recent-head h2 { margin: 0; font-size: 1.05rem; font-weight: 700; }
    /* Filter pills */
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .filter-pill {
      padding: 0.5rem 0.95rem;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 999px;
      color: #9aa8b6;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .filter-pill:hover { color: #e6f7f3; border-color: rgba(34, 211, 195, 0.35); }
    .filter-pill.active {
      background: rgba(34, 211, 195, 0.12);
      border-color: rgba(34, 211, 195, 0.5);
      color: #22d3c3;
    }
    /* Article cards */
    .links-grid { display: flex; flex-direction: column; gap: 0.75rem; }
    .link-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      transition: border-color 0.15s ease, transform 0.15s ease, background 0.15s ease;
    }
    .link-card:hover {
      border-color: rgba(34, 211, 195, 0.35);
      transform: translateY(-2px);
      background: rgba(34, 211, 195, 0.04);
    }
    .link-card[hidden] { display: none; }
    .link-card-inner {
      display: block;
      padding: 1rem 1.1rem;
      text-decoration: none;
      color: inherit;
    }
    .link-badge {
      display: inline-block;
      padding: 0.25rem 0.65rem;
      background: color-mix(in oklab, var(--badge-color) 18%, transparent);
      color: var(--badge-color);
      border-radius: 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 0.55rem;
    }
    .link-title {
      margin: 0 0 0.4rem;
      font-size: 1rem;
      font-weight: 600;
      line-height: 1.35;
      color: #e6f7f3;
    }
    .link-desc {
      margin: 0 0 0.6rem;
      font-size: 0.8rem;
      color: #9aa8b6;
      line-height: 1.45;
    }
    .link-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }
    .link-date { color: #6b7a8a; }
    .link-read { color: #22d3c3; font-weight: 600; }
    /* Visit-site link */
    .visit-site {
      display: block;
      text-align: center;
      margin: 2rem 0 1rem;
      padding: 0.85rem;
      color: #9aa8b6;
      text-decoration: none;
      font-size: 0.85rem;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      transition: all 0.12s ease;
    }
    .visit-site:hover {
      color: #22d3c3;
      border-color: rgba(34, 211, 195, 0.35);
    }
    /* Footer */
    footer {
      margin-top: 2rem;
      text-align: center;
      font-size: 0.7rem;
      color: #6b7a8a;
      line-height: 1.55;
    }
    footer p { margin: 0.4rem 0; }
    footer a { color: #6b7a8a; text-decoration: none; }
    footer a:hover { color: #9aa8b6; }
    /* Reduce motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
    }
    /* Tiny screens */
    @media (max-width: 400px) {
      .container { padding: 1.5rem 1rem 3rem; }
      .hero h1 { font-size: 1.4rem; }
      .social-row { grid-template-columns: repeat(4, 1fr); gap: 0.4rem; }
      .social-link { padding: 0.7rem 0.35rem; }
      .social-name { font-size: 0.6rem; }
    }
  </style>
</head>
<body>
  <main class="container">
    <section class="hero">
      <div class="hero-mark"><img src="/Image/og-image.svg" alt="TradeAlphaAI" /></div>
      <h1>TradeAlphaAI</h1>
      <p class="tagline">${escapeHtml(tagline)}</p>
    </section>

    <a class="cta-primary" href="${TELEGRAM_URL}" target="_blank" rel="noopener">
      ✈️ ${escapeHtml(subscribeText)}
    </a>

    <section class="newsletter-card">
      <h3 class="newsletter-title">${escapeHtml(newsletterTitle)}</h3>
      <p class="newsletter-blurb">${escapeHtml(newsletterBlurb)}</p>
      <div id="custom-substack-embed" class="newsletter-form"></div>
    </section>

    <div class="social-row">${socialRow}</div>

    <section>
      <div class="recent-head">
        <h2>${escapeHtml(recentLabel)}</h2>
      </div>
      <div class="filters" role="tablist">
        ${filters}
      </div>
      <div class="links-grid" id="linksGrid">
        ${cards}
      </div>
    </section>

    <a class="visit-site" href="${SITE_URL}/${ar ? 'ar/' : ''}">${escapeHtml(visitSite)} →</a>

    <footer>
      <p>${escapeHtml(t('Educational market research only. Not financial advice.', 'أبحاث سوق تعليمية فقط. لا تُشكّل نصيحة مالية.'))}</p>
      <p>&copy; ${new Date().getUTCFullYear()} TradeAlphaAI</p>
    </footer>
  </main>

  <script>
    (function () {
      var pills = document.querySelectorAll('.filter-pill');
      var cards = document.querySelectorAll('.link-card');
      pills.forEach(function (pill) {
        pill.addEventListener('click', function () {
          pills.forEach(function (p) { p.classList.remove('active'); });
          pill.classList.add('active');
          var f = pill.getAttribute('data-filter');
          cards.forEach(function (c) {
            c.hidden = !(f === 'all' || c.getAttribute('data-bucket') === f);
          });
        });
      });
    })();
  </script>
  <script>
    window.CustomSubstackWidget = {
      substackUrl: "tradealphaai.substack.com",
      placeholder: "${newsletterPh}",
      buttonText: "${newsletterBtn}",
      theme: "custom",
      colors: { primary: "#22d3c3", input: "#071021", email: "#e6f7f3", text: "#021018" }
    };
  </script>
  <script src="https://substackapi.com/widget.js" async></script>
</body>
</html>
`;
}

function writeIfChanged(outPath, content) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(outPath, 'utf8'); } catch { /* missing */ }
  if (existing === content) return false;
  fs.writeFileSync(outPath, content, 'utf8');
  return true;
}

function main() {
  const enHtml = renderPage('en');
  const arHtml = renderPage('ar');
  const enPath = path.join(ROOT, 'links', 'index.html');
  const arPath = path.join(ROOT, 'ar', 'links', 'index.html');
  const enWritten = writeIfChanged(enPath, enHtml);
  const arWritten = writeIfChanged(arPath, arHtml);
  const enItems = (enHtml.match(/<article class="link-card"/g) || []).length;
  const arItems = (arHtml.match(/<article class="link-card"/g) || []).length;
  console.log(`[links] EN page ${enWritten ? 'updated' : 'unchanged'} (${enItems} items)`);
  console.log(`[links] AR page ${arWritten ? 'updated' : 'unchanged'} (${arItems} items)`);
}

if (require.main === module) main();

module.exports = { renderPage, collectItems };
