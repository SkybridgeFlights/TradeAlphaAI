'use strict';

// Phase 87 validation — editorial visual integrity.
// Guards the visual intelligence layer:
//   - chart-narratives artifact: selection cap, vocabulary, evidence-backed,
//     bilingual readings, verified gating, attribution presence
//   - rendered pages: every figure carries attribution and a caption, at most
//     two figures per page (visual restraint), Arabic pages carry Arabic
//     readings, slot markers stay within the kind vocabulary, no figure
//     without its narrative artifact
//   - the lazy mount script: no fabrication paths, lazy by construction

const fs = require('fs');
const path = require('path');
const {
  CHART_LIBRARY,
  MAX_CHARTS,
  SUPPORTED_VISUAL_TYPES,
  ANNOTATION_CONTRACT,
} = require('./build-chart-narratives');
const { VISUAL_KINDS, validateSlotMarkers } = require('./editorial-visual-contracts');
const { selectRelevantChart } = require('./render-editorial-visuals');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}
function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return null; }
}

// ── Artifact ────────────────────────────────────────────────────────────────
const narratives = readJson('data/intelligence/chart-narratives.json');
if (narratives) {
  if (typeof narratives.verified !== 'boolean') failures.push('chart-narratives: missing verified flag');
  if (JSON.stringify(narratives.supported_visual_types) !== JSON.stringify(SUPPORTED_VISUAL_TYPES)) {
    failures.push('chart-narratives: supported visual type contract is incomplete or reordered');
  }
  const annotation = narratives.annotation_contract || {};
  if (annotation.max_annotations !== ANNOTATION_CONTRACT.max_annotations) failures.push('chart-narratives: annotation density cap missing');
  if (annotation.rendering_status !== 'foundation-only') failures.push('chart-narratives: annotation renderer must remain foundation-only');
  if (!annotation.bilingual_labels_required || !annotation.evidence_reference_required) {
    failures.push('chart-narratives: annotation evidence/bilingual requirements missing');
  }
  const selected = narratives.selected || [];
  if (selected.length > MAX_CHARTS) failures.push(`chart-narratives: ${selected.length} charts exceeds restraint cap of ${MAX_CHARTS}`);
  if (narratives.verified === false && selected.length) failures.push('chart-narratives: charts selected without verified inputs');
  for (const chart of selected) {
    if (!CHART_LIBRARY[chart.id]) failures.push(`chart-narratives: unknown chart id "${chart.id}"`);
    if (!VISUAL_KINDS.includes(chart.kind)) failures.push(`chart-narratives: chart ${chart.id} kind "${chart.kind}" outside vocabulary`);
    if (!SUPPORTED_VISUAL_TYPES.includes(chart.visual_type)) failures.push(`chart-narratives: chart ${chart.id} missing supported visual_type`);
    if (!Array.isArray(chart.evidence) || !chart.evidence.length) failures.push(`chart-narratives: chart ${chart.id} missing evidence`);
    if (!chart.reading_en || !chart.reading_ar || !/[؀-ۿ]/.test(chart.reading_ar)) failures.push(`chart-narratives: chart ${chart.id} missing bilingual reading`);
    if (!chart.attribution) failures.push(`chart-narratives: chart ${chart.id} missing attribution`);
    if (!/TradingView/i.test(chart.attribution) || !/source|provider/i.test(chart.attribution)) failures.push(`chart-narratives: chart ${chart.id} attribution is incomplete`);
    if (!Array.isArray(chart.symbols) || !chart.symbols.length || chart.symbols.length > 2) failures.push(`chart-narratives: chart ${chart.id} symbol density must be 1-2`);
    if ((chart.symbols || []).some((symbol) => !/^[A-Z0-9]+:[A-Z0-9]+$/.test(symbol))) failures.push(`chart-narratives: chart ${chart.id} has an invalid TradingView symbol`);
    if (/will (rally|crash|rise|fall)|buy|sell|target/i.test(chart.reading_en)) failures.push(`chart-narratives: chart ${chart.id} reading contains advice/prediction language`);
    if (/\b(entry|exit|support|resistance|breakout|breakdown|moon|go long|go short)\b/i.test(`${chart.title_en} ${chart.reading_en}`)) {
      failures.push(`chart-narratives: chart ${chart.id} uses retail-style chart language`);
    }
  }
  console.log(`[editorial-visuals] chart-narratives ok (verified=${narratives.verified}, selected=${selected.length})`);
} else {
  console.log('[editorial-visuals] chart-narratives not built yet — CI builds it each run (non-fatal)');
}

// ── Rendered pages (market-outlook surfaces) ────────────────────────────────
function scanPages(dir) {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return;
  for (const entry of fs.readdirSync(full).filter((f) => f.endsWith('.html'))) {
    const html = read(`${dir}/${entry}`);
    if (!html) continue;
    const label = `${dir}/${entry}`;
    const figures = [...html.matchAll(/<figure class="editorial-figure"[\s\S]*?<\/figure>/g)];
    if (figures.length > MAX_CHARTS) failures.push(`${label}: ${figures.length} figures — visual restraint cap is ${MAX_CHARTS}`);
    const isArabic = /lang="ar"|dir="rtl"/.test(html.slice(0, 600));
    for (const [figure] of figures) {
      if (!figure.includes('figure-attribution')) failures.push(`${label}: figure missing attribution`);
      if (!figure.includes('figure-reading')) failures.push(`${label}: figure missing editorial reading`);
      if (!figure.includes('editorial-visual-slot')) failures.push(`${label}: figure missing visual slot container`);
      if (isArabic && !/[؀-ۿ]/.test(figure)) failures.push(`${label}: Arabic page figure carries no Arabic reading`);
    }
    if (figures.length && !html.includes('/js/editorial-visuals.js')) {
      failures.push(`${label}: figures present but editorial-visuals.js not included`);
    }
    for (const f of validateSlotMarkers(html, label)) failures.push(f);
  }
}
scanPages('market-outlook/daily');
scanPages('market-outlook/weekly');
scanPages('market-outlook');
scanPages('en/market-outlook');
scanPages('ar/market-outlook');
scanPages('insights');
scanPages('en/insights');
scanPages('ar/insights');

// ── Mount script discipline ─────────────────────────────────────────────────
const mount = read('js/editorial-visuals.js');
if (!mount) {
  failures.push('js/editorial-visuals.js missing');
} else {
  if (!mount.includes('IntersectionObserver')) failures.push('editorial-visuals.js: charts must mount lazily');
  if (/Math\.random/.test(mount)) failures.push('editorial-visuals.js: fabrication path detected');
  if (/editorial-visual-fallback[\s\S]{0,120}\.remove\(\)/.test(mount)) failures.push('editorial-visuals.js: fallback must remain when the remote embed fails');
  if (!mount.includes('https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js')) failures.push('editorial-visuals.js: TradingView embed host is not explicit');
}

const css = read('css/market/market-portal.css') || '';
if (!/@media \(max-width: 640px\)[\s\S]*?\.editorial-visual-slot\s*\{\s*min-height:\s*260px/.test(css)) {
  failures.push('market-portal.css: mobile chart height discipline missing');
}
if (!/html\[dir="rtl"\]\s+\.editorial-figure figcaption/.test(css)) failures.push('market-portal.css: RTL caption alignment missing');
if (!/html\[dir="rtl"\]\s+\.figure-attribution/.test(css)) failures.push('market-portal.css: RTL attribution direction missing');

const renderer = read('tools/render-editorial-visuals.js') || '';
if (!renderer.includes('selectChartForArticle')) failures.push('render-editorial-visuals: article relevance selection missing');
if (!renderer.includes('matches >= 2')) failures.push('render-editorial-visuals: article chart relevance threshold missing');
if (!renderer.includes('editorial-visual-fallback')) failures.push('render-editorial-visuals: missing server-rendered chart fallback');

const outlookGenerator = read('tools/generate-daily-market-outlook.js') || '';
const outlookSlots = (outlookGenerator.match(/renderOutlookVisualSection\('en'\)/g) || []).length;
if (outlookSlots < 2) failures.push('generate-daily-market-outlook: daily and weekly visual slots are both required');

const fixtureCharts = [
  { id: 'ai-concentration', score: 90 },
  { id: 'dollar-gold', score: 80 },
];
if (selectRelevantChart(fixtureCharts, 'NVIDIA and AI concentration inside QQQ')?.id !== 'ai-concentration') {
  failures.push('render-editorial-visuals: article relevance fixture failed');
}
if (selectRelevantChart(fixtureCharts, 'A general educational note about accounting statements') !== null) {
  failures.push('render-editorial-visuals: unrelated article received a chart');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-visuals] FAIL: ${f}`));
  process.exit(1);
}
console.log('[editorial-visuals] check:editorial-visuals passed.');
