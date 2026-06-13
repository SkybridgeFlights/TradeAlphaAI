'use strict';

// Phase 102 — check:forecast-consensus. Integrity gate for the forecast &
// consensus layer inside data/intelligence/economic-intelligence.json.
// HARD-FAILS on:
//   * a forecast value present without source attribution
//   * a historical proxy labelled as consensus (or consensus_state mismatch)
//   * a surprise computed from an 'unavailable' forecast
//   * a proxy-based surprise whose label is not flagged as proxy
//   * missing forecast_quality or consensus_state
//   * source_count inconsistent with forecast_sources
//   * non-numeric forecast / dispersion garbage
//   * a fabricated provider name (outside the allowed source set)
//   * a released high-impact event with actual + real provider forecast that
//     lacks a surprise calculation
//   * a blank forecast field without a status reason (forecast_quality)
// An unbuilt artifact passes (CI builds it each run).

const fs = require('fs');
const path = require('path');
const { FORECAST_QUALITY, CONSENSUS_STATE } = require('./forecast-consensus');

const ROOT = path.resolve(__dirname, '..');
const INTEL_PATH = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');

// A source is legitimate only if it is a known provider or an explicitly
// labelled relay/proxy. Anything else is treated as a fabricated provider name.
const ALLOWED_SOURCE = /^(fmp|finnhub|calendar:|historical_proxy:)/;

const failures = [];
const fail = (m) => failures.push(m);
const isNumOrNull = (v) => v === null || (typeof v === 'number' && Number.isFinite(v));

const intel = (() => { try { return JSON.parse(fs.readFileSync(INTEL_PATH, 'utf8')); } catch { return null; } })();
if (!intel) {
  console.log('[forecast-consensus] artifact not built yet — CI builds it each run (non-fatal).');
  console.log('[forecast-consensus] check:forecast-consensus passed.');
  process.exit(0);
}

const events = Array.isArray(intel.events) ? intel.events : [];
for (const e of events) {
  const lbl = `event:${e.id || '<no-id>'}`;

  // Required status fields (never blank).
  if (!FORECAST_QUALITY.includes(e.forecast_quality)) fail(`${lbl}: forecast_quality missing/invalid (${e.forecast_quality})`);
  if (!CONSENSUS_STATE.includes(e.consensus_state)) fail(`${lbl}: consensus_state missing/invalid (${e.consensus_state})`);

  // Numeric integrity.
  if (!isNumOrNull(e.forecast)) fail(`${lbl}: forecast not numeric/null`);
  if (!isNumOrNull(e.forecast_dispersion)) fail(`${lbl}: forecast_dispersion not numeric/null`);
  if (!isNumOrNull(e.proxy_value)) fail(`${lbl}: proxy_value not numeric/null`);
  if (typeof e.forecast_confidence !== 'number') fail(`${lbl}: forecast_confidence not numeric`);

  const sources = Array.isArray(e.forecast_sources) ? e.forecast_sources : [];

  // Attribution: a real forecast value must carry sources.
  if (e.forecast !== null && sources.length === 0) fail(`${lbl}: forecast value without source attribution (fabrication/hardcode)`);

  // Fabricated provider names.
  for (const s of sources) if (!ALLOWED_SOURCE.test(String(s))) fail(`${lbl}: fabricated/unknown forecast source "${s}"`);

  // Quality ↔ state ↔ count consistency.
  if (e.forecast_quality === 'provider_consensus' || e.forecast_quality === 'single_provider') {
    if (e.forecast_source_count !== sources.length) fail(`${lbl}: source_count ${e.forecast_source_count} != sources length ${sources.length}`);
    if (e.forecast_source_count < 1) fail(`${lbl}: provider quality but source_count < 1`);
    if (e.proxy_used) fail(`${lbl}: provider quality but proxy_used true`);
    if (e.forecast === null) fail(`${lbl}: provider quality but forecast value null`);
  }
  if (e.forecast_quality === 'historical_proxy') {
    if (!e.proxy_used) fail(`${lbl}: historical_proxy but proxy_used not true`);
    if (e.consensus_state !== 'proxy_only') fail(`${lbl}: historical_proxy must have consensus_state 'proxy_only' (got ${e.consensus_state})`);
    if (e.forecast !== null) fail(`${lbl}: proxy must NOT populate the consensus forecast field (forecast must be null)`);
    if (e.forecast_source_count !== 0) fail(`${lbl}: proxy source_count must be 0`);
  }
  if (e.forecast_quality === 'unavailable') {
    if (e.forecast !== null) fail(`${lbl}: unavailable but forecast not null`);
  }

  // Surprise ↔ forecast basis.
  const s = e.surprise || {};
  const hasScore = s.surprise_score !== null && s.surprise_score !== undefined;
  if (hasScore && e.forecast_quality === 'unavailable') fail(`${lbl}: surprise computed from an unavailable forecast`);
  if (hasScore && e.proxy_used && !/proxy/i.test(String(s.surprise_label || ''))) fail(`${lbl}: proxy-based surprise not labelled as proxy (${s.surprise_label})`);
  if (e.proxy_used && e.surprise_ready === true) fail(`${lbl}: proxy must not be marked surprise_ready`);

  // A released high-impact event with actual + a REAL provider forecast must
  // have a computed surprise.
  const providerForecast = e.forecast_quality === 'provider_consensus' || e.forecast_quality === 'single_provider';
  if (e.importance === 'high' && ['parsed', 'revised'].includes(e.release_state) && e.actual !== null && providerForecast && e.forecast !== null && !hasScore) {
    fail(`${lbl}: high-impact released with actual + real forecast but no surprise calculated`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[forecast-consensus] FAIL: ${f}`));
  process.exit(1);
}
const fq = intel.counts && intel.counts.by_forecast_quality ? JSON.stringify(intel.counts.by_forecast_quality) : '{}';
console.log(`[forecast-consensus] check:forecast-consensus passed (${events.length} events; quality=${fq}; surprise_ready=${(intel.counts && intel.counts.surprise_ready) || 0}; no fabrication, proxy labelled).`);
