'use strict';

// ETF Intelligence Center — computed performance and risk analytics.
//
// Everything here is DERIVED from observed daily price series. Nothing is
// curated, estimated or proxied. A metric whose inputs are too short or absent
// is emitted as null and rendered as indeterminate — never filled in.
//
// Performance and risk are produced by one builder on purpose: both read the
// same price snapshot, so a single network pass keeps them mutually consistent
// and halves the request count against the public endpoint.
//
// Usage: node tools/build-etf-analytics.js [--write]

const fs = require('fs');
const path = require('path');

const { UNIVERSE } = require('./etf-universe');
const ps = require('./etf-price-source');
const m = require('./etf-metrics');
const { hash } = require('./build-institutional-charts');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data/intelligence/etf-analytics.json');
// Monthly closes are the bulkiest part of the payload and only the similarity
// builder consumes them, so they are sharded into their own artifact. This keeps
// the analytics file readable and stops it growing without bound as the universe
// scales into the thousands.
const SERIES_OUT = path.join(ROOT, 'data/intelligence/etf-monthly-series.json');
const SCHEMA_VERSION = 2;

const HORIZONS = [1, 3, 5, 10];

/** Monthly closes (last observation per calendar month) — compact enough to ship. */
function monthlyCloses(rows) {
  const byMonth = new Map();
  for (const row of rows) byMonth.set(row.date.slice(0, 7), row.close);
  return [...byMonth.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, close]) => close);
}

function performanceFor(rows) {
  const cumulative = {};
  const annualized = {};
  for (const years of HORIZONS) {
    const window = ps.trailingWindow(rows, years);
    const closes = window ? window.map((r) => r.close) : null;
    cumulative[`${years}y`] = closes ? m.round(m.cumulativeReturn(closes), 6) : null;
    annualized[`${years}y`] = closes ? m.round(m.annualizedReturn(closes, years), 6) : null;
  }
  const allCloses = rows.map((r) => r.close);
  const spanYears = ps.windowYears(rows);
  cumulative.since_listing = m.round(m.cumulativeReturn(allCloses), 6);
  annualized.since_listing = spanYears ? m.round(m.annualizedReturn(allCloses, spanYears), 6) : null;
  return { cumulative, annualized, observed_years: m.round(spanYears, 2) };
}

/**
 * Relative return versus each benchmark over shared dates only.
 *
 * CURRENCY GUARD: a EUR-quoted fund measured against a USD-quoted benchmark
 * mixes the FX move into the return gap, which reads as out/under-performance
 * that never happened. Cross-currency pairs are therefore suppressed with a
 * stated reason instead of published. (An FX-adjusted comparison is a genuine
 * future enhancement; silently shipping the contaminated figure is not.)
 */
function relativeFor(rows, benchSeries, currency) {
  const out = {};
  for (const [key, bench] of Object.entries(benchSeries)) {
    if (!bench || !bench.ok) { out[key] = null; continue; }
    if (currency && bench.meta.currency && currency !== bench.meta.currency) {
      out[key] = { unavailable: 'currency_mismatch', fund_currency: currency, benchmark_currency: bench.meta.currency };
      continue;
    }
    const perHorizon = {};
    for (const years of HORIZONS) {
      const w = ps.trailingWindow(rows, years);
      const bw = ps.trailingWindow(bench.rows, years);
      if (!w || !bw) { perHorizon[`${years}y`] = null; continue; }
      const aligned = ps.alignByDate(w, bw);
      perHorizon[`${years}y`] = aligned.a.length >= m.MIN_RETURN_OBS
        ? m.round(m.trackingDifference(aligned.a, aligned.b), 6)
        : null;
    }
    out[key] = perHorizon;
  }
  return out;
}

/** Median of a numeric array, or null. */
function median(values) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Observed trading liquidity over the trailing year.
 *
 * Turnover multiplies volume by the adjusted close, so historical turnover is
 * approximate where distributions have been reinvested. Over a one-year window
 * the distortion is small and it is used only to rank relative liquidity, never
 * quoted as a precise currency amount.
 */
function liquidityFor(rows, currency) {
  const window = ps.trailingWindow(rows, 1) || rows;
  const volumes = window.map((r) => r.volume).filter((v) => Number.isFinite(v) && v > 0);
  if (volumes.length < 30) {
    return { median_daily_volume: null, median_daily_turnover: null, currency, observations: volumes.length };
  }
  const turnovers = window
    .filter((r) => Number.isFinite(r.volume) && r.volume > 0)
    .map((r) => r.volume * r.close);
  return {
    median_daily_volume: Math.round(median(volumes)),
    median_daily_turnover: Math.round(median(turnovers)),
    currency,
    observations: volumes.length,
  };
}

function riskFor(rows, benchSeries, riskFree, currency) {
  const closes = rows.map((r) => r.close);
  const returns = m.dailyReturns(closes);

  const w1 = ps.trailingWindow(rows, 1);
  const w3 = ps.trailingWindow(rows, 3);

  const rate = riskFree ? riskFree.rate : null;
  const worldRaw = benchSeries.world && benchSeries.world.ok ? benchSeries.world : null;
  // Same currency guard as relativeFor — a cross-currency beta measures the FX
  // pair as much as the fund, so it is withheld rather than reported.
  const comparable = worldRaw && (!currency || !worldRaw.meta.currency || currency === worldRaw.meta.currency);
  const world = comparable ? worldRaw : null;

  // Per-benchmark statistics. A fund must be measured against the index it
  // actually tracks: scoring a Nasdaq fund's tracking error against MSCI World
  // measures the difference between two indices, not the fund's tracking.
  const vsBenchmarks = {};
  for (const [key, bench] of Object.entries(benchSeries)) {
    if (!bench || !bench.ok) { vsBenchmarks[key] = null; continue; }
    if (currency && bench.meta.currency && currency !== bench.meta.currency) {
      vsBenchmarks[key] = { unavailable: 'currency_mismatch' };
      continue;
    }
    const aligned = ps.alignByDate(rows, bench.rows);
    if (aligned.a.length < m.MIN_RISK_OBS) {
      vsBenchmarks[key] = { unavailable: 'insufficient_shared_history' };
      continue;
    }
    const ra = m.dailyReturns(aligned.a);
    const rb = m.dailyReturns(aligned.b);
    vsBenchmarks[key] = {
      beta: m.round(m.beta(ra, rb), 4),
      tracking_error: m.round(m.trackingError(ra, rb), 6),
      correlation: m.round(m.correlation(ra, rb), 4),
      shared_observations: aligned.a.length,
    };
  }

  const worldStats = world && vsBenchmarks.world && !vsBenchmarks.world.unavailable ? vsBenchmarks.world : null;
  const betaWorld = worldStats ? worldStats.beta : null;
  const trackingErrorWorld = worldStats ? worldStats.tracking_error : null;
  const correlationWorld = worldStats ? worldStats.correlation : null;

  return {
    vs_benchmarks: vsBenchmarks,
    volatility_1y: w1 ? m.round(m.volatility(m.dailyReturns(w1.map((r) => r.close))), 6) : null,
    volatility_3y: w3 ? m.round(m.volatility(m.dailyReturns(w3.map((r) => r.close))), 6) : null,
    volatility_full: m.round(m.volatility(returns), 6),
    sharpe: rate === null ? null : m.round(m.sharpe(returns, rate), 4),
    sortino: rate === null ? null : m.round(m.sortino(returns, rate), 4),
    max_drawdown: m.round(m.maxDrawdown(closes), 6),
    beta_vs_world_proxy: betaWorld,
    tracking_error_vs_world_proxy: trackingErrorWorld,
    correlation_vs_world_proxy: correlationWorld,
    benchmark_comparability: comparable
      ? 'same_currency'
      : `suppressed_currency_mismatch:${currency || 'unknown'}_vs_${worldRaw ? worldRaw.meta.currency : 'unknown'}`,
  };
}

/**
 * Evidence lines. check-etf-rankings.js requires >=2 evidence items per record
 * and the ETF Center validator enforces the same floor — every published number
 * must be traceable to an observation count and a window.
 */
function evidenceFor(entry, rows, riskFree) {
  const lines = [
    `${rows.length} observed daily closes ${rows[0].date}..${rows[rows.length - 1].date} from Yahoo public chart endpoint`,
    `return basis: ${entry.return_basis} (${entry.return_basis === 'total_return' ? 'distributions reinvested' : 'price only — distributions not reflected'})`,
  ];
  if (riskFree) {
    lines.push(`risk-free input ${(riskFree.rate * 100).toFixed(2)}% from ${riskFree.symbol} as of ${riskFree.as_of}`);
  } else {
    lines.push('risk-free rate unavailable — Sharpe and Sortino suppressed');
  }
  return lines;
}

async function build(options = {}) {
  ps.pruneCache();
  const riskFree = await ps.fetchRiskFreeRate();

  const benchSeries = {};
  for (const [key, bench] of Object.entries(ps.BENCHMARKS)) {
    benchSeries[key] = await ps.fetchDailySeries(bench.symbol, '10y');
  }

  // Bounded concurrency + the same-day response cache keep this stage viable as
  // the universe grows; a resumed run costs nothing for symbols already fetched.
  const fetched = await ps.mapWithConcurrency(
    UNIVERSE,
    (entry) => ps.fetchDailySeries(entry.yahoo_symbol, '10y'),
    options.concurrency || ps.DEFAULT_CONCURRENCY,
  );

  const etfs = [];
  const monthly = {};
  for (let index = 0; index < UNIVERSE.length; index += 1) {
    const entry = UNIVERSE[index];
    const series = fetched[index];

    if (!series || !series.ok || series.rows.length < m.MIN_RISK_OBS) {
      etfs.push({
        slug: entry.slug,
        symbol: entry.symbol,
        available: false,
        reason: series && series.ok ? `insufficient history (${series.rows.length} bars)` : (series ? series.reason : 'fetch failed'),
        evidence: ['proxy substitution suppressed — no synthetic series generated'],
      });
      continue;
    }

    const rows = series.rows;
    monthly[entry.slug] = monthlyCloses(rows).map((c) => m.round(c, 4));
    etfs.push({
      slug: entry.slug,
      symbol: entry.symbol,
      yahoo_symbol: entry.yahoo_symbol,
      available: true,
      return_basis: series.return_basis,
      currency: series.meta.currency,
      exchange: series.meta.exchange_name,
      bars: rows.length,
      first_observation: rows[0].date,
      last_observation: rows[rows.length - 1].date,
      performance: performanceFor(rows),
      relative: relativeFor(rows, benchSeries, series.meta.currency),
      risk: riskFor(rows, benchSeries, riskFree, series.meta.currency),
      liquidity: liquidityFor(rows, series.meta.currency),
      evidence: evidenceFor({ return_basis: series.return_basis }, rows, riskFree),
      source: series.source,
    });
  }

  const available = etfs.filter((e) => e.available).length;
  const artifact = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_layer: 'computed_from_observed_prices',
    method: {
      note_en: 'All performance and risk figures are computed by TradeAlphaAI from observed daily closing prices. They are historical measurements, not projections.',
      note_ar: 'تُحتسب جميع أرقام الأداء والمخاطر في TradeAlphaAI من أسعار الإغلاق اليومية المرصودة. وهي قياسات تاريخية وليست توقعات.',
      currency_note_en: 'Returns are stated in each fund\'s own trading currency. Benchmark-relative figures, beta and tracking error are shown only where the fund and the benchmark share a currency, because a cross-currency comparison would measure the exchange rate as well as the fund.',
      currency_note_ar: 'تُعرض العوائد بعملة تداول كل صندوق. أما الأرقام النسبية مقابل المؤشر ومعامل بيتا وخطأ التتبع فتظهر فقط عند تطابق عملة الصندوق مع عملة المؤشر، لأن المقارنة بين عملتين مختلفتين تقيس سعر الصرف إلى جانب الصندوق.',
      trading_days: m.TRADING_DAYS,
      min_risk_observations: m.MIN_RISK_OBS,
      benchmarks: ps.BENCHMARKS,
    },
    risk_free: riskFree,
    coverage: { total: UNIVERSE.length, available, unavailable: UNIVERSE.length - available },
    etfs,
    attribution: {
      sources: [
        { provider: 'Yahoo', source_url: ps.SOURCE_URL, role: 'daily OHLCV price series' },
        { provider: 'Yahoo', source_url: ps.SOURCE_URL, role: `risk-free rate proxy ${ps.RISK_FREE_SYMBOL}` },
      ],
      computed_by: 'tools/build-etf-analytics.js',
    },
  };
  // Hash covers the computed payload only — generated_at and fetch timestamps are
  // excluded so a rerun on unchanged data is provably identical.
  artifact.source_hash = hash(JSON.stringify(etfs.map((e) => ({ ...e, source: undefined }))));
  return { artifact, monthly };
}

async function main() {
  const { artifact, monthly } = await build();
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    fs.writeFileSync(SERIES_OUT, `${JSON.stringify({
      schema_version: SCHEMA_VERSION,
      generated_at: artifact.generated_at,
      note: 'Monthly closing prices per fund, sharded out of etf-analytics.json. Consumed by the similarity builder only.',
      series: monthly,
    }, null, 2)}\n`, 'utf8');
    console.log(`[etf-analytics] wrote ${path.relative(ROOT, OUT)} (${artifact.coverage.available}/${artifact.coverage.total} available) + ${path.relative(ROOT, SERIES_OUT)}`);
  } else {
    console.log(`[etf-analytics] dry run — ${artifact.coverage.available}/${artifact.coverage.total} available, hash ${artifact.source_hash.slice(0, 12)}`);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[etf-analytics] FAILED: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { build, performanceFor, relativeFor, riskFor, liquidityFor, monthlyCloses, median, HORIZONS, SERIES_OUT };
