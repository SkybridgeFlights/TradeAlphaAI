'use strict';

// Phase 98 validation — canonical workflow operating model.
// Enforces a clean GitHub Actions surface:
//   - exactly the canonical active workflows, no legacy triggers active
//   - each canonical workflow declares name, a purpose comment, and triggers
//   - publishing brains wire social distribution (build-distribution-plan)
//   - social live-posting env flags default to 'false' (preview-only) in any
//     workflow that declares them
//   - archived legacy workflows live under archive/ (GitHub ignores subdirs)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WF_DIR = path.join(ROOT, '.github', 'workflows');
const failures = [];

const CANONICAL = new Set([
  'tradealpha-workflow.yml',         // Unified publishing workflow (schedule-driven; reads data/publishing-schedule.json)
  'manual-social-blast.yml',         // One-shot manual social delivery for an already-published article
  'autonomous-publishing-brain.yml', // Supervisor/engine — workflow_dispatch-only fallback under tradealpha
  'distribution-brain.yml',
  'market-watch.yml',                // Intraday Market Watch
  'articles-brain.yml',              // Now workflow_dispatch-only fallback
  'market-news-brain.yml',           // Now workflow_dispatch-only fallback
  'market-outlook-brain.yml',        // Now workflow_dispatch-only fallback
  'briefs-brain.yml',                // Now workflow_dispatch-only fallback
  'daily-research-brain.yml',        // Now workflow_dispatch-only fallback
  'technical-intelligence-brain.yml', // Now workflow_dispatch-only fallback
  'homepage-feed.yml',               // Phase 117 — homepage intelligence feed refresh (owns index.html feed module)
  'educational-intelligence-brain.yml', // Now workflow_dispatch-only fallback
  'social-approval-runner.yml',      // Phase 100 — manual controlled social delivery (no schedule)
]);

const LEGACY = new Set([
  'editorial-draft-generator.yml', 'editorial-publisher.yml', 'insight-pipeline.yml',
  'market-brief.yml', 'market-outlook-draft-generator.yml', 'market-outlook-publisher.yml',
  'market-outlook-topic-seeder.yml', 'news-analysis-draft.yml', 'publishing-control-center.yml',
  'telegram-backfill.yml', 'telegram-smoke-test.yml',
]);

// Publishing brains that must wire social distribution.
const PUBLISHING_BRAINS = ['articles-brain.yml', 'market-news-brain.yml', 'market-outlook-brain.yml', 'briefs-brain.yml'];
const POSTING_FLAGS = ['ENABLE_X_POSTING', 'ENABLE_FACEBOOK_POSTING', 'ENABLE_INSTAGRAM_POSTING', 'ENABLE_LINKEDIN_POSTING'];

const active = fs.existsSync(WF_DIR) ? fs.readdirSync(WF_DIR).filter((f) => f.endsWith('.yml')) : [];

// No legacy workflow active at the top level.
for (const f of active) {
  if (LEGACY.has(f)) failures.push(`legacy workflow still active: ${f} (move to archive/)`);
  if (!CANONICAL.has(f)) failures.push(`non-canonical workflow active: ${f}`);
}
// All canonical workflows present.
for (const c of CANONICAL) {
  if (!active.includes(c)) failures.push(`canonical workflow missing: ${c}`);
}

// Per-workflow structure.
for (const f of active) {
  const yaml = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
  if (!/^name:\s*\S/m.test(yaml)) failures.push(`${f}: missing name`);
  if (!/^#/m.test(yaml)) failures.push(`${f}: missing purpose comment`);
  if (!/^on:/m.test(yaml)) failures.push(`${f}: missing triggers`);
  // Any declared posting flag must default to false.
  for (const flag of POSTING_FLAGS) {
    const m = yaml.match(new RegExp(`${flag}:\\s*'?([a-z]+)'?`));
    if (m && m[1] !== 'false') failures.push(`${f}: ${flag} must default to 'false' (preview-only), got '${m[1]}'`);
  }
}

// Publishing brains must wire distribution. As of 2026-06-22 the per-section
// brains are workflow_dispatch-only fallbacks; the unified
// tradealpha-workflow.yml owns the scheduled cadence, so the per-section
// schedule requirement no longer applies to them.
for (const f of PUBLISHING_BRAINS) {
  if (!active.includes(f)) continue;
  const yaml = fs.readFileSync(path.join(WF_DIR, f), 'utf8');
  if (!yaml.includes('build-distribution-plan.js')) failures.push(`${f}: not wired to social distribution`);
  if (!/concurrency:/.test(yaml)) failures.push(`${f}: missing concurrency guard`);
}

// The unified workflow must run on a schedule and have a concurrency guard.
if (active.includes('tradealpha-workflow.yml')) {
  const yaml = fs.readFileSync(path.join(WF_DIR, 'tradealpha-workflow.yml'), 'utf8');
  if (!/schedule:/.test(yaml)) failures.push('tradealpha-workflow.yml: missing schedule (must drive daily cadence)');
  if (!/concurrency:/.test(yaml)) failures.push('tradealpha-workflow.yml: missing concurrency guard');
  if (!yaml.includes('tradealpha-orchestrator.js')) failures.push('tradealpha-workflow.yml: must invoke tradealpha-orchestrator.js');
  if (!yaml.includes('autonomous-publishing-brain.js')) failures.push('tradealpha-workflow.yml: must invoke autonomous-publishing-brain.js for each slot');
}

// Archived legacy present under archive/.
const archiveDir = path.join(WF_DIR, 'archive');
const archived = fs.existsSync(archiveDir) ? fs.readdirSync(archiveDir).filter((f) => f.endsWith('.yml')) : [];
for (const l of LEGACY) {
  if (!archived.includes(l) && active.includes(l)) failures.push(`legacy ${l} neither archived nor removed`);
}

if (failures.length) {
  failures.forEach((f) => console.error(`[workflows] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[workflows] check:workflows passed (${active.length} canonical active, ${archived.length} archived).`);
