'use strict';

// Phase 71 validation — newsroom intelligence integrity.
// Validates the market pulse, newswire, and newsroom feed artifacts when they
// exist: schema shape, allowed vocabulary (no fabricated regime values), wire
// item attribution, stale-item suppression, and dedupe integrity. Files that
// have not been built yet pass with a note (CI builds them each run).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    failures.push(`${rel}: parse error ${e.message}`);
    return null;
  }
}

// ── Market pulse ──────────────────────────────────────────────────────────────
const PULSE_VOCAB = {
  volatility_regime: ['compressed', 'normal', 'elevated', 'stressed', 'unverified'],
  dollar_pressure: ['firming', 'easing', 'stable', 'rising', 'falling', 'sideways', 'unverified'],
  duration_pressure: ['building', 'relaxing', 'neutral', 'unverified'],
  momentum_concentration: ['narrow-megacap', 'broadening', 'balanced', 'unverified'],
  breadth_state: ['deteriorating', 'confirming', 'mixed', 'unverified'],
  market_fragility: ['elevated', 'building', 'contained', 'unverified'],
};

const pulse = readJson('data/intelligence/market-pulse.json');
if (pulse) {
  if (!pulse.dimensions) failures.push('market-pulse: missing dimensions');
  if (typeof pulse.verified !== 'boolean') failures.push('market-pulse: missing verified flag');
  if (!pulse.session_framing) failures.push('market-pulse: missing session_framing');
  if (!Array.isArray(pulse.desk_commentary) || !pulse.desk_commentary.length) failures.push('market-pulse: desk_commentary empty');
  for (const [key, allowed] of Object.entries(PULSE_VOCAB)) {
    const value = pulse.dimensions && pulse.dimensions[key];
    if (value && !allowed.includes(value)) failures.push(`market-pulse: ${key}="${value}" outside allowed vocabulary`);
  }
  // Verified pulse must rest on at least one sourced number.
  if (pulse.verified === true) {
    const sourced = (pulse.dimensions && pulse.dimensions.sourced) || {};
    const hasNumber = Object.values(sourced).some((v) => Number.isFinite(v));
    if (!hasNumber) failures.push('market-pulse: verified=true but no sourced numeric input present');
  }
  console.log(`[newsroom] market-pulse ok (verified=${pulse.verified})`);
} else {
  console.log('[newsroom] market-pulse not built yet — CI builds it each run (non-fatal)');
}

// ── Newswire ──────────────────────────────────────────────────────────────────
const wire = readJson('data/newswire/wire-events.json');
if (wire) {
  if (!Array.isArray(wire.items)) failures.push('newswire: items must be an array');
  const ids = new Set();
  const now = Date.now();
  for (const item of wire.items || []) {
    if (!item.id || !item.headline || !item.kind) failures.push(`newswire: malformed item ${JSON.stringify(item).slice(0, 80)}`);
    if (ids.has(item.id)) failures.push(`newswire: duplicate item id ${item.id}`);
    ids.add(item.id);
    if (!item.attribution || !item.source) failures.push(`newswire: item ${item.id} missing source attribution`);
    if (!Number.isFinite(item.urgency) || item.urgency < 0 || item.urgency > 100) failures.push(`newswire: item ${item.id} urgency out of range`);
    const age = now - new Date(item.timestamp).getTime();
    if (Number.isFinite(age) && age > 49 * 3600000) failures.push(`newswire: stale item not suppressed: ${item.id}`);
  }
  console.log(`[newsroom] newswire ok (items=${(wire.items || []).length}, status=${wire.status})`);
} else {
  console.log('[newsroom] newswire not built yet — CI builds it each run (non-fatal)');
}

// ── Newsroom feed ─────────────────────────────────────────────────────────────
const feed = readJson('data/feeds/newsroom-pulse.json');
if (feed) {
  if (!feed.modules) failures.push('newsroom-pulse feed: missing modules');
  for (const key of ['market_pulse_strip', 'macro_regime_banner', 'risk_sentiment', 'key_catalysts_today']) {
    if (feed.modules && feed.modules[key] === undefined) failures.push(`newsroom-pulse feed: missing module ${key}`);
  }
  console.log('[newsroom] newsroom-pulse feed ok');
} else {
  console.log('[newsroom] newsroom-pulse feed not built yet (non-fatal)');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[newsroom] FAIL: ${f}`));
  process.exit(1);
}
console.log('[newsroom] check:newsroom-intelligence passed.');
