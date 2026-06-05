'use strict';

const fs   = require('fs');
const path = require('path');
const { scoreOpportunity, rankPlans } = require('./score-authority-expansion');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'data', 'authority-expansion-plan.json');

function readJson(file, fallback = {}) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function loadInputs() {
  return {
    graph:     readJson('data/content-knowledge-graph.json', { nodes: [], edges: [] }),
    clusters:  readJson('data/content-clusters.json', { summary: {}, clusters: {} }),
    orphans:   readJson('data/orphan-pages-report.json', { summary: {}, orphans: [] }),
    gaps:      readJson('data/content-gap-report.json', { prioritized_topic_suggestions: [], cluster_gaps: {} }),
    topology:  readJson('data/seo-topology-report.json', {}),
    narrative: readJson('data/narrative-memory.json', { snapshots: [] }),
    miGraph:   readJson('data/market-intelligence-graph.json', { nodes: [], edges: [] }),
  };
}

// ─── OPPORTUNITY BUILDERS ────────────────────────────────────────────────────

function buildSupportArticleOpportunities(data) {
  const { gaps, clusters } = data;
  const plans = [];

  for (const suggestion of (gaps.prioritized_topic_suggestions || [])) {
    if (suggestion.priority !== 'high' && suggestion.priority !== 'medium') continue;
    const clusterName = suggestion.cluster || 'general';
    const clusterData = (clusters.clusters || {})[clusterName] || {};
    const clusterGrade = clusterData.health_grade || 'WEAK';

    const snapshots = data.narrative.snapshots || [];
    const latestNarrative = snapshots.length ? (snapshots[snapshots.length - 1].dominant_narrative || '') : '';
    const narrativeContinuity = Boolean(
      suggestion.title && latestNarrative &&
      (suggestion.title.toLowerCase().includes('yield') && latestNarrative.toLowerCase().includes('yield') ||
       suggestion.title.toLowerCase().includes('ai') && latestNarrative.toLowerCase().includes('ai') ||
       suggestion.title.toLowerCase().includes('rate') && latestNarrative.toLowerCase().includes('rate'))
    );

    const scored = scoreOpportunity({
      action_type:        'support_article',
      target_cluster:     clusterName,
      cluster_grade:      clusterGrade,
      orphanCountDelta:   0,
      crawlDelta:         3,
      authorityDelta:     8,
      isHubAdjacent:      Boolean(clusterData.hub_count > 0),
      hubIsWeak:          clusterGrade === 'WEAK',
      linksToHub:         true,
      isComparison:       Boolean(suggestion.type === 'comparison'),
      bridgesThemes:      Boolean(suggestion.bridges_themes),
      hasHighPriorityGap: suggestion.priority === 'high',
      narrativeContinuity,
      topicalUniqueness:  8,
      assetExposureOverlap: (suggestion.related_etfs || []).length,
      clustersServed:     1,
    });

    plans.push({
      priority:                   scored.grade,
      score:                      scored.score,
      score_breakdown:            scored.breakdown,
      action_type:                'support_article',
      target_cluster:             clusterName,
      title:                      suggestion.title,
      slug_suggestion:            suggestion.slug || null,
      reason:                     `High-priority gap in ${clusterName} cluster (${clusterGrade} health). "${suggestion.title}" is missing from the content library.`,
      expected_topology_improvement: `+1 page in ${clusterName} cluster; reduces coverage gap from ${clusterData.coverage || 'unknown'}; +${(suggestion.related_etfs || []).length} entity links.`,
      related_nodes:              [],
      repair_strategy:            `Generate support article covering: ${suggestion.title}. Link to hub page${clusterData.hub_count > 0 ? 's' : ''}. Link to at least 2 cluster peers.`,
      related_etfs:               suggestion.related_etfs || [],
      status:                     'planned',
    });
  }

  return plans;
}

function buildComparisonOpportunities(data) {
  const { gaps, clusters } = data;
  const plans = [];

  for (const [clusterName, gapData] of Object.entries(gaps.cluster_gaps || {})) {
    for (const comp of (gapData.missing_comparisons || []).slice(0, 3)) {
      const clusterData = (clusters.clusters || {})[clusterName] || {};
      const clusterGrade = clusterData.health_grade || 'WEAK';

      const scored = scoreOpportunity({
        action_type:        'comparison_article',
        target_cluster:     clusterName,
        cluster_grade:      clusterGrade,
        orphanCountDelta:   0,
        crawlDelta:         2,
        authorityDelta:     10,
        isHubAdjacent:      Boolean(clusterData.hub_count > 0),
        hubIsWeak:          clusterGrade === 'WEAK',
        linksToHub:         true,
        isComparison:       true,
        bridgesThemes:      true,
        hasHighPriorityGap: true,
        narrativeContinuity:false,
        topicalUniqueness:  9,
        assetExposureOverlap:2,
        clustersServed:     2,
      });

      plans.push({
        priority:        scored.grade,
        score:           scored.score,
        score_breakdown: scored.breakdown,
        action_type:     'comparison_article',
        target_cluster:  clusterName,
        title:           comp.title || comp,
        slug_suggestion: null,
        reason:          `Missing comparison page in ${clusterName}. Comparison articles provide institutional-quality educational context and attract significant cross-linking.`,
        expected_topology_improvement: `+1 comparison node in ${clusterName}; +6-10 cross-links via shared ETF entities; improves cluster cross-link density.`,
        related_nodes:   [],
        repair_strategy: `Generate compare/ page for: "${comp.title || comp}". Include head-to-head data table, methodology, and use-case guidance. Link to both ETF pages and cluster hub.`,
        status:          'planned',
      });
    }
  }

  return plans;
}

function buildOrphanRepairOpportunities(data) {
  const { orphans, clusters, graph } = data;
  const plans = [];

  const graphNodes = new Map((graph.nodes || []).map(n => [n.id, n]));
  const inboundMap = {};
  for (const edge of (graph.edges || [])) {
    if (edge.relationship === 'links_to') {
      (inboundMap[edge.to] = inboundMap[edge.to] || []).push(edge.from);
    }
  }

  for (const orphan of (orphans.orphans || []).slice(0, 25)) {
    const node = graphNodes.get(orphan.id);
    if (!node) continue;
    const clusterName = (node.clusters || [])[0] || 'general';
    const clusterData = (clusters.clusters || {})[clusterName] || {};
    const clusterGrade = clusterData.health_grade || 'WEAK';

    const relatedNodes = (graph.edges || [])
      .filter(e => (e.from === orphan.id || e.to === orphan.id) &&
                   ['related_to', 'asset_exposure', 'curated_pair'].includes(e.relationship))
      .map(e => e.from === orphan.id ? e.to : e.from)
      .filter(id => id !== orphan.id)
      .slice(0, 4);

    const scored = scoreOpportunity({
      action_type:        'orphan_repair',
      target_cluster:     clusterName,
      cluster_grade:      clusterGrade,
      orphanCountDelta:   1,
      crawlDelta:         1,
      authorityDelta:     5,
      isHubAdjacent:      relatedNodes.some(id => (graphNodes.get(id) || {}).type === 'hub'),
      hubIsWeak:          clusterGrade === 'WEAK',
      linksToHub:         false,
      isComparison:       node.type === 'compare',
      bridgesThemes:      relatedNodes.length >= 2,
      hasHighPriorityGap: (orphan.risk_score || orphan.orphan_risk_score || 0) >= 60,
      narrativeContinuity:false,
      topicalUniqueness:  3,
      assetExposureOverlap:(node.etf_entities || []).length,
      clustersServed:     1,
    });

    plans.push({
      priority:        scored.grade,
      score:           scored.score,
      score_breakdown: scored.breakdown,
      action_type:     'orphan_repair',
      target_cluster:  clusterName,
      orphan_page:     orphan.id,
      orphan_type:     node.type,
      reason:          `"${node.title || orphan.id}" has zero inbound links. Risk score: ${orphan.risk_score || orphan.orphan_risk_score || 0}. Invisible to search crawlers following internal links.`,
      expected_topology_improvement: `Removes 1 orphan page; improves crawl coverage; +1 inbound link to ${node.type} page.`,
      related_nodes:   relatedNodes,
      repair_strategy: relatedNodes.length > 0
        ? `Inject contextual link to "${node.title || orphan.id}" from: ${relatedNodes.slice(0, 2).join(', ')}.`
        : `Add "${node.title || orphan.id}" to the most relevant hub page listing or cluster index.`,
      repair_candidates: relatedNodes.slice(0, 3),
      etf_entities:    node.etf_entities || [],
      status:          'planned',
    });
  }

  return plans;
}

function buildHubReinforcementOpportunities(data) {
  const { clusters, topology } = data;
  const plans = [];

  const weakClusters = Object.entries(clusters.clusters || {})
    .filter(([, c]) => c.health_grade === 'WEAK')
    .sort((a, b) => (a[1].avg_authority || 0) - (b[1].avg_authority || 0));

  for (const [clusterName, clusterData] of weakClusters.slice(0, 4)) {
    const hubCoverage = clusterData.hub_count / Math.max(1, clusterData.total_hubs);

    const scored = scoreOpportunity({
      action_type:        'hub_reinforcement',
      target_cluster:     clusterName,
      cluster_grade:      'WEAK',
      orphanCountDelta:   0,
      crawlDelta:         5,
      authorityDelta:     15,
      isHubAdjacent:      true,
      hubIsWeak:          true,
      linksToHub:         true,
      isComparison:       false,
      bridgesThemes:      true,
      hasHighPriorityGap: hubCoverage < 0.7,
      narrativeContinuity:false,
      topicalUniqueness:  6,
      assetExposureOverlap:2,
      clustersServed:     1,
    });

    plans.push({
      priority:        scored.grade,
      score:           scored.score,
      score_breakdown: scored.breakdown,
      action_type:     'hub_reinforcement',
      target_cluster:  clusterName,
      reason:          `${clusterData.label} cluster is WEAK (avg authority: ${clusterData.avg_authority}, pages: ${clusterData.page_count}/${clusterData.ideal_depth} ideal). Hub coverage: ${clusterData.hub_count}/${clusterData.total_hubs}.`,
      expected_topology_improvement: `Strengthens ${clusterName} cluster from WEAK; improves avg authority; adds hub-level crawl paths for ${clusterData.page_count} cluster pages.`,
      related_nodes:   [],
      repair_strategy: `Add cluster-specific content cluster index or hub listing page for ${clusterData.label}. Link all ${clusterName} articles from hub. Add hub link to all ${clusterName} articles.`,
      hub_pages_missing: (clusterData.total_hubs - clusterData.hub_count),
      orphan_pages:    clusterData.orphan_pages || [],
      status:          'planned',
    });
  }

  return plans;
}

function buildLinkRebalancingOpportunities(data) {
  const { clusters, topology } = data;
  const plans = [];

  const fairClusters = Object.entries(clusters.clusters || {})
    .filter(([, c]) => c.health_grade === 'FAIR' && c.cross_link_density < 0.1);

  for (const [clusterName, clusterData] of fairClusters.slice(0, 3)) {
    const scored = scoreOpportunity({
      action_type:        'link_rebalancing',
      target_cluster:     clusterName,
      cluster_grade:      'FAIR',
      orphanCountDelta:   0,
      crawlDelta:         2,
      authorityDelta:     6,
      isHubAdjacent:      Boolean(clusterData.hub_count > 0),
      hubIsWeak:          false,
      linksToHub:         true,
      isComparison:       false,
      bridgesThemes:      false,
      hasHighPriorityGap: false,
      narrativeContinuity:false,
      topicalUniqueness:  2,
      assetExposureOverlap:1,
      clustersServed:     1,
    });

    plans.push({
      priority:        scored.grade,
      score:           scored.score,
      score_breakdown: scored.breakdown,
      action_type:     'link_rebalancing',
      target_cluster:  clusterName,
      reason:          `${clusterData.label} cluster has FAIR health but low cross-link density (${clusterData.cross_link_density}). Pages in this cluster are not cross-linking sufficiently.`,
      expected_topology_improvement: `Improves cross-link density from ${clusterData.cross_link_density} toward 0.15+; distributes authority more evenly across ${clusterData.page_count} cluster pages.`,
      related_nodes:   (clusterData.top_pages || []).map(p => p.id),
      repair_strategy: `Add contextual cross-links between top-authority cluster pages and lower-authority cluster pages. Target: each cluster page should link to at least 2 cluster peers.`,
      weak_pages:      (clusterData.weak_pages || []).slice(0, 5),
      status:          'planned',
    });
  }

  return plans;
}

// ─── PLAN SUMMARY ────────────────────────────────────────────────────────────

function buildSummary(plans, data) {
  const byType  = {};
  const byGrade = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const p of plans) {
    byType[p.action_type] = (byType[p.action_type] || 0) + 1;
    byGrade[p.priority]   = (byGrade[p.priority]   || 0) + 1;
  }

  const { orphans, topology, clusters } = data;
  return {
    total_plans:         plans.length,
    by_priority:         byGrade,
    by_action_type:      byType,
    current_topology_grade:  topology.overall_grade || 'D',
    current_orphan_count:    (orphans.summary || {}).orphan_count || 0,
    current_crawl_coverage:  (topology.crawl_efficiency || {}).crawl_coverage_pct || 0,
    cluster_summary:         clusters.summary || {},
    expected_improvements: {
      orphan_reduction:   Math.min((orphans.summary || {}).orphan_count || 0, byGrade.CRITICAL * 3 + byGrade.HIGH * 2),
      topology_delta:     byGrade.CRITICAL >= 3 ? 'C' : byGrade.HIGH >= 5 ? 'C–' : 'D+',
      cluster_upgrades:   byType.hub_reinforcement || 0,
    },
  };
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

function buildExpansionPlan() {
  const data = loadInputs();
  const { rankPlans } = require('./score-authority-expansion');

  const allPlans = [
    ...buildSupportArticleOpportunities(data),
    ...buildComparisonOpportunities(data),
    ...buildOrphanRepairOpportunities(data),
    ...buildHubReinforcementOpportunities(data),
    ...buildLinkRebalancingOpportunities(data),
  ];

  // Add sequential IDs
  const ranked = rankPlans(allPlans).map((plan, i) => ({
    id:  `plan-${String(i + 1).padStart(3, '0')}`,
    ...plan,
  }));

  const summary = buildSummary(ranked, data);
  return { summary, plans: ranked };
}

module.exports = { buildExpansionPlan };

if (require.main === module) {
  const write = process.argv.includes('--write');
  const result = buildExpansionPlan();
  const output = {
    version:      '1.0',
    generated_at: new Date().toISOString(),
    description:  'Autonomous authority expansion plan — ranked repair actions for cluster health, orphan reduction, and topology improvement.',
    ...result,
  };

  if (write) {
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Authority expansion plan written → ${OUT}`);
    console.log(`  Total plans: ${result.summary.total_plans}`);
    console.log(`  CRITICAL: ${result.summary.by_priority.CRITICAL}  HIGH: ${result.summary.by_priority.HIGH}  MEDIUM: ${result.summary.by_priority.MEDIUM}  LOW: ${result.summary.by_priority.LOW}`);
    console.log(`  Action types: ${JSON.stringify(result.summary.by_action_type)}`);
  } else {
    console.log(JSON.stringify(output, null, 2));
  }
}
