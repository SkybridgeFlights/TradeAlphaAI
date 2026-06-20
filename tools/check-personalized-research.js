'use strict';

// Phase 223 — Personalized research engine validator.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function check(r) {
  const fails = [];
  if (!r) return ['personalized-research artifact missing'];
  if (r.source_layer !== 'personalized-research') fails.push('source_layer mismatch');
  if (r.mode !== 'contract') fails.push("mode must be 'contract'");
  if (r.accounts.real_count !== 0) fails.push('accounts.real_count must be 0 in contract phase');
  const ex = r.accounts && r.accounts.example;
  if (!ex || ex.account_id !== '__PLACEHOLDER_account_id__') fails.push('example.account_id must be __PLACEHOLDER_account_id__');
  // Anti-fabrication: every card MUST carry non-empty evidence.
  for (const c of (ex && ex.cards) || []) {
    if (!Array.isArray(c.evidence) || c.evidence.length === 0) fails.push(`card ${c.from_symbol}->${c.to_symbol}: missing evidence`);
    if (!c.from_symbol || !c.to_symbol) fails.push('card missing from/to symbol');
    if (!c.research_href) fails.push(`card ${c.from_symbol}->${c.to_symbol}: missing research_href`);
  }
  for (const flag of ['no_signals', 'no_forecasts', 'no_price_targets', 'no_fabricated_edges', 'registry_bounded', 'evidence_backed_only']) {
    if (!r.governance || r.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  for (const k of Object.keys(r.engine_inputs || {})) {
    if (!fs.existsSync(path.join(ROOT, r.engine_inputs[k]))) fails.push(`engine_inputs.${k} -> ${r.engine_inputs[k]} does not exist`);
  }
  for (const p of ['account/research/index.html', 'ar/account/research/index.html']) {
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
  const r = readJson(J('personalized-research.json'));
  const fails = check(r);
  if (fails.length) { fails.forEach((f) => console.error(`[check:personalized-research] FAIL: ${f}`)); process.exit(1); }
  console.log('[check:personalized-research] OK');
}

function selfTest() {
  const r = readJson(J('personalized-research.json'), {});
  const cases = [
    ['clean', () => check(r).length === 0, true],
    ['real_count nonzero', () => { const m = JSON.parse(JSON.stringify(r)); m.accounts.real_count = 1; return check(m).length > 0; }, true],
    ['account_id leaked', () => { const m = JSON.parse(JSON.stringify(r)); m.accounts.example.account_id = 'user_real_xyz'; return check(m).length > 0; }, true],
    ['card without evidence', () => { const m = JSON.parse(JSON.stringify(r)); if (m.accounts.example.cards[0]) m.accounts.example.cards[0].evidence = []; return check(m).length > 0; }, true],
    ['governance flag off', () => { const m = JSON.parse(JSON.stringify(r)); m.governance.evidence_backed_only = false; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:personalized-research] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
