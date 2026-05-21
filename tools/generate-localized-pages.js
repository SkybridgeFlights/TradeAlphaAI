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
    "AI Stock Analyzer": "محلل أسهم الذكاء الاصطناعي",
    "ETF Analyzer": "محلل صناديق المؤشرات",
    "Market Screener": "ماسح السوق",
    "Market Insights": "رؤى السوق",
    Methodology: "المنهجية",
    Insights: "رؤى السوق",
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
    "Open Market Insights": "افتح رؤى السوق",
    "Open Market Screener": "افتح ماسح السوق",
    "Read Market Insights": "اقرأ رؤى السوق"
  },
  terms: [
    ["This analysis is for educational and informational purposes only and does not constitute financial advice.", "هذا التحليل لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."],
    ["educational and informational purposes only and does not constitute financial advice", "لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية"],
    ["not financial advice", "ليست نصيحة مالية"],
    ["financial advice", "نصيحة مالية"],
    ["AI Stock Analysis", "تحليل سهم الذكاء الاصطناعي"],
    ["ETF Analysis", "تحليل صناديق المؤشرات"],
    ["Stock Analysis", "تحليل الأسهم"],
    ["ETF Analyzer", "محلل صناديق المؤشرات"],
    ["AI Stock Analyzer", "محلل أسهم الذكاء الاصطناعي"],
    ["Market Insights", "رؤى السوق"],
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

run();

function run() {
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
  html = ensureLocaleSwitch(html, page, locale, true);
  html = localizeNavigation(html, locale);
  html = ensureMobileNavigation(html, locale, outRel);
  html = ensureSearchAutocomplete(html, outRel);
  html = html.replace(/<script src="([^"]*landing-i18n\.js)"[^>]*><\/script>\s*/g, "");
  if (isArabic) {
    html = localizeStaticText(html, page);
    html = localizeArticleFromContentFile(html, page);
    html = normalizeArabicArtifacts(html);
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
    html = html.replace(/<meta property="article:section" content="[^"]*"\s*\/?>/i, (m) => m.replace(/content="[^"]*"/, `content="${escapeHtml(translateText((m.match(/content="([^"]*)"/) || [])[1] || "رؤى السوق"))}"`));
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
    .replace(/>Insights</g, ">رؤى السوق<")
    .replace(/>Market Insights</g, ">رؤى السوق<")
  );
  html = html.replace(/<span class="insight-category-badge(?: muted)?">[\s\S]*?<\/span>/g, `<span class="insight-category-badge">${escapeHtml(content.category || "رؤى السوق")}</span>`);
  html = html.replace(/<div class="insight-meta-bar">[\s\S]*?<\/div>/, `<div class="insight-meta-bar">
            <span><strong><time datetime="${escapeHtml(data.generatedAt || "2026-05-20")}">${escapeHtml(data.generatedAt || "2026-05-20")}</time></strong></span>
            <span><strong>${escapeHtml(content.readingTime || "6 دقائق قراءة")}</strong></span>
            <span><strong>فريق TradeAlphaAI لأبحاث السوق</strong></span>
            <span><strong>${escapeHtml(content.category || "رؤى السوق")}</strong></span>
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
          { "@type": "ListItem", position: 2, name: "رؤى السوق", item: `${site}/ar/insights/` },
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
    "AI Stock Analyzer": "AI Stock Analyzer",
    "ETF Analyzer": "ETF Analyzer",
    "Market Screener": "Market Screener",
    "Market Insights": "Market Insights",
    Methodology: "Methodology"
  };
  html = html.replace(/<nav class="nav-group"[^>]*>[\s\S]*?<\/nav>/, (nav) => {
    const aria = isArabic ? "التنقل الرئيسي" : "Primary";
    return `<nav class="nav-group" aria-label="${aria}">
          <a href="${isArabic ? "/ar/" : "/"}" class="nav-link">${labels.Home}</a>
          <a href="${isArabic ? "/ar/stocks.html" : "/stocks.html"}" class="nav-link">${labels["AI Stock Analyzer"]}</a>
          <a href="${isArabic ? "/ar/etfs.html" : "/etfs.html"}" class="nav-link">${labels["ETF Analyzer"]}</a>
          <a href="${isArabic ? "/ar/ai-stock-screener.html" : "/ai-stock-screener.html"}" class="nav-link">${labels["Market Screener"]}</a>
          <a href="${isArabic ? "/ar/insights/" : "/insights/"}" class="nav-link">${labels["Market Insights"]}</a>
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
    : `<a class="lang-switch" data-locale-route="ar" href="${arHref}">العربية</a>
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
    routes[sourceIndex] = { ar, en: source || "/" };
    routes[ar] = { ar, en: source || "/" };
    routes[arIndex] = { ar, en: source || "/" };
    routes[en] = { ar, en: source || "/" };
    routes[enIndex] = { ar, en: source || "/" };
  }
  fs.writeFileSync(path.join(root, "js/language-router.js"), `(function () {
  const localizedRoutes = ${JSON.stringify(routes, null, 4)};
  const currentPath = window.location.pathname;
  const routes = localizedRoutes[currentPath] || { ar: "/ar/", en: "/" };
  document.querySelectorAll("[data-locale-route]").forEach((link) => {
    const locale = link.getAttribute("data-locale-route");
    link.setAttribute("href", routes[locale] || routes.en || "/");
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
  return html
    .replace(/â€”|â€“/g, "-")
    .replace(/â†’/g, "←")
    .replace(/â±/g, "")
    .replace(/ðŸ“‚/g, "")
    .replace(/ðŸ“…/g, "")
    .replace(/Â·/g, "·")
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
    .replace(/مخاطر Analysis/g, "تحليل المخاطر")
    .replace(/FAQ\b/g, "الأسئلة الشائعة")
    .replace(/Data center و supply chain overview/g, "نظرة على مراكز البيانات وسلاسل التوريد")
    .replace(/Broad Market/g, "السوق الواسع")
    .replace(/trade-offs/g, "المفاضلات")
    .replace(/How monetary policy affects multiples/g, "كيف تؤثر السياسة النقدية في مضاعفات التقييم")
    .replace(/Market sensitivity in growth الأسهم/g, "حساسية السوق في أسهم النمو")
    .replace(/Rates و Tech/g, "الفائدة والتكنولوجيا")
    .replace(/AI الأسهم Research Hub/g, "محور أبحاث أسهم الذكاء الاصطناعي")
    .replace(/Cloud Computing/g, "الحوسبة السحابية")
    .replace(/Equity Factors/g, "عوامل الأسهم")
    .replace(/Growth vs value الأسهم/g, "أسهم النمو مقابل أسهم القيمة")
    .replace(/Research frameworks for valuation, earnings growth, factor cycles, و rate sensitivity\./g, "أطر بحثية للتقييم ونمو الأرباح ودورات العوامل وحساسية أسعار الفائدة.")
    .replace(/does لاt/g, "لا")
    .replace(/\bلاt\b/g, "لا");
}

function preserveEdgeSpace(original, translated) {
  const leading = original.match(/^\s*/)[0];
  const trailing = original.match(/\s*$/)[0];
  return `${leading}${escapeHtml(translated.trim())}${trailing}`;
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
