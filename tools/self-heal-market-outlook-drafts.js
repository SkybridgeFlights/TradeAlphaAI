'use strict';

// Preflight draft self-healing — [DRAFT_SELF_HEAL].
// Reviewed/approved market-outlook topics must carry bilingual drafts before
// check:market-outlook-queue runs. When drafts are missing the queue check
// hard-fails before the publishing brain ever gets a chance to generate them.
// This wrapper detects approved topics with missing EN/AR drafts and runs the
// existing generator (tools/generate-market-outlook-draft.js) for exactly
// those slugs. It never publishes, never duplicates topics, and never
// overwrites a topic that already has both drafts. Genuinely broken topics
// (generation still fails) keep failing the queue check downstream.
//
// Usage: node tools/self-heal-market-outlook-drafts.js

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');

function draftPath(slug, lang) {
  return path.join(ROOT, 'drafts', 'market-outlook', slug, `${lang}.html`);
}

function readQueue() {
  try {
    return JSON.parse(fs.readFileSync(QUEUE_PATH, 'utf8'));
  } catch (error) {
    console.error(`[DRAFT_SELF_HEAL] cannot read queue: ${error.message}`);
    process.exit(1);
  }
}

function main() {
  const queue = readQueue();
  const approved = (queue.topics || []).filter(
    (t) => t.status === 'reviewed' && t.review_status === 'approved'
  );

  if (!approved.length) {
    console.log('[DRAFT_SELF_HEAL]');
    console.log('topic=none');
    console.log('result=no_approved_topics_pending');
    return;
  }

  let failures = 0;
  for (const topic of approved) {
    const missingEn = !fs.existsSync(draftPath(topic.slug, 'en'));
    const missingAr = !fs.existsSync(draftPath(topic.slug, 'ar'));

    if (!missingEn && !missingAr) {
      console.log('[DRAFT_SELF_HEAL]');
      console.log(`topic=${topic.slug}`);
      console.log('missing_en=false');
      console.log('missing_ar=false');
      console.log('generated_en=false');
      console.log('generated_ar=false');
      console.log('result=drafts_already_present');
      continue;
    }

    console.log(`[DRAFT_SELF_HEAL] generating missing drafts for ${topic.slug} via tools/generate-market-outlook-draft.js ...`);
    const run = spawnSync(
      process.execPath,
      [path.join(__dirname, 'generate-market-outlook-draft.js'), `--slug=${topic.slug}`],
      { cwd: ROOT, stdio: 'inherit', windowsHide: true }
    );

    const enNow = fs.existsSync(draftPath(topic.slug, 'en'));
    const arNow = fs.existsSync(draftPath(topic.slug, 'ar'));
    const healed = enNow && arNow && run.status === 0;
    if (!healed) failures += 1;

    console.log('[DRAFT_SELF_HEAL]');
    console.log(`topic=${topic.slug}`);
    console.log(`missing_en=${missingEn}`);
    console.log(`missing_ar=${missingAr}`);
    console.log(`generated_en=${missingEn && enNow}`);
    console.log(`generated_ar=${missingAr && arNow}`);
    console.log(`result=${healed ? 'healed' : `failed (generator exit ${run.status}, en:${enNow} ar:${arNow})`}`);
  }

  if (failures > 0) {
    console.error(`[DRAFT_SELF_HEAL] ${failures} approved topic(s) could not be healed — queue check will report the precise failure.`);
    process.exit(1);
  }
}

main();
