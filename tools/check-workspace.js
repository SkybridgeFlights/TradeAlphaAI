'use strict';

// Phase 218 validator. Backs:
// check:workspace, check:watchlists, check:monitoring,
// check:watchlist-research, check:workspace-discovery.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (name) => path.join(ROOT, 'data', 'intelligence', name);
const { ASSETS } = require('./asset-registry');
const { SECTORS } = require('./sector-registry');
const { EQUITIES } = require('./equity-registry');
const { ETFS } = require('./etf-registry');

const CHECK = (process.argv.find((a) => a.startsWith('--check=')) || '--check=workspace').slice('--check='.length);
const SELF_TEST = process.argv.includes('--self-test');

const WATCHLIST_IDS = new Set(['market-core', 'technology', 'defensive', 'etf-core']);
const ENTITY_TYPES = new Set(['asset', 'sector', 'equity', 'etf']);
const REGISTRY = {
  asset: new Set(ASSETS.map((x) => x.symbol)),
  sector: new Set(SECTORS.map((x) => x.symbol)),
  equity: new Set(EQUITIES.map((x) => x.symbol)),
  etf: new Set(ETFS.map((x) => x.symbol)),
};
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bgo (long|short)\b/i, /\bguaranteed\b/i,
  /\bwill (rise|fall|rally|crash)\b/i, /\bforecast\b/i,
  /(?:\bشراء\b|\bبيع\b|إشارة\s*تداول|هدف\s*سعري|وقف\s*الخسارة|سيرتفع|سينخفض)/,
];
const RAW_HREF = [/href="[^"]*\.json/i, /href="\/data\//i, /system-status/i, /workflow/i, /validator/i];

function readJson(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function html(rel) { const p = path.join(ROOT, rel); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
function visible(htmlText) { return String(htmlText || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }
function plural(type) { return type === 'equity' ? 'equities' : `${type}s`; }

function hrefExists(href, pageRel = '') {
  if (!href || href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('#')) return true;
  const clean = href.split('#')[0].split('?')[0];
  if (/\.(css|js|svg|png|jpg|jpeg|webp|ico)$/i.test(clean)) return true;
  if (!clean || clean === '/') return exists('index.html');
  const rel = clean.replace(/^\//, '');
  if (!clean.startsWith('/')) {
    const base = path.dirname(pageRel).replaceAll('\\', '/');
    const resolved = path.normalize(path.join(base, clean)).replaceAll('\\', '/');
    return exists(resolved);
  }
  if (rel.endsWith('/')) return exists(`${rel}index.html`);
  return exists(rel);
}

function collectHrefs(page) {
  return [...page.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).filter((h) => !h.startsWith('https://t.me/'));
}

function validateArtifacts() {
  const f = [];
  const workspace = readJson(J('workspace.json'));
  const watchlists = readJson(J('watchlists.json'));
  const monitoring = readJson(J('watchlist-monitoring.json'));
  if (!workspace) return ['workspace.json missing/malformed'];
  if (!watchlists) return ['watchlists.json missing/malformed'];
  if (!monitoring) return ['watchlist-monitoring.json missing/malformed'];
  if (workspace.source_layer !== 'workspace') f.push('workspace source_layer mismatch');
  if (watchlists.source_layer !== 'watchlists') f.push('watchlists source_layer mismatch');
  if (monitoring.source_layer !== 'watchlist-monitoring') f.push('monitoring source_layer mismatch');
  if (!Array.isArray(watchlists.watchlists) || watchlists.watchlists.length !== 4) f.push('expected exactly four default watchlists');
  if ((workspace.counts || {}).unique_symbols !== 14) f.push('expected 14 unique monitored symbols');
  for (const w of watchlists.watchlists || []) {
    if (!WATCHLIST_IDS.has(w.id)) f.push(`unexpected watchlist id ${w.id}`);
    if (!w.title_en || !w.title_ar || !w.thesis_en || !w.thesis_ar) f.push(`${w.id}: missing bilingual metadata`);
    if (!Array.isArray(w.entities) || !w.entities.length) f.push(`${w.id}: missing entities`);
    if (!Array.isArray(w.evidence_refs) || !w.evidence_refs.length) f.push(`${w.id}: missing evidence_refs`);
    for (const e of w.entities || []) {
      if (!ENTITY_TYPES.has(e.type)) f.push(`${w.id}: unsupported type ${e.type}`);
      if (!REGISTRY[e.type].has(e.symbol)) f.push(`${w.id}: unsupported entity ${e.type}:${e.symbol}`);
      if (!e.href || !e.research_href) f.push(`${w.id}:${e.symbol}: missing hrefs`);
      if (!Array.isArray(e.evidence_refs) || !e.evidence_refs.length) f.push(`${w.id}:${e.symbol}: missing evidence`);
      if (!e.ranking || !e.history) f.push(`${w.id}:${e.symbol}: missing ranking/history context`);
    }
  }
  for (const w of monitoring.watchlists || []) {
    if (!WATCHLIST_IDS.has(w.id)) f.push(`monitoring unexpected watchlist id ${w.id}`);
    for (const e of w.entities || []) {
      if (!REGISTRY[e.type]?.has(e.symbol)) f.push(`monitoring unsupported entity ${e.type}:${e.symbol}`);
      if (!Array.isArray(e.evidence_refs)) f.push(`monitoring ${e.symbol}: evidence_refs missing`);
    }
  }
  const serialized = JSON.stringify({ workspace, watchlists, monitoring });
  if (/\bundefined\b|\bNaN\b|null\s*leak/i.test(serialized)) f.push('artifact leaks invalid placeholder text');
  for (const re of FORBIDDEN) if (re.test(serialized)) f.push(`artifact forbidden language ${re}`);
  return f;
}

function pagePair(surface, child = '') {
  const base = child || surface;
  const rel = base.endsWith('/') ? `${base}index.html` : `${base}/index.html`;
  return [rel, `ar/${rel}`];
}

function validatePage(rel, marker = 'data-workspace-surface') {
  const f = [];
  const h = html(rel);
  if (!h) return [`missing page ${rel}`];
  if (!h.includes(marker)) f.push(`${rel}: missing workspace marker`);
  if (!h.includes('id="workspace-disclaimer"')) f.push(`${rel}: missing disclaimer`);
  if (!/rel="canonical"/.test(h) || !/hreflang="en"/.test(h) || !/hreflang="ar"/.test(h)) f.push(`${rel}: missing canonical/hreflang`);
  if (rel.startsWith('ar/') && !/<html[^>]*dir="rtl"/.test(h)) f.push(`${rel}: missing RTL`);
  const text = visible(h);
  if (/\bundefined\b|\bNaN\b/.test(text)) f.push(`${rel}: visible undefined/NaN`);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`${rel}: forbidden language ${re}`);
  for (const re of RAW_HREF) if (re.test(h)) f.push(`${rel}: internal/raw exposure ${re}`);
  for (const href of collectHrefs(h)) {
    if (!hrefExists(href, rel)) f.push(`${rel}: broken href ${href}`);
  }
  return f;
}

function validatePages(scope) {
  const f = [];
  const surfaces = ['workspace/', 'workspace/watchlists/', 'workspace/monitoring/', 'workspace/research/', 'workspace/regime/'];
  if (!scope || scope === 'all') for (const s of surfaces) for (const rel of pagePair(s)) f.push(...validatePage(rel));
  if (scope === 'watchlists' || !scope || scope === 'all') {
    const watchlists = readJson(J('watchlists.json'), { watchlists: [] }).watchlists || [];
    for (const w of watchlists) {
      for (const rel of pagePair(`workspace/watchlists/${w.id}/`)) f.push(...validatePage(rel));
    }
  }
  return f;
}

function validateDiscovery() {
  const f = [];
  const required = ['/workspace/', '/workspace/watchlists/', '/workspace/monitoring/', '/workspace/research/', '/workspace/regime/'];
  const sitemap = html('sitemap-core.xml') || '';
  const sitemapAr = html('sitemap-ar.xml') || '';
  for (const href of required) {
    if (!sitemap.includes(href)) f.push(`sitemap-core missing ${href}`);
    if (!sitemapAr.includes(`/ar${href}`)) f.push(`sitemap-ar missing /ar${href}`);
  }
  const headerOnly = (h) => {
    const start = h.indexOf('<!-- GLOBAL_HEADER_START -->');
    const end = h.indexOf('<!-- GLOBAL_HEADER_END -->');
    return start >= 0 && end > start ? h.slice(start, end) : h;
  };
  for (const file of ['index.html', 'market-terminal/index.html', 'workspace/index.html']) {
    const h = html(file) || '';
    if (!h.includes('href="/workspace/"')) f.push(`${file}: missing Workspace nav/discovery link`);
    for (const raw of RAW_HREF) if (raw.test(headerOnly(h))) f.push(`${file}: header internal exposure ${raw}`);
  }
  for (const file of ['ar/index.html', 'ar/market-terminal/index.html', 'ar/workspace/index.html']) {
    const h = html(file) || '';
    if (!h.includes('href="/ar/workspace/"')) f.push(`${file}: missing AR Workspace nav/discovery link`);
    for (const raw of RAW_HREF) if (raw.test(headerOnly(h))) f.push(`${file}: header internal exposure ${raw}`);
  }
  return f;
}

function validateSurface(name) {
  if (name === 'watchlists') return [...validateArtifacts(), ...validatePages('watchlists')];
  if (name === 'monitoring') return [...validateArtifacts(), ...validatePages('all').filter((x) => x.includes('monitoring') || x.includes('workspace/monitoring'))];
  if (name === 'research') return [...validateArtifacts(), ...validatePages('all').filter((x) => x.includes('research') || x.includes('workspace/research'))];
  if (name === 'discovery') return validateDiscovery();
  return [...validateArtifacts(), ...validatePages('all'), ...validateDiscovery()];
}

function runSelfTest() {
  const failures = [];
  const badWatchlists = { watchlists: [{ id: 'bad', title_en: 'Bad', title_ar: 'سيئ', thesis_en: 'buy now', thesis_ar: 'شراء', entities: [{ type: 'asset', symbol: 'FAKE', href: '/data/x.json', research_href: '/research/assets/fake/' }] }] };
  const badSerialized = JSON.stringify(badWatchlists);
  if (!FORBIDDEN.some((re) => re.test(badSerialized))) failures.push('self-test did not detect forbidden language');
  if (REGISTRY.asset.has('FAKE')) failures.push('self-test registry unexpectedly contains FAKE');
  if (hrefExists('/data/x.json')) failures.push('self-test raw data href unexpectedly exists');
  const badHtml = '<main data-workspace-surface="x"><a href="/data/x.json">raw</a><p>buy target signal</p></main>';
  if (!RAW_HREF.some((re) => re.test(badHtml))) failures.push('self-test did not detect raw href');
  if (!FORBIDDEN.some((re) => re.test(visible(badHtml)))) failures.push('self-test did not detect visible trade language');
  if (failures.length) {
    console.error('[workspace-check] self-test failed');
    for (const x of failures) console.error(` - ${x}`);
    process.exit(1);
  }
  console.log('[workspace-check] self-test passed');
}

function main() {
  if (SELF_TEST) return runSelfTest();
  const failures = validateSurface(CHECK);
  if (failures.length) {
    console.error(`[workspace-check] ${CHECK} failed (${failures.length})`);
    for (const x of failures.slice(0, 80)) console.error(` - ${x}`);
    process.exit(1);
  }
  console.log(`[workspace-check] ${CHECK} passed`);
}

if (require.main === module) main();

module.exports = { validateArtifacts, validateDiscovery, validatePage };
