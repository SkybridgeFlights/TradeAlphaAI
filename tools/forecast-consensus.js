'use strict';

// Phase 102 — Forecast & Consensus Intelligence engine.
//
// Merges forecast observations (FMP/Finnhub + any calendar-embedded estimate)
// into a per-event consensus, with honest quality/confidence labelling. When no
// provider forecast exists it falls back to a CLEARLY LABELLED historical proxy
// (never presented as consensus). Then upgrades the surprise output to consume
// the consensus — provider forecasts normally, proxy only at low confidence and
// with surprise_ready=false (a proxy is never treated as real readiness).
//
// No fabrication: every consensus value traces to a named source; the proxy is
// the prior official print, explicitly flagged proxy_used=true.

const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');

const FORECAST_QUALITY = ['provider_consensus', 'single_provider', 'historical_proxy', 'unavailable'];
const CONSENSUS_STATE = ['strong_consensus', 'weak_consensus', 'dispersed_estimates', 'single_source', 'proxy_only', 'unavailable'];

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[%,$]/g, ''));
  return Number.isFinite(n) ? n : null;
}
function median(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function stdev(xs) {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}
function sameDay(a, b, toleranceDays = 1) {
  const ta = Date.parse(a), tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return Math.abs(ta - tb) <= toleranceDays * 86400000;
}

// Gather candidate forecasts for an event: matched provider observations plus
// any estimate already embedded on the calendar event (tagged calendar:<prov>).
function gatherCandidates(event, observations) {
  const candidates = [];
  for (const o of observations || []) {
    if (o.event_type === event.type && o.country === event.country && sameDay(o.release_time, event.event_time) && num(o.forecast_value) !== null) {
      candidates.push({ value: num(o.forecast_value), source: o.source, confidence: o.provider_confidence });
    }
  }
  const embedded = num(event.forecast);
  if (embedded !== null) {
    const src = `calendar:${event.provider || 'provider'}`;
    if (!candidates.some((c) => c.source === src)) candidates.push({ value: embedded, source: src, confidence: 65 });
  }
  return candidates;
}

// Build the forecast intelligence block for one event.
function computeConsensus(event, observations) {
  const candidates = gatherCandidates(event, observations);

  if (candidates.length) {
    // Dedupe by source (keep first); values rounded to a sane precision to
    // collapse trivial differences when counting agreement.
    const bySource = new Map();
    for (const c of candidates) if (!bySource.has(c.source)) bySource.set(c.source, c);
    const merged = [...bySource.values()];
    const values = merged.map((c) => c.value);
    const sources = merged.map((c) => c.source);
    const count = merged.length;
    const consensus = Number(median(values).toFixed(4));
    const dispersion = count >= 2 ? Number(stdev(values).toFixed(4)) : 0;
    const spread = count >= 2 ? Math.abs(Math.max(...values) - Math.min(...values)) : 0;
    const relSpread = consensus !== 0 ? spread / Math.abs(consensus) : spread;

    const quality = count >= 2 ? 'provider_consensus' : 'single_provider';
    let state;
    if (count === 1) state = 'single_source';
    else if (relSpread <= 0.05) state = 'strong_consensus';
    else if (relSpread <= 0.15) state = 'weak_consensus';
    else state = 'dispersed_estimates';

    // Confidence: more independent sources + tighter spread → higher.
    let confidence = count >= 3 ? 80 : count === 2 ? 65 : 45;
    if (count >= 2 && relSpread > 0.15) confidence -= 15;
    confidence = Math.max(20, Math.min(90, confidence));

    return {
      forecast: consensus,
      forecast_basis: quality,
      forecast_sources: sources,
      forecast_source_count: count,
      forecast_confidence: confidence,
      forecast_quality: quality,
      consensus_state: state,
      forecast_dispersion: dispersion,
      proxy_used: false,
      proxy_value: null,
    };
  }

  // No provider forecast → labelled historical proxy (prior official print).
  const proxy = num(event.previous);
  if (proxy !== null) {
    return {
      forecast: null, // a real forecast is genuinely unavailable
      forecast_basis: 'historical_proxy',
      forecast_sources: ['historical_proxy:previous_release'],
      forecast_source_count: 0,
      forecast_confidence: 25,
      forecast_quality: 'historical_proxy',
      consensus_state: 'proxy_only',
      forecast_dispersion: null,
      proxy_used: true,
      proxy_value: proxy,
    };
  }

  return {
    forecast: null,
    forecast_basis: 'unavailable',
    forecast_sources: [],
    forecast_source_count: 0,
    forecast_confidence: 0,
    forecast_quality: 'unavailable',
    consensus_state: 'unavailable',
    forecast_dispersion: null,
    proxy_used: false,
    proxy_value: null,
  };
}

// Map (category, direction) → the canonical surprise label.
function surpriseLabel(category, direction) {
  if (!direction || direction === 'pending') return 'pending';
  if (direction === 'near_consensus') return 'in_line';
  const hotter = direction === 'hotter_or_stronger';
  if (category === 'inflation') return hotter ? 'hotter_inflation' : 'cooler_inflation';
  if (category === 'labor') return hotter ? 'labor_resilience' : 'labor_weakening';
  if (category === 'growth') return hotter ? 'growth_resilience' : 'growth_slowdown';
  if (category === 'policy' || category === 'rates') return hotter ? 'hawkish_pressure' : 'dovish_repricing';
  return hotter ? 'positive_surprise' : 'negative_surprise';
}

// Upgrade the surprise output using the consensus. Provider forecasts drive a
// "ready" surprise; a proxy produces a low-confidence, clearly-labelled surprise
// that is NOT treated as real readiness (surprise_ready=false).
function upgradeSurprise(event, category, forecastIntel, actual) {
  const provider = forecastIntel.forecast_quality === 'provider_consensus' || forecastIntel.forecast_quality === 'single_provider';
  const effectiveForecast = provider ? forecastIntel.forecast : (forecastIntel.proxy_used ? forecastIntel.proxy_value : null);

  if (actual === null || effectiveForecast === null) {
    return {
      surprise_score: null,
      surprise_direction: 'pending',
      surprise_label: 'pending',
      policy_tone: 'unresolved',
      macro_interpretation: forecastIntel.forecast_quality === 'unavailable'
        ? 'No sourced forecast available — surprise cannot be computed without fabricating an expectation.'
        : 'Awaiting the released actual to compare against the sourced forecast.',
      forecast_basis: forecastIntel.forecast_basis,
      surprise_confidence: 0,
      surprise_ready: false,
    };
  }

  const base = analyzeEconomicSurprise({ ...event, actual, forecast: effectiveForecast });
  const label = surpriseLabel(category, base.surprise_direction);
  // Proxy-based surprise: cap confidence low and mark not-ready.
  const surpriseConfidence = provider
    ? Math.min(forecastIntel.forecast_confidence, Math.abs(base.surprise_score) >= 8 ? 90 : 60)
    : Math.min(forecastIntel.forecast_confidence, 35);

  return {
    surprise_score: base.surprise_score,
    surprise_direction: base.surprise_direction,
    surprise_label: forecastIntel.proxy_used ? `${label}__proxy_based` : label,
    policy_tone: base.policy_tone,
    macro_interpretation: forecastIntel.proxy_used
      ? `Proxy-based read (prior print used as baseline, NOT consensus): ${base.reaction_interpretation}`
      : base.reaction_interpretation,
    forecast_basis: forecastIntel.forecast_basis,
    surprise_confidence: surpriseConfidence,
    surprise_ready: provider, // real readiness requires a provider forecast
  };
}

module.exports = {
  FORECAST_QUALITY,
  CONSENSUS_STATE,
  gatherCandidates,
  computeConsensus,
  surpriseLabel,
  upgradeSurprise,
};
