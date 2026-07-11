'use strict';

/*
 * Phase 1B/1D (SYSTEM B) — public-performance consumer tests.
 * Standalone Node runner (repo has no jest). Exercises the PURE core against
 * synthetic fixtures + an injected fetch (no network) and the Phase 1D
 * integrity path (real SHA-256 via node:crypto). Proves admin-safety,
 * allowlisting, hash/size integrity, staleness, null handling,
 * insufficient-sample warnings, base-URL protocol safety, weekly null state,
 * and that no secret/admin/fixture leaks into production output.
 *
 * Run: node tests/public-performance-consumer.test.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PP = require('../js/public-performance-data.js');

const FIX = path.join(__dirname, 'fixtures', 'public-performance');
const NOW = Date.parse('2026-07-11T12:00:00Z');

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error('  ✗ FAIL:', name); } }
function readFix(f) { return JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')); }
function bytesFix(f) { return fs.readFileSync(path.join(FIX, f)); }
function hashOf(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

// Build a valid manifest object referencing the given contract-name → fixture-file
// map, with REAL sha256 + size, so the integrity path can pass.
function buildManifest(map) {
  const files = Object.keys(map).filter(function (n) { return n !== 'public_manifest.json' && map[n] !== 'THROW'; })
    .map(function (name) { const b = Buffer.isBuffer(map[name]) ? map[name] : bytesFix(map[name]); return { name: name, sha256: hashOf(b), size_bytes: b.length, schema_version: '1.0.0' }; });
  return { transport_version: '1.0.0', generated_at: '2026-07-11T06:00:00Z', files: files };
}
// Injected loaders. `manifest` may be overridden (e.g. tampered). Tracks calls.
function makeLoaders(map, manifestObj, calls) {
  const getJson = function (url) {
    if (calls) calls.push('json:' + String(url).split('/').pop());
    return Promise.resolve().then(function () {
      const name = String(url).split('/').pop();
      if (name !== 'public_manifest.json') throw new Error('unexpected getJson');
      if (map['public_manifest.json'] === 'THROW') throw new Error('HTTP 404');
      return manifestObj || buildManifest(map);
    });
  };
  const getBytes = function (url) {
    const name = String(url).split('/').pop();
    if (calls) calls.push('bytes:' + name);
    return Promise.resolve().then(function () {
      const v = map[name];
      if (v === undefined || v === 'THROW') throw new Error('HTTP 404');
      if (Buffer.isBuffer(v)) return v; // inline bytes
      return bytesFix(v);
    });
  };
  return { getJson: getJson, getBytes: getBytes };
}

// ── PURE: filename / URL / base-url safety ────────────────────────────────
ok('allowlist = 3 public files', PP.ALLOWED_FILES.length === 3 && PP.isSafePublicFilename('public_performance_summary.json'));
ok('manifest filename accepted', PP.isSafePublicFilename('public_manifest.json'));
ok('admin_research_health rejected', !PP.isSafePublicFilename('admin_research_health.json'));
ok('admin_phase3_readiness rejected', !PP.isSafePublicFilename('admin_phase3_readiness.json'));
ok('path traversal rejected', !PP.isSafePublicFilename('../secret.json'));
ok('scheme URL filename rejected', !PP.isSafePublicFilename('http://evil/x.json'));
ok('(21) javascript: base rejected', !PP.isSafeBaseUrl('javascript:alert(1)'));
ok('(21) data: base rejected', !PP.isSafeBaseUrl('data:text/html,x'));
ok('(21) file: base rejected', !PP.isSafeBaseUrl('file:///etc/passwd'));
ok('(21) http non-localhost rejected', !PP.isSafeBaseUrl('http://evil.example.com/'));
ok('(1) real https blob base accepted', PP.isSafeBaseUrl('https://wqtmrs9dqyxfnrlc.public.blob.vercel-storage.com'));
ok('base with traversal rejected', !PP.isSafeBaseUrl('https://x/..%2f'));
ok('buildSnapshotUrl joins base+file', PP.buildSnapshotUrl('https://cdn.example.com/perf/', 'public_manifest.json') === 'https://cdn.example.com/perf/public_manifest.json');
let tA = false; try { PP.buildSnapshotUrl('https://x/', 'admin_research_health.json'); } catch (e) { tA = true; } ok('buildSnapshotUrl refuses admin', tA);
let tB = false; try { PP.buildSnapshotUrl('javascript:x', 'public_manifest.json'); } catch (e) { tB = true; } ok('buildSnapshotUrl refuses unsafe base', tB);

// ── PURE: manifest / envelope / staleness / normalization ─────────────────
ok('valid manifest passes', PP.validateManifest(readFix('manifest.valid.json'), NOW).ok);
const admMani = PP.validateManifest(readFix('manifest.admin_ref.json'), NOW);
ok('(4) admin-referencing manifest rejected', !admMani.ok && admMani.errors.join(' ').indexOf('non-allowlisted') !== -1);
ok('admin manifest excludes admin from entries', !admMani.entries['admin_research_health.json']);
ok('malformed manifest rejected', !PP.validateManifest(readFix('manifest.malformed.json'), NOW).ok);
ok('(10) wrong schema_version rejected', !PP.validateEnvelope(readFix('system_summary.wrong_schema.json'), NOW).ok);
ok('future timestamp rejected', !PP.validateEnvelope(readFix('performance.future_ts.json'), NOW).ok);
ok('(9) admin privacy rejected', !PP.validateEnvelope({ schema_version: '1.0.0', generated_at: '2026-07-11T06:00:00Z', freshness_seconds: 10, privacy: 'admin', source: 'x', payload: {} }, NOW).ok);
ok('(11) fresh not stale / old stale', !PP.isStale(readFix('system_summary.valid.json'), NOW) && PP.isStale(readFix('system_summary.stale.json'), NOW));
const perfIns = PP.normalizePerformance(readFix('performance.insufficient.json').payload);
ok('(13) insufficient sample flagged', perfIns.systems[0].sample_status === 'insufficient' && perfIns.systems[0].insufficient_sample === true);
const perfNull = PP.normalizePerformance(readFix('performance.null_metrics.json').payload);
ok('(12) null metrics stay null (not 0)', perfNull.systems[0].win_rate_pct === null && perfNull.systems[0].profit_factor === null && perfNull.systems[0].closed_trades === null);
ok('sampleStatusFor thresholds', PP.sampleStatusFor(10) === 'insufficient' && PP.sampleStatusFor(55) === 'preliminary' && PP.sampleStatusFor(150) === 'developing' && PP.sampleStatusFor(300) === 'mature');
ok('(18) MAX_CACHE_AGE_MS is 6h', PP.MAX_CACHE_AGE_MS === 6 * 60 * 60 * 1000);
ok('EXPECTED_SOURCE constant matches contract', PP.EXPECTED_SOURCE === 'tradealpha.snapshot_exporter');

// ── fetchVerified: hash / size integrity ──────────────────────────────────
function runVerifiedTests() {
  const b = bytesFix('system_summary.valid.json');
  const good = { sha256: hashOf(b), size_bytes: b.length };
  return PP.fetchVerified('https://x/public_system_summary.json', good, { getBytes: function () { return Promise.resolve(b); } })
    .then(function (obj) { ok('(5) hash+size match passes', obj && obj.schema_version === '1.0.0'); })
    .then(function () {
      return PP.fetchVerified('https://x/f.json', { sha256: 'deadbeef'.repeat(8), size_bytes: b.length }, { getBytes: function () { return Promise.resolve(b); } })
        .then(function () { ok('(6) hash mismatch rejects', false); }, function (e) { ok('(6) hash mismatch rejects', /mismatch/.test(e.message)); });
    })
    .then(function () {
      return PP.fetchVerified('https://x/f.json', { sha256: hashOf(b), size_bytes: b.length + 5 }, { getBytes: function () { return Promise.resolve(b); } })
        .then(function () { ok('(7) size mismatch rejects', false); }, function (e) { ok('(7) size mismatch rejects', /mismatch/.test(e.message)); });
    });
}

// ── load(): full integrity flow with injected loaders ─────────────────────
const happyMap = {
  'public_manifest.json': 'MANIFEST',
  'public_system_summary.json': 'system_summary.valid.json',
  'public_performance_summary.json': 'performance.insufficient.json',
  'public_weekly_research.json': 'weekly.valid.json',
};

function runLoadTests() {
  const calls = [];
  const L1 = makeLoaders(happyMap, null, calls);
  return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L1.getJson, getBytes: L1.getBytes }).then(function (r) {
    ok('load ok on happy path', r.ok === true && r.performance && r.performance.systems.length === 2 && !!r.system && !!r.weekly);
    ok('(11) not stale on fresh data', r.stale === false);
    ok('(2) manifest fetched first', calls[0] === 'json:public_manifest.json');
    ok('(3) exactly three snapshot requests', calls.filter(function (c) { return c.indexOf('bytes:') === 0; }).length === 3);
    ok('(4) admin never requested', calls.every(function (c) { return c.indexOf('admin') === -1; }));

    // (17) manifest failure blocks all snapshots
    const cThr = []; const Lthr = makeLoaders({ 'public_manifest.json': 'THROW' }, null, cThr);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: Lthr.getJson, getBytes: Lthr.getBytes }).then(function (r2) {
      ok('(17) manifest failure => transport unavailable, no snapshots', r2.errors.join(' ').indexOf('transport unavailable') !== -1 && cThr.filter(function (c) { return c.indexOf('bytes:') === 0; }).length === 0);
    });
  }).then(function () {
    // (16) partial file failure: manifest lists all three, but weekly bytes fail.
    const fullMan = buildManifest(happyMap);
    const pMap = Object.assign({}, happyMap, { 'public_weekly_research.json': 'THROW' });
    const L = makeLoaders(pMap, fullMan, null);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(16) partial availability degrades', r.partial === true && r.weekly === null && !!r.performance);
    });
  }).then(function () {
    // (6) hash mismatch inside load => integrity_error, section rejected
    const man = buildManifest(happyMap);
    man.files.forEach(function (f) { if (f.name === 'public_performance_summary.json') f.sha256 = 'a'.repeat(64); });
    const L = makeLoaders(happyMap, man, null);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(6) load integrity mismatch => performance rejected', r.integrity_error === true && r.performance === null);
    });
  }).then(function () {
    // (8) malformed JSON with matching integrity => rejected safely
    const bad = Buffer.from('{ this is not valid json ');
    const map = Object.assign({}, happyMap, { 'public_performance_summary.json': bad });
    const L = makeLoaders(map, null, null);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(8) malformed JSON rejected, no figures', r.performance === null && r.partial === true);
    });
  }).then(function () {
    // (9) privacy != public with valid integrity => ingest rejects
    const badPriv = Buffer.from(JSON.stringify({ schema_version: '1.0.0', generated_at: '2026-07-11T06:00:00Z', freshness_seconds: 100, privacy: 'admin', source: 'x', payload: { as_of: 'x', systems: [] } }));
    const map = Object.assign({}, happyMap, { 'public_performance_summary.json': badPriv });
    const L = makeLoaders(map, null, null);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(9) privacy!=public rejected', r.performance === null && r.partial === true);
    });
  }).then(function () {
    // (10) wrong schema via load
    const map = Object.assign({}, happyMap, { 'public_system_summary.json': 'system_summary.wrong_schema.json' });
    const L = makeLoaders(map, null, null);
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(10) wrong-schema snapshot rejected', r.system === null);
    });
  }).then(function () {
    // (21) invalid base protocol never fetches
    const calls = []; const L = makeLoaders(happyMap, null, calls);
    return PP.load('javascript:alert(1)', { nowMs: NOW, fetchJson: L.getJson, getBytes: L.getBytes }).then(function (r) {
      ok('(21) invalid base url blocks all fetches', r.errors.indexOf('invalid base url') !== -1 && calls.length === 0);
    });
  });
}

// ── render (DOM-free) ─────────────────────────────────────────────────────
function runRenderTests() {
  const L = PP._labels.en;
  const c1 = { innerHTML: '' };
  PP.render(c1, { performance: perfNull, system: null, weekly: null, stale: false }, 'en');
  ok('(12) render null => "Not available"', c1.innerHTML.indexOf(L.unavailable) !== -1 && c1.innerHTML.indexOf('>0<') === -1);

  const c2 = { innerHTML: '' };
  PP.render(c2, { performance: perfIns, system: null, weekly: null, stale: false }, 'en');
  ok('(13) render insufficient warning', c2.innerHTML.indexOf('Insufficient sample') !== -1);
  ok('(14) closed-trade count beside WR/PF', c2.innerHTML.indexOf(L.closedTrades) !== -1 && c2.innerHTML.indexOf(L.winRate) !== -1 && c2.innerHTML.indexOf(L.profitFactor) !== -1);
  ok('render no promotional words', !/proven|guaranteed|verified success|profitable|superior/i.test(c2.innerHTML));
  ok('render carries "Not independently audited"-style wording only via system header', c2.innerHTML.indexOf('audited') === -1); // no system => no audit line here

  const c3 = { innerHTML: '' };
  PP.render(c3, { performance: perfIns, system: null, weekly: null, stale: true }, 'en');
  ok('(11) render stale banner', c3.innerHTML.indexOf(L.staleBanner) !== -1);

  const c4 = { innerHTML: '' };
  PP.render(c4, { performance: null, system: null, weekly: null }, 'en');
  ok('render failure => unavailable, no fixture value', c4.innerHTML.indexOf(L.dataUnavailable) !== -1 && c4.innerHTML.indexOf('58.33') === -1);

  const c5 = { innerHTML: '' };
  PP.render(c5, { performance: perfIns, system: null, weekly: null, stale: false }, 'ar');
  ok('(20) Arabic warning + disclaimer', c5.innerHTML.indexOf('حجم العينة غير كافٍ') !== -1 && c5.innerHTML.indexOf('ليس نصيحة استثمارية') !== -1);

  // (24) weekly null state
  const weeklyNull = PP.normalizeWeekly({ week_start: '2026-07-04', week_end: '2026-07-10', title_en: null, summary_en: null, title_ar: null, summary_ar: null, data_collected: {}, public_observations: [] });
  const c6 = { innerHTML: '' };
  PP.render(c6, { performance: perfIns, system: null, weekly: weeklyNull }, 'en');
  ok('(24) weekly null => "not yet available"', c6.innerHTML.indexOf(L.weeklyUnavailable) !== -1);

  // system status header wording
  const sysView = PP.normalizeSystemSummary(readFix('system_summary.valid.json').payload);
  const c7 = { innerHTML: '' };
  PP.render(c7, { performance: perfIns, system: sysView, weekly: null, generated_at: '2026-07-11T06:00:00Z' }, 'en');
  ok('status header shows verified-source + not-audited wording', c7.innerHTML.indexOf('schema 1.0 research logs') !== -1 && c7.innerHTML.indexOf('not independently audited') !== -1);
}

// ── production-output safety scans ────────────────────────────────────────
function runScanTests() {
  const jsDir = path.join(__dirname, '..', 'js');
  const prodJs = ['public-performance-data.js', 'public-performance-config.js'].map(function (f) { return fs.readFileSync(path.join(jsDir, f), 'utf8'); }).join('\n');
  ok('(23) no admin snapshot filename in production JS', prodJs.indexOf('admin_research_health.json') === -1 && prodJs.indexOf('admin_phase3_readiness.json') === -1);
  ok('(19) no SYNTHETIC_FIXTURE marker in production JS', prodJs.indexOf('SYNTHETIC_FIXTURE') === -1);
  ok('(22) no write token / secret in production JS', !/BLOB_READ_WRITE_TOKEN|R2_SECRET|R2_ACCESS_KEY|sk-[a-z0-9]/i.test(prodJs));
  const perfHtml = fs.readFileSync(path.join(__dirname, '..', 'performance', 'tradealpha-ai.html'), 'utf8');
  ok('(23) performance page references no admin snapshot', perfHtml.indexOf('admin_research_health') === -1 && perfHtml.indexOf('admin_phase3') === -1);
  ok('(22) no write token in performance HTML', perfHtml.indexOf('BLOB_READ_WRITE_TOKEN') === -1);
  ok('(25) performance HTML has data-public-performance container', perfHtml.indexOf('data-public-performance') !== -1);
  const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'public-performance.css'), 'utf8');
  ok('(25) mobile media query present in CSS', css.indexOf('@media') !== -1 && css.indexOf('max-width') !== -1);
}

// ── Phase 1E: historical_record (additive, backward-compatible) ───────────
function runHistoricalTests() {
  const L = PP._labels.en;
  const withHistPayload = readFix('performance.with_historical.json').payload;
  const norm = PP.normalizePerformance(withHistPayload);
  const gold = norm.systems[0];
  const qqq = norm.systems[1];

  ok('(H1) historical absent => null (backward compat)', PP.normalizePerformance(readFix('performance.insufficient.json').payload).systems[0].historical_record === null);
  ok('(H1b) per-system optional: QQQ has no historical', qqq.historical_record === null);
  ok('(H2) available=true parsed', gold.historical_record && gold.historical_record.available === true && gold.historical_record.closed_trades === 20);
  ok('(H4) verified (2) vs historical (20) kept separate', gold.closed_trades === 2 && gold.historical_record.closed_trades === 20);
  ok('(H4b) data_quality legacy/schema split', gold.historical_record.data_quality.schema_1_closed_trades === 2 && gold.historical_record.data_quality.legacy_closed_trades === 18);

  const c = { innerHTML: '' };
  PP.render(c, { performance: norm, system: null, weekly: null }, 'en');
  const h = c.innerHTML;
  ok('(H2r) Historical section rendered', h.indexOf('Historical Research Record') !== -1);
  ok('(H3v) Verified Schema 1.0 label present', h.indexOf('Verified Schema 1.0 Research Record') !== -1);
  ok('(H9) neutral historical badge (not green/verified)', h.indexOf('Historical / Legacy coverage') !== -1);
  ok('(H7) legacy warning EN present', h.indexOf('Includes legacy pre-schema data') !== -1);
  ok('(H5) non-null historical PnL shows $202.80', h.indexOf('$202.80') !== -1);
  ok('(H11) legacy + schema-1 counts labelled', h.indexOf('Schema 1.0 closed trades') !== -1 && h.indexOf('Legacy closed trades') !== -1);
  ok('(H10) independently_audited=false shown clearly', h.indexOf('No — internally generated') !== -1);
  ok('(H12) closed-count beside historical WR/PF', h.indexOf(L.closedTrades) !== -1 && h.indexOf(L.winRate) !== -1 && h.indexOf(L.profitFactor) !== -1);
  ok('(H13) historical <30 => limited-sample warning', h.indexOf('Limited historical sample') !== -1);
  ok('(H14) schema-1 insufficient warning unchanged', h.indexOf('Insufficient sample') !== -1);
  ok('(H15) no balances/positions/account IDs', !/balance|equity_usd|buying_power|open_pnl|position_qty|account_id/i.test(h));
  ok('(H3promo) no legacy promotional wording', !/\bproven\b|guaranteed|audited performance|stable edge|live account proof/i.test(h));

  const car = { innerHTML: '' };
  PP.render(car, { performance: norm, system: null, weekly: null }, 'ar');
  ok('(H8) legacy warning AR present (RTL)', car.innerHTML.indexOf('يتضمن بيانات تاريخية سابقة للمخطط 1.0') !== -1 && car.innerHTML.indexOf('السجل البحثي التاريخي') !== -1);

  const goldFalse = Object.assign({}, gold, { historical_record: PP.normalizeHistorical({ available: false }) });
  const c3 = { innerHTML: '' };
  PP.render(c3, { performance: { as_of: 'x', systems: [goldFalse] }, system: null, weekly: null }, 'en');
  ok('(H3) available=false => neutral unavailable, no metrics', c3.innerHTML.indexOf('Historical research record not available') !== -1 && c3.innerHTML.indexOf('$202.80') === -1);

  const histNull = PP.normalizeHistorical(Object.assign({}, withHistPayload.systems[0].historical_record, { pnl_usd: null }));
  const goldNull = Object.assign({}, gold, { historical_record: histNull });
  const c6 = { innerHTML: '' };
  PP.render(c6, { performance: { as_of: 'x', systems: [goldNull] }, system: null, weekly: null }, 'en');
  ok('(H6) null historical PnL => "Not available", never $ or 0', c6.innerHTML.indexOf('PnL (USD)') !== -1 && c6.innerHTML.indexOf('$') === -1 && c6.innerHTML.indexOf(L.unavailable) !== -1);

  const cNo = { innerHTML: '' };
  PP.render(cNo, { performance: PP.normalizePerformance(readFix('performance.insufficient.json').payload), system: null, weekly: null }, 'en');
  ok('(H16) no historical_record => no historical section, no errors', cNo.innerHTML.indexOf('Historical Research Record') === -1);
}

runVerifiedTests()
  .then(runLoadTests)
  .then(function () { runRenderTests(); runScanTests(); runHistoricalTests(); })
  .then(function () {
    console.log('\n[public-performance-consumer] ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch(function (e) { console.error('UNCAUGHT', e); process.exit(1); });
