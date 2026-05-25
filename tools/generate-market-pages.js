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
const researchAssets = loadResearchAssets();
const symbols = mergeSymbols(config.symbols || [], researchAssets);
const stockTemplate = readFile(stockTemplatePath);
const etfTemplate = readFile(etfTemplatePath);
const hubTemplate = readFile(hubTemplatePath);

const summary = { generated: 0, skipped: 0, urls: [] };

for (const symbol of symbols) {
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
    RC_KEY: rcKeyForSymbol(symbol),
    RELATED_LINKS: relatedLinks,
    RESEARCH_BLOCKS: buildResearchBlocks(symbol),
    FAQ_STATIC: buildFaqHtml(symbol),
    SCHEMA_JSON: buildSchemaScript([
      buildBreadcrumbSchema(domain, symbol.pagePath, symbol.type === "etf" ? "ETFs" : "Stocks", symbol.symbol),
      buildFaqSchema(symbol.faq || symbol.faqSeeds || [], symbol)
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
    RC_KEY: rcKeyForHub(hub),
    FAQ_STATIC: buildHubFaqHtml(hub),
    SCHEMA_JSON: buildSchemaScript([
      buildBreadcrumbSchema(domain, hub.pagePath, "Screener", hub.title),
      buildHubFaqSchema(hub)
    ])
  };
}

function rcKeyForSymbol(symbol) {
  return String(symbol.symbol || "").toLowerCase();
}

function rcKeyForHub(hub) {
  const map = {
    "ai-stocks": "hub-ai-stocks",
    "semiconductor-stocks": "hub-semiconductor",
    "growth-stocks": "hub-growth",
    "dividend-etfs": "hub-dividends"
  };
  return map[hub.key] || `hub-${hub.key}`;
}

function findPagePath(symbol) {
  const match = symbols.find((item) => item.symbol === symbol);
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
    `${domain}/rankings.html`,
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
  const faqs = (symbol.faq || []).length
    ? symbol.faq
    : (symbol.faqSeeds || []).map((question) => ({ q: question, a: answerForQuestion(question, symbol) }));
  return faqs.map((item) => {
    const question = item.q || item.question || item;
    const answer = item.a || item.answer || answerForQuestion(question, symbol);
    return `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`;
  }).join("");
}

function buildHubFaqHtml(hub) {
  return [
    [`What is the ${hub.title} hub?`, `${hub.title} is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.`],
    [`Is ${hub.title} content financial advice?`, "No. This hub is for educational and informational purposes only and does not constitute financial advice."]
  ].map(([question, answer]) => `<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join("");
}

function buildFaqSchema(questions, symbol) {
  const faqs = questions.map((item) => {
    const question = item.q || item.question || item;
    const answer = item.a || item.answer || answerForQuestion(question, symbol);
    return { question, answer };
  });
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer
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

function buildResearchBlocks(symbol) {
  const asset = symbol.researchAsset;
  if (!asset) return "";
  const isEtf = symbol.type === "etf";
  const primaryModel = isEtf ? asset.etfMethodology : asset.businessModel;
  const modelTitle = isEtf ? "Index methodology" : "Business model";
  const modelEyebrow = isEtf ? "ETF Methodology" : "Company Overview";
  const roleTitle = isEtf ? "Diversification role" : "Why investors follow it";
  const relatedAssetTitle = isEtf ? "Related stocks and ETFs" : "Related ETFs and stocks";
  return [
    '<section class="market-section"><div class="content-columns">',
    `<article class="market-panel"><span class="eyebrow">${modelEyebrow}</span><h2>${escapeHtml(modelTitle)}</h2><p class="market-copy">${escapeHtml(asset.overview)}</p><p class="market-copy">${escapeHtml(primaryModel)}</p></article>`,
    `<article class="market-panel"><span class="eyebrow">Research Context</span><h2>${escapeHtml(roleTitle)}</h2><p class="market-copy">${escapeHtml(asset.whyInvestorsFollow)}</p><div class="insight-chip-row">${(asset.themes || []).map((theme) => `<span class="insight-chip">${escapeHtml(theme)}</span>`).join("")}</div></article>`,
    '</div></section>',
    '<section class="market-section"><div class="content-columns">',
    `<article class="market-panel"><span class="eyebrow">Positive research factors</span><h2>Bull case framework</h2>${listHtml(asset.bullCase)}</article>`,
    `<article class="market-panel"><span class="eyebrow">Risk layer</span><h2>Bear case and risk factors</h2>${listHtml([...(asset.bearCase || []), ...(asset.riskFactors || [])])}</article>`,
    '</div></section>',
    '<section class="market-section"><div class="content-columns">',
    `<article class="market-panel"><span class="eyebrow">Valuation Context</span><h2>Research score context</h2><p class="market-copy">${escapeHtml(asset.valuationContext)}</p><p class="market-copy">TradeAlpha Score is an educational research label for comparison. It is not a buy or sell recommendation.</p></article>`,
    `<article class="market-panel"><span class="eyebrow">${escapeHtml(relatedAssetTitle)}</span><h2>Connected research paths</h2><div class="cta-actions">${researchLinkButtons(asset)}</div></article>`,
    '</div></section>'
  ].join("\n      ");
}

function listHtml(items) {
  return `<ul class="insight-list">${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function researchLinkButtons(asset) {
  const symbols = unique([...(asset.relatedStocks || []), ...(asset.relatedETFs || [])]).slice(0, 6);
  const links = symbols.map((symbol) => {
    const href = findPagePath(symbol);
    return href ? `<a class="market-btn" href="../${href}">${escapeHtml(symbol)}</a>` : "";
  }).filter(Boolean);
  for (const slug of (asset.relatedInsights || []).slice(0, 3)) {
    const insightPath = path.join(root, "insights", `${slug}.html`);
    if (fs.existsSync(insightPath)) {
      links.push(`<a class="market-btn" href="../insights/${escapeHtml(slug)}.html">${escapeHtml(titleFromSlug(slug))}</a>`);
    }
  }
  return links.join("");
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
  if (key === "RELATED_LINKS" || key === "SCHEMA_JSON" || key === "RESEARCH_BLOCKS") return value;
  return escapeHtml(value);
}

function loadResearchAssets() {
  const out = [];
  for (const kind of ["stocks", "etfs"]) {
    const dir = path.join(root, "data", "research-assets", kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      out.push(readJson(path.join(dir, name)));
    }
  }
  return out;
}

function mergeSymbols(existing, assets) {
  const bySymbol = new Map((existing || []).map((item) => [item.symbol, item]));
  for (const asset of assets) {
    const current = bySymbol.get(asset.symbol) || {};
    const isEtf = asset.type === "etf";
    bySymbol.set(asset.symbol, {
      ...current,
      symbol: asset.symbol,
      name: asset.name,
      type: asset.type,
      sector: asset.sector || asset.category || current.sector,
      priority: current.priority || 0.72,
      pagePath: current.pagePath || `${isEtf ? "etfs" : "stocks"}/${asset.symbol.toLowerCase()}.html`,
      relatedSymbols: unique([...(asset.relatedStocks || []), ...(asset.relatedETFs || []), ...(current.relatedSymbols || [])]).slice(0, 6),
      seoTitle: asset.seo?.title || current.seoTitle || `${asset.symbol} Research | TradeAlphaAI`,
      seoDescription: asset.seo?.description || current.seoDescription || asset.overview,
      contentAngle: asset.overview || current.contentAngle,
      faq: asset.faq,
      faqSeeds: current.faqSeeds,
      researchAsset: asset
    });
  }
  return [...bySymbol.values()].sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
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

function titleFromSlug(slug) {
  return String(slug || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function relative(file) {
  return path.relative(root, file).replaceAll("\\", "/");
}
