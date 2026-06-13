'use strict';

// Phase 87 — Chart narrative selection engine.
// Decides which charts are editorially relevant TODAY by reading the verified
// intelligence stack — charts support the narrative, they never decorate it.
// Each selected chart carries the structural reason it was chosen, a bilingual
// institutional reading, evidence references, and attribution.
//
// Selection vocabulary (narrative → visual):
//   yields pressuring growth   → US10Y vs QQQ
//   dollar/gold strain         → DXY vs GOLD
//   breadth deterioration      → SPY vs RSP (equal-weight confirmation)
//   volatility compression     → VIX structure
//   AI concentration           → NVDA vs QQQ leadership
//   liquidity beta strain      → BTC vs QQQ
//
// Honesty rules: selection only from verified artifacts; at most TWO charts
// (one strong chart beats five noisy ones); unverified state selects nothing.
//
// Output: data/intelligence/chart-narratives.json
// Usage:  node tools/build-chart-narratives.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PULSE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-pulse.json');
const COGNITION_PATH = path.join(ROOT, 'data', 'intelligence', 'market-cognition.json');
const MACRO_PATH = path.join(ROOT, 'data', 'intelligence', 'macro-cognition.json');
const CONV_PATH = path.join(ROOT, 'data', 'intelligence', 'narrative-convergence.json');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'chart-narratives.json');

const TODAY = new Date().toISOString().slice(0, 10);
const STALE_HOURS = 48;
const MAX_CHARTS = 2;
const SUPPORTED_VISUAL_TYPES = [
  'price-structure',
  'cross-asset-comparison',
  'volatility',
  'liquidity-pressure',
  'catalyst-timeline',
  'macro-divergence',
  'breadth',
  'positioning-concentration',
];
const ANNOTATION_CONTRACT = {
  version: '1.0',
  max_annotations: 3,
  allowed_types: [
    'macro-annotation',
    'liquidity-marker',
    'divergence-highlight',
    'catalyst-zone',
    'pressure-band',
    'transition-label',
    'liquidity-zone',
    'volatility-compression-zone',
    'commentary-label',
  ],
  bilingual_labels_required: true,
  evidence_reference_required: true,
  rendering_status: 'active',
};

// Phase 91 — per-chart annotation relevance. Each chart knows which verified
// signals can annotate it: the causal link it visualizes, the pulse dimension
// it tracks, the stored-pressure track that escalates it, and the catalyst
// asset names whose scheduled events open a catalyst window over it.
const ANNOTATION_MAP = {
  'yields-growth': { link: 'yields-growth', dim: 'duration_pressure', pressure: 'yield_pressure', catalystAssets: ['Treasury yields', 'QQQ', 'TLT'] },
  'dollar-gold': { link: 'dollar-gold', dim: 'dollar_pressure', pressure: null, catalystAssets: ['Gold', 'DXY'] },
  'breadth-confirmation': { link: 'breadth-link', dim: 'breadth_state', pressure: null, catalystAssets: ['SPY', 'IWM'] },
  'volatility-structure': { link: 'vix-equities', dim: 'volatility_regime', pressure: 'volatility_pressure', catalystAssets: ['VIX', 'SPY'] },
  'ai-concentration': { link: 'ai-growth', dim: 'ai_concentration_risk', pressure: 'concentration_pressure', catalystAssets: ['QQQ', 'NVDA'] },
  'liquidity-beta': { link: 'liquidity-beta', dim: 'liquidity_stress', pressure: 'liquidity_pressure', catalystAssets: ['QQQ'] },
};

// Build institutional annotations for a chart from verified artifacts only.
// Returns at most ANNOTATION_CONTRACT.max_annotations entries, each evidence-
// backed and bilingual. No price levels, no prediction, no trade framing —
// annotations describe structural relationships, never targets.
function buildAnnotations(chartId, sources) {
  const map = ANNOTATION_MAP[chartId];
  if (!map) return [];
  const { conv, cog, mac, pul } = sources;
  const out = [];

  // Divergence / confirmation marker from the causal link this chart visualizes.
  const diverge = ((conv && conv.diverges) || []).find((l) => l.id === map.link);
  const confirm = ((conv && conv.confirms) || []).find((l) => l.id === map.link);
  if (diverge) {
    const legs = (diverge.legs || []).join('/').toUpperCase();
    const n = diverge.chain_strength || 1;
    out.push({
      type: 'divergence-highlight', severity: n >= 2 ? 'high' : 'elevated',
      label_en: `Divergence — ${legs} not confirming${n >= 2 ? ` (${n}-session strain)` : ''}`,
      label_ar: `انفصال — ${legs} لا يؤكد${n >= 2 ? ` (إجهاد ${n} جلسات)` : ''}`,
      evidence: [`convergence:diverges:${map.link}:chain=${n}`],
    });
  } else if (confirm) {
    const legs = (confirm.legs || []).join('/').toUpperCase();
    out.push({
      type: 'commentary-label', severity: 'info',
      label_en: `Confirmation — ${legs} relationship holding`,
      label_ar: `تأكيد — علاقة ${legs} صامدة`,
      evidence: [`convergence:confirms:${map.link}`],
    });
  }

  // Regime transition label when the chart's dimension just shifted.
  const transition = ((cog && cog.timeline_tail) || []).find((e) => e.dimension === map.dim && e.from && e.to);
  if (transition && out.length < ANNOTATION_CONTRACT.max_annotations) {
    out.push({
      type: 'transition-label', severity: 'elevated',
      label_en: `Regime shift — ${String(map.dim).replace(/_/g, ' ')} ${transition.from} → ${transition.to}`,
      label_ar: `تحوّل النظام — ${String(map.dim).replace(/_/g, ' ')}: ${transition.from} ← ${transition.to}`,
      evidence: [`cognition:timeline:${map.dim}:${transition.from}->${transition.to}:${transition.date || ''}`],
    });
  }

  // Stored-pressure band when the relevant track is elevated (>=3/5).
  const pressureScore = map.pressure && mac && mac.pressure && mac.pressure.tracks && mac.pressure.tracks[map.pressure]
    ? mac.pressure.tracks[map.pressure].score : 0;
  if (pressureScore >= 3 && out.length < ANNOTATION_CONTRACT.max_annotations) {
    const isVol = map.pressure === 'volatility_pressure';
    out.push({
      type: isVol ? 'volatility-compression-zone' : 'pressure-band', severity: pressureScore >= 4 ? 'high' : 'elevated',
      label_en: `Stored pressure — ${String(map.pressure).replace(/_/g, ' ')} ${pressureScore}/5`,
      label_ar: `ضغط مخزّن — ${pressureScore}/5`,
      evidence: [`macro:pressure:${map.pressure}:${pressureScore}`],
    });
  }

  // Catalyst window when an upcoming high-impact event touches this chart's assets.
  const catalyst = ((pul && pul.catalysts_today) || []).find((c) => (c.assets || []).some((a) => map.catalystAssets.includes(a)));
  if (catalyst && out.length < ANNOTATION_CONTRACT.max_annotations) {
    const when = String(catalyst.time || '').slice(0, 10);
    out.push({
      type: 'catalyst-zone', severity: 'info',
      label_en: `Catalyst window — ${catalyst.name}${when ? ` (${when})` : ''}`,
      label_ar: `نافذة محفز — ${catalyst.name}${when ? ` (${when})` : ''}`,
      evidence: [`pulse:catalyst:${catalyst.name}:${when}`],
    });
  }

  return out.slice(0, ANNOTATION_CONTRACT.max_annotations);
}

const CHART_LIBRARY = {
  'yields-growth': {
    kind: 'cross-asset',
    visual_type: 'cross-asset-comparison',
    symbols: ['TVC:US10Y', 'NASDAQ:QQQ'],
    article_terms: ['yield', 'yields', 'rates', 'duration', 'qqq', 'growth equities', 'العوائد', 'الفائدة', 'أسهم النمو'],
    title_en: 'Yields vs growth equities', title_ar: 'العوائد مقابل أسهم النمو',
    reading_en: (ctx) => `Rising yield pressure against long-duration growth — the US10Y/QQQ relationship is ${ctx.diverging ? 'not holding this session, which is where the structural argument lives' : 'the channel through which duration stress reaches valuations'}.`,
    reading_ar: (ctx) => `ضغط العوائد مقابل أسهم النمو طويلة الأمد — علاقة US10Y/QQQ ${ctx.diverging ? 'لا تصمد في هذه الجلسة، وهناك يكمن الجدل الهيكلي' : 'هي القناة التي ينتقل عبرها إجهاد الفائدة إلى التقييمات'}.`,
  },
  'dollar-gold': {
    kind: 'cross-asset',
    visual_type: 'macro-divergence',
    symbols: ['TVC:DXY', 'OANDA:XAUUSD'],
    article_terms: ['dollar', 'dxy', 'gold', 'xau', 'ذهب', 'الدولار'],
    title_en: 'Dollar vs gold', title_ar: 'الدولار مقابل الذهب',
    reading_en: (ctx) => `Gold holding against a firming dollar${ctx.chain >= 2 ? ` for ${ctx.chain} sessions` : ''} — an unusual co-move that leaves the relationship structurally unresolved.`,
    reading_ar: (ctx) => `الذهب يصمد رغم تقوّي الدولار${ctx.chain >= 2 ? ` منذ ${ctx.chain} جلسات` : ''} — تحرك متزامن غير معتاد يبقي العلاقة بين الأصلين غير محسومة هيكلياً.`,
  },
  'breadth-confirmation': {
    kind: 'cross-asset',
    visual_type: 'breadth',
    symbols: ['AMEX:SPY', 'AMEX:RSP'],
    article_terms: ['breadth', 'equal weight', 'equal-weight', 'rsp', 'spy', 'participation', 'اتساع السوق', 'الوزن المتساوي', 'المشاركة'],
    title_en: 'Cap-weighted vs equal-weight breadth', title_ar: 'المؤشر الموزون مقابل الوزن المتساوي',
    reading_en: () => 'The cap-weighted index against its equal-weight twin — the cleanest visual of whether participation confirms headline strength or megacaps are carrying a thinning tape.',
    reading_ar: () => 'المؤشر الموزون بالقيمة مقابل نظيره متساوي الوزن — أوضح قراءة بصرية لما إذا كانت المشاركة تؤكد قوة المؤشر أم أن الشركات الكبرى تحمل سوقاً يضيق.',
  },
  'volatility-structure': {
    kind: 'volatility',
    visual_type: 'volatility',
    symbols: ['TVC:VIX'],
    article_terms: ['volatility', 'vix', 'compression', 'hedging', 'التقلب', 'التحوط', 'الانضغاط'],
    title_en: 'Volatility structure', title_ar: 'بنية التقلب',
    reading_en: (ctx) => `Volatility compression${ctx.pressure >= 3 ? ` with stored pressure at ${ctx.pressure}/5` : ''} — the longer the floor holds, the more it resembles stored instability rather than calm.`,
    reading_ar: (ctx) => `انضغاط التقلب${ctx.pressure >= 3 ? ` مع ضغط مخزّن عند ${ctx.pressure}/5` : ''} — كلما طال صمود القاع، اقترب من كونه عدم استقرار مخزّناً لا هدوءاً.`,
  },
  'ai-concentration': {
    kind: 'cross-asset',
    visual_type: 'positioning-concentration',
    symbols: ['NASDAQ:NVDA', 'NASDAQ:QQQ'],
    article_terms: ['ai', 'artificial intelligence', 'nvda', 'nvidia', 'qqq', 'megacap', 'concentration', 'الذكاء الاصطناعي', 'إنفيديا', 'التركز'],
    title_en: 'AI leadership vs the growth complex', title_ar: 'قيادة الذكاء الاصطناعي مقابل قطاع النمو',
    reading_en: () => 'AI leadership against the broader growth complex — when the gap widens while breadth thins, the leadership is carrying more weight than the structure can comfortably bear.',
    reading_ar: () => 'قيادة الذكاء الاصطناعي مقابل قطاع النمو الأوسع — حين تتسع الفجوة بينما يضيق الاتساع، تحمل القيادة وزناً أكبر مما تحتمله البنية بارتياح.',
  },
  'liquidity-beta': {
    kind: 'liquidity',
    visual_type: 'liquidity-pressure',
    symbols: ['CRYPTO:BTCUSD', 'NASDAQ:QQQ'],
    article_terms: ['liquidity', 'funding', 'bitcoin', 'btc', 'crypto', 'qqq', 'السيولة', 'التمويل', 'بتكوين'],
    title_en: 'Liquidity beta', title_ar: 'بيتا السيولة',
    reading_en: () => 'Crypto against the growth complex — the marginal liquidity read: when the liquidity beta decouples, funding conditions are usually speaking first.',
    reading_ar: () => 'الكريبتو مقابل قطاع النمو — قراءة السيولة الهامشية: حين تنفصل بيتا السيولة، تكون أوضاع التمويل عادة أول من يتكلم.',
  },
};

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function fresh(artifact) {
  if (!artifact || !artifact.updated_at) return false;
  return (Date.now() - new Date(artifact.updated_at).getTime()) / 3600000 <= STALE_HOURS;
}

// Score each chart's editorial relevance from verified state. Returns
// candidates with score + evidence; only triggered charts score above zero.
function scoreCharts({ dims, diverges, tracks, shifts }) {
  const byId = (id) => diverges.find((l) => l.id === id);
  const shiftOf = (dim) => shifts.find((s) => s.dimension === dim) || {};
  const track = (key) => (tracks[key] && tracks[key].score) || 0;
  const candidates = [];

  const yg = byId('yields-growth');
  if (yg || (dims.duration_pressure === 'building' && track('yield_pressure') >= 3)) {
    candidates.push({
      id: 'yields-growth',
      score: (yg ? 40 + yg.chain_strength * 10 : 0) + track('yield_pressure') * 6,
      ctx: { diverging: Boolean(yg), chain: yg ? yg.chain_strength : 0 },
      evidence: [yg ? `causal:yields-growth diverging ×${yg.chain_strength}` : null, dims.duration_pressure === 'building' ? 'duration_pressure: building' : null].filter(Boolean),
    });
  }
  const dg = byId('dollar-gold');
  if (dg) {
    candidates.push({
      id: 'dollar-gold', score: 40 + dg.chain_strength * 12,
      ctx: { diverging: true, chain: dg.chain_strength },
      evidence: [`causal:dollar-gold diverging ×${dg.chain_strength}`],
    });
  }
  if (dims.breadth_state === 'deteriorating') {
    const streak = shiftOf('breadth_state').sessions_in_state || 1;
    candidates.push({
      id: 'breadth-confirmation', score: 30 + streak * 8,
      ctx: { streak },
      evidence: [`breadth_state: deteriorating ×${streak}`],
    });
  }
  if (dims.volatility_regime === 'compressed' && ((shiftOf('volatility_regime').sessions_in_state || 0) >= 2 || track('volatility_pressure') >= 3)) {
    candidates.push({
      id: 'volatility-structure', score: 24 + track('volatility_pressure') * 8,
      ctx: { pressure: track('volatility_pressure') },
      evidence: [`volatility_regime: compressed ×${shiftOf('volatility_regime').sessions_in_state || 1}`, track('volatility_pressure') >= 3 ? `volatility_pressure ${track('volatility_pressure')}/5` : null].filter(Boolean),
    });
  }
  if (dims.momentum_concentration === 'narrow-megacap' && dims.ai_concentration_risk === 'elevated') {
    candidates.push({
      id: 'ai-concentration', score: 30 + track('concentration_pressure') * 6,
      ctx: {},
      evidence: ['momentum_concentration: narrow-megacap', 'ai_concentration_risk: elevated'],
    });
  }
  const lb = byId('liquidity-beta');
  if (lb || track('liquidity_pressure') >= 3) {
    candidates.push({
      id: 'liquidity-beta', score: (lb ? 30 + lb.chain_strength * 10 : 0) + track('liquidity_pressure') * 6,
      ctx: { chain: lb ? lb.chain_strength : 0 },
      evidence: [lb ? `causal:liquidity-beta diverging ×${lb.chain_strength}` : null, track('liquidity_pressure') >= 3 ? `liquidity_pressure ${track('liquidity_pressure')}/5` : null].filter(Boolean),
    });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

function buildChartNarratives() {
  const pulse = readJson(PULSE_PATH, null);
  const cognition = readJson(COGNITION_PATH, null);
  const macro = readJson(MACRO_PATH, null);
  const convergence = readJson(CONV_PATH, null);

  const cog = fresh(cognition) ? cognition : null;
  const mac = fresh(macro) ? macro : null;
  const conv = fresh(convergence) ? convergence : null;
  const pul = fresh(pulse) ? pulse : null;
  const verified = Boolean(cog && cog.verified === true && mac && mac.verified === true);

  let selected = [];
  if (verified) {
    const candidates = scoreCharts({
      dims: (pul && pul.dimensions) || {},
      diverges: (conv && conv.diverges) || [],
      tracks: (mac.pressure && mac.pressure.tracks) || {},
      shifts: (cog.regime_shifts || []),
    });
    const annotationSources = { conv, cog, mac, pul };
    selected = candidates.slice(0, MAX_CHARTS).map((c) => {
      const spec = CHART_LIBRARY[c.id];
      return {
        id: c.id,
        kind: spec.kind,
        visual_type: spec.visual_type,
        symbols: spec.symbols,
        title_en: spec.title_en,
        title_ar: spec.title_ar,
        reading_en: spec.reading_en(c.ctx),
        reading_ar: spec.reading_ar(c.ctx),
        score: Math.round(c.score),
        evidence: c.evidence,
        annotations: buildAnnotations(c.id, annotationSources),
        attribution: 'Chart: TradingView · Quotes: sourced market providers',
      };
    });
  }

  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    run_date: TODAY,
    verified,
    selected,
    supported_visual_types: SUPPORTED_VISUAL_TYPES,
    annotation_contract: ANNOTATION_CONTRACT,
    policy: 'At most two charts; selection derives only from verified intelligence artifacts; an unverified session selects nothing.',
  };
}

function main() {
  const write = process.argv.includes('--write');
  const out = buildChartNarratives();
  console.log(`[chart-narratives] verified=${out.verified} selected=${out.selected.length}${out.selected.length ? ' → ' + out.selected.map((c) => `${c.id}(${c.score})`).join(', ') : ''}`);
  if (write) {
    fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
    console.log('[chart-narratives] wrote data/intelligence/chart-narratives.json');
  }
}

if (require.main === module) main();

module.exports = {
  buildChartNarratives,
  scoreCharts,
  buildAnnotations,
  CHART_LIBRARY,
  MAX_CHARTS,
  SUPPORTED_VISUAL_TYPES,
  ANNOTATION_CONTRACT,
  ANNOTATION_MAP,
};
