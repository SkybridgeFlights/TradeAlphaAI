'use strict';

// Phase 119 - deterministic educational-explainer integrity gate.

const fs = require('fs');
const path = require('path');
const { CONCEPT_LIBRARY } = require('./generate-educational-article');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'data', 'visual', 'educational-explainers.json');
const MIN_EXPLAINERS = 6;
const ARABIC = /[\u0600-\u06ff]/;
const PLACEHOLDER = /\b(?:todo|tbd|placeholder|lorem ipsum|coming soon|sample text|undefined|null|nan)\b/i;
const ADVICE = /\b(?:buy now|sell now|you should (?:buy|sell)|price target|entry point|exit point|guaranteed returns?|will (?:rally|crash|soar|plunge))\b/i;
const FABRICATED_METRIC = /(?:[$\u00a3\u20ac]\s*\d|\b\d+(?:\.\d+)?\s*(?:%|bps?\b|basis points?\b|points?\b|x\b)|\b(?:price|yield|return|forecast|target)\s*[:=]\s*\d)/i;

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function read(file) {
  try { return fs.readFileSync(file, 'utf8'); } catch { return null; }
}

function value(entry, ...keys) {
  for (const key of keys) if (entry && typeof entry[key] === 'string' && entry[key].trim()) return entry[key].trim();
  return '';
}

function visibleSvgText(svg) {
  return String(svg || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function manifestEntries(manifest) {
  if (Array.isArray(manifest)) return manifest;
  return manifest && (manifest.explainers || manifest.visuals || manifest.items) || [];
}

function filesFor(entry) {
  const files = entry.files || entry.svg || entry.assets || {};
  return {
    en: value(entry, 'file_en', 'svg_en') || value(files, 'en'),
    ar: value(entry, 'file_ar', 'svg_ar') || value(files, 'ar'),
  };
}

function purposeFor(entry) {
  const purpose = entry.purpose || entry.visual_purpose || {};
  return {
    en: value(entry, 'purpose_en') || value(purpose, 'en'),
    ar: value(entry, 'purpose_ar') || value(purpose, 'ar'),
  };
}

function safeAssetPath(rel) {
  if (!rel || path.isAbsolute(rel)) return null;
  const resolved = path.resolve(ROOT, rel.replace(/^\//, ''));
  return resolved.startsWith(ROOT + path.sep) ? resolved : null;
}

function validateVisuals(manifest, fileReader = read, conceptLibrary = CONCEPT_LIBRARY, scanArticles = true) {
  const failures = [];
  const entries = manifestEntries(manifest);
  if (!Array.isArray(entries) || entries.length < MIN_EXPLAINERS) {
    failures.push(`visual manifest has ${Array.isArray(entries) ? entries.length : 0} explainers; minimum is ${MIN_EXPLAINERS}`);
    return failures;
  }

  const ids = new Set();
  for (const entry of entries) {
    const id = value(entry, 'id', 'concept_id', 'concept_slug', 'slug');
    const label = id || '<unknown>';
    if (!id) failures.push('visual explainer missing concept id');
    else if (ids.has(id)) failures.push(`${label}: duplicate visual explainer`);
    else ids.add(id);
    if (!conceptLibrary[id]) failures.push(`${label}: visual has no educational concept`);

    const purpose = purposeFor(entry);
    if (purpose.en.length < 25) failures.push(`${label}: substantive English visual purpose missing`);
    if (purpose.ar.length < 20 || !ARABIC.test(purpose.ar)) failures.push(`${label}: substantive native Arabic visual purpose missing`);
    const source = value(entry, 'source', 'attribution', 'source_label');
    if (!source) failures.push(`${label}: source/attribution missing`);
    if (entry.metric_free !== true) failures.push(`${label}: metric_free must be true`);
    if (entry.verified !== true) failures.push(`${label}: verified must be true`);

    const files = filesFor(entry);
    for (const locale of ['en', 'ar']) {
      const asset = safeAssetPath(files[locale]);
      if (!asset) {
        failures.push(`${label}:${locale}: safe SVG path missing`);
        continue;
      }
      const svg = fileReader(asset);
      if (!svg) {
        failures.push(`${label}:${locale}: SVG missing (${files[locale]})`);
        continue;
      }
      if (!/<svg\b/i.test(svg) || !/<\/svg>/i.test(svg)) failures.push(`${label}:${locale}: invalid SVG document`);
      if (/<script\b|<foreignObject\b|on(?:load|click|error)\s*=/i.test(svg)) failures.push(`${label}:${locale}: active or unsafe SVG content`);
      if (!/<title\b[^>]*>[\s\S]+?<\/title>/i.test(svg) || !/<desc\b[^>]*>[\s\S]+?<\/desc>/i.test(svg)) failures.push(`${label}:${locale}: accessible title/description missing`);
      if (locale === 'ar' && !/(?:dir|direction)=["']rtl["']/i.test(svg)) failures.push(`${label}: Arabic SVG is not RTL`);
      const visible = visibleSvgText(svg);
      if (locale === 'ar' && !ARABIC.test(visible)) failures.push(`${label}: Arabic SVG lacks Arabic explanatory text`);
      if (PLACEHOLDER.test(visible)) failures.push(`${label}:${locale}: placeholder/null leak in visual`);
      if (ADVICE.test(visible)) failures.push(`${label}:${locale}: advice/directional language in visual`);
      if (FABRICATED_METRIC.test(visible)) failures.push(`${label}:${locale}: numeric financial claim violates metric-free explainer contract`);
    }
  }

  const articleRoots = scanArticles ? [
    { dir: path.join(ROOT, 'articles'), locale: 'en' },
    { dir: path.join(ROOT, 'ar', 'articles'), locale: 'ar' },
  ] : [];
  for (const root of articleRoots) {
    if (!fs.existsSync(root.dir)) continue;
    const files = fs.readdirSync(root.dir).filter((file) => file.endsWith('.html') && file !== 'index.html');
    for (const file of files) {
      const html = read(path.join(root.dir, file)) || '';
      if (!html.includes('data-educational-article=')) continue;
      const figures = (html.match(/<figure\b[\s\S]*?<\/figure>/gi) || [])
        .filter((figure) => /data-educational-visual|educational-explainer|data\/visual\/educational-explainers/i.test(figure));
      if (figures.length > 1) failures.push(`${root.locale}/${file}: ${figures.length} educational visuals; maximum is one`);
      for (const figure of figures) {
        if (!/<figcaption\b[\s\S]*?<\/figcaption>/i.test(figure)) failures.push(`${root.locale}/${file}: educational visual lacks purpose caption`);
        if (!/(?:purpose|explains?|illustrates?|maps?|clarifies?|\u064a\u0648\u0636\u062d|\u064a\u0634\u0631\u062d|\u064a\u0631\u0633\u0645)/i.test(visibleSvgText(figure))) failures.push(`${root.locale}/${file}: visual caption does not state explanatory purpose`);
      }
    }
  }

  return failures;
}

function fixtureManifest(name) {
  const assets = new Map();
  const concepts = {};
  const entries = Array.from({ length: MIN_EXPLAINERS }, (_, index) => {
    const id = `fixture-${index + 1}`;
    concepts[id] = { slug: id };
    const en = `data/visual/educational-explainers/${id}-en.svg`;
    const ar = `data/visual/educational-explainers/${id}-ar.svg`;
    assets.set(path.resolve(ROOT, en), '<svg><title>Structure</title><desc>Concept relationship</desc><text>Liquidity transmission relationship</text></svg>');
    assets.set(path.resolve(ROOT, ar), '<svg direction="rtl"><title>\u0627\u0644\u0628\u0646\u064a\u0629</title><desc>\u0639\u0644\u0627\u0642\u0629 \u0627\u0644\u0645\u0641\u0647\u0648\u0645</desc><text>\u0627\u0646\u062a\u0642\u0627\u0644 \u0627\u0644\u0633\u064a\u0648\u0644\u0629</text></svg>');
    return {
      id,
      purpose_en: 'Explain the causal relationship without live metrics.',
      purpose_ar: '\u064a\u0648\u0636\u062d \u0627\u0644\u0639\u0644\u0627\u0642\u0629 \u0627\u0644\u0633\u0628\u0628\u064a\u0629 \u062f\u0648\u0646 \u0645\u0642\u0627\u064a\u064a\u0633 \u062d\u064a\u0629.',
      source: 'TradeAlphaAI educational concept library',
      metric_free: true,
      verified: true,
      files: { en, ar },
    };
  });
  if (name === 'missing-purpose') entries[0].purpose_en = '';
  else if (name === 'fake-metric') assets.set(path.resolve(ROOT, entries[0].files.en), '<svg><title>Metric</title><desc>Claim</desc><text>Return 12%</text></svg>');
  else if (name === 'advice') assets.set(path.resolve(ROOT, entries[0].files.en), '<svg><title>Advice</title><desc>Claim</desc><text>Buy now</text></svg>');
  else if (name === 'rtl') assets.set(path.resolve(ROOT, entries[0].files.ar), '<svg><title>\u0627\u0644\u0628\u0646\u064a\u0629</title><desc>\u0639\u0644\u0627\u0642\u0629</desc><text>\u0627\u0644\u0633\u064a\u0648\u0644\u0629</text></svg>');
  else if (name === 'null') assets.set(path.resolve(ROOT, entries[0].files.en), '<svg><title>Structure</title><desc>Concept</desc><text>undefined</text></svg>');
  else {
    console.error(`[educational-visuals] unknown negative fixture: ${name}`);
    process.exit(2);
  }
  return { manifest: { explainers: entries }, reader: (file) => assets.get(file) || null, concepts };
}

const negativeArg = process.argv.find((arg) => arg.startsWith('--negative-fixture='));
if (negativeArg) {
  const fixture = fixtureManifest(negativeArg.split('=')[1]);
  const failures = validateVisuals(fixture.manifest, fixture.reader, fixture.concepts, false);
  if (!failures.length) {
    console.error('[educational-visuals] FAIL: negative fixture was accepted');
    process.exit(0);
  }
  failures.forEach((failure) => console.error(`[educational-visuals] FAIL: ${failure}`));
  process.exit(1);
}

const manifest = readJson(MANIFEST_PATH);
const failures = validateVisuals(manifest);
if (failures.length) {
  failures.forEach((failure) => console.error(`[educational-visuals] FAIL: ${failure}`));
  process.exit(1);
}

console.log(`[educational-visuals] passed (${manifestEntries(manifest).length} deterministic bilingual explainers).`);

module.exports = { validateVisuals };
