'use strict';

const path = require('path');
const { ROOT, readJson, appendSnapshot, buildSnapshot } = require('./macro-intelligence-core');
const { detectNarrativeDrift } = require('./detect-narrative-drift');
const { extractMarketSignals } = require('./extract-market-signals');

const eventType = (argValue('--event') || 'macro_event').toLowerCase();
const preFile = argValue('--pre');
const postFile = argValue('--post');
const write = process.argv.includes('--write');

function analyzeEventImpact(options = {}) {
  const pre = options.pre || (preFile ? readJson(path.resolve(ROOT, preFile), {}) : null);
  const post = options.post || (postFile ? readJson(path.resolve(ROOT, postFile), {}) : buildSnapshot());
  const current = post.slug || post.dominant_macro_narrative ? post : buildSnapshot();
  const memoryBefore = pre ? { snapshots: [pre] } : undefined;
  const drift = detectNarrativeDrift(current, memoryBefore);
  const signals = extractMarketSignals(current);
  const impact = {
    generated_at: new Date().toISOString(),
    event_type: eventType,
    pre_event_regime: pre ? summarize(pre) : null,
    post_event_regime: summarize(current),
    narrative_shift: drift.notes,
    signal_response: signals.signals.slice(0, 4),
    commentary: buildCommentary(eventType, drift.notes, signals.primary_signal),
    memory_updated: false
  };

  if (write) {
    const snapshot = { ...current, event_reaction: impact };
    appendSnapshot(snapshot);
    impact.memory_updated = true;
  }
  return impact;
}

function summarize(snapshot) {
  return {
    dominant_macro_narrative: snapshot.dominant_macro_narrative || null,
    risk_regime: snapshot.dominant_risk_regime || snapshot.risk_regime || null,
    volatility_environment: snapshot.volatility_environment || snapshot.volatility_regime || null,
    breadth_quality: snapshot.breadth_quality || null,
    concentration_risk: snapshot.concentration_risk || null
  };
}

function buildCommentary(type, notes, primarySignal) {
  const eventLabel = type.toUpperCase().replace(/_/g, ' ');
  const shift = notes[0] || 'The post-event regime has not produced a material narrative shift yet.';
  const signal = primarySignal ? `Primary signal: ${primarySignal.signal} (${primarySignal.confidence} confidence).` : 'No high-conviction signal is active.';
  return `${eventLabel} reaction is treated as conditional regime evidence, not a forecast. ${shift} ${signal}`;
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}

if (require.main === module) {
  console.log(JSON.stringify(analyzeEventImpact(), null, 2));
}

module.exports = { analyzeEventImpact };
