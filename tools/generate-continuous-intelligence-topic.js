'use strict';

/**
 * Phase 70 Part B — Continuous Intelligence Topic Generator
 * Reads all intelligence data layers, detects publishable signals,
 * and populates data/continuous-intelligence-queue.json.
 *
 * Usage:
 *   node tools/generate-continuous-intelligence-topic.js [--write]
 */

const fs   = require('fs');
const path = require('path');

const ROOT             = path.resolve(__dirname, '..');
const WRITE            = process.argv.includes('--write');
const TODAY            = new Date().toISOString().slice(0, 10);

const REGIME_V2_PATH   = path.join(ROOT, 'data', 'intelligence', 'regime-engine-v2.json');
const INTEL_CTX_PATH   = path.join(ROOT, 'data', 'intelligence', 'market-intelligence-context.json');
const CONTINUITY_PATH  = path.join(ROOT, 'data', 'intelligence', 'narrative-continuity.json');
const HISTORY_PATH     = path.join(ROOT, 'data', 'intelligence', 'historical-memory.json');
const NARRATIVE_PATH   = path.join(ROOT, 'data', 'narrative-memory.json');
const KNOWLEDGE_PATH   = path.join(ROOT, 'data', 'content-knowledge-graph.json');
const TRANSMISSION_PATH = path.join(ROOT, 'data', 'intelligence', 'cross-asset-transmission.json');
const ETF_FLOW_PATH    = path.join(ROOT, 'data', 'intelligence', 'etf-flow-intelligence.json');
const RATE_PATH        = path.join(ROOT, 'data', 'intelligence', 'rate-path-intelligence.json');
const VISUAL_DIR       = path.join(ROOT, 'data', 'visual');
const QUEUE_PATH       = path.join(ROOT, 'data', 'continuous-intelligence-queue.json');

const MIN_CONFIDENCE      = 40;
const FAMILY_COOLDOWN_DAYS = 10;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z');
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 55)
    + '-' + TODAY;
}

function readVisualData() {
  const result = {};
  if (!fs.existsSync(VISUAL_DIR)) return result;
  for (const file of fs.readdirSync(VISUAL_DIR)) {
    if (!file.endsWith('.json')) continue;
    result[file.replace('.json', '')] = readJson(path.join(VISUAL_DIR, file), {});
  }
  return result;
}

// ── Signal detectors ──────────────────────────────────────────────────────────

function detectSignals(regimeV2, intelCtx, continuity, history, narrative, visual, transmission, etfFlow, ratePath) {
  const cls      = regimeV2?.classifications || {};
  const snap     = narrative?.latest_snapshot || {};
  const insights = continuity?.insights || [];
  const signals  = [];

  const riskAppetite   = cls.risk_appetite?.label   || '';
  const volLabel       = cls.volatility_regime?.label || '';
  const yieldLabel     = cls.yield_curve?.label      || '';
  const breadthLabel   = cls.breadth_conditions?.label || '';
  const rateLabel      = cls.rate_path?.label        || '';
  const inflationLabel = cls.inflation_regime?.label || '';
  const sectorLeaders  = snap.sector_leadership || [];

  // 1. Breadth divergence
  const breadthWeak = /weak|compressed|narrow|deteriorat/i.test(breadthLabel);
  if (breadthWeak && riskAppetite === 'risk_on') {
    signals.push({
      family: 'breadth_divergence',
      trigger: 'breadth_weak_risk_on',
      title_en: 'Breadth Divergence: Narrow Market Rally and Concentration Risk',
      title_ar: 'تباعد الاتساع: مسيرة سوقية ضيقة ومخاطر التركيز',
      evidence: [
        `Market breadth: ${breadthLabel}`,
        `Risk appetite: ${riskAppetite}`,
        ...(cls.breadth_conditions?.evidence || []).slice(0, 2),
      ],
      confidence: Math.min(80, (cls.breadth_conditions?.confidence || 40) + 15),
    });
  }

  // 2. Volatility compression
  if (/compress|low/i.test(volLabel)) {
    signals.push({
      family: 'volatility_compression',
      trigger: 'vol_compressed',
      title_en: 'Volatility Compression: Breakout Risk and Regime Shift Watch',
      title_ar: 'انضغاط التذبذب: مخاطر الاختراق ومراقبة تحول النظام',
      evidence: [`Volatility: ${volLabel}`, ...(cls.volatility_regime?.evidence || []).slice(0, 2)],
      confidence: Math.min(75, cls.volatility_regime?.confidence || 45),
    });
  }

  // 3. Volatility expansion
  if (/elevat|high|spike/i.test(volLabel)) {
    signals.push({
      family: 'volatility_expansion',
      trigger: 'vol_elevated',
      title_en: 'Elevated Volatility: Risk Regime Assessment and Portfolio Implications',
      title_ar: 'ارتفاع التذبذب: تقييم نظام المخاطر وانعكاسات المحفظة',
      evidence: [`Volatility: ${volLabel}`, ...(cls.volatility_regime?.evidence || []).slice(0, 2)],
      confidence: Math.min(80, cls.volatility_regime?.confidence || 50),
    });
  }

  // 4. Sector leadership transition (from continuity)
  const sectorTransInsights = insights.filter(i =>
    i.type === 'sector_leadership_transition' || i.type === 'sector_leadership_dominant'
  );
  if (sectorTransInsights.length > 0) {
    const si = sectorTransInsights[0];
    const sectors = (si.sectors || []).slice(0, 2).join(', ') || 'Key sectors';
    signals.push({
      family: 'sector_leadership_transition',
      trigger: si.direction || si.type,
      title_en: `Sector Leadership Shift: ${sectors} and Market Rotation`,
      title_ar: `تحول قيادة القطاعات: ${sectors} ودوران السوق`,
      evidence: [si.reason_en || 'Sector transition detected', ...(si.sectors || []).slice(0, 2)],
      confidence: si.confidence || 60,
    });
  }

  // 5. AI concentration risk
  const aiTechSectors = sectorLeaders.filter(s => /ai|tech|semiconductor|information_tech/i.test(String(s)));
  if (aiTechSectors.length >= 2) {
    signals.push({
      family: 'ai_concentration_risk',
      trigger: 'ai_tech_dominance',
      title_en: 'AI Sector Concentration Risk: Market Structure and Hidden Fragility',
      title_ar: 'مخاطر تركيز قطاع الذكاء الاصطناعي: هيكل السوق والهشاشة الخفية',
      evidence: [`Leading: ${aiTechSectors.join(', ')}`, 'Concentrated AI/tech leadership pattern'],
      confidence: 62,
    });
  }

  // 6. Yield curve pressure
  if (/invert/i.test(yieldLabel)) {
    signals.push({
      family: 'yield_curve_pressure',
      trigger: 'yield_inverted',
      title_en: 'Inverted Yield Curve: Recession Signal and Rate Path Analysis',
      title_ar: 'انعكاس منحنى العائد: إشارة الركود وتحليل مسار الفائدة',
      evidence: [`Yield curve: ${yieldLabel}`, ...(cls.yield_curve?.evidence || []).slice(0, 2)],
      confidence: Math.min(80, cls.yield_curve?.confidence || 55),
    });
  }

  // 7. Yield curve support (steepening)
  if (/steep/i.test(yieldLabel)) {
    signals.push({
      family: 'yield_curve_support',
      trigger: 'yield_steep',
      title_en: 'Steepening Yield Curve: Growth Regime Signal and Asset Class Implications',
      title_ar: 'تحدب منحنى العائد: إشارة نظام النمو وانعكاسات فئة الأصول',
      evidence: [`Yield curve: ${yieldLabel}`, ...(cls.yield_curve?.evidence || []).slice(0, 2)],
      confidence: Math.min(75, cls.yield_curve?.confidence || 50),
    });
  }

  // 8. Defensive rotation
  const defensiveSectors = sectorLeaders.filter(s =>
    /utilities|consumer_staples|health_care|defensive/i.test(String(s))
  );
  if (defensiveSectors.length >= 1 && riskAppetite !== 'risk_on') {
    signals.push({
      family: 'defensive_rotation',
      trigger: 'defensive_leadership',
      title_en: 'Defensive Rotation: Risk-Off Positioning and Market Structure Shift',
      title_ar: 'الدوران الدفاعي: تموضع هروب من المخاطر وتحول هيكل السوق',
      evidence: [`Defensive leaders: ${defensiveSectors.join(', ')}`, `Risk appetite: ${riskAppetite || 'neutral'}`],
      confidence: 58,
    });
  }

  // 9. Cross-asset divergence
  const txSignals = transmission?.transmission_signals || [];
  if (txSignals.length >= 2) {
    signals.push({
      family: 'cross_asset_divergence',
      trigger: 'transmission_active',
      title_en: 'Cross-Asset Divergence: Active Transmission Channels and Regime Stress',
      title_ar: 'تباعد الأصول المتقاطعة: قنوات الانتقال النشطة وضغط النظام',
      evidence: txSignals.slice(0, 2).map(s => `${s.trigger}: ${s.channel} (chain: ${s.chain_length})`),
      confidence: 56,
    });
  }

  // 10. ETF relationship change
  const etfRotationNote = etfFlow?.rotation_analysis;
  if (etfRotationNote && !(/stable|neutral/i.test(String(etfRotationNote)))) {
    signals.push({
      family: 'etf_relationship_change',
      trigger: 'etf_rotation',
      title_en: 'ETF Flow Rotation: Sector and Asset Class Rebalancing',
      title_ar: 'تحول تدفق صناديق المؤشرات: إعادة توازن القطاع وفئة الأصول',
      evidence: [String(etfRotationNote).slice(0, 80)],
      confidence: 54,
    });
  }

  // 11. Macro transmission chain
  if (txSignals.length >= 3) {
    const longest = txSignals.reduce((best, s) => (s.chain_length > best.chain_length ? s : best), { chain_length: 0 });
    if (longest.chain_length >= 5) {
      signals.push({
        family: 'macro_transmission_chain',
        trigger: longest.trigger,
        title_en: `Macro Transmission: ${String(longest.trigger).replace(/_/g, ' ')} Propagation Framework`,
        title_ar: `الانتقال الكلي: إطار انتشار ${String(longest.trigger).replace(/_/g, ' ')}`,
        evidence: [`Trigger: ${longest.trigger}`, `Channel: ${longest.channel}`, `Chain: ${longest.chain_length} steps`],
        confidence: 60,
      });
    }
  }

  // 12. Confidence trend shift
  const confTrend = continuity?.confidence_trend || {};
  const confDelta = Math.abs(confTrend.delta || 0);
  if (confTrend.direction === 'falling' && confDelta >= 8) {
    signals.push({
      family: 'confidence_trend_shift',
      trigger: 'confidence_declining',
      title_en: 'Declining Intelligence Confidence: Regime Uncertainty and Macro Caution',
      title_ar: 'تراجع ثقة الاستخبارات: عدم اليقين في النظام والحذر الكلي',
      evidence: [`Trend: ${confTrend.direction}`, `Δ: ${confTrend.delta}pt`, `Latest: ${confTrend.latest}%`],
      confidence: 56,
    });
  } else if (confTrend.direction === 'rising' && confDelta >= 8) {
    signals.push({
      family: 'confidence_trend_shift',
      trigger: 'confidence_rising',
      title_en: 'Rising Intelligence Confidence: Emerging Regime Clarity',
      title_ar: 'ارتفاع ثقة الاستخبارات: وضوح النظام الناشئ',
      evidence: [`Trend: ${confTrend.direction}`, `Δ: ${confTrend.delta}pt`, `Latest: ${confTrend.latest}%`],
      confidence: 60,
    });
  }

  // 13. Narrative persistence / reversal
  const persistInsights  = insights.filter(i => i.type === 'narrative_persistence');
  const transInsights    = insights.filter(i => i.type === 'regime_transition');

  if (transInsights.length > 0) {
    const ti = transInsights[transInsights.length - 1];
    const fieldLabel = String(ti.field || '').replace(/_/g, ' ');
    signals.push({
      family: 'narrative_reversal',
      trigger: `${ti.field}_transition`,
      title_en: `Regime Transition: ${fieldLabel} Shifted from ${ti.from} to ${ti.to}`,
      title_ar: `انتقال النظام: تحوّل ${fieldLabel} من ${ti.from} إلى ${ti.to}`,
      evidence: [ti.reason_en || `${ti.field} changed`, `Date: ${ti.date || TODAY}`],
      confidence: ti.confidence || 65,
    });
  } else if (persistInsights.length > 0) {
    const pi = persistInsights[0];
    const fieldLabel = String(pi.field || '').replace(/_/g, ' ');
    signals.push({
      family: 'narrative_persistence',
      trigger: `${pi.field}_persistent`,
      title_en: `Persistent Regime: ${fieldLabel} Holds Across ${pi.run_days} Periods`,
      title_ar: `نظام مستمر: ${fieldLabel} يستمر عبر ${pi.run_days} فترات`,
      evidence: [pi.reason_en || `${pi.field} persistent`, `Run: ${pi.run_days} periods`],
      confidence: pi.confidence || 55,
    });
  }

  // 14. Rate path with material confidence
  const rateConf = cls.rate_path?.confidence || 0;
  if (rateConf >= 62 && (rateLabel === 'cut_bias' || rateLabel === 'hike_bias')) {
    const rateLabelClean = String(rateLabel).replace(/_/g, ' ');
    signals.push({
      family: 'rate_path_clarity',
      trigger: rateLabel,
      title_en: `Rate Path Clarity: ${rateLabelClean} Regime and Asset Class Implications`,
      title_ar: `وضوح مسار الفائدة: نظام ${rateLabelClean} وانعكاسات فئات الأصول`,
      evidence: [`Rate path: ${rateLabel} (${rateConf}% confidence)`, ...(cls.rate_path?.evidence || []).slice(0, 2)],
      confidence: Math.min(78, rateConf),
    });
  }

  return signals;
}

// ── Candidate builder ─────────────────────────────────────────────────────────

function buildCandidates(signals, existingQueue) {
  // Index family → days since last publication
  const publishedFamilyAge = {};
  for (const topic of (existingQueue.topics || [])) {
    if (topic.status === 'published' && topic.family) {
      const dateStr = (topic.published_at || '').slice(0, 10) || (topic.created_at || '').slice(0, 10);
      const age = daysSince(dateStr);
      if (publishedFamilyAge[topic.family] === undefined || age < publishedFamilyAge[topic.family]) {
        publishedFamilyAge[topic.family] = age;
      }
    }
  }

  const existingSlugsBase = new Set(
    (existingQueue.topics || []).map(t => String(t.slug || '').replace(/-\d{4}-\d{2}-\d{2}$/, ''))
  );

  const candidates = [];

  for (const signal of signals) {
    if (signal.confidence < MIN_CONFIDENCE) continue;

    // Family cooldown
    const familyAge = publishedFamilyAge[signal.family];
    if (familyAge !== undefined && familyAge < FAMILY_COOLDOWN_DAYS) {
      console.log(`[continuous-intelligence] Cooldown: family=${signal.family} last_pub=${familyAge}d ago`);
      continue;
    }

    // Slug dedup (strip date suffix for comparison)
    const baseSlug = String(signal.title_en || '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
    if (existingSlugsBase.has(baseSlug)) continue;

    const slug = slugify(signal.title_en);

    candidates.push({
      slug,
      title_en:           signal.title_en,
      title_ar:           signal.title_ar,
      family:             signal.family,
      trigger:            signal.trigger,
      evidence:           signal.evidence,
      confidence:         Math.round(signal.confidence),
      data_quality:       'structural',
      created_at:         new Date().toISOString(),
      target_publish_date: TODAY,
      status:             'planned',
      overflow_generated: true,
    });
  }

  return candidates;
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const regimeV2    = readJson(REGIME_V2_PATH, null);
  const intelCtx    = readJson(INTEL_CTX_PATH, null);
  const continuity  = readJson(CONTINUITY_PATH, null);
  const history     = readJson(HISTORY_PATH, null);
  const narrative   = readJson(NARRATIVE_PATH, null);
  const transmission = readJson(TRANSMISSION_PATH, null);
  const etfFlow     = readJson(ETF_FLOW_PATH, null);
  const ratePath    = readJson(RATE_PATH, null);
  const visual      = readVisualData();

  if (!regimeV2 && !intelCtx && !continuity) {
    console.log('[continuous-intelligence] No intelligence data available — skipping.');
    process.exit(0);
  }

  const signals  = detectSignals(regimeV2, intelCtx, continuity, history, narrative, visual, transmission, etfFlow, ratePath);
  console.log(`[continuous-intelligence] ${signals.length} signal(s) detected`);

  const existingQueue = readJson(QUEUE_PATH, { schema_version: '1.0', topics: [] });
  const candidates    = buildCandidates(signals, existingQueue);

  console.log(`[continuous-intelligence] ${candidates.length} new candidate(s) after filters`);

  existingQueue.schema_version    = '1.0';
  existingQueue.updated           = new Date().toISOString();
  existingQueue.last_checked      = new Date().toISOString();
  existingQueue.last_signal_count = signals.length;
  existingQueue.topics            = [...(existingQueue.topics || []), ...candidates];

  if (candidates.length > 0) {
    for (const c of candidates) {
      console.log(`[continuous-intelligence] candidate: ${c.slug} (family=${c.family} conf=${c.confidence})`);
    }
  } else {
    console.log('[continuous-intelligence] No new candidates — families in cooldown or signals below threshold.');
  }

  if (WRITE) {
    fs.mkdirSync(path.dirname(QUEUE_PATH), { recursive: true });
    fs.writeFileSync(QUEUE_PATH, JSON.stringify(existingQueue, null, 2) + '\n', 'utf8');
    console.log(`[continuous-intelligence] Written → data/continuous-intelligence-queue.json`);
  } else {
    console.log('[continuous-intelligence] Dry run — pass --write to persist.');
  }
}

main();
