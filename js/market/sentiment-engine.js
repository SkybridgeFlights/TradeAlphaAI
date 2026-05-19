export function calculateSentimentScore(asset) {
  if (asset.sentiment === "positive") return 78;
  if (asset.sentiment === "mixed") return 54;
  if (asset.sentiment === "negative") return 34;
  return 60;
}

export function getSentimentSummary(asset) {
  const tone = {
    positive: "Market commentary screens as constructive, but the score still needs confirmation from price trend and risk data.",
    neutral: "Market commentary screens as balanced, with no strong sentiment edge in the mock dataset.",
    mixed: "Market commentary screens as mixed, which can increase uncertainty around short-term interpretation.",
    negative: "Market commentary screens as cautious, which may weigh on the overall setup score."
  };

  return tone[asset.sentiment] || tone.neutral;
}

