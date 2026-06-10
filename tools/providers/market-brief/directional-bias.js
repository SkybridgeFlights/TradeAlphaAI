'use strict';

// ─── Event direction table ────────────────────────────────────────────────────
// Each entry defines, for a BEAT in surprise-scorer's sense (event outperformed
// expectations in the economically positive direction), which way each asset moves.
// Beat direction is relative to surprise-scorer's LOWER_IS_BETTER / HIGHER_IS_BETTER:
//   CPI/PCE/PPI beat = lower than expected (dovish) → gold +1, usd -1, spy +1, nasdaq +1
//   NFP/GDP/ISM beat = higher than expected (growth) → gold -1, usd +1, spy +1, nasdaq +1
//   FOMC beat = rate higher than expected (hawkish) → gold -1, usd +1, spy -1, nasdaq -1
//
// tier: 1.0 = Tier 1 (FOMC/CPI/NFP/PCE/GDP), 0.6 = Tier 2, 0.3 = Tier 3, 0.15 = Tier 4
// d: per-asset direction on beat (+1 bullish, -1 bearish, 0 neutral/ambiguous)

const EVENT_DIRECTION = [
  // ── Tier 1: primary market-movers ────────────────────────────────────────────
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

  // ── Tier 2: high-signal secondary data ───────────────────────────────────────
  { p: ['core ppi', 'ppi', 'producer price index'], tier: 0.6,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },
  { p: ['retail sales'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['ism manufacturing', 'manufacturing pmi', 'pmi manufacturing',
         'chicago pmi'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['ism services', 'ism non-manufacturing', 'services pmi',
         'non-manufacturing pmi'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['average hourly earnings'], tier: 0.6,
    d: { gold: +1, usd: +1, spy: -1, nasdaq: -1 } },
  { p: ['unemployment rate'], tier: 0.6,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['composite pmi', 'flash pmi', 'pmi composite'], tier: 0.55,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },

  // ── Tier 3: moderate-signal data ─────────────────────────────────────────────
  { p: ['initial jobless claims', 'continuing jobless claims',
         'jobless claims'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['consumer confidence', 'michigan consumer sentiment',
         'michigan sentiment'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['industrial production', 'capacity utilization'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['durable goods'], tier: 0.3,
    d: { gold: -1, usd: +1, spy: +1, nasdaq: +1 } },
  { p: ['import price', 'export price'], tier: 0.25,
    d: { gold: +1, usd: -1, spy: +1, nasdaq: +1 } },

  // ── Tier 4: secondary / housing ──────────────────────────────────────────────
  { p: ['building permits', 'housing starts', 'home sales',
         'pending home', 'existing home', 'new home'], tier: 0.15,
    d: { gold: -1, usd: +1, spy: +1, nasdaq:  0 } },
  { p: ['trade balance', 'trade deficit'], tier: 0.15,
    d: { gold:  0, usd: +1, spy: +1, nasdaq: +1 } },
];

// tanh normalization: squashes unbounded raw score to (-100, +100)
// SCALE tuned so that a single Tier 1 Strong Beat (raw≈60) → ~58 (solidly bullish)
const SCALE = 90;

function getEventEntry(eventName) {
  const n = String(eventName).toLowerCase();
  for (const entry of EVENT_DIRECTION) {
    if (entry.p.some((k) => n.includes(k))) return entry;
  }
  return null;
}

// Maps surprise magnitude to a base signal intensity (0–100)
function magnitudeToSignal(magnitude) {
  if (magnitude < 1.5)  return 20;  // slight
  if (magnitude < 5)    return 40;  // moderate
  if (magnitude < 15)   return 60;  // strong
  return 85;                         // major
}

// Direction of each asset under the current regime
function regimeSignal(asset, marketState) {
  const r = marketState?.computed_regime || {};
  const rr = r.risk_regime        || 'unverified';
  const rt = r.rates_trend        || 'unverified';
  const vr = r.volatility_regime  || 'unverified';
  const mr = r.market_regime      || 'unverified';

  let score = 0;

  if (asset === 'gold') {
    if (rr === 'risk-off')          score += 45;
    if (rr === 'risk-on')           score -= 20;
    if (rt === 'falling')           score += 30;
    if (rt === 'rising')            score -= 20;
    if (vr === 'high-volatility')   score += 20;
    if (mr === 'inflationary')      score += 25;
    if (mr === 'recessionary')      score += 30;
  }
  if (asset === 'usd') {
    if (rr === 'risk-off')  score += 30;
    if (rr === 'risk-on')   score -= 15;
    if (rt === 'rising')    score += 25;
    if (rt === 'falling')   score -= 20;
  }
  if (asset === 'spy') {
    if (rr === 'risk-on')            score += 35;
    if (rr === 'risk-off')           score -= 35;
    if (rt === 'falling')            score += 25;
    if (rt === 'rising')             score -= 15;
    if (vr === 'low-volatility')     score += 15;
    if (vr === 'high-volatility')    score -= 15;
    if (mr === 'recessionary')       score -= 30;
  }
  if (asset === 'nasdaq') {
    if (rr === 'risk-on')            score += 30;
    if (rr === 'risk-off')           score -= 40;
    if (rt === 'falling')            score += 40;
    if (rt === 'rising')             score -= 30;
    if (vr === 'high-volatility')    score -= 20;
    if (mr === 'recessionary')       score -= 25;
    if (mr === 'inflationary')       score -= 15;
  }

  return Math.max(-80, Math.min(80, score));
}

function scoreToDirection(score) {
  const a = Math.abs(score);
  const sign = score >= 0 ? 1 : -1;
  if (a < 10) return 'neutral';
  if (a < 28) return sign > 0 ? 'mildly bullish'   : 'mildly bearish';
  if (a < 55) return sign > 0 ? 'bullish'           : 'bearish';
  return              sign > 0 ? 'strongly bullish'  : 'strongly bearish';
}

function computeConfidence(totalTierWeight, alignedCount, conflictCount, regimeVerified) {
  const signalStrength = totalTierWeight;
  const aligned        = alignedCount >= 2;
  const clean          = conflictCount === 0;

  if (signalStrength >= 1.2 && aligned && clean && regimeVerified) return 'high';
  if (signalStrength >= 0.6 && (aligned || regimeVerified))         return 'moderate';
  if (signalStrength >= 0.3 || regimeVerified)                      return 'moderate';
  return 'low';
}

function computeBias(scoredResults, marketState) {
  const biases = {};
  const regime  = marketState?.computed_regime || {};
  const regimeVerified = regime.risk_regime && regime.risk_regime !== 'unverified';

  // Which tier is the highest-tier event we have data for?
  const hasTier1 = scoredResults.some((r) => {
    const e = getEventEntry(r.event.event_name);
    return e && e.tier >= 1.0;
  });
  const hasTier2 = scoredResults.some((r) => {
    const e = getEventEntry(r.event.event_name);
    return e && e.tier >= 0.5;
  });

  // Event/regime blend weight
  // More event data → events dominate; no data → regime fills entirely
  const eventBlend = hasTier1 ? 0.80 : (hasTier2 ? 0.65 : (scoredResults.length ? 0.45 : 0.0));
  const regimeBlend = 1 - eventBlend;

  for (const asset of ['gold', 'usd', 'spy', 'nasdaq']) {
    let rawEventScore    = 0;
    let totalTierWeight  = 0;
    let alignedCount     = 0;
    let conflictCount    = 0;
    const drivers        = [];

    for (const r of scoredResults) {
      if (r.scored.direction === 'pending' || r.scored.direction === 'inline') continue;

      const entry = getEventEntry(r.event.event_name);
      if (!entry) continue;

      const assetDir = entry.d[asset];
      if (assetDir === 0 || assetDir === undefined) continue;

      const surpriseSign = r.scored.direction === 'beat' ? +1 : -1;
      const signal       = magnitudeToSignal(r.scored.magnitude) * assetDir * surpriseSign;
      const contribution = entry.tier * signal;

      rawEventScore   += contribution;
      totalTierWeight += entry.tier * (r.scored.magnitude >= 1.5 ? 1 : 0.3);

      if (contribution > 0) alignedCount++;
      else                  conflictCount++;

      if (r.scored.magnitude >= 1.5) {
        drivers.push(`${r.event.event_name}: ${r.scored.label}`);
      }
    }

    // Multi-event conviction boost: 2+ aligned signals with no conflicts → amplify
    if (alignedCount >= 2 && conflictCount === 0) rawEventScore *= 1.25;
    if (alignedCount >= 3 && conflictCount === 0) rawEventScore *= 1.15; // stacks

    // tanh normalization: (-100, +100)
    const eventScore  = Math.tanh(rawEventScore / SCALE) * 100;
    const regScore    = regimeSignal(asset, marketState);
    const finalScore  = Math.max(-100, Math.min(100,
      eventScore * eventBlend + regScore * regimeBlend
    ));

    const direction   = scoreToDirection(finalScore);
    const confidence  = computeConfidence(totalTierWeight, alignedCount, conflictCount, regimeVerified);

    if (!drivers.length) {
      const rl = regimeLabel(regime);
      if (rl && regScore !== 0) drivers.push(`Regime: ${rl}`);
      else                      drivers.push(scoredResults.length ? 'Low-magnitude releases' : 'No data releases today');
    }

    biases[asset] = {
      direction,
      strength:   Math.round(Math.abs(finalScore)),
      score:      Math.round(finalScore),
      confidence,
      drivers:    drivers.slice(0, 4),
    };
  }

  return biases;
}

function regimeLabel(regime) {
  if (!regime) return null;
  const r  = regime.risk_regime       || '';
  const rt = regime.rates_trend       || '';
  const vr = regime.volatility_regime || '';
  const parts = [];
  if (r  === 'risk-off')         parts.push('risk-off');
  if (r  === 'risk-on')          parts.push('risk-on');
  if (rt === 'rising')           parts.push('rising rates');
  if (rt === 'falling')          parts.push('falling rates');
  if (vr === 'high-volatility')  parts.push('high-volatility');
  return parts.join(', ') || null;
}

module.exports = { computeBias };
