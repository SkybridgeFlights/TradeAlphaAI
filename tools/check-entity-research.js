'use strict';

// Phase 213 / CP11 — entity research validators (one impl):
//   --entity     → check:entity-research        (entity-research-{assets,sectors,equities})
//   --graph      → check:entity-research-graph   (entity-research-graph)
//   --change     → check:change-intelligence     (change-intelligence)
//   --changelog  → check:entity-changelog        (entity-changelog)
//   --pages      → check:entity-research-pages    (index + detail pages EN/AR)
//   --history    → check:research-history         (/research/history/ pages)
// HARD-FAILS on: fabricated relationships/entities, fabricated history, unsupported
// research, missing evidence, orphan pages, EN/AR parity break, signal/forecast
// language, invalid links, exposed internals. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }

const REG = {
  asset: new Set(require('./asset-registry').ASSETS.map((e) => e.symbol)),
  sector: new Set(require('./sector-registry').SECTORS.map((e) => e.symbol)),
  equity: new Set(require('./equity-registry').EQUITIES.map((e) => e.symbol)),
};
const ALL_SYMBOLS = new Set([...REG.asset, ...REG.sector, ...REG.equity]);
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bgo (long|short)\b/i, /\bwill (rise|fall|reach)\b/i, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];
const GROUP_DIR = { asset: 'assets', sector: 'sectors', equity: 'equities' };

function hrefResolves(href) {
  const clean = href.replace(/[#?].*$/, '').replace(/^\//, '');
  if (!clean) return true;
  if (fs.existsSync(path.join(ROOT, clean, 'index.html'))) return true;
  if (fs.existsSync(path.join(ROOT, clean))) return true;
  if (fs.existsSync(path.join(ROOT, `${clean.replace(/\/$/, '')}.html`))) return true;
  return false;
}

function validateEntity() {
  const f = [];
  for (const [g, dir] of Object.entries(GROUP_DIR)) {
    const a = readJson(J(`entity-research-${dir}.json`), null);
    if (!a) { f.push(`entity-research-${dir}.json missing/malformed`); continue; }
    if (a.source_layer !== `entity-research-${dir}`) f.push(`${dir}: bad source_layer`);
    if (!(a.entities || []).length) f.push(`${dir}: no entities`);
    if (a.count !== REG[g].size) f.push(`${dir}: ${a.count} entities != ${REG[g].size} registry`);
    for (const e of (a.entities || [])) {
      if (!REG[g].has(e.symbol)) f.push(`${dir}: fabricated entity ${e.symbol}`);
      for (const k of ['current_state', 'ranking_state', 'narrative_state', 'historical_direction', 'confidence']) if (!e[k]) f.push(`${dir}/${e.symbol}: missing ${k}`);
      if (!e.regime_alignment) f.push(`${dir}/${e.symbol}: missing regime_alignment`);
      if (!(e.evidence || []).length) f.push(`${dir}/${e.symbol}: missing evidence (unsupported)`);
      if (!hrefResolves(e.research_href)) f.push(`${dir}/${e.symbol}: invalid research_href`);
      if (!hrefResolves(e.entity_href)) f.push(`${dir}/${e.symbol}: invalid entity_href`);
    }
    for (const re of FORBIDDEN) if (re.test(JSON.stringify(a))) f.push(`${dir}: forbidden language ${re}`);
  }
  return f;
}

function validateGraph() {
  const f = [];
  const g = readJson(J('entity-research-graph.json'), null);
  if (!g) { f.push('entity-research-graph.json missing/malformed'); return f; }
  if (g.source_layer !== 'entity-research-graph') f.push('bad source_layer');
  const ids = new Set((g.nodes || []).map((n) => n.id));
  if (!(g.edges || []).length) f.push('no edges');
  for (const n of (g.nodes || [])) {
    if (!ALL_SYMBOLS.has(n.id)) f.push(`node ${n.id}: not a registry entity (fabricated)`);
    if (!n.label_en || !n.label_ar) f.push(`node ${n.id}: missing EN/AR label`);
    if (!hrefResolves(n.href)) f.push(`node ${n.id}: invalid link ${n.href}`);
  }
  for (const e of (g.edges || [])) {
    if (!ids.has(e.from) || !ids.has(e.to)) f.push(`edge ${e.from}->${e.to}: endpoint not a node (fabricated)`);
    if (e.from === e.to) f.push(`edge ${e.from}: self-loop`);
    if (!(e.evidence || []).length) f.push(`edge ${e.from}->${e.to}: missing evidence (fabricated link)`);
    if (!e.relation_en || !e.relation_ar) f.push(`edge ${e.from}->${e.to}: missing EN/AR relation`);
  }
  for (const re of FORBIDDEN) if (re.test(JSON.stringify(g))) f.push(`forbidden language ${re}`);
  return f;
}

function validateChange() {
  const f = [];
  const c = readJson(J('change-intelligence.json'), null);
  if (!c) { f.push('change-intelligence.json missing/malformed'); return f; }
  if (c.source_layer !== 'change-intelligence') f.push('bad source_layer');
  if (!c.buckets) f.push('missing buckets');
  for (const [k, arr] of Object.entries(c.buckets || {})) {
    if ((c.counts || {})[k] !== arr.length) f.push(`bucket ${k}: count mismatch`);
    for (const x of arr) {
      if (!ALL_SYMBOLS.has(x.symbol)) f.push(`bucket ${k}: fabricated entity ${x.symbol}`);
      if (!(x.evidence || []).length) f.push(`bucket ${k}/${x.symbol}: missing evidence`);
      if (!hrefResolves(x.research_href)) f.push(`bucket ${k}/${x.symbol}: invalid link`);
    }
  }
  for (const re of FORBIDDEN) if (re.test(JSON.stringify(c))) f.push(`forbidden language ${re}`);
  return f;
}

function validateChangelog() {
  const f = [];
  const c = readJson(J('entity-changelog.json'), null);
  if (!c) { f.push('entity-changelog.json missing/malformed'); return f; }
  if (c.source_layer !== 'entity-changelog') f.push('bad source_layer');
  const ents = c.entities || {};
  if (!Object.keys(ents).length) f.push('no changelog entities');
  for (const [sym, e] of Object.entries(ents)) {
    if (!ALL_SYMBOLS.has(sym)) f.push(`changelog: fabricated entity ${sym}`);
    if (!e.current) f.push(`changelog/${sym}: missing current`);
    if (!Array.isArray(e.history)) f.push(`changelog/${sym}: missing history array`);
    // Anti-fabrication: history_available true only when >1 snapshot entry.
    if (e.history_available === true && (e.history || []).length <= 1) f.push(`changelog/${sym}: history_available with <=1 entry (fabricated)`);
  }
  for (const re of FORBIDDEN) if (re.test(JSON.stringify(c))) f.push(`forbidden language ${re}`);
  return f;
}

function validatePage(dir, reqSection) {
  const f = [];
  const en = dir; const ar = `ar/${dir}`;
  if (!fs.existsSync(path.join(ROOT, en, 'index.html')) || !fs.existsSync(path.join(ROOT, ar, 'index.html'))) { f.push(`${dir}: missing EN or AR page (orphan)`); return f; }
  for (const [rel, lang] of [[en, 'en'], [ar, 'ar']]) {
    const html = fs.readFileSync(path.join(ROOT, rel, 'index.html'), 'utf8');
    const canon = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}${dir}/`;
    if (!new RegExp(`rel="canonical" href="${canon.replace(/[/.]/g, '\\$&')}"`).test(html)) f.push(`${rel}: bad canonical`);
    if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) f.push(`${rel}: missing hreflang`);
    if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) f.push(`${rel}: AR not RTL`);
    if (!new RegExp(`id="${reqSection}"`).test(html)) f.push(`${rel}: missing #${reqSection}`);
    const text = visibleText(html);
    for (const re of FORBIDDEN) if (re.test(text)) f.push(`${rel}: forbidden language ${re}`);
    for (const re of RAW_ARTIFACT) if (re.test(html)) f.push(`${rel}: raw-artifact/internal exposure ${re}`);
    if (/\b(undefined|NaN)\b/.test(text)) f.push(`${rel}: leaks undefined/NaN`);
  }
  return f;
}

function validatePages() {
  const f = [];
  for (const [g, dir] of Object.entries(GROUP_DIR)) {
    f.push(...validatePage(`research/${dir}`, 'entity-research-index'));
    const a = readJson(J(`entity-research-${dir}.json`), {});
    for (const e of (a.entities || [])) f.push(...validatePage(`research/${dir}/${e.slug}`, 'entity-research-summary'));
  }
  return f;
}

function validateHistory() { return validatePage('research/history', 'research-history'); }

const RUN = { entity: validateEntity, graph: validateGraph, change: validateChange, changelog: validateChangelog, pages: validatePages, history: validateHistory };
const NAME = { entity: 'entity-research', graph: 'entity-research-graph', change: 'change-intelligence', changelog: 'entity-changelog', pages: 'entity-research-pages', history: 'research-history' };

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('entity clean', validateEntity().length === 0);
  T('graph clean', validateGraph().length === 0);
  T('change clean', validateChange().length === 0);
  T('changelog clean', validateChangelog().length === 0);
  T('pages clean', validatePages().length === 0);
  T('history clean', validateHistory().length === 0);
  T('forbidden caught', FORBIDDEN.some((re) => re.test('buy now')));
  T('raw artifact caught', RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"')));
  T('fabricated symbol caught', !ALL_SYMBOLS.has('FAKE'));
  T('bad link caught', !hrefResolves('/research/assets/nope/'));
  console.log(`[entity-research] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const arg = (process.argv.find((x) => x.startsWith('--')) || '').replace('--', '');
  if (!RUN[arg]) { console.error('[entity-research] usage: --entity|--graph|--change|--changelog|--pages|--history'); process.exit(2); }
  const failures = RUN[arg]();
  if (failures.length) { failures.forEach((m) => console.error(`[${NAME[arg]}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${NAME[arg]}] check:${NAME[arg]} passed.`);
}

module.exports = { validateEntity, validateGraph, validateChange, validateChangelog, validatePages, validateHistory };
