'use strict';

// Phase 101 — Institutional Economic Intelligence Core (canonical macro layer).
//
// Consumes the normalized economic calendar (data/economic-calendar.json) and
// produces the canonical, enriched macro intelligence artifact that powers the
// Market News / Market Outlook / Briefs brains, Intraday Watch, catalyst windows
// and Federal monitoring: data/intelligence/economic-intelligence.json.
//
// It NEVER fabricates a value. Actual/previous/revised are filled only from
// official sources (FRED/BLS/BEA/EIA/Treasury) and only when --fetch is passed
// AND the relevant key/network is available. Otherwise values stay null and the
// lifecycle/confidence reflect the degraded, honest state. Surprise is computed
// deterministically and only when BOTH actual and forecast exist.
//
// Usage:
//   node tools/build-economic-intelligence.js            # offline enrichment (deterministic)
//   node tools/build-economic-intelligence.js --fetch    # also pull official actuals
//   node tools/build-economic-intelligence.js --write [--fetch]

const fs = require('fs');
const path = require('path');
const { seriesFor, affectedAssets } = require('./providers/economic-calendar/series-map');
const { fetchOfficial } = require('./providers/economic-calendar/official-series');
const { fetchForecastObservations } = require('./providers/economic-calendar/forecast-providers');
const { computeConsensus, upgradeSurprise } = require('./forecast-consensus');

const ROOT = path.resolve(__dirname, '..');
const CAL_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'economic-intelligence.json');

const IMMINENCE_HOURS = 6;     // verified-time event within this window → awaiting_release
const ARCHIVE_DAYS = 14;       // releases older than this → archived
const GRACE = { high: 3, medium: 12, low: 24 }; // hours past release before "delayed"

const RELEASE_STATES = ['scheduled', 'awaiting_release', 'released', 'parsed', 'revised', 'delayed', 'archived'];

function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } }
function num(v) { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(/[%,$]/g, '')); return Number.isFinite(n) ? n : null; }

// Deterministic lifecycle state from time + value presence.
function releaseState(event, { actual, revised }) {
  const t = Date.parse(event.event_time);
  if (Number.isNaN(t)) return 'scheduled';
  const now = Date.now();
  const hoursTo = (t - now) / 3600000;
  const hoursSince = -hoursTo;
  const ageDays = hoursSince / 24;

  if (ageDays > ARCHIVE_DAYS) return 'archived';
  const verifiedTime = event.time_precision === 'date_time';

  if (hoursTo > 0) {
    // Future
    if (verifiedTime && hoursTo <= IMMINENCE_HOURS) return 'awaiting_release';
    return 'scheduled';
  }
  // Past release_time
  if (revised !== null && revised !== undefined) return 'revised';
  if (actual !== null && actual !== undefined) return 'parsed';
  const grace = GRACE[event.importance] ?? 12;
  if (hoursSince <= grace) return 'released';
  return 'delayed'; // released window passed, no verified actual captured from our sources
}

function estimatedVsVerified(event) {
  return event.time_precision === 'date_time' && event.status === 'confirmed' ? 'verified' : 'estimated';
}

function confidenceScore(event, state, enrich) {
  let c = 50;
  if (estimatedVsVerified(event) === 'verified') c += 15; else c -= 5;
  if (event.importance === 'high') c += 5;
  if (state === 'parsed') c = Math.max(c, 90);
  if (state === 'revised') c = Math.max(c, 92);
  if (state === 'delayed') c = Math.min(c, 40);
  if (enrich && enrich.available) c = Math.max(c, 85);
  return Math.max(0, Math.min(100, c));
}

// Narrative tags — deterministic from category + resolved surprise only.
function narrativeTags(category, surprise) {
  const tags = [category];
  const dir = surprise && surprise.surprise_direction;
  if (!dir || dir === 'pending' || dir === 'near_consensus') {
    tags.push(dir === 'near_consensus' ? 'in_line' : 'awaiting_data');
    return tags;
  }
  const hotter = dir === 'hotter_or_stronger';
  if (category === 'inflation') tags.push(hotter ? 'hotter_inflation' : 'cooler_inflation', hotter ? 'hawkish_pressure' : 'dovish_repricing');
  else if (category === 'labor') tags.push(hotter ? 'labor_resilience' : 'labor_weakening', hotter ? 'hawkish_pressure' : 'dovish_repricing');
  else if (category === 'growth') tags.push(hotter ? 'growth_resilience' : 'growth_slowdown');
  else if (category === 'policy') tags.push(hotter ? 'hawkish_pressure' : 'dovish_repricing');
  return tags;
}

// Orient the cross-asset template by the resolved surprise direction.
function orientCrossAsset(template, surprise) {
  const dir = surprise && surprise.surprise_direction;
  const resolved = dir === 'hotter_or_stronger' || dir === 'softer_or_weaker';
  const invert = dir === 'softer_or_weaker';
  const flip = (s) => (s === '+' ? '-' : s === '-' ? '+' : '0');
  const out = {};
  for (const [asset, sign] of Object.entries(template)) {
    out[asset] = resolved ? (invert ? flip(sign) : sign) : sign;
  }
  return { directional: out, conditional: !resolved, basis: resolved ? 'resolved_surprise' : 'directional_template' };
}

async function enrichEvent(event, { fetch, env, observations = [] }) {
  const map = seriesFor(event.type);
  const category = (map && map.category) || 'macro';

  let actual = num(event.actual);
  let previous = num(event.previous);
  let revised = null, revisedFrom = null;
  let enrich = null;
  let enrichmentSource = 'calendar';

  // Only attempt official enrichment for past/awaiting events with a mapping.
  const isPast = Date.parse(event.event_time) <= Date.now();
  if (fetch && map && isPast) {
    enrich = await fetchOfficial(map, env);
    if (enrich.available) {
      if (enrich.actual !== null) actual = enrich.actual;
      if (enrich.previous !== null) previous = enrich.previous;
      if (enrich.revised !== null) { revised = enrich.revised; revisedFrom = enrich.revised_from; }
      enrichmentSource = enrich.source_name || 'official';
    }
  }

  // Phase 102: forecast & consensus intelligence (never fabricated). Pass the
  // ENRICHED previous (e.g. FRED-filled) so the labelled historical proxy can
  // use the real prior print rather than the raw calendar's null.
  const forecastIntel = computeConsensus({ ...event, previous }, observations);
  const forecast = forecastIntel.forecast; // provider consensus or null (proxy/unavailable)
  const surprise = upgradeSurprise(event, category, forecastIntel, actual);

  const state = releaseState(event, { actual, revised });
  const template = (map && map.cross_asset) || { US10Y: '+', DXY: '+', SPY: '-', VIX: '+' };

  return {
    id: event.id,
    event: event.event_name,
    category,
    country: event.country,
    release_time: event.event_time,
    timezone: event.timezone || 'UTC',
    actual,
    forecast,
    previous,
    revised,
    revised_from: revisedFrom,
    status: event.status,
    estimated_vs_verified: estimatedVsVerified(event),
    importance: event.importance,
    source: enrich && enrich.available ? enrich.source_name : (event.source_name || null),
    source_url: (enrich && enrich.available && enrich.source_url) || event.source_url || null,
    confidence: confidenceScore(event, state, enrich),
    affected_assets: event.historical_asset_sensitivity || affectedAssets(event.type),
    release_state: state,
    historical_context: {
      previous,
      revised,
      revised_from: revisedFrom,
      observation_date: enrich && enrich.observation_date ? enrich.observation_date : null,
      official_series: map ? (map.fred || map.bls || map.eia || map.treasury || null) : null,
    },
    surprise,
    surprise_ready: surprise.surprise_ready,
    surprise_confidence: surprise.surprise_confidence,
    forecast_basis: forecastIntel.forecast_basis,
    forecast_sources: forecastIntel.forecast_sources,
    forecast_source_count: forecastIntel.forecast_source_count,
    forecast_confidence: forecastIntel.forecast_confidence,
    forecast_quality: forecastIntel.forecast_quality,
    consensus_state: forecastIntel.consensus_state,
    forecast_dispersion: forecastIntel.forecast_dispersion,
    proxy_used: forecastIntel.proxy_used,
    proxy_value: forecastIntel.proxy_value,
    cross_asset: orientCrossAsset(template, surprise),
    narrative_tags: narrativeTags(category, surprise),
    data_capabilities: event.data_capabilities || {},
    enrichment_source: enrichmentSource,
  };
}

function dateStr(offsetDays) {
  return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
}

async function build({ fetch = false, env = process.env } = {}) {
  const cal = readJson(CAL_PATH, { events: [] });
  const events = Array.isArray(cal.events) ? cal.events : [];

  // Phase 102: pull forecast observations once (graceful — [] without keys).
  let observations = [];
  let forecastProviders = {};
  if (fetch) {
    try {
      const fr = await fetchForecastObservations({ from: dateStr(-2), to: dateStr(14), env });
      observations = fr.observations;
      forecastProviders = fr.providerStatus;
    } catch (err) {
      forecastProviders = { error: String((err && err.message) || 'forecast_fetch_failed') };
    }
  }

  const enriched = [];
  for (const e of events) enriched.push(await enrichEvent(e, { fetch, env, observations }));

  const byState = {};
  for (const s of RELEASE_STATES) byState[s] = enriched.filter((e) => e.release_state === s).length;
  const byForecastQuality = {};
  for (const e of enriched) byForecastQuality[e.forecast_quality] = (byForecastQuality[e.forecast_quality] || 0) + 1;

  const keysPresent = {
    fred: Boolean(String(env.FRED_API_KEY || '').trim()),
    bls: Boolean(String(env.BLS_API_KEY || '').trim()),
    bea: Boolean(String(env.BEA_API_KEY || '').trim()),
    eia: Boolean(String(env.EIA_API_KEY || '').trim()),
  };

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'economic-intelligence',
    calendar_source: cal.source || null,
    calendar_updated_at: cal.updated_at || null,
    enrichment: {
      fetch_attempted: Boolean(fetch),
      keys_present: { ...keysPresent, fmp: Boolean(String(env.FMP_API_KEY || env.FINANCIAL_MODELING_PREP_API_KEY || '').trim()), finnhub: Boolean(String(env.FINNHUB_API_KEY || '').trim()) },
      forecast_providers: forecastProviders,
      forecast_observations: observations.length,
      note: fetch ? 'Official actuals pulled where keys/network allowed; forecasts merged from provider consensus (FMP/Finnhub) or labelled historical proxy. Missing values stay null (never fabricated).' : 'Offline deterministic enrichment; run with --fetch to pull official actuals + provider forecasts.',
    },
    release_states: RELEASE_STATES,
    counts: {
      total: enriched.length,
      high_impact: enriched.filter((e) => e.importance === 'high').length,
      parsed: byState.parsed + byState.revised,
      awaiting: byState.awaiting_release + byState.scheduled,
      delayed: byState.delayed,
      surprise_ready: enriched.filter((e) => e.surprise_ready).length,
      by_state: byState,
      by_forecast_quality: byForecastQuality,
    },
    events: enriched,
    note: enriched.length ? null : 'No calendar events available — economic intelligence intentionally empty.',
  };
}

async function main() {
  const fetch = process.argv.includes('--fetch');
  const write = process.argv.includes('--write');
  const result = await build({ fetch });
  console.log(`[econ-intel] events=${result.counts.total} parsed=${result.counts.parsed} awaiting=${result.counts.awaiting} delayed=${result.counts.delayed} fetch=${fetch} keys=${JSON.stringify(result.enrichment.keys_present)}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log('[econ-intel] wrote data/intelligence/economic-intelligence.json');
  }
}

if (require.main === module) main().catch((e) => { console.error('[econ-intel] error:', e.message); process.exit(1); });

module.exports = { build, enrichEvent, releaseState, estimatedVsVerified, narrativeTags, orientCrossAsset, RELEASE_STATES };
