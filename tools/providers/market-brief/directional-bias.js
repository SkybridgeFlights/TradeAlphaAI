'use strict';

// Asset sensitivity: which event keywords drive each asset
const ASSET_SENSITIVITY = {
  gold: [
    'cpi', 'pce', 'inflation', 'fomc', 'federal reserve', 'rate decision',
    'interest rate', 'real yield', 'gdp', 'recession', 'jobless', 'unemployment',
    'non-farm', 'nfp', 'dxy', 'dollar', 'trade balance', 'geopolit',
  ],
  usd: [
    'nonfarm payrolls', 'nfp', 'cpi', 'core cpi', 'fomc', 'interest rate',
    'gdp', 'retail sales', 'ism', 'pmi', 'consumer confidence', 'jobless',
    'unemployment', 'pce', 'average hourly earnings',
  ],
  spy: [
    'nonfarm payrolls', 'nfp', 'gdp', 'ism manufacturing', 'retail sales',
    'consumer confidence', 'pce', 'industrial production', 'durable goods',
    'building permits', 'fomc', 'interest rate',
  ],
  nasdaq: [
    'fomc', 'interest rate', 'rate decision', 'gdp', 'pmi', 'manufacturing pmi',
    'services pmi', 'consumer confidence', 'michigan', 'core cpi', 'pce',
    'nonfarm payrolls', 'nfp',
  ],
};

// For each asset, does a surprise BEAT improve the outlook? (USD-aligned perspective)
// Gold: inflation beat = bearish gold (lower real rates concern eases), NFP beat = bearish gold
// USD: NFP beat = bullish USD, CPI beat = bullish USD (hawkish Fed)
// SPY: NFP beat = bullish, but CPI beat = mixed (stagflation risk)
// Nasdaq: rate-sensitive — CPI beat (hawkish) = bearish, GDP beat = bullish
const BEAT_DIRECTION = {
  gold:   { positive: ['recession', 'jobless', 'unemployment', 'weak gdp'], negative: ['nfp', 'nonfarm', 'cpi', 'pce', 'fomc rate hike'] },
  usd:    { positive: ['nfp', 'nonfarm', 'cpi', 'pce', 'retail sales', 'gdp', 'ism'], negative: ['fomc cut', 'recession', 'jobless'] },
  spy:    { positive: ['nfp', 'nonfarm', 'retail sales', 'gdp', 'ism', 'consumer confidence'], negative: ['cpi', 'pce', 'inflation', 'fomc rate hike'] },
  nasdaq: { positive: ['gdp', 'pmi', 'consumer confidence'], negative: ['cpi', 'pce', 'fomc rate hike', 'interest rate'] },
};

function eventAffectsAsset(eventName, asset) {
  const n = eventName.toLowerCase();
  return ASSET_SENSITIVITY[asset].some((k) => n.includes(k));
}

function beatSignForAsset(eventName, asset) {
  const n = eventName.toLowerCase();
  const pos = BEAT_DIRECTION[asset].positive.some((k) => n.includes(k));
  const neg = BEAT_DIRECTION[asset].negative.some((k) => n.includes(k));
  if (pos && !neg) return  1;
  if (neg && !pos) return -1;
  return 0; // ambiguous
}

function computeBias(scoredResults, marketState) {
  const biases = { gold: null, usd: null, spy: null, nasdaq: null };

  for (const asset of Object.keys(biases)) {
    const relevant = scoredResults.filter((r) => eventAffectsAsset(r.event.event_name, asset));
    const drivers  = [];
    let totalScore  = 0;
    let totalWeight = 0;

    const importanceWeight = { high: 3, medium: 1.5, low: 0.5 };
    for (const r of relevant) {
      if (r.scored.direction === 'pending') continue;
      const w   = importanceWeight[r.event.importance] || 1;
      const sign = r.scored.direction === 'beat' ? beatSignForAsset(r.event.event_name, asset) : -beatSignForAsset(r.event.event_name, asset);
      totalScore  += r.scored.score * sign * w;
      totalWeight += w * Math.abs(r.scored.score) > 0 ? 1 : 0;
      if (r.scored.magnitude >= 1.5) {
        drivers.push(`${r.event.event_name}: ${r.scored.label}`);
      }
    }

    // Apply market regime overlay if available
    let regimeAdj = 0;
    if (marketState && marketState.computed_regime) {
      const regime = marketState.computed_regime;
      if (asset === 'gold' && regime.risk_regime === 'risk-off')    regimeAdj =  20;
      if (asset === 'gold' && regime.risk_regime === 'risk-on')     regimeAdj = -10;
      if (asset === 'usd'  && regime.risk_regime === 'risk-off')    regimeAdj =  15;
      if (asset === 'spy'  && regime.risk_regime === 'risk-on')     regimeAdj =  15;
      if (asset === 'spy'  && regime.risk_regime === 'risk-off')    regimeAdj = -15;
      if (asset === 'nasdaq' && regime.risk_regime === 'risk-on')   regimeAdj =  10;
      if (asset === 'nasdaq' && regime.risk_regime === 'risk-off')  regimeAdj = -20;
    }

    const finalScore = totalScore + regimeAdj;
    const strength   = Math.min(100, Math.abs(finalScore));

    let direction;
    if      (finalScore >  15) direction = 'bullish';
    else if (finalScore < -15) direction = 'bearish';
    else                        direction = 'neutral';

    if (!drivers.length && relevant.length) drivers.push('Low-magnitude data releases');
    if (!drivers.length) drivers.push('No directly correlated events today');

    biases[asset] = { direction, strength: Math.round(strength), drivers: drivers.slice(0, 4), score: Math.round(finalScore) };
  }

  return biases;
}

module.exports = { computeBias };
