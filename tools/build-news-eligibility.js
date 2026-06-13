'use strict';

// Phase 95 — Market News Brain: event-significance & cooldown engine.
// Decides which market events justify an institutional news-reaction article.
// It is a DECISION layer only — it never publishes; it produces an eligibility
// artifact a supervised publisher consumes. Reaction analysis requires an
// actual reaction, so only RELEASED high-impact events with a measurable
// surprise (plus verified cross-asset context) qualify; scheduled catalysts
// are "what to watch" (briefs/outlook territory), not news.
//
// Restraint is structural: a significance threshold, per-cluster cooldown, and
// duplicate-event memory (self-persisted). A quiet tape yields zero eligible
// events — the desk reacts to events, it does not manufacture them.
//
// Output: data/intelligence/news-eligibility.json
// Usage:  node tools/build-news-eligibility.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WIRE_PATH = path.join(ROOT, 'data', 'newswire', 'wire-events.json');
const COGNITION_PATH = path.join(ROOT, 'data', 'intelligence', 'market-cognition.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'news-eligibility.json');

const SIGNIFICANCE_THRESHOLD = 70; // a news article must clear this
const CLUSTER_COOLDOWN_HOURS = 36; // one reaction per cluster per window
const STALE_HOURS = 48;
const MAX_ELIGIBLE = 3;            // restraint cap per cycle

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function fresh(a) {
  return a && a.updated_at && (Date.now() - new Date(a.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

// Significance: released high-impact events with a real surprise, weighted by
// urgency, market impact, and verified cross-asset activity in cognition.
function scoreEvent(item, crossAssetActive) {
  if (item.kind !== 'economic_release') return 0; // reaction needs an actual release
  let score = 0;
  score += Math.min(45, (item.urgency || 0) * 0.5);
  score += Math.min(35, (item.market_impact || 0) * 0.4);
  // A measurable surprise headline (not a neutral "in line") earns weight.
  if (/\bvs\b|surprise|beat|miss|above|below|hotter|cooler|jump|plunge|spike/i.test(item.headline || '')) score += 15;
  // Verified cross-asset reaction makes the event genuinely newsworthy.
  if (crossAssetActive) score += 10;
  return Math.round(Math.min(100, score));
}

function buildEligibility() {
  const wire = readJson(WIRE_PATH, { items: [] });
  const cognition = readJson(COGNITION_PATH, null);
  const previous = readJson(OUT_PATH, null);
  const nowIso = new Date().toISOString();

  const crossAssetActive = Boolean(fresh(cognition) && cognition.verified === true
    && (cognition.causal_links || []).some((l) => l.state === 'diverging' || l.state === 'confirming'));

  // Cooldown + duplicate memory carried forward from the previous artifact.
  const prevCovered = new Map(((previous && previous.covered) || []).map((c) => [c.cluster, c.last_covered]));
  const prevEventIds = new Set(((previous && previous.covered) || []).map((c) => c.event_id));

  const candidates = [];
  for (const item of wire.items || []) {
    const significance = scoreEvent(item, crossAssetActive);
    if (significance < SIGNIFICANCE_THRESHOLD) continue;
    if (prevEventIds.has(item.id)) continue; // already covered this exact event
    const lastCovered = prevCovered.get(item.cluster);
    if (lastCovered && (Date.now() - new Date(lastCovered).getTime()) / 3600000 < CLUSTER_COOLDOWN_HOURS) {
      continue; // cluster cooldown active
    }
    candidates.push({
      event_id: item.id,
      cluster: item.cluster,
      headline: item.headline,
      significance,
      market_impact: item.market_impact || 0,
      evidence: [`newswire:${item.id}`, item.attribution || item.source || 'sourced calendar'].filter(Boolean),
      cross_asset_context: crossAssetActive,
    });
  }
  candidates.sort((a, b) => b.significance - a.significance);
  const eligible = candidates.slice(0, MAX_ELIGIBLE);

  // Carry forward covered memory (recent window) + newly eligible.
  const cutoff = Date.now() - 7 * 86400000;
  const covered = [
    ...(((previous && previous.covered) || []).filter((c) => c.last_covered && new Date(c.last_covered).getTime() >= cutoff)),
    ...eligible.map((e) => ({ cluster: e.cluster, event_id: e.event_id, last_covered: nowIso })),
  ];

  return {
    version: '1.0',
    updated_at: nowIso,
    run_date: nowIso.slice(0, 10),
    significance_threshold: SIGNIFICANCE_THRESHOLD,
    cluster_cooldown_hours: CLUSTER_COOLDOWN_HOURS,
    cross_asset_context: crossAssetActive,
    eligible,
    eligible_count: eligible.length,
    covered,
    note: eligible.length ? null : 'No event cleared the significance threshold this cycle — the News desk stays quiet (reaction analysis requires a released, surprising, market-moving event).',
    policy: { event_driven: true, no_scheduled_filler: true, reaction_analysis_only: true, supervised_publish: true },
  };
}

function main() {
  const write = process.argv.includes('--write');
  const out = buildEligibility();
  console.log(`[news-eligibility] eligible=${out.eligible_count} threshold=${out.significance_threshold}${out.eligible.map((e) => ` ${e.cluster}(${e.significance})`).join('')}`);
  if (write) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('[news-eligibility] wrote data/intelligence/news-eligibility.json');
  }
}

if (require.main === module) main();

module.exports = { buildEligibility, scoreEvent, SIGNIFICANCE_THRESHOLD, CLUSTER_COOLDOWN_HOURS, MAX_ELIGIBLE };
