'use strict';

// Phase 49: Live Market Data Intelligence Ingestion Engine
// Fetches FRED (yields/VIX/DXY/Fed funds) and Finnhub (equities/sectors) with aggressive caching.
// Regime signals computed from real data, never fabricated.
//
// Usage:
//   node tools/update-live-market-state.js                  → report current state
//   node tools/update-live-market-state.js --validate-only  → validate current state file
//   node tools/update-live-market-state.js --fetch          → fetch from APIs (dry run)
//   node tools/update-live-market-state.js --fetch --write  → fetch + write both JSON files
//   node tools/update-live-market-state.js --source=<f> --write → validate manual file + write

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const ROOT        = path.resolve(__dirname, '..');
const STATE_PATH  = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const CACHE_DIR   = path.join(ROOT, 'data', 'cache', 'market-data');
const CACHE_PATH  = path.join(CACHE_DIR, 'api-cache.json');

const FETCH         = process.argv.includes('--fetch');
const WRITE         = process.argv.includes('--write');
const VALIDATE_ONLY = process.argv.includes('--validate-only');
const SOURCE_ARG    = argValue('--source');

// ── Stale thresholds ──────────────────────────────────────────────────────────
const STALE_YIELDS_MS  = 8 * 3600 * 1000;   // FRED data updates once per trading day
const STALE_PRICES_MS  = 2 * 3600 * 1000;
const STALE_SECTORS_MS = 2 * 3600 * 1000;

// ── FRED series IDs ───────────────────────────────────────────────────────────
const FRED_SERIES = [
  { id: 'DGS10',    field: 'us10y_yield',    url: 'https://fred.stlouisfed.org/series/DGS10'    },
  { id: 'DGS2',     field: 'us2y_yield',     url: 'https://fred.stlouisfed.org/series/DGS2'     },
  { id: 'VIXCLS',   field: 'vix',            url: 'https://fred.stlouisfed.org/series/VIXCLS'   },
  { id: 'DTWEXBGS', field: 'dxy',            url: 'https://fred.stlouisfed.org/series/DTWEXBGS' },
  { id: 'DFEDTARU', field: 'fed_funds_rate', url: 'https://fred.stlouisfed.org/series/DFEDTARU' },
];

// ── Finnhub symbol → state field ─────────────────────────────────────────────
// NOTE: DIA is excluded intentionally. DIA ETF price (~$400-$520) ≠ DJIA index level (~40,000+).
// Storing DIA price as 'dowjones' would fail the [1000,200000] safety bounds check.
// Dow Jones index is left null until a reliable index-level source is wired.
const PRICE_MAP = {
  'SPY':  'sp500',
  'QQQ':  'nasdaq',
  'IWM':  'russell2000',
  'GLD':  'gold',
  'TLT':  'tlt',
  'NVDA': 'nvda',
  'BINANCE:BTCUSDT': 'bitcoin',
};
const SECTOR_SYMBOLS = ['XLK','XLF','XLE','XLU','XLV','XLI','XLRE','XLP'];

// ── Numeric field validation bounds [min, max] ────────────────────────────────
const NUMERIC_BOUNDS = {
  sp500:          [100,     100000],
  nasdaq:         [100,     100000],
  dowjones:       [1000,    200000],
  russell2000:    [50,      10000],
  vix:            [1,       200],
  us10y_yield:    [-5,      25],
  us2y_yield:     [-5,      25],
  fed_funds_rate: [0,       30],
  dxy:            [50,      200],
  gold:           [50,      15000],
  bitcoin:        [100,     10000000],
  nvda:           [1,       10000],
  tlt:            [10,      500],
};

const FINNHUB_SOURCE = 'https://finnhub.io/';

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!FETCH && !SOURCE_ARG && !VALIDATE_ONLY) {
    printStatus();
    return;
  }
  if (VALIDATE_ONLY) {
    validateCurrentState();
    return;
  }
  if (SOURCE_ARG) {
    processSourceFile();
    return;
  }
  if (FETCH) {
    await fetchAndUpdate();
  }
}

// ── Status report ─────────────────────────────────────────────────────────────

function printStatus() {
  const state = readJson(STATE_PATH, {});
  const status = state.metadata && state.metadata.status;
  console.log(`Live market state: status=${status || 'unknown'}, generated_at=${state.generated_at || 'unknown'}`);

  if (status === 'live' || status === 'partial') {
    for (const field of Object.keys(NUMERIC_BOUNDS)) {
      const e = state[field];
      if (e && e.value != null) {
        const pct = e.change_pct != null
          ? ` (${e.change_pct >= 0 ? '+' : ''}${e.change_pct.toFixed(2)}%)`
          : '';
        console.log(`  ${field}: ${e.value}${pct}  [${e.fetched_at || '?'}]`);
      }
    }
    const r = state.computed_regime || {};
    if (r.market_regime) console.log(`  market_regime: ${r.market_regime}`);
    if (r.sector_leadership && r.sector_leadership.length) {
      console.log(`  sector_leadership: ${r.sector_leadership.join(', ')}`);
    }
    if (state.macro_summary) console.log(`  macro_summary: ${state.macro_summary.slice(0, 120)}...`);
  } else {
    console.log('  State is in fallback mode. Use --fetch --write to pull live data.');
    const cache = loadCache();
    if (cache.yields && cache.yields.fetched_at) console.log(`  Last yields fetch: ${cache.yields.fetched_at}`);
    if (cache.prices && cache.prices.fetched_at) console.log(`  Last prices fetch: ${cache.prices.fetched_at}`);
  }
}

// ── Validate current state file ───────────────────────────────────────────────

function validateCurrentState() {
  const state = readJson(STATE_PATH, null);
  if (!state || !state.generated_at) {
    console.error('State file missing or malformed.');
    process.exit(1);
  }
  const ageH = (Date.now() - new Date(state.generated_at).getTime()) / 3600000;
  const status = state.metadata && state.metadata.status || 'unknown';
  console.log(`State: status=${status}, age=${ageH.toFixed(1)}h`);

  if (status === 'live' || status === 'partial') {
    const populated = Object.keys(NUMERIC_BOUNDS).filter(f => state[f] && state[f].value != null).length;
    console.log(`Fields populated: ${populated}/${Object.keys(NUMERIC_BOUNDS).length}`);
    if (ageH > 26) console.warn(`Warning: State is ${ageH.toFixed(0)}h old — consider refreshing.`);
  } else {
    console.log('State is in fallback mode — no live data currently.');
  }
  process.exit(0);
}

// ── Source-file mode (backward compatibility) ──────────────────────────────

function processSourceFile() {
  const srcPath = path.resolve(ROOT, SOURCE_ARG);
  if (!fs.existsSync(srcPath)) {
    console.error(`Source file not found: ${srcPath}`);
    process.exit(1);
  }
  const input = readJson(srcPath, null);
  if (!input) { console.error('Source file is empty or invalid JSON.'); process.exit(1); }

  const failures = [];
  const now = Date.now();
  for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    const e = input[field];
    if (!e || e.value == null) continue;
    if (typeof e.value !== 'number' || !isFinite(e.value)) { failures.push(`${field}: value must be finite number`); continue; }
    if (e.value < min || e.value > max) failures.push(`${field}: ${e.value} outside [${min},${max}]`);
    if (!e.source_url) failures.push(`${field}: source_url required for non-null values`);
    if (!e.fetched_at) failures.push(`${field}: fetched_at required`);
    else if (now - new Date(e.fetched_at).getTime() > 26 * 3600 * 1000) {
      failures.push(`${field}: data is stale (>26h old)`);
    }
  }
  if (failures.length) {
    console.error('Validation failed:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }
  if (!WRITE) {
    console.log(`Validation passed (${Object.keys(NUMERIC_BOUNDS).filter(f => input[f] && input[f].value != null).length} fields). Add --write to commit.`);
    process.exit(0);
  }
  fs.writeFileSync(STATE_PATH, JSON.stringify({ ...input, generated_at: new Date().toISOString() }, null, 2) + '\n');
  console.log('Written to data/live-market-state.json');
}

// ── Fetch and update ──────────────────────────────────────────────────────────

async function fetchAndUpdate() {
  const fredKey = process.env.FRED_API_KEY;
  const finnKey = process.env.FINNHUB_API_KEY;

  if (!fredKey && !finnKey) {
    console.error('No API keys available (FRED_API_KEY, FINNHUB_API_KEY). Cannot fetch live data.');
    process.exit(1);
  }

  const now   = Date.now();
  let cache   = loadCache();
  const collected = {};
  let fetchCount  = 0;

  // ── FRED: yields, VIX, DXY proxy, Fed funds ──────────────────────────────
  const yieldsStale = !cache.yields || !cache.yields.fetched_at ||
    (now - new Date(cache.yields.fetched_at).getTime()) > STALE_YIELDS_MS;

  if (fredKey && yieldsStale) {
    console.log('[FRED] Yields cache stale — fetching...');
    const yieldsData = {};
    for (const series of FRED_SERIES) {
      try {
        const val = await fetchFRED(series.id, fredKey);
        if (val !== null) {
          yieldsData[series.id] = val;
          console.log(`  ${series.id}: ${val}`);
          fetchCount++;
        }
      } catch (e) {
        console.warn(`  [FRED] ${series.id} failed: ${e.message}`);
      }
      await delay(250);
    }
    if (Object.keys(yieldsData).length > 0) {
      cache.yields = { fetched_at: new Date().toISOString(), data: yieldsData };
      saveCache(cache);
    }
  } else if (fredKey) {
    console.log('[FRED] Using cached yields data.');
  } else {
    console.log('[FRED] FRED_API_KEY not set — skipping yields.');
  }

  // ── Finnhub: equity/ETF prices ────────────────────────────────────────────
  const pricesStale = !cache.prices || !cache.prices.fetched_at ||
    (now - new Date(cache.prices.fetched_at).getTime()) > STALE_PRICES_MS;

  if (finnKey && pricesStale) {
    console.log('[FINNHUB] Price cache stale — fetching equity quotes...');
    const pricesData = {};
    for (const symbol of Object.keys(PRICE_MAP)) {
      try {
        const q = await fetchFinnhub(symbol, finnKey);
        if (q) {
          pricesData[symbol] = q;
          const chg = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}` : q.changePct.toFixed(2);
          console.log(`  ${symbol}: ${q.price} (${chg}%)`);
          fetchCount++;
        }
      } catch (e) {
        console.warn(`  [FINNHUB] ${symbol} failed: ${e.message}`);
      }
      await delay(150);
    }
    if (Object.keys(pricesData).length > 0) {
      cache.prices = { fetched_at: new Date().toISOString(), data: pricesData };
      saveCache(cache);
    }
  } else if (finnKey) {
    console.log('[FINNHUB] Using cached equity price data.');
  } else {
    console.log('[FINNHUB] FINNHUB_API_KEY not set — skipping prices.');
  }

  // ── Finnhub: sector ETFs ──────────────────────────────────────────────────
  const sectorsStale = !cache.sectors || !cache.sectors.fetched_at ||
    (now - new Date(cache.sectors.fetched_at).getTime()) > STALE_SECTORS_MS;

  if (finnKey && sectorsStale) {
    console.log('[FINNHUB] Sector cache stale — fetching sector ETF quotes...');
    const sectorsData = {};
    for (const sym of SECTOR_SYMBOLS) {
      try {
        const q = await fetchFinnhub(sym, finnKey);
        if (q) {
          sectorsData[sym] = q;
          const chg = q.changePct >= 0 ? `+${q.changePct.toFixed(2)}` : q.changePct.toFixed(2);
          console.log(`  ${sym}: ${q.price} (${chg}%)`);
          fetchCount++;
        }
      } catch (e) {
        console.warn(`  [FINNHUB] ${sym} failed: ${e.message}`);
      }
      await delay(150);
    }
    if (Object.keys(sectorsData).length > 0) {
      cache.sectors = { fetched_at: new Date().toISOString(), data: sectorsData };
      saveCache(cache);
    }
  } else if (finnKey) {
    console.log('[FINNHUB] Using cached sector data.');
  }

  console.log(`\n[FETCH] Total API calls this run: ${fetchCount}`);

  // ── Build state from cache ────────────────────────────────────────────────
  const ts             = new Date().toISOString();
  const fredData       = (cache.yields  && cache.yields.data)  || {};
  const priceData      = (cache.prices  && cache.prices.data)  || {};
  const sectorData     = (cache.sectors && cache.sectors.data) || {};
  const fredAt         = (cache.yields  && cache.yields.fetched_at)  || null;
  const priceAt        = (cache.prices  && cache.prices.fetched_at)  || null;
  const sectorAt       = (cache.sectors && cache.sectors.fetched_at) || null;

  const mkEntry = (value, changePct, sourceUrl, sourceName, fetchedAt) =>
    ({ value, change_pct: changePct != null ? changePct : null,
       source_url: sourceUrl, source_name: sourceName, fetched_at: fetchedAt });

  // FRED fields — bounds-check every value before storing
  for (const series of FRED_SERIES) {
    const val = fredData[series.id];
    if (val != null) {
      const bounds = NUMERIC_BOUNDS[series.field];
      if (bounds && (val < bounds[0] || val > bounds[1])) {
        console.warn(`[BOUNDS] Skipping ${series.field}: ${val} outside [${bounds[0]},${bounds[1]}]`);
        continue;
      }
      collected[series.field] = mkEntry(val, null, series.url, 'FRED', fredAt);
    }
  }

  // Finnhub equity prices — bounds-check every value before storing
  for (const [symbol, field] of Object.entries(PRICE_MAP)) {
    const q = priceData[symbol];
    if (q) {
      const bounds = NUMERIC_BOUNDS[field];
      if (bounds && (q.price < bounds[0] || q.price > bounds[1])) {
        console.warn(`[BOUNDS] Skipping ${field} (${symbol}): ${q.price} outside [${bounds[0]},${bounds[1]}]`);
        continue;
      }
      collected[field] = mkEntry(q.price, q.changePct, FINNHUB_SOURCE, 'Finnhub', priceAt);
    }
  }

  // Sector ETFs (nested object)
  const sector_etfs = {};
  for (const sym of SECTOR_SYMBOLS) {
    const q = sectorData[sym];
    if (q) sector_etfs[sym] = { price: q.price, change_pct: q.changePct, source: 'Finnhub', fetched_at: sectorAt };
  }

  // Yield spread (computed)
  const us10y = collected.us10y_yield && collected.us10y_yield.value;
  const us2y  = collected.us2y_yield  && collected.us2y_yield.value;
  let yield_spread_2y10y = null;
  if (us10y != null && us2y != null) {
    const spread = parseFloat((us10y - us2y).toFixed(3));
    yield_spread_2y10y = {
      value: spread,
      spread_bps: Math.round(spread * 100),
      spread_regime: spread < -0.5 ? 'deeply_inverted' : spread < 0 ? 'inverted' : spread < 0.5 ? 'flat' : 'normal',
      computed_at: ts,
      source_url: 'https://fred.stlouisfed.org/',
      source_name: 'FRED (computed)',
      fetched_at: ts,
    };
  }

  // Compute regime
  const regimeInput = {
    vix: collected.vix, sp500: collected.sp500, nasdaq: collected.nasdaq,
    russell2000: collected.russell2000, us10y_yield: collected.us10y_yield,
    us2y_yield: collected.us2y_yield, nvda: collected.nvda,
    sector_etfs: Object.keys(sector_etfs).length > 0 ? sector_etfs : null,
  };
  const regime = computeRegime(regimeInput);

  const macro_summary    = buildMacroSummary(collected, sector_etfs, regime, yield_spread_2y10y);
  const fed_expectations = buildFedExpectations(collected);

  // Status
  const populated = Object.keys(NUMERIC_BOUNDS).filter(f => collected[f] && collected[f].value != null).length;
  const status    = populated >= 6 ? 'live' : populated >= 2 ? 'partial' : 'fallback';

  // ── Build output object ───────────────────────────────────────────────────
  const output = {
    version:      '2.0',
    generated_at: ts,
    metadata: {
      status,
      data_quality:     populated >= 10 ? 'full' : populated >= 5 ? 'partial' : 'minimal',
      fields_populated: populated,
      source_policy: {
        description:               'Values fetched from FRED and Finnhub APIs with caching. No fabricated or AI-inferred values.',
        update_tool:               'tools/update-live-market-state.js --fetch --write',
        staleness_threshold_hours: 26,
        fallback_on_stale:         true,
      },
    },
  };

  for (const field of Object.keys(NUMERIC_BOUNDS)) {
    output[field] = collected[field] ||
      { value: null, change_pct: null, source_url: null, source_name: null, fetched_at: null };
  }

  output.yield_spread_2y10y = yield_spread_2y10y ||
    { value: null, spread_bps: null, spread_regime: null, computed_at: null };
  output.sector_etfs        = Object.keys(sector_etfs).length > 0 ? sector_etfs : null;
  output.computed_regime    = regime;
  output.sector_leadership  = regime.sector_leadership || [];
  output.sector_weakness    = regime.sector_weakness   || [];
  output.macro_summary      = macro_summary   || null;
  output.fed_expectations   = fed_expectations || null;

  console.log('\n[OUTPUT] State summary:');
  console.log(`  status: ${status}  fields populated: ${populated}/${Object.keys(NUMERIC_BOUNDS).length}`);
  console.log(`  market_regime: ${regime.market_regime}`);
  if (macro_summary) console.log(`  macro_summary: ${macro_summary.slice(0, 120)}...`);

  if (!WRITE) {
    console.log('\n[DRY RUN] Add --write to commit to data/live-market-state.json and data/market-regime-state.json');
    return;
  }

  // Write live state
  fs.writeFileSync(STATE_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log('\n[WRITE] Updated data/live-market-state.json');

  // Write regime state
  const regimeOutput = {
    version:    '2.0',
    updated:    ts.slice(0, 10),
    generated_at: ts,
    source_policy: { requires_real_sources: true, automated_fetch: true },
    state: {
      volatility_regime:      regime.volatility_regime,
      risk_regime:            regime.risk_regime,
      market_regime:          regime.market_regime,
      ai_sector_momentum:     regime.ai_sector_momentum,
      semiconductor_strength: regime.semiconductor_strength,
      rates_trend:            regime.rates_trend,
      defensive_rotation:     regime.defensive_rotation,
      growth_value_bias:      regime.growth_value_bias,
      etf_flow_themes:        (regime.sector_leadership || []).map(s => `${s} leading`),
    },
    sources: [
      ...(fredAt  ? [{ name: 'FRED',    url: 'https://fred.stlouisfed.org/', fetched_at: fredAt  }] : []),
      ...(priceAt ? [{ name: 'Finnhub', url: 'https://finnhub.io/',          fetched_at: priceAt }] : []),
    ],
  };
  fs.writeFileSync(REGIME_PATH, JSON.stringify(regimeOutput, null, 2) + '\n', 'utf8');
  console.log('[WRITE] Updated data/market-regime-state.json');
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchFRED(seriesId, apiKey) {
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&sort_order=desc&limit=5&file_type=json`;
  const raw = await httpGet(url, 15000);
  const data = JSON.parse(raw);
  const obs = (data.observations || []).filter(o => o.value && o.value !== '.');
  if (!obs.length) return null;
  const val = parseFloat(obs[0].value);
  return isFinite(val) ? val : null;
}

async function fetchFinnhub(symbol, apiKey) {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
  const raw = await httpGet(url, 10000);
  const data = JSON.parse(raw);
  if (!data || !data.c || data.c === 0) return null;
  return { price: data.c, changePct: typeof data.dp === 'number' ? data.dp : 0 };
}

function httpGet(url, timeout) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Regime computation ────────────────────────────────────────────────────────

function computeRegime(data) {
  const vixVal  = data.vix          && data.vix.value;
  const spyChg  = data.sp500        && data.sp500.change_pct;
  const qqqChg  = data.nasdaq       && data.nasdaq.change_pct;
  const iwmChg  = data.russell2000  && data.russell2000.change_pct;
  const us10y   = data.us10y_yield  && data.us10y_yield.value;
  const us2y    = data.us2y_yield   && data.us2y_yield.value;
  const nvdaChg = data.nvda         && data.nvda.change_pct;
  const se      = data.sector_etfs  || {};

  const xlkChg = se.XLK && se.XLK.change_pct;
  const xluChg = se.XLU && se.XLU.change_pct;
  const xlvChg = se.XLV && se.XLV.change_pct;
  const spread  = (us10y != null && us2y != null) ? us10y - us2y : null;

  // All values must match the allowed sets in update-market-regime.js
  const volatility_regime = vixVal == null ? 'unverified'
    : vixVal < 15 ? 'low' : vixVal < 20 ? 'normal' : vixVal < 30 ? 'elevated' : 'high';

  const rates_trend = spread == null ? 'unverified'
    : spread < -0.5 ? 'falling' : spread < 0 ? 'mixed'
    : spread > 1.0  ? 'rising' : 'stable';

  const risk_regime = vixVal == null ? 'unverified'
    : (vixVal < 18 && (spyChg == null || spyChg >= -0.5)) ? 'risk-on'
    : vixVal > 25 ? 'risk-off' : 'neutral';

  const ai_sector_momentum = (qqqChg == null && xlkChg == null) ? 'unverified'
    : ((qqqChg || 0) > 1.0 || (xlkChg || 0) > 1.5) ? 'positive'
    : ((qqqChg || 0) < -1.0 || (xlkChg || 0) < -1.5) ? 'negative' : 'neutral';

  const semiconductor_strength = nvdaChg == null ? 'unverified'
    : nvdaChg > 2.0 ? 'strong' : nvdaChg < -2.0 ? 'weak' : 'neutral';

  const defAvg = (xluChg != null && xlvChg != null) ? (xluChg + xlvChg) / 2 : (xluChg ?? xlvChg ?? null);
  const defensive_rotation = defAvg == null ? 'unverified'
    : defAvg > (spyChg || 0) + 0.5 ? 'present'
    : defAvg < (spyChg || 0) - 0.5 ? 'absent' : 'mixed';

  const growth_value_bias = (qqqChg == null || spyChg == null) ? 'unverified'
    : qqqChg - spyChg > 0.5 ? 'growth'
    : qqqChg - spyChg < -0.5 ? 'value' : 'balanced';

  // Sector ranking
  const sectorRanks = Object.entries(se)
    .filter(([, s]) => s && s.change_pct != null)
    .map(([sym, s]) => ({ sym, pct: s.change_pct }))
    .sort((a, b) => b.pct - a.pct);
  const sector_leadership = sectorRanks.filter(s => s.pct > 0.25).slice(0, 3).map(s => s.sym);
  const sector_weakness   = [...sectorRanks].reverse().filter(s => s.pct < -0.25).slice(0, 3).map(s => s.sym);

  // Overall regime
  let market_regime = 'mixed';
  if (spyChg != null) {
    const positives = [spyChg > 0, qqqChg != null && qqqChg > 0, iwmChg != null && iwmChg > 0].filter(Boolean).length;
    if (vixVal != null && vixVal > 28) market_regime = 'volatility_spike';
    else if (defensive_rotation === 'active') market_regime = 'defensive_rotation';
    else if (qqqChg != null && qqqChg > (spyChg + 0.5) && qqqChg > 0.4) market_regime = 'growth_momentum';
    else if (positives >= 2 && iwmChg != null && iwmChg > 0) market_regime = 'risk-on';
    else if (positives <= 1 && spyChg < -0.8) market_regime = 'risk-off';
    else if (spread != null && spread < -0.25 && vixVal != null && vixVal > 20) market_regime = 'rates_pressure';
    else market_regime = 'mixed';
  }

  return {
    volatility_regime, risk_regime, market_regime, ai_sector_momentum,
    semiconductor_strength, rates_trend, defensive_rotation, growth_value_bias,
    sector_leadership, sector_weakness,
    yield_spread: spread, vix_level: vixVal,
    computed_at: new Date().toISOString(),
  };
}

// ── Narrative builders (injected into AI prompts) ─────────────────────────────

function buildMacroSummary(fields, sectorEtfs, regime, spreadObj) {
  const parts = [];

  if (fields.vix && fields.vix.value != null) {
    parts.push(`VIX ${fields.vix.value.toFixed(1)} (${regime.volatility_regime} volatility)`);
  }

  const eqParts = [];
  for (const [sym, field] of [['SPY','sp500'],['QQQ','nasdaq'],['IWM','russell2000']]) {
    const f = fields[field];
    if (f && f.value != null && f.change_pct != null) {
      eqParts.push(`${sym} ${f.change_pct >= 0 ? '+' : ''}${f.change_pct.toFixed(2)}%`);
    }
  }
  if (eqParts.length) parts.push(`Equity moves: ${eqParts.join(' · ')}`);

  if (fields.us10y_yield && fields.us10y_yield.value != null) {
    let yStr = `10Y ${fields.us10y_yield.value.toFixed(2)}%`;
    if (fields.us2y_yield && fields.us2y_yield.value != null) {
      yStr += ` · 2Y ${fields.us2y_yield.value.toFixed(2)}%`;
    }
    if (spreadObj && spreadObj.spread_bps != null) {
      const bps = spreadObj.spread_bps;
      yStr += ` · curve ${bps >= 0 ? '+' : ''}${bps}bps (${(spreadObj.spread_regime || '').replace(/_/g,' ')})`;
    }
    parts.push(`Yields: ${yStr}`);
  }

  if (fields.fed_funds_rate && fields.fed_funds_rate.value != null) {
    parts.push(`Fed funds: ${fields.fed_funds_rate.value.toFixed(2)}%`);
  }

  if (fields.dxy  && fields.dxy.value  != null) parts.push(`DXY ${fields.dxy.value.toFixed(1)}`);
  if (fields.gold && fields.gold.value != null) {
    const g = fields.gold;
    const chg = g.change_pct != null ? ` (${g.change_pct >= 0 ? '+' : ''}${g.change_pct.toFixed(2)}%)` : '';
    parts.push(`GLD $${g.value.toFixed(1)}${chg}`);
  }

  if (regime.sector_leadership && regime.sector_leadership.length) {
    const list = regime.sector_leadership.map(sym => {
      const s = sectorEtfs && sectorEtfs[sym];
      return s && s.change_pct != null ? `${sym} ${s.change_pct >= 0 ? '+' : ''}${s.change_pct.toFixed(2)}%` : sym;
    }).join(' ');
    parts.push(`Sector leaders: ${list}`);
  }
  if (regime.sector_weakness && regime.sector_weakness.length) {
    const list = regime.sector_weakness.map(sym => {
      const s = sectorEtfs && sectorEtfs[sym];
      return s && s.change_pct != null ? `${sym} ${s.change_pct.toFixed(2)}%` : sym;
    }).join(' ');
    parts.push(`Laggards: ${list}`);
  }

  parts.push(`Regime: ${regime.market_regime}`);

  return parts.length >= 3 ? parts.join('. ') : null;
}

function buildFedExpectations(fields) {
  const fed  = fields.fed_funds_rate && fields.fed_funds_rate.value;
  const us2y = fields.us2y_yield     && fields.us2y_yield.value;
  if (fed == null) return null;

  const parts = [`Fed funds target: ${fed.toFixed(2)}%`];
  if (us2y != null) {
    const diff = parseFloat((us2y - fed).toFixed(2));
    if (diff < -0.5) {
      parts.push(`2Y yield ${us2y.toFixed(2)}% — ${Math.abs(diff).toFixed(2)}pp below Fed funds, implying market pricing rate cuts`);
    } else if (diff > 0.3) {
      parts.push(`2Y yield ${us2y.toFixed(2)}% — above Fed funds, mild hike premium or stable expectations`);
    } else {
      parts.push(`2Y yield ${us2y.toFixed(2)}% — close to Fed funds, policy expectations anchored`);
    }
  }
  return parts.join('. ');
}

// ── Cache management ──────────────────────────────────────────────────────────

function loadCache() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  if (!fs.existsSync(CACHE_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')); } catch { return {}; }
}

function saveCache(cache) {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + '\n', 'utf8');
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const m = process.argv.find(a => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

main().catch(e => { console.error(`[ERROR] ${e.message}`); process.exit(1); });
