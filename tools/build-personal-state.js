'use strict';

// Phase 221-Pg — Personal State Engine (Postgres-backed contract).
//
// Replaces the original file-based contract. Per-account state lives
// in Neon Postgres (via DATABASE_URL on Vercel) — never in the
// repository. The contract artifact below documents the persistence
// architecture so validators + future phases can verify it.
//
// Output: data/intelligence/personal-state-contracts.json

const fs = require('fs');
const path = require('path');
const { ALLOWED_PREFERENCES } = require('./build-account-foundation');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const WRITE = process.argv.includes('--write');

// The 6 logical state surfaces, each mapped to a Postgres table created
// by db/migrations/*.sql. Validator enforces every table exists in the
// migration set.
const STATE_TABLES = [
  { surface: 'account',                 table: 'accounts',              migration: 'db/migrations/0001_init.sql' },
  { surface: 'preferences',             table: 'preference_overrides',  migration: 'db/migrations/0001_init.sql' },
  { surface: 'watchlists',              table: 'watchlists',            migration: 'db/migrations/0002_watchlists.sql' },
  { surface: 'watchlist_entities',      table: 'watchlist_entities',    migration: 'db/migrations/0002_watchlists.sql' },
  { surface: 'followed',                table: 'followed_targets',      migration: 'db/migrations/0003_followed.sql' },
  { surface: 'alert_subscriptions',     table: 'alert_subscriptions',   migration: 'db/migrations/0004_alerts.sql' },
  { surface: 'alert_dispatch_history',  table: 'alert_dispatch_history', migration: 'db/migrations/0004_alerts.sql' },
];

const API_ROUTES = [
  '/api/account/init',
  '/api/account/preferences',
  '/api/account/watchlists',
  '/api/account/followed',
];

function build() {
  const stamp = new Date().toISOString();
  return {
    schema_version: '2.0',
    generated_at: stamp,
    source_layer: 'personal-state-contracts',
    contracts_version: '2.0.0',
    mode: 'postgres',
    write_enabled: true,
    storage: {
      backend: 'neon-postgres',
      provisioned_via: 'vercel-marketplace',
      env_var: 'DATABASE_URL',
      driver: '@neondatabase/serverless',
      driver_mode: 'http',
      // The repository-file layout from Phase 221 v1 is EXPLICITLY
      // forbidden. The validator hard-fails if any tool ever writes
      // under data/accounts/ — preventing accidental regression to a
      // non-scalable architecture.
      legacy_repo_path_forbidden: 'data/accounts/',
      file_layout_deprecated: true,
      note_en: 'Per-account state lives in Neon Postgres. The repository never stores per-account data. Schema lives under db/migrations/; client + auth helpers under db/.',
      note_ar: 'حالة كل حساب تعيش في Neon Postgres. لا يخزّن المستودع بيانات لكل حساب. مخطّط البيانات تحت db/migrations/ والمساعدات تحت db/.',
    },
    tables: STATE_TABLES,
    api_routes: API_ROUTES,
    auth_provider: {
      provider: 'clerk',
      session_verification: 'db/auth.js requireAccount() using @clerk/backend verifyToken with CLERK_SECRET_KEY (server-side only)',
      account_id_field: 'sub claim from Clerk session JWT',
    },
    governance: {
      no_real_account_ids_in_repo: true,
      no_email_addresses_in_repo: true,
      no_session_tokens_in_repo: true,
      no_per_account_files_in_repo: true,
      validator_enforces_postgres_backend: true,
      validator_enforces_no_data_accounts_dir: true,
      api_routes_require_clerk_token: true,
      cross_account_reads_disallowed: true,
      cascading_delete_via_foreign_keys: true,
    },
    integration_points: {
      auth_provider: 'data/intelligence/auth-foundation.json',
      identity_schema: 'data/intelligence/account-identity.json',
      preference_enums: 'data/intelligence/preferences.json',
      alert_classes: 'data/intelligence/alert-contracts.json',
      billing_tiers: 'data/intelligence/billing-contracts.json',
    },
    migration_runner: {
      script: 'tools/apply-migrations.js',
      command: 'npm run db:migrate',
      idempotent: true,
      advisory_lock_key: 4221221,
      tracking_table: '_migrations',
      runs_during: 'Vercel build (vercel-build.js chain) when DATABASE_URL is set',
    },
    allowed_preference_keys: Object.keys(ALLOWED_PREFERENCES),
    attribution: {
      sources: ['tools/build-personal-state.js', 'db/migrations/*.sql', 'db/client.js', 'db/auth.js', 'api/account/*.js'],
      note: 'Personal state contract v2 — Postgres-backed. Replaces the v1 repository-file design which was incompatible with Vercel\'s read-only serverless filesystem. Migration is enforced: no tool may write to data/accounts/.',
    },
  };
}

if (require.main === module) {
  const out = build();
  console.log(`[personal-state] mode=${out.mode} backend=${out.storage.backend} tables=${out.tables.length} api_routes=${out.api_routes.length}`);
  if (WRITE) {
    fs.writeFileSync(J('personal-state-contracts.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    console.log('[personal-state] wrote personal-state-contracts.json');
  }
}

module.exports = { build, STATE_TABLES, API_ROUTES };
