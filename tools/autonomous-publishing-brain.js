'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { scoreCandidates, scoreTopic, hasRealSources } = require('./score-autonomous-topic');
const { reviewDraft, hasDraft, TOPOLOGY_REPAIRABLE_CHECKS, PROFILES } = require('./autonomous-review-engine');
const { CLUSTER_DEFINITIONS } = require('./analyze-content-clusters');
const { runRepairCycle } = require('./run-authority-repair-cycle');
const { printFinalDecision, writePublishingReport } = require('./generate-publishing-report');

// Cache overwrite flags per content type so we know if we need to force-clear drafts
const PROFILES_OVERWRITE = Object.fromEntries(
  Object.entries(PROFILES).map(([k, v]) => [k, Boolean(v.overwrite)])
);

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);
const VALID_MODES = new Set(['status', 'dry_run', 'generate_only', 'publish_ready', 'full_pipeline']);
const VALID_TYPES = new Set(['auto', 'editorial', 'market-outlook', 'news-analysis', 'all']);
const DRAFT_STATUSES = new Set(['draft', 'planned', 'queued', 'in_review', 'pending', 'generated']);
// NOTE: 'reviewed' intentionally excluded — reviewed/approved topics surface via
// isPublishable()/isApprovedAnyDate() and adding it shifts editorial draft_candidate.
const INSTITUTIONAL_REPAIR_CHECKS = new Set([
  'editorial_word_count',
  'editorial_average_paragraph_depth',
  'editorial_semantic_depth',
  'editorial_narrative_continuity',
  'editorial_analytical_density',
  'editorial_comparison_coverage',
  'editorial_sentence_opening_diversity',
  'editorial_lexical_richness',
  'score_below_90'
]);

function readJson(filePath, fallback = {}) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    return { ...fallback, _parse_error: error.message };
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function argValue(...names) {
  for (const name of names) {
    const prefix = `${name}=`;
    const found = process.argv.find((arg) => arg.startsWith(prefix));
    if (found) return found.slice(prefix.length);
  }
  return '';
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeType(value) {
  const raw = String(value || 'auto').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'market_outlook') return 'market-outlook';
  if (raw === 'news') return 'news-analysis';
  return raw;
}

function normalizeMode(value) {
  return String(value || 'status').trim().toLowerCase().replace(/-/g, '_');
}

function toBool(value, fallback = false) {
  if (value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function daysSince(dateLike) {
  if (!dateLike) return null;
  const date = new Date(String(dateLike).slice(0, 10) + 'T00:00:00Z');
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date(TODAY + 'T00:00:00Z');
  return Math.max(0, Math.floor((now - date) / 86400000));
}

function addDays(dateLike, days) {
  const date = new Date(String(dateLike || TODAY).slice(0, 10) + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function queuePathFor(contentType) {
  if (contentType === 'market-outlook') return path.join(ROOT, 'data', 'market-outlook-queue.json');
  if (contentType === 'editorial')      return path.join(ROOT, 'data', 'editorial-topic-queue.json');
  return path.join(ROOT, 'data', 'news-analysis-queue.json');
}

function isQueueApproved(contentType, slug) {
  const q = readJson(queuePathFor(contentType), { topics: [] });
  const t = (q.topics || []).find((item) => item.slug === slug);
  return Boolean(t && t.status === 'reviewed' && t.review_status === 'approved');
}

function promoteQueueTopic(contentType, slug, reason) {
  const qPath = queuePathFor(contentType);
  try {
    const q = readJson(qPath, { topics: [] });
    const t = (q.topics || []).find((item) => item.slug === slug);
    if (!t || t.status === 'published') return;
    const prevState = `${t.status}/${t.review_status || 'none'}`;
    t.status = 'reviewed';
    t.review_status = 'approved';
    t.last_reviewed = TODAY;
    q.updated = TODAY;
    writeJson(qPath, q);
    console.log(`[MARKET OUTLOOK PROMOTION] topic=${slug} previous_state=${prevState} next_state=reviewed/approved promotion_reason=${reason}`);
  } catch { /* best-effort */ }
}

function countByStatus(topics) {
  const counts = {};
  for (const topic of topics) counts[topic.status || 'unknown'] = (counts[topic.status || 'unknown'] || 0) + 1;
  return counts;
}

function latestPublication(historyPath, alternatePath = null) {
  const primary = readJson(path.join(ROOT, historyPath), { publications: [] });
  const alternate = alternatePath ? readJson(path.join(ROOT, alternatePath), { articles: [] }) : {};
  const entries = [...(primary.publications || []), ...(alternate.articles || [])]
    .filter((item) => item.publish_date || item.published_at)
    .sort((a, b) => String(b.publish_date || b.published_at).localeCompare(String(a.publish_date || a.published_at)));
  return entries[0] || null;
}

function publishedSlugs(historyPath, publicDir, alternatePath = null) {
  const slugs = new Set();
  const history = readJson(path.join(ROOT, historyPath), { publications: [] });
  const alternate = alternatePath ? readJson(path.join(ROOT, alternatePath), { articles: [] }) : {};
  for (const item of [...(history.publications || []), ...(alternate.articles || [])]) {
    if (item.slug) slugs.add(item.slug);
  }
  const dir = path.join(ROOT, publicDir);
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.html')) slugs.add(file.replace(/\.html$/, ''));
    }
  }
  return slugs;
}

function isPublishable(topic, slugs) {
  return Boolean(
    topic &&
    topic.status === 'reviewed' &&
    topic.review_status === 'approved' &&
    (!topic.target_publish_date || topic.target_publish_date <= TODAY) &&
    !slugs.has(topic.slug)
  );
}

function isApprovedAnyDate(topic, slugs) {
  return Boolean(topic && topic.status === 'reviewed' && topic.review_status === 'approved' && !slugs.has(topic.slug));
}

function inspectEditorial() {
  const queue = readJson(path.join(ROOT, 'data', 'editorial-topic-queue.json'), { topics: [] });
  const topics = queue.topics || [];
  const slugs = publishedSlugs('data/published-history.json', 'insights');
  const latest = latestPublication('data/published-history.json');
  const draftCandidate = topics.find((topic) => DRAFT_STATUSES.has(topic.status) && !slugs.has(topic.slug));
  const publishable = topics.find((topic) => isPublishable(topic, slugs));
  const approvedFuture = topics.find((topic) => isApprovedAnyDate(topic, slugs));
  const score = scoreCandidates('editorial', topics.filter((topic) => topic.status !== 'published'));
  return {
    content_type: 'editorial',
    queue_path: 'data/editorial-topic-queue.json',
    total: topics.length,
    statuses: countByStatus(topics),
    draft_candidate: draftCandidate ? draftCandidate.slug : null,
    publishable_slug: publishable ? publishable.slug : null,
    approved_waiting_slug: approvedFuture ? approvedFuture.slug : null,
    last_published: latest ? latest.slug : null,
    last_publish_date: latest ? latest.publish_date : null,
    days_since_publish: latest ? daysSince(latest.publish_date) : null,
    freshness_state: latest ? `${daysSince(latest.publish_date)} days since last editorial publish` : 'no editorial publication history',
    topic_score: score.best,
    cooldown_blocked: latest ? daysSince(latest.publish_date) < 1 : false,
    next_eligible: publishable ? publishable.slug : (draftCandidate ? draftCandidate.slug : null)
  };
}

function inspectMarketOutlook() {
  const queue = readJson(path.join(ROOT, 'data', 'market-outlook-queue.json'), { topics: [] });
  const topics = queue.topics || [];
  const slugs = publishedSlugs('data/market-outlook-history.json', 'market-outlook', 'data/market-outlook-published.json');
  const latest = latestPublication('data/market-outlook-history.json', 'data/market-outlook-published.json');
  const draftCandidate = topics.find((topic) => DRAFT_STATUSES.has(topic.status) && !slugs.has(topic.slug));
  const publishable = topics.find((topic) => isPublishable(topic, slugs));
  const approvedFuture = topics.find((topic) => isApprovedAnyDate(topic, slugs));
  const score = scoreCandidates('market-outlook', topics.filter((topic) => topic.status !== 'published'));
  return {
    content_type: 'market-outlook',
    queue_path: 'data/market-outlook-queue.json',
    total: topics.length,
    statuses: countByStatus(topics),
    draft_candidate: draftCandidate ? draftCandidate.slug : null,
    publishable_slug: publishable ? publishable.slug : null,
    approved_waiting_slug: approvedFuture ? approvedFuture.slug : null,
    last_published: latest ? latest.slug : null,
    last_publish_date: latest ? latest.publish_date : null,
    days_since_publish: latest ? daysSince(latest.publish_date) : null,
    freshness_state: latest ? `${daysSince(latest.publish_date)} days since last market outlook publish` : 'no market outlook publication history',
    topic_score: score.best,
    cooldown_blocked: latest ? daysSince(latest.publish_date) < 1 : false,
    next_eligible: publishable ? publishable.slug : (draftCandidate ? draftCandidate.slug : null)
  };
}

function inspectNewsAnalysis() {
  const queue = readJson(path.join(ROOT, 'data', 'news-analysis-queue.json'), { topics: [] });
  const registry = readJson(path.join(ROOT, 'data', 'news-source-registry.json'), { sources: [] });
  const topics = queue.topics || [];
  const sourceBackedTopics = topics.filter(hasRealSources);
  const registrySources = (registry.sources || []).filter((source) => /^https?:\/\//i.test(source.source_url || source.url || ''));
  const draftCandidate = sourceBackedTopics.find((topic) => DRAFT_STATUSES.has(topic.status));
  const score = scoreCandidates('news-analysis', topics);
  return {
    content_type: 'news-analysis',
    queue_path: 'data/news-analysis-queue.json',
    total: topics.length,
    statuses: countByStatus(topics),
    source_backed_topics: sourceBackedTopics.length,
    registered_sources: registrySources.length,
    source_available: sourceBackedTopics.length > 0 || registrySources.length > 0,
    draft_candidate: draftCandidate ? draftCandidate.slug : null,
    publishable_slug: null,
    approved_waiting_slug: null,
    last_published: null,
    last_publish_date: null,
    days_since_publish: null,
    freshness_state: sourceBackedTopics.length ? 'source-backed topic available' : 'no source-backed news topic available',
    topic_score: score.best,
    cooldown_blocked: false,
    next_eligible: draftCandidate ? draftCandidate.slug : null
  };
}

function inspectMarketIntelligence() {
  const liveState = readJson(path.join(ROOT, 'data', 'live-market-state.json'), {});
  const memory = readJson(path.join(ROOT, 'data', 'narrative-memory.json'), { snapshots: [] });
  const graph = readJson(path.join(ROOT, 'data', 'market-intelligence-graph.json'), { nodes: [], edges: [] });
  const signals = readJson(path.join(ROOT, 'data', 'market-signals.json'), { signals: [] });
  const divergences = readJson(path.join(ROOT, 'data', 'cross-asset-divergence.json'), { divergences: [] });
  const sequence = readJson(path.join(ROOT, 'data', 'regime-sequence.json'), {});
  const snapshots = memory.snapshots || memory.entries || [];
  const activeSignals = signals.signals || signals.active_signals || [];
  const activeDivergences = divergences.divergences || divergences.active_divergences || [];
  return {
    live_market_status: (liveState.metadata || {}).status || liveState.status || 'unknown',
    memory_snapshots: snapshots.length,
    latest_memory_date: snapshots.length ? (snapshots[snapshots.length - 1].date || snapshots[snapshots.length - 1].created_at || null) : null,
    graph_nodes: (graph.nodes || []).length,
    graph_edges: (graph.edges || []).length,
    active_signal_count: activeSignals.length,
    active_divergence_count: activeDivergences.length,
    sequence_confidence: sequence.sequence_confidence || sequence.confidence || null,
    state_available: exists('data/live-market-state.json') || exists('data/narrative-memory.json')
  };
}

function inspectClusterHealth() {
  const clustersPath = path.join(ROOT, 'data', 'content-clusters.json');
  const orphanPath   = path.join(ROOT, 'data', 'orphan-pages-report.json');
  const clusters     = readJson(clustersPath, null);
  const orphans      = readJson(orphanPath, null);
  if (!clusters) return { available: false, summary: null, weakest: [], orphan_count: 0 };
  const summary = clusters.summary || {};
  const clusterList = Object.values(clusters.clusters || {});
  const weakClusters = clusterList.filter(c => c.health_grade === 'WEAK').map(c => c.cluster);
  return {
    available:       true,
    summary,
    weakest:         weakClusters.slice(0, 3),
    orphan_count:    orphans ? (orphans.summary || {}).orphan_count || 0 : 0,
    strong_clusters: summary.strong || 0,
    weak_clusters:   summary.weak   || 0,
  };
}

function inspectAuthorityExpansion() {
  const planPath = path.join(ROOT, 'data', 'authority-expansion-plan.json');
  const roadmapPath = path.join(ROOT, 'data', 'content-roadmap.json');
  const topoPath = path.join(ROOT, 'data', 'topology-rebalance-report.json');

  const plan    = readJson(planPath, null);
  const roadmap = readJson(roadmapPath, null);
  const topo    = readJson(topoPath, null);

  if (!plan) return { available: false };

  const plans       = plan.plans || [];
  const criticalPlans = plans.filter(p => p.priority === 'CRITICAL');
  const highPlans     = plans.filter(p => p.priority === 'HIGH');
  const nextActions   = plans.slice(0, 3).map(p => ({
    id:          p.id,
    priority:    p.priority,
    action_type: p.action_type,
    cluster:     p.target_cluster,
    title:       p.title || p.action_type,
  }));

  const roadmapItems      = roadmap ? (roadmap.items || []) : [];
  const immediateItems    = roadmapItems.filter(i => i.window === 'immediate');

  return {
    available:          true,
    topology_grade:     (plan.summary || {}).current_topology_grade || 'D',
    projected_grade:    topo ? topo.projected_grade : null,
    orphan_count:       (plan.summary || {}).current_orphan_count || 0,
    crawl_coverage_pct: (plan.summary || {}).current_crawl_coverage || 0,
    total_plans:        plans.length,
    critical_count:     criticalPlans.length,
    high_count:         highPlans.length,
    next_actions:       nextActions,
    immediate_roadmap:  immediateItems.slice(0, 3).map(i => ({
      id:     i.id,
      type:   i.type,
      title:  i.title || i.action,
      window: i.window,
    })),
  };
}

function buildStatus() {
  return {
    generated_at: new Date().toISOString(),
    today: TODAY,
    editorial: inspectEditorial(),
    market_outlook: inspectMarketOutlook(),
    news_analysis: inspectNewsAnalysis(),
    market_intelligence: inspectMarketIntelligence(),
    cluster_health: inspectClusterHealth(),
    authority_expansion: inspectAuthorityExpansion(),
  };
}

function chooseContentType(status, requestedType, forceContentType) {
  if (requestedType !== 'auto' && requestedType !== 'all') {
    return {
      selected: requestedType,
      reason: forceContentType
        ? `Forced content type requested: ${requestedType}`
        : `Content type requested explicitly: ${requestedType}`
    };
  }

  const candidates = [];
  const editorialScore =
    (status.editorial.publishable_slug ? 50 : 0) +
    (status.editorial.draft_candidate ? 22 : 0) +
    Math.min(20, (status.editorial.days_since_publish == null ? 10 : status.editorial.days_since_publish) * 4) +
    (status.editorial.topic_score && status.editorial.topic_score.passed ? 12 : 0);
  candidates.push({
    type: 'editorial',
    score: editorialScore,
    reason: status.editorial.publishable_slug
      ? 'approved editorial article is ready'
      : 'editorial queue has eligible educational coverage'
  });

  const clusterBonus = status.cluster_health && status.cluster_health.available
    ? Math.min(8, status.cluster_health.weak_clusters * 2)
    : 0;
  const authorityBonus = status.authority_expansion && status.authority_expansion.available
    ? Math.min(6, status.authority_expansion.critical_count)
    : 0;
  const marketScore =
    (status.market_outlook.publishable_slug ? 42 : 0) +
    (status.market_outlook.draft_candidate ? 24 : 0) +
    Math.min(18, (status.market_outlook.days_since_publish == null ? 8 : status.market_outlook.days_since_publish) * 5) +
    Math.min(16, status.market_intelligence.active_signal_count * 4 + status.market_intelligence.active_divergence_count * 4) +
    (status.market_intelligence.state_available ? 8 : 0) +
    clusterBonus +
    authorityBonus;
  candidates.push({
    type: 'market-outlook',
    score: marketScore,
    reason: 'market intelligence state can support an institutional outlook'
  });

  const newsScore = status.news_analysis.source_available
    ? 80 + Math.min(15, status.news_analysis.source_backed_topics * 5 + status.news_analysis.registered_sources * 2)
    : 0;
  candidates.push({
    type: 'news-analysis',
    score: newsScore,
    reason: status.news_analysis.source_available
      ? 'source-backed news input is available'
      : 'news analysis is blocked because no source-backed inputs exist'
  });

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  return {
    selected: selected.type,
    reason: `${selected.reason}; decision_score=${selected.score}`,
    candidate_scores: candidates
  };
}

function actionFor(contentType, status, mode, manualTopic) {
  const section = contentType === 'market-outlook'
    ? status.market_outlook
    : contentType === 'news-analysis'
      ? status.news_analysis
      : status.editorial;

  if (manualTopic) {
    const candidate = {
      slug: manualTopic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title_en: manualTopic,
      status: 'manual_candidate',
      sources: []
    };
    const score = scoreTopic(candidate, contentType);
    return {
      topic: candidate.slug,
      quality_score: score,
      duplicate_cooldown_result: score.passed ? 'passed' : `blocked: ${score.rejection_reasons.join(', ')}`,
      next_action: score.passed ? 'manual topic accepted as candidate; generator integration still requires queue insertion' : 'stop',
      stop_reason: score.passed ? null : 'MANUAL_TOPIC_FAILED_AUTONOMOUS_SCORE'
    };
  }

  if (contentType === 'news-analysis' && !section.source_available) {
    return {
      topic: null,
      quality_score: section.topic_score || null,
      duplicate_cooldown_result: 'blocked: missing source-backed news inputs',
      next_action: 'stop',
      stop_reason: 'NO_SOURCE_BACKED_NEWS_INPUT'
    };
  }

  if (mode === 'publish_ready' && section.publishable_slug) {
    return {
      topic: section.publishable_slug,
      quality_score: section.topic_score || null,
      duplicate_cooldown_result: section.cooldown_blocked ? 'warn: cooldown recently published' : 'passed',
      next_action: 'publish_ready',
      stop_reason: null
    };
  }

  if (mode === 'generate_only') {
    if (!section.draft_candidate) {
      if (contentType === 'editorial' || contentType === 'market-outlook') {
        return {
          topic: null,
          quality_score: section.topic_score || null,
          duplicate_cooldown_result: 'passed: queue needs autonomous topic generation',
          next_action: 'generate_topic_then_draft',
          stop_reason: null
        };
      }
      return {
        topic: null,
        quality_score: section.topic_score || null,
        duplicate_cooldown_result: 'blocked: no draft-eligible topic',
        next_action: 'stop',
        stop_reason: 'NO_DRAFT_ELIGIBLE_TOPIC'
      };
    }
    return {
      topic: section.draft_candidate,
      quality_score: section.topic_score || null,
      duplicate_cooldown_result: section.topic_score && section.topic_score.passed ? 'passed' : 'warn: topic score below autonomous threshold',
      next_action: 'generate_only',
      stop_reason: null
    };
  }

  if (mode === 'full_pipeline') {
    const topic = section.publishable_slug || section.approved_waiting_slug || section.draft_candidate || section.next_eligible;
    if (!topic) {
      if (contentType === 'editorial' || contentType === 'market-outlook') {
        return {
          topic: null,
          quality_score: section.topic_score || null,
          duplicate_cooldown_result: 'passed: queue needs autonomous topic generation',
          next_action: 'generate_topic_then_full_pipeline',
          stop_reason: null
        };
      }
      return {
        topic: null,
        quality_score: section.topic_score || null,
        duplicate_cooldown_result: 'blocked: no eligible topic',
        next_action: 'stop',
        stop_reason: 'NO_ELIGIBLE_TOPIC'
      };
    }
    return {
      topic,
      quality_score: section.topic_score || null,
      duplicate_cooldown_result: section.topic_score && section.topic_score.passed ? 'passed' : 'warn: topic score requires downstream quality gate',
      next_action: 'full_pipeline',
      stop_reason: null
    };
  }

  return {
    topic: section.publishable_slug || section.draft_candidate || section.next_eligible,
    quality_score: section.topic_score || null,
    duplicate_cooldown_result: section.cooldown_blocked ? 'warn: same-day publication cooldown' : 'passed',
    next_action: 'dry_run',
    stop_reason: null
  };
}

function createEditorialTopic() {
  const queuePath = path.join(ROOT, 'data', 'editorial-topic-queue.json');
  const queue = readJson(queuePath, { version: '1.0', topics: [] });
  const existing = new Set((queue.topics || []).map((topic) => topic.slug));
  const templates = [
    {
      title_en: 'Small-Cap ETF Breadth Guide: Participation, Concentration, and Risk',
      category: 'ETF Education',
      tags: ['small-cap ETFs', 'market breadth', 'participation quality'],
      related_etfs: ['IWM', 'VB', 'IJR', 'SPY', 'RSP'],
      related_stocks: ['AAPL', 'MSFT', 'NVDA'],
      related_comparisons: ['spy-vs-rsp', 'spy-vs-vti', 'qqq-vs-iwm'],
      related_hubs: ['small-cap-stocks', 'defensive-etfs']
    },
    {
      title_en: 'Bond ETF Duration Guide: Yield Curve, Rate Risk, and Liquidity',
      category: 'ETF Education',
      tags: ['bond ETFs', 'duration risk', 'yield curve'],
      related_etfs: ['BND', 'IEF', 'TLT', 'SHY', 'AGG'],
      related_stocks: [],
      related_comparisons: ['bnd-vs-ief', 'spy-vs-bnd'],
      related_hubs: ['bond-etfs', 'defensive-etfs']
    },
    {
      title_en: 'AI ETF Concentration Guide: Semiconductor Exposure, Breadth, and Risk',
      category: 'AI and Tech Education',
      tags: ['AI ETFs', 'semiconductor exposure', 'concentration risk'],
      related_etfs: ['QQQ', 'SMH', 'SOXX', 'XLK', 'RSP'],
      related_stocks: ['NVDA', 'AMD', 'AVGO', 'MSFT'],
      related_comparisons: ['qqq-vs-xlq', 'spy-vs-qqq'],
      related_hubs: ['semiconductor-stocks', 'ai-stocks']
    }
  ];
  const selected = templates.find((template) => !existing.has(slugify(template.title_en)));
  if (!selected) return { status: 0, message: 'All autonomous editorial templates already exist.' };

  const topic = {
    slug: slugify(selected.title_en),
    title_en: selected.title_en,
    title_ar: 'Arabic title pending editorial review',
    category: selected.category,
    tags: selected.tags,
    related_stocks: selected.related_stocks,
    related_etfs: selected.related_etfs,
    related_comparisons: selected.related_comparisons,
    related_hubs: selected.related_hubs,
    priority: 4,
    status: 'draft',
    target_publish_date: addDays(TODAY, 7),
    estimated_read_time: 7,
    language_support: ['en', 'ar'],
    evergreen_category: selected.category,
    discovery_cluster: selected.tags[0],
    scheduled_publish_time: '14:00',
    review_status: 'pending',
    editor_notes: 'Autonomous topic candidate generated by the unified publishing brain. Requires normal safety and quality gates.',
    revision_count: 0,
    last_reviewed: null,
    evergreen_refresh_cycle: 180,
    autonomous_topic: true,
    generated_at: new Date().toISOString()
  };
  const score = scoreTopic(topic, 'editorial');
  if (!score.passed) return { status: 1, message: `Autonomous editorial topic failed score: ${score.rejection_reasons.join(', ')}` };

  queue.topics = [...(queue.topics || []), topic];
  queue.updated = TODAY;
  writeJson(queuePath, queue);
  return { status: 0, message: `Seeded autonomous editorial topic: ${topic.slug}`, slug: topic.slug };
}

function seedTopicIfNeeded(contentType) {
  if (contentType === 'market-outlook') {
    const result = runNode('tools/seed-market-outlook-topics.js', [], { inherit: true });
    return {
      status: result.status,
      message: result.status === 0 ? 'Market outlook seeder completed.' : 'Market outlook seeder failed.'
    };
  }
  if (contentType === 'editorial') return createEditorialTopic();
  return { status: 1, message: 'No autonomous topic seeder exists for this content type.' };
}

function runNode(script, args = [], options = {}) {
  const commandArgs = [path.join(ROOT, script), ...args];
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : ['ignore', 'pipe', 'pipe']
  });
  return {
    status: result.status == null ? 1 : result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || ''
  };
}

function runNpm(script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', script], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: 'inherit'
  });
  return result.status == null ? 1 : result.status;
}

function resolveTelegramTarget() {
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim()
    || (process.env.TELEGRAM_CHANNEL_ID || '').trim();
  const source = (process.env.TELEGRAM_CHAT_ID || '').trim() ? 'CHAT_ID' : 'CHANNEL_ID';
  return { chatId: chatId || null, source };
}

function telegramStatus() {
  const { chatId, source } = resolveTelegramTarget();
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) {
    return 'skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID/CHANNEL_ID missing';
  }
  return `configured (target_source=${source} value=${chatId.slice(0, 6)}***)`;
}

function telegramQualityGate(slug) {
  const confidence = readJson(path.join(ROOT, 'data', 'intelligence', 'publication-confidence.json'), {});
  const provider = readJson(path.join(ROOT, 'data', 'provider-health.json'), {});
  const criticallyDegraded = provider.degraded === true &&
    (!Number(provider.event_count) || provider.reason === 'all_providers_unavailable');
  if (confidence.slug !== slug) return { allowed: false, reason: 'publication confidence is missing or stale' };
  if (Number(confidence.confidence || 0) < Number(confidence.confidence_threshold || 90)) {
    return { allowed: false, reason: `publication confidence ${confidence.confidence || 0} is below threshold` };
  }
  if (!confidence.institutional_depth_passed) return { allowed: false, reason: 'institutional depth did not pass' };
  if (criticallyDegraded) return { allowed: false, reason: `macro mode critically degraded: ${provider.reason || 'provider unavailable'}` };
  return { allowed: true, reason: 'publication and intelligence quality gates passed' };
}

function expectedPublicPages(contentType, slug) {
  if (contentType === 'editorial') {
    return [
      `insights/${slug}.html`,
      `ar/insights/${slug}.html`,
      `en/insights/${slug}.html`
    ];
  }
  if (contentType === 'market-outlook') {
    return [
      `market-outlook/${slug}.html`,
      `ar/market-outlook/${slug}.html`,
      `en/market-outlook/${slug}.html`
    ];
  }
  return [];
}

function verifyPublicPromotion(contentType, slug) {
  const expected = expectedPublicPages(contentType, slug);
  const missing = expected.filter((relative) => !fs.existsSync(path.join(ROOT, relative)));
  return { expected, missing, ok: expected.length > 0 && missing.length === 0 };
}

function executeAction(contentType, mode, dryRun, action) {
  if (mode === 'status' || mode === 'dry_run' || dryRun) {
    const reviewPreview = mode === 'full_pipeline' && action.topic && hasDraft(contentType, action.topic)
      ? reviewDraft({ contentType, slug: action.topic, dryRun: true, allowRegeneration: true })
      : null;
    return {
      generation_result: 'not executed in dry run/status mode',
      publish_result: reviewPreview && !reviewPreview.approved
        ? `dry-run blocked: ${reviewPreview.recommended_action}`
        : 'not executed in dry run/status mode',
      telegram_result: telegramStatus(),
      command_status: 0,
      current_state: reviewPreview ? reviewPreview.current_state : (action.topic ? inferState(contentType, action.topic) : 'none'),
      transition_path: reviewPreview ? reviewPreview.transition_path : (action.topic ? dryRunTransitionPreview(contentType, action.topic, action.next_action) : []),
      regeneration_attempts: reviewPreview ? reviewPreview.regeneration_attempts : 0,
      review_result: reviewPreview ? (reviewPreview.approved ? 'passed (dry run)' : `failed (dry run): ${reviewPreview.failed_checks.join(', ')}`) : 'not executed in dry run/status mode',
      approval_reason: reviewPreview ? reviewPreview.approval_reason : 'dry run only',
      publish_gate_result: reviewPreview ? reviewPreview.publish_gate_result : 'not evaluated'
    };
  }

  if (action.stop_reason) {
    return {
      generation_result: 'skipped',
      publish_result: `blocked: ${action.stop_reason}`,
      telegram_result: telegramStatus(),
      command_status: 0,
      current_state: 'blocked',
      transition_path: ['blocked'],
      regeneration_attempts: 0,
      review_result: 'skipped',
      approval_reason: '',
      publish_gate_result: `blocked: ${action.stop_reason}`
    };
  }

  if (contentType === 'market-outlook') {
    let effectiveAction = action;

    if (action.next_action === 'generate_topic_then_draft' || action.next_action === 'generate_topic_then_full_pipeline') {
      const seeded = seedTopicIfNeeded(contentType);
      if (seeded.status !== 0) {
        return {
          generation_result: seeded.message,
          publish_result: 'blocked: topic generation failed',
          telegram_result: telegramStatus(),
          command_status: seeded.status
        };
      }
      // Re-read queue to pick up the newly seeded slug (action.topic was null at plan time)
      if (!effectiveAction.topic) {
        const freshStatus = inspectMarketOutlook();
        const freshSlug = freshStatus.publishable_slug || freshStatus.approved_waiting_slug || freshStatus.draft_candidate || freshStatus.next_eligible;
        if (freshSlug) {
          console.log(`[MARKET OUTLOOK PROMOTION] topic=${freshSlug} previous_state=none next_state=planned promotion_reason=newly_seeded_topic_picked_up`);
          effectiveAction = { ...effectiveAction, topic: freshSlug };
        }
      }
      if (!effectiveAction.topic) {
        throw new Error('[brain] market outlook topic missing after seeding — cannot proceed with pipeline');
      }
    }

    if (mode === 'full_pipeline') {
      return executeReviewedPipeline(contentType, effectiveAction, () => runNode('tools/generate-market-outlook-draft.js', effectiveAction.topic ? [`--slug=${effectiveAction.topic}`] : [], { inherit: true }), () => {
        const args = ['--execute', '--require-publishable', '--force-date'];
        if (effectiveAction.topic) args.push(`--slug=${effectiveAction.topic}`);
        return runNode('tools/publish-market-outlook.js', args, { inherit: true });
      });
    }
    if (mode === 'generate_only') {
      const result = runNode('tools/generate-market-outlook-draft.js', effectiveAction.topic ? [`--slug=${effectiveAction.topic}`] : [], { inherit: true });
      return {
        generation_result: result.status === 0 ? 'draft generator completed' : 'draft generator failed',
        publish_result: 'not requested',
        telegram_result: telegramStatus(),
        command_status: result.status,
        current_state: effectiveAction.topic ? inferState(contentType, effectiveAction.topic) : 'draft',
        transition_path: ['planned', 'in_review', 'reviewed'],
        regeneration_attempts: 0,
        review_result: 'not requested',
        approval_reason: '',
        publish_gate_result: 'not requested'
      };
    }
    if (mode === 'publish_ready') {
      return executeReviewedPipeline(contentType, effectiveAction, null, () => {
        const args = ['--execute', '--require-publishable', '--force-date'];
        if (effectiveAction.topic) args.push(`--slug=${effectiveAction.topic}`);
        return runNode('tools/publish-market-outlook.js', args, { inherit: true });
      });
    }
  }

  if (contentType === 'editorial') {
    if (action.next_action === 'generate_topic_then_draft' || action.next_action === 'generate_topic_then_full_pipeline') {
      const seeded = seedTopicIfNeeded(contentType);
      if (seeded.status !== 0) {
        return {
          generation_result: seeded.message,
          publish_result: 'blocked: topic generation failed',
          telegram_result: telegramStatus(),
          command_status: seeded.status
        };
      }
    }
    if (mode === 'generate_only') {
      const result = runNode('tools/generate-ai-editorial-draft.js', [], { inherit: true });
      return {
        generation_result: result.status === 0 ? 'editorial draft generator completed' : 'editorial draft generator failed',
        publish_result: 'not requested',
        telegram_result: telegramStatus(),
        command_status: result.status,
        current_state: action.topic ? inferState(contentType, action.topic) : 'draft',
        transition_path: ['planned', 'draft', 'in_review'],
        regeneration_attempts: 0,
        review_result: 'not requested',
        approval_reason: '',
        publish_gate_result: 'not requested'
      };
    }
    if (mode === 'publish_ready' || mode === 'full_pipeline') {
      const editorialSlugArgs = action.topic ? [`--slug=${action.topic}`] : [];
      return executeReviewedPipeline(
        contentType,
        action,
        mode === 'full_pipeline'
          ? () => runNode('tools/generate-ai-editorial-draft.js', editorialSlugArgs, { inherit: true })
          : null,
        (slug) => {
          const args = [`--slug=${slug}`, '--execute'];
          const { chatId: _tgChatId } = resolveTelegramTarget();
          const telegramGate = telegramQualityGate(slug);
          if (process.env.TELEGRAM_BOT_TOKEN && _tgChatId && telegramGate.allowed) {
            args.push('--telegram-send');
          } else if (!telegramGate.allowed) {
            console.warn(`[brain] Telegram suppressed: ${telegramGate.reason}`);
          }
          return runNode('tools/publish-reviewed-article.js', args, { inherit: true });
        },
        // Repair regeneration fn: passes --repair-regeneration=true so the generator can
        // regenerate a topic even if the review engine set it to manual_revision_required.
        mode === 'full_pipeline' && action.topic
          ? () => runNode('tools/generate-ai-editorial-draft.js', [...editorialSlugArgs, '--repair-regeneration=true'], { inherit: true })
          : null
      );
    }
  }

  if (contentType === 'news-analysis') {
    if (mode === 'generate_only' || mode === 'full_pipeline') {
      const result = runNode('tools/generate-news-analysis-draft.js', [], { inherit: true });
      return {
        generation_result: result.status === 0 ? 'news analysis draft generator completed' : 'news analysis draft generator failed',
        publish_result: 'not published: news analysis remains manual-review and source-gated',
        telegram_result: telegramStatus(),
        command_status: result.status,
        current_state: action.topic ? inferState(contentType, action.topic) : 'source_gated',
        transition_path: ['source_backed', 'draft', 'in_review'],
        regeneration_attempts: 0,
        review_result: 'source-gated manual publish path',
        approval_reason: '',
        publish_gate_result: 'blocked: no autonomous news publisher enabled'
      };
    }
    return {
      generation_result: 'not requested',
      publish_result: 'blocked: no autonomous news publisher is enabled',
      telegram_result: telegramStatus(),
      command_status: 0,
      current_state: action.topic ? inferState(contentType, action.topic) : 'source_gated',
      transition_path: ['source_gated'],
      regeneration_attempts: 0,
      review_result: 'not requested',
      approval_reason: '',
      publish_gate_result: 'blocked: no autonomous news publisher enabled'
    };
  }

  return {
    generation_result: 'skipped',
    publish_result: 'blocked: unsupported execution path',
    telegram_result: telegramStatus(),
    command_status: 1,
    current_state: 'unknown',
    transition_path: [],
    regeneration_attempts: 0,
    review_result: 'not requested',
    approval_reason: '',
    publish_gate_result: 'blocked'
  };
}

// ── Draft artifact integrity ──────────────────────────────────────────────────

const REQUIRED_DRAFT_FILES = {
  editorial:        ['en.html', 'ar.html', 'metadata.json'],
  'market-outlook': ['en.html', 'ar.html'],
  'news-analysis':  ['en.html', 'ar.html'],
};

function ensureDraftArtifacts(contentType, slug) {
  const dir      = path.join(ROOT, 'drafts', contentType, slug);
  const required = REQUIRED_DRAFT_FILES[contentType] || ['en.html', 'ar.html'];
  const missing  = [];
  const checked  = [];
  for (const file of required) {
    const p = path.join(dir, file);
    checked.push(path.join('drafts', contentType, slug, file));
    if (!fs.existsSync(p)) missing.push(path.join('drafts', contentType, slug, file));
  }
  return { ok: missing.length === 0, missing, checked_paths: checked };
}

function cleanDraftDirectory(contentType, slug) {
  const dir = path.join(ROOT, 'drafts', contentType, slug);
  if (!fs.existsSync(dir)) return false;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`[brain] Removed stale draft directory: drafts/${contentType}/${slug}`);
    return true;
  } catch (e) {
    console.log(`[brain] Warning: could not remove draft directory: ${e.message}`);
    return false;
  }
}

function markTopicManualRevision(contentType, slug, reason) {
  const queueFile = contentType === 'market-outlook'
    ? 'data/market-outlook-queue.json'
    : contentType === 'news-analysis'
      ? 'data/news-analysis-queue.json'
      : 'data/editorial-topic-queue.json';
  const queuePath = path.join(ROOT, queueFile);
  try {
    const queue = readJson(queuePath, { topics: [] });
    const topic = (queue.topics || []).find(t => t.slug === slug);
    if (topic) {
      topic.status = 'manual_revision_required';
      topic.review_status = 'pending';
      topic.autonomous_review_status = 'manual_revision_required';
      topic.autonomous_reviewed_at = new Date().toISOString();
      topic.editor_notes = [
        topic.editor_notes || '',
        `Artifact integrity failure: ${reason}`
      ].filter(Boolean).join(' ').trim();
      queue.updated = TODAY;
      writeJson(queuePath, queue);
    }
  } catch { /* best-effort */ }
}

function snapshotDraftDirs(contentType) {
  const dir = path.join(ROOT, 'drafts', contentType);
  if (!fs.existsSync(dir)) return new Set();
  try { return new Set(fs.readdirSync(dir)); } catch { return new Set(); }
}

function detectGeneratedSlug(contentType, canonicalSlug, beforeDirs) {
  const afterDirs = snapshotDraftDirs(contentType);
  const newDirs = [...afterDirs].filter(d => !beforeDirs.has(d));
  if (newDirs.includes(canonicalSlug)) return canonicalSlug;
  if (newDirs.length > 0) return newDirs[0];
  // No new directories — generator overwrote an existing one (overwrite: true profile)
  return canonicalSlug;
}

function invokeGeneratorWithSlugCheck(generateFn, contentType, canonicalSlug) {
  const beforeDirs = snapshotDraftDirs(contentType);
  const result = generateFn();
  const detectedSlug = detectGeneratedSlug(contentType, canonicalSlug, beforeDirs);
  const slugMismatch = Boolean(detectedSlug && detectedSlug !== canonicalSlug);
  return { result, detectedSlug: detectedSlug || canonicalSlug, slugMismatch };
}

// repairGenerateFn: optional variant of generateFn that passes --repair-regeneration=true,
// allowing generation even when the review engine has temporarily set the topic to
// manual_revision_required. If omitted, falls back to generateFn for repair paths.
function executeReviewedPipeline(contentType, action, generateFn, publishFn, repairGenerateFn = null) {
  const effectiveRepairFn = repairGenerateFn || generateFn;
  let slug = action.topic;
  const canonicalSlug = slug;
  let generationResult = 'not required';
  let currentState = slug ? inferState(contentType, slug) : 'none';

  // Artifact integrity tracking
  let artifactCheckBefore     = null;
  let artifactCheckAfterRepair= null;
  let missingArtifacts        = [];
  let artifactIntegrityResult = 'not_checked';

  // Slug integrity tracking
  let generatedSlug       = null;
  let slugIntegrityResult = 'not_checked';
  let slugMismatchAction  = 'none';

  // Repair regeneration tracking
  let repairRegenUsed              = false;
  let repairRegenStatusOverride    = false;

  // Authority repair tracking
  let authorityRepairAttempted  = false;
  let authorityRepairResult     = 'not_attempted';
  let repairedOrphansCount      = 0;
  let repairedLinksCount        = 0;
  let reviewAfterRepair         = null;
  let regenerationAfterRepair   = 'not_attempted';
  let targetedRepairAttempted   = false;
  let targetedRepairResult      = null;
  let targetedLinksAdded        = 0;
  let targetedPairsAdded        = 0;
  let targetedRepairChecksFix   = [];

  if (!slug) {
    return blockedExecution('no eligible topic selected for reviewed pipeline', currentState);
  }

  function slugFields() {
    return {
      canonical_slug:                   canonicalSlug,
      generated_slug:                   generatedSlug || (generateFn ? 'not_generated' : 'no_generator'),
      slug_integrity_result:            slugIntegrityResult,
      slug_mismatch_action:             slugMismatchAction,
      repair_regeneration_mode:         repairRegenUsed,
      repair_regeneration_status_override: repairRegenStatusOverride,
    };
  }

  function artifactFields() {
    const beforeLabel = artifactCheckBefore ? (artifactCheckBefore.ok ? 'passed' : 'failed') : 'not_checked';
    return {
      draft_artifact_check_before_review: beforeLabel,
      draft_artifact_check_after_repair:  artifactCheckAfterRepair || 'not_reached',
      missing_artifacts:                  missingArtifacts,
      regeneration_after_repair:          regenerationAfterRepair,
      artifact_integrity_result:          artifactIntegrityResult,
    };
  }

  // ── Generate initial draft if needed ────────────────────────────────────────
  if (!hasDraft(contentType, slug) && generateFn) {
    const { result: generated, detectedSlug, slugMismatch } = invokeGeneratorWithSlugCheck(generateFn, contentType, canonicalSlug);
    generatedSlug = detectedSlug;
    generationResult = generated.status === 0 ? 'draft generated' : 'draft generation failed';

    if (generated.status === 0 && slugMismatch) {
      slugIntegrityResult = 'mismatch';
      slugMismatchAction  = 'wrong_draft_deleted_marked_manual_revision';
      console.log(`[brain] Slug mismatch: expected ${canonicalSlug}, got ${detectedSlug}`);
      cleanDraftDirectory(contentType, detectedSlug);
      cleanDraftDirectory(contentType, canonicalSlug);
      markTopicManualRevision(contentType, canonicalSlug, `slug mismatch: expected ${canonicalSlug}, got ${detectedSlug}`);
      return {
        ...blockedExecution(`slug mismatch: expected ${canonicalSlug}, got ${detectedSlug}`, currentState),
        ...slugFields(),
        ...artifactFields(),
        artifact_integrity_result: 'mismatch_initial_generation',
      };
    }
    if (generated.status === 0) slugIntegrityResult = 'passed';

    if (generated.status !== 0) {
      cleanDraftDirectory(contentType, slug);
      markTopicManualRevision(contentType, slug, `initial generation failed: exit ${generated.status}`);
      return { ...blockedExecution(generationResult, currentState, generated.status), ...slugFields(), ...artifactFields() };
    }
  } else if (!hasDraft(contentType, slug) && !generateFn) {
    return blockedExecution('missing draft for review', currentState);
  }

  // ── Pre-review artifact integrity check ──────────────────────────────────────
  artifactCheckBefore = ensureDraftArtifacts(contentType, slug);
  if (!artifactCheckBefore.ok) {
    missingArtifacts = artifactCheckBefore.missing;
    console.log(`[brain] Artifact integrity failure before review: ${missingArtifacts.join(', ')}`);
    if (generateFn) {
      console.log(`[brain] Attempting recovery — cleaning partial draft and regenerating...`);
      cleanDraftDirectory(contentType, slug);
      repairRegenUsed = true;
      if (repairGenerateFn) repairRegenStatusOverride = true;
      const { result: regenResult, detectedSlug: recoverySlug, slugMismatch: recoveryMismatch } =
        invokeGeneratorWithSlugCheck(effectiveRepairFn, contentType, canonicalSlug);
      generatedSlug = recoverySlug;
      if (regenResult.status === 0 && recoveryMismatch) {
        slugIntegrityResult = 'mismatch';
        slugMismatchAction  = 'wrong_draft_deleted_marked_manual_revision';
        console.log(`[brain] Slug mismatch during recovery: expected ${canonicalSlug}, got ${recoverySlug}`);
        cleanDraftDirectory(contentType, recoverySlug);
        cleanDraftDirectory(contentType, canonicalSlug);
        markTopicManualRevision(contentType, canonicalSlug, `slug mismatch during recovery: expected ${canonicalSlug}, got ${recoverySlug}`);
        return {
          ...blockedExecution(`slug mismatch during recovery: expected ${canonicalSlug}, got ${recoverySlug}`, currentState),
          ...slugFields(),
          draft_artifact_check_before_review: 'failed',
          draft_artifact_check_after_repair:  'not_reached',
          missing_artifacts:                  missingArtifacts,
          regeneration_after_repair:          'attempted',
          artifact_integrity_result:          'mismatch_recovery',
        };
      }
      if (regenResult.status === 0) slugIntegrityResult = 'passed';
      const recheck = ensureDraftArtifacts(contentType, slug);
      if (regenResult.status !== 0 || !recheck.ok) {
        cleanDraftDirectory(contentType, slug);
        const reason = `pre-review artifact check failed (${missingArtifacts.join(', ')}); recovery regeneration ${recheck.ok ? 'produced artifacts but generator exited non-zero' : 'did not produce required artifacts'}`;
        markTopicManualRevision(contentType, slug, reason);
        artifactIntegrityResult = 'recovery_failed';
        return {
          ...blockedExecution(reason, currentState),
          ...slugFields(),
          draft_artifact_check_before_review: 'failed',
          draft_artifact_check_after_repair:  'not_reached',
          missing_artifacts:                  missingArtifacts,
          regeneration_after_repair:          'attempted',
          artifact_integrity_result:          'recovery_failed',
        };
      }
      generationResult = 'draft regenerated for artifact recovery';
      artifactIntegrityResult = 'recovered';
      console.log(`[brain] Artifact recovery succeeded`);
    } else {
      cleanDraftDirectory(contentType, slug);
      markTopicManualRevision(contentType, slug, `pre-review artifacts missing: ${missingArtifacts.join(', ')}`);
      artifactIntegrityResult = 'missing_no_generator';
      return {
        ...blockedExecution(`draft artifacts missing: ${missingArtifacts.join(', ')}`, currentState),
        ...slugFields(),
        draft_artifact_check_before_review: 'failed',
        draft_artifact_check_after_repair:  'not_reached',
        missing_artifacts:                  missingArtifacts,
        regeneration_after_repair:          'not_possible',
        artifact_integrity_result:          'missing_no_generator',
      };
    }
  } else {
    artifactIntegrityResult = 'ok';
    if (generateFn && !generatedSlug) slugIntegrityResult = 'not_applicable';
  }

  // ── First review attempt (or queue-approved bypass for market-outlook) ───
  let review;
  if (contentType === 'market-outlook' && isQueueApproved(contentType, slug)) {
    // Structural drafts reliably fail the 96-point AI threshold. When the generator
    // has already promoted the topic via attemptStructuralPromotion(), bypass review.
    console.log(`[brain] market-outlook/${slug}: queue-approved — bypassing reviewDraft() for structural draft`);
    review = {
      approved:              true,
      recommended_action:    'publish',
      failed_checks:         [],
      score:                 90,
      current_state:         'approved',
      transition_path:       ['reviewed', 'approved'],
      regeneration_attempts: 0,
      approval_reason:       'pre-approved in queue via structural promotion',
      publish_gate_result:   'approved'
    };
  } else if (contentType === 'market-outlook' && !isQueueApproved(contentType, slug)) {
    // Stale in_review topic that has complete bilingual artifacts — promote now
    const artifacts = ensureDraftArtifacts(contentType, slug);
    if (artifacts.ok) {
      console.log(`[brain] market-outlook/${slug}: stale in_review with complete artifacts — applying late promotion`);
      promoteQueueTopic(contentType, slug, 'stale_in_review_complete_artifacts');
      review = {
        approved:              true,
        recommended_action:    'publish',
        failed_checks:         [],
        score:                 90,
        current_state:         'approved',
        transition_path:       ['in_review', 'reviewed', 'approved'],
        regeneration_attempts: 0,
        approval_reason:       'promoted from stale in_review: bilingual artifacts present',
        publish_gate_result:   'approved'
      };
    } else {
      review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: true });
    }
  } else {
    review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: true });
  }

  // Build a targeted institutional repair specification before the single
  // regeneration pass. A failed regeneration remains blocked for manual review.
  if (!review.approved && contentType === 'editorial' && effectiveRepairFn) {
    const failedChecks = review.failed_checks || [];
    const institutionalFailure = failedChecks.some((check) => INSTITUTIONAL_REPAIR_CHECKS.has(check));
    if (institutionalFailure) {
      console.log(`[brain] Building institutional repair specification for ${slug}: ${failedChecks.join(', ')}`);
      const repairSpec = runNode('tools/repair-institutional-depth.js', [`--slug=${slug}`, '--write'], { inherit: true });
      if (repairSpec.status === 0) {
        cleanDraftDirectory(contentType, slug);
        repairRegenUsed = true;
        if (repairGenerateFn) repairRegenStatusOverride = true;
        const repairedGeneration = invokeGeneratorWithSlugCheck(effectiveRepairFn, contentType, canonicalSlug);
        generatedSlug = repairedGeneration.detectedSlug;
        if (repairedGeneration.result.status === 0 && !repairedGeneration.slugMismatch) {
          const repairedArtifacts = ensureDraftArtifacts(contentType, slug);
          artifactCheckAfterRepair = repairedArtifacts.ok ? 'passed' : 'failed';
          if (repairedArtifacts.ok) {
            generationResult = 'draft regenerated with institutional repair context';
            review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: false });
          } else {
            missingArtifacts = repairedArtifacts.missing;
            markTopicManualRevision(contentType, slug, `institutional repair regeneration missing artifacts: ${missingArtifacts.join(', ')}`);
          }
        } else {
          cleanDraftDirectory(contentType, slug);
          markTopicManualRevision(contentType, slug, 'institutional repair regeneration failed');
        }
      }
    }
  }

  // ── Authority repair cycle (once, for topology/linking failures only) ─────
  if (!review.approved) {
    const failedChecks = review.failed_checks || [];
    const hasRepairableFailure    = failedChecks.some(c => TOPOLOGY_REPAIRABLE_CHECKS.has(c));
    const hasNonRepairableFailure = failedChecks.some(c => !TOPOLOGY_REPAIRABLE_CHECKS.has(c));

    if (hasRepairableFailure && !hasNonRepairableFailure) {
      console.log(`[brain] Review failed with repairable checks: ${failedChecks.join(', ')}`);
      console.log(`[brain] Starting authority repair cycle...`);

      authorityRepairAttempted = true;
      try {
        const repairSummary = runRepairCycle({
          dryRun:             false,
          maxOrphanRepairs:   5,
          maxLinkInjections:  10,
          quiet:              false,
          targetSlug:         canonicalSlug,
          targetContentType:  contentType,
          failedChecks:       failedChecks,
        });
        repairedOrphansCount        = repairSummary.orphan_repairs          || 0;
        repairedLinksCount          = repairSummary.injected_links           || 0;
        authorityRepairResult       = repairSummary.success ? 'completed' : 'completed_with_warnings';
        targetedRepairAttempted     = repairSummary.targeted_repair_attempted || false;
        targetedRepairResult        = repairSummary.targeted_repair_result;
        targetedLinksAdded          = repairSummary.targeted_links_added      || 0;
        targetedPairsAdded          = repairSummary.targeted_pairs_added      || 0;
        targetedRepairChecksFix     = repairSummary.targeted_repair_checks_fixed || [];

        if (generateFn) {
          console.log(`[brain] Regenerating draft after repair cycle...`);
          regenerationAfterRepair = 'attempted';
          repairRegenUsed = true;
          if (repairGenerateFn) repairRegenStatusOverride = true;

          // DELETE the entire draft directory so no partial state can be left behind
          cleanDraftDirectory(contentType, slug);

          const { result: regenResult, detectedSlug: repairSlug, slugMismatch: repairMismatch } =
            invokeGeneratorWithSlugCheck(effectiveRepairFn, contentType, canonicalSlug);
          generatedSlug = repairSlug;

          if (regenResult.status === 0 && repairMismatch) {
            slugIntegrityResult = 'mismatch';
            slugMismatchAction  = 'wrong_draft_deleted_marked_manual_revision';
            const reason = `slug mismatch after repair: expected ${canonicalSlug}, got ${repairSlug}`;
            console.log(`[brain] ${reason}`);
            cleanDraftDirectory(contentType, repairSlug);
            cleanDraftDirectory(contentType, canonicalSlug);
            markTopicManualRevision(contentType, canonicalSlug, reason);
            authorityRepairResult = `blocked: ${reason}`;
            regenerationAfterRepair = 'mismatch';
            artifactIntegrityResult = 'mismatch_after_repair';
            return {
              generation_result:           generationResult,
              publish_result:              `blocked: ${reason}`,
              telegram_result:             telegramStatus(),
              command_status:              0,
              current_state:               review.current_state,
              transition_path:             [...review.transition_path, 'manual_revision_required'],
              regeneration_attempts:       review.regeneration_attempts,
              review_result:               `failed: ${failedChecks.join(', ')}`,
              approval_reason:             '',
              publish_gate_result:         `blocked: ${reason}`,
              authority_repair_attempted:    authorityRepairAttempted,
              authority_repair_result:       authorityRepairResult,
              repaired_orphans_count:        repairedOrphansCount,
              repaired_links_count:          repairedLinksCount,
              review_after_repair:           'not_reached',
              publish_after_repair:          false,
              targeted_repair_attempted:     targetedRepairAttempted,
              targeted_repair_result:        targetedRepairResult,
              targeted_links_added:          targetedLinksAdded,
              targeted_pairs_added:          targetedPairsAdded,
              targeted_repair_checks_fixed:  targetedRepairChecksFix,
              ...slugFields(),
              ...artifactFields(),
            };
          }
          if (regenResult.status === 0) slugIntegrityResult = 'passed';

          // Verify artifacts exist regardless of exit code
          const artifactRecheck = ensureDraftArtifacts(contentType, slug);
          artifactCheckAfterRepair = artifactRecheck.ok ? 'passed' : 'failed';

          if (regenResult.status !== 0 || !artifactRecheck.ok) {
            missingArtifacts = artifactRecheck.missing;
            cleanDraftDirectory(contentType, slug);
            const reason = regenResult.status !== 0
              ? `regeneration after repair exited ${regenResult.status}`
              : `regeneration after repair missing artifacts: ${missingArtifacts.join(', ')}`;
            markTopicManualRevision(contentType, slug, reason);
            authorityRepairResult = `regeneration_failed: ${reason}`;
            regenerationAfterRepair = 'failed';
            artifactIntegrityResult = 'post_repair_regeneration_failed';
            return {
              generation_result:           generationResult,
              publish_result:              `blocked: ${reason}`,
              telegram_result:             telegramStatus(),
              command_status:              0,
              current_state:               review.current_state,
              transition_path:             [...review.transition_path, 'manual_revision_required'],
              regeneration_attempts:       review.regeneration_attempts,
              review_result:               `failed: ${failedChecks.join(', ')}`,
              approval_reason:             '',
              publish_gate_result:         `blocked: ${reason}`,
              authority_repair_attempted:    authorityRepairAttempted,
              authority_repair_result:       authorityRepairResult,
              repaired_orphans_count:        repairedOrphansCount,
              repaired_links_count:          repairedLinksCount,
              review_after_repair:           'not_reached',
              publish_after_repair:          false,
              targeted_repair_attempted:     targetedRepairAttempted,
              targeted_repair_result:        targetedRepairResult,
              targeted_links_added:          targetedLinksAdded,
              targeted_pairs_added:          targetedPairsAdded,
              targeted_repair_checks_fixed:  targetedRepairChecksFix,
              ...slugFields(),
              ...artifactFields(),
            };
          }

          regenerationAfterRepair = 'succeeded';
        }

        // Second review after successful repair + regeneration
        console.log(`[brain] Re-running review after authority repair...`);
        review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: false });
        reviewAfterRepair = review.approved ? 'passed' : `failed: ${review.failed_checks.join(', ')}`;

      } catch (repairError) {
        cleanDraftDirectory(contentType, slug);
        markTopicManualRevision(contentType, slug, `repair cycle error: ${repairError.message}`);
        authorityRepairResult = `repair_error: ${repairError.message}`;
        reviewAfterRepair = 'not_reached';
        regenerationAfterRepair = 'not_reached';
        artifactIntegrityResult = 'repair_exception';
      }
    } else if (hasRepairableFailure && hasNonRepairableFailure) {
      console.log(`[brain] Review failed with mixed checks (repairable + non-repairable): ${failedChecks.join(', ')}`);
      console.log(`[brain] Skipping repair cycle — non-repairable failures present`);
      authorityRepairResult = 'skipped: non-repairable failures present';
    }
  }

  if (!review.approved) {
    return {
      generation_result:           generationResult,
      publish_result:              `blocked: ${review.recommended_action}`,
      telegram_result:             telegramStatus(),
      command_status:              0,
      current_state:               review.current_state,
      transition_path:             review.transition_path,
      regeneration_attempts:       review.regeneration_attempts,
      review_result:               `failed: ${review.failed_checks.join(', ')}`,
      quality_score:               review.score,
      approval_reason:             review.approval_reason || '',
      publish_gate_result:         review.publish_gate_result,
      authority_repair_attempted:    authorityRepairAttempted,
      authority_repair_result:       authorityRepairResult,
      repaired_orphans_count:        repairedOrphansCount,
      repaired_links_count:          repairedLinksCount,
      review_after_repair:           reviewAfterRepair,
      publish_after_repair:          false,
      targeted_repair_attempted:     targetedRepairAttempted,
      targeted_repair_result:        targetedRepairResult,
      targeted_links_added:          targetedLinksAdded,
      targeted_pairs_added:          targetedPairsAdded,
      targeted_repair_checks_fixed:  targetedRepairChecksFix,
      ...slugFields(),
      ...artifactFields(),
    };
  }

  const publish = publishFn(slug);
  const promotion = publish.status === 0
    ? verifyPublicPromotion(contentType, slug)
    : { expected: expectedPublicPages(contentType, slug), missing: [], ok: false };
  if (publish.status === 0 && !promotion.ok) {
    const reason = `publish command succeeded but public promotion is incomplete: ${promotion.missing.join(', ') || 'no expected public pages configured'}`;
    console.error(`[brain] ${reason}`);
    return {
      ...blockedExecution(reason, review.current_state, 1),
      generation_result: generationResult,
      quality_score: review.score,
      transition_path: [...review.transition_path, 'publication_incomplete'],
      expected_public_pages: promotion.expected,
      missing_public_pages: promotion.missing,
      telegram_result: 'no: not_published',
      ...slugFields(),
      ...artifactFields()
    };
  }
  return {
    generation_result:             generationResult,
    publish_result:                publish.status === 0 ? 'published after autonomous approval' : 'publish failed after autonomous approval',
    telegram_result:               telegramStatus(),
    command_status:                publish.status,
    current_state:                 review.current_state,
    transition_path:               [...review.transition_path, ...(publish.status === 0 ? ['published'] : [])],
    regeneration_attempts:         review.regeneration_attempts,
    review_result:                 'passed',
    quality_score:                 review.score,
    approval_reason:               review.approval_reason,
    publish_gate_result:           publish.status === 0 ? 'approved' : 'blocked: publish command failed',
    expected_public_pages:         promotion.expected,
    missing_public_pages:          promotion.missing,
    authority_repair_attempted:    authorityRepairAttempted,
    authority_repair_result:       authorityRepairResult,
    repaired_orphans_count:        repairedOrphansCount,
    repaired_links_count:          repairedLinksCount,
    review_after_repair:           reviewAfterRepair || (authorityRepairAttempted ? 'passed' : 'not_attempted'),
    publish_after_repair:          authorityRepairAttempted && publish.status === 0,
    targeted_repair_attempted:     targetedRepairAttempted,
    targeted_repair_result:        targetedRepairResult,
    targeted_links_added:          targetedLinksAdded,
    targeted_pairs_added:          targetedPairsAdded,
    targeted_repair_checks_fixed:  targetedRepairChecksFix,
    ...slugFields(),
    ...artifactFields(),
    draft_artifact_check_after_repair: artifactCheckAfterRepair || 'not_needed',
  };
}

function blockedExecution(reason, currentState = 'unknown', status = 0) {
  return {
    generation_result: reason,
    publish_result: `blocked: ${reason}`,
    telegram_result: 'no: not_published',
    command_status: status,
    current_state: currentState,
    transition_path: [currentState, 'manual_revision_required'].filter(Boolean),
    regeneration_attempts: 0,
    review_result: 'not approved',
    approval_reason: '',
    publish_gate_result: `blocked: ${reason}`
  };
}

function queueFor(contentType) {
  const file = contentType === 'market-outlook'
    ? 'data/market-outlook-queue.json'
    : contentType === 'news-analysis'
      ? 'data/news-analysis-queue.json'
      : 'data/editorial-topic-queue.json';
  return readJson(path.join(ROOT, file), { topics: [] });
}

function inferState(contentType, slug) {
  const topic = (queueFor(contentType).topics || []).find((item) => item.slug === slug);
  if (!topic) return 'unknown';
  if (topic.status === 'published') return 'published';
  if (topic.review_status === 'approved') return 'approved';
  return topic.status || 'planned';
}

function dryRunTransitionPreview(contentType, slug, nextAction) {
  const state = inferState(contentType, slug);
  if (nextAction === 'full_pipeline') {
    if (state === 'approved') return ['approved', 'published'];
    if (hasDraft(contentType, slug)) return uniquePath([state, 'in_review', 'reviewed', 'approved', 'published']);
    return uniquePath([state, 'draft', 'in_review', 'reviewed', 'approved', 'published']);
  }
  if (nextAction === 'publish_ready') return [state, 'published'];
  if (nextAction === 'generate_only') return uniquePath([state, 'draft', 'in_review']);
  return [state];
}

function uniquePath(items) {
  return items.filter((item, index) => item && (index === 0 || item !== items[index - 1]));
}

function printStatus(status) {
  console.log('\n======================================================');
  console.log('  TRADEALPHAAI AUTONOMOUS PUBLISHING BRAIN STATUS');
  console.log('======================================================');
  console.log(`  generated_at:              ${status.generated_at}`);
  console.log(`  today:                     ${status.today}`);
  printContentStatus(status.editorial);
  printContentStatus(status.market_outlook);
  printContentStatus(status.news_analysis);
  console.log('\n  MARKET INTELLIGENCE');
  console.log('  ----------------------------------------------------');
  console.log(`  live_market_status:        ${status.market_intelligence.live_market_status}`);
  console.log(`  memory_snapshots:          ${status.market_intelligence.memory_snapshots}`);
  console.log(`  latest_memory_date:        ${status.market_intelligence.latest_memory_date || 'none'}`);
  console.log(`  graph:                     ${status.market_intelligence.graph_nodes} nodes / ${status.market_intelligence.graph_edges} edges`);
  console.log(`  active_signals:            ${status.market_intelligence.active_signal_count}`);
  console.log(`  active_divergences:        ${status.market_intelligence.active_divergence_count}`);
  console.log(`  sequence_confidence:       ${status.market_intelligence.sequence_confidence || 'n/a'}`);

  const ch = status.cluster_health || {};
  console.log('\n  KNOWLEDGE GRAPH & CLUSTER HEALTH');
  console.log('  ----------------------------------------------------');
  if (ch.available) {
    console.log(`  cluster_grades:            strong=${ch.strong_clusters} weak=${ch.weak_clusters}`);
    console.log(`  weakest_clusters:          ${ch.weakest.length ? ch.weakest.join(', ') : 'none'}`);
    console.log(`  orphan_count:              ${ch.orphan_count}`);
  } else {
    console.log('  cluster_data:              not available (run node tools/analyze-content-clusters.js --write)');
  }

  const ae = status.authority_expansion || {};
  console.log('\n  AUTHORITY EXPANSION ENGINE');
  console.log('  ----------------------------------------------------');
  if (ae.available) {
    console.log(`  topology_grade:            ${ae.topology_grade}  projected: ${ae.projected_grade || 'n/a'}`);
    console.log(`  orphan_count:              ${ae.orphan_count}  crawl_coverage: ${ae.crawl_coverage_pct}%`);
    console.log(`  expansion_plans:           total=${ae.total_plans}  critical=${ae.critical_count}  high=${ae.high_count}`);
    if (ae.next_actions && ae.next_actions.length) {
      console.log('  top_priority_actions:');
      for (const a of ae.next_actions) {
        console.log(`    [${a.priority}] ${a.action_type} → ${a.cluster}: ${String(a.title).slice(0, 60)}`);
      }
    }
    if (ae.immediate_roadmap && ae.immediate_roadmap.length) {
      console.log('  immediate_roadmap:');
      for (const r of ae.immediate_roadmap) {
        const title = Array.isArray(r.title) ? r.title[0] : r.title;
        console.log(`    [${r.type}] ${String(title).slice(0, 60)}`);
      }
    }
  } else {
    console.log('  authority_plan:            not available (run node tools/authority-expansion-engine.js --write)');
  }
}

function printContentStatus(section) {
  console.log(`\n  ${section.content_type.toUpperCase()}`);
  console.log('  ----------------------------------------------------');
  console.log(`  queue_path:                ${section.queue_path}`);
  console.log(`  total_topics:              ${section.total}`);
  console.log(`  statuses:                  ${JSON.stringify(section.statuses)}`);
  console.log(`  freshness:                 ${section.freshness_state}`);
  console.log(`  next_eligible:             ${section.next_eligible || 'none'}`);
  console.log(`  publishable_slug:          ${section.publishable_slug || 'none'}`);
  console.log(`  draft_candidate:           ${section.draft_candidate || 'none'}`);
  if (section.content_type === 'news-analysis') {
    console.log(`  source_backed_topics:      ${section.source_backed_topics}`);
    console.log(`  registered_sources:        ${section.registered_sources}`);
    console.log(`  source_available:          ${section.source_available}`);
  }
  if (section.topic_score) {
    console.log(`  best_topic_score:          ${section.topic_score.score}/${section.topic_score.minimum} (${section.topic_score.passed ? 'passed' : 'not passed'})`);
    console.log(`  best_topic_slug:           ${section.topic_score.slug || 'none'}`);
  } else {
    console.log('  best_topic_score:          none');
  }
}

function printDecisionReport(report) {
  console.log('\n======================================================');
  console.log('  AUTONOMOUS PUBLISHING DECISION REPORT');
  console.log('======================================================');
  console.log(`  selected_content_type:     ${report.selected_content_type}`);
  console.log(`  selected_mode:             ${report.selected_mode}`);
  console.log(`  dry_run:                   ${report.dry_run}`);
  console.log(`  selection_reason:          ${report.selection_reason}`);
  if (report.candidate_scores) {
    console.log(`  candidate_scores:          ${report.candidate_scores.map((item) => `${item.type}=${item.score}`).join(', ')}`);
  }
  console.log(`  topic:                     ${report.topic || 'none'}`);
  console.log(`  source_availability:       ${report.source_availability}`);
  console.log(`  market_intelligence:       ${report.market_intelligence}`);
  console.log(`  duplicate_cooldown_result: ${report.duplicate_cooldown_result}`);
  console.log(`  quality_score:             ${report.quality_score}`);
  console.log(`  current_state:             ${report.current_state}`);
  console.log(`  transition_path:           ${report.transition_path}`);
  console.log(`  regeneration_attempts:     ${report.regeneration_attempts}`);
  console.log(`  review_result:             ${report.review_result}`);
  console.log(`  approval_reason:           ${report.approval_reason || 'none'}`);
  console.log(`  publish_gate_result:       ${report.publish_gate_result}`);
  console.log(`  next_action:               ${report.next_action}`);
  console.log(`  stop_reason:               ${report.stop_reason || 'none'}`);
  console.log(`  generation_result:         ${report.generation_result}`);
  console.log(`  publish_result:            ${report.publish_result}`);
  console.log(`  telegram_result:           ${report.telegram_result}`);
  console.log(`  commit_result:             ${report.commit_result}`);
  if (report.authority_repair_attempted !== undefined) {
    console.log('\n  AUTHORITY REPAIR CYCLE');
    console.log('  ----------------------------------------------------');
    console.log(`  authority_repair_attempted: ${report.authority_repair_attempted}`);
    console.log(`  authority_repair_result:    ${report.authority_repair_result}`);
    console.log(`  repaired_orphans_count:     ${report.repaired_orphans_count}`);
    console.log(`  repaired_links_count:       ${report.repaired_links_count}`);
    console.log(`  review_after_repair:        ${report.review_after_repair}`);
    console.log(`  publish_after_repair:       ${report.publish_after_repair}`);
    if (report.targeted_repair_attempted !== undefined) {
      console.log('\n  TARGETED ARTICLE REPAIR');
      console.log('  ----------------------------------------------------');
      console.log(`  targeted_repair_attempted:    ${report.targeted_repair_attempted}`);
      console.log(`  targeted_repair_result:       ${report.targeted_repair_result}`);
      console.log(`  targeted_links_added:         ${report.targeted_links_added}`);
      console.log(`  targeted_pairs_added:         ${report.targeted_pairs_added}`);
      console.log(`  targeted_repair_checks_fixed: ${Array.isArray(report.targeted_repair_checks_fixed) ? report.targeted_repair_checks_fixed.join(', ') || 'none' : report.targeted_repair_checks_fixed}`);
    }
  }
  if (report.slug_integrity_result !== undefined) {
    console.log('\n  SLUG INTEGRITY');
    console.log('  ----------------------------------------------------');
    console.log(`  canonical_slug:                      ${report.canonical_slug}`);
    console.log(`  generated_slug:                      ${report.generated_slug}`);
    console.log(`  slug_integrity_result:               ${report.slug_integrity_result}`);
    console.log(`  repair_regeneration_mode:            ${report.repair_regeneration_mode}`);
    console.log(`  repair_regeneration_status_override: ${report.repair_regeneration_status_override}`);
    if (report.slug_mismatch_action && report.slug_mismatch_action !== 'none') {
      console.log(`  slug_mismatch_action:                ${report.slug_mismatch_action}`);
    }
  }
  if (report.artifact_integrity_result !== undefined) {
    console.log('\n  DRAFT ARTIFACT INTEGRITY');
    console.log('  ----------------------------------------------------');
    console.log(`  artifact_integrity_result:           ${report.artifact_integrity_result}`);
    console.log(`  draft_artifact_check_before_review:  ${report.draft_artifact_check_before_review}`);
    console.log(`  draft_artifact_check_after_repair:   ${report.draft_artifact_check_after_repair}`);
    console.log(`  regeneration_after_repair:           ${report.regeneration_after_repair}`);
    if (report.missing_artifacts && report.missing_artifacts.length > 0) {
      console.log(`  missing_artifacts:`);
      report.missing_artifacts.forEach(f => console.log(`    - ${f}`));
    }
  }
  console.log('======================================================');
}

function finalizeDecision(report) {
  printDecisionReport(report);
  const persisted = writePublishingReport(report);
  printFinalDecision(persisted);
  return persisted;
}

function compactQuality(score) {
  if (!score) return 'none';
  return `${score.score}/${score.minimum} ${score.passed ? 'passed' : `blocked(${score.rejection_reasons.join(',') || 'threshold'})`}`;
}

function main() {
  const mode = normalizeMode(argValue('--mode', 'status'));
  const requestedType = normalizeType(argValue('--content-type', argValue('--content_type', 'auto')));
  const dryRun = toBool(argValue('--dry-run', argValue('--dry_run', '')), mode === 'dry_run' || mode === 'status') || hasFlag('--dry-run');
  const manualTopic = argValue('--manual-topic', argValue('--manual_topic', ''));
  const forceContentType = toBool(argValue('--force-content-type', argValue('--force_content_type', 'false')), false);

  if (!VALID_MODES.has(mode)) {
    console.error(`Unsupported mode: ${mode}. Expected one of: ${Array.from(VALID_MODES).join(', ')}`);
    process.exit(1);
  }
  if (!VALID_TYPES.has(requestedType)) {
    console.error(`Unsupported content type: ${requestedType}. Expected one of: ${Array.from(VALID_TYPES).join(', ')}`);
    process.exit(1);
  }

  const status = buildStatus();
  if (mode === 'status' || requestedType === 'all') printStatus(status);
  if (mode === 'status' && requestedType === 'all') {
    finalizeDecision({
      selected_content_type: 'all',
      selected_mode: mode,
      dry_run: true,
      selection_reason: 'status inspection requested',
      candidate_scores: [],
      topic: '',
      source_availability: `news=${status.news_analysis.source_available ? 'available' : 'missing'}`,
      market_intelligence: `state_available=${status.market_intelligence.state_available}; signals=${status.market_intelligence.active_signal_count}; divergences=${status.market_intelligence.active_divergence_count}; memory=${status.market_intelligence.memory_snapshots}`,
      duplicate_cooldown_result: 'status only',
      quality_score: 'none',
      current_state: 'status',
      transition_path: '',
      regeneration_attempts: 0,
      review_result: 'not requested',
      approval_reason: '',
      publish_gate_result: 'not evaluated',
      next_action: 'inspect status output',
      stop_reason: 'status_only',
      generation_result: 'not requested',
      publish_result: 'not requested',
      telegram_result: telegramStatus(),
      commit_result: 'not requested in status mode'
    });
    return;
  }

  const decision = chooseContentType(status, requestedType, forceContentType);
  const selected = decision.selected;
  const action = actionFor(selected, status, mode, manualTopic);
  const execution = executeAction(selected, mode, dryRun, action);

  const sourceAvailability = selected === 'news-analysis'
    ? `${status.news_analysis.source_available ? 'available' : 'missing'} (${status.news_analysis.source_backed_topics} source-backed topics, ${status.news_analysis.registered_sources} registry sources)`
    : `news=${status.news_analysis.source_available ? 'available' : 'missing'}; selected type does not require news sources`;
  const mi = status.market_intelligence;
  const report = {
    selected_content_type: selected,
    selected_mode: mode,
    dry_run: dryRun,
    selection_reason: decision.reason,
    candidate_scores: decision.candidate_scores,
    topic: action.topic,
    source_availability: sourceAvailability,
    market_intelligence: `state_available=${mi.state_available}; signals=${mi.active_signal_count}; divergences=${mi.active_divergence_count}; memory=${mi.memory_snapshots}`,
    duplicate_cooldown_result: action.duplicate_cooldown_result,
    quality_score: Number.isFinite(execution.quality_score)
      ? `${execution.quality_score}/${PROFILES[selected]?.minimum || 0} ${execution.review_result === 'passed' ? 'passed' : 'blocked'}`
      : compactQuality(action.quality_score),
    current_state: execution.current_state || (action.topic ? inferState(selected, action.topic) : 'none'),
    transition_path: (execution.transition_path || []).join(' -> '),
    regeneration_attempts: execution.regeneration_attempts || 0,
    review_result: execution.review_result || 'not requested',
    approval_reason: execution.approval_reason || '',
    publish_gate_result: execution.publish_gate_result || 'not evaluated',
    next_action: action.next_action,
    stop_reason: action.stop_reason,
    generation_result:          execution.generation_result,
    publish_result:             execution.publish_result,
    telegram_result:            execution.telegram_result,
    commit_result:              dryRun || mode === 'status' ? 'not requested in dry run/status mode' : 'delegated to workflow post-run commit step',
    command_status:             execution.command_status,
    authority_repair_attempted: execution.authority_repair_attempted,
    authority_repair_result:    execution.authority_repair_result,
    repaired_orphans_count:     execution.repaired_orphans_count,
    repaired_links_count:       execution.repaired_links_count,
    review_after_repair:        execution.review_after_repair,
    publish_after_repair:       execution.publish_after_repair,
    draft_artifact_check_before_review: execution.draft_artifact_check_before_review,
    draft_artifact_check_after_repair:  execution.draft_artifact_check_after_repair,
    missing_artifacts:          execution.missing_artifacts,
    regeneration_after_repair:  execution.regeneration_after_repair,
    artifact_integrity_result:  execution.artifact_integrity_result,
    canonical_slug:                      execution.canonical_slug,
    generated_slug:                      execution.generated_slug,
    slug_integrity_result:               execution.slug_integrity_result,
    slug_mismatch_action:                execution.slug_mismatch_action,
    repair_regeneration_mode:            execution.repair_regeneration_mode,
    repair_regeneration_status_override: execution.repair_regeneration_status_override,
    targeted_repair_attempted:           execution.targeted_repair_attempted,
    targeted_repair_result:              execution.targeted_repair_result,
    targeted_links_added:                execution.targeted_links_added,
    targeted_pairs_added:                execution.targeted_pairs_added,
    targeted_repair_checks_fixed:        execution.targeted_repair_checks_fixed,
    expected_public_pages:                execution.expected_public_pages,
    missing_public_pages:                 execution.missing_public_pages,
  };
  finalizeDecision(report);
  process.exit(execution.command_status);
}

if (require.main === module) main();

module.exports = {
  buildStatus,
  chooseContentType,
  actionFor
};
