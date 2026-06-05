'use strict';

// Priority grades
const GRADE_CRITICAL = 'CRITICAL';
const GRADE_HIGH     = 'HIGH';
const GRADE_MEDIUM   = 'MEDIUM';
const GRADE_LOW      = 'LOW';

const GRADE_THRESHOLDS = {
  [GRADE_CRITICAL]: 80,
  [GRADE_HIGH]:     60,
  [GRADE_MEDIUM]:   35,
  [GRADE_LOW]:      0,
};

const CLUSTER_WEAKNESS_SCORES = {
  WEAK:   20,
  FAIR:   8,
  STRONG: 0,
};

const ACTION_BASE_SCORES = {
  support_article:    30,
  comparison_article: 28,
  hub_reinforcement:  22,
  orphan_repair:      18,
  link_rebalancing:   12,
};

const CLUSTER_AUTHORITY_WEIGHTS = {
  ai_semiconductor:      1.1,
  yield_rates:           1.3,
  sector_rotation:       1.4,
  etf_education:         1.2,
  portfolio_construction:1.2,
  market_structure:      0.9,
  defensive_sectors:     0.9,
  growth_value:          1.0,
};

function clusterWeaknessScore(clusterGrade) {
  return CLUSTER_WEAKNESS_SCORES[clusterGrade] || 5;
}

function seoImpactScore(opts) {
  const { orphanCountDelta = 0, crawlDelta = 0, authorityDelta = 0 } = opts;
  let score = 0;
  score += Math.min(25, orphanCountDelta * 3);
  score += Math.min(15, crawlDelta * 0.5);
  score += Math.min(10, authorityDelta * 0.2);
  return Math.round(score);
}

function hubReinforcementScore(opts) {
  const { isHubAdjacent = false, hubIsWeak = false, linksToHub = false } = opts;
  let score = 0;
  if (isHubAdjacent)  score += 12;
  if (hubIsWeak)      score += 10;
  if (linksToHub)     score += 8;
  return Math.round(score);
}

function educationalValueScore(opts) {
  const { isComparison = false, bridgesThemes = false, hasHighPriorityGap = false, narrativeContinuity = false } = opts;
  let score = 0;
  if (isComparison)       score += 14;
  if (bridgesThemes)      score += 12;
  if (hasHighPriorityGap) score += 10;
  if (narrativeContinuity)score += 8;
  return Math.round(score);
}

function institutionalValueScore(opts) {
  const { topicalUniqueness = 0, assetExposureOverlap = 0, clustersServed = 1 } = opts;
  let score = 0;
  score += Math.min(10, topicalUniqueness);
  score += Math.min(8,  assetExposureOverlap * 2);
  score += Math.min(6,  (clustersServed - 1) * 3);
  return Math.round(score);
}

/**
 * Score a single authority expansion opportunity.
 * opts = {
 *   action_type, target_cluster, cluster_grade,
 *   orphanCountDelta, crawlDelta, authorityDelta,
 *   isHubAdjacent, hubIsWeak, linksToHub,
 *   isComparison, bridgesThemes, hasHighPriorityGap, narrativeContinuity,
 *   topicalUniqueness, assetExposureOverlap, clustersServed,
 *   clusterAuthorityWeight
 * }
 */
function scoreOpportunity(opts = {}) {
  const {
    action_type       = 'support_article',
    target_cluster    = 'general',
    cluster_grade     = 'FAIR',
  } = opts;

  const base       = ACTION_BASE_SCORES[action_type] || 15;
  const weakness   = clusterWeaknessScore(cluster_grade);
  const seo        = seoImpactScore(opts);
  const hub        = hubReinforcementScore(opts);
  const edu        = educationalValueScore(opts);
  const inst       = institutionalValueScore(opts);
  const weight     = CLUSTER_AUTHORITY_WEIGHTS[target_cluster] || 1.0;

  const rawScore = Math.round((base + weakness + seo + hub + edu + inst) * weight);
  const score    = Math.min(100, rawScore);

  const grade = Object.entries(GRADE_THRESHOLDS)
    .sort((a, b) => b[1] - a[1])
    .find(([, threshold]) => score >= threshold)?.[0] || GRADE_LOW;

  return {
    score,
    grade,
    breakdown: { base, weakness, seo, hub, edu, inst, weight, raw: rawScore },
  };
}

/**
 * Grade array of scored plans by priority.
 */
function rankPlans(plans) {
  const gradeOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return [...plans].sort((a, b) => {
    const gd = (gradeOrder[a.priority] ?? 3) - (gradeOrder[b.priority] ?? 3);
    if (gd !== 0) return gd;
    return (b.score || 0) - (a.score || 0);
  });
}

module.exports = { scoreOpportunity, rankPlans, GRADE_CRITICAL, GRADE_HIGH, GRADE_MEDIUM, GRADE_LOW };
