'use strict';

// Builds /data/search-index.json — consumed by js/search-autocomplete.js
// which drives the header search box.
//
// Phases 20-149 only indexed stocks + ETFs + insights via registries.
// This rewrite scans on-disk HTML across every content dir so that
// comparisons, glossary terms, news, market outlook, market structure,
// briefs, and educational articles are all discoverable via search.
//
// Schema per item (kept identical to prior version — the widget already
// speaks it): { symbol, name, type, sector, category, themes, href, arHref,
//               label, arLabel, keywords, arKeywords }

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'search-index.json');

// ── Original registry-based inputs (kept for backwards compatibility) ───────

function safeReadJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch { return fallback; }
}

function assetItems() {
  const data = safeReadJson('data/research-assets/index.json', { stocks: [], etfs: [] });
  const assets = [...(data.stocks || []), ...(data.etfs || [])];
  return assets.map((asset) => {
    const isEtf = asset.type === 'etf';
    const pathName = `${isEtf ? 'etfs' : 'stocks'}/${asset.symbol.toLowerCase()}.html`;
    return {
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      sector: asset.sector || asset.category,
      category: asset.category || asset.sector,
      themes: asset.themes || [],
      href: `/${pathName}`,
      arHref: `/ar/${pathName}`,
      label: `${asset.symbol} — ${asset.name}`,
      arLabel: `${asset.symbol} — ${asset.name}`,
      keywords: [asset.symbol, asset.name, asset.sector, asset.category, ...(asset.themes || [])].filter(Boolean).join(' '),
      arKeywords: [asset.symbol, asset.name, asset.ar?.sector, asset.ar?.category, ...(asset.ar?.themes || [])].filter(Boolean).join(' ')
    };
  });
}

function registryArticles() {
  const registry = safeReadJson('data/insights/article-registry.json', { articles: [] });
  return (registry.articles || []).filter((entry) => entry.status === 'published').map((entry) => ({
    symbol: entry.slug,
    name: entry.languages?.en?.title || entry.slug,
    type: 'insight',
    sector: entry.category || 'Market Insights',
    category: 'Market Insights',
    themes: entry.symbols || [],
    href: `/${entry.languages?.en?.path || `insights/${entry.slug}.html`}`,
    arHref: `/${entry.languages?.ar?.path || `ar/insights/${entry.slug}.html`}`,
    label: entry.languages?.en?.title || entry.slug,
    arLabel: entry.languages?.ar?.title || entry.slug,
    keywords: [entry.slug, entry.languages?.en?.title, entry.languages?.en?.summary, entry.category, ...(entry.symbols || [])].filter(Boolean).join(' '),
    arKeywords: [entry.slug, entry.languages?.ar?.title, entry.languages?.ar?.summary, entry.category, ...(entry.symbols || [])].filter(Boolean).join(' ')
  }));
}

// ── Filesystem scan for the new content types ───────────────────────────────

const HTML_SOURCES = [
  { dir: 'compare',          type: 'compare',   sector: 'Comparison',      sector_ar: 'مقارنة' },
  { dir: 'glossary',         type: 'glossary',  sector: 'Glossary Term',   sector_ar: 'مصطلح' },
  { dir: 'market-news',      type: 'news',      sector: 'Market News',     sector_ar: 'أخبار السوق' },
  { dir: 'intelligence',     type: 'news',      sector: 'Market News',     sector_ar: 'أخبار السوق' },
  { dir: 'market-outlook',   type: 'outlook',   sector: 'Market Outlook',  sector_ar: 'نظرة السوق' },
  { dir: 'market-structure', type: 'structure', sector: 'Market Structure',sector_ar: 'بنية السوق' },
  { dir: 'briefs',           type: 'brief',     sector: 'Market Brief',    sector_ar: 'إحاطة السوق' },
  { dir: 'articles',         type: 'article',   sector: 'Educational',     sector_ar: 'تعليمي' }
];

function decodeEntities(s) {
  return String(s || '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

function readHtmlEntry(file, source, isAr) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const rawTitle = extract(html, /<title>([\s\S]*?)<\/title>/i);
  const title = decodeEntities(rawTitle).replace(/\s*\|\s*TradeAlphaAI.*$/i, '').trim();
  const desc = decodeEntities(extract(html, /<meta\s+name="description"\s+content="([^"]*)"/i)).trim();
  if (!title) return null;
  const slug = path.basename(file, '.html');
  const enHref = `/${source.dir}/${slug}.html`;
  const arHref = `/ar/${source.dir}/${slug}.html`;
  return {
    isAr,
    entry: {
      symbol: slug,
      name: title,
      type: source.type,
      sector: isAr ? source.sector_ar : source.sector,
      category: isAr ? source.sector_ar : source.sector,
      themes: [],
      href: isAr ? arHref : enHref,
      arHref,
      label: title,
      arLabel: title,
      keywords: [slug, title, desc].filter(Boolean).join(' '),
      arKeywords: [slug, title, desc].filter(Boolean).join(' ')
    }
  };
}

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => path.join(abs, f));
}

function htmlItems() {
  const bySlug = new Map();  // dedupe by slug+type so we don't duplicate EN/AR

  for (const source of HTML_SOURCES) {
    const enFiles = listHtml(source.dir);
    const arFiles = listHtml('ar/' + source.dir);

    // Build maps for cross-referencing EN <-> AR titles.
    const arTitleBySlug = new Map();
    for (const f of arFiles) {
      const r = readHtmlEntry(f, source, true);
      if (r) arTitleBySlug.set(r.entry.symbol, r.entry);
    }

    for (const f of enFiles) {
      const r = readHtmlEntry(f, source, false);
      if (!r) continue;
      const ar = arTitleBySlug.get(r.entry.symbol);
      if (ar) {
        r.entry.arLabel = ar.name;
        r.entry.arKeywords = ar.keywords;
      }
      const key = `${r.entry.type}:${r.entry.symbol}`;
      bySlug.set(key, r.entry);
    }

    // Include AR-only entries (rare, but possible for legacy content).
    for (const [slug, entry] of arTitleBySlug.entries()) {
      const key = `${entry.type}:${slug}`;
      if (!bySlug.has(key)) bySlug.set(key, entry);
    }
  }

  return [...bySlug.values()];
}

function main() {
  const items = [...assetItems(), ...registryArticles(), ...htmlItems()];

  // Sort deterministically for stable git diffs.
  items.sort((a, b) => (a.type + a.symbol).localeCompare(b.type + b.symbol));

  const payload = {
    generatedAt: new Date().toISOString().slice(0, 10),
    items
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  const byType = items.reduce((acc, it) => { acc[it.type] = (acc[it.type] || 0) + 1; return acc; }, {});
  const size = fs.statSync(OUT).size;
  console.log(`[search-index] total items:   ${items.length}`);
  for (const t of Object.keys(byType).sort()) console.log(`  - ${t.padEnd(10)} ${byType[t]}`);
  console.log(`[search-index] size:          ${(size / 1024).toFixed(1)} KB`);
}

if (require.main === module) main();

module.exports = { htmlItems, assetItems, registryArticles };
