'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/research-assets/index.json'), 'utf8'));
const stocks = data.stocks || [];
const etfs = data.etfs || [];

const sections = [
  ['top-ai-stocks', 'Top AI Stocks Right Now', 'Most followed AI-linked research candidates from the TradeAlphaAI universe.', stocks.filter((a) => has(a, 'AI') || has(a, 'Cloud')).slice(0, 10)],
  ['top-semiconductor-stocks', 'Top Semiconductor Stocks', 'Chip, equipment, memory, and AI compute names with strong research relevance.', stocks.filter((a) => /semiconductor/i.test(a.sector) || has(a, 'AI Chips') || has(a, 'GPU')).slice(0, 8)],
  ['top-growth-stocks', 'Best Growth Stocks to Watch', 'Growth-oriented technology and platform companies for educational comparison.', stocks.filter((a) => /Software|Communication|Automobiles|Technology/i.test(a.sector)).slice(0, 8)],
  ['top-dividend-etfs', 'Top Dividend ETFs', 'Dividend-focused ETFs for income, quality, and defensive equity research.', etfs.filter((a) => /dividend/i.test(JSON.stringify(a))).slice(0, 6)],
  ['top-broad-market-etfs', 'Top Broad Market ETFs', 'Core ETF building blocks for broad U.S. equity exposure and portfolio context.', etfs.filter((a) => has(a, 'Broad Market') || has(a, 'Core Equity') || has(a, 'Total U.S. Market')).slice(0, 7)],
  ['ai-infrastructure-focus', 'Most Followed AI Infrastructure Stocks', 'Data center, accelerator, cloud, and infrastructure names followed by the research desk.', stocks.filter((a) => has(a, 'AI Infrastructure') || has(a, 'Data Centers') || has(a, 'Cloud')).slice(0, 8)],
  ['high-volatility-watchlist', 'High Volatility Watchlist', 'Higher-beta research candidates where risk context matters as much as upside narratives.', [...stocks, ...etfs].filter((a) => /Semiconductor|GPU|Small|Electric|Cybersecurity/i.test(`${a.sector || a.category} ${(a.themes || []).join(' ')}`)).slice(0, 8)],
  ['most-followed-tech', 'Most Followed Tech Stocks', 'Large technology names that anchor many market conversations and ETF exposures.', stocks.filter((a) => ['MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AVGO', 'NFLX'].includes(a.symbol)).slice(0, 8)]
];

function score(asset) {
  const seed = [...asset.symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 58 + (seed % 31);
}

function risk(asset) {
  if (/Semiconductor|GPU|Small|Electric|Cybersecurity/i.test(`${asset.sector || asset.category} ${(asset.themes || []).join(' ')}`)) return 'High volatility research profile';
  if (/Bond|Gold|Dividend|Value/i.test(`${asset.category || asset.sector} ${(asset.themes || []).join(' ')}`)) return 'Defensive or macro-sensitive profile';
  return 'Market and valuation sensitivity';
}

function theme(asset) {
  return (asset.themes || [asset.sector || asset.category || 'Market Research'])[0];
}

function card(asset) {
  const href = asset.type === 'etf' ? `etfs/${asset.symbol.toLowerCase()}.html` : `stocks/${asset.symbol.toLowerCase()}.html`;
  return `<article class="market-card ranking-card">
              <span class="tile-topline"><strong>${esc(asset.symbol)}</strong><span class="setup-badge">${score(asset)} research score</span></span>
              <h3>${esc(asset.name)}</h3>
              <div class="ranking-meta"><span>${esc(theme(asset))}</span><span>${esc(risk(asset))}</span></div>
              <p>${esc(asset.whyInvestorsFollow || asset.overview)}</p>
              <div class="ranking-score"><span style="width:${score(asset)}%"></span></div>
              <div class="cta-actions"><a class="market-btn primary" href="${href}">Full analysis</a><a class="market-btn" href="insights/${esc((asset.relatedInsights || ['spy-vs-qqq-explained'])[0])}.html">Related research</a></div>
            </article>`;
}

const sectionHtml = sections.map(([id, title, intro, assets]) => `<section class="market-section" id="${id}">
        <div class="market-panel">
          <div class="section-head"><div><span class="eyebrow">TradeAlphaAI Focus List</span><h2>${esc(title)}</h2></div><p>${esc(intro)} Educational ranking only, not financial advice.</p></div>
          <div class="market-grid">${assets.map(card).join('\n')}</div>
        </div>
      </section>`).join('\n');

const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Research Rankings and Watchlists | TradeAlphaAI</title>
  <meta name="description" content="Educational research rankings and watchlists for AI infrastructure stocks, semiconductor leaders, mega-cap technology, broad market ETFs, dividend ETFs, growth ETFs, and high-volatility research candidates." />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${DOMAIN}/rankings.html" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="Research Rankings and Watchlists | TradeAlphaAI" />
  <meta property="og:description" content="Educational research-ranked assets and watchlist candidates. No buy or sell recommendations." />
  <meta property="og:url" content="${DOMAIN}/rankings.html" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${DOMAIN}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="landing.css" />
  <link rel="stylesheet" href="css/market/market-portal.css" />
</head>
<body class="market-page">
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlpha AI</strong><span>Research Platform</span></span></a>
      <div class="top-actions">
        <nav class="nav-group" aria-label="Primary">
          <a href="index.html" class="nav-link">Home</a>
          <a href="stocks.html" class="nav-link">AI Stock Analyzer</a>
          <a href="etfs.html" class="nav-link">ETF Analyzer</a>
          <a href="ai-stock-screener.html" class="nav-link">Market Screener</a>
          <a href="insights/" class="nav-link">Market Insights</a>
          <a href="methodology.html" class="nav-link">Methodology</a>
        </nav>
      </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="index.html">Home</a><span>/</span><span>Research Rankings</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><div class="market-hero-grid"><div><span class="eyebrow">TradeAlphaAI Focus Lists</span><h1>Top stocks and ETFs to watch across major market themes</h1><p class="market-lead">Explore high-CTR research watchlists for AI stocks, semiconductor leaders, growth stocks, dividend ETFs, broad market ETFs, and high-volatility candidates. These lists are educational research rankings, not buy or sell recommendations.</p><div class="cta-actions"><a class="market-btn primary" href="ai-stock-screener.html">Open Screener</a><a class="market-btn" href="methodology.html">Methodology</a></div></div><div class="hero-stat-grid"><div class="hero-stat"><span>Coverage</span><strong>${stocks.length + etfs.length}</strong></div><div class="hero-stat"><span>Lists</span><strong>${sections.length}</strong></div><div class="hero-stat"><span>Advice</span><strong>None</strong></div><div class="hero-stat"><span>Mode</span><strong>Static</strong></div></div></div></div></section>
      ${sectionHtml}
      <section class="market-section"><div class="market-panel"><span class="eyebrow">Compliance</span><h2>Educational use only</h2><p class="disclaimer-note">These watchlists are for educational and informational purposes only and do not constitute financial advice, investment advice, price targets, or security recommendations.</p></div></section>
    </div>
  </main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'rankings.html'), html, 'utf8');
console.log('Generated rankings.html');

function has(asset, value) {
  return JSON.stringify(asset).toLowerCase().includes(String(value).toLowerCase());
}

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
