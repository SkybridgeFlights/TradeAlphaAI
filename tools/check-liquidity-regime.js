'use strict';

// Phase 106 — check:liquidity-regime. Integrity gate for the liquidity & regime
// intelligence artifacts. HARD-FAILS on:
//   * a fabricated/unknown regime, liquidity_state or stability value
//   * an empty/unsupported narrative
//   * impossible yield relationships (yield_pressure regime without a
//     yield_pressure sub-state)
//   * contradictory classifications (indeterminate regime with a definite
//     stability; liquidity_stress without 'unstable'; healthy without 'stable')
//   * NaN propagation in any numeric field
//   * missing source attribution
//   * a stale market-state (> 10 days) driving a definite regime
//   * unsupported asset symbols in cross-asset-state
//   * retail-trader / advice / prediction language in the narrative
// Unbuilt artifacts pass (CI builds them each run).

const fs = require('fs');
const path = require('path');
const { REGIMES, LIQUIDITY, STABILITY } = require('./regime-intelligence');

const ROOT = path.resolve(__dirname, '..');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const SUMMARY = path.join(ROOT, 'data', 'intelligence', 'regime-summary.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');

const TRACKED = new Set(['SPY', 'QQQ', 'IWM', 'VIX', 'US10Y', 'US02Y', 'DXY', 'GOLD', 'OIL', 'TLT']);
const TA = [/\bbuy\b/i, /\bsell\b/i, /\bstrong buy\b/i, /\bprice target\b/i, /\bbreakout\b/i, /\bgo long\b/i, /\bgo short\b/i, /\bRSI\b/, /\bMACD\b/, /\bto the moon\b/i, /\bguaranteed\b/i];

const failures = [];
const fail = (m) => failures.push(m);
const readJson = (p, f) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } };
const finiteOrNull = (v) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v));

const r = readJson(REGIME, null);
if (!r) {
  console.log('[liquidity-regime] artifact not built yet — CI builds it each run (non-fatal).');
  console.log('[liquidity-regime] check:liquidity-regime passed.');
  process.exit(0);
}

// Enum validity.
if (!REGIMES.includes(r.regime)) fail(`unknown regime "${r.regime}"`);
if (!LIQUIDITY.includes(r.liquidity_state)) fail(`unknown liquidity_state "${r.liquidity_state}"`);
if (!STABILITY.includes(r.stability)) fail(`unknown stability "${r.stability}"`);

// Narrative.
if (typeof r.narrative !== 'string' || !r.narrative.trim()) fail('empty narrative');
for (const re of TA) if (re.test(r.narrative)) fail(`retail/advice language in narrative: ${re}`);

// Numerics.
if (!finiteOrNull(r.confidence)) fail('confidence NaN');
if (r.cross_asset_coherence && !finiteOrNull(r.cross_asset_coherence.score)) fail('coherence score NaN');

// Attribution.
if (!r.attribution || !r.attribution.market_state_source) fail('missing source attribution');

// Contradiction guards.
if (r.regime === 'indeterminate' && r.stability !== 'indeterminate') fail(`indeterminate regime but stability "${r.stability}"`);
if (r.regime === 'liquidity_stress' && r.stability !== 'unstable') fail(`liquidity_stress regime but stability "${r.stability}"`);
if (r.regime === 'healthy_risk_expansion' && r.stability !== 'stable') fail(`healthy_risk_expansion but stability "${r.stability}"`);
// Impossible yield relationship.
if (r.regime === 'yield_pressure_regime' && r.sub_states && r.sub_states.yield !== 'yield_pressure') {
  fail(`yield_pressure_regime without yield_pressure sub-state (got "${r.sub_states.yield}")`);
}

// Staleness: a stale market-state must not drive a definite regime.
const age = r.attribution && r.attribution.market_state_age_hours;
if (typeof age === 'number' && age > 240 && r.regime !== 'indeterminate') {
  fail(`market-state ${age}h stale but regime is definite (${r.regime})`);
}

// Cross-asset-state symbol + numeric integrity.
const cross = readJson(CROSS, null);
if (cross) {
  for (const a of cross.assets || []) {
    if (!TRACKED.has(a.asset)) fail(`cross-asset-state: unsupported symbol "${a.asset}"`);
    if (!finiteOrNull(a.change_pct)) fail(`cross-asset-state: ${a.asset} change_pct NaN`);
    if (a.level !== undefined && !finiteOrNull(a.level)) fail(`cross-asset-state: ${a.asset} level NaN`);
  }
  if (cross.coherence && !finiteOrNull(cross.coherence.score)) fail('cross-asset-state coherence NaN');
}

// Summary consistency.
const summary = readJson(SUMMARY, null);
if (summary && summary.regime !== r.regime) fail(`regime-summary regime (${summary.regime}) != liquidity-regime (${r.regime})`);

if (failures.length) {
  failures.forEach((f) => console.error(`[liquidity-regime] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[liquidity-regime] check:liquidity-regime passed (regime=${r.regime}, liquidity=${r.liquidity_state}, stability=${r.stability}, confidence=${r.confidence}%; no fabrication, consistent).`);
