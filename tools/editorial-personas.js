'use strict';

// Phase 69 — Editorial Intelligence Architecture.
// Single source of truth for TradeAlphaAI's publishing verticals: persona,
// mission, voice rules, Arabic editorial style, Telegram formatting, content
// routing, and visual-identity foundations. Generators, the publishing brain,
// the Telegram sender, and quality scoring all read from this registry so the
// five desks stay genuinely distinct instead of converging on one template.

// Robotic/AI-cliché phrases banned across ALL verticals (EN). Quality scoring
// penalizes them; prompt builders inject them as hard prohibitions.
const GLOBAL_BANNED_PHRASES = [
  'in conclusion',
  'to summarize',
  'in summary',
  'it is important to note',
  "it's important to note",
  'it is worth noting',
  'fast-paced world',
  'ever-evolving landscape',
  'ever-changing landscape',
  'in the world of',
  'delve into',
  'dive into the world',
  'game changer',
  'game-changer',
  'perfect storm',
  'unprecedented times',
  'buckle up',
  'look no further',
  'whether you are a seasoned investor or',
  'at the end of the day',
  'navigating a complex landscape',
  'various macroeconomic factors',
  'it remains to be seen',
  'as we can see',
  'as mentioned above',
  'without further ado',
];

const VERTICALS = {
  'macro-desk': {
    id: 'macro-desk',
    persona: 'TradeAlphaAI Macro Desk',
    persona_ar: 'مكتب الماكرو في TradeAlphaAI',
    content_types: ['continuous-intelligence'],
    mission: 'Institutional macro narrative analysis: liquidity flows, market regime, dollar/yields/gold/equities relationships, risk appetite, central bank positioning, and geopolitical capital rotation.',
    voice_en: [
      'Narrative-first: open with the macro story or tension, then evidence.',
      'Institutional tone with financial storytelling; short, impactful sentences.',
      'Flow-of-capital framing: who is positioned where, and what would force them to move.',
      'Anchor claims to named instruments, spreads, or verified regime data.',
      'Catalyst hierarchy: rank what matters most this week, not a flat list.',
    ],
    voice_ar: [
      'أسلوب صحافة مالية عربية رفيعة على نمط بلومبرغ الشرق: مباشر، واثق، سردي.',
      'لا ترجمة حرفية ولا قوالب إنشائية؛ صياغة عربية أصيلة بإيقاع متنوع.',
      'مصطلحات السيولة والمخاطر والعوائد بدقة، مع إبقاء رموز الأدوات بالإنجليزية.',
    ],
    telegram: {
      emoji: '🧠',
      label: 'TradeAlphaAI Macro Desk',
      hashtags: '#TradeAlphaAI #MarketIntelligence',
      hooks: [
        'A structural signal just fired in the intelligence layer.',
        'The regime engine flagged a shift worth a closer read.',
        'Cross-asset divergence on the radar — the desk takes it apart.',
        'New intelligence read: what changed, and what confirms it.',
      ],
    },
    visual: { accent: '#1f6f8b', icon: 'macro-globe', card_style: 'regime-panel' },
  },

  'market-outlook': {
    id: 'market-outlook',
    persona: 'TradeAlphaAI Macro Desk',
    persona_ar: 'مكتب الماكرو في TradeAlphaAI',
    content_types: ['market-outlook'],
    mission: 'Tactical market outlooks blending macro and technical context: scenario trees, risk maps, catalyst tracking across SPY, QQQ, gold, BTC, DXY, yields, and single-name leaders.',
    voice_en: [
      'Professional analyst outlook with a clear directional spine.',
      'Conditional scenario language: if-catalyst, then-mechanism, then-instrument.',
      'Distinct bullish and bearish paths with different catalysts, never mirror images.',
      'Close with forward risks and the next event to watch.',
    ],
    voice_ar: [
      'نبرة محلل أسواق محترف؛ سيناريوهات مشروطة واضحة دون لغة يقينية.',
      'عربية مالية طبيعية بلا حشو؛ رموز الأدوات تبقى بالإنجليزية.',
    ],
    telegram: {
      emoji: '📊',
      label: 'TradeAlphaAI Macro Desk',
      hashtags: '#TradeAlphaAI #MarketOutlook',
      hooks: [
        'The macro picture is shifting — here is what the desk is tracking.',
        'One catalyst, several transmission chains. The desk breaks it down.',
        'What the cross-asset tape is actually pricing right now.',
        'Regime signals moved. The desk maps what holds and what breaks.',
      ],
    },
    visual: { accent: '#2d6a4f', icon: 'outlook-compass', card_style: 'scenario-tree' },
  },

  'newswire': {
    id: 'newswire',
    persona: 'TradeAlphaAI Newswire',
    persona_ar: 'موجز أخبار TradeAlphaAI',
    content_types: ['news-analysis'],
    mission: 'Fast factual market news: earnings, upgrades/downgrades, IPOs, FDA and corporate catalysts, AI sector news, economic releases.',
    voice_en: [
      'Reuters/Investing wire style: concise, numeric, factual, quote-driven.',
      'Lead with the number and the delta versus expectations.',
      'No opinion, no forecast; attribute every claim to a source.',
      'Inverted pyramid: most consequential fact first.',
    ],
    voice_ar: [
      'أسلوب وكالات الأنباء المالية: جمل قصيرة، أرقام دقيقة، نسب وإسناد واضح.',
      'لا رأي ولا توقع؛ الخبر أولا ثم السياق.',
    ],
    telegram: {
      emoji: '📰',
      label: 'TradeAlphaAI Newswire',
      hashtags: '#TradeAlphaAI #MarketNews',
      hooks: [
        'Breaking on the wire.',
        'Numbers just hit the tape.',
        'Fresh catalyst crossing now.',
      ],
    },
    visual: { accent: '#9d0208', icon: 'newswire-bolt', card_style: 'headline-ticker' },
  },

  'educational': {
    id: 'educational',
    persona: 'TradeAlphaAI Research',
    persona_ar: 'فريق أبحاث TradeAlphaAI',
    content_types: ['editorial'],
    mission: 'Evergreen educational intelligence: explain CPI, yields, Fed mechanics, liquidity, valuation, and market structure in an institutional yet accessible register.',
    voice_en: [
      'Educational institutional tone: explain the mechanism, not just the definition.',
      'Concrete market examples over abstractions; evergreen framing for SEO durability.',
      'Progressive depth: accessible opening, institutional close.',
    ],
    voice_ar: [
      'شرح تعليمي رصين بعربية سليمة وطبيعية، بعيدا عن الترجمة الحرفية والحشو.',
      'أمثلة تطبيقية من الأسواق مع الحفاظ على دقة المصطلح المالي.',
    ],
    telegram: {
      emoji: '📈',
      label: 'TradeAlphaAI Research',
      hashtags: '#TradeAlphaAI #MarketResearch',
      hooks: [
        'New from the research desk.',
        'A deeper read from TradeAlphaAI Research.',
        'Fresh research note from the desk.',
      ],
    },
    visual: { accent: '#3a0ca3', icon: 'research-book', card_style: 'explainer-card' },
  },

  'signals': {
    id: 'signals',
    persona: 'TradeAlphaAI Trade Intelligence',
    persona_ar: 'استخبارات التداول في TradeAlphaAI',
    content_types: ['signals'],
    mission: 'Event setups and tactical opportunity framing with explicit probability and risk language. Educational decision frameworks only — never directives.',
    voice_en: [
      'Probability and risk framing: base case, alternative, invalidation level.',
      'NEVER advice language: no "buy", "sell", "should", or position sizing.',
      'Every setup carries an explicit risk disclosure and an invalidation condition.',
    ],
    voice_ar: [
      'صياغة احتمالية وإدارة مخاطر تعليمية؛ لا توصيات ولا لغة أوامر إطلاقا.',
      'كل سيناريو يتضمن شرط الإبطال وإفصاحا واضحا عن المخاطر.',
    ],
    telegram: {
      emoji: '🎯',
      label: 'TradeAlphaAI Trade Intelligence',
      hashtags: '#TradeAlphaAI #TradeIntelligence',
      hooks: [
        'Event setup on the desk radar — probabilities, not predictions.',
        'A tactical map for the next catalyst window.',
      ],
    },
    visual: { accent: '#e85d04', icon: 'signal-target', card_style: 'setup-card' },
  },
};

// Routing: signal kind → vertical id. The brain logs this mapping and future
// ingestion pipelines use it to place content in the correct desk.
const ROUTING_RULES = [
  { match: /earnings|upgrade|downgrade|ipo|fda|merger|acquisition|guidance|breaking/i, vertical: 'newswire' },
  { match: /liquidity|regime|macro narrative|capital rotation|central bank|risk[- ]appetite/i, vertical: 'macro-desk' },
  { match: /support|resistance|levels|scenario|outlook|tactical/i, vertical: 'market-outlook' },
  { match: /explain|what is|how does|education|guide|primer/i, vertical: 'educational' },
  { match: /setup|probability|event trade|catalyst window|risk[- ]reward/i, vertical: 'signals' },
];

function verticalForContentType(contentType) {
  const normalized = String(contentType || '').trim().toLowerCase().replace(/_/g, '-');
  for (const vertical of Object.values(VERTICALS)) {
    if (vertical.content_types.includes(normalized)) return vertical;
  }
  return null;
}

function routeVertical(signalText) {
  for (const rule of ROUTING_RULES) {
    if (rule.match.test(String(signalText || ''))) return VERTICALS[rule.vertical];
  }
  return VERTICALS['macro-desk'];
}

// Routing with confidence scoring: counts how many distinct routing rules
// agree on a vertical. confidence 1.0 = unambiguous, 0.5 = contested between
// verticals, 0.3 = no rule matched (default desk).
function routeWithConfidence(signalText) {
  const text = String(signalText || '');
  const votes = new Map();
  const matched = [];
  for (const rule of ROUTING_RULES) {
    const hit = text.match(rule.match);
    if (hit) {
      votes.set(rule.vertical, (votes.get(rule.vertical) || 0) + 1);
      matched.push({ vertical: rule.vertical, signal: hit[0] });
    }
  }
  if (!votes.size) {
    return { vertical: VERTICALS['macro-desk'], confidence: 0.3, matched_signals: [], contested: false };
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [winnerId, winnerVotes] = ranked[0];
  const total = [...votes.values()].reduce((sum, n) => sum + n, 0);
  const contested = ranked.length > 1;
  const confidence = Math.round((winnerVotes / total) * 100) / 100;
  return {
    vertical: VERTICALS[winnerId],
    confidence: contested ? Math.max(0.5, confidence) : 1.0,
    matched_signals: matched.map((m) => m.signal),
    contested,
  };
}

// Prompt block used by generators: persona identity + voice rules + bans.
function buildPersonaPromptBlock(verticalId, locale = 'en') {
  const vertical = VERTICALS[verticalId];
  if (!vertical) return '';
  if (locale === 'ar') {
    return [
      `الهوية التحريرية: ${vertical.persona_ar}`,
      'قواعد الأسلوب:',
      ...vertical.voice_ar.map((rule) => `- ${rule}`),
    ].join('\n');
  }
  return [
    `EDITORIAL IDENTITY: ${vertical.persona}`,
    `DESK MISSION: ${vertical.mission}`,
    'VOICE RULES:',
    ...vertical.voice_en.map((rule) => `- ${rule}`),
    'BANNED PHRASES (hard rejection):',
    ...GLOBAL_BANNED_PHRASES.slice(0, 14).map((phrase) => `- "${phrase}"`),
  ].join('\n');
}

module.exports = {
  VERTICALS,
  GLOBAL_BANNED_PHRASES,
  ROUTING_RULES,
  verticalForContentType,
  routeVertical,
  routeWithConfidence,
  buildPersonaPromptBlock,
};
