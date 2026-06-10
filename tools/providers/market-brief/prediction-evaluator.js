'use strict';

// Significance thresholds (% move) for a reaction to be considered directionally meaningful.
// Below these levels, a move is too small to confirm or refute a predicted direction.
const THRESHOLDS = {
  gold:   { '1m': 0.06, '5m': 0.12, '15m': 0.22, '1h': 0.40 },
  dxy:    { '1m': 0.05, '5m': 0.10, '15m': 0.18, '1h': 0.30 },
  sp500:  { '1m': 0.05, '5m': 0.10, '15m': 0.18, '1h': 0.30 },
  nasdaq: { '1m': 0.07, '5m': 0.13, '15m': 0.23, '1h': 0.40 },
};

// asset keys used internally: 'gold' | 'usd' (=dxy) | 'spy' (=sp500) | 'nasdaq'
function thresholdFor(asset, window) {
  const key = asset === 'usd' ? 'dxy' : asset === 'spy' ? 'sp500' : asset;
  return (THRESHOLDS[key] || THRESHOLDS.sp500)[window] || 0.10;
}

// Evaluate a single asset prediction against an actual move.
// Returns: 'correct' | 'partially_correct' | 'incorrect' | 'neutral_call' | 'no_data'
function evaluateOne(predictedBias, actualPct, asset, window) {
  if (actualPct === null || actualPct === undefined) return 'no_data';

  const dir = predictedBias?.direction || 'neutral';
  const thresh = thresholdFor(asset, window);
  const significant = Math.abs(actualPct) >= thresh;
  const actualDir = significant ? (actualPct > 0 ? 'bullish' : 'bearish') : 'neutral';

  // Neutral prediction — only "correct" if market also barely moves
  if (dir === 'neutral') {
    if (actualDir === 'neutral') return 'correct';
    return 'partially_correct'; // neutral call but market moved — not wrong, just cautious
  }

  // Directional prediction
  if (actualDir === dir)      return 'correct';
  if (actualDir === 'neutral') return 'partially_correct'; // right direction but muted reaction
  return 'incorrect';
}

// Evaluate all assets across all windows.
// actualMovesByWindow: { '1m': { gold_pct, usd_pct, spy_pct, nasdaq_pct }, '5m': {...}, ... }
// predictedBiases: { gold: { direction }, usd: { direction }, spy: { direction }, nasdaq: { direction } }
// Returns: { gold: { '1m': 'correct', '5m': ... }, usd: {...}, spy: {...}, nasdaq: {...} }
function evaluateAll(predictedBiases, actualMovesByWindow) {
  const results = {};
  for (const asset of ['gold', 'usd', 'spy', 'nasdaq']) {
    results[asset] = {};
    const predicted = predictedBiases?.[asset] || null;
    for (const window of ['1m', '5m', '15m', '1h']) {
      const pctKey = `${asset}_pct`;
      const pct = actualMovesByWindow?.[window]?.[pctKey] ?? null;
      results[asset][window] = evaluateOne(predicted, pct, asset, window);
    }
  }
  return results;
}

// Compute composite accuracy score 0–1 across all assets and windows.
// correct=1.0, partially_correct=0.5, incorrect=0, no_data/neutral_call excluded from denominator.
function compositeScore(evaluationResults) {
  let weight = 0;
  let score  = 0;

  // Weight by window importance: 1h is the most reliable measure
  const WINDOW_WEIGHT = { '1m': 0.5, '5m': 0.75, '15m': 1.0, '1h': 1.5 };

  for (const [, windows] of Object.entries(evaluationResults)) {
    for (const [window, label] of Object.entries(windows)) {
      if (label === 'no_data') continue;
      const w = WINDOW_WEIGHT[window] || 1;
      weight += w;
      if (label === 'correct')           score += w * 1.0;
      else if (label === 'partially_correct') score += w * 0.5;
      else if (label === 'neutral_call') score += w * 0.6; // neutral = slightly positive
      // 'incorrect' = 0
    }
  }

  if (!weight) return null;
  return Math.round((score / weight) * 100) / 100;
}

function overallLabel(score) {
  if (score === null || score === undefined) return 'no_data';
  if (score >= 0.70) return 'correct';
  if (score >= 0.40) return 'partially_correct';
  return 'incorrect';
}

// Per-window accuracy across all assets (e.g. for summary stats)
function windowAccuracy(evaluationResults, window) {
  let correct = 0; let total = 0;
  for (const windows of Object.values(evaluationResults)) {
    const label = windows[window];
    if (!label || label === 'no_data') continue;
    total++;
    if (label === 'correct') correct++;
    else if (label === 'partially_correct') correct += 0.5;
  }
  return total ? Math.round((correct / total) * 100) / 100 : null;
}

module.exports = { evaluateOne, evaluateAll, compositeScore, overallLabel, windowAccuracy };
