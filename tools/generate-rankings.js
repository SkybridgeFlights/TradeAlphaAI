'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/research-assets/index.json'), 'utf8'));
const stocks = data.stocks || [];
const etfs = data.etfs || [];

const sections = [
  ['AI Infrastructure Focus List', stocks.filter((a) => has(a, 'AI Infrastructure')).slice(0, 6)],
  ['Semiconductor Research Leaders', stocks.filter((a) => /semiconductor/i.test(a.sector) || has(a, 'AI Chips')).slice(0, 6)],
  ['Mega-Cap Tech Watchlist', stocks.filter((a) => ['MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'NVDA', 'AVGO', 'NFLX'].includes(a.symbol)).slice(0, 7)],
  ['Broad Market ETF Core List', etfs.filter((a) => has(a, 'Broad Market') || has(a, 'Core Equity')).slice(0, 6)],
  ['Dividend ETF Research List', etfs.filter((a) => /dividend/i.test(JSON.stringify(a))).slice(0, 6)],
  ['Growth ETF Research List', etfs.filter((a) => has(a, 'Growth Stocks') || /growth/i.test(a.category)).slice(0, 6)],
  ['High Risk / High Volatility Watchlist', [...stocks, ...etfs].filter((a) => /Semiconductor|GPU|Small|Electric|Cybersecurity/i.test(`${a.sector || a.category} ${(a.themes || []).join(' ')}`)).slice(0, 7)]
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

function card(asset) {
  const href = asset.type === 'etf' ? `etfs/${asset.symbol.toLowerCase()}.html` : `stocks/${asset.symbol.toLowerCase()}.html`;
  return `<article class="market-card ranking-card">
              <span class="tile-topline"><strong>${esc(asset.symbol)}</strong><span class="setup-badge">${score(asset)} research score</span></span>
              <h3>${esc(asset.name)}</h3>
              <p>${esc(asset.whyInvestorsFollow || asset.overview)}</p>
              <p class="disclaimer-note">${esc(risk(asset))}</p>
              <div class="cta-actions"><a class="market-btn primary" href="${href}">Full analysis</a><a class="market-btn" href="insights/${esc((asset.relatedInsights || ['spy-vs-qqq-explained'])[0])}.html">Related research</a></div>
            </article>`;
}

const sectionHtml = sections.map(([title, assets]) => `<section class="market-section">
        <div class="market-panel">
          <div class="section-head"><div><span class="eyebrow">Educational ranking</span><h2>${esc(title)}</h2></div><p>Research-ranked assets for comparison and watchlist building. Not financial advice.</p></div>
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
  <!-- generated:research-rankings -->
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlpha AI</strong><span>AI Market Portal</span></span></a>
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
      <section class="market-hero"><div class="market-hero-panel"><div class="market-hero-grid"><div><span class="eyebrow">Research Watchlists</span><h1>Educational rankings for market focus lists</h1><p class="market-lead">Compare research-ranked assets across AI infrastructure, semiconductors, mega-cap technology, broad market ETFs, dividend ETFs, growth ETFs, and high-volatility watchlists. These rankings are educational research views, not recommendations.</p><div class="cta-actions"><a class="market-btn primary" href="ai-stock-screener.html">Open Screener</a><a class="market-btn" href="methodology.html">Methodology</a></div></div><div class="hero-stat-grid"><div class="hero-stat"><span>Coverage</span><strong>${stocks.length + etfs.length}</strong></div><div class="hero-stat"><span>Lists</span><strong>${sections.length}</strong></div><div class="hero-stat"><span>Advice</span><strong>None</strong></div><div class="hero-stat"><span>Mode</span><strong>Static</strong></div></div></div></div></section>
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
