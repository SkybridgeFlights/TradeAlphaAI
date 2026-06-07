'use strict';

/**
 * update-content-feeds.js
 *
 * Rebuilds feed JSON files and injects updated article card HTML into listing pages.
 * Run after any successful market-outlook or insight publish.
 *
 * Outputs:
 *   data/feeds/latest-market-outlooks.json
 *   data/feeds/latest-insights.json
 *   data/feeds/homepage-featured.json
 *
 * Listing pages updated (between <!-- generated:*:start/end --> markers):
 *   market-outlook/index.html
 *   ar/market-outlook/index.html
 *   insights/index.html      (if markers exist)
 *   ar/insights/index.html   (if markers exist)
 */

const fs   = require('fs');
const path = require('path');

const ROOT              = path.resolve(__dirname, '..');
const QUEUE_PATH        = path.join(ROOT, 'data', 'market-outlook-queue.json');
const REGISTRY_PATH     = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const FEEDS_DIR         = path.join(ROOT, 'data', 'feeds');
const MAX_FEED_ITEMS    = 12;
const MAX_FEATURED      = 3;

main();

function main() {
  fs.mkdirSync(FEEDS_DIR, { recursive: true });

  const outlooks  = buildOutlookFeed();
  const insights  = buildInsightsFeed();
  const featured  = buildHomepageFeatured(outlooks, insights);

  writeFeed('latest-market-outlooks.json', outlooks);
  writeFeed('latest-insights.json', insights);
  writeFeed('homepage-featured.json', featured);

  updateListingPage(
    'market-outlook/index.html',
    'generated:outlook-feed',
    renderOutlookCards(outlooks, 'en')
  );

  updateListingPage(
    'ar/market-outlook/index.html',
    'generated:outlook-feed',
    renderOutlookCards(outlooks, 'ar')
  );

  console.log(`[update-content-feeds] Done. Outlooks: ${outlooks.length}, Insights: ${insights.length}`);
}

// ── Feed builders ─────────────────────────────────────────────────────────────

function buildOutlookFeed() {
  const queue = readJson(QUEUE_PATH, { topics: [] });
  return (queue.topics || [])
    .filter((t) => t.status === 'published' && exists(`market-outlook/${t.slug}.html`))
    .sort((a, b) => (b.published_at || b.seeded_at || '').localeCompare(a.published_at || a.seeded_at || ''))
    .slice(0, MAX_FEED_ITEMS)
    .map((t) => ({
      slug:        t.slug,
      title_en:    t.title_en || '',
      title_ar:    t.title_ar || '',
      summary_en:  t.summary_en || '',
      summary_ar:  t.summary_ar || '',
      date:        t.published_at || t.seeded_at || '',
      tone:        t.confidence_label || '',
      macro_tags:  t.macro_tags || [],
      url_en:      `/market-outlook/${t.slug}.html`,
      url_ar:      `/ar/market-outlook/${t.slug}.html`,
      ar_exists:   exists(`ar/market-outlook/${t.slug}.html`),
    }));
}

function buildInsightsFeed() {
  const registry = readJson(REGISTRY_PATH, { articles: [] });
  return (registry.articles || [])
    .filter((a) => a.status === 'published' && exists(a.languages?.en?.path || ''))
    .sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''))
    .slice(0, MAX_FEED_ITEMS)
    .map((a) => ({
      slug:       a.slug,
      title_en:   stripSiteName(a.languages?.en?.title || ''),
      title_ar:   stripSiteName(a.languages?.ar?.title || ''),
      summary_en: a.languages?.en?.summary || '',
      summary_ar: a.languages?.ar?.summary || '',
      date:       a.publishedAt || a.updatedAt || '',
      category:   a.category || '',
      url_en:     `/${a.languages?.en?.path || `insights/${a.slug}.html`}`,
      url_ar:     `/${a.languages?.ar?.path || `ar/insights/${a.slug}.html`}`,
      ar_exists:  exists(a.languages?.ar?.path || `ar/insights/${a.slug}.html`),
    }));
}

function buildHomepageFeatured(outlooks, insights) {
  const items = [
    ...outlooks.slice(0, 2).map((o) => ({ ...o, source: 'market_outlook' })),
    ...insights.slice(0, 2).map((i) => ({ ...i, source: 'insight' })),
  ];
  return items
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, MAX_FEATURED);
}

// ── Card renderers ────────────────────────────────────────────────────────────

function renderOutlookCards(items, locale) {
  const ar = locale === 'ar';
  if (!items.length) {
    return ar
      ? '          <p class="market-copy">لا توجد تقارير منشورة بعد.</p>'
      : '          <p class="market-copy">No published outlooks yet.</p>';
  }
  return items.map((item) => renderOutlookCard(item, ar)).join('\n');
}

function renderOutlookCard(item, ar) {
  const title   = escHtml(ar ? item.title_ar : item.title_en);
  const summary = escHtml(ar ? item.summary_ar : item.summary_en);
  const href    = ar ? item.url_ar : item.url_en;
  const kicker  = ar ? `توقعات السوق · ${item.date}` : `Market Outlook · ${item.date}`;
  const cta     = ar ? 'قراءة التقرير' : 'Read outlook';
  const tone    = item.tone
    ? `<span class="market-tone-badge">${escHtml(ar ? toneAr(item.tone) : item.tone)}</span>`
    : '';
  const tags    = ar ? '' : item.macro_tags.slice(0, 2).map((t) => `<span class="market-filter-chip">${escHtml(t)}</span>`).join('');
  const meta    = tone || tags ? `\n  <div class="market-outlook-index-tools">${tone}${tags}</div>` : '';
  return `<article class="market-card">
  <span class="market-card-kicker">${kicker}</span>
  <h3>${title}</h3>
  <p>${summary}</p>${meta}
  <a class="market-card-link" href="${href}">${cta}</a>
</article>`;
}

function toneAr(label) {
  const map = { constructive: 'بناءة', cautious: 'حذرة', defensive: 'دفاعية', volatile: 'متقلبة' };
  return map[label] || label;
}

// ── Listing page injection ────────────────────────────────────────────────────

function updateListingPage(rel, markerKey, cardsHtml) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.warn(`[update-content-feeds] Listing page not found: ${rel}`);
    return;
  }

  let html = fs.readFileSync(file, 'utf8');
  const start = `<!-- ${markerKey}:start -->`;
  const end   = `<!-- ${markerKey}:end -->`;

  if (!html.includes(start)) {
    console.warn(`[update-content-feeds] No ${markerKey} markers in ${rel} — skipping`);
    return;
  }

  const ar        = rel.startsWith('ar/');
  const eyebrow   = ar ? 'أحدث التقارير' : 'Latest outlooks';
  const heading   = ar ? 'توقعات السوق المنشورة' : 'Published market outlooks';
  const subtext   = ar
    ? 'تظهر التقارير فقط عندما تكون ملفاتها العامة موجودة وتجتاز جميع فحوصات الجودة.'
    : 'Outlooks appear only after their public page files exist and pass all quality checks.';

  const section = `<!-- ${markerKey}:start -->
      <section class="market-section" id="published-outlooks">
        <div class="market-section-head">
          <span class="eyebrow">${eyebrow}</span>
          <h2>${heading}</h2>
          <p class="market-copy">${subtext}</p>
        </div>
        <div class="market-grid three">
${cardsHtml}
        </div>
      </section>
<!-- ${markerKey}:end -->`;

  const startIdx = html.indexOf(start);
  const endIdx   = html.indexOf(end) + end.length;
  html = html.slice(0, startIdx) + section + html.slice(endIdx);

  fs.writeFileSync(file, html, 'utf8');
  console.log(`[update-content-feeds] Updated ${rel}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function writeFeed(name, data) {
  fs.writeFileSync(path.join(FEEDS_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`[update-content-feeds] Wrote data/feeds/${name} (${data.length} items)`);
}

function stripSiteName(title) {
  return String(title || '').replace(/\s*\|\s*TradeAlphaAI\s*$/i, '').trim();
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function exists(rel) {
  if (!rel) return false;
  return fs.existsSync(path.join(ROOT, rel));
}

function readJson(file, fallback) {
  try { return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback; }
  catch { return fallback; }
}
