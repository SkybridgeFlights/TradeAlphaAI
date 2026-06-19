'use strict';

// Phase 212 / CP1-CP4 — research network engine. Aggregates and ORCHESTRATES the
// existing Phase 200-211 intelligence into a research layer. Builds nothing new:
// it reuses regime, narrative, rankings, relative-strength, historical, leadership,
// confirmation, macro, asset/sector/equity intelligence and visual maps.
//
// Outputs (data/intelligence/):
//   research-hub.json        — structured research categories (CP1)
//   research-graph.json      — evidence-backed Macro→Regime→Assets→Sectors→
//                              Equities→Historical relationships (CP2)
//   intelligence-briefs.json — institutional briefs: what changed/improved/
//                              deteriorated/confirms/contradicts (CP3)
//   research-authority.json  — per-object evidence/confidence/confirmation/
//                              contradiction + WHY (CP4)
//
// Anti-fabrication: every category item links an existing page; every graph edge
// and brief line cites a real loaded artifact field; missing data → honest empty,
// never invented. No signals, forecasts, targets or recommendations.
//
// Usage: node tools/build-research-hub.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

// ── Load the existing intelligence (reuse only). ──
const macro = readJson(J('macro-regime.json'), {});
const dollar = readJson(J('dollar-intelligence.json'), {});
const yieldA = readJson(J('yield-intelligence.json'), {});
const vol = readJson(J('volatility-intelligence.json'), {});
const dash = readJson(J('market-regime-dashboard.json'), {});
const narrative = readJson(J('market-narrative.json'), {});
const transitions = readJson(J('regime-transitions.json'), {});
const confirmation = readJson(J('confirmation-matrix.json'), {});
const leadership = readJson(J('leadership-dashboard.json'), {});
const historical = readJson(J('historical-intelligence.json'), {});
const rankHistory = readJson(J('ranking-history.json'), {});
const assetRanks = readJson(J('asset-rankings.json'), {});
const sectorRanks = readJson(J('sector-rankings.json'), {});
const equityRanks = readJson(J('equity-rankings.json'), {});

const lv = (o, k) => (o && o[`${k}_en`] ? { en: o[`${k}_en`], ar: o[`${k}_ar`] || o[`${k}_en`] } : null);
const storyOf = (o) => (o && o.dominant_story ? { en: o.dominant_story.label_en, ar: o.dominant_story.label_ar } : (o && o.current_regime ? { en: o.current_regime.label_en, ar: o.current_regime.label_ar } : null));

// ────────────────────────────── CP1: research-hub ──────────────────────────────
function buildHub() {
  const categories = [
    {
      id: 'macro', title_en: 'Macro Research', title_ar: 'أبحاث الماكرو',
      summary_en: 'The dollar, yields and volatility context that frames the regime.',
      summary_ar: 'سياق الدولار والعوائد والتقلب الذي يؤطّر النظام.',
      items: [
        { title_en: 'Regime research center', title_ar: 'مركز أبحاث النظام', href: '/research/regime/', kind: 'research' },
        { title_en: 'Regime map', title_ar: 'خريطة النظام', href: '/market-map/regime/', kind: 'visual' },
        { title_en: 'Market regime command center', title_ar: 'مركز قيادة نظام السوق', href: '/market-regime/', kind: 'intelligence' },
      ],
      evidence: [dollar && dollar.available ? `dollar=${(lv(dollar, 'dollar_regime') || {}).en}` : 'dollar=indeterminate', yieldA && yieldA.available ? `yield=${(lv(yieldA, 'yield_regime') || {}).en}` : 'yield=indeterminate', vol && vol.available ? `volatility=${(lv(vol, 'volatility_regime') || {}).en}` : 'volatility=indeterminate'].filter(Boolean),
    },
    {
      id: 'regime', title_en: 'Regime Research', title_ar: 'أبحاث النظام',
      summary_en: 'The composed market regime with its confirmation and contradiction.',
      summary_ar: 'النظام المركّب للسوق مع تأكيده وتناقضه.',
      items: [
        { title_en: 'Regime research center', title_ar: 'مركز أبحاث النظام', href: '/research/regime/', kind: 'research' },
        { title_en: 'Market regime command center', title_ar: 'مركز قيادة نظام السوق', href: '/market-regime/', kind: 'intelligence' },
        { title_en: 'Institutional market terminal', title_ar: 'الطرفية المؤسسية', href: '/market-terminal/', kind: 'intelligence' },
      ],
      evidence: [storyOf(dash) ? `regime=${storyOf(dash).en}` : 'regime=indeterminate'].filter(Boolean),
    },
    {
      id: 'assets', title_en: 'Asset Research', title_ar: 'أبحاث الأصول',
      summary_en: 'Broad-market asset leadership, ranking and change.',
      summary_ar: 'قيادة أصول السوق العريض وترتيبها وتغيّرها.',
      items: [
        { title_en: 'Asset rankings', title_ar: 'ترتيب الأصول', href: '/rankings/assets/', kind: 'intelligence' },
        { title_en: 'Asset map', title_ar: 'خريطة الأصول', href: '/market-map/assets/', kind: 'visual' },
        { title_en: 'All assets', title_ar: 'كل الأصول', href: '/markets/', kind: 'intelligence' },
      ],
      evidence: [`assets_ranked=${((assetRanks.items || []).filter((x) => x.available !== false)).length}`],
    },
    {
      id: 'sectors', title_en: 'Sector Research', title_ar: 'أبحاث القطاعات',
      summary_en: 'Sector leadership, rotation and participation.',
      summary_ar: 'قيادة القطاعات والتدوير والمشاركة.',
      items: [
        { title_en: 'Sector rankings', title_ar: 'ترتيب القطاعات', href: '/rankings/sectors/', kind: 'intelligence' },
        { title_en: 'Sector map', title_ar: 'خريطة القطاعات', href: '/market-map/sectors/', kind: 'visual' },
        { title_en: 'All sectors', title_ar: 'كل القطاعات', href: '/sectors/', kind: 'intelligence' },
      ],
      evidence: [`sectors_ranked=${((sectorRanks.items || []).filter((x) => x.available !== false)).length}`],
    },
    {
      id: 'equities', title_en: 'Equity Research', title_ar: 'أبحاث الأسهم',
      summary_en: 'Single-name equity leadership and relationships.',
      summary_ar: 'قيادة الأسهم الفردية وعلاقاتها.',
      items: [
        { title_en: 'Equity rankings', title_ar: 'ترتيب الأسهم', href: '/rankings/equities/', kind: 'intelligence' },
        { title_en: 'Equity leadership map', title_ar: 'خريطة قيادة الأسهم', href: '/market-map/equities/', kind: 'visual' },
        { title_en: 'All equities', title_ar: 'كل الأسهم', href: '/equities/', kind: 'intelligence' },
      ],
      evidence: [`equities_ranked=${((equityRanks.items || []).filter((x) => x.available !== false)).length}`],
    },
    {
      id: 'historical', title_en: 'Historical Research', title_ar: 'الأبحاث التاريخية',
      summary_en: 'What is improving, stable or deteriorating, and regime transition.',
      summary_ar: 'ما الذي يتحسّن أو يستقر أو يتدهور، وتحوّل النظام.',
      items: [
        { title_en: 'Historical evolution map', title_ar: 'خريطة التطوّر التاريخي', href: '/market-map/history/', kind: 'visual' },
        { title_en: 'Confirmation network map', title_ar: 'خريطة شبكة التأكيد', href: '/market-map/network/', kind: 'visual' },
        { title_en: 'Institutional market terminal', title_ar: 'الطرفية المؤسسية', href: '/market-terminal/', kind: 'intelligence' },
      ],
      evidence: [historical && historical.scored ? `historical_scored=${historical.scored}` : 'historical=indeterminate', transitions && transitions.available ? `transition=${(lv(transitions, 'transition_state') || {}).en}` : 'transition=indeterminate'].filter(Boolean),
    },
  ];
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'research-hub',
    available: categories.some((c) => c.items.length), category_count: categories.length, categories,
    attribution: { sources: ['macro-regime.json', 'market-regime-dashboard.json', 'asset-rankings.json', 'sector-rankings.json', 'equity-rankings.json', 'historical-intelligence.json'], note: 'Research hub aggregates existing intelligence surfaces. Educational context, not signals, forecasts, price targets or recommendations.' },
  };
}

// ────────────────────────────── CP2: research-graph ─────────────────────────────
function buildGraph() {
  const nodes = [
    { id: 'macro', label_en: 'Macro', label_ar: 'الماكرو', href: '/market-map/regime/' },
    { id: 'regime', label_en: 'Regime', label_ar: 'النظام', href: '/research/regime/' },
    { id: 'assets', label_en: 'Assets', label_ar: 'الأصول', href: '/rankings/assets/' },
    { id: 'sectors', label_en: 'Sectors', label_ar: 'القطاعات', href: '/rankings/sectors/' },
    { id: 'equities', label_en: 'Equities', label_ar: 'الأسهم', href: '/rankings/equities/' },
    { id: 'historical', label_en: 'Historical Intelligence', label_ar: 'الاستخبارات التاريخية', href: '/market-map/history/' },
  ];
  const edges = [];
  const add = (from, to, relation_en, relation_ar, evidence) => { if (evidence && evidence.length) edges.push({ from, to, relation_en, relation_ar, evidence }); };
  // macro → regime: the regime is composed FROM dollar/yield/volatility (real composition).
  if (macro && macro.available) add('macro', 'regime', 'composes the regime', 'يكوّن النظام', [`macro_regime=${(lv(macro, 'macro_regime') || {}).en || macro.macro_regime}`, dollar && dollar.available ? `dollar=${(lv(dollar, 'dollar_regime') || {}).en}` : null, yieldA && yieldA.available ? `yield=${(lv(yieldA, 'yield_regime') || {}).en}` : null].filter(Boolean));
  // regime → assets: asset rankings incorporate regime alignment (real evidence in rankings).
  if (dash && storyOf(dash) && (assetRanks.items || []).length) add('regime', 'assets', 'frames asset leadership', 'يؤطّر قيادة الأصول', [`regime=${storyOf(dash).en}`, `assets_ranked=${(assetRanks.items || []).length}`]);
  // assets → sectors: sector rotation is measured relative to the broad market (real).
  if ((assetRanks.items || []).length && (sectorRanks.items || []).length) add('assets', 'sectors', 'sets the broad-market baseline for rotation', 'يضع خط الأساس للتدوير', [`assets_ranked=${(assetRanks.items || []).length}`, `sectors_ranked=${(sectorRanks.items || []).length}`]);
  // sectors → equities: each equity is linked to its sector structure (real registry link).
  if ((sectorRanks.items || []).length && (equityRanks.items || []).length) add('sectors', 'equities', 'conditions single-name leadership', 'يهيّئ قيادة الأسهم الفردية', [`sectors_ranked=${(sectorRanks.items || []).length}`, `equities_ranked=${(equityRanks.items || []).length}`]);
  // equities → historical: historical intelligence scores the equities over time (real).
  if ((equityRanks.items || []).length && historical && historical.scored) add('equities', 'historical', 'accumulates into historical change', 'يتراكم في التغيّر التاريخي', [`historical_scored=${historical.scored}`]);
  // historical → regime: regime transition is derived from historical driver windows (real feedback).
  if (transitions && transitions.available) add('historical', 'regime', 'informs regime transition', 'يُعلِم تحوّل النظام', [`transition=${(lv(transitions, 'transition_state') || {}).en}`]);
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'research-graph',
    available: edges.length > 0, node_count: nodes.length, edge_count: edges.length, nodes, edges,
    attribution: { sources: ['macro-regime.json', 'market-regime-dashboard.json', 'asset-rankings.json', 'sector-rankings.json', 'equity-rankings.json', 'historical-intelligence.json', 'regime-transitions.json'], note: 'Evidence-backed relationships only; no fabricated links. Educational context, not signals or forecasts.' },
  };
}

// ────────────────────────────── CP3: intelligence-briefs ────────────────────────
function topN(ranks, label, n = 3) { return (ranks.items || []).filter((x) => x.available !== false && x.rank_label === label).slice(0, n).map((x) => x.symbol); }
function dirN(ranks, dir, n = 4) { return (ranks.items || []).filter((x) => x.available !== false && x.direction === dir).slice(0, n).map((x) => x.symbol); }

function buildBriefs() {
  const briefs = [];
  const snap = (dash && dash.leadership_snapshot) || {};
  // Leadership brief — what improved / what deteriorated (observed ranks + direction).
  const improved = [...dirN(assetRanks, 'improving'), ...dirN(sectorRanks, 'improving'), ...dirN(equityRanks, 'improving')];
  const deteriorated = [...dirN(assetRanks, 'deteriorating'), ...dirN(sectorRanks, 'deteriorating'), ...dirN(equityRanks, 'deteriorating')];
  briefs.push({
    id: 'leadership', title_en: 'Leadership brief', title_ar: 'إحاطة القيادة',
    summary_en: 'Where observed strength and weakness sit across assets, sectors and equities.',
    summary_ar: 'أين تقع القوة والضعف المرصودان عبر الأصول والقطاعات والأسهم.',
    improved, deteriorated,
    confirms: (snap.strongest_assets || []).slice(0, 3),
    contradicts: (snap.weakest_assets || []).slice(0, 3),
    evidence: [`strongest_assets=${(snap.strongest_assets || []).join('/') || 'n/a'}`, `weakest_assets=${(snap.weakest_assets || []).join('/') || 'n/a'}`, `strongest_sectors=${(snap.strongest_sectors || []).join('/') || 'n/a'}`, `strongest_equities=${(snap.strongest_equities || []).join('/') || 'n/a'}`],
    href: '/rankings/',
  });
  // Regime brief — the composed regime + confirmation / contradiction.
  briefs.push({
    id: 'regime', title_en: 'Regime brief', title_ar: 'إحاطة النظام',
    summary_en: 'The composed market regime with its confirmation and contradiction.',
    summary_ar: 'النظام المركّب للسوق مع تأكيده وتناقضه.',
    improved: [], deteriorated: [],
    confirms: narrative && narrative.confirmation_story ? [narrative.confirmation_story.label_en] : [],
    contradicts: narrative && narrative.contradiction_story ? [narrative.contradiction_story.label_en] : [],
    state_en: storyOf(dash) ? storyOf(dash).en : 'indeterminate', state_ar: storyOf(dash) ? storyOf(dash).ar : 'غير محدد',
    evidence: [storyOf(dash) ? `regime=${storyOf(dash).en}` : 'regime=indeterminate', confirmation && confirmation.matrix_state ? `matrix=${confirmation.matrix_state}` : 'matrix=indeterminate'].filter(Boolean),
    href: '/research/regime/',
  });
  // Historical brief — what is changing through time (momentum buckets), honest if thin.
  const hb = { improving: [], deteriorating: [] };
  for (const g of Object.values((historical && historical.groups) || {})) for (const x of (g || [])) {
    const m = x.momentum && x.momentum.state;
    if (/positive/.test(m || '')) hb.improving.push(x.symbol);
    else if (/negative/.test(m || '')) hb.deteriorating.push(x.symbol);
  }
  briefs.push({
    id: 'historical', title_en: 'Historical change brief', title_ar: 'إحاطة التغيّر التاريخي',
    summary_en: 'Observed momentum and regime transition through time.',
    summary_ar: 'الزخم المرصود وتحوّل النظام عبر الوقت.',
    improved: hb.improving.slice(0, 5), deteriorated: hb.deteriorating.slice(0, 5),
    confirms: transitions && transitions.available ? [(lv(transitions, 'transition_state') || {}).en] : [],
    contradicts: [],
    has_prior: rankHistory && rankHistory.has_prior === true,
    evidence: [historical && historical.scored ? `historical_scored=${historical.scored}` : 'historical=indeterminate', `ranking_history_prior=${rankHistory && rankHistory.has_prior === true}`],
    href: '/market-map/history/',
  });
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'intelligence-briefs',
    available: briefs.length > 0, brief_count: briefs.length, briefs,
    attribution: { sources: ['asset-rankings.json', 'sector-rankings.json', 'equity-rankings.json', 'market-regime-dashboard.json', 'market-narrative.json', 'historical-intelligence.json', 'regime-transitions.json', 'confirmation-matrix.json'], note: 'Briefs describe what changed, improved, deteriorated, confirms or contradicts from observed intelligence. No forecasts, signals or recommendations.' },
  };
}

// ────────────────────────────── CP4: research-authority ─────────────────────────
function buildAuthority(hub, briefs) {
  const objects = [];
  const band = (dash && dash.confidence_band) || (narrative && narrative.confidence_band) || 'indeterminate';
  for (const c of hub.categories) {
    objects.push({
      ref: `category:${c.id}`, title_en: c.title_en, title_ar: c.title_ar, kind: 'category',
      confidence_band: band, evidence: c.evidence || [],
      confirmation: narrative && narrative.confirmation_story ? narrative.confirmation_story.label_en : 'indeterminate',
      contradiction: narrative && narrative.contradiction_story ? narrative.contradiction_story.label_en : 'indeterminate',
      why_en: `This research draws on ${(c.evidence || []).length} observed input(s) from the existing intelligence; the conclusion exists because those artifacts report ${(c.evidence || [])[0] || 'their current state'}.`,
      why_ar: `تستند هذه الأبحاث إلى ${(c.evidence || []).length} مُدخلاً مرصوداً من الاستخبارات القائمة؛ والاستنتاج قائم لأن تلك المصادر تُظهر ${(c.evidence || [])[0] || 'حالتها الراهنة'}.`,
    });
  }
  for (const b of briefs.briefs) {
    objects.push({
      ref: `brief:${b.id}`, title_en: b.title_en, title_ar: b.title_ar, kind: 'brief',
      confidence_band: band, evidence: b.evidence || [],
      confirmation: (b.confirms || []).join('; ') || 'indeterminate',
      contradiction: (b.contradicts || []).join('; ') || 'indeterminate',
      why_en: `This brief exists because the observed inputs (${(b.evidence || []).slice(0, 2).join(', ') || 'current state'}) report that state; it is description, not a forecast.`,
      why_ar: `هذه الإحاطة قائمة لأن المُدخلات المرصودة (${(b.evidence || []).slice(0, 2).join('، ') || 'الحالة الراهنة'}) تُظهر تلك الحالة؛ وهي وصف وليست توقعاً.`,
    });
  }
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'research-authority',
    available: objects.length > 0, object_count: objects.length, confidence_band: band, objects,
    attribution: { sources: ['research-hub.json', 'intelligence-briefs.json', 'market-regime-dashboard.json', 'market-narrative.json'], note: 'Authority surfaces the evidence, confidence, confirmation and contradiction behind each research object. Educational context, not signals or forecasts.' },
  };
}

function build() {
  const hub = buildHub();
  const graph = buildGraph();
  const briefs = buildBriefs();
  const authority = buildAuthority(hub, briefs);
  return { hub, graph, briefs, authority };
}

if (require.main === module) {
  const r = build();
  console.log(`[research-hub] categories=${r.hub.category_count} graph_edges=${r.graph.edge_count} briefs=${r.briefs.brief_count} authority_objects=${r.authority.object_count}`);
  if (WRITE) {
    fs.writeFileSync(J('research-hub.json'), `${JSON.stringify(r.hub, null, 2)}\n`);
    fs.writeFileSync(J('research-graph.json'), `${JSON.stringify(r.graph, null, 2)}\n`);
    fs.writeFileSync(J('intelligence-briefs.json'), `${JSON.stringify(r.briefs, null, 2)}\n`);
    fs.writeFileSync(J('research-authority.json'), `${JSON.stringify(r.authority, null, 2)}\n`);
    console.log('[research-hub] wrote 4 research artifacts');
  }
}

module.exports = { build, buildHub, buildGraph, buildBriefs, buildAuthority };
