'use strict';

// Phase 89 institutional visual language. These tokens are contracts for
// static HTML, future image exporters, and platform composition adapters.
// They deliberately exclude neon, oversized arrows, and decorative motion.

const VISUAL_LANGUAGE = Object.freeze({
  version: '1.0',
  typography: {
    display: { family: 'var(--font-display, Georgia, serif)', weight: 600, tracking: '-0.025em' },
    interface: { family: 'var(--font-sans, Arial, sans-serif)', weight: 600, tracking: '0.04em' },
    data: { family: 'var(--font-mono, Consolas, monospace)', weight: 500, tracking: '-0.01em' },
    hierarchy: ['kicker', 'headline', 'structural_read', 'evidence', 'attribution'],
  },
  spacing: {
    unit: 4,
    rhythm: [4, 8, 12, 16, 24, 32, 48],
    card_padding: { compact: 18, standard: 24, expanded: 32 },
  },
  color: {
    surface: '#0c1118',
    surface_raised: '#121923',
    surface_quiet: '#10161e',
    text: '#eef2f5',
    text_muted: '#9aa7b5',
    rule: '#27313d',
    gold: '#d8b15a',
    intelligence_blue: '#6d91b8',
    monitoring: '#71808f',
    stress: '#b46d63',
    positive: '#6f9a82',
  },
  arabic: {
    family: 'var(--font-arabic, "Noto Sans Arabic", Tahoma, sans-serif)',
    headline_line_height: 1.45,
    body_line_height: 1.8,
    minimum_body_size: 15,
    alignment: 'start',
    numeral_policy: 'preserve-source',
  },
  annotation: {
    maximum: 3,
    minimum_clearance_px: 20,
    placement: ['edge-start', 'edge-end', 'lower-band'],
    connector: 'one-pixel-rule',
    evidence_reference_required: true,
  },
  grid: {
    columns: 12,
    desktop_max_width: 1180,
    article_span: 9,
    mobile_columns: 1,
  },
  density: {
    maximum_primary_ideas: 1,
    maximum_labels: 5,
    maximum_symbols: 4,
    calm_graphics_per_surface: 2,
    stress_graphics_per_surface: 4,
  },
  whitespace: {
    minimum_outer_margin_ratio: 0.07,
    minimum_quiet_area_ratio: 0.28,
    annotation_clearance_ratio: 0.08,
  },
  motion: {
    allowed: false,
    reduced_motion_required: true,
  },
});

const EXPORT_TARGETS = Object.freeze({
  'article-inline': { width: 1200, height: 675, ratio: '16:9', safe_area: 72 },
  'outlook-inline': { width: 1200, height: 675, ratio: '16:9', safe_area: 72 },
  telegram: { width: 1280, height: 720, ratio: '16:9', safe_area: 80 },
  x: { width: 1600, height: 900, ratio: '16:9', safe_area: 96 },
  instagram: { width: 1080, height: 1350, ratio: '4:5', safe_area: 84 },
  facebook: { width: 1200, height: 630, ratio: '1.91:1', safe_area: 72 },
  linkedin: { width: 1200, height: 627, ratio: '1.91:1', safe_area: 72 },
});

const VISUAL_TYPES = Object.freeze([
  'cross-asset-relationship',
  'regime-transition',
  'catalyst-watch',
  'positioning-structure',
  'market-memory-timeline',
  'calm-monitoring',
  'volatility-state',
  'market-structure',
]);

const ANNOTATION_TYPES = Object.freeze([
  'macro-annotation',
  'liquidity-marker',
  'divergence-highlight',
  'catalyst-zone',
  'pressure-band',
  'transition-label',
  'liquidity-zone',
  'volatility-compression-zone',
  'commentary-label',
]);

module.exports = {
  VISUAL_LANGUAGE,
  EXPORT_TARGETS,
  VISUAL_TYPES,
  ANNOTATION_TYPES,
};
