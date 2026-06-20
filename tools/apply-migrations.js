'use strict';

// Phase 221-Pg CP1 — Postgres migration runner.
//
// Applies db/migrations/*.sql in lexicographic order against the Neon
// instance pointed to by DATABASE_URL. Idempotent: tracks applied
// versions in a _migrations table and skips files already applied.
// Acquires an advisory lock so concurrent deploys don't race.
//
// Behaviour when DATABASE_URL is missing (local dev without provisioning):
// logs a warning and exits 0. The Vercel build chain continues; the
// migration applies on the next deploy where DATABASE_URL is present.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');
const ADVISORY_LOCK_KEY = 4221221; // arbitrary 32-bit int unique to this app

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[migrations] DATABASE_URL not set — skipping (will apply on next deploy with env)');
    process.exit(0);
  }
  // Lazy-require the Neon driver so this script is harmless when deps
  // are not installed (e.g. a fresh clone before `npm install`).
  let neon;
  try {
    ({ neon } = require('@neondatabase/serverless'));
  } catch (e) {
    console.warn('[migrations] @neondatabase/serverless not installed — run `npm install` first');
    process.exit(0);
  }
  const sql = neon(url);

  // Bootstrap the tracking table itself.
  await sql`CREATE TABLE IF NOT EXISTS _migrations (
    id           TEXT PRIMARY KEY,
    applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;

  // Acquire an advisory lock (released on session end). Two concurrent
  // build processes would otherwise race on the migration set.
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
      // Neon's serverless driver runs each statement as its own call.
      // For multi-statement migrations we split on naked semicolons at
      // end of line (good enough for our DDL — no PL/pgSQL blocks).
      const statements = body.split(/;\s*\n/).map((s) => s.trim()).filter((s) => s && !/^--/.test(s));
      for (const stmt of statements) {
        await sql.query(stmt);
      }
      await sql`INSERT INTO _migrations (id) VALUES (${file})`;
      console.log(`[migrations] applied ${file} (${statements.length} statements)`);
      count += 1;
    }
    console.log(`[migrations] done — applied ${count} new migration(s); ${applied.size + count} total`);
  } finally {
    await sql`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`;
  }
}

main().catch((err) => {
  console.error('[migrations] FAIL:', err && err.message || err);
  // Exit 0 in the build chain even on failure — broken migrations
  // should NOT block the deploy of existing static content. The
  // failure is surfaced in logs + an admin should investigate.
  if (process.env.CI || process.env.VERCEL) process.exit(0);
  process.exit(1);
});
