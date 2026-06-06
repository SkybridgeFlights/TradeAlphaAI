'use strict';

const fs = require('fs');
const path = require('path');
const { buildMarketExpectations } = require('./build-market-expectations');
const { buildCrossAssetReaction } = require('./build-cross-asset-reaction');

const ROOT = path.resolve(__dirname, '..');
const mode = arg('--mode') || 'daily';
const write = process.argv.includes('--write');
const calendar = read('data/economic-calendar.json', { events: [] });
const expectations = buildMarketExpectations(calendar);
const upcoming = expectations.expectations.filter((item) => item.importance === 'high').slice(0, mode === 'weekly' ? 6 : 3);
const latestReleased = [...(calendar.events || [])].reverse().find((event) => event.actual !== null && event.actual !== undefined);
const reaction = latestReleased ? buildCrossAssetReaction(latestReleased) : null;
const briefing = {
  generated_at: new Date().toISOString(),
  briefing_type: mode === 'weekly' ? 'weekly_macro_outlook' : 'daily_macro_briefing',
  data_status: upcoming.length ? 'sourced_calendar' : 'limited',
  headline: mode === 'weekly' ? 'Weekly macro expectations and cross-asset risk map' : 'Daily macro event and market-expectations briefing',
  dominant_expectation: expectations.dominant_expectation,
  upcoming_high_impact_events: upcoming,
  latest_reaction: reaction,
  risk_monitor: upcoming.map((item) => ({
    event: item.event_name,
    scenario: item.pricing_narrative,
    confirmation: item.confirmation_assets
  })),
  disclaimer: 'Educational macro commentary only. Outcomes and asset reactions are probabilistic, not deterministic.'
};

if (write) {
  const file = path.join(ROOT, 'data', mode === 'weekly' ? 'weekly-macro-briefing.json' : 'daily-macro-briefing.json');
  fs.writeFileSync(file, JSON.stringify(briefing, null, 2) + '\n', 'utf8');
  console.log(`Updated ${path.relative(ROOT, file).replaceAll('\\', '/')}`);
} else {
  console.log(JSON.stringify(briefing, null, 2));
}

function read(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}
function arg(name) {
  const found = process.argv.find((value) => value.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : '';
}
