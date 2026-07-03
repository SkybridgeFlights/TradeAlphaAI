#!/usr/bin/env node
'use strict';

// Auto-requeue for topics stuck in manual_revision_required.
//
// Nobody manually reviews these queues — the autonomous pipeline is the only
// operator — so a topic parked in manual_revision_required stays parked
// forever, clogging the schedule (5 market-outlook + 8 editorial topics had
// accumulated by 2026-07-03). Generator fixes land continuously (AR
// localization, AI retry, chain validation), which means a topic that failed
// last week has a real chance of passing today.
//
// Policy:
//   - A stuck topic older than STALE_DAYS is reset to 'planned' so the brain
//     retries it with the current (improved) generators.
//   - Each reset increments auto_requeue_count. After MAX_REQUEUES resets the
//     topic stays parked for good — repeated failure means the topic itself
//     is the problem, and retry loops must not run forever.
//   - Age comes from autonomous_reviewed_at (when the pipeline parked it),
//     falling back to requeued_at / target or planned publish date. Entries
//     with no usable timestamp get stamped revision_flagged_at=now and are
//     picked up by a later run once that stamp ages.
//
// Usage: node tools/requeue-stale-revisions.js [--execute]
//   Without --execute: dry run (prints the plan, writes nothing).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STALE_DAYS = 7;
const MAX_REQUEUES = 2;

const QUEUES = [
  { file: 'data/market-outlook-queue.json', label: 'market-outlook' },
  { file: 'data/editorial-topic-queue.json', label: 'editorial' },
];

const execute = process.argv.includes('--execute');
const now = Date.now();

function ageDays(iso) {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (now - t) / 86400000 : null;
}

function ageBasis(topic) {
  return topic.autonomous_reviewed_at
    || topic.requeued_at
    || topic.revision_flagged_at
    || topic.target_publish_date
    || topic.planned_publish_date
    || topic.publish_date
    || null;
}

let totalRequeued = 0;
let totalParked = 0;
let totalStamped = 0;

for (const { file, label } of QUEUES) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { console.log(`[requeue] ${label}: queue file missing — skipped`); continue; }
  const queue = JSON.parse(fs.readFileSync(abs, 'utf8'));
  const topics = queue.topics || [];
  let changed = false;

  for (const topic of topics) {
    if (topic.status !== 'manual_revision_required') continue;

    const basis = ageBasis(topic);
    if (!basis) {
      topic.revision_flagged_at = new Date(now).toISOString();
      totalStamped++;
      changed = true;
      console.log(`[requeue] ${label}: ${topic.slug} — no timestamp; stamped revision_flagged_at`);
      continue;
    }

    const age = ageDays(basis);
    if (age === null || age < STALE_DAYS) {
      console.log(`[requeue] ${label}: ${topic.slug} — ${age === null ? 'unparseable date' : age.toFixed(1) + 'd old'} (< ${STALE_DAYS}d) — waiting`);
      continue;
    }

    const count = Number(topic.auto_requeue_count || 0);
    if (count >= MAX_REQUEUES) {
      totalParked++;
      console.log(`[requeue] ${label}: ${topic.slug} — already retried ${count}x — parked permanently`);
      continue;
    }

    topic.status = 'planned';
    topic.auto_requeue_count = count + 1;
    topic.requeued_at = new Date(now).toISOString();
    if (topic.autonomous_review_status) topic.autonomous_review_status = 'pending';
    if (topic.review_status) topic.review_status = 'pending';
    totalRequeued++;
    changed = true;
    console.log(`[requeue] ${label}: ${topic.slug} — requeued as planned (retry ${count + 1}/${MAX_REQUEUES}, was ${age.toFixed(1)}d stale)`);
  }

  if (changed && execute) {
    fs.writeFileSync(abs, JSON.stringify(queue, null, 2) + '\n', 'utf8');
    console.log(`[requeue] ${label}: queue written`);
  }
}

console.log(`[requeue] ${execute ? 'EXECUTED' : 'DRY RUN'} — requeued=${totalRequeued} parked=${totalParked} stamped=${totalStamped}`);
