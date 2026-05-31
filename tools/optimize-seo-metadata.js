#!/usr/bin/env node
// Phase 18 — SEO metadata optimization for stock and ETF research asset files.
// Improves seo.title, seo.description, and expands faq arrays for all assets.
// Run: node tools/optimize-seo-metadata.js
// Then regenerate pages: npm run generate:market-pages && npm run generate:comparisons

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stocksDir = path.join(root, "data", "research-assets", "stocks");
const etfsDir = path.join(root, "data", "research-assets", "etfs");

let updated = 0;

// Overrides for symbols where themes[0] is generic or duplicates another symbol
const THEME_OVERRIDES = {
  // Stocks — use a more search-intent-aligned theme
  AMZN: "E-commerce & Cloud",
  AAPL: "iPhone & Services",
  DIS: "Streaming & Parks",
  MCD: "Fast Food & Franchising",
  SBUX: "Coffee & Retail",
  // ETFs — differentiate broadly similar funds
  SPY: "S&P 500 Index",
  VOO: "S&P 500 Low-Cost",
  VTI: "Total U.S. Market",
  IWM: "Small-Cap Equities",
  TLT: "Long-Term Treasuries",
  IEF: "Intermediate Treasuries",
  BND: "Total Bond Market",
  HYG: "High Yield Bonds",
  LQD: "Investment Grade Bonds",
  GLD: "Gold Commodity",
  GDX: "Gold Mining Stocks",
  TQQQ: "3x Leveraged Nasdaq",
  SOXL: "Leveraged Semiconductors",
  SMH: "Semiconductor Index",
  SOXX: "Semiconductors",
  ROBO: "Robotics Automation",
  BOTZ: "Robotics & AI",
};

// --- stock title / description helpers ---

function shortCompanyName(name) {
  return name
    .replace(/\b(Incorporated|Corporation|Technologies|Technology|Platforms|Holdings|Holding|Company|Group)\b/gi, "")
    .replace(/\b(Inc\.|Corp\.|Ltd\.|Co\.)\s*/gi, "")
    .replace(/\b(Inc|Corp|Ltd|plc|A\/S)\b/gi, "")
    .replace(/\.com\b/gi, "")
    .replace(/&\s*Co\.?\b/gi, "")
    .replace(/^The\s+/i, "")
    .replace(/\s+/g, " ")
    .replace(/\s+\.$/, "")
    .trim()
    .split(" ").slice(0, 2).join(" ");
}

function stockTitle(symbol, name, themes) {
  const short = shortCompanyName(name);
  const theme = THEME_OVERRIDES[symbol] || (themes && themes[0] ? themes[0] : "Market Research");
  const brand = " | TradeAlphaAI";

  const candidate1 = `${short} (${symbol}) Stock Analysis: ${theme} & Research${brand}`;
  if (candidate1.length <= 70) return candidate1;

  const candidate2 = `${symbol} Stock Analysis: ${theme} & Market Research${brand}`;
  if (candidate2.length <= 70) return candidate2;

  const candidate3 = `${symbol} Stock Analysis: ${theme} Research${brand}`;
  if (candidate3.length <= 70) return candidate3;

  return `${symbol} Stock Analysis: ${theme.split(" ")[0]} Research${brand}`;
}

function stockDescription(symbol, name, sector, themes) {
  const t1 = themes[0] || sector;
  const t2 = themes[1] || themes[0] || sector;
  return `Research ${name} (${symbol}): ${t1} and ${t2} exposure, business model context, valuation outlook, risk factors, and related ETF coverage. Educational analysis only.`.slice(0, 160);
}

function stockFaq(symbol, name, sector, themes) {
  const t1 = themes[0] || sector;
  const t2 = themes[1] || themes[0] || sector;
  return [
    {
      q: `Why do investors follow ${symbol}?`,
      a: `${symbol} is followed for exposure to ${t1}, sector leadership, earnings sensitivity, and valuation context.`
    },
    {
      q: `What sector does ${symbol} belong to?`,
      a: `${symbol} is in the ${sector} sector. Research themes include ${themes.slice(0, 3).join(", ")}. This is educational context, not investment advice.`
    },
    {
      q: `What are the main research themes for ${symbol}?`,
      a: `${symbol} research focuses on ${t1} as a primary theme, with secondary exposure to ${t2}. This is an educational overview only.`
    },
    {
      q: `Is ${symbol} research financial advice?`,
      a: "No. This page is educational research only and does not provide investment or financial advice."
    }
  ];
}

// --- ETF title / description helpers ---

function etfTitle(symbol, name, category, themes) {
  const theme = THEME_OVERRIDES[symbol] || (themes && themes[0] ? themes[0] : category);
  const brand = " | TradeAlphaAI";

  const candidate1 = `${symbol} ETF Analysis: ${theme} Holdings & Risk${brand}`;
  if (candidate1.length <= 70) return candidate1;

  const catShort = (category || "").split(" ").slice(0, 2).join(" ");
  const candidate2 = `${symbol} ETF: ${catShort} Holdings & Risk${brand}`;
  if (candidate2.length <= 70) return candidate2;

  return `${symbol} ETF Analysis: Holdings, Risk & Research${brand}`;
}

function etfDescription(symbol, name, category, themes) {
  const t1 = themes[0] || category;
  return `Research ${name} (${symbol}): ${category} ETF methodology, ${t1} exposure, top holdings, sector allocation, expense context, and portfolio diversification research.`.slice(0, 160);
}

function etfFaq(symbol, name, category, themes) {
  const t1 = themes[0] || category;
  const t2 = themes[1] || themes[0] || category;
  return [
    {
      q: `What does ${symbol} ETF track?`,
      a: `${symbol} is a ${category} ETF providing ${t1} exposure. Holdings and index methodology vary by rebalancing. Verify in the fund's prospectus.`
    },
    {
      q: `What themes does ${symbol} cover?`,
      a: `${symbol} research themes include ${themes.slice(0, 3).join(", ")}. This provides educational context on ${t1} and ${t2} exposure.`
    },
    {
      q: `How is ${symbol} used in portfolio research?`,
      a: `${symbol} is studied as a ${category} ETF for ${t1} exposure analysis and diversification context. This is educational, not investment advice.`
    },
    {
      q: `Is ${symbol} ETF analysis financial advice?`,
      a: "No. This page is educational research only and does not provide investment or financial advice."
    }
  ];
}

// --- process stock files ---
const stockFiles = fs.readdirSync(stocksDir).filter((f) => f.endsWith(".json"));
for (const file of stockFiles) {
  const filePath = path.join(stocksDir, file);
  const asset = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const { symbol, name, sector, themes = [] } = asset;
  if (!symbol) continue;

  const newTitle = stockTitle(symbol, name, themes);
  const newDesc = stockDescription(symbol, name, sector, themes);
  const newFaq = stockFaq(symbol, name, sector, themes);

  const oldTitle = asset.seo?.title;
  const changed = oldTitle !== newTitle;

  asset.seo = {
    ...(asset.seo || {}),
    title: newTitle,
    description: newDesc
  };
  asset.faq = newFaq;

  fs.writeFileSync(filePath, JSON.stringify(asset, null, 2) + "\n", "utf8");
  if (changed) {
    console.log(`  stock ${symbol}: ${newTitle}`);
    updated++;
  }
}

// --- process ETF files ---
const etfFiles = fs.readdirSync(etfsDir).filter((f) => f.endsWith(".json"));
for (const file of etfFiles) {
  const filePath = path.join(etfsDir, file);
  const asset = JSON.parse(fs.readFileSync(filePath, "utf8"));

  const { symbol, name, category = "Equity", themes = [] } = asset;
  if (!symbol) continue;

  const newTitle = etfTitle(symbol, name, category, themes);
  const newDesc = etfDescription(symbol, name, category, themes);
  const newFaq = etfFaq(symbol, name, category, themes);

  const oldTitle = asset.seo?.title;
  const changed = oldTitle !== newTitle;

  asset.seo = {
    ...(asset.seo || {}),
    title: newTitle,
    description: newDesc
  };
  asset.faq = newFaq;

  fs.writeFileSync(filePath, JSON.stringify(asset, null, 2) + "\n", "utf8");
  if (changed) {
    console.log(`  etf ${symbol}: ${newTitle}`);
    updated++;
  }
}

console.log(`\nSEO metadata optimization complete.`);
console.log(`  Stock files updated: ${stockFiles.length}`);
console.log(`  ETF files updated: ${etfFiles.length}`);
console.log(`  Total updated: ${updated}`);
