'use strict';

// AI Market Outlook Content Generator — Phase 48 v2
// Two-call bilingual generation: English first, Arabic second with EN as context.
// System + user prompt separation. Default model: gpt-4o.
// Validates word counts, specificity, reasoning chains, and generic phrase detection.
// Usage: node tools/generate-ai-market-outlook-content.js --slug=<slug>
// Outputs structured JSON to stdout. Exits 1 on any failure.

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT          = path.resolve(__dirname, '..');
const QUEUE_PATH    = path.join(ROOT, 'data', 'market-outlook-queue.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');

const ALLOWED_BIASES    = new Set(['cautiously bullish', 'neutral', 'cautiously bearish', 'mixed / range-bound', 'elevated uncertainty']);
const ALLOWED_BIASES_AR = new Set(['صاعد بحذر', 'محايد', 'هابط بحذر', 'مختلط', 'عدم يقين مرتفع']);

// Production: gpt-4o. Set OPENAI_MODEL=gpt-4o-mini for cost-saving dry runs.
const MODEL      = process.env.OPENAI_MODEL || 'gpt-4o';
const TIMEOUT_MS = 90000;

// Word-count minimums enforced in code, not just the prompt
const MIN_WORDS_EN = { executive_summary: 45, market_context: 75, bullish_scenario: 45, bearish_scenario: 45 };
const MIN_WORDS_AR = { executive_summary: 30, market_context: 50, bullish_scenario: 30, bearish_scenario: 30 };

// Generic filler that signals low-quality output — reject generation if any are found
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

// Named instrument/structure patterns — at least 2 must match in EN analytical body
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

// ── Topic-cluster-specific framing ───────────────────────────────────────────

function getTopicFramework(topic) {
  const cluster = [
    topic.topic_cluster || '',
    topic.discovery_cluster || '',
    ...(topic.macro_tags || [])
  ].join(' ').toLowerCase();

  if (/yield|rates|treasury|bond|fixed.income|rate.context/.test(cluster)) {
    return {
      instruments: 'TLT, IEF, BND, TIPS (TIP ETF), SHY, 10-year Treasury yield, 2-year Treasury yield, Fed funds rate, DXY',
      mechanism:   'Fed policy expectations → short-end rate path → yield curve shape (2Y10Y spread) → duration risk repricing → TLT/IEF ETF flows → equity valuation discount rates → sector rotation between rate-sensitive (XLU, XLRE) and rate-resistant (XLF, XLE) assets',
      catalysts:   'CPI or Core PCE release, FOMC decision and dot-plot update, NFP employment report, Treasury auction bid-to-cover ratio, Fed governor speeches on terminal rate',
      bias_note:   'Directional bias reflects the research tone about the rate environment — "cautiously bullish" means conditions are constructive for rate stability or normalization (supportive of duration assets); it is NOT a directional call on Treasury prices in isolation.',
    };
  }

  if (/ai|semiconductor|tech|chip|nvda|smd/.test(cluster)) {
    return {
      instruments: 'NVDA, AMD, SMH, SOXX, XLK, QQQ, SOXL (leveraged semi), ASML, TSM (TSMC)',
      mechanism:   'AI infrastructure capex cycle → hyperscaler GPU demand signals → NVDA/AMD revenue trajectory → SOX semiconductor index → XLK sector weight → QQQ constituent drag or lift → growth multiple sensitivity to 10Y yield path',
      catalysts:   'NVDA quarterly earnings report, hyperscaler capex guidance (MSFT, GOOGL, META, AMZN), US chip export control updates, TSMC capacity or pricing announcements, FOMC meeting (rate sensitivity for growth multiples)',
      bias_note:   'Directional bias reflects the research tone about the AI/semiconductor investment theme — "cautiously bullish" means the capex cycle and demand signals are constructive for the theme; it is not a specific stock recommendation.',
    };
  }

  if (/etf.rotation|rotation|sector.flow/.test(cluster)) {
    return {
      instruments: 'SPY, QQQ, IWM (small cap), XLK (tech), XLF (financials), XLE (energy), XLU (utilities), XLV (healthcare), RSP (equal-weight S&P), BND',
      mechanism:   'Macro regime signal → risk appetite → factor tilt (growth vs value, large vs small cap) → sector ETF relative flows → breadth divergence (SPY vs QQQ, IWM vs SPY, RSP vs SPY) → portfolio rebalancing pressure',
      catalysts:   'ISM manufacturing or services print, FOMC, quarterly earnings season breadth signal, VIX regime transition, CPI surprise as rotation trigger',
      bias_note:   'Directional bias reflects the macro rotation environment — "cautiously bullish" means the regime supports risk positioning; not a recommendation on any specific ETF allocation.',
    };
  }

  return {
    instruments: 'SPY, QQQ, IWM, VIX, TLT (duration proxy), GLD, DXY, IEF',
    mechanism:   'Macro regime signal → volatility regime (VIX level) → cross-asset correlation shifts → risk-on vs risk-off positioning → relative strength rotation between equity (SPY/QQQ) and defensive assets (TLT/GLD/IEF)',
    catalysts:   'FOMC meeting, CPI or PCE print, earnings season breadth, credit market stress signal, geopolitical event',
    bias_note:   'Directional bias reflects the macro/volatility regime tone — "cautiously bullish" means the environment supports risk-on positioning; not a call on any specific instrument.',
  };
}

// ── Market context builders ───────────────────────────────────────────────────

function buildMarketDataSummary(live, regime) {
  const liveStatus = live && live.metadata && live.metadata.status;

  if (liveStatus === 'live' || liveStatus === 'partial') {
    // v2.0: pre-built narrative string (preferred)
    if (live.macro_summary) {
      const prefix = liveStatus === 'live' ? 'Live market conditions' : 'Partial market data';
      const fedNote = live.fed_expectations ? `\nFed context: ${live.fed_expectations}` : '';
      const spreadNote = live.yield_spread_2y10y && live.yield_spread_2y10y.spread_bps != null
        ? ` | 2Y/10Y spread: ${live.yield_spread_2y10y.spread_bps >= 0 ? '+' : ''}${live.yield_spread_2y10y.spread_bps}bps (${(live.yield_spread_2y10y.spread_regime || '').replace(/_/g, ' ')})`
        : '';
      const regimeNote = live.computed_regime && live.computed_regime.market_regime
        ? `\nMarket regime: ${live.computed_regime.market_regime}`
        : '';
      return `${prefix}: ${live.macro_summary}${spreadNote}${fedNote}${regimeNote}`;
    }

    // v1.0 compatibility: build from flat fields
    const parts = [];
    for (const key of ['sp500','nasdaq','vix','us10y_yield','us2y_yield','dxy','gold']) {
      const e = live[key];
      if (e && e.value != null) {
        const pct = e.change_pct != null
          ? ` (${e.change_pct >= 0 ? '+' : ''}${e.change_pct.toFixed(2)}%)` : '';
        parts.push(`${key.replace(/_/g,' ').toUpperCase()}: ${e.value}${pct}`);
      }
    }
    if (live.yield_spread_2y10y && live.yield_spread_2y10y.spread_bps != null) {
      parts.push(`2Y/10Y spread: ${live.yield_spread_2y10y.spread_bps}bps (${(live.yield_spread_2y10y.spread_regime || '').replace(/_/g,' ')})`);
    }
    for (const key of ['ai_sector_momentum','market_regime','volatility_regime']) {
      const r = live.computed_regime || {};
      const v = r[key];
      if (v && v !== 'unverified') parts.push(`${key.replace(/_/g,' ')}: ${v}`);
    }
    if (live.sector_leadership && live.sector_leadership.length) {
      parts.push(`sector leaders: ${live.sector_leadership.join(', ')}`);
    }
    if (parts.length) return `Live market conditions: ${parts.join('; ')}`;
  }

  // Structural fallback
  const r = (regime && regime.state) || {};
  const signals = Object.entries(r)
    .filter(([, v]) => v && v !== 'unverified' && !Array.isArray(v))
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
  return signals.length
    ? `Regime signals (unverified, structural only): ${signals.join('. ')}`
    : 'No live market data available. Write structural analysis: how this theme\'s mechanism operates in the current macro regime, historical behavioral patterns, and what regime shift would alter the outlook.';
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
  return `You are a senior macro research analyst writing for TradeAlphaAI's institutional research platform. Your readers hold sophisticated portfolios and read Bloomberg, BAML research notes, and macro memos. They do not need definitions.

Your analytical style:
- Every analytical claim is anchored to a named instrument, yield level, spread relationship, or data release
- You build transmission chains: [macro signal or data input] → [market mechanism] → [impact on named instrument or sector] → [portfolio-level implication]
- Conditional calls use real named catalysts: "If June CPI prints above 3.2%, 10-year yields may retest recent highs, compressing TLT duration and pressuring QQQ growth multiples"
- Bullish and bearish scenarios have DISTINCT catalysts — they are not mirror images of each other
- You write with analytical conviction, hedged precisely: "historically correlated with", "tends to precede", "could amplify", "conditional on"
- FORBIDDEN phrases: "various macroeconomic factors", "market participants are closely monitoring", "navigating a complex landscape", "moving forward", "going forward", "it remains to be seen", "in the current environment", "broadly speaking"

This is educational market commentary. You do NOT recommend trades. You do NOT give price targets. You frame all directional analysis conditionally: "If X materializes, instruments A and B tend to respond Z because of mechanism Y." The goal is to teach the reader to see the mechanism — not to tell them what to do.`;
}

function buildEnUserPrompt(topic, fw, marketData, calendarText) {
  const today = new Date().toISOString().slice(0, 10);
  const biasOptions = [...ALLOWED_BIASES].join(' | ');
  return `Write a professional market outlook analysis for the following topic.

TOPIC: ${topic.title_en}
RESEARCH CLUSTER: ${topic.topic_cluster || topic.discovery_cluster || 'market_outlook'}
DATE: ${today}
MACRO TAGS: ${(topic.macro_tags || []).join(', ') || 'general markets'}

RELEVANT INSTRUMENTS FOR THIS THEME: ${fw.instruments}
MACRO TRANSMISSION MECHANISM: ${fw.mechanism}
KEY CATALYSTS TO REFERENCE: ${fw.catalysts}
DIRECTIONAL BIAS CONTEXT: ${fw.bias_note}

MARKET CONTEXT FROM DATA SYSTEMS:
${marketData}

UPCOMING ECONOMIC EVENTS:
${calendarText}

REQUIREMENTS — READ CAREFULLY:
1. Reference AT LEAST 2 named instruments from the "Relevant Instruments" list in the analytical sections
2. key_drivers MUST follow this chain for each entry: [Signal or Data Input] → [Market Mechanism] → [Impact on Named Instrument or Sector]
3. Bullish and bearish scenarios MUST have different catalysts — not mirror images
4. risk_factors must be specific to this theme's instruments and mechanics, not generic global risks
5. what_to_watch must name specific data releases, instrument thresholds, or cross-asset relationships
6. If no live data is available: write about STRUCTURAL dynamics — how this mechanism operates, relevant historical patterns, what would shift the regime — do NOT mention "data unavailable"
7. Do NOT explain what inflation is. Do NOT explain what the Fed does. Your reader already knows.
8. CRITICAL MINIMUM LENGTHS — responses below these counts will be REJECTED: executive_summary ≥ 45 words, market_context ≥ 75 words, each scenario ≥ 45 words. Write complete substantive paragraphs, not brief summaries.
9. key_drivers: 3 items, each ≥ 2 full sentences with the chain structure above
10. risk_factors: 5 items, each specific to this theme
11. what_to_watch: 5 items, each naming a specific instrument, release, or threshold

Return ONLY valid JSON — no markdown, no explanation:
{
  "executive_summary": "2-3 sentences. State the directional research stance AND the primary structural condition driving it. Reference at least one named instrument.",
  "market_context": "4-5 sentences. Name the structural dynamics specific to this theme. Reference named instruments, spread relationships, or regime signals. NOT a generic macro overview.",
  "directional_bias": "${biasOptions}",
  "bullish_scenario": "2-3 sentences. Named catalyst → transmission mechanism → named instrument impact. Distinct from bearish.",
  "bearish_scenario": "2-3 sentences. Different catalyst → different mechanism → named instrument pressure. NOT the inverse of bullish.",
  "key_drivers": [
    "[Driver label]: [Signal] → [Mechanism] → [Instrument impact]. 2 sentences with this chain.",
    "[Driver label]: [Signal] → [Mechanism] → [Instrument impact]. 2 sentences.",
    "[Driver label]: [Signal] → [Mechanism] → [Instrument impact]. 2 sentences."
  ],
  "risk_factors": [
    "Specific risk tied to this theme's instruments or catalysts",
    "Second specific risk with transmission mechanism named",
    "Third specific risk specific to this cluster",
    "Fourth specific risk",
    "Fifth specific risk"
  ],
  "what_to_watch": [
    "Named data release with date range if known (e.g. June PCE print)",
    "Named instrument signal or threshold (e.g. TLT close below support)",
    "Named policy or event trigger",
    "Named fundamental metric or spread to track",
    "Named cross-asset relationship or breadth signal"
  ]
}`;
}

function buildArSystemPrompt() {
  return `أنت محلل أبحاث أسواق مالية متمرس في منصة TradeAlphaAI، تكتب لجمهور عربي متعلم من المستثمرين والمحللين الماليين المحترفين. قراؤك على دراية بسياسات الاحتياطي الفيدرالي ومنحنى العائد وديناميكيات أسواق الأسهم والسندات وصناديق المؤشرات.

أسلوبك التحليلي:
- تستخدم المصطلحات المالية العربية الدقيقة: العائد، منحنى العائد، الانتشار الائتماني، الزخم، التناوب القطاعي، التحوط، الانكشاف، السيولة
- أسماء الأدوات المالية تبقى بالإنجليزية (TLT, QQQ, NVDA, SMH, BND, IEF, SPY, XLK) لأن القراء يعرفونها بهذا الشكل
- لا تترجم حرفياً من الإنجليزية — اكتب تحليلاً أصيلاً باللغة العربية يناسب القارئ المالي في منطقة الخليج والعالم العربي
- تبني سلاسل استدلال: [بيانات أو إشارة] → [آلية السوق] → [أثر على أداة مالية مسماة]
- لا تكتب جملاً إنجليزية كاملة في المتن العربي — أسماء الأدوات المالية فقط مقبولة بالإنجليزية
- التحليل مشروط وتعليمي، لا يتضمن توصيات استثمارية أو أهداف أسعار`;
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

  return `المهمة: اكتب النسخة العربية من تحليل توقعات السوق أدناه.

الموضوع: ${topic.title_ar || topic.title_en}
التاريخ: ${today}

التعليمات الإلزامية:
1. هذا ليس ترجمة حرفية — اكتب تحليلاً أصيلاً باللغة العربية يعبّر عن نفس الاستنتاجات التحليلية بأسلوب يناسب القارئ المالي العربي
2. أسماء الأدوات المالية تبقى بالإنجليزية تماماً: TLT, IEF, QQQ, SPY, IWM, SMH, NVDA, AMD, XLK, XLF, BND, GLD, DXY, VIX
3. لا تكتب جملاً إنجليزية كاملة في المتن العربي — المصطلحات التقنية والأسماء التجارية فقط
4. الميل الاتجاهي يجب أن يكون بالضبط: "${targetBias}"
5. الحد الأدنى: الملخص التنفيذي ≥ 50 كلمة عربية، سياق السوق ≥ 70 كلمة عربية، كل سيناريو ≥ 45 كلمة عربية
6. العوامل الرئيسية تتبع هيكل الاستدلال: [إشارة أو بيانات] → [آلية السوق] → [أثر على أداة مالية مسماة]
7. عوامل المخاطر محددة لهذا الموضوع، ليست مخاطر عالمية عامة

التحليل الإنجليزي المرجعي (للاستدلال التحليلي فقط — ليس للترجمة):
${JSON.stringify(enContent, null, 2)}

أعد ONLY valid JSON بهذا الهيكل تماماً:
{
  "executive_summary": "جملتان إلى ثلاث. الميل الاتجاهي والشرط الهيكلي الرئيسي. إشارة إلى أداة مالية واحدة على الأقل.",
  "market_context": "أربع إلى خمس جمل. الديناميكيات الهيكلية لهذا الموضوع. أدوات وآليات وإشارات محددة.",
  "directional_bias": "${targetBias}",
  "bullish_scenario": "جملتان إلى ثلاث. محفز محدد → آلية الانتقال → أثر على أداة مالية مسماة.",
  "bearish_scenario": "جملتان إلى ثلاث. محفز مختلف → آلية مختلفة → ضغط على أداة مسماة.",
  "key_drivers": ["العامل 1: سلسلة استدلال كاملة مع أداة مالية مسماة", "العامل 2: نفس البنية", "العامل 3: نفس البنية"],
  "risk_factors": ["خطر محدد لهذا الموضوع 1", "خطر محدد 2", "خطر محدد 3", "خطر محدد 4", "خطر محدد 5"],
  "what_to_watch": ["إصدار بيانات محدد", "إشارة أداة محددة أو مستوى دعم/مقاومة", "محفز سياسي محدد", "مؤشر أساسي محدد", "علاقة بين الأصول للمراقبة"]
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

  // EN generic filler detection
  const enBodyText = [
    en.executive_summary, en.market_context, en.bullish_scenario, en.bearish_scenario,
    ...(en.key_drivers || []),
  ].join(' ').toLowerCase();
  const foundFiller = GENERIC_PHRASES.filter(p => enBodyText.includes(p));
  if (foundFiller.length > 0) {
    errors.push(`EN generic filler detected — fail: ${foundFiller.slice(0, 3).map(p => `"${p}"`).join(', ')}`);
  }

  // EN specificity: at least 2 named instrument patterns in analytical body
  const enAnalyticalText = [
    en.executive_summary, en.market_context, en.bullish_scenario, en.bearish_scenario,
    ...(en.key_drivers || []), ...(en.risk_factors || []), ...(en.what_to_watch || []),
  ].join(' ');
  const instrumentHits = INSTRUMENT_PATTERNS.filter(p => p.test(enAnalyticalText)).length;
  if (instrumentHits < 2) {
    errors.push(`EN specificity: ${instrumentHits} named instrument pattern(s) found; minimum 2 required. Reference specific ETFs, indices, or instruments from the theme framework.`);
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
    errors.push('AR language: English prose runs detected in Arabic sections — Arabic text must not contain English sentences');
  }

  // Anti-hallucination: hard-banned phrases
  const enLower = JSON.stringify(en).toLowerCase();
  for (const phrase of ['data is not currently sourced', 'not currently sourced', 'editors should verify', 'placeholder', 'lorem ipsum']) {
    if (enLower.includes(phrase)) errors.push(`EN banned phrase: "${phrase}"`);
  }

  // Anti-hallucination: fabricated live-event phrases (only in structural/fallback mode)
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
        errors.push(`Fabrication risk (no live data injected): "${phrase}" implies specific current event knowledge`);
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

  const fw           = getTopicFramework(topic);
  const marketData   = buildMarketDataSummary(live, regime);
  const calendarText = buildCalendarSummary(calendar);
  // Wire live status to anti-hallucination check
  validateContent._liveStatus = (live && live.metadata && live.metadata.status) || 'fallback';

  process.stderr.write(`[AI] Model: ${MODEL}\n`);

  // English generation
  process.stderr.write(`[AI] Generating EN content for: ${slugArg}\n`);
  let enContent;
  try {
    enContent = await callOpenAI(
      buildEnSystemPrompt(),
      buildEnUserPrompt(topic, fw, marketData, calendarText),
      apiKey,
      { maxTokens: 2500, temperature: 0.75 }
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
      { maxTokens: 1500, temperature: 0.65 }
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

  // Validate combined output — retry once if only word-count minimums failed
  let errors = validateContent(enContent, arContent);
  const onlyWordCountFailures = errors.length > 0 && errors.every(e => /words? \(minimum/.test(e));
  if (onlyWordCountFailures) {
    process.stderr.write(`[AI] Word count minimums not met — retrying EN with explicit length instruction.\n`);
    const retryNote = `\n\nRETRY NOTE: Your previous response was rejected because the following sections were too short:\n${errors.map(e => '  ' + e).join('\n')}\nYou MUST write longer, more substantive paragraphs. Each field must meet the minimum word count — do not submit abbreviated answers.`;
    try {
      enContent = await callOpenAI(
        buildEnSystemPrompt(),
        buildEnUserPrompt(topic, fw, marketData, calendarText) + retryNote,
        apiKey,
        { maxTokens: 2800, temperature: 0.75 }
      );
      arContent = await callOpenAI(
        buildArSystemPrompt(),
        buildArUserPrompt(topic, enContent),
        apiKey,
        { maxTokens: 1800, temperature: 0.65 }
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

  process.stderr.write(`[AI] EN+AR validated. Specificity: ${INSTRUMENT_PATTERNS.filter(p => p.test(JSON.stringify(enContent))).length} instrument patterns matched.\n`);
  process.stdout.write(JSON.stringify({ en: enContent, ar: arContent }));
}

main().catch(err => {
  process.stderr.write(`[AI] Unexpected error: ${err.message}\n`);
  process.exit(1);
});
