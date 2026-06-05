'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const OUT        = path.join(ROOT, 'data', 'content-clusters.json');
const write      = process.argv.includes('--write');

const CLUSTER_DEFINITIONS = {
  ai_semiconductor: {
    label:       'AI & Semiconductor',
    description: 'AI sector analysis, semiconductor cycle, GPU infrastructure, and tech ETF dynamics.',
    hub_pages:   ['ai-stocks.html','semiconductor-stocks.html','ai-etfs.html'],
    key_etfs:    ['QQQ','SMH','SOXX','XLK','NVDA','AMD'],
    ideal_depth: 6,
  },
  etf_education: {
    label:       'ETF Education',
    description: 'ETF structure, expense ratios, diversification, risk frameworks, and methodology.',
    hub_pages:   ['etfs.html'],
    key_etfs:    ['SPY','QQQ','BND','VTI','IWM'],
    ideal_depth: 5,
  },
  yield_rates: {
    label:       'Yields & Rates',
    description: 'Treasury yield environment, rate sensitivity, duration risk, and bond ETF context.',
    hub_pages:   ['bond-etfs.html'],
    key_etfs:    ['TLT','IEF','SHY','BND','AGG'],
    ideal_depth: 5,
  },
  market_structure: {
    label:       'Market Structure',
    description: 'Market regimes, breadth, volatility, participation quality, and macro state.',
    hub_pages:   ['rankings.html'],
    key_etfs:    ['SPY','QQQ','IWM','VIX'],
    ideal_depth: 5,
  },
  defensive_sectors: {
    label:       'Defensive & Income',
    description: 'Defensive sector ETFs, dividend investing, healthcare, utilities, and capital preservation.',
    hub_pages:   ['defensive-etfs.html','dividend-etfs.html','defensive-stocks.html'],
    key_etfs:    ['XLU','XLV','BND','SCHD','VIG','JEPI'],
    ideal_depth: 5,
  },
  growth_value: {
    label:       'Growth vs Value',
    description: 'Factor investing, growth and value rotation, and style-based ETF education.',
    hub_pages:   ['growth-stocks.html'],
    key_etfs:    ['QQQ','IWM','ARKK','VTV','IVE'],
    ideal_depth: 4,
  },
  portfolio_construction: {
    label:       'Portfolio Construction',
    description: 'Diversification, risk management, and portfolio-level ETF strategy.',
    hub_pages:   ['etfs.html','rankings.html'],
    key_etfs:    ['SPY','BND','VTI','IWM'],
    ideal_depth: 4,
  },
  sector_rotation: {
    label:       'Sector Rotation',
    description: 'Sector ETF flows, defensive-to-cyclical rotation, and macro-driven allocation shifts.',
    hub_pages:   ['etfs.html'],
    key_etfs:    ['XLK','XLF','XLE','XLU','XLV','XLI'],
    ideal_depth: 4,
  },
};

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch { return null; }
}

function buildInboundMap(edges) {
  const map = {};
  for (const e of edges) {
    if (e.relationship === 'links_to') (map[e.to] = map[e.to] || []).push(e.from);
  }
  return map;
}

function clusterNodes(graph, clusterName) {
  return graph.nodes.filter(n => (n.clusters || []).includes(clusterName));
}

function crossLinkDensity(members, edges) {
  const ids = new Set(members.map(n => n.id));
  const outbound = {};
  for (const e of edges) {
    if (e.relationship === 'links_to' && ids.has(e.from) && ids.has(e.to)) {
      outbound[e.from] = (outbound[e.from] || 0) + 1;
    }
  }
  const maxPossible = members.length * (members.length - 1);
  const actual      = Object.values(outbound).reduce((s, v) => s + v, 0);
  return maxPossible > 0 ? actual / maxPossible : 0;
}

function healthGrade(avgAuth, orphanCount, density, depth, idealDepth) {
  const coverage = Math.min(1, depth / idealDepth);
  if (avgAuth >= 30 && orphanCount === 0 && density >= 0.15 && coverage >= 0.8) return 'STRONG';
  if (avgAuth >= 15 && orphanCount <= 1 && density >= 0.05 && coverage >= 0.5) return 'FAIR';
  return 'WEAK';
}

function analyzeClusters(graph) {
  const inbound = buildInboundMap(graph.edges || []);
  const results = {};

  for (const [name, def] of Object.entries(CLUSTER_DEFINITIONS)) {
    const members  = clusterNodes(graph, name);
    const existing = members.filter(n => {
      const abs = path.join(ROOT, n.id);
      return fs.existsSync(abs);
    });
    const orphans  = existing.filter(n => !(inbound[n.id] || []).length);
    const weak     = existing.filter(n => {
      const ibl = (inbound[n.id] || []).length;
      return ibl > 0 && ibl <= 2;
    });
    const authScores = existing.map(n => n.authority_score || 0);
    const avgAuth    = authScores.length ? authScores.reduce((s, v) => s + v, 0) / authScores.length : 0;
    const density    = crossLinkDensity(existing, graph.edges || []);
    const hubsPresent = def.hub_pages.filter(h => fs.existsSync(path.join(ROOT, h)));
    const grade      = healthGrade(avgAuth, orphans.length, density, existing.length, def.ideal_depth);

    results[name] = {
      cluster:          name,
      label:            def.label,
      description:      def.description,
      page_count:       existing.length,
      hub_count:        hubsPresent.length,
      total_hubs:       def.hub_pages.length,
      ideal_depth:      def.ideal_depth,
      coverage:         `${Math.round((existing.length / def.ideal_depth) * 100)}%`,
      avg_authority:    Math.round(avgAuth),
      orphan_count:     orphans.length,
      orphan_pages:     orphans.map(n => n.id),
      weak_pages:       weak.map(n => ({ id: n.id, inbound: (inbound[n.id] || []).length })),
      cross_link_density: parseFloat(density.toFixed(3)),
      health_grade:     grade,
      key_etfs:         def.key_etfs,
      top_pages:        existing
        .sort((a, b) => (b.authority_score || 0) - (a.authority_score || 0))
        .slice(0, 5)
        .map(n => ({ id: n.id, authority: n.authority_score || 0, type: n.type })),
    };
  }
  return results;
}

function clusterSummary(clusters) {
  const grades = Object.values(clusters).map(c => c.health_grade);
  return {
    strong: grades.filter(g => g === 'STRONG').length,
    fair:   grades.filter(g => g === 'FAIR').length,
    weak:   grades.filter(g => g === 'WEAK').length,
    weakest: Object.entries(clusters)
      .filter(([, c]) => c.health_grade === 'WEAK')
      .sort((a, b) => a[1].avg_authority - b[1].avg_authority)
      .slice(0, 3)
      .map(([k]) => k),
  };
}

module.exports = { analyzeClusters, CLUSTER_DEFINITIONS };

if (require.main === module) {
  const graph = loadGraph();
  if (!graph) {
    console.error('content-knowledge-graph.json not found. Run: node tools/build-content-knowledge-graph.js --write');
    process.exit(1);
  }
  const clusters = analyzeClusters(graph);
  const summary  = clusterSummary(clusters);
  const output   = { version: '1.0', generated_at: new Date().toISOString(), summary, clusters };
  if (write) {
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Content clusters written → ${OUT}`);
    console.log(`  Strong: ${summary.strong}  Fair: ${summary.fair}  Weak: ${summary.weak}`);
    if (summary.weakest.length) console.log(`  Weakest: ${summary.weakest.join(', ')}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}
