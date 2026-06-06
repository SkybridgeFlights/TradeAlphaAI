'use strict';

// Phase 60.2: Post-Event Market Reaction Engine
// Reads released economic events from the calendar, fetches actual day-of price
// changes for key assets (SPY, QQQ, GLD, TLT, UUP, IWM) via FMP historical API,
// computes surprise × reaction pairs, and maintains rolling historical pattern
// memory by event type (CPI, NFP, FOMC, etc.).
//
// Output: data/intelligence/event-reaction-memory.json
//
// Usage:
//   node tools/build-event-reaction-memory.js          → dry run (print JSON)
//   node tools/build-event-reaction-memory.js --write  → write output file

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { analyzeEconomicSurprise } = require('./analyze-economic-surprise');

const ROOT    = path.resolve(__dirname, '..');
const CAL_PATH  = path.join(ROOT, 'data', 'economic-calendar.json');
const OUT_PATH  = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const CACHE_DIR = path.join(ROOT, 'data', 'cache', 'market-data');

const WRITE = process.argv.includes('--write');
const MAX_ENTRIES = 180; // rolling 6-month window at ~30 events/month

// Assets to monitor for each event — FMP-compatible ticker symbols
const REACTION_ASSETS = [
  { symbol: 'SPY',  label: 'SPY',  category: 'equities' },
  { symbol: 'QQQ',  label: 'QQQ',  category: 'equities' },
  { symbol: 'IWM',  label: 'IWM',  category: 'equities' },
  { symbol: 'GLD',  label: 'Gold', category: 'commodities' },
  { symbol: 'TLT',  label: 'TLT',  category: 'rates' },
  { symbol: 'UUP',  label: 'DXY',  category: 'fx' },
  { symbol: 'VIXY', label: 'VIX',  category: 'volatility' },
  { symbol: 'USO',  label: 'Oil',  category: 'commodities' },
];

// Minimum |surprise_score| to qualify as a material surprise worth recording
const MATERIAL_THRESHOLD = 5;

async function main() {
  const apiKey = (process.env.FMP_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[reaction-memory] FMP_API_KEY not set — reactions will be recorded without price data.');
  }

  const calendar = readJson(CAL_PATH, { events: [] });
  const releasedEvents = (calendar.events || []).filter(isReleased);
  console.log(`[reaction-memory] ${releasedEvents.length} released event(s) in calendar`);

  const existing = readJson(OUT_PATH, { version: '1.0', updated_at: null, event_reactions: [], historical_patterns: {} });
  const existingIds = new Set((existing.event_reactions || []).map((e) => e.event_id));

  const newEntries = [];
  for (const event of releasedEvents) {
    if (existingIds.has(event.id)) continue; // already recorded
    const surprise = analyzeEconomicSurprise(event);
    const reactions = apiKey ? await fetchDayReactions(event, apiKey) : {};
    const entry = buildEntry(event, surprise, reactions);
    newEntries.push(entry);
    console.log(`[reaction-memory] recorded: ${event.event_name} (${event.date}) surprise=${surprise.surprise_score} dir=${surprise.surprise_direction}`);
  }

  // Merge + trim to MAX_ENTRIES (oldest first → keep most recent)
  const merged = [...(existing.event_reactions || []), ...newEntries];
  const trimmed = merged.slice(-MAX_ENTRIES);

  const patterns = buildHistoricalPatterns(trimmed);

  const output = {
    version: '1.0',
    updated_at: new Date().toISOString(),
    event_count: trimmed.length,
    event_reactions: trimmed,
    historical_patterns: patterns
  };

  if (!WRITE) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[reaction-memory] wrote ${trimmed.length} event(s) to data/intelligence/event-reaction-memory.json`);
}

function isReleased(event) {
  return event.status === 'released'
    && event.actual !== null && event.actual !== undefined
    && event.forecast !== null && event.forecast !== undefined;
}

function buildEntry(event, surprise, reactions) {
  const surpriseValue = (event.actual !== null && event.forecast !== null)
    ? parseFloat((event.actual - event.forecast).toFixed(4))
    : null;
  return {
    event_id: event.id,
    event_name: event.event_name || event.name,
    event_type: event.type,
    event_date: event.date,
    country: event.country || 'US',
    actual: event.actual,
    forecast: event.forecast,
    previous: event.previous,
    surprise_value: surpriseValue,
    surprise_score: surprise.surprise_score,
    surprise_direction: surprise.surprise_direction,
    surprise_strength: strengthLabel(surprise.surprise_score),
    policy_tone: surprise.policy_tone,
    reaction_interpretation: surprise.reaction_interpretation,
    reactions,
    reaction_quality: Object.keys(reactions).length > 0 ? 'observed' : 'no_price_data',
    recorded_at: new Date().toISOString()
  };
}

function strengthLabel(score) {
  if (score === null) return 'unknown';
  const abs = Math.abs(score);
  if (abs < MATERIAL_THRESHOLD) return 'within_consensus';
  if (abs < 20) return 'moderate';
  if (abs < 50) return 'strong';
  return 'extreme';
}

// ── Price reaction fetcher ────────────────────────────────────────────────────

async function fetchDayReactions(event, apiKey) {
  const eventDate = event.date; // YYYY-MM-DD
  // Fetch one trading day before and two days after to get reliable pre/post
  const fromDate = dateOffset(eventDate, -3);
  const toDate   = dateOffset(eventDate, 2);

  const reactions = {};
  for (const asset of REACTION_ASSETS) {
    const cacheKey = `price-${asset.symbol}-${fromDate}-${toDate}`;
    let history = readPriceCache(cacheKey);
    if (!history) {
      try {
        history = await fetchFmpHistory(asset.symbol, fromDate, toDate, apiKey);
        writePriceCache(cacheKey, history);
      } catch (err) {
        console.warn(`[reaction-memory]   ${asset.symbol}: ${err.message}`);
        continue;
      }
    }
    const reaction = computeDayReaction(history, eventDate);
    if (reaction !== null) {
      reactions[asset.label] = { ...reaction, symbol: asset.symbol };
    }
  }
  return reactions;
}

function computeDayReaction(history, eventDate) {
  // history = array of { date: 'YYYY-MM-DD', close: number } sorted newest-first
  if (!Array.isArray(history) || history.length < 2) return null;

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const eventIdx = sorted.findIndex((d) => d.date >= eventDate);
  if (eventIdx < 1) return null;

  const before = sorted[eventIdx - 1];
  const onDay  = sorted[eventIdx];
  if (!before || !onDay || !before.close || !onDay.close) return null;

  const pct1d = parseFloat(((onDay.close - before.close) / before.close * 100).toFixed(3));
  return {
    close_before: before.close,
    close_event_day: onDay.close,
    pct_1d: pct1d,
    abs_move: parseFloat((onDay.close - before.close).toFixed(4)),
    window: '1d',
    direction: pct1d > 0 ? 'up' : pct1d < 0 ? 'down' : 'flat'
  };
}

async function fetchFmpHistory(symbol, from, to, apiKey) {
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${encodeURIComponent(symbol)}?from=${from}&to=${to}&apikey=${apiKey}`;
  const raw = await httpGet(url);
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.historical)) return [];
  return parsed.historical.map((item) => ({ date: item.date, close: item.close, open: item.open, high: item.high, low: item.low, volume: item.volume }));
}

// ── Historical pattern builder ────────────────────────────────────────────────

function buildHistoricalPatterns(entries) {
  const byType = {};
  for (const entry of entries) {
    const type = entry.event_type;
    if (!type) continue;
    if (!byType[type]) byType[type] = { hotter: [], softer: [], neutral: [] };
    const dir = entry.surprise_direction;
    if (dir === 'hotter_or_stronger') byType[type].hotter.push(entry);
    else if (dir === 'softer_or_weaker') byType[type].softer.push(entry);
    else byType[type].neutral.push(entry);
  }

  const patterns = {};
  for (const [type, groups] of Object.entries(byType)) {
    patterns[type] = {
      total_events: groups.hotter.length + groups.softer.length + groups.neutral.length,
      hotter_than_expected: summarizeGroup(groups.hotter),
      softer_than_expected: summarizeGroup(groups.softer),
      near_consensus: summarizeGroup(groups.neutral),
      generated_at: new Date().toISOString()
    };
  }
  return patterns;
}

function summarizeGroup(entries) {
  if (!entries.length) return { count: 0 };
  const assetLabels = REACTION_ASSETS.map((a) => a.label);
  const avgs = {};

  for (const label of assetLabels) {
    const moves = entries.map((e) => e.reactions?.[label]?.pct_1d).filter(Number.isFinite);
    if (!moves.length) continue;
    const avg = moves.reduce((a, b) => a + b, 0) / moves.length;
    const positive = moves.filter((m) => m > 0).length;
    avgs[label] = {
      avg_1d_pct: parseFloat(avg.toFixed(3)),
      sample_size: moves.length,
      positive_rate: parseFloat((positive / moves.length).toFixed(2)),
      consistency: consistencyLabel(positive / moves.length, moves.length)
    };
  }

  return {
    count: entries.length,
    asset_reactions: avgs,
    most_recent: entries[entries.length - 1]?.event_date || null
  };
}

function consistencyLabel(positiveRate, n) {
  if (n < 3) return 'insufficient_data';
  if (positiveRate >= 0.75) return 'consistently_positive';
  if (positiveRate >= 0.6)  return 'moderately_positive';
  if (positiveRate <= 0.25) return 'consistently_negative';
  if (positiveRate <= 0.4)  return 'moderately_negative';
  return 'mixed';
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

function readPriceCache(key) {
  const file = path.join(CACHE_DIR, `${key}.json`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writePriceCache(key, data) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, `${key}.json`);
  fs.writeFileSync(file, JSON.stringify(data) + '\n', 'utf8');
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); res.resume(); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
  });
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function dateOffset(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ── JSON helper ───────────────────────────────────────────────────────────────

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main().catch((err) => {
  console.error('[reaction-memory] Fatal:', err.message);
  process.exit(1);
});
