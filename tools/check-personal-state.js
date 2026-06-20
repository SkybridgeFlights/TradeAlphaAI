'use strict';

// Phase 221-Pg — personal-state-contracts validator (Postgres backend).
// Negative-tested. Hard-fails on:
//   - mode !== 'postgres' (regression to repo-file backend)
//   - any tool writing under data/accounts/
//   - missing Postgres tables in the migration set
//   - missing API routes
//   - missing Clerk auth verification on any API route
//   - missing governance flags
//   - DATABASE_URL referenced anywhere in client-side files (server-only)

const fs = require('fs');
const path = require('path');
const { STATE_TABLES, API_ROUTES } = require('./build-personal-state');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const SECRET_PATTERNS = [/\bsk_(test|live)_[A-Za-z0-9]{16,}/, /\beyJ[A-Za-z0-9_-]{20,}\./];
// Files that legitimately reference DATABASE_URL — server-side only.
const DATABASE_URL_ALLOWED = new Set([
  'tools/apply-migrations.js',
  'db/client.js',
  'tools/build-personal-state.js',
  'tools/check-personal-state.js',
  'data/intelligence/personal-state-contracts.json',
]);

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function readText(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

function check(c) {
  const fails = [];
  if (!c) return ['personal-state-contracts artifact missing'];
  if (c.source_layer !== 'personal-state-contracts') fails.push('source_layer mismatch');
  // Phase 221-Pg — mode MUST be 'postgres'. Regression to 'contract' or
  // 'file' would mean the platform is back to non-scalable storage.
  if (c.mode !== 'postgres') fails.push("mode must be 'postgres' (post-Phase-221 redesign)");
  if (c.write_enabled !== true) fails.push('write_enabled must be true in postgres mode');
  if (!c.storage || c.storage.backend !== 'neon-postgres') fails.push('storage.backend must be neon-postgres');
  if (!c.storage || c.storage.env_var !== 'DATABASE_URL') fails.push('storage.env_var must be DATABASE_URL');
  if (!c.storage || c.storage.legacy_repo_path_forbidden !== 'data/accounts/') fails.push('storage.legacy_repo_path_forbidden must be data/accounts/');
  if (!c.storage || c.storage.file_layout_deprecated !== true) fails.push('storage.file_layout_deprecated must be true');

  // The accounts directory MUST NOT exist or be empty in the working tree.
  // A non-empty data/accounts/ would mean the legacy v1 design leaked back.
  const accountsDir = path.join(ROOT, 'data', 'accounts');
  if (fs.existsSync(accountsDir)) {
    const entries = fs.readdirSync(accountsDir).filter((e) => !e.startsWith('.'));
    if (entries.length > 0) fails.push(`data/accounts/ contains entries (${entries.length}) — Postgres backend forbids per-account files in repo`);
  }
  // .gitignore must still cover data/accounts/ so a leftover never lands
  // even after the redesign.
  const gi = readText(path.join(ROOT, '.gitignore'));
  if (!gi.split(/\r?\n/).some((line) => line.trim() === 'data/accounts/')) fails.push('.gitignore must include data/accounts/');

  // Every declared table must appear in the migration set.
  const migrationDir = path.join(ROOT, 'db', 'migrations');
  if (!fs.existsSync(migrationDir)) fails.push('db/migrations/ missing');
  else {
    const migrationFiles = fs.readdirSync(migrationDir).filter((f) => /\.sql$/.test(f));
    const allSql = migrationFiles.map((f) => readText(path.join(migrationDir, f))).join('\n');
    for (const { table, migration } of STATE_TABLES) {
      const re = new RegExp(`CREATE TABLE\\s+(IF NOT EXISTS\\s+)?${table}\\b`, 'i');
      if (!re.test(allSql)) fails.push(`table ${table} missing from migration set`);
      const relMig = path.relative(ROOT, path.resolve(ROOT, migration)).replace(/\\/g, '/');
      if (!migrationFiles.includes(path.basename(relMig))) fails.push(`migration file ${relMig} missing`);
    }
  }

  // Every declared API route must exist on disk + must call requireAccount
  // (Clerk session verification).
  for (const route of API_ROUTES) {
    // /api/account/init -> api/account/init.js
    const file = path.join(ROOT, route.replace(/^\//, '') + '.js');
    if (!fs.existsSync(file)) { fails.push(`API route file missing: ${path.relative(ROOT, file)}`); continue; }
    const src = readText(file);
    if (!/requireAccount\s*\(/.test(src)) fails.push(`${route}: missing requireAccount() call (Clerk session verification)`);
    if (!/getSql\s*\(/.test(src)) fails.push(`${route}: missing getSql() call (Neon client)`);
  }

  // Governance flags all true.
  for (const flag of ['no_real_account_ids_in_repo', 'no_email_addresses_in_repo', 'no_session_tokens_in_repo', 'no_per_account_files_in_repo', 'validator_enforces_postgres_backend', 'validator_enforces_no_data_accounts_dir', 'api_routes_require_clerk_token', 'cross_account_reads_disallowed', 'cascading_delete_via_foreign_keys']) {
    if (!c.governance || c.governance[flag] !== true) fails.push(`governance.${flag} must be true`);
  }
  // Integration points reference real artifacts.
  for (const k of Object.keys(c.integration_points || {})) {
    const p = path.join(ROOT, c.integration_points[k]);
    if (!fs.existsSync(p)) fails.push(`integration_points.${k} -> ${c.integration_points[k]} does not exist`);
  }
  // Migration runner config sanity.
  if (!c.migration_runner || c.migration_runner.idempotent !== true) fails.push('migration_runner.idempotent must be true');
  if (!c.migration_runner || c.migration_runner.tracking_table !== '_migrations') fails.push('migration_runner.tracking_table must be _migrations');

  // DATABASE_URL must NEVER appear in client-side files (any js/* file
  // shipped to the browser). Server-side scripts in tools/ + db/ + api/
  // are allowed. The check walks the js/ directory (shipped to clients)
  // and js/clerk-bootstrap.js explicitly.
  function scanForDbUrl(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir)) {
      const p = path.join(dir, entry);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) { scanForDbUrl(p); continue; }
      if (!/\.js$/.test(entry)) continue;
      const rel = path.relative(ROOT, p).replace(/\\/g, '/');
      if (DATABASE_URL_ALLOWED.has(rel)) continue;
      const src = readText(p);
      if (/\bDATABASE_URL\b/.test(src)) fails.push(`${rel}: DATABASE_URL must not appear in client/non-server file`);
    }
  }
  scanForDbUrl(path.join(ROOT, 'js'));

  // Secret-leak scan over the contract artifact.
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
    ['mode regressed', () => { const m = JSON.parse(JSON.stringify(c)); m.mode = 'contract'; return check(m).length > 0; }, true],
    ['backend swapped', () => { const m = JSON.parse(JSON.stringify(c)); m.storage.backend = 'mysql'; return check(m).length > 0; }, true],
    ['governance flag off', () => { const m = JSON.parse(JSON.stringify(c)); m.governance.no_per_account_files_in_repo = false; return check(m).length > 0; }, true],
    ['legacy path drift', () => { const m = JSON.parse(JSON.stringify(c)); m.storage.legacy_repo_path_forbidden = 'data/other/'; return check(m).length > 0; }, true],
    ['migration runner not idempotent', () => { const m = JSON.parse(JSON.stringify(c)); m.migration_runner.idempotent = false; return check(m).length > 0; }, true],
  ];
  let ok = 0; for (const [n, fn, expect] of cases) { if (fn() === expect) ok += 1; else console.error('  fail:', n); }
  console.log(`[check:personal-state] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest(); else run();
}

module.exports = { check };
