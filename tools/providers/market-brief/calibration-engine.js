'use strict';

const EVENT_TYPE_PATTERNS = [
  { key: 'nfp',                p: ['nonfarm payrolls', 'non-farm payrolls', 'nfp'] },
  { key: 'fomc',               p: ['fomc', 'federal reserve', 'rate decision', 'federal funds', 'fed chair', 'powell'] },
  { key: 'cpi',                p: ['cpi', 'consumer price index'] },
  { key: 'core_pce',           p: ['core pce', 'pce price', 'personal consumption expenditure'] },
  { key: 'gdp',                p: ['gdp', 'gross domestic product'] },
  { key: 'ppi',                p: ['ppi', 'producer price index'] },
  { key: 'retail_sales',       p: ['retail sales'] },
  { key: 'ism_manufacturing',  p: ['ism manufacturing', 'manufacturing pmi', 'chicago pmi'] },
  { key: 'ism_services',       p: ['ism services', 'ism non-manufacturing', 'services pmi'] },
  { key: 'jobless_claims',     p: ['jobless claims', 'initial claims', 'continuing claims'] },
  { key: 'consumer_sentiment', p: ['consumer confidence', 'michigan'] },
  { key: 'unemployment_rate',  p: ['unemployment rate'] },
  { key: 'durable_goods',      p: ['durable goods'] },
  { key: 'industrial_prod',    p: ['industrial production', 'capacity utilization'] },
  { key: 'housing',            p: ['building permits', 'housing starts', 'home sales'] },
  { key: 'average_earnings',   p: ['average hourly earnings'] },
];

function normalizeEventType(eventName) {
  const n = String(eventName).toLowerCase();
  for (const { key, p } of EVENT_TYPE_PATTERNS) {
    if (p.some((k) => n.includes(k))) return key;
  }
  return 'other';
}

// Returns confidence multiplier (0.5–1.3) based on historical accuracy rate
function confidenceMultiplier(accuracyRate, sampleCount) {
  if (sampleCount < 3) return 1.0;     // insufficient data
  if (accuracyRate >= 0.78) return 1.3;
  if (accuracyRate >= 0.65) return 1.15;
  if (accuracyRate >= 0.50) return 1.0;
  if (accuracyRate >= 0.35) return 0.8;
  return 0.6;
}

// Build per-event-type calibration stats from historical reaction entries
function buildCalibration(entries) {
  const byType = {};

  for (const entry of entries) {
    if (!entry.overall_accuracy) continue;
    const label = entry.overall_accuracy.label;
    if (!label || label === 'no_data') continue;

    const type = normalizeEventType(entry.event_name);
    if (!byType[type]) {
      byType[type] = {
        sample_count: 0,
        correct: 0,
        partial: 0,
        incorrect: 0,
        composite_scores: [],
        by_asset: {},
        by_window: { '1m': { c: 0, p: 0, i: 0 }, '5m': { c: 0, p: 0, i: 0 },
                     '15m': { c: 0, p: 0, i: 0 }, '1h': { c: 0, p: 0, i: 0 } },
      };
    }

    const d = byType[type];
    d.sample_count++;
    if (label === 'correct')            d.correct++;
    else if (label === 'partially_correct') d.partial++;
    else if (label === 'incorrect')     d.incorrect++;

    const cs = entry.overall_accuracy.composite_score;
    if (cs !== null && cs !== undefined) d.composite_scores.push(cs);

    // Per-asset breakdown
    const pa = entry.prediction_accuracy || {};
    for (const [asset, windows] of Object.entries(pa)) {
      if (!d.by_asset[asset]) d.by_asset[asset] = { correct: 0, partial: 0, incorrect: 0, total: 0 };
      for (const [win, acc] of Object.entries(windows)) {
        if (acc === 'no_data') continue;
        d.by_asset[asset].total++;
        const wb = d.by_window[win];
        if (wb) {
          if (acc === 'correct')            { d.by_asset[asset].correct++; wb.c++; }
          else if (acc === 'partially_correct') { d.by_asset[asset].partial++; wb.p++; }
          else                              { d.by_asset[asset].incorrect++; wb.i++; }
        }
      }
    }
  }

  // Compute summary stats
  const stats = {};
  for (const [type, d] of Object.entries(byType)) {
    const total = d.correct + d.partial + d.incorrect;
    if (!total) continue;
    const accuracyRate = (d.correct + d.partial * 0.5) / total;
    const last10       = d.composite_scores.slice(-10);
    const recentRate   = last10.length ? last10.reduce((a, b) => a + b, 0) / last10.length : null;

    const assetStats = {};
    for (const [asset, ab] of Object.entries(d.by_asset)) {
      if (!ab.total) continue;
      const ar = (ab.correct + ab.partial * 0.5) / ab.total;
      assetStats[asset] = {
        accuracy_rate: Math.round(ar * 100) / 100,
        correct: ab.correct, partial: ab.partial, incorrect: ab.incorrect, total: ab.total,
      };
    }

    const windowStats = {};
    for (const [win, wb] of Object.entries(d.by_window)) {
      const wt = wb.c + wb.p + wb.i;
      if (!wt) continue;
      windowStats[win] = {
        accuracy_rate: Math.round(((wb.c + wb.p * 0.5) / wt) * 100) / 100,
        total: wt,
      };
    }

    stats[type] = {
      sample_count:          d.sample_count,
      accuracy_rate:         Math.round(accuracyRate * 100) / 100,
      recent_accuracy:       recentRate !== null ? Math.round(recentRate * 100) / 100 : null,
      correct:               d.correct,
      partial:               d.partial,
      incorrect:             d.incorrect,
      confidence_multiplier: confidenceMultiplier(accuracyRate, d.sample_count),
      by_asset:              assetStats,
      by_window:             windowStats,
    };
  }

  return stats;
}

// Aggregate global stats across all event types
function globalStats(calibration) {
  let totalSamples = 0;
  let weightedScore = 0;
  for (const s of Object.values(calibration)) {
    totalSamples += s.sample_count;
    weightedScore += s.accuracy_rate * s.sample_count;
  }
  return {
    total_events_tracked: totalSamples,
    overall_accuracy_rate: totalSamples ? Math.round((weightedScore / totalSamples) * 100) / 100 : null,
  };
}

module.exports = { normalizeEventType, buildCalibration, globalStats, confidenceMultiplier };
