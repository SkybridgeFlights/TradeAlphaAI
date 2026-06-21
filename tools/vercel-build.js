'use strict';

// Vercel build entrypoint — Phase 220 activation.
//
// Vercel runs this in its build environment where CLERK_PUBLISHABLE_KEY
// + CLERK_INSTANCE_URL are set. We chain the auth-foundation pipeline
// so the deploy reflects the live (hosted) state:
//
//   1. inject-clerk-config.js     writes js/clerk-config.js
//   2. build-auth-foundation.js   reads config → mode=hosted artifact
//   3. build-account-foundation.js mirrors mode into umbrella
//   4. generate-auth-pages.js     regenerates 8 pages with hosted markers
//
// outputDirectory is "." in vercel.json so Vercel serves from repo root
// after the build chain finishes.

const { spawnSync } = require('child_process');
const path = require('path');

const STEPS = [
  ['inject-clerk-config', ['tools/inject-clerk-config.js']],
  ['auth-foundation',     ['tools/build-auth-foundation.js', '--write']],
  ['account-foundation',  ['tools/build-account-foundation.js', '--write']],
  ['auth-pages',          ['tools/generate-auth-pages.js', '--write']],
  // Phase 221-Pg — apply Postgres migrations. Idempotent + advisory-
  // locked so concurrent deploys cannot race. Skips gracefully when
  // DATABASE_URL is missing (e.g. preview deploy without Neon branch).
  ['db-migrate',          ['tools/apply-migrations.js']],
  ['db-schema-check',     ['tools/check-account-db-schema.js']],
];

let failed = false;
let hardFailed = false;
for (const [name, args] of STEPS) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  if (r.status !== 0) {
    console.error('[vercel-build] step failed:', name, 'exit', r.status);
    failed = true;
    if (name === 'db-migrate' || name === 'db-schema-check') hardFailed = true;
    // Continue the chain — the failure is surfaced at the end so partial
    // progress is still visible. A single failed step does NOT prevent
    // the static deploy because later steps may legitimately depend on
    // earlier ones being fresh (we want them all to run when possible).
  }
}
if (hardFailed) {
  console.error('[vercel-build] database activation failed - blocking deploy because account APIs require the production schema');
  process.exit(1);
}
if (failed) {
  console.error('[vercel-build] one or more steps failed — deploy will still ship existing static content');
  // Exit 0 so Vercel still deploys the existing committed static files
  // even if (say) the auth-pages regen had an issue. Validators in the
  // brain workflow catch deeper drift; the deploy itself should never
  // be blocked by a single tool hiccup.
  process.exit(0);
}
console.log('[vercel-build] all auth-activation steps OK');
