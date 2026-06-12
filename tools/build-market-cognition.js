'use strict';

// Phase 74 — Market Cognition Engine ("one market brain").
// Sits above the market pulse and turns per-session sourced state into
// cognitive market intelligence:
//   - regime shift detection (emerging / strengthening / established / extended)
//   - cross-session market memory (streaks, divergence persistence)
//   - cross-asset causal network readings (confirming / diverging links)
//   - cognition signals (confirmation, contradiction, fragility, exhaustion,
//     liquidity stress, speculative behavior)
//   - institutional desk alerts derived ONLY from verified state transitions
//   - market state evolution timeline (how the market arrived here)
//
// Honesty rules: every classification rests on verified pulse dimensions or
// sourced numeric co-moves. Unverified inputs break streaks, suppress alerts,
// and never produce observations. No prediction, no fabricated urgency.
//
// Persistent stores:
//   data/intelligence/session-history.json   (per-session dimension snapshots)
//   data/intelligence/market-timeline.json   (regime transition events)
// Output:
//   data/intelligence/market-cognition.json
// Usage: node tools/build-market-cognition.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PULSE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-pulse.json');
const LIVE_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'intelligence', 'session-history.json');
const TIMELINE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-timeline.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'market-cognition.json');

const TODAY = new Date().toISOString().slice(0, 10);
const PULSE_MAX_AGE_HOURS = 48;
const MAX_SESSIONS = 40;
const MAX_TIMELINE_EVENTS = 60;

const DIMENSIONS = [
  'risk_state', 'volatility_regime', 'dollar_pressure', 'duration_pressure',
  'momentum_concentration', 'ai_concentration_risk', 'breadth_state',
  'defensive_rotation', 'liquidity_stress', 'speculative_appetite', 'market_fragility',
];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function movePct(live, key) {
  const node = live && live[key];
  if (!node || typeof node !== 'object') return null;
  return Number.isFinite(node.change_pct) ? node.change_pct : null;
}

const ORDINAL_EN = { 2: 'Second', 3: 'Third', 4: 'Fourth', 5: 'Fifth', 6: 'Sixth', 7: 'Seventh', 8: 'Eighth' };
const ORDINAL_AR = { 2: 'الثانية', 3: 'الثالثة', 4: 'الرابعة', 5: 'الخامسة', 6: 'السادسة', 7: 'السابعة', 8: 'الثامنة' };

function ordinalEn(n) { return ORDINAL_EN[n] || `${n}th`; }
function ordinalAr(n) { return ORDINAL_AR[n] || `رقم ${n}`; }

// ── Session snapshot ─────────────────────────────────────────────────────────

// Divergence flags are recorded only when BOTH legs are sourced this session.
function deriveDivergences(sourcedMoves, dims) {
  const flags = [];
  const { gold, dxy, qqq, spy, iwm } = sourcedMoves;
  if (Number.isFinite(gold) && Number.isFinite(dxy) && gold > 0.15 && dxy > 0.15) {
    flags.push('gold-vs-dollar');
  }
  if (Number.isFinite(gold) && gold > 0.15 && dims.duration_pressure === 'building') {
    flags.push('gold-vs-yields');
  }
  if (Number.isFinite(spy) && Number.isFinite(iwm) && spy > 0.2 && iwm < -0.2) {
    flags.push('index-vs-breadth');
  }
  if (Number.isFinite(qqq) && qqq > 0.2 && dims.duration_pressure === 'building') {
    flags.push('growth-vs-duration');
  }
  return flags;
}

function buildSessionSnapshot(pulse, live) {
  const liveOk = live && live.metadata && ['live', 'partial'].includes(live.metadata.status);
  const dims = {};
  for (const key of DIMENSIONS) dims[key] = (pulse && pulse.dimensions && pulse.dimensions[key]) || 'unverified';
  const sourcedMoves = {
    gold: liveOk ? movePct(live, 'gold') : null,
    dxy: liveOk ? movePct(live, 'dxy') : null,
    spy: liveOk ? movePct(live, 'sp500') : null,
    qqq: liveOk ? movePct(live, 'nasdaq') : null,
    iwm: liveOk ? movePct(live, 'russell2000') : null,
    vix: liveOk ? movePct(live, 'vix') : null,
    nvda: liveOk ? movePct(live, 'nvda') : null,
    btc: liveOk ? movePct(live, 'bitcoin') : null,
    us10y: liveOk ? movePct(live, 'us10y_yield') : null,
    tlt: liveOk ? movePct(live, 'tlt') : null,
  };
  return {
    date: TODAY,
    updated_at: new Date().toISOString(),
    verified: Boolean(pulse && pulse.verified === true),
    dims,
    sourced_moves: sourcedMoves,
    divergences: deriveDivergences(sourcedMoves, dims),
    live_status: (live && live.metadata && live.metadata.status) || 'unavailable',
  };
}

function updateHistory(history, snapshot) {
  const sessions = (history.sessions || []).filter((s) => s && s.date && s.date !== snapshot.date);
  sessions.push(snapshot);
  sessions.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { version: '1.0', updated_at: snapshot.updated_at, sessions: sessions.slice(-MAX_SESSIONS) };
}

// ── Regime shift detection ───────────────────────────────────────────────────

// Streak: consecutive trailing sessions sharing the current verified value.
// An unverified session breaks the streak — missing data never extends a claim.
function detectRegimeShifts(sessions) {
  const shifts = [];
  const latest = sessions[sessions.length - 1];
  if (!latest) return shifts;
  for (const dim of DIMENSIONS) {
    const current = latest.dims[dim];
    if (!current || current === 'unverified') {
      shifts.push({ dimension: dim, state: current || 'unverified', phase: 'unverified', sessions_in_state: 0, from: null });
      continue;
    }
    let streak = 0;
    let from = null;
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      const value = sessions[i].dims[dim];
      if (value === current) { streak += 1; continue; }
      if (value && value !== 'unverified') from = { state: value, date: sessions[i].date };
      break;
    }
    const phase = streak === 1
      ? (from ? 'emerging' : 'baseline')
      : streak === 2 ? 'strengthening'
        : streak <= 4 ? 'established' : 'extended';
    shifts.push({ dimension: dim, state: current, phase, sessions_in_state: streak, from });
  }
  return shifts;
}

function updateTimeline(timeline, shifts) {
  const events = (timeline.events || []).slice();
  for (const shift of shifts) {
    if (shift.phase !== 'emerging' || !shift.from) continue;
    const exists = events.some((e) => e.date === TODAY && e.dimension === shift.dimension);
    if (exists) continue;
    events.push({
      date: TODAY,
      dimension: shift.dimension,
      from: shift.from.state,
      to: shift.state,
      note: `${shift.dimension.replace(/_/g, ' ')}: ${shift.from.state} -> ${shift.state}`,
    });
  }
  events.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  return { version: '1.0', updated_at: new Date().toISOString(), events: events.slice(-MAX_TIMELINE_EVENTS) };
}

// ── Cross-session memory observations ────────────────────────────────────────

// Watched persistent states: template per (dimension, state). Bilingual text is
// composed here so the renderer and generators stay template-free.
const STREAK_TEMPLATES = {
  'breadth_state:deteriorating': (n) => ({
    en: `${ordinalEn(n)} consecutive session of deteriorating breadth beneath headline index strength.`,
    ar: `الجلسة ${ordinalAr(n)} على التوالي من تدهور اتساع السوق تحت قوة المؤشرات الرئيسية.`,
  }),
  'volatility_regime:compressed': (n) => ({
    en: `Volatility compression now ${n} sessions deep — increasingly resembling stored instability rather than calm.`,
    ar: `انضغاط التقلب مستمر منذ ${n} جلسات — يشبه بشكل متزايد عدم استقرار مخزّن لا هدوءاً حقيقياً.`,
  }),
  'volatility_regime:stressed': (n) => ({
    en: `Volatility stress regime persists for a ${ordinalEn(n).toLowerCase()} straight session — liquidity remains the session variable.`,
    ar: `نظام ضغط التقلب مستمر للجلسة ${ordinalAr(n)} على التوالي — وتبقى السيولة هي المتغير الأهم.`,
  }),
  'momentum_concentration:narrow-megacap': (n) => ({
    en: `Megacap leadership narrowing extends to a ${ordinalEn(n).toLowerCase()} consecutive session beneath headline strength.`,
    ar: `تركّز القيادة في الأسهم الكبرى يمتد للجلسة ${ordinalAr(n)} على التوالي تحت القوة الظاهرة للمؤشرات.`,
  }),
  'ai_concentration_risk:elevated': (n) => ({
    en: `AI concentration risk holds elevated for a ${ordinalEn(n).toLowerCase()} straight session — crowding pressure is building, not resetting.`,
    ar: `مخاطر تركز الذكاء الاصطناعي تبقى مرتفعة للجلسة ${ordinalAr(n)} على التوالي — ضغط الازدحام يتراكم ولا يتبدد.`,
  }),
  'dollar_pressure:firming': (n) => ({
    en: `Dollar firming persists into a ${ordinalEn(n).toLowerCase()} consecutive session, draining global risk appetite at the margin.`,
    ar: `تقوّي الدولار يمتد للجلسة ${ordinalAr(n)} على التوالي، مستنزفاً شهية المخاطرة العالمية عند الهامش.`,
  }),
  'duration_pressure:building': (n) => ({
    en: `Yield pressure builds for a ${ordinalEn(n).toLowerCase()} straight session, tightening valuation tolerance across long-duration assets.`,
    ar: `ضغط العوائد يتصاعد للجلسة ${ordinalAr(n)} على التوالي، مضيّقاً هامش تقبّل التقييمات في أصول النمو طويلة الأمد.`,
  }),
  'liquidity_stress:tightening': (n) => ({
    en: `Liquidity conditions remain in tightening mode for a ${ordinalEn(n).toLowerCase()} consecutive session.`,
    ar: `أوضاع السيولة تبقى في وضع التشدد للجلسة ${ordinalAr(n)} على التوالي.`,
  }),
  'speculative_appetite:expanding': (n) => ({
    en: `Speculative appetite expands for a ${ordinalEn(n).toLowerCase()} straight session — risk-seeking behavior is persistent, not episodic.`,
    ar: `شهية المضاربة تتوسع للجلسة ${ordinalAr(n)} على التوالي — سلوك السعي للمخاطرة مستمر وليس عابراً.`,
  }),
  'defensive_rotation:active': (n) => ({
    en: `Defensive rotation stays active for a ${ordinalEn(n).toLowerCase()} consecutive session — protection demand is persistent.`,
    ar: `التناوب الدفاعي يبقى نشطاً للجلسة ${ordinalAr(n)} على التوالي — الطلب على الحماية مستمر.`,
  }),
  'market_fragility:building': (n) => ({
    en: `Market fragility signals build for a ${ordinalEn(n).toLowerCase()} straight session across volatility, breadth, and concentration inputs.`,
    ar: `إشارات هشاشة السوق تتراكم للجلسة ${ordinalAr(n)} على التوالي عبر مدخلات التقلب والاتساع والتركز.`,
  }),
  'market_fragility:elevated': (n) => ({
    en: `Elevated market fragility persists for a ${ordinalEn(n).toLowerCase()} consecutive session — stress inputs are stacking, not rotating.`,
    ar: `هشاشة السوق المرتفعة مستمرة للجلسة ${ordinalAr(n)} على التوالي — مدخلات الضغط تتراكم ولا تتناوب.`,
  }),
};

const DIVERGENCE_TEMPLATES = {
  'gold-vs-dollar': (n) => ({
    en: n >= 2
      ? `Gold strength against a firming dollar persists for a ${ordinalEn(n).toLowerCase()} session — an unusual co-move worth respecting.`
      : 'Gold is rising against a firming dollar this session — an unusual co-move worth respecting.',
    ar: n >= 2
      ? `قوة الذهب رغم تقوّي الدولار تستمر للجلسة ${ordinalAr(n)} — تحرك متزامن غير معتاد يستحق الانتباه.`
      : 'الذهب يرتفع رغم تقوّي الدولار في هذه الجلسة — تحرك متزامن غير معتاد يستحق الانتباه.',
  }),
  'gold-vs-yields': (n) => ({
    en: n >= 2
      ? `Gold continues diverging from yield pressure for a ${ordinalEn(n).toLowerCase()} session.`
      : 'Gold is diverging from building yield pressure this session.',
    ar: n >= 2
      ? `الذهب يواصل الانفصال عن ضغط العوائد للجلسة ${ordinalAr(n)}.`
      : 'الذهب ينفصل عن ضغط العوائد المتصاعد في هذه الجلسة.',
  }),
  'index-vs-breadth': (n) => ({
    en: n >= 2
      ? `Headline index strength keeps masking small-cap weakness for a ${ordinalEn(n).toLowerCase()} session.`
      : 'Headline index strength is masking small-cap weakness this session.',
    ar: n >= 2
      ? `قوة المؤشرات الرئيسية تواصل إخفاء ضعف الأسهم الصغيرة للجلسة ${ordinalAr(n)}.`
      : 'قوة المؤشرات الرئيسية تخفي ضعف الأسهم الصغيرة في هذه الجلسة.',
  }),
  'growth-vs-duration': (n) => ({
    en: n >= 2
      ? `Growth equities keep absorbing building yield pressure for a ${ordinalEn(n).toLowerCase()} session — a divergence that resolves eventually.`
      : 'Growth equities are absorbing building yield pressure this session — a divergence that resolves eventually.',
    ar: n >= 2
      ? `أسهم النمو تواصل امتصاص ضغط العوائد المتصاعد للجلسة ${ordinalAr(n)} — انفصال لا يدوم عادة.`
      : 'أسهم النمو تمتص ضغط العوائد المتصاعد في هذه الجلسة — انفصال لا يدوم عادة.',
  }),
};

function buildMemoryObservations(sessions, shifts) {
  const observations = [];
  const latest = sessions[sessions.length - 1];
  if (!latest || latest.verified !== true) return observations;

  for (const shift of shifts) {
    const key = `${shift.dimension}:${shift.state}`;
    const template = STREAK_TEMPLATES[key];
    if (template && shift.sessions_in_state >= 2) {
      const text = template(shift.sessions_in_state);
      observations.push({
        kind: 'streak', dimension: shift.dimension, state: shift.state,
        sessions: shift.sessions_in_state, en: text.en, ar: text.ar,
      });
    }
  }

  // Divergence persistence: trailing consecutive sessions carrying the flag.
  for (const flag of latest.divergences || []) {
    let streak = 0;
    for (let i = sessions.length - 1; i >= 0; i -= 1) {
      if ((sessions[i].divergences || []).includes(flag)) { streak += 1; continue; }
      break;
    }
    const template = DIVERGENCE_TEMPLATES[flag];
    if (template) {
      const text = template(streak);
      observations.push({ kind: 'divergence', flag, sessions: streak, en: text.en, ar: text.ar });
    }
  }

  observations.sort((a, b) => (b.sessions || 0) - (a.sessions || 0));
  return observations.slice(0, 6);
}

// ── Cross-asset causal network ───────────────────────────────────────────────

// Institutional relationship map. "expected" describes the typical co-move:
// inverse = legs usually move opposite; direct = legs usually move together.
const CAUSAL_EDGES = [
  { id: 'yields-growth', legs: ['us10y', 'qqq'], expected: 'inverse', en: 'Rising yields pressure long-duration growth equities', ar: 'ارتفاع العوائد يضغط على أسهم النمو طويلة الأمد' },
  { id: 'yields-dollar', legs: ['us10y', 'dxy'], expected: 'direct', en: 'Yield support typically firms the dollar', ar: 'دعم العوائد يقوّي الدولار عادة' },
  { id: 'dollar-gold', legs: ['dxy', 'gold'], expected: 'inverse', en: 'A firming dollar typically pressures gold', ar: 'تقوّي الدولار يضغط على الذهب عادة' },
  { id: 'vix-equities', legs: ['vix', 'spy'], expected: 'inverse', en: 'Rising hedging demand pressures the equity tape', ar: 'ارتفاع طلب التحوط يضغط على حركة الأسهم' },
  { id: 'ai-growth', legs: ['nvda', 'qqq'], expected: 'direct', en: 'AI leadership drives the growth complex', ar: 'قيادة الذكاء الاصطناعي تحرك قطاع النمو' },
  { id: 'liquidity-beta', legs: ['btc', 'qqq'], expected: 'direct', en: 'Crypto trades as the liquidity beta of the growth complex', ar: 'الكريبتو يتحرك كبيتا السيولة لقطاع النمو' },
  { id: 'breadth-link', legs: ['spy', 'iwm'], expected: 'direct', en: 'Healthy advances carry small caps with the index', ar: 'الصعود الصحي يحمل الأسهم الصغيرة مع المؤشر' },
  { id: 'yields-bonds', legs: ['us10y', 'tlt'], expected: 'inverse', en: 'Rising yields mark down long-duration bonds', ar: 'ارتفاع العوائد يخفض السندات طويلة الأمد' },
];

const FLAT_BAND = 0.05;

function assessCausalNetwork(snapshot) {
  const moves = snapshot.sourced_moves || {};
  return CAUSAL_EDGES.map((edge) => {
    const [a, b] = edge.legs;
    const moveA = moves[a];
    const moveB = moves[b];
    if (!Number.isFinite(moveA) || !Number.isFinite(moveB)) {
      return { ...edge, state: 'unobserved', evidence: null };
    }
    if (Math.abs(moveA) < FLAT_BAND || Math.abs(moveB) < FLAT_BAND) {
      return { ...edge, state: 'neutral', evidence: { [a]: moveA, [b]: moveB } };
    }
    const sameDirection = (moveA > 0) === (moveB > 0);
    const confirming = edge.expected === 'direct' ? sameDirection : !sameDirection;
    return { ...edge, state: confirming ? 'confirming' : 'diverging', evidence: { [a]: moveA, [b]: moveB } };
  });
}

// ── Cognition signals ────────────────────────────────────────────────────────

function buildSignals(shifts, causalLinks, snapshot) {
  const signals = { confirmation: [], contradiction: [], fragility: [], exhaustion: [], liquidity: [], speculative: [] };
  const dims = snapshot.dims || {};
  const byDim = Object.fromEntries(shifts.map((s) => [s.dimension, s]));

  for (const link of causalLinks) {
    if (link.state === 'confirming') {
      signals.confirmation.push({ source: `causal:${link.id}`, en: link.en, ar: link.ar, evidence: link.evidence });
    } else if (link.state === 'diverging') {
      signals.contradiction.push({
        source: `causal:${link.id}`,
        en: `Divergence on the ${link.legs.join('/')} link — the usual relationship is not holding this session.`,
        ar: `انفصال في علاقة ${link.legs.join('/')} — العلاقة المعتادة لا تصمد في هذه الجلسة.`,
        evidence: link.evidence,
      });
    }
  }

  if (dims.breadth_state === 'confirming') {
    signals.confirmation.push({ source: 'breadth_state', en: 'Breadth confirms the advance beyond megacap leadership.', ar: 'اتساع السوق يؤكد الصعود خارج قيادة الأسهم الكبرى.' });
  }
  if (dims.breadth_state === 'deteriorating') {
    signals.contradiction.push({ source: 'breadth_state', en: 'Index strength is contradicted by deteriorating participation beneath the surface.', ar: 'قوة المؤشر تناقضها مشاركة متدهورة تحت السطح.' });
  }

  if (dims.market_fragility === 'building' || dims.market_fragility === 'elevated') {
    signals.fragility.push({ source: 'market_fragility', en: `Fragility composite reads ${dims.market_fragility} on verified volatility, breadth, and concentration inputs.`, ar: 'مؤشر الهشاشة المركّب يتصاعد استناداً إلى مدخلات موثقة للتقلب والاتساع والتركز.' });
  }
  const volShift = byDim.volatility_regime;
  if (volShift && volShift.state === 'compressed' && volShift.sessions_in_state >= 3) {
    signals.fragility.push({ source: 'volatility_regime', en: 'Extended volatility compression is storing instability — the longer it runs, the less it signals calm.', ar: 'انضغاط التقلب الممتد يخزّن عدم الاستقرار — وكلما طال أمده قلّت دلالته على الهدوء.' });
  }

  const momentumShift = byDim.momentum_concentration;
  if (momentumShift && momentumShift.state === 'narrow-megacap' && momentumShift.phase === 'extended') {
    signals.exhaustion.push({ source: 'momentum_concentration', en: 'Narrow megacap leadership is in an extended phase — historically a late-cycle leadership pattern.', ar: 'القيادة الضيقة للأسهم الكبرى في مرحلة ممتدة — نمط قيادة متأخر الدورة تاريخياً.' });
  }
  const aiShift = byDim.ai_concentration_risk;
  if (aiShift && aiShift.state === 'elevated' && aiShift.sessions_in_state >= 3) {
    signals.exhaustion.push({ source: 'ai_concentration_risk', en: 'Persistent elevated AI concentration raises exhaustion risk in the leadership complex.', ar: 'استمرار تركز الذكاء الاصطناعي المرتفع يرفع خطر إنهاك قطاع القيادة.' });
  }

  if (dims.liquidity_stress === 'tightening') {
    signals.liquidity.push({ source: 'liquidity_stress', en: 'Liquidity conditions are tightening — funding-sensitive assets carry the early burden.', ar: 'أوضاع السيولة تتشدد — والأصول الحساسة للتمويل تتحمل العبء المبكر.' });
  }
  const moves = snapshot.sourced_moves || {};
  if (dims.dollar_pressure === 'firming' && Number.isFinite(moves.btc) && moves.btc < -1) {
    signals.liquidity.push({ source: 'dollar+crypto', en: 'A firming dollar alongside soft crypto liquidity beta points to draining marginal liquidity.', ar: 'تقوّي الدولار مع ضعف بيتا سيولة الكريبتو يشير إلى انحسار السيولة الهامشية.', evidence: { dxy: moves.dxy, btc: moves.btc } });
  }

  if (dims.speculative_appetite === 'expanding') {
    signals.speculative.push({ source: 'speculative_appetite', en: 'Speculative appetite is expanding across the high-beta complex.', ar: 'شهية المضاربة تتوسع عبر الأصول عالية البيتا.' });
  }
  if (Number.isFinite(moves.nvda) && Math.abs(moves.nvda) >= 2.5) {
    signals.speculative.push({ source: 'nvda_move', en: `An outsized sourced AI-leadership move (${moves.nvda > 0 ? '+' : ''}${moves.nvda.toFixed(2)}%) marks active speculative positioning.`, ar: `تحرك موثق كبير في قيادة الذكاء الاصطناعي (${moves.nvda > 0 ? '+' : ''}${moves.nvda.toFixed(2)}%) يعكس تمركزاً مضاربياً نشطاً.`, evidence: { nvda: moves.nvda } });
  }

  for (const key of Object.keys(signals)) signals[key] = signals[key].slice(0, 3);
  return signals;
}

// ── Institutional alert layer ────────────────────────────────────────────────
// Alerts derive ONLY from verified state transitions and verified persistent
// streaks recorded in session history. Contextual intelligence — never trading
// signals, never fabricated urgency.

const ALERT_TYPES = [
  'volatility-expansion', 'breadth-deterioration', 'liquidity-warning',
  'defensive-rotation', 'dollar-shift', 'yield-pressure', 'momentum-exhaustion',
  'positioning-crowding', 'risk-escalation', 'macro-divergence',
];
const ALERT_SEVERITIES = ['watch', 'elevated', 'high'];

function buildAlerts(shifts, observations, verified) {
  if (!verified) return [];
  const alerts = [];
  const byDim = Object.fromEntries(shifts.map((s) => [s.dimension, s]));

  function push(type, severity, en, ar, derivedFrom) {
    alerts.push({
      id: `${type}-${TODAY}`,
      type,
      severity,
      date: TODAY,
      headline_en: en,
      headline_ar: ar,
      derived_from: derivedFrom,
    });
  }

  const vol = byDim.volatility_regime;
  if (vol && vol.phase === 'emerging' && ['elevated', 'stressed'].includes(vol.state) && vol.from && ['compressed', 'normal'].includes(vol.from.state)) {
    push('volatility-expansion', vol.state === 'stressed' ? 'high' : 'elevated',
      `Volatility expansion — regime moved from ${vol.from.state} to ${vol.state}.`,
      `توسع التقلب — انتقل النظام من ${vol.from.state === 'compressed' ? 'الانضغاط' : 'الوضع الطبيعي'} إلى ${vol.state === 'stressed' ? 'الضغط الشديد' : 'الارتفاع'}.`,
      [{ dimension: 'volatility_regime', from: vol.from.state, to: vol.state, date: TODAY }]);
  }

  const breadth = byDim.breadth_state;
  if (breadth && breadth.state === 'deteriorating' && breadth.sessions_in_state >= 2) {
    push('breadth-deterioration', breadth.sessions_in_state >= 3 ? 'elevated' : 'watch',
      `Breadth deterioration persists — ${breadth.sessions_in_state} consecutive verified sessions.`,
      `تدهور اتساع السوق مستمر — ${breadth.sessions_in_state} جلسات موثقة متتالية.`,
      [{ dimension: 'breadth_state', state: 'deteriorating', streak: breadth.sessions_in_state, date: TODAY }]);
  }

  const liq = byDim.liquidity_stress;
  if (liq && liq.phase === 'emerging' && liq.state === 'tightening' && liq.from) {
    push('liquidity-warning', 'elevated',
      `Liquidity warning — conditions shifted from ${liq.from.state} to tightening.`,
      'تحذير سيولة — انتقلت الأوضاع إلى التشدد.',
      [{ dimension: 'liquidity_stress', from: liq.from.state, to: 'tightening', date: TODAY }]);
  }

  const def = byDim.defensive_rotation;
  if (def && def.phase === 'emerging' && def.state === 'active' && def.from) {
    push('defensive-rotation', 'watch',
      'Defensive rotation activated — protection demand returned this session.',
      'تفعّل التناوب الدفاعي — عاد الطلب على الحماية في هذه الجلسة.',
      [{ dimension: 'defensive_rotation', from: def.from.state, to: 'active', date: TODAY }]);
  }

  const dollar = byDim.dollar_pressure;
  if (dollar && dollar.phase === 'emerging' && dollar.from && ['firming', 'easing'].includes(dollar.state) && ['firming', 'easing'].includes(dollar.from.state) && dollar.state !== dollar.from.state) {
    push('dollar-shift', 'watch',
      `Dollar pressure reversal — from ${dollar.from.state} to ${dollar.state}.`,
      `انعكاس ضغط الدولار — من ${dollar.from.state === 'firming' ? 'التقوّي' : 'التراجع'} إلى ${dollar.state === 'firming' ? 'التقوّي' : 'التراجع'}.`,
      [{ dimension: 'dollar_pressure', from: dollar.from.state, to: dollar.state, date: TODAY }]);
  }

  const duration = byDim.duration_pressure;
  if (duration && duration.state === 'building' && (duration.phase === 'emerging' || duration.sessions_in_state >= 3)) {
    push('yield-pressure', duration.sessions_in_state >= 3 ? 'elevated' : 'watch',
      duration.phase === 'emerging'
        ? 'Yield pressure building — duration stress returned this session.'
        : `Yield pressure persistent — building for ${duration.sessions_in_state} consecutive sessions.`,
      duration.phase === 'emerging'
        ? 'ضغط العوائد يتصاعد — عاد ضغط الحساسية للفائدة في هذه الجلسة.'
        : `ضغط العوائد مستمر — يتصاعد منذ ${duration.sessions_in_state} جلسات متتالية.`,
      [{ dimension: 'duration_pressure', state: 'building', streak: duration.sessions_in_state, date: TODAY }]);
  }

  const momentum = byDim.momentum_concentration;
  if (momentum && momentum.state === 'narrow-megacap' && momentum.sessions_in_state >= 3) {
    push('momentum-exhaustion', 'watch',
      `Momentum concentration extended — narrow megacap leadership for ${momentum.sessions_in_state} straight sessions.`,
      `تركز الزخم ممتد — قيادة ضيقة للأسهم الكبرى منذ ${momentum.sessions_in_state} جلسات متتالية.`,
      [{ dimension: 'momentum_concentration', state: 'narrow-megacap', streak: momentum.sessions_in_state, date: TODAY }]);
  }

  const ai = byDim.ai_concentration_risk;
  if (ai && ai.phase === 'emerging' && ai.state === 'elevated' && ai.from) {
    push('positioning-crowding', 'watch',
      'AI positioning crowding — concentration risk moved to elevated.',
      'ازدحام تمركزات الذكاء الاصطناعي — انتقلت مخاطر التركز إلى الارتفاع.',
      [{ dimension: 'ai_concentration_risk', from: ai.from.state, to: 'elevated', date: TODAY }]);
  }

  const fragility = byDim.market_fragility;
  if (fragility && fragility.phase === 'emerging' && fragility.state === 'elevated' && fragility.from) {
    push('risk-escalation', 'high',
      'Risk escalation — the fragility composite moved to elevated on stacked verified stress inputs.',
      'تصعيد المخاطر — انتقل مؤشر الهشاشة المركب إلى الارتفاع مع تراكم مدخلات ضغط موثقة.',
      [{ dimension: 'market_fragility', from: fragility.from.state, to: 'elevated', date: TODAY }]);
  }

  const persistentDivergence = observations.find((o) => o.kind === 'divergence' && o.sessions >= 2);
  if (persistentDivergence) {
    push('macro-divergence', 'watch',
      `Macro divergence persistent — ${persistentDivergence.flag.replace(/-/g, ' ')} for ${persistentDivergence.sessions} consecutive sessions.`,
      `انفصال ماكرو مستمر منذ ${persistentDivergence.sessions} جلسات متتالية.`,
      [{ divergence: persistentDivergence.flag, streak: persistentDivergence.sessions, date: TODAY }]);
  }

  const rank = { high: 0, elevated: 1, watch: 2 };
  alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return alerts.slice(0, 5);
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function buildCognition() {
  const pulseRaw = readJson(PULSE_PATH, null);
  const live = readJson(LIVE_PATH, {});
  const history = readJson(HISTORY_PATH, { sessions: [] });
  const timeline = readJson(TIMELINE_PATH, { events: [] });

  // Stale pulse degrades to unverified — cognition never extends a stale claim.
  const pulseAgeHours = pulseRaw && pulseRaw.updated_at
    ? (Date.now() - new Date(pulseRaw.updated_at).getTime()) / 3600000
    : Infinity;
  const pulse = pulseRaw && pulseAgeHours <= PULSE_MAX_AGE_HOURS ? pulseRaw : null;

  const snapshot = buildSessionSnapshot(pulse, live);
  const nextHistory = updateHistory(history, snapshot);
  const sessions = nextHistory.sessions;

  const shifts = detectRegimeShifts(sessions);
  const nextTimeline = updateTimeline(timeline, shifts);
  const observations = buildMemoryObservations(sessions, shifts);
  const causalLinks = assessCausalNetwork(snapshot);
  const signals = buildSignals(shifts, causalLinks, snapshot);
  const alerts = buildAlerts(shifts, observations, snapshot.verified);

  const verifiedShifts = shifts.filter((s) => s.phase !== 'unverified');
  const cognition = {
    version: '1.0',
    updated_at: snapshot.updated_at,
    run_date: TODAY,
    verified: snapshot.verified,
    sessions_tracked: sessions.length,
    regime_shifts: shifts,
    memory_observations: observations,
    causal_links: causalLinks,
    signals,
    alerts,
    timeline_tail: nextTimeline.events.slice(-6).reverse(),
    cognition_note: verifiedShifts.length
      ? `Cognition state — ${verifiedShifts.length}/${DIMENSIONS.length} dimensions verified; ${alerts.length} alert(s); ${observations.length} cross-session observation(s); ${nextTimeline.events.length} timeline event(s).`
      : 'No verified regime inputs this run. Cognition holds prior memory without extending any claim.',
  };
  return { cognition, history: nextHistory, timeline: nextTimeline };
}

// Compact prompt block for generators — the shared market brain context.
function cognitionPromptBlock() {
  const cognition = readJson(OUT_PATH, null);
  if (!cognition || !Array.isArray(cognition.regime_shifts)) return null;
  const lines = ['MARKET COGNITION (cross-session memory — evolve the story, never restart it):'];
  const active = cognition.regime_shifts.filter((s) => s.phase !== 'unverified' && s.phase !== 'baseline');
  for (const s of active.slice(0, 6)) {
    lines.push(`- ${s.dimension.replace(/_/g, ' ')}: ${s.state} [${s.phase}${s.sessions_in_state > 1 ? `, ${s.sessions_in_state} sessions` : ''}${s.from ? `, from ${s.from.state}` : ''}]`);
  }
  for (const o of (cognition.memory_observations || []).slice(0, 3)) lines.push(`- Memory: ${o.en}`);
  for (const a of (cognition.alerts || []).slice(0, 3)) lines.push(`- Alert (${a.severity}): ${a.headline_en}`);
  const diverging = (cognition.causal_links || []).filter((l) => l.state === 'diverging').slice(0, 2);
  for (const l of diverging) lines.push(`- Causal divergence: ${l.legs.join('/')} link not holding this session.`);
  const recent = (cognition.timeline_tail || []).slice(0, 3);
  if (recent.length) {
    lines.push('Recent regime transitions (how the market arrived here):');
    for (const e of recent) lines.push(`- ${e.date}: ${e.note}`);
  }
  if (lines.length === 1) return null;
  lines.push('Cognition rule: reference persistence and transitions only as stated above; never invent regime history.');
  return lines.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const { cognition, history, timeline } = buildCognition();
  console.log(`[cognition] ${cognition.cognition_note}`);
  const emerging = cognition.regime_shifts.filter((s) => s.phase === 'emerging');
  if (emerging.length) console.log(`[cognition] emerging transitions: ${emerging.map((s) => `${s.dimension} ${s.from ? s.from.state : '?'}→${s.state}`).join('; ')}`);
  for (const alert of cognition.alerts) console.log(`[cognition] ALERT (${alert.severity}): ${alert.headline_en}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
    fs.writeFileSync(TIMELINE_PATH, JSON.stringify(timeline, null, 2) + '\n', 'utf8');
    fs.writeFileSync(OUT_PATH, JSON.stringify(cognition, null, 2) + '\n', 'utf8');
    console.log('[cognition] wrote market-cognition.json, session-history.json, market-timeline.json');
  }
}

if (require.main === module) main();

module.exports = {
  buildCognition, cognitionPromptBlock,
  DIMENSIONS, ALERT_TYPES, ALERT_SEVERITIES, CAUSAL_EDGES,
  // Pure logic exports for tests and validators.
  detectRegimeShifts, buildMemoryObservations, assessCausalNetwork, buildSignals, buildAlerts,
};
