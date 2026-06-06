'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'economic-calendar.json');
const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const allowedTypes = new Set([
  'CPI', 'Core CPI', 'PCE', 'Core PCE', 'NFP', 'Unemployment Rate',
  'FOMC Rate Decision', 'Fed Statement', 'Powell Speech', 'GDP',
  'Retail Sales', 'ISM PMI', 'Jobless Claims', 'Treasury Auction',
  'ECB Rate Decision', 'BoJ Rate Decision', 'BoE Rate Decision'
]);
const allowedImportance = new Set(['high', 'medium', 'low']);

if (!sourcePath) {
  console.log('No economic calendar source provided. Use --source=<json> [--write] with sourced events.');
  process.exit(0);
}

const sourceFile = path.resolve(ROOT, sourcePath);
const input = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const events = (Array.isArray(input.events) ? input.events : []).map(normalizeEvent);
const failures = events.filter((event) => event.error);
if (failures.length) {
  failures.forEach((event) => console.error(`Invalid event ${event.id || '<missing>'}: ${event.error}`));
  process.exit(1);
}

const enriched = events.map((event) => ({ ...event, ...analyzeEconomicSurprise(event) }));
const output = {
  version: '2.0',
  updated_at: new Date().toISOString(),
  source_policy: {
    requires_real_sources: true,
    manual_or_api_import_only: true,
    no_fabricated_values: true,
    allowed_event_types: [...allowedTypes],
    required_source_fields: ['source_name', 'source_url', 'fetched_at']
  },
  events: enriched.sort((a, b) => a.event_time.localeCompare(b.event_time))
};

if (!write) {
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Updated data/economic-calendar.json with ${enriched.length} sourced event(s).`);

function normalizeEvent(event) {
  const eventName = event.event_name || event.name;
  const eventTime = event.event_time || toIso(event.event_date || event.date, event.time, event.timezone);
  const type = normalizeType(event.type || eventName);
  const importance = event.importance || event.impact_level;
  const out = {
    id: event.id || slugify(`${eventTime}-${eventName}`),
    event_name: eventName,
    name: eventName,
    type,
    country: event.country || null,
    importance,
    impact_level: importance,
    forecast: numberOrNull(event.forecast),
    previous: numberOrNull(event.previous),
    actual: numberOrNull(event.actual),
    unit: event.unit || null,
    event_time: eventTime,
    date: String(eventTime || '').slice(0, 10),
    timezone: event.timezone || 'UTC',
    status: event.status || (event.actual == null ? 'scheduled' : 'released'),
    market_expectation: event.market_expectation || null,
    historical_asset_sensitivity: event.historical_asset_sensitivity || defaultSensitivity(type),
    pre_event_regime: event.pre_event_regime || null,
    post_event_regime: event.post_event_regime || null,
    source_name: event.source_name,
    source_url: event.source_url,
    fetched_at: event.fetched_at || null,
    tags: Array.isArray(event.tags) ? event.tags : []
  };
  if (!allowedTypes.has(out.type)) out.error = `unsupported type ${out.type}`;
  else if (!out.event_name) out.error = 'missing event_name';
  else if (!out.event_time || Number.isNaN(Date.parse(out.event_time))) out.error = 'event_time must be an ISO date-time';
  else if (!out.country) out.error = 'missing country';
  else if (!allowedImportance.has(out.importance)) out.error = 'importance must be high, medium, or low';
  else if (!/^https?:\/\//.test(out.source_url || '')) out.error = 'missing real source_url';
  else if (!out.source_name) out.error = 'missing source_name';
  else if (!out.fetched_at || Number.isNaN(Date.parse(out.fetched_at))) out.error = 'fetched_at must be an ISO date-time';
  return out;
}

function normalizeType(value) {
  const text = String(value || '').toLowerCase();
  const mappings = [
    [/core.*cpi/, 'Core CPI'], [/\bcpi\b/, 'CPI'], [/core.*pce/, 'Core PCE'], [/\bpce\b/, 'PCE'],
    [/nonfarm|\bnfp\b/, 'NFP'], [/unemployment/, 'Unemployment Rate'], [/fed statement/, 'Fed Statement'],
    [/powell/, 'Powell Speech'], [/fomc|fed rate/, 'FOMC Rate Decision'], [/\bgdp\b/, 'GDP'],
    [/retail sales/, 'Retail Sales'], [/ism.*pmi/, 'ISM PMI'], [/jobless claims/, 'Jobless Claims'],
    [/treasury.*auction/, 'Treasury Auction'], [/ecb/, 'ECB Rate Decision'], [/boj|bank of japan/, 'BoJ Rate Decision'],
    [/boe|bank of england/, 'BoE Rate Decision']
  ];
  return (mappings.find(([pattern]) => pattern.test(text)) || [null, value])[1];
}

function defaultSensitivity(type) {
  if (/CPI|PCE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'QQQ', 'TLT'];
  if (/NFP|Unemployment|Jobless/.test(type)) return ['Treasury yields', 'DXY', 'SPY', 'IWM', 'VIX'];
  if (/FOMC|Fed|ECB|BoJ|BoE/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'SPY', 'QQQ', 'TLT', 'VIX'];
  if (/GDP|Retail|ISM/.test(type)) return ['Treasury yields', 'SPY', 'IWM', 'Oil', 'Defensive sectors'];
  return ['Treasury yields', 'DXY', 'SPY', 'VIX'];
}

function toIso(date, time = '00:00', timezone = 'UTC') {
  if (!date) return null;
  if (String(date).includes('T')) return new Date(date).toISOString();
  if (timezone !== 'UTC') return `${date}T${time || '00:00'}:00${eventOffset(timezone)}`;
  return `${date}T${time || '00:00'}:00Z`;
}

function eventOffset(timezone) {
  return timezone === 'America/New_York' ? '-04:00' : 'Z';
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/[%,$]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
