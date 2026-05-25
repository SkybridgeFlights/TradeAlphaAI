const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  "market-data-status.html",
  "js/related-content.js",
  "js/research-layer.js",
  "data/research-layer.json"
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
checkRelatedContentEngine();
checkGeneratedInsights();
checkSocialMetadata();
checkImportantTitles();
checkFeaturedContentLinks();
checkInternalLinks();
checkResearchLayer();
checkInsightDiscoverability();
checkLocalizedStaticPages();
if (!read("insights/index.html").includes("Research articles are coming soon.")) {
  checkArabicInsightBodies();
  checkArticlePairContract();
}
checkUtf8Integrity();
checkSmallLocalizationRegressionGuards();

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

function checkArticlePairContract() {
  const result = spawnSync(process.execPath, ["tools/check-article-pairs.js"], {
    cwd: root,
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    failures.push(`Article pair contract failed:\n${output}`);
  }
}

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
  const forbidden = [
    /buy now/i,
    /guaranteed profit/i,
    /sure signal/i,
    /guaranteed prediction/i,
    /AI-generated analysis/i,
    /AI Market Portal/i,
    /AI-style/i,
    /Generated Stock Page/i,
    /Generated ETF Page/i,
    /Future placeholder/i,
    /Placeholder CTA/i
  ];
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

function checkRelatedContentEngine() {
  /* Verify the RC script exists and has the expected structure */
  const rcSource = read("js/related-content.js");
  if (!rcSource) { failures.push("js/related-content.js: missing — run batch-page-updates.js"); return; }
  for (const marker of ["data-rc", "rootPfx", "deepCard", "articleCard", "rc-screener-cta"]) {
    if (!rcSource.includes(marker)) failures.push(`js/related-content.js: missing expected symbol: ${marker}`);
  }

  /* Spot-check that key pages have the data-rc attribute and RC script */
  const rcPages = [
    "stocks/nvda.html", "stocks/amd.html", "stocks/msft.html",
    "etfs/spy.html",    "etfs/qqq.html",   "etfs/soxx.html",
    "ai-stocks.html",   "semiconductor-stocks.html"
  ];
  for (const rel of rcPages) {
    const html = read(rel);
    if (!html) { failures.push(`RC check: page not found: ${rel}`); continue; }
    if (!html.includes('data-rc=')) failures.push(`${rel}: missing data-rc attribute — run batch-page-updates.js`);
    if (!html.includes('related-content.js')) failures.push(`${rel}: missing related-content.js script tag`);
  }

  /* Verify no HTML-escaped JSON-LD blocks remain */
  const allHtml = listFiles(root, [".html"]);
  for (const file of allHtml) {
    const rel = relative(file);
    if (rel.includes("node_modules") || rel.startsWith("tools/") || rel.startsWith("templates/")) continue;
    const text = fs.readFileSync(file, "utf8");
    if (text.includes('&lt;script type=&quot;application/ld+json&quot;&gt;')) {
      failures.push(`${rel}: HTML-escaped JSON-LD schema block detected — run batch-page-updates.js`);
    }
  }
}

function checkGeneratedInsights() {
  const TOPICS = JSON.parse(read("data/insight-topics.json") || "{}");
  if (!TOPICS.articles) { failures.push("data/insight-topics.json: missing or invalid"); return; }
  const publishedInsightFiles = fs.existsSync(path.join(root, "insights"))
    ? fs.readdirSync(path.join(root, "insights")).filter((name) => name.endsWith(".html") && name !== "index.html")
    : [];
  if (publishedInsightFiles.length === 0) return;

  const sitemapMarket = read("sitemap-market.xml");
  const sitemapMain   = read("sitemap.xml");
  const seenTitles    = new Set();

  for (const article of TOPICS.articles) {
    const relPath = `insights/${article.slug}.html`;
    const html = read(relPath);

    /* File existence */
    if (!html) { failures.push(`Generated insight missing: ${relPath}`); continue; }

    /* Required disclaimer */
    if (!html.includes("educational and informational purposes only and does not constitute")) {
      failures.push(`${relPath}: missing required educational disclaimer`);
    }

    /* Schema: JSON-LD must be present and unescaped */
    if (!html.includes('<script type="application/ld+json">')) {
      failures.push(`${relPath}: missing or HTML-escaped JSON-LD schema block`);
    }

    /* Article schema fields */
    for (const field of ["BreadcrumbList", "Article", "FAQPage", "datePublished", "headline"]) {
      if (!html.includes(field)) failures.push(`${relPath}: JSON-LD missing field: ${field}`);
    }

    /* Related content engine */
    if (!html.includes('data-rc=')) failures.push(`${relPath}: missing data-rc attribute`);
    if (!html.includes('related-content.js')) failures.push(`${relPath}: missing related-content.js script`);

    /* Canonical URL */
    if (!html.includes(`/insights/${article.slug}.html`)) {
      failures.push(`${relPath}: missing canonical URL reference`);
    }

    /* Sitemap inclusion */
    const url = `https://www.tradealphaai.com/insights/${article.slug}.html`;
    if (!sitemapMarket.includes(`<loc>${url}</loc>`) && !sitemapMain.includes(`<loc>${url}</loc>`)) {
      failures.push(`${relPath}: URL missing from both sitemaps — run generate-insights.js`);
    }

    /* Duplicate title detection */
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const t = titleMatch[1].trim();
      if (seenTitles.has(t)) failures.push(`${relPath}: duplicate <title> detected: "${t}"`);
      else seenTitles.add(t);
    }

    /* No undefined/NaN in generated output */
    if (/\bundefined\b|\bNaN\b/.test(html)) failures.push(`${relPath}: contains undefined or NaN`);
  }
}

function checkSocialMetadata() {
  const keyPages = [
    "index.html",
    "insights/index.html",
    "stocks/nvda.html",
    "etfs/spy.html",
    "ai-stocks.html"
  ];
  const required = [
    /<meta property="og:title" content="[^"]+"/,
    /<meta property="og:description" content="[^"]+"/,
    /<meta property="og:type" content="[^"]+"/,
    /<meta property="og:url" content="https:\/\/www\.tradealphaai\.com\//,
    /<meta property="og:image" content="https:\/\/www\.tradealphaai\.com\/Image\/og-image\.svg"/,
    /<meta name="twitter:card" content="summary_large_image"/,
    /<meta name="twitter:title" content="[^"]+"/,
    /<meta name="twitter:description" content="[^"]+"/,
    /<meta name="twitter:image" content="https:\/\/www\.tradealphaai\.com\/Image\/og-image\.svg"/
  ];
  for (const rel of keyPages) {
    const html = read(rel);
    if (!html) { failures.push(`Metadata check: page missing: ${rel}`); continue; }
    for (const pattern of required) {
      if (!pattern.test(html)) failures.push(`${rel}: missing or malformed social metadata: ${pattern}`);
    }
    if (/<meta (?:name|property)="[^"]+" content="\s*"/.test(html)) {
      failures.push(`${rel}: empty metadata content attribute detected`);
    }
  }
}

function checkImportantTitles() {
  const important = unique([
    "index.html",
    "stocks.html",
    "etfs.html",
    "ai-stock-screener.html",
    "ai-stocks.html",
    "semiconductor-stocks.html",
    "growth-stocks.html",
    "dividend-etfs.html",
    "insights/index.html",
    ...listFiles(path.join(root, "stocks"), [".html"]).map(relative),
    ...listFiles(path.join(root, "etfs"), [".html"]).map(relative),
    ...listFiles(path.join(root, "insights"), [".html"]).map(relative)
  ]);
  const seen = new Map();
  for (const rel of important) {
    const html = read(rel);
    const title = (html.match(/<title>([^<]+)<\/title>/) || [])[1];
    if (!title) { failures.push(`${rel}: missing <title>`); continue; }
    const normalized = title.trim();
    if (seen.has(normalized)) failures.push(`${rel}: duplicate <title> also used by ${seen.get(normalized)}: "${normalized}"`);
    else seen.set(normalized, rel);
  }
}

function checkFeaturedContentLinks() {
  for (const rel of ["index.html", "insights/index.html"]) {
    const html = read(rel);
    const links = extractLinks(html).filter((href) => {
      return html.includes(`href="${href}" data-featured-link`) || html.includes(`href="${href}"`);
    });
    for (const href of links) {
      if (!isInternalHtmlLink(href)) continue;
      const resolved = resolveHref(rel, href);
      if (!fs.existsSync(path.join(root, resolved))) failures.push(`${rel}: featured-content link does not resolve: ${href}`);
    }
  }
}

function checkInternalLinks() {
  const htmlFiles = listFiles(root, [".html"]).filter((file) => {
    const rel = relative(file);
    return !rel.includes("node_modules") && !rel.startsWith("templates/");
  });
  for (const file of htmlFiles) {
    const rel = relative(file);
    const html = fs.readFileSync(file, "utf8");
    for (const href of extractLinks(html)) {
      if (!isInternalHtmlLink(href)) continue;
      const target = resolveHref(rel, href);
      if (!fs.existsSync(path.join(root, target))) failures.push(`${rel}: internal link does not resolve: ${href}`);
    }
  }
}

function checkResearchLayer() {
  const layer = JSON.parse(read("data/research-layer.json") || "{}");
  const source = read("js/research-layer.js");
  const hasPublishedArticles = fs.existsSync(path.join(root, "insights"))
    && fs.readdirSync(path.join(root, "insights")).some((name) => name.endsWith(".html") && name !== "index.html");

  for (const marker of ["data-research-timeline", "data-research-themes", "data-research-highlight", "rotate(", "daySeed", "hash("]) {
    if (!source.includes(marker)) failures.push(`js/research-layer.js: missing expected research-layer marker: ${marker}`);
  }

  if (hasPublishedArticles && (!Array.isArray(layer.insights) || layer.insights.length < 6)) failures.push("data/research-layer.json: expected at least 6 insight timeline entries");
  if (hasPublishedArticles && (!Array.isArray(layer.themes) || layer.themes.length < 6)) failures.push("data/research-layer.json: expected at least 6 market themes");

  const linkLabels = layer.linkLabels || {};
  for (const insight of layer.insights || []) {
    for (const field of ["title", "href", "category", "readingTime", "updated", "symbols", "signal", "summary"]) {
      if (!insight[field] || (Array.isArray(insight[field]) && !insight[field].length)) failures.push(`data/research-layer.json: insight missing ${field}`);
    }
    if (hasPublishedArticles && insight.href && !fs.existsSync(path.join(root, insight.href))) failures.push(`data/research-layer.json: insight href does not resolve: ${insight.href}`);
  }

  for (const theme of layer.themes || []) {
    for (const field of ["key", "label", "intro", "links"]) {
      if (!theme[field] || (Array.isArray(theme[field]) && !theme[field].length)) failures.push(`data/research-layer.json: theme missing ${field}`);
    }
    for (const href of theme.links || []) {
      if (!linkLabels[href]) failures.push(`data/research-layer.json: theme link missing label: ${href}`);
      if (hasPublishedArticles && !fs.existsSync(path.join(root, href))) failures.push(`data/research-layer.json: theme link does not resolve: ${href}`);
    }
  }

  const hookPages = hasPublishedArticles ? [
    "index.html",
    "insights/index.html",
    "stocks/nvda.html",
    "etfs/spy.html",
    "ai-stocks.html"
  ] : ["stocks/nvda.html", "etfs/spy.html", "ai-stocks.html"];
  for (const rel of hookPages) {
    const html = read(rel);
    if (hasPublishedArticles && !html.includes("research-layer.js")) failures.push(`${rel}: missing research-layer.js script`);
    if (hasPublishedArticles && !html.includes("data-research-timeline")) failures.push(`${rel}: missing latest market research timeline hook`);
  }

  for (const rel of ["ai-stocks.html", "stocks/nvda.html"]) {
    const html = read(rel);
    if (hasPublishedArticles && !html.includes("data-research-themes")) failures.push(`${rel}: missing rotating market themes hook`);
  }

  const generatedSource = read("tools/generate-insights.js");
  for (const marker of [
    "Executive Summary and Market Context",
    "Key Market Takeaway and Why It Matters",
    "ETF Exposure, Related Sectors, and Research Hubs",
    "Risk Factors and Macro Context",
    "Portfolio Context and Research Process",
    "Conclusion"
  ]) {
    if (!generatedSource.includes(marker)) failures.push(`tools/generate-insights.js: missing generated insight structure marker: ${marker}`);
  }
}

function checkInsightDiscoverability() {
  const navPages = ["index.html", "stocks.html", "etfs.html", "ai-stock-screener.html"];
  for (const rel of navPages) {
    const html = read(rel);
    if (!html.includes('href="insights/"') && !html.includes('href="/insights/"') && !html.includes('href="insights/index.html"')) {
      failures.push(`${rel}: missing public Articles navigation link`);
    }
  }

  for (const rel of ["ai-stocks.html", "semiconductor-stocks.html", "growth-stocks.html", "dividend-etfs.html"]) {
    const html = read(rel);
    if (!html.includes('href="insights/"') && !html.includes('href="/insights/"') && !html.includes('href="insights/index.html"')) {
      failures.push(`${rel}: missing Articles hub link`);
    }
  }

  const queue = JSON.parse((read("data/insight-topic-queue.json") || "{}").replace(/^\uFEFF/, ""));
  const publishedInsightFiles = fs.existsSync(path.join(root, "insights"))
    ? fs.readdirSync(path.join(root, "insights")).filter((name) => name.endsWith(".html") && name !== "index.html")
    : [];
  if (publishedInsightFiles.length === 0) return;
  const insightsIndex = read("insights/index.html");
  const researchLayer = read("data/research-layer.json");
  const sitemapMarket = read("sitemap-market.xml");
  const sitemapMain = read("sitemap.xml");

  for (const topic of queue.topics || []) {
    const rel = `insights/${topic.slug}.html`;
    const html = read(rel);
    const url = `https://www.tradealphaai.com/${rel}`;

    if (topic.status === "published") {
      if (!html) failures.push(`${rel}: published queue topic is missing article file`);
      if (html && !html.includes('content="index,follow,max-image-preview:large"')) failures.push(`${rel}: published article is not indexable`);
      if (!insightsIndex.includes(`${topic.slug}.html`) && !researchLayer.includes(`${topic.slug}.html`)) {
        failures.push(`${rel}: published article is not reachable from insights index or research layer`);
      }
      if (!sitemapMarket.includes(`<loc>${url}</loc>`) && !sitemapMain.includes(`<loc>${url}</loc>`)) {
        failures.push(`${rel}: published article missing from sitemaps`);
      }
    }

    if (["candidate", "approved", "draft"].includes(topic.status) && html) {
      if (!html.includes('content="noindex,nofollow,max-image-preview:large"')) failures.push(`${rel}: review draft is not noindex`);
      if (sitemapMarket.includes(`<loc>${url}</loc>`) || sitemapMain.includes(`<loc>${url}</loc>`)) {
        failures.push(`${rel}: review draft appears in sitemap`);
      }
    }
  }
}

function checkLocalizedStaticPages() {
  const configPath = "data/localization/ar-pages.json";
  const config = JSON.parse((read(configPath) || "{}").replace(/^\uFEFF/, ""));
  const phase1 = JSON.parse((read("data/localization/ar-phase1-pages.json") || "{\"pages\":[]}").replace(/^\uFEFF/, ""));
  config.pages = [...(config.pages || []), ...(phase1.pages || [])];
  const marketConfig = JSON.parse((read("data/market-symbols.json") || "{\"symbols\":[],\"hubs\":[]}").replace(/^\uFEFF/, ""));
  for (const source of [
    "stocks.html",
    "etfs.html",
    "ai-stock-screener.html",
    "market-data-status.html",
    ...((marketConfig.hubs || []).map((item) => item.pagePath)),
    ...((marketConfig.symbols || []).map((item) => item.pagePath)),
    ...fs.readdirSync(path.join(root, "insights")).filter((name) => name.endsWith(".html") && name !== "index.html").map((name) => `insights/${name}`)
  ]) {
    const arPath = `ar/${source}`;
    const enPath = `en/${source}`;
    if (!config.pages.some((page) => page.source === source)) {
      config.pages.push({ source, arPath, enPath });
    }
  }
  if (!Array.isArray(config.pages) || !config.pages.length) {
    failures.push(`${configPath}: missing localized page config`);
    return;
  }

  const sitemapAr = read("sitemap-ar.xml");
  if (!sitemapAr.includes("https://www.tradealphaai.com/ar/")) failures.push("sitemap-ar.xml missing Arabic homepage");

  const robots = read("robots.txt");
  if (!robots.includes("sitemap-ar.xml")) failures.push("robots.txt missing sitemap-ar.xml reference");

  const router = read("js/language-router.js");
  if (!router.includes("localizedRoutes")) failures.push("js/language-router.js missing static route map");
  if (/openai|claude|api[_-]?key|fetch\(/i.test(router)) {
    failures.push("js/language-router.js must route only; no translation/API calls allowed");
  }

  for (const page of config.pages) {
    const sourceHtml = read(page.source);
    const isReviewDraft = sourceHtml && /noindex,nofollow/i.test(sourceHtml);
    if (isReviewDraft && !read(page.arPath) && !read(page.enPath)) {
      if (sitemapAr.includes(`https://www.tradealphaai.com/${page.arPath.replace(/index\.html$/, "")}`)) failures.push(`${page.arPath}: Arabic review draft appears in sitemap-ar.xml`);
      continue;
    }
    for (const rel of [page.arPath, page.enPath]) {
      const html = read(rel);
      if (!html) {
        failures.push(`${rel}: localized static page missing`);
        continue;
      }
      if (!html.includes('rel="canonical"')) failures.push(`${rel}: missing canonical`);
      if (!html.includes('hreflang="ar"')) failures.push(`${rel}: missing Arabic hreflang`);
      if (!html.includes('hreflang="en"')) failures.push(`${rel}: missing English hreflang`);
      if (!html.includes('data-locale-route')) failures.push(`${rel}: missing static language switch route`);
      if (/landing-i18n|data-copy=|translate\.google|new\s+OpenAI\s*\(|import\s+OpenAI|openai\.com\/v1|claude\.ai\/api|anthropic\s*=\s*new/i.test(html)) {
        failures.push(`${rel}: contains runtime translation or AI client marker`);
      }
      if (html.includes("data-rc=") && !html.includes("related-content.js")) {
        failures.push(`${rel}: related-content hook present without related-content.js`);
      }
      if (html.includes("data-research-timeline") && !html.includes("research-layer.js")) {
        failures.push(`${rel}: research-layer hook present without research-layer.js`);
      }
    }

    const arHtml = read(page.arPath);
    if (arHtml && !/<html lang="ar" dir="rtl">/.test(arHtml)) failures.push(`${page.arPath}: missing Arabic RTL html attributes`);
    if (arHtml && !/(نصيحة مالية|نصيحة استثمارية|تحذير المخاطر|تنبيه المخاطر)/.test(arHtml)) failures.push(`${page.arPath}: missing Arabic financial disclaimer wording`);
    if (arHtml) {
      const navMatch = arHtml.match(/<nav class="nav-group"[\s\S]*?<\/nav>/);
      const navText = navMatch ? navMatch[0].replace(/<[^>]+>/g, " ") : "";
      if (/\b(Home|AI Stock Analyzer|ETF Analyzer|Market Screener|Articles|Methodology)\b/.test(navText)) {
        failures.push(`${page.arPath}: Arabic nav contains English labels`);
      }
    }
    if (sourceHtml && arHtml) {
      // Skip structural parity for index.html — AR homepage is intentionally a
      // research-platform layout that differs from the EN trading-signals homepage.
      if (page.source !== "index.html") checkArabicStructuralParity(page.source, page.arPath, sourceHtml, arHtml);
      checkArabicLanguageIsolation(page.arPath, arHtml);
    }
    if (arHtml) {
      for (const href of extractLinks(arHtml)) {
        if (!isInternalHtmlLink(href)) continue;
        const target = resolveHref(page.arPath, href);
        if (!fs.existsSync(path.join(root, target))) failures.push(`${page.arPath}: Arabic internal link does not resolve: ${href}`);
      }
    }

    if (sourceHtml && !sourceHtml.includes('hreflang="ar"')) failures.push(`${page.source}: missing Arabic hreflang alternate`);
    if (sourceHtml && !sourceHtml.includes('data-locale-route="ar"')) failures.push(`${page.source}: missing Arabic static language switch link`);
    if (isReviewDraft) {
      const arHtmlForDraft = read(page.arPath);
      if (arHtmlForDraft && !/noindex,nofollow/i.test(arHtmlForDraft)) failures.push(`${page.arPath}: Arabic review draft must remain noindex`);
      if (sitemapAr.includes(`https://www.tradealphaai.com/${page.arPath}`)) failures.push(`${page.arPath}: Arabic review draft appears in sitemap-ar.xml`);
    } else if (!sitemapAr.includes(`https://www.tradealphaai.com/${page.arPath.replace(/index\.html$/, "")}`)) {
      failures.push(`sitemap-ar.xml missing ${page.arPath}`);
    }
  }
}

function checkArabicInsightBodies() {
  const arInsightsDir = path.join(root, "ar", "insights");
  if (!fs.existsSync(arInsightsDir)) { failures.push("ar/insights/ directory missing"); return; }

  const arContentDir = path.join(root, "data", "localization", "ar-insight-content");
  const arIndexHtml = read("ar/insights/index.html");

  const files = fs.readdirSync(arInsightsDir)
    .filter((name) => name.endsWith(".html") && name !== "index.html");

  for (const name of files) {
    const rel = `ar/insights/${name}`;
    const html = read(rel);
    if (!html) { failures.push(`${rel}: Arabic insight file missing`); continue; }

    const isNoindex = /noindex,nofollow/i.test(html);
    const slug = name.replace(/\.html$/, "");
    const hasContentFile = fs.existsSync(path.join(arContentDir, `${slug}.json`));
    const sourceHtml = read(`insights/${name}`);
    const sourceIsNoindex = sourceHtml && /noindex,nofollow/i.test(sourceHtml);

    if (isNoindex) {
      if (hasContentFile && !sourceIsNoindex) failures.push(`${rel}: published Arabic article is noindex — regenerate with npm run localize:generate`);
      // Must not appear linked in the Arabic insights index as a published article
      if (arIndexHtml.includes(`/ar/insights/${name}`) && arIndexHtml.includes('insight-card')) {
        failures.push(`${rel}: noindex Arabic article is linked from ar/insights/index.html`);
      }
      continue;
    }

    // Indexed Arabic article — must have real body content
    const h2Matches = (html.match(/<h2[^>]*>/g) || []).length;
    if (h2Matches < 5) {
      failures.push(`${rel}: indexed Arabic article has only ${h2Matches} section headings — requires ≥5`);
    }

    // Must contain Arabic FAQ heading
    if (!html.includes("أسئل? ?????")) {
      failures.push(`${rel}: indexed Arabic article missing FAQ section (أسئل? ?????)`);
    }

    // Minimum Arabic character count in the article body
    const articleBodyMatch = html.match(/<article[\s\S]*?<\/article>/i);
    const articleText = articleBodyMatch ? articleBodyMatch[0].replace(/<[^>]+>/g, " ") : "";
    const arabicCharCount = (articleText.match(/[\u0600-\u06FF]/g) || []).length;
    if (arabicCharCount < 1200) {
      failures.push(`${rel}: indexed Arabic article body has only ${arabicCharCount} Arabic characters — requires ≥1200`);
    }

    // Must contain financial disclaimer wording in Arabic
    if (!html.includes("نصيحة مال??")) {
      failures.push(`${rel}: indexed Arabic article missing financial disclaimer wording (نصيحة مال??)`);
    }

    // Must have an Arabic content file backing it
    if (!hasContentFile) {
      failures.push(`${rel}: indexed Arabic article has no matching ar-insight-content/${slug}.json`);
    }
  }

  // ar/insights/index.html must only link to articles that are indexed
  const linkedSlugs = [...arIndexHtml.matchAll(/href="\/ar\/insights\/([^"]+\.html)"/g)].map((m) => m[1]);
  for (const linkedFile of linkedSlugs) {
    const linkedHtml = read(`ar/insights/${linkedFile}`);
    if (linkedHtml && /noindex,nofollow/i.test(linkedHtml)) {
      failures.push(`ar/insights/index.html links to noindex article: ar/insights/${linkedFile}`);
    }
  }
}

function checkArabicStructuralParity(sourceRel, arRel, sourceHtml, arHtml) {
  const sourceSections = countMatches(sourceHtml, /<section\b/gi);
  const arSections = countMatches(arHtml, /<section\b/gi);
  if (sourceSections !== arSections) {
    failures.push(`${arRel}: section count ${arSections} does not match English source ${sourceRel} (${sourceSections})`);
  }

  for (const hook of ["data-rc", "data-research-timeline", "data-research-themes", "data-research-highlight"]) {
    if (sourceHtml.includes(hook) && !arHtml.includes(hook)) failures.push(`${arRel}: missing source hook ${hook}`);
  }
  for (const marker of ["hero", "market-section", "market-panel", "cta-actions", "nav-group"]) {
    if (sourceHtml.includes(marker) && !arHtml.includes(marker)) failures.push(`${arRel}: missing source layout marker ${marker}`);
  }
  if (sourceHtml.includes("related-content.js") && !arHtml.includes("related-content.js")) failures.push(`${arRel}: missing related-content.js script from source page`);
  if (sourceHtml.includes("research-layer.js") && !arHtml.includes("research-layer.js")) failures.push(`${arRel}: missing research-layer.js script from source page`);
}

function checkArabicLanguageIsolation(rel, html) {
  const visible = stripNonVisible(html);
  const forbiddenLabels = [
    "Home",
    "AI Stock Analyzer",
    "ETF Analyzer",
    "Market Screener",
    "Articles",
    "Methodology",
    "Generated Stock Page",
    "Generated ETF Page",
    "Score Breakdown",
    "Company Snapshot",
    "Technical Outlook",
    "Fundamental Overview",
    "Risk Overview",
    "Continue Reading",
    "Frequently Asked Questions",
    "Educational disclaimer",
    "Read article",
    "Related Research",
    "Research Hub",
    "Popular Research",
    "Contents",
    "FAQ",
    "Screener",
    "Future placeholder",
    "Premium Signals Placeholder",
    "This article",
    "investment advice",
    "price targets",
    "security recommendations",
    "Understanding",
    "Market context",
    "Cloud Computing",
    "Equity Factors",
    "Broad Market"
  ];
  forbiddenLabels.push(
    "Bull case",
    "Bear case",
    "Full analysis",
    "Related research",
    "Educational ranking",
    "Research Context",
    "SEO Overview",
    "AI-generated analysis",
    "Research Platform",
    "Static Research",
    "analyst-style explanations",
    "How Scores Work",
    "Top الأسهم",
    "high-CTR",
    "buy or sell recommendations"
  );
  for (const label of forbiddenLabels) {
    if (new RegExp(`\\b${escapeRegExp(label)}\\b`).test(visible)) failures.push(`${rel}: Arabic visible text leaks English label: ${label}`);
  }
  if (/Understوing|demو|bاقرأth|alاقرأy|stوard|InfiniBو|bوwidth|Pوemic/i.test(html)) {
    failures.push(`${rel}: malformed Arabic term replacement artifact detected`);
  }
  if (/\b(watchlist candidates|ranking recommendation|provide price targets|predict future performance|market education|future generated|provider architecture|long-term ownership costs|A fast educational|does the analyzer|Can I use this|Will real market data|high-CTR|buy or sell recommendations|analyst-style explanations|Investors follow|revenue durability|competitive positioning|sector leadership|research candidates|Most followed|Market candidates)\b/i.test(visible) || /Top الأسهم/i.test(visible)) {
    failures.push(`${rel}: Arabic visible text contains untranslated English content`);
  }
  if (/placeholder/i.test(visible)) failures.push(`${rel}: Arabic visible text contains placeholder wording`);
  if (/[\u00d8\u00d9\u00e2]|\u0644\u0627t\b|does \u0644\u0627t/i.test(html)) failures.push(`${rel}: malformed Arabic encoding or partial translation detected`);
  if (/<script type="application\/ld\+json">[\s\S]*?&quot;[\s\S]*?<\/script>/i.test(html)) {
    failures.push(`${rel}: JSON-LD appears HTML-escaped`);
  }
}

function stripNonVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function extractLinks(html) {
  return [...html.matchAll(/\shref="([^"#?]+)(?:#[^"]*)?"/g)].map((m) => m[1]);
}

function isInternalHtmlLink(href) {
  return !/^(?:https?:|mailto:|tel:|\/\/)/.test(href) && (href.endsWith(".html") || href.endsWith("/"));
}

function resolveHref(fromRel, href) {
  let target = href.startsWith("/") ? href.slice(1) : href;
  if (target.endsWith("/")) target += "index.html";
  const baseDir = path.dirname(fromRel);
  if (href.startsWith("/")) return path.normalize(target).replaceAll("\\", "/").replace(/^\.\//, "");
  return path.normalize(path.join(baseDir, target)).replaceAll("\\", "/").replace(/^\.\//, "");
}

function unique(values) {
  return [...new Set(values)];
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function checkUtf8Integrity() {
  const result = spawnSync(process.execPath, [path.join(root, "tools", "check-utf8-integrity.js")], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
    failures.push(`UTF-8 integrity scanner failed${output ? `:\n${output}` : ""}`);
  }
}

function checkSmallLocalizationRegressionGuards() {
  const arHome = read("ar/index.html");
  const enHome = read("index.html");
  const countSections = (html) => (html.match(/<section\b/gi) || []).length;
  const countCards = (html) => (
    html.match(/class="[^"]*(?:card|panel|tile|feature|system|proof)[^"]*"/gi) || []
  ).length;
  const enSectionCount = countSections(enHome);
  const arSectionCount = countSections(arHome);
  const enCardCount = countCards(enHome);
  const arCardCount = countCards(arHome);

  if (enSectionCount && arSectionCount !== enSectionCount) {
    failures.push(`ar/index.html: homepage parity failed — EN has ${enSectionCount} sections, AR has ${arSectionCount}`);
  }
  if (enCardCount && arCardCount !== enCardCount) {
    failures.push(`ar/index.html: homepage parity failed — EN has ${enCardCount} card/panel elements, AR has ${arCardCount}`);
  }

  // AR homepage must NEVER contain these terms regardless of EN homepage state
  for (const pattern of [
    /Free Signals/i,
    /AI-Powered Trading Signals/i,
    /Join Free on Telegram/i,
    /View Strategy/i,
    /\bFree Beta\b/i,
    /&amp;nbsp;/,
  ]) {
    if (pattern.test(arHome)) {
      failures.push(`ar/index.html: forbidden trading-signals copy found: ${pattern}`);
    }
  }
  // These are only forbidden in AR if EN has already removed them
  for (const pattern of [
    /Trading Signals/i,
    /\bWFO\b/i,
    /\bTelegram\b/,
  ]) {
    if (pattern.test(arHome) && !pattern.test(enHome)) {
      failures.push(`ar/index.html: forbidden old trading-signals copy found: ${pattern}`);
    }
  }

  const navMatch = arHome.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i);
  if (navMatch && /رؤى السوق/.test(navMatch[0])) {
    failures.push("ar/index.html: Arabic nav must use المقالات, not رؤى السوق");
  }
  if (navMatch && !/المقالات/.test(navMatch[0])) {
    failures.push("ar/index.html: Arabic nav missing المقالات label");
  }

  // Check ALL ar/ HTML files for رؤى السوق in visible nav
  for (const file of listFiles(path.join(root, "ar"), [".html"])) {
    const rel = relative(file);
    const html = fs.readFileSync(file, "utf8");
    const arNavMatch = html.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i);
    if (arNavMatch && /رؤى السوق/.test(arNavMatch[0])) {
      failures.push(`${rel}: Arabic nav still contains رؤى السوق — must be المقالات`);
    }
  }

  // Check EN root HTML files for "Market Insights" in visible nav-link
  const enNavFiles = listFiles(root, [".html"]).filter((f) => !f.includes(path.sep + "ar" + path.sep) && !f.includes(path.sep + "en" + path.sep));
  for (const file of enNavFiles) {
    const html = fs.readFileSync(file, "utf8");
    const enNavMatch = html.match(/<nav class="nav-group"[\s\S]*?<\/nav>/i);
    if (enNavMatch && /class="nav-link">Market Insights<\/a>/.test(enNavMatch[0])) {
      failures.push(`${relative(file)}: EN nav still contains "Market Insights" — must be "Articles"`);
    }
  }

  // Check rankings.html top-stocks section is not AI-only titled
  const rankingsHtml = read("rankings.html");
  if (rankingsHtml) {
    const topStocksMatch = rankingsHtml.match(/id="top-stocks"[\s\S]*?<h2>([^<]+)<\/h2>/);
    if (topStocksMatch && /\bAI\b/i.test(topStocksMatch[1]) && !/broad|top 10|best stocks/i.test(topStocksMatch[1])) {
      failures.push(`rankings.html: #top-stocks section title appears AI-only: "${topStocksMatch[1]}" — should be broad market`);
    }
  }
}
