'use strict';

// Phase 214 CP4 - ETF rankings.
// Composes direct ETF symbols already present in existing rankings / relative
// strength / ranking history artifacts. No proxy substitution and no synthetic
// score generation.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'etf-rankings.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const RANK_ORDER = { strongest: 6, strong: 5, constructive: 4, neutral: 3, weakening: 2, weak: 1, weakest: 0, indeterminate: -1 };

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

function build() {
  const rankings = readJson('rankings.json', {});
  const relative = readJson('relative-strength.json', {});
  const history = readJson('ranking-history.json', {});
  const intelligence = readJson('etf-intelligence.json', {});

  const intelBySymbol = new Map((intelligence.etfs || []).map((entry) => [entry.symbol, entry]));
  const items = ETFS.map((etf) => {
    const direct = findRanking(rankings, etf.symbol);
    const hist = findHistory(history, etf.symbol);
    const intel = intelBySymbol.get(etf.symbol);
    const available = Boolean(direct.item && direct.item.available === true);
    const evidence = available
      ? [
          `direct ${direct.group} ranking source`,
          ...(direct.item.evidence || []).slice(0, 3),
          `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`
        ]
      : [
          'no direct ETF ranking source available',
          `ETF intelligence confidence=${intel && intel.confidence ? intel.confidence.state : 'indeterminate'}`,
          'proxy substitution suppressed'
        ];
    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      exposure_type: etf.exposure_type,
      fund_name: etf.fund_name,
      available,
      source_group: direct.group,
      rank_label: available ? direct.item.rank_label : 'indeterminate',
      rank_label_en: available ? direct.item.rank_label_en : 'indeterminate',
      rank_label_ar: available ? direct.item.rank_label_ar : 'غير محدد',
      direction: hist.item ? hist.item.observed_direction : (available ? direct.item.direction : 'indeterminate'),
      direction_en: hist.item ? (hist.item.observed_direction || direct.item.direction_en) : (available ? direct.item.direction_en : 'indeterminate'),
      direction_ar: hist.item ? (hist.item.movement_ar || direct.item.direction_ar) : (available ? direct.item.direction_ar : 'غير محدد'),
      confirmation: available ? direct.item.confirmation : (intel && intel.regime_alignment ? intel.regime_alignment.state : 'indeterminate'),
      confirmation_en: available ? direct.item.confirmation_en : (intel && intel.regime_alignment ? intel.regime_alignment.label_en : 'indeterminate'),
      confirmation_ar: available ? direct.item.confirmation_ar : (intel && intel.regime_alignment ? intel.regime_alignment.label_ar : 'غير محدد'),
      historical_direction: hist.item ? hist.item.movement : 'no_direct_history',
      relative_strength_refs: relativeRefs(relative, etf.symbol),
      evidence: evidence.slice(0, 6)
    };
  });

  const ranked = items
    .filter((item) => item.available)
    .sort((a, b) => (RANK_ORDER[b.rank_label] - RANK_ORDER[a.rank_label]) || a.symbol.localeCompare(b.symbol));
  const strongest = ranked.slice(0, 5);
  const weakest = ranked.slice(-5).reverse();
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex');

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-rankings',
    available: ranked.length > 0,
    total: items.length,
    ranked_count: ranked.length,
    strongest_etfs: strongest.map((item) => item.symbol),
    weakest_etfs: weakest.map((item) => item.symbol),
    items,
    evidence_refs: [
      { source: 'data/intelligence/rankings.json', evidence: ['direct ETF ticker matches only'] },
      { source: 'data/intelligence/relative-strength.json', evidence: ['relationship context when direct symbol appears'] },
      { source: 'data/intelligence/ranking-history.json', evidence: ['historical direction when direct symbol appears'] },
      { source: 'data/intelligence/etf-intelligence.json', evidence: ['ETF confidence and regime context'] }
    ],
    source_hash: sourceHash,
    attribution: {
      sources: ['rankings', 'relative-strength', 'ranking-history', 'etf-intelligence'],
      note: 'ETF rankings use direct existing ranking coverage only. ETFs without direct coverage remain indeterminate.'
    }
  };
}

if (require.main === module) {
  const artifact = build();
  console.log(`[etf-rankings] ranked=${artifact.ranked_count}/${artifact.total} strongest=${artifact.strongest_etfs.join(',')}`);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-rankings] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
