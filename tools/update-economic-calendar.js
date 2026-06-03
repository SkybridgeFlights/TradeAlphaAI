'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'economic-calendar.json');
const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const allowedTypes = new Set(['CPI', 'Core CPI', 'NFP', 'FOMC', 'GDP', 'Retail Sales', 'PCE', 'Jobless Claims', 'Unemployment', 'Fed Speech', 'Major Earnings Week']);
const allowedImpact = new Set(['high', 'medium', 'low']);

if (!sourcePath) {
  console.log('No economic calendar source provided. Use --source=<json> --write with real sourced events.');
  process.exit(0);
}

const sourceFile = path.resolve(ROOT, sourcePath);
const input = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const events = Array.isArray(input.events) ? input.events : [];
const normalized = events.map(normalizeEvent);
const failures = normalized.filter((event) => event.error);
if (failures.length) {
  failures.forEach((event) => console.error(`Invalid event ${event.id || '<missing>'}: ${event.error}`));
  process.exit(1);
}

const output = {
  version: '1.0',
  updated: new Date().toISOString().slice(0, 10),
  source_policy: {
    requires_real_sources: true,
    manual_or_api_import_only: true,
    allowed_event_types: [...allowedTypes]
  },
  events: normalized.sort((a, b) => a.date.localeCompare(b.date))
};

if (!write) {
  console.log(`DRY_RUN: ${normalized.length} sourced economic calendar event(s) validated. No file updated.`);
  process.exit(0);
}

fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Updated data/economic-calendar.json with ${normalized.length} sourced event(s).`);

function normalizeEvent(event) {
  const name = event.event_name || event.name;
  const date = event.event_date || event.date;
  const out = {
    id: event.id || slugify(`${date}-${name}`),
    type: event.type,
    name,
    date,
    country: event.country || null,
    impact_level: event.impact_level || null,
    timezone: event.timezone || 'UTC',
    status: event.status || 'confirmed',
    source_name: event.source_name,
    source_url: event.source_url,
    fetched_at: event.fetched_at || null,
    tags: Array.isArray(event.tags) ? event.tags : []
  };
  if (!allowedTypes.has(out.type)) out.error = `unsupported type ${out.type}`;
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(out.date || '')) out.error = 'date must be YYYY-MM-DD';
  else if (!out.name) out.error = 'missing event name (event_name or name)';
  else if (!/^https?:\/\//.test(out.source_url || '')) out.error = 'missing real source_url';
  else if (!out.source_name) out.error = 'missing source_name';
  else if (!out.country) out.error = 'missing country';
  else if (!out.impact_level || !allowedImpact.has(out.impact_level)) out.error = `impact_level must be one of: ${[...allowedImpact].join(', ')}`;
  else if (!out.fetched_at || !/^\d{4}-\d{2}-\d{2}/.test(out.fetched_at)) out.error = 'fetched_at must be YYYY-MM-DD';
  return out;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
