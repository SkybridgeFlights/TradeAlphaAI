'use strict';

// Phase 207 / Workstream E — regime transition engine. Deterministically detects
// whether the prevailing regime is stable / strengthening / weakening or whether
// a transition (defensive / cyclical / emerging) is forming, by comparing the
// observed window trends of the regime drivers (risk = SPY, rates = TLT,
// volatility = VIXY, dollar = UUP) against the current macro regime. Evidence-
// backed; confidence BAND only. No forecasting, no future probabilities.
//
// Output: data/intelligence/regime-transitions.json
// Usage:  node tools/build-regime-transitions.js [--write]

const fs = require('fs');
const path = require('path');
const { seriesHistory, BAND } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const ASSET_CHARTS = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const MACRO = path.join(ROOT, 'data', 'intelligence', 'macro-regime.json');
const SNAPSHOTS = path.join(ROOT, 'data', 'intelligence', 'historical-snapshots.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'regime-transitions.json');
const WRITE = process.argv.includes('--write');

const TRANSITION = {
  stable_regime: ['stable regime', 'نظام مستقر'], strengthening_regime: ['strengthening regime', 'نظام يتقوّى'],
  weakening_regime: ['weakening regime', 'نظام يضعف'], emerging_transition: ['emerging transition', 'تحوّل ناشئ'],
  defensive_transition: ['defensive transition', 'تحوّل دفاعي'], cyclical_transition: ['cyclical transition', 'تحوّل دوري'],
  indeterminate: ['indeterminate', 'غير محدد'],
};
const IMPROVING = new Set(['improving', 'accelerating']);
const DETERIORATING = new Set(['deteriorating', 'weakening']);

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function build() {
  const am = readJson(ASSET_CHARTS, {});
  const macro = readJson(MACRO, {});
  const snaps = readJson(SNAPSHOTS, {});
  const chart = (sym) => ((am && am.charts) || []).find((c) => c.symbol === sym && c.verified === true);
  const trend = (sym) => { const c = chart(sym); return c ? seriesHistory(c.series).overall : 'indeterminate'; };
  const stamp = new Date().toISOString();

  const risk = trend('SPY');
  const rates = trend('TLT'); // TLT improving = yields easing = supportive
  const vol = trend('VIXY'); // VIXY improving (rising) = volatility expanding = risk pressure
  const dollar = trend('UUP');
  const macroRegime = macro && macro.available ? macro.macro_regime : 'indeterminate';
  const available = [risk, rates, vol, dollar].some((t) => t !== 'indeterminate');

  let state = 'indeterminate';
  if (available) {
    const riskUp = IMPROVING.has(risk); const riskDown = DETERIORATING.has(risk);
    const defensiveUp = IMPROVING.has(rates); const volUp = IMPROVING.has(vol);
    if (riskDown && (defensiveUp || volUp)) state = 'defensive_transition';
    else if (riskUp && DETERIORATING.has(rates)) state = 'cyclical_transition';
    else if (riskUp && (macroRegime === 'defensive_rotation' || macroRegime === 'liquidity_stress')) state = 'emerging_transition';
    else if (riskDown && (macroRegime === 'risk_expansion' || macroRegime === 'cyclical_recovery')) state = 'emerging_transition';
    else if (riskUp && !volUp) state = 'strengthening_regime';
    else if (riskDown || volUp) state = 'weakening_regime';
    else state = 'stable_regime';
  }

  const resolved = [risk, rates, vol, dollar].filter((t) => t !== 'indeterminate').length;
  const band = !available ? 'indeterminate' : resolved >= 4 ? 'high' : resolved >= 2 ? 'moderate' : 'low';
  const ledgerNote = (snaps && snaps.count > 1) ? `cross-run ledger has ${snaps.count} snapshots` : 'cross-run ledger is building (window-derived trends used)';

  return {
    schema_version: '1.0', generated_at: stamp, source_layer: 'regime-transitions', available,
    transition_state: state, transition_state_en: TRANSITION[state][0], transition_state_ar: TRANSITION[state][1],
    confidence_band: band, confidence_band_en: BAND[band][0], confidence_band_ar: BAND[band][1],
    drivers: { risk_trend: risk, rates_trend: rates, volatility_trend: vol, dollar_trend: dollar, current_macro_regime: macroRegime },
    evidence: [
      `risk(SPY) ${risk}, rates(TLT) ${rates}, volatility(VIXY) ${vol}, dollar(UUP) ${dollar}`,
      `current macro regime: ${macroRegime}`,
      ledgerNote,
    ],
    attribution: { sources: ['data/visual/institutional-charts.json', 'data/intelligence/macro-regime.json', 'data/intelligence/historical-snapshots.json'], note: 'Deterministic regime-transition detection from observed window trends. Educational context — not a forecast or future probability.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[regime-transitions] state=${r.transition_state} band=${r.confidence_band} | drivers risk=${r.drivers.risk_trend} rates=${r.drivers.rates_trend} vol=${r.drivers.volatility_trend}`);
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[regime-transitions] wrote artifact'); }
}

module.exports = { build, TRANSITION, BAND };
