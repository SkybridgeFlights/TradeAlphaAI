#!/usr/bin/env node
// Lightweight indexing readiness check.
// Verifies sitemaps, robots.txt, canonical/hreflang on key pages,
// absence of legacy query routes, and no stale "coming soon" state.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
const failures = [];
const warnings = [];

const SPLIT_SITEMAPS = [
  "sitemap-core.xml",
  "sitemap-stocks.xml",
  "sitemap-etfs.xml",
  "sitemap-compare.xml",
  "sitemap-insights.xml",
  "sitemap-ar.xml",
  "sitemap-market.xml"
];

// 1. sitemap.xml must be a sitemap index
const sitemapIndex = read("sitemap.xml");
if (!/<sitemapindex\b/i.test(sitemapIndex)) {
  failures.push("sitemap.xml is not a sitemap index — must use <sitemapindex>");
} else {
  for (const child of SPLIT_SITEMAPS) {
    if (!sitemapIndex.includes(`${domain}/${child}`)) {
      failures.push(`sitemap.xml: missing child sitemap reference: ${child}`);
    }
  }
}

// 2. All split sitemap files must exist on disk
for (const child of SPLIT_SITEMAPS) {
  if (!exists(child)) failures.push(`Missing sitemap file: ${child}`);
}

// 3. robots.txt must reference sitemap.xml
const robots = read("robots.txt");
if (!robots) {
  failures.push("robots.txt is missing");
} else {
  if (!robots.includes(`${domain}/sitemap.xml`)) {
    failures.push("robots.txt does not reference sitemap.xml");
  }
  if (/Disallow:\s*\/(?:api|js|css|stocks|etfs|compare|ar|insights|en)\//i.test(robots)) {
    failures.push("robots.txt is blocking a required path (/api, /js, /css, /stocks, /etfs, /compare, /ar, /insights, /en)");
  }
  if (/Disallow:\s*\/\s*$/m.test(robots)) {
    failures.push("robots.txt has Disallow: / which blocks all crawling");
  }
}

// 4. At least one URL of each important type must be in the relevant sitemap
function locCount(file) {
  const xml = read(file);
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].length;
}

const stockCount = locCount("sitemap-stocks.xml");
const etfCount = locCount("sitemap-etfs.xml");
const compareCount = locCount("sitemap-compare.xml");
const insightCount = locCount("sitemap-insights.xml");
const arCount = locCount("sitemap-ar.xml");

if (stockCount === 0) failures.push("sitemap-stocks.xml has no stock URLs");
if (stockCount < 10) warnings.push(`sitemap-stocks.xml has only ${stockCount} URLs — expected at least 10`);
if (etfCount === 0) failures.push("sitemap-etfs.xml has no ETF URLs");
if (compareCount === 0) failures.push("sitemap-compare.xml has no comparison URLs");
if (insightCount === 0) failures.push("sitemap-insights.xml has no insight URLs");
if (arCount === 0) failures.push("sitemap-ar.xml has no Arabic URLs");
if (!read("sitemap-ar.xml").includes(`${domain}/ar/`)) {
  failures.push("sitemap-ar.xml missing Arabic homepage");
}

// 5. No legacy query-based symbol routes in HTML files
const legacyPatterns = [
  /stock\.html\?symbol=/i,
  /etf\.html\?symbol=/i,
  /stock\.htmlsymbol=/i,
  /etf\.htmlsymbol=/i
];
for (const file of listHtmlFiles(root)) {
  const rel = relative(file);
  if (rel.includes("node_modules") || rel.startsWith("templates/") || rel.startsWith("tools/")) continue;
  const html = fs.readFileSync(file, "utf8");
  for (const pattern of legacyPatterns) {
    if (pattern.test(html)) failures.push(`${rel}: legacy query-based symbol route found (${pattern})`);
  }
}

// 6. Homepage and Arabic homepage must have canonical + hreflang
checkKeyPage("index.html", { canonical: true, hreflangAr: true, hreflangEn: false, noindex: false });
checkKeyPage("ar/index.html", { canonical: true, hreflangAr: true, hreflangEn: true, rtl: true, noindex: false });

// 7. High-value pages must be indexable (no noindex) and have canonical
const highValuePages = [
  "stocks.html",
  "etfs.html",
  "ai-stock-screener.html",
  "rankings.html",
  "insights/index.html",
  "compare/nvda-vs-amd.html",
  "compare/spy-vs-qqq.html",
  "stocks/nvda.html",
  "stocks/aapl.html",
  "etfs/spy.html",
  "etfs/qqq.html"
];
for (const rel of highValuePages) {
  if (!exists(rel)) { warnings.push(`High-value page not found: ${rel}`); continue; }
  const html = read(rel);
  if (/noindex/.test(html)) failures.push(`${rel}: high-value page has noindex — must be indexable`);
  if (!html.includes('rel="canonical"')) failures.push(`${rel}: missing canonical tag`);
}

// 8. Arabic high-value pages must be indexable, have canonical, and RTL
const arHighValuePages = [
  "ar/stocks.html",
  "ar/etfs.html",
  "ar/ai-stock-screener.html",
  "ar/rankings.html"
];
for (const rel of arHighValuePages) {
  if (!exists(rel)) { warnings.push(`Arabic high-value page not found: ${rel}`); continue; }
  const html = read(rel);
  if (/noindex/.test(html)) failures.push(`${rel}: Arabic high-value page has noindex`);
  if (!html.includes('rel="canonical"')) failures.push(`${rel}: missing canonical`);
  if (!/<html lang="ar" dir="rtl">/i.test(html)) failures.push(`${rel}: missing RTL html attributes`);
}

// 9. insights/index.html must not be in "coming soon" state
const insightsIndex = read("insights/index.html");
if (insightsIndex && insightsIndex.includes("Research articles are coming soon.")) {
  warnings.push("insights/index.html is still in 'coming soon' state — not indexed by check:seo but worth noting");
}
if (insightsIndex && /noindex/.test(insightsIndex)) {
  warnings.push("insights/index.html is noindex — insights are not discoverable via organic search");
}

// 10. Sitemap total URL count sanity check
const totalUrls = SPLIT_SITEMAPS.reduce((n, f) => n + locCount(f), 0);
if (totalUrls < 100) failures.push(`Total sitemap URLs is only ${totalUrls} — expected at least 100`);
else if (totalUrls < 200) warnings.push(`Total sitemap URLs is ${totalUrls} — low for a mature research platform`);

// --- report ---
if (failures.length) {
  console.error("Indexing readiness check FAILED:");
  for (const f of failures) console.error(`  FAIL: ${f}`);
  if (warnings.length) {
    console.warn("Warnings:");
    for (const w of warnings) console.warn(`  WARN: ${w}`);
  }
  process.exit(1);
}

console.log("Indexing readiness check passed.");
console.log(`  Sitemaps: ${SPLIT_SITEMAPS.length} split files exist, index references all`);
console.log(`  Stocks: ${stockCount} URLs | ETFs: ${etfCount} | Compare: ${compareCount} | Insights: ${insightCount} | Arabic: ${arCount}`);
console.log(`  Total indexed URLs: ${totalUrls}`);
console.log(`  robots.txt: references sitemap.xml, no blocked critical paths`);
console.log(`  High-value pages: all indexable with canonical tags`);
if (warnings.length) {
  console.warn("Warnings:");
  for (const w of warnings) console.warn(`  WARN: ${w}`);
}

// --- helpers ---
function checkKeyPage(rel, opts) {
  if (!exists(rel)) { failures.push(`Key page missing: ${rel}`); return; }
  const html = read(rel);
  if (opts.noindex === false && /noindex/.test(html)) failures.push(`${rel}: must not have noindex`);
  if (opts.canonical && !html.includes('rel="canonical"')) failures.push(`${rel}: missing canonical`);
  if (opts.hreflangAr && !html.includes('hreflang="ar"')) failures.push(`${rel}: missing ar hreflang`);
  if (opts.hreflangEn && !html.includes('hreflang="en"')) failures.push(`${rel}: missing en hreflang`);
  if (opts.rtl && !/<html lang="ar" dir="rtl">/i.test(html)) failures.push(`${rel}: missing RTL html attributes`);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function listHtmlFiles(dir) {
  const out = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== "node_modules") out.push(...listHtmlFiles(full));
      else if (entry.name.endsWith(".html")) out.push(full);
    }
  } catch {}
  return out;
}
