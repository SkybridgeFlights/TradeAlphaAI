'use strict';

// Phase 70 — Analyst Voice Engine.
// Reusable institutional voice system shared by every editorial vertical:
// analyst transitions, liquidity and positioning framing, market psychology
// vocabulary, cross-asset causal intelligence, conviction calibration, the
// institutional narrative arc, and Arabic financial-media voice. Selection is
// deterministic per slug so each article gets a distinct but reproducible
// voice fingerprint instead of converging on one template.
//
// Safety: every framing exemplar uses attributed market language ("positioning
// suggests", "flows indicate") — never fabricated data, firms, or quotes.

function slugHash(slug) {
  let hash = 0;
  for (const ch of String(slug || '')) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash;
}

function pick(pool, slug, salt = 0, count = 1) {
  const hash = slugHash(`${slug}:${salt}`);
  const out = [];
  for (let i = 0; i < Math.min(count, pool.length); i += 1) {
    out.push(pool[(hash + i * 7) % pool.length]);
  }
  return [...new Set(out)];
}

// ── Conviction calibration ────────────────────────────────────────────────────

const CONVICTION_LEVELS = [
  {
    level: 'measured',
    guidance: 'Measured conviction: the evidence is mixed. Weigh both sides explicitly, let the tension stay unresolved, and make the invalidation condition do the work.',
  },
  {
    level: 'leaning',
    guidance: 'Leaning conviction: the weight of evidence points one way. State the lean plainly, then stress-test it against the strongest counter-signal.',
  },
  {
    level: 'firm-but-conditional',
    guidance: 'Firm but conditional conviction: commit to the read with confidence, anchored to a specific catalyst or level that would prove it wrong.',
  },
];

// ── Analyst transition library ────────────────────────────────────────────────

const TRANSITIONS = [
  'The more telling signal sits elsewhere:',
  'That framing only holds until the next data point.',
  'Beneath the index level, the picture is less tidy.',
  'The tape tells a different story than the headline.',
  'Here is where positioning starts to matter.',
  'The second-order effect is the one worth watching.',
  'That leaves the market with an uncomfortable question.',
  'What changed is not the data — it is the reaction function.',
  'The cross-asset read complicates that view.',
  'Flows, not narratives, settle this argument.',
];

// ── Liquidity and positioning framing ─────────────────────────────────────────

const LIQUIDITY_FRAMES = [
  'The market is no longer reacting to the data itself, but to the repricing of liquidity expectations around it.',
  'Liquidity migrates before narratives do — watch where bids are deepening, not where headlines point.',
  'When funding conditions tighten, valuation tolerance compresses first in the longest-duration assets.',
  'A rally on thinning breadth is a liquidity statement, not a demand statement.',
];

const POSITIONING_FRAMES = [
  'The move increasingly resembles a positioning squeeze rather than fresh institutional demand.',
  'Crowded trades do not unwind politely; they unwind through the exits everyone assumed would stay open.',
  'An asset stops falling on bad news when the marginal seller is already out — that is positioning exhaustion, not optimism.',
  'Momentum trades die from crowding before they die from fundamentals.',
];

// ── Market psychology lexicon ─────────────────────────────────────────────────

const PSYCHOLOGY_CONCEPTS = [
  'fear vs. greed asymmetry around the dominant catalyst',
  'crowding risk in the consensus trade and what forces an unwind',
  'speculative rotation: where fast money is migrating and what it abandoned',
  'volatility compression as stored energy rather than calm',
  'momentum exhaustion: leadership narrowing while the index holds',
  'defensive flows as an early tell before headline risk-off',
  'institutional accumulation vs. distribution divergence against price',
  'liquidity migration between asset classes ahead of regime shifts',
];

// ── Cross-asset causal intelligence ──────────────────────────────────────────

const ASSET_CAUSAL_MAP = [
  { pair: 'yields->tech', chain: 'Rising Treasury yields tighten valuation tolerance across high-duration tech (QQQ, NVDA) by lifting the discount rate on far-dated cash flows.' },
  { pair: 'yields->gold', chain: 'Higher real yields raise the opportunity cost of holding gold (GLD); gold weakness alongside falling yields instead signals momentum unwind, not rates.' },
  { pair: 'dxy->gold', chain: 'Dollar strength (DXY) pressures gold mechanically, but the relationship breaks when both rally — that is a global hedging bid, not a rates story.' },
  { pair: 'dxy->risk', chain: 'A firm dollar drains global dollar liquidity, pressuring emerging assets and high-beta risk (BTC, IWM) before it shows in SPY.' },
  { pair: 'vix->spy', chain: 'VIX compression with deteriorating breadth means hedges are being sold into a narrowing rally — fragility, not strength.' },
  { pair: 'btc->liquidity', chain: 'Bitcoin trades as a pure liquidity beta: it tends to lead when liquidity expectations reprice, in both directions.' },
  { pair: 'oil->rates', chain: 'Oil strength feeds inflation expectations, pressuring the front end of the curve and delaying the easing path markets have priced.' },
  { pair: 'spy-qqq->breadth', chain: 'SPY holding while equal-weight (RSP) and small caps (IWM) lag is concentration risk compounding, not broad risk appetite.' },
];

function relevantCausalChains(text, maxChains = 3) {
  const hay = String(text || '').toLowerCase();
  const scored = ASSET_CAUSAL_MAP.map((entry) => {
    const keys = entry.pair.split(/[->]+/);
    const hits = keys.filter((k) => hay.includes(k)).length;
    return { entry, hits };
  }).sort((a, b) => b.hits - a.hits);
  const top = scored.filter((s) => s.hits > 0).slice(0, maxChains);
  const chosen = top.length ? top : scored.slice(0, 2);
  return chosen.map((s) => s.entry.chain);
}

// ── Attributed framing (content realism safety) ───────────────────────────────

const ATTRIBUTED_FRAMES = [
  'traders are increasingly focused on…',
  'market participants appear to be…',
  'positioning suggests…',
  'flows indicate…',
  'the options market is pricing…',
  'desks describe the setup as…',
];

// ── Narrative arc (institutional pacing) ──────────────────────────────────────

const NARRATIVE_ARC = `NARRATIVE ARC — structure the analysis as institutional pacing, never intro/body/conclusion:
1. HOOK: the sharpest fact or tension, stated in one or two lines (executive_summary opens here).
2. TENSION: why the consensus read is incomplete or contested.
3. CATALYST: the event or repricing driving the move (market_context).
4. MARKET REACTION: what actually traded — names, levels, spreads.
5. LIQUIDITY INTERPRETATION: what the move says about liquidity and funding conditions.
6. POSITIONING ANALYSIS: who is on which side, what is crowded, what forces movement (key_drivers).
7. FORWARD RISK: the scenario the market is underpricing (risk_factors).
8. NEXT CATALYST: the specific event or level that resolves the tension (what_to_watch).
PACING RULES: vary paragraph length deliberately; deploy at least one short punch paragraph (one or two sentences) at a turning point; escalate conviction across the piece rather than front-loading it; never repeat a sentence opening within a section.`;

// ── Prompt builders ───────────────────────────────────────────────────────────

function buildVoicePromptBlock(slug, options = {}) {
  const conviction = CONVICTION_LEVELS[slugHash(slug) % CONVICTION_LEVELS.length];
  const transitions = pick(TRANSITIONS, slug, 1, 4);
  const liquidity = pick(LIQUIDITY_FRAMES, slug, 2, 2);
  const positioning = pick(POSITIONING_FRAMES, slug, 3, 2);
  const psychology = pick(PSYCHOLOGY_CONCEPTS, slug, 4, 3);
  const causalChains = relevantCausalChains(options.topicText || '', 3);

  return `ANALYST VOICE SYSTEM (institutional realism layer):
CONVICTION CALIBRATION — ${conviction.level}: ${conviction.guidance}

TRANSITION PALETTE (use sparingly and naturally, adapt wording — never paste verbatim more than once):
${transitions.map((t) => `- ${t}`).join('\n')}

LIQUIDITY FRAMING REGISTER (model the analytical register, adapt to this topic):
${liquidity.map((t) => `- ${t}`).join('\n')}

POSITIONING REGISTER:
${positioning.map((t) => `- ${t}`).join('\n')}

MARKET PSYCHOLOGY — address at least two of these dimensions where the data supports them (explain WHY the market moved, not only what moved):
${psychology.map((t) => `- ${t}`).join('\n')}

CROSS-ASSET CAUSAL INTELLIGENCE — ground transmission claims in chains like:
${causalChains.map((t) => `- ${t}`).join('\n')}

REALISM SAFETY: never invent data, firms, quotes, earnings, or price targets. When evidence is soft, use attributed market framing: ${ATTRIBUTED_FRAMES.slice(0, 4).map((f) => `"${f}"`).join(', ')}.

${NARRATIVE_ARC}`;
}

// Arabic financial-media voice — senior Arabic market editor register.
const AR_TRANSITIONS = [
  'لكن الإشارة الأهم تكمن في مكان آخر.',
  'وهنا تبدأ التمركزات في فرض منطقها على السوق.',
  'غير أن قراءة التدفقات تروي قصة مختلفة.',
  'وما تغير فعليا ليس البيانات، بل طريقة تفاعل السوق معها.',
  'تحت سطح المؤشر، تبدو الصورة أقل وضوحا.',
];

function buildArabicVoiceBlock(slug) {
  const transitions = pick(AR_TRANSITIONS, slug, 5, 3);
  return `طبقة الصوت التحريري العربي (واقعية مؤسسية):
- اكتب كمحرر أسواق عربي أول في غرفة أخبار مالية، لا كمترجم
- إيقاع صحفي متنوع: فقرات قصيرة ضاربة عند نقاط التحول، وفقرات تحليلية أعمق عند التفسير
- اشرح لماذا تحرك السوق (سيولة، تمركزات، شهية مخاطرة) لا ماذا تحرك فقط
- صعّد مستوى القناعة تدريجيا عبر المقال بدل حسم الرأي من السطر الأول
- أمثلة على نسق الانتقالات المطلوب (استلهم الأسلوب ولا تنسخ حرفيا):
${transitions.map((t) => `  • ${t}`).join('\n')}
- عند ضعف الأدلة استخدم صيغ الإسناد: "تشير التمركزات إلى…"، "يركز المتداولون بشكل متزايد على…"، "توحي التدفقات بأن…"`;
}

module.exports = {
  CONVICTION_LEVELS,
  TRANSITIONS,
  LIQUIDITY_FRAMES,
  POSITIONING_FRAMES,
  PSYCHOLOGY_CONCEPTS,
  ASSET_CAUSAL_MAP,
  ATTRIBUTED_FRAMES,
  NARRATIVE_ARC,
  relevantCausalChains,
  buildVoicePromptBlock,
  buildArabicVoiceBlock,
};
