'use strict';

const fs = require('fs');
const path = require('path');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');

const ROOT = path.resolve(__dirname, '..');

function buildCrossAssetReaction(event = {}, market = readJson('data/live-market-state.json', {})) {
  const surprise = analyzeEconomicSurprise(event);
  const live = market.metadata?.status === 'live';
  const reactions = live ? observedReactions(market) : {};
  const chains = transmissionChains(event, surprise);
  return {
    generated_at: new Date().toISOString(),
    event_id: event.id || null,
    data_status: live ? 'observed' : 'scenario_only',
    surprise,
    observed_reactions: reactions,
    transmission_chains: chains,
    correlation_shifts: inferCorrelationShifts(reactions),
    risk_transition: inferRiskTransition(reactions),
    commentary: buildCommentary(event, surprise, reactions, live)
  };
}

function transmissionChains(event, surprise) {
  const tone = surprise.policy_tone;
  if (tone === 'hawkish_impulse') return [
    'Upside policy-sensitive surprise -> rate-cut expectations reprice lower -> Treasury yields may rise -> DXY may firm -> TLT and long-duration QQQ become more rate-sensitive.',
    'Higher real-yield pressure -> gold opportunity cost increases -> GLD may weaken unless hedge demand offsets the rate channel.',
    'Tighter financial conditions -> small-cap financing sensitivity rises -> IWM may lag SPY while defensive sectors gain relative attention.'
  ];
  if (tone === 'dovish_impulse') return [
    'Downside policy-sensitive surprise -> restrictive-rate expectations may ease -> Treasury yields may fall -> TLT and duration-sensitive QQQ can stabilize.',
    'Lower real-yield pressure -> DXY may soften -> gold can strengthen if the move is not dominated by recession stress.',
    'Easier rate expectations -> liquidity sensitivity improves -> semiconductors and growth may participate, with IWM confirmation needed for broad risk-on validation.'
  ];
  return [
    'Near-consensus outcome -> attention shifts to revisions and composition -> yields and DXY determine whether the release changes the policy path.',
    'Muted headline surprise -> positioning and liquidity drive the first move -> SPY, QQQ, IWM, and VIX confirmation determines whether it persists.'
  ];
}

function observedReactions(market) {
  const map = {
    Gold: market.gold, DXY: market.dxy, 'Treasury yields': market.us10y_yield,
    SPY: market.sp500, QQQ: market.nasdaq, IWM: market.russell2000,
    TLT: market.tlt, VIX: market.vix, Semiconductors: market.nvda
  };
  return Object.fromEntries(Object.entries(map).map(([asset, item]) => [asset, {
    value: item?.value ?? null,
    change_pct: item?.change_pct ?? null,
    source_url: item?.source_url ?? null
  }]));
}

function inferCorrelationShifts(reactions) {
  const gold = reactions.Gold?.change_pct;
  const dxy = reactions.DXY?.change_pct;
  const yields = reactions['Treasury yields']?.change_pct;
  const qqq = reactions.QQQ?.change_pct;
  const shifts = [];
  if ([gold, dxy].every(Number.isFinite) && gold > 0 && dxy > 0) shifts.push('Gold and dollar strength are moving together, suggesting hedge demand is overriding the usual inverse relationship.');
  if ([yields, qqq].every(Number.isFinite) && yields > 0 && qqq > 0) shifts.push('Yields and growth equities are rising together, indicating earnings or liquidity support is offsetting duration pressure.');
  return shifts.length ? shifts : ['No verified correlation shift can be established from the available reaction set.'];
}

function inferRiskTransition(reactions) {
  const spy = reactions.SPY?.change_pct;
  const iwm = reactions.IWM?.change_pct;
  const vix = reactions.VIX?.change_pct;
  if (![spy, iwm, vix].every(Number.isFinite)) return 'unverified';
  if (spy > 0 && iwm > spy && vix < 0) return 'broadening_risk_on';
  if (spy < 0 && vix > 0) return 'risk_off';
  return 'selective_or_mixed';
}

function buildCommentary(event, surprise, reactions, live) {
  const name = event.event_name || event.name || 'The macro event';
  if (!live) return `${name} is evaluated through conditional transmission chains because verified post-event market reactions are not available. ${surprise.reaction_interpretation}`;
  return `${name} produced a ${surprise.surprise_direction.replace(/_/g, ' ')} result. The interpretation is based on whether yields, DXY, gold, equity breadth, and volatility confirm the expected policy transmission rather than assuming a deterministic asset response.`;
}

function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

if (require.main === module) {
  const calendar = readJson('data/economic-calendar.json', { events: [] });
  const event = calendar.events.find((item) => item.actual !== null) || calendar.events[0] || {};
  const result = buildCrossAssetReaction(event);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(path.join(ROOT, 'data', 'cross-asset-reaction.json'), JSON.stringify(result, null, 2) + '\n', 'utf8');
    console.log('Updated data/cross-asset-reaction.json');
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = { buildCrossAssetReaction };
