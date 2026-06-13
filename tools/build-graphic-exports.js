'use strict';

// Phase 92 — Rendered graphic exports.
// Renders the verified Phase 89 social-graphics composition contracts into
// real institutional SVG panels (one EN + one AR per platform export), writes
// them to data/social/graphics/, and records a manifest.
//
// PREVIEW ONLY: posting stays disabled, no credentials are read. Restraint is
// inherited from build-editorial-graphics (verified-only, density-capped); an
// unverified/calm window renders nothing and the manifest is empty. SVG is the
// deterministic source; a PNG rasterization step can consume these files later
// without changing this layer.
//
// Output: data/social/graphics/<platform>-<graphic_id>-<locale>.svg
//         data/social/graphic-exports.json (manifest)
// Usage:  node tools/build-graphic-exports.js --write

const fs = require('fs');
const path = require('path');
const { renderGraphicSVG } = require('./render-graphic-svg');

const ROOT = path.resolve(__dirname, '..');
const GRAPHICS_PATH = path.join(ROOT, 'data', 'visual', 'editorial-graphics.json');
const SOCIAL_PATH = path.join(ROOT, 'data', 'social', 'social-graphics-preview.json');
const OUT_DIR = path.join(ROOT, 'data', 'social', 'graphics');
const MANIFEST_PATH = path.join(ROOT, 'data', 'social', 'graphic-exports.json');
const STALE_HOURS = 48;

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function fresh(a) {
  if (!a || !a.updated_at) return false;
  return (Date.now() - new Date(a.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

function buildExports() {
  const graphics = readJson(GRAPHICS_PATH);
  const social = readJson(SOCIAL_PATH);
  const nowIso = new Date().toISOString();

  const verified = Boolean(graphics && graphics.verified === true && fresh(graphics)
    && social && social.verified === true && fresh(social));

  if (!verified) {
    return {
      manifest: {
        version: '1.0', updated_at: nowIso, verified: false, mode: 'preview_only',
        posting_enabled: false, credentials_required: false, exports: [],
        note: 'No verified graphics this cycle — no media rendered (restraint).',
      },
      files: [],
    };
  }

  const byId = new Map((graphics.graphics || []).map((g) => [g.id, g]));
  const exports = [];
  const files = [];

  for (const exp of social.exports || []) {
    const graphic = byId.get(exp.graphic_id);
    if (!graphic) continue; // stale cross-ref — skip (graphics build owns consistency)
    const dims = exp.dimensions || { width: 1280, height: 720 };
    const rendered = {};
    for (const locale of ['en', 'ar']) {
      const svg = renderGraphicSVG(graphic, { width: dims.width, height: dims.height, locale });
      const fname = `${exp.platform}-${exp.graphic_id}-${locale}.svg`;
      rendered[locale] = `data/social/graphics/${fname}`;
      files.push({ fname, svg });
    }
    exports.push({
      id: exp.id,
      platform: exp.platform,
      graphic_id: exp.graphic_id,
      dimensions: dims,
      files: rendered,
      format: 'svg',
      png_pipeline: 'deferred (rasterize SVG on demand)',
      mode: 'preview_only',
      posting_enabled: false,
      approval: { required: true, status: 'preview' },
      source_hash: graphic.source_hash || null,
      generated_at: nowIso,
    });
  }

  return {
    manifest: {
      version: '1.0', updated_at: nowIso, verified: true, mode: 'preview_only',
      posting_enabled: false, credentials_required: false,
      source_artifact: 'data/social/social-graphics-preview.json',
      renderer: 'tools/render-graphic-svg.js',
      visual_language: 'institutional-editorial-v1',
      exports,
    },
    files,
  };
}

function main() {
  const write = process.argv.includes('--write');
  const { manifest, files } = buildExports();
  console.log(`[graphic-exports] verified=${manifest.verified} exports=${manifest.exports.length} files=${files.length}`);
  if (write) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    // Remove stale SVGs so the directory always matches the current manifest.
    for (const old of fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.svg')) : []) {
      fs.rmSync(path.join(OUT_DIR, old), { force: true });
    }
    for (const f of files) fs.writeFileSync(path.join(OUT_DIR, f.fname), f.svg, 'utf8');
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    console.log(`[graphic-exports] wrote ${files.length} SVG file(s) + manifest`);
  }
}

if (require.main === module) main();

module.exports = { buildExports };
