'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const QUEUE_PATH = path.join(ROOT, 'data', 'market-outlook-queue.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'market-outlook-history.json');
const ALT_HISTORY_PATH = path.join(ROOT, 'data', 'market-outlook-published.json');
const STALE_PENDING_DAYS = 7;
const HORIZON_DAYS = 28;
const PUBLISH_DAYS = new Set([1, 2, 4, 6]); // Mon, Tue, Thu, Sat (UTC day index)

const failures = [];
const warnings = [];

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function getPublishSlots(fromDate, horizonDays) {
  const slots = [];
  const start = new Date(fromDate + 'T00:00:00Z');
  for (let i = 1; i <= horizonDays; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (PUBLISH_DAYS.has(d.getUTCDay())) slots.push(d.toISOString().slice(0, 10));
  }
  return slots;
}

const TODAY = new Date().toISOString().slice(0, 10);
const queue   = readJson(QUEUE_PATH, { topics: [] });
const history = readJson(HISTORY_PATH, { publications: [] });
const altHist = readJson(ALT_HISTORY_PATH, { publications: [], articles: [] });

const publishedSlugs = new Set([
  ...(history.publications || []).map((p) => p.slug),
  ...(altHist.publications || []).map((p) => p.slug),
  ...(altHist.articles     || []).map((p) => p.slug),
]);
const marketOutlookDir = path.join(ROOT, 'market-outlook');
if (fs.existsSync(marketOutlookDir)) {
  for (const file of fs.readdirSync(marketOutlookDir)) {
    if (file.endsWith('.html')) publishedSlugs.add(file.replace(/\.html$/, ''));
  }
}

const topics = queue.topics || [];
console.log(`[market-outlook-queue] Checking ${topics.length} topic(s).`);

// ── 1. Valid status values ────────────────────────────────────────────────────
const VALID_STATUSES = new Set(['planned', 'draft', 'in_review', 'generated', 'reviewed', 'published', 'manual_revision_required', 'failed_generation']);
for (const t of topics) {
  if (!VALID_STATUSES.has(t.status)) {
    failures.push(`invalid status "${t.status}" on topic ${t.slug}`);
  }
  if (t.status === 'reviewed' && t.review_status && !['approved', 'pending'].includes(t.review_status)) {
    warnings.push(`topic ${t.slug}: status=reviewed but review_status=${t.review_status}`);
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.slug || '')) {
    failures.push(`malformed slug: "${t.slug || '<missing>'}"`);
  }
}

// ── 2. No orphan seeded topics ────────────────────────────────────────────────
// Orphan = status:planned for more than STALE_PENDING_DAYS with no draft files
for (const t of topics) {
  if (t.status === 'planned') {
    const age = daysSince(t.seeded_at || t.target_publish_date);
    if (age > STALE_PENDING_DAYS) {
      const draftExists = fs.existsSync(path.join(ROOT, 'drafts', 'market-outlook', t.slug, 'en.html'));
      if (!draftExists) {
        warnings.push(`orphan seeded topic: ${t.slug} (planned ${age}d ago, no draft) — run generate-market-outlook-draft.js`);
      }
    }
  }
}

// ── 3. Stale in_review topics ─────────────────────────────────────────────────
for (const t of topics) {
  if (t.status === 'in_review') {
    const age = daysSince(t.seeded_at || t.target_publish_date);
    if (age > STALE_PENDING_DAYS) {
      warnings.push(`stale in_review topic: ${t.slug} (${age}d old) — re-generate or manually promote`);
    }
  }
}

// ── 4. Approved topics must have bilingual drafts ─────────────────────────────
for (const t of topics) {
  if (t.status === 'reviewed' && t.review_status === 'approved' && !publishedSlugs.has(t.slug)) {
    const enOk = fs.existsSync(path.join(ROOT, 'drafts', 'market-outlook', t.slug, 'en.html'));
    const arOk = fs.existsSync(path.join(ROOT, 'drafts', 'market-outlook', t.slug, 'ar.html'));
    if (!enOk || !arOk) {
      failures.push(`approved topic ${t.slug} missing bilingual drafts (en:${enOk} ar:${arOk}) — cannot publish`);
    }
  }
}

// ── 5. At least one non-published topic when future slots exist ───────────────
const futureSlots   = getPublishSlots(TODAY, HORIZON_DAYS);
const pendingTopics = topics.filter((t) => !['published'].includes(t.status) && !publishedSlugs.has(t.slug));
if (futureSlots.length > 0 && pendingTopics.length === 0) {
  warnings.push(`no pending topics for ${futureSlots.length} upcoming publish slot(s) — run seed-market-outlook-topics.js`);
}

// ── 6. No duplicate slugs ─────────────────────────────────────────────────────
const seenSlugs = new Set();
for (const t of topics) {
  if (seenSlugs.has(t.slug)) failures.push(`duplicate slug in queue: ${t.slug}`);
  seenSlugs.add(t.slug);
}

// ── Report ────────────────────────────────────────────────────────────────────
const statusCounts = {};
for (const t of topics) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
console.log(`[market-outlook-queue] status counts: ${JSON.stringify(statusCounts)}`);
console.log(`[market-outlook-queue] pending: ${pendingTopics.length}  future_slots: ${futureSlots.length}  published: ${publishedSlugs.size}`);

if (warnings.length) warnings.forEach((w) => console.warn(`[market-outlook-queue] WARN: ${w}`));
if (failures.length) {
  failures.forEach((f) => console.error(`[market-outlook-queue] FAIL: ${f}`));
  process.exit(1);
}
console.log('[market-outlook-queue] check:market-outlook-queue passed.');
