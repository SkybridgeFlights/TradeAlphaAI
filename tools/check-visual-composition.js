'use strict';

// Phase 126 — check:visual-composition. Responsive-regression + layout-integrity
// gate for inline visuals embedded in published article bodies (market-structure
// / market-news / articles, EN + AR). It guards against the exact production
// failure this phase fixes — inline figures clipping or overflowing the prose
// column. HARD-FAILS if the CSS stabilization block is missing (regression), or
// if any embedded <figure> evidence panel / institutional chart has a non-
// responsive SVG (fixed pixel width/height on the root), an inline fixed-width
// or overflow style, a missing caption, an EN-without-AR figure, or (AR) a non-
// RTL document. Passes green when nothing relevant is published. Negative-tested.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS = path.join(ROOT, 'css', 'market', 'market-portal.css');
const SURFACES = [
  ['market-structure', 'market-structure'], ['ar/market-structure', 'ar/market-structure'],
  ['market-news', 'market-news'], ['ar/market-news', 'ar/market-news'],
  ['articles', 'articles'], ['ar/articles', 'ar/articles'],
];
const FIGURE_RE = /<figure class="(article-evidence-panel|institutional-chart)[^"]*"[\s\S]*?<\/figure>/gi;

const failures = [];
const fail = (m) => failures.push(m);

// A <figure>…</figure> block is composed safely when its SVG is viewBox-
// responsive (no fixed root width/height), carries no fixed-width/overflow inline
// style, and has a caption. Returns array of issues for the block.
function checkFigure(fig, label) {
  const issues = [];
  const svgM = fig.match(/<svg\b[^>]*>/i);
  if (!svgM) { issues.push(`${label}: figure has no SVG`); return issues; }
  const svgTag = svgM[0];
  if (!/viewBox="0 0 \d+ \d+"/.test(svgTag)) issues.push(`${label}: SVG missing viewBox (not responsive)`);
  if (/\bwidth="\d/.test(svgTag) || /\bheight="\d/.test(svgTag)) issues.push(`${label}: SVG has fixed pixel width/height on root (overflow/clipping risk)`);
  if (/style="[^"]*(width\s*:\s*\d+px|overflow\s*:\s*visible[^"]*scroll|min-width)[^"]*"/i.test(fig)) issues.push(`${label}: figure has a fixed-width / overflow inline style`);
  if (!/<figcaption|class="aep-caption"|class="ic-caption"/.test(fig)) issues.push(`${label}: figure missing caption`);
  return issues;
}

function listArticles(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html');
}

// ── 1) CSS stabilization must be present (regression guard). ──
let css = '';
try { css = fs.readFileSync(CSS, 'utf8'); } catch { fail('market-portal.css not found'); }
if (!/Phase 126: inline visual composition stabilization/.test(css)) fail('CSS visual-composition stabilization block missing (regression)');
if (!/figure\.institutional-chart svg[\s\S]*?max-width:\s*100%/.test(css) && !/article-evidence-panel svg[\s\S]*?max-width:\s*100%/.test(css)) fail('CSS missing svg max-width:100% guard');

// ── 2) Scan EN article bodies; require AR parity for each embedded figure. ──
let scanned = 0;
for (const [rel] of SURFACES) {
  if (rel.startsWith('ar/')) continue; // AR handled via its EN counterpart
  for (const f of listArticles(rel)) {
    const html = fs.readFileSync(path.join(ROOT, rel, f), 'utf8');
    const figs = html.match(FIGURE_RE) || [];
    if (!figs.length) continue;
    scanned += figs.length;
    figs.forEach((fig, i) => checkFigure(fig, `${rel}/${f}#${i + 1}`).forEach(fail));

    const arRel = `ar/${rel}`;
    const arPath = path.join(ROOT, arRel, f);
    if (!fs.existsSync(arPath)) { fail(`${rel}/${f}: missing AR counterpart for embedded visual`); continue; }
    const arHtml = fs.readFileSync(arPath, 'utf8');
    const arFigs = arHtml.match(FIGURE_RE) || [];
    if (arFigs.length !== figs.length) fail(`${arRel}/${f}: ${arFigs.length} figures vs EN ${figs.length} (parity break)`);
    if (!/<html[^>]+dir="rtl"/.test(arHtml)) fail(`${arRel}/${f}: AR article not RTL`);
    arFigs.forEach((fig, i) => checkFigure(fig, `${arRel}/${f}#${i + 1}`).forEach(fail));
  }
}

// ── Negative self-test. ──
if (process.argv.includes('--self-test')) {
  const bad = '<figure class="article-evidence-panel"><div class="aep-svg"><svg viewBox="0 0 1280 720" width="1280" height="720"></svg></div><figcaption class="aep-caption">x</figcaption></figure>';
  const good = '<figure class="article-evidence-panel"><div class="aep-svg"><svg viewBox="0 0 1280 720"></svg></div><figcaption class="aep-caption">x</figcaption></figure>';
  const badCaught = checkFigure(bad, 'b').some((x) => /fixed pixel width/.test(x));
  const goodClean = checkFigure(good, 'g').length === 0;
  console.log(`[visual-composition] self-test: ${badCaught && goodClean ? 'fixed-width rejected, responsive accepted' : 'FAILED'}`);
  process.exit(badCaught && goodClean ? 0 : 1);
}

if (failures.length) {
  failures.forEach((m) => console.error(`[visual-composition] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[visual-composition] check:visual-composition passed (CSS stabilized; ${scanned} embedded figure(s) responsive, captioned, bilingual, RTL-safe — no clipping/overflow).`);
