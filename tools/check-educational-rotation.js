'use strict';

// Phase 118 — check:educational-rotation. Anti-spam gate for the autonomous
// Educational Intelligence Engine, complementing check:educational-articles
// (which already enforces topic-engine cooldown/coverage + per-article quality).
// HARD-FAILS on: two published educational articles whose body text is near-
// identical (templated/duplicate concept), a published article with no concept-
// library entry (off-universe), a published article missing its topic-history
// record, or a concept published while still inside the cooldown window. Passes
// green when nothing educational is published.

const fs = require('fs');
const path = require('path');
const { CONCEPT_LIBRARY } = require('./generate-educational-article');

const ROOT = path.resolve(__dirname, '..');
const ART_DIR = path.join(ROOT, 'articles');
const TOPICS = path.join(ROOT, 'data', 'intelligence', 'educational-topics.json');

const failures = [];
const fail = (m) => failures.push(m);
function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function bodyText(html) {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  return (m ? m[0] : html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
function shingles(text) {
  const w = text.toLowerCase().replace(/[^a-z0-9؀-ۿ ]/g, '').split(/\s+/).filter(Boolean);
  const s = new Set();
  for (let i = 0; i + 6 <= w.length; i += 1) s.add(w.slice(i, i + 6).join(' '));
  return s;
}
function jaccard(a, b) { let i = 0; for (const x of a) if (b.has(x)) i += 1; const u = a.size + b.size - i; return u ? i / u : 0; }

const topics = readJson(TOPICS, { history: [], anti_repetition: {} });
const cooldownDays = (topics.anti_repetition && topics.anti_repetition.cooldown_days) || 10;

let educational = [];
try {
  educational = fs.readdirSync(ART_DIR)
    .filter((f) => f.endsWith('.html') && f !== 'index.html' && fs.readFileSync(path.join(ART_DIR, f), 'utf8').includes('data-educational-article='))
    .map((f) => ({ slug: f.replace(/\.html$/, ''), text: bodyText(fs.readFileSync(path.join(ART_DIR, f), 'utf8')) }));
} catch { educational = []; }

if (!educational.length) {
  console.log('[educational-rotation] no educational articles published — nothing to validate (non-fatal).');
  console.log('[educational-rotation] check:educational-rotation passed.');
  process.exit(0);
}

// Off-universe + history-record + cooldown integrity. (The single legacy
// hand-authored concept volatility-compression predates the autonomous library;
// it is exempt from the library-entry requirement but still history-checked.)
const LEGACY = new Set(['volatility-compression']);
const history = Array.isArray(topics.history) ? topics.history : [];
for (const a of educational) {
  if (!CONCEPT_LIBRARY[a.slug] && !LEGACY.has(a.slug)) fail(`${a.slug}: published educational article has no concept-library entry (off-universe)`);
  const recs = history.filter((h) => h.slug === a.slug && h.status === 'published').sort((x, y) => Date.parse(x.published_at) - Date.parse(y.published_at));
  if (!recs.length) fail(`${a.slug}: no publication history record`);
  // Cooldown: the same concept must not have two publications within the window.
  for (let i = 1; i < recs.length; i += 1) {
    const gap = (Date.parse(recs[i].published_at) - Date.parse(recs[i - 1].published_at)) / 86400000;
    if (gap < cooldownDays) fail(`${a.slug}: republished after ${gap.toFixed(1)}d (< ${cooldownDays}d cooldown)`);
  }
}

// Near-duplicate detection across published educational articles.
for (let i = 0; i < educational.length; i += 1) {
  for (let j = i + 1; j < educational.length; j += 1) {
    const sim = jaccard(shingles(educational[i].text), shingles(educational[j].text));
    if (sim > 0.55) fail(`near-duplicate educational articles: ${educational[i].slug} ~ ${educational[j].slug} (similarity ${sim.toFixed(2)})`);
  }
}

if (failures.length) {
  failures.forEach((m) => console.error(`[educational-rotation] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[educational-rotation] check:educational-rotation passed (${educational.length} article(s); on-universe, history-recorded, cooldown-respected, non-duplicate).`);
