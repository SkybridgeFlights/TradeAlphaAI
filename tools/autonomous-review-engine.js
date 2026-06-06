'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { hasRealSources } = require('./score-autonomous-topic');
const { validateInternalLinks, checkClusterConnectivity, checkAnchorDiversity } = require('./internal-link-intelligence');
const { assessPublicationConfidence } = require('./intelligence/publication-confidence-engine');

const ROOT = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

const PROFILES = {
  editorial: {
    queue: 'data/editorial-topic-queue.json',
    draftDir: 'drafts/editorial',
    scoreType: 'editorial',
    minimum: 90,
    generator: ['tools/generate-ai-editorial-draft.js'],
    overwrite: false,
    hardChecks: [
      'originality',
      'duplication_risk',
      'seo_completeness',
      'readability',
      'arabic_quality',
      'schema_completeness',
      'article_pair_contract',
      'internal_link_resolution',
      'hallucination_risk',
      'educational_compliance',
      'disclaimer_presence',
      'institutional_reasoning_plan',
      'causal_reasoning',
      'evidence_linkage',
      'comparative_analysis',
      'scenario_framing',
      'analytical_density',
      'publication_confidence'
    ]
  },
  'market-outlook': {
    queue: 'data/market-outlook-queue.json',
    draftDir: 'drafts/market-outlook',
    scoreType: 'market_outlook',
    minimum: 96,
    generator: ['tools/generate-market-outlook-draft.js'],
    overwrite: true,
    hardChecks: [
      'language_purity',
      'public_placeholder_risk',
      'semantic_depth',
      'layout_quality',
      'has_directional_bias',
      'has_scenarios',
      'scenario_structure',
      'institutional_density',
      'continuity_depth',
      'cross_asset_relationships',
      'transmission_chains',
      'supported_directional_claims',
      'narrative_originality',
      'specificity',
      'no_generic_filler',
      'economic_event_context',
      'market_expectations_framing',
      'expectation_reaction_logic',
      'probabilistic_language',
      'multi_asset_interaction',
      'macro_causal_reasoning',
      'internal_link_resolution',
      'cluster_connectivity',
    ]
  },
  'news-analysis': {
    queue: 'data/news-analysis-queue.json',
    draftDir: 'drafts/news-analysis',
    scoreType: 'news_analysis',
    minimum: 97,
    generator: ['tools/generate-news-analysis-draft.js'],
    overwrite: false,
    hardChecks: [
      'source_backed',
      'source_citations',
      'no_unsupported_claims',
      'educational_compliance',
      'disclaimer_presence'
    ]
  }
};

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

function argValue(...names) {
  for (const name of names) {
    const prefix = `${name}=`;
    const found = process.argv.find((arg) => arg.startsWith(prefix));
    if (found) return found.slice(prefix.length);
  }
  return '';
}

function toBool(value, fallback = false) {
  if (value === '') return fallback;
  return ['1', 'true', 'yes', 'y'].includes(String(value).trim().toLowerCase());
}

function normalizeType(value) {
  const raw = String(value || 'editorial').trim().toLowerCase().replace(/_/g, '-');
  if (raw === 'market_outlook') return 'market-outlook';
  if (raw === 'news') return 'news-analysis';
  return raw;
}

function queueTopic(contentType, slug) {
  const profile = PROFILES[contentType];
  const queuePath = path.join(ROOT, profile.queue);
  const queue = readJson(queuePath, { topics: [] });
  const topic = (queue.topics || []).find((item) => item.slug === slug);
  return { queuePath, queue, topic };
}

function draftPath(contentType, slug) {
  return path.join(ROOT, PROFILES[contentType].draftDir, slug);
}

function scoreDraft(contentType, slug) {
  if (contentType === 'news-analysis') return scoreNewsDraft(slug);
  const profile = PROFILES[contentType];
  const result = spawnSync(process.execPath, [
    path.join(ROOT, 'tools/score-generated-content.js'),
    `--slug=${slug}`,
    `--type=${profile.scoreType}`
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (result.status !== 0 && !result.stdout) {
    return {
      score: 0,
      failed_checks: ['scorer_failed'],
      checks: {},
      review_summary: (result.stderr || 'score-generated-content failed').trim()
    };
  }
  try {
    const report = JSON.parse(result.stdout);
    const entry = (report.results || []).find((item) => item.slug === slug);
    if (!entry) return { score: 0, failed_checks: ['score_entry_missing'], checks: {}, review_summary: 'No score entry found.' };
    const checks = { ...(entry.checks || {}) };
    if (contentType === 'editorial') Object.assign(checks, editorialPrepublishChecks(slug));
    if (contentType === 'market-outlook') Object.assign(checks, marketOutlookKnowledgeChecks(slug));
    const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
    return {
      score: Number(entry.quality_score || 0),
      failed_checks: failed,
      checks,
      publish_recommendation: entry.publish_recommendation || '',
      review_summary: `Draft scored ${entry.quality_score}/100.`
    };
  } catch (error) {
    return { score: 0, failed_checks: ['score_parse_failed'], checks: {}, review_summary: error.message };
  }
}

function marketOutlookKnowledgeChecks(slug) {
  const dir  = draftPath('market-outlook', slug);
  const en   = readFile(path.join(dir, 'en.html'));
  const ar   = readFile(path.join(dir, 'ar.html'));
  // internal_link_resolution: only external/nav links, never flag expected market-outlook/insights links
  const enLinks = validateInternalLinks(en);
  const arLinks = validateInternalLinks(ar);
  const { queuePath, queue, topic } = queueTopic('market-outlook', slug);
  const clusters = topic ? [topic.topic_cluster, topic.discovery_cluster].filter(Boolean) : [];
  const enConn = checkClusterConnectivity(en, clusters);
  const enDiv  = checkAnchorDiversity(en);
  return {
    internal_link_resolution: enLinks.valid && arLinks.valid,
    cluster_connectivity:     enConn.connected,
    anchor_diversity:         enDiv.diverse,
  };
}

function editorialPrepublishChecks(slug) {
  const dir = draftPath('editorial', slug);
  const en = readFile(path.join(dir, 'en.html'));
  const ar = readFile(path.join(dir, 'ar.html'));
  const requiredEnCanonical = `https://www.tradealphaai.com/insights/${slug}.html`;
  const requiredArCanonical = `https://www.tradealphaai.com/ar/insights/${slug}.html`;
  const confidence = assessPublicationConfidence({ slug, draftDir: dir, write: true });
  return {
    article_pair_contract:
      en.includes(`rel="canonical" href="${requiredEnCanonical}"`) &&
      ar.includes(`rel="canonical" href="${requiredArCanonical}"`) &&
      en.includes('hreflang="ar"') &&
      ar.includes('hreflang="en"') &&
      en.includes('BreadcrumbList') &&
      ar.includes('BreadcrumbList') &&
      en.includes(`data-locale-route="ar" href="/ar/insights/${slug}.html"`) &&
      ar.includes(`data-locale-route="en" href="/insights/${slug}.html"`),
    internal_link_resolution: internalLinksResolve(en) && internalLinksResolve(ar),
    institutional_reasoning_plan: confidence.checks.reasoning_plan_present && confidence.checks.plan_consumed,
    causal_reasoning: confidence.checks.causal_reasoning,
    evidence_linkage: confidence.checks.evidence_linkage,
    comparative_analysis: confidence.checks.comparative_analysis,
    scenario_framing: confidence.checks.scenario_framing,
    analytical_density: confidence.checks.analytical_density,
    publication_confidence: confidence.confidence >= confidence.confidence_threshold && confidence.institutional_depth_passed
  };
}

function internalLinksResolve(html) {
  const hrefs = [...html.matchAll(/\shref="(\/[^"#?]+)"/g)].map((match) => match[1]);
  return hrefs.every((href) => {
    if (/^\/(ar\/)?insights\/[^/]+\.html$/.test(href)) return true;
    if (href === '/' || href === '/ar/') return true;
    const normalized = href.replace(/^\//, '');
    const direct = path.join(ROOT, normalized);
    if (fs.existsSync(direct)) return true;
    if (fs.existsSync(path.join(ROOT, normalized, 'index.html'))) return true;
    return false;
  });
}

function scoreNewsDraft(slug) {
  const dir = draftPath('news-analysis', slug);
  const en = readFile(path.join(dir, 'en.html'));
  const ar = readFile(path.join(dir, 'ar.html'));
  const metadata = readJson(path.join(dir, 'metadata.json'), {});
  const queue = queueTopic('news-analysis', slug);
  const sourceBacked = Boolean(queue.topic && hasRealSources(queue.topic));
  const combined = `${en} ${ar} ${JSON.stringify(metadata)}`;
  const checks = {
    source_backed: sourceBacked,
    source_citations: /(https?:\/\/|source_url|Sources|Source context|official release|filing|report)/i.test(combined),
    no_unsupported_claims: !/(according to unnamed sources|rumored data|fabricated|made-up|fake catalyst|guaranteed|definitely will)/i.test(combined),
    educational_compliance: !/(buy now|sell now|must buy|must sell|price target|guaranteed returns?)/i.test(combined),
    disclaimer_presence: /(educational|informational|not investment advice|not financial advice)/i.test(combined)
  };
  const failed = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  return {
    score: Math.round((Object.keys(checks).length - failed.length) / Object.keys(checks).length * 100),
    failed_checks: failed,
    checks,
    review_summary: `News analysis source-gated review completed with ${failed.length} failed check(s).`
  };
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function hasDraft(contentType, slug) {
  const dir = draftPath(contentType, slug);
  return fs.existsSync(path.join(dir, 'en.html')) && fs.existsSync(path.join(dir, 'ar.html'));
}

function hardGateFailures(contentType, scored) {
  const profile = PROFILES[contentType];
  const checks = scored.checks || {};
  const failed = new Set(scored.failed_checks || []);
  for (const check of profile.hardChecks) {
    if (checks[check] !== true) failed.add(check);
  }
  if (scored.score < profile.minimum) failed.add(`score_below_${profile.minimum}`);
  return Array.from(failed);
}

function approveTopic(contentType, queuePath, queue, topic, scored, dryRun) {
  if (dryRun) return;
  topic.status = 'reviewed';
  topic.review_status = 'approved';
  topic.autonomous_review_status = 'approved';
  topic.autonomous_quality_score = scored.score;
  topic.autonomous_failed_checks = [];
  topic.autonomous_reviewed_at = new Date().toISOString();
  topic.last_reviewed = TODAY;
  const approvalNote = `Autonomous approval: score ${scored.score}/${PROFILES[contentType].minimum}; all hard checks passed.`;
  if (!String(topic.editor_notes || '').includes(approvalNote)) {
    topic.editor_notes = [topic.editor_notes || '', approvalNote].filter(Boolean).join(' ').trim();
  }
  queue.updated = TODAY;
  writeJson(queuePath, queue);
}

function markManualRevision(contentType, queuePath, queue, topic, scored, failedChecks, dryRun) {
  if (dryRun) return;
  topic.status = 'manual_revision_required';
  topic.review_status = 'pending';
  topic.autonomous_review_status = 'manual_revision_required';
  topic.autonomous_quality_score = scored.score;
  topic.autonomous_failed_checks = failedChecks;
  topic.autonomous_reviewed_at = new Date().toISOString();
  topic.editor_notes = [
    topic.editor_notes || '',
    `Autonomous review failed: ${failedChecks.join(', ')}.`
  ].filter(Boolean).join(' ').trim();
  queue.updated = TODAY;
  writeJson(queuePath, queue);
}

function runGenerator(contentType, slug) {
  const profile = PROFILES[contentType];
  const script = path.join(ROOT, profile.generator[0]);
  const args = [];
  if (slug) args.push(`--slug=${slug}`);
  if (profile.overwrite) args.push('--overwrite');
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit'
  });
  return result.status == null ? 1 : result.status;
}

function regenerateIfAllowed(contentType, slug, topic, dryRun) {
  const attempts = Number(topic.autonomous_regeneration_attempts || 0);
  if (attempts >= 2) return { attempted: false, attempts, reason: 'max_regeneration_attempts_reached' };
  if (!PROFILES[contentType].overwrite && hasDraft(contentType, slug)) {
    return { attempted: false, attempts, reason: 'regeneration_not_supported_without_overwrite' };
  }
  if (dryRun) return { attempted: true, attempts: attempts + 1, reason: 'dry_run_regeneration_preview' };
  topic.autonomous_regeneration_attempts = attempts + 1;
  const status = runGenerator(contentType, slug);
  return {
    attempted: true,
    attempts: attempts + 1,
    reason: status === 0 ? 'regeneration_completed' : 'regeneration_failed',
    status
  };
}

function reviewDraft({ contentType, slug, dryRun = false, allowRegeneration = true }) {
  if (!PROFILES[contentType]) throw new Error(`Unsupported content type: ${contentType}`);
  if (!slug) throw new Error('Missing slug for autonomous review.');
  const { queuePath, queue, topic } = queueTopic(contentType, slug);
  if (!topic) {
    return result(false, 0, ['topic_not_found'], 'Topic was not found in queue.', 'stop', 'unknown', [], 0);
  }
  const initialState = topic.review_status === 'approved' ? 'approved' : (topic.status || 'planned');
  const transition = [initialState];

  if (!hasDraft(contentType, slug)) {
    return result(false, 0, ['draft_missing'], 'No bilingual draft exists for review.', 'generate_draft', initialState, transition, Number(topic.autonomous_regeneration_attempts || 0));
  }

  if (!['draft', 'in_review', 'reviewed', 'approved', 'manual_revision_required'].includes(initialState)) {
    transition.push('in_review');
  } else if (initialState !== 'approved') {
    transition.push('in_review');
  }

  let scored = scoreDraft(contentType, slug);
  let failedChecks = hardGateFailures(contentType, scored);
  let regen = { attempted: false, attempts: Number(topic.autonomous_regeneration_attempts || 0), reason: 'not_needed' };

  if (failedChecks.length && allowRegeneration && ['draft', 'in_review', 'reviewed'].includes(topic.status)) {
    regen = regenerateIfAllowed(contentType, slug, topic, dryRun);
    if (regen.attempted && !dryRun && regen.status === 0) {
      scored = scoreDraft(contentType, slug);
      failedChecks = hardGateFailures(contentType, scored);
    }
  }

  if (!failedChecks.length) {
    if (initialState !== 'approved') transition.push('reviewed', 'approved');
    approveTopic(contentType, queuePath, queue, topic, scored, dryRun);
    return result(
      true,
      scored.score,
      [],
      `${contentType} draft approved: score ${scored.score}/${PROFILES[contentType].minimum}; hard checks passed.`,
      'publish',
      initialState,
      unique(transition),
      regen.attempts,
      'institutional thresholds satisfied',
      'approved'
    );
  }

  transition.push('manual_revision_required');
  markManualRevision(contentType, queuePath, queue, topic, scored, failedChecks, dryRun);
  return result(
    false,
    scored.score,
    failedChecks,
    `${contentType} draft failed autonomous review: ${failedChecks.join(', ')}.`,
    'manual_revision_required',
    initialState,
    unique(transition),
    regen.attempts,
    '',
    'blocked'
  );
}

function unique(items) {
  return items.filter((item, index) => item && items.indexOf(item) === index);
}

function result(approved, score, failedChecks, summary, action, currentState, transitionPath, attempts, approvalReason = '', publishGate = 'blocked') {
  return {
    approved,
    score,
    failed_checks: failedChecks,
    review_summary: summary,
    recommended_action: action,
    current_state: currentState,
    transition_path: transitionPath,
    regeneration_attempts: attempts,
    approval_reason: approvalReason,
    publish_gate_result: publishGate
  };
}

function main() {
  const contentType = normalizeType(argValue('--content-type', '--type'));
  const slug = argValue('--slug');
  const dryRun = toBool(argValue('--dry-run', '--dry_run'), false) || process.argv.includes('--dry-run');
  const allowRegeneration = !process.argv.includes('--no-regenerate');
  try {
    const review = reviewDraft({ contentType, slug, dryRun, allowRegeneration });
    console.log(JSON.stringify(review, null, 2));
    process.exit(review.approved ? 0 : 1);
  } catch (error) {
    console.error(JSON.stringify({
      approved: false,
      score: 0,
      failed_checks: ['review_engine_error'],
      review_summary: error.message,
      recommended_action: 'stop'
    }, null, 2));
    process.exit(1);
  }
}

if (require.main === module) main();

// Checks that can be repaired by running the authority repair cycle + draft regeneration.
// Other failures (content quality, source_backed, etc.) require human revision.
const TOPOLOGY_REPAIRABLE_CHECKS = new Set([
  'internal_link_resolution',
  'cluster_connectivity',
  'anchor_diversity',
  'article_pair_contract',
  'orphan_risk',
  'topical_authority',
]);

module.exports = {
  PROFILES,
  reviewDraft,
  hasDraft,
  scoreDraft,
  TOPOLOGY_REPAIRABLE_CHECKS,
};
