/* js/related-content.js — Topical-authority & internal-linking engine
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

    /* ---- Market Insights (original) ---- */
    'ins-ai-infra':   { t:'insight', n:'AI Infrastructure Demand',  l:'AI Infrastructure',
                        d:'GPU clusters, hyperscaler capex cycles, data-center power demands, and supply chain risks.',
                        f:'insights/ai-infrastructure-demand.html' },
    'ins-spy-qqq':    { t:'insight', n:'SPY vs QQQ Explained',      l:'ETF Analysis',
                        d:'S&P 500 vs Nasdaq-100: structural differences, sector composition, drawdown comparison.',
                        f:'insights/spy-vs-qqq-explained.html' },
    'ins-semi-cycle': { t:'insight', n:'Semiconductor Cycle Risks', l:'Semiconductors',
                        d:'Inventory corrections, customer concentration, capex dependencies, valuation compression.',
                        f:'insights/semiconductor-cycle-risks.html' },

    /* ---- Market Insights (generated) ---- */
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
                            d:'TPUs, Trainium, Inferentia — why hyperscalers are designing proprietary AI silicon.',
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
     /stocks/nvda.html → 2 segments → '../'
     /ai-stocks.html   → 1 segment  → ''
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
      .replace(/Related AI Infrastructure Research/g, 'أبحاث مرتبطة بالبنية التحتية للذكاء الاصطناعي')
      .replace(/Related ETF Education/g, 'تعليم صناديق المؤشرات المرتبط')
      .replace(/Related Market Insights/g, 'رؤى سوق مرتبطة')
      .replace(/Related Research Hubs/g, 'محاور بحث مرتبطة')
      .replace(/Continue with the market screener/g, 'تابع باستخدام ماسح السوق')
      .replace(/Compare these assets with the educational screener and TradeAlpha Score context\./g, 'قارن هذه الأصول باستخدام ماسح السوق التعليمي وسياق درجة TradeAlpha.')
      .replace(/Screen the full AI market universe/g, 'افحص عالم أسهم وصناديق الذكاء الاصطناعي كاملا')
      .replace(/TradeAlpha Score across AI stocks and ETFs — educational multi-factor analysis\./g, 'درجة TradeAlpha لأسهم وصناديق الذكاء الاصطناعي عبر تحليل تعليمي متعدد العوامل.')
      .replace(/TradeAlpha Score across AI stocks and ETFs â€” educational multi-factor analysis\./g, 'درجة TradeAlpha لأسهم وصناديق الذكاء الاصطناعي عبر تحليل تعليمي متعدد العوامل.')
      .replace(/Open Screener/g, 'افتح ماسح السوق')
      .replace(/Read article/g, 'اقرأ المقال')
      .replace(/Hub/g, 'محور')
      .replace(/Article/g, 'مقال')
      .replace(/AI Infrastructure/g, 'البنية التحتية للذكاء الاصطناعي')
      .replace(/Semiconductors/g, 'أشباه الموصلات')
      .replace(/ETF Analysis/g, 'تحليل صناديق المؤشرات')
      .replace(/Market Research/g, 'أبحاث السوق')
      .replace(/Risk & Volatility/g, 'المخاطر والتذبذب')
      .replace(/Diversification/g, 'التنويع')
      .replace(/Cloud Computing/g, 'الحوسبة السحابية')
      .replace(/Growth Equities/g, 'أسهم النمو')
      .replace(/Dividend Income/g, 'دخل التوزيعات')
      .replace(/AI Investing/g, 'استثمار الذكاء الاصطناعي')
      .replace(/Market Cycles/g, 'دورات السوق')
      /* Stock labels */
      .replace(/AI GPU Infrastructure/g, 'البنية التحتية لـ GPU الذكاء الاصطناعي')
      .replace(/GPU & CPU Challenger/g, 'منافس GPU وCPU')
      .replace(/Cloud AI & Enterprise/g, 'السحابة والذكاء الاصطناعي للمؤسسات')
      .replace(/AWS Cloud & AI Infrastructure/g, 'AWS والبنية التحتية للذكاء الاصطناعي')
      .replace(/AI Search & Cloud Platform/g, 'بحث الذكاء الاصطناعي ومنصة السحابة')
      .replace(/Social AI & Open-Source LLMs/g, 'الذكاء الاصطناعي الاجتماعي ونماذج LLM')
      .replace(/Networking & Custom AI Silicon/g, 'الشبكات والرقائق المخصصة')
      .replace(/AI Server Infrastructure/g, 'البنية التحتية لخوادم الذكاء الاصطناعي')
      .replace(/AI Analytics Platform/g, 'منصة التحليلات بالذكاء الاصطناعي')
      .replace(/Consumer AI & Silicon Design/g, 'الذكاء الاصطناعي الاستهلاكي وتصميم الرقائق')
      .replace(/Autonomous & Physical AI/g, 'الذكاء الاصطناعي المستقل والمادي')
      /* ETF labels */
      .replace(/S&P 500 Broad-Market ETF/g, 'صندوق مؤشر S&P 500 الشامل')
      .replace(/Nasdaq-100 Growth ETF/g, 'صندوق مؤشر Nasdaq-100 للنمو')
      .replace(/Semiconductor Sector ETF/g, 'صندوق مؤشر قطاع أشباه الموصلات')
      .replace(/S&P 500 Technology ETF/g, 'صندوق مؤشر تقنية S&P 500')
      .replace(/Total U\.S\. Market ETF/g, 'صندوق مؤشر السوق الأمريكي الشامل')
      .replace(/S&P 500 ETF \(Low Cost\)/g, 'صندوق مؤشر S&P 500 (منخفض التكلفة)')
      .replace(/Gold Commodity ETF/g, 'صندوق مؤشر سلع الذهب')
      .replace(/Long-Duration Bond ETF/g, 'صندوق مؤشر السندات طويلة الأجل')
      .replace(/Dividend Growth ETF/g, 'صندوق مؤشر نمو التوزيعات')
      .replace(/Small-Cap Index ETF/g, 'صندوق مؤشر الشركات الصغيرة')
      /* Theme badge translations */
      .replace(/AI GPU Computing/g, 'حوسبة GPU للذكاء الاصطناعي')
      .replace(/Data Center Demand/g, 'طلب مراكز البيانات')
      .replace(/Data Center Power/g, 'طاقة مراكز البيانات')
      .replace(/Data Center/g, 'مراكز البيانات')
      .replace(/Blackwell Architecture/g, 'معمارية Blackwell')
      .replace(/GPU Competition/g, 'منافسة GPU')
      .replace(/AI Accelerators/g, 'معجلات الذكاء الاصطناعي')
      .replace(/CPU Compute/g, 'حوسبة CPU')
      .replace(/Enterprise Software/g, 'برمجيات المؤسسات')
      .replace(/Mega-Cap Tech/g, 'تقنية عملاقة السوق')
      .replace(/AWS Infrastructure/g, 'بنية تحتية AWS')
      .replace(/E-Commerce AI/g, 'التجارة الإلكترونية والذكاء الاصطناعي')
      .replace(/AI Search/g, 'بحث الذكاء الاصطناعي')
      .replace(/Cloud AI Platform/g, 'منصة السحابة بالذكاء الاصطناعي')
      .replace(/Custom Silicon/g, 'رقائق مخصصة')
      .replace(/Social AI/g, 'الذكاء الاصطناعي الاجتماعي')
      .replace(/Open-Source LLMs/g, 'نماذج LLM مفتوحة المصدر')
      .replace(/Custom AI ASICs/g, 'ASIC الذكاء الاصطناعي المخصصة')
      .replace(/Semiconductor Networking/g, 'شبكات أشباه الموصلات')
      .replace(/AI Silicon/g, 'رقائق الذكاء الاصطناعي')
      .replace(/AI Server Systems/g, 'أنظمة خوادم الذكاء الاصطناعي')
      .replace(/GPU Infrastructure/g, 'بنية GPU التحتية')
      .replace(/Liquid Cooling/g, 'التبريد السائل')
      .replace(/AI Software Platform/g, 'منصة برمجيات الذكاء الاصطناعي')
      .replace(/Enterprise Analytics/g, 'تحليلات المؤسسات')
      .replace(/Government AI/g, 'الذكاء الاصطناعي الحكومي')
      .replace(/Consumer AI/g, 'الذكاء الاصطناعي الاستهلاكي')
      .replace(/Silicon Design/g, 'تصميم الرقائق')
      .replace(/On-Device AI/g, 'الذكاء الاصطناعي على الجهاز')
      .replace(/Autonomous AI/g, 'الذكاء الاصطناعي المستقل')
      .replace(/Physical Robotics/g, 'الروبوتات المادية')
      .replace(/EV Technology/g, 'تكنولوجيا السيارات الكهربائية')
      .replace(/Consumer Tech/g, 'تكنولوجيا المستهلك')
      .replace(/Broad-Market Diversification/g, 'تنويع السوق الواسع')
      .replace(/Recession Research/g, 'أبحاث الركود')
      .replace(/11 Sectors/g, '11 قطاعاً')
      .replace(/Technology Concentration/g, 'تركز التكنولوجيا')
      .replace(/Growth ETF/g, 'صندوق مؤشرات النمو')
      .replace(/AI Equity Exposure/g, 'تعرض أسهم الذكاء الاصطناعي')
      .replace(/Semiconductor Sector/g, 'قطاع أشباه الموصلات')
      .replace(/AI Chips/g, 'رقائق الذكاء الاصطناعي')
      .replace(/Chip Equipment/g, 'معدات الرقائق')
      .replace(/S&P 500 Technology/g, 'تقنية S&P 500')
      .replace(/Software & Semiconductors/g, 'البرمجيات وأشباه الموصلات')
      .replace(/AI Exposure/g, 'تعرض الذكاء الاصطناعي')
      .replace(/Tech ETF/g, 'صندوق مؤشرات التكنولوجيا')
      .replace(/Total U\.S\. Market/g, 'إجمالي السوق الأمريكي')
      .replace(/Broad Diversification/g, 'تنويع واسع')
      .replace(/Small & Mid Cap/g, 'الشركات الصغيرة والمتوسطة')
      .replace(/Long-Term/g, 'طويل الأجل')
      .replace(/S&P 500 Low-Cost/g, 'S&P 500 منخفض التكلفة')
      .replace(/Vanguard Quality/g, 'جودة Vanguard')
      .replace(/Broad Market/g, 'السوق الواسع')
      .replace(/Index Investing/g, 'الاستثمار في المؤشرات')
      .replace(/\bGold\b/g, 'الذهب')
      .replace(/Macro Hedge/g, 'تحوط كلي')
      .replace(/Inflation Research/g, 'أبحاث التضخم')
      .replace(/Safe Haven Assets/g, 'أصول الملاذ الآمن')
      .replace(/U\.S\. Treasuries/g, 'سندات الخزانة الأمريكية')
      .replace(/Interest Rate Sensitivity/g, 'حساسية أسعار الفائدة')
      .replace(/Duration Risk/g, 'مخاطر الأمد')
      .replace(/\bBonds\b/g, 'السندات')
      .replace(/Dividend Growth/g, 'نمو التوزيعات')
      .replace(/Quality Equity/g, 'أسهم عالية الجودة')
      .replace(/Income Research/g, 'أبحاث الدخل')
      .replace(/Value Screening/g, 'فحص القيمة')
      .replace(/Small-Cap Equities/g, 'أسهم الشركات الصغيرة')
      .replace(/Russell 2000/g, 'مؤشر Russell 2000')
      .replace(/Economic Cycle Sensitivity/g, 'حساسية الدورة الاقتصادية')
      .replace(/Growth Investing/g, 'استثمار النمو')
      .replace(/Applications/g, 'التطبيقات')
      .replace(/\bTechnology\b/g, 'التكنولوجيا')
      .replace(/\bGrowth\b/g, 'النمو')
      .replace(/GPU Computing/g, 'حوسبة GPU')
      .replace(/Cloud AI/g, 'سحابة الذكاء الاصطناعي')
      .replace(/AI Applications/g, 'تطبيقات الذكاء الاصطناعي')
      .replace(/GPU Design/g, 'تصميم GPU')
      .replace(/Revenue Momentum/g, 'زخم الإيرادات')
      .replace(/Yield Research/g, 'أبحاث العائد')
      .replace(/Value Investing/g, 'استثمار القيمة')
      .replace(/Stability/g, 'الاستقرار')
      .replace(/GPU Supply Chain/g, 'سلسلة توريد GPU')
      .replace(/Hyperscaler Capex/g, 'إنفاق رأسمالي لعملاقة السحابة')
      .replace(/ETF Comparison/g, 'مقارنة صناديق المؤشرات')
      .replace(/Index Methodology/g, 'منهجية المؤشر')
      .replace(/S&P 500 vs Nasdaq-100/g, 'S&P 500 مقابل Nasdaq-100')
      .replace(/Portfolio Research/g, 'أبحاث المحفظة')
      .replace(/Semiconductor Cycles/g, 'دورات أشباه الموصلات')
      .replace(/Inventory Dynamics/g, 'ديناميكيات المخزون')
      .replace(/AI Chip Risk/g, 'مخاطر رقائق الذكاء الاصطناعي')
      .replace(/Valuation Research/g, 'أبحاث التقييم');
  }

  /* ===== ARABIC CONTENT LOOKUP =========================================
     Arabic descriptions and names keyed by catalog key.
     Used in deepCard() and articleCard() instead of tr(pg.d) / tr(pg.n).
  ====================================================================== */
  var AR_D = {
    nvda:  'نظام CUDA، معمارية Blackwell، سياق طلب GPU لمراكز البيانات بالذكاء الاصطناعي.',
    amd:   'GPU للذكاء الاصطناعي Instinct MI300X، معالج EPYC لمراكز البيانات، تحليل أشباه الموصلات التنافسي.',
    msft:  'Azure AI، شراكة OpenAI، أبحاث اشتراكات Copilot للمؤسسات.',
    amzn:  'AWS Bedrock، رقائق Trainium للذكاء الاصطناعي، الإنفاق الرأسمالي للبنية التحتية السحابية.',
    googl: 'Google Gemini، رقائق TPU المخصصة، أبحاث Google Cloud Vertex AI.',
    meta:  'Llama مفتوح المصدر، رقائق MTIA المخصصة، استهداف الإعلانات بالذكاء الاصطناعي.',
    avgo:  'تصميم رقائق ASIC مخصصة للذكاء الاصطناعي، رقائق الشبكات، تعرض البنية التحتية لمراكز البيانات.',
    smci:  'تصنيع خوادم GPU، تبريد سائل، تجميع أرفف مراكز بيانات الذكاء الاصطناعي.',
    pltr:  'AIP للذكاء الاصطناعي المؤسسي، نشر الذكاء الاصطناعي الحكومي والتجاري والتحليلات.',
    aapl:  'Apple Intelligence، محركات عصبية من سلسلة M، أبحاث معالجة الذكاء الاصطناعي على الجهاز.',
    tsla:  'الذكاء الاصطناعي للقيادة الذاتية، روبوتات Optimus، أبحاث استدلال الذكاء الاصطناعي بواسطة GPU.',
    spy:   'تنويع الأسهم الأمريكية لـ 500 شركة، تغطية 11 قطاعاً، سياق التراجع في الركود.',
    qqq:   'مؤشر مركّز على التكنولوجيا، تعرض مرتفع لشركات الذكاء الاصطناعي، النمو مقابل السوق الواسع.',
    soxx:  'قطاع أشباه الموصلات الواسع يشمل مصممي GPU للذكاء الاصطناعي وشركات معدات الرقائق.',
    xlk:   'تركز قطاع التكنولوجيا في S&P 500، تعرض البرمجيات وأشباه الموصلات.',
    vti:   'سوق الأسهم الأمريكية الكامل عبر الشركات الكبيرة والمتوسطة والصغيرة.',
    voo:   'تعرض منخفض التكلفة لمؤشر S&P 500، بديل Vanguard لـ SPY للبحث.',
    gld:   'صندوق مدعوم بالذهب الفعلي للتحوط الكلي وأبحاث حساسية التضخم.',
    tlt:   'تعرض سندات الحكومة الأمريكية طويلة الأجل، أبحاث حساسية أسعار الفائدة.',
    schd:  'تعرض عالي الجودة لأسهم نمو التوزيعات، سياق البحث الموجه للدخل.',
    iwm:   'تعرض الأسهم الأمريكية الصغيرة، حساسية الدورة الاقتصادية وبحث النمو.',
    'hub-ai-stocks':     'البنية التحتية للذكاء الاصطناعي، طلب GPU من مراكز البيانات، مزودو السحابة، وتحليل برامج الذكاء الاصطناعي.',
    'hub-semiconductor': 'شركات GPU والمعالجات والشبكات والذاكرة ومعدات الرقائق في بناء الذكاء الاصطناعي.',
    'hub-growth':        'شركات التكنولوجيا والذكاء الاصطناعي عالية النمو: زخم الإيرادات والتقييم.',
    'hub-dividends':     'صناديق التوزيعات عالية العائد ونمو التوزيعات للبحث الموجه للدخل.',
    'ins-ai-infra':      'عناقيد GPU، دورات الإنفاق الرأسمالي لعملاقة السحابة، متطلبات طاقة مراكز البيانات، مخاطر سلسلة التوريد.',
    'ins-spy-qqq':       'S&P 500 مقابل Nasdaq-100: الاختلافات الهيكلية، تكوين القطاعات، مقارنة التراجعات.',
    'ins-semi-cycle':    'تصحيحات المخزون، تركز العملاء، تبعيات الإنفاق الرأسمالي، ضغط التقييم.',
    'ins-ai-inference':  'كيف تختلف أحمال عمل الاستدلال والتدريب وما يعنيه ذلك لطلب GPU والسحابة.',
    'ins-hyperscaler':   'كيف تقود Amazon وMicrosoft وGoogle وMeta دورات بناء البنية التحتية.',
    'ins-gpu-cpu':       'لماذا تهيمن معمارية GPU المتوازية على تدريب الذكاء الاصطناعي واستدلاله.',
    'ins-custom-chips':  'TPUs وTrainium وInferentia — لماذا تصمم عملاقة السحابة رقائق الذكاء الاصطناعي الخاصة.',
    'ins-expense-ratios':'كيف تتراكم رسوم الصناديق مع الوقت ولماذا تهم مقارنة نسبة المصاريف.',
    'ins-sector-etfs':   'متى تتفوق صناديق القطاعات وتتأخر مقارنة بصناديق المؤشرات الشاملة.',
    'ins-beta':          'كيف يقيس معامل بيتا حساسية السوق وما تعنيه أسهم التكنولوجيا عالية البيتا.',
    'ins-diversification':'كيف يؤثر توزيع المخاطر عبر فئات الأصول والقطاعات على سلوك المحفظة.',
    'ins-mega-cap':      'كيف تهيمن Apple وMicrosoft وNVIDIA وAmazon على أوزان المؤشرات.',
    'ins-cloud-ai':      'كيف تجني عملاقة السحابة من أحمال عمل الذكاء الاصطناعي عبر طبقات IaaS وPaaS.',
    'ins-rates-tech':    'كيف ترتبط دورات أسعار الفائدة تاريخياً بتقييمات التكنولوجيا العالية المضاعفات.',
    'ins-growth-value':  'الاختلافات الهيكلية بين عوامل أسهم النمو والقيمة، ومتى يميل كل منهما للتصدر.'
  };

  var AR_N = {
    'hub-ai-stocks':     'محور أبحاث أسهم الذكاء الاصطناعي',
    'hub-semiconductor': 'محور أسهم أشباه الموصلات',
    'hub-growth':        'محور أسهم النمو',
    'hub-dividends':     'محور صناديق مؤشرات التوزيعات',
    'ins-ai-infra':      'طلب البنية التحتية للذكاء الاصطناعي',
    'ins-spy-qqq':       'شرح مقارنة SPY وQQQ',
    'ins-semi-cycle':    'مخاطر دورة أشباه الموصلات',
    'ins-ai-inference':  'الاستدلال مقابل التدريب في الذكاء الاصطناعي',
    'ins-hyperscaler':   'دورات الإنفاق الرأسمالي لعملاقة السحابة',
    'ins-gpu-cpu':       'GPU مقابل CPU لأحمال عمل الذكاء الاصطناعي',
    'ins-custom-chips':  'رقائق الذكاء الاصطناعي المخصصة وASICs',
    'ins-expense-ratios':'شرح نسب مصاريف صناديق المؤشرات',
    'ins-sector-etfs':   'صناديق القطاعات مقابل السوق الواسع',
    'ins-beta':          'فهم معامل بيتا في الأسهم',
    'ins-diversification':'أساسيات تنويع المحفظة',
    'ins-mega-cap':      'تركز التكنولوجيا العملاقة في المؤشرات',
    'ins-cloud-ai':      'الحوسبة السحابية وبنية الذكاء الاصطناعي',
    'ins-rates-tech':    'أسعار الفائدة وأسهم التكنولوجيا',
    'ins-growth-value':  'أسهم النمو مقابل القيمة'
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
    var badge = (pg.t === 'stock' || pg.t === 'etf') ? pg.k : (pg.t === 'hub' ? (ar ? 'محور' : 'Hub') : (ar ? 'مقال' : 'Article'));
    var nameStr = ar
      ? (AR_N[key] || (badge && badge !== pg.n ? pg.n + ' — ' + badge : pg.n))
      : (badge && badge !== pg.n ? pg.n + ' — ' + badge : pg.n);
    nameStr = nameStr.replace('â€”', '-');
    var desc = ar ? (AR_D[key] || pg.d) : pg.d;
    return '<a class=”deep-link-card” href=”' + esc(arHref(base, pg.f)) + '”>'
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
    return '<a class=”insight-card” href=”' + esc(arHref(base, pg.f)) + '”>'
         + '<div class=”insight-card-meta”>'
         + '<span class=”insight-category-badge” style=”margin:0”>' + esc(tr(pg.l)) + '</span>'
         + '</div>'
         + '<h3>' + esc(name) + '</h3>'
         + '<p>' + esc(desc) + '</p>'
         + '<span class=”insight-card-cta”>' + esc(tr('Read article')) + ' &rarr;</span>'
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

    /* Market Insights articles */
    var insights = (rel.insights || []).filter(function (k) { return P[k]; });
    if (insights.length) {
      out += '<div class="rc-group">'
           + '<h3 class="rc-sub-heading">' + esc(tr('Related Market Insights')) + '</h3>'
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
         + '<p class="rc-screener-sub">' + esc(tr('TradeAlpha Score across AI stocks and ETFs — educational multi-factor analysis.')) + '</p>'
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
