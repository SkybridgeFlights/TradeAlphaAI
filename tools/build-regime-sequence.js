'use strict';

const { readMemory, buildSnapshot } = require('./macro-intelligence-core');

function buildRegimeSequence(current = buildSnapshot(), memory = readMemory()) {
  const snapshots = [...(memory.snapshots || []), current].slice(-12);
  const c = current.advanced_internals || {};
  const sequences = [];

  if (current.tlt_change_pct > 0.25 && current.qqq_change_pct > 0.25) {
    sequences.push(sequence('falling-yields-growth-leadership', 'Duration bid is coinciding with growth leadership, a falling-yields to growth-multiple transmission pattern.', snapshots));
  }
  if (c.rolling_breadth_persistence === 'improving' && c.volatility_rate_state === 'compressing') {
    sequences.push(sequence('breadth-expansion-volatility-compression', 'Breadth expansion is occurring while volatility compresses, a constructive participation sequence when it persists.', snapshots));
  }
  if (c.defensive_participation === 'improving') {
    sequences.push(sequence('defensive-rotation-earnings-caution', 'Defensive rotation is active, consistent with an earnings-caution or macro-slowdown sequence.', snapshots));
  }
  if (String(current.yield_curve_condition || '').includes('normal') && c.cyclical_participation === 'improving') {
    sequences.push(sequence('curve-steepening-cyclical-participation', 'Curve normalization is aligning with cyclical participation, a classic early-cycle confirmation pattern.', snapshots));
  }
  if (!sequences.length) {
    sequences.push({
      pattern: 'mixed-regime-transition',
      note: 'No dominant macro sequence is mature yet; signals remain transitional across rates, breadth, volatility, and leadership.',
      sequence_confidence: 42,
      persistence_duration: estimatePersistence(snapshots, current.dominant_risk_regime),
      transition_maturity: 'early'
    });
  }

  return { generated_at: new Date().toISOString(), sequences: sequences.slice(0, 4), primary_sequence: sequences[0] };
}

function sequence(pattern, note, snapshots) {
  const persistence = estimatePersistence(snapshots, pattern);
  return {
    pattern,
    note,
    sequence_confidence: Math.min(92, 55 + persistence * 8),
    persistence_duration: persistence,
    transition_maturity: persistence >= 5 ? 'mature' : persistence >= 3 ? 'developing' : 'early'
  };
}

function estimatePersistence(snapshots, marker) {
  let count = 0;
  for (let i = snapshots.length - 1; i >= 0; i -= 1) {
    const text = JSON.stringify(snapshots[i]).toLowerCase();
    if (!marker || text.includes(String(marker).toLowerCase().split('-')[0])) count += 1;
    else break;
  }
  return Math.max(1, count);
}

if (require.main === module) {
  console.log(JSON.stringify(buildRegimeSequence(), null, 2));
}

module.exports = { buildRegimeSequence };
