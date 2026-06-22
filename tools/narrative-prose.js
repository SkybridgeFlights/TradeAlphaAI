'use strict';

/**
 * Narrative prose library — turns live market data into Bloomberg /
 * Reuters / Investing.com-style paragraphs in EN + AR.
 *
 * Every helper returns a single rendered <p class="market-copy"> string
 * (or '' when the underlying data is missing). The convention: no
 * placeholders, no "indeterminate" filler, no buy/sell language, no
 * forecasts. Articles compose only the paragraphs they have real data
 * for; nothing is invented to pad a section.
 *
 * Public API:
 *   composeLead(state, locale)
 *   composeRatesAndDollar(state, locale)
 *   composeVolatilityNote(state, locale)
 *   composeSectorRotation(state, locale)
 *   composeForwardLook(calendar, locale)
 *   composeWhatThisMeans(state, pulse, locale)
 *   composeRiskNote(state, pulse, locale)
 *   composeWhatToWatch(state, calendar, locale)
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ── Data loaders ──────────────────────────────────────────────────
function readJson(rel, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
  catch { return fallback; }
}
function loadLiveState()    { return readJson('data/live-market-state.json', {}); }
function loadPulse()        { return readJson('data/intelligence/market-pulse.json', {}); }
function loadCalendar()     { return readJson('data/economic-calendar.json', { events: [] }); }
function loadRegime()       { return readJson('data/market-regime-state.json', {}); }

// ── Formatting helpers ────────────────────────────────────────────
function fmtPct(n) {
  if (n == null || !isFinite(n)) return null;
  const sign = n >= 0 ? '+' : '';
  return `${sign}${Number(n).toFixed(2)}%`;
}
function fmtNum(n, digits) {
  if (n == null || !isFinite(n)) return null;
  const d = digits == null ? 2 : digits;
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtBps(deltaPct) {
  if (deltaPct == null || !isFinite(deltaPct)) return null;
  const sign = deltaPct >= 0 ? '+' : '';
  return `${sign}${Math.round(deltaPct * 100)} bps`;
}
function direction(changePct, en, ar) {
  if (changePct == null) return en === undefined ? null : { en: '', ar: '' };
  return changePct >= 0 ? { en: 'higher', ar: 'مرتفعة' } : { en: 'lower', ar: 'منخفضة' };
}
// Past-tense verbs in two grammatical genders so Arabic can agree
// with masculine subjects like مؤشر / صندوق and feminine subjects
// like أسهم / سندات when chained into a sentence.
function strongOrSoft(changePct) {
  if (changePct == null) return null;
  const m = Math.abs(changePct);
  if (m >= 1.5) return changePct >= 0
    ? { en: 'jumped',  ar_m: 'قفز',  ar_f: 'قفزت' }
    : { en: 'slid',    ar_m: 'تراجع', ar_f: 'تراجعت' };
  if (m >= 0.5) return changePct >= 0
    ? { en: 'gained',  ar_m: 'صعد',  ar_f: 'صعدت' }
    : { en: 'fell',    ar_m: 'انخفض', ar_f: 'انخفضت' };
  if (m >= 0.2) return changePct >= 0
    ? { en: 'edged up',   ar_m: 'ارتفع قليلاً', ar_f: 'ارتفعت قليلاً' }
    : { en: 'edged down', ar_m: 'تراجع قليلاً', ar_f: 'تراجعت قليلاً' };
  return changePct >= 0
    ? { en: 'finished slightly higher', ar_m: 'أغلق أعلى قليلاً', ar_f: 'أغلقت أعلى قليلاً' }
    : { en: 'finished slightly lower',  ar_m: 'أغلق أدنى قليلاً', ar_f: 'أغلقت أدنى قليلاً' };
}
function fmtPctAbs(n) { return fmtPct(n) && fmtPct(n).replace('+','').replace('-',''); }

function p(s) { return `<p class="market-copy">${esc(s)}</p>`; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// Pick locale-specific text from {en, ar} pairs.
function L(locale, en, ar) { return locale === 'ar' ? ar : en; }

// ── Lead paragraph ────────────────────────────────────────────────
// Concrete equity / volatility opening. Always concrete numbers when
// available, never fabricated. Returns '' when not enough live data.
function composeLead(state, locale) {
  const s = state || loadLiveState();
  const sp = (s.sp500       && s.sp500.change_pct);
  const nq = (s.nasdaq      && s.nasdaq.change_pct);
  const rt = (s.russell2000 && s.russell2000.change_pct);
  const vix = (s.vix && s.vix.value);
  const us10y = (s.us10y_yield && s.us10y_yield.value);

  if (sp == null && nq == null) return '';

  const spMove = strongOrSoft(sp);
  const nqMove = strongOrSoft(nq);
  const rtMove = strongOrSoft(rt);

  if (locale === 'ar') {
    // Arabic verb agrees with the (masculine) "مؤشر" subject. The
    // verb already carries direction, so we display the absolute
    // percentage without a sign to avoid awkward "تراجع 0.32-%".
    const sentences = [];
    if (sp != null && spMove) sentences.push(`${spMove.ar_m} مؤشر S&P 500 بنسبة ${fmtPctAbs(sp)}.`);
    if (nq != null && nqMove) sentences.push(`و${nqMove.ar_m} مؤشر ناسداك ${fmtPctAbs(nq)}.`);
    if (rt != null && rtMove) sentences.push(`فيما ${rtMove.ar_m} مؤشر راسل 2000 ${fmtPctAbs(rt)}.`);
    let sentence = sentences.join(' ');
    if (vix != null) {
      const vixState = vix < 15 ? 'عند مستوى منخفض' : vix < 20 ? 'ضمن مدى طبيعي' : vix < 30 ? 'مرتفع' : 'مرتفع بشكل ملحوظ';
      sentence += ` بقي مؤشر التذبذب VIX ${vixState} عند ${fmtNum(vix, 2)}`;
      if (us10y != null) sentence += `، فيما يتداول العائد على السندات الأمريكية لأجل عشر سنوات قرب ${fmtNum(us10y, 2)}%.`;
      else sentence += '.';
    } else if (us10y != null) {
      sentence += ` ويتداول العائد على السندات الأمريكية لأجل عشر سنوات قرب ${fmtNum(us10y, 2)}%.`;
    }
    return p(sentence);
  }

  // English — write each index move as its own sentence so verb tense
  // stays clean (avoid the awkward "with the Nasdaq fell" construction).
  const sentences = [];
  if (sp != null && spMove) sentences.push(`The S&P 500 ${spMove.en} ${fmtPct(sp)}.`);
  if (nq != null && nqMove) sentences.push(`The Nasdaq Composite ${nqMove.en} ${fmtPct(nq)}.`);
  if (rt != null && rtMove) sentences.push(`The Russell 2000 ${rtMove.en} ${fmtPct(rt)}.`);
  let sentence = sentences.join(' ');

  if (vix != null) {
    const vixState = vix < 15 ? 'compressed' : vix < 20 ? 'in its normal range' : vix < 30 ? 'elevated' : 'notably elevated';
    sentence += ` The VIX held ${vixState} at ${fmtNum(vix, 2)}`;
    if (us10y != null) sentence += `, while the 10-year Treasury yield traded near ${fmtNum(us10y, 2)}%.`;
    else sentence += '.';
  } else if (us10y != null) {
    sentence += ` The 10-year Treasury yield traded near ${fmtNum(us10y, 2)}%.`;
  }
  return p(sentence);
}

// ── Rates and Dollar ──────────────────────────────────────────────
function composeRatesAndDollar(state, locale) {
  const s = state || loadLiveState();
  const us10y = s.us10y_yield && s.us10y_yield.value;
  const us10yChg = s.us10y_yield && s.us10y_yield.change_pct;
  const dxy = s.dxy && s.dxy.value;
  const dxyChg = s.dxy && s.dxy.change_pct;
  const tlt = s.tlt && s.tlt.change_pct;

  if (us10y == null && dxy == null) return '';

  if (locale === 'ar') {
    const sentences = [];
    if (us10y != null) sentences.push(`استقر العائد على السندات الأمريكية لأجل 10 سنوات قرب ${fmtNum(us10y, 2)}%${us10yChg != null ? ` (${fmtPct(us10yChg)})` : ''}.`);
    if (tlt != null) {
      const tltMove = strongOrSoft(tlt);
      sentences.push(`و${tltMove.ar_m} صندوق TLT للسندات طويلة الأجل بنسبة ${fmtPctAbs(tlt)}.`);
    }
    if (dxy != null) sentences.push(`ولامس مؤشر الدولار DXY مستوى ${fmtNum(dxy, 2)}${dxyChg != null ? ` (${fmtPct(dxyChg)})` : ''}.`);
    let sentence = sentences.join(' ');
    if (dxyChg != null) {
      sentence += dxyChg > 0.2
        ? ' تثبّت الدولار يضغط عادةً على الأصول الحساسة للعملة كالذهب والأسواق الناشئة.'
        : dxyChg < -0.2
          ? ' ضعف الدولار يدعم تاريخياً الذهب والسلع والأسواق الناشئة.'
          : '';
    }
    return p(sentence);
  }

  const sentences = [];
  if (us10y != null) sentences.push(`The 10-year Treasury yield settled near ${fmtNum(us10y, 2)}%${us10yChg != null ? ` (${fmtPct(us10yChg)})` : ''}.`);
  if (tlt != null) sentences.push(`Long-duration TLT ${strongOrSoft(tlt).en} ${fmtPct(tlt)}.`);
  if (dxy != null) sentences.push(`The dollar index DXY tracked ${fmtNum(dxy, 2)}${dxyChg != null ? ` (${fmtPct(dxyChg)})` : ''}.`);
  let sentence = sentences.join(' ');
  if (dxyChg != null) {
    sentence += dxyChg > 0.2
      ? ' A firming dollar typically pressures currency-sensitive assets like gold and emerging markets.'
      : dxyChg < -0.2
        ? ' A softer dollar historically supports gold, commodities, and emerging-market equities.'
        : '';
  }
  return p(sentence);
}

// ── Volatility note ───────────────────────────────────────────────
function composeVolatilityNote(state, locale) {
  const s = state || loadLiveState();
  const vix = s.vix && s.vix.value;
  const vixChg = s.vix && s.vix.change_pct;
  if (vix == null) return '';

  const regimeEn = vix < 15 ? 'compressed' : vix < 20 ? 'normal' : vix < 30 ? 'elevated' : 'high';
  const regimeAr = vix < 15 ? 'منضغط' : vix < 20 ? 'طبيعي' : vix < 30 ? 'مرتفع' : 'عالٍ';
  const moveEn = vixChg == null ? '' : vixChg > 5 ? ' jumping ' : vixChg > 0 ? ' rising ' : vixChg < -5 ? ' dropping ' : ' easing ';
  const moveAr = vixChg == null ? '' : vixChg > 5 ? ' بقفزة ' : vixChg > 0 ? ' بارتفاع ' : vixChg < -5 ? ' بهبوط ' : ' بتراجع ';

  if (locale === 'ar') {
    let s2 = `يقرأ سوق التذبذب نظاماً ${regimeAr} مع VIX عند ${fmtNum(vix, 2)}`;
    if (vixChg != null) s2 += `${moveAr}${fmtPct(vixChg)}`;
    s2 += '. ';
    if (vix < 15) s2 += 'انخفاض التذبذب لا يساوي الأمان دائماً — السوق الهادئ قد يعكس توازناً حقيقياً أو غياباً مؤقتاً للحركة قبل محفز.';
    else if (vix < 20) s2 += 'هذا المدى يعكس عادةً مناخاً يمتص فيه السوق المفاجآت دون اضطراب كبير.';
    else if (vix < 30) s2 += 'ارتفاع التذبذب يشير إلى أن المستثمرين يدفعون علاوة أكبر للتأمين، وهو ما يحدث عادةً قبل أو خلال أحداث كبرى.';
    else s2 += 'مستوى التذبذب هذا يتطابق مع فترات اضطراب سوقي أو تموضع دفاعي حاد.';
    return p(s2);
  }
  let s2 = `Volatility is reading ${regimeEn} with the VIX at ${fmtNum(vix, 2)}`;
  if (vixChg != null) s2 += `,${moveEn}${fmtPct(vixChg)}`;
  s2 += '. ';
  if (vix < 15) s2 += 'Low volatility is not the same as safety — a quiet tape can reflect genuine balance or a temporary absence of force ahead of a catalyst.';
  else if (vix < 20) s2 += 'This range typically reflects a tape that absorbs surprises without major disruption.';
  else if (vix < 30) s2 += 'Elevated volatility means investors are paying a higher premium for insurance, which usually happens around or during major events.';
  else s2 += 'This volatility level matches periods of market turmoil or sharp defensive positioning.';
  return p(s2);
}

// ── Sector rotation ───────────────────────────────────────────────
function composeSectorRotation(state, locale) {
  const s = state || loadLiveState();
  const sectors = s.sector_etfs || {};
  const names = {
    XLK: { en: 'Technology', ar: 'التكنولوجيا' },
    XLF: { en: 'Financials', ar: 'المالية' },
    XLE: { en: 'Energy', ar: 'الطاقة' },
    XLU: { en: 'Utilities', ar: 'المرافق' },
    XLV: { en: 'Healthcare', ar: 'الرعاية الصحية' },
    XLI: { en: 'Industrials', ar: 'الصناعة' },
    XLRE:{ en: 'Real Estate', ar: 'العقارات' },
    XLP: { en: 'Consumer Staples', ar: 'السلع الاستهلاكية الأساسية' },
  };
  const rows = Object.entries(sectors)
    .filter(([_, q]) => q && typeof q.change_pct === 'number')
    .map(([sym, q]) => ({ sym, name: names[sym], chg: q.change_pct }))
    .filter((r) => r.name)
    .sort((a, b) => b.chg - a.chg);
  if (rows.length < 3) return '';

  const top = rows.slice(0, 2);
  const bot = rows.slice(-2).reverse();

  if (locale === 'ar') {
    const lead = top.map((r) => `${r.name.ar} ${fmtPct(r.chg)}`).join(' و');
    const lag  = bot.map((r) => `${r.name.ar} ${fmtPct(r.chg)}`).join(' و');
    return p(`بقيادة قطاعية، تصدّرت ${lead} الجلسة فيما تخلّفت ${lag}. هذا التباين يكشف ما إذا كانت قوة المؤشر واسعة أم ضيقة — وما إذا كان رأس المال يتدوّر إلى القيادة التقليدية الدورية أم يتحفّظ في القطاعات الدفاعية.`);
  }
  const lead = top.map((r) => `${r.name.en} ${fmtPct(r.chg)}`).join(' and ');
  const lag  = bot.map((r) => `${r.name.en} ${fmtPct(r.chg)}`).join(' and ');
  return p(`Sector leadership had ${lead} pacing the tape, while ${lag} lagged. The split reveals whether the index move was broad-based or narrow — and whether capital is rotating into cyclical leadership or hiding in defensive corners.`);
}

// ── Forward look from calendar ────────────────────────────────────
function composeForwardLook(calendar, locale) {
  const cal = calendar || loadCalendar();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (cal.events || [])
    .filter((e) => e.event_time >= today + 'T00:00:00Z' && e.importance === 'high')
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''))
    .slice(0, 3);
  if (upcoming.length === 0) return '';

  const fmtDate = (iso, ar) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    if (ar) return d.toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' });
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  if (locale === 'ar') {
    const items = upcoming.map((e) => `${e.event_name || e.type || 'حدث'} يوم ${fmtDate(e.event_time, true)}`).join('، و');
    return p(`أمام الأسواق من المحفزات القادمة: ${items}. هذه الإصدارات عالية الأهمية تاريخياً تحرّك العوائد والدولار وقطاعات حساسة كالتكنولوجيا والذهب، لذا التموضع قبلها وردّ الفعل بعدها يستحق المتابعة.`);
  }
  const items = upcoming.map((e) => `${e.event_name || e.type || 'event'} on ${fmtDate(e.event_time, false)}`).join(', and ');
  return p(`On the catalyst horizon: ${items}. These high-impact releases historically move yields, the dollar, and sensitive sectors like technology and gold, so positioning into the prints and reaction afterward both deserve attention.`);
}

// ── What this means (interpretation) ──────────────────────────────
function composeWhatThisMeans(state, pulse, locale) {
  const s = state || loadLiveState();
  const p2 = pulse || loadPulse();
  const dims = (p2 && p2.dimensions) || {};
  const verified = [];
  if (dims.volatility_regime && dims.volatility_regime !== 'unverified') verified.push({ k: 'volatility_regime', v: dims.volatility_regime });
  if (dims.dollar_pressure   && dims.dollar_pressure   !== 'unverified') verified.push({ k: 'dollar_pressure',   v: dims.dollar_pressure });
  if (dims.breadth_state     && dims.breadth_state     !== 'unverified') verified.push({ k: 'breadth_state',     v: dims.breadth_state });
  if (dims.ai_concentration_risk && dims.ai_concentration_risk !== 'unverified') verified.push({ k: 'ai_concentration_risk', v: dims.ai_concentration_risk });
  if (verified.length === 0) return '';

  const labelMap = {
    en: {
      volatility_regime: 'volatility regime', dollar_pressure: 'dollar pressure',
      breadth_state: 'market breadth', ai_concentration_risk: 'AI concentration risk',
      momentum_concentration: 'momentum concentration', market_fragility: 'market fragility',
      speculative_appetite: 'speculative appetite',
    },
    ar: {
      volatility_regime: 'نظام التذبذب', dollar_pressure: 'ضغط الدولار',
      breadth_state: 'اتساع السوق', ai_concentration_risk: 'مخاطر تركّز الذكاء الاصطناعي',
      momentum_concentration: 'تركّز الزخم', market_fragility: 'هشاشة السوق',
      speculative_appetite: 'الشهية المضاربية',
    }
  };
  const valueMap = {
    en: { normal: 'normal', elevated: 'elevated', firming: 'firming', easing: 'easing', confirming: 'confirming', diverging: 'diverging', expanding: 'expanding', building: 'building', balanced: 'balanced', mixed: 'mixed', high: 'high', low: 'low', compressed: 'compressed' },
    ar: { normal: 'طبيعي', elevated: 'مرتفع', firming: 'في تثبّت', easing: 'في تخفّف', confirming: 'مؤكِّد', diverging: 'متباعد', expanding: 'في توسع', building: 'في تنامٍ', balanced: 'متوازن', mixed: 'متباين', high: 'عالٍ', low: 'منخفض', compressed: 'منضغط' },
  };

  const facts = verified.map((d) => `${labelMap[locale][d.k] || d.k} ${valueMap[locale][d.v] || d.v}`).join(locale === 'ar' ? '، و' : ', ');
  if (locale === 'ar') {
    return p(`اللوحة الحالية: ${facts}. هذه ليست توقعات بل قراءة لما يقوله السوق عن نفسه اليوم. حين تتحرك مؤشرات الاتساع والدولار والتذبذب في اتجاه واحد، يكون رد فعل السوق على المفاجآت أنظف. وحين تتباعد، تتفتّت الصدمة عبر الأصول.`);
  }
  return p(`The current readout: ${facts}. These are not predictions — they describe what the tape is saying about itself right now. When breadth, the dollar, and volatility move in the same direction, the market absorbs surprises more cleanly; when they diverge, a shock fragments across asset classes.`);
}

// ── Risk / what could go wrong ────────────────────────────────────
function composeRiskNote(state, pulse, locale) {
  const s = state || loadLiveState();
  const vix = s.vix && s.vix.value;
  const p2 = pulse || loadPulse();
  const dims = (p2 && p2.dimensions) || {};
  const fragility = dims.market_fragility;
  const aiRisk    = dims.ai_concentration_risk;
  if (vix == null && !fragility && !aiRisk) return '';

  if (locale === 'ar') {
    const parts = [];
    if (fragility === 'building') parts.push('مؤشرات الهشاشة تتراكم بهدوء، ما يعني أن الصدمة التالية قد تجد سوقاً أقل قدرة على الامتصاص');
    if (aiRisk === 'elevated') parts.push('تركّز القيادة في أسماء الذكاء الاصطناعي يجعل المؤشر معلقاً بحفنة من الأسهم — تصحيح أي منها يتضخّم على مستوى المؤشر');
    if (vix != null && vix < 15) parts.push('انخفاض التذبذب الحالي يجعل علاوة المخاطر متدنّية، وهو ما يميل تاريخياً للتطبيع بحدّة لا بهدوء');
    if (parts.length === 0) return '';
    return p(`ما الذي قد ينقلب؟ ${parts.join('. و')}.`);
  }
  const parts = [];
  if (fragility === 'building') parts.push('Fragility indicators are quietly accumulating, which means the next shock could land on a market with less absorption capacity');
  if (aiRisk === 'elevated') parts.push('Leadership concentration in AI-linked names leaves the index hostage to a handful of stocks — any one of them correcting magnifies at the index level');
  if (vix != null && vix < 15) parts.push("The current low-volatility regime keeps risk premia compressed, and history shows these regimes tend to normalize sharply, not gently");
  if (parts.length === 0) return '';
  return p(`What could turn? ${parts.join('. And ')}.`);
}

// ── What to watch ─────────────────────────────────────────────────
function composeWhatToWatch(state, calendar, locale) {
  const s = state || loadLiveState();
  const cal = calendar || loadCalendar();
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (cal.events || [])
    .filter((e) => e.event_time >= today + 'T00:00:00Z')
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''))
    .slice(0, 1)[0];
  const us10y = s.us10y_yield && s.us10y_yield.value;
  const dxy = s.dxy && s.dxy.value;

  if (locale === 'ar') {
    const parts = [];
    if (upcoming) parts.push(`الحدث الأقرب: ${upcoming.event_name || upcoming.type}`);
    if (us10y != null) parts.push(`مراقبة عوائد العشر سنوات قرب ${fmtNum(us10y, 2)}% — اختراق أعلى يضغط على القطاعات الحساسة للنمو`);
    if (dxy != null)   parts.push(`ومستوى الدولار عند ${fmtNum(dxy, 2)} يحدّد اتجاه الذهب والأسواق الناشئة`);
    if (parts.length === 0) return '';
    return p(`ما يستحق المتابعة الآن: ${parts.join('، ')}.`);
  }
  const parts = [];
  if (upcoming) parts.push(`Next catalyst: ${upcoming.event_name || upcoming.type}`);
  if (us10y != null) parts.push(`watch the 10-year near ${fmtNum(us10y, 2)}% — a clean break higher pressures growth-sensitive sectors`);
  if (dxy != null)   parts.push(`the dollar at ${fmtNum(dxy, 2)} sets the direction for gold and emerging-market equities`);
  if (parts.length === 0) return '';
  return p(`What is worth watching now: ${parts.join('; ')}.`);
}

// ── Section wrapper ───────────────────────────────────────────────
function section(id, eyebrow, heading, bodyHtml) {
  if (!bodyHtml || !String(bodyHtml).trim()) return '';
  return `<section class="market-section" id="${esc(id)}"><div class="market-section-head"><span class="eyebrow">${esc(eyebrow)}</span><h2>${esc(heading)}</h2></div><div class="market-panel">${bodyHtml}</div></section>`;
}

// ── Compose a full narrative body ─────────────────────────────────
// Returns the concatenated HTML of all paragraphs that had live data.
// Articles can use this directly OR pick individual composeX helpers.
function composeFullBody(locale, opts) {
  const state = (opts && opts.state)    || loadLiveState();
  const pulse = (opts && opts.pulse)    || loadPulse();
  const cal   = (opts && opts.calendar) || loadCalendar();

  const sections = [];

  const lead = composeLead(state, locale);
  if (lead) sections.push(section('lead', L(locale,'Market read','قراءة السوق'),
                                 L(locale,'Where the tape closed','أين أغلق السوق'), lead));

  const rd = composeRatesAndDollar(state, locale);
  if (rd) sections.push(section('rates-dollar', L(locale,'Rates and dollar','العوائد والدولار'),
                                L(locale,'Rates and the dollar','العوائد والدولار'), rd));

  const vol = composeVolatilityNote(state, locale);
  if (vol) sections.push(section('volatility', L(locale,'Volatility','التذبذب'),
                                 L(locale,'What volatility is signaling','ما يشير إليه التذبذب'), vol));

  const sec = composeSectorRotation(state, locale);
  if (sec) sections.push(section('sectors', L(locale,'Sector leadership','القيادة القطاعية'),
                                 L(locale,'Sector leadership and laggards','القيادة القطاعية والمتأخرون'), sec));

  const meaning = composeWhatThisMeans(state, pulse, locale);
  if (meaning) sections.push(section('interpretation', L(locale,'Interpretation','التفسير'),
                                     L(locale,'What this means','ماذا يعني هذا'), meaning));

  const fwd = composeForwardLook(cal, locale);
  if (fwd) sections.push(section('forward', L(locale,'Catalysts ahead','المحفزات القادمة'),
                                 L(locale,'What is coming','ما هو قادم'), fwd));

  const risk = composeRiskNote(state, pulse, locale);
  if (risk) sections.push(section('risk', L(locale,'Risk','المخاطر'),
                                  L(locale,'What could turn','ما الذي قد ينقلب'), risk));

  const watch = composeWhatToWatch(state, cal, locale);
  if (watch) sections.push(section('watch', L(locale,'On watch','تحت المراقبة'),
                                   L(locale,'What to watch now','ما يستحق المتابعة الآن'), watch));

  return sections.join('\n');
}

module.exports = {
  composeLead,
  composeRatesAndDollar,
  composeVolatilityNote,
  composeSectorRotation,
  composeForwardLook,
  composeWhatThisMeans,
  composeRiskNote,
  composeWhatToWatch,
  composeFullBody,
  loadLiveState,
  loadPulse,
  loadCalendar,
  loadRegime,
  section,
  esc,
};
