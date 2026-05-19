const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const force = process.argv.includes("--force");
const configPath = path.join(root, "data", "market-symbols.json");
const stockTemplatePath = path.join(root, "templates", "stock-page-template.html");
const etfTemplatePath = path.join(root, "templates", "etf-page-template.html");
const hubTemplatePath = path.join(root, "templates", "hub-page-template.html");
const sitemapMarketPath = path.join(root, "sitemap-market.xml");
const redirectsPath = path.join(root, "_redirects");

const config = readJson(configPath);
const stockTemplate = readFile(stockTemplatePath);
const etfTemplate = readFile(etfTemplatePath);
const hubTemplate = readFile(hubTemplatePath);

const summary = { generated: 0, skipped: 0, urls: [] };

for (const symbol of config.symbols) {
  const template = symbol.type === "etf" ? etfTemplate : stockTemplate;
  const outputPath = path.join(root, symbol.pagePath);
  const html = renderTemplate(template, buildSymbolModel(symbol, config.domain));
  writeGeneratedFile(outputPath, html, `symbol ${symbol.symbol}`);
  summary.urls.push(urlFor(config.domain, symbol.pagePath));
}

for (const hub of config.hubs || []) {
  const outputPath = path.join(root, hub.pagePath);
  const html = renderTemplate(hubTemplate, buildHubModel(hub, config.domain));
  writeGeneratedFile(outputPath, html, `hub ${hub.key}`);
  summary.urls.push(urlFor(config.domain, hub.pagePath));
}

writeSitemapMarket(summary.urls, config.domain);
writeRedirects(config);

console.log(`Market page generation complete.`);
console.log(`Generated: ${summary.generated}`);
console.log(`Skipped: ${summary.skipped}`);
console.log(`Sitemap: sitemap-market.xml (${summary.urls.length} URLs)`);
console.log(`Redirects: _redirects`);

function buildSymbolModel(symbol, domain) {
  const relatedLinks = (symbol.relatedSymbols || []).slice(0, 4).map((related) => {
    const href = findPagePath(related) || `${symbol.type === "etf" ? "../etf.html" : "../stock.html"}?symbol=${encodeURIComponent(related)}`;
    return `<a class="market-btn" href="../${href}">${escapeHtml(related)}</a>`;
  }).join("");

  return {
    SYMBOL: symbol.symbol,
    NAME: symbol.name,
    SECTOR: symbol.sector,
    PRIORITY: String(symbol.priority),
    SEO_TITLE: symbol.seoTitle,
    SEO_DESCRIPTION: symbol.seoDescription,
    CONTENT_ANGLE: symbol.contentAngle,
    DOMAIN: domain,
    CANONICAL_URL: urlFor(domain, symbol.pagePath),
    RELATED_LINKS: relatedLinks,
    FAQ_STATIC: buildFaqHtml(symbol),
    SCHEMA_JSON: buildSchemaScript([
      buildBreadcrumbSchema(domain, symbol.pagePath, symbol.type === "etf" ? "ETFs" : "Stocks", symbol.symbol),
      buildFaqSchema(symbol.faqSeeds || [], symbol)
    ])
  };
}

function buildHubModel(hub, domain) {
  return {
    HUB_KEY: hub.key,
    HUB_TITLE: hub.title,
    SEO_TITLE: hub.seoTitle,
    SEO_DESCRIPTION: hub.seoDescription,
    DOMAIN: domain,
    CANONICAL_URL: urlFor(domain, hub.pagePath),
    FAQ_STATIC: buildHubFaqHtml(hub),
    SCHEMA_JSON: buildSchemaScript([
      buildBreadcrumbSchema(domain, hub.pagePath, "Screener", hub.title),
      buildHubFaqSchema(hub)
    ])
  };
}

function findPagePath(symbol) {
  const match = config.symbols.find((item) => item.symbol === symbol);
  return match ? match.pagePath : "";
}

function writeGeneratedFile(outputPath, html, label) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  if (fs.existsSync(outputPath)) {
    const current = readFile(outputPath);
    const isGenerated = current.includes("generated:market-page") || current.includes("generated:market-hub");
    if (!force && !isGenerated) {
      console.log(`Skipped ${label}: existing manual file (${relative(outputPath)})`);
      summary.skipped += 1;
      return;
    }
  }
  fs.writeFileSync(outputPath, html, "utf8");
  console.log(`Generated ${label}: ${relative(outputPath)}`);
  summary.generated += 1;
}

function writeSitemapMarket(urls, domain) {
  const allUrls = unique([
    `${domain}/stocks.html`,
    `${domain}/stock.html`,
    `${domain}/etfs.html`,
    `${domain}/etf.html`,
    `${domain}/ai-stock-screener.html`,
    `${domain}/methodology.html`,
    ...urls
  ]);
  const body = allUrls.map((url) => `  <url>\n    <loc>${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${url.includes("/methodology") ? "0.8" : "0.85"}</priority>\n  </url>`).join("\n");
  fs.writeFileSync(sitemapMarketPath, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, "utf8");
}

function writeRedirects(config) {
  const lines = [
    "# Generated market clean URL redirects",
    "# Run: npm run generate:market-pages"
  ];
  for (const symbol of config.symbols) {
    const clean = `/${symbol.pagePath.replace(/\.html$/, "/")}`;
    lines.push(`${clean} /${symbol.pagePath} 301`);
  }
  fs.writeFileSync(redirectsPath, `${lines.join("\n")}\n`, "utf8");
}

function buildFaqHtml(symbol) {
  return (symbol.faqSeeds || []).map((question) => {
    return `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answerForQuestion(question, symbol))}</p></details>`;
  }).join("");
}

function buildHubFaqHtml(hub) {
  return [
    [`What is the ${hub.title} hub?`, `${hub.title} is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.`],
    [`Is ${hub.title} content financial advice?`, "No. This hub is for educational and informational purposes only and does not constitute financial advice."]
  ].map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("");
}

function buildFaqSchema(questions, symbol) {
  return {
    "@type": "FAQPage",
    mainEntity: questions.map((question) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answerForQuestion(question, symbol)
      }
    }))
  };
}

function buildHubFaqSchema(hub) {
  return {
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What is the ${hub.title} hub?`,
        acceptedAnswer: { "@type": "Answer", text: `${hub.title} is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.` }
      },
      {
        "@type": "Question",
        name: `Is ${hub.title} content financial advice?`,
        acceptedAnswer: { "@type": "Answer", text: "No. This hub is for educational and informational purposes only and does not constitute financial advice." }
      }
    ]
  };
}

function answerForQuestion(question, symbol) {
  const lower = question.toLowerCase();
  if (lower.includes("financial advice")) return `No. ${symbol.symbol} analysis is for educational and informational screening only and does not constitute financial advice.`;
  if (lower.includes("why")) return `${symbol.symbol} is watched for ${symbol.contentAngle}`;
  if (lower.includes("drives") || lower.includes("affects") || lower.includes("volatility")) return `${symbol.symbol} can be affected by trend direction, risk sentiment, sector conditions, macro data, and changes in market expectations.`;
  if (lower.includes("compare")) return `${symbol.symbol} should be compared by exposure, volatility, concentration, cost, and TradeAlpha Score context.`;
  return `${symbol.symbol} is reviewed with educational screening context, related assets, risk overview, and transparent scoring components.`;
}

function buildBreadcrumbSchema(domain, pagePath, parentName, pageName) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TradeAlphaAI", item: `${domain}/` },
      { "@type": "ListItem", position: 2, name: parentName, item: `${domain}/${parentName === "ETFs" ? "etfs.html" : parentName === "Stocks" ? "stocks.html" : "ai-stock-screener.html"}` },
      { "@type": "ListItem", position: 3, name: pageName, item: urlFor(domain, pagePath) }
    ]
  };
}

function buildSchemaScript(items) {
  const schema = {
    "@context": "https://schema.org",
    "@graph": items
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`;
}

function renderTemplate(template, values) {
  return Object.entries(values).reduce((html, [key, value]) => {
    return html.replaceAll(`{{${key}}}`, escapeHtmlUnlessHtml(key, value));
  }, template);
}

function escapeHtmlUnlessHtml(key, value) {
  if (key === "RELATED_LINKS") return value;
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function readJson(file) {
  return JSON.parse(readFile(file));
}

function readFile(file) {
  return fs.readFileSync(file, "utf8");
}

function urlFor(domain, pagePath) {
  return `${domain}/${pagePath.replaceAll("\\", "/")}`;
}

function unique(values) {
  return [...new Set(values)];
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}
