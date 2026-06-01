#!/usr/bin/env node
// Phase 20 Task 2 — Add educational context sections to top comparison pages
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const COMPARE_INSIGHTS = {
  "nvda-vs-amd.html": {
    label: "Semiconductor & AI Chip Research Context",
    links: [
      { href: "/insights/semiconductor-cycle-risks.html", title: "Semiconductor Cycle Risks" },
      { href: "/insights/gpu-vs-cpu-ai-workloads.html", title: "GPU vs CPU for AI Workloads" },
      { href: "/insights/ai-infrastructure-demand.html", title: "AI Infrastructure Demand" }
    ]
  },
  "spy-vs-qqq.html": {
    label: "Index ETF Research Context",
    links: [
      { href: "/insights/spy-vs-qqq-etf-comparison-guide.html", title: "SPY vs QQQ Guide" },
      { href: "/insights/etf-risk-comparison-guide.html", title: "ETF Risk Comparison Guide" },
      { href: "/insights/sector-etfs-vs-broad-market.html", title: "Sector vs Broad Market ETFs" }
    ]
  },
  "schd-vs-vig.html": {
    label: "Dividend ETF Research Context",
    links: [
      { href: "/insights/dividend-etfs-explained.html", title: "Dividend ETFs Explained" },
      { href: "/insights/defensive-investing-explained.html", title: "Defensive Investing Explained" },
      { href: "/insights/etf-expense-ratios-explained.html", title: "ETF Expense Ratios" }
    ]
  },
  "spy-vs-voo.html": {
    label: "Broad Market ETF Research Context",
    links: [
      { href: "/insights/voo-vs-vti-long-term-etf-comparison.html", title: "VOO vs VTI Comparison" },
      { href: "/insights/etf-expense-ratios-explained.html", title: "ETF Expense Ratios" },
      { href: "/insights/etf-risk-comparison-guide.html", title: "ETF Risk Comparison Guide" }
    ]
  },
  "ko-vs-pep.html": {
    label: "Defensive Stocks Research Context",
    links: [
      { href: "/insights/defensive-investing-explained.html", title: "Defensive Investing Explained" },
      { href: "/insights/sector-rotation-explained.html", title: "Sector Rotation Explained" },
      { href: "/insights/portfolio-diversification-basics.html", title: "Portfolio Diversification Basics" }
    ]
  },
  "jnj-vs-mrk.html": {
    label: "Healthcare Sector Research Context",
    links: [
      { href: "/insights/defensive-investing-explained.html", title: "Defensive Investing Explained" },
      { href: "/insights/sector-rotation-explained.html", title: "Sector Rotation Explained" },
      { href: "/insights/growth-stocks-vs-value-stocks.html", title: "Growth vs Value Stocks" }
    ]
  },
  "crwd-vs-panw.html": {
    label: "Cybersecurity Research Context",
    links: [
      { href: "/insights/cybersecurity-stocks-to-watch.html", title: "Cybersecurity Stocks Overview" },
      { href: "/insights/cloud-computing-ai-market-structure.html", title: "Cloud Market Structure" },
      { href: "/insights/interest-rates-and-tech-stocks.html", title: "Interest Rates and Tech Stocks" }
    ]
  },
  "msft-vs-amzn.html": {
    label: "Cloud & Hyperscaler Research Context",
    links: [
      { href: "/insights/cloud-computing-ai-market-structure.html", title: "Cloud Market Structure" },
      { href: "/insights/hyperscaler-capex-cycles.html", title: "Hyperscaler Capex Cycles" },
      { href: "/insights/mega-cap-tech-index-concentration.html", title: "Mega-Cap Index Concentration" }
    ]
  },
  "bnd-vs-ief.html": {
    label: "Bond & Defensive ETF Research Context",
    links: [
      { href: "/insights/defensive-investing-explained.html", title: "Defensive Investing Explained" },
      { href: "/insights/etf-risk-comparison-guide.html", title: "ETF Risk Comparison Guide" },
      { href: "/insights/portfolio-diversification-basics.html", title: "Portfolio Diversification Basics" }
    ]
  },
  "smh-vs-soxx.html": {
    label: "Semiconductor ETF Research Context",
    links: [
      { href: "/insights/semiconductor-cycle-risks.html", title: "Semiconductor Cycle Risks" },
      { href: "/insights/etf-risk-comparison-guide.html", title: "ETF Risk Comparison Guide" },
      { href: "/insights/sector-etfs-vs-broad-market.html", title: "Sector vs Broad Market ETFs" }
    ]
  },
  "jepi-vs-schd.html": {
    label: "Income ETF Research Context",
    links: [
      { href: "/insights/dividend-etfs-explained.html", title: "Dividend ETFs Explained" },
      { href: "/insights/defensive-investing-explained.html", title: "Defensive Investing Explained" },
      { href: "/insights/etf-risk-comparison-guide.html", title: "ETF Risk Comparison Guide" }
    ]
  },
  "meta-vs-googl.html": {
    label: "Mega-Cap AI & Advertising Research Context",
    links: [
      { href: "/insights/ai-stocks-market-overview.html", title: "AI Stocks Market Overview" },
      { href: "/insights/mega-cap-tech-index-concentration.html", title: "Mega-Cap Index Concentration" },
      { href: "/insights/interest-rates-and-tech-stocks.html", title: "Interest Rates and Tech Stocks" }
    ]
  }
};

function buildSection(label, links) {
  const linkHtml = links.map(l =>
    `<a class="market-btn" href="${l.href}">${l.title}</a>`
  ).join("");
  return [
    `      <section class="market-section">`,
    `        <div class="market-panel">`,
    `          <span class="eyebrow">Educational Context</span>`,
    `          <h2>${label}</h2>`,
    `          <p class="market-copy">These articles provide educational context for this comparison. Not financial advice.</p>`,
    `          <div class="cta-actions">${linkHtml}</div>`,
    `        </div>`,
    `      </section>`
  ].join("\n");
}

let fixed = 0;
for (const [slug, cfg] of Object.entries(COMPARE_INSIGHTS)) {
  const file = path.join(root, "compare", slug);
  if (!fs.existsSync(file)) { console.log("MISSING:", slug); continue; }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("Educational Context")) { console.log("SKIP:", slug); continue; }
  const TARGET = '<div class="market-panel stock-faq">';
  const idx = html.indexOf(TARGET);
  if (idx === -1) { console.log("TARGET NOT FOUND:", slug); continue; }
  // Find the start of the containing section tag before TARGET
  const sectionStart = html.lastIndexOf("<section", idx);
  if (sectionStart === -1) { console.log("SECTION NOT FOUND:", slug); continue; }
  const insertion = buildSection(cfg.label, cfg.links) + "\n";
  html = html.substring(0, sectionStart) + insertion + html.substring(sectionStart);
  fs.writeFileSync(file, html, "utf8");
  console.log("FIXED:", slug);
  fixed++;
}
console.log("Total fixed:", fixed);
