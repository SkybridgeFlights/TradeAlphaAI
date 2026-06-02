'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'editorial-topic-queue.json');
const DRAFT_ROOT = path.join(ROOT, 'drafts', 'editorial');
const TODAY = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
const MAX_PER_DAY = 1;
const MAX_PER_WEEK = 3;
const failures = [];
const warnings = [];

const queue = readJson(QUEUE_PATH);
const topics = Array.isArray(queue.topics) ? queue.topics : [];
const byDay = new Map();
const byWeek = new Map();
const byWeekCluster = new Map();
const allowedTelegram = new Set(['not_ready', 'dry_run_ready', 'dry_run_done', 'scheduled', 'posted', 'skipped']);
const allowedReview = new Set(['not_started', 'needs_draft', 'in_review', 'approved', 'changes_requested']);

for (const topic of topics) {
  checkSchedulingShape(topic);
  collectCadence(topic);
  checkDraftStaleness(topic);
  checkEvergreenRefresh(topic);
}

checkCadence();

if (warnings.length) {
  console.warn('Editorial schedule warnings:');
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}

if (failures.length) {
  console.error('Editorial schedule check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Editorial schedule check passed for ${topics.length} topic(s).`);

function checkSchedulingShape(topic) {
  const label = topic.slug || '<missing slug>';
  if (topic.scheduled_publish_time && !/^\d{2}:\d{2}$/.test(topic.scheduled_publish_time)) failures.push(`${label}: scheduled_publish_time must be HH:MM`);
  if (topic.telegram_status && !allowedTelegram.has(topic.telegram_status)) failures.push(`${label}: invalid telegram_status ${topic.telegram_status}`);
  if (topic.review_status && !allowedReview.has(topic.review_status)) failures.push(`${label}: invalid review_status ${topic.review_status}`);
  if (topic.revision_count != null && (!Number.isInteger(topic.revision_count) || topic.revision_count < 0)) failures.push(`${label}: revision_count must be a non-negative integer`);
  if (topic.last_reviewed && !/^\d{4}-\d{2}-\d{2}$/.test(topic.last_reviewed)) failures.push(`${label}: last_reviewed must be YYYY-MM-DD`);
  if (topic.evergreen_refresh_cycle != null && (!Number.isInteger(topic.evergreen_refresh_cycle) || topic.evergreen_refresh_cycle < 30)) failures.push(`${label}: evergreen_refresh_cycle must be at least 30 days`);
  if (topic.priority_score != null && (!Number.isInteger(topic.priority_score) || topic.priority_score < 1 || topic.priority_score > 100)) failures.push(`${label}: priority_score must be 1-100`);
  if (topic.status === 'scheduled' && !topic.scheduled_publish_time) warnings.push(`${label}: scheduled topic has no scheduled_publish_time`);
  if ((topic.status === 'scheduled' || topic.status === 'reviewed') && topic.review_status !== 'approved') warnings.push(`${label}: scheduled/reviewed topic should have review_status=approved before publishing`);
  if (topic.status === 'scheduled' && !topic.last_reviewed) warnings.push(`${label}: scheduled topic has no last_reviewed date`);
  if (topic.language_support && (!topic.language_support.includes('en') || !topic.language_support.includes('ar'))) failures.push(`${label}: scheduled cadence requires EN and AR support`);
}

function collectCadence(topic) {
  if (!topic.target_publish_date) return;
  const day = topic.target_publish_date;
  const week = weekKey(day);
  const bucket = byDay.get(day) || [];
  bucket.push(topic);
  byDay.set(day, bucket);
  const weekBucket = byWeek.get(week) || [];
  weekBucket.push(topic);
  byWeek.set(week, weekBucket);
  const clusterKey = `${week}:${topic.discovery_cluster || topic.category || 'unknown'}`;
  const clusterBucket = byWeekCluster.get(clusterKey) || [];
  clusterBucket.push(topic);
  byWeekCluster.set(clusterKey, clusterBucket);
}

function checkCadence() {
  for (const [day, items] of byDay) {
    if (items.length > MAX_PER_DAY) warnings.push(`${day}: ${items.length} topics scheduled; target is ${MAX_PER_DAY}/day`);
  }
  for (const [week, items] of byWeek) {
    const planned = items.filter((item) => ['scheduled', 'reviewed', 'published'].includes(item.status));
    if (planned.length > MAX_PER_WEEK) warnings.push(`${week}: ${planned.length} publishable topics; target is ${MAX_PER_WEEK}/week`);
  }
  for (const [key, items] of byWeekCluster) {
    const planned = items.filter((item) => ['scheduled', 'reviewed', 'published'].includes(item.status));
    if (planned.length > 2) warnings.push(`${key}: repeated discovery cluster ${planned.length} times in one week`);
  }
}

function checkDraftStaleness(topic) {
  const dir = path.join(DRAFT_ROOT, topic.slug || '');
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  const ageDays = Math.floor((Date.now() - stat.mtimeMs) / 86400000);
  if (topic.status === 'draft' && ageDays > 21) warnings.push(`${topic.slug}: draft workspace is ${ageDays} days old`);
}

function checkEvergreenRefresh(topic) {
  if (topic.status !== 'published') return;
  if (!topic.evergreen_refresh_cycle) warnings.push(`${topic.slug}: published evergreen topic has no refresh cycle`);
  if (!topic.last_reviewed) warnings.push(`${topic.slug}: published topic has no last_reviewed date`);
  if (!topic.last_reviewed || !topic.evergreen_refresh_cycle) return;
  const reviewed = new Date(`${topic.last_reviewed}T00:00:00Z`);
  const next = new Date(reviewed.getTime() + topic.evergreen_refresh_cycle * 86400000);
  if (next < TODAY) warnings.push(`${topic.slug}: evergreen review is stale; next refresh was ${next.toISOString().slice(0, 10)}`);
}

function weekKey(day) {
  const date = new Date(`${day}T00:00:00Z`);
  const weekStart = new Date(date);
  weekStart.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return weekStart.toISOString().slice(0, 10);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    failures.push(`${path.relative(ROOT, file)}: ${error.message}`);
    return {};
  }
}
