'use strict';

// ETF Intelligence Center — similar-fund discovery.
//
// Similarity is measured, not asserted. It blends three observable components:
//
//   1. Return correlation over shared monthly observations (the dominant term —
//      two funds holding the same thing move together).
//   2. Volatility proximity (same exposure, similar risk magnitude).
//   3. Structural agreement (same benchmark / category / exposure type).
//
// Correlation is only used where both funds are quoted in the same currency, for
// the same reason the analytics builder suppresses cross-currency beta: an FX
// pair sitting between two series depresses correlation for reasons that have
// nothing to do with what the funds hold.
//
// Usage: node tools/build-etf-similarity.js [--write]

const fs = require('fs');
const path = require('path');

const { UNIVERSE, BY_SLUG } = require('./etf-universe');
const m = require('./etf-metrics');
const { hash } = require('./build-institutional-charts');

const ROOT = path.join(__dirname, '..');
const ANALYTICS = path.join(ROOT, 'data/intelligence/etf-analytics.json');
const SERIES = path.join(ROOT, 'data/intelligence/etf-monthly-series.json');
const OUT = path.join(ROOT, 'data/intelligence/etf-similarity.json');
const SCHEMA_VERSION = 2;

const MAX_PEERS = 6;
const MIN_SHARED_MONTHS = 24;

// Candidate selection. Comparing every fund against every other is O(n^2), which
// is fine at 39 and untenable in the thousands. Candidates are instead drawn from
// funds sharing a currency and either a category or an exposure type — the only
// pairs that can score highly anyway — capped per fund. The result for a realistic
// universe is identical; the cost becomes roughly linear.
const MAX_CANDIDATES_PER_FUND = 60;

// Component weights. Correlation dominates because it is the only term that
// observes actual co-movement; structure is a weaker, categorical signal.
const W_CORRELATION = 0.6;
const W_VOLATILITY = 0.15;
const W_STRUCTURE = 0.25;

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Monthly returns from the compact monthly close series in the analytics artifact. */
function monthlyReturns(closes) {
  return m.dailyReturns(closes);
}

/** Structural agreement in [0,1] from categorical metadata. */
function structuralScore(a, b) {
  let score = 0;
  if (a.benchmark && b.benchmark && a.benchmark === b.benchmark) score += 0.5;
  if (a.category && b.category && a.category === b.category) score += 0.3;
  if (a.exposure_type && b.exposure_type && a.exposure_type === b.exposure_type) score += 0.2;
  return Math.min(1, score);
}

/** Volatility proximity in [0,1]; 1 when identical, decaying with the gap. */
function volatilityScore(volA, volB) {
  if (!Number.isFinite(volA) || !Number.isFinite(volB)) return null;
  const larger = Math.max(volA, volB);
  if (larger <= 0) return null;
  return Math.max(0, 1 - Math.abs(volA - volB) / larger);
}

/**
 * Similarity between two funds. Returns null when there is not enough shared
 * history to measure co-movement — a structural-only guess is not published as
 * a percentage.
 */
function similarity(entryA, entryB, analyticsA, analyticsB, seriesBySlug) {
  if (!analyticsA || !analyticsB || !analyticsA.available || !analyticsB.available) return null;

  const sameCurrency = analyticsA.currency && analyticsB.currency
    && analyticsA.currency === analyticsB.currency;

  const series = seriesBySlug || {};
  const closesA = series[entryA.slug] || [];
  const closesB = series[entryB.slug] || [];
  const shared = Math.min(closesA.length, closesB.length);

  let correlation = null;
  if (sameCurrency && shared >= MIN_SHARED_MONTHS) {
    const ra = monthlyReturns(closesA.slice(closesA.length - shared));
    const rb = monthlyReturns(closesB.slice(closesB.length - shared));
    // Monthly series are short, so relax the daily-oriented observation floor.
    if (ra.length >= MIN_SHARED_MONTHS - 1 && rb.length >= MIN_SHARED_MONTHS - 1) {
      const cov = m.covariance(ra, rb);
      const sa = m.stdev(ra);
      const sb = m.stdev(rb);
      if (cov !== null && sa && sb) {
        correlation = Math.max(-1, Math.min(1, cov / (sa * sb)));
      }
    }
  }

  if (correlation === null) return null;

  const vol = volatilityScore(analyticsA.risk.volatility_full, analyticsB.risk.volatility_full);
  const structure = structuralScore(entryA, entryB);

  // Map correlation from [-1,1] into [0,1]; negative co-movement is dissimilar.
  const correlationScore = Math.max(0, correlation);

  let weightUsed = W_CORRELATION + W_STRUCTURE;
  let total = correlationScore * W_CORRELATION + structure * W_STRUCTURE;
  if (vol !== null) {
    total += vol * W_VOLATILITY;
    weightUsed += W_VOLATILITY;
  }
  const pct = Math.round((total / weightUsed) * 1000) / 10;

  return {
    similarity_pct: pct,
    components: {
      correlation: m.round(correlation, 4),
      volatility_proximity: vol === null ? null : m.round(vol, 4),
      structural_agreement: m.round(structure, 4),
    },
    shared_months: shared,
  };
}

/**
 * Candidate peers for one fund: same currency, and sharing a category or
 * exposure type. Falls back to same-currency funds when a category is sparse so
 * a niche fund still gets compared against something.
 */
function candidatesFor(entry, byslug) {
  const self = byslug.get(entry.slug);
  const currency = self && self.currency;
  const sameCurrency = UNIVERSE.filter((other) => {
    if (other.slug === entry.slug) return false;
    const a = byslug.get(other.slug);
    return a && a.available && (!currency || a.currency === currency);
  });

  const related = sameCurrency.filter((other) => other.category === entry.category
    || other.exposure_type === entry.exposure_type);

  const pool = related.length >= MAX_PEERS ? related : sameCurrency;
  return pool.slice(0, MAX_CANDIDATES_PER_FUND);
}

function build() {
  const analytics = readJson(ANALYTICS);
  const seriesDoc = fs.existsSync(SERIES) ? readJson(SERIES) : { series: {} };
  const seriesBySlug = seriesDoc.series || {};
  const byslug = new Map(analytics.etfs.map((e) => [e.slug, e]));

  const etfs = [];
  let comparisons = 0;
  for (const entry of UNIVERSE) {
    const self = byslug.get(entry.slug);
    const peers = [];

    for (const other of candidatesFor(entry, byslug)) {
      comparisons += 1;
      const result = similarity(entry, other, self, byslug.get(other.slug), seriesBySlug);
      if (!result) continue;
      peers.push({
        slug: other.slug,
        symbol: other.symbol,
        ...result,
      });
    }

    peers.sort((a, b) => b.similarity_pct - a.similarity_pct);
    const top = peers.slice(0, MAX_PEERS);

    etfs.push({
      slug: entry.slug,
      symbol: entry.symbol,
      available: top.length > 0,
      peers: top,
      evidence: top.length
        ? [
          `similarity measured across ${top[0].shared_months} shared monthly observations`,
          `components: correlation ${(W_CORRELATION * 100).toFixed(0)}%, structure ${(W_STRUCTURE * 100).toFixed(0)}%, volatility proximity ${(W_VOLATILITY * 100).toFixed(0)}%`,
        ]
        : [
          'no comparable peer with sufficient shared history in the same currency',
          'proxy substitution suppressed — no estimated similarity published',
        ],
    });
  }

  const available = etfs.filter((e) => e.available).length;
  const artifact = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_layer: 'computed_from_observed_prices',
    method: {
      note_en: 'Similarity blends observed return correlation, volatility proximity and structural agreement between two funds. It describes how alike two funds have behaved — it is not a ranking or an endorsement.',
      note_ar: 'يمزج مقياس التشابه بين الارتباط المرصود للعوائد وتقارب التذبذب والاتفاق الهيكلي بين صندوقين. وهو يصف مدى تشابه سلوك الصندوقين، وليس ترتيبا أو تزكية.',
      weights: { correlation: W_CORRELATION, structural_agreement: W_STRUCTURE, volatility_proximity: W_VOLATILITY },
      min_shared_months: MIN_SHARED_MONTHS,
      currency_rule: 'correlation computed only between funds quoted in the same currency',
      candidate_rule: `candidates bounded to ${MAX_CANDIDATES_PER_FUND} same-currency funds sharing a category or exposure type, so cost stays near-linear as the universe grows`,
      comparisons_performed: comparisons,
    },
    coverage: { total: UNIVERSE.length, available, unavailable: UNIVERSE.length - available },
    etfs,
    attribution: {
      sources: analytics.attribution.sources,
      derived_from: 'data/intelligence/etf-analytics.json',
      computed_by: 'tools/build-etf-similarity.js',
    },
  };
  artifact.source_hash = hash(JSON.stringify(etfs));
  return artifact;
}

function main() {
  if (!fs.existsSync(ANALYTICS)) {
    console.error('[etf-similarity] FAILED: run tools/build-etf-analytics.js --write first');
    process.exit(1);
  }
  const artifact = build();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-similarity] wrote ${path.relative(ROOT, OUT)} (${artifact.coverage.available}/${artifact.coverage.total} with peers)`);
  } else {
    console.log(`[etf-similarity] dry run — ${artifact.coverage.available}/${artifact.coverage.total} with peers`);
  }
}

if (require.main === module) main();

module.exports = { build, similarity, structuralScore, volatilityScore, MAX_PEERS };
