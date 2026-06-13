'use strict';

// Phase 106 — Liquidity & Regime Intelligence builder.
//
// Runs the deterministic regime-intelligence engine over the observed market
// dimensions (data/live-market-state.json), folding in the Phase 105 reaction
// context (liquidity_stress signal), and writes the canonical artifacts:
//   data/intelligence/liquidity-regime.json
//   data/intelligence/regime-summary.json
//   data/intelligence/cross-asset-state.json
//
// No fetching, no fabrication. When dimensions are unavailable the engine
// returns 'indeterminate'. This is context awareness, not prediction.
//
// Usage: node tools/build-liquidity-regime.js [--write]

const fs = require('fs');
const path = require('path');
const engine = require('./regime-intelligence');

const ROOT = path.resolve(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const REACTION_SUMMARY = path.join(ROOT, 'data', 'intelligence', 'reaction-summary.json');
const REACTIONS = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const OUT_REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const OUT_SUMMARY = path.join(ROOT, 'data', 'intelligence', 'regime-summary.json');
const OUT_CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');

function readJson(p, f) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function reactionContext() {
  const rx = readJson(REACTIONS, { reactions: [] });
  const liqStress = (rx.reactions || []).some((r) => (r.secondary_tags || []).includes('liquidity_stress') || r.classification === 'liquidity_stress');
  return { liquidity_stress: liqStress };
}

function build() {
  const state = readJson(STATE_PATH, {});
  const ctx = reactionContext();
  const result = engine.classify(state, ctx);
  const now = new Date().toISOString();

  const stateAge = state.generated_at ? Math.round((Date.now() - Date.parse(state.generated_at)) / 3600000 * 10) / 10 : null;
  const attribution = {
    market_state_source: 'data/live-market-state.json',
    market_state_generated_at: state.generated_at || null,
    market_state_age_hours: stateAge,
    reaction_context: ctx,
    providers: 'FRED (rates/vol) + Finnhub (equities/sectors) via update-live-market-state',
  };

  const liquidityRegime = {
    schema_version: '1.0', generated_at: now, source_layer: 'liquidity-regime',
    regime: result.regime, liquidity_state: result.liquidity, stability: result.stability,
    confidence: result.confidence, observed_dimensions: result.observed_dimensions,
    cross_asset_coherence: result.coherence, sub_states: result.sub_states,
    narrative: result.narrative,
    narrative_tags: [result.regime, result.liquidity_state, result.stability].filter((t) => t && t !== 'indeterminate'),
    attribution,
    note: result.regime === 'indeterminate' ? 'Insufficient observed dimensions — regime indeterminate (no fabrication).' : null,
  };

  const regimeSummary = {
    schema_version: '1.0', generated_at: now, source_layer: 'regime-summary',
    regime: result.regime, liquidity_state: result.liquidity, stability: result.stability,
    breadth: result.sub_states.breadth, volatility: result.sub_states.volatility,
    yield_structure: result.sub_states.yield, dollar: result.sub_states.dollar,
    defensive_posture: result.sub_states.defensive, coherence_score: result.coherence.score,
    confidence: result.confidence,
  };

  const dims = result.dimensions;
  const crossAssetState = {
    schema_version: '1.0', generated_at: now, source_layer: 'cross-asset-state',
    coherence: result.coherence,
    assets: [
      { asset: 'SPY', change_pct: dims.SPY }, { asset: 'QQQ', change_pct: dims.QQQ },
      { asset: 'IWM', change_pct: dims.IWM }, { asset: 'VIX', level: dims.VIX, change_pct: dims.VIX_chg },
      { asset: 'US10Y', level: dims.US10Y, change_pct: dims.US10Y_chg }, { asset: 'US02Y', level: dims.US02Y, change_pct: dims.US02Y_chg },
      { asset: 'DXY', level: dims.DXY, change_pct: dims.DXY_chg }, { asset: 'GOLD', change_pct: dims.GOLD },
      { asset: 'OIL', change_pct: dims.OIL }, { asset: 'TLT', change_pct: dims.TLT },
    ],
    yield_spread_bps: dims.yield_spread_bps,
    sector_leadership: dims.sector_leadership,
  };

  return { liquidityRegime, regimeSummary, crossAssetState };
}

function main() {
  const write = process.argv.includes('--write');
  const { liquidityRegime, regimeSummary, crossAssetState } = build();
  console.log(`[liquidity-regime] regime=${liquidityRegime.regime} liquidity=${liquidityRegime.liquidity_state} stability=${liquidityRegime.stability} coherence=${liquidityRegime.cross_asset_coherence.score} confidence=${liquidityRegime.confidence}%`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_REGIME), { recursive: true });
    fs.writeFileSync(OUT_REGIME, JSON.stringify(liquidityRegime, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUT_SUMMARY, JSON.stringify(regimeSummary, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUT_CROSS, JSON.stringify(crossAssetState, null, 2) + '\n', 'utf8');
    console.log('[liquidity-regime] wrote liquidity-regime.json + regime-summary.json + cross-asset-state.json');
  }
}

if (require.main === module) main();

module.exports = { build };
