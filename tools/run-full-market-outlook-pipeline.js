'use strict';

// Full Market Outlook Pipeline
// Orchestrates: seed (if needed) → generate draft → verify auto-approval → publish
// Exits non-zero with a named skip reason if any step cannot complete.
// Pass --dry-run=true to report what would happen without writing files.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const QUEUE_PATH  = path.join(ROOT, 'data', 'market-outlook-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'market-outlook-history.json');
const SITE_URL    = 'https://tradealphaai.com';
const DRY_RUN     = process.argv.includes('--dry-run=true') || process.argv.includes('--dry-run');

// ── Named skip reasons (printed to stderr for workflow log parsing) ───────────
const SKIP = {
  NO_ELIGIBLE_TOPIC:     'NO_ELIGIBLE_TOPIC',
  GENERATION_FAILED:     'GENERATION_FAILED',
  SCORE_TOO_LOW:         'SCORE_TOO_LOW',
  AUTO_APPROVAL_FAILED:  'AUTO_APPROVAL_FAILED',
  DUPLICATE_BLOCKED:     'DUPLICATE_BLOCKED',
  SAFETY_CHECK_FAILED:   'SAFETY_CHECK_FAILED',
  PUBLISH_FAILED:        'PUBLISH_FAILED',
};

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { abort(SKIP.SAFETY_CHECK_FAILED, `Cannot parse ${path.basename(file)}: ${e.message}`); }
}

function readQueue() { return readJson(QUEUE_PATH, { topics: [] }); }

function run(args, { inherit = true } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
  return { status: result.status || 0, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function runNpm(scriptArgs, { inherit = true } = {}) {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(cmd, ['run', ...scriptArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
  return { status: result.status || 0, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function abort(reason, detail = '') {
  process.stderr.write(`\n[PIPELINE SKIPPED] ${reason}\n`);
  if (detail) process.stderr.write(`  Detail: ${detail}\n`);
  process.stderr.write('\n');
  process.exit(DRY_RUN ? 0 : 1);
}

function isPublished(slug) {
  return fs.existsSync(path.join(ROOT, 'market-outlook', `${slug}.html`));
}

function isHistoryPublished(slug) {
  const h = readJson(HISTORY_PATH, { publications: [] });
  return (h.publications || []).some(p => p.slug === slug);
}

function isApproved(t) {
  return t.status === 'reviewed' &&
    t.review_status === 'approved' &&
    !isPublished(t.slug) &&
    !isHistoryPublished(t.slug);
}

function isDraftEligible(t) {
  return (t.status === 'planned' || t.status === 'draft') &&
    !isPublished(t.slug) &&
    !isHistoryPublished(t.slug);
}

function getScore(slug) {
  const result = run([
    path.join(__dirname, 'score-generated-content.js'),
    `--slug=${slug}`,
    '--type=market_outlook'
  ], { inherit: false });

  if (result.status !== 0 || !result.stdout.trim()) return null;
  try {
    const report = JSON.parse(result.stdout);
    return (report.results || []).find(r => r.slug === slug) || null;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE START
// ═══════════════════════════════════════════════════════════════════════════════

console.log('======================================================');
console.log('  FULL MARKET OUTLOOK PIPELINE');
console.log(`  Date:    ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`);
console.log(`  Dry run: ${DRY_RUN}`);
console.log('======================================================\n');

// ── Phase 1: Find approved topic (skip generation if one already exists) ──────

let queue = readQueue();
let approvedTopic = (queue.topics || []).find(isApproved);
let targetSlug = null;

if (approvedTopic) {
  console.log(`[Phase 1] Found already-approved topic: ${approvedTopic.slug}`);
  console.log('  → Skipping seed and generation — publishing directly.\n');
  targetSlug = approvedTopic.slug;
} else {
  // ── Phase 2: Find or seed a planned/draft topic ─────────────────────────────

  let eligible = (queue.topics || []).find(isDraftEligible);

  if (!eligible) {
    console.log('[Phase 2] No planned/draft topic found — running seeder...');
    const seedResult = run([path.join(__dirname, 'seed-market-outlook-topics.js')]);
    if (seedResult.status !== 0) {
      abort(SKIP.NO_ELIGIBLE_TOPIC, 'Seeder exited non-zero and no topics exist in the queue.');
    }
    queue = readQueue();
    eligible = (queue.topics || []).find(isDraftEligible);
    if (!eligible) {
      abort(SKIP.NO_ELIGIBLE_TOPIC, 'Seeder ran but added no eligible (planned/draft) topic to the queue.');
    }
    console.log(`  Seeder added: ${eligible.slug}\n`);
  } else {
    console.log(`[Phase 2] Eligible topic for generation: ${eligible.slug} (status=${eligible.status})\n`);
  }

  // ── Phase 3: Generate draft (skip if draft files already exist) ─────────────

  const draftEnPath = path.join(ROOT, 'drafts', 'market-outlook', eligible.slug, 'en.html');
  const draftArPath = path.join(ROOT, 'drafts', 'market-outlook', eligible.slug, 'ar.html');
  const draftExists = fs.existsSync(draftEnPath) && fs.existsSync(draftArPath);

  if (draftExists) {
    console.log(`[Phase 3] Draft files already exist for ${eligible.slug} — skipping generation.`);
  } else {
    console.log(`[Phase 3] Generating draft for: ${eligible.slug}`);
    const genResult = run([path.join(__dirname, 'generate-market-outlook-draft.js')]);
    if (genResult.status !== 0) {
      abort(SKIP.GENERATION_FAILED, `generate-market-outlook-draft.js exited with status ${genResult.status}`);
    }
    if (!fs.existsSync(draftEnPath) || !fs.existsSync(draftArPath)) {
      abort(SKIP.GENERATION_FAILED, `Draft files missing after generation: ${eligible.slug}`);
    }
    console.log(`  Draft files written.\n`);
  }

  // ── Phase 4: Verify auto-approval OR re-attempt it ─────────────────────────

  queue = readQueue();
  const afterGen = (queue.topics || []).find(t => t.slug === eligible.slug);

  if (!afterGen) {
    abort(SKIP.GENERATION_FAILED, `${eligible.slug} disappeared from queue after generation.`);
  }

  if (afterGen.status === 'reviewed' && afterGen.review_status === 'approved') {
    console.log(`[Phase 4] Auto-approval confirmed in queue: ${eligible.slug}`);
  } else {
    // Draft exists but auto-approval didn't happen (possibly draft was pre-existing)
    // Re-attempt approval by running the scorer manually
    console.log(`[Phase 4] Topic is ${afterGen.status}/${afterGen.review_status} — re-attempting auto-approval...`);
    const entry = getScore(eligible.slug);

    if (!entry) {
      abort(SKIP.AUTO_APPROVAL_FAILED, `Scorer returned no result for ${eligible.slug}`);
    }

    console.log(`  Quality score: ${entry.quality_score}/100`);
    const failed = Object.entries(entry.checks).filter(([, v]) => !v).map(([k]) => k);

    if (entry.quality_score < 85) {
      abort(SKIP.SCORE_TOO_LOW,
        `Score ${entry.quality_score}/100 < 85. Failed checks: ${failed.join(', ') || '(score too low)'}`);
    }
    if (failed.length > 0) {
      abort(SKIP.AUTO_APPROVAL_FAILED, `Failed checks: ${failed.join(', ')}`);
    }

    // Write approval to queue
    const approveDate = new Date().toISOString().slice(0, 10);
    afterGen.status = 'reviewed';
    afterGen.review_status = 'approved';
    afterGen.last_reviewed = approveDate;
    queue.updated = approveDate;
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
    console.log(`  Re-approval written to queue.\n`);
  }

  targetSlug = eligible.slug;
}

// ── Phase 5: Pre-publish safety gate ──────────────────────────────────────────

console.log('[Phase 5] Running pre-publish safety checks...');
const editorialResult = runNpm(['check:editorial']);
if (editorialResult.status !== 0) {
  abort(SKIP.SAFETY_CHECK_FAILED, 'npm run check:editorial failed — fix the queue before publishing.');
}

// ── Phase 6: Quality score gate (min 85) ──────────────────────────────────────

console.log(`\n[Phase 6] Quality score gate for: ${targetSlug}`);
const scoreEntry = getScore(targetSlug);
if (!scoreEntry) {
  abort(SKIP.SCORE_TOO_LOW, `Scorer returned no result for ${targetSlug}`);
}
console.log(`  Score: ${scoreEntry.quality_score}/100`);
if (scoreEntry.quality_score < 85) {
  const failed = Object.entries(scoreEntry.checks).filter(([, v]) => !v).map(([k]) => k);
  abort(SKIP.SCORE_TOO_LOW,
    `Score ${scoreEntry.quality_score}/100 < 85. Failed: ${failed.join(', ') || '(score too low)'}`);
}
console.log('  Quality gate passed.\n');

// ── Phase 7: Duplicate protection ─────────────────────────────────────────────

if (isPublished(targetSlug) || isHistoryPublished(targetSlug)) {
  abort(SKIP.DUPLICATE_BLOCKED, `${targetSlug} is already published on disk or in history.`);
}

// ── Phase 8: Dry-run exit ──────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log('[DRY RUN] All gates passed. Would publish:');
  console.log(`  EN: ${SITE_URL}/market-outlook/${targetSlug}.html`);
  console.log(`  AR: ${SITE_URL}/ar/market-outlook/${targetSlug}.html`);
  console.log('\n[DRY RUN] No files written or committed.\n');
  process.exit(0);
}

// ── Phase 9: Publish (--force-date bypasses target_publish_date gate) ──────────

console.log(`[Phase 9] Publishing: ${targetSlug}`);
const publishResult = run([
  path.join(__dirname, 'publish-market-outlook.js'),
  `--slug=${targetSlug}`,
  '--execute',
  '--force-date'
]);

if (publishResult.status !== 0) {
  abort(SKIP.PUBLISH_FAILED, `publish-market-outlook.js exited with status ${publishResult.status}`);
}

// Verify files landed on disk
if (!isPublished(targetSlug)) {
  abort(SKIP.PUBLISH_FAILED, `Publish script reported success but market-outlook/${targetSlug}.html is missing.`);
}

// ── Final report ───────────────────────────────────────────────────────────────

console.log('\n======================================================');
console.log('  PIPELINE COMPLETE');
console.log(`  Published: ${targetSlug}`);
console.log(`  EN URL:  ${SITE_URL}/market-outlook/${targetSlug}.html`);
console.log(`  AR URL:  ${SITE_URL}/ar/market-outlook/${targetSlug}.html`);
console.log('======================================================\n');
