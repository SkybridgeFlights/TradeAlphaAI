/* js/related-content.js â€” Topical-authority & internal-linking engine
   Injects related stocks, ETFs, insights, hub links, and market-theme
   badges based on a static relationship graph. Zero backend dependency. */
(function () {
  'use strict';

  /* ===== PAGE CATALOG ===================================================
     Each entry: { t: type, n: name, k: ticker/key, l: label,
                   d: short description, f: root-relative file path }
  ====================================================================== */
  var P = {
    /* ---- Stocks ---- */
    nvda:  { t:'stock', n:'NVIDIA',           k:'NVDA', l:'AI GPU Infrastructure',
             d:'CUDA ecosystem, Blackwell architecture, AI data-center GPU demand context.',
             f:'stocks/nvda.html' },
    amd:   { t:'stock', n:'AMD',              k:'AMD',  l:'GPU & CPU Challenger',
             d:'Instinct MI300X AI GPU, EPYC data-center CPU, competitive semiconductor analysis.',
             f:'stocks/amd.html' },
    msft:  { t:'stock', n:'Microsoft',        k:'MSFT', l:'Cloud AI & Enterprise',
             d:'Azure AI, OpenAI partnership, Copilot enterprise AI subscription research.',
             f:'stocks/msft.html' },
    amzn:  { t:'stock', n:'Amazon',           k:'AMZN', l:'AWS Cloud & AI Infrastructure',
             d:'AWS Bedrock, Trainium AI chips, cloud infrastructure capex and AI services.',
             f:'stocks/amzn.html' },
    googl: { t:'stock', n:'Alphabet',         k:'GOOGL',l:'AI Search & Cloud Platform',
             d:'Google Gemini, TPU custom silicon, Google Cloud Vertex AI research.',
             f:'stocks/googl.html' },
    meta:  { t:'stock', n:'Meta Platforms',   k:'META', l:'Social AI & Open-Source LLMs',
             d:'Llama open-source AI, MTIA custom chips, AI-driven ad targeting research.',
             f:'stocks/meta.html' },
    avgo:  { t:'stock', n:'Broadcom',         k:'AVGO', l:'Networking & Custom AI Silicon',
             d:'Custom AI ASIC design, networking chips, AI data-center infrastructure exposure.',
             f:'stocks/avgo.html' },
    smci:  { t:'stock', n:'Super Micro',      k:'SMCI', l:'AI Server Infrastructure',
             d:'GPU server manufacturing, liquid cooling, AI data-center rack system assembly.',
             f:'stocks/smci.html' },
    pltr:  { t:'stock', n:'Palantir',         k:'PLTR', l:'AI Analytics Platform',
             d:'AIP enterprise AI, government and commercial AI deployment and analytics.',
             f:'stocks/pltr.html' },
    aapl:  { t:'stock', n:'Apple',            k:'AAPL', l:'Consumer AI & Silicon Design',
             d:'Apple Intelligence, M-series neural engines, on-device AI processing research.',
             f:'stocks/aapl.html' },
    tsla:  { t:'stock', n:'Tesla',            k:'TSLA', l:'Autonomous & Physical AI',
             d:'Full Self-Driving AI, Optimus robotics, GPU-driven AI inference research.',
             f:'stocks/tsla.html' },

    /* ---- ETFs ---- */
    spy:   { t:'etf', n:'SPDR S&P 500 ETF',              k:'SPY',  l:'S&P 500 Broad-Market ETF',
             d:'500-company U.S. equity diversification, 11-sector coverage, recession drawdown context.',
             f:'etfs/spy.html' },
    qqq:   { t:'etf', n:'Invesco QQQ',                   k:'QQQ',  l:'Nasdaq-100 Growth ETF',
             d:'Technology-concentrated index, heavy AI company exposure, growth vs broad-market.',
             f:'etfs/qqq.html' },
    soxx:  { t:'etf', n:'iShares Semiconductor ETF',     k:'SOXX', l:'Semiconductor Sector ETF',
             d:'Broad semiconductor sector including AI GPU designers and chip-equipment companies.',
             f:'etfs/soxx.html' },
    xlk:   { t:'etf', n:'Technology Select Sector SPDR', k:'XLK',  l:'S&P 500 Technology ETF',
             d:'S&P 500 technology sector concentration, software and semiconductor exposure.',
             f:'etfs/xlk.html' },
    vti:   { t:'etf', n:'Vanguard Total Market ETF',     k:'VTI',  l:'Total U.S. Market ETF',
             d:'Entire U.S. equity market across large, mid, and small-cap segments.',
             f:'etfs/vti.html' },
    voo:   { t:'etf', n:'Vanguard S&P 500 ETF',         k:'VOO',  l:'S&P 500 ETF (Low Cost)',
             d:'Low-cost S&P 500 index exposure, Vanguard alternative to SPY for research.',
             f:'etfs/voo.html' },
    gld:   { t:'etf', n:'SPDR Gold Shares',              k:'GLD',  l:'Gold Commodity ETF',
             d:'Physical gold-backed ETF for macro hedging and inflation-sensitivity research.',
             f:'etfs/gld.html' },
    tlt:   { t:'etf', n:'iShares 20+ Year Treasury',    k:'TLT',  l:'Long-Duration Bond ETF',
             d:'U.S. long-duration government bond exposure, interest rate sensitivity research.',
             f:'etfs/tlt.html' },
    schd:  { t:'etf', n:'Schwab US Dividend Equity',    k:'SCHD', l:'Dividend Growth ETF',
             d:'High-quality dividend-growth equity exposure, income-oriented research context.',
             f:'etfs/schd.html' },
    iwm:   { t:'etf', n:'iShares Russell 2000 ETF',     k:'IWM',  l:'Small-Cap Index ETF',
             d:'U.S. small-cap equity exposure, economic cycle sensitivity and growth research.',
             f:'etfs/iwm.html' },

    /* ---- Research Hubs ---- */
    'hub-ai-stocks':     { t:'hub', n:'AI Stocks Research Hub',   l:'AI Investing',
                           d:'AI infrastructure, semiconductor GPU demand, cloud providers, and AI software analysis.',
                           f:'ai-stocks.html' },
    'hub-semiconductor': { t:'hub', n:'Semiconductor Stocks Hub', l:'Semiconductors',
                           d:'GPU, CPU, networking, memory, and chip-equipment companies in the AI build-out.',
                           f:'semiconductor-stocks.html' },
    'hub-growth':        { t:'hub', n:'Growth Stocks Hub',        l:'Growth Equities',
                           d:'High-growth technology and AI-adjacent companies: revenue momentum and valuation.',
                           f:'growth-stocks.html' },
    'hub-dividends':     { t:'hub', n:'Dividend ETFs Hub',        l:'Dividend Income',
                           d:'High-yield and dividend-growth ETFs for income-oriented equity research.',
                           f:'dividend-etfs.html' },

    /* ---- Articles (original) ---- */
    'ins-ai-infra':   { t:'insight', n:'AI Infrastructure Demand',  l:'AI Infrastructure',
                        d:'GPU clusters, hyperscaler capex cycles, data-center power demands, and supply chain risks.',
                        f:'insights/ai-infrastructure-demand.html' },
    'ins-spy-qqq':    { t:'insight', n:'SPY vs QQQ Explained',      l:'ETF Analysis',
                        d:'S&P 500 vs Nasdaq-100: structural differences, sector composition, drawdown comparison.',
                        f:'insights/spy-vs-qqq-explained.html' },
    'ins-semi-cycle': { t:'insight', n:'Semiconductor Cycle Risks', l:'Semiconductors',
                        d:'Inventory corrections, customer concentration, capex dependencies, valuation compression.',
                        f:'insights/semiconductor-cycle-risks.html' },

    /* ---- Articles (generated) ---- */
    'ins-ai-inference':   { t:'insight', n:'AI Inference vs Training',        l:'AI Infrastructure',
                            d:'How inference and training workloads differ, and what that means for GPU and cloud demand.',
                            f:'insights/ai-inference-vs-training.html' },
    'ins-hyperscaler':    { t:'insight', n:'Hyperscaler Capex Cycles',        l:'AI Infrastructure',
                            d:'How Amazon, Microsoft, Google, and Meta drive infrastructure buildout cycles.',
                            f:'insights/hyperscaler-capex-cycles.html' },
    'ins-gpu-cpu':        { t:'insight', n:'GPU vs CPU for AI Workloads',     l:'Semiconductors',
                            d:'Why parallel GPU architecture dominates AI training and inference over traditional CPUs.',
                            f:'insights/gpu-vs-cpu-ai-workloads.html' },
    'ins-custom-chips':   { t:'insight', n:'Custom AI Chips & ASICs',         l:'Semiconductors',
                            d:'TPUs, Trainium, Inferentia â€” why hyperscalers are designing proprietary AI silicon.',
                            f:'insights/custom-ai-chips-asics-tpus.html' },
    'ins-expense-ratios': { t:'insight', n:'ETF Expense Ratios Explained',    l:'ETF Analysis',
                            d:'How fund fees compound over time and why expense ratio comparison matters for long-term returns.',
                            f:'insights/etf-expense-ratios-explained.html' },
    'ins-sector-etfs':    { t:'insight', n:'Sector ETFs vs Broad Market',     l:'ETF Analysis',
                            d:'When sector ETFs outperform and underperform versus total-market index funds.',
                            f:'insights/sector-etfs-vs-broad-market.html' },
    'ins-beta':           { t:'insight', n:'Understanding Beta in Stocks',    l:'Risk & Volatility',
                            d:'How beta measures market sensitivity and what high-beta tech stocks mean for portfolio risk.',
                            f:'insights/understanding-beta-in-stocks.html' },
    'ins-diversification':{ t:'insight', n:'Portfolio Diversification Basics',l:'Diversification',
                            d:'How spreading risk across asset classes and sectors affects long-term portfolio behavior.',
                            f:'insights/portfolio-diversification-basics.html' },
    'ins-mega-cap':       { t:'insight', n:'Mega-Cap Tech Concentration',     l:'Market Research',
                            d:'How Apple, Microsoft, NVIDIA, and Amazon dominate index weights and what that means for passive investors.',
                            f:'insights/mega-cap-tech-index-concentration.html' },
    'ins-cloud-ai':       { t:'insight', n:'Cloud Computing & AI Structure',  l:'Cloud Computing',
                            d:'How hyperscalers monetize AI workloads through IaaS, PaaS, and AI-as-a-service layers.',
                            f:'insights/cloud-computing-ai-market-structure.html' },
    'ins-rates-tech':     { t:'insight', n:'Interest Rates & Tech Stocks',    l:'Market Cycles',
                            d:'How Federal Reserve rate cycles historically correlate with high-multiple technology valuations.',
                            f:'insights/interest-rates-and-tech-stocks.html' },
    'ins-growth-value':   { t:'insight', n:'Growth vs Value Stocks',          l:'Market Research',
                            d:'Structural differences between growth and value equity factors, and when each tends to lead.',
                            f:'insights/growth-stocks-vs-value-stocks.html' }
  };

  /* ===== RELATIONSHIP GRAPH =============================================
     Keys map directly to data-rc attribute values on page containers.
     stocks / etfs / hubs / insights: ordered arrays of P keys to render.
  ====================================================================== */
  var G = {
    /* Stocks */
    nvda:  { themes:['AI GPU Computing','Semiconductors','Data Center','Blackwell Architecture'],
             stocks:['amd','avgo','smci','msft'],         etfs:['soxx','qqq','xlk'],
             hubs:['hub-ai-stocks','hub-semiconductor'],  insights:['ins-ai-inference','ins-gpu-cpu','ins-semi-cycle'] },
    amd:   { themes:['GPU Competition','AI Accelerators','CPU Compute','Semiconductors'],
             stocks:['nvda','avgo','smci','msft'],         etfs:['soxx','qqq','xlk'],
             hubs:['hub-semiconductor','hub-ai-stocks'],  insights:['ins-gpu-cpu','ins-custom-chips','ins-semi-cycle'] },
    msft:  { themes:['Cloud AI','Enterprise Software','AI Infrastructure','Mega-Cap Tech'],
             stocks:['nvda','amzn','googl','meta'],        etfs:['qqq','spy','xlk'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-hyperscaler','ins-cloud-ai','ins-mega-cap'] },
    amzn:  { themes:['Cloud AI','AWS Infrastructure','E-Commerce AI','Mega-Cap Tech'],
             stocks:['msft','googl','meta','nvda'],        etfs:['qqq','spy'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-hyperscaler','ins-cloud-ai','ins-mega-cap'] },
    googl: { themes:['AI Search','Cloud AI Platform','Custom Silicon','Mega-Cap Tech'],
             stocks:['msft','amzn','meta','nvda'],         etfs:['qqq','spy'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-hyperscaler','ins-custom-chips','ins-mega-cap'] },
    meta:  { themes:['Social AI','Open-Source LLMs','Custom Silicon','Mega-Cap Tech'],
             stocks:['googl','msft','amzn','nvda'],        etfs:['qqq','spy'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-custom-chips','ins-mega-cap','ins-ai-infra'] },
    avgo:  { themes:['Custom AI ASICs','Semiconductor Networking','Data Center','AI Silicon'],
             stocks:['nvda','amd','smci','msft'],          etfs:['soxx','qqq','xlk'],
             hubs:['hub-semiconductor','hub-ai-stocks'],  insights:['ins-custom-chips','ins-gpu-cpu','ins-semi-cycle'] },
    smci:  { themes:['AI Server Systems','GPU Infrastructure','Data Center','Liquid Cooling'],
             stocks:['nvda','avgo','amd'],                 etfs:['soxx','qqq'],
             hubs:['hub-semiconductor','hub-ai-stocks'],  insights:['ins-ai-inference','ins-hyperscaler','ins-semi-cycle'] },
    pltr:  { themes:['AI Software Platform','Enterprise Analytics','Government AI','Applications'],
             stocks:['msft','meta','googl','amzn'],        etfs:['qqq','spy'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-ai-inference','ins-beta','ins-growth-value'] },
    aapl:  { themes:['Consumer AI','Silicon Design','On-Device AI','Mega-Cap Tech'],
             stocks:['msft','googl','amzn','meta'],        etfs:['qqq','spy','xlk'],
             hubs:['hub-growth','hub-ai-stocks'],         insights:['ins-mega-cap','ins-rates-tech','ins-growth-value'] },
    tsla:  { themes:['Autonomous AI','Physical Robotics','EV Technology','Consumer Tech'],
             stocks:['nvda','aapl','googl','amzn'],        etfs:['qqq','spy'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-beta','ins-growth-value','ins-rates-tech'] },

    /* ETFs */
    spy:   { themes:['S&P 500','Broad-Market Diversification','Recession Research','11 Sectors'],
             stocks:['aapl','msft','nvda','amzn'],         etfs:['qqq','vti','voo','iwm'],
             hubs:['hub-growth','hub-dividends'],         insights:['ins-spy-qqq','ins-sector-etfs','ins-diversification'] },
    qqq:   { themes:['Nasdaq-100','Technology Concentration','Growth ETF','AI Equity Exposure'],
             stocks:['nvda','msft','aapl','amzn','meta'],  etfs:['spy','soxx','xlk','vti'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-spy-qqq','ins-mega-cap','ins-sector-etfs'] },
    soxx:  { themes:['Semiconductor Sector','AI Chips','Chip Equipment','Data Center Demand'],
             stocks:['nvda','amd','avgo','smci'],          etfs:['qqq','xlk','spy'],
             hubs:['hub-semiconductor','hub-ai-stocks'],  insights:['ins-semi-cycle','ins-gpu-cpu','ins-custom-chips'] },
    xlk:   { themes:['S&P 500 Technology','Software & Semiconductors','AI Exposure','Tech ETF'],
             stocks:['nvda','msft','aapl'],                etfs:['qqq','spy','soxx'],
             hubs:['hub-ai-stocks','hub-growth'],         insights:['ins-sector-etfs','ins-mega-cap','ins-expense-ratios'] },
    vti:   { themes:['Total U.S. Market','Broad Diversification','Small & Mid Cap','Long-Term'],
             stocks:['aapl','msft','amzn'],                etfs:['spy','voo','qqq','iwm'],
             hubs:['hub-dividends','hub-growth'],         insights:['ins-diversification','ins-expense-ratios','ins-spy-qqq'] },
    voo:   { themes:['S&P 500 Low-Cost','Vanguard Quality','Broad Market','Index Investing'],
             stocks:['aapl','msft','nvda'],                etfs:['spy','vti','qqq'],
             hubs:['hub-growth','hub-dividends'],         insights:['ins-expense-ratios','ins-diversification','ins-spy-qqq'] },
    gld:   { themes:['Gold','Macro Hedge','Inflation Research','Safe Haven Assets'],
             stocks:[],                                    etfs:['tlt','spy','vti'],
             hubs:['hub-dividends'],                      insights:['ins-rates-tech','ins-beta'] },
    tlt:   { themes:['U.S. Treasuries','Interest Rate Sensitivity','Duration Risk','Bonds'],
             stocks:[],                                    etfs:['gld','spy','vti'],
             hubs:['hub-dividends'],                      insights:['ins-rates-tech','ins-beta','ins-diversification'] },
    schd:  { themes:['Dividend Growth','Quality Equity','Income Research','Value Screening'],
             stocks:[],                                    etfs:['vti','spy','voo'],
             hubs:['hub-dividends','hub-growth'],         insights:['ins-growth-value','ins-expense-ratios','ins-diversification'] },
    iwm:   { themes:['Small-Cap Equities','Russell 2000','Economic Cycle Sensitivity','Growth'],
             stocks:[],                                    etfs:['spy','vti','qqq'],
             hubs:['hub-growth'],                         insights:['ins-beta','ins-growth-value','ins-rates-tech'] },

    /* Hubs */
    'hub-ai-stocks':     { themes:['AI Infrastructure','GPU Computing','Cloud AI','AI Applications'],
                           stocks:['nvda','amd','msft','meta','googl','amzn'], etfs:['soxx','qqq','xlk'],
                           hubs:['hub-semiconductor','hub-growth'],  insights:['ins-ai-infra','ins-ai-inference','ins-cloud-ai'] },
    'hub-semiconductor': { themes:['Semiconductors','AI Chips','GPU Design','Chip Equipment'],
                           stocks:['nvda','amd','avgo','smci'],      etfs:['soxx','qqq','xlk'],
                           hubs:['hub-ai-stocks','hub-growth'],      insights:['ins-semi-cycle','ins-gpu-cpu','ins-custom-chips'] },
    'hub-growth':        { themes:['Growth Investing','Technology','AI Equity Exposure','Revenue Momentum'],
                           stocks:['nvda','msft','amzn','googl','aapl','tsla','pltr'], etfs:['qqq','spy','xlk'],
                           hubs:['hub-ai-stocks','hub-dividends'],   insights:['ins-growth-value','ins-rates-tech','ins-mega-cap'] },
    'hub-dividends':     { themes:['Dividend Income','Yield Research','Value Investing','Stability'],
                           stocks:[],                                 etfs:['schd','vti','spy','tlt'],
                           hubs:['hub-growth'],                      insights:['ins-expense-ratios','ins-diversification','ins-growth-value'] },

    /* Insights */
    'ins-ai-infra':   { themes:['AI Infrastructure','GPU Supply Chain','Hyperscaler Capex','Data Center Power'],
                        stocks:['nvda','amd','avgo','smci','msft'],  etfs:['soxx','qqq'],
                        hubs:['hub-ai-stocks','hub-semiconductor'],  insights:['ins-ai-inference','ins-hyperscaler','ins-semi-cycle'] },
    'ins-spy-qqq':    { themes:['ETF Comparison','Index Methodology','S&P 500 vs Nasdaq-100','Portfolio Research'],
                        stocks:['nvda','msft','aapl','amzn'],        etfs:['spy','qqq','vti','soxx'],
                        hubs:['hub-growth','hub-dividends'],         insights:['ins-expense-ratios','ins-mega-cap','ins-sector-etfs'] },
    'ins-semi-cycle': { themes:['Semiconductor Cycles','Inventory Dynamics','AI Chip Risk','Valuation Research'],
                        stocks:['nvda','amd','avgo','smci'],         etfs:['soxx','qqq'],
                        hubs:['hub-semiconductor','hub-ai-stocks'],  insights:['ins-gpu-cpu','ins-custom-chips','ins-ai-infra'] }
  };

  /* ===== PATH PREFIX ====================================================
     Determines the prefix needed to reach root from the current page.
     /stocks/nvda.html â†’ 2 segments â†’ '../'
     /ai-stocks.html   â†’ 1 segment  â†’ ''
  ====================================================================== */
  function rootPfx() {
    var segs = (window.location.pathname || '').replace(/^\//, '').split('/').filter(Boolean);
    if (segs.length && /\.[a-z0-9]+$/i.test(segs[segs.length - 1])) segs.pop();
    return '../'.repeat(segs.length);
  }

  function isArabic() {
    return document.documentElement.lang === 'ar' || /^\/ar(?:\/|$)/.test(window.location.pathname || '');
  }

  function arHref(base, file) {
    return isArabic() ? base + 'ar/' + file : base + file;
  }

  function tr(s) {
    if (!isArabic()) return s;
    return String(s || '')
      .replace(/Related AI Infrastructure Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Related ETF Education/g, 'ØªØ¹Ù„ÙŠÙ… ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ù…Ø±ØªØ¨Ø·')
      .replace(/Related Articles/g, 'Ø±Ø¤Ù‰ Ø³ÙˆÙ‚ Ù…Ø±ØªØ¨Ø·Ø©')
      .replace(/Related Research Hubs/g, 'Ù…Ø­Ø§ÙˆØ± Ø¨Ø­Ø« Ù…Ø±ØªØ¨Ø·Ø©')
      .replace(/Continue with the market screener/g, 'ØªØ§Ø¨Ø¹ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚')
      .replace(/Compare these assets with the educational screener and TradeAlpha Score context\./g, 'Ù‚Ø§Ø±Ù† Ù‡Ø°Ù‡ Ø§Ù„Ø£ØµÙˆÙ„ Ø¨Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ØªØ¹Ù„ÙŠÙ…ÙŠ ÙˆØ³ÙŠØ§Ù‚ Ø¯Ø±Ø¬Ø© TradeAlpha.')
      .replace(/Screen the full AI market universe/g, 'Ø§ÙØ­Øµ Ø¹Ø§Ù„Ù… Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙƒØ§Ù…Ù„Ø§')
      .replace(/TradeAlpha Score across AI stocks and ETFs â€” educational multi-factor analysis\./g, 'Ø¯Ø±Ø¬Ø© TradeAlpha Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ø¨Ø± ØªØ­Ù„ÙŠÙ„ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ø¹ÙˆØ§Ù…Ù„.')
      .replace(/TradeAlpha Score across AI stocks and ETFs Ã¢â‚¬â€ educational multi-factor analysis\./g, 'Ø¯Ø±Ø¬Ø© TradeAlpha Ù„Ø£Ø³Ù‡Ù… ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ø¨Ø± ØªØ­Ù„ÙŠÙ„ ØªØ¹Ù„ÙŠÙ…ÙŠ Ù…ØªØ¹Ø¯Ø¯ Ø§Ù„Ø¹ÙˆØ§Ù…Ù„.')
      .replace(/Open Screener/g, 'Ø§ÙØªØ­ Ù…Ø§Ø³Ø­ Ø§Ù„Ø³ÙˆÙ‚')
      .replace(/Read article/g, 'Ø§Ù‚Ø±Ø£ Ø§Ù„Ù…Ù‚Ø§Ù„')
      .replace(/Hub/g, 'Ù…Ø­ÙˆØ±')
      .replace(/Article/g, 'Ù…Ù‚Ø§Ù„')
      .replace(/AI Infrastructure/g, 'Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Semiconductors/g, 'Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/ETF Analysis/g, 'ØªØ­Ù„ÙŠÙ„ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª')
      .replace(/Market Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø³ÙˆÙ‚')
      .replace(/Risk & Volatility/g, 'Ø§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„ØªØ°Ø¨Ø°Ø¨')
      .replace(/Diversification/g, 'Ø§Ù„ØªÙ†ÙˆÙŠØ¹')
      .replace(/Cloud Computing/g, 'Ø§Ù„Ø­ÙˆØ³Ø¨Ø© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ©')
      .replace(/Growth Equities/g, 'Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ')
      .replace(/Dividend Income/g, 'Ø¯Ø®Ù„ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª')
      .replace(/AI Investing/g, 'Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Market Cycles/g, 'Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ø³ÙˆÙ‚')
      /* Stock labels */
      .replace(/AI GPU Infrastructure/g, 'Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù€ GPU Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/GPU & CPU Challenger/g, 'Ù…Ù†Ø§ÙØ³ GPU ÙˆCPU')
      .replace(/Cloud AI & Enterprise/g, 'Ø§Ù„Ø³Ø­Ø§Ø¨Ø© ÙˆØ§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù„Ù„Ù…Ø¤Ø³Ø³Ø§Øª')
      .replace(/AWS Cloud & AI Infrastructure/g, 'AWS ÙˆØ§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/AI Search & Cloud Platform/g, 'Ø¨Ø­Ø« Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆÙ…Ù†ØµØ© Ø§Ù„Ø³Ø­Ø§Ø¨Ø©')
      .replace(/Social AI & Open-Source LLMs/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ ÙˆÙ†Ù…Ø§Ø°Ø¬ LLM')
      .replace(/Networking & Custom AI Silicon/g, 'Ø§Ù„Ø´Ø¨ÙƒØ§Øª ÙˆØ§Ù„Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ù…Ø®ØµØµØ©')
      .replace(/AI Server Infrastructure/g, 'Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ø®ÙˆØ§Ø¯Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/AI Analytics Platform/g, 'Ù…Ù†ØµØ© Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Consumer AI & Silicon Design/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø§Ø³ØªÙ‡Ù„Ø§ÙƒÙŠ ÙˆØªØµÙ…ÙŠÙ… Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚')
      .replace(/Autonomous & Physical AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ù…Ø³ØªÙ‚Ù„ ÙˆØ§Ù„Ù…Ø§Ø¯ÙŠ')
      /* ETF labels */
      .replace(/S&P 500 Broad-Market ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± S&P 500 Ø§Ù„Ø´Ø§Ù…Ù„')
      .replace(/Nasdaq-100 Growth ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Nasdaq-100 Ù„Ù„Ù†Ù…Ùˆ')
      .replace(/Semiconductor Sector ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ù‚Ø·Ø§Ø¹ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/S&P 500 Technology ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± ØªÙ‚Ù†ÙŠØ© S&P 500')
      .replace(/Total U\.S\. Market ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠ Ø§Ù„Ø´Ø§Ù…Ù„')
      .replace(/S&P 500 ETF \(Low Cost\)/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± S&P 500 (Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ©)')
      .replace(/Gold Commodity ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ø³Ù„Ø¹ Ø§Ù„Ø°Ù‡Ø¨')
      .replace(/Long-Duration Bond ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ø§Ù„Ø³Ù†Ø¯Ø§Øª Ø·ÙˆÙŠÙ„Ø© Ø§Ù„Ø£Ø¬Ù„')
      .replace(/Dividend Growth ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ù†Ù…Ùˆ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª')
      .replace(/Small-Cap Index ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø± Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø©')
      /* Theme badge translations */
      .replace(/AI GPU Computing/g, 'Ø­ÙˆØ³Ø¨Ø© GPU Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Data Center Demand/g, 'Ø·Ù„Ø¨ Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª')
      .replace(/Data Center Power/g, 'Ø·Ø§Ù‚Ø© Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª')
      .replace(/Data Center/g, 'Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª')
      .replace(/Blackwell Architecture/g, 'Ù…Ø¹Ù…Ø§Ø±ÙŠØ© Blackwell')
      .replace(/GPU Competition/g, 'Ù…Ù†Ø§ÙØ³Ø© GPU')
      .replace(/AI Accelerators/g, 'Ù…Ø¹Ø¬Ù„Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/CPU Compute/g, 'Ø­ÙˆØ³Ø¨Ø© CPU')
      .replace(/Enterprise Software/g, 'Ø¨Ø±Ù…Ø¬ÙŠØ§Øª Ø§Ù„Ù…Ø¤Ø³Ø³Ø§Øª')
      .replace(/Mega-Cap Tech/g, 'ØªÙ‚Ù†ÙŠØ© Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³ÙˆÙ‚')
      .replace(/AWS Infrastructure/g, 'Ø¨Ù†ÙŠØ© ØªØ­ØªÙŠØ© AWS')
      .replace(/E-Commerce AI/g, 'Ø§Ù„ØªØ¬Ø§Ø±Ø© Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠØ© ÙˆØ§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/AI Search/g, 'Ø¨Ø­Ø« Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Cloud AI Platform/g, 'Ù…Ù†ØµØ© Ø§Ù„Ø³Ø­Ø§Ø¨Ø© Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Custom Silicon/g, 'Ø±Ù‚Ø§Ø¦Ù‚ Ù…Ø®ØµØµØ©')
      .replace(/Social AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø§Ø¬ØªÙ…Ø§Ø¹ÙŠ')
      .replace(/Open-Source LLMs/g, 'Ù†Ù…Ø§Ø°Ø¬ LLM Ù…ÙØªÙˆØ­Ø© Ø§Ù„Ù…ØµØ¯Ø±')
      .replace(/Custom AI ASICs/g, 'ASIC Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ù…Ø®ØµØµØ©')
      .replace(/Semiconductor Networking/g, 'Ø´Ø¨ÙƒØ§Øª Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/AI Silicon/g, 'Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/AI Server Systems/g, 'Ø£Ù†Ø¸Ù…Ø© Ø®ÙˆØ§Ø¯Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/GPU Infrastructure/g, 'Ø¨Ù†ÙŠØ© GPU Ø§Ù„ØªØ­ØªÙŠØ©')
      .replace(/Liquid Cooling/g, 'Ø§Ù„ØªØ¨Ø±ÙŠØ¯ Ø§Ù„Ø³Ø§Ø¦Ù„')
      .replace(/AI Software Platform/g, 'Ù…Ù†ØµØ© Ø¨Ø±Ù…Ø¬ÙŠØ§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Enterprise Analytics/g, 'ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù…Ø¤Ø³Ø³Ø§Øª')
      .replace(/Government AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠ')
      .replace(/Consumer AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø§Ø³ØªÙ‡Ù„Ø§ÙƒÙŠ')
      .replace(/Silicon Design/g, 'ØªØµÙ…ÙŠÙ… Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚')
      .replace(/On-Device AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø¬Ù‡Ø§Ø²')
      .replace(/Autonomous AI/g, 'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ù…Ø³ØªÙ‚Ù„')
      .replace(/Physical Robotics/g, 'Ø§Ù„Ø±ÙˆØ¨ÙˆØªØ§Øª Ø§Ù„Ù…Ø§Ø¯ÙŠØ©')
      .replace(/EV Technology/g, 'ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ø³ÙŠØ§Ø±Ø§Øª Ø§Ù„ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠØ©')
      .replace(/Consumer Tech/g, 'ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ù…Ø³ØªÙ‡Ù„Ùƒ')
      .replace(/Broad-Market Diversification/g, 'ØªÙ†ÙˆÙŠØ¹ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹')
      .replace(/Recession Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø±ÙƒÙˆØ¯')
      .replace(/11 Sectors/g, '11 Ù‚Ø·Ø§Ø¹Ø§Ù‹')
      .replace(/Technology Concentration/g, 'ØªØ±ÙƒØ² Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§')
      .replace(/Growth ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ù†Ù…Ùˆ')
      .replace(/AI Equity Exposure/g, 'ØªØ¹Ø±Ø¶ Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Semiconductor Sector/g, 'Ù‚Ø·Ø§Ø¹ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/AI Chips/g, 'Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Chip Equipment/g, 'Ù…Ø¹Ø¯Ø§Øª Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚')
      .replace(/S&P 500 Technology/g, 'ØªÙ‚Ù†ÙŠØ© S&P 500')
      .replace(/Software & Semiconductors/g, 'Ø§Ù„Ø¨Ø±Ù…Ø¬ÙŠØ§Øª ÙˆØ£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/AI Exposure/g, 'ØªØ¹Ø±Ø¶ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Tech ETF/g, 'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§')
      .replace(/Total U\.S\. Market/g, 'Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠ')
      .replace(/Broad Diversification/g, 'ØªÙ†ÙˆÙŠØ¹ ÙˆØ§Ø³Ø¹')
      .replace(/Small & Mid Cap/g, 'Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø© ÙˆØ§Ù„Ù…ØªÙˆØ³Ø·Ø©')
      .replace(/Long-Term/g, 'Ø·ÙˆÙŠÙ„ Ø§Ù„Ø£Ø¬Ù„')
      .replace(/S&P 500 Low-Cost/g, 'S&P 500 Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ©')
      .replace(/Vanguard Quality/g, 'Ø¬ÙˆØ¯Ø© Vanguard')
      .replace(/Broad Market/g, 'Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹')
      .replace(/Index Investing/g, 'Ø§Ù„Ø§Ø³ØªØ«Ù…Ø§Ø± ÙÙŠ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª')
      .replace(/\bGold\b/g, 'Ø§Ù„Ø°Ù‡Ø¨')
      .replace(/Macro Hedge/g, 'ØªØ­ÙˆØ· ÙƒÙ„ÙŠ')
      .replace(/Inflation Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„ØªØ¶Ø®Ù…')
      .replace(/Safe Haven Assets/g, 'Ø£ØµÙˆÙ„ Ø§Ù„Ù…Ù„Ø§Ø° Ø§Ù„Ø¢Ù…Ù†')
      .replace(/U\.S\. Treasuries/g, 'Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ø®Ø²Ø§Ù†Ø© Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ©')
      .replace(/Interest Rate Sensitivity/g, 'Ø­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©')
      .replace(/Duration Risk/g, 'Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ø£Ù…Ø¯')
      .replace(/\bBonds\b/g, 'Ø§Ù„Ø³Ù†Ø¯Ø§Øª')
      .replace(/Dividend Growth/g, 'Ù†Ù…Ùˆ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª')
      .replace(/Quality Equity/g, 'Ø£Ø³Ù‡Ù… Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø¬ÙˆØ¯Ø©')
      .replace(/Income Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø¯Ø®Ù„')
      .replace(/Value Screening/g, 'ÙØ­Øµ Ø§Ù„Ù‚ÙŠÙ…Ø©')
      .replace(/Small-Cap Equities/g, 'Ø£Ø³Ù‡Ù… Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ØµØºÙŠØ±Ø©')
      .replace(/Russell 2000/g, 'Ù…Ø¤Ø´Ø± Russell 2000')
      .replace(/Economic Cycle Sensitivity/g, 'Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø¯ÙˆØ±Ø© Ø§Ù„Ø§Ù‚ØªØµØ§Ø¯ÙŠØ©')
      .replace(/Growth Investing/g, 'Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„Ù†Ù…Ùˆ')
      .replace(/Applications/g, 'Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª')
      .replace(/\bTechnology\b/g, 'Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§')
      .replace(/\bGrowth\b/g, 'Ø§Ù„Ù†Ù…Ùˆ')
      .replace(/GPU Computing/g, 'Ø­ÙˆØ³Ø¨Ø© GPU')
      .replace(/Cloud AI/g, 'Ø³Ø­Ø§Ø¨Ø© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/AI Applications/g, 'ØªØ·Ø¨ÙŠÙ‚Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/GPU Design/g, 'ØªØµÙ…ÙŠÙ… GPU')
      .replace(/Revenue Momentum/g, 'Ø²Ø®Ù… Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª')
      .replace(/Yield Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ø¹Ø§Ø¦Ø¯')
      .replace(/Value Investing/g, 'Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„Ù‚ÙŠÙ…Ø©')
      .replace(/Stability/g, 'Ø§Ù„Ø§Ø³ØªÙ‚Ø±Ø§Ø±')
      .replace(/GPU Supply Chain/g, 'Ø³Ù„Ø³Ù„Ø© ØªÙˆØ±ÙŠØ¯ GPU')
      .replace(/Hyperscaler Capex/g, 'Ø¥Ù†ÙØ§Ù‚ Ø±Ø£Ø³Ù…Ø§Ù„ÙŠ Ù„Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³Ø­Ø§Ø¨Ø©')
      .replace(/ETF Comparison/g, 'Ù…Ù‚Ø§Ø±Ù†Ø© ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª')
      .replace(/Index Methodology/g, 'Ù…Ù†Ù‡Ø¬ÙŠØ© Ø§Ù„Ù…Ø¤Ø´Ø±')
      .replace(/S&P 500 vs Nasdaq-100/g, 'S&P 500 Ù…Ù‚Ø§Ø¨Ù„ Nasdaq-100')
      .replace(/Portfolio Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„Ù…Ø­ÙØ¸Ø©')
      .replace(/Semiconductor Cycles/g, 'Ø¯ÙˆØ±Ø§Øª Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª')
      .replace(/Inventory Dynamics/g, 'Ø¯ÙŠÙ†Ø§Ù…ÙŠÙƒÙŠØ§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†')
      .replace(/AI Chip Risk/g, 'Ù…Ø®Ø§Ø·Ø± Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ')
      .replace(/Valuation Research/g, 'Ø£Ø¨Ø­Ø§Ø« Ø§Ù„ØªÙ‚ÙŠÙŠÙ…');
  }

  /* ===== ARABIC CONTENT LOOKUP =========================================
     Arabic descriptions and names keyed by catalog key.
     Used in deepCard() and articleCard() instead of tr(pg.d) / tr(pg.n).
  ====================================================================== */
  var AR_D = {
    nvda:  'Ù†Ø¸Ø§Ù… CUDAØŒ Ù…Ø¹Ù…Ø§Ø±ÙŠØ© BlackwellØŒ Ø³ÙŠØ§Ù‚ Ø·Ù„Ø¨ GPU Ù„Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.',
    amd:   'GPU Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Instinct MI300XØŒ Ù…Ø¹Ø§Ù„Ø¬ EPYC Ù„Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ ØªØ­Ù„ÙŠÙ„ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„ØªÙ†Ø§ÙØ³ÙŠ.',
    msft:  'Azure AIØŒ Ø´Ø±Ø§ÙƒØ© OpenAIØŒ Ø£Ø¨Ø­Ø§Ø« Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Copilot Ù„Ù„Ù…Ø¤Ø³Ø³Ø§Øª.',
    amzn:  'AWS BedrockØŒ Ø±Ù‚Ø§Ø¦Ù‚ Trainium Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠØŒ Ø§Ù„Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ø±Ø£Ø³Ù…Ø§Ù„ÙŠ Ù„Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ©.',
    googl: 'Google GeminiØŒ Ø±Ù‚Ø§Ø¦Ù‚ TPU Ø§Ù„Ù…Ø®ØµØµØ©ØŒ Ø£Ø¨Ø­Ø§Ø« Google Cloud Vertex AI.',
    meta:  'Llama Ù…ÙØªÙˆØ­ Ø§Ù„Ù…ØµØ¯Ø±ØŒ Ø±Ù‚Ø§Ø¦Ù‚ MTIA Ø§Ù„Ù…Ø®ØµØµØ©ØŒ Ø§Ø³ØªÙ‡Ø¯Ø§Ù Ø§Ù„Ø¥Ø¹Ù„Ø§Ù†Ø§Øª Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.',
    avgo:  'ØªØµÙ…ÙŠÙ… Ø±Ù‚Ø§Ø¦Ù‚ ASIC Ù…Ø®ØµØµØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠØŒ Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø´Ø¨ÙƒØ§ØªØŒ ØªØ¹Ø±Ø¶ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.',
    smci:  'ØªØµÙ†ÙŠØ¹ Ø®ÙˆØ§Ø¯Ù… GPUØŒ ØªØ¨Ø±ÙŠØ¯ Ø³Ø§Ø¦Ù„ØŒ ØªØ¬Ù…ÙŠØ¹ Ø£Ø±ÙÙ Ù…Ø±Ø§ÙƒØ² Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.',
    pltr:  'AIP Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ù…Ø¤Ø³Ø³ÙŠØŒ Ù†Ø´Ø± Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø­ÙƒÙˆÙ…ÙŠ ÙˆØ§Ù„ØªØ¬Ø§Ø±ÙŠ ÙˆØ§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª.',
    aapl:  'Apple IntelligenceØŒ Ù…Ø­Ø±ÙƒØ§Øª Ø¹ØµØ¨ÙŠØ© Ù…Ù† Ø³Ù„Ø³Ù„Ø© MØŒ Ø£Ø¨Ø­Ø§Ø« Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ù„Ù‰ Ø§Ù„Ø¬Ù‡Ø§Ø².',
    tsla:  'Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù„Ù„Ù‚ÙŠØ§Ø¯Ø© Ø§Ù„Ø°Ø§ØªÙŠØ©ØŒ Ø±ÙˆØ¨ÙˆØªØ§Øª OptimusØŒ Ø£Ø¨Ø­Ø§Ø« Ø§Ø³ØªØ¯Ù„Ø§Ù„ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¨ÙˆØ§Ø³Ø·Ø© GPU.',
    spy:   'ØªÙ†ÙˆÙŠØ¹ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ù„Ù€ 500 Ø´Ø±ÙƒØ©ØŒ ØªØºØ·ÙŠØ© 11 Ù‚Ø·Ø§Ø¹Ø§Ù‹ØŒ Ø³ÙŠØ§Ù‚ Ø§Ù„ØªØ±Ø§Ø¬Ø¹ ÙÙŠ Ø§Ù„Ø±ÙƒÙˆØ¯.',
    qqq:   'Ù…Ø¤Ø´Ø± Ù…Ø±ÙƒÙ‘Ø² Ø¹Ù„Ù‰ Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ØŒ ØªØ¹Ø±Ø¶ Ù…Ø±ØªÙØ¹ Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠØŒ Ø§Ù„Ù†Ù…Ùˆ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹.',
    soxx:  'Ù‚Ø·Ø§Ø¹ Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª Ø§Ù„ÙˆØ§Ø³Ø¹ ÙŠØ´Ù…Ù„ Ù…ØµÙ…Ù…ÙŠ GPU Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ´Ø±ÙƒØ§Øª Ù…Ø¹Ø¯Ø§Øª Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚.',
    xlk:   'ØªØ±ÙƒØ² Ù‚Ø·Ø§Ø¹ Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ ÙÙŠ S&P 500ØŒ ØªØ¹Ø±Ø¶ Ø§Ù„Ø¨Ø±Ù…Ø¬ÙŠØ§Øª ÙˆØ£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª.',
    vti:   'Ø³ÙˆÙ‚ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„ÙƒØ§Ù…Ù„ Ø¹Ø¨Ø± Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø§Ù„ÙƒØ¨ÙŠØ±Ø© ÙˆØ§Ù„Ù…ØªÙˆØ³Ø·Ø© ÙˆØ§Ù„ØµØºÙŠØ±Ø©.',
    voo:   'ØªØ¹Ø±Ø¶ Ù…Ù†Ø®ÙØ¶ Ø§Ù„ØªÙƒÙ„ÙØ© Ù„Ù…Ø¤Ø´Ø± S&P 500ØŒ Ø¨Ø¯ÙŠÙ„ Vanguard Ù„Ù€ SPY Ù„Ù„Ø¨Ø­Ø«.',
    gld:   'ØµÙ†Ø¯ÙˆÙ‚ Ù…Ø¯Ø¹ÙˆÙ… Ø¨Ø§Ù„Ø°Ù‡Ø¨ Ø§Ù„ÙØ¹Ù„ÙŠ Ù„Ù„ØªØ­ÙˆØ· Ø§Ù„ÙƒÙ„ÙŠ ÙˆØ£Ø¨Ø­Ø§Ø« Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„ØªØ¶Ø®Ù….',
    tlt:   'ØªØ¹Ø±Ø¶ Ø³Ù†Ø¯Ø§Øª Ø§Ù„Ø­ÙƒÙˆÙ…Ø© Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø·ÙˆÙŠÙ„Ø© Ø§Ù„Ø£Ø¬Ù„ØŒ Ø£Ø¨Ø­Ø§Ø« Ø­Ø³Ø§Ø³ÙŠØ© Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø©.',
    schd:  'ØªØ¹Ø±Ø¶ Ø¹Ø§Ù„ÙŠ Ø§Ù„Ø¬ÙˆØ¯Ø© Ù„Ø£Ø³Ù‡Ù… Ù†Ù…Ùˆ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§ØªØŒ Ø³ÙŠØ§Ù‚ Ø§Ù„Ø¨Ø­Ø« Ø§Ù„Ù…ÙˆØ¬Ù‡ Ù„Ù„Ø¯Ø®Ù„.',
    iwm:   'ØªØ¹Ø±Ø¶ Ø§Ù„Ø£Ø³Ù‡Ù… Ø§Ù„Ø£Ù…Ø±ÙŠÙƒÙŠØ© Ø§Ù„ØµØºÙŠØ±Ø©ØŒ Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø¯ÙˆØ±Ø© Ø§Ù„Ø§Ù‚ØªØµØ§Ø¯ÙŠØ© ÙˆØ¨Ø­Ø« Ø§Ù„Ù†Ù…Ùˆ.',
    'hub-ai-stocks':     'Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠØŒ Ø·Ù„Ø¨ GPU Ù…Ù† Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ Ù…Ø²ÙˆØ¯Ùˆ Ø§Ù„Ø³Ø­Ø§Ø¨Ø©ØŒ ÙˆØªØ­Ù„ÙŠÙ„ Ø¨Ø±Ø§Ù…Ø¬ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.',
    'hub-semiconductor': 'Ø´Ø±ÙƒØ§Øª GPU ÙˆØ§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø§Øª ÙˆØ§Ù„Ø´Ø¨ÙƒØ§Øª ÙˆØ§Ù„Ø°Ø§ÙƒØ±Ø© ÙˆÙ…Ø¹Ø¯Ø§Øª Ø§Ù„Ø±Ù‚Ø§Ø¦Ù‚ ÙÙŠ Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ.',
    'hub-growth':        'Ø´Ø±ÙƒØ§Øª Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ ÙˆØ§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ù†Ù…Ùˆ: Ø²Ø®Ù… Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª ÙˆØ§Ù„ØªÙ‚ÙŠÙŠÙ….',
    'hub-dividends':     'ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø¹Ø§Ø¦Ø¯ ÙˆÙ†Ù…Ùˆ Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª Ù„Ù„Ø¨Ø­Ø« Ø§Ù„Ù…ÙˆØ¬Ù‡ Ù„Ù„Ø¯Ø®Ù„.',
    'ins-ai-infra':      'Ø¹Ù†Ø§Ù‚ÙŠØ¯ GPUØŒ Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ø±Ø£Ø³Ù…Ø§Ù„ÙŠ Ù„Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³Ø­Ø§Ø¨Ø©ØŒ Ù…ØªØ·Ù„Ø¨Ø§Øª Ø·Ø§Ù‚Ø© Ù…Ø±Ø§ÙƒØ² Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ Ù…Ø®Ø§Ø·Ø± Ø³Ù„Ø³Ù„Ø© Ø§Ù„ØªÙˆØ±ÙŠØ¯.',
    'ins-spy-qqq':       'S&P 500 Ù…Ù‚Ø§Ø¨Ù„ Nasdaq-100: Ø§Ù„Ø§Ø®ØªÙ„Ø§ÙØ§Øª Ø§Ù„Ù‡ÙŠÙƒÙ„ÙŠØ©ØŒ ØªÙƒÙˆÙŠÙ† Ø§Ù„Ù‚Ø·Ø§Ø¹Ø§ØªØŒ Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ±Ø§Ø¬Ø¹Ø§Øª.',
    'ins-semi-cycle':    'ØªØµØ­ÙŠØ­Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†ØŒ ØªØ±ÙƒØ² Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ØŒ ØªØ¨Ø¹ÙŠØ§Øª Ø§Ù„Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ø±Ø£Ø³Ù…Ø§Ù„ÙŠØŒ Ø¶ØºØ· Ø§Ù„ØªÙ‚ÙŠÙŠÙ….',
    'ins-ai-inference':  'ÙƒÙŠÙ ØªØ®ØªÙ„Ù Ø£Ø­Ù…Ø§Ù„ Ø¹Ù…Ù„ Ø§Ù„Ø§Ø³ØªØ¯Ù„Ø§Ù„ ÙˆØ§Ù„ØªØ¯Ø±ÙŠØ¨ ÙˆÙ…Ø§ ÙŠØ¹Ù†ÙŠÙ‡ Ø°Ù„Ùƒ Ù„Ø·Ù„Ø¨ GPU ÙˆØ§Ù„Ø³Ø­Ø§Ø¨Ø©.',
    'ins-hyperscaler':   'ÙƒÙŠÙ ØªÙ‚ÙˆØ¯ Amazon ÙˆMicrosoft ÙˆGoogle ÙˆMeta Ø¯ÙˆØ±Ø§Øª Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ©.',
    'ins-gpu-cpu':       'Ù„Ù…Ø§Ø°Ø§ ØªÙ‡ÙŠÙ…Ù† Ù…Ø¹Ù…Ø§Ø±ÙŠØ© GPU Ø§Ù„Ù…ØªÙˆØ§Ø²ÙŠØ© Ø¹Ù„Ù‰ ØªØ¯Ø±ÙŠØ¨ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ§Ø³ØªØ¯Ù„Ø§Ù„Ù‡.',
    'ins-custom-chips':  'TPUs ÙˆTrainium ÙˆInferentia â€” Ù„Ù…Ø§Ø°Ø§ ØªØµÙ…Ù… Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³Ø­Ø§Ø¨Ø© Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø®Ø§ØµØ©.',
    'ins-expense-ratios':'ÙƒÙŠÙ ØªØªØ±Ø§ÙƒÙ… Ø±Ø³ÙˆÙ… Ø§Ù„ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¹ Ø§Ù„ÙˆÙ‚Øª ÙˆÙ„Ù…Ø§Ø°Ø§ ØªÙ‡Ù… Ù…Ù‚Ø§Ø±Ù†Ø© Ù†Ø³Ø¨Ø© Ø§Ù„Ù…ØµØ§Ø±ÙŠÙ.',
    'ins-sector-etfs':   'Ù…ØªÙ‰ ØªØªÙÙˆÙ‚ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù‚Ø·Ø§Ø¹Ø§Øª ÙˆØªØªØ£Ø®Ø± Ù…Ù‚Ø§Ø±Ù†Ø© Ø¨ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„Ø´Ø§Ù…Ù„Ø©.',
    'ins-beta':          'ÙƒÙŠÙ ÙŠÙ‚ÙŠØ³ Ù…Ø¹Ø§Ù…Ù„ Ø¨ÙŠØªØ§ Ø­Ø³Ø§Ø³ÙŠØ© Ø§Ù„Ø³ÙˆÙ‚ ÙˆÙ…Ø§ ØªØ¹Ù†ÙŠÙ‡ Ø£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ø¨ÙŠØªØ§.',
    'ins-diversification':'ÙƒÙŠÙ ÙŠØ¤Ø«Ø± ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø¹Ø¨Ø± ÙØ¦Ø§Øª Ø§Ù„Ø£ØµÙˆÙ„ ÙˆØ§Ù„Ù‚Ø·Ø§Ø¹Ø§Øª Ø¹Ù„Ù‰ Ø³Ù„ÙˆÙƒ Ø§Ù„Ù…Ø­ÙØ¸Ø©.',
    'ins-mega-cap':      'ÙƒÙŠÙ ØªÙ‡ÙŠÙ…Ù† Apple ÙˆMicrosoft ÙˆNVIDIA ÙˆAmazon Ø¹Ù„Ù‰ Ø£ÙˆØ²Ø§Ù† Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª.',
    'ins-cloud-ai':      'ÙƒÙŠÙ ØªØ¬Ù†ÙŠ Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³Ø­Ø§Ø¨Ø© Ù…Ù† Ø£Ø­Ù…Ø§Ù„ Ø¹Ù…Ù„ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ø¨Ø± Ø·Ø¨Ù‚Ø§Øª IaaS ÙˆPaaS.',
    'ins-rates-tech':    'ÙƒÙŠÙ ØªØ±ØªØ¨Ø· Ø¯ÙˆØ±Ø§Øª Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© ØªØ§Ø±ÙŠØ®ÙŠØ§Ù‹ Ø¨ØªÙ‚ÙŠÙŠÙ…Ø§Øª Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ù…Ø¶Ø§Ø¹ÙØ§Øª.',
    'ins-growth-value':  'Ø§Ù„Ø§Ø®ØªÙ„Ø§ÙØ§Øª Ø§Ù„Ù‡ÙŠÙƒÙ„ÙŠØ© Ø¨ÙŠÙ† Ø¹ÙˆØ§Ù…Ù„ Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ ÙˆØ§Ù„Ù‚ÙŠÙ…Ø©ØŒ ÙˆÙ…ØªÙ‰ ÙŠÙ…ÙŠÙ„ ÙƒÙ„ Ù…Ù†Ù‡Ù…Ø§ Ù„Ù„ØªØµØ¯Ø±.'
  };

  var AR_N = {
    'hub-ai-stocks':     'Ù…Ø­ÙˆØ± Ø£Ø¨Ø­Ø§Ø« Ø£Ø³Ù‡Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ',
    'hub-semiconductor': 'Ù…Ø­ÙˆØ± Ø£Ø³Ù‡Ù… Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª',
    'hub-growth':        'Ù…Ø­ÙˆØ± Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ',
    'hub-dividends':     'Ù…Ø­ÙˆØ± ØµÙ†Ø§Ø¯ÙŠÙ‚ Ù…Ø¤Ø´Ø±Ø§Øª Ø§Ù„ØªÙˆØ²ÙŠØ¹Ø§Øª',
    'ins-ai-infra':      'Ø·Ù„Ø¨ Ø§Ù„Ø¨Ù†ÙŠØ© Ø§Ù„ØªØ­ØªÙŠØ© Ù„Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ',
    'ins-spy-qqq':       'Ø´Ø±Ø­ Ù…Ù‚Ø§Ø±Ù†Ø© SPY ÙˆQQQ',
    'ins-semi-cycle':    'Ù…Ø®Ø§Ø·Ø± Ø¯ÙˆØ±Ø© Ø£Ø´Ø¨Ø§Ù‡ Ø§Ù„Ù…ÙˆØµÙ„Ø§Øª',
    'ins-ai-inference':  'Ø§Ù„Ø§Ø³ØªØ¯Ù„Ø§Ù„ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„ØªØ¯Ø±ÙŠØ¨ ÙÙŠ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ',
    'ins-hyperscaler':   'Ø¯ÙˆØ±Ø§Øª Ø§Ù„Ø¥Ù†ÙØ§Ù‚ Ø§Ù„Ø±Ø£Ø³Ù…Ø§Ù„ÙŠ Ù„Ø¹Ù…Ù„Ø§Ù‚Ø© Ø§Ù„Ø³Ø­Ø§Ø¨Ø©',
    'ins-gpu-cpu':       'GPU Ù…Ù‚Ø§Ø¨Ù„ CPU Ù„Ø£Ø­Ù…Ø§Ù„ Ø¹Ù…Ù„ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ',
    'ins-custom-chips':  'Ø±Ù‚Ø§Ø¦Ù‚ Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ù…Ø®ØµØµØ© ÙˆASICs',
    'ins-expense-ratios':'Ø´Ø±Ø­ Ù†Ø³Ø¨ Ù…ØµØ§Ø±ÙŠÙ ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª',
    'ins-sector-etfs':   'ØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„Ù‚Ø·Ø§Ø¹Ø§Øª Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ø³ÙˆÙ‚ Ø§Ù„ÙˆØ§Ø³Ø¹',
    'ins-beta':          'ÙÙ‡Ù… Ù…Ø¹Ø§Ù…Ù„ Ø¨ÙŠØªØ§ ÙÙŠ Ø§Ù„Ø£Ø³Ù‡Ù…',
    'ins-diversification':'Ø£Ø³Ø§Ø³ÙŠØ§Øª ØªÙ†ÙˆÙŠØ¹ Ø§Ù„Ù…Ø­ÙØ¸Ø©',
    'ins-mega-cap':      'ØªØ±ÙƒØ² Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§ Ø§Ù„Ø¹Ù…Ù„Ø§Ù‚Ø© ÙÙŠ Ø§Ù„Ù…Ø¤Ø´Ø±Ø§Øª',
    'ins-cloud-ai':      'Ø§Ù„Ø­ÙˆØ³Ø¨Ø© Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ© ÙˆØ¨Ù†ÙŠØ© Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ',
    'ins-rates-tech':    'Ø£Ø³Ø¹Ø§Ø± Ø§Ù„ÙØ§Ø¦Ø¯Ø© ÙˆØ£Ø³Ù‡Ù… Ø§Ù„ØªÙƒÙ†ÙˆÙ„ÙˆØ¬ÙŠØ§',
    'ins-growth-value':  'Ø£Ø³Ù‡Ù… Ø§Ù„Ù†Ù…Ùˆ Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù‚ÙŠÙ…Ø©'
  };

  /* ===== HTML HELPERS =================================================== */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function deepCard(key, base) {
    var pg = P[key]; if (!pg) return '';
    var ar = isArabic();
    var badge = (pg.t === 'stock' || pg.t === 'etf') ? pg.k : (pg.t === 'hub' ? (ar ? 'Ù…Ø­ÙˆØ±' : 'Hub') : (ar ? 'Ù…Ù‚Ø§Ù„' : 'Article'));
    var nameStr = ar
      ? (AR_N[key] || (badge && badge !== pg.n ? pg.n + ' â€” ' + badge : pg.n))
      : (badge && badge !== pg.n ? pg.n + ' â€” ' + badge : pg.n);
    nameStr = nameStr.replace('Ã¢â‚¬â€', '-');
    var desc = ar ? (AR_D[key] || pg.d) : pg.d;
    return '<a class=â€deep-link-cardâ€ href=â€' + esc(arHref(base, pg.f)) + 'â€>'
         + '<span>' + esc(tr(pg.l)) + '</span>'
         + '<strong>' + esc(nameStr) + '</strong>'
         + '<p>' + esc(desc) + '</p>'
         + '</a>';
  }

  function articleCard(key, base) {
    var pg = P[key]; if (!pg) return '';
    var ar = isArabic();
    var name = ar ? (AR_N[key] || pg.n) : pg.n;
    var desc = ar ? (AR_D[key] || pg.d) : pg.d;
    return '<a class=â€insight-cardâ€ href=â€' + esc(arHref(base, pg.f)) + 'â€>'
         + '<div class=â€insight-card-metaâ€>'
         + '<span class=â€insight-category-badgeâ€ style=â€margin:0â€>' + esc(tr(pg.l)) + '</span>'
         + '</div>'
         + '<h3>' + esc(name) + '</h3>'
         + '<p>' + esc(desc) + '</p>'
         + '<span class=â€insight-card-ctaâ€>' + esc(tr('Read article')) + ' &rarr;</span>'
         + '</a>';
  }

  /* ===== RENDERER ======================================================= */
  function render(rcKey, el) {
    var rel = G[rcKey]; if (!rel) return;
    var base = rootPfx();
    var out = '';

    /* Market theme badges */
    if (rel.themes && rel.themes.length) {
      out += '<div class="rc-themes">';
      rel.themes.forEach(function (t) {
        out += '<span class="insight-category-badge">' + esc(tr(t)) + '</span>';
      });
      out += '</div>';
    }

    /* Related stocks */
    var stocks = (rel.stocks || []).filter(function (k) { return P[k]; });
    if (stocks.length) {
      out += '<div class="rc-group">'
           + '<h3 class="rc-sub-heading">' + esc(tr('Related AI Infrastructure Research')) + '</h3>'
           + '<div class="market-grid">';
      stocks.forEach(function (k) { out += deepCard(k, base); });
      out += '</div></div>';
    }

    /* Related ETFs */
    var etfs = (rel.etfs || []).filter(function (k) { return P[k]; });
    if (etfs.length) {
      out += '<div class="rc-group">'
           + '<h3 class="rc-sub-heading">' + esc(tr('Related ETF Education')) + '</h3>'
           + '<div class="market-grid">';
      etfs.forEach(function (k) { out += deepCard(k, base); });
      out += '</div></div>';
    }

    /* Articles articles */
    var insights = (rel.insights || []).filter(function (k) { return P[k]; });
    if (insights.length) {
      out += '<div class="rc-group">'
           + '<h3 class="rc-sub-heading">' + esc(tr('Related Articles')) + '</h3>'
           + '<div class="insight-grid">';
      insights.forEach(function (k) { out += articleCard(k, base); });
      out += '</div></div>';
    }

    /* Research hubs */
    var hubs = (rel.hubs || []).filter(function (k) { return P[k]; });
    if (hubs.length) {
      out += '<div class="rc-group">'
           + '<h3 class="rc-sub-heading">' + esc(tr('Related Research Hubs')) + '</h3>'
           + '<div class="market-grid" style="grid-template-columns:repeat(2,minmax(0,1fr))">';
      hubs.forEach(function (k) { out += deepCard(k, base); });
      out += '</div></div>';
    }

    /* Screener CTA */
    out += '<div class="rc-screener-cta">'
         + '<div>'
         + '<p class="rc-screener-title">' + esc(tr('Screen the full AI market universe')) + '</p>'
         + '<p class="rc-screener-sub">' + esc(tr('TradeAlpha Score across AI stocks and ETFs â€” educational multi-factor analysis.')) + '</p>'
         + '</div>'
         + '<a class="market-btn primary" href="' + esc(arHref(base, 'ai-stock-screener.html')) + '">' + esc(tr('Open Screener')) + ' &rarr;</a>'
         + '</div>';

    el.innerHTML = out;
  }

  /* ===== AUTO-INIT ====================================================== */
  function init() {
    var el = document.querySelector('[data-rc]');
    if (!el) return;
    render(el.getAttribute('data-rc'), el);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

