#!/usr/bin/env node
/**
 * TradeAlpha Workflow Orchestrator
 *
 * Reads data/publishing-schedule.json, determines what is owed today
 * (per article / news / forecast bucket), dedupes against the existing
 * publication-history files, and emits an action plan that the unified
 * GitHub workflow consumes to call the autonomous-publishing-brain once
 * per owed slot.
 *
 * Usage:
 *   node tools/tradealpha-orchestrator.js                  # print human plan
 *   node tools/tradealpha-orchestrator.js --plan-json      # emit full plan as JSON to stdout
 *   node tools/tradealpha-orchestrator.js --slot=N         # print just slot N (1-based) as JSON
 *   node tools/tradealpha-orchestrator.js --bucket=NAME    # print { pending, content_type } for bucket (article|news|forecast)
 *
 * The orchestrator never publishes by itself: it computes what should
 * happen and the workflow does the work. This keeps the data prep that
 * already runs in the workflow exactly once, even when 3 slots fire.
 *
 * The bucket query is what the workflow uses for per-slot gating: each
 * slot step is bound to a specific bucket so that a failure in one
 * bucket never starves the others.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCHEDULE_PATH = path.join(ROOT, 'data', 'publishing-schedule.json');

// Map of brain content_type -> history file that records its delivery.
const HISTORY_FILES = {
  'editorial':                path.join(ROOT, 'data', 'published-history.json'),
  'market-outlook':           path.join(ROOT, 'data', 'market-outlook-history.json'),
  'continuous-intelligence':  path.join(ROOT, 'data', 'continuous-intelligence-history.json'),
  'news-analysis':            path.join(ROOT, 'data', 'published-history.json')
};

const VALID_CONTENT_TYPES = new Set([
  'editorial',
  'market-outlook',
  'continuous-intelligence',
  'news-analysis'
]);

function loadJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function loadSchedule() {
  const s = loadJson(SCHEDULE_PATH);
  if (!s) {
    throw new Error(`[tradealpha] missing schedule file: ${SCHEDULE_PATH}`);
  }
  if (!s.weekly_schedule || !s.type_mapping) {
    throw new Error('[tradealpha] schedule missing required fields: weekly_schedule + type_mapping');
  }
  for (const [bucket, ct] of Object.entries(s.type_mapping)) {
    if (!VALID_CONTENT_TYPES.has(ct)) {
      throw new Error(`[tradealpha] type_mapping.${bucket} -> "${ct}" is not a valid brain content_type`);
    }
  }
  return s;
}

function todayInTz(tz) {
  const safeTz = tz || 'UTC';
  const dayFmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: safeTz });
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: safeTz
  });
  const now = new Date();
  const weekday = dayFmt.format(now).toLowerCase();
  const map = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const dow = map[weekday] != null ? map[weekday] : now.getUTCDay();
  return { dow, date: dateFmt.format(now), weekday };
}

function publishedTodayCount(contentType, todayISO) {
  const file = HISTORY_FILES[contentType];
  if (!file) return 0;
  const j = loadJson(file, { publications: [] });
  const pubs = Array.isArray(j) ? j : (j.publications || []);
  let n = 0;
  for (const p of pubs) {
    if (!p) continue;
    // Restrict to records whose stored content_type matches the slot,
    // because published-history.json mixes editorial + news entries.
    const recordedType = (p.content_type || '').toLowerCase().replace(/_/g, '-');
    if (contentType === 'editorial' && recordedType && recordedType !== 'editorial') continue;
    if (contentType === 'market-outlook' && recordedType && recordedType !== 'market-outlook') continue;
    if (contentType === 'continuous-intelligence' && recordedType && recordedType !== 'continuous-intelligence') continue;
    const day = p.publish_date || (p.published_at || '').slice(0, 10);
    if (day === todayISO) n++;
  }
  return n;
}

function computeOwedSlots(schedule) {
  const tz = schedule.timezone || 'UTC';
  const { dow, date, weekday } = todayInTz(tz);
  const daySpec = (schedule.weekly_schedule || {})[String(dow)] || {};
  const mapping = schedule.type_mapping || {};
  const owed = [];
  const summary = {};

  for (const [bucket, contentType] of Object.entries(mapping)) {
    const target = Number(daySpec[bucket] || 0);
    const already = publishedTodayCount(contentType, date);
    const pending = Math.max(0, target - already);
    summary[bucket] = { content_type: contentType, target, already, pending };
    for (let i = 0; i < pending; i++) {
      owed.push({
        slot_index: owed.length + 1,
        bucket,
        content_type: contentType
      });
    }
  }

  return {
    timezone: tz,
    today: date,
    weekday,
    dow,
    day_label: daySpec.label || weekday,
    daily_quota: {
      article:  Number(daySpec.article  || 0),
      news:     Number(daySpec.news     || 0),
      forecast: Number(daySpec.forecast || 0)
    },
    summary,
    owed_slots: owed
  };
}

function printHumanPlan(plan) {
  console.log('==========================================================');
  console.log('  TradeAlpha Workflow — Daily Publishing Plan');
  console.log('==========================================================');
  console.log(`  Today:        ${plan.today}   (${plan.day_label}, tz=${plan.timezone})`);
  console.log(`  Daily quota:  article=${plan.daily_quota.article}  news=${plan.daily_quota.news}  forecast=${plan.daily_quota.forecast}`);
  console.log('  Per-bucket status:');
  for (const [bucket, st] of Object.entries(plan.summary)) {
    console.log(`    ${bucket.padEnd(10)} -> ${st.content_type.padEnd(24)} target=${st.target} already_today=${st.already} pending=${st.pending}`);
  }
  console.log('  Owed slots:');
  if (plan.owed_slots.length === 0) {
    console.log('    (none — quota already met for today)');
  } else {
    for (const slot of plan.owed_slots) {
      console.log(`    #${slot.slot_index}  ${slot.bucket.padEnd(10)} -> ${slot.content_type}`);
    }
  }
  console.log('==========================================================');
}

function main() {
  const argv = process.argv.slice(2);
  const planJsonOnly = argv.includes('--plan-json');
  const slotArg = (argv.find(a => a.startsWith('--slot=')) || '').split('=')[1];
  const bucketArg = (argv.find(a => a.startsWith('--bucket=')) || '').split('=')[1];
  const slotIndex = slotArg ? Number(slotArg) : null;

  let schedule;
  try {
    schedule = loadSchedule();
  } catch (err) {
    console.error(String(err.message || err));
    process.exit(2);
  }

  const plan = computeOwedSlots(schedule);

  if (bucketArg) {
    const st = plan.summary[bucketArg];
    if (!st) {
      process.stdout.write(JSON.stringify({ present: false, bucket: bucketArg, reason: 'unknown_bucket' }));
      return;
    }
    process.stdout.write(JSON.stringify({
      present: st.pending > 0,
      bucket: bucketArg,
      content_type: st.content_type,
      target: st.target,
      already: st.already,
      pending: st.pending,
      today: plan.today
    }));
    return;
  }

  if (slotIndex != null) {
    const slot = plan.owed_slots.find(s => s.slot_index === slotIndex);
    if (!slot) {
      process.stdout.write(JSON.stringify({ present: false, slot_index: slotIndex }));
      return;
    }
    process.stdout.write(JSON.stringify({ present: true, ...slot, today: plan.today }));
    return;
  }

  if (planJsonOnly) {
    process.stdout.write(JSON.stringify(plan));
    return;
  }

  printHumanPlan(plan);
}

if (require.main === module) main();

module.exports = {
  loadSchedule,
  computeOwedSlots,
  publishedTodayCount,
  todayInTz,
  HISTORY_FILES
};
