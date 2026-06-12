'use strict';

// Phase 75 — Macro Cognition Layer (autonomous institutional macro intelligence).
// Sits above the market cognition engine and turns its verified state into
// institutional reasoning:
//   - conviction engine        (confidence analysis of the current structure)
//   - contradiction engine     (structural contradictions, persisted per session)
//   - structural fragility     (trend-quality classification that evolves)
//   - pressure accumulation    (stored instability tracked across sessions)
//   - scenario engine          (conditional institutional scenarios — NOT forecasts)
//
// Honesty rules: every output derives from verified pulse dimensions, sourced
// co-moves recorded in session history, or persisted verified contradictions.
// Unverified sessions freeze accumulation and suppress conviction claims.
// Scenarios are conditional structures ("requires", "would confirm") — never
// probabilities or predictions.
//
// Self-persistent: previous macro-cognition.json carries pressure scores and
// contradiction streaks forward; re-runs on the same run_date recompute from
// the prior day's base instead of double-accumulating.
//
// Input:  data/intelligence/market-cognition.json
//         data/intelligence/session-history.json
//         data/intelligence/market-pulse.json
// Output: data/intelligence/macro-cognition.json
// Usage:  node tools/build-macro-cognition.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const COGNITION_PATH = path.join(ROOT, 'data', 'intelligence', 'market-cognition.json');
const HISTORY_PATH = path.join(ROOT, 'data', 'intelligence', 'session-history.json');
const PULSE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-pulse.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-cognition.json');

const TODAY = new Date().toISOString().slice(0, 10);
const STALE_HOURS = 48;
const PRESSURE_CAP = 5;

const CONVICTION_STATES = [
  'healthy-trend-structure', 'increasingly-confirmed', 'strengthening-conviction',
  'fragile-conviction', 'unconfirmed-move', 'deteriorating-confirmation',
  'unstable-continuation', 'crowded-positioning', 'unverified',
];

const FRAGILITY_CLASSES = [
  'healthy-trend', 'fragile-trend', 'unstable-calm', 'momentum-exhaustion',
  'crowded-trade', 'squeeze-behavior', 'liquidity-vacuum', 'defensive-undercurrent',
  'stable-structure', 'unverified',
];

const PRESSURE_TRACKS = [
  'volatility_pressure', 'liquidity_pressure', 'defensive_pressure',
  'speculative_pressure', 'concentration_pressure', 'yield_pressure',
];
const PRESSURE_STATES = ['accumulating', 'steady', 'releasing', 'dormant', 'unverified'];

const CONTRADICTION_IDS = [
  'index-vs-breadth', 'gold-vs-yields', 'dollar-vs-yields',
  'calm-vs-fragility', 'leadership-vs-participation', 'concentration-vs-breadth',
];

const SCENARIO_IDS = [
  'base-case', 'bullish-continuation', 'fragile-upside', 'defensive-rotation',
  'volatility-expansion', 'invalidation-path', 'catalyst-dependency',
];
const SCENARIO_STATUSES = ['primary', 'active', 'watch', 'monitor', 'dormant'];

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function fresh(artifact) {
  if (!artifact || !artifact.updated_at) return false;
  return (Date.now() - new Date(artifact.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

// ── Contradiction engine ─────────────────────────────────────────────────────
// Structural contradictions detected from verified dimensions and sourced
// co-moves; persisted across sessions so persistence can escalate them.

const CONTRADICTION_TEXT = {
  'index-vs-breadth': {
    en: 'Headline index strength against weak participation beneath the surface.',
    ar: 'قوة المؤشرات الرئيسية تقابلها مشاركة ضعيفة تحت السطح.',
  },
  'gold-vs-yields': {
    en: 'Gold strength holding against building yield pressure.',
    ar: 'قوة الذهب تصمد رغم ضغط العوائد المتصاعد.',
  },
  'dollar-vs-yields': {
    en: 'Dollar softness against rising yields — the rate-support link is not holding.',
    ar: 'ضعف الدولار رغم ارتفاع العوائد — رابط دعم الفائدة لا يصمد.',
  },
  'calm-vs-fragility': {
    en: 'Compressed volatility against building fragility — calm the structure does not confirm.',
    ar: 'تقلب منضغط مقابل هشاشة متصاعدة — هدوء لا تؤكده بنية السوق.',
  },
  'leadership-vs-participation': {
    en: 'Growth leadership extending while small-cap participation deteriorates.',
    ar: 'قيادة النمو تمتد بينما تتدهور مشاركة الأسهم الصغيرة.',
  },
  'concentration-vs-breadth': {
    en: 'Extreme AI concentration against deteriorating market breadth.',
    ar: 'تركز حاد في الذكاء الاصطناعي مقابل تدهور اتساع السوق.',
  },
};

function detectContradictions(dims, moves) {
  const found = [];
  const m = moves || {};
  if (Number.isFinite(m.spy) && m.spy > 0.2 && dims.breadth_state === 'deteriorating') found.push('index-vs-breadth');
  if (Number.isFinite(m.gold) && m.gold > 0.15 && dims.duration_pressure === 'building') found.push('gold-vs-yields');
  if (Number.isFinite(m.dxy) && Number.isFinite(m.us10y) && m.dxy < -0.3 && m.us10y > 0.5) found.push('dollar-vs-yields');
  if (dims.volatility_regime === 'compressed' && ['building', 'elevated'].includes(dims.market_fragility)) found.push('calm-vs-fragility');
  if (Number.isFinite(m.qqq) && Number.isFinite(m.iwm) && m.qqq > 0.3 && m.iwm < -0.3) found.push('leadership-vs-participation');
  if (dims.ai_concentration_risk === 'elevated' && dims.breadth_state === 'deteriorating') found.push('concentration-vs-breadth');
  return found;
}

function persistContradictions(activeIds, previous, verified) {
  const prevList = (previous && previous.contradictions) || [];
  const prevById = Object.fromEntries(prevList.map((c) => [c.id, c]));
  const sameDay = previous && previous.run_date === TODAY;

  if (!verified) {
    // Unverified session: hold prior contradictions without extending them.
    return prevList.map((c) => ({ ...c, active_today: false }));
  }
  return activeIds.map((id) => {
    const prev = prevById[id];
    const sessions = prev ? (sameDay ? prev.sessions : prev.sessions + 1) : 1;
    return {
      id,
      sessions,
      escalated: sessions >= 3,
      first_seen: prev ? prev.first_seen : TODAY,
      last_seen: TODAY,
      active_today: true,
      en: CONTRADICTION_TEXT[id].en,
      ar: CONTRADICTION_TEXT[id].ar,
    };
  });
}

// ── Pressure accumulation engine ─────────────────────────────────────────────
// Each track accumulates +1 per verified session where its condition holds,
// decays -1 when it verifiably does not, and freezes when unverified.

function pressureConditions(dims, moves) {
  const m = moves || {};
  return {
    volatility_pressure: dims.volatility_regime === 'compressed' ? 1
      : dims.volatility_regime === 'stressed' || dims.volatility_regime === 'elevated' ? -1
        : dims.volatility_regime === 'normal' ? 0 : null,
    liquidity_pressure: dims.liquidity_stress === 'tightening' || (dims.dollar_pressure === 'firming' && Number.isFinite(m.btc) && m.btc < -1) ? 1
      : dims.liquidity_stress === 'supportive' ? -1
        : dims.liquidity_stress === 'unverified' ? null : 0,
    defensive_pressure: dims.defensive_rotation === 'active' ? 1
      : dims.defensive_rotation === 'dormant' ? -1 : null,
    speculative_pressure: dims.speculative_appetite === 'expanding' ? 1
      : (dims.speculative_appetite === 'unverified' && Number.isFinite(m.nvda) && m.nvda < -1.5) ? -1
        : dims.speculative_appetite === 'unverified' ? null : 0,
    concentration_pressure: dims.momentum_concentration === 'narrow-megacap' || dims.ai_concentration_risk === 'elevated' ? 1
      : dims.momentum_concentration === 'broadening' ? -1
        : dims.momentum_concentration === 'unverified' && dims.ai_concentration_risk === 'unverified' ? null : 0,
    yield_pressure: dims.duration_pressure === 'building' ? 1
      : dims.duration_pressure === 'relaxing' ? -1
        : dims.duration_pressure === 'neutral' ? 0 : null,
  };
}

const PRESSURE_TEXT = {
  volatility_pressure: { en: 'Volatility pressure (stored compression)', ar: 'ضغط التقلب (انضغاط مخزّن)' },
  liquidity_pressure: { en: 'Liquidity stress accumulation', ar: 'تراكم ضغط السيولة' },
  defensive_pressure: { en: 'Defensive rotation pressure', ar: 'ضغط التناوب الدفاعي' },
  speculative_pressure: { en: 'Speculative appetite buildup', ar: 'تراكم شهية المضاربة' },
  concentration_pressure: { en: 'Momentum concentration intensity', ar: 'كثافة تركز الزخم' },
  yield_pressure: { en: 'Yield stress accumulation', ar: 'تراكم ضغط العوائد' },
};

function accumulatePressure(dims, moves, previous, verified) {
  const prevTracks = (previous && previous.pressure && previous.pressure.tracks) || {};
  const sameDay = previous && previous.run_date === TODAY;
  const baseOf = (key) => {
    const prev = prevTracks[key];
    if (!prev) return 0;
    // Same-day rerun: rebuild from the score before today's delta.
    return sameDay && Number.isFinite(prev.base_score) ? prev.base_score : prev.score || 0;
  };
  const conditions = verified ? pressureConditions(dims, moves) : {};
  const tracks = {};
  for (const key of PRESSURE_TRACKS) {
    const base = baseOf(key);
    const delta = verified ? conditions[key] : null;
    const score = delta === null || delta === undefined
      ? base
      : Math.max(0, Math.min(PRESSURE_CAP, base + delta));
    const state = delta === null || delta === undefined
      ? (base > 0 ? 'steady' : 'unverified')
      : delta > 0 ? 'accumulating' : delta < 0 ? (base > 0 ? 'releasing' : 'dormant') : (score > 0 ? 'steady' : 'dormant');
    tracks[key] = {
      score,
      base_score: base,
      state,
      en: PRESSURE_TEXT[key].en,
      ar: PRESSURE_TEXT[key].ar,
    };
  }
  const elevated = PRESSURE_TRACKS.filter((k) => tracks[k].score >= 3);
  return {
    tracks,
    elevated,
    note: elevated.length
      ? `Stored pressure elevated on: ${elevated.map((k) => k.replace(/_/g, ' ')).join(', ')}.`
      : 'No pressure track has accumulated to an elevated level.',
  };
}

// ── Structural fragility model ───────────────────────────────────────────────
// Trend-quality classification that requires persistence (session streaks from
// the cognition engine) — fragility evolves, it does not appear instantly.

function classifyStructure(dims, moves, shiftsByDim, pressure, contradictions) {
  if (!dims || dims.volatility_regime === undefined) return { class: 'unverified', en: '', ar: '' };
  const m = moves || {};
  const streak = (dim) => (shiftsByDim[dim] && shiftsByDim[dim].sessions_in_state) || 0;
  const verifiedDims = Object.values(dims).filter((v) => typeof v === 'string' && v !== 'unverified').length;
  if (!verifiedDims) return { class: 'unverified', en: '', ar: '' };

  const candidates = [];
  if (dims.liquidity_stress === 'tightening' && ['elevated', 'stressed'].includes(dims.volatility_regime)) {
    candidates.push({ class: 'liquidity-vacuum', en: 'Liquidity vacuum — tightening funding conditions inside an elevated volatility regime.', ar: 'فراغ سيولة — أوضاع تمويل متشددة داخل نظام تقلب مرتفع.' });
  }
  if (dims.momentum_concentration === 'narrow-megacap' && streak('momentum_concentration') >= 3 && dims.ai_concentration_risk === 'elevated') {
    candidates.push({ class: 'crowded-trade', en: 'Crowded trade structure — narrow leadership and elevated AI concentration persisting across sessions.', ar: 'بنية صفقة مزدحمة — قيادة ضيقة وتركز مرتفع في الذكاء الاصطناعي يستمران عبر الجلسات.' });
  }
  if (dims.ai_concentration_risk === 'elevated' && streak('ai_concentration_risk') >= 3 && pressure.tracks.speculative_pressure.state === 'releasing') {
    candidates.push({ class: 'momentum-exhaustion', en: 'Momentum exhaustion — extended concentration while speculative appetite fades.', ar: 'إنهاك الزخم — تركز ممتد بينما تخفت شهية المضاربة.' });
  }
  if (dims.volatility_regime === 'compressed' && streak('volatility_regime') >= 3 && ['building', 'elevated'].includes(dims.market_fragility)) {
    candidates.push({ class: 'unstable-calm', en: 'Unstable calm — extended volatility compression sitting on building fragility.', ar: 'هدوء غير مستقر — انضغاط تقلب ممتد فوق هشاشة متصاعدة.' });
  }
  if (Number.isFinite(m.vix) && m.vix <= -5 && Number.isFinite(m.spy) && m.spy > 0.5 && dims.breadth_state === 'deteriorating') {
    candidates.push({ class: 'squeeze-behavior', en: 'Squeeze behavior — sharp volatility unwind lifting a thin tape.', ar: 'سلوك انضغاط مراكز — تفكيك حاد للتحوطات يرفع سوقاً ضيق المشاركة.' });
  }
  if (dims.defensive_rotation === 'active' && Number.isFinite(m.spy) && m.spy >= -0.2) {
    candidates.push({ class: 'defensive-undercurrent', en: 'Defensive undercurrent — protection demand active beneath a steady index.', ar: 'تيار دفاعي خفي — طلب على الحماية نشط تحت مؤشر مستقر.' });
  }
  if (['building', 'elevated'].includes(dims.market_fragility) && dims.breadth_state === 'deteriorating') {
    candidates.push({ class: 'fragile-trend', en: 'Fragile trend — the advance rests on deteriorating participation and stacking stress inputs.', ar: 'اتجاه هش — الصعود يرتكز على مشاركة متدهورة ومدخلات ضغط متراكمة.' });
  }
  if (dims.breadth_state === 'confirming' && ['contained', 'unverified'].includes(dims.market_fragility) && !contradictions.some((c) => c.active_today)) {
    candidates.push({ class: 'healthy-trend', en: 'Healthy trend structure — broad participation with no structural contradictions.', ar: 'بنية اتجاه صحية — مشاركة واسعة دون تناقضات هيكلية.' });
  }
  if (candidates.length) return candidates[0];
  return { class: 'stable-structure', en: 'Stable structure — no fragility pattern dominates the verified picture.', ar: 'بنية مستقرة — لا نمط هشاشة يهيمن على الصورة الموثقة.' };
}

// ── Conviction engine ────────────────────────────────────────────────────────
// Institutional confidence analysis — how confirmed is the current structure.
// NOT forecasting: it scores confirmation vs contradiction accumulation.

function deriveConviction(cognition, dims, contradictions, structure, pressure) {
  if (!cognition || cognition.verified !== true) {
    return {
      state: 'unverified',
      regime_confidence: 'unverified',
      confirmations: 0,
      contradictions: 0,
      en: 'Conviction analysis resumes with the next verified data cycle.',
      ar: 'يستأنف تحليل القناعة مع دورة البيانات الموثقة التالية.',
    };
  }
  const links = cognition.causal_links || [];
  const confirming = links.filter((l) => l.state === 'confirming').length;
  const diverging = links.filter((l) => l.state === 'diverging').length;
  const activeContradictions = contradictions.filter((c) => c.active_today);
  const escalated = activeContradictions.filter((c) => c.escalated);
  const confirmations = confirming + (dims.breadth_state === 'confirming' ? 1 : 0);
  const contradictionLoad = diverging + activeContradictions.length;

  const shifts = cognition.regime_shifts || [];
  const verifiedShifts = shifts.filter((s) => s.phase !== 'unverified');
  const avgStreak = verifiedShifts.length
    ? verifiedShifts.reduce((sum, s) => sum + s.sessions_in_state, 0) / verifiedShifts.length
    : 0;
  const regimeConfidence = verifiedShifts.length >= 7 && avgStreak >= 2.5 ? 'high'
    : verifiedShifts.length >= 4 ? 'moderate' : 'low';

  // Deterministic precedence: crowding > unstable calm > deterioration >
  // unconfirmed > healthy > improving > fragile.
  let state;
  let text;
  if (structure.class === 'crowded-trade'
    || (dims.momentum_concentration === 'narrow-megacap' && dims.ai_concentration_risk === 'elevated' && dims.speculative_appetite === 'expanding')) {
    state = 'crowded-positioning';
    text = { en: 'Positioning is crowded — leadership, concentration, and speculative appetite are stacked on the same trade.', ar: 'التمركزات مزدحمة — القيادة والتركز وشهية المضاربة متراكمة على الصفقة نفسها.' };
  } else if (structure.class === 'unstable-calm' || (pressure.tracks.volatility_pressure.score >= 3 && dims.volatility_regime === 'compressed')) {
    state = 'unstable-continuation';
    text = { en: 'Continuation is unstable — the advance rides stored volatility compression rather than confirmed participation.', ar: 'الاستمرارية غير مستقرة — الصعود يمتطي انضغاط تقلب مخزّناً لا مشاركة مؤكدة.' };
  } else if (escalated.length || contradictionLoad > confirmations) {
    state = 'deteriorating-confirmation';
    text = { en: `Confirmation is deteriorating — ${contradictionLoad} structural contradiction signal(s) against ${confirmations} confirmation(s).`, ar: `التأكيد يتدهور — ${contradictionLoad} إشارات تناقض هيكلي مقابل ${confirmations} إشارات تأكيد.` };
  } else if (activeContradictions.some((c) => c.id === 'index-vs-breadth') && confirmations <= 1) {
    state = 'unconfirmed-move';
    text = { en: 'The move is unconfirmed — index strength lacks participation and cross-asset confirmation.', ar: 'التحرك غير مؤكد — قوة المؤشر تفتقر إلى المشاركة والتأكيد عبر الأصول.' };
  } else if (confirmations >= 3 && activeContradictions.length === 0 && dims.breadth_state === 'confirming') {
    state = 'healthy-trend-structure';
    text = { en: 'Healthy trend structure — confirmations are broad and uncontested across the causal network.', ar: 'بنية اتجاه صحية — التأكيدات واسعة وغير متنازع عليها عبر الشبكة السببية.' };
  } else if (confirmations >= 2 && confirmations > contradictionLoad) {
    state = regimeConfidence === 'high' ? 'increasingly-confirmed' : 'strengthening-conviction';
    text = state === 'increasingly-confirmed'
      ? { en: 'The structure is increasingly confirmed — cross-asset links and regime persistence agree.', ar: 'البنية تزداد تأكيداً — روابط الأصول واستمرارية النظام متوافقتان.' }
      : { en: 'Conviction is strengthening — confirmations outweigh contradictions, with persistence still building.', ar: 'القناعة تتعزز — التأكيدات تفوق التناقضات مع استمرارية لا تزال تتكون.' };
  } else {
    state = 'fragile-conviction';
    text = { en: 'Conviction is fragile — the verified picture is mixed, with neither confirmation nor contradiction dominant.', ar: 'القناعة هشة — الصورة الموثقة متباينة، دون هيمنة للتأكيد أو التناقض.' };
  }
  return {
    state,
    regime_confidence: regimeConfidence,
    confirmations,
    contradictions: contradictionLoad,
    en: text.en,
    ar: text.ar,
  };
}

// ── Scenario engine ──────────────────────────────────────────────────────────
// Conditional institutional scenarios derived from cognition state. Every
// scenario is a structure with explicit confirmation/invalidation conditions —
// never a probability, never a prediction.

function buildScenarios(dims, conviction, structure, pressure, contradictions, catalysts, verified) {
  const nextCatalyst = (catalysts && catalysts[0]) || null;
  const scenarios = [];

  if (!verified) {
    scenarios.push({
      id: 'base-case', status: 'primary',
      en: 'Monitoring base case — regime inputs await the next sourced data cycle; no structural scenario is asserted.',
      ar: 'الحالة الأساسية للمراقبة — مدخلات النظام بانتظار دورة البيانات الموثقة التالية؛ لا سيناريو هيكلي مطروح.',
      derived_from: ['unverified_session'],
    });
    if (nextCatalyst) {
      scenarios.push({
        id: 'catalyst-dependency', status: 'monitor',
        en: `Catalyst dependency — the next verified read hinges on ${nextCatalyst.name}.`,
        ar: `اعتماد على المحفز — القراءة الموثقة التالية مرهونة بـ${nextCatalyst.name}.`,
        derived_from: ['calendar'], catalyst: nextCatalyst.name,
      });
    }
    return scenarios;
  }

  const activeContradictions = contradictions.filter((c) => c.active_today);

  scenarios.push({
    id: 'base-case', status: 'primary',
    en: `Base case — ${structure.class.replace(/-/g, ' ')} with ${conviction.state.replace(/-/g, ' ')}; continuation requires breadth to hold and contradictions to stay contained.`,
    ar: `الحالة الأساسية — ${structure.ar ? structure.ar.split('—')[0].trim() : 'بنية مستقرة'} مع ${conviction.ar.split('—')[0].trim()}؛ تتطلب الاستمرارية صمود الاتساع واحتواء التناقضات.`,
    derived_from: ['structure', 'conviction'],
  });

  scenarios.push({
    id: 'bullish-continuation',
    status: dims.breadth_state === 'confirming' && activeContradictions.length === 0 ? 'active' : 'watch',
    en: 'Bullish continuation — would require confirming breadth, contained volatility, and no persistent contradictions; broad participation is the confirming signal.',
    ar: 'الاستمرار الصاعد — يتطلب اتساعاً مؤكِّداً وتقلباً محتوى وغياب تناقضات مستمرة؛ المشاركة الواسعة هي إشارة التأكيد.',
    derived_from: ['breadth_state', 'contradictions'],
  });

  scenarios.push({
    id: 'fragile-upside',
    status: ['fragile-trend', 'unstable-calm', 'crowded-trade'].includes(structure.class)
      || ['unconfirmed-move', 'unstable-continuation', 'crowded-positioning'].includes(conviction.state) ? 'active' : 'dormant',
    en: 'Fragile upside — the index can extend while participation thins; deteriorating breadth alongside new highs would confirm this path, broadening would invalidate it.',
    ar: 'صعود هش — يمكن للمؤشر أن يمتد بينما تضيق المشاركة؛ تدهور الاتساع مع قمم جديدة يؤكد هذا المسار، واتساع المشاركة يبطله.',
    derived_from: ['structure', 'breadth_state'],
  });

  scenarios.push({
    id: 'defensive-rotation',
    status: dims.defensive_rotation === 'active' || pressure.tracks.defensive_pressure.score >= 3 ? 'active'
      : pressure.tracks.defensive_pressure.state === 'accumulating' ? 'watch' : 'dormant',
    en: 'Defensive rotation — accumulating protection demand would rotate leadership toward defensives; gold bid plus widening credit-sensitive weakness would confirm.',
    ar: 'التناوب الدفاعي — تراكم الطلب على الحماية سيحوّل القيادة نحو الأصول الدفاعية؛ يؤكد ذلك إقبال على الذهب مع اتساع ضعف الأصول الحساسة للائتمان.',
    derived_from: ['defensive_rotation', 'defensive_pressure'],
  });

  scenarios.push({
    id: 'volatility-expansion',
    status: pressure.tracks.volatility_pressure.score >= 3 ? 'active'
      : dims.volatility_regime === 'compressed' ? 'watch'
        : ['elevated', 'stressed'].includes(dims.volatility_regime) ? 'monitor' : 'dormant',
    en: 'Volatility expansion — stored compression is the fuel; a catalyst that breaks the range would release it. VIX regime change is the confirming signal.',
    ar: 'توسع التقلب — الانضغاط المخزّن هو الوقود؛ ومحفز يكسر النطاق سيطلقه. تغير نظام VIX هو إشارة التأكيد.',
    derived_from: ['volatility_pressure', 'volatility_regime'],
  });

  scenarios.push({
    id: 'invalidation-path', status: 'monitor',
    en: `Invalidation path — the base case breaks if ${dims.breadth_state === 'confirming' ? 'breadth flips to deterioration' : 'breadth deterioration extends further'} while volatility leaves its current regime; that combination overrides every continuation scenario.`,
    ar: `مسار الإبطال — تنكسر الحالة الأساسية إذا ${dims.breadth_state === 'confirming' ? 'انقلب الاتساع إلى التدهور' : 'امتد تدهور الاتساع أكثر'} مع خروج التقلب من نظامه الحالي؛ هذا المزيج يلغي كل سيناريوهات الاستمرار.`,
    derived_from: ['breadth_state', 'volatility_regime'],
  });

  if (nextCatalyst) {
    scenarios.push({
      id: 'catalyst-dependency', status: 'monitor',
      en: `Catalyst dependency — ${nextCatalyst.name} is the next scheduled event capable of resolving the current contradictions; positioning ahead of it shapes the tape.`,
      ar: `اعتماد على المحفز — ${nextCatalyst.name} هو الحدث المجدول التالي القادر على حسم التناقضات الحالية؛ والتمركز قبله يشكّل حركة السوق.`,
      derived_from: ['calendar'], catalyst: nextCatalyst.name,
    });
  }
  return scenarios;
}

// ── Assembly ─────────────────────────────────────────────────────────────────

function buildMacroCognition() {
  const cognitionRaw = readJson(COGNITION_PATH, null);
  const history = readJson(HISTORY_PATH, { sessions: [] });
  const pulse = readJson(PULSE_PATH, null);
  const previous = readJson(OUT_PATH, null);

  const cognition = fresh(cognitionRaw) ? cognitionRaw : null;
  const sessions = history.sessions || [];
  const latest = sessions[sessions.length - 1] || null;
  const verified = Boolean(cognition && cognition.verified === true && latest && latest.verified === true);
  const dims = (latest && latest.dims) || {};
  const moves = (latest && latest.sourced_moves) || {};
  const shiftsByDim = Object.fromEntries(((cognition && cognition.regime_shifts) || []).map((s) => [s.dimension, s]));

  const activeIds = verified ? detectContradictions(dims, moves) : [];
  const contradictions = persistContradictions(activeIds, previous, verified);
  const pressure = accumulatePressure(dims, moves, previous, verified);
  const structure = verified
    ? classifyStructure(dims, moves, shiftsByDim, pressure, contradictions)
    : { class: 'unverified', en: 'Structure classification resumes with verified inputs.', ar: 'يستأنف تصنيف البنية مع المدخلات الموثقة.' };
  const conviction = deriveConviction(cognition, dims, contradictions, structure, pressure);
  const catalysts = (fresh(pulse) && pulse.catalysts_today) || [];
  const scenarios = buildScenarios(dims, conviction, structure, pressure, contradictions, catalysts, verified);

  const escalated = contradictions.filter((c) => c.escalated && c.active_today);
  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    run_date: TODAY,
    verified,
    conviction,
    contradictions,
    structure,
    pressure,
    scenarios,
    desk_focus: deriveDeskFocus(conviction, structure, pressure, escalated, verified),
    macro_note: verified
      ? `Macro cognition — conviction: ${conviction.state}; structure: ${structure.class}; contradictions active: ${contradictions.filter((c) => c.active_today).length} (${escalated.length} escalated); elevated pressure tracks: ${pressure.elevated.length}.`
      : 'Macro cognition holding prior state — no verified inputs this run.',
  };
}

// Adaptive homepage focus: which desk should lead and why (derived, honest).
function deriveDeskFocus(conviction, structure, pressure, escalated, verified) {
  if (!verified) return { focus: 'monitoring', reason_en: 'awaiting verified data cycle', reason_ar: 'بانتظار دورة بيانات موثقة' };
  if (escalated.length) return { focus: 'contradictions', reason_en: 'persistent structural contradictions', reason_ar: 'تناقضات هيكلية مستمرة' };
  if (['liquidity-vacuum', 'unstable-calm', 'squeeze-behavior'].includes(structure.class)) {
    return { focus: 'risk', reason_en: `structure: ${structure.class.replace(/-/g, ' ')}`, reason_ar: 'بنية سوق هشة' };
  }
  if (conviction.state === 'crowded-positioning' || structure.class === 'crowded-trade') {
    return { focus: 'concentration', reason_en: 'crowded positioning', reason_ar: 'تمركزات مزدحمة' };
  }
  if (pressure.elevated.length >= 2) return { focus: 'pressure', reason_en: 'multiple pressure tracks elevated', reason_ar: 'مسارات ضغط متعددة مرتفعة' };
  if (structure.class === 'defensive-undercurrent') return { focus: 'macro', reason_en: 'defensive undercurrent', reason_ar: 'تيار دفاعي خفي' };
  return { focus: 'balanced', reason_en: 'no dominant stress pattern', reason_ar: 'لا نمط ضغط مهيمن' };
}

// Compact prompt block for generators — institutional reasoning context.
function macroCognitionPromptBlock() {
  const macro = readJson(OUT_PATH, null);
  if (!macro || !macro.conviction) return null;
  if (macro.verified !== true) return null;
  const lines = ['MACRO COGNITION (institutional confidence analysis — NOT forecasts; frame as conditional structures):'];
  lines.push(`- Conviction: ${macro.conviction.state.replace(/-/g, ' ')} (${macro.conviction.confirmations} confirmations vs ${macro.conviction.contradictions} contradiction signals; regime confidence ${macro.conviction.regime_confidence})`);
  lines.push(`- Structure: ${macro.structure.class.replace(/-/g, ' ')} — ${macro.structure.en}`);
  for (const c of macro.contradictions.filter((x) => x.active_today).slice(0, 3)) {
    lines.push(`- Contradiction (${c.sessions} session${c.sessions > 1 ? 's' : ''}${c.escalated ? ', escalated' : ''}): ${c.en}`);
  }
  const elevated = (macro.pressure && macro.pressure.elevated) || [];
  if (elevated.length) lines.push(`- Stored pressure elevated: ${elevated.map((k) => k.replace(/_/g, ' ')).join('; ')}`);
  const activeScenarios = (macro.scenarios || []).filter((s) => ['primary', 'active'].includes(s.status)).slice(0, 3);
  for (const s of activeScenarios) lines.push(`- Scenario [${s.status}]: ${s.en}`);
  lines.push('Scenario rule: scenarios are conditional structures with confirmation/invalidation paths — never probabilities, never predictions.');
  return lines.join('\n');
}

function main() {
  const write = process.argv.includes('--write');
  const macro = buildMacroCognition();
  console.log(`[macro-cognition] ${macro.macro_note}`);
  console.log(`[macro-cognition] desk_focus=${macro.desk_focus.focus} (${macro.desk_focus.reason_en})`);
  for (const s of macro.scenarios.filter((x) => x.status === 'active')) console.log(`[macro-cognition] scenario active: ${s.id}`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(macro, null, 2) + '\n', 'utf8');
    console.log('[macro-cognition] wrote data/intelligence/macro-cognition.json');
  }
}

if (require.main === module) main();

module.exports = {
  buildMacroCognition, macroCognitionPromptBlock,
  CONVICTION_STATES, FRAGILITY_CLASSES, PRESSURE_TRACKS, PRESSURE_STATES,
  CONTRADICTION_IDS, SCENARIO_IDS, SCENARIO_STATUSES,
  // Pure logic exports for tests and validators.
  detectContradictions, persistContradictions, accumulatePressure,
  classifyStructure, deriveConviction, buildScenarios, deriveDeskFocus,
};
