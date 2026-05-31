export function applyStockListSeo() {
  setTitle("AI Stock Analyzer | Free Stock Screening Tool | TradeAlphaAI");
  setMeta("description", "Use the free TradeAlphaAI AI Stock Analyzer for educational stock screening, technical scores, risk overview, and watchlist candidate research.");
  setCanonical("https://www.tradealphaai.com/stocks.html");
  setOg({
    title: "AI Stock Analyzer | TradeAlphaAI",
    description: "Free educational stock screening with research summaries, technical scores, and risk overview.",
    url: "https://www.tradealphaai.com/stocks.html"
  });
}

export function applyStockDetailSeo(asset) {
  const title = asset
    ? `${asset.symbol} AI Stock Analysis | TradeAlpha Score | TradeAlphaAI`
    : "AI Stock Analysis | TradeAlphaAI";
  const description = asset
    ? `${asset.symbol} stock analysis for educational screening, including technical score, fundamental score, sentiment overview, and risk factors.`
    : "Educational AI stock analysis with TradeAlpha Score, technical overview, fundamentals, sentiment, and risk context.";
  const url = asset
    ? `https://www.tradealphaai.com/stocks/${String(asset.symbol).toLowerCase()}.html`
    : "https://www.tradealphaai.com/stock.html";

  setTitle(title);
  setMeta("description", description);
  setCanonical(url);
  setOg({ title, description, url });
}

export function applyEtfListSeo() {
  setTitle("AI ETF Analyzer | Free ETF Screening Tool | TradeAlphaAI");
  setMeta("description", "Screen ETFs with educational research analysis, expense ratio context, top holdings, sector exposure, technical scores, and risk overview.");
  setCanonical("https://www.tradealphaai.com/etfs.html");
  setOg({
    title: "AI ETF Analyzer | TradeAlphaAI",
    description: "Free ETF screening with TradeAlpha Score, allocation context, technical analysis, and educational risk overview.",
    url: "https://www.tradealphaai.com/etfs.html"
  });
}

export function applyEtfDetailSeo(asset) {
  const title = asset
    ? `${asset.symbol} AI ETF Analysis | Holdings, Expense Ratio, Risk | TradeAlphaAI`
    : "AI ETF Analysis | TradeAlphaAI";
  const description = asset
    ? `${asset.symbol} ETF analysis for educational screening, including expense ratio, holdings, sector exposure, technical score, and risk overview.`
    : "Educational AI ETF analysis with holdings, sector exposure, technical score, risk context, and TradeAlpha Score.";
  const url = asset
    ? `https://www.tradealphaai.com/etfs/${String(asset.symbol).toLowerCase()}.html`
    : "https://www.tradealphaai.com/etf.html";

  setTitle(title);
  setMeta("description", description);
  setCanonical(url);
  setOg({ title, description, url });
}

export function applyScreenerSeo() {
  setTitle("AI Stock Screener & ETF Screener | TradeAlphaAI");
  setMeta("description", "Use the free TradeAlphaAI market screener to filter stocks and ETFs by score, momentum, risk, sector, sentiment, and watchlist setup labels.");
  setCanonical("https://www.tradealphaai.com/ai-stock-screener.html");
  setOg({
    title: "AI Stock Screener & ETF Screener | TradeAlphaAI",
    description: "Filter stocks and ETFs by TradeAlpha Score, momentum, risk, sector, sentiment, and educational watchlist labels.",
    url: "https://www.tradealphaai.com/ai-stock-screener.html"
  });
}

function setTitle(value) {
  document.title = value;
  setMetaProperty("og:title", value);
  setMeta("twitter:title", value);
}

function setMeta(name, value) {
  const node = ensureMeta(`[name="${name}"]`, "name", name);
  node.setAttribute("content", value);
}

function setMetaProperty(property, value) {
  const node = ensureMeta(`[property="${property}"]`, "property", property);
  node.setAttribute("content", value);
}

function setCanonical(url) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  link.setAttribute("href", url);
}

function setOg({ title, description, url }) {
  setMetaProperty("og:title", title);
  setMetaProperty("og:description", description);
  setMetaProperty("og:url", url);
  setMetaProperty("og:type", "website");
  setMeta("twitter:description", description);
}

function ensureMeta(selector, attribute, value) {
  let node = document.querySelector(selector);
  if (!node) {
    node = document.createElement("meta");
    node.setAttribute(attribute, value);
    document.head.appendChild(node);
  }
  return node;
}
