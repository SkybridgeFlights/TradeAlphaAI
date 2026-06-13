'use strict';

// Phase 102 — forecast observation fetchers.
//
// Reuses the EXISTING FMP and Finnhub economic-calendar providers (both already
// expose `forecast` from their `estimate` field, capabilities.forecasts=true)
// as consensus FORECAST sources. We do not scrape; we only read providers the
// repo already integrates behind their own API keys. Each provider is wrapped
// so a missing key / network / schema error degrades to [] — never a failure,
// never a fabricated value.
//
// AlphaVantage is intentionally NOT used here: it exposes economic indicators as
// historical series, not forward consensus estimates, so treating it as a
// forecast source would be misleading.
//
// Output: a flat list of forecast OBSERVATIONS:
//   { event_type, event_name, country, release_time, forecast_value, unit,
//     source, fetched_at, provider_confidence, status }

const fmp = require('./fmp-provider');
const finnhub = require('./finnhub-provider');

// Per-provider base confidence (0-100). Lower than official actuals by design —
// these are third-party consensus relays, not official prints.
const PROVIDER_CONFIDENCE = { fmp: 70, finnhub: 70 };

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[%,$]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toObservations(result) {
  const fetchedAt = (result && result.fetchedAt) || new Date().toISOString();
  return (result.events || [])
    .filter((e) => e && !e.error && num(e.forecast) !== null)
    .map((e) => ({
      event_type: e.type,
      event_name: e.event_name,
      country: e.country,
      release_time: e.event_time,
      forecast_value: num(e.forecast),
      unit: e.unit || null,
      source: e.provider,
      fetched_at: fetchedAt,
      provider_confidence: PROVIDER_CONFIDENCE[e.provider] || 60,
      status: 'fetched',
    }));
}

async function fetchForecastObservations({ from, to, env = process.env } = {}) {
  const context = { from, to, env };
  const observations = [];
  const providerStatus = {};

  for (const [name, mod] of [['fmp', fmp], ['finnhub', finnhub]]) {
    try {
      const result = await mod.fetchCalendar(context);
      const obs = toObservations(result);
      observations.push(...obs);
      providerStatus[name] = { ok: true, forecast_count: obs.length, raw: result.rawCount || 0 };
    } catch (err) {
      // Missing key / network / plan limits → graceful skip.
      providerStatus[name] = { ok: false, reason: String((err && err.message) || 'error') };
    }
  }

  return { observations, providerStatus };
}

module.exports = { fetchForecastObservations, PROVIDER_CONFIDENCE };
