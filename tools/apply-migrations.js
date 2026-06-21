'use strict';

// Phase 221-Pg CP1 - Postgres migration runner.
//
// Applies db/migrations/*.sql in lexicographic order against the Neon
// instance pointed to by DATABASE_URL. Idempotent: tracks applied versions in
// _migrations and skips files already applied. An advisory lock prevents
// concurrent deploys from racing.
//
// If DATABASE_URL is absent (some Vercel build environments do not expose
// runtime-only secrets), the runner skips. Runtime API handlers also perform an
// idempotent schema ensure against the same DATABASE_URL they query.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const ADVISORY_LOCK_KEY = 4221221;

function splitSqlStatements(body) {
  // Migration files use plain DDL only. Strip SQL line comments before
  // splitting; never discard an entire chunk merely because it starts with a
  // comment. That was the production bug: leading comments caused CREATE TABLE
  // statements to be skipped before later indexes/references failed.
  return String(body || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, '').trimEnd())
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map((stmt) => stmt.trim())
    .filter(Boolean);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[migrations] DATABASE_URL not set - skipping build-time migration');
    process.exit(0);
  }

  let neon;
  try {
    ({ neon } = require('@neondatabase/serverless'));
  } catch (e) {
    console.error('[migrations] @neondatabase/serverless not installed - run npm install first');
    process.exit(1);
  }

  const sql = neon(url);

  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    id           TEXT PRIMARY KEY,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  await sql`SELECT pg_advisory_lock(${ADVISORY_LOCK_KEY})`;

  try {
    const applied = new Set((await sql`SELECT id FROM _migrations`).map((r) => r.id));
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => /^[0-9]+_.+\.sql$/.test(f)).sort();
    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[migrations] skip ${file} (already applied)`);
        continue;
      }
      const body = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const statements = splitSqlStatements(body);
      if (!statements.length) throw new Error(`${file} produced zero executable statements`);
      for (const stmt of statements) {
        await sql(stmt);
      }
      await sql`INSERT INTO _migrations (id) VALUES (${file})`;
      console.log(`[migrations] applied ${file} (${statements.length} statements)`);
      count += 1;
    }
    console.log(`[migrations] done - applied ${count} new migration(s); ${applied.size + count} total`);
  } finally {
    await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[migrations] FAIL:', err && err.message || err);
    process.exit(1);
  });
}

module.exports = { splitSqlStatements };
