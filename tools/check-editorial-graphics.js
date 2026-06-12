'use strict';

const fs = require('fs');
const path = require('path');
const {
  VISUAL_TYPES,
  ANNOTATION_TYPES,
  EXPORT_TARGETS,
} = require('./editorial-visual-language');
const { buildArtifacts } = require('./build-editorial-graphics');

const ROOT = path.resolve(__dirname, '..');
const GRAPHICS_PATH = path.join(ROOT, 'data', 'visual', 'editorial-graphics.json');
const SOCIAL_PATH = path.join(ROOT, 'data', 'social', 'social-graphics-preview.json');
const CSS_PATH = path.join(ROOT, 'css', 'editorial-graphics.css');
const RENDERER_PATH = path.join(ROOT, 'tools', 'render-editorial-graphics.js');

const failures = [];
const warnings = [];

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(ROOT, file)} is missing or invalid JSON: ${error.message}`);
    return {};
  }
}

function requireField(object, field, label) {
  if (object?.[field] === undefined || object?.[field] === null || object?.[field] === '') {
    failures.push(`${label} missing ${field}`);
  }
}

function hasArabic(value) {
  return /[\u0600-\u06ff]/.test(String(value || ''));
}

function symbolKey(graphic) {
  return [...(graphic.chart_symbol_refs || [])].sort().join('|');
}

function validateLanguage(text, label) {
  const forbidden = [
    /\b(buy|sell|entry|exit|target price|stop loss|guaranteed|sure win|100x|moon|pump|crash incoming)\b/i,
    /\b(will rally|will fall|will rise|will crash|likely breakout)\b/i,
    /\b(breaking news|act now|don't miss|huge opportunity)\b/i,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(String(text || ''))) failures.push(`${label} contains prohibited advice, prediction, or retail language: ${pattern}`);
  }
}

function validateGraphic(graphic, index) {
  const label = `graphics[${index}]`;
  [
    'id', 'visual_type', 'headline_en', 'headline_ar', 'narrative_context',
    'evidence_refs', 'allowed_platforms', 'visual_priority',
    'calm_mode_compatible', 'export_targets', 'chart_symbol_refs',
    'annotations', 'rendering_contract', 'attribution', 'verified',
    'stale', 'generated_at',
  ].forEach((field) => requireField(graphic, field, label));
  if (!VISUAL_TYPES.includes(graphic.visual_type)) failures.push(`${label} has unsupported visual_type`);
  if (graphic.verified !== true || graphic.stale !== false || graphic.status !== 'active') {
    failures.push(`${label} is not an active, verified, fresh graphic`);
  }
  if (!hasArabic(graphic.headline_ar) || !hasArabic(graphic.narrative_context?.ar)) {
    failures.push(`${label} lacks native Arabic headline/context parity`);
  }
  if (!Array.isArray(graphic.evidence_refs) || !graphic.evidence_refs.length) {
    failures.push(`${label} must carry evidence references`);
  }
  if (!graphic.attribution || String(graphic.attribution).length < 12) failures.push(`${label} attribution is insufficient`);
  if ((graphic.annotations || []).length > 3) failures.push(`${label} exceeds annotation density`);
  if ((graphic.chart_symbol_refs || []).length > 4) failures.push(`${label} exceeds symbol density`);
  if (graphic.rendering_contract?.hydration_required !== false || graphic.rendering_contract?.static_render !== true) {
    failures.push(`${label} rendering contract is not static-first`);
  }
  if (graphic.rendering_contract?.data_policy !== 'verified-evidence-only') {
    failures.push(`${label} does not enforce verified evidence`);
  }
  if ('prices' in graphic || 'series' in graphic || 'forecast' in graphic) {
    failures.push(`${label} contains an uncontracted financial data series or forecast`);
  }
  for (const annotation of graphic.annotations || []) {
    if (!ANNOTATION_TYPES.includes(annotation.type)) failures.push(`${label} has unsupported annotation type ${annotation.type}`);
    if (!graphic.evidence_refs.includes(annotation.evidence_ref)) failures.push(`${label} annotation lacks legitimate evidence linkage`);
    if (!annotation.label_en || !hasArabic(annotation.label_ar)) failures.push(`${label} annotation lacks bilingual parity`);
  }
  for (const target of graphic.export_targets || []) {
    if (!EXPORT_TARGETS[target.target]) failures.push(`${label} has unsupported export target ${target.target}`);
    if (!target.width || !target.height || !target.safe_area) failures.push(`${label} export target ${target.target} is incomplete`);
  }
  validateLanguage(`${graphic.headline_en} ${graphic.narrative_context?.en}`, label);
}

function validateSyntheticSafety() {
  const now = new Date();
  const timestamp = now.toISOString();
  const unverified = {
    charts: { verified: false, updated_at: timestamp, selected: [{ id: 'fake' }] },
    cognition: { verified: false, updated_at: timestamp },
    convergence: { verified: false, updated_at: timestamp, diverges: [{ id: 'fake' }] },
    tension: { verified: false, updated_at: timestamp, tension_score: 90 },
    memory: { verified: false, updated_at: timestamp },
    pulse: { verified: false, updated_at: timestamp, catalysts_today: [{ name: 'Fake', time: timestamp }] },
    social: { verified: false, updated_at: timestamp },
  };
  const result = buildArtifacts(unverified, {}, now);
  if (result.artifact.graphics.length) failures.push('unverified synthetic input produced active graphics');
  if (result.social.exports.length) failures.push('unverified synthetic input produced social exports');
}

function main() {
  const artifact = readJson(GRAPHICS_PATH);
  const social = readJson(SOCIAL_PATH);
  const css = fs.existsSync(CSS_PATH) ? fs.readFileSync(CSS_PATH, 'utf8') : '';
  const renderer = fs.existsSync(RENDERER_PATH) ? fs.readFileSync(RENDERER_PATH, 'utf8') : '';

  if (artifact.verified !== true || artifact.stale !== false) failures.push('editorial graphics artifact is not verified/fresh');
  if (!['calm-restraint', 'elevated-density'].includes(artifact.mode)) failures.push('artifact mode is invalid');
  const graphics = artifact.graphics || [];
  if (artifact.mode === 'calm-restraint' && graphics.length > 2) failures.push('calm mode exceeds two active graphics');
  if (graphics.length > 4) failures.push('visual overcrowding: more than four active graphics');
  graphics.forEach(validateGraphic);

  const ids = graphics.map((item) => item.id);
  if (new Set(ids).size !== ids.length) failures.push('duplicate graphic ids detected');
  const symbolSets = graphics.map(symbolKey).filter(Boolean);
  if (new Set(symbolSets).size !== symbolSets.length) failures.push('duplicate chart/symbol composition detected');

  if (social.mode !== 'preview_only' || social.posting_enabled !== false || social.credentials_required !== false) {
    failures.push('social graphics must remain credential-free preview-only output');
  }
  for (const item of social.exports || []) {
    if (item.posting_enabled !== false || item.approval?.required !== true) failures.push(`${item.id} is not export-safe preview output`);
    if (!ids.includes(item.graphic_id)) failures.push(`${item.id} references an inactive graphic`);
    if (!item.image_composition_contract?.attribution) failures.push(`${item.id} lacks export attribution`);
  }

  [
    ['responsive rules', /@media\s*\(max-width:/],
    ['RTL rules', /\[dir="rtl"\]/],
    ['reduced-motion rules', /prefers-reduced-motion/],
    ['lazy static rendering', /content-visibility:\s*auto/],
  ].forEach(([name, pattern]) => {
    if (!pattern.test(css)) failures.push(`editorial graphics CSS missing ${name}`);
  });
  if (/neon|drop-shadow|box-shadow|@keyframes/i.test(css)) failures.push('editorial graphics CSS contains noisy retail-style effects');
  if (!/renderNewswireGraphicSection/.test(renderer) || !/injectEditorialGraphic/.test(renderer)) {
    failures.push('renderer lacks article/newswire integration contracts');
  }
  if (/canvas|getContext|requestAnimationFrame|fetch\s*\(/.test(renderer)) {
    failures.push('renderer introduces client rendering, animation, or network dependencies');
  }

  validateSyntheticSafety();

  if (!graphics.length) warnings.push('No graphics selected; this is acceptable only when verified editorial relevance is absent.');
  if (failures.length) {
    console.error(`[editorial-graphics] FAIL (${failures.length})`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`[editorial-graphics] PASS: ${graphics.length} active graphic(s), ${(social.exports || []).length} social export preview(s).`);
  warnings.forEach((warning) => console.warn(`[editorial-graphics] WARN: ${warning}`));
}

main();
