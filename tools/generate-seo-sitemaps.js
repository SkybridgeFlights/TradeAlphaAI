#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
let ASSET_SLUGS = [];
try { ASSET_SLUGS = require("./asset-registry").SLUGS; } catch { ASSET_SLUGS = []; }
const marketAssetDirs = (prefix) => ASSET_SLUGS.map((slug) => `${prefix}markets/${slug}/`).filter((rel) => existsDir(rel));
let SECTOR_SLUGS = [];
try { SECTOR_SLUGS = require("./sector-registry").SLUGS; } catch { SECTOR_SLUGS = []; }
const sectorDirs = (prefix) => SECTOR_SLUGS.map((slug) => `${prefix}sectors/${slug}/`).filter((rel) => existsDir(rel));
let EQUITY_SLUGS = [];
try { EQUITY_SLUGS = require("./equity-registry").SLUGS; } catch { EQUITY_SLUGS = []; }
const equityDirs = (prefix) => EQUITY_SLUGS.map((slug) => `${prefix}equities/${slug}/`).filter((rel) => existsDir(rel));
const rankingDirs = (prefix) => ["rankings/", "rankings/assets/", "rankings/sectors/", "rankings/equities/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const marketRegimeDirs = (prefix) => ["market-regime/", "market-regime/history/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const marketMapDirs = (prefix) => ["market-map/assets/", "market-map/sectors/", "market-map/equities/", "market-map/regime/", "market-map/network/", "market-map/history/", "market-map/etfs/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const researchDirs = (prefix) => ["research/", "research/feed/", "research/regime/", "research/history/", "research/assets/", "research/sectors/", "research/equities/", "research/etfs/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
// Phase 216 — Change Intelligence Alerts & Monitoring layer
const changesDirs = (prefix) => ["changes/", "changes/assets/", "changes/sectors/", "changes/equities/", "changes/etfs/", "changes/regime/", "changes/history/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const explorerDirs = (prefix) => ["explorer/", "explorer/events/", "explorer/entity/", "explorer/network/", "explorer/research/", "explorer/search/"].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const workspaceDirs = (prefix) => [
  "workspace/",
  "workspace/watchlists/",
  "workspace/watchlists/market-core/",
  "workspace/watchlists/technology/",
  "workspace/watchlists/defensive/",
  "workspace/watchlists/etf-core/",
  "workspace/monitoring/",
  "workspace/research/",
  "workspace/regime/",
].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const ASSET_RSLUGS = (() => { try { return require("./asset-registry").SLUGS; } catch { return []; } })();
const SECTOR_RSLUGS = (() => { try { return require("./sector-registry").SLUGS; } catch { return []; } })();
const EQUITY_RSLUGS = (() => { try { return require("./equity-registry").SLUGS; } catch { return []; } })();
const ETF_RSLUGS = (() => { try { return require("./etf-registry").SLUGS; } catch { return []; } })();
const entityResearchDirs = (prefix) => [
  ...ASSET_RSLUGS.map((s) => `research/assets/${s}/`),
  ...SECTOR_RSLUGS.map((s) => `research/sectors/${s}/`),
  ...EQUITY_RSLUGS.map((s) => `research/equities/${s}/`),
  ...ETF_RSLUGS.map((s) => `research/etfs/${s}/`),
].map((rel) => `${prefix}${rel}`).filter((rel) => existsDir(rel));
const marketConfig = readJson("data/market-symbols.json", { symbols: [], hubs: [], comparisons: [] });

const core = [
  "", "stocks.html", "etfs.html", "ai-stock-screener.html",
  "rankings.html", "methodology.html", "market-data-status.html", "tadawul.html"
].filter((rel) => exists(rel))
  .concat((marketConfig.hubs || []).map((hub) => hub.pagePath).filter(exists))
  .concat(existsDir("briefs") ? ["briefs/"] : [])
  .concat(existsDir("economic-calendar") ? ["economic-calendar/"] : [])
  .concat(existsDir("market-news") ? ["market-news/"] : [])
  .concat(existsDir("market-news") ? htmlFiles("market-news").filter((rel) => !rel.endsWith("/index.html")).map(toRel) : [])
  .concat(existsDir("market-structure") ? ["market-structure/"] : [])
  .concat(existsDir("market-structure") ? htmlFiles("market-structure").filter((rel) => !rel.endsWith("/index.html")).map(toRel) : [])
  .concat(existsDir("market-terminal") ? ["market-terminal/"] : [])
  .concat(marketRegimeDirs(""))
  .concat(marketMapDirs(""))
  .concat(researchDirs(""))
  .concat(changesDirs(""))
  .concat(explorerDirs(""))
  .concat(workspaceDirs(""))
  .concat(entityResearchDirs(""))
  .concat(rankingDirs(""))
  .concat(existsDir("etfs") ? ["etfs/"] : [])
  .concat(existsDir("etfs/coverage") ? ["etfs/coverage/"] : [])
  .concat(existsDir("markets") ? ["markets/"] : [])
  .concat(marketAssetDirs(""))
  .concat(existsDir("sectors") ? ["sectors/"] : [])
  .concat(sectorDirs(""))
  .concat(existsDir("equities") ? ["equities/"] : [])
  .concat(equityDirs(""))
  .concat(existsDir("intelligence") ? ["intelligence/"] : [])
  // Phase 68 intelligence dashboards, EN + AR (required in sitemap-core.xml by
  // check:visual-intelligence; previously omitted, which failed that gate).
  .concat(["market-dashboard/", "macro-dashboard/", "etf-dashboard/", "ar/market-dashboard/", "ar/macro-dashboard/", "ar/etf-dashboard/"].filter(existsDir))
  .concat(existsDir("articles") ? ["articles/"] : [])
  .concat(educationalArticleFiles("articles").map(toRel));

const stocks = htmlFiles("stocks").map(toRel);
const etfs = htmlFiles("etfs").map(toRel);
const hubs = (marketConfig.hubs || []).map((hub) => hub.pagePath).filter(exists);
const comparisons = htmlFiles("compare").map(toRel);
// Market outlook publishing includes top-level research plus daily/weekly
// subdirectories, so sitemap discovery must recurse through the full tree.
const marketOutlook = htmlFilesRecursive("market-outlook").map(toRel);
const insights = ["insights/"].filter(existsDir).concat(htmlFiles("insights").filter((rel) => !rel.endsWith("/index.html")).map(toRel), marketOutlook);
const ar = arUrls();

writeUrlset("sitemap-core.xml", core, "weekly", priorityFor);
writeUrlset("sitemap-stocks.xml", stocks, "weekly", () => "0.82");
writeUrlset("sitemap-etfs.xml", etfs, "weekly", () => "0.82");
writeUrlset("sitemap-compare.xml", comparisons, "weekly", () => "0.80");
writeUrlset("sitemap-insights.xml", insights, "weekly", () => "0.76");
writeUrlset("sitemap-ar.xml", ar, "weekly", () => "0.80");

// Compatibility sitemap kept for existing production checks and historical robots references.
writeUrlset("sitemap-market.xml", ["stocks.html", "etfs.html", "ai-stock-screener.html", "rankings.html", "methodology.html", ...stocks, ...etfs, ...hubs, ...comparisons, ...insights], "weekly", () => "0.82");

writeSitemapIndex("sitemap.xml", [
  "sitemap-core.xml",
  "sitemap-stocks.xml",
  "sitemap-etfs.xml",
  "sitemap-compare.xml",
  "sitemap-insights.xml",
  "sitemap-ar.xml",
  "sitemap-market.xml"
]);
writeRobots();

console.log("SEO sitemap generation complete.");
console.log(`core=${core.length} stocks=${stocks.length} etfs=${etfs.length} compare=${comparisons.length} insights=${insights.length} ar=${ar.length}`);

function arUrls() {
  const out = ["ar/"];
  for (const rel of ["stocks.html", "etfs.html", "etfs/", "etfs/coverage/", "ai-stock-screener.html", "rankings.html", "insights/", "briefs/", "economic-calendar/", "market-news/", "market-structure/", "market-terminal/", "intelligence/", "market-dashboard/", "macro-dashboard/", "etf-dashboard/", "articles/", "methodology.html", "market-data-status.html"]) {
    if (rel.endsWith("/") ? existsDir(`ar/${rel}`) : exists(`ar/${rel}`)) out.push(`ar/${rel}`);
  }
  for (const rel of marketRegimeDirs("ar/")) out.push(rel);
  for (const rel of marketMapDirs("ar/")) out.push(rel);
  for (const rel of researchDirs("ar/")) out.push(rel);
  for (const rel of changesDirs("ar/")) out.push(rel);
  for (const rel of explorerDirs("ar/")) out.push(rel);
  for (const rel of workspaceDirs("ar/")) out.push(rel);
  for (const rel of entityResearchDirs("ar/")) out.push(rel);
  for (const rel of rankingDirs("ar/")) out.push(rel);
  for (const b of ["markets/","sectors/","equities/"]) if (existsDir(`ar/${b}`)) out.push(`ar/${b}`);
  for (const rel of marketAssetDirs("ar/")) out.push(rel);
  for (const rel of sectorDirs("ar/")) out.push(rel);
  for (const rel of equityDirs("ar/")) out.push(rel);
  for (const hub of marketConfig.hubs || []) if (exists(`ar/${hub.pagePath}`)) out.push(`ar/${hub.pagePath}`);
  for (const dir of ["stocks", "etfs", "compare", "insights", "articles", "market-outlook", "market-news", "market-structure"]) {
    const files = dir === "market-outlook"
      ? htmlFilesRecursive(path.join("ar", dir))
      : dir === "articles"
        ? educationalArticleFiles(path.join("ar", dir))
      : htmlFiles(path.join("ar", dir));
    for (const file of files) {
      if (file.endsWith("/index.html") && (dir === "insights" || dir === "articles" || dir === "market-news" || dir === "market-structure")) continue;
      out.push(toRel(file));
    }
  }
  return unique(out);
}

function educationalArticleFiles(dir) {
  return htmlFiles(dir).filter((rel) => {
    if (rel.endsWith("/index.html")) return false;
    try { return fs.readFileSync(path.join(root, rel), "utf8").includes("data-educational-article="); }
    catch { return false; }
  });
}

function writeUrlset(file, rels, changefreq, priorityFn) {
  const body = dedupeByAbsoluteUrl(file, rels).map((rel) => {
    const url = relToUrl(rel);
    return `  <url>\n    <loc>${url}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priorityFn(rel)}</priority>\n  </url>`;
  }).join("\n");
  fs.writeFileSync(path.join(root, file), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, "utf8");
}

function writeSitemapIndex(file, children) {
  const body = dedupeAbsoluteUrls(file, children.map((child) => ({
    value: child,
    url: `${domain}/${child}`,
  }))).map(({ value: child }) => `  <sitemap>\n    <loc>${domain}/${child}</loc>\n  </sitemap>`).join("\n");
  fs.writeFileSync(path.join(root, file), `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`, "utf8");
}

function writeRobots() {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "",
    "# Sitemap index and split sitemap files",
    `Sitemap: ${domain}/sitemap.xml`,
    `Sitemap: ${domain}/sitemap-core.xml`,
    `Sitemap: ${domain}/sitemap-stocks.xml`,
    `Sitemap: ${domain}/sitemap-etfs.xml`,
    `Sitemap: ${domain}/sitemap-compare.xml`,
    `Sitemap: ${domain}/sitemap-insights.xml`,
    `Sitemap: ${domain}/sitemap-ar.xml`,
    `Sitemap: ${domain}/sitemap-market.xml`,
    "",
    "# Crawl-delay can be added if you need to reduce crawl rate for heavy servers",
    "# Crawl-delay: 10"
  ];
  fs.writeFileSync(path.join(root, "robots.txt"), `${lines.join("\n")}\n`, "utf8");
}

function priorityFor(rel) {
  if (rel === "") return "1.0";
  if (["stocks.html", "etfs.html", "ai-stock-screener.html", "rankings.html"].includes(rel)) return "0.90";
  return "0.78";
}

function htmlFiles(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute)
    .filter((name) => name.endsWith(".html"))
    .map((name) => path.join(dir, name).replaceAll("\\", "/"))
    .filter((rel) => !isNoindex(rel));
}

function htmlFilesRecursive(dir) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) return [];
  const found = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith(".html")) {
        const rel = path.relative(root, full).replaceAll("\\", "/");
        if (!isNoindex(rel)) found.push(rel);
      }
    }
  };
  visit(absolute);
  return found;
}

function isNoindex(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) && /noindex,nofollow/i.test(fs.readFileSync(file, "utf8"));
}

function relToUrl(rel) {
  if (!rel) return `${domain}/`;
  // Convert ONLY actual index pages (".../index.html" or root "index.html") to
  // clean directory URLs. Anchoring to a path separator prevents mangling a
  // filename that merely ends in "index.html" — e.g. "breadth-vs-index.html"
  // must NOT become "breadth-vs-".
  return `${domain}/${rel.replace(/(^|\/)index\.html$/, "$1").replaceAll("\\", "/")}`;
}

function toRel(file) {
  return file.replaceAll("\\", "/");
}

function exists(rel) {
  return rel === "" || fs.existsSync(path.join(root, rel));
}

function existsDir(rel) {
  return fs.existsSync(path.join(root, rel));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))].sort((a, b) => relToUrl(a).localeCompare(relToUrl(b)));
}

function dedupeByAbsoluteUrl(sitemap, rels) {
  const entries = rels
    .filter((rel) => rel !== null && rel !== undefined)
    .map((rel) => ({ value: rel, url: relToUrl(rel) }));
  return dedupeAbsoluteUrls(sitemap, entries)
    .map(({ value }) => value)
    .sort((a, b) => relToUrl(a).localeCompare(relToUrl(b)));
}

function dedupeAbsoluteUrls(sitemap, entries) {
  const seen = new Map();
  for (const entry of entries) {
    if (seen.has(entry.url)) {
      console.log(`[SITEMAP DEDUPE]\nsitemap=${sitemap}\nurl=${entry.url}`);
      continue;
    }
    seen.set(entry.url, entry);
  }
  return [...seen.values()];
}

function readJson(rel, fallback) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
