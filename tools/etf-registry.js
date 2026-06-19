'use strict';

// Phase 214 CP1 — canonical ETF intelligence universe.
// Metadata is descriptive institutional context only. It is not a ranking,
// recommendation, forecast, execution cue, or a substitute for provider data.

const ETFS = [
  {
    symbol: 'VOO', slug: 'voo', issuer: 'Vanguard', fund_name: 'Vanguard S&P 500 ETF',
    category: 'broad_market', exposure_type: 'large_cap_beta', benchmark: 'S&P 500',
    role_en: 'Low-cost S&P 500 beta wrapper for broad US large-cap exposure',
    role_ar: 'غلاف منخفض التكلفة لمؤشر S&P 500 لقياس بيتا الأسهم الأميركية كبيرة رأس المال',
    regime_sensitivity: ['broad_equity_beta', 'earnings_cycle', 'financial_conditions'],
    related: ['SPY', 'VTI', 'QQQ', 'XLK'],
    research_links: ['/insights/voo-vs-vti-long-term-etf-comparison.html', '/insights/spy-vs-qqq-etf-comparison-guide.html']
  },
  {
    symbol: 'VTI', slug: 'vti', issuer: 'Vanguard', fund_name: 'Vanguard Total Stock Market ETF',
    category: 'broad_market', exposure_type: 'total_market_beta', benchmark: 'CRSP US Total Market',
    role_en: 'Total US equity-market wrapper spanning large, mid and small capitalization exposure',
    role_ar: 'غلاف شامل للأسهم الأميركية يضم التعرض للشركات الكبيرة والمتوسطة والصغيرة',
    regime_sensitivity: ['market_breadth', 'domestic_growth', 'financial_conditions'],
    related: ['VOO', 'IWM', 'SPY'],
    research_links: ['/insights/voo-vs-vti-long-term-etf-comparison.html', '/insights/etf-diversification-guide.html']
  },
  {
    symbol: 'QQQ', slug: 'qqq', issuer: 'Invesco', fund_name: 'Invesco QQQ Trust',
    category: 'growth', exposure_type: 'large_cap_growth', benchmark: 'Nasdaq-100',
    role_en: 'Large-cap growth and duration-sensitive equity leadership proxy',
    role_ar: 'مؤشر بديل لقيادة أسهم النمو الكبيرة ذات الحساسية المرتفعة للعوائد',
    regime_sensitivity: ['duration_pressure', 'ai_leadership', 'growth_momentum'],
    related: ['XLK', 'SMH', 'SOXX', 'VOO'],
    research_links: ['/insights/spy-vs-qqq-etf-comparison-guide.html', '/insights/interest-rates-and-tech-stocks.html']
  },
  {
    symbol: 'SCHD', slug: 'schd', issuer: 'Schwab', fund_name: 'Schwab U.S. Dividend Equity ETF',
    category: 'dividend_quality', exposure_type: 'dividend_quality', benchmark: 'Dow Jones U.S. Dividend 100',
    role_en: 'Dividend-quality equity exposure with a defensive income tilt',
    role_ar: 'تعرض للأسهم ذات جودة توزيعات مع ميل دفاعي للدخل',
    regime_sensitivity: ['defensive_rotation', 'quality_factor', 'income_demand'],
    related: ['XLP', 'XLV', 'XLF'],
    research_links: ['/insights/dividend-etfs-explained.html', '/insights/how-dividend-etfs-generate-income.html']
  },
  {
    symbol: 'SOXX', slug: 'soxx', issuer: 'iShares', fund_name: 'iShares Semiconductor ETF',
    category: 'semiconductors', exposure_type: 'industry_concentration', benchmark: 'ICE Semiconductor Index',
    role_en: 'Semiconductor industry exposure tied to AI capex, hardware cycles and chip leadership',
    role_ar: 'تعرض لصناعة أشباه الموصلات المرتبطة بإنفاق الذكاء الاصطناعي ودورات العتاد وقيادة الرقائق',
    regime_sensitivity: ['ai_capex', 'cyclical_growth', 'supply_chain'],
    related: ['SMH', 'XLK', 'QQQ'],
    research_links: ['/insights/semiconductor-cycle-risks.html', '/insights/semiconductor-market-research-semiconductor-concentration-risk.html']
  },
  {
    symbol: 'SMH', slug: 'smh', issuer: 'VanEck', fund_name: 'VanEck Semiconductor ETF',
    category: 'semiconductors', exposure_type: 'industry_concentration', benchmark: 'MVIS US Listed Semiconductor 25',
    role_en: 'Concentrated semiconductor leadership basket with high AI infrastructure sensitivity',
    role_ar: 'سلة مركزة لقيادة أشباه الموصلات ذات حساسية عالية لبنية الذكاء الاصطناعي',
    regime_sensitivity: ['ai_capex', 'mega_cap_concentration', 'cyclical_growth'],
    related: ['SOXX', 'XLK', 'QQQ'],
    research_links: ['/insights/gpu-market-research-gpu-supply-and-demand-signals.html', '/insights/semiconductor-stocks-outlook.html']
  },
  {
    symbol: 'XLK', slug: 'xlk', issuer: 'State Street', fund_name: 'Technology Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'technology_sector', benchmark: 'Technology Select Sector Index',
    role_en: 'Technology sector wrapper for software, hardware and platform leadership',
    role_ar: 'غلاف قطاع التكنولوجيا لقيادة البرمجيات والعتاد والمنصات',
    regime_sensitivity: ['growth_momentum', 'duration_pressure', 'ai_leadership'],
    related: ['QQQ', 'SMH', 'SOXX'],
    research_links: ['/insights/cloud-computing-ai-market-structure.html', '/insights/mega-cap-tech-index-concentration.html']
  },
  {
    symbol: 'XLF', slug: 'xlf', issuer: 'State Street', fund_name: 'Financial Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'financials_sector', benchmark: 'Financial Select Sector Index',
    role_en: 'Financial sector wrapper sensitive to rates, credit conditions and yield-curve context',
    role_ar: 'غلاف قطاع مالي حساس للعوائد وظروف الائتمان وسياق منحنى العائد',
    regime_sensitivity: ['yield_curve', 'credit_conditions', 'risk_appetite'],
    related: ['XLI', 'XLRE', 'VOO'],
    research_links: ['/insights/sector-rotation-explained.html']
  },
  {
    symbol: 'XLV', slug: 'xlv', issuer: 'State Street', fund_name: 'Health Care Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'healthcare_sector', benchmark: 'Health Care Select Sector Index',
    role_en: 'Healthcare sector wrapper with defensive earnings characteristics',
    role_ar: 'غلاف قطاع الرعاية الصحية بخصائص أرباح دفاعية',
    regime_sensitivity: ['defensive_rotation', 'quality_factor', 'policy_risk'],
    related: ['XLP', 'XLU', 'SCHD'],
    research_links: ['/insights/healthcare-etf-research-guide.html', '/insights/defensive-investing-explained.html']
  },
  {
    symbol: 'XLE', slug: 'xle', issuer: 'State Street', fund_name: 'Energy Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'energy_sector', benchmark: 'Energy Select Sector Index',
    role_en: 'Energy sector wrapper sensitive to oil, inflation pressure and cyclicality',
    role_ar: 'غلاف قطاع الطاقة الحساس للنفط وضغط التضخم والدورة الاقتصادية',
    regime_sensitivity: ['oil_pressure', 'inflation_pressure', 'cyclical_growth'],
    related: ['XLF', 'XLI', 'XLB'],
    research_links: ['/insights/sector-rotation-explained.html']
  },
  {
    symbol: 'XLI', slug: 'xli', issuer: 'State Street', fund_name: 'Industrial Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'industrials_sector', benchmark: 'Industrial Select Sector Index',
    role_en: 'Industrial sector wrapper tied to capital spending, infrastructure and cyclicality',
    role_ar: 'غلاف قطاع صناعي مرتبط بالإنفاق الرأسمالي والبنية التحتية والدورة الاقتصادية',
    regime_sensitivity: ['cyclical_growth', 'capital_spending', 'dollar_sensitivity'],
    related: ['XLF', 'XLE', 'XLB'],
    research_links: ['/insights/sector-rotation-explained.html']
  },
  {
    symbol: 'XLU', slug: 'xlu', issuer: 'State Street', fund_name: 'Utilities Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'utilities_sector', benchmark: 'Utilities Select Sector Index',
    role_en: 'Utilities sector wrapper with defensive and rate-sensitive characteristics',
    role_ar: 'غلاف قطاع المرافق بخصائص دفاعية وحساسية للعوائد',
    regime_sensitivity: ['defensive_rotation', 'yield_pressure', 'income_demand'],
    related: ['XLV', 'XLP', 'TLT'],
    research_links: ['/insights/defensive-investing-explained.html']
  },
  {
    symbol: 'XLP', slug: 'xlp', issuer: 'State Street', fund_name: 'Consumer Staples Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'staples_sector', benchmark: 'Consumer Staples Select Sector Index',
    role_en: 'Consumer staples sector wrapper for defensive consumption exposure',
    role_ar: 'غلاف قطاع السلع الاستهلاكية الأساسية للتعرض الدفاعي للاستهلاك',
    regime_sensitivity: ['defensive_rotation', 'margin_pressure', 'consumer_resilience'],
    related: ['XLV', 'XLU', 'SCHD'],
    research_links: ['/insights/defensive-investing-explained.html']
  },
  {
    symbol: 'XLY', slug: 'xly', issuer: 'State Street', fund_name: 'Consumer Discretionary Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'discretionary_sector', benchmark: 'Consumer Discretionary Select Sector Index',
    role_en: 'Consumer discretionary sector wrapper tied to household demand and growth appetite',
    role_ar: 'غلاف قطاع السلع الكمالية المرتبط بطلب الأسر وشهية النمو',
    regime_sensitivity: ['consumer_demand', 'risk_appetite', 'rates_pressure'],
    related: ['QQQ', 'XLF', 'VOO'],
    research_links: ['/insights/sector-rotation-explained.html']
  },
  {
    symbol: 'XLB', slug: 'xlb', issuer: 'State Street', fund_name: 'Materials Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'materials_sector', benchmark: 'Materials Select Sector Index',
    role_en: 'Materials sector wrapper exposed to commodities, global growth and dollar conditions',
    role_ar: 'غلاف قطاع المواد المعرض للسلع والنمو العالمي وظروف الدولار',
    regime_sensitivity: ['global_growth', 'dollar_sensitivity', 'commodity_pressure'],
    related: ['XLE', 'XLI', 'UUP'],
    research_links: ['/insights/sector-rotation-explained.html']
  },
  {
    symbol: 'XLRE', slug: 'xlre', issuer: 'State Street', fund_name: 'Real Estate Select Sector SPDR Fund',
    category: 'sector', exposure_type: 'real_estate_sector', benchmark: 'Real Estate Select Sector Index',
    role_en: 'Real estate sector wrapper with high sensitivity to rates and financing conditions',
    role_ar: 'غلاف قطاع العقارات ذو حساسية مرتفعة للعوائد وظروف التمويل',
    regime_sensitivity: ['yield_pressure', 'credit_conditions', 'income_demand'],
    related: ['TLT', 'XLF', 'XLU'],
    research_links: ['/insights/interest-rate-research-interest-rate-sensitivity-in-growth-stocks.html']
  },
  {
    symbol: 'IEF', slug: 'ief', issuer: 'iShares', fund_name: 'iShares 7-10 Year Treasury Bond ETF',
    category: 'fixed_income', exposure_type: 'intermediate_duration_treasuries', benchmark: 'ICE U.S. Treasury 7-10 Year Bond Index',
    role_en: 'Intermediate-duration Treasury wrapper for rates and duration context',
    role_ar: 'غلاف سندات خزانة متوسطة المدة لسياق العوائد والمدة',
    regime_sensitivity: ['yield_pressure', 'duration_demand', 'defensive_rotation'],
    related: ['TLT', 'LQD', 'HYG'],
    research_links: ['/insights/bond-etfs-in-market-research.html']
  },
  {
    symbol: 'TLT', slug: 'tlt', issuer: 'iShares', fund_name: 'iShares 20+ Year Treasury Bond ETF',
    category: 'fixed_income', exposure_type: 'long_duration_treasuries', benchmark: 'ICE U.S. Treasury 20+ Year Bond Index',
    role_en: 'Long-duration Treasury wrapper for rates pressure and defensive duration demand',
    role_ar: 'غلاف سندات خزانة طويلة المدة لضغط العوائد وطلب المدة الدفاعية',
    regime_sensitivity: ['yield_pressure', 'duration_demand', 'risk_aversion'],
    related: ['IEF', 'XLU', 'XLRE'],
    research_links: ['/insights/bond-etfs-in-market-research.html', '/insights/interest-rates-and-tech-stocks.html']
  },
  {
    symbol: 'HYG', slug: 'hyg', issuer: 'iShares', fund_name: 'iShares iBoxx High Yield Corporate Bond ETF',
    category: 'credit', exposure_type: 'high_yield_credit', benchmark: 'Markit iBoxx USD Liquid High Yield Index',
    role_en: 'High-yield credit wrapper for risk appetite and spread conditions',
    role_ar: 'غلاف ائتمان عالي العائد لقياس شهية المخاطر وظروف الفروقات',
    regime_sensitivity: ['credit_conditions', 'risk_appetite', 'liquidity_pressure'],
    related: ['LQD', 'SPY', 'XLF'],
    research_links: ['/insights/bond-etfs-in-market-research.html', '/insights/etf-risk-comparison-guide.html']
  },
  {
    symbol: 'LQD', slug: 'lqd', issuer: 'iShares', fund_name: 'iShares iBoxx Investment Grade Corporate Bond ETF',
    category: 'credit', exposure_type: 'investment_grade_credit', benchmark: 'Markit iBoxx USD Liquid Investment Grade Index',
    role_en: 'Investment-grade credit wrapper balancing duration and corporate-spread context',
    role_ar: 'غلاف ائتمان استثماري يوازن بين المدة وسياق فروقات الشركات',
    regime_sensitivity: ['credit_conditions', 'yield_pressure', 'liquidity_pressure'],
    related: ['HYG', 'IEF', 'TLT'],
    research_links: ['/insights/bond-etfs-in-market-research.html', '/insights/etf-risk-comparison-guide.html']
  }
];

const BY_SYMBOL = new Map(ETFS.map((etf) => [etf.symbol, etf]));
const SLUGS = ETFS.map((etf) => etf.slug);
const SYMBOLS = ETFS.map((etf) => etf.symbol);

module.exports = { ETFS, BY_SYMBOL, SLUGS, SYMBOLS };
