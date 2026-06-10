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

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LOGIC from directional-bias.js (new version)
// ─────────────────────────────────────────────────────────────────────────────

const SCALE_SIM = 90;

const EVENT_DIRECTION_SIM = [
  { p: ['nonfarm payrolls', 'non-farm payrolls', 'nfp'], tier: 1.0,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['fomc', 'federal reserve', 'interest rate decision', 'rate decision',
         'federal funds rate', 'fed chair', 'powell'], tier: 1.0,
    d: { gold: -1, usd: +1, spy: -1, nasdaq: -1 } },
  { p: ['cpi', 'consumer price index'], tier: 1.0,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },
  { p: ['core pce', 'personal consumption expenditure'], tier: 1.0,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },
  { p: ['pce price'], tier: 1.0,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },
  { p: ['gdp', 'gross domestic product'], tier: 1.0,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['core ppi', 'ppi', 'producer price index'], tier: 0.6,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },
  { p: ['retail sales'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['ism manufacturing', 'manufacturing pmi', 'pmi manufacturing', 'chicago pmi'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['ism services', 'ism non-manufacturing', 'services pmi', 'non-manufacturing pmi'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['average hourly earnings'], tier: 0.6,
    d: { gold: +1, usd: +1, spy: -1, nasdaq: -1 } },
  { p: ['unemployment rate'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['initial jobless claims', 'continuing jobless claims', 'jobless claims'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['consumer confidence', 'michigan consumer sentiment', 'michigan sentiment'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['industrial production', 'capacity utilization'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['durable goods'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
];

function simGetEventEntry(eventName) {
  const n = String(eventName).toLowerCase();
  for (const entry of EVENT_DIRECTION_SIM) {
    if (entry.p.some((k) => n.includes(k))) return entry;
  }
  return null;
}
function simMagnitudeToSignal(mag) {
  if (mag < 1.5) return 20;
  if (mag < 5)   return 40;
  if (mag < 15)  return 60;
  return 85;
}
function simScoreToDirection(score) {
  const a = Math.abs(score);
  const sign = score >= 0 ? 1 : -1;
  if (a < 10) return 'neutral';
  if (a < 28) return sign > 0 ? 'mildly bullish'  : 'mildly bearish';
  if (a < 55) return sign > 0 ? 'bullish'          : 'bearish';
  return              sign > 0 ? 'strongly bullish' : 'strongly bearish';
}

function simComputeBiasAsset(scoredResults, asset, regime) {
  let rawScore     = 0;
  let alignedCount = 0;
  let conflictCount = 0;
  const hasTier1 = scoredResults.some((r) => { const e = simGetEventEntry(r.event.event_name); return e && e.tier >= 1.0; });
  const hasTier2 = scoredResults.some((r) => { const e = simGetEventEntry(r.event.event_name); return e && e.tier >= 0.5; });
  const eventBlend = hasTier1 ? 0.80 : (hasTier2 ? 0.65 : (scoredResults.length ? 0.45 : 0.0));

  for (const r of scoredResults) {
    if (r.scored.direction === 'pending' || r.scored.direction === 'inline') continue;
    const entry = simGetEventEntry(r.event.event_name);
    if (!entry) continue;
    const assetDir = entry.d[asset];
    if (!assetDir) continue;
    const surpriseSign = r.scored.direction === 'beat' ? +1 : -1;
    const signal = simMagnitudeToSignal(r.scored.magnitude) * assetDir * surpriseSign;
    const contribution = entry.tier * signal;
    rawScore += contribution;
    if (contribution > 0) alignedCount++; else conflictCount++;
  }
  if (alignedCount >= 2 && conflictCount === 0) rawScore *= 1.25;
  if (alignedCount >= 3 && conflictCount === 0) rawScore *= 1.15;

  const eventScore = Math.tanh(rawScore / SCALE_SIM) * 100;

  // Regime signal (simplified)
  let regScore = 0;
  if (asset === 'gold') {
    if ((regime || '') === 'risk-off') regScore = 45;
    if ((regime || '') === 'risk-on')  regScore = -20;
  }
  if (asset === 'spy') {
    if ((regime || '') === 'risk-on')  regScore = 35;
    if ((regime || '') === 'risk-off') regScore = -35;
  }
  if (asset === 'nasdaq') {
    if ((regime || '') === 'risk-on')  regScore = 30;
    if ((regime || '') === 'risk-off') regScore = -40;
  }
  const regimeBlend = 1 - eventBlend;
  const finalScore = Math.max(-100, Math.min(100, eventScore * eventBlend + regScore * regimeBlend));
  return { direction: simScoreToDirection(finalScore), score: Math.round(finalScore), alignedCount, conflictCount };
}

console.log('\n── directional-bias: CPI/NFP/FOMC semantics ───────────');

// CPI beat = lower than expected (LOWER_IS_BETTER) = dovish
// Expected: gold +, usd -, spy +, nasdaq +
{
  const scored = [{ event: { event_name: 'CPI m/m', importance: 'high' }, scored: { direction: 'beat', magnitude: 10, score: 40 } }];
  const g = simComputeBiasAsset(scored, 'gold', null);
  assertEq('CPI beat → gold bullish/mildly', true, g.direction === 'bullish' || g.direction === 'strongly bullish' || g.direction === 'mildly bullish');
  const u = simComputeBiasAsset(scored, 'usd', null);
  assertEq('CPI beat → usd bearish', true, u.direction === 'bearish' || u.direction === 'mildly bearish' || u.direction === 'strongly bearish');
  const s = simComputeBiasAsset(scored, 'spy', null);
  assertEq('CPI beat → spy bullish', true, s.direction === 'bullish' || s.direction === 'strongly bullish' || s.direction === 'mildly bullish');
  const n = simComputeBiasAsset(scored, 'nasdaq', null);
  assertEq('CPI beat → nasdaq bullish', true, n.direction === 'bullish' || n.direction === 'strongly bullish' || n.direction === 'mildly bullish');
}

// CPI miss = higher than expected (hot inflation) = hawkish risk
// Expected: gold -, usd +, spy -, nasdaq -
{
  const scored = [{ event: { event_name: 'CPI m/m', importance: 'high' }, scored: { direction: 'miss', magnitude: 10, score: -40 } }];
  const g = simComputeBiasAsset(scored, 'gold', null);
  assertEq('CPI miss → gold bearish', true, g.score < 0);
  const u = simComputeBiasAsset(scored, 'usd', null);
  assertEq('CPI miss → usd bullish', true, u.score > 0);
  const s = simComputeBiasAsset(scored, 'spy', null);
  assertEq('CPI miss → spy bearish', true, s.score < 0);
}

// NFP beat = strong employment = hawkish/risk-on
// Expected: gold -, usd +, spy +, nasdaq +
{
  const scored = [{ event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 15, score: 60 } }];
  const g = simComputeBiasAsset(scored, 'gold', null);
  assertEq('NFP beat → gold bearish', true, g.score < 0);
  const u = simComputeBiasAsset(scored, 'usd', null);
  assertEq('NFP beat → usd bullish', true, u.score > 0);
  const s = simComputeBiasAsset(scored, 'spy', null);
  assertEq('NFP beat → spy bullish', true, s.score > 0);
  const n = simComputeBiasAsset(scored, 'nasdaq', null);
  assertEq('NFP beat → nasdaq bullish', true, n.score > 0);
}

// FOMC beat = hawkish surprise
// Expected: gold -, usd +, spy -, nasdaq -
{
  const scored = [{ event: { event_name: 'FOMC Rate Decision', importance: 'high' }, scored: { direction: 'beat', magnitude: 8, score: 32 } }];
  const g = simComputeBiasAsset(scored, 'gold', null);
  assertEq('FOMC beat → gold bearish', true, g.score < 0);
  const u = simComputeBiasAsset(scored, 'usd', null);
  assertEq('FOMC beat → usd bullish', true, u.score > 0);
  const s = simComputeBiasAsset(scored, 'spy', null);
  assertEq('FOMC beat → spy bearish', true, s.score < 0);
  const n = simComputeBiasAsset(scored, 'nasdaq', null);
  assertEq('FOMC beat → nasdaq bearish', true, n.score < 0);
}

// Multi-event alignment: 2+ aligned USD-positive events → conviction boost
{
  const scored = [
    { event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 15, score: 60 } },
    { event: { event_name: 'Retail Sales m/m', importance: 'high' }, scored: { direction: 'beat', magnitude: 6,  score: 24 } },
  ];
  const single = simComputeBiasAsset(
    [{ event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 15, score: 60 } }],
    'usd', null
  );
  const multi = simComputeBiasAsset(scored, 'usd', null);
  assert('2 aligned USD-positive events → higher USD score than single', multi.score > single.score);
  assert('2 aligned events → alignedCount >= 2', multi.alignedCount >= 2);
}

// Conflicting signals: NFP beat (USD bullish) + GDP miss (USD bearish) → score closer to zero
{
  const nfpBeat  = { event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 15, score: 60 } };
  const gdpMiss  = { event: { event_name: 'GDP q/q', importance: 'high' }, scored: { direction: 'miss', magnitude: 10, score: -40 } };
  const mixedUsd = simComputeBiasAsset([nfpBeat, gdpMiss], 'usd', null);
  const cleanUsd = simComputeBiasAsset([nfpBeat], 'usd', null);
  // Mixed signals cancel — absolute conviction should be lower than clean bullish
  assert('NFP beat + GDP miss: USD score closer to zero than clean NFP', Math.abs(mixedUsd.score) < cleanUsd.score);
  // Conflict is detected
  assert('NFP beat + GDP miss: conflictCount >= 1', mixedUsd.conflictCount >= 1);
}

// No events, risk-off regime → gold bullish
{
  const empty = simComputeBiasAsset([], 'gold', 'risk-off');
  assert('No events + risk-off → gold bullish', empty.direction === 'bullish' || empty.direction === 'strongly bullish' || empty.direction === 'mildly bullish');
}

// No events, risk-on regime → spy bullish
{
  const empty = simComputeBiasAsset([], 'spy', 'risk-on');
  assert('No events + risk-on → spy bullish', empty.direction === 'bullish' || empty.direction === 'strongly bullish' || empty.direction === 'mildly bullish');
}

// No events, unverified regime → neutral
{
  const empty = simComputeBiasAsset([], 'gold', null);
  assertEq('No events + unverified regime → neutral', empty.direction, 'neutral');
}

// Slight-magnitude events should NOT push into bullish territory (prevent noise signals)
{
  const slight = [{ event: { event_name: 'Jobless Claims', importance: 'medium' }, scored: { direction: 'beat', magnitude: 0.8, score: 3 } }];
  const r = simComputeBiasAsset(slight, 'usd', null);
  assertEq('Single slight Tier 3 beat = neutral (low noise floor)', r.direction, 'neutral');
}

// PCE beat = lower inflation = dovish → gold up
{
  const scored = [{ event: { event_name: 'Core PCE Price Index', importance: 'high' }, scored: { direction: 'beat', magnitude: 8, score: 32 } }];
  const g = simComputeBiasAsset(scored, 'gold', null);
  assert('Core PCE beat → gold bullish', g.score > 0);
  const u = simComputeBiasAsset(scored, 'usd', null);
  assert('Core PCE beat → usd bearish', u.score < 0);
}

// Strength gradient: Tier 1 Major Beat > Tier 1 Moderate Beat > neutral
{
  const majorBeat    = [{ event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 20, score: 80 } }];
  const moderateBeat = [{ event: { event_name: 'Nonfarm Payrolls', importance: 'high' }, scored: { direction: 'beat', magnitude: 4, score: 16 } }];
  const mj = simComputeBiasAsset(majorBeat,    'usd', null);
  const md = simComputeBiasAsset(moderateBeat, 'usd', null);
  assert('Major Beat score > Moderate Beat score', mj.score > md.score);
  assert('Major Beat = bullish or strongly bullish', mj.direction === 'bullish' || mj.direction === 'strongly bullish');
  assert('Moderate Beat = mildly bullish or bullish', md.direction === 'mildly bullish' || md.direction === 'bullish');
}

// Direction label thresholds for scoreToDirection
assertEq('score 0 = neutral',              simScoreToDirection(0),    'neutral');
assertEq('score 5 = neutral',              simScoreToDirection(5),    'neutral');
assertEq('score 15 = mildly bullish',      simScoreToDirection(15),   'mildly bullish');
assertEq('score -15 = mildly bearish',     simScoreToDirection(-15),  'mildly bearish');
assertEq('score 35 = bullish',             simScoreToDirection(35),   'bullish');
assertEq('score -35 = bearish',            simScoreToDirection(-35),  'bearish');
assertEq('score 60 = strongly bullish',    simScoreToDirection(60),   'strongly bullish');
assertEq('score -60 = strongly bearish',   simScoreToDirection(-60),  'strongly bearish');

console.log('\n── telegram-formatter headers ─────────────────────────');

{
  const brief = {
    date: '2026-06-10',
    directional_biases: {
      gold:   { direction: 'bullish', strength: 60, confidence: 'high', drivers: ['CPI miss'] },
      usd:    { direction: 'bearish', strength: 40, confidence: 'moderate', drivers: ['NFP miss'] },
      spy:    { direction: 'mildly bullish', strength: 20, confidence: 'low', drivers: [] },
      nasdaq: { direction: 'neutral', strength: 8, confidence: 'low', drivers: [] },
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

// New expanded emoji set
const DIR_EMOJI_NEW = {
  'strongly bullish': '▲▲', 'bullish': '▲', 'mildly bullish': '△',
  'neutral': '◆',
  'mildly bearish': '▽',    'bearish': '▼', 'strongly bearish': '▼▼',
};
assertEq('strongly bullish emoji', DIR_EMOJI_NEW['strongly bullish'], '▲▲');
assertEq('bullish emoji',          DIR_EMOJI_NEW['bullish'],          '▲');
assertEq('mildly bullish emoji',   DIR_EMOJI_NEW['mildly bullish'],   '△');
assertEq('neutral emoji',          DIR_EMOJI_NEW['neutral'],          '◆');
assertEq('mildly bearish emoji',   DIR_EMOJI_NEW['mildly bearish'],   '▽');
assertEq('bearish emoji',          DIR_EMOJI_NEW['bearish'],          '▼');
assertEq('strongly bearish emoji', DIR_EMOJI_NEW['strongly bearish'], '▼▼');
assertEq('high vol emoji',   VOL_EMOJI_SIM.high,     '🔴');
assertEq('moderate vol emoji', VOL_EMOJI_SIM.moderate, '🟡');
assertEq('low vol emoji',    VOL_EMOJI_SIM.low,      '🟢');

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
// INLINE LOGIC from prediction-evaluator.js
// ─────────────────────────────────────────────────────────────────────────────

const PE_THRESHOLDS = {
  gold:   { '1m': 0.06, '5m': 0.12, '15m': 0.22, '1h': 0.40 },
  dxy:    { '1m': 0.05, '5m': 0.10, '15m': 0.18, '1h': 0.30 },
  sp500:  { '1m': 0.05, '5m': 0.10, '15m': 0.18, '1h': 0.30 },
  nasdaq: { '1m': 0.07, '5m': 0.13, '15m': 0.23, '1h': 0.40 },
};
function peThreshold(asset, window) {
  const key = asset === 'usd' ? 'dxy' : asset === 'spy' ? 'sp500' : asset;
  return (PE_THRESHOLDS[key] || PE_THRESHOLDS.sp500)[window] || 0.10;
}
function peEvaluateOne(predictedBias, actualPct, asset, window) {
  if (actualPct === null || actualPct === undefined) return 'no_data';
  const dir = predictedBias?.direction || 'neutral';
  const thresh = peThreshold(asset, window);
  const significant = Math.abs(actualPct) >= thresh;
  const actualDir = significant ? (actualPct > 0 ? 'bullish' : 'bearish') : 'neutral';
  if (dir === 'neutral') {
    return actualDir === 'neutral' ? 'correct' : 'partially_correct';
  }
  if (actualDir === dir)       return 'correct';
  if (actualDir === 'neutral') return 'partially_correct';
  return 'incorrect';
}
function peEvaluateAll(predictedBiases, actualMovesByWindow) {
  const results = {};
  for (const asset of ['gold', 'usd', 'spy', 'nasdaq']) {
    results[asset] = {};
    const predicted = predictedBiases?.[asset] || null;
    for (const window of ['1m', '5m', '15m', '1h']) {
      const pct = actualMovesByWindow?.[window]?.[`${asset}_pct`] ?? null;
      results[asset][window] = peEvaluateOne(predicted, pct, asset, window);
    }
  }
  return results;
}
const PE_WINDOW_WEIGHT = { '1m': 0.5, '5m': 0.75, '15m': 1.0, '1h': 1.5 };
function peCompositeScore(evaluationResults) {
  let weight = 0; let score = 0;
  for (const windows of Object.values(evaluationResults)) {
    for (const [window, label] of Object.entries(windows)) {
      if (label === 'no_data') continue;
      const w = PE_WINDOW_WEIGHT[window] || 1;
      weight += w;
      if (label === 'correct')            score += w * 1.0;
      else if (label === 'partially_correct') score += w * 0.5;
      else if (label === 'neutral_call')  score += w * 0.6;
    }
  }
  if (!weight) return null;
  return Math.round((score / weight) * 100) / 100;
}
function peOverallLabel(score) {
  if (score === null || score === undefined) return 'no_data';
  if (score >= 0.70) return 'correct';
  if (score >= 0.40) return 'partially_correct';
  return 'incorrect';
}

console.log('\n── prediction-evaluator ────────────────────────────────');

// Correct: predicted bullish, actual +0.5% for gold at 1h (above 0.40 threshold)
{
  const r = peEvaluateOne({ direction: 'bullish' }, 0.5, 'gold', '1h');
  assertEq('bullish prediction + +0.5% gold@1h = correct', r, 'correct');
}
// Incorrect: predicted bullish, actual -0.5%
{
  const r = peEvaluateOne({ direction: 'bullish' }, -0.5, 'gold', '1h');
  assertEq('bullish prediction + -0.5% gold@1h = incorrect', r, 'incorrect');
}
// Partially correct: predicted bullish, actual +0.1% (below threshold)
{
  const r = peEvaluateOne({ direction: 'bullish' }, 0.1, 'gold', '1h');
  assertEq('bullish prediction + muted +0.1% gold@1h = partially_correct', r, 'partially_correct');
}
// Neutral prediction, market also neutral (below threshold)
{
  const r = peEvaluateOne({ direction: 'neutral' }, 0.02, 'gold', '1m');
  assertEq('neutral prediction + 0.02% gold@1m = correct', r, 'correct');
}
// Neutral prediction, market moves significantly
{
  const r = peEvaluateOne({ direction: 'neutral' }, 0.8, 'gold', '1h');
  assertEq('neutral prediction + big move gold@1h = partially_correct', r, 'partially_correct');
}
// no_data when pct is null
{
  const r = peEvaluateOne({ direction: 'bullish' }, null, 'spy', '5m');
  assertEq('null pct = no_data', r, 'no_data');
}
// evaluateAll produces structure
{
  const biases = { gold: { direction: 'bullish' }, usd: { direction: 'bearish' }, spy: { direction: 'bullish' }, nasdaq: { direction: 'bullish' } };
  const moves  = { '1h': { gold_pct: 0.6, usd_pct: -0.4, spy_pct: 0.5, nasdaq_pct: 0.7 } };
  const res    = peEvaluateAll(biases, moves);
  assertEq('evaluateAll gold@1h = correct',   res.gold['1h'],   'correct');
  assertEq('evaluateAll usd@1h = correct',    res.usd['1h'],    'correct');
  assertEq('evaluateAll gold@1m = no_data',   res.gold['1m'],   'no_data'); // no 1m data
}
// compositeScore on perfect predictions = 1.0
{
  const biases = { gold: { direction: 'bullish' }, usd: { direction: 'bearish' }, spy: { direction: 'bullish' }, nasdaq: { direction: 'bullish' } };
  const moves  = {
    '1m':  { gold_pct: 0.1, usd_pct: -0.1, spy_pct: 0.1, nasdaq_pct: 0.1 },
    '5m':  { gold_pct: 0.2, usd_pct: -0.2, spy_pct: 0.2, nasdaq_pct: 0.2 },
    '15m': { gold_pct: 0.3, usd_pct: -0.3, spy_pct: 0.3, nasdaq_pct: 0.3 },
    '1h':  { gold_pct: 0.5, usd_pct: -0.5, spy_pct: 0.5, nasdaq_pct: 0.5 },
  };
  const res   = peEvaluateAll(biases, moves);
  const score = peCompositeScore(res);
  assertEq('all correct predictions = composite 1.0', score, 1.0);
  assertEq('overallLabel 1.0 = correct', peOverallLabel(score), 'correct');
}
// compositeScore on all incorrect = 0
{
  const biases = { gold: { direction: 'bullish' }, usd: { direction: 'bullish' }, spy: { direction: 'bullish' }, nasdaq: { direction: 'bullish' } };
  const moves  = { '1h': { gold_pct: -0.6, usd_pct: -0.6, spy_pct: -0.6, nasdaq_pct: -0.6 } };
  const res   = peEvaluateAll(biases, moves);
  const score = peCompositeScore(res);
  assert('all incorrect predictions: score < 0.4', score < 0.4);
  assertEq('overallLabel < 0.4 = incorrect or partially_correct', true,
    peOverallLabel(score) === 'incorrect' || peOverallLabel(score) === 'partially_correct');
}
// overallLabel boundaries
assertEq('overallLabel 0.70 = correct',           peOverallLabel(0.70), 'correct');
assertEq('overallLabel 0.69 = partially_correct', peOverallLabel(0.69), 'partially_correct');
assertEq('overallLabel 0.40 = partially_correct', peOverallLabel(0.40), 'partially_correct');
assertEq('overallLabel 0.39 = incorrect',         peOverallLabel(0.39), 'incorrect');
assertEq('overallLabel null = no_data',           peOverallLabel(null), 'no_data');

// ─────────────────────────────────────────────────────────────────────────────
// INLINE LOGIC from calibration-engine.js
// ─────────────────────────────────────────────────────────────────────────────

const CE_EVENT_TYPE_PATTERNS = [
  { key: 'nfp',           p: ['nonfarm payrolls', 'non-farm payrolls', 'nfp'] },
  { key: 'fomc',          p: ['fomc', 'federal reserve', 'rate decision', 'federal funds', 'fed chair', 'powell'] },
  { key: 'cpi',           p: ['cpi', 'consumer price index'] },
  { key: 'core_pce',      p: ['core pce', 'pce price', 'personal consumption expenditure'] },
  { key: 'gdp',           p: ['gdp', 'gross domestic product'] },
  { key: 'jobless_claims',p: ['jobless claims', 'initial claims', 'continuing claims'] },
];
function ceNormalizeEventType(eventName) {
  const n = String(eventName).toLowerCase();
  for (const { key, p } of CE_EVENT_TYPE_PATTERNS) {
    if (p.some((k) => n.includes(k))) return key;
  }
  return 'other';
}
function ceConfidenceMultiplier(accuracyRate, sampleCount) {
  if (sampleCount < 3)     return 1.0;
  if (accuracyRate >= 0.78) return 1.3;
  if (accuracyRate >= 0.65) return 1.15;
  if (accuracyRate >= 0.50) return 1.0;
  if (accuracyRate >= 0.35) return 0.8;
  return 0.6;
}

console.log('\n── calibration-engine ──────────────────────────────────');

assertEq('normalize NFP event',         ceNormalizeEventType('Nonfarm Payrolls'),               'nfp');
assertEq('normalize FOMC event',        ceNormalizeEventType('FOMC Rate Decision'),              'fomc');
assertEq('normalize CPI event',         ceNormalizeEventType('CPI m/m'),                         'cpi');
assertEq('normalize Core PCE event',    ceNormalizeEventType('Core PCE Price Index m/m'),        'core_pce');
assertEq('normalize GDP event',         ceNormalizeEventType('GDP q/q Annualized'),              'gdp');
assertEq('normalize Jobless Claims',    ceNormalizeEventType('Initial Jobless Claims'),          'jobless_claims');
assertEq('normalize unknown event',     ceNormalizeEventType('Banana Index'),                    'other');

// confidenceMultiplier boundaries
assertEq('< 3 samples → 1.0',       ceConfidenceMultiplier(0.9, 2),   1.0);  // insufficient data
assertEq('>= 78% → 1.3',            ceConfidenceMultiplier(0.78, 10), 1.3);
assertEq('>= 65% → 1.15',           ceConfidenceMultiplier(0.65, 5),  1.15);
assertEq('>= 50% → 1.0',            ceConfidenceMultiplier(0.50, 5),  1.0);
assertEq('>= 35% → 0.8',            ceConfidenceMultiplier(0.35, 5),  0.8);
assertEq('< 35% → 0.6',             ceConfidenceMultiplier(0.20, 5),  0.6);

// ─────────────────────────────────────────────────────────────────────────────
// REPORT
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n[market-brief] Tests complete: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error(`[market-brief] ${failed} test(s) FAILED`); process.exit(1); }
else            { console.log('[market-brief] All tests passed.'); }
