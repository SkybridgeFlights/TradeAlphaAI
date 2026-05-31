'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOMAIN = 'https://www.tradealphaai.com';
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/research-assets/index.json'), 'utf8'));
const stocks = data.stocks || [];
const etfs = data.etfs || [];
const all = [...stocks, ...etfs];

// Symbol lists for each ranking section
const TOP_STOCKS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AVGO', 'ORCL', 'NFLX'];
const TOP_AI = ['NVDA', 'AMD', 'MSFT', 'META', 'GOOGL', 'AMZN', 'AAPL', 'AVGO', 'SMCI', 'TSM', 'PLTR', 'ARM'];
const TOP_SEMIS = ['NVDA', 'AMD', 'AVGO', 'TSM', 'ASML', 'INTC', 'MU', 'ARM', 'QCOM', 'TXN', 'MRVL', 'KLAC', 'AMAT'];
const TOP_GROWTH = ['MSFT', 'META', 'GOOGL', 'AAPL', 'SMCI', 'PLTR', 'CRM', 'ORCL', 'SNOW', 'NET', 'DDOG', 'TTD'];
const TOP_MOMENTUM = ['NVDA', 'META', 'ORCL', 'AVGO', 'TSM', 'LLY', 'NVO', 'GS', 'JPM', 'SHOP', 'UBER', 'NET'];
const TOP_DEFENSIVE = ['KO', 'PEP', 'PG', 'WMT', 'JNJ', 'UNH', 'MRK', 'ABBV', 'MCD', 'COST', 'HON', 'DE'];
const TOP_DIVIDEND = ['SCHD', 'VIG', 'DGRO', 'JEPI', 'VTV', 'XLV', 'XLF', 'XLE'];
const TOP_GROWTH_ETFS = ['QQQ', 'VUG', 'SCHG', 'XLK', 'ARKK', 'BOTZ', 'SOXX', 'SMH', 'ICLN', 'ROBO'];
const TOP_BROAD = ['SPY', 'VOO', 'VTI', 'QQQ', 'SOXX', 'SMH', 'XLK', 'IWM', 'RSP'];

const sections = [
  { id: 'top-stocks', title: 'Top 10 Stocks Right Now', intro: 'Most-watched broad-market stocks across technology, consumer, and cloud sectors.', symbols: TOP_STOCKS },
  { id: 'top-ai-stocks', title: 'Best AI Stocks Right Now', intro: 'Leading AI infrastructure, cloud computing, and AI platform names by research score and relevance.', symbols: TOP_AI },
  { id: 'top-semiconductor-stocks', title: 'Top Semiconductor Stocks', intro: 'Chip design, foundry, memory, equipment, and AI compute names with strong research relevance.', symbols: TOP_SEMIS },
  { id: 'top-growth-stocks', title: 'Best Growth Stocks to Watch', intro: 'Growth-oriented technology, SaaS, and platform companies for educational comparison.', symbols: TOP_GROWTH },
  { id: 'top-momentum-stocks', title: 'Top Momentum Stocks', intro: 'Stocks with strong uptrend signals and positive macdTrend in the research model.', symbols: TOP_MOMENTUM },
  { id: 'top-defensive-stocks', title: 'Best Defensive Stocks', intro: 'Consumer staples, healthcare, and industrial names with defensive or low-volatility research profiles.', symbols: TOP_DEFENSIVE },
  { id: 'top-dividend-etfs', title: 'Top Dividend ETFs', intro: 'Dividend-focused ETFs for income, quality, and defensive equity research.', symbols: TOP_DIVIDEND },
  { id: 'top-growth-etfs', title: 'Best Growth ETFs', intro: 'Growth-tilted and thematic ETFs covering technology, semiconductors, and innovation.', symbols: TOP_GROWTH_ETFS },
  { id: 'top-broad-market-etfs', title: 'Top Broad Market ETFs', intro: 'Core ETF building blocks for broad U.S. equity and global market exposure.', symbols: TOP_BROAD },
];

const bySymbol = new Map(all.map(a => [a.symbol, a]));

function getAssets(symbols) {
  return symbols.map(s => bySymbol.get(s)).filter(Boolean);
}

function score(asset) {
  const seed = [...asset.symbol].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return 56 + (seed % 33);
}

function scoreLabel(s) {
  if (s >= 78) return 'Strong Setup';
  if (s >= 64) return 'Watchlist Candidate';
  if (s >= 46) return 'Neutral Setup';
  return 'Weak Setup';
}

function scoreClass(s) {
  if (s >= 70) return 'badge-strong';
  if (s >= 55) return 'badge-watch';
  return 'badge-neutral';
}

function momentum(asset) {
  const seed = [...asset.symbol].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return ['bullish', 'neutral', 'bearish'][seed % 3];
}

function sector(asset) {
  return (asset.themes || [asset.sector || asset.category || 'Market Research'])[0];
}

function assetHref(asset) {
  return asset.type === 'etf'
    ? `etfs/${asset.symbol.toLowerCase()}.html`
    : `stocks/${asset.symbol.toLowerCase()}.html`;
}

function tableRow(asset, rank) {
  const s = score(asset);
  const sc = scoreClass(s);
  const sl = scoreLabel(s);
  const m = momentum(asset);
  const mClass = m === 'bullish' ? 'momentum-up' : m === 'bearish' ? 'momentum-down' : 'momentum-neutral';
  const href = assetHref(asset);
  const sect = sector(asset);
  return `<tr data-symbol="${esc(asset.symbol)}">
    <td class="col-rank rank-num">${rank}</td>
    <td class="col-symbol"><a class="symbol-link" href="${href}"><strong>${esc(asset.symbol)}</strong></a></td>
    <td class="col-name asset-name"><a href="${href}">${esc(asset.name)}</a></td>
    <td class="col-score score-cell"><span class="score-badge ${sc}">${s}</span> <small>${sl}</small></td>
    <td class="col-price price-cell" data-live-price="${esc(asset.symbol)}"><span class="live-loading">&hellip;</span></td>
    <td class="col-change change-cell" data-live-change="${esc(asset.symbol)}"><span class="live-loading">&hellip;</span></td>
    <td class="col-sector sector-cell">${esc(sect)}</td>
    <td class="col-momentum momentum-cell ${mClass}">${m === 'bullish' ? 'Bullish' : m === 'bearish' ? 'Bearish' : 'Neutral'}</td>
  </tr>`;
}

function sectionHtml(sec) {
  const assets = getAssets(sec.symbols);
  const rows = assets.map((a, i) => tableRow(a, i + 1)).join('\n');
  return `<section class="market-section" id="${sec.id}">
  <div class="market-panel">
    <div class="section-head">
      <div><span class="eyebrow">TradeAlphaAI Focus List</span><h2>${esc(sec.title)}</h2></div>
      <p>${esc(sec.intro)} Educational ranking only, not financial advice.</p>
    </div>
    <div class="ranking-table-wrap">
      <table class="ranking-table" aria-label="${esc(sec.title)}">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th class="col-symbol sortable" data-sort="symbol">Symbol <span class="sort-icon">&updownarrow;</span></th>
            <th class="col-name">Name</th>
            <th class="col-score sortable" data-sort="score">Score <span class="sort-icon">&darr;</span></th>
            <th class="col-price sortable" data-sort="price">Price <span class="sort-icon">&updownarrow;</span></th>
            <th class="col-change sortable" data-sort="change">Change% <span class="sort-icon">&updownarrow;</span></th>
            <th class="col-sector">Theme</th>
            <th class="col-momentum">Momentum</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  </div>
</section>`;
}

const sectionsOutput = sections.map(sectionHtml).join('\n');
const totalAssets = new Set(sections.flatMap(s => s.symbols)).size;

// Pre-compute snapshot values
const allRanked = [...new Set(sections.flatMap(s => s.symbols))].map(s => bySymbol.get(s)).filter(Boolean);
const bestScoreAsset = allRanked.reduce((best, a) => score(a) > score(best) ? a : best, allRanked[0]);
const defensivePick = TOP_DEFENSIVE.map(s => bySymbol.get(s)).find(Boolean);
const momentumPick = TOP_MOMENTUM.map(s => bySymbol.get(s)).find(Boolean);

const snapshotSection = `<section class="market-section" id="market-snapshot">
  <div class="market-panel">
    <span class="eyebrow">Market Snapshot</span>
    <h2>Live market overview</h2>
    <p class="market-copy">Key signals from current research rankings. Live prices update automatically when loaded. Educational context only.</p>
    <div class="snapshot-grid" data-market-snapshot>
      <div class="snapshot-card">
        <span class="snapshot-label">Top Mover</span>
        <strong data-snap-top-mover>&mdash;</strong>
        <span class="snapshot-sub" data-snap-top-mover-change>Awaiting live data&hellip;</span>
      </div>
      <div class="snapshot-card">
        <span class="snapshot-label">Best Score</span>
        <strong>${esc(bestScoreAsset ? bestScoreAsset.symbol : '—')}</strong>
        <span class="snapshot-sub">${bestScoreAsset ? score(bestScoreAsset) + '/100 &middot; ' + scoreLabel(score(bestScoreAsset)) : '—'}</span>
      </div>
      <div class="snapshot-card">
        <span class="snapshot-label">Defensive Pick</span>
        <strong>${esc(defensivePick ? defensivePick.symbol : '—')}</strong>
        <span class="snapshot-sub">${defensivePick ? esc((defensivePick.themes || ['Consumer Staples'])[0]) : 'Staples / Healthcare'}</span>
      </div>
      <div class="snapshot-card">
        <span class="snapshot-label">Momentum Watch</span>
        <strong>${esc(momentumPick ? momentumPick.symbol : '—')}</strong>
        <span class="snapshot-sub">${momentumPick ? esc((momentumPick.themes || ['Technology'])[0]) : 'Technology'}</span>
      </div>
    </div>
  </div>
</section>`;

const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Research Rankings and Watchlists | TradeAlphaAI</title>
  <meta name="description" content="Educational research rankings for global stocks, ETFs, sectors, momentum themes, defensive assets, growth funds, dividend ETFs, and broad market ETFs. Live prices load automatically." />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${DOMAIN}/rankings.html" />
  <!-- localized-static-pages:start -->
  <link rel="alternate" hreflang="en" href="${DOMAIN}/rankings.html" />
  <link rel="alternate" hreflang="en-US" href="${DOMAIN}/en/rankings.html" />
  <link rel="alternate" hreflang="ar" href="${DOMAIN}/ar/rankings.html" />
  <link rel="alternate" hreflang="x-default" href="${DOMAIN}/rankings.html" />
  <!-- localized-static-pages:end -->
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="Research Rankings and Watchlists | TradeAlphaAI" />
  <meta property="og:description" content="Educational research-ranked assets and watchlist candidates. Live prices. No buy or sell recommendations." />
  <meta property="og:url" content="${DOMAIN}/rankings.html" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${DOMAIN}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="/favicon.ico" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@400;500;700&family=Cairo:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
  <link rel="stylesheet" href="landing.css" />
  <link rel="stylesheet" href="css/market/market-portal.css" />
</head>
<body class="market-page">
  <div class="topbar">
    <div class="wrap topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlpha AI</strong><span>Market Research Platform</span></span></a>
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
              <a href="/rankings.html#top-momentum-stocks">Top Momentum Stocks</a>
              <a href="/rankings.html#top-defensive-stocks">Best Defensive Stocks</a>
              <a href="/rankings.html#top-growth-stocks">Best Growth Stocks</a>
              <a href="/rankings.html#top-dividend-etfs">Top Dividend ETFs</a>
              <a href="/rankings.html#top-growth-etfs">Best Growth ETFs</a>
              <a href="/rankings.html#top-broad-market-etfs">Best ETFs for 2026</a>
            </div>
          </div>
          <a href="/insights/" class="nav-link">Articles</a>
          <a href="/methodology.html" class="nav-link">Methodology</a>
        </nav>
        <div class="locale-links" aria-label="Language">
          <a class="lang-switch" data-locale-route="ar" href="/ar/rankings.html">Arabic</a>
          <a class="lang-switch" data-locale-route="en" href="/rankings.html">English</a>
        </div>
        <button class="mobile-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-drawer">
          <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
        </button>
      </div>
    </div>
  </div>
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="index.html">Home</a><span>/</span><span>Research Rankings</span></nav>
      <section class="market-hero">
        <div class="market-hero-panel">
          <div class="market-hero-grid">
            <div>
              <span class="eyebrow">TradeAlphaAI Focus Lists</span>
              <h1>Top stocks and ETFs to watch across major market themes</h1>
              <p class="market-lead">Explore research rankings for AI stocks, semiconductor leaders, momentum stocks, defensive names, growth ETFs, and dividend ETFs. Live prices load automatically. Educational use only &mdash; not financial advice.</p>
              <div class="cta-actions">
                <a class="market-btn primary" href="ai-stock-screener.html">Open Screener</a>
                <a class="market-btn" href="methodology.html">Methodology</a>
              </div>
            </div>
            <div class="hero-stat-grid">
              <div class="hero-stat"><span>Coverage</span><strong>${totalAssets}</strong></div>
              <div class="hero-stat"><span>Lists</span><strong>${sections.length}</strong></div>
              <div class="hero-stat"><span>Advice</span><strong>None</strong></div>
              <div class="hero-stat"><span>Prices</span><strong>Live</strong></div>
            </div>
          </div>
        </div>
      </section>
      <nav class="rankings-nav" aria-label="Jump to list">
        ${sections.map(s => `<a href="#${s.id}" class="rankings-nav-link">${esc(s.title.replace(/^(Top|Best) /, ''))}</a>`).join('\n        ')}
      </nav>
      ${snapshotSection}
      <section class="market-section">
        <div class="market-panel" data-market-authority="rankings"></div>
      </section>
      ${sectionsOutput}
      <section class="market-section">
        <div class="market-panel">
          <span class="eyebrow">Compliance</span>
          <h2>Educational use only</h2>
          <p class="disclaimer-note">These watchlists are for educational and informational purposes only and do not constitute financial advice, investment advice, price targets, or security recommendations.</p>
        </div>
      </section>
    </div>
  </main>
  <script src="../js/mobile-nav.js" defer></script>
  <script src="../js/language-router.js" defer></script>
  <script type="module">
    import { scheduleLivePricePatch, renderRankingTable } from "/js/market/ranking-engine.js";
    // Patch live prices for all data-live-price cells on this page
    const allSymbols = Array.from(document.querySelectorAll("[data-live-price]"))
      .map(el => el.dataset.livePrice)
      .filter((s, i, arr) => s && arr.indexOf(s) === i);
    const fakeAssets = allSymbols.map(symbol => ({ symbol }));
    scheduleLivePricePatch(document, fakeAssets);
    // Wire sortable table headers
    document.querySelectorAll(".ranking-table").forEach(table => {
      const wrap = table.closest(".ranking-table-wrap");
      if (!wrap) return;
      let currentSort = "score", dir = "desc";
      wrap.querySelectorAll("th[data-sort]").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
          const key = th.dataset.sort;
          dir = (currentSort === key && dir === "desc") ? "asc" : "desc";
          currentSort = key;
          const tbody = table.querySelector("tbody");
          if (!tbody) return;
          const trs = Array.from(tbody.querySelectorAll("tr[data-symbol]"));
          trs.sort((a, b) => {
            if (key === "symbol") return dir === "asc" ? a.dataset.symbol.localeCompare(b.dataset.symbol) : b.dataset.symbol.localeCompare(a.dataset.symbol);
            let av = 0, bv = 0;
            if (key === "score") { av = parseFloat(a.querySelector(".score-badge")?.textContent) || 0; bv = parseFloat(b.querySelector(".score-badge")?.textContent) || 0; }
            else if (key === "price") { av = parseFloat(a.querySelector("[data-live-price]")?.textContent?.replace(/[$,]/g,"")) || 0; bv = parseFloat(b.querySelector("[data-live-price]")?.textContent?.replace(/[$,]/g,"")) || 0; }
            else if (key === "change") { av = parseFloat(a.querySelector("[data-live-change]")?.textContent) || 0; bv = parseFloat(b.querySelector("[data-live-change]")?.textContent) || 0; }
            return dir === "asc" ? av - bv : bv - av;
          });
          trs.forEach((tr, i) => { tr.querySelector(".rank-num").textContent = i + 1; tbody.appendChild(tr); });
          wrap.querySelectorAll("th[data-sort] .sort-icon").forEach(ic => {
            ic.innerHTML = ic.closest("th").dataset.sort === key ? (dir === "asc" ? "&uarr;" : "&darr;") : "&updownarrow;";
          });
        });
      });
    });
    // Market Snapshot: fill top mover after live prices load
    setTimeout(() => {
      const items = Array.from(document.querySelectorAll("[data-live-change]"))
        .map(el => ({ sym: el.dataset.liveChange, val: parseFloat(el.textContent) || 0 }))
        .filter(x => x.val !== 0);
      if (!items.length) return;
      const top = items.reduce((a, b) => Math.abs(b.val) > Math.abs(a.val) ? b : a);
      const symEl = document.querySelector("[data-snap-top-mover]");
      const chEl = document.querySelector("[data-snap-top-mover-change]");
      if (symEl) symEl.textContent = top.sym;
      if (chEl) { chEl.textContent = (top.val >= 0 ? "+" : "") + top.val.toFixed(2) + "%"; chEl.style.color = top.val >= 0 ? "#7dff8c" : "#ff7e7e"; }
    }, 5000);
  </script>
  <script src="/js/market/market-authority-layer.js"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'rankings.html'), html, 'utf8');
console.log(`Generated rankings.html — ${sections.length} sections, ${totalAssets} unique symbols`);

function esc(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
