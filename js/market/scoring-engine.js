import { calculateTechnicalScore, calculateMomentumScore } from "./technical-analysis.js";
import { calculateFundamentalScore } from "./fundamental-analysis.js";
import { calculateSentimentScore } from "./sentiment-engine.js";

export function buildTradeAlphaScore(asset) {
  const technical = calculateTechnicalScore(asset);
  const fundamental = calculateFundamentalScore(asset);
  const momentum = calculateMomentumScore(asset);
  const sentiment = calculateSentimentScore(asset);
  const riskPenalty = calculateRiskPenalty(asset);
  const raw = (technical * 0.3) + (fundamental * 0.25) + (momentum * 0.2) + (sentiment * 0.1) + ((100 - riskPenalty) * 0.15);
  const finalScore = clamp(Math.round(raw - riskPenalty * 0.12));

  return {
    technical,
    fundamental,
    momentum,
    sentiment,
    risk: clamp(100 - riskPenalty),
    riskPenalty,
    finalScore,
    label: getSafeLabel(finalScore, asset, riskPenalty)
  };
}

export function getSafeLabel(score, asset, riskPenalty = calculateRiskPenalty(asset)) {
  if (riskPenalty >= 48) return "High Risk";
  if (asset.rsi >= 70 && score >= 60) return "Overextended";
  if (score >= 78) return "Strong Setup";
  if (score >= 64) return "Watchlist Candidate";
  if (score >= 46) return "Neutral Setup";
  return "Weak Setup";
}

function calculateRiskPenalty(asset) {
  const riskBase = {
    low: 12,
    moderate: 25,
    elevated: 38,
    high: 55
  }[asset.risk] ?? 30;

  const volatilityPenalty = asset.volatility ? Math.round(asset.volatility * 42) : 10;
  const overextensionPenalty = asset.rsi >= 70 ? 12 : 0;
  return clamp(riskBase + volatilityPenalty + overextensionPenalty, 0, 70);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

