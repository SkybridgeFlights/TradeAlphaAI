'use strict';

const fs   = require('fs');
const path = require('path');
const { rankPlans } = require('./score-authority-expansion');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'data', 'content-roadmap.json');
const WRITE = process.argv.includes('--write');

function readJson(filePath, fallback = {}) {
  const p = typeof filePath === 'string' && filePath.startsWith('/')
    ? filePath
    : path.join(ROOT, filePath);
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

// ─── HORIZON LABELS ──────────────────────────────────────────────────────────

function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const TODAY = new Date().toISOString().slice(0, 10);

function horizonLabel(index) {
  if (index <= 2)  return { window: 'immediate', target_date: addDays(TODAY, 3)  };
  if (index <= 5)  return { window: 'near_term', target_date: addDays(TODAY, 10) };
  if (index <= 10) return { window: 'short_term', target_date: addDays(TODAY, 21) };
  return              { window: 'medium_term', target_date: addDays(TODAY, 45) };
}

// ─── ROADMAP BUILDERS ─────────────────────────────────────────────────────────

function buildCriticalMissingArticles(gaps, clusters) {
  const items = [];
  for (const topic of (gaps.prioritized_topic_suggestions || []).filter(t => t.priority === 'high')) {
    const clusterData = (clusters.clusters || {})[topic.cluster] || {};
    items.push({
      type:          'missing_article',
      priority:      'HIGH',
      title:         topic.title,
      cluster:       topic.cluster,
      cluster_grade: clusterData.health_grade || 'UNKNOWN',
      action:        `Generate support article: "${topic.title}"`,
      impact:        `Fills critical gap in ${topic.cluster} cluster`,
      etf_anchors:   topic.related_etfs || [],
    });
  }
  return items;
}

function buildWeakClusterItems(clusters) {
  return Object.entries(clusters.clusters || {})
    .filter(([, c]) => c.health_grade === 'WEAK')
    .sort((a, b) => (a[1].avg_authority || 0) - (b[1].avg_authority || 0))
    .map(([name, data]) => ({
      type:     'cluster_repair',
      priority: 'HIGH',
      cluster:  name,
      label:    data.label,
      grade:    data.health_grade,
      action:   `Strengthen ${data.label} cluster: ${data.page_count}/${data.ideal_depth} pages, avg auth ${data.avg_authority}, ${data.orphan_count} orphans`,
      impact:   `Upgrading from WEAK to FAIR requires ~${Math.max(1, data.ideal_depth - data.page_count)} new pages + orphan repair`,
      missing_pages: Math.max(0, data.ideal_depth - data.page_count),
    }));
}

function buildOrphanRepairItems(orphans, clusters) {
  const highRisk = (orphans.orphans || [])
    .filter(o => (o.orphan_risk_score || 0) >= 60)
    .slice(0, 10);

  return highRisk.map(o => ({
    type:      'orphan_repair',
    priority:  'MEDIUM',
    orphan_id: o.id,
    cluster:   (o.clusters || ['general'])[0],
    action:    `Repair orphan: ${path.basename(o.id)} — add inbound link from related page`,
    impact:    `Reduces orphan count; improves crawl coverage; authority propagation`,
    risk_score: o.orphan_risk_score || 0,
  }));
}

function buildNextComparisonItems(gaps) {
  const comparisons = [];
  for (const [cluster, gapData] of Object.entries(gaps.cluster_gaps || {})) {
    for (const comp of (gapData.missing_comparisons || []).slice(0, 2)) {
      comparisons.push({
        type:    'comparison_article',
        priority:'HIGH',
        cluster,
        title:   comp.title || comp,
        action:  `Generate compare/ page: "${comp.title || comp}"`,
        impact:  'Adds cross-cluster node; high inbound link magnetism; educational value',
      });
    }
  }
  return comparisons.slice(0, 6);
}

function buildEducationalBridgeItems(gaps, clusters) {
  const bridges = [];
  for (const topic of (gaps.prioritized_topic_suggestions || []).filter(t => t.priority === 'medium')) {
    const clusterData = (clusters.clusters || {})[topic.cluster] || {};
    bridges.push({
      type:          'educational_bridge',
      priority:      'MEDIUM',
      title:         topic.title,
      cluster:       topic.cluster,
      cluster_grade: clusterData.health_grade || 'UNKNOWN',
      action:        `Generate educational bridge article: "${topic.title}"`,
      impact:        'Cross-cluster educational connection; supports topical authority depth',
    });
  }
  return bridges.slice(0, 5);
}

function buildTopologyRepairItems(rebalance) {
  const items = [];
  for (const priority of (rebalance.rebalancing_priorities || []).slice(0, 4)) {
    items.push({
      type:    'topology_repair',
      priority:'MEDIUM',
      cluster: priority.cluster,
      grade:   priority.grade,
      action:  `Improve ${priority.cluster} cross-link density: ${priority.opp_count} link opportunities available`,
      impact:  `Density gap: ${priority.density_gap}; target: 0.12+`,
      actions: priority.actions || [],
    });
  }
  return items;
}

function buildAuthorityExpansionItems(plan) {
  return (plan.plans || [])
    .filter(p => ['CRITICAL', 'HIGH'].includes(p.priority))
    .slice(0, 8)
    .map(p => ({
      type:        'authority_expansion',
      priority:    p.priority,
      action_type: p.action_type,
      cluster:     p.target_cluster,
      title:       p.title || `${p.action_type} for ${p.target_cluster}`,
      action:      p.repair_strategy || p.reason,
      impact:      p.expected_topology_improvement,
      score:       p.score,
    }));
}

// ─── ROADMAP METRICS ──────────────────────────────────────────────────────────

function buildMetrics(orphans, topology, clusters, plan) {
  return {
    current: {
      topology_grade:    topology.overall_grade || 'D',
      orphan_count:      (orphans.summary || {}).orphan_count || 0,
      orphan_ratio_pct:  (orphans.summary || {}).orphan_ratio || 0,
      crawl_coverage_pct:(topology.crawl_efficiency || {}).crawl_coverage_pct || 0,
      strong_clusters:   (clusters.summary || {}).strong || 0,
      weak_clusters:     (clusters.summary || {}).weak   || 0,
      zero_authority_pages: (topology.authority_distribution || {}).zero_authority_count || 0,
    },
    targets: {
      topology_grade:      'C',
      orphan_count:        25,
      crawl_coverage_pct:  92,
      weak_clusters:       1,
      zero_authority_pages:15,
    },
    plan_impact: {
      total_plans:      (plan.plans || []).length,
      critical_actions: (plan.plans || []).filter(p => p.priority === 'CRITICAL').length,
      high_actions:     (plan.plans || []).filter(p => p.priority === 'HIGH').length,
    },
  };
}

// ─── ASSEMBLE ROADMAP ─────────────────────────────────────────────────────────

function buildRoadmap() {
  const gaps      = readJson('data/content-gap-report.json', {});
  const clusters  = readJson('data/content-clusters.json', { clusters: {}, summary: {} });
  const orphans   = readJson('data/orphan-pages-report.json', { orphans: [], summary: {} });
  const topology  = readJson('data/seo-topology-report.json', {});
  const plan      = readJson('data/authority-expansion-plan.json', { plans: [] });

  // Try to load rebalance report if available
  let rebalance = readJson('data/topology-rebalance-report.json', { rebalancing_priorities: [] });

  const rawItems = [
    ...buildCriticalMissingArticles(gaps, clusters),
    ...buildWeakClusterItems(clusters),
    ...buildNextComparisonItems(gaps),
    ...buildOrphanRepairItems(orphans, clusters),
    ...buildEducationalBridgeItems(gaps, clusters),
    ...buildTopologyRepairItems(rebalance),
    ...buildAuthorityExpansionItems(plan),
  ];

  // Deduplicate by title/action
  const seen = new Set();
  const uniqueItems = rawItems.filter(item => {
    const raw = item.title || (Array.isArray(item.action) ? item.action[0] : item.action) || '';
    const key = String(raw).slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const gradeOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const sorted = [...uniqueItems].sort((a, b) => (gradeOrder[a.priority] ?? 2) - (gradeOrder[b.priority] ?? 2));

  const items = sorted.map((item, i) => ({
    id: `road-${String(i + 1).padStart(3, '0')}`,
    ...item,
    ...horizonLabel(i),
  }));

  const metrics = buildMetrics(orphans, topology, clusters, plan);

  return { metrics, items };
}

module.exports = { buildRoadmap };

if (require.main === module) {
  const result = buildRoadmap();
  const output = {
    version:      '1.0',
    generated_at: new Date().toISOString(),
    description:  'Rolling institutional content roadmap — critical gaps, cluster repairs, orphan repair, topology improvements.',
    ...result,
  };

  console.log(`Content Roadmap — ${result.items.length} items`);
  console.log(`  Current topology grade: ${result.metrics.current.topology_grade}  Target: ${result.metrics.targets.topology_grade}`);
  console.log(`  Orphans: ${result.metrics.current.orphan_count}  Target: ${result.metrics.targets.orphan_count}`);
  console.log(`  Crawl coverage: ${result.metrics.current.crawl_coverage_pct}%  Target: ${result.metrics.targets.crawl_coverage_pct}%`);
  console.log(`  Immediate window: ${result.items.filter(i => i.window === 'immediate').length} items`);
  console.log(`  Near term: ${result.items.filter(i => i.window === 'near_term').length} items`);

  if (WRITE) {
    fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`Roadmap written → ${OUT}`);
  }
}
