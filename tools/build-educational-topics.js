'use strict';

// Phase 96 — Educational Articles Brain: institutional topic selection + anti-
// repetition engine. A DECISION layer only (never publishes): it maintains an
// institutional macro-structure topic taxonomy, measures how well each concept
// family is already covered (across the existing /insights/ registry, the
// /articles/ set, and its own selection memory), and surfaces the most
// under-covered, highest-depth topics — preventing five articles that explain
// the same concept differently.
//
// Scope is strictly institutional market-structure education (breadth, duration
// sensitivity, volatility compression, concentration, liquidity regimes,
// cross-asset confirmation, positioning squeezes). It is NOT beginner finance,
// NOT listicles, NOT ETF product explainers (that is /insights/).
//
// Output: data/intelligence/educational-topics.json
// Usage:  node tools/build-educational-topics.js --write

const fs = require('fs');
const path = require('path');
const { CONCEPT_FAMILIES: DEEP_CONCEPT_FAMILIES } = require('./educational-concept-library');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT, 'data', 'insights', 'article-registry.json');
const ARTICLES_DIR = path.join(ROOT, 'articles');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'educational-topics.json');

const MAX_ELIGIBLE = 4;
const COOLDOWN_DAYS = 10; // a concept family just published cools down

// The expanded deterministic contracts retain the established family shape
// consumed by coverage, cooldown, history, and ranking logic.
const CONCEPT_FAMILIES = DEEP_CONCEPT_FAMILIES;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

// Coverage corpus: existing insights slugs/titles + any /articles/ files + a
// self-persisted record of prior educational selections.
function coverageCorpus(previous) {
  const corpus = [];
  const reg = readJson(REGISTRY_PATH, null);
  const entries = Array.isArray(reg) ? reg : (reg ? (reg.articles || reg.entries || Object.values(reg)) : []);
  for (const e of entries) corpus.push(String(e.slug || e.title_en || e.title || '').toLowerCase());
  if (fs.existsSync(ARTICLES_DIR)) {
    for (const f of fs.readdirSync(ARTICLES_DIR).filter((x) => x.endsWith('.html') && x !== 'index.html')) {
      corpus.push(f.replace(/\.html$/, '').toLowerCase());
    }
  }
  for (const sel of (previous && previous.history) || []) corpus.push(String(sel.id).toLowerCase());
  // Normalize hyphens/underscores to spaces so slug tokens are matchable
  // (e.g. "mega-cap-tech-index-concentration" → "...concentration").
  return corpus.map((s) => s.replace(/[-_]+/g, ' '));
}

// Coverage score 0–1 for a family: fraction of its fingerprints that appear in
// the corpus (a crude but deterministic semantic-overlap proxy).
function coverageScore(family, corpusJoined) {
  const hits = family.fingerprint.filter((fp) => corpusJoined.includes(fp)).length;
  return hits / family.fingerprint.length;
}

function buildEducationalTopics() {
  const previous = readJson(OUT_PATH, null);
  const corpus = coverageCorpus(previous);
  const corpusJoined = corpus.join(' | ');
  const nowIso = new Date().toISOString();

  // Cooldown: families selected within the window are temporarily suppressed.
  const recent = new Map(((previous && previous.history) || [])
    .filter((h) => h.selected_at && (Date.now() - new Date(h.selected_at).getTime()) / 86400000 < COOLDOWN_DAYS)
    .map((h) => [h.id, h.selected_at]));

  const ranked = CONCEPT_FAMILIES.map((family) => {
    const coverage = coverageScore(family, corpusJoined);
    const onCooldown = recent.has(family.id);
    // Priority: under-covered families first; cooldown pushes to the back.
    const priority = Math.round((1 - coverage) * 100) - (onCooldown ? 60 : 0);
    return {
      id: family.id,
      title_en: family.title_en,
      title_ar: family.title_ar,
      coverage_score: Math.round(coverage * 100) / 100,
      on_cooldown: onCooldown,
      priority,
      // Eligible only if meaningfully under-covered and not on cooldown.
      eligible: coverage < 0.5 && !onCooldown,
    };
  }).sort((a, b) => b.priority - a.priority);

  const eligible = ranked.filter((r) => r.eligible).slice(0, MAX_ELIGIBLE);

  return {
    version: '1.0',
    updated_at: nowIso,
    run_date: nowIso.slice(0, 10),
    scope: 'institutional-market-structure-education',
    distinct_from: '/insights/ (applied ETF/sector/stock research)',
    candidates: ranked,
    eligible,
    eligible_count: eligible.length,
    anti_repetition: { corpus_size: corpus.length, cooldown_days: COOLDOWN_DAYS, coverage_floor: 0.5 },
    history: (previous && previous.history) || [],
    note: eligible.length ? null : 'All institutional concept families are well-covered or on cooldown — no new educational topic eligible this cycle.',
    policy: { evergreen: true, no_filler: true, no_beginner_finance: true, supervised_publish: true },
  };
}

function main() {
  const write = process.argv.includes('--write');
  const out = buildEducationalTopics();
  console.log(`[educational-topics] eligible=${out.eligible_count}/${out.candidates.length}${out.eligible.map((e) => ` ${e.id}(cov ${e.coverage_score})`).join('')}`);
  if (write) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('[educational-topics] wrote data/intelligence/educational-topics.json');
  }
}

if (require.main === module) main();

module.exports = { buildEducationalTopics, coverageScore, CONCEPT_FAMILIES, MAX_ELIGIBLE };
