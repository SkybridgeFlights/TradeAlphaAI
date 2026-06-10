'use strict';

const { getJsonWithRetry } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT   = 'https://finnhub.io/api/v1/calendar/economic';
const SOURCE_URL = 'https://finnhub.io/docs/api/market-news#economic-calendar';

async function fetchCalendar(context) {
  const apiKey = String(context.env.FINNHUB_API_KEY || '').trim();
  if (!apiKey) throw providerError('missing_api_key');
  const url = `${ENDPOINT}?from=${context.from}&to=${context.to}&token=${encodeURIComponent(apiKey)}`;
  console.log(`[FINNHUB_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);

  // Use retry for 5xx (Finnhub returns 502 on transient backend failures).
  const data = await getJsonWithRetry(url, { timeout: 12000, maxRetries: 2, baseDelay: 600 });

  if (!Array.isArray(data?.economicCalendar)) {
    // Distinguish between auth error (empty object) and unexpected schema
    if (data && typeof data === 'object' && Object.keys(data).length === 0) {
      throw providerError('auth_failed_or_unsupported_plan');
    }
    throw providerError('unexpected_response');
  }
  const fetchedAt = new Date().toISOString();
  const provider = {
    name:         'finnhub',
    sourceName:   'Finnhub',
    sourceUrl:    SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: true, precise_time: true }
  };
  const events = data.economicCalendar.map((item) => normalizeProviderEvent({
    event_name: item.event,
    country:    item.country,
    importance: item.impact,
    forecast:   item.estimate,
    previous:   item.prev,
    actual:     item.actual,
    unit:       item.unit,
    event_time: item.time,
    timezone:   'UTC'
  }, provider));
  return { provider: 'finnhub', endpoint: ENDPOINT, fetchedAt, rawCount: data.economicCalendar.length, events };
}

function providerError(reason) {
  const error = new Error(reason);
  error.provider = 'finnhub';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar };
