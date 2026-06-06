'use strict';

const fs = require('fs');
const path = require('path');
const { renderSiteFooter, renderSiteHeader } = require('./global-layout-renderer');
const { collectPages } = require('./update-market-outlook-publication');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'system-status', 'index.html');
const REPORT_PATH    = path.join(ROOT, 'data', 'intelligence', 'publishing-report.json');
const PROVIDER_PATH  = path.join(ROOT, 'data', 'provider-health.json');
const DEGRADATION    = path.join(ROOT, 'data', 'intelligence', 'provider-degradation.json');
const REGIME_PATH    = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const NARRATIVE_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');
const CONFIDENCE_PATH= path.join(ROOT, 'data', 'intelligence', 'publication-confidence.json');
const TELEGRAM_PATH  = path.join(ROOT, 'data', 'intelligence', 'telegram-status.json');
const EDITORIAL_Q    = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const ORPHAN_PATH    = path.join(ROOT, 'data', 'intelligence', 'orphan-pages.json');
const SITE_URL = 'https://www.tradealphaai.com';

function main() {
  const report      = readJson(REPORT_PATH,    {});
  const provider    = readJson(PROVIDER_PATH,  { providers: {} });
  const degradation = readJson(DEGRADATION,    {});
  const regime      = readJson(REGIME_PATH,    {});
  const narrative   = readJson(NARRATIVE_PATH, {});
  const confidence  = readJson(CONFIDENCE_PATH,{});
  const telegram    = readJson(TELEGRAM_PATH,  {});
  const editorialQ  = readJson(EDITORIAL_Q,    { topics: [] });
  const orphanData  = readJson(ORPHAN_PATH,    { orphans: [] });

  const latestOutlook = collectPages()[0] || null;
  const providerRows  = Object.entries(provider.providers || {});
  const degraded = provider.degraded === true
    || degradation.fallback_mode === true
    || providerRows.some(([, s]) => !['ok', 'live', 'cache_hit'].includes(s.status))
    || regime.data_quality === 'unverified'
    || regime.status === 'degraded';

  // Queue health
  const queueTopics    = editorialQ.topics || [];
  const queuePending   = queueTopics.filter(t => ['queued','pending','generating'].includes(t.status)).length;
  const queuePublished = queueTopics.filter(t => t.status === 'published').length;
  const queueFailed    = queueTopics.filter(t => t.status === 'failed' || t.repair_required).length;

  // Macro confidence
  const macroConf = Number(narrative.macro_confidence || narrative.confidence || regime.confidence || 0);
  const confScore = Number(confidence.confidence || 0);
  const confThresh= Number(confidence.confidence_threshold || 90);

  // Orphan count
  const orphanCount = (orphanData.orphans || []).length;

  const timestamp = new Date().toISOString();
  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>System Status | TradeAlphaAI</title>
  <meta name="description" content="Operational status for TradeAlphaAI publishing and macro intelligence services." />
  <meta name="robots" content="index,follow" />
  <link rel="canonical" href="${SITE_URL}/system-status/" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
</head>
<body class="market-page">
  ${renderSiteHeader({ locale: 'en' })}
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="/">Home</a><span>/</span><span>System Status</span></nav>
      <section class="market-hero">
        <div class="market-hero-panel">
          <span class="eyebrow">Operational Transparency</span>
          <h1>TradeAlphaAI System Status</h1>
          <p class="market-lead">Static operational snapshot for publishing, macro intelligence, data providers, and distribution.</p>
          <div class="market-actions"><span class="market-btn">${degraded ? 'Degraded mode active' : 'Systems operational'}</span><span class="market-btn">Updated ${escapeHtml(timestamp)}</span></div>
        </div>
      </section>
      <section class="market-section">
        <div class="market-grid three">
          ${card('Workflow status', report.publish_result || 'No recorded run', report.publish_block_reason || 'No publish block recorded')}
          ${card('Macro intelligence mode', degraded ? 'Degraded macro mode' : 'Live macro mode', `Regime: ${regime.regime_label || regime.regime || 'unavailable'}`)}
          ${card('Active macro provider', provider.provider || 'Unavailable', provider.endpoint || 'No active endpoint')}
          ${card('Macro confidence', macroConf ? `${macroConf}%` : 'Unverified', degraded ? '⚠ limited mode active' : 'Full intelligence mode')}
          ${card('Publication confidence', confScore >= confThresh ? `${confScore} / ${confThresh} ✓` : `${confScore} / ${confThresh} ⚠`, `Slug: ${report.selected_topic || '—'}`)}
          ${card('Editorial queue health', `${queuePublished} published`, `${queuePending} pending · ${queueFailed} need repair`)}
          ${card('Orphan pages', orphanCount === 0 ? '0 — clean' : `${orphanCount}`, orphanCount ? 'Pages not linked from navigation' : 'All pages linked')}
          ${card('Latest outlook', latestOutlook ? latestOutlook.title : 'No outlook published', latestOutlook ? latestOutlook.slug : 'Awaiting generated briefing', latestOutlook?.url)}
          ${card('Latest publication', report.selected_topic || 'No publication recorded', report.timestamp || 'No run timestamp')}
          ${card('Telegram distribution', telegram.sent ? '✓ Sent' : 'Not sent', telegram.telegram_message_id ? `msg_id: ${telegram.telegram_message_id}` : (telegram.timestamp || telegram.result || 'No send record'))}
          ${card('Last successful fetch', provider.last_success || 'No successful fetch recorded', `Events: ${provider.event_count ?? 0}`)}
          ${card('Degraded mode', degraded ? '⚠ Active' : '✓ Off', degraded ? (provider.reason || degradation.reason || 'One or more macro inputs are degraded.') : 'All providers operational')}
        </div>
      </section>
      <section class="market-section">
        <div class="market-section-head"><span class="eyebrow">Provider Health</span><h2>Current data-provider state</h2></div>
        <div class="market-panel">
          <div class="table-scroll"><table class="calendar-table"><thead><tr><th>Provider</th><th>Status</th><th>Last checked</th><th>Detail</th></tr></thead><tbody>
            ${providerRows.length ? providerRows.map(([name, state]) => `<tr><td>${escapeHtml(name.toUpperCase())}</td><td>${escapeHtml(state.status || 'unknown')}</td><td>${escapeHtml(state.last_checked || 'unknown')}</td><td>${escapeHtml(state.last_error || 'No error reported')}</td></tr>`).join('') : '<tr><td colspan="4">No provider health record is available.</td></tr>'}
          </tbody></table></div>
        </div>
      </section>
      <section class="market-section"><div class="market-panel disclaimer-panel"><span class="eyebrow">Status Scope</span><p class="market-copy">This page reports the latest checked-in workflow state. It is not a real-time service-level monitor and contains no trading signals.</p></div></section>
    </div>
  </main>
  ${renderSiteFooter({ locale: 'en' })}
  <script src="/js/mobile-nav.js" defer></script>
</body>
</html>`;
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, html, 'utf8');
  updateSitemap();
  console.log('[system-status] Wrote system-status/index.html');
}

function card(title, state, detail, href = '') {
  const detailHtml = href ? `<a href="${href}">${escapeHtml(detail)}</a>` : escapeHtml(detail);
  return `<article class="market-card"><span class="market-card-kicker">${escapeHtml(title)}</span><h3>${escapeHtml(state)}</h3><p>${detailHtml}</p></article>`;
}

function updateSitemap() {
  const file = path.join(ROOT, 'sitemap-core.xml');
  if (!fs.existsSync(file)) return;
  let xml = fs.readFileSync(file, 'utf8');
  if (xml.includes(`${SITE_URL}/system-status/`)) return;
  const entry = `  <url>\n    <loc>${SITE_URL}/system-status/</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.55</priority>\n  </url>\n`;
  xml = xml.replace('</urlset>', `${entry}</urlset>`);
  fs.writeFileSync(file, xml, 'utf8');
}

function formatConfidence(value) {
  if (!Number.isFinite(Number(value))) return 'unavailable';
  const number = Number(value);
  return `${Math.round(number <= 1 ? number * 100 : number)}%`;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function escapeHtml(value) {
  return String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

if (require.main === module) main();

module.exports = { main };
