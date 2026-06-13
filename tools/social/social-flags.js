'use strict';

// Phase 100 — Controlled Social Activation Layer: flag resolution.
//
// Single source of truth for the safety posture of the social activation layer.
// Resolves the explicit env flags with SAFE defaults. The cardinal rule: if a
// flag is missing, it is FALSE for posting and TRUE for approval/dry-run — i.e.
// the safest possible interpretation. No flag here ever reads or requires a
// credential; credentials are checked separately at adapter preflight time.
//
// Default posture (no env set): every platform preview-only, approval required,
// dry-run on. Live posting requires an explicit truthy ENABLE_<PLATFORM>_POSTING.

const PLATFORMS = ['x', 'facebook', 'instagram', 'linkedin'];

// Telegram is intentionally NOT in this list — its delivery is the existing,
// separate, URL-verified canonical path and is untouched by this layer.

const POSTING_FLAG = {
  x: 'ENABLE_X_POSTING',
  facebook: 'ENABLE_FACEBOOK_POSTING',
  instagram: 'ENABLE_INSTAGRAM_POSTING',
  linkedin: 'ENABLE_LINKEDIN_POSTING',
};

// A flag is "true" only when explicitly the string 'true' (case-insensitive) or
// '1'. Anything else (missing, '', 'false', 'no', garbage) resolves to false.
function envTrue(name, env) {
  const raw = (env[name] ?? '').toString().trim().toLowerCase();
  return raw === 'true' || raw === '1';
}

// A flag that defaults TRUE when missing (used for approval/dry-run safety
// rails): only an explicit 'false'/'0' turns it off.
function envTrueByDefault(name, env) {
  const raw = (env[name] ?? '').toString().trim().toLowerCase();
  if (raw === '') return true;
  return !(raw === 'false' || raw === '0');
}

function postingEnabled(platform, env = process.env) {
  const flag = POSTING_FLAG[platform];
  if (!flag) return false;
  return envTrue(flag, env);
}

function requireApproval(env = process.env) {
  // Defaults TRUE — approval is required unless explicitly disabled.
  return envTrueByDefault('REQUIRE_SOCIAL_APPROVAL', env);
}

function dryRun(env = process.env) {
  // Defaults TRUE — dry-run unless explicitly SOCIAL_DRY_RUN=false.
  return envTrueByDefault('SOCIAL_DRY_RUN', env);
}

// The effective mode for a platform, in increasing capability:
//   'disabled'          — posting flag false (the default). Never touches network.
//   'dry_run'           — posting flag true but SOCIAL_DRY_RUN still on. Simulates only.
//   'live'              — posting flag true AND dry-run off. The only mode that may
//                          attempt delivery, and only after every per-item gate passes.
function modeFor(platform, env = process.env) {
  if (!postingEnabled(platform, env)) return 'disabled';
  if (dryRun(env)) return 'dry_run';
  return 'live';
}

function resolveAll(env = process.env) {
  const platforms = {};
  for (const p of PLATFORMS) {
    platforms[p] = {
      posting_enabled: postingEnabled(p, env),
      mode: modeFor(p, env),
    };
  }
  return {
    platforms,
    require_approval: requireApproval(env),
    dry_run: dryRun(env),
    // Convenience: true only if at least one platform is in genuine live mode.
    any_live: PLATFORMS.some((p) => modeFor(p, env) === 'live'),
  };
}

module.exports = {
  PLATFORMS,
  POSTING_FLAG,
  envTrue,
  envTrueByDefault,
  postingEnabled,
  requireApproval,
  dryRun,
  modeFor,
  resolveAll,
};
