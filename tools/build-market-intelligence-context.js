'use strict';

/**
 * build-market-intelligence-context.js
 *
 * Builds a unified cross-asset, breadth, and macro intelligence context
 * consumed by the market-outlook generation pipeline.
 *
 * Detects narrative saturation (same theme 3 articles in a row) and
 * recommends intelligent rotation.
 *
 * Output: data/intelligence/market-intelligence-context.json
 *
 * Run: node tools/build-market-intelligence-context.js [--write] [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'narrative-memory.json');
const QUEUE_PATH    = path.join(ROOT, 'data', 'market-outlook-queue.json');
const INTEL_DIR     = path.join(ROOT, 'data', 'intelligence');
const OUTPUT_PATH   = path.join(INTEL_DIR, 'market-intelligence-context.json');

const DRY_RUN          = process.argv.includes('--dry-run');
const WRITE            = process.argv.includes('--write') || !DRY_RUN;
const SATURATION_WINDOW = 3;

main();

function main() {
  const live   = readJson(LIVE_PATH,   {});
  const regime = readJson(REGIME_PATH, {});
  const memory = readJson(MEMORY_PATH, { snapshots: [], latest_snapshot: null });
  const queue  = readJson(QUEUE_PATH,  { topics: [] });

  const context = {
    generated_at: new Date().toISOString(),
    data_quality: resolveDataQuality(live),
    cross_asset:  buildCrossAsset(live, regime),
    breadth:      buildBreadthContext(live, regime),
    macro:        buildMacroContext(live, regime),
    narrative_saturation: detectNarrativeSaturation(memory, queue),
    generation_guidance:  buildGenerationGuidance(memory, queue),
  };

  if (WRITE && !DRY_RUN) {
    fs.mkdirSync(INTEL_DIR, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(context, null, 2) + '\n', 'utf8');
    console.log(`[build-market-intelligence-context] Written: ${path.relative(ROOT, OUTPUT_PATH)}`);
  } else {
    console.log('[build-market-intelligence-context] Dry run — not written.');
  }

  console.log(JSON.stringify(context, null, 2));
}

// ── Cross-asset context ───────────────────────────────────────────────────────

function buildCrossAsset(live, regime) {
  const state = live.metadata && live.metadata.status === 'live' ? live : {};

  return {
    spy:  assetEntry(state, 'sp500',    'SPY'),
    qqq:  assetEntry(state, 'nasdaq',   'QQQ'),
    xlk:  assetEntry(state.sector_etfs, 'XLK',  'XLK'),
    soxx: assetEntry(state.sector_etfs, 'SOXX', 'SOXX'),
    tlt:  assetEntry(state, 'tlt',      'TLT'),
    dxy:  assetEntry(state, 'dxy',      'DXY'),
    vix:  buildVixEntry(state),
    yield_spread: buildYieldSpread(state),
  };
}

function assetEntry(source, key, label) {
  if (!source) return { label, trend: 'unverified', change_pct: null };
  const entry = source[key];
  if (!entry) return { label, trend: 'unverified', change_pct: null };
  const pct = typeof entry.change_pct === 'number' ? entry.change_pct : null;
  return {
    label,
    trend:      classifyTrend(pct),
    change_pct: pct,
    value:      typeof entry.value === 'number' ? entry.value : null,
  };
}

function buildVixEntry(live) {
  const vix = live.vix;
  const val = vix && typeof vix.value === 'number' ? vix.value : null;
  return {
    label:  'VIX',
    level:  val,
    regime: classifyVix(val),
    change_pct: vix && typeof vix.change_pct === 'number' ? vix.change_pct : null,
  };
}

function buildYieldSpread(live) {
  const spread = live.yield_spread_2y10y;
  if (!spread) return { bps: null, state: 'unverified' };
  const bps = typeof spread.spread_bps === 'number' ? spread.spread_bps : null;
  return {
    bps,
    state: classifyYieldSpread(bps),
    us10y: live.us10y_yield && typeof live.us10y_yield.value === 'number' ? live.us10y_yield.value : null,
    us2y:  live.us2y_yield  && typeof live.us2y_yield.value  === 'number' ? live.us2y_yield.value  : null,
  };
}

// ── Breadth context ───────────────────────────────────────────────────────────

function buildBreadthContext(live, regime) {
  const internals = (regime && regime.advanced_internals) || {};
  const memory    = readJson(path.join(ROOT, 'data', 'narrative-memory.json'), {});
  const latest    = (memory.snapshots || []).slice(-1)[0] || {};
  const latestInt = latest.advanced_internals || {};

  const ewVsCw = internals.equal_weight_vs_cap_weight_divergence
    || latestInt.equal_weight_vs_cap_weight_divergence
    || null;

  const participation = internals.sector_participation_score
    || latestInt.sector_participation_score
    || null;

  const concentration = internals.concentration_risk
    || latestInt.concentration_risk
    || 'unverified';

  const volatilityRegime = internals.volatility_rate_state
    || latestInt.volatility_rate_state
    || 'unverified';

  // Derive sector rotation signal from recent snapshots
  const sectorRotation = deriveSectorRotation(memory.snapshots || []);

  return {
    equal_weight_vs_cap_weight: ewVsCw,
    sector_rotation:            sectorRotation,
    sector_participation_score: participation,
    breadth_quality:            classifyBreadth(participation),
    concentration_risk:         concentration,
    volatility_regime:          volatilityRegime,
    small_cap_confirmation:     internals.small_cap_confirmation || latestInt.small_cap_confirmation || 'unverified',
  };
}

function deriveSectorRotation(snapshots) {
  if (!snapshots.length) return 'unverified';
  const recent = snapshots.slice(-3).map((s) => (s.advanced_internals || {}).defensive_participation);
  if (recent.every((v) => v === 'improving')) return 'defensive-rotation';
  const growth = snapshots.slice(-3).map((s) => (s.advanced_internals || {}).ai_semiconductor_participation);
  if (growth.every((v) => v === 'improving')) return 'growth-leadership';
  return 'mixed';
}

// ── Macro context ─────────────────────────────────────────────────────────────

function buildMacroContext(live, regime) {
  const state = live.metadata && live.metadata.status === 'live' ? live : {};
  const yieldSpread = buildYieldSpread(state);

  const fedFunds = state.fed_funds_rate && typeof state.fed_funds_rate.value === 'number'
    ? state.fed_funds_rate.value : null;

  const us10y = state.us10y_yield && typeof state.us10y_yield.value === 'number'
    ? state.us10y_yield.value : null;

  return {
    yield_curve_state:    classifyYieldSpread(yieldSpread.bps),
    yield_spread_bps:     yieldSpread.bps,
    fed_funds_rate:       fedFunds,
    us10y_yield:          us10y,
    labor_trend:          extractRegimeField(regime, 'labor_trend') || 'unverified',
    inflation_trend:      extractRegimeField(regime, 'inflation_trend') || 'unverified',
    liquidity_conditions: extractRegimeField(regime, 'liquidity_conditions') || 'unverified',
    rate_path_bias:       extractRegimeField(regime, 'rate_path_bias') || 'unverified',
  };
}

function extractRegimeField(regime, field) {
  if (!regime) return null;
  if (regime[field]) return regime[field];
  const state = regime.state || {};
  if (state[field]) return state[field];
  return null;
}

// ── Narrative saturation detection ───────────────────────────────────────────

function detectNarrativeSaturation(memory, queue) {
  const snapshots = (memory.snapshots || []).slice(-SATURATION_WINDOW);
  const published  = (queue.topics || []).filter((t) => t.status === 'published').slice(-SATURATION_WINDOW);

  // Count dominant narratives in recent window
  const narrativeCounts = {};
  for (const s of snapshots) {
    const n = s.dominant_macro_narrative || s.topic_cluster || 'unknown';
    narrativeCounts[n] = (narrativeCounts[n] || 0) + 1;
  }

  // Count topic clusters in recent published
  const clusterCounts = {};
  for (const t of published) {
    const c = t.topic_cluster || 'unknown';
    clusterCounts[c] = (clusterCounts[c] || 0) + 1;
  }

  const saturatedNarratives = Object.entries(narrativeCounts)
    .filter(([, count]) => count >= SATURATION_WINDOW)
    .map(([n]) => n);

  const saturatedClusters = Object.entries(clusterCounts)
    .filter(([, count]) => count >= SATURATION_WINDOW)
    .map(([c]) => c);

  const rotationRecommended = saturatedNarratives.length > 0 || saturatedClusters.length > 0;

  // Identify dominant theme from last snapshot
  const latest = snapshots.slice(-1)[0] || {};

  return {
    window_size:           SATURATION_WINDOW,
    dominant_themes:       Object.keys(narrativeCounts),
    saturated_narratives:  saturatedNarratives,
    saturated_clusters:    saturatedClusters,
    rotation_recommended:  rotationRecommended,
    current_dominant:      latest.dominant_macro_narrative || latest.topic_cluster || null,
    repeat_count:          narrativeCounts[latest.dominant_macro_narrative || ''] || 0,
  };
}

// ── Generation guidance ───────────────────────────────────────────────────────

function buildGenerationGuidance(memory, queue) {
  const saturation = detectNarrativeSaturation(memory, queue);
  const latest     = (memory.snapshots || []).slice(-1)[0] || {};
  const latest_seq = latest.regime_sequence || {};

  const guidance = [];

  if (saturation.rotation_recommended) {
    guidance.push(`Narrative rotation recommended — current theme "${saturation.current_dominant}" has appeared ${saturation.repeat_count} times in the last ${saturation.window_size} articles. Introduce a new macro angle.`);
  }

  const drift = (latest.drift_notes || []);
  if (drift.length) {
    guidance.push(`Drift note: ${drift[0]}`);
  }

  if (latest_seq.pattern && latest_seq.pattern !== 'mixed-regime-transition') {
    guidance.push(`Active regime sequence: ${latest_seq.pattern} (${latest_seq.transition_maturity || 'early'}). Reference this pattern explicitly in the narrative.`);
  }

  if (!guidance.length) {
    guidance.push('No saturation detected. Continue current macro framing with incremental updates.');
  }

  return {
    guidance,
    avoid_repeating: saturation.saturated_narratives.concat(saturation.saturated_clusters),
    emphasize_sequence: latest_seq.pattern || null,
  };
}

// ── Classifiers ───────────────────────────────────────────────────────────────

function classifyTrend(pct) {
  if (pct === null || pct === undefined) return 'unverified';
  if (pct > 0.75)  return 'strong-uptrend';
  if (pct > 0.25)  return 'uptrend';
  if (pct > -0.25) return 'flat';
  if (pct > -0.75) return 'downtrend';
  return 'strong-downtrend';
}

function classifyVix(val) {
  if (val === null) return 'unverified';
  if (val < 13)    return 'complacency';
  if (val < 18)    return 'calm';
  if (val < 25)    return 'elevated';
  if (val < 35)    return 'high';
  return 'extreme';
}

function classifyYieldSpread(bps) {
  if (bps === null) return 'unverified';
  if (bps > 100)   return 'steep';
  if (bps > 25)    return 'normal';
  if (bps > -25)   return 'flat';
  return 'inverted';
}

function classifyBreadth(score) {
  if (score === null) return 'unverified';
  if (score > 65)  return 'broad';
  if (score > 45)  return 'moderate';
  if (score > 25)  return 'narrow';
  return 'very-narrow';
}

function resolveDataQuality(live) {
  if (!live || !live.metadata) return 'none';
  const q = live.metadata.data_quality;
  if (q === 'live') return 'live';
  if (q === 'cached') return 'cached';
  return 'structural';
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

module.exports = { buildCrossAsset, buildBreadthContext, buildMacroContext, detectNarrativeSaturation };
