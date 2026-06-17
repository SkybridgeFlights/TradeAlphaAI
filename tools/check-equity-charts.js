'use strict';

// Phase 206 / Workstream J — check:equity-charts.
// Anti-fabrication gate for the equity chart manifest (data/visual/equity-charts.json)
// + SVGs: real sourced OHLCV only (hash recomputes, as_of = last bar, approved
// provider), on-disk responsive bilingual SVGs, honest unavailable, no placeholder.
// Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EQUITIES } = require('./equity-registry');
const { MIN_BARS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'equity-charts.json');
const ARABIC = /[؀-ۿ]/;
const APPROVED = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo', 'Approved fixture', 'cached']);
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function validateManifest(m, opts = {}) {
  const f = [];
  if (!m || typeof m !== 'object') return ['manifest not an object'];
  if (m.schema_version !== '1.0') f.push(`unexpected schema_version ${m.schema_version}`);
  if (!['available', 'partial', 'unavailable'].includes(m.status)) f.push(`invalid status ${m.status}`);
  const charts = Array.isArray(m.charts) ? m.charts : [];
  const unavailable = Array.isArray(m.unavailable) ? m.unavailable : [];
  if (m.status === 'unavailable' && charts.length) f.push('status unavailable but charts present');
  if (m.status === 'available' && (!charts.length || unavailable.length)) f.push('status available but charts missing or some unavailable');
  const reg = new Set(EQUITIES.map((e) => e.symbol));
  for (const u of unavailable) { if (!u.symbol || !u.reason) f.push('unavailable entry missing symbol/reason'); if (u.symbol && !reg.has(u.symbol)) f.push(`unavailable for non-equity ${u.symbol}`); }
  for (const c of charts) {
    const id = c.id || c.symbol || '?';
    if (!reg.has(c.symbol)) f.push(`${id}: chart for non-equity symbol ${c.symbol}`);
    if (!c.title_en || !c.title_ar || !ARABIC.test(c.title_ar)) f.push(`${id}: missing native bilingual title`);
    const series = Array.isArray(c.series) ? c.series : [];
    if (series.length < MIN_BARS) f.push(`${id}: ${series.length} bars < ${MIN_BARS}`);
    for (const b of series) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date))) { f.push(`${id}: bad bar date`); break; }
      if (![b.open, b.high, b.low, b.close].every((v) => typeof v === 'number' && Number.isFinite(v))) { f.push(`${id}: non-finite OHLC`); break; }
      if (b.low > b.high || b.open < b.low || b.open > b.high || b.close < b.low || b.close > b.high) { f.push(`${id}: impossible OHLC bar (${b.date})`); break; }
    }
    if (c.series_hash !== sha256(JSON.stringify(series))) f.push(`${id}: series_hash does not recompute (fabricated/tampered)`);
    if (series.length && c.as_of !== series[series.length - 1].date) f.push(`${id}: as_of != last bar`);
    const a = c.attribution || {};
    if (!APPROVED.has(a.provider)) f.push(`${id}: provider "${a.provider}" not approved`);
    if (c.verified !== true) f.push(`${id}: not marked verified`);
    if (!opts.skipSvg) {
      for (const loc of ['en', 'ar']) {
        const rel = c.files && c.files[loc];
        if (!rel) { f.push(`${id}: missing ${loc} file ref`); continue; }
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) { f.push(`${id}: ${loc} SVG missing on disk (placeholder/unavailable rendered as charted)`); continue; }
        const svg = fs.readFileSync(abs, 'utf8');
        if (!/viewBox="0 0 \d+ \d+"/.test(svg)) f.push(`${id}: ${loc} SVG not responsive`);
        if (/<svg\b[^>]*\b(width|height)="\d/.test(svg)) f.push(`${id}: ${loc} SVG has fixed root size`);
        if (!svg.includes(`data-series-hash="${c.series_hash}"`)) f.push(`${id}: ${loc} SVG hash mismatch`);
        if (loc === 'ar' && !/direction="rtl"/.test(svg)) f.push(`${id}: AR SVG not RTL`);
        const txt = svg.replace(/<[^>]+>/g, ' ');
        if (!/(Source|المصدر)/.test(txt)) f.push(`${id}: ${loc} SVG missing source`);
        if (!/(As of|حتى|بتاريخ)/.test(txt)) f.push(`${id}: ${loc} SVG missing as-of`);
      }
    }
  }
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const m = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : null;
  let ok = 0; let total = 0;
  const T = (n, c) => { total += 1; if (c) ok += 1; else console.error(`SELF-TEST FAIL: ${n}`); };
  if (m) {
    T('manifest clean', validateManifest(m).length === 0);
    const t1 = JSON.parse(JSON.stringify(m)); if (t1.charts[0]) t1.charts[0].series_hash = 'deadbeef';
    T('tampered hash rejected', validateManifest(t1, { skipSvg: true }).length > 0);
    const t2 = JSON.parse(JSON.stringify(m)); if (t2.charts[0]) t2.charts[0].symbol = 'DOGE';
    T('non-equity symbol rejected', validateManifest(t2, { skipSvg: true }).length > 0);
    const t3 = JSON.parse(JSON.stringify(m)); if (t3.charts[0]) t3.charts[0].attribution.provider = 'TradingView';
    T('bad provider rejected', validateManifest(t3, { skipSvg: true }).length > 0);
    const t4 = JSON.parse(JSON.stringify(m)); if (t4.charts[0]) { t4.charts[0].series = t4.charts[0].series.slice(0, 10); t4.charts[0].series_hash = sha256(JSON.stringify(t4.charts[0].series)); }
    T('too few bars rejected', validateManifest(t4, { skipSvg: true }).length > 0);
  } else { T('manifest present', false); }
  console.log(`[equity-charts] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(MANIFEST)) { console.log('[equity-charts] no manifest yet (non-fatal).'); process.exit(0); }
  let m; try { m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { console.error(`[equity-charts] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validateManifest(m);
  if (failures.length) { failures.forEach((x) => console.error(`[equity-charts] FAIL: ${x}`)); process.exit(1); }
  console.log(`[equity-charts] check:equity-charts passed (${m.charts.length} chart(s); sourced, hash-verified, responsive, bilingual, no placeholder).`);
}

module.exports = { validateManifest };
