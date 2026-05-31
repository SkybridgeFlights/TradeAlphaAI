#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";
const template = readFile(path.join(root, "templates", "compare-page-template.html"));
const config = readJson(path.join(root, "data", "market-symbols.json"));
const assets = loadAssets();
const bySymbol = new Map(assets.map((asset) => [asset.symbol, asset]));

const stockPairs = controlledPairs("stock", 30);
const etfPairs = controlledPairs("etf", 15);
const pairs = [...stockPairs, ...etfPairs];
const urls = [];
const arUrls = [];
let generated = 0;

for (const pair of pairs) {
  const left = bySymbol.get(pair.left);
  const right = bySymbol.get(pair.right);
  if (!left || !right) {
    throw new Error(`Comparison pair missing research asset: ${pair.left} vs ${pair.right}`);
  }
  for (const locale of ["en", "ar"]) {
    const html = renderComparison(pair, left, right, locale);
    const out = locale === "ar"
      ? path.join(root, "ar", pair.pagePath)
      : path.join(root, pair.pagePath);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, html, "utf8");
    generated += 1;
  }
  urls.push(`${domain}/${pair.pagePath}`);
  arUrls.push(`${domain}/ar/${pair.pagePath}`);
}

mergeSitemap(path.join(root, "sitemap-market.xml"), urls);
mergeSitemap(path.join(root, "sitemap-ar.xml"), arUrls);

console.log(`Comparison page generation complete.`);
console.log(`Stock comparisons: ${stockPairs.length} (${stockPairs.length * 2} EN/AR pages)`);
console.log(`ETF comparisons: ${etfPairs.length} (${etfPairs.length * 2} EN/AR pages)`);
console.log(`Generated files: ${generated}`);

function controlledPairs(type, limit) {
  const configured = (config.comparisons || []).filter((item) => item.type === type).slice(0, limit);
  const source = configured.length ? configured : defaultPairs(type).slice(0, limit);
  return source.map((item) => ({
    type,
    left: item.left,
    right: item.right,
    hub: item.hub || defaultHub(type),
    pagePath: item.pagePath || `compare/${slug(item.left)}-vs-${slug(item.right)}.html`
  }));
}

function renderComparison(pair, left, right, locale) {
  const isAr = locale === "ar";
  const enPath = pair.pagePath;
  const arPath = `ar/${pair.pagePath}`;
  const leftPage = pagePathFor(left, isAr);
  const rightPage = pagePathFor(right, isAr);
  const hubPath = hubPathFor(pair.hub, isAr);
  const typeLabel = pair.type === "etf" ? t(isAr, "ETF comparison", "مقارنة صناديق المؤشرات") : t(isAr, "Stock comparison", "مقارنة الأسهم");
  const title = isAr
    ? `مقارنة ${left.symbol} و ${right.symbol} | TradeAlphaAI`
    : `${left.symbol} vs ${right.symbol} Comparison | TradeAlphaAI`;
  const description = isAr
    ? `مقارنة تعليمية بين ${left.symbol} و ${right.symbol} باستخدام أصول البحث الحالية، وسياق السعر المباشر، والروابط الداخلية في TradeAlphaAI.`
    : `Educational ${left.symbol} vs ${right.symbol} comparison using current research assets, live price hooks, score context, and TradeAlphaAI internal research links.`;
  const rows = comparisonRows(left, right, isAr).map(([label, l, r]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(l)}</td><td>${escapeHtml(r)}</td></tr>`).join("");
  const leftSummary = localized(left, "overview", isAr);
  const rightSummary = localized(right, "overview", isAr);
  const values = {
    LANG: isAr ? "ar" : "en",
    DIR: isAr ? "rtl" : "ltr",
    BODY_CLASS: isAr ? "localized-page localized-ar" : "",
    DOMAIN: domain,
    ASSET_PREFIX: "/",
    NAV_PREFIX: isAr ? "/ar/" : "/",
    COMPARISON_KEY: `${left.symbol}-${right.symbol}`.toLowerCase(),
    SEO_TITLE: title,
    SEO_DESCRIPTION: description,
    CANONICAL_URL: `${domain}/${isAr ? arPath : enPath}`,
    EN_URL: `${domain}/${enPath}`,
    AR_URL: `${domain}/${arPath}`,
    OG_ALT: isAr ? `معاينة مقارنة ${left.symbol} و ${right.symbol}` : `TradeAlphaAI ${left.symbol} vs ${right.symbol} comparison preview`,
    BRAND_SUBTITLE: t(isAr, "Research Platform", "منصة الأبحاث"),
    PRIMARY_LABEL: t(isAr, "Primary", "التنقل الرئيسي"),
    NAV_HOME: t(isAr, "Home", "الرئيسية"),
    NAV_STOCKS: t(isAr, "AI Stock Analyzer", "محلل الأسهم"),
    NAV_ETFS: t(isAr, "ETF Analyzer", "محلل الصناديق"),
    NAV_SCREENER: t(isAr, "Market Screener", "ماسح السوق"),
    NAV_ARTICLES: t(isAr, "Articles", "المقالات"),
    NAV_METHODOLOGY: t(isAr, "Methodology", "المنهجية"),
    RANKINGS_LABEL: t(isAr, "Rankings", "التصنيفات"),
    EYEBROW: t(isAr, "Comparison Engine", "محرك المقارنة"),
    H1: isAr ? `مقارنة ${left.symbol} و ${right.symbol}` : `${left.symbol} vs ${right.symbol}`,
    INTRO: isAr
      ? `تجمع هذه الصفحة بين ملفات ${left.symbol} و ${right.symbol} البحثية للمقارنة التعليمية، وليست توصية شراء أو بيع.`
      : `This page compares ${left.symbol} and ${right.symbol} through educational research context, not as a buy or sell recommendation.`,
    LEFT_SYMBOL: left.symbol,
    RIGHT_SYMBOL: right.symbol,
    TYPE_LABEL: typeLabel,
    LIVE_TITLE: t(isAr, "Live price hooks", "ربط السعر المباشر"),
    LIVE_COPY: t(isAr, "Prices update from the serverless market-data endpoint when available.", "يتم تحديث الأسعار من نقطة بيانات السوق الخادمية عند توفرها."),
    PRICE_PLACEHOLDER: t(isAr, "Loading price", "تحميل السعر"),
    CHANGE_PLACEHOLDER: t(isAr, "Loading", "تحميل"),
    TABLE_EYEBROW: t(isAr, "Comparison Table", "جدول المقارنة"),
    TABLE_TITLE: isAr ? `ملخص ${left.symbol} مقابل ${right.symbol}` : `${left.symbol} vs ${right.symbol} quick comparison`,
    METRIC_LABEL: t(isAr, "Metric", "المعيار"),
    TABLE_ROWS: rows,
    LEFT_EYEBROW: left.symbol,
    RIGHT_EYEBROW: right.symbol,
    LEFT_TITLE: left.name,
    RIGHT_TITLE: right.name,
    LEFT_OVERVIEW: leftSummary,
    RIGHT_OVERVIEW: rightSummary,
    LEFT_LIST: listHtml(localizedList(left, "bullCase", isAr).slice(0, 3)),
    RIGHT_LIST: listHtml(localizedList(right, "bullCase", isAr).slice(0, 3)),
    PATHS_EYEBROW: t(isAr, "Related research paths", "مسارات بحث مرتبطة"),
    PATHS_TITLE: t(isAr, "Continue comparison research", "تابع بحث المقارنة"),
    CTA_LINKS: ctaLinks([
      [left.symbol, leftPage, true],
      [right.symbol, rightPage, true],
      [t(isAr, "Rankings", "التصنيفات"), isAr ? "/ar/rankings.html" : "/rankings.html", false],
      [t(isAr, "Market Screener", "ماسح السوق"), isAr ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html", false],
      [hubLabel(pair.hub, isAr), hubPath, false]
    ]),
    FAQ_LABEL: t(isAr, "FAQ", "الأسئلة الشائعة"),
    FAQ_TITLE: isAr ? `أسئلة عن ${left.symbol} و ${right.symbol}` : `${left.symbol} vs ${right.symbol} FAQ`,
    FAQ_HTML: faqHtml(left, right, isAr),
    LIVE_ITEMS_JSON: JSON.stringify([{ symbol: left.symbol, type: left.type }, { symbol: right.symbol, type: right.type }]),
    SCHEMA_JSON: schemaScript(pair, left, right, isAr, title, description)
  };
  return renderTemplate(template, values);
}

function comparisonRows(left, right, isAr) {
  return [
    [t(isAr, "Name", "الاسم"), left.name, right.name],
    [t(isAr, "Type", "النوع"), typeName(left, isAr), typeName(right, isAr)],
    [t(isAr, "Sector or category", "القطاع أو الفئة"), localized(left, left.type === "etf" ? "category" : "sector", isAr), localized(right, right.type === "etf" ? "category" : "sector", isAr)],
    [t(isAr, "Primary themes", "المحاور الرئيسية"), localizedList(left, "themes", isAr).slice(0, 3).join(", "), localizedList(right, "themes", isAr).slice(0, 3).join(", ")],
    [t(isAr, "Research angle", "زاوية البحث"), localized(left, "whyInvestorsFollow", isAr), localized(right, "whyInvestorsFollow", isAr)],
    [t(isAr, "Risk factors", "عوامل المخاطر"), localizedList(left, "riskFactors", isAr).slice(0, 3).join(", "), localizedList(right, "riskFactors", isAr).slice(0, 3).join(", ")],
    [t(isAr, "Valuation context", "سياق التقييم"), localized(left, "valuationContext", isAr), localized(right, "valuationContext", isAr)]
  ];
}

function faqHtml(left, right, isAr) {
  const items = isAr ? [
    [`هل مقارنة ${left.symbol} و ${right.symbol} نصيحة مالية؟`, "لا. هذه الصفحة لأغراض تعليمية ومعلوماتية فقط ولا تقدم نصيحة مالية أو استثمارية."],
    [`كيف يجب استخدام مقارنة ${left.symbol} و ${right.symbol}؟`, "استخدمها لمراجعة الاختلافات في المحاور والمخاطر والسياق البحثي قبل الرجوع إلى صفحات الأصول والمنهجية."],
    ["هل تستخدم الصفحة بيانات مباشرة؟", "تحاول الصفحة تحديث السعر من نقطة /api/market-data عند توفرها، مع بقاء المحتوى الأساسي ثابتا وتعليميا."]
  ] : [
    [`Is the ${left.symbol} vs ${right.symbol} comparison financial advice?`, "No. This page is educational and informational only and does not provide financial or investment advice."],
    [`How should I use this ${left.symbol} vs ${right.symbol} comparison?`, "Use it to review differences in themes, risks, and research context before opening the asset pages and methodology."],
    ["Does this page use live data?", "The page attempts to update price fields from /api/market-data when available while keeping the research content static."]
  ];
  return items.map(([q, a], index) => `<details ${index === 0 ? "open" : ""}><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join("");
}

function schemaScript(pair, left, right, isAr, title, description) {
  const url = `${domain}/${isAr ? `ar/${pair.pagePath}` : pair.pagePath}`;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: title,
        description,
        url,
        inLanguage: isAr ? "ar" : "en"
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "TradeAlphaAI", item: `${domain}/` },
          { "@type": "ListItem", position: 2, name: isAr ? "التصنيفات" : "Rankings", item: `${domain}/${isAr ? "ar/" : ""}rankings.html` },
          { "@type": "ListItem", position: 3, name: `${left.symbol} vs ${right.symbol}`, item: url }
        ]
      }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`;
}

function loadAssets() {
  const out = [];
  for (const kind of ["stocks", "etfs"]) {
    const dir = path.join(root, "data", "research-assets", kind);
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      out.push(readJson(path.join(dir, name)));
    }
  }
  return out;
}

function localized(asset, key, isAr) {
  if (isAr && asset.ar && asset.ar[key]) return asset.ar[key];
  if (key === "category" && !asset[key]) return asset.sector || "";
  if (key === "sector" && !asset[key]) return asset.category || "";
  return asset[key] || "";
}

function localizedList(asset, key, isAr) {
  const value = localized(asset, key, isAr);
  return Array.isArray(value) ? value : [];
}

function typeName(asset, isAr) {
  if (asset.type === "etf") return t(isAr, "ETF", "صندوق مؤشرات");
  return t(isAr, "Stock", "سهم");
}

function pagePathFor(asset, isAr) {
  const folder = asset.type === "etf" ? "etfs" : "stocks";
  return `/${isAr ? "ar/" : ""}${folder}/${asset.symbol.toLowerCase()}.html`;
}

function hubPathFor(hub, isAr) {
  if (!hub) return isAr ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html";
  return `/${isAr ? "ar/" : ""}${hub}.html`;
}

function hubLabel(hub, isAr) {
  const labels = {
    "cybersecurity-stocks": ["Cybersecurity Stocks", "أسهم الأمن السيبراني"],
    "cloud-stocks": ["Cloud Stocks", "أسهم الحوسبة السحابية"],
    "fintech-stocks": ["Fintech Stocks", "أسهم التقنية المالية"],
    "defensive-stocks": ["Defensive Stocks", "الأسهم الدفاعية"],
    "ai-etfs": ["AI ETFs", "صناديق الذكاء الاصطناعي"],
    "defensive-etfs": ["Defensive ETFs", "الصناديق الدفاعية"],
    "semiconductor-stocks": ["Semiconductor Stocks", "أسهم أشباه الموصلات"],
    "ai-stocks": ["AI Stocks", "أسهم الذكاء الاصطناعي"],
    "dividend-etfs": ["Dividend ETFs", "صناديق التوزيعات"]
  };
  const label = labels[hub] || ["Research Hub", "مركز الأبحاث"];
  return isAr ? label[1] : label[0];
}

function ctaLinks(links) {
  return links.map(([label, href, primary]) => `<a class="market-btn${primary ? " primary" : ""}" href="${href}">${escapeHtml(label)}</a>`).join("");
}

function listHtml(items) {
  return `<ul class="insight-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function mergeSitemap(file, newUrls) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const existing = [...current.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const urls = [...new Set([...existing, ...newUrls])];
  const body = urls.map((url) => `  <url>\n    <loc>${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.82</priority>\n  </url>`).join("\n");
  fs.writeFileSync(file, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, "utf8");
}

function renderTemplate(source, values) {
  return Object.entries(values).reduce((html, [key, value]) => {
    return html.replaceAll(`{{${key}}}`, htmlValue(key, value));
  }, source);
}

function htmlValue(key, value) {
  if (["SCHEMA_JSON", "TABLE_ROWS", "LEFT_LIST", "RIGHT_LIST", "CTA_LINKS", "FAQ_HTML", "LIVE_ITEMS_JSON"].includes(key)) return String(value ?? "");
  return escapeHtml(value);
}

function defaultPairs(type) {
  if (type === "etf") {
    return [
      ["SPY", "QQQ", "ai-etfs"], ["SPY", "VOO", "defensive-etfs"], ["SPY", "VTI", "defensive-etfs"], ["QQQ", "VUG", "ai-etfs"], ["QQQ", "XLK", "ai-etfs"],
      ["SMH", "SOXX", "ai-etfs"], ["ARKQ", "BOTZ", "ai-etfs"], ["ARKK", "SCHG", "ai-etfs"], ["SCHD", "VIG", "defensive-etfs"], ["JEPI", "SCHD", "defensive-etfs"],
      ["BND", "IEF", "defensive-etfs"], ["TLT", "IEF", "defensive-etfs"], ["XLV", "VIG", "defensive-etfs"], ["XLE", "XLF", "defensive-etfs"], ["IWM", "RSP", "defensive-etfs"]
    ].map(([left, right, hub]) => ({ type, left, right, hub }));
  }
  return [
    ["NVDA", "AMD", "semiconductor-stocks"], ["NVDA", "AVGO", "semiconductor-stocks"], ["AMD", "INTC", "semiconductor-stocks"], ["AVGO", "QCOM", "semiconductor-stocks"], ["TSM", "ASML", "semiconductor-stocks"],
    ["AMAT", "KLAC", "semiconductor-stocks"], ["MSFT", "GOOGL", "cloud-stocks"], ["MSFT", "AMZN", "cloud-stocks"], ["CRM", "NOW", "cloud-stocks"], ["SNOW", "MDB", "cloud-stocks"],
    ["DDOG", "NET", "cloud-stocks"], ["CRWD", "PANW", "cybersecurity-stocks"], ["CRWD", "ZS", "cybersecurity-stocks"], ["PANW", "FTNT", "cybersecurity-stocks"], ["NET", "ZS", "cybersecurity-stocks"],
    ["JPM", "GS", "fintech-stocks"], ["V", "MA", "fintech-stocks"], ["PYPL", "SHOP", "fintech-stocks"], ["GS", "MS", "fintech-stocks"], ["BLK", "JPM", "fintech-stocks"],
    ["KO", "PEP", "defensive-stocks"], ["PG", "WMT", "defensive-stocks"], ["JNJ", "MRK", "defensive-stocks"], ["UNH", "LLY", "defensive-stocks"], ["XOM", "CVX", "defensive-stocks"],
    ["COST", "WMT", "defensive-stocks"], ["META", "GOOGL", "ai-stocks"], ["TSLA", "UBER", "growth-stocks"], ["ADBE", "INTU", "cloud-stocks"], ["PLTR", "SNOW", "cloud-stocks"]
  ].map(([left, right, hub]) => ({ type, left, right, hub }));
}

function defaultHub(type) {
  return type === "etf" ? "ai-etfs" : "ai-stocks";
}

function slug(value) {
  return String(value).toLowerCase();
}

function t(isAr, en, ar) {
  return isAr ? ar : en;
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
