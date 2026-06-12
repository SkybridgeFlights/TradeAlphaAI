'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {
  VISUAL_LANGUAGE,
  EXPORT_TARGETS,
  VISUAL_TYPES,
  ANNOTATION_TYPES,
} = require('./editorial-visual-language');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const OUTPUT_PATH = path.join(ROOT, 'data', 'visual', 'editorial-graphics.json');
const SOCIAL_OUTPUT_PATH = path.join(ROOT, 'data', 'social', 'social-graphics-preview.json');
const MAX_SOURCE_AGE_HOURS = 48;
const COOLDOWN_HOURS = 18;

const INPUT_PATHS = {
  charts: 'data/intelligence/chart-narratives.json',
  cognition: 'data/intelligence/market-cognition.json',
  convergence: 'data/intelligence/narrative-convergence.json',
  tension: 'data/intelligence/structural-tension.json',
  memory: 'data/intelligence/editorial-market-memory.json',
  pulse: 'data/intelligence/market-pulse.json',
  social: 'data/social/social-preview.json',
};

function readJson(relativePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  } catch {
    return fallback;
  }
}

function iso(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function sourceTime(source) {
  return iso(source?.updated_at || source?.generated_at || source?.run_date);
}

function isFresh(source, nowMs) {
  const stamp = sourceTime(source);
  return Boolean(stamp) && nowMs - Date.parse(stamp) <= MAX_SOURCE_AGE_HOURS * 3600000;
}

function isVerified(source, nowMs) {
  return source?.verified === true && isFresh(source, nowMs);
}

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function cleanSymbol(value) {
  const normalized = String(value || '').trim().toUpperCase();
  const map = {
    TREASURY: 'US10Y',
    'TREASURY YIELDS': 'US10Y',
    GOLD: 'GOLD',
    OIL: 'OIL',
  };
  return map[normalized] || normalized.replace(/[^A-Z0-9.-]/g, '');
}

function compactEvidence(values) {
  return [...new Set((values || []).filter(Boolean).map(String))].slice(0, 6);
}

function catalystNameAr(name) {
  const names = {
    'Retail Sales': 'مبيعات التجزئة',
    'FOMC Rate Decision': 'قرار الاحتياطي الفيدرالي بشأن الفائدة',
    CPI: 'مؤشر أسعار المستهلك',
    NFP: 'تقرير الوظائف الأميركية',
    PCE: 'مؤشر نفقات الاستهلاك الشخصي',
    'Initial Jobless Claims': 'طلبات إعانة البطالة الأولية',
  };
  return names[name] || name;
}

function renderingContract(mode, emphasis, options = {}) {
  return {
    version: '1.0',
    mode,
    emphasis,
    visual_language: 'institutional-editorial-v1',
    data_policy: 'verified-evidence-only',
    price_series_policy: options.priceSeries === true ? 'sourced-provider-only' : 'none',
    maximum_labels: VISUAL_LANGUAGE.density.maximum_labels,
    maximum_annotations: VISUAL_LANGUAGE.annotation.maximum,
    quiet_area_ratio: VISUAL_LANGUAGE.whitespace.minimum_quiet_area_ratio,
    rtl_safe: true,
    static_render: true,
    hydration_required: false,
  };
}

function exportContracts(targets) {
  return targets.map((target) => ({ target, ...EXPORT_TARGETS[target] }));
}

function makeGraphic(candidate, nowIso) {
  const evidenceRefs = compactEvidence(candidate.evidence_refs);
  const core = {
    visual_type: candidate.visual_type,
    headline_en: candidate.headline_en,
    headline_ar: candidate.headline_ar,
    narrative_context: candidate.narrative_context,
    evidence_refs: evidenceRefs,
    chart_symbol_refs: [...new Set((candidate.chart_symbol_refs || []).map(cleanSymbol).filter(Boolean))].slice(0, 4),
    annotations: (candidate.annotations || []).slice(0, VISUAL_LANGUAGE.annotation.maximum),
  };
  const sourceHash = hash(core);
  return {
    id: candidate.id,
    ...core,
    allowed_platforms: candidate.allowed_platforms,
    visual_priority: candidate.visual_priority,
    calm_mode_compatible: candidate.calm_mode_compatible,
    export_targets: exportContracts(candidate.export_targets),
    rendering_contract: candidate.rendering_contract,
    attribution: candidate.attribution,
    verified: true,
    stale: false,
    status: 'active',
    source_hash: sourceHash,
    generated_at: nowIso,
  };
}

function chartCandidates(charts, nowMs) {
  if (!isVerified(charts, nowMs)) return [];
  return (charts.selected || []).map((chart, index) => {
    const symbols = chart.symbols || chart.chart_symbol_refs || [];
    const evidence = compactEvidence(chart.evidence_refs || chart.evidence);
    const type = /position/i.test(chart.visual_type || '') ? 'positioning-structure'
      : /volatility/i.test(chart.visual_type || '') ? 'volatility-state'
      : /cross|divergence|breadth/i.test(chart.visual_type || '') ? 'cross-asset-relationship'
      : 'market-structure';
    const annotationType = type === 'cross-asset-relationship' ? 'divergence-highlight'
      : type === 'volatility-state' ? 'volatility-compression-zone'
      : 'commentary-label';
    return {
      id: `chart-${chart.id || index}`,
      visual_type: type,
      headline_en: chart.title_en || chart.headline_en || 'Verified market structure',
      headline_ar: chart.title_ar || chart.headline_ar || 'بنية سوقية موثقة',
      narrative_context: {
        en: chart.reading_en || chart.narrative_en || 'The visual isolates one verified structural relationship.',
        ar: chart.reading_ar || chart.narrative_ar || 'يعزل الرسم علاقة هيكلية واحدة تستند إلى بيانات موثقة.',
      },
      evidence_refs: evidence,
      allowed_platforms: ['article-inline', 'outlook-inline', 'telegram', 'x', 'instagram', 'linkedin'],
      visual_priority: Number(chart.priority || 78),
      calm_mode_compatible: type !== 'volatility-state',
      export_targets: ['article-inline', 'outlook-inline', 'telegram', 'x', 'instagram', 'linkedin'],
      chart_symbol_refs: symbols,
      annotations: evidence.length ? [{
        type: annotationType,
        label_en: chart.annotation_en || 'Verified structural relationship',
        label_ar: chart.annotation_ar || 'علاقة هيكلية موثقة',
        evidence_ref: evidence[0],
      }] : [],
      rendering_contract: renderingContract(type === 'cross-asset-relationship' ? 'relationship-map' : 'sourced-chart', 'structural-reading', { priceSeries: true }),
      attribution: chart.attribution || 'TradeAlphaAI chart narrative; sourced market data only.',
    };
  });
}

function convergenceCandidates(convergence, nowMs) {
  if (!isVerified(convergence, nowMs)) return [];
  return (convergence.diverges || []).slice(0, 2).map((link) => {
    const legs = (link.legs || []).map(cleanSymbol).filter(Boolean);
    const evidence = [`convergence:${link.id}`];
    return {
      id: `relationship-${link.id}`,
      visual_type: 'cross-asset-relationship',
      headline_en: `${legs.join(' / ')} relationship is not confirming`,
      headline_ar: `العلاقة بين ${legs.join(' و')} لا تقدم تأكيداً متماسكاً`,
      narrative_context: {
        en: link.en || 'The cross-asset relationship remains internally unresolved.',
        ar: link.ar || 'تظل العلاقة بين الأصول غير محسومة من الداخل.',
      },
      evidence_refs: evidence,
      allowed_platforms: ['article-inline', 'outlook-inline', 'telegram', 'x', 'instagram', 'linkedin'],
      visual_priority: 82,
      calm_mode_compatible: true,
      export_targets: ['article-inline', 'outlook-inline', 'telegram', 'x', 'instagram', 'linkedin'],
      chart_symbol_refs: legs,
      annotations: [{
        type: 'divergence-highlight',
        label_en: 'Verified divergence',
        label_ar: 'انفصال موثق',
        evidence_ref: evidence[0],
      }],
      rendering_contract: renderingContract('relationship-map', 'cross-asset-strain'),
      attribution: 'TradeAlphaAI narrative convergence; sourced market relationships.',
    };
  });
}

function tensionCandidates(tension, nowMs) {
  if (!isVerified(tension, nowMs) || Number(tension.tension_score || 0) < 20) return [];
  const evidence = compactEvidence((tension.strain_map || []).map((track) => `structural-tension:${track.id}`));
  return [{
    id: `regime-${tension.regime_condition || 'pressured'}`,
    visual_type: 'regime-transition',
    headline_en: 'Structural pressure is testing regime stability',
    headline_ar: 'الضغط الهيكلي يختبر تماسك النظام السوقي',
    narrative_context: {
      en: tension.summary_en,
      ar: tension.summary_ar,
    },
    evidence_refs: evidence,
    allowed_platforms: ['article-inline', 'outlook-inline', 'telegram', 'x', 'linkedin'],
    visual_priority: 88,
    calm_mode_compatible: false,
    export_targets: ['article-inline', 'outlook-inline', 'telegram', 'x', 'linkedin'],
    chart_symbol_refs: [],
    annotations: evidence.slice(0, 2).map((ref) => ({
      type: 'pressure-band',
      label_en: 'Persistent structural pressure',
      label_ar: 'ضغط هيكلي مستمر',
      evidence_ref: ref,
    })),
    rendering_contract: renderingContract('regime-band', 'transition-pressure'),
    attribution: 'TradeAlphaAI structural tension engine; verified state only.',
  }];
}

function catalystCandidates(pulse, nowMs) {
  if (!isVerified(pulse, nowMs)) return [];
  const next = (pulse.catalysts_today || [])
    .filter((item) => Date.parse(item.time || '') > nowMs)
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time))[0];
  if (!next || Date.parse(next.time) - nowMs > 7 * 86400000) return [];
  const eventIso = iso(next.time);
  const nameAr = catalystNameAr(next.name);
  const evidence = [`market-pulse:catalyst:${next.name}:${eventIso}`];
  const symbols = (next.assets || []).map(cleanSymbol).filter((item) => /^[A-Z0-9.-]{2,8}$/.test(item));
  return [{
    id: `catalyst-${String(next.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    visual_type: 'catalyst-watch',
    headline_en: `${next.name} is the next scheduled market test`,
    headline_ar: `${nameAr} هي محطة الاختبار المجدولة التالية للسوق`,
    narrative_context: {
      en: `The visual prioritizes timing and verified asset sensitivity without assigning a directional outcome.`,
      ar: 'يركز الرسم على التوقيت وحساسية الأصول الموثقة من دون إسناد نتيجة اتجاهية.',
    },
    evidence_refs: evidence,
    allowed_platforms: ['outlook-inline', 'telegram', 'x', 'facebook', 'linkedin'],
    visual_priority: 70,
    calm_mode_compatible: true,
    export_targets: ['outlook-inline', 'telegram', 'x', 'facebook', 'linkedin'],
    chart_symbol_refs: symbols,
    annotations: [{
      type: 'catalyst-zone',
      label_en: eventIso,
      label_ar: `توقيت الحدث: ${eventIso}`,
      evidence_ref: evidence[0],
    }],
    rendering_contract: {
      ...renderingContract('catalyst-card', 'timing-and-sensitivity'),
      event_time: eventIso,
      event_name: next.name,
      event_name_ar: nameAr,
    },
    attribution: 'TradeAlphaAI market pulse; scheduled event time from the verified economic calendar.',
  }];
}

function memoryCandidates(memory, nowMs) {
  if (!isVerified(memory, nowMs)) return [];
  const persistent = (memory.narratives || []).filter((item) => item.active && Number(item.sessions || 0) >= 2);
  if (!persistent.length || !(memory.timeline || []).length) return [];
  const items = (memory.timeline || []).slice(-3);
  const evidence = compactEvidence(items.flatMap((item) => item.evidence || []).concat(items.map((item) => `editorial-memory:${item.id}`)));
  return [{
    id: `memory-${persistent[0].id}`,
    visual_type: 'market-memory-timeline',
    headline_en: 'The market is carrying unresolved structure across sessions',
    headline_ar: 'السوق يحمل بنية غير محسومة عبر الجلسات',
    narrative_context: {
      en: persistent[0].en,
      ar: persistent[0].ar,
    },
    evidence_refs: evidence,
    allowed_platforms: ['article-inline', 'outlook-inline', 'instagram', 'linkedin'],
    visual_priority: 74,
    calm_mode_compatible: true,
    export_targets: ['article-inline', 'outlook-inline', 'instagram', 'linkedin'],
    chart_symbol_refs: [],
    annotations: items.map((item) => ({
      type: 'commentary-label',
      label_en: `${item.date}: ${item.en}`,
      label_ar: `${item.date}: ${item.ar}`,
      evidence_ref: `editorial-memory:${item.id}`,
    })),
    rendering_contract: {
      ...renderingContract('memory-timeline', 'persistence'),
      timeline: items.map((item) => ({ date: item.date, kind: item.kind })),
    },
    attribution: 'TradeAlphaAI editorial memory; verified session history only.',
  }];
}

function calmCandidate(pulse, tension, nowMs) {
  if (!isVerified(pulse, nowMs) || !isVerified(tension, nowMs)) return [];
  if (Number(tension.tension_score || 0) >= 20) return [];
  const evidence = ['market-pulse:verified-session', `structural-tension:${tension.regime_condition}`];
  return [{
    id: `monitoring-${String(tension.regime_condition || 'stable')}`,
    visual_type: 'calm-monitoring',
    headline_en: 'A calm session still requires structural confirmation',
    headline_ar: 'هدوء الجلسة لا يلغي الحاجة إلى تأكيد هيكلي',
    narrative_context: {
      en: pulse.pulse_banner || tension.summary_en,
      ar: tension.summary_ar,
    },
    evidence_refs: evidence,
    allowed_platforms: ['article-inline', 'outlook-inline'],
    visual_priority: 42,
    calm_mode_compatible: true,
    export_targets: ['article-inline', 'outlook-inline'],
    chart_symbol_refs: [],
    annotations: [],
    rendering_contract: renderingContract('monitoring-card', 'quiet-observation'),
    attribution: 'TradeAlphaAI market pulse and structural tension engines.',
  }];
}

function sameSymbolSet(left, right) {
  const a = [...(left || [])].sort().join('|');
  const b = [...(right || [])].sort().join('|');
  return Boolean(a) && a === b;
}

function applySelection(candidates, tension, previous, nowIso) {
  const stress = Number(tension?.tension_score || 0) >= 45;
  const limit = stress
    ? VISUAL_LANGUAGE.density.stress_graphics_per_surface
    : VISUAL_LANGUAGE.density.calm_graphics_per_surface;
  const prior = new Map((previous?.graphics || []).map((item) => [item.id, item]));
  const active = [];
  const suppressed = [];

  for (const candidate of candidates.sort((a, b) => b.visual_priority - a.visual_priority)) {
    if (!VISUAL_TYPES.includes(candidate.visual_type)) {
      suppressed.push({ id: candidate.id, reason: 'unsupported-visual-type' });
      continue;
    }
    if (active.some((item) => item.id === candidate.id || sameSymbolSet(item.chart_symbol_refs, candidate.chart_symbol_refs))) {
      suppressed.push({ id: candidate.id, reason: 'duplicate-visual-or-symbol-set' });
      continue;
    }
    if (active.length >= limit) {
      suppressed.push({ id: candidate.id, reason: 'session-density-limit' });
      continue;
    }
    const graphic = makeGraphic(candidate, nowIso);
    const old = prior.get(graphic.id);
    if (old?.source_hash === graphic.source_hash) graphic.generated_at = old.generated_at;
    active.push(graphic);
  }

  return { active, suppressed, stress, limit };
}

function buildSocialGraphics(graphicsArtifact, social, nowIso) {
  const socialTargets = ['telegram', 'x', 'instagram', 'facebook', 'linkedin'];
  const previews = [];
  for (const platform of socialTargets) {
    const graphic = graphicsArtifact.graphics.find((item) => item.allowed_platforms.includes(platform));
    if (!graphic) continue;
    const socialPair = (social?.previews || []).find((item) => item.platform === platform && item.language === 'en');
    previews.push({
      id: `${platform}:${graphic.id}`,
      platform,
      graphic_id: graphic.id,
      generated_at: nowIso,
      mode: 'preview_only',
      posting_enabled: false,
      verified: true,
      stale: false,
      dimensions: EXPORT_TARGETS[platform],
      image_composition_contract: {
        visual_type: graphic.visual_type,
        headline_en: graphic.headline_en,
        headline_ar: graphic.headline_ar,
        narrative_context: graphic.narrative_context,
        evidence_refs: graphic.evidence_refs,
        attribution: graphic.attribution,
        rendering_contract: graphic.rendering_contract,
        visual_language: 'institutional-editorial-v1',
      },
      caption_pairing: {
        source_story_id: socialPair?.source_story_id || null,
        source_hash: socialPair?.source_hash || null,
        english_preview_available: Boolean(socialPair),
        bilingual_required: true,
      },
      approval: { required: true, status: 'preview' },
    });
  }
  return {
    version: '1.0',
    updated_at: nowIso,
    mode: 'preview_only',
    posting_enabled: false,
    credentials_required: false,
    verified: graphicsArtifact.verified,
    source_artifact: 'data/visual/editorial-graphics.json',
    exports: previews,
    policy: {
      one_idea_per_visual: true,
      automatic_posting: false,
      platform_safe_layouts: true,
      bilingual_composition: true,
    },
  };
}

function buildArtifacts(inputs, previous = {}, now = new Date()) {
  const nowIso = now.toISOString();
  const nowMs = now.getTime();
  const sources = Object.fromEntries(Object.entries(INPUT_PATHS).map(([key, relativePath]) => [
    key,
    {
      path: relativePath,
      verified: isVerified(inputs[key], nowMs),
      updated_at: sourceTime(inputs[key]),
    },
  ]));
  const verifiedCore = ['convergence', 'tension', 'memory', 'pulse'].every((key) => sources[key].verified);
  const candidates = [
    ...chartCandidates(inputs.charts, nowMs),
    ...convergenceCandidates(inputs.convergence, nowMs),
    ...tensionCandidates(inputs.tension, nowMs),
    ...catalystCandidates(inputs.pulse, nowMs),
    ...memoryCandidates(inputs.memory, nowMs),
  ];
  if (!candidates.length) candidates.push(...calmCandidate(inputs.pulse, inputs.tension, nowMs));

  const selection = verifiedCore
    ? applySelection(candidates, inputs.tension, previous, nowIso)
    : { active: [], suppressed: candidates.map((item) => ({ id: item.id, reason: 'core-source-unverified' })), stress: false, limit: 0 };

  const artifact = {
    version: '1.0',
    updated_at: nowIso,
    run_date: nowIso.slice(0, 10),
    verified: verifiedCore,
    stale: !verifiedCore,
    mode: selection.stress ? 'elevated-density' : 'calm-restraint',
    source_artifacts: sources,
    visual_language: {
      contract: 'tools/editorial-visual-language.js',
      version: VISUAL_LANGUAGE.version,
    },
    selection_policy: {
      verified_only: true,
      one_idea_per_visual: true,
      calm_limit: VISUAL_LANGUAGE.density.calm_graphics_per_surface,
      stress_limit: VISUAL_LANGUAGE.density.stress_graphics_per_surface,
      symbol_cooldown_hours: COOLDOWN_HOURS,
      duplicate_chart_suppression: true,
      visual_fatigue_suppression: true,
    },
    graphics: selection.active,
    suppressed: selection.suppressed,
  };
  return { artifact, social: buildSocialGraphics(artifact, inputs.social, nowIso) };
}

function main() {
  const inputs = Object.fromEntries(Object.entries(INPUT_PATHS).map(([key, relativePath]) => [key, readJson(relativePath)]));
  const previous = readJson('data/visual/editorial-graphics.json');
  const result = buildArtifacts(inputs, previous);
  if (!WRITE) {
    console.log(`[editorial-graphics] Dry run: ${result.artifact.graphics.length} active, ${result.artifact.suppressed.length} suppressed.`);
    return;
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.mkdirSync(path.dirname(SOCIAL_OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(result.artifact, null, 2)}\n`, 'utf8');
  fs.writeFileSync(SOCIAL_OUTPUT_PATH, `${JSON.stringify(result.social, null, 2)}\n`, 'utf8');
  console.log(`[editorial-graphics] Wrote ${path.relative(ROOT, OUTPUT_PATH)} (${result.artifact.graphics.length} active).`);
  console.log(`[editorial-graphics] Wrote ${path.relative(ROOT, SOCIAL_OUTPUT_PATH)} (${result.social.exports.length} export previews).`);
}

if (require.main === module) main();

module.exports = {
  buildArtifacts,
  isVerified,
  ANNOTATION_TYPES,
  MAX_SOURCE_AGE_HOURS,
};
