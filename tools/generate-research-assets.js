'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'research-assets');

const stocks = [
  ['NVDA', 'NVIDIA Corporation', 'Semiconductors', ['AI Infrastructure', 'GPU Compute', 'Data Centers']],
  ['AMD', 'Advanced Micro Devices', 'Semiconductors', ['AI Accelerators', 'CPUs', 'Data Centers']],
  ['MSFT', 'Microsoft Corporation', 'Software', ['Cloud Computing', 'AI Platforms', 'Enterprise Software']],
  ['META', 'Meta Platforms', 'Communication Services', ['Digital Advertising', 'AI Engagement', 'Social Platforms']],
  ['GOOGL', 'Alphabet Inc.', 'Communication Services', ['Search Advertising', 'Cloud Computing', 'AI Platforms']],
  ['AMZN', 'Amazon.com Inc.', 'Consumer Discretionary', ['Cloud Computing', 'E-commerce', 'Logistics']],
  ['AAPL', 'Apple Inc.', 'Technology Hardware', ['Consumer Devices', 'Services Revenue', 'Ecosystem']],
  ['AVGO', 'Broadcom Inc.', 'Semiconductors', ['Networking Chips', 'AI Infrastructure', 'Enterprise Software']],
  ['SMCI', 'Super Micro Computer', 'Technology Hardware', ['AI Servers', 'Data Centers', 'Hardware Supply Chain']],
  ['TSM', 'Taiwan Semiconductor Manufacturing', 'Semiconductors', ['Foundry', 'Advanced Nodes', 'Chip Supply Chain']],
  ['PLTR', 'Palantir Technologies', 'Software', ['AI Software', 'Government Contracts', 'Data Platforms']],
  ['CRM', 'Salesforce Inc.', 'Software', ['Enterprise Software', 'CRM', 'AI Workflow']],
  ['ORCL', 'Oracle Corporation', 'Software', ['Cloud Infrastructure', 'Database Software', 'Enterprise IT']],
  ['TSLA', 'Tesla Inc.', 'Automobiles', ['Electric Vehicles', 'Autonomy', 'Energy Storage']],
  ['NFLX', 'Netflix Inc.', 'Communication Services', ['Streaming Media', 'Content Scale', 'Advertising Tier']],
  ['ASML', 'ASML Holding', 'Semiconductor Equipment', ['Lithography', 'Advanced Nodes', 'Chip Capex']],
  ['INTC', 'Intel Corporation', 'Semiconductors', ['CPUs', 'Foundry Turnaround', 'Manufacturing']],
  ['MU', 'Micron Technology', 'Semiconductors', ['Memory', 'HBM', 'Semiconductor Cycles']],
  ['ARM', 'Arm Holdings', 'Semiconductors', ['IP Licensing', 'Mobile Compute', 'AI Edge']],
  ['NOW', 'ServiceNow Inc.', 'Software', ['Workflow Automation', 'Enterprise AI', 'SaaS']],
  ['ADBE', 'Adobe Inc.', 'Software', ['Creative Software', 'Digital Media', 'Generative AI']],
  ['PANW', 'Palo Alto Networks', 'Cybersecurity', ['Cybersecurity', 'Platform Consolidation', 'Enterprise Security']],
  ['CRWD', 'CrowdStrike Holdings', 'Cybersecurity', ['Endpoint Security', 'Cloud Security', 'Threat Intelligence']],
  ['QCOM', 'Qualcomm Inc.', 'Semiconductors', ['Mobile Chips', 'Edge AI', 'Licensing']],
  ['TXN', 'Texas Instruments', 'Semiconductors', ['Analog Chips', 'Industrial Demand', 'Capital Discipline']]
];

const etfs = [
  ['SPY', 'SPDR S&P 500 ETF Trust', 'Large Blend', ['Broad Market', 'S&P 500', 'Core Equity']],
  ['QQQ', 'Invesco QQQ Trust', 'Large Growth', ['Nasdaq 100', 'Growth Stocks', 'Technology']],
  ['VOO', 'Vanguard S&P 500 ETF', 'Large Blend', ['Broad Market', 'Low Cost', 'S&P 500']],
  ['VTI', 'Vanguard Total Stock Market ETF', 'Total Market', ['Broad Market', 'Total U.S. Market', 'Diversification']],
  ['SOXX', 'iShares Semiconductor ETF', 'Sector Equity', ['Semiconductors', 'AI Chips', 'Sector Exposure']],
  ['SMH', 'VanEck Semiconductor ETF', 'Sector Equity', ['Semiconductors', 'Foundry', 'AI Chips']],
  ['XLK', 'Technology Select Sector SPDR Fund', 'Sector Equity', ['Technology', 'Mega-Cap Tech', 'Software']],
  ['SCHD', 'Schwab U.S. Dividend Equity ETF', 'Dividend Equity', ['Dividend Quality', 'Value Tilt', 'Defensive Equity']],
  ['VIG', 'Vanguard Dividend Appreciation ETF', 'Dividend Equity', ['Dividend Growth', 'Quality', 'Defensive Equity']],
  ['DGRO', 'iShares Core Dividend Growth ETF', 'Dividend Equity', ['Dividend Growth', 'Income', 'Quality']],
  ['DIA', 'SPDR Dow Jones Industrial Average ETF', 'Large Blend', ['Dow Jones', 'Blue Chips', 'Industrial Economy']],
  ['IWM', 'iShares Russell 2000 ETF', 'Small Blend', ['Small Caps', 'Domestic Growth', 'Risk Appetite']],
  ['TLT', 'iShares 20+ Year Treasury Bond ETF', 'Long Treasury', ['Rates', 'Duration Risk', 'Macro Hedge']],
  ['GLD', 'SPDR Gold Shares', 'Commodities', ['Gold', 'Inflation Hedge', 'Macro Risk']],
  ['VUG', 'Vanguard Growth ETF', 'Large Growth', ['Growth Stocks', 'Mega-Cap Tech', 'Factor Exposure']],
  ['VTV', 'Vanguard Value ETF', 'Large Value', ['Value Stocks', 'Financials', 'Defensive Equity']],
  ['XLF', 'Financial Select Sector SPDR Fund', 'Sector Equity', ['Financials', 'Banks', 'Rate Sensitivity']],
  ['XLE', 'Energy Select Sector SPDR Fund', 'Sector Equity', ['Energy', 'Oil Prices', 'Commodity Exposure']],
  ['XLV', 'Health Care Select Sector SPDR Fund', 'Sector Equity', ['Health Care', 'Defensive Equity', 'Policy Risk']],
  ['XLY', 'Consumer Discretionary Select Sector SPDR Fund', 'Sector Equity', ['Consumer Spending', 'Retail', 'Cyclical Growth']]
];

const arTerms = {
  'Semiconductors': 'أشباه الموصلات',
  'Software': 'البرمجيات',
  'Communication Services': 'خدمات الاتصالات',
  'Consumer Discretionary': 'الاستهلاك التقديري',
  'Technology Hardware': 'عتاد التكنولوجيا',
  'Semiconductor Equipment': 'معدات أشباه الموصلات',
  'Automobiles': 'السيارات',
  'Cybersecurity': 'الأمن السيبراني',
  'Large Blend': 'أسهم كبرى مختلطة',
  'Large Growth': 'أسهم نمو كبرى',
  'Total Market': 'السوق الكلي',
  'Sector Equity': 'أسهم قطاعية',
  'Dividend Equity': 'أسهم توزيعات',
  'Small Blend': 'أسهم صغيرة مختلطة',
  'Long Treasury': 'سندات خزانة طويلة الأجل',
  'Commodities': 'سلع',
  'Large Value': 'أسهم قيمة كبرى',
  'AI Infrastructure': 'البنية التحتية للذكاء الاصطناعي',
  'Cloud Computing': 'الحوسبة السحابية',
  'Data Centers': 'مراكز البيانات',
  'GPU Compute': 'حوسبة GPU',
  'AI Accelerators': 'مسرعات الذكاء الاصطناعي',
  'Enterprise Software': 'برمجيات المؤسسات',
  'Digital Advertising': 'الإعلانات الرقمية',
  'Search Advertising': 'إعلانات البحث',
  'Consumer Devices': 'أجهزة المستهلك',
  'Services Revenue': 'إيرادات الخدمات',
  'Networking Chips': 'رقائق الشبكات',
  'AI Servers': 'خوادم الذكاء الاصطناعي',
  'Foundry': 'تصنيع الرقائق',
  'AI Software': 'برمجيات الذكاء الاصطناعي',
  'Electric Vehicles': 'المركبات الكهربائية',
  'Streaming Media': 'البث الإعلامي',
  'Lithography': 'الطباعة الضوئية',
  'Memory': 'الذاكرة',
  'Cybersecurity': 'الأمن السيبراني',
  'Broad Market': 'السوق الواسع',
  'Core Equity': 'أسهم أساسية',
  'Technology': 'التكنولوجيا',
  'Low Cost': 'منخفض التكلفة',
  'Diversification': 'التنويع',
  'Dividend Quality': 'جودة التوزيعات',
  'Small Caps': 'الشركات الصغيرة',
  'Rates': 'أسعار الفائدة',
  'Gold': 'الذهب',
  'Value Stocks': 'أسهم القيمة',
  'Growth Stocks': 'أسهم النمو'
};

function ar(value) {
  return arTerms[value] || String(value)
    .replace(/AI/g, 'الذكاء الاصطناعي')
    .replace(/Market/g, 'السوق')
    .replace(/Growth/g, 'النمو')
    .replace(/Risk/g, 'المخاطر')
    .replace(/Technology/g, 'التكنولوجيا')
    .replace(/Cloud/g, 'السحابة')
    .replace(/Data/g, 'البيانات')
    .replace(/Infrastructure/g, 'البنية التحتية')
    .replace(/Software/g, 'البرمجيات')
    .replace(/Chips/g, 'الرقائق')
    .replace(/Exposure/g, 'التعرض')
    .replace(/Quality/g, 'الجودة')
    .trim();
}

function stockAsset([symbol, name, sector, themes], index) {
  const relatedStocks = stocks.map((s) => s[0]).filter((s) => s !== symbol).slice(index % 5, index % 5 + 4);
  const relatedETFs = sector.includes('Semiconductor') ? ['SOXX', 'SMH', 'QQQ'] : sector.includes('Software') ? ['QQQ', 'XLK', 'VUG'] : ['SPY', 'QQQ', 'VTI'];
  return {
    symbol,
    name,
    type: 'stock',
    sector,
    themes,
    overview: `${name} is tracked as an educational research asset because it connects to ${themes.slice(0, 2).join(' and ')} themes within public equity markets.`,
    businessModel: `${name} generates value through its core ${sector.toLowerCase()} business model, product cycle execution, customer demand, pricing power, and operating margin discipline.`,
    whyInvestorsFollow: `Investors follow ${symbol} for signals about ${themes[0].toLowerCase()}, revenue durability, competitive positioning, valuation sensitivity, and sector leadership.`,
    bullCase: [`Stronger demand tied to ${themes[0]}.`, 'Durable margins and execution quality.', 'Potential leadership inside its sector research theme.'],
    bearCase: ['Valuation expectations may already price in strong execution.', 'Cyclical demand or customer concentration can pressure results.', 'Macro conditions can compress multiples for growth assets.'],
    riskFactors: ['valuation risk', 'earnings sensitivity', 'sector volatility', 'macro liquidity'],
    valuationContext: `${symbol} should be evaluated through revenue growth, margin quality, free cash flow durability, and peer-relative multiples, not as a buy or sell signal.`,
    relatedStocks,
    relatedETFs,
    relatedInsights: ['ai-infrastructure-demand', 'semiconductor-cycle-risks', 'interest-rates-and-tech-stocks'],
    ar: {
      sector: ar(sector),
      themes: themes.map(ar),
      overview: `تتم متابعة ${name} كأصل بحثي تعليمي لأنه يرتبط بمحاور ${themes.slice(0, 2).map(ar).join(' و')} داخل أسواق الأسهم العامة.`,
      businessModel: `يعتمد نموذج أعمال ${name} على نشاطه الأساسي في ${ar(sector)} ودورات المنتجات وطلب العملاء وقوة التسعير وانضباط الهوامش التشغيلية.`,
      whyInvestorsFollow: `يتابع الباحثون ${symbol} لفهم إشارات ${ar(themes[0])} ومتانة الإيرادات والموقع التنافسي وحساسية التقييم وقيادة القطاع.`,
      bullCase: [`طلب أقوى مرتبط بمحور ${ar(themes[0])}.`, 'هوامش أكثر متانة وجودة أعلى في التنفيذ.', 'إمكانية قيادة داخل المحور البحثي للقطاع.'],
      bearCase: ['قد تكون توقعات التقييم قد استوعبت جزءا كبيرا من التنفيذ القوي.', 'يمكن أن تضغط دورية الطلب أو تركّز العملاء على النتائج.', 'قد تؤدي الظروف الكلية إلى ضغط مضاعفات أسهم النمو.'],
      riskFactors: ['مخاطر التقييم', 'حساسية الأرباح', 'تذبذب القطاع', 'سيولة الاقتصاد الكلي'],
      valuationContext: `ينبغي تقييم ${symbol} عبر نمو الإيرادات وجودة الهوامش ومتانة التدفق النقدي والمضاعفات النسبية، وليس كإشارة شراء أو بيع.`
    },
    seo: {
      title: `${symbol} Stock Research | ${name} Educational Analysis`,
      description: `${symbol} educational stock research covering business model, themes, bull case, risks, valuation context, and related ETFs.`,
      arTitle: `بحث سهم ${symbol} | تحليل تعليمي لـ ${name}`,
      arDescription: `بحث تعليمي عن سهم ${symbol} يغطي نموذج الأعمال والمحاور والعوامل الإيجابية والمخاطر وسياق التقييم وصناديق المؤشرات المرتبطة.`
    },
    faq: [
      { q: `Why do investors follow ${symbol}?`, a: `${symbol} is followed for exposure to ${themes[0]}, sector leadership, earnings sensitivity, and valuation context.` },
      { q: `Is ${symbol} research financial advice?`, a: 'No. This page is educational research only and does not provide investment or financial advice.' }
    ],
    arFaq: [
      { q: `لماذا يتابع الباحثون ${symbol}؟`, a: `تتم متابعة ${symbol} بسبب التعرض لمحور ${ar(themes[0])} وقيادة القطاع وحساسية الأرباح وسياق التقييم.` },
      { q: `هل بحث ${symbol} نصيحة مالية؟`, a: 'لا. هذه الصفحة بحث تعليمي فقط ولا تقدم نصيحة استثمارية أو مالية.' }
    ]
  };
}

function etfAsset([symbol, name, category, themes], index) {
  const relatedETFs = etfs.map((e) => e[0]).filter((s) => s !== symbol).slice(index % 6, index % 6 + 4);
  const relatedStocks = category.includes('Sector') || themes.includes('Technology') ? ['NVDA', 'MSFT', 'AAPL', 'AVGO'] : ['AAPL', 'MSFT', 'AMZN', 'GOOGL'];
  return {
    symbol,
    name,
    type: 'etf',
    category,
    themes,
    overview: `${name} is tracked as an educational ETF research asset for ${category.toLowerCase()} exposure and portfolio comparison.`,
    etfMethodology: `${symbol} should be reviewed through its index rules, weighting method, rebalance process, top holdings, expense context, and liquidity profile.`,
    whyInvestorsFollow: `Investors follow ${symbol} to compare ${themes[0].toLowerCase()} exposure, diversification role, risk profile, and broad market sensitivity.`,
    bullCase: ['Clear exposure profile for research comparison.', 'Useful portfolio role when matched with appropriate risk context.', 'Transparent ETF structure and holdings data.'],
    bearCase: ['Concentration can increase drawdown sensitivity.', 'Expense ratios and trading spreads affect long-term ownership cost.', 'The ETF can decline with its underlying market or sector.'],
    riskFactors: ['market risk', 'concentration risk', 'liquidity risk', 'methodology risk'],
    valuationContext: `${symbol} is best evaluated through holdings, sector weights, expense ratio, tracking behavior, and drawdown history rather than as a prediction.`,
    relatedStocks,
    relatedETFs,
    relatedInsights: ['spy-vs-qqq-explained', 'etf-expense-ratios-explained', 'sector-etfs-vs-broad-market'],
    ar: {
      category: ar(category),
      themes: themes.map(ar),
      overview: `تتم متابعة ${name} كأصل بحثي تعليمي لصناديق المؤشرات بسبب تعرضه لفئة ${ar(category)} ودوره في مقارنة المحافظ.`,
      etfMethodology: `ينبغي تحليل ${symbol} من خلال قواعد المؤشر وطريقة الوزن وإعادة الموازنة وأكبر المكونات وسياق المصاريف والسيولة.`,
      whyInvestorsFollow: `يتابع الباحثون ${symbol} لمقارنة تعرض ${ar(themes[0])} ودور التنويع وملف المخاطر وحساسية السوق الواسع.`,
      bullCase: ['ملف تعرض واضح للمقارنة البحثية.', 'دور مفيد في المحفظة عند ربطه بسياق المخاطر المناسب.', 'بنية صندوق شفافة وبيانات مكونات قابلة للمراجعة.'],
      bearCase: ['قد يزيد التركّز حساسية التراجع.', 'تؤثر نسب المصاريف وفروق التداول في تكلفة الملكية طويلة الأجل.', 'قد يتراجع الصندوق مع السوق أو القطاع الأساسي.'],
      riskFactors: ['مخاطر السوق', 'مخاطر التركز', 'مخاطر السيولة', 'مخاطر المنهجية'],
      valuationContext: `أفضل طريقة لتقييم ${symbol} هي قراءة المكونات والأوزان القطاعية ونسبة المصاريف وسلوك التتبع وتاريخ التراجع، لا اعتباره توقعا.`
    },
    seo: {
      title: `${symbol} ETF Research | ${name} Educational Analysis`,
      description: `${symbol} educational ETF research covering methodology, category, diversification role, risks, related stocks, and related ETFs.`,
      arTitle: `بحث صندوق ${symbol} | تحليل تعليمي لـ ${name}`,
      arDescription: `بحث تعليمي عن صندوق ${symbol} يغطي المنهجية والفئة ودور التنويع والمخاطر والأسهم والصناديق المرتبطة.`
    },
    faq: [
      { q: `What does ${symbol} provide exposure to?`, a: `${symbol} provides educational research exposure to ${themes.join(', ')} through an ETF structure.` },
      { q: `Is ${symbol} analysis financial advice?`, a: 'No. This page is educational research only and does not provide investment or financial advice.' }
    ],
    arFaq: [
      { q: `ما نوع التعرض الذي يوفره ${symbol}؟`, a: `يوفر ${symbol} تعرضا بحثيا تعليميا لمحاور ${themes.map(ar).join('، ')} عبر بنية صندوق مؤشرات.` },
      { q: `هل تحليل ${symbol} نصيحة مالية؟`, a: 'لا. هذه الصفحة بحث تعليمي فقط ولا تقدم نصيحة استثمارية أو مالية.' }
    ]
  };
}

function writeAsset(kind, asset) {
  const dir = path.join(OUT, kind);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, asset.symbol.toLowerCase() + '.json'), JSON.stringify(asset, null, 2) + '\n', 'utf8');
}

const stockAssets = stocks.map(stockAsset);
const etfAssets = etfs.map(etfAsset);
for (const asset of stockAssets) writeAsset('stocks', asset);
for (const asset of etfAssets) writeAsset('etfs', asset);
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({ generatedAt: new Date().toISOString().slice(0, 10), stocks: stockAssets, etfs: etfAssets }, null, 2) + '\n', 'utf8');

console.log(`Generated ${stocks.length} stock research assets and ${etfs.length} ETF research assets.`);
