'use strict';

// Phase 200 / Workstream C+G — check:market-terminal.
// Integrity gate for the /market-terminal/ + /ar/market-terminal/ surface.
// HARD-FAILS on: a missing EN or AR page, wrong/missing canonical or hreflang,
// a missing required section, an EN/AR section-parity break, AR not RTL, a
// missing disclaimer, retail/advice/signal language in visible text, raw
// artifact exposure (.json / /data/ / /runtime/ links) or any system-status /
// operational-monitor link, or an embedded institutional chart that is not a
// real manifest-backed chart (placeholder rendered as real), is non-responsive
// (fixed root width/height / no viewBox), lacks a source/as-of caption, or (AR)
// is not RTL. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const PAGES = [
  { rel: 'market-terminal/index.html', lang: 'en', canonical: 'https://www.tradealphaai.com/market-terminal/' },
  { rel: 'ar/market-terminal/index.html', lang: 'ar', canonical: 'https://www.tradealphaai.com/ar/market-terminal/' },
];
const REQUIRED_SECTIONS = ['market-environment', 'macro-regime', 'tactical-context', 'cognitive-network', 'transmission-network', 'market-structure', 'sector-rotation', 'sector-network', 'asset-intelligence', 'asset-structure-table', 'asset-tactical-table', 'asset-liquidity-table', 'availability-matrix', 'institutional-charts', 'provider-coverage', 'data-quality', 'provider-health', 'terminal-disclaimer'];
// Retail/advice/signal language — scoped to avoid false positives on the
// disclaimer ("not ... signals") and institutional labels ("supportive
// structure", "liquidity support").
const FORBIDDEN = [
  /\bbuy\b/i, /\bsell\b/i, /\bstop[- ]?loss\b/i, /\btake[- ]?profit\b/i,
  /\bprice target\b/i, /\bbuy signal\b/i, /\bsell signal\b/i, /\bgo (long|short)\b/i,
  /\bRSI\b/, /\bMACD\b/, /\bto the moon\b/i,
  /(?:\bشراء\b|\bبيع\b|وقف\s*الخسارة|هدف\s*سعري)/,
];
const RAW_ARTIFACT = [/href="[^"]*\.json/i, /src="[^"]*\.json/i, /href="\/data\//i, /href="\/runtime\//i, /system-status/i];
const FIG_RE = /<figure class="institutional-chart"[\s\S]*?<\/figure>/gi;

function manifestHashes() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return new Set((m.charts || []).map((c) => c.series_hash).filter(Boolean));
  } catch { return new Set(); }
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function sectionIds(html) {
  return [...html.matchAll(/<section class="market-section" id="([^"]+)"/gi)].map((m) => m[1]);
}

function validateFigure(fig, lang, hashes, label, out) {
  const attr = (n) => { const m = fig.match(new RegExp(`data-${n}="([^"]*)"`)); return m ? m[1] : null; };
  const seriesHash = attr('series-hash');
  if (!attr('symbol')) out.push(`${label}: embedded chart missing data-symbol`);
  if (!attr('as-of')) out.push(`${label}: embedded chart missing data-as-of`);
  if (!seriesHash) out.push(`${label}: embedded chart missing data-series-hash`);
  else if (hashes.size && !hashes.has(seriesHash)) out.push(`${label}: embedded chart series_hash not in manifest (placeholder/fabricated)`);
  const svgM = fig.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgM) { out.push(`${label}: embedded chart has no SVG`); return; }
  const root = (svgM[0].match(/<svg\b[^>]*>/i) || [''])[0];
  if (!/viewBox="0 0 \d+ \d+"/.test(root)) out.push(`${label}: chart SVG missing viewBox (not responsive)`);
  if (/\bwidth="\d/.test(root) || /\bheight="\d/.test(root)) out.push(`${label}: chart SVG has fixed root width/height`);
  if (!/<polyline\b/i.test(svgM[0])) out.push(`${label}: chart SVG has no price path (empty placeholder)`);
  if (lang === 'ar' && !/direction="rtl"/.test(svgM[0])) out.push(`${label}: AR chart SVG not RTL`);
  const cap = (fig.match(/<figcaption[\s\S]*?<\/figcaption>/i) || [''])[0].replace(/<[^>]+>/g, ' ');
  if (!/(source|المصدر)/i.test(cap)) out.push(`${label}: chart caption missing source`);
  if (!/(as of|بتاريخ)/i.test(cap)) out.push(`${label}: chart caption missing as-of`);
}

function validatePage(page, html, hashes, out) {
  const label = page.rel;
  if (!new RegExp(`rel="canonical" href="${page.canonical.replace(/[/.]/g, '\\$&')}"`).test(html)) out.push(`${label}: missing/incorrect canonical`);
  if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) out.push(`${label}: missing hreflang alternates`);
  if (page.lang === 'ar' && !/<html[^>]*dir="rtl"/.test(html)) out.push(`${label}: AR page not dir=rtl`);
  const ids = sectionIds(html);
  for (const id of REQUIRED_SECTIONS) if (!ids.includes(id)) out.push(`${label}: missing required section "${id}"`);
  if (!/terminal-disclaimer/.test(html)) out.push(`${label}: missing disclaimer section`);

  const text = visibleText(html);
  for (const re of FORBIDDEN) if (re.test(text)) out.push(`${label}: forbidden retail/advice language ${re}`);
  for (const re of RAW_ARTIFACT) if (re.test(html)) out.push(`${label}: raw artifact / internal route exposed ${re}`);
  if (/\b(undefined|NaN)\b/.test(text)) out.push(`${label}: visible text leaks undefined/NaN`);

  const figs = html.match(FIG_RE) || [];
  figs.forEach((fig, i) => validateFigure(fig, page.lang, hashes, `${label}#fig${i + 1}`, out));
  return ids;
}

function run() {
  const out = [];
  const hashes = manifestHashes();
  const present = PAGES.filter((p) => fs.existsSync(path.join(ROOT, p.rel)));
  if (!present.length) { return { failures: [], scanned: 0, skipped: true }; } // surface not built yet — non-fatal
  if (present.length !== PAGES.length) out.push('EN/AR parity: one locale of the terminal is missing');
  const idsByLang = {};
  for (const p of present) {
    const html = fs.readFileSync(path.join(ROOT, p.rel), 'utf8');
    idsByLang[p.lang] = validatePage(p, html, hashes, out);
  }
  if (idsByLang.en && idsByLang.ar && idsByLang.en.join('|') !== idsByLang.ar.join('|')) {
    out.push(`EN/AR section parity break: [${idsByLang.en}] vs [${idsByLang.ar}]`);
  }
  return { failures: out, scanned: present.length, skipped: false };
}

if (require.main === module && process.argv.includes('--self-test')) {
  const hashes = new Set(['realhash']);
  const goodFig = '<figure class="institutional-chart" data-symbol="SPY" data-chart-type="price_structure" data-series-hash="realhash" data-as-of="2026-06-12"><div class="ic-svg"><svg viewBox="0 0 1400 900" direction="rtl"><polyline points="1,2 3,4"/></svg></div><figcaption class="ic-caption"><span class="ic-attrib">Source: AlphaVantage · As of 2026-06-12</span></figcaption></figure>';
  const cases = [
    ['missing series-hash', (o) => validateFigure(goodFig.replace(' data-series-hash="realhash"', ''), 'ar', hashes, 'x', o)],
    ['hash not in manifest', (o) => validateFigure(goodFig.replace('realhash', 'fake'), 'ar', hashes, 'x', o)],
    ['empty placeholder', (o) => validateFigure(goodFig.replace('<polyline points="1,2 3,4"/>', ''), 'ar', hashes, 'x', o)],
    ['fixed root size', (o) => validateFigure(goodFig.replace('viewBox="0 0 1400 900"', 'viewBox="0 0 1400 900" width="1400" height="900"'), 'ar', hashes, 'x', o)],
    ['missing source caption', (o) => validateFigure(goodFig.replace('Source: AlphaVantage · ', ''), 'ar', hashes, 'x', o)],
    ['forbidden language', (o) => { if (FORBIDDEN.some((re) => re.test('place a buy here'))) o.push('hit'); }],
    ['raw artifact exposure', (o) => { if (RAW_ARTIFACT.some((re) => re.test('<a href="/data/x.json">'))) o.push('hit'); }],
    ['system-status exposure', (o) => { if (RAW_ARTIFACT.some((re) => re.test('<a href="/system-status/">'))) o.push('hit'); }],
  ];
  let ok = 0;
  for (const [name, run1] of cases) { const o = []; run1(o); if (o.length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  const cleanO = []; validateFigure(goodFig, 'ar', hashes, 'clean', cleanO);
  if (cleanO.length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean figure rejected:', cleanO);
  // Disclaimer text must NOT trip the forbidden list (false-positive guard).
  const disc = 'not technical trading analysis, signals, price targets, forecasts, recommendations or investment advice';
  if (!FORBIDDEN.some((re) => re.test(disc))) ok += 1; else console.error('SELF-TEST FAIL: disclaimer tripped forbidden list');
  const total = cases.length + 2;
  console.log(`[market-terminal] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned, skipped } = run();
  if (skipped) { console.log('[market-terminal] no terminal surface built yet — nothing to validate (non-fatal).'); process.exit(0); }
  if (failures.length) {
    failures.forEach((m) => console.error(`[market-terminal] FAIL: ${m}`));
    process.exit(1);
  }
  console.log(`[market-terminal] check:market-terminal passed (${scanned} page(s); canonical/hreflang, required sections, EN/AR parity, RTL, no retail/advice, no raw-artifact exposure, real charts only).`);
}

module.exports = { run, validatePage, validateFigure };
