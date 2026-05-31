#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const config = readJson("data/market-symbols.json", { hubs: [] });
let changed = 0;
let scanned = 0;

const targets = [
  ...htmlFiles("stocks").map((rel) => ({ rel, placement: "stock", script: "../js/market/market-authority-layer.js" })),
  ...htmlFiles("etfs").map((rel) => ({ rel, placement: "etf", script: "../js/market/market-authority-layer.js" })),
  ...htmlFiles("ar/stocks").map((rel) => ({ rel, placement: "stock", script: "/js/market/market-authority-layer.js" })),
  ...htmlFiles("ar/etfs").map((rel) => ({ rel, placement: "etf", script: "/js/market/market-authority-layer.js" })),
  ...htmlFiles("compare").map((rel) => ({ rel, placement: "compare", script: "/js/market/market-authority-layer.js" })),
  ...htmlFiles("ar/compare").map((rel) => ({ rel, placement: "compare", script: "/js/market/market-authority-layer.js" })),
  ...((config.hubs || []).map((hub) => ({ rel: hub.pagePath, placement: "hub", script: "js/market/market-authority-layer.js" }))),
  ...((config.hubs || []).map((hub) => ({ rel: `ar/${hub.pagePath}`, placement: "hub", script: "/js/market/market-authority-layer.js" }))),
  { rel: "rankings.html", placement: "rankings", script: "/js/market/market-authority-layer.js" },
  { rel: "ar/rankings.html", placement: "rankings", script: "/js/market/market-authority-layer.js" }
];

for (const target of targets) {
  const full = path.join(root, target.rel);
  if (!fs.existsSync(full)) continue;
  scanned += 1;
  const original = fs.readFileSync(full, "utf8");
  let html = original;
  html = injectAuthoritySection(html, target.placement);
  html = injectScript(html, target.script);
  html = broadenNavCopy(html);
  if (html !== original) {
    fs.writeFileSync(full, html, "utf8");
    changed += 1;
  }
}

console.log(`Market authority layer patch complete. Scanned ${scanned} page(s), changed ${changed}.`);

function injectAuthoritySection(html, placement) {
  if (html.includes("data-market-authority")) return html;
  const section = `\n      <section class="market-section"><div class="market-panel" data-market-authority="${placement}"></div></section>`;
  const status = '<section class="market-section"><div data-data-status></div></section>';
  if (html.includes(status)) return html.replace(status, `${status}${section}`);
  const wrapStart = '<div class="wrap">';
  if (html.includes(wrapStart)) return html.replace(wrapStart, `${wrapStart}${section}`);
  return html.replace("</main>", `${section}\n  </main>`);
}

function injectScript(html, src) {
  if (html.includes("market-authority-layer.js")) return html;
  const tag = `  <script src="${src}"></script>\n`;
  if (html.includes("related-content.js")) {
    return html.replace(/^(\s*<script src="[^"]*related-content\.js"><\/script>)/m, `${tag}$1`);
  }
  return html.replace("</body>", `${tag}</body>`);
}

function broadenNavCopy(html) {
  return html
    .replace(/AI Stock Analyzer/g, "Global Stock Research")
    .replace(/Generated Hub/g, "Research Hub")
    .replace(/Market Insights/g, "Articles");
}

function htmlFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute)
    .filter((name) => name.endsWith(".html"))
    .map((name) => path.join(dir, name).replaceAll("\\", "/"));
}

function readJson(rel, fallback) {
  const full = path.join(root, rel);
  return fs.existsSync(full) ? JSON.parse(fs.readFileSync(full, "utf8")) : fallback;
}
