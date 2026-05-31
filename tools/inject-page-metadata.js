#!/usr/bin/env node
// Phase 18 — Injects improved seoTitle and seoDescription into existing
// stock and ETF HTML pages without regenerating full page content.
// Reads from data/research-assets/{stocks,etfs}/*.json → updates HTML in-place.
// Run: node tools/inject-page-metadata.js

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
let updated = 0;
let skipped = 0;

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function injectMeta(html, title, description) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);

  // <title>
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${safeTitle}</title>`);
  // <meta name="description">
  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/>/i,
    `<meta name="description" content="${safeDesc}" />`);
  // og:title
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/,
    `$1${safeTitle}$2`);
  // og:description
  html = html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,
    `$1${safeDesc}$2`);
  // twitter:title
  html = html.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,
    `$1${safeTitle}$2`);
  // twitter:description
  html = html.replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,
    `$1${safeDesc}$2`);
  // JSON-LD name/description if present — update "headline" and "description"
  html = html.replace(/("headline"\s*:\s*)"[^"]*"/g, `$1${JSON.stringify(title)}`);

  return html;
}

function processDir(assetDir, htmlDir) {
  const files = fs.readdirSync(assetDir).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const asset = JSON.parse(fs.readFileSync(path.join(assetDir, file), "utf8"));
    const { symbol, seo } = asset;
    if (!symbol || !seo?.title || !seo?.description) { skipped++; continue; }

    const htmlFile = path.join(root, htmlDir, `${symbol.toLowerCase()}.html`);
    if (!fs.existsSync(htmlFile)) { skipped++; continue; }

    const original = fs.readFileSync(htmlFile, "utf8");
    const updated_ = injectMeta(original, seo.title, seo.description);

    if (updated_ !== original) {
      fs.writeFileSync(htmlFile, updated_, "utf8");
      console.log(`  Updated ${symbol}: ${seo.title}`);
      updated++;
    } else {
      skipped++;
    }
  }
}

processDir(
  path.join(root, "data", "research-assets", "stocks"),
  "stocks"
);
processDir(
  path.join(root, "data", "research-assets", "etfs"),
  "etfs"
);

console.log(`\nMetadata injection complete.`);
console.log(`  Updated: ${updated}`);
console.log(`  Skipped/unchanged: ${skipped}`);
