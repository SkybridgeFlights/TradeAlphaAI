'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT_PATH = path.join(ROOT, 'data', 'visual', 'editorial-graphics.json');
const STYLE_HREF = '/css/editorial-graphics.css';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadEditorialGraphics() {
  try {
    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8'));
    if (artifact.verified !== true || artifact.stale === true) return [];
    return (artifact.graphics || []).filter((item) => item.verified === true && item.stale !== true && item.status === 'active');
  } catch {
    return [];
  }
}

function relevance(graphic, context) {
  const haystack = String(context || '').toUpperCase();
  const symbolHits = (graphic.chart_symbol_refs || []).filter((symbol) => haystack.includes(symbol)).length;
  const wordHits = String(graphic.headline_en || '').toUpperCase().split(/\W+/)
    .filter((word) => word.length > 4 && haystack.includes(word)).length;
  return symbolHits * 4 + Math.min(wordHits, 3) + Number(graphic.visual_priority || 0) / 100;
}

function selectGraphic(context, surface = 'article-inline') {
  const graphics = loadEditorialGraphics().filter((item) => item.allowed_platforms.includes(surface));
  const ranked = graphics.map((graphic) => ({ graphic, score: relevance(graphic, context) }))
    .sort((a, b) => b.score - a.score);
  if (!ranked.length) return null;
  if (surface === 'article-inline' && ranked[0].score < 1) return null;
  return ranked[0].graphic;
}

function renderRelationship(graphic, locale) {
  const symbols = graphic.chart_symbol_refs || [];
  if (symbols.length < 2) return '';
  const label = locale === 'ar' ? 'علاقة قيد التحقق' : 'Relationship under review';
  return `<div class="editorial-graphic__relationship" aria-label="${esc(label)}">
    <span class="editorial-graphic__asset">${esc(symbols[0])}</span>
    <span class="editorial-graphic__link" aria-hidden="true"><i></i><b></b><i></i></span>
    <span class="editorial-graphic__asset">${esc(symbols[1])}</span>
  </div>`;
}

function renderCatalyst(graphic, locale) {
  const time = graphic.rendering_contract?.event_time;
  if (!time) return '';
  const date = new Date(time);
  const label = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
    }).format(date)
    : time;
  return `<div class="editorial-graphic__catalyst">
    <span>${esc(locale === 'ar' ? 'التوقيت الموثق' : 'Verified timing')}</span>
    <time datetime="${esc(time)}">${esc(label)}</time>
  </div>`;
}

function renderAnnotations(graphic, locale) {
  const annotations = (graphic.annotations || []).slice(0, 3);
  if (!annotations.length) return '';
  return `<ul class="editorial-graphic__annotations">${annotations.map((item) => {
    const label = locale === 'ar' ? item.label_ar : item.label_en;
    return `<li><span>${esc(label)}</span><small>${esc(item.evidence_ref)}</small></li>`;
  }).join('')}</ul>`;
}

function renderEditorialGraphic(graphic, locale = 'en') {
  if (!graphic || graphic.verified !== true || graphic.stale === true) return '';
  const ar = locale === 'ar';
  const headline = ar ? graphic.headline_ar : graphic.headline_en;
  const context = ar ? graphic.narrative_context?.ar : graphic.narrative_context?.en;
  const body = graphic.visual_type === 'cross-asset-relationship'
    ? renderRelationship(graphic, locale)
    : graphic.visual_type === 'catalyst-watch'
      ? renderCatalyst(graphic, locale)
      : '';
  return `<!-- editorial:graphic:${esc(graphic.id)}:${esc(graphic.visual_type)} -->
<figure class="editorial-graphic editorial-graphic--${esc(graphic.visual_type)}" data-editorial-graphic="${esc(graphic.id)}" data-verified="true" dir="${ar ? 'rtl' : 'ltr'}">
  <div class="editorial-graphic__frame">
    <figcaption class="editorial-graphic__header">
      <span class="editorial-graphic__kicker">${esc(ar ? 'قراءة بصرية موثقة' : 'Verified visual intelligence')}</span>
      <h2>${esc(headline)}</h2>
      <p>${esc(context)}</p>
    </figcaption>
    ${body}
    ${renderAnnotations(graphic, locale)}
    <footer class="editorial-graphic__footer">
      <span>${esc(ar ? 'قراءة هيكلية، لا توقع اتجاهي' : 'Structural reading, not a directional forecast')}</span>
      <cite>${esc(graphic.attribution)}</cite>
    </footer>
  </div>
</figure>`;
}

function renderOutlookGraphicsSection(locale = 'en') {
  const graphic = selectGraphic('macro regime catalyst cross-asset outlook', 'outlook-inline');
  return renderEditorialGraphic(graphic, locale);
}

function renderArticleGraphicsSection(context, locale = 'en') {
  return renderEditorialGraphic(selectGraphic(context, 'article-inline'), locale);
}

function renderNewswireGraphicSection(context, locale = 'en') {
  return renderArticleGraphicsSection(context, locale);
}

function ensureStylesheet(html) {
  if (html.includes(STYLE_HREF)) return html;
  return html.replace(/<\/head>/i, `  <link rel="stylesheet" href="${STYLE_HREF}" />\n</head>`);
}

function injectEditorialGraphic(html, locale = 'en', surface = 'article-inline') {
  if (!html || html.includes('data-editorial-graphic=')) return html;
  const textContext = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000);
  const graphic = selectGraphic(textContext, surface);
  if (!graphic) return html;
  if ((graphic.chart_symbol_refs || []).some((symbol) => html.includes(`data-tv-symbols="${symbol}`))) return html;
  const rendered = renderEditorialGraphic(graphic, locale);
  if (!rendered) return html;
  const insertionPatterns = [
    /(<section[^>]+id=["']what-changed["'][^>]*>)/i,
    /(<section[^>]+class=["'][^"']*article-body[^"']*["'][^>]*>)/i,
    /(<\/header>)/i,
  ];
  let output = html;
  for (const pattern of insertionPatterns) {
    if (pattern.test(output)) {
      output = output.replace(pattern, `${rendered}\n$1`);
      return ensureStylesheet(output);
    }
  }
  return html;
}

module.exports = {
  loadEditorialGraphics,
  selectGraphic,
  renderEditorialGraphic,
  renderOutlookGraphicsSection,
  renderArticleGraphicsSection,
  renderNewswireGraphicSection,
  injectEditorialGraphic,
};
