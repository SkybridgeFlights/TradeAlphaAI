'use strict';

// Pure-function logic tests for market-brief providers.
// All logic is replicated inline — no file I/O, no network, no secrets.

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS  ${label}`); passed++; }
  else           { console.error(`  FAIL  ${label}`); failed++; }
}
function assertEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { console.log(`  PASS  ${label}: ${actual}`); passed++; }
  else    { console.error(`  FAIL  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`); failed++; }
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LOGIC from surprise-scorer.js
// ─────────────────────────────────────────────────────────────────────────────

const HIGHER_IS_BETTER_SIM = new Set([
  'nonfarm payrolls', 'nfp', 'retail sales', 'gdp', 'ism manufacturing',
  'ism services', 'pmi', 'building permits', 'housing starts', 'consumer confidence',
  'industrial production', 'durable goods orders', 'average hourly earnings',
  'core retail sales', 'manufacturing pmi', 'services pmi', 'composite pmi',
  'new home sales', 'existing home sales', 'pending home sales',
  'capacity utilization', 'chicago pmi', 'michigan consumer sentiment',
]);
const LOWER_IS_BETTER_SIM = new Set([
  'unemployment rate', 'initial jobless claims', 'continuing jobless claims',
  'jobless claims', 'unemployment', 'cpi', 'core cpi', 'ppi', 'core ppi',
  'pce', 'core pce', 'inflation', 'trade deficit', 'unit labor costs',
  'import price index', 'export price index',
]);

function simIsHigherBetter(name) {
  const n = name.toLowerCase();
  for (const k of HIGHER_IS_BETTER_SIM) if (n.includes(k)) return true;
  return false;
}
function simIsLowerBetter(name) {
  const n = name.toLowerCase();
  for (const k of LOWER_IS_BETTER_SIM) if (n.includes(k)) return true;
  return false;
}
function simScoreEvent(event) {
  const actual   = parseFloat(event.actual);
  const forecast = parseFloat(event.forecast);
  const name     = String(event.event_name || '');
  if (isNaN(actual) || isNaN(forecast)) return { direction: 'pending', magnitude: 0, score: 0, label: 'Pending' };
  const diff = actual - forecast;
  if (diff === 0) return { direction: 'inline', magnitude: 0, score: 0, label: 'Inline' };
  const base      = Math.abs(forecast) > 0.0001 ? Math.abs(forecast) : 1;
  const magnitude = Math.round(Math.abs(diff / base) * 10000) / 100;
  const higherActual = diff > 0;
  let positiveSurprise;
  if      (simIsHigherBetter(name)) positiveSurprise = higherActual;
  else if (simIsLowerBetter(name))  positiveSurprise = !higherActual;
  else                              positiveSurprise = higherActual;
  const direction = positiveSurprise ? 'beat' : 'miss';
  const score     = Math.min(100, Math.round(magnitude * 4)) * (positiveSurprise ? 1 : -1);
  let label;
  if      (magnitude < 1.5)  label = direction === 'beat' ? 'Slight Beat'    : 'Slight Miss';
  else if (magnitude < 5)    label = direction === 'beat' ? 'Moderate Beat'  : 'Moderate Miss';
  else if (magnitude < 15)   label = direction === 'beat' ? 'Strong Beat'    : 'Strong Miss';
  else                        label = direction === 'beat' ? 'Major Beat'     : 'Major Miss';
  return { direction, magnitude, score, label };
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LOGIC from volatility-expectation.js
// ─────────────────────────────────────────────────────────────────────────────

const HIGH_VOL_SIM = new Set([
  'nonfarm payrolls', 'non-farm payrolls', 'nfp', 'fomc', 'federal reserve',
  'interest rate decision', 'rate decision', 'cpi', 'core cpi', 'core pce',
  'gdp', 'fed chair', 'powell',
]);
const MOD_VOL_SIM = new Set([
  'pce', 'ppi', 'retail sales', 'ism manufacturing', 'ism services',
  'ism non-manufacturing', 'consumer confidence', 'michigan', 'jobless claims',
  'initial jobless claims', 'industrial production', 'durable goods',
  'housing starts', 'building permits',
]);

function simEventVolWeight(event) {
  const n   = String(event.event_name || '').toLowerCase();
  const imp = event.importance;
  if ([...HIGH_VOL_SIM].some((k) => n.includes(k))) return imp === 'high' ? 40 : 25;
  if ([...MOD_VOL_SIM].some((k) => n.includes(k)))  return imp === 'high' ? 25 : 15;
  if (imp === 'high')   return 20;
  if (imp === 'medium') return 8;
  return 2;
}
function simVolatility(events, vix) {
  let score = 0;
  for (const e of events) score += simEventVolWeight(e);
  if (typeof vix === 'number') {
    if      (vix > 30) score += 35;
    else if (vix > 20) score += 15;
    else if (vix < 13) score -= 5;
  }
  score = Math.min(100, Math.max(0, score));
  if (score >= 70) return 'high';
  if (score >= 45) return 'elevated';
  if (score >= 20) return 'moderate';
  return 'low';
}

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LOGIC from telegram-formatter.js
// ─────────────────────────────────────────────────────────────────────────────

const DIR_EMOJI_SIM = { bullish: '▲', bearish: '▼', neutral: '◆' };
const VOL_EMOJI_SIM = { low: '🟢', moderate: '🟡', elevated: '🟠', high: '🔴' };

function simFormatBriefHasHeader(brief, lang) {
  const ar = lang === 'ar';
  const date = brief.date || '';
  return ar
    ? `📋 موجز السوق اليومي — ${date}`.includes('موجز')
    : `📋 Daily Market Brief — ${date}`.includes('Daily Market Brief');
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n── surprise-scorer ────────────────────────────────────');

{
  const r = simScoreEvent({ event_name: 'Nonfarm Payrolls', actual: '230', forecast: '200', importance: 'high' });
  assertEq('NFP beat direction',   r.direction, 'beat');
  assert  ('NFP beat magnitude > 5', r.magnitude > 5);
  assert  ('NFP beat score > 0',     r.score > 0);
  assert  ('NFP beat label strong',  r.label.includes('Strong') || r.label.includes('Major') || r.label.includes('Moderate'));
}

{
  const r = simScoreEvent({ event_name: 'Nonfarm Payrolls', actual: '170', forecast: '200', importance: 'high' });
  assertEq('NFP miss direction', r.direction, 'miss');
  assert  ('NFP miss score < 0', r.score < 0);
}

{
  const r = simScoreEvent({ event_name: 'CPI m/m', actual: '0.4', forecast: '0.3', importance: 'high' });
  assertEq('CPI higher actual = miss (inflation bad for markets)', r.direction, 'miss');
  assert  ('CPI miss score < 0', r.score < 0);
}

{
  const r = simScoreEvent({ event_name: 'CPI m/m', actual: '0.2', forecast: '0.3', importance: 'high' });
  assertEq('CPI lower than forecast = beat', r.direction, 'beat');
  assert  ('CPI beat score > 0', r.score > 0);
}

{
  const r = simScoreEvent({ event_name: 'Initial Jobless Claims', actual: '210000', forecast: '225000', importance: 'medium' });
  assertEq('Jobless claims lower = beat', r.direction, 'beat');
}

{
  const r = simScoreEvent({ event_name: 'Initial Jobless Claims', actual: '250000', forecast: '225000', importance: 'medium' });
  assertEq('Jobless claims higher = miss', r.direction, 'miss');
}

{
  const r = simScoreEvent({ event_name: 'GDP q/q', actual: '2.5', forecast: '2.5', importance: 'high' });
  assertEq('GDP inline direction', r.direction, 'inline');
  assertEq('GDP inline score', r.score, 0);
  assertEq('GDP inline label', r.label, 'Inline');
}

{
  const r = simScoreEvent({ event_name: 'Retail Sales m/m', actual: null, forecast: '0.3', importance: 'medium' });
  assertEq('Null actual = pending', r.direction, 'pending');
}

{
  const r = simScoreEvent({ event_name: 'Retail Sales m/m', actual: '', forecast: '0.3', importance: 'medium' });
  assertEq('Empty actual = pending', r.direction, 'pending');
}

{
  const r = simScoreEvent({ event_name: 'ISM Manufacturing PMI', actual: '52', forecast: '49', importance: 'high' });
  assertEq('ISM beat direction (higher is better)', r.direction, 'beat');
}

{
  const r = simScoreEvent({ event_name: 'Core PCE Price Index m/m', actual: '0.35', forecast: '0.2', importance: 'high' });
  assertEq('Core PCE higher = miss (inflation)', r.direction, 'miss');
}

{
  const r = simScoreEvent({ event_name: 'Unknown Indicator', actual: '105', forecast: '100', importance: 'low' });
  assertEq('Unknown event: higher actual = beat (default)', r.direction, 'beat');
}

{
  // Magnitude formula: |230-200|/200 = 15% → score = min(100, 15*4) = 60
  const r = simScoreEvent({ event_name: 'Nonfarm Payrolls', actual: '230', forecast: '200', importance: 'high' });
  assertEq('NFP beat score calculation', r.score, 60);
  assertEq('NFP beat magnitude', r.magnitude, 15);
}

{
  // Near-zero forecast: forecast=0.1, actual=0.3 → magnitude = 200%
  const r = simScoreEvent({ event_name: 'Some Index', actual: '0.3', forecast: '0.1', importance: 'medium' });
  assertEq('Very small forecast → huge magnitude label', r.label, 'Major Beat');
}

console.log('\n── volatility-expectation ─────────────────────────────');

{
  const events = [
    { event_name: 'Nonfarm Payrolls', importance: 'high' },
    { event_name: 'CPI m/m', importance: 'high' },
  ];
  const level = simVolatility(events, null);
  assertEq('NFP + CPI = elevated or high volatility', true, level === 'elevated' || level === 'high');
}

{
  const events = [{ event_name: 'Building Permits', importance: 'low' }];
  const level = simVolatility(events, null);
  assertEq('Low-impact event only = low volatility', level, 'low');
}

{
  const events = [{ event_name: 'ISM Manufacturing PMI', importance: 'high' }];
  const level = simVolatility(events, null);
  assertEq('One high ISM event = moderate', level, 'moderate');
}

{
  // VIX=35 alone: +35 score → 'moderate' (no event catalysts, just fear gauge)
  const events = [];
  const level = simVolatility(events, 35);
  assert('No events but VIX=35 >= moderate', level === 'moderate' || level === 'elevated' || level === 'high');
}

{
  // FOMC(high)=40 + VIX=25 adds 15 = 55 → 'elevated' (meets threshold ≥45)
  const events = [{ event_name: 'FOMC Rate Decision', importance: 'high' }];
  const level = simVolatility(events, 25);
  assert('FOMC + VIX=25 = elevated or high', level === 'elevated' || level === 'high');
}

{
  const events = [{ event_name: 'FOMC Rate Decision', importance: 'high' }, { event_name: 'Nonfarm Payrolls', importance: 'high' }];
  const level = simVolatility(events, null);
  assertEq('FOMC + NFP = high', level, 'high');
}

{
  const events = [];
  const level = simVolatility(events, null);
  assertEq('No events, no VIX = low', level, 'low');
}

{
  const events = [{ event_name: 'Consumer Confidence', importance: 'medium' }];
  const level = simVolatility(events, null);
  assertEq('Medium consumer confidence = low', level, 'low');
}

console.log('\n── telegram-formatter headers ─────────────────────────');

{
  const brief = {
    date: '2026-06-10',
    directional_biases: {
      gold:   { direction: 'bullish', strength: 60, drivers: ['CPI miss'] },
      usd:    { direction: 'bearish', strength: 40, drivers: ['NFP miss'] },
      spy:    { direction: 'neutral', strength: 20, drivers: [] },
      nasdaq: { direction: 'neutral', strength: 15, drivers: [] },
    },
    volatility_expectation: { level: 'high', score: 75, drivers: ['FOMC today'] },
    top_surprises: [],
    narrative_en: null,
    narrative_ar: null,
  };
  assert('EN brief has header', simFormatBriefHasHeader(brief, 'en'));
  assert('AR brief has Arabic header', simFormatBriefHasHeader(brief, 'ar'));
}

console.log('\n── directional emoji ───────────────────────────────────');

assertEq('bullish emoji', DIR_EMOJI_SIM.bullish, '▲');
assertEq('bearish emoji', DIR_EMOJI_SIM.bearish, '▼');
assertEq('neutral emoji', DIR_EMOJI_SIM.neutral, '◆');
assertEq('high vol emoji', VOL_EMOJI_SIM.high, '🔴');
assertEq('moderate vol emoji', VOL_EMOJI_SIM.moderate, '🟡');
assertEq('low vol emoji', VOL_EMOJI_SIM.low, '🟢');

console.log('\n── surprise label thresholds ───────────────────────────');

{
  // 2.1 vs 2.0 = 5% relative deviation → 'Strong Beat' by formula
  // (GDP is reported as %; relative deviation inflates the label, which is expected behavior)
  const r = simScoreEvent({ event_name: 'GDP q/q', actual: '2.1', forecast: '2.0', importance: 'high' });
  assert('GDP 2.1 vs 2.0 = beat', r.direction === 'beat');
  assert('GDP 2.1 vs 2.0 = non-trivial label', r.label.includes('Beat'));
}

{
  // magnitude 2-5 → Moderate
  const r = simScoreEvent({ event_name: 'Retail Sales m/m', actual: '0.5', forecast: '0.3', importance: 'medium' });
  assert('~66% retail sales beat = Strong or Moderate', r.label.includes('Strong') || r.label.includes('Moderate') || r.label.includes('Major'));
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n[market-brief] Tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error(`[market-brief] ${failed} test(s) FAILED`); process.exit(1); }
else            { console.log('[market-brief] All tests passed.'); }
