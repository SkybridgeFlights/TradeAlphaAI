#!/usr/bin/env node
const fs = require('fs');

const fixes = [
  {
    file: 'rankings.html',
    title: 'Stock &amp; ETF Rankings: AI, Dividends &amp; Semiconductors | TradeAlphaAI',
    desc:  'Research-based stock and ETF rankings across AI picks, dividend funds, semiconductor stocks, and growth ETFs. Live prices. Educational context only.',
    ogTitle: 'Stock &amp; ETF Rankings: AI, Dividends &amp; Semiconductors | TradeAlphaAI',
    ogDesc:  'Research-based stock and ETF rankings across AI picks, dividend funds, and semiconductor stocks. Live prices load automatically. Educational context only.',
    twTitle: 'Stock &amp; ETF Rankings: AI, Dividends &amp; Semiconductors',
    twDesc:  'Research-ranked stocks and ETFs across AI, semiconductors, dividend funds, and sector themes. Live prices. Educational context only.',
  },
  {
    file: 'stocks.html',
    title: 'Stock Research &amp; Analyzer: TradeAlpha Score | TradeAlphaAI',
    desc:  'Research stocks worldwide with TradeAlpha Score, technical screening, and risk overview. Covers AI, semiconductors, growth, and global markets. Educational only.',
  },
  {
    file: 'etfs.html',
    title: 'ETF Analysis: Holdings, Expense Ratios &amp; Risk | TradeAlphaAI',
    desc:  'Screen ETFs by TradeAlpha Score, expense ratio, sector exposure, and risk profile. Covers broad market, growth, dividend, and sector funds. Educational only.',
  },
  {
    file: 'ai-stocks.html',
    title: 'AI Stocks Research: NVDA, MSFT &amp; META | TradeAlphaAI',
    desc:  'Educational AI stocks hub for NVDA, MSFT, META, AMZN, PLTR, and QQQ. AI infrastructure screening with TradeAlphaAI scores and sector context. Educational only.',
  },
  {
    file: 'semiconductor-stocks.html',
    title: 'Semiconductor Stocks: NVDA, AMD &amp; AI Chips | TradeAlphaAI',
    desc:  'Research semiconductor stocks including NVDA, AMD, AVGO, and SOXX: AI chip demand, capex cycles, inventory risk, and sector context. Educational only.',
  },
  {
    file: 'dividend-etfs.html',
    title: 'Dividend ETFs: SCHD, VIG &amp; JEPI Yield Research | TradeAlphaAI',
    desc:  'Research dividend ETFs including SCHD, VIG, and JEPI: yield mechanics, quality screens, expense ratios, and rate sensitivity. Educational only.',
  },
  {
    file: 'defensive-etfs.html',
    title: 'Defensive ETFs Research: BND, XLP &amp; Low-Risk Funds | TradeAlphaAI',
    desc:  'Educational defensive ETFs hub covering SCHD, VIG, JEPI, BND, IEF, XLV, portfolio role, expenses, risk, and TradeAlphaAI scores. Educational only.',
  },
  {
    file: 'compare/spy-vs-qqq.html',
    title: 'SPY vs QQQ: S&amp;P 500 vs Nasdaq-100 Comparison | TradeAlphaAI',
    desc:  'Compare SPDR S&amp;P 500 (SPY) vs Invesco QQQ: sector positioning, index methodology, expense ratios, risk factors, and research context. Educational only.',
  },
  {
    file: 'compare/nvda-vs-amd.html',
    title: 'NVDA vs AMD: AI Chip Stock Comparison | TradeAlphaAI',
    desc:  'Compare NVIDIA (NVDA) vs Advanced Micro Devices (AMD): AI chip exposure, market position, risk factors, and research context. Educational only.',
  },
  {
    file: 'compare/jepi-vs-schd.html',
    title: 'JEPI vs SCHD: Income ETF Comparison | TradeAlphaAI',
    desc:  'Compare JPMorgan Equity Premium Income (JEPI) vs Schwab US Dividend Equity (SCHD): yield, quality screen, expense ratio, and risk profile. Educational only.',
  },
  {
    file: 'insights/spy-vs-qqq-etf-comparison-guide.html',
    title: 'SPY vs QQQ ETF Guide: S&amp;P 500 vs Nasdaq-100 | TradeAlphaAI',
    desc:  'Educational SPY vs QQQ guide: S&amp;P 500 vs Nasdaq-100 index methodology, sector concentration, expense ratios, risk differences, and research context.',
  },
  {
    file: 'insights/dividend-etfs-explained.html',
    title: 'Dividend ETFs Explained: SCHD, VIG &amp; JEPI | TradeAlphaAI',
    desc:  'Educational dividend ETF guide: how SCHD, VIG, and JEPI differ in yield mechanics, quality screens, payout ratios, rate sensitivity, and risk profiles.',
  },
  {
    file: 'insights/semiconductor-stocks-outlook.html',
    title: 'Semiconductor Stocks: AI Chip Outlook &amp; Cycles | TradeAlphaAI',
    desc:  'Educational semiconductor stocks research: AI chip demand drivers, hyperscaler capex, inventory cycle risk, supply chain constraints, and sector context.',
  },
  {
    file: 'insights/portfolio-diversification-basics.html',
    title: 'Portfolio Diversification Basics: How It Works | TradeAlphaAI',
    desc:  'Educational guide to portfolio diversification: asset correlation, multi-asset allocation, ETF vs stock diversification, and risk reduction research.',
  },
  {
    file: 'etfs/spy.html',
    title: 'SPY ETF Analysis: S&amp;P 500 Holdings &amp; Risk | TradeAlphaAI',
    desc:  'Research SPDR S&amp;P 500 ETF (SPY): Large Blend methodology, sector allocation, top holdings, expense ratio, and TradeAlpha Score. Educational only.',
  },
  {
    file: 'etfs/qqq.html',
    title: 'QQQ ETF Analysis: Nasdaq-100 Holdings &amp; Risk | TradeAlphaAI',
    desc:  'Research Invesco QQQ Trust (QQQ): Large Growth methodology, Nasdaq-100 sector exposure, top holdings, expense ratio, and TradeAlpha Score. Educational only.',
  },
  {
    file: 'etfs/schd.html',
    title: 'SCHD ETF: Dividend Quality Holdings &amp; Yield | TradeAlphaAI',
    desc:  'Research Schwab US Dividend Equity ETF (SCHD): Dividend Equity methodology, yield quality, top holdings, expense ratio, and TradeAlpha Score. Educational only.',
  },
  {
    file: 'insights/etf-research-methodology.html',
    title: 'How to Research ETFs: Step-by-Step Framework | TradeAlphaAI',
    desc:  'Educational ETF research framework: index methodology, expense ratios, sector concentration, tracking error, volatility, and side-by-side comparison guide.',
  },
];

function setMeta(html, nameOrProp, attr, value) {
  // handles both name= and property= attributes in either order
  const re1 = new RegExp(`(<meta\\s+${attr}="${nameOrProp}"\\s+content=")[^"]+(")`,'i');
  const re2 = new RegExp(`(<meta\\s+content=")[^"]+(\"\\s+${attr}="${nameOrProp}")`, 'i');
  if (re1.test(html)) return html.replace(re1, `$1${value}$2`);
  if (re2.test(html)) return html.replace(re2, `$1${value}$2`);
  return html;
}

let updated = 0;
for (const fix of fixes) {
  try {
    let html = fs.readFileSync(fix.file, 'utf8');
    let orig = html;

    // Fix <title>
    html = html.replace(/(<title>)[^<]+(<\/title>)/, `$1${fix.title}$2`);

    // Fix meta description
    html = setMeta(html, 'description', 'name', fix.desc);

    // Fix og:title if provided
    if (fix.ogTitle) html = setMeta(html, 'og:title', 'property', fix.ogTitle);

    // Fix og:description if provided
    if (fix.ogDesc) html = setMeta(html, 'og:description', 'property', fix.ogDesc);

    // Fix twitter:title if provided
    if (fix.twTitle) html = setMeta(html, 'twitter:title', 'name', fix.twTitle);

    // Fix twitter:description if provided
    if (fix.twDesc) html = setMeta(html, 'twitter:description', 'name', fix.twDesc);

    if (html !== orig) {
      fs.writeFileSync(fix.file, html, 'utf8');
      updated++;
      console.log('Updated: ' + fix.file);
    } else {
      console.log('No change: ' + fix.file);
    }
  } catch(e) {
    console.log('Error: ' + fix.file + ' - ' + e.message);
  }
}
console.log('Done. Updated ' + updated + ' files.');
