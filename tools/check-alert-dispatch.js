'use strict';

// Phase 222 — Alert dispatch contract validator.

const fs = require('fs');
const path = require('path');
const { ALLOWED_CHANNELS } = require('./build-alert-dispatch');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const ALLOWED_CONFIDENCE = new Set(['high', 'moderate', 'low']);

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function check(d) {
  const fails = [];
  if (!d) return ['alert-dispatch artifact missing'];
  if (d.source_layer !== 'alert-dispatch') fails.push('source_layer mismatch');
  if (d.mode !== 'contract') fails.push("mode must be 'contract'");
  if (d.dispatch_enabled !== false) fails.push('dispatch_enabled must be false in contract phase');
  if (JSON.stringify((d.allowed_channels || []).slice().sort()) !== JSON.stringify(ALLOWED_CHANNELS.slice().sort())) fails.push('allowed_channels drift');
  for (const ch of Object.keys(d.channels || {})) {
    if (!ALLOWED_CHANNELS.includes(ch)) fails.push(`channel ${ch} not allowed`);
    if ((d.channels[ch] || {}).enabled !== false) fails.push(`channel ${ch}.enabled must be false`);
  }
  // Phase 222 ships only regime_change.
  if (!Array.isArray(d.classes_with_dispatch) || d.classes_with_dispatch.length === 0) fails.push('classes_with_dispatch empty');
  for (const cls of d.classes_with_dispatch || []) {
    const c = (d.classes || {})[cls];
    if (!c) fails.push(`classes.${cls} missing`);
    else {
      if (!c.source) fails.push(`classes.${cls}.source missing`);
      if (!ALLOWED_CONFIDENCE.has(c.min_confidence)) fails.push(`classes.${cls}.min_confidence ${c.min_confidence} not allowed`);
      if (!c.throttle) fails.push(`classes.${cls}.throttle missing`);
      if (!c.payload_shape || !c.payload_shape.alert_id) fails.push(`classes.${cls}.payload_shape.alert_id missing`);
      if (c.payload_shape && c.payload_shape.account_id !== '__PLACEHOLDER_account_id__') fails.push(`classes.${cls}.payload_shape.account_id must be a __PLACEHOLDER__ literal`);
    }
  }
  for (const flag of ['no_signals', 'no_forecasts', 'no_price_targets', 'no_dispatch_in_contract_phase', 'url_200_gated', 'opt_in_only', 'respects_existing_telegram_gates', 'no_fabricated_alerts']) {
    if (!d.governance || d.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  // Integration points must exist on disk.
  for (const k of Object.keys(d.integration_points || {})) {
    if (!fs.existsSync(path.join(ROOT, d.integration_points[k]))) fails.push(`integration_points.${k} -> ${d.integration_points[k]} does not exist`);
  }
  // Page existence — regime page + inbox page EN+AR.
  for (const p of ['account/alerts/regime/index.html', 'ar/account/alerts/regime/index.html', 'account/alerts/inbox/index.html', 'ar/account/alerts/inbox/index.html']) {
    if (!fs.existsSync(path.join(ROOT, p))) fails.push(`page missing: ${p}`);
    else {
      const html = fs.readFileSync(path.join(ROOT, p), 'utf8');
      if (!html.includes('noindex')) fails.push(`${p}: must be noindex`);
      if (/<form[\s>]/i.test(html)) fails.push(`${p}: <form> forbidden`);
    }
  }
  return fails;
}

function run() {
  const d = readJson(J('alert-dispatch.json'));
  const fails = check(d);
  if (fails.length) { fails.forEach((f) => console.error(`[check:alert-dispatch] FAIL: ${f}`)); process.exit(1); }
  console.log('[check:alert-dispatch] OK');
}

function selfTest() {
  const d = readJson(J('alert-dispatch.json'), {});
  const cases = [
    ['clean', () => check(d).length === 0, true],
    ['dispatch_enabled true', () => { const m = JSON.parse(JSON.stringify(d)); m.dispatch_enabled = true; return check(m).length > 0; }, true],
    ['channel enabled', () => { const m = JSON.parse(JSON.stringify(d)); m.channels.telegram.enabled = true; return check(m).length > 0; }, true],
    ['min_confidence unknown', () => { const m = JSON.parse(JSON.stringify(d)); m.classes.regime_change.min_confidence = 'bogus'; return check(m).length > 0; }, true],
    ['placeholder leaked', () => { const m = JSON.parse(JSON.stringify(d)); m.classes.regime_change.payload_shape.account_id = 'user_real_123'; return check(m).length > 0; }, true],
    ['governance flag off', () => { const m = JSON.parse(JSON.stringify(d)); m.governance.opt_in_only = false; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:alert-dispatch] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
