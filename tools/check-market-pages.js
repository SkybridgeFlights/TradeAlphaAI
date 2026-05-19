const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const config = JSON.parse(fs.readFileSync(path.join(root, "data", "market-symbols.json"), "utf8"));
const sitemap = readOptional(path.join(root, "sitemap-market.xml")) + "\n" + readOptional(path.join(root, "sitemap.xml"));

const targets = [
  ...config.symbols.map((item) => ({ kind: "symbol", ...item })),
  ...(config.hubs || []).map((item) => ({ kind: "hub", ...item }))
];

const failures = [];
const forbidden = [
  /buy now/i,
  /guaranteed profit/i,
  /sure signal/i,
  /guaranteed prediction/i
];

for (const target of targets) {
  const file = path.join(root, target.pagePath);
  if (!fs.existsSync(file)) {
    failures.push(`${target.pagePath}: missing file`);
    continue;
  }

  const html = fs.readFileSync(file, "utf8");
  expect(html, /<title>[^<]+<\/title>/i, target.pagePath, "missing title");
  expect(html, /<meta name="description" content="[^"]+"/i, target.pagePath, "missing meta description");
  expect(html, /<link rel="canonical" href="[^"]+"/i, target.pagePath, "missing canonical");
  expect(html, /educational and informational purposes only and does not constitute financial advice/i, target.pagePath, "missing disclaimer");
  expect(html, /FAQ|FAQPage|data-stock-faq|data-etf-faq/i, target.pagePath, "missing FAQ section or schema");
  expect(html, /breadcrumb|BreadcrumbList/i, target.pagePath, "missing breadcrumb or breadcrumb schema");
  expect(html, /application\/ld\+json/i, target.pagePath, "missing JSON-LD schema");

  if (/undefined|NaN/.test(html)) failures.push(`${target.pagePath}: contains undefined or NaN`);
  for (const pattern of forbidden) {
    if (pattern.test(html)) failures.push(`${target.pagePath}: forbidden wording matched ${pattern}`);
  }

  if (target.kind === "symbol") {
    expect(html, /initStaticSymbolPage\("[A-Z0-9.-]+"\)/, target.pagePath, "missing static symbol renderer hook");
  } else {
    expect(html, /initHubPage\("[a-z0-9-]+"\)/, target.pagePath, "missing hub renderer hook");
  }

  const expectedUrl = `${config.domain}/${target.pagePath}`;
  if (!sitemap.includes(`<loc>${expectedUrl}</loc>`)) {
    failures.push(`${target.pagePath}: sitemap missing ${expectedUrl}`);
  }
}

if (failures.length) {
  console.error("Market page validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Market page validation passed for ${targets.length} configured pages.`);
console.log(`Sitemap coverage verified via sitemap-market.xml and sitemap.xml.`);

function expect(html, pattern, file, message) {
  if (!pattern.test(html)) failures.push(`${file}: ${message}`);
}

function readOptional(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
