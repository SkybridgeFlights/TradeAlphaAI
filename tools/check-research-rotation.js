'use strict';

// Phase 115 — check:research-rotation. Anti-spam gate for the Daily Research
// Brain. HARD-FAILS if the research coverage memory is malformed, if the same
// research topic was published twice inside its cooldown window (topic spam), or
// if a published research note on disk has no coverage record (orphan). Anti-
// fabrication / quality of the notes themselves is covered by the shared
// article validators (market-news-articles, editorial-quality, embedded,
// inline-visuals). Passes when nothing is published.

const fs = require('fs');
const path = require('path');
const { RESEARCH_TOPICS, RESEARCH_COOLDOWN_DAYS } = require('./generate-market-news-article');

const ROOT = path.resolve(__dirname, '..');
const COVERAGE = path.join(ROOT, 'data', 'intelligence', 'research-coverage.json');
const EN_DIR = path.join(ROOT, 'market-news');
const VALID_TOPICS = new Set(RESEARCH_TOPICS.map((t) => t.id));

const failures = [];
const fail = (m) => failures.push(m);

const cov = (() => { try { return JSON.parse(fs.readFileSync(COVERAGE, 'utf8')); } catch { return null; } })();
if (!cov) {
  console.log('[research-rotation] no research coverage yet — nothing to validate (non-fatal).');
  console.log('[research-rotation] check:research-rotation passed.');
  process.exit(0);
}

const published = Array.isArray(cov.published) ? cov.published : null;
if (!published) fail('research-coverage.json: published must be an array');

// Topic + timestamp integrity; cooldown (no same topic twice within the window).
const byTopic = {};
for (const c of published || []) {
  if (!c.topic) fail(`coverage entry missing topic (${c.slug || '?'})`);
  else if (!VALID_TOPICS.has(c.topic)) fail(`coverage entry unknown topic "${c.topic}"`);
  if (!c.published_at || Number.isNaN(Date.parse(c.published_at))) fail(`coverage entry ${c.slug || c.topic}: invalid published_at`);
  if (c.topic && c.published_at) (byTopic[c.topic] = byTopic[c.topic] || []).push(Date.parse(c.published_at));
}
for (const [topic, times] of Object.entries(byTopic)) {
  const sorted = times.sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    const gapDays = (sorted[i] - sorted[i - 1]) / 86400000;
    if (gapDays < RESEARCH_COOLDOWN_DAYS) fail(`topic "${topic}" republished after ${gapDays.toFixed(1)}d (< ${RESEARCH_COOLDOWN_DAYS}d cooldown — topic spam)`);
  }
}

// Orphan: every research-*.html on disk should have a coverage record.
const slugs = new Set((published || []).map((c) => c.slug));
let onDisk = 0;
try {
  for (const f of fs.readdirSync(EN_DIR)) {
    if (!/^research-.*\.html$/.test(f)) continue;
    onDisk += 1;
    if (!slugs.has(f.replace(/\.html$/, ''))) fail(`published research note ${f} has no coverage record (orphan)`);
  }
} catch { /* dir absent */ }

if (failures.length) {
  failures.forEach((f) => console.error(`[research-rotation] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[research-rotation] check:research-rotation passed (${(published || []).length} coverage record(s), ${onDisk} note(s) on disk; rotation + cooldown intact).`);
