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
const { renderSiteFooter, renderSiteHeader } = require('./global-layout-renderer');
const { updateOutlookPublication } = require('./update-market-outlook-publication');
const { renderOutlookVisualSection } = require('./render-editorial-visuals');
const { renderOutlookGraphicsSection } = require('./render-editorial-graphics');

const ROOT          = path.resolve(__dirname, '..');
const CAL_PATH      = path.join(ROOT, 'data', 'economic-calendar.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const EXPECT_PATH   = path.join(ROOT, 'data', 'market-expectations.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const RATE_PATH     = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const ETF_PATH      = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const DEGRADATION_PATH  = path.join(ROOT, 'data', 'intelligence', 'provider-degradation.json');
const DAILY_DIR     = path.join(ROOT, 'market-outlook', 'daily');
const WEEKLY_DIR    = path.join(ROOT, 'market-outlook', 'weekly');

const SITE_URL      = 'https://www.tradealphaai.com';
const WRITE         = process.argv.includes('--write');
const FORCE         = process.argv.includes('--force');
const MODE          = argValue('--mode') || 'daily';

const DISCLAIMER_EN = 'This is educational macro commentary only. It is not investment advice, a recommendation to buy or sell any asset, or a forecast. Past event reactions do not reliably predict future outcomes. Always consult a licensed financial professional before making investment decisions.';
const DEGRADED_NOTICE_EN = 'Live macroeconomic event data was temporarily unavailable during generation. Market commentary may contain reduced event sensitivity coverage.';
const DEGRADED_NOTICE_AR = 'تعذّر الوصول مؤقتًا إلى بيانات التقويم الاقتصادي المباشرة أثناء التوليد، لذلك قد تكون تغطية حساسية الأحداث الاقتصادية محدودة.';

function main() {
  const calendar    = readJson(CAL_PATH,       { events: [] });
  const memory      = readJson(MEMORY_PATH,    { event_reactions: [], historical_patterns: {} });
  const narrative   = readJson(NARRATIVE_PATH, { release_narratives: [], preview_narratives: [], active_themes: [] });
  const live        = readJson(LIVE_PATH,      { metadata: { status: 'fallback' } });
  const expectations = readJson(EXPECT_PATH,   { expectations: [] });
  const regime      = readJson(REGIME_PATH,    { regime: null, regime_label: null, confidence: null });
  const ratePath    = readJson(RATE_PATH,      { fed_path: null, yield_curve: null });
  const etfFlow     = readJson(ETF_PATH,       { rotation_analysis: null, positioning_matrix: null });
  const transmission = readJson(TRANSMISSION_PATH, { transmission_library: {}, event_analyses: [], regime_transmission_note: null });
  const degradation  = readJson(DEGRADATION_PATH, { fallback_mode: false });
  const calendarDegraded = degradation.fallback_mode === true;
  if (calendarDegraded) console.warn('[daily-outlook] Calendar provider degraded — generating with limited macro intelligence mode');

  const today    = new Date().toISOString().slice(0, 10);
  const weekSlug = weekLabel();

  if (MODE === 'weekly') {
    const html = buildWeeklyPage(calendar, memory, narrative, live, expectations, weekSlug, regime, ratePath, etfFlow, transmission, calendarDegraded);
    outputPage(html, path.join(WEEKLY_DIR, `${weekSlug}.html`), `Weekly macro outlook ${weekSlug}`);
  } else {
    const html = buildDailyPage(calendar, memory, narrative, live, expectations, today, regime, ratePath, etfFlow, transmission, calendarDegraded);
    outputPage(html, path.join(DAILY_DIR, `${today}.html`), `Daily macro briefing ${today}`);
  }
  if (WRITE) updateOutlookPublication();
}

function outputPage(html, filePath, label) {
  const normalizedHtml = String(html || '').replace(/[ \t]+(?=\r?$)/gm, '');
  const missing = validateOutlookPage(normalizedHtml);
  if (missing.length) {
    throw new Error(`[daily-outlook] Refusing output; required publication markers missing: ${missing.join(', ')}`);
  }
  if (!WRITE) {
    console.log(`[daily-outlook] Dry run — would write ${path.relative(ROOT, filePath).replaceAll('\\', '/')}`);
    console.log(`[daily-outlook] ${label}: ${normalizedHtml.length} chars`);
    return;
  }
  if (!FORCE && fs.existsSync(filePath)) {
    console.log(`[daily-outlook] Already exists: ${path.relative(ROOT, filePath).replaceAll('\\', '/')} — use --force to overwrite`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, normalizedHtml, 'utf8');
  console.log(`[daily-outlook] Wrote ${path.relative(ROOT, filePath).replaceAll('\\', '/')}`);
}

function validateOutlookPage(html) {
  const checks = [
    ['full_html_document',    /<!doctype html>[\s\S]*<\/html>/i],
    ['global_layout',         /css\/global-layout\.css|css\/global-header\.css/],
    ['site_header',           /data-global-header|GLOBAL_HEADER_START/],
    ['site_footer',           /class="[^"]*\bsite-footer\b/],
    ['market_regime',         /regime/i],
    ['rate_context',          /rate|yield/i],
    ['transmission_context',  /transmission|cross-asset|reaction map/i],
    ['educational_disclaimer', /not investment advice/i]
  ];
  return checks.filter(([, pattern]) => !pattern.test(html)).map(([name]) => name);
}

// ── Daily page builder ────────────────────────────────────────────────────────

function buildDailyPage(calendar, memory, narrative, live, expectations, today, regime, ratePath, etfFlow, transmission, calendarDegraded = false) {
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
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/editorial-graphics.css" />
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

      ${renderOutlookVisualSection('en')}
      ${renderOutlookGraphicsSection('en')}

      ${regime?.regime ? buildRegimeSection(regime) : ''}
      ${ratePath?.fed_path?.current_stance ? buildRatePathSection(ratePath) : ''}

      ${relNarratives.length ? buildReleasedSection(relNarratives, released) : ''}
      ${prevNarratives.length ? buildUpcomingSection(prevNarratives, upcoming) : ''}
      ${!relNarratives.length && !prevNarratives.length ? buildNoDataSection(upcoming, released) : ''}

      ${etfFlow?.rotation_analysis?.key_spread ? buildRotationSection(etfFlow) : ''}
      ${buildReactionMapSection(transmission)}

      ${calendarDegraded ? `<section class="market-section degraded-notice-section" role="note" aria-label="Data availability notice">
        <div class="disclaimer-box" style="border-left:3px solid #f59e0b;background:rgba(245,158,11,0.06)">
          <h3 style="color:#b45309">⚠ Limited Macro Intelligence Mode</h3>
          <p>${esc(DEGRADED_NOTICE_EN)}</p>
          <p lang="ar" dir="rtl" style="font-family:inherit;margin-top:0.5rem">${esc(DEGRADED_NOTICE_AR)}</p>
        </div>
      </section>` : ''}

      <section class="market-section disclaimer-section">
        <div class="disclaimer-box">
          <h3>Educational Research Disclaimer</h3>
          <p>${esc(DISCLAIMER_EN)}</p>
        </div>
      </section>
    </div>
  </main>
  ${buildFooter()}
  <script src="/js/mobile-nav.js" defer></script>
  <script src="/js/editorial-visuals.js" defer></script>
</body>
</html>`;
}

// ── Weekly page builder ───────────────────────────────────────────────────────

function buildWeeklyPage(calendar, memory, narrative, live, expectations, weekSlug, regime, ratePath, etfFlow, transmission, calendarDegraded = false) {
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
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/editorial-graphics.css" />
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

      ${renderOutlookVisualSection('en')}
      ${renderOutlookGraphicsSection('en')}

      ${regime?.regime ? buildRegimeSection(regime) : ''}
      ${ratePath?.fed_path?.current_stance ? buildRatePathSection(ratePath) : ''}

      ${prevNarratives.length ? buildUpcomingSection(prevNarratives, weekEvents) : ''}
      ${relNarratives.length  ? buildReleasedSection(relNarratives, []) : ''}

      ${etfFlow?.rotation_analysis ? buildRotationSection(etfFlow) : ''}
      ${buildHistoricalSensitivitySection(patterns)}
      ${buildReactionMapSection(transmission)}

      ${calendarDegraded ? `<section class="market-section degraded-notice-section" role="note" aria-label="Data availability notice">
        <div class="disclaimer-box" style="border-left:3px solid #f59e0b;background:rgba(245,158,11,0.06)">
          <h3 style="color:#b45309">⚠ Limited Macro Intelligence Mode</h3>
          <p>${esc(DEGRADED_NOTICE_EN)}</p>
          <p lang="ar" dir="rtl" style="font-family:inherit;margin-top:0.5rem">${esc(DEGRADED_NOTICE_AR)}</p>
        </div>
      </section>` : ''}

      <section class="market-section disclaimer-section">
        <div class="disclaimer-box">
          <h3>Educational Research Disclaimer</h3>
          <p>${esc(DISCLAIMER_EN)}</p>
        </div>
      </section>
    </div>
  </main>
  ${buildFooter()}
  <script src="/js/mobile-nav.js" defer></script>
  <script src="/js/editorial-visuals.js" defer></script>
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

function buildRegimeSection(regime) {
  if (!regime?.regime) return '';
  const confidencePct = regime.confidence ? `${(regime.confidence * 100).toFixed(0)}%` : '';
  const stabilityClass = regime.regime_stability === 'established' ? 'regime-established'
    : regime.regime_stability === 'transitional' ? 'regime-transitional' : 'regime-contested';
  const signals = (regime.supporting_signals || []).slice(0, 4);
  const contra  = (regime.contradictory_signals || []).slice(0, 2);

  const implCards = regime.implications ? Object.entries(regime.implications).map(([asset, text]) =>
    `<div class="impl-card"><strong>${esc(asset.charAt(0).toUpperCase() + asset.slice(1))}</strong><p>${esc(text.slice(0, 200))}</p></div>`
  ).join('') : '';

  return `<section class="market-section" id="macro-regime">
    <h2 class="section-heading">Macro Regime Intelligence</h2>
    <div class="regime-panel ${stabilityClass}">
      <div class="regime-header">
        <span class="regime-label">${esc(regime.regime_label || regime.regime)}</span>
        ${confidencePct ? `<span class="regime-confidence">Confidence: ${esc(confidencePct)}</span>` : ''}
        ${regime.regime_stability ? `<span class="regime-stability">${esc(regime.regime_stability)}</span>` : ''}
      </div>
      ${regime.regime_summary ? `<p class="regime-summary">${esc(regime.regime_summary)}</p>` : ''}
      <div class="regime-signals">
        ${signals.length ? `<div class="signal-group"><strong>Supporting:</strong><ul>${signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
        ${contra.length ? `<div class="signal-group signal-contra"><strong>Contradictory:</strong><ul>${contra.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
      </div>
      ${implCards ? `<div class="impl-grid">${implCards}</div>` : ''}
    </div>
  </section>`;
}

function buildRatePathSection(ratePath) {
  if (!ratePath?.fed_path) return '';
  const fp = ratePath.fed_path;
  const yc = ratePath.yield_curve || {};

  const scenarioRows = fp.probability_scenarios ? Object.entries(fp.probability_scenarios).map(([scenario, prob]) => {
    const pct = Math.round((prob || 0) * 100);
    return `<tr><td>${esc(scenario.replace(/_/g, ' '))}</td><td><div class="prob-bar"><div class="prob-fill" style="width:${pct}%"></div></div></td><td>${pct}%</td></tr>`;
  }).join('') : '';

  const durationItems = ratePath.duration_sensitivity ? Object.entries(ratePath.duration_sensitivity).slice(0, 6).map(([ticker, data]) =>
    `<div class="dur-item"><span class="dur-ticker">${esc(ticker)}</span><span class="dur-sens">${esc(data.sensitivity || '')}</span><span class="dur-dir">${esc(data.direction?.replace(/_/g, ' ') || '')}</span></div>`
  ).join('') : '';

  return `<section class="market-section" id="rate-path">
    <h2 class="section-heading">Fed Path &amp; Yield Curve Analysis</h2>
    <div class="rate-path-grid">
      <div class="rate-path-card">
        <h3>Policy Stance</h3>
        <p><strong>Current Stance:</strong> ${esc(fp.current_stance || '—')}</p>
        <p><strong>Bias:</strong> ${esc((fp.bias || '').replace(/_/g, ' '))}</p>
        ${fp.implied_path_narrative ? `<p class="rate-narrative">${esc(fp.implied_path_narrative)}</p>` : ''}
        ${fp.policy_risk ? `<p class="rate-risk"><strong>Key Risk:</strong> ${esc(fp.policy_risk)}</p>` : ''}
      </div>
      <div class="rate-path-card">
        <h3>Yield Curve</h3>
        <p><strong>Shape:</strong> ${esc((yc.inferred_shape || '—').replace(/_/g, ' '))}</p>
        <p><strong>Inversion:</strong> ${esc(yc.inversion_status || '—')}</p>
        ${yc.curve_narrative ? `<p class="rate-narrative">${esc(yc.curve_narrative.slice(0, 300))}</p>` : ''}
      </div>
      ${scenarioRows ? `<div class="rate-path-card rate-path-scenarios"><h3>Probability Scenarios</h3><div class="table-scroll"><table class="prob-table"><tbody>${scenarioRows}</tbody></table></div></div>` : ''}
    </div>
    ${durationItems ? `<div class="duration-map"><h3>Duration Sensitivity Map</h3><div class="dur-grid">${durationItems}</div></div>` : ''}
  </section>`;
}

function buildRotationSection(etfFlow) {
  if (!etfFlow?.rotation_analysis) return '';
  const ra = etfFlow.rotation_analysis;
  const over  = (ra.outperformers || []).slice(0, 6);
  const under = (ra.underperformers || []).slice(0, 6);

  return `<section class="market-section" id="sector-rotation">
    <h2 class="section-heading">Sector Rotation &amp; ETF Positioning</h2>
    <p class="section-intro">${esc((ra.rotation_thesis || '').slice(0, 400))}</p>
    <div class="rotation-grid">
      ${over.length ? `<div class="rotation-card over"><h3>Regime Outperformers</h3><div class="ticker-list">${over.map((t) => `<span class="ticker-chip">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${under.length ? `<div class="rotation-card under"><h3>Regime Underperformers</h3><div class="ticker-list">${under.map((t) => `<span class="ticker-chip ticker-chip-under">${esc(t)}</span>`).join('')}</div></div>` : ''}
      ${ra.key_spread ? `<div class="rotation-card spread"><h3>Key Spread to Monitor</h3><p>${esc(ra.key_spread)}</p></div>` : ''}
    </div>
    ${etfFlow.positioning_matrix?.disclaimer ? `<p class="disclaimer-small">${esc(etfFlow.positioning_matrix.disclaimer)}</p>` : ''}
  </section>`;
}

function buildReactionMapSection(transmission) {
  const eventAnalyses = (transmission?.event_analyses || []).slice(0, 4);
  const libraryEntries = Object.entries(transmission?.transmission_library || {}).slice(0, 4);
  const cards = eventAnalyses.length
    ? eventAnalyses.map((item) => buildTransmissionCard(item.event_name || item.event_type || 'Macro event', item))
    : libraryEntries.map(([key, item]) => buildTransmissionCard(key.replace(/_/g, ' '), item));
  const regimeNote = transmission?.regime_transmission_note
    ? `<div class="narrative-callout">${esc(transmission.regime_transmission_note)}</div>`
    : '';

  return `<section class="market-section" id="asset-reaction-map">
    <h2 class="section-heading">Cross-Asset Transmission Reference</h2>
    <p class="section-intro">These are educational scenario frameworks, not predictions. Confirmation requires yield, dollar, and breadth signals to align.</p>
    ${regimeNote}
    <div class="reaction-grid">${cards.join('')}</div>
  </section>`;
}

function buildTransmissionCard(label, item) {
  const chain = (item.asset_chain || item.transmission_chain || []).slice(0, 4);
  const mechanism = item.mechanism || item.transmission_mechanism || item.policy_transmission || '';
  const confirmations = (item.confirmation_signals || []).slice(0, 3);
  return `<div class="reaction-card">
      <h3>${esc(label)}</h3>
      ${mechanism ? `<p>${esc(String(mechanism).slice(0, 320))}</p>` : ''}
      ${chain.length ? `<ul>${chain.map((step) => `<li><strong>${esc(step.asset || step.instrument || '')}</strong>: ${esc((step.direction || step.market_implication || '').replace(/_/g, ' '))}${step.reason ? ` because ${esc(step.reason)}` : ''}</li>`).join('')}</ul>` : ''}
      ${confirmations.length ? `<p><small>Confirmation: ${confirmations.map(esc).join(' | ')}</small></p>` : ''}
    </div>`;
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
  return renderSiteHeader({
    locale: 'en',
    active: 'market-outlook',
    languageHref: '/ar/market-outlook/'
  });
}

function buildFooter() {
  return renderSiteFooter({ locale: 'en' });
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
