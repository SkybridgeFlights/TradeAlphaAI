'use strict';

// Phase 207 — shared historical intelligence engine. Derives REAL historical
// trends by recomputing a strength scalar at past points WITHIN each entity's own
// sourced OHLCV series (no fabrication — the bars are real). Windows: 1W≈5, 1M≈21,
// 3M≈63, 6M≈126 sessions. A window is honestly unavailable when the series is too
// short. Used by the asset/sector/equity history engines + regime transitions.

const { features } = require('./build-asset-layers');

const WINDOWS = { '1W': 5, '1M': 21, '3M': 63, '6M': 126 };
const MIN_BARS = 35;
const TREND = {
  improving: ['improving', 'يتحسّن'], accelerating: ['accelerating', 'يتسارع'], stable: ['stable', 'مستقر'],
  deteriorating: ['deteriorating', 'يتدهور'], weakening: ['weakening', 'يضعف'], indeterminate: ['indeterminate', 'غير محدد'],
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };

// features() of the series as it stood `sessionsAgo` sessions ago.
function windowFeatures(series, sessionsAgo) {
  if (!Array.isArray(series)) return null;
  const sliced = sessionsAgo > 0 ? series.slice(0, series.length - sessionsAgo) : series;
  if (sliced.length < MIN_BARS) return null;
  return features(sliced);
}

// Composite strength scalar (-2.5..+2.5) from observed structure/trend/volume.
function strengthScore(f) {
  if (!f) return null;
  const struct = { expansion: 1, range_bound: 0, breakdown: -1 }[f.structure] ?? 0;
  const trend = { up: 1, flat: 0, down: -1 }[f.trend] ?? 0;
  const vol = f.thinning ? -0.5 : 0.5;
  return Number((struct + trend + vol).toFixed(2));
}

// Classify the trend from now vs a prior window (and an optional mid window for
// accelerating/weakening detection). Allowed labels only.
function classifyTrend(nowScore, agoScore, midScore = null) {
  if (nowScore === null || agoScore === null) return 'indeterminate';
  const diff = nowScore - agoScore;
  if (diff >= 0.75) {
    if (midScore !== null && nowScore > midScore && midScore > agoScore) return 'accelerating';
    return 'improving';
  }
  if (diff <= -0.75) {
    if (midScore !== null && nowScore < midScore && midScore < agoScore) return 'weakening';
    return 'deteriorating';
  }
  return 'stable';
}

// Full per-entity historical read from a series: overall trend (1M primary) +
// per-window strength + confidence band from how many windows resolved.
function seriesHistory(series) {
  const now = strengthScore(features(series));
  const w = {};
  for (const [k, n] of Object.entries(WINDOWS)) w[k] = strengthScore(windowFeatures(series, n));
  const resolved = Object.values(w).filter((v) => v !== null).length;
  const overall = classifyTrend(now, w['1M'], w['1W']);
  const band = now === null ? 'indeterminate' : resolved >= 3 ? 'high' : resolved >= 2 ? 'moderate' : resolved >= 1 ? 'low' : 'indeterminate';
  return { now, windows: w, overall, band, resolved };
}

// Per-dimension historical trends (now vs 1M-ago window) from a series.
function dimensionTrends(series) {
  const now = features(series);
  const ago = windowFeatures(series, WINDOWS['1M']);
  if (!now || !ago) return null;
  const structVal = (f) => ({ expansion: 1, range_bound: 0, breakdown: -1 }[f.structure] ?? 0);
  const trendVal = (f) => ({ up: 1, flat: 0, down: -1 }[f.trend] ?? 0);
  const liqVal = (f) => (f.thinning ? -1 : 1);
  const partVal = (f) => (Number.isFinite(f.volRatio) ? f.volRatio - 1 : 0);
  return {
    structure: classifyTrend(structVal(now), structVal(ago)),
    tactical: classifyTrend(trendVal(now), trendVal(ago)),
    liquidity: classifyTrend(liqVal(now), liqVal(ago)),
    participation: classifyTrend(partVal(now), partVal(ago)),
    score: classifyTrend(strengthScore(now), strengthScore(ago)),
    _evidence: `now(${now.as_of}): structure=${now.structure} trend=${now.trend} volRatio=${now.volRatio} | 1M-ago(${ago.as_of}): structure=${ago.structure} trend=${ago.trend} volRatio=${ago.volRatio}`,
  };
}

module.exports = { WINDOWS, MIN_BARS, TREND, BAND, windowFeatures, strengthScore, classifyTrend, seriesHistory, dimensionTrends };
