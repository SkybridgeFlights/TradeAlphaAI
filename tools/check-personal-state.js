'use strict';

// Phase 221 — Personal state contract validator.
// Negative-tested. Hard-fails on real account_id values, missing
// integration points, write_enabled in contract phase, or accounts/
// directory ever appearing in the repo.

const fs = require('fs');
const path = require('path');
const { STATE_FILES } = require('./build-personal-state');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);

const PLACEHOLDER = /^__PLACEHOLDER_[a-z0-9_]+__$/;
const SECRET_PATTERNS = [/\bsk_(test|live)_[A-Za-z0-9]{16,}/, /\beyJ[A-Za-z0-9_-]{20,}\./];

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }

function check(c) {
  const fails = [];
  if (!c) return ['personal-state-contracts artifact missing'];
  if (c.source_layer !== 'personal-state-contracts') fails.push('source_layer mismatch');
  if (c.mode !== 'contract') fails.push("mode must be 'contract' in this phase");
  if (c.write_enabled !== false) fails.push('write_enabled must be false in contract phase');
  if (!c.storage || c.storage.root_dir !== 'data/accounts/') fails.push('storage.root_dir must be data/accounts/');
  if (!c.storage || c.storage.ignored_in_repo !== true) fails.push('storage.ignored_in_repo must be true');
  if (!c.storage || JSON.stringify((c.storage.file_layout || []).slice().sort()) !== JSON.stringify(STATE_FILES.slice().sort())) fails.push('file_layout drift');
  // The .gitignore MUST contain data/accounts/ — no per-account state may
  // ever be committed even by accident.
  const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
  if (!gi.split(/\r?\n/).some((line) => line.trim() === 'data/accounts/')) fails.push('.gitignore must include data/accounts/');
  // The accounts directory must not exist in the working tree as committed
  // content. Either absent or untracked is fine.
  const accountsDir = path.join(ROOT, 'data', 'accounts');
  if (fs.existsSync(accountsDir)) {
    const entries = fs.readdirSync(accountsDir).filter((e) => !e.startsWith('.'));
    if (entries.length > 0) fails.push(`data/accounts/ contains entries (${entries.length}); the .gitignore must keep these out of commits`);
  }
  // example_template must use literal __PLACEHOLDER_*__ for account_id and
  // referenced opaque fields — proof that no real account leaked.
  const t = c.example_template;
  if (!t) fails.push('example_template missing');
  else {
    if (!PLACEHOLDER.test(t.account_id || '')) fails.push('example_template.account_id must be a __PLACEHOLDER_*__ literal');
    for (const file of STATE_FILES) {
      const f = (t.files || {})[file];
      if (!f) fails.push(`example_template.files.${file} missing`);
      else if (f.account_id !== t.account_id) fails.push(`example_template.files.${file}.account_id must equal the template account_id`);
    }
  }
  // Integration points must reference real artifacts on disk.
  for (const k of ['auth_provider', 'identity_schema', 'preference_enums', 'alert_classes']) {
    const p = path.join(ROOT, (c.integration_points || {})[k] || '');
    if (!c.integration_points || !c.integration_points[k] || !fs.existsSync(p)) fails.push(`integration_points.${k} -> ${(c.integration_points || {})[k]} does not exist`);
  }
  // Governance flags all true.
  for (const flag of ['no_real_account_ids_in_repo', 'no_email_addresses_in_repo', 'no_session_tokens_in_repo', 'gitignored_accounts_dir', 'validator_enforced_writes']) {
    if (!c.governance || c.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  // Secret-leak scan.
  const text = JSON.stringify(c);
  for (const re of SECRET_PATTERNS) if (re.test(text)) fails.push(`secret-like content matched ${re}`);
  return fails;
}

function run() {
  const c = readJson(J('personal-state-contracts.json'));
  const fails = check(c);
  if (fails.length) { fails.forEach((f) => console.error(`[check:personal-state] FAIL: ${f}`)); process.exit(1); }
  console.log('[check:personal-state] OK');
}

function selfTest() {
  const c = readJson(J('personal-state-contracts.json'), {});
  const cases = [
    ['clean', () => check(c).length === 0, true],
    ['write_enabled true', () => { const m = JSON.parse(JSON.stringify(c)); m.write_enabled = true; return check(m).length > 0; }, true],
    ['real account_id', () => { const m = JSON.parse(JSON.stringify(c)); m.example_template.account_id = 'user_real_xyz'; return check(m).length > 0; }, true],
    ['governance flag off', () => { const m = JSON.parse(JSON.stringify(c)); m.governance.no_real_account_ids_in_repo = false; return check(m).length > 0; }, true],
    ['secret leaked', () => { const m = JSON.parse(JSON.stringify(c)); m.storage.note_en = 'sk_live_ABCDEFGHIJKLMNOP1234'; return check(m).length > 0; }, true],
    ['integration point missing', () => { const m = JSON.parse(JSON.stringify(c)); m.integration_points.auth_provider = 'data/intelligence/nope.json'; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:personal-state] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
