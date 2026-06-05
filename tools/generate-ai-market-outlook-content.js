'use strict';

// Phase 50: Institutional Market Narrative Engine — AI Content Generator
// Builds institutional-grade educational macro commentary for market outlook articles.
// Two-call bilingual generation: English first, Arabic second with EN as analytical context.
// Upgraded: narrative engine, dynamic section lenses, topic modules A-G, language filter.
//
// Usage: node tools/generate-ai-market-outlook-content.js --slug=<slug>
// Outputs structured JSON to stdout. Exits 1 on any failure.

const fs   = require('fs');
const path = require('path');
const https = require('https');

const { buildNarrative }       = require('./build-market-narrative');
const { analyzeTransition }    = require('./analyze-regime-transition');
const { detectRetailPhrasing, detectInstitutionalPhrasing } = require('./institutional-language-filter');

const ROOT          = path.resolve(__dirname, '..');
const QUEUE_PATH    = path.join(ROOT, 'data', 'market-outlook-queue.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');

const ALLOWED_BIASES    = new Set(['cautiously bullish', 'neutral', 'cautiously bearish', 'mixed / range-bound', 'elevated uncertainty']);
const ALLOWED_BIASES_AR = new Set(['صاعد بحذر', 'محايد', 'هابط بحذر', 'مختلط', 'عدم يقين مرتفع']);

const MODEL      = process.env.OPENAI_MODEL || 'gpt-4o';
const TIMEOUT_MS = 90000;

const MIN_WORDS_EN = { executive_summary: 45, market_context: 75, bullish_scenario: 45, bearish_scenario: 45 };
const MIN_WORDS_AR = { executive_summary: 30, market_context: 50, bullish_scenario: 30, bearish_scenario: 30 };

// Generic filler — reject generation if found
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

// Named instrument patterns — ≥ 2 required in EN analytical body
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

// ── Narrative lenses (dynamic section selection) ──────────────────────────────

const ALL_LENSES = {
  cross_asset:     { label: 'Cross-Asset Context',       topics: ['all'] },
  yield_curve:     { label: 'Yield Curve Dynamics',      topics: ['yield', 'rates', 'treasury', 'bond', 'fixed'] },
  liquidity:       { label: 'Liquidity Environment',     topics: ['dollar', 'dxy', 'inflation', 'rates', 'yield'] },
  breadth:         { label: 'Participation & Breadth',   topics: ['etf', 'rotation', 'broad', 'sector', 'small'] },
  volatility:      { label: 'Volatility Environment',    topics: ['vix', 'vol', 'options', 'hedge', 'all'] },
  sector_rotation: { label: 'Sector Rotation Framework', topics: ['etf', 'rotation', 'sector', 'flow'] },
  ai_semis:        { label: 'AI & Semiconductor Cycle',  topics: ['ai', 'semiconductor', 'tech', 'chip', 'nvda'] },
  macro_trans:     { label: 'Macro Transmission Chain',  topics: ['yield', 'rates', 'inflation', 'fed', 'fomc'] },
  positioning:     { label: 'Positioning Observations',  topics: ['all'] },
};

function selectNarrativeLenses(topicCluster, narrative) {
  const cluster = (topicCluster || '').toLowerCase();
  const selected = [];

  // Always include cross-asset and positioning if data available
  if (narrative.cross_asset_narrative) selected.push('cross_asset');
  if (narrative.positioning_observations) selected.push('positioning');

  // Topic-specific lenses (pick up to 2 additional)
  const extras = [];
  if (/yield|rates|treasury|bond|fixed/.test(cluster)) {
    extras.push('yield_curve', 'macro_trans', 'liquidity');
  }
  if (/ai|semiconductor|tech|chip|nvda/.test(cluster)) {
    extras.push('ai_semis', 'breadth');
  }
  if (/etf|rotation|sector|flow/.test(cluster)) {
    extras.push('sector_rotation', 'breadth');
  }
  if (/dollar|dxy|inflation|liquidity/.test(cluster)) {
    extras.push('liquidity', 'macro_trans', 'cross_asset');
  }
  if (/vix|vol|options|hedge/.test(cluster)) {
    extras.push('volatility');
  }

  // Add extras not already selected, up to 2 more
  for (const e of extras) {
    if (!selected.includes(e) && narrative[lensField(e)]) selected.push(e);
    if (selected.length >= 4) break;
  }

  // Always include volatility if we have data and have room
  if (!selected.includes('volatility') && narrative.volatility_context && selected.length < 4) {
    selected.push('volatility');
  }

  // Fill remaining slot with breadth if we have it
  if (!selected.includes('breadth') && narrative.breadth_narrative && selected.length < 4) {
    selected.push('breadth');
  }

  return selected.slice(0, 4);
}

function lensField(lensKey) {
  const map = {
    cross_asset:     'cross_asset_narrative',
    yield_curve:     'yield_curve_narrative',
    liquidity:       'cross_asset_narrative',
    breadth:         'breadth_narrative',
    volatility:      'volatility_context',
    sector_rotation: 'breadth_narrative',
    ai_semis:        'ai_semis_context',
    macro_trans:     'yield_curve_narrative',
    positioning:     'positioning_observations',
  };
  return map[lensKey] || null;
}

function buildNarrativeContext(narrative, selectedLenses, transitionNote, dataSource) {
  if (!narrative || dataSource === 'structural_fallback') {
    if (!narrative || !narrative.macro_narrative) return null;
    return `Macro context (structural framework): ${narrative.macro_narrative}`;
  }

  const sections = [];

  if (narrative.macro_narrative) {
    sections.push(`MACRO ENVIRONMENT:\n${narrative.macro_narrative}`);
  }

  for (const lens of selectedLenses) {
    const field = lensField(lens);
    const text  = field && narrative[field];
    if (!text) continue;
    const label = ALL_LENSES[lens] && ALL_LENSES[lens].label || lens;
    if (sections.some(s => s.includes(text.slice(0, 40)))) continue; // dedup
    sections.push(`${label.toUpperCase()}:\n${text}`);
  }

  if (narrative.market_internals && narrative.market_internals.sectors_total > 0) {
    const mi = narrative.market_internals;
    const lines = [];
    if (mi.sector_breadth_score != null) {
      lines.push(`Sector breadth: ${mi.breadth_signal.replace(/_/g,' ')} (${mi.sectors_positive}/${mi.sectors_total} sectors advancing, ${mi.sector_breadth_score}%)`);
    }
    if (mi.small_caps_relative_strength != null) {
      const sc = mi.small_caps_relative_strength;
      lines.push(`Small-cap vs large-cap: IWM ${sc >= 0 ? 'outperforming' : 'underperforming'} SPY by ${Math.abs(sc).toFixed(1)}pp`);
    }
    if (mi.concentration_score != null) {
      lines.push(`Participation quality: ${mi.participation_quality.replace(/_/g,' ')}`);
    }
    if (lines.length) sections.push(`MARKET INTERNALS (computed):\n${lines.join('\n')}`);
  }

  if (transitionNote) {
    sections.push(`REGIME TRANSITION CONTEXT:\n${transitionNote}`);
  }

  return sections.join('\n\n') || null;
}

// ── Topic-cluster-specific frameworks (A-G) ───────────────────────────────────

function getTopicFramework(topic) {
  const cluster = [
    topic.topic_cluster || '',
    topic.discovery_cluster || '',
    ...(topic.macro_tags || [])
  ].join(' ').toLowerCase();

  // A — Rates / Yields / Fixed Income
  if (/yield|rates|treasury|bond|fixed.income|rate.context/.test(cluster)) {
    return {
      module:      'A — Rates & Duration',
      instruments: 'TLT, IEF, BND, TIPS (TIP ETF), SHY, 10-year Treasury yield, 2-year Treasury yield, Fed funds rate, DXY',
      mechanism:   'Fed policy expectations → short-end rate path → yield curve shape (2Y10Y spread) → duration risk repricing → TLT/IEF ETF flows → equity valuation discount rates → sector rotation between rate-sensitive (XLU, XLRE) and rate-resistant (XLF, XLE) assets',
      catalysts:   'CPI or Core PCE release, FOMC decision and dot-plot update, NFP employment report, Treasury auction bid-to-cover ratio, Fed governor speeches on terminal rate',
      analytical_lenses: ['Cross-asset correlation between TLT and equities', 'Yield curve inversion depth and duration', '2Y yield vs Fed funds as market pricing signal', 'Real yield implications for gold and equities'],
      bias_note:   '"Cautiously bullish" means conditions are constructive for rate stability or normalization (supportive of duration); NOT a directional call on Treasury prices in isolation.',
    };
  }

  // B — AI / Semiconductors / Technology
  if (/ai|semiconductor|tech|chip|nvda|smd/.test(cluster)) {
    return {
      module:      'B — AI & Semiconductor Cycle',
      instruments: 'NVDA, AMD, SMH, SOXX, XLK, QQQ, SOXL (leveraged semi), ASML, TSM (TSMC)',
      mechanism:   'AI infrastructure capex cycle → hyperscaler GPU demand signals → NVDA/AMD revenue trajectory → SOX semiconductor index → XLK sector weight → QQQ constituent drag or lift → growth multiple sensitivity to 10Y yield path',
      catalysts:   'NVDA quarterly earnings report, hyperscaler capex guidance (MSFT, GOOGL, META, AMZN), US chip export control updates, TSMC capacity or pricing announcements, FOMC meeting (rate sensitivity for growth multiples)',
      analytical_lenses: ['NVDA as AI capex proxy vs broader market performance', 'SOX/SMH vs QQQ divergence (semi-specific vs broad tech)', 'Hyperscaler capex guidance as demand signal', 'Export control risk as binary option on policy path'],
      bias_note:   '"Cautiously bullish" means the capex cycle and demand signals are constructive for the theme; not a specific stock recommendation.',
    };
  }

  // C — ETF Rotation / Sector Flows
  if (/etf.rotation|rotation|sector.flow/.test(cluster)) {
    return {
      module:      'C — ETF Rotation & Sector Flows',
      instruments: 'SPY, QQQ, IWM (small cap), XLK (tech), XLF (financials), XLE (energy), XLU (utilities), XLV (healthcare), RSP (equal-weight S&P), BND',
      mechanism:   'Macro regime signal → risk appetite → factor tilt (growth vs value, large vs small cap) → sector ETF relative flows → breadth divergence (SPY vs QQQ, IWM vs SPY, RSP vs SPY) → portfolio rebalancing pressure',
      catalysts:   'ISM manufacturing or services print, FOMC, quarterly earnings season breadth signal, VIX regime transition, CPI surprise as rotation trigger',
      analytical_lenses: ['Equal-weight vs cap-weight divergence as breadth signal', 'IWM/SPY relative strength as risk appetite gauge', 'Defensive vs cyclical rotation by sector ETF', 'RSP vs SPY as small-constituent participation metric'],
      bias_note:   '"Cautiously bullish" means the regime supports risk positioning; not a recommendation on any specific ETF allocation.',
    };
  }

  // D — Defensive Sectors / Risk-off Positioning
  if (/defensive|utilities|healthcare|xlu|xlv|risk.off|safe.haven/.test(cluster)) {
    return {
      module:      'D — Defensive Sectors & Risk-Off',
      instruments: 'XLU (utilities), XLV (healthcare), XLP (consumer staples), TLT, GLD, VIX, IEF',
      mechanism:   'Risk regime deterioration → VIX expansion → capital rotation from cyclicals (XLK, XLF, XLE) to defensive (XLU, XLV, XLP) → TLT bid → inverse correlation between VIX and equity risk premia',
      catalysts:   'Surprise macro deterioration (NFP miss, ISM contraction), credit spread widening (LQD/HYG), geopolitical escalation, earnings disappointment in cyclical names, FOMC surprise hawkishness',
      analytical_lenses: ['XLU/XLV relative strength vs SPY as defensive rotation signal', 'VIX level as hedging demand proxy', 'TLT bid as capital rotation confirmation', 'Credit spread (LQD vs HYG) as risk-appetite barometer'],
      bias_note:   '"Cautiously bearish" or "elevated uncertainty" reflects risk-off positioning signals; not a call on any specific defensive security.',
    };
  }

  // E — Inflation / CPI / Real Assets
  if (/inflation|cpi|pce|real.asset|commodity|gold.inflation/.test(cluster)) {
    return {
      module:      'E — Inflation & Real Asset Dynamics',
      instruments: 'TIP (TIPS ETF), GLD, SLV, GDX, USO, DBA, TLT, IEF, DXY, BTC (as inflation hedge proxy)',
      mechanism:   'Inflation expectations → TIPS breakeven repricing → real yield direction → GLD and commodity demand → TLT/IEF duration pressure → Fed reaction function → rate path → DXY response',
      catalysts:   'CPI print (headline vs core), PCE deflator, PPI, 5Y5Y inflation breakeven level, FOMC meeting, oil supply/demand shock, wage growth (NFP), food commodity price surge',
      analytical_lenses: ['TIPS breakeven vs nominal yield as real yield signal', 'GLD vs DXY relationship as inflation hedge barometer', 'Energy (XLE, USO) as inflation proxy', 'TLT duration pressure under rising inflation expectations'],
      bias_note:   '"Cautiously bullish" reflects constructive real asset environment or contained inflation expectations; not a commodity price forecast.',
    };
  }

  // F — Dollar / Liquidity / Global Flows
  if (/dollar|dxy|liquidity|global.flow|usd|currency/.test(cluster)) {
    return {
      module:      'F — Dollar, Liquidity & Global Capital Flows',
      instruments: 'DXY, GLD, EEM (emerging markets), TLT, USO, GDX, TIP, VIX',
      mechanism:   'USD strength/weakness → global dollar liquidity conditions → EM capital flow reversal risk → commodity pressure (dollar-denominated) → gold and real asset demand → risk appetite across non-US markets',
      catalysts:   'Fed rate path relative to G10 central banks, Treasury issuance volume, cross-currency basis, EM current account dynamics, US fiscal deficit trajectory, geopolitical USD-flight demand',
      analytical_lenses: ['DXY level as global liquidity proxy', 'Dollar strength vs GLD/commodity inverse relationship', 'EM (EEM) relative performance as dollar sensitivity gauge', 'Cross-asset impact of USD moves on global risk appetite'],
      bias_note:   '"Cautiously bullish" reflects a softening dollar / improving liquidity environment supportive of non-dollar assets.',
    };
  }

  // G — Gold / Macro Hedging
  if (/gold|gld|gdx|precious|macro.hedge/.test(cluster)) {
    return {
      module:      'G — Gold & Macro Hedging',
      instruments: 'GLD, GDX (gold miners ETF), SLV, TIP, TLT, DXY, VIX',
      mechanism:   'Real yield direction → GLD opportunity cost → central bank accumulation demand → DXY inverse relationship → GDX operational leverage to gold price → tail risk hedging via GLD vs equity VIX-hedge substitution',
      catalysts:   'Fed rate decision (real yield impact), CPI print (inflation expectations), geopolitical shock, central bank reserve policy, dollar index breakout or reversal, sovereign debt stress signal',
      analytical_lenses: ['Real yield (10Y nominal minus TIPS breakeven) as GLD driver', 'GLD vs DXY inverse correlation stability', 'GDX vs GLD ratio as leverage signal', 'Gold as portfolio hedge vs VIX-based hedging alternatives'],
      bias_note:   '"Cautiously bullish" reflects constructive real yield / macro hedge conditions for gold; not a commodity price target.',
    };
  }

  // Default — Broad Market / Cross-Asset
  return {
    module:      'Z — Cross-Asset Macro',
    instruments: 'SPY, QQQ, IWM, VIX, TLT (duration proxy), GLD, DXY, IEF',
    mechanism:   'Macro regime signal → volatility regime (VIX) → cross-asset correlation shifts → risk-on vs risk-off positioning → relative strength rotation between equity (SPY/QQQ) and defensive assets (TLT/GLD/IEF)',
    catalysts:   'FOMC meeting, CPI or PCE print, earnings season breadth, credit market stress signal, geopolitical event',
    analytical_lenses: ['VIX level and regime as hedging demand barometer', 'SPY/QQQ/IWM divergence as breadth quality signal', 'TLT/equity correlation as cross-asset risk indicator', 'GLD/DXY as macro hedge vs dollar strength tension'],
    bias_note:   '"Cautiously bullish" means the environment supports risk-on positioning; not a call on any specific instrument.',
  };
}

// ── Market context builder ─────────────────────────────────────────────────────

function buildMarketDataSummary(live, regime, narrative, transitionAnalysis) {
  // Phase 50: use narrative engine output if live data available
  if (narrative && narrative.data_source === 'live' && narrative.macro_narrative) {
    return null; // narrative context block replaces this entirely for live data
  }

  // Structural fallback (no live data): use regime signals
  const r = (regime && regime.state) || {};
  const signals = Object.entries(r)
    .filter(([, vl]) => vl && vl !== 'unverified' && !Array.isArray(vl))
    .map(([k, vl]) => `${k.replace(/_/g, ' ')}: ${vl}`);
  return signals.length
    ? `Regime signals (structural, unverified): ${signals.join('. ')}`
    : 'No live market data available. Write structural analysis: how this mechanism operates in the current macro regime, historical behavioral patterns, and what regime shift would alter the outlook.';
}

function buildCalendarSummary(calendar) {
  const today  = new Date().toISOString().slice(0, 10);
  const events = ((calendar && calendar.events) || [])
    .filter(e => e.date >= today && e.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);
  return events.length
    ? events.map(e => `${e.date}: ${e.name} (${e.impact_level || 'unknown'} impact)`).join('\n')
    : 'No confirmed events in calendar. Reference the standard upcoming catalyst cadence (monthly CPI, PCE, NFP, FOMC schedule) structurally.';
}

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildEnSystemPrompt() {
  return `You are a senior cross-asset macro strategist writing institutional research for TradeAlphaAI's professional platform. Your readers are portfolio managers, macro traders, and sophisticated allocators who read BAML global rates strategy, Goldman macro views, and JPM cross-asset research. They understand yield curves, factor tilts, sector flows, and options pricing without definitions.

ANALYTICAL STANDARDS — NON-NEGOTIABLE:
- Every claim is anchored to a named instrument, yield level, spread relationship, or verified data point
- Transmission chains are explicit: [verified signal] → [market mechanism] → [named instrument impact] → [portfolio-level implication]
- Conditional calls reference real named catalysts: "If June CPI prints above 3.2%, 10-year yields may re-test resistance, compressing TLT duration and pressuring QQQ growth multiples"
- Bullish and bearish scenarios have DISTINCT catalysts — they are never mirror images
- Analytical conviction is calibrated: "historically correlated with", "tends to precede", "could amplify if", "conditional on"
- Breadth and participation signals are mentioned when relevant: narrow vs broad leadership, equal-weight vs cap-weight divergence, sector concentration risk
- Volatility context informs the analysis: VIX level, implied vol regime, complacency vs hedging demand
- Regime transitions are noted: "technology leadership remains strong, but narrowing breadth and renewed utilities participation may indicate a more selective risk environment"

INSTITUTIONAL LANGUAGE STANDARDS:
- Write as a macro desk note, not an SEO article
- Preferred: "market participants continue repricing duration expectations", "cross-asset flows remain supportive of long-duration exposure", "breadth deterioration may indicate increasingly selective participation"
- FORBIDDEN wording: "stocks may rise", "investors may buy", "market could go up", "in the long run", "perfect storm", "game changer", "unprecedented times", "all eyes are on", "it is worth noting that", "in conclusion,", "to summarize,", "time will tell"
- FORBIDDEN filler: "various macroeconomic factors", "navigating a complex landscape", "market participants are closely monitoring", "it remains to be seen", "dynamic market landscape", "complex macro environment", "broadly speaking", "at the end of the day", "macroeconomic backdrop remains"

This is educational market commentary. You do NOT recommend trades, price targets, or allocations. Frame all directional analysis conditionally: "If X materializes, instruments A and B tend to respond Z because of mechanism Y." The goal is to teach the reader to see the mechanism — not to tell them what to do.`;
}

function buildEnUserPrompt(topic, fw, narrativeContext, calendarText) {
  const today = new Date().toISOString().slice(0, 10);
  const biasOptions = [...ALLOWED_BIASES].join(' | ');

  const narrativeSection = narrativeContext
    ? `INSTITUTIONAL MARKET CONTEXT (data-grounded, narrative engine output):\n\n${narrativeContext}`
    : 'MARKET DATA: No live data available. Write structural analysis using the mechanism framework and historical patterns. Do not reference specific current levels.';

  return `Write institutional-grade market outlook analysis for the following topic.

TOPIC: ${topic.title_en}
RESEARCH MODULE: ${fw.module}
DATE: ${today}
MACRO TAGS: ${(topic.macro_tags || []).join(', ') || 'general markets'}

RELEVANT INSTRUMENTS FOR THIS THEME:
${fw.instruments}

MACRO TRANSMISSION MECHANISM FOR THIS CLUSTER:
${fw.mechanism}

CLUSTER-SPECIFIC ANALYTICAL LENSES (weave at least 2 into the analysis):
${fw.analytical_lenses.map((l, i) => `${i + 1}. ${l}`).join('\n')}

DIRECTIONAL BIAS CONTEXT:
${fw.bias_note}

${narrativeSection}

UPCOMING ECONOMIC EVENTS:
${calendarText}

REQUIREMENTS:
1. Reference AT LEAST 2 named instruments from the "Relevant Instruments" list in analytical sections
2. key_drivers MUST follow this chain: [Verified Signal or Data Input] → [Market Mechanism] → [Impact on Named Instrument or Sector]
3. Bullish and bearish scenarios MUST have different named catalysts — not mirror images
4. risk_factors must be specific to this theme's instruments and mechanics, not generic global risks
5. what_to_watch must name specific data releases, instrument thresholds, or cross-asset relationships
6. Use the analytical lenses above to shape the market_context — address breadth, participation, volatility regime, or cross-asset context as relevant
7. INSTITUTIONAL LANGUAGE REQUIRED: write as a macro research desk note. Avoid retail-style phrases and low-information filler
8. Source discipline: if narrative context shows data_source=structural_fallback, write about structural dynamics and historical patterns without referencing specific current levels
9. MINIMUM LENGTHS (enforced at validation): executive_summary ≥ 45 words, market_context ≥ 75 words, each scenario ≥ 45 words
10. key_drivers: 3 items, each ≥ 2 full sentences with explicit chain structure above
11. risk_factors: 5 specific items tied to this theme's mechanics
12. what_to_watch: 5 items each naming a specific instrument, release, or threshold

Return ONLY valid JSON — no markdown, no explanation:
{
  "executive_summary": "2-3 sentences. State the directional research stance AND the primary structural condition. Reference at least one named instrument or relationship.",
  "market_context": "4-6 sentences. Name structural dynamics, cross-asset relationships, breadth signals, or volatility context specific to this theme. Weave in the analytical lenses.",
  "directional_bias": "${biasOptions}",
  "bullish_scenario": "2-3 sentences. Named catalyst → transmission mechanism → named instrument impact. Distinct catalyst from bearish.",
  "bearish_scenario": "2-3 sentences. Different named catalyst → different mechanism → named instrument pressure. NOT the inverse of bullish.",
  "key_drivers": [
    "[Driver label]: [Verified Signal] → [Mechanism] → [Instrument impact]. 2 complete sentences.",
    "[Driver label]: [Signal] → [Mechanism] → [Impact]. 2 sentences.",
    "[Driver label]: [Signal] → [Mechanism] → [Impact]. 2 sentences."
  ],
  "risk_factors": [
    "Specific risk tied to this theme's instruments or catalysts with mechanism named",
    "Second specific risk with transmission named",
    "Third risk specific to this cluster",
    "Fourth specific risk",
    "Fifth specific risk"
  ],
  "what_to_watch": [
    "Named data release with timing context (e.g. June PCE print, July FOMC)",
    "Named instrument signal or threshold (e.g. TLT close below 90, VIX above 25)",
    "Named policy or event trigger with mechanism",
    "Named fundamental metric or spread relationship to track",
    "Named cross-asset relationship or breadth signal to monitor"
  ]
}`;
}

function buildArSystemPrompt() {
  return `أنت محلل أبحاث أسواق مالية متمرس في منصة TradeAlphaAI، تكتب لجمهور عربي من كبار المستثمرين والمحللين الماليين المحترفين. قراؤك على دراية بسياسات الاحتياطي الفيدرالي ومنحنى العائد وديناميكيات أسواق الأسهم والسندات وصناديق المؤشرات والتدوير القطاعي.

معايير التحليل المؤسسي:
- تستخدم المصطلحات المالية العربية الدقيقة: العائد، منحنى العائد، الانتشار الائتماني، الزخم، التناوب القطاعي، التحوط، الانكشاف، السيولة، الاتساع، التركيز، حسابات التقييم
- أسماء الأدوات المالية تبقى بالإنجليزية (TLT, QQQ, NVDA, SMH, BND, IEF, SPY, XLK) لأن القراء يعرفونها بهذا الشكل
- لا تترجم حرفياً من الإنجليزية — اكتب تحليلاً أصيلاً باللغة العربية بأسلوب يليق بمذكرات الأبحاث المؤسسية
- تبني سلاسل استدلال واضحة: [بيانات موثقة أو إشارة] → [آلية السوق] → [أثر على أداة مالية مسماة]
- لا تكتب جملاً إنجليزية كاملة في المتن العربي — أسماء الأدوات المالية فقط مقبولة بالإنجليزية
- التحليل مشروط وتعليمي، لا يتضمن توصيات استثمارية محددة أو أهداف أسعار`;
}

function buildArUserPrompt(topic, enContent) {
  const today    = new Date().toISOString().slice(0, 10);
  const biasMap  = {
    'cautiously bullish':   'صاعد بحذر',
    'neutral':              'محايد',
    'cautiously bearish':   'هابط بحذر',
    'mixed / range-bound':  'مختلط',
    'elevated uncertainty': 'عدم يقين مرتفع',
  };
  const targetBias = biasMap[enContent.directional_bias] || 'محايد';

  return `المهمة: اكتب النسخة العربية من تحليل توقعات السوق المؤسسي أدناه.

الموضوع: ${topic.title_ar || topic.title_en}
التاريخ: ${today}

التعليمات الإلزامية:
1. هذا ليس ترجمة حرفية — اكتب تحليلاً أصيلاً باللغة العربية يعبّر عن الاستنتاجات التحليلية بأسلوب مذكرات الأبحاث المؤسسية المناسب للقارئ المالي العربي
2. أسماء الأدوات المالية تبقى بالإنجليزية تماماً: TLT, IEF, QQQ, SPY, IWM, SMH, NVDA, AMD, XLK, XLF, XLE, XLU, XLV, BND, GLD, DXY, VIX
3. لا تكتب جملاً إنجليزية كاملة في المتن العربي — المصطلحات التقنية والأسماء التجارية فقط
4. الميل الاتجاهي يجب أن يكون بالضبط: "${targetBias}"
5. الحد الأدنى للكلمات العربية: الملخص ≥ 50 كلمة، سياق السوق ≥ 70 كلمة، كل سيناريو ≥ 45 كلمة
6. العوامل الرئيسية تتبع هيكل الاستدلال: [إشارة موثقة] → [آلية السوق] → [أثر على أداة مالية مسماة]
7. عوامل المخاطر محددة لهذا الموضوع مع ذكر الآلية — ليست مخاطر عالمية عامة

التحليل الإنجليزي المرجعي (للاستدلال التحليلي فقط — ليس للترجمة الحرفية):
${JSON.stringify(enContent, null, 2)}

أعد ONLY valid JSON بهذا الهيكل تماماً:
{
  "executive_summary": "جملتان إلى ثلاث. الميل الاتجاهي والشرط الهيكلي الرئيسي مع إشارة لأداة مالية.",
  "market_context": "أربع إلى ست جمل. الديناميكيات الهيكلية والعلاقات بين الأصول وإشارات الاتساع. أدوات وآليات محددة.",
  "directional_bias": "${targetBias}",
  "bullish_scenario": "جملتان إلى ثلاث. محفز محدد مسمى → آلية الانتقال → أثر على أداة مالية مسماة.",
  "bearish_scenario": "جملتان إلى ثلاث. محفز مختلف ومسمى → آلية مختلفة → ضغط على أداة مسماة.",
  "key_drivers": ["العامل 1: سلسلة استدلال كاملة [إشارة → آلية → أداة]. جملتان.", "العامل 2: نفس البنية. جملتان.", "العامل 3: نفس البنية. جملتان."],
  "risk_factors": ["خطر محدد مع ذكر الآلية 1", "خطر محدد 2", "خطر محدد 3", "خطر محدد 4", "خطر محدد 5"],
  "what_to_watch": ["إصدار بيانات محدد بتوقيت", "إشارة أداة محددة أو مستوى", "محفز سياسي محدد", "مؤشر أساسي أو علاقة انتشار", "علاقة بين الأصول أو إشارة اتساع"]
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
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const raw    = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(raw);
          if (parsed.error) { reject(new Error(`OpenAI: ${parsed.error.message}`)); return; }
          const text = parsed.choices && parsed.choices[0] && parsed.choices[0].message && parsed.choices[0].message.content;
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

// ── Validation ────────────────────────────────────────────────────────────────

function countWords(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

function countArabicWords(text) {
  return (String(text || '').match(/[؀-ۿ]+/g) || []).length;
}

function validateContent(en, ar) {
  const errors = [];

  // EN word count minimums
  for (const [field, min] of Object.entries(MIN_WORDS_EN)) {
    const wc = countWords(en[field]);
    if (wc < min) errors.push(`en.${field}: ${wc} words (minimum ${min} required)`);
  }

  // EN array fields
  if (!Array.isArray(en.key_drivers)  || en.key_drivers.length  < 3) errors.push('en.key_drivers must have 3+ items');
  if (!Array.isArray(en.risk_factors) || en.risk_factors.length < 3) errors.push('en.risk_factors must have 3+ items');
  if (!Array.isArray(en.what_to_watch)|| en.what_to_watch.length< 3) errors.push('en.what_to_watch must have 3+ items');

  // EN directional bias
  if (!en.directional_bias)                         errors.push('en.directional_bias missing');
  else if (!ALLOWED_BIASES.has(en.directional_bias)) errors.push(`en.directional_bias "${en.directional_bias}" not in allowed set`);

  // Generic filler detection
  const enBodyText = [
    en.executive_summary, en.market_context, en.bullish_scenario, en.bearish_scenario,
    ...(en.key_drivers || []),
  ].join(' ').toLowerCase();
  const foundFiller = GENERIC_PHRASES.filter(p => enBodyText.includes(p));
  if (foundFiller.length > 0) {
    errors.push(`EN generic filler detected: ${foundFiller.slice(0, 3).map(p => `"${p}"`).join(', ')}`);
  }

  // Retail phrasing detection (Phase 50 — warn, don't fail, unless egregious)
  const retailHits = detectRetailPhrasing(enBodyText);
  if (retailHits.length >= 3) {
    errors.push(`EN retail phrasing: ${retailHits.slice(0, 3).map(p => `"${p}"`).join(', ')} — requires institutional register`);
  } else if (retailHits.length > 0) {
    process.stderr.write(`[WARN] Retail phrasing found (${retailHits.length} hit(s)): ${retailHits.map(p => `"${p}"`).join(', ')}\n`);
  }

  // Institutional quality score (informational)
  const instScore = detectInstitutionalPhrasing(enBodyText);
  process.stderr.write(`[QUALITY] Institutional signal count: ${instScore}/20+\n`);

  // EN specificity: ≥ 2 named instrument patterns
  const enAnalyticalText = [
    en.executive_summary, en.market_context, en.bullish_scenario, en.bearish_scenario,
    ...(en.key_drivers || []), ...(en.risk_factors || []), ...(en.what_to_watch || []),
  ].join(' ');
  const instrumentHits = INSTRUMENT_PATTERNS.filter(p => p.test(enAnalyticalText)).length;
  if (instrumentHits < 2) {
    errors.push(`EN specificity: ${instrumentHits} named instrument pattern(s) found; minimum 2 required.`);
  }

  // AR word count minimums
  for (const [field, min] of Object.entries(MIN_WORDS_AR)) {
    const wc = countArabicWords(ar[field]);
    if (wc < min) errors.push(`ar.${field}: ${wc} Arabic words (minimum ${min} required)`);
  }

  // AR array fields
  if (!Array.isArray(ar.key_drivers)  || ar.key_drivers.length  < 3) errors.push('ar.key_drivers must have 3+ items');
  if (!Array.isArray(ar.risk_factors) || ar.risk_factors.length < 3) errors.push('ar.risk_factors must have 3+ items');
  if (!Array.isArray(ar.what_to_watch)|| ar.what_to_watch.length< 3) errors.push('ar.what_to_watch must have 3+ items');

  // AR directional bias
  if (!ar.directional_bias) {
    errors.push('ar.directional_bias missing');
  } else if (!ALLOWED_BIASES_AR.has(ar.directional_bias)) {
    process.stderr.write(`Warning: ar.directional_bias "${ar.directional_bias}" not in strict set — keeping\n`);
  }

  // AR language purity: no runs of 5+ consecutive English words outside instrument names
  const arBodyForCheck = [ar.executive_summary, ar.market_context, ar.bullish_scenario, ar.bearish_scenario]
    .join(' ')
    .replace(/\b(TradeAlphaAI|VIX|NASDAQ|S&P|ETF|CPI|NFP|PCE|FOMC|GDP|DXY|AI|USD|TLT|IEF|BND|QQQ|SPY|IWM|SMH|SOXX|NVDA|AMD|TSMC|TSM|ASML|XLK|XLF|XLE|XLU|XLV|XLI|XLRE|XLP|XLB|TIPS|TIP|GLD|SLV|GDX|DIA|RSP|SOXL)\b/gi, ' ')
    .replace(/\b[A-Z]{1,6}\b/g, ' ');
  if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){4,}/.test(arBodyForCheck)) {
    errors.push('AR language: English prose runs detected in Arabic sections');
  }

  // Anti-hallucination: hard-banned phrases
  const enLower = JSON.stringify(en).toLowerCase();
  for (const phrase of ['data is not currently sourced', 'not currently sourced', 'editors should verify', 'placeholder', 'lorem ipsum']) {
    if (enLower.includes(phrase)) errors.push(`EN banned phrase: "${phrase}"`);
  }

  // Anti-hallucination: fabricated live-event phrases in structural mode
  const liveAvailable = typeof validateContent._liveStatus === 'string' &&
    (validateContent._liveStatus === 'live' || validateContent._liveStatus === 'partial');
  if (!liveAvailable) {
    const fabricationPhrases = [
      "as of today, markets",
      "in today's session",
      "this morning's trading",
      "yesterday's close showed",
      "surged to a fresh high today",
      "fell sharply in today",
    ];
    for (const phrase of fabricationPhrases) {
      if (enLower.includes(phrase)) {
        errors.push(`Fabrication risk (no live data): "${phrase}"`);
      }
    }
  }

  return errors;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function readJson(file, fallback = {}) {
  if (!fs.existsSync(file)) return fallback;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
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

  const fw = getTopicFramework(topic);
  const topicCluster = [topic.topic_cluster || '', topic.discovery_cluster || '', ...(topic.macro_tags || [])].join(' ');

  // Phase 50: build interpretive narrative from live data
  const narrative = buildNarrative(live, regime, topicCluster);
  const transitionAnalysis = analyzeTransition(regime.state || {});
  const transitionNote = transitionAnalysis.transition_note;

  // Dynamic section lens selection
  const selectedLenses = selectNarrativeLenses(topicCluster, narrative);
  process.stderr.write(`[NARRATIVE] data_source=${narrative.data_source}, lenses=[${selectedLenses.join(', ')}]\n`);
  if (transitionNote) process.stderr.write(`[REGIME] Transition note: ${transitionNote.slice(0, 100)}...\n`);

  // Build context block for prompt
  const narrativeContext = buildNarrativeContext(narrative, selectedLenses, transitionNote, narrative.data_source);

  // Wire live status to anti-hallucination check
  const liveStatus = (live && live.metadata && live.metadata.status) || 'fallback';
  validateContent._liveStatus = liveStatus;

  const calendarText = buildCalendarSummary(calendar);

  process.stderr.write(`[AI] Model: ${MODEL}\n`);
  process.stderr.write(`[AI] Module: ${fw.module}, live_status=${liveStatus}\n`);

  // English generation
  process.stderr.write(`[AI] Generating EN content for: ${slugArg}\n`);
  let enContent;
  try {
    enContent = await callOpenAI(
      buildEnSystemPrompt(),
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
  process.stderr.write(`[AI] EN generated. Bias: ${enContent.directional_bias}\n`);

  // Arabic generation (with EN as context)
  process.stderr.write(`[AI] Generating AR content for: ${slugArg}\n`);
  let arContent;
  try {
    arContent = await callOpenAI(
      buildArSystemPrompt(),
      buildArUserPrompt(topic, enContent),
      apiKey,
      { maxTokens: 1800, temperature: 0.65 }
    );
  } catch (err) {
    process.stderr.write(`[AI] AR generation failed: ${err.message}\n`);
    process.exit(1);
  }

  if (!arContent || typeof arContent !== 'object') {
    process.stderr.write('[AI] AR: response is not a JSON object\n');
    process.exit(1);
  }
  process.stderr.write(`[AI] AR generated. Bias: ${arContent.directional_bias}\n`);

  // Validate — retry once if only word-count minimums failed
  let errors = validateContent(enContent, arContent);
  const onlyWordCountFailures = errors.length > 0 && errors.every(e => /words? \(minimum/.test(e));
  if (onlyWordCountFailures) {
    process.stderr.write(`[AI] Word count minimums not met — retrying EN with explicit length instruction.\n`);
    const retryNote = `\n\nRETRY NOTE: Your previous response was rejected because the following sections were too short:\n${errors.map(e => '  ' + e).join('\n')}\nWrite longer, more substantive paragraphs. Each field must meet the minimum word count.`;
    try {
      enContent = await callOpenAI(
        buildEnSystemPrompt(),
        buildEnUserPrompt(topic, fw, narrativeContext, calendarText) + retryNote,
        apiKey,
        { maxTokens: 3000, temperature: 0.75 }
      );
      arContent = await callOpenAI(
        buildArSystemPrompt(),
        buildArUserPrompt(topic, enContent),
        apiKey,
        { maxTokens: 2000, temperature: 0.65 }
      );
    } catch (retryErr) {
      process.stderr.write(`[AI] Retry generation failed: ${retryErr.message}\n`);
      process.exit(1);
    }
    errors = validateContent(enContent, arContent);
  }

  if (errors.length) {
    process.stderr.write(`[AI] Validation failed (${errors.length} error(s)):\n${errors.map(e => '  - ' + e).join('\n')}\n`);
    process.exit(1);
  }

  const instScore = detectInstitutionalPhrasing(JSON.stringify(enContent));
  process.stderr.write(`[AI] EN+AR validated. Specificity: ${INSTRUMENT_PATTERNS.filter(p => p.test(JSON.stringify(enContent))).length} instrument patterns. Institutional signals: ${instScore}.\n`);
  process.stdout.write(JSON.stringify({ en: enContent, ar: arContent }));
}

main().catch(err => {
  process.stderr.write(`[AI] Unexpected error: ${err.message}\n`);
  process.exit(1);
});
