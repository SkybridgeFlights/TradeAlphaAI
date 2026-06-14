#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
const failures = [];
const warnings = [];

const scanDirs = [".", "stocks", "etfs", "compare", "ar/compare", "insights", "ar/insights", "en/insights", "articles", "ar/articles"];

const pages = [];
for (const dir of scanDirs) {
  const absolute = path.join(root, dir);
  if (!fs.existsSync(absolute)) continue;
  for (const name of fs.readdirSync(absolute)) {
    if (!name.endsWith(".html")) continue;
    const rel = path.join(dir === "." ? "" : dir, name).replaceAll("\\", "/");
    pages.push(rel);
  }
}

let checked = 0;
let skipped = 0;

for (const rel of pages) {
  const html = read(rel);
  if (!html) continue;
  if ((rel.startsWith("articles/") || rel.startsWith("ar/articles/"))
      && !html.includes("data-educational-article=")
      && !rel.endsWith("index.html")) {
    skipped++;
    continue;
  }

  const robots = metaContent(html, 'name="robots"');
  if (robots && /noindex/i.test(robots)) { skipped++; continue; }

  checked++;
  checkPage(rel, html);
}

if (failures.length) {
  console.error("Social meta check FAILED:");
  for (const f of failures.slice(0, 150)) console.error(`  - ${f}`);
  if (failures.length > 150) console.error(`  ... ${failures.length - 150} more`);
  if (warnings.length) {
    console.error("Warnings:");
    for (const w of warnings.slice(0, 60)) console.error(`  - ${w}`);
  }
  process.exit(1);
}

console.log(`Social meta check passed. Checked ${checked} indexed pages, skipped ${skipped} noindex pages.`);
if (warnings.length) {
  console.log("Warnings:");
  for (const w of warnings.slice(0, 60)) console.log(`  - ${w}`);
}

function checkPage(rel, html) {
  const langAttr = (html.match(/<html[^>]+lang="([^"]+)"/i) || [])[1] || "";
  const isAr = rel.startsWith("ar/") || langAttr.startsWith("ar");
  const expectedLocale = isAr ? "ar_AR" : "en_US";

  const ogTitle = metaContent(html, 'property="og:title"');
  const ogDesc = metaContent(html, 'property="og:description"');
  const ogType = metaContent(html, 'property="og:type"');
  const ogUrl = metaContent(html, 'property="og:url"');
  const ogImage = metaContent(html, 'property="og:image"');
  const ogLocale = metaContent(html, 'property="og:locale"');
  const twCard = metaContent(html, 'name="twitter:card"');
  const twTitle = metaContent(html, 'name="twitter:title"');
  const twDesc = metaContent(html, 'name="twitter:description"');

  const canonical = (html.match(/<link rel="canonical" href="([^"]+)"/i) || [])[1];

  if (!ogTitle) failures.push(`${rel}: missing og:title`);
  else if (!ogTitle.trim()) failures.push(`${rel}: og:title is empty`);

  if (!ogDesc) failures.push(`${rel}: missing og:description`);
  else if (!ogDesc.trim()) failures.push(`${rel}: og:description is empty`);

  if (!ogType) failures.push(`${rel}: missing og:type`);

  if (!ogUrl) failures.push(`${rel}: missing og:url`);
  else if (!ogUrl.startsWith(domain)) failures.push(`${rel}: og:url is off-domain: ${ogUrl}`);

  if (!ogImage) failures.push(`${rel}: missing og:image`);

  if (!ogLocale) failures.push(`${rel}: missing og:locale`);
  else if (ogLocale !== expectedLocale) warnings.push(`${rel}: og:locale "${ogLocale}" expected "${expectedLocale}"`);

  if (!twCard) warnings.push(`${rel}: missing twitter:card`);

  if (!twTitle) warnings.push(`${rel}: missing twitter:title`);
  else if (!twTitle.trim()) failures.push(`${rel}: twitter:title is empty`);

  if (!twDesc) warnings.push(`${rel}: missing twitter:description`);
  else if (!twDesc.trim()) failures.push(`${rel}: twitter:description is empty`);

  if (canonical && ogUrl && canonical !== ogUrl) {
    warnings.push(`${rel}: canonical "${canonical}" differs from og:url "${ogUrl}"`);
  }

  const emptyMeta = html.match(/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"\s+content=""\s*\/?>/g);
  if (emptyMeta) {
    for (const tag of emptyMeta) {
      failures.push(`${rel}: empty content in social meta tag: ${tag.trim()}`);
    }
  }

  if (/<meta\s+(?:property|name)="(?:og:|twitter:)[^"]*"\s+content="[^"]*&amp;amp;[^"]*"/i.test(html)) {
    failures.push(`${rel}: double-encoded HTML entity (&amp;amp;) in social meta`);
  }
}

function metaContent(html, attrSelector) {
  const re = new RegExp(`<meta\\s[^>]*${escapeRe(attrSelector)}[^>]*\\scontent="([^"]*)"`, "i");
  const m = html.match(re) || html.match(new RegExp(`<meta\\s[^>]*content="([^"]*)"[^>]*${escapeRe(attrSelector)}`, "i"));
  return m ? decodeEntities(m[1]) : null;
}

function escapeRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeEntities(str) {
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function read(rel) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
