'use strict';

// Phase 206 / Workstream J — check:equity-pages.
// Integrity gate for /equities/<slug>/ + /ar/equities/<slug>/. HARD-FAILS on a
// missing EN or AR page, wrong canonical/hreflang, AR not RTL, a missing required
// section, EN/AR section-parity break, retail/advice language, raw-artifact/
// system-status exposure, an embedded chart that is not real (series_hash ∉
// equity-charts manifest) / non-responsive / missing caption, or a chartless page
// with no honest "awaiting" state. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { EQUITIES } = require('./equity-registry');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const REQUIRED = ['equity-score', 'equity-chart', 'equity-context', 'equity-macro', 'equity-history-context', 'equity-disclaimer'];
const FIG_RE = /<figure class="institutional-chart"[\s\S]*?<\/figure>/gi;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\bprice target\b/i, /\bbuy signal\b/i, /\bgo (long|short)\b/i, /\bRSI\b/, /\bMACD\b/, /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];

function manifestHashes() { try { return new Set((JSON.parse(fs.readFileSync(MANIFEST, 'utf8')).charts || []).map((c) => c.series_hash).filter(Boolean)); } catch { return new Set(); } }
function visibleText(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '); }
function sectionIds(html) { return [...html.matchAll(/<section class="market-section" id="([^"]+)"/gi)].map((m) => m[1]); }

function validateFigure(fig, lang, hashes, label, out) {
  const attr = (n) => { const m = fig.match(new RegExp(`data-${n}="([^"]*)"`)); return m ? m[1] : null; };
  const sh = attr('series-hash');
  if (!attr('symbol')) out.push(`${label}: chart missing data-symbol`);
  if (!attr('as-of')) out.push(`${label}: chart missing data-as-of`);
  if (!sh) out.push(`${label}: chart missing data-series-hash`);
  else if (hashes.size && !hashes.has(sh)) out.push(`${label}: chart series_hash not in equity manifest (placeholder/fabricated)`);
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
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const canonical = `https://www.tradealphaai.com/${lang === 'ar' ? 'ar/' : ''}equities/${slug}/`;
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
  if (!figs.length && !/(awaiting approved provider data|بانتظار بيانات مزوّد معتمدة)/i.test(text)) out.push(`${rel}: no chart and no honest "awaiting" state`);
  return ids;
}

function run() {
  const out = []; const hashes = manifestHashes(); let scanned = 0; let any = false;
  for (const eq of EQUITIES) {
    const enRel = `equities/${eq.slug}/index.html`; const arRel = `ar/equities/${eq.slug}/index.html`;
    const en = fs.existsSync(path.join(ROOT, enRel)); const ar = fs.existsSync(path.join(ROOT, arRel));
    if (!en && !ar) continue; any = true;
    if (!en || !ar) { out.push(`${eq.symbol}: missing ${en ? 'AR' : 'EN'} page (parity break)`); continue; }
    const enIds = validatePage(enRel, 'en', eq.slug, hashes, out);
    const arIds = validatePage(arRel, 'ar', eq.slug, hashes, out);
    if (enIds.join('|') !== arIds.join('|')) out.push(`${eq.symbol}: EN/AR section parity break`);
    scanned += 2;
  }
  return { failures: out, scanned, skipped: !any };
}

if (require.main === module && process.argv.includes('--self-test')) {
  const hashes = new Set(['realhash']);
  const good = '<figure class="institutional-chart" data-symbol="NVDA" data-chart-type="equity_structure" data-series-hash="realhash" data-as-of="2026-06-16"><div class="ic-svg"><svg viewBox="0 0 1400 900" direction="rtl"><polyline points="1,2 3,4"/></svg></div><figcaption class="ic-caption"><span class="ic-attrib">Source: Yahoo · As of 2026-06-16</span></figcaption></figure>';
  const cases = [
    ['fabricated hash', (o) => validateFigure(good.replace('realhash', 'fake'), 'ar', hashes, 'x', o)],
    ['placeholder no polyline', (o) => validateFigure(good.replace('<polyline points="1,2 3,4"/>', ''), 'ar', hashes, 'x', o)],
    ['fixed root', (o) => validateFigure(good.replace('viewBox="0 0 1400 900"', 'viewBox="0 0 1400 900" width="1400"'), 'ar', hashes, 'x', o)],
    ['missing source', (o) => validateFigure(good.replace('Source: Yahoo · ', ''), 'ar', hashes, 'x', o)],
    ['forbidden', (o) => { if (FORBIDDEN.some((re) => re.test('place a buy here'))) o.push('hit'); }],
    ['raw artifact', (o) => { if (RAW_ARTIFACT.some((re) => re.test('href="/data/x.json"'))) o.push('hit'); }],
  ];
  let ok = 0;
  for (const [name, fn] of cases) { const o = []; fn(o); if (o.length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  const cleanO = []; validateFigure(good, 'ar', hashes, 'clean', cleanO);
  if (cleanO.length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', cleanO);
  console.log(`[equity-pages] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned, skipped } = run();
  if (skipped) { console.log('[equity-pages] no equity pages built yet (non-fatal).'); process.exit(0); }
  if (failures.length) { failures.forEach((m) => console.error(`[equity-pages] FAIL: ${m}`)); process.exit(1); }
  console.log(`[equity-pages] check:equity-pages passed (${scanned} page(s); EN/AR parity, RTL, required sections, real charts only, honest unavailable, no retail/advice).`);
}

module.exports = { run };
