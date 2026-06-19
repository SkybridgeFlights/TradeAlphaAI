'use strict';

// Phase 208 / Workstreams A+B — Institutional Narrative Engine. Composes the full
// intelligence stack (macro → assets → sectors → equities → historical change)
// into ONE deterministic, evidence-backed market narrative: a dominant story from
// a fixed allowed set, named drivers, confirmation/contradiction, and flowing
// bilingual institutional prose. No fabricated causality, no forecast, no advice.
// (Named *-engine to avoid colliding with the Phase-50 build-market-narrative.js
// library, which is a live-state narrative-block module — a different thing.)
//
// Output: data/intelligence/market-narrative.json
// Usage:  node tools/build-market-narrative-engine.js [--write]

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('market-narrative.json');
const WRITE = process.argv.includes('--write');

const STORY = {
  defensive_rotation_with_selective_leadership: ['defensive rotation with selective leadership', 'تدوير دفاعي مع قيادة انتقائية'],
  broad_risk_participation: ['broad risk participation', 'مشاركة واسعة في المخاطر'],
  narrow_growth_leadership: ['narrow growth leadership', 'قيادة نمو ضيقة'],
  macro_fragility_with_sector_divergence: ['macro fragility with sector divergence', 'هشاشة كلية مع تباعد قطاعي'],
  liquidity_supported_but_participation_mixed: ['liquidity-supported but participation mixed', 'مدعوم بالسيولة لكن المشاركة مختلطة'],
  historical_deterioration_under_calm_volatility: ['historical deterioration under calm volatility', 'تدهور تاريخي تحت تقلب هادئ'],
  mixed_regime: ['mixed regime', 'نظام مختلط'],
  indeterminate: ['indeterminate', 'غير محدد'],
};
const BAND = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'], indeterminate: ['indeterminate', 'غير محددة'] };

function readJson(p, f = null) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; } }
function lbl(o, ar, key) { return o && o[`${key}_${ar ? 'ar' : 'en'}`] ? o[`${key}_${ar ? 'ar' : 'en'}`] : (ar ? 'غير محدد' : 'indeterminate'); }

function build() {
  const macro = readJson(J('macro-regime.json'), {});
  const dollar = readJson(J('dollar-intelligence.json'), {});
  const yieldA = readJson(J('yield-intelligence.json'), {});
  const vol = readJson(J('volatility-intelligence.json'), {});
  const net = readJson(J('cognitive-network.json'), {});
  const sectorRot = readJson(J('sector-rotation.json'), {});
  const sectorNet = readJson(J('sector-cognitive-network.json'), {});
  const equityNet = readJson(J('equity-cognitive-network.json'), {});
  const histScores = readJson(J('historical-intelligence.json'), {});
  const transitions = readJson(J('regime-transitions.json'), {});

  const macroReg = macro && macro.available ? macro.macro_regime : 'indeterminate';
  const rot = sectorRot && sectorRot.available ? sectorRot.rotation_state : 'indeterminate';
  const sectorNetDom = sectorNet && sectorNet.dominant_sector_state ? sectorNet.dominant_sector_state.state : 'indeterminate';
  const equityNetDom = equityNet && equityNet.dominant_equity_state ? equityNet.dominant_equity_state.state : 'indeterminate';
  const netDom = net && net.dominant_network_state ? net.dominant_network_state.state : 'indeterminate';
  const volReg = vol && vol.available ? vol.volatility_regime : 'indeterminate';
  const yieldReg = yieldA && yieldA.available ? yieldA.yield_regime : 'indeterminate';
  const transition = transitions && transitions.available ? transitions.transition_state : 'indeterminate';
  const leaders = (sectorRot && sectorRot.leadership_sectors || []).map((s) => s.symbol);

  let det = 0; let imp = 0;
  for (const g of ['asset', 'sector', 'equity']) for (const x of ((histScores.groups && histScores.groups[g]) || [])) { if (x.momentum && /negative/.test(x.momentum.state)) det += 1; if (x.momentum && /positive/.test(x.momentum.state)) imp += 1; }

  const available = macroReg !== 'indeterminate' || rot !== 'indeterminate' || netDom !== 'indeterminate';
  let story = 'indeterminate';
  if (available) {
    if (macroReg === 'macro_fragility' || (netDom === 'liquidity_stress' && sectorNetDom === 'cross_sector_divergence')) story = 'macro_fragility_with_sector_divergence';
    else if (rot === 'defensive_rotation' || (macroReg === 'defensive_rotation' && leaders.length)) story = 'defensive_rotation_with_selective_leadership';
    else if (rot === 'narrow_growth_leadership') story = 'narrow_growth_leadership';
    else if (rot === 'broad_risk_participation' && volReg === 'calm') story = 'broad_risk_participation';
    else if (det > imp && det >= 8 && volReg === 'calm') story = 'historical_deterioration_under_calm_volatility';
    else if (yieldReg === 'supportive' && netDom !== 'coherent_risk_expansion') story = 'liquidity_supported_but_participation_mixed';
    else story = 'mixed_regime';
  }

  const drivers = {
    macro_driver: { label_en: `${lbl(macro, false, 'macro_regime')} (dollar ${lbl(dollar, false, 'dollar_regime')}, yields ${lbl(yieldA, false, 'yield_regime')}, volatility ${lbl(vol, false, 'volatility_regime')})`, label_ar: `${lbl(macro, true, 'macro_regime')} (الدولار ${lbl(dollar, true, 'dollar_regime')}، العوائد ${lbl(yieldA, true, 'yield_regime')}، التقلب ${lbl(vol, true, 'volatility_regime')})`, evidence: [`macro-regime=${macroReg}`] },
    asset_driver: { label_en: `cross-asset read ${netDom.replace(/_/g, ' ')}`, label_ar: `القراءة عبر الأصول ${net && net.dominant_network_state ? net.dominant_network_state.label_ar : 'غير محدد'}`, evidence: [`cognitive-network=${netDom}`] },
    sector_driver: { label_en: leaders.length ? `sector leadership: ${leaders.join(', ')}` : `sector rotation ${rot.replace(/_/g, ' ')}`, label_ar: leaders.length ? `قيادة القطاعات: ${leaders.join('، ')}` : `تدوير القطاعات ${lbl(sectorRot, true, 'rotation_state')}`, evidence: [`sector-rotation=${rot}`, `leaders ${leaders.join(',') || 'none'}`] },
    equity_driver: { label_en: `single-name read ${equityNetDom.replace(/_/g, ' ')}`, label_ar: `قراءة الأسهم المنفردة ${equityNet && equityNet.dominant_equity_state ? equityNet.dominant_equity_state.label_ar : 'غير محدد'}`, evidence: [`equity-cognitive-network=${equityNetDom}`] },
    historical_change: { label_en: `regime ${transition.replace(/_/g, ' ')}; ${imp} improving vs ${det} deteriorating across the desk`, label_ar: `النظام ${lbl(transitions, true, 'transition_state')}؛ ${imp} يتحسّن مقابل ${det} يتدهور عبر المكتب`, evidence: [`regime-transition=${transition}`, `improving=${imp} deteriorating=${det}`] },
  };

  const confCount = (net && net.confirmation_chains || []).length;
  const contraCount = (net && net.contradiction_chains || []).length;
  const confirmation_story = { label_en: `${confCount} cross-asset confirmation chain(s)`, label_ar: `${confCount} سلسلة تأكيد عبر الأصول`, evidence: [`confirmation_chains=${confCount}`] };
  const contradiction_story = { label_en: `${contraCount} cross-asset contradiction chain(s)`, label_ar: `${contraCount} سلسلة تناقض عبر الأصول`, evidence: [`contradiction_chains=${contraCount}`] };
  const risk_context = { label_en: `volatility ${volReg.replace(/_/g, ' ')}`, label_ar: `التقلب ${lbl(vol, true, 'volatility_regime')}`, evidence: [`volatility-regime=${volReg}`] };

  const resolved = [macroReg, rot, netDom, volReg, transition].filter((x) => x !== 'indeterminate').length;
  const band = !available ? 'indeterminate' : resolved >= 4 ? 'high' : resolved >= 2 ? 'moderate' : 'low';

  const sEn = STORY[story][0]; const sAr = STORY[story][1];
  const prose_en = [
    `The desk reads the tape as ${sEn}. The macro backdrop is ${drivers.macro_driver.label_en}, which frames how incoming catalysts are absorbed rather than where prices go next.`,
    `Beneath the index, ${drivers.sector_driver.label_en}, while the single-name layer reads ${equityNetDom.replace(/_/g, ' ')}. The cross-asset network shows ${confCount} confirmation and ${contraCount} contradiction chain(s) — the confirmations describe what is internally consistent, the contradictions where the move is not yet corroborated.`,
    `Through time, ${drivers.historical_change.label_en}, with volatility ${volReg.replace(/_/g, ' ')}. This is an interpretation of the observed structure and how it is changing; it is educational context, not a forecast or a recommendation, and sets no trade levels. The desk watches whether the confirmations broaden or the contradictions resolve from here.`,
  ].join(' ');
  const prose_ar = [
    `يقرأ المكتب السوق على أنه ${sAr}. الخلفية الكلية هي ${drivers.macro_driver.label_ar}، وهي تؤطّر كيفية امتصاص المحفزات القادمة لا وجهة الأسعار التالية.`,
    `وتحت سطح المؤشر، ${drivers.sector_driver.label_ar}، فيما تقرأ طبقة الأسهم المنفردة ${equityNet && equityNet.dominant_equity_state ? equityNet.dominant_equity_state.label_ar : 'غير محدد'}. وتُظهر الشبكة عبر الأصول ${confCount} سلسلة تأكيد و${contraCount} سلسلة تناقض — تصف التأكيدات ما هو متسق داخلياً، والتناقضات حيث لم تتأكد الحركة بعد.`,
    `وعبر الزمن، ${drivers.historical_change.label_ar}، مع تقلب ${lbl(vol, true, 'volatility_regime')}. وهذا تفسير للبنية المرصودة وكيفية تغيّرها؛ سياق تعليمي، وليس توقعاً ولا توصية، ولا يحدّد مستويات تداول. ويراقب المكتب ما إذا كانت التأكيدات تتّسع أم أن التناقضات تنحلّ من هنا.`,
  ].join(' ');

  return {
    schema_version: '1.0', generated_at: new Date().toISOString(), source_layer: 'market-narrative', available,
    dominant_story: { state: story, label_en: sEn, label_ar: sAr },
    confidence_band: band, confidence_band_en: BAND[band][0], confidence_band_ar: BAND[band][1],
    drivers, confirmation_story, contradiction_story, risk_context,
    narrative: { en: prose_en, ar: prose_ar },
    evidence: [
      `macro-regime=${macroReg}`, `sector-rotation=${rot}`, `cognitive-network=${netDom}`,
      `sector-network=${sectorNetDom}`, `equity-network=${equityNetDom}`, `regime-transition=${transition}`,
      `confirmation=${confCount} contradiction=${contraCount}`, `historical improving=${imp} deteriorating=${det}`,
    ],
    attribution: { sources: ['macro-regime', 'dollar/yield/volatility', 'cognitive networks', 'asset/sector/equity intelligence', 'historical-intelligence', 'regime-transitions'], note: 'Deterministic, evidence-backed market narrative. Educational context — not a forecast or recommendation, and sets no trade levels.' },
  };
}

if (require.main === module) {
  const r = build();
  console.log(`[market-narrative] story=${r.dominant_story.state} band=${r.confidence_band}`);
  console.log('  EN:', r.narrative.en.slice(0, 170) + '…');
  if (WRITE) { fs.writeFileSync(OUT, `${JSON.stringify(r, null, 2)}\n`); console.log('[market-narrative] wrote artifact'); }
}

module.exports = { build, STORY, BAND };
