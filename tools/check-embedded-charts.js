'use strict';

// Phase 129 — check:embedded-charts. Integrity + anti-fabrication gate for REAL
// institutional OHLCV charts (<figure class="institutional-chart">) embedded in
// published article bodies (market-structure / market-news / articles, EN + AR).
//
// Complements check:institutional-charts (manifest) and check:visual-composition
// (responsiveness). This validator proves the EMBEDDED chart is a real, sourced,
// tamper-evident chart — not a placeholder card rendered as analysis — and that
// its SVG renders cleanly (no off-canvas text, no microscopic labels, no empty
// plot, RTL-safe). HARD-FAILS on:
//   * a figure missing data-symbol / data-chart-type / data-series-hash / data-as-of
//   * a series_hash that is not present in institutional-charts.json (fabricated/
//     fake chart, i.e. "chart without real OHLCV")
//   * an SVG with no <polyline> price path (empty placeholder rendered as a chart)
//   * a non-responsive SVG (fixed root width/height / missing viewBox)
//   * off-canvas text (x/y outside the viewBox) or microscopic labels (font<11)
//   * a caption missing source / as-of / the tactical-linkage line
//   * retail-TA / signal / advice language in the caption or SVG text
//   * an AR figure whose SVG is not RTL
//   * EN/AR figure-count parity break
// Passes green when nothing relevant is embedded. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const SURFACES = [
  ['market-structure', 'ar/market-structure'],
  ['market-news', 'ar/market-news'],
  ['articles', 'ar/articles'],
];
const FIG_RE = /<figure class="institutional-chart"[\s\S]*?<\/figure>/gi;
const MIN_FONT = 11;
const RETAIL = [
  /\bbuy\b/i, /\bsell\b/i, /\blong\b/i, /\bshort\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i,
  /\btake[- ]?profit\b/i, /\bprice target\b/i, /\btarget price\b/i, /\btrade setup\b/i,
  /\bRSI\b/, /\bMACD\b/, /\bgolden cross\b/i, /\bto the moon\b/i, /\bgo (long|short)\b/i,
];

function manifestHashes() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    return new Set((m.charts || []).map((c) => c.series_hash).filter(Boolean));
  } catch { return new Set(); }
}

// Validate a single embedded <figure class="institutional-chart"> block.
function validateFigure(fig, { lang, hashes, label }) {
  const f = [];
  const attr = (name) => { const m = fig.match(new RegExp(`data-${name}="([^"]*)"`)); return m ? m[1] : null; };
  const symbol = attr('symbol'); const ctype = attr('chart-type');
  const seriesHash = attr('series-hash'); const asOf = attr('as-of');
  if (!symbol) f.push(`${label}: embedded chart missing data-symbol`);
  if (!ctype) f.push(`${label}: embedded chart missing data-chart-type`);
  if (!asOf) f.push(`${label}: embedded chart missing data-as-of`);
  if (!seriesHash) f.push(`${label}: embedded chart missing data-series-hash`);
  else if (!hashes.size) f.push(`${label}: institutional-charts manifest has no verified series hashes`);
  else if (!hashes.has(seriesHash)) f.push(`${label}: series_hash not in institutional-charts manifest (fabricated/stale chart)`);

  const svgM = fig.match(/<svg[\s\S]*?<\/svg>/i);
  if (!svgM) { f.push(`${label}: embedded chart has no SVG`); return f; }
  const svg = svgM[0];
  const tagM = svg.match(/<svg\b[^>]*>/i);
  const tag = tagM ? tagM[0] : '';
  const vb = tag.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb) f.push(`${label}: SVG missing viewBox (not responsive)`);
  if (/\bwidth="\d/.test(tag) || /\bheight="\d/.test(tag)) f.push(`${label}: SVG has fixed root width/height (overflow/clipping risk)`);
  if (!/<polyline\b/i.test(svg)) f.push(`${label}: SVG has no price path (empty placeholder rendered as a chart)`);
  if (lang === 'ar' && !/direction="rtl"/.test(svg)) f.push(`${label}: AR embedded chart SVG not RTL`);

  // Geometry: no microscopic labels, no off-canvas text.
  const W = vb ? Number(vb[1]) : null; const H = vb ? Number(vb[2]) : null;
  for (const tm of svg.matchAll(/<text\b([^>]*)>/gi)) {
    const a = tm[1];
    const fsM = a.match(/font-size="([\d.]+)"/);
    if (fsM && Number(fsM[1]) < MIN_FONT) { f.push(`${label}: microscopic SVG label font-size ${fsM[1]} (<${MIN_FONT})`); break; }
    if (W !== null) {
      const xM = a.match(/\bx="(-?[\d.]+)"/); const yM = a.match(/\by="(-?[\d.]+)"/);
      if (xM && (Number(xM[1]) < 0 || Number(xM[1]) > W)) { f.push(`${label}: off-canvas SVG text x=${xM[1]} (viewBox width ${W})`); break; }
      if (yM && (Number(yM[1]) < 0 || Number(yM[1]) > H)) { f.push(`${label}: off-canvas SVG text y=${yM[1]} (viewBox height ${H})`); break; }
    }
  }

  // Caption: source + as-of + linkage line; bilingual-aware.
  const capM = fig.match(/<figcaption[\s\S]*?<\/figcaption>/i);
  const cap = (capM ? capM[0] : '').replace(/<[^>]+>/g, ' ');
  if (!capM || !cap.trim()) f.push(`${label}: embedded chart has no caption`);
  if (!/(source|المصدر)/i.test(cap)) f.push(`${label}: caption missing source attribution`);
  if (!/(as of|بتاريخ)/i.test(cap)) f.push(`${label}: caption missing "as of" freshness`);
  if (!/ic-linkage/.test(fig)) f.push(`${label}: caption missing tactical-linkage line`);
  if (/\b(undefined|NaN|null)\b/.test(cap)) f.push(`${label}: caption leaks undefined/null`);

  // Retail/advice language across caption + SVG text.
  const svgText = svg.replace(/<[^>]+>/g, ' ');
  for (const re of RETAIL) { if (re.test(cap) || re.test(svgText)) { f.push(`${label}: embedded chart contains retail/signal language ${re}`); } }
  return f;
}

function listArticles(rel) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((x) => x.endsWith('.html') && x !== 'index.html');
}

function run() {
  const hashes = manifestHashes();
  const failures = [];
  let scanned = 0;
  for (const [en, ar] of SURFACES) {
    for (const file of listArticles(en)) {
      const enHtml = fs.readFileSync(path.join(ROOT, en, file), 'utf8');
      const enFigs = enHtml.match(FIG_RE) || [];
      if (!enFigs.length) {
        // If the AR counterpart embeds a chart but EN does not, that is a parity break.
        const arPathOnly = path.join(ROOT, ar, file);
        if (fs.existsSync(arPathOnly) && (fs.readFileSync(arPathOnly, 'utf8').match(FIG_RE) || []).length) {
          failures.push(`${ar}/${file}: embeds a chart with no EN counterpart (parity break)`);
        }
        continue;
      }
      scanned += enFigs.length;
      enFigs.forEach((fig, i) => validateFigure(fig, { lang: 'en', hashes, label: `${en}/${file}#${i + 1}` }).forEach((m) => failures.push(m)));
      const arPath = path.join(ROOT, ar, file);
      if (!fs.existsSync(arPath)) { failures.push(`${en}/${file}: missing AR counterpart for embedded chart`); continue; }
      const arHtml = fs.readFileSync(arPath, 'utf8');
      const arFigs = arHtml.match(FIG_RE) || [];
      if (arFigs.length !== enFigs.length) failures.push(`${ar}/${file}: ${arFigs.length} charts vs EN ${enFigs.length} (parity break)`);
      arFigs.forEach((fig, i) => validateFigure(fig, { lang: 'ar', hashes, label: `${ar}/${file}#${i + 1}` }).forEach((m) => failures.push(m)));
    }
  }
  return { failures, scanned };
}

if (require.main === module && process.argv.includes('--self-test')) {
  const hashes = new Set(['realhash']);
  const good = '<figure class="institutional-chart" data-symbol="SPY" data-chart-type="price_structure" data-series-hash="realhash" data-as-of="2026-06-12"><div class="ic-svg"><svg viewBox="0 0 1200 620" direction="rtl"><polyline points="1,2 3,4"/><text x="72" y="48" font-size="17">x</text></svg></div><figcaption class="ic-caption"><span class="ic-hook">h</span><span class="ic-linkage" data-support="mixed">Tactical linkage</span><span class="ic-attrib">Source: AlphaVantage · As of 2026-06-12</span></figcaption></figure>';
  const cases = [
    ['missing series-hash', good.replace(' data-series-hash="realhash"', '')],
    ['hash not in manifest', good.replace('realhash', 'fakehash')],
    ['empty placeholder (no polyline)', good.replace('<polyline points="1,2 3,4"/>', '')],
    ['microscopic font', good.replace('font-size="17"', 'font-size="6"')],
    ['off-canvas text', good.replace('x="72"', 'x="9999"')],
    ['fixed root size', good.replace('viewBox="0 0 1200 620"', 'viewBox="0 0 1200 620" width="1200" height="620"')],
    ['retail language', good.replace('Tactical linkage', 'buy signal here')],
    ['missing as-of', good.replace(' · As of 2026-06-12', '')],
  ];
  let ok = 0;
  for (const [name, fig] of cases) {
    const lang = /RTL|rtl/.test(fig) ? 'ar' : 'en';
    if (validateFigure(fig, { lang, hashes, label: name }).length) ok += 1;
    else console.error(`SELF-TEST FAIL: "${name}" not rejected`);
  }
  if (validateFigure(good, { lang: 'ar', hashes, label: 'clean' }).length === 0) ok += 1;
  else console.error('SELF-TEST FAIL: clean figure rejected:', validateFigure(good, { lang: 'ar', hashes, label: 'clean' }));
  console.log(`[embedded-charts] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  const { failures, scanned } = run();
  if (failures.length) {
    failures.forEach((m) => console.error(`[embedded-charts] FAIL: ${m}`));
    process.exit(1);
  }
  console.log(`[embedded-charts] check:embedded-charts passed (${scanned} embedded real chart(s); sourced, hash-verified, non-placeholder, geometry-clean, bilingual, RTL-safe).`);
}

module.exports = { validateFigure, run };
