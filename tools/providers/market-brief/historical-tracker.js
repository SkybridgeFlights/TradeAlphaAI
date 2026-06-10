'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '../../..');
const REACTIONS_PATH = path.join(ROOT, 'data', 'market-brief', 'historical-reactions.json');
const MAX_ENTRIES    = 500;

function loadReactions() {
  try {
    if (fs.existsSync(REACTIONS_PATH)) {
      return JSON.parse(fs.readFileSync(REACTIONS_PATH, 'utf8'));
    }
  } catch (_) { /* fall through */ }
  return { version: '1.1', updated_at: null, max_entries: MAX_ENTRIES, entries: [] };
}

function saveReactions(data) {
  fs.mkdirSync(path.dirname(REACTIONS_PATH), { recursive: true });
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(REACTIONS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// Append a full reaction entry (produced by record-event-reactions.js).
// entry schema: { date, event_name, country, importance, event_time_utc,
//   forecast, actual, previous, surprise, predicted_biases,
//   market_snapshots, actual_moves, prediction_accuracy,
//   overall_accuracy, recorded_at }
function appendReaction(entry) {
  const data = loadReactions();
  data.entries.unshift(entry);
  if (data.entries.length > MAX_ENTRIES) data.entries = data.entries.slice(0, MAX_ENTRIES);
  saveReactions(data);
  return entry;
}

// Deduplicate key: event_name|date|actual
function reactionKey(entry) {
  return `${entry.event_name}|${entry.date}|${entry.actual}`;
}

// Check if a reaction is already recorded
function hasReaction(date, eventName, actual) {
  const data = loadReactions();
  const key  = `${eventName}|${date}|${actual}`;
  return (data.entries || []).some((e) => reactionKey(e) === key);
}

// Return last N entries matching event name (partial, case-insensitive)
function getHistoricalPattern(eventName, limit) {
  const data = loadReactions();
  const n    = String(eventName).toLowerCase();
  return (data.entries || [])
    .filter((e) => String(e.event_name || '').toLowerCase().includes(n))
    .slice(0, limit || 10);
}

// One-line summary of historical pattern for an event type
function summarizePattern(eventName) {
  const reactions = getHistoricalPattern(eventName, 12);
  if (!reactions.length) return null;

  const withData = reactions.filter((r) => r.surprise?.direction && r.surprise.direction !== 'pending');
  const beats     = withData.filter((r) => r.surprise.direction === 'beat').length;
  const total     = withData.length;
  if (!total) return null;

  const beatPct  = Math.round((beats / total) * 100);
  const avgMag   = withData.reduce((s, r) => s + (r.surprise?.magnitude || 0), 0) / total;
  const withAcc  = reactions.filter((r) => r.overall_accuracy?.composite_score != null);
  const avgAcc   = withAcc.length
    ? Math.round(withAcc.reduce((s, r) => s + r.overall_accuracy.composite_score, 0) / withAcc.length * 100)
    : null;

  const parts = [`${beats}/${total} beats (${beatPct}%)`, `avg deviation ${avgMag.toFixed(1)}%`];
  if (avgAcc !== null) parts.push(`prediction accuracy ${avgAcc}%`);
  return parts.join(', ');
}

module.exports = { appendReaction, hasReaction, getHistoricalPattern, summarizePattern };
