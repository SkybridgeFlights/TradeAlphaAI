'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const GRAPH_PATH = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const OUT        = path.join(ROOT, 'data', 'article-pairs.json');
const write      = process.argv.includes('--write');

const CURATED_PAIRS = [
  {
    left_slug:          'ai-sector-2026-06-06',
    right_slug:         'yield-context-2026-06-09',
    relationship_type:  'macro_dependency',
    comparison_reason:  'AI sector earnings multiples reprice as rate environment shifts; TLT/IEF duration risk drives QQQ/SMH relative performance.',
    educational_value:  'Shows how yield curve normalization and policy path affect growth sector valuations.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'ai-sector-2026-06-06',
    right_slug:         'etf-rotation-2026-06-08',
    relationship_type:  'sector_overlap',
    comparison_reason:  'AI/semiconductor ETF flows are a primary driver of broad ETF rotation signals; XLK outperformance vs equal-weight divergence.',
    educational_value:  'Demonstrates how concentrated sector leadership (SMH, SOXX) shapes broader rotation patterns.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'yield-context-2026-06-09',
    right_slug:         'etf-rotation-2026-06-08',
    relationship_type:  'continuation_of',
    comparison_reason:  'Rate environment context feeds directly into ETF sector rotation: duration-sensitive vs rate-insensitive allocation shifts.',
    educational_value:  'Reading path from macro rate context → ETF rotation response → sector positioning.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'market-regime-2026-06-11',
    right_slug:         'yield-context-2026-06-09',
    relationship_type:  'linked_by_regime',
    comparison_reason:  'Regime state (risk-on/off, volatility regime) shapes how yield signals translate into market positioning.',
    educational_value:  'Regime overlay adds a risk framework around yield context, connecting macro signal to tactical positioning.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'market-regime-2026-06-11',
    right_slug:         'ai-sector-2026-06-06',
    relationship_type:  'linked_by_regime',
    comparison_reason:  'AI sector momentum is regime-conditional: risk-on breadth supports participation; risk-off regime creates concentration risk.',
    educational_value:  'Demonstrates how regime classification shapes sector analysis and ETF allocation.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'growth-etfs-vs-value-etfs',
    right_slug:         'growth-stocks-vs-value-stocks',
    relationship_type:  'sector_overlap',
    comparison_reason:  'Factor rotation between growth and value operates at both ETF and individual stock level with similar macro drivers (rates, earnings, cycle phase).',
    educational_value:  'Pairing ETF-level and stock-level factor analysis creates a complete educational picture of growth/value dynamics.',
    internal_link_priority: 'medium',
  },
  {
    left_slug:          'bnd-vs-ief',
    right_slug:         'dividend-etfs-explained',
    relationship_type:  'related_to',
    comparison_reason:  'Bond ETF duration and dividend ETF income share defensive allocation context: both are alternatives to equity risk.',
    educational_value:  'Illustrates the defensive spectrum from pure duration (TLT/IEF/BND) to income-generating equity alternatives (SCHD, VIG).',
    internal_link_priority: 'medium',
  },
  {
    left_slug:          'spy-vs-qqq',
    right_slug:         'etf-diversification-guide',
    relationship_type:  'expands_on',
    comparison_reason:  'SPY vs QQQ is a core diversification decision point; concentration risk in QQQ is a key example of sector-level diversification trade-offs.',
    educational_value:  'Connecting comparison page to diversification guide provides the "why" behind broad vs concentrated ETF choice.',
    internal_link_priority: 'medium',
  },
  {
    left_slug:          'etf-risk-comparison-guide',
    right_slug:         'etf-diversification-guide',
    relationship_type:  'expands_on',
    comparison_reason:  'Risk comparison and diversification are complementary educational frameworks for evaluating ETF construction.',
    educational_value:  'Together they form a complete entry-level ETF education path.',
    internal_link_priority: 'medium',
  },
  {
    left_slug:          'interest-rates-and-tech-stocks',
    right_slug:         'yield-context-2026-06-09',
    relationship_type:  'expands_on',
    comparison_reason:  'Tech stock sensitivity to rate changes is the stock-level expression of the macro yield context covered in the market outlook.',
    educational_value:  'Bridges the macro yield article with sector-level equity implications.',
    internal_link_priority: 'high',
  },
  {
    left_slug:          'defensive-investing-explained',
    right_slug:         'dividend-etfs-explained',
    relationship_type:  'related_to',
    comparison_reason:  'Defensive investing strategy and dividend ETFs share capital preservation and income objectives, and often feature overlapping holdings.',
    educational_value:  'Pairs strategic context (defensive investing) with tactical ETF implementation (dividend ETFs).',
    internal_link_priority: 'medium',
  },
];

function loadGraph() {
  if (!fs.existsSync(GRAPH_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(GRAPH_PATH, 'utf8')); } catch { return null; }
}

function inferGraphPairs(graph) {
  if (!graph) return [];
  const inferred = [];
  const curatedKeys = new Set(CURATED_PAIRS.map(p => [p.left_slug, p.right_slug].sort().join('|')));

  for (const edge of graph.edges || []) {
    if (edge.relationship !== 'asset_exposure') continue;
    if (!edge.shared_entities || edge.shared_entities.length < 3) continue;
    const fromNode = graph.nodes.find(n => n.id === edge.from);
    const toNode   = graph.nodes.find(n => n.id === edge.to);
    if (!fromNode || !toNode) continue;
    if (!['article','market_outlook'].includes(fromNode.type)) continue;
    if (!['article','market_outlook'].includes(toNode.type)) continue;
    const key = [fromNode.slug, toNode.slug].sort().join('|');
    if (curatedKeys.has(key)) continue;
    inferred.push({
      left_slug:              fromNode.slug,
      right_slug:             toNode.slug,
      relationship_type:      'asset_exposure',
      comparison_reason:      `Both articles cover ${edge.shared_entities.slice(0,4).join(', ')} — overlapping ETF/equity exposure creates a natural reading path.`,
      educational_value:      'Inferred from shared ETF entity overlap across articles.',
      internal_link_priority: 'low',
      inferred:               true,
    });
  }
  return inferred.slice(0, 20);
}

function buildPairs() {
  const graph = loadGraph();
  const inferred = inferGraphPairs(graph);
  const allPairs = [...CURATED_PAIRS, ...inferred];
  const slugToTitle = graph
    ? Object.fromEntries(graph.nodes.map(n => [n.slug, n.title]))
    : {};
  return allPairs.map(p => ({
    ...p,
    left_title:  slugToTitle[p.left_slug]  || p.left_slug,
    right_title: slugToTitle[p.right_slug] || p.right_slug,
  }));
}

module.exports = { buildPairs, CURATED_PAIRS };

if (require.main === module) {
  const pairs = buildPairs();
  const output = {
    version:      '1.0',
    generated_at: new Date().toISOString(),
    description:  'Institutional article pair relationships for internal linking, reading paths, and cluster navigation.',
    total:        pairs.length,
    pairs,
  };
  if (write) {
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Article pairs written → ${OUT}  (${pairs.length} pairs)`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}
