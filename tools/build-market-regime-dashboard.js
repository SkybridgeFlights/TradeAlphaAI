'use strict';

// Phase 210 / CP1 — Institutional Market Regime Dashboard builder.
// Composes existing verified intelligence artifacts into a command-center
// artifact. It does not project outcomes, score trades, create execution levels, or invent
// missing state; missing inputs degrade honestly to indeterminate.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INTEL = path.join(ROOT, 'data', 'intelligence');
const OUT = path.join(INTEL, 'market-regime-dashboard.json');
const WRITE = process.argv.includes('--write');

const ALLOWED_BANDS = new Set(['high', 'moderate', 'low', 'indeterminate']);
const ALLOWED_RISK = new Set(['calm', 'elevated', 'fragile', 'stressed', 'mixed', 'indeterminate']);

function readJson(name, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(INTEL, name), 'utf8')); } catch { return fallback; }
}

function labelPair(obj, base, fallback = 'indeterminate') {
  return {
    state: obj && obj[base] ? obj[base] : fallback,
    label_en: obj && obj[`${base}_en`] ? obj[`${base}_en`] : String(fallback).replace(/_/g, ' '),
    label_ar: obj && obj[`${base}_ar`] ? obj[`${base}_ar`] : 'غير محدد'
  };
}

function nestedLabel(obj, key, fallback = 'indeterminate') {
  const node = obj && obj[key] ? obj[key] : {};
  return {
    state: node.state || fallback,
    label_en: node.label_en || String(fallback).replace(/_/g, ' '),
    label_ar: node.label_ar || 'غير محدد'
  };
}

function evidenceRef(source, field, value, evidence = []) {
  return {
    source,
    field,
    value: value == null || value === '' ? 'indeterminate' : value,
    evidence: Array.isArray(evidence) ? evidence.slice(0, 4) : []
  };
}

function confirmationState(network, narrative, rankings) {
  const confirmations = (network.confirmation_chains || []).length;
  const contradictions = (network.contradiction_chains || []).length;
  const rankingGroups = Object.values((rankings && rankings.groups) || {});
  const confirmedRanks = rankingGroups.flatMap((g) => g.items || []).filter((x) => x.confirmation === 'confirmed').length;
  const mixedRanks = rankingGroups.flatMap((g) => g.items || []).filter((x) => x.confirmation === 'mixed').length;
  let state = 'indeterminate';
  if (confirmations || contradictions || confirmedRanks || mixedRanks) {
    if (confirmations > contradictions && confirmedRanks >= mixedRanks) state = 'confirming';
    else if (contradictions > confirmations) state = 'contradicting';
    else state = 'mixed';
  }
  return {
    state,
    label_en: state,
    label_ar: ({ confirming: 'مؤكد', contradicting: 'متناقض', mixed: 'مختلط', indeterminate: 'غير محدد' })[state],
    evidence_refs: [
      evidenceRef('cognitive-network', 'confirmation_chains', confirmations, [`confirmation_chains=${confirmations}`]),
      evidenceRef('cognitive-network', 'contradiction_chains', contradictions, [`contradiction_chains=${contradictions}`]),
      evidenceRef('rankings', 'confirmed_items', confirmedRanks, [`confirmed_rank_items=${confirmedRanks}`]),
      evidenceRef('rankings', 'mixed_items', mixedRanks, [`mixed_rank_items=${mixedRanks}`]),
      evidenceRef('market-narrative', 'confirmation_story', narrative.confirmation_story && narrative.confirmation_story.label_en, narrative.confirmation_story && narrative.confirmation_story.evidence)
    ]
  };
}

function contradictionState(network, narrative) {
  const contradictions = (network.contradiction_chains || []).length;
  const fragility = (network.fragility_chains || []).length;
  let state = 'indeterminate';
  if (contradictions || fragility) state = contradictions > 2 || fragility > 2 ? 'elevated' : 'contained';
  else if (Array.isArray(network.confirmation_chains)) state = 'limited';
  return {
    state,
    label_en: state.replace(/_/g, ' '),
    label_ar: ({ elevated: 'مرتفعة', contained: 'محدودة', limited: 'ضعيفة', indeterminate: 'غير محددة' })[state] || 'غير محددة',
    evidence_refs: [
      evidenceRef('cognitive-network', 'contradiction_chains', contradictions, [`contradiction_chains=${contradictions}`]),
      evidenceRef('cognitive-network', 'fragility_chains', fragility, [`fragility_chains=${fragility}`]),
      evidenceRef('market-narrative', 'contradiction_story', narrative.contradiction_story && narrative.contradiction_story.label_en, narrative.contradiction_story && narrative.contradiction_story.evidence)
    ]
  };
}

function riskState(macro, network, transition) {
  const vol = ((macro.inputs || {}).volatility_regime) || 'indeterminate';
  const net = network.dominant_network_state ? network.dominant_network_state.state : 'indeterminate';
  const trans = transition.transition_state || 'indeterminate';
  let state = 'indeterminate';
  if (vol === 'calm' && trans === 'stable_regime') state = 'calm';
  else if (/stress|fragility|liquidity/.test(net) || /transition|unstable/.test(trans)) state = 'fragile';
  else if (vol === 'elevated' || vol === 'expanding') state = 'elevated';
  else if (vol !== 'indeterminate' || net !== 'indeterminate') state = 'mixed';
  if (!ALLOWED_RISK.has(state)) state = 'indeterminate';
  return {
    state,
    label_en: state,
    label_ar: ({ calm: 'هادئ', elevated: 'مرتفع', fragile: 'هش', stressed: 'مضغوط', mixed: 'مختلط', indeterminate: 'غير محدد' })[state],
    evidence_refs: [
      evidenceRef('macro-regime', 'inputs.volatility_regime', vol, macro.evidence),
      evidenceRef('cognitive-network', 'dominant_network_state', net, network.evidence),
      evidenceRef('regime-transitions', 'transition_state', trans, transition.evidence)
    ]
  };
}

function build() {
  const macro = readJson('macro-regime.json');
  const network = readJson('cognitive-network.json');
  const narrative = readJson('market-narrative.json');
  const rankings = readJson('rankings.json');
  const relative = readJson('relative-strength.json');
  const rankingHistory = readJson('ranking-history.json');
  const transitions = readJson('regime-transitions.json');

  const currentRegime = labelPair(macro, 'macro_regime');
  const confidence = labelPair(macro, 'confidence_band');
  if (!ALLOWED_BANDS.has(confidence.state)) confidence.state = 'indeterminate';
  const dominantStory = nestedLabel(narrative, 'dominant_story');
  const transitionState = labelPair(transitions, 'transition_state');
  const risk = riskState(macro, network, transitions);

  const dashboard = {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'market-regime-dashboard',
    available: Boolean(macro.available || narrative.available || network.available || transitions.available),
    current_regime: currentRegime,
    confidence_band: confidence,
    risk_state: risk,
    dollar_state: {
      state: (macro.inputs || {}).dollar_regime || 'indeterminate',
      label_en: ((macro.inputs || {}).dollar_regime || 'indeterminate').replace(/_/g, ' '),
      label_ar: 'حالة الدولار',
      evidence_refs: [evidenceRef('macro-regime', 'inputs.dollar_regime', (macro.inputs || {}).dollar_regime, macro.evidence)]
    },
    yield_state: {
      state: (macro.inputs || {}).yield_regime || 'indeterminate',
      label_en: ((macro.inputs || {}).yield_regime || 'indeterminate').replace(/_/g, ' '),
      label_ar: 'حالة العوائد',
      evidence_refs: [evidenceRef('macro-regime', 'inputs.yield_regime', (macro.inputs || {}).yield_regime, macro.evidence)]
    },
    volatility_state: {
      state: (macro.inputs || {}).volatility_regime || 'indeterminate',
      label_en: ((macro.inputs || {}).volatility_regime || 'indeterminate').replace(/_/g, ' '),
      label_ar: 'حالة التقلب',
      evidence_refs: [evidenceRef('macro-regime', 'inputs.volatility_regime', (macro.inputs || {}).volatility_regime, macro.evidence)]
    },
    dominant_story: dominantStory,
    dominant_confirmation_state: confirmationState(network, narrative, rankings),
    dominant_contradiction_state: contradictionState(network, narrative),
    historical_transition_state: transitionState,
    leadership_snapshot: {
      strongest_assets: (((rankings.groups || {}).asset || {}).strongest || []).slice(0, 3),
      weakest_assets: (((rankings.groups || {}).asset || {}).weakest || []).slice(0, 3),
      strongest_sectors: (((rankings.groups || {}).sector || {}).strongest || []).slice(0, 3),
      weakest_sectors: (((rankings.groups || {}).sector || {}).weakest || []).slice(0, 3),
      strongest_equities: (((rankings.groups || {}).equity || {}).strongest || []).slice(0, 3),
      weakest_equities: (((rankings.groups || {}).equity || {}).weakest || []).slice(0, 3),
      evidence_refs: [
        evidenceRef('rankings', 'groups.asset.strongest', (((rankings.groups || {}).asset || {}).strongest || []).join(','), ['rankings.groups.asset']),
        evidenceRef('relative-strength', 'available', relative.available, relative.available ? ['relative-strength available'] : []),
        evidenceRef('ranking-history', 'snapshot_count', rankingHistory.snapshot_count, rankingHistory.evidence || [])
      ]
    },
    evidence_refs: [
      evidenceRef('macro-regime', 'macro_regime', currentRegime.state, macro.evidence),
      evidenceRef('market-narrative', 'dominant_story', dominantStory.state, narrative.evidence),
      evidenceRef('cognitive-network', 'dominant_network_state', network.dominant_network_state && network.dominant_network_state.state, network.evidence),
      evidenceRef('rankings', 'source_layer', rankings.source_layer, ['rankings.json']),
      evidenceRef('relative-strength', 'source_layer', relative.source_layer, ['relative-strength.json']),
      evidenceRef('ranking-history', 'source_layer', rankingHistory.source_layer, ['ranking-history.json']),
      evidenceRef('regime-transitions', 'transition_state', transitionState.state, transitions.evidence)
    ],
    attribution: {
      sources: [
        'macro-regime.json',
        'cognitive-network.json',
        'market-narrative.json',
        'rankings.json',
        'relative-strength.json',
        'ranking-history.json',
        'regime-transitions.json'
      ],
      note: 'Deterministic command-center composition from verified intelligence artifacts. Educational context only; not a directional call, recommendation, execution level or trade instruction.'
    }
  };
  return dashboard;
}

if (require.main === module) {
  const artifact = build();
  console.log(`[market-regime-dashboard] regime=${artifact.current_regime.state} confidence=${artifact.confidence_band.state} risk=${artifact.risk_state.state}`);
  if (WRITE) {
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[market-regime-dashboard] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
