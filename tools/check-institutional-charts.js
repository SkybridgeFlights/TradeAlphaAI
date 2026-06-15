'use strict';

// Phase 126 — check:institutional-charts. Anti-fabrication + integrity gate for
// the deterministic OHLCV chart manifest (data/visual/institutional-charts.json)
// and its SVGs. An HONEST EMPTY manifest (no provider keys) passes. When charts
// ARE present they must be sourced, internally consistent, and tamper-evident:
// HARD-FAILS on invalid/fabricated bars, a series_hash that does not recompute,
// a disallowed provider, missing attribution / as-of / bilingual titles, an
// overlay over the cap, a non-responsive or fixed-width SVG, a retail-TA label,
// or a status that contradicts the chart counts. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MIN_BARS, MAX_OVERLAYS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const ARABIC = /[؀-ۿ]/;
const APPROVED = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Approved fixture']);
// Retail-TA / signal vocabulary that must never appear in an institutional chart.
const RETAIL = [/\bbuy\b/i, /\bsell\b/i, /\bRSI\b/, /\bMACD\b/, /\bbreakout\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bgolden cross\b/i, /\bmoon\b/i, /\boversold\b/i, /\boverbought\b/i, /\bsupport\/resistance\b/i];

function sha256(v) { return crypto.createHash('sha256').update(String(v)).digest('hex'); }

// Validate one manifest object; returns array of failure strings (factored for self-test).
function validate(m, opts = {}) {
  const f = [];
  if (!m || typeof m !== 'object') { f.push('manifest not an object'); return f; }
  if (m.schema_version !== '1.0') f.push(`unexpected schema_version ${m.schema_version}`);
  if (!['available', 'partial', 'unavailable'].includes(m.status)) f.push(`invalid status ${m.status}`);
  if (!/Approved provider OHLCV only/.test(String(m.source_policy || ''))) f.push('missing/weak source_policy');
  if (!(m.max_overlays_per_chart <= MAX_OVERLAYS)) f.push(`max_overlays_per_chart > ${MAX_OVERLAYS}`);
  if (!(m.max_charts_per_article <= 2)) f.push('max_charts_per_article > 2');
  const charts = Array.isArray(m.charts) ? m.charts : [];
  const unavailable = Array.isArray(m.unavailable) ? m.unavailable : [];

  // Status must agree with counts.
  if (m.status === 'unavailable' && charts.length) f.push('status unavailable but charts present');
  if (m.status === 'available' && (!charts.length || unavailable.length)) f.push('status available but charts missing or some unavailable');
  if (m.status === 'partial' && (!charts.length || !unavailable.length)) f.push('status partial but not a mix');

  for (const u of unavailable) { if (!u.symbol || !u.reason) f.push(`unavailable entry missing symbol/reason`); }

  for (const c of charts) {
    const id = c.id || c.symbol || '?';
    if (!c.symbol) f.push(`${id}: missing symbol`);
    if (!c.title_en) f.push(`${id}: missing EN title`);
    if (!c.title_ar || !ARABIC.test(c.title_ar)) f.push(`${id}: missing native AR title`);
    const series = Array.isArray(c.series) ? c.series : [];
    if (series.length < MIN_BARS) f.push(`${id}: ${series.length} bars < ${MIN_BARS}`);
    // Bar sanity — no fabricated / impossible OHLC.
    for (const b of series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) { f.push(`${id}: bad bar date ${b.date}`); break; }
      const ok = [b.open, b.high, b.low, b.close].every((v) => typeof v === 'number' && Number.isFinite(v));
      if (!ok) { f.push(`${id}: non-finite OHLC`); break; }
      if (b.low > b.high || b.open < b.low || b.open > b.high || b.close < b.low || b.close > b.high) { f.push(`${id}: impossible OHLC bar (${b.date})`); break; }
    }
    // Tamper-evidence: the committed series_hash must recompute.
    if (c.series_hash !== sha256(JSON.stringify(series))) f.push(`${id}: series_hash does not match series (tampered/fabricated)`);
    if (c.bar_count !== series.length) f.push(`${id}: bar_count ${c.bar_count} != series length ${series.length}`);
    if (series.length && c.as_of !== series[series.length - 1].date) f.push(`${id}: as_of ${c.as_of} != last bar date`);
    // Overlays.
    const ov = Array.isArray(c.overlays) ? c.overlays : [];
    if (ov.length > MAX_OVERLAYS) f.push(`${id}: ${ov.length} overlays > ${MAX_OVERLAYS}`);
    if (c.overlay_count !== ov.length) f.push(`${id}: overlay_count mismatch`);
    // Attribution.
    const a = c.attribution || {};
    if (!APPROVED.has(a.provider)) f.push(`${id}: provider "${a.provider}" not in approved set`);
    if (!a.source_url || !a.fetched_at || !a.response_hash) f.push(`${id}: incomplete attribution`);
    if (!a.label_en || !a.label_ar || !ARABIC.test(String(a.label_ar))) f.push(`${id}: missing bilingual attribution label`);
    if (c.verified !== true) f.push(`${id}: not marked verified`);

    // SVG integrity (skip in self-test which has no files on disk).
    if (!opts.skipSvg) {
      for (const loc of ['en', 'ar']) {
        const rel = c.files && c.files[loc];
        if (!rel) { f.push(`${id}: missing ${loc} file ref`); continue; }
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) { f.push(`${id}: ${loc} SVG missing on disk`); continue; }
        const svg = fs.readFileSync(abs, 'utf8');
        if (!/<svg\b[^>]*viewBox="0 0 \d+ \d+"/.test(svg)) f.push(`${id}: ${loc} SVG missing viewBox`);
        if (/<svg\b[^>]*\bwidth="\d/.test(svg) || /<svg\b[^>]*\bheight="\d/.test(svg)) f.push(`${id}: ${loc} SVG has fixed width/height on root (not responsive)`);
        if (!svg.includes(`data-series-hash="${c.series_hash}"`)) f.push(`${id}: ${loc} SVG series-hash attr missing/mismatch`);
        if (loc === 'ar' && !/direction="rtl"/.test(svg)) f.push(`${id}: AR SVG not RTL`);
        const svgText = svg.replace(/<[^>]+>/g, ' ');
        for (const re of RETAIL) if (re.test(svgText)) f.push(`${id}: ${loc} SVG retail-TA label ${re}`);
        if (!/(Source|المصدر)/.test(svgText)) f.push(`${id}: ${loc} SVG missing source attribution`);
        if (!new RegExp(`(As of|حتى)`).test(svgText)) f.push(`${id}: ${loc} SVG missing as-of`);
      }
    }
  }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = {
    schema_version: '1.0', status: 'available', source_policy: 'Approved provider OHLCV only; no inferred or placeholder bars.',
    max_overlays_per_chart: 5, max_charts_per_article: 2, unavailable: [],
    charts: [{
      id: 't', symbol: 'SPY', title_en: 'x', title_ar: 'سين', bar_count: MIN_BARS, as_of: '2026-01-' + String(MIN_BARS).padStart(2, '0'),
      overlays: [], overlay_count: 0, verified: true,
      attribution: { provider: 'FMP', source_url: 'u', fetched_at: 't', response_hash: 'h', label_en: 'l', label_ar: 'ل' },
      series: Array.from({ length: MIN_BARS }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, open: 100, high: 101, low: 99, close: 100, volume: 1 })),
      files: { en: 'x-en.svg', ar: 'x-ar.svg' },
    }],
  };
  base.charts[0].series_hash = sha256(JSON.stringify(base.charts[0].series));
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['tampered hash', (m) => { m.charts[0].series_hash = 'deadbeef'; }],
    ['impossible bar', (m) => { m.charts[0].series[0].low = 999; m.charts[0].series_hash = sha256(JSON.stringify(m.charts[0].series)); }],
    ['bad provider', (m) => { m.charts[0].attribution.provider = 'TradingView'; }],
    ['too few bars', (m) => { m.charts[0].series = m.charts[0].series.slice(0, 10); m.charts[0].bar_count = 10; m.charts[0].series_hash = sha256(JSON.stringify(m.charts[0].series)); }],
    ['status contradiction', (m) => { m.status = 'unavailable'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c, { skipSvg: true }).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone(), { skipSvg: true }).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean manifest rejected:', validate(clone(), { skipSvg: true }));
  console.log(`[institutional-charts] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (!fs.existsSync(MANIFEST)) {
  console.log('[institutional-charts] no manifest yet — nothing to validate (non-fatal).');
  console.log('[institutional-charts] check:institutional-charts passed.');
  process.exit(0);
}
let manifest;
try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { console.error(`[institutional-charts] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
const failures = validate(manifest);
if (failures.length) {
  failures.forEach((m) => console.error(`[institutional-charts] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[institutional-charts] check:institutional-charts passed (status=${manifest.status}, ${manifest.charts.length} chart(s); sourced, hash-verified, responsive, bilingual, no retail labels).`);
