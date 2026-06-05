'use strict';

const { readMemory, readJson, ROOT } = require('./macro-intelligence-core');
const path = require('path');

function analyzeHistoricalPatterns() {
  const memory = readMemory();
  const history = readJson(path.join(ROOT, 'data', 'market-regime-history.json'), { snapshots: [] });
  const snapshots = [...(history.snapshots || history.history || []), ...(memory.snapshots || [])].slice(-90);
  const patterns = [
    pattern('volatility_compression', snapshots, (s) => text(s).includes('compressing') || Number(s.volatility_compression_expansion_rate) < -1),
    pattern('breadth_deterioration', snapshots, (s) => text(s).includes('deteriorating') || Number(s.breadth_quality) < 35),
    pattern('yield_inversion', snapshots, (s) => text(s).includes('inverted')),
    pattern('defensive_rotation', snapshots, (s) => text(s).includes('defensive')),
    pattern('ai_concentration', snapshots, (s) => text(s).includes('ai') && text(s).includes('concentrat')),
    pattern('small_cap_divergence', snapshots, (s) => text(s).includes('small_cap') && text(s).includes('missing'))
  ];
  return {
    generated_at: new Date().toISOString(),
    lookback_observations: snapshots.length,
    patterns,
    notes: patterns.map((p) => `${p.pattern}: ${p.occurrences} occurrence(s), longest persistence ${p.longest_persistence}. ${p.historical_analog_note}`)
  };
}

function pattern(name, snapshots, predicate) {
  const occurrences = snapshots.filter(predicate).length;
  let longest = 0;
  let current = 0;
  for (const snapshot of snapshots) {
    if (predicate(snapshot)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return {
    pattern: name,
    occurrences,
    recurrence_rate: snapshots.length ? Number(((occurrences / snapshots.length) * 100).toFixed(1)) : 0,
    longest_persistence: longest,
    historical_analog_note: analogNote(name, occurrences, longest),
    prediction_policy: 'Observation only; not a price or return forecast.'
  };
}

function analogNote(name, occurrences, longest) {
  if (!occurrences) return 'No recent memory analog is available in the bounded window.';
  const persistence = longest >= 3 ? 'persistent' : 'episodic';
  return `${name.replace(/_/g, ' ')} has appeared as a ${persistence} condition in the memory window. Use it as context for scenario realism, not prediction.`;
}

function text(value) {
  return JSON.stringify(value || {}).toLowerCase();
}

if (require.main === module) {
  console.log(JSON.stringify(analyzeHistoricalPatterns(), null, 2));
}

module.exports = { analyzeHistoricalPatterns };
