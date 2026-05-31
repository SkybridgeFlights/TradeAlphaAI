import { buildTradeAlphaScore } from "./scoring-engine.js";

export function applyFilters(assets, precomputedScores, state) {
  let rows = assets.map((asset, i) => ({
    asset,
    score: precomputedScores[i] || buildTradeAlphaScore(asset)
  }));

  if (state.query) {
    const q = state.query.toUpperCase();
    rows = rows.filter(({ asset }) =>
      asset.symbol.toUpperCase().includes(q) ||
      (asset.name || "").toUpperCase().includes(q) ||
      (asset.sector || asset.category || "").toUpperCase().includes(q) ||
      (asset.themes || []).some(t => t.toUpperCase().includes(q))
    );
  }

  if (state.type && state.type !== "all") {
    rows = rows.filter(({ asset }) => asset.type === state.type);
  }

  if (state.minScore > 0) {
    rows = rows.filter(({ score }) => score.finalScore >= state.minScore);
  }

  if (state.risk && state.risk !== "all") {
    rows = rows.filter(({ asset }) => asset.risk === state.risk);
  }

  if (state.sector && state.sector !== "all") {
    rows = rows.filter(({ asset }) => {
      const s = (asset.research && asset.research.sector) || asset.sector || asset.category || "";
      return s === state.sector;
    });
  }

  if (state.category && state.category !== "all") {
    rows = rows.filter(({ asset }) => {
      const c = (asset.research && asset.research.category) || asset.category || asset.sector || "";
      return c === state.category;
    });
  }

  if (state.sentiment && state.sentiment !== "all") {
    rows = rows.filter(({ asset }) => asset.sentiment === state.sentiment);
  }

  if (state.momentum && state.momentum !== "all") {
    rows = rows.filter(({ asset }) => asset.macdTrend === state.momentum);
  }

  if (state.setupLabel && state.setupLabel !== "all") {
    rows = rows.filter(({ score }) => score.label === state.setupLabel);
  }

  if (state.minPrice > 0) {
    rows = rows.filter(({ asset }) => (asset.price || 0) >= state.minPrice);
  }
  if (state.maxPrice > 0) {
    rows = rows.filter(({ asset }) => (asset.price || 0) <= state.maxPrice);
  }

  return rows;
}

export function sortRows(rows, sortKey) {
  const sorted = [...rows];
  switch (sortKey) {
    case "momentum": sorted.sort((a, b) => b.score.momentum - a.score.momentum); break;
    case "risk": sorted.sort((a, b) => b.score.risk - a.score.risk); break;
    case "symbol": sorted.sort((a, b) => a.asset.symbol.localeCompare(b.asset.symbol)); break;
    case "price": sorted.sort((a, b) => (b.asset.price || 0) - (a.asset.price || 0)); break;
    case "change": sorted.sort((a, b) => (b.asset.changePercent || 0) - (a.asset.changePercent || 0)); break;
    case "name": sorted.sort((a, b) => (a.asset.name || "").localeCompare(b.asset.name || "")); break;
    default: sorted.sort((a, b) => b.score.finalScore - a.score.finalScore); break;
  }
  return sorted;
}

export function getSetupLabels() {
  return ["Strong Setup", "Watchlist Candidate", "Overextended", "Neutral Setup", "High Risk", "Weak Setup"];
}

export function getMomentumOptions() {
  return ["bullish", "neutral", "bearish"];
}
