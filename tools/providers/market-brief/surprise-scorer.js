'use strict';

// Event direction convention: true = higher actual is a positive surprise (USD-bullish)
const HIGHER_IS_BETTER = new Set([
  'nonfarm payrolls', 'nfp', 'retail sales', 'gdp', 'ism manufacturing',
  'ism non-manufacturing', 'ism services', 'pmi', 'building permits',
  'housing starts', 'consumer confidence', 'industrial production',
  'durable goods orders', 'average hourly earnings', 'core retail sales',
  'manufacturing pmi', 'services pmi', 'composite pmi',
  'new home sales', 'existing home sales', 'pending home sales',
  'capacity utilization', 'chicago pmi', 'michigan consumer sentiment',
]);
const LOWER_IS_BETTER = new Set([
  'unemployment rate', 'initial jobless claims', 'continuing jobless claims',
  'jobless claims', 'unemployment', 'cpi', 'core cpi', 'ppi', 'core ppi',
  'pce', 'core pce', 'inflation', 'trade deficit', 'unit labor costs',
  'import price index', 'export price index',
]);

function isHigherBetter(name) {
  const n = name.toLowerCase();
  for (const k of HIGHER_IS_BETTER) if (n.includes(k)) return true;
  return false;
}

function isLowerBetter(name) {
  const n = name.toLowerCase();
  for (const k of LOWER_IS_BETTER) if (n.includes(k)) return true;
  return false;
}

function scoreEvent(event) {
  const actual   = parseFloat(event.actual);
  const forecast = parseFloat(event.forecast);
  const name     = String(event.event_name || '');

  if (isNaN(actual) || isNaN(forecast)) {
    return { direction: 'pending', magnitude: 0, score: 0, label: 'Pending', event_name: name };
  }

  const diff = actual - forecast;
  if (diff === 0) {
    return { direction: 'inline', magnitude: 0, score: 0, label: 'Inline', event_name: name };
  }

  const base     = Math.abs(forecast) > 0.0001 ? Math.abs(forecast) : 1;
  const magnitude = Math.round(Math.abs(diff / base) * 10000) / 100; // percent, 2dp

  const higherActual = diff > 0;
  let positiveSurprise;
  if (isHigherBetter(name))      positiveSurprise = higherActual;
  else if (isLowerBetter(name))  positiveSurprise = !higherActual;
  else                           positiveSurprise = higherActual;

  const direction = positiveSurprise ? 'beat' : 'miss';
  const score     = Math.min(100, Math.round(magnitude * 4)) * (positiveSurprise ? 1 : -1);

  let label;
  if      (magnitude < 1.5)  label = direction === 'beat' ? 'Slight Beat'    : 'Slight Miss';
  else if (magnitude < 5)    label = direction === 'beat' ? 'Moderate Beat'  : 'Moderate Miss';
  else if (magnitude < 15)   label = direction === 'beat' ? 'Strong Beat'    : 'Strong Miss';
  else                        label = direction === 'beat' ? 'Major Beat'     : 'Major Miss';

  return { direction, magnitude, score, label, event_name: name };
}

function scoreEvents(events) {
  return events
    .filter((e) => e.actual !== null && e.actual !== undefined && e.actual !== '')
    .map((e) => ({ event: e, scored: scoreEvent(e) }))
    .filter((r) => r.scored.direction !== 'pending');
}

module.exports = { scoreEvent, scoreEvents };
