const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const site = "https://www.tradealphaai.com";

const data = readJson("data/localization/ar-pages.json", { pages: [], generatedAt: "2026-05-20" });
const phase1 = readJson("data/localization/ar-phase1-pages.json", { pages: [] });
const marketConfig = readJson("data/market-symbols.json", { symbols: [], hubs: [] });
const landingTranslations = loadLandingTranslations();

const AR = {
  nav: {
    Home: "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©",
    "AI Stock Analyzer": "Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
    "ETF Analyzer": "Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª",
    "Market Screener": "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚",
    "Articles": "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚",
    Methodology: "Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©",
    Insights: "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚",
    Stocks: "Ø§Ù„Ø£Ø³Ù‡Ù…",
    ETFs: "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª"
  },
  labels: {
    "AI Market Portal": "Ø¨ÙˆØ§Ø¨Ø© Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚",
    Primary: "Ø§Ù„ØªÙ†Ù‚Ù„ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ",
    Language: "Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù„ØºØ©",
    "Generated Stock Page": "ØµÙØ­Ø© Ø³Ù‡Ù… ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "Generated ETF Page": "ØµÙØ­Ø© ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ©",
    "SEO Overview": "Ù†Ø¸Ø±Ø© Ø¹Ø§Ù…Ø© Ø¨Ø­Ø«ÙŠØ©",
    "Score Breakdown": "ØªÙØµÙŠÙ„ Ø§Ù„Ø¯Ø±Ø¬Ø©",
    "Company Snapshot": "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
    "ETF Snapshot": "Ù…Ù„Ù Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚",
    Sector: "Ø§Ù„Ù‚Ø·Ø§Ø¹",
    Type: "Ø§Ù„Ù†ÙˆØ¹",
    "Data Mode": "ÙˆØ¶Ø¹ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª",
    Priority: "Ø§Ù„Ø£ÙˆÙ„ÙˆÙŠØ©",
    Indicators: "Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª",
    "Technical and fundamental cards": "Ø¨Ø·Ø§Ù‚Ø§Øª ÙÙ†ÙŠØ© ÙˆØ£Ø³Ø§Ø³ÙŠØ©",
    "Technical Outlook": "Ø§Ù„Ù†Ø¸Ø±Ø© Ø§Ù„ÙÙ†ÙŠØ©",
    "Trend context": "Ø³ÙŠØ§Ù‚ Ø§Ù„Ø§ØªØ¬Ø§Ù‡",
    "Fundamental Overview": "Ù†Ø¸Ø±Ø© Ø£Ø³Ø§Ø³ÙŠØ©",
    "Growth and valuation": "Ø§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„ØªÙ‚ÙŠÙŠÙ…",
    "AI Summary": "Ù…Ù„Ø®Øµ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
    "Educational explanation": "Ø´Ø±Ø­ ØªØ¹Ù„ÙŠÙ…ÙŠ",
    "Risk Overview": "Ù†Ø¸Ø±Ø© Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
    "Risk factors": "Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
    "Related Assets": "Ø£ØµÙˆÙ„ Ù…Ø±ØªØ¨Ø·Ø©",
    "Explore more": "Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ù…Ø²ÙŠØ¯",
    FAQ: "Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©",
    "Continue Reading": "ØªØ§Ø¨Ø¹ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©",
    "Explore connected market research": "Ø§Ø³ØªÙƒØ´Ù Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø©",
    Explore: "Ø§Ø³ØªÙƒØ´Ù",
    "Continue research": "ØªØ§Ø¨Ø¹ Ø§Ù„Ø¨Ø­Ø«",
    "Market Screener": "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚",
    "Methodology": "Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©",
    "TradeAlpha Score": "Ø¯Ø±Ø¬Ø© TradeAlpha",
    "Market profile": "Ù…Ù„Ù Ø§Ù„Ø³ÙˆÙ‚",
    "educational analysis overview": "Ù†Ø¸Ø±Ø© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø¹Ø§Ù…Ø©",
    "Latest Market Research": "Ø£Ø­Ø¯Ø« Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚",
    "Rotating Market Themes": "Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ù…ØªØºÙŠØ±Ø©",
    "Research Spotlight": "Ø¨Ø­Ø« Ù…Ø®ØªØ§Ø±",
    Contents: "Ø§Ù„Ù…Ø­ØªÙˆÙŠØ§Øª",
    "Reference context": "Ù…Ø±Ø§Ø¬Ø¹ Ø³ÙŠØ§Ù‚ÙŠØ©",
    "Educational disclaimer": "ØªÙ†Ø¨ÙŠÙ‡ ØªØ¹Ù„ÙŠÙ…ÙŠ",
    "Frequently Asked Questions": "Ø£Ø³Ø¦Ù„Ø© Ø´Ø§Ø¦Ø¹Ø©",
    "Related research": "Ø£Ø¨Ø­Ø§Ø« Ù…Ø±ØªØ¨Ø·Ø©",
    "Related Paths": "Ù…Ø³Ø§Ø±Ø§Øª Ù…Ø±ØªØ¨Ø·Ø©",
    "Open Articles": "Ø§ÙØªØ­ Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚",
    "Open Market Screener": "Ø§ÙØªØ­ Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚",
    "Read Articles": "Ø§Ù‚Ø±Ø£ Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚"
  },
  terms: [
    ["Score Model", "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯Ø±Ø¬Ø©"],
    ["Screening Tool", "Ø£Ø¯Ø§Ø© Ø§Ù„ÙØ­Øµ"],
    ["Start Screening", "Ø§Ø¨Ø¯Ø£ Ø§Ù„ÙØ­Øµ"],
    ["Join AI Market Alerts", "Ø§Ø´ØªØ±Ùƒ ÙÙŠ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª TradeAlphaAI"],
    ["Follow public Telegram updates and market education from TradeAlphaAI.", "ØªØ§Ø¨Ø¹ Ø§Ù„ØªØ­Ø¯ÙŠØ«Ø§Øª Ø§Ù„Ø¹Ø§Ù…Ø© Ø¹Ù„Ù‰ Telegram ÙˆØ§Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ Ù…Ù† TradeAlphaAI."],
    ["Popular Stock Analysis", "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©"],
    ["Screen high-interest stocks", "ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù…"],
    ["Analyze Stock", "Ø­Ù„Ù„ Ø§Ù„Ø³Ù‡Ù…"],
    ["Analyze ETF", "Ø­Ù„Ù„ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚"],
    ["View NVDA", "Ø¹Ø±Ø¶ NVDA"],
    ["View SPY", "Ø¹Ø±Ø¶ SPY"],
    ["View QQQ", "Ø¹Ø±Ø¶ QQQ"],
    ["Free Stock Screening", "ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ"],
    ["Free ETF Screening", "ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ"],
    ["This analysis is for educational and informational purposes only and does not constitute financial advice.", "Ù‡Ø°Ø§ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©."],
    ["educational and informational purposes only and does not constitute financial advice", "Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©"],
    ["not financial advice", "Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©"],
    ["financial advice", "Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©"],
    ["AI Stock Analysis", "ØªØ­Ù„ÙŠÙ„ Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ"],
    ["ETF Analysis", "ØªØ­Ù„ÙŠÙ„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª"],
    ["Stock Analysis", "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø£Ø³Ù‡Ù…"],
    ["ETF Analyzer", "Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª"],
    ["AI Stock Analyzer", "Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ"],
    ["Articles", "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚"],
    ["Market Research", "Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚"],
    ["Market Screener", "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚"],
    ["TradeAlpha Score", "Ø¯Ø±Ø¬Ø© TradeAlpha"],
    ["Score Breakdown", "ØªÙØµÙŠÙ„ Ø§Ù„Ø¯Ø±Ø¬Ø©"],
    ["Technical", "ÙÙ†ÙŠ"],
    ["Fundamental", "Ø£Ø³Ø§Ø³ÙŠ"],
    ["Momentum", "Ø§Ù„Ø²Ø®Ù…"],
    ["Sentiment", "Ø§Ù„Ù…Ø¹Ù†ÙˆÙŠØ§Øª"],
    ["Risk", "Ø§Ù„Ù…Ø®Ø§Ø·Ø±"],
    ["Volatility", "Ø§Ù„ØªØ°Ø¨Ø°Ø¨"],
    ["Diversification", "Ø§Ù„ØªÙ†ÙˆÙŠØ¹"],
    ["Semiconductors", "Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª"],
    ["Semiconductor", "Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª"],
    ["AI Infrastructure", "Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ"],
    ["Artificial Intelligence", "Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ"],
    ["Technology", "Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§"],
    ["Stocks", "Ø§Ù„Ø£Ø³Ù‡Ù…"],
    ["Stock", "Ø³Ù‡Ù…"],
    ["ETFs", "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª"],
    ["ETF", "ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª"],
    ["Methodology", "Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©"],
    ["Home", "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©"],
    ["Insights", "Ø§Ù„Ø±Ø¤Ù‰"],
    ["Updated", "Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«"],
    ["Continue reading", "ØªØ§Ø¨Ø¹ Ø§Ù„Ù‚Ø±Ø§Ø¡Ø©"],
    ["Current research themes", "Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ø­Ø§Ù„ÙŠØ©"],
    ["Featured and recent research", "Ø£Ø¨Ø­Ø§Ø« Ù…Ø®ØªØ§Ø±Ø© ÙˆØ­Ø¯ÙŠØ«Ø©"],
    ["Updated market research timeline", "Ø®Ø· Ø²Ù…Ù†ÙŠ Ù…Ø­Ø¯Ø« Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚"],
    ["Educational content only.", "Ù…Ø­ØªÙˆÙ‰ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø·."],
    ["Research only.", "Ù„Ù„Ø¨Ø­Ø« ÙÙ‚Ø·."],
    ["No.", "Ù„Ø§."],
    ["FAQ", "Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©"]
  ],
  disclaimer: "Ù‡Ø°Ø§ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ© Ø£Ùˆ Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ© Ø£Ùˆ ØªÙˆØµÙŠØ© Ø¨Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹ Ø£ÙŠ ÙˆØ±Ù‚Ø© Ù…Ø§Ù„ÙŠØ©. Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ø³Ø§Ø¨Ù‚ Ù„Ø§ ÙŠØ¶Ù…Ù† Ø§Ù„Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ©ØŒ ÙˆÙŠØ¬Ø¨ Ø§Ø³ØªØ´Ø§Ø±Ø© Ù…Ø®ØªØµ Ù…Ø¤Ù‡Ù„ Ù‚Ø¨Ù„ Ø§ØªØ®Ø§Ø° Ù‚Ø±Ø§Ø±Ø§Øª Ù…Ø§Ù„ÙŠØ© Ø´Ø®ØµÙŠØ©."
};

const pages = buildPages();
const pageBySource = new Map(pages.map((page) => [norm(page.source), page]));

run();

function run() {
  normalizeEnglishSources();

  for (const page of pages) {
    if (!page.static_ar) writeLocalizedPage(page, "ar");
    writeLocalizedPage(page, "en");
    syncEnglishSource(page);
  }

  writeSitemap();
  syncRobots();
  writeLanguageRouter();
  console.log(`Generated ${pages.length} same-structure Arabic pages and English aliases.`);
}

function buildPages() {
  const merged = [...(data.pages || []), ...(phase1.pages || [])];
  const bySource = new Map();
  for (const page of merged) addPage(bySource, page);

  for (const source of [
    "index.html",
    "stocks.html",
    "etfs.html",
    "ai-stock-screener.html",
    "rankings.html",
    "market-data-status.html",
    "methodology.html"
  ]) addPage(bySource, inferredPage(source, "core"));

  for (const hub of marketConfig.hubs || []) addPage(bySource, inferredPage(hub.pagePath, "hub"));
  for (const symbol of marketConfig.symbols || []) addPage(bySource, inferredPage(symbol.pagePath, symbol.type || "symbol"));
  for (const assetPage of researchAssetPages()) addPage(bySource, inferredPage(assetPage.source, assetPage.type));

  const insightsDir = path.join(root, "insights");
  if (fs.existsSync(insightsDir)) {
    for (const name of fs.readdirSync(insightsDir)) {
      if (!name.endsWith(".html")) continue;
      addPage(bySource, inferredPage(`insights/${name}`, name === "index.html" ? "index" : "article"));
    }
  }

  return [...bySource.values()].filter((page) => fs.existsSync(path.join(root, page.source)));
}

function researchAssetPages() {
  const out = [];
  for (const kind of ["stocks", "etfs"]) {
    const dir = path.join(root, "data", "research-assets", kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const asset = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      const folder = asset.type === "etf" ? "etfs" : "stocks";
      out.push({ source: `${folder}/${String(asset.symbol).toLowerCase()}.html`, type: asset.type || kind });
    }
  }
  return out;
}

function addPage(map, page) {
  if (!page || !page.source) return;
  const source = norm(page.source);
  if (!map.has(source)) {
    map.set(source, {
      ...page,
      source,
      arPath: page.arPath || `ar/${source}`,
      enPath: page.enPath || `en/${source}`
    });
  } else {
    map.set(source, { ...map.get(source), ...page, source });
  }
}

function inferredPage(source, type) {
  return {
    id: source.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home",
    type,
    source,
    arPath: `ar/${source}`,
    enPath: `en/${source}`
  };
}

function normalizeEnglishSources() {
  const indexPath = path.join(root, "index.html");
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  html = applyLandingCopy(html, "en");
  html = html.replace(/<html[^>]*>/i, '<html lang="en" dir="ltr">');
  html = html.replace(/<meta property="og:locale" content="[^"]*"/i, '<meta property="og:locale" content="en_US"');
  html = ensureLocaleSwitch(html, pageBySource.get("index.html") || inferredPage("index.html"), "en", false);
  html = replaceHreflangBlock(html, pageBySource.get("index.html") || inferredPage("index.html"), "source");
  fs.writeFileSync(indexPath, html, "utf8");
}

function writeLocalizedPage(page, locale) {
  const sourcePath = path.join(root, page.source);
  let html = fs.readFileSync(sourcePath, "utf8");
  const isArabic = locale === "ar";
  const outRel = isArabic ? page.arPath : page.enPath;

  if (page.source === "index.html") html = applyLandingCopy(html, locale);
  html = html.replace(/\sdata-copy="[^"]*"/g, "");

  html = html.replace(/<html[^>]*>/i, `<html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">`);
  html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
    let next = attrs;
    next = next.replace(/\sclass="([^"]*)"/i, (m, cls) => {
      const cleaned = cls.replace(/\blocalized-(?:ar|en)\b/g, "").replace(/\blocalized-page\b/g, "").trim();
      return ` class="${`${cleaned} localized-page localized-${locale}`.trim()}"`;
    });
    if (!/\sclass="/i.test(next)) next += ` class="localized-page localized-${locale}"`;
    return `<body${next} data-locale="${locale}">`;
  });

  html = localizeHead(html, page, locale);
  html = replaceHreflangBlock(html, page, locale);
  html = rewriteUrls(html, page.source, locale);
  html = ensureLocaleSwitch(html, page, locale, true);
  html = localizeNavigation(html, locale);
  html = ensureMobileNavigation(html, locale, outRel);
  html = ensureSearchAutocomplete(html, outRel);
  html = html.replace(/<script src="([^"]*landing-i18n\.js)"[^>]*><\/script>\s*/g, "");
  if (isArabic) {
    html = localizeStaticText(html, page);
    html = localizeArticleFromContentFile(html, page);
    html = normalizeArabicArtifacts(html);
    html = finalArabicCleanup(html);
  }
  html = ensureLanguageRouter(html, outRel);

  ensureDir(path.join(root, path.dirname(outRel)));
  fs.writeFileSync(path.join(root, outRel), html, "utf8");
}

function localizeHead(html, page, locale) {
  const isArabic = locale === "ar";
  const sourceTitle = extractTitle(html);
  const sourceDescription = extractDescription(html);
  const arContent = page.type === "article" ? loadArInsightContent(slugFromSource(page.source)) : null;
  const title = isArabic ? (arContent?.title || translateTitle(page.title || sourceTitle, page)) : (page.enTitle || sourceTitle);
  const description = isArabic ? (arContent?.summary || arContent?.lead || translateText(page.description || sourceDescription)) : (page.enDescription || sourceDescription);
  const canonical = `${site}/${(isArabic ? page.arPath : page.enPath).replace(/index\.html$/, "")}`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:locale", isArabic ? "ar_AR" : "en_US");
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", canonical);
  if (isArabic) {
    html = setMeta(html, "property", "og:image:alt", "Ù…Ø¹Ø§ÙŠÙ†Ø© Ø¨Ø­Ø«ÙŠØ© Ù…Ù† TradeAlphaAI");
    html = html.replace(/<meta property="article:section" content="[^"]*"\s*\/?>/i, (m) => m.replace(/content="[^"]*"/, `content="${escapeHtml(translateText((m.match(/content="([^"]*)"/) || [])[1] || "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚"))}"`));
  }
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`);
  html = localizeJsonLd(html, title, description, canonical, locale);
  return html;
}

function localizeJsonLd(html, title, description, canonical, locale) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi, (block, jsonText) => {
    try {
      const json = JSON.parse(jsonText);
      walkJson(json, (obj) => {
        for (const key of ["name", "headline", "description", "text"]) {
          if (typeof obj[key] === "string") obj[key] = locale === "ar" ? translateText(obj[key]) : obj[key];
        }
        if (obj.url && typeof obj.url === "string" && obj.url.startsWith(site)) obj.url = canonical;
        if (obj["@id"] && typeof obj["@id"] === "string" && obj["@id"].startsWith(site)) obj["@id"] = canonical;
        if (obj.item && typeof obj.item === "string" && obj.item.startsWith(site)) {
          obj.item = locale === "ar" ? obj.item.replace(`${site}/`, `${site}/ar/`) : obj.item.replace(`${site}/`, `${site}/en/`);
        }
        if (obj.mainEntityOfPage?.["@id"]) obj.mainEntityOfPage["@id"] = canonical;
        if (obj.inLanguage) obj.inLanguage = locale;
      });
      if (json["@graph"]) {
        for (const item of json["@graph"]) {
          if (item["@type"] === "Article" || item["@type"] === "WebPage") {
            item.headline = title;
            item.name = title;
            item.description = description;
            item.inLanguage = locale;
          }
        }
      }
      return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n  </script>`;
    } catch {
      return block;
    }
  });
}

function localizeStaticText(html, page) {
  const protectedBlocks = [];
  html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (block) => {
    const token = `___TA_PROTECTED_${protectedBlocks.length}___`;
    protectedBlocks.push(block);
    return token;
  });

  html = html.replace(/(aria-label|title|placeholder|alt)="([^"]+)"/g, (m, attr, value) => `${attr}="${escapeHtml(translateText(value))}"`);

  html = html.replace(/>([^<>{}][^<>]*?)</g, (m, text) => {
    if (!text.trim()) return m;
    if (/^\s*(?:[\/|Â·â€¢-]|\d+(?:\.\d+)?%?|\$[\d,.]+)\s*$/.test(text)) return m;
    return `>${preserveEdgeSpace(text, translateText(text))}<`;
  });

  html = html.replace(/<noscript>([\s\S]*?)<\/noscript>/g, (m, content) => `<noscript>${translateText(content)}</noscript>`);
  protectedBlocks.forEach((block, index) => {
    html = html.replace(`___TA_PROTECTED_${index}___`, block);
  });
  return html;
}

function localizeArticleFromContentFile(html, page) {
  if (page.type !== "article") return html;
  const content = loadArInsightContent(slugFromSource(page.source));
  if (!content) return html;

  html = html.replace(/<nav class="breadcrumb">[\s\S]*?<\/nav>/, (nav) => nav
    .replace(/<span>[^<]*<\/span>\s*<\/nav>$/, `<span>${escapeHtml(content.title || "")}</span></nav>`)
    .replace(/>Insights</g, ">Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚<")
    .replace(/>Articles</g, ">Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚<")
  );
  html = html.replace(/<span class="insight-category-badge(?: muted)?">[\s\S]*?<\/span>/g, `<span class="insight-category-badge">${escapeHtml(content.category || "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚")}</span>`);
  html = html.replace(/<div class="insight-meta-bar">[\s\S]*?<\/div>/, `<div class="insight-meta-bar">
            <span><strong><time datetime="${escapeHtml(data.generatedAt || "2026-05-20")}">${escapeHtml(data.generatedAt || "2026-05-20")}</time></strong></span>
            <span><strong>${escapeHtml(content.readingTime || "6 Ø¯Ù‚Ø§Ø¦Ù‚ Ù‚Ø±Ø§Ø¡Ø©")}</strong></span>
            <span><strong>ÙØ±ÙŠÙ‚ TradeAlphaAI Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚</strong></span>
            <span><strong>${escapeHtml(content.category || "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚")}</strong></span>
          </div>`);
  html = html.replace(/(<section class="market-section">[\s\S]*?<div class="market-panel[\s\S]*?<span class="insight-category-badge">[\s\S]*?<\/span>[\s\S]*?<h1>)[\s\S]*?(<\/h1>[\s\S]*?<p class="market-lead">)[\s\S]*?(<\/p>)/, `$1${escapeHtml(content.title || "")}$2${escapeHtml(content.lead || content.summary || "")}$3`);
  html = html.replace(/<div class="insight-summary-box">[\s\S]*?<\/div>/, `<div class="insight-summary-box">
            <span>Ù…Ù„Ø®Øµ Ø¨Ø­Ø«ÙŠ</span>
            <p>${escapeHtml(content.summary || content.lead || "")}</p>
          </div>`);
  html = html.replace(/<p class="insight-hero-disclaimer">[\s\S]*?<\/p>/, `<p class="insight-hero-disclaimer">Ù…Ø­ØªÙˆÙ‰ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø·. Ù„Ø§ ÙŠÙ‚Ø¯Ù… Ù‡Ø°Ø§ Ø§Ù„Ù…Ù‚Ø§Ù„ Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ© Ø£Ùˆ Ø£Ù‡Ø¯Ø§ÙØ§Ù‹ Ø³Ø¹Ø±ÙŠØ© Ø£Ùˆ ØªÙˆØµÙŠØ§Øª Ø¹Ù„Ù‰ Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ©.</p>`);
  html = html.replace(/<section class="market-section">\s*<div class="market-panel">\s*<span class="insight-category-badge">([\s\S]*?)<p class="market-lead">[\s\S]*?<\/p>/, (m) => {
    return m
      .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${escapeHtml(content.title || "")}</h1>`)
      .replace(/<p class="market-lead">[\s\S]*?<\/p>/, `<p class="market-lead">${escapeHtml(content.lead || content.summary || "")}</p>`);
  });

  const article = html.match(/<article class="insight-article-body">([\s\S]*?)<\/article>/i);
  if (!article) return html;

  const sectionTitles = (content.sections || []).map((section) => section.title);
  const paragraphQueue = (content.sections || []).flatMap((section) => section.body || []);
  let h2Index = 0;
  let pIndex = 0;
  let faqIndex = 0;
  let summaryIndex = 0;
  let liIndex = 0;
  let localizedArticle = article[0]
    .replace(/<h2([^>]*)>[\s\S]*?<\/h2>/g, (m, attrs) => {
      const title = h2Index < sectionTitles.length ? sectionTitles[h2Index] : "Ø£Ø³Ø¦Ù„Ø© Ø´Ø§Ø¦Ø¹Ø©";
      h2Index += 1;
      return `<h2${attrs}>${escapeHtml(title)}</h2>`;
    })
    .replace(/<p([^>]*)>[\s\S]*?<\/p>/g, (m, attrs) => {
      const text = paragraphQueue[pIndex] || editorialFallback(content, pIndex, "paragraph");
      pIndex += 1;
      return `<p${attrs}>${escapeHtml(text)}</p>`;
    })
    .replace(/<li([^>]*)>[\s\S]*?<\/li>/g, (m, attrs) => {
      const translated = translateText(m.replace(/<[^>]+>/g, " "));
      const text = hasEnglishWords(translated) ? editorialFallback(content, liIndex, "bullet") : translated;
      liIndex += 1;
      return `<li${attrs}>${escapeHtml(text)}</li>`;
    })
    .replace(/<summary>[\s\S]*?<\/summary>/g, () => {
      const item = (content.faq || [])[summaryIndex] || {};
      summaryIndex += 1;
      return `<summary>${escapeHtml(item.q || "Ø³Ø¤Ø§Ù„ Ø´Ø§Ø¦Ø¹")}</summary>`;
    })
    .replace(/<details>\s*<summary>[\s\S]*?<\/summary>\s*<p[^>]*>[\s\S]*?<\/p>\s*<\/details>/g, (m) => {
      const item = (content.faq || [])[faqIndex] || {};
      faqIndex += 1;
      return m.replace(/<p[^>]*>[\s\S]*?<\/p>/, `<p>${escapeHtml(item.a || "")}</p>`);
    })
    .replace(/<div class="insight-disclaimer">[\s\S]*?<\/div>/, `<div class="insight-disclaimer">\n              <p><strong>ØªÙ†Ø¨ÙŠÙ‡ ØªØ¹Ù„ÙŠÙ…ÙŠ:</strong> ${AR.disclaimer}</p>\n            </div>`)
    .replace(/<div class="insight-sources">[\s\S]*?<\/div>/, `<div class="insight-sources">\n              <h3>Ù…Ø±Ø§Ø¬Ø¹ Ø³ÙŠØ§Ù‚ÙŠØ©</h3>\n              <ul>\n                <li>ÙˆØ«Ø§Ø¦Ù‚ Ø§Ù„Ø¬Ù‡Ø§Øª Ø§Ù„Ù…ØµØ¯Ø±Ø© Ù„Ù„ØµÙ†Ø§Ø¯ÙŠÙ‚ ÙˆØ§Ù„Ù…Ø¤Ø´Ø±Ø§Øª</li>\n                <li>Ø¨ÙŠØ§Ù†Ø§Øª ØªØ§Ø±ÙŠØ®ÙŠØ© ÙˆØ³ÙŠØ§Ù‚ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ</li>\n                <li>Ù…Ù†Ù‡Ø¬ÙŠØ© TradeAlphaAI Ù„Ù„Ù…Ø­ØªÙˆÙ‰ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ</li>\n              </ul>\n            </div>`);
  localizedArticle = localizedArticle.replace(/<h2([^>]*id="s-faq"[^>]*)>[\s\S]*?<\/h2>/, '<h2$1>Ø£Ø³Ø¦Ù„Ø© Ø´Ø§Ø¦Ø¹Ø©</h2>');

  html = html.replace(article[0], localizedArticle);
  html = localizeInsightSidebar(html, content);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, articleJsonLd(content, page));
  return html;
}

function localizeInsightSidebar(html, content) {
  const sectionTitles = (content.sections || []).map((section) => section.title);
  let tocIndex = 0;
  return html
    .replace(/<h3>Contents<\/h3>/g, "<h3>Ø§Ù„Ù…Ø­ØªÙˆÙŠØ§Øª</h3>")
    .replace(/<h3>Related Research<\/h3>/g, "<h3>Ø£Ø¨Ø­Ø§Ø« Ù…Ø±ØªØ¨Ø·Ø©</h3>")
    .replace(/<h3>Research Use<\/h3>/g, "<h3>Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ø¨Ø­Ø«ÙŠ</h3>")
    .replace(/<span class="eyebrow" style="font-size:10px">Related Research<\/span>/g, '<span class="eyebrow" style="font-size:10px">Ø£Ø¨Ø­Ø§Ø« Ù…Ø±ØªØ¨Ø·Ø©</span>')
    .replace(/<span class="eyebrow" style="font-size:10px">Research Use<\/span>/g, '<span class="eyebrow" style="font-size:10px">Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ø¨Ø­Ø«ÙŠ</span>')
    .replace(/<a href="#s-[^"]+">([^<]+)<\/a>/g, (m, text) => {
      if (/FAQ/i.test(text)) return m.replace(text, "Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©");
      const title = sectionTitles[tocIndex] || translateText(text);
      tocIndex += 1;
      return m.replace(text, title);
    })
    .replace(/<span>(Related insight article|Market benchmark beta = 1\.0|Total U\.S\. Market ETF|Related research path)<\/span>/g, (m, text) => `<span>${escapeHtml(translateText(text))}</span>`);
}

function articleJsonLd(content, page) {
  const url = `${site}/${page.arPath}`;
  const faq = (content.faq || []).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a }
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "TradeAlphaAI", item: `${site}/ar/` },
          { "@type": "ListItem", position: 2, name: "Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚", item: `${site}/ar/insights/` },
          { "@type": "ListItem", position: 3, name: content.title, item: url }
        ]
      },
      {
        "@type": "Article",
        headline: content.title,
        description: content.summary || content.lead || content.title,
        datePublished: data.generatedAt || "2026-05-20",
        dateModified: data.generatedAt || "2026-05-20",
        inLanguage: "ar",
        author: { "@type": "Organization", name: "ÙØ±ÙŠÙ‚ TradeAlphaAI Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚", url: `${site}/ar/` },
        publisher: { "@type": "Organization", name: "TradeAlphaAI", url: site },
        mainEntityOfPage: { "@type": "WebPage", "@id": url }
      },
      { "@type": "FAQPage", mainEntity: faq }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`;
}

function editorialFallback(content, index, kind) {
  const title = content.title || "Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆØ¶ÙˆØ¹";
  const topic = title.replace(/\s*\|\s*TradeAlphaAI.*$/i, "");
  const paragraph = [
    `ÙŠØ¹Ø±Ø¶ Ù‡Ø°Ø§ Ø§Ù„Ø¬Ø²Ø¡ Ù…Ù† ${topic} Ø²Ø§ÙˆÙŠØ© Ø¨Ø­Ø«ÙŠØ© ØªØ³Ø§Ø¹Ø¯ Ø§Ù„Ù‚Ø§Ø±Ø¦ Ø¹Ù„Ù‰ ÙÙ‡Ù… Ø§Ù„Ø³ÙŠØ§Ù‚ Ù‚Ø¨Ù„ Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ø£Ø³Ù‡Ù… Ø£Ùˆ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø©.`,
    `Ø§Ù„Ø£ÙˆÙ„ÙˆÙŠØ© Ù‡Ù†Ø§ Ù„ÙŠØ³Øª Ø¥ØµØ¯Ø§Ø± Ø­ÙƒÙ… Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØŒ Ø¨Ù„ ØªÙˆØ¶ÙŠØ­ Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„ØªÙŠ Ù‚Ø¯ ØªØ¤Ø«Ø± ÙÙŠ Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØ§Ù„ØªØ°Ø¨Ø°Ø¨ ÙˆØ¯ÙˆØ±Ø© Ø§Ù„Ø³ÙˆÙ‚.`,
    `ÙŠÙ†Ø¨ØºÙŠ Ù‚Ø±Ø§Ø¡Ø© Ù‡Ø°Ù‡ Ø§Ù„Ù†Ù‚Ø·Ø© Ø¶Ù…Ù† Ø¥Ø·Ø§Ø± ØªØ¹Ù„ÙŠÙ…ÙŠ ÙŠØ±Ø¨Ø· Ø¨ÙŠÙ† Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ø­ØªÙ…Ù„Ø© ÙˆØ­Ø¯ÙˆØ¯ Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©.`,
    `ÙŠØ³Ø§Ø¹Ø¯ Ù‡Ø°Ø§ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø¹Ù„Ù‰ Ø¨Ù†Ø§Ø¡ Ù…Ø³Ø§Ø± Ø¨Ø­Ø« Ù…Ù†Ø¸Ù… ÙŠØ¨Ø¯Ø£ Ù…Ù† Ø§Ù„ÙÙƒØ±Ø© Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© Ø«Ù… ÙŠÙ†ØªÙ‚Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ø£ØµÙˆÙ„ ÙˆØ§Ù„Ù‚Ø·Ø§Ø¹Ø§Øª ÙˆØ§Ù„Ø±ÙˆØ§Ø¨Ø· Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©.`
  ];
  const bullet = [
    "Ø¹Ø§Ù…Ù„ Ø¨Ø­Ø«ÙŠ ÙŠØ±ØªØ¨Ø· Ø¨Ø§Ù„ØªÙ‚ÙŠÙŠÙ…ØŒ Ø¬ÙˆØ¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ ÙˆØªØºÙŠØ± ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ø³ÙˆÙ‚.",
    "Ù†Ù‚Ø·Ø© ÙŠØ¬Ø¨ Ù…Ø±Ø§Ù‚Ø¨ØªÙ‡Ø§ Ø¹Ù†Ø¯ Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ¹Ø±Ø¶ Ø§Ù„ÙØ±Ø¯ÙŠ Ø¨Ø§Ù„ØªØ¹Ø±Ø¶ Ø§Ù„Ù…ØªÙ†ÙˆØ¹ Ø¹Ø¨Ø± ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª.",
    "Ù…Ø¤Ø´Ø± Ø³ÙŠØ§Ù‚ÙŠ ÙŠØ³Ø§Ø¹Ø¯ Ø¹Ù„Ù‰ ÙÙ‡Ù… Ø§Ù„Ø²Ø®Ù… ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± Ø¯ÙˆÙ† ØªØ­ÙˆÙŠÙ„Ù‡ Ø¥Ù„Ù‰ ØªÙˆØµÙŠØ© ØªØ¯Ø§ÙˆÙ„.",
    "Ù…ØªØºÙŠØ± Ù‚Ø¯ ØªØªØºÙŠØ± Ø£Ù‡Ù…ÙŠØªÙ‡ Ù…Ø¹ Ø¯ÙˆØ±Ø© Ø§Ù„Ø³ÙˆÙ‚ØŒ Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ØŒ ÙˆØ³ÙŠØ§Ø³Ø© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©."
  ];
  const list = kind === "bullet" ? bullet : paragraph;
  return list[index % list.length];
}

function hasEnglishWords(value = "") {
  return /\b(the|and|or|with|for|from|this|article|research|market|stock|stocks|etf|risk|read|popular|explore|screener|team|contents|reference|demand|standard|breadth|understanding|investment|advice|provide|growth|cloud|cost|exposure|context|sector|cycle|cycles|revenue|customer|data|center|infrastructure|performance)\b/i.test(value);
}

function applyLandingCopy(html, locale) {
  const map = landingTranslations[locale] || landingTranslations.en || {};
  html = html.replace(/(<[^>]*data-copy="([^"]+)"[^>]*>)([\s\S]*?)(<\/[^>]+>)/g, (m, open, key, current, close) => {
    if (!Object.prototype.hasOwnProperty.call(map, key)) return m;
    return `${open}${escapeHtml(map[key])}${close}`;
  });
  const meta = map.meta || {};
  const title = meta.homeTitle;
  const description = meta.homeDescription;
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (description) html = setMeta(html, "name", "description", description);
  if (meta.locale) html = setMeta(html, "property", "og:locale", meta.locale);
  if (title) {
    html = setMeta(html, "property", "og:title", title);
    html = setMeta(html, "name", "twitter:title", title);
  }
  if (description) {
    html = setMeta(html, "property", "og:description", description);
    html = setMeta(html, "name", "twitter:description", description);
  }
  return html;
}

function localizeNavigation(html, locale) {
  const isArabic = locale === "ar";
  const labels = isArabic ? AR.nav : {
    Home: "Home",
    "AI Stock Analyzer": "AI Stock Analyzer",
    "ETF Analyzer": "ETF Analyzer",
    "Market Screener": "Market Screener",
    "Articles": "Articles",
    Methodology: "Methodology"
  };
  const recommendationsLabel = isArabic ? "Ø£ÙØ¶Ù„ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø±Ø§Øª" : "Top Picks";
  const recommendationLinks = isArabic ? [
    ["Ø£ÙØ¶Ù„ 10 Ø£Ø³Ù‡Ù… Ø­Ø§Ù„ÙŠØ§Ù‹", "/ar/rankings.html#top-ai-stocks"],
    ["Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª", "/ar/rankings.html#top-semiconductor-stocks"],
    ["Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ", "/ar/rankings.html#top-growth-stocks"],
    ["Ø£ÙØ¶Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ ØªÙˆØ²ÙŠØ¹Ø§Øª Ø§Ù„Ø£Ø±Ø¨Ø§Ø­", "/ar/rankings.html#top-dividend-etfs"],
    ["Ø£ÙØ¶Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ø¹Ø§Ù… 2026", "/ar/rankings.html#top-broad-market-etfs"],
    ["Ù‚Ø§Ø¦Ù…Ø© Ø£Ø³Ù‡Ù… Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ", "/ar/rankings.html#ai-infrastructure-focus"],
    ["Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø£Ø³Ù‡Ù… Ø¹Ø§Ù„ÙŠØ© Ø§Ù„ØªÙ‚Ù„Ø¨", "/ar/rankings.html#high-volatility-watchlist"],
    ["Ø£ÙƒØ«Ø± Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„ØªÙ‚Ù†ÙŠØ© Ù…ØªØ§Ø¨Ø¹Ø©", "/ar/rankings.html#most-followed-tech"]
  ] : [
    ["Top 10 AI Stocks Right Now", "/rankings.html#top-ai-stocks"],
    ["Best Semiconductor Stocks", "/rankings.html#top-semiconductor-stocks"],
    ["Top Growth Stocks", "/rankings.html#top-growth-stocks"],
    ["Top Dividend ETFs", "/rankings.html#top-dividend-etfs"],
    ["Best ETFs for 2026", "/rankings.html#top-broad-market-etfs"],
    ["AI Infrastructure Focus List", "/rankings.html#ai-infrastructure-focus"],
    ["High Volatility Watchlist", "/rankings.html#high-volatility-watchlist"],
    ["Most Followed Tech Stocks", "/rankings.html#most-followed-tech"]
  ];
  const recommendations = `<div class="nav-menu">
            <a href="${isArabic ? "/ar/rankings.html" : "/rankings.html"}" class="nav-link nav-menu-trigger">${recommendationsLabel}<span class="nav-badge">${isArabic ? "Ø±Ø§Ø¦Ø¬" : "Hot"}</span></a>
            <div class="nav-dropdown">
              ${recommendationLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join("\n              ")}
            </div>
          </div>`;
  html = html.replace(/<nav class="nav-group"[^>]*>[\s\S]*?<\/nav>/, (nav) => {
    const aria = isArabic ? "Ø§Ù„ØªÙ†Ù‚Ù„ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠ" : "Primary";
    return `<nav class="nav-group" aria-label="${aria}">
          <a href="${isArabic ? "/ar/" : "/"}" class="nav-link">${labels.Home}</a>
          <a href="${isArabic ? "/ar/stocks.html" : "/stocks.html"}" class="nav-link">${labels["AI Stock Analyzer"]}</a>
          <a href="${isArabic ? "/ar/etfs.html" : "/etfs.html"}" class="nav-link">${labels["ETF Analyzer"]}</a>
          <a href="${isArabic ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html"}" class="nav-link">${labels["Market Screener"]}</a>
          ${recommendations}
          <a href="${isArabic ? "/ar/insights/" : "/insights/"}" class="nav-link">${labels["Articles"]}</a>
          <a href="${isArabic ? "/ar/methodology.html" : "/methodology.html"}" class="nav-link">${labels.Methodology}</a>
        </nav>`;
  });
  return html;
}

function ensureLocaleSwitch(html, page, locale, reorder) {
  const arHref = `/${page.arPath.replace(/index\.html$/, "")}`;
  const enHref = `/${page.source.replace(/index\.html$/, "")}`;
  const label = locale === "ar" ? "Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù„ØºØ©" : "Language";
  const links = locale === "ar" && reorder
    ? `<a class="lang-switch" data-locale-route="en" href="${enHref || "/"}">English</a>
          <a class="lang-switch" data-locale-route="ar" href="${arHref}">Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©</a>`
    : `<a class="lang-switch" data-locale-route="ar" href="${arHref}">Arabic</a>
          <a class="lang-switch" data-locale-route="en" href="${enHref || "/"}">English</a>`;
  const switcher = `<div class="locale-links" aria-label="${label}">
          ${links}
        </div>`;
  if (html.includes('class="locale-links"')) {
    return html.replace(/<div class="locale-links"[\s\S]*?<\/div>/, switcher);
  }
  return html.replace(/(<\/nav>\s*)/, `$1${switcher}\n        `);
}

function replaceHreflangBlock(html, page, locale) {
  const sourceUrl = `${site}/${page.source.replace(/index\.html$/, "")}`;
  const enUrl = `${site}/${page.enPath.replace(/index\.html$/, "")}`;
  const arUrl = `${site}/${page.arPath.replace(/index\.html$/, "")}`;
  const block = `<!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${sourceUrl}" />
  <link rel="alternate" hreflang="en-US" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${sourceUrl}" />
  <!-- localized-static-pages:end -->`;
  if (/<!-- localized-static-pages:start -->[\s\S]*?<!-- localized-static-pages:end -->/.test(html)) {
    return html.replace(/<!-- localized-static-pages:start -->[\s\S]*?<!-- localized-static-pages:end -->/, block);
  }
  return html.replace(/(<link rel="canonical"[^>]*>\s*)/, `$1${block}\n`);
}

function rewriteUrls(html, sourceRel, locale) {
  return html.replace(/\s(href|src)="([^"]+)"/g, (m, attr, url) => {
    if (/^(?:https?:|mailto:|tel:|\/\/|#|data:)/i.test(url)) return m;
    if (url.startsWith("/")) {
      if (attr === "href") return ` ${attr}="${localizeRootHref(url, locale)}"`;
      return m;
    }
    const resolved = norm(path.join(path.dirname(sourceRel), url));
    if (attr === "href") return ` ${attr}="${localizeResolvedHref(resolved, locale)}"`;
    return ` ${attr}="/${resolved}"`;
  });
}

function localizeResolvedHref(resolved, locale) {
  const clean = resolved.replace(/^\.\//, "");
  const hash = clean.includes("#") ? `#${clean.split("#").slice(1).join("#")}` : "";
  const noHash = clean.split("#")[0];
  if (isAsset(noHash)) return `/${noHash}${hash}`;
  if (noHash.endsWith("/") || noHash.endsWith(".html")) {
    const normalized = noHash.endsWith("/") ? `${noHash}index.html` : noHash;
    const page = pageBySource.get(normalized);
    if (page) return locale === "ar" ? `/${page.arPath.replace(/index\.html$/, "")}${hash}` : `/${page.source.replace(/index\.html$/, "")}${hash}`;
  }
  return `/${clean}`;
}

function localizeRootHref(url, locale) {
  const clean = url.slice(1);
  if (!clean || clean === "index.html") return locale === "ar" ? "/ar/" : "/";
  if (isAsset(clean)) return url;
  return localizeResolvedHref(clean, locale);
}

function syncEnglishSource(page) {
  const sourcePath = path.join(root, page.source);
  if (!fs.existsSync(sourcePath)) return;
  let html = fs.readFileSync(sourcePath, "utf8");
  html = html.replace(/<html[^>]*>/i, '<html lang="en" dir="ltr">');
  html = replaceHreflangBlock(html, page, "source");
  html = ensureLocaleSwitch(html, page, "en", false);
  html = localizeNavigation(html, "en");
  html = ensureMobileNavigation(html, "en", page.source);
  html = ensureSearchAutocomplete(html, page.source);
  html = ensureLanguageRouter(html, page.source);
  fs.writeFileSync(sourcePath, html, "utf8");
}

function ensureSearchAutocomplete(html, outRel) {
  if (!/(type="search"|data-filter-query)/i.test(html)) return html;
  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (html.includes("js/search-autocomplete.js")) return html;
  return html.replace(/<\/body>/i, `  <script src="${prefix}js/search-autocomplete.js" defer></script>\n</body>`);
}

function ensureLanguageRouter(html, outRel) {
  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (html.includes("js/language-router.js")) return html;
  return html.replace(/<\/body>/i, `  <script src="${prefix}js/language-router.js" defer></script>\n</body>`);
}

function ensureMobileNavigation(html, locale, outRel) {
  const isArabic = locale === "ar";
  const label = isArabic ? "ÙØªØ­ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©" : "Open menu";
  const toggle = `<button class="mobile-menu-toggle" type="button" aria-label="${label}" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>`;
  html = html.replace(/\s*<button class="mobile-menu-toggle"[\s\S]*?<\/button>/g, "");
  html = html.replace(/(<\/div>\s*<\/div>\s*<\/div>\s*<div class="site-shell"|<\/div>\s*<\/div>\s*<\/div>\s*<main\b)/, (m) => m);
  html = html.replace(/(<div class="locale-links"[\s\S]*?<\/div>)(?!\s*<button class="mobile-menu-toggle")/, `$1\n        ${toggle}`);

  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (!html.includes("js/mobile-nav.js")) {
    html = html.replace(/<\/body>/i, `  <script src="${prefix}js/mobile-nav.js" defer></script>\n</body>`);
  }
  return html;
}

function writeSitemap() {
  const urls = pages
    .filter((page) => !isNoindexDraft(page.source))
    .map((page) => `  <url>
    <loc>${site}/${page.arPath.replace(/index\.html$/, "")}</loc>
    <changefreq>${page.type === "article" ? "monthly" : "weekly"}</changefreq>
    <priority>${page.source === "index.html" ? "0.9" : "0.75"}</priority>
  </url>`).join("\n");
  fs.writeFileSync(path.join(root, "sitemap-ar.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "utf8");
}

function writeLanguageRouter() {
  const routes = {};
  for (const page of pages) {
    const source = `/${page.source.replace(/index\.html$/, "")}`;
    const sourceIndex = `/${page.source}`;
    const ar = `/${page.arPath.replace(/index\.html$/, "")}`;
    const arIndex = `/${page.arPath}`;
    const en = `/${page.enPath.replace(/index\.html$/, "")}`;
    const enIndex = `/${page.enPath}`;
    routes[source] = { ar, en: source || "/" };
    routes[sourceIndex] = { ar, en: source || "/" };
    routes[ar] = { ar, en: source || "/" };
    routes[arIndex] = { ar, en: source || "/" };
    routes[en] = { ar, en: source || "/" };
    routes[enIndex] = { ar, en: source || "/" };
  }
  fs.writeFileSync(path.join(root, "js/language-router.js"), `(function () {
  const localizedRoutes = ${JSON.stringify(routes, null, 4)};
  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };
  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
`, "utf8");
}

function syncRobots() {
  const robotsPath = path.join(root, "robots.txt");
  let robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8") : "";
  const line = "Sitemap: https://www.tradealphaai.com/sitemap-ar.xml";
  if (!robots.includes(line)) fs.writeFileSync(robotsPath, `${robots.trimEnd()}\n${line}\n`, "utf8");
}

function translateTitle(value, page) {
  const slug = slugFromSource(page.source);
  const content = loadArInsightContent(slug);
  if (content?.title) return content.title;
  return translateText(value || extractTitle(fs.readFileSync(path.join(root, page.source), "utf8")));
}

function translateText(value = "") {
  let out = String(value);
  if (!out.trim()) return out;
  if (/^[A-Z]{1,5}$/.test(out.trim())) return out;
  for (const [en, ar] of [...Object.entries(AR.nav), ...Object.entries(AR.labels)]) {
    out = out.replace(new RegExp(escapeRegExp(en), "g"), ar);
  }
  for (const [en, ar] of AR.terms) out = out.replace(new RegExp(escapeRegExp(en), "gi"), ar);
  out = out
    .replace(/\bNo\.\s*/g, "Ù„Ø§. ")
    .replace(/\bYes\b/g, "Ù†Ø¹Ù…")
    .replace(/\bNo\b/g, "Ù„Ø§")
    .replace(/does not/gi, "Ù„Ø§")
    .replace(/do not/gi, "Ù„Ø§")
    .replace(/is not/gi, "Ù„ÙŠØ³")
    .replace(/are not/gi, "Ù„ÙŠØ³Øª")
    .replace(/for educational screening, including/gi, "Ù„Ù„ÙØ­Øµ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØŒ ÙˆÙŠØ´Ù…Ù„")
    .replace(/technical score/gi, "Ø§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„ÙÙ†ÙŠØ©")
    .replace(/\bcontext\b/gi, "Ø§Ù„Ø³ÙŠØ§Ù‚")
    .replace(/\bRead\b/g, "Ø§Ù‚Ø±Ø£")
    .replace(/\band\b/gi, "Ùˆ")
    .replace(/Why do investors watch/gi, "Ù„Ù…Ø§Ø°Ø§ ÙŠØ±Ø§Ù‚Ø¨ Ø§Ù„Ù…Ø³ØªØ«Ù…Ø±ÙˆÙ†")
    .replace(/What affects NVIDIA stock volatility/gi, "Ù…Ø§ Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„ØªÙŠ ØªØ¤Ø«Ø± ÙÙŠ ØªØ°Ø¨Ø°Ø¨ Ø³Ù‡Ù… NVIDIA")
    .replace(/is watched for/gi, "ØªØªÙ… Ù…ØªØ§Ø¨Ø¹ØªÙ‡ Ø¨Ø³Ø¨Ø¨")
    .replace(/can be affected by/gi, "Ù‚Ø¯ ÙŠØªØ£Ø«Ø± Ø¨Ù€")
    .replace(/trend direction/gi, "Ø§ØªØ¬Ø§Ù‡ Ø§Ù„Ø³Ø¹Ø±")
    .replace(/sector conditions/gi, "Ø¸Ø±ÙˆÙ Ø§Ù„Ù‚Ø·Ø§Ø¹")
    .replace(/macro data/gi, "Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙƒÙ„ÙŠØ©")
    .replace(/changes in market expectations/gi, "ØªØºÙŠØ± ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Research brief/gi, "Ù…ÙˆØ¬Ø² Ø¨Ø­Ø«ÙŠ")
    .replace(/Educational Research/gi, "Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ")
    .replace(/Popular Research/gi, "Ø£Ø¨Ø­Ø§Ø« Ø´Ø§Ø¦Ø¹Ø©")
    .replace(/Explore This Theme/gi, "Ø§Ø³ØªÙƒØ´Ù Ù‡Ø°Ø§ Ø§Ù„Ù…Ø­ÙˆØ±")
    .replace(/Related insight article/gi, "Ù…Ù‚Ø§Ù„ Ø¨Ø­Ø«ÙŠ Ù…Ø±ØªØ¨Ø·")
    .replace(/Total U\.S\. Market ETF/gi, "ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠ Ø§Ù„ÙƒÙ„ÙŠ")
    .replace(/Market benchmark beta = 1\.0/gi, "Ù…Ø¹ÙŠØ§Ø± Ø§Ù„Ø³ÙˆÙ‚: Ø¨ÙŠØªØ§ ØªØ³Ø§ÙˆÙŠ 1.0")
    .replace(/Market context/gi, "Ø³ÙŠØ§Ù‚ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Research context/gi, "Ø§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¨Ø­Ø«ÙŠ")
    .replace(/Research implications/gi, "Ø¯Ù„Ø§Ù„Ø§Øª Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Market structure/gi, "Ù‡ÙŠÙƒÙ„ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Index methodology/gi, "Ù…Ù†Ù‡Ø¬ÙŠØ© Ø§Ù„Ù…Ø¤Ø´Ø±")
    .replace(/Sector composition/gi, "Ø§Ù„ØªØ±ÙƒÙŠØ¨ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ")
    .replace(/Expense ratios/gi, "Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ")
    .replace(/Drawdown/g, "Ø§Ù„ØªØ±Ø§Ø¬Ø¹")
    .replace(/Historical drawdown/gi, "Ø§Ù„ØªØ±Ø§Ø¬Ø¹ Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠ")
    .replace(/Broad U\.S\. equity exposure/gi, "ØªØ¹Ø±Ø¶ ÙˆØ§Ø³Ø¹ Ù„Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ©")
    .replace(/S&P 500 sector leadership/gi, "Ù‚ÙŠØ§Ø¯Ø© Ù‚Ø·Ø§Ø¹Ø§Øª S&P 500")
    .replace(/market breadth/gi, "Ø§ØªØ³Ø§Ø¹ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/total market diversification/gi, "ØªÙ†ÙˆÙŠØ¹ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙƒÙ„ÙŠ")
    .replace(/low cost exposure/gi, "ØªØ¹Ø±Ø¶ Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ©")
    .replace(/broad equity beta/gi, "Ø¨ÙŠØªØ§ ÙˆØ§Ø³Ø¹Ø© Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/macro sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø§Ù‚ØªØµØ§Ø¯ Ø§Ù„ÙƒÙ„ÙŠ")
    .replace(/interest-rate sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©")
    .replace(/duration risk/gi, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ø¯Ø©")
    .replace(/macro policy expectations/gi, "ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ø³ÙŠØ§Ø³Ø© Ø§Ù„ÙƒÙ„ÙŠØ©")
    .replace(/defensive portfolio context/gi, "Ø³ÙŠØ§Ù‚ Ø¯ÙØ§Ø¹ÙŠ Ù„Ù„Ù…Ø­ÙØ¸Ø©")
    .replace(/dividend quality/gi, "Ø¬ÙˆØ¯Ø© Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª")
    .replace(/value tilt/gi, "Ù…ÙŠÙ„ Ø¥Ù„Ù‰ Ø£Ø³Ù‡Ù… Ø§Ù„Ù‚ÙŠÙ…Ø©")
    .replace(/yield context/gi, "Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¹Ø§Ø¦Ø¯")
    .replace(/defensive equity screening/gi, "ÙØ­Øµ Ø¯ÙØ§Ø¹ÙŠ Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/gold exposure/gi, "Ø§Ù„ØªØ¹Ø±Ø¶ Ù„Ù„Ø°Ù‡Ø¨")
    .replace(/U\.S\. dollar strength/gi, "Ù‚ÙˆØ© Ø§Ù„Ø¯ÙˆÙ„Ø§Ø± Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠ")
    .replace(/inflation expectations/gi, "ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„ØªØ¶Ø®Ù…")
    .replace(/small-cap breadth/gi, "Ø§ØªØ³Ø§Ø¹ Ø£Ø³Ù‡Ù… Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø©")
    .replace(/domestic growth sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ù†Ù…Ùˆ Ø§Ù„Ù…Ø­Ù„ÙŠ")
    .replace(/credit conditions/gi, "Ø¸Ø±ÙˆÙ Ø§Ù„Ø§Ø¦ØªÙ…Ø§Ù†")
    .replace(/risk appetite/gi, "Ø´Ù‡ÙŠØ© Ø§Ù„Ù…Ø®Ø§Ø·Ø±Ø©")
    .replace(/AI accelerator competition/gi, "Ù…Ù†Ø§ÙØ³Ø© Ù…Ø³Ø±Ø¹Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/CPU and GPU demand/gi, "Ø·Ù„Ø¨ ÙˆØ­Ø¯Ø§Øª CPU ÙˆGPU")
    .replace(/semiconductor cycles/gi, "Ø¯ÙˆØ±Ø§Øª Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/valuation sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/product cycles/gi, "Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª")
    .replace(/services revenue/gi, "Ø¥ÙŠØ±Ø§Ø¯Ø§Øª Ø§Ù„Ø®Ø¯Ù…Ø§Øª")
    .replace(/margin durability/gi, "Ù…ØªØ§Ù†Ø© Ø§Ù„Ù‡ÙˆØ§Ù…Ø´")
    .replace(/consumer demand/gi, "Ø·Ù„Ø¨ Ø§Ù„Ù…Ø³ØªÙ‡Ù„ÙƒÙŠÙ†")
    .replace(/large-cap technology sentiment/gi, "Ù…Ø¹Ù†ÙˆÙŠØ§Øª Ø´Ø±ÙƒØ§Øª Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/AWS margins/gi, "Ù‡ÙˆØ§Ù…Ø´ AWS")
    .replace(/retail efficiency/gi, "ÙƒÙØ§Ø¡Ø© ØªØ¬Ø§Ø±Ø© Ø§Ù„ØªØ¬Ø²Ø¦Ø©")
    .replace(/consumer spending/gi, "Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ù…Ø³ØªÙ‡Ù„ÙƒÙŠÙ†")
    .replace(/growth sentiment/gi, "Ù…Ø¹Ù†ÙˆÙŠØ§Øª Ø§Ù„Ù†Ù…Ùˆ")
    .replace(/networking chips/gi, "Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø´Ø¨ÙƒØ§Øª")
    .replace(/software integration/gi, "ØªÙƒØ§Ù…Ù„ Ø§Ù„Ø¨Ø±Ù…Ø¬ÙŠØ§Øª")
    .replace(/Search advertising/gi, "Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ø§Ù„Ø¨Ø­Ø«")
    .replace(/AI competition/gi, "Ù…Ù†Ø§ÙØ³Ø© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/cloud growth/gi, "Ù†Ù…Ùˆ Ø§Ù„Ø³Ø­Ø§Ø¨Ø©")
    .replace(/regulatory risk/gi, "Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„ØªÙ†Ø¸ÙŠÙ…ÙŠØ©")
    .replace(/margin quality/gi, "Ø¬ÙˆØ¯Ø© Ø§Ù„Ù‡ÙˆØ§Ù…Ø´")
    .replace(/digital advertising/gi, "Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ø§Ù„Ø±Ù‚Ù…ÙŠØ©")
    .replace(/AI engagement/gi, "ØªÙØ§Ø¹Ù„ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/platform risk/gi, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ù†ØµØ©")
    .replace(/large-cap growth sentiment/gi, "Ù…Ø¹Ù†ÙˆÙŠØ§Øª Ù†Ù…Ùˆ Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/cloud growth/gi, "Ù†Ù…Ùˆ Ø§Ù„Ø³Ø­Ø§Ø¨Ø©")
    .replace(/AI platform demand/gi, "Ø·Ù„Ø¨ Ù…Ù†ØµØ§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/software margins/gi, "Ù‡ÙˆØ§Ù…Ø´ Ø§Ù„Ø¨Ø±Ù…Ø¬ÙŠØ§Øª")
    .replace(/large-cap quality/gi, "Ø¬ÙˆØ¯Ø© Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/enterprise spending/gi, "Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ù…Ø¤Ø³Ø³Ø§Øª")
    .replace(/AI software demand/gi, "Ø·Ù„Ø¨ Ø¨Ø±Ù…Ø¬ÙŠØ§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/government and enterprise contracts/gi, "Ø¹Ù‚ÙˆØ¯ Ø­ÙƒÙˆÙ…ÙŠØ© ÙˆÙ…Ø¤Ø³Ø³ÙŠØ©")
    .replace(/AI server demand/gi, "Ø·Ù„Ø¨ Ø®ÙˆØ§Ø¯Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/margin volatility/gi, "ØªØ°Ø¨Ø°Ø¨ Ø§Ù„Ù‡ÙˆØ§Ù…Ø´")
    .replace(/customer concentration/gi, "ØªØ±ÙƒØ² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡")
    .replace(/high-beta momentum/gi, "Ø²Ø®Ù… Ø¹Ø§Ù„ÙŠ Ø§Ù„Ø¨ÙŠØªØ§")
    .replace(/EV demand/gi, "Ø·Ù„Ø¨ Ø§Ù„Ù…Ø±ÙƒØ¨Ø§Øª Ø§Ù„ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ©")
    .replace(/pricing pressure/gi, "Ø¶ØºØ· Ø§Ù„Ø£Ø³Ø¹Ø§Ø±")
    .replace(/high-beta growth/gi, "Ù†Ù…Ùˆ Ø¹Ø§Ù„ÙŠ Ø§Ù„Ø¨ÙŠØªØ§")
    .replace(/margin sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ù‡ÙˆØ§Ù…Ø´")
    .replace(/momentum risk/gi, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ø²Ø®Ù…")
    .replace(/AI chip demand/gi, "Ø·Ù„Ø¨ Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/export risk/gi, "Ù…Ø®Ø§Ø·Ø± Ù‚ÙŠÙˆØ¯ Ø§Ù„ØªØµØ¯ÙŠØ±")
    .replace(/inventory cycles/gi, "Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†")
    .replace(/technology momentum/gi, "Ø²Ø®Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/exposure/gi, "Ø§Ù„ØªØ¹Ø±Ø¶")
    .replace(/concentration/gi, "Ø§Ù„ØªØ±ÙƒØ²")
    .replace(/cost/gi, "Ø§Ù„ØªÙƒÙ„ÙØ©")
    .replace(/score context/gi, "Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¯Ø±Ø¬Ø©")
    .replace(/readers/gi, "Ø§Ù„Ù‚Ø±Ø§Ø¡")
    .replace(/reader/gi, "Ø§Ù„Ù‚Ø§Ø±Ø¦")
    .replace(/standard/gi, "Ù…Ø¹ÙŠØ§Ø±")
    .replace(/demand/gi, "Ø§Ù„Ø·Ù„Ø¨")
    .replace(/breadth/gi, "Ø§Ù„Ø§ØªØ³Ø§Ø¹")
    .replace(/already/gi, "Ø¨Ø§Ù„ÙØ¹Ù„")
    .replace(/(\b[A-Z]{2,5}\b) stock FAQ/gi, "Ø£Ø³Ø¦Ù„Ø© Ø´Ø§Ø¦Ø¹Ø© Ø¹Ù† Ø³Ù‡Ù… $1")
    .replace(/(\b[A-Z]{2,5}\b) screening score/gi, "Ø¯Ø±Ø¬Ø© ÙØ­Øµ $1")
    .replace(/(\b[A-Z]{2,5}\b) educational analysis overview/gi, "Ù†Ø¸Ø±Ø© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø¹Ø§Ù…Ø© Ø¹Ù„Ù‰ $1")
    .replace(/AI infrastructure demand/gi, "Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/semiconductor leadership/gi, "Ø±ÙŠØ§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/valuation risk/gi, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/earnings sensitivity/gi, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø£Ø±Ø¨Ø§Ø­")
    .replace(/broad U\.S\. large-cap exposure/gi, "ØªØ¹Ø±Ø¶ ÙˆØ§Ø³Ø¹ Ù„Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/growth- and technology-tilted/gi, "Ù…Ø§Ø¦Ù„ Ø¥Ù„Ù‰ Ø§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Mock/gi, "ØªØ¹Ù„ÙŠÙ…ÙŠ")
    .replace(/Stock/gi, "Ø³Ù‡Ù…")
    .replace(/ETF/gi, "ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª");
  return out;
}

function normalizeArabicArtifacts(html) {
  const _b = [];
  html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, m => { _b.push(m); return `\x00B${_b.length - 1}\x00`; });
  html = html
    .replace(/Score\s+Ø§Ù„Ù†Ù…Ø·l?/g, "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯Ø±Ø¬Ø©")
    .replace(/Score\s+Model/g, "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯Ø±Ø¬Ø©")
    .replace(/Popular\s+ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø£Ø³Ù‡Ù…/g, "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©")
    .replace(/Screen high-interest\s+Ø§Ù„Ø£Ø³Ù‡Ù…/g, "ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù…")
    .replace(/Free AI\s+ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª\s+Screening/g, "ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Free\s+ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª\s+Screening\s+Tool/g, "Ø£Ø¯Ø§Ø© ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/AI\s+Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª\s*\|\s*Free\s+ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª\s+Screening\s+Tool\s*\|\s*TradeAlphaAI/g, "Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª | Ø£Ø¯Ø§Ø© ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª | TradeAlphaAI")
    .replace(/Screen\s+ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª\s+with\s+[^<"]+/g, "ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ø¹ ØªØ­Ù„ÙŠÙ„ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ÙˆØ£ÙƒØ¨Ø± Ø§Ù„Ù…ÙƒÙˆÙ†Ø§Øª ÙˆØ§Ù„ØªØ¹Ø±Ø¶ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆØ§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„ÙÙ†ÙŠØ© ÙˆÙ…Ù„Ø®Øµ Ø§Ù„Ù…Ø®Ø§Ø·Ø±.")
    .replace(/Analyze\s+ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª/g, "Ø­Ù„Ù„ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/>View\s+([A-Z]{1,5})</g, ">Ø¹Ø±Ø¶ $1<")
    .replace(/<strong>Screening<\/strong>/g, "<strong>ÙØ­Øµ Ø§Ù„Ø³ÙˆÙ‚</strong>")
    .replace(/\bScreening\b/g, "ÙØ­Øµ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Screen\s+Ø§Ù„Ø£Ø³Ù‡Ù…\s+Ùˆ\s+ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª\s+by\s+score[^<]*/g, "ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø­Ø³Ø¨ Ø§Ù„Ø¯Ø±Ø¬Ø© ÙˆØ§Ù„Ø²Ø®Ù… ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ù‚Ø·Ø§Ø¹ ÙˆØ§Ù„Ù…Ø¹Ù†ÙˆÙŠØ§Øª")
    .replace(/\bProvider\b/g, "Ù…Ø²ÙˆØ¯ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª")
    .replace(/>Screen\s+ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª</g, ">ÙØ­Øµ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª<")
    .replace(/>Screen\s+Ø§Ù„Ø£Ø³Ù‡Ù…</g, ">ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù…<")
    .replace(/Popular educational\s+Ø³Ù‡Ù… research Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "Ù…Ø­Ø§ÙˆØ± Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø´Ø§Ø¦Ø¹Ø© Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Popular educational\s+Ø³Ù‡Ù…\s+research/g, "Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ Ø´Ø§Ø¦Ø¹ Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/ØªØ¹Ù„ÙŠÙ…ÙŠ use only/g, "Ù„Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø·")
    .replace(/\bCompliance\b/g, "Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„")
    .replace(/security recommendations/g, "ØªÙˆØµÙŠØ§Øª Ø§Ù„Ø£ÙˆØ±Ø§Ù‚ Ø§Ù„Ù…Ø§Ù„ÙŠØ©")
    .replace(/price targets/g, "Ø£Ø³Ø¹Ø§Ø±Ø§Ù‹ Ù…Ø³ØªÙ‡Ø¯ÙØ©")
    .replace(/These Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©s are for educational Ùˆ informational purposes only Ùˆ Ù„Ø§ constitute Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©, Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ©, Ø£Ø³Ø¹Ø§Ø±Ø§ Ù…Ø³ØªÙ‡Ø¯ÙØ©, or ØªÙˆØµÙŠØ§Øª Ø§Ù„Ø£ÙˆØ±Ø§Ù‚ Ø§Ù„Ù…Ø§Ù„ÙŠØ©\./g, "Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ØªÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ© Ø£Ùˆ Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ© Ø£Ùˆ Ø£Ù‡Ø¯Ø§ÙØ§Ù‹ Ø³Ø¹Ø±ÙŠØ© Ø£Ùˆ ØªÙˆØµÙŠØ§Øª Ø¨Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ©.")
    .replace(/These Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©s are for educational[^<.]*\./g, "Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ØªÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ© Ø£Ùˆ Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ© Ø£Ùˆ Ø£Ù‡Ø¯Ø§ÙØ§Ù‹ Ø³Ø¹Ø±ÙŠØ© Ø£Ùˆ ØªÙˆØµÙŠØ§Øª Ø¨Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ©.")
    .replace(/predict future performance/g, "Ø§Ù„ØªÙ†Ø¨Ø¤ Ø¨Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠ")
    .replace(/Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚ content is for educational[^<]*/g, "Ù…Ø­ØªÙˆÙ‰ Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚ Ù„Ø£ØºØ±Ø§Ø¶ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§ØªÙŠØ© ÙÙ‚Ø· ÙˆÙ„Ø§ ÙŠÙØ¹Ø¯ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ© Ø£Ùˆ Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ©. Ù„Ø§ ØªÙˆØµÙŠ TradeAlphaAI Ø¨Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ© ÙˆÙ„Ø§ ØªÙ‚Ø¯Ù… Ø£Ù‡Ø¯Ø§ÙØ§Ù‹ Ø³Ø¹Ø±ÙŠØ© Ø£Ùˆ ØªÙ†Ø¨Ø¤Ø§Øª Ø¨Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠ.")
    .replace(/ØªØ¹Ù„ÙŠÙ…ÙŠ multi-factor\s+screening for Ø§Ù„Ø£Ø³Ù‡Ù… Ùˆ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ÙØ­Øµ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ù…Ø¹Ø§ÙŠÙŠØ± Ù„Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/multi-factor\s+screening for Ø§Ù„Ø£Ø³Ù‡Ù…/g, "ÙØ­Øµ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ù…Ø¹Ø§ÙŠÙŠØ± Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/multi-factor\s+screening/g, "ÙØ­Øµ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ù…Ø¹Ø§ÙŠÙŠØ±")
    .replace(/Research Platform/g, "Ù…Ù†ØµØ© Ø§Ù„Ø£Ø¨Ø­Ø§Ø«")
    .replace(/Interest Rate Ø¨Ø­Ø«: Ø­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© In Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ/g, "Ø¨Ø­Ø« Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©: Ø­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ Ù„Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©")
    .replace(/ØµÙ†Ø§Ø¯ÙŠÙ‚ ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/Static Research/g, "Ø¨Ø­Ø« Ø«Ø§Ø¨Øª")
    .replace(/Ø«Ø§Ø¨Øª Research/g, "Ø¨Ø­Ø« Ø«Ø§Ø¨Øª")
    .replace(/static research data/g, "Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø­Ø«ÙŠØ© Ø«Ø§Ø¨ØªØ©")
    .replace(/transparent static research data/g, "Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø­Ø«ÙŠØ© Ø«Ø§Ø¨ØªØ© ÙˆØ´ÙØ§ÙØ©")
    .replace(/The platform uses static educational data with a provider architecture prepared for future market data APIs\./g, "ØªØ³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ù†ØµØ© Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø«Ø§Ø¨ØªØ© Ù…Ø¹ Ø¨Ù†ÙŠØ© Ù…Ø²ÙˆØ¯ Ø¬Ø§Ù‡Ø²Ø© Ù„Ù„ØªÙƒØ§Ù…Ù„ Ù…Ø¹ ÙˆØ§Ø¬Ù‡Ø§Øª Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø³ÙˆÙ‚ Ù…Ø³ØªÙ‚Ø¨Ù„Ø§.")
    .replace(/Research popular U\.S\. Ø§Ù„Ø£Ø³Ù‡Ù… with a transparent Ø¯Ø±Ø¬Ø© TradeAlpha, analyst-style explanations, Ø§Ù„Ù…Ø®Ø§Ø·Ø± overview, Ùˆ educational Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ø³ÙŠØ§Ù‚\. Ù„Ø§ buy or sell recommendations are provided\./g, "Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø© Ø¹Ø¨Ø± Ø¯Ø±Ø¬Ø© TradeAlpha Ø´ÙØ§ÙØ© ÙˆØ´Ø±Ø­ Ø¨Ø­Ø«ÙŠ Ù…Ù†Ø¸Ù… ÙˆÙ…Ù„Ø®Øµ Ù„Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ³ÙŠØ§Ù‚ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ù„Ø§ ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ… ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/Research popular U\.S\. stocks with a transparent Ø¯Ø±Ø¬Ø© TradeAlpha, analyst-style explanations, Ø§Ù„Ù…Ø®Ø§Ø·Ø± overview, Ùˆ educational Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ø³ÙŠØ§Ù‚\. Ù„Ø§ buy or sell recommendations are provided\./g, "Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø© Ø¹Ø¨Ø± Ø¯Ø±Ø¬Ø© TradeAlpha Ø´ÙØ§ÙØ© ÙˆØ´Ø±Ø­ Ø¨Ø­Ø«ÙŠ Ù…Ù†Ø¸Ù… ÙˆÙ…Ù„Ø®Øµ Ù„Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ³ÙŠØ§Ù‚ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ù„Ø§ ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ… ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/Research popular U\.S\.[^<]+analyst-style explanations[^<]+provided\./g, "Ø§Ø¨Ø­Ø« ÙÙŠ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø© Ø¹Ø¨Ø± Ø¯Ø±Ø¬Ø© TradeAlpha Ø´ÙØ§ÙØ© ÙˆØ´Ø±Ø­ Ø¨Ø­Ø«ÙŠ Ù…Ù†Ø¸Ù… ÙˆÙ…Ù„Ø®Øµ Ù„Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ³ÙŠØ§Ù‚ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ù„Ø§ ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ… ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ for ÙÙ†ÙŠ, Ø£Ø³Ø§Ø³ÙŠ, Ùˆ Ø§Ù„Ù…Ø®Ø§Ø·Ø±-aware screening/g, "Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù„Ù„ÙØ­Øµ Ø§Ù„ÙÙ†ÙŠ ÙˆØ§Ù„Ø£Ø³Ø§Ø³ÙŠ ÙˆØ§Ù„ÙˆØ§Ø¹ÙŠ Ø¨Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Use the free TradeAlphaAI Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ for educational Ø³Ù‡Ù… screening, ÙÙ†ÙŠ scores, Ø§Ù„Ù…Ø®Ø§Ø·Ø± overview, Ùˆ Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø© candidate research\./g, "Ø§Ø³ØªØ®Ø¯Ù… Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù…Ù† TradeAlphaAI Ù„ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… ØªØ¹Ù„ÙŠÙ…ÙŠØ§ Ù…Ø¹ Ø¯Ø±Ø¬Ø§Øª ÙÙ†ÙŠØ© ÙˆÙ…Ù„Ø®Øµ Ù„Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ¨Ø­Ø« Ù…Ø±Ø´Ø­ÙŠ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©.")
    .replace(/Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ \| Free Ø³Ù‡Ù… Screening Tool \| TradeAlphaAI/g, "Ù…Ø­Ù„Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ | Ø£Ø¯Ø§Ø© ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ© | TradeAlphaAI")
    .replace(/Popular educational Ø³Ù‡Ù… research Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "Ù…Ø­Ø§ÙˆØ± Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø´Ø§Ø¦Ø¹Ø© Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/SEO Research Paths/g, "Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ø¨Ø­Ø«")
    .replace(/using transparent Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø­Ø«ÙŠØ© Ø«Ø§Ø¨ØªØ©/g, "Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø­Ø«ÙŠØ© Ø«Ø§Ø¨ØªØ© ÙˆØ´ÙØ§ÙØ©")
    .replace(/Move from research to a structured trading workflow/g, "Ø§Ù†ØªÙ‚Ù„ Ù…Ù† Ø§Ù„Ø¨Ø­Ø« Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø± ØªØ¯Ø§ÙˆÙ„ Ù…Ù†Ø¸Ù…")
    .replace(/Research workflow area for future premium screening views\./g, "Ù…Ø³Ø§Ø­Ø© Ø¨Ø­Ø«ÙŠØ© Ù„Ø¹Ø±ÙˆØ¶ ÙØ­Øµ Ù…ØªÙ‚Ø¯Ù…Ø© Ù…Ø³ØªÙ‚Ø¨Ù„Ø§.")
    .replace(/How Scores Work/g, "ÙƒÙŠÙ ØªØ¹Ù…Ù„ Ø§Ù„Ø¯Ø±Ø¬Ø§Øª")
    .replace(/TradeAlphaAI Focus Ø§Ù„Ù‚ÙˆØ§Ø¦Ù…/g, "Ù‚ÙˆØ§Ø¦Ù… ØªØ±ÙƒÙŠØ² TradeAlphaAI")
    .replace(/TradeAlphaAI Focus List/g, "Ù‚Ø§Ø¦Ù…Ø© ØªØ±ÙƒÙŠØ² TradeAlphaAI")
    .replace(/Research Rankings and Watchlists/g, "ØªØµÙ†ÙŠÙØ§Øª ÙˆÙ‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Research Rankings Ùˆ Watchlists/g, "ØªØµÙ†ÙŠÙØ§Øª ÙˆÙ‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Educational research rankings and watchlists for AI infrastructure stocks, semiconductor leaders, mega-cap technology, broad market ETFs, dividend ETFs, growth ETFs, and high-volatility research candidates\./g, "ØªØµÙ†ÙŠÙØ§Øª ÙˆÙ‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø­Ø«ÙŠØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆÙ‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù†Ù…Ùˆ ÙˆÙ…Ø±Ø´Ø­ÙŠ Ø§Ù„ØªÙ‚Ù„Ø¨ Ø§Ù„Ù…Ø±ØªÙØ¹.")
    .replace(/Most followed AI-linked research candidates from the TradeAlphaAI universe\. Educational ranking only, not financial advice\./g, "Ø£Ø¨Ø±Ø² Ù…Ø±Ø´Ø­ÙŠ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø±ØªØ¨Ø·ÙŠÙ† Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¶Ù…Ù† ØªØºØ·ÙŠØ© TradeAlphaAI. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Data center, accelerator, cloud, and infrastructure names followed by the research desk\. Educational ranking only, not financial advice\./g, "Ø£Ø³Ù…Ø§Ø¡ Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ§Ù„Ù…Ø³Ø±Ø¹Ø§Øª ÙˆØ§Ù„Ø­ÙˆØ³Ø¨Ø© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ© ÙˆØ§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ø§Ù„ØªÙŠ ÙŠØªØ§Ø¨Ø¹Ù‡Ø§ Ù…ÙƒØªØ¨ Ø§Ù„Ø£Ø¨Ø­Ø§Ø«. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Higher-beta research candidates where risk context matters as much as upside narratives\. Educational ranking only, not financial advice\./g, "Ù…Ø±Ø´Ø­ÙˆÙ† Ø¨Ø­Ø«ÙŠÙˆÙ† Ø£Ø¹Ù„Ù‰ ØªÙ‚Ù„Ø¨Ø§ Ø­ÙŠØ« ÙŠÙ‡Ù… Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø¨Ù‚Ø¯Ø± Ø£Ù‡Ù…ÙŠØ© Ø±ÙˆØ§ÙŠØ§Øª Ø§Ù„Ù†Ù…Ùˆ. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/The TradeAlpha Score combines technical score, fundamental score, momentum score, sentiment score, and risk adjustment\. The output uses safe screening labels such as Strong Setup, Neutral Setup, Weak Setup, Watchlist Candidate, High Risk, and Overextended\./g, "ØªØ¬Ù…Ø¹ Ø¯Ø±Ø¬Ø© TradeAlpha Ø¨ÙŠÙ† Ø§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„ÙÙ†ÙŠØ© ÙˆØ§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© ÙˆØ§Ù„Ø²Ø®Ù… ÙˆØ§Ù„Ù…Ø¹Ù†ÙˆÙŠØ§Øª ÙˆØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø®Ø§Ø·Ø±. ÙˆØªØ³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø®Ø±Ø¬Ø§Øª ØªØ³Ù…ÙŠØ§Øª ÙØ­Øµ Ø¢Ù…Ù†Ø© Ù…Ø«Ù„ Ø¥Ø¹Ø¯Ø§Ø¯ Ù‚ÙˆÙŠ Ø£Ùˆ Ù…Ø­Ø§ÙŠØ¯ Ø£Ùˆ Ø¶Ø¹ÙŠÙ Ø£Ùˆ Ù…Ø±Ø´Ø­ Ù„Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø£Ùˆ Ù…Ø®Ø§Ø·Ø± Ù…Ø±ØªÙØ¹Ø© Ø£Ùˆ Ø§Ù…ØªØ¯Ø§Ø¯ Ø²Ø§Ø¦Ø¯.")
    .replace(/Watchlists currently remain static-compatible\. Future releases can add saved views, alerts, portfolio research insights, and account-based persistence through protected services\./g, "ØªØ¨Ù‚Ù‰ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù…ØªÙˆØ§ÙÙ‚Ø© Ù…Ø¹ Ø§Ù„ØªØ´ØºÙŠÙ„ Ø§Ù„Ø«Ø§Ø¨Øª Ø­Ø§Ù„ÙŠØ§. ÙˆÙŠÙ…ÙƒÙ† Ù„Ù„Ø¥ØµØ¯Ø§Ø±Ø§Øª Ø§Ù„Ù„Ø§Ø­Ù‚Ø© Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø¹Ø±ÙˆØ¶ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ±Ø¤Ù‰ Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ­ÙØ¸ Ø§Ù„ØªÙØ¶ÙŠÙ„Ø§Øª Ø¹Ø¨Ø± Ø®Ø¯Ù…Ø§Øª Ù…Ø­Ù…ÙŠØ©.")
    .replace(/Mega-Cap Tech/g, "Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/mega-cap tech/g, "Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰")
    .replace(/market leadership/g, "Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/passive investing/g, "Ø§Ù„Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„Ø³Ù„Ø¨ÙŠ")
    .replace(/Trending ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø±Ø§Ø¦Ø¬Ø©")
    .replace(/Top Ø§Ù„Ø£Ø³Ù‡Ù… Ùˆ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª to watch across major market Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "Ø£ÙØ¶Ù„ Ø§Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø¹Ø¨Ø± Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©")
    .replace(/Ø§Ø³ØªÙƒØ´Ù high-CTR research Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©s for AI Ø§Ù„Ø£Ø³Ù‡Ù…, Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª leaders, growth Ø§Ù„Ø£Ø³Ù‡Ù…, dividend ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ùˆ high-Ø§Ù„ØªØ°Ø¨Ø°Ø¨ candidates\. These lists are Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ rankings, not buy or sell recommendations\./g, "Ø§Ø³ØªÙƒØ´Ù Ù‚ÙˆØ§Ø¦Ù… Ø¨Ø­Ø«ÙŠØ© Ø¬Ø°Ø§Ø¨Ø© Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆÙ‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆÙ…Ø±Ø´Ø­ÙŠ Ø§Ù„ØªÙ‚Ù„Ø¨ Ø§Ù„Ù…Ø±ØªÙØ¹. Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… ØªØµÙ†ÙŠÙØ§Øª Ø¨Ø­Ø«ÙŠØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ„ÙŠØ³Øª ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ rankings Ùˆ Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©s for Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø£Ø³Ù‡Ù…, Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª leaders, mega-cap Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§, Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, dividend ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, growth ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ùˆ high-Ø§Ù„ØªØ°Ø¨Ø°Ø¨ research candidates\./g, "ØªØµÙ†ÙŠÙØ§Øª ÙˆÙ‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø­Ø«ÙŠØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆÙ‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù†Ù…Ùˆ ÙˆÙ…Ø±Ø´Ø­ÙŠ Ø§Ù„ØªÙ‚Ù„Ø¨ Ø§Ù„Ù…Ø±ØªÙØ¹.")
    .replace(/Top AI Ø§Ù„Ø£Ø³Ù‡Ù… Right Now/g, "Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø­Ø§Ù„ÙŠØ§Ù‹")
    .replace(/Top Semiconductor Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Best Growth Ø§Ù„Ø£Ø³Ù‡Ù… to Watch/g, "Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/Top Dividend ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "Ø£ÙØ¶Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ ØªÙˆØ²ÙŠØ¹Ø§Øª Ø§Ù„Ø£Ø±Ø¨Ø§Ø­")
    .replace(/Top Broad Market ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "Ø£ÙØ¶Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/Most Followed AI Infrastructure Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£ÙƒØ«Ø± Ø£Ø³Ù‡Ù… Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/High Ø§Ù„ØªØ°Ø¨Ø°Ø¨ Watchlist/g, "Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø£Ø³Ù‡Ù… Ø¹Ø§Ù„ÙŠØ© Ø§Ù„ØªÙ‚Ù„Ø¨")
    .replace(/Most Followed Tech Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£ÙƒØ«Ø± Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„ØªÙ‚Ù†ÙŠØ© Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/Most followed AI-linked research candidates from the TradeAlphaAI universe\. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only, Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø£Ø¨Ø±Ø² Ù…Ø±Ø´Ø­ÙŠ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…Ø±ØªØ¨Ø·ÙŠÙ† Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¶Ù…Ù† ØªØºØ·ÙŠØ© TradeAlphaAI. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Data center, accelerator, cloud, Ùˆ infrastructure names followed by the research desk\. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only, Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø£Ø³Ù…Ø§Ø¡ Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ§Ù„Ù…Ø³Ø±Ø¹Ø§Øª ÙˆØ§Ù„Ø­ÙˆØ³Ø¨Ø© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ© ÙˆØ§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ø§Ù„ØªÙŠ ÙŠØªØ§Ø¨Ø¹Ù‡Ø§ Ù…ÙƒØªØ¨ Ø§Ù„Ø£Ø¨Ø­Ø§Ø«. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Chip, equipment, memory, Ùˆ AI compute names with strong research relevance\. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only, Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø´Ø±ÙƒØ§Øª Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚ ÙˆØ§Ù„Ù…Ø¹Ø¯Ø§Øª ÙˆØ§Ù„Ø°Ø§ÙƒØ±Ø© ÙˆØ­ÙˆØ³Ø¨Ø© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø°Ø§Øª Ø£Ù‡Ù…ÙŠØ© Ø¨Ø­Ø«ÙŠØ© Ø¹Ø§Ù„ÙŠØ©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Growth-oriented technology Ùˆ platform companies for educational comparison\. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only, Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø´Ø±ÙƒØ§Øª ØªÙ‚Ù†ÙŠØ© ÙˆÙ…Ù†ØµØ§Øª Ù…ÙˆØ¬Ù‡Ø© Ù„Ù„Ù†Ù…Ùˆ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Higher-beta research candidates where Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ø³ÙŠØ§Ù‚ matters as much as upside narratives\. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only, Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ù…Ø±Ø´Ø­ÙˆÙ† Ø¨Ø­Ø«ÙŠÙˆÙ† Ø£Ø¹Ù„Ù‰ ØªÙ‚Ù„Ø¨Ø§ Ø­ÙŠØ« ÙŠÙ‡Ù… Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø¨Ù‚Ø¯Ø± Ø£Ù‡Ù…ÙŠØ© Ø±ÙˆØ§ÙŠØ§Øª Ø§Ù„Ù†Ù…Ùˆ. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Investors follow ([A-Z0-9.-]+) for signals about [^<.]+?\./g, "ÙŠØªØ§Ø¨Ø¹ Ø§Ù„Ø¨Ø§Ø­Ø«ÙˆÙ† $1 Ù„ÙÙ‡Ù… Ø¥Ø´Ø§Ø±Ø§Øª Ø§Ù„Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ù‡ ÙˆÙ…ØªØ§Ù†Ø© Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª ÙˆØ§Ù„Ù…ÙˆÙ‚Ø¹ Ø§Ù„ØªÙ†Ø§ÙØ³ÙŠ ÙˆØ­Ø³Ø§Ø³ÙŠØ© Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆÙ‚ÙŠØ§Ø¯Ø© Ø§Ù„Ù‚Ø·Ø§Ø¹.")
    .replace(/Investors follow ([A-Z0-9.-]+) to compare [^<.]+?\./g, "ÙŠØªØ§Ø¨Ø¹ Ø§Ù„Ø¨Ø§Ø­Ø«ÙˆÙ† $1 Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ¹Ø±Ø¶ ÙˆØ¯ÙˆØ± Ø§Ù„ØªÙ†ÙˆÙŠØ¹ ÙˆÙ…Ù„Ù Ø§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹.")
    .replace(/Why do investors follow ([A-Z0-9.-]+)\?/g, "Ù„Ù…Ø§Ø°Ø§ ÙŠØªØ§Ø¨Ø¹ Ø§Ù„Ø¨Ø§Ø­Ø«ÙˆÙ† $1ØŸ")
    .replace(/([A-Z0-9.-]+) is followed for [^<.]+?\./g, "ÙŠØ­Ø¸Ù‰ $1 Ø¨Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ù„Ø£ØºØ±Ø§Ø¶ Ø¨Ø­Ø«ÙŠØ© Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ù…Ø­Ø§ÙˆØ± ÙˆØ§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆØ§Ù„ØªÙ‚ÙŠÙŠÙ….")
    .replace(/Why investors follow it/g, "Ù„Ù…Ø§Ø°Ø§ ÙŠØªØ§Ø¨Ø¹Ù‡ Ø§Ù„Ù…Ø³ØªØ«Ù…Ø±ÙˆÙ†")
    .replace(/Research Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¨Ø­Ø«ÙŠ")
    .replace(/Ø§Ù„ØªÙ†ÙˆÙŠØ¹ role/g, "Ø¯ÙˆØ± Ø§Ù„ØªÙ†ÙˆÙŠØ¹")
    .replace(/Stronger Ø§Ù„Ø·Ù„Ø¨ tied to Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ\./g, "Ø·Ù„Ø¨ Ø£Ù‚ÙˆÙ‰ Ù…Ø±ØªØ¨Ø· Ø¨Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.")
    .replace(/Durable margins Ùˆ execution quality\./g, "Ù‡ÙˆØ§Ù…Ø´ Ù…ØªÙŠÙ†Ø© ÙˆØ¬ÙˆØ¯Ø© ØªÙ†ÙÙŠØ° Ù…Ø±ØªÙØ¹Ø©.")
    .replace(/Potential leadership inside its sector research theme\./g, "Ø¥Ù…ÙƒØ§Ù†Ø§Øª Ù‚ÙŠØ§Ø¯Ø© Ø¶Ù…Ù† Ù…Ø­ÙˆØ±Ù‡ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ Ø§Ù„Ø¨Ø­Ø«ÙŠ.")
    .replace(/Ù„Ø§\. This page is Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ only Ùˆ Ù„Ø§ provide investment or Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ù„Ø§. Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø© Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø· ÙˆÙ„Ø§ ØªÙ‚Ø¯Ù… Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ© Ø£Ùˆ Ù…Ø§Ù„ÙŠØ©.")
    .replace(/AI GPU Infrastructure/g, "Ø¨Ù†ÙŠØ© GPU Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Cloud AI/g, "Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠ")
    .replace(/CUDA ecosystem, AI data-center GPU Ø§Ù„Ø·Ù„Ø¨, Ùˆ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª leadership Ø§Ù„Ø³ÙŠØ§Ù‚\./g, "Ù…Ù†Ø¸ÙˆÙ…Ø© CUDA ÙˆØ·Ù„Ø¨ ÙˆØ­Ø¯Ø§Øª GPU ÙÙŠ Ù…Ø±Ø§ÙƒØ² Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ³ÙŠØ§Ù‚ Ù‚ÙŠØ§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª.")
    .replace(/Azure AI, enterprise software, Ùˆ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ monetization research\./g, "Ø£Ø¨Ø­Ø§Ø« Azure AI ÙˆØ¨Ø±Ù…Ø¬ÙŠØ§Øª Ø§Ù„Ù…Ø¤Ø³Ø³Ø§Øª ÙˆÙØ±Øµ ØªØ­Ù‚ÙŠÙ‚ Ø§Ù„Ø¹Ø§Ø¦Ø¯ Ù…Ù† Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.")
    .replace(/Ø§Ù„Ø²Ø®Ù… Leaders/g, "Ù‚Ø§Ø¯Ø© Ø§Ù„Ø²Ø®Ù…")
    .replace(/Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Leaders/g, "Ù‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Market candidates/g, "Ù…Ø±Ø´Ø­Ùˆ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Ã¢â‚¬â€|Ã¢â‚¬â€œ/g, "-")
    .replace(/Ã¢â€ â€™/g, "â†")
    .replace(/Ã¢ÂÂ±/g, "")
    .replace(/Ã°Å¸â€œâ€š/g, "")
    .replace(/Ã°Å¸â€œâ€¦/g, "")
    .replace(/Ã‚Â·/g, "Â·")
    .replace(/Read\s*â†/g, "Ø§Ù‚Ø±Ø£ â†")
    .replace(/AI Investing/g, "Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Index Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©/g, "Ù…Ù†Ù‡Ø¬ÙŠØ© Ø§Ù„Ù…Ø¤Ø´Ø±")
    .replace(/TradeAlphaAI Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚ Team/g, "ÙØ±ÙŠÙ‚ TradeAlphaAI Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/UnderstÙˆing/g, "ÙÙ‡Ù…")
    .replace(/understÙˆing/g, "ÙÙ‡Ù…")
    .replace(/demÙˆ/g, "Ø§Ù„Ø·Ù„Ø¨")
    .replace(/bØ§Ù‚Ø±Ø£th/g, "Ø§Ù„Ø§ØªØ³Ø§Ø¹")
    .replace(/alØ§Ù‚Ø±Ø£y/g, "Ø¨Ø§Ù„ÙØ¹Ù„")
    .replace(/stÙˆard/g, "Ù…Ø¹ÙŠØ§Ø±")
    .replace(/InfiniBÙˆ/g, "InfiniBand")
    .replace(/bÙˆwidth/g, "Ø¹Ø±Ø¶ Ø§Ù„Ù†Ø·Ø§Ù‚")
    .replace(/expÙˆ/g, "ÙŠÙˆØ³Ø¹")
    .replace(/PÙˆemic/g, "ØµØ¯Ù…Ø© Ø§Ù„Ø¬Ø§Ø¦Ø­Ø©")
    .replace(/Ø§Ù‚Ø±Ø£ article/g, "Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ù‚Ø§Ù„")
    .replace(/Related Research/g, "Ø£Ø¨Ø­Ø§Ø« Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Research Hub/g, "Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø«")
    .replace(/AI Stock Screener/g, "Ù…Ø§Ø³Ø­ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/ETF Screener/g, "Ù…Ø§Ø³Ø­ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/\bScreener\b/g, "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Generated Hub/g, "Ù…Ø­ÙˆØ± Ø¨Ø­Ø«ÙŠ")
    .replace(/Generated Stock Page/g, "ØµÙØ­Ø© Ø³Ù‡Ù… ØªØ¹Ù„ÙŠÙ…ÙŠØ©")
    .replace(/Generated ETF Page/g, "ØµÙØ­Ø© ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ©")
    .replace(/Educational ([^<.]+?) hub covering/gi, "Ù…Ø­ÙˆØ± ØªØ¹Ù„ÙŠÙ…ÙŠ ÙŠØºØ·ÙŠ")
    .replace(/Educational growth Ø§Ù„Ø£Ø³Ù‡Ù… hub covering/gi, "Ù…Ø­ÙˆØ± ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ ÙŠØºØ·ÙŠ")
    .replace(/Educational dividend ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª hub covering/gi, "Ù…Ø­ÙˆØ± ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙŠØºØ·ÙŠ")
    .replace(/Educational Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„Ø£Ø³Ù‡Ù… hub covering/gi, "Ù…Ø­ÙˆØ± ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙŠØºØ·ÙŠ")
    .replace(/revenue growth/g, "Ù†Ù…Ùˆ Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª")
    .replace(/sector Ø§Ù„Ù…Ø®Ø§Ø·Ø±s/g, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù‚Ø·Ø§Ø¹")
    .replace(/sector Ø§Ù„ØªØ±ÙƒØ²/g, "Ø§Ù„ØªØ±ÙƒØ² Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ")
    .replace(/interest rates/g, "Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©")
    .replace(/currency strength/g, "Ù‚ÙˆØ© Ø§Ù„Ø¹Ù…Ù„Ø©")
    .replace(/commodity Ø§Ù„ØªØ¹Ø±Ø¶/g, "Ø§Ù„ØªØ¹Ø±Ø¶ Ù„Ù„Ø³Ù„Ø¹")
    .replace(/liquidity/g, "Ø§Ù„Ø³ÙŠÙˆÙ„Ø©")
    .replace(/the Ø§Ù„ØªØ°Ø¨Ø°Ø¨ of top holdings/g, "ØªØ°Ø¨Ø°Ø¨ Ø£ÙƒØ¨Ø± Ø§Ù„Ù…ÙƒÙˆÙ†Ø§Øª")
    .replace(/What affects ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªØ°Ø¨Ø°Ø¨\?/g, "Ù…Ø§ Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„ØªÙŠ ØªØ¤Ø«Ø± ÙÙŠ ØªØ°Ø¨Ø°Ø¨ ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§ØªØŸ")
    .replace(/Does the analyzer provide Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\?/g, "Ù‡Ù„ ÙŠÙ‚Ø¯Ù… Ø§Ù„Ù…Ø­Ù„Ù„ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©ØŸ")
    .replace(/Can I use this as a Ø³Ù‡Ù… screener\?/g, "Ù‡Ù„ ÙŠÙ…ÙƒÙ† Ø§Ø³ØªØ®Ø¯Ø§Ù…Ù‡ ÙƒÙ…Ø§Ø³Ø­ Ù„Ù„Ø£Ø³Ù‡Ù…ØŸ")
    .replace(/it is designed as an educational Ø³Ù‡Ù… screening experience/gi, "Ù†Ø¹Ù…ØŒ ØµÙÙ…Ù… ÙƒØªØ¬Ø±Ø¨Ø© ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Why include Ø§Ù„Ù…Ø®Ø§Ø·Ø± adjustment\?/g, "Ù„Ù…Ø§Ø°Ø§ ÙŠØªØ¶Ù…Ù† Ø§Ù„Ù†Ù…ÙˆØ°Ø¬ ØªØ¹Ø¯ÙŠÙ„Ø§ Ù„Ù„Ù…Ø®Ø§Ø·Ø±ØŸ")
    .replace(/Ø§Ù„Ù…Ø®Ø§Ø·Ø± adjustment prevents high Ø§Ù„Ø²Ø®Ù… or strong Ø£Ø³Ø§Ø³ÙŠs from/gi, "ÙŠØ³Ø§Ø¹Ø¯ ØªØ¹Ø¯ÙŠÙ„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø¹Ù„Ù‰ Ù…Ù†Ø¹ Ø§Ù„Ø²Ø®Ù… Ø§Ù„Ù…Ø±ØªÙØ¹ Ø£Ùˆ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ§Øª Ø§Ù„Ù‚ÙˆÙŠØ© Ù…Ù†")
    .replace(/Does Ø¯Ø±Ø¬Ø© TradeAlpha provide Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\?/g, "Ù‡Ù„ ØªÙ‚Ø¯Ù… Ø¯Ø±Ø¬Ø© TradeAlpha Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©ØŸ")
    .replace(/Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ© questions/g, "Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ©")
    .replace(/ØªØ­Ù„ÙŠÙ„ Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ questions/g, "Ø£Ø³Ø¦Ù„Ø© ØªØ­Ù„ÙŠÙ„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªØ°Ø¨Ø°Ø¨ Ù‚Ø¯ ÙŠØªØ£Ø«Ø± Ø¨Ù€/g, "Ù‚Ø¯ ÙŠØªØ£Ø«Ø± ØªØ°Ø¨Ø°Ø¨ ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø¨Ù€")
    .replace(/Use this page as educational Ø§Ù„Ø³ÙŠØ§Ù‚ alongside/gi, "Ø§Ø³ØªØ®Ø¯Ù… Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø© ÙƒØ³ÙŠØ§Ù‚ ØªØ¹Ù„ÙŠÙ…ÙŠ Ø¥Ù„Ù‰ Ø¬Ø§Ù†Ø¨")
    .replace(/Built for education Ùˆ Ù‡ÙŠÙƒÙ„ Ø§Ù„Ø³ÙˆÙ‚ understanding, not investment advice\./gi, "Ø£ÙØ¹Ø¯Øª Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø© Ù„Ù„ØªØ«Ù‚ÙŠÙ ÙˆÙÙ‡Ù… Ø¨Ù†ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ØŒ ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ©.")
    .replace(/not investment advice/gi, "ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ©")
    .replace(/investment advice/gi, "Ù†ØµÙŠØ­Ø© Ø§Ø³ØªØ«Ù…Ø§Ø±ÙŠØ©")
    .replace(/Market sensitivity Ùˆ equity duration/g, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ ÙˆÙ…Ø¯Ø© Ø§Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Multiple frameworks comparison/g, "Ù…Ù‚Ø§Ø±Ù†Ø© Ø¨ÙŠÙ† Ø£Ø·Ø± Ù…ØªØ¹Ø¯Ø¯Ø©")
    .replace(/Market sensitivity explained/g, "Ø´Ø±Ø­ Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Mega-cap weight in major indices/g, "ÙˆØ²Ù† Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ù‚Ø© ÙÙŠ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©")
    .replace(/Gold â€” macro hedge Ùˆ portfolio Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø§Ù„Ø°Ù‡Ø¨: ØªØ­ÙˆØ· ÙƒÙ„ÙŠ ÙˆØ³ÙŠØ§Ù‚ Ù„Ù„Ù…Ø­ÙØ¸Ø©")
    .replace(/Long-duration bond ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ù„Ø³Ù†Ø¯Ø§Øª Ø·ÙˆÙŠÙ„Ø© Ø§Ù„Ù…Ø¯Ø©")
    .replace(/Broad-market rate comparison/g, "Ù…Ù‚Ø§Ø±Ù†Ø© Ø£Ø«Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/Open Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚/g, "Ø§ÙØªØ­ Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Open hub/g, "Ø§ÙØªØ­ Ø§Ù„Ù…Ø­ÙˆØ±")
    .replace(/Open Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚/g, "Ø§ÙØªØ­ Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Open Market Data Status/g, "Ø§ÙØªØ­ Ø­Ø§Ù„Ø© Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Load/g, "Ø§Ø¹Ø±Ø¶")
    .replace(/Use Case/g, "Ø­Ø§Ù„Ø© Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…")
    .replace(/Expense Ratio/g, "Ù†Ø³Ø¨Ø© Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ")
    .replace(/Popular ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø´Ø§Ø¦Ø¹Ø©")
    .replace(/Screen broad market, growth, Ùˆ Ø§Ù„ØªØ¹Ø±Ø¶ Ù„Ù„Ø°Ù‡Ø¨/gi, "Ø§ÙØ­Øµ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆØ§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„ØªØ¹Ø±Ø¶ Ù„Ù„Ø°Ù‡Ø¨")
    .replace(/Phase 2 supports/gi, "ØªØ¯Ø¹Ù… Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„Ø«Ø§Ù†ÙŠØ©")
    .replace(/with realistic ØªØ¹Ù„ÙŠÙ…ÙŠ ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª allocation data/gi, "Ù…Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆØ§Ù‚Ø¹ÙŠØ© Ù„ØªÙˆØ²ÙŠØ¹ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/How SPY compares to QQQ/g, "ÙƒÙŠÙ ÙŠÙ‚Ø§Ø±Ù† SPY Ù…Ø¹ QQQ")
    .replace(/AI Market Ø¨Ø­Ø« Ù…Ø®ØªØ§Ø±/g, "Ø£Ø¨Ø­Ø§Ø« Ù…Ø®ØªØ§Ø±Ø© Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/AI Ø§Ù„Ø£Ø³Ù‡Ù… research hub/g, "Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø« Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Education/g, "ØªØ¹Ù„ÙŠÙ… ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/A curated finance research library[^<.]*/gi, "Ù…ÙƒØªØ¨Ø© Ø£Ø¨Ø­Ø§Ø« Ù…Ø§Ù„ÙŠØ© Ù…Ù†Ø¸Ù…Ø© Ù„ÙÙ‡Ù… Ø§Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª ÙˆÙ…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„ÙƒÙ„ÙŠ")
    .replace(/A fast educational screener for watchlist candidates, Ø§Ù„Ø²Ø®Ù… leaders, Ø§Ù„Ù…Ø®Ø§Ø·Ø± overview, defensive profiles, Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª leaders, Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø£Ø³Ù‡Ù…, Ùˆ trending ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª\./gi, "Ù…Ø§Ø³Ø­ ØªØ¹Ù„ÙŠÙ…ÙŠ Ø³Ø±ÙŠØ¹ Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© ÙˆÙ‚Ø§Ø¯Ø© Ø§Ù„Ø²Ø®Ù… ÙˆÙ…Ù„Ø®ØµØ§Øª Ø§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„Ø¯ÙØ§Ø¹ÙŠØ© ÙˆÙ‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ£Ø³Ù‡Ù… Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø±Ø§Ø¦Ø¬Ø©.")
    .replace(/Stock Analyzer/g, "Ù…Ø­Ù„Ù„ Ø§Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Ø³Ù‡Ù… Analyzer/g, "Ù…Ø­Ù„Ù„ Ø§Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Curated Assets/g, "Ø£ØµÙˆÙ„ Ù…Ø®ØªØ§Ø±Ø©")
    .replace(/watchlist candidates/g, "Ù…Ø±Ø´Ø­Ùˆ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/Recently Viewed/g, "Ø´ÙˆÙ‡Ø¯Øª Ù…Ø¤Ø®Ø±Ø§")
    .replace(/Your local research trail/g, "Ù…Ø³Ø§Ø± Ø£Ø¨Ø­Ø§Ø«Ùƒ Ø§Ù„Ù…Ø­Ù„ÙŠ")
    .replace(/Does a strong ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª score mean it is a recommendation\?/g, "Ù‡Ù„ ØªØ¹Ù†ÙŠ Ø§Ù„Ø¯Ø±Ø¬Ø© Ø§Ù„Ù‚ÙˆÙŠØ© Ù„ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø£Ù†Ù‡Ø§ ØªÙˆØµÙŠØ©ØŸ")
    .replace(/The score is an educational screening label only\./g, "Ø§Ù„Ø¯Ø±Ø¬Ø© Ù…Ø¤Ø´Ø± ÙØ­Øµ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø·.")
    .replace(/not as a ranking recommendation\./g, "ÙˆÙ„ÙŠØ³ ÙƒØªÙˆØµÙŠØ© ØªØ±ØªÙŠØ¨ÙŠØ©.")
    .replace(/Why do SPY Ùˆ QQQ behave differently\?/g, "Ù„Ù…Ø§Ø°Ø§ ÙŠØªØ­Ø±Ùƒ SPY Ùˆ QQQ Ø¨Ø´ÙƒÙ„ Ù…Ø®ØªÙ„ÙØŸ")
    .replace(/SPY is broader large-cap Ø§Ù„ØªØ¹Ø±Ø¶, while QQQ is more concentrated in growth Ùˆ Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§-linked holdings\./g, "ÙŠÙˆÙØ± SPY ØªØ¹Ø±Ø¶Ø§ Ø£ÙˆØ³Ø¹ Ù„Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ÙƒØ¨Ø±Ù‰ØŒ Ø¨ÙŠÙ†Ù…Ø§ ÙŠØªØ±ÙƒØ² QQQ Ø¨Ø¯Ø±Ø¬Ø© Ø£ÙƒØ¨Ø± ÙÙŠ Ù…ÙƒÙˆÙ†Ø§Øª Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§.")
    .replace(/Why compare Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ\?/g, "Ù„Ù…Ø§Ø°Ø§ Ù†Ù‚Ø§Ø±Ù† Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙØŸ")
    .replace(/Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ affect long-term ownership Ø§Ù„ØªÙƒÙ„ÙØ©s\./g, "ØªØ¤Ø«Ø± Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ÙÙŠ ØªÙƒÙ„ÙØ© Ø§Ù„Ù…Ù„ÙƒÙŠØ© Ø·ÙˆÙŠÙ„Ø© Ø§Ù„Ø£Ø¬Ù„.")
    .replace(/The portal displays them for/g, "ØªØ¹Ø±Ø¶Ù‡Ø§ Ø§Ù„Ø¨ÙˆØ§Ø¨Ø© Ù…Ù† Ø£Ø¬Ù„")
    .replace(/Low-Ø§Ù„ØªÙƒÙ„ÙØ© S&amp;amp;P 500 Ø§Ù„ØªØ¹Ø±Ø¶, Ø§Ù„ØªÙ†ÙˆÙŠØ¹, sector allocation, Ùˆ broad market Ø§Ù„ØªØ°Ø¨Ø°Ø¨\./g, "ØªØ¹Ø±Ø¶ Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ© Ù„Ù…Ø¤Ø´Ø± S&amp;amp;P 500 Ù…Ø¹ Ø§Ù„ØªÙ†ÙˆÙŠØ¹ ÙˆØ§Ù„ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆØªØ°Ø¨Ø°Ø¨ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹.")
    .replace(/Low-Ø§Ù„ØªÙƒÙ„ÙØ© S&P 500 Ø§Ù„ØªØ¹Ø±Ø¶, Ø§Ù„ØªÙ†ÙˆÙŠØ¹, sector allocation, Ùˆ broad market Ø§Ù„ØªØ°Ø¨Ø°Ø¨\./g, "ØªØ¹Ø±Ø¶ Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ© Ù„Ù…Ø¤Ø´Ø± S&P 500 Ù…Ø¹ Ø§Ù„ØªÙ†ÙˆÙŠØ¹ ÙˆØ§Ù„ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆØªØ°Ø¨Ø°Ø¨ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹.")
    .replace(/sector allocation/g, "Ø§Ù„ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ")
    .replace(/broad market/g, "Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/Open screener/g, "Ø§ÙØªØ­ Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Understanding Beta: How Market Sensitivity Measures Ø§Ù„Ù…Ø®Ø§Ø·Ø± in Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø³Ù‡Ù… Research/g, "ÙÙ‡Ù… Ø¨ÙŠØªØ§: ÙƒÙŠÙ ØªÙ‚ÙŠØ³ Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ Ù…Ø®Ø§Ø·Ø± Ø£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Understanding Beta: How Market Sensitivity Measures Risk in Technology Stock Research/g, "ÙÙ‡Ù… Ø¨ÙŠØªØ§: ÙƒÙŠÙ ØªÙ‚ÙŠØ³ Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ Ù…Ø®Ø§Ø·Ø± Ø£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Understanding Beta/g, "ÙÙ‡Ù… Ø¨ÙŠØªØ§")
    .replace(/Growth Ø§Ù„Ø£Ø³Ù‡Ù… Hub/g, "Ù…Ø­ÙˆØ± Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ")
    .replace(/Growth equity research hub/g, "Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø« Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ")
    .replace(/company filings/g, "Ø¥ÙØµØ§Ø­Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ§Øª")
    .replace(/portfolio Ø§Ù„Ù…Ø®Ø§Ø·Ø±/g, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ø­ÙØ¸Ø©")
    .replace(/macro Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„ÙƒÙ„ÙŠ")
    .replace(/The provider architecture is separated so Yahoo Finance, Alpha Vantage, Polygon\.io, or Finnhub can be added later through a protected integration\./g, "Ø¨Ù†ÙŠØ© Ù…Ø²ÙˆØ¯ÙŠ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ù†ÙØµÙ„Ø© Ø¨Ø­ÙŠØ« ÙŠÙ…ÙƒÙ† Ø¥Ø¶Ø§ÙØ© Yahoo Finance Ø£Ùˆ Alpha Vantage Ø£Ùˆ Polygon.io Ø£Ùˆ Finnhub Ù„Ø§Ø­Ù‚Ø§ Ø¹Ø¨Ø± ØªÙƒØ§Ù…Ù„ Ù…Ø­Ù…ÙŠ.")
    .replace(/Phase 1 uses ØªØ¹Ù„ÙŠÙ…ÙŠ data with a provider architecture prepared for future market data APIs\./g, "ØªØ³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù…Ø¹ Ø¨Ù†ÙŠØ© Ù…Ø²ÙˆØ¯ÙŠ Ø¨ÙŠØ§Ù†Ø§Øª Ø¬Ø§Ù‡Ø²Ø© Ù„ÙˆØ§Ø¬Ù‡Ø§Øª Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ©.")
    .replace(/Will real market data be connected later\?/g, "Ù‡Ù„ Ø³ÙŠØªÙ… Ø±Ø¨Ø· Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù„Ø§Ø­Ù‚Ø§ØŸ")
    .replace(/transparent ØªØ¹Ù„ÙŠÙ…ÙŠ data in Phase 1/g, "Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø´ÙØ§ÙØ© ÙÙŠ Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰")
    .replace(/Premium Signals Placeholder/g, "Ø¥Ø´Ø§Ø±Ø§Øª Ù…ØªÙ‚Ø¯Ù…Ø© Ù‚ÙŠØ¯ Ø§Ù„ØªØ­Ø¶ÙŠØ±")
    .replace(/CTA for future premium workflows\./g, "Ø¯Ø¹ÙˆØ© Ù…Ø®ØµØµØ© Ù„ØªØ¯ÙÙ‚Ø§Øª Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…ØªÙ‚Ø¯Ù…Ø© Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ©.")
    .replace(/Ù„Ø§ backend is connected yet\./g, "Ù„Ù… ÙŠØªÙ… Ø±Ø¨Ø· Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© Ø§Ù„Ø®Ù„ÙÙŠØ© Ø¨Ø¹Ø¯.")
    .replace(/Future placeholder for portfolio-level screening, alerts, Ùˆ saved research\./g, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.")
    .replace(/Future placeholder for portfolio-level screening, alerts, Ùˆ saved research/gi, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©")
    .replace(/Premium Signals/g, "Ø¥Ø´Ø§Ø±Ø§Øª Ù…ØªÙ‚Ø¯Ù…Ø©")
    .replace(/<strong>Premium Signals<\/strong>/g, "<strong>Ø¥Ø´Ø§Ø±Ø§Øª Ù…ØªÙ‚Ø¯Ù…Ø©</strong>")
    .replace(/>Placeholder /g, ">Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© ")
    .replace(/Portfolio AI Ø±Ø¤Ù‰ Ø§Ù„Ø³ÙˆÙ‚/g, "Ø±Ø¤Ù‰ Ù…Ø­Ø§ÙØ¸ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/market education from TradeAlphaAI/g, "ØªØ«Ù‚ÙŠÙ Ø§Ù„Ø³ÙˆÙ‚ Ù…Ù† TradeAlphaAI")
    .replace(/Review the TradeAlphaAI system Ùˆ premium gold trading product\./g, "Ø±Ø§Ø¬Ø¹ Ù†Ø¸Ø§Ù… TradeAlphaAI ÙˆÙ…Ù†ØªØ¬ Ø¥Ø´Ø§Ø±Ø§Øª Ø§Ù„Ø°Ù‡Ø¨ Ø§Ù„Ù…ØªÙ‚Ø¯Ù….")
    .replace(/Future Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© for portfolio-level screening, alerts, Ùˆ saved Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ views\./g, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ·Ø±Ù‚ Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.")
    .replace(/Future Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© for portfolio-level screening, alerts, Ùˆ saved research\./g, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.")
    .replace(/Future placeholder for portfolio-level screening, alerts, Ùˆ saved Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ views\./g, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ·Ø±Ù‚ Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.")
    .replace(/placeholder="Search ticker, e\.g\. NVDA or AAPL"/g, 'placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø±Ù…Ø²ØŒ Ù…Ø«Ù„ NVDA Ø£Ùˆ AAPL"')
    .replace(/aria-label="Search Ø³Ù‡Ù… ticker"/g, 'aria-label="Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ø±Ù…Ø² Ø³Ù‡Ù…"')
    .replace(/Telegram updates/g, "ØªØ­Ø¯ÙŠØ«Ø§Øª ØªÙŠÙ„ÙŠØ¬Ø±Ø§Ù…")
    .replace(/Can this Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ© scale to more symbols\?/g, "Ù‡Ù„ ÙŠÙ…ÙƒÙ† ØªÙˆØ³ÙŠØ¹ Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù†Ù‡Ø¬ÙŠØ© Ù„ØªØ´Ù…Ù„ Ø±Ù…ÙˆØ²Ø§ Ø£ÙƒØ«Ø±ØŸ")
    .replace(/The scoring engine Ùˆ content templates are designed to support future generated Ø³Ù‡Ù… Ùˆ ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª pages\./g, "ØµÙÙ…Ù… Ù…Ø­Ø±Ùƒ Ø§Ù„Ø¯Ø±Ø¬Ø§Øª ÙˆÙ‚ÙˆØ§Ù„Ø¨ Ø§Ù„Ù…Ø­ØªÙˆÙ‰ Ù„Ø¯Ø¹Ù… ØµÙØ­Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª.")
    .replace(/elevated Ø§Ù„Ù…Ø®Ø§Ø·Ø± conditions/g, "Ø¸Ø±ÙˆÙ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ø±ØªÙØ¹Ø©")
    .replace(/TradeAlphaAI Ù„Ø§ recommend securities, provide price targets, or predict future performance\./g, "Ù„Ø§ ØªÙˆØµÙŠ TradeAlphaAI Ø¨Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ© ÙˆÙ„Ø§ ØªÙ‚Ø¯Ù… Ø£Ø³Ø¹Ø§Ø±Ø§ Ù…Ø³ØªÙ‡Ø¯ÙØ© ÙˆÙ„Ø§ ØªØªÙ†Ø¨Ø£ Ø¨Ø§Ù„Ø£Ø¯Ø§Ø¡ Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠ.")
    .replace(/price targets/g, "Ø£Ø³Ø¹Ø§Ø±Ø§ Ù…Ø³ØªÙ‡Ø¯ÙØ©")
    .replace(/recommend securities/g, "ØªÙˆØµÙŠ Ø¨Ø£ÙˆØ±Ø§Ù‚ Ù…Ø§Ù„ÙŠØ©")
    .replace(/Featured Article/g, "Ù…Ù‚Ø§Ù„ Ù…Ù…ÙŠØ²")
    .replace(/Reference/g, "Ù…Ø±Ø¬Ø¹")
    .replace(/Related ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ø±ØªØ¨Ø·Ø© Ùˆ Ø§Ù„Ø£Ø³Ù‡Ù…/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ ÙˆØ£Ø³Ù‡Ù… Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Ù…Ø®Ø§Ø·Ø± Analysis/g, "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/FAQ\b/g, "Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©")
    .replace(/SEO Overview/g, "Ù†Ø¸Ø±Ø© Ø¨Ø­Ø«ÙŠØ© Ù…ÙˆØ¬Ø²Ø©")
    .replace(/TradeAlpha Research Desk/g, "Ù…ÙƒØªØ¨ Ø£Ø¨Ø­Ø§Ø« TradeAlpha")
    .replace(/GPU Compute/g, "ÙˆØ­Ø¯Ø© GPU Ø§Ù„Ø­Ø§Ø³ÙˆØ¨ÙŠØ©")
    .replace(/\bData Centers\b/g, "Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª")
    .replace(/Company Overview/g, "Ù†Ø¸Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø±ÙƒØ©")
    .replace(/ETF Methodology/g, "Ù…Ù†Ù‡Ø¬ÙŠØ© ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/Research Context/g, "Ø§Ù„Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¨Ø­Ø«ÙŠ")
    .replace(/Positive research factors/g, "Ø¹ÙˆØ§Ù…Ù„ Ø¨Ø­Ø«ÙŠØ© Ø¯Ø§Ø¹Ù…Ø©")
    .replace(/Bull case framework/g, "Ø¥Ø·Ø§Ø± Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ø¥ÙŠØ¬Ø§Ø¨ÙŠØ©")
    .replace(/Bear case and risk factors/g, "Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ø³Ù„Ø¨ÙŠØ© ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Bear case Ùˆ Ø§Ù„Ù…Ø®Ø§Ø·Ø± factors/g, "Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ø³Ù„Ø¨ÙŠØ© ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Risk layer/g, "Ø·Ø¨Ù‚Ø© Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Valuation Context/g, "Ø³ÙŠØ§Ù‚ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/Valuation Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/Research score context/g, "Ø³ÙŠØ§Ù‚ Ø¯Ø±Ø¬Ø© Ø§Ù„Ø¨Ø­Ø«")
    .replace(/Research score Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ Ø¯Ø±Ø¬Ø© Ø§Ù„Ø¨Ø­Ø«")
    .replace(/Related ETFs and stocks/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ ÙˆØ£Ø³Ù‡Ù… Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Related stocks and ETFs/g, "Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Connected research paths/g, "Ù…Ø³Ø§Ø±Ø§Øª Ø¨Ø­Ø«ÙŠØ© Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Full analysis/g, "Ø§ÙØªØ­ Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„ÙƒØ§Ù…Ù„")
    .replace(/Related research/g, "Ø¨Ø­Ø« Ù…Ø±ØªØ¨Ø·")
    .replace(/research score/g, "Ø¯Ø±Ø¬Ø© Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Educational ranking/g, "ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ")
    .replace(/Research Watchlists/g, "Ù‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø© Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Educational rankings for market focus lists/g, "ØªØµÙ†ÙŠÙØ§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù„Ù‚ÙˆØ§Ø¦Ù… ØªØ±ÙƒÙŠØ² Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/Research-ranked assets for comparison Ùˆ watchlist building\. Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø£ØµÙˆÙ„ Ù…Ø±ØªØ¨Ø© Ø¨Ø­Ø«ÙŠØ§ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø© ÙˆØ¨Ù†Ø§Ø¡ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Research-ranked assets for comparison and watchlist building\. Not financial advice\./g, "Ø£ØµÙˆÙ„ Ù…Ø±ØªØ¨Ø© Ø¨Ø­Ø«ÙŠØ§ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø© ÙˆØ¨Ù†Ø§Ø¡ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ø§Ù„Ù…Ø­ØªÙˆÙ‰ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³ Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Compare research-ranked assets across Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ, Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª, mega-cap Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§, broad market ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, dividend ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, growth ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ùˆ high-volatility watchlists\. These rankings are educational research views, not recommendations\./g, "Ù‚Ø§Ø±Ù† Ù‚ÙˆØ§Ø¦Ù… Ø¨Ø­Ø«ÙŠØ© Ø¬Ø°Ø§Ø¨Ø© ØªØºØ·ÙŠ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„ÙƒØ¨Ø±Ù‰ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù†Ù…Ùˆ ÙˆÙ‚ÙˆØ§Ø¦Ù… Ø§Ù„ØªÙ‚Ù„Ø¨ Ø§Ù„Ù…Ø±ØªÙØ¹. Ù‡Ø°Ù‡ ØªØµÙ†ÙŠÙØ§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ„ÙŠØ³Øª ØªÙˆØµÙŠØ§Øª.")
    .replace(/Coverage/g, "Ø§Ù„ØªØºØ·ÙŠØ©")
    .replace(/Lists/g, "Ø§Ù„Ù‚ÙˆØ§Ø¦Ù…")
    .replace(/Advice/g, "Ø§Ù„Ù†ØµÙŠØ­Ø©")
    .replace(/None/g, "Ù„Ø§ ÙŠÙˆØ¬Ø¯")
    .replace(/Mode/g, "Ø§Ù„Ù†Ù…Ø·")
    .replace(/\bStatic\b/g, "Ø«Ø§Ø¨Øª")
    .replace(/Ø«Ø§Ø¨Øª research/g, "Ø¨Ø­Ø« Ø«Ø§Ø¨Øª")
    .replace(/watchlist/g, "Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/watchlists/g, "Ù‚ÙˆØ§Ø¦Ù… Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/high-volatility-Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©/g, "high-volatility-watchlist")
    .replace(/Top AI Picks/g, "Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Momentum Leaders/g, "Ù‚Ø§Ø¯Ø© Ø§Ù„Ø²Ø®Ù…")
    .replace(/Trending ETFs/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø±Ø§Ø¦Ø¬Ø©")
    .replace(/Semiconductor Leaders/g, "Ù‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Retention Loop/g, "Ù…Ø³Ø§Ø± Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/Build a future watchlist workflow/g, "Ø¨Ù†Ø§Ø¡ ØªØ¬Ø±Ø¨Ø© Ù…ØªØ§Ø¨Ø¹Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ©")
    .replace(/Phase 2 keeps watchlists frontend-only\. Future phases can add saved views, alerts, portfolio AI Ø§Ù„Ø±Ø¤Ù‰, Ùˆ account-based Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø© persistence through backend services\./g, "ØªØ¨Ù‚Ù‰ Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø­Ø§Ù„ÙŠØ§ Ø¯Ø§Ø®Ù„ Ø§Ù„ÙˆØ§Ø¬Ù‡Ø© ÙÙ‚Ø·ØŒ ÙˆÙŠÙ…ÙƒÙ† Ù„Ø§Ø­Ù‚Ø§ Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ø¹Ø±ÙˆØ¶ Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø© ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ±Ø¤Ù‰ Ø§Ù„Ù…Ø­Ø§ÙØ¸ Ù…Ø¹ Ø·Ø¨Ù‚Ø© Ø®Ù„ÙÙŠØ© Ù…Ø­Ù…ÙŠØ©.")
    .replace(/AI-style explanations/g, "Ø´Ø±Ø­ Ø¨Ø­Ø«ÙŠ Ù…Ù†Ø¸Ù…")
    .replace(/educational watchlist Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©")
    .replace(/No buy or sell recommendations are provided\./g, "Ù„Ø§ ÙŠØªÙ… ØªÙ‚Ø¯ÙŠÙ… ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/Analyze Ø³Ù‡Ù…/g, "Ø­Ù„Ù„ Ø§Ù„Ø³Ù‡Ù…")
    .replace(/Score Model/g, "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¯Ø±Ø¬Ø©")
    .replace(/5 Factors/g, "5 Ø¹ÙˆØ§Ù…Ù„")
    .replace(/Stocks \+ ETFs/g, "Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/Educational/g, "ØªØ¹Ù„ÙŠÙ…ÙŠ")
    .replace(/Mock Ready/g, "Ø¬Ø§Ù‡Ø² Ù„Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©")
    .replace(/business model/gi, "Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„")
    .replace(/themes/g, "Ø§Ù„Ù…Ø­Ø§ÙˆØ±")
    .replace(/bull case/g, "Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ø¥ÙŠØ¬Ø§Ø¨ÙŠØ©")
    .replace(/valuation Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/related ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/is tracked as an Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ asset because it connects to/g, "ØªØªÙ… Ù…ØªØ§Ø¨Ø¹ØªÙ‡ ÙƒØ£ØµÙ„ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ø£Ù†Ù‡ ÙŠØ±ØªØ¨Ø· Ø¨Ù…Ø­Ø§ÙˆØ±")
    .replace(/Ø§Ù„Ù…Ø­Ø§ÙˆØ± within public equity markets/g, "Ø¶Ù…Ù† Ø£Ø³ÙˆØ§Ù‚ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø¹Ø§Ù…Ø©")
    .replace(/within public equity markets/g, "Ø¶Ù…Ù† Ø£Ø³ÙˆØ§Ù‚ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø¹Ø§Ù…Ø©")
    .replace(/product cycle execution/g, "ØªÙ†ÙÙŠØ° Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª")
    .replace(/pricing power/g, "Ù‚ÙˆØ© Ø§Ù„ØªØ³Ø¹ÙŠØ±")
    .replace(/operating margin discipline/g, "Ø§Ù†Ø¶Ø¨Ø§Ø· Ø§Ù„Ù‡ÙˆØ§Ù…Ø´ Ø§Ù„ØªØ´ØºÙŠÙ„ÙŠØ©")
    .replace(/free cash flow durability/g, "Ù…ØªØ§Ù†Ø© Ø§Ù„ØªØ¯ÙÙ‚ Ø§Ù„Ù†Ù‚Ø¯ÙŠ Ø§Ù„Ø­Ø±")
    .replace(/peer-relative multiples/g, "Ù…Ø¶Ø§Ø¹ÙØ§Øª Ù†Ø³Ø¨ÙŠØ©")
    .replace(/not as a buy or sell signal/g, "ÙˆÙ„ÙŠØ³ ÙƒØ¥Ø´Ø§Ø±Ø© Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹")
    .replace(/\bResearch Summary\b/g, "Ù…Ù„Ø®Øµ Ø§Ù„Ø¨Ø­Ø«")
    .replace(/Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø·Ù„Ø¨/g, "Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Cycle Ø§Ù„Ù…Ø®Ø§Ø·Ø±s/g, "Ù…Ø®Ø§Ø·Ø± Ø¯ÙˆØ±Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Interest Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Related ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ùˆ Ø§Ù„Ø£Ø³Ù‡Ù…/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ ÙˆØ£Ø³Ù‡Ù… Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/Related Ø§Ù„Ø£Ø³Ù‡Ù… Ùˆ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ ÙˆØ£Ø³Ù‡Ù… Ù…Ø±ØªØ¨Ø·Ø©")
    .replace(/generates value through its core/g, "ÙŠØ¨Ù†ÙŠ Ù‚ÙŠÙ…ØªÙ‡ Ø¹Ø¨Ø± Ù†Ø´Ø§Ø·Ù‡ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ ÙÙŠ")
    .replace(/business model, product cycle execution, customer Ø§Ù„Ø·Ù„Ø¨, pricing power, Ùˆ operating margin discipline\./g, "ÙˆÙ†Ù…ÙˆØ°Ø¬ Ø£Ø¹Ù…Ø§Ù„Ù‡ ÙˆØªÙ†ÙÙŠØ° Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª ÙˆØ·Ù„Ø¨ Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆÙ‚ÙˆØ© Ø§Ù„ØªØ³Ø¹ÙŠØ± ÙˆØ§Ù†Ø¶Ø¨Ø§Ø· Ø§Ù„Ù‡ÙˆØ§Ù…Ø´ Ø§Ù„ØªØ´ØºÙŠÙ„ÙŠØ©.")
    .replace(/Clear Ø§Ù„ØªØ¹Ø±Ø¶ profile for research comparison\./g, "Ù…Ù„Ù ØªØ¹Ø±Ø¶ ÙˆØ§Ø¶Ø­ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ø¨Ø­Ø«ÙŠØ©.")
    .replace(/Useful portfolio role when matched with appropriate Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ø³ÙŠØ§Ù‚\./g, "Ø¯ÙˆØ± Ù…ÙÙŠØ¯ ÙÙŠ Ø§Ù„Ù…Ø­ÙØ¸Ø© Ø¹Ù†Ø¯ Ø±Ø¨Ø·Ù‡ Ø¨Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ù†Ø§Ø³Ø¨.")
    .replace(/Transparent ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª structure Ùˆ holdings data\./g, "Ø¨Ù†ÙŠØ© ØµÙ†Ø¯ÙˆÙ‚ Ø´ÙØ§ÙØ© ÙˆØ¨ÙŠØ§Ù†Ø§Øª Ù…ÙƒÙˆÙ†Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©.")
    .replace(/TradeAlpha Score is an educational research label for comparison\. It is not a buy or sell recommendation\./g, "Ø¯Ø±Ø¬Ø© TradeAlpha Ù…Ø¤Ø´Ø± Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø©ØŒ ÙˆÙ„ÙŠØ³Øª ØªÙˆØµÙŠØ© Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/NØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øªlix/g, "Netflix")
    .replace(/TradeAlphaAI Focus Ø§Ù„Ù‚ÙˆØ§Ø¦Ù…/g, "Ù‚ÙˆØ§Ø¦Ù… ØªØ±ÙƒÙŠØ² TradeAlphaAI")
    .replace(/Top Ø§Ù„Ø£Ø³Ù‡Ù… Ùˆ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª to watch across major market Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "Ø£ÙØ¶Ù„ Ø§Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø¹Ø¨Ø± Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©")
    .replace(/Ø§Ø³ØªÙƒØ´Ù high-CTR research Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø©s for AI Ø§Ù„Ø£Ø³Ù‡Ù…, Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª leaders, growth Ø§Ù„Ø£Ø³Ù‡Ù…, dividend ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª, Ùˆ high-Ø§Ù„ØªØ°Ø¨Ø°Ø¨ candidates\. These lists are Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ rankings, not buy or sell recommendations\./g, "Ø§Ø³ØªÙƒØ´Ù Ù‚ÙˆØ§Ø¦Ù… Ø¨Ø­Ø«ÙŠØ© Ø¬Ø°Ø§Ø¨Ø© Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆÙ‚Ø§Ø¯Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØ£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆÙ…Ø±Ø´Ø­ÙŠ Ø§Ù„ØªÙ‚Ù„Ø¨ Ø§Ù„Ù…Ø±ØªÙØ¹. Ù‡Ø°Ù‡ Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… ØªØµÙ†ÙŠÙØ§Øª Ø¨Ø­Ø«ÙŠØ© ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ„ÙŠØ³Øª ØªÙˆØµÙŠØ§Øª Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    .replace(/data-research-Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "data-research-themes")
    .replace(/Ø§Ù„Ù…Ø®Ø§Ø·Ø± layer/g, "Ø·Ø¨Ù‚Ø© Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Valuation expectations may Ø¨Ø§Ù„ÙØ¹Ù„ price in strong execution\./g, "Ù‚Ø¯ ØªÙƒÙˆÙ† ØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„ØªÙ‚ÙŠÙŠÙ… Ù‚Ø¯ Ø§Ø³ØªÙˆØ¹Ø¨Øª Ø¨Ø§Ù„ÙØ¹Ù„ Ø¬Ø²Ø¡Ø§ ÙƒØ¨ÙŠØ±Ø§ Ù…Ù† Ø§Ù„ØªÙ†ÙÙŠØ° Ø§Ù„Ù‚ÙˆÙŠ.")
    .replace(/Cyclical Ø§Ù„Ø·Ù„Ø¨ or ØªØ±ÙƒØ² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ can pressure results\./g, "ÙŠÙ…ÙƒÙ† Ø£Ù† ØªØ¶ØºØ· Ø¯ÙˆØ±ÙŠØ© Ø§Ù„Ø·Ù„Ø¨ Ø£Ùˆ ØªØ±ÙƒØ² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø¹Ù„Ù‰ Ø§Ù„Ù†ØªØ§Ø¦Ø¬.")
    .replace(/Macro conditions can compress multiples for growth assets\./g, "Ù‚Ø¯ ØªØ¤Ø¯ÙŠ Ø§Ù„Ø¸Ø±ÙˆÙ Ø§Ù„ÙƒÙ„ÙŠØ© Ø¥Ù„Ù‰ Ø¶ØºØ· Ù…Ø¶Ø§Ø¹ÙØ§Øª Ø£ØµÙˆÙ„ Ø§Ù„Ù†Ù…Ùˆ.")
    .replace(/valuation Ø§Ù„Ù…Ø®Ø§Ø·Ø±/g, "Ù…Ø®Ø§Ø·Ø± Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/sector Ø§Ù„ØªØ°Ø¨Ø°Ø¨/g, "ØªØ°Ø¨Ø°Ø¨ Ø§Ù„Ù‚Ø·Ø§Ø¹")
    .replace(/macro Ø§Ù„Ø³ÙŠÙˆÙ„Ø©/g, "Ø§Ù„Ø³ÙŠÙˆÙ„Ø© Ø§Ù„ÙƒÙ„ÙŠØ©")
    .replace(/Clear Ø§Ù„ØªØ¹Ø±Ø¶ profile/g, "Ù…Ù„Ù ØªØ¹Ø±Ø¶ ÙˆØ§Ø¶Ø­")
    .replace(/research comparison/g, "Ø§Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ø¨Ø­Ø«ÙŠØ©")
    .replace(/Useful portfolio role/g, "Ø¯ÙˆØ± Ù…ÙÙŠØ¯ ÙÙŠ Ø§Ù„Ù…Ø­ÙØ¸Ø©")
    .replace(/appropriate Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…Ù†Ø§Ø³Ø¨")
    .replace(/Transparent/g, "Ø´ÙØ§ÙØ©")
    .replace(/Data center Ùˆ supply chain overview/g, "Ù†Ø¸Ø±Ø© Ø¹Ù„Ù‰ Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª ÙˆØ³Ù„Ø§Ø³Ù„ Ø§Ù„ØªÙˆØ±ÙŠØ¯")
    .replace(/Broad Market/g, "Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/trade-offs/g, "Ø§Ù„Ù…ÙØ§Ø¶Ù„Ø§Øª")
    .replace(/How monetary policy affects multiples/g, "ÙƒÙŠÙ ØªØ¤Ø«Ø± Ø§Ù„Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ù†Ù‚Ø¯ÙŠØ© ÙÙŠ Ù…Ø¶Ø§Ø¹ÙØ§Øª Ø§Ù„ØªÙ‚ÙŠÙŠÙ…")
    .replace(/Market sensitivity in growth Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ ÙÙŠ Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ")
    .replace(/Interest Rates Ùˆ Tech Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Rates Ùˆ Tech/g, "Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/AI Ø§Ù„Ø£Ø³Ù‡Ù… Research Hub/g, "Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø« Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Cloud Computing/g, "Ø§Ù„Ø­ÙˆØ³Ø¨Ø© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ©")
    .replace(/Equity Factors/g, "Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ø£Ø³Ù‡Ù…")
    .replace(/Growth vs value Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ Ù…Ù‚Ø§Ø¨Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ù‚ÙŠÙ…Ø©")
    .replace(/Research frameworks for valuation, earnings growth, factor cycles, Ùˆ rate sensitivity\./g, "Ø£Ø·Ø± Ø¨Ø­Ø«ÙŠØ© Ù„Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆÙ†Ù…Ùˆ Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ¯ÙˆØ±Ø§Øª Ø§Ù„Ø¹ÙˆØ§Ù…Ù„ ÙˆØ­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©.")
    // stocks.html remaining contamination
    .replace(/Free AI Ø³Ù‡Ù… ÙØ­Øµ Ø§Ù„Ø³ÙˆÙ‚/g, "ÙØ­Øµ Ø§Ù„Ø£Ø³Ù‡Ù… Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/\bHow It Works\b/g, "ÙƒÙŠÙ ÙŠØ¹Ù…Ù„")
    .replace(/Ø´ÙØ§ÙØ© educational scoring/g, "ØªÙ‚ÙŠÙŠÙ… ØªØ¹Ù„ÙŠÙ…ÙŠ Ø´ÙØ§Ù")
    .replace(/Ø´ÙØ§ÙØ© ØªØ¹Ù„ÙŠÙ…ÙŠ scoring/g, "ØªÙ‚ÙŠÙŠÙ… ØªØ¹Ù„ÙŠÙ…ÙŠ Ø´ÙØ§Ù")
    .replace(/Compare SPY, QQQ, VTI, VOO, Ùˆ GLD/g, "Ù‚Ø§Ø±Ù† Ø¨ÙŠÙ† SPY ÙˆQQQ ÙˆVTI ÙˆVOO ÙˆGLD")
    .replace(/>Open Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª</g, ">Ø§ÙØªØ­ Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª<")
    .replace(/Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ Ø´Ø§Ø¦Ø¹ Ù„Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ù…Ø­Ø§ÙˆØ±/g, "Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø¨Ø­Ø« Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø© Ù„Ù„Ø£Ø³Ù‡Ù…")
    .replace(/NVDA Analysis/g, "ØªØ­Ù„ÙŠÙ„ NVDA")
    .replace(/Dedicated NVDA Page/g, "ØµÙØ­Ø© NVDA Ø§Ù„ØªÙØµÙŠÙ„ÙŠØ©")
    .replace(/Dedicated SPY Page/g, "ØµÙØ­Ø© SPY Ø§Ù„ØªÙØµÙŠÙ„ÙŠØ©")
    .replace(/Compare QQQ Ø§Ù„ØªØ¹Ø±Ø¶/g, "Ù‚Ø§Ø±Ù† ØªØ¹Ø±Ø¶ QQQ")
    .replace(/\bData Status\b/g, "Ø­Ø§Ù„Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª")
    .replace(/TradeAlphaAI Ecosystem/g, "Ù…Ù†Ø¸ÙˆÙ…Ø© TradeAlphaAI")
    // etfs.html remaining contamination
    .replace(/AI Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª for holdings, allocation, Ø§Ù„ØªØ°Ø¨Ø°Ø¨, Ùˆ Ø§Ù„Ù…Ø®Ø§Ø·Ø±-aware ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª research/g, "Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù„Ù„Ø­ÙŠØ§Ø²Ø§Øª ÙˆØ§Ù„ØªÙˆØ²ÙŠØ¹ ÙˆØ§Ù„ØªØ°Ø¨Ø°Ø¨ ÙˆØ§Ù„Ø¨Ø­Ø« Ø§Ù„ÙˆØ§Ø¹ÙŠ Ø¨Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª questions/g, "Ø£Ø³Ø¦Ù„Ø© Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    // screener.html remaining contamination
    .replace(/\bMarket Themes\b/g, "Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø³ÙˆÙ‚")
    .replace(/High-engagement screening groups/g, "Ù…Ø¬Ù…ÙˆØ¹Ø§Øª Ø§Ù„ÙØ­Øµ Ø°Ø§Øª Ø§Ù„Ø§Ù‡ØªÙ…Ø§Ù… Ø§Ù„Ø¹Ø§Ù„ÙŠ")
    .replace(/Filterable Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚/g, "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØµÙÙŠØ©")
    .replace(/Ø§Ù„Ù…Ø®Ø§Ø·Ø± Factors/g, "Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± for Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ù„Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Build a future Ù‚Ø§Ø¦Ù…Ø© Ù…ØªØ§Ø¨Ø¹Ø© workflow/g, "Ø¨Ù†Ø§Ø¡ Ù…Ø³Ø§Ø± Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠ")
    .replace(/ØªØ¹Ù„ÙŠÙ…ÙŠ only/g, "ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø·")
    // rankings.html remaining contamination
    .replace(/Top Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„Ø£Ø³Ù‡Ù…/g, "Ø£ÙØ¶Ù„ Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Chip, equipment, memory,[^<]*Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø´Ø±ÙƒØ§Øª Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚ ÙˆØ§Ù„Ù…Ø¹Ø¯Ø§Øª ÙˆØ§Ù„Ø°Ø§ÙƒØ±Ø© ÙˆØ­ÙˆØ³Ø¨Ø© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø°Ø§Øª Ø£Ù‡Ù…ÙŠØ© Ø¨Ø­Ø«ÙŠØ© Ø¹Ø§Ù„ÙŠØ©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Growth-oriented Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§[^<]*Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø´Ø±ÙƒØ§Øª ØªÙ‚Ù†ÙŠØ© ÙˆÙ…Ù†ØµØ§Øª Ù…ÙˆØ¬Ù‡Ø© Ù„Ù„Ù†Ù…Ùˆ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Dividend-focused ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª[^<]*Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ ØªÙˆØ²ÙŠØ¹Ø§Øª Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ Ù„Ù„Ø¨Ø­Ø« Ø¹Ù† Ø§Ù„Ø¯Ø®Ù„ ÙˆØ§Ù„Ø¬ÙˆØ¯Ø© ÙˆØ§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø¯ÙØ§Ø¹ÙŠØ©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/Core ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª building blocks[^<]*Ù„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø£Ø³Ø§Ø³ÙŠØ© Ù„Ù„ØªØ¹Ø±Ø¶ Ø§Ù„ÙˆØ§Ø³Ø¹ Ù„Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© ÙˆØ³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø­ÙØ¸Ø©. ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³Øª Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ only,/g, "ØªØµÙ†ÙŠÙ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ„ÙŠØ³Øª")
    // etfs.html hero stats and paragraphs
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Data/g, "Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/<strong>Holdings<\/strong>/g, "<strong>Ø§Ù„Ø­ÙŠØ§Ø²Ø§Øª</strong>")
    .replace(/Ø§Ù„Ù…Ø®Ø§Ø·Ø± Lens/g, "Ù…Ù†Ø¸ÙˆØ± Ø§Ù„Ù…Ø®Ø§Ø·Ø±")
    .replace(/Ø§Ù„ØªÙƒÙ„ÙØ©s/g, "Ø§Ù„ØªÙƒØ§Ù„ÙŠÙ")
    .replace(/Ø§Ù„ØªÙƒÙ„ÙØ© s/g, "Ø§Ù„ØªÙƒØ§Ù„ÙŠÙ")
    .replace(/Ø§Ø¹Ø±Ø¶ing[^<]*/g, "Ø¬Ø§Ø±Ù ØªØ­Ù…ÙŠÙ„ Ø³ÙŠØ§Ù‚ Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØµÙ†Ø§Ø¯ÙŠÙ‚...")
    .replace(/placeholder="Search ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª, e\.g\. SPY or QQQ"/g, 'placeholder="Ø§Ø¨Ø­Ø« Ø¹Ù† Ø±Ù…Ø²ØŒ Ù…Ø«Ù„ SPY Ø£Ùˆ QQQ"')
    .replace(/aria-label="Search ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª symbol"/g, 'aria-label="Ø§Ù„Ø¨Ø­Ø« Ø¹Ù† Ø±Ù…Ø² ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª"')
    .replace(/Compare ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª with educational[^<]*/g, "Ù‚Ø§Ø±Ù† ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù…Ø¹ Ø³ÙŠØ§Ù‚ Ø¯Ø±Ø¬Ø© TradeAlpha Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆÙ†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ÙˆØ£ÙƒØ¨Ø± Ø§Ù„Ø­ÙŠØ§Ø²Ø§Øª ÙˆØ§Ù„ØªØ¹Ø±Ø¶ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆØ§Ù„Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„ÙÙ†ÙŠ ÙˆÙ†Ø¸Ø±Ø© Ø§Ù„Ù…Ø®Ø§Ø·Ø±.")
    .replace(/The Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª supports Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹,[^<]*/g, "ÙŠØ¯Ø¹Ù… Ù…Ø­Ù„Ù„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹ ÙˆØ§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª ÙˆØ§Ù„Ù‚Ø·Ø§Ø¹Ø§Øª ÙˆØ§Ù„Ø³Ù†Ø¯Ø§Øª ÙˆØ§Ù„Ø³Ù„Ø¹ Ù…Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª ØªÙˆØ²ÙŠØ¹ ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø«Ø§Ø¨ØªØ©.")
    // stocks.html paragraphs
    .replace(/ØªØ­Ù„ÙŠÙ„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª is now connected[^<]*/g, "ØªØ­Ù„ÙŠÙ„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ù…ØªØµÙ„ Ø§Ù„Ø¢Ù† Ø¨Ø¨Ù†ÙŠØ© Ø§Ù„ÙØ­Øµ Ø°Ø§ØªÙ‡Ø§ØŒ Ù…Ø¹ Ø³ÙŠØ§Ù‚ Ù†Ø³Ø¨Ø© Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ÙˆØ§Ù„Ø­ÙŠØ§Ø²Ø§Øª ÙˆØ§Ù„ØªØ¹Ø±Ø¶ Ø§Ù„Ù‚Ø·Ø§Ø¹ÙŠ ÙˆÙ†Ø¸Ø±Ø© Ø§Ù„ØªØ°Ø¨Ø°Ø¨ ÙˆÙ…Ù„Ø®ØµØ§Øª Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©.")
    .replace(/Why traders watch NVDA:[^<]*/g, "Ù„Ù…Ø§Ø°Ø§ ÙŠØ±Ø§Ù‚Ø¨ Ø§Ù„Ù…ØªØ¯Ø§ÙˆÙ„ÙˆÙ† NVDA: Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ¥Ù…Ø¯Ø§Ø¯Ø§Øª Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ÙˆØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ­Ø³Ø§Ø³ÙŠØ© Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØ§Ù„Ø²Ø®Ù… â€” Ø¬Ù…ÙŠØ¹Ù‡Ø§ ØªØ¤Ø«Ø± ÙÙŠ ÙƒÙŠÙÙŠØ© ÙØ­Øµ NVDA.")
    .replace(/Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ù„Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª include[^<]*/g, "Ø¹ÙˆØ§Ù…Ù„ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ù„Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª ØªØ´Ù…Ù„ Ù‚ÙŠÙˆØ¯ Ø§Ù„ØªØµØ¯ÙŠØ± ÙˆØªØ±ÙƒØ² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆØ¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆØ§Ù„ØªØºÙŠØ±Ø§Øª ÙÙŠ Ø§Ù„Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ø±Ø£Ø³Ù…Ø§Ù„ÙŠ ÙˆØªØ°Ø¨Ø°Ø¨ Ù‚Ø·Ø§Ø¹ Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§.")
    .replace(/Portfolio-level screening, alerts, Ùˆ saved Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ views planned for future releases\./g, "Ù…Ø³Ø§Ø­Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ù„ÙØ­Øµ Ø§Ù„Ù…Ø­Ø§ÙØ¸ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ·Ø±Ù‚ Ø¹Ø±Ø¶ Ø§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙÙˆØ¸Ø©.")
    // screener.html paragraphs
    .replace(/Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„Ø£Ø³Ù‡Ù… can be sensitive to[^<]*/g, "ÙŠÙ…ÙƒÙ† Ø£Ù† ØªÙƒÙˆÙ† Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø­Ø³Ø§Ø³Ø© Ù„Ù„Ø¥Ù†ÙØ§Ù‚ Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ¯ÙˆØ±Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ† ÙˆÙ‚ÙŠÙˆØ¯ Ø§Ù„ØªØµØ¯ÙŠØ± ÙˆØ¶ØºØ· Ø§Ù„ØªÙ‚ÙŠÙŠÙ… ÙˆØªÙˆÙ‚Ø¹Ø§Øª Ø§Ù„Ø£Ø±Ø¨Ø§Ø­ ÙˆØ²Ø®Ù… Ù‚Ø·Ø§Ø¹ Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§.")
    .replace(/Safe labels only\.[^<]*/g, "ØªØ³Ù…ÙŠØ§Øª Ø¢Ù…Ù†Ø© ÙÙ‚Ø·. Ù‡Ø°Ù‡ ÙˆØ§Ø¬Ù‡Ø© ÙØ­Øµ ØªØ¹Ù„ÙŠÙ…ÙŠØ© ÙˆÙ„ÙŠØ³Øª Ù…Ø­Ø±Ùƒ ØªÙˆØµÙŠØ§Øª.")
    // screener eyebrow
    .replace(/\bAI Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚/g, "Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚ Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    // screener filter UI labels
    .replace(/placeholder="Search symbol or name"/g, 'placeholder="Ø§Ø¨Ø­Ø« Ø¨Ø±Ù…Ø² Ø£Ùˆ Ø§Ø³Ù…"')
    .replace(/<option value="0">Any score<\/option>/g, '<option value="0">Ø£ÙŠ Ø¯Ø±Ø¬Ø©</option>')
    .replace(/<option value="50">50\+ score<\/option>/g, '<option value="50">50+ Ø¯Ø±Ø¬Ø©</option>')
    .replace(/<option value="60">60\+ score<\/option>/g, '<option value="60">60+ Ø¯Ø±Ø¬Ø©</option>')
    .replace(/<option value="70">70\+ score<\/option>/g, '<option value="70">70+ Ø¯Ø±Ø¬Ø©</option>')
    .replace(/<option value="score">Sort by score<\/option>/g, '<option value="score">ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨ Ø§Ù„Ø¯Ø±Ø¬Ø©</option>')
    .replace(/<option value="momentum">Sort by Ø§Ù„Ø²Ø®Ù…<\/option>/g, '<option value="momentum">ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨ Ø§Ù„Ø²Ø®Ù…</option>')
    .replace(/<option value="risk">Sort by Ø§Ù„Ù…Ø®Ø§Ø·Ø± score<\/option>/g, '<option value="risk">ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨ Ø¯Ø±Ø¬Ø© Ø§Ù„Ù…Ø®Ø§Ø·Ø±</option>')
    .replace(/<option value="symbol">Sort by symbol<\/option>/g, '<option value="symbol">ØªØ±ØªÙŠØ¨ Ø­Ø³Ø¨ Ø§Ù„Ø±Ù…Ø²</option>')
    .replace(/<span>Asset<\/span>/g, '<span>Ø§Ù„Ø£ØµÙ„</span>')
    .replace(/<span>Score<\/span>/g, '<span>Ø§Ù„Ø¯Ø±Ø¬Ø©</span>')
    // rankings.html company name fix (semiconductor was over-translated in proper names)
    .replace(/Taiwan Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Manufacturing/g, "Taiwan Semiconductor Manufacturing")
    // etfs.html FAQ eyebrow
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø£Ø³Ø¦Ù„Ø© Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©/g, "Ø£Ø³Ø¦Ù„Ø© Ø´Ø§Ø¦Ø¹Ø© Ø¹Ù† ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    // ETF detail page remaining contamination
    .replace(/Fund profile/g, "Ù…Ù„Ù Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/Top Holdings/g, "Ø£ÙƒØ¨Ø± Ø§Ù„Ø­ÙŠØ§Ø²Ø§Øª")
    .replace(/Portfolio components/g, "Ù…ÙƒÙˆÙ†Ø§Øª Ø§Ù„Ù…Ø­ÙØ¸Ø©")
    .replace(/Allocation screen/g, "Ø¹Ø±Ø¶ Ø§Ù„ØªÙˆØ²ÙŠØ¹")
    .replace(/<span>Category<\/span>/g, "<span>Ø§Ù„ÙØ¦Ø©</span>")
    .replace(/\bCore Equity\b/g, "Ø£Ø³Ù‡Ù… Ø£Ø³Ø§Ø³ÙŠØ©")
    .replace(/ÙÙ†ÙŠ Analysis/g, "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„ÙÙ†ÙŠ")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø£Ø³Ø§Ø³ÙŠs/g, "Ø£Ø³Ø§Ø³ÙŠØ§Øª Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Research Summary/g, "Ù…Ù„Ø®Øµ Ø¨Ø­Ø« Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Overview/g, "Ù†Ø¸Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚")
    .replace(/expense Ø§Ù„Ø³ÙŠØ§Ù‚/g, "Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ")
    .replace(/is tracked as an educational ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª research asset[^<.]*/g, "ÙŠÙØªØ§Ø¨ÙŽØ¹ ÙƒØ£ØµÙ„ Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù„Ù„ØªØ¹Ø±Ø¶ ÙˆØ§Ù„Ù…Ù‚Ø§Ø±Ù†Ø©.")
    .replace(/Spy Vs Qqq Explained/g, "Ù…Ù‚Ø§Ø±Ù†Ø© SPY ÙˆQQQ")
    .replace(/ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ Explained/g, "Ø´Ø±Ø­ Ù†Ø³Ø¨ Ù…ØµØ§Ø±ÙŠÙ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/Ø§Ù„Ù‚Ø·Ø§Ø¹ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Vs Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù‚Ø·Ø§Ø¹ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/Ø§Ù„ØªØ±ÙƒØ² can increase drawdown sensitivity\./g, "ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠØ²ÙŠØ¯ Ø§Ù„ØªØ±ÙƒØ² Ù…Ù† Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„ØªØ±Ø§Ø¬Ø¹.")
    .replace(/Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ Ùˆ trading spreads affect long-term ownership Ø§Ù„ØªÙƒÙ„ÙØ©\./g, "ØªØ¤Ø«Ø± Ù†Ø³Ø¨ Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ÙˆØ§Ù„ÙÙˆØ§Ø±Ù‚ Ø§Ù„ØªØ¯Ø§ÙˆÙ„ÙŠØ© ÙÙŠ ØªÙƒÙ„ÙØ© Ø§Ù„Ù…Ù„ÙƒÙŠØ© Ø·ÙˆÙŠÙ„Ø© Ø§Ù„Ø£Ø¬Ù„.")
    .replace(/The ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª can decline with its underlying market or sector\./g, "ÙŠÙ…ÙƒÙ† Ø£Ù† ÙŠØªØ±Ø§Ø¬Ø¹ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¹ Ø§Ù„Ø³ÙˆÙ‚ Ø£Ùˆ Ø§Ù„Ù‚Ø·Ø§Ø¹ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ.")
    .replace(/Ø¯Ø±Ø¬Ø© TradeAlpha is an Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ label for comparison\. It Ù„ÙŠØ³ a buy or sell recommendation\./g, "Ø¯Ø±Ø¬Ø© TradeAlpha Ù…Ø¤Ø´Ø± Ø¨Ø­Ø«ÙŠ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù„Ù„Ù…Ù‚Ø§Ø±Ù†Ø©ØŒ ÙˆÙ„ÙŠØ³Øª ØªÙˆØµÙŠØ© Ø´Ø±Ø§Ø¡ Ø£Ùˆ Ø¨ÙŠØ¹.")
    // stock/ETF insight link title-case fixes
    .replace(/Ai Infrastructure Demand/g, "Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Semiconductor Cycle Risks/g, "Ù…Ø®Ø§Ø·Ø± Ø¯ÙˆØ±Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Interest Rates And Tech Stocks/g, "Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§")
    .replace(/Semiconductor Market Research/g, "Ø£Ø¨Ø­Ø§Ø« Ø³ÙˆÙ‚ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª")
    .replace(/Ai Chip Supply Chain Constraints/g, "Ù‚ÙŠÙˆØ¯ Ø³Ù„Ø³Ù„Ø© ØªÙˆØ±ÙŠØ¯ Ø´Ø±Ø§Ø¦Ø­ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    .replace(/Etf Expense Ratios Explained/g, "Ø´Ø±Ø­ Ù†Ø³Ø¨ Ù…ØµØ§Ø±ÙŠÙ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª")
    .replace(/Sector Etfs Vs Broad Market/g, "ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù‚Ø·Ø§Ø¹ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹")
    .replace(/Ai Infrastructure Demand/g, "Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ")
    // insights/index.html remaining contamination
    .replace(/Ø¨Ø­Ø« ØªØ¹Ù„ÙŠÙ…ÙŠ Hub/g, "Ù…Ø±ÙƒØ² Ø§Ù„Ø£Ø¨Ø­Ø§Ø« Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠØ©")
    .replace(/\bTopic Clusters\b/g, "Ù…Ø¬Ù…ÙˆØ¹Ø§Øª Ø§Ù„Ù…Ø­Ø§ÙˆØ±")
    .replace(/\bEditor Picks\b/g, "Ø§Ø®ØªÙŠØ§Ø±Ø§Øª Ø§Ù„Ù…Ø­Ø±Ø±")
    .replace(/High-signal research paths/g, "Ù…Ø³Ø§Ø±Ø§Øª Ø§Ù„Ø¨Ø­Ø« Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø¥Ø´Ø§Ø±Ø©")
    .replace(/Ø§Ø³ØªÙƒØ´Ù research by theme/g, "Ø§Ø³ØªÙƒØ´Ù Ø§Ù„Ø£Ø¨Ø­Ø§Ø« Ø­Ø³Ø¨ Ø§Ù„Ù…Ø­ÙˆØ±")
    .replace(/Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø«s[^<]*/g, "Ù…Ø­Ø§ÙˆØ± Ø§Ù„Ø£Ø¨Ø­Ø§Ø« ÙˆØ§Ù„Ù…Ø­Ù„Ù„Ø§Øª")
    .replace(/Continue into Ø³Ù‡Ù…, ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª, Ùˆ theme research/g, "ØªØ§Ø¨Ø¹ Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª ÙˆØ§Ù„Ù…Ø­Ø§ÙˆØ±")
    // methodology.html headings and eyebrows
    .replace(/Data Transparency/g, "Ø´ÙØ§ÙÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª")
    .replace(/Data Ø§Ù„Ø´ÙØ§ÙÙŠØ©/g, "Ø´ÙØ§ÙÙŠØ© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª")
    .replace(/\bTransparency\b/g, "Ø§Ù„Ø´ÙØ§ÙÙŠØ©")
    .replace(/How Ø¯Ø±Ø¬Ø© TradeAlpha Works/g, "ÙƒÙŠÙ ØªØ¹Ù…Ù„ Ø¯Ø±Ø¬Ø© TradeAlpha")
    .replace(/AI Analysis Explanation/g, "Ø´Ø±Ø­ Ø§Ù„ØªØ­Ù„ÙŠÙ„")
    .replace(/Rule-based, not predictive claims/g, "Ù‚Ø§Ø¦Ù… Ø¹Ù„Ù‰ Ù‚ÙˆØ§Ø¹Ø¯ Ù…Ø­Ø¯Ø¯Ø© Ù„Ø§ Ø§Ø¯Ø¹Ø§Ø¡Ø§Øª ØªÙ†Ø¨Ø¤ÙŠØ©")
    .replace(/Terminology Helper/g, "Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ù…ØµØ·Ù„Ø­Ø§Øª")
    .replace(/Common market terms/g, "Ù…ØµØ·Ù„Ø­Ø§Øª Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø´Ø§Ø¦Ø¹Ø©")
    .replace(/ØªØ¹Ù„ÙŠÙ…ÙŠ, live, stale, fallback, Ùˆ unavailable states/g, "Ø­Ø§Ù„Ø§Øª Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆØ§Ù„Ù…Ø¨Ø§Ø´Ø± ÙˆØ§Ù„Ù…ØªÙ‚Ø§Ø¯Ù… ÙˆØ§Ù„Ø§Ø­ØªÙŠØ§Ø·ÙŠ ÙˆØºÙŠØ± Ø§Ù„Ù…ØªØ§Ø­")
    // methodology.html paragraphs
    .replace(/Ø¯Ø±Ø¬Ø© TradeAlpha is a transparent educational[^<]*Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©\./g, "Ø¯Ø±Ø¬Ø© TradeAlpha Ø¥Ø·Ø§Ø± ÙØ­Øµ ØªØ¹Ù„ÙŠÙ…ÙŠ Ø´ÙØ§Ù Ù„Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª. ÙŠØ¬Ù…Ø¹ Ø¨ÙŠÙ† Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„ÙÙ†ÙŠ ÙˆØ§Ù„Ø£Ø³Ø§Ø³ÙŠØ§Øª ÙˆØ§Ù„Ø²Ø®Ù… ÙˆØ§Ù„Ù…Ø¹Ù†ÙˆÙŠØ§Øª ÙˆØ³ÙŠØ§Ù‚ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø¯ÙˆÙ† ØªÙ‚Ø¯ÙŠÙ… Ù†ØµÙŠØ­Ø© Ù…Ø§Ù„ÙŠØ©.")
    .replace(/The current research explanation layer is deterministic[^<]*/g, "Ø·Ø¨Ù‚Ø© Ø§Ù„Ø´Ø±Ø­ Ø§Ù„Ø¨Ø­Ø«ÙŠ Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ù…Ø­Ø¯Ø¯Ø© Ø§Ù„Ù…Ù†Ø·Ù‚ ÙˆÙ‚Ø§Ø¦Ù…Ø© Ø¹Ù„Ù‰ Ù‚ÙˆØ§Ø¹Ø¯ Ø«Ø§Ø¨ØªØ©. ØªØ´Ø±Ø­ Ù„Ù…Ø§Ø°Ø§ ØªÙƒÙˆÙ† Ø§Ù„Ø¯Ø±Ø¬Ø© Ù…Ø±ØªÙØ¹Ø© Ø£Ùˆ Ù…Ù†Ø®ÙØ¶Ø© Ø§Ø³ØªÙ†Ø§Ø¯Ø§Ù‹ Ø¥Ù„Ù‰ Ù…Ø¯Ø®Ù„Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ù…Ø±Ø¦ÙŠØ©ØŒ ÙˆÙ„Ø§ ØªØ¶Ù…Ù† Ù†ØªØ§Ø¦Ø¬ ÙˆÙ„Ø§ ØªØªÙ†Ø¨Ø£ Ø¨Ø£Ø±Ø¨Ø§Ø­.")
    .replace(/RSI reviews Ø§Ù„Ø²Ø®Ù…, moving averages summarize trend Ø§Ù„Ø³ÙŠØ§Ù‚[^<]*/g, "RSI ÙŠØ±Ø§Ø¬Ø¹ Ø§Ù„Ø²Ø®Ù…ØŒ Ø§Ù„Ù…ØªÙˆØ³Ø·Ø§Øª Ø§Ù„Ù…ØªØ­Ø±ÙƒØ© ØªÙ„Ø®Øµ Ø³ÙŠØ§Ù‚ Ø§Ù„Ø§ØªØ¬Ø§Ù‡ØŒ Ù†Ø³Ø¨Ø© Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ ØªØµÙ ØªÙƒÙ„ÙØ© ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§ØªØŒ Ø§Ù„ØªØ°Ø¨Ø°Ø¨ ÙŠÙ‚Ø¯Ø± Ù†Ø·Ø§Ù‚ Ø§Ù„Ø­Ø±ÙƒØ©ØŒ ÙˆØ§Ù„Ù…Ø¹Ù†ÙˆÙŠØ§Øª ØªÙ„Ø®Øµ Ù†Ø¨Ø±Ø© Ø§Ù„Ø³ÙˆÙ‚.")
    .replace(/The portal identifies whether analysis is using educational[^<]*/g, "ØªÙØ´ÙŠØ± Ø§Ù„Ø¨ÙˆØ§Ø¨Ø© Ø¥Ù„Ù‰ Ù…Ø§ Ø¥Ø°Ø§ ÙƒØ§Ù† Ø§Ù„ØªØ­Ù„ÙŠÙ„ ÙŠØ³ØªØ®Ø¯Ù… Ø¨ÙŠØ§Ù†Ø§Øª ØªØ¹Ù„ÙŠÙ…ÙŠØ© Ø£Ùˆ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø¨Ø§Ø´Ø±Ø© Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ø£Ùˆ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø®Ø²Ù†Ø© Ù…ØªÙ‚Ø§Ø¯Ù…Ø© Ø£Ùˆ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ø­ØªÙŠØ§Ø·ÙŠØ© Ø£Ùˆ Ø¨ÙŠØ§Ù†Ø§Øª ØºÙŠØ± Ù…ØªØ§Ø­Ø©. Ù‡Ø°Ù‡ Ø§Ù„Ø´ÙØ§ÙÙŠØ© Ù„Ø§ ØªØºÙŠØ± Ø§Ù„Ø·Ø§Ø¨Ø¹ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙÙ‚Ø· Ù„Ù„ØªØ­Ù„ÙŠÙ„.")
    .replace(/does Ù„Ø§t/g, "Ù„Ø§")
    .replace(/\bÙ„Ø§t\b/g, "Ù„Ø§");
  _b.forEach((b, i) => { html = html.replace(`\x00B${i}\x00`, b); });
  return html;
}

function preserveEdgeSpace(original, translated) {
  const leading = original.match(/^\s*/)[0];
  const trailing = original.match(/\s*$/)[0];
  return `${leading}${escapeHtml(translated.trim())}${trailing}`;
}

function finalArabicCleanup(html) {
  return html
    .replace(/Research Rankings [^"<]*Watchlists/g, "&#1578;&#1589;&#1606;&#1610;&#1601;&#1575;&#1578; &#1608;&#1602;&#1608;&#1575;&#1574;&#1605; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1576;&#1581;&#1579;&#1610;&#1577;")
    .replace(/[^"]*rankings[^"]*research candidates\./g, "&#1578;&#1589;&#1606;&#1610;&#1601;&#1575;&#1578; &#1608;&#1602;&#1608;&#1575;&#1574;&#1605; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1576;&#1581;&#1579;&#1610;&#1577; &#1578;&#1593;&#1604;&#1610;&#1605;&#1610;&#1577; &#1604;&#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1608;&#1602;&#1575;&#1583;&#1577; &#1571;&#1588;&#1576;&#1575;&#1607; &#1575;&#1604;&#1605;&#1608;&#1589;&#1604;&#1575;&#1578; &#1608;&#1575;&#1604;&#1578;&#1603;&#1606;&#1608;&#1604;&#1608;&#1580;&#1610;&#1575; &#1575;&#1604;&#1603;&#1576;&#1585;&#1609;.")
    .replace(/Most followed AI-linked research candidates[^<]*\./g, "&#1571;&#1576;&#1585;&#1586; &#1605;&#1585;&#1588;&#1581;&#1610; &#1575;&#1604;&#1576;&#1581;&#1579; &#1575;&#1604;&#1605;&#1585;&#1578;&#1576;&#1591;&#1610;&#1606; &#1576;&#1575;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1590;&#1605;&#1606; &#1578;&#1594;&#1591;&#1610;&#1577; TradeAlphaAI.")
    .replace(/Most Followed [^<]*?&#1575;&#1604;&#1571;&#1587;&#1607;&#1605;/g, "&#1571;&#1603;&#1579;&#1585; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577;")
    .replace(/Most Followed [^<]*?Ø§Ù„Ø£Ø³Ù‡Ù…/g, "&#1571;&#1603;&#1579;&#1585; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577;")
    .replace(/Data center, accelerator[^<]*\./g, "&#1571;&#1587;&#1605;&#1575;&#1569; &#1605;&#1585;&#1575;&#1603;&#1586; &#1575;&#1604;&#1576;&#1610;&#1575;&#1606;&#1575;&#1578; &#1608;&#1575;&#1604;&#1605;&#1587;&#1585;&#1593;&#1575;&#1578; &#1608;&#1575;&#1604;&#1581;&#1608;&#1587;&#1576;&#1577; &#1575;&#1604;&#1587;&#1581;&#1575;&#1576;&#1610;&#1577; &#1608;&#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1575;&#1604;&#1578;&#1610; &#1610;&#1578;&#1575;&#1576;&#1593;&#1607;&#1575; &#1605;&#1603;&#1578;&#1576; &#1575;&#1604;&#1571;&#1576;&#1581;&#1575;&#1579;.")
    .replace(/Higher-beta research candidates[^<]*\./g, "&#1605;&#1585;&#1588;&#1581;&#1608;&#1606; &#1576;&#1581;&#1579;&#1610;&#1608;&#1606; &#1571;&#1593;&#1604;&#1609; &#1578;&#1602;&#1604;&#1576;&#1575; &#1581;&#1610;&#1579; &#1610;&#1607;&#1605; &#1587;&#1610;&#1575;&#1602; &#1575;&#1604;&#1605;&#1582;&#1575;&#1591;&#1585; &#1576;&#1602;&#1583;&#1585; &#1571;&#1607;&#1605;&#1610;&#1577; &#1585;&#1608;&#1575;&#1610;&#1575;&#1578; &#1575;&#1604;&#1606;&#1605;&#1608;.")
    .replace(/Watchlists currently remain[^<]*\./g, "&#1578;&#1576;&#1602;&#1609; &#1602;&#1608;&#1575;&#1574;&#1605; &#1575;&#1604;&#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1605;&#1578;&#1608;&#1575;&#1601;&#1602;&#1577; &#1605;&#1593; &#1575;&#1604;&#1578;&#1588;&#1594;&#1610;&#1604; &#1575;&#1604;&#1579;&#1575;&#1576;&#1578; &#1581;&#1575;&#1604;&#1610;&#1575;.")
    .replace(/The [^<]*?TradeAlpha combines[^<]*?Overextended\./g, "&#1578;&#1580;&#1605;&#1593; &#1583;&#1585;&#1580;&#1577; TradeAlpha &#1576;&#1610;&#1606; &#1575;&#1604;&#1583;&#1585;&#1580;&#1577; &#1575;&#1604;&#1601;&#1606;&#1610;&#1577; &#1608;&#1575;&#1604;&#1583;&#1585;&#1580;&#1577; &#1575;&#1604;&#1571;&#1587;&#1575;&#1587;&#1610;&#1577; &#1608;&#1575;&#1604;&#1586;&#1582;&#1605; &#1608;&#1575;&#1604;&#1605;&#1593;&#1606;&#1608;&#1610;&#1575;&#1578; &#1608;&#1578;&#1593;&#1583;&#1610;&#1604; &#1575;&#1604;&#1605;&#1582;&#1575;&#1591;&#1585;.")
    .replace(/Mega-Cap Tech|mega-cap tech/g, "&#1575;&#1604;&#1578;&#1603;&#1606;&#1608;&#1604;&#1608;&#1580;&#1610;&#1575; &#1575;&#1604;&#1603;&#1576;&#1585;&#1609;")
    .replace(/market leadership/g, "&#1602;&#1610;&#1575;&#1583;&#1577; &#1575;&#1604;&#1587;&#1608;&#1602;")
    .replace(/passive investing/g, "&#1575;&#1604;&#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585; &#1575;&#1604;&#1587;&#1604;&#1576;&#1610;");
}

function setMeta(html, type, key, value) {
  const escaped = escapeHtml(value || "");
  const pattern = new RegExp(`<meta ${type}="${escapeRegExp(key)}" content="[^"]*"\\s*\\/?>`, "i");
  const tag = `<meta ${type}="${key}" content="${escaped}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/title>\s*/i, `</title>\n  ${tag}\n  `);
}

function loadLandingTranslations() {
  const source = fs.readFileSync(path.join(root, "landing-i18n.js"), "utf8");
  const match = source.match(/const translations = ([\s\S]*?);\s*function getLanguage/);
  if (!match) return {};
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`translations = ${match[1]};`, sandbox);
  return sandbox.translations || {};
}

function loadArInsightContent(slug) {
  const file = path.join(root, "data", "localization", "ar-insight-content", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isNoindexDraft(source) {
  const file = path.join(root, source);
  return fs.existsSync(file) && /noindex,nofollow/i.test(fs.readFileSync(file, "utf8"));
}

function walkJson(value, visitor) {
  if (Array.isArray(value)) value.forEach((item) => walkJson(item, visitor));
  else if (value && typeof value === "object") {
    visitor(value);
    Object.values(value).forEach((item) => walkJson(item, visitor));
  }
}

function extractTitle(html) {
  return (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/&amp;/g, "&").trim() || "TradeAlphaAI";
}

function extractDescription(html) {
  return (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1]?.replace(/&amp;/g, "&").trim() || "";
}

function slugFromSource(source) {
  return path.basename(source, ".html");
}

function isAsset(value) {
  return /\.(?:css|js|png|jpe?g|webp|svg|ico|json|webmanifest|xml|txt)$/i.test(value);
}

function readJson(rel, fallback) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function norm(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

