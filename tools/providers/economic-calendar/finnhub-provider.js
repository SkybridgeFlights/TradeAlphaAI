'use strict';

const { getJson } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT = 'https://finnhub.io/api/v1/calendar/economic';
const SOURCE_URL = 'https://finnhub.io/docs/api/market-news#economic-calendar';

async function fetchCalendar(context) {
  const apiKey = String(context.env.FINNHUB_API_KEY || '').trim();
  if (!apiKey) throw providerError('missing_api_key');
  const url = `${ENDPOINT}?from=${context.from}&to=${context.to}&token=${encodeURIComponent(apiKey)}`;
  console.log(`[FINNHUB_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);
  const data = await getJson(url);
  if (!Array.isArray(data?.economicCalendar)) throw providerError('unsupported_plan_or_unexpected_response');
  const fetchedAt = new Date().toISOString();
  const provider = {
    name: 'finnhub',
    sourceName: 'Finnhub',
    sourceUrl: SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: true, precise_time: true }
  };
  const events = data.economicCalendar.map((item) => normalizeProviderEvent({
    event_name: item.event,
    country: item.country,
    importance: item.impact,
    forecast: item.estimate,
    previous: item.prev,
    actual: item.actual,
    unit: item.unit,
    event_time: item.time,
    timezone: 'UTC'
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
