const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];

const requiredFiles = [
  ".env.example",
  "sitemap-market.xml",
  "robots.txt",
  "_redirects",
  "netlify/functions/market-data.js",
  "netlify/functions/market-health.js",
  "netlify/functions/providers/mock-provider.js",
  "netlify/functions/providers/alpha-vantage.js",
  "netlify/functions/providers/finnhub.js",
  "netlify/functions/providers/polygon.js",
  "netlify/functions/providers/yahoo-compatible.js",
  "data/market-symbols.json",
  "js/market/market-normalizer.js",
  "js/market/data-status.js",
  "js/market/provider-health.js",
  "market-data-status.html"
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`Missing required file: ${file}`);
}

const env = read(".env.example");
for (const key of ["MARKET_DATA_PROVIDER=mock", "ALPHA_VANTAGE_API_KEY=", "POLYGON_API_KEY=", "FINNHUB_API_KEY=", "OPENAI_API_KEY="]) {
  if (!env.includes(key)) failures.push(`.env.example missing placeholder: ${key}`);
}

const robots = read("robots.txt");
if (!robots.includes("sitemap-market.xml")) failures.push("robots.txt does not reference sitemap-market.xml");

const sitemapMarket = read("sitemap-market.xml");
if (!/<loc>https:\/\/www\.tradealphaai\.com\/stocks\/nvda\.html<\/loc>/.test(sitemapMarket)) {
  failures.push("sitemap-market.xml missing configured symbol URL sample");
}

const redirects = read("_redirects");
if (!redirects.includes("/stocks/nvda/ /stocks/nvda.html 301")) failures.push("_redirects missing stock clean URL sample");
if (!redirects.includes("/etfs/spy/ /etfs/spy.html 301")) failures.push("_redirects missing ETF clean URL sample");

scanForForbiddenWording();
scanForFrontendSecrets();
checkConfiguredSymbols();
checkPhase9Integration();

if (failures.length) {
  console.error("Production readiness check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production readiness check passed.");
console.log("Serverless provider stubs, env placeholders, sitemap, robots, redirects, disclaimers, frontend secret scan, and Phase 9 Finnhub integration passed.");
console.log("");
console.log("Phase 9 smoke test instructions:");
console.log("  1. Live provider test:   FINNHUB_API_KEY=<key> MARKET_DATA_PROVIDER=finnhub npx netlify dev");
console.log("     Then: curl 'http://localhost:8888/.netlify/functions/market-data?symbol=NVDA&type=stock'");
console.log("     Expect: metadata.status === 'live', asset.dataMode === 'live', metadata.provider === 'finnhub'");
console.log("  2. Provider-disabled test: MARKET_DATA_PROVIDER=mock npx netlify dev");
console.log("     Then: curl 'http://localhost:8888/.netlify/functions/market-data?symbol=NVDA&type=stock'");
console.log("     Expect: metadata.status === 'mock', metadata.isMock === true");
console.log("  3. Provider-failure test: FINNHUB_API_KEY=invalid MARKET_DATA_PROVIDER=finnhub npx netlify dev");
console.log("     Then: curl 'http://localhost:8888/.netlify/functions/market-data?symbol=NVDA&type=stock'");
console.log("     Expect: fallback === true, metadata.status === 'fallback', metadata.isFallback === true");
console.log("  4. Static mode test:     npx serve . -l 8098");
console.log("     Expect: pages load with mock data, no console errors, no API key exposure");

function checkConfiguredSymbols() {
  const config = JSON.parse(read("data/market-symbols.json"));
  const pages = [...config.symbols, ...(config.hubs || [])];
  for (const page of pages) {
    const html = read(page.pagePath);
    if (!html) {
      failures.push(`Configured page missing: ${page.pagePath}`);
      continue;
    }
    if (!html.includes("educational and informational purposes only and does not constitute financial advice")) {
      failures.push(`${page.pagePath}: missing required disclaimer`);
    }
    if (/undefined|NaN/.test(html)) failures.push(`${page.pagePath}: contains undefined or NaN`);
    if (!html.includes("data-data-status")) failures.push(`${page.pagePath}: missing data status badge hook`);
  }
}

const diagnostics = read("market-data-status.html");
if (!diagnostics.includes("data-diagnostics-status")) failures.push("market-data-status.html missing diagnostics status hook");
if (!diagnostics.includes("data-endpoint-status")) failures.push("market-data-status.html missing endpoint status hook");
if (!diagnostics.includes("data-provider-health")) failures.push("market-data-status.html missing provider health hook");
if (!diagnostics.includes("data-refresh-diagnostics")) failures.push("market-data-status.html missing refresh diagnostics control");

const functionSource = read("netlify/functions/market-data.js");
for (const field of ["metadata", "provider", "status", "generatedAt", "updatedAt", "isFallback", "isMock", "cacheTtlSeconds", "attribution", "cacheStatus", "staleAfterSeconds", "expiresAt", "servedFromCache"]) {
  if (!functionSource.includes(field)) failures.push(`market-data function missing metadata field: ${field}`);
}

const healthFunctionSource = read("netlify/functions/market-health.js");
for (const field of ["providerName", "status", "latencyMs", "lastChecked", "supportsLiveData", "requiresServerKey", "keyConfigured", "fallbackAvailable", "cacheTtlSeconds", "cacheSimulation"]) {
  if (!healthFunctionSource.includes(field)) failures.push(`market-health function missing health field: ${field}`);
}

const providerHealthSource = read("js/market/provider-health.js");
for (const field of ["healthy", "degraded", "unavailable", "mock-only", "unknown", "normalizeProviderHealth"]) {
  if (!providerHealthSource.includes(field)) failures.push(`provider-health model missing: ${field}`);
}

function checkPhase9Integration() {
  const finnhubSource = read("netlify/functions/providers/finnhub.js");

  // Verify real implementation exists (not just a stub that throws)
  if (!finnhubSource.includes("FINNHUB_API_KEY")) {
    failures.push("finnhub.js: missing FINNHUB_API_KEY usage — real implementation required");
  }
  if (!finnhubSource.includes("fetchJson")) {
    failures.push("finnhub.js: missing fetchJson — real HTTP calls required");
  }
  if (!finnhubSource.includes("isRateLimit")) {
    failures.push("finnhub.js: missing isRateLimit handling — rate-limit detection required");
  }
  if (!finnhubSource.includes("AbortController")) {
    failures.push("finnhub.js: missing AbortController — timeout handling required");
  }
  if (!finnhubSource.includes("dataMode")) {
    failures.push("finnhub.js: missing dataMode field — live data contract required");
  }
  if (finnhubSource.includes('throw new Error("Finnhub provider is not configured.")') &&
      !finnhubSource.includes("fetchJson")) {
    failures.push("finnhub.js: still a stub — replace with real implementation");
  }

  // Verify market-data.js has latency tracking
  const marketDataSource = read("netlify/functions/market-data.js");
  if (!marketDataSource.includes("latencyMs")) {
    failures.push("market-data.js: missing latencyMs tracking — Phase 9 requirement");
  }
  if (!marketDataSource.includes("isRateLimit")) {
    failures.push("market-data.js: missing isRateLimit fallback path — rate-limit safety required");
  }
  if (!marketDataSource.includes("_stats")) {
    failures.push("market-data.js: missing _stats session tracking — Phase 9 requirement");
  }

  // Verify market-health.js has implementationStatus
  const healthSource = read("netlify/functions/market-health.js");
  if (!healthSource.includes("implementationStatus")) {
    failures.push("market-health.js: missing implementationStatus field — Phase 9 requirement");
  }
  if (!healthSource.includes("finnhubIntegration")) {
    failures.push("market-health.js: missing finnhubIntegration metadata — Phase 9 requirement");
  }

  // Verify data-status.js has latencyMs and providerDisplayName
  const dataStatusSource = read("js/market/data-status.js");
  if (!dataStatusSource.includes("latencyMs")) {
    failures.push("data-status.js: missing latencyMs field — Phase 9 UX requirement");
  }
  if (!dataStatusSource.includes("providerDisplayName")) {
    failures.push("data-status.js: missing providerDisplayName — Phase 9 UX requirement");
  }

  // Verify diagnostics page has Phase 9 sections
  const diagSource = read("market-data-status.html");
  if (!diagSource.includes("data-provider-metrics")) {
    failures.push("market-data-status.html: missing data-provider-metrics hook — Phase 9 requirement");
  }
  if (!diagSource.includes("data-provider-warning")) {
    failures.push("market-data-status.html: missing data-provider-warning hook — Phase 9 requirement");
  }

  // Verify no raw finnhub errors leak to frontend (finnhub error messages must not be in frontend JS)
  for (const dir of ["js"]) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const file of listFiles(base, [".js"])) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("finnhub.io/api") || text.includes("finnhub.io")) {
        failures.push(`${relative(file)}: Finnhub API URL found in frontend JS — provider calls must be server-side only`);
      }
    }
  }
}

function scanForForbiddenWording() {
  const forbidden = [/buy now/i, /guaranteed profit/i, /sure signal/i, /guaranteed prediction/i];
  for (const file of listFiles(root, [".html", ".js"])) {
    const rel = relative(file);
    if (rel.includes("node_modules")) continue;
    if (rel.startsWith("tools/")) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of forbidden) {
      if (pattern.test(text)) failures.push(`${rel}: forbidden wording matched ${pattern}`);
    }
  }
}

function scanForFrontendSecrets() {
  const frontendDirs = ["js", "css", "templates"];
  const secretPatterns = [
    /sk_live_[A-Za-z0-9]+/,
    /SG\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
    /OPENAI_API_KEY\s*=\s*sk-/,
    /ALPHA_VANTAGE_API_KEY\s*=\s*[A-Za-z0-9]{8,}/,
    /POLYGON_API_KEY\s*=\s*[A-Za-z0-9]{8,}/,
    /FINNHUB_API_KEY\s*=\s*[A-Za-z0-9]{8,}/
  ];
  for (const dir of frontendDirs) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const file of listFiles(base, [".html", ".js", ".css"])) {
      const text = fs.readFileSync(file, "utf8");
      for (const pattern of secretPatterns) {
        if (pattern.test(text)) failures.push(`${relative(file)}: possible frontend secret matched ${pattern}`);
      }
    }
  }
}

function listFiles(dir, extensions) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(full, extensions));
    else if (extensions.includes(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}
