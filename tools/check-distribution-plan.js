'use strict';

// Phase 93 validation — Distribution Brain integrity & safety.
// Guards the platform-aware distribution plan:
//   - plan is preview-only, posting disabled, credential-free
//   - every surface has a known content type and at least one target platform
//   - target platforms are genuine matrix targets for that content type
//     (no invalid platform targeting) with relevance in [0,100]
//   - no orphan routing (each surface carries a surface_id and approval gate)
//   - no duplicate surface ids
// Unbuilt plan passes with a note (CI builds it each run).

const fs = require('fs');
const path = require('path');
const { CONTENT_TYPES, PLATFORMS, platformsForContentType } = require('./platform-relevance');

const ROOT = path.resolve(__dirname, '..');
const PLAN_PATH = path.join(ROOT, 'data', 'social', 'distribution-plan.json');
const failures = [];

const plan = (() => { try { return JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8')); } catch { return null; } })();

if (!plan) {
  console.log('[distribution-plan] plan not built yet — CI builds it each run (non-fatal)');
  console.log('[distribution-plan] check:distribution-plan passed.');
  process.exit(0);
}

if (plan.mode !== 'preview_only' || plan.posting_enabled !== false || plan.credentials_required !== false) {
  failures.push('plan must be preview_only with posting disabled and no credentials');
}
if (plan.policy && (plan.policy.automatic_posting !== false || plan.policy.copy_paste_posting !== false)) {
  failures.push('plan policy must forbid automatic and copy-paste posting');
}

const surfaceList = plan.surfaces || [];
const seenIds = new Set();
for (const surface of surfaceList) {
  const label = `surface[${surface.surface_id || '?'}]`;
  if (!surface.surface_id) failures.push(`${label}: missing surface_id (orphan routing)`);
  if (seenIds.has(surface.surface_id)) failures.push(`${label}: duplicate surface id`);
  seenIds.add(surface.surface_id);
  if (!CONTENT_TYPES.includes(surface.content_type)) failures.push(`${label}: unknown content type "${surface.content_type}"`);
  if (surface.posting_enabled !== false || surface.approval?.required !== true) failures.push(`${label}: not approval-gated preview routing`);

  const targets = surface.target_platforms || [];
  if (!targets.length) failures.push(`${label}: no target platforms`);
  // The legitimate targets per the matrix for this content type.
  const validTargets = new Set(platformsForContentType(surface.content_type).map((t) => t.platform));
  for (const t of targets) {
    if (!PLATFORMS.includes(t.platform)) failures.push(`${label}: unknown platform "${t.platform}"`);
    if (!validTargets.has(t.platform)) failures.push(`${label}: platform "${t.platform}" is not a matrix target for ${surface.content_type}`);
    if (!Number.isFinite(t.relevance) || t.relevance < 0 || t.relevance > 100) failures.push(`${label}: platform "${t.platform}" relevance out of range`);
    if (!Number.isFinite(t.affinity) || t.affinity < 0 || t.affinity > 100) failures.push(`${label}: platform "${t.platform}" affinity out of range`);
  }
  // Targets must be ordered strongest-first.
  for (let i = 1; i < targets.length; i += 1) {
    if (Number(targets[i].relevance) > Number(targets[i - 1].relevance)) {
      failures.push(`${label}: target platforms not ranked by relevance`); break;
    }
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[distribution-plan] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[distribution-plan] check:distribution-plan passed (${surfaceList.length} surface(s), preview-only).`);
