'use strict';

// Phase 212 / CP10 — research network validators (one impl):
//   --hub        → check:research-hub       (research-hub.json + /research/ pages)
//   --feed       → check:research-feed      (/research/feed/ pages)
//   --authority  → check:research-authority (research-authority.json)
//   --graph      → check:research-graph     (research-graph.json)
//   --discovery  → check:research-discovery (nav reachability + no orphans/internal)
// HARD-FAILS on: fabricated research, unsupported conclusions, missing evidence,
// signal/recommendation language, broken EN/AR parity, invalid links, orphan
// research pages, exposed internals. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }

const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bgo (long|short)\b/i, /\bwill (rise|fall|reach)\b/i, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];
const PAGES = { hub: ['research', 'ar/research'], feed: ['research/feed', 'ar/research/feed'], regime: ['research/regime', 'ar/research/regime'] };
const REQ_SECTION = { hub: 'research-categories', feed: 'research-feed', regime: 'regime-research' };

// Resolve an internal href to an on-disk page (dir/index.html or .html). '#'-anchors stripped.
function hrefResolves(href) {
  const clean = href.replace(/[#?].*$/, '').replace(/^\//, '');
  if (!clean) return true;
  if (fs.existsSync(path.join(ROOT, clean, 'index.html'))) return true;
  if (fs.existsSync(path.join(ROOT, clean))) return true;
  if (fs.existsSync(path.join(ROOT, `${clean.replace(/\/$/, '')}.html`))) return true;
  return false;
}

function validateHub() {
  const f = [];
  const hub = readJson(J('research-hub.json'), null);
  if (!hub) { f.push('research-hub.json missing/malformed'); return f; }
  if (hub.source_layer !== 'research-hub') f.push('bad source_layer');
  const cats = hub.categories || [];
  if (!cats.length) f.push('no research categories');
  for (const c of cats) {
    if (!c.title_en || !c.title_ar) f.push(`category ${c.id}: missing EN/AR title`);
    if (!(c.items || []).length) f.push(`category ${c.id}: no items`);
    if (!(c.evidence || []).length) f.push(`category ${c.id}: missing evidence (unsupported)`);
    for (const it of (c.items || [])) if (!hrefResolves(it.href)) f.push(`category ${c.id}: invalid link ${it.href}`);
  }
  const txt = JSON.stringify(hub);
  for (const re of FORBIDDEN) if (re.test(txt)) f.push(`forbidden language ${re}`);
  f.push(...validatePages('hub'));
  return f;
}

function validateGraph() {
  const f = [];
  const g = readJson(J('research-graph.json'), null);
  if (!g) { f.push('research-graph.json missing/malformed'); return f; }
  if (g.source_layer !== 'research-graph') f.push('bad source_layer');
  const ids = new Set((g.nodes || []).map((n) => n.id));
  if (ids.size < 2) f.push('insufficient nodes');
  if (!(g.edges || []).length) f.push('no edges (graph empty)');
  for (const n of (g.nodes || [])) { if (!n.label_en || !n.label_ar) f.push(`node ${n.id}: missing EN/AR label`); if (!hrefResolves(n.href)) f.push(`node ${n.id}: invalid link ${n.href}`); }
  for (const e of (g.edges || [])) {
    if (!ids.has(e.from) || !ids.has(e.to)) f.push(`edge ${e.from}->${e.to}: endpoint not a node (fabricated)`);
    if (!(e.evidence || []).length) f.push(`edge ${e.from}->${e.to}: missing evidence (fabricated link)`);
    if (!e.relation_en || !e.relation_ar) f.push(`edge ${e.from}->${e.to}: missing EN/AR relation`);
  }
  for (const re of FORBIDDEN) if (re.test(JSON.stringify(g))) f.push(`forbidden language ${re}`);
  return f;
}

function validateAuthority() {
  const f = [];
  const a = readJson(J('research-authority.json'), null);
  if (!a) { f.push('research-authority.json missing/malformed'); return f; }
  if (a.source_layer !== 'research-authority') f.push('bad source_layer');
  if (!(a.objects || []).length) f.push('no authority objects');
  for (const o of (a.objects || [])) {
    if (!o.ref) f.push('authority object missing ref');
    if (!o.confidence_band) f.push(`authority ${o.ref}: missing confidence_band`);
    if (!(o.evidence || []).length) f.push(`authority ${o.ref}: missing evidence (unsupported conclusion)`);
    if (!o.why_en || !o.why_ar) f.push(`authority ${o.ref}: missing EN/AR rationale`);
  }
  for (const re of FORBIDDEN) if (re.test(JSON.stringify(a))) f.push(`forbidden language ${re}`);
  return f;
}

function validatePages(kind) {
  const f = [];
  const [en, ar] = PAGES[kind];
  const enAbs = path.join(ROOT, en, 'index.html'); const arAbs = path.join(ROOT, ar, 'index.html');
  if (!fs.existsSync(enAbs) || !fs.existsSync(arAbs)) { f.push(`${kind}: missing EN or AR page`); return f; }
  const slugPath = en === 'research' ? 'research/' : `${en}/`;
  for (const [rel, lang] of [[en, 'en'], [ar, 'ar']]) {
    const html = fs.readFileSync(path.join(ROOT, rel, 'index.html'), 'utf8');
    const canon = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}${slugPath}`;
    if (!new RegExp(`rel="canonical" href="${canon.replace(/[/.]/g, '\\$&')}"`).test(html)) f.push(`${rel}: bad canonical`);
    if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) f.push(`${rel}: missing hreflang`);
    if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) f.push(`${rel}: AR not RTL`);
    if (!new RegExp(`id="${REQ_SECTION[kind]}"`).test(html)) f.push(`${rel}: missing #${REQ_SECTION[kind]} section`);
    if (!/id="research-disclaimer"/.test(html)) f.push(`${rel}: missing disclaimer`);
    const text = visibleText(html);
    for (const re of FORBIDDEN) if (re.test(text)) f.push(`${rel}: forbidden language ${re}`);
    for (const re of RAW_ARTIFACT) if (re.test(html)) f.push(`${rel}: raw-artifact/internal exposure ${re}`);
    if (/\b(undefined|NaN)\b/.test(text)) f.push(`${rel}: leaks undefined/NaN`);
  }
  return f;
}

function validateDiscovery() {
  const f = [];
  // Research surfaces must exist EN/AR (no orphan/missing) ...
  for (const kind of Object.keys(PAGES)) for (const rel of PAGES[kind]) if (!fs.existsSync(path.join(ROOT, rel, 'index.html'))) f.push(`missing research surface ${rel}`);
  // ... and be reachable from the canonical header, with no internal routes.
  let header;
  try { header = require('./render-global-header').renderGlobalHeader; } catch { f.push('cannot load header renderer'); return f; }
  for (const locale of ['en', 'ar']) {
    const html = header({ locale });
    const pfx = locale === 'ar' ? '/ar' : '';
    for (const want of ['/research/', '/research/feed/', '/research/regime/']) {
      if (!html.includes(`href="${pfx}${want}"`)) f.push(`${locale} nav missing ${want}`);
    }
    for (const h of [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])) {
      for (const re of RAW_ARTIFACT) if (re.test(h)) f.push(`internal route exposed in header: ${h}`);
    }
  }
  return f;
}

const RUN = { hub: validateHub, feed: () => validatePages('feed'), authority: validateAuthority, graph: validateGraph, discovery: validateDiscovery };
const NAME = { hub: 'research-hub', feed: 'research-feed', authority: 'research-authority', graph: 'research-graph', discovery: 'research-discovery' };

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('hub clean', validateHub().length === 0);
  T('graph clean', validateGraph().length === 0);
  T('authority clean', validateAuthority().length === 0);
  T('feed clean', validatePages('feed').length === 0);
  T('regime page clean', validatePages('regime').length === 0);
  T('discovery clean', validateDiscovery().length === 0);
  T('forbidden caught', FORBIDDEN.some((re) => re.test('buy now')));
  T('raw artifact caught', RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"')));
  T('bad link caught', !hrefResolves('/research/does-not-exist/'));
  T('good link ok', hrefResolves('/research/'));
  console.log(`[research-network] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const arg = (process.argv.find((x) => x.startsWith('--')) || '').replace('--', '');
  if (!RUN[arg]) { console.error('[research-network] usage: --hub|--feed|--authority|--graph|--discovery'); process.exit(2); }
  const failures = RUN[arg]();
  if (failures.length) { failures.forEach((m) => console.error(`[${NAME[arg]}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${NAME[arg]}] check:${NAME[arg]} passed.`);
}

module.exports = { validateHub, validateGraph, validateAuthority, validatePages, validateDiscovery };
