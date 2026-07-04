'use strict';

// ForexFactory weekly calendar (served from the faireconomy media CDN).
//
// Free and keyless, and — unlike the free FRED release-dates feed — it
// carries FORECAST and PREVIOUS values plus an impact rating for the major
// economies. This is the provider that fills the "التوقع / السابق" columns
// that rendered as "—" whenever the keyed providers were unavailable.
// No actuals (it is a forward-looking calendar); actuals arrive via the
// keyed providers or the FRED series enrichment.

const { getJson } = require('./http-client');
const { normalizeProviderEvent } = require('./calendar-normalizer');

const ENDPOINT = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const ENDPOINT_NEXT = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';
const SOURCE_URL = 'https://www.forexfactory.com/calendar';

// The feed keys events by CURRENCY, not country.
const CURRENCY_TO_COUNTRY = {
  USD: 'US', EUR: 'EU', GBP: 'GB', JPY: 'JP', AUD: 'AU',
  CAD: 'CA', CHF: 'CH', CNY: 'CN', NZD: 'NZ',
};

const IMPACT_MAP = { High: 'high', Medium: 'medium', Low: 'low' };

async function fetchCalendar(context) {
  console.log(`[FOREXFACTORY_PROVIDER] endpoint=${ENDPOINT} range=${context.from}..${context.to}`);
  const batches = [];
  for (const url of [ENDPOINT, ENDPOINT_NEXT]) {
    try {
      const data = await getJson(url);
      if (Array.isArray(data)) batches.push(...data);
    } catch (error) {
      // this-week failing is fatal below (no rows); next-week alone failing
      // just narrows coverage.
      console.warn(`[FOREXFACTORY_PROVIDER] batch unavailable: ${url.split('/').pop()}`);
    }
  }
  if (!batches.length) throw providerError('no_feed_rows');

  const fetchedAt = new Date().toISOString();
  const provider = {
    name: 'forexfactory',
    sourceName: 'ForexFactory Calendar',
    sourceUrl: SOURCE_URL,
    fetchedAt,
    capabilities: { forecasts: true, actuals: false, precise_time: true }
  };

  const seen = new Set();
  const events = [];
  for (const item of batches) {
    if (!item || !item.title || !item.date) continue;
    if (item.impact === 'Holiday') continue;
    const day = String(item.date).slice(0, 10);
    if (day < context.from || day > context.to) continue;
    const country = CURRENCY_TO_COUNTRY[item.country] || item.country || 'US';
    const key = `${item.title}|${country}|${item.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(normalizeProviderEvent({
      event_name: item.title,
      country,
      importance: IMPACT_MAP[item.impact] || 'medium',
      forecast: emptyToNull(item.forecast),
      previous: emptyToNull(item.previous),
      actual: null,
      event_time: item.date,           // ISO string with explicit offset
      timezone: 'America/New_York'
    }, provider));
  }
  if (!events.length) throw providerError('no_events_in_range');
  return { provider: 'forexfactory', endpoint: ENDPOINT, fetchedAt, rawCount: batches.length, events };
}

function emptyToNull(value) {
  const s = String(value ?? '').trim();
  return s ? s : null;
}

function providerError(reason) {
  const error = new Error(reason);
  error.provider = 'forexfactory';
  error.endpoint = ENDPOINT;
  return error;
}

module.exports = { ENDPOINT, fetchCalendar };
