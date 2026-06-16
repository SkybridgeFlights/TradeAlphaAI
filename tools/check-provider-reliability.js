'use strict';

// Phase 200 / Workstream A — check:provider-reliability.
// Integrity + honesty gate for the institutional-charts provider DIAGNOSTICS
// (provider_health + per-asset diagnostics). It proves the manifest reports —
// honestly — which providers were attempted per asset, the bounded outcome
// class, bars found, the resolved source and any rate-limit state, and that
// availability is never fabricated. An honest empty manifest passes.
//
// HARD-FAILS on: missing/!malformed provider_health, a diagnostics entry per
// SPEC asset missing, an unknown outcome/reason class, an available chart whose
// diagnostic has no resolved source (fabricated availability), an unavailable
// asset whose diagnostic claims it resolved (contradiction), a resolved source
// with no ok/cached attempt (fabricated success), an asset both available and
// unavailable, or inconsistent counts. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { SPECS } = require('./build-institutional-charts');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'data', 'visual', 'institutional-charts.json');
const OUTCOMES = new Set([
  'ok', 'cached', 'no_key', 'empty', 'insufficient_bars', 'rate_limited',
  'auth_failed', 'timeout', 'http_error', 'bad_response', 'error',
  'not_attempted', 'missing_fixture',
]);
const REASONS = new Set([
  'unavailable_offline', 'no_provider_keys', 'rate_limited',
  'approved_ohlcv_unavailable', 'insufficient_valid_bars', 'fixture_missing',
]);
const MODES = new Set(['fetch', 'offline', 'fixture']);
const RESOLVING = new Set(['ok', 'cached']);

function validate(manifest) {
  const f = [];
  if (!manifest || typeof manifest !== 'object') return ['manifest not an object'];
  const ph = manifest.provider_health;
  if (!ph || typeof ph !== 'object') { f.push('missing provider_health block'); }
  else {
    if (!MODES.has(ph.mode)) f.push(`provider_health.mode invalid "${ph.mode}"`);
    if (ph.assets_total !== SPECS.length) f.push(`provider_health.assets_total ${ph.assets_total} != SPEC count ${SPECS.length}`);
    if (typeof ph.assets_available !== 'number' || typeof ph.assets_unavailable !== 'number') f.push('provider_health counts not numbers');
    else if (ph.assets_available + ph.assets_unavailable !== SPECS.length) f.push('provider_health available+unavailable != total');
  }

  const diagnostics = Array.isArray(manifest.diagnostics) ? manifest.diagnostics : null;
  if (!diagnostics) { f.push('missing diagnostics array'); return f; }

  const charts = Array.isArray(manifest.charts) ? manifest.charts : [];
  const unavailable = Array.isArray(manifest.unavailable) ? manifest.unavailable : [];
  const availableSyms = new Set(charts.map((c) => c.symbol));
  const unavailableSyms = new Set(unavailable.map((u) => u.symbol));
  for (const sym of availableSyms) if (unavailableSyms.has(sym)) f.push(`${sym}: appears both available and unavailable`);

  const specSyms = new Set(SPECS.map((s) => s.symbol));
  const seen = new Set();
  for (const d of diagnostics) {
    const sym = d && d.symbol;
    if (!sym) { f.push('diagnostic entry missing symbol'); continue; }
    seen.add(sym);
    if (!specSyms.has(sym)) f.push(`${sym}: diagnostic for asset not in SPECS`);
    if (!Array.isArray(d.attempts) || !d.attempts.length) f.push(`${sym}: diagnostic missing attempts`);
    else for (const a of d.attempts) {
      if (!a.provider) f.push(`${sym}: attempt missing provider`);
      if (!OUTCOMES.has(a.outcome)) f.push(`${sym}: unknown attempt outcome "${a.outcome}"`);
      if (a.bars_found != null && (typeof a.bars_found !== 'number' || a.bars_found < 0)) f.push(`${sym}: invalid bars_found`);
    }
    const hasResolvingAttempt = (d.attempts || []).some((a) => RESOLVING.has(a.outcome));
    if (d.resolved) {
      // A resolved source must be backed by an ok/cached attempt — never fabricated.
      if (!hasResolvingAttempt) f.push(`${sym}: resolved source without an ok/cached attempt (fabricated success)`);
      if (!availableSyms.has(sym)) f.push(`${sym}: diagnostic resolved but asset is not in charts`);
      if (d.reason) f.push(`${sym}: resolved diagnostic must not also carry an unavailable reason`);
    } else {
      if (!REASONS.has(d.reason)) f.push(`${sym}: unavailable diagnostic has unknown/missing reason "${d.reason}"`);
      if (availableSyms.has(sym)) f.push(`${sym}: asset is available but diagnostic has no resolved source (fabricated availability)`);
    }
    if (d.rate_limited && !(d.attempts || []).some((a) => a.outcome === 'rate_limited')) {
      f.push(`${sym}: rate_limited flag without a rate_limited attempt`);
    }
  }
  for (const s of specSyms) if (!seen.has(s)) f.push(`${s}: SPEC asset missing from diagnostics`);
  // Every rendered chart must have a diagnostic proving its source.
  for (const c of charts) {
    const d = diagnostics.find((x) => x.symbol === c.symbol);
    if (!d) f.push(`${c.symbol}: rendered chart has no diagnostic`);
    else if (!d.resolved) f.push(`${c.symbol}: rendered chart diagnostic has no resolved source`);
  }
  return f;
}

function fixture() {
  return {
    provider_health: { mode: 'offline', assets_total: SPECS.length, assets_available: 1, assets_unavailable: SPECS.length - 1, rate_limited: false },
    charts: [{ symbol: SPECS[0].symbol }],
    unavailable: SPECS.slice(1).map((s) => ({ symbol: s.symbol, reason: 'unavailable_offline' })),
    diagnostics: [
      { symbol: SPECS[0].symbol, attempts: [{ provider: 'cached manifest', outcome: 'cached', bars_found: 90 }], resolved: { provider: 'cached', bars_found: 90 }, rate_limited: false },
      ...SPECS.slice(1).map((s) => ({ symbol: s.symbol, attempts: [{ provider: 'offline', outcome: 'not_attempted' }], resolved: null, reason: 'unavailable_offline', rate_limited: false })),
    ],
  };
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fixture();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['missing provider_health', (m) => { delete m.provider_health; }],
    ['bad mode', (m) => { m.provider_health.mode = 'guess'; }],
    ['count mismatch', (m) => { m.provider_health.assets_available = 99; }],
    ['unknown outcome', (m) => { m.diagnostics[0].attempts[0].outcome = 'vibes'; }],
    ['fabricated availability', (m) => { m.diagnostics[0].resolved = null; m.diagnostics[0].reason = 'unavailable_offline'; }],
    ['resolved without ok attempt', (m) => { m.diagnostics[0].attempts = [{ provider: 'x', outcome: 'empty' }]; }],
    ['unknown reason', (m) => { m.diagnostics[1].reason = 'because'; }],
    ['rate flag without attempt', (m) => { m.diagnostics[1].rate_limited = true; }],
    ['spec asset missing', (m) => { m.diagnostics.pop(); }],
    ['both available and unavailable', (m) => { m.unavailable.push({ symbol: SPECS[0].symbol, reason: 'unavailable_offline' }); }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean rejected:', validate(clone()));
  console.log(`[provider-reliability] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(MANIFEST)) {
    console.log('[provider-reliability] no manifest yet — nothing to validate (non-fatal).');
    process.exit(0);
  }
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')); } catch (e) { console.error(`[provider-reliability] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(manifest);
  if (failures.length) {
    failures.forEach((m) => console.error(`[provider-reliability] FAIL: ${m}`));
    process.exit(1);
  }
  const ph = manifest.provider_health;
  console.log(`[provider-reliability] check:provider-reliability passed (mode=${ph.mode}, ${ph.assets_available}/${ph.assets_total} available; diagnostics honest, no fabricated availability).`);
}

module.exports = { validate };
