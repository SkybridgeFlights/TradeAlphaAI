'use strict';

// Phase 101 — official-source series fetchers (multi-source, graceful).
//
// Each fetcher returns a uniform shape:
//   { available: boolean, actual, previous, revised, revised_from,
//     observation_date, units, source_name, source_url, reason? }
// When a key is missing or the network/endpoint fails, available=false and
// values stay null — NEVER fabricated. Callers degrade gracefully.
//
// FRED is the primary live path (free key, revision vintages). BLS/BEA/EIA are
// key-gated and wired with their real endpoints so a future key flip activates
// them. Treasury FiscalData needs no key (best-effort).

const https = require('https');
const { getJsonWithRetry } = require('./http-client');

function num(v) {
  if (v === null || v === undefined || v === '' || v === '.') return null;
  const n = Number(String(v).replace(/[%,$]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function unavailable(reason) {
  return { available: false, actual: null, previous: null, revised: null, revised_from: null, observation_date: null, units: null, source_name: null, source_url: null, reason };
}

// ── FRED ────────────────────────────────────────────────────────────────────
async function fetchFred(seriesId, env = process.env) {
  const key = String(env.FRED_API_KEY || '').trim();
  if (!key) return unavailable('no_fred_key');
  const base = 'https://api.stlouisfed.org/fred/series/observations';
  const url = `${base}?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(key)}&file_type=json&sort_order=desc&limit=2`;
  try {
    const data = await getJsonWithRetry(url, { maxRetries: 1 });
    const obs = Array.isArray(data?.observations) ? data.observations : [];
    if (!obs.length) return unavailable('no_observations');
    const latest = obs[0];
    const actual = num(latest.value);
    const previous = obs[1] ? num(obs[1].value) : null;

    // Revision detection (best-effort): the value as first published for this
    // observation date, via the realtime window starting at that date.
    let revised = null, revisedFrom = null;
    try {
      const vURL = `${base}?series_id=${encodeURIComponent(seriesId)}&api_key=${encodeURIComponent(key)}&file_type=json&observation_start=${latest.date}&observation_end=${latest.date}&realtime_start=${latest.date}&realtime_end=${latest.date}`;
      const vData = await getJsonWithRetry(vURL, { maxRetries: 0 });
      const firstPrint = num(vData?.observations?.[0]?.value);
      if (firstPrint !== null && actual !== null && firstPrint !== actual) {
        revised = actual;
        revisedFrom = firstPrint;
      }
    } catch { /* vintage lookup is best-effort; absence is not a failure */ }

    return {
      available: true, actual, previous, revised, revised_from: revisedFrom,
      observation_date: latest.date, units: data.units || null,
      source_name: 'FRED (St. Louis Fed)', source_url: `https://fred.stlouisfed.org/series/${seriesId}`,
    };
  } catch (err) {
    return unavailable(`fred_error:${(err && err.statusCode) || (err && err.message) || 'unknown'}`);
  }
}

// ── BLS (key-gated v2) ────────────────────────────────────────────────────────
function postJson(url, body, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = JSON.stringify(body);
    const req = https.request(u, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch { reject(new Error('invalid_json')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('timeout')));
    req.end(payload);
  });
}

async function fetchBls(seriesId, env = process.env) {
  const key = String(env.BLS_API_KEY || '').trim();
  if (!key) return unavailable('no_bls_key');
  try {
    const data = await postJson('https://api.bls.gov/publicAPI/v2/timeseries/data/', { seriesid: [seriesId], registrationkey: key, latest: true });
    const series = data?.Results?.series?.[0]?.data || [];
    if (!series.length) return unavailable('no_bls_data');
    const actual = num(series[0].value);
    const previous = series[1] ? num(series[1].value) : null;
    return { available: true, actual, previous, revised: null, revised_from: null, observation_date: `${series[0].year}-${series[0].period}`, units: null, source_name: 'U.S. Bureau of Labor Statistics', source_url: `https://data.bls.gov/timeseries/${seriesId}` };
  } catch (err) {
    return unavailable(`bls_error:${(err && err.message) || 'unknown'}`);
  }
}

// ── BEA / EIA / Treasury (key-gated / best-effort) ─────────────────────────────
async function fetchBea(_dataset, env = process.env) {
  const key = String(env.BEA_API_KEY || '').trim();
  if (!key) return unavailable('no_bea_key');
  // Wired for future activation; BEA's NIPA tables require per-table parameters
  // that the enrichment layer maps per series. Returns unavailable until the
  // per-table parameterization is enabled with a verified key.
  return unavailable('bea_not_activated');
}

async function fetchEia(seriesId, env = process.env) {
  const key = String(env.EIA_API_KEY || '').trim();
  if (!key) return unavailable('no_eia_key');
  try {
    const url = `https://api.eia.gov/v2/seriesid/${encodeURIComponent(seriesId)}?api_key=${encodeURIComponent(key)}`;
    const data = await getJsonWithRetry(url, { maxRetries: 1 });
    const rows = data?.response?.data || [];
    if (!rows.length) return unavailable('no_eia_data');
    const actual = num(rows[0].value);
    const previous = rows[1] ? num(rows[1].value) : null;
    return { available: true, actual, previous, revised: null, revised_from: null, observation_date: rows[0].period || null, units: rows[0].units || null, source_name: 'U.S. Energy Information Administration', source_url: 'https://www.eia.gov/' };
  } catch (err) {
    return unavailable(`eia_error:${(err && err.message) || 'unknown'}`);
  }
}

async function fetchTreasury(_hint /* , env */) {
  // Treasury FiscalData auctions — no key required (best-effort, public).
  try {
    const url = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?sort=-auction_date&page[size]=1';
    const data = await getJsonWithRetry(url, { maxRetries: 0 });
    const row = data?.data?.[0];
    if (!row) return unavailable('no_treasury_data');
    return { available: true, actual: num(row.high_yield || row.high_investment_rate), previous: null, revised: null, revised_from: null, observation_date: row.auction_date || null, units: '%', source_name: 'U.S. Treasury FiscalData', source_url: 'https://fiscaldata.treasury.gov/' };
  } catch (err) {
    return unavailable(`treasury_error:${(err && err.message) || 'unknown'}`);
  }
}

// Dispatch by the series-map entry, preferring FRED, then official alternates.
async function fetchOfficial(mapEntry, env = process.env) {
  if (!mapEntry) return unavailable('no_series_mapping');
  if (mapEntry.fred) {
    const r = await fetchFred(mapEntry.fred, env);
    if (r.available) return r;
    // Fall through to an alternate official source if FRED is unavailable.
    if (mapEntry.bls) { const b = await fetchBls(mapEntry.bls, env); if (b.available) return b; }
    if (mapEntry.eia) { const e = await fetchEia(mapEntry.eia, env); if (e.available) return e; }
    return r; // preserve FRED's unavailable reason
  }
  if (mapEntry.bls) return fetchBls(mapEntry.bls, env);
  if (mapEntry.eia) return fetchEia(mapEntry.eia, env);
  if (mapEntry.bea) return fetchBea(mapEntry.bea, env);
  if (mapEntry.treasury) return fetchTreasury(mapEntry.treasury, env);
  return unavailable('no_official_source_for_type');
}

module.exports = { fetchFred, fetchBls, fetchBea, fetchEia, fetchTreasury, fetchOfficial, unavailable };
