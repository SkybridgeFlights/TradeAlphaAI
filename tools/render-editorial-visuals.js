'use strict';

// Phase 87 — Editorial visual figure emitter.
// Turns a selected chart narrative into the institutional figure HTML used by
// article and market-outlook surfaces: a lazy chart container (resolved
// client-side by js/editorial-visuals.js), a bilingual institutional caption,
// attribution, and the Phase 86 slot marker for validator integrity.
// Pure HTML emission — no rendering system, no hydration framework.

const fs = require('fs');
const path = require('path');
const { CHART_LIBRARY } = require('./build-chart-narratives');

const ROOT = path.resolve(__dirname, '..');
const NARRATIVES_PATH = path.join(ROOT, 'data', 'intelligence', 'chart-narratives.json');
const STALE_HOURS = 48;

// Phase 91 — short institutional chips for each annotation type (bilingual).
const ANNOTATION_CHIP = {
  en: {
    'divergence-highlight': 'Divergence', 'commentary-label': 'Confirmation',
    'transition-label': 'Regime shift', 'pressure-band': 'Pressure',
    'volatility-compression-zone': 'Vol compression', 'catalyst-zone': 'Catalyst',
    'macro-annotation': 'Macro', 'liquidity-marker': 'Liquidity', 'liquidity-zone': 'Liquidity',
  },
  ar: {
    'divergence-highlight': 'انفصال', 'commentary-label': 'تأكيد',
    'transition-label': 'تحوّل النظام', 'pressure-band': 'ضغط',
    'volatility-compression-zone': 'انضغاط التقلب', 'catalyst-zone': 'محفز',
    'macro-annotation': 'ماكرو', 'liquidity-marker': 'سيولة', 'liquidity-zone': 'سيولة',
  },
};

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
  // Phase 91 — institutional annotation evidence rail. Native typography-driven
  // callouts (no canvas, no drawn arrows): each annotation is a type chip plus
  // a bilingual structural label, derived from verified artifacts. Rendered
  // only when annotations exist; otherwise the figure is the chart + caption.
  const annotations = Array.isArray(chart.annotations) ? chart.annotations : [];
  const railRows = annotations.map((a) => {
    const label = ar ? a.label_ar : a.label_en;
    return `      <li class="figure-annotation" data-annotation-type="${esc(a.type)}" data-severity="${esc(a.severity || 'info')}"><span class="annotation-chip">${esc(ANNOTATION_CHIP[locale] && ANNOTATION_CHIP[locale][a.type] ? ANNOTATION_CHIP[locale][a.type] : a.type)}</span><span class="annotation-label">${esc(label)}</span></li>`;
  }).join('\n');
  const rail = annotations.length
    ? `\n  <ul class="figure-annotations" aria-label="${ar ? 'دلائل الرسم المؤسسية' : 'Chart evidence annotations'}">\n${railRows}\n  </ul>`
    : '';
  return `<figure class="editorial-figure" data-visual-id="${esc(chart.id)}" data-visual-kind="${esc(chart.kind)}">
  <div class="editorial-visual-slot" data-tv-symbols="${esc(chart.symbols.join(','))}" data-visual-locale="${ar ? 'ar' : 'en'}" data-visual-title="${esc(title)}">
    <span class="editorial-visual-fallback">${ar ? 'يُحمَّل الرسم عند العرض — المصدر: TradingView' : 'Chart loads on view — source: TradingView'}</span>
  </div>${rail}
  <figcaption>
    <span class="figure-kicker">${ar ? 'قراءة الرسم' : 'Chart intelligence'}</span>
    <p class="figure-reading">${esc(reading)}</p>
    <span class="figure-attribution">${esc(chart.attribution)}</span>
  </figcaption>
</figure>
<!-- editorial:visual-slot:${esc(chart.id)}:${esc(chart.kind)} -->`;
}

function plainText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function selectRelevantChart(charts, articleContext) {
  if (!Array.isArray(charts) || !charts.length) return null;
  const text = plainText(articleContext);
  const ranked = charts
    .map((chart) => {
      const terms = (CHART_LIBRARY[chart.id] && CHART_LIBRARY[chart.id].article_terms) || [];
      return {
        chart,
        matches: terms.filter((term) => text.includes(String(term).toLowerCase())).length,
      };
    })
    .filter((entry) => entry.matches >= 2)
    .sort((a, b) => b.matches - a.matches || b.chart.score - a.chart.score);
  return ranked.length ? ranked[0].chart : null;
}

function selectChartForArticle(articleContext) {
  const data = loadChartNarratives();
  return data ? selectRelevantChart(data.selected, articleContext) : null;
}

function renderArticleVisualSection(articleContext, locale, preSelectedChart = null) {
  const chart = preSelectedChart || selectChartForArticle(articleContext);
  if (!chart) return '';
  const ar = locale === 'ar';
  return `<section class="market-section editorial-visual-section article-visual-intelligence" aria-labelledby="visual-intelligence-heading">
        <div class="market-section-head"><span class="eyebrow" id="visual-intelligence-heading">${ar ? 'قراءة بصرية مرتبطة بالسياق' : 'Contextual visual intelligence'}</span></div>
        ${renderEditorialFigure(chart, locale)}
      </section>`;
}

// preSelectedChart lets the caller select ONCE from the EN article and
// pass the same chart into both EN and AR. Otherwise the term-matching
// heuristic runs against the Arabic-translated body, which can either
// under-match (English chart terms not present) or over-match (bilingual
// glossary/hub anchors leak English tokens), producing asymmetric
// section counts — a hard-fail in the article-pair contract check.
function injectArticleVisual(html, locale, preSelectedChart = null) {
  if (!html || html.includes('class="editorial-figure"')) return html;
  const section = renderArticleVisualSection(html, locale, preSelectedChart);
  if (!section) return html;

  let output = html;
  const articleStart = output.search(/<article\b[^>]*>/i);
  const firstHeadingOffset = articleStart >= 0
    ? output.slice(articleStart).search(/<h2\b/i)
    : -1;
  if (articleStart >= 0 && firstHeadingOffset >= 0) {
    const insertion = articleStart + firstHeadingOffset;
    output = output.slice(0, insertion) + section + '\n' + output.slice(insertion);
  } else {
    const mainEnd = output.search(/<\/main>/i);
    if (mainEnd < 0) return html;
    output = output.slice(0, mainEnd) + section + '\n' + output.slice(mainEnd);
  }
  if (!output.includes('/js/editorial-visuals.js')) {
    output = output.replace(/<\/body>/i, '  <script src="/js/editorial-visuals.js" defer></script>\n</body>');
  }
  return output;
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

module.exports = {
  renderEditorialFigure,
  renderOutlookVisualSection,
  renderArticleVisualSection,
  selectRelevantChart,
  selectChartForArticle,
  injectArticleVisual,
  loadChartNarratives,
};
