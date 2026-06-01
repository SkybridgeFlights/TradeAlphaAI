#!/usr/bin/env node
// Phase 19 — Task 1: Add relatedHubs, relatedCompares, relatedInsights to each
// hub definition in data/market-symbols.json to power the topical cluster mesh.

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "data", "market-symbols.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

const CLUSTER_MAP = {
  "semiconductor-stocks": {
    relatedHubs: ["ai-stocks", "cloud-stocks", "ai-etfs"],
    relatedCompares: ["nvda-vs-amd.html", "nvda-vs-avgo.html", "amd-vs-intc.html", "smh-vs-soxx.html", "amat-vs-klac.html", "avgo-vs-qcom.html"],
    relatedInsights: ["semiconductor-cycle-risks", "semiconductor-stocks-outlook", "ai-infrastructure-demand"],
    hubFaq: [
      { q: "What semiconductor stocks are most researched?", a: "NVDA, AMD, AVGO, TSM, ASML, QCOM, and AMAT are among the most researched semiconductor stocks on TradeAlphaAI. Each has distinct exposure to AI chip demand, memory cycles, equipment, or foundry services." },
      { q: "How does semiconductor demand relate to AI?", a: "AI training and inference require specialized chips — primarily GPUs and custom accelerators (ASICs, TPUs). As AI workloads scale, demand for high-bandwidth memory, advanced logic chips, and semiconductor capital equipment tends to increase. This connects semiconductor stocks directly to AI infrastructure research." },
      { q: "What is SOXX and how is it different from individual semiconductor stocks?", a: "SOXX (iShares Semiconductor ETF) provides diversified exposure to the semiconductor sector, spreading risk across chip designers, manufacturers, and equipment companies. Individual stocks like NVDA or AMD offer more concentrated exposure to specific business models, with higher potential upside and downside relative to the sector index." }
    ]
  },
  "ai-stocks": {
    relatedHubs: ["semiconductor-stocks", "cloud-stocks", "growth-stocks"],
    relatedCompares: ["meta-vs-googl.html", "msft-vs-googl.html", "msft-vs-amzn.html", "pltr-vs-snow.html", "spy-vs-qqq.html"],
    relatedInsights: ["ai-stocks-market-overview", "ai-infrastructure-demand", "custom-ai-chips-asics-tpus"],
    hubFaq: [
      { q: "What qualifies a stock as an AI stock?", a: "In research context, AI stocks are companies with significant revenue exposure to AI infrastructure, AI software platforms, or AI services. This includes semiconductor suppliers (NVDA, AMD, AVGO), cloud hyperscalers (MSFT, GOOGL, AMZN), AI software platforms (CRM, NOW, PLTR), and companies building AI-native products. Most are categorized as growth stocks and trade at premium multiples." },
      { q: "Are AI stocks the same as tech stocks?", a: "Not exactly. AI stocks are a subset of tech stocks, focused on companies directly involved in building, enabling, or monetizing artificial intelligence. Traditional tech stocks (enterprise software, hardware, semiconductors) have varying degrees of AI exposure. QQQ and XLK include many AI-adjacent names alongside legacy tech businesses." },
      { q: "What are the main risks in AI stock research?", a: "Key research risks include valuation sensitivity (high P/E multiples amplify downside), capex cycle concentration (spending by a few hyperscalers drives demand), regulatory and geopolitical risk (chip export controls, data regulation), and the risk that current AI monetization doesn't scale fast enough to justify infrastructure spending." }
    ]
  },
  "dividend-etfs": {
    relatedHubs: ["dividend-stocks", "defensive-etfs", "bond-etfs"],
    relatedCompares: ["schd-vs-vig.html", "jepi-vs-schd.html", "spy-vs-voo.html", "bnd-vs-ief.html"],
    relatedInsights: ["dividend-etfs-explained", "etf-expense-ratios-explained", "sector-etfs-vs-broad-market"],
    hubFaq: [
      { q: "What are dividend ETFs and how do they work?", a: "Dividend ETFs hold baskets of dividend-paying stocks. The ETF collects dividends from its holdings and distributes them to shareholders periodically (monthly or quarterly). Examples include SCHD (focused on dividend quality), VIG (dividend growth), and JEPI (covered-call income strategy). Each has a different methodology for selecting holdings and generating income." },
      { q: "What is the difference between SCHD and VIG?", a: "SCHD screens for dividend consistency, payout ratio, and cash flow quality. VIG selects companies with 10+ years of consecutive dividend growth. VIG tends to hold higher-quality large-cap companies with moderate yields; SCHD targets higher yields with a quality screen. Both are popular dividend ETF options in research frameworks." },
      { q: "Are dividend ETFs defensive investments?", a: "Dividend ETFs can behave defensively because dividend-paying companies often have stable earnings and lower beta. However, dividend ETFs have sector concentration (often Financials, Healthcare, Consumer Staples, Industrials) and rate sensitivity — rising rates can make dividend yields less attractive relative to bonds, pressuring prices." },
      { q: "How do interest rates affect dividend ETFs?", a: "Higher interest rates tend to pressure dividend ETF prices because bonds become more competitive as income alternatives. Rate-sensitive sectors like Utilities and REITs — sometimes found in dividend ETF holdings — are particularly affected. This is a key research variable when evaluating dividend ETF risk profiles." }
    ]
  },
  "growth-stocks": {
    relatedHubs: ["ai-stocks", "momentum-stocks", "value-stocks"],
    relatedCompares: ["tsla-vs-uber.html", "meta-vs-googl.html", "msft-vs-amzn.html", "snow-vs-mdb.html"],
    relatedInsights: ["growth-stocks-vs-value-stocks", "interest-rates-and-tech-stocks", "mega-cap-tech-index-concentration"],
    hubFaq: [
      { q: "What makes a stock a growth stock?", a: "Growth stocks are characterized by above-average revenue and earnings growth rates, high reinvestment of profits (rather than dividends), and valuation multiples (P/E, P/S) above the market average. Investors pay premium prices expecting future earnings to grow rapidly enough to justify current multiples. NVDA, MSFT, TSLA, META, and AMZN are often classified as growth stocks." },
      { q: "Why do growth stocks underperform when interest rates rise?", a: "Growth stocks have high equity duration — much of their value comes from earnings far in the future. When discount rates rise, future cash flows are worth less in present value terms. This makes growth stocks disproportionately sensitive to rate hikes compared to value stocks, where earnings are more near-term." },
      { q: "How is a growth ETF different from a growth stock?", a: "A growth ETF (like VUG, SCHG, or QQQ) holds a diversified basket of growth stocks, reducing single-name risk. Individual growth stocks offer more concentrated exposure with higher potential gains and risks. ETFs provide automatic rebalancing and broader sector representation." }
    ]
  },
  "cybersecurity-stocks": {
    relatedHubs: ["cloud-stocks", "ai-stocks", "fintech-stocks"],
    relatedCompares: ["crwd-vs-panw.html", "crwd-vs-zs.html", "panw-vs-ftnt.html", "net-vs-zs.html", "ddog-vs-net.html"],
    relatedInsights: ["cybersecurity-stocks-to-watch", "cloud-computing-ai-market-structure"],
    hubFaq: [
      { q: "What are the key cybersecurity platforms to research?", a: "CRWD (CrowdStrike), PANW (Palo Alto Networks), ZS (Zscaler), FTNT (Fortinet), and NET (Cloudflare) are among the most widely researched cybersecurity stocks. Each has distinct architectural approaches: CRWD focuses on endpoint detection; ZS on zero-trust networking; PANW on platform consolidation; NET on network security and edge." },
      { q: "How does AI affect cybersecurity stocks?", a: "AI is a double-edged factor for cybersecurity research. Attackers use AI to develop faster, more sophisticated threats. Defenders (cybersecurity companies) use AI to automate threat detection, reduce response times, and identify patterns at scale. AI investment by cybersecurity vendors is a key growth thesis, and competition from hyperscaler AI security offerings is a risk factor." },
      { q: "Are cybersecurity stocks growth or value stocks?", a: "Most are classified as growth stocks — they trade at premium revenue multiples (high EV/Sales ratios) reflecting market expectations of rapid revenue expansion. They typically reinvest heavily rather than paying dividends. As the sector matures and companies reach profitability at scale, some are transitioning toward more moderate growth profiles." }
    ]
  },
  "cloud-stocks": {
    relatedHubs: ["ai-stocks", "cybersecurity-stocks", "semiconductor-stocks"],
    relatedCompares: ["msft-vs-googl.html", "msft-vs-amzn.html", "crm-vs-now.html", "snow-vs-mdb.html", "ddog-vs-net.html", "adbe-vs-intu.html", "pltr-vs-snow.html"],
    relatedInsights: ["cloud-computing-stocks-overview", "cloud-computing-ai-market-structure", "hyperscaler-capex-cycles"],
    hubFaq: [
      { q: "What are hyperscalers and why do they matter for cloud research?", a: "Hyperscalers are the largest cloud platform providers: Microsoft Azure, Amazon Web Services (AWS), and Google Cloud. Together they represent the majority of enterprise cloud infrastructure spending. Their capital expenditure cycles are a leading indicator for cloud-adjacent stocks including semiconductors, networking, and SaaS platforms." },
      { q: "How is cloud computing related to AI investment?", a: "Cloud platforms are the primary delivery mechanism for AI workloads. Enterprises consume AI through cloud APIs and services rather than building their own data centers. This creates revenue growth for Azure, AWS, and GCP as AI adoption increases, and concentrates AI semiconductor demand through hyperscaler hardware purchasing." },
      { q: "What is the difference between cloud infrastructure and SaaS stocks?", a: "Cloud infrastructure stocks (MSFT, AMZN, GOOGL) sell compute, storage, and networking capacity. SaaS stocks (CRM, NOW, SNOW, ADBE) build software applications delivered via cloud subscription. Infrastructure stocks have more hardware-linked revenue cycles; SaaS stocks have more recurring, sticky revenue but face pricing pressure from AI commoditization." }
    ]
  },
  "fintech-stocks": {
    relatedHubs: ["blue-chip-stocks", "defensive-stocks", "growth-stocks"],
    relatedCompares: ["jpm-vs-gs.html", "v-vs-ma.html", "gs-vs-ms.html", "blk-vs-jpm.html", "pypl-vs-shop.html"],
    relatedInsights: ["portfolio-diversification-basics", "mega-cap-tech-index-concentration"],
    hubFaq: [
      { q: "What types of companies are in the fintech sector?", a: "The fintech sector spans traditional financial services (JPM, GS, MS, BLK) and technology-enabled financial platforms (V, MA, PYPL, SHOP). Research coverage includes payment networks, asset managers, investment banks, digital wallets, and e-commerce platforms with financial services integration." },
      { q: "How do interest rates affect financial stocks?", a: "Rising interest rates generally benefit traditional banks (higher net interest margin) but can pressure growth-oriented fintech platforms (higher discount rates reduce future earnings valuation). Payment networks like V and MA have more volume-driven revenue models less directly tied to interest rate cycles." }
    ]
  },
  "defensive-stocks": {
    relatedHubs: ["blue-chip-stocks", "defensive-etfs", "value-stocks"],
    relatedCompares: ["ko-vs-pep.html", "pg-vs-wmt.html", "jnj-vs-mrk.html", "unh-vs-lly.html", "xom-vs-cvx.html", "cost-vs-wmt.html"],
    relatedInsights: ["portfolio-diversification-basics", "growth-stocks-vs-value-stocks"],
    hubFaq: [
      { q: "What makes a stock defensive?", a: "Defensive stocks are in sectors with relatively stable demand regardless of economic cycles: Consumer Staples (food, beverages, household products), Healthcare (pharmaceuticals, insurance), Utilities, and select Industrials. Examples include KO, PEP, PG, JNJ, MRK, WMT. They typically have lower beta and more predictable earnings." },
      { q: "Do defensive stocks outperform during recessions?", a: "Defensive stocks often show relative outperformance during economic downturns because demand for food, medicine, and utilities is less discretionary. However, they can underperform during strong economic expansions when cyclical and growth stocks accelerate. The sector rotation research variable here is economic cycle positioning." },
      { q: "Are defensive stocks the same as dividend stocks?", a: "Many defensive stocks are dividend payers, but they are not identical categories. Defensive stocks are defined by business stability and low economic sensitivity; dividend stocks are defined by income distribution. There is significant overlap (KO, PG, JNJ pay dividends and are defensive), but some high-dividend stocks (utilities, REITs) have significant interest-rate sensitivity." }
    ]
  },
  "ai-etfs": {
    relatedHubs: ["ai-stocks", "semiconductor-stocks", "cloud-stocks"],
    relatedCompares: ["spy-vs-qqq.html", "qqq-vs-vug.html", "qqq-vs-xlk.html", "smh-vs-soxx.html", "arkq-vs-botz.html", "arkk-vs-schg.html"],
    relatedInsights: ["ai-stocks-market-overview", "sector-etfs-vs-broad-market", "etf-expense-ratios-explained"],
    hubFaq: [
      { q: "What are AI ETFs and how are they structured?", a: "AI ETFs hold baskets of stocks with AI-related business exposure. QQQ tracks the Nasdaq-100, which includes the largest tech and AI names. SMH and SOXX focus on semiconductor companies powering AI hardware. BOTZ and ARKQ target robotics and autonomous technology themes. Each has different index methodology, concentration, and expense ratios." },
      { q: "Is QQQ an AI ETF?", a: "QQQ (Invesco QQQ Trust) tracks the Nasdaq-100 index, which includes the largest non-financial companies on the Nasdaq exchange. While QQQ has significant exposure to AI-related stocks (NVDA, MSFT, META, AMZN, GOOGL), it is broader than a pure-play AI ETF. It also includes retail, healthcare, and other sectors. Many researchers use QQQ as a proxy for growth and AI exposure in portfolio research." },
      { q: "How does SMH compare to SOXX for semiconductor research?", a: "Both track semiconductor sector exposure. SMH (VanEck Semiconductor ETF) has higher concentration in the top holdings. SOXX (iShares Semiconductor ETF) uses a modified equal-weight methodology, giving more weight to smaller semiconductor names. Expense ratios and tracking differences are key comparison variables." }
    ]
  },
  "defensive-etfs": {
    relatedHubs: ["dividend-etfs", "bond-etfs", "low-volatility-etfs"],
    relatedCompares: ["spy-vs-voo.html", "spy-vs-vti.html", "schd-vs-vig.html", "jepi-vs-schd.html", "bnd-vs-ief.html", "xlv-vs-vig.html"],
    relatedInsights: ["portfolio-diversification-basics", "dividend-etfs-explained", "etf-expense-ratios-explained"],
    hubFaq: [
      { q: "What are defensive ETFs and who uses them in research?", a: "Defensive ETFs hold assets expected to hold value better during market downturns. This includes broad market ETFs like SPY and VOO, dividend-focused ETFs (SCHD, VIG), sector ETFs in Healthcare (XLV) or Consumer Staples, and low-volatility strategies. Researchers use them as anchors in portfolio context analysis." },
      { q: "Is SPY a defensive ETF?", a: "SPY is a broad market ETF tracking the S&P 500, which includes both cyclical and defensive sectors. It is not a pure defensive ETF but is often used as a benchmark or conservative core holding compared to sector ETFs or individual stocks. Compared to QQQ (Nasdaq-100), SPY has more sector diversification and somewhat lower volatility." }
    ]
  },
  "dividend-stocks": {
    relatedHubs: ["dividend-etfs", "defensive-stocks", "blue-chip-stocks"],
    relatedCompares: ["cost-vs-wmt.html", "ko-vs-pep.html", "jnj-vs-mrk.html", "pg-vs-wmt.html"],
    relatedInsights: ["dividend-etfs-explained", "growth-stocks-vs-value-stocks"],
    hubFaq: [
      { q: "What is a dividend stock and how does it differ from a growth stock?", a: "Dividend stocks distribute a portion of earnings to shareholders as regular cash payments (dividends). They tend to be mature companies with stable earnings and slower growth — KO, PEP, PG, JNJ, WMT. Growth stocks reinvest earnings rather than paying dividends. Dividend stocks generally have lower P/E multiples and more predictable cash returns." },
      { q: "What is dividend yield and how is it calculated?", a: "Dividend yield is the annual dividend per share divided by the current stock price, expressed as a percentage. A stock paying $2 per year in dividends trading at $50 has a 4% yield. Higher yield is not always better — a rising yield can reflect a falling stock price, which may signal business stress (a dividend trap). Research focuses on dividend sustainability, not just current yield." }
    ]
  },
  "blue-chip-stocks": {
    relatedHubs: ["dividend-stocks", "defensive-stocks", "value-stocks"],
    relatedCompares: ["ko-vs-pep.html", "jpm-vs-gs.html", "jnj-vs-mrk.html", "pg-vs-wmt.html", "cost-vs-wmt.html"],
    relatedInsights: ["mega-cap-tech-index-concentration", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What are blue-chip stocks?", a: "Blue-chip stocks are shares of large, well-established, financially stable companies with a long history of reliable performance. They typically have large market capitalizations, strong brand recognition, and consistent dividend records. Examples: AAPL, MSFT, JPM, JNJ, KO, PG, WMT. The term originates from poker, where blue chips historically had the highest value." },
      { q: "Are blue-chip stocks safe investments?", a: "Blue-chip stocks are generally considered lower-risk than small-cap or growth stocks, but no stock is risk-free. They can still decline significantly during broad market downturns, sector-specific challenges, or business model disruption. Research framework: evaluate competitive moat, earnings stability, balance sheet strength, and valuation relative to historical ranges." }
    ]
  },
  "healthcare-stocks": {
    relatedHubs: ["defensive-stocks", "blue-chip-stocks", "healthcare-etfs"],
    relatedCompares: ["jnj-vs-mrk.html", "unh-vs-lly.html"],
    relatedInsights: ["portfolio-diversification-basics", "sector-etfs-vs-broad-market"],
    hubFaq: [
      { q: "Why are healthcare stocks considered defensive?", a: "Healthcare demand is relatively inelastic — people need medications, medical procedures, and insurance regardless of economic conditions. This gives healthcare companies more stable revenues across economic cycles compared to discretionary sectors. However, healthcare stocks face regulatory risk (drug pricing legislation, FDA approvals) and patent cliff risk as drugs lose exclusivity." },
      { q: "What is the difference between pharma, biotech, and healthcare services?", a: "Pharmaceutical companies (JNJ, MRK, ABBV, GILD) develop and sell established drugs. Biotech companies (typically smaller, high-risk) develop novel biological therapies with binary outcomes (approval or failure). Healthcare services companies (UNH) manage insurance and care delivery. Each has distinct business model, risk profile, and valuation framework." },
      { q: "How does GLP-1 drug development affect healthcare stocks?", a: "GLP-1 drugs (obesity and diabetes treatments from LLY and NVO) represent one of the largest pharmaceutical growth cycles in recent history. Their success has influenced valuations across the healthcare sector — benefiting drug manufacturers and creating research questions for sectors potentially affected by lower obesity-related procedures and products." }
    ]
  },
  "energy-stocks": {
    relatedHubs: ["defensive-stocks", "value-stocks", "commodity-etfs"],
    relatedCompares: ["xom-vs-cvx.html"],
    relatedInsights: ["sector-etfs-vs-broad-market", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What drives energy stock prices?", a: "Energy stocks are primarily driven by oil and natural gas prices, which are influenced by global demand, OPEC production decisions, U.S. shale output, geopolitical supply disruptions, and the pace of energy transition. XOM and CVX are integrated majors with upstream (production), midstream, and downstream (refining) segments. SLB serves the oilfield services market." },
      { q: "Are energy stocks a hedge against inflation?", a: "Energy stocks have historically shown positive correlation with inflation because energy prices are a major inflation component. When commodity prices rise, energy company revenues typically increase. However, energy stocks also carry commodity cycle risk — prices can fall sharply as demand weakens or supply increases." }
    ]
  },
  "momentum-stocks": {
    relatedHubs: ["growth-stocks", "ai-stocks", "semiconductor-stocks"],
    relatedCompares: ["nvda-vs-amd.html", "tsla-vs-uber.html", "meta-vs-googl.html"],
    relatedInsights: ["understanding-beta-in-stocks", "interest-rates-and-tech-stocks"],
    hubFaq: [
      { q: "What is momentum in stock research?", a: "Momentum is the tendency for assets with recent strong performance to continue outperforming in the near term. Momentum stocks have demonstrated sustained price gains driven by earnings beats, positive analyst revisions, or strong sector tailwinds. MTUM (iShares MSCI USA Momentum Factor ETF) tracks this factor systematically." },
      { q: "What are the risks of momentum investing?", a: "Momentum can reverse sharply — high-momentum stocks often experience significant drawdowns when sentiment shifts, earnings disappoint, or sector rotation occurs. Momentum strategies require frequent rebalancing and can have high turnover. The 2022 tech selloff is a reference case for momentum reversal risk." }
    ]
  },
  "value-stocks": {
    relatedHubs: ["blue-chip-stocks", "defensive-stocks", "dividend-stocks"],
    relatedCompares: ["cost-vs-wmt.html", "pg-vs-wmt.html", "ko-vs-pep.html", "jpm-vs-gs.html"],
    relatedInsights: ["growth-stocks-vs-value-stocks", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What are value stocks?", a: "Value stocks trade at below-average multiples (P/E, P/B, EV/EBITDA) relative to their earnings, book value, or cash flows. The value investing thesis is that the market has underpriced these companies, and over time prices will revert toward intrinsic value. Classic value sectors: Financials, Energy, Utilities, Consumer Staples, Industrials." },
      { q: "Growth vs value: which performs better?", a: "Neither consistently outperforms across all environments. Growth tends to outperform during low-rate, strong-earnings-growth periods. Value tends to outperform when interest rates rise, economic recovery widens, and when growth valuations are stretched. Sector rotation research tracks which factor leadership is consistent with macro conditions." }
    ]
  },
  "bond-etfs": {
    relatedHubs: ["defensive-etfs", "dividend-etfs", "low-volatility-etfs"],
    relatedCompares: ["bnd-vs-ief.html", "tlt-vs-ief.html"],
    relatedInsights: ["portfolio-diversification-basics", "etf-expense-ratios-explained"],
    hubFaq: [
      { q: "What are bond ETFs and how do they work?", a: "Bond ETFs hold diversified portfolios of fixed-income securities. BND provides broad U.S. bond market exposure. TLT focuses on long-term Treasuries (20+ years). IEF covers intermediate Treasuries (7-10 years). LQD holds investment-grade corporate bonds. HYG holds high-yield (junk) corporate bonds. Each has different duration, credit risk, and yield profile." },
      { q: "How do interest rates affect bond ETF prices?", a: "Bond prices move inversely to yields. When interest rates rise, bond prices fall — and longer-duration bond ETFs (TLT) fall more than short-duration ETFs. This is called duration risk. TLT can experience large drawdowns during rate-hike cycles. IEF (intermediate duration) has less interest rate sensitivity than TLT." },
      { q: "What is the difference between investment-grade and high-yield bonds?", a: "Investment-grade bonds (LQD, BND) are issued by companies with strong credit ratings, offering lower yields with lower default risk. High-yield bonds (HYG) are issued by lower-rated companies, offering higher yields with higher default risk. In research frameworks, high-yield spreads (the yield difference versus Treasuries) are used as a risk sentiment indicator." }
    ]
  },
  "real-estate-etfs": {
    relatedHubs: ["defensive-etfs", "dividend-etfs", "low-volatility-etfs"],
    relatedCompares: ["spy-vs-voo.html"],
    relatedInsights: ["sector-etfs-vs-broad-market", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What are real estate ETFs and how are they different from REITs?", a: "Real estate ETFs (like VNQ — Vanguard Real Estate ETF) hold baskets of Real Estate Investment Trusts (REITs). REITs are companies that own income-producing real estate (office buildings, apartments, data centers, shopping malls). ETFs provide diversified REIT exposure versus owning a single REIT. REITs are required to distribute 90%+ of taxable income as dividends." },
      { q: "Why are real estate ETFs sensitive to interest rates?", a: "REITs borrow heavily to finance real estate acquisitions. Higher interest rates increase their financing costs, compressing profit margins. Additionally, higher bond yields make REIT dividend yields less attractive by comparison, reducing investor demand and prices. Research: evaluate REIT interest rate sensitivity alongside dividend yield and cap rates." }
    ]
  },
  "commodity-etfs": {
    relatedHubs: ["energy-stocks", "defensive-etfs", "emerging-market-etfs"],
    relatedCompares: ["spy-vs-voo.html"],
    relatedInsights: ["sector-etfs-vs-broad-market", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What are commodity ETFs and what do they hold?", a: "Commodity ETFs provide exposure to physical commodities or commodity futures. GLD (SPDR Gold Shares) tracks gold prices by holding physical gold. GDX (VanEck Gold Miners ETF) holds gold mining company stocks — providing leveraged gold exposure with additional business risk. XLE (Energy Select Sector) holds energy stocks tied to oil and natural gas. Each has distinct return characteristics." },
      { q: "Why do investors use gold ETFs in research frameworks?", a: "Gold is studied as a store of value and potential hedge against currency debasement and inflation. GLD provides direct gold price exposure without custody costs of physical gold. Research caveat: gold does not produce earnings or pay dividends, so traditional valuation frameworks don't apply — its value depends primarily on market sentiment and macro conditions." }
    ]
  },
  "emerging-market-etfs": {
    relatedHubs: ["real-estate-etfs", "commodity-etfs", "defensive-etfs"],
    relatedCompares: ["spy-vs-voo.html", "spy-vs-vti.html"],
    relatedInsights: ["sector-etfs-vs-broad-market", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What are emerging market ETFs?", a: "Emerging market ETFs provide exposure to equities in developing economies including China, India, Brazil, South Korea, Taiwan, and other countries with rapidly growing economies. EEM (iShares MSCI Emerging Markets ETF) and IEMG (iShares Core MSCI Emerging Markets) are widely researched. They offer higher potential growth alongside higher political, currency, and liquidity risk." },
      { q: "What are the key risks in emerging market ETF research?", a: "Key research risks include political/regulatory risk (government intervention, restrictions on foreign investors), currency risk (EM currency depreciation reduces USD returns), liquidity risk (some markets have limited trading volumes), and concentration risk (China represents a large share of most EM indices, creating single-country exposure)." }
    ]
  },
  "healthcare-etfs": {
    relatedHubs: ["healthcare-stocks", "defensive-etfs", "defensive-stocks"],
    relatedCompares: ["xlv-vs-vig.html", "jnj-vs-mrk.html"],
    relatedInsights: ["sector-etfs-vs-broad-market", "portfolio-diversification-basics"],
    hubFaq: [
      { q: "What does XLV (Health Care Select Sector SPDR) hold?", a: "XLV holds large-cap healthcare stocks from the S&P 500, spanning pharmaceuticals (JNJ, MRK, ABBV), health services and insurance (UNH), medical devices, and biotech. It is one of the most widely used healthcare sector ETF references. Expense ratio and broad sector diversification make it a common baseline in sector research." },
      { q: "Why include healthcare ETFs in a diversified research framework?", a: "Healthcare has historically demonstrated lower correlation with the broader market during economic contractions, making it a common defensive sector allocation. Healthcare ETFs provide diversified exposure across pharma, biotech, devices, and services — reducing the binary risk of individual biotech or drug approval outcomes." }
    ]
  },
  "low-volatility-etfs": {
    relatedHubs: ["defensive-etfs", "bond-etfs", "dividend-etfs"],
    relatedCompares: ["spy-vs-voo.html", "bnd-vs-ief.html"],
    relatedInsights: ["portfolio-diversification-basics", "understanding-beta-in-stocks"],
    hubFaq: [
      { q: "What are low-volatility ETFs and how do they work?", a: "Low-volatility ETFs use factor-based screening to select stocks with historically lower price volatility (lower standard deviation of returns). QUAL (iShares MSCI USA Quality Factor) screens for quality metrics like high return on equity, stable earnings, and low financial leverage. MTUM screens for price momentum. These are factor ETFs targeting specific risk-return characteristics." },
      { q: "Does lower volatility mean lower returns?", a: "Not necessarily. The low-volatility anomaly in academic research suggests that lower-volatility stocks have historically produced competitive risk-adjusted returns compared to high-volatility stocks. However, low-volatility ETFs can underperform in strong bull markets when higher-risk names lead. Research uses Sharpe ratio and max drawdown alongside raw returns to evaluate these ETFs." }
    ]
  }
};

// Update hub definitions
let updated = 0;
for (const hub of config.hubs) {
  const cluster = CLUSTER_MAP[hub.key];
  if (!cluster) continue;
  hub.relatedHubs = cluster.relatedHubs;
  hub.relatedCompares = cluster.relatedCompares;
  hub.relatedInsights = cluster.relatedInsights;
  hub.hubFaq = cluster.hubFaq;
  updated++;
}

fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
console.log(`Updated ${updated} hub definitions with cluster cross-links.`);
