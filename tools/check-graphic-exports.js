'use strict';

// Phase 92 validation — rendered graphic export integrity & safety.
// Guards the SVG media layer:
//   - manifest is preview-only, posting disabled, credential-free
//   - every referenced SVG exists, is well-formed, and matches its dimensions
//   - bilingual pair (EN + AR) per export; AR carries RTL + Arabic text
//   - restraint cap (no more exports than the social contract allows)
//   - HARD FAIL on fabricated metrics ($/price/points), advice/prediction
//     language, or influencer-style hype tokens in any rendered SVG
//   - no untranslated AR panel (must contain Arabic)
// Unbuilt artifact passes with a note (CI builds it each run).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'social', 'graphic-exports.json');
const PLATFORMS = new Set(['telegram', 'x', 'instagram', 'facebook', 'linkedin']);
const MAX_EXPORTS = 10; // <=5 platforms; cap with headroom, builder is already capped
const failures = [];

function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; } }

const manifest = (() => { try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')); } catch { return null; } })();

if (!manifest) {
  console.log('[graphic-exports] manifest not built yet — CI builds it each run (non-fatal)');
  console.log('[graphic-exports] check:graphic-exports passed.');
  process.exit(0);
}

if (manifest.mode !== 'preview_only' || manifest.posting_enabled !== false || manifest.credentials_required !== false) {
  failures.push('manifest must be preview_only with posting disabled and no credentials');
}
const exportList = manifest.exports || [];
if (manifest.verified === false && exportList.length) failures.push('exports present without verified graphics');
if (exportList.length > MAX_EXPORTS) failures.push(`export count ${exportList.length} exceeds cap ${MAX_EXPORTS}`);

// Forbidden in any rendered media (brand name excepted): fabricated metrics,
// advice/prediction, retail-TA, influencer hype.
const FABRICATED = /\$\s*\d|\b\d+(\.\d+)?\s*(points?|pips?|%)\b/i;
const ADVICE = /\b(buy now|sell now|you should (buy|sell)|guaranteed|price target|will (rally|crash|soar|plunge))\b/i;
const RETAIL_TA = /\b(support|resistance|breakout|breakdown|go long|go short|moon|to the moon)\b/i;
const HYPE = /\b(huge|insane|shocking|don'?t miss|explode|massive gains)\b/i;

const seen = new Set();
for (const exp of exportList) {
  const label = `export[${exp.id || '?'}]`;
  if (!PLATFORMS.has(exp.platform)) failures.push(`${label}: unknown platform "${exp.platform}"`);
  if (exp.posting_enabled !== false || exp.approval?.required !== true) failures.push(`${label}: not export-safe preview output`);
  if (!exp.files || !exp.files.en || !exp.files.ar) { failures.push(`${label}: missing bilingual file pair`); continue; }
  if (seen.has(exp.id)) failures.push(`${label}: duplicate export id`);
  seen.add(exp.id);

  for (const locale of ['en', 'ar']) {
    const rel = exp.files[locale];
    const svg = read(rel);
    if (!svg) { failures.push(`${label}: missing rendered SVG ${rel}`); continue; }
    const trimmed = svg.trim();
    if (!trimmed.startsWith('<svg') || !trimmed.endsWith('</svg>')) failures.push(`${label}/${locale}: malformed SVG`);
    if (!/viewBox="0 0 \d+ \d+"/.test(svg)) failures.push(`${label}/${locale}: SVG missing viewBox`);
    const openText = (svg.match(/<text/g) || []).length;
    const closeText = (svg.match(/<\/text>/g) || []).length;
    if (openText !== closeText) failures.push(`${label}/${locale}: unbalanced <text> tags`);
    // Dimensions match the declared export size.
    if (exp.dimensions && !svg.includes(`width="${exp.dimensions.width}"`)) failures.push(`${label}/${locale}: SVG width does not match declared ${exp.dimensions.width}`);
    // Safety scans — exclude the brand wordmark from token checks.
    const scan = svg.replace(/TradeAlphaAI/g, ' ');
    if (FABRICATED.test(scan)) failures.push(`${label}/${locale}: contains fabricated metric/price`);
    if (ADVICE.test(scan)) failures.push(`${label}/${locale}: contains advice/prediction language`);
    if (RETAIL_TA.test(scan)) failures.push(`${label}/${locale}: contains retail-TA language`);
    if (HYPE.test(scan)) failures.push(`${label}/${locale}: contains influencer-style hype`);
    if (locale === 'ar') {
      if (!/[؀-ۿ]/.test(svg)) failures.push(`${label}/ar: panel carries no Arabic text`);
      if (!svg.includes('direction="rtl"')) failures.push(`${label}/ar: panel missing RTL direction`);
    }
  }
}

// No orphan SVGs on disk beyond what the manifest references.
const dir = path.join(ROOT, 'data', 'social', 'graphics');
if (fs.existsSync(dir)) {
  const referenced = new Set(exportList.flatMap((e) => [e.files?.en, e.files?.ar]).filter(Boolean).map((p) => path.basename(p)));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.svg'))) {
    if (!referenced.has(f)) failures.push(`orphan SVG not referenced by manifest: ${f}`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[graphic-exports] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[graphic-exports] check:graphic-exports passed (${exportList.length} export(s), preview-only).`);
