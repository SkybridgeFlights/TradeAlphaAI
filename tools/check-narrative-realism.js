'use strict';

// Phase 70 validation — narrative realism for pending drafts.
// Scans the EN drafts of topics that are still publishable (reviewed/approved,
// not yet published) and measures AI-cadence signatures: banned robotic
// phrases, machine-cadence writing, and uniform paragraph rhythm.
//
// Scope is deliberately limited to PENDING drafts: legacy published pages are
// historical record and are not retro-failed. The check fails only on
// genuinely robotic pending content (>=5 banned-phrase hits or extreme
// machine cadence); everything else reports as measurable warnings.
//
// Usage: npm run check:narrative-realism

const fs = require('fs');
const path = require('path');
const { GLOBAL_BANNED_PHRASES } = require('./editorial-personas');
const { scorePublishQuality } = require('./score-publish-quality');

const ROOT = path.resolve(__dirname, '..');

const QUEUES = [
  { contentType: 'market-outlook', queue: 'data/market-outlook-queue.json' },
  { contentType: 'editorial', queue: 'data/editorial-topic-queue.json' },
  { contentType: 'continuous-intelligence', queue: 'data/continuous-intelligence-queue.json' },
];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch { return fallback; }
}

let failures = 0;
let scanned = 0;
let warnings = 0;

for (const { contentType, queue } of QUEUES) {
  const data = readJson(queue, { topics: [] });
  const pending = (data.topics || []).filter(
    (t) => t.status === 'reviewed' && t.review_status === 'approved'
  );
  for (const topic of pending) {
    const draftPath = path.join(ROOT, 'drafts', contentType, topic.slug, 'en.html');
    if (!fs.existsSync(draftPath)) continue; // draft self-heal owns missing drafts
    scanned += 1;
    console.log(`[narrative-realism] scanning ${contentType}/${topic.slug}`);
    const result = scorePublishQuality({ contentType, slug: topic.slug });
    const roboticReason = result.reasons.find((r) => /robotic phrasing|ai_cadence/.test(r));
    if (roboticReason) {
      console.error(`[narrative-realism] FAIL ${topic.slug}: ${roboticReason}`);
      failures += 1;
    } else if (result.ai_cadence_score < 50 || result.narrative_score < 40) {
      console.warn(`[narrative-realism] WARN ${topic.slug}: cadence=${result.ai_cadence_score} narrative=${result.narrative_score} — below institutional target, regeneration recommended`);
      warnings += 1;
    }
  }
}

console.log(`[narrative-realism] scanned=${scanned} warnings=${warnings} failures=${failures} banned_phrases=${GLOBAL_BANNED_PHRASES.length}`);
if (failures > 0) {
  console.error('[narrative-realism] FAIL: pending drafts carry robotic AI cadence — regenerate before publishing.');
  process.exit(1);
}
console.log('[narrative-realism] check:narrative-realism passed.');
