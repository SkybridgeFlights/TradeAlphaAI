#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
const marketConfig = readJson("data/market-symbols.json", { symbols: [], hubs: [], comparisons: [] });

const core = [
  "", "stocks.html", "etfs.html", "ai-stock-screener.html",
  "rankings.html", "methodology.html", "market-data-status.html", "tadawul.html"
].filter((rel) => exists(rel)).concat((marketConfig.hubs || []).map((hub) => hub.pagePath).filter(exists));

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
writeUrlset("sitemap-market.xml", unique(["stocks.html", "etfs.html", "ai-stock-screener.html", "rankings.html", "methodology.html", ...stocks, ...etfs, ...hubs, ...comparisons, ...insights]), "weekly", () => "0.82");

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
  for (const rel of ["stocks.html", "etfs.html", "ai-stock-screener.html", "rankings.html", "insights/", "methodology.html", "market-data-status.html"]) {
    if (rel.endsWith("/") ? existsDir(`ar/${rel}`) : exists(`ar/${rel}`)) out.push(`ar/${rel}`);
  }
  for (const hub of marketConfig.hubs || []) if (exists(`ar/${hub.pagePath}`)) out.push(`ar/${hub.pagePath}`);
  for (const dir of ["stocks", "etfs", "compare", "insights", "market-outlook"]) {
    const files = dir === "market-outlook"
      ? htmlFilesRecursive(path.join("ar", dir))
      : htmlFiles(path.join("ar", dir));
    for (const file of files) {
      if (file.endsWith("/index.html") && dir === "insights") continue;
      out.push(toRel(file));
    }
  }
  return unique(out);
}

function writeUrlset(file, rels, changefreq, priorityFn) {
  const body = unique(rels).map((rel) => {
    const url = relToUrl(rel);
    return `  <url>\n    <loc>${url}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priorityFn(rel)}</priority>\n  </url>`;
  }).join("\n");
  fs.writeFileSync(path.join(root, file), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, "utf8");
}

function writeSitemapIndex(file, children) {
  const body = children.map((child) => `  <sitemap>\n    <loc>${domain}/${child}</loc>\n  </sitemap>`).join("\n");
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
  return `${domain}/${rel.replace(/index\.html$/, "").replaceAll("\\", "/")}`;
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

function readJson(rel, fallback) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}
