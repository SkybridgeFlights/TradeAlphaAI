'use strict';

// ETF Intelligence Center — pure metric math.
//
// Every function here is deterministic, side-effect free and operates only on
// observed price series. Nothing is estimated, proxied or filled in: when an
// input is too short or absent the function returns null and the caller records
// the metric as indeterminate rather than inventing a value.

const TRADING_DAYS = 252;

// Minimum observations before a statistic is meaningful. Below these the metric
// is reported as indeterminate instead of published at misleading precision.
const MIN_RETURN_OBS = 20;
const MIN_RISK_OBS = 60;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Strip null/NaN closes while preserving order. */
function cleanCloses(closes) {
  return (Array.isArray(closes) ? closes : []).filter((c) => isFiniteNumber(c) && c > 0);
}

/** Simple period-over-period returns from a close series. */
function dailyReturns(closes) {
  const series = cleanCloses(closes);
  const out = [];
  for (let i = 1; i < series.length; i += 1) {
    out.push(series[i] / series[i - 1] - 1);
  }
  return out;
}

function mean(values) {
  if (!Array.isArray(values) || !values.length) return null;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Sample standard deviation (n-1). */
function stdev(values) {
  if (!Array.isArray(values) || values.length < 2) return null;
  const mu = mean(values);
  if (mu === null) return null;
  let acc = 0;
  for (const v of values) acc += (v - mu) ** 2;
  return Math.sqrt(acc / (values.length - 1));
}

/** Total return across the whole series, as a decimal (0.12 = +12%). */
function cumulativeReturn(closes) {
  const series = cleanCloses(closes);
  if (series.length < 2) return null;
  return series[series.length - 1] / series[0] - 1;
}

/**
 * Compound annual growth rate. `years` is derived from the actual observation
 * window, not assumed, so partial windows never inflate the figure.
 */
function annualizedReturn(closes, years) {
  const total = cumulativeReturn(closes);
  if (total === null || !isFiniteNumber(years) || years <= 0) return null;
  // Sub-annual windows are reported as cumulative only — annualising two months
  // of data produces a headline number the data cannot support.
  if (years < 1) return null;
  return (1 + total) ** (1 / years) - 1;
}

/** Annualised standard deviation of daily returns. */
function volatility(returns) {
  if (!Array.isArray(returns) || returns.length < MIN_RISK_OBS) return null;
  const sd = stdev(returns);
  if (sd === null) return null;
  return sd * Math.sqrt(TRADING_DAYS);
}

/**
 * Sharpe ratio. `riskFreeAnnual` must be a real observed rate — callers pass the
 * ^IRX T-bill yield. When it is unavailable the caller records the metric as
 * indeterminate; this function will not silently substitute zero.
 */
function sharpe(returns, riskFreeAnnual) {
  if (!Array.isArray(returns) || returns.length < MIN_RISK_OBS) return null;
  if (!isFiniteNumber(riskFreeAnnual)) return null;
  const mu = mean(returns);
  const sd = stdev(returns);
  if (mu === null || sd === null || sd === 0) return null;
  const rfDaily = (1 + riskFreeAnnual) ** (1 / TRADING_DAYS) - 1;
  return ((mu - rfDaily) / sd) * Math.sqrt(TRADING_DAYS);
}

/** Sortino ratio — penalises downside deviation only. */
function sortino(returns, riskFreeAnnual) {
  if (!Array.isArray(returns) || returns.length < MIN_RISK_OBS) return null;
  if (!isFiniteNumber(riskFreeAnnual)) return null;
  const mu = mean(returns);
  if (mu === null) return null;
  const rfDaily = (1 + riskFreeAnnual) ** (1 / TRADING_DAYS) - 1;
  const downside = returns.filter((r) => r < rfDaily).map((r) => (r - rfDaily) ** 2);
  if (!downside.length) return null;
  const dd = Math.sqrt(downside.reduce((a, b) => a + b, 0) / downside.length);
  if (dd === 0) return null;
  return ((mu - rfDaily) / dd) * Math.sqrt(TRADING_DAYS);
}

/** Largest peak-to-trough decline, as a negative decimal. */
function maxDrawdown(closes) {
  const series = cleanCloses(closes);
  if (series.length < MIN_RETURN_OBS) return null;
  let peak = series[0];
  let worst = 0;
  for (const close of series) {
    if (close > peak) peak = close;
    const dd = close / peak - 1;
    if (dd < worst) worst = dd;
  }
  return worst;
}

/** Pair two return series to equal length, aligned at the most recent end. */
function alignTail(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return [[], []];
  const n = Math.min(a.length, b.length);
  if (n <= 0) return [[], []];
  return [a.slice(a.length - n), b.slice(b.length - n)];
}

function covariance(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const ma = mean(a);
  const mb = mean(b);
  if (ma === null || mb === null) return null;
  let acc = 0;
  for (let i = 0; i < a.length; i += 1) acc += (a[i] - ma) * (b[i] - mb);
  return acc / (a.length - 1);
}

/** Beta of an asset against a benchmark return series. */
function beta(assetReturns, benchReturns) {
  const [a, b] = alignTail(assetReturns, benchReturns);
  if (a.length < MIN_RISK_OBS) return null;
  const cov = covariance(a, b);
  const varB = stdev(b);
  if (cov === null || varB === null || varB === 0) return null;
  return cov / (varB ** 2);
}

/** Pearson correlation of two return series. */
function correlation(assetReturns, benchReturns) {
  const [a, b] = alignTail(assetReturns, benchReturns);
  if (a.length < MIN_RISK_OBS) return null;
  const cov = covariance(a, b);
  const sa = stdev(a);
  const sb = stdev(b);
  if (cov === null || sa === null || sb === null || sa === 0 || sb === 0) return null;
  const r = cov / (sa * sb);
  if (!isFiniteNumber(r)) return null;
  return Math.max(-1, Math.min(1, r));
}

/** Annualised standard deviation of the asset-minus-benchmark return spread. */
function trackingError(assetReturns, benchReturns) {
  const [a, b] = alignTail(assetReturns, benchReturns);
  if (a.length < MIN_RISK_OBS) return null;
  const diff = a.map((v, i) => v - b[i]);
  const sd = stdev(diff);
  if (sd === null) return null;
  return sd * Math.sqrt(TRADING_DAYS);
}

/**
 * Realised difference between fund and benchmark total return over the window.
 * This is tracking *difference* (a return gap), distinct from tracking error
 * (the volatility of that gap).
 */
function trackingDifference(assetCloses, benchCloses) {
  const a = cumulativeReturn(assetCloses);
  const b = cumulativeReturn(benchCloses);
  if (a === null || b === null) return null;
  return a - b;
}

/**
 * Projected cost of ownership from the published TER only. Deliberately does not
 * blend in spread or trading costs — those vary per broker and per trade, and
 * folding them into one figure would present an assumption as a fact.
 */
function projectedCost(investedAmount, terPct, years, grossAnnualReturn) {
  if (!isFiniteNumber(investedAmount) || investedAmount <= 0) return null;
  if (!isFiniteNumber(terPct) || terPct < 0) return null;
  if (!isFiniteNumber(years) || years <= 0) return null;
  const ter = terPct / 100;
  const growth = isFiniteNumber(grossAnnualReturn) ? grossAnnualReturn : 0;
  let gross = investedAmount;
  let net = investedAmount;
  for (let i = 0; i < years; i += 1) {
    gross *= (1 + growth);
    net = net * (1 + growth) * (1 - ter);
  }
  return {
    gross_value: gross,
    net_value: net,
    total_cost: gross - net,
    annual_cost_first_year: investedAmount * ter,
  };
}

/** Round to a fixed precision, preserving null. */
function round(value, digits) {
  if (!isFiniteNumber(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

module.exports = {
  TRADING_DAYS, MIN_RETURN_OBS, MIN_RISK_OBS,
  cleanCloses, dailyReturns, mean, stdev,
  cumulativeReturn, annualizedReturn,
  volatility, sharpe, sortino, maxDrawdown,
  alignTail, covariance, beta, correlation,
  trackingError, trackingDifference, projectedCost, round,
};
