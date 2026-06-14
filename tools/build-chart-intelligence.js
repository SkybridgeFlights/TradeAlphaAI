'use strict';

// Phase 112 — Chart Intelligence engine (visual-intelligence domain).
//
// Derives reaction-aware and regime-aware institutional EVIDENCE visuals from the
// canonical artifacts (macro-reactions, liquidity-regime, cross-asset-state) and
// renders them with the existing dependency-free SVG engine (render-graphic-svg).
// Every visual carries an analytical reason and a bilingual narrative hook so the
// article can reference it; nothing is decorative. No fabricated metrics — the
// engine renders only text/evidence labels drawn from the artifacts, and a visual
// is emitted ONLY when its artifact actually supports it (honest, deterministic).
//
// Output:
//   data/visual/chart-intelligence.json            (manifest)
//   data/visual/chart-intelligence/<id>-<en|ar>.svg
//
// Usage: node tools/build-chart-intelligence.js [--write]

const fs = require('fs');
const path = require('path');
const { renderGraphicSVG } = require('./render-graphic-svg');

const ROOT = path.resolve(__dirname, '..');
const RX = path.join(ROOT, 'data', 'intelligence', 'macro-reactions.json');
const REGIME = path.join(ROOT, 'data', 'intelligence', 'liquidity-regime.json');
const CROSS = path.join(ROOT, 'data', 'intelligence', 'cross-asset-state.json');
const OUT_JSON = path.join(ROOT, 'data', 'visual', 'chart-intelligence.json');
const OUT_DIR = path.join(ROOT, 'data', 'visual', 'chart-intelligence');

// Phase 112 chart category → existing engine visual_type kicker.
const VISUAL_TYPE = {
  cross_asset_divergence: 'cross-asset-relationship', macro_confirmation_matrix: 'cross-asset-relationship',
  yields_vs_equities_relationship: 'cross-asset-relationship', dollar_vs_gold_structure: 'cross-asset-relationship',
  reaction_persistence: 'structural-tension', fading_reaction: 'structural-tension',
  liquidity_regime_snapshot: 'regime-snapshot', risk_regime_transition: 'regime-snapshot', yield_pressure_structure: 'regime-snapshot',
  volatility_transition: 'volatility-state', defensive_rotation: 'positioning-structure', breadth_fragility: 'positioning-structure',
  catalyst_window: 'catalyst-watch',
};
const ATTRIB = 'Source: TradeAlphaAI macro-reactions + liquidity-regime artifacts';

function readJson(p, f) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function ann(label_en, label_ar, type) { return { label_en, label_ar, type: type || 'evidence' }; }
function clean(s) { return String(s || '').replace(/_/g, ' '); }

// Arabic value maps so regime/liquidity labels render natively (no English leak).
const AR_VALUE = {
  regime: { healthy_risk_expansion: 'توسّع مخاطر صحي', broad_risk_support: 'دعم مخاطر واسع', narrow_leadership: 'قيادة ضيقة', crowded_growth_positioning: 'تمركز نمو مزدحم', defensive_rotation: 'تدوير دفاعي', liquidity_stress: 'ضغط سيولة', unstable_rally: 'صعود غير مستقر', volatility_transition: 'تحوّل تذبذب', yield_pressure_regime: 'ضغط العوائد', macro_fragility: 'هشاشة كلية' },
  liquidity: { easing: 'تيسير', tightening: 'تشديد', yield_pressure: 'ضغط العوائد', defensive_demand: 'طلب دفاعي', volatility_absorption: 'امتصاص تذبذب', volatility_rejection: 'رفض تذبذب', neutral: 'محايد' },
  stability: { stable: 'مستقر', fragile: 'هش', deteriorating: 'يتدهور', unstable: 'غير مستقر', strengthening: 'يتقوّى', transition_state: 'انتقالي' },
  breadth: { narrow: 'ضيق', broad: 'واسع', mixed: 'مختلط', flat: 'ثابت', broad_weakness: 'ضعف واسع' },
};
function arVal(cat, v) { return (AR_VALUE[cat] && AR_VALUE[cat][v]) || clean(v); }

function reactionVisuals(rx) {
  const out = [];
  const reactions = (rx.reactions || []).filter((r) => r.has_reaction_data && r.classification !== 'awaiting_data');
  // Take the single most material reaction (highest conviction / latest) to avoid clutter.
  const r = reactions.sort((a, b) => (b.conviction_score || 0) - (a.conviction_score || 0))[0];
  if (!r) return out;

  const matrix = (r.cross_asset_matrix || []).filter((m) => m.confirms !== null);
  const confirmed = matrix.filter((m) => m.confirms).map((m) => m.asset);
  const diverged = matrix.filter((m) => !m.confirms).map((m) => m.asset);
  const label = clean(r.surprise_label || r.classification);

  // 1. Cross-asset divergence / confirmation matrix.
  const chartType = diverged.length ? 'cross_asset_divergence' : 'macro_confirmation_matrix';
  out.push({
    id: `${chartType}-${r.event_id}`,
    chart_type: chartType,
    analytical_reason: { what_confirms: confirmed.join(', ') || null, what_diverges: diverged.join(', ') || null, question: 'Where did cross-asset confirmation hold and where did it break?' },
    narrative_hook: {
      en: diverged.length
        ? `The divergence panel highlights where confirmation weakened after the initial reaction: ${confirmed.join(', ')} tracked the move while ${diverged.join(', ')} broke from it.`
        : `The confirmation matrix shows the reaction agreeing across ${confirmed.join(', ')}.`,
      ar: diverged.length
        ? `يبرز مسار التباعد حيث ضعُف التأكيد بعد التفاعل الأولي: تابعت ${confirmed.join('، ')} الحركة بينما انفصلت عنها ${diverged.join('، ')}.`
        : `تُظهر مصفوفة التأكيد توافق التفاعل عبر ${confirmed.join('، ')}.`,
    },
    evidence: { confirmed, diverged, classification: r.classification, conviction: r.conviction },
    assets: matrix.map((m) => m.asset),
    source_artifacts: ['data/intelligence/macro-reactions.json'],
    graphic: {
      visual_type: VISUAL_TYPE[chartType],
      headline_en: `${clean(r.event)}: ${label}`,
      headline_ar: `${clean(r.event)}: ${label}`,
      narrative_context: { en: `Reaction classified ${clean(r.classification)} (${clean(r.conviction)} conviction).`, ar: `صُنّف التفاعل ${clean(r.classification)} بقناعة ${clean(r.conviction)}.` },
      annotations: [
        ...confirmed.slice(0, 2).map((a) => ann(`${a} — confirmed`, `${a} — مؤكَّد`, 'evidence')),
        ...diverged.slice(0, 2).map((a) => ann(`${a} — diverged`, `${a} — متباعد`, 'divergence-highlight')),
      ],
      attribution: ATTRIB,
    },
  });

  // 2. Reaction persistence / fading.
  const persistType = r.classification === 'fading_reaction' ? 'fading_reaction' : 'reaction_persistence';
  out.push({
    id: `${persistType}-${r.event_id}`,
    chart_type: persistType,
    analytical_reason: { what_faded: r.classification === 'fading_reaction' ? 'initial move' : null, question: 'Did the reaction persist or fade through the session?' },
    narrative_hook: {
      en: r.classification === 'fading_reaction'
        ? 'The persistence panel shows the initial reaction aligning then fading as the move lost breadth through the session.'
        : 'The persistence panel shows the reaction holding its direction rather than reversing after the initial repricing.',
      ar: r.classification === 'fading_reaction'
        ? 'يُظهر مسار الاستمرارية توافق التفاعل الأولي ثم تلاشيه مع فقدان الاتساع خلال الجلسة.'
        : 'يُظهر مسار الاستمرارية تمسّك التفاعل باتجاهه دون انعكاس بعد إعادة التسعير الأولية.',
    },
    evidence: { classification: r.classification, conviction: r.conviction, alignment_ratio: r.alignment_ratio },
    assets: matrix.map((m) => m.asset),
    source_artifacts: ['data/intelligence/macro-reactions.json'],
    graphic: {
      visual_type: VISUAL_TYPE[persistType],
      headline_en: r.classification === 'fading_reaction' ? 'Reaction faded through the session' : 'Reaction held its direction',
      headline_ar: r.classification === 'fading_reaction' ? 'تلاشى التفاعل خلال الجلسة' : 'تمسّك التفاعل باتجاهه',
      narrative_context: { en: `Breadth ${r.alignment_ratio != null ? r.alignment_ratio : 'n/a'}; conviction ${clean(r.conviction)}.`, ar: `الاتساع ${r.alignment_ratio != null ? r.alignment_ratio : 'غير متاح'}؛ القناعة ${clean(r.conviction)}.` },
      annotations: [ann(`Conviction — ${clean(r.conviction)}`, `القناعة — ${clean(r.conviction)}`, 'evidence')],
      attribution: ATTRIB,
    },
  });
  return out;
}

function regimeVisuals(rg) {
  if (!rg || !rg.regime || rg.regime === 'indeterminate') return [];
  const sub = rg.sub_states || {};
  const coh = rg.cross_asset_coherence ? rg.cross_asset_coherence.score : null;
  const out = [];

  out.push({
    id: 'liquidity_regime_snapshot',
    chart_type: 'liquidity_regime_snapshot',
    analytical_reason: { regime: rg.regime, question: 'What is the structural environment macro reactions are landing in?' },
    narrative_hook: {
      en: `The liquidity snapshot frames the environment: a ${clean(rg.regime)} regime with ${clean(rg.liquidity_state)} liquidity and ${clean(rg.stability)} stability.`,
      ar: `يؤطّر مشهد السيولة البيئة: نظام ${arVal('regime', rg.regime)} مع سيولة ${arVal('liquidity', rg.liquidity_state)} واستقرار ${arVal('stability', rg.stability)}.`,
    },
    evidence: { regime: rg.regime, liquidity_state: rg.liquidity_state, stability: rg.stability, coherence: coh, sub_states: sub },
    assets: [],
    source_artifacts: ['data/intelligence/liquidity-regime.json'],
    graphic: {
      visual_type: VISUAL_TYPE.liquidity_regime_snapshot,
      headline_en: clean(rg.regime),
      headline_ar: arVal('regime', rg.regime),
      narrative_context: { en: `Liquidity ${clean(rg.liquidity_state)} · stability ${clean(rg.stability)}${coh != null ? ` · coherence ${coh}` : ''}.`, ar: `سيولة ${arVal('liquidity', rg.liquidity_state)} · استقرار ${arVal('stability', rg.stability)}${coh != null ? ` · اتساق ${coh}` : ''}.` },
      annotations: [
        ann(`Liquidity — ${clean(rg.liquidity_state)}`, `السيولة — ${arVal('liquidity', rg.liquidity_state)}`, 'evidence'),
        ann(`Stability — ${clean(rg.stability)}`, `الاستقرار — ${arVal('stability', rg.stability)}`, rg.stability === 'unstable' || rg.stability === 'deteriorating' ? 'divergence-highlight' : 'evidence'),
        sub.breadth ? ann(`Breadth — ${clean(sub.breadth)}`, `الاتساع — ${arVal('breadth', sub.breadth)}`, sub.breadth === 'narrow' ? 'divergence-highlight' : 'evidence') : null,
      ].filter(Boolean),
      attribution: ATTRIB,
    },
  });
  return out;
}

function build() {
  const rx = readJson(RX, { reactions: [] });
  const rg = readJson(REGIME, null);
  const visuals = [...reactionVisuals(rx), ...regimeVisuals(rg)];

  // Render each visual (EN + AR) deterministically.
  for (const v of visuals) {
    v.files = {
      en: `data/visual/chart-intelligence/${v.id}-en.svg`,
      ar: `data/visual/chart-intelligence/${v.id}-ar.svg`,
    };
    v.svg = {
      en: renderGraphicSVG(v.graphic, { locale: 'en' }),
      ar: renderGraphicSVG(v.graphic, { locale: 'ar' }),
    };
  }

  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'chart-intelligence',
    preview_only: true,
    chart_types: Object.keys(VISUAL_TYPE),
    count: visuals.length,
    note: visuals.length ? null : 'No reaction/regime evidence available — chart intelligence intentionally empty (no fabricated overlays).',
    visuals: visuals.map((v) => { const c = { ...v }; delete c.svg; return c; }),
    _svg: visuals.map((v) => ({ files: v.files, svg: v.svg })),
  };
}

function main() {
  const write = process.argv.includes('--write');
  const result = build();
  console.log(`[chart-intelligence] visuals=${result.count}${result.count ? ' → ' + result.visuals.map((v) => v.chart_type).join(', ') : ''}`);
  if (write) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    // Prune stale SVGs.
    const keep = new Set();
    for (const v of result._svg) { keep.add(path.basename(v.files.en)); keep.add(path.basename(v.files.ar)); }
    try { for (const f of fs.readdirSync(OUT_DIR)) if (f.endsWith('.svg') && !keep.has(f)) fs.unlinkSync(path.join(OUT_DIR, f)); } catch { /* dir new */ }
    for (const v of result._svg) {
      fs.writeFileSync(path.join(ROOT, v.files.en), v.svg.en, 'utf8');
      fs.writeFileSync(path.join(ROOT, v.files.ar), v.svg.ar, 'utf8');
    }
    const persisted = { ...result }; delete persisted._svg;
    fs.writeFileSync(OUT_JSON, JSON.stringify(persisted, null, 2) + '\n', 'utf8');
    console.log(`[chart-intelligence] wrote manifest + ${result.count * 2} SVG(s)`);
  }
}

if (require.main === module) main();

module.exports = { build, reactionVisuals, regimeVisuals, VISUAL_TYPE };
