'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '../../..');
const REACTIONS_PATH = path.join(ROOT, 'data', 'market-brief', 'historical-reactions.json');
const MAX_ENTRIES   = 500;

function loadReactions() {
  try {
    if (fs.existsSync(REACTIONS_PATH)) {
      return JSON.parse(fs.readFileSync(REACTIONS_PATH, 'utf8'));
    }
  } catch (_) { /* fall through */ }
  return { version: '1.0', updated_at: null, max_entries: MAX_ENTRIES, entries: [] };
}

function saveReactions(data) {
  fs.mkdirSync(path.dirname(REACTIONS_PATH), { recursive: true });
  fs.writeFileSync(REACTIONS_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// assetMoves: { gold_pct, usd_pct, sp500_pct, nasdaq_pct } — pass null values for unavailable
function appendReaction(date, event, scored, assetMoves) {
  const data = loadReactions();

  const entry = {
    date: date || new Date().toISOString().slice(0, 10),
    event_name: event.event_name,
    country: event.country,
    importance: event.importance,
    forecast: event.forecast,
    actual: event.actual,
    previous: event.previous,
    surprise: {
      direction: scored.direction,
      magnitude: scored.magnitude,
      score: scored.score,
      label: scored.label,
    },
    asset_moves: {
      gold_pct:   assetMoves?.gold_pct   ?? null,
      usd_pct:    assetMoves?.usd_pct    ?? null,
      sp500_pct:  assetMoves?.sp500_pct  ?? null,
      nasdaq_pct: assetMoves?.nasdaq_pct ?? null,
    },
    recorded_at: new Date().toISOString(),
  };

  data.entries.unshift(entry);
  if (data.entries.length > MAX_ENTRIES) data.entries = data.entries.slice(0, MAX_ENTRIES);
  data.updated_at = new Date().toISOString();

  saveReactions(data);
  return entry;
}

// Returns last N reactions for an event name (case-insensitive partial match)
function getHistoricalPattern(eventName, limit) {
  const data = loadReactions();
  const n    = String(eventName).toLowerCase();
  const matched = data.entries.filter((e) =>
    String(e.event_name || '').toLowerCase().includes(n)
  );
  const cap = limit || 10;
  return matched.slice(0, cap);
}

// Returns a short summary string of historical pattern for an event
function summarizePattern(eventName) {
  const reactions = getHistoricalPattern(eventName, 10);
  if (!reactions.length) return null;

  const beats = reactions.filter((r) => r.surprise.direction === 'beat').length;
  const misses = reactions.filter((r) => r.surprise.direction === 'miss').length;
  const total  = beats + misses;
  if (!total) return null;

  const beatPct = Math.round((beats / total) * 100);
  const avgMag  = reactions.reduce((s, r) => s + (r.surprise.magnitude || 0), 0) / reactions.length;

  return `${beats}/${total} beats (${beatPct}%), avg deviation ${avgMag.toFixed(1)}%`;
}

module.exports = { appendReaction, getHistoricalPattern, summarizePattern };
