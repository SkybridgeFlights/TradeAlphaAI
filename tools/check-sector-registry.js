'use strict';

// Phase 205 / Workstream I — check:sector-registry.
// Validates the sector registry integrity AND the sector chart manifest:
// real sourced OHLCV only (hash recomputes, as_of = last bar, approved provider),
// on-disk responsive bilingual SVGs, honest unavailable entries, no placeholder
// charts, no fabricated availability. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SECTORS } = require('./sector-registry');
const { MIN_BARS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'sector-charts.json');
const ARABIC = /[؀-ۿ]/;
const GROUPS = new Set(['growth', 'cyclical', 'defensive', 'rate_sensitive']);
const APPROVED = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo', 'Approved fixture', 'cached']);
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function validateRegistry() {
  const f = [];
  if (SECTORS.length !== 10) f.push(`expected 10 sectors, got ${SECTORS.length}`);
  const syms = new Set(); const slugs = new Set();
  for (const s of SECTORS) {
    if (syms.has(s.symbol)) f.push(`duplicate symbol ${s.symbol}`); syms.add(s.symbol);
    if (slugs.has(s.slug)) f.push(`duplicate slug ${s.slug}`); slugs.add(s.slug);
    if (!s.name_en || !s.name_ar || !ARABIC.test(s.name_ar)) f.push(`${s.symbol}: missing native bilingual name`);
    if (!s.role_en || !s.role_ar || !ARABIC.test(s.role_ar)) f.push(`${s.symbol}: missing native bilingual role`);
    if (!GROUPS.has(s.group)) f.push(`${s.symbol}: invalid group "${s.group}"`);
    if (!Array.isArray(s.related_assets) || !s.related_assets.length) f.push(`${s.symbol}: missing related_assets`);
  }
  return f;
}

function validateManifest(m, opts = {}) {
  const f = [];
  if (!m || typeof m !== 'object') return ['manifest not an object'];
  if (m.schema_version !== '1.0') f.push(`unexpected schema_version ${m.schema_version}`);
  if (!['available', 'partial', 'unavailable'].includes(m.status)) f.push(`invalid status ${m.status}`);
  const charts = Array.isArray(m.charts) ? m.charts : [];
  const unavailable = Array.isArray(m.unavailable) ? m.unavailable : [];
  if (m.status === 'unavailable' && charts.length) f.push('status unavailable but charts present');
  if (m.status === 'available' && (!charts.length || unavailable.length)) f.push('status available but charts missing or some unavailable');
  const regSyms = new Set(SECTORS.map((s) => s.symbol));
  for (const u of unavailable) { if (!u.symbol || !u.reason) f.push('unavailable entry missing symbol/reason'); if (u.symbol && !regSyms.has(u.symbol)) f.push(`unavailable for non-sector ${u.symbol}`); }
  for (const c of charts) {
    const id = c.id || c.symbol || '?';
    if (!regSyms.has(c.symbol)) f.push(`${id}: chart for non-sector symbol ${c.symbol}`);
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
  T('registry clean', validateRegistry().length === 0);
  if (m) {
    T('manifest clean', validateManifest(m).length === 0);
    const t1 = JSON.parse(JSON.stringify(m)); if (t1.charts[0]) t1.charts[0].series_hash = 'deadbeef';
    T('tampered hash rejected', validateManifest(t1, { skipSvg: true }).length > 0);
    const t2 = JSON.parse(JSON.stringify(m)); if (t2.charts[0]) { t2.charts[0].symbol = 'DOGE'; }
    T('non-sector symbol rejected', validateManifest(t2, { skipSvg: true }).length > 0);
    const t3 = JSON.parse(JSON.stringify(m)); if (t3.charts[0]) { t3.charts[0].attribution.provider = 'TradingView'; }
    T('bad provider rejected', validateManifest(t3, { skipSvg: true }).length > 0);
    const t4 = JSON.parse(JSON.stringify(m)); if (t4.charts[0]) { t4.charts[0].series = t4.charts[0].series.slice(0, 10); t4.charts[0].series_hash = sha256(JSON.stringify(t4.charts[0].series)); }
    T('too few bars rejected', validateManifest(t4, { skipSvg: true }).length > 0);
  }
  console.log(`[sector-registry] self-test: ${ok}/${total} passed`);
  process.exit(ok === total ? 0 : 1);
}

if (require.main === module) {
  const failures = validateRegistry();
  if (fs.existsSync(MANIFEST)) { try { failures.push(...validateManifest(JSON.parse(fs.readFileSync(MANIFEST, 'utf8')))); } catch (e) { failures.push(`malformed manifest JSON: ${e.message}`); } }
  if (failures.length) { failures.forEach((m) => console.error(`[sector-registry] FAIL: ${m}`)); process.exit(1); }
  console.log('[sector-registry] check:sector-registry passed (10 sectors; chart manifest sourced, hash-verified, responsive, bilingual, no placeholder).');
}

module.exports = { validateRegistry, validateManifest };
