#!/usr/bin/env node
// Phase 20 Task 5 — Update OG/Twitter meta tags to match improved titles
const fs = require("fs");

const PAGES = [
  {
    file: "dividend-etfs.html",
    ogTitle: "Dividend ETFs Research: SCHD, VIG, JEPI & Income ETF Watchlists | TradeAlphaAI",
    ogDesc: "Research dividend ETFs including SCHD, VIG, and JEPI: yield mechanics, quality screens, expense ratios, rate sensitivity, and sector allocation. Educational use only."
  },
  {
    file: "semiconductor-stocks.html",
    ogTitle: "Semiconductor Stocks Research: NVDA, AMD, SOXX & AI Chip Analysis | TradeAlphaAI",
    ogDesc: "Research semiconductor stocks including NVDA, AMD, AVGO, and SOXX: AI chip demand, capex cycles, inventory risk, and sector context. Educational use only."
  },
  {
    file: "defensive-stocks.html",
    ogTitle: "Defensive Stocks Research: KO, JNJ, PG & Low-Beta Equity Watchlists | TradeAlphaAI",
    ogDesc: "Research defensive stocks including KO, JNJ, PG, and healthcare names: sector context, beta, dividend durability, and market downturn resilience. Educational use only."
  },
  {
    file: "defensive-etfs.html",
    ogTitle: "Defensive ETFs Research: SCHD, BND, XLP & Low-Volatility Funds | TradeAlphaAI",
    ogDesc: "Research defensive ETFs including SCHD, BND, XLP, and XLV: low-beta strategies, rate sensitivity, drawdown history, and defensive allocation context. Educational use only."
  },
  {
    file: "healthcare-etfs.html",
    ogTitle: "Healthcare ETFs Research: XLV, XBI & Pharma Sector Watchlists | TradeAlphaAI",
    ogDesc: "Research healthcare ETFs including XLV and XBI: pharma vs biotech exposure, defensive sector context, drawdown history, and expense ratios. Educational use only."
  }
];

let fixed = 0;
for (const p of PAGES) {
  if (!fs.existsSync(p.file)) { console.log("MISSING:", p.file); continue; }
  let html = fs.readFileSync(p.file, "utf8");
  html = html.replace(/(<meta property="og:title" content=")[^"]*(")/g, "$1" + p.ogTitle + "$2");
  html = html.replace(/(<meta name="twitter:title" content=")[^"]*(")/g, "$1" + p.ogTitle + "$2");
  html = html.replace(/(<meta property="og:description" content=")[^"]*(")/g, "$1" + p.ogDesc + "$2");
  html = html.replace(/(<meta name="twitter:description" content=")[^"]*(")/g, "$1" + p.ogDesc + "$2");
  fs.writeFileSync(p.file, html, "utf8");
  console.log("FIXED OG:", p.file);
  fixed++;
}
console.log("Total:", fixed);
