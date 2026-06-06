'use strict';

function analyzeEconomicSurprise(event) {
  const actual = numberOrNull(event.actual);
  const forecast = numberOrNull(event.forecast);
  if (actual === null || forecast === null) {
    return {
      surprise_score: null,
      surprise_direction: 'pending',
      policy_tone: 'unresolved',
      expectation_confirmation: 'pending',
      reaction_interpretation: 'Awaiting a sourced actual and forecast comparison.'
    };
  }
  const denominator = Math.max(Math.abs(forecast), 0.1);
  const raw = (actual - forecast) / denominator;
  const score = Math.max(-100, Math.min(100, Math.round(raw * 100)));
  const type = String(event.type || event.event_name || '').toLowerCase();
  const lowerIsHotter = /unemployment|jobless/.test(type);
  const hotter = lowerIsHotter ? actual < forecast : actual > forecast;
  const softer = lowerIsHotter ? actual > forecast : actual < forecast;
  const material = Math.abs(score) >= 8;
  const direction = !material ? 'near_consensus' : hotter ? 'hotter_or_stronger' : softer ? 'softer_or_weaker' : 'mixed';
  const policyTone = /cpi|pce|nfp|unemployment|retail|ism|gdp/.test(type)
    ? (!material ? 'neutral' : hotter ? 'hawkish_impulse' : 'dovish_impulse')
    : 'event_specific';
  return {
    surprise_score: score,
    surprise_direction: direction,
    policy_tone: policyTone,
    expectation_confirmation: event.market_reaction?.confirmed === true ? 'confirmed' : event.market_reaction?.confirmed === false ? 'rejected' : 'unverified',
    reaction_interpretation: interpretation(event, direction, policyTone)
  };
}

function interpretation(event, direction, tone) {
  const name = event.event_name || event.name || 'The release';
  if (direction === 'near_consensus') return `${name} was close to consensus, so cross-asset interpretation depends more on revisions, composition, and prior positioning than the headline difference alone.`;
  if (tone === 'hawkish_impulse') return `${name} exceeded the policy-sensitive consensus in a direction that could reinforce a more restrictive rate path; confirmation requires higher yields and a firmer dollar rather than the surprise alone.`;
  if (tone === 'dovish_impulse') return `${name} missed the policy-sensitive consensus in a direction that could ease rate pressure; confirmation requires lower yields and broader risk participation rather than an isolated equity reaction.`;
  return `${name} produced a material surprise, but the market implication remains conditional on rates, the dollar, volatility, and positioning.`;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

if (require.main === module) {
  const input = process.argv[2]?.startsWith('{')
    ? JSON.parse(process.argv[2])
    : {
        type: arg('--type'),
        event_name: arg('--event-name'),
        actual: arg('--actual'),
        forecast: arg('--forecast')
      };
  console.log(JSON.stringify(analyzeEconomicSurprise(input), null, 2));
}

function arg(name) {
  const found = process.argv.find((value) => value.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : null;
}

module.exports = { analyzeEconomicSurprise };
