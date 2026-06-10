'use strict';

const HIGH_VOL_EVENTS = new Set([
  'nonfarm payrolls', 'non-farm payrolls', 'nfp', 'fomc', 'federal reserve',
  'interest rate decision', 'rate decision', 'cpi', 'core cpi', 'core pce',
  'gdp', 'fed chair', 'powell',
]);
const MODERATE_VOL_EVENTS = new Set([
  'pce', 'ppi', 'retail sales', 'ism manufacturing', 'ism services',
  'ism non-manufacturing', 'consumer confidence', 'michigan', 'jobless claims',
  'initial jobless claims', 'industrial production', 'durable goods',
  'housing starts', 'building permits',
]);

function eventVolatilityWeight(event) {
  const n = String(event.event_name || '').toLowerCase();
  const imp = event.importance;
  if ([...HIGH_VOL_EVENTS].some((k) => n.includes(k))) return imp === 'high' ? 40 : 25;
  if ([...MODERATE_VOL_EVENTS].some((k) => n.includes(k))) return imp === 'high' ? 25 : 15;
  if (imp === 'high')   return 20;
  if (imp === 'medium') return 8;
  return 2;
}

function computeVolatilityExpectation(events, marketState) {
  const today     = new Date().toISOString().slice(0, 10);
  const todayEvts = events.filter((e) => (e.event_time || '').slice(0, 10) === today);

  let score   = 0;
  const drivers = [];

  for (const e of todayEvts) {
    const w = eventVolatilityWeight(e);
    if (w >= 20) drivers.push(`${e.event_name} (${e.importance} impact)`);
    score += w;
  }

  // VIX overlay
  const vix = marketState?.vix?.value;
  if (typeof vix === 'number') {
    if      (vix > 30) { score += 35; drivers.push(`VIX elevated at ${vix.toFixed(1)}`); }
    else if (vix > 20) { score += 15; drivers.push(`VIX moderate at ${vix.toFixed(1)}`); }
    else if (vix < 13) { score -=  5; }
  }

  // Surprise overlay: if large surprises already released today, volatility realization
  score = Math.min(100, Math.max(0, score));

  let level;
  if      (score >= 70) level = 'high';
  else if (score >= 45) level = 'elevated';
  else if (score >= 20) level = 'moderate';
  else                   level = 'low';

  if (!drivers.length) drivers.push('No major scheduled volatility catalysts');

  return { level, score: Math.round(score), drivers: drivers.slice(0, 5) };
}

module.exports = { computeVolatilityExpectation };
