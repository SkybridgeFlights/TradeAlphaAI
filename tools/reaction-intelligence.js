'use strict';

// Phase 105 — Live Macro Reaction Intelligence engine (pure, deterministic).
//
// Interprets how markets ACTUALLY reacted to a macro release by comparing
// observed cross-asset moves (captured by record-event-reactions / live state)
// to the expected institutional transmission (the Phase 101 cross_asset template
// oriented by the resolved surprise). It does NOT fetch data, does NOT fabricate,
// and degrades to 'awaiting_data' when observed moves are unavailable. It is not
// a signal engine — no buy/sell, no prediction, only reaction interpretation.

const TRACKED = ['DXY', 'US10Y', 'US02Y', 'GOLD', 'SPY', 'QQQ', 'VIX', 'OIL', 'EURUSD', 'USDJPY'];
const WINDOWS = ['pre', '+1m', '+5m', '+15m', '+1h', '+4h', 'eod'];

const CLASSIFICATIONS = [
  'confirmed_reaction', 'partial_confirmation', 'fading_reaction', 'rejected_reaction',
  'divergence', 'volatility_without_direction', 'delayed_confirmation',
  'cross_asset_disagreement', 'hawkish_repricing', 'dovish_repricing',
  'liquidity_stress', 'growth_relief', 'awaiting_data',
];
const CONVICTION = ['low', 'moderate', 'strong', 'unstable', 'crowded_positioning', 'fragile_continuation', 'none'];

function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
function num(x) { return typeof x === 'number' && Number.isFinite(x) ? x : null; }

// expected: { ASSET: '+'|'-'|'0' } (oriented transmission for this surprise)
// observed: { ASSET: { '+1m':pct, '+5m':pct, '+15m':pct, '+1h':pct, ... } }
// Returns the per-asset confirmation matrix at the primary window.
function buildMatrix(expected, observed, primary) {
  const rows = [];
  for (const asset of TRACKED) {
    const exp = expected[asset];
    const obs = observed && observed[asset] ? observed[asset] : null;
    const pct = obs ? num(obs[primary]) : null;
    if (!exp || exp === '0' || pct === null) {
      rows.push({ asset, expected: exp || null, observed_pct: pct, confirms: null });
      continue;
    }
    const expSign = exp === '+' ? 1 : -1;
    rows.push({ asset, expected: exp, observed_pct: pct, confirms: sign(pct) === expSign });
  }
  return rows;
}

// Persistence: did the aligned direction at +5m hold (or strengthen) into +1h?
function persistence(observed, expected) {
  let held = 0, faded = 0, total = 0;
  for (const asset of TRACKED) {
    const exp = expected[asset];
    const o = observed && observed[asset];
    if (!exp || exp === '0' || !o) continue;
    const early = num(o['+5m']); const late = num(o['+1h']);
    if (early === null || late === null) continue;
    const expSign = exp === '+' ? 1 : -1;
    if (sign(early) !== expSign) continue; // only judge persistence on initially-aligned assets
    total += 1;
    if (Math.abs(late) >= Math.abs(early) * 0.6 && sign(late) === expSign) held += 1; else faded += 1;
  }
  return { held, faded, total, ratio: total ? held / total : null };
}

function vixExpansion(observed, primary) {
  const v = observed && observed.VIX ? num(observed.VIX[primary]) : null;
  return v === null ? null : v > 3; // >3% VIX move = expansion
}

// Classify the reaction. category guides the policy-tone secondary tag.
function classify({ expected, observed, surprise, category, primary = '+15m' }) {
  if (!observed || !Object.keys(observed).length) {
    return { classification: 'awaiting_data', secondary: [], alignment_ratio: null, matrix: buildMatrix(expected, observed || {}, primary) };
  }
  const matrix = buildMatrix(expected, observed, primary);
  const comparable = matrix.filter((r) => r.confirms !== null);
  if (!comparable.length) {
    return { classification: 'awaiting_data', secondary: [], alignment_ratio: null, matrix };
  }
  const aligned = comparable.filter((r) => r.confirms).length;
  const ratio = aligned / comparable.length;
  const pers = persistence(observed, expected);
  const vixExp = vixExpansion(observed, primary);

  // Magnitude: are moves material at all?
  const maxAbs = Math.max(...comparable.map((r) => Math.abs(r.observed_pct || 0)));
  const material = maxAbs >= 0.1; // 0.1% minimum to count as a move

  let classification;
  const secondary = [];

  if (!material && vixExp) classification = 'volatility_without_direction';
  else if (ratio >= 0.75 && pers.ratio !== null && pers.ratio >= 0.6) classification = 'confirmed_reaction';
  else if (ratio >= 0.75 && pers.ratio !== null && pers.ratio < 0.6) classification = 'fading_reaction';
  else if (ratio >= 0.5) classification = 'partial_confirmation';
  else if (ratio === 0) classification = 'rejected_reaction';
  else {
    // mixed: distinguish cross-asset disagreement from outright divergence
    const conflicting = comparable.some((r) => r.confirms) && comparable.some((r) => !r.confirms);
    classification = conflicting ? 'cross_asset_disagreement' : 'divergence';
  }

  // Delayed confirmation: weak at +5m but aligned by +1h.
  if ((classification === 'partial_confirmation' || classification === 'divergence') && pers.ratio !== null) {
    const early = buildMatrix(expected, observed, '+5m').filter((r) => r.confirms !== null);
    const earlyAligned = early.length ? early.filter((r) => r.confirms).length / early.length : 0;
    if (earlyAligned < 0.5 && ratio >= 0.5) classification = 'delayed_confirmation';
  }

  // Policy-tone / regime secondary tags (deterministic, evidence-based).
  const confirmedish = ['confirmed_reaction', 'partial_confirmation', 'delayed_confirmation'].includes(classification);
  const dir = surprise && surprise.surprise_direction;
  if (confirmedish && (category === 'inflation' || category === 'policy')) {
    secondary.push(dir === 'hotter_or_stronger' ? 'hawkish_repricing' : dir === 'softer_or_weaker' ? 'dovish_repricing' : null);
  }
  if (confirmedish && category === 'labor' && dir === 'softer_or_weaker') secondary.push('growth_relief');
  // Liquidity stress: yields up + equities down + VIX expansion together.
  const y = observed.US10Y ? num(observed.US10Y[primary]) : null;
  const spy = observed.SPY ? num(observed.SPY[primary]) : null;
  if (y !== null && spy !== null && y > 0 && spy < -0.3 && vixExp) secondary.push('liquidity_stress');

  return { classification, secondary: secondary.filter(Boolean), alignment_ratio: Number(ratio.toFixed(2)), persistence: pers, vix_expansion: vixExp, matrix };
}

// Conviction: institutional reaction quality from breadth + persistence +
// cross-asset alignment + volatility structure + reversal intensity.
function conviction(result) {
  if (result.classification === 'awaiting_data' || result.alignment_ratio === null) return { level: 'none', score: null, basis: 'no observed reaction data' };
  const ratio = result.alignment_ratio;
  const pers = result.persistence || { ratio: null };
  let score = Math.round(ratio * 60 + (pers.ratio !== null ? pers.ratio * 40 : 0));
  let level;
  if (result.classification === 'fading_reaction') level = (pers.ratio !== null && pers.ratio < 0.3) ? 'crowded_positioning' : 'fragile_continuation';
  else if (result.classification === 'rejected_reaction') level = 'unstable';
  else if (result.classification === 'volatility_without_direction') level = 'unstable';
  else if (score >= 75) level = 'strong';
  else if (score >= 50) level = 'moderate';
  else level = 'low';
  return { level, score, basis: `breadth ${ratio}, persistence ${pers.ratio !== null ? pers.ratio.toFixed(2) : 'n/a'}` };
}

// Deterministic institutional narrative (EN). No hype, no advice.
function narrate(event, result, conv) {
  const name = event.event || event.event_name || 'The release';
  if (result.classification === 'awaiting_data') {
    return `${name}: reaction data not yet available; cross-asset confirmation pending observed market moves.`;
  }
  const dirWord = (event.surprise && event.surprise.surprise_label) ? String(event.surprise.surprise_label).replace(/__proxy_based$/, '').replace(/_/g, ' ') : 'the surprise';
  const map = {
    confirmed_reaction: `Markets largely confirmed ${dirWord} from ${name}, with cross-asset moves aligning to the expected transmission and the direction persisting.`,
    partial_confirmation: `${name} produced partial cross-asset confirmation of ${dirWord}; alignment was incomplete across the tracked assets.`,
    delayed_confirmation: `Confirmation of ${dirWord} from ${name} built only after the initial window, strengthening into later trading.`,
    fading_reaction: `The initial reaction to ${name} aligned with ${dirWord} but faded as the move lost persistence during the session.`,
    rejected_reaction: `Markets did not confirm ${dirWord} from ${name}; observed cross-asset moves ran counter to the expected transmission.`,
    divergence: `${name} produced a divergent reaction that did not coherently track ${dirWord} across assets.`,
    cross_asset_disagreement: `Cross-asset signals disagreed after ${name}: some assets tracked ${dirWord} while others moved against it.`,
    volatility_without_direction: `${name} expanded volatility without a clear directional resolution across the tracked assets.`,
  };
  let s = map[result.classification] || `${name}: reaction classified as ${result.classification.replace(/_/g, ' ')}.`;
  if (conv && conv.level && conv.level !== 'none') s += ` Reaction conviction: ${conv.level.replace(/_/g, ' ')}.`;
  return s;
}

module.exports = { TRACKED, WINDOWS, CLASSIFICATIONS, CONVICTION, buildMatrix, persistence, classify, conviction, narrate, sign };
