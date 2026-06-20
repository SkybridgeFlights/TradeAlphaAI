'use strict';

// Phase 217 - Intelligence Explorer core.
// Composes existing evidence-backed intelligence into explorer/search/path/graph
// artifacts. This does not create new intelligence, scores or relationships.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');
const { ETFS } = require('./etf-registry');

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

function now() { return new Date().toISOString(); }

function cleanText(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
function slugify(v) { return cleanText(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function latestEventsFor(symbol, events, limit = 6) {
  return (events.events || [])
    .filter((e) => e.entity === symbol || slugify(e.entity) === slugify(symbol))
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      label_en: e.label_en || e.change_type,
      label_ar: e.label_ar || e.change_type,
      change_type: e.change_type,
      confidence: e.confidence || 'low',
      href: e.href || e.research_href || '/changes/',
      evidence_refs: (e.evidence || []).slice(0, 3),
    }));
}

function findResearch(symbol, entityType, entityResearch, etfIntel) {
  const groupKey = entityType === 'asset' ? 'assets'
    : entityType === 'sector' ? 'sectors'
    : entityType === 'equity' ? 'equities'
    : null;
  if (groupKey && entityResearch[groupKey]) {
    const found = (entityResearch[groupKey].entities || []).find((e) => e.symbol === symbol);
    if (found) return {
      research_href: found.research_href,
      entity_href: found.entity_href,
      current_state: found.current_state,
      ranking_state: found.ranking_state,
      narrative_state: found.narrative_state,
      regime_alignment: found.regime_alignment,
      historical_direction: found.historical_direction,
      confidence: found.confidence,
      evidence_refs: found.evidence || [],
    };
  }
  if (entityType === 'etf') {
    const e = ((etfIntel && etfIntel.etfs) || []).find((x) => x.symbol === symbol);
    if (e) return {
      research_href: `/research/etfs/${e.slug || slugify(symbol)}/`,
      entity_href: `/etfs/${e.slug || slugify(symbol)}/`,
      current_state: e.structure && e.structure.state,
      ranking_state: e.ranking_state || 'covered',
      narrative_state: e.narrative_alignment || 'covered',
      regime_alignment: e.regime_alignment || 'indeterminate',
      historical_direction: e.historical_direction || 'indeterminate',
      confidence: e.confidence || 'moderate',
      evidence_refs: (e.evidence || []).slice(0, 4),
    };
  }
  return {};
}

function rankFor(symbol, entityType, rankings, etfRankings) {
  const key = entityType === 'asset' ? 'asset_rankings'
    : entityType === 'sector' ? 'sector_rankings'
    : entityType === 'equity' ? 'equity_rankings'
    : null;
  const rows = key && rankings[key] ? rankings[key] : [];
  let row = rows.find((r) => r.symbol === symbol);
  if (!row && entityType === 'etf') row = ((etfRankings && etfRankings.rankings) || []).find((r) => r.symbol === symbol);
  if (!row) return { rank: null, rank_label: 'indeterminate', confirmation_state: 'indeterminate' };
  return {
    rank: row.rank || row.position || null,
    rank_label: row.rank_label || row.label || 'ranked',
    confirmation_state: row.confirmation_state || row.confirmation || 'indeterminate',
    evidence_refs: (row.evidence || []).slice(0, 3),
  };
}

function buildEntities(state) {
  const entityResearch = {
    assets: readJson(OUT('entity-research-assets.json'), { entities: [] }),
    sectors: readJson(OUT('entity-research-sectors.json'), { entities: [] }),
    equities: readJson(OUT('entity-research-equities.json'), { entities: [] }),
  };
  const etfIntel = readJson(OUT('etf-intelligence.json'), { etfs: [] });
  const rankings = readJson(OUT('rankings.json'), {});
  const etfRankings = readJson(OUT('etf-rankings.json'), {});
  const events = state.changeEvents;

  const groups = [
    ['asset', ASSETS, (e) => ({ name_en: e.symbol, name_ar: e.symbol, href: `/markets/${e.slug}/`, explorer_href: `/explorer/entity/assets/${e.slug}/` })],
    ['sector', SECTORS, (e) => ({ name_en: e.name_en || e.symbol, name_ar: e.name_ar || e.symbol, href: `/sectors/${e.slug}/`, explorer_href: `/explorer/entity/sectors/${e.slug}/` })],
    ['equity', EQUITIES, (e) => ({ name_en: e.name_en || e.symbol, name_ar: e.name_ar || e.symbol, href: `/equities/${e.slug}/`, explorer_href: `/explorer/entity/equities/${e.slug}/` })],
    ['etf', ETFS, (e) => ({ name_en: e.fund_name || e.symbol, name_ar: e.fund_name || e.symbol, href: `/research/etfs/${e.slug}/`, explorer_href: `/explorer/entity/etfs/${e.slug}/` })],
  ];

  const out = [];
  for (const [type, list, links] of groups) {
    for (const item of list) {
      const link = links(item);
      const research = findResearch(item.symbol, type, entityResearch, etfIntel);
      const rank = rankFor(item.symbol, type, rankings, etfRankings);
      const evs = latestEventsFor(item.symbol, events);
      out.push({
        id: `${type}:${item.symbol}`,
        type,
        symbol: item.symbol,
        slug: item.slug,
        name_en: link.name_en,
        name_ar: link.name_ar,
        href: link.href,
        explorer_href: link.explorer_href,
        research_href: research.research_href || link.href,
        ranking: rank,
        current_state: research.current_state || 'indeterminate',
        narrative_state: research.narrative_state || 'indeterminate',
        regime_alignment: research.regime_alignment || 'indeterminate',
        historical_direction: research.historical_direction || 'indeterminate',
        confidence: research.confidence || rank.confirmation_state || 'indeterminate',
        related_symbols: Array.isArray(item.related) ? item.related : Array.isArray(item.related_equities) ? item.related_equities : [],
        events: evs,
        evidence_refs: [...(research.evidence_refs || []), ...(rank.evidence_refs || []), ...evs.flatMap((e) => e.evidence_refs || [])].slice(0, 8),
      });
    }
  }
  return out;
}

function researchItems(state) {
  const hub = state.researchHub || {};
  const nodes = (state.researchGraph.nodes || []).map((n) => ({
    id: `research:${n.id}`,
    type: 'research',
    label_en: n.label_en || n.id,
    label_ar: n.label_ar || n.label_en || n.id,
    href: n.href,
    evidence_refs: ['data/intelligence/research-graph.json'],
  }));
  const hubItems = []
    .concat(hub.featured || [])
    .concat(hub.latest || [])
    .filter((x) => x && x.href)
    .map((x, i) => ({
      id: `research:hub:${hash([x.href, i])}`,
      type: 'research',
      label_en: x.title_en || x.title || x.href,
      label_ar: x.title_ar || x.title_en || x.href,
      href: x.href,
      evidence_refs: ['data/intelligence/research-hub.json'],
    }));
  const seen = new Set();
  return [...nodes, ...hubItems].filter((item) => {
    const key = item.href || item.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function eventItems(events) {
  return (events.events || []).map((e) => ({
    id: `event:${e.id}`,
    type: 'event',
    entity: e.entity,
    entity_type: e.entity_type,
    label_en: e.label_en || e.change_type,
    label_ar: e.label_ar || e.change_type,
    href: e.href || e.research_href || '/changes/',
    confidence: e.confidence || 'low',
    change_type: e.change_type,
    evidence_refs: (e.evidence || []).slice(0, 4),
  }));
}

function buildEventGraph(state, entities, research) {
  const nodes = [];
  const edges = [];
  const entityBySymbol = new Map(entities.map((e) => [e.symbol, e]));
  const researchByHref = new Map(research.filter((r) => r.href).map((r) => [r.href, r]));

  for (const ev of state.changeEvents.events || []) {
    const eventNode = {
      id: `event:${ev.id}`,
      type: 'event',
      label_en: ev.label_en || ev.change_type,
      label_ar: ev.label_ar || ev.change_type,
      href: ev.href || ev.research_href || '/changes/',
      evidence_refs: (ev.evidence || []).slice(0, 4),
    };
    nodes.push(eventNode);
    const entity = entityBySymbol.get(ev.entity);
    if (entity) {
      nodes.push({ id: entity.id, type: 'entity', label_en: entity.symbol, label_ar: entity.symbol, href: entity.explorer_href, evidence_refs: ['data/intelligence/change-events.json'] });
      edges.push({ from: eventNode.id, to: entity.id, relation: 'observed_on_entity', evidence_refs: (ev.evidence || []).slice(0, 3) });
    }
    for (const href of [ev.href, ev.research_href].filter(Boolean)) {
      const exact = researchByHref.get(href);
      const rid = exact ? exact.id : `research:${hash(href)}`;
      nodes.push({ id: rid, type: 'research', label_en: exact ? exact.label_en : href, label_ar: exact ? exact.label_ar : href, href, evidence_refs: ['data/intelligence/change-events.json'] });
      edges.push({ from: eventNode.id, to: rid, relation: 'documented_by', evidence_refs: (ev.evidence || []).slice(0, 3) });
    }
    if (ev.entity_type === 'regime' || ev.change_type === 'regime_shift') {
      nodes.push({ id: 'regime:current', type: 'regime', label_en: 'Market Regime', label_ar: 'نظام السوق', href: '/market-regime/', evidence_refs: ['data/intelligence/regime-history.json'] });
      edges.push({ from: eventNode.id, to: 'regime:current', relation: 'regime_context', evidence_refs: (ev.evidence || []).slice(0, 3) });
    }
  }
  return dedupeGraph({ nodes, edges });
}

function dedupeGraph(graph) {
  const nodes = new Map();
  for (const n of graph.nodes || []) if (n && n.id) nodes.set(n.id, n);
  const edgeKeys = new Set();
  const edges = [];
  for (const e of graph.edges || []) {
    if (!e || !e.from || !e.to || !e.relation || !Array.isArray(e.evidence_refs) || !e.evidence_refs.length) continue;
    const key = `${e.from}|${e.to}|${e.relation}`;
    if (!edgeKeys.has(key)) { edgeKeys.add(key); edges.push(e); }
  }
  return { nodes: [...nodes.values()], edges };
}

function buildPaths(entities, eventGraph) {
  const edgesByFrom = new Map();
  for (const e of eventGraph.edges || []) {
    if (!edgesByFrom.has(e.from)) edgesByFrom.set(e.from, []);
    edgesByFrom.get(e.from).push(e);
  }
  return entities.map((entity) => {
    const relatedEvents = (entity.events || []).map((ev) => `event:${ev.id}`).filter((id) => eventGraph.nodes.some((n) => n.id === id));
    return {
      id: `path:${entity.type}:${entity.symbol}`,
      entity_id: entity.id,
      symbol: entity.symbol,
      type: entity.type,
      title_en: `${entity.symbol} intelligence path`,
      title_ar: `مسار استخبارات ${entity.symbol}`,
      steps: [
        { kind: 'entity', href: entity.explorer_href, label_en: `${entity.symbol} explorer`, label_ar: `مستكشف ${entity.symbol}`, evidence_refs: ['explorer-index'] },
        { kind: 'research', href: entity.research_href, label_en: 'Entity research', label_ar: 'أبحاث الكيان', evidence_refs: ['entity-research'] },
        { kind: 'regime', href: '/market-regime/', label_en: 'Current regime', label_ar: 'النظام الحالي', evidence_refs: ['market-regime-dashboard'] },
        { kind: 'events', href: '/explorer/events/', label_en: `${relatedEvents.length} related events`, label_ar: `${relatedEvents.length} أحداث مرتبطة`, evidence_refs: relatedEvents.length ? relatedEvents : ['change-events'] },
      ],
      related_symbols: entity.related_symbols,
      evidence_refs: entity.evidence_refs.slice(0, 6),
    };
  });
}

function build() {
  const state = {
    changeEvents: readJson(OUT('change-events.json'), { events: [] }),
    researchGraph: readJson(OUT('research-graph.json'), { nodes: [], edges: [] }),
    entityGraph: readJson(OUT('entity-research-graph.json'), { nodes: [], edges: [] }),
    researchHub: readJson(OUT('research-hub.json'), {}),
    marketRegime: readJson(OUT('market-regime-dashboard.json'), {}),
  };
  const generated_at = now();
  const entities = buildEntities(state);
  const research = researchItems(state);
  const events = eventItems(state.changeEvents);
  const explorer = {
    schema_version: '1.0',
    generated_at,
    source_layer: 'intelligence-explorer',
    sources: [
      'entity-research-assets.json', 'entity-research-sectors.json', 'entity-research-equities.json',
      'etf-intelligence.json', 'change-events.json', 'research-graph.json', 'entity-research-graph.json',
      'rankings.json', 'etf-rankings.json', 'market-regime-dashboard.json',
    ],
    counts: { entities: entities.length, events: events.length, research: research.length },
    entities,
    events,
    research,
    regime: {
      href: '/market-regime/',
      current_regime: state.marketRegime.current_regime || {},
      risk_state: state.marketRegime.risk_state || 'indeterminate',
      evidence_refs: ['data/intelligence/market-regime-dashboard.json'],
    },
  };
  const search = {
    schema_version: '1.0',
    generated_at,
    source_layer: 'explorer-search-index',
    total: entities.length + events.length + research.length,
    entries: [
      ...entities.map((e) => ({ id: e.id, type: e.type, title_en: `${e.symbol} ${e.name_en}`, title_ar: `${e.symbol} ${e.name_ar}`, href: e.explorer_href, keywords: [e.symbol, e.slug, e.type, e.current_state, e.narrative_state].filter(Boolean), evidence_refs: ['explorer-index'] })),
      ...events.map((e) => ({ id: e.id, type: 'event', title_en: `${e.entity} ${e.label_en}`, title_ar: `${e.entity} ${e.label_ar}`, href: '/explorer/events/', keywords: [e.entity, e.entity_type, e.change_type, e.confidence].filter(Boolean), evidence_refs: e.evidence_refs })),
      ...research.map((r) => ({ id: r.id, type: 'research', title_en: r.label_en, title_ar: r.label_ar, href: r.href, keywords: [r.label_en, r.label_ar].filter(Boolean), evidence_refs: r.evidence_refs })),
    ],
  };
  const eventGraph = {
    schema_version: '1.0',
    generated_at,
    source_layer: 'event-graph',
    ...buildEventGraph(state, entities, research),
  };
  const paths = {
    schema_version: '1.0',
    generated_at,
    source_layer: 'intelligence-paths',
    paths: buildPaths(entities, eventGraph),
  };
  explorer.source_hash = hash({ entities, events, research });
  search.source_hash = hash(search.entries);
  eventGraph.source_hash = hash({ nodes: eventGraph.nodes, edges: eventGraph.edges });
  paths.source_hash = hash(paths.paths);
  return { explorer, search, eventGraph, paths };
}

function main() {
  const out = build();
  if (WRITE) {
    fs.writeFileSync(OUT('explorer-index.json'), `${JSON.stringify(out.explorer, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT('explorer-search-index.json'), `${JSON.stringify(out.search, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT('event-graph.json'), `${JSON.stringify(out.eventGraph, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT('intelligence-paths.json'), `${JSON.stringify(out.paths, null, 2)}\n`, 'utf8');
  }
  console.log(`[intelligence-explorer] entities=${out.explorer.counts.entities} events=${out.explorer.counts.events} research=${out.explorer.counts.research} edges=${out.eventGraph.edges.length}`);
}

if (require.main === module) main();

module.exports = { build };
