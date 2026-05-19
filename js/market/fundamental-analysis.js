export function calculateFundamentalScore(asset) {
  const growth = scoreGrowth(asset.revenueGrowth);
  const valuation = scoreValuation(asset.peRatio, asset.type);
  const margin = scoreMargin(asset.profitMargin);
  return clamp(Math.round((growth * 0.34) + (valuation * 0.32) + (margin * 0.34)));
}

export function getFundamentalInsights(asset) {
  return [
    `Revenue growth screens at ${formatPercent(asset.revenueGrowth)}.`,
    `P/E ratio is ${asset.peRatio}, which is reviewed as a valuation context metric, not a recommendation.`,
    `Profit margin screens at ${formatPercent(asset.profitMargin)}.`
  ];
}

function scoreGrowth(value) {
  if (value >= 0.3) return 92;
  if (value >= 0.15) return 78;
  if (value >= 0.05) return 62;
  if (value >= 0) return 48;
  return 26;
}

function scoreValuation(pe, type) {
  if (type === "etf") return pe <= 25 ? 72 : pe <= 35 ? 58 : 42;
  if (pe <= 18) return 84;
  if (pe <= 30) return 70;
  if (pe <= 45) return 54;
  return 36;
}

function scoreMargin(value) {
  if (value >= 0.3) return 88;
  if (value >= 0.18) return 74;
  if (value >= 0.1) return 58;
  if (value >= 0.03) return 42;
  return 26;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

