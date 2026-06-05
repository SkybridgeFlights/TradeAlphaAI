'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const OUT   = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const write = process.argv.includes('--write');

// ── Entity dictionaries ────────────────────────────────────────────────────────

const ETF_TICKERS = [
  'SPY','QQQ','IWM','TLT','IEF','SHY','BND','AGG','LQD','HYG','GLD','SLV','GDX',
  'SMH','SOXX','XLK','XLF','XLE','XLU','XLV','XLI','XLRE','XLP','XLB','XLY','XLC',
  'SCHD','VIG','JEPI','VTI','VOO','RSP','ARKK','ARKQ','ARKG','BOTZ','ICLN',
  'DIA','EEM','EFA','IEMG','MTUM','DGRO',
];

const STOCK_TICKERS = [
  'NVDA','AMD','TSMC','TSM','ASML','INTC','QCOM','AVGO','AAPL','MSFT',
  'GOOGL','META','AMZN','TSLA','JPM','BAC','GS','ABBV','AMGN','ADBE','AMAT',
  'ARM','ABNB',
];

const THEME_PATTERNS = {
  yields_rates:     /\b(yield|treasury|rate|fed|fomc|inflation|cpi|duration|bond|curve|tlt|ief|bnd)\b/i,
  ai_semiconductor: /\b(ai|artificial.intell|semiconductor|chip|nvda|amd|smh|soxx|gpu|inference|llm)\b/i,
  etf_rotation:     /\b(etf.rot|sector.rot|allocation|rotation|flow)\b/i,
  market_breadth:   /\b(breadth|participation|concentration|equal.weight|small.cap|iwm|rsp|narrow.lead)\b/i,
  volatility:       /\b(volatil|vix|vol.regime|regime|hedging)\b/i,
  growth_value:     /\b(growth|value|factor|momentum|quality|arkk)\b/i,
  defensive_income: /\b(defensive|dividend|utility|healthcare|schd|vig|jepi|xlv|xlu)\b/i,
  global_macro:     /\b(dollar|dxy|gold|gld|commodity|emerging|eem|global.macro)\b/i,
};

const CLUSTER_PATTERNS = {
  ai_semiconductor:       /ai.semi|ai.sector|semiconductor|chip|gpu|nvda|smh|soxx|xlk/i,
  etf_education:          /etf.education|etf.structure|expense.ratio|etf.diversif|etf.risk|etf.expense/i,
  yield_rates:            /yield|rate.context|treasury|duration|bond.etf|tlt|ief|bnd|rates.macro/i,
  market_structure:       /market.regime|market.breadth|volatil|market.struct|regime.context/i,
  defensive_sectors:      /defensive|dividend|income|healthcare|utility|xlv|xlu|schd|vig|jepi/i,
  growth_value:           /growth.value|growth.stock|value.stock|factor|arkk|momentum/i,
  portfolio_construction: /portfolio|diversif|risk.manag/i,
  sector_rotation:        /sector.rotat|etf.rotat/i,
};

const HUB_FILES = [
  'ai-stocks.html','ai-etfs.html','bond-etfs.html','commodity-etfs.html',
  'cybersecurity-stocks.html','defensive-etfs.html','defensive-stocks.html',
  'dividend-etfs.html','dividend-stocks.html','emerging-market-etfs.html',
  'energy-stocks.html','etfs.html','fintech-stocks.html','growth-stocks.html',
  'healthcare-etfs.html','healthcare-stocks.html','low-volatility-etfs.html',
  'momentum-stocks.html','rankings.html','real-estate-etfs.html',
  'semiconductor-stocks.html','stocks.html','methodology.html',
];

// ── HTML utilities ─────────────────────────────────────────────────────────────

function readHtml(relPath) {
  const abs = path.join(ROOT, relPath);
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
}

function extractTitle(html) {
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '';
  if (h1) return h1.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  const t = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  return t.replace(/\s*\|.*$/, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

function extractDescription(html) {
  const m = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
  return m ? m[1].slice(0, 200) : '';
}

function extractOutboundLinks(html, selfPath) {
  const links = new Set();
  const re = /href="([^"#?]+)"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    let href = m[1].trim();
    if (/^(https?:|mailto:|tel:|\/\/)/i.test(href)) continue;
    if (href.startsWith('/ar/')) continue;
    if (href.startsWith('/')) href = href.slice(1);
    href = href.replace(/^\.\//, '').replace(/\/index\.html$/, '/').replace(/^index\.html$/, '');
    if (href && href !== selfPath && !href.startsWith('#') && href.endsWith('.html')) links.add(href);
  }
  return [...links];
}

function extractEntities(text) {
  const upper = text.toUpperCase();
  const etfs   = ETF_TICKERS.filter(t => new RegExp(`\\b${t}\\b`).test(upper));
  const stocks = STOCK_TICKERS.filter(t => new RegExp(`\\b${t}\\b`).test(upper));
  return { etfs, stocks };
}

function extractThemes(text) {
  return Object.entries(THEME_PATTERNS).filter(([, re]) => re.test(text)).map(([k]) => k);
}

function extractClusters(slug, title) {
  const hay = `${slug} ${title}`.toLowerCase();
  const hits = Object.entries(CLUSTER_PATTERNS).filter(([, re]) => re.test(hay)).map(([k]) => k);
  return hits.length ? hits : ['general'];
}

// ── Scanners ───────────────────────────────────────────────────────────────────

function scanDir(dirName, nodeType) {
  const dir = path.join(ROOT, dirName);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.endsWith('.html') && e.name !== 'index.html')
    .map(e => {
      const relPath = `${dirName}/${e.name}`;
      const html    = readHtml(relPath);
      const slug    = e.name.replace(/\.html$/, '');
      const title   = extractTitle(html);
      const desc    = extractDescription(html);
      const bag     = `${slug} ${title} ${desc}`;
      const { etfs, stocks } = extractEntities(bag);
      return {
        id:             relPath,
        type:           nodeType,
        slug,
        title,
        description:    desc,
        url_en:         `/${relPath}`,
        url_ar:         `/ar/${relPath}`,
        etf_entities:   etfs,
        stock_entities: stocks,
        macro_themes:   extractThemes(bag),
        clusters:       extractClusters(slug, title),
        _links:         extractOutboundLinks(html, relPath),
      };
    });
}

function scanHubs() {
  return HUB_FILES
    .filter(f => fs.existsSync(path.join(ROOT, f)))
    .map(f => {
      const html  = readHtml(f);
      const slug  = f.replace(/\.html$/, '');
      const title = extractTitle(html) || slug.replace(/-/g, ' ');
      const desc  = extractDescription(html);
      const bag   = `${slug} ${title}`;
      const { etfs, stocks } = extractEntities(bag);
      return {
        id:               f,
        type:             'hub',
        slug,
        title:            title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        description:      desc,
        url_en:           `/${f}`,
        url_ar:           `/ar/${f}`,
        etf_entities:     etfs,
        stock_entities:   stocks,
        macro_themes:     extractThemes(bag),
        clusters:         extractClusters(slug, title),
        is_authority_hub: true,
        _links:           extractOutboundLinks(html, f),
      };
    });
}

// ── Edge builders ──────────────────────────────────────────────────────────────

function buildLinkEdges(nodes) {
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = [];
  for (const node of nodes) {
    for (const link of node._links || []) {
      const target = nodeIds.has(link) ? link : null;
      if (target) edges.push({ from: node.id, to: target, relationship: 'links_to', weight: 1.0 });
    }
  }
  return edges;
}

function buildSemanticEdges(nodes) {
  const edges = [];
  const byClusters = {};
  for (const node of nodes) {
    for (const c of node.clusters || []) {
      if (c === 'general') continue;
      (byClusters[c] = byClusters[c] || []).push(node);
    }
  }
  for (const members of Object.values(byClusters)) {
    for (let i = 0; i < members.length && i < 30; i++) {
      for (let j = i + 1; j < members.length && j < 30; j++) {
        if (edges.length < 2000) {
          edges.push({ from: members[i].id, to: members[j].id, relationship: 'related_to', weight: 0.6 });
        }
      }
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = (nodes[i].etf_entities || []).filter(t => (nodes[j].etf_entities || []).includes(t));
      if (shared.length >= 2 && edges.length < 2400) {
        edges.push({ from: nodes[i].id, to: nodes[j].id, relationship: 'asset_exposure', weight: Math.min(1.0, 0.4 + shared.length * 0.1), shared_entities: shared });
      }
    }
  }
  return edges;
}

const CURATED_PAIRS = [
  { slugA: 'spy-vs-qqq',                   slugB: 'etf-diversification-guide',    rel: 'expands_on' },
  { slugA: 'growth-etfs-vs-value-etfs',     slugB: 'growth-stocks-vs-value-stocks', rel: 'sector_overlap' },
  { slugA: 'bnd-vs-ief',                    slugB: 'dividend-etfs-explained',       rel: 'related_to' },
  { slugA: 'yield-context-2026-06-09',      slugB: 'etf-rotation-2026-06-08',       rel: 'continuation_of' },
  { slugA: 'ai-sector-2026-06-06',          slugB: 'yield-context-2026-06-09',      rel: 'macro_dependency' },
  { slugA: 'ai-sector-2026-06-06',          slugB: 'etf-rotation-2026-06-08',       rel: 'related_to' },
  { slugA: 'market-regime-2026-06-11',      slugB: 'yield-context-2026-06-09',      rel: 'linked_by_regime' },
  { slugA: 'market-regime-2026-06-11',      slugB: 'ai-sector-2026-06-06',          rel: 'linked_by_regime' },
  { slugA: 'interest-rates-and-tech-stocks',slugB: 'yield-context-2026-06-09',      rel: 'expands_on' },
  { slugA: 'etf-risk-comparison-guide',     slugB: 'etf-diversification-guide',     rel: 'expands_on' },
  { slugA: 'defensive-investing-explained', slugB: 'dividend-etfs-explained',       rel: 'related_to' },
];

function buildCuratedEdges(nodes) {
  const slugMap = new Map(nodes.map(n => [n.slug, n.id]));
  return CURATED_PAIRS
    .filter(p => slugMap.has(p.slugA) && slugMap.has(p.slugB))
    .map(p => ({ from: slugMap.get(p.slugA), to: slugMap.get(p.slugB), relationship: p.rel, weight: 0.9 }));
}

// ── Authority scoring ──────────────────────────────────────────────────────────

function computeAuthority(nodes, edges) {
  const inbound = {};
  for (const e of edges) {
    if (e.relationship === 'links_to') inbound[e.to] = (inbound[e.to] || 0) + 1;
  }
  for (const n of nodes) {
    const ibl = inbound[n.id] || 0;
    n.inbound_link_count = ibl;
    n.authority_score    = ibl === 0 ? 0 : Math.min(100, Math.round(10 * Math.log2(ibl + 1) * 3.5));
  }
}

function dedupeEdges(edges) {
  const seen = new Set();
  return edges.filter(e => {
    const key = `${e.from}|${e.to}|${e.relationship}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────

const allNodes = [
  ...scanDir('insights', 'article'),
  ...scanDir('market-outlook', 'market_outlook'),
  ...scanDir('etfs', 'etf'),
  ...scanDir('stocks', 'stock'),
  ...scanDir('compare', 'compare'),
  ...scanHubs(),
];

const linkEdges     = buildLinkEdges(allNodes);
const semanticEdges = buildSemanticEdges(allNodes);
const curatedEdges  = buildCuratedEdges(allNodes);
const allEdges      = dedupeEdges([...linkEdges, ...curatedEdges, ...semanticEdges]);

computeAuthority(allNodes, allEdges);
const finalNodes = allNodes.map(({ _links, ...rest }) => rest);

const graph = {
  version:      '1.0',
  generated_at: new Date().toISOString(),
  description:  'Content knowledge graph: articles, ETFs, stocks, hubs, comparisons, and their semantic relationships.',
  stats: {
    total_nodes:    finalNodes.length,
    total_edges:    allEdges.length,
    link_edges:     linkEdges.length,
    semantic_edges: semanticEdges.length,
    curated_edges:  curatedEdges.length,
    by_type: finalNodes.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {}),
  },
  nodes: finalNodes,
  edges: allEdges,
};

if (write) {
  fs.writeFileSync(OUT, JSON.stringify(graph, null, 2) + '\n', 'utf8');
  console.log(`Content knowledge graph written → ${OUT}`);
  console.log(`  Nodes: ${finalNodes.length}  Edges: ${allEdges.length}`);
  console.log(`  By type: ${JSON.stringify(graph.stats.by_type)}`);
} else {
  console.log(JSON.stringify(graph, null, 2));
}
