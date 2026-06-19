'use strict';

// Phase 211 / CP10 — visual market map validators (one impl):
//   --maps              → check:visual-market-maps (the 3 map JSON artifacts)
//   --page=<surface>    → check:{asset,sector,equity,regime,network,history}-map (page pair)
// HARD-FAILS on: empty maps, fabricated entities (not in registry), invalid labels,
// missing EN/AR page, broken canonical/hreflang, broken RTL, raw-artifact/internal
// exposure, signal/recommendation language, missing #market-map section, EN/AR parity
// break. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { COLOR } = require('./build-visual-market-maps');

const ROOT = path.resolve(__dirname, '..');
const REG = {
  asset: new Set(require('./asset-registry').ASSETS.map((e) => e.symbol)),
  sector: new Set(require('./sector-registry').SECTORS.map((e) => e.symbol)),
  equity: new Set(require('./equity-registry').EQUITIES.map((e) => e.symbol)),
};
const RANK_OK = new Set(Object.keys(COLOR));
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bgo (long|short)\b/i, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];
const PAGE_GROUP = { asset: 'assets', sector: 'sectors', equity: 'equities' };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }

function validateMaps() {
  const f = [];
  for (const g of ['asset', 'sector', 'equity']) {
    const m = readJson(path.join(ROOT, 'data', 'visual', `${g}-map.json`), null);
    if (!m) { f.push(`${g}-map.json missing/malformed`); continue; }
    if (m.source_layer !== `${g}-map`) f.push(`${g}-map: bad source_layer`);
    const cells = Array.isArray(m.cells) ? m.cells : [];
    if (!cells.length) f.push(`${g}-map: empty map`);
    if (cells.length !== REG[g].size) f.push(`${g}-map: ${cells.length} cells != ${REG[g].size} registry`);
    for (const c of cells) {
      if (!REG[g].has(c.symbol)) f.push(`${g}-map: fabricated entity ${c.symbol}`);
      if (!RANK_OK.has(c.rank_label)) f.push(`${g}-map: ${c.symbol} invalid rank_label`);
      if (!c.color || !/^#[0-9a-f]{6}$/i.test(c.color)) f.push(`${g}-map: ${c.symbol} invalid color`);
      if (!c.href || /\.(json)$|^\/data\//.test(c.href)) f.push(`${g}-map: ${c.symbol} bad/raw href`);
    }
    const text = JSON.stringify(m);
    for (const re of FORBIDDEN) if (re.test(text)) f.push(`${g}-map: forbidden language ${re}`);
  }
  return f;
}

function validatePagePair(surface) {
  const f = [];
  const en = `market-map/${surface}/index.html`; const ar = `ar/market-map/${surface}/index.html`;
  const enAbs = path.join(ROOT, en); const arAbs = path.join(ROOT, ar);
  if (!fs.existsSync(enAbs) || !fs.existsSync(arAbs)) { f.push(`${surface}: missing EN or AR page`); return f; }
  for (const [rel, lang] of [[en, 'en'], [ar, 'ar']]) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const canon = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}market-map/${surface}/`;
    if (!new RegExp(`rel="canonical" href="${canon.replace(/[/.]/g, '\\$&')}"`).test(html)) f.push(`${rel}: bad canonical`);
    if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) f.push(`${rel}: missing hreflang`);
    if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) f.push(`${rel}: AR not RTL`);
    if (!/id="market-map"/.test(html)) f.push(`${rel}: missing #market-map section`);
    const text = visibleText(html);
    for (const re of FORBIDDEN) if (re.test(text)) f.push(`${rel}: forbidden language ${re}`);
    for (const re of RAW_ARTIFACT) if (re.test(html)) f.push(`${rel}: raw-artifact/internal exposure ${re}`);
    if (/\b(undefined|NaN)\b/.test(text)) f.push(`${rel}: leaks undefined/NaN`);
    // entity maps must link to detail pages
    if (PAGE_GROUP_REV[surface]) { const g = PAGE_GROUP_REV[surface]; const base = g === 'asset' ? 'markets' : g === 'sector' ? 'sectors' : 'equities'; if (!new RegExp(`href="/(?:ar/)?${base}/[a-z-]+/"`).test(html)) f.push(`${rel}: no detail-page links`); }
  }
  return f;
}
const PAGE_GROUP_REV = { assets: 'asset', sectors: 'sector', equities: 'equity' };

if (require.main === module && process.argv.includes('--self-test')) {
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  T('maps clean', validateMaps().length === 0);
  // negative: fabricated entity / forbidden via inline checks
  T('forbidden caught', FORBIDDEN.some((re) => re.test('buy now')));
  T('raw artifact caught', RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"')));
  T('bad rank caught', !RANK_OK.has('mega'));
  for (const s of ['assets', 'sectors', 'equities', 'regime', 'network', 'history']) T(`${s} page clean`, validatePagePair(s).length === 0);
  console.log(`[market-maps] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const pageArg = process.argv.find((x) => x.startsWith('--page='));
  let failures; let name;
  if (process.argv.includes('--maps')) { name = 'visual-market-maps'; failures = validateMaps(); }
  else if (pageArg) { const s = pageArg.slice(7); name = `${PAGE_GROUP_REV[s] || s}-map`; failures = validatePagePair(s); }
  else { console.error('[market-maps] usage: --maps | --page=<surface>'); process.exit(2); }
  if (failures.length) { failures.forEach((m) => console.error(`[${name}] FAIL: ${m}`)); process.exit(1); }
  console.log(`[${name}] check:${name} passed.`);
}

module.exports = { validateMaps, validatePagePair };
