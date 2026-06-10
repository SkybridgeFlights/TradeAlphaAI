'use strict';

function buildNarrativeContext(events, biases, volatility, marketState, scoredResults, date) {
  const today    = date || new Date().toISOString().slice(0, 10);
  const todayEvt = events.filter((e) => (e.event_time || '').slice(0, 10) === today);
  const highEvt  = todayEvt.filter((e) => e.importance === 'high');
  const releases = scoredResults.filter((r) => (r.event.event_time || '').slice(0, 10) === today);

  const topSurprises = releases
    .filter((r) => r.scored.magnitude >= 1.5)
    .sort((a, b) => Math.abs(b.scored.score) - Math.abs(a.scored.score))
    .slice(0, 4);

  const regime = marketState?.computed_regime || {};

  return {
    date: today,
    high_impact_events: highEvt.map((e) => ({
      name: e.event_name,
      time: e.event_time,
      country: e.country,
      actual: e.actual,
      forecast: e.forecast,
    })),
    top_surprises: topSurprises.map((r) => ({
      name: r.event.event_name,
      label: r.scored.label,
      direction: r.scored.direction,
      magnitude_pct: r.scored.magnitude,
    })),
    directional_biases: biases,
    volatility: volatility,
    market_regime: {
      risk_regime: regime.risk_regime || 'unverified',
      market_regime: regime.market_regime || 'unverified',
      volatility_regime: regime.volatility_regime || 'unverified',
      rates_trend: regime.rates_trend || 'unverified',
    },
    live_prices: {
      gold:   marketState?.gold?.value    || null,
      dxy:    marketState?.dxy?.value     || null,
      sp500:  marketState?.sp500?.value   || null,
      nasdaq: marketState?.nasdaq?.value  || null,
      vix:    marketState?.vix?.value     || null,
      us10y:  marketState?.us10y_yield?.value || null,
    },
  };
}

function buildPrompt(context, lang) {
  const ar = lang === 'ar';
  const biases   = context.directional_biases;
  const vol      = context.volatility;
  const surprises = context.top_surprises;
  const regime   = context.market_regime;

  const surpriseBlock = surprises.length
    ? surprises.map((s) => `- ${s.name}: ${s.label} (${s.direction}, ${s.magnitude_pct.toFixed(1)}% deviation)`).join('\n')
    : '- No significant surprise releases today';

  const biasBlock = Object.entries(biases)
    .map(([asset, b]) => `- ${asset.toUpperCase()}: ${b.direction} (strength: ${b.strength}/100) — ${b.drivers[0] || ''}`)
    .join('\n');

  const highEvtBlock = context.high_impact_events.length
    ? context.high_impact_events.map((e) => `- ${e.name} (${e.country}, ${e.time?.slice(11, 16) || 'TBD'})`).join('\n')
    : '- No high-impact events today';

  const lang_instruction = ar
    ? 'Respond entirely in Arabic (Modern Standard Arabic, formal register).'
    : 'Respond entirely in English (institutional, professional tone).';

  const system = `You are an institutional macro analyst writing a daily market intelligence brief.
${lang_instruction}
Rules:
- No financial advice, no "you should buy/sell"
- No generic filler phrases
- Reference specific data points (event names, deviations, asset levels)
- Maximum 180 words for the narrative
- Use analytical, objective language`;

  const user = `Date: ${context.date}
Market Regime: risk_regime=${regime.risk_regime}, market_regime=${regime.market_regime}, volatility=${regime.volatility_regime}, rates=${regime.rates_trend}
Volatility Expectation: ${vol.level} (score: ${vol.score}/100)
Drivers: ${vol.drivers.join(', ')}

High-Impact Events Today:
${highEvtBlock}

Key Surprise Releases:
${surpriseBlock}

Directional Bias Summary:
${biasBlock}

${context.live_prices.vix ? `VIX: ${context.live_prices.vix.toFixed(1)}` : ''}
${context.live_prices.us10y ? `US 10Y Yield: ${context.live_prices.us10y.toFixed(2)}%` : ''}

Write a 2–3 paragraph daily macro brief covering:
1. Key macro themes for today based on the above data
2. Directional implications for Gold, USD, equities
3. Key risks or watch points for the session`;

  return { system, user };
}

module.exports = { buildNarrativeContext, buildPrompt };
