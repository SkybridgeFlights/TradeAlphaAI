'use strict';

// Phase 210 CP2 — confirmation matrix.
// Composes existing macro, asset, sector, equity, ranking and historical layers
// into an evidence-backed regime confirmation map. It classifies what the
// existing systems already say; it does not create forecasts, execution cues or
// recommendations.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'confirmation-matrix.json');
const INTEL = path.join(ROOT, 'data', 'intelligence');

function readJson(name, fallback = null) {
  const abs = path.join(INTEL, name);
  if (!fs.existsSync(abs)) return fallback;
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return fallback; }
}

function evidence(source, field, value, refs = []) {
  return {
    source,
    field,
    value: value == null ? 'indeterminate' : String(value),
    refs: Array.isArray(refs) ? refs.slice(0, 5).map(String) : []
  };
}

function maxGeneratedAt(sources) {
  const times = sources.map((s) => Date.parse(s.artifact && s.artifact.generated_at)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : '1970-01-01T00:00:00.000Z';
}

function classifyCounts(counts) {
  const confirming = counts.confirming || 0;
  const contradicting = counts.contradicting || 0;
  const mixed = counts.mixed || 0;
  if (confirming === 0 && contradicting === 0 && mixed === 0) return 'indeterminate';
  if (confirming > 0 && contradicting === 0 && mixed <= confirming) return 'confirming';
  if (contradicting > 0 && confirming === 0) return 'contradicting';
  if (confirming > contradicting + mixed) return 'confirming';
  if (contradicting > confirming + mixed) return 'contradicting';
  return 'mixed';
}

function label(state) {
  const map = {
    confirming: ['confirming', 'مؤكد'],
    contradicting: ['contradicting', 'متعارض'],
    mixed: ['mixed', 'مختلط'],
    indeterminate: ['indeterminate', 'غير حاسم']
  };
  const v = map[state] || map.indeterminate;
  return { state, label_en: v[0], label_ar: v[1] };
}

function countState(state, counts) {
  const s = String(state || '').toLowerCase();
  if (['constructive', 'supportive', 'positive', 'improving', 'persistent', 'broadening', 'confirming', 'strong'].includes(s)) counts.confirming += 1;
  else if (['pressured', 'weak', 'negative', 'deteriorating', 'fragile', 'contradicting', 'defensive'].includes(s)) counts.contradicting += 1;
  else if (['mixed', 'variable', 'neutral'].includes(s)) counts.mixed += 1;
}

function node(layer, titleEn, titleAr, counts, refs, detail = {}) {
  const classified = classifyCounts(counts);
  return {
    layer,
    title_en: titleEn,
    title_ar: titleAr,
    ...label(classified),
    counts,
    evidence_refs: refs.slice(0, 12),
    detail
  };
}

function buildMacro(regime, narrative, network, transitions) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  const macroRegime = regime && (regime.macro_regime || regime.regime || regime.current_regime);
  const transitionState = transitions && transitions.transition_state;
  const confirmation = narrative && narrative.confirmation_story;
  const contradiction = narrative && narrative.contradiction_story;
  if (macroRegime) { counts.confirming += 1; refs.push(evidence('macro-regime.json', 'macro_regime', macroRegime, regime.evidence)); }
  else counts.indeterminate += 1;
  if (transitionState && transitionState !== 'stable') counts.mixed += 1;
  refs.push(evidence('regime-transitions.json', 'transition_state', transitionState, transitions && transitions.evidence));
  if (confirmation && confirmation !== 'indeterminate') counts.confirming += 1;
  refs.push(evidence('market-narrative.json', 'confirmation_story', confirmation, narrative && narrative.evidence));
  if (contradiction && contradiction !== 'indeterminate') counts.contradicting += 1;
  refs.push(evidence('market-narrative.json', 'contradiction_story', contradiction, narrative && narrative.evidence));
  const contradictions = Array.isArray(network && network.contradiction_chains) ? network.contradiction_chains.length : 0;
  if (contradictions > 0) counts.contradicting += Math.min(2, contradictions);
  refs.push(evidence('cognitive-network.json', 'contradiction_chains', contradictions, []));
  return node('macro', 'Macro confirmation', 'تأكيدات الاقتصاد الكلي', counts, refs, { macro_regime: macroRegime || 'indeterminate', transition_state: transitionState || 'indeterminate' });
}

function buildAssets(assetIntel) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  const assets = Array.isArray(assetIntel && assetIntel.assets) ? assetIntel.assets : [];
  for (const asset of assets) {
    countState(asset.score_label || asset.score_label_en, counts);
    refs.push(evidence('asset-intelligence.json', `assets.${asset.symbol || asset.slug}`, asset.score_label, asset.evidence));
  }
  if (!assets.length) counts.indeterminate += 1;
  return node('assets', 'Asset confirmation', 'تأكيدات الأصول', counts, refs, { observed: assets.length });
}

function buildSectors(sectorLayers) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  let observed = 0;
  for (const [source, artifact] of Object.entries(sectorLayers)) {
    const sectors = Array.isArray(artifact && artifact.sectors) ? artifact.sectors : [];
    observed += sectors.length;
    for (const sector of sectors) {
      countState(sector.state, counts);
      refs.push(evidence(source, `sectors.${sector.symbol || sector.slug}`, sector.state, sector.evidence));
    }
  }
  if (!observed) counts.indeterminate += 1;
  return node('sectors', 'Sector confirmation', 'تأكيدات القطاعات', counts, refs, { observed });
}

function buildEquities(equityIntel) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  const equities = Array.isArray(equityIntel && equityIntel.equities) ? equityIntel.equities : [];
  for (const equity of equities) {
    countState(equity.score_label || equity.score_label_en, counts);
    refs.push(evidence('equity-intelligence.json', `equities.${equity.symbol || equity.slug}`, equity.score_label, equity.evidence));
  }
  if (!equities.length) counts.indeterminate += 1;
  return node('equities', 'Equity confirmation', 'تأكيدات الأسهم', counts, refs, { observed: equities.length });
}

function buildRankings(rankings, relativeStrength, rankingHistory) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  const groups = rankings && rankings.groups ? rankings.groups : {};
  for (const [group, data] of Object.entries(groups)) {
    for (const item of (data.items || []).slice(0, 6)) {
      countState(item.confirmation, counts);
      refs.push(evidence('rankings.json', `${group}.${item.symbol || item.slug}`, item.confirmation, item.evidence));
    }
  }
  const rsGroups = relativeStrength && relativeStrength.groups ? relativeStrength.groups : {};
  for (const [group, items] of Object.entries(rsGroups)) {
    for (const item of (Array.isArray(items) ? items : []).slice(0, 4)) {
      countState(item.state || item.confirmation, counts);
      refs.push(evidence('relative-strength.json', `${group}.${item.symbol || item.slug || item.pair}`, item.state || item.confirmation, item.evidence));
    }
  }
  const historyGroups = rankingHistory && rankingHistory.groups ? rankingHistory.groups : {};
  for (const [group, items] of Object.entries(historyGroups)) {
    for (const item of (Array.isArray(items) ? items : []).slice(0, 4)) {
      countState(item.direction || item.historical_direction, counts);
      refs.push(evidence('ranking-history.json', `${group}.${item.symbol || item.slug}`, item.direction || item.historical_direction, item.evidence));
    }
  }
  if (!refs.length) counts.indeterminate += 1;
  return node('rankings', 'Ranking confirmation', 'تأكيدات الترتيب النسبي', counts, refs, { observed_refs: refs.length });
}

function buildHistorical(historicalIntel, rankingHistory, transitions) {
  const counts = { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 };
  const refs = [];
  const groups = historicalIntel && historicalIntel.groups ? historicalIntel.groups : {};
  for (const [group, items] of Object.entries(groups)) {
    for (const item of (Array.isArray(items) ? items : []).slice(0, 5)) {
      countState(item.momentum && item.momentum.state, counts);
      countState(item.persistence && item.persistence.state, counts);
      refs.push(evidence('historical-intelligence.json', `${group}.${item.symbol || item.slug}`, `${item.momentum && item.momentum.state}/${item.persistence && item.persistence.state}`, item.evidence));
    }
  }
  if (rankingHistory && rankingHistory.has_prior === false) counts.indeterminate += 1;
  refs.push(evidence('ranking-history.json', 'has_prior', rankingHistory && rankingHistory.has_prior, []));
  refs.push(evidence('regime-transitions.json', 'confidence_band', transitions && transitions.confidence_band, transitions && transitions.evidence));
  if (!refs.length) counts.indeterminate += 1;
  return node('historical', 'Historical confirmation', 'التأكيد التاريخي', counts, refs, { has_prior: Boolean(rankingHistory && rankingHistory.has_prior) });
}

function build() {
  const sources = {
    'macro-regime.json': readJson('macro-regime.json'),
    'cognitive-network.json': readJson('cognitive-network.json'),
    'market-narrative.json': readJson('market-narrative.json'),
    'asset-intelligence.json': readJson('asset-intelligence.json'),
    'equity-intelligence.json': readJson('equity-intelligence.json'),
    'rankings.json': readJson('rankings.json'),
    'relative-strength.json': readJson('relative-strength.json'),
    'ranking-history.json': readJson('ranking-history.json'),
    'historical-intelligence.json': readJson('historical-intelligence.json'),
    'regime-transitions.json': readJson('regime-transitions.json')
  };
  const sectorLayers = {
    'sector-structure.json': readJson('sector-structure.json'),
    'sector-tactical.json': readJson('sector-tactical.json'),
    'sector-liquidity.json': readJson('sector-liquidity.json'),
    'sector-participation.json': readJson('sector-participation.json')
  };
  const sourceList = Object.entries({ ...sources, ...sectorLayers }).map(([name, artifact]) => ({ name, artifact })).filter((s) => s.artifact);
  const layers = [
    buildMacro(sources['macro-regime.json'], sources['market-narrative.json'], sources['cognitive-network.json'], sources['regime-transitions.json']),
    buildAssets(sources['asset-intelligence.json']),
    buildSectors(sectorLayers),
    buildEquities(sources['equity-intelligence.json']),
    buildRankings(sources['rankings.json'], sources['relative-strength.json'], sources['ranking-history.json']),
    buildHistorical(sources['historical-intelligence.json'], sources['ranking-history.json'], sources['regime-transitions.json'])
  ];
  const classification_counts = layers.reduce((acc, layer) => {
    acc[layer.state] = (acc[layer.state] || 0) + 1;
    return acc;
  }, { confirming: 0, contradicting: 0, mixed: 0, indeterminate: 0 });
  const digest = crypto.createHash('sha256').update(JSON.stringify(layers)).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: maxGeneratedAt(sourceList),
    source_layer: 'confirmation-matrix',
    available: true,
    matrix_state: classifyCounts(classification_counts),
    classification_counts,
    layers,
    evidence_refs: layers.flatMap((l) => l.evidence_refs.slice(0, 3)),
    source_hash: digest,
    attribution: {
      sources: sourceList.map((s) => s.name),
      note: 'Evidence-backed classification of existing intelligence layers. Educational context only; no directional call, recommendation, execution level or trade instruction.'
    }
  };
}

if (require.main === module) {
  const matrix = build();
  console.log(`[confirmation-matrix] state=${matrix.matrix_state} layers=${matrix.layers.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
    console.log(`[confirmation-matrix] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
