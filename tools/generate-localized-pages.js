const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const site = "https://www.tradealphaai.com";
const dataPath = path.join(root, "data", "localization", "ar-pages.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const pageBySource = new Map(data.pages.map((page) => [normalize(page.source), page]));
const pageById = new Map(data.pages.map((page) => [page.id, page]));

const nav = {
  en: [
    ["Home", "/en/"],
    ["AI Stock Analyzer", "/stocks.html"],
    ["ETF Analyzer", "/etfs.html"],
    ["Market Screener", "/ai-stock-screener.html"],
    ["Market Insights", "/en/insights/"],
    ["Methodology", "/en/methodology.html"]
  ],
  ar: [
    ["الرئيسية", "/ar/"],
    ["محلل الأسهم", "/stocks.html"],
    ["محلل ETF", "/etfs.html"],
    ["فاحص السوق", "/ai-stock-screener.html"],
    ["الأبحاث", "/ar/insights/"],
    ["المنهجية", "/ar/methodology.html"]
  ]
};

const englishFallback = {
  home: {
    eyebrow: "Educational Market Research Platform",
    heading: "TradeAlphaAI market research, stock screening, and ETF education",
    lead: "A fast static platform for educational market research across AI infrastructure, ETFs, macro risk, and portfolio context.",
    summary: "Start with screening tools or continue into Market Insights for deeper research paths.",
    primaryCta: "Open Market Insights",
    secondaryCta: "Open Market Screener"
  },
  "insights-index": {
    eyebrow: "Educational Research Hub",
    heading: "Market Insights",
    lead: "A curated research library covering AI infrastructure, semiconductor cycles, ETF mechanics, portfolio risk, and macro context.",
    summary: "Browse featured research, topic clusters, and links into analyzers and hub pages.",
    primaryCta: "Read Featured Research",
    secondaryCta: "Open Market Screener"
  },
  methodology: {
    eyebrow: "Methodology",
    heading: "How TradeAlpha Score Works",
    lead: "TradeAlpha Score is an educational screening framework for stocks and ETFs. It does not provide buy, sell, or hold recommendations.",
    summary: "The score combines technical, fundamental, momentum, sentiment, and risk context.",
    primaryCta: "Open Market Screener",
    secondaryCta: "Read Market Insights"
  }
};

function run() {
  for (const page of data.pages) {
    writePage(page, "ar");
    writePage(page, "en");
    syncEnglishSource(page);
  }

  writeSitemap();
  syncRobots();

  console.log(`Generated ${data.pages.length} Arabic pages and ${data.pages.length} English localized aliases.`);
  console.log("Updated hreflang metadata on scoped English source pages.");
}

function writePage(page, locale) {
  const outputPath = path.join(root, locale === "ar" ? page.arPath : page.enPath);
  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, renderPage(page, locale), "utf8");
}

function renderPage(page, locale) {
  const isAr = locale === "ar";
  const localizedPath = isAr ? page.arPath : page.enPath;
  const title = isAr ? page.title : page.enTitle;
  const description = isAr ? page.description : page.enDescription;
  const strings = isAr ? page : { ...englishFallback[page.id], ...page, title: page.enTitle, description: page.enDescription };
  const direction = isAr ? "rtl" : "ltr";
  const cssPrefix = relativePrefix(localizedPath);
  const canonical = `${site}/${localizedPath.replace(/index\.html$/, "")}`;
  const sourceUrl = `${site}/${normalize(page.source).replace(/index\.html$/, "")}`;
  const arUrl = `${site}/${page.arPath.replace(/index\.html$/, "")}`;
  const enUrl = `${site}/${page.enPath.replace(/index\.html$/, "")}`;

  return `<!doctype html>
<html lang="${locale}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${sourceUrl}" />
  <link rel="alternate" hreflang="en-US" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${sourceUrl}" />
  <meta property="og:locale" content="${isAr ? "ar_AR" : "en_US"}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="${page.type === "article" ? "article" : "website"}" />
  <meta property="og:image" content="${site}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${site}/Image/og-image.svg" />
  <link rel="stylesheet" href="${cssPrefix}styles.css" />
  <link rel="stylesheet" href="${cssPrefix}landing.css" />
  <link rel="stylesheet" href="${cssPrefix}css/market/market-portal.css" />
  ${schema(page, locale)}
</head>
<body class="market-page localized-page localized-${locale}">
  ${header(page, locale)}
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb">${breadcrumb(page, locale)}</nav>
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">${escapeHtml(strings.eyebrow || page.category || "")}</span>
          <h1>${escapeHtml(strings.heading || title)}</h1>
          <p class="market-lead">${escapeHtml(strings.lead || description)}</p>
          <div class="market-actions">
            <a class="market-btn primary" href="${isAr ? "/ar/insights/" : "/en/insights/"}">${escapeHtml(strings.primaryCta || (isAr ? "افتح الأبحاث" : "Open Research"))}</a>
            <a class="market-btn" href="/ai-stock-screener.html">${escapeHtml(strings.secondaryCta || (isAr ? "افتح فاحص السوق" : "Open Screener"))}</a>
          </div>
        </div>
      </section>
      ${page.type === "article" ? articleBody(page, locale) : indexBody(page, locale)}
      <section class="market-section">
        <div class="market-panel">
          <p class="market-copy localized-disclaimer"><strong>${isAr ? "تنبيه تعليمي:" : "Educational disclaimer:"}</strong> ${escapeHtml(isAr ? data.disclaimer : "TradeAlphaAI content is for educational and informational purposes only and does not constitute financial or investment advice. TradeAlphaAI does not recommend securities or predict future performance.")}</p>
        </div>
      </section>
    </div>
  </main>
  <script src="${cssPrefix}js/language-router.js" defer></script>
</body>
</html>
`;
}

function header(page, locale) {
  const isAr = locale === "ar";
  const current = isAr ? page.arPath : page.enPath;
  const otherLocale = isAr ? "en" : "ar";
  const otherPath = isAr ? page.enPath : page.arPath;
  const navItems = nav[locale]
    .map(([label, href]) => `<a href="${href}" class="nav-link">${escapeHtml(label)}</a>`)
    .join("\n          ");
  return `<div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="${isAr ? "/ar/" : "/en/"}">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>TradeAlpha AI</strong><span>${isAr ? "منصة أبحاث السوق" : "AI Market Portal"}</span></span>
      </a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="${isAr ? "التنقل الرئيسي" : "Primary"}">
          ${navItems}
        </nav>
        <div class="locale-links" aria-label="${isAr ? "اختيار اللغة" : "Language"}">
          <a class="lang-switch" data-locale-route="${otherLocale}" href="/${otherPath.replace(/index\.html$/, "")}">${isAr ? "English" : "العربية"}</a>
          <a class="lang-switch" data-locale-route="${locale}" href="/${current.replace(/index\.html$/, "")}">${isAr ? "العربية" : "English"}</a>
        </div>
      </div>
    </div>
  </div>`;
}

function breadcrumb(page, locale) {
  const isAr = locale === "ar";
  const home = `<a href="${isAr ? "/ar/" : "/en/"}">${isAr ? "الرئيسية" : "Home"}</a>`;
  if (page.type === "article") {
    return `${home}<span>/</span><a href="${isAr ? "/ar/insights/" : "/en/insights/"}">${isAr ? "الأبحاث" : "Market Insights"}</a><span>/</span><span>${escapeHtml(isAr ? page.heading : page.enTitle)}</span>`;
  }
  return `${home}<span>/</span><span>${escapeHtml(isAr ? page.heading : page.enTitle)}</span>`;
}

function indexBody(page, locale) {
  const isAr = locale === "ar";
  const sections = (page.sections || [])
    .map((section) => `<article class="market-card">
      <span class="eyebrow">${escapeHtml(section.label)}</span>
      <h2>${escapeHtml(section.title)}</h2>
      <p class="market-copy">${escapeHtml(section.body)}</p>
    </article>`)
    .join("\n");
  return `<section class="market-section">
    <div class="market-panel">
      <p class="market-copy">${escapeHtml(page.summary)}</p>
      <div class="market-grid" style="margin-top:20px">${sections}</div>
    </div>
  </section>
  <section class="market-section">
    <div class="market-panel">
      <span class="eyebrow">${isAr ? "روابط مرتبطة" : "Related Paths"}</span>
      <div class="market-actions" style="margin-top:16px">
        <a class="market-btn" href="${isAr ? "/ar/insights/ai-infrastructure-demand.html" : "/en/insights/ai-infrastructure-demand.html"}">${isAr ? "طلب البنية التحتية للذكاء الاصطناعي" : "AI Infrastructure Demand"}</a>
        <a class="market-btn" href="${isAr ? "/ar/insights/spy-vs-qqq-explained.html" : "/en/insights/spy-vs-qqq-explained.html"}">${isAr ? "شرح SPY و QQQ" : "SPY vs QQQ"}</a>
        <a class="market-btn" href="${isAr ? "/ar/methodology.html" : "/en/methodology.html"}">${isAr ? "المنهجية" : "Methodology"}</a>
      </div>
    </div>
  </section>`;
}

function articleBody(page, locale) {
  const isAr = locale === "ar";
  const sections = (page.sections || [])
    .map((section) => `<h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>`)
    .join("\n");
  const faq = (page.faq || [])
    .map((item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`)
    .join("\n");
  return `<section class="market-section">
    <div class="market-panel insight-hero-card">
      <div class="insight-label-row">
        <span class="insight-category-badge">${escapeHtml(isAr ? page.category : "Market Research")}</span>
        <span>${escapeHtml(page.readingTime || "7 min read")}</span>
        <time datetime="${page.updated || data.generatedAt}">${page.updated || data.generatedAt}</time>
      </div>
      <p class="market-copy">${escapeHtml(page.summary)}</p>
    </div>
  </section>
  <section class="market-section">
    <article class="market-panel insight-article-body">
      ${sections}
      <h2>${isAr ? "أسئلة شائعة" : "Frequently Asked Questions"}</h2>
      <div class="stock-faq">${faq}</div>
    </article>
  </section>`;
}

function schema(page, locale) {
  const isAr = locale === "ar";
  const pagePath = isAr ? page.arPath : page.enPath;
  const json = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: isAr ? "TradeAlphaAI العربية" : "TradeAlphaAI", item: `${site}/${isAr ? "ar/" : "en/"}` },
          { "@type": "ListItem", position: 2, name: isAr ? page.heading : page.enTitle, item: `${site}/${pagePath.replace(/index\.html$/, "")}` }
        ]
      },
      {
        "@type": page.type === "article" ? "Article" : "WebPage",
        headline: isAr ? page.title : page.enTitle,
        name: isAr ? page.title : page.enTitle,
        description: isAr ? page.description : page.enDescription,
        inLanguage: locale,
        url: `${site}/${pagePath.replace(/index\.html$/, "")}`,
        author: { "@type": "Organization", name: isAr ? "فريق TradeAlphaAI لأبحاث السوق" : "TradeAlphaAI Market Insights Team" },
        publisher: { "@type": "Organization", name: "TradeAlphaAI", url: site }
      }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n  </script>`;
}

function syncEnglishSource(page) {
  const sourcePath = path.join(root, page.source);
  if (!fs.existsSync(sourcePath)) return;
  let html = fs.readFileSync(sourcePath, "utf8");
  const sourceUrl = `${site}/${normalize(page.source).replace(/index\.html$/, "")}`;
  const arUrl = `${site}/${page.arPath.replace(/index\.html$/, "")}`;
  const enAliasUrl = `${site}/${page.enPath.replace(/index\.html$/, "")}`;
  const block = `  <!-- localized-static-pages:start -->\n  <link rel="alternate" hreflang="en" href="${sourceUrl}" />\n  <link rel="alternate" hreflang="en-US" href="${enAliasUrl}" />\n  <link rel="alternate" hreflang="ar" href="${arUrl}" />\n  <link rel="alternate" hreflang="x-default" href="${sourceUrl}" />\n  <!-- localized-static-pages:end -->`;
  html = replaceMarkedBlock(html, "localized-static-pages", block);
  html = injectLocaleSwitch(html, page);
  fs.writeFileSync(sourcePath, html, "utf8");
}

function injectLocaleSwitch(html, page) {
  const arHref = `/${page.arPath.replace(/index\.html$/, "")}`;
  const enHref = `/${normalize(page.source).replace(/index\.html$/, "")}`;
  const switcher = `<div class="locale-links" aria-label="Language">
          <a class="lang-switch" data-locale-route="ar" href="${arHref}">العربية</a>
          <a class="lang-switch" data-locale-route="en" href="${enHref}">English</a>
        </div>`;

  if (html.includes('class="locale-links"')) return html;
  if (html.includes('<div class="top-controls">')) {
    const start = html.indexOf('<div class="top-controls">');
    const endToken = "      </div>\n    </div>\n  </div>";
    const end = html.indexOf(endToken, start);
    if (start !== -1 && end !== -1) {
      return `${html.slice(0, start)}<div class="top-controls">\n          ${switcher}\n        </div>\n${html.slice(end)}`;
    }
  }
  return html.replace(/(<\/nav>\s*)<\/div>/, `$1${switcher}\n      </div>`);
}

function replaceMarkedBlock(html, marker, block) {
  const pattern = new RegExp(`\\s*<!-- ${marker}:start -->[\\s\\S]*?<!-- ${marker}:end -->`);
  if (pattern.test(html)) return html.replace(pattern, `\n${block}`);
  return html.replace(/(<link rel="canonical"[^>]*>\s*)/, `$1${block}\n`);
}

function writeSitemap() {
  const urls = data.pages.map((page) => `  <url>
    <loc>${site}/${page.arPath.replace(/index\.html$/, "")}</loc>
    <changefreq>${page.type === "article" ? "monthly" : "weekly"}</changefreq>
    <priority>${page.id === "home" ? "0.9" : "0.75"}</priority>
  </url>`).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  fs.writeFileSync(path.join(root, "sitemap-ar.xml"), xml, "utf8");
}

function syncRobots() {
  const robotsPath = path.join(root, "robots.txt");
  let robots = fs.readFileSync(robotsPath, "utf8");
  const line = "Sitemap: https://www.tradealphaai.com/sitemap-ar.xml";
  if (!robots.includes(line)) {
    robots = robots.trimEnd() + `\n${line}\n`;
    fs.writeFileSync(robotsPath, robots, "utf8");
  }
}

function relativePrefix(filePath) {
  const depth = normalize(path.dirname(filePath)).split("/").filter(Boolean).length;
  return depth === 0 ? "" : "../".repeat(depth);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalize(value) {
  return value.replace(/\\/g, "/");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

run();
