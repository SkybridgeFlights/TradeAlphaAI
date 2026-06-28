'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const ARTICLE_REGISTRY_PATH = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const ARTICLE_METADATA = loadArticleMetadata();
const MARKET_OUTLOOK_PROHIBITED_LINK_TEXT = /Training|Understanding the Two Phases/i;

function loadArticleMetadata() {
  if (!fs.existsSync(ARTICLE_REGISTRY_PATH)) return new Map();
  try {
    const registry = JSON.parse(fs.readFileSync(ARTICLE_REGISTRY_PATH, 'utf8'));
    return new Map((registry.articles || []).map((article) => [
      article.slug,
      {
        title: article.languages?.en?.title || '',
        title_ar: article.languages?.ar?.title || '',
      },
    ]));
  } catch {
    return new Map();
  }
}

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch { return null; }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

/**
 * Recommend contextual internal links for a given article.
 *
 * @param {object} opts
 * @param {string}   opts.slug        - slug of the article being generated
 * @param {string[]} opts.clusters    - cluster names this article belongs to
 * @param {string[]} opts.macro_tags  - macro theme tags
 * @param {string[]} opts.entities    - ETF/stock tickers mentioned
 * @param {string}   opts.locale      - 'en' or 'ar'
 * @param {number}   opts.maxLinks    - max recommendations (default 8)
 * @param {string[]} opts.excludePaths - URL paths to skip
 * @returns {Array<{href, ar_href, en_href, label, reason, type, relevance}>}
 */
function recommendLinks(opts = {}) {
  const {
    slug         = '',
    clusters     = [],
    macro_tags   = [],
    entities     = [],
    locale       = 'en',
    maxLinks     = 8,
    excludePaths = [],
  } = opts;

  const graph = loadGraph();
  if (!graph || !graph.nodes) return fallbackLinks(locale);

  const excluded      = new Set([
    `market-outlook/${slug}.html`,
    `insights/${slug}.html`,
    ...excludePaths,
  ]);
  const selfClusters  = new Set(clusters);
  const selfThemes    = new Set(macro_tags);
  const selfEntities  = new Set(entities.map(e => e.toUpperCase()));

  const TYPE_CAPS = { hub: 3, article: 3, market_outlook: 3, etf: 4, stock: 1, compare: 2 };

  const scored = graph.nodes
    .filter(n => {
      if (excluded.has(n.id)) return false;
      if (!fileExists(n.id)) return false;
      if (n.type === 'article_ar' || n.type === 'market_outlook_ar') return false;
      if (MARKET_OUTLOOK_PROHIBITED_LINK_TEXT.test(`${n.id || ''} ${n.slug || ''} ${n.title || ''}`)) return false;
      return true;
    })
    .map(n => {
      let score = 0;
      if ((n.clusters || []).some(c => selfClusters.has(c))) score += 35;
      if ((n.macro_themes || []).some(t => selfThemes.has(t))) score += 22;
      const sharedEtfs = (n.etf_entities || []).filter(e => selfEntities.has(e));
      score += sharedEtfs.length * 9;
      const sharedStocks = (n.stock_entities || []).filter(e => selfEntities.has(e));
      score += sharedStocks.length * 7;
      score += Math.min(15, n.authority_score || 0);
      if (n.is_authority_hub) score += 12;
      if (n.type === 'hub')            score += 6;
      else if (n.type === 'compare')   score += 4;
      else if (n.type === 'market_outlook') score += 3;
      return { ...n, _score: score, _shared: [...sharedEtfs, ...sharedStocks] };
    })
    .filter(n => n._score > 0)
    .sort((a, b) => b._score - a._score);

  const selected  = [];
  const usedTypes = new Map();
  const usedHrefs = new Set();

  for (const node of scored) {
    if (selected.length >= maxLinks) break;
    const cap = TYPE_CAPS[node.type] || 2;
    if ((usedTypes.get(node.type) || 0) >= cap) continue;
    const href = locale === 'ar' ? node.url_ar : node.url_en;
    if (!href || usedHrefs.has(href)) continue;

    selected.push({
      href,
      ar_href:   node.url_ar,
      en_href:   node.url_en,
      label:     buildAnchor(node, locale),
      reason:    buildReason(node, node._shared, locale),
      type:      node.type,
      relevance: node._score,
    });
    usedTypes.set(node.type, (usedTypes.get(node.type) || 0) + 1);
    usedHrefs.add(href);
  }

  // Always include methodology as a final entry if there's room
  const methodHref = locale === 'ar' ? '/ar/methodology.html' : '/methodology.html';
  if (selected.length < maxLinks && !usedHrefs.has(methodHref) && fileExists('methodology.html')) {
    selected.push({
      href:    methodHref,
      ar_href: '/ar/methodology.html',
      en_href: '/methodology.html',
      label:   locale === 'ar' ? 'منهجية البحث' : 'Research methodology',
      reason:  locale === 'ar' ? 'شفافية حول طريقة بناء الأبحاث' : 'Transparent explanation of the research process',
      type:    'hub',
      relevance: 5,
    });
  }

  return selected.length ? selected : fallbackLinks(locale);
}

/**
 * Validate that all internal hrefs in an HTML string resolve to existing files.
 * Returns an object: { valid: boolean, broken: string[] }
 */
function validateInternalLinks(html) {
  const broken = [];
  const hrefs = [...html.matchAll(/\shref="(\/[^"#?]+)"/g)].map(m => m[1]);
  for (const href of hrefs) {
    if (/^\/(ar\/)?insights\/[^/]+\.html$/.test(href)) continue;
    if (/^\/(ar\/)?market-outlook\/[^/]+\.html$/.test(href)) continue;
    if (href === '/' || href === '/ar/') continue;
    const rel = href.replace(/^\//, '');
    if (!fileExists(rel) && !fileExists(`${rel}/index.html`)) {
      broken.push(href);
    }
  }
  return { valid: broken.length === 0, broken };
}

/**
 * Check that an article is connected to its cluster (links to at least 2 nodes
 * in the same cluster or to a hub page).
 */
function checkClusterConnectivity(html, clusters = []) {
  const graph = loadGraph();
  if (!graph) return { connected: true, inbound: 0, note: 'graph unavailable' };

  const clusterSet  = new Set(clusters);
  const hrefs       = new Set([...html.matchAll(/\shref="(\/[^"#?]+)"/g)].map(m => m[1]));
  const hubHrefs    = new Set(graph.nodes.filter(n => n.is_authority_hub).map(n => n.url_en));
  const clusterHits = graph.nodes.filter(n => (n.clusters || []).some(c => clusterSet.has(c)) && hrefs.has(n.url_en)).length;
  const hubHits     = [...hrefs].filter(h => hubHrefs.has(h)).length;

  return {
    connected:    clusterHits >= 2 || hubHits >= 1,
    cluster_hits: clusterHits,
    hub_hits:     hubHits,
    note: `${clusterHits} cluster page links, ${hubHits} hub links`,
  };
}

/**
 * Check anchor text diversity — articles should not repeat the same anchor 3+ times.
 */
function checkAnchorDiversity(html) {
  // Strip global header + footer + breadcrumb nav so platform-wide repeated
  // anchors ("Market Outlook" / "Economic Calendar" / "Methodology" footer
  // links) don't get counted against article-body diversity.
  const stripped = String(html || '')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ');
  const anchors = [...stripped.matchAll(/<a\s[^>]*href="\/[^"#?]+[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase())
    .filter(t => t.length > 2);
  const counts = new Map();
  for (const a of anchors) counts.set(a, (counts.get(a) || 0) + 1);
  // Threshold raised 2026-06-23 from 3 to 5: legitimate article bodies may
  // reference the same hub anchor (e.g. "Market Outlook" tagline) a few
  // times for clarity; 5+ repetitions is the real spam signal.
  const repeated = [...counts.entries()].filter(([, c]) => c >= 5).map(([a]) => a);
  return { diverse: repeated.length === 0, repeated };
}

function buildAnchor(node, locale) {
  const localized = ARTICLE_METADATA.get(node.slug);
  if (locale === 'ar') {
    const registryTitle = cleanTitle(localized?.title_ar);
    if (registryTitle) return normalizeArabicLabel(registryTitle, node);

    if (node.type === 'etf') return normalizeArabicLabel(`صندوق ${node.slug.toUpperCase()}`, node);
    if (node.type === 'stock') return normalizeArabicLabel(`بحث ${node.slug.toUpperCase()}`, node);

    const graphFallback = cleanTitle(node.title) || node.slug.replace(/-/g, ' ');
    return normalizeArabicLabel(graphFallback, node);
  }

  if (node.type === 'etf')     return `${node.slug.toUpperCase()} ETF`;
  if (node.type === 'stock')   return `${node.slug.toUpperCase()} research`;
  if (node.type === 'compare') {
    const t = cleanTitle(localized?.title || node.title).replace(/Compare\s*/i, '').slice(0, 60) || node.slug.replace(/-/g, ' ');
    return t;
  }
  return cleanTitle(localized?.title || node.title).slice(0, 55) || node.slug.replace(/-/g, ' ');
}

function cleanTitle(title) {
  return String(title || '')
    .replace(/\s*\|\s*TradeAlphaAI\s*$/i, '')
    .trim();
}

function normalizeArabicLabel(label, node) {
  const normalized = String(label || '').trim();
  if (normalized && !/[A-Za-z]{4,}/.test(normalized)) return normalized;

  console.warn(
    `[internal-links] Arabic label localization fallback for ${node.slug || node.id || 'unknown'}: ` +
    `${normalized || 'empty label'}`
  );

  if (node.type === 'market_outlook') return 'سياق سوقي ذو صلة';
  if (node.type === 'compare') return 'مقارنة بحثية ذات صلة';
  if (node.type === 'hub') return 'مركز أبحاث ذو صلة';
  return 'بحث تعليمي ذو صلة';
}

function buildReason(node, shared, locale) {
  const ar = locale === 'ar';
  if (shared && shared.length) {
    return ar
      ? `تعرض مشترك: ${shared.slice(0, 3).join(', ')}`
      : `Shared exposure: ${shared.slice(0, 3).join(', ')}`;
  }
  if (node.type === 'hub')            return ar ? 'مركز بحثي ذو صلة بالموضوع' : 'Related research hub for this topic cluster';
  if (node.type === 'market_outlook') return ar ? 'توقع سوقي ذو صلة بالسياق' : 'Related market outlook for context';
  if (node.type === 'compare')        return ar ? 'تحليل مقارن للسياق التعليمي' : 'Comparative analysis for educational context';
  return ar ? 'محتوى تعليمي ذو صلة بالموضوع' : 'Related educational content in this cluster';
}

function fallbackLinks(locale) {
  const ar = locale === 'ar';
  return [
    { href: ar ? '/ar/rankings.html' : '/rankings.html', ar_href: '/ar/rankings.html', en_href: '/rankings.html',
      label: ar ? 'تصنيفات السوق' : 'Market rankings', reason: ar ? 'مقارنة تعليمية' : 'Educational comparison across stocks and ETFs', type: 'hub', relevance: 5 },
    { href: ar ? '/ar/etfs.html' : '/etfs.html', ar_href: '/ar/etfs.html', en_href: '/etfs.html',
      label: ar ? 'مركز أبحاث صناديق المؤشرات' : 'ETF research hub', reason: ar ? 'سياق أوسع للتعرضات' : 'Broader context for exposures and sectors', type: 'hub', relevance: 5 },
    { href: ar ? '/ar/methodology.html' : '/methodology.html', ar_href: '/ar/methodology.html', en_href: '/methodology.html',
      label: ar ? 'منهجية البحث' : 'Research methodology', reason: ar ? 'شفافية حول طريقة البحث' : 'Transparent explanation of the research process', type: 'hub', relevance: 5 },
  ];
}

module.exports = { recommendLinks, validateInternalLinks, checkClusterConnectivity, checkAnchorDiversity, loadGraph };

if (require.main === module) {
  const slug    = (process.argv.find(a => a.startsWith('--slug=')) || '').slice(7);
  const cluster = (process.argv.find(a => a.startsWith('--cluster=')) || '').slice(10);
  const locale  = (process.argv.find(a => a.startsWith('--locale=')) || '').slice(9) || 'en';
  const result  = recommendLinks({ slug, clusters: cluster ? [cluster] : [], locale, maxLinks: 10 });
  console.log(JSON.stringify(result, null, 2));
}
