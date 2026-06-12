'use strict';

// Phase 80: productize the converged intelligence stack into a bilingual,
// advice-free daily brief consumed by the homepage and Telegram.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'daily-intelligence-brief.json');
const STALE_HOURS = 48;
const ASSETS = ['GOLD', 'DXY', 'SPY', 'QQQ', 'BTC', 'VIX', 'US10Y', 'NVDA', 'OIL'];

const FILES = {
  pulse: 'data/intelligence/market-pulse.json',
  cognition: 'data/intelligence/market-cognition.json',
  macro: 'data/intelligence/macro-cognition.json',
  convergence: 'data/intelligence/narrative-convergence.json',
  live: 'data/live-market-state.json',
};

const LIVE_KEYS = {
  GOLD: 'gold', DXY: 'dxy', SPY: 'sp500', QQQ: 'nasdaq', BTC: 'bitcoin',
  VIX: 'vix', US10Y: 'us10y_yield', NVDA: 'nvda', OIL: 'oil',
};

const PRESSURE_ASSETS = {
  volatility_pressure: ['VIX', 'SPY', 'QQQ'],
  liquidity_pressure: ['BTC', 'DXY', 'QQQ'],
  defensive_pressure: ['GOLD', 'SPY', 'VIX'],
  speculative_pressure: ['NVDA', 'BTC', 'QQQ'],
  concentration_pressure: ['NVDA', 'QQQ', 'SPY'],
  yield_pressure: ['US10Y', 'QQQ', 'GOLD', 'DXY'],
};

const CATALYST_ASSETS = {
  'Treasury yields': 'US10Y', DXY: 'DXY', Gold: 'GOLD', SPY: 'SPY',
  QQQ: 'QQQ', IWM: 'SPY', VIX: 'VIX', Oil: 'OIL', TLT: 'US10Y',
  'Defensive sectors': 'SPY',
};

const CATALYST_AR = {
  'Retail Sales': 'مبيعات التجزئة',
  'FOMC Rate Decision': 'قرار الفائدة للاحتياطي الفيدرالي',
  'Initial Jobless Claims': 'طلبات إعانة البطالة الأولية',
  'PCE': 'مؤشر نفقات الاستهلاك الشخصي',
  'CPI': 'مؤشر أسعار المستهلك',
  'Core CPI': 'مؤشر أسعار المستهلك الأساسي',
  'Nonfarm Payrolls': 'الوظائف غير الزراعية',
  'Unemployment Rate': 'معدل البطالة',
  'GDP': 'الناتج المحلي الإجمالي',
};

const LEG_ASSET = {
  gold: 'GOLD', dxy: 'DXY', spy: 'SPY', qqq: 'QQQ', btc: 'BTC',
  vix: 'VIX', us10y: 'US10Y', nvda: 'NVDA', iwm: 'SPY', tlt: 'US10Y',
};

const MODULE_CONTRACTS = [
  ['market-regime-brief', 'Market Regime Brief', 'موجز نظام السوق', ['regime', 'coherence', 'what_changed']],
  ['risk-monitor', 'Risk Monitor', 'مراقب المخاطر', ['contradictions', 'risk_framing', 'monitoring_checklist']],
  ['volatility-watch', 'Volatility Watch', 'مراقبة التقلب', ['volatility_regime', 'pressure_active']],
  ['catalyst-radar', 'Catalyst Radar', 'رادار المحفزات', ['next_catalysts', 'asset_sensitivity']],
  ['cross-asset-stress-map', 'Cross-Asset Stress Map', 'خريطة ضغوط الأصول', ['confirms', 'diverges', 'pressure_active']],
  ['ai-leadership-monitor', 'AI Leadership Monitor', 'مراقب قيادة الذكاء الاصطناعي', ['breadth_state', 'momentum_concentration']],
  ['liquidity-monitor', 'Liquidity Monitor', 'مراقب السيولة', ['liquidity_stress', 'pressure_active']],
  ['gold-dollar-dashboard', 'Gold/Dollar Dashboard', 'لوحة الذهب والدولار', ['dollar_pressure', 'asset_sensitivity']],
].map(([id, title_en, title_ar, consumes]) => ({
  id, title_en, title_ar, status: 'foundation-ready', access: 'open', consumes,
}));

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function isFresh(value) {
  if (!value || !value.updated_at) return false;
  const age = (Date.now() - Date.parse(value.updated_at)) / 3600000;
  return Number.isFinite(age) && age <= STALE_HOURS;
}

function localizedState(value) {
  const map = {
    unverified: 'غير موثق', compressed: 'منضغط', elevated: 'مرتفع', stressed: 'مضغوط',
    normal: 'طبيعي', mixed: 'متباين', confirming: 'مؤكد', deteriorating: 'يتدهور',
    easing: 'ينحسر', firming: 'يتصاعد', building: 'يتراكم', contained: 'محتوى',
    'narrow-megacap': 'قيادة ضيقة تقودها الشركات الكبرى', broadening: 'يتسع',
  };
  return map[value] || String(value || 'غير موثق').replace(/_/g, ' ');
}

function catalystLabel(catalyst, ar) {
  if (!catalyst) return ar ? 'بانتظار المحفز الموثق التالي' : 'Awaiting the next sourced catalyst';
  const when = String(catalyst.time || '').includes('T') ? String(catalyst.time).slice(0, 16).replace('T', ' ') + ' UTC' : '';
  const name = ar ? (CATALYST_AR[catalyst.name] || catalyst.name) : catalyst.name;
  return `${name}${when ? ` - ${when}` : ''}`;
}

function buildChecklist(dimensions, macro, catalysts, verified) {
  const next = catalysts[0];
  if (!verified) {
    return [
      {
        id: 'next-catalyst',
        en: `Monitor ${catalystLabel(next, false)}; regime conclusions remain suspended until sourced inputs refresh.`,
        ar: `تتركز المتابعة على ${catalystLabel(next, true)}؛ ولا تُعتمد قراءة للنظام قبل تجدد المدخلات الموثقة.`,
        source: 'calendar',
      },
      {
        id: 'breadth-confirmation',
        en: 'Watch whether market breadth confirms index strength once sourced participation data returns.',
        ar: 'راقب ما إذا كان اتساع السوق يؤكد قوة المؤشرات عند عودة بيانات المشاركة الموثقة.',
        source: 'breadth_state',
      },
      {
        id: 'dollar-pressure',
        en: 'Watch whether DXY pressure continues or fades as verified dollar data refreshes.',
        ar: 'راقب ما إذا كان ضغط مؤشر الدولار يستمر أو ينحسر مع تجدد البيانات الموثقة.',
        source: 'dollar_pressure',
      },
    ];
  }

  const items = [
    {
      id: 'breadth-confirmation',
      en: dimensions.breadth_state === 'deteriorating'
        ? 'Watch whether breadth repairs enough to confirm index strength; participation is the active fault line.'
        : 'Watch whether breadth continues to confirm index strength across the next sourced cycle.',
      ar: dimensions.breadth_state === 'deteriorating'
        ? 'راقب ما إذا كان اتساع السوق يستعيد تماسكه بما يؤكد قوة المؤشرات؛ فالمشاركة هي موضع الضغط الحالي.'
        : 'راقب استمرار اتساع السوق في تأكيد قوة المؤشرات خلال دورة البيانات الموثقة التالية.',
      source: 'breadth_state',
    },
    {
      id: 'dollar-pressure',
      en: `Watch whether DXY pressure continues or fades; the current state is ${String(dimensions.dollar_pressure || 'unverified').replace(/_/g, ' ')}.`,
      ar: `راقب ما إذا كان ضغط مؤشر الدولار يستمر أو ينحسر؛ والحالة الراهنة ${localizedState(dimensions.dollar_pressure)}.`,
      source: 'dollar_pressure',
    },
    {
      id: 'volatility-break',
      en: 'Watch whether volatility compression holds or breaks and whether hedging demand confirms the move.',
      ar: 'راقب ما إذا كان انضغاط التقلب يصمد أو ينكسر، وما إذا كان طلب التحوط يؤكد التحول.',
      source: 'volatility_regime',
    },
    {
      id: 'ai-leadership',
      en: 'Watch whether AI leadership broadens beyond the largest names or remains concentrated.',
      ar: 'راقب ما إذا كانت قيادة الذكاء الاصطناعي تتسع خارج الأسهم الكبرى أم تبقى شديدة التركز.',
      source: 'momentum_concentration',
    },
    {
      id: 'next-catalyst',
      en: `Watch ${catalystLabel(next, false)} as the next scheduled test of the current regime.`,
      ar: `راقب ${catalystLabel(next, true)} بوصفه الاختبار المجدول التالي للنظام الحالي.`,
      source: 'calendar',
    },
  ];
  return items;
}

function rankSensitivity(live, cognition, macro, catalysts, verified) {
  const liveOk = Boolean(live && live.metadata && ['live', 'partial'].includes(live.metadata.status));
  const links = verified ? (cognition.causal_links || []) : [];
  const tracks = verified ? ((macro.pressure && macro.pressure.tracks) || {}) : {};
  const catalystSet = new Set();
  for (const catalyst of catalysts.slice(0, 2)) {
    for (const name of catalyst.assets || []) {
      if (CATALYST_ASSETS[name]) catalystSet.add(CATALYST_ASSETS[name]);
    }
  }

  return ASSETS.map((asset) => {
    let score = 0;
    const drivers_en = [];
    const drivers_ar = [];
    const node = liveOk ? live[LIVE_KEYS[asset]] : null;
    const move = node && Number.isFinite(node.change_pct) ? node.change_pct : null;

    if (move !== null) {
      const movePoints = Math.min(30, Math.round(Math.abs(move) * 12));
      score += movePoints;
      if (movePoints) {
        drivers_en.push(`sourced move magnitude ${move > 0 ? '+' : ''}${move.toFixed(2)}%`);
        drivers_ar.push(`حجم التحرك الموثق ${move > 0 ? '+' : ''}${move.toFixed(2)}%`);
      }
    }

    for (const link of links) {
      const involved = (link.legs || []).map((leg) => LEG_ASSET[leg]).includes(asset);
      if (!involved || !['confirming', 'diverging'].includes(link.state)) continue;
      score += link.state === 'diverging' ? 14 : 7;
      drivers_en.push(`${link.state} ${String(link.id).replace(/-/g, '/')} relationship`);
      drivers_ar.push(`${link.state === 'diverging' ? 'تباعد' : 'تأكيد'} في علاقة ${String(link.id).replace(/-/g, '/')}`);
    }

    for (const [trackName, affected] of Object.entries(PRESSURE_ASSETS)) {
      const track = tracks[trackName];
      if (track && Number.isFinite(track.score) && track.score >= 3 && affected.includes(asset)) {
        score += 12;
        drivers_en.push(`${trackName.replace(/_/g, ' ')} at ${track.score}/5`);
        drivers_ar.push(`مسار ضغط نشط عند ${track.score}/5`);
      }
    }

    if (catalystSet.has(asset)) {
      score += 15;
      drivers_en.push('direct relevance to the next scheduled catalyst');
      drivers_ar.push('حساسية مباشرة للمحفز المجدول التالي');
    }

    if (asset === 'VIX' && verified && ['compressed', 'elevated', 'stressed'].includes(
      (cognition.regime_shifts || []).find((item) => item.dimension === 'volatility_regime')?.state
    )) score += 8;

    if (!drivers_en.length) {
      drivers_en.push('structural watchlist relevance; no sourced move asserted');
      drivers_ar.push('حساسية هيكلية قيد المتابعة من دون ادعاء تحرك غير موثق');
    }

    return {
      asset,
      score: Math.min(100, score),
      live_change_pct: move,
      drivers_en: drivers_en.slice(0, 3),
      drivers_ar: drivers_ar.slice(0, 3),
    };
  }).sort((a, b) => b.score - a.score || ASSETS.indexOf(a.asset) - ASSETS.indexOf(b.asset))
    .map((item, index) => ({ rank: index + 1, ...item }));
}

function buildBriefs() {
  const pulse = readJson(FILES.pulse, {});
  const cognition = readJson(FILES.cognition, {});
  const macro = readJson(FILES.macro, {});
  const convergence = readJson(FILES.convergence, {});
  const live = readJson(FILES.live, {});

  const verified = Boolean(
    isFresh(pulse) && isFresh(cognition) && isFresh(macro) && isFresh(convergence) &&
    pulse.verified === true && cognition.verified === true && macro.verified === true &&
    convergence.verified === true
  );
  const dimensions = pulse.dimensions || {};
  const catalysts = pulse.catalysts_today || [];
  const checklist = buildChecklist(dimensions, macro, catalysts, verified);
  const sensitivity = rankSensitivity(live, cognition, macro, catalysts, verified);
  const activeContradictions = verified ? (macro.contradictions || []).filter((item) => item.active_today) : [];
  const activePressure = verified
    ? Object.entries((macro.pressure && macro.pressure.tracks) || {})
      .filter(([, track]) => Number.isFinite(track.score) && track.score > 0)
      .sort((a, b) => b[1].score - a[1].score)
      .map(([track, value]) => ({ track, score: value.score, state: value.state, en: value.en, ar: value.ar }))
    : [];
  const coherence = verified ? convergence.coherence : {
    score: null, band: 'unverified',
    en: 'Regime coherence awaits the next verified data cycle.',
    ar: 'اتساق النظام بانتظار دورة البيانات الموثقة التالية.',
  };
  const nextCatalysts = catalysts.slice(0, 3).map((item) => ({
    name: item.name, name_ar: CATALYST_AR[item.name] || item.name, time: item.time, assets: item.assets || [],
  }));
  const regimeState = verified ? (macro.structure?.class || dimensions.risk_state || 'mixed') : 'unverified';

  const deskLead = verified && (convergence.narrative_en || []).length
    ? {
      en: `Macro Desk: ${(convergence.narrative_en || []).slice(0, 3).join(' ')}`,
      ar: `مكتب الماكرو: ${(convergence.narrative_ar || []).slice(0, 3).join(' ')}`,
    }
    : {
      en: `Macro Desk: monitoring mode. Regime inputs are unverified; attention stays on ${catalystLabel(catalysts[0], false)} and the next sourced cross-asset read.`,
      ar: `مكتب الماكرو: وضع المراقبة قائم. مدخلات النظام غير موثقة؛ وتتركز المتابعة على ${catalystLabel(catalysts[0], true)} وعلى القراءة الموثقة التالية للعلاقات بين الأصول.`,
    };

  const riskFraming = verified
    ? {
      en: activeContradictions.length
        ? `The regime carries ${activeContradictions.length} active structural contradiction(s); conviction should be read through confirmation, not headline direction.`
        : 'The current regime has no active structural contradiction in the verified stack, but confirmation remains conditional on breadth, volatility, and the next catalyst.',
      ar: activeContradictions.length
        ? `يحمل النظام ${activeContradictions.length} من التناقضات الهيكلية النشطة؛ وتُقرأ القناعة عبر إشارات التأكيد لا عبر اتجاه العناوين.`
        : 'لا يظهر في المنظومة الموثقة تناقض هيكلي نشط حالياً، لكن التأكيد يبقى مشروطاً بالاتساع والتقلب والمحفز التالي.',
    }
    : {
      en: 'Risk framing remains observational: no regime claim is made while sourced inputs are incomplete.',
      ar: 'يبقى تأطير المخاطر في نطاق الرصد؛ فلا تُطرح قراءة للنظام ما دامت المدخلات الموثقة غير مكتملة.',
    };

  return {
    version: '2.0',
    product: 'Daily Market Brief 2.0',
    updated_at: new Date().toISOString(),
    run_date: new Date().toISOString().slice(0, 10),
    verified,
    desk_lead: deskLead,
    regime: {
      state: regimeState,
      state_ar: localizedState(regimeState),
      coherence,
      conviction: verified ? macro.conviction?.state || 'unverified' : 'unverified',
      volatility: verified ? dimensions.volatility_regime || 'unverified' : 'unverified',
    },
    what_changed: verified ? convergence.what_changed || [] : [],
    confirms: verified ? convergence.confirms || [] : [],
    diverges: verified ? convergence.diverges || [] : [],
    contradictions: activeContradictions,
    pressure_active: activePressure,
    next_catalysts: nextCatalysts,
    most_sensitive_assets: sensitivity.slice(0, 5),
    asset_sensitivity: sensitivity,
    monitoring_checklist: checklist,
    risk_framing: riskFraming,
    premium_module_contracts: MODULE_CONTRACTS,
    safety: {
      posture: 'educational-monitoring-only',
      direct_trade_instructions: false,
      financial_advice: false,
      fabricated_data: false,
    },
    disclaimer: {
      en: 'Educational market intelligence and monitoring context only. Not investment advice or a trade recommendation.',
      ar: 'استخبارات سوق وسياق متابعة لأغراض تعليمية فقط، وليست نصيحة استثمارية أو توصية تداول.',
    },
  };
}

function main() {
  const brief = buildBriefs();
  console.log(`[briefs] verified=${brief.verified} checklist=${brief.monitoring_checklist.length} sensitivity=${brief.asset_sensitivity.length}`);
  console.log(`[briefs] top sensitivity=${brief.most_sensitive_assets.map((item) => `${item.asset}:${item.score}`).join(', ')}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(brief, null, 2) + '\n', 'utf8');
    console.log('[briefs] wrote data/intelligence/daily-intelligence-brief.json');
  }
}

if (require.main === module) main();

module.exports = {
  ASSETS, CATALYST_AR, MODULE_CONTRACTS, buildBriefs, buildChecklist, rankSensitivity,
};
