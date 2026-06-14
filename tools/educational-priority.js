'use strict';

// Phase 123 — Educational priority engine (pure, deterministic, no ML).
//
// Turns the educational brain from a raw topic-rotator into an institutional
// editorial orchestrator. Given the cooldown-filtered, unpublished, library-
// backed candidates plus the publication history, it ranks them so that:
//   1. DEEP concepts (full `depth` object, concept.is_deep) outrank shallow
//      factory concepts — deep-first is structural, not advisory.
//   2. Editorial progression is rewarded: a concept that is the natural
//      next-reading of a recently published one gets a continuity bonus.
//   3. Topical diversity is rewarded: repeating the same category as the most
//      recent publications is penalised so the feed does not cluster-spam.
//   4. Shallow concepts cannot dominate consecutive publishing: if the recent
//      run is already shallow-heavy, shallow candidates are pushed down further.
// Honest degradation: when no deep concept qualifies, shallow factory concepts
// remain eligible as fallback. Scoring is integer-weighted and explainable.

// Editorial progression chains — each concept's natural next-reading sequence.
// Concepts that are the immediate successor of a recent publication earn a
// continuity bonus so the desk reads as cumulative rather than random.
const SEQUENCES = [
  ['liquidity-tightening', 'liquidity-absorption', 'defensive-rotation', 'volatility-expansion'],
  ['yield-curve-pressure', 'real-yields-gold', 'tlt-duration-sensitivity', 'yields-growth-equities'],
  ['breadth-deterioration', 'narrow-leadership', 'concentration-risk', 'participation-quality'],
  ['risk-on-risk-off-regimes', 'defensive-rotation', 'liquidity-tightening', 'volatility-expansion'],
];

const W = {
  DEEP: 1000,        // deep-first dominates base priority + every other bonus
  PROGRESSION: 60,   // candidate is the next-reading of the most recent publication
  RELATED: 25,       // candidate is a related-concept of a recent publication
  SAME_CLUSTER: -35, // candidate repeats the most recent publication's category
  SAME_CLUSTER_2: -70, // ...and the two most recent publications share that category
  SHALLOW_RUN: -150, // shallow candidate while the recent run is already shallow-heavy
};

// nextOf(slug): the immediate successors of `slug` across all sequence chains.
function nextOf(slug) {
  const out = new Set();
  for (const chain of SEQUENCES) {
    const i = chain.indexOf(slug);
    if (i >= 0 && i + 1 < chain.length) out.add(chain[i + 1]);
  }
  return out;
}

// Score one candidate deterministically; returns { id, score, is_deep, reasons }.
function scoreCandidate(topic, ctx) {
  const lib = ctx.library || {};
  const concept = lib[topic.id] || {};
  const recent = ctx.recentSlugs || []; // newest-first published slugs
  const reasons = [];
  let score = Number(topic.priority || 0);
  reasons.push(`base ${score}`);

  const isDeep = !!concept.is_deep;
  if (isDeep) { score += W.DEEP; reasons.push(`deep +${W.DEEP}`); }

  // Progression: candidate is the next-reading of the most recent publication.
  const lastSlug = recent[0];
  if (lastSlug && nextOf(lastSlug).has(topic.id)) { score += W.PROGRESSION; reasons.push(`progression-from:${lastSlug} +${W.PROGRESSION}`); }
  // Related-concept continuity with any of the last two publications.
  for (const r of recent.slice(0, 2)) {
    const rel = (lib[r] && lib[r].related_concepts) || [];
    if (rel.includes(topic.id)) { score += W.RELATED; reasons.push(`related-to:${r} +${W.RELATED}`); break; }
  }

  // Topical diversity: penalise repeating the most-recent category.
  const cat = concept.category;
  const catOf = (s) => lib[s] && lib[s].category;
  if (cat && recent[0] && catOf(recent[0]) === cat) {
    if (recent[1] && catOf(recent[1]) === cat) { score += W.SAME_CLUSTER_2; reasons.push(`cluster×2 ${W.SAME_CLUSTER_2}`); }
    else { score += W.SAME_CLUSTER; reasons.push(`cluster ${W.SAME_CLUSTER}`); }
  }

  // Anti-shallow-domination: a shallow candidate while the last two were shallow.
  if (!isDeep) {
    const recentShallow = recent.slice(0, 2).filter((s) => lib[s] && lib[s].is_deep === false).length;
    if (recentShallow >= 2) { score += W.SHALLOW_RUN; reasons.push(`shallow-run ${W.SHALLOW_RUN}`); }
  }

  return { id: topic.id, score, is_deep: isDeep, reasons };
}

// Rank candidates; deterministic tie-break by base priority then id.
function rankCandidates(candidates, ctx) {
  return candidates
    .map((t) => ({ topic: t, ...scoreCandidate(t, ctx) }))
    .sort((a, b) => (b.score - a.score) || ((b.topic.priority || 0) - (a.topic.priority || 0)) || a.id.localeCompare(b.id));
}

module.exports = { SEQUENCES, W, nextOf, scoreCandidate, rankCandidates };
