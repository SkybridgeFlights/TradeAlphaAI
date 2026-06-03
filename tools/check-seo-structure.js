#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
const failures = [];
const warnings = [];

const sitemapFiles = [
  "sitemap-core.xml",
  "sitemap-stocks.xml",
  "sitemap-etfs.xml",
  "sitemap-compare.xml",
  "sitemap-insights.xml",
  "sitemap-ar.xml",
  "sitemap-market.xml"
];

const sitemapUrls = new Map();
for (const file of sitemapFiles) {
  const urls = locs(file);
  sitemapUrls.set(file, urls);
  const dupes = duplicates(urls);
  for (const url of dupes) failures.push(`${file}: duplicate URL ${url}`);
}

const allUrls = unique([...sitemapUrls.values()].flat());
const comparePages = htmlFiles("compare");
const arComparePages = htmlFiles(path.join("ar", "compare"));
const stockPages = htmlFiles("stocks");
const etfPages = htmlFiles("etfs");
const hubPages = readJson("data/market-symbols.json", { hubs: [] }).hubs.map((hub) => hub.pagePath).filter(exists);
const marketOutlookPages = htmlFiles("market-outlook");
const arMarketOutlookPages = htmlFiles(path.join("ar", "market-outlook"));
const insightPages = ["insights/"].concat(htmlFiles("insights").filter((rel) => !rel.endsWith("/index.html")), marketOutlookPages);

requireSitemapCoverage("sitemap-core.xml", [""]);
requireSitemapCoverage("sitemap-compare.xml", comparePages);
requireSitemapCoverage("sitemap-ar.xml", arComparePages);
requireSitemapCoverage("sitemap-stocks.xml", stockPages);
requireSitemapCoverage("sitemap-etfs.xml", etfPages);
requireSitemapCoverage("sitemap-core.xml", hubPages.filter((rel) => !rel.startsWith("ar/")));
requireSitemapCoverage("sitemap-insights.xml", insightPages);
requireSitemapCoverage("sitemap-ar.xml", arMarketOutlookPages);

for (const rel of unique([...comparePages, ...arComparePages, ...hubPages, ...stockPages, ...etfPages, ...insightPages, ...arMarketOutlookPages])) {
  if (!rel.endsWith(".html") && !rel.endsWith("/")) continue;
  const fileRel = rel.endsWith("/") ? `${rel}index.html` : rel;
  if (!exists(fileRel)) continue;
  checkPage(fileRel);
}

for (const rel of comparePages) checkComparePage(rel, false);
for (const rel of arComparePages) checkComparePage(rel, true);
checkRobots();
checkSitemapIndex();
checkDeadInternalLinks();
checkAuthorityLayer();
checkInternalAuthorityMesh();

if (failures.length) {
  console.error("SEO structure check failed:");
  for (const failure of failures.slice(0, 120)) console.error(`- ${failure}`);
  if (failures.length > 120) console.error(`... ${failures.length - 120} more failure(s) omitted`);
  if (warnings.length) {
    console.error("Warnings:");
    for (const warning of warnings.slice(0, 40)) console.error(`- ${warning}`);
  }
  process.exit(1);
}

console.log("SEO structure check passed.");
console.log(`Checked ${allUrls.length} sitemap URL entries, ${comparePages.length} EN comparisons, ${arComparePages.length} AR comparisons, ${stockPages.length} stock pages, and ${etfPages.length} ETF pages.`);
if (warnings.length) {
  console.log("Warnings:");
  for (const warning of warnings.slice(0, 40)) console.log(`- ${warning}`);
}

function requireSitemapCoverage(sitemap, rels, options = {}) {
  const urls = new Set(sitemapUrls.get(sitemap) || []);
  for (const rel of rels) {
    const url = relToUrl(rel);
    if (!urls.has(url)) {
      const msg = `${sitemap}: missing ${url}`;
      if (options.allowMissing) warnings.push(msg);
      else failures.push(msg);
    }
  }
}

function checkPage(rel) {
  const html = read(rel);
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1];
  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  const description = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1];
  if (!canonical) failures.push(`${rel}: missing canonical`);
  else if (!canonical.startsWith(domain)) failures.push(`${rel}: canonical is off-domain: ${canonical}`);
  if (!title) failures.push(`${rel}: missing title`);
  if (!description) failures.push(`${rel}: missing meta description`);
  if (rel.startsWith("ar/") || rel.startsWith("compare/")) {
    if (!html.includes('hreflang="ar"')) failures.push(`${rel}: missing ar hreflang`);
    if (!html.includes('hreflang="en"')) failures.push(`${rel}: missing en hreflang`);
  }
  if (rel.startsWith("ar/") && !/<html lang="ar" dir="rtl">/i.test(html)) failures.push(`${rel}: missing Arabic RTL html attributes`);
  if (/<script type="application\/ld\+json">[\s\S]*?&quot;[\s\S]*?<\/script>/i.test(html)) failures.push(`${rel}: JSON-LD appears HTML-escaped`);
}

function checkComparePage(rel, isAr) {
  const html = read(rel);
  const base = rel.replace(/^ar\//, "");
  const counterpart = isAr ? base : `ar/${rel}`;
  if (!exists(counterpart)) failures.push(`${rel}: missing counterpart ${counterpart}`);
  if (!html.includes('class="comparison-table"')) failures.push(`${rel}: missing comparison table`);
  if (!html.includes("/api/market-data")) failures.push(`${rel}: missing live market-data hook`);
  if (!html.includes("rankings.html")) failures.push(`${rel}: missing rankings link`);
  if (!/\/(?:ar\/)?stocks\/|\/(?:ar\/)?etfs\//.test(html)) failures.push(`${rel}: missing asset-page links`);
  if (!html.includes("/compare/") && !html.includes("/ar/compare/")) failures.push(`${rel}: missing related comparison links`);
}

function checkRobots() {
  const robots = read("robots.txt");
  for (const sitemap of ["sitemap.xml", ...sitemapFiles]) {
    if (!robots.includes(`${domain}/${sitemap}`)) failures.push(`robots.txt missing ${sitemap}`);
  }
}

function checkSitemapIndex() {
  const index = read("sitemap.xml");
  if (!/<sitemapindex\b/i.test(index)) failures.push("sitemap.xml is not a sitemap index");
  for (const sitemap of sitemapFiles) {
    if (!index.includes(`${domain}/${sitemap}`)) failures.push(`sitemap.xml missing child sitemap ${sitemap}`);
  }
}

function checkDeadInternalLinks() {
  for (const rel of htmlFilesRecursive(["compare", "ar/compare"])) {
    const html = read(rel);
    for (const href of extractLinks(html)) {
      if (!isInternalHtmlLink(href)) continue;
      const target = resolveHref(rel, href);
      if (!exists(target)) failures.push(`${rel}: broken internal link ${href} -> ${target}`);
    }
  }
}

function checkAuthorityLayer() {
  if (!exists("data/market-authority-layer.json")) failures.push("data/market-authority-layer.json missing");
  if (!exists("js/market/market-authority-layer.js")) failures.push("js/market/market-authority-layer.js missing");
  const data = readJson("data/market-authority-layer.json", {});
  if (!data.snapshots || data.snapshots.length < 6) failures.push("market authority layer: expected at least 6 snapshot definitions");
  if (!data.insightBlocks || data.insightBlocks.length < 6) failures.push("market authority layer: expected at least 6 educational insight blocks");

  const requiredHooks = [
    "index.html",
    "ar/index.html",
    "rankings.html",
    "ar/rankings.html",
    ...stockPages.slice(0, 10),
    ...etfPages.slice(0, 10),
    ...comparePages.slice(0, 10),
    ...arComparePages.slice(0, 10),
    ...hubPages.filter((rel) => !rel.startsWith("ar/"))
  ];
  for (const rel of unique(requiredHooks)) {
    const html = read(rel);
    if (!html) continue;
    if (!html.includes("data-market-authority")) failures.push(`${rel}: missing Phase 16 freshness/authority marker`);
    if (!html.includes("market-authority-layer.js")) failures.push(`${rel}: missing Phase 16 authority layer script`);
  }

  for (const rel of unique([...stockPages, ...etfPages, ...comparePages, ...arComparePages, ...hubPages, ...insightPages.filter((item) => item.endsWith(".html"))])) {
    const html = read(rel);
    if (!html) continue;
    if (!html.includes('<script type="application/ld+json">')) failures.push(`${rel}: missing JSON-LD schema`);
  }
}

function checkInternalAuthorityMesh() {
  const indexedRels = unique(allUrls.map(urlToRel).filter(Boolean).filter((rel) => rel.endsWith(".html")));
  const inbound = new Map(indexedRels.map((rel) => [rel, 0]));
  for (const from of indexedRels) {
    const html = read(from);
    for (const href of extractLinks(html)) {
      if (!isInternalHtmlLink(href)) continue;
      const target = resolveHref(from, href);
      if (inbound.has(target) && target !== from) inbound.set(target, inbound.get(target) + 1);
    }
  }

  const highValue = indexedRels.filter((rel) => (
    rel.startsWith("stocks/") ||
    rel.startsWith("etfs/") ||
    rel.startsWith("compare/") ||
    rel.startsWith("insights/") ||
    hubPages.includes(rel)
  ));
  for (const rel of highValue) {
    if ((inbound.get(rel) || 0) === 0) warnings.push(`${rel}: no inbound static links found in indexed graph`);
  }

  for (const rel of comparePages.slice(0, 45)) {
    const html = read(rel);
    if (!html.includes("insights/") && !html.includes("data-market-authority")) warnings.push(`${rel}: weak article linkage from comparison page`);
  }
}

function urlToRel(url) {
  if (!url.startsWith(`${domain}/`)) return "";
  const rel = url.slice(domain.length + 1);
  if (!rel) return "index.html";
  if (rel.endsWith("/")) return `${rel}index.html`;
  return rel.endsWith(".html") ? rel : `${rel}index.html`;
}

function locs(file) {
  return [...read(file).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

function htmlFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute)
    .filter((name) => name.endsWith(".html"))
    .map((name) => path.join(dir, name).replaceAll("\\", "/"))
    .filter((rel) => !/noindex,nofollow/i.test(read(rel)));
}

function htmlFilesRecursive(dirs) {
  const out = [];
  for (const dir of dirs) {
    const absolute = path.join(root, dir);
    if (!fs.existsSync(absolute)) continue;
    for (const name of fs.readdirSync(absolute)) {
      const rel = path.join(dir, name).replaceAll("\\", "/");
      if (fs.statSync(path.join(root, rel)).isDirectory()) continue;
      if (name.endsWith(".html")) out.push(rel);
    }
  }
  return out;
}

function extractLinks(html) {
  return [...html.matchAll(/\shref="([^"#?]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
}

function isInternalHtmlLink(href) {
  return !/^(?:https?:|mailto:|tel:|\/\/)/.test(href) && (href.endsWith(".html") || href.endsWith("/"));
}

function resolveHref(fromRel, href) {
  if (href.startsWith("/")) return href.slice(1).replace(/\/$/, "/index.html");
  const target = path.normalize(path.join(path.dirname(fromRel), href)).replaceAll("\\", "/");
  return target.endsWith("/") ? `${target}index.html` : target;
}

function relToUrl(rel) {
  if (!rel) return `${domain}/`;
  return `${domain}/${rel.replace(/index\.html$/, "").replaceAll("\\", "/")}`;
}

function duplicates(values) {
  const seen = new Set();
  const dupes = new Set();
  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }
  return [...dupes];
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function readJson(rel, fallback) {
  const text = read(rel);
  return text ? JSON.parse(text) : fallback;
}
