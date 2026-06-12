'use strict';

// Phase 88 - Social Intelligence Distribution Layer (preview only).
// Builds platform-native, bilingual preview artifacts from verified local
// intelligence. It never posts, reads credentials, or performs network calls.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'data', 'social');
const SITE = 'https://www.tradealphaai.com';
const NOW = new Date();
const TODAY = NOW.toISOString().slice(0, 10);
const STALE_HOURS = 48;

const SOURCES = {
  daily: 'data/intelligence/daily-intelligence-brief.json',
  intraday: 'data/intelligence/intraday-brief.json',
  newsroom: 'data/feeds/newsroom-pulse.json',
  convergence: 'data/intelligence/narrative-convergence.json',
  charts: 'data/intelligence/chart-narratives.json',
  cognition: 'data/intelligence/market-cognition.json',
  outlooks: 'data/feeds/latest-market-outlooks.json',
  articles: 'data/feeds/latest-insights.json',
};

const PLATFORM_CONTRACTS = {
  telegram: { limit: 3200, hashtag_cap: 3, threshold: 62, cooldown_hours: 6 },
  x: { limit: 275, hashtag_cap: 2, threshold: 64, cooldown_hours: 8 },
  'x-thread': { limit: 275, hashtag_cap: 2, threshold: 78, cooldown_hours: 18 },
  facebook: { limit: 1800, hashtag_cap: 3, threshold: 72, cooldown_hours: 18 },
  instagram: { limit: 2000, hashtag_cap: 5, threshold: 74, cooldown_hours: 18 },
  linkedin: { limit: 2200, hashtag_cap: 4, threshold: 68, cooldown_hours: 20 },
};

const PLATFORM_ORDER = ['telegram', 'x', 'x-thread', 'facebook', 'instagram', 'linkedin'];
const HASHTAGS = {
  en: ['#Markets', '#Macro', '#MarketIntelligence'],
  ar: ['#الأسواق', '#الاقتصاد_الكلي', '#استخبارات_السوق'],
};
const DISCLAIMER = {
  en: 'Educational market context only. Not investment advice.',
  ar: 'سياق تعليمي للأسواق فقط، وليس نصيحة استثمارية.',
};

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function hash(value) {
  const serialized = JSON.stringify(value);
  return crypto.createHash('sha256').update(serialized === undefined ? '' : serialized).digest('hex').slice(0, 20);
}

function fresh(artifact, hours = STALE_HOURS) {
  if (!artifact || !artifact.updated_at) return false;
  const age = (NOW.getTime() - new Date(artifact.updated_at).getTime()) / 3600000;
  return Number.isFinite(age) && age >= -1 && age <= hours;
}

function eligibleDate(value, maxAgeDays = 21) {
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time > NOW.getTime()) return false;
  return (NOW.getTime() - time) / 86400000 <= maxAgeDays;
}

function clip(value, max) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function narrativeOverlap(left, right) {
  const tokens = (value) => new Set(String(value || '').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []);
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function localized(item, language, fallback = '') {
  if (!item) return fallback;
  if (typeof item === 'string') return item;
  return language === 'ar'
    ? item.ar || item.title_ar || item.summary_ar || item.name_ar || item.en || fallback
    : item.en || item.title_en || item.summary_en || item.name || fallback;
}

function relatedSymbols(...collections) {
  const symbolPattern = /\b(?:SPY|QQQ|RSP|IWM|NVDA|DXY|GOLD|XAUUSD|VIX|US10Y|TLT|BTC|BTCUSD|OIL)\b/gi;
  const found = [];
  for (const value of collections.flat(Infinity)) {
    if (typeof value === 'string') found.push(...(value.match(symbolPattern) || []));
    if (value && typeof value === 'object') {
      found.push(value.asset, ...(value.legs || []), ...(value.symbols || []));
    }
  }
  return unique(found.map((value) => String(value || '').toUpperCase().replace(/^.*:/, ''))).slice(0, 8);
}

function visualRecommendation(kind, chart, language) {
  if (chart) {
    return {
      type: 'chart-card',
      chart_id: chart.id,
      visual_type: chart.visual_type || chart.kind,
      symbols: chart.symbols || [],
      title: language === 'ar' ? chart.title_ar : chart.title_en,
      attribution: chart.attribution,
      render: false,
    };
  }
  const labels = {
    session: language === 'ar' ? 'بطاقة موجز نظام السوق' : 'market-regime brief card',
    intraday: language === 'ar' ? 'بطاقة تغيرات الجلسة' : 'intraday change card',
    alert: language === 'ar' ? 'بطاقة تنبيه معرفي موثق' : 'verified cognition alert card',
    outlook: language === 'ar' ? 'بطاقة سياق المحفز' : 'catalyst context card',
    article: language === 'ar' ? 'بطاقة خلاصة بحثية' : 'research takeaway card',
  };
  return { type: 'editorial-card', concept: labels[kind] || labels.session, render: false };
}

function buildCandidates(inputs) {
  const { daily, intraday, newsroom, convergence, charts, cognition, outlooks, articles } = inputs;
  const candidates = [];
  const selectedChart = fresh(charts) && charts.verified === true ? (charts.selected || [])[0] : null;

  if (fresh(daily) && daily.verified === true && fresh(convergence) && convergence.verified === true) {
    const coherence = Number(daily.regime?.coherence?.score);
    const divergenceCount = (daily.diverges || []).length;
    const pressureCount = (daily.pressure_active || []).length;
    const alertCount = (cognition?.alerts || []).length;
    const score = Math.min(100, 48 + (Number.isFinite(coherence) && coherence < 70 ? 12 : 0)
      + divergenceCount * 8 + pressureCount * 7 + alertCount * 8 + (selectedChart ? 6 : 0));
    const catalyst = (daily.next_catalysts || [])[0];
    const symbols = relatedSymbols(daily.most_sensitive_assets, daily.diverges, catalyst?.assets, selectedChart);
    candidates.push({
      id: `session-${daily.run_date || TODAY}`,
      kind: 'session',
      verified: true,
      score,
      urgency: score >= 82 ? 'high' : score >= 66 ? 'elevated' : 'routine',
      source_artifact: SOURCES.daily,
      evidence: [SOURCES.daily, SOURCES.convergence, ...(selectedChart ? [SOURCES.charts] : [])],
      title_en: 'Market structure brief',
      title_ar: 'موجز بنية السوق',
      hook_en: daily.regime?.coherence?.en || daily.desk_lead?.en,
      hook_ar: daily.regime?.coherence?.ar || daily.desk_lead?.ar,
      body_en: [
        daily.desk_lead?.en,
        (daily.diverges || [])[0]?.en ? `Divergence in focus: ${(daily.diverges || [])[0].en}.` : null,
        catalyst ? `Next scheduled test: ${catalyst.name}.` : null,
      ].filter(Boolean),
      body_ar: [
        daily.desk_lead?.ar,
        (daily.diverges || [])[0]?.ar ? `موضع التباعد الأبرز: ${(daily.diverges || [])[0].ar}.` : null,
        catalyst ? `الاختبار المجدول التالي: ${catalyst.name_ar || catalyst.name}.` : null,
      ].filter(Boolean),
      symbols,
      url_en: `${SITE}/`,
      url_ar: `${SITE}/ar/`,
      chart: selectedChart,
      platform_bias: {
        telegram: 10, x: 10, 'x-thread': divergenceCount + pressureCount >= 2 ? 12 : -18,
        facebook: -5, instagram: selectedChart ? 14 : -22, linkedin: 10,
      },
    });
  }

  if (fresh(intraday, 18) && intraday.verified === true && ['high', 'critical'].includes(intraday.urgency)
      && (intraday.changes || []).length) {
    const changesEn = (intraday.changes || []).slice(0, 3).map((item) => localized(item, 'en'));
    const changesAr = (intraday.changes || []).slice(0, 3).map((item) => localized(item, 'ar'));
    candidates.push({
      id: `intraday-${intraday.updated_at}`,
      kind: 'intraday',
      verified: true,
      score: intraday.urgency === 'critical' ? 96 : 86,
      urgency: intraday.urgency,
      source_artifact: SOURCES.intraday,
      evidence: [SOURCES.intraday, SOURCES.cognition],
      title_en: 'Intraday intelligence update',
      title_ar: 'تحديث استخبارات الجلسة',
      hook_en: changesEn[0] || intraday.note_en,
      hook_ar: changesAr[0] || intraday.note_ar,
      body_en: changesEn,
      body_ar: changesAr,
      symbols: relatedSymbols(intraday.snapshot?.quote_changes, intraday.snapshot?.alerts),
      url_en: `${SITE}/`,
      url_ar: `${SITE}/ar/`,
      chart: selectedChart,
      platform_bias: { telegram: 15, x: 15, 'x-thread': -10, facebook: -25, instagram: -20, linkedin: -25 },
    });
  }

  if (fresh(cognition) && cognition.verified === true) {
    for (const alert of (cognition.alerts || []).slice(0, 2)) {
      const severity = String(alert.severity || '').toLowerCase();
      const score = severity === 'high' ? 88 : severity === 'medium' ? 72 : 58;
      candidates.push({
        id: `alert-${alert.id || hash(alert)}`,
        kind: 'alert',
        verified: true,
        score,
        urgency: severity === 'high' ? 'high' : 'elevated',
        source_artifact: SOURCES.cognition,
        evidence: [SOURCES.cognition, ...(alert.evidence ? [`cognition:${alert.id}`] : [])],
        title_en: 'Cognition alert',
        title_ar: 'تنبيه معرفي',
        hook_en: alert.en,
        hook_ar: alert.ar,
        body_en: [alert.en],
        body_ar: [alert.ar],
        symbols: relatedSymbols(alert.evidence, alert.source),
        url_en: `${SITE}/`,
        url_ar: `${SITE}/ar/`,
        chart: selectedChart,
        platform_bias: { telegram: 12, x: 10, 'x-thread': -12, facebook: -20, instagram: -15, linkedin: -10 },
      });
    }
  }

  if (selectedChart) {
    candidates.push({
      id: `chart-${selectedChart.id}-${charts.run_date || TODAY}`,
      kind: 'chart',
      verified: true,
      score: Math.min(92, 65 + Math.round((selectedChart.score || 0) / 4)),
      urgency: 'routine',
      source_artifact: SOURCES.charts,
      evidence: [SOURCES.charts, ...(selectedChart.evidence || [])],
      title_en: selectedChart.title_en,
      title_ar: selectedChart.title_ar,
      hook_en: selectedChart.reading_en,
      hook_ar: selectedChart.reading_ar,
      body_en: [selectedChart.reading_en],
      body_ar: [selectedChart.reading_ar],
      symbols: relatedSymbols(selectedChart.symbols),
      url_en: `${SITE}/market-outlook/`,
      url_ar: `${SITE}/ar/market-outlook/`,
      chart: selectedChart,
      platform_bias: { telegram: -5, x: 12, 'x-thread': -10, facebook: -10, instagram: 18, linkedin: 0 },
    });
  }

  const latestOutlook = (Array.isArray(outlooks) ? outlooks : [])
    .find((item) => eligibleDate(item.date, 14) && item.title_en && item.title_ar);
  if (latestOutlook) {
    candidates.push({
      id: `outlook-${latestOutlook.slug}`,
      kind: 'outlook',
      verified: true,
      score: 70,
      urgency: 'routine',
      source_artifact: SOURCES.outlooks,
      evidence: [SOURCES.outlooks, `market-outlook:${latestOutlook.slug}`],
      title_en: latestOutlook.title_en,
      title_ar: latestOutlook.title_ar,
      hook_en: latestOutlook.summary_en,
      hook_ar: latestOutlook.summary_ar,
      body_en: [latestOutlook.summary_en],
      body_ar: [latestOutlook.summary_ar],
      symbols: relatedSymbols(latestOutlook.macro_tags),
      url_en: `${SITE}${latestOutlook.url_en}`,
      url_ar: `${SITE}${latestOutlook.url_ar}`,
      platform_bias: { telegram: 0, x: 4, 'x-thread': -5, facebook: 3, instagram: -15, linkedin: 10 },
    });
  }

  const latestArticle = (Array.isArray(articles) ? articles : [])
    .find((item) => eligibleDate(item.date, 14) && item.title_en && item.title_ar);
  if (latestArticle) {
    candidates.push({
      id: `article-${latestArticle.slug}`,
      kind: 'article',
      verified: true,
      score: 64,
      urgency: 'low',
      source_artifact: SOURCES.articles,
      evidence: [SOURCES.articles, `article:${latestArticle.slug}`],
      title_en: latestArticle.title_en,
      title_ar: latestArticle.title_ar,
      hook_en: latestArticle.summary_en,
      hook_ar: latestArticle.summary_ar,
      body_en: [latestArticle.summary_en],
      body_ar: [latestArticle.summary_ar],
      symbols: relatedSymbols(latestArticle.title_en, latestArticle.summary_en),
      url_en: `${SITE}${latestArticle.url_en}`,
      url_ar: `${SITE}${latestArticle.url_ar}`,
      platform_bias: { telegram: -12, x: -6, 'x-thread': -20, facebook: 10, instagram: -15, linkedin: 10 },
    });
  }

  const topStory = newsroom?.modules?.top_market_story;
  if (topStory && fresh(newsroom) && topStory.verified === true) {
    candidates.push({
      id: `newsroom-${hash(topStory)}`,
      kind: 'session',
      verified: true,
      score: 72,
      urgency: topStory.urgency || 'elevated',
      source_artifact: SOURCES.newsroom,
      evidence: [SOURCES.newsroom],
      title_en: localized(topStory.title, 'en', 'Newsroom lead'),
      title_ar: localized(topStory.title, 'ar', 'صدارة غرفة الأخبار'),
      hook_en: localized(topStory, 'en'),
      hook_ar: localized(topStory, 'ar'),
      body_en: [localized(topStory, 'en')],
      body_ar: [localized(topStory, 'ar')],
      symbols: relatedSymbols(topStory),
      url_en: `${SITE}/`,
      url_ar: `${SITE}/ar/`,
      platform_bias: { telegram: 8, x: 8, 'x-thread': -5, facebook: 0, instagram: -10, linkedin: 0 },
    });
  }

  return candidates.filter((candidate) => candidate.verified && candidate.hook_en && candidate.hook_ar);
}

function platformScore(candidate, platform) {
  return Math.max(0, Math.min(100, candidate.score + (candidate.platform_bias?.[platform] || 0)));
}

function chooseDistribution(candidates) {
  const choices = [];
  const storyUsage = new Map();
  for (const platform of PLATFORM_ORDER) {
    const contract = PLATFORM_CONTRACTS[platform];
    const ranked = candidates
      .map((candidate) => ({ candidate, relevance: platformScore(candidate, platform) }))
      .filter((entry) => entry.relevance >= contract.threshold)
      .sort((a, b) => b.relevance - a.relevance || b.candidate.score - a.candidate.score);
    const selected = ranked.find((entry) => (storyUsage.get(entry.candidate.id) || 0) < 3);
    if (selected) {
      choices.push({ platform, ...selected });
      storyUsage.set(selected.candidate.id, (storyUsage.get(selected.candidate.id) || 0) + 1);
    }
  }
  return choices;
}

function composeText(candidate, platform, language) {
  const ar = language === 'ar';
  const title = ar ? candidate.title_ar : candidate.title_en;
  const hook = ar ? candidate.hook_ar : candidate.hook_en;
  const bodyParts = ar ? candidate.body_ar : candidate.body_en;
  const catalystStyle = candidate.kind === 'session';
  const symbols = candidate.symbols || [];

  if (platform === 'telegram') {
    return {
      title: clip(title, 120),
      hook: clip(hook, 190),
      body: [
        clip(hook, 360),
        ...bodyParts.slice(1, 3).map((part) => `• ${clip(part, 260)}`),
        symbols.length ? `${ar ? 'تحت المجهر' : 'In focus'}: ${symbols.join(' · ')}` : null,
      ].filter(Boolean).join('\n'),
    };
  }
  if (platform === 'x') {
    const suffix = symbols.slice(0, 3).map((symbol) => `$${symbol}`).join(' ');
    return { title: clip(title, 90), hook: clip(hook, 180), body: clip(`${hook}${suffix ? `\n${suffix}` : ''}`, PLATFORM_CONTRACTS.x.limit) };
  }
  if (platform === 'x-thread') {
    const thread = unique([hook, ...bodyParts]).slice(0, 4).map((part) => clip(part, PLATFORM_CONTRACTS['x-thread'].limit));
    return { title: clip(title, 90), hook: thread[0], body: thread[0], thread };
  }
  if (platform === 'facebook') {
    return {
      title: clip(title, 140),
      hook: clip(hook, 220),
      body: unique([hook, ...bodyParts, catalystStyle ? (ar ? 'ما يهم الآن هو ما إذا كانت العلاقات بين الأصول تؤكد هذا السياق.' : 'What matters now is whether cross-asset relationships continue to confirm this context.') : null]).join('\n\n'),
    };
  }
  if (platform === 'instagram') {
    const slides = [
      { slide: 1, role: 'hook', text: clip(hook, 120) },
      ...bodyParts.slice(1, 3).map((part, index) => ({ slide: index + 2, role: 'context', text: clip(part, 135) })),
      ...(symbols.length ? [{ slide: 4, role: 'assets', text: `${ar ? 'تحت المجهر' : 'In focus'}: ${symbols.slice(0, 5).join(' · ')}` }] : []),
      { slide: 5, role: 'footer', text: DISCLAIMER[language] },
    ];
    return { title: clip(title, 100), hook: clip(hook, 140), body: unique([hook, ...bodyParts.slice(1, 3)]).join('\n\n'), carousel: slides };
  }
  return {
    title: clip(title, 150),
    hook: clip(hook, 220),
    body: [
      ar ? `قراءة مؤسسية في السوق — ${TODAY}` : `Institutional market note — ${TODAY}`,
      hook,
      ...bodyParts.slice(1, 3),
      ar ? 'الدلالة الأساسية ليست في حركة أصل منفرد، بل في درجة اتساق العلاقات بين الأصول.' : 'The relevant signal is not a single asset move, but the degree of confirmation across the market structure.',
    ].filter(Boolean).join('\n\n'),
  };
}

function buildPreview(choice, language, previous) {
  const { platform, candidate, relevance } = choice;
  const contract = PLATFORM_CONTRACTS[platform];
  const text = composeText(candidate, platform, language);
  const url = language === 'ar' ? candidate.url_ar : candidate.url_en;
  const sourceHash = hash({ source: candidate.source_artifact, evidence: candidate.evidence, id: candidate.id });
  const contentHash = hash({ platform, language, title: text.title, hook: text.hook, body: text.body, thread: text.thread });
  const dedupeHash = hash({ platform, language, sourceHash, contentHash });
  const previousPreviews = previous?.previews || [];
  const priorPlatform = previous.version === '2.0'
    ? previousPreviews.filter((item) => item.platform === platform && item.language === language)
    : [];
  const duplicate = previousPreviews.some((item) => item.dedupe_hash === dedupeHash);
  const repeatedHook = previousPreviews.some((item) => item.platform === platform && item.language === language && hash(item.hook) === hash(text.hook));
  const repeatedHeadline = previousPreviews.some((item) => item.platform === platform && item.language === language && hash(item.title) === hash(text.title));
  const sameSource = previousPreviews.some((item) => item.platform === platform && item.language === language && item.source_hash === sourceHash);
  const overlap = priorPlatform.some((item) => narrativeOverlap(`${item.title} ${item.hook}`, `${text.title} ${text.hook}`) >= 0.72);
  const cooldown = priorPlatform.some((item) => {
    const elapsed = (NOW.getTime() - Date.parse(item.generated_at)) / 3600000;
    return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < contract.cooldown_hours;
  });
  const suppressionReasons = [];
  if (duplicate) suppressionReasons.push('duplicate_content');
  if (!duplicate && repeatedHook) suppressionReasons.push('repeated_hook');
  if (!duplicate && repeatedHeadline) suppressionReasons.push('repeated_headline');
  if (!duplicate && sameSource) suppressionReasons.push('duplicate_source');
  if (!duplicate && overlap) suppressionReasons.push('narrative_overlap');
  if (!duplicate && cooldown) suppressionReasons.push('platform_cooldown');

  return {
    platform,
    language,
    source_artifact: candidate.source_artifact,
    source_story_id: candidate.id,
    generated_at: NOW.toISOString(),
    title: text.title,
    hook: text.hook,
    body: clip(text.body, contract.limit),
    cta: `${language === 'ar' ? 'اقرأ السياق الكامل' : 'Read the full context'}: ${url}`,
    evidence_references: unique(candidate.evidence),
    related_symbols: candidate.symbols,
    hashtags: HASHTAGS[language].slice(0, contract.hashtag_cap),
    no_advice: true,
    dedupe_hash: dedupeHash,
    source_hash: sourceHash,
    content_hash: contentHash,
    visual_recommendation: visualRecommendation(candidate.kind, candidate.chart, language),
    urgency_level: candidate.urgency,
    distribution_relevance_score: relevance,
    distribution_status: suppressionReasons.length ? 'suppressed' : 'preview_ready',
    suppression_reasons: suppressionReasons,
    approval_required: true,
    auto_post_allowed: false,
    cooldown_hours: contract.cooldown_hours,
    ...(text.thread ? { thread: text.thread } : {}),
    ...(text.carousel ? { carousel_outline: text.carousel } : {}),
    disclaimer: DISCLAIMER[language],
  };
}

function buildSocialIntelligence() {
  const inputs = Object.fromEntries(Object.entries(SOURCES).map(([key, rel]) => [key, readJson(rel)]));
  const previous = readJson('data/social/social-preview.json', { previews: [] });
  const candidates = buildCandidates(inputs);
  const choices = chooseDistribution(candidates);
  const previews = choices.flatMap((choice) => [
    buildPreview(choice, 'en', previous),
    buildPreview(choice, 'ar', previous),
  ]);
  const ready = previews.filter((preview) => preview.distribution_status === 'preview_ready');

  return {
    version: '2.0',
    updated_at: NOW.toISOString(),
    run_date: TODAY,
    mode: 'preview_only',
    verified: candidates.length > 0,
    posting_enabled: false,
    credentials_required: false,
    source_artifacts: SOURCES,
    platform_contracts: PLATFORM_CONTRACTS,
    distribution_policy: {
      max_story_per_platform_per_run: 1,
      bilingual_pair_required: true,
      quiet_state_may_select_none: true,
      stale_sources_suppressed: true,
      duplicate_sources_suppressed: true,
      narrative_overlap_threshold: 0.72,
      max_platforms_per_story: 3,
      approval_required: true,
    },
    candidates_considered: candidates.map((candidate) => ({
      id: candidate.id, kind: candidate.kind, score: candidate.score, urgency: candidate.urgency,
      source_artifact: candidate.source_artifact,
    })),
    previews,
    approval_queue: ready.map((preview) => ({
      dedupe_hash: preview.dedupe_hash,
      platform: preview.platform,
      language: preview.language,
      status: 'awaiting_review',
    })),
    future_distribution: {
      adapters: PLATFORM_ORDER.map((platform) => ({ platform, status: 'disabled', interface: 'preview-provider-adapter-v1' })),
      posting_ledger: 'data/social/posting-ledger.json',
      retry_policy: { enabled: false, max_attempts: 3, backoff: 'exponential', activation_requires_adapter: true },
      credential_injection: 'future environment-only provider configuration; no credentials read in preview mode',
      approval_path: 'preview_ready -> approved -> adapter_send -> ledger_record',
    },
    silence_reason: previews.length ? null : 'No verified candidate cleared a platform relevance threshold.',
  };
}

function writeArtifacts(master) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'social-preview.json'), `${JSON.stringify(master, null, 2)}\n`, 'utf8');
  const filePlatforms = ['telegram', 'x', 'instagram', 'facebook', 'linkedin'];
  for (const platform of filePlatforms) {
    const previews = master.previews.filter((item) => item.platform === platform || (platform === 'x' && item.platform === 'x-thread'));
    const artifact = {
      version: master.version,
      updated_at: master.updated_at,
      mode: master.mode,
      posting_enabled: false,
      previews,
    };
    fs.writeFileSync(path.join(OUT_DIR, `latest-${platform}-preview.json`), `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  }
  const ledgerPath = path.join(OUT_DIR, 'posting-ledger.json');
  if (!fs.existsSync(ledgerPath)) {
    fs.writeFileSync(ledgerPath, `${JSON.stringify({
      version: '1.0',
      posting_enabled: false,
      records: [],
      note: 'Foundation only. No social provider adapter is active.',
    }, null, 2)}\n`, 'utf8');
  }
}

function main() {
  const master = buildSocialIntelligence();
  const ready = master.previews.filter((item) => item.distribution_status === 'preview_ready').length;
  console.log(`[social-intelligence] candidates=${master.candidates_considered.length} previews=${master.previews.length} ready=${ready}`);
  if (process.argv.includes('--write')) {
    writeArtifacts(master);
    console.log('[social-intelligence] wrote master + Telegram/X/Instagram/Facebook/LinkedIn preview artifacts');
  }
}

if (require.main === module) main();

module.exports = {
  buildSocialIntelligence,
  buildCandidates,
  chooseDistribution,
  PLATFORM_CONTRACTS,
  SOURCES,
};
