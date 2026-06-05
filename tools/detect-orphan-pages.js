'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const OUT        = path.join(ROOT, 'data', 'orphan-pages-report.json');
const write      = process.argv.includes('--write');

// Pages that are legitimately standalone (no inbound requirement)
const STANDALONE_EXEMPT = new Set([
  'methodology.html', 'rankings.html', 'index.html',
  'stocks.html', 'etfs.html', 'etf.html', 'stock.html',
]);

// Navigation links that exist site-wide (nav bar, footer) — don't count these as real inbound authority
const NAV_SOURCES = new Set([
  'index.html', 'rankings.html', 'stocks.html', 'etfs.html',
]);

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch { return null; }
}

function buildInboundMap(edges) {
  const map = {};
  for (const e of edges) {
    if (e.relationship !== 'links_to') continue;
    if (NAV_SOURCES.has(e.from)) continue; // exclude nav-only links
    (map[e.to] = map[e.to] || []).push(e.from);
  }
  return map;
}

function classifyOrphan(node, inboundSources) {
  const count = inboundSources.length;
  if (count === 0) return 'true_orphan';
  if (count === 1) return 'weak_single_inbound';
  if (count <= 2) return 'weak_low_inbound';
  return null;
}

function orphanRiskScore(node, inboundCount) {
  const typeWeights = { article: 3, market_outlook: 3, compare: 2, etf: 1, stock: 1, hub: 0 };
  const base        = typeWeights[node.type] || 1;
  if (inboundCount === 0) return base * 30;
  if (inboundCount === 1) return base * 15;
  if (inboundCount === 2) return base * 8;
  return 0;
}

function detectOrphans(graph) {
  const inbound = buildInboundMap(graph.edges || []);
  const orphans  = [];
  const weak     = [];
  const healthy  = [];

  for (const node of graph.nodes || []) {
    if (!fs.existsSync(path.join(ROOT, node.id))) continue;
    if (STANDALONE_EXEMPT.has(node.id)) continue;
    if (node.type === 'article_ar' || node.type === 'market_outlook_ar') continue;

    const sources    = inbound[node.id] || [];
    const category   = classifyOrphan(node, sources);
    const riskScore  = orphanRiskScore(node, sources.length);

    const entry = {
      id:            node.id,
      type:          node.type,
      title:         node.title,
      url:           node.url_en,
      inbound_count: sources.length,
      inbound_pages: sources.slice(0, 5),
      authority:     node.authority_score || 0,
      risk_score:    riskScore,
      clusters:      node.clusters || [],
    };

    if (category === 'true_orphan')          { entry.status = 'orphan'; orphans.push(entry); }
    else if (category === 'weak_single_inbound') { entry.status = 'weak'; weak.push(entry); }
    else if (category === 'weak_low_inbound')    { entry.status = 'weak'; weak.push(entry); }
    else                                         { entry.status = 'healthy'; healthy.push(entry); }
  }

  orphans.sort((a, b) => b.risk_score - a.risk_score);
  weak.sort((a, b) => b.risk_score - a.risk_score);

  return { orphans, weak, healthy };
}

const graph = loadGraph();
if (!graph) {
  console.error('content-knowledge-graph.json not found. Run: node tools/build-content-knowledge-graph.js --write');
  process.exit(1);
}

const { orphans, weak, healthy } = detectOrphans(graph);

const output = {
  version:      '1.0',
  generated_at: new Date().toISOString(),
  summary: {
    orphan_count:  orphans.length,
    weak_count:    weak.length,
    healthy_count: healthy.length,
    total_scanned: orphans.length + weak.length + healthy.length,
    orphan_ratio:  orphans.length + weak.length + healthy.length > 0
      ? parseFloat(((orphans.length / (orphans.length + weak.length + healthy.length)) * 100).toFixed(1))
      : 0,
  },
  orphans,
  weak_pages: weak,
};

if (write) {
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Orphan pages report written → ${OUT}`);
  console.log(`  Orphans: ${orphans.length}  Weak: ${weak.length}  Healthy: ${healthy.length}`);
  if (orphans.length) {
    console.log('  True orphans:');
    orphans.slice(0, 5).forEach(o => console.log(`    - ${o.id}`));
  }
} else {
  console.log(JSON.stringify(output, null, 2));
}

module.exports = { detectOrphans };
