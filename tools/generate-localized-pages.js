const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const site = "https://www.tradealphaai.com";

const data = readJson("data/localization/ar-pages.json", { pages: [], generatedAt: "2026-05-20" });
const phase1 = readJson("data/localization/ar-phase1-pages.json", { pages: [] });
const marketConfig = readJson("data/market-symbols.json", { symbols: [], hubs: [] });
const landingTranslations = loadLandingTranslations();

const AR = {
  nav: {
    Home: "الرئيسية",
    "AI Stock Analyzer": "بحث الأسهم العالمي",
    "ETF Analyzer": "محلل صناديق المؤشرات",
    "Market Screener": "ماسح السوق",
    "Articles": "المقالات",
    Methodology: "المنهجية",
    Insights: "المقالات",
    Stocks: "الأسهم",
    ETFs: "صناديق المؤشرات"
  },
  labels: {
    "AI Market Portal": "بوابة أبحاث السوق",
    Primary: "التنقل الرئيسي",
    Language: "اختيار اللغة",
    "Generated Stock Page": "صفحة سهم تعليمية",
    "Generated ETF Page": "صفحة صندوق مؤشرات تعليمية",
    "SEO Overview": "نظرة عامة بحثية",
    "Score Breakdown": "تفصيل الدرجة",
    "Company Snapshot": "ملف الشركة",
    "ETF Snapshot": "ملف الصندوق",
    Sector: "القطاع",
    Type: "النوع",
    "Data Mode": "وضع البيانات",
    Priority: "الأولوية",
    Indicators: "المؤشرات",
    "Technical and fundamental cards": "بطاقات فنية وأساسية",
    "Technical Outlook": "النظرة الفنية",
    "Trend context": "سياق الاتجاه",
    "Fundamental Overview": "نظرة أساسية",
    "Growth and valuation": "النمو والتقييم",
    "AI Summary": "ملخص الذكاء الاصطناعي",
    "Educational explanation": "شرح تعليمي",
    "Risk Overview": "نظرة المخاطر",
    "Risk factors": "عوامل المخاطر",
    "Related Assets": "أصول مرتبطة",
    "Explore more": "استكشف المزيد",
    FAQ: "الأسئلة الشائعة",
    "Continue Reading": "تابع القراءة",
    "Explore connected market research": "استكشف أبحاث السوق المرتبطة",
    Explore: "استكشف",
    "Continue research": "تابع البحث",
    "Market Screener": "ماسح السوق",
    "Methodology": "المنهجية",
    "TradeAlpha Score": "درجة TradeAlpha",
    "Market profile": "ملف السوق",
    "educational analysis overview": "نظرة تعليمية عامة",
    "Latest Market Research": "أحدث أبحاث السوق",
    "Rotating Market Themes": "محاور السوق المتغيرة",
    "Research Spotlight": "بحث مختار",
    Contents: "المحتويات",
    "Reference context": "مراجع سياقية",
    "Educational disclaimer": "تنبيه تعليمي",
    "Frequently Asked Questions": "أسئلة شائعة",
    "Related research": "أبحاث مرتبطة",
    "Related Paths": "مسارات مرتبطة",
    "Open Articles": "افتح المقالات",
    "Open Market Screener": "افتح ماسح السوق",
    "Read Articles": "اقرأ المقالات"
  },
  terms: [
    ["Score Model", "نموذج الدرجة"],
    ["Screening Tool", "أداة الفحص"],
    ["Start Screening", "ابدأ الفحص"],
    ["Join AI Market Alerts", "اشترك في تنبيهات TradeAlphaAI"],
    ["Popular Stock Analysis", "تحليل الأسهم الشائعة"],
    ["Screen high-interest stocks", "فحص الأسهم عالية الاهتمام"],
    ["Analyze Stock", "حلل السهم"],
    ["Analyze ETF", "حلل الصندوق"],
    ["View NVDA", "عرض NVDA"],
    ["View SPY", "عرض SPY"],
    ["View QQQ", "عرض QQQ"],
    ["Free Stock Screening", "فحص الأسهم التعليمي"],
    ["Free ETF Screening", "فحص صناديق المؤشرات التعليمي"],
    ["This analysis is for educational and informational purposes only and does not constitute financial advice.", "هذا التحليل لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."],
    ["educational and informational purposes only and does not constitute financial advice", "لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية"],
    ["not financial advice", "ليست نصيحة مالية"],
    ["financial advice", "نصيحة مالية"],
    ["AI Stock Analysis", "تحليل سهم الذكاء الاصطناعي"],
    ["ETF Analysis", "تحليل صناديق المؤشرات"],
    ["Stock Analysis", "تحليل الأسهم"],
    ["ETF Analyzer", "محلل صناديق المؤشرات"],
    ["AI Stock Analyzer", "محلل أسهم الذكاء الاصطناعي"],
    ["Articles", "المقالات"],
    ["Market Research", "أبحاث السوق"],
    ["Market Screener", "ماسح السوق"],
    ["TradeAlpha Score", "درجة TradeAlpha"],
    ["Score Breakdown", "تفصيل الدرجة"],
    ["Technical", "فني"],
    ["Fundamental", "أساسي"],
    ["Momentum", "الزخم"],
    ["Sentiment", "المعنويات"],
    ["Risk", "المخاطر"],
    ["Volatility", "التذبذب"],
    ["Diversification", "التنويع"],
    ["Semiconductors", "أشباه الموصلات"],
    ["Semiconductor", "أشباه الموصلات"],
    ["AI Infrastructure", "البنية التحتية للذكاء الاصطناعي"],
    ["Artificial Intelligence", "الذكاء الاصطناعي"],
    ["Technology", "التكنولوجيا"],
    ["Stocks", "الأسهم"],
    ["Stock", "سهم"],
    ["ETFs", "صناديق المؤشرات"],
    ["ETF", "صندوق مؤشرات"],
    ["Methodology", "المنهجية"],
    ["Home", "الرئيسية"],
    ["Insights", "الرؤى"],
    ["Updated", "آخر تحديث"],
    ["Continue reading", "تابع القراءة"],
    ["Current research themes", "محاور البحث الحالية"],
    ["Featured and recent research", "أبحاث مختارة وحديثة"],
    ["Updated market research timeline", "خط زمني محدث لأبحاث السوق"],
    ["Educational content only.", "محتوى تعليمي فقط."],
    ["Research only.", "للبحث فقط."],
    ["No.", "لا."],
    ["FAQ", "الأسئلة الشائعة"]
  ],
  disclaimer: "هذا المحتوى لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية أو استثمارية أو توصية بشراء أو بيع أي ورقة مالية. الأداء السابق لا يضمن النتائج المستقبلية، ويجب استشارة مختص مؤهل قبل اتخاذ قرارات مالية شخصية."
};

const pages = buildPages();
const pageBySource = new Map(pages.map((page) => [norm(page.source), page]));
const onlySourceArg = process.argv.find((arg) => arg.startsWith("--only="));
const onlySource = onlySourceArg ? norm(onlySourceArg.slice("--only=".length)) : "";

run();

function run() {
  if (onlySource) {
    const page = pageBySource.get(onlySource);
    if (!page) {
      console.error(`No localized page configured for ${onlySource}.`);
      process.exit(1);
    }
    writeLocalizedPage(page, "ar");
    console.log(`Generated Arabic localized page for ${onlySource}.`);
    return;
  }

  normalizeEnglishSources();

  for (const page of pages) {
    writeLocalizedPage(page, "ar");
    writeLocalizedPage(page, "en");
    syncEnglishSource(page);
  }

  writeSitemap();
  syncRobots();
  writeLanguageRouter();
  console.log(`Generated ${pages.length} same-structure Arabic pages and English aliases.`);
}

function buildPages() {
  const merged = [...(data.pages || []), ...(phase1.pages || [])];
  const bySource = new Map();
  for (const page of merged) addPage(bySource, page);

  for (const source of [
    "index.html",
    "stocks.html",
    "etfs.html",
    "ai-stock-screener.html",
    "rankings.html",
    "market-data-status.html",
    "methodology.html"
  ]) addPage(bySource, inferredPage(source, "core"));

  for (const hub of marketConfig.hubs || []) addPage(bySource, inferredPage(hub.pagePath, "hub"));
  for (const symbol of marketConfig.symbols || []) addPage(bySource, inferredPage(symbol.pagePath, symbol.type || "symbol"));
  for (const assetPage of researchAssetPages()) addPage(bySource, inferredPage(assetPage.source, assetPage.type));

  const insightsDir = path.join(root, "insights");
  if (fs.existsSync(insightsDir)) {
    for (const name of fs.readdirSync(insightsDir)) {
      if (!name.endsWith(".html")) continue;
      addPage(bySource, inferredPage(`insights/${name}`, name === "index.html" ? "index" : "article"));
    }
  }

  return [...bySource.values()].filter((page) => fs.existsSync(path.join(root, page.source)));
}

function researchAssetPages() {
  const out = [];
  for (const kind of ["stocks", "etfs"]) {
    const dir = path.join(root, "data", "research-assets", kind);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      const asset = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
      const folder = asset.type === "etf" ? "etfs" : "stocks";
      out.push({ source: `${folder}/${String(asset.symbol).toLowerCase()}.html`, type: asset.type || kind });
    }
  }
  return out;
}

function addPage(map, page) {
  if (!page || !page.source) return;
  const source = norm(page.source);
  if (!map.has(source)) {
    map.set(source, {
      ...page,
      source,
      arPath: page.arPath || `ar/${source}`,
      enPath: page.enPath || `en/${source}`
    });
  } else {
    map.set(source, { ...map.get(source), ...page, source });
  }
}

function inferredPage(source, type) {
  return {
    id: source.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home",
    type,
    source,
    arPath: `ar/${source}`,
    enPath: `en/${source}`
  };
}

function normalizeEnglishSources() {
  const indexPath = path.join(root, "index.html");
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, "utf8");
  html = applyLandingCopy(html, "en");
  html = html.replace(/<html[^>]*>/i, '<html lang="en" dir="ltr">');
  html = html.replace(/<meta property="og:locale" content="[^"]*"/i, '<meta property="og:locale" content="en_US"');
  html = ensureLocaleSwitch(html, pageBySource.get("index.html") || inferredPage("index.html"), "en", false);
  html = replaceHreflangBlock(html, pageBySource.get("index.html") || inferredPage("index.html"), "source");
  fs.writeFileSync(indexPath, html, "utf8");
}

function writeLocalizedPage(page, locale) {
  const sourcePath = path.join(root, page.source);
  let html = fs.readFileSync(sourcePath, "utf8");
  const isArabic = locale === "ar";
  const outRel = isArabic ? page.arPath : page.enPath;

  if (page.source === "index.html") html = applyLandingCopy(html, locale);
  html = html.replace(/\sdata-copy="[^"]*"/g, "");

  html = html.replace(/<html[^>]*>/i, `<html lang="${locale}" dir="${isArabic ? "rtl" : "ltr"}">`);
  html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
    let next = attrs;
    next = next.replace(/\sclass="([^"]*)"/i, (m, cls) => {
      const cleaned = cls.replace(/\blocalized-(?:ar|en)\b/g, "").replace(/\blocalized-page\b/g, "").trim();
      return ` class="${`${cleaned} localized-page localized-${locale}`.trim()}"`;
    });
    if (!/\sclass="/i.test(next)) next += ` class="localized-page localized-${locale}"`;
    return `<body${next} data-locale="${locale}">`;
  });

  html = localizeHead(html, page, locale);
  html = replaceHreflangBlock(html, page, locale);
  html = rewriteUrls(html, page.source, locale);
  html = rewriteModuleImports(html, page.source);
  html = ensureLocaleSwitch(html, page, locale, true);
  html = localizeNavigation(html, locale);
  html = ensureMobileNavigation(html, locale, outRel);
  html = ensureSearchAutocomplete(html, outRel);
  html = html.replace(/<script src="([^"]*landing-i18n\.js)"[^>]*><\/script>\s*/g, "");
  if (isArabic) {
    if (page.source !== "index.html") {
      // Non-home Arabic pages keep the research platform header free of landing-page CTAs.
      html = html.replace(/<a\b[^>]*class="[^"]*header-signal-cta[^"]*"[^>]*>[\s\S]*?<\/a>\s*/gi, "");
    }
    if (page.source === "index.html") {
      html = html.replace(/<span>Gold Trading System<\/span>/g, "<span>منصة التداول وأبحاث السوق</span>");
    }
    html = localizeStaticText(html, page);
    html = localizeArticleFromContentFile(html, page);
    html = normalizeArabicArtifacts(html);
    html = finalArabicCleanup(html);
    if (page.source === "index.html") html = localizeArabicLandingCopy(html);
  }
  html = ensureLanguageRouter(html, outRel);

  ensureDir(path.join(root, path.dirname(outRel)));
  fs.writeFileSync(path.join(root, outRel), html, "utf8");
}

function localizeHead(html, page, locale) {
  const isArabic = locale === "ar";
  const sourceTitle = extractTitle(html);
  const sourceDescription = extractDescription(html);
  const arContent = page.type === "article" ? loadArInsightContent(slugFromSource(page.source)) : null;
  const title = isArabic ? (arContent?.title || translateTitle(page.title || sourceTitle, page)) : (page.enTitle || sourceTitle);
  const description = isArabic ? (arContent?.summary || arContent?.lead || translateText(page.description || sourceDescription)) : (page.enDescription || sourceDescription);
  const canonical = `${site}/${(isArabic ? page.arPath : page.enPath).replace(/index\.html$/, "")}`;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  html = setMeta(html, "name", "description", description);
  html = setMeta(html, "property", "og:locale", isArabic ? "ar_AR" : "en_US");
  html = setMeta(html, "property", "og:title", title);
  html = setMeta(html, "property", "og:description", description);
  html = setMeta(html, "property", "og:url", canonical);
  if (isArabic) {
    html = setMeta(html, "property", "og:image:alt", "معاينة بحثية من TradeAlphaAI");
    html = html.replace(/<meta property="article:section" content="[^"]*"\s*\/?>/i, (m) => m.replace(/content="[^"]*"/, `content="${escapeHtml(translateText((m.match(/content="([^"]*)"/) || [])[1] || "المقالات"))}"`));
  }
  html = setMeta(html, "name", "twitter:title", title);
  html = setMeta(html, "name", "twitter:description", description);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`);
  html = localizeJsonLd(html, title, description, canonical, locale);
  return html;
}

function localizeJsonLd(html, title, description, canonical, locale) {
  return html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi, (block, jsonText) => {
    try {
      const json = JSON.parse(jsonText);
      walkJson(json, (obj) => {
        for (const key of ["name", "headline", "description", "text"]) {
          if (typeof obj[key] === "string") obj[key] = locale === "ar" ? translateText(obj[key]) : obj[key];
        }
        if (obj.url && typeof obj.url === "string" && obj.url.startsWith(site)) obj.url = canonical;
        if (obj["@id"] && typeof obj["@id"] === "string" && obj["@id"].startsWith(site)) obj["@id"] = canonical;
        if (obj.item && typeof obj.item === "string" && obj.item.startsWith(site)) {
          obj.item = locale === "ar" ? obj.item.replace(`${site}/`, `${site}/ar/`) : obj.item.replace(`${site}/`, `${site}/en/`);
        }
        if (obj.mainEntityOfPage?.["@id"]) obj.mainEntityOfPage["@id"] = canonical;
        if (obj.inLanguage) obj.inLanguage = locale;
      });
      if (json["@graph"]) {
        for (const item of json["@graph"]) {
          if (item["@type"] === "Article" || item["@type"] === "WebPage") {
            item.headline = title;
            item.name = title;
            item.description = description;
            item.inLanguage = locale;
          }
        }
      }
      return `<script type="application/ld+json">\n${JSON.stringify(json, null, 2)}\n  </script>`;
    } catch {
      return block;
    }
  });
}

function localizeStaticText(html, page) {
  const protectedBlocks = [];
  html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, (block) => {
    const token = `___TA_PROTECTED_${protectedBlocks.length}___`;
    protectedBlocks.push(block);
    return token;
  });

  html = html.replace(/(aria-label|title|placeholder|alt)="([^"]+)"/g, (m, attr, value) => `${attr}="${escapeHtml(translateText(value))}"`);

  html = html.replace(/>([^<>{}][^<>]*?)</g, (m, text) => {
    if (!text.trim()) return m;
    if (/^\s*(?:[\/|·•-]|\d+(?:\.\d+)?%?|\$[\d,.]+)\s*$/.test(text)) return m;
    return `>${preserveEdgeSpace(text, translateText(text))}<`;
  });

  html = html.replace(/<noscript>([\s\S]*?)<\/noscript>/g, (m, content) => `<noscript>${translateText(content)}</noscript>`);
  protectedBlocks.forEach((block, index) => {
    html = html.replace(`___TA_PROTECTED_${index}___`, block);
  });
  return html;
}

function localizeArticleFromContentFile(html, page) {
  if (page.type !== "article") return html;
  const content = loadArInsightContent(slugFromSource(page.source));
  if (!content) return html;

  html = html.replace(/<nav class="breadcrumb">[\s\S]*?<\/nav>/, (nav) => nav
    .replace(/<span>[^<]*<\/span>\s*<\/nav>$/, `<span>${escapeHtml(content.title || "")}</span></nav>`)
    .replace(/>Insights</g, ">المقالات<")
    .replace(/>Articles</g, ">المقالات<")
  );
  html = html.replace(/<span class="insight-category-badge(?: muted)?">[\s\S]*?<\/span>/g, `<span class="insight-category-badge">${escapeHtml(content.category || "المقالات")}</span>`);
  html = html.replace(/<div class="insight-meta-bar">[\s\S]*?<\/div>/, `<div class="insight-meta-bar">
            <span><strong><time datetime="${escapeHtml(data.generatedAt || "2026-05-20")}">${escapeHtml(data.generatedAt || "2026-05-20")}</time></strong></span>
            <span><strong>${escapeHtml(content.readingTime || "6 دقائق قراءة")}</strong></span>
            <span><strong>فريق TradeAlphaAI لأبحاث السوق</strong></span>
            <span><strong>${escapeHtml(content.category || "المقالات")}</strong></span>
          </div>`);
  html = html.replace(/(<section class="market-section">[\s\S]*?<div class="market-panel[\s\S]*?<span class="insight-category-badge">[\s\S]*?<\/span>[\s\S]*?<h1>)[\s\S]*?(<\/h1>[\s\S]*?<p class="market-lead">)[\s\S]*?(<\/p>)/, `$1${escapeHtml(content.title || "")}$2${escapeHtml(content.lead || content.summary || "")}$3`);
  html = html.replace(/<div class="insight-summary-box">[\s\S]*?<\/div>/, `<div class="insight-summary-box">
            <span>ملخص بحثي</span>
            <p>${escapeHtml(content.summary || content.lead || "")}</p>
          </div>`);
  html = html.replace(/<p class="insight-hero-disclaimer">[\s\S]*?<\/p>/, `<p class="insight-hero-disclaimer">محتوى تعليمي فقط. لا يقدم هذا المقال نصيحة استثمارية أو أهدافاً سعرية أو توصيات على أوراق مالية.</p>`);
  html = html.replace(/<section class="market-section">\s*<div class="market-panel">\s*<span class="insight-category-badge">([\s\S]*?)<p class="market-lead">[\s\S]*?<\/p>/, (m) => {
    return m
      .replace(/<h1>[\s\S]*?<\/h1>/, `<h1>${escapeHtml(content.title || "")}</h1>`)
      .replace(/<p class="market-lead">[\s\S]*?<\/p>/, `<p class="market-lead">${escapeHtml(content.lead || content.summary || "")}</p>`);
  });

  const article = html.match(/<article class="insight-article-body">([\s\S]*?)<\/article>/i);
  if (!article) return html;

  const sectionTitles = (content.sections || []).map((section) => section.title);
  const paragraphQueue = (content.sections || []).flatMap((section) => section.body || []);
  let h2Index = 0;
  let pIndex = 0;
  let faqIndex = 0;
  let summaryIndex = 0;
  let liIndex = 0;
  let localizedArticle = article[0]
    .replace(/<h2([^>]*)>[\s\S]*?<\/h2>/g, (m, attrs) => {
      const title = h2Index < sectionTitles.length ? sectionTitles[h2Index] : "أسئلة شائعة";
      h2Index += 1;
      return `<h2${attrs}>${escapeHtml(title)}</h2>`;
    })
    .replace(/<p([^>]*)>[\s\S]*?<\/p>/g, (m, attrs) => {
      const text = paragraphQueue[pIndex] || editorialFallback(content, pIndex, "paragraph");
      pIndex += 1;
      return `<p${attrs}>${escapeHtml(text)}</p>`;
    })
    .replace(/<li([^>]*)>[\s\S]*?<\/li>/g, (m, attrs) => {
      const translated = translateText(m.replace(/<[^>]+>/g, " "));
      const text = hasEnglishWords(translated) ? editorialFallback(content, liIndex, "bullet") : translated;
      liIndex += 1;
      return `<li${attrs}>${escapeHtml(text)}</li>`;
    })
    .replace(/<summary>[\s\S]*?<\/summary>/g, () => {
      const item = (content.faq || [])[summaryIndex] || {};
      summaryIndex += 1;
      return `<summary>${escapeHtml(item.q || "سؤال شائع")}</summary>`;
    })
    .replace(/<details>\s*<summary>[\s\S]*?<\/summary>\s*<p[^>]*>[\s\S]*?<\/p>\s*<\/details>/g, (m) => {
      const item = (content.faq || [])[faqIndex] || {};
      faqIndex += 1;
      return m.replace(/<p[^>]*>[\s\S]*?<\/p>/, `<p>${escapeHtml(item.a || "")}</p>`);
    })
    .replace(/<div class="insight-disclaimer">[\s\S]*?<\/div>/, `<div class="insight-disclaimer">\n              <p><strong>تنبيه تعليمي:</strong> ${AR.disclaimer}</p>\n            </div>`)
    .replace(/<div class="insight-sources">[\s\S]*?<\/div>/, `<div class="insight-sources">\n              <h3>مراجع سياقية</h3>\n              <ul>\n                <li>وثائق الجهات المصدرة للصناديق والمؤشرات</li>\n                <li>بيانات تاريخية وسياق بحثي تعليمي</li>\n                <li>منهجية TradeAlphaAI للمحتوى التعليمي</li>\n              </ul>\n            </div>`);
  localizedArticle = localizedArticle.replace(/<h2([^>]*id="s-faq"[^>]*)>[\s\S]*?<\/h2>/, '<h2$1>أسئلة شائعة</h2>');

  html = html.replace(article[0], localizedArticle);
  html = localizeInsightSidebar(html, content);
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, articleJsonLd(content, page));
  return html;
}

function localizeInsightSidebar(html, content) {
  const sectionTitles = (content.sections || []).map((section) => section.title);
  let tocIndex = 0;
  return html
    .replace(/<h3>Contents<\/h3>/g, "<h3>المحتويات</h3>")
    .replace(/<h3>Related Research<\/h3>/g, "<h3>أبحاث مرتبطة</h3>")
    .replace(/<h3>Research Use<\/h3>/g, "<h3>طريقة الاستخدام البحثي</h3>")
    .replace(/<span class="eyebrow" style="font-size:10px">Related Research<\/span>/g, '<span class="eyebrow" style="font-size:10px">أبحاث مرتبطة</span>')
    .replace(/<span class="eyebrow" style="font-size:10px">Research Use<\/span>/g, '<span class="eyebrow" style="font-size:10px">طريقة الاستخدام البحثي</span>')
    .replace(/<a href="#s-[^"]+">([^<]+)<\/a>/g, (m, text) => {
      if (/FAQ/i.test(text)) return m.replace(text, "الأسئلة الشائعة");
      const title = sectionTitles[tocIndex] || translateText(text);
      tocIndex += 1;
      return m.replace(text, title);
    })
    .replace(/<span>(Related insight article|Market benchmark beta = 1\.0|Total U\.S\. Market ETF|Related research path)<\/span>/g, (m, text) => `<span>${escapeHtml(translateText(text))}</span>`);
}

function articleJsonLd(content, page) {
  const url = `${site}/${page.arPath}`;
  const faq = (content.faq || []).map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a }
  }));
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "TradeAlphaAI", item: `${site}/ar/` },
          { "@type": "ListItem", position: 2, name: "المقالات", item: `${site}/ar/insights/` },
          { "@type": "ListItem", position: 3, name: content.title, item: url }
        ]
      },
      {
        "@type": "Article",
        headline: content.title,
        description: content.summary || content.lead || content.title,
        datePublished: data.generatedAt || "2026-05-20",
        dateModified: data.generatedAt || "2026-05-20",
        inLanguage: "ar",
        author: { "@type": "Organization", name: "فريق TradeAlphaAI لأبحاث السوق", url: `${site}/ar/` },
        publisher: { "@type": "Organization", name: "TradeAlphaAI", url: site },
        mainEntityOfPage: { "@type": "WebPage", "@id": url }
      },
      { "@type": "FAQPage", mainEntity: faq }
    ]
  };
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n  </script>`;
}

function editorialFallback(content, index, kind) {
  const title = content.title || "هذا الموضوع";
  const topic = title.replace(/\s*\|\s*TradeAlphaAI.*$/i, "");
  const paragraph = [
    `يعرض هذا الجزء من ${topic} زاوية بحثية تساعد القارئ على فهم السياق قبل مقارنة الأسهم أو صناديق المؤشرات المرتبطة.`,
    `الأولوية هنا ليست إصدار حكم استثماري، بل توضيح العوامل التي قد تؤثر في التقييم والتذبذب ودورة السوق.`,
    `ينبغي قراءة هذه النقطة ضمن إطار تعليمي يربط بين البيانات الحالية والمخاطر المحتملة وحدود المنهجية.`,
    `يساعد هذا التحليل على بناء مسار بحث منظم يبدأ من الفكرة الأساسية ثم ينتقل إلى الأصول والقطاعات والروابط ذات الصلة.`
  ];
  const bullet = [
    "عامل بحثي يرتبط بالتقييم، جودة البيانات، وتغير توقعات السوق.",
    "نقطة يجب مراقبتها عند مقارنة التعرض الفردي بالتعرض المتنوع عبر صناديق المؤشرات.",
    "مؤشر سياقي يساعد على فهم الزخم والمخاطر دون تحويله إلى توصية تداول.",
    "متغير قد تتغير أهميته مع دورة السوق، نتائج الأعمال، وسياسة أسعار الفائدة."
  ];
  const list = kind === "bullet" ? bullet : paragraph;
  return list[index % list.length];
}

function hasEnglishWords(value = "") {
  return /\b(the|and|or|with|for|from|this|article|research|market|stock|stocks|etf|risk|read|popular|explore|screener|team|contents|reference|demand|standard|breadth|understanding|investment|advice|provide|growth|cloud|cost|exposure|context|sector|cycle|cycles|revenue|customer|data|center|infrastructure|performance)\b/i.test(value);
}

function applyLandingCopy(html, locale) {
  const map = landingTranslations[locale] || landingTranslations.en || {};
  html = html.replace(/(<[^>]*data-copy="([^"]+)"[^>]*>)([\s\S]*?)(<\/[^>]+>)/g, (m, open, key, current, close) => {
    if (!Object.prototype.hasOwnProperty.call(map, key)) return m;
    return `${open}${escapeHtml(map[key])}${close}`;
  });
  const meta = map.meta || {};
  const title = meta.homeTitle;
  const description = meta.homeDescription;
  if (title) html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (description) html = setMeta(html, "name", "description", description);
  if (meta.locale) html = setMeta(html, "property", "og:locale", meta.locale);
  if (title) {
    html = setMeta(html, "property", "og:title", title);
    html = setMeta(html, "name", "twitter:title", title);
  }
  if (description) {
    html = setMeta(html, "property", "og:description", description);
    html = setMeta(html, "name", "twitter:description", description);
  }
  return html;
}

function localizeNavigation(html, locale) {
  const isArabic = locale === "ar";
  const labels = isArabic ? AR.nav : {
    Home: "Home",
    "AI Stock Analyzer": "Global Stock Research",
    "ETF Analyzer": "ETF Analyzer",
    "Market Screener": "Market Screener",
    "Articles": "Articles",
    Methodology: "Methodology"
  };
  const recommendationsLabel = isArabic ? "أفضل الاختيارات" : "Top Picks";
  const recommendationLinks = isArabic ? [
    ["أفضل 10 أسهم حالياً", "/ar/rankings.html#top-stocks"],
    ["أفضل أسهم الذكاء الاصطناعي", "/ar/rankings.html#top-ai-stocks"],
    ["أفضل أسهم أشباه الموصلات", "/ar/rankings.html#top-semiconductors"],
    ["أفضل أسهم النمو", "/ar/rankings.html#top-growth-stocks"],
    ["أفضل صناديق توزيعات الأرباح", "/ar/rankings.html#top-dividend-etfs"],
    ["أفضل صناديق المؤشرات لعام 2026", "/ar/rankings.html#top-etfs"]
  ] : [
    ["Top 10 Stocks Right Now", "/rankings.html#top-stocks"],
    ["Best AI Stocks", "/rankings.html#top-ai-stocks"],
    ["Best Semiconductor Stocks", "/rankings.html#top-semiconductor-stocks"],
    ["Best Growth Stocks", "/rankings.html#top-growth-stocks"],
    ["Top Dividend ETFs", "/rankings.html#top-dividend-etfs"],
    ["Best ETFs for 2026", "/rankings.html#top-broad-market-etfs"]
  ];
  const recommendations = `<div class="nav-menu">
            <a href="${isArabic ? "/ar/rankings.html" : "/rankings.html"}" class="nav-link nav-menu-trigger">${recommendationsLabel}<span class="nav-badge">${isArabic ? "رائج" : "Hot"}</span></a>
            <div class="nav-dropdown">
              ${recommendationLinks.map(([label, href]) => `<a href="${href}">${label}</a>`).join("\n              ")}
            </div>
          </div>`;
  html = html.replace(/<nav class="nav-group"[^>]*>[\s\S]*?<\/nav>/, (nav) => {
    const aria = isArabic ? "التنقل الرئيسي" : "Primary";
    return `<nav class="nav-group" aria-label="${aria}">
          <a href="${isArabic ? "/ar/" : "/"}" class="nav-link">${labels.Home}</a>
          <a href="${isArabic ? "/ar/stocks.html" : "/stocks.html"}" class="nav-link">${labels["AI Stock Analyzer"]}</a>
          <a href="${isArabic ? "/ar/etfs.html" : "/etfs.html"}" class="nav-link">${labels["ETF Analyzer"]}</a>
          <a href="${isArabic ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html"}" class="nav-link">${labels["Market Screener"]}</a>
          ${recommendations}
          <a href="${isArabic ? "/ar/insights/" : "/insights/"}" class="nav-link">${labels["Articles"]}</a>
          <a href="${isArabic ? "/ar/methodology.html" : "/methodology.html"}" class="nav-link">${labels.Methodology}</a>
        </nav>`;
  });
  return html;
}

function ensureLocaleSwitch(html, page, locale, reorder) {
  const arHref = `/${page.arPath.replace(/index\.html$/, "")}`;
  const enHref = `/${page.source.replace(/index\.html$/, "")}`;
  const label = locale === "ar" ? "اختيار اللغة" : "Language";
  const links = locale === "ar" && reorder
    ? `<a class="lang-switch" data-locale-route="en" href="${enHref || "/"}">English</a>
          <a class="lang-switch" data-locale-route="ar" href="${arHref}">العربية</a>`
    : `<a class="lang-switch" data-locale-route="ar" href="${arHref}">Arabic</a>
          <a class="lang-switch" data-locale-route="en" href="${enHref || "/"}">English</a>`;
  const switcher = `<div class="locale-links" aria-label="${label}">
          ${links}
        </div>`;
  if (html.includes('class="locale-links"')) {
    return html.replace(/<div class="locale-links"[\s\S]*?<\/div>/, switcher);
  }
  return html.replace(/(<\/nav>\s*)/, `$1${switcher}\n        `);
}

function replaceHreflangBlock(html, page, locale) {
  const sourceUrl = `${site}/${page.source.replace(/index\.html$/, "")}`;
  const enUrl = `${site}/${page.enPath.replace(/index\.html$/, "")}`;
  const arUrl = `${site}/${page.arPath.replace(/index\.html$/, "")}`;
  const block = `<!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${sourceUrl}" />
  <link rel="alternate" hreflang="en-US" href="${enUrl}" />
  <link rel="alternate" hreflang="ar" href="${arUrl}" />
  <link rel="alternate" hreflang="x-default" href="${sourceUrl}" />
  <!-- localized-static-pages:end -->`;
  if (/<!-- localized-static-pages:start -->[\s\S]*?<!-- localized-static-pages:end -->/.test(html)) {
    return html.replace(/<!-- localized-static-pages:start -->[\s\S]*?<!-- localized-static-pages:end -->/, block);
  }
  return html.replace(/(<link rel="canonical"[^>]*>\s*)/, `$1${block}\n`);
}

function rewriteUrls(html, sourceRel, locale) {
  return html.replace(/\s(href|src)="([^"]+)"/g, (m, attr, url) => {
    if (/^(?:https?:|mailto:|tel:|\/\/|#|data:)/i.test(url)) return m;
    if (url.startsWith("/")) {
      if (attr === "href") return ` ${attr}="${localizeRootHref(url, locale)}"`;
      return m;
    }
    const resolved = norm(path.join(path.dirname(sourceRel), url));
    if (attr === "href") return ` ${attr}="${localizeResolvedHref(resolved, locale)}"`;
    return ` ${attr}="/${resolved}"`;
  });
}

function rewriteModuleImports(html, sourceRel) {
  const sourceDir = path.dirname(sourceRel);
  return html.replace(/(<script[^>]+type=["']module["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (match, open, body, close) => {
    const fixed = body.replace(/\bfrom\s+(["'])(\.\.?\/[^"']+)\1/g, (m, q, rel) => {
      const resolved = norm(path.join(sourceDir, rel));
      return `from ${q}/${resolved}${q}`;
    });
    return open + fixed + close;
  });
}

function localizeResolvedHref(resolved, locale) {
  const clean = resolved.replace(/^\.\//, "");
  const hash = clean.includes("#") ? `#${clean.split("#").slice(1).join("#")}` : "";
  const noHash = clean.split("#")[0];
  if (isAsset(noHash)) return `/${noHash}${hash}`;
  if (noHash.endsWith("/") || noHash.endsWith(".html")) {
    const normalized = noHash.endsWith("/") ? `${noHash}index.html` : noHash;
    const page = pageBySource.get(normalized);
    if (page) return locale === "ar" ? `/${page.arPath.replace(/index\.html$/, "")}${hash}` : `/${page.source.replace(/index\.html$/, "")}${hash}`;
  }
  return `/${clean}`;
}

function localizeRootHref(url, locale) {
  const clean = url.slice(1);
  if (!clean || clean === "index.html") return locale === "ar" ? "/ar/" : "/";
  if (isAsset(clean)) return url;
  return localizeResolvedHref(clean, locale);
}

function syncEnglishSource(page) {
  const sourcePath = path.join(root, page.source);
  if (!fs.existsSync(sourcePath)) return;
  let html = fs.readFileSync(sourcePath, "utf8");
  html = html.replace(/<html[^>]*>/i, '<html lang="en" dir="ltr">');
  html = replaceHreflangBlock(html, page, "source");
  html = ensureLocaleSwitch(html, page, "en", false);
  html = localizeNavigation(html, "en");
  html = ensureMobileNavigation(html, "en", page.source);
  html = ensureSearchAutocomplete(html, page.source);
  html = ensureLanguageRouter(html, page.source);
  fs.writeFileSync(sourcePath, html, "utf8");
}

function ensureSearchAutocomplete(html, outRel) {
  if (!/(type="search"|data-filter-query)/i.test(html)) return html;
  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (html.includes("js/search-autocomplete.js")) return html;
  return html.replace(/<\/body>/i, `  <script src="${prefix}js/search-autocomplete.js" defer></script>\n</body>`);
}

function ensureLanguageRouter(html, outRel) {
  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (html.includes("js/language-router.js")) return html;
  return html.replace(/<\/body>/i, `  <script src="${prefix}js/language-router.js" defer></script>\n</body>`);
}

function ensureMobileNavigation(html, locale, outRel) {
  const isArabic = locale === "ar";
  const label = isArabic ? "فتح القائمة" : "Open menu";
  const toggle = `<button class="mobile-menu-toggle" type="button" aria-label="${label}" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>`;
  html = html.replace(/\s*<button class="mobile-menu-toggle"[\s\S]*?<\/button>/g, "");
  html = html.replace(/(<\/div>\s*<\/div>\s*<\/div>\s*<div class="site-shell"|<\/div>\s*<\/div>\s*<\/div>\s*<main\b)/, (m) => m);
  html = html.replace(/(<div class="locale-links"[\s\S]*?<\/div>)(?!\s*<button class="mobile-menu-toggle")/, `$1\n        ${toggle}`);

  const depth = norm(path.dirname(outRel)).split("/").filter(Boolean).length;
  const prefix = depth ? "../".repeat(depth) : "";
  if (!html.includes("js/mobile-nav.js")) {
    html = html.replace(/<\/body>/i, `  <script src="${prefix}js/mobile-nav.js" defer></script>\n</body>`);
  }
  return html;
}

function writeSitemap() {
  const urls = pages
    .filter((page) => !isNoindexDraft(page.source))
    .map((page) => `  <url>
    <loc>${site}/${page.arPath.replace(/index\.html$/, "")}</loc>
    <changefreq>${page.type === "article" ? "monthly" : "weekly"}</changefreq>
    <priority>${page.source === "index.html" ? "0.9" : "0.75"}</priority>
  </url>`).join("\n");
  fs.writeFileSync(path.join(root, "sitemap-ar.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`, "utf8");
}

function writeLanguageRouter() {
  const routes = {};
  for (const page of pages) {
    const source = `/${page.source.replace(/index\.html$/, "")}`;
    const sourceIndex = `/${page.source}`;
    const ar = `/${page.arPath.replace(/index\.html$/, "")}`;
    const arIndex = `/${page.arPath}`;
    const en = `/${page.enPath.replace(/index\.html$/, "")}`;
    const enIndex = `/${page.enPath}`;
    routes[source] = { ar, en: source || "/" };
    routes[sourceIndex] = { ar: arIndex, en: sourceIndex };
    routes[ar] = { ar, en: source || "/" };
    routes[arIndex] = { ar: arIndex, en: sourceIndex };
    routes[en] = { ar, en: source || "/" };
    routes[enIndex] = { ar: arIndex, en: sourceIndex };
  }
  const routesJson = JSON.stringify(routes, null, 4);
  fs.writeFileSync(path.join(root, "js/language-router.js"), `(function () {
  const localizedRoutes = ${routesJson};
  const currentPath = window.location.pathname;
  const isArabicPath = currentPath === "/ar" || currentPath.startsWith("/ar/");
  const currentLocale = isArabicPath ? "ar" : "en";
  function mirrorRoute(p) {
    // The site is a strict /ar mirror by construction (bilingual validators
    // enforce EN/AR twins for every published surface), so the counterpart
    // path is always derivable: /x -> /ar/x and /ar/x -> /x. This replaces
    // the old behaviour of falling back to the HOMEPAGE for any path missing
    // from the static map — every newly published article hit that fallback
    // and the language switch dumped readers on the front page.
    var clean = p.replace(/^\\/en\\//, "/");
    if (clean === "/ar" || clean === "/ar/") return { ar: "/ar/", en: "/" };
    if (clean.indexOf("/ar/") === 0) return { ar: clean, en: clean.slice(3) || "/" };
    if (clean === "/") return { ar: "/ar/", en: "/" };
    return { ar: "/ar" + clean, en: clean };
  }
  function resolveRoute(p) {
    if (localizedRoutes[p]) return localizedRoutes[p];
    var withExt = (!p.endsWith('/') && !p.endsWith('.html')) ? p + '.html' : p;
    if (withExt !== p && localizedRoutes[withExt]) return localizedRoutes[withExt];
    return mirrorRoute(withExt);
  }
  const routes = resolveRoute(currentPath);
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = currentLocale === "ar" ? "rtl" : "ltr";
  document.body.classList.toggle("localized-ar", currentLocale === "ar");
  document.body.classList.toggle("localized-en", currentLocale === "en");
  try { localStorage.setItem("ta_lang", currentLocale); } catch (_) {}
  function setActiveLanguage(link, locale) {
    var active = locale === currentLocale;
    link.classList.toggle("active", active);
    if (active) { link.setAttribute("aria-current", "true"); } else { link.removeAttribute("aria-current"); }
  }
  document.querySelectorAll("[data-locale-route]").forEach(function (link) {
    var locale = link.getAttribute("data-locale-route");
    // The baked href (computed per-page at publish time) is authoritative.
    // Only overwrite it when it is missing or generic — the router must
    // never downgrade a specific page link to the homepage.
    var baked = link.getAttribute("href");
    var isGeneric = !baked || baked === "/" || baked === "/ar" || baked === "/ar/";
    if (isGeneric) link.setAttribute("href", routes[locale] || (locale === "ar" ? "/ar/" : "/"));
    link.textContent = locale === "ar" ? "\\u0627\\u0644\\u0639\\u0631\\u0628\\u064a\\u0629" : "English";
    link.addEventListener("click", function () {
      try { localStorage.setItem("ta_lang", locale); } catch (_) {}
    });
    setActiveLanguage(link, locale);
  });
  document.querySelectorAll("a[href]").forEach(function (link) {
    if (link.hasAttribute("data-locale-route") || link.target === "_blank") return;
    var rawHref = link.getAttribute("href");
    if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|https?:\\/\\/|\\/\\/)/i.test(rawHref)) return;
    var url;
    try { url = new URL(rawHref, window.location.origin); } catch (_) { return; }
    if (url.origin !== window.location.origin) return;
    var mapped = localizedRoutes[url.pathname];
    if (!mapped || !mapped[currentLocale]) return;
    link.setAttribute("href", mapped[currentLocale] + url.search + url.hash);
  });
})();
`, "utf8");
}

function syncRobots() {
  const robotsPath = path.join(root, "robots.txt");
  let robots = fs.existsSync(robotsPath) ? fs.readFileSync(robotsPath, "utf8") : "";
  const line = "Sitemap: https://www.tradealphaai.com/sitemap-ar.xml";
  if (!robots.includes(line)) fs.writeFileSync(robotsPath, `${robots.trimEnd()}\n${line}\n`, "utf8");
}

function translateTitle(value, page) {
  const slug = slugFromSource(page.source);
  const content = loadArInsightContent(slug);
  if (content?.title) return content.title;
  return translateText(value || extractTitle(fs.readFileSync(path.join(root, page.source), "utf8")));
}

function translateText(value = "") {
  let out = String(value);
  if (!out.trim()) return out;
  if (/^[A-Z]{1,5}$/.test(out.trim())) return out;
  for (const [en, ar] of [...Object.entries(AR.nav), ...Object.entries(AR.labels)]) {
    out = out.replace(new RegExp(escapeRegExp(en), "g"), ar);
  }
  for (const [en, ar] of AR.terms) out = out.replace(new RegExp(escapeRegExp(en), "gi"), ar);
  out = out
    .replace(/\bNo\.\s*/g, "لا. ")
    .replace(/\bYes\b/g, "نعم")
    .replace(/\bNo\b/g, "لا")
    .replace(/does not/gi, "لا")
    .replace(/do not/gi, "لا")
    .replace(/is not/gi, "ليس")
    .replace(/are not/gi, "ليست")
    .replace(/for educational screening, including/gi, "للفحص التعليمي، ويشمل")
    .replace(/technical score/gi, "الدرجة الفنية")
    .replace(/\bcontext\b/gi, "السياق")
    .replace(/\bRead\b/g, "اقرأ")
    .replace(/\band\b/gi, "و")
    .replace(/Why do investors watch/gi, "لماذا يراقب المستثمرون")
    .replace(/What affects NVIDIA stock volatility/gi, "ما العوامل التي تؤثر في تذبذب سهم NVIDIA")
    .replace(/is watched for/gi, "تتم متابعته بسبب")
    .replace(/can be affected by/gi, "قد يتأثر بـ")
    .replace(/trend direction/gi, "اتجاه السعر")
    .replace(/sector conditions/gi, "ظروف القطاع")
    .replace(/macro data/gi, "البيانات الكلية")
    .replace(/changes in market expectations/gi, "تغير توقعات السوق")
    .replace(/Research brief/gi, "موجز بحثي")
    .replace(/Educational Research/gi, "بحث تعليمي")
    .replace(/Popular Research/gi, "أبحاث شائعة")
    .replace(/Explore This Theme/gi, "استكشف هذا المحور")
    .replace(/Related insight article/gi, "مقال بحثي مرتبط")
    .replace(/Total U\.S\. Market ETF/gi, "صندوق مؤشرات للسوق الأمريكي الكلي")
    .replace(/Market benchmark beta = 1\.0/gi, "معيار السوق: بيتا تساوي 1.0")
    .replace(/Market context/gi, "سياق السوق")
    .replace(/Research context/gi, "السياق البحثي")
    .replace(/Research implications/gi, "دلالات بحثية")
    .replace(/Market structure/gi, "هيكل السوق")
    .replace(/Index methodology/gi, "منهجية المؤشر")
    .replace(/Sector composition/gi, "التركيب القطاعي")
    .replace(/Expense ratios/gi, "نسب المصاريف")
    .replace(/Drawdown/g, "التراجع")
    .replace(/Historical drawdown/gi, "التراجع التاريخي")
    .replace(/Broad U\.S\. equity exposure/gi, "تعرض واسع للأسهم الأمريكية")
    .replace(/S&P 500 sector leadership/gi, "قيادة قطاعات S&P 500")
    .replace(/market breadth/gi, "اتساع السوق")
    .replace(/total market diversification/gi, "تنويع السوق الكلي")
    .replace(/low cost exposure/gi, "تعرض منخفض التكلفة")
    .replace(/broad equity beta/gi, "بيتا واسعة للأسهم")
    .replace(/macro sensitivity/gi, "حساسية الاقتصاد الكلي")
    .replace(/interest-rate sensitivity/gi, "حساسية أسعار الفائدة")
    .replace(/duration risk/gi, "مخاطر المدة")
    .replace(/macro policy expectations/gi, "توقعات السياسة الكلية")
    .replace(/defensive portfolio context/gi, "سياق دفاعي للمحفظة")
    .replace(/dividend quality/gi, "جودة التوزيعات")
    .replace(/value tilt/gi, "ميل إلى أسهم القيمة")
    .replace(/yield context/gi, "سياق العائد")
    .replace(/defensive equity screening/gi, "فحص دفاعي للأسهم")
    .replace(/gold exposure/gi, "التعرض للذهب")
    .replace(/U\.S\. dollar strength/gi, "قوة الدولار الأمريكي")
    .replace(/inflation expectations/gi, "توقعات التضخم")
    .replace(/small-cap breadth/gi, "اتساع أسهم الشركات الصغيرة")
    .replace(/domestic growth sensitivity/gi, "حساسية النمو المحلي")
    .replace(/credit conditions/gi, "ظروف الائتمان")
    .replace(/risk appetite/gi, "شهية المخاطرة")
    .replace(/AI accelerator competition/gi, "منافسة مسرعات الذكاء الاصطناعي")
    .replace(/CPU and GPU demand/gi, "طلب وحدات CPU وGPU")
    .replace(/semiconductor cycles/gi, "دورات أشباه الموصلات")
    .replace(/valuation sensitivity/gi, "حساسية التقييم")
    .replace(/product cycles/gi, "دورات المنتجات")
    .replace(/services revenue/gi, "إيرادات الخدمات")
    .replace(/margin durability/gi, "متانة الهوامش")
    .replace(/consumer demand/gi, "طلب المستهلكين")
    .replace(/large-cap technology sentiment/gi, "معنويات شركات التكنولوجيا الكبرى")
    .replace(/AWS margins/gi, "هوامش AWS")
    .replace(/retail efficiency/gi, "كفاءة تجارة التجزئة")
    .replace(/consumer spending/gi, "إنفاق المستهلكين")
    .replace(/growth sentiment/gi, "معنويات النمو")
    .replace(/networking chips/gi, "رقائق الشبكات")
    .replace(/software integration/gi, "تكامل البرمجيات")
    .replace(/Search advertising/gi, "إعلانات البحث")
    .replace(/AI competition/gi, "منافسة الذكاء الاصطناعي")
    .replace(/cloud growth/gi, "نمو السحابة")
    .replace(/regulatory risk/gi, "المخاطر التنظيمية")
    .replace(/margin quality/gi, "جودة الهوامش")
    .replace(/digital advertising/gi, "الإعلانات الرقمية")
    .replace(/AI engagement/gi, "تفاعل الذكاء الاصطناعي")
    .replace(/platform risk/gi, "مخاطر المنصة")
    .replace(/large-cap growth sentiment/gi, "معنويات نمو الشركات الكبرى")
    .replace(/cloud growth/gi, "نمو السحابة")
    .replace(/AI platform demand/gi, "طلب منصات الذكاء الاصطناعي")
    .replace(/software margins/gi, "هوامش البرمجيات")
    .replace(/large-cap quality/gi, "جودة الشركات الكبرى")
    .replace(/enterprise spending/gi, "إنفاق المؤسسات")
    .replace(/AI software demand/gi, "طلب برمجيات الذكاء الاصطناعي")
    .replace(/government and enterprise contracts/gi, "عقود حكومية ومؤسسية")
    .replace(/AI server demand/gi, "طلب خوادم الذكاء الاصطناعي")
    .replace(/margin volatility/gi, "تذبذب الهوامش")
    .replace(/customer concentration/gi, "تركز العملاء")
    .replace(/high-beta momentum/gi, "زخم عالي البيتا")
    .replace(/EV demand/gi, "طلب المركبات الكهربائية")
    .replace(/pricing pressure/gi, "ضغط الأسعار")
    .replace(/high-beta growth/gi, "نمو عالي البيتا")
    .replace(/margin sensitivity/gi, "حساسية الهوامش")
    .replace(/momentum risk/gi, "مخاطر الزخم")
    .replace(/AI chip demand/gi, "طلب رقائق الذكاء الاصطناعي")
    .replace(/export risk/gi, "مخاطر قيود التصدير")
    .replace(/inventory cycles/gi, "دورات المخزون")
    .replace(/technology momentum/gi, "زخم التكنولوجيا")
    .replace(/exposure/gi, "التعرض")
    .replace(/concentration/gi, "التركز")
    .replace(/cost/gi, "التكلفة")
    .replace(/score context/gi, "سياق الدرجة")
    .replace(/readers/gi, "القراء")
    .replace(/reader/gi, "القارئ")
    .replace(/standard/gi, "معيار")
    .replace(/demand/gi, "الطلب")
    .replace(/breadth/gi, "الاتساع")
    .replace(/already/gi, "بالفعل")
    .replace(/(\b[A-Z]{2,5}\b) stock FAQ/gi, "أسئلة شائعة عن سهم $1")
    .replace(/(\b[A-Z]{2,5}\b) screening score/gi, "درجة فحص $1")
    .replace(/(\b[A-Z]{2,5}\b) educational analysis overview/gi, "نظرة تعليمية عامة على $1")
    .replace(/AI infrastructure demand/gi, "طلب البنية التحتية للذكاء الاصطناعي")
    .replace(/semiconductor leadership/gi, "ريادة أشباه الموصلات")
    .replace(/valuation risk/gi, "مخاطر التقييم")
    .replace(/earnings sensitivity/gi, "حساسية الأرباح")
    .replace(/broad U\.S\. large-cap exposure/gi, "تعرض واسع للشركات الأمريكية الكبرى")
    .replace(/growth- and technology-tilted/gi, "مائل إلى النمو والتكنولوجيا")
    .replace(/Mock/gi, "تعليمي")
    .replace(/Stock/gi, "سهم")
    .replace(/ETF/gi, "صندوق مؤشرات");
  return out;
}

function normalizeArabicArtifacts(html) {
  const _b = [];
  html = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, m => { _b.push(m); return `\x00B${_b.length - 1}\x00`; });
  html = html
    .replace(/<span class="eyebrow">الأسهم Research<\/span>/g, '<span class="eyebrow">أبحاث الأسهم العالمية</span>')
    .replace(/Research any سهم, anywhere in the world/g, "ابحث في أي سهم حول العالم")
    .replace(/Research الأسهم globally with a transparent درجة TradeAlpha, analyst-style explanations, المخاطر overview, و educational السياق\. Not limited to U\.S\. الأسهم — no buy or sell recommendations\./g, "ابحث في الأسهم حول العالم عبر درجة TradeAlpha شفافة، وشروحات بحثية واضحة، وملخص للمخاطر، وسياق تعليمي منظم. لا تقتصر التغطية على الأسهم الأمريكية، ولا تقدم الصفحة توصيات شراء أو بيع.")
    .replace(/Score\s+النمطl?/g, "نموذج الدرجة")
    .replace(/Score\s+Model/g, "نموذج الدرجة")
    .replace(/Popular\s+تحليل الأسهم/g, "تحليل الأسهم الشائعة")
    .replace(/Screen high-interest\s+الأسهم/g, "فحص الأسهم عالية الاهتمام")
    .replace(/Free AI\s+صندوق مؤشرات\s+Screening/g, "فحص صناديق المؤشرات بالذكاء الاصطناعي")
    .replace(/Free\s+صندوق مؤشرات\s+Screening\s+Tool/g, "أداة فحص صناديق المؤشرات")
    .replace(/AI\s+محلل صناديق المؤشرات\s*\|\s*Free\s+صندوق مؤشرات\s+Screening\s+Tool\s*\|\s*TradeAlphaAI/g, "محلل صناديق المؤشرات | أداة فحص صناديق المؤشرات | TradeAlphaAI")
    .replace(/Screen\s+صناديق المؤشرات\s+with\s+[^<"]+/g, "فحص صناديق المؤشرات مع تحليل بحثي تعليمي ونسب المصاريف وأكبر المكونات والتعرض القطاعي والدرجة الفنية وملخص المخاطر.")
    .replace(/Analyze\s+صندوق مؤشرات/g, "حلل الصندوق")
    .replace(/>View\s+([A-Z]{1,5})</g, ">عرض $1<")
    .replace(/<strong>Screening<\/strong>/g, "<strong>فحص السوق</strong>")
    .replace(/\bScreening\b/g, "فحص السوق")
    .replace(/Screen\s+الأسهم\s+و\s+صناديق المؤشرات\s+by\s+score[^<]*/g, "فحص الأسهم وصناديق المؤشرات حسب الدرجة والزخم والمخاطر والقطاع والمعنويات")
    .replace(/\bProvider\b/g, "مزود البيانات")
    .replace(/>Screen\s+صناديق المؤشرات</g, ">فحص صناديق المؤشرات<")
    .replace(/>Screen\s+الأسهم</g, ">فحص الأسهم<")
    .replace(/Popular educational\s+سهم research المحاور/g, "محاور بحث تعليمية شائعة للأسهم")
    .replace(/Popular educational\s+سهم\s+research/g, "بحث تعليمي شائع للأسهم")
    .replace(/تعليمي use only/g, "للاستخدام التعليمي فقط")
    .replace(/\bCompliance\b/g, "الامتثال")
    .replace(/security recommendations/g, "توصيات الأوراق المالية")
    .replace(/price targets/g, "أسعاراً مستهدفة")
    .replace(/These قائمة متابعةs are for educational و informational purposes only و لا constitute نصيحة مالية, نصيحة استثمارية, أسعارا مستهدفة, or توصيات الأوراق المالية\./g, "هذه القوائم لأغراض تعليمية ومعلوماتية فقط ولا تُعد نصيحة مالية أو استثمارية أو أهدافاً سعرية أو توصيات بأوراق مالية.")
    .replace(/These قائمة متابعةs are for educational[^<.]*\./g, "هذه القوائم لأغراض تعليمية ومعلوماتية فقط ولا تُعد نصيحة مالية أو استثمارية أو أهدافاً سعرية أو توصيات بأوراق مالية.")
    .replace(/predict future performance/g, "التنبؤ بالأداء المستقبلي")
    .replace(/رؤى السوق content is for educational[^<]*/g, "محتوى رؤى السوق لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية أو استثمارية. لا توصي TradeAlphaAI بأوراق مالية ولا تقدم أهدافاً سعرية أو تنبؤات بالأداء المستقبلي.")
    .replace(/تعليمي multi-factor\s+screening for الأسهم و صناديق المؤشرات/g, "فحص متعدد المعايير للأسهم وصناديق المؤشرات")
    .replace(/multi-factor\s+screening for الأسهم/g, "فحص متعدد المعايير للأسهم")
    .replace(/multi-factor\s+screening/g, "فحص متعدد المعايير")
    .replace(/Research Platform/g, "منصة الأبحاث")
    .replace(/Interest Rate بحث: حساسية أسعار الفائدة In أسهم النمو/g, "بحث أسعار الفائدة: حساسية أسهم النمو لأسعار الفائدة")
    .replace(/صناديق صندوق مؤشرات/g, "صناديق المؤشرات")
    .replace(/Static Research/g, "بحث ثابت")
    .replace(/ثابت Research/g, "بحث ثابت")
    .replace(/static research data/g, "بيانات بحثية ثابتة")
    .replace(/transparent static research data/g, "بيانات بحثية ثابتة وشفافة")
    .replace(/The platform uses static educational data with a provider architecture prepared for future market data APIs\./g, "تستخدم المنصة بيانات تعليمية ثابتة مع بنية مزود جاهزة للتكامل مع واجهات بيانات السوق مستقبلا.")
    .replace(/Research popular U\.S\. الأسهم with a transparent درجة TradeAlpha, analyst-style explanations, المخاطر overview, و educational قائمة متابعة السياق\. لا buy or sell recommendations are provided\./g, "ابحث في الأسهم الأمريكية الشائعة عبر درجة TradeAlpha شفافة وشرح بحثي منظم وملخص للمخاطر وسياق تعليمي لقوائم المتابعة. لا يتم تقديم توصيات شراء أو بيع.")
    .replace(/Research popular U\.S\. stocks with a transparent درجة TradeAlpha, analyst-style explanations, المخاطر overview, و educational قائمة متابعة السياق\. لا buy or sell recommendations are provided\./g, "ابحث في الأسهم الأمريكية الشائعة عبر درجة TradeAlpha شفافة وشرح بحثي منظم وملخص للمخاطر وسياق تعليمي لقوائم المتابعة. لا يتم تقديم توصيات شراء أو بيع.")
    .replace(/Research popular U\.S\.[^<]+analyst-style explanations[^<]+provided\./g, "ابحث في الأسهم الأمريكية الشائعة عبر درجة TradeAlpha شفافة وشرح بحثي منظم وملخص للمخاطر وسياق تعليمي لقوائم المتابعة. لا يتم تقديم توصيات شراء أو بيع.")
    .replace(/محلل أسهم الذكاء الاصطناعي for فني, أساسي, و المخاطر-aware screening/g, "محلل أسهم الذكاء الاصطناعي للفحص الفني والأساسي والواعي بالمخاطر")
    .replace(/Use the free TradeAlphaAI محلل أسهم الذكاء الاصطناعي for educational سهم screening, فني scores, المخاطر overview, و قائمة متابعة candidate research\./g, "استخدم محلل أسهم الذكاء الاصطناعي من TradeAlphaAI لفحص الأسهم تعليميا مع درجات فنية وملخص للمخاطر وبحث مرشحي قوائم المتابعة.")
    .replace(/محلل أسهم الذكاء الاصطناعي \| Free سهم Screening Tool \| TradeAlphaAI/g, "محلل أسهم الذكاء الاصطناعي | أداة فحص الأسهم التعليمية | TradeAlphaAI")
    .replace(/Popular educational سهم research المحاور/g, "محاور بحث تعليمية شائعة للأسهم")
    .replace(/SEO Research Paths/g, "مسارات البحث")
    .replace(/using transparent بيانات بحثية ثابتة/g, "باستخدام بيانات بحثية ثابتة وشفافة")
    .replace(/Move from research to a structured trading workflow/g, "انتقل من البحث إلى مسار تداول منظم")
    .replace(/Research workflow area for future premium screening views\./g, "مساحة بحثية لعروض فحص متقدمة مستقبلا.")
    .replace(/How Scores Work/g, "كيف تعمل الدرجات")
    .replace(/TradeAlphaAI Focus القوائم/g, "قوائم تركيز TradeAlphaAI")
    .replace(/TradeAlphaAI Focus List/g, "قائمة تركيز TradeAlphaAI")
    .replace(/Research Rankings and Watchlists/g, "تصنيفات وقوائم متابعة بحثية")
    .replace(/Research Rankings و Watchlists/g, "تصنيفات وقوائم متابعة بحثية")
    .replace(/Educational research rankings and watchlists for AI infrastructure stocks, semiconductor leaders, mega-cap technology, broad market ETFs, dividend ETFs, growth ETFs, and high-volatility research candidates\./g, "تصنيفات وقوائم متابعة بحثية تعليمية لأسهم البنية التحتية للذكاء الاصطناعي وقادة أشباه الموصلات والتكنولوجيا الكبرى وصناديق السوق الواسع وصناديق التوزيعات وصناديق النمو ومرشحي التقلب المرتفع.")
    .replace(/Most followed AI-linked research candidates from the TradeAlphaAI universe\. Educational ranking only, not financial advice\./g, "أبرز مرشحي البحث المرتبطين بالذكاء الاصطناعي ضمن تغطية TradeAlphaAI. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Data center, accelerator, cloud, and infrastructure names followed by the research desk\. Educational ranking only, not financial advice\./g, "أسماء مراكز البيانات والمسرعات والحوسبة السحابية والبنية التحتية التي يتابعها مكتب الأبحاث. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Higher-beta research candidates where risk context matters as much as upside narratives\. Educational ranking only, not financial advice\./g, "مرشحون بحثيون أعلى تقلبا حيث يهم سياق المخاطر بقدر أهمية روايات النمو. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/The TradeAlpha Score combines technical score, fundamental score, momentum score, sentiment score, and risk adjustment\. The output uses safe screening labels such as Strong Setup, Neutral Setup, Weak Setup, Watchlist Candidate, High Risk, and Overextended\./g, "تجمع درجة TradeAlpha بين الدرجة الفنية والدرجة الأساسية والزخم والمعنويات وتعديل المخاطر. وتستخدم المخرجات تسميات فحص آمنة مثل إعداد قوي أو محايد أو ضعيف أو مرشح لقائمة المتابعة أو مخاطر مرتفعة أو امتداد زائد.")
    .replace(/Watchlists currently remain static-compatible\. Future releases can add saved views, alerts, portfolio research insights, and account-based persistence through protected services\./g, "تبقى قوائم المتابعة متوافقة مع التشغيل الثابت حاليا. ويمكن للإصدارات اللاحقة إضافة العروض المحفوظة والتنبيهات ورؤى أبحاث المحافظ وحفظ التفضيلات عبر خدمات محمية.")
    .replace(/Mega-Cap Tech/g, "التكنولوجيا الكبرى")
    .replace(/mega-cap tech/g, "التكنولوجيا الكبرى")
    .replace(/market leadership/g, "قيادة السوق")
    .replace(/passive investing/g, "الاستثمار السلبي")
    .replace(/Trending صناديق المؤشرات/g, "صناديق مؤشرات رائجة")
    .replace(/Top الأسهم و صناديق المؤشرات to watch across major market المحاور/g, "أفضل الأسهم وصناديق المؤشرات للمتابعة عبر محاور السوق الرئيسية")
    .replace(/استكشف high-CTR research قائمة متابعةs for AI الأسهم, أشباه الموصلات leaders, growth الأسهم, dividend صناديق المؤشرات, السوق الواسع صناديق المؤشرات, و high-التذبذب candidates\. These lists are بحث تعليمي rankings, not buy or sell recommendations\./g, "استكشف قوائم بحثية جذابة لأسهم الذكاء الاصطناعي وقادة أشباه الموصلات وأسهم النمو وصناديق التوزيعات وصناديق السوق الواسع ومرشحي التقلب المرتفع. هذه القوائم تصنيفات بحثية تعليمية وليست توصيات شراء أو بيع.")
    .replace(/بحث تعليمي rankings و قائمة متابعةs for البنية التحتية للذكاء الاصطناعي الأسهم, أشباه الموصلات leaders, mega-cap التكنولوجيا, السوق الواسع صناديق المؤشرات, dividend صناديق المؤشرات, growth صناديق المؤشرات, و high-التذبذب research candidates\./g, "تصنيفات وقوائم متابعة بحثية تعليمية لأسهم البنية التحتية للذكاء الاصطناعي وقادة أشباه الموصلات والتكنولوجيا الكبرى وصناديق السوق الواسع وصناديق التوزيعات وصناديق النمو ومرشحي التقلب المرتفع.")
    .replace(/Top AI الأسهم Right Now/g, "أفضل أسهم الذكاء الاصطناعي حالياً")
    .replace(/Top Semiconductor الأسهم/g, "أفضل أسهم أشباه الموصلات")
    .replace(/Best Growth الأسهم to Watch/g, "أفضل أسهم النمو للمتابعة")
    .replace(/Top Dividend صناديق المؤشرات/g, "أفضل صناديق توزيعات الأرباح")
    .replace(/Top Broad Market صناديق المؤشرات/g, "أفضل صناديق السوق الواسع")
    .replace(/Most Followed AI Infrastructure الأسهم/g, "أكثر أسهم البنية التحتية للذكاء الاصطناعي متابعة")
    .replace(/High التذبذب Watchlist/g, "قائمة الأسهم عالية التقلب")
    .replace(/Most Followed Tech الأسهم/g, "أكثر الأسهم التقنية متابعة")
    .replace(/Most followed AI-linked research candidates from the TradeAlphaAI universe\. تصنيف بحثي تعليمي only, ليست نصيحة مالية\./g, "أبرز مرشحي البحث المرتبطين بالذكاء الاصطناعي ضمن تغطية TradeAlphaAI. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Data center, accelerator, cloud, و infrastructure names followed by the research desk\. تصنيف بحثي تعليمي only, ليست نصيحة مالية\./g, "أسماء مراكز البيانات والمسرعات والحوسبة السحابية والبنية التحتية التي يتابعها مكتب الأبحاث. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Chip, equipment, memory, و AI compute names with strong research relevance\. تصنيف بحثي تعليمي only, ليست نصيحة مالية\./g, "شركات الرقائق والمعدات والذاكرة وحوسبة الذكاء الاصطناعي ذات أهمية بحثية عالية. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Growth-oriented technology و platform companies for educational comparison\. تصنيف بحثي تعليمي only, ليست نصيحة مالية\./g, "شركات تقنية ومنصات موجهة للنمو للمقارنة التعليمية. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Higher-beta research candidates where المخاطر السياق matters as much as upside narratives\. تصنيف بحثي تعليمي only, ليست نصيحة مالية\./g, "مرشحون بحثيون أعلى تقلبا حيث يهم سياق المخاطر بقدر أهمية روايات النمو. تصنيف بحثي تعليمي وليس نصيحة مالية.")
    .replace(/Investors follow ([A-Z0-9.-]+) for signals about [^<.]+?\./g, "يتابع الباحثون $1 لفهم إشارات المحاور المرتبطة به ومتانة الإيرادات والموقع التنافسي وحساسية التقييم وقيادة القطاع.")
    .replace(/Investors follow ([A-Z0-9.-]+) to compare [^<.]+?\./g, "يتابع الباحثون $1 لمقارنة التعرض ودور التنويع وملف المخاطر وحساسية السوق الواسع.")
    .replace(/Why do investors follow ([A-Z0-9.-]+)\?/g, "لماذا يتابع الباحثون $1؟")
    .replace(/([A-Z0-9.-]+) is followed for [^<.]+?\./g, "يحظى $1 بالمتابعة لأغراض بحثية مرتبطة بالمحاور والسياق القطاعي والتقييم.")
    .replace(/Why investors follow it/g, "لماذا يتابعه المستثمرون")
    .replace(/Research السياق/g, "السياق البحثي")
    .replace(/التنويع role/g, "دور التنويع")
    .replace(/Stronger الطلب tied to البنية التحتية للذكاء الاصطناعي\./g, "طلب أقوى مرتبط بالبنية التحتية للذكاء الاصطناعي.")
    .replace(/Durable margins و execution quality\./g, "هوامش متينة وجودة تنفيذ مرتفعة.")
    .replace(/Potential leadership inside its sector research theme\./g, "إمكانات قيادة ضمن محوره القطاعي البحثي.")
    .replace(/لا\. This page is بحث تعليمي only و لا provide investment or نصيحة مالية\./g, "لا. هذه الصفحة بحث تعليمي فقط ولا تقدم نصيحة استثمارية أو مالية.")
    .replace(/AI GPU Infrastructure/g, "بنية GPU للذكاء الاصطناعي")
    .replace(/Cloud AI/g, "الذكاء الاصطناعي السحابي")
    .replace(/CUDA ecosystem, AI data-center GPU الطلب, و أشباه الموصلات leadership السياق\./g, "منظومة CUDA وطلب وحدات GPU في مراكز بيانات الذكاء الاصطناعي وسياق قيادة أشباه الموصلات.")
    .replace(/Azure AI, enterprise software, و البنية التحتية للذكاء الاصطناعي monetization research\./g, "أبحاث Azure AI وبرمجيات المؤسسات وفرص تحقيق العائد من البنية التحتية للذكاء الاصطناعي.")
    .replace(/الزخم Leaders/g, "قادة الزخم")
    .replace(/أشباه الموصلات Leaders/g, "قادة أشباه الموصلات")
    .replace(/Market candidates/g, "مرشحو السوق")
    .replace(/\u00e2(?:\u20ac\u201d|\u20ac\u201c)/g, "-")
    .replace(/\u00e2\u2020\u2019/g, "←")
    .replace(/\u00e2\u008f\u00b1/g, "")
    .replace(/\u00f0\u0178\u201c\u201a/g, "")
    .replace(/\u00f0\u0178\u201c\u2026/g, "")
    .replace(/\u00c2\u00b7/g, "·")
    .replace(/Read\s*←/g, "اقرأ ←")
    .replace(/AI Investing/g, "استثمار الذكاء الاصطناعي")
    .replace(/Index المنهجية/g, "منهجية المؤشر")
    .replace(/TradeAlphaAI رؤى السوق Team/g, "فريق TradeAlphaAI لأبحاث السوق")
    .replace(/Understوing/g, "فهم")
    .replace(/understوing/g, "فهم")
    .replace(/demو/g, "الطلب")
    .replace(/bاقرأth/g, "الاتساع")
    .replace(/alاقرأy/g, "بالفعل")
    .replace(/stوard/g, "معيار")
    .replace(/InfiniBو/g, "InfiniBand")
    .replace(/bوwidth/g, "عرض النطاق")
    .replace(/expو/g, "يوسع")
    .replace(/Pوemic/g, "صدمة الجائحة")
    .replace(/اقرأ article/g, "اقرأ المقال")
    .replace(/Related Research/g, "أبحاث مرتبطة")
    .replace(/Research Hub/g, "محور أبحاث")
    .replace(/AI Stock Screener/g, "ماسح أسهم الذكاء الاصطناعي")
    .replace(/ETF Screener/g, "ماسح صناديق المؤشرات")
    .replace(/\bScreener\b/g, "ماسح السوق")
    .replace(/Generated Hub/g, "محور بحثي")
    .replace(/Generated Stock Page/g, "صفحة سهم تعليمية")
    .replace(/Generated ETF Page/g, "صفحة صندوق مؤشرات تعليمية")
    .replace(/Educational ([^<.]+?) hub covering/gi, "محور تعليمي يغطي")
    .replace(/Educational growth الأسهم hub covering/gi, "محور تعليمي لأسهم النمو يغطي")
    .replace(/Educational dividend صندوق مؤشرات hub covering/gi, "محور تعليمي لصناديق مؤشرات التوزيعات يغطي")
    .replace(/Educational أشباه الموصلات الأسهم hub covering/gi, "محور تعليمي لأسهم أشباه الموصلات يغطي")
    .replace(/revenue growth/g, "نمو الإيرادات")
    .replace(/sector المخاطرs/g, "مخاطر القطاع")
    .replace(/sector التركز/g, "التركز القطاعي")
    .replace(/interest rates/g, "أسعار الفائدة")
    .replace(/currency strength/g, "قوة العملة")
    .replace(/commodity التعرض/g, "التعرض للسلع")
    .replace(/liquidity/g, "السيولة")
    .replace(/the التذبذب of top holdings/g, "تذبذب أكبر المكونات")
    .replace(/What affects صندوق مؤشرات التذبذب\?/g, "ما العوامل التي تؤثر في تذبذب صندوق المؤشرات؟")
    .replace(/Does the analyzer provide نصيحة مالية\?/g, "هل يقدم المحلل نصيحة مالية؟")
    .replace(/Can I use this as a سهم screener\?/g, "هل يمكن استخدامه كماسح للأسهم؟")
    .replace(/it is designed as an educational سهم screening experience/gi, "نعم، صُمم كتجربة تعليمية لفحص الأسهم")
    .replace(/Why include المخاطر adjustment\?/g, "لماذا يتضمن النموذج تعديلا للمخاطر؟")
    .replace(/المخاطر adjustment prevents high الزخم or strong أساسيs from/gi, "يساعد تعديل المخاطر على منع الزخم المرتفع أو الأساسيات القوية من")
    .replace(/Does درجة TradeAlpha provide نصيحة مالية\?/g, "هل تقدم درجة TradeAlpha نصيحة مالية؟")
    .replace(/المنهجية questions/g, "أسئلة المنهجية")
    .replace(/تحليل سهم الذكاء الاصطناعي questions/g, "أسئلة تحليل أسهم الذكاء الاصطناعي")
    .replace(/صندوق مؤشرات التذبذب قد يتأثر بـ/g, "قد يتأثر تذبذب صندوق المؤشرات بـ")
    .replace(/Use this page as educational السياق alongside/gi, "استخدم هذه الصفحة كسياق تعليمي إلى جانب")
    .replace(/Built for education و هيكل السوق understanding, not investment advice\./gi, "أُعدت هذه الصفحة للتثقيف وفهم بنية السوق، وليست نصيحة استثمارية.")
    .replace(/not investment advice/gi, "وليست نصيحة استثمارية")
    .replace(/investment advice/gi, "نصيحة استثمارية")
    .replace(/Market sensitivity و equity duration/g, "حساسية السوق ومدة الأسهم")
    .replace(/Multiple frameworks comparison/g, "مقارنة بين أطر متعددة")
    .replace(/Market sensitivity explained/g, "شرح حساسية السوق")
    .replace(/Mega-cap weight in major indices/g, "وزن الشركات العملاقة في المؤشرات الرئيسية")
    .replace(/Gold — macro hedge و portfolio السياق/g, "الذهب: تحوط كلي وسياق للمحفظة")
    .replace(/Long-duration bond صندوق مؤشرات/g, "صندوق مؤشرات للسندات طويلة المدة")
    .replace(/Broad-market rate comparison/g, "مقارنة أثر الفائدة على السوق الواسع")
    .replace(/Open ماسح السوق/g, "افتح ماسح السوق")
    .replace(/Open hub/g, "افتح المحور")
    .replace(/Open رؤى السوق/g, "افتح رؤى السوق")
    .replace(/Open Market Data Status/g, "افتح حالة بيانات السوق")
    .replace(/Load/g, "اعرض")
    .replace(/Use Case/g, "حالة الاستخدام")
    .replace(/Expense Ratio/g, "نسبة المصاريف")
    .replace(/Popular صناديق المؤشرات/g, "صناديق مؤشرات شائعة")
    .replace(/Screen broad market, growth, و التعرض للذهب/gi, "افحص السوق الواسع والنمو والتعرض للذهب")
    .replace(/Phase 2 supports/gi, "تدعم المرحلة الثانية")
    .replace(/with realistic تعليمي صندوق مؤشرات allocation data/gi, "مع بيانات تعليمية واقعية لتوزيع صناديق المؤشرات")
    .replace(/How SPY compares to QQQ/g, "كيف يقارن SPY مع QQQ")
    .replace(/AI Market بحث مختار/g, "أبحاث مختارة لسوق الذكاء الاصطناعي")
    .replace(/AI الأسهم research hub/g, "محور أبحاث أسهم الذكاء الاصطناعي")
    .replace(/صندوق مؤشرات Education/g, "تعليم صناديق المؤشرات")
    .replace(/A curated finance research library[^<.]*/gi, "مكتبة أبحاث مالية منظمة لفهم الأسهم وصناديق المؤشرات ومخاطر المحافظ والسياق الكلي")
    .replace(/A fast educational screener for watchlist candidates, الزخم leaders, المخاطر overview, defensive profiles, أشباه الموصلات leaders, البنية التحتية للذكاء الاصطناعي الأسهم, و trending صناديق المؤشرات\./gi, "ماسح تعليمي سريع لقوائم المتابعة وقادة الزخم وملخصات المخاطر والملفات الدفاعية وقادة أشباه الموصلات وأسهم البنية التحتية للذكاء الاصطناعي وصناديق المؤشرات الرائجة.")
    .replace(/Stock Analyzer/g, "محلل الأسهم")
    .replace(/سهم Analyzer/g, "محلل الأسهم")
    .replace(/Curated Assets/g, "أصول مختارة")
    .replace(/watchlist candidates/g, "مرشحو قوائم المتابعة")
    .replace(/Recently Viewed/g, "شوهدت مؤخرا")
    .replace(/Your local research trail/g, "مسار أبحاثك المحلي")
    .replace(/Does a strong صندوق مؤشرات score mean it is a recommendation\?/g, "هل تعني الدرجة القوية لصندوق المؤشرات أنها توصية؟")
    .replace(/The score is an educational screening label only\./g, "الدرجة مؤشر فحص تعليمي فقط.")
    .replace(/not as a ranking recommendation\./g, "وليس كتوصية ترتيبية.")
    .replace(/Why do SPY و QQQ behave differently\?/g, "لماذا يتحرك SPY و QQQ بشكل مختلف؟")
    .replace(/SPY is broader large-cap التعرض, while QQQ is more concentrated in growth و التكنولوجيا-linked holdings\./g, "يوفر SPY تعرضا أوسع للشركات الكبرى، بينما يتركز QQQ بدرجة أكبر في مكونات مرتبطة بالنمو والتكنولوجيا.")
    .replace(/Why compare نسب المصاريف\?/g, "لماذا نقارن نسب المصاريف؟")
    .replace(/نسب المصاريف affect long-term ownership التكلفةs\./g, "تؤثر نسب المصاريف في تكلفة الملكية طويلة الأجل.")
    .replace(/The portal displays them for/g, "تعرضها البوابة من أجل")
    .replace(/Low-التكلفة S&amp;amp;P 500 التعرض, التنويع, sector allocation, و broad market التذبذب\./g, "تعرض منخفض التكلفة لمؤشر S&amp;amp;P 500 مع التنويع والتوزيع القطاعي وتذبذب السوق الواسع.")
    .replace(/Low-التكلفة S&P 500 التعرض, التنويع, sector allocation, و broad market التذبذب\./g, "تعرض منخفض التكلفة لمؤشر S&P 500 مع التنويع والتوزيع القطاعي وتذبذب السوق الواسع.")
    .replace(/sector allocation/g, "التوزيع القطاعي")
    .replace(/broad market/g, "السوق الواسع")
    .replace(/Open screener/g, "افتح ماسح السوق")
    .replace(/Understanding Beta: How Market Sensitivity Measures المخاطر in التكنولوجيا سهم Research/g, "فهم بيتا: كيف تقيس حساسية السوق مخاطر أسهم التكنولوجيا")
    .replace(/Understanding Beta: How Market Sensitivity Measures Risk in Technology Stock Research/g, "فهم بيتا: كيف تقيس حساسية السوق مخاطر أسهم التكنولوجيا")
    .replace(/Understanding Beta/g, "فهم بيتا")
    .replace(/Growth الأسهم Hub/g, "محور أسهم النمو")
    .replace(/Growth equity research hub/g, "محور أبحاث أسهم النمو")
    .replace(/company filings/g, "إفصاحات الشركات")
    .replace(/portfolio المخاطر/g, "مخاطر المحفظة")
    .replace(/macro السياق/g, "السياق الكلي")
    .replace(/The provider architecture is separated so Yahoo Finance, Alpha Vantage, Polygon\.io, or Finnhub can be added later through a protected integration\./g, "بنية مزودي البيانات منفصلة بحيث يمكن إضافة Yahoo Finance أو Alpha Vantage أو Polygon.io أو Finnhub لاحقا عبر تكامل محمي.")
    .replace(/Phase 1 uses تعليمي data with a provider architecture prepared for future market data APIs\./g, "تستخدم المرحلة الأولى بيانات تعليمية مع بنية مزودي بيانات جاهزة لواجهات بيانات السوق المستقبلية.")
    .replace(/Will real market data be connected later\?/g, "هل سيتم ربط بيانات السوق الحقيقية لاحقا؟")
    .replace(/transparent تعليمي data in Phase 1/g, "بيانات تعليمية شفافة في المرحلة الأولى")
    .replace(/Premium Signals Placeholder/g, "إشارات متقدمة قيد التحضير")
    .replace(/CTA for future premium workflows\./g, "دعوة مخصصة لتدفقات العمل المتقدمة المستقبلية.")
    .replace(/لا backend is connected yet\./g, "لم يتم ربط الواجهة الخلفية بعد.")
    .replace(/Future placeholder for portfolio-level screening, alerts, و saved research\./g, "مساحة مستقبلية لفحص المحافظ والتنبيهات والأبحاث المحفوظة.")
    .replace(/Future placeholder for portfolio-level screening, alerts, و saved research/gi, "مساحة مستقبلية لفحص المحافظ والتنبيهات والأبحاث المحفوظة")
    .replace(/Premium Signals/g, "إشارات متقدمة")
    .replace(/<strong>Premium Signals<\/strong>/g, "<strong>إشارات متقدمة</strong>")
    .replace(/>Placeholder /g, ">مساحة مستقبلية ")
    .replace(/Portfolio AI رؤى السوق/g, "رؤى محافظ الذكاء الاصطناعي")
    .replace(/market education from TradeAlphaAI/g, "تثقيف السوق من TradeAlphaAI")
    .replace(/Review the TradeAlphaAI system و premium gold trading product\./g, "راجع نظام TradeAlphaAI ومنتج إشارات الذهب المتقدم.")
    .replace(/Future مساحة مستقبلية for portfolio-level screening, alerts, و saved بحث تعليمي views\./g, "مساحة مستقبلية لفحص المحافظ والتنبيهات وطرق عرض الأبحاث المحفوظة.")
    .replace(/Future مساحة مستقبلية for portfolio-level screening, alerts, و saved research\./g, "مساحة مستقبلية لفحص المحافظ والتنبيهات والأبحاث المحفوظة.")
    .replace(/Future placeholder for portfolio-level screening, alerts, و saved بحث تعليمي views\./g, "مساحة مستقبلية لفحص المحافظ والتنبيهات وطرق عرض الأبحاث المحفوظة.")
    .replace(/placeholder="Search ticker, e\.g\. NVDA or AAPL"/g, 'placeholder="ابحث عن رمز، مثل NVDA أو AAPL"')
    .replace(/aria-label="Search سهم ticker"/g, 'aria-label="البحث عن رمز سهم"')
    .replace(/Telegram updates/g, "تحديثات تيليجرام")
    .replace(/Can this المنهجية scale to more symbols\?/g, "هل يمكن توسيع هذه المنهجية لتشمل رموزا أكثر؟")
    .replace(/The scoring engine و content templates are designed to support future generated سهم و صندوق مؤشرات pages\./g, "صُمم محرك الدرجات وقوالب المحتوى لدعم صفحات تعليمية مستقبلية للأسهم وصناديق المؤشرات.")
    .replace(/elevated المخاطر conditions/g, "ظروف المخاطر المرتفعة")
    .replace(/TradeAlphaAI لا recommend securities, provide price targets, or predict future performance\./g, "لا توصي TradeAlphaAI بأوراق مالية ولا تقدم أسعارا مستهدفة ولا تتنبأ بالأداء المستقبلي.")
    .replace(/price targets/g, "أسعارا مستهدفة")
    .replace(/recommend securities/g, "توصي بأوراق مالية")
    .replace(/Featured Article/g, "مقال مميز")
    .replace(/Reference/g, "مرجع")
    .replace(/Related صناديق المؤشرات/g, "صناديق مؤشرات مرتبطة")
    .replace(/صناديق مؤشرات مرتبطة و الأسهم/g, "صناديق وأسهم مرتبطة")
    .replace(/مخاطر Analysis/g, "تحليل المخاطر")
    .replace(/FAQ\b/g, "الأسئلة الشائعة")
    .replace(/SEO Overview/g, "نظرة بحثية موجزة")
    .replace(/TradeAlpha Research Desk/g, "مكتب أبحاث TradeAlpha")
    .replace(/GPU Compute/g, "وحدة GPU الحاسوبية")
    .replace(/\bData Centers\b/g, "مراكز البيانات")
    .replace(/Company Overview/g, "نظرة على الشركة")
    .replace(/ETF Methodology/g, "منهجية صندوق المؤشرات")
    .replace(/Research Context/g, "السياق البحثي")
    .replace(/Positive research factors/g, "عوامل بحثية داعمة")
    .replace(/Bull case framework/g, "إطار العوامل الإيجابية")
    .replace(/Bear case and risk factors/g, "العوامل السلبية والمخاطر")
    .replace(/Bear case و المخاطر factors/g, "العوامل السلبية والمخاطر")
    .replace(/Risk layer/g, "طبقة المخاطر")
    .replace(/Valuation Context/g, "سياق التقييم")
    .replace(/Valuation السياق/g, "سياق التقييم")
    .replace(/Research score context/g, "سياق درجة البحث")
    .replace(/Research score السياق/g, "سياق درجة البحث")
    .replace(/Related ETFs and stocks/g, "صناديق وأسهم مرتبطة")
    .replace(/Related stocks and ETFs/g, "أسهم وصناديق مرتبطة")
    .replace(/Connected research paths/g, "مسارات بحثية مرتبطة")
    .replace(/Full analysis/g, "افتح التحليل الكامل")
    .replace(/Related research/g, "بحث مرتبط")
    .replace(/research score/g, "درجة بحثية")
    .replace(/Educational ranking/g, "تصنيف بحثي تعليمي")
    .replace(/Research Watchlists/g, "قوائم متابعة بحثية")
    .replace(/Educational rankings for market focus lists/g, "تصنيفات تعليمية لقوائم تركيز السوق")
    .replace(/Research-ranked assets for comparison و watchlist building\. ليست نصيحة مالية\./g, "أصول مرتبة بحثيا للمقارنة وبناء قوائم المتابعة. المحتوى تعليمي وليس نصيحة مالية.")
    .replace(/Research-ranked assets for comparison and watchlist building\. Not financial advice\./g, "أصول مرتبة بحثيا للمقارنة وبناء قوائم المتابعة. المحتوى تعليمي وليس نصيحة مالية.")
    .replace(/Compare research-ranked assets across البنية التحتية للذكاء الاصطناعي, أشباه الموصلات, mega-cap التكنولوجيا, broad market صناديق المؤشرات, dividend صناديق المؤشرات, growth صناديق المؤشرات, و high-volatility watchlists\. These rankings are educational research views, not recommendations\./g, "قارن قوائم بحثية جذابة تغطي أسهم الذكاء الاصطناعي وأشباه الموصلات والتكنولوجيا الكبرى وصناديق السوق الواسع وصناديق التوزيعات وصناديق النمو وقوائم التقلب المرتفع. هذه تصنيفات تعليمية وليست توصيات.")
    .replace(/Coverage/g, "التغطية")
    .replace(/Lists/g, "القوائم")
    .replace(/Advice/g, "النصيحة")
    .replace(/None/g, "لا يوجد")
    .replace(/Mode/g, "النمط")
    .replace(/\bStatic\b/g, "ثابت")
    .replace(/ثابت research/g, "بحث ثابت")
    .replace(/watchlist/g, "قائمة متابعة")
    .replace(/watchlists/g, "قوائم متابعة")
    .replace(/high-volatility-قائمة متابعة/g, "high-volatility-watchlist")
    .replace(/Top AI Picks/g, "أفضل أسهم الذكاء الاصطناعي")
    .replace(/Momentum Leaders/g, "قادة الزخم")
    .replace(/Trending ETFs/g, "صناديق مؤشرات رائجة")
    .replace(/Semiconductor Leaders/g, "قادة أشباه الموصلات")
    .replace(/Retention Loop/g, "مسار المتابعة")
    .replace(/Build a future watchlist workflow/g, "بناء تجربة متابعة مستقبلية")
    .replace(/Phase 2 keeps watchlists frontend-only\. Future phases can add saved views, alerts, portfolio AI الرؤى, و account-based قائمة متابعة persistence through backend services\./g, "تبقى قوائم المتابعة حاليا داخل الواجهة فقط، ويمكن لاحقا إضافة العروض المحفوظة والتنبيهات ورؤى المحافظ مع طبقة خلفية محمية.")
    .replace(/AI-style explanations/g, "شرح بحثي منظم")
    .replace(/educational watchlist السياق/g, "سياق تعليمي لقوائم المتابعة")
    .replace(/No buy or sell recommendations are provided\./g, "لا يتم تقديم توصيات شراء أو بيع.")
    .replace(/Analyze سهم/g, "حلل السهم")
    .replace(/Score Model/g, "نموذج الدرجة")
    .replace(/5 Factors/g, "5 عوامل")
    .replace(/Stocks \+ ETFs/g, "أسهم وصناديق مؤشرات")
    .replace(/Educational/g, "تعليمي")
    .replace(/Mock Ready/g, "جاهز للبيانات التعليمية")
    .replace(/business model/gi, "نموذج الأعمال")
    .replace(/themes/g, "المحاور")
    .replace(/bull case/g, "العوامل الإيجابية")
    .replace(/valuation السياق/g, "سياق التقييم")
    .replace(/related صناديق المؤشرات/g, "صناديق مؤشرات مرتبطة")
    .replace(/is tracked as an بحث تعليمي asset because it connects to/g, "تتم متابعته كأصل بحثي تعليمي لأنه يرتبط بمحاور")
    .replace(/المحاور within public equity markets/g, "ضمن أسواق الأسهم العامة")
    .replace(/within public equity markets/g, "ضمن أسواق الأسهم العامة")
    .replace(/product cycle execution/g, "تنفيذ دورات المنتجات")
    .replace(/pricing power/g, "قوة التسعير")
    .replace(/operating margin discipline/g, "انضباط الهوامش التشغيلية")
    .replace(/free cash flow durability/g, "متانة التدفق النقدي الحر")
    .replace(/peer-relative multiples/g, "مضاعفات نسبية")
    .replace(/not as a buy or sell signal/g, "وليس كإشارة شراء أو بيع")
    .replace(/\bResearch Summary\b/g, "ملخص البحث")
    .replace(/البنية التحتية للذكاء الاصطناعي الطلب/g, "طلب البنية التحتية للذكاء الاصطناعي")
    .replace(/أشباه الموصلات Cycle المخاطرs/g, "مخاطر دورة أشباه الموصلات")
    .replace(/Interest الفائدة والتكنولوجيا الأسهم/g, "أسعار الفائدة وأسهم التكنولوجيا")
    .replace(/Related صناديق مؤشرات و الأسهم/g, "صناديق وأسهم مرتبطة")
    .replace(/Related الأسهم و صناديق المؤشرات/g, "صناديق وأسهم مرتبطة")
    .replace(/generates value through its core/g, "يبني قيمته عبر نشاطه الأساسي في")
    .replace(/business model, product cycle execution, customer الطلب, pricing power, و operating margin discipline\./g, "ونموذج أعماله وتنفيذ دورات المنتجات وطلب العملاء وقوة التسعير وانضباط الهوامش التشغيلية.")
    .replace(/Clear التعرض profile for research comparison\./g, "ملف تعرض واضح للمقارنة البحثية.")
    .replace(/Useful portfolio role when matched with appropriate المخاطر السياق\./g, "دور مفيد في المحفظة عند ربطه بسياق المخاطر المناسب.")
    .replace(/Transparent صندوق مؤشرات structure و holdings data\./g, "بنية صندوق شفافة وبيانات مكونات قابلة للمراجعة.")
    .replace(/TradeAlpha Score is an educational research label for comparison\. It is not a buy or sell recommendation\./g, "درجة TradeAlpha مؤشر بحثي تعليمي للمقارنة، وليست توصية شراء أو بيع.")
    .replace(/Nصندوق مؤشراتlix/g, "Netflix")
    .replace(/TradeAlphaAI Focus القوائم/g, "قوائم تركيز TradeAlphaAI")
    .replace(/Top الأسهم و صناديق المؤشرات to watch across major market المحاور/g, "أفضل الأسهم وصناديق المؤشرات للمتابعة عبر محاور السوق الرئيسية")
    .replace(/استكشف high-CTR research قائمة متابعةs for AI الأسهم, أشباه الموصلات leaders, growth الأسهم, dividend صناديق المؤشرات, السوق الواسع صناديق المؤشرات, و high-التذبذب candidates\. These lists are بحث تعليمي rankings, not buy or sell recommendations\./g, "استكشف قوائم بحثية جذابة لأسهم الذكاء الاصطناعي وقادة أشباه الموصلات وأسهم النمو وصناديق التوزيعات وصناديق السوق الواسع ومرشحي التقلب المرتفع. هذه القوائم تصنيفات بحثية تعليمية وليست توصيات شراء أو بيع.")
    .replace(/data-research-المحاور/g, "data-research-themes")
    .replace(/المخاطر layer/g, "طبقة المخاطر")
    .replace(/Valuation expectations may بالفعل price in strong execution\./g, "قد تكون توقعات التقييم قد استوعبت بالفعل جزءا كبيرا من التنفيذ القوي.")
    .replace(/Cyclical الطلب or تركز العملاء can pressure results\./g, "يمكن أن تضغط دورية الطلب أو تركز العملاء على النتائج.")
    .replace(/Macro conditions can compress multiples for growth assets\./g, "قد تؤدي الظروف الكلية إلى ضغط مضاعفات أصول النمو.")
    .replace(/valuation المخاطر/g, "مخاطر التقييم")
    .replace(/sector التذبذب/g, "تذبذب القطاع")
    .replace(/macro السيولة/g, "السيولة الكلية")
    .replace(/Clear التعرض profile/g, "ملف تعرض واضح")
    .replace(/research comparison/g, "المقارنة البحثية")
    .replace(/Useful portfolio role/g, "دور مفيد في المحفظة")
    .replace(/appropriate المخاطر السياق/g, "سياق المخاطر المناسب")
    .replace(/Transparent/g, "شفافة")
    .replace(/Data center و supply chain overview/g, "نظرة على مراكز البيانات وسلاسل التوريد")
    .replace(/Broad Market/g, "السوق الواسع")
    .replace(/trade-offs/g, "المفاضلات")
    .replace(/How monetary policy affects multiples/g, "كيف تؤثر السياسة النقدية في مضاعفات التقييم")
    .replace(/Market sensitivity in growth الأسهم/g, "حساسية السوق في أسهم النمو")
    .replace(/Interest Rates و Tech الأسهم/g, "أسعار الفائدة وأسهم التكنولوجيا")
    .replace(/Rates و Tech/g, "الفائدة والتكنولوجيا")
    .replace(/AI الأسهم Research Hub/g, "محور أبحاث أسهم الذكاء الاصطناعي")
    .replace(/Cloud Computing/g, "الحوسبة السحابية")
    .replace(/Equity Factors/g, "عوامل الأسهم")
    .replace(/Growth vs value الأسهم/g, "أسهم النمو مقابل أسهم القيمة")
    .replace(/Research frameworks for valuation, earnings growth, factor cycles, و rate sensitivity\./g, "أطر بحثية للتقييم ونمو الأرباح ودورات العوامل وحساسية أسعار الفائدة.")
    // stocks.html remaining contamination
    .replace(/Free AI سهم فحص السوق/g, "فحص الأسهم بالذكاء الاصطناعي")
    .replace(/\bHow It Works\b/g, "كيف يعمل")
    .replace(/شفافة educational scoring/g, "تقييم تعليمي شفاف")
    .replace(/شفافة تعليمي scoring/g, "تقييم تعليمي شفاف")
    .replace(/Compare SPY, QQQ, VTI, VOO, و GLD/g, "قارن بين SPY وQQQ وVTI وVOO وGLD")
    .replace(/>Open محلل صناديق المؤشرات</g, ">افتح محلل صناديق المؤشرات<")
    .replace(/بحث تعليمي شائع للأسهم المحاور/g, "محاور البحث التعليمية الشائعة للأسهم")
    .replace(/NVDA Analysis/g, "تحليل NVDA")
    .replace(/Dedicated NVDA Page/g, "صفحة NVDA التفصيلية")
    .replace(/Dedicated SPY Page/g, "صفحة SPY التفصيلية")
    .replace(/Compare QQQ التعرض/g, "قارن تعرض QQQ")
    .replace(/\bData Status\b/g, "حالة البيانات")
    .replace(/TradeAlphaAI Ecosystem/g, "منظومة TradeAlphaAI")
    // etfs.html remaining contamination
    .replace(/AI محلل صناديق المؤشرات for holdings, allocation, التذبذب, و المخاطر-aware صندوق مؤشرات research/g, "محلل صناديق المؤشرات بالذكاء الاصطناعي للحيازات والتوزيع والتذبذب والبحث الواعي بالمخاطر")
    .replace(/محلل صناديق المؤشرات questions/g, "أسئلة محلل صناديق المؤشرات")
    // screener.html remaining contamination
    .replace(/\bMarket Themes\b/g, "محاور السوق")
    .replace(/High-engagement screening groups/g, "مجموعات الفحص ذات الاهتمام العالي")
    .replace(/Filterable ماسح السوق/g, "ماسح السوق القابل للتصفية")
    .replace(/المخاطر Factors/g, "عوامل المخاطر")
    .replace(/عوامل المخاطر for أشباه الموصلات الأسهم/g, "عوامل المخاطر لأسهم أشباه الموصلات")
    .replace(/Build a future قائمة متابعة workflow/g, "بناء مسار قائمة المتابعة المستقبلي")
    .replace(/تعليمي only/g, "تعليمي فقط")
    // rankings.html remaining contamination
    .replace(/Top 10 الأسهم Right Now/g, "أفضل 10 أسهم حالياً")
    .replace(/Best AI الأسهم Right Now/g, "أفضل أسهم الذكاء الاصطناعي حالياً")
    .replace(/Most-watched broad-market الأسهم[^<]*ليست نصيحة مالية\./g, "أكثر الأسهم متابعةً عبر قطاعات التكنولوجيا والمستهلكين والحوسبة السحابية. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/Most followed AI-linked research candidates[^<]*ليست نصيحة مالية\./g, "أبرز مرشحي البحث المرتبطين بالذكاء الاصطناعي ضمن تغطية TradeAlphaAI. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/Top أشباه الموصلات الأسهم/g, "أفضل أسهم أشباه الموصلات")
    .replace(/Chip, equipment, memory,[^<]*ليست نصيحة مالية\./g, "شركات الرقائق والمعدات والذاكرة وحوسبة الذكاء الاصطناعي ذات أهمية بحثية عالية. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/Growth-oriented التكنولوجيا[^<]*ليست نصيحة مالية\./g, "شركات تقنية ومنصات موجهة للنمو للمقارنة التعليمية. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/Dividend-focused صناديق المؤشرات[^<]*ليست نصيحة مالية\./g, "صناديق توزيعات الأرباح للبحث عن الدخل والجودة والأسهم الدفاعية. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/Core صندوق مؤشرات building blocks[^<]*ليست نصيحة مالية\./g, "صناديق مؤشرات أساسية للتعرض الواسع للأسهم الأمريكية وسياق المحفظة. تصنيف بحثي تعليمي وليست نصيحة مالية.")
    .replace(/تصنيف بحثي تعليمي only,/g, "تصنيف بحثي تعليمي وليست")
    // etfs.html hero stats and paragraphs
    .replace(/صندوق مؤشرات Data/g, "بيانات الصندوق")
    .replace(/<strong>Holdings<\/strong>/g, "<strong>الحيازات</strong>")
    .replace(/المخاطر Lens/g, "منظور المخاطر")
    .replace(/التكلفةs/g, "التكاليف")
    .replace(/التكلفة s/g, "التكاليف")
    .replace(/اعرضing[^<]*/g, "جارٍ تحميل سياق مقارنة الصناديق...")
    .replace(/placeholder="Search صندوق مؤشرات, e\.g\. SPY or QQQ"/g, 'placeholder="ابحث عن رمز، مثل SPY أو QQQ"')
    .replace(/aria-label="Search صندوق مؤشرات symbol"/g, 'aria-label="البحث عن رمز صندوق المؤشرات"')
    .replace(/Compare صناديق المؤشرات with educational[^<]*/g, "قارن صناديق المؤشرات مع سياق درجة TradeAlpha التعليمي ونسب المصاريف وأكبر الحيازات والتعرض القطاعي والإعداد الفني ونظرة المخاطر.")
    .replace(/The محلل صناديق المؤشرات supports السوق الواسع,[^<]*/g, "يدعم محلل صناديق المؤشرات صناديق السوق الواسع والنمو والتوزيعات والقطاعات والسندات والسلع مع بيانات توزيع تعليمية ثابتة.")
    // stocks.html paragraphs
    .replace(/تحليل صناديق المؤشرات is now connected[^<]*/g, "تحليل صناديق المؤشرات متصل الآن ببنية الفحص ذاتها، مع سياق نسبة المصاريف والحيازات والتعرض القطاعي ونظرة التذبذب وملخصات المخاطر التعليمية.")
    .replace(/Why traders watch NVDA:[^<]*/g, "لماذا يراقب المتداولون NVDA: طلب البنية التحتية للذكاء الاصطناعي وإمدادات أشباه الموصلات وتوقعات الأرباح وحساسية التقييم والزخم — جميعها تؤثر في كيفية فحص NVDA.")
    .replace(/عوامل المخاطر لأسهم أشباه الموصلات include[^<]*/g, "عوامل المخاطر لأسهم أشباه الموصلات تشمل قيود التصدير وتركز العملاء ودورات المخزون والتغيرات في الإنفاق الرأسمالي وتذبذب قطاع التكنولوجيا.")
    .replace(/Portfolio-level screening, alerts, و saved بحث تعليمي views planned for future releases\./g, "مساحة مستقبلية لفحص المحافظ والتنبيهات وطرق عرض الأبحاث المحفوظة.")
    // screener.html paragraphs
    .replace(/أشباه الموصلات الأسهم can be sensitive to[^<]*/g, "يمكن أن تكون أسهم أشباه الموصلات حساسة للإنفاق على البنية التحتية للذكاء الاصطناعي ودورات المخزون وقيود التصدير وضغط التقييم وتوقعات الأرباح وزخم قطاع التكنولوجيا.")
    .replace(/Safe labels only\.[^<]*/g, "تسميات آمنة فقط. هذه واجهة فحص تعليمية وليست محرك توصيات.")
    // screener eyebrow
    .replace(/\bAI ماسح السوق/g, "ماسح السوق بالذكاء الاصطناعي")
    // screener filter UI labels
    .replace(/placeholder="Search symbol or name"/g, 'placeholder="ابحث برمز أو اسم"')
    .replace(/<option value="0">Any score<\/option>/g, '<option value="0">أي درجة</option>')
    .replace(/<option value="50">50\+ score<\/option>/g, '<option value="50">50+ درجة</option>')
    .replace(/<option value="60">60\+ score<\/option>/g, '<option value="60">60+ درجة</option>')
    .replace(/<option value="70">70\+ score<\/option>/g, '<option value="70">70+ درجة</option>')
    .replace(/<option value="score">Sort by score<\/option>/g, '<option value="score">ترتيب حسب الدرجة</option>')
    .replace(/<option value="momentum">Sort by الزخم<\/option>/g, '<option value="momentum">ترتيب حسب الزخم</option>')
    .replace(/<option value="risk">Sort by المخاطر score<\/option>/g, '<option value="risk">ترتيب حسب درجة المخاطر</option>')
    .replace(/<option value="symbol">Sort by symbol<\/option>/g, '<option value="symbol">ترتيب حسب الرمز</option>')
    .replace(/<span>Asset<\/span>/g, '<span>الأصل</span>')
    .replace(/<span>Score<\/span>/g, '<span>الدرجة</span>')
    // rankings.html company name fix (semiconductor was over-translated in proper names)
    .replace(/Taiwan أشباه الموصلات Manufacturing/g, "Taiwan Semiconductor Manufacturing")
    // etfs.html FAQ eyebrow
    .replace(/صندوق مؤشرات الأسئلة الشائعة/g, "أسئلة شائعة عن صناديق المؤشرات")
    // ETF detail page remaining contamination
    .replace(/Fund profile/g, "ملف الصندوق")
    .replace(/Top Holdings/g, "أكبر الحيازات")
    .replace(/Portfolio components/g, "مكونات المحفظة")
    .replace(/Allocation screen/g, "عرض التوزيع")
    .replace(/<span>Category<\/span>/g, "<span>الفئة</span>")
    .replace(/\bCore Equity\b/g, "أسهم أساسية")
    .replace(/فني Analysis/g, "التحليل الفني")
    .replace(/صندوق مؤشرات أساسيs/g, "أساسيات الصندوق")
    .replace(/صندوق مؤشرات Research Summary/g, "ملخص بحث الصندوق")
    .replace(/صندوق مؤشرات Overview/g, "نظرة على الصندوق")
    .replace(/expense السياق/g, "سياق المصاريف")
    .replace(/is tracked as an educational صندوق مؤشرات research asset[^<.]*/g, "يُتابَع كأصل بحثي تعليمي لصندوق مؤشرات للتعرض والمقارنة.")
    .replace(/Spy Vs Qqq Explained/g, "مقارنة SPY وQQQ")
    .replace(/صندوق مؤشرات نسب المصاريف Explained/g, "شرح نسب مصاريف صناديق المؤشرات")
    .replace(/القطاع صناديق المؤشرات Vs السوق الواسع/g, "صناديق القطاع مقابل السوق الواسع")
    .replace(/التركز can increase drawdown sensitivity\./g, "يمكن أن يزيد التركز من حساسية التراجع.")
    .replace(/نسب المصاريف و trading spreads affect long-term ownership التكلفة\./g, "تؤثر نسب المصاريف والفوارق التداولية في تكلفة الملكية طويلة الأجل.")
    .replace(/The صندوق مؤشرات can decline with its underlying market or sector\./g, "يمكن أن يتراجع الصندوق مع السوق أو القطاع الأساسي.")
    .replace(/درجة TradeAlpha is an بحث تعليمي label for comparison\. It ليس a buy or sell recommendation\./g, "درجة TradeAlpha مؤشر بحثي تعليمي للمقارنة، وليست توصية شراء أو بيع.")
    // stock/ETF insight link title-case fixes
    .replace(/Ai Infrastructure Demand/g, "طلب البنية التحتية للذكاء الاصطناعي")
    .replace(/Semiconductor Cycle Risks/g, "مخاطر دورة أشباه الموصلات")
    .replace(/Interest Rates And Tech Stocks/g, "أسعار الفائدة وأسهم التكنولوجيا")
    .replace(/Semiconductor Market Research/g, "أبحاث سوق أشباه الموصلات")
    .replace(/Ai Chip Supply Chain Constraints/g, "قيود سلسلة توريد شرائح الذكاء الاصطناعي")
    .replace(/Etf Expense Ratios Explained/g, "شرح نسب مصاريف صناديق المؤشرات")
    .replace(/Sector Etfs Vs Broad Market/g, "صناديق القطاع مقابل السوق الواسع")
    .replace(/Ai Infrastructure Demand/g, "طلب البنية التحتية للذكاء الاصطناعي")
    // insights/index.html remaining contamination
    .replace(/بحث تعليمي Hub/g, "مركز الأبحاث التعليمية")
    .replace(/\bTopic Clusters\b/g, "مجموعات المحاور")
    .replace(/\bEditor Picks\b/g, "اختيارات المحرر")
    .replace(/High-signal research paths/g, "مسارات البحث عالية الإشارة")
    .replace(/استكشف research by theme/g, "استكشف الأبحاث حسب المحور")
    .replace(/محور أبحاثs[^<]*/g, "محاور الأبحاث والمحللات")
    .replace(/Continue into سهم, صندوق مؤشرات, و theme research/g, "تابع أبحاث الأسهم وصناديق المؤشرات والمحاور")
    // methodology.html headings and eyebrows
    .replace(/Data Transparency/g, "شفافية البيانات")
    .replace(/Data الشفافية/g, "شفافية البيانات")
    .replace(/\bTransparency\b/g, "الشفافية")
    .replace(/How درجة TradeAlpha Works/g, "كيف تعمل درجة TradeAlpha")
    .replace(/AI Analysis Explanation/g, "شرح التحليل")
    .replace(/Rule-based, not predictive claims/g, "قائم على قواعد محددة لا ادعاءات تنبؤية")
    .replace(/Terminology Helper/g, "مساعد المصطلحات")
    .replace(/Common market terms/g, "مصطلحات السوق الشائعة")
    .replace(/تعليمي, live, stale, fallback, و unavailable states/g, "حالات التعليمي والمباشر والمتقادم والاحتياطي وغير المتاح")
    // methodology.html paragraphs
    .replace(/درجة TradeAlpha is a transparent educational[^<]*نصيحة مالية\./g, "درجة TradeAlpha إطار فحص تعليمي شفاف للأسهم وصناديق المؤشرات. يجمع بين التحليل الفني والأساسيات والزخم والمعنويات وسياق المخاطر دون تقديم نصيحة مالية.")
    .replace(/The current research explanation layer is deterministic[^<]*/g, "طبقة الشرح البحثي الحالية محددة المنطق وقائمة على قواعد ثابتة. تشرح لماذا تكون الدرجة مرتفعة أو منخفضة استناداً إلى مدخلات تعليمية مرئية، ولا تضمن نتائج ولا تتنبأ بأرباح.")
    .replace(/RSI reviews الزخم, moving averages summarize trend السياق[^<]*/g, "RSI يراجع الزخم، المتوسطات المتحركة تلخص سياق الاتجاه، نسبة المصاريف تصف تكلفة صندوق المؤشرات، التذبذب يقدر نطاق الحركة، والمعنويات تلخص نبرة السوق.")
    .replace(/The portal identifies whether analysis is using educational[^<]*/g, "تُشير البوابة إلى ما إذا كان التحليل يستخدم بيانات تعليمية أو بيانات مباشرة مستقبلية أو بيانات مخزنة متقادمة أو بيانات احتياطية أو بيانات غير متاحة. هذه الشفافية لا تغير الطابع التعليمي فقط للتحليل.")
    .replace(/does لاt/g, "لا")
    .replace(/\bلاt\b/g, "لا");
  _b.forEach((b, i) => { html = html.replace(`\x00B${i}\x00`, b); });
  return html;
}

function preserveEdgeSpace(original, translated) {
  const leading = original.match(/^\s*/)[0];
  const trailing = original.match(/\s*$/)[0];
  return `${leading}${escapeHtml(translated.trim())}${trailing}`;
}

function finalArabicCleanup(html) {
  html = html
    .replace(/>Free Signals</g, ">موجزات السوق<")
    .replace(/View Strategy/g, "عرض الاستراتيجية")
    .replace(/&amp;nbsp;/g, " ");
  return html
    .replace(/Research المقالات are coming soon from TradeAlphaAI\./g, "المقالات البحثية قادمة قريبا من TradeAlphaAI.")
    .replace(/Research المقالات are coming soon\./g, "المقالات البحثية قادمة قريبا.")
    .replace(/TradeAlphaAI is preparing a bilingual أبحاث السوق library\./g, "تعمل TradeAlphaAI على إعداد مكتبة أبحاث سوق ثنائية اللغة.")
    .replace(/مركز المقالات/g, "المقالات")
    .replace(/صناديق صناديق المؤشرات/g, "صناديق المؤشرات")
    .replace(/Research Rankings [^"<]*Watchlists/g, "&#1578;&#1589;&#1606;&#1610;&#1601;&#1575;&#1578; &#1608;&#1602;&#1608;&#1575;&#1574;&#1605; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1576;&#1581;&#1579;&#1610;&#1577;")
    .replace(/[^"]*rankings[^"]*research candidates\./g, "&#1578;&#1589;&#1606;&#1610;&#1601;&#1575;&#1578; &#1608;&#1602;&#1608;&#1575;&#1574;&#1605; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1576;&#1581;&#1579;&#1610;&#1577; &#1578;&#1593;&#1604;&#1610;&#1605;&#1610;&#1577; &#1604;&#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1608;&#1602;&#1575;&#1583;&#1577; &#1571;&#1588;&#1576;&#1575;&#1607; &#1575;&#1604;&#1605;&#1608;&#1589;&#1604;&#1575;&#1578; &#1608;&#1575;&#1604;&#1578;&#1603;&#1606;&#1608;&#1604;&#1608;&#1580;&#1610;&#1575; &#1575;&#1604;&#1603;&#1576;&#1585;&#1609;.")
    .replace(/Most followed AI-linked research candidates[^<]*\./g, "&#1571;&#1576;&#1585;&#1586; &#1605;&#1585;&#1588;&#1581;&#1610; &#1575;&#1604;&#1576;&#1581;&#1579; &#1575;&#1604;&#1605;&#1585;&#1578;&#1576;&#1591;&#1610;&#1606; &#1576;&#1575;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1590;&#1605;&#1606; &#1578;&#1594;&#1591;&#1610;&#1577; TradeAlphaAI.")
    .replace(/Most Followed [^<]*?&#1575;&#1604;&#1571;&#1587;&#1607;&#1605;/g, "&#1571;&#1603;&#1579;&#1585; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577;")
    .replace(/Most Followed [^<]*?الأسهم/g, "&#1571;&#1603;&#1579;&#1585; &#1571;&#1587;&#1607;&#1605; &#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1604;&#1604;&#1584;&#1603;&#1575;&#1569; &#1575;&#1604;&#1575;&#1589;&#1591;&#1606;&#1575;&#1593;&#1610; &#1605;&#1578;&#1575;&#1576;&#1593;&#1577;")
    .replace(/Data center, accelerator[^<]*\./g, "&#1571;&#1587;&#1605;&#1575;&#1569; &#1605;&#1585;&#1575;&#1603;&#1586; &#1575;&#1604;&#1576;&#1610;&#1575;&#1606;&#1575;&#1578; &#1608;&#1575;&#1604;&#1605;&#1587;&#1585;&#1593;&#1575;&#1578; &#1608;&#1575;&#1604;&#1581;&#1608;&#1587;&#1576;&#1577; &#1575;&#1604;&#1587;&#1581;&#1575;&#1576;&#1610;&#1577; &#1608;&#1575;&#1604;&#1576;&#1606;&#1610;&#1577; &#1575;&#1604;&#1578;&#1581;&#1578;&#1610;&#1577; &#1575;&#1604;&#1578;&#1610; &#1610;&#1578;&#1575;&#1576;&#1593;&#1607;&#1575; &#1605;&#1603;&#1578;&#1576; &#1575;&#1604;&#1571;&#1576;&#1581;&#1575;&#1579;.")
    .replace(/Higher-beta research candidates[^<]*\./g, "&#1605;&#1585;&#1588;&#1581;&#1608;&#1606; &#1576;&#1581;&#1579;&#1610;&#1608;&#1606; &#1571;&#1593;&#1604;&#1609; &#1578;&#1602;&#1604;&#1576;&#1575; &#1581;&#1610;&#1579; &#1610;&#1607;&#1605; &#1587;&#1610;&#1575;&#1602; &#1575;&#1604;&#1605;&#1582;&#1575;&#1591;&#1585; &#1576;&#1602;&#1583;&#1585; &#1571;&#1607;&#1605;&#1610;&#1577; &#1585;&#1608;&#1575;&#1610;&#1575;&#1578; &#1575;&#1604;&#1606;&#1605;&#1608;.")
    .replace(/Watchlists currently remain[^<]*\./g, "&#1578;&#1576;&#1602;&#1609; &#1602;&#1608;&#1575;&#1574;&#1605; &#1575;&#1604;&#1605;&#1578;&#1575;&#1576;&#1593;&#1577; &#1605;&#1578;&#1608;&#1575;&#1601;&#1602;&#1577; &#1605;&#1593; &#1575;&#1604;&#1578;&#1588;&#1594;&#1610;&#1604; &#1575;&#1604;&#1579;&#1575;&#1576;&#1578; &#1581;&#1575;&#1604;&#1610;&#1575;.")
    .replace(/The [^<]*?TradeAlpha combines[^<]*?Overextended\./g, "&#1578;&#1580;&#1605;&#1593; &#1583;&#1585;&#1580;&#1577; TradeAlpha &#1576;&#1610;&#1606; &#1575;&#1604;&#1583;&#1585;&#1580;&#1577; &#1575;&#1604;&#1601;&#1606;&#1610;&#1577; &#1608;&#1575;&#1604;&#1583;&#1585;&#1580;&#1577; &#1575;&#1604;&#1571;&#1587;&#1575;&#1587;&#1610;&#1577; &#1608;&#1575;&#1604;&#1586;&#1582;&#1605; &#1608;&#1575;&#1604;&#1605;&#1593;&#1606;&#1608;&#1610;&#1575;&#1578; &#1608;&#1578;&#1593;&#1583;&#1610;&#1604; &#1575;&#1604;&#1605;&#1582;&#1575;&#1591;&#1585;.")
    .replace(/Mega-Cap Tech|mega-cap tech/g, "&#1575;&#1604;&#1578;&#1603;&#1606;&#1608;&#1604;&#1608;&#1580;&#1610;&#1575; &#1575;&#1604;&#1603;&#1576;&#1585;&#1609;")
    .replace(/market leadership/g, "&#1602;&#1610;&#1575;&#1583;&#1577; &#1575;&#1604;&#1587;&#1608;&#1602;")
    .replace(/passive investing/g, "&#1575;&#1604;&#1575;&#1587;&#1578;&#1579;&#1605;&#1575;&#1585; &#1575;&#1604;&#1587;&#1604;&#1576;&#1610;");
}

function localizeArabicLandingCopy(html) {
  // Hero risk microcopy: element-anchored replacement, NOT a text pair —
  // localizeStaticText runs earlier and word-level substitutions ("risk" →
  // "المخاطر") mangle the English sentence before any exact pair can match.
  html = html.replace(
    /(<p class="hero-risk-note"[^>]*>)[\s\S]*?(<\/p>)/,
    '$1التداول ينطوي على مخاطر كبيرة. الإشارات لأغراض معلوماتية وتعليمية — نتائج الاختبار التاريخي لا تضمن الأداء المستقبلي.$2'
  );
  const replacements = [
    // Backtest-qualified performance stats. These pairs must come BEFORE the
    // older unqualified pairs ("Max DD 6%") so the longer strings match first.
    ["Backtest Max DD 6%", "أقصى تراجع بالاختبار التاريخي 6%"],
    ["Backtest PF 1.82", "معامل ربح بالاختبار التاريخي 1.82"],
    ["Cross-Asset Intelligence Engine", "محرك الذكاء عبر الأصول"],
    ["A compact map of how market evidence connects.", "خريطة موجزة لكيفية ترابط أدلة السوق."],
    ["TRADING &amp; MARKET RESEARCH PLATFORM", "منصة التداول وأبحاث السوق"],
    ["TRADING &amp;amp; MARKET RESEARCH PLATFORM", "منصة التداول وأبحاث السوق"],
    ["TRADING &amp; أبحاث السوق PLATFORM", "منصة التداول وأبحاث السوق"],
    ["TRADING &amp;amp; أبحاث السوق PLATFORM", "منصة التداول وأبحاث السوق"],
    ["Gold Trading System", "منصة التداول وأبحاث السوق"],
    ["Free Signals", "موجزات السوق"],
    ["تنبيهات السوق", "موجزات السوق"],
    ["Trading Signals &amp; Market Research", "إشارات تداول وأبحاث سوق"],
    ["Trading Signals & Market Research", "إشارات تداول وأبحاث سوق"],
    ["Trading Signals &amp; أبحاث السوق", "إشارات تداول وأبحاث سوق"],
    ["Trading Signals & أبحاث السوق", "إشارات تداول وأبحاث سوق"],
    ["Institutional-Grade Signals. Free for 1 Month.", "إشارات بمستوى مؤسسي. مجانية لمدة شهر."],
    ["Institutional-Grade Signals. Free for 1&nbsp;Month.", "إشارات بمستوى مؤسسي. مجانية لمدة شهر."],
    ["Multi-market trading signals and market research with reviewable signal logic. QQQ/Nasdaq is one active signal stream within the platform.", "إشارات تداول متعددة الأسواق وأبحاث سوق بمنطق إشارات قابل للمراجعة. QQQ وناسداك مسار إشارات نشط داخل المنصة."],
    ["Multi-market trading signals و أبحاث السوق with reviewable signal logic. QQQ/Nasdaq is one active signal stream within the platform.", "إشارات تداول متعددة الأسواق وأبحاث سوق بمنطق إشارات قابل للمراجعة. QQQ وناسداك مسار إشارات نشط داخل المنصة."],
    ["Open Signal Bot", "افتح بوت الإشارات"],
    ["Open Signal Feed", "افتح بث الإشارات"],
    ["View Strategy →", "عرض الاستراتيجية ←"],
    ["View Strategy", "عرض الاستراتيجية"],
    ["WFO Verified 3/5", "تحقق WFO 3/5"],
    ["Max DD 6%", "أقصى تراجع 6%"],
    ["Free Trial", "تجربة مجانية"],
    ["Live Signal Feed", "بث الإشارات المباشر"],
    ["Live", "مباشر"],
    ["Multi-market Telegram signal system", "نظام إشارات تيليجرام متعدد الأسواق"],
    ["QQQ/Nasdaq is one active stream inside the signal feed.", "QQQ وناسداك مسار نشط داخل بث الإشارات."],
    ["QQQ Nasdaq", "QQQ ناسداك"],
    ["XAUUSD Gold", "XAUUSD الذهب"],
    ["Active", "نشط"],
    ["WFO Verified", "تحقق WFO"],
    ["3/5 folds", "3/5 مراحل"],
    ["Free Trial — 1 month", "تجربة مجانية — شهر واحد"],
    ["تجربة مجانية — 1 month", "تجربة مجانية — شهر واحد"],
    ["Then $30/month", "ثم 30 دولار شهريا"],
    ["Products", "المنتجات"],
    ["Choose Your Trading Product", "اختر منتج التداول"],
    ["Access QQQ/Nasdaq signals or the XAUUSD Gold MT5 Expert Advisor through Telegram.", "احصل على إشارات QQQ وناسداك أو خبير XAUUSD للذهب على MT5 عبر تيليجرام."],
    ["Access QQQ/Nasdaq signals or the XAUUSD الذهب خبير MT5 آلي through Telegram.", "احصل على إشارات QQQ وناسداك أو خبير XAUUSD للذهب على MT5 عبر تيليجرام."],
    ["Telegram Signals", "إشارات تيليجرام"],
    ["LIVE NOW", "متاح الآن"],
    ["QQQ/Nasdaq signal bot", "بوت إشارات QQQ وناسداك"],
    ["WFO verified", "تحقق WFO"],
    ["Telegram signal access", "وصول لإشارات تيليجرام"],
    ["MT5 Expert Advisor", "خبير MT5 آلي"],
    ["Available", "متاح"],
    ["XAUUSD — Gold MT5 Expert Advisor", "XAUUSD — خبير الذهب الآلي على MT5"],
    ["XAUUSD — Gold خبير MT5 آلي", "XAUUSD — خبير الذهب الآلي على MT5"],
    ["Available via Telegram", "متاح عبر تيليجرام"],
    ["متاح via Telegram", "متاح عبر تيليجرام"],
    ["XAUUSD الذهب Expert Advisor", "خبير آلي لتداول الذهب XAUUSD"],
    ["Backtest: 10,273 trades", "اختبار تاريخي: 10,273 صفقة"],
    ["Win rate: 78.7%", "نسبة الفوز: 78.7%"],
    ["Historical P&amp;L: +$59,589", "ربح وخسارة تاريخية: +$59,589"],
    ["Order و onboarding are handled through the customer bot.", "يتم الطلب والإعداد عبر بوت خدمة العملاء."],
    ["Get MT5 EA", "احصل على خبير MT5"],
    ["Join Telegram", "انضم إلى تيليجرام"],
    ["Start Free Trial", "ابدأ التجربة المجانية"],
    ["Live Since May 2026", "مباشر منذ مايو 2026"],
    ["مباشر Since May 2026", "مباشر منذ مايو 2026"],
    ["Strategy to signal in 3 steps", "من الاستراتيجية إلى الإشارة في 3 خطوات"],
    ["WFO Validated", "تحقق WFO"],
    ["Strategy backtested 2018–2026 across 5 independent folds. Only deployed after passing 3/5.", "تم اختبار الاستراتيجية تاريخيا بين 2018 و2026 عبر 5 مراحل مستقلة، ولا يتم تشغيلها إلا بعد اجتياز 3 من 5."],
    ["Signal Generated", "توليد الإشارة"],
    ["Every H1 bar close, EMA cross + ATR filter checked. Signal sent instantly to your Telegram.", "عند إغلاق كل شمعة H1 يتم فحص تقاطع EMA مع فلتر ATR، ثم ترسل الإشارة مباشرة إلى تيليجرام."],
    ["You Trade", "أنت تتداول"],
    ["Receive entry, stop loss, و take profit levels. Trade on any broker. لا platform lock-in.", "استلم مستويات الدخول ووقف الخسارة وجني الأرباح. تداول عبر أي وسيط دون تقييد بمنصة محددة."],
    ["مباشر on Myfxbook", "مباشر على Myfxbook"],
    ["مباشر tracking", "تتبع مباشر"],
    ["Featured المقالات", "مقالات مختارة"],
    ["Finance research for AI الأسهم, صناديق المؤشرات, و هيكل السوق", "أبحاث مالية عن أسهم الذكاء الاصطناعي وصناديق المؤشرات وهيكل السوق"],
    ["تعليمي أبحاث السوق designed for deeper reading across البنية التحتية للذكاء الاصطناعي, أشباه الموصلات cycles, صندوق مؤشرات التعرض, و مخاطر المحفظة السياق.", "أبحاث سوق تعليمية مصممة لقراءة أعمق في البنية التحتية للذكاء الاصطناعي ودورات أشباه الموصلات وتعرض صناديق المؤشرات وسياق مخاطر المحافظ."],
    ["طلب البنية التحتية للذكاء الاصطناعي: GPUs, data centers, و the أشباه الموصلات supply chain", "طلب البنية التحتية للذكاء الاصطناعي: وحدات GPU ومراكز البيانات وسلسلة توريد أشباه الموصلات"],
    ["السياق البحثي on GPU cluster buildout, hyperscaler capex, power الطلب, و supply-chain dependencies across the AI market stack.", "سياق بحثي حول بناء عناقيد GPU وإنفاق مزودي السحابة والطلب على الطاقة واعتماد سلسلة التوريد عبر سوق الذكاء الاصطناعي."],
    ["اقرأ featured insight &amp;rarr;", "اقرأ المقال المختار ←"],
    ["SPY vs QQQ explained", "شرح المقارنة بين SPY وQQQ"],
    ["منهجية المؤشر, التركز, sector التعرض, و drawdown السياق for broad-market صندوق مؤشرات research.", "منهجية المؤشر والتركيز والتعرض القطاعي وسياق التراجع لأبحاث صناديق السوق الواسع."],
    ["أشباه الموصلات cycle المخاطرs", "مخاطر دورة أشباه الموصلات"],
    ["Inventory corrections, capex dependencies, تركز العملاء, و valuation compression المخاطر.", "تصحيحات المخزون واعتماد الإنفاق الرأسمالي وتركيز العملاء ومخاطر ضغط التقييم."],
    ["Market المقالات", "مقالات السوق"],
    ["Browse the full research library", "تصفح مكتبة الأبحاث الكاملة"],
    ["Open the TradeAlphaAI Market المقالات hub for published educational المقالات on البنية التحتية للذكاء الاصطناعي, صندوق مؤشرات education, أشباه الموصلات cycles, macro المخاطر, و portfolio السياق.", "افتح مركز مقالات TradeAlphaAI للاطلاع على مقالات تعليمية منشورة عن البنية التحتية للذكاء الاصطناعي وتعليم صناديق المؤشرات ودورات أشباه الموصلات والمخاطر الكلية وسياق المحافظ."],
    ["Open Market المقالات", "افتح مقالات السوق"],
    ["Research Index", "فهرس الأبحاث"],
    ["Compare البنية التحتية للذكاء الاصطناعي, cloud AI, أشباه الموصلات, و software platform research pages.", "قارن صفحات أبحاث البنية التحتية للذكاء الاصطناعي والذكاء الاصطناعي السحابي وأشباه الموصلات ومنصات البرمجيات."],
    ["افتح المحور &amp;rarr;", "افتح المحور ←"],
    ["صندوق مؤشرات نسب المصاريف explained", "شرح نسب مصاريف صناديق المؤشرات"],
    ["How fund التكاليف compound over time و why fee comparison matters in long-term index research.", "كيف تتراكم تكاليف الصناديق مع الوقت ولماذا تهم مقارنة الرسوم في أبحاث المؤشرات طويلة الأجل."],
    ["اقرأ guide &amp;rarr;", "اقرأ الدليل ←"],
    ["Screen AI و صندوق مؤشرات المحاور", "افحص محاور الذكاء الاصطناعي وصناديق المؤشرات"],
    ["استكشف educational درجة TradeAlpha السياق across AI الأسهم, أشباه الموصلات صناديق المؤشرات, و broad-market funds.", "استكشف سياق درجة TradeAlpha التعليمية عبر أسهم الذكاء الاصطناعي وصناديق أشباه الموصلات وصناديق السوق الواسع."],
    ["افتح ماسح السوق &amp;rarr;", "افتح ماسح السوق ←"],
    ["Growth الأسهم", "أسهم النمو"],
    ["Dividend صناديق المؤشرات", "صناديق توزيعات الأرباح"],
    ["QQQ research", "أبحاث QQQ"],
    ["NVDA research", "أبحاث NVDA"],
    ["Max DD", "أقصى تراجع"]
  ];

  for (const [from, to] of replacements) {
    html = html.split(from).join(to);
  }

  return html
    .replace(/<span class="brand-copy">\s*<strong>TradeAlpha AI<\/strong>\s*<span>[^<]*<\/span>\s*<\/span>/i, '<span class="brand-copy">\n          <strong>TradeAlpha AI</strong>\n          <span>منصة التداول وأبحاث السوق</span>\n        </span>')
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>TradeAlpha AI | منصة تداول الذهب بإشارات موثقة</title>")
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, '<meta name="description" content="TradeAlpha AI منصة تداول وإشارات سوق مع تجربة مجانية لمدة شهر وبوت إشارات عبر تيليجرام وأبحاث سوق تعليمية." />')
    .replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, '<meta property="og:title" content="TradeAlpha AI | منصة تداول الذهب بإشارات موثقة" />')
    .replace(/<meta property="og:description" content="[^"]*"\s*\/?>/i, '<meta property="og:description" content="TradeAlpha AI منصة تداول وإشارات سوق مع تجربة مجانية لمدة شهر وبوت إشارات عبر تيليجرام وأبحاث سوق تعليمية." />')
    .replace(/<meta name="twitter:title" content="[^"]*"\s*\/?>/i, '<meta name="twitter:title" content="TradeAlpha AI | منصة تداول الذهب بإشارات موثقة" />')
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/?>/i, '<meta name="twitter:description" content="TradeAlpha AI منصة تداول وإشارات سوق مع تجربة مجانية لمدة شهر وبوت إشارات عبر تيليجرام وأبحاث سوق تعليمية." />')
    .replace(/<meta property="og:image:alt" content="[^"]*"\s*\/?>/i, '<meta property="og:image:alt" content="معاينة منصة تداول TradeAlpha AI" />')
    .replace(/Access QQQ\/Nasdaq signals or the XAUUSD [^<]*? through Telegram\./g, "احصل على إشارات QQQ وناسداك أو خبير XAUUSD للذهب على MT5 عبر تيليجرام.")
    .replace(/"description": "WFO-verified QQQ[^"]*?"/g, '"description": "إشارات QQQ وناسداك موثقة بمنهج WFO عبر تيليجرام، مع تجربة مجانية لمدة شهر ثم 30 دولار شهريا."')
    .replace(/"category": "Trading Signals"/g, '"category": "إشارات تداول"')
    .replace(/"name": "TradeAlpha Signals Monthly"/g, '"name": "TradeAlpha Signals شهريا"')
    .replace(/أبحاث الأسهم وصناديق المؤشرات ومحاور المحافظ\./g, "إشارات تداول ومنتجات سوق من TradeAlpha AI.");
}

function setMeta(html, type, key, value) {
  const escaped = escapeHtml(value || "");
  const pattern = new RegExp(`<meta ${type}="${escapeRegExp(key)}" content="[^"]*"\\s*\\/?>`, "i");
  const tag = `<meta ${type}="${key}" content="${escaped}" />`;
  if (pattern.test(html)) return html.replace(pattern, tag);
  return html.replace(/<\/title>\s*/i, `</title>\n  ${tag}\n  `);
}

function loadLandingTranslations() {
  const source = fs.readFileSync(path.join(root, "landing-i18n.js"), "utf8");
  const match = source.match(/const translations = ([\s\S]*?);\s*function getLanguage/);
  if (!match) return {};
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`translations = ${match[1]};`, sandbox);
  return sandbox.translations || {};
}

function loadArInsightContent(slug) {
  const file = path.join(root, "data", "localization", "ar-insight-content", `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isNoindexDraft(source) {
  const file = path.join(root, source);
  return fs.existsSync(file) && /noindex,nofollow/i.test(fs.readFileSync(file, "utf8"));
}

function walkJson(value, visitor) {
  if (Array.isArray(value)) value.forEach((item) => walkJson(item, visitor));
  else if (value && typeof value === "object") {
    visitor(value);
    Object.values(value).forEach((item) => walkJson(item, visitor));
  }
}

function extractTitle(html) {
  return (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]?.replace(/&amp;/g, "&").trim() || "TradeAlphaAI";
}

function extractDescription(html) {
  return (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1]?.replace(/&amp;/g, "&").trim() || "";
}

function slugFromSource(source) {
  return path.basename(source, ".html");
}

function isAsset(value) {
  return /\.(?:css|js|png|jpe?g|webp|svg|ico|json|webmanifest|xml|txt)$/i.test(value);
}

function readJson(rel, fallback) {
  const file = path.join(root, rel);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function norm(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
