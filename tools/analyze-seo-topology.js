'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const GRAPH_PATH    = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const CLUSTERS_PATH = path.join(ROOT, 'data', 'content-clusters.json');
const ORPHAN_PATH   = path.join(ROOT, 'data', 'orphan-pages-report.json');
const OUT           = path.join(ROOT, 'data', 'seo-topology-report.json');
const write         = process.argv.includes('--write');

function readJson(p, fallback = null) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function computeAuthorityDistribution(nodes) {
  const scores = nodes.map(n => n.authority_score || 0).sort((a, b) => b - a);
  const total  = scores.length;
  if (!total) return {};
  const sum    = scores.reduce((s, v) => s + v, 0);
  return {
    mean:     parseFloat((sum / total).toFixed(2)),
    median:   scores[Math.floor(total / 2)],
    top_10pct_avg: parseFloat((scores.slice(0, Math.max(1, Math.floor(total * 0.1))).reduce((s, v) => s + v, 0) / Math.max(1, Math.floor(total * 0.1))).toFixed(2)),
    zero_authority_count: scores.filter(s => s === 0).length,
    zero_authority_pct:   parseFloat(((scores.filter(s => s === 0).length / total) * 100).toFixed(1)),
  };
}

function computeClusterDepth(clusterData) {
  if (!clusterData) return {};
  const clusters = clusterData.clusters || {};
  return Object.fromEntries(
    Object.entries(clusters).map(([k, c]) => [k, {
      depth:         c.page_count,
      ideal:         c.ideal_depth,
      coverage_pct:  parseInt(c.coverage, 10),
      health:        c.health_grade,
      orphan_count:  c.orphan_count,
    }])
  );
}

function computeLinkDensity(nodes, edges) {
  const linkEdges    = edges.filter(e => e.relationship === 'links_to');
  const totalPages   = nodes.filter(n => !['article_ar','market_outlook_ar'].includes(n.type)).length;
  const avgOutbound  = totalPages > 0 ? parseFloat((linkEdges.length / totalPages).toFixed(2)) : 0;
  const avgInbound   = totalPages > 0 ? parseFloat((linkEdges.length / totalPages).toFixed(2)) : 0;
  const inboundMap   = {};
  for (const e of linkEdges) inboundMap[e.to] = (inboundMap[e.to] || 0) + 1;
  const wellLinked   = Object.values(inboundMap).filter(v => v >= 3).length;
  return { avg_outbound_links: avgOutbound, avg_inbound_links: avgInbound, pages_with_3plus_inbound: wellLinked };
}

function computeHubStrength(nodes, edges) {
  const hubs      = nodes.filter(n => n.is_authority_hub);
  const inboundMap = {};
  for (const e of edges) {
    if (e.relationship === 'links_to') inboundMap[e.to] = (inboundMap[e.to] || 0) + 1;
  }
  return hubs.map(h => ({
    id:        h.id,
    title:     h.title,
    inbound:   inboundMap[h.id] || 0,
    authority: h.authority_score || 0,
    strength:  (inboundMap[h.id] || 0) >= 5 ? 'strong' : (inboundMap[h.id] || 0) >= 2 ? 'moderate' : 'weak',
  })).sort((a, b) => b.authority - a.authority);
}

function computeSemanticOverlap(clusters) {
  if (!clusters) return [];
  const clusterList = Object.values(clusters.clusters || {});
  const overlaps    = [];
  for (let i = 0; i < clusterList.length; i++) {
    for (let j = i + 1; j < clusterList.length; j++) {
      const a = new Set(clusterList[i].top_pages?.map(p => p.id) || []);
      const b = new Set(clusterList[j].top_pages?.map(p => p.id) || []);
      const shared = [...a].filter(x => b.has(x)).length;
      if (shared > 0) {
        overlaps.push({ cluster_a: clusterList[i].cluster, cluster_b: clusterList[j].cluster, shared_pages: shared });
      }
    }
  }
  return overlaps.sort((a, b) => b.shared_pages - a.shared_pages).slice(0, 10);
}

function computeAnchorDiversity(nodes) {
  const anchors = [];
  for (const node of nodes) {
    if (node.type === 'hub' || node.type === 'etf') {
      anchors.push((node.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 3));
    }
  }
  const flat  = anchors.flat();
  const counts = flat.reduce((m, w) => { m[w] = (m[w] || 0) + 1; return m; }, {});
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w, c]) => ({ word: w, count: c }));
  const uniqueTerms = Object.keys(counts).length;
  return { unique_anchor_terms: uniqueTerms, dominant_terms: dominant };
}

function crawlEfficiencyEstimate(nodes, edges) {
  const totalNodes  = nodes.filter(n => !['article_ar','market_outlook_ar'].includes(n.type)).length;
  const reachable   = new Set();
  const starts      = nodes.filter(n => n.is_authority_hub).map(n => n.id);
  const adjList     = {};
  for (const e of edges) {
    if (e.relationship === 'links_to') (adjList[e.from] = adjList[e.from] || []).push(e.to);
  }
  const queue = [...starts];
  while (queue.length) {
    const cur = queue.shift();
    if (reachable.has(cur)) continue;
    reachable.add(cur);
    for (const next of adjList[cur] || []) queue.push(next);
  }
  const pct = totalNodes > 0 ? parseFloat(((reachable.size / totalNodes) * 100).toFixed(1)) : 0;
  return { hub_crawl_reach: reachable.size, total_pages: totalNodes, crawl_coverage_pct: pct };
}

const graph    = readJson(GRAPH_PATH);
const clusters = readJson(CLUSTERS_PATH);
const orphans  = readJson(ORPHAN_PATH);

if (!graph) {
  console.error('content-knowledge-graph.json not found. Run: node tools/build-content-knowledge-graph.js --write');
  process.exit(1);
}

const nodes = graph.nodes || [];
const edges = graph.edges || [];

const topology = {
  version:              '1.0',
  generated_at:         new Date().toISOString(),
  node_count:           nodes.filter(n => !['article_ar','market_outlook_ar'].includes(n.type)).length,
  edge_count:           edges.length,
  authority_distribution: computeAuthorityDistribution(nodes),
  link_density:         computeLinkDensity(nodes, edges),
  hub_strength:         computeHubStrength(nodes, edges).slice(0, 10),
  cluster_depth:        computeClusterDepth(clusters),
  orphan_summary:       orphans ? orphans.summary : null,
  semantic_overlap:     computeSemanticOverlap(clusters),
  anchor_diversity:     computeAnchorDiversity(nodes),
  crawl_efficiency:     crawlEfficiencyEstimate(nodes, edges),
  overall_grade:        computeOverallGrade({ clusters, orphans }),
};

function computeOverallGrade({ clusters: c, orphans: o }) {
  let score = 100;
  if (o && o.summary) {
    score -= Math.min(25, o.summary.orphan_count * 3);
    score -= Math.min(10, o.summary.weak_count * 1);
  }
  if (c && c.summary) {
    score -= c.summary.weak * 5;
    score -= Math.max(0, (3 - c.summary.strong) * 3);
  }
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

if (write) {
  fs.writeFileSync(OUT, JSON.stringify(topology, null, 2) + '\n', 'utf8');
  console.log(`SEO topology report written → ${OUT}`);
  console.log(`  Nodes: ${topology.node_count}  Edges: ${topology.edge_count}  Grade: ${topology.overall_grade}`);
  console.log(`  Crawl coverage: ${topology.crawl_efficiency.crawl_coverage_pct}%`);
  console.log(`  Zero-authority pages: ${topology.authority_distribution.zero_authority_count}`);
} else {
  console.log(JSON.stringify(topology, null, 2));
}

module.exports = { computeAuthorityDistribution, computeHubStrength };
