'use strict';

// Phase 50: Regime Transition Analyzer
// Reads market-regime-history.json, detects regime transitions and trend signals.
// Also exports appendSnapshot() for adding entries to the history.
//
// Usage (module):
//   const { analyzeTransition, appendSnapshot } = require('./analyze-regime-transition');
//
// Usage (CLI):
//   node tools/analyze-regime-transition.js

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '..');
const HIST_PATH = path.join(ROOT, 'data', 'market-regime-history.json');

// ── Types of transition patterns ──────────────────────────────────────────────

const TRANSITIONS = {
  // Risk regime
  RISK_ON_TO_OFF:       'risk_on_to_off',
  RISK_OFF_TO_ON:       'risk_off_to_on',
  RISK_NEUTRAL_SHIFT:   'risk_neutral_shift',
  // Volatility
  VOL_COMPRESSION:      'volatility_compression',
  VOL_EXPANSION:        'volatility_expansion',
  VOL_SPIKE:            'volatility_spike',
  // Participation
  BROADENING:           'participation_broadening',
  NARROWING:            'participation_narrowing',
  // Rates
  CURVE_STEEPENING:     'curve_steepening',
  CURVE_FLATTENING:     'curve_flattening',
  CURVE_INVERSION_BREAK:'curve_inversion_break',
  // AI / sector
  AI_ACCELERATION:      'ai_sector_acceleration',
  AI_DECELERATION:      'ai_sector_deceleration',
  DEFENSIVE_ROTATION:   'defensive_rotation_onset',
  DEFENSIVE_FADING:     'defensive_rotation_fading',
};

// ── Public API ────────────────────────────────────────────────────────────────

function analyzeTransition(currentRegime, maxSnapshots = 5) {
  const history = loadHistory();
  const recent  = history.snapshots.slice(-maxSnapshots);

  if (recent.length === 0) {
    return {
      transitions_detected: [],
      transition_note:      null,
      regime_duration_days: null,
      trend_signals:        [],
      data_available:       false,
    };
  }

  const transitions    = detectTransitions(currentRegime, recent);
  const trend_signals  = detectTrends(recent);
  const duration       = computeRegimeDuration(currentRegime, recent);
  const transition_note= buildTransitionNote(transitions, trend_signals, currentRegime, recent);

  return {
    transitions_detected: transitions,
    transition_note,
    regime_duration_days: duration,
    trend_signals,
    data_available:       recent.length >= 2,
    snapshots_analyzed:   recent.length,
  };
}

function appendSnapshot(snapshot) {
  const history = loadHistory();
  const entry = {
    date:               snapshot.date || new Date().toISOString().slice(0, 10),
    market_regime:      snapshot.market_regime      || 'unverified',
    volatility_regime:  snapshot.volatility_regime  || 'unverified',
    risk_regime:        snapshot.risk_regime         || 'unverified',
    rates_trend:        snapshot.rates_trend         || 'unverified',
    ai_sector_momentum: snapshot.ai_sector_momentum || 'unverified',
    defensive_rotation: snapshot.defensive_rotation  || 'unverified',
    sector_leadership:  snapshot.sector_leadership   || [],
    vix_level:          snapshot.vix_level           != null ? snapshot.vix_level : null,
    spy_change_pct:     snapshot.spy_change_pct      != null ? snapshot.spy_change_pct : null,
    qqq_change_pct:     snapshot.qqq_change_pct      != null ? snapshot.qqq_change_pct : null,
    iwm_change_pct:     snapshot.iwm_change_pct      != null ? snapshot.iwm_change_pct : null,
    yield_spread_bps:   snapshot.yield_spread_bps    != null ? snapshot.yield_spread_bps : null,
    us10y_yield:        snapshot.us10y_yield         != null ? snapshot.us10y_yield : null,
    recorded_at:        new Date().toISOString(),
  };

  // Avoid duplicate entries for same date
  const existing = history.snapshots.findIndex(s => s.date === entry.date);
  if (existing >= 0) {
    history.snapshots[existing] = entry;
  } else {
    history.snapshots.push(entry);
  }

  // Cap at 90 rolling snapshots
  if (history.snapshots.length > 90) {
    history.snapshots = history.snapshots.slice(-90);
  }

  history.last_updated = new Date().toISOString();
  saveHistory(history);
  return entry;
}

// ── Transition detection ──────────────────────────────────────────────────────

function detectTransitions(current, recent) {
  const found = [];
  if (recent.length < 2) return found;

  const prev = recent[recent.length - 1];

  // Risk regime transitions
  if (prev.risk_regime === 'risk-on' && current.risk_regime === 'risk-off') {
    found.push({ type: TRANSITIONS.RISK_ON_TO_OFF, from: 'risk-on', to: 'risk-off', significance: 'high' });
  }
  if (prev.risk_regime === 'risk-off' && current.risk_regime === 'risk-on') {
    found.push({ type: TRANSITIONS.RISK_OFF_TO_ON, from: 'risk-off', to: 'risk-on', significance: 'high' });
  }
  if ((prev.risk_regime === 'risk-on' && current.risk_regime === 'neutral') ||
      (prev.risk_regime === 'risk-off' && current.risk_regime === 'neutral')) {
    found.push({ type: TRANSITIONS.RISK_NEUTRAL_SHIFT, from: prev.risk_regime, to: 'neutral', significance: 'medium' });
  }

  // Volatility transitions
  if (prev.vix_level != null && current.vix_level != null) {
    const vixChange = current.vix_level - prev.vix_level;
    if (vixChange > 4) {
      found.push({ type: TRANSITIONS.VOL_EXPANSION, vix_change: vixChange.toFixed(1), significance: 'medium' });
    } else if (vixChange < -4) {
      found.push({ type: TRANSITIONS.VOL_COMPRESSION, vix_change: vixChange.toFixed(1), significance: 'medium' });
    }
    if (current.vix_level > 28 && prev.vix_level <= 28) {
      found.push({ type: TRANSITIONS.VOL_SPIKE, vix_level: current.vix_level, significance: 'high' });
    }
  }

  // Yield curve transitions
  if (prev.yield_spread_bps != null && current.yield_spread_bps != null) {
    const spreadChange = current.yield_spread_bps - prev.yield_spread_bps;
    if (spreadChange > 15) {
      found.push({ type: TRANSITIONS.CURVE_STEEPENING, change_bps: spreadChange, significance: 'medium' });
    } else if (spreadChange < -15) {
      found.push({ type: TRANSITIONS.CURVE_FLATTENING, change_bps: spreadChange, significance: 'medium' });
    }
    // Inversion break (going from negative to positive)
    if (prev.yield_spread_bps < 0 && current.yield_spread_bps >= 0) {
      found.push({ type: TRANSITIONS.CURVE_INVERSION_BREAK, from_bps: prev.yield_spread_bps, to_bps: current.yield_spread_bps, significance: 'high' });
    }
  }

  // AI / sector transitions
  if (prev.ai_sector_momentum === 'negative' && current.ai_sector_momentum === 'positive') {
    found.push({ type: TRANSITIONS.AI_ACCELERATION, from: 'negative', to: 'positive', significance: 'medium' });
  }
  if (prev.ai_sector_momentum === 'positive' && current.ai_sector_momentum === 'negative') {
    found.push({ type: TRANSITIONS.AI_DECELERATION, from: 'positive', to: 'negative', significance: 'medium' });
  }

  // Defensive rotation
  if (prev.defensive_rotation !== 'present' && current.defensive_rotation === 'present') {
    found.push({ type: TRANSITIONS.DEFENSIVE_ROTATION, significance: 'medium' });
  }
  if (prev.defensive_rotation === 'present' && current.defensive_rotation !== 'present') {
    found.push({ type: TRANSITIONS.DEFENSIVE_FADING, significance: 'low' });
  }

  return found;
}

function detectTrends(recent) {
  if (recent.length < 3) return [];
  const signals = [];

  // VIX trend
  const vixValues = recent.map(s => s.vix_level).filter(v => v != null);
  if (vixValues.length >= 3) {
    const last3 = vixValues.slice(-3);
    const trend = last3[2] - last3[0];
    if (trend > 3) signals.push({ signal: 'vix_rising_trend', magnitude: trend.toFixed(1) });
    if (trend < -3) signals.push({ signal: 'vix_falling_trend', magnitude: trend.toFixed(1) });
  }

  // Risk regime persistence
  const riskRegimes = recent.slice(-4).map(s => s.risk_regime).filter(r => r && r !== 'unverified');
  if (riskRegimes.length >= 3) {
    const allSame = riskRegimes.every(r => r === riskRegimes[0]);
    if (allSame) signals.push({ signal: 'regime_persistence', regime: riskRegimes[0], sessions: riskRegimes.length });
  }

  // Yield curve trajectory
  const spreads = recent.map(s => s.yield_spread_bps).filter(s => s != null);
  if (spreads.length >= 3) {
    const last3 = spreads.slice(-3);
    const curveTrend = last3[2] - last3[0];
    if (curveTrend > 20) signals.push({ signal: 'curve_steepening_trend', change_bps: curveTrend });
    if (curveTrend < -20) signals.push({ signal: 'curve_flattening_trend', change_bps: curveTrend });
  }

  // Market regime
  const mRegimes = recent.slice(-5).map(s => s.market_regime).filter(r => r && r !== 'unverified');
  if (mRegimes.length >= 4) {
    const riskOnCount   = mRegimes.filter(r => r === 'risk-on' || r === 'growth_momentum').length;
    const riskOffCount  = mRegimes.filter(r => r === 'risk-off' || r === 'defensive_rotation').length;
    if (riskOnCount >= 3) signals.push({ signal: 'sustained_risk_on', sessions: riskOnCount });
    if (riskOffCount >= 3) signals.push({ signal: 'sustained_risk_off', sessions: riskOffCount });
  }

  return signals;
}

function computeRegimeDuration(current, recent) {
  if (!current.market_regime || current.market_regime === 'unverified') return null;
  let count = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    if (recent[i].market_regime === current.market_regime) count++;
    else break;
  }
  return count;
}

// ── Narrative ─────────────────────────────────────────────────────────────────

function buildTransitionNote(transitions, trends, current, recent) {
  const parts = [];

  // High-significance transitions first
  const high = transitions.filter(t => t.significance === 'high');
  for (const t of high.slice(0, 2)) {
    const note = {
      [TRANSITIONS.RISK_ON_TO_OFF]:
        'A risk regime transition from risk-on to risk-off has been detected — cross-asset signals reflect a meaningful shift in market risk appetite.',
      [TRANSITIONS.RISK_OFF_TO_ON]:
        'A risk regime transition from risk-off to risk-on has been detected — cross-asset signals suggest recovering risk appetite and potential rebound in cyclical exposure.',
      [TRANSITIONS.VOL_SPIKE]:
        `VIX has crossed the 28 threshold, entering volatility-spike territory — a level historically associated with forced deleveraging and elevated hedging demand.`,
      [TRANSITIONS.CURVE_INVERSION_BREAK]:
        `The 2Y/10Y yield curve has shifted from inversion to positive territory — a meaningful inflection in the rate cycle with complex implications for duration and financial sector positioning.`,
    }[t.type];
    if (note) parts.push(note);
  }

  // Medium-significance transitions (one)
  const medium = transitions.filter(t => t.significance === 'medium');
  if (medium.length > 0 && parts.length < 2) {
    const t = medium[0];
    const note = {
      [TRANSITIONS.VOL_EXPANSION]:
        `Volatility is expanding (VIX +${t.vix_change} points) — a signal worth monitoring for potential continuation into the higher-uncertainty regime.`,
      [TRANSITIONS.VOL_COMPRESSION]:
        `Volatility compression (VIX ${t.vix_change} points) reflects reduced near-term uncertainty pricing — potential complacency signal if sustained.`,
      [TRANSITIONS.CURVE_STEEPENING]:
        `The yield curve is steepening (+${t.change_bps}bps) — potentially signaling reflationary expectations or a normalizing monetary cycle.`,
      [TRANSITIONS.CURVE_FLATTENING]:
        `The yield curve is flattening (${t.change_bps}bps) — continued flattening pressure may re-test inversion territory.`,
      [TRANSITIONS.AI_ACCELERATION]:
        'AI and semiconductor sector signals have shifted from negative to positive — the market is repricing the AI capex cycle more constructively.',
      [TRANSITIONS.AI_DECELERATION]:
        'AI and semiconductor sector momentum has deteriorated — the market is expressing caution on near-term AI infrastructure spending expectations.',
      [TRANSITIONS.DEFENSIVE_ROTATION]:
        'Defensive sector rotation has been detected — utilities and healthcare leadership signals increasing risk-aversion in institutional positioning.',
    }[t.type];
    if (note) parts.push(note);
  }

  // Trend signals (one)
  for (const s of trends.slice(0, 1)) {
    const note = {
      'regime_persistence': s.sessions >= 4
        ? `The ${s.regime} regime has persisted across ${s.sessions} consecutive sessions — regime stability tends to support continuation until a catalyst-driven reversal.`
        : null,
      'sustained_risk_on':
        `Risk-on conditions have been sustained across ${s.sessions} of the last 5 sessions — a sustained trend that increases the significance of any potential reversal signal.`,
      'sustained_risk_off':
        `Risk-off conditions have persisted across ${s.sessions} of the last 5 sessions — an extended cautious regime that historically builds the foundation for eventual recovery positioning.`,
      'vix_rising_trend': s.magnitude > 6
        ? `VIX has risen ${s.magnitude} points across recent sessions — an accelerating trend that typically precedes regime-level uncertainty transitions.`
        : null,
      'vix_falling_trend': s.magnitude < -6
        ? `Sustained VIX compression (${s.magnitude} points across recent sessions) is reaching levels historically associated with reduced hedging and elevated complacency.`
        : null,
    }[s.signal];
    if (note) parts.push(note);
  }

  return parts.length ? parts.join(' ') : null;
}

// ── History persistence ───────────────────────────────────────────────────────

function loadHistory() {
  if (!fs.existsSync(HIST_PATH)) {
    return { version: '1.0', last_updated: null, snapshots: [] };
  }
  try { return JSON.parse(fs.readFileSync(HIST_PATH, 'utf8')); }
  catch { return { version: '1.0', last_updated: null, snapshots: [] }; }
}

function saveHistory(history) {
  fs.writeFileSync(HIST_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const regimePath = path.join(ROOT, 'data', 'market-regime-state.json');
  let current = {};
  if (fs.existsSync(regimePath)) {
    try { current = JSON.parse(fs.readFileSync(regimePath, 'utf8')).state || {}; } catch {}
  }
  const result = analyzeTransition(current);
  console.log(JSON.stringify(result, null, 2));
  if (result.transition_note) console.error('\nTransition note:', result.transition_note);
}

module.exports = { analyzeTransition, appendSnapshot };
