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
// Immutable variant: same entries + a valid snapshots/<release>/<name> path.
function buildImmutableManifest(map, releaseId) {
  const m = buildManifest(map);
  m.files.forEach(function (f) { f.path = 'snapshots/' + releaseId + '/' + f.name; });
  return m;
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
  const Lar = PP._labels.ar;
  const c1 = { innerHTML: '' };
  PP.render(c1, { performance: perfNull, system: null, weekly: null, stale: false }, 'en');
  ok('(12) null hero metric => omitted, never shown as unavailable tile', c1.innerHTML.indexOf('pp-big pp-na') === -1);

  const c2 = { innerHTML: '' };
  PP.render(c2, { performance: perfIns, system: null, weekly: null, stale: false }, 'en');
  ok('(13) sample context preserved in collapsible ⓘ panel', c2.innerHTML.indexOf(L.aboutData) !== -1 && c2.innerHTML.indexOf(L.infoSample) !== -1);
  ok('(14) closed-trade count beside WR/PF (hero)', c2.innerHTML.indexOf(L.totalClosedTrades) !== -1 && c2.innerHTML.indexOf(L.winRate) !== -1 && c2.innerHTML.indexOf(L.profitFactor) !== -1);
  ok('render no promotional words', !/\bproven\b|guaranteed|verified success|profitable|superior/i.test(c2.innerHTML));
  ok('not-audited disclosure kept (in ⓘ, not a banner)', c2.innerHTML.indexOf(L.infoAudit) !== -1);
  ok('trust row present', c2.innerHTML.indexOf(L.trustPublic) !== -1 && c2.innerHTML.indexOf(L.trustMethod) !== -1);
  ok('premium card identity and subtitle present', c2.innerHTML.indexOf('pp-strategy-identity') !== -1 && /AI-powered/.test(c2.innerHTML));
  ok('exactly four hero metrics per strategy', (c2.innerHTML.match(/class="pp-big /g) || []).length === perfIns.systems.length * 4);
  ok('outcome visualization uses existing closed-trade counts', c2.innerHTML.indexOf('pp-outcome-track') !== -1 && c2.innerHTML.indexOf(L.outcomeMix) !== -1);
  ok('strategy CTAs and icon chips present', c2.innerHTML.indexOf(L.exploreStrategy) !== -1 && c2.innerHTML.indexOf(L.learnMethodology) !== -1 && c2.innerHTML.indexOf('pp-icon') !== -1);
  ok('modern disclosure accordion structure present', c2.innerHTML.indexOf('pp-info-reveal') !== -1 && c2.innerHTML.indexOf('pp-info-chevron') !== -1);
  ok('no dominating warning-box classes', c2.innerHTML.indexOf('pp-sample-warning') === -1 && c2.innerHTML.indexOf('pp-hist-warning') === -1);

  const c3 = { innerHTML: '' };
  PP.render(c3, { performance: perfIns, system: null, weekly: null, stale: true }, 'en');
  ok('(11) stale notice shown', c3.innerHTML.indexOf(L.staleBanner) !== -1);

  const c4 = { innerHTML: '' };
  PP.render(c4, { performance: null, system: null, weekly: null }, 'en');
  ok('render failure => unavailable, no fixture value', c4.innerHTML.indexOf(L.dataUnavailable) !== -1 && c4.innerHTML.indexOf('58.33') === -1);

  const c5 = { innerHTML: '' };
  PP.render(c5, { performance: perfIns, system: null, weekly: null, stale: false }, 'ar');
  ok('(20) Arabic footnote + ⓘ present', c5.innerHTML.indexOf('ليس نصيحة استثمارية') !== -1 && c5.innerHTML.indexOf(Lar.infoAudit) !== -1);
  ok('(20b) AR render carries NO English metric labels (language pure)', c5.innerHTML.indexOf('Win rate') === -1 && c5.innerHTML.indexOf('Total Closed Trades') === -1 && c5.innerHTML.indexOf('About this data') === -1);

  const weeklyNull = PP.normalizeWeekly({ week_start: '2026-07-04', week_end: '2026-07-10', title_en: null, summary_en: null, title_ar: null, summary_ar: null, data_collected: {}, public_observations: [] });
  const c6 = { innerHTML: '' };
  PP.render(c6, { performance: perfIns, system: null, weekly: weeklyNull }, 'en');
  ok('(24) weekly null => "not yet available"', c6.innerHTML.indexOf(L.weeklyUnavailable) !== -1);

  const c7 = { innerHTML: '' };
  PP.render(c7, { performance: perfIns, system: null, weekly: null }, 'en');
  ok('footnote present (single, small, non-alarming)', c7.innerHTML.indexOf(L.footNote) !== -1);
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
  ok('(B1) backtest is visually separated from live records', perfHtml.indexOf('backtest-card') !== -1 && perfHtml.indexOf('perf.backtest.state') !== -1);
  ok('(B2) backtest keeps methodology in accordion', perfHtml.indexOf('backtest-info') !== -1 && perfHtml.indexOf('perf.backtest.disclaimer1') !== -1);
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

  const Lar = PP._labels.ar;
  const c = { innerHTML: '' };
  PP.render(c, { performance: norm, system: null, weekly: null }, 'en');
  const h = c.innerHTML;
  ok('(H2r) historical track record is the hero (Net Profit shown)', h.indexOf(L.netProfit) !== -1 && h.indexOf('$202.80') !== -1);
  ok('(H3v) verified subset visible (Schema 1.0 Trades)', h.indexOf(L.schema1Trades) !== -1);
  ok('(H9) neutral research-history source, no "verified" badge', h.indexOf(L.researchHistory) !== -1 && h.indexOf('pp-badge-mature') === -1);
  ok('(H7) legacy composition disclosed in ⓘ', h.indexOf(L.infoHistory) !== -1);
  ok('(H5) non-null historical PnL shows $202.80', h.indexOf('$202.80') !== -1);
  ok('(H11) schema-1 + legacy composition remains in disclosure', h.indexOf(L.schema1Trades) !== -1 && h.indexOf(L.legacyCount) !== -1 && h.indexOf('pp-info-body') !== -1);
  ok('(H10) not-audited disclosure kept in ⓘ', h.indexOf(L.infoAudit) !== -1);
  ok('(H12) closed-count beside historical WR/PF (hero)', h.indexOf(L.totalClosedTrades) !== -1 && h.indexOf(L.winRate) !== -1 && h.indexOf(L.profitFactor) !== -1);
  ok('(H13) sample context preserved in ⓘ', h.indexOf(L.infoSample) !== -1);
  ok('(H14) verified schema-1 count remains visible', h.indexOf(L.schema1Trades) !== -1 && h.indexOf('2') !== -1);
  ok('(H15) no balances/positions/account IDs', !/equity_usd|buying_power|open_pnl|position_qty|account_id|order_id/i.test(h));
  ok('(H3promo) no promotional wording', !/\bproven\b|guaranteed|audited performance|stable edge|live account proof/i.test(h));

  const car = { innerHTML: '' };
  PP.render(car, { performance: norm, system: null, weekly: null }, 'ar');
  ok('(H8) Arabic research source present, language pure', car.innerHTML.indexOf(Lar.researchHistory) !== -1 && car.innerHTML.indexOf(Lar.infoHistory) !== -1 && car.innerHTML.indexOf('Net Profit') === -1);

  const goldFalse = Object.assign({}, gold, { historical_record: PP.normalizeHistorical({ available: false }) });
  const c3 = { innerHTML: '' };
  PP.render(c3, { performance: { as_of: 'x', systems: [goldFalse] }, system: null, weekly: null }, 'en');
  ok('(H3) available=false => falls back to verified, no net profit', c3.innerHTML.indexOf(L.netProfit) === -1 && c3.innerHTML.indexOf('$202.80') === -1 && c3.innerHTML.indexOf(L.totalClosedTrades) !== -1);

  const histNull = PP.normalizeHistorical(Object.assign({}, withHistPayload.systems[0].historical_record, { pnl_usd: null }));
  const goldNull = Object.assign({}, gold, { historical_record: histNull });
  const c6 = { innerHTML: '' };
  PP.render(c6, { performance: { as_of: 'x', systems: [goldNull] }, system: null, weekly: null }, 'en');
  ok('(H6) null historical PnL => truthful R fallback, never $ or fake 0', c6.innerHTML.indexOf(L.expectancy) !== -1 && c6.innerHTML.indexOf('$') === -1);

  const cNo = { innerHTML: '' };
  PP.render(cNo, { performance: PP.normalizePerformance(readFix('performance.insufficient.json').payload), system: null, weekly: null }, 'en');
  ok('(H16) no historical_record => no Net Profit, neutral research source', cNo.innerHTML.indexOf(L.netProfit) === -1 && cNo.innerHTML.indexOf(L.researchHistory) !== -1);

  const investorHist = PP.normalizeHistorical({
    available: true, record_type: 'broker_execution_history', data_source_label_en: 'Broker execution history',
    data_source_label_ar: 'سجل تنفيذات الوسيط', live_since: '2026-05-26T14:02:10Z', closed_trades: 13, wins: 4, losses: 9,
    win_rate_pct: 30.8, profit_factor: 1.62, pnl_usd: 1195.86, net_realized_pnl_usd: 1195.51,
    realized_return_pct: 1.2, account_return_pct: 1.22, strategy_max_drawdown_pct: 1.54, account_max_drawdown_pct: 1.64,
    average_winner_usd: 781.14, average_loser_usd: 214.3, payoff_ratio: 3.65, expectancy_usd: 91.96,
    average_holding_minutes: 3294, average_holding_display_en: '2.3 days', average_holding_display_ar: '2.3 يوم',
    methodology_short_en: 'Based on completed Alpaca executions.', methodology_short_ar: 'استناداً إلى تنفيذات Alpaca المكتملة.',
    data_quality: { schema_1_closed_trades: 1, legacy_closed_trades: 12, join_success_pct: 100, critical_issues: 0 }
  });
  const investorSys = Object.assign({}, gold, { public_name: 'QQQ Strategy', historical_record: investorHist });
  const investor = { innerHTML: '' };
  PP.render(investor, { performance: { as_of: '2026-07-12T08:31:10Z', systems: [investorSys] }, system: null, weekly: null }, 'en');
  const ih = investor.innerHTML;
  ok('(I1) QQQ hero order: net profit, PF, win rate, drawdown', ih.indexOf(L.netRealizedProfit) < ih.indexOf(L.profitFactor) && ih.indexOf(L.profitFactor) < ih.indexOf(L.winRate) && ih.indexOf(L.winRate) < ih.indexOf(L.maxDrawdown));
  ok('(I2) supplied strategy return shown with headline net profit', ih.indexOf('+$1195.86') !== -1 && ih.indexOf('1.20%') !== -1);
  ok('(I3) account return separate and disclosure-only', ih.indexOf(L.accountReturn) !== -1 && ih.indexOf('1.22%') !== -1 && ih.indexOf('pp-info-body') < ih.indexOf(L.accountReturn));
  ok('(I4) investor details include averages + payoff + expectancy', ih.indexOf('$781.14') !== -1 && ih.indexOf('$214.30') !== -1 && ih.indexOf('3.65×') !== -1 && ih.indexOf('$91.96') !== -1);
  ok('(I5) human holding shown; raw minutes disclosure-only', ih.indexOf('2.3 days') !== -1 && ih.indexOf('3294') !== -1 && ih.indexOf('pp-info-body') < ih.indexOf('3294'));
  ok('(I6) schema metric absent from visible tile grid', !/pp-small[^>]*>[\s\S]*?Schema 1\.0 Trades/.test(ih.split('pp-info')[0]));
  ok('(I7) payoff explanation supported by supplied values', ih.indexOf('3.65× larger') !== -1);
  ok('(I8) no false broker certification language', !/Broker Verified|Broker Certified|Independently Audited|Externally Verified/i.test(ih));
  ok('(I9) summary has counts, no invalid combined total', ih.indexOf(L.summaryStrategies) !== -1 && !/combined (profit|return|drawdown)/i.test(ih));

  const fallbackHist = Object.assign({}, investorHist, { realized_return_pct: null, strategy_max_drawdown_pct: null });
  const fallback = { innerHTML: '' };
  PP.render(fallback, { performance: { as_of: 'x', systems: [Object.assign({}, investorSys, { historical_record: fallbackHist })] }, system: null, weekly: null }, 'en');
  ok('(I10) null return/drawdown fallback never empty or zero', fallback.innerHTML.indexOf(L.closedPositions) !== -1 && fallback.innerHTML.indexOf('pp-big pp-na') === -1);

  const investorAr = { innerHTML: '' };
  PP.render(investorAr, { performance: { as_of: 'x', systems: [investorSys] }, system: null, weekly: null }, 'ar');
  ok('(I11) enriched Arabic render remains language-pure', investorAr.innerHTML.indexOf('Average Winner') === -1 && investorAr.innerHTML.indexOf('Broker Execution History') === -1);
}

// ── Phase 1F: immutable versioned snapshot paths (additive) ───────────────
function runPathTests() {
  const NAME = 'public_performance_summary.json';
  const good = 'snapshots/20260711T120000Z-ab12cd34/' + NAME;
  // (P2) valid immutable path
  ok('(P2) valid immutable path accepted', PP.isSafeSnapshotPath(good, NAME) === true);
  // (P4) final filename must equal name
  ok('(P4) name/path filename mismatch rejected', PP.isSafeSnapshotPath('snapshots/rel/public_system_summary.json', NAME) === false);
  // (P5) admin rejected
  ok('(P5) admin path rejected', PP.isSafeSnapshotPath('snapshots/rel/admin_research_health.json', 'admin_research_health.json') === false);
  // (P6) traversal
  ok('(P6) literal traversal rejected', PP.isSafeSnapshotPath('snapshots/../evil/' + NAME, NAME) === false);
  // (P7) encoded traversal
  ok('(P7) encoded traversal rejected', PP.isSafeSnapshotPath('snapshots/%2e%2e/' + NAME, NAME) === false);
  ok('(P7b) encoded slash rejected', PP.isSafeSnapshotPath('snapshots%2frel/' + NAME, NAME) === false);
  // (P8) leading slash
  ok('(P8) leading slash rejected', PP.isSafeSnapshotPath('/snapshots/rel/' + NAME, NAME) === false);
  // (P9) backslash
  ok('(P9) backslash rejected', PP.isSafeSnapshotPath('snapshots\\rel\\' + NAME, NAME) === false);
  // (P10) URL scheme
  ok('(P10) scheme rejected', PP.isSafeSnapshotPath('https://evil/snapshots/rel/' + NAME, NAME) === false);
  ok('(P10b) javascript scheme rejected', PP.isSafeSnapshotPath('javascript:snapshots/rel/' + NAME, NAME) === false);
  // (P11) query
  ok('(P11) query string rejected', PP.isSafeSnapshotPath(good + '?x=1', NAME) === false);
  // (P12) fragment
  ok('(P12) fragment rejected', PP.isSafeSnapshotPath(good + '#a', NAME) === false);
  // (P13) invalid release_id
  ok('(P13) space in release_id rejected', PP.isSafeSnapshotPath('snapshots/rel id/' + NAME, NAME) === false);
  ok('(P13b) dot in release_id rejected', PP.isSafeSnapshotPath('snapshots/rel.x/' + NAME, NAME) === false);
  // (P14) arbitrary directory / depth
  ok('(P14) wrong root dir rejected', PP.isSafeSnapshotPath('uploads/rel/' + NAME, NAME) === false);
  ok('(P14b) extra directory rejected', PP.isSafeSnapshotPath('snapshots/rel/sub/' + NAME, NAME) === false);
  ok('(P14c) duplicate slash rejected', PP.isSafeSnapshotPath('snapshots//rel/' + NAME, NAME) === false);
  // (P15) arbitrary extension
  ok('(P15) wrong extension rejected', PP.isSafeSnapshotPath('snapshots/rel/public_performance_summary.txt', NAME) === false);

  // buildSnapshotUrlFromEntry: path when present, name when absent, throws on bad path
  ok('(P1u) entry without path => legacy name URL', PP.buildSnapshotUrlFromEntry('https://cdn.x/perf', { name: NAME }) === 'https://cdn.x/perf/' + NAME);
  ok('(P2u) entry with path => path URL', PP.buildSnapshotUrlFromEntry('https://cdn.x/perf', { name: NAME, path: good }) === 'https://cdn.x/perf/' + good);
  let threw = false; try { PP.buildSnapshotUrlFromEntry('https://cdn.x/perf', { name: NAME, path: 'snapshots/../evil/' + NAME }); } catch (e) { threw = true; } ok('(P6u) bad path throws', threw);

  // manifest with a valid path validates; manifest with a bad path is rejected
  const relId = '20260711T120000Z-ab12cd34';
  ok('(P2m) immutable manifest validates', PP.validateManifest(buildImmutableManifest(happyMap, relId), NOW).ok === true);
  const badMan = buildImmutableManifest(happyMap, relId);
  badMan.files.forEach(function (f) { if (f.name === NAME) f.path = 'snapshots/../evil/' + NAME; });
  const mvBad = PP.validateManifest(badMan, NOW);
  ok('(P6m) manifest with traversal path rejected', mvBad.ok === false && mvBad.errors.join(' ').indexOf('bad path') !== -1);

  // async: immutable manifest load uses path, integrity still enforced
  const urls = [];
  const getJson = function () { return Promise.resolve(buildImmutableManifest(happyMap, relId)); };
  const getBytes = function (u) { urls.push(u); const n = String(u).split('/').pop(); return Promise.resolve(bytesFix(happyMap[n])); };
  return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: getJson, getBytes: getBytes }).then(function (r) {
    ok('(P2l) immutable manifest load ok', r.ok === true && !!r.performance && !!r.system && !!r.weekly);
    ok('(P3) snapshots fetched via path not name', urls.length === 3 && urls.every(function (u) { return u.indexOf('/snapshots/' + relId + '/') !== -1; }));
    ok('(P16-18) integrity/schema/privacy still enforced', r.errors.length === 0 && r.integrity_error === false && r.stale === false);
  }).then(function () {
    // (P19) partial failure remains safe with immutable manifest
    const gb = function (u) { const n = String(u).split('/').pop(); if (n === 'public_weekly_research.json') return Promise.reject(new Error('HTTP 404')); return Promise.resolve(bytesFix(happyMap[n])); };
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: getJson, getBytes: gb }).then(function (r) {
      ok('(P19) immutable partial failure safe', r.partial === true && r.weekly === null && !!r.performance);
    });
  }).then(function () {
    // (P16 integrity) hash mismatch under immutable manifest still rejects
    const man = buildImmutableManifest(happyMap, relId);
    man.files.forEach(function (f) { if (f.name === NAME) f.sha256 = 'b'.repeat(64); });
    return PP.load('https://cdn.example.com/perf', { nowMs: NOW, fetchJson: function () { return Promise.resolve(man); }, getBytes: getBytes }).then(function (r) {
      ok('(P16) immutable hash mismatch rejects performance', r.integrity_error === true && r.performance === null);
    });
  });
}

function runChartTests() {
  const raw = { available:true, record_type:'broker_execution_history', charts:{ version:'1.0', strategy:{
    curve:{available:true,unit:'return_pct',points:[{time:'2026-02-01T00:00:00Z',value:2},{time:'2026-01-01T00:00:00Z',value:1}]},
    drawdown:{available:true,unit:'percent',points:[{time:'2026-01-01T00:00:00Z',value:0},{time:'2026-02-01T00:00:00Z',value:-1}]},
    monthly:{available:true,unit:'return_pct',rows:[{month:'2026-02',value:-1,trades:2},{month:'2026-01',value:2,trades:3}]},
    trades:{available:true,unit:'usd',rows:[{time:'2026-02-01T00:00:00Z',outcome:'loss',value:-20,unit:'usd',holding_hours:4},{time:'2026-01-01T00:00:00Z',outcome:'win',value:30,unit:'usd',holding_hours:2}]}
  },account:{curve:{available:true,unit:'return_pct',points:[{time:'2026-01-01T00:00:00Z',value:0}]},drawdown:{available:true,unit:'percent',points:[{time:'2026-01-01T00:00:00Z',value:0}]},monthly:{available:true,unit:'return_pct',rows:[{month:'2026-01',value:1}]}}} };
  const hist=PP.normalizeHistorical(raw);
  ok('(C1) chart schema allowlisted', hist.charts.version==='1.0' && hist.charts.strategy.curve.rows.length===2);
  ok('(C2) chart and trade rows chronological', hist.charts.strategy.curve.rows[0].value===1 && hist.charts.strategy.trades.rows[0].value===30);
  const sys={public_name:'QQQ Strategy',status:'live',closed_trades:2,wins:1,losses:1,win_rate_pct:50,profit_factor:1,historical_record:hist};
  const c={innerHTML:''}; PP.render(c,{performance:{as_of:'2026-02-01',systems:[sys]}},'en');
  ok('(C3) performance and drawdown render', /Realized Strategy Return/.test(c.innerHTML) && /Drawdown/.test(c.innerHTML));
  ok('(C4) monthly values and trades in tooltip', /Month: 2026-01/.test(c.innerHTML) && /Trades: 3/.test(c.innerHTML));
  ok('(C5) trade tooltip excludes IDs', /PnL: \+\$30/.test(c.innerHTML) && /Holding Time: 2 hours/.test(c.innerHTML) && !/trade_id|position_id/.test(c.innerHTML));
  ok('(C6) strategy account toggle present', /data-chart-toggle="strategy"/.test(c.innerHTML) && /data-chart-toggle="account"/.test(c.innerHTML));
  ok('(C7) negative monthly bar red class', /pp-month[^>]*[\s\S]*?negative/.test(c.innerHTML));
  const gold={innerHTML:''}; PP.render(gold,{performance:{as_of:'x',systems:[Object.assign({},sys,{public_name:'Gold Strategy'})]}},'en');
  ok('(C8) Gold naming is research, never equity', /Cumulative Research Performance/.test(gold.innerHTML) && !/account equity/i.test(gold.innerHTML));
  ok('(C9) Gold has no account toggle', !/data-chart-toggle="account"/.test(gold.innerHTML));
  const empty={innerHTML:''}; PP.render(empty,{performance:{as_of:'x',systems:[Object.assign({},sys,{historical_record:PP.normalizeHistorical({available:true})})]}},'en');
  ok('(C10) exact English empty state', empty.innerHTML.indexOf('Time-series data is not available for this record.')!==-1);
  const emptyAr={innerHTML:''}; PP.render(emptyAr,{performance:{as_of:'x',systems:[Object.assign({},sys,{historical_record:PP.normalizeHistorical({available:true})})]}},'ar');
  ok('(C11) exact Arabic empty state and RTL-safe markup', emptyAr.innerHTML.indexOf('البيانات الزمنية غير متاحة لهذا السجل.')!==-1);
  ok('(C12) no canvas/synthetic/interpolation', !/canvas|synthetic|interpolat/i.test(c.innerHTML));
}

runVerifiedTests()
  .then(runLoadTests)
  .then(runPathTests)
  .then(function () { runRenderTests(); runScanTests(); runHistoricalTests(); runChartTests(); })
  .then(function () {
    console.log('\n[public-performance-consumer] ' + pass + ' passed, ' + fail + ' failed');
    process.exit(fail === 0 ? 0 : 1);
  })
  .catch(function (e) { console.error('UNCAUGHT', e); process.exit(1); });
