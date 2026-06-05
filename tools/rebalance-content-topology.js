'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '..');
const GRAPH_PATH  = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const CLUSTER_PATH= path.join(ROOT, 'data', 'content-clusters.json');
const TOPOLOGY_PATH = path.join(ROOT, 'data', 'seo-topology-report.json');
const OUT         = path.join(ROOT, 'data', 'topology-rebalance-report.json');

const WRITE = process.argv.includes('--write');

// Desired minimum cross-link density per cluster
const TARGET_DENSITY  = 0.12;
const MIN_INBOUND     = 2;
const MIN_PEER_LINKS  = 2;

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

// ─── AUTHORITY DISTRIBUTION ANALYSIS ─────────────────────────────────────────

function analyzeAuthorityDistribution(nodes) {
  const byType = {};
  const sorted = [...nodes].sort((a, b) => (b.authority_score || 0) - (a.authority_score || 0));

  for (const node of nodes) {
    const t = node.type || 'unknown';
    if (!byType[t]) byType[t] = { count: 0, totalAuth: 0, zeroes: 0, max: 0 };
    byType[t].count++;
    byType[t].totalAuth += node.authority_score || 0;
    if (!node.authority_score) byType[t].zeroes++;
    if ((node.authority_score || 0) > byType[t].max) byType[t].max = node.authority_score;
  }

  const top10 = sorted.slice(0, Math.ceil(nodes.length * 0.1));
  const bottom50 = sorted.slice(Math.floor(nodes.length * 0.5));

  return {
    total_nodes:          nodes.length,
    zero_authority_pages: nodes.filter(n => !n.authority_score).length,
    top_10pct_avg:        top10.length ? Math.round(top10.reduce((s, n) => s + (n.authority_score || 0), 0) / top10.length) : 0,
    bottom_50pct_avg:     bottom50.length ? Math.round(bottom50.reduce((s, n) => s + (n.authority_score || 0), 0) / bottom50.length) : 0,
    by_type:              Object.fromEntries(Object.entries(byType).map(([t, v]) => [t, {
      count:    v.count,
      avg:      Math.round(v.totalAuth / v.count),
      zeroes:   v.zeroes,
      max:      v.max,
    }])),
    concentration_ratio:  top10.length && nodes.length
      ? parseFloat((top10.reduce((s, n) => s + (n.authority_score || 0), 0) /
          Math.max(1, nodes.reduce((s, n) => s + (n.authority_score || 0), 0))).toFixed(3))
      : 0,
  };
}

// ─── CLUSTER CONNECTIVITY IMPROVEMENTS ────────────────────────────────────────

function findCrossLinkOpportunities(clusterName, clusterData, graph) {
  const nodeMap = new Map((graph.nodes || []).map(n => [n.id, n]));
  const existingLinks = new Set(
    (graph.edges || [])
      .filter(e => e.relationship === 'links_to')
      .map(e => `${e.from}→${e.to}`)
  );

  const members = (graph.nodes || []).filter(n =>
    (n.clusters || []).includes(clusterName) &&
    fs.existsSync(path.join(ROOT, n.id))
  );

  const opportunities = [];

  for (const source of members) {
    if (source.type === 'hub') continue; // Hubs usually already link everywhere
    const sourceAuth = source.authority_score || 0;

    for (const target of members) {
      if (source.id === target.id) continue;
      if (existingLinks.has(`${source.id}→${target.id}`)) continue;
      const targetAuth = target.authority_score || 0;

      // Only suggest from higher-auth to lower-auth pages (authority flow direction)
      if (sourceAuth < targetAuth - 10) continue;

      // Check semantic similarity via shared entities
      const srcEtfs = new Set(source.etf_entities || []);
      const tgtEtfs = new Set(target.etf_entities || []);
      const sharedEtfs = [...tgtEtfs].filter(e => srcEtfs.has(e)).length;

      if (sharedEtfs >= 1 || sourceAuth >= 60) {
        opportunities.push({
          from:          source.id,
          from_title:    source.title || source.id,
          from_authority:sourceAuth,
          to:            target.id,
          to_title:      target.title || target.id,
          to_authority:  targetAuth,
          shared_etfs:   sharedEtfs,
          estimated_auth_transfer: Math.round(sourceAuth * 0.05),
        });
      }
    }
  }

  // Sort by estimated authority transfer (highest first)
  opportunities.sort((a, b) => b.estimated_auth_transfer - a.estimated_auth_transfer);
  return opportunities.slice(0, 8);
}

// ─── WEAK CLUSTER REPAIR PATHS ────────────────────────────────────────────────

function clusterRepairPath(clusterName, clusterData, opportunities) {
  const issues = [];
  const actions = [];

  if (clusterData.avg_authority < 20) {
    issues.push('Authority deficit — most pages have very low authority');
    actions.push('Add at least 3 inbound links to highest-value cluster pages from hub pages');
  }
  if (clusterData.orphan_count > 0) {
    issues.push(`${clusterData.orphan_count} orphan page(s) — unreachable from cluster crawl`);
    actions.push(`Run orphan repair for ${clusterData.orphan_count} cluster page(s)`);
  }
  if (clusterData.cross_link_density < TARGET_DENSITY) {
    issues.push(`Cross-link density ${clusterData.cross_link_density} is below target ${TARGET_DENSITY}`);
    actions.push(`Add ${Math.max(1, Math.ceil((TARGET_DENSITY - clusterData.cross_link_density) * clusterData.page_count))} cross-links within cluster`);
  }
  if (clusterData.coverage && parseInt(clusterData.coverage) < 60) {
    issues.push(`Content coverage ${clusterData.coverage} — cluster needs more pages`);
    actions.push(`Generate ${clusterData.ideal_depth - clusterData.page_count} more support articles for cluster`);
  }
  if (clusterData.hub_count < clusterData.total_hubs) {
    issues.push(`Missing ${clusterData.total_hubs - clusterData.hub_count} hub page(s)`);
    actions.push('Create missing hub pages or add cluster index');
  }

  const grade_path = issues.length === 0 ? 'STRONG'
    : issues.length <= 1 ? 'FAIR → STRONG'
    : issues.length <= 2 ? 'WEAK → FAIR'
    : 'WEAK → FAIR (multi-step)';

  return { issues, actions, grade_path, cross_link_opportunities: opportunities.length };
}

// ─── CRAWL EFFICIENCY IMPROVEMENTS ────────────────────────────────────────────

function analyzeCrawlPaths(graph, topology) {
  const crawlData = topology.crawl_efficiency || {};
  const hubStrength = topology.hub_strength || [];

  const weakHubs = hubStrength.filter(h => h.strength !== 'strong');
  const coverage = crawlData.crawl_coverage_pct || 0;

  const improvements = [];

  if (coverage < 90) {
    improvements.push({
      type:    'crawl_coverage',
      current: `${coverage}%`,
      target:  '90%+',
      action:  'Link orphan pages from their most relevant cluster hub or comparison page',
      impact:  `+${Math.round((90 - coverage) * (crawlData.total_pages || 235) / 100)} pages reachable from crawl`,
    });
  }

  if (weakHubs.length > 0) {
    improvements.push({
      type:    'weak_hub_reinforcement',
      count:   weakHubs.length,
      hubs:    weakHubs.map(h => h.id),
      action:  'Add inbound links to weak hubs from market-intelligence page and insights index',
      impact:  'Improves hub authority and downstream cluster crawl reach',
    });
  }

  const zeroAuth = (graph.nodes || []).filter(n => !n.authority_score);
  if (zeroAuth.length > 30) {
    improvements.push({
      type:    'authority_deserts',
      count:   zeroAuth.length,
      action:  'Systematically link zero-authority pages from 2+ related pages in same or adjacent clusters',
      impact:  `Reduces zero-authority pages from ${zeroAuth.length} toward <20`,
    });
  }

  return improvements;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function rebalanceTopology() {
  const graph    = readJson(GRAPH_PATH, { nodes: [], edges: [] });
  const clusters = readJson(CLUSTER_PATH, { clusters: {} });
  const topology = readJson(TOPOLOGY_PATH, {});

  const authDistribution = analyzeAuthorityDistribution(graph.nodes || []);

  const clusterRebalancing = {};
  for (const [name, data] of Object.entries(clusters.clusters || {})) {
    const opps = findCrossLinkOpportunities(name, data, graph);
    clusterRebalancing[name] = {
      cluster:        name,
      label:          data.label,
      health_grade:   data.health_grade,
      current_density:data.cross_link_density,
      target_density: TARGET_DENSITY,
      density_gap:    parseFloat(Math.max(0, TARGET_DENSITY - data.cross_link_density).toFixed(3)),
      repair_path:    clusterRepairPath(name, data, opps),
      cross_link_opportunities: opps,
    };
  }

  const crawlImprovements = analyzeCrawlPaths(graph, topology);

  const overallGrade = topology.overall_grade || 'D';
  const orphanCount  = (topology.orphan_summary || {}).orphan_count || 0;
  const weakClusters = Object.values(clusters.clusters || {}).filter(c => c.health_grade === 'WEAK').length;

  // Project grade improvement
  const projectedGrade = orphanCount < 30 && weakClusters < 2 ? 'B'
    : orphanCount < 45 && weakClusters < 3 ? 'C'
    : orphanCount < 55 ? 'C–'
    : 'D+';

  return {
    current_grade:      overallGrade,
    projected_grade:    projectedGrade,
    authority_distribution: authDistribution,
    cluster_rebalancing: clusterRebalancing,
    crawl_improvements: crawlImprovements,
    rebalancing_priorities: Object.values(clusterRebalancing)
      .filter(c => c.health_grade !== 'STRONG')
      .sort((a, b) => b.density_gap - a.density_gap)
      .slice(0, 5)
      .map(c => ({
        cluster:      c.cluster,
        grade:        c.health_grade,
        density_gap:  c.density_gap,
        actions:      c.repair_path.actions,
        opp_count:    c.cross_link_opportunities.length,
      })),
  };
}

module.exports = { rebalanceTopology };

if (require.main === module) {
  const result = rebalanceTopology();
  const output = {
    version:      '1.0',
    generated_at: new Date().toISOString(),
    description:  'Topology rebalancing analysis — cross-link opportunities, authority distribution, and crawl efficiency improvements.',
    ...result,
  };

  console.log(`Topology Rebalancing Report`);
  console.log(`  Current grade: ${result.current_grade}  Projected: ${result.projected_grade}`);
  console.log(`  Authority concentration: ${result.authority_distribution.concentration_ratio}`);
  console.log(`  Zero-authority pages: ${result.authority_distribution.zero_authority_pages}`);
  console.log(`  Crawl improvements available: ${result.crawl_improvements.length}`);
  console.log(`  Rebalancing priorities:`);
  for (const p of result.rebalancing_priorities) {
    console.log(`    [${p.grade}] ${p.cluster} — density gap: ${p.density_gap}, ${p.opp_count} cross-link opps`);
  }

  if (WRITE) {
    const OUT2 = path.join(ROOT, 'data', 'topology-rebalance-report.json');
    fs.writeFileSync(OUT2, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Report written → ${OUT2}`);
  }
}
