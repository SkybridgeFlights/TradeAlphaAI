'use strict';

const ALLOWED_TYPES = new Set([
  'CPI', 'Core CPI', 'PCE', 'Core PCE', 'NFP', 'Unemployment Rate',
  'FOMC Rate Decision', 'Fed Statement', 'Powell Speech', 'GDP',
  'Retail Sales', 'ISM PMI', 'Jobless Claims', 'Treasury Auction',
  'ECB Rate Decision', 'BoJ Rate Decision', 'BoE Rate Decision'
]);
const ALLOWED_IMPORTANCE = new Set(['high', 'medium', 'low']);

function normalizeProviderEvent(event, provider) {
  const eventName = clean(event.event_name || event.event || event.name);
  const eventTime = normalizeDateTime(event.event_time || event.time || event.date, event.timezone);
  const type = normalizeType(event.type || eventName);
  const importance = normalizeImportance(event.importance || event.impact || event.impact_level);
  const country = normalizeCountry(event.country);
  const status = normalizeStatus(event.status);
  const out = {
    id: buildEventId(eventName, country, eventTime, provider.name),
    event_name: eventName,
    name: eventName,
    type,
    country,
    importance,
    impact_level: importance,
    forecast: numberOrNull(event.forecast ?? event.estimate),
    previous: numberOrNull(event.previous ?? event.prev),
    actual: numberOrNull(event.actual),
    unit: event.unit || null,
    event_time: eventTime,
    date: String(eventTime || '').slice(0, 10),
    timezone: event.timezone || 'UTC',
    time_precision: event.time_precision || 'date_time',
    status,
    market_expectation: event.market_expectation || null,
    historical_asset_sensitivity: event.historical_asset_sensitivity || defaultSensitivity(type),
    pre_event_regime: event.pre_event_regime || null,
    post_event_regime: event.post_event_regime || null,
    source_name: provider.sourceName,
    source_url: event.source_url || provider.sourceUrl,
    fetched_at: provider.fetchedAt,
    provider: provider.name,
    data_capabilities: provider.capabilities || {},
    tags: Array.isArray(event.tags) ? event.tags : []
  };
  const error = validateEvent(out);
  return error ? { ...out, error } : out;
}

function normalizeManualEvent(event) {
  return normalizeProviderEvent(event, {
    name: 'manual',
    sourceName: event.source_name,
    sourceUrl: event.source_url,
    fetchedAt: event.fetched_at || new Date().toISOString(),
    capabilities: { forecasts: true, actuals: true, precise_time: true }
  });
}

function validateEvent(event) {
  if (!ALLOWED_TYPES.has(event.type)) return `unsupported type: ${event.event_name || event.type}`;
  if (!event.event_name) return 'missing event_name';
  if (!event.event_time || Number.isNaN(Date.parse(event.event_time))) return 'invalid event_time';
  if (!event.country) return 'missing country';
  if (!ALLOWED_IMPORTANCE.has(event.importance)) return `unknown importance: ${event.importance}`;
  if (!/^https?:\/\//.test(event.source_url || '')) return 'missing real source_url';
  if (!event.source_name) return 'missing source_name';
  if (!event.fetched_at || Number.isNaN(Date.parse(event.fetched_at))) return 'invalid fetched_at';
  return '';
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase().trim();
  if (!text || ['scheduled', 'expected', 'live', 'actual', 'released'].includes(text)) return 'confirmed';
  if (text === 'preliminary') return 'tentative';
  if (text === 'cancelled') return 'cancelled';
  return 'confirmed';
}

function buildEventId(eventName, country, eventTime, providerName) {
  const ts = String(eventTime || '').slice(0, 19).replace(/[^0-9T]/g, '');
  const slug = slugify(eventName).slice(0, 60);
  const cty = String(country || 'XX').toLowerCase();
  return `economic-calendar::${providerName}::${cty}::${slug}::${ts}`;
}

function normalizeType(value) {
  const text = String(value || '').toLowerCase();
  const mappings = [
    [/core.*cpi/, 'Core CPI'], [/\bconsumer price index\b|\bcpi\b/, 'CPI'],
    [/core.*pce/, 'Core PCE'], [/personal income and outlays|\bpce\b/, 'PCE'],
    [/employment situation|nonfarm|\bnfp\b/, 'NFP'], [/unemployment/, 'Unemployment Rate'],
    [/fed statement/, 'Fed Statement'], [/powell/, 'Powell Speech'],
    [/fomc|fed rate|federal funds rate/, 'FOMC Rate Decision'], [/\bgdp\b|gross domestic product/, 'GDP'],
    [/retail sales|advance monthly sales/, 'Retail Sales'],
    [/ism.*pmi|manufacturing pmi.*us|services pmi.*us|institute for supply management/, 'ISM PMI'],
    [/jobless claims|initial claims|unemployment insurance weekly claims/, 'Jobless Claims'],
    [/treasury.*auction/, 'Treasury Auction'], [/ecb/, 'ECB Rate Decision'],
    [/boj|bank of japan/, 'BoJ Rate Decision'], [/boe|bank of england/, 'BoE Rate Decision']
  ];
  return (mappings.find(([pattern]) => pattern.test(text)) || [null, clean(value)])[1];
}

function normalizeImportance(value) {
  const text = String(value || '').toLowerCase();
  if (['high', '3'].includes(text)) return 'high';
  if (['low', '1'].includes(text)) return 'low';
  return 'medium';
}

function normalizeCountry(value) {
  const text = clean(value).toUpperCase();
  const aliases = { US: 'US', USA: 'US', UNITED_STATES: 'US', UK: 'GB', GBR: 'GB' };
  return aliases[text.replace(/\s+/g, '_')] || text || null;
}

function normalizeDateTime(value, timezone = '') {
  if (!value) return null;
  const text = String(value).trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00Z`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(text)) {
    const seconds = text.length === 16 ? `${text}:00` : text;
    return `${seconds}${timezone === 'America/New_York' ? '-04:00' : 'Z'}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function defaultSensitivity(type) {
  if (/CPI|PCE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'QQQ', 'TLT'];
  if (/NFP|Unemployment|Jobless/.test(type)) return ['Treasury yields', 'DXY', 'SPY', 'IWM', 'VIX'];
  if (/FOMC|Fed|ECB|BoJ|BoE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'SPY', 'QQQ', 'TLT', 'VIX'];
  if (/GDP|Retail|ISM/.test(type)) return ['Treasury yields', 'SPY', 'IWM', 'Oil', 'Defensive sectors'];
  return ['Treasury yields', 'DXY', 'SPY', 'VIX'];
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[%,$]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function clean(value) {
  return String(value || '').trim();
}

module.exports = {
  ALLOWED_IMPORTANCE,
  ALLOWED_TYPES,
  buildEventId,
  normalizeManualEvent,
  normalizeProviderEvent,
  normalizeStatus,
  normalizeType,
  validateEvent
};
