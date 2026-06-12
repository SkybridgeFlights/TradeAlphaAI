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
const { CHART_LIBRARY, MAX_CHARTS } = require('./build-chart-narratives');
const { VISUAL_KINDS, validateSlotMarkers } = require('./editorial-visual-contracts');

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
  const selected = narratives.selected || [];
  if (selected.length > MAX_CHARTS) failures.push(`chart-narratives: ${selected.length} charts exceeds restraint cap of ${MAX_CHARTS}`);
  if (narratives.verified === false && selected.length) failures.push('chart-narratives: charts selected without verified inputs');
  for (const chart of selected) {
    if (!CHART_LIBRARY[chart.id]) failures.push(`chart-narratives: unknown chart id "${chart.id}"`);
    if (!VISUAL_KINDS.includes(chart.kind)) failures.push(`chart-narratives: chart ${chart.id} kind "${chart.kind}" outside vocabulary`);
    if (!Array.isArray(chart.evidence) || !chart.evidence.length) failures.push(`chart-narratives: chart ${chart.id} missing evidence`);
    if (!chart.reading_en || !chart.reading_ar || !/[؀-ۿ]/.test(chart.reading_ar)) failures.push(`chart-narratives: chart ${chart.id} missing bilingual reading`);
    if (!chart.attribution) failures.push(`chart-narratives: chart ${chart.id} missing attribution`);
    if (/will (rally|crash|rise|fall)|buy|sell|target/i.test(chart.reading_en)) failures.push(`chart-narratives: chart ${chart.id} reading contains advice/prediction language`);
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

// ── Mount script discipline ─────────────────────────────────────────────────
const mount = read('js/editorial-visuals.js');
if (!mount) {
  failures.push('js/editorial-visuals.js missing');
} else {
  if (!mount.includes('IntersectionObserver')) failures.push('editorial-visuals.js: charts must mount lazily');
  if (/Math\.random/.test(mount)) failures.push('editorial-visuals.js: fabrication path detected');
  if (!mount.includes('editorial-visual-fallback')) failures.push('editorial-visuals.js: missing graceful fallback handling');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-visuals] FAIL: ${f}`));
  process.exit(1);
}
console.log('[editorial-visuals] check:editorial-visuals passed.');
