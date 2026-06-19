'use strict';

// Phase 210 CP5 — /market-regime/ and /market-regime/history/ pages.
// Pure rendering layer over command-center artifacts. No intelligence logic is
// duplicated here.

const fs = require('fs');
const path = require('path');
const { renderGlobalHeader, globalHeaderScripts } = require('./render-global-header');

const ROOT = path.resolve(__dirname, '..');
const INTEL = path.join(ROOT, 'data', 'intelligence');
const WRITE = process.argv.includes('--write');

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(INTEL, name), 'utf8')); } catch { return fallback; }
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function t(ar, en, arText) { return ar ? arText : en; }
function label(ar, node, fallback = 'indeterminate') { return esc(ar ? (node?.label_ar || node?.state_ar || fallback) : (node?.label_en || node?.state_en || node?.state || fallback)); }
function text(ar, en, arText) { return esc(t(ar, en, arText)); }
function human(v) { return String(v ?? 'indeterminate').replace(/_/g, ' '); }

function head(ar, history = false) {
  const route = `${ar ? '/ar' : ''}/market-regime/${history ? 'history/' : ''}`;
  const url = `https://www.tradealphaai.com${route}`;
  const enHref = `https://www.tradealphaai.com/market-regime/${history ? 'history/' : ''}`;
  const arHref = `https://www.tradealphaai.com/ar/market-regime/${history ? 'history/' : ''}`;
  const title = history
    ? t(ar, 'Market Regime History | TradeAlphaAI', 'تاريخ نظام السوق | TradeAlphaAI')
    : t(ar, 'Market Regime Command Center | TradeAlphaAI', 'مركز قيادة نظام السوق | TradeAlphaAI');
  const desc = history
    ? t(ar, 'Historical regime timeline and transition context from tracked market intelligence ledgers.', 'تسلسل تاريخي لنظام السوق وسياق الانتقالات اعتماداً على سجلات استخبارات سوقية موثقة.')
    : t(ar, 'Institutional command center for regime, confidence, confirmation, leadership and historical transition context.', 'مركز مؤسسي يجمع النظام والثقة والتأكيدات والقيادة النسبية وسياق الانتقال التاريخي.');
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${enHref}" />
  <link rel="alternate" hreflang="ar" href="${arHref}" />
  <link rel="alternate" hreflang="x-default" href="${enHref}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
</head>`;
}

function shell(ar, body, history = false) {
  const dir = ar ? 'rtl' : 'ltr';
  const lang = ar ? 'ar' : 'en';
  const enHref = `/market-regime/${history ? 'history/' : ''}`;
  const arHref = `/ar/market-regime/${history ? 'history/' : ''}`;
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
${head(ar, history)}
<body class="market-page market-regime-page">
${renderGlobalHeader({ locale: lang, activePage: 'market-regime', englishHref: enHref, arabicHref: arHref })}
<main class="market-shell" data-market-regime-page="${history ? 'history' : 'overview'}">
${body}
</main>
${globalHeaderScripts()}
</body>
</html>
`;
}

function evidenceList(ar, refs, limit = 4) {
  const rows = (Array.isArray(refs) ? refs : []).slice(0, limit);
  if (!rows.length) return `<p class="market-muted">${text(ar, 'Evidence unavailable.', 'الأدلة غير متاحة.')}</p>`;
  return `<ul class="market-evidence-list">
${rows.map((ref) => `          <li><strong>${esc(ref.source || ref.field || 'source')}</strong>: ${esc(ref.value || (ref.evidence || []).join(' · ') || 'observed')}</li>`).join('\n')}
        </ul>`;
}

function metricCard(ar, titleEn, titleAr, node) {
  return `        <article class="market-card">
          <span class="market-card-kicker">${text(ar, 'Command center', 'مركز القيادة')}</span>
          <h3>${text(ar, titleEn, titleAr)}</h3>
          <p class="market-stat">${label(ar, node)}</p>
          ${evidenceList(ar, node?.evidence_refs, 2)}
        </article>`;
}

function matrixSection(ar, matrix) {
  const layers = Array.isArray(matrix.layers) ? matrix.layers : [];
  return `      <section class="market-section" id="confirmation-matrix">
        <div class="section-heading">
          <span>${text(ar, 'Confirmation Matrix', 'مصفوفة التأكيد')}</span>
          <h2>${text(ar, 'What confirms and what diverges', 'ما يؤكد وما يتباعد')}</h2>
        </div>
        <div class="market-grid compact-grid">
${layers.map((layer) => `          <article class="market-card">
            <span class="market-card-kicker">${esc(ar ? layer.title_ar : layer.title_en)}</span>
            <h3>${esc(ar ? layer.label_ar : layer.label_en)}</h3>
            <p>${text(ar, 'Confirming', 'مؤكد')}: ${esc(layer.counts?.confirming ?? 0)} · ${text(ar, 'Contradicting', 'متعارض')}: ${esc(layer.counts?.contradicting ?? 0)} · ${text(ar, 'Mixed', 'مختلط')}: ${esc(layer.counts?.mixed ?? 0)}</p>
            ${evidenceList(ar, layer.evidence_refs, 2)}
          </article>`).join('\n')}
        </div>
      </section>`;
}

function leadershipGroup(ar, group, data) {
  const title = ar ? data.title_ar : data.title_en;
  const card = (item, side) => `            <li>
              <a href="${esc(ar ? item.links?.ar : item.links?.en)}">${esc(item.symbol)}</a>
              <span>${esc(ar ? item.rank_label_ar : item.rank_label_en)} · ${esc(ar ? item.historical_direction_ar : item.historical_direction_en)} · ${esc(ar ? item.confirmation_ar : item.confirmation_en)}</span>
            </li>`;
  return `          <article class="market-card leadership-card">
            <span class="market-card-kicker">${esc(title)}</span>
            <h3>${text(ar, 'Strongest', 'الأقوى')}</h3>
            <ul class="market-link-list">${(data.strongest || []).slice(0, 3).map((item) => card(item, 'strongest')).join('')}</ul>
            <h3>${text(ar, 'Weakest', 'الأضعف')}</h3>
            <ul class="market-link-list">${(data.weakest || []).slice(0, 3).map((item) => card(item, 'weakest')).join('')}</ul>
          </article>`;
}

function leadershipSection(ar, leadership) {
  const groups = leadership.groups || {};
  return `      <section class="market-section" id="leadership-dashboard">
        <div class="section-heading">
          <span>${text(ar, 'Leadership Dashboard', 'لوحة القيادة النسبية')}</span>
          <h2>${text(ar, 'Relative strength across assets, sectors and equities', 'القوة النسبية عبر الأصول والقطاعات والأسهم')}</h2>
        </div>
        <div class="market-grid three-col">
${['asset', 'sector', 'equity'].map((group) => leadershipGroup(ar, group, groups[group] || {})).join('\n')}
        </div>
      </section>`;
}

function overviewPage(ar) {
  const dashboard = readJson('market-regime-dashboard.json');
  const matrix = readJson('confirmation-matrix.json');
  const leadership = readJson('leadership-dashboard.json');
  const history = readJson('regime-history.json');
  const narrative = dashboard.dominant_story || {};
  const latestHistory = (history.transition_history || []).slice(-1)[0] || {};
  const body = `      <section class="market-hero">
        <p class="eyebrow">${text(ar, 'Institutional Market Regime Command Center', 'مركز قيادة نظام السوق المؤسسي')}</p>
        <h1>${text(ar, 'Current regime, confirmation and leadership in one command layer', 'النظام الحالي والتأكيدات والقيادة النسبية في طبقة واحدة')}</h1>
        <p>${text(ar, 'A deterministic composition of macro, asset, sector, equity, ranking and historical intelligence. Educational context only, not financial advice.', 'تركيب حتمي لاستخبارات الاقتصاد الكلي والأصول والقطاعات والأسهم والترتيب والتاريخ. سياق تعليمي فقط وليس نصيحة مالية.')}</p>
        <div class="market-hero-actions">
          <a class="market-link" href="${ar ? '/ar/market-regime/history/' : '/market-regime/history/'}">${text(ar, 'View regime history', 'عرض تاريخ النظام')}</a>
          <a class="market-link" href="${ar ? '/ar/rankings/' : '/rankings/'}">${text(ar, 'View rankings', 'عرض الترتيب')}</a>
        </div>
      </section>

      <section class="market-section" id="current-regime">
        <div class="section-heading">
          <span>${text(ar, 'Current Regime', 'النظام الحالي')}</span>
          <h2>${label(ar, dashboard.current_regime)}</h2>
        </div>
        <div class="market-grid three-col">
${metricCard(ar, 'Confidence', 'الثقة', dashboard.confidence_band)}
${metricCard(ar, 'Risk State', 'حالة المخاطر', dashboard.risk_state)}
${metricCard(ar, 'Volatility State', 'حالة التقلب', dashboard.volatility_state)}
${metricCard(ar, 'Dollar State', 'حالة الدولار', dashboard.dollar_state)}
${metricCard(ar, 'Yield State', 'حالة العوائد', dashboard.yield_state)}
${metricCard(ar, 'Historical Transition', 'الانتقال التاريخي', dashboard.historical_transition_state)}
        </div>
      </section>

      <section class="market-section" id="market-narrative">
        <div class="section-heading">
          <span>${text(ar, 'Market Narrative', 'سردية السوق')}</span>
          <h2>${label(ar, narrative)}</h2>
        </div>
        <article class="market-card">
          <p>${text(ar, 'The command center frames the dominant story through confirmation, contradiction and transition evidence rather than directional claims.', 'يعرض مركز القيادة السردية المهيمنة عبر أدلة التأكيد والتعارض والانتقال، لا عبر ادعاءات اتجاهية.')}</p>
          ${evidenceList(ar, dashboard.evidence_refs, 5)}
        </article>
      </section>

${matrixSection(ar, matrix)}
${leadershipSection(ar, leadership)}

      <section class="market-section" id="what-changed">
        <div class="section-heading">
          <span>${text(ar, 'What Changed', 'ما الذي تغير')}</span>
          <h2>${esc(ar ? (latestHistory.label_ar || 'تحديث تاريخي') : (latestHistory.label_en || 'Historical update'))}</h2>
        </div>
        <article class="market-card">
          <p>${text(ar, 'Latest tracked transition', 'أحدث انتقال موثق')}: ${esc(latestHistory.from_state || 'initial')} → ${esc(latestHistory.to_state || human(history.historical_regime_states?.current_state))}</p>
          ${evidenceList(ar, latestHistory.evidence ? [{ source: 'regime-history.json', value: latestHistory.to_state, evidence: latestHistory.evidence }] : history.evidence_refs, 3)}
        </article>
      </section>`;
  return shell(ar, body, false);
}

function historyPage(ar) {
  const history = readJson('regime-history.json');
  const body = `      <section class="market-hero">
        <p class="eyebrow">${text(ar, 'Regime History', 'تاريخ النظام')}</p>
        <h1>${text(ar, 'How the regime has evolved across tracked sessions', 'كيف تطور النظام عبر الجلسات المرصودة')}</h1>
        <p>${text(ar, 'This timeline uses tracked ledgers only. Thin dimensions are shown honestly as unavailable or no-prior history.', 'يعتمد هذا التسلسل على سجلات موثقة فقط. الأبعاد غير المكتملة تظهر بوضوح كغير متاحة أو بلا تاريخ سابق كاف.')}</p>
        <div class="market-hero-actions"><a class="market-link" href="${ar ? '/ar/market-regime/' : '/market-regime/'}">${text(ar, 'Back to command center', 'العودة إلى مركز القيادة')}</a></div>
      </section>

      <section class="market-section" id="regime-timeline">
        <div class="section-heading">
          <span>${text(ar, 'Regime Timeline', 'التسلسل الزمني للنظام')}</span>
          <h2>${text(ar, 'Tracked regime states', 'حالات النظام المرصودة')}</h2>
        </div>
        <div class="market-grid">
${(history.timeline_entries || []).map((entry) => `          <article class="market-card">
            <span class="market-card-kicker">${esc(entry.date)}</span>
            <h3>${esc(ar ? entry.regime_state_ar : entry.regime_state_en)}</h3>
            <p>${esc(ar ? entry.transition_marker_ar : entry.transition_marker_en)}</p>
            ${evidenceList(ar, [{ source: 'regime-history.json', value: entry.regime_state, evidence: entry.evidence }], 1)}
          </article>`).join('\n')}
        </div>
      </section>

      <section class="market-section" id="historical-changes">
        <div class="section-heading">
          <span>${text(ar, 'Historical Changes', 'التغيرات التاريخية')}</span>
          <h2>${text(ar, 'Observed transitions only', 'انتقالات مرصودة فقط')}</h2>
        </div>
        <div class="market-grid compact-grid">
${(history.transition_history || []).map((item) => `          <article class="market-card">
            <span class="market-card-kicker">${esc(item.date)}</span>
            <h3>${esc(ar ? item.label_ar : item.label_en)}</h3>
            <p>${esc(item.from_state || 'initial')} → ${esc(item.to_state)}</p>
          </article>`).join('\n')}
        </div>
      </section>

      <section class="market-section" id="confidence-evolution">
        <div class="section-heading">
          <span>${text(ar, 'Transition Evolution', 'تطور الانتقال')}</span>
          <h2>${text(ar, 'Confidence depth', 'عمق الثقة')}</h2>
        </div>
        <div class="market-grid compact-grid">
${(history.confidence_evolution || []).map((item) => `          <article class="market-card">
            <span class="market-card-kicker">${esc(item.date || 'current')}</span>
            <h3>${esc(ar ? item.confidence_band_ar : item.confidence_band_en)}</h3>
            <p>${esc(item.history_depth)} · ${esc(human(item.transition_state))}</p>
            ${evidenceList(ar, [{ source: 'regime-transitions.json', value: item.confidence_band, evidence: item.evidence }], 1)}
          </article>`).join('\n')}
        </div>
      </section>`;
  return shell(ar, body, true);
}

function writeFile(rel, html) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, html, 'utf8');
  console.log(`[market-regime-pages] wrote ${rel}`);
}

function build() {
  return {
    'market-regime/index.html': overviewPage(false),
    'ar/market-regime/index.html': overviewPage(true),
    'market-regime/history/index.html': historyPage(false),
    'ar/market-regime/history/index.html': historyPage(true)
  };
}

if (require.main === module) {
  const pages = build();
  console.log(`[market-regime-pages] generated ${Object.keys(pages).length} pages`);
  if (WRITE) for (const [rel, html] of Object.entries(pages)) writeFile(rel, html);
}

module.exports = { build };
