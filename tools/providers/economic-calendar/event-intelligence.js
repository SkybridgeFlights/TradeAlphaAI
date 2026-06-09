'use strict';

// Deterministic impact inference — no fabricated values, no prediction language.
// Designed for educational display only; not investment advice.

const IMPACT_RULES = [
  { pattern: /holiday|bank\s*holiday|market\s*closed/i,                      impact: 'holiday', score: 0 },
  { pattern: /core.*cpi|core.*consumer\s*price/i,                            impact: 'high',    score: 95 },
  { pattern: /core.*pce|core.*personal\s*consumption/i,                      impact: 'high',    score: 92 },
  { pattern: /\bcpi\b|consumer\s*price\s*index/i,                            impact: 'high',    score: 90 },
  { pattern: /\bpce\b|personal\s*consumption\s*expenditure/i,                impact: 'high',    score: 88 },
  { pattern: /nonfarm|nfp|\bpayrolls?\b|employment\s*situation/i,            impact: 'high',    score: 98 },
  { pattern: /unemployment\s*rate/i,                                         impact: 'high',    score: 85 },
  { pattern: /fomc|federal\s*funds\s*rate|fed\s*rate\s*decision/i,          impact: 'high',    score: 100 },
  { pattern: /ecb.*rate|rate.*ecb|european\s*central\s*bank.*rate/i,        impact: 'high',    score: 88 },
  { pattern: /boj|boe.*rate|bank\s*of\s*(japan|england).*rate/i,            impact: 'high',    score: 84 },
  { pattern: /\bgdp\b|gross\s*domestic\s*product/i,                         impact: 'high',    score: 90 },
  { pattern: /retail\s*sales/i,                                              impact: 'high',    score: 78 },
  { pattern: /ism.*pmi|ism\s*(manufacturing|services|non.?manufacturing)/i,  impact: 'high',    score: 76 },
  { pattern: /initial.*claims|jobless\s*claims|unemployment\s*insurance/i,  impact: 'high',    score: 66 },
  { pattern: /\bpmi\b|purchasing\s*managers/i,                               impact: 'medium',  score: 62 },
  { pattern: /industrial\s*production/i,                                     impact: 'medium',  score: 58 },
  { pattern: /consumer\s*(confidence|sentiment)/i,                           impact: 'medium',  score: 55 },
  { pattern: /housing\s*starts|building\s*permits/i,                         impact: 'medium',  score: 52 },
  { pattern: /durable\s*goods/i,                                             impact: 'medium',  score: 56 },
  { pattern: /trade\s*balance|current\s*account/i,                           impact: 'medium',  score: 54 },
  { pattern: /producer\s*price|\bppi\b|import\s*price|export\s*price/i,     impact: 'medium',  score: 60 },
  { pattern: /existing\s*home\s*sales|new\s*home\s*sales|pending\s*home/i,  impact: 'medium',  score: 48 },
  { pattern: /factory\s*orders|manufacturing\s*orders/i,                     impact: 'medium',  score: 50 },
  { pattern: /treasury.*auction|bond.*auction/i,                             impact: 'low',     score: 40 },
];

const CATEGORY_RULES = [
  { pattern: /cpi|consumer\s*price|pce|personal\s*consumption\s*expenditure|inflation|deflation/i, category: 'inflation' },
  { pattern: /nonfarm|nfp|payroll|employment\s*situation|jobless|unemployment|jobs\s*report|labor|labour/i, category: 'labor' },
  { pattern: /fomc|fed\s*rate|federal\s*funds|ecb.*rate|boj|boe.*rate|bank\s*of\s*england|bank\s*of\s*japan|rate\s*decision|monetary\s*policy/i, category: 'central_bank' },
  { pattern: /\bgdp\b|gross\s*domestic\s*product/i,                          category: 'growth' },
  { pattern: /retail\s*sales|consumer\s*spending|personal\s*income|consumer\s*expenditure/i, category: 'consumption' },
  { pattern: /\bpmi\b|purchasing\s*managers|ism.*pmi|business\s*survey|business\s*activity/i, category: 'pmi' },
  { pattern: /housing\s*starts|building\s*permits|home\s*sales|existing\s*home|pending\s*home|case.shiller|homebuilder/i, category: 'housing' },
  { pattern: /trade\s*balance|current\s*account|import\s*price|export\s*price|tariff|customs/i, category: 'trade' },
  { pattern: /oil|crude|natural\s*gas|gasoline|petroleum|eia\s*petroleum/i,  category: 'energy' },
  { pattern: /treasury|auction|t.bill|t.note|t.bond|yield\s*curve/i,         category: 'treasury' },
  { pattern: /holiday|bank\s*holiday|market\s*closed/i,                      category: 'holiday' },
];

const CATEGORY_SENSITIVITY = {
  inflation:    ['rates', 'dollar', 'gold', 'bonds', 'equities'],
  labor:        ['equities', 'rates', 'dollar', 'vix'],
  central_bank: ['rates', 'dollar', 'gold', 'equities', 'bonds', 'vix'],
  growth:       ['equities', 'bonds', 'dollar', 'commodities'],
  consumption:  ['equities', 'dollar', 'consumer_discretionary'],
  pmi:          ['equities', 'commodities', 'dollar'],
  housing:      ['rates', 'reits', 'equities'],
  trade:        ['dollar', 'equities', 'commodities'],
  energy:       ['oil', 'energy_equities', 'dollar'],
  treasury:     ['rates', 'bonds', 'dollar'],
  holiday:      [],
  other:        ['equities', 'dollar'],
};

function inferImpact(eventName) {
  const text = String(eventName || '');
  for (const rule of IMPACT_RULES) {
    if (rule.pattern.test(text)) return { impact: rule.impact, score: rule.score };
  }
  return { impact: 'low', score: 20 };
}

function inferCategory(eventName) {
  const text = String(eventName || '');
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(text)) return rule.category;
  }
  return 'other';
}

function computeSurprise(event) {
  const actual   = event.actual;
  const forecast = event.forecast;
  const previous = event.previous;
  if (actual === null || actual === undefined) {
    return { available: false, direction: 'unknown', magnitude: 'unknown' };
  }
  const ref = (forecast !== null && forecast !== undefined) ? forecast : previous;
  if (ref === null || ref === undefined) {
    return { available: true, direction: 'unknown', magnitude: 'unknown' };
  }
  const diff    = actual - ref;
  const pctDiff = Math.abs(diff) / (Math.abs(ref) || 1);
  const direction = Math.abs(diff) < 0.001 ? 'inline' : diff > 0 ? 'above' : 'below';
  const magnitude = pctDiff < 0.02 ? 'low' : pctDiff < 0.08 ? 'medium' : 'high';
  return { available: true, direction, magnitude };
}

function computeIntelligence(event) {
  const name        = event.event_name || event.name || '';
  const category    = inferCategory(name);
  const impactInfo  = inferImpact(name);
  const sensitivity = CATEGORY_SENSITIVITY[category] || CATEGORY_SENSITIVITY.other;
  const surprise    = computeSurprise(event);
  return {
    category,
    impact_score: impactInfo.score,
    market_sensitivity: sensitivity,
    surprise,
  };
}

module.exports = { inferImpact, inferCategory, computeSurprise, computeIntelligence };
