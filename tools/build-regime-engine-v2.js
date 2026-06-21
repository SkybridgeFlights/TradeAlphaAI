'use strict';

/**
 * build-regime-engine-v2.js — Phase 68 Part A
 *
 * Classifies the current macro regime across 7 dimensions using all
 * available intelligence sources. Falls back to "uncertain" with low
 * confidence whenever evidence is insufficient.
 *
 * Output: data/intelligence/regime-engine-v2.json
 *
 * Usage: node tools/build-regime-engine-v2.js [--write] [--dry-run]
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const PATHS = {
  calendar:      path.join(ROOT, 'data', 'economic-calendar.json'),
  context:       path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json'),
  reactionMemory:path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json'),
  transmission:  path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json'),
  ratePath:      path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json'),
  output:        path.join(ROOT, 'data', 'intelligence', 'regime-engine-v2.json'),
};

const WRITE   = process.argv.includes('--write');
const DRY_RUN = process.argv.includes('--dry-run');

main();

function main() {
  const context   = readJson(PATHS.context,        {});
  const ratePath  = readJson(PATHS.ratePath,       {});
  const calendar  = readJson(PATHS.calendar,       { events: [] });
  const reaction  = readJson(PATHS.reactionMemory, { event_reactions: [] });
  const transmission = readJson(PATHS.transmission, {});

  const dataQuality = resolveDataQuality(context);
  const freshness   = resolveFreshness(context);

  const regime = {
    schema_version: '2.0',
    generated_at:   new Date().toISOString(),
    data_quality:   dataQuality,
    freshness_score: freshness,
    classifications: {
      risk_appetite:      classifyRiskAppetite(context, dataQuality),
      inflation_regime:   classifyInflation(context, ratePath, calendar, dataQuality),
      rate_path:          classifyRatePath(ratePath, context, dataQuality),
      growth_regime:      classifyGrowth(context, ratePath, dataQuality),
      volatility_regime:  classifyVolatility(context, dataQuality),
      dollar_regime:      classifyDollar(context, transmission, dataQuality),
      duration_regime:    classifyDuration(context, ratePath, dataQuality),
    },
    summary: null,  // populated below
    upcoming_catalysts: extractCatalysts(calendar),
    transmission_signals: extractTransmissionSignals(transmission),
  };

  regime.summary = buildSummary(regime.classifications);

  if (WRITE && !DRY_RUN) {
    fs.mkdirSync(path.dirname(PATHS.output), { recursive: true });
    fs.writeFileSync(PATHS.output, JSON.stringify(regime, null, 2) + '\n', 'utf8');
    console.log(`[regime-engine-v2] Written: ${path.relative(ROOT, PATHS.output)}`);
  } else {
    console.log('[regime-engine-v2] Dry run — not written.');
    console.log(JSON.stringify(regime.summary, null, 2));
  }
}

// ── Risk appetite ─────────────────────────────────────────────────────────────

function classifyRiskAppetite(ctx, dq) {
  const vix       = safeGet(ctx, 'cross_asset.vix.level');
  const vixRegime = safeGet(ctx, 'cross_asset.vix.regime');
  const spyTrend  = safeGet(ctx, 'cross_asset.spy.trend');
  const breadth   = safeGet(ctx, 'breadth.breadth_quality');
  const rotation  = safeGet(ctx, 'breadth.sector_rotation');
  const evidence  = [];

  if (dq === 'none') return uncertain('risk_appetite', 'Insufficient live market data');

  let score = 0;     // positive → risk_on, negative → risk_off
  let evidenceCount = 0;

  if (vix !== null) {
    if (vix < 16) { score += 2; evidence.push(`VIX ${vix.toFixed(1)} — complacency level`); }
    else if (vix < 20) { score += 1; evidence.push(`VIX ${vix.toFixed(1)} — calm conditions`); }
    else if (vix > 25) { score -= 2; evidence.push(`VIX ${vix.toFixed(1)} — elevated fear`); }
    else if (vix > 22) { score -= 1; evidence.push(`VIX ${vix.toFixed(1)} — above average`); }
    else evidence.push(`VIX ${vix.toFixed(1)} — neutral range`);
    evidenceCount++;
  }

  if (spyTrend) {
    if (/uptrend/.test(spyTrend))   { score += 1; evidence.push(`S&P 500 ${spyTrend}`); }
    if (/downtrend/.test(spyTrend)) { score -= 1; evidence.push(`S&P 500 ${spyTrend}`); }
    evidenceCount++;
  }

  if (breadth) {
    if (breadth === 'broad')        { score += 1; evidence.push(`Broad participation: ${breadth}`); }
    if (breadth === 'narrow' || breadth === 'very-narrow') { score -= 1; evidence.push(`Narrow breadth: ${breadth}`); }
    evidenceCount++;
  }

  if (rotation) {
    if (rotation === 'growth-leadership') { score += 1; evidence.push('Growth sector leadership active'); }
    if (rotation === 'defensive-rotation') { score -= 1; evidence.push('Defensive rotation underway'); }
    evidenceCount++;
  }

  if (evidenceCount < 2) return uncertain('risk_appetite', 'Insufficient cross-asset evidence');

  const confidence = Math.min(85, 40 + (evidenceCount * 12));

  if (score >= 2) return classify('risk_on', confidence, evidence, dq,
    'Cross-asset signals favor risk appetite — equities bid, volatility contained.',
    'الإشارات المتعددة تدعم شهية المخاطرة — الأسهم مطلوبة والتقلب منخفض.');
  if (score <= -2) return classify('risk_off', confidence, evidence, dq,
    'Multiple signals point to risk aversion — elevated volatility, defensive rotation.',
    'إشارات متعددة تشير إلى النفور من المخاطرة — تقلب مرتفع ودوران دفاعي.');
  return classify('neutral', confidence, evidence, dq,
    'Mixed signals — no decisive risk-on or risk-off bias confirmed.',
    'إشارات متضاربة — لا يوجد تحيز حاسم نحو المخاطرة أو الابتعاد عنها.');
}

// ── Inflation regime ──────────────────────────────────────────────────────────

function classifyInflation(ctx, ratePath, calendar, dq) {
  const evidence = [];
  const fedBias  = safeGet(ratePath, 'fed_path.bias');
  const fedStance= safeGet(ratePath, 'fed_path.current_stance');
  const holdProb = safeGet(ratePath, 'fed_path.probability_scenarios.hold');
  const hikeProb = safeGet(ratePath, 'fed_path.probability_scenarios.hike_25bp');

  if (!fedBias && !fedStance) return uncertain('inflation_regime', 'Fed path data unavailable');

  const cpiEvents = (calendar.events || []).filter((e) =>
    /CPI|inflation/i.test(e.event_name || e.name || '')
  );

  if (fedBias === 'data_dependent') {
    evidence.push(`Fed stance: data-dependent — inflation trajectory unresolved`);
    if (holdProb && holdProb > 0.5) {
      evidence.push(`Hold probability: ${Math.round(holdProb * 100)}% — inflation not hot enough for hikes`);
    }
    if (cpiEvents.length) {
      evidence.push(`${cpiEvents.length} CPI event(s) in calendar window`);
    }
    const confidence = holdProb ? Math.round(35 + holdProb * 30) : 30;
    return classify('uncertain', confidence, evidence, dq,
      'Inflation trajectory unclear — Fed maintains data-dependent stance with no strong directional signal.',
      'مسار التضخم غير واضح — الاحتياطي الفيدرالي يحافظ على نهج مرتبط بالبيانات.');
  }

  if (/hike/.test(fedBias) || (hikeProb && hikeProb > 0.15)) {
    evidence.push(`Rate hike bias detected: ${fedBias}`);
    return classify('inflation_pressure', 65, evidence, dq,
      'Fed maintaining tightening bias — inflation above comfort zone.',
      'الاحتياطي الفيدرالي يحافظ على تحيز تشديدي — التضخم فوق مستوى الراحة.');
  }

  if (/cut/.test(fedBias)) {
    evidence.push(`Rate cut bias signals disinflation: ${fedBias}`);
    return classify('disinflation', 60, evidence, dq,
      'Fed cut bias signals softening inflation — disinflation trend gaining credibility.',
      'تحيز الاحتياطي الفيدرالي نحو الخفض يشير إلى تراجع التضخم.');
  }

  return uncertain('inflation_regime', `No clear inflation signal from Fed bias: ${fedBias}`);
}

// ── Rate path ─────────────────────────────────────────────────────────────────

function classifyRatePath(ratePath, ctx, dq) {
  const bias    = safeGet(ratePath, 'fed_path.bias');
  const stance  = safeGet(ratePath, 'fed_path.current_stance');
  const holdP   = safeGet(ratePath, 'fed_path.probability_scenarios.hold') || 0;
  const cutP    = (safeGet(ratePath, 'fed_path.probability_scenarios.cut_25bp') || 0)
                + (safeGet(ratePath, 'fed_path.probability_scenarios.cut_50bp') || 0);
  const hikeP   = safeGet(ratePath, 'fed_path.probability_scenarios.hike_25bp') || 0;
  const evidence = [];

  if (!bias && !stance) return uncertain('rate_path', 'Rate path data unavailable');

  evidence.push(`Fed bias: ${bias || stance}`);
  if (holdP)  evidence.push(`Hold: ${Math.round(holdP * 100)}%`);
  if (cutP)   evidence.push(`Cut: ${Math.round(cutP * 100)}%`);
  if (hikeP)  evidence.push(`Hike: ${Math.round(hikeP * 100)}%`);

  const confidence = holdP || cutP || hikeP ? Math.round(45 + Math.max(holdP, cutP, hikeP) * 40) : 40;

  if (hikeP > 0.20) {
    return classify('rate_hike_bias', confidence, evidence, dq,
      `Market pricing ${Math.round(hikeP * 100)}% probability of rate hike — tightening risk present.`,
      `السوق يسعّر احتمالية ${Math.round(hikeP * 100)}% لرفع الفائدة — مخاطر التشديد قائمة.`);
  }
  if (cutP > 0.25) {
    return classify('rate_cut_bias', confidence, evidence, dq,
      `Market pricing ${Math.round(cutP * 100)}% probability of rate cut — easing cycle anticipated.`,
      `السوق يسعّر احتمالية ${Math.round(cutP * 100)}% لخفض الفائدة — دورة تيسير متوقعة.`);
  }
  if (holdP > 0.55) {
    return classify('hold_bias', confidence, evidence, dq,
      `Market pricing ${Math.round(holdP * 100)}% hold probability — rates expected stable near-term.`,
      `السوق يسعّر احتمالية ${Math.round(holdP * 100)}% للثبات — الفائدة متوقعة مستقرة على المدى القريب.`);
  }
  if (bias === 'data_dependent') {
    return classify('hold_bias', 45, evidence, dq,
      'Data-dependent stance — no clear directional rate path signal.',
      'نهج مرتبط بالبيانات — لا توجد إشارة واضحة لمسار الفائدة.');
  }

  return uncertain('rate_path', 'Insufficient rate path signal clarity');
}

// ── Growth regime ─────────────────────────────────────────────────────────────

function classifyGrowth(ctx, ratePath, dq) {
  const breadth    = safeGet(ctx, 'breadth.breadth_quality');
  const rotation   = safeGet(ctx, 'breadth.sector_rotation');
  const spyTrend   = safeGet(ctx, 'cross_asset.spy.trend');
  const laborTrend = safeGet(ctx, 'macro.labor_trend');
  const evidence   = [];

  let bullSignals = 0, bearSignals = 0;

  if (breadth) {
    if (/broad|moderate/.test(breadth)) { bullSignals++; evidence.push(`Breadth: ${breadth}`); }
    if (/narrow/.test(breadth))         { bearSignals++; evidence.push(`Breadth: ${breadth}`); }
  }

  if (rotation) {
    if (rotation === 'growth-leadership' || rotation === 'broad-growth') {
      bullSignals++; evidence.push(`Rotation: ${rotation}`);
    }
    if (rotation === 'defensive-rotation') {
      bearSignals++; evidence.push(`Defensive rotation signal`);
    }
  }

  if (spyTrend) {
    if (/uptrend/.test(spyTrend))   { bullSignals++; evidence.push(`Equities: ${spyTrend}`); }
    if (/downtrend/.test(spyTrend)) { bearSignals++; evidence.push(`Equities: ${spyTrend}`); }
  }

  if (laborTrend && laborTrend !== 'unverified') {
    evidence.push(`Labor trend: ${laborTrend}`);
    if (/resilient|strong/.test(laborTrend)) bullSignals++;
    if (/weakening|soft/.test(laborTrend))   bearSignals++;
  }

  if (bullSignals === 0 && bearSignals === 0) {
    return uncertain('growth_regime', 'No growth indicators available');
  }

  const confidence = Math.min(80, 35 + (bullSignals + bearSignals) * 12);

  if (bullSignals > bearSignals + 1) {
    return classify('growth_resilience', confidence, evidence, dq,
      'Multiple breadth and rotation signals support continued economic resilience.',
      'إشارات الاتساع والدوران المتعددة تدعم استمرار المرونة الاقتصادية.');
  }
  if (bearSignals > bullSignals + 1) {
    return classify('growth_slowdown', confidence, evidence, dq,
      'Defensive rotation and narrow breadth signal growth deceleration.',
      'الدوران الدفاعي وضيق الاتساع يشيران إلى تباطؤ النمو.');
  }
  return classify('uncertain', Math.min(55, confidence), evidence, dq,
    'Growth signals are mixed — no clear expansion or contraction trend confirmed.',
    'إشارات النمو متضاربة — لم يتأكد اتجاه توسع أو انكماش واضح.');
}

// ── Volatility regime ─────────────────────────────────────────────────────────

function classifyVolatility(ctx, dq) {
  const vixLevel  = safeGet(ctx, 'cross_asset.vix.level');
  const vixChange = safeGet(ctx, 'cross_asset.vix.change_pct');
  const vixRegime = safeGet(ctx, 'cross_asset.vix.regime');
  const volRate   = safeGet(ctx, 'breadth.volatility_regime');
  const evidence  = [];

  if (vixLevel === null && !vixRegime) {
    return uncertain('volatility_regime', 'VIX data unavailable');
  }

  if (vixLevel !== null) evidence.push(`VIX: ${vixLevel.toFixed(1)}`);
  if (vixChange !== null) evidence.push(`VIX change: ${vixChange > 0 ? '+' : ''}${vixChange.toFixed(1)}%`);
  if (vixRegime) evidence.push(`VIX regime: ${vixRegime}`);
  if (volRate && volRate !== 'unverified') evidence.push(`Vol-rate state: ${volRate}`);

  const confidence = vixLevel !== null ? 75 : 45;

  if (vixLevel !== null) {
    if (vixLevel < 16) {
      return classify('volatility_compression', confidence, evidence, dq,
        `VIX at ${vixLevel.toFixed(1)} — deeply compressed. Complacency risk elevated.`,
        `VIX عند ${vixLevel.toFixed(1)} — مضغوط بشكل حاد. مخاطر الإفراط في الاطمئنان مرتفعة.`);
    }
    if (vixLevel < 20) {
      return classify('volatility_compression', confidence - 10, evidence, dq,
        `VIX at ${vixLevel.toFixed(1)} — below average. Orderly market conditions.`,
        `VIX عند ${vixLevel.toFixed(1)} — أقل من المتوسط. أوضاع سوق منظمة.`);
    }
    if (vixLevel >= 25) {
      return classify('volatility_expansion', confidence, evidence, dq,
        `VIX at ${vixLevel.toFixed(1)} — elevated. Increased hedging demand.`,
        `VIX عند ${vixLevel.toFixed(1)} — مرتفع. زيادة في طلب التحوط.`);
    }
    if (vixLevel >= 20) {
      return classify('volatility_expansion', confidence - 15, evidence, dq,
        `VIX at ${vixLevel.toFixed(1)} — above average. Event sensitivity elevated.`,
        `VIX عند ${vixLevel.toFixed(1)} — فوق المتوسط. حساسية مرتفعة للأحداث.`);
    }
  }

  return uncertain('volatility_regime', 'VIX level not available for precise classification');
}

// ── Dollar regime ─────────────────────────────────────────────────────────────

function classifyDollar(ctx, transmission, dq) {
  const dxyTrend  = safeGet(ctx, 'cross_asset.dxy.trend');
  const dxyChange = safeGet(ctx, 'cross_asset.dxy.change_pct');
  const evidence  = [];

  if (!dxyTrend || dxyTrend === 'unverified') {
    return uncertain('dollar_regime', 'DXY data unavailable');
  }

  evidence.push(`DXY trend: ${dxyTrend}`);
  if (dxyChange !== null) evidence.push(`DXY change: ${dxyChange > 0 ? '+' : ''}${dxyChange.toFixed(2)}%`);

  // Check transmission for dollar impact narratives
  const lib = transmission.transmission_library || {};
  const dollarTransmissions = Object.values(lib)
    .filter((t) => t.primary_channel === 'USD' || (t.asset_chain || []).some((a) => a.asset === 'DXY'));
  if (dollarTransmissions.length) {
    evidence.push(`${dollarTransmissions.length} transmission chain(s) involve DXY`);
  }

  const confidence = dxyChange !== null ? 65 : 50;

  if (/strong-uptrend|uptrend/.test(dxyTrend)) {
    return classify('dollar_strength', confidence, evidence, dq,
      'DXY in uptrend — dollar strength creating headwinds for risk assets and EM.',
      'الدولار في اتجاه صعودي — قوة الدولار تخلق عقبات للأصول الخطرة والأسواق الناشئة.');
  }
  if (/strong-downtrend|downtrend/.test(dxyTrend)) {
    return classify('dollar_weakness', confidence, evidence, dq,
      'DXY declining — dollar weakness supports commodities and international equities.',
      'الدولار في اتجاه هبوطي — ضعف الدولار يدعم السلع والأسهم الدولية.');
  }
  return classify('uncertain', 40, evidence, dq,
    'Dollar consolidating — directional conviction insufficient for regime classification.',
    'الدولار في مرحلة تماسك — قناعة الاتجاه غير كافية لتصنيف النظام.');
}

// ── Duration regime ───────────────────────────────────────────────────────────

function classifyDuration(ctx, ratePath, dq) {
  const yieldState = safeGet(ctx, 'macro.yield_curve_state');
  const spreadBps  = safeGet(ctx, 'macro.yield_spread_bps');
  const us10y      = safeGet(ctx, 'macro.us10y_yield');
  const bias       = safeGet(ratePath, 'fed_path.bias');
  const cutP       = (safeGet(ratePath, 'fed_path.probability_scenarios.cut_25bp') || 0)
                   + (safeGet(ratePath, 'fed_path.probability_scenarios.cut_50bp') || 0);
  const evidence   = [];

  if (!yieldState && !bias) return uncertain('duration_regime', 'Yield and rate path data unavailable');

  if (yieldState && yieldState !== 'unverified') evidence.push(`Yield curve: ${yieldState}`);
  if (spreadBps !== null) evidence.push(`2Y/10Y spread: ${spreadBps}bps`);
  if (us10y !== null) evidence.push(`10Y yield: ${us10y.toFixed(2)}%`);
  if (bias) evidence.push(`Fed bias: ${bias}`);
  if (cutP) evidence.push(`Cut probability: ${Math.round(cutP * 100)}%`);

  const confidence = evidence.length >= 3 ? 65 : 45;

  // Duration supportive: inverted/flat curve + easing bias
  const isSupportive = (
    (yieldState === 'inverted' || yieldState === 'flat')
    && (cutP > 0.2 || /cut/.test(bias))
  );

  // Duration pressure: steep curve + hike bias, or high 10Y yield
  const isPressured = (
    yieldState === 'steep'
    || (us10y !== null && us10y > 4.5)
    || /hike/.test(bias)
  );

  if (isSupportive) {
    return classify('duration_supportive', confidence, evidence, dq,
      'Inverted/flat yield curve with easing bias — long-duration assets benefit.',
      'منحنى عائد مقلوب/مسطح مع تحيز تيسيري — تستفيد أصول الأجل الطويل.');
  }
  if (isPressured) {
    return classify('duration_pressure', confidence, evidence, dq,
      'Elevated long yields or hike bias creating pressure on duration-sensitive assets.',
      'ارتفاع العوائد الطويلة أو التحيز نحو الرفع يضغط على الأصول الحساسة للمدة.');
  }
  return classify('uncertain', 40, evidence, dq,
    'Duration regime unclear — yield curve positioning and rate path signals mixed.',
    'نظام المدة غير واضح — إشارات وضع منحنى العائد ومسار الفائدة متضاربة.');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classify(label, confidence, evidence, dq, reason_en, reason_ar) {
  return {
    label,
    confidence: Math.round(Math.min(100, Math.max(0, confidence))),
    evidence: evidence.slice(0, 5),
    data_quality: dq,
    freshness_score: null,  // set at top level
    reason_en,
    reason_ar,
  };
}

function uncertain(dim, reason) {
  return {
    label: 'uncertain',
    confidence: 15,
    evidence: [reason],
    data_quality: 'insufficient',
    freshness_score: null,
    reason_en: `${dim}: ${reason}`,
    reason_ar:  `${dim}: بيانات غير كافية`,
  };
}

function resolveDataQuality(ctx) {
  const q = ctx && ctx.data_quality;
  if (q === 'live')       return 'live';
  if (q === 'cached')     return 'cached';
  if (q === 'structural') return 'structural';
  return 'none';
}

function resolveFreshness(ctx) {
  if (!ctx || !ctx.generated_at) return 0;
  const age = (Date.now() - Date.parse(ctx.generated_at)) / 3600000;
  if (age < 1)  return 100;
  if (age < 4)  return 85;
  if (age < 12) return 70;
  if (age < 24) return 50;
  if (age < 48) return 30;
  return 10;
}

function safeGet(obj, dotPath) {
  if (!obj) return null;
  let cur = obj;
  for (const key of dotPath.split('.')) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return null;
    cur = cur[key];
  }
  return cur === undefined ? null : cur;
}

function extractCatalysts(calendar) {
  const now = Date.now();
  const window = 7 * 86400000;
  return (calendar.events || [])
    .filter((e) => {
      const t = Date.parse(e.event_date || e.date || '');
      return t > now && t <= now + window;
    })
    .slice(0, 5)
    .map((e) => ({
      event: e.event_name || e.name || 'Unnamed event',
      date:  e.event_date || e.date || null,
      impact: e.impact || e.importance || 'medium',
    }));
}

function extractTransmissionSignals(transmission) {
  const lib = transmission.transmission_library || {};
  return Object.entries(lib)
    .slice(0, 6)
    .map(([trigger, def]) => ({
      trigger,
      channel: def.primary_channel || 'unknown',
      chain_length: (def.asset_chain || []).length,
    }));
}

function buildSummary(c) {
  const fmt = (key) => `${c[key].label} (${c[key].confidence}%)`;
  return {
    risk_appetite:    fmt('risk_appetite'),
    rate_path:        fmt('rate_path'),
    volatility_regime:fmt('volatility_regime'),
    growth_regime:    fmt('growth_regime'),
    inflation_regime: fmt('inflation_regime'),
    dollar_regime:    fmt('dollar_regime'),
    duration_regime:  fmt('duration_regime'),
    headline_en: buildHeadlineEn(c),
    headline_ar: buildHeadlineAr(c),
  };
}

function buildHeadlineEn(c) {
  const tone    = c.risk_appetite.label.replace(/_/g, ' ');
  const vol     = c.volatility_regime.label.replace(/_/g, ' ');
  const rate    = c.rate_path.label.replace(/_/g, ' ');
  return `Market tone: ${tone} · Volatility: ${vol} · Rate path: ${rate}`;
}

function buildHeadlineAr(c) {
  const toneMap = { risk_on: 'إقبال على المخاطرة', risk_off: 'نفور من المخاطرة', neutral: 'محايد', uncertain: 'غير مؤكد' };
  const volMap  = { volatility_compression: 'تقلب منخفض', volatility_expansion: 'تقلب مرتفع', uncertain: 'غير مؤكد' };
  const rateMap = { rate_hike_bias: 'تحيز للرفع', rate_cut_bias: 'تحيز للخفض', hold_bias: 'ثبات', uncertain: 'غير مؤكد' };
  return `نبرة السوق: ${toneMap[c.risk_appetite.label] || c.risk_appetite.label} · التقلب: ${volMap[c.volatility_regime.label] || c.volatility_regime.label} · مسار الفائدة: ${rateMap[c.rate_path.label] || c.rate_path.label}`;
}

function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
