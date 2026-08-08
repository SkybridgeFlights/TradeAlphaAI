'use strict';

// Phase 228 CP14 — portfolio validators.
//
// Follows the repo pattern: pure validate* functions returning failure strings, a
// thin --check=<name> dispatcher, and a --self-test that mutates known-good input
// and asserts every rule fires.
//
//   --check=schema      migration declares FKs, cascades, constraints, indexes
//   --check=analytics   engine arithmetic and honest degradation
//   --check=costs       TER is never zero; coverage thresholds enforced
//   --check=overlap     evidence discipline; holdings overlap never invented
//   --check=provenance  no metric published without a stated basis
//   --check=pages       public model page: framing, EN/AR parity, no advice
//   --check=discovery   route registration and retired-route redirect
//   --self-test         negative tests for every rule above
//
// The api / ownership / snapshots subcommands are deliberately absent until the
// routes exist: a validator that passes because it has nothing to inspect is
// worse than no validator, since it reports green for an untested surface.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(ROOT, 'db/migrations/0005_portfolios.sql');

const REQUIRED_TABLES = [
  'portfolios', 'portfolio_positions', 'portfolio_targets',
  'portfolio_transactions', 'portfolio_snapshots',
];

// Advice language forbidden on portfolio surfaces when ASSERTED. Negation-aware,
// for the same reason the production gate is: this platform's own copy states
// "there is no best portfolio" and "this is not a recommendation", and flagging
// those would punish correct disclaiming while teaching nothing.
const ADVICE_PHRASES = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bstrong buy\b/i, /\bstrong sell\b/i,
  /\bbuy signals?\b/i, /\bsell signals?\b/i,
  /\bbest portfolio\b/i, /\boptimal portfolio\b/i,
  /\bshould (?:invest|buy|sell|hold)\b/i,
  /\brebalance now\b/i, /\brecommended action\b/i,
  /\bguaranteed (?:returns?|profits?|outcomes?)\b/i,
];

const NEGATION = /\b(?:not|no|never|without|non|isn'?t|aren'?t|doesn'?t|don'?t|cannot|can'?t|rather than|instead of|neither|nor|avoid|prohibited|forbidden)\b|(?:ليس|ليست|لا\s|دون|بدلا)/i;

function isDisclaimed(text, index, length) {
  const window = text.slice(Math.max(0, index - 140), index + length + 200);
  return NEGATION.test(window);
}

/** First asserted advice phrase, or null. */
function findAssertedAdvice(text) {
  const cleaned = String(text).replace(/<code[\s\S]*?<\/code>/gi, ' ');
  for (const pattern of ADVICE_PHRASES) {
    const scanner = new RegExp(pattern.source, 'gi');
    let match;
    while ((match = scanner.exec(cleaned)) !== null) {
      if (isDisclaimed(cleaned, match.index, match[0].length)) continue;
      return { pattern: pattern.source, match: match[0] };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// schema
// ---------------------------------------------------------------------------

function validateSchema(sql) {
  const failures = [];
  if (!sql) return ['migration 0005_portfolios.sql unreadable'];

  for (const table of REQUIRED_TABLES) {
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`, 'i').test(sql)) {
      failures.push(`missing table ${table}`);
    }
  }

  // Re-run safety: db/schema.js executes this file on every cold start and throws
  // on failure, which would take every existing account route down with it.
  const statements = sql.split(';').map((s) => s.trim()).filter((s) => s && !s.startsWith('--'));
  for (const stmt of statements) {
    if (/^CREATE (TABLE|INDEX)/i.test(stmt) && !/IF NOT EXISTS/i.test(stmt)) {
      failures.push(`non-idempotent statement: ${stmt.slice(0, 60)}`);
    }
  }

  // Ownership: portfolios must cascade from accounts, and every child from
  // portfolios, so a deleted account leaves nothing behind.
  if (!/account_id\s+TEXT\s+NOT NULL\s+REFERENCES accounts\(account_id\)\s+ON DELETE CASCADE/i.test(sql)) {
    failures.push('portfolios.account_id must reference accounts(account_id) ON DELETE CASCADE');
  }
  for (const child of REQUIRED_TABLES.filter((t) => t !== 'portfolios')) {
    const block = new RegExp(`CREATE TABLE IF NOT EXISTS ${child}\\b[\\s\\S]*?\\);`, 'i').exec(sql);
    if (!block) continue;
    if (!/portfolio_id\s+BIGINT\s+NOT NULL\s+REFERENCES portfolios\(id\)\s+ON DELETE CASCADE/i.test(block[0])) {
      failures.push(`${child} must reference portfolios(id) ON DELETE CASCADE`);
    }
    // A child storing its own account_id would be a second source of truth that
    // could drift out of step with the parent and become a cross-account read.
    if (/\baccount_id\b/i.test(block[0])) {
      failures.push(`${child} must not store account_id independently — ownership derives from portfolios`);
    }
  }

  // Money and quantity must never be binary floating point.
  //
  // Scanned against the DDL only. Comments legitimately contain these words —
  // the migration's own header says "NUMERIC, never float", and prose like
  // "a real series" would otherwise match \bREAL\b. Stripping comments first is
  // what makes this check about the schema rather than about its documentation.
  const ddlOnly = sql.replace(/--[^\n]*/g, ' ');
  if (/\b(REAL|DOUBLE PRECISION|FLOAT)\b/i.test(ddlOnly)) {
    failures.push('monetary/quantity columns must be NUMERIC, not REAL/FLOAT/DOUBLE PRECISION');
  }

  for (const [table, cols] of [
    ['portfolios', ['UNIQUE (account_id, slug)']],
    ['portfolio_positions', ['UNIQUE (portfolio_id, instrument_type, symbol)']],
    ['portfolio_targets', ['UNIQUE (portfolio_id, symbol)']],
    ['portfolio_snapshots', ['UNIQUE (portfolio_id, snapshot_date)']],
  ]) {
    for (const c of cols) if (!sql.includes(c)) failures.push(`${table} missing constraint ${c}`);
  }

  for (const table of REQUIRED_TABLES) {
    if (!new RegExp(`CREATE INDEX IF NOT EXISTS ${table}_`, 'i').test(sql)) {
      failures.push(`${table} has no index`);
    }
  }

  // Closed enums belong in CHECK constraints, not in convention alone.
  if (!/instrument_type\s+TEXT\s+NOT NULL\s+CHECK \(instrument_type IN \(/i.test(sql)) {
    failures.push('portfolio_positions.instrument_type must be CHECK-constrained');
  }
  if (!/portfolio_type\s+TEXT[\s\S]{0,80}CHECK \(portfolio_type IN \(/i.test(sql)) {
    failures.push('portfolios.portfolio_type must be CHECK-constrained');
  }
  // The ledger records history; it must not carry instruction-shaped values.
  const enumMatch = /transaction_type[\s\S]{0,200}?CHECK \(transaction_type IN \(([^)]*)\)/i.exec(sql);
  if (!enumMatch) failures.push('portfolio_transactions.transaction_type must be CHECK-constrained');
  // No \b before the quote: a word boundary cannot exist between a space and an
  // apostrophe, so /\b'buy'/ never matches anything. The quotes are the
  // delimiters here, which is precisely what makes the value exact.
  else if (/'(buy|sell)'/i.test(enumMatch[1])) {
    failures.push("transaction_type must use neutral accounting terms, not 'buy'/'sell'");
  }

  return failures;
}

// ---------------------------------------------------------------------------
// analytics
// ---------------------------------------------------------------------------

function validateAnalytics(result) {
  const failures = [];
  if (!result || typeof result !== 'object') return ['analytics result unreadable'];

  if (!result.available) {
    if (!result.reason) failures.push('unavailable result carries no reason');
    return failures;
  }

  for (const key of ['disclaimer_en', 'disclaimer_ar']) {
    if (!result[key] || String(result[key]).length < 40) failures.push(`missing ${key}`);
  }

  // Weights must be a partition of the valued portfolio.
  if (result.allocation && result.allocation.available) {
    const sum = result.allocation.positions.reduce((a, p) => a + p.weight, 0);
    if (Math.abs(sum - 1) > 0.001) failures.push(`allocation weights sum to ${sum.toFixed(4)}, expected 1`);
    for (const p of result.allocation.positions) {
      if (!(p.weight >= 0 && p.weight <= 1)) failures.push(`${p.symbol}: weight outside 0-1`);
      if (!p.basis) failures.push(`${p.symbol}: no valuation basis stated`);
    }
  }

  // A single total across currencies is not money.
  if (result.value && result.value.available && result.currency_exposure && !result.currency_exposure.single_currency) {
    failures.push('portfolio total published across multiple currencies without FX normalisation');
  }
  if (result.value && !result.value.available && !result.value.reason) {
    failures.push('withheld total carries no reason');
  }

  // Concentration internal consistency.
  const c = result.concentration;
  if (c && c.available) {
    if (!(c.hhi > 0 && c.hhi <= 1.0001)) failures.push(`HHI ${c.hhi} outside (0,1]`);
    const expected = c.hhi > 0 ? 1 / c.hhi : null;
    if (expected && Math.abs(expected - c.effective_positions) > 0.02) {
      failures.push('effective_positions does not match 1/HHI');
    }
    if (c.top_position.weight > 1.0001) failures.push('top position weight exceeds 1');
  }

  const { DIVERSIFICATION_LABELS } = require('./portfolio-analytics');
  if (result.diversification && !DIVERSIFICATION_LABELS.includes(result.diversification.label)) {
    failures.push(`diversification label "${result.diversification.label}" outside the allowed set`);
  }

  // Risk must name its currency, coverage and exclusions.
  if (result.risk && result.risk.available) {
    if (!result.risk.currency) failures.push('risk block published without naming its currency');
    if (!Number.isFinite(result.risk.coverage)) failures.push('risk block published without coverage');
    if (result.risk.max_drawdown > 0) failures.push('max drawdown must be negative or zero');
    if (result.risk.sharpe !== null && !result.risk.risk_free_used) {
      failures.push('Sharpe published without naming the risk-free input');
    }
    if (result.risk.excluded_positions && result.risk.excluded_positions.length && !result.risk.excluded_reason) {
      failures.push('risk excluded positions without stating why');
    }
  }

  for (const [name, v] of Object.entries(result.correlation && result.correlation.available ? { pairs: result.correlation.pairs } : {})) {
    for (const p of v) if (Math.abs(p.correlation) > 1) failures.push(`${name}: correlation outside [-1,1]`);
  }

  return failures;
}

// ---------------------------------------------------------------------------
// costs — the rule this platform is most likely to be judged on
// ---------------------------------------------------------------------------

function validateCosts(result) {
  const failures = [];
  const cost = result && result.cost;
  if (!cost) return ['no cost block'];

  if (!Number.isFinite(cost.coverage)) failures.push('cost block carries no coverage figure');
  if (!cost.band) failures.push('cost block carries no coverage band');

  if (cost.available) {
    // A weighted figure is only legitimate at high coverage; below that it is
    // always too low, because the holdings without data contribute zero.
    if (cost.band !== 'high') failures.push(`weighted cost published at ${cost.band} coverage — must be high`);
    if (!Number.isFinite(cost.weighted_ter_pct)) failures.push('cost available but no weighted figure');
    if (cost.weighted_ter_pct === 0) failures.push('weighted cost of exactly 0 — an absent expense ratio has been treated as zero');
  } else {
    if (!cost.reason) failures.push('withheld cost carries no reason');
    if (cost.weighted_ter_pct !== undefined && cost.weighted_ter_pct !== null) {
      failures.push('cost withheld yet a weighted figure is present');
    }
    if (cost.coverage > 0.85) failures.push('cost withheld despite high coverage');
  }
  return failures;
}

// ---------------------------------------------------------------------------
// overlap
// ---------------------------------------------------------------------------

function validateOverlap(result) {
  const failures = [];
  if (!result || typeof result !== 'object') return ['overlap result unreadable'];

  // The absence must be stated, always.
  if (result.holdings_overlap_available !== false) {
    failures.push('holdings_overlap_available must be false while no source publishes constituents');
  }
  if (result.available && !result.holdings_overlap_note_en) failures.push('missing holdings-overlap explanation');

  const { EVIDENCE_CLASSES } = require('./portfolio-overlap');
  for (const pair of (result.pairs || [])) {
    if (!EVIDENCE_CLASSES.includes(pair.strongest)) failures.push(`${pair.a}/${pair.b}: strongest evidence outside the allowed set`);
    if (!Array.isArray(pair.findings) || !pair.findings.length) failures.push(`${pair.a}/${pair.b}: no findings`);
    for (const f of pair.findings) {
      if (!f.evidence) failures.push(`${pair.a}/${pair.b}: finding without an evidence class`);
      if (!f.provenance) failures.push(`${pair.a}/${pair.b}: finding without provenance`);
      if (f.evidence === 'measured_co_movement' && !Number.isFinite(f.correlation)) {
        failures.push(`${pair.a}/${pair.b}: co-movement finding without a correlation`);
      }
    }
    if (!pair.holdings_overlap || pair.holdings_overlap.available !== false) {
      failures.push(`${pair.a}/${pair.b}: holdings overlap must be reported unavailable`);
    }
    if (pair.a === pair.b) failures.push('a pair compares a holding with itself');
  }

  // Clusters may only form on verified evidence. Correlation alone must not
  // merge two funds, or redundancy is overstated.
  for (const cluster of (result.clusters || [])) {
    if (cluster.members.length < 2) failures.push('cluster with fewer than two members');
    const supported = cluster.members.every((symbol) => (result.pairs || []).some((p) => (p.a === symbol || p.b === symbol)
      && (p.strongest === 'verified_same_fund' || p.strongest === 'verified_share_class')));
    if (!supported) failures.push(`cluster ${cluster.members.join('+')} is not supported by verified evidence`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// provenance
// ---------------------------------------------------------------------------

function validateProvenance(result) {
  const failures = [];
  if (!result || !result.available) return failures;

  // Every quantitative block must state what it covers and what produced it.
  for (const name of ['cost', 'score', 'risk']) {
    const block = result[name];
    if (!block) { failures.push(`missing ${name} block`); continue; }
    if (!Number.isFinite(block.coverage)) failures.push(`${name}: no coverage stated`);
    if (block.available && name === 'risk' && !block.frequency) failures.push('risk: no observation frequency stated');
  }
  if (result.valuation && !Array.isArray(result.valuation.bases_used)) {
    failures.push('valuation bases not reported');
  }
  if (result.allocation_by_category && result.allocation_by_category.length && result.category_basis !== 'tradealphaai_classification') {
    failures.push('category allocation published without labelling it as a TradeAlphaAI classification');
  }
  return failures;
}

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------

const MODEL_ROUTE = 'etfs/portfolio-models/';

function validatePages() {
  const failures = [];
  for (const ar of [false, true]) {
    const rel = `${ar ? 'ar/' : ''}${MODEL_ROUTE}index.html`;
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { failures.push(`${rel}: missing`); continue; }
    const html = fs.readFileSync(file, 'utf8');
    const main = (html.match(/<main[\s\S]*?<\/main>/) || [''])[0];

    if (ar && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing AR RTL`);
    if (!ar && !/<html lang="en" dir="ltr">/.test(html)) failures.push(`${rel}: missing EN LTR`);
    if (!new RegExp(`rel="canonical" href="https://www\\.tradealphaai\\.com/${ar ? 'ar/' : ''}${MODEL_ROUTE.replace(/\//g, '\\/')}"`).test(html)) {
      failures.push(`${rel}: wrong or missing canonical`);
    }
    if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) failures.push(`${rel}: missing hreflang parity`);

    // These are public educational pages and must stay indexable.
    if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: should be indexable`);

    for (const section of ['etf-model-assumptions', 'etf-model-boundary', 'etf-portfolios-models']) {
      if (!main.includes(`id="${section}"`)) failures.push(`${rel}: missing section ${section}`);
    }
    // The boundary statement is the point of the page: a model must never be
    // mistaken for, or silently become, somebody's actual portfolio. Both the
    // account disclaimer and the no-ranking statement must be present.
    if (!/connected to any account|لا يرتبط أي شيء في هذه الصفحة بأي حساب/.test(main)) {
      failures.push(`${rel}: missing the explicit account-boundary statement`);
    }
    if (!/no best portfolio|لا توجد محفظة أفضل/.test(main)) {
      failures.push(`${rel}: missing the explicit no-best-portfolio statement`);
    }
    const advice = findAssertedAdvice(main);
    if (advice) failures.push(`${rel}: asserted advice language "${advice.match}"`);

    if (/\b(undefined|NaN|\[object Object\])\b/.test(main)) failures.push(`${rel}: leaks undefined/NaN`);
    const models = (main.match(/id="model-/g) || []).length;
    if (models < 6) failures.push(`${rel}: only ${models} models rendered`);
  }

  // EN/AR structural parity.
  const en = fs.existsSync(path.join(ROOT, `${MODEL_ROUTE}index.html`)) ? fs.readFileSync(path.join(ROOT, `${MODEL_ROUTE}index.html`), 'utf8') : '';
  const arHtml = fs.existsSync(path.join(ROOT, `ar/${MODEL_ROUTE}index.html`)) ? fs.readFileSync(path.join(ROOT, `ar/${MODEL_ROUTE}index.html`), 'utf8') : '';
  if (en && arHtml) {
    const ids = (s) => (s.match(/id="model-[a-z-]+"/g) || []).sort().join(',');
    if (ids(en) !== ids(arHtml)) failures.push('EN and AR model pages render different model sets');
  }
  return failures;
}

// ---------------------------------------------------------------------------
// discovery
// ---------------------------------------------------------------------------

function validateDiscovery() {
  const failures = [];
  const core = fs.existsSync(path.join(ROOT, 'sitemap-core.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap-core.xml'), 'utf8') : '';
  const arMap = fs.existsSync(path.join(ROOT, 'sitemap-ar.xml')) ? fs.readFileSync(path.join(ROOT, 'sitemap-ar.xml'), 'utf8') : '';

  if (!core.includes(`/${MODEL_ROUTE}`)) failures.push(`sitemap-core missing /${MODEL_ROUTE}`);
  if (!arMap.includes(`/ar/${MODEL_ROUTE}`)) failures.push(`sitemap-ar missing /ar/${MODEL_ROUTE}`);

  // The retired route must not linger in a sitemap, and must redirect.
  if (core.includes('/etfs/portfolios/')) failures.push('sitemap-core still lists the retired /etfs/portfolios/ route');
  if (fs.existsSync(path.join(ROOT, 'etfs/portfolios'))) failures.push('retired route directory etfs/portfolios still on disk');

  let vercel = {};
  try { vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8')); } catch { /* handled below */ }
  const redirects = vercel.redirects || [];
  for (const source of ['/etfs/portfolios/', '/ar/etfs/portfolios/']) {
    const hit = redirects.find((r) => r.source === source);
    if (!hit) failures.push(`vercel.json has no redirect for the retired route ${source}`);
    else if (!hit.permanent) failures.push(`${source} redirect should be permanent (301)`);
  }
  return failures;
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

function loadFixture() {
  const { loadArtifacts } = require('./portfolio-artifacts');
  const { analysePortfolio } = require('./portfolio-analytics');
  const { analyseOverlap } = require('./portfolio-overlap');
  const artifacts = loadArtifacts();
  const positions = [
    { instrument_type: 'etf', symbol: 'VOO', slug: 'voo', quantity: 40, contribution_amount: 16000 },
    { instrument_type: 'etf', symbol: 'QQQ', slug: 'qqq', quantity: 15, contribution_amount: 6750 },
    { instrument_type: 'etf', symbol: 'SCHD', slug: 'schd', quantity: 60, contribution_amount: 4680 },
    { instrument_type: 'cash', symbol: 'CASH', slug: 'cash', quantity: 2500, current_value_override: 2500 },
  ];
  const analytics = analysePortfolio(positions, artifacts, { baseCurrency: 'USD' });
  const overlapPositions = [
    { instrument_type: 'etf', symbol: 'IWDA', slug: 'iwda', weight: 0.3 },
    { instrument_type: 'etf', symbol: 'EUNL', slug: 'eunl', weight: 0.3 },
    { instrument_type: 'etf', symbol: 'VWCE', slug: 'vwce', weight: 0.2 },
    { instrument_type: 'etf', symbol: 'VWRL', slug: 'vwrl', weight: 0.2 },
  ];
  const overlap = analyseOverlap(overlapPositions, artifacts);
  return { analytics, overlap, artifacts };
}

const CHECKS = {
  schema: () => ({ name: 'check:portfolio-schema', failures: validateSchema(fs.existsSync(MIGRATION) ? fs.readFileSync(MIGRATION, 'utf8') : null) }),
  analytics: () => ({ name: 'check:portfolio-analytics', failures: validateAnalytics(loadFixture().analytics) }),
  costs: () => ({ name: 'check:portfolio-costs', failures: validateCosts(loadFixture().analytics) }),
  overlap: () => ({ name: 'check:portfolio-overlap', failures: validateOverlap(loadFixture().overlap) }),
  provenance: () => ({ name: 'check:portfolio-provenance', failures: validateProvenance(loadFixture().analytics) }),
  pages: () => ({ name: 'check:portfolio-pages', failures: validatePages() }),
  discovery: () => ({ name: 'check:portfolio-discovery', failures: validateDiscovery() }),
};

function failFor(name, failures) {
  if (failures.length) {
    failures.forEach((f) => console.error(`[${name}] FAIL: ${f}`));
    return false;
  }
  console.log(`[${name}] OK`);
  return true;
}

function selfTest() {
  const sql = fs.readFileSync(MIGRATION, 'utf8');
  const { analytics, overlap } = loadFixture();
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const cases = [
    ['schema clean', () => validateSchema(sql), false],
    ['schema non-idempotent', () => validateSchema(sql.replace('CREATE TABLE IF NOT EXISTS portfolio_targets', 'CREATE TABLE portfolio_targets')), true],
    ['schema float money', () => validateSchema(sql.replace('NUMERIC(24,4)', 'DOUBLE PRECISION')), true],
    ['schema child stores account_id', () => validateSchema(sql.replace(
      'portfolio_id           BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,',
      'portfolio_id           BIGINT NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,\n  account_id             TEXT NOT NULL,',
    )), true],
    ['schema missing cascade', () => validateSchema(sql.replace('REFERENCES accounts(account_id) ON DELETE CASCADE', 'REFERENCES accounts(account_id)')), true],
    ['schema buy/sell in ledger', () => validateSchema(sql.replace("'acquisition', 'disposal'", "'buy', 'sell'")), true],

    ['analytics clean', () => validateAnalytics(analytics), false],
    ['analytics weights not summing to 1', () => {
      const m = clone(analytics);
      m.allocation.positions[0].weight += 0.2;
      return validateAnalytics(m);
    }, true],
    ['analytics total across currencies', () => {
      const m = clone(analytics);
      m.currency_exposure.single_currency = false;
      return validateAnalytics(m);
    }, true],
    ['analytics positive drawdown', () => {
      const m = clone(analytics);
      m.risk.max_drawdown = 0.1;
      return validateAnalytics(m);
    }, true],
    ['analytics label outside allowed set', () => {
      const m = clone(analytics);
      m.diversification.label = 'optimal';
      return validateAnalytics(m);
    }, true],
    ['analytics Sharpe without risk-free', () => {
      const m = clone(analytics);
      m.risk.risk_free_used = null;
      return validateAnalytics(m);
    }, true],

    ['costs clean (withheld)', () => validateCosts(analytics), false],
    ['costs TER treated as zero', () => {
      const m = clone(analytics);
      m.cost = { available: true, weighted_ter_pct: 0, coverage: 1, band: 'high' };
      return validateCosts(m);
    }, true],
    ['costs published at partial coverage', () => {
      const m = clone(analytics);
      m.cost = { available: true, weighted_ter_pct: 0.08, coverage: 0.4, band: 'partial' };
      return validateCosts(m);
    }, true],
    ['costs withheld but figure present', () => {
      const m = clone(analytics);
      m.cost = { available: false, reason: 'x', coverage: 0.1, band: 'insufficient', weighted_ter_pct: 0.2 };
      return validateCosts(m);
    }, true],

    ['overlap clean', () => validateOverlap(overlap), false],
    ['overlap claims holdings data', () => {
      const m = clone(overlap);
      m.holdings_overlap_available = true;
      return validateOverlap(m);
    }, true],
    ['overlap pair claims holdings overlap', () => {
      const m = clone(overlap);
      m.pairs[0].holdings_overlap.available = true;
      return validateOverlap(m);
    }, true],
    ['overlap finding without provenance', () => {
      const m = clone(overlap);
      delete m.pairs[0].findings[0].provenance;
      return validateOverlap(m);
    }, true],
    ['overlap cluster on correlation alone', () => {
      const m = clone(overlap);
      m.clusters.push({ members: ['QQQ', 'XLK'], combined_weight: 0.3, weight_complete: true });
      return validateOverlap(m);
    }, true],

    ['provenance clean', () => validateProvenance(analytics), false],
    ['provenance category unlabelled', () => {
      const m = clone(analytics);
      m.category_basis = 'observed';
      return validateProvenance(m);
    }, true],
    ['provenance risk without frequency', () => {
      const m = clone(analytics);
      delete m.risk.frequency;
      return validateProvenance(m);
    }, true],

    ['pages clean', () => validatePages(), false],
    ['discovery clean', () => validateDiscovery(), false],

    // Advice detection must be assertion-aware in both directions.
    ['advice asserted is caught', () => (findAssertedAdvice('This is the best portfolio for you.') ? ['caught'] : []), true],
    ['advice negated is allowed', () => (findAssertedAdvice('There is no best portfolio on this page.') ? ['caught'] : []), false],
    ['advice rebalance-now caught', () => (findAssertedAdvice('You should rebalance now to fix this.') ? ['caught'] : []), true],
    ['advice disclaimer allowed', () => (findAssertedAdvice('This is not a recommended action and never an instruction.') ? ['caught'] : []), false],
  ];

  let ok = 0;
  for (const [label, run, shouldFail] of cases) {
    let failed;
    try { failed = run().length > 0; } catch (e) { failed = true; }
    if (failed === shouldFail) ok += 1;
    else console.error(`[portfolio] self-test MISMATCH: ${label} (expected ${shouldFail ? 'fail' : 'pass'})`);
  }
  console.log(`[portfolio] self-test: ${ok}/${cases.length} passed`);
  return ok === cases.length;
}

function main() {
  if (process.argv.includes('--self-test')) process.exit(selfTest() ? 0 : 1);
  let check = null;
  for (const arg of process.argv.slice(2)) {
    const m = /^--check=(.+)$/.exec(arg);
    if (m) check = m[1];
  }
  if (!check || !CHECKS[check]) {
    console.error(`usage: node tools/check-portfolio.js --check=<${Object.keys(CHECKS).join('|')}> | --self-test`);
    process.exit(2);
  }
  const { name, failures } = CHECKS[check]();
  if (!failFor(name, failures)) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  validateSchema, validateAnalytics, validateCosts, validateOverlap,
  validateProvenance, validatePages, validateDiscovery,
  findAssertedAdvice, selfTest, ADVICE_PHRASES, REQUIRED_TABLES,
};
