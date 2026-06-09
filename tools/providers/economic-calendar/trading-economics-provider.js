'use strict';

// Trading Economics economic calendar provider.
// Requires one of:
//   TRADING_ECONOMICS_API_KEY          (single key)
//   TRADING_ECONOMICS_CLIENT + TRADING_ECONOMICS_SECRET  (client:secret pair)
// If neither is present, fetchCalendar throws 'missing_api_key' and the
// provider-router / Vercel API skips this provider gracefully.

const { getJson } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT   = 'https://api.tradingeconomics.com/calendar';
const SOURCE_URL = 'https://tradingeconomics.com/calendar';

// Trading Economics returns full country names; map to the ISO-2 codes used
// by FMP and Finnhub so deduplication keys align.
const COUNTRY_MAP = {
  'United States': 'US', 'Euro Area': 'EU', 'European Union': 'EU',
  'United Kingdom': 'GB', 'Japan': 'JP', 'China': 'CN',
  'Germany': 'DE', 'France': 'FR', 'Italy': 'IT',
  'Canada': 'CA', 'Australia': 'AU', 'New Zealand': 'NZ',
  'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO',
  'Denmark': 'DK', 'South Korea': 'KR', 'India': 'IN',
  'Brazil': 'BR', 'Mexico': 'MX', 'Spain': 'ES',
};

// TE Importance field: 0 = unknown, 1 = low, 2 = medium, 3 = high
const TE_IMPORTANCE = { '0': 'low', '1': 'low', '2': 'medium', '3': 'high' };

async function fetchCalendar(context) {
  const apiKey   = String(context.env.TRADING_ECONOMICS_API_KEY || '').trim();
  const teClient = String(context.env.TRADING_ECONOMICS_CLIENT  || '').trim();
  const teSecret = String(context.env.TRADING_ECONOMICS_SECRET  || '').trim();
  const auth     = apiKey || (teClient && teSecret ? `${teClient}:${teSecret}` : '');
  if (!auth) throw providerError('missing_api_key');

  // TE calendar API: date range filter via d1/d2 query params, auth via c=
  const url = `${ENDPOINT}?c=${encodeURIComponent(auth)}&d1=${context.from}&d2=${context.to}&f=json`;
  console.log(`[TE_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);
  const data = await getJson(url);

  if (!Array.isArray(data)) {
    // TE returns an object with error key on auth failure
    const msg = data && (data.message || data.error);
    throw providerError(msg ? `api_error: ${String(msg).slice(0, 80)}` : 'unexpected_response');
  }

  const fetchedAt = new Date().toISOString();
  const provider  = {
    name:         'te',
    sourceName:   'Trading Economics',
    sourceUrl:    SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: true, precise_time: true },
  };

  const events = data.map(function (item) {
    const country = COUNTRY_MAP[item.Country] ||
                    (item.Country ? String(item.Country).slice(0, 2).toUpperCase() : null);
    // Prefer released Actual, then consensus Forecast, then TE's own TEForecast
    const forecast = (item.Forecast !== undefined && item.Forecast !== null)
      ? item.Forecast
      : (item.TEForecast !== undefined && item.TEForecast !== null ? item.TEForecast : undefined);

    return normalizeProviderEvent({
      event_name: item.Event || item.Category,
      country,
      importance: TE_IMPORTANCE[String(item.Importance || '')] || 'medium',
      forecast,
      previous:   item.Previous,
      actual:     item.Actual,
      unit:       item.Unit || null,
      event_time: item.Date,
      timezone:   'UTC',
    }, provider);
  });

  return { provider: 'te', endpoint: ENDPOINT, fetchedAt, rawCount: data.length, events };
}

function providerError(reason) {
  const error   = new Error(reason);
  error.provider = 'te';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar };
