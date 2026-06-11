'use strict';

// Phase 71 — Market Pulse Engine.
// Persistent newsroom pulse layer: derives session-level institutional state
// (risk posture, volatility regime, dollar/duration pressure, AI concentration,
// breadth, defensive rotation) from sourced inputs only, then composes concise
// desk commentary for newsroom banners, generator context, and Telegram.
// Anything underivable stays "unverified" and is excluded from commentary —
// the pulse never asserts unsourced market behavior.
//
// Output: data/intelligence/market-pulse.json
//         data/feeds/newsroom-pulse.json   (homepage module foundation feed)
// Usage:  node tools/build-market-pulse.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PULSE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-pulse.json');
const FEED_PATH = path.join(ROOT, 'data', 'feeds', 'newsroom-pulse.json');
const LIVE_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const NARRATIVE_STATE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-narrative-state.json');
const WIRE_PATH = path.join(ROOT, 'data', 'newswire', 'wire-events.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const OUTLOOK_FEED_PATH = path.join(ROOT, 'data', 'feeds', 'latest-market-outlooks.json');

function readJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function num(node) {
  if (!node || typeof node !== 'object') return null;
  return Number.isFinite(node.value) ? node.value : null;
}

function pct(node) {
  if (!node || typeof node !== 'object') return null;
  return Number.isFinite(node.change_pct) ? node.change_pct : null;
}

function derivePulse() {
  const live = readJson(LIVE_PATH, {});
  const narrative = readJson(NARRATIVE_STATE_PATH, {});
  const liveOk = live.metadata && ['live', 'partial'].includes(live.metadata.status);
  const regimes = narrative.regimes || {};

  const vix = liveOk ? num(live.vix) : null;
  const dxyMove = liveOk ? pct(live.dxy) : null;
  const yieldLevel = liveOk ? num(live.us10y_yield) : null;
  const spyMove = liveOk ? pct(live.sp500) : null;
  const qqqMove = liveOk ? pct(live.nasdaq) : null;
  const iwmMove = liveOk ? pct(live.russell2000) : null;
  const nvdaMove = liveOk ? pct(live.nvda) : null;

  const dimensions = {
    risk_state: regimes.risk_appetite || (live.computed_regime && live.computed_regime.risk_state) || 'unverified',
    volatility_regime: vix === null ? (regimes.volatility_state || 'unverified')
      : vix < 14 ? 'compressed' : vix < 20 ? 'normal' : vix < 28 ? 'elevated' : 'stressed',
    dollar_pressure: dxyMove === null ? (regimes.dollar_trend || 'unverified')
      : dxyMove > 0.3 ? 'firming' : dxyMove < -0.3 ? 'easing' : 'stable',
    duration_pressure: regimes.yield_trend && regimes.yield_trend !== 'unverified'
      ? (regimes.yield_trend === 'rising' ? 'building' : regimes.yield_trend === 'falling' ? 'relaxing' : 'neutral')
      : 'unverified',
    momentum_concentration: (qqqMove !== null && iwmMove !== null)
      ? (qqqMove - iwmMove > 0.8 ? 'narrow-megacap' : iwmMove - qqqMove > 0.8 ? 'broadening' : 'balanced')
      : 'unverified',
    ai_concentration_risk: (nvdaMove !== null && spyMove !== null)
      ? (Math.abs(nvdaMove) > Math.abs(spyMove) * 2.5 ? 'elevated' : 'contained')
      : (regimes.ai_speculation_cycle || 'unverified'),
    breadth_state: (spyMove !== null && iwmMove !== null)
      ? (spyMove > 0 && iwmMove < 0 ? 'deteriorating' : spyMove > 0 && iwmMove > 0 ? 'confirming' : 'mixed')
      : 'unverified',
    defensive_rotation: regimes.liquidity === 'tightening' ? 'active' : regimes.liquidity === 'supportive' ? 'dormant' : 'unverified',
    liquidity_stress: regimes.liquidity || 'unverified',
    speculative_appetite: (nvdaMove !== null && nvdaMove > 2) || (liveOk && pct(live.bitcoin) !== null && pct(live.bitcoin) > 3)
      ? 'expanding' : 'unverified',
    market_fragility: 'unverified',
    sourced: {
      vix, dxy_move: dxyMove, us10y: yieldLevel, spy_move: spyMove,
      qqq_move: qqqMove, iwm_move: iwmMove, nvda_move: nvdaMove,
      live_status: (live.metadata && live.metadata.status) || 'unavailable',
    },
  };

  // Market fragility: composite of verified stress signals only.
  const fragilitySignals = [
    dimensions.volatility_regime === 'stressed' || dimensions.volatility_regime === 'elevated',
    dimensions.breadth_state === 'deteriorating',
    dimensions.momentum_concentration === 'narrow-megacap',
    dimensions.ai_concentration_risk === 'elevated',
  ];
  const verifiedInputs = [dimensions.volatility_regime, dimensions.breadth_state, dimensions.momentum_concentration, dimensions.ai_concentration_risk]
    .filter((v) => v !== 'unverified').length;
  if (verifiedInputs >= 2) {
    const hits = fragilitySignals.filter(Boolean).length;
    dimensions.market_fragility = hits >= 3 ? 'elevated' : hits >= 1 ? 'building' : 'contained';
  }
  return dimensions;
}

// Desk commentary composed only from verified dimensions.
function composeCommentary(d) {
  const lines = [];
  if (d.momentum_concentration === 'narrow-megacap' && d.breadth_state === 'deteriorating') {
    lines.push('Markets remain narrowly driven by megacap leadership while breadth deteriorates beneath the surface.');
  } else if (d.breadth_state === 'confirming') {
    lines.push('Participation is broadening — the advance is being confirmed beyond the megacap complex.');
  }
  if (d.volatility_regime === 'compressed') {
    lines.push('Volatility compression is storing energy rather than signaling calm; hedging demand is cheap and thinning.');
  } else if (d.volatility_regime === 'stressed') {
    lines.push('Volatility is in a stress regime — liquidity, not direction, is the session variable that matters.');
  }
  if (d.duration_pressure === 'building') {
    lines.push('Duration pressure is building as yields climb, tightening valuation tolerance across long-duration assets.');
  } else if (d.duration_pressure === 'relaxing') {
    lines.push('The market is rewarding duration risk again as yield pressure relaxes.');
  }
  if (d.dollar_pressure === 'firming') {
    lines.push('A firming dollar is draining global risk appetite at the margin.');
  }
  if (d.ai_concentration_risk === 'elevated') {
    lines.push('AI leadership concentration is running hot relative to the broad tape — a crowding tell worth respecting.');
  }
  if (!lines.length) {
    return {
      lines: ['Regime inputs are mixed or unverified this session; the desk treats the tape as a positioning market until data resolves it.'],
      verified: false,
    };
  }
  return { lines: lines.slice(0, 3), verified: true };
}

function buildPulse() {
  const dimensions = derivePulse();
  const { lines: commentary, verified } = composeCommentary(dimensions);
  const wire = readJson(WIRE_PATH, { items: [], top_story: null });
  const calendar = readJson(CALENDAR_PATH, { events: [] });
  const today = new Date().toISOString().slice(0, 10);

  const catalystsToday = (calendar.events || [])
    .filter((e) => e.date >= today && ['high'].includes(String(e.importance || e.impact_level).toLowerCase()))
    .sort((a, b) => String(a.event_time || a.date).localeCompare(String(b.event_time || b.date)))
    .slice(0, 5)
    .map((e) => ({ name: e.event_name || e.name, time: e.event_time || e.date, assets: e.historical_asset_sensitivity || [] }));

  const pulse = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    verified,
    dimensions,
    pulse_banner: commentary[0],
    desk_commentary: commentary,
    session_framing: `Session framing — risk: ${dimensions.risk_state}; vol: ${dimensions.volatility_regime}; dollar: ${dimensions.dollar_pressure}; duration: ${dimensions.duration_pressure}; breadth: ${dimensions.breadth_state}.`,
    catalysts_today: catalystsToday,
    wire_top_story: wire.top_story ? { headline: wire.top_story.headline, urgency: wire.top_story.urgency, cluster: wire.top_story.cluster } : null,
  };
  return pulse;
}

function buildNewsroomFeed(pulse) {
  const outlooks = readJson(OUTLOOK_FEED_PATH, { articles: [], items: [] });
  const latest = (outlooks.articles || outlooks.items || [])[0] || null;
  return {
    version: '1.0',
    updated_at: pulse.updated_at,
    modules: {
      top_market_story: pulse.wire_top_story || (latest ? { headline: latest.title_en || latest.title, urgency: 40, cluster: 'analysis' } : null),
      market_pulse_strip: pulse.session_framing,
      macro_regime_banner: pulse.pulse_banner,
      risk_sentiment: pulse.dimensions.risk_state,
      key_catalysts_today: pulse.catalysts_today,
      desk_commentary: pulse.desk_commentary,
      gold_dxy_yields_state: {
        dollar: pulse.dimensions.dollar_pressure,
        duration: pulse.dimensions.duration_pressure,
        volatility: pulse.dimensions.volatility_regime,
      },
      ai_momentum_tracker: pulse.dimensions.ai_concentration_risk,
      rotation_signals: { breadth: pulse.dimensions.breadth_state, defensive: pulse.dimensions.defensive_rotation },
    },
  };
}

// Compact prompt block for generators and Telegram.
function pulsePromptBlock() {
  const pulse = readJson(PULSE_PATH, null);
  if (!pulse || !pulse.dimensions) return null;
  return [
    'MARKET PULSE (sourced session state — let it shape tone, conviction, and urgency):',
    pulse.session_framing,
    ...pulse.desk_commentary.map((line) => `- ${line}`),
  ].join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const pulse = buildPulse();
  console.log(`[market-pulse] ${pulse.session_framing}`);
  console.log(`[market-pulse] banner: ${pulse.pulse_banner}`);
  console.log(`[market-pulse] catalysts_today=${pulse.catalysts_today.length} wire_top=${pulse.wire_top_story ? 'yes' : 'no'}`);
  if (write) {
    fs.mkdirSync(path.dirname(PULSE_PATH), { recursive: true });
    fs.writeFileSync(PULSE_PATH, JSON.stringify(pulse, null, 2) + '\n', 'utf8');
    const feed = buildNewsroomFeed(pulse);
    fs.mkdirSync(path.dirname(FEED_PATH), { recursive: true });
    fs.writeFileSync(FEED_PATH, JSON.stringify(feed, null, 2) + '\n', 'utf8');
    console.log('[market-pulse] wrote data/intelligence/market-pulse.json and data/feeds/newsroom-pulse.json');
  }
}

if (require.main === module) main();

module.exports = { buildPulse, pulsePromptBlock };
