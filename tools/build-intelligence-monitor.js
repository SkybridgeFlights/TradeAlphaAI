'use strict';

// Phase 108 — Observability & Intelligence Monitoring aggregator.
//
// Reads the canonical intelligence artifacts produced across Phases 101–107 and
// derives operational monitoring artifacts. It NEVER fabricates a state: health
// is derived deterministically from artifact freshness (generated_at/updated_at)
// and content. A missing artifact is reported 'unavailable', a stale one
// 'degraded' — never silently 'healthy'. This is operational truth, not a
// flashy dashboard.
//
// Outputs:
//   data/system-status/intelligence-monitor.json     (top-level summary)
//   data/system-status/workflow-health.json
//   data/system-status/publishing-decisions.json
//   data/system-status/acquisition-health.json
//   data/system-status/reaction-capture-health.json
//
// Usage: node tools/build-intelligence-monitor.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SS = path.join(ROOT, 'data', 'system-status');

function readJson(rel, f) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return f; } }
function ageHours(ts) { if (!ts) return null; const t = Date.parse(ts); return Number.isNaN(t) ? null : Math.round((Date.now() - t) / 3600000 * 10) / 10; }
function freshness(ts, staleH) {
  const a = ageHours(ts);
  if (a === null) return { state: 'unavailable', age_hours: null };
  if (a > staleH * 2) return { state: 'degraded', age_hours: a };
  if (a > staleH) return { state: 'warning', age_hours: a };
  return { state: 'healthy', age_hours: a };
}
const HEALTH_RANK = { healthy: 0, warning: 1, degraded: 2, unavailable: 3 };
function worst(states) { return states.reduce((acc, s) => (HEALTH_RANK[s] > HEALTH_RANK[acc] ? s : acc), 'healthy'); }

// ── Workflow health (artifact freshness as the honest run-recency proxy) ──────
const WORKFLOWS = [
  { name: 'Market News Brain', cadence: '13/16/19 UTC weekdays', artifact: 'data/intelligence/news-eligibility.json', stale_h: 30 },
  { name: 'Market Outlook Brain', cadence: 'Mon/Wed/Fri 09:40', artifact: 'data/intelligence/chart-narratives.json', stale_h: 80 },
  { name: 'Briefs Brain', cadence: 'daily 07:00 + 15:00 wkday', artifact: 'data/intelligence/daily-intelligence-brief.json', stale_h: 30 },
  { name: 'Articles Brain', cadence: 'daily 06:10', artifact: 'data/intelligence/educational-topics.json', stale_h: 30 },
  { name: 'Distribution Brain', cadence: 'twice daily', artifact: 'data/social/distribution-plan.json', stale_h: 30 },
  { name: 'Intraday Market Watch', cadence: 'every 30 min US session', artifact: 'data/live-market-state.json', stale_h: 24 },
];

function workflowHealth() {
  const workflows = WORKFLOWS.map((w) => {
    const art = readJson(w.artifact, null);
    const ts = art ? (art.generated_at || art.updated_at || null) : null;
    const f = freshness(ts, w.stale_h);
    return { name: w.name, cadence: w.cadence, primary_artifact: w.artifact, last_artifact_at: ts, age_hours: f.age_hours, health: f.state };
  });
  return { schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'workflow-health', overall: worst(workflows.map((w) => w.health)), workflows };
}

// ── Publishing decisions (why each brain published / did not) ─────────────────
function publishingDecisions() {
  const elig = readJson('data/intelligence/news-eligibility.json', { eligible: [] });
  const coverage = readJson('data/intelligence/market-news-coverage.json', { published: [] });
  const eduTopics = readJson('data/intelligence/educational-topics.json', {});
  const brief = readJson('data/intelligence/daily-intelligence-brief.json', {});

  const decisions = [];
  // Market News Brain
  const eligibleCount = (elig.eligible || []).length;
  const lastPublished = (coverage.published || []).slice(-1)[0] || null;
  decisions.push({
    brain: 'Market News Brain',
    decision: eligibleCount > 0 ? 'eligible_for_publish' : 'no_publish',
    reason: eligibleCount > 0
      ? `${eligibleCount} event(s) cleared the significance threshold (${elig.significance_threshold ?? 70}).`
      : 'No event cleared the significance threshold — desk reacts to released, surprising, cross-asset-confirmed events only.',
    selected_event: eligibleCount > 0 ? (elig.eligible[0].headline || elig.eligible[0].id) : null,
    eligibility_score: eligibleCount > 0 ? elig.eligible[0].significance : null,
    cooldown_hours: elig.cluster_cooldown_hours ?? null,
    last_published: lastPublished ? { headline: lastPublished.headline, slug: lastPublished.slug, at: lastPublished.published_at } : null,
    eligibility_at: elig.updated_at || null,
  });
  // Articles Brain
  const eduEligible = eduTopics.counts ? eduTopics.counts.eligible : (eduTopics.eligible_count ?? null);
  decisions.push({
    brain: 'Articles Brain',
    decision: 'topic_refresh',
    reason: eduEligible != null ? `Educational topic engine has ${eduEligible} eligible topic(s) under anti-repetition.` : 'Educational topic state reported by the topic engine.',
    eligibility_at: eduTopics.updated_at || eduTopics.generated_at || null,
  });
  // Briefs Brain
  decisions.push({
    brain: 'Briefs Brain',
    decision: brief.verified === true ? 'brief_current' : 'brief_degraded',
    reason: brief.verified === true ? 'Daily intelligence brief is verified and current.' : 'Daily intelligence brief is unverified or stale.',
    eligibility_at: brief.updated_at || brief.generated_at || null,
  });
  return { schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'publishing-decisions', decisions };
}

// ── Acquisition health (macro/calendar sources) ───────────────────────────────
function acquisitionHealth() {
  const intel = readJson('data/intelligence/economic-intelligence.json', { events: [], enrichment: {} });
  const global = readJson('data/intelligence/global-macro-events.json', { coverage: {}, counts: {} });
  const cal = readJson('data/economic-calendar.json', { events: [], source: null });
  const enr = intel.enrichment || {};
  const keys = enr.keys_present || {};
  const fp = enr.forecast_providers || {};

  const sources = [
    { id: 'fred', kind: 'official_actuals', available: !!keys.fred, note: keys.fred ? 'FRED official enrichment active.' : 'FRED key absent — actuals degrade to scheduled/awaiting.' },
    { id: 'fmp_forecast', kind: 'consensus_forecast', available: fp.fmp ? fp.fmp.ok === true : false, note: (fp.fmp && !fp.fmp.ok) ? `FMP forecast unavailable (${fp.fmp.reason || 'no key'}).` : (fp.fmp ? 'FMP forecast active.' : 'FMP forecast not attempted.') },
    { id: 'finnhub_forecast', kind: 'consensus_forecast', available: fp.finnhub ? fp.finnhub.ok === true : false, note: (fp.finnhub && !fp.finnhub.ok) ? `Finnhub forecast unavailable (${fp.finnhub.reason || 'no key'}).` : (fp.finnhub ? 'Finnhub forecast active.' : 'Finnhub forecast not attempted.') },
    { id: 'global_official_schedules', kind: 'official_schedule', available: (global.counts && global.counts.total > 0), note: `Global official schedules: ${(global.counts && global.counts.total) || 0} event(s) across ${(global.coverage && global.coverage.by_region) ? Object.keys(global.coverage.by_region).length : 0} region(s).` },
  ];
  const calEvents = (cal.events || []).length;
  const byCountry = {};
  for (const e of cal.events || []) byCountry[e.country] = (byCountry[e.country] || 0) + 1;
  const officialVsEstimated = global.coverage && global.coverage.by_method ? global.coverage.by_method : {};

  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'acquisition-health',
    calendar_source: cal.source || null, calendar_event_count: calEvents, calendar_age_hours: ageHours(cal.updated_at),
    coverage_by_country: byCountry, regions: global.coverage ? global.coverage.by_region : {},
    official_vs_estimated: officialVsEstimated,
    sources,
    degraded_sources: sources.filter((s) => !s.available).map((s) => s.id),
    overall: sources.some((s) => s.id === 'fred' && s.available) || calEvents > 0 ? (sources.filter((s) => !s.available).length >= 3 ? 'degraded' : 'warning') : 'degraded',
  };
}

// ── Reaction capture monitoring ───────────────────────────────────────────────
function reactionCaptureHealth() {
  const rx = readJson('data/intelligence/macro-reactions.json', { reactions: [], counts: {} });
  const capture = readJson('data/market-brief/historical-reactions.json', { entries: [] });
  const reactions = rx.reactions || [];
  const withData = reactions.filter((r) => r.has_reaction_data).length;
  const awaiting = reactions.filter((r) => r.classification === 'awaiting_data').length;
  const tracked = rx.tracked_assets || [];
  const assetsCovered = new Set();
  for (const r of reactions) for (const m of (r.cross_asset_matrix || [])) if (m.confirms !== null) assetsCovered.add(m.asset);

  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'reaction-capture-health',
    captured_entries: (capture.entries || capture.reactions || []).length,
    considered_events: reactions.length, reaction_ready: withData, awaiting_data: awaiting,
    assets_tracked: tracked, assets_covered: [...assetsCovered], assets_missing: tracked.filter((a) => !assetsCovered.has(a)),
    health: (capture.entries || []).length === 0 ? 'warning' : 'healthy',
    note: (capture.entries || []).length === 0 ? 'No observed reaction windows captured yet — reactions are awaiting_data (honest, not fabricated).' : null,
  };
}

// ── Regime monitor (from liquidity-regime) ────────────────────────────────────
function regimeMonitor() {
  const rg = readJson('data/intelligence/liquidity-regime.json', null);
  if (!rg) return { available: false, health: 'unavailable' };
  const age = rg.attribution ? rg.attribution.market_state_age_hours : ageHours(rg.generated_at);
  return {
    available: true,
    regime: rg.regime, liquidity_state: rg.liquidity_state, stability: rg.stability,
    confidence: rg.confidence, coherence: rg.cross_asset_coherence ? rg.cross_asset_coherence.score : null,
    sub_states: rg.sub_states || {}, market_state_age_hours: age,
    health: rg.regime === 'indeterminate' ? 'warning' : (typeof age === 'number' && age > 48 ? 'degraded' : 'healthy'),
    stale_warning: typeof age === 'number' && age > 48,
  };
}

function build() {
  const wf = workflowHealth();
  const decisions = publishingDecisions();
  const acq = acquisitionHealth();
  const reaction = reactionCaptureHealth();
  const regime = regimeMonitor();

  const overall = worst([wf.overall, acq.overall, reaction.health, regime.health || 'healthy']);
  const monitor = {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'intelligence-monitor',
    overall_health: overall,
    regime: { regime: regime.regime || 'unavailable', liquidity_state: regime.liquidity_state || null, stability: regime.stability || null, confidence: regime.confidence ?? null, coherence: regime.coherence ?? null, health: regime.health || 'unavailable', stale_warning: !!regime.stale_warning },
    publishing: { market_news: decisions.decisions[0].decision, market_news_reason: decisions.decisions[0].reason },
    acquisition: { calendar_source: acq.calendar_source, event_count: acq.calendar_event_count, degraded_sources: acq.degraded_sources, regions: acq.regions, health: acq.overall },
    reaction_capture: { considered: reaction.considered_events, reaction_ready: reaction.reaction_ready, awaiting: reaction.awaiting_data, health: reaction.health },
    workflows: wf.workflows.map((w) => ({ name: w.name, health: w.health, age_hours: w.age_hours })),
  };
  return { monitor, wf, decisions, acq, reaction, regime };
}

function main() {
  const write = process.argv.includes('--write');
  const { monitor, wf, decisions, acq, reaction } = build();
  console.log(`[intel-monitor] overall=${monitor.overall_health} | news=${monitor.publishing.market_news} | acquisition=${acq.overall} (${acq.calendar_event_count} events) | reaction=${reaction.health} | workflows=${wf.workflows.map((w) => w.health).join(',')}`);
  if (write) {
    fs.mkdirSync(SS, { recursive: true });
    fs.writeFileSync(path.join(SS, 'intelligence-monitor.json'), JSON.stringify(monitor, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(SS, 'workflow-health.json'), JSON.stringify(wf, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(SS, 'publishing-decisions.json'), JSON.stringify(decisions, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(SS, 'acquisition-health.json'), JSON.stringify(acq, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(SS, 'reaction-capture-health.json'), JSON.stringify(reaction, null, 2) + '\n', 'utf8');
    console.log('[intel-monitor] wrote 5 monitoring artifacts to data/system-status/');
  }
}

if (require.main === module) main();

module.exports = { build, workflowHealth, publishingDecisions, acquisitionHealth, reactionCaptureHealth, regimeMonitor, HEALTH_RANK };
