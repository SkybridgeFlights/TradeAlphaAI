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

// ── Report ─────────────────────────────────────────────────────────────────────
console.log('\n[test-economic-calendar-logic] ' + pass + ' passed, ' + fail + ' failed\n');
if (fail > 0) process.exit(1);
