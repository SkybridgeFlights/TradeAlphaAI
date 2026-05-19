export function calculateTechnicalScore(asset) {
  const trendScore = scoreTrend(asset);
  const rsiScore = scoreRsi(asset.rsi);
  const macdScore = scoreMacd(asset.macdTrend);
  const volumeScore = scoreVolume(asset.volumeTrend);

  return clamp(Math.round((trendScore * 0.38) + (rsiScore * 0.24) + (macdScore * 0.24) + (volumeScore * 0.14)));
}

export function calculateMomentumScore(asset) {
  const above50 = asset.price >= asset.ma50 ? 20 : -8;
  const above200 = asset.price >= asset.ma200 ? 22 : -10;
  const change = clamp(50 + (asset.changePercent * 7), 0, 100);
  const rsiPulse = asset.rsi >= 45 && asset.rsi <= 68 ? 16 : asset.rsi > 72 ? -12 : 2;

  return clamp(Math.round(42 + above50 + above200 + ((change - 50) * 0.45) + rsiPulse));
}

export function getTechnicalInsights(asset) {
  const priceVs50 = asset.price >= asset.ma50 ? "above the 50-day average" : "below the 50-day average";
  const priceVs200 = asset.price >= asset.ma200 ? "above the 200-day average" : "below the 200-day average";
  const rsiState = asset.rsi >= 70 ? "overextended" : asset.rsi >= 55 ? "constructive" : asset.rsi >= 40 ? "balanced" : "weak";

  return [
    `RSI is ${asset.rsi}, which screens as ${rsiState}.`,
    `Price is ${priceVs50} and ${priceVs200}.`,
    `MACD trend is ${asset.macdTrend}.`,
    `Volume trend is ${asset.volumeTrend}.`
  ];
}

function scoreTrend(asset) {
  let score = 45;
  if (asset.price >= asset.ma50) score += 22;
  if (asset.price >= asset.ma200) score += 24;
  if (asset.ma50 >= asset.ma200) score += 9;
  return clamp(score);
}

function scoreRsi(rsi) {
  if (rsi >= 45 && rsi <= 62) return 82;
  if (rsi > 62 && rsi <= 70) return 72;
  if (rsi > 70) return 48;
  if (rsi >= 35) return 58;
  return 32;
}

function scoreMacd(trend) {
  if (trend === "bullish") return 82;
  if (trend === "bearish") return 34;
  return 58;
}

function scoreVolume(trend) {
  if (trend === "above average") return 72;
  if (trend === "below average") return 42;
  return 58;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

