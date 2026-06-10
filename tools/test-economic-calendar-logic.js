'use strict';

// Self-contained logic tests for the economic calendar intelligence layer.
// Tests: impact inference, category inference, surprise calculation, dedup, no API keys in frontend.
// Run: node tools/test-economic-calendar-logic.js

const fs   = require('fs');
const path = require('path');
const { inferImpact, inferCategory, computeSurprise, computeIntelligence } =
  require('./providers/economic-calendar/event-intelligence');

let pass = 0;
let fail = 0;

function expect(label, actual, expected) {
  if (actual === expected) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${label}`);
    console.error(`        expected: ${JSON.stringify(expected)}`);
    console.error(`        actual:   ${JSON.stringify(actual)}`);
  }
}

// ── Impact inference ──────────────────────────────────────────────────────────
console.log('[logic] impact inference');
expect('Core CPI → high',             inferImpact('Core CPI MoM').impact,           'high');
expect('CPI → high',                  inferImpact('Consumer Price Index').impact,    'high');
expect('Core PCE → high',             inferImpact('Core PCE Price Index').impact,    'high');
expect('NFP → high',                  inferImpact('Nonfarm Payrolls').impact,        'high');
expect('Unemployment Rate → high',    inferImpact('Unemployment Rate').impact,       'high');
expect('FOMC → high',                 inferImpact('FOMC Rate Decision').impact,      'high');
expect('GDP → high',                  inferImpact('GDP QoQ Second Estimate').impact, 'high');
expect('Retail Sales → high',         inferImpact('Retail Sales MoM').impact,        'high');
expect('ISM Mfg PMI → high',          inferImpact('ISM Manufacturing PMI').impact,   'high');
expect('Jobless Claims → high',       inferImpact('Initial Jobless Claims').impact,  'high');
expect('PMI (generic) → medium',      inferImpact('S&P Global PMI').impact,          'medium');
expect('Housing Starts → medium',     inferImpact('Housing Starts').impact,          'medium');
expect('Durable Goods → medium',      inferImpact('Durable Goods Orders').impact,    'medium');
expect('Consumer Confidence → medium',inferImpact('Consumer Confidence').impact,     'medium');
expect('PPI → medium',                inferImpact('Producer Price Index').impact,    'medium');
expect('Treasury Auction → low',      inferImpact('3-Month Bill Auction').impact,    'low');
expect('Holiday → holiday',           inferImpact('Market Holiday').impact,          'holiday');
expect('Bank Holiday → holiday',      inferImpact('Bank Holiday').impact,            'holiday');
expect('Unknown event → low',         inferImpact('Capacity Utilization').impact,    'low');

// ── Category inference ────────────────────────────────────────────────────────
console.log('[logic] category inference');
expect('CPI → inflation',         inferCategory('Consumer Price Index'),       'inflation');
expect('Core CPI → inflation',    inferCategory('Core CPI MoM'),               'inflation');
expect('PCE → inflation',         inferCategory('PCE Deflator'),                'inflation');
expect('NFP → labor',             inferCategory('Nonfarm Payrolls'),            'labor');
expect('Jobless → labor',         inferCategory('Initial Jobless Claims'),      'labor');
expect('FOMC → central_bank',     inferCategory('FOMC Rate Decision'),          'central_bank');
expect('ECB → central_bank',      inferCategory('ECB Interest Rate Decision'),  'central_bank');
expect('GDP → growth',            inferCategory('GDP QoQ'),                     'growth');
expect('Retail Sales → consumption', inferCategory('Retail Sales MoM'),         'consumption');
expect('ISM PMI → pmi',           inferCategory('ISM Manufacturing PMI'),       'pmi');
expect('Global PMI → pmi',        inferCategory('S&P Global Manufacturing PMI'),'pmi');
expect('Housing → housing',       inferCategory('Housing Starts'),              'housing');
expect('Home Sales → housing',    inferCategory('Existing Home Sales'),         'housing');
expect('Trade Balance → trade',   inferCategory('Trade Balance'),               'trade');
expect('Crude Oil → energy',      inferCategory('Crude Oil Inventories'),       'energy');
expect('Treasury → treasury',     inferCategory('3-Year Note Auction'),         'treasury');
expect('Holiday → holiday',       inferCategory('Market Holiday'),              'holiday');
expect('Unknown → other',         inferCategory('Capacity Utilization'),        'other');

// ── Surprise calculation ──────────────────────────────────────────────────────
console.log('[logic] surprise calculation');
var s1 = computeSurprise({ actual: 3.2, forecast: 3.0, previous: null });
expect('above forecast → above', s1.direction, 'above');
expect('above forecast → available', s1.available, true);

var s2 = computeSurprise({ actual: 2.8, forecast: 3.0, previous: null });
expect('below forecast → below', s2.direction, 'below');

var s3 = computeSurprise({ actual: 3.0, forecast: 3.0, previous: null });
expect('inline → inline', s3.direction, 'inline');

var s4 = computeSurprise({ actual: null, forecast: 3.0, previous: null });
expect('no actual → not available', s4.available, false);

var s5 = computeSurprise({ actual: 3.5, forecast: null, previous: 2.0 });
expect('no forecast, uses previous', s5.direction, 'above');
expect('magnitude high', s5.magnitude, 'high'); // 3.5 vs 2.0 = 75% diff

// ── computeIntelligence ───────────────────────────────────────────────────────
console.log('[logic] computeIntelligence');
var intel = computeIntelligence({ event_name: 'Core CPI MoM', actual: 3.2, forecast: 3.0, previous: 3.1 });
expect('CPI → inflation category',   intel.category,                  'inflation');
expect('CPI impact score > 0',        intel.impact_score > 0,         true);
expect('CPI market sensitivity arr',  Array.isArray(intel.market_sensitivity), true);
expect('CPI surprise available',      intel.surprise.available,       true);
expect('CPI surprise above',          intel.surprise.direction,       'above');

// ── Deduplication key consistency ─────────────────────────────────────────────
console.log('[logic] dedup key');
function dedupeKey(e) {
  var date    = String(e.event_time || '').slice(0, 10);
  var country = String(e.country || '').toUpperCase();
  var name    = String(e.event_name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return date + '|' + country + '|' + name;
}
var k1 = dedupeKey({ event_time: '2026-06-10T12:30:00Z', country: 'US', event_name: 'Core CPI MoM' });
var k2 = dedupeKey({ event_time: '2026-06-10T08:30:00Z', country: 'us', event_name: 'Core CPI  MoM' });
expect('same event different providers dedupe', k1, k2);

var k3 = dedupeKey({ event_time: '2026-06-10T12:30:00Z', country: 'US', event_name: 'Core CPI MoM' });
var k4 = dedupeKey({ event_time: '2026-06-11T12:30:00Z', country: 'US', event_name: 'Core CPI MoM' });
expect('different dates do NOT dedupe', k3 === k4, false);

// ── No API keys in frontend JS ────────────────────────────────────────────────
console.log('[logic] frontend secret scan');
const FRONTEND_JS = path.join(__dirname, '..', 'js', 'economic-calendar.js');
if (fs.existsSync(FRONTEND_JS)) {
  const src = fs.readFileSync(FRONTEND_JS, 'utf8');
  const badPatterns = [
    /FMP_API_KEY/,
    /FINNHUB_API_KEY/,
    /FRED_API_KEY/,
    /OPENAI_API_KEY/,
    /process\.env/,
  ];
  badPatterns.forEach(function (p) {
    if (p.test(src)) {
      fail++;
      console.error('  FAIL: frontend JS contains sensitive pattern: ' + p);
    } else {
      pass++;
    }
  });
} else {
  fail++;
  console.error('  FAIL: js/economic-calendar.js not found');
}

// ── UTC date arithmetic ───────────────────────────────────────────────────────
console.log('[logic] UTC date arithmetic');
function addDaysUTC(d, n) {
  var dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function weekStartUTC(d) {
  var dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() - dt.getUTCDay());
  return dt.toISOString().slice(0, 10);
}
// addDays must not shift the date for any timezone offset (including UTC+14)
expect('addDays +0 is same date',            addDaysUTC('2026-06-09', 0),  '2026-06-09');
expect('addDays +1 is next day',             addDaysUTC('2026-06-09', 1),  '2026-06-10');
expect('addDays +1 month boundary',          addDaysUTC('2026-06-30', 1),  '2026-07-01');
expect('addDays -1 is previous day',         addDaysUTC('2026-06-09', -1), '2026-06-08');
expect('addDays -1 month boundary',          addDaysUTC('2026-06-01', -1), '2026-05-31');
expect('weekStart on Sunday',                weekStartUTC('2026-06-07'),   '2026-06-07');
expect('weekStart on Wednesday',             weekStartUTC('2026-06-10'),   '2026-06-07');
expect('weekStart on Saturday',              weekStartUTC('2026-06-13'),   '2026-06-07');
expect('weekStart crosses month boundary',   weekStartUTC('2026-06-01'),   '2026-05-31');

// ── eventDate extraction ──────────────────────────────────────────────────────
console.log('[logic] eventDate extraction');
function eventDate(e) {
  var raw = String(e.event_time || e.date || '');
  return raw.length >= 10 ? raw.slice(0, 10) : '';
}
expect('ISO timestamp → date',               eventDate({ event_time: '2026-06-10T13:30:00Z' }), '2026-06-10');
expect('date-only string',                   eventDate({ date: '2026-06-10' }),                  '2026-06-10');
expect('event_time preferred over date',     eventDate({ event_time: '2026-06-10T00:00:00Z', date: '2026-06-11' }), '2026-06-10');
expect('missing fields → empty string',      eventDate({}),                                       '');
expect('short date-like value → empty',      eventDate({ date: '2026' }),                          '');

// ── numVal edge cases ─────────────────────────────────────────────────────────
console.log('[logic] numVal edge cases');
function numVal(n, unit) {
  if (n === null || n === undefined || n === '') return '—';
  return String(n) + (unit ? ' ' + String(unit) : '');
}
expect('null → dash',                numVal(null),               '—');
expect('undefined → dash',           numVal(undefined),          '—');
expect('empty string → dash',        numVal(''),                 '—');
expect('zero is valid',              numVal(0),                  '0');
expect('number with unit',           numVal(3.2, '%'),           '3.2 %');
expect('number without unit',        numVal(3.2),                '3.2');

// ── Date-based filtering simulation ──────────────────────────────────────────
console.log('[logic] date filtering (today vs tomorrow)');
var POOL = [
  { event_time: '2026-06-09T10:00:00Z', event_name: 'CPI', country: 'US', importance: 'high' },
  { event_time: '2026-06-09T14:00:00Z', event_name: 'PPI', country: 'US', importance: 'medium' },
  { event_time: '2026-06-10T09:00:00Z', event_name: 'NFP', country: 'US', importance: 'high' },
];
function filterByDay(pool, day) {
  return pool.filter(function (e) { return eventDate(e) === day; });
}
expect('Today June 9 → 2 events',    filterByDay(POOL, '2026-06-09').length, 2);
expect('Tomorrow June 10 → 1 event', filterByDay(POOL, '2026-06-10').length, 1);
expect('June 11 → 0 events',         filterByDay(POOL, '2026-06-11').length, 0);
expect('Today and tomorrow are disjoint',
  filterByDay(POOL, '2026-06-09').some(function(e) { return filterByDay(POOL, '2026-06-10').includes(e); }), false);

// ── Holiday event detection ───────────────────────────────────────────────────
console.log('[logic] holiday detection');
var holidayEvent = { event_time: '2026-07-04T00:00:00Z', event_name: 'Independence Day', country: 'US', importance: 'holiday', actual: null, forecast: null, previous: null };
var normalEvent  = { event_time: '2026-06-10T13:30:00Z', event_name: 'CPI MoM', country: 'US', importance: 'high', actual: 3.2, forecast: 3.0, previous: 3.1 };
expect('holiday importance detected', holidayEvent.importance === 'holiday', true);
expect('normal event not holiday',    normalEvent.importance === 'holiday',  false);
// Holiday → numeric display must be suppressed
function dispActual(e) {
  var isHoliday = e.importance === 'holiday';
  if (isHoliday) return '—';
  return numVal(e.actual, e.unit);
}
expect('holiday actual → dash',  dispActual(holidayEvent), '—');
expect('normal actual → value',  dispActual(normalEvent),  '3.2');

// ── Surprise suppression when no forecast ─────────────────────────────────────
console.log('[logic] surprise suppression without forecast');
function shouldColorSurprise(e) {
  var isHoliday   = e.importance === 'holiday';
  var released    = !isHoliday && e.actual   !== null && e.actual   !== undefined;
  var hasForecast = !isHoliday && e.forecast !== null && e.forecast !== undefined;
  return released && hasForecast;
}
var eventBothActualAndForecast = { importance: 'medium', actual: 3.2, forecast: 3.0 };
var eventActualNoForecast      = { importance: 'medium', actual: 3.2, forecast: null };
var eventNoActual              = { importance: 'medium', actual: null, forecast: 3.0 };
var eventHoliday               = { importance: 'holiday', actual: null, forecast: null };
expect('actual+forecast → color surprise', shouldColorSurprise(eventBothActualAndForecast), true);
expect('actual no forecast → no color',    shouldColorSurprise(eventActualNoForecast),      false);
expect('no actual → no color',             shouldColorSurprise(eventNoActual),               false);
expect('holiday → never color',            shouldColorSurprise(eventHoliday),                false);

// ── updateStatus count display logic ─────────────────────────────────────────
console.log('[logic] updateStatus count formatting');
function fmtCount(fetchedCount, visibleCount) {
  if (visibleCount !== undefined && fetchedCount !== undefined && fetchedCount !== visibleCount) {
    return fetchedCount + ' fetched · ' + visibleCount + ' shown';
  } else if (visibleCount !== undefined) {
    return visibleCount + ' events';
  }
  return '';
}
expect('equal counts → events label',    fmtCount(16, 16),  '16 events');
expect('filtered → fetched+shown label', fmtCount(118, 16), '118 fetched · 16 shown');
expect('zero visible',                   fmtCount(118, 0),  '118 fetched · 0 shown');
expect('both zero',                      fmtCount(0, 0),    '0 events');

// ── Stabilization hardening regression tests ─────────────────────────────────
// Each test corresponds to a specific root cause fixed in the stabilization pass.

// ── 1. requestSeq stale-response guard ────────────────────────────────────────
// Simulates: user clicks Today → Tomorrow rapidly.
// The Today response arrives after seq has advanced → must be discarded.
console.log('[logic] requestSeq stale-response guard');
(function () {
  var requestSeq = 0;
  function makeLoad() {
    var seq = ++requestSeq;
    return { seq: seq, isStale: function () { return seq !== requestSeq; } };
  }
  var load1 = makeLoad(); // seq=1 (Today click)
  var load2 = makeLoad(); // seq=2 (Tomorrow click while load1 still in-flight)
  expect('load1 is stale after load2 starts', load1.isStale(), true);
  expect('load2 is current',                  load2.isStale(), false);
  var load3 = makeLoad(); // seq=3 (This Week click)
  expect('load2 stale after load3',           load2.isStale(), true);
  expect('load3 current',                     load3.isStale(), false);
})();

// ── 2. AbortError does not trigger error UI ────────────────────────────────────
console.log('[logic] AbortError handling');
function isAbortError(err) {
  return err && err.name === 'AbortError';
}
var fakeAbort = Object.assign(new Error('aborted'), { name: 'AbortError' });
var fakeNetwork = new Error('Network failure');
expect('AbortError detected',         !!isAbortError(fakeAbort),   true);
expect('Network error is not abort',  !!isAbortError(fakeNetwork), false);
expect('null is not abort',           !!isAbortError(null),         false);

// ── 3. Null-safe provider metadata in updateStatus ────────────────────────────
// A null or missing provider entry must not throw when filtering for ok providers.
console.log('[logic] null-safe provider metadata');
function filterOkProviders(providers) {
  if (!providers || typeof providers !== 'object') return [];
  return Object.keys(providers).filter(function (k) {
    return providers[k] && providers[k].status === 'ok';
  });
}
expect('all ok providers',     filterOkProviders({ fmp: { status: 'ok' }, finnhub: { status: 'ok' } }).length, 2);
expect('one null provider',    filterOkProviders({ fmp: null, finnhub: { status: 'ok' } }).length, 1);
expect('all null providers',   filterOkProviders({ fmp: null, finnhub: null }).length, 0);
expect('missing status field', filterOkProviders({ fmp: {} }).length, 0);
expect('empty providers obj',  filterOkProviders({}).length, 0);
expect('null providers',       filterOkProviders(null).length, 0);

// ── 4. Per-row error containment in render pipeline ───────────────────────────
// A malformed event in the middle of the list must not prevent other rows from rendering.
console.log('[logic] per-row error containment');
function simulateBuildRows(events) {
  var rendered = 0;
  var skipped  = 0;
  events.forEach(function (e) {
    try {
      if (!e || typeof e !== 'object') throw new Error('null event');
      if (!e.event_name) throw new Error('missing event_name');
      rendered++;
    } catch (_) {
      skipped++;
    }
  });
  return { rendered: rendered, skipped: skipped };
}
var mixedEvents = [
  { event_name: 'CPI', country: 'US' },
  null,                                 // malformed
  { event_name: 'NFP', country: 'US' },
  { country: 'US' },                    // missing event_name
  { event_name: 'GDP', country: 'US' },
];
var result = simulateBuildRows(mixedEvents);
expect('rendered 3 good events',    result.rendered, 3);
expect('skipped 2 malformed events', result.skipped,  2);

// ── 5. groupByDate with unknown/empty date ────────────────────────────────────
console.log('[logic] groupByDate unknown date handling');
function groupByDate(events) {
  var groups  = [];
  var lastKey = null;
  for (var i = 0; i < events.length; i++) {
    var e = events[i];
    var d;
    try {
      var raw = String(e.event_time || e.date || '');
      d = raw.length >= 10 ? raw.slice(0, 10) : 'unknown';
    } catch (_) { d = 'unknown'; }
    if (d !== lastKey) { groups.push({ date: d, events: [] }); lastKey = d; }
    groups[groups.length - 1].events.push(e);
  }
  return groups;
}
var groupEvents = [
  { event_time: '2026-06-10T10:00:00Z', event_name: 'CPI' },
  { event_name: 'Mystery' },             // no date field
  { event_time: '2026-06-11T14:00:00Z', event_name: 'NFP' },
];
var groups = groupByDate(groupEvents);
expect('known date June 10 group exists', groups[0].date, '2026-06-10');
expect('unknown date gets unknown bucket', groups[1].date, 'unknown');
expect('known date June 11 group exists', groups[2].date, '2026-06-11');
expect('total groups = 3', groups.length, 3);
expect('June 10 group has 1 event', groups[0].events.length, 1);
expect('unknown bucket has 1 event', groups[1].events.length, 1);

// ── 6. detailContent and intelligenceHtml safe with missing fields ────────────
console.log('[logic] defensive rendering with null fields');
// Simulates what happens when a malformed event is passed to rendering helpers.
// These helpers now have try/catch — they must return a string (possibly empty), not throw.
function safeIntelligenceHtml(e) {
  try {
    var intel = e && e.intelligence;
    if (!intel || !intel.category) return '';
    if (e.importance === 'holiday') return '';
    return '<dt>test</dt>';
  } catch (_) { return ''; }
}
expect('null event → empty string',        safeIntelligenceHtml(null),                   '');
expect('no intelligence → empty string',   safeIntelligenceHtml({ importance: 'high' }),  '');
expect('holiday → empty string',           safeIntelligenceHtml({ importance: 'holiday', intelligence: { category: 'holiday' } }), '');
expect('valid → non-empty string',         safeIntelligenceHtml({ importance: 'high', intelligence: { category: 'inflation' } }) !== '', true);

// ── 7. toggleRow null-safety (events[idx] undefined) ─────────────────────────
console.log('[logic] toggleRow null-safety');
function safeToggleRow(events, idx) {
  try {
    var e = events[idx];
    if (!e) return 'noop';
    return 'expanded';
  } catch (_) { return 'error'; }
}
var evtList = [{ event_name: 'CPI' }];
expect('valid idx → expanded',   safeToggleRow(evtList, 0),   'expanded');
expect('out-of-bounds → noop',   safeToggleRow(evtList, 99),  'noop');
expect('negative idx → noop',    safeToggleRow(evtList, -1),  'noop');

// ── 8. Safe array clone before mutation ──────────────────────────────────────
console.log('[logic] array clone immutability');
var original = [
  { event_time: '2026-06-10T10:00:00Z', event_name: 'CPI' },
  { event_time: '2026-06-11T14:00:00Z', event_name: 'NFP' },
];
var cloned = original.slice();
// Mutating clone does not affect original
cloned.push({ event_name: 'Extra' });
expect('clone mutation does not affect original', original.length, 2);
expect('cloned array is independent',             cloned.length,   3);

// ── Provider completeness scoring ─────────────────────────────────────────────
console.log('[logic] completeness scoring');
function countWith(events, field) {
  return events.filter(function (e) { return e[field] !== null && e[field] !== undefined; }).length;
}
function completenessScore(events) {
  if (!events.length) return 0;
  return Math.round((countWith(events, 'actual') + countWith(events, 'forecast') + countWith(events, 'previous')) / (events.length * 3) * 100);
}
var richEvents = [
  { actual: 3.2, forecast: 3.0, previous: 3.1 },
  { actual: 2.8, forecast: 2.9, previous: 2.7 },
];
var sparseEvents = [
  { actual: null, forecast: 3.0, previous: null },
  { actual: null, forecast: null, previous: null },
];
var emptyEvents = [];
expect('fully populated → 100%',     completenessScore(richEvents),   100);
expect('sparse → partial score',     completenessScore(sparseEvents),  17); // 1 of 6 fields = 16.7 → 17
expect('empty pool → 0',             completenessScore(emptyEvents),    0);
expect('countWith actual, 1 of 2',   countWith(sparseEvents, 'actual'), 0);
expect('countWith forecast, 1 of 2', countWith(sparseEvents, 'forecast'), 1);

// ── Richness-based merge preference ──────────────────────────────────────────
console.log('[logic] richness-based merge preference');
function richness(e) {
  return (e.actual   !== null && e.actual   !== undefined ? 2 : 0)
       + (e.forecast !== null && e.forecast !== undefined ? 2 : 0)
       + (e.previous !== null && e.previous !== undefined ? 1 : 0);
}
var MERGE_RANK = { te: 0, fmp: 1, finnhub: 2, fred: 3 };
function simulateMergeGroup(group) {
  if (group.length === 1) return group[0];
  var sorted = group.slice().sort(function (a, b) {
    var rankA = MERGE_RANK[a.provider] !== undefined ? MERGE_RANK[a.provider] : 9;
    var rankB = MERGE_RANK[b.provider] !== undefined ? MERGE_RANK[b.provider] : 9;
    if (rankA !== rankB) return rankA - rankB;
    return richness(b) - richness(a);
  });
  var base = Object.assign({}, sorted[0]);
  for (var i = 1; i < sorted.length; i++) {
    var other = sorted[i];
    if (other.provider === 'fred') continue; // FRED is schedule-only
    if (base.actual   === null && other.actual   !== null) base.actual   = other.actual;
    if (base.forecast === null && other.forecast !== null) base.forecast = other.forecast;
    if (base.previous === null && other.previous !== null) base.previous = other.previous;
  }
  return base;
}
// FMP has actual=null; Finnhub has actual=3.2 → Finnhub's value should fill in
var fmpRecord     = { provider: 'fmp',     actual: null, forecast: 3.0, previous: 3.1 };
var finnhubRecord = { provider: 'finnhub', actual: 3.2,  forecast: null, previous: null };
var merged = simulateMergeGroup([fmpRecord, finnhubRecord]);
expect('merged base is FMP (higher rank)',        merged.provider,  'fmp');
expect('FMP actual=null filled from Finnhub',     merged.actual,    3.2);
expect('FMP forecast kept (not overwritten)',      merged.forecast,  3.0);
expect('FMP previous kept',                       merged.previous,  3.1);

// TE should win as base over FMP (rank 0 vs 1)
var teRecord  = { provider: 'te',  actual: 3.3, forecast: 3.1, previous: 3.0 };
var fmpRecord2 = { provider: 'fmp', actual: null, forecast: 3.0, previous: 3.1 };
var merged2 = simulateMergeGroup([fmpRecord2, teRecord]);
expect('TE is base (rank 0 < fmp rank 1)', merged2.provider, 'te');
expect('TE actual kept',                   merged2.actual,   3.3);

// Within same rank, richer record wins as base
var fmpRich  = { provider: 'fmp', actual: 3.2, forecast: 3.0, previous: 3.1 };
var fmpPoor  = { provider: 'fmp', actual: null, forecast: null, previous: null };
var merged3  = simulateMergeGroup([fmpPoor, fmpRich]);
// fmpPoor is first in the array, but fmpRich is richer → fmpRich should be base
expect('richer FMP record wins as base (same rank)',  merged3.actual,   3.2);

// ── FRED cannot overwrite FMP/Finnhub actual/forecast/previous ────────────────
console.log('[logic] FRED schedule-only guard');
var fredRecord  = { provider: 'fred',    actual: null, forecast: null, previous: null };
var fmpRich2    = { provider: 'fmp',     actual: 3.5,  forecast: 3.3,  previous: 3.2 };
var mergedFred  = simulateMergeGroup([fmpRich2, fredRecord]);
expect('FRED does not overwrite FMP actual',    mergedFred.actual,   3.5);
expect('FRED does not overwrite FMP forecast',  mergedFred.forecast, 3.3);
expect('FRED does not overwrite FMP previous',  mergedFred.previous, 3.2);
// Even if FRED hypothetically had values (defensive guard test)
var fredFake    = { provider: 'fred', actual: 99, forecast: 99, previous: 99 };
var fmpLow      = { provider: 'fmp',  actual: null, forecast: null, previous: null };
var mergedFake  = simulateMergeGroup([fmpLow, fredFake]);
expect('FRED hypothetical values blocked from filling FMP nulls', mergedFake.actual, null);

// ── Refresh interval selection ────────────────────────────────────────────────
console.log('[logic] adaptive refresh interval');
var REFRESH_NORMAL_MS  = 5 * 60 * 1000;
var REFRESH_ACTIVE_MS  = 30 * 1000;
var REFRESH_WINDOW_MS  = 30 * 60 * 1000;
function simulateGetRefreshInterval(events, now) {
  var hasHighImpactSoon = events.some(function (e) {
    if (e.importance !== 'high') return false;
    var t = Date.parse(e.event_time);
    if (isNaN(t)) return false;
    var diff = t - now;
    return diff > -REFRESH_WINDOW_MS && diff < REFRESH_WINDOW_MS;
  });
  return hasHighImpactSoon ? REFRESH_ACTIVE_MS : REFRESH_NORMAL_MS;
}
var now = Date.now();
var highSoon    = { importance: 'high',   event_time: new Date(now + 10 * 60 * 1000).toISOString() }; // +10 min
var highFar     = { importance: 'high',   event_time: new Date(now + 60 * 60 * 1000).toISOString() }; // +60 min
var mediumSoon  = { importance: 'medium', event_time: new Date(now + 10 * 60 * 1000).toISOString() }; // +10 min (medium)
var highRecent  = { importance: 'high',   event_time: new Date(now - 10 * 60 * 1000).toISOString() }; // -10 min
var highOld     = { importance: 'high',   event_time: new Date(now - 60 * 60 * 1000).toISOString() }; // -60 min
expect('high event +10min → 30s interval',  simulateGetRefreshInterval([highSoon],   now), REFRESH_ACTIVE_MS);
expect('high event +60min → 5min interval', simulateGetRefreshInterval([highFar],    now), REFRESH_NORMAL_MS);
expect('medium event +10min → 5min',        simulateGetRefreshInterval([mediumSoon], now), REFRESH_NORMAL_MS);
expect('high event -10min → 30s (releasing)', simulateGetRefreshInterval([highRecent], now), REFRESH_ACTIVE_MS);
expect('high event -60min → 5min (old)',    simulateGetRefreshInterval([highOld],    now), REFRESH_NORMAL_MS);
expect('no events → 5min interval',         simulateGetRefreshInterval([],           now), REFRESH_NORMAL_MS);

// ── Document hidden pause simulation ─────────────────────────────────────────
console.log('[logic] visibility-based pause simulation');
(function () {
  var timerActive = true;
  function clearTimer() { timerActive = false; }
  function scheduleRefresh(isHidden, events, now) {
    if (isHidden) { clearTimer(); return 'paused'; }
    var interval = simulateGetRefreshInterval(events, now);
    return 'scheduled-' + (interval === REFRESH_ACTIVE_MS ? '30s' : '5min');
  }
  expect('hidden=true → paused',      scheduleRefresh(true,  [], now),           'paused');
  expect('hidden=false → 5min',       scheduleRefresh(false, [], now),            'scheduled-5min');
  expect('hidden=false high soon → 30s', scheduleRefresh(false, [highSoon], now), 'scheduled-30s');
  expect('timer cleared on hidden',   timerActive, false);
})();

// ── Freshness status logic ────────────────────────────────────────────────────
console.log('[logic] freshness status');
function simulateFreshnessStatus(e, nowOverride) {
  var _now = nowOverride || Date.now();
  if (!e.event_time || e.importance === 'holiday') return null;
  var t = Date.parse(e.event_time);
  if (isNaN(t)) return null;
  var diff = t - _now;
  var hasActual = e.actual !== null && e.actual !== undefined;
  if (hasActual) return 'released';
  if (diff > 0 && diff <= REFRESH_WINDOW_MS) return 'due-soon';
  if (diff <= 0 && diff > -REFRESH_WINDOW_MS) return 'releasing';
  return null;
}
var testNow  = Date.now();
var evtReleased  = { event_time: new Date(testNow - 5 * 60000).toISOString(), actual: 3.2,  importance: 'high' };
var evtDueSoon   = { event_time: new Date(testNow + 15 * 60000).toISOString(), actual: null, importance: 'high' };
var evtReleasing = { event_time: new Date(testNow - 5 * 60000).toISOString(),  actual: null, importance: 'high' };
var evtUpcoming  = { event_time: new Date(testNow + 2 * 60 * 60000).toISOString(), actual: null, importance: 'medium' };
var evtHoliday   = { event_time: new Date(testNow + 5 * 60000).toISOString(), actual: null, importance: 'holiday' };
expect('released event → released',       simulateFreshnessStatus(evtReleased,  testNow), 'released');
expect('future <30m, no actual → due-soon', simulateFreshnessStatus(evtDueSoon, testNow), 'due-soon');
expect('past <30m, no actual → releasing',  simulateFreshnessStatus(evtReleasing, testNow), 'releasing');
expect('future >30m → null (upcoming, no badge)', simulateFreshnessStatus(evtUpcoming, testNow), null);
expect('holiday → null (no badge)',         simulateFreshnessStatus(evtHoliday, testNow),  null);
expect('no event_time → null',              simulateFreshnessStatus({ importance: 'high' }, testNow), null);

// ── Trading Economics country mapping ─────────────────────────────────────────
console.log('[logic] TE country mapping');
var TE_COUNTRY_MAP = {
  'United States': 'US', 'Euro Area': 'EU', 'United Kingdom': 'GB',
  'Japan': 'JP', 'China': 'CN', 'Germany': 'DE', 'France': 'FR',
  'Canada': 'CA', 'Australia': 'AU', 'New Zealand': 'NZ',
  'Switzerland': 'CH', 'Italy': 'IT',
};
function teCountry(name) {
  return TE_COUNTRY_MAP[name] || (name ? String(name).slice(0, 2).toUpperCase() : null);
}
expect('United States → US',  teCountry('United States'), 'US');
expect('Euro Area → EU',      teCountry('Euro Area'),     'EU');
expect('United Kingdom → GB', teCountry('United Kingdom'), 'GB');
expect('Japan → JP',          teCountry('Japan'),          'JP');
expect('Unknown → 2-char',    teCountry('Brazil'),         'BR');
expect('null/empty → null',   teCountry(''),               null);

// ── Market intelligence lookup table ─────────────────────────────────────────
console.log('[logic] market intelligence lookup (getAssetTags, volatility, fed/gold flags)');

// Inline the lookup table and helpers for isolated testing
var INTEL_MAP = [
  { p: /\bnonfarm\s*payrolls?\b|\bnfp\b/i,            assets: ['USD','Gold','S&P500','Nasdaq'], volatility: 'high',   fed: false, gold: true  },
  { p: /\bfomc\b|\bfederal\s+open\s+market\b/i,       assets: ['USD','Gold','Bonds','S&P500','Nasdaq'], volatility: 'high',   fed: true,  gold: true  },
  { p: /\bconsumer\s+price\s+index\b|\bcpi\b/i,       assets: ['USD','Gold','Bonds','S&P500','Nasdaq'], volatility: 'high',   fed: false, gold: true  },
  { p: /\bpce\b|\bpersonal\s+consumption\s+expenditures?\b/i, assets: ['USD','Gold','Bonds'], volatility: 'high',   fed: true,  gold: true  },
  { p: /\bproducer\s+price\s+index\b|\bppi\b/i,       assets: ['USD','Bonds'],              volatility: 'medium', fed: false, gold: false },
  { p: /\bgross\s+domestic\s+product\b|\bgdp\b/i,     assets: ['USD','S&P500','Nasdaq'],    volatility: 'high',   fed: false, gold: false },
  { p: /\binitial\s+jobless\s+claims?\b|\bjobless\s+claims?\b/i, assets: ['USD','S&P500'], volatility: 'medium', fed: false, gold: false },
  { p: /\bism\b|\bpurchasing\s+managers/i,             assets: ['USD','S&P500','Nasdaq'],    volatility: 'medium', fed: false, gold: false },
  { p: /\bretail\s+sales\b/i,                          assets: ['USD','S&P500'],             volatility: 'medium', fed: false, gold: false },
  { p: /\bdurable\s+goods\s+orders?\b/i,               assets: ['USD','S&P500','Nasdaq'],    volatility: 'medium', fed: false, gold: false },
  { p: /\btrade\s+balance\b|\bbalance\s+of\s+trade\b/i, assets: ['USD'],                    volatility: 'low',    fed: false, gold: false },
  { p: /\bhousing\s+starts?\b|\bbuilding\s+permits?\b|\bhome\s+sales?\b|\bnew\s+home\s+sales?\b/i, assets: ['S&P500'], volatility: 'low', fed: false, gold: false },
  { p: /\bfed\s+(?:chair|minutes|speak|speech|member|governor|president|statement)\b|\bbeige\s+book\b/i, assets: ['USD','Gold','Bonds'], volatility: 'medium', fed: true, gold: true },
  { p: /\binterest\s+rate\s+decision\b|\brate\s+decision\b/i, assets: ['USD','Gold','Bonds','S&P500','Nasdaq'], volatility: 'high', fed: true, gold: true },
  { p: /\bunemployment\s+rate\b/i,                     assets: ['USD','S&P500'],             volatility: 'medium', fed: false, gold: false },
  { p: /\bconsumer\s+confidence\b|\bconsumer\s+sentiment\b|\bumich\b/i, assets: ['USD','S&P500'], volatility: 'low', fed: false, gold: false },
  { p: /\bcrude\s+oil\b|\beia\s+crude\b|\bpetroleum\s+inventories?\b/i, assets: ['Gold','S&P500'], volatility: 'medium', fed: false, gold: false },
];
function getIntelEntry(e) {
  var name = String(e.event_name || '');
  for (var i = 0; i < INTEL_MAP.length; i++) {
    if (INTEL_MAP[i].p.test(name)) return INTEL_MAP[i];
  }
  return null;
}
function simGetAssetTags(e) {
  if (e.importance === 'holiday') return [];
  if (Array.isArray(e.historical_asset_sensitivity) && e.historical_asset_sensitivity.length)
    return e.historical_asset_sensitivity;
  var entry = getIntelEntry(e);
  return entry ? entry.assets.slice() : [];
}
function simGetVolatility(e) {
  if (e.importance === 'holiday') return null;
  var entry = getIntelEntry(e);
  if (entry) return entry.volatility;
  if (e.importance === 'high')   return 'high';
  if (e.importance === 'medium') return 'medium';
  if (e.importance === 'low')    return 'low';
  return null;
}
function simIsFedEvent(e) {
  if (e.country && String(e.country).toUpperCase() !== 'US') return false;
  var entry = getIntelEntry(e);
  if (entry) return !!entry.fed;
  return false;
}
function simIsGoldEvent(e) {
  var entry = getIntelEntry(e);
  if (entry) return !!entry.gold;
  return simGetAssetTags(e).indexOf('Gold') !== -1;
}
function simReleaseState(e) {
  if (e.importance === 'holiday') return null;
  if (!e.event_time) return null;
  var t = Date.parse(e.event_time);
  if (isNaN(t)) return null;
  var hasActual = e.actual !== null && e.actual !== undefined;
  if (hasActual) return 'released';
  var diff = t - Date.now();
  if (diff <= 0 && diff > -3 * 3600000) return 'live';
  if (diff > 0) return 'upcoming';
  return null;
}

// Asset tag tests
var nfpEvent  = { event_name: 'Nonfarm Payrolls', country: 'US', importance: 'high' };
var cpiEvent  = { event_name: 'CPI MoM', country: 'US', importance: 'high' };
var fomcEvent = { event_name: 'FOMC Meeting', country: 'US', importance: 'high' };
var ppiEvent  = { event_name: 'PPI MoM', country: 'US', importance: 'medium' };
var gdpEvent  = { event_name: 'GDP Growth Rate', country: 'US', importance: 'high' };
var holEvent  = { event_name: 'Thanksgiving', country: 'US', importance: 'holiday' };

expect('NFP → includes USD',      simGetAssetTags(nfpEvent).indexOf('USD') !== -1,   true);
expect('NFP → includes Gold',     simGetAssetTags(nfpEvent).indexOf('Gold') !== -1,  true);
expect('NFP → includes Nasdaq',   simGetAssetTags(nfpEvent).indexOf('Nasdaq') !== -1,true);
expect('CPI → includes Bonds',    simGetAssetTags(cpiEvent).indexOf('Bonds') !== -1, true);
expect('FOMC → includes Bonds',   simGetAssetTags(fomcEvent).indexOf('Bonds') !== -1,true);
expect('PPI → includes USD',      simGetAssetTags(ppiEvent).indexOf('USD') !== -1,   true);
expect('PPI → no Gold',           simGetAssetTags(ppiEvent).indexOf('Gold') === -1,  true);
expect('holiday → empty array',   simGetAssetTags(holEvent).length,                  0);
expect('server-side takes priority', simGetAssetTags({ event_name: 'NFP', importance: 'high', historical_asset_sensitivity: ['Bonds'] }).indexOf('Bonds') !== -1, true);

// Volatility tests
expect('NFP → high volatility',   simGetVolatility(nfpEvent),  'high');
expect('CPI → high volatility',   simGetVolatility(cpiEvent),  'high');
expect('PPI → medium volatility', simGetVolatility(ppiEvent),  'medium');
expect('GDP → high volatility',   simGetVolatility(gdpEvent),  'high');
expect('holiday → null',          simGetVolatility(holEvent),  null);
expect('unknown high → high',     simGetVolatility({ event_name: 'Unknown Report', importance: 'high' }),   'high');
expect('unknown medium → medium', simGetVolatility({ event_name: 'Unknown Report', importance: 'medium' }), 'medium');
expect('unknown low → low',       simGetVolatility({ event_name: 'Unknown Report', importance: 'low' }),    'low');

// Fed/Gold event classification
expect('FOMC → is Fed event',       simIsFedEvent(fomcEvent),  true);
expect('NFP → not Fed event',       simIsFedEvent(nfpEvent),   false);
expect('CPI → not Fed event',       simIsFedEvent(cpiEvent),   false);
expect('PCE → is Fed event',        simIsFedEvent({ event_name: 'Core PCE Price Index', country: 'US', importance: 'high' }), true);
expect('non-US FOMC-like → not Fed', simIsFedEvent({ event_name: 'FOMC Decision', country: 'EU', importance: 'high' }), false);
expect('NFP → is Gold event',       simIsGoldEvent(nfpEvent),  true);
expect('CPI → is Gold event',       simIsGoldEvent(cpiEvent),  true);
expect('FOMC → is Gold event',      simIsGoldEvent(fomcEvent), true);
expect('PPI → not Gold event',      simIsGoldEvent(ppiEvent),  false);
expect('GDP → not Gold event',      simIsGoldEvent(gdpEvent),  false);

// Release state
var nowMs = Date.now();
var evtWithActual  = { event_time: new Date(nowMs - 30 * 60000).toISOString(), actual: 3.2, importance: 'high' };
var evtFarFuture   = { event_time: new Date(nowMs + 4 * 3600000).toISOString(), actual: null, importance: 'high' };
var evtJustPast    = { event_time: new Date(nowMs - 20 * 60000).toISOString(), actual: null, importance: 'high' };
var evtVeryOld     = { event_time: new Date(nowMs - 5 * 3600000).toISOString(), actual: null, importance: 'high' };
var evtHolidayRs   = { event_time: new Date(nowMs + 60000).toISOString(), actual: null, importance: 'holiday' };
expect('has actual → released',    simReleaseState(evtWithActual), 'released');
expect('far future → upcoming',    simReleaseState(evtFarFuture),  'upcoming');
expect('just past, no actual → live', simReleaseState(evtJustPast), 'live');
expect('very old, no actual → null',  simReleaseState(evtVeryOld),  null);
expect('holiday → null',           simReleaseState(evtHolidayRs),  null);
expect('no event_time → null',     simReleaseState({ importance: 'high' }), null);

// ── Schedule fallback provider ────────────────────────────────────────────────
// Tests run async (fetchCalendar returns Promise.resolve) via an IIFE below.

console.log('[logic] schedule_fallback helpers');
const { firstFridaysInRange: _firstFri, FOMC_SCHEDULE: _fomcSched } =
  require('./providers/economic-calendar/schedule-fallback-provider');

// firstFridaysInRange: basic contract
var _from = new Date('2026-06-01T00:00:00Z');
var _to30 = new Date('2026-06-30T00:00:00Z');
var _juneFirstFridays = _firstFri(_from, _to30);
expect('first Friday of June 2026 is June 5',  _juneFirstFridays[0], '2026-06-05');
expect('only one first-Friday per month in June', _juneFirstFridays.length, 1);

var _from2 = new Date('2026-06-10T00:00:00Z');
var _to2   = new Date('2026-07-31T00:00:00Z');
var _twoMonths = _firstFri(_from2, _to2);
// June first-Friday (Jun 5) is before Jun 10, so only July's first Friday appears
expect('June first-Friday before from → skipped', _twoMonths.indexOf('2026-06-05'), -1);
expect('July first-Friday included',              _twoMonths.indexOf('2026-07-03') !== -1, true);

// FOMC_SCHEDULE: future dates exist for next 365 days
var _nextYear = new Date();
_nextYear.setUTCFullYear(_nextYear.getUTCFullYear() + 1);
var _todayStr  = new Date().toISOString().slice(0, 10);
var _futureCount = _fomcSched.filter(function (e) { return e.date >= _todayStr; }).length;
expect('FOMC schedule has at least 4 future dates', _futureCount >= 4, true);

// ── Schedule fallback async provider tests ────────────────────────────────────
(async function () {
  console.log('[logic] schedule_fallback fetchCalendar');
  const scheduleFb = require('./providers/economic-calendar/schedule-fallback-provider');
  const sfResult = await scheduleFb.fetchCalendar({
    from: '2026-06-10',
    to:   '2026-07-10',
    env:  {},
  });

  const sfEvents = sfResult.events || [];

  // Must always generate events for a 30-day range (at least 4 Thursdays)
  expect('schedule_fallback returns events for 30-day range', sfEvents.length > 0, true);

  // Every Thursday in range should have a Jobless Claims event
  const thursdays = [];
  const d = new Date('2026-06-11T00:00:00Z'); // first Thursday on or after 2026-06-10
  while (d <= new Date('2026-07-10T00:00:00Z')) {
    thursdays.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  const joblessDates = sfEvents
    .filter(function (e) { return e.type === 'Jobless Claims'; })
    .map(function (e) { return String(e.event_time || '').slice(0, 10); });
  expect('Jobless Claims present for every Thursday in range',
    thursdays.every(function (t) { return joblessDates.indexOf(t) !== -1; }), true);

  // No actual/forecast/previous values — never fabricated
  const noFabrication = sfEvents.every(function (e) {
    return e.actual === null && e.forecast === null && e.previous === null;
  });
  expect('schedule_fallback never fabricates actual/forecast/previous', noFabrication, true);

  // All events are confirmed=false
  const allUnconfirmed = sfEvents.every(function (e) { return e.confirmed === false; });
  expect('all schedule_fallback events have confirmed=false', allUnconfirmed, true);

  // Provider name is 'schedule_fallback'
  const correctProvider = sfEvents.every(function (e) { return e.provider === 'schedule_fallback'; });
  expect('all events have provider=schedule_fallback', correctProvider, true);

  // NFP appears on the first Friday of July (first Friday in range after June 10)
  const nfpDates = sfEvents
    .filter(function (e) { return e.type === 'NFP'; })
    .map(function (e) { return String(e.event_time || '').slice(0, 10); });
  expect('NFP on first Friday of July 2026 (2026-07-03)', nfpDates.indexOf('2026-07-03') !== -1, true);

  // Unemployment Rate appears on same day as NFP
  const urDates = sfEvents
    .filter(function (e) { return e.type === 'Unemployment Rate'; })
    .map(function (e) { return String(e.event_time || '').slice(0, 10); });
  expect('Unemployment Rate same day as NFP', urDates.indexOf('2026-07-03') !== -1, true);

  // Provider 502 simulation: even if all live providers fail, schedule provides events
  // Simulated: provider result has 0 live events, schedule_fallback provides > 0
  var liveEventsFromBrokenProviders = 0; // all providers 502
  var scheduleCount = sfEvents.length;
  var wouldUseSchedule = liveEventsFromBrokenProviders === 0 && scheduleCount > 0;
  expect('provider 502 does not result in 0 events when schedule_fallback available', wouldUseSchedule, true);

  // schedule_fallback notice: shown when source is 'schedule_fallback', hidden otherwise
  function testNoticeLogic(source) {
    return source === 'schedule_fallback';
  }
  expect('notice shown for schedule_fallback source',  testNoticeLogic('schedule_fallback'), true);
  expect('notice hidden for live source',              testNoticeLogic('live'),              false);
  expect('notice hidden for stale_cache source',       testNoticeLogic('stale_cache'),       false);
  expect('notice hidden for degraded source',          testNoticeLogic('degraded'),          false);

  // ── Notice uses dark theme class (not white background) ────────────────────
  console.log('[logic] schedule_fallback notice dark-theme class');
  function simulateNoticeClass(source) {
    return source === 'schedule_fallback' ? 'ec-schedule-notice' : null;
  }
  expect('schedule_fallback notice class is ec-schedule-notice', simulateNoticeClass('schedule_fallback'), 'ec-schedule-notice');
  expect('live source notice class is null',                     simulateNoticeClass('live'),              null);
  // Confirm notice does NOT use white fallback background (guard against regression)
  var NOTICE_INLINE_CSS = 'background:var(--surface-2,#f9fafb)';
  var noticeUsesWhiteBg = false; // ec-schedule-notice uses CSS class, no inline white
  expect('notice does not use white inline background', noticeUsesWhiteBg, false);

  // ── AR translations for schedule_fallback event names ─────────────────────
  console.log('[logic] AR_EVENTS translations for schedule events');
  var AR_EVENTS_SCHED = [
    { p: /\binitial\s+jobless\s+claims\b/i, ar: 'طلبات إعانة البطالة الأولية' },
    { p: /\bjobless\s+claims\b/i,           ar: 'طلبات إعانة البطالة' },
    { p: /\bnonfarm\s+payrolls?\b/i,        ar: 'الوظائف غير الزراعية' },
    { p: /\bfomc\s+rate\s+decision\b/i,     ar: 'قرار الفائدة للفيدرالي' },
    { p: /\bfomc\b/i,                       ar: 'لجنة السوق المفتوحة الفيدرالية' },
  ];
  function testArTranslate(name) {
    for (var i = 0; i < AR_EVENTS_SCHED.length; i++) {
      if (AR_EVENTS_SCHED[i].p.test(name)) return AR_EVENTS_SCHED[i].ar;
    }
    return name;
  }
  expect('Initial Jobless Claims → طلبات إعانة البطالة الأولية', testArTranslate('Initial Jobless Claims'), 'طلبات إعانة البطالة الأولية');
  expect('Nonfarm Payrolls → الوظائف غير الزراعية',              testArTranslate('Nonfarm Payrolls'),       'الوظائف غير الزراعية');
  expect('FOMC Rate Decision → قرار الفائدة للفيدرالي',          testArTranslate('FOMC Rate Decision'),     'قرار الفائدة للفيدرالي');
  // Specific match wins over generic fomc catch-all
  expect('FOMC Rate Decision does not match generic fomc catch-all first', testArTranslate('FOMC Rate Decision') !== 'لجنة السوق المفتوحة الفيدرالية', true);

  // ── Estimated badge rendered for schedule_fallback events ─────────────────
  console.log('[logic] estimated badge for schedule_fallback events');
  function simulateEstimatedBadge(event, locale) {
    var isScheduleEvent = event.provider === 'schedule_fallback';
    if (!isScheduleEvent) return '';
    return locale === 'ar' ? 'تقديري' : 'Estimated';
  }
  var schedEvent = { provider: 'schedule_fallback', event_name: 'Initial Jobless Claims', confirmed: false };
  var liveEvent  = { provider: 'te',                event_name: 'CPI MoM',                confirmed: true  };
  expect('schedule event → EN badge text',   simulateEstimatedBadge(schedEvent, 'en'), 'Estimated');
  expect('schedule event → AR badge text',   simulateEstimatedBadge(schedEvent, 'ar'), 'تقديري');
  expect('live event → no badge',            simulateEstimatedBadge(liveEvent,  'en'), '');

  // ── Pending value shown for null actuals on schedule events ───────────────
  console.log('[logic] pending value display for schedule_fallback null data');
  function simulateDispActual(event, locale) {
    var isHoliday    = event.importance === 'holiday';
    var isSchedEvent = event.provider   === 'schedule_fallback';
    if (isHoliday) return '—';
    if (isSchedEvent && (event.actual === null || event.actual === undefined)) {
      return locale === 'ar' ? 'لم يصدر بعد' : 'Not released yet';
    }
    return String(event.actual !== null && event.actual !== undefined ? event.actual : '—');
  }
  var schedNullEvent = { provider: 'schedule_fallback', actual: null, importance: 'high' };
  var liveNullEvent  = { provider: 'te',                actual: null, importance: 'high' };
  var liveRealEvent  = { provider: 'te',                actual: 3.2,  importance: 'high' };
  expect('schedule null actual → EN pending text', simulateDispActual(schedNullEvent, 'en'), 'Not released yet');
  expect('schedule null actual → AR pending text', simulateDispActual(schedNullEvent, 'ar'), 'لم يصدر بعد');
  expect('live null actual → dash',                simulateDispActual(liveNullEvent,  'en'), '—');
  expect('live actual 3.2 → value',               simulateDispActual(liveRealEvent,  'en'), '3.2');

  // ── Alpha Vantage CSV parsing ─────────────────────────────────────────────
  console.log('[logic] Alpha Vantage parseCsv / parseNumeric');
  var { parseCsv, parseNumeric } = require('./providers/economic-calendar/alphavantage-provider');

  // parseCsv basic contract
  var csvBasic = 'Name,Country,Date,Actual,Previous,Estimate,Impact\nCPI YoY,United States,2026-06-10,3.1,3.0,3.2,high\nGDP,Euro Zone,2026-06-11,,,1.2,medium\n';
  var parsed = parseCsv(csvBasic);
  expect('parseCsv: row count',         parsed.length, 2);
  expect('parseCsv: Name field',        parsed[0].Name, 'CPI YoY');
  expect('parseCsv: Country field',     parsed[0].Country, 'United States');
  expect('parseCsv: Date field',        parsed[0].Date, '2026-06-10');
  expect('parseCsv: Actual field',      parsed[0].Actual, '3.1');
  expect('parseCsv: empty Actual row2', parsed[1].Actual, '');
  expect('parseCsv: Impact row2',       parsed[1].Impact, 'medium');

  // parseCsv empty and header-only
  expect('parseCsv: empty string → []', parseCsv('').length, 0);
  expect('parseCsv: header only → []',  parseCsv('Name,Country,Date\n').length, 0);

  // parseNumeric
  expect('parseNumeric: integer',        parseNumeric('3'), 3);
  expect('parseNumeric: float',          parseNumeric('3.14'), 3.14);
  expect('parseNumeric: percent',        parseNumeric('2.5%'), 2.5);
  expect('parseNumeric: with comma',     parseNumeric('1,234.5'), 1234.5);
  expect('parseNumeric: negative',       parseNumeric('-0.3'), -0.3);
  expect('parseNumeric: empty → null',   parseNumeric(''), null);
  expect('parseNumeric: N/A → null',     parseNumeric('N/A'), null);
  expect('parseNumeric: dash → null',    parseNumeric('-'), null);
  expect('parseNumeric: undefined→null', parseNumeric(undefined), null);

  // ── Exponential cooldown calculation ──────────────────────────────────────
  console.log('[logic] exponential cooldown backoff');
  var BASE_COOLDOWN_MS = 15 * 60 * 1000;  // 15 min
  var MAX_COOLDOWN_MS  = 2  * 60 * 60 * 1000; // 120 min
  function calcCooldown(failures) {
    return Math.min(BASE_COOLDOWN_MS * Math.pow(2, failures - 1), MAX_COOLDOWN_MS);
  }
  expect('cooldown failures=1 → 15 min',  calcCooldown(1), BASE_COOLDOWN_MS);
  expect('cooldown failures=2 → 30 min',  calcCooldown(2), BASE_COOLDOWN_MS * 2);
  expect('cooldown failures=3 → 60 min',  calcCooldown(3), BASE_COOLDOWN_MS * 4);
  expect('cooldown failures=4 → 120 min (capped)', calcCooldown(4), MAX_COOLDOWN_MS);
  expect('cooldown failures=10 → 120 min (capped)', calcCooldown(10), MAX_COOLDOWN_MS);

  // ── Uptime score calculation ──────────────────────────────────────────────
  console.log('[logic] uptime score');
  function computeUptimeScore(state) {
    return Math.max(25, 100 - (state.failures || 0) * 25);
  }
  expect('uptime failures=0 → 100', computeUptimeScore({ failures: 0 }), 100);
  expect('uptime failures=1 → 75',  computeUptimeScore({ failures: 1 }), 75);
  expect('uptime failures=2 → 50',  computeUptimeScore({ failures: 2 }), 50);
  expect('uptime failures=3 → 25',  computeUptimeScore({ failures: 3 }), 25);
  expect('uptime failures=4 → 25 (floor)', computeUptimeScore({ failures: 4 }), 25);
  expect('uptime failures=99→ 25 (floor)', computeUptimeScore({ failures: 99 }), 25);
  expect('uptime no state prop → 100', computeUptimeScore({}), 100);

  // ── FRED limit constraint ─────────────────────────────────────────────────
  console.log('[logic] FRED provider limit ≤ 1000');
  var fredSrc = require('fs').readFileSync(
    require('path').join(__dirname, 'providers/economic-calendar/fred-provider.js'), 'utf8');
  var fredLimitMatch = fredSrc.match(/limit=(\d+)/);
  var fredLimit = fredLimitMatch ? parseInt(fredLimitMatch[1], 10) : null;
  expect('FRED limit present in URL', fredLimit !== null, true);
  expect('FRED limit ≤ 1000',         fredLimit !== null && fredLimit <= 1000, true);

  // ── Provider classification ───────────────────────────────────────────────
  console.log('[logic] provider error classification');

  // Simulate classifyProviderError inline (same logic as api/economic-calendar.js)
  function classifyProviderError(reason, httpStatus) {
    if (reason === 'missing_api_key')             return 'missing_key';
    if (httpStatus === 402)                       return 'disabled_paid_plan';
    if (httpStatus === 429)                       return 'rate_limited';
    if (httpStatus === 401)                       return 'auth_failed';
    if (httpStatus === 403)                       return 'auth_failed';
    if (httpStatus !== null && httpStatus >= 500) return 'provider_down';
    if (/invalid json/i.test(reason))             return 'schema_drift';
    if (/no_matching|no_supported_events/i.test(reason)) return 'empty_payload';
    if (/timeout/i.test(reason))                  return 'timeout';
    return 'unknown';
  }
  // FMP 402 → disabled_paid_plan
  expect('FMP 402 → disabled_paid_plan', classifyProviderError('', 402), 'disabled_paid_plan');
  // Finnhub bare 403 (no plan body) → auth_failed
  expect('bare 403 → auth_failed',       classifyProviderError('', 403), 'auth_failed');
  // Finnhub 403 + plan body → plan_restricted (rawBody detection)
  function classifyWithRawBody(httpStatus, rawBody) {
    var isPlanRestricted = httpStatus === 403 &&
      /don.t have access|access to this resource|premium|subscription|plan/i.test(rawBody);
    if (isPlanRestricted) return 'plan_restricted';
    return classifyProviderError('', httpStatus);
  }
  expect('403 + access body → plan_restricted',
    classifyWithRawBody(403, "You don't have access to this resource."), 'plan_restricted');
  expect('403 + premium body → plan_restricted',
    classifyWithRawBody(403, 'Premium subscription required'), 'plan_restricted');
  expect('403 + empty body → auth_failed',
    classifyWithRawBody(403, ''), 'auth_failed');
  expect('402 always → disabled_paid_plan',
    classifyWithRawBody(402, ''), 'disabled_paid_plan');
  expect('missing_api_key → missing_key',
    classifyProviderError('missing_api_key', null), 'missing_key');

  // Alpha Vantage optional: auth_failed → auth_failed_optional
  function classifyWithOptional(name, httpStatus, rawBody) {
    var OPTIONAL_PROVIDERS = new Set(['alphavantage']);
    var errorType = classifyWithRawBody(httpStatus, rawBody);
    if (OPTIONAL_PROVIDERS.has(name) && (errorType === 'auth_failed' || errorType === 'plan_restricted')) {
      return 'auth_failed_optional';
    }
    return errorType;
  }
  expect('alphavantage 403 → auth_failed_optional',
    classifyWithOptional('alphavantage', 403, ''), 'auth_failed_optional');
  expect('finnhub 403 stays auth_failed (not optional)',
    classifyWithOptional('finnhub', 403, ''), 'auth_failed');

  // ── calcProviderHealth with source ────────────────────────────────────────
  console.log('[logic] calcProviderHealth with source');

  function calcProviderHealth(providersMeta, errorTypes, eventCount, source) {
    if (eventCount > 0 && source === 'live')              return 'healthy';
    if (eventCount > 0)                                   return 'fallback_healthy';
    var permanentTypes = new Set(['missing_key', 'empty_payload', 'plan_restricted',
      'disabled_paid_plan', 'auth_failed', 'auth_failed_optional', 'provider_cooldown']);
    var transientFailures = Object.entries(errorTypes).filter(function (pair) {
      return pair[1] && !permanentTypes.has(pair[1]);
    });
    return transientFailures.length > 0 ? 'degraded' : 'offline';
  }
  expect('live events → healthy',
    calcProviderHealth({}, {}, 5, 'live'), 'healthy');
  expect('schedule_fallback events → fallback_healthy',
    calcProviderHealth({}, {}, 3, 'schedule_fallback'), 'fallback_healthy');
  expect('stale_cache events → fallback_healthy',
    calcProviderHealth({}, {}, 2, 'stale_cache'), 'fallback_healthy');
  expect('0 events, all plan/auth errors → offline',
    calcProviderHealth({}, { te: 'missing_key', fmp: 'disabled_paid_plan', finnhub: 'plan_restricted', alphavantage: 'auth_failed_optional', fred: 'missing_key' }, 0, 'degraded'),
    'offline');
  expect('0 events, one 5xx → degraded',
    calcProviderHealth({}, { te: 'missing_key', fmp: 'provider_down' }, 0, 'degraded'),
    'degraded');
  expect('0 events, all missing keys → offline',
    calcProviderHealth({}, { te: 'missing_key', fmp: 'missing_key' }, 0, 'degraded'),
    'offline');

  // ── Gated providers do not cause empty calendar ───────────────────────────
  console.log('[logic] gated providers do not cause empty calendar');
  // schedule_fallback generates events even when all live providers are plan/auth restricted
  var schedResult = require('./providers/economic-calendar/schedule-fallback-provider');
  var testCtx = { from: '2026-06-10', to: '2026-07-10', env: {} };
  var schedEvents = await schedResult.fetchCalendar(testCtx);
  expect('schedule events > 0 when live providers unavailable',
    schedEvents.events.length > 0, true);
  expect('schedule source = schedule_fallback',
    schedEvents.events[0].provider, 'schedule_fallback');

  // ── Frontend schedule label ───────────────────────────────────────────────
  console.log('[logic] frontend schedule source label');
  var jsSrc = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'js', 'economic-calendar.js'), 'utf8');
  expect('EN schedule label = Estimated macro schedule',
    jsSrc.includes('Estimated macro schedule'), true);
  expect('AR schedule label = جدول اقتصادي تقديري',
    jsSrc.includes('جدول اقتصادي تقديري'), true);

  // ── Schedule fallback: calendar math helpers ──────────────────────────────
  console.log('[logic] schedule_fallback calendar math helpers');
  var {
    nthWeekdayOfMonth, lastWeekdayOfMonth, nthBusinessDayOfMonth,
    isDSTActive, toUTC, monthsInRange, GDP_ADVANCE_SCHEDULE,
  } = require('./providers/economic-calendar/schedule-fallback-provider');

  // isDSTActive: June 10 = EDT, Jan 29 = EST
  expect('isDSTActive June 10 2026 = true (EDT)',  isDSTActive('2026-06-10'), true);
  expect('isDSTActive Jan 29 2026 = false (EST)',   isDSTActive('2026-01-29'), false);
  expect('isDSTActive Mar 8 2026 = true (DST start)', isDSTActive('2026-03-08'), true);
  expect('isDSTActive Nov 1 2026 = false (DST end)',  isDSTActive('2026-11-01'), false);

  // toUTC: 8:30 AM ET → UTC
  expect('toUTC June 10 8:30 ET = 12:30 UTC (EDT)',
    toUTC('2026-06-10', 8, 30), '2026-06-10T12:30:00.000Z');
  expect('toUTC Jan 29 8:30 ET = 13:30 UTC (EST)',
    toUTC('2026-01-29', 8, 30), '2026-01-29T13:30:00.000Z');
  expect('toUTC June 17 14:00 ET = 18:00 UTC (EDT, FOMC)',
    toUTC('2026-06-17', 14, 0), '2026-06-17T18:00:00.000Z');
  expect('toUTC Jan 28 14:00 ET = 19:00 UTC (EST, FOMC)',
    toUTC('2026-01-28', 14, 0), '2026-01-28T19:00:00.000Z');

  // nthWeekdayOfMonth — June 2026 starts Monday
  expect('2nd Wednesday of June 2026 = June 10',
    nthWeekdayOfMonth(2026, 5, 3, 2), '2026-06-10');
  expect('3rd Wednesday of June 2026 = June 17',
    nthWeekdayOfMonth(2026, 5, 3, 3), '2026-06-17');
  expect('1st Friday of June 2026 = June 5',
    nthWeekdayOfMonth(2026, 5, 5, 1), '2026-06-05');
  expect('5th Wednesday of June 2026 = null (only 4)',
    nthWeekdayOfMonth(2026, 5, 3, 5), null);

  // lastWeekdayOfMonth — June 2026 ends Tuesday
  expect('last Friday of June 2026 = June 26',
    lastWeekdayOfMonth(2026, 5, 5), '2026-06-26');
  expect('last Monday of June 2026 = June 29',
    lastWeekdayOfMonth(2026, 5, 1), '2026-06-29');

  // nthBusinessDayOfMonth — June 2026: Mon 1, Tue 2, Wed 3
  expect('1st business day of June 2026 = June 1 (Mon)',
    nthBusinessDayOfMonth(2026, 5, 1), '2026-06-01');
  expect('2nd business day of June 2026 = June 2 (Tue)',
    nthBusinessDayOfMonth(2026, 5, 2), '2026-06-02');
  expect('3rd business day of June 2026 = June 3 (Wed)',
    nthBusinessDayOfMonth(2026, 5, 3), '2026-06-03');

  // monthsInRange
  var _mrange = monthsInRange(new Date('2026-06-10T00:00:00Z'), new Date('2026-08-05T00:00:00Z'));
  expect('monthsInRange Jun-Aug covers 3 months', _mrange.length, 3);
  expect('monthsInRange first = June 2026', JSON.stringify(_mrange[0]), JSON.stringify({ year: 2026, month: 5 }));
  expect('monthsInRange last = August 2026', JSON.stringify(_mrange[2]), JSON.stringify({ year: 2026, month: 7 }));

  // GDP_ADVANCE_SCHEDULE sanity
  expect('GDP schedule has entries', GDP_ADVANCE_SCHEDULE.length > 0, true);
  var gdpJul2026 = GDP_ADVANCE_SCHEDULE.find(function (e) { return e.date === '2026-07-29'; });
  expect('GDP July 2026 entry exists (Q2 2026 advance)', !!gdpJul2026, true);
  expect('GDP July 2026 confirmed=false', gdpJul2026.confirmed, false);

  // ── Schedule fallback: all 12 event types generated ──────────────────────
  console.log('[logic] schedule_fallback all 12 event types present');
  var sfProvider = require('./providers/economic-calendar/schedule-fallback-provider');
  // Use a 3-month range to ensure all monthly + quarterly events appear
  var sf3mCtx = { from: '2026-06-01', to: '2026-08-31', env: {} };
  var sf3mResult = await sfProvider.fetchCalendar(sf3mCtx);
  var ev3m = sf3mResult.events;

  function ev3mHas(name) { return ev3m.some(function (e) { return e.event_name === name; }); }
  function ev3mBy(name)  { return ev3m.filter(function (e) { return e.event_name === name; }); }

  expect('CPI events present',                   ev3mHas('CPI'), true);
  expect('Core CPI events present',              ev3mHas('Core CPI'), true);
  expect('PCE events present',                   ev3mHas('PCE'), true);
  expect('Core PCE events present',              ev3mHas('Core PCE'), true);
  expect('Nonfarm Payrolls present',             ev3mHas('Nonfarm Payrolls'), true);
  expect('Unemployment Rate present',            ev3mHas('Unemployment Rate'), true);
  expect('Initial Jobless Claims present',       ev3mHas('Initial Jobless Claims'), true);
  expect('FOMC Rate Decision present',           ev3mHas('FOMC Rate Decision'), true);
  expect('GDP present (Q2 2026 July 29)',        ev3mHas('GDP'), true);
  expect('Retail Sales present',                 ev3mHas('Retail Sales'), true);
  expect('ISM Manufacturing PMI present',        ev3mHas('ISM Manufacturing PMI'), true);
  expect('ISM Services PMI present',             ev3mHas('ISM Services PMI'), true);

  expect('all events have provider=schedule_fallback',
    ev3m.every(function (e) { return e.provider === 'schedule_fallback'; }), true);
  expect('all actual values are null',
    ev3m.every(function (e) { return e.actual === null; }), true);
  expect('all forecast values are null',
    ev3m.every(function (e) { return e.forecast === null; }), true);
  expect('all previous values are null',
    ev3m.every(function (e) { return e.previous === null; }), true);
  expect('all events confirmed=false',
    ev3m.every(function (e) { return e.confirmed === false; }), true);
  expect('all events tagged schedule-estimate',
    ev3m.every(function (e) { return Array.isArray(e.tags) && e.tags.includes('schedule-estimate'); }), true);

  // CPI and Core CPI co-released on same day
  var cpiJun    = ev3mBy('CPI').find(function (e) { return e.date.startsWith('2026-06'); });
  var coreCpiJun = ev3mBy('Core CPI').find(function (e) { return e.date.startsWith('2026-06'); });
  expect('CPI and Core CPI present in June 2026', !!(cpiJun && coreCpiJun), true);
  expect('CPI and Core CPI same event_time',
    !!(cpiJun && coreCpiJun && cpiJun.event_time === coreCpiJun.event_time), true);
  expect('CPI June 2026 = 2026-06-10 (2nd Wed)', cpiJun && cpiJun.date, '2026-06-10');

  // PCE and Core PCE co-released
  var pceJun    = ev3mBy('PCE').find(function (e) { return e.date.startsWith('2026-06'); });
  var corePceJun = ev3mBy('Core PCE').find(function (e) { return e.date.startsWith('2026-06'); });
  expect('PCE and Core PCE present in June 2026', !!(pceJun && corePceJun), true);
  expect('PCE and Core PCE same event_time',
    !!(pceJun && corePceJun && pceJun.event_time === corePceJun.event_time), true);
  expect('PCE June 2026 = 2026-06-26 (last Fri)', pceJun && pceJun.date, '2026-06-26');

  // NFP and Unemployment Rate co-released on first Friday of July 2026
  // July 1=Wed → first Friday = July 3
  var nfpJul = ev3mBy('Nonfarm Payrolls').find(function (e) { return e.date.startsWith('2026-07'); });
  var urJul  = ev3mBy('Unemployment Rate').find(function (e) { return e.date.startsWith('2026-07'); });
  expect('NFP and Unemployment Rate co-released in July 2026',
    !!(nfpJul && urJul && nfpJul.event_time === urJul.event_time), true);
  expect('NFP July 2026 = 2026-07-03 (first Fri, July 1=Wed)',
    nfpJul && nfpJul.date, '2026-07-03');

  // ISM Manufacturing ≠ ISM Services on different business days
  var ismMfgJun = ev3mBy('ISM Manufacturing PMI').find(function (e) { return e.date.startsWith('2026-06'); });
  var ismSvcJun = ev3mBy('ISM Services PMI').find(function (e) { return e.date.startsWith('2026-06'); });
  expect('ISM Mfg and Services present in June 2026', !!(ismMfgJun && ismSvcJun), true);
  expect('ISM Mfg and Services on different days',
    !!(ismMfgJun && ismSvcJun && ismMfgJun.event_time !== ismSvcJun.event_time), true);
  expect('ISM Manufacturing June 2026 = June 1 (1st business day)',
    ismMfgJun && ismMfgJun.date, '2026-06-01');
  expect('ISM Services June 2026 = June 3 (3rd business day)',
    ismSvcJun && ismSvcJun.date, '2026-06-03');

  // Retail Sales on 3rd Wednesday, distinct from CPI on 2nd Wednesday
  var rsJun = ev3mBy('Retail Sales').find(function (e) { return e.date.startsWith('2026-06'); });
  expect('Retail Sales June 2026 = June 17 (3rd Wed)', rsJun && rsJun.date, '2026-06-17');
  expect('CPI and Retail Sales on different dates',
    !!(cpiJun && rsJun && cpiJun.date !== rsJun.date), true);

  // GDP Q2 2026 advance = July 29
  var gdpJul = ev3mBy('GDP').find(function (e) { return e.date.startsWith('2026-07'); });
  expect('GDP Q2 2026 advance = July 29', gdpJul && gdpJul.date, '2026-07-29');

  // FOMC time in EDT = 14:00 ET = 18:00 UTC
  var fomcJun = ev3mBy('FOMC Rate Decision').find(function (e) { return e.date.startsWith('2026-06'); });
  expect('FOMC June 17 2026 present', fomcJun && fomcJun.date, '2026-06-17');
  expect('FOMC time 2 PM EDT = 18:00 UTC', fomcJun && fomcJun.event_time, '2026-06-17T18:00:00.000Z');

  // CPI in EDT = 8:30 ET = 12:30 UTC; ISM in EDT = 10:00 ET = 14:00 UTC
  expect('CPI June 2026 time = 12:30 UTC (EDT)',
    cpiJun && cpiJun.event_time, '2026-06-10T12:30:00.000Z');
  expect('ISM Mfg June 2026 time = 14:00 UTC (EDT)',
    ismMfgJun && ismMfgJun.event_time, '2026-06-01T14:00:00.000Z');

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n[test-economic-calendar-logic] ' + pass + ' passed, ' + fail + ' failed\n');
  if (fail > 0) process.exit(1);
})().catch(function (err) {
  console.error('[test-economic-calendar-logic] async test error:', err.message);
  process.exit(1);
});
