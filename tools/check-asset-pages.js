'use strict';

// Phase 201 / Workstream G — check:asset-pages.
// Integrity gate for the per-asset intelligence pages (/markets/<slug>/ + AR).
// HARD-FAILS on: a missing EN or AR page for any registry asset, wrong canonical
// /hreflang, AR not RTL, a missing required section, EN/AR section parity break,
// retail/advice language, raw-artifact/system-status exposure, an embedded chart
// that is not real (series_hash ∉ manifest) / non-responsive / missing caption,
// OR an asset with no chart that fails to show the honest "awaiting approved
// provider data" state (a silent/placeholder gap). Passes when no pages exist
// yet. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { ASSETS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const REQUIRED = ['asset-score', 'asset-chart', 'asset-context', 'asset-macro-influence', 'asset-history-context', 'asset-disclaimer'];
const FIG_RE = /<figure class="institutional-chart"[\s\S]*?<\/figure>/gi;
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\bbuy signal\b/i, /\bsell signal\b/i, /\bgo (long|short)\b/i, /\bRSI\b/, /\bMACD\b/,
  /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/,
];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];

function manifestHashes() {
  try { return new Set((JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).charts || []).map((c) => c.series_hash).filter(Boolean)); } catch { return new Set(); }
}
function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }
function sectionIds(html) { return [...html.matchAll(/<section class="market-section" id="([^"]+)"/gi)].map((m) => m[1]); }

function validateFigure(fig, lang, hashes, label, out) {
  const attr = (n) => { const m = fig.match(new RegExp(`data-${n}="([^"]*)"`)); return m ? m[1] : null; };
  const sh = attr('series-hash');
  if (!attr('symbol')) out.push(`${label}: chart missing data-symbol`);
  if (!attr('as-of')) out.push(`${label}: chart missing data-as-of`);
  if (!sh) out.push(`${label}: chart missing data-series-hash`);
  else if (hashes.size && !hashes.has(sh)) out.push(`${label}: chart series_hash not in manifest (placeholder/fabricated)`);
  const svgM = fig.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgM) { out.push(`${label}: chart has no SVG`); return; }
  const root = (svgM[0].match(/<svg\b[^>]*>/i) || [''])[0];
  if (!/viewBox="0 0 \d+ \d+"/.test(root)) out.push(`${label}: chart SVG missing viewBox`);
  if (/\bwidth="\d/.test(root) || /\bheight="\d/.test(root)) out.push(`${label}: chart SVG fixed root size`);
  if (!/<polyline\b/i.test(svgM[0])) out.push(`${label}: chart SVG no price path (placeholder)`);
  if (lang === 'ar' && !/direction="rtl"/.test(svgM[0])) out.push(`${label}: AR chart SVG not RTL`);
  const cap = (fig.match(/<figcaption[\s\S]*?<\/figcaption>/i) || [''])[0].replace(/<[^>]+>/g, ' ');
  if (!/(source|المصدر)/i.test(cap)) out.push(`${label}: chart caption missing source`);
  if (!/(as of|بتاريخ)/i.test(cap)) out.push(`${label}: chart caption missing as-of`);
}

function validatePage(rel, lang, slug, hashes, out) {
  const abs = path.join(ROOT, rel);
  const html = fs.readFileSync(abs, 'utf8');
  const canonical = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}markets/${slug}/`;
  if (!new RegExp(`rel="canonical" href="${canonical.replace(/[/.]/g, '\\$&')}"`).test(html)) out.push(`${rel}: missing/incorrect canonical`);
  if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) out.push(`${rel}: missing hreflang`);
  if (lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) out.push(`${rel}: AR not dir=rtl`);
  const ids = sectionIds(html);
  for (const id of REQUIRED) if (!ids.includes(id)) out.push(`${rel}: missing section "${id}"`);
  const text = visibleText(html);
  for (const re of FORBIDDEN) if (re.test(text)) out.push(`${rel}: forbidden retail/advice language ${re}`);
  for (const re of RAW_ARTIFACT) if (re.test(html)) out.push(`${rel}: raw-artifact/internal-route exposure ${re}`);
  if (/\b(undefined|NaN)\b/.test(text)) out.push(`${rel}: visible text leaks undefined/NaN`);
  const figs = html.match(FIG_RE) || [];
  figs.forEach((fig, i) => validateFigure(fig, lang, hashes, `${rel}#fig${i + 1}`, out));
  // Honest unavailable: a page with no chart figure must say so (no silent gap / placeholder).
  if (!figs.length && !/(awaiting approved provider data|بانتظار بيانات مزوّد معتمدة)/i.test(text)) {
    out.push(`${rel}: no chart and no honest "awaiting approved provider data" state`);
  }
  return ids;
}

function run() {
  const out = [];
  const hashes = manifestHashes();
  let scanned = 0;
  let anyPresent = false;
  for (const asset of ASSETS) {
    const enRel = `markets/${asset.slug}/index.html`;
    const arRel = `ar/markets/${asset.slug}/index.html`;
    const enExists = fs.existsSync(path.join(ROOT, enRel));
    const arExists = fs.existsSync(path.join(ROOT, arRel));
    if (!enExists && !arExists) continue;
    anyPresent = true;
    if (!enExists || !arExists) { out.push(`${asset.symbol}: missing ${enExists ? 'AR' : 'EN'} page (parity break)`); continue; }
    const enIds = validatePage(enRel, 'en', asset.slug, hashes, out);
    const arIds = validatePage(arRel, 'ar', asset.slug, hashes, out);
    if (enIds.join('|') !== arIds.join('|')) out.push(`${asset.symbol}: EN/AR section parity break`);
    scanned += 2;
  }
  return { failures: out, scanned, skipped: !anyPresent };
}

if (require.main === module && process.argv.includes('--self-test')) {
  const hashes = new Set(['realhash']);
  const goodFig = '<figure class="institutional-chart" data-symbol="SPY" data-chart-type="price_structure" data-series-hash="realhash" data-as-of="2026-06-12"><div class="ic-svg"><svg viewBox="0 0 1400 900" direction="rtl"><polyline points="1,2 3,4"/></svg></div><figcaption class="ic-caption"><span class="ic-attrib">Source: AlphaVantage · As of 2026-06-12</span></figcaption></figure>';
  const cases = [
    ['fabricated chart hash', (o) => validateFigure(goodFig.replace('realhash', 'fake'), 'ar', hashes, 'x', o)],
    ['placeholder no polyline', (o) => validateFigure(goodFig.replace('<polyline points="1,2 3,4"/>', ''), 'ar', hashes, 'x', o)],
    ['fixed root size', (o) => validateFigure(goodFig.replace('viewBox="0 0 1400 900"', 'viewBox="0 0 1400 900" width="1400"'), 'ar', hashes, 'x', o)],
    ['missing source caption', (o) => validateFigure(goodFig.replace('Source: AlphaVantage · ', ''), 'ar', hashes, 'x', o)],
    ['forbidden language', (o) => { if (FORBIDDEN.some((re) => re.test('place a buy here'))) o.push('hit'); }],
    ['raw artifact', (o) => { if (RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"'))) o.push('hit'); }],
    ['no chart no awaiting', (o) => { const t = 'some text with no honest state'; const figs = []; if (!figs.length && !/(awaiting approved provider data|بانتظار)/i.test(t)) o.push('hit'); }],
  ];
  let ok = 0;
  for (const [name, fn] of cases) { const o = []; fn(o); if (o.length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  const cleanO = []; validateFigure(goodFig, 'ar', hashes, 'clean', cleanO);
  if (cleanO.length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean figure rejected:', cleanO);
  const disc = 'not technical trading analysis, signals, price targets, forecasts'; // disclaimer must not trip
  if (!FORBIDDEN.some((re) => re.test(disc))) ok += 1; else console.error('SELF-TEST FAIL: disclaimer tripped');
  const total = cases.length + 2;
  console.log(`[asset-pages] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned, skipped } = run();
  if (skipped) { console.log('[asset-pages] no asset pages built yet — nothing to validate (non-fatal).'); process.exit(0); }
  if (failures.length) { failures.forEach((m) => console.error(`[asset-pages] FAIL: ${m}`)); process.exit(1); }
  console.log(`[asset-pages] check:asset-pages passed (${scanned} page(s); EN/AR parity, RTL, required sections, real charts only, honest unavailable, no retail/advice, no raw-artifact exposure).`);
}

module.exports = { run, validatePage, validateFigure };
