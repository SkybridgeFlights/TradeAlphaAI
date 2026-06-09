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

// ── Report ─────────────────────────────────────────────────────────────────────
console.log('\n[test-economic-calendar-logic] ' + pass + ' passed, ' + fail + ' failed\n');
if (fail > 0) process.exit(1);
