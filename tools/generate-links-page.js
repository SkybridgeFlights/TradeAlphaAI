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
    `<a class="links-social" href="${escapeHtml(s.url)}" target="_blank" rel="noopener" aria-label="${escapeHtml(s.label)}"><span class="links-social-icon">${s.icon}</span><span class="links-social-name">${escapeHtml(s.label)}</span></a>`
  ).join('');

  const filters = `
    <button class="links-filter active" data-filter="all">${filterAll}</button>
    <button class="links-filter" data-filter="editorial">${filterArt}</button>
    <button class="links-filter" data-filter="continuous-intelligence">${filterNews}</button>
    <button class="links-filter" data-filter="market-outlook">${filterFcst}</button>
  `;

  const cards = items.map((it) => `
        <article class="insight-stat-card" data-bucket="${escapeHtml(it.bucketId)}" style="--accent-color:${it.color}">
          <span style="color:${it.color}">${escapeHtml(it.badge)}</span>
          <strong><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none">${escapeHtml(it.title)}</a></strong>
          ${it.description ? `<p>${escapeHtml(it.description.slice(0, 140))}${it.description.length > 140 ? '…' : ''}</p>` : ''}
          <p style="margin-top:8px;color:var(--muted);font-size:.8rem"><span>${escapeHtml(formatDate(it.publishDate, locale))}</span> · <span style="color:var(--accent)">${readText} →</span></p>
        </article>`).join('');

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
  <meta name="robots" content="index,follow,max-image-preview:large" />
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
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <style>
    .links-socials { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 20px 0; }
    .links-social { display: flex; align-items: center; gap: 10px; padding: 14px 16px; background: var(--glass); border: 1px solid rgba(255,255,255,.08); border-radius: 10px; color: var(--text, #e6f7f3); text-decoration: none; transition: border-color .12s, background .12s, transform .12s; }
    .links-social:hover { border-color: rgba(34,211,195,.35); background: rgba(34,211,195,.06); transform: translateY(-2px); }
    .links-social-icon { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(34,211,195,.12); color: var(--accent); font-weight: 700; }
    .links-social-name { font-size: .9rem; font-weight: 600; }
    .links-filters { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .links-filter { padding: 8px 16px; background: var(--glass); border: 1px solid rgba(255,255,255,.08); border-radius: 999px; color: var(--muted); font-family: inherit; font-size: .85rem; font-weight: 500; cursor: pointer; transition: all .12s; }
    .links-filter:hover { color: var(--text, #e6f7f3); border-color: rgba(34,211,195,.35); }
    .links-filter.active { background: rgba(34,211,195,.12); border-color: rgba(34,211,195,.5); color: var(--accent); }
    .insight-stat-card[hidden] { display: none; }
  </style>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      <nav class="breadcrumb"><a href="/${ar ? 'ar/' : ''}">${ar ? 'الرئيسية' : 'Home'}</a><span>/</span><span>${ar ? 'الروابط' : 'Links'}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${ar ? 'مركز الروابط' : 'Link Hub'}</span>
          </div>
          <h1>TradeAlphaAI</h1>
          <p class="market-lead">${escapeHtml(tagline)}</p>
          <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:16px">
            <a class="cta" href="${TELEGRAM_URL}" target="_blank" rel="noopener">✈️ ${escapeHtml(subscribeText)}</a>
            <a class="cta" href="${SITE_URL}/${ar ? 'ar/' : ''}" style="background:transparent;color:var(--accent);border:1px solid rgba(34,211,195,.35)">${escapeHtml(visitSite)} →</a>
          </div>
        </div>
      </section>

      <section class="market-section">
        <div class="market-panel">
          <h2 style="color:var(--accent);margin:0 0 8px">${escapeHtml(newsletterTitle)}</h2>
          <p class="market-copy" style="margin:0 0 16px">${escapeHtml(newsletterBlurb)}</p>
          <div id="custom-substack-embed" style="min-height:44px"></div>
        </div>
      </section>

      <section class="market-section">
        <h2 style="color:var(--accent);margin-bottom:12px">${ar ? 'قنوات السوشيال' : 'Follow us'}</h2>
        <div class="links-socials">${socialRow}</div>
      </section>

      <section class="market-section">
        <h2 style="color:var(--accent);margin-bottom:12px">${escapeHtml(recentLabel)}</h2>
        <div class="links-filters" role="tablist">
          ${filters}
        </div>
        <div class="insight-stat-grid" id="linksGrid">
          ${cards}
        </div>
      </section>

    </div>
  </main>

  <script>
    (function () {
      var pills = document.querySelectorAll('.links-filter');
      var cards = document.querySelectorAll('#linksGrid .insight-stat-card');
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
