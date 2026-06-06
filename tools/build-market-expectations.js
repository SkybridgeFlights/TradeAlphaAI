'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function buildMarketExpectations(calendar = read('data/economic-calendar.json', { events: [] }), market = read('data/live-market-state.json', {})) {
  const events = (calendar.events || []).filter((event) => Date.parse(event.event_time || event.date) >= Date.now() - 86400000).slice(0, 8);
  const verified = market.metadata?.status === 'live';
  const expectations = [];
  for (const event of events) {
    expectations.push({
      event_id: event.id,
      event_name: event.event_name || event.name,
      event_time: event.event_time || event.date,
      importance: event.importance || event.impact_level,
      consensus: event.forecast,
      previous: event.previous,
      pricing_narrative: event.market_expectation || defaultExpectation(event),
      confirmation_assets: confirmationAssets(event.type),
      confidence: event.forecast !== null && event.forecast !== undefined ? 'medium' : 'low'
    });
  }
  return {
    generated_at: new Date().toISOString(),
    live_market_verified: verified,
    dominant_expectation: expectations[0]?.pricing_narrative || 'No sourced market expectation is currently available.',
    expectations,
    methodology: 'Expectations are sourced from calendar consensus fields or expressed as conditional policy scenarios. They are not predictions.'
  };
}

function defaultExpectation(event) {
  const type = String(event.type || '').toLowerCase();
  if (/cpi|pce/.test(type)) return 'Markets are evaluating whether disinflation is continuing fast enough to reduce restrictive-rate pressure.';
  if (/nfp|unemployment|jobless/.test(type)) return 'Markets are balancing labor resilience against the risk that persistent tightness delays policy easing.';
  if (/fomc|fed|ecb|boj|boe/.test(type)) return 'Markets are focused on the policy-path signal, terminal-rate language, and the balance between inflation and growth risks.';
  if (/gdp|retail|ism/.test(type)) return 'Markets are testing whether the growth path is consistent with a soft landing or a broader slowdown.';
  return 'Markets are assessing whether the release changes the expected path for growth, inflation, liquidity, or policy.';
}

function confirmationAssets(type) {
  if (/CPI|PCE|FOMC|Fed/.test(type)) return ['Treasury yields', 'DXY', 'Gold', 'QQQ', 'TLT'];
  if (/NFP|Unemployment|Jobless/.test(type)) return ['Treasury yields', 'DXY', 'SPY', 'IWM', 'VIX'];
  return ['Treasury yields', 'SPY', 'IWM', 'DXY'];
}

function read(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

if (require.main === module) {
  const result = buildMarketExpectations();
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, 'data', 'market-expectations.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log('Updated data/market-expectations.json');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { buildMarketExpectations };
