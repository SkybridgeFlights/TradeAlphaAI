'use strict';

// Part 4 — Homepage Featured Content Injection
// Reads the 3 most-recently published editorial articles and the latest
// market outlook topics, then rewrites the editorial-grid and
// homepage-outlook-cards sections in index.html and ar/index.html.
//
// Usage:
//   node tools/update-homepage-featured.js          → dry run (print diff)
//   node tools/update-homepage-featured.js --write  → apply changes

const fs   = require('fs');
const path = require('path');
const { resolveUrl, resolveOutlookUrls } = require('./resolve-existing-url');

const ROOT         = path.resolve(__dirname, '..');
const REGISTRY     = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const MO_QUEUE     = path.join(ROOT, 'data', 'market-outlook-queue.json');
const MO_DAILY_DIR = path.join(ROOT, 'market-outlook', 'daily');
const MO_WEEKLY_DIR= path.join(ROOT, 'market-outlook', 'weekly');
const EN_INDEX     = path.join(ROOT, 'index.html');
const AR_INDEX     = path.join(ROOT, 'ar', 'index.html');

const WRITE   = process.argv.includes('--write');
const VERBOSE = process.argv.includes('--verbose');

const SITE_URL = (process.env.SITE_URL || 'https://www.tradealphaai.com').replace(/\/$/, '');

function main() {
  const registry = readJson(REGISTRY, { articles: [] });
  const moQueue  = readJson(MO_QUEUE,  { topics: [] });

  // ── Editorial articles (3 most recent published) ─────────────────────────
  const recentEditorial = (registry.articles || [])
    .filter((a) => a.status === 'published' && a.languages?.en?.title)
    .sort((a, b) => (b.publishedAt || b.published_at || '').localeCompare(a.publishedAt || a.published_at || ''))
    .slice(0, 3);

  if (recentEditorial.length < 3) {
    console.log('[homepage] Fewer than 3 published articles — skipping editorial injection');
  }

  // ── Market outlook topics (latest 3 published) ───────────────────────────
  const recentOutlook = (moQueue.topics || [])
    .filter((t) => t.status === 'published' && (t.title_en || t.title))
    .slice(-3)
    .reverse();

  // ── Latest daily / weekly file dates ─────────────────────────────────────
  const latestDaily  = latestFile(MO_DAILY_DIR,  /^\d{4}-\d{2}-\d{2}\.html$/);
  const latestWeekly = latestFile(MO_WEEKLY_DIR, /^\d{4}-W\d{2}\.html$/);

  // ── Build HTML blocks ─────────────────────────────────────────────────────
  const enEditorialHtml = buildEnEditorialGrid(recentEditorial);
  const arEditorialHtml = buildArEditorialGrid(recentEditorial);
  const enOutlookHtml   = buildEnOutlookCards(recentOutlook, latestDaily, latestWeekly);
  const arOutlookHtml   = buildArOutlookCards(recentOutlook, latestDaily, latestWeekly);

  // ── Inject into index.html ────────────────────────────────────────────────
  let enHtml = fs.readFileSync(EN_INDEX, 'utf8');
  let arHtml = fs.readFileSync(AR_INDEX, 'utf8');

  enHtml = replaceDiv(enHtml, 'class="editorial-grid"',         enEditorialHtml, 'editorial-grid');
  enHtml = replaceDiv(enHtml, 'id="homepage-outlook-cards"',    enOutlookHtml,   'homepage-outlook-cards');
  arHtml = replaceDiv(arHtml, 'class="editorial-grid"',         arEditorialHtml, 'editorial-grid (ar)');
  arHtml = replaceDiv(arHtml, 'id="homepage-outlook-cards-ar"', arOutlookHtml,   'homepage-outlook-cards-ar');

  if (WRITE) {
    fs.writeFileSync(EN_INDEX, enHtml, 'utf8');
    fs.writeFileSync(AR_INDEX, arHtml, 'utf8');
    console.log('[homepage] Updated index.html and ar/index.html with latest published content.');
  } else {
    console.log('[homepage] DRY RUN — pass --write to apply changes.');
    if (VERBOSE) {
      console.log('\n── EN editorial-grid ──');
      console.log(enEditorialHtml.slice(0, 600));
      console.log('\n── EN outlook-cards ──');
      console.log(enOutlookHtml.slice(0, 400));
    }
  }
}

// ── EN editorial grid ─────────────────────────────────────────────────────────

function buildEnEditorialGrid(articles) {
  if (!articles.length) return '';
  const [feat, ...rest] = articles;
  const featTitle = cleanTitle(feat.languages?.en?.title || feat.slug);
  const featSummary = truncate(feat.languages?.en?.summary || '', 160);
  const featCategory = feat.category || 'Research';

  let html = `\n            <a class="editorial-feature" href="/insights/${feat.slug}.html" data-featured-link>\n`;
  html += `              <span class="insight-category-badge">${esc(featCategory)}</span>\n`;
  html += `              <h3>${esc(featTitle)}</h3>\n`;
  html += `              <p>${esc(featSummary)}</p>\n`;
  html += `              <span class="insight-card-cta">Read featured insight &rarr;</span>\n`;
  html += `            </a>\n`;

  if (rest.length) {
    html += `            <div class="editorial-stack">\n`;
    for (const a of rest.slice(0, 2)) {
      const t = cleanTitle(a.languages?.en?.title || a.slug);
      const s = truncate(a.languages?.en?.summary || '', 120);
      const cat = a.category || 'Research';
      html += `              <a class="editorial-card" href="/insights/${a.slug}.html" data-featured-link>\n`;
      html += `                <span class="insight-category-badge">${esc(cat)}</span>\n`;
      html += `                <h3>${esc(t)}</h3>\n`;
      html += `                <p>${esc(s)}</p>\n`;
      html += `              </a>\n`;
    }
    html += `            </div>\n`;
  }
  return html;
}

// ── AR editorial grid ─────────────────────────────────────────────────────────

function buildArEditorialGrid(articles) {
  if (!articles.length) return '';
  const [feat, ...rest] = articles;
  const featTitle = cleanTitle(feat.languages?.ar?.title || feat.slug);
  const featSummary = truncate(feat.languages?.ar?.summary || '', 160);
  const featCategory = feat.category || 'بحث';

  let html = `\n            <a class="editorial-feature" href="/ar/insights/${feat.slug}.html" data-featured-link>\n`;
  html += `              <span class="insight-category-badge">${esc(featCategory)}</span>\n`;
  html += `              <h3>${esc(featTitle)}</h3>\n`;
  html += `              <p>${esc(featSummary)}</p>\n`;
  html += `              <span class="insight-card-cta">اقرأ المقال &larr;</span>\n`;
  html += `            </a>\n`;

  if (rest.length) {
    html += `            <div class="editorial-stack">\n`;
    for (const a of rest.slice(0, 2)) {
      const t = cleanTitle(a.languages?.ar?.title || a.slug);
      const s = truncate(a.languages?.ar?.summary || '', 120);
      const cat = a.category || 'بحث';
      html += `              <a class="editorial-card" href="/ar/insights/${a.slug}.html" data-featured-link>\n`;
      html += `                <span class="insight-category-badge">${esc(cat)}</span>\n`;
      html += `                <h3>${esc(t)}</h3>\n`;
      html += `                <p>${esc(s)}</p>\n`;
      html += `              </a>\n`;
    }
    html += `            </div>\n`;
  }
  return html;
}

// ── EN outlook cards ──────────────────────────────────────────────────────────

function buildEnOutlookCards(topics, latestDaily, latestWeekly) {
  const cards = [];

  if (latestDaily) {
    const date    = latestDaily.replace('.html', '');
    const dailyHref = resolveUrl(`/market-outlook/daily/${latestDaily}`, '/market-outlook/');
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">Daily Outlook — ${date}</span>\n` +
      `              <h3>Daily Market Commentary</h3>\n` +
      `              <p class="market-copy">Macro event reaction, sector context, and institutional regime snapshot for ${date}. Educational only.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${dailyHref}">Read Daily Outlook</a></div>\n` +
      `            </article>`
    );
  }

  if (latestWeekly) {
    const week       = latestWeekly.replace('.html', '');
    const weeklyHref = resolveUrl(`/market-outlook/weekly/${latestWeekly}`, '/market-outlook/');
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">Weekly Outlook — ${week}</span>\n` +
      `              <h3>Weekly Scenario Framework</h3>\n` +
      `              <p class="market-copy">Institutional scenario analysis, event calendar, and cross-asset transmission context for ${week}. Educational only.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${weeklyHref}">Read Weekly Outlook</a></div>\n` +
      `            </article>`
    );
  }

  for (const t of topics.slice(0, 3 - cards.length)) {
    const title = t.title_en || t.title || t.slug;
    const { en: url } = resolveOutlookUrls(t.slug);
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">Market Outlook</span>\n` +
      `              <h3>${esc(cleanTitle(title))}</h3>\n` +
      `              <p class="market-copy">Educational macro commentary. Not financial advice.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${url}">Read Outlook</a></div>\n` +
      `            </article>`
    );
  }

  if (!cards.length) {
    return `\n            <div class="market-panel" style="padding:1.5rem;text-align:center;grid-column:1/-1">\n` +
      `              <p class="market-copy">Market outlook commentary is being prepared. Check back soon.</p>\n` +
      `              <div class="market-actions" style="justify-content:center;margin-top:1rem"><a class="market-btn primary" href="/market-outlook/">View Market Outlook</a></div>\n` +
      `            </div>\n`;
  }

  return '\n            ' + cards.join('\n            ') + '\n          ';
}

// ── AR outlook cards ──────────────────────────────────────────────────────────

function buildArOutlookCards(topics, latestDaily, latestWeekly) {
  const cards = [];

  if (latestDaily) {
    const date    = latestDaily.replace('.html', '');
    const dailyHref = resolveUrl(`/market-outlook/daily/${latestDaily}`, '/market-outlook/');
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">التوقعات اليومية — ${date}</span>\n` +
      `              <h3>التعليق اليومي على السوق</h3>\n` +
      `              <p class="market-copy" lang="ar" dir="rtl">لقطة مؤسسية للنظام الكلي وسياق القطاع ليوم ${date}. للأغراض التعليمية فقط.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${dailyHref}">اقرأ التوقعات اليومية</a></div>\n` +
      `            </article>`
    );
  }

  if (latestWeekly) {
    const week       = latestWeekly.replace('.html', '');
    const weeklyHref = resolveUrl(`/market-outlook/weekly/${latestWeekly}`, '/market-outlook/');
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">التوقعات الأسبوعية — ${week}</span>\n` +
      `              <h3>إطار السيناريو الأسبوعي</h3>\n` +
      `              <p class="market-copy" lang="ar" dir="rtl">تحليل السيناريو المؤسسي وسياق نقل الأصول المتقاطعة لأسبوع ${week}. للأغراض التعليمية فقط.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${weeklyHref}">اقرأ التوقعات الأسبوعية</a></div>\n` +
      `            </article>`
    );
  }

  for (const t of topics.slice(0, 3 - cards.length)) {
    const title = t.title_ar || t.title_en || t.title || t.slug;
    const { ar: url } = resolveOutlookUrls(t.slug);
    cards.push(
      `<article class="market-panel" style="padding:1.5rem">\n` +
      `              <span class="market-card-kicker">توقعات السوق</span>\n` +
      `              <h3>${esc(cleanTitle(title))}</h3>\n` +
      `              <p class="market-copy" lang="ar" dir="rtl">تعليق اقتصادي كلي تعليمي. ليس نصيحة مالية.</p>\n` +
      `              <div class="market-actions" style="margin-top:1rem"><a class="market-btn" href="${url}">اقرأ التوقعات</a></div>\n` +
      `            </article>`
    );
  }

  if (!cards.length) {
    return `\n            <div class="market-panel" style="padding:1.5rem;text-align:center;grid-column:1/-1">\n` +
      `              <p class="market-copy" lang="ar" dir="rtl">يتم إعداد تعليق توقعات السوق. تحقق مجدداً قريباً.</p>\n` +
      `              <div class="market-actions" style="justify-content:center;margin-top:1rem"><a class="market-btn primary" href="/ar/market-outlook/">عرض توقعات السوق</a></div>\n` +
      `            </div>\n`;
  }

  return '\n            ' + cards.join('\n            ') + '\n          ';
}

// ── DOM-aware section replacement ─────────────────────────────────────────────

function replaceDiv(html, openAttrPattern, newContent, label) {
  // Find the opening tag that matches the pattern
  const openTagRe = new RegExp(`<div\\b[^>]*${escapeRe(openAttrPattern)}[^>]*>`, 'i');
  const openMatch = openTagRe.exec(html);
  if (!openMatch) {
    console.warn(`[homepage] Could not find "${label}" injection point — skipping`);
    return html;
  }

  const tagStart = openMatch.index;
  const tagEnd   = tagStart + openMatch[0].length;

  // Walk forward counting nested divs to find the matching close
  let depth = 1;
  let i = tagEnd;
  while (i < html.length && depth > 0) {
    if (html.startsWith('<div', i) && /[>\s]/.test(html[i + 4] || '')) { depth++; i += 4; }
    else if (html.startsWith('</div>', i))                              { depth--; i += 6; }
    else                                                                { i++; }
  }

  if (depth !== 0) {
    console.warn(`[homepage] Unclosed "${label}" div — skipping`);
    return html;
  }

  const before = html.slice(0, tagEnd);
  const after  = html.slice(i - 6); // include the closing </div>
  const rebuilt = before + newContent + '</div>';

  if (rebuilt === html.slice(0, tagEnd) + html.slice(tagEnd, i - 6 + 6)) {
    console.log(`[homepage] ${label}: content unchanged`);
  } else {
    console.log(`[homepage] ${label}: injected ${newContent.split('\n').length} line(s)`);
  }

  return before + newContent + after;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function latestFile(dir, pattern) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => pattern.test(f)).sort();
  return files.length ? files[files.length - 1] : null;
}

function cleanTitle(title) {
  return (title || '').replace(/\s*\|\s*TradeAlphaAI\s*$/, '').trim();
}

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max).replace(/\s+\S*$/, '') + '…';
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main();
