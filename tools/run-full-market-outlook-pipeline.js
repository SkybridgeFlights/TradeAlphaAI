'use strict';

// Full Market Outlook Pipeline
// Orchestrates: seed (if needed) → generate draft → verify auto-approval → publish
// Exits non-zero with a named skip reason if any step cannot safely complete.
// Pass --dry-run=true to validate all gates without writing files.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT         = path.resolve(__dirname, '..');
const QUEUE_PATH   = path.join(ROOT, 'data', 'market-outlook-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'market-outlook-history.json');
const SITE_URL     = 'https://tradealphaai.com';
const DRY_RUN      = process.argv.includes('--dry-run=true') || process.argv.includes('--dry-run');

// ── Named skip reasons ────────────────────────────────────────────────────────
const SKIP = {
  NO_ELIGIBLE_TOPIC:     'NO_ELIGIBLE_TOPIC',
  GENERATION_FAILED:     'GENERATION_FAILED',
  SCORE_TOO_LOW:         'SCORE_TOO_LOW',
  AUTO_APPROVAL_FAILED:  'AUTO_APPROVAL_FAILED',
  DUPLICATE_BLOCKED:     'DUPLICATE_BLOCKED',
  SAFETY_CHECK_FAILED:   'SAFETY_CHECK_FAILED',
  PUBLISH_FAILED:        'PUBLISH_FAILED',
};

// ── Pipeline state (tracked for final summary) ────────────────────────────────
const state = {
  generated:     false,
  approved:      false,
  published:     false,
  telegram_sent: false,
  slug:          null,
  en_url:        null,
  ar_url:        null,
  skip_reason:   null,
};

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) {
    abort(SKIP.SAFETY_CHECK_FAILED, `Cannot parse ${path.basename(file)}: ${e.message}`);
  }
}

function readQueue() { return readJson(QUEUE_PATH, { topics: [] }); }

function run(args, { inherit = true } = {}) {
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
  return { status: result.status != null ? result.status : 1, stdout: result.stdout || '', stderr: result.stderr || '' };
}

function runNpm(scriptName) {
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(cmd, ['run', scriptName], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  return result.status != null ? result.status : 1;
}

function abort(reason, detail = '') {
  state.skip_reason = reason;
  process.stderr.write(`\n[PIPELINE SKIPPED] ${reason}\n`);
  if (detail) process.stderr.write(`  Detail: ${detail}\n\n`);
  printSummary();
  process.exit(DRY_RUN ? 0 : 1);
}

function printSummary() {
  console.log('\n======================================================');
  console.log('  FULL PIPELINE RESULT');
  console.log('======================================================');
  console.log(`  generated:      ${state.generated ? 'yes' : 'no'}`);
  console.log(`  approved:       ${state.approved  ? 'yes' : 'no'}`);
  console.log(`  published:      ${state.published ? 'yes' : 'no'}`);
  console.log(`  telegram_sent:  ${state.telegram_sent ? 'yes' : 'no'}`);
  if (state.slug) {
    console.log(`  final_slug:     ${state.slug}`);
    console.log(`  en_url:         ${state.en_url}`);
    console.log(`  ar_url:         ${state.ar_url}`);
  }
  if (state.skip_reason) {
    console.log(`  skip_reason:    ${state.skip_reason}`);
  }
  console.log('======================================================\n');
}

function isPublishedOnDisk(slug) {
  return fs.existsSync(path.join(ROOT, 'market-outlook', `${slug}.html`));
}

function isInHistory(slug) {
  const h = readJson(HISTORY_PATH, { publications: [] });
  return (h.publications || []).some(p => p.slug === slug);
}

function printTopicCheck(t, { forceDate = false, context = '' } = {}) {
  const inHistory = isInHistory(t.slug);
  const onDisk    = isPublishedOnDisk(t.slug);
  const today     = new Date().toISOString().slice(0, 10);
  const dateOk    = forceDate || (t.target_publish_date || '') <= today;
  const approved  = t.status === 'reviewed' && t.review_status === 'approved';
  const eligible  = approved && dateOk && !inHistory && !onDisk;

  let reason = '';
  if (t.status !== 'reviewed')               reason = `status=${t.status}`;
  else if (t.review_status !== 'approved')   reason = `review_status=${t.review_status}`;
  else if (!dateOk)                          reason = `date_blocked: ${t.target_publish_date} > ${today}`;
  else if (inHistory)                        reason = 'already_in_history';
  else if (onDisk)                           reason = 'file_already_on_disk';

  console.log(
    `[TOPIC CHECK${context ? ' ' + context : ''}]` +
    `  slug=${t.slug}` +
    `  status=${t.status}` +
    `  review_status=${t.review_status}` +
    `  target_publish_date=${t.target_publish_date}` +
    `  force_date=${forceDate}` +
    `  in_history=${inHistory}` +
    `  on_disk=${onDisk}` +
    `  publishable=${eligible}` +
    (reason ? `  rejection_reason=${reason}` : '')
  );
  return eligible;
}

function isApproved(t, { forceDate = false } = {}) {
  return printTopicCheck(t, { forceDate, context: 'approve-check' });
}

function isDraftEligible(t) {
  const onDisk    = isPublishedOnDisk(t.slug);
  const inHistory = isInHistory(t.slug);
  const eligible  = (t.status === 'planned' || t.status === 'draft') && !onDisk && !inHistory;
  console.log(
    `[TOPIC CHECK draft-eligible]` +
    `  slug=${t.slug}  status=${t.status}  on_disk=${onDisk}  in_history=${inHistory}  eligible=${eligible}`
  );
  return eligible;
}

function getScore(slug) {
  const result = run([
    path.join(__dirname, 'score-generated-content.js'),
    `--slug=${slug}`,
    '--type=market_outlook'
  ], { inherit: false });

  if (result.status !== 0 || !result.stdout.trim()) {
    console.log(`[SCORE] Scorer returned non-zero or empty for ${slug}. stderr: ${result.stderr.trim()}`);
    return null;
  }
  try {
    const report = JSON.parse(result.stdout);
    return (report.results || []).find(r => r.slug === slug) || null;
  } catch (e) {
    console.log(`[SCORE] Could not parse scorer output: ${e.message}`);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE START
// ═══════════════════════════════════════════════════════════════════════════════

console.log('======================================================');
console.log('  FULL MARKET OUTLOOK PIPELINE');
console.log(`  Date:    ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`);
console.log(`  Dry run: ${DRY_RUN}`);
console.log('======================================================\n');

// ── Phase 1: Scan queue for already-approved topic (force_date=true for pipeline) ──

console.log('[Phase 1] Scanning queue for approved topics...');
let queue = readQueue();

const approvedTopic = (queue.topics || []).find(t => isApproved(t, { forceDate: true }));

if (approvedTopic) {
  console.log(`\n[Phase 1] Found already-approved topic: ${approvedTopic.slug}`);
  console.log('  → Skipping seed and generation — publishing directly.\n');
  state.slug     = approvedTopic.slug;
  state.approved = true;
} else {
  console.log('\n[Phase 1] No approved topic found — checking for eligible draft topics...');

  // ── Phase 2: Find or seed a planned/draft topic ─────────────────────────────

  let eligible = (queue.topics || []).find(t => isDraftEligible(t));

  if (!eligible) {
    console.log('\n[Phase 2] No planned/draft topic found — running seeder...');
    const seedResult = run([path.join(__dirname, 'seed-market-outlook-topics.js')]);
    if (seedResult.status !== 0) {
      abort(SKIP.NO_ELIGIBLE_TOPIC, 'Seeder exited non-zero and no topics exist in the queue.');
    }
    queue = readQueue();
    console.log('\n[Phase 2] Re-scanning queue after seeding...');
    eligible = (queue.topics || []).find(t => isDraftEligible(t));
    if (!eligible) {
      abort(SKIP.NO_ELIGIBLE_TOPIC, 'Seeder ran but added no eligible (planned/draft) topic to the queue.');
    }
    console.log(`  Seeder added: ${eligible.slug}\n`);
  } else {
    console.log(`\n[Phase 2] Eligible topic for generation: ${eligible.slug} (status=${eligible.status})\n`);
  }

  state.slug = eligible.slug;

  // ── Phase 3: Generate draft (or re-use existing draft files) ─────────────────

  const draftEnPath = path.join(ROOT, 'drafts', 'market-outlook', eligible.slug, 'en.html');
  const draftArPath = path.join(ROOT, 'drafts', 'market-outlook', eligible.slug, 'ar.html');
  const draftExists = fs.existsSync(draftEnPath) && fs.existsSync(draftArPath);

  if (draftExists) {
    console.log(`[Phase 3] Draft files already on disk for ${eligible.slug} — skipping re-generation.`);
  } else {
    console.log(`[Phase 3] Generating draft for: ${eligible.slug}`);
    const genResult = run([path.join(__dirname, 'generate-market-outlook-draft.js')]);
    if (genResult.status !== 0) {
      abort(SKIP.GENERATION_FAILED, `generate-market-outlook-draft.js exited with status ${genResult.status}`);
    }
    if (!fs.existsSync(draftEnPath) || !fs.existsSync(draftArPath)) {
      abort(SKIP.GENERATION_FAILED, `Draft files missing after generation: ${eligible.slug}`);
    }
    state.generated = true;
    console.log(`  Draft files written for ${eligible.slug}\n`);
  }

  // ── Phase 4: Verify auto-approval OR re-attempt it ─────────────────────────

  queue = readQueue();
  const afterGen = (queue.topics || []).find(t => t.slug === eligible.slug);

  if (!afterGen) {
    abort(SKIP.GENERATION_FAILED, `${eligible.slug} disappeared from queue after generation step.`);
  }

  console.log(`\n[Phase 4] Post-generation queue state for ${eligible.slug}:`);
  console.log(`  status:        ${afterGen.status}`);
  console.log(`  review_status: ${afterGen.review_status}`);
  console.log(`  last_reviewed: ${afterGen.last_reviewed || '(unset)'}`);

  if (afterGen.status === 'reviewed' && afterGen.review_status === 'approved') {
    console.log(`  → Auto-approval confirmed in queue. ✓`);
    state.approved = true;
  } else {
    console.log(`  → Not yet approved — re-attempting auto-approval via scorer...`);
    const entry = getScore(eligible.slug);

    if (!entry) {
      abort(SKIP.AUTO_APPROVAL_FAILED, `Scorer returned no result for ${eligible.slug}`);
    }

    console.log(`[SCORE] slug=${eligible.slug}  score=${entry.quality_score}/100`);
    const failed = Object.entries(entry.checks).filter(([, v]) => !v).map(([k]) => k);
    for (const [check, pass] of Object.entries(entry.checks)) {
      console.log(`  ${pass ? '✓' : '✗'} ${check}`);
    }

    if (entry.quality_score < 85) {
      abort(SKIP.SCORE_TOO_LOW,
        `Score ${entry.quality_score}/100 < 85. Failed checks: ${failed.join(', ') || '(score too low)'}`);
    }
    if (failed.length > 0) {
      abort(SKIP.AUTO_APPROVAL_FAILED, `Failed checks: ${failed.join(', ')}`);
    }

    const approveDate = new Date().toISOString().slice(0, 10);
    afterGen.status        = 'reviewed';
    afterGen.review_status = 'approved';
    afterGen.last_reviewed = approveDate;
    queue.updated          = approveDate;
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + '\n');
    console.log(`  → Approval written to queue. ✓\n`);
    state.approved = true;
  }
}

const targetSlug = state.slug;

// ── Phase 5: Pre-publish safety gate ──────────────────────────────────────────

console.log('[Phase 5] Running pre-publish safety checks...');
const safetyStatus = runNpm('check:editorial');
if (safetyStatus !== 0) {
  abort(SKIP.SAFETY_CHECK_FAILED, 'npm run check:editorial failed — fix the queue before publishing.');
}
console.log('  Safety checks passed. ✓\n');

// ── Phase 6: Quality score gate (min 85/100) ───────────────────────────────────

console.log(`[Phase 6] Quality score gate for: ${targetSlug}`);
const scoreEntry = getScore(targetSlug);
if (!scoreEntry) {
  abort(SKIP.SCORE_TOO_LOW, `Scorer returned no result for ${targetSlug}`);
}
console.log(`[SCORE] slug=${targetSlug}  score=${scoreEntry.quality_score}/100`);
for (const [check, pass] of Object.entries(scoreEntry.checks)) {
  console.log(`  ${pass ? '✓' : '✗'} ${check}`);
}
if (scoreEntry.quality_score < 85) {
  const failed = Object.entries(scoreEntry.checks).filter(([, v]) => !v).map(([k]) => k);
  abort(SKIP.SCORE_TOO_LOW,
    `Score ${scoreEntry.quality_score}/100 < 85. Failed: ${failed.join(', ') || '(score too low)'}`);
}
console.log('  Quality gate passed. ✓\n');

// ── Phase 7: Duplicate protection ─────────────────────────────────────────────

console.log(`[Phase 7] Duplicate check for: ${targetSlug}`);
const onDisk    = isPublishedOnDisk(targetSlug);
const inHistory = isInHistory(targetSlug);
console.log(`  on_disk=${onDisk}  in_history=${inHistory}`);
if (onDisk || inHistory) {
  const detail = onDisk
    ? `market-outlook/${targetSlug}.html already exists on disk.`
    : `${targetSlug} is already recorded in market-outlook-history.json.`;
  abort(SKIP.DUPLICATE_BLOCKED, detail);
}
console.log('  Duplicate check passed. ✓\n');

// ── Phase 8: Dry-run exit ──────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log('[Phase 8] DRY RUN — all gates passed. Would publish:');
  console.log(`  EN: ${SITE_URL}/market-outlook/${targetSlug}.html`);
  console.log(`  AR: ${SITE_URL}/ar/market-outlook/${targetSlug}.html`);
  state.en_url = `${SITE_URL}/market-outlook/${targetSlug}.html`;
  state.ar_url = `${SITE_URL}/ar/market-outlook/${targetSlug}.html`;
  printSummary();
  process.exit(0);
}

// ── Phase 9: Publish (--force-date bypasses target_publish_date gate) ──────────

console.log(`[Phase 9] Publishing: ${targetSlug}  (force_date=true  require_publishable=true)`);
const publishResult = run([
  path.join(__dirname, 'publish-market-outlook.js'),
  `--slug=${targetSlug}`,
  '--execute',
  '--force-date',
  '--require-publishable'  // exits 1 if topic not publishable — prevents silent skip
]);

if (publishResult.status !== 0) {
  abort(SKIP.PUBLISH_FAILED,
    `publish-market-outlook.js exited with status ${publishResult.status} for slug=${targetSlug}.` +
    ` Scroll up for [TOPIC CHECK] and [PUBLISH] lines.`);
}

// ── Phase 10: Verify files on disk ────────────────────────────────────────────

console.log(`\n[Phase 10] Verifying published files on disk...`);
const enPath = path.join(ROOT, 'market-outlook', `${targetSlug}.html`);
const arPath = path.join(ROOT, 'ar', 'market-outlook', `${targetSlug}.html`);
const enOk   = fs.existsSync(enPath);
const arOk   = fs.existsSync(arPath);
console.log(`  market-outlook/${targetSlug}.html  exists=${enOk}`);
console.log(`  ar/market-outlook/${targetSlug}.html  exists=${arOk}`);

if (!enOk || !arOk) {
  const missing = [!enOk && `market-outlook/${targetSlug}.html`, !arOk && `ar/market-outlook/${targetSlug}.html`]
    .filter(Boolean).join(', ');
  abort(SKIP.PUBLISH_FAILED, `Published files missing after publish script succeeded: ${missing}`);
}
console.log('  File verification passed. ✓\n');

state.published = true;
state.en_url    = `${SITE_URL}/market-outlook/${targetSlug}.html`;
state.ar_url    = `${SITE_URL}/ar/market-outlook/${targetSlug}.html`;

// ── Final report ───────────────────────────────────────────────────────────────

printSummary();
