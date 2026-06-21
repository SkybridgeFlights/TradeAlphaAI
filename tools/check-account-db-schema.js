'use strict';

// Production account DB schema audit.
//
// Connects to DATABASE_URL with the same Neon serverless driver used by
// account APIs, lists actual public tables, and verifies the Postgres-backed
// account schema exists. Secrets are never printed; connection identity is
// reduced to host/database/user plus a short URL fingerprint.

const crypto = require('crypto');

const REQUIRED_TABLES = [
  'accounts',
  'preference_overrides',
  'watchlists',
  'watchlist_entities',
  'followed_targets',
  'alert_subscriptions',
  'alert_dispatch_history',
  '_migrations',
];

const REQUIRED_COLUMNS = {
  accounts: ['account_id', 'primary_email_hash', 'locale', 'tier', 'created_at', 'last_seen_at', 'deleted_at'],
  preference_overrides: ['account_id', 'name', 'value', 'updated_at'],
  watchlists: ['id', 'account_id', 'slug', 'title_en', 'title_ar', 'thesis_en', 'thesis_ar', 'created_at', 'updated_at'],
  watchlist_entities: ['watchlist_id', 'type', 'symbol', 'slug', 'position', 'added_at'],
  followed_targets: ['account_id', 'target_kind', 'target_id', 'followed_at'],
  alert_subscriptions: ['account_id', 'alert_class', 'channel', 'enabled', 'created_at', 'updated_at'],
  alert_dispatch_history: ['id', 'account_id', 'alert_class', 'event_id', 'channel', 'dispatched_at', 'outcome', 'detail'],
  _migrations: ['id', 'applied_at'],
};

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function describeDatabaseUrl(url) {
  if (!url) return { present: false };
  try {
    const u = new URL(url);
    return {
      present: true,
      host: u.host,
      database: u.pathname.replace(/^\/+/, '') || null,
      user: u.username || null,
      sslmode: u.searchParams.get('sslmode') || null,
      url_hash: fingerprint(url),
    };
  } catch {
    return { present: true, parse_error: true, url_hash: fingerprint(url) };
  }
}

function checkSnapshot(snapshot) {
  const fails = [];
  const tableSet = new Set((snapshot.tables || []).map((t) => t.table_name || t));
  for (const table of REQUIRED_TABLES) {
    if (!tableSet.has(table)) fails.push(`missing table ${table}`);
  }
  const columnsByTable = {};
  for (const row of snapshot.columns || []) {
    if (!columnsByTable[row.table_name]) columnsByTable[row.table_name] = new Set();
    columnsByTable[row.table_name].add(row.column_name);
  }
  for (const [table, cols] of Object.entries(REQUIRED_COLUMNS)) {
    const actual = columnsByTable[table] || new Set();
    for (const col of cols) {
      if (!actual.has(col)) fails.push(`missing column ${table}.${col}`);
    }
  }
  return fails;
}

async function collectSnapshot(sql) {
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `;
  const columns = await sql`
    SELECT table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position
  `;
  const migrations = await sql`
    SELECT to_regclass('public._migrations')::text AS exists
  `;
  let appliedMigrations = [];
  if (migrations[0] && migrations[0].exists) {
    appliedMigrations = await sql`SELECT id, applied_at FROM _migrations ORDER BY id`;
  }
  return { tables, columns, applied_migrations: appliedMigrations };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const requireUrl = args.has('--require-url');
  const url = process.env.DATABASE_URL;
  const identity = describeDatabaseUrl(url);
  console.log('[account-db-schema] database_url=' + JSON.stringify(identity));
  if (!url) {
    const msg = '[account-db-schema] DATABASE_URL missing';
    if (requireUrl) {
      console.error(`${msg} (required)`);
      process.exit(1);
    }
    console.warn(`${msg} - skipping live schema audit`);
    return;
  }
  let neon;
  try {
    ({ neon } = require('@neondatabase/serverless'));
  } catch (e) {
    console.error('[account-db-schema] @neondatabase/serverless not installed');
    process.exit(1);
  }
  const sql = neon(url);
  const snapshot = await collectSnapshot(sql);
  const tableNames = snapshot.tables.map((t) => t.table_name);
  console.log('[account-db-schema] tables=' + tableNames.join(','));
  console.log('[account-db-schema] migrations=' + snapshot.applied_migrations.map((m) => m.id).join(','));
  const fails = checkSnapshot(snapshot);
  if (fails.length) {
    fails.forEach((f) => console.error('[account-db-schema] FAIL:', f));
    process.exit(1);
  }
  console.log('[account-db-schema] OK');
}

function selfTest() {
  const good = {
    tables: REQUIRED_TABLES.map((table_name) => ({ table_name })),
    columns: Object.entries(REQUIRED_COLUMNS).flatMap(([table_name, cols]) => cols.map((column_name) => ({ table_name, column_name }))),
  };
  const bad = JSON.parse(JSON.stringify(good));
  bad.tables = bad.tables.filter((t) => t.table_name !== 'accounts');
  bad.columns = bad.columns.filter((c) => !(c.table_name === 'watchlists' && c.column_name === 'account_id'));
  const cases = [
    ['good schema passes', checkSnapshot(good).length === 0],
    ['missing table fails', checkSnapshot(bad).some((f) => f.includes('missing table accounts'))],
    ['missing column fails', checkSnapshot(bad).some((f) => f.includes('missing column watchlists.account_id'))],
    ['database URL redacts password', !Object.prototype.hasOwnProperty.call(describeDatabaseUrl('postgres://u:secret-password@example.neon.tech/db?sslmode=require'), 'password')],
  ];
  let ok = 0;
  for (const [name, pass] of cases) {
    if (pass) ok += 1;
    else console.error('[account-db-schema] self-test failed:', name);
  }
  console.log(`[account-db-schema] self-test: ${ok}/${cases.length} passed`);
  process.exit(ok === cases.length ? 0 : 1);
}

if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch((err) => {
    console.error('[account-db-schema] FAIL:', err && err.message || err);
    process.exit(1);
  });
}

module.exports = { REQUIRED_TABLES, REQUIRED_COLUMNS, describeDatabaseUrl, checkSnapshot };
