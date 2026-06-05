'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MINIMUMS = {
  editorial: 85,
  'market-outlook': 92,
  'news-analysis': 95
};

const VALID_CONTENT_TYPES = new Set(Object.keys(MINIMUMS));

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _parse_error: error.message };
  }
}

function normalizeContentType(value) {
  const raw = String(value || 'editorial').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'market_outlook') return 'market-outlook';
  if (raw === 'news') return 'news-analysis';
  return raw;
}

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function words(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9-]*/g) || [];
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function hasRealSources(topic) {
  const sources = Array.isArray(topic.sources) ? topic.sources : [];
  return sources.some((source) => {
    if (typeof source === 'string') return /^https?:\/\//i.test(source);
    return source && /^https?:\/\//i.test(source.url || source.source_url || '');
  });
}

function getQueue(contentType) {
  if (contentType === 'editorial') {
    return readJson(path.join(ROOT, 'data', 'editorial-topic-queue.json'), { topics: [] });
  }
  if (contentType === 'market-outlook') {
    return readJson(path.join(ROOT, 'data', 'market-outlook-queue.json'), { topics: [] });
  }
  return readJson(path.join(ROOT, 'data', 'news-analysis-queue.json'), { topics: [] });
}

function getPublishedSlugs(contentType) {
  const files = contentType === 'market-outlook'
    ? ['data/market-outlook-history.json', 'data/market-outlook-published.json']
    : ['data/published-history.json'];
  const slugs = new Set();

  for (const file of files) {
    const data = readJson(path.join(ROOT, file), {});
    for (const item of data.publications || data.articles || []) {
      if (item.slug) slugs.add(item.slug);
    }
  }

  return slugs;
}

function getContentUniverse() {
  const files = [
    'data/editorial-topic-queue.json',
    'data/market-outlook-queue.json',
    'data/news-analysis-queue.json',
    'data/published-history.json',
    'data/market-outlook-history.json'
  ];
  const slugs = new Set();
  const titles = [];
  for (const file of files) {
    const data = readJson(path.join(ROOT, file), {});
    for (const item of data.topics || data.publications || data.articles || []) {
      if (item.slug) slugs.add(item.slug);
      if (item.title_en || item.title) titles.push(String(item.title_en || item.title).toLowerCase());
    }
  }
  return { slugs, titles };
}

function scoreTopic(topic, contentType, context = {}) {
  const type = normalizeContentType(contentType);
  if (!VALID_CONTENT_TYPES.has(type)) throw new Error(`Unsupported content type: ${contentType}`);

  const title = topic.title_en || topic.title || topic.slug || '';
  const text = [
    title,
    topic.summary_en,
    topic.description_en,
    topic.category,
    ...(topic.tags || []),
    ...(topic.macro_tags || []),
    ...(topic.regime_tags || []),
    ...(topic.related_etfs || []),
    ...(topic.related_stocks || [])
  ].join(' ');
  const tokenSet = new Set(words(text));
  const universe = context.universe || getContentUniverse();
  const publishedSlugs = context.publishedSlugs || getPublishedSlugs(type);
  const sourceBacked = hasRealSources(topic);

  const isDuplicateSlug = Boolean(topic.slug && publishedSlugs.has(topic.slug));
  const isDuplicateTitle = title && universe.titles.filter((existing) => existing === title.toLowerCase()).length > 1;
  const specificTerms = [
    'yield', 'curve', 'duration', 'breadth', 'participation', 'liquidity',
    'volatility', 'regime', 'sector', 'rotation', 'earnings', 'etf',
    'semiconductor', 'ai', 'small-cap', 'risk', 'defensive'
  ];
  const specificityHits = specificTerms.filter((term) => text.toLowerCase().includes(term));
  const forbidden = [
    'buy now',
    'sell now',
    'guaranteed',
    'risk-free',
    'price target',
    'will soar',
    'sure thing'
  ].filter((term) => text.toLowerCase().includes(term));

  const relatedAssets = [
    ...(topic.related_etfs || []),
    ...(topic.related_stocks || []),
    ...(topic.related_assets || [])
  ].filter(Boolean);

  const base = {
    freshness: topic.status === 'planned' || topic.status === 'draft' || topic.status === 'queued' ? 90 : 70,
    specificity: Math.min(100, 50 + specificityHits.length * 8 + (title.length > 35 ? 10 : 0)),
    seo_value: Math.min(100, 55 + (topic.discovery_cluster ? 12 : 0) + (topic.category ? 8 : 0) + Math.min(20, tokenSet.size)),
    institutional_relevance: Math.min(100, 45 + specificityHits.length * 7 + (topic.topic_cluster ? 10 : 0)),
    source_support: type === 'news-analysis' ? (sourceBacked ? 100 : 0) : (sourceBacked ? 85 : 70),
    internal_linking_value: Math.min(100, 50 + relatedAssets.length * 8 + (topic.related_hubs || []).length * 6 + (topic.related_comparisons || []).length * 6),
    non_duplication: isDuplicateSlug || isDuplicateTitle ? 0 : 100,
    content_gap_value: Math.min(100, 60 + (topic.priority ? Math.max(0, 20 - Number(topic.priority) * 2) : 10)),
    user_value: Math.min(100, 55 + specificityHits.length * 6 + (topic.summary_en || topic.description_en ? 10 : 0)),
    safety: forbidden.length ? 0 : 100
  };

  const profiles = {
    editorial: {
      freshness: 0.10,
      specificity: 0.10,
      seo_value: 0.16,
      institutional_relevance: 0.08,
      source_support: 0.04,
      internal_linking_value: 0.14,
      non_duplication: 0.12,
      content_gap_value: 0.08,
      user_value: 0.08,
      safety: 0.10
    },
    'market-outlook': {
      freshness: 0.10,
      specificity: 0.14,
      seo_value: 0.06,
      institutional_relevance: 0.18,
      source_support: 0.05,
      internal_linking_value: 0.05,
      non_duplication: 0.12,
      content_gap_value: 0.07,
      user_value: 0.08,
      safety: 0.15
    },
    'news-analysis': {
      freshness: 0.09,
      specificity: 0.09,
      seo_value: 0.05,
      institutional_relevance: 0.12,
      source_support: 0.22,
      internal_linking_value: 0.04,
      non_duplication: 0.11,
      content_gap_value: 0.05,
      user_value: 0.06,
      safety: 0.17
    }
  };

  let weighted = 0;
  for (const [key, weight] of Object.entries(profiles[type])) weighted += base[key] * weight;
  if (type === 'news-analysis' && !sourceBacked) weighted = Math.min(weighted, 60);
  if (forbidden.length) weighted = Math.min(weighted, 40);
  if (isDuplicateSlug || isDuplicateTitle) weighted = Math.min(weighted, 55);

  const score = clamp(weighted);
  const minimum = MINIMUMS[type];
  const passed = score >= minimum && base.safety === 100 && base.non_duplication === 100 && (type !== 'news-analysis' || sourceBacked);

  return {
    slug: topic.slug || null,
    title,
    content_type: type,
    score,
    minimum,
    passed,
    source_backed: sourceBacked,
    components: base,
    specificity_hits: specificityHits,
    rejection_reasons: [
      ...(score < minimum ? [`score_below_${minimum}`] : []),
      ...(base.safety !== 100 ? ['unsafe_promotional_or_advice_language'] : []),
      ...(base.non_duplication !== 100 ? ['duplicate_or_already_published'] : []),
      ...(type === 'news-analysis' && !sourceBacked ? ['missing_required_news_sources'] : [])
    ]
  };
}

function scoreCandidates(contentType, candidates = null) {
  const type = normalizeContentType(contentType);
  const queue = candidates ? { topics: candidates } : getQueue(type);
  const universe = getContentUniverse();
  const publishedSlugs = getPublishedSlugs(type);
  const results = (queue.topics || []).map((topic) => scoreTopic(topic, type, { universe, publishedSlugs }));
  results.sort((a, b) => b.score - a.score);
  return {
    content_type: type,
    minimum: MINIMUMS[type],
    candidate_count: results.length,
    eligible_count: results.filter((item) => item.passed).length,
    best: results.find((item) => item.passed) || results[0] || null,
    results
  };
}

function main() {
  const contentType = normalizeContentType(argValue('--content-type', argValue('--type', 'editorial')));
  const slug = argValue('--slug', '');
  if (!VALID_CONTENT_TYPES.has(contentType)) {
    console.error(`Unsupported --content-type. Expected one of: ${Array.from(VALID_CONTENT_TYPES).join(', ')}`);
    process.exit(1);
  }
  const report = scoreCandidates(contentType);
  if (slug) {
    report.results = report.results.filter((item) => item.slug === slug);
    report.best = report.results[0] || null;
    report.candidate_count = report.results.length;
    report.eligible_count = report.results.filter((item) => item.passed).length;
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.best && report.best.passed) process.exit(0);
  process.exit(contentType === 'news-analysis' ? 0 : 0);
}

if (require.main === module) main();

module.exports = {
  MINIMUMS,
  normalizeContentType,
  scoreTopic,
  scoreCandidates,
  hasRealSources
};
