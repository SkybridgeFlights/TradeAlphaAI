'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { scoreCandidates, scoreTopic, hasRealSources } = require('./score-autonomous-topic');
const { reviewDraft, hasDraft, TOPOLOGY_REPAIRABLE_CHECKS, PROFILES } = require('./autonomous-review-engine');
const { CLUSTER_DEFINITIONS } = require('./analyze-content-clusters');
const { runRepairCycle } = require('./run-authority-repair-cycle');

// Cache overwrite flags per content type so we know if we need to force-clear drafts
const PROFILES_OVERWRITE = Object.fromEntries(
  Object.entries(PROFILES).map(([k, v]) => [k, Boolean(v.overwrite)])
);

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);
const VALID_MODES = new Set(['status', 'dry_run', 'generate_only', 'publish_ready', 'full_pipeline']);
const VALID_TYPES = new Set(['auto', 'editorial', 'market-outlook', 'news-analysis', 'all']);
const DRAFT_STATUSES = new Set(['draft', 'planned', 'queued']);

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

function telegramStatus() {
  const configured = Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
  return configured ? 'configured' : 'skipped: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing';
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
    if (mode === 'full_pipeline') {
      return executeReviewedPipeline(contentType, action, () => runNode('tools/generate-market-outlook-draft.js', action.topic ? [`--slug=${action.topic}`] : [], { inherit: true }), () => {
        const args = ['--execute', '--require-publishable', '--force-date'];
        if (action.topic) args.push(`--slug=${action.topic}`);
        return runNode('tools/publish-market-outlook.js', args, { inherit: true });
      });
    }
    if (mode === 'generate_only') {
      const result = runNode('tools/generate-market-outlook-draft.js', [], { inherit: true });
      return {
        generation_result: result.status === 0 ? 'draft generator completed' : 'draft generator failed',
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
    if (mode === 'publish_ready') {
      return executeReviewedPipeline(contentType, action, null, () => {
        const args = ['--execute', '--require-publishable', '--force-date'];
        if (action.topic) args.push(`--slug=${action.topic}`);
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
      return executeReviewedPipeline(contentType, action, mode === 'full_pipeline' ? () => runNode('tools/generate-ai-editorial-draft.js', [], { inherit: true }) : null, (slug) => {
        const args = [`--slug=${slug}`, '--execute'];
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) args.push('--telegram-send');
        return runNode('tools/publish-reviewed-article.js', args, { inherit: true });
      });
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

function executeReviewedPipeline(contentType, action, generateFn, publishFn) {
  let slug = action.topic;
  let generationResult = 'not required';
  let currentState = slug ? inferState(contentType, slug) : 'none';

  if (!slug) {
    return blockedExecution('no eligible topic selected for reviewed pipeline', currentState);
  }

  if (!hasDraft(contentType, slug) && generateFn) {
    const generated = generateFn();
    generationResult = generated.status === 0 ? 'draft generated' : 'draft generation failed';
    if (generated.status !== 0) return blockedExecution(generationResult, currentState, generated.status);
  } else if (!hasDraft(contentType, slug) && !generateFn) {
    return blockedExecution('missing draft for review', currentState);
  }

  // ── First review attempt ──────────────────────────────────────────────────
  let review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: true });

  // ── Authority repair cycle (once, for topology/linking failures only) ─────
  let authorityRepairAttempted = false;
  let authorityRepairResult    = 'not_attempted';
  let repairedOrphansCount     = 0;
  let repairedLinksCount       = 0;
  let reviewAfterRepair        = null;

  if (!review.approved) {
    const failedChecks = review.failed_checks || [];
    const hasRepairableFailure = failedChecks.some(c => TOPOLOGY_REPAIRABLE_CHECKS.has(c));
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
        });
        repairedOrphansCount = repairSummary.orphan_repairs || 0;
        repairedLinksCount   = repairSummary.injected_links || 0;
        authorityRepairResult = repairSummary.success ? 'completed' : 'completed_with_warnings';

        // Re-generate draft to pick up fresh knowledge graph links.
        // For non-overwrite profiles (editorial), remove the failing draft first so
        // the generator creates a fresh one instead of skipping.
        if (generateFn) {
          console.log(`[brain] Re-generating draft after repair cycle...`);
          const draftDir = path.join(ROOT, 'drafts', contentType, slug);
          if (!PROFILES_OVERWRITE[contentType] && fs.existsSync(draftDir)) {
            const enFile = path.join(draftDir, 'en.html');
            const arFile = path.join(draftDir, 'ar.html');
            if (fs.existsSync(enFile)) fs.unlinkSync(enFile);
            if (fs.existsSync(arFile)) fs.unlinkSync(arFile);
            console.log(`[brain] Cleared existing draft for fresh regeneration`);
          }
          const regenResult = generateFn();
          if (regenResult.status !== 0) {
            authorityRepairResult = 'regeneration_failed_after_repair';
          }
        }

        // Second review after repair
        console.log(`[brain] Re-running review after authority repair...`);
        review = reviewDraft({ contentType, slug, dryRun: false, allowRegeneration: false });
        reviewAfterRepair = review.approved ? 'passed' : `failed: ${review.failed_checks.join(', ')}`;
      } catch (repairError) {
        authorityRepairResult = `repair_error: ${repairError.message}`;
        reviewAfterRepair = 'not_reached';
      }
    } else if (hasRepairableFailure && hasNonRepairableFailure) {
      // Mixed failures: topology repairs won't fix content quality issues
      console.log(`[brain] Review failed with mixed checks (repairable + non-repairable): ${failedChecks.join(', ')}`);
      console.log(`[brain] Skipping repair cycle — non-repairable failures require manual revision`);
      authorityRepairResult = 'skipped: non-repairable failures present';
    }
  }

  if (!review.approved) {
    return {
      generation_result:          generationResult,
      publish_result:             `blocked: ${review.recommended_action}`,
      telegram_result:            telegramStatus(),
      command_status:             0,
      current_state:              review.current_state,
      transition_path:            review.transition_path,
      regeneration_attempts:      review.regeneration_attempts,
      review_result:              `failed: ${review.failed_checks.join(', ')}`,
      approval_reason:            review.approval_reason || '',
      publish_gate_result:        review.publish_gate_result,
      authority_repair_attempted: authorityRepairAttempted,
      authority_repair_result:    authorityRepairResult,
      repaired_orphans_count:     repairedOrphansCount,
      repaired_links_count:       repairedLinksCount,
      review_after_repair:        reviewAfterRepair,
      publish_after_repair:       false,
    };
  }

  const publish = publishFn(slug);
  return {
    generation_result:          generationResult,
    publish_result:             publish.status === 0 ? 'published after autonomous approval' : 'publish failed after autonomous approval',
    telegram_result:            telegramStatus(),
    command_status:             publish.status,
    current_state:              review.current_state,
    transition_path:            [...review.transition_path, ...(publish.status === 0 ? ['published'] : [])],
    regeneration_attempts:      review.regeneration_attempts,
    review_result:              'passed',
    approval_reason:            review.approval_reason,
    publish_gate_result:        publish.status === 0 ? 'approved' : 'blocked: publish command failed',
    authority_repair_attempted: authorityRepairAttempted,
    authority_repair_result:    authorityRepairResult,
    repaired_orphans_count:     repairedOrphansCount,
    repaired_links_count:       repairedLinksCount,
    review_after_repair:        reviewAfterRepair || (authorityRepairAttempted ? 'passed' : 'not_attempted'),
    publish_after_repair:       authorityRepairAttempted && publish.status === 0,
  };
}

function blockedExecution(reason, currentState = 'unknown', status = 0) {
  return {
    generation_result: reason,
    publish_result: `blocked: ${reason}`,
    telegram_result: telegramStatus(),
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
  }
  console.log('======================================================');
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
  if (mode === 'status' && requestedType === 'all') return;

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
    quality_score: compactQuality(action.quality_score),
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
  };
  printDecisionReport(report);
  process.exit(execution.command_status);
}

if (require.main === module) main();

module.exports = {
  buildStatus,
  chooseContentType,
  actionFor
};
