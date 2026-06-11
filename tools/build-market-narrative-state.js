'use strict';

// Phase 69 — Market Narrative Memory.
// Maintains a persistent regime/narrative state so every new article evolves
// an ongoing market story instead of generating isolated content. Values are
// derived only from sourced data (live market state, regime engine, narrative
// memory); anything underivable stays "unverified" — never fabricated.
//
// Output: data/intelligence/market-narrative-state.json
// Usage:  node tools/build-market-narrative-state.js --write
//         node tools/build-market-narrative-state.js          (report only)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'market-narrative-state.json');
const LIVE_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH = path.join(ROOT, 'data', 'market-regime-state.json');
const MEMORY_PATH = path.join(ROOT, 'data', 'narrative-memory.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');

const TODAY = new Date().toISOString().slice(0, 10);
const MAX_EVOLUTION_NOTES = 20;
const MAX_THEMES = 8;

function readJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function liveValue(node) {
  if (node === null || node === undefined) return null;
  if (typeof node === 'number') return node;
  if (typeof node === 'object') {
    for (const key of ['value', 'last', 'price', 'level', 'close']) {
      if (Number.isFinite(node[key])) return node[key];
    }
  }
  return null;
}

function trendFrom(current, previous, flatBand = 0.15) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return 'unverified';
  const delta = current - previous;
  if (Math.abs(delta) <= flatBand) return 'sideways';
  return delta > 0 ? 'rising' : 'falling';
}

function volatilityState(vix) {
  if (!Number.isFinite(vix)) return 'unverified';
  if (vix < 14) return 'compressed';
  if (vix < 20) return 'normal';
  if (vix < 28) return 'elevated';
  return 'stressed';
}

function deriveRegimes(live, regime, previous) {
  const liveOk = live && live.metadata && ['live', 'partial'].includes(live.metadata.status);
  const prevRegimes = (previous && previous.regimes) || {};

  const vix = liveOk ? liveValue(live.vix) : null;
  const us10y = liveOk ? liveValue(live.us10y_yield) : null;
  const dxy = liveOk ? liveValue(live.dxy) : null;

  const prevSnapshot = (previous && previous.sourced_snapshot) || {};

  return {
    regimes: {
      liquidity: regime.state && regime.state.risk_regime && regime.state.risk_regime !== 'unverified'
        ? (regime.state.risk_regime === 'risk_on' ? 'supportive' : regime.state.risk_regime === 'risk_off' ? 'tightening' : 'mixed')
        : prevRegimes.liquidity || 'unverified',
      inflation: prevRegimes.inflation || 'unverified',
      risk_appetite: (live && live.computed_regime && live.computed_regime.risk_state)
        || (regime.state && regime.state.risk_regime) || prevRegimes.risk_appetite || 'unverified',
      volatility_state: vix !== null ? volatilityState(vix) : prevRegimes.volatility_state || 'unverified',
      yield_trend: us10y !== null ? trendFrom(us10y, prevSnapshot.us10y, 0.05) : prevRegimes.yield_trend || 'unverified',
      dollar_trend: dxy !== null ? trendFrom(dxy, prevSnapshot.dxy, 0.3) : prevRegimes.dollar_trend || 'unverified',
      central_bank_tone: (live && live.fed_expectations && live.fed_expectations.tone)
        || prevRegimes.central_bank_tone || 'unverified',
      ai_speculation_cycle: (regime.state && regime.state.ai_sector_momentum && regime.state.ai_sector_momentum !== 'unverified')
        ? regime.state.ai_sector_momentum
        : prevRegimes.ai_speculation_cycle || 'unverified',
    },
    sourced_snapshot: {
      date: TODAY,
      vix: vix,
      us10y: us10y !== null ? us10y : prevSnapshot.us10y ?? null,
      dxy: dxy !== null ? dxy : prevSnapshot.dxy ?? null,
      live_status: (live && live.metadata && live.metadata.status) || 'unavailable',
    },
  };
}

function deriveThemes(memory, previous) {
  const prevThemes = (previous && previous.dominant_themes) || [];
  const snapshots = (memory.snapshots || []).slice(-5);
  const seen = new Map();

  for (const theme of prevThemes) {
    seen.set(theme.theme, { ...theme, supported_this_run: false });
  }

  for (const snap of snapshots) {
    const candidates = [
      snap.dominant_macro_narrative,
      ...(Array.isArray(snap.drift_notes) ? [] : []),
    ].filter((t) => t && typeof t === 'string');
    for (const raw of candidates) {
      const theme = raw.trim().slice(0, 140);
      if (!theme) continue;
      const existing = seen.get(theme);
      if (existing) {
        existing.last_updated = snap.date || TODAY;
        existing.status = 'dominant';
        existing.supported_this_run = true;
      } else {
        seen.set(theme, {
          theme,
          first_seen: snap.date || TODAY,
          last_updated: snap.date || TODAY,
          status: 'developing',
          supported_this_run: true,
        });
      }
    }
  }

  const themes = [...seen.values()].map((t) => {
    const { supported_this_run, ...rest } = t;
    if (!supported_this_run && rest.status !== 'fading') rest.status = 'fading';
    return rest;
  });

  // Most recently updated first; drop stale fading themes beyond the cap.
  themes.sort((a, b) => String(b.last_updated).localeCompare(String(a.last_updated)));
  return themes.slice(0, MAX_THEMES);
}

function describeChanges(previous, next) {
  const prev = (previous && previous.regimes) || {};
  const changes = [];
  for (const [key, value] of Object.entries(next.regimes)) {
    if (prev[key] && prev[key] !== value && value !== 'unverified') {
      changes.push(`${key}: ${prev[key]} -> ${value}`);
    }
  }
  if (!changes.length) return 'Regime picture unchanged versus the prior narrative window.';
  return `Regime shifts this run: ${changes.join('; ')}.`;
}

function buildContinuityNote(state) {
  const r = state.regimes;
  const verified = Object.entries(r).filter(([, v]) => v && v !== 'unverified');
  if (!verified.length) {
    return 'No verified regime inputs this run. Treat the narrative as a structural baseline and avoid claiming regime shifts.';
  }
  return `Ongoing narrative state — ${verified.map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('; ')}. New analysis should evolve this story: state what persisted, what changed, and what would confirm the next phase.`;
}

// Editorial continuity: catalysts that remain unresolved (upcoming or just
// released high-impact events) and the desk's prior stance trajectory, so new
// articles reference the evolving story instead of standing alone.
function deriveUnresolvedCatalysts() {
  const calendar = readJson(CALENDAR_PATH, { events: [] });
  const horizon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  return (calendar.events || [])
    .filter((e) => {
      const importance = String(e.importance || e.impact_level || '').toLowerCase();
      const upcoming = e.date >= TODAY && e.date <= horizon && (e.actual === null || e.actual === undefined);
      const justReleased = e.actual !== null && e.actual !== undefined && e.date >= new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
      return importance === 'high' && (upcoming || justReleased);
    })
    .slice(0, 6)
    .map((e) => ({
      name: e.event_name || e.name,
      date: e.date,
      state: (e.actual !== null && e.actual !== undefined) ? 'released_awaiting_digestion' : 'pending',
      assets: (e.historical_asset_sensitivity || []).slice(0, 4),
    }));
}

function derivePriorStances(memory) {
  return (memory.snapshots || []).slice(-3).reverse()
    .map((s) => ({ date: s.date || null, stance: s.directional_bias || 'unverified' }))
    .filter((s) => s.date);
}

function buildState() {
  const live = readJson(LIVE_PATH);
  const regime = readJson(REGIME_PATH);
  const memory = readJson(MEMORY_PATH, { snapshots: [] });
  const previous = readJson(OUT_PATH, null);

  const { regimes, sourced_snapshot } = deriveRegimes(live, regime, previous);
  const state = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    run_date: TODAY,
    regimes,
    sourced_snapshot,
    dominant_themes: deriveThemes(memory, previous),
    unresolved_catalysts: deriveUnresolvedCatalysts(),
    prior_stances: derivePriorStances(memory),
    narrative_evolution: [
      ...(((previous && previous.narrative_evolution) || []).slice(-(MAX_EVOLUTION_NOTES - 1))),
      { date: TODAY, note: describeChanges(previous, { regimes }) },
    ],
  };
  state.continuity_note = buildContinuityNote(state);
  return state;
}

// Compact prompt block for generators.
function narrativeStatePromptBlock() {
  const state = readJson(OUT_PATH, null);
  if (!state || !state.regimes) return null;
  const lines = [
    'MARKET NARRATIVE MEMORY (persistent, evolves across publications):',
    ...Object.entries(state.regimes).map(([k, v]) => `- ${k.replace(/_/g, ' ')}: ${v}`),
  ];
  const themes = (state.dominant_themes || []).filter((t) => t.status !== 'fading').slice(0, 4);
  if (themes.length) {
    lines.push('Active narrative threads:');
    for (const t of themes) lines.push(`- [${t.status}] ${t.theme}`);
  }
  const lastEvolution = (state.narrative_evolution || []).slice(-1)[0];
  if (lastEvolution) lines.push(`Latest evolution note: ${lastEvolution.note}`);
  const catalysts = (state.unresolved_catalysts || []).slice(0, 4);
  if (catalysts.length) {
    lines.push('Unresolved catalysts (reference these as the evolving story — e.g. "the pending CPI print continues to shape positioning"):');
    for (const c of catalysts) lines.push(`- ${c.name} (${c.date}, ${c.state.replace(/_/g, ' ')}; sensitivity: ${c.assets.join(', ') || 'broad'})`);
  }
  const stances = (state.prior_stances || []);
  if (stances.length) {
    lines.push(`Desk stance trajectory (do not contradict silently — evolve or explain): ${stances.map((s) => `${s.date}: ${s.stance}`).join(' | ')}`);
  }
  lines.push(`Continuity rule: ${state.continuity_note}`);
  return lines.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const state = buildState();
  console.log('[narrative-state] regimes:', JSON.stringify(state.regimes));
  console.log(`[narrative-state] themes=${state.dominant_themes.length} evolution_notes=${state.narrative_evolution.length}`);
  console.log(`[narrative-state] ${state.narrative_evolution.slice(-1)[0].note}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
    console.log(`[narrative-state] wrote data/intelligence/market-narrative-state.json`);
  }
}

if (require.main === module) main();

module.exports = { buildState, narrativeStatePromptBlock };
