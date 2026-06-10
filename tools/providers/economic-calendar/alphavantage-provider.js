'use strict';

// Alpha Vantage economic calendar provider.
// Requires: ALPHAVANTAGE_API_KEY
// Endpoint returns CSV with: Name, Country, Date, Actual, Previous, Estimate, Impact
// Free tier: 25 req/day. Premium tiers available for higher throughput.

const { getRaw } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT   = 'https://www.alphavantage.co/query';
const SOURCE_URL = 'https://www.alphavantage.co/documentation/#econ-calendar';

// AV uses full country names; map to ISO-2 used by other providers so dedup keys align.
const AV_COUNTRY_MAP = {
  'United States': 'US', 'Euro Zone': 'EU', 'European Union': 'EU', 'Euro Area': 'EU',
  'United Kingdom': 'GB', 'Japan': 'JP', 'China': 'CN', 'Germany': 'DE',
  'France': 'FR', 'Italy': 'IT', 'Canada': 'CA', 'Australia': 'AU',
  'New Zealand': 'NZ', 'Switzerland': 'CH', 'Sweden': 'SE', 'Norway': 'NO',
  'South Korea': 'KR', 'India': 'IN', 'Brazil': 'BR', 'Mexico': 'MX',
};

async function fetchCalendar(context) {
  const apiKey = String(context.env.ALPHAVANTAGE_API_KEY || '').trim();
  if (!apiKey) throw providerError('missing_api_key');

  const url = `${ENDPOINT}?function=ECONOMIC_CALENDAR&horizon=3month&apikey=${encodeURIComponent(apiKey)}`;
  console.log(`[AV_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);

  const body = await getRaw(url, { timeout: 15000 });

  // AV returns JSON (not CSV) when the key is invalid or rate-limited.
  if (body.trimStart().startsWith('{')) {
    let errJson;
    try { errJson = JSON.parse(body); } catch { throw providerError('unexpected_response'); }
    if (errJson.Note)             throw providerError('rate_limited');
    if (errJson.Information)      throw providerError('auth_failed');
    if (errJson['Error Message']) throw providerError('api_error');
    throw providerError('unexpected_json_response');
  }

  const allRows = parseCsv(body);
  if (!allRows.length) throw providerError('empty_csv_response');

  // Filter to requested date range (AV returns full 3-month window)
  const relevant = allRows.filter(function (row) {
    const d = String(row.Date || '').slice(0, 10);
    return d >= context.from && d <= context.to;
  });

  const fetchedAt = new Date().toISOString();
  const provider  = {
    name:         'alphavantage',
    sourceName:   'Alpha Vantage',
    sourceUrl:    SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: true, precise_time: false },
  };

  const events = relevant.map(function (row) {
    return normalizeProviderEvent({
      event_name: row.Name,
      country:    normalizeCountry(row.Country),
      importance: String(row.Impact || '').toLowerCase(),
      forecast:   parseNumeric(row.Estimate),
      previous:   parseNumeric(row.Previous),
      actual:     parseNumeric(row.Actual),
      event_time: String(row.Date || '').trim(),
      timezone:   'America/New_York',
    }, provider);
  });

  return { provider: 'alphavantage', endpoint: ENDPOINT, fetchedAt, rawCount: allRows.length, events };
}

// Minimal CSV parser: splits on newlines and commas.
// Handles unquoted fields — safe for AV's output which doesn't embed commas in values.
function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(function (h) { return h.trim().replace(/^"|"$/g, ''); });
  return lines.slice(1).filter(function (l) { return l.trim(); }).map(function (line) {
    const values = line.split(',').map(function (v) { return v.trim().replace(/^"|"$/g, ''); });
    const obj = {};
    headers.forEach(function (h, i) { obj[h] = values[i] !== undefined ? values[i] : ''; });
    return obj;
  });
}

// Strip %, commas, and whitespace; return float or null.
function parseNumeric(val) {
  if (!val || val === '' || val === 'N/A' || val === '-') return null;
  const n = parseFloat(String(val).replace('%', '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function normalizeCountry(val) {
  const name = String(val || '').trim();
  return AV_COUNTRY_MAP[name] || name.slice(0, 2).toUpperCase() || null;
}

function providerError(reason) {
  const error   = new Error(reason);
  error.provider = 'alphavantage';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar, parseCsv, parseNumeric };
