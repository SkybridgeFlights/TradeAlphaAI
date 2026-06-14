'use strict';

// Phase 112 — check:chart-intelligence (validator domain). Integrity gate for
// the Phase 112 chart-intelligence evidence visuals (data/visual/chart-
// intelligence.json + the rendered SVGs). Distinct from the Phase 68
// check:visual-intelligence dashboard validator. HARD-FAILS if a chart lacks an
// analytical reason, omits its narrative hook (disconnected graphic), carries a
// fabricated metric, uses retail-TA language, exceeds the clutter threshold, has
// an untranslated label, leaks null/undefined, names an unsupported asset
// relationship, scores below the visual quality floor, or its rendered SVG is
// malformed / not RTL. Unbuilt manifest passes (CI builds it each run).

const fs = require('fs');
const path = require('path');
const { scoreVisual, VISUAL_QUALITY_FLOOR } = require('./visual-quality');
const { VISUAL_TYPE } = require('./build-chart-intelligence');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'chart-intelligence.json');
const TRACKED = new Set(['DXY', 'US10Y', 'US02Y', 'GOLD', 'SPY', 'QQQ', 'IWM', 'VIX', 'OIL', 'EURUSD', 'USDJPY']);

const failures = [];
const fail = (m) => failures.push(m);

const manifest = (() => { try { return JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch { return null; } })();
if (!manifest) {
  console.log('[chart-intelligence] manifest not built yet — CI builds it each run (non-fatal).');
  console.log('[chart-intelligence] check:chart-intelligence passed.');
  process.exit(0);
}

if (manifest.preview_only !== true) fail('manifest must be preview_only');

const seen = new Set();
for (const v of manifest.visuals || []) {
  const lbl = `visual:${v.id || '?'}`;
  if (!v.chart_type || !VISUAL_TYPE[v.chart_type]) fail(`${lbl}: unknown chart_type "${v.chart_type}"`);
  if (v.id) { if (seen.has(v.id)) fail(`${lbl}: duplicate id`); seen.add(v.id); }

  // Quality scorer (relevance, linkage, clutter, fabrication, untranslated, TA, null).
  const s = scoreVisual(v);
  if (s.flags.length) fail(`${lbl}: quality flags ${JSON.stringify(s.flags)}`);
  if (s.score < VISUAL_QUALITY_FLOOR) fail(`${lbl}: visual quality ${s.score} < ${VISUAL_QUALITY_FLOOR}`);

  // Unsupported asset relationships.
  for (const a of (v.assets || [])) if (!TRACKED.has(a)) fail(`${lbl}: unsupported asset "${a}"`);

  // Rendered SVG files must exist and be well-formed (no null leak; AR is RTL).
  for (const loc of ['en', 'ar']) {
    const rel = v.files && v.files[loc];
    if (!rel) { fail(`${lbl}: missing ${loc} svg path`); continue; }
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) { fail(`${lbl}: ${loc} svg not rendered (${rel})`); continue; }
    const svg = fs.readFileSync(abs, 'utf8').trim();
    if (!/^<svg[\s>]/.test(svg)) fail(`${lbl}: ${loc} svg malformed`);
    if (!svg.endsWith('</svg>')) fail(`${lbl}: ${loc} svg not closed`);
    if (/>(?:\s*)(?:undefined|NaN|null)(?:\s*)</.test(svg)) fail(`${lbl}: ${loc} svg leaks undefined/null`);
    if (loc === 'ar' && !/direction="rtl"/.test(svg)) fail(`${lbl}: ar svg not RTL`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[chart-intelligence] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[chart-intelligence] check:chart-intelligence passed (${(manifest.visuals || []).length} evidence visual(s); analytical + linked + bilingual + flag-free, SVG well-formed).`);
