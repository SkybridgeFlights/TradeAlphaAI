import { listMarketAssets, getMarketAsset, normalizeSymbol } from "./market-data-provider.js";
import { buildTradeAlphaScore } from "./scoring-engine.js";
import { getTechnicalInsights } from "./technical-analysis.js";
import { getFundamentalInsights } from "./fundamental-analysis.js";
import { getSentimentSummary } from "./sentiment-engine.js";
import {
  applyEtfDetailSeo,
  applyEtfListSeo,
  applyScreenerSeo,
  applyStockDetailSeo,
  applyStockListSeo
} from "./seo-engine.js";
import { buildSymbolFaq, getMethodologySections, getSymbolContent, hubDefinitions } from "./content-templates.js";
import { createMockStatus, normalizeDataStatus } from "./data-status.js";
import { normalizeProviderHealthList } from "./provider-health.js";

const disclaimer = "This analysis is for educational and informational purposes only and does not constitute financial advice.";
const arDisclaimer = "هذا التحليل لأغراض تعليمية ومعلوماتية فقط ولا يشكل نصيحة مالية أو استثمارية.";

function isArabicPage() {
  return document.documentElement.lang === "ar" || document.documentElement.dir === "rtl";
}

function text(en, ar) {
  return isArabicPage() ? ar : en;
}

function researchField(asset, key, fallback = "") {
  const research = asset.research || {};
  return isArabicPage() ? (research.ar?.[key] || research[key] || asset[key] || fallback) : (research[key] || asset[key] || fallback);
}

function researchList(asset, key, fallback = []) {
  const value = researchField(asset, key, fallback);
  return Array.isArray(value) ? value : fallback;
}

function localizedSector(asset) {
  return researchField(asset, "sector", asset.sector || asset.category || text("Market Research", "أبحاث السوق"));
}

function localizedRisk(value) {
  const map = {
    low: text("Low", "منخفضة"),
    medium: text("Medium", "متوسطة"),
    high: text("High", "مرتفعة")
  };
  return map[String(value || "").toLowerCase()] || capitalize(value || text("medium", "متوسطة"));
}

function localizedFacetValue(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "stock") return text("Stock", "سهم");
  if (normalized === "etf") return text("ETF", "صندوق مؤشرات");
  if (["low", "medium", "high"].includes(normalized)) return localizedRisk(value);
  if (normalized === "positive") return text("Positive", "إيجابية");
  if (normalized === "neutral") return text("Neutral", "محايدة");
  if (normalized === "mixed") return text("Mixed", "مختلطة");
  return capitalize(value);
}

function assetHref(asset) {
  const folder = asset.type === "etf" ? "etfs" : "stocks";
  const href = `/${folder}/${asset.symbol.toLowerCase()}.html`;
  return isArabicPage() ? `/ar${href}` : href;
}

export async function initStocksPage() {
  applyStockListSeo();
  const stocks = await listMarketAssets("stock");
  renderAssetCards("[data-popular-stocks]", stocks, "stock.html");
  wireSymbolSearch("[data-stock-search]", "[data-stock-symbol]", stocks, "stock.html", "Try NVDA, AAPL, TSLA, MSFT, AMZN, or META.");
}

export async function initEtfsPage() {
  applyEtfListSeo();
  const etfs = await listMarketAssets("etf");
  renderAssetCards("[data-popular-etfs]", etfs, "etf.html");
  wireSymbolSearch("[data-etf-search]", "[data-etf-symbol]", etfs, "etf.html", "Try SPY, QQQ, VTI, VOO, or GLD.");
  renderComparison("[data-etf-comparison]", etfs);
}

export async function initStockDetailPage() {
  const symbol = getSymbolFromUrl("NVDA");
  const asset = await getMarketAsset(symbol);

  if (!asset || asset.type !== "stock") {
    renderMissingAsset(symbol, "stock", "stocks.html", text("Try NVDA or AAPL for the stock analyzer.", "جرّب NVDA أو AAPL في محلل الأسهم."));
    applyStockDetailSeo(null);
    return;
  }

  applyStockDetailSeo(asset);
  rememberViewed(asset);
  renderAssetDetail(asset, await listMarketAssets());
}

export async function initEtfDetailPage() {
  const symbol = getSymbolFromUrl("SPY");
  const asset = await getMarketAsset(symbol);

  if (!asset || asset.type !== "etf") {
    renderMissingAsset(symbol, "ETF", "etfs.html", text("Try SPY, QQQ, VTI, VOO, or GLD for the ETF analyzer.", "جرّب SPY أو QQQ أو VTI أو VOO أو GLD في محلل صناديق المؤشرات."));
    applyEtfDetailSeo(null);
    return;
  }

  applyEtfDetailSeo(asset);
  rememberViewed(asset);
  renderAssetDetail(asset, await listMarketAssets());
  renderEtfOnlySections(asset);
}

export async function initStaticSymbolPage(symbol) {
  const asset = await getMarketAsset(symbol);
  if (!asset) return;
  rememberViewed(asset);
  renderAssetDetail(asset, await listMarketAssets());
  if (asset.type === "etf") renderEtfOnlySections(asset);
  renderStaticSeoContent(asset);
}

export async function initHubPage(hubKey) {
  const hub = hubDefinitions[hubKey];
  if (!hub) return;
  const assets = await listMarketAssets();
  const selected = assets.filter((asset) => hub.symbols.includes(asset.symbol));
  setText("[data-hub-title]", hub.title);
  setText("[data-hub-intro]", hub.intro);
  renderAssetCards("[data-hub-assets]", selected, "auto");
  renderHubSections(hub);
  renderRecentlyViewed();
}

export function initMethodologyPage() {
  const target = document.querySelector("[data-methodology-sections]");
  if (!target) return;
  target.innerHTML = getMethodologySections().map(([title, body]) => `
    <article class="method-card">
      <h2>${title}</h2>
      <p>${body}</p>
    </article>
  `).join("");
}

export async function initScreenerPage() {
  applyScreenerSeo();
  const assets = await listMarketAssets();
  const state = { query: "", type: "all", minScore: 0, risk: "all", sector: "all", category: "all", sentiment: "all", sort: "score" };

  renderScreenerFacets(assets);
  renderScreenerSections(assets);
  renderScreenerResults(assets, state);

  document.querySelectorAll("[data-screener-control]").forEach((control) => {
    control.addEventListener("input", () => {
      state.query = getValue("[data-filter-query]").toUpperCase();
      state.type = getValue("[data-filter-type]") || "all";
      state.minScore = Number(getValue("[data-filter-score]") || 0);
      state.risk = getValue("[data-filter-risk]") || "all";
      state.sector = getValue("[data-filter-sector]") || "all";
      state.category = getValue("[data-filter-category]") || "all";
      state.sentiment = getValue("[data-filter-sentiment]") || "all";
      state.sort = getValue("[data-filter-sort]") || "score";
      renderScreenerResults(assets, state);
    });
  });
}

function renderAssetCards(selector, assets, hrefBase) {
  const target = document.querySelector(selector);
  if (!target) return;

  target.innerHTML = assets.map((asset) => renderAssetCard(asset, hrefBase)).join("");
}

function renderAssetCard(asset, hrefBase) {
  const score = buildTradeAlphaScore(asset);
  const arrow = asset.changePercent >= 0 ? "up" : "down";
  const href = hrefBase === "auto" ? `${asset.type === "etf" ? "etf.html" : "stock.html"}?symbol=${asset.symbol}` : `${hrefBase}?symbol=${asset.symbol}`;
  return `
    <a class="market-card stock-tile asset-card" href="${href}" aria-label="Open ${asset.symbol} analysis">
      <span class="tile-topline">
        <strong>${asset.symbol}</strong>
        <span class="heat-badge heat-${asset.heat || "steady"}">${capitalize(asset.heat || "steady")}</span>
      </span>
      <span class="tile-name">${asset.name}</span>
      <span class="mini-chart" aria-hidden="true"><span class="bar-a"></span><span class="bar-b"></span><span class="bar-c"></span><span class="bar-d"></span></span>
      <span class="tile-metrics">
        <span>${formatCurrency(asset.price)}</span>
        <span class="${asset.changePercent >= 0 ? "positive" : "negative"}"><span class="trend-arrow ${arrow}"></span>${formatChange(asset.changePercent)}</span>
      </span>
      <span class="mini-score"><span style="width:${score.finalScore}%"></span></span>
      <span class="tile-score">${score.finalScore}/100 - ${score.label}</span>
    </a>
  `;
}

function wireSymbolSearch(formSelector, inputSelector, assets, hrefBase, helpText) {
  const form = document.querySelector(formSelector);
  const input = document.querySelector(inputSelector);
  const error = document.querySelector("[data-search-error]");
  if (!form || !input) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = normalizeSymbol(input.value);
    const exists = assets.some((asset) => asset.symbol === symbol);
    if (!symbol || !exists) {
      if (error) error.textContent = helpText;
      return;
    }
    window.location.href = `${hrefBase}?symbol=${encodeURIComponent(symbol)}`;
  });
}

function renderAssetDetail(asset, universe) {
  const score = buildTradeAlphaScore(asset);
  const technicalInsights = getTechnicalInsights(asset);
  const fundamentalInsights = asset.type === "etf" ? getEtfFundamentalInsights(asset) : getFundamentalInsights(asset);
  const related = universe.filter((item) => (asset.related || []).includes(item.symbol));

  setText("[data-asset-symbol]", asset.symbol);
  setText("[data-asset-name]", asset.name);
  setText("[data-asset-exchange]", `${asset.exchange} / ${localizedSector(asset)}`);
  setText("[data-asset-price]", formatCurrency(asset.price));
  setText("[data-asset-change]", formatChange(asset.changePercent));
  setText("[data-asset-market-cap]", asset.marketCap);
  setText("[data-asset-sector]", localizedSector(asset));
  setText("[data-asset-industry]", asset.industry);
  setText("[data-score-value]", score.finalScore);
  setText("[data-score-label]", score.label);
  setText("[data-score-disclaimer]", text(disclaimer, arDisclaimer));
  setGauge(score.finalScore);

  renderScoreBreakdown(score);
  renderMetricCards(asset);
  renderList("[data-technical-insights]", technicalInsights);
  renderList("[data-fundamental-insights]", fundamentalInsights);
  setText("[data-sentiment-summary]", getSentimentSummary(asset));
  setText("[data-ai-summary]", buildAiSummary(asset, score, technicalInsights, fundamentalInsights));
  renderRisks(asset, score);
  renderRelated(related);
  renderFaq(asset);
  injectFaqSchema(asset);
  injectBreadcrumbSchema(asset);
  renderTrustStrip(asset);
  renderContentDepth(asset);
  renderRecentlyViewed();
  renderDataStatus(asset.dataStatus || createMockStatus());
}

function renderEtfOnlySections(asset) {
  renderHoldingList("[data-etf-holdings]", asset.holdings || []);
  renderAllocation("[data-etf-allocation]", asset.allocation || {});
  setText("[data-etf-expense]", formatExpense(asset.expenseRatio));
  setText("[data-etf-category]", asset.category);
  setText("[data-etf-issuer]", asset.issuer);
  setText("[data-etf-volatility]", `${Math.round(asset.volatility * 100)}% ${text("estimated volatility", "تذبذب مقدر")}`);
}

function renderScoreBreakdown(score) {
  const target = document.querySelector("[data-score-breakdown]");
  if (!target) return;
  const items = [
    [text("Technical", "فني"), score.technical],
    [text("Fundamental", "أساسي"), score.fundamental],
    [text("Momentum", "زخم"), score.momentum],
    [text("Sentiment", "معنويات"), score.sentiment],
    [text("Risk", "مخاطر"), score.risk]
  ];

  target.innerHTML = items.map(([label, value]) => `
    <div class="score-row">
      <span>${label}</span>
      <strong>${value}</strong>
      <span class="score-track"><span style="width:${value}%"></span></span>
    </div>
  `).join("");
}

function renderMetricCards(asset) {
  const baseMetrics = [
    ["RSI", asset.rsi],
    ["MACD", capitalize(asset.macdTrend)],
    ["MA50", formatCurrency(asset.ma50)],
    ["MA200", formatCurrency(asset.ma200)],
    [text("Volume", "الحجم"), capitalize(asset.volumeTrend)],
    [text("Trend", "الاتجاه"), capitalize(asset.trendDirection || "neutral")]
  ];
  const extra = asset.type === "etf"
    ? [[text("Expense", "المصاريف"), formatExpense(asset.expenseRatio)], [text("Category", "الفئة"), researchField(asset, "category", asset.category)]]
    : [["P/E", asset.peRatio], [text("Revenue Growth", "نمو الإيرادات"), formatPercent(asset.revenueGrowth)]];

  const target = document.querySelector("[data-metric-cards]");
  if (!target) return;
  target.innerHTML = [...baseMetrics, ...extra].map(([label, value]) => `
    <div class="metric-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function buildAiSummary(asset, score, technicalInsights, fundamentalInsights) {
  const kind = asset.type === "etf" ? "ETF screening" : "stock screening";
  if (isArabicPage()) {
    const kindAr = asset.type === "etf" ? "فحص صندوق المؤشرات" : "فحص السهم";
    const overview = researchField(asset, "overview", asset.summary);
    const why = researchField(asset, "whyInvestorsFollow", "");
    return `يحصل ${asset.symbol} على درجة ${score.finalScore}/100 ضمن نموذج TradeAlpha ويظهر كتقييم بحثي من فئة ${score.label}. ${overview} ${why} هذا ملخص تعليمي ضمن ${kindAr} وليس توصية شراء أو بيع.`;
  }
  return `${asset.symbol} receives a ${score.finalScore}/100 TradeAlpha Score and screens as ${score.label}. ${asset.summary} ${technicalInsights[1]} ${fundamentalInsights[0]} This is an educational ${kind} summary, not a recommendation to buy or sell.`;
}

function renderRisks(asset, score) {
  const customRisks = researchList(asset, "riskFactors", []);
  const items = isArabicPage()
    ? [
      `ملف المخاطر: ${localizedRisk(asset.risk)}.`,
      `تقدير التقلب: ${Math.round(asset.volatility * 100)}%.`,
      ...customRisks.map((risk) => `عامل مخاطرة: ${risk}.`),
      `خصم عامل المخاطر ${score.riskPenalty} نقطة بحثية قبل الترجيح النهائي.`,
      arDisclaimer
    ]
    : [
      `Risk profile: ${capitalize(asset.risk)}.`,
      `Volatility estimate: ${Math.round(asset.volatility * 100)}%.`,
      `Trend direction: ${capitalize(asset.trendDirection || "neutral")}.`,
      ...customRisks.map((risk) => `Research risk: ${risk}.`),
      `Risk adjustment reduced the final score by ${score.riskPenalty} screening points before weighting.`,
      disclaimer
    ];
  renderList("[data-risk-list]", items);
}

function renderRelated(related) {
  const target = document.querySelector("[data-related-stocks], [data-related-etfs]");
  if (!target) return;
  target.innerHTML = related.map((asset) => `
    <a class="related-link" href="${assetHref(asset)}">
      <strong>${asset.symbol}</strong>
      <span>${asset.name}</span>
    </a>
  `).join("");
}

function renderFaq(asset) {
  const target = document.querySelector("[data-stock-faq], [data-etf-faq]");
  if (!target) return;
  target.innerHTML = buildSymbolFaq(asset).map((item, index) => `
    <details ${index === 0 ? "open" : ""}>
      <summary>${item.question}</summary>
      <p>${item.answer}</p>
    </details>
  `).join("");
}

function injectFaqSchema(asset) {
  const faq = buildSymbolFaq(asset);
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer }
    }))
  };
  injectJsonLd(`faq-${asset.symbol}`, schema);
}

function injectBreadcrumbSchema(asset) {
  const page = asset.type === "etf" ? "etfs.html" : "stocks.html";
  const label = asset.type === "etf" ? "ETFs" : "Stocks";
  const detail = asset.type === "etf" ? "etf.html" : "stock.html";
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "TradeAlphaAI", item: "https://www.tradealphaai.com/" },
      { "@type": "ListItem", position: 2, name: label, item: `https://www.tradealphaai.com/${page}` },
      { "@type": "ListItem", position: 3, name: asset.symbol, item: `https://www.tradealphaai.com/${detail}?symbol=${asset.symbol}` }
    ]
  };
  injectJsonLd(`breadcrumb-${asset.symbol}`, schema);
}

function injectJsonLd(id, schema) {
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement("script");
    node.type = "application/ld+json";
    node.id = id;
    document.head.appendChild(node);
  }
  node.textContent = JSON.stringify(schema);
}

function renderTrustStrip(asset) {
  const target = document.querySelector("[data-trust-strip]");
  if (!target) return;
  target.innerHTML = [
    [text("Updated recently", "تحديث حديث"), text("Static refresh", "تحديث ثابت")],
    [text("Research Desk", "مكتب الأبحاث"), "TradeAlphaAI"],
    [text("Educational only", "تعليمي فقط"), text("No advice", "دون نصيحة")],
    [text("Market focus", "محور متابعة"), asset.symbol]
  ].map(([label, value]) => `
    <div class="trust-pill">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderContentDepth(asset) {
  const target = document.querySelector("[data-content-depth]");
  if (!target) return;
  const content = getSymbolContent(asset.symbol, asset);
  if (asset.research) {
    const primary = asset.type === "etf" ? researchField(asset, "etfMethodology", "") : researchField(asset, "businessModel", "");
    const bull = researchList(asset, "bullCase", []);
    const bear = researchList(asset, "bearCase", []);
    target.innerHTML = `
      <span class="eyebrow">${text("Research Framework", "إطار البحث")}</span>
      <h2>${text(`Why investors watch ${asset.symbol}`, `لماذا يتابع المستثمرون ${asset.symbol}`)}</h2>
      <p class="market-copy">${researchField(asset, "whyInvestorsFollow", content.whyWatch)}</p>
      <p class="market-copy">${primary}</p>
      <div class="analyzer-brief-grid">
        <div>
          <h3>${text("Positive research factors", "عوامل بحثية داعمة")}</h3>
          <ul class="insight-list">${bull.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
        <div>
          <h3>${text("Risk factors", "عوامل المخاطر")}</h3>
          <ul class="risk-list">${bear.map((item) => `<li>${item}</li>`).join("")}</ul>
        </div>
      </div>
    `;
    return;
  }
  target.innerHTML = isArabicPage() ? `
    <h2>لماذا يتابع المستثمرون ${asset.symbol}</h2>
    <p class="market-copy">${content.whyWatch}</p>
    <h2>تأثير الاقتصاد الكلي والتذبذب</h2>
    <p class="market-copy">${content.macro}</p>
    <p class="market-copy">${content.volatility}</p>
  ` : `
    <h2>Why investors watch ${asset.symbol}</h2>
    <p class="market-copy">${content.whyWatch}</p>
    <h2>Macro impact and volatility</h2>
    <p class="market-copy">${content.macro}</p>
    <p class="market-copy">${content.volatility}</p>
  `;
}

function renderStaticSeoContent(asset) {
  const target = document.querySelector("[data-static-symbol-content]");
  if (!target) return;
  const content = getSymbolContent(asset.symbol, asset);
  if (isArabicPage()) {
    target.innerHTML = `
      <span class="eyebrow">أبحاث الرمز المخصصة</span>
      <h2>نظرة عامة على التحليل التعليمي لـ ${asset.symbol}</h2>
      <p class="market-copy">${content.intro}</p>
      <div class="content-columns">
        <div>
          <h3>نظرة عامة على معنويات السوق</h3>
          <p class="market-copy">${asset.analystSentiment || "تتم مراجعة معنويات السوق من خلال سياق تعليمي قائم على قواعد."}</p>
        </div>
        <div>
          <h3>حساسية الأرباح</h3>
          <p class="market-copy">${asset.earningsSentiment || "تتم مراجعة حساسية الأرباح كسياق تعليمي فقط."}</p>
        </div>
      </div>
    `;
    return;
  }
  target.innerHTML = `
    <span class="eyebrow">Dedicated Symbol Research</span>
    <h2>${asset.symbol} educational analysis overview</h2>
    <p class="market-copy">${content.intro}</p>
    <div class="content-columns">
      <div>
        <h3>Market sentiment overview</h3>
        <p class="market-copy">${asset.analystSentiment || "Market sentiment is reviewed through mock rule-based context."}</p>
      </div>
      <div>
        <h3>Earnings sensitivity</h3>
        <p class="market-copy">${asset.earningsSentiment || "Earnings sensitivity is reviewed as educational context only."}</p>
      </div>
    </div>
  `;
}

function renderHubSections(hub) {
  const target = document.querySelector("[data-hub-sections]");
  if (!target) return;
  target.innerHTML = hub.sections.map(([title, body]) => `
    <article class="market-card method-card">
      <h2>${title}</h2>
      <p>${body}</p>
    </article>
  `).join("");
}

function rememberViewed(asset) {
  try {
    const key = "ta_recent_symbols";
    const current = JSON.parse(localStorage.getItem(key) || "[]");
    const next = [{ symbol: asset.symbol, name: asset.name, type: asset.type }, ...current.filter((item) => item.symbol !== asset.symbol)].slice(0, 6);
    localStorage.setItem(key, JSON.stringify(next));
  } catch (_) {}
}

function renderRecentlyViewed() {
  const target = document.querySelector("[data-recently-viewed]");
  if (!target) return;
  let items = [];
  try {
    items = JSON.parse(localStorage.getItem("ta_recent_symbols") || "[]");
  } catch (_) {}
  target.innerHTML = items.length
    ? items.map((item) => `<a class="compact-card" href="${item.type === "etf" ? "etf.html" : "stock.html"}?symbol=${item.symbol}"><strong>${item.symbol}</strong><small>${item.name}</small></a>`).join("")
    : `<p class="market-copy">${text("Open a stock or ETF analysis page to build a local recently viewed list.", "افتح صفحة تحليل سهم أو صندوق مؤشرات لبناء قائمة المشاهدة الأخيرة.")}</p>`;
}

function renderHoldingList(selector, holdings) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = holdings.map((holding) => `<li>${holding}</li>`).join("");
}

function renderAllocation(selector, allocation) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = Object.entries(allocation).map(([label, value]) => `
    <div class="allocation-row">
      <span>${capitalize(label)}</span>
      <strong>${value}%</strong>
      <span class="score-track"><span style="width:${value}%"></span></span>
    </div>
  `).join("");
}

function renderComparison(selector, etfs) {
  const target = document.querySelector(selector);
  if (!target) return;
  const spy = etfs.find((asset) => asset.symbol === "SPY");
  const qqq = etfs.find((asset) => asset.symbol === "QQQ");
  if (!spy || !qqq) return;
  target.innerHTML = isArabicPage() ? `
    <h2>كيف يقارن SPY بـ QQQ</h2>
    <p class="market-copy">يُصنَّف SPY كتعرض أوسع لأسهم الشركات الكبرى الأمريكية، بينما يُصنَّف QQQ كصندوق أكثر توجهاً نحو النمو والتكنولوجيا. في هذا النموذج التعليمي، يتمتع QQQ بزخم أعلى وتذبذب أكبر، بينما يوفر SPY تنويعاً أوسع.</p>
  ` : `
    <h2>How SPY compares to QQQ</h2>
    <p class="market-copy">SPY screens as broader U.S. large-cap exposure, while QQQ screens as a more growth- and technology-tilted ETF. In this mock model, QQQ has higher momentum and higher volatility, while SPY has broader diversification.</p>
  `;
}

function renderScreenerFacets(assets) {
  fillSelect("[data-filter-type]", unique(assets.map((asset) => asset.type)), text("All assets", "كل الأصول"));
  fillSelect("[data-filter-risk]", unique(assets.map((asset) => asset.risk)), text("All risk", "كل مستويات المخاطر"));
  fillSelect("[data-filter-sector]", unique(assets.map((asset) => localizedSector(asset))), text("All sectors", "كل القطاعات"));
  fillSelect("[data-filter-category]", unique(assets.map((asset) => researchField(asset, "category", asset.category || asset.sector))), text("All ETF categories", "كل فئات الصناديق"));
  fillSelect("[data-filter-sentiment]", unique(assets.map((asset) => asset.sentiment)), text("All sentiment", "كل المعنويات"));
}

function renderScreenerSections(assets) {
  renderScreenerStrip("[data-top-picks]", assets.filter((asset) => buildTradeAlphaScore(asset).finalScore >= 65).slice(0, 4));
  renderScreenerStrip("[data-momentum-leaders]", [...assets].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4));
  renderScreenerStrip("[data-trending-etfs]", assets.filter((asset) => asset.type === "etf").slice(0, 5));
  renderScreenerStrip("[data-semiconductors]", assets.filter((asset) => asset.industry === "Semiconductors" || asset.symbol === "QQQ"));
  renderDataStatus(createMockStatus(), "[data-screener-status]");
}

function renderScreenerStrip(selector, assets) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = assets.map((asset) => renderCompactCard(asset)).join("");
}

function renderCompactCard(asset) {
  const score = buildTradeAlphaScore(asset);
  return `
    <a class="compact-card" href="${asset.type === "etf" ? "etf.html" : "stock.html"}?symbol=${asset.symbol}">
      <strong>${asset.symbol}</strong>
      <span>${score.finalScore}/100</span>
      <small>${score.label}</small>
    </a>
  `;
}

function renderScreenerResults(assets, state) {
  const target = document.querySelector("[data-screener-results]");
  if (!target) return;
  let rows = assets.map((asset) => ({ asset, score: buildTradeAlphaScore(asset) }));

  rows = rows.filter(({ asset, score }) => {
    const matchesQuery = !state.query || asset.symbol.includes(state.query) || asset.name.toUpperCase().includes(state.query);
    const matchesType = state.type === "all" || asset.type === state.type;
    const matchesScore = score.finalScore >= state.minScore;
    const matchesRisk = state.risk === "all" || asset.risk === state.risk;
    const sector = localizedSector(asset);
    const category = researchField(asset, "category", asset.category || asset.sector);
    const matchesSector = state.sector === "all" || sector === state.sector;
    const matchesCategory = state.category === "all" || category === state.category || sector === state.category;
    const matchesSentiment = state.sentiment === "all" || asset.sentiment === state.sentiment;
    return matchesQuery && matchesType && matchesScore && matchesRisk && matchesSector && matchesCategory && matchesSentiment;
  });

  rows.sort((a, b) => {
    if (state.sort === "momentum") return b.score.momentum - a.score.momentum;
    if (state.sort === "risk") return b.score.risk - a.score.risk;
    if (state.sort === "symbol") return a.asset.symbol.localeCompare(b.asset.symbol);
    return b.score.finalScore - a.score.finalScore;
  });

  target.innerHTML = rows.map(({ asset, score }) => `
    <a class="screener-row" href="${assetHref(asset)}">
      <span><strong>${asset.symbol}</strong><small>${asset.name}</small></span>
      <span>${asset.type === "etf" ? text("ETF", "صندوق") : text("STOCK", "سهم")}</span>
      <span>${localizedSector(asset)}</span>
      <span>${score.momentum}</span>
      <span>${localizedRisk(asset.risk)}</span>
      <span class="setup-badge">${score.finalScore} - ${score.label}</span>
    </a>
  `).join("") || `<div class="market-card empty-state"><h2>${text("No matching screening candidates", "لا توجد نتائج مطابقة")}</h2><p>${text("Adjust the filters to broaden the educational screening view.", "عدّل المرشحات لتوسيع نطاق الفحص التعليمي.")}</p></div>`;
}

function getEtfFundamentalInsights(asset) {
  if (isArabicPage()) {
    return [
      `نسبة المصاريف: ${formatExpense(asset.expenseRatio)}.`,
      `الفئة: ${asset.category}.`,
      `أبرز المكونات: ${(asset.holdings || []).slice(0, 3).join("، ")}.`,
      `يتنوع التعرض القطاعي عبر ${Object.keys(asset.allocation || {}).length} مجموعة توزيع.`
    ];
  }
  return [
    `Expense ratio screens at ${formatExpense(asset.expenseRatio)}.`,
    `Category: ${asset.category}.`,
    `Top exposure includes ${(asset.holdings || []).slice(0, 3).join(", ")}.`,
    `Sector exposure is diversified across ${Object.keys(asset.allocation || {}).length} allocation groups.`
  ];
}

function renderMissingAsset(symbol, type, backHref, helpText) {
  const shell = document.querySelector("[data-stock-detail-shell], [data-etf-detail-shell]");
  if (!shell) return;
  const eyebrow = text("Symbol not available", "الرمز غير متاح");
  const heading = isArabicPage()
    ? `${symbol || "غير معروف"} غير موجود في قاعدة البيانات الحالية`
    : `${symbol || "Unknown"} is not in the Phase 2 mock ${type} dataset`;
  const back = text("Back to analyzer", "العودة إلى المحلل");
  shell.innerHTML = `
    <section class="market-section">
      <div class="market-card empty-state">
        <span class="eyebrow">${eyebrow}</span>
        <h1>${heading}</h1>
        <p>${helpText}</p>
        <a class="market-btn primary" href="${backHref}">${back}</a>
      </div>
    </section>
  `;
}

function renderDataStatus(metadata, selector = "[data-data-status]") {
  const target = document.querySelector(selector);
  if (!target) return;
  const status = normalizeDataStatus(metadata);
  const summaryLabel = text("What does this data status mean?", "ماذا تعني حالة البيانات هذه؟");
  const providerLine = isArabicPage()
    ? `المزود: ${status.providerName}. آخر تحديث: ${formatDateTime(status.timestamp)}. التخزين المؤقت: ${status.cacheStatus}. تنتهي: ${formatDateTime(status.expiresAt)}. المصدر: ${status.attribution}.`
    : `Provider: ${status.providerName}. Updated: ${formatDateTime(status.timestamp)}. Cache: ${status.cacheStatus}. Expires: ${formatDateTime(status.expiresAt)}. Attribution: ${status.attribution}.`;
  const disclaimerLine = text(disclaimer, arDisclaimer);
  target.innerHTML = `
    <div class="data-status-card ${status.className}">
      <div class="data-status-top">
        <span class="data-status-dot" aria-hidden="true"></span>
        <strong>${status.label}</strong>
        <span>${status.confidenceLevel}</span>
      </div>
      <p>${status.shortDescription}</p>
      <details>
        <summary>${summaryLabel}</summary>
        <p>${status.explanation}</p>
        <p>${providerLine}</p>
        <p>${disclaimerLine}</p>
      </details>
    </div>
  `;
}

export async function initDiagnosticsPage() {
  const configured = typeof window !== "undefined" ? window.TRADEALPHA_MARKET_PROVIDER || "mock" : "mock";
  setText("[data-provider-mode]", configured);
  setText("[data-last-checked]", new Date().toLocaleString());
  renderDataStatus(createMockStatus(configured), "[data-diagnostics-status]");
  wireDiagnosticsRefresh();
  await refreshProviderDiagnostics();
}

function wireDiagnosticsRefresh() {
  const button = document.querySelector("[data-refresh-diagnostics]");
  if (!button) return;
  button.addEventListener("click", () => refreshProviderDiagnostics());
}

async function refreshProviderDiagnostics() {
  setText("[data-last-checked]", new Date().toLocaleString());
  const endpointTarget = document.querySelector("[data-endpoint-status]");
  const healthTarget = document.querySelector("[data-provider-health]");
  if (!endpointTarget) return;
  try {
    const response = await fetch("/api/market-data?symbol=NVDA&type=stock", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Endpoint returned ${response.status}`);
    const payload = await response.json();
    const status = normalizeDataStatus(payload.metadata || {});
    const latencyMs = payload.metadata && payload.metadata.latencyMs != null ? payload.metadata.latencyMs : null;
    const latencyLabel = latencyMs !== null ? ` &mdash; ${latencyMs} ms` : "";
    endpointTarget.innerHTML = `<span class="setup-badge ${status.className}">${status.label}${latencyLabel}</span><p class="market-copy">Serverless endpoint responded. Provider: <strong>${payload.provider || status.providerName}</strong>. Attribution: ${status.attribution}.</p>`;
    renderDataStatus(status, "[data-diagnostics-status]");
    renderProviderMetrics(payload);
    renderProviderWarning(payload);
  } catch (error) {
    endpointTarget.innerHTML = `<span class="setup-badge status-unavailable">Serverless unavailable</span><p class="market-copy">Static mode is active or Netlify Functions are not running. The portal remains usable with local mock fallback.</p>`;
    clearProviderMetrics();
  }

  if (!healthTarget) return;
  try {
    const response = await fetch("/.netlify/functions/market-health", { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Health endpoint returned ${response.status}`);
    const payload = await response.json();
    renderProviderHealthTable(normalizeProviderHealthList(payload.providers || []), payload.cacheSimulation, payload.finnhubIntegration);
  } catch (error) {
    healthTarget.innerHTML = `<div class="market-card empty-state"><h2>Health endpoint unavailable</h2><p>Run Netlify dev to test serverless diagnostics. Static mock data remains available.</p></div>`;
  }
}

function renderProviderMetrics(payload) {
  const target = document.querySelector("[data-provider-metrics]");
  if (!target) return;
  const meta = payload.metadata || {};
  const stats = meta.stats || {};
  const latency = meta.latencyMs != null ? `${meta.latencyMs} ms` : "--";
  const lastUpdated = meta.updatedAt ? new Date(meta.updatedAt).toLocaleTimeString() : "--";
  const cacheStatus = meta.cacheStatus || "--";
  const liveCount = stats.liveRequests != null ? stats.liveRequests : "--";
  const fallbackCount = stats.fallbackRequests != null ? stats.fallbackRequests : "--";
  const lastSuccess = stats.lastSuccessAt ? new Date(stats.lastSuccessAt).toLocaleTimeString() : "--";
  target.innerHTML = `
    <div class="metric-grid">
      <div class="metric-card"><span>Data Mode</span><strong>${meta.status || "--"}</strong></div>
      <div class="metric-card"><span>Provider</span><strong>${payload.provider || "--"}</strong></div>
      <div class="metric-card"><span>Latency</span><strong>${latency}</strong></div>
      <div class="metric-card"><span>Cache Status</span><strong>${cacheStatus}</strong></div>
      <div class="metric-card"><span>Last Updated</span><strong>${lastUpdated}</strong></div>
      <div class="metric-card"><span>Live Requests (session)</span><strong>${liveCount}</strong></div>
      <div class="metric-card"><span>Fallback Requests (session)</span><strong>${fallbackCount}</strong></div>
      <div class="metric-card"><span>Last Successful Live</span><strong>${lastSuccess}</strong></div>
    </div>
  `;
}

function renderProviderWarning(payload) {
  const target = document.querySelector("[data-provider-warning]");
  if (!target) return;
  const warning = (payload.metadata && payload.metadata.warning) || payload.warning || "";
  if (warning) {
    target.innerHTML = `<div class="provider-warning-banner"><strong>Provider notice:</strong> ${warning}</div>`;
  } else {
    target.innerHTML = "";
  }
}

function clearProviderMetrics() {
  const target = document.querySelector("[data-provider-metrics]");
  if (target) target.innerHTML = `<p class="market-copy">Serverless endpoint not available. Static mock mode is active.</p>`;
}

function renderProviderHealthTable(providers, cacheSimulation, finnhubIntegration) {
  const target = document.querySelector("[data-provider-health]");
  if (!target) return;
  const rows = providers.map((provider) => {
    const implBadge = provider.implementationStatus === "live"
      ? `<span class="impl-badge impl-live">Live</span>`
      : provider.implementationStatus === "stub"
      ? `<span class="impl-badge impl-stub">Stub</span>`
      : `<span class="impl-badge impl-fallback">Fallback</span>`;
    return `
    <div class="health-row">
      <span><strong>${provider.providerName}</strong>${implBadge}<small>${provider.message}</small></span>
      <span class="health-badge ${provider.className}">${provider.label}</span>
      <span>${provider.latencyMs === null ? "--" : `${provider.latencyMs} ms`}</span>
      <span>${provider.keyConfigured ? "Yes" : "No"}</span>
      <span>${provider.fallbackAvailable ? "Yes" : "No"}</span>
      <span>${provider.cacheTtlSeconds}s</span>
      <span>${formatDateTime(provider.lastChecked)}</span>
    </div>
  `;
  }).join("");
  const cache = cacheSimulation
    ? `<p class="market-copy">Cache simulation: ${cacheSimulation.cacheStatus}; stale after ${cacheSimulation.staleAfterSeconds}s; expires ${formatDateTime(cacheSimulation.expiresAt)}; served from cache: ${cacheSimulation.servedFromCache ? "yes" : "no"}.</p>`
    : "";
  const finnhubNote = finnhubIntegration
    ? `<p class="market-copy">Finnhub integration: ${finnhubIntegration.implementationStatus}. Key configured: ${finnhubIntegration.keyConfigured ? "yes" : "no"}. Cache TTL: ${finnhubIntegration.cacheTtlMs / 1000}s. Timeout: ${finnhubIntegration.timeoutMs / 1000}s. ${finnhubIntegration.rateLimitNote || ""}</p>`
    : "";
  target.innerHTML = `
    <div class="health-table">
      <div class="health-row health-head"><span>Provider</span><span>Status</span><span>Latency</span><span>Key</span><span>Fallback</span><span>TTL</span><span>Last checked</span></div>
      ${rows}
    </div>
    ${cache}
    ${finnhubNote}
  `;
}

function getSymbolFromUrl(fallback) {
  const params = new URLSearchParams(window.location.search);
  return normalizeSymbol(params.get("symbol") || fallback);
}

function fillSelect(selector, values, firstLabel) {
  const select = document.querySelector(selector);
  if (!select) return;
  select.innerHTML = `<option value="all">${firstLabel}</option>` + values.map((value) => `<option value="${value}">${localizedFacetValue(value)}</option>`).join("");
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function setGauge(value) {
  const node = document.querySelector("[data-score-gauge]");
  if (node) node.style.setProperty("--score", `${value * 3.6}deg`);
}

function renderList(selector, items) {
  const target = document.querySelector(selector);
  if (!target) return;
  target.innerHTML = items.map((item) => `<li>${item}</li>`).join("");
}

function getValue(selector) {
  const node = document.querySelector(selector);
  return node ? node.value : "";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function formatCurrency(value) {
  return `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatChange(value) {
  const prefix = value >= 0 ? "+" : "";
  return `${prefix}${Number(value).toFixed(2)}%`;
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
}

function formatExpense(value) {
  return `${(Number(value) * 100).toFixed(2)}%`;
}

function capitalize(value) {
  return String(value).replace(/([A-Z])/g, " $1").replace(/\b\w/g, (letter) => letter.toUpperCase()).trim();
}
