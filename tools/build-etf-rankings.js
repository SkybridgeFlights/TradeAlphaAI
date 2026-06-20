'use strict';

// Phase 214 CP4 + Phase 215 CP5 — ETF rankings.
// Composes direct ETF symbols already present in existing rankings / relative
// strength / ranking history artifacts. Where no direct source exists, derives
// a rank from the ETF's OWN verified OHLCV chart (NOT proxy substitution —
// the rank uses the ETF's own bars, the same evidence asset/sector/equity
// rankings use). ETFs without a verified chart remain indeterminate.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');
const { features } = require('./build-asset-layers');
const { strengthScore } = require('./history-engine');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'etf-rankings.json');
const CHARTS = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const RANK_ORDER = { strongest: 6, strong: 5, constructive: 4, neutral: 3, weakening: 2, weak: 1, weakest: 0, indeterminate: -1 };
const RANK_LABELS = {
  strongest: ['strongest', 'الأقوى'], strong: ['strong', 'قوي'], constructive: ['constructive', 'بنّاء'],
  neutral: ['neutral', 'محايد'], weakening: ['weakening', 'يضعف'], weak: ['weak', 'ضعيف'], weakest: ['weakest', 'الأضعف'],
  indeterminate: ['indeterminate', 'غير محدد'],
};

function scalarToLabel(s) {
  if (s === null) return 'indeterminate';
  if (s >= 2) return 'strongest'; if (s >= 1.25) return 'strong'; if (s >= 0.5) return 'constructive';
  if (s > -0.5) return 'neutral'; if (s > -1.25) return 'weakening'; if (s > -2) return 'weak'; return 'weakest';
}

function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(rel), 'utf8')); } catch { return fallback; }
}

function groupItems(rankings, group) {
  return (((rankings.groups || {})[group] || {}).items || []);
}

function findRanking(rankings, symbol) {
  for (const group of ['asset', 'sector', 'equity']) {
    const item = groupItems(rankings, group).find((entry) => entry.symbol === symbol);
    if (item) return { group, item };
  }
  return { group: 'unranked', item: null };
}

function findHistory(history, symbol) {
  for (const group of ['asset', 'sector', 'equity']) {
    const item = (((history.groups || {})[group]) || []).find((entry) => entry.symbol === symbol);
    if (item) return { group, item };
  }
  return { group: 'unavailable', item: null };
}

function relativeRefs(relative, symbol) {
  const refs = [];
  for (const group of Object.keys(relative.groups || {})) {
    for (const rel of relative.groups[group] || []) {
      if (rel.a === symbol || rel.b === symbol) {
        refs.push({
          id: rel.id,
          peer: rel.a === symbol ? rel.b : rel.a,
          state: rel.state,
          label_en: rel.label_en,
          label_ar: rel.label_ar,
          evidence: (rel.evidence || []).slice(0, 2)
        });
      }
    }
  }
  return refs.slice(0, 4);
}

function chartFor(charts, symbol) {
  return ((charts && charts.charts) || []).find((c) => c.verified === true && c.symbol === symbol) || null;
}

function build() {
  const rankings = readJson('rankings.json', {});
  const relative = readJson('relative-strength.json', {});
  const history = readJson('ranking-history.json', {});
  const intelligence = readJson('etf-intelligence.json', {});
  const charts = (() => { try { return JSON.parse(fs.readFileSync(CHARTS, 'utf8')); } catch { return {}; } })();

  const intelBySymbol = new Map((intelligence.etfs || []).map((entry) => [entry.symbol, entry]));
  const items = ETFS.map((etf) => {
    const direct = findRanking(rankings, etf.symbol);
    const hist = findHistory(history, etf.symbol);
    const intel = intelBySymbol.get(etf.symbol);
    const chart = chartFor(charts, etf.symbol);
    const directlyRanked = Boolean(direct.item && direct.item.available === true);

    // Phase 215 CP5 — derive rank from the ETF's OWN verified chart when no
    // direct source covers it. Same evidence the asset/sector/equity rankings
    // use; this is NOT proxy substitution.
    let chartScalar = null;
    let chartLabel = null;
    if (!directlyRanked && chart && Array.isArray(chart.series) && chart.series.length >= 35) {
      try {
        chartScalar = strengthScore(features(chart.series));
        chartLabel = chartScalar === null ? null : scalarToLabel(chartScalar);
      } catch { chartScalar = null; chartLabel = null; }
    }

    const chartRanked = !directlyRanked && chartLabel && chartLabel !== 'indeterminate';
    const available = directlyRanked || chartRanked;
    const sourceGroup = directlyRanked ? direct.group : chartRanked ? 'chart_derived' : 'unranked';

    let rank_label, rank_label_en, rank_label_ar;
    if (directlyRanked) {
      rank_label = direct.item.rank_label;
      rank_label_en = direct.item.rank_label_en;
      rank_label_ar = direct.item.rank_label_ar;
    } else if (chartRanked) {
      rank_label = chartLabel;
      rank_label_en = RANK_LABELS[chartLabel][0];
      rank_label_ar = RANK_LABELS[chartLabel][1];
    } else {
      rank_label = 'indeterminate'; rank_label_en = 'indeterminate'; rank_label_ar = 'غير محدد';
    }

    let evidence;
    if (directlyRanked) {
      evidence = [
        `direct ${direct.group} ranking source`,
        ...(direct.item.evidence || []).slice(0, 3),
        `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
      ];
    } else if (chartRanked) {
      evidence = [
        `chart-derived from ${etf.symbol} verified OHLCV (${chart.bar_count || chart.series.length} bars)`,
        `observed strength scalar=${chartScalar}`,
        `series_hash=${(chart.series_hash || '').slice(0, 12)}`,
        `provider=${(chart.attribution && chart.attribution.provider) || 'unknown'}`,
        `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
      ];
    } else {
      evidence = [
        'no direct ETF ranking source and no verified chart',
        `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
        'proxy substitution suppressed',
      ];
    }

    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      exposure_type: etf.exposure_type,
      fund_name: etf.fund_name,
      available,
      source_group: sourceGroup,
      chart_scalar: chartScalar,
      rank_label, rank_label_en, rank_label_ar,
      direction: hist.item ? hist.item.observed_direction : (directlyRanked ? direct.item.direction : 'indeterminate'),
      direction_en: hist.item ? (hist.item.observed_direction || (directlyRanked ? direct.item.direction_en : 'indeterminate')) : (directlyRanked ? direct.item.direction_en : 'indeterminate'),
      direction_ar: hist.item ? (hist.item.movement_ar || (directlyRanked ? direct.item.direction_ar : 'غير محدد')) : (directlyRanked ? direct.item.direction_ar : 'غير محدد'),
      confirmation: directlyRanked ? direct.item.confirmation : (intel && intel.regime_alignment ? intel.regime_alignment.state : 'indeterminate'),
      confirmation_en: directlyRanked ? direct.item.confirmation_en : (intel && intel.regime_alignment ? intel.regime_alignment.label_en : 'indeterminate'),
      confirmation_ar: directlyRanked ? direct.item.confirmation_ar : (intel && intel.regime_alignment ? intel.regime_alignment.label_ar : 'غير محدد'),
      historical_direction: hist.item ? hist.item.movement : 'no_direct_history',
      relative_strength_refs: relativeRefs(relative, etf.symbol),
      evidence: evidence.slice(0, 6),
    };
  });

  const ranked = items
    .filter((item) => item.available)
    .sort((a, b) => (RANK_ORDER[b.rank_label] - RANK_ORDER[a.rank_label]) || a.symbol.localeCompare(b.symbol));
  const strongest = ranked.slice(0, 5);
  const weakest = ranked.slice(-5).reverse();
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');
  const directCount = items.filter((i) => i.source_group !== 'chart_derived' && i.source_group !== 'unranked').length;
  const chartDerivedCount = items.filter((i) => i.source_group === 'chart_derived').length;

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-rankings',
    available: ranked.length > 0,
    total: items.length,
    ranked_count: ranked.length,
    direct_ranked_count: directCount,
    chart_derived_count: chartDerivedCount,
    strongest_etfs: strongest.map((item) => item.symbol),
    weakest_etfs: weakest.map((item) => item.symbol),
    items,
    evidence_refs: [
      { source: 'data/intelligence/rankings.json', evidence: ['direct ETF ticker matches when present'] },
      { source: 'data/intelligence/relative-strength.json', evidence: ['relationship context when direct symbol appears'] },
      { source: 'data/intelligence/ranking-history.json', evidence: ['historical direction when direct symbol appears'] },
      { source: 'data/intelligence/etf-intelligence.json', evidence: ['ETF confidence and regime context'] },
      { source: 'data/intelligence/etf-charts.json', evidence: ['per-ETF verified OHLCV used for chart-derived ranks when no direct source exists'] },
    ],
    source_hash: sourceHash,
    attribution: {
      sources: ['rankings', 'relative-strength', 'ranking-history', 'etf-intelligence', 'etf-charts'],
      note: 'ETF rankings prefer direct existing ranking coverage. Where no direct source exists, the rank is derived from the ETF own verified OHLCV using the same composite strength scalar as asset/sector/equity rankings. This is not proxy substitution. ETFs without a verified chart remain indeterminate.',
    },
  };
}

if (require.main === module) {
  const artifact = build();
  console.log(`[etf-rankings] ranked=${artifact.ranked_count}/${artifact.total} (direct=${artifact.direct_ranked_count} chart_derived=${artifact.chart_derived_count}) strongest=${artifact.strongest_etfs.join(',')}`);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-rankings] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
