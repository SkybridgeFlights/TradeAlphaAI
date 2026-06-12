'use strict';

// Phase 87 — Editorial visual figure emitter.
// Turns a selected chart narrative into the institutional figure HTML used by
// article and market-outlook surfaces: a lazy chart container (resolved
// client-side by js/editorial-visuals.js), a bilingual institutional caption,
// attribution, and the Phase 86 slot marker for validator integrity.
// Pure HTML emission — no rendering system, no hydration framework.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const NARRATIVES_PATH = path.join(ROOT, 'data', 'intelligence', 'chart-narratives.json');
const STALE_HOURS = 48;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loadChartNarratives() {
  try {
    const data = JSON.parse(fs.readFileSync(NARRATIVES_PATH, 'utf8'));
    if (!data.updated_at) return null;
    const age = (Date.now() - new Date(data.updated_at).getTime()) / 3600000;
    if (!Number.isFinite(age) || age > STALE_HOURS) return null;
    return data.verified === true ? data : null;
  } catch { return null; }
}

// Emit one institutional figure. locale: 'en' | 'ar'.
function renderEditorialFigure(chart, locale) {
  const ar = locale === 'ar';
  const reading = ar ? chart.reading_ar : chart.reading_en;
  const title = ar ? chart.title_ar : chart.title_en;
  return `<figure class="editorial-figure" data-visual-id="${esc(chart.id)}" data-visual-kind="${esc(chart.kind)}">
  <div class="editorial-visual-slot" data-tv-symbols="${esc(chart.symbols.join(','))}" data-visual-locale="${ar ? 'ar' : 'en'}" data-visual-title="${esc(title)}">
    <span class="editorial-visual-fallback">${ar ? 'يُحمَّل الرسم عند العرض — المصدر: TradingView' : 'Chart loads on view — source: TradingView'}</span>
  </div>
  <figcaption>
    <span class="figure-kicker">${ar ? 'قراءة الرسم' : 'Chart intelligence'}</span>
    <p class="figure-reading">${esc(reading)}</p>
    <span class="figure-attribution">${esc(chart.attribution)}</span>
  </figcaption>
</figure>
<!-- editorial:visual-slot:${esc(chart.id)}:${esc(chart.kind)} -->`;
}

// First consumer helper: the single most relevant figure for a page, wrapped
// as a market-outlook section. Returns '' when nothing is editorially
// justified — restraint is the default.
function renderOutlookVisualSection(locale) {
  const data = loadChartNarratives();
  if (!data || !data.selected.length) return '';
  const chart = data.selected[0];
  const ar = locale === 'ar';
  return `<section class="market-section editorial-visual-section" id="chart-intelligence">
        <div class="market-section-head"><span class="eyebrow">${ar ? 'الذكاء البصري' : 'Visual intelligence'}</span></div>
        ${renderEditorialFigure(chart, locale)}
      </section>`;
}

module.exports = { renderEditorialFigure, renderOutlookVisualSection, loadChartNarratives };
