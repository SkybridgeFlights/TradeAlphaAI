#!/usr/bin/env node
'use strict';

// End-of-article "Related research" widget.
//
// Builds a keyword-based similarity index across all content pages, then
// injects a 4-card grid at the end of each page pointing to its closest
// neighbors. Boosts session length, pages per session, and internal-linking
// depth — Google reads all three as topical-authority signals.
//
// Rules kept intentionally simple; this is not an ML system:
//   - Extract keywords from <title> + <h1> + first market-copy paragraph
//   - Score every other page by keyword-overlap count
//   - Prefer cross-type mixing (an insights page pulls in glossary + compare
//     + other insights, not just a wall of insights)
//   - Minimum 2 shared keywords to qualify — weak matches are dropped
//   - 4 cards max per page
//
// Marker at </body> makes re-runs idempotent; bumping VERSION lets us extend
// the ranking heuristic without duplicating widgets.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.tradealphaai.com';

const VERSION = 'v1';
const MARKER_RE = /<!-- RELATED_CONTENT:[^>]+ -->/g;
const MAX_CARDS = 4;
const MIN_OVERLAP = 2;  // fewer than this → skip (no widget rendered)

// Content sources — each one contributes documents and receives widget
// injection. Order matters only for the cross-type mixing preference below.
//
// IMPORTANT: some content lives at BOTH `<dir>/` and `en/<dir>/` (the
// en-localized mirror maintained for hreflang parity). Both paths must be
// processed identically or the bilingual-structure check will fail with a
// section-count mismatch and block the whole publishing workflow.
const SOURCES = [
  { id: 'insights',   dir: 'insights',        label: 'Applied Research', badge: 'Research' },
  { id: 'articles',   dir: 'articles',        label: 'Educational',      badge: 'Article' },
  { id: 'compare',    dir: 'compare',         label: 'Comparison',       badge: 'Compare' },
  { id: 'glossary',   dir: 'glossary',        label: 'Glossary Term',    badge: 'Glossary' },
  { id: 'news',       dir: 'market-news',     label: 'Market News',      badge: 'News' },
  { id: 'news-intel', dir: 'intelligence',    label: 'Market News',      badge: 'News' },
  { id: 'outlook',    dir: 'market-outlook',  label: 'Market Outlook',   badge: 'Outlook' },
  { id: 'structure',  dir: 'market-structure',label: 'Market Structure', badge: 'Structure' },
  { id: 'briefs',     dir: 'briefs',          label: 'Market Brief',     badge: 'Brief' }
];

// Extra prefix roots that mirror the SOURCES dirs but only for a subset. The
// bilingual check compares en/insights ↔ ar/insights (not insights ↔ ar/insights),
// so leaving en-mirror pages untouched creates a section-count mismatch.
const EN_MIRROR_DIRS = ['insights', 'market-outlook', 'intelligence'];

// Words that add no topical signal — drop from keyword sets before scoring.
const STOP_WORDS = new Set([
  // English
  'the','a','an','and','or','but','of','to','in','on','at','by','for','from',
  'as','is','are','was','were','be','been','being','have','has','had','do',
  'does','did','will','would','should','could','may','might','can','this',
  'that','these','those','it','its','their','with','through','over','under',
  'not','no','if','then','than','so','also','more','most','less','some',
  'any','all','each','every','other','into','out','up','down','one','two',
  // Site-generic terms — near-universal, not useful for similarity
  'stock','stocks','etf','etfs','market','markets','research','educational',
  'guide','analysis','investing','investor','investors','platform','risk',
  'company','companies','asset','assets','tradealphaai','vs'
]);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && w.length <= 24 && !STOP_WORDS.has(w));
}

function extract(html, re) {
  const m = html.match(re);
  return m ? m[1] : '';
}

function readDoc(file, source, isAr) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const title = extract(html, /<title>([\s\S]*?)<\/title>/i)
    .replace(/&amp;/g, '&').replace(/\s*\|\s*TradeAlphaAI.*$/i, '').trim();
  const h1 = extract(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  // Locale by CONTENT, not just directory — a handful of legacy Arabic
  // articles live under the root (EN) dirs, and recommending them on English
  // pages puts Arabic card titles into EN articles (article-pair hard fail).
  if (!isAr && /[؀-ۿ]/.test(title + h1)) isAr = true;
  const desc = extract(html, /<meta\s+name="description"\s+content="([^"]*)"/i);
  const firstPara = extract(html, /<p class="market-copy">([\s\S]*?)<\/p>/i).replace(/<[^>]+>/g, '').trim();
  if (!title && !h1) return null;

  const keywords = new Set([...tokenize(title), ...tokenize(h1), ...tokenize(firstPara).slice(0, 40)]);
  const slug = path.basename(file, '.html');
  const relDir = path.relative(ROOT, path.dirname(file)).replace(/\\/g, '/');
  // en/-mirror pages are hreflang aliases of the canonical root pages. All
  // recommendation LINKS must point at the canonical path — otherwise the
  // canonical article and its en/ twin split the inbound-link budget between
  // them and both stay SEO-orphans.
  const url = '/' + relDir.replace(/^en\//, '') + '/' + path.basename(file);
  return {
    file, url, slug,
    source: source.id, badge: source.badge, label: source.label,
    isAr,
    title: title || h1,
    keywords
  };
}

function listHtml(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter((f) => f.endsWith('.html') && f !== 'index.html')
    .map((f) => path.join(abs, f));
}

function buildCorpus() {
  const docs = [];
  for (const source of SOURCES) {
    for (const f of listHtml(source.dir)) {
      const d = readDoc(f, source, false);
      if (d) docs.push(d);
    }
    // en-mirror pages must be processed identically to the canonical dir so
    // section counts stay parity-matched against the ar/ mirror.
    if (EN_MIRROR_DIRS.includes(source.dir)) {
      for (const f of listHtml('en/' + source.dir)) {
        const d = readDoc(f, source, false);
        if (d) docs.push(d);
      }
    }
    for (const f of listHtml('ar/' + source.dir)) {
      const d = readDoc(f, source, true);
      if (d) docs.push(d);
    }
  }
  return docs;
}

function overlapScore(a, b) {
  let hits = 0;
  for (const kw of a.keywords) if (b.keywords.has(kw)) hits++;
  return hits;
}

function findRelated(doc, docs) {
  const scored = [];
  for (const other of docs) {
    if (other.file === doc.file) continue;
    if (other.url === doc.url) continue;     // canonical/en-mirror twins
    if (other.isAr !== doc.isAr) continue;   // stay in same locale
    const score = overlapScore(doc, other);
    if (score < MIN_OVERLAP) continue;
    scored.push({ other, score });
  }
  scored.sort((a, b) => b.score - a.score);

  // Cross-type mixing: prefer variety of sources in the top MAX_CARDS.
  // seenUrls guards against the canonical page and its en/-mirror twin (same
  // canonical url) both landing in one widget as duplicate cards.
  const picked = [];
  const seenSources = new Set();
  const seenUrls = new Set();
  const remaining = [];
  for (const s of scored) {
    if (seenUrls.has(s.other.url)) continue;
    if (!seenSources.has(s.other.source) && picked.length < MAX_CARDS) {
      picked.push(s);
      seenSources.add(s.other.source);
      seenUrls.add(s.other.url);
    } else {
      remaining.push(s);
    }
  }
  // Fill any remaining slots with next-highest scores regardless of type.
  for (const s of remaining) {
    if (picked.length >= MAX_CARDS) break;
    if (seenUrls.has(s.other.url)) continue;
    picked.push(s);
    seenUrls.add(s.other.url);
  }
  return picked;
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderWidget(related, isAr) {
  if (!related.length) return '';
  const heading = isAr ? 'أبحاث ذات صلة' : 'Related research';
  const eyebrow = isAr ? 'تابع القراءة' : 'Continue reading';

  const cards = related.map(({ other }) => {
    const badge = isAr ? arBadge(other.source) : other.badge;
    return `        <a class="insight-stat-card" href="${esc(other.url)}" style="text-decoration:none">
          <span>${esc(badge)}</span>
          <strong>${esc(other.title)}</strong>
        </a>`;
  }).join('\n');

  return `<!-- RELATED_CONTENT:${VERSION} -->
<section class="market-section related-content-section">
  <div class="market-panel">
    <span class="eyebrow">${eyebrow}</span>
    <h2>${heading}</h2>
    <div class="insight-stat-grid" style="margin-top:12px">
${cards}
    </div>
  </div>
</section>
`;
}

function arBadge(source) {
  return {
    insights: 'أبحاث تطبيقية',
    articles: 'مقال تعليمي',
    compare: 'مقارنة',
    glossary: 'مصطلح',
    news: 'أخبار السوق',
    'news-intel': 'أخبار السوق',
    outlook: 'نظرة السوق',
    structure: 'بنية السوق',
    briefs: 'إحاطة'
  }[source] || source;
}

// The widget goes INSIDE the .market-shell wrap, just before its closing </div>
// pair. If the page doesn't have that shell (e.g. a very minimal template),
// fall back to injecting just before </body>.
function injectWidget(html, widgetHtml) {
  const shellMatch = html.match(/(<main class="market-shell">[\s\S]*?<\/div>)([\s\S]*?<\/main>)/);
  if (shellMatch) {
    return html.replace(shellMatch[0], `${shellMatch[1]}\n${widgetHtml}\n${shellMatch[2]}`);
  }
  return html.replace(/<\/body>/i, `${widgetHtml}\n</body>`);
}

function processDoc(doc, related) {
  let html;
  try { html = fs.readFileSync(doc.file, 'utf8'); } catch { return { skipped: true }; }

  // Strip any previous widget so re-runs get fresh recommendations.
  const previous = html.match(/<!-- RELATED_CONTENT:[^>]+ -->[\s\S]*?<\/section>\s*/);
  if (previous) html = html.replace(previous[0], '');

  if (!related.length) return { skipped: 'no_matches' };

  const widget = renderWidget(related, doc.isAr);
  const updated = injectWidget(html, widget);
  if (updated === html) return { skipped: 'no_change' };

  fs.writeFileSync(doc.file, updated, 'utf8');
  return { installed: true, count: related.length };
}

// Every content page must be RECOMMENDED at least this many times across the
// site. Similarity alone leaves newly published articles with zero inbound
// links (the orphan-pages report flagged 64 orphans at risk_score 90) — the
// coverage pass below force-inserts under-linked pages into their
// most-similar hosts so no article ships as an SEO orphan.
const MIN_INBOUND = 2;

function guaranteeCoverage(docs, picks) {
  // Inbound is counted per canonical URL (en/-mirror twins share one URL) so
  // the guarantee reflects what search engines actually see.
  const inbound = new Map();
  for (const list of picks.values()) {
    for (const { other } of list) inbound.set(other.url, (inbound.get(other.url) || 0) + 1);
  }

  let promoted = 0;
  const seenTargets = new Set();
  for (const doc of docs) {
    if (seenTargets.has(doc.url)) continue; // handle each canonical target once
    seenTargets.add(doc.url);
    let count = inbound.get(doc.url) || 0;
    if (count >= MIN_INBOUND) continue;
    const hosts = docs
      .filter((h) => h.file !== doc.file && h.url !== doc.url && h.isAr === doc.isAr)
      .map((h) => ({ h, score: overlapScore(doc, h) }))
      .sort((a, b) => b.score - a.score);
    for (const { h, score } of hosts) {
      if (count >= MIN_INBOUND) break;
      const list = picks.get(h.file) || [];
      if (list.some((p) => p.other.url === doc.url)) continue;
      if (list.length >= MAX_CARDS) {
        list.sort((a, b) => b.score - a.score);
        list[list.length - 1] = { other: doc, score };
      } else {
        list.push({ other: doc, score });
      }
      picks.set(h.file, list);
      count++;
      promoted++;
    }
    inbound.set(doc.url, count);
  }
  return promoted;
}

function main() {
  console.log('[related-content] building corpus...');
  const docs = buildCorpus();
  console.log(`[related-content] corpus size: ${docs.length} docs`);

  const picks = new Map();
  for (const doc of docs) picks.set(doc.file, findRelated(doc, docs));
  const promoted = guaranteeCoverage(docs, picks);

  let installed = 0, skipped = 0, totalLinks = 0;
  for (const doc of docs) {
    const r = processDoc(doc, picks.get(doc.file) || []);
    if (r.installed) { installed++; totalLinks += r.count; }
    else skipped++;
  }

  console.log(`[related-content] version:       ${VERSION}`);
  console.log(`[related-content] widgets added: ${installed}`);
  console.log(`[related-content] skipped:       ${skipped}`);
  console.log(`[related-content] total links:   ${totalLinks}`);
  console.log(`[related-content] coverage promotions: ${promoted} (min inbound ${MIN_INBOUND})`);
  console.log(`[related-content] avg per page:  ${installed ? (totalLinks / installed).toFixed(2) : 0}`);
}

if (require.main === module) main();

module.exports = { buildCorpus, findRelated, renderWidget };
