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

function validateRotation(articles, history, cooldownDays) {
  const found = [];
  const legacy = new Set(['breadth-vs-index', 'liquidity-regime']);
  const seenRecords = new Set();
  for (const record of history) {
    const slug = record && (record.slug || record.id);
    if (!slug) { found.push('publication history contains a record without slug/id'); continue; }
    if (record.status === 'published') {
      if (!record.published_at || !Number.isFinite(Date.parse(record.published_at))) found.push(`${slug}: publication history has invalid published_at`);
      const key = `${slug}|${record.published_at || ''}|${record.status}`;
      if (seenRecords.has(key)) found.push(`${slug}: duplicate publication history record`);
      seenRecords.add(key);
    }
  }

  for (const article of articles) {
    if (!CONCEPT_LIBRARY[article.slug] && !legacy.has(article.slug)) found.push(`${article.slug}: published educational article has no concept-library entry (off-universe)`);
    const records = history
      .filter((item) => (item.slug || item.id) === article.slug && item.status === 'published')
      .sort((a, b) => Date.parse(a.published_at) - Date.parse(b.published_at));
    if (!records.length) found.push(`${article.slug}: no publication history record`);
    for (let index = 1; index < records.length; index += 1) {
      const gap = (Date.parse(records[index].published_at) - Date.parse(records[index - 1].published_at)) / 86400000;
      if (gap < cooldownDays) found.push(`${article.slug}: republished after ${gap.toFixed(1)}d (< ${cooldownDays}d cooldown)`);
    }
  }

  for (const record of history.filter((item) => item && item.status === 'published')) {
    const slug = record.slug || record.id;
    if (!articles.some((article) => article.slug === slug)) found.push(`${slug}: published history record has no educational article`);
  }

  for (let i = 0; i < articles.length; i += 1) {
    for (let j = i + 1; j < articles.length; j += 1) {
      const similarity = jaccard(shingles(articles[i].text), shingles(articles[j].text));
      if (similarity > 0.55) found.push(`near-duplicate educational articles: ${articles[i].slug} ~ ${articles[j].slug} (similarity ${similarity.toFixed(2)})`);
    }
  }
  return found;
}

const negativeFixture = process.argv.find((arg) => arg.startsWith('--negative-fixture='));
if (negativeFixture) {
  const key = negativeFixture.split('=')[1];
  const baseText = 'Institutional desks read participation quality through liquidity transmission breadth confirmation volatility structure and cross asset coherence. '.repeat(12);
  const fixtures = {
    'missing-history': {
      articles: [{ slug: 'breadth-vs-index', text: baseText }],
      history: [],
    },
    cooldown: {
      articles: [{ slug: 'breadth-vs-index', text: baseText }],
      history: [
        { slug: 'breadth-vs-index', status: 'published', published_at: '2026-06-01T00:00:00Z' },
        { slug: 'breadth-vs-index', status: 'published', published_at: '2026-06-02T00:00:00Z' },
      ],
    },
    'near-duplicate': {
      articles: [
        { slug: 'breadth-vs-index', text: baseText },
        { slug: 'liquidity-regime', text: baseText },
      ],
      history: [
        { slug: 'breadth-vs-index', status: 'published', published_at: '2026-05-01T00:00:00Z' },
        { slug: 'liquidity-regime', status: 'published', published_at: '2026-05-02T00:00:00Z' },
      ],
    },
  };
  const fixture = fixtures[key];
  if (!fixture) {
    console.error(`[educational-rotation] unknown negative fixture: ${key}`);
    process.exit(2);
  }
  const fixtureFailures = validateRotation(fixture.articles, fixture.history, 10);
  if (!fixtureFailures.length) {
    console.error(`[educational-rotation] FAIL: negative fixture "${key}" was accepted`);
    process.exit(0);
  }
  fixtureFailures.forEach((message) => console.error(`[educational-rotation] FAIL: ${message}`));
  process.exit(1);
}

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

const history = Array.isArray(topics.history) ? topics.history : [];
validateRotation(educational, history, cooldownDays).forEach(fail);

if (failures.length) {
  failures.forEach((m) => console.error(`[educational-rotation] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[educational-rotation] check:educational-rotation passed (${educational.length} article(s); on-universe, history-recorded, cooldown-respected, non-duplicate).`);

module.exports = { validateRotation };
