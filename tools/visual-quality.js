'use strict';

// Phase 112 — deterministic visual-quality scorer (visual-intelligence domain).
//
// Scores an evidence visual for institutional quality: analytical relevance,
// evidence density, narrative linkage, clutter avoidance, cross-asset clarity,
// and bilingual completeness. Hard `flags` (must be empty) cover the safety
// rules: a chart without an analytical reason, a disconnected graphic (no
// narrative hook), retail-TA language, a fabricated metric in a label, an
// untranslated label, clutter, or a null leak. Pure and deterministic.

const MAX_ANNOTATIONS = 6;
// Retail-TA terms. "support"/"resistance" are matched only as TA levels
// ("support level"/"resistance level") so legitimate macro terms like
// "risk support" or "policy support" are not false-flagged.
const RETAIL_TA = [/\bbuy\b/i, /\bsell\b/i, /\bRSI\b/, /\bMACD\b/, /\bbreakout\b/i, /\bprice target\b/i, /\bsupport level\b/i, /\bresistance level\b/i, /\bto the moon\b/i, /\bgo long\b/i, /\bgo short\b/i];
// A "fabricated metric" in a label = a currency/price-like or large bare number
// the engine would only have if invented (artifact evidence is categorical).
const FABRICATED_METRIC = /[$€£]\s?\d|\b\d{3,}\b|\b\d+\.\d+\s*(?:USD|pts|points)\b/;

function labelTexts(graphic) {
  const out = [];
  for (const a of (graphic.annotations || [])) { out.push(a.label_en || ''); out.push(a.label_ar || ''); }
  out.push(graphic.headline_en || '', graphic.headline_ar || '');
  if (graphic.narrative_context) { out.push(graphic.narrative_context.en || '', graphic.narrative_context.ar || ''); }
  return out;
}

function scoreVisual(v) {
  const flags = [];
  const g = v.graphic || {};

  // Relevance: must declare an analytical reason.
  const reason = v.analytical_reason || {};
  const hasReason = reason && (reason.question || reason.what_confirms || reason.what_diverges || reason.regime || reason.what_faded);
  if (!hasReason) flags.push('missing_analytical_reason');

  // Narrative linkage: bilingual hook the article references.
  const hook = v.narrative_hook || {};
  if (!hook.en || !hook.en.trim() || !hook.ar || !hook.ar.trim()) flags.push('disconnected_no_narrative_hook');

  // Bilingual labels: every annotation + headline must be EN + AR.
  if (!g.headline_en || !g.headline_ar) flags.push('untranslated_headline');
  for (const a of (g.annotations || [])) if (!a.label_en || !a.label_ar) flags.push('untranslated_annotation');

  // Clutter.
  const annCount = (g.annotations || []).length;
  if (annCount > MAX_ANNOTATIONS) flags.push(`clutter:${annCount}`);

  // Safety on every rendered label.
  const texts = labelTexts(g);
  for (const text of texts) {
    if (/\b(undefined|NaN|null)\b/.test(text)) flags.push('null_leak');
    for (const re of RETAIL_TA) if (re.test(text)) flags.push(`retail_ta:${re.source}`);
    if (FABRICATED_METRIC.test(text)) flags.push('fabricated_metric');
  }

  // Cross-asset clarity: relationship/divergence visuals must name their assets.
  const isCrossAsset = /cross_asset|divergence|confirmation_matrix|yields_vs|dollar_vs/.test(v.chart_type || '');
  if (isCrossAsset && !(Array.isArray(v.assets) && v.assets.length)) flags.push('cross_asset_without_assets');

  // Evidence density score.
  const evidenceFields = v.evidence ? Object.values(v.evidence).filter((x) => x !== null && x !== undefined && (!Array.isArray(x) || x.length)).length : 0;
  let score = 55;
  score += Math.min(15, annCount * 4);            // evidence rail density
  score += Math.min(12, evidenceFields * 3);      // structured evidence
  score += hasReason ? 8 : 0;
  score += (hook.en && hook.ar) ? 10 : 0;
  score -= flags.length * 25;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return { score, flags, metrics: { annotations: annCount, evidence_fields: evidenceFields, cross_asset: isCrossAsset } };
}

module.exports = { scoreVisual, MAX_ANNOTATIONS, VISUAL_QUALITY_FLOOR: 65 };
