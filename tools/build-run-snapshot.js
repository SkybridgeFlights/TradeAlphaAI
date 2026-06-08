'use strict';

const fs           = require('fs');
const path         = require('path');
const { spawnSync } = require('child_process');

const ROOT     = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'run-snapshot.json');

function readJson(p, fallback = {}) {
  if (!fs.existsSync(p)) return fallback;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return { ...fallback, _parse_error: true }; }
}

function getGitSha() {
  try {
    const r = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
    return (r.stdout || '').trim() || null;
  } catch { return null; }
}

function queueState(queuePath) {
  const q = readJson(path.join(ROOT, queuePath), { topics: [] });
  const topics = q.topics || [];
  const byStatus = {};
  for (const t of topics) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; }
  const publishable = topics.filter(t => ['reviewed', 'approved'].includes(t.status));
  const drafts      = topics.filter(t => ['draft', 'in_review'].includes(t.status));
  const planned     = topics.filter(t => t.status === 'planned');
  return {
    queue_path: queuePath,
    total: topics.length,
    by_status: byStatus,
    publishable_count: publishable.length,
    publishable_slugs: publishable.map(t => t.slug),
    draft_count: drafts.length,
    draft_slugs: drafts.map(t => t.slug),
    planned_count: planned.length,
    updated: q.updated || null,
  };
}

function ciQueueState() {
  const q = readJson(path.join(ROOT, 'data', 'continuous-intelligence-queue.json'), { topics: [] });
  const topics = q.topics || [];
  const byStatus = {};
  for (const t of topics) { byStatus[t.status] = (byStatus[t.status] || 0) + 1; }
  const candidates = topics.filter(t => ['planned', 'queued', 'draft', 'in_review'].includes(t.status));
  return {
    queue_path: 'data/continuous-intelligence-queue.json',
    total: topics.length,
    by_status: byStatus,
    signal_count: q.last_signal_count || 0,
    candidates: candidates.map(t => ({ slug: t.slug, family: t.family, confidence: t.confidence, status: t.status })),
    updated: q.updated || null,
  };
}

function cooldownBlockers() {
  const blockers = [];
  const today = new Date().toISOString().slice(0, 10);

  // Market-outlook cooldown check
  const moHistory = readJson(path.join(ROOT, 'data', 'market-outlook-history.json'), { entries: [] });
  const moEntries = moHistory.entries || [];
  if (moEntries.length > 0) {
    const last = moEntries[moEntries.length - 1];
    const lastDate = String(last.published_at || last.date || '').slice(0, 10);
    if (lastDate === today) {
      blockers.push({ type: 'market-outlook', reason: 'published today', last_date: lastDate });
    }
  }

  // Editorial cooldown check (published-history)
  const pubHistory = readJson(path.join(ROOT, 'data', 'published-history.json'), { entries: [] });
  const editEntries = (pubHistory.entries || []).filter(e => e.content_type === 'editorial' || !e.content_type);
  if (editEntries.length > 0) {
    const last = editEntries[editEntries.length - 1];
    const lastDate = String(last.published_at || last.date || '').slice(0, 10);
    if (lastDate === today) {
      blockers.push({ type: 'editorial', reason: 'published today', last_date: lastDate });
    }
  }

  return blockers;
}

function providerHealth() {
  const ph = readJson(path.join(ROOT, 'data', 'provider-health.json'), { providers: {} });
  const providers = ph.providers || {};
  const summary = {};
  for (const [name, state] of Object.entries(providers)) {
    summary[name] = state.status || 'unknown';
  }
  return summary;
}

function intelligenceHealth() {
  const h = readJson(path.join(ROOT, 'data', 'system-status', 'intelligence-health.json'), {});
  return {
    status: h.status || 'unknown',
    severity: h.severity || 'UNKNOWN',
    issue_count: Object.values(h.issues_by_severity || {}).reduce((a, b) => a + b, 0),
  };
}

function runtimeHealth() {
  const rh = readJson(path.join(ROOT, 'runtime', 'runtime-health.json'), {});
  if (!rh.timestamp) return null;
  return {
    status: rh.overall_status || 'unknown',
    healthy_count: rh.healthy_count || 0,
    degraded_count: rh.degraded_count || 0,
    failed_count: rh.failed_count || 0,
    timestamp: rh.timestamp,
  };
}

function buildSnapshot({ mode, content_type, run_id, route_scores, candidates } = {}) {
  const snapshot = {
    run_id:        run_id || `run-${Date.now()}`,
    timestamp:     new Date().toISOString(),
    today:         new Date().toISOString().slice(0, 10),
    git_sha:       getGitSha(),
    mode:          mode        || process.env.MODE         || 'unknown',
    content_type:  content_type|| process.env.CONTENT_TYPE || 'unknown',
    queues: {
      editorial:              queueState('data/editorial-topic-queue.json'),
      market_outlook:         queueState('data/market-outlook-queue.json'),
      news_analysis:          queueState('data/news-analysis-queue.json'),
      continuous_intelligence: ciQueueState(),
    },
    route_scores:        route_scores || null,
    available_candidates: candidates  || null,
    cooldown_blockers:   cooldownBlockers(),
    quality_blockers:    intelligenceHealth().severity === 'CRITICAL' ? ['intelligence_health_critical'] : [],
    provider_health:     providerHealth(),
    intelligence_health: intelligenceHealth(),
    runtime_health:      runtimeHealth(),
  };

  const dir = path.dirname(OUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
  console.log(`[run-snapshot] Written → data/intelligence/run-snapshot.json (run_id=${snapshot.run_id})`);
  return snapshot;
}

module.exports = { buildSnapshot };

if (require.main === module) {
  buildSnapshot({ mode: process.argv[2] || 'status', content_type: process.argv[3] || 'all' });
}
