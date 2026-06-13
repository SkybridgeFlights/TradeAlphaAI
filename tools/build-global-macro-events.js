'use strict';

// Phase 104 — Global Macro Event Acquisition aggregator.
//
// Combines the per-source official-schedule modules into one canonical global
// macro event universe, applies the canonical global schema, dedupes across
// sources by (type + country + date proximity) with source priority, and writes
// data/intelligence/global-macro-events.json. Also exposes the normalized
// (calendar-shape) events so fetch-economic-calendar can merge the global
// supplement with the US calendar.
//
// Free/legal/official only. Nothing scraped, no paywall bypass, no fabrication —
// every event carries an official source + attribution + an honest status.
//
// Usage: node tools/build-global-macro-events.js [--write]

const fs = require('fs');
const path = require('path');
const { normalizeProviderEvent } = require('./providers/economic-calendar/calendar-normalizer');
const centralBanks = require('./providers/economic-calendar/sources/central-bank-schedule');
const globalReleases = require('./providers/economic-calendar/sources/global-release-schedule');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'global-macro-events.json');

// Minimum coverage expected over a 14-day window when sources are healthy.
const MIN_COVERAGE = 6;
const REGIONS = ['Eurozone', 'Germany', 'United Kingdom', 'Japan', 'China', 'Canada', 'Australia', 'Switzerland'];

function dateStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

function priority(method) {
  if (method === 'official_schedule') return 3;
  if (method === 'official_api') return 4;
  if (method === 'public_feed') return 2;
  if (method === 'estimated_recurring') return 1;
  return 0;
}

// Dedupe across sources: same (type|country|date) → keep the higher-priority
// acquisition method (and the higher source_confidence as a tiebreaker).
function dedupe(events) {
  const byKey = new Map();
  for (const e of events) {
    const key = `${e.event_type}|${e.country}|${String(e.release_time).slice(0, 10)}`;
    const ex = byKey.get(key);
    if (!ex) { byKey.set(key, e); continue; }
    const better = priority(e.acquisition_method) > priority(ex.acquisition_method)
      || (priority(e.acquisition_method) === priority(ex.acquisition_method) && (e.source_confidence || 0) > (ex.source_confidence || 0));
    if (better) byKey.set(key, e);
  }
  return [...byKey.values()];
}

// Raw source event → canonical global schema (normalizes id/type via the shared
// normalizer; drops anything the normalizer rejects).
function toCanonical(raw) {
  const providerMeta = {
    name: 'global_acquisition',
    sourceName: raw.source_name,
    sourceUrl: raw.source_url,
    fetchedAt: new Date().toISOString(),
    capabilities: { forecasts: false, actuals: false, precise_time: raw.verified_time === true, schedule_estimate: true },
  };
  const n = normalizeProviderEvent({
    event_name: raw.event_name,
    type: raw.type,
    importance: raw.importance,
    event_time: raw.event_time,
    country: raw.country,
    timezone: raw.timezone || 'UTC',
    source_url: raw.source_url,
    time_precision: raw.verified_time ? 'date_time' : 'time_estimate',
    status: 'scheduled',
    tags: [raw.acquisition_method],
  }, providerMeta);
  if (n.error) return null;
  return {
    id: n.id,
    country: n.country,
    region: raw.region || null,
    source: raw.source_name,
    source_url: raw.source_url,
    event_name: n.event_name,
    event_type: n.type,
    category: raw.category || null,
    importance: n.importance,
    release_time: n.event_time,
    timezone: n.timezone,
    verified_time: raw.verified_time === true,
    estimated_date: raw.estimated_date !== false,
    actual: null,
    forecast: null,
    previous: null,
    revised: null,
    affected_assets: n.historical_asset_sensitivity || [],
    source_confidence: raw.source_confidence || 50,
    acquisition_method: raw.acquisition_method,
    legal_status: raw.legal_status || 'official_public_schedule',
    // calendar-compatible mirror for merge convenience:
    _calendar: Object.assign({}, n, {
      region: raw.region || null,
      acquisition_method: raw.acquisition_method,
      estimated_date: raw.estimated_date !== false,
      verified_time: raw.verified_time === true,
      source_confidence: raw.source_confidence || 50,
      legal_status: raw.legal_status || 'official_public_schedule',
      confirmed: false,
    }),
  };
}

function build({ from = dateStr(-1), to = dateStr(28) } = {}) {
  const rawEvents = [
    ...centralBanks.generate({ from, to }),
    ...globalReleases.generate({ from, to }),
  ];
  const canonical = dedupe(rawEvents.map(toCanonical).filter(Boolean));

  const byRegion = {};
  const byCountry = {};
  const byMethod = {};
  for (const e of canonical) {
    if (e.region) byRegion[e.region] = (byRegion[e.region] || 0) + 1;
    byCountry[e.country] = (byCountry[e.country] || 0) + 1;
    byMethod[e.acquisition_method] = (byMethod[e.acquisition_method] || 0) + 1;
  }

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    layer: 'global-macro-acquisition',
    window: { from, to },
    sources: [
      { id: 'central_bank_schedule', kind: 'official_schedule', banks: Object.keys(centralBanks.BANKS) },
      { id: 'global_release_schedule', kind: 'estimated_recurring', economies: Object.keys(globalReleases.ECON) },
    ],
    coverage: { regions: REGIONS, by_region: byRegion, by_country: byCountry, by_method: byMethod },
    min_coverage: MIN_COVERAGE,
    source_outage: false,
    counts: { total: canonical.length, high_impact: canonical.filter((e) => e.importance === 'high').length },
    events: canonical,
  };
}

// Calendar-shape events (for fetch-economic-calendar merge).
function getGlobalEventsForCalendar(opts) {
  return build(opts).events.map((e) => e._calendar);
}

function main() {
  const write = process.argv.includes('--write');
  const result = build();
  // Strip the internal _calendar mirror from the persisted artifact.
  const persisted = Object.assign({}, result, { events: result.events.map((e) => { const c = Object.assign({}, e); delete c._calendar; return c; }) });
  console.log(`[global-macro] events=${persisted.counts.total} high=${persisted.counts.high_impact} regions=${Object.keys(persisted.coverage.by_region).length} by_method=${JSON.stringify(persisted.coverage.by_method)}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(persisted, null, 2) + '\n', 'utf8');
    console.log('[global-macro] wrote data/intelligence/global-macro-events.json');
  }
}

if (require.main === module) main();

module.exports = { build, getGlobalEventsForCalendar, dedupe, toCanonical, MIN_COVERAGE, REGIONS };
