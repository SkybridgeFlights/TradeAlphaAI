'use strict';

// Phase 214 CP2 — check:etf-charts.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ETFS } = require('./etf-registry');
const { MIN_BARS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const SYMBOLS = new Set(ETFS.map((etf) => etf.symbol));
const ARABIC = /[\u0600-\u06ff]/;
const APPROVED = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo', 'Approved fixture', 'cached']);
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
const FORBIDDEN = [
  /\bplaceholder\b/i, /\bfake\b/i, /\bsynthetic\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/
];

function validate(manifest, opts = {}) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest not an object'];
  if (manifest.schema_version !== '1.0') failures.push('unexpected schema_version');
  if (manifest.source_layer !== 'etf-charts') failures.push(`unexpected source_layer "${manifest.source_layer}"`);
  if (!['available', 'partial', 'unavailable'].includes(manifest.status)) failures.push(`invalid status ${manifest.status}`);
  if (!manifest.source_policy || !/Approved provider OHLCV only/.test(manifest.source_policy)) failures.push('missing source_policy');
  const charts = Array.isArray(manifest.charts) ? manifest.charts : [];
  const unavailable = Array.isArray(manifest.unavailable) ? manifest.unavailable : [];
  if (manifest.status === 'unavailable' && charts.length) failures.push('status unavailable but charts present');
  if (manifest.status === 'available' && (!charts.length || unavailable.length)) failures.push('status available but charts missing or unavailable entries exist');
  for (const u of unavailable) {
    if (!SYMBOLS.has(u.symbol)) failures.push(`unavailable unknown ETF ${u.symbol}`);
    if (!u.reason) failures.push(`${u.symbol || '?'}: unavailable missing reason`);
  }
  for (const chart of charts) {
    const id = chart.id || chart.symbol || '?';
    if (!SYMBOLS.has(chart.symbol)) failures.push(`${id}: chart for unknown ETF ${chart.symbol}`);
    if (!chart.title_en || !ARABIC.test(String(chart.title_ar || ''))) failures.push(`${id}: missing bilingual title`);
    if (chart.visual_type !== 'etf_structure') failures.push(`${id}: invalid visual_type`);
    const series = Array.isArray(chart.series) ? chart.series : [];
    if (series.length < MIN_BARS) failures.push(`${id}: ${series.length} bars < ${MIN_BARS}`);
    for (const bar of series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(bar.date))) { failures.push(`${id}: bad bar date`); break; }
      if (![bar.open, bar.high, bar.low, bar.close].every((v) => typeof v === 'number' && Number.isFinite(v))) { failures.push(`${id}: non-finite OHLC`); break; }
      if (bar.low > bar.high || bar.open < bar.low || bar.open > bar.high || bar.close < bar.low || bar.close > bar.high) { failures.push(`${id}: impossible OHLC (${bar.date})`); break; }
    }
    if (chart.series_hash !== sha256(JSON.stringify(series))) failures.push(`${id}: series_hash does not recompute`);
    if (series.length && chart.as_of !== series[series.length - 1].date) failures.push(`${id}: as_of != last bar`);
    if (!APPROVED.has(chart.attribution && chart.attribution.provider)) failures.push(`${id}: unapproved provider "${chart.attribution && chart.attribution.provider}"`);
    if (chart.verified !== true) failures.push(`${id}: not verified`);
    if (!opts.skipSvg) {
      for (const loc of ['en', 'ar']) {
        const rel = chart.files && chart.files[loc];
        if (!rel) { failures.push(`${id}: missing ${loc} SVG ref`); continue; }
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) { failures.push(`${id}: ${loc} SVG missing`); continue; }
        const svg = fs.readFileSync(abs, 'utf8');
        if (!/viewBox="0 0 \d+ \d+"/.test(svg)) failures.push(`${id}: ${loc} SVG not responsive`);
        if (/<svg\b[^>]*\b(width|height)="\d/.test(svg)) failures.push(`${id}: ${loc} SVG fixed root size`);
        if (!svg.includes(`data-series-hash="${chart.series_hash}"`)) failures.push(`${id}: ${loc} SVG hash mismatch`);
        if (loc === 'ar' && !/direction="rtl"/.test(svg)) failures.push(`${id}: AR SVG not RTL`);
        const flat = svg.replace(/<[^>]+>/g, ' ');
        if (!/(Source|المصدر)/.test(flat)) failures.push(`${id}: ${loc} SVG missing source`);
        if (!/(As of|بتاريخ|حتى)/.test(flat)) failures.push(`${id}: ${loc} SVG missing as-of`);
      }
    }
  }
  const health = manifest.provider_health || {};
  if (health.etfs_total !== ETFS.length) failures.push('provider_health etfs_total mismatch');
  if ((health.etfs_available || 0) !== charts.length) failures.push('provider_health available mismatch');
  if ((health.etfs_unavailable || 0) !== unavailable.length) failures.push('provider_health unavailable mismatch');
  const text = JSON.stringify(manifest);
  if (/\b(undefined|NaN)\b/.test(text)) failures.push('leaks undefined/NaN');
  for (const re of FORBIDDEN) if (re.test(text)) failures.push(`forbidden chart language ${re}`);
  return failures;
}

function run() {
  if (!fs.existsSync(FILE)) {
    console.error(`[etf-charts] FAIL: missing ${path.relative(ROOT, FILE)}`);
    process.exit(1);
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (error) {
    console.error(`[etf-charts] FAIL: malformed JSON: ${error.message}`);
    process.exit(1);
  }
  const failures = validate(manifest);
  if (failures.length) {
    failures.forEach((failure) => console.error(`[etf-charts] FAIL: ${failure}`));
    process.exit(1);
  }
  console.log(`[etf-charts] check:etf-charts passed (status=${manifest.status}, charts=${(manifest.charts || []).length}, unavailable=${(manifest.unavailable || []).length}).`);
}

if (require.main === module && process.argv.includes('--self-test')) {
  const sample = {
    schema_version: '1.0',
    source_layer: 'etf-charts',
    generated_at: '2026-06-19T00:00:00.000Z',
    status: 'unavailable',
    source_policy: 'Approved provider OHLCV only; unavailable symbols remain unavailable.',
    charts: [],
    unavailable: ETFS.map((etf) => ({ symbol: etf.symbol, reason: 'unavailable_offline' })),
    provider_health: { etfs_total: ETFS.length, etfs_available: 0, etfs_unavailable: ETFS.length }
  };
  let ok = 0; let total = 0;
  const cases = [
    ['clean unavailable', (m) => m, false],
    ['unknown unavailable', (m) => { m.unavailable[0].symbol = 'XYZ'; }, true],
    ['bad status', (m) => { m.status = 'green'; }, true],
    ['present chart while unavailable', (m) => { m.charts = [{ symbol: 'VOO' }]; }, true],
    ['health mismatch', (m) => { m.provider_health.etfs_total = 1; }, true],
    ['forbidden language', (m) => { m.source_policy = 'buy signal'; }, true]
  ];
  for (const [, mutate, shouldFail] of cases) {
    total += 1;
    const copy = JSON.parse(JSON.stringify(sample));
    mutate(copy);
    const failed = validate(copy, { skipSvg: true }).length > 0;
    if (failed === shouldFail) ok += 1;
  }
  console.log(`[etf-charts] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) run();

module.exports = { validate, run };
