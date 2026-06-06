'use strict';

const { getJson } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT = 'https://financialmodelingprep.com/stable/economic-calendar';
const SOURCE_URL = 'https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar';

async function fetchCalendar(context) {
  const apiKey = String(context.env.FMP_API_KEY || '').trim();
  if (!apiKey) throw providerError('missing_api_key');
  const url = `${ENDPOINT}?from=${context.from}&to=${context.to}&apikey=${encodeURIComponent(apiKey)}`;
  console.log(`[FMP_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);
  const data = await getJson(url);
  if (!Array.isArray(data)) throw providerError('unexpected_response');
  if (data.some((item) => /legacy endpoint/i.test(String(item?.['Error Message'] || item?.message || '')))) {
    throw providerError('legacy_endpoint_response');
  }
  const fetchedAt = new Date().toISOString();
  const provider = {
    name: 'fmp',
    sourceName: 'Financial Modeling Prep',
    sourceUrl: SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: true, precise_time: true }
  };
  const events = data.map((item) => normalizeProviderEvent({
    event_name: item.event,
    country: item.country,
    importance: item.impact,
    forecast: item.estimate,
    previous: item.previous,
    actual: item.actual,
    unit: item.unit,
    event_time: item.date,
    timezone: 'America/New_York'
  }, provider));
  return { provider: 'fmp', endpoint: ENDPOINT, fetchedAt, rawCount: data.length, events };
}

function providerError(reason) {
  const error = new Error(reason);
  error.provider = 'fmp';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar };
