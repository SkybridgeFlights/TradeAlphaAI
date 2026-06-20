'use strict';

// Phase 215 CP10 — ETF coverage validators.
// Subcommands (selected with --check):
//   --check=provider-audit       check:etf-provider-audit
//   --check=data-quality         check:etf-data-quality
//   --check=coverage             check:etf-coverage
//   --check=activation           check:etf-activation
//   --check=provider-integrity   check:etf-provider-integrity
// Self-tests with --self-test.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const APPROVED_PROVIDERS = new Set(['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo']);
const ALLOWED_OUTCOMES = new Set(['ok', 'cached', 'no_key', 'empty', 'insufficient_bars', 'rate_limited', 'auth_failed', 'timeout', 'http_error', 'bad_response', 'error', 'not_attempted', 'missing_fixture']);
const ALLOWED_AVAIL = new Set(['available', 'unavailable']);
const ALLOWED_TIERS = new Set(['high', 'medium', 'low', 'unavailable']);
const ALLOWED_QUAL = {
  coverage_label: new Set(['full', 'partial', 'none']),
  chart_quality: new Set(['verified', 'partial', 'unavailable']),
  historical_depth: new Set(['multi_snapshot', 'single_snapshot', 'window_only', 'unavailable']),
  provider_confidence: new Set(['verified_provider', 'keyless_fallback', 'unavailable']),
};
const FORBIDDEN_LANG = [/\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i, /\bbuy\b/i, /\bsell\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bprice target\b/i];

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function failFor(name, fails) {
  if (fails.length) {
    fails.forEach((f) => console.error(`[${name}] FAIL: ${f}`));
    return false;
  }
  console.log(`[${name}] OK`);
  return true;
}

// ─── check:etf-provider-audit ──────────────────────────────────────────────
function checkProviderAudit(audit) {
  const fails = [];
  if (!audit) return ['audit artifact missing'];
  if (audit.source_layer !== 'etf-provider-audit') fails.push('source_layer mismatch');
  if (!Array.isArray(audit.etfs)) return ['etfs array missing'];
  if (audit.etfs.length !== ETFS.length) fails.push(`etfs.length=${audit.etfs.length} expected ${ETFS.length}`);
  const regSym = new Set(ETFS.map((e) => e.symbol));
  for (const e of audit.etfs) {
    if (!regSym.has(e.symbol)) fails.push(`${e.symbol}: not in registry`);
    if (!ALLOWED_AVAIL.has(e.availability)) fails.push(`${e.symbol}: availability not allowed`);
    if (!Array.isArray(e.attempts)) fails.push(`${e.symbol}: missing attempts`);
    for (const a of e.attempts || []) {
      if (!APPROVED_PROVIDERS.has(a.provider) && a.provider !== 'offline' && a.provider !== 'cached manifest' && a.provider !== 'Approved fixture') fails.push(`${e.symbol}: unapproved provider ${a.provider}`);
      if (!ALLOWED_OUTCOMES.has(a.outcome)) fails.push(`${e.symbol}: outcome not allowed ${a.outcome}`);
    }
    // Anti-fabrication: success requires a resolved source with bars.
    if (e.success && (!e.selected_source || !e.selected_source.provider || !e.bars_available || e.bars_available < 1)) {
      fails.push(`${e.symbol}: success without resolved source + bars`);
    }
    if (!e.success && e.selected_source) fails.push(`${e.symbol}: failure with selected_source set`);
    if (e.availability === 'unavailable' && !e.failure_reason) fails.push(`${e.symbol}: unavailable without failure_reason`);
  }
  for (const p of audit.providers || []) {
    if (!APPROVED_PROVIDERS.has(p.name)) fails.push(`unapproved provider ${p.name}`);
  }
  const txt = JSON.stringify(audit);
  if (/\bundefined\b|\bNaN\b/.test(txt)) fails.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(txt)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:etf-data-quality ────────────────────────────────────────────────
function checkDataQuality(quality, audit, charts) {
  const fails = [];
  if (!quality) return ['quality artifact missing'];
  if (quality.source_layer !== 'etf-data-quality') fails.push('source_layer mismatch');
  if (!Array.isArray(quality.etfs)) return ['etfs missing'];
  if (quality.etfs.length !== ETFS.length) fails.push(`etfs.length=${quality.etfs.length} expected ${ETFS.length}`);
  const regSym = new Set(ETFS.map((e) => e.symbol));
  const auditBy = new Map(((audit && audit.etfs) || []).map((e) => [e.symbol, e]));
  const chartBy = new Map(((charts && charts.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  for (const e of quality.etfs) {
    if (!regSym.has(e.symbol)) fails.push(`${e.symbol}: not in registry`);
    if (!ALLOWED_TIERS.has(e.quality_tier)) fails.push(`${e.symbol}: quality_tier ${e.quality_tier} not allowed`);
    if (!ALLOWED_QUAL.coverage_label.has(e.coverage_label)) fails.push(`${e.symbol}: coverage_label not allowed`);
    if (!ALLOWED_QUAL.chart_quality.has(e.chart_quality)) fails.push(`${e.symbol}: chart_quality not allowed`);
    if (!ALLOWED_QUAL.historical_depth.has(e.historical_depth)) fails.push(`${e.symbol}: historical_depth not allowed`);
    if (!ALLOWED_QUAL.provider_confidence.has(e.provider_confidence)) fails.push(`${e.symbol}: provider_confidence not allowed`);
    // Anti-fabrication: a verified chart_quality REQUIRES a real chart with matching series_hash.
    if (e.chart_quality === 'verified') {
      const c = chartBy.get(e.symbol);
      if (!c) fails.push(`${e.symbol}: chart_quality=verified but no verified chart in manifest`);
      else if (e.series_hash && c.series_hash && e.series_hash !== c.series_hash) fails.push(`${e.symbol}: series_hash mismatch with manifest`);
    }
    // Anti-fabrication: tier high requires verified_provider AND multi_snapshot history.
    if (e.quality_tier === 'high' && (e.provider_confidence !== 'verified_provider' || e.historical_depth !== 'multi_snapshot')) {
      fails.push(`${e.symbol}: tier=high requires verified_provider + multi_snapshot`);
    }
    if (e.quality_tier === 'unavailable' && e.chart_quality !== 'unavailable') {
      fails.push(`${e.symbol}: tier=unavailable but chart_quality=${e.chart_quality}`);
    }
    if (!Array.isArray(e.evidence) || !e.evidence.length) fails.push(`${e.symbol}: missing evidence`);
    // Audit alignment.
    const a = auditBy.get(e.symbol);
    if (a && a.availability === 'unavailable' && e.chart_quality !== 'unavailable') fails.push(`${e.symbol}: audit unavailable but chart_quality=${e.chart_quality}`);
  }
  const txt = JSON.stringify(quality);
  if (/\bundefined\b|\bNaN\b/.test(txt)) fails.push('artifact leaks undefined/NaN');
  for (const re of FORBIDDEN_LANG) if (re.test(txt)) fails.push(`forbidden language ${re}`);
  return fails;
}

// ─── check:etf-coverage ────────────────────────────────────────────────────
// Asserts the /etfs/coverage/ pages exist EN+AR, have required sections, RTL
// on AR, no raw-artifact exposure, no forbidden language.
function checkCoveragePages() {
  const fails = [];
  const required = ['etf-coverage-summary', 'etf-coverage-providers', 'etf-coverage-activation', 'etf-coverage-disclaimer'];
  for (const [loc, p] of [['EN', path.join(ROOT, 'etfs/coverage/index.html')], ['AR', path.join(ROOT, 'ar/etfs/coverage/index.html')]]) {
    if (!fs.existsSync(p)) { fails.push(`${loc}: page missing ${p}`); continue; }
    const html = fs.readFileSync(p, 'utf8');
    for (const sec of required) if (!html.includes('id="' + sec + '"')) fails.push(`${loc}: missing section ${sec}`);
    if (!html.includes('rel="canonical"')) fails.push(`${loc}: missing canonical`);
    if (!html.includes('hreflang="en"') || !html.includes('hreflang="ar"')) fails.push(`${loc}: missing hreflang`);
    if (loc === 'AR' && !html.includes('dir="rtl"')) fails.push('AR: missing dir=rtl');
    if (/\b(undefined|NaN)\b/.test(html)) fails.push(`${loc}: leaks undefined/NaN`);
    if (html.includes('data/intelligence/') && html.includes('.json')) fails.push(`${loc}: leaks raw artifact URL`);
    for (const re of FORBIDDEN_LANG) if (re.test(html)) fails.push(`${loc}: forbidden language ${re}`);
  }
  // EN/AR section parity.
  if (fs.existsSync(path.join(ROOT, 'etfs/coverage/index.html')) && fs.existsSync(path.join(ROOT, 'ar/etfs/coverage/index.html'))) {
    const enSecs = (fs.readFileSync(path.join(ROOT, 'etfs/coverage/index.html'), 'utf8').match(/id="etf-coverage-[a-z-]+"/g) || []).sort();
    const arSecs = (fs.readFileSync(path.join(ROOT, 'ar/etfs/coverage/index.html'), 'utf8').match(/id="etf-coverage-[a-z-]+"/g) || []).sort();
    if (JSON.stringify(enSecs) !== JSON.stringify(arSecs)) fails.push('EN/AR section parity broken');
  }
  return fails;
}

// ─── check:etf-activation ──────────────────────────────────────────────────
// Asserts no chart claims activation without bars + provider + series_hash
// matching a real on-disk SVG.
function checkActivation(charts) {
  const fails = [];
  if (!charts) return ['etf-charts manifest missing'];
  if (!Array.isArray(charts.charts)) return ['charts array missing'];
  const svgDir = path.join(ROOT, 'data', 'visual', 'etf-charts');
  for (const c of charts.charts) {
    if (c.verified !== true) fails.push(`${c.symbol}: verified flag missing`);
    if (!c.series_hash || !/^[a-f0-9]{32,}$/.test(c.series_hash)) fails.push(`${c.symbol}: missing/bad series_hash`);
    if (!Array.isArray(c.series) || c.series.length < 35) fails.push(`${c.symbol}: insufficient series (<35 bars)`);
    if (!c.attribution || !c.attribution.provider) fails.push(`${c.symbol}: missing attribution.provider`);
    if (!APPROVED_PROVIDERS.has(c.attribution && c.attribution.provider)) fails.push(`${c.symbol}: unapproved provider ${c.attribution && c.attribution.provider}`);
    if (!c.as_of) fails.push(`${c.symbol}: missing as_of`);
    if (!c.files || !c.files.en || !c.files.ar) fails.push(`${c.symbol}: missing SVG file refs`);
    else {
      for (const loc of ['en', 'ar']) {
        const abs = path.join(ROOT, c.files[loc]);
        if (!fs.existsSync(abs)) fails.push(`${c.symbol}: SVG missing ${c.files[loc]}`);
        else {
          const svg = fs.readFileSync(abs, 'utf8');
          if (!svg.startsWith('<svg')) fails.push(`${c.symbol}: ${loc} SVG not a real SVG`);
          if (!/viewBox=/.test(svg)) fails.push(`${c.symbol}: ${loc} SVG missing viewBox`);
        }
      }
    }
  }
  // Cross-check unavailable list does not double-declare with charts.
  const chSym = new Set(charts.charts.map((c) => c.symbol));
  for (const u of charts.unavailable || []) if (chSym.has(u.symbol)) fails.push(`${u.symbol}: both available and unavailable`);
  // Reject orphan SVGs (a chart file with no manifest entry).
  if (fs.existsSync(svgDir)) {
    const referenced = new Set();
    for (const c of charts.charts) {
      if (c.files) for (const loc of ['en', 'ar']) if (c.files[loc]) referenced.add(path.basename(c.files[loc]));
    }
    for (const f of fs.readdirSync(svgDir)) {
      if (f.endsWith('.svg') && !referenced.has(f)) fails.push(`orphan SVG ${f} (not in manifest)`);
    }
  }
  return fails;
}

// ─── check:etf-provider-integrity ──────────────────────────────────────────
// Cross-validates audit ↔ chart manifest ↔ data-quality. Asserts provider
// strings agree across artifacts, no fabricated success and the chain is
// honest (no unapproved providers).
function checkProviderIntegrity(audit, charts, quality) {
  const fails = [];
  if (!audit || !charts || !quality) return ['one of audit/charts/quality artifacts missing'];
  const chartBy = new Map(((charts.charts) || []).filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const qualityBy = new Map((quality.etfs || []).map((e) => [e.symbol, e]));
  const auditBy = new Map((audit.etfs || []).map((e) => [e.symbol, e]));
  for (const sym of [...chartBy.keys()]) {
    const c = chartBy.get(sym);
    const a = auditBy.get(sym);
    const q = qualityBy.get(sym);
    const chartProvider = c.attribution && c.attribution.provider;
    if (a && a.selected_source && a.selected_source.provider && a.selected_source.provider !== chartProvider) {
      fails.push(`${sym}: audit selected_source ${a.selected_source.provider} != chart provider ${chartProvider}`);
    }
    if (q && q.resolved_provider && q.resolved_provider !== chartProvider) {
      fails.push(`${sym}: quality resolved_provider ${q.resolved_provider} != chart provider ${chartProvider}`);
    }
    if (!APPROVED_PROVIDERS.has(chartProvider)) fails.push(`${sym}: chart provider ${chartProvider} not approved`);
  }
  // Counts agree.
  const auditAvail = (audit.etfs || []).filter((e) => e.availability === 'available').length;
  if (auditAvail !== chartBy.size) fails.push(`audit available=${auditAvail} but chart manifest verified=${chartBy.size}`);
  return fails;
}

function main() {
  const args = new Set(process.argv.slice(2));
  let check = null;
  for (const a of args) { const m = /^--check=(.+)$/.exec(a); if (m) check = m[1]; }
  if (!check) { console.error('usage: node tools/check-etf-coverage.js --check=<name>'); process.exit(2); }
  const audit = readJson(J('etf-provider-audit.json'));
  const charts = readJson(J('etf-charts.json'));
  const quality = readJson(J('etf-data-quality.json'));
  let fails;
  let name;
  if (check === 'provider-audit') { name = 'check:etf-provider-audit'; fails = checkProviderAudit(audit); }
  else if (check === 'data-quality') { name = 'check:etf-data-quality'; fails = checkDataQuality(quality, audit, charts); }
  else if (check === 'coverage') { name = 'check:etf-coverage'; fails = checkCoveragePages(); }
  else if (check === 'activation') { name = 'check:etf-activation'; fails = checkActivation(charts); }
  else if (check === 'provider-integrity') { name = 'check:etf-provider-integrity'; fails = checkProviderIntegrity(audit, charts, quality); }
  else { console.error(`unknown check ${check}`); process.exit(2); }
  if (!failFor(name, fails)) process.exit(1);
}

// Self-tests: synthetic mutations should fail; clean state should pass.
function selfTest() {
  const audit = readJson(J('etf-provider-audit.json'), { etfs: [], providers: [] });
  const charts = readJson(J('etf-charts.json'), { charts: [] });
  const quality = readJson(J('etf-data-quality.json'), { etfs: [] });
  const cases = [
    ['provider-audit clean', () => checkProviderAudit(audit).length === 0, true],
    ['provider-audit fabricated success', () => {
      const mut = JSON.parse(JSON.stringify(audit));
      mut.etfs[0].success = true; mut.etfs[0].selected_source = null;
      return checkProviderAudit(mut).length > 0;
    }, true],
    ['provider-audit unapproved provider', () => {
      const mut = JSON.parse(JSON.stringify(audit));
      mut.etfs[0].attempts.push({ provider: 'Bogus', outcome: 'ok', bars_found: 90 });
      return checkProviderAudit(mut).length > 0;
    }, true],
    ['data-quality clean', () => checkDataQuality(quality, audit, charts).length === 0, true],
    ['data-quality fake high tier', () => {
      const mut = JSON.parse(JSON.stringify(quality));
      mut.etfs[0].quality_tier = 'high'; mut.etfs[0].provider_confidence = 'keyless_fallback'; mut.etfs[0].historical_depth = 'single_snapshot';
      return checkDataQuality(mut, audit, charts).length > 0;
    }, true],
    ['data-quality fake verified chart', () => {
      const mut = JSON.parse(JSON.stringify(quality));
      mut.etfs.push({ symbol: 'FAKE', quality_tier: 'unavailable', coverage_label: 'none', chart_quality: 'verified', historical_depth: 'unavailable', provider_confidence: 'unavailable', evidence: ['x'] });
      return checkDataQuality(mut, audit, charts).length > 0;
    }, true],
    ['activation clean', () => checkActivation(charts).length === 0, true],
    ['activation bad hash', () => {
      const mut = JSON.parse(JSON.stringify(charts));
      if (mut.charts[0]) mut.charts[0].series_hash = 'short';
      return checkActivation(mut).length > 0;
    }, true],
    ['provider-integrity clean', () => checkProviderIntegrity(audit, charts, quality).length === 0, true],
    ['provider-integrity provider mismatch', () => {
      const mut = JSON.parse(JSON.stringify(charts));
      if (mut.charts[0]) mut.charts[0].attribution.provider = 'AlphaVantage';
      return checkProviderIntegrity(audit, mut, quality).length > 0;
    }, true],
  ];
  let ok = 0;
  for (const [name, fn, expect] of cases) {
    const r = fn();
    if (r === expect) ok += 1; else console.error('  fail:', name);
  }
  console.log(`[etf-coverage] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main();
}

module.exports = { checkProviderAudit, checkDataQuality, checkCoveragePages, checkActivation, checkProviderIntegrity };
