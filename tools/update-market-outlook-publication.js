'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'market-outlook', 'index.html');
const SITEMAP_PATH = path.join(ROOT, 'sitemap-market.xml');
const SITE_URL = 'https://www.tradealphaai.com';
const START = '<!-- generated:outlook-feed:start -->';
const END = '<!-- generated:outlook-feed:end -->';
const SITEMAP_START = '<!-- generated:outlook-urls:start -->';
const SITEMAP_END = '<!-- generated:outlook-urls:end -->';

function updateOutlookPublication() {
  const pages = collectPages();
  updateIndex(pages);
  updateSitemap(pages);
  return pages;
}

function collectPages() {
  return [
    ...collectDirectory('daily', 'Daily Macro Briefing'),
    ...collectDirectory('weekly', 'Weekly Macro Outlook')
  ].sort((a, b) => b.slug.localeCompare(a.slug));
}

function collectDirectory(type, fallbackTitle) {
  const dir = path.join(ROOT, 'market-outlook', type);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => /^\d{4}-(?:\d{2}-\d{2}|W\d{2})\.html$/.test(name))
    .map((name) => {
      const relative = `market-outlook/${type}/${name}`;
      const html = fs.readFileSync(path.join(ROOT, relative), 'utf8');
      return {
        type,
        slug: name.replace(/\.html$/, ''),
        url: `/${relative}`,
        title: extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) || `${fallbackTitle} ${name.replace(/\.html$/, '')}`,
        description: extract(html, /<meta name="description" content="([^"]+)"/i) || 'Institutional educational macro commentary.',
        lastmod: fs.statSync(path.join(ROOT, relative)).mtime.toISOString().slice(0, 10)
      };
    });
}

function updateIndex(pages) {
  if (!fs.existsSync(INDEX_PATH)) return;
  let html = fs.readFileSync(INDEX_PATH, 'utf8');
  const latest = pages[0];
  if (latest) {
    html = html.replace(
      /<a class="market-btn primary" href="[^"]+">Read latest outlook<\/a>/,
      `<a class="market-btn primary" href="${latest.url}">Read latest outlook</a>`
    );
  }
  const cards = pages.slice(0, 8).map((page) => `<article class="market-card">
  <span class="market-card-kicker">${page.type === 'daily' ? 'Daily briefing' : 'Weekly outlook'} &middot; ${page.slug}</span>
  <h3>${escapeHtml(page.title)}</h3>
  <p>${escapeHtml(page.description)}</p>
  <a class="market-card-link" href="${page.url}">Read ${page.type === 'daily' ? 'briefing' : 'outlook'}</a>
</article>`).join('\n');
  const block = `${START}
      <section class="market-section" id="current-macro-briefings">
        <div class="market-section-head">
          <span class="eyebrow">Current Macro Intelligence</span>
          <h2>Daily and weekly outlooks</h2>
          <p class="market-copy">Published briefings appear here only after their static pages pass generation checks.</p>
        </div>
        <div class="market-grid three">
${cards || '          <p class="market-copy">No current briefings are published.</p>'}
        </div>
      </section>
${END}`;
  html = replaceOrInsert(html, START, END, block, '      <section class="market-section">\n        <div class="market-panel">\n          <span class="eyebrow">Research map</span>');
  fs.writeFileSync(INDEX_PATH, html, 'utf8');
  console.log(`[outlook-publication] Updated market-outlook/index.html with ${pages.length} briefing page(s)`);
}

function updateSitemap(pages) {
  if (!fs.existsSync(SITEMAP_PATH)) return;
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  const managedUrls = new Set(pages.map((page) => `${SITE_URL}${page.url}`));
  xml = removeUrlEntries(xml, managedUrls, 'sitemap-market.xml');
  const entries = pages.map((page) => `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.type === 'daily' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page.type === 'daily' ? '0.78' : '0.8'}</priority>
  </url>`).join('\n');
  const block = `${SITEMAP_START}\n${entries}\n${SITEMAP_END}`;
  xml = replaceOrInsert(xml, SITEMAP_START, SITEMAP_END, block, '</urlset>');
  xml = dedupeUrlEntries(xml, 'sitemap-market.xml');
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
  console.log(`[outlook-publication] Updated sitemap-market.xml with ${pages.length} briefing URL(s)`);
}

function removeUrlEntries(xml, urls, sitemap) {
  return String(xml || '').replace(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\s*/g, (entry, url) => {
    if (!urls.has(url)) return entry;
    console.log(`[SITEMAP DEDUPE]\nsitemap=${sitemap}\nurl=${url}`);
    return '';
  });
}

function dedupeUrlEntries(xml, sitemap) {
  const seen = new Set();
  return String(xml || '').replace(/<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\s*/g, (entry, url) => {
    if (!seen.has(url)) {
      seen.add(url);
      return entry;
    }
    console.log(`[SITEMAP DEDUPE]\nsitemap=${sitemap}\nurl=${url}`);
    return '';
  });
}

function replaceOrInsert(text, start, end, block, marker) {
  const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
  if (pattern.test(text)) return text.replace(pattern, block);
  return text.replace(marker, `${block}\n\n${marker}`);
}

function extract(html, pattern) {
  const match = String(html || '').match(pattern);
  return match ? match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (require.main === module) updateOutlookPublication();

module.exports = {
  collectPages,
  updateOutlookPublication
};
