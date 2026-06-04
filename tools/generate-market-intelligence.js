'use strict';

const { calculateConfidence, buildScenarios } = require('./calculate-market-confidence.js');

const FALLBACKS = {
  market_narrative: {
    en: 'Markets are being evaluated through a structural lens that considers policy expectations, earnings visibility, liquidity conditions, and investor risk appetite. This framework is useful for education because it separates broad context from short-term directional claims.',
    ar: 'تتم قراءة الأسواق من خلال إطار هيكلي يراعي توقعات السياسة النقدية ووضوح الأرباح وظروف السيولة وميل المستثمرين نحو المخاطرة. يفيد هذا الإطار تعليميا لأنه يفصل بين السياق العام والادعاءات الاتجاهية قصيرة الأجل.'
  },
  sector_narrative: {
    en: 'Sector leadership can change as macro conditions, earnings expectations, and positioning evolve. Technology, semiconductor, defensive, and cyclical groups may respond differently to the same market backdrop.',
    ar: 'قد تتغير قيادة القطاعات مع تطور الظروف الكلية وتوقعات الأرباح وتمركز المستثمرين. يمكن أن تستجيب قطاعات التكنولوجيا وأشباه الموصلات والقطاعات الدفاعية والدورية بطرق مختلفة للخلفية السوقية نفسها.'
  },
  volatility_interpretation: {
    en: 'Volatility should be treated as a measure of uncertainty rather than a prediction. Lower volatility can coexist with hidden risk, while elevated volatility can reflect caution, repositioning, or event sensitivity.',
    ar: 'ينبغي التعامل مع التقلب بوصفه مقياسا لعدم اليقين وليس توقعا. يمكن أن يتزامن انخفاض التقلب مع مخاطر غير ظاهرة، بينما قد يعكس ارتفاعه الحذر أو إعادة التمركز أو الحساسية تجاه الأحداث.'
  },
  macro_pressure: {
    en: 'The macro backdrop includes inflation trends, labor-market signals, rate expectations, growth data, and central-bank communication. These variables can influence how investors price risk across stocks, ETFs, and bonds.',
    ar: 'تشمل الخلفية الكلية اتجاهات التضخم وإشارات سوق العمل وتوقعات الفائدة وبيانات النمو وتواصل البنوك المركزية. قد تؤثر هذه المتغيرات في كيفية تسعير المستثمرين للمخاطر عبر الأسهم وصناديق المؤشرات والسندات.'
  },
  etf_rotation: {
    en: 'ETF rotation often reflects how investors compare growth exposure, defensive exposure, income strategies, and broad-market diversification as conditions change.',
    ar: 'غالبا ما يعكس التناوب بين صناديق المؤشرات كيفية مقارنة المستثمرين بين التعرض للنمو والتعرض الدفاعي واستراتيجيات الدخل والتنويع الواسع مع تغير الظروف.'
  },
  ai_semiconductor_context: {
    en: 'AI and semiconductor themes remain tied to infrastructure spending cycles, supply-chain capacity, valuation sensitivity, and earnings guidance. These factors support educational analysis without implying a guaranteed direction.',
    ar: 'تظل موضوعات الذكاء الاصطناعي وأشباه الموصلات مرتبطة بدورات الإنفاق على البنية التحتية وقدرة سلاسل التوريد وحساسية التقييم وتوجيهات الأرباح. تدعم هذه العوامل التحليل التعليمي دون الإيحاء باتجاه مضمون.'
  }
};

function generateIntelligence(liveMarket, calendar, regime) {
  const live = liveMarket && liveMarket.metadata && liveMarket.metadata.status === 'live';
  const state = live ? liveMarket : {};
  const regimeState = (regime && regime.state) || {};
  const today = new Date().toISOString().slice(0, 10);

  const upcomingEvents = (calendar.events || [])
    .filter((event) => event.date >= today && event.status === 'confirmed' && event.source_url)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const nearest = upcomingEvents[0];
  const proximityDays = nearest ? Math.floor((new Date(`${nearest.date}T00:00:00Z`) - Date.now()) / 86400000) : null;

  const vix = valueOf(state.vix);
  const sp500 = valueOf(state.sp500);
  const nasdaq = valueOf(state.nasdaq);
  const us10y = valueOf(state.us10y_yield);
  const dxy = valueOf(state.dxy);
  const aiMom = valueOf(state.ai_sector_momentum);
  const semiMom = valueOf(state.semiconductor_momentum);
  const marketRegime = valueOf(state.market_regime) || regimeState.growth_value_bias || null;
  const riskState = valueOf(state.risk_state) || regimeState.risk_regime || null;
  const volatState = valueOf(state.volatility_state) || regimeState.volatility_regime || null;

  const confidence = calculateConfidence({
    vix,
    volatilityState: volatState,
    riskState,
    aiMomentum: aiMom,
    marketRegime,
    eventProximityDays: proximityDays
  });

  const rawScenarios = buildScenarios({
    vix,
    aiMomentum: aiMom,
    semiconductorMomentum: semiMom,
    us10yYield: us10y,
    marketRegime,
    upcomingEvents,
    confidence
  });

  const sourced = [
    live && sp500 !== null && 'sp500',
    live && nasdaq !== null && 'nasdaq',
    live && vix !== null && 'vix',
    live && us10y !== null && 'us10y_yield',
    live && dxy !== null && 'dxy',
    live && aiMom !== null && 'ai_sector_momentum',
    live && semiMom !== null && 'semiconductor_momentum'
  ].filter(Boolean);

  return {
    confidence,
    scenarios: buildBilingualScenarios(rawScenarios),
    sourced_fields: sourced,
    data_completeness: sourced.length >= 6 ? 'full' : sourced.length >= 3 ? 'partial' : 'structural',
    narratives: {
      market_narrative: buildMarketNarrative(live, sp500, nasdaq, vix, us10y, dxy, confidence),
      sector_narrative: buildSectorNarrative(live, aiMom, semiMom),
      volatility_interpretation: buildVolatilityInterp(live, vix),
      macro_pressure: buildMacroPressure(upcomingEvents, proximityDays),
      etf_rotation: buildEtfRotation(live, aiMom, marketRegime, us10y),
      ai_semiconductor_context: buildAiSemiContext(live, aiMom, semiMom)
    },
    upcoming_events: upcomingEvents
  };
}

function buildMarketNarrative(live, sp500, nasdaq, vix, us10y, dxy, confidence) {
  if (!live) return FALLBACKS.market_narrative;
  const en = [];
  const ar = [];
  if (sp500 !== null) { en.push(`S&P 500 near ${sp500}`); ar.push(`مؤشر S&P 500 قرب ${sp500}`); }
  if (nasdaq !== null) { en.push(`NASDAQ near ${nasdaq}`); ar.push(`مؤشر NASDAQ قرب ${nasdaq}`); }
  if (vix !== null) { en.push(`VIX near ${vix}`); ar.push(`مؤشر VIX قرب ${vix}`); }
  if (us10y !== null) { en.push(`the US 10-year yield near ${us10y}%`); ar.push(`عائد السندات الأمريكية لعشر سنوات قرب ${us10y}%`); }
  if (dxy !== null) { en.push(`DXY near ${dxy}`); ar.push(`مؤشر الدولار DXY قرب ${dxy}`); }
  if (!en.length) return FALLBACKS.market_narrative;
  return {
    en: `With ${en.join(', ')}, the current tone can be framed as ${confidence.label}. This remains conditional context, not a forecast.`,
    ar: `مع ${ar.join(' و')}, يمكن تأطير نبرة السوق الحالية بوصفها ${confidenceLabelAr(confidence.label)}. يبقى ذلك سياقا مشروطا وليس توقعا.`
  };
}

function buildSectorNarrative(live, aiMom, semiMom) {
  if (!live || (aiMom === null && semiMom === null)) return FALLBACKS.sector_narrative;
  const en = [];
  const ar = [];
  if (aiMom && aiMom !== 'unverified') { en.push(`AI momentum appears ${aiMom}`); ar.push(`يبدو زخم الذكاء الاصطناعي ${momentumAr(aiMom)}`); }
  if (semiMom && semiMom !== 'unverified') { en.push(`semiconductor momentum appears ${semiMom}`); ar.push(`يبدو زخم أشباه الموصلات ${momentumAr(semiMom)}`); }
  if (!en.length) return FALLBACKS.sector_narrative;
  return {
    en: `${en.join(' and ')}. These are educational signals that can change as earnings expectations and macro conditions evolve.`,
    ar: `${ar.join(' و')}. هذه إشارات تعليمية قد تتغير مع تطور توقعات الأرباح والظروف الكلية.`
  };
}

function buildVolatilityInterp(live, vix) {
  if (!live || vix === null) return FALLBACKS.volatility_interpretation;
  if (vix > 30) return {
    en: `VIX near ${vix} indicates elevated stress and a higher sensitivity to events.`,
    ar: `يشير مؤشر VIX قرب ${vix} إلى ضغط مرتفع وحساسية أكبر تجاه الأحداث.`
  };
  if (vix > 20) return {
    en: `VIX near ${vix} indicates above-average volatility and a need for careful interpretation of risk signals.`,
    ar: `يشير مؤشر VIX قرب ${vix} إلى تقلب فوق المتوسط وحاجة إلى تفسير حذر لإشارات المخاطر.`
  };
  return {
    en: `VIX near ${vix} suggests calmer conditions, although low volatility can still change quickly.`,
    ar: `يشير مؤشر VIX قرب ${vix} إلى ظروف أكثر هدوءا، مع أن التقلب المنخفض قد يتغير بسرعة.`
  };
}

function buildMacroPressure(events, proximityDays) {
  if (!events.length) return FALLBACKS.macro_pressure;
  const next = events[0];
  const enWindow = proximityDays !== null && proximityDays <= 3 ? 'near-term' : 'upcoming';
  const arWindow = proximityDays !== null && proximityDays <= 3 ? 'قريب' : 'قادم';
  return {
    en: `${next.name} on ${next.date} is the nearest sourced ${enWindow} macro event. Such releases can affect volatility in either direction, so the outlook should remain conditional.`,
    ar: `يعد ${next.name} بتاريخ ${next.date} أقرب حدث كلي موثق و${arWindow}. يمكن لهذه الإصدارات أن تؤثر في التقلب في أي اتجاه، لذلك ينبغي أن يبقى التحليل مشروطا.`
  };
}

function buildEtfRotation(live, aiMom, marketRegime, us10y) {
  if (!live) return FALLBACKS.etf_rotation;
  const en = [];
  const ar = [];
  if (marketRegime === 'risk-off') { en.push('defensive ETF categories may receive more attention'); ar.push('قد تحظى فئات صناديق المؤشرات الدفاعية بمزيد من الاهتمام'); }
  if (typeof us10y === 'number' && us10y > 4.5) { en.push('higher yields may affect growth-oriented ETF valuations'); ar.push('قد تؤثر العوائد المرتفعة في تقييمات صناديق المؤشرات الموجهة للنمو'); }
  if (aiMom === 'bullish') { en.push('technology ETF exposure may remain sensitive to AI earnings expectations'); ar.push('قد يبقى تعرض صناديق التكنولوجيا حساسا لتوقعات أرباح الذكاء الاصطناعي'); }
  if (!en.length) return FALLBACKS.etf_rotation;
  return {
    en: `ETF context: ${en.join('; ')}. This is a research framework rather than a recommendation.`,
    ar: `سياق صناديق المؤشرات: ${ar.join('؛ ')}. هذا إطار بحثي وليس توصية.`
  };
}

function buildAiSemiContext(live, aiMom, semiMom) {
  if (!live || (aiMom === null && semiMom === null)) return FALLBACKS.ai_semiconductor_context;
  return buildSectorNarrative(live, aiMom, semiMom);
}

function buildBilingualScenarios(raw) {
  const source = raw && raw.length ? raw : [
    'If macro conditions remain stable, broad-market participation could remain balanced while leadership rotates across sectors.',
    'If volatility rises, defensive positioning and liquidity awareness could become more important in educational portfolio research.',
    'If earnings visibility improves, growth-oriented themes could receive renewed attention while still carrying valuation risk.'
  ];
  return source.slice(0, 3).map((text, index) => ({
    en: String(text),
    ar: [
      'إذا بقيت الظروف الكلية مستقرة، فقد يظل اتساع المشاركة في السوق متوازنا مع تناوب القيادة بين القطاعات.',
      'إذا ارتفع التقلب، فقد تصبح الوضعية الدفاعية والاهتمام بالسيولة أكثر أهمية في أبحاث المحافظ التعليمية.',
      'إذا تحسن وضوح الأرباح، فقد تحظى موضوعات النمو باهتمام متجدد مع استمرار مخاطر التقييم.'
    ][index] || 'يبقى هذا السيناريو تعليميا ومشروطا ولا يمثل توقعا أو توصية.'
  }));
}

function confidenceLabelAr(label) {
  const map = {
    constructive: 'بناءة',
    cautious: 'حذرة',
    defensive: 'دفاعية',
    volatile: 'متقلبة',
    'improving breadth': 'اتساع متحسن',
    'elevated uncertainty': 'عدم يقين مرتفع'
  };
  return map[label] || 'مشروطة';
}

function momentumAr(label) {
  const map = { bullish: 'إيجابيا', bearish: 'سلبيا', neutral: 'محايدا', mixed: 'مختلطا', positive: 'إيجابيا', negative: 'سلبيا' };
  return map[String(label).toLowerCase()] || 'مشروطا';
}

function valueOf(entry) {
  return entry && entry.value !== undefined && entry.value !== null ? entry.value : null;
}

module.exports = { generateIntelligence };

if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel, fallback) => {
    const file = path.join(ROOT, rel);
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
  };
  console.log(JSON.stringify(generateIntelligence(
    read('data/live-market-state.json', { metadata: { status: 'fallback' } }),
    read('data/economic-calendar.json', { events: [] }),
    read('data/market-regime-state.json', {})
  ), null, 2));
}
