'use strict';

const fmp     = require('../../tools/providers/economic-calendar/fmp-provider');
const finnhub = require('../../tools/providers/economic-calendar/finnhub-provider');
const fred    = require('../../tools/providers/economic-calendar/fred-provider');

const PROVIDERS      = [fmp, finnhub, fred];
const PROVIDER_NAMES = ['fmp', 'finnhub', 'fred'];

exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=900, stale-while-revalidate=3600',
    'Access-Control-Allow-Origin': '*'
  };

  const q    = event.queryStringParameters || {};
  const from = q.from || q.date || addDays(today(), -1);
  const to   = q.to   || (q.date ? q.date : addDays(today(), 14));

  const context = { from, to, env: process.env };

  for (let i = 0; i < PROVIDERS.length; i++) {
    try {
      const result = await PROVIDERS[i].fetchCalendar(context);
      const valid  = (result.events || []).filter(function(e) { return !e.error; });
      if (!valid.length) continue;
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          schema_version: '2.0',
          updated_at: new Date().toISOString(),
          source: PROVIDER_NAMES[i],
          events: valid
        })
      };
    } catch (_) { /* try next provider */ }
  }

  return {
    statusCode: 503,
    headers,
    body: JSON.stringify({
      schema_version: '2.0',
      updated_at: new Date().toISOString(),
      source: 'degraded',
      events: []
    })
  };
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  var d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
