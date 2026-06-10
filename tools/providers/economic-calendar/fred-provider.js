'use strict';

const { getJson } = require('./http-client');
const { ALLOWED_TYPES, normalizeProviderEvent, normalizeType } = require('./calendar-normalizer');

const ENDPOINT = 'https://api.stlouisfed.org/fred/releases/dates';
const SOURCE_URL = 'https://fred.stlouisfed.org/docs/api/fred/releases_dates.html';

async function fetchCalendar(context) {
  const apiKey = String(context.env.FRED_API_KEY || '').trim();
  if (!apiKey) throw providerError('missing_api_key');
  // Request with ascending sort so upcoming scheduled dates appear first.
  // Increase limit to 2000 to maximise coverage across all FRED releases.
  const url = `${ENDPOINT}?api_key=${encodeURIComponent(apiKey)}&file_type=json&include_release_dates_with_no_data=true&limit=2000&order_by=release_date&sort_order=asc`;
  console.log(`[FRED_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);
  const data = await getJson(url);
  if (!Array.isArray(data?.release_dates)) throw providerError('unexpected_response');
  const fetchedAt = new Date().toISOString();
  const provider = {
    name: 'fred',
    sourceName: 'Federal Reserve Bank of St. Louis FRED',
    sourceUrl: SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: false, actuals: false, precise_time: false, release_dates_only: true }
  };
  const relevant = data.release_dates.filter((item) => {
    const type = normalizeType(item.release_name);
    return ALLOWED_TYPES.has(type) && item.date >= context.from && item.date <= context.to;
  });
  // No matching dates is informational — return 0 events rather than throwing.
  // The schedule_fallback provider will supplement if no live events are found.
  if (!relevant.length) {
    console.log(`[FRED_PROVIDER] no release dates in range ${context.from}..${context.to} (total=${data.release_dates.length})`);
    return { provider: 'fred', endpoint: ENDPOINT, fetchedAt, rawCount: data.release_dates.length, events: [] };
  }
  const events = relevant.map((item) => normalizeProviderEvent({
    id: `fred-release-${item.release_id}-${item.date}`,
    event_name: item.release_name,
    type: normalizeType(item.release_name),
    country: 'US',
    importance: importanceFor(normalizeType(item.release_name)),
    event_time: item.date,
    time_precision: 'date_only',
    status: 'scheduled',
    source_url: SOURCE_URL,
    tags: ['release-date-only', `fred-release-${item.release_id}`]
  }, provider));
  return { provider: 'fred', endpoint: ENDPOINT, fetchedAt, rawCount: data.release_dates.length, events };
}

function importanceFor(type) {
  return ['CPI', 'PCE', 'NFP', 'FOMC Rate Decision', 'GDP'].includes(type) ? 'high' : 'medium';
}

function providerError(reason) {
  const error = new Error(reason);
  error.provider = 'fred';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar };
