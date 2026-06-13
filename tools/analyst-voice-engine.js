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

${NARRATIVE_ARC}

${HUMAN_PACING}

${CONVICTION_SPECIFICITY}`;
}

// ── Conviction & specificity (Phase 90 — institutional sharpness) ────────────
// The cognition/convergence/tension artifacts already supply WHAT to say
// (conviction state, diverging links, underpriced pressure). This block
// governs HOW it must be expressed: with restrained institutional conviction,
// explicit contradiction framing, and a stated invalidation — never advice,
// never forecasts, never manufactured certainty.
const CONVICTION_SPECIFICITY = `CONVICTION & SPECIFICITY (institutional interpretation, not an educational summary):
- State what the market is currently PRICING, then whether the cross-asset evidence confirms or contradicts that pricing. Use the convergence/cognition context above as the source — do not invent a read it does not support.
- Every analytical section must carry at least one of: what changed versus the prior release/window, what confirms the move, what does NOT confirm it, what the market may be underpricing, or what would invalidate the current read. Omit a section rather than pad it with generic prose.
- CONTRADICTION FRAMING is mandatory when the context shows a diverging link: name the consensus read, then the evidence that disagrees ("Equity strength implies a soft-landing read; the front end of the curve is not confirming it."). If no contradiction is verified, say what is cleanly aligned instead — never fabricate tension.
- DATA ANCHORING: when a sourced figure exists, cite the actual value, the prior value, and why the delta matters ("Core PCE at 3.3% versus 3.1% prior keeps the services-inflation problem unresolved."). Never invent a figure; if none is sourced, anchor to structure (curve, breadth, spreads, vol regime) instead.
- INVALIDATION: before the note closes, state the specific condition — a level, a spread, a release, a breadth or vol shift — that would prove the current interpretation wrong. This is institutional discipline, not hedging.
- BANNED HEDGE FILLER: "remains uncertain", "market participants are watching", "could potentially", "it remains to be seen", "only time will tell", "may or may not". Replace vague caution with a concrete conditional: "If [named catalyst], [mechanism] would pressure [named instrument]."
- Conviction is expressed through structure and evidence, never through a price call or a buy/sell instruction. Sharpness comes from specificity, not from certainty.`;

// ── Human pacing system (Phase 86 — anti-AI cadence) ─────────────────────────
const HUMAN_PACING = `HUMAN PACING SYSTEM (the reader must feel a human analyst, never a template):
- Paragraph lengths must vary visibly: mix one-sentence pivots with four-to-six sentence analysis. Never produce three consecutive paragraphs of similar length.
- Never structure sections symmetrically (same paragraph count per section reads as machine output).
- FORBIDDEN transitions: "furthermore", "moreover", "additionally", "in conclusion", "overall", "it is worth noting", "it is important to note", "in today's fast-paced", "in the ever-evolving". Move between ideas through the market logic itself, not connective filler.
- Buzzword restraint: at most one use each of "landscape", "navigate", "robust", "dynamic", "underscore" — prefer concrete market language.
- Emphasis modulation: allow one restrained moment of conviction per piece (a short declarative paragraph); everywhere else, let evidence carry the weight.
- Narrative pivots: at least once, deliberately turn the argument ("That is the consensus read. The flows disagree.") — observation correcting interpretation.
- Uncertainty is institutional: say what would prove the read wrong before the piece ends.`;

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
- عند ضعف الأدلة استخدم صيغ الإسناد: "تشير التمركزات إلى…"، "يركز المتداولون بشكل متزايد على…"، "توحي التدفقات بأن…"

نظام الإيقاع البشري (ممنوع إيقاع الترجمة الآلية):
- لا تبدأ فقرتين متتاليتين بالأداة نفسها (إن/و/كما/في) — نوّع المداخل كما يفعل محرر حقيقي
- ممنوع سلاسل الربط المترجمة: "بالإضافة إلى ذلك"، "علاوة على ذلك"، "ومن الجدير بالذكر"، "في الختام" — الانتقال يكون عبر منطق السوق نفسه
- نوّع أطوال الجمل: جملة عربية قصيرة حاسمة بعد فقرة تحليلية طويلة تصنع الإيقاع الصحفي المطلوب
- فقرة ضاربة واحدة على الأقل من جملة واحدة عند نقطة تحول في القراءة
- اذكر قبل نهاية المقال ما الذي قد يُبطل هذه القراءة — فالتحوط المهني جزء من الصوت المؤسسي

طبقة القناعة والتحديد المؤسسي (تفسير لا تلخيص تعليمي):
- اذكر ما الذي يُسعّره السوق حالياً، ثم هل تؤكده الأدلة عبر الأصول أم تناقضه — اعتماداً على سياق التقارب والإدراك أعلاه، دون اختلاق قراءة لا تدعمها البيانات
- أطر التناقض إلزامي عند وجود انفصال موثق: سمِّ القراءة السائدة ثم الدليل المخالف ("قوة الأسهم تشير إلى هبوط ناعم، لكن المقدمة القصيرة لمنحنى العائد لا تؤكد ذلك"). وإن لم يوجد تناقض موثق فاذكر ما الذي يتوافق بوضوح — دون اختلاق توتر
- ترسيخ البيانات: عند توفر رقم موثق اذكر القيمة الفعلية والسابقة ولماذا يهم الفارق ("بلغ مؤشر نفقات الاستهلاك الأساسي 3.3% مقابل 3.1% سابقاً، ما يُبقي مشكلة تضخم الخدمات دون حل"). لا تخترع رقماً قط
- الإبطال: قبل ختام المقال، حدّد الشرط الملموس — مستوى، فارق عائد، بيان اقتصادي، تحول في الاتساع أو التقلب — الذي يُبطل القراءة الحالية
- ممنوع حشو التحوط: "يبقى غير مؤكد"، "يترقب المستثمرون"، "قد يُحتمل"، "الوقت وحده كفيل" — استبدل الغموض بشرط محدد: "إذا [محفز]، فإن [آلية] ستضغط على [أصل مُسمّى]"
- القناعة تُعبَّر عنها بالبنية والأدلة لا بتوقع سعري أو توصية شراء/بيع؛ الحدة تأتي من التحديد لا من اليقين`;
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
  HUMAN_PACING,
  CONVICTION_SPECIFICITY,
  relevantCausalChains,
  buildVoicePromptBlock,
  buildArabicVoiceBlock,
};
