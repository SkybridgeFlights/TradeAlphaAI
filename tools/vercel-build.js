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
];

let failed = false;
for (const [name, args] of STEPS) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
  if (r.status !== 0) {
    console.error('[vercel-build] step failed:', name, 'exit', r.status);
    failed = true;
    // Continue the chain — the failure is surfaced at the end so partial
    // progress is still visible. A single failed step does NOT prevent
    // the static deploy because later steps may legitimately depend on
    // earlier ones being fresh (we want them all to run when possible).
  }
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
