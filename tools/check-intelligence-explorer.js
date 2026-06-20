'use strict';

// Phase 217 validators. One implementation backs:
// check:explorer, check:event-explorer, check:entity-explorer,
// check:network-explorer, check:research-explorer, check:explorer-search,
// check:event-graph, check:intelligence-paths.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');
const { ETFS } = require('./etf-registry');

const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bgo (long|short)\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|crash)\b/i,
  /(?:\bشراء\b|\bبيع\b|إشارة\s*تداول|هدف\s*سعري|وقف\s*الخسارة)/,
];
const RAW = [/href="[^"]*\.json/i, /href="\/data\//i, /system-status/i, /workflow/i, /validator/i];
const ENTITY_TYPES = new Set(['asset', 'sector', 'equity', 'etf']);
const CHANGE_TYPES = new Set(['improving', 'weakening', 'stable', 'deteriorating', 'leadership_gain', 'leadership_loss', 'confirmation_gain', 'confirmation_loss', 'regime_shift', 'narrative_shift']);
const REGISTRY = {
  asset: new Set(ASSETS.map((x) => x.symbol)),
  sector: new Set(SECTORS.map((x) => x.symbol)),
  equity: new Set(EQUITIES.map((x) => x.symbol)),
  etf: new Set(ETFS.map((x) => x.symbol)),
};

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function html(rel) { const p = path.join(ROOT, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function text(html) { return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function pluralType(type) { return type === 'equity' ? 'equities' : `${type}s`; }

function checkExplorerArtifact() {
  const f = [];
  const ex = readJson(J('explorer-index.json'));
  if (!ex) return ['explorer-index.json missing/malformed'];
  if (ex.source_layer !== 'intelligence-explorer') f.push('bad source_layer');
  if (!Array.isArray(ex.entities) || ex.entities.length < 20) f.push('entities unexpectedly small');
  if (!Array.isArray(ex.events)) f.push('events missing');
  if (!Array.isArray(ex.research)) f.push('research missing');
  for (const e of ex.entities || []) {
    if (!ENTITY_TYPES.has(e.type)) f.push(`${e.id}: unsupported entity type`);
    if (!REGISTRY[e.type].has(e.symbol)) f.push(`${e.id}: fabricated entity ${e.symbol}`);
    if (!e.explorer_href || !e.research_href) f.push(`${e.id}: missing hrefs`);
    if (!Array.isArray(e.evidence_refs)) f.push(`${e.id}: evidence_refs missing`);
  }
  for (const ev of ex.events || []) {
    if (!ev.id || ev.type !== 'event') f.push('event missing id/type');
    if (ev.change_type && !CHANGE_TYPES.has(ev.change_type)) f.push(`${ev.id}: unsupported change_type`);
    if (!Array.isArray(ev.evidence_refs) || !ev.evidence_refs.length) f.push(`${ev.id}: missing evidence`);
  }
  const s = JSON.stringify(ex);
  if (/\bundefined\b|\bNaN\b/.test(s)) f.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(s)) f.push(`forbidden language ${re}`);
  return f;
}

function checkEventGraph() {
  const f = [];
  const g = readJson(J('event-graph.json'));
  const ex = readJson(J('explorer-index.json'), { entities: [], events: [], research: [] });
  if (!g) return ['event-graph.json missing/malformed'];
  if (g.source_layer !== 'event-graph') f.push('bad source_layer');
  const nodeIds = new Set((g.nodes || []).map((n) => n.id));
  if (!nodeIds.size) f.push('graph has no nodes');
  if (!Array.isArray(g.edges)) f.push('graph edges missing');
  for (const edge of g.edges || []) {
    if (!nodeIds.has(edge.from)) f.push(`edge from missing node ${edge.from}`);
    if (!nodeIds.has(edge.to)) f.push(`edge to missing node ${edge.to}`);
    if (!Array.isArray(edge.evidence_refs) || !edge.evidence_refs.length) f.push(`edge ${edge.from}->${edge.to}: missing evidence`);
    if (!['observed_on_entity', 'documented_by', 'regime_context'].includes(edge.relation)) f.push(`unsupported edge relation ${edge.relation}`);
    if (edge.relation === 'observed_on_entity' && !ex.entities.some((e) => e.id === edge.to)) f.push(`entity edge unsupported by explorer index: ${edge.to}`);
  }
  for (const n of g.nodes || []) {
    if (!['event', 'entity', 'research', 'regime'].includes(n.type)) f.push(`unsupported node type ${n.type}`);
    if (!n.href || /^\/data\//.test(n.href) || /\.json$/.test(n.href)) f.push(`${n.id}: bad href`);
  }
  return f;
}

function checkPaths() {
  const f = [];
  const p = readJson(J('intelligence-paths.json'));
  const ex = readJson(J('explorer-index.json'), { entities: [] });
  if (!p) return ['intelligence-paths.json missing/malformed'];
  if (p.source_layer !== 'intelligence-paths') f.push('bad source_layer');
  if (!Array.isArray(p.paths) || p.paths.length !== ex.entities.length) f.push('path count does not match explorer entities');
  const entityIds = new Set(ex.entities.map((e) => e.id));
  for (const pathItem of p.paths || []) {
    if (!entityIds.has(pathItem.entity_id)) f.push(`${pathItem.id}: unsupported entity_id`);
    if (!Array.isArray(pathItem.steps) || pathItem.steps.length < 3) f.push(`${pathItem.id}: insufficient steps`);
    for (const step of pathItem.steps || []) {
      if (!step.href || /^\/data\//.test(step.href) || /\.json$/.test(step.href)) f.push(`${pathItem.id}: bad step href`);
      if (!Array.isArray(step.evidence_refs) || !step.evidence_refs.length) f.push(`${pathItem.id}: step missing evidence`);
    }
  }
  return f;
}

function checkSearch() {
  const f = [];
  const s = readJson(J('explorer-search-index.json'));
  if (!s) return ['explorer-search-index.json missing/malformed'];
  if (s.source_layer !== 'explorer-search-index') f.push('bad source_layer');
  if (!Array.isArray(s.entries) || s.entries.length < 50) f.push('search entries unexpectedly small');
  const ids = new Set();
  for (const e of s.entries || []) {
    if (!e.id || ids.has(e.id)) f.push(`missing/duplicate search id ${e.id}`);
    ids.add(e.id);
    if (!e.href || /^\/data\//.test(e.href) || /\.json$/.test(e.href)) f.push(`${e.id}: bad href`);
    if (!Array.isArray(e.evidence_refs) || !e.evidence_refs.length) f.push(`${e.id}: missing evidence`);
  }
  const txt = JSON.stringify(s);
  if (/\bundefined\b|\bNaN\b/.test(txt)) f.push('search leaks undefined/NaN');
  return f;
}

function checkPagePair(surface) {
  const f = [];
  const rel = surface ? `explorer/${surface}/index.html` : 'explorer/index.html';
  const arRel = surface ? `ar/explorer/${surface}/index.html` : 'ar/explorer/index.html';
  for (const [file, loc] of [[rel, 'EN'], [arRel, 'AR']]) {
    const h = html(file);
    if (!h) { f.push(`${loc}: missing ${file}`); continue; }
    if (!/rel="canonical"/.test(h)) f.push(`${loc}: missing canonical`);
    if (!/hreflang="en"/.test(h) || !/hreflang="ar"/.test(h)) f.push(`${loc}: missing hreflang`);
    if (loc === 'AR' && !/<html[^>]*dir="rtl"/.test(h)) f.push('AR: missing RTL');
    if (!/id="explorer-disclaimer"/.test(h)) f.push(`${loc}: missing disclaimer`);
    const visible = text(h);
    if (/\bundefined\b|\bNaN\b/.test(visible)) f.push(`${loc}: leaks undefined/NaN`);
    for (const re of FORBIDDEN) if (re.test(visible)) f.push(`${loc}: forbidden language ${re}`);
    for (const re of RAW) if (re.test(h)) f.push(`${loc}: internal/raw exposure ${re}`);
  }
  return f;
}

function checkEntityPages() {
  const f = checkPagePair('entity');
  const ex = readJson(J('explorer-index.json'), { entities: [] });
  for (const e of ex.entities || []) {
    const rel = `explorer/entity/${pluralType(e.type)}/${e.slug}/index.html`;
    const arRel = `ar/explorer/entity/${pluralType(e.type)}/${e.slug}/index.html`;
    for (const [file, loc] of [[rel, 'EN'], [arRel, 'AR']]) {
      const h = html(file);
      if (!h) { f.push(`${loc}: missing entity page ${file}`); continue; }
      if (!h.includes('id="explorer-entity-summary"')) f.push(`${file}: missing summary`);
      if (!h.includes('id="explorer-entity-path"')) f.push(`${file}: missing path`);
      if (loc === 'AR' && !/<html[^>]*dir="rtl"/.test(h)) f.push(`${file}: missing RTL`);
      for (const re of RAW) if (re.test(h)) f.push(`${file}: internal/raw exposure`);
    }
  }
  return f;
}

function checkDiscovery() {
  const f = [];
  const surfaces = ['', 'events', 'entity', 'network', 'research', 'search'];
  for (const s of surfaces) f.push(...checkPagePair(s));
  const sitemap = html('sitemap-core.xml') || '';
  const sitemapAr = html('sitemap-ar.xml') || '';
  for (const s of surfaces) {
    const pathPart = s ? `/explorer/${s}/` : '/explorer/';
    if (!sitemap.includes(pathPart)) f.push(`sitemap-core missing ${pathPart}`);
    if (!sitemapAr.includes(`/ar${pathPart}`)) f.push(`sitemap-ar missing /ar${pathPart}`);
  }
  for (const file of ['index.html', 'market-terminal/index.html', 'explorer/index.html']) {
    const h = html(file);
    if (h && !h.includes('href="/explorer/"')) f.push(`${file}: missing Explorer nav link`);
  }
  for (const file of ['ar/index.html', 'ar/market-terminal/index.html', 'ar/explorer/index.html']) {
    const h = html(file);
    if (h && !h.includes('href="/ar/explorer/"')) f.push(`${file}: missing AR Explorer nav link`);
  }
  return f;
}

function checkSurface(name) {
  if (name === 'explorer') return [...checkExplorerArtifact(), ...checkDiscovery()];
  if (name === 'event-explorer') return [...checkPagePair('events'), ...checkEventGraph()];
  if (name === 'entity-explorer') return checkEntityPages();
  if (name === 'network-explorer') return [...checkPagePair('network'), ...checkEventGraph()];
  if (name === 'research-explorer') return checkPagePair('research');
  if (name === 'explorer-search') return [...checkPagePair('search'), ...checkSearch()];
  if (name === 'event-graph') return checkEventGraph();
  if (name === 'intelligence-paths') return checkPaths();
  return [`unknown check ${name}`];
}

function main() {
  const arg = process.argv.find((a) => a.startsWith('--check='));
  const name = arg ? arg.slice('--check='.length) : 'explorer';
  const fails = checkSurface(name);
  if (fails.length) {
    fails.forEach((m) => console.error(`[${name}] FAIL: ${m}`));
    process.exit(1);
  }
  console.log(`[${name}] OK`);
}

function selfTest() {
  let ok = 0; let total = 0;
  const T = (name, cond) => { total += 1; if (cond) ok += 1; else console.error(`SELF-TEST FAIL: ${name}`); };
  T('forbidden catches buy', FORBIDDEN.some((re) => re.test('buy signal')));
  T('raw catches data json', RAW.some((re) => re.test('href="/data/intelligence/x.json"')));
  T('explorer clean', checkExplorerArtifact().length === 0);
  T('event graph clean', checkEventGraph().length === 0);
  T('paths clean', checkPaths().length === 0);
  T('search clean', checkSearch().length === 0);
  T('discovery clean', checkDiscovery().length === 0);
  console.log(`[intelligence-explorer] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

module.exports = { checkExplorerArtifact, checkEventGraph, checkPaths, checkSearch, checkPagePair, checkEntityPages, checkDiscovery };
