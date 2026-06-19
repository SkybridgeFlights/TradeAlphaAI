'use strict';

// Phase 213 / CP1 + CP2 — entity research engine. Lifts the research layer from
// category-level (Phase 212) to entity-level. For every asset/sector/equity it
// composes a research object from the EXISTING intelligence (rankings, relative
// strength, historical intelligence, visual maps, narrative, regime). Builds no
// new intelligence; fabricates nothing; no forecasts/signals/targets.
//
// Outputs (data/intelligence/):
//   entity-research-assets.json / -sectors.json / -equities.json  (CP1)
//   entity-research-graph.json                                    (CP2)
//
// Usage: node tools/build-entity-research.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const V = (n) => path.join(ROOT, 'data', 'visual', n);
const WRITE = process.argv.includes('--write');
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

const assetReg = require('./asset-registry');
const sectorReg = require('./sector-registry');
const equityReg = require('./equity-registry');

const GROUPS = {
  asset: { reg: assetReg.ASSETS, rankings: 'asset-rankings.json', map: 'asset-map.json', hist: 'asset', base: 'markets', research: 'assets' },
  sector: { reg: sectorReg.SECTORS, rankings: 'sector-rankings.json', map: 'sector-map.json', hist: 'sector', base: 'sectors', research: 'sectors' },
  equity: { reg: equityReg.EQUITIES, rankings: 'equity-rankings.json', map: 'equity-map.json', hist: 'equity', base: 'equities', research: 'equities' },
};

const narrative = readJson(J('market-narrative.json'), {});
const historical = readJson(J('historical-intelligence.json'), {});
const relStrength = readJson(J('relative-strength.json'), {});

function nameOf(reg, sym) { const e = reg.find((x) => x.symbol === sym); return e ? { en: e.name_en || e.symbol, ar: e.name_ar || e.symbol } : { en: sym, ar: sym }; }
function confidenceFrom(confirmation, available) {
  if (available === false) return { band: 'indeterminate', en: 'indeterminate', ar: 'غير محدد' };
  if (confirmation === 'confirmed') return { band: 'high', en: 'high', ar: 'مرتفعة' };
  if (confirmation === 'partial' || confirmation === 'mixed') return { band: 'moderate', en: 'moderate', ar: 'متوسطة' };
  if (confirmation === 'unconfirmed' || confirmation === 'contradicted') return { band: 'low', en: 'low', ar: 'منخفضة' };
  return { band: 'indeterminate', en: 'indeterminate', ar: 'غير محدد' };
}

function buildGroup(group) {
  const g = GROUPS[group];
  const rankings = readJson(J(g.rankings), {});
  const map = readJson(V(g.map), {});
  const regimeBy = new Map((map.cells || []).map((c) => [c.symbol, c.regime_alignment]));
  const histBy = new Map(((historical.groups && historical.groups[g.hist]) || []).map((x) => [x.symbol, x]));
  const story = narrative && narrative.dominant_story ? narrative.dominant_story : null;
  // Relative-strength relations involving each symbol, for evidence.
  const relBy = new Map();
  for (const r of ((relStrength.groups && relStrength.groups[g.hist]) || [])) { for (const sym of [r.a, r.b]) { if (!relBy.has(sym)) relBy.set(sym, []); relBy.get(sym).push(`${r.label_en}: ${r.state_en || r.state}`); } }

  const entities = (rankings.items || []).map((x) => {
    const nm = nameOf(g.reg, x.symbol);
    const hist = histBy.get(x.symbol) || {};
    const regime = regimeBy.get(x.symbol) || 'indeterminate';
    const confidence = confidenceFrom(x.confirmation, x.available);
    const evidence = [
      ...(x.evidence || []).slice(0, 2),
      hist.momentum ? `historical momentum: ${hist.momentum.label_en || hist.momentum.state}` : null,
      `regime alignment: ${regime}`,
      ...((relBy.get(x.symbol) || []).slice(0, 1)),
    ].filter(Boolean);
    return {
      symbol: x.symbol, slug: x.slug, name_en: nm.en, name_ar: nm.ar, available: x.available !== false,
      current_state: { state: x.rank_label, label_en: x.rank_label_en, label_ar: x.rank_label_ar },
      ranking_state: { rank_label: x.rank_label, label_en: x.rank_label_en, label_ar: x.rank_label_ar, scalar: x.scalar ?? null, direction: x.direction, direction_en: x.direction_en, direction_ar: x.direction_ar, confirmation: x.confirmation, confirmation_en: x.confirmation_en, confirmation_ar: x.confirmation_ar },
      narrative_state: { story_en: story ? story.label_en : 'indeterminate', story_ar: story ? story.label_ar : 'غير محدد', alignment_en: x.direction_en || 'indeterminate', alignment_ar: x.direction_ar || 'غير محدد' },
      regime_alignment: regime,
      historical_direction: hist.momentum ? { state: hist.momentum.state, label_en: hist.momentum.label_en, label_ar: hist.momentum.label_ar } : { state: 'indeterminate', label_en: 'indeterminate', label_ar: 'غير محدد' },
      confidence,
      evidence,
      research_href: `/research/${g.research}/${x.slug}/`,
      entity_href: `/${g.base}/${x.slug}/`,
    };
  });
  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: `entity-research-${g.research}`,
    group, available: entities.some((e) => e.available), count: entities.length, entities,
    attribution: { sources: [`data/intelligence/${g.rankings}`, `data/visual/${g.map}`, 'data/intelligence/historical-intelligence.json', 'data/intelligence/market-narrative.json', 'data/intelligence/relative-strength.json'], note: 'Entity research composes existing intelligence per entity. Educational context, not signals, forecasts, price targets or recommendations.' },
  };
}

// ───────────────────────── CP2: entity research graph ─────────────────────────
function buildGraph() {
  const nodes = [];
  const nodeIds = new Set();
  const addNode = (sym, group, slug, base) => { if (nodeIds.has(sym)) return; nodeIds.add(sym); const nm = nameOf(GROUPS[group].reg, sym); nodes.push({ id: sym, group, label_en: nm.en, label_ar: nm.ar, href: `/research/${GROUPS[group].research}/${slug}/`, entity_href: `/${base}/${slug}/` }); };
  for (const a of assetReg.ASSETS) addNode(a.symbol, 'asset', a.slug, 'markets');
  for (const s of sectorReg.SECTORS) addNode(s.symbol, 'sector', s.slug, 'sectors');
  for (const e of equityReg.EQUITIES) addNode(e.symbol, 'equity', e.slug, 'equities');

  const edges = [];
  const seen = new Set();
  const add = (from, to, kind, relation_en, relation_ar, evidence) => {
    if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return;
    if (!evidence || !evidence.length) return;
    const key = [from, to].sort().join('|') + '|' + kind;
    if (seen.has(key)) return; seen.add(key);
    edges.push({ from, to, kind, relation_en, relation_ar, evidence });
  };
  // relative-strength state lookup for evidence enrichment.
  const rsState = new Map();
  for (const grp of Object.values(relStrength.groups || {})) for (const r of grp) { rsState.set([r.a, r.b].sort().join('|'), r.state_en || r.state); }
  const rsEv = (a, b) => { const st = rsState.get([a, b].sort().join('|')); return st ? [`relative strength: ${st}`] : []; };

  // Asset ↔ Asset (registry relationships + related list).
  for (const r of assetReg.RELATIONSHIPS) add(r.a, r.b, 'asset_asset', r.en, r.ar, [`relationship: ${r.mode}`, ...rsEv(r.a, r.b)]);
  for (const a of assetReg.ASSETS) for (const rel of (a.related || [])) add(a.symbol, rel, 'asset_asset', `${a.symbol} related to ${rel}`, `${a.symbol} مرتبط بـ ${rel}`, [`registry related: ${a.symbol}→${rel}`, ...rsEv(a.symbol, rel)]);
  // Asset ↔ Sector (sector.related_assets + SECTOR_RELATIONSHIPS).
  for (const s of sectorReg.SECTORS) for (const sym of (s.related_assets || [])) add(s.symbol, sym, 'sector_asset', `${s.name_en} vs ${sym}`, `${s.name_ar} مقابل ${sym}`, [`sector→asset: ${s.symbol}→${sym}`]);
  for (const r of (sectorReg.SECTOR_RELATIONSHIPS || [])) add(r.sector, r.asset, 'sector_asset', r.en, r.ar, [`relationship: ${r.kind || r.mode}`]);
  // Sector ↔ Sector (shared registry group = peer).
  for (let i = 0; i < sectorReg.SECTORS.length; i += 1) for (let j = i + 1; j < sectorReg.SECTORS.length; j += 1) { const a = sectorReg.SECTORS[i]; const b = sectorReg.SECTORS[j]; if (a.group && a.group === b.group) add(a.symbol, b.symbol, 'sector_sector', `${a.name_en} & ${b.name_en} (${a.group})`, `${a.name_ar} و ${b.name_ar} (${a.group})`, [`shared group: ${a.group}`]); }
  // Sector ↔ Equity (equity.sector slug) + Equity ↔ Asset (equity.related_asset).
  const sectorBySlug = new Map(sectorReg.SECTORS.map((s) => [s.slug, s]));
  for (const e of equityReg.EQUITIES) {
    const sec = sectorBySlug.get(e.sector);
    if (sec) add(e.symbol, sec.symbol, 'sector_equity', `${e.name_en} in ${sec.name_en}`, `${e.name_ar} ضمن ${sec.name_ar}`, [`equity→sector: ${e.symbol}→${sec.symbol}`]);
    if (e.related_asset) add(e.symbol, e.related_asset, 'asset_equity', `${e.name_en} vs ${e.related_asset}`, `${e.name_ar} مقابل ${e.related_asset}`, [`equity→asset: ${e.symbol}→${e.related_asset}`]);
  }
  // Equity ↔ Equity (registry relationships + related list).
  for (const r of (equityReg.EQUITY_RELATIONSHIPS || [])) add(r.equity, r.counterpart, 'equity_equity', r.en, r.ar, [`relationship: ${r.kind || r.type}`, ...rsEv(r.equity, r.counterpart)]);
  for (const e of equityReg.EQUITIES) for (const rel of (e.related_equities || [])) add(e.symbol, rel, 'equity_equity', `${e.symbol} peer ${rel}`, `${e.symbol} نظير ${rel}`, [`registry related: ${e.symbol}→${rel}`, ...rsEv(e.symbol, rel)]);

  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'entity-research-graph',
    available: edges.length > 0, node_count: nodes.length, edge_count: edges.length, nodes, edges,
    attribution: { sources: ['asset-registry', 'sector-registry', 'equity-registry', 'relative-strength.json'], note: 'Evidence-backed entity relationships only; every endpoint is a real entity and every edge cites a registry or relative-strength fact. No invented relationships, no recommendations.' },
  };
}

function build() {
  return { assets: buildGroup('asset'), sectors: buildGroup('sector'), equities: buildGroup('equity'), graph: buildGraph() };
}

if (require.main === module) {
  const r = build();
  console.log(`[entity-research] assets=${r.assets.count} sectors=${r.sectors.count} equities=${r.equities.count} graph_nodes=${r.graph.node_count} graph_edges=${r.graph.edge_count}`);
  if (WRITE) {
    fs.writeFileSync(J('entity-research-assets.json'), `${JSON.stringify(r.assets, null, 2)}\n`);
    fs.writeFileSync(J('entity-research-sectors.json'), `${JSON.stringify(r.sectors, null, 2)}\n`);
    fs.writeFileSync(J('entity-research-equities.json'), `${JSON.stringify(r.equities, null, 2)}\n`);
    fs.writeFileSync(J('entity-research-graph.json'), `${JSON.stringify(r.graph, null, 2)}\n`);
    console.log('[entity-research] wrote 4 artifacts');
  }
}

module.exports = { build, buildGroup, buildGraph, GROUPS };
