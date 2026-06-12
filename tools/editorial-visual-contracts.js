'use strict';

// Phase 86 — Editorial visual integration architecture (contracts only).
// Defines the slot convention through which article and market-outlook
// surfaces will later receive charts, annotations, and editorial graphics —
// without committing to any rendering system today.
//
// Slot marker convention (HTML comment — invisible, zero runtime cost):
//   <!-- editorial:visual-slot:{slot-id}:{kind} -->
// A future renderer resolves markers against the foundations manifest and
// the live intelligence artifacts; pages without a renderer simply carry
// inert comments. No hydration, no client framework, no layout impact.

const VISUAL_KINDS = [
  'chart',            // price/level chart (TradingView-compatible container)
  'annotation',       // macro visual annotation over a chart (timeline/divergence evidence)
  'cross-asset',      // relationship/transmission diagram
  'volatility',       // volatility regime visual
  'liquidity',        // liquidity/pressure map
  'catalyst',         // catalyst countdown/impact overlay
  'regime',           // structural regime/transition composition
  'positioning',      // concentration/positioning composition
  'timeline',         // editorial memory timeline
  'monitoring',       // calm-state monitoring card
];

const EXPORT_TARGETS = ['article-inline', 'outlook-inline', 'telegram', 'x', 'instagram', 'facebook', 'linkedin'];

// Bilingual context contract every rendered visual must carry — visuals are
// editorial objects, not decorations.
const VISUAL_CONTEXT_CONTRACT = {
  title_en: 'string', title_ar: 'string',
  reading_en: 'string (one-sentence institutional read of what the visual shows)',
  reading_ar: 'string (native Arabic equivalent, not a translation rhythm)',
  evidence: 'array (artifact refs: timeline event, causal link, pressure track, catalyst)',
  source_attribution: 'string (data source naming, required)',
};

const SLOT_MARKER = /<!--\s*editorial:visual-slot:([a-z0-9-]+):([a-z-]+)\s*-->/g;

// Validate slot markers found in a document body. Returns failures.
function validateSlotMarkers(html, contextLabel) {
  const failures = [];
  const seen = new Set();
  for (const match of String(html || '').matchAll(SLOT_MARKER)) {
    const [, slotId, kind] = match;
    if (!VISUAL_KINDS.includes(kind)) {
      failures.push(`${contextLabel}: visual slot "${slotId}" uses unknown kind "${kind}"`);
    }
    if (seen.has(slotId)) failures.push(`${contextLabel}: duplicate visual slot id "${slotId}"`);
    seen.add(slotId);
  }
  return failures;
}

module.exports = { VISUAL_KINDS, EXPORT_TARGETS, VISUAL_CONTEXT_CONTRACT, SLOT_MARKER, validateSlotMarkers };
