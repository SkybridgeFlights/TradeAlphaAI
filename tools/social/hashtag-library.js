'use strict';

// Topic-aware hashtag library tuned for institutional/research finance content.
//
// Strategy:
//   - Core brand tags (always present): #TradeAlphaAI #MarketResearch
//   - Topic tags inferred from slug + title keywords
//   - Platform-specific limits (Instagram = many, X = sparse)
//
// Why hashtags matter:
//   - Instagram: hashtags are the PRIMARY discovery mechanism
//   - LinkedIn: 3-5 hashtags double impressions on average
//   - X: 1-2 hashtags maximum (more reads as spam)
//   - Facebook: hashtags have minor algorithmic boost; keep ≤ 2

const CORE = ['#TradeAlphaAI', '#MarketResearch', '#FinancialAnalysis'];

// Topic keyword -> hashtags. First match wins for each tag in the article.
const TOPIC_MAP = [
  // AI / tech
  { keywords: ['ai-', 'ai etf', 'ai stock', 'artificial intelligence', 'machine learning'],
    tags: ['#AIstocks', '#ArtificialIntelligence', '#TechStocks', '#FutureOfFinance'] },

  { keywords: ['semiconductor', 'chip', 'nvda', 'amd', 'tsmc', 'smh', 'soxx'],
    tags: ['#Semiconductors', '#ChipStocks', '#NVDA', '#TechInvesting'] },

  { keywords: ['cloud', 'msft', 'googl', 'amzn'],
    tags: ['#CloudComputing', '#TechStocks', '#BigTech'] },

  { keywords: ['cybersecurity', 'crwd', 'panw', 'zscaler'],
    tags: ['#Cybersecurity', '#TechStocks', '#CyberStocks'] },

  // ETF / fund types
  { keywords: ['etf', 'index fund', 'vanguard', 'ishares', 'spy', 'qqq', 'voo', 'vti'],
    tags: ['#ETF', '#ETFInvesting', '#IndexFunds', '#PassiveInvesting'] },

  { keywords: ['dividend', 'income', 'schd', 'jepi', 'vig'],
    tags: ['#DividendStocks', '#PassiveIncome', '#DividendInvesting', '#IncomeInvesting'] },

  { keywords: ['bond', 'treasury', 'tlt', 'agg', 'bnd', 'fixed income'],
    tags: ['#Bonds', '#FixedIncome', '#TreasuryYields', '#BondMarket'] },

  { keywords: ['growth-etf', 'growth-stock', 'growth-vs'],
    tags: ['#GrowthInvesting', '#GrowthStocks'] },

  { keywords: ['value-etf', 'value-stock', 'value-vs', 'defensive'],
    tags: ['#ValueInvesting', '#ValueStocks', '#DefensiveStocks'] },

  { keywords: ['small-cap', 'iwm', 'small cap'],
    tags: ['#SmallCapStocks', '#SmallCapETF', '#IWM'] },

  { keywords: ['sector-etf', 'sector rotation', 'xlk', 'xlf', 'xle', 'xlv'],
    tags: ['#SectorRotation', '#SectorETF', '#PortfolioStrategy'] },

  { keywords: ['international', 'emerging market', 'eem', 'efa', 'vxus'],
    tags: ['#GlobalInvesting', '#EmergingMarkets', '#InternationalETF'] },

  { keywords: ['healthcare', 'biotech', 'pharma', 'xlv', 'xbi'],
    tags: ['#HealthcareStocks', '#Biotech', '#PharmaStocks'] },

  // Macro
  { keywords: ['cpi', 'inflation', 'pce'],
    tags: ['#Inflation', '#CPI', '#MacroAnalysis', '#FedPolicy'] },

  { keywords: ['fed', 'fomc', 'rate decision', 'interest rate'],
    tags: ['#FederalReserve', '#FedPolicy', '#InterestRates', '#FOMC'] },

  { keywords: ['gdp', 'growth-rate', 'recession'],
    tags: ['#GDP', '#EconomicGrowth', '#Macro', '#Economy'] },

  { keywords: ['nfp', 'jobs', 'unemployment', 'labor'],
    tags: ['#JobsReport', '#NFP', '#LaborMarket', '#Economy'] },

  { keywords: ['yield', 'curve', 'treasury'],
    tags: ['#YieldCurve', '#BondMarket', '#FixedIncome'] },

  { keywords: ['volatility', 'vix'],
    tags: ['#VIX', '#Volatility', '#MarketVolatility', '#RiskManagement'] },

  { keywords: ['regime', 'transition', 'breakout'],
    tags: ['#MarketRegime', '#MarketAnalysis', '#TradingStrategy'] },

  { keywords: ['rotation', 'leadership', 'breadth'],
    tags: ['#SectorRotation', '#MarketBreadth', '#PortfolioStrategy'] },
];

// Per-platform display rules. The `max` here MUST stay ≤ the platform's
// `maxHashtags` in platform-content-rules.js — that file enforces the
// validation gate and an overflow here just produces a blocked_invalid_payload.
const PLATFORM_RULES = {
  x:         { max: 2, separator: ' ',  trailingNewline: false },
  facebook:  { max: 3, separator: ' ',  trailingNewline: true  },
  instagram: { max: 8, separator: ' ',  trailingNewline: true  },
  linkedin:  { max: 5, separator: ' ',  trailingNewline: true  },
};

function pickHashtags(platform, { slug = '', title = '', body = '' } = {}) {
  const rule = PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;
  const haystack = (slug + ' ' + title + ' ' + body).toLowerCase();

  // Always include 2 core brand tags first; reserves the rest for topic tags.
  const picked = new Set(CORE.slice(0, 2));

  for (const entry of TOPIC_MAP) {
    if (entry.keywords.some((kw) => haystack.includes(kw))) {
      for (const tag of entry.tags) picked.add(tag);
    }
    if (picked.size >= rule.max + 4) break; // small overflow buffer; we trim below
  }

  // Trim to platform max, preserving order.
  return Array.from(picked).slice(0, rule.max);
}

function renderHashtags(platform, ctx) {
  const tags = pickHashtags(platform, ctx);
  if (!tags.length) return '';
  const rule = PLATFORM_RULES[platform] || PLATFORM_RULES.facebook;
  const block = tags.join(rule.separator);
  return rule.trailingNewline ? '\n\n' + block : ' ' + block;
}

module.exports = { pickHashtags, renderHashtags, CORE };
