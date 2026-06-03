'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'market-regime-state.json');
const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const allowed = {
  volatility_regime: ['low', 'normal', 'elevated', 'high', 'unverified'],
  risk_regime: ['risk-on', 'neutral', 'risk-off', 'unverified'],
  ai_sector_momentum: ['positive', 'neutral', 'negative', 'mixed', 'unverified'],
  semiconductor_strength: ['strong', 'neutral', 'weak', 'mixed', 'unverified'],
  rates_trend: ['falling', 'stable', 'rising', 'mixed', 'unverified'],
  defensive_rotation: ['present', 'absent', 'mixed', 'unverified'],
  growth_value_bias: ['growth', 'value', 'balanced', 'mixed', 'unverified']
};

if (!sourcePath) {
  console.log('No market regime source provided. Use --source=<json> --write with sourced regime inputs.');
  process.exit(0);
}

const input = JSON.parse(fs.readFileSync(path.resolve(ROOT, sourcePath), 'utf8'));
const state = input.state || {};
const sources = input.sources || [];
if (!Array.isArray(sources) || !sources.length || sources.some((source) => !/^https?:\/\//.test(source.url || ''))) {
  console.error('Market regime update requires at least one real source URL.');
  process.exit(1);
}
for (const [key, values] of Object.entries(allowed)) {
  if (!values.includes(state[key])) {
    console.error(`Invalid ${key}: ${state[key]}. Allowed: ${values.join(', ')}`);
    process.exit(1);
  }
}

const output = {
  version: '1.0',
  updated: new Date().toISOString().slice(0, 10),
  source_policy: { requires_real_sources: true, manual_or_api_import_only: true, no_fabricated_indicators: true },
  state: {
    volatility_regime: state.volatility_regime,
    risk_regime: state.risk_regime,
    ai_sector_momentum: state.ai_sector_momentum,
    semiconductor_strength: state.semiconductor_strength,
    rates_trend: state.rates_trend,
    etf_flow_themes: Array.isArray(state.etf_flow_themes) ? state.etf_flow_themes.slice(0, 8) : [],
    defensive_rotation: state.defensive_rotation,
    growth_value_bias: state.growth_value_bias
  },
  sources
};

if (!write) {
  console.log('DRY_RUN: market regime source validated. No file updated.');
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log('Updated data/market-regime-state.json.');

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
