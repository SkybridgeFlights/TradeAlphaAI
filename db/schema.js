'use strict';

// Runtime account schema guard.
//
// Vercel may expose DATABASE_URL to serverless functions even when it is not
// available to the build step. Account APIs call this once per cold start before
// querying Postgres. It executes the same idempotent DDL migrations used by the
// build-time runner, so missing relations are repaired in the database actually
// serving production traffic.

const fs = require('fs');
const path = require('path');
const { splitSqlStatements } = require('../tools/apply-migrations');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const ADVISORY_LOCK_KEY = 4221221;

let ensurePromise = null;

async function ensureAccountSchema(sql) {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await sql`CREATE TABLE IF NOT EXISTS _migrations (
      id           TEXT PRIMARY KEY,
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
    await sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`;
    try {
      const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^[0-9]+_.+\.sql$/.test(f)).sort();
      for (const file of files) {
        const body = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        const statements = splitSqlStatements(body);
        if (!statements.length) throw new Error(`${file} produced zero executable statements`);
        for (const stmt of statements) await sql.query(stmt);
        await sql`
          INSERT INTO _migrations (id)
          VALUES (${file})
          ON CONFLICT (id) DO NOTHING
        `;
      }
    } finally {
      await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
    }
  })();
  try {
    await ensurePromise;
  } catch (err) {
    ensurePromise = null;
    throw err;
  }
}

module.exports = { ensureAccountSchema };
