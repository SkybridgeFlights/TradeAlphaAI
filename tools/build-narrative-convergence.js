'use strict';

// Phase 79 — Narrative Convergence Engine.
// The top of the intelligence stack: fuses the pulse, the cognition engine,
// and the macro cognition layer into ONE evolving institutional narrative.
// It answers, strictly from verified artifacts:
//   - what changed            (verified regime transitions)
//   - what confirms           (confirming causal links, confirming breadth)
//   - what diverges           (diverging links with chain persistence)
//   - what is weakening       (releasing pressure, exhaustion signals)
//   - what is becoming crowded(crowding conviction / concentration pressure)
//   - what the market prepares for (scheduled high-impact catalysts)
//   - what may be underpriced (elevated stored pressure or persistent
//                              divergence with no active alert covering it)
// plus regime coherence scoring (how aligned the cross-asset tape is) and
// transition velocity (how fast the regime picture is moving).
//
// Honesty rules: no predictions, no certainty, no advice. Unverified inputs
// suppress every section; "underpriced" framing is always conditional
// ("the tape is paying little attention to…"), derived from recorded
// evidence, and never a directional call.
//
// Self-persistent: link-state history (chain strength) is carried in the
// output file itself; same-day reruns replace today's entry.
//
// Output: data/intelligence/narrative-convergence.json
// Usage:  node tools/build-narrative-convergence.js --write

const fs = require('fs');
const path = require('path');
const { PRESSURE_TRACKS } = require('./build-macro-cognition');

const ROOT = path.resolve(__dirname, '..');
const COGNITION_PATH = path.join(ROOT, 'data', 'intelligence', 'market-cognition.json');
const MACRO_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-cognition.json');
const PULSE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-pulse.json');
const TIMELINE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-timeline.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'narrative-convergence.json');

const TODAY = new Date().toISOString().slice(0, 10);
const STALE_HOURS = 48;
const LINK_HISTORY_CAP = 10;

const COHERENCE_BANDS = ['coherent', 'tense', 'conflicted', 'unverified'];
const VELOCITY_BANDS = ['stable', 'shifting', 'accelerating', 'unverified'];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function fresh(artifact) {
  if (!artifact || !artifact.updated_at) return false;
  return (Date.now() - new Date(artifact.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

// ── Chain strength: persistence of each causal link state across sessions ──
function updateLinkHistory(previous, links, verified) {
  const history = (previous && previous.link_history) || {};
  if (!verified) return history; // hold without extending
  const next = {};
  for (const link of links || []) {
    const entries = (history[link.id] || []).filter((e) => e.date !== TODAY);
    if (['confirming', 'diverging', 'neutral'].includes(link.state)) {
      entries.push({ date: TODAY, state: link.state });
    }
    next[link.id] = entries.slice(-LINK_HISTORY_CAP);
  }
  // Preserve history for edges not present this run.
  for (const [id, entries] of Object.entries(history)) {
    if (!next[id]) next[id] = entries;
  }
  return next;
}

function chainStrength(historyEntries, state) {
  let streak = 0;
  for (let i = (historyEntries || []).length - 1; i >= 0; i -= 1) {
    if (historyEntries[i].state === state) { streak += 1; continue; }
    break;
  }
  return streak;
}

// ── Regime coherence: how aligned the observed cross-asset tape is ─────────
function scoreCoherence(links, contradictions, verified) {
  if (!verified) {
    return { score: null, band: 'unverified', observed_links: 0, en: 'Coherence scoring resumes with verified inputs.', ar: 'يستأنف قياس الاتساق مع المدخلات الموثقة.' };
  }
  const observed = (links || []).filter((l) => ['confirming', 'diverging', 'neutral'].includes(l.state));
  if (!observed.length) {
    return { score: null, band: 'unverified', observed_links: 0, en: 'No observed cross-asset links this session.', ar: 'لا روابط مرصودة بين الأصول في هذه الجلسة.' };
  }
  const confirming = observed.filter((l) => l.state === 'confirming').length;
  const neutral = observed.filter((l) => l.state === 'neutral').length;
  let score = Math.round(((confirming + neutral * 0.5) / observed.length) * 100);
  const active = (contradictions || []).filter((c) => c.active_today);
  score -= active.length * 5 + active.filter((c) => c.escalated).length * 10;
  score = Math.max(0, Math.min(100, score));
  const band = score >= 70 ? 'coherent' : score >= 45 ? 'tense' : 'conflicted';
  const text = {
    coherent: { en: `Regime coherence ${score}/100 — the observed cross-asset tape is largely aligned.`, ar: `اتساق النظام ${score}/100 — حركة الأصول المرصودة متوافقة إلى حد كبير.` },
    tense: { en: `Regime coherence ${score}/100 — the tape is internally tense; confirmations and divergences are competing.`, ar: `اتساق النظام ${score}/100 — السوق مشدود داخلياً؛ التأكيدات والانفصالات تتنافس.` },
    conflicted: { en: `Regime coherence ${score}/100 — cross-asset relationships are openly conflicted this session.`, ar: `اتساق النظام ${score}/100 — العلاقات بين الأصول متضاربة بوضوح في هذه الجلسة.` },
  }[band];
  return { score, band, observed_links: observed.length, en: text.en, ar: text.ar };
}

// ── Transition velocity: how fast the regime picture is moving ─────────────
function scoreVelocity(timeline, verified) {
  if (!verified) return { events_5d: null, band: 'unverified' };
  const cutoff = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
  const recent = (timeline.events || []).filter((e) => e.date >= cutoff).length;
  return { events_5d: recent, band: recent >= 4 ? 'accelerating' : recent >= 2 ? 'shifting' : 'stable' };
}

// ── What the tape may be paying little attention to ────────────────────────
// Evidence-backed only: an elevated stored-pressure track or a persistent
// divergence that no active alert currently covers. Framing is conditional —
// an observation about attention, never a directional call.
const PRESSURE_ALERT_COVERAGE = {
  volatility_pressure: ['volatility-expansion', 'risk-escalation'],
  liquidity_pressure: ['liquidity-warning'],
  defensive_pressure: ['defensive-rotation'],
  speculative_pressure: ['positioning-crowding'],
  concentration_pressure: ['momentum-exhaustion', 'positioning-crowding'],
  yield_pressure: ['yield-pressure'],
};

const PRESSURE_IGNORED_TEXT = {
  volatility_pressure: { en: 'stored volatility compression', ar: 'انضغاط تقلب مخزّن' },
  liquidity_pressure: { en: 'accumulating liquidity stress', ar: 'ضغط سيولة متراكم' },
  defensive_pressure: { en: 'building defensive rotation pressure', ar: 'ضغط تناوب دفاعي متصاعد' },
  speculative_pressure: { en: 'stacked speculative appetite', ar: 'شهية مضاربة متراكمة' },
  concentration_pressure: { en: 'persistent leadership concentration', ar: 'تركز قيادة مستمر' },
  yield_pressure: { en: 'accumulated yield stress', ar: 'ضغط عوائد متراكم' },
};

function findUnderpriced(macro, cognition, verified) {
  if (!verified) return [];
  const items = [];
  const activeAlertTypes = new Set((cognition.alerts || []).map((a) => a.type));
  const tracks = (macro.pressure && macro.pressure.tracks) || {};
  for (const key of PRESSURE_TRACKS) {
    const track = tracks[key];
    if (!track || track.score < 3) continue;
    const covered = (PRESSURE_ALERT_COVERAGE[key] || []).some((t) => activeAlertTypes.has(t));
    if (covered) continue;
    const label = PRESSURE_IGNORED_TEXT[key];
    items.push({
      kind: 'pressure',
      track: key,
      score: track.score,
      en: `${label.en} (${track.score}/5) with no active alert — attention the tape is not currently paying.`,
      ar: `${label.ar} (${track.score}/5) دون تنبيه نشط — انتباه لا يوليه السوق حالياً.`,
    });
  }
  if (!activeAlertTypes.has('macro-divergence')) {
    const persistent = (cognition.memory_observations || []).find((o) => o.kind === 'divergence' && o.sessions >= 2);
    if (persistent) {
      items.push({
        kind: 'divergence',
        flag: persistent.flag,
        sessions: persistent.sessions,
        en: `a ${persistent.sessions}-session ${String(persistent.flag).replace(/-/g, ' ')} divergence running without an escalated alert.`,
        ar: `انفصال مستمر منذ ${persistent.sessions} جلسات دون تنبيه مُصعَّد.`,
      });
    }
  }
  return items.slice(0, 2);
}

// ── Assembly ────────────────────────────────────────────────────────────────
function buildConvergence() {
  const cognitionRaw = readJson(COGNITION_PATH, null);
  const macroRaw = readJson(MACRO_PATH, null);
  const pulseRaw = readJson(PULSE_PATH, null);
  const timeline = readJson(TIMELINE_PATH, { events: [] });
  const previous = readJson(OUT_PATH, null);

  const cognition = fresh(cognitionRaw) ? cognitionRaw : null;
  const macro = fresh(macroRaw) ? macroRaw : null;
  const pulse = fresh(pulseRaw) ? pulseRaw : null;
  const verified = Boolean(cognition && cognition.verified === true && macro && macro.verified === true);

  const links = (cognition && cognition.causal_links) || [];
  const linkHistory = updateLinkHistory(previous, links, verified);

  const observedLinks = verified
    ? links
      .filter((l) => ['confirming', 'diverging', 'neutral'].includes(l.state))
      .map((l) => ({
        id: l.id,
        legs: l.legs,
        state: l.state,
        chain_strength: chainStrength(linkHistory[l.id], l.state),
        en: l.en,
        ar: l.ar,
      }))
    : [];

  const coherence = scoreCoherence(links, (macro && macro.contradictions) || [], verified);
  const velocity = scoreVelocity(timeline, verified);
  const underpriced = findUnderpriced(macro || {}, cognition || {}, verified);

  const whatChanged = verified ? (cognition.timeline_tail || []).slice(0, 3) : [];
  const confirms = observedLinks.filter((l) => l.state === 'confirming');
  const diverges = observedLinks.filter((l) => l.state === 'diverging');
  const weakening = verified
    ? Object.entries((macro.pressure && macro.pressure.tracks) || {})
      .filter(([, t]) => t.state === 'releasing')
      .map(([key, t]) => ({ track: key, score: t.score, en: t.en, ar: t.ar }))
    : [];
  const crowding = verified && (macro.conviction.state === 'crowded-positioning' || macro.structure.class === 'crowded-trade')
    ? { en: macro.conviction.state === 'crowded-positioning' ? macro.conviction.en : macro.structure.en, ar: macro.conviction.state === 'crowded-positioning' ? macro.conviction.ar : macro.structure.ar }
    : null;
  const preparingFor = (pulse && pulse.catalysts_today ? pulse.catalysts_today.slice(0, 2) : [])
    .map((c) => ({ name: c.name, time: c.time }));

  // Narrative composition — short, varied, verified-only.
  const narrativeEn = [];
  const narrativeAr = [];
  if (verified) {
    if (whatChanged.length) {
      narrativeEn.push(`The regime picture moved: ${whatChanged.map((e) => e.note).join('; ')}.`);
      narrativeAr.push('صورة النظام تحركت عبر تحولات موثقة جديدة.');
    }
    narrativeEn.push(coherence.en);
    narrativeAr.push(coherence.ar);
    if (diverges.length) {
      const strongest = diverges.sort((a, b) => b.chain_strength - a.chain_strength)[0];
      narrativeEn.push(`The ${strongest.legs.join('/').toUpperCase()} link is not holding${strongest.chain_strength >= 2 ? ` — a ${strongest.chain_strength}-session strain` : ''}; that is where the tape's internal argument lives.`);
      narrativeAr.push(`رابط ${strongest.legs.join('/').toUpperCase()} لا يصمد${strongest.chain_strength >= 2 ? ` — إجهاد مستمر منذ ${strongest.chain_strength} جلسات` : ''}؛ وهناك يكمن الجدل الداخلي للسوق.`);
    }
    if (crowding) {
      narrativeEn.push(crowding.en);
      narrativeAr.push(crowding.ar);
    }
    if (underpriced.length) {
      narrativeEn.push(`Quietly building beneath the surface: ${underpriced.map((u) => u.en).join(' Also: ')}`);
      narrativeAr.push(`يتراكم بهدوء تحت السطح: ${underpriced.map((u) => u.ar).join(' وكذلك: ')}`);
    }
    if (preparingFor.length) {
      narrativeEn.push(`The next scheduled resolution point is ${preparingFor[0].name}.`);
      narrativeAr.push(`نقطة الحسم المجدولة التالية هي ${preparingFor[0].name}.`);
    }
  }

  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    run_date: TODAY,
    verified,
    coherence,
    transition_velocity: velocity,
    what_changed: whatChanged,
    confirms,
    diverges,
    weakening,
    crowding,
    preparing_for: preparingFor,
    underpriced,
    narrative_en: narrativeEn.slice(0, 5),
    narrative_ar: narrativeAr.slice(0, 5),
    link_history: linkHistory,
    convergence_note: verified
      ? `Convergence — coherence ${coherence.score}/100 (${coherence.band}); velocity ${velocity.band}; ${confirms.length} confirming / ${diverges.length} diverging links; ${underpriced.length} underpriced signal(s).`
      : 'Convergence holding prior memory — no verified inputs this run.',
  };
}

// Compact prompt block for generators — the converged market narrative.
function convergencePromptBlock() {
  const c = readJson(OUT_PATH, null);
  if (!c || c.verified !== true) return null;
  const lines = ['NARRATIVE CONVERGENCE (the one evolving market story — weave, do not list):'];
  for (const s of c.narrative_en || []) lines.push(`- ${s}`);
  if (c.transition_velocity && c.transition_velocity.band !== 'unverified') {
    lines.push(`- Regime transition velocity: ${c.transition_velocity.band} (${c.transition_velocity.events_5d} verified transitions in 5 days).`);
  }
  if (lines.length === 1) return null;
  lines.push('Convergence rule: frame attention gaps conditionally ("the tape is paying little attention to…"), never as predictions.');
  return lines.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const convergence = buildConvergence();
  console.log(`[convergence] ${convergence.convergence_note}`);
  for (const s of convergence.narrative_en) console.log(`[convergence] ${s}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(convergence, null, 2) + '\n', 'utf8');
    console.log('[convergence] wrote data/intelligence/narrative-convergence.json');
  }
}

if (require.main === module) main();

module.exports = {
  buildConvergence, convergencePromptBlock,
  COHERENCE_BANDS, VELOCITY_BANDS, PRESSURE_ALERT_COVERAGE,
  // Pure logic exports for tests and validators.
  scoreCoherence, scoreVelocity, findUnderpriced, updateLinkHistory, chainStrength,
};
