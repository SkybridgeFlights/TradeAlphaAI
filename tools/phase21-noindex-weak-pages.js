#!/usr/bin/env node
// Phase 21 Task 3 — Noindex weak/duplicate insight pages, remove from sitemap and index grid
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const WEAK_PAGES = [
  "etf-education-etf-structure-and-index-methodology.html",
  "etf-education-expense-ratios-and-tracking-differences.html",
  "interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html",
  "mega-cap-tech-research-mega-cap-concentration-in-passive-indexes.html",
  "semiconductor-market-research-ai-chip-supply-chain-constraints.html"
];

// Step 1 — Noindex each page
let noindexed = 0;
for (const slug of WEAK_PAGES) {
  const file = path.join(root, "insights", slug);
  if (!fs.existsSync(file)) { console.log("MISSING:", slug); continue; }
  let html = fs.readFileSync(file, "utf8");
  if (html.includes('content="noindex,nofollow"')) {
    console.log("SKIP (already noindex):", slug);
    continue;
  }
  html = html.replace(
    /(<meta name="robots" content=")[^"]*(")/,
    '$1noindex,nofollow$2'
  );
  fs.writeFileSync(file, html, "utf8");
  console.log("NOINDEXED:", slug);
  noindexed++;
}

// Step 2 — Remove from sitemap-insights.xml
const sitemapFile = path.join(root, "sitemap-insights.xml");
let sitemap = fs.readFileSync(sitemapFile, "utf8");
let sitemapFixed = 0;
for (const slug of WEAK_PAGES) {
  const urlFrag = `/insights/${slug}`;
  // Match the full <url>...</url> block containing this slug
  const re = new RegExp(
    `\\s*<url>\\s*<loc>[^<]*${slug.replace(/\./g, "\\.")}[^<]*<\\/loc>\\s*<changefreq>[^<]*<\\/changefreq>\\s*<priority>[^<]*<\\/priority>\\s*<\\/url>`,
    "g"
  );
  const before = sitemap.length;
  sitemap = sitemap.replace(re, "");
  if (sitemap.length < before) {
    console.log("SITEMAP REMOVED:", slug);
    sitemapFixed++;
  } else {
    console.log("SITEMAP NOT FOUND:", slug);
  }
}
fs.writeFileSync(sitemapFile, sitemap, "utf8");

// Step 3 — Remove cards from insights/index.html
const indexFile = path.join(root, "insights", "index.html");
let indexHtml = fs.readFileSync(indexFile, "utf8");
let indexFixed = 0;
for (const slug of WEAK_PAGES) {
  // Each card is a self-contained <article>...</article> on one line (compact HTML)
  // Match the article element containing the slug href
  const re = new RegExp(
    `\\r?\\n<article class="market-card"[^>]*>[^<]*(?:<[^>]*>[^<]*)*<a class="market-card-link"[^>]*href="/insights/${slug.replace(/\./g, "\\.")}[^"]*"[^>]*>[^<]*<\\/a><\\/article>`,
    "g"
  );
  const before = indexHtml.length;
  indexHtml = indexHtml.replace(re, "");
  if (indexHtml.length < before) {
    console.log("INDEX CARD REMOVED:", slug);
    indexFixed++;
  } else {
    console.log("INDEX CARD NOT MATCHED (trying fallback):", slug);
    // Fallback: match any line containing the slug
    const lines = indexHtml.split(/\r?\n/);
    const filtered = lines.filter(l => !l.includes(`/insights/${slug}`));
    if (filtered.length < lines.length) {
      indexHtml = filtered.join("\n");
      console.log("INDEX CARD REMOVED (fallback):", slug);
      indexFixed++;
    } else {
      console.log("INDEX CARD NOT FOUND:", slug);
    }
  }
}
fs.writeFileSync(indexFile, indexHtml, "utf8");

console.log("\n=== Summary ===");
console.log("Noindexed:", noindexed);
console.log("Sitemap entries removed:", sitemapFixed);
console.log("Index cards removed:", indexFixed);
