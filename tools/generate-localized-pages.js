const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const site = "https://www.tradealphaai.com";
const dataPath = path.join(root, "data", "localization", "ar-pages.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const terminology = JSON.parse(fs.readFileSync(path.join(root, "data", "localization", "ar-terminology.json"), "utf8"));
const marketConfig = JSON.parse(fs.readFileSync(path.join(root, "data", "market-symbols.json"), "utf8"));
const researchLayer = JSON.parse(fs.readFileSync(path.join(root, "data", "research-layer.json"), "utf8"));
const phase1Path = path.join(root, "data", "localization", "ar-phase1-pages.json");
if (fs.existsSync(phase1Path)) {
  const phase1 = JSON.parse(fs.readFileSync(phase1Path, "utf8"));
  const existing = new Set(data.pages.map((page) => page.id));
  for (const page of phase1.pages || []) {
    if (!existing.has(page.id)) data.pages.push(page);
  }
}
addAutoPages();

const pageBySource = new Map(data.pages.map((page) => [normalize(page.source), page]));
const pageById = new Map(data.pages.map((page) => [page.id, page]));
const arHrefBySource = new Map(data.pages.map((page) => [normalize(page.source), `/${page.arPath.replace(/index\.html$/, "")}`]));
const enHrefBySource = new Map(data.pages.map((page) => [normalize(page.source), `/${page.enPath.replace(/index\.html$/, "")}`]));

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
    [terminology.nav.Home, "/ar/"],
    [terminology.nav["AI Stock Analyzer"], "/ar/stocks.html"],
    [terminology.nav["ETF Analyzer"], "/ar/etfs.html"],
    [terminology.nav["Market Screener"], "/ar/ai-stock-screener.html"],
    [terminology.nav["Market Insights"], "/ar/insights/"],
    [terminology.nav.Methodology, "/ar/methodology.html"]
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
  writeLanguageRouter();

  console.log(`Generated ${data.pages.length} Arabic pages and ${data.pages.length} English localized aliases.`);
  console.log("Updated hreflang metadata on scoped English source pages.");
}

function addAutoPages() {
  const existing = new Set(data.pages.map((page) => page.source));
  const corePages = [
    corePage("stocks", "stocks.html", "محلل أسهم الذكاء الاصطناعي", "صفحة عربية لفحص الأسهم التعليمية باستخدام TradeAlpha Score وسياق المخاطر والزخم والأساسيات.", "تحليل الأسهم التعليمية", "استخدم محلل أسهم الذكاء الاصطناعي لفهم السياق الفني والأساسي والمخاطر دون تقديم توصيات شراء أو بيع."),
    corePage("etfs", "etfs.html", "محلل صناديق المؤشرات ETF", "صفحة عربية لفحص صناديق المؤشرات، تشمل التوزيع القطاعي والتكاليف والتذبذب وسياق المخاطر.", "تحليل صناديق المؤشرات", "قارن صناديق ETF من حيث التعرض، التكاليف، التذبذب، والسياق التعليمي للمحفظة."),
    corePage("screener", "ai-stock-screener.html", "ماسح السوق للأسهم وصناديق المؤشرات", "ماسح سوق عربي تعليمي لتصفية الأسهم وصناديق ETF حسب الدرجة والزخم والمخاطر والقطاع.", "ماسح السوق", "استكشف الأسهم وصناديق المؤشرات ضمن مجموعات بحثية منظمة، مع التأكيد أن النتائج تعليمية وليست توصيات."),
    corePage("market-data-status", "market-data-status.html", "حالة بيانات السوق", "صفحة عربية توضح حالة بيانات السوق، أوضاع البيانات التعليمية، والشفافية حول مصادر البيانات.", "شفافية البيانات", "تعرض هذه الصفحة حالة البيانات المستخدمة في المنصة وتوضح الفرق بين البيانات التعليمية والحية والاحتياطية."),
    corePage("methodology", "methodology.html", "منهجية TradeAlpha Score", "شرح عربي لمنهجية TradeAlpha Score كإطار فحص تعليمي للأسهم وصناديق ETF.", "المنهجية", "تعرف على العوامل الفنية والأساسية والزخم والمخاطر التي تدخل في إطار الفحص التعليمي.")
  ];

  for (const page of corePages) {
    if (!existing.has(page.source)) {
      data.pages.push(page);
      existing.add(page.source);
    }
  }

  for (const hub of marketConfig.hubs || []) {
    if (existing.has(hub.pagePath)) continue;
    data.pages.push(hubPage(hub));
    existing.add(hub.pagePath);
  }

  for (const symbol of marketConfig.symbols || []) {
    if (existing.has(symbol.pagePath)) continue;
    data.pages.push(symbolPage(symbol));
    existing.add(symbol.pagePath);
  }

  const insightFiles = fs.readdirSync(path.join(root, "insights"))
    .filter((name) => name.endsWith(".html") && name !== "index.html")
    .map((name) => `insights/${name}`);
  for (const rel of insightFiles) {
    if (existing.has(rel)) continue;
    const html = fs.readFileSync(path.join(root, rel), "utf8");
    if (/noindex,nofollow/i.test(html)) continue;
    data.pages.push(insightPage(rel, html));
    existing.add(rel);
  }
}

function corePage(id, source, title, description, eyebrow, lead) {
  return {
    id: `core-${id}`,
    type: "core",
    source,
    arPath: `ar/${source}`,
    enPath: `en/${source}`,
    title,
    description,
    enTitle: extractTitle(source) || title,
    enDescription: extractDescription(source) || description,
    eyebrow,
    heading: title.replace(" | TradeAlphaAI", ""),
    lead,
    summary: "تعمل هذه الصفحة ضمن نسخة عربية ثابتة وسريعة، مع روابط واضحة إلى الصفحات العربية المتاحة وحفاظ كامل على الطابع التعليمي للمحتوى.",
    primaryCta: terminology.labels.readInsights,
    secondaryCta: terminology.labels.openScreener,
    sections: [
      { label: "الغرض", title: "إطار تعليمي منظم", body: "تعرض الصفحة معلومات سياقية تساعد على الفهم والمقارنة، ولا تقدم نصيحة مالية أو توصية تداول." },
      { label: "الروابط", title: "مسارات بحث مترابطة", body: "تم ربط الصفحة بالأسهم وصناديق المؤشرات ورؤى السوق المتاحة باللغة العربية عند توفرها." },
      { label: "الشفافية", title: "حدود واضحة للاستخدام", body: "يظل المحتوى تعليمياً ومعلوماتياً فقط، مع إبقاء الإفصاحات ومبادئ المنهجية ظاهرة للمستخدم." }
    ]
  };
}

function hubPage(hub) {
  const isAI = hub.pagePath.includes("ai-stocks");
  const isSemi = hub.pagePath.includes("semiconductor");
  const isGrowth = hub.pagePath.includes("growth");
  const title = isAI ? "محور أسهم الذكاء الاصطناعي" : isSemi ? "محور أسهم أشباه الموصلات" : isGrowth ? "محور أسهم النمو" : "محور صناديق توزيعات الأرباح";
  return {
    id: `auto-${hub.pagePath.replace(/[^a-z0-9]+/gi, "-")}`,
    type: "hub",
    source: hub.pagePath,
    arPath: `ar/${hub.pagePath}`,
    enPath: `en/${hub.pagePath}`,
    title: `${title} | TradeAlphaAI`,
    description: `صفحة عربية تعليمية حول ${title}، مع روابط إلى الأسهم وصناديق المؤشرات ورؤى السوق المرتبطة.`,
    enTitle: extractTitle(hub.pagePath) || hub.title || title,
    enDescription: extractDescription(hub.pagePath) || hub.description || "",
    eyebrow: "محور أبحاث",
    heading: title,
    lead: hub.intro || `محور عربي منظم لفهم ${title} من منظور تعليمي، مع روابط داخلية إلى الأصول والأبحاث ذات الصلة.`,
    summary: "تجمع هذه الصفحة مسارات بحث مرتبطة حتى يتمكن القارئ من الانتقال بين المقالات، الأسهم، صناديق المؤشرات، والمنهجية بسهولة.",
    primaryCta: terminology.labels.readInsights,
    secondaryCta: terminology.labels.openScreener,
    sections: [
      { label: "سياق السوق", title: "فهم الموضوع قبل الأداة", body: "ابدأ بفهم محركات القطاع والمخاطر الأساسية، ثم استخدم أدوات الفحص كمرجع تعليمي إضافي." },
      { label: "الروابط", title: "بحث مترابط", body: "تربط الصفحة بين الأصول الأكثر صلة والمقالات التي تشرح الخلفية الاقتصادية والقطاعية." },
      { label: "المخاطر", title: "لا توجد توصيات مباشرة", body: "لا تقدم هذه الصفحة توصيات شراء أو بيع، بل تعرض سياقاً تعليمياً يساعد على القراءة المنظمة." }
    ],
    related: localizedRelatedFromSymbols(hub.relatedSymbols || [])
  };
}

function symbolPage(symbol) {
  const isEtf = symbol.type === "etf";
  const arType = isEtf ? "صندوق ETF" : "سهم";
  const title = `تحليل ${arType} ${symbol.symbol} | ${symbol.name}`;
  return {
    id: `auto-${symbol.symbol.toLowerCase()}`,
    type: isEtf ? "etf" : "stock",
    source: symbol.pagePath,
    arPath: `ar/${symbol.pagePath}`,
    enPath: `en/${symbol.pagePath}`,
    symbol: symbol.symbol,
    title,
    description: `صفحة عربية تعليمية لتحليل ${symbol.symbol}، تشمل السياق القطاعي، عوامل المخاطر، الروابط البحثية، ومنهجية TradeAlphaAI دون تقديم نصيحة مالية.`,
    enTitle: symbol.seoTitle || extractTitle(symbol.pagePath) || title,
    enDescription: symbol.seoDescription || extractDescription(symbol.pagePath) || "",
    category: isEtf ? "تحليل صناديق المؤشرات" : "تحليل الأسهم",
    readingTime: "5 دقائق قراءة",
    updated: data.generatedAt,
    eyebrow: isEtf ? "تحليل ETF تعليمي" : "تحليل سهم تعليمي",
    heading: `${symbol.name} (${symbol.symbol})`,
    lead: `${symbol.symbol} صفحة بحث تعليمية تربط ${symbol.name} بسياق ${arSector(symbol.sector)} والمخاطر المرتبطة به.`,
    summary: `يركز هذا التحليل على ${symbol.contentAngle || "السياق التعليمي والمخاطر والعوامل المؤثرة"}، ولا يشكل توصية بشراء أو بيع.`,
    primaryCta: isEtf ? "اقرأ تعليم صناديق المؤشرات" : "اقرأ رؤى السوق",
    secondaryCta: terminology.labels.openScreener,
    sections: [
      { label: "السياق", title: "لماذا يراقب المستثمرون هذا الأصل؟", body: professionalize(symbol.contentAngle || "يرتبط الأصل بعوامل سوقية وقطاعية متعددة يجب فهمها قبل قراءة أي درجة فحص.") },
      { label: "المخاطر", title: "عوامل يجب متابعتها", body: isEtf ? "تتضمن المخاطر التذبذب، تركيز المكونات، حساسية أسعار الفائدة، وتغير قيادة القطاعات." : "تتضمن المخاطر التقييم، نتائج الأعمال، المنافسة، ظروف القطاع، وتغير شهية المخاطرة في السوق." },
      { label: "المنهجية", title: "قراءة تعليمية لا توصية", body: "تُستخدم الصفحة كإطار لفهم العوامل المؤثرة، وليست بديلاً عن استشارة مالية شخصية أو بحث مستقل." }
    ],
    faq: (symbol.faqSeeds || []).slice(0, 3).map((q) => ({ q: arQuestion(q, symbol), a: `لا. محتوى ${symbol.symbol} تعليمي ومعلوماتي فقط ولا يُعد نصيحة مالية أو توصية استثمارية.` })),
    related: localizedRelatedFromSymbols(symbol.relatedSymbols || [])
  };
}

function insightPage(rel, html) {
  const slug = path.basename(rel, ".html");
  const title = extractHtmlTitle(html).replace(/\s*\|\s*TradeAlphaAI.*$/i, "");
  const description = extractHtmlDescription(html);
  const category = extractFirst(html, /<span class="insight-category-badge">([^<]+)<\/span>/) || "أبحاث السوق";
  const arTitle = arInsightTitle(title, slug);
  return {
    id: `auto-insight-${slug}`,
    type: "article",
    source: rel,
    arPath: `ar/${rel}`,
    enPath: `en/${rel}`,
    title: arTitle,
    description: arInsightDescription(description, arTitle),
    enTitle: title,
    enDescription: description,
    category: arCategory(category),
    readingTime: "6 دقائق قراءة",
    updated: data.generatedAt,
    eyebrow: "رؤى السوق",
    heading: arTitle,
    lead: `مقال عربي تعليمي يشرح ${arTitle.replace(/^تحليل\s+/, "")} ضمن سياق أبحاث السوق، المخاطر، والروابط المرتبطة في TradeAlphaAI.`,
    summary: "تم إعداد هذه النسخة العربية كصفحة ثابتة قابلة للفهرسة، مع الحفاظ على الرسالة التعليمية وعدم تقديم أي توصية استثمارية.",
    primaryCta: terminology.labels.readInsights,
    secondaryCta: terminology.labels.openScreener,
    sections: [
      { title: "السياق البحثي", body: arInsightDescription(description, arTitle) },
      { title: "لماذا يهم الموضوع؟", body: "يساعد هذا الموضوع على فهم العلاقة بين القطاعات، صناديق المؤشرات، الأسهم، والمخاطر الكلية بطريقة منظمة." },
      { title: "عوامل المخاطر", body: "يجب قراءة أي موضوع سوقي مع مراعاة التذبذب، اختلاف الأفق الزمني، تغير أسعار الفائدة، وحساسية التقييمات." }
    ],
    faq: [
      { q: "هل هذه المقالة نصيحة مالية؟", a: "لا. المقالة تعليمية ومعلوماتية فقط ولا تُعد نصيحة مالية أو توصية بشراء أو بيع أي ورقة مالية." },
      { q: "كيف أستخدم هذا البحث؟", a: "استخدمه لفهم السياق والعوامل المؤثرة، ثم راجع المنهجية والروابط المرتبطة قبل أي قرار شخصي." }
    ],
    related: ["ar/insights/index.html", "ar/methodology.html", "ar/ai-stock-screener.html"]
  };
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
  const strings = isAr ? page : englishStrings(page);
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
          <h1>${escapeHtml(isAr ? arClean(strings.heading || title) : (strings.heading || title))}</h1>
          <p class="market-lead">${escapeHtml(strings.lead || description)}</p>
          <div class="market-actions">
            <a class="market-btn primary" href="${isAr ? "/ar/insights/" : "/en/insights/"}">${escapeHtml(isAr ? arClean(strings.primaryCta || terminology.labels.readInsights) : (strings.primaryCta || "Open Research"))}</a>
            <a class="market-btn" href="${isAr ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html"}">${escapeHtml(isAr ? arClean(strings.secondaryCta || terminology.labels.openScreener) : (strings.secondaryCta || "Open Screener"))}</a>
          </div>
        </div>
      </section>
      ${detailBody(page, locale)}
      <section class="market-section">
        <div class="market-panel">
          <p class="market-copy localized-disclaimer"><strong>${isAr ? terminology.labels.educationalDisclaimer + ":" : "Educational disclaimer:"}</strong> ${escapeHtml(isAr ? terminology.disclaimer : "TradeAlphaAI content is for educational and informational purposes only and does not constitute financial or investment advice. TradeAlphaAI does not recommend securities or predict future performance.")}</p>
        </div>
      </section>
    </div>
  </main>
  <script src="${cssPrefix}js/language-router.js" defer></script>
  ${page.rc && !isAr ? `<script src="${cssPrefix}js/related-content.js" defer></script>` : ""}
  ${page.type === "hub" && !isAr ? `<script src="${cssPrefix}js/research-layer.js" defer></script>` : ""}
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
    return `${home}<span>/</span><a href="${isAr ? "/ar/insights/" : "/en/insights/"}">${isAr ? terminology.nav["Market Insights"] : "Market Insights"}</a><span>/</span><span>${escapeHtml(isAr ? arClean(page.heading || page.title) : page.enTitle)}</span>`;
  }
  return `${home}<span>/</span><span>${escapeHtml(isAr ? arClean(page.heading || page.title) : page.enTitle)}</span>`;
}

function indexBody(page, locale) {
  const isAr = locale === "ar";
  if (isAr && page.id === "insights-index") return arabicInsightsIndex();
  const sections = (page.sections || [])
    .map((section) => `<article class="market-card">
      <span class="eyebrow">${escapeHtml(isAr ? arClean(section.label) : section.label)}</span>
      <h2>${escapeHtml(isAr ? arClean(section.title) : section.title)}</h2>
      <p class="market-copy">${escapeHtml(isAr ? arClean(section.body) : section.body)}</p>
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

function detailBody(page, locale) {
  if (["article", "stock", "etf"].includes(page.type)) return articleBody(page, locale);
  return indexBody(page, locale) + relatedLinks(page, locale) + researchHooks(page, locale);
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
  </section>
  ${relatedLinks(page, locale)}
  ${researchHooks(page, locale)}`;
}

function relatedLinks(page, locale) {
  const isAr = locale === "ar";
  if (!Array.isArray(page.related) || !page.related.length) return "";
  const links = page.related
    .map((href) => {
      const normalized = href.replace(/^\/+/, "");
      const target = locale === "ar" ? `/${normalized}` : sourceFromLocalized(normalized);
      const label = labelForHref(normalized, locale);
      return `<a class="market-btn" href="${target}">${escapeHtml(locale === "ar" ? arClean(label) : label)}</a>`;
    })
    .join("\n        ");
  return `<section class="market-section">
    <div class="market-panel">
      <span class="eyebrow">${isAr ? "روابط بحث مرتبطة" : "Related Research"}</span>
      <div class="market-actions" style="margin-top:16px">
        ${links}
      </div>
    </div>
  </section>`;
}

function researchHooks(page, locale) {
  const isAr = locale === "ar";
  if (isAr) return "";
  const rc = page.rc ? `<section class="market-section"><div class="market-panel"><span class="eyebrow">${isAr ? "تابع البحث" : "Continue Research"}</span><div data-rc="${escapeHtml(page.rc)}"></div></div></section>` : "";
  const timeline = page.type === "hub" ? `<section class="market-section"><div class="market-panel"><div data-research-timeline="hub" data-count="4"></div></div></section>` : "";
  const themes = page.type === "hub" ? `<section class="market-section"><div class="market-panel"><div data-research-themes data-count="4"></div></div></section>` : "";
  return `${rc}\n${timeline}\n${themes}`;
}

function arabicInsightsIndex() {
  const articles = data.pages
    .filter((page) => page.type === "article")
    .sort((a, b) => String(a.title).localeCompare(String(b.title), "ar"))
    .map((page) => `<a class="insight-card" href="/${page.arPath}">
      <div class="insight-card-meta"><span class="insight-category-badge" style="margin:0">${escapeHtml(page.category || "رؤى السوق")}</span><time datetime="${escapeHtml(page.updated || data.generatedAt)}">${escapeHtml(page.updated || data.generatedAt)}</time></div>
      <h3>${escapeHtml(page.heading || page.title)}</h3>
      <p>${escapeHtml(page.summary || page.description)}</p>
      <span class="insight-card-cta">اقرأ المقال ←</span>
    </a>`)
    .join("\n");
  return `<section class="market-section">
    <div class="market-panel">
      <span class="eyebrow">كل المقالات المنشورة</span>
      <h2>رؤى السوق باللغة العربية</h2>
      <p class="market-copy">بطاقات المقالات أدناه قابلة للنقر وتنتقل إلى النسخ العربية المنشورة عند توفرها.</p>
      <div class="insight-grid" style="margin-top:20px">${articles}</div>
    </div>
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
  if (["article", "stock", "etf"].includes(page.type) && Array.isArray(page.faq) && page.faq.length) {
    json["@graph"].push({
      "@type": "FAQPage",
      inLanguage: locale,
      mainEntity: page.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    });
  }
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
  if (html.includes('<nav class="nav-group"')) {
    return html.replace(/(<\/nav>\s*)<\/div>/, `$1${switcher}\n      </div>`);
  }
  const sourceDir = normalize(path.dirname(page.source));
  const prefix = sourceDir === "." ? "" : "../".repeat(sourceDir.split("/").filter(Boolean).length);
  const header = `<div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="${prefix}index.html">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>TradeAlpha AI</strong><span>AI Market Portal</span></span>
      </a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="Primary">
          <a href="${prefix}index.html" class="nav-link">Home</a>
          <a href="${prefix}stocks.html" class="nav-link">AI Stock Analyzer</a>
          <a href="${prefix}etfs.html" class="nav-link">ETF Analyzer</a>
          <a href="${prefix}ai-stock-screener.html" class="nav-link">Market Screener</a>
          <a href="${prefix}insights/" class="nav-link">Market Insights</a>
          <a href="${prefix}methodology.html" class="nav-link">Methodology</a>
        </nav>
        ${switcher}
      </div>
    </div>
  </div>`;
  return html.replace(/(<body[^>]*>\s*)/, `$1${header}\n`);
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

function writeLanguageRouter() {
  const routes = {};
  for (const page of data.pages) {
    const source = `/${normalize(page.source).replace(/index\.html$/, "")}`;
    const sourceIndex = `/${normalize(page.source)}`;
    const ar = `/${page.arPath.replace(/index\.html$/, "")}`;
    const arIndex = `/${page.arPath}`;
    const en = `/${page.enPath.replace(/index\.html$/, "")}`;
    const enIndex = `/${page.enPath}`;
    routes[source] = { ar, en: source };
    routes[sourceIndex] = { ar, en: source };
    routes[ar] = { ar, en: source };
    routes[arIndex] = { ar, en: source };
    routes[en] = { ar, en };
    routes[enIndex] = { ar, en };
  }

  const source = `(function () {
  const localizedRoutes = ${JSON.stringify(routes, null, 4)};

  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };

  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
  });
})();
`;
  fs.writeFileSync(path.join(root, "js", "language-router.js"), source, "utf8");
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

function englishStrings(page) {
  const fallback = englishFallback[page.id] || {};
  return {
    title: page.enTitle || extractTitle(page.source) || page.title || "TradeAlphaAI",
    description: page.enDescription || extractDescription(page.source) || page.description || "",
    eyebrow: fallback.eyebrow || englishTypeLabel(page.type),
    heading: page.enTitle || extractTitle(page.source) || page.heading || page.title || "TradeAlphaAI",
    lead: page.enDescription || extractDescription(page.source) || fallback.lead || "Educational market research from TradeAlphaAI.",
    summary: fallback.summary || "This static English alias links to the primary English page and its Arabic equivalent.",
    primaryCta: fallback.primaryCta || "Open Market Insights",
    secondaryCta: fallback.secondaryCta || "Open Market Screener"
  };
}

function englishTypeLabel(type) {
  if (type === "stock") return "Educational Stock Research";
  if (type === "etf") return "Educational ETF Research";
  if (type === "hub") return "Research Hub";
  if (type === "article") return "Market Insights";
  return "TradeAlphaAI";
}

function localizedRelatedFromSymbols(symbols) {
  return (symbols || []).map((symbol) => {
    const found = (marketConfig.symbols || []).find((item) => item.symbol === symbol);
    return found ? `ar/${found.pagePath}` : null;
  }).filter(Boolean);
}

function arSector(sector = "") {
  if (/semiconductor/i.test(sector)) return "أشباه الموصلات";
  if (/technology/i.test(sector)) return "قطاع التكنولوجيا";
  if (/growth/i.test(sector)) return "أسهم النمو";
  if (/large blend|total market|s&p|u\.s\./i.test(sector)) return "السوق الأمريكي";
  if (/gold/i.test(sector)) return "الذهب والسلع";
  if (/treasury|bond/i.test(sector)) return "السندات وأسعار الفائدة";
  return sector || "السوق";
}

function professionalize(text = "") {
  return String(text)
    .replace(/AI infrastructure demand/gi, "طلب البنية التحتية للذكاء الاصطناعي")
    .replace(/semiconductor/gi, "أشباه الموصلات")
    .replace(/valuation risk/gi, "مخاطر التقييم")
    .replace(/earnings sensitivity/gi, "حساسية الأرباح")
    .replace(/cloud growth/gi, "نمو السحابة")
    .replace(/momentum/gi, "الزخم")
    .replace(/risk/gi, "المخاطر");
}

function arQuestion(question, symbol) {
  if (/financial advice/i.test(question)) return `هل تحليل ${symbol.symbol} يُعد نصيحة مالية؟`;
  if (/why/i.test(question)) return `لماذا يراقب المستثمرون ${symbol.symbol}؟`;
  if (/volatility|drives|affects/i.test(question)) return `ما العوامل التي قد تؤثر في تذبذب ${symbol.symbol}؟`;
  return `ما أهم ما يجب فهمه عن ${symbol.symbol}؟`;
}

function arCategory(category = "") {
  return terminology.terms[category] || category
    .replace(/AI Infrastructure/gi, "البنية التحتية للذكاء الاصطناعي")
    .replace(/Semiconductors/gi, "أشباه الموصلات")
    .replace(/ETF Analysis/gi, "تحليل صناديق المؤشرات")
    .replace(/Market Research/gi, "أبحاث السوق")
    .replace(/Risk & Volatility/gi, "المخاطر والتذبذب")
    .replace(/Diversification/gi, "التنويع")
    .replace(/Market Cycles/gi, "دورات السوق")
    .replace(/Cloud Computing/gi, "الحوسبة السحابية");
}

function arInsightTitle(title, slug) {
  const manual = {
    "ai-infrastructure-demand": "طلب البنية التحتية للذكاء الاصطناعي: مراكز البيانات وسلاسل توريد الرقائق",
    "spy-vs-qqq-explained": "شرح SPY و QQQ: التعرض الواسع مقابل تركيز أسهم النمو",
    "semiconductor-cycle-risks": "مخاطر دورة أشباه الموصلات: المخزون والإنفاق الرأسمالي والتقييم",
    "ai-inference-vs-training": "الاستدلال مقابل التدريب في الذكاء الاصطناعي: مراحل الطلب على GPU",
    "hyperscaler-capex-cycles": "دورات الإنفاق الرأسمالي لمزودي السحابة في البنية التحتية للذكاء الاصطناعي",
    "gpu-vs-cpu-ai-workloads": "وحدات GPU مقابل CPU في أعباء عمل الذكاء الاصطناعي",
    "custom-ai-chips-asics-tpus": "رقائق الذكاء الاصطناعي المخصصة: ASIC و TPU واستراتيجية مزودي السحابة",
    "etf-expense-ratios-explained": "شرح نسب مصاريف صناديق المؤشرات وتأثيرها طويل الأجل",
    "sector-etfs-vs-broad-market": "صناديق القطاعات مقابل صناديق السوق الواسع: التركيز والتنويع",
    "understanding-beta-in-stocks": "فهم بيتا في الأسهم: حساسية السوق ومخاطر التكنولوجيا",
    "portfolio-diversification-basics": "أساسيات تنويع المحافظ: الارتباط بين الأصول وخفض المخاطر",
    "mega-cap-tech-index-concentration": "تركز شركات التكنولوجيا الكبرى داخل المؤشرات وصناديق ETF",
    "cloud-computing-ai-market-structure": "هيكل سوق الحوسبة السحابية والذكاء الاصطناعي",
    "interest-rates-and-tech-stocks": "أسعار الفائدة وأسهم التكنولوجيا: السياسة النقدية وتقييمات النمو",
    "growth-stocks-vs-value-stocks": "أسهم النمو مقابل أسهم القيمة: أطر بحثية مختلفة",
    "semiconductor-market-research-ai-chip-supply-chain-constraints": "قيود سلسلة توريد رقائق الذكاء الاصطناعي في سوق أشباه الموصلات",
    "semiconductor-market-research-inventory-cycles-in-ai-chip-markets": "دورات المخزون في أسواق رقائق الذكاء الاصطناعي",
    "semiconductor-market-research-semiconductor-concentration-risk": "مخاطر التركيز في قطاع أشباه الموصلات",
    "gpu-market-research-accelerator-competition-across-ai-workloads": "منافسة مسرعات الذكاء الاصطناعي عبر أعباء العمل المختلفة",
    "gpu-market-research-gpu-supply-and-demand-signals": "إشارات العرض والطلب في سوق وحدات GPU",
    "ai-infrastructure-research-ai-inference-demand-and-capacity-planning": "طلب الاستدلال في الذكاء الاصطناعي وتخطيط السعة",
    "ai-infrastructure-research-data-center-bottlenecks-and-ai-compute-demand": "اختناقات مراكز البيانات وطلب الحوسبة للذكاء الاصطناعي",
    "ai-infrastructure-research-hyperscaler-spending-signals-for-ai-infrastructure": "إشارات إنفاق مزودي السحابة على بنية الذكاء الاصطناعي"
  };
  if (manual[slug]) return manual[slug];
  return professionalize(title)
    .replace(/Understanding/gi, "فهم")
    .replace(/Explained/gi, "شرح")
    .replace(/Research Context/gi, "سياق بحثي")
    .replace(/Market Structure/gi, "هيكل السوق")
    .replace(/Growth Stocks vs Value Stocks/gi, "أسهم النمو مقابل أسهم القيمة")
    .replace(/Interest Rates and Technology Stocks/gi, "أسعار الفائدة وأسهم التكنولوجيا")
    .replace(/Portfolio Diversification/gi, "تنويع المحافظ")
    .replace(/ETF Expense Ratios/gi, "نسب مصاريف صناديق المؤشرات")
    .replace(/GPUs vs CPUs/gi, "وحدات GPU مقابل CPU")
    .replace(/Cloud Computing/gi, "الحوسبة السحابية")
    .replace(/Mega-Cap Technology Concentration/gi, "تركز شركات التكنولوجيا الكبرى")
    .replace(/Custom AI Chips/gi, "رقائق الذكاء الاصطناعي المخصصة");
}

function arClean(text = "") {
  return String(text)
    .replace(/\bMarket Insights\b/g, "رؤى السوق")
    .replace(/\bAI Infrastructure\b/g, "البنية التحتية للذكاء الاصطناعي")
    .replace(/\bSemiconductors\b/g, "أشباه الموصلات")
    .replace(/\bETF Analysis\b/g, "تحليل صناديق المؤشرات")
    .replace(/\bMarket Research\b/g, "أبحاث السوق")
    .replace(/\bCloud Computing\b/g, "الحوسبة السحابية")
    .replace(/\bRisk\b/g, "المخاطر")
    .replace(/\bVolatility\b/g, "التذبذب")
    .replace(/\bAI Stock Analyzer\b/g, "محلل أسهم الذكاء الاصطناعي")
    .replace(/\bETF Analyzer\b/g, "محلل صناديق المؤشرات")
    .replace(/\bMarket Screener\b/g, "ماسح السوق")
    .replace(/\bMethodology\b/g, "المنهجية");
}

function arInsightDescription(description, title) {
  const clean = professionalize(description || title || "");
  return clean.length > 30 ? clean : `تحليل تعليمي باللغة العربية حول ${title} ضمن سياق أبحاث السوق والمخاطر والروابط الداخلية في TradeAlphaAI.`;
}

function extractTitle(source) {
  const full = path.join(root, source);
  if (!fs.existsSync(full)) return "";
  return extractHtmlTitle(fs.readFileSync(full, "utf8"));
}

function extractDescription(source) {
  const full = path.join(root, source);
  if (!fs.existsSync(full)) return "";
  return extractHtmlDescription(fs.readFileSync(full, "utf8"));
}

function extractHtmlTitle(html) {
  return extractFirst(html, /<title>([\s\S]*?)<\/title>/i) || "";
}

function extractHtmlDescription(html) {
  return extractFirst(html, /<meta name="description" content="([^"]*)"/i) || "";
}

function extractFirst(text, pattern) {
  const match = String(text || "").match(pattern);
  return match ? match[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"').trim() : "";
}

function sourceFromLocalized(localizedHref) {
  const withoutLocale = localizedHref.replace(/^ar\//, "");
  const page = data.pages.find((entry) => entry.arPath === localizedHref || entry.arPath === withoutLocale);
  return page ? `/${normalize(page.source).replace(/index\.html$/, "")}` : `/${withoutLocale}`;
}

function labelForHref(href, locale) {
  const clean = href.replace(/^ar\//, "");
  const page = data.pages.find((entry) => entry.arPath.replace(/^ar\//, "") === clean || entry.source === clean);
  if (!page) return href.split("/").pop().replace(".html", "").toUpperCase();
  if (locale === "ar") return arClean(page.heading || page.symbol || page.title);
  return page.symbol || page.enTitle || page.id;
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
