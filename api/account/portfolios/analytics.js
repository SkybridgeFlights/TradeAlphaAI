'use strict';

// Phase 228 CP2 — computed portfolio analytics.
//
// GET /api/account/portfolios/analytics?portfolio_slug=x
//
// Reads the holder's stored positions and runs them through the CP5 engine,
// which is pure: the same positions and the same artifacts always produce the
// same result, whether the caller is this route, the build tooling or the
// validator.
//
// Nothing is computed here. This route resolves ownership, loads the artifacts,
// and hands both to the engine — so there is exactly one implementation of
// every figure, and no chance of an API-only number that no validator covers.
//
// The engine withholds rather than estimates: an absent expense ratio is not
// zero, a total is not produced across currencies it cannot convert, and every
// block reports the share of the portfolio it actually describes. Those fields
// are passed through untouched.
//
// This is measurement, not advice. Nothing in the response ranks a holding,
// suggests a change, or evaluates whether a portfolio is good.

const { getSql } = require('../../../db/client');
const { requireAccount, sendError } = require('../../../db/auth');
const { ensureAccountSchema } = require('../../../db/schema');
const { ensureAccount } = require('../../../db/account');
const { requireOwnedPortfolio, listPositions, listTargets } = require('../../../db/portfolios');
const { loadArtifacts } = require('../../../tools/portfolio-artifacts');
const { analysePortfolio } = require('../../../tools/portfolio-analytics');

const json = (res, status, payload) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
};

/**
 * Drift between a holder's stated targets and their current weights.
 *
 * Reported only for symbols that appear in both: a target with no position is
 * not "100% underweight", and a position with no target is not drift. Both are
 * listed separately so the gap is visible without being turned into a number
 * that implies an action.
 */
function targetDrift(targets, allocation) {
  if (!targets.length || !allocation || !allocation.available) {
    return { available: false, reason: targets.length ? 'allocation_unavailable' : 'no_targets_set' };
  }
  // Allocation weights are fractions; targets are stored as percent.
  const pct = (weight) => Math.round(weight * 100 * 10000) / 10000;
  const actual = new Map(allocation.positions.map((p) => [p.symbol, pct(p.weight)]));
  const compared = [];
  const targetsWithoutPosition = [];
  for (const t of targets) {
    const current = actual.get(t.symbol);
    const target = Number(t.target_weight);
    if (current === undefined) { targetsWithoutPosition.push({ symbol: t.symbol, target_weight: target }); continue; }
    compared.push({
      symbol: t.symbol,
      target_weight: Math.round(target * 10000) / 10000,
      current_weight: current,
      difference: Math.round((current - target) * 10000) / 10000,
    });
  }
  const targeted = new Set(targets.map((t) => t.symbol));
  const positionsWithoutTarget = allocation.positions
    .filter((p) => !targeted.has(p.symbol))
    .map((p) => ({ symbol: p.symbol, current_weight: pct(p.weight) }));

  const stated = targets.reduce((acc, t) => acc + Number(t.target_weight), 0);
  return {
    available: true,
    // Drift is measured against the total the holder actually stated, not an
    // assumed 100: targets may deliberately cover only part of a portfolio.
    stated_total_weight: Math.round(stated * 10000) / 10000,
    covers_whole_portfolio: Math.abs(stated - 100) < 0.0001,
    compared,
    targets_without_position: targetsWithoutPosition,
    positions_without_target: positionsWithoutTarget,
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.statusCode = 405; res.end(); return; }
  try {
    const { accountId } = await requireAccount(req);
    const sql = getSql();
    await ensureAccountSchema(sql);
    await ensureAccount(sql, accountId);

    const url = new URL(req.url, 'http://localhost');
    const portfolioSlug = (url.searchParams.get('portfolio_slug') || '').trim().toLowerCase();
    if (!portfolioSlug) { json(res, 400, { error: 'portfolio_slug query param required' }); return; }

    const portfolio = await requireOwnedPortfolio(sql, accountId, portfolioSlug);
    const [positions, targets] = await Promise.all([
      listPositions(sql, portfolio.id),
      listTargets(sql, portfolio.id),
    ]);

    const artifacts = loadArtifacts();
    const analytics = analysePortfolio(positions, artifacts, { baseCurrency: portfolio.base_currency });

    json(res, 200, {
      portfolio: {
        slug: portfolio.slug,
        name: portfolio.name,
        base_currency: portfolio.base_currency,
        portfolio_type: portfolio.portfolio_type,
      },
      analytics,
      targets: targetDrift(targets, analytics && analytics.allocation),
      artifacts_generated_at: artifacts.generated_at || null,
      basis: 'Computed from the positions you recorded and the platform\'s published ETF data. Figures are withheld where the underlying data is incomplete rather than estimated. This is a measurement of what you hold, not investment advice.',
    });
  } catch (err) {
    sendError(res, err);
  }
};
