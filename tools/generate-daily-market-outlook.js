'use strict';

// Phase 60.2: Daily Market Outlook Generator
// Generates static HTML briefing pages for:
//   - Pre-event previews (upcoming high-impact events with scenario framing)
//   - Post-event summaries (recent releases with surprise analysis)
//   - Weekly macro outlook (rolling 7-day window)
//
// Pages are generated to:
//   market-outlook/daily/YYYY-MM-DD.html   (daily)
//   market-outlook/weekly/YYYY-Www.html    (weekly)
//
// Inputs:
//   data/economic-calendar.json
//   data/intelligence/event-reaction-memory.json
//   data/intelligence/macro-narrative.json
//   data/live-market-state.json
//   data/market-expectations.json
//
// Usage:
//   node tools/generate-daily-market-outlook.js               → dry run (print summary)
//   node tools/generate-daily-market-outlook.js --write       → write HTML files
//   node tools/generate-daily-market-outlook.js --mode=weekly → weekly briefing
//   node tools/generate-daily-market-outlook.js --force       → overwrite existing

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const CAL_PATH      = path.join(ROOT, 'data', 'economic-calendar.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const EXPECT_PATH   = path.join(ROOT, 'data', 'market-expectations.json');
const DAILY_DIR     = path.join(ROOT, 'market-outlook', 'daily');
const WEEKLY_DIR    = path.join(ROOT, 'market-outlook', 'weekly');

const SITE_URL      = 'https://www.tradealphaai.com';
const WRITE         = process.argv.includes('--write');
const FORCE         = process.argv.includes('--force');
const MODE          = argValue('--mode') || 'daily';

const DISCLAIMER_EN = 'This is educational macro commentary only. It is not investment advice, a recommendation to buy or sell any asset, or a forecast. Past event reactions do not reliably predict future outcomes. Always consult a licensed financial professional before making investment decisions.';

function main() {
  const calendar    = readJson(CAL_PATH,       { events: [] });
  const memory      = readJson(MEMORY_PATH,    { event_reactions: [], historical_patterns: {} });
  const narrative   = readJson(NARRATIVE_PATH, { release_narratives: [], preview_narratives: [], active_themes: [] });
  const live        = readJson(LIVE_PATH,      { metadata: { status: 'fallback' } });
  const expectations = readJson(EXPECT_PATH,   { expectations: [] });

  const today    = new Date().toISOString().slice(0, 10);
  const weekSlug = weekLabel();

  if (MODE === 'weekly') {
    const html = buildWeeklyPage(calendar, memory, narrative, live, expectations, weekSlug);
    outputPage(html, path.join(WEEKLY_DIR, `${weekSlug}.html`), `Weekly macro outlook ${weekSlug}`);
  } else {
    const html = buildDailyPage(calendar, memory, narrative, live, expectations, today);
    outputPage(html, path.join(DAILY_DIR, `${today}.html`), `Daily macro briefing ${today}`);
  }
}

function outputPage(html, filePath, label) {
  if (!WRITE) {
    console.log(`[daily-outlook] Dry run — would write ${path.relative(ROOT, filePath).replaceAll('\\', '/')}`);
    console.log(`[daily-outlook] ${label}: ${html.length} chars`);
    return;
  }
  if (!FORCE && fs.existsSync(filePath)) {
    console.log(`[daily-outlook] Already exists: ${path.relative(ROOT, filePath).replaceAll('\\', '/')} — use --force to overwrite`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`[daily-outlook] Wrote ${path.relative(ROOT, filePath).replaceAll('\\', '/')}`);
}

// ── Daily page builder ────────────────────────────────────────────────────────

function buildDailyPage(calendar, memory, narrative, live, expectations, today) {
  const events = calendar.events || [];
  const now    = Date.now();

  const todayEvents = events.filter((e) => (e.event_time || e.date || '').slice(0, 10) === today);
  const released    = events.filter((e) => e.status === 'released' && e.actual !== null
    && Date.parse(e.event_time || e.date) >= now - 2 * 86400000);
  const upcoming    = events.filter((e) => e.status === 'scheduled' && e.importance === 'high'
    && Date.parse(e.event_time || e.date) > now
    && Date.parse(e.event_time || e.date) <= now + 3 * 86400000)
    .sort((a, b) => Date.parse(a.event_time || a.date) - Date.parse(b.event_time || b.date));

  const relNarratives  = narrative.release_narratives || [];
  const prevNarratives = narrative.preview_narratives || [];
  const themes         = narrative.active_themes || [];
  const liveValid      = live?.metadata?.status === 'live';

  const dateFormatted = new Date(today + 'T12:00:00Z')
    .toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const slug = `macro-briefing-${today}`;
  const title = `Daily Macro Briefing — ${dateFormatted}`;
  const description = buildPageDescription(released, upcoming, themes);

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${SITE_URL}/market-outlook/daily/${today}.html" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/market-outlook/daily/${today}.html" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)} | TradeAlphaAI" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${SITE_URL}/market-outlook/daily/${today}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)} | TradeAlphaAI" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="stylesheet" href="../../styles.css" />
  <link rel="stylesheet" href="../../landing.css" />
  <link rel="stylesheet" href="../../css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  ${buildJsonLd(title, description, today, slug)}
</head>
<body class="market-page">
  ${buildNavBar()}
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/market-outlook/">Market Outlook</a><span>/</span><span>Daily Briefing</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">Daily Macro Briefing</span>
          <h1>${esc(dateFormatted)}</h1>
          <p class="market-lead">${esc(description)}</p>
          ${themes.length ? `<div class="market-outlook-index-tools">${themes.map((t) => `<span class="market-filter-chip">${esc(t.replace(/_/g, ' '))}</span>`).join('')}</div>` : ''}
        </div>
      </section>

      ${narrative.regime_narrative ? `<section class="market-section"><div class="narrative-callout">${esc(narrative.regime_narrative)}</div></section>` : ''}

      ${relNarratives.length ? buildReleasedSection(relNarratives, released) : ''}
      ${prevNarratives.length ? buildUpcomingSection(prevNarratives, upcoming) : ''}
      ${!relNarratives.length && !prevNarratives.length ? buildNoDataSection(upcoming, released) : ''}

      ${buildReactionMapSection()}

      <section class="market-section disclaimer-section">
        <div class="disclaimer-box">
          <h3>Educational Research Disclaimer</h3>
          <p>${esc(DISCLAIMER_EN)}</p>
        </div>
      </section>
    </div>
  </main>
  ${buildFooter()}
</body>
</html>`;
}

// ── Weekly page builder ───────────────────────────────────────────────────────

function buildWeeklyPage(calendar, memory, narrative, live, expectations, weekSlug) {
  const events    = calendar.events || [];
  const now       = Date.now();
  const weekMs    = 7 * 86400000;

  const weekEvents = events.filter((e) => {
    const t = Date.parse(e.event_time || e.date);
    return t >= now && t <= now + weekMs && e.importance === 'high';
  }).sort((a, b) => Date.parse(a.event_time || a.date) - Date.parse(b.event_time || b.date));

  const relNarratives  = (narrative.release_narratives || []).slice(-5);
  const prevNarratives = (narrative.preview_narratives || []).slice(0, 6);
  const patterns       = memory.historical_patterns || {};
  const themes         = narrative.active_themes || [];

  const title = `Weekly Macro Outlook — ${weekSlug}`;
  const description = `Educational macro event preview and cross-asset scenario framework for the week of ${weekSlug}. High-impact releases, historical sensitivity, and transmission chain analysis.`;

  return `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)} | TradeAlphaAI</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${SITE_URL}/market-outlook/weekly/${weekSlug}.html" />
  <link rel="alternate" hreflang="en" href="${SITE_URL}/market-outlook/weekly/${weekSlug}.html" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)} | TradeAlphaAI" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${SITE_URL}/market-outlook/weekly/${weekSlug}.html" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE_URL}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)} | TradeAlphaAI" />
  <meta name="twitter:description" content="${esc(description)}" />
  <link rel="stylesheet" href="../../styles.css" />
  <link rel="stylesheet" href="../../landing.css" />
  <link rel="stylesheet" href="../../css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  ${buildJsonLd(title, description, new Date().toISOString().slice(0, 10), `weekly-${weekSlug}`)}
</head>
<body class="market-page">
  ${buildNavBar()}
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><a href="/market-outlook/">Market Outlook</a><span>/</span><span>Weekly Outlook</span></nav>

      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">Weekly Macro Outlook</span>
          <h1>Event Calendar &amp; Scenario Framework — ${esc(weekSlug)}</h1>
          <p class="market-lead">${esc(description)}</p>
          ${themes.length ? `<div class="market-outlook-index-tools">${themes.slice(0, 5).map((t) => `<span class="market-filter-chip">${esc(t.replace(/_/g, ' '))}</span>`).join('')}</div>` : ''}
        </div>
      </section>

      <section class="market-section">
        <h2 class="section-heading">High-Impact Events This Week</h2>
        ${weekEvents.length ? buildWeekEventTable(weekEvents, prevNarratives) : '<p class="calendar-empty">No high-impact events scheduled in the current calendar for this week.</p>'}
      </section>

      ${prevNarratives.length ? buildUpcomingSection(prevNarratives, weekEvents) : ''}
      ${relNarratives.length  ? buildReleasedSection(relNarratives, []) : ''}

      ${buildHistoricalSensitivitySection(patterns)}
      ${buildReactionMapSection()}

      <section class="market-section disclaimer-section">
        <div class="disclaimer-box">
          <h3>Educational Research Disclaimer</h3>
          <p>${esc(DISCLAIMER_EN)}</p>
        </div>
      </section>
    </div>
  </main>
  ${buildFooter()}
</body>
</html>`;
}

// ── HTML section builders ─────────────────────────────────────────────────────

function buildReleasedSection(narratives, events) {
  const items = narratives.map((n) => `
    <div class="outlook-card">
      <div class="outlook-card-header">
        <span class="eyebrow">${esc(n.event_type || '')}</span>
        <span class="outlook-date">${esc(n.event_date || '')}</span>
        ${surpriseBadge(n.surprise_direction)}
      </div>
      <h3>${esc(n.event_name)}</h3>
      <div class="outlook-body">${n.narrative_blocks.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
      ${n.evidence_sources?.length ? `<div class="source-line">Sources: ${n.evidence_sources.map(esc).join(' · ')}</div>` : ''}
    </div>`).join('');

  return `<section class="market-section" id="recent-releases">
    <h2 class="section-heading">Recent Releases — Surprise Analysis</h2>
    <div class="outlook-grid">${items}</div>
  </section>`;
}

function buildUpcomingSection(narratives, events) {
  const items = narratives.map((n) => `
    <div class="outlook-card outlook-preview">
      <div class="outlook-card-header">
        <span class="eyebrow">${esc(n.event_type || '')}</span>
        <span class="outlook-date">${esc(fmtEventTime(n.event_time))}</span>
        <span class="impact-badge badge-high">high impact</span>
      </div>
      <h3>${esc(n.event_name)}</h3>
      ${n.forecast !== null && n.forecast !== undefined ? `<p class="consensus-line">Consensus: <strong>${n.forecast}</strong>${n.previous !== null ? ` · Prior: ${n.previous}` : ''}</p>` : ''}
      <div class="outlook-body">${n.narrative_blocks.map((b) => `<p>${esc(b)}</p>`).join('')}</div>
      ${n.confirmation_assets?.length ? `<div class="asset-tags">${n.confirmation_assets.slice(0, 6).map((a) => `<span class="asset-tag">${esc(a)}</span>`).join('')}</div>` : ''}
    </div>`).join('');

  return `<section class="market-section" id="upcoming-events">
    <h2 class="section-heading">Upcoming High-Impact Releases</h2>
    <div class="outlook-grid">${items}</div>
  </section>`;
}

function buildNoDataSection(upcoming, released) {
  return `<section class="market-section">
    <div class="narrative-callout">
      ${upcoming.length
        ? `${upcoming.length} high-impact event(s) upcoming in the next 72 hours. Calendar data will populate after the events are released and actual values are available.`
        : 'No high-impact events in the immediate calendar window. Monitor the economic calendar for scheduled releases.'}
    </div>
  </section>`;
}

function buildWeekEventTable(events, narratives) {
  const rows = events.map((e) => {
    const narr = narratives.find((n) => n.event_id === e.id || n.event_name === e.event_name);
    return `<tr>
      <td class="cal-time">${esc(fmtEventTime(e.event_time))}</td>
      <td><strong>${esc(e.event_name)}</strong><br><small>${esc(e.country || '')}</small></td>
      <td><span class="impact-badge badge-high">high</span></td>
      <td class="cal-num">${e.forecast !== null && e.forecast !== undefined ? e.forecast : '—'}</td>
      <td class="cal-num">${e.previous !== null && e.previous !== undefined ? e.previous : '—'}</td>
      <td class="cal-narrative">${esc(narr?.narrative_blocks?.[0]?.slice(0, 120) || '—')}</td>
    </tr>`;
  }).join('');
  return `<table class="calendar-table"><thead><tr><th>Time (ET)</th><th>Event</th><th>Impact</th><th>Forecast</th><th>Previous</th><th>Context</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildHistoricalSensitivitySection(patterns) {
  if (!Object.keys(patterns).length) return '';
  const cards = Object.entries(patterns).map(([type, data]) => {
    if (!data || !data.total_events) return '';
    const hotter = data.hotter_than_expected;
    const softer = data.softer_than_expected;
    const assetLines = [];
    if (hotter?.asset_reactions) {
      for (const [label, info] of Object.entries(hotter.asset_reactions)) {
        if (info?.sample_size >= 3 && info.consistency !== 'mixed' && info.consistency !== 'insufficient_data') {
          const dir = info.avg_1d_pct > 0 ? '↑' : '↓';
          assetLines.push(`<li>${esc(label)}: ${dir} avg ${info.avg_1d_pct > 0 ? '+' : ''}${info.avg_1d_pct}% on hot print (${info.sample_size} events, ${info.consistency.replace(/_/g, ' ')})</li>`);
        }
      }
    }
    return `<div class="reaction-card">
      <h3>${esc(type)}</h3>
      <p><small>${data.total_events} events in memory</small></p>
      ${assetLines.length ? `<ul>${assetLines.slice(0, 4).join('')}</ul>` : '<p><small>Insufficient history for pattern analysis</small></p>'}
    </div>`;
  }).filter(Boolean);

  if (!cards.length) return '';
  return `<section class="market-section" id="historical-sensitivity">
    <h2 class="section-heading">Historical Sensitivity Patterns</h2>
    <p class="section-intro">Average 1-day asset reactions to above-consensus prints, based on the event reaction memory database.</p>
    <div class="reaction-grid">${cards.join('')}</div>
  </section>`;
}

function buildReactionMapSection() {
  return `<section class="market-section" id="asset-reaction-map">
    <h2 class="section-heading">Cross-Asset Transmission Reference</h2>
    <p class="section-intro">These are educational scenario frameworks, not predictions. Confirmation requires yield, dollar, and breadth signals to align.</p>
    <div class="reaction-grid">
      <div class="reaction-card">
        <h3>CPI / PCE (Inflation)</h3>
        <ul>
          <li>Hot print → yields ↑, DXY firms, TLT ↓, QQQ duration headwind, Gold mixed</li>
          <li>Soft print → yields ↓, TLT ↑, QQQ relief, DXY softer, Gold benefits</li>
          <li>Key: Treasury yield move confirms, not just equity reaction</li>
        </ul>
      </div>
      <div class="reaction-card">
        <h3>NFP / Unemployment (Labor)</h3>
        <ul>
          <li>Strong → hawkish re-pricing, IWM financing sensitivity, VIX may rise</li>
          <li>Weak → dovish impulse, but recession risk concurrent</li>
          <li>Key: IWM participation confirms risk-on vs recession-fear divergence</li>
        </ul>
      </div>
      <div class="reaction-card">
        <h3>FOMC / Central Banks</h3>
        <ul>
          <li>Hawkish surprise → DXY up, EM/Gold stress, TLT pressure</li>
          <li>Dovish surprise → TLT, QQQ, Gold can all move constructively</li>
          <li>Key: dot plot shifts and forward guidance carry more signal than the decision</li>
        </ul>
      </div>
      <div class="reaction-card">
        <h3>GDP / ISM / Retail Sales</h3>
        <ul>
          <li>Above consensus → cyclicals lead, IWM and financials benefit</li>
          <li>Below consensus → bond proxies, Gold, defensive sectors respond</li>
          <li>Key: ISM below 50 for 3+ months → recession-watch regime shift</li>
        </ul>
      </div>
    </div>
  </section>`;
}

// ── JSON-LD structured data ───────────────────────────────────────────────────

function buildJsonLd(title, description, date, slug) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: title,
        description,
        datePublished: date,
        dateModified: new Date().toISOString().slice(0, 10),
        url: `${SITE_URL}/market-outlook/daily/${date}.html`,
        inLanguage: 'en',
        publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: SITE_URL }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: SITE_URL + '/' },
          { '@type': 'ListItem', position: 2, name: 'Market Outlook', item: SITE_URL + '/market-outlook/' },
          { '@type': 'ListItem', position: 3, name: 'Daily Briefing', item: `${SITE_URL}/market-outlook/daily/${date}.html` }
        ]
      }
    ]
  };
  return `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
}

// ── Nav / footer shared HTML ──────────────────────────────────────────────────

function buildNavBar() {
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>Research Platform</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="Primary"><a href="/" class="nav-link">Home</a><a href="/stocks.html" class="nav-link">Global Stock Research</a><a href="/etfs.html" class="nav-link">ETF Analyzer</a><a href="/rankings.html" class="nav-link">Rankings</a><a href="/insights/" class="nav-link">Articles</a><a href="/market-outlook/" class="nav-link">Market Outlook</a><a href="/economic-calendar/" class="nav-link">Economic Calendar</a><a href="/methodology.html" class="nav-link">Methodology</a></nav><div class="locale-links" aria-label="Language"><a class="lang-switch" data-locale-route="ar" href="/ar/market-outlook/">Arabic</a><a class="lang-switch active" data-locale-route="en" href="/market-outlook/">English</a></div></div></div></div>`;
}

function buildFooter() {
  return `<footer class="site-footer"><div class="wrap footer-inner"><p>&copy; 2026 TradeAlphaAI. Educational research only. Not financial advice.</p><nav class="footer-nav" aria-label="Footer"><a href="/methodology.html">Methodology</a><a href="/economic-calendar/">Economic Calendar</a><a href="/market-outlook/">Market Outlook</a><a href="/insights/">Articles</a></nav></div></footer>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildPageDescription(released, upcoming, themes) {
  if (released.length && upcoming.length)
    return `Macro briefing: ${released.length} recent release(s) analyzed, ${upcoming.length} high-impact event(s) upcoming. Themes: ${themes.slice(0, 2).map((t) => t.replace(/_/g, ' ')).join(', ') || 'cross-asset macro analysis'}.`;
  if (released.length)
    return `Post-release macro analysis: ${released.map((e) => e.event_name).slice(0, 3).join(', ')}. Educational cross-asset interpretation.`;
  if (upcoming.length)
    return `Pre-event macro preview: ${upcoming.map((e) => e.event_name).slice(0, 3).join(', ')} upcoming. Scenario framing and historical sensitivity analysis.`;
  return 'Daily educational macro briefing. Cross-asset context, event scenario framing, and historical sensitivity analysis.';
}

function surpriseBadge(dir) {
  if (!dir || dir === 'near_consensus') return '<span class="surprise-neutral">~ consensus</span>';
  if (dir === 'hotter_or_stronger') return '<span class="surprise-hot">↑ hotter</span>';
  if (dir === 'softer_or_weaker') return '<span class="surprise-soft">↓ softer</span>';
  return '';
}

function fmtEventTime(dt) {
  if (!dt) return '—';
  try { return new Date(dt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' }); }
  catch { return dt.slice(0, 16).replace('T', ' '); }
}

function weekLabel() {
  const d = new Date();
  const year = d.getUTCFullYear();
  const start = new Date(year, 0, 1);
  const week = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const m = process.argv.find((a) => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

main();
