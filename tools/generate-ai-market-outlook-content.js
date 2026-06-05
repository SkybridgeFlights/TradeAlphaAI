'use strict';

// Phase 50.1: AI Generation Stabilization — Institutional Market Commentary
// Split prompt architecture: system_core / analytical_requirements / market_context / output_spec
// Self-expansion pass: targeted section expansion when weak, not full retry
// Section-level validation: per-field diagnostics before combined check
// Bias normalization: maps near-hits to canonical allowed values
// Adjusted thresholds: retail hard-fail raised to ≥5; financial advice = hard-fail at ≥1
// Expanded specificity: macro language patterns accepted alongside instrument tickers
//
// Usage: node tools/generate-ai-market-outlook-content.js --slug=<slug>
// Outputs structured JSON to stdout. Exits 1 on failure.

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const { buildNarrative }    = require('./build-market-narrative');
const { analyzeTransition } = require('./analyze-regime-transition');
const { detectRetailPhrasing, detectFinancialAdvice, detectInstitutionalPhrasing } = require('./institutional-language-filter');

const ROOT          = path.resolve(__dirname, '..');
const QUEUE_PATH    = path.join(ROOT, 'data', 'market-outlook-queue.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');

const ALLOWED_BIASES = new Set([
  'cautiously bullish',
  'cautiously bearish',
  'neutral',
  'neutral-to-constructive',
  'selective risk-on',
  'defensive',
  'risk-off stabilization',
  'elevated uncertainty',
  'mixed / range-bound',
]);
const ALLOWED_BIASES_AR = new Set(['صاعد بحذر', 'محايد', 'هابط بحذر', 'مختلط', 'عدم يقين مرتفع']);

const MODEL      = process.env.OPENAI_MODEL || 'gpt-4o';
const TIMEOUT_MS = 90000;

const MIN_WORDS_EN = { executive_summary: 45, market_context: 75, bullish_scenario: 45, bearish_scenario: 45 };
const MIN_WORDS_AR = { executive_summary: 30, market_context: 50, bullish_scenario: 30, bearish_scenario: 30 };

// Generic filler — hard fail if found
const GENERIC_PHRASES = [
  'various macroeconomic factors',
  'navigating a complex landscape',
  'market participants are closely monitoring',
  'it remains to be seen',
  'dynamic market landscape',
  'complex macro environment',
  'economic conditions can change',
  'market conditions can change',
  'broadly speaking',
  'at the end of the day',
  'in the grand scheme',
  'macroeconomic backdrop remains',
  'keep a close eye',
];

// Named instrument patterns (ticker-level specificity)
const INSTRUMENT_PATTERNS = [
  /\b(TLT|IEF|SHY|AGG|BND|LQD|HYG|TIP|TIPS|SCHP|ZROZ|EDV)\b/,
  /\b(QQQ|SPY|IWM|DIA|VOO|VTI|RSP|SPLG)\b/,
  /\b(SMH|SOXX|SOXL|XSD|NVDA|AMD|TSMC|TSM|ASML|INTC|QCOM)\b/,
  /\b(XLK|XLF|XLE|XLU|XLV|XLI|XLRE|XLP|XLB|XLY|XLC)\b/,
  /\b(MSFT|GOOGL|GOOG|META|AAPL|AMZN|TSLA|JPM|BAC|GS|MS)\b/,
  /\b(GLD|SLV|GDX|USO|DBA)\b/,
  /\b\d+[- ]?[Yy](ear)?\s*(Treasury|yield|note|bond)\b/i,
  /\b(Fed\s+funds|federal\s+funds|FOMC\s+rate)\b/i,
  /\b(yield\s+curve|2Y10Y|10Y2Y|inverted\s+curve|duration\s+risk|duration.sensitive)\b/i,
  /\b(VIX|CBOE\s+volatility)\b/i,
  /\b(DXY|dollar\s+index)\b/i,
];

// Macro-analytical patterns (institutional language specificity — counted alongside instruments)
const MACRO_PATTERNS = [
  /\b(yield curve|yield spread|basis point|curve steepen|curve flatten|curve normaliz|curve inversion)\b/i,
  /\b(duration|duration risk|duration exposure|duration-sensitive)\b/i,
  /\b(breadth|participation|concentration risk|equal.weight|cap.weight|narrow leadership)\b/i,
  /\b(real yield|risk premium|net interest margin|repricing|factor tilt|positioning)\b/i,
  /\b(implied vol|vol regime|volatility regime|vol compression|vol expansion|hedging demand)\b/i,
  /\b(liquidity|risk appetite|credit spread|monetary transmission|rate.sensitive|terminal rate)\b/i,
  /\b(sector rotation|defensive rotation|cross.asset|macro hedge|macro transmission|transmission mechanism)\b/i,
  /\b(transmission mechanism|transmission chain|policy path|rate path)\b/i,
];

// ── Bias normalization ────────────────────────────────────────────────────────

function normalizeBias(bias) {
  const b = (bias || '').toLowerCase().trim();
  if (/neutral[\s-]*to[\s-]*constructive/.test(b))                   return 'neutral-to-constructive';
  if (/selective.*risk.on|risk.on.*selective/.test(b))               return 'selective risk-on';
  if (/risk.off.*stabil|stabil.*risk.off/.test(b))                   return 'risk-off stabilization';
  if (/defensive|defence|defense/.test(b))                           return 'defensive';
  if (/cautious.*bull|construct|positive|risk.on/.test(b))           return 'cautiously bullish';
  if (/cautious.*bear|cautious.*neg|cautious.*risk.off|risk.off/.test(b)) return 'cautiously bearish';
  if (/elevat.*uncertain|high.*uncertain|uncertain|caution/.test(b)) return 'elevated uncertainty';
  if (/mixed|range.bound|neutral.to|no.clear|conflicted/.test(b))    return 'mixed / range-bound';
  if (/neutral|balanced|flat/.test(b))                               return 'neutral';
  if (/bull/i.test(b))                                               return 'cautiously bullish';
  if (/bear/i.test(b))                                               return 'cautiously bearish';
  return null;
}

// ── Topic-cluster framework (modules A-G) ─────────────────────────────────────

function getTopicFramework(topic) {
  const cluster = [
    topic.topic_cluster || '',
    topic.discovery_cluster || '',
    ...(topic.macro_tags || [])
  ].join(' ').toLowerCase();

  if (/yield|rates|treasury|bond|fixed.income|rate.context/.test(cluster)) {
    return {
      module:      'A — Rates & Duration',
      instruments: 'TLT, IEF, BND, TIPS (TIP ETF), SHY, 10-year Treasury yield, 2-year Treasury yield, Fed funds rate, DXY',
      mechanism:   'Fed policy expectations → short-end rate path → 2Y10Y curve shape → duration risk repricing → TLT/IEF ETF flows → equity valuation discount rates → sector rotation between rate-sensitive (XLU, XLRE) and rate-resistant (XLF, XLE)',
      lenses:      ['TLT/equity correlation — bond bid as equity hedge vs. risk-on confirmation', '2Y yield vs. Fed funds — market pricing of rate cuts vs. hold', 'Yield curve slope as growth/recession signal', 'Real yield direction as GLD and equity multiple driver'],
      bias_note:   '"Cautiously bullish" means conditions are constructive for rate stability or normalization, supporting duration; NOT a directional price call on Treasuries.',
    };
  }
  if (/ai|semiconductor|tech|chip|nvda|smd/.test(cluster)) {
    return {
      module:      'B — AI & Semiconductor Cycle',
      instruments: 'NVDA, AMD, SMH, SOXX, XLK, QQQ, SOXL (leveraged semi), ASML, TSM (TSMC)',
      mechanism:   'AI infrastructure capex cycle → hyperscaler GPU demand signals → NVDA/AMD revenue trajectory → SOX index → XLK sector weight → QQQ growth multiple sensitivity to 10Y yield path',
      lenses:      ['NVDA as hyperscaler capex proxy vs. broad market breadth', 'SOX/SMH vs. QQQ divergence — semi-specific vs. broad tech leadership', 'XLK vs. IWM — growth concentration vs. equal-weight breadth', 'Export control policy as binary option on the AI supply chain'],
      bias_note:   '"Cautiously bullish" means the AI capex cycle and demand signals are constructive; not a stock recommendation.',
    };
  }
  if (/etf.rotation|rotation|sector.flow/.test(cluster)) {
    return {
      module:      'C — ETF Rotation & Sector Flows',
      instruments: 'SPY, QQQ, IWM (small cap), XLK (tech), XLF (financials), XLE (energy), XLU (utilities), XLV (healthcare), RSP (equal-weight S&P), BND',
      mechanism:   'Macro regime signal → risk appetite → factor tilt (growth vs. value, large vs. small cap) → sector ETF relative flows → breadth divergence (RSP vs. SPY, IWM vs. SPY)',
      lenses:      ['Equal-weight (RSP) vs. cap-weight (SPY) as breadth quality signal', 'IWM/SPY relative strength as risk appetite gauge', 'Defensive (XLU, XLV, XLP) vs. cyclical (XLK, XLF, XLE) leadership', 'Sector breadth score: # sectors advancing as market health indicator'],
      bias_note:   '"Cautiously bullish" means the regime supports risk positioning; not a recommendation on any specific ETF.',
    };
  }
  if (/defensive|utilities|healthcare|xlu|xlv|risk.off|safe.haven/.test(cluster)) {
    return {
      module:      'D — Defensive Sectors & Risk-Off',
      instruments: 'XLU (utilities), XLV (healthcare), XLP (consumer staples), TLT, GLD, VIX, IEF',
      mechanism:   'Risk regime deterioration → VIX expansion → capital rotation from cyclicals (XLK, XLF, XLE) to defensive (XLU, XLV, XLP) → TLT bid → credit spread widening (LQD vs. HYG)',
      lenses:      ['XLU/XLV vs. SPY relative strength as defensive rotation confirmation', 'VIX level as institutional hedging demand proxy', 'Credit spread (LQD/HYG) as risk appetite barometer', 'TLT bid vs. equity selling — flight-to-quality cross-asset signal'],
      bias_note:   '"Cautiously bearish" or "elevated uncertainty" reflects risk-off positioning signals; not a call on any specific security.',
    };
  }
  if (/inflation|cpi|pce|real.asset|commodity/.test(cluster)) {
    return {
      module:      'E — Inflation & Real Asset Dynamics',
      instruments: 'TIP (TIPS ETF), GLD, SLV, GDX, USO, DBA, TLT, IEF, DXY',
      mechanism:   'Inflation expectations → TIPS breakeven repricing → real yield direction → GLD/commodity demand → TLT/IEF duration pressure → Fed reaction function → rate path → DXY response',
      lenses:      ['TIPS breakeven vs. nominal yield as real yield signal', 'GLD vs. DXY inverse correlation stability', 'Energy ETF (XLE, USO) as inflation premium proxy', 'TLT duration pressure under rising inflation expectations'],
      bias_note:   '"Cautiously bullish" reflects constructive real asset or contained inflation conditions; not a commodity price forecast.',
    };
  }
  if (/dollar|dxy|liquidity|global.flow|usd|currency/.test(cluster)) {
    return {
      module:      'F — Dollar, Liquidity & Global Capital Flows',
      instruments: 'DXY, GLD, EEM (emerging markets), TLT, USO, GDX, TIP, VIX',
      mechanism:   'USD strength/weakness → global dollar liquidity conditions → EM capital flow reversal risk → commodity pressure → gold demand → cross-asset risk appetite',
      lenses:      ['DXY level as global dollar liquidity proxy', 'Dollar vs. GLD — dollar debasement vs. real asset hedging tension', 'EM (EEM) relative performance as dollar sensitivity gauge', 'Cross-currency basis as USD funding stress indicator'],
      bias_note:   '"Cautiously bullish" reflects a softening dollar or improving liquidity environment supportive of non-dollar assets.',
    };
  }
  if (/gold|gld|gdx|precious|macro.hedge/.test(cluster)) {
    return {
      module:      'G — Gold & Macro Hedging',
      instruments: 'GLD, GDX (gold miners ETF), SLV, TIP, TLT, DXY, VIX',
      mechanism:   'Real yield direction → GLD opportunity cost → central bank accumulation → DXY inverse relationship → GDX operational leverage → tail risk hedging vs. VIX-based alternatives',
      lenses:      ['Real yield (10Y nominal minus TIPS breakeven) as GLD primary driver', 'GLD vs. DXY inverse correlation stability', 'GDX vs. GLD leverage ratio as miner premium signal', 'Gold as portfolio hedge vs. equity volatility (VIX) hedges'],
      bias_note:   '"Cautiously bullish" reflects constructive real yield or macro hedge conditions; not a commodity price target.',
    };
  }
  return {
    module:      'Z — Cross-Asset Macro',
    instruments: 'SPY, QQQ, IWM, VIX, TLT (duration proxy), GLD, DXY, IEF',
    mechanism:   'Macro regime signal → VIX level → cross-asset correlation shifts → risk-on vs. risk-off positioning → relative strength rotation between equity (SPY/QQQ) and defensive assets (TLT/GLD/IEF)',
    lenses:      ['VIX level and regime as hedging demand barometer', 'SPY/QQQ/IWM divergence as breadth quality signal', 'TLT/equity correlation as flight-to-quality vs. risk-on signal', 'GLD/DXY as macro hedge vs. dollar strength tension'],
    bias_note:   '"Cautiously bullish" means the environment supports risk-on positioning; not a call on any specific instrument.',
  };
}

// ── Narrative lens selection ───────────────────────────────────────────────────

const ALL_LENSES = {
  cross_asset:     'cross_asset_narrative',
  yield_curve:     'yield_curve_narrative',
  breadth:         'breadth_narrative',
  volatility:      'volatility_context',
  sector_rotation: 'breadth_narrative',
  ai_semis:        'ai_semis_context',
  macro_trans:     'yield_curve_narrative',
  positioning:     'positioning_observations',
};

function selectNarrativeLenses(topicCluster, narrative) {
  const c = (topicCluster || '').toLowerCase();
  const selected = [];
  if (narrative.cross_asset_narrative) selected.push('cross_asset');
  if (narrative.positioning_observations) selected.push('positioning');
  const extras = [];
  if (/yield|rates|treasury|bond|fixed/.test(c)) extras.push('yield_curve', 'macro_trans');
  if (/ai|semiconductor|tech|chip|nvda/.test(c)) extras.push('ai_semis', 'breadth');
  if (/etf|rotation|sector|flow/.test(c))        extras.push('sector_rotation', 'breadth');
  if (/dollar|dxy|inflation|liquidity/.test(c))  extras.push('macro_trans');
  for (const e of extras) {
    const field = ALL_LENSES[e];
    if (!selected.includes(e) && field && narrative[field]) selected.push(e);
    if (selected.length >= 4) break;
  }
  if (!selected.includes('volatility') && narrative.volatility_context && selected.length < 4) selected.push('volatility');
  if (!selected.includes('breadth')    && narrative.breadth_narrative   && selected.length < 4) selected.push('breadth');
  return selected.slice(0, 4);
}

function buildNarrativeContext(narrative, selectedLenses, transitionNote) {
  if (!narrative || narrative.data_source === 'structural_fallback') {
    return narrative && narrative.macro_narrative
      ? `Structural regime context: ${narrative.macro_narrative}`
      : null;
  }

  const LENS_LABELS = {
    cross_asset: 'CROSS-ASSET SIGNALS',
    yield_curve: 'YIELD CURVE DYNAMICS',
    breadth:     'MARKET BREADTH & PARTICIPATION',
    volatility:  'VOLATILITY ENVIRONMENT',
    sector_rotation: 'SECTOR ROTATION',
    ai_semis:    'AI & SEMICONDUCTOR CYCLE',
    macro_trans: 'MACRO TRANSMISSION',
    positioning: 'POSITIONING OBSERVATIONS',
  };

  const sections = [];
  if (narrative.macro_narrative) sections.push(`MACRO ENVIRONMENT:\n${narrative.macro_narrative}`);

  for (const lens of selectedLenses) {
    const field = ALL_LENSES[lens];
    const text  = field && narrative[field];
    if (!text || sections.some(s => s.includes(text.slice(0, 40)))) continue;
    sections.push(`${LENS_LABELS[lens] || lens.toUpperCase()}:\n${text}`);
  }

  const mi = narrative.market_internals;
  if (mi && mi.sectors_total > 0) {
    const lines = [];
    if (mi.sector_breadth_score != null) {
      lines.push(`Sector breadth: ${mi.breadth_signal.replace(/_/g,' ')} (${mi.sectors_positive}/${mi.sectors_total} sectors advancing, ${mi.sector_breadth_score}%)`);
    }
    if (mi.small_caps_relative_strength != null) {
      const sc = mi.small_caps_relative_strength;
      lines.push(`Small-cap vs large-cap: IWM ${sc >= 0 ? 'outperforming' : 'underperforming'} SPY by ${Math.abs(sc).toFixed(1)}pp`);
    }
    if (mi.participation_quality && mi.participation_quality !== 'unverified') {
      lines.push(`Participation quality: ${mi.participation_quality.replace(/_/g,' ')}`);
    }
    if (lines.length) sections.push(`MARKET INTERNALS (computed):\n${lines.join('\n')}`);
  }

  if (transitionNote) sections.push(`REGIME TRANSITION:\n${transitionNote}`);
  return sections.join('\n\n') || null;
}

function buildCalendarSummary(calendar) {
  const today  = new Date().toISOString().slice(0, 10);
  const events = ((calendar && calendar.events) || [])
    .filter(e => e.date >= today && e.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  return events.length
    ? events.map(e => `${e.date}: ${e.name} (${e.impact_level || 'unknown'} impact)`).join('\n')
    : 'No confirmed upcoming events. Reference standard catalyst cadence: monthly CPI, PCE, NFP, FOMC schedule.';
}

// ── Prompt architecture: split into 4 layers ──────────────────────────────────

function buildSystemCore() {
  // [A] Role, voice, compliance — intentionally concise; analytical requirements are in user prompt
  return `You are a senior cross-asset macro strategist writing institutional research for sophisticated allocators. Your readers — portfolio managers, macro traders, institutional analysts — understand yield curves, factor tilts, vol regimes, and sector mechanics without definitions.

VOICE: Macro desk note. Analytical conviction calibrated with hedged precision. Every analytical claim anchored to named instruments, spread relationships, yield levels, or verified data.

COMPLIANCE: Educational market commentary only. No trade recommendations. No price targets. All directional calls are conditional: "If [catalyst], [mechanism] would [impact named instrument]."

ABSOLUTE PROHIBITIONS — any of these in your output will cause hard rejection:
- "you should buy", "you should sell", "guaranteed returns", "buy now", "sell now"
- "various macroeconomic factors", "navigating a complex landscape", "market participants are closely monitoring"
- "it remains to be seen", "dynamic market landscape", "at the end of the day", "broadly speaking"`;
}

function buildMarketContextLayer(topic, fw, narrativeContext, calendarText) {
  const today = new Date().toISOString().slice(0, 10);
  const lensesText = fw.lenses.map((l, i) => `${i + 1}. ${l}`).join('\n');
  const dataBlock = narrativeContext
    ? `Narrative engine context:\n${narrativeContext}`
    : 'Data status: no live market data. Use structural mechanism analysis and do not imply knowledge of today\'s tape.';

  return `market_context
Topic: ${topic.title_en}
Research module: ${fw.module}
Date: ${today}
Macro tags: ${(topic.macro_tags || []).join(', ') || 'general markets'}
Key instruments: ${fw.instruments}
Macro transmission mechanism: ${fw.mechanism}
Analytical lenses:
${lensesText}
Directional bias context: ${fw.bias_note}
${dataBlock}
Calendar:
${calendarText}`;
}

function buildAnalyticalRequirementsLayer() {
  const biasOptions = [...ALLOWED_BIASES].join(' | ');
  return `analytical_requirements
1. key_drivers must use: [Verified Signal] -> [Mechanism] -> [Named Instrument Impact].
2. bullish_scenario and bearish_scenario must be distinct and each must include catalyst, transmission mechanism, affected instruments, and market implication.
3. directional_bias must be one of exactly: ${biasOptions}.
4. Reference at least two named instruments across the analytical sections.
5. Specificity can be ticker/instrument based or macro institutional: yield curve, duration, breadth, participation, liquidity, volatility regime, risk appetite, positioning, sector rotation, or transmission mechanism.
6. Each analytical section must contain institutional signal density; avoid generic market structure prose.
7. executive_summary must state the normalized directional stance and the structural condition behind it.`;
}

function buildFormattingRequirementsLayer() {
  const biasOptions = [...ALLOWED_BIASES].join(' | ');
  return `formatting_requirements
Minimum lengths: executive_summary >= 45 words, market_context >= 75 words, bullish_scenario >= 45 words, bearish_scenario >= 45 words.
key_drivers: exactly 3 items, each at least 2 full sentences with [Signal -> Mechanism -> Impact].
risk_factors: exactly 5 items, each specific to this theme's mechanics.
what_to_watch: exactly 5 items, each naming a specific instrument, data release, or cross-asset relationship.
Avoid retail phrases, promotional language, financial advice, generic filler, and broad unsupported claims.
Return only valid JSON with this shape:
{
  "executive_summary": "2-3 sentences with stance, condition, and named instrument or spread relationship.",
  "market_context": "4-6 sentences with structural dynamics, cross-asset relationships, breadth, volatility regime, and at least two analytical lenses.",
  "directional_bias": "${biasOptions}",
  "bullish_scenario": "Named catalyst -> transmission mechanism -> affected instruments -> market implication.",
  "bearish_scenario": "Different named catalyst -> different mechanism -> affected instruments -> market implication.",
  "key_drivers": ["Driver 1", "Driver 2", "Driver 3"],
  "risk_factors": ["Risk 1", "Risk 2", "Risk 3", "Risk 4", "Risk 5"],
  "what_to_watch": ["Signal 1", "Signal 2", "Signal 3", "Signal 4", "Signal 5"]
}`;
}

function buildEnUserPrompt(topic, fw, narrativeContext, calendarText) {
  const promptLayers = {
    system_core: 'provided in system message',
    market_context: buildMarketContextLayer(topic, fw, narrativeContext, calendarText),
    analytical_requirements: buildAnalyticalRequirementsLayer(),
    formatting_requirements: buildFormattingRequirementsLayer(),
  };

  return `Write institutional market outlook analysis for the following topic.

${promptLayers.market_context}

${promptLayers.analytical_requirements}

${promptLayers.formatting_requirements}`;
}

function buildLegacyEnUserPrompt(topic, fw, narrativeContext, calendarText) {
  const today       = new Date().toISOString().slice(0, 10);
  const biasOptions = [...ALLOWED_BIASES].join(' | ');
  const lensesText  = fw.lenses.map((l, i) => `${i + 1}. ${l}`).join('\n');

  const dataBlock = narrativeContext
    ? `MARKET CONTEXT (data-grounded, from narrative engine):\n\n${narrativeContext}`
    : 'DATA STATUS: No live market data. Write structural analysis using mechanism frameworks and historical patterns. Do not reference specific current levels or imply knowledge of today\'s tape.';

  return `Write institutional market outlook analysis for the following topic.

═══ TOPIC ═══
Title: ${topic.title_en}
Research Module: ${fw.module}
Date: ${today}
Macro Tags: ${(topic.macro_tags || []).join(', ') || 'general markets'}

═══ ANALYTICAL FRAMEWORK ═══
Key Instruments: ${fw.instruments}
Macro Transmission Mechanism: ${fw.mechanism}
Analytical Lenses (incorporate at least 2 into market_context):
${lensesText}
Directional Bias Context: ${fw.bias_note}

═══ ${dataBlock} ═══

═══ CALENDAR ═══
${calendarText}

═══ ANALYTICAL REQUIREMENTS ═══
1. TRANSMISSION CHAINS — key_drivers MUST use: [Verified Signal] → [Mechanism] → [Named Instrument Impact]
2. SCENARIOS — bullish and bearish MUST have DISTINCT named catalysts (not mirror images); each must state catalyst → mechanism → affected instrument
3. DIRECTIONAL BIAS — one of exactly: ${biasOptions}
4. INSTRUMENTS — reference ≥2 named instruments from the Key Instruments list across the analytical sections
5. SPECIFICITY — avoid abstract macro statements without instrument anchors; name ETFs, yield levels, spreads, or sector relationships
6. ANALYTICAL LENSES — weave ≥2 of the listed lenses into market_context (breadth, vol, cross-asset, positioning, etc.)

═══ LANGUAGE REQUIREMENTS ═══
Write as a macro desk research note. AVOID:
- "stocks may rise/fall", "investors may buy/sell", "market could go up/down"
- "all eyes are on", "game changer", "perfect storm", "unprecedented times"
- "in conclusion,", "to summarize,", "it is worth noting that", "it is important to note"
- "in the long run" (use "across this rate cycle" or "through the easing path")
- Passive state descriptions ("the market is experiencing", "conditions remain challenging")

PREFER:
- "market participants are repricing duration expectations"
- "cross-asset flows remain supportive of long-duration exposure"
- "breadth deterioration may indicate increasingly selective participation"
- "vol compression suggests reduced near-term uncertainty pricing"

═══ OUTPUT REQUIREMENTS ═══
MINIMUM LENGTHS (enforced at validation): executive_summary ≥ 45 words, market_context ≥ 75 words, each scenario ≥ 45 words.
key_drivers: exactly 3 items, each ≥ 2 full sentences with explicit [Signal → Mechanism → Impact] chain.
risk_factors: exactly 5 items, each specific to this theme's mechanics (not generic global risks).
what_to_watch: exactly 5 items, each naming a specific instrument, data release, or cross-asset relationship.

Return ONLY valid JSON — no markdown, no preamble, no explanation:
{
  "executive_summary": "2-3 sentences. State the directional stance AND primary structural condition. Reference ≥1 named instrument or spread relationship.",
  "market_context": "4-6 sentences. Name structural dynamics, cross-asset relationships, breadth signals, and vol context specific to this theme. Must incorporate ≥2 of the analytical lenses.",
  "directional_bias": "${biasOptions}",
  "bullish_scenario": "2-3 sentences. Named catalyst (e.g. 'If June CPI prints below 3%...') → transmission mechanism → named instrument impact. Distinct catalyst from bearish.",
  "bearish_scenario": "2-3 sentences. DIFFERENT named catalyst → different mechanism → named instrument pressure. NOT the inverse of bullish.",
  "key_drivers": [
    "[Driver label]: [Signal] → [Mechanism] → [Instrument impact]. 2 complete sentences with this chain.",
    "[Driver label]: [Signal] → [Mechanism] → [Impact]. 2 sentences.",
    "[Driver label]: [Signal] → [Mechanism] → [Impact]. 2 sentences."
  ],
  "risk_factors": [
    "Risk 1: specific to this theme with mechanism named",
    "Risk 2: specific with transmission",
    "Risk 3: specific to this cluster",
    "Risk 4: specific",
    "Risk 5: specific"
  ],
  "what_to_watch": [
    "Named data release with timing (e.g. June PCE print)",
    "Named instrument signal or threshold (e.g. TLT close below 90)",
    "Named policy or event trigger with mechanism",
    "Named fundamental metric or spread to track",
    "Named cross-asset relationship or breadth signal"
  ]
}`;
}

function buildArSystemPrompt() {
  return `أنت محلل أبحاث أسواق مالية متمرس في منصة TradeAlphaAI، تكتب لجمهور عربي من المستثمرين والمحللين الماليين المحترفين على دراية بسياسات الاحتياطي الفيدرالي ومنحنى العائد وديناميكيات الأسواق.

أسلوبك التحليلي:
- المصطلحات المالية العربية الدقيقة: العائد، منحنى العائد، الانتشار، الزخم، التناوب القطاعي، السيولة، الاتساع، التركيز
- أسماء الأدوات تبقى بالإنجليزية: TLT, QQQ, NVDA, SMH, SPY, IWM, XLK, XLF, GLD, DXY, VIX
- لا ترجمة حرفية — تحليل أصيل بالعربية بأسلوب مذكرات الأبحاث المؤسسية
- سلاسل استدلال: [إشارة] → [آلية السوق] → [أثر على أداة مسماة]
- لا جمل إنجليزية كاملة في المتن — الأسماء التجارية فقط
- التحليل مشروط وتعليمي، بلا توصيات استثمارية`;
}

function buildArUserPrompt(topic, enContent) {
  const biasMap = {
    'cautiously bullish':   'صاعد بحذر',
    'neutral':              'محايد',
    'cautiously bearish':   'هابط بحذر',
    'mixed / range-bound':  'مختلط',
    'elevated uncertainty': 'عدم يقين مرتفع',
  };
  const targetBias = biasMap[enContent.directional_bias] || 'محايد';
  const today = new Date().toISOString().slice(0, 10);

  return `المهمة: اكتب النسخة العربية من التحليل المؤسسي أدناه.

الموضوع: ${topic.title_ar || topic.title_en}
التاريخ: ${today}

التعليمات الإلزامية:
1. تحليل أصيل بالعربية — ليس ترجمة حرفية
2. أسماء الأدوات بالإنجليزية فقط: TLT, IEF, QQQ, SPY, IWM, SMH, NVDA, AMD, XLK, XLF, XLE, XLU, XLV, BND, GLD, DXY, VIX
3. لا جمل إنجليزية في المتن — الأسماء التجارية فقط
4. الميل الاتجاهي بالضبط: "${targetBias}"
5. الحد الأدنى: الملخص ≥ 50 كلمة عربية، السياق ≥ 70 كلمة، كل سيناريو ≥ 45 كلمة
6. العوامل الرئيسية: [إشارة] → [آلية] → [أداة مسماة]

التحليل المرجعي (للاستدلال — لا للترجمة):
${JSON.stringify(enContent, null, 2)}

أعد ONLY valid JSON:
{
  "executive_summary": "جملتان-ثلاث. الميل والشرط الرئيسي مع أداة مالية.",
  "market_context": "أربع-ست جمل. ديناميكيات هيكلية وعلاقات بين الأصول وإشارات اتساع.",
  "directional_bias": "${targetBias}",
  "bullish_scenario": "جملتان-ثلاث. محفز مسمى → آلية → أثر على أداة مسماة.",
  "bearish_scenario": "جملتان-ثلاث. محفز مختلف → آلية مختلفة → ضغط على أداة.",
  "key_drivers": ["العامل 1: إشارة → آلية → أداة. جملتان.", "العامل 2: نفس البنية.", "العامل 3: نفس البنية."],
  "risk_factors": ["خطر محدد 1", "خطر محدد 2", "خطر محدد 3", "خطر محدد 4", "خطر محدد 5"],
  "what_to_watch": ["بيانات محددة", "إشارة أداة محددة", "محفز سياسي", "مقياس أساسي", "علاقة بين الأصول"]
}`;
}

// ── OpenAI call ───────────────────────────────────────────────────────────────

function callOpenAI(systemPrompt, userPrompt, apiKey, { maxTokens = 2000, temperature = 0.75 } = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model:           MODEL,
      messages:        [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      temperature,
      max_tokens:      maxTokens,
      response_format: { type: 'json_object' },
    });

    const options = {
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers:  {
        'Authorization':  `Bearer ${apiKey}`,
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: TIMEOUT_MS,
    };

    const req = https.request(options, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const raw    = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw);
          if (parsed.error) { reject(new Error(`OpenAI: ${parsed.error.message}`)); return; }
          const text = parsed.choices?.[0]?.message?.content;
          if (!text) { reject(new Error('OpenAI returned empty content')); return; }
          resolve(JSON.parse(text));
        } catch (e) { reject(new Error(`Parse error: ${e.message}`)); }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error(`Request timed out after ${TIMEOUT_MS}ms`)); });
    req.write(body);
    req.end();
  });
}

// ── Section-level validation ───────────────────────────────────────────────────

function validateSections(en) {
  const results = {};
  const normalizedBias = normalizeBias(en.directional_bias) || en.directional_bias;

  for (const [field, min] of Object.entries(MIN_WORDS_EN)) {
    const text      = String(en[field] || '');
    const wc        = countWords(text);
    const instScore = detectInstitutionalPhrasing(text);
    const instrHits = INSTRUMENT_PATTERNS.filter(p => p.test(text)).length;
    const macroHits = MACRO_PATTERNS.filter(p => p.test(text)).length;
    const specificityHits = instrHits + macroHits;
    const hasBias = field === 'executive_summary'
      ? /\b(cautiously bullish|cautiously bearish|neutral-to-constructive|selective risk-on|defensive|risk-off stabilization|elevated uncertainty|mixed|range-bound|neutral|constructive|risk-on|risk-off)\b/i.test(text)
      : true;
    results[field]  = {
      word_count: wc,
      min_words: min,
      inst_score: instScore,
      instrument_hits: instrHits,
      macro_hits: macroHits,
      specificity_hits: specificityHits,
      has_directional_bias: hasBias,
      ok: wc >= min && instScore >= 1 && specificityHits >= 1 && hasBias
    };
  }

  // Scenario structural checks
  for (const scenario of ['bullish_scenario', 'bearish_scenario']) {
    const text  = String(en[scenario] || '');
    const lower = text.toLowerCase();
    const wc    = countWords(text);
    const hasCatalyst   = /\bif\b|\bwhen\b|\bshould\b|catalyst|surprise|trigger|exceed|miss|spike|collapse|above|below|print/.test(lower);
    const hasMechanism  = /transmission|mechanism|yield|spread|rotation|pressure|compress|reprice|flow|liquidity|duration|breadth|participation|positioning|risk appetite|steepen|flatten/.test(lower);
    const hasInstrument = [...INSTRUMENT_PATTERNS, ...MACRO_PATTERNS].some(p => p.test(text));
    const hasImplication = /implies|implication|would|could|pressure|support|reprice|tighten|widen|rotate|flows?|risk-on|risk-off|defensive|constructive/.test(lower);
    const instScore = detectInstitutionalPhrasing(text);
    const instrHits = INSTRUMENT_PATTERNS.filter(p => p.test(text)).length;
    const macroHits = MACRO_PATTERNS.filter(p => p.test(text)).length;
    results[scenario]   = {
      word_count: wc,
      min_words: 45,
      inst_score: instScore,
      instrument_hits: instrHits,
      macro_hits: macroHits,
      specificity_hits: instrHits + macroHits,
      has_catalyst: hasCatalyst,
      has_mechanism: hasMechanism,
      has_instrument: hasInstrument,
      has_market_implication: hasImplication,
      scenario_detected: hasCatalyst && hasMechanism && hasInstrument && hasImplication,
      ok: wc >= 45 && instScore >= 1 && hasCatalyst && hasMechanism && hasInstrument && hasImplication
    };
  }

  // key_drivers chain check
  if (Array.isArray(en.key_drivers)) {
    const withChain = en.key_drivers.filter(d => /→|->|leads?\s+to|results?\s+in|triggers?|compresses?|expands?|supports?|pressures?/.test(d || ''));
    const combined = en.key_drivers.join(' ');
    const instScore = detectInstitutionalPhrasing(combined);
    const instrHits = INSTRUMENT_PATTERNS.filter(p => p.test(combined)).length;
    const macroHits = MACRO_PATTERNS.filter(p => p.test(combined)).length;
    results.key_drivers = {
      count: en.key_drivers.length,
      with_chain: withChain.length,
      inst_score: instScore,
      instrument_hits: instrHits,
      macro_hits: macroHits,
      specificity_hits: instrHits + macroHits,
      ok: en.key_drivers.length >= 3 && withChain.length >= 2 && instScore >= 1 && (instrHits + macroHits) >= 2
    };
  }

  results.directional_bias = {
    value: en.directional_bias || '',
    normalized: normalizedBias || null,
    ok: Boolean(normalizedBias && ALLOWED_BIASES.has(normalizedBias))
  };

  return results;
}

function logSectionDiagnostics(sections, label) {
  process.stderr.write(`[DEBUG] ${label} section diagnostics:\n`);
  for (const [field, s] of Object.entries(sections)) {
    if (s.word_count !== undefined) {
      const chain = (s.instrument_hits !== undefined) ? ` instr=${s.instrument_hits} macro=${s.macro_hits} inst_density=${s.inst_score}` : '';
      process.stderr.write(`  ${field}: words=${s.word_count}/${s.min_words}${chain} ${s.ok ? '✓' : '✗'}\n`);
    } else if (s.count !== undefined) {
      process.stderr.write(`  key_drivers: ${s.count} items, ${s.with_chain} with chain ${s.ok ? '✓' : '✗'}\n`);
    } else {
      const flags = [s.has_catalyst ? 'catalyst✓' : 'catalyst✗', s.has_mechanism ? 'mech✓' : 'mech✗', s.has_instrument ? 'instr✓' : 'instr✗'];
      process.stderr.write(`  ${field}: words=${s.word_count}/45 [${flags.join(' ')}] ${s.ok ? '✓' : '✗'}\n`);
    }
  }
}

function buildExpansionPrompt(en, sectionIssues) {
  const weak = Object.entries(sectionIssues).filter(([, v]) => !v.ok);
  if (!weak.length) return null;

  const tasks = weak.map(([field, issue]) => {
    const reasons = [];
    if (issue.word_count !== undefined && !issue.ok) reasons.push(`word count ${issue.word_count} below minimum ${issue.min_words}`);
    if (issue.inst_score !== undefined && issue.inst_score < 1) reasons.push(`low institutional density (${issue.inst_score} signals)`);
    if (issue.has_catalyst === false) reasons.push('missing explicit conditional catalyst (if/when/should/surprise)');
    if (issue.has_mechanism === false) reasons.push('missing named transmission mechanism');
    if (issue.has_instrument === false) reasons.push('missing named instrument, ETF, yield, or market relationship');
    if (issue.with_chain !== undefined && issue.with_chain < 2) reasons.push(`only ${issue.with_chain}/${issue.count} drivers have [Signal → Mechanism → Impact] chain`);
    return `  • ${field}: ${reasons.join('; ')}`;
  });

  return `The following market analysis has weak sections. Expand ONLY the flagged sections below. All other sections must be returned EXACTLY as provided — do not modify them.

SECTIONS REQUIRING EXPANSION:
${tasks.join('\n')}

EXPANSION REQUIREMENTS:
- Add specific cross-asset reasoning (yield spreads, duration, breadth, vol regime, sector rotation)
- Include explicit [Signal → Mechanism → Named Instrument Impact] chains in expanded sections
- For scenarios: add explicit conditional catalyst ("If [specific release/level]...") with mechanism and instrument impact
- Use institutional register — no retail phrases, no generic filler
- Reference at least one named instrument per expanded section

CURRENT ANALYSIS (return ALL fields; only expand the flagged ones):
${JSON.stringify(en, null, 2)}

Return the COMPLETE JSON object with all fields.`;
}

// ── Main validation ───────────────────────────────────────────────────────────

function logSectionDiagnostics(sections, label) {
  process.stderr.write(`[DEBUG] ${label} section diagnostics:\n`);
  for (const [field, s] of Object.entries(sections)) {
    if (s.value !== undefined) {
      process.stderr.write(`  ${field}: value="${s.value}" normalized="${s.normalized || ''}" ${s.ok ? 'ok' : 'fail'}\n`);
    } else if (s.count !== undefined) {
      process.stderr.write(`  ${field}: items=${s.count} chains=${s.with_chain} instr=${s.instrument_hits} macro=${s.macro_hits} specificity=${s.specificity_hits} inst_density=${s.inst_score} ${s.ok ? 'ok' : 'fail'}\n`);
    } else if (s.word_count !== undefined) {
      const quality = `instr=${s.instrument_hits || 0} macro=${s.macro_hits || 0} specificity=${s.specificity_hits || 0} inst_density=${s.inst_score || 0}`;
      const scenario = s.scenario_detected !== undefined
        ? ` catalyst=${s.has_catalyst ? 'yes' : 'no'} mechanism=${s.has_mechanism ? 'yes' : 'no'} instrument=${s.has_instrument ? 'yes' : 'no'} implication=${s.has_market_implication ? 'yes' : 'no'} scenario=${s.scenario_detected ? 'yes' : 'no'}`
        : '';
      const bias = s.has_directional_bias !== undefined ? ` bias=${s.has_directional_bias ? 'yes' : 'no'}` : '';
      process.stderr.write(`  ${field}: words=${s.word_count}/${s.min_words} ${quality}${scenario}${bias} ${s.ok ? 'ok' : 'fail'}\n`);
    } else {
      process.stderr.write(`  ${field}: ${JSON.stringify(s)}\n`);
    }
  }
}

function buildExpansionPrompt(en, sectionIssues) {
  const weak = Object.entries(sectionIssues).filter(([, v]) => !v.ok);
  if (!weak.length) return null;

  const tasks = weak.map(([field, issue]) => {
    const reasons = [];
    if (issue.word_count !== undefined && issue.word_count < issue.min_words) reasons.push(`word count ${issue.word_count} below minimum ${issue.min_words}`);
    if (issue.inst_score !== undefined && issue.inst_score < 1) reasons.push(`low institutional density (${issue.inst_score} signals)`);
    if (issue.specificity_hits !== undefined && issue.specificity_hits < 1) reasons.push('missing specificity hits');
    if (issue.has_directional_bias === false) reasons.push('missing directional bias language');
    if (issue.has_catalyst === false) reasons.push('missing catalyst');
    if (issue.has_mechanism === false) reasons.push('missing transmission mechanism');
    if (issue.has_instrument === false) reasons.push('missing affected instrument');
    if (issue.has_market_implication === false) reasons.push('missing market implication');
    if (issue.with_chain !== undefined && issue.with_chain < 2) reasons.push(`only ${issue.with_chain}/${issue.count} drivers have signal-mechanism-impact chains`);
    if (issue.value !== undefined && !issue.ok) reasons.push(`directional bias not accepted (${issue.value})`);
    return `  - ${field}: ${reasons.join('; ') || 'failed section validation'}`;
  });

  return `The following market analysis has weak sections. Expand ONLY the flagged sections below. Return all fields, but preserve unflagged fields exactly.

SECTIONS REQUIRING EXPANSION:
${tasks.join('\n')}

EXPANSION REQUIREMENTS:
- Add institutional macro specificity: yield curve, duration, breadth, participation, liquidity, volatility regime, risk appetite, positioning, sector rotation, or transmission mechanism.
- Include explicit [Signal -> Mechanism -> Named Instrument Impact] chains in expanded sections.
- For scenarios, include catalyst, transmission mechanism, affected instruments, and market implication.
- Use institutional register. Do not use retail phrases, promotional language, financial advice, or generic filler.
- Reference at least one named instrument or institutional macro pattern in every expanded section.

CURRENT ANALYSIS:
${JSON.stringify(en, null, 2)}

Return the COMPLETE JSON object with all fields.`;
}

function countWords(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }
function countArabicWords(text) { return (String(text || '').match(/[؀-ۿ]+/g) || []).length; }

function validateContent(en, ar) {
  const errors = [];

  // EN word counts
  for (const [field, min] of Object.entries(MIN_WORDS_EN)) {
    const wc = countWords(en[field]);
    if (wc < min) errors.push(`en.${field}: ${wc} words (minimum ${min})`);
  }

  // EN array fields
  if (!Array.isArray(en.key_drivers)   || en.key_drivers.length   < 3) errors.push('en.key_drivers must have 3+ items');
  if (!Array.isArray(en.risk_factors)  || en.risk_factors.length  < 3) errors.push('en.risk_factors must have 3+ items');
  if (!Array.isArray(en.what_to_watch) || en.what_to_watch.length < 3) errors.push('en.what_to_watch must have 3+ items');

  // EN directional bias
  if (!en.directional_bias) {
    errors.push('en.directional_bias missing');
  } else if (!ALLOWED_BIASES.has(en.directional_bias)) {
    const normalized = normalizeBias(en.directional_bias);
    if (normalized) {
      process.stderr.write(`[DEBUG] Bias normalized: "${en.directional_bias}" → "${normalized}"\n`);
      en.directional_bias = normalized;
    } else {
      errors.push(`en.directional_bias "${en.directional_bias}" not in allowed set`);
    }
  }

  const finalSectionResults = validateSections(en);
  logSectionDiagnostics(finalSectionResults, 'Final validation');
  for (const [field, result] of Object.entries(finalSectionResults)) {
    if (!result.ok) errors.push(`en.${field}: failed section validation`);
  }

  // Generic filler
  const enBody = [en.executive_summary, en.market_context, en.bullish_scenario, en.bearish_scenario, ...(en.key_drivers || [])].join(' ').toLowerCase();
  const foundFiller = GENERIC_PHRASES.filter(p => enBody.includes(p));
  if (foundFiller.length) errors.push(`EN generic filler: ${foundFiller.slice(0, 3).map(p => `"${p}"`).join(', ')}`);

  // Financial advice check (hard fail ≥1 hit)
  const adviceHits = detectFinancialAdvice(JSON.stringify(en));
  if (adviceHits.length) errors.push(`EN financial advice phrases (hard fail): ${adviceHits.map(p => `"${p}"`).join(', ')}`);

  // Retail phrasing (hard fail at ≥5 hits, warn below)
  const retailHits = detectRetailPhrasing(enBody);
  if (retailHits.length >= 5) {
    errors.push(`EN retail phrasing (${retailHits.length} hits — hard fail at 5): ${retailHits.slice(0, 3).map(p => `"${p}"`).join(', ')}`);
  } else if (retailHits.length > 0) {
    process.stderr.write(`[WARN] Retail phrasing (${retailHits.length} hit(s) — warning only): ${retailHits.map(p => `"${p}"`).join(', ')}\n`);
  }

  // Specificity (instruments + macro patterns combined)
  const enFull = [...Object.values(en).filter(v => typeof v === 'string'), ...(en.key_drivers || []), ...(en.risk_factors || []), ...(en.what_to_watch || [])].join(' ');
  const instrHits = INSTRUMENT_PATTERNS.filter(p => p.test(enFull)).length;
  const macroHits = MACRO_PATTERNS.filter(p => p.test(enFull)).length;
  process.stderr.write(`[DEBUG] Specificity: ${instrHits} instrument patterns, ${macroHits} macro patterns\n`);
  if (instrHits < 1 && macroHits < 3) {
    errors.push(`EN specificity: ${instrHits} instrument + ${macroHits} macro patterns — need ≥1 instrument or ≥3 macro patterns`);
  }

  // Institutional density (logged only — not a hard fail)
  const instScore = detectInstitutionalPhrasing(enBody);
  process.stderr.write(`[DEBUG] Institutional signal score: ${instScore}\n`);

  // Scenario presence
  if (!en.bullish_scenario || countWords(en.bullish_scenario) < 20) errors.push('en.bullish_scenario missing or too short');
  if (!en.bearish_scenario || countWords(en.bearish_scenario) < 20) errors.push('en.bearish_scenario missing or too short');

  // AR word counts
  for (const [field, min] of Object.entries(MIN_WORDS_AR)) {
    const wc = countArabicWords(ar[field]);
    if (wc < min) errors.push(`ar.${field}: ${wc} Arabic words (minimum ${min})`);
  }

  // AR arrays
  if (!Array.isArray(ar.key_drivers)   || ar.key_drivers.length   < 3) errors.push('ar.key_drivers must have 3+ items');
  if (!Array.isArray(ar.risk_factors)  || ar.risk_factors.length  < 3) errors.push('ar.risk_factors must have 3+ items');
  if (!Array.isArray(ar.what_to_watch) || ar.what_to_watch.length < 3) errors.push('ar.what_to_watch must have 3+ items');

  // AR directional bias
  if (!ar.directional_bias) {
    errors.push('ar.directional_bias missing');
  } else if (!ALLOWED_BIASES_AR.has(ar.directional_bias)) {
    process.stderr.write(`[WARN] ar.directional_bias "${ar.directional_bias}" not in strict set\n`);
  }

  // AR language purity
  const arBody = [ar.executive_summary, ar.market_context, ar.bullish_scenario, ar.bearish_scenario].join(' ')
    .replace(/\b(TradeAlphaAI|VIX|NASDAQ|S&P|ETF|CPI|NFP|PCE|FOMC|GDP|DXY|AI|USD|TLT|IEF|BND|QQQ|SPY|IWM|SMH|SOXX|NVDA|AMD|TSMC|TSM|ASML|XLK|XLF|XLE|XLU|XLV|XLI|XLRE|XLP|XLB|TIPS|TIP|GLD|SLV|GDX|DIA|RSP|SOXL)\b/gi, ' ')
    .replace(/\b[A-Z]{1,6}\b/g, ' ');
  if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){4,}/.test(arBody)) {
    errors.push('AR language: English prose runs detected');
  }

  // Anti-hallucination: banned phrases
  const enLower = JSON.stringify(en).toLowerCase();
  for (const phrase of ['data is not currently sourced', 'not currently sourced', 'editors should verify', 'placeholder', 'lorem ipsum']) {
    if (enLower.includes(phrase)) errors.push(`EN banned phrase: "${phrase}"`);
  }

  // Anti-hallucination: fabricated live-event phrases (structural mode only)
  const liveAvailable = typeof validateContent._liveStatus === 'string' &&
    ['live','partial'].includes(validateContent._liveStatus);
  if (!liveAvailable) {
    for (const phrase of ["as of today, markets", "in today's session", "this morning's trading", "yesterday's close showed", "surged to a fresh high today", "fell sharply in today"]) {
      if (enLower.includes(phrase)) errors.push(`Fabrication risk (no live data): "${phrase}"`);
    }
  }

  return errors;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function argValue(name) {
  const m = process.argv.find(a => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { process.stderr.write('OPENAI_API_KEY not set\n'); process.exit(1); }

  const slugArg = argValue('--slug');
  if (!slugArg) { process.stderr.write('--slug required\n'); process.exit(1); }

  const queue    = readJson(QUEUE_PATH,    { topics: [] });
  const calendar = readJson(CALENDAR_PATH, { events: [] });
  const regime   = readJson(REGIME_PATH,   {});
  const live     = readJson(LIVE_PATH,     {});

  const topic = (queue.topics || []).find(t => t.slug === slugArg);
  if (!topic) { process.stderr.write(`Topic not found: ${slugArg}\n`); process.exit(1); }

  const fw           = getTopicFramework(topic);
  const topicCluster = [topic.topic_cluster || '', topic.discovery_cluster || '', ...(topic.macro_tags || [])].join(' ');

  // Build interpretive narrative
  const narrative          = buildNarrative(live, regime, topicCluster);
  const transitionAnalysis = analyzeTransition(regime.state || {});
  const transitionNote     = transitionAnalysis.transition_note;
  const selectedLenses     = selectNarrativeLenses(topicCluster, narrative);

  process.stderr.write(`[AI] Module: ${fw.module}\n`);
  process.stderr.write(`[NARRATIVE] data_source=${narrative.data_source}, lenses=[${selectedLenses.join(', ')}]\n`);
  if (transitionNote) process.stderr.write(`[REGIME] ${transitionNote.slice(0, 100)}\n`);

  const narrativeContext   = buildNarrativeContext(narrative, selectedLenses, transitionNote);
  const calendarText       = buildCalendarSummary(calendar);
  const liveStatus         = (live?.metadata?.status) || 'fallback';
  validateContent._liveStatus = liveStatus;

  process.stderr.write(`[AI] Model: ${MODEL}  live_status=${liveStatus}\n`);

  // ── English generation ──────────────────────────────────────────────────────
  process.stderr.write(`[AI] Generating EN for: ${slugArg}\n`);
  let enContent;
  try {
    enContent = await callOpenAI(
      buildSystemCore(),
      buildEnUserPrompt(topic, fw, narrativeContext, calendarText),
      apiKey,
      { maxTokens: 2800, temperature: 0.75 }
    );
  } catch (err) {
    process.stderr.write(`[AI] EN generation failed: ${err.message}\n`);
    process.exit(1);
  }

  if (!enContent || typeof enContent !== 'object') {
    process.stderr.write('[AI] EN: response is not a JSON object\n');
    process.exit(1);
  }

  // Normalize bias immediately after generation
  if (enContent.directional_bias && !ALLOWED_BIASES.has(enContent.directional_bias)) {
    const norm = normalizeBias(enContent.directional_bias);
    if (norm) { process.stderr.write(`[DEBUG] Bias pre-normalized: "${enContent.directional_bias}" → "${norm}"\n`); enContent.directional_bias = norm; }
  }
  process.stderr.write(`[AI] EN generated. Bias: ${enContent.directional_bias}\n`);

  // ── Section-level validation + targeted expansion pass ─────────────────────
  const sectionResults = validateSections(enContent);
  logSectionDiagnostics(sectionResults, 'Initial');

  const weakSections = Object.entries(sectionResults).filter(([, v]) => !v.ok);
  if (weakSections.length > 0) {
    const weakNames = weakSections.map(([k]) => k);
    process.stderr.write(`[AI] Weak sections: ${weakNames.join(', ')} — running targeted expansion pass\n`);
    const expansionPrompt = buildExpansionPrompt(enContent, sectionResults);
    try {
      const expanded = await callOpenAI(
        buildSystemCore(),
        expansionPrompt,
        apiKey,
        { maxTokens: 2500, temperature: 0.65 }
      );
      if (expanded && typeof expanded === 'object') {
        // Merge expanded sections into enContent (only overwrite fields that existed and were weak)
        for (const field of weakNames) {
          if (expanded[field] !== undefined && field !== 'key_drivers') {
            enContent[field] = expanded[field];
          }
        }
        // For key_drivers specifically, only replace if the expanded version is actually better
        if (weakNames.includes('key_drivers') && Array.isArray(expanded.key_drivers) && expanded.key_drivers.length >= 3) {
          enContent.key_drivers = expanded.key_drivers;
        }
        // Re-normalize bias if expansion changed it
        if (expanded.directional_bias && !ALLOWED_BIASES.has(enContent.directional_bias)) {
          const norm = normalizeBias(expanded.directional_bias);
          if (norm) enContent.directional_bias = norm;
        }
        const postExpansion = validateSections(enContent);
        logSectionDiagnostics(postExpansion, 'Post-expansion');
      }
    } catch (expErr) {
      process.stderr.write(`[WARN] Expansion pass failed: ${expErr.message} — using initial output\n`);
    }
  }

  // ── Full word-count retry (if expansion didn't fully resolve) ──────────────
  const finalSections = validateSections(enContent);
  const stillWeak     = Object.entries(finalSections).filter(([k, v]) => !v.ok && MIN_WORDS_EN[k] !== undefined);
  if (stillWeak.length > 0 && stillWeak.every(([, v]) => v.word_count !== undefined)) {
    process.stderr.write(`[AI] Word count still insufficient after expansion — full retry with explicit length instruction\n`);
    const warnList = stillWeak.map(([f, v]) => `  ${f}: ${v.word_count} words (need ${v.min_words}+)`).join('\n');
    const retryNote = `\n\nRETRY NOTE: These sections were too short in the previous response:\n${warnList}\nWrite substantially longer, more analytically detailed sections. Each must hit the minimum word count.`;
    try {
      enContent = await callOpenAI(
        buildSystemCore(),
        buildEnUserPrompt(topic, fw, narrativeContext, calendarText) + retryNote,
        apiKey,
        { maxTokens: 3000, temperature: 0.75 }
      );
      if (enContent?.directional_bias && !ALLOWED_BIASES.has(enContent.directional_bias)) {
        const norm = normalizeBias(enContent.directional_bias);
        if (norm) enContent.directional_bias = norm;
      }
    } catch (retryErr) {
      process.stderr.write(`[AI] Full retry failed: ${retryErr.message}\n`);
      process.exit(1);
    }
  }

  // ── Arabic generation ───────────────────────────────────────────────────────
  process.stderr.write(`[AI] Generating AR for: ${slugArg}\n`);
  let arContent;
  try {
    arContent = await callOpenAI(
      buildArSystemPrompt(),
      buildArUserPrompt(topic, enContent),
      apiKey,
      { maxTokens: 2000, temperature: 0.65 }
    );
  } catch (err) {
    process.stderr.write(`[AI] AR generation failed: ${err.message}\n`);
    process.exit(1);
  }

  if (!arContent || typeof arContent !== 'object') {
    process.stderr.write('[AI] AR: response is not JSON object\n');
    process.exit(1);
  }
  process.stderr.write(`[AI] AR generated. Bias: ${arContent.directional_bias}\n`);

  // ── Combined validation ────────────────────────────────────────────────────
  let errors = validateContent(enContent, arContent);

  // One AR-only retry if only AR word counts failed
  const onlyArFails = errors.length > 0 && errors.every(e => e.startsWith('ar.') && /words? \(minimum/.test(e));
  if (onlyArFails) {
    process.stderr.write(`[AI] AR word counts insufficient — retrying AR\n`);
    const arRetryNote = `\n\nRETRY NOTE: Your Arabic sections were too short:\n${errors.join('\n')}\nWrite longer, more substantive Arabic paragraphs.`;
    try {
      arContent = await callOpenAI(
        buildArSystemPrompt(),
        buildArUserPrompt(topic, enContent) + arRetryNote,
        apiKey,
        { maxTokens: 2200, temperature: 0.65 }
      );
    } catch (e) {
      process.stderr.write(`[AI] AR retry failed: ${e.message}\n`);
    }
    errors = validateContent(enContent, arContent);
  }

  if (errors.length) {
    process.stderr.write(`[AI] Validation failed (${errors.length} error(s)):\n${errors.map(e => '  - ' + e).join('\n')}\n`);
    process.exit(1);
  }

  const finalInstScore = detectInstitutionalPhrasing(JSON.stringify(enContent));
  const finalInstrHits = INSTRUMENT_PATTERNS.filter(p => p.test(JSON.stringify(enContent))).length;
  process.stderr.write(`[AI] EN+AR validated. Instrument patterns: ${finalInstrHits}. Institutional score: ${finalInstScore}.\n`);
  process.stdout.write(JSON.stringify({ en: enContent, ar: arContent }));
}

main().catch(err => {
  process.stderr.write(`[AI] Unexpected error: ${err.message}\n`);
  process.exit(1);
});
