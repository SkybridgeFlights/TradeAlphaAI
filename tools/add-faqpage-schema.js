#!/usr/bin/env node
// Phase 20 Task 4 — Add FAQPage schema to top comparison pages that have FAQ details but no FAQPage schema
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

// These comparison pages already have FAQ details blocks but lack FAQPage schema
// Questions/answers are extracted from the existing details elements
const FAQ_SCHEMA_MAP = {
  "nvda-vs-amd.html": [
    { q: "Is the NVDA vs AMD comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "How should I use this NVDA vs AMD comparison?", a: "Use it to review differences in themes, risks, and research context before opening the asset pages and methodology." },
    { q: "What makes NVDA different from AMD in AI chip research?", a: "NVDA has stronger exposure to AI training infrastructure through its GPU compute platform, while AMD competes in both gaming and AI accelerator markets. Both are tracked in the semiconductor sector. This is educational context only." }
  ],
  "spy-vs-qqq.html": [
    { q: "Is the SPY vs QQQ comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "What is the main difference between SPY and QQQ?", a: "SPY tracks the S&P 500 (500 largest US companies across all sectors). QQQ tracks the Nasdaq-100 (100 largest non-financial Nasdaq-listed companies, heavily weighted toward technology). QQQ has higher technology concentration and higher beta than SPY." },
    { q: "Which has higher volatility, SPY or QQQ?", a: "QQQ typically exhibits higher volatility than SPY because of its greater concentration in high-growth technology stocks, which have higher beta and are more sensitive to interest rate changes. This is educational context only — not financial advice." }
  ],
  "schd-vs-vig.html": [
    { q: "Is the SCHD vs VIG comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "What is the difference between SCHD and VIG?", a: "SCHD (Schwab US Dividend Equity ETF) screens for dividend consistency, cash flow quality, and payout ratio. VIG (Vanguard Dividend Appreciation ETF) selects companies with 10+ years of consecutive dividend growth. SCHD typically offers higher yields; VIG tends toward higher-quality growth companies." },
    { q: "Are SCHD and VIG considered defensive ETFs?", a: "Both SCHD and VIG have lower-than-market beta and tend to hold up relatively better during market downturns compared to growth-heavy ETFs. They are often studied in the context of defensive and income investing research. Educational context only." }
  ],
  "spy-vs-voo.html": [
    { q: "Is the SPY vs VOO comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "What is the difference between SPY and VOO?", a: "Both SPY (SPDR S&P 500 ETF) and VOO (Vanguard S&P 500 ETF) track the same S&P 500 index. The main differences are expense ratio (VOO is typically cheaper at 0.03% vs SPY at 0.095%) and issuer structure (BlackRock/State Street vs Vanguard). Educational context only." },
    { q: "Which S&P 500 ETF has lower fees, SPY or VOO?", a: "VOO (Vanguard S&P 500 ETF) typically has a lower expense ratio than SPY. However, SPY has higher liquidity and tighter bid-ask spreads, which may matter for active traders. Educational context only — not financial advice." }
  ],
  "ko-vs-pep.html": [
    { q: "Is the KO vs PEP comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "What is the research difference between KO and PEP?", a: "KO (Coca-Cola) is a beverage-pure-play with high global brand exposure and stable dividend history. PEP (PepsiCo) has a more diversified business including snacks (Frito-Lay), which affects revenue mix and risk profile. Both are researched as defensive Consumer Staples stocks." },
    { q: "Are KO and PEP considered defensive stocks?", a: "KO and PEP are both classified in the Consumer Staples sector, which historically demonstrates lower volatility and better relative performance during economic contractions. This is educational research context only — not financial advice." }
  ],
  "smh-vs-soxx.html": [
    { q: "Is the SMH vs SOXX comparison financial advice?", a: "No. This page is educational and informational only and does not provide financial or investment advice." },
    { q: "What is the difference between SMH and SOXX?", a: "SMH (VanEck Semiconductor ETF) and SOXX (iShares Semiconductor ETF) both track semiconductor sector companies, but with different index methodologies, weighting approaches, and holdings concentration. SMH typically has higher concentration in top holdings. Educational context only." },
    { q: "Why do semiconductor ETFs like SMH and SOXX have high beta?", a: "Semiconductor companies are cyclical — demand swings with data center buildout, consumer electronics, and AI capex. This creates above-market volatility (high beta). SMH and SOXX both typically carry beta above 1.2 relative to the S&P 500. Educational context only." }
  ]
};

function buildFaqSchema(faqs) {
  const entities = faqs.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  }));
  return { "@type": "FAQPage", "mainEntity": entities };
}

let fixed = 0;
for (const [slug, faqs] of Object.entries(FAQ_SCHEMA_MAP)) {
  const file = path.join(root, "compare", slug);
  if (!fs.existsSync(file)) { console.log("MISSING:", slug); continue; }
  let html = fs.readFileSync(file, "utf8");

  if (html.includes('"FAQPage"')) { console.log("SKIP (already has FAQPage):", slug); continue; }

  // Find the existing JSON-LD script and add FAQPage to the @graph array
  const GRAPH_CLOSE = "  ]\n}";
  const idx = html.lastIndexOf(GRAPH_CLOSE);
  if (idx === -1) { console.log("GRAPH CLOSE NOT FOUND:", slug); continue; }

  const faqSchema = buildFaqSchema(faqs);
  const faqJson = JSON.stringify(faqSchema, null, 6).replace(/^/gm, "    ").trimStart();

  html = html.substring(0, idx) + ",\n    " + faqJson + "\n  ]\n}" + html.substring(idx + GRAPH_CLOSE.length);
  fs.writeFileSync(file, html, "utf8");
  console.log("FIXED:", slug);
  fixed++;
}
console.log("Total fixed:", fixed);
