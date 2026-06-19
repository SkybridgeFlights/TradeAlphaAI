'use strict';

// Phase 214 CP3 — ETF intelligence composition.
// Extends existing intelligence with ETF-level structure/tactical/liquidity/
// participation states. No new market engine and no fabricated chart evidence.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'etf-intelligence.json');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.isAbsolute(rel) ? rel : J(rel), 'utf8')); } catch { return fallback; }
}

function labels(state) {
  return {
    constructive: ['constructive', 'بنّاء'],
    neutral: ['neutral', 'محايد'],
    pressured: ['pressured', 'تحت ضغط'],
    mixed: ['mixed', 'مختلط'],
    indeterminate: ['indeterminate', 'غير حاسم'],
    unavailable: ['unavailable', 'غير متاح']
  }[state] || ['indeterminate', 'غير حاسم'];
}

function node(state, evidence) {
  const [label_en, label_ar] = labels(state);
  return { state, label_en, label_ar, evidence: evidence.slice(0, 4) };
}

function chartFor(charts, symbol) {
  return ((charts || {}).charts || []).find((chart) => chart.symbol === symbol) || null;
}

function flowProfile(flow, symbol) {
  const profiles = flow && flow.etf_profiles;
  return profiles && profiles[symbol] ? profiles[symbol] : null;
}

function regimeAlignment(etf, regime) {
  const current = String((regime && regime.current_regime && regime.current_regime.state) || '').toLowerCase();
  if (!current) return 'indeterminate';
  if (current.includes('defensive') && etf.regime_sensitivity.some((x) => /defensive|duration|income|yield/.test(x))) return 'constructive';
  if (current.includes('growth') && etf.regime_sensitivity.some((x) => /growth|ai|cyclical/.test(x))) return 'constructive';
  if (current.includes('risk') && etf.regime_sensitivity.some((x) => /risk|credit|equity/.test(x))) return 'mixed';
  return 'neutral';
}

function confidenceFor(hasChart, profile) {
  if (hasChart && profile) return 'moderate';
  if (hasChart || profile) return 'low';
  return 'indeterminate';
}

function dominantStoryLabel(narrative) {
  const story = narrative && narrative.dominant_story;
  if (!story) return 'indeterminate';
  if (typeof story === 'string') return story;
  if (typeof story === 'object') {
    return story.state || story.label_en || story.title_en || story.headline_en || story.theme || 'available';
  }
  return 'available';
}

function build() {
  const charts = readJson('etf-charts.json', {});
  const flow = readJson('etf-flow-intelligence.json', {});
  const regime = readJson('market-regime-dashboard.json', {});
  const narrative = readJson('market-narrative.json', {});
  const dominantStory = dominantStoryLabel(narrative);
  const etfs = ETFS.map((etf) => {
    const chart = chartFor(charts, etf.symbol);
    const profile = flowProfile(flow, etf.symbol);
    const hasChart = Boolean(chart && chart.verified === true);
    const unavailable = ((charts.unavailable || []).find((u) => u.symbol === etf.symbol) || {}).reason || null;
    const baseEvidence = [
      `registry category=${etf.category}`,
      `registry exposure=${etf.exposure_type}`,
      `market regime=${(regime.current_regime && regime.current_regime.state) || 'indeterminate'}`
    ];
    if (profile) baseEvidence.push('etf-flow-intelligence profile available');
    if (hasChart) baseEvidence.push(`verified OHLCV chart as_of=${chart.as_of}`);
    else baseEvidence.push(`verified OHLCV chart unavailable: ${unavailable || 'unavailable'}`);
    const structure = hasChart ? 'neutral' : 'indeterminate';
    const tactical = regimeAlignment(etf, regime);
    const liquidity = profile && profile.characteristics && profile.characteristics.liquidity_tier
      ? (String(profile.characteristics.liquidity_tier).includes('high') ? 'constructive' : 'neutral')
      : 'indeterminate';
    const participation = etf.category === 'sector' ? 'mixed' : etf.category === 'broad_market' ? 'constructive' : 'neutral';
    const confidence = confidenceFor(hasChart, profile);
    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      exposure_type: etf.exposure_type,
      fund_name: etf.fund_name,
      role_en: etf.role_en,
      role_ar: etf.role_ar,
      chart_available: hasChart,
      chart_id: chart ? chart.id : null,
      unavailable_reason: hasChart ? null : unavailable || 'approved_ohlcv_unavailable',
      structure: node(structure, hasChart ? [`chart structure=${chart.chart_type || chart.visual_type}`, `series_hash=${chart.series_hash}`] : baseEvidence),
      tactical: node(tactical, baseEvidence),
      liquidity: node(liquidity, profile && profile.characteristics ? [`liquidity_tier=${profile.characteristics.liquidity_tier}`] : baseEvidence),
      participation: node(participation, [`category=${etf.category}`, `related=${etf.related.join(',')}`]),
      confidence: node(confidence, baseEvidence),
      regime_alignment: node(tactical, baseEvidence),
      narrative_alignment: {
        state: narrative && narrative.dominant_story ? 'available' : 'indeterminate',
        label_en: narrative && narrative.dominant_story ? 'available narrative context' : 'indeterminate',
        label_ar: narrative && narrative.dominant_story ? 'سياق سردي متاح' : 'غير حاسم',
        evidence: [`dominant_story=${dominantStory}`]
      },
      evidence: baseEvidence.slice(0, 6),
      related: etf.related,
      research_links: etf.research_links
    };
  });
  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(etfs)).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_layer: 'etf-intelligence',
    available: true,
    etfs_total: ETFS.length,
    etfs,
    evidence_refs: [
      { source: 'tools/etf-registry.js', value: String(ETFS.length), evidence: ['canonical ETF universe'] },
      { source: 'data/intelligence/etf-charts.json', value: (charts.status || 'unavailable'), evidence: [`charts=${(charts.charts || []).length}`] },
      { source: 'data/intelligence/market-regime-dashboard.json', value: (regime.current_regime && regime.current_regime.state) || 'indeterminate', evidence: ['regime alignment context'] },
      { source: 'data/intelligence/etf-flow-intelligence.json', value: String(Object.keys((flow && flow.etf_profiles) || {}).length), evidence: ['ETF profile context'] }
    ],
    source_hash: sourceHash,
    attribution: {
      sources: ['tools/etf-registry.js', 'data/intelligence/etf-charts.json', 'data/intelligence/market-regime-dashboard.json', 'data/intelligence/etf-flow-intelligence.json', 'data/intelligence/market-narrative.json'],
      note: 'ETF intelligence composes existing registry, chart coverage, flow profiles, regime and narrative artifacts. Educational context only.'
    }
  };
}

if (require.main === module) {
  const artifact = build();
  console.log(`[etf-intelligence] etfs=${artifact.etfs.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-intelligence] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
