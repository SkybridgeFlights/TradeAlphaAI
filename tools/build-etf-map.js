'use strict';

// Phase 214 CP7 + Phase 215 CP8 — ETF visual map artifact.
// Now carries quality_tier / provider_confidence / resolved_provider so the
// map can visualise available vs unavailable ETFs and the quality
// distribution. Honest — unavailable ETFs remain unavailable.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'visual', 'etf-map.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);

function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(J(rel), 'utf8')); } catch { return fallback; }
}

function stateRank(label) {
  return { strongest: 6, strong: 5, constructive: 4, neutral: 3, weakening: 2, weak: 1, weakest: 0, indeterminate: -1 }[label] ?? -1;
}

function build() {
  const rankings = readJson('etf-rankings.json', {});
  const intelligence = readJson('etf-intelligence.json', {});
  const history = readJson('etf-history.json', {});
  const quality = readJson('etf-data-quality.json', {});
  const rankingBy = new Map((rankings.items || []).map((item) => [item.symbol, item]));
  const intelBy = new Map((intelligence.etfs || []).map((item) => [item.symbol, item]));
  const qualityBy = new Map((quality.etfs || []).map((item) => [item.symbol, item]));
  const histBy = history.entities || {};
  const nodes = ETFS.map((etf) => {
    const rank = rankingBy.get(etf.symbol) || {};
    const intel = intelBy.get(etf.symbol) || {};
    const hist = histBy[etf.symbol] || {};
    const q = qualityBy.get(etf.symbol) || {};
    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      exposure_type: etf.exposure_type,
      label_en: etf.fund_name,
      label_ar: etf.fund_name,
      rank_label: rank.rank_label || 'indeterminate',
      rank_label_en: rank.rank_label_en || 'indeterminate',
      rank_label_ar: rank.rank_label_ar || 'غير محدد',
      direction: rank.direction || hist.current_state || 'indeterminate',
      direction_en: rank.direction_en || hist.current_state_en || 'indeterminate',
      direction_ar: rank.direction_ar || hist.current_state_ar || 'غير محدد',
      confirmation: rank.confirmation || (intel.regime_alignment && intel.regime_alignment.state) || 'indeterminate',
      confirmation_en: rank.confirmation_en || (intel.regime_alignment && intel.regime_alignment.label_en) || 'indeterminate',
      confirmation_ar: rank.confirmation_ar || (intel.regime_alignment && intel.regime_alignment.label_ar) || 'غير محدد',
      chart_available: Boolean(intel.chart_available),
      available: Boolean(rank.available),
      quality_tier: q.quality_tier || 'unavailable',
      quality_tier_en: q.quality_tier_en || 'unavailable',
      quality_tier_ar: q.quality_tier_ar || 'غير متاحة',
      provider_confidence: q.provider_confidence || 'unavailable',
      provider_confidence_en: q.provider_confidence_en || 'unavailable',
      provider_confidence_ar: q.provider_confidence_ar || 'غير متاح',
      resolved_provider: q.resolved_provider || null,
      bars: q.bars || 0,
      evidence: [
        `rank=${rank.rank_label || 'indeterminate'}`,
        `direction=${rank.direction || hist.current_state || 'indeterminate'}`,
        `confirmation=${rank.confirmation || 'indeterminate'}`,
        `chart_available=${Boolean(intel.chart_available)}`,
        `quality_tier=${q.quality_tier || 'unavailable'}`,
        `provider=${q.resolved_provider || 'none'}`,
      ],
      visual_weight: stateRank(rank.rank_label || 'indeterminate'),
    };
  }).sort((a, b) => (b.visual_weight - a.visual_weight) || a.symbol.localeCompare(b.symbol));
  const summary = {
    available: nodes.filter((n) => n.available).length,
    unavailable: nodes.filter((n) => !n.available).length,
    quality_high: nodes.filter((n) => n.quality_tier === 'high').length,
    quality_medium: nodes.filter((n) => n.quality_tier === 'medium').length,
    quality_low: nodes.filter((n) => n.quality_tier === 'low').length,
    quality_unavailable: nodes.filter((n) => n.quality_tier === 'unavailable').length,
    chart_verified: nodes.filter((n) => n.chart_available).length,
  };
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(nodes)).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-map',
    available: true,
    nodes_total: nodes.length,
    summary,
    nodes,
    groups: [...new Set(nodes.map((node) => node.category))],
    source_hash: sourceHash,
    attribution: {
      sources: ['etf-rankings', 'etf-intelligence', 'etf-history', 'etf-data-quality'],
      note: 'Visual ETF map composes existing ETF rankings, intelligence, history and the data-quality layer. Available, unavailable and quality tiers are shown honestly; no proxy substitution.',
    },
  };
}

if (require.main === module) {
  const artifact = build();
  console.log(`[etf-map] nodes=${artifact.nodes.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-map] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
