'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MEMORY_PATH = path.join(ROOT, 'data', 'narrative-memory.json');
const LIVE_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'market-regime-history.json');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');

const DEFAULT_MEMORY = {
  version: '1.0',
  description: 'Rolling macro narrative memory for TradeAlphaAI market-outlook continuity. Updated by tools/update-narrative-memory.js.',
  windows: { short_term_days: 7, medium_term_days: 30, structural_days: 90 },
  updated_at: null,
  latest_snapshot: null,
  snapshots: []
};

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function valueOf(source, key) {
  const entry = source && source[key];
  if (!entry) return null;
  if (Object.prototype.hasOwnProperty.call(entry, 'value')) return entry.value;
  return entry;
}

function pct(source, key) {
  const entry = source && source[key];
  return entry && typeof entry.change_pct === 'number' ? entry.change_pct : null;
}

function classify(value, positive = 'improving', negative = 'deteriorating', neutral = 'stable') {
  if (typeof value !== 'number') return 'unverified';
  if (value > 0.35) return positive;
  if (value < -0.35) return negative;
  return neutral;
}

function buildAdvancedInternals(live = {}, history = {}) {
  const sectors = live.sector_etfs || {};
  const sectorChanges = Object.values(sectors).map((item) => item && item.change_pct).filter((v) => typeof v === 'number');
  const spy = pct(live, 'sp500');
  const qqq = pct(live, 'nasdaq');
  const iwm = pct(live, 'russell2000');
  const xlk = sectors.XLK && sectors.XLK.change_pct;
  const smh = sectors.SMH && sectors.SMH.change_pct;
  const xlu = sectors.XLU && sectors.XLU.change_pct;
  const xlv = sectors.XLV && sectors.XLV.change_pct;
  const xli = sectors.XLI && sectors.XLI.change_pct;
  const xlf = sectors.XLF && sectors.XLF.change_pct;
  const vix = valueOf(live, 'vix');
  const previous = ((history.snapshots || history.history || [])).slice(-5);

  const positives = sectorChanges.filter((v) => v > 0).length;
  const sectorParticipationScore = sectorChanges.length ? Math.round((positives / sectorChanges.length) * 100) : null;
  const equalWeightProxy = [spy, qqq, iwm, ...sectorChanges].filter((v) => typeof v === 'number');
  const equalWeightMove = equalWeightProxy.length ? avg(equalWeightProxy) : null;
  const ewVsCw = equalWeightMove != null && spy != null ? round(equalWeightMove - spy) : null;
  const concentration = qqq != null && iwm != null ? round(qqq - iwm) : null;
  const aiParticipation = [xlk, smh, qqq].filter((v) => typeof v === 'number');
  const cyclicalParticipation = [xli, xlf, iwm].filter((v) => typeof v === 'number');
  const defensiveParticipation = [xlu, xlv].filter((v) => typeof v === 'number');
  const momentumDiffusion = sectorChanges.length ? classify(avg(sectorChanges), 'diffusing_positive', 'diffusing_negative', 'mixed') : 'unverified';
  const priorBreadth = previous.map((s) => s.breadth_quality || s.sector_participation_score).filter((v) => typeof v === 'number');
  const rollingBreadthPersistence = priorBreadth.length && sectorParticipationScore != null
    ? classify(sectorParticipationScore - avg(priorBreadth), 'improving', 'deteriorating', 'stable')
    : 'unverified';
  const vixHistory = previous.map((s) => Number(s.vix_level)).filter((v) => Number.isFinite(v));
  const volatilityCompressionRate = vixHistory.length && typeof vix === 'number' ? round(vix - avg(vixHistory)) : null;

  return {
    equal_weight_vs_cap_weight_divergence: ewVsCw,
    rolling_breadth_persistence: rollingBreadthPersistence,
    participation_deterioration: rollingBreadthPersistence === 'deteriorating',
    leadership_concentration: concentration,
    concentration_risk: concentration != null ? (concentration > 1.5 ? 'elevated' : concentration > 0.5 ? 'moderate' : 'contained') : 'unverified',
    momentum_diffusion: momentumDiffusion,
    sector_participation_score: sectorParticipationScore,
    volatility_compression_expansion_rate: volatilityCompressionRate,
    volatility_rate_state: volatilityCompressionRate == null ? 'unverified' : volatilityCompressionRate < -1 ? 'compressing' : volatilityCompressionRate > 1 ? 'expanding' : 'stable',
    ai_semiconductor_participation: aiParticipation.length ? classify(avg(aiParticipation), 'improving', 'deteriorating', 'mixed') : 'unverified',
    cyclical_participation: cyclicalParticipation.length ? classify(avg(cyclicalParticipation), 'improving', 'deteriorating', 'mixed') : 'unverified',
    defensive_participation: defensiveParticipation.length ? classify(avg(defensiveParticipation), 'improving', 'deteriorating', 'mixed') : 'unverified',
    small_cap_confirmation: iwm != null && spy != null ? classify(iwm - spy, 'confirmed', 'missing', 'neutral') : 'unverified'
  };
}

function buildSnapshot({ slug = null, topic = null, generatedContent = null } = {}) {
  const live = readJson(LIVE_PATH, { metadata: { status: 'fallback' } });
  const regime = readJson(REGIME_PATH, { state: {} });
  const history = readJson(HISTORY_PATH, { snapshots: [] });
  const queue = readJson(QUEUE_PATH, { topics: [] });
  const topicItem = topic || (queue.topics || []).find((item) => item.slug === slug) || {};
  const state = regime.state || live.computed_regime || {};
  const advanced = buildAdvancedInternals(live, history);
  const spread = live.yield_spread_2y10y || {};
  const sectorLeadership = state.sector_leadership || live.sector_leadership || [];
  const bias = generatedContent?.en?.directional_bias || topicItem.directional_bias || null;
  const scenarios = generatedContent?.en ? {
    bullish: generatedContent.en.bullish_scenario || null,
    bearish: generatedContent.en.bearish_scenario || null
  } : null;

  const dominantMacroNarrative = deriveDominantNarrative(state, advanced, spread);
  return {
    id: `${new Date().toISOString().slice(0, 10)}-${slug || 'system'}`,
    created_at: new Date().toISOString(),
    slug,
    topic_cluster: topicItem.topic_cluster || topicItem.discovery_cluster || null,
    dominant_macro_narrative: dominantMacroNarrative,
    dominant_risk_regime: state.risk_regime || live.computed_regime?.risk_regime || 'unverified',
    volatility_environment: state.volatility_regime || live.computed_regime?.volatility_regime || 'unverified',
    yield_curve_condition: spread.spread_regime || state.rates_trend || 'unverified',
    sector_leadership: sectorLeadership,
    ai_semiconductor_participation: advanced.ai_semiconductor_participation,
    breadth_quality: advanced.sector_participation_score,
    breadth_state: advanced.rolling_breadth_persistence,
    concentration_risk: advanced.concentration_risk,
    directional_bias: bias,
    prior_scenarios: scenarios,
    advanced_internals: advanced,
    vix_level: valueOf(live, 'vix'),
    qqq_change_pct: pct(live, 'nasdaq'),
    spy_change_pct: pct(live, 'sp500'),
    iwm_change_pct: pct(live, 'russell2000'),
    tlt_change_pct: pct(live, 'tlt'),
    dxy_level: valueOf(live, 'dxy'),
    gold_change_pct: pct(live, 'gold')
  };
}

function deriveDominantNarrative(state, advanced, spread) {
  if (advanced.ai_semiconductor_participation === 'improving' && advanced.concentration_risk === 'elevated') {
    return 'AI-led growth participation remains constructive but concentrated.';
  }
  if (advanced.defensive_participation === 'improving') return 'Defensive rotation remains the dominant macro risk expression.';
  if (advanced.rolling_breadth_persistence === 'improving') return 'Breadth participation is improving beneath the index surface.';
  if (spread.spread_regime && String(spread.spread_regime).includes('inverted')) return 'Yield-curve inversion remains the central macro constraint.';
  if (state.market_regime && state.market_regime !== 'unverified') return `The dominant macro regime is ${String(state.market_regime).replace(/_/g, ' ')}.`;
  return 'Macro signals remain mixed, with no single regime dominant.';
}

function readMemory() {
  const memory = readJson(MEMORY_PATH, DEFAULT_MEMORY);
  return { ...DEFAULT_MEMORY, ...memory, snapshots: Array.isArray(memory.snapshots) ? memory.snapshots : [] };
}

function appendSnapshot(snapshot) {
  const memory = readMemory();
  const cutoff = Date.now() - 90 * 86400000;
  const snapshots = [...memory.snapshots, snapshot].filter((item) => {
    const time = new Date(item.created_at || 0).getTime();
    return Number.isFinite(time) && time >= cutoff;
  });
  memory.snapshots = snapshots;
  memory.latest_snapshot = snapshot;
  memory.updated_at = new Date().toISOString();
  writeJson(MEMORY_PATH, memory);
  return memory;
}

function windowedSnapshots(memory = readMemory()) {
  const now = Date.now();
  const inWindow = (days) => memory.snapshots.filter((s) => now - new Date(s.created_at || 0).getTime() <= days * 86400000);
  return {
    short_term: inWindow(7),
    medium_term: inWindow(30),
    structural: inWindow(90)
  };
}

function avg(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value) {
  return Number(value.toFixed(2));
}

module.exports = {
  ROOT,
  MEMORY_PATH,
  readJson,
  writeJson,
  readMemory,
  appendSnapshot,
  windowedSnapshots,
  buildAdvancedInternals,
  buildSnapshot,
  deriveDominantNarrative,
  valueOf,
  pct
};
