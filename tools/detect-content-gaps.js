'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const GRAPH_PATH    = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const CLUSTERS_PATH = path.join(ROOT, 'data', 'content-clusters.json');
const OUT           = path.join(ROOT, 'data', 'content-gap-report.json');
const write         = process.argv.includes('--write');

// Ideal content coverage templates per cluster
const COVERAGE_TEMPLATES = {
  ai_semiconductor: {
    required_articles: [
      'ai-infrastructure-demand',
      'semiconductor-cycle-analysis',
      'ai-etf-concentration-guide',
    ],
    required_comparisons: ['nvda-vs-amd','qqq-vs-smh'],
    required_etf_pages:   ['smh','soxx','xlk','qqq'],
    required_hubs:        ['ai-stocks.html','semiconductor-stocks.html','ai-etfs.html'],
    missing_topic_ideas: [
      { title: 'AI Infrastructure Capex Cycle and Semiconductor ETF Rotation', cluster: 'ai_semiconductor', priority: 'high' },
      { title: 'QQQ vs SMH: Broad Tech vs Pure Semiconductor Exposure', cluster: 'ai_semiconductor', priority: 'high' },
    ],
  },
  yield_rates: {
    required_articles: [
      'yield-curve-inversion-explained',
      'treasury-duration-risk-guide',
    ],
    required_comparisons: ['tlt-vs-ief','spy-vs-tlt'],
    required_etf_pages:   ['tlt','ief','bnd','shy'],
    required_hubs:        ['bond-etfs.html'],
    missing_topic_ideas: [
      { title: 'Yield Curve Shape and Duration Risk: TLT vs IEF Educational Framework', cluster: 'yield_rates', priority: 'high' },
      { title: 'Fed Funds Rate and Short-End Treasury Dynamics: SHY and BND Context', cluster: 'yield_rates', priority: 'medium' },
    ],
  },
  market_structure: {
    required_articles: [
      'market-breadth-explained',
      'vix-volatility-regime-guide',
    ],
    required_comparisons: ['spy-vs-iwm','spy-vs-rsp'],
    required_etf_pages:   ['spy','qqq','iwm','rsp'],
    required_hubs:        ['rankings.html'],
    missing_topic_ideas: [
      { title: 'Market Breadth vs Narrow Leadership: SPY vs RSP Divergence Analysis', cluster: 'market_structure', priority: 'high' },
      { title: 'VIX Regime Educational Framework: Volatility Compression and Expansion Cycles', cluster: 'market_structure', priority: 'medium' },
    ],
  },
  defensive_sectors: {
    required_articles: [
      'defensive-investing-explained',
      'dividend-etfs-explained',
    ],
    required_comparisons: ['xlv-vs-xlu','jepi-vs-schd'],
    required_etf_pages:   ['xlv','xlu','schd','vig','jepi'],
    required_hubs:        ['defensive-etfs.html','dividend-etfs.html'],
    missing_topic_ideas: [
      { title: 'JEPI vs SCHD: Income Strategy Comparison for Defensive Allocation', cluster: 'defensive_sectors', priority: 'high' },
      { title: 'Healthcare vs Utilities ETF Context: Defensive Sector Rotation Signals', cluster: 'defensive_sectors', priority: 'medium' },
    ],
  },
  etf_education: {
    required_articles: [
      'etf-diversification-guide',
      'etf-expense-ratios-explained',
      'etf-risk-comparison-guide',
    ],
    required_comparisons: ['spy-vs-qqq','bnd-vs-ief'],
    required_etf_pages:   ['spy','qqq','bnd','vti'],
    required_hubs:        ['etfs.html'],
    missing_topic_ideas: [
      { title: 'ETF Liquidity and Spread Cost Guide: Trading Mechanics for Educational Use', cluster: 'etf_education', priority: 'medium' },
    ],
  },
  growth_value: {
    required_articles: [
      'growth-etfs-vs-value-etfs',
      'growth-stocks-vs-value-stocks',
    ],
    required_comparisons: ['qqq-vs-iwm','spy-vs-qqq'],
    required_etf_pages:   ['qqq','iwm','arkk'],
    required_hubs:        ['growth-stocks.html'],
    missing_topic_ideas: [
      { title: 'Growth vs Value Factor Rotation: Rate Sensitivity and Cycle Analysis', cluster: 'growth_value', priority: 'high' },
    ],
  },
  sector_rotation: {
    required_articles: [
      'sector-rotation-framework',
    ],
    required_comparisons: ['xlk-vs-xlu','xle-vs-xlk'],
    required_etf_pages:   ['xlk','xlf','xle','xlu','xlv'],
    required_hubs:        ['etfs.html'],
    missing_topic_ideas: [
      { title: 'Sector ETF Rotation Framework: Macro-Driven Allocation Shifts and Risk Signals', cluster: 'sector_rotation', priority: 'high' },
      { title: 'XLK vs XLU: Growth vs Defensive Sector ETF Context', cluster: 'sector_rotation', priority: 'medium' },
    ],
  },
};

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch { return null; }
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function findGaps(graph) {
  const slugSet = new Set((graph.nodes || []).map(n => n.slug));
  const gaps    = [];

  for (const [cluster, tmpl] of Object.entries(COVERAGE_TEMPLATES)) {
    const clusterGaps = { cluster, label: cluster.replace(/_/g, ' '), missing_articles: [], missing_comparisons: [], missing_etf_pages: [], missing_hubs: [], topic_suggestions: [] };

    for (const slug of tmpl.required_articles || []) {
      if (!slugSet.has(slug) && !fileExists(`insights/${slug}.html`) && !fileExists(`market-outlook/${slug}.html`)) {
        clusterGaps.missing_articles.push({
          slug,
          suggested_path: `insights/${slug}.html`,
          priority: 'medium',
          note: `Missing article for ${cluster} cluster coverage.`,
        });
      }
    }
    for (const slug of tmpl.required_comparisons || []) {
      if (!fileExists(`compare/${slug}.html`)) {
        clusterGaps.missing_comparisons.push({
          slug,
          path: `compare/${slug}.html`,
          note: `Missing comparison page for ${cluster} cluster.`,
        });
      }
    }
    for (const slug of tmpl.required_etf_pages || []) {
      if (!fileExists(`etfs/${slug}.html`)) {
        clusterGaps.missing_etf_pages.push({
          ticker: slug.toUpperCase(),
          path: `etfs/${slug}.html`,
          note: `ETF page missing for ${cluster} cluster.`,
        });
      }
    }
    for (const hub of tmpl.required_hubs || []) {
      if (!fileExists(hub)) {
        clusterGaps.missing_hubs.push({ hub, note: `Hub page missing for ${cluster} cluster.` });
      }
    }
    clusterGaps.topic_suggestions = tmpl.missing_topic_ideas || [];

    const totalMissing = clusterGaps.missing_articles.length + clusterGaps.missing_comparisons.length;
    if (totalMissing > 0 || clusterGaps.missing_etf_pages.length > 0) {
      gaps.push({ ...clusterGaps, total_gaps: totalMissing });
    }
  }

  return gaps.sort((a, b) => b.total_gaps - a.total_gaps);
}

const graph = loadGraph();
if (!graph) {
  console.error('content-knowledge-graph.json not found. Run: node tools/build-content-knowledge-graph.js --write');
  process.exit(1);
}

const gaps = findGaps(graph);

// Flatten all topic suggestions ranked by priority
const prioritizedTopics = gaps
  .flatMap(g => g.topic_suggestions.map(t => ({ ...t, cluster: g.cluster })))
  .sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1));

const output = {
  version:      '1.0',
  generated_at: new Date().toISOString(),
  summary: {
    clusters_with_gaps: gaps.length,
    total_missing_articles:    gaps.reduce((s, g) => s + g.missing_articles.length, 0),
    total_missing_comparisons: gaps.reduce((s, g) => s + g.missing_comparisons.length, 0),
    total_missing_etf_pages:   gaps.reduce((s, g) => s + g.missing_etf_pages.length, 0),
    high_priority_topics:      prioritizedTopics.filter(t => t.priority === 'high').length,
  },
  prioritized_topic_suggestions: prioritizedTopics,
  cluster_gaps: gaps,
};

if (write) {
  fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Content gap report written → ${OUT}`);
  console.log(`  Clusters with gaps: ${output.summary.clusters_with_gaps}`);
  console.log(`  Missing articles: ${output.summary.total_missing_articles}  Comparisons: ${output.summary.total_missing_comparisons}`);
  console.log(`  High-priority topic suggestions: ${output.summary.high_priority_topics}`);
  if (prioritizedTopics.length) {
    console.log('  Top suggestions:');
    prioritizedTopics.slice(0, 3).forEach(t => console.log(`    [${t.priority}] ${t.title}`));
  }
} else {
  console.log(JSON.stringify(output, null, 2));
}

module.exports = { findGaps, COVERAGE_TEMPLATES };
