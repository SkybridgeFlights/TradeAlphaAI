'use strict';

// Phase 101 — canonical macro event → official data-series map.
//
// Maps each supported calendar event type (see calendar-normalizer ALLOWED_TYPES)
// to the OFFICIAL series that carry its released values, plus its deterministic
// cross-asset transmission and surprise orientation. This is the single source
// of truth that lets the enrichment layer fill actual/previous/revised from
// official APIs (no fabrication) and reason about a release deterministically.
//
// fred:   FRED series id (St. Louis Fed) — primary, free, has revision vintages.
// bls:    BLS series id (Bureau of Labor Statistics) — labor/prices.
// bea:    BEA dataset hint (Bureau of Economic Analysis) — GDP/PCE.
// eia:    EIA series id (Energy Information Administration) — energy.
// treasury: FiscalData/Treasury hint — auctions/yields.
//
// lower_is_hotter: when true, a LOWER actual is the "hot"/hawkish surprise
//   (unemployment rate, jobless claims). Otherwise higher is hotter.
//
// cross_asset: directional sensitivity to a HOTTER/STRONGER/HAWKISH surprise.
//   '+' rises, '-' falls, '0' ambiguous. A cooler/dovish surprise inverts.
//   Assets: DXY (dollar), US10Y (10y yield), GOLD, SPY, QQQ, VIX, OIL.

const HAWKISH = { DXY: '+', US10Y: '+', GOLD: '-', SPY: '-', QQQ: '-', VIX: '+', OIL: '0' };
const GROWTH  = { DXY: '+', US10Y: '+', GOLD: '-', SPY: '+', QQQ: '+', VIX: '-', OIL: '+' };
const LABOR   = { DXY: '+', US10Y: '+', GOLD: '-', SPY: '0', QQQ: '-', VIX: '-', OIL: '+' };

const SERIES_MAP = {
  'CPI':                { fred: 'CPIAUCSL', bls: 'CUUR0000SA0', unit: 'index/%', category: 'inflation', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'Core CPI':           { fred: 'CPILFESL', bls: 'CUUR0000SA0L1E', unit: '%', category: 'inflation', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'PCE':                { fred: 'PCEPI', bea: 'NIPA-T20804', unit: '%', category: 'inflation', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'Core PCE':           { fred: 'PCEPILFE', bea: 'NIPA-T20804', unit: '%', category: 'inflation', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'NFP':                { fred: 'PAYEMS', bls: 'CES0000000001', unit: 'k jobs', category: 'labor', lower_is_hotter: false, cross_asset: LABOR, importance: 'high' },
  'Unemployment Rate':  { fred: 'UNRATE', bls: 'LNS14000000', unit: '%', category: 'labor', lower_is_hotter: true, cross_asset: LABOR, importance: 'high' },
  'Jobless Claims':     { fred: 'ICSA', unit: 'k claims', category: 'labor', lower_is_hotter: true, cross_asset: LABOR, importance: 'medium' },
  'GDP':                { fred: 'GDPC1', bea: 'NIPA-T10101', unit: '% q/q', category: 'growth', lower_is_hotter: false, cross_asset: GROWTH, importance: 'high' },
  'Retail Sales':       { fred: 'RSAFS', unit: '% m/m', category: 'growth', lower_is_hotter: false, cross_asset: GROWTH, importance: 'high' },
  'ISM PMI':            { fred: 'NAPM', unit: 'index', category: 'growth', lower_is_hotter: false, cross_asset: GROWTH, importance: 'high' },
  'FOMC Rate Decision': { fred: 'DFEDTARU', unit: '%', category: 'policy', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'Fed Statement':      { unit: 'text', category: 'policy', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'high' },
  'Powell Speech':      { unit: 'text', category: 'policy', lower_is_hotter: false, cross_asset: HAWKISH, importance: 'medium' },
  'Treasury Auction':   { treasury: 'auctions_query', unit: '%', category: 'rates', lower_is_hotter: false, cross_asset: { DXY: '0', US10Y: '+', GOLD: '-', SPY: '0', QQQ: '0', VIX: '0', OIL: '0' }, importance: 'medium' },
  'ECB Rate Decision':  { unit: '%', category: 'policy', lower_is_hotter: false, cross_asset: { DXY: '-', US10Y: '0', GOLD: '0', SPY: '0', QQQ: '0', VIX: '+', OIL: '0' }, importance: 'high' },
  'BoJ Rate Decision':  { unit: '%', category: 'policy', lower_is_hotter: false, cross_asset: { DXY: '-', US10Y: '0', GOLD: '0', SPY: '0', QQQ: '0', VIX: '+', OIL: '0' }, importance: 'high' },
  'BoE Rate Decision':  { unit: '%', category: 'policy', lower_is_hotter: false, cross_asset: { DXY: '-', US10Y: '0', GOLD: '0', SPY: '0', QQQ: '0', VIX: '+', OIL: '0' }, importance: 'high' },
};

// Energy releases (EIA) — kept separate since they are not standard ALLOWED_TYPES
// but the fetcher is wired for future event types.
const ENERGY_SERIES = {
  'EIA Crude Oil Inventories': { eia: 'PET.WCESTUS1.W', unit: 'mbbl', category: 'energy', lower_is_hotter: false, cross_asset: { OIL: '-', DXY: '0', SPY: '0' }, importance: 'medium' },
};

function seriesFor(type) {
  return SERIES_MAP[type] || ENERGY_SERIES[type] || null;
}

// The default affected-assets list for a category (used when an event lacks an
// explicit sensitivity list).
function affectedAssets(type) {
  const m = seriesFor(type);
  if (!m) return ['US10Y', 'DXY', 'SPY', 'VIX'];
  return Object.keys(m.cross_asset).filter((k) => m.cross_asset[k] !== '0');
}

module.exports = { SERIES_MAP, ENERGY_SERIES, HAWKISH, GROWTH, LABOR, seriesFor, affectedAssets };
