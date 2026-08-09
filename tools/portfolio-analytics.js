'use strict';

// Phase 228 CP5 — portfolio analytics engine.
//
// Pure computation over a holder's positions plus the ETF Intelligence Center
// artifacts. No I/O, no database, no network: callers pass the artifacts in, so
// the same code serves the API route, the build tooling and the validator, and
// every figure is reproducible from its inputs.
//
// THE RULE, inherited from the ETF Center: a number is published only when the
// evidence for it exists. Specifically —
//
//   * An absent expense ratio is NOT zero. Weighted cost is withheld entirely
//     rather than computed over the subset that happens to have data, because a
//     "portfolio TER" derived from 20% of holdings understates the real figure
//     and reads as authoritative.
//   * A portfolio total is withheld when holdings span currencies and no FX
//     normalisation is available, since adding EUR to USD produces a number that
//     is not money.
//   * Risk statistics need a shared observation window. Positions with no
//     overlapping history are excluded and the exclusion is reported.
//   * Every block carries `coverage` (what share of the portfolio it describes)
//     and `basis` (what produced it).
//
// Nothing here decides, ranks or advises. It measures.

const m = require('./etf-metrics');

// Instrument types accepted from the persistence layer.
const INSTRUMENT_TYPES = ['etf', 'asset', 'sector', 'equity', 'cash'];

// How a position's value was arrived at. Reported per position so a total can
// never silently mix a market observation with a number somebody typed.
const VALUATION = {
  OBSERVED: 'observed_price',
  OVERRIDE: 'holder_supplied',
  CASH: 'cash_balance',
  UNAVAILABLE: 'unavailable',
};

// Coverage bands used across cost, score and risk blocks.
const COVERAGE_BANDS = [
  { min: 0.85, label: 'high' },
  { min: 0.5, label: 'partial' },
  { min: 0, label: 'insufficient' },
];

function coverageBand(ratio) {
  if (!Number.isFinite(ratio)) return 'insufficient';
  for (const band of COVERAGE_BANDS) if (ratio >= band.min) return band.label;
  return 'insufficient';
}

const round = (v, d) => m.round(v, d);

// ---------------------------------------------------------------------------
// Valuation
// ---------------------------------------------------------------------------

/**
 * Latest observed close for a slug, from the monthly series artifact.
 * Monthly closes are what the ETF Center ships; they are the most recent
 * verified price this platform holds, and the date is reported alongside so a
 * reader knows how fresh the valuation is.
 */
function latestClose(slug, series) {
  const closes = series && series[slug];
  if (!Array.isArray(closes) || !closes.length) return null;
  const value = closes[closes.length - 1];
  return Number.isFinite(value) ? value : null;
}

/**
 * Value one position. Returns the amount, the currency it is expressed in, and
 * which basis produced it — never a bare number.
 */
function valuePosition(position, artifacts) {
  const { analyticsBySlug, series } = artifacts;

  if (position.instrument_type === 'cash') {
    const amount = Number(position.current_value_override ?? position.quantity ?? 0);
    return {
      value: Number.isFinite(amount) ? amount : null,
      currency: position.currency || null,
      basis: Number.isFinite(amount) ? VALUATION.CASH : VALUATION.UNAVAILABLE,
    };
  }

  // A holder-supplied value wins over a market price: they may hold a share
  // class or venue this platform does not track, and their figure is the one
  // they can reconcile against a statement. It is labelled as theirs.
  const override = Number(position.current_value_override);
  if (Number.isFinite(override) && override > 0) {
    return { value: override, currency: position.currency || null, basis: VALUATION.OVERRIDE };
  }

  const analytics = analyticsBySlug.get(position.slug);
  const quantity = Number(position.quantity);
  const close = latestClose(position.slug, series);
  if (analytics && analytics.available && Number.isFinite(quantity) && quantity > 0 && Number.isFinite(close)) {
    return {
      value: quantity * close,
      currency: analytics.currency || null,
      basis: VALUATION.OBSERVED,
      as_of: analytics.last_observation || null,
    };
  }

  // Recordable-universe fallback. A holding outside the intelligence universe
  // has no monthly series and no analytics record, but it does have an observed
  // quote — so it can be valued and weighted like any other position.
  //
  // This is pricing ONLY. It supplies no history, so the risk, correlation and
  // score blocks continue to exclude the position and report reduced coverage,
  // and its coverage level stays "basic". Being valuable and being researched
  // are deliberately different things.
  const quote = artifacts.prices && artifacts.prices.get
    ? artifacts.prices.get(String(position.symbol || '').toUpperCase())
    : null;
  if (quote && quote.status === 'ok' && Number.isFinite(quote.price)
      && Number.isFinite(quantity) && quantity > 0) {
    return {
      value: quantity * quote.price,
      currency: quote.currency || null,
      basis: VALUATION.OBSERVED,
      as_of: quote.as_of || null,
    };
  }

  return { value: null, currency: analytics ? analytics.currency : null, basis: VALUATION.UNAVAILABLE };
}

// ---------------------------------------------------------------------------
// Allocation
// ---------------------------------------------------------------------------

function allocationBlock(valued, total) {
  if (!Number.isFinite(total) || total <= 0) {
    return { available: false, reason: 'no_valued_positions', positions: [] };
  }
  const positions = valued
    .filter((p) => Number.isFinite(p.value))
    .map((p) => ({
      symbol: p.symbol,
      slug: p.slug,
      instrument_type: p.instrument_type,
      value: round(p.value, 2),
      weight: round(p.value / total, 6),
      basis: p.basis,
    }))
    .sort((a, b) => b.weight - a.weight);
  return { available: true, positions };
}

/** Group weights by an arbitrary key function. */
function groupWeights(positions, keyOf) {
  const out = new Map();
  for (const p of positions) {
    const key = keyOf(p);
    if (!key) continue;
    out.set(key, (out.get(key) || 0) + p.weight);
  }
  return [...out.entries()]
    .map(([key, weight]) => ({ key, weight: round(weight, 6) }))
    .sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Concentration and diversification
// ---------------------------------------------------------------------------

/**
 * Herfindahl-Hirschman index over position weights: the sum of squared weights.
 * 1 means everything sits in one holding; 1/n means perfectly even. It is a
 * measurement of how concentrated the portfolio is, not a judgement about
 * whether that is appropriate for anyone.
 */
function concentrationBlock(positions) {
  if (!positions.length) return { available: false, reason: 'no_valued_positions' };
  const hhi = positions.reduce((acc, p) => acc + p.weight * p.weight, 0);
  const top = positions[0];
  const topFive = positions.slice(0, 5).reduce((acc, p) => acc + p.weight, 0);
  // Effective number of holdings: how many equally-weighted positions would
  // produce the same concentration. More intuitive than the raw index.
  const effective = hhi > 0 ? 1 / hhi : null;
  return {
    available: true,
    hhi: round(hhi, 6),
    effective_positions: round(effective, 2),
    top_position: { symbol: top.symbol, weight: round(top.weight, 6) },
    top_five_weight: round(topFive, 6),
    position_count: positions.length,
  };
}

// Qualitative bands. These are the only labels the framework may emit, and each
// describes the measurement — none of them tells a holder what to do.
const DIVERSIFICATION_LABELS = ['concentrated', 'moderately_concentrated', 'balanced', 'broadly_diversified', 'insufficient_data'];

function diversificationLabel(concentration, distinctCategories) {
  if (!concentration.available || !Number.isFinite(concentration.effective_positions)) return 'insufficient_data';
  const effective = concentration.effective_positions;
  const breadth = distinctCategories || 1;
  if (effective < 2 || concentration.top_position.weight > 0.6) return 'concentrated';
  if (effective < 4 || concentration.top_position.weight > 0.4) return 'moderately_concentrated';
  if (effective >= 6 && breadth >= 4) return 'broadly_diversified';
  return 'balanced';
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

/**
 * Weighted expense ratio.
 *
 * Deliberately all-or-nothing: unless essentially every valued holding has a
 * verified expense ratio, no weighted figure is produced. A partial average is
 * the specific failure mode this platform refuses — it looks precise, it is
 * always too low, and it is the number a holder would act on.
 */
function costBlock(valued, total, artifacts) {
  const { factsBySlug } = artifacts;
  const priced = valued.filter((p) => Number.isFinite(p.value) && p.instrument_type !== 'cash');
  if (!priced.length || !Number.isFinite(total) || total <= 0) {
    return { available: false, reason: 'no_valued_positions', coverage: 0, band: 'insufficient' };
  }

  let covered = 0;
  let weighted = 0;
  const missing = [];
  for (const p of priced) {
    const facts = factsBySlug.get(p.slug);
    const ter = facts && facts.fields && facts.fields.ter_pct;
    const hasTer = ter && ter.provenance !== 'unavailable' && Number.isFinite(ter.value);
    if (hasTer) {
      covered += p.value;
      weighted += ter.value * p.value;
    } else {
      missing.push(p.symbol);
    }
  }

  const coverage = covered / total;
  const band = coverageBand(coverage);
  // Only a high-coverage portfolio yields a published figure.
  if (band !== 'high') {
    return {
      available: false,
      reason: 'insufficient_verified_cost_data',
      coverage: round(coverage, 4),
      band,
      positions_missing_cost: missing,
      note_en: 'Weighted cost unavailable until verified fund-cost data is connected.',
      note_ar: 'التكلفة المرجّحة غير متاحة إلى حين ربط بيانات تكلفة صناديق موثّقة.',
    };
  }
  return {
    available: true,
    weighted_ter_pct: round(weighted / covered, 4),
    coverage: round(coverage, 4),
    band,
    positions_missing_cost: missing,
  };
}

// ---------------------------------------------------------------------------
// Weighted TradeAlpha Score
// ---------------------------------------------------------------------------

function scoreBlock(valued, total, artifacts) {
  const { scoreBySlug } = artifacts;
  const priced = valued.filter((p) => Number.isFinite(p.value) && p.instrument_type !== 'cash');
  if (!priced.length || !Number.isFinite(total) || total <= 0) {
    return { available: false, reason: 'no_valued_positions', coverage: 0, band: 'insufficient' };
  }
  let covered = 0;
  let weighted = 0;
  for (const p of priced) {
    const score = scoreBySlug.get(p.slug);
    if (score && Number.isFinite(score.overall)) {
      covered += p.value;
      weighted += score.overall * p.value;
    }
  }
  const coverage = covered / total;
  const band = coverageBand(coverage);
  if (coverage <= 0) return { available: false, reason: 'no_scored_holdings', coverage: 0, band };
  return {
    available: band !== 'insufficient',
    weighted_score: band === 'insufficient' ? null : round(weighted / covered, 1),
    coverage: round(coverage, 4),
    band,
  };
}

// ---------------------------------------------------------------------------
// Risk
// ---------------------------------------------------------------------------

/**
 * Portfolio risk from a weighted series reconstructed out of each holding's
 * monthly closes.
 *
 * Only positions sharing a single currency participate: combining a EUR-quoted
 * and a USD-quoted series without FX would measure the exchange rate and label
 * it portfolio risk. When holdings span currencies the block reports what it
 * excluded rather than quietly returning a smaller portfolio's numbers.
 */
function riskBlock(valued, total, artifacts) {
  const { analyticsBySlug, series, riskFree } = artifacts;

  const candidates = valued.filter((p) => Number.isFinite(p.value) && p.instrument_type !== 'cash'
    && Array.isArray(series[p.slug]) && series[p.slug].length > 12);
  if (!candidates.length) {
    return { available: false, reason: 'no_positions_with_price_history', coverage: 0 };
  }

  // Dominant currency by value; anything else is excluded and named.
  const byCurrency = new Map();
  for (const p of candidates) {
    const a = analyticsBySlug.get(p.slug);
    const cur = a && a.currency;
    if (!cur) continue;
    byCurrency.set(cur, (byCurrency.get(cur) || 0) + p.value);
  }
  if (!byCurrency.size) return { available: false, reason: 'no_currency_information', coverage: 0 };
  const [dominantCurrency] = [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0];

  const included = candidates.filter((p) => {
    const a = analyticsBySlug.get(p.slug);
    return a && a.currency === dominantCurrency;
  });
  const excluded = candidates.filter((p) => !included.includes(p)).map((p) => p.symbol);
  if (!included.length) return { available: false, reason: 'no_same_currency_positions', coverage: 0 };

  // Align on the shortest shared history so every month is a real observation
  // for every holding, then build the weighted portfolio return series.
  const shortest = Math.min(...included.map((p) => series[p.slug].length));
  if (shortest < 13) {
    return { available: false, reason: 'insufficient_shared_history', coverage: 0, shared_months: shortest };
  }
  const includedValue = included.reduce((acc, p) => acc + p.value, 0);
  const returnSeries = included.map((p) => {
    const closes = series[p.slug].slice(-shortest);
    return { weight: p.value / includedValue, returns: m.dailyReturns(closes) };
  });

  const periods = returnSeries[0].returns.length;
  const portfolioReturns = [];
  for (let i = 0; i < periods; i += 1) {
    let r = 0;
    for (const s of returnSeries) r += s.weight * s.returns[i];
    portfolioReturns.push(r);
  }

  // Monthly observations — annualise by 12, not by the 252 used for dailies.
  const MONTHS = 12;
  const mean = m.mean(portfolioReturns);
  const sd = m.stdev(portfolioReturns);
  const volatility = Number.isFinite(sd) ? sd * Math.sqrt(MONTHS) : null;

  let sharpe = null;
  if (Number.isFinite(mean) && Number.isFinite(sd) && sd > 0 && riskFree && Number.isFinite(riskFree.rate)) {
    const rfPeriod = (1 + riskFree.rate) ** (1 / MONTHS) - 1;
    sharpe = ((mean - rfPeriod) / sd) * Math.sqrt(MONTHS);
  }

  // Reconstruct a value path to read the deepest peak-to-trough decline.
  const path = [1];
  for (const r of portfolioReturns) path.push(path[path.length - 1] * (1 + r));
  const drawdown = m.maxDrawdown(path);

  const coverage = includedValue / total;
  return {
    available: true,
    currency: dominantCurrency,
    volatility: round(volatility, 6),
    sharpe: round(sharpe, 2),
    max_drawdown: round(drawdown, 6),
    observations: portfolioReturns.length,
    frequency: 'monthly',
    coverage: round(coverage, 4),
    band: coverageBand(coverage),
    excluded_positions: excluded,
    excluded_reason: excluded.length ? 'quoted_in_a_different_currency' : null,
    risk_free_used: riskFree ? { rate: riskFree.rate, as_of: riskFree.as_of, symbol: riskFree.symbol } : null,
  };
}

/** Pairwise correlation between holdings, same-currency only. */
function correlationBlock(valued, artifacts) {
  const { analyticsBySlug, series } = artifacts;
  const eligible = valued.filter((p) => p.instrument_type !== 'cash' && Array.isArray(series[p.slug]) && series[p.slug].length > 12);
  const pairs = [];
  for (let i = 0; i < eligible.length; i += 1) {
    for (let j = i + 1; j < eligible.length; j += 1) {
      const a = eligible[i];
      const b = eligible[j];
      const ca = analyticsBySlug.get(a.slug);
      const cb = analyticsBySlug.get(b.slug);
      if (!ca || !cb || !ca.currency || ca.currency !== cb.currency) continue;
      const n = Math.min(series[a.slug].length, series[b.slug].length);
      if (n < 13) continue;
      const ra = m.dailyReturns(series[a.slug].slice(-n));
      const rb = m.dailyReturns(series[b.slug].slice(-n));
      const cov = m.covariance(ra, rb);
      const sa = m.stdev(ra);
      const sb = m.stdev(rb);
      if (cov === null || !sa || !sb) continue;
      pairs.push({
        a: a.symbol,
        b: b.symbol,
        correlation: round(Math.max(-1, Math.min(1, cov / (sa * sb))), 4),
        shared_months: n,
      });
    }
  }
  pairs.sort((x, y) => y.correlation - x.correlation);
  return { available: pairs.length > 0, pairs, note: 'same-currency pairs only' };
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/**
 * Analyse a portfolio.
 *
 * @param {Array}  positions  rows from portfolio_positions
 * @param {Object} artifacts  { factsBySlug, analyticsBySlug, scoreBySlug, similarityBySlug, series, riskFree }
 * @param {Object} options    { baseCurrency }
 */
function analysePortfolio(positions, artifacts, options = {}) {
  const baseCurrency = options.baseCurrency || 'USD';
  const rows = Array.isArray(positions) ? positions : [];

  if (!rows.length) {
    return {
      available: false,
      reason: 'empty_portfolio',
      base_currency: baseCurrency,
      position_count: 0,
      generated_at: new Date().toISOString(),
    };
  }

  const valued = rows.map((p) => {
    const v = valuePosition(p, artifacts);
    return { ...p, value: v.value, currency: v.currency || baseCurrency, basis: v.basis, as_of: v.as_of || null };
  });

  // A single total is only meaningful when every valued holding is expressed in
  // one currency. Otherwise per-currency subtotals are reported and the combined
  // figure is withheld rather than produced by adding unlike units.
  const priced = valued.filter((p) => Number.isFinite(p.value));
  const currencies = [...new Set(priced.map((p) => p.currency).filter(Boolean))];
  const singleCurrency = currencies.length <= 1;
  const total = priced.reduce((acc, p) => acc + p.value, 0);

  const perCurrency = {};
  for (const p of priced) perCurrency[p.currency] = round((perCurrency[p.currency] || 0) + p.value, 2);

  const allocation = singleCurrency ? allocationBlock(valued, total) : { available: false, reason: 'mixed_currency_holdings', positions: [] };
  const weights = allocation.available ? allocation.positions : [];

  const byType = groupWeights(weights, (p) => p.instrument_type);
  const byCategory = groupWeights(weights, (p) => {
    const facts = artifacts.factsBySlug.get(p.slug);
    return facts && facts.classification && facts.classification.category
      ? facts.classification.category.value
      : null;
  });

  const concentration = concentrationBlock(weights);
  const invested = rows.reduce((acc, p) => {
    const c = Number(p.contribution_amount);
    return Number.isFinite(c) ? acc + c : acc;
  }, 0);
  const investedKnown = rows.some((p) => Number.isFinite(Number(p.contribution_amount)));

  return {
    available: true,
    generated_at: new Date().toISOString(),
    base_currency: baseCurrency,
    position_count: rows.length,
    valued_position_count: priced.length,

    value: singleCurrency
      ? { available: Number.isFinite(total) && total > 0, total: round(total, 2), currency: currencies[0] || baseCurrency }
      : {
        available: false,
        reason: 'mixed_currency_holdings',
        per_currency: perCurrency,
        note_en: 'A single portfolio total is withheld because holdings are quoted in more than one currency and no verified exchange rate is available. Per-currency subtotals are shown instead.',
        note_ar: 'حُجب إجمالي واحد للمحفظة لأن المكوّنات مسعّرة بأكثر من عملة ولا يتوفر سعر صرف موثّق. وتُعرض بدلا من ذلك مجاميع فرعية لكل عملة.',
      },

    invested_capital: investedKnown
      ? { available: true, total: round(invested, 2), basis: 'holder_recorded_contributions' }
      : { available: false, reason: 'no_contribution_amounts_recorded' },

    allocation,
    allocation_by_instrument_type: byType,
    allocation_by_category: byCategory,
    category_basis: 'tradealphaai_classification',

    concentration,
    diversification: {
      label: diversificationLabel(concentration, byCategory.length),
      allowed_labels: DIVERSIFICATION_LABELS,
      distinct_categories: byCategory.length,
      basis: 'effective position count, top-position weight and category breadth',
    },

    cost: costBlock(valued, total, artifacts),
    score: scoreBlock(valued, total, artifacts),
    risk: riskBlock(valued, total, artifacts),
    correlation: correlationBlock(valued, artifacts),

    currency_exposure: {
      available: currencies.length > 0,
      currencies,
      per_currency: perCurrency,
      single_currency: singleCurrency,
    },

    valuation: {
      bases_used: [...new Set(valued.map((p) => p.basis))],
      unvalued_positions: valued.filter((p) => !Number.isFinite(p.value)).map((p) => p.symbol),
    },

    disclaimer_en: 'This is an educational interpretation of a portfolio a holder recorded themselves. It measures what the holdings are and how they have behaved. It is not investment advice, not a recommendation, and not an instruction to transact.',
    disclaimer_ar: 'هذا تفسير تعليمي لمحفظة سجّلها صاحبها بنفسه. وهو يقيس ما تحتويه المكوّنات وكيف تصرّفت. وليس نصيحة استثمارية ولا توصية ولا تعليمات لتنفيذ أي عملية.',
  };
}

module.exports = {
  analysePortfolio, valuePosition, allocationBlock, groupWeights,
  concentrationBlock, diversificationLabel, costBlock, scoreBlock,
  riskBlock, correlationBlock, coverageBand, latestClose,
  INSTRUMENT_TYPES, VALUATION, DIVERSIFICATION_LABELS, COVERAGE_BANDS,
};
