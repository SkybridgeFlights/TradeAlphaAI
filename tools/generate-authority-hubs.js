#!/usr/bin/env node
// Phase 17 — Authority Hub Generator
// Generates 12 new evergreen hub pages (EN root + AR + EN alias) and updates
// market-symbols.json, content-templates.js, and sitemaps.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const domain = "https://www.tradealphaai.com";

// ---------------------------------------------------------------------------
// Hub definitions
// ---------------------------------------------------------------------------
const HUBS = [
  {
    key: "dividend-stocks",
    title: "Dividend Stocks",
    arTitle: "أسهم توزيعات الأرباح",
    eyebrow: "Income Hub",
    arEyebrow: "محور الدخل",
    seoTitle: "Dividend Stocks | Income Equity Screening | TradeAlphaAI",
    arSeoTitle: "محور أسهم توزيعات الأرباح | فحص الأسهم ذات العوائد | TradeAlphaAI",
    seoDesc: "Educational dividend stocks hub covering income durability, payout consistency, sector positioning, and interest-rate sensitivity for equity screening.",
    arSeoDesc: "محور تعليمي لأسهم توزيعات الأرباح يغطي جودة العوائد والتوزيعات والقطاعات الدفاعية وحساسية أسعار الفائدة.",
    intro: "Dividend stock research examines income durability, payout consistency, free cash flow discipline, sector positioning, and rate sensitivity for income-oriented equity screening.",
    arIntro: "يتناول بحث أسهم توزيعات الأرباح استدامة الدخل واتساق التوزيعات وانضباط التدفق النقدي الحر والتموضع القطاعي وحساسية أسعار الفائدة.",
    symbols: ["KO", "PEP", "JNJ", "PG", "WMT", "MCD"],
    comparisons: ["compare/ko-vs-pep.html", "compare/v-vs-ma.html", "compare/pg-vs-wmt.html"],
    relatedHubs: ["defensive-stocks.html", "value-stocks.html", "growth-stocks.html"],
    rcKey: "hub-dividend-stocks",
    faqQ1: "What is the Dividend Stocks hub?",
    faqA1: "Dividend Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور أسهم توزيعات الأرباح؟",
    arFaqA1: "محور أسهم توزيعات الأرباح هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور أسهم توزيعات الأرباح نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "blue-chip-stocks",
    title: "Blue Chip Stocks",
    arTitle: "الأسهم الكبرى",
    eyebrow: "Quality Hub",
    arEyebrow: "محور الجودة",
    seoTitle: "Blue Chip Stocks | Large-Cap Quality Research | TradeAlphaAI",
    arSeoTitle: "محور الأسهم الكبرى | تحليل شركات القيادة السوقية | TradeAlphaAI",
    seoDesc: "Educational blue chip stocks hub covering large-cap quality, earnings consistency, brand moats, capital returns, and sector stability.",
    arSeoDesc: "محور تعليمي للأسهم الكبرى يغطي الجودة وقوة الميزانية والقيادة السوقية وعوامل القيمة الطويلة الأجل.",
    intro: "Blue chip stock research reviews large-cap quality factors including earnings consistency, brand moats, market leadership, capital returns, and sector stability.",
    arIntro: "تبحث دراسة الأسهم الكبرى في عوامل جودة الشركات الكبيرة من حيث اتساق الأرباح والحصانة التجارية والقيادة السوقية وعوائد رأس المال والاستقرار القطاعي.",
    symbols: ["AAPL", "MSFT", "GOOGL", "AMZN", "JPM", "PG"],
    comparisons: ["compare/msft-vs-amzn.html", "compare/msft-vs-googl.html", "compare/meta-vs-googl.html"],
    relatedHubs: ["ai-stocks.html", "growth-stocks.html", "momentum-stocks.html"],
    rcKey: "hub-blue-chip-stocks",
    faqQ1: "What is the Blue Chip Stocks hub?",
    faqA1: "Blue Chip Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور الأسهم الكبرى؟",
    arFaqA1: "محور الأسهم الكبرى هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور الأسهم الكبرى نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "healthcare-stocks",
    title: "Healthcare Stocks",
    arTitle: "أسهم الرعاية الصحية",
    eyebrow: "Sector Hub",
    arEyebrow: "محور القطاع",
    seoTitle: "Healthcare Stocks | Pharma and Biotech Screening | TradeAlphaAI",
    arSeoTitle: "محور أسهم الرعاية الصحية | الأدوية والتكنولوجيا الحيوية | TradeAlphaAI",
    seoDesc: "Educational healthcare stocks hub covering pharmaceutical pipelines, drug pricing, patent risk, margin quality, and regulatory approval context.",
    arSeoDesc: "محور تعليمي لأسهم الرعاية الصحية يغطي خطوط الأدوية ومخاطر التنظيم وجودة الهامش وسلوك دوران القطاع.",
    intro: "Healthcare stock research covers pharmaceutical pipelines, drug pricing, patent cliffs, margin quality, regulatory approvals, and sector rotation behavior.",
    arIntro: "يغطي بحث أسهم الرعاية الصحية خطوط الأدوية وأسعارها وانتهاء براءات الاختراع وجودة الهامش والموافقات التنظيمية وسلوك دوران القطاع.",
    symbols: ["LLY", "JNJ", "ABBV", "MRK", "NVO", "AMGN"],
    comparisons: ["compare/jnj-vs-mrk.html", "compare/unh-vs-lly.html", "compare/xlv-vs-vig.html"],
    relatedHubs: ["defensive-stocks.html", "value-stocks.html", "healthcare-etfs.html"],
    rcKey: "hub-healthcare-stocks",
    faqQ1: "What is the Healthcare Stocks hub?",
    faqA1: "Healthcare Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور أسهم الرعاية الصحية؟",
    arFaqA1: "محور أسهم الرعاية الصحية هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور أسهم الرعاية الصحية نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "energy-stocks",
    title: "Energy Stocks",
    arTitle: "أسهم الطاقة",
    eyebrow: "Sector Hub",
    arEyebrow: "محور القطاع",
    seoTitle: "Energy Stocks | Oil and Gas Equity Screening | TradeAlphaAI",
    arSeoTitle: "محور أسهم الطاقة | النفط والغاز وفحص الطاقة | TradeAlphaAI",
    seoDesc: "Educational energy stocks hub covering commodity exposure, capital discipline, free cash flow yield, and geopolitical sensitivity in oil and gas sector research.",
    arSeoDesc: "محور تعليمي لأسهم الطاقة يغطي التعرض للسلع وانضباط رأس المال والتدفق النقدي الحر في قطاع النفط والطاقة.",
    intro: "Energy stock research covers commodity exposure, capital discipline, production profiles, geopolitical sensitivity, and free cash flow yield for oil and energy sector screening.",
    arIntro: "يغطي بحث أسهم الطاقة التعرض للسلع وانضباط رأس المال وملفات الإنتاج وحساسية المخاطر الجيوسياسية وعائد التدفق النقدي الحر.",
    symbols: ["XOM", "CVX", "SLB"],
    comparisons: ["compare/xom-vs-cvx.html", "compare/xle-vs-xlf.html"],
    relatedHubs: ["defensive-stocks.html", "value-stocks.html", "dividend-stocks.html"],
    rcKey: "hub-energy-stocks",
    faqQ1: "What is the Energy Stocks hub?",
    faqA1: "Energy Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور أسهم الطاقة؟",
    arFaqA1: "محور أسهم الطاقة هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور أسهم الطاقة نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "momentum-stocks",
    title: "Momentum Stocks",
    arTitle: "أسهم الزخم",
    eyebrow: "Theme Hub",
    arEyebrow: "محور مواضيعي",
    seoTitle: "Momentum Stocks | Trend and Relative Strength Screening | TradeAlphaAI",
    arSeoTitle: "محور أسهم الزخم | قيادة الأداء والزخم النسبي | TradeAlphaAI",
    seoDesc: "Educational momentum stocks hub covering price trends, relative strength, earnings acceleration, sector leadership, and momentum reversal risk.",
    arSeoDesc: "محور تعليمي لأسهم الزخم يغطي اتجاهات الأسعار والقوة النسبية وتسارع الأرباح ومخاطر انعكاس الزخم.",
    intro: "Momentum stock research examines price trends, relative strength, earnings acceleration, sector leadership, and the risk that momentum reversals can be sharp.",
    arIntro: "يبحث بحث أسهم الزخم في اتجاهات الأسعار والقوة النسبية وتسارع الأرباح وقيادة القطاع ومخاطر الانعكاسات الحادة في الزخم.",
    symbols: ["NVDA", "TSLA", "META", "AMZN", "PLTR"],
    comparisons: ["compare/nvda-vs-amd.html", "compare/meta-vs-googl.html", "compare/tsla-vs-uber.html"],
    relatedHubs: ["ai-stocks.html", "growth-stocks.html", "blue-chip-stocks.html"],
    rcKey: "hub-momentum-stocks",
    faqQ1: "What is the Momentum Stocks hub?",
    faqA1: "Momentum Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور أسهم الزخم؟",
    arFaqA1: "محور أسهم الزخم هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور أسهم الزخم نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "value-stocks",
    title: "Value Stocks",
    arTitle: "أسهم القيمة",
    eyebrow: "Market Hub",
    arEyebrow: "محور السوق",
    seoTitle: "Value Stocks | Low-Multiple Equity Screening | TradeAlphaAI",
    arSeoTitle: "محور أسهم القيمة | فحص مضاعفات التقييم المنخفضة | TradeAlphaAI",
    seoDesc: "Educational value stocks hub comparing price-to-earnings, free cash flow yield, dividend coverage, and balance sheet quality relative to sector peers.",
    arSeoDesc: "محور تعليمي لأسهم القيمة يقارن مضاعفات السعر للأرباح وعائد التدفق النقدي وتغطية التوزيعات وجودة الميزانية.",
    intro: "Value stock research compares price-to-earnings, price-to-book, free cash flow yield, dividend coverage, and balance sheet quality relative to sector peers.",
    arIntro: "يقارن بحث أسهم القيمة مضاعفات السعر للأرباح والسعر للدفتر وعائد التدفق النقدي وتغطية التوزيعات وجودة الميزانية نسبة إلى الأقران في القطاع.",
    symbols: ["JPM", "KO", "PEP", "WMT", "MCD", "JNJ"],
    comparisons: ["compare/ko-vs-pep.html", "compare/jpm-vs-gs.html", "compare/pg-vs-wmt.html"],
    relatedHubs: ["defensive-stocks.html", "dividend-stocks.html", "healthcare-stocks.html"],
    rcKey: "hub-value-stocks",
    faqQ1: "What is the Value Stocks hub?",
    faqA1: "Value Stocks is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور أسهم القيمة؟",
    arFaqA1: "محور أسهم القيمة هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور أسهم القيمة نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "bond-etfs",
    title: "Bond ETFs",
    arTitle: "صناديق السندات",
    eyebrow: "Fixed Income Hub",
    arEyebrow: "محور الدخل الثابت",
    seoTitle: "Bond ETFs | Fixed Income Duration and Credit Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق السندات | الدخل الثابت والمدة وجودة الائتمان | TradeAlphaAI",
    seoDesc: "Educational bond ETFs hub comparing duration, credit quality, yield, and interest-rate sensitivity across government, investment-grade, and high-yield fund categories.",
    arSeoDesc: "محور تعليمي لصناديق السندات يقارن المدة وجودة الائتمان والعائد وحساسية أسعار الفائدة عبر فئات صناديق الحكومة وعالي العائد.",
    intro: "Bond ETF research compares duration, credit quality, yield, expense structure, and interest-rate sensitivity across government, investment-grade, and high-yield fund categories.",
    arIntro: "يقارن بحث صناديق السندات المدة وجودة الائتمان والعائد وهيكل المصاريف وحساسية أسعار الفائدة عبر صناديق الحكومة والجودة الاستثمارية وعالي العائد.",
    symbols: ["TLT", "BND", "IEF", "HYG", "LQD"],
    comparisons: ["compare/bnd-vs-ief.html", "compare/tlt-vs-ief.html"],
    relatedHubs: ["defensive-etfs.html", "low-volatility-etfs.html", "dividend-etfs.html"],
    rcKey: "hub-bond-etfs",
    faqQ1: "What is the Bond ETFs hub?",
    faqA1: "Bond ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق السندات؟",
    arFaqA1: "محور صناديق السندات هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق السندات نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "real-estate-etfs",
    title: "Real Estate ETFs",
    arTitle: "صناديق العقارات",
    eyebrow: "Sector ETF Hub",
    arEyebrow: "محور صناديق القطاع",
    seoTitle: "Real Estate ETFs | REIT Sector and Dividend Yield Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق العقارات | صناديق الاستثمار العقاري والعائد | TradeAlphaAI",
    seoDesc: "Educational real estate ETFs hub covering REIT sector exposure, dividend yield quality, rate sensitivity, and property type diversification.",
    arSeoDesc: "محور تعليمي لصناديق العقارات يغطي تعرض قطاع صناديق الاستثمار العقاري وجودة عائد التوزيعات وحساسية أسعار الفائدة.",
    intro: "Real estate ETF research covers REIT sector exposure, dividend yield quality, rate sensitivity, property type diversification, and portfolio income characteristics.",
    arIntro: "يغطي بحث صناديق العقارات التعرض لقطاع صناديق الاستثمار العقاري وجودة عائد التوزيعات وحساسية أسعار الفائدة وتنويع أنواع العقارات وخصائص الدخل.",
    symbols: ["VNQ"],
    comparisons: ["compare/schd-vs-vig.html", "compare/xlv-vs-vig.html"],
    relatedHubs: ["defensive-etfs.html", "dividend-etfs.html", "bond-etfs.html"],
    rcKey: "hub-real-estate-etfs",
    faqQ1: "What is the Real Estate ETFs hub?",
    faqA1: "Real Estate ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق العقارات؟",
    arFaqA1: "محور صناديق العقارات هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق العقارات نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "commodity-etfs",
    title: "Commodity ETFs",
    arTitle: "صناديق السلع",
    eyebrow: "Alternative Assets Hub",
    arEyebrow: "محور الأصول البديلة",
    seoTitle: "Commodity ETFs | Gold and Metals Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق السلع | الذهب والمعادن وفحص السلع | TradeAlphaAI",
    seoDesc: "Educational commodity ETFs hub covering gold, metals, and broad commodity exposure with attention to inflation hedging, correlations, and portfolio diversification.",
    arSeoDesc: "محور تعليمي لصناديق السلع يغطي التحوط من التضخم والعلاقات والتنويع عبر صناديق الذهب والمعادن والطاقة.",
    intro: "Commodity ETF research covers gold, metals, energy, and broad commodity exposure with attention to inflation hedging, correlations, futures roll costs, and portfolio diversification.",
    arIntro: "يغطي بحث صناديق السلع الذهب والمعادن والطاقة والتعرض الواسع للسلع مع الاهتمام بالتحوط من التضخم والعلاقات وتكاليف التجديد وتنويع المحفظة.",
    symbols: ["GLD", "GDX"],
    comparisons: ["compare/tlt-vs-ief.html", "compare/spy-vs-voo.html"],
    relatedHubs: ["defensive-etfs.html", "bond-etfs.html"],
    rcKey: "hub-commodity-etfs",
    faqQ1: "What is the Commodity ETFs hub?",
    faqA1: "Commodity ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق السلع؟",
    arFaqA1: "محور صناديق السلع هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق السلع نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "emerging-market-etfs",
    title: "Emerging Market ETFs",
    arTitle: "صناديق الأسواق الناشئة",
    eyebrow: "Global Markets Hub",
    arEyebrow: "محور الأسواق العالمية",
    seoTitle: "Emerging Market ETFs | International Equity Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق الأسواق الناشئة | التعرض للأسهم الدولية | TradeAlphaAI",
    seoDesc: "Educational emerging market ETFs hub comparing geographic exposure, currency risk, earnings quality, and growth cycle sensitivity across international equity funds.",
    arSeoDesc: "محور تعليمي لصناديق الأسواق الناشئة يقارن التعرض الجغرافي والمخاطر السياسية ودورات النمو عبر صناديق الأسهم الدولية.",
    intro: "Emerging market ETF research compares geographic exposure, currency risk, earnings quality, political risk, and growth cycle sensitivity across international equity funds.",
    arIntro: "يقارن بحث صناديق الأسواق الناشئة التعرض الجغرافي ومخاطر العملة وجودة الأرباح والمخاطر السياسية وحساسية دورة النمو عبر صناديق الأسهم الدولية.",
    symbols: ["EEM", "IEMG", "EFA", "VXUS"],
    comparisons: ["compare/spy-vs-voo.html", "compare/iwm-vs-rsp.html"],
    relatedHubs: ["ai-etfs.html", "growth-stocks.html"],
    rcKey: "hub-emerging-market-etfs",
    faqQ1: "What is the Emerging Market ETFs hub?",
    faqA1: "Emerging Market ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق الأسواق الناشئة؟",
    arFaqA1: "محور صناديق الأسواق الناشئة هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق الأسواق الناشئة نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "healthcare-etfs",
    title: "Healthcare ETFs",
    arTitle: "صناديق الرعاية الصحية",
    eyebrow: "Sector ETF Hub",
    arEyebrow: "محور صناديق القطاع",
    seoTitle: "Healthcare ETFs | Pharma and Biotech ETF Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق الرعاية الصحية | الأدوية والتكنولوجيا الحيوية | TradeAlphaAI",
    seoDesc: "Educational healthcare ETFs hub comparing pharmaceutical, biotech, medical devices, and broad healthcare sector exposure across fund structures.",
    arSeoDesc: "محور تعليمي لصناديق الرعاية الصحية يقارن الأدوية والتكنولوجيا الحيوية والأجهزة الطبية والتعرض القطاعي الواسع.",
    intro: "Healthcare ETF research compares pharmaceutical, biotech, medical devices, and services sector exposure across broad and focused healthcare funds.",
    arIntro: "يقارن بحث صناديق الرعاية الصحية الأدوية والتكنولوجيا الحيوية والأجهزة الطبية والخدمات القطاعية من خلال هيكل الصندوق وسياق المخاطر.",
    symbols: ["XBI", "XLV"],
    comparisons: ["compare/xlv-vs-vig.html", "compare/jnj-vs-mrk.html"],
    relatedHubs: ["defensive-etfs.html", "healthcare-stocks.html", "dividend-etfs.html"],
    rcKey: "hub-healthcare-etfs",
    faqQ1: "What is the Healthcare ETFs hub?",
    faqA1: "Healthcare ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق الرعاية الصحية؟",
    arFaqA1: "محور صناديق الرعاية الصحية هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق الرعاية الصحية نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  },
  {
    key: "low-volatility-etfs",
    title: "Low Volatility ETFs",
    arTitle: "صناديق التذبذب المنخفض",
    eyebrow: "Defensive ETF Hub",
    arEyebrow: "محور الصناديق الدفاعية",
    seoTitle: "Low Volatility ETFs | Defensive Factor Screening | TradeAlphaAI",
    arSeoTitle: "محور صناديق التذبذب المنخفض | الدفاعي وجودة العوامل | TradeAlphaAI",
    seoDesc: "Educational low volatility ETFs hub examining drawdown profiles, quality factors, income yield, sector tilt, and defensive fund behavior across market environments.",
    arSeoDesc: "محور تعليمي لصناديق التذبذب المنخفض يفحص ملفات الانسحاب وعوامل الجودة وعائد الدخل والميل القطاعي.",
    intro: "Low volatility ETF research examines drawdown profiles, quality factors, income yield, sector tilt, and how defensive fund structures behave across different market environments.",
    arIntro: "يفحص بحث صناديق التذبذب المنخفض ملفات الانسحاب وعوامل الجودة وعائد الدخل والميل القطاعي وكيف تتصرف هياكل الصناديق الدفاعية في مختلف بيئات السوق.",
    symbols: ["JEPI", "QUAL", "SCHD", "VIG"],
    comparisons: ["compare/schd-vs-vig.html", "compare/jepi-vs-schd.html"],
    relatedHubs: ["defensive-etfs.html", "dividend-etfs.html", "bond-etfs.html"],
    rcKey: "hub-low-volatility-etfs",
    faqQ1: "What is the Low Volatility ETFs hub?",
    faqA1: "Low Volatility ETFs is an educational screening hub with curated symbols, internal research links, and TradeAlphaAI score context.",
    arFaqQ1: "ما هو محور صناديق التذبذب المنخفض؟",
    arFaqA1: "محور صناديق التذبذب المنخفض هو محور فحص تعليمي يضم رموزاً منتقاة وروابط بحثية داخلية وسياق درجة TradeAlphaAI.",
    arFaqQ2: "هل محتوى محور صناديق التذبذب المنخفض نصيحة مالية؟",
    arFaqA2: "لا. هذا المحور لأغراض تعليمية ومعلوماتية فقط ولا يُعد نصيحة مالية."
  }
];

// ---------------------------------------------------------------------------
// HTML templates
// ---------------------------------------------------------------------------
function enPage(h) {
  const faqStatic = `<details><summary>${esc(h.faqQ1)}</summary><p>${esc(h.faqA1)}</p></details>` +
    `<details><summary>Is ${esc(h.title)} content financial advice?</summary><p>No. This hub is for educational and informational purposes only and does not constitute financial advice.</p></details>`;

  const authorityBtns = [
    `<a class="market-btn primary" href="rankings.html">Rankings</a>`,
    `<a class="market-btn" href="insights/">Articles</a>`,
    `<a class="market-btn" href="methodology.html">Methodology</a>`,
    ...h.comparisons.map(c => `<a class="market-btn" href="${c}">${compareName(c)}</a>`),
    ...h.relatedHubs.map(r => `<a class="market-btn" href="${r}">${hubName(r)}</a>`)
  ].join("");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "TradeAlphaAI", "item": `${domain}/` },
          { "@type": "ListItem", "position": 2, "name": "Screener", "item": `${domain}/ai-stock-screener.html` },
          { "@type": "ListItem", "position": 3, "name": h.title, "item": `${domain}/${h.key}.html` }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": h.faqQ1, "acceptedAnswer": { "@type": "Answer", "text": h.faqA1 } },
          { "@type": "Question", "name": `Is ${h.title} content financial advice?`, "acceptedAnswer": { "@type": "Answer", "text": "No. This hub is for educational and informational purposes only and does not constitute financial advice." } }
        ]
      }
    ]
  }, null, 2);

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${h.seoTitle}</title>
  <meta name="description" content="${h.seoDesc}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${domain}/${h.key}.html" />
  <!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${domain}/${h.key}.html" />
  <link rel="alternate" hreflang="en-US" href="${domain}/en/${h.key}.html" />
  <link rel="alternate" hreflang="ar" href="${domain}/ar/${h.key}.html" />
  <link rel="alternate" hreflang="x-default" href="${domain}/${h.key}.html" />
  <!-- localized-static-pages:end -->
<meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${h.seoTitle}" />
  <meta property="og:description" content="${h.seoDesc}" />
  <meta property="og:url" content="${domain}/${h.key}.html" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${domain}/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI research hub preview for ${h.title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${h.seoTitle}" />
  <meta name="twitter:description" content="${h.seoDesc}" />
  <meta name="twitter:image" content="${domain}/Image/og-image.svg" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="landing.css" />
  <link rel="stylesheet" href="css/market/market-portal.css" />
  <script type="application/ld+json">
${schema}
  </script>
</head>
<body class="market-page">
  <!-- generated:market-hub key=${h.key} -->
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="index.html">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>TradeAlpha AI</strong><span>Research Platform</span></span>
      </a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="Primary">
          <a href="/" class="nav-link">Home</a>
          <a href="/stocks.html" class="nav-link">Global Stock Research</a>
          <a href="/etfs.html" class="nav-link">ETF Analyzer</a>
          <a href="/ai-stock-screener.html" class="nav-link">Market Screener</a>
          <div class="nav-menu">
            <a href="/rankings.html" class="nav-link nav-menu-trigger">Top Picks<span class="nav-badge">Hot</span></a>
            <div class="nav-dropdown">
              <a href="/rankings.html#top-stocks">Top 10 Stocks Right Now</a>
              <a href="/rankings.html#top-ai-stocks">Best AI Stocks</a>
              <a href="/rankings.html#top-semiconductor-stocks">Best Semiconductor Stocks</a>
              <a href="/rankings.html#top-growth-stocks">Best Growth Stocks</a>
              <a href="/rankings.html#top-dividend-etfs">Top Dividend ETFs</a>
              <a href="/rankings.html#top-broad-market-etfs">Best ETFs for 2026</a>
            </div>
          </div>
          <a href="/insights/" class="nav-link">Articles</a>
          <a href="/methodology.html" class="nav-link">Methodology</a>
        </nav>
      <div class="locale-links" aria-label="Language">
          <a class="lang-switch" data-locale-route="ar" href="/ar/${h.key}.html">Arabic</a>
          <a class="lang-switch" data-locale-route="en" href="/${h.key}.html">English</a>
        </div>
        <button class="mobile-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="index.html">Home</a><span>/</span><a href="ai-stock-screener.html">Screener</a><span>/</span><span>${h.title}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${h.eyebrow}</span><h1 data-hub-title>${h.title}</h1><p class="market-lead" data-hub-intro>${h.intro}</p><div class="market-actions"><a class="market-btn primary" href="ai-stock-screener.html">Market Screener</a><a class="market-btn" href="insights/">Articles</a><a class="market-btn" href="methodology.html">Methodology</a><a class="market-btn" href="stocks.html">Stock Research</a></div></div></section>
      <section class="market-section"><div data-data-status></div></section>
      <section class="market-section"><div class="market-panel" data-market-authority="hub"></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Curated Assets</span><h2>${h.title} watchlist candidates</h2><div class="market-grid" data-hub-assets></div></div></section>
      <section class="market-section"><div class="theme-grid" data-hub-sections></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-timeline="hub" data-count="5"></div></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-themes data-count="4"></div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Continue Reading</span><h2>Explore connected market research</h2><div data-rc="${h.rcKey}"></div></div></section>
      <section class="market-section"><div class="market-panel compare-panel"><span class="eyebrow">Authority Paths</span><h2>Rankings, comparisons, and sector research</h2><div class="cta-actions">${authorityBtns}</div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Recently Viewed</span><h2>Your local research trail</h2><div class="compact-grid" data-recently-viewed></div></div></section>
      <section class="market-section"><div class="market-panel stock-faq"><span class="eyebrow">FAQ</span><h2>${h.title} FAQ</h2><noscript>${esc(faqStatic)}</noscript></div></section>
    </div>
  </main>
  <script type="module">import { initHubPage } from "./js/market/ui-renderer.js"; initHubPage("${h.key}");</script>
  <script src="js/market/market-authority-layer.js"></script>
  <script src="js/related-content.js"></script>
  <script src="js/research-layer.js"></script>
  <script src="../js/mobile-nav.js" defer></script>
  <script src="../js/language-router.js" defer></script>
</body>
</html>
`;
}

function arPage(h) {
  const arAuthorityBtns = [
    `<a class="market-btn primary" href="/ar/rankings.html">التصنيفات</a>`,
    `<a class="market-btn" href="/ar/insights/">المقالات</a>`,
    `<a class="market-btn" href="/ar/methodology.html">المنهجية</a>`,
    ...h.comparisons.map(c => `<a class="market-btn" href="/${c}">${compareName(c)}</a>`),
    ...h.relatedHubs.map(r => `<a class="market-btn" href="/ar/${r}">${arHubName(r)}</a>`)
  ].join("");

  const arFaqStatic = `<details><summary>${esc(h.arFaqQ1)}</summary><p>${esc(h.arFaqA1)}</p></details>` +
    `<details><summary>${esc(h.arFaqQ2)}</summary><p>${esc(h.arFaqA2)}</p></details>`;

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "TradeAlphaAI", "item": `${domain}/ar/` },
          { "@type": "ListItem", "position": 2, "name": "ماسح السوق", "item": `${domain}/ar/ai-stock-screener.html` },
          { "@type": "ListItem", "position": 3, "name": h.arTitle, "item": `${domain}/ar/${h.key}.html` }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": h.arFaqQ1, "acceptedAnswer": { "@type": "Answer", "text": h.arFaqA1 } },
          { "@type": "Question", "name": h.arFaqQ2, "acceptedAnswer": { "@type": "Answer", "text": h.arFaqA2 } }
        ]
      }
    ]
  }, null, 2);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${h.arSeoTitle}</title>
  <meta property="og:locale" content="ar_AR" />
  <meta name="description" content="${h.arSeoDesc}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${domain}/ar/${h.key}.html" />
  <!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${domain}/${h.key}.html" />
  <link rel="alternate" hreflang="en-US" href="${domain}/en/${h.key}.html" />
  <link rel="alternate" hreflang="ar" href="${domain}/ar/${h.key}.html" />
  <link rel="alternate" hreflang="x-default" href="${domain}/${h.key}.html" />
  <!-- localized-static-pages:end -->
<meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${h.arSeoTitle}" />
  <meta property="og:description" content="${h.arSeoDesc}" />
  <meta property="og:url" content="${domain}/ar/${h.key}.html" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${domain}/Image/og-image.svg" />
  <meta property="og:image:alt" content="معاينة بحثية من TradeAlphaAI" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${h.arSeoTitle}" />
  <meta name="twitter:description" content="${h.arSeoDesc}" />
  <meta name="twitter:image" content="${domain}/Image/og-image.svg" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${schema}
  </script>
</head>
<body class="market-page localized-page localized-ar" data-locale="ar">
  <!-- generated:market-hub key=${h.key} -->
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="/ar/">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>TradeAlpha AI</strong><span>منصة الأبحاث</span></span>
      </a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="التنقل الرئيسي">
          <a href="/ar/" class="nav-link">الرئيسية</a>
          <a href="/ar/stocks.html" class="nav-link">بحث الأسهم العالمي</a>
          <a href="/ar/etfs.html" class="nav-link">محلل صناديق المؤشرات</a>
          <a href="/ar/ai-stock-screener.html" class="nav-link">ماسح السوق</a>
          <div class="nav-menu">
            <a href="/ar/rankings.html" class="nav-link nav-menu-trigger">أفضل الاختيارات<span class="nav-badge">رائج</span></a>
            <div class="nav-dropdown">
              <a href="/ar/rankings.html#top-stocks">أفضل 10 أسهم حالياً</a>
              <a href="/ar/rankings.html#top-ai-stocks">أفضل أسهم الذكاء الاصطناعي</a>
              <a href="/ar/rankings.html#top-semiconductors">أفضل أسهم أشباه الموصلات</a>
              <a href="/ar/rankings.html#top-growth-stocks">أفضل أسهم النمو</a>
              <a href="/ar/rankings.html#top-dividend-etfs">أفضل صناديق توزيعات الأرباح</a>
              <a href="/ar/rankings.html#top-etfs">أفضل صناديق المؤشرات لعام 2026</a>
            </div>
          </div>
          <a href="/ar/insights/" class="nav-link">المقالات</a>
          <a href="/ar/methodology.html" class="nav-link">المنهجية</a>
        </nav>
      <div class="locale-links" aria-label="اختيار اللغة">
          <a class="lang-switch" data-locale-route="en" href="/${h.key}.html">English</a>
          <a class="lang-switch" data-locale-route="ar" href="/ar/${h.key}.html">العربية</a>
        </div>
        <button class="mobile-menu-toggle" type="button" aria-label="فتح القائمة" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/ar/">الرئيسية</a><span>/</span><a href="/ar/ai-stock-screener.html">ماسح السوق</a><span>/</span><span>${h.arTitle}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${h.arEyebrow}</span><h1 data-hub-title>${h.arTitle}</h1><p class="market-lead" data-hub-intro>${h.arIntro}</p><div class="market-actions"><a class="market-btn primary" href="/ar/ai-stock-screener.html">ماسح السوق</a><a class="market-btn" href="/ar/insights/">المقالات</a><a class="market-btn" href="/ar/methodology.html">المنهجية</a><a class="market-btn" href="/ar/stocks.html">بحث الأسهم</a></div></div></section>
      <section class="market-section"><div data-data-status></div></section>
      <section class="market-section"><div class="market-panel" data-market-authority="hub"></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">أصول مختارة</span><h2>مرشحو قائمة المتابعة: ${h.arTitle}</h2><div class="market-grid" data-hub-assets></div></div></section>
      <section class="market-section"><div class="theme-grid" data-hub-sections></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-timeline="hub" data-count="5"></div></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-themes data-count="4"></div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">تابع القراءة</span><h2>استكشف أبحاث السوق المرتبطة</h2><div data-rc="${h.rcKey}"></div></div></section>
      <section class="market-section"><div class="market-panel compare-panel"><span class="eyebrow">مسارات الأبحاث</span><h2>التصنيفات والمقارنات وأبحاث القطاع</h2><div class="cta-actions">${arAuthorityBtns}</div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">شوهدت مؤخراً</span><h2>مسار أبحاثك المحلي</h2><div class="compact-grid" data-recently-viewed></div></div></section>
      <section class="market-section"><div class="market-panel stock-faq"><span class="eyebrow">الأسئلة الشائعة</span><h2>${h.arTitle} — الأسئلة الشائعة</h2><noscript>${esc(arFaqStatic)}</noscript></div></section>
    </div>
  </main>
  <script type="module">import { initHubPage } from "/js/market/ui-renderer.js"; initHubPage("${h.key}");</script>
  <script src="/js/market/market-authority-layer.js"></script>
  <script src="/js/related-content.js"></script>
  <script src="/js/research-layer.js"></script>
  <script src="/../js/mobile-nav.js" defer></script>
  <script src="/../js/language-router.js" defer></script>
</body>
</html>
`;
}

function enAliasPage(h) {
  const faqStatic = `<details><summary>${esc(h.faqQ1)}</summary><p>${esc(h.faqA1)}</p></details>` +
    `<details><summary>Is ${esc(h.title)} content financial advice?</summary><p>No. This hub is for educational and informational purposes only and does not constitute financial advice.</p></details>`;

  const authorityBtns = [
    `<a class="market-btn primary" href="/rankings.html">Rankings</a>`,
    `<a class="market-btn" href="/insights/">Articles</a>`,
    `<a class="market-btn" href="/methodology.html">Methodology</a>`,
    ...h.comparisons.map(c => `<a class="market-btn" href="/${c}">${compareName(c)}</a>`),
    ...h.relatedHubs.map(r => `<a class="market-btn" href="/${r}">${hubName(r)}</a>`)
  ].join("");

  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "TradeAlphaAI", "item": `${domain}/en/` },
          { "@type": "ListItem", "position": 2, "name": "Screener", "item": `${domain}/en/ai-stock-screener.html` },
          { "@type": "ListItem", "position": 3, "name": h.title, "item": `${domain}/en/${h.key}.html` }
        ]
      },
      {
        "@type": "FAQPage",
        "mainEntity": [
          { "@type": "Question", "name": h.faqQ1, "acceptedAnswer": { "@type": "Answer", "text": h.faqA1 } },
          { "@type": "Question", "name": `Is ${h.title} content financial advice?`, "acceptedAnswer": { "@type": "Answer", "text": "No. This hub is for educational and informational purposes only and does not constitute financial advice." } }
        ]
      }
    ]
  }, null, 2);

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${h.seoTitle}</title>
  <meta property="og:locale" content="en_US" />
  <meta name="description" content="${h.seoDesc}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${domain}/en/${h.key}.html" />
  <!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${domain}/${h.key}.html" />
  <link rel="alternate" hreflang="en-US" href="${domain}/en/${h.key}.html" />
  <link rel="alternate" hreflang="ar" href="${domain}/ar/${h.key}.html" />
  <link rel="alternate" hreflang="x-default" href="${domain}/${h.key}.html" />
  <!-- localized-static-pages:end -->
<meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${h.seoTitle}" />
  <meta property="og:description" content="${h.seoDesc}" />
  <meta property="og:url" content="${domain}/en/${h.key}.html" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${domain}/Image/og-image.svg" />
  <meta property="og:image:alt" content="TradeAlphaAI research hub preview for ${h.title}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${h.seoTitle}" />
  <meta name="twitter:description" content="${h.seoDesc}" />
  <meta name="twitter:image" content="${domain}/Image/og-image.svg" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${schema}
  </script>
</head>
<body class="market-page localized-page localized-en" data-locale="en">
  <!-- generated:market-hub key=${h.key} -->
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="/">
        <span class="brand-mark" aria-hidden="true"></span>
        <span class="brand-copy"><strong>TradeAlpha AI</strong><span>Research Platform</span></span>
      </a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="Primary">
          <a href="/" class="nav-link">Home</a>
          <a href="/stocks.html" class="nav-link">Global Stock Research</a>
          <a href="/etfs.html" class="nav-link">ETF Analyzer</a>
          <a href="/ai-stock-screener.html" class="nav-link">Market Screener</a>
          <div class="nav-menu">
            <a href="/rankings.html" class="nav-link nav-menu-trigger">Top Picks<span class="nav-badge">Hot</span></a>
            <div class="nav-dropdown">
              <a href="/rankings.html#top-stocks">Top 10 Stocks Right Now</a>
              <a href="/rankings.html#top-ai-stocks">Best AI Stocks</a>
              <a href="/rankings.html#top-semiconductor-stocks">Best Semiconductor Stocks</a>
              <a href="/rankings.html#top-growth-stocks">Best Growth Stocks</a>
              <a href="/rankings.html#top-dividend-etfs">Top Dividend ETFs</a>
              <a href="/rankings.html#top-broad-market-etfs">Best ETFs for 2026</a>
            </div>
          </div>
          <a href="/insights/" class="nav-link">Articles</a>
          <a href="/methodology.html" class="nav-link">Methodology</a>
        </nav>
      <div class="locale-links" aria-label="Language">
          <a class="lang-switch" data-locale-route="ar" href="/ar/${h.key}.html">Arabic</a>
          <a class="lang-switch" data-locale-route="en" href="/${h.key}.html">English</a>
        </div>
        <button class="mobile-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/ai-stock-screener.html">Screener</a><span>/</span><span>${h.title}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${h.eyebrow}</span><h1 data-hub-title>${h.title}</h1><p class="market-lead" data-hub-intro>${h.intro}</p><div class="market-actions"><a class="market-btn primary" href="/ai-stock-screener.html">Market Screener</a><a class="market-btn" href="/insights/">Articles</a><a class="market-btn" href="/methodology.html">Methodology</a><a class="market-btn" href="/stocks.html">Stock Research</a></div></div></section>
      <section class="market-section"><div data-data-status></div></section>
      <section class="market-section"><div class="market-panel" data-market-authority="hub"></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Curated Assets</span><h2>${h.title} watchlist candidates</h2><div class="market-grid" data-hub-assets></div></div></section>
      <section class="market-section"><div class="theme-grid" data-hub-sections></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-timeline="hub" data-count="5"></div></div></section>
      <section class="market-section"><div class="market-panel"><div data-research-themes data-count="4"></div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Continue Reading</span><h2>Explore connected market research</h2><div data-rc="${h.rcKey}"></div></div></section>
      <section class="market-section"><div class="market-panel compare-panel"><span class="eyebrow">Authority Paths</span><h2>Rankings, comparisons, and sector research</h2><div class="cta-actions">${authorityBtns}</div></div></section>
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Recently Viewed</span><h2>Your local research trail</h2><div class="compact-grid" data-recently-viewed></div></div></section>
      <section class="market-section"><div class="market-panel stock-faq"><span class="eyebrow">FAQ</span><h2>${h.title} FAQ</h2><noscript>${esc(faqStatic)}</noscript></div></section>
    </div>
  </main>
  <script type="module">import { initHubPage } from "/js/market/ui-renderer.js"; initHubPage("${h.key}");</script>
  <script src="/js/market/market-authority-layer.js"></script>
  <script src="/js/related-content.js"></script>
  <script src="/js/research-layer.js"></script>
  <script src="/js/mobile-nav.js" defer></script>
  <script src="/js/language-router.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function compareName(href) {
  const slug = href.replace("compare/", "").replace(".html", "");
  return slug.replace(/-vs-/, " vs ").toUpperCase().replace(/([A-Z]+)-([A-Z]+)/g, "$1-$2");
}

function hubName(href) {
  const key = href.replace(".html", "");
  return key.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

const AR_HUB_NAMES = {
  "defensive-stocks.html": "الأسهم الدفاعية",
  "value-stocks.html": "أسهم القيمة",
  "growth-stocks.html": "أسهم النمو",
  "ai-stocks.html": "أسهم الذكاء الاصطناعي",
  "momentum-stocks.html": "أسهم الزخم",
  "blue-chip-stocks.html": "الأسهم الكبرى",
  "dividend-stocks.html": "أسهم توزيعات الأرباح",
  "healthcare-stocks.html": "أسهم الرعاية الصحية",
  "energy-stocks.html": "أسهم الطاقة",
  "semiconductor-stocks.html": "أشباه الموصلات",
  "cybersecurity-stocks.html": "الأمن السيبراني",
  "cloud-stocks.html": "أسهم السحابة",
  "fintech-stocks.html": "التكنولوجيا المالية",
  "dividend-etfs.html": "صناديق التوزيعات",
  "defensive-etfs.html": "الصناديق الدفاعية",
  "ai-etfs.html": "صناديق الذكاء الاصطناعي",
  "bond-etfs.html": "صناديق السندات",
  "real-estate-etfs.html": "صناديق العقارات",
  "commodity-etfs.html": "صناديق السلع",
  "healthcare-etfs.html": "صناديق الرعاية الصحية",
  "low-volatility-etfs.html": "صناديق التذبذب المنخفض",
  "emerging-market-etfs.html": "الأسواق الناشئة"
};

function arHubName(href) {
  return AR_HUB_NAMES[href] || hubName(href);
}

// ---------------------------------------------------------------------------
// Write files
// ---------------------------------------------------------------------------
function write(rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

for (const hub of HUBS) {
  write(`${hub.key}.html`, enPage(hub));
  write(`ar/${hub.key}.html`, arPage(hub));
  write(`en/${hub.key}.html`, enAliasPage(hub));
  console.log(`  Generated: ${hub.key}.html + ar/ + en/`);
}

// ---------------------------------------------------------------------------
// Update data/market-symbols.json
// ---------------------------------------------------------------------------
const symbolsPath = path.join(root, "data/market-symbols.json");
const marketConfig = JSON.parse(fs.readFileSync(symbolsPath, "utf8"));
const existingKeys = new Set((marketConfig.hubs || []).map(h => h.key));

for (const hub of HUBS) {
  if (!existingKeys.has(hub.key)) {
    marketConfig.hubs.push({
      key: hub.key,
      title: hub.title,
      pagePath: `${hub.key}.html`,
      seoTitle: hub.seoTitle,
      seoDescription: hub.seoDesc
    });
    existingKeys.add(hub.key);
  }
}
marketConfig.generatedAt = new Date().toISOString().slice(0, 10);
fs.writeFileSync(symbolsPath, JSON.stringify(marketConfig, null, 2), "utf8");
console.log(`  Updated: data/market-symbols.json (${marketConfig.hubs.length} total hubs)`);

// ---------------------------------------------------------------------------
// Update js/market/content-templates.js
// ---------------------------------------------------------------------------
const ctPath = path.join(root, "js/market/content-templates.js");
let ctSrc = fs.readFileSync(ctPath, "utf8");

const newHubDefs = HUBS.map(h => {
  const sections = buildSections(h);
  return `  "${h.key}": {
    title: "${h.title}",
    eyebrow: "${h.eyebrow}",
    intro: "${h.intro.replace(/"/g, '\\"')}",
    symbols: ${JSON.stringify(h.symbols)},
    sections: ${JSON.stringify(sections, null, 6).replace(/^/gm, "    ").trim()}
  }`;
}).join(",\n");

// Find the closing }; of hubDefinitions and inject before it
const closeMarker = "\n};\n";
const insertAt = ctSrc.lastIndexOf(closeMarker);
if (insertAt !== -1) {
  ctSrc = ctSrc.slice(0, insertAt) + ",\n" + newHubDefs + ctSrc.slice(insertAt);
  fs.writeFileSync(ctPath, ctSrc, "utf8");
  console.log(`  Updated: js/market/content-templates.js (${HUBS.length} hub definitions added)`);
} else {
  console.warn("  WARNING: could not find hubDefinitions closing marker in content-templates.js");
}

function buildSections(h) {
  const sectionsByKey = {
    "dividend-stocks": [
      ["Income and Yield Context", "Dividend-paying stocks are researched for payout history, cash flow coverage, sector exposure, and how income characteristics interact with interest-rate environments."],
      ["Defensive Versus Growth", "High-yield dividend stocks often differ from dividend-growth stocks in sector, risk profile, and sensitivity to rate changes."],
      ["Research Use", "This hub is for educational screening of income-oriented equity candidates and does not provide buy or sell recommendations."]
    ],
    "blue-chip-stocks": [
      ["Quality and Scale", "Large-cap quality names are often researched for earnings durability, balance sheet strength, return on capital, and brand defensibility."],
      ["Valuation Sensitivity", "Blue chip stocks can still carry valuation risk when growth expectations or sector leadership assumptions shift."],
      ["Research Use", "This hub connects large-cap quality candidates to peer comparisons, rankings, and educational screening context."]
    ],
    "healthcare-stocks": [
      ["Pipeline and Approval Risk", "Healthcare stocks can be sensitive to clinical trial outcomes, FDA decisions, patent expirations, and reimbursement policy changes."],
      ["Defensive Characteristics", "Healthcare sector names can behave defensively in macro downturns, but company-specific risk from pipeline events can be significant."],
      ["Research Use", "This hub is educational screening context for pharmaceutical and healthcare equity candidates."]
    ],
    "energy-stocks": [
      ["Commodity Sensitivity", "Energy stocks can move with oil prices, natural gas demand, refining margins, and global supply-demand cycles."],
      ["Capex and Free Cash Flow", "Capital discipline, dividend sustainability, and free cash flow yield are key research factors for energy equity screening."],
      ["Research Use", "This hub connects energy sector candidates to comparisons, rankings, and educational methodology context."]
    ],
    "momentum-stocks": [
      ["Momentum Risk", "Momentum strategies can amplify returns in trending markets but carry elevated reversal risk when catalysts change or sentiment shifts quickly."],
      ["Earnings and Guidance", "Momentum stocks are often sensitive to earnings guidance revisions and macro liquidity conditions."],
      ["Research Use", "This hub is for educational screening of momentum candidates and does not provide buy or sell recommendations."]
    ],
    "value-stocks": [
      ["Value Versus Growth", "Value stocks often screen well when rates rise or growth expectations become stretched, but may lag during strong liquidity cycles."],
      ["Sector Concentration", "Value exposure tends to concentrate in financials, consumer staples, healthcare, and industrials — each with distinct macro sensitivities."],
      ["Research Use", "This hub links value candidates to comparisons, defensive hubs, and income-oriented screening context."]
    ],
    "bond-etfs": [
      ["Duration and Rate Risk", "Bond ETFs with longer duration can be more sensitive to interest-rate changes, while shorter-duration and floating-rate funds may behave differently."],
      ["Credit and Spread Risk", "High-yield bond ETFs carry different risk from investment-grade funds because credit spreads and default risk vary significantly."],
      ["Research Use", "This hub provides educational context for fixed-income ETF screening and does not constitute investment advice."]
    ],
    "real-estate-etfs": [
      ["REIT and Rate Sensitivity", "Real estate investment trust ETFs can be sensitive to interest-rate changes because financing costs, cap rates, and income yield all interact with rates."],
      ["Property Sector Mix", "REIT ETFs can hold residential, commercial, industrial, healthcare, or data-center real estate, each with distinct macro sensitivities."],
      ["Research Use", "This hub is educational context for real estate ETF screening and does not provide investment recommendations."]
    ],
    "commodity-etfs": [
      ["Inflation and Safe-Haven Context", "Gold ETFs are often researched for inflation hedging, safe-haven demand, and portfolio correlation properties rather than growth screening."],
      ["Commodity Cyclicality", "Commodity prices can be affected by demand cycles, currency movements, mining supply, and geopolitical factors."],
      ["Research Use", "This hub connects commodity ETF candidates to educational context, comparisons, and sector-level screening."]
    ],
    "emerging-market-etfs": [
      ["Currency and Political Risk", "Emerging market ETFs can be affected by currency movements, sovereign debt levels, political transitions, and trade policy changes."],
      ["Growth and Diversification", "International equity exposure can differ from U.S. market behavior, offering diversification context but also distinct risk profiles."],
      ["Research Use", "This hub is for educational context on international and emerging-market ETF screening."]
    ],
    "healthcare-etfs": [
      ["Biotech Versus Broad Healthcare", "Biotech ETFs can carry higher volatility than broad healthcare ETFs because clinical outcomes and FDA decisions can drive large price moves."],
      ["Defensive Versus Growth", "Broad healthcare ETFs may behave more defensively, while biotech-focused funds carry growth and binary event risk."],
      ["Research Use", "This hub connects healthcare ETF candidates to related comparisons, sector research, and educational screening."]
    ],
    "low-volatility-etfs": [
      ["Low Vol and Factor Risk", "Low-volatility ETFs can lag in strong bull markets but may provide smoother drawdown profiles during risk-off periods."],
      ["Quality and Income Overlap", "Many low-volatility strategies also screen for dividend quality and balance sheet strength, creating overlap with income ETF research."],
      ["Research Use", "This hub links defensive factor ETFs to related comparisons, dividend hubs, and educational screening context."]
    ]
  };
  return sectionsByKey[h.key] || [
    ["Sector Overview", `${h.title} research reviews sector-specific risk, valuation, and momentum factors.`],
    ["Research Use", "This hub is educational context for equity screening and does not provide investment recommendations."]
  ];
}

// ---------------------------------------------------------------------------
// Update sitemaps
// ---------------------------------------------------------------------------
const SITEMAPS_TO_UPDATE = [
  { file: "sitemap-core.xml", urlFn: h => `${domain}/${h.key}.html`, priority: "0.78" },
  { file: "sitemap-ar.xml", urlFn: h => `${domain}/ar/${h.key}.html`, priority: "0.80" },
  { file: "sitemap-market.xml", urlFn: h => `${domain}/${h.key}.html`, priority: "0.82" }
];

for (const { file, urlFn, priority } of SITEMAPS_TO_UPDATE) {
  const smPath = path.join(root, file);
  let sm = fs.readFileSync(smPath, "utf8");
  let added = 0;
  for (const hub of HUBS) {
    const url = urlFn(hub);
    if (!sm.includes(`<loc>${url}</loc>`)) {
      const entry = `  <url>\n    <loc>${url}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>\n  </url>\n`;
      sm = sm.replace("</urlset>", entry + "</urlset>");
      added++;
    }
  }
  fs.writeFileSync(smPath, sm, "utf8");
  console.log(`  Updated: ${file} (+${added} URLs)`);
}

console.log(`\nAuthority hub generation complete.`);
console.log(`  EN pages: ${HUBS.length}`);
console.log(`  AR pages: ${HUBS.length}`);
console.log(`  EN alias pages: ${HUBS.length}`);
console.log(`  Total files written: ${HUBS.length * 3}`);
console.log(`  Total hubs now: ${marketConfig.hubs.length}`);
