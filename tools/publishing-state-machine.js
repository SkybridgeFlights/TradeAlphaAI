'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const HISTORY_PATH = path.join(ROOT, 'data', 'intelligence', 'publishing-state-history.json');
const MAX_HISTORY  = 500;

// All valid states
const STATES = new Set([
  'planned',
  'draft',
  'in_review',
  'reviewed',
  'approved',
  'published',
  'site_update_only',
  'manual_revision_required',
  'blocked',
  'failed',
  'degraded',
]);

// Valid transitions: [from, to]
const VALID_TRANSITIONS = [
  ['planned',                  'draft'],
  ['planned',                  'blocked'],
  ['planned',                  'manual_revision_required'],
  ['draft',                    'in_review'],
  ['draft',                    'manual_revision_required'],
  ['draft',                    'blocked'],
  ['draft',                    'failed'],
  ['in_review',                'reviewed'],
  ['in_review',                'manual_revision_required'],
  ['in_review',                'blocked'],
  ['in_review',                'failed'],
  ['reviewed',                 'approved'],
  ['reviewed',                 'manual_revision_required'],
  ['reviewed',                 'in_review'],
  ['approved',                 'published'],
  ['approved',                 'manual_revision_required'],
  ['approved',                 'blocked'],
  ['published',                'site_update_only'],
  ['blocked',                  'planned'],
  ['blocked',                  'site_update_only'],
  ['blocked',                  'degraded'],
  ['failed',                   'planned'],
  ['failed',                   'degraded'],
  ['manual_revision_required', 'planned'],
  ['manual_revision_required', 'draft'],
  ['manual_revision_required', 'blocked'],
  ['degraded',                 'planned'],
  ['degraded',                 'site_update_only'],
  ['site_update_only',         'planned'],
  // Same-state allowed for idempotent operations
  ['draft',                    'draft'],
  ['in_review',                'in_review'],
  ['planned',                  'planned'],
];

const TRANSITION_SET = new Set(VALID_TRANSITIONS.map(([f, t]) => `${f}→${t}`));

function isValidTransition(from, to) {
  return TRANSITION_SET.has(`${from}→${to}`);
}

function readHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return { transitions: [] };
  try { return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); }
  catch { return { transitions: [] }; }
}

function writeHistory(history) {
  const dir = path.dirname(HISTORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n', 'utf8');
}

/**
 * Record a state transition.
 * Returns { ok, error, entry } — throws only on invalid transition.
 */
function recordTransition({ from, to, content_type, slug, reason, actor = 'autonomous-brain', run_id = '' }) {
  if (!STATES.has(from)) throw new Error(`[state-machine] Unknown from-state: ${from}`);
  if (!STATES.has(to))   throw new Error(`[state-machine] Unknown to-state: ${to}`);
  if (!isValidTransition(from, to)) {
    throw new Error(`[state-machine] Invalid transition ${from} → ${to} for ${content_type}/${slug}`);
  }

  const entry = {
    from,
    to,
    content_type: content_type || 'unknown',
    slug:          slug        || '',
    reason:        reason      || '',
    timestamp:     new Date().toISOString(),
    actor,
    run_id,
  };

  const history = readHistory();
  history.transitions = history.transitions || [];
  history.transitions.push(entry);
  if (history.transitions.length > MAX_HISTORY) {
    history.transitions = history.transitions.slice(-MAX_HISTORY);
  }
  history.updated = entry.timestamp;
  writeHistory(history);

  console.log(`[state-machine] ${content_type}/${slug}: ${from} → ${to} (${reason})`);
  return { ok: true, entry };
}

/**
 * Try a transition; return { ok, error } without throwing.
 */
function tryTransition(params) {
  try {
    return recordTransition(params);
  } catch (err) {
    console.error(`[state-machine] ERROR: ${err.message}`);
    return { ok: false, error: err.message };
  }
}

/** Get last N transitions from history. */
function getRecentTransitions(n = 20) {
  const history = readHistory();
  const all = history.transitions || [];
  return all.slice(-n);
}

/** Get all transitions for a given slug. */
function getSlugHistory(slug) {
  const history = readHistory();
  return (history.transitions || []).filter(t => t.slug === slug);
}

/** Get last known state for a slug. */
function lastKnownState(slug) {
  const entries = getSlugHistory(slug);
  return entries.length > 0 ? entries[entries.length - 1].to : null;
}

module.exports = {
  STATES,
  VALID_TRANSITIONS,
  isValidTransition,
  recordTransition,
  tryTransition,
  getRecentTransitions,
  getSlugHistory,
  lastKnownState,
};

// CLI: node tools/publishing-state-machine.js --status
if (require.main === module) {
  const arg = process.argv[2] || '--status';
  if (arg === '--status') {
    const recent = getRecentTransitions(20);
    console.log('[state-machine] Last 20 transitions:');
    recent.forEach(t => console.log(`  ${t.timestamp.slice(0,19)} ${t.content_type}/${t.slug}: ${t.from} → ${t.to} (${t.reason})`));
  } else if (arg === '--validate') {
    console.log(`[state-machine] ${STATES.size} states, ${VALID_TRANSITIONS.length} valid transitions defined.`);
  }
}
