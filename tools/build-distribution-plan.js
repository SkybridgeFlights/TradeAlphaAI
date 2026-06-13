'use strict';

// Phase 93 — Distribution Brain.
// A dedicated, platform-aware distribution orchestration layer that sits above
// the per-item social previews. It surveys every available editorial surface
// (latest market outlook, daily brief, macro news, continuous intelligence,
// rendered graphics) and routes each to its target platforms via the canonical
// content-type relevance matrix, combined with the per-item social relevance
// where one exists.
//
// PREVIEW ONLY: posting stays disabled, no credentials are read or required.
// This produces a routing plan a future approval/delivery layer can consume —
// it never delivers anything itself. Surfaces without a verified source are
// omitted (no orphan routing); a fully quiet cycle yields an empty plan.
//
// Output: data/social/distribution-plan.json
// Usage:  node tools/build-distribution-plan.js --write

const fs = require('fs');
const path = require('path');
const { platformsForContentType, combinedRelevance, normalizeType } = require('./platform-relevance');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'social', 'distribution-plan.json');
const STALE_HOURS = 48;

const SOURCES = {
  social: 'data/social/social-preview.json',
  graphicExports: 'data/social/graphic-exports.json',
  brief: 'data/intelligence/daily-intelligence-brief.json',
  outlooks: 'data/feeds/latest-market-outlooks.json',
};

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function fresh(a) {
  if (!a || !a.updated_at) return false;
  return (Date.now() - new Date(a.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

// Best per-platform social relevance for a content type, from the existing
// social previews (so the plan honors the per-item scoring already computed).
function socialScoresByPlatform(social) {
  const map = {};
  for (const p of (social && social.previews) || []) {
    const platform = p.platform === 'x-thread' ? 'x' : p.platform;
    const score = Number(p.distribution_relevance_score);
    if (!Number.isFinite(score)) continue;
    if (!map[platform] || score > map[platform]) map[platform] = score;
  }
  return map;
}

function routeSurface({ contentType, surfaceId, title, url, hasMedia, socialScores }) {
  const targets = platformsForContentType(contentType)
    .map(({ platform, affinity }) => ({
      platform,
      affinity,
      relevance: combinedRelevance(contentType, platform, socialScores[platform]),
    }))
    .sort((a, b) => b.relevance - a.relevance);
  if (!targets.length) return null;
  return {
    surface_id: surfaceId,
    content_type: normalizeType(contentType),
    title: title || null,
    url: url || null,
    has_rendered_media: Boolean(hasMedia),
    target_platforms: targets,
    posting_enabled: false,
    approval: { required: true, status: 'planned' },
  };
}

function buildDistributionPlan() {
  const social = readJson(SOURCES.social);
  const graphicExports = readJson(SOURCES.graphicExports);
  const brief = readJson(SOURCES.brief);
  const outlooksRaw = readJson(SOURCES.outlooks);
  const nowIso = new Date().toISOString();

  const socialScores = socialScoresByPlatform(social);
  const surfaces = [];

  // Latest market outlook (text + optional rendered media).
  const outlookArr = Array.isArray(outlooksRaw) ? outlooksRaw
    : outlooksRaw ? Object.values(outlooksRaw).filter((v) => v && typeof v === 'object' && (v.slug || v.title_en)) : [];
  const outlook = outlookArr[0];
  if (outlook && outlook.slug) {
    surfaces.push(routeSurface({
      contentType: 'market-outlook', surfaceId: `outlook:${outlook.slug}`,
      title: outlook.title_en, url: outlook.url_en || `/market-outlook/${outlook.slug}.html`,
      hasMedia: false, socialScores,
    }));
  }

  // Daily intelligence brief (verified only).
  if (fresh(brief) && brief.verified === true) {
    surfaces.push(routeSurface({
      contentType: 'daily-brief', surfaceId: 'brief:daily-intelligence',
      title: 'Daily intelligence brief', url: '/', hasMedia: false, socialScores,
    }));
  }

  // Rendered institutional graphics (verified media exports).
  if (graphicExports && graphicExports.verified === true && (graphicExports.exports || []).length) {
    const platforms = [...new Set(graphicExports.exports.map((e) => e.platform))];
    surfaces.push({
      ...routeSurface({ contentType: 'institutional-graphic', surfaceId: 'graphics:editorial', title: 'Institutional graphic panels', url: null, hasMedia: true, socialScores }),
      available_media_platforms: platforms,
    });
  }

  const plan = surfaces.filter(Boolean);
  return {
    version: '1.0',
    updated_at: nowIso,
    mode: 'preview_only',
    posting_enabled: false,
    credentials_required: false,
    relevance_source: 'tools/platform-relevance.js',
    surfaces: plan,
    surface_count: plan.length,
    note: plan.length ? null : 'No verified editorial surface available this cycle — distribution plan intentionally empty.',
    policy: {
      platform_aware: true,
      content_type_routed: true,
      copy_paste_posting: false,
      automatic_posting: false,
    },
  };
}

function main() {
  const write = process.argv.includes('--write');
  const plan = buildDistributionPlan();
  console.log(`[distribution-plan] surfaces=${plan.surface_count}${plan.surfaces.map((s) => ` ${s.content_type}→[${s.target_platforms.map((t) => t.platform).join(',')}]`).join('')}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(plan, null, 2) + '\n', 'utf8');
    console.log('[distribution-plan] wrote data/social/distribution-plan.json');
  }
}

if (require.main === module) main();

module.exports = { buildDistributionPlan, routeSurface, socialScoresByPlatform };
