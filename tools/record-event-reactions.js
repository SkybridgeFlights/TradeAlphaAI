'use strict';

// Records post-event market reactions to historical-reactions.json.
// Run at end of trading day (after 22:00 UTC / 6pm ET) once market data for 1h windows is available.
//
// For each released event today:
//   1. Checks if already recorded (dedup)
//   2. Fetches 1m candles from Finnhub (GLD, UUP, SPY, QQQ) for ±90min window
//   3. Extracts prices at: pre(-5m), +1m, +5m, +15m, +1h
//   4. Computes percentage moves
//   5. Evaluates predicted bias accuracy (from today's brief)
//   6. Appends to data/market-brief/historical-reactions.json
//
// Requires: FINNHUB_API_KEY (optional — stores structural record without prices if absent)
// Usage: node tools/record-event-reactions.js [--date=YYYY-MM-DD] [--write] [--dry-run]

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const { scoreEvent }                = require('./providers/market-brief/surprise-scorer');
const { evaluateAll, compositeScore, overallLabel } = require('./providers/market-brief/prediction-evaluator');
const { appendReaction, hasReaction } = require('./providers/market-brief/historical-tracker');

const ROOT           = path.resolve(__dirname, '..');
const CALENDAR_PATH  = path.join(ROOT, 'data', 'economic-calendar.json');
const BRIEF_DIR      = path.join(ROOT, 'data', 'market-brief');

const dateArg    = argValue('--date');
const doWrite    = process.argv.includes('--write');
const dryRun     = process.argv.includes('--dry-run');
const targetDate = dateArg || new Date().toISOString().slice(0, 10);

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';

// ETF proxies (Finnhub symbols, US market)
const ASSET_SYMBOLS = {
  gold:   'GLD',   // SPDR Gold Shares
  usd:    'UUP',   // USD Bull ETF (tracks DXY)
  spy:    'SPY',   // SPDR S&P 500 ETF
  nasdaq: 'QQQ',   // Invesco Nasdaq 100 ETF
};

// Importance threshold: only record medium+ US events
const RECORD_COUNTRIES  = new Set(['US']);
const RECORD_IMPORTANCE = new Set(['high', 'medium']);

main().catch((err) => { console.error('[reactions] Fatal:', err.message); process.exit(1); });

async function main() {
  console.log(`[reactions] Recording event reactions for ${targetDate}`);

  const calendar = readJson(CALENDAR_PATH, { events: [] });
  const events = (calendar.events || [])
    .filter((e) => (e.event_time || '').slice(0, 10) === targetDate)
    .filter((e) => e.actual !== null && e.actual !== undefined && e.actual !== '')
    .filter((e) => RECORD_COUNTRIES.has(e.country))
    .filter((e) => RECORD_IMPORTANCE.has(e.importance));

  console.log(`[reactions] ${events.length} eligible released events for ${targetDate}`);
  if (!events.length) { console.log('[reactions] Nothing to record.'); return; }

  // Load predicted biases from today's brief
  const brief          = loadBrief(targetDate);
  const predictedBiases = brief?.directional_biases || null;
  if (!predictedBiases) console.log('[reactions] No brief found for today — storing without bias comparison');

  // Pre-fetch candle data per asset once (covers full day; reuse across events)
  let candleCache = {};
  if (FINNHUB_KEY && !dryRun) {
    console.log('[reactions] Pre-fetching candle data from Finnhub...');
    const dayStart = new Date(`${targetDate}T12:00:00Z`); // 8am ET
    const dayEnd   = new Date(`${targetDate}T22:00:00Z`); // 6pm ET
    for (const [asset, symbol] of Object.entries(ASSET_SYMBOLS)) {
      try {
        const candles = await fetchCandles(symbol, dayStart, dayEnd);
        if (candles.length) {
          candleCache[asset] = candles;
          console.log(`[reactions] ${symbol}: ${candles.length} 1m bars`);
        }
      } catch (err) {
        console.warn(`[reactions] Candle fetch failed for ${symbol}: ${err.message}`);
      }
      await wait(300); // rate limit: ~3 per second within free 60/min
    }
  } else {
    if (!FINNHUB_KEY) console.log('[reactions] FINNHUB_API_KEY not set — structural records only');
    if (dryRun)       console.log('[reactions] Dry-run: no API calls');
  }

  let recorded = 0;
  let skipped  = 0;

  for (const event of events) {
    // Dedup
    if (hasReaction(targetDate, event.event_name, event.actual)) {
      console.log(`[reactions] Skip (already recorded): ${event.event_name}`);
      skipped++;
      continue;
    }

    const eventTime = new Date(event.event_time);
    if (isNaN(eventTime.getTime())) {
      console.warn(`[reactions] Invalid event_time for ${event.event_name}`);
      continue;
    }

    console.log(`[reactions] Processing: ${event.event_name} at ${event.event_time}`);

    // Extract market snapshots from candle cache
    const snapshots  = extractSnapshots(candleCache, eventTime);
    const actualMoves = computeMoves(snapshots);

    // Score surprise
    const scored = scoreEvent(event);

    // Evaluate prediction accuracy
    let predictionAccuracy = null;
    let overallAccuracy    = null;
    const hasMoves = Object.keys(actualMoves).length > 0;

    if (predictedBiases && hasMoves) {
      predictionAccuracy = evaluateAll(predictedBiases, actualMoves);
      const cs = compositeScore(predictionAccuracy);
      overallAccuracy = {
        composite_score: cs,
        label:           overallLabel(cs),
      };
    }

    const entry = {
      date:            targetDate,
      event_name:      event.event_name,
      country:         event.country,
      importance:      event.importance,
      event_time_utc:  event.event_time,
      forecast:        event.forecast,
      actual:          event.actual,
      previous:        event.previous,
      surprise: {
        direction: scored.direction,
        magnitude: scored.magnitude,
        score:     scored.score,
        label:     scored.label,
      },
      predicted_biases: predictedBiases ? {
        gold:   { direction: predictedBiases.gold?.direction,   strength: predictedBiases.gold?.strength },
        usd:    { direction: predictedBiases.usd?.direction,    strength: predictedBiases.usd?.strength },
        spy:    { direction: predictedBiases.spy?.direction,    strength: predictedBiases.spy?.strength },
        nasdaq: { direction: predictedBiases.nasdaq?.direction, strength: predictedBiases.nasdaq?.strength },
      } : null,
      market_snapshots: hasMoves ? snapshots : null,
      actual_moves:     hasMoves ? actualMoves : null,
      prediction_accuracy: predictionAccuracy,
      overall_accuracy:    overallAccuracy,
      recorded_at: new Date().toISOString(),
    };

    if (doWrite && !dryRun) {
      appendReaction(entry);
      console.log(`[reactions] Recorded: ${event.event_name} — surprise: ${scored.label}, accuracy: ${overallAccuracy?.label || 'pending'}`);
      recorded++;
    } else {
      console.log(`[reactions] [DRY-RUN] Would record: ${event.event_name}`);
      if (process.env.DEBUG) console.log(JSON.stringify(entry, null, 2));
    }
  }

  console.log(`[reactions] Done. recorded=${recorded} skipped=${skipped}`);
}

// ── Candle extraction ─────────────────────────────────────────────────────────

const WINDOWS = { pre: -5, '1m': 1, '5m': 5, '15m': 15, '1h': 60 };

function extractSnapshots(candleCache, eventTime) {
  const snapshots = {};
  for (const [window, offsetMin] of Object.entries(WINDOWS)) {
    const targetMs = eventTime.getTime() + offsetMin * 60000;
    const snap     = {};
    for (const [asset, candles] of Object.entries(candleCache)) {
      const price = closestClose(candles, targetMs);
      if (price !== null) snap[asset] = price;
    }
    if (Object.keys(snap).length) snapshots[window] = snap;
  }
  return snapshots;
}

function computeMoves(snapshots) {
  const pre = snapshots.pre;
  if (!pre) return {};
  const moves = {};
  for (const [window, snap] of Object.entries(snapshots)) {
    if (window === 'pre') continue;
    const windowMoves = {};
    for (const [asset, price] of Object.entries(snap)) {
      const prePrice = pre[asset];
      if (prePrice && prePrice > 0) {
        windowMoves[`${asset}_pct`] = Math.round((price - prePrice) / prePrice * 10000) / 100;
      }
    }
    if (Object.keys(windowMoves).length) moves[window] = windowMoves;
  }
  return moves;
}

// Find the candle close closest to targetMs (within 90 seconds)
function closestClose(candles, targetMs) {
  let best = null;
  let bestDiff = Infinity;
  for (const c of candles) {
    const diff = Math.abs(c.t - targetMs);
    if (diff < bestDiff && diff < 90000) { // within 90s
      bestDiff = diff;
      best = c.close;
    }
  }
  return best;
}

// ── Finnhub candle fetch ──────────────────────────────────────────────────────

function fetchCandles(symbol, fromDate, toDate) {
  const from = Math.floor(fromDate.getTime() / 1000);
  const to   = Math.ceil(toDate.getTime() / 1000);
  const url  = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=1&from=${from}&to=${to}&token=${FINNHUB_KEY}`;

  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 15000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch (e) { return reject(new Error('Non-JSON candle response')); }

        if (data.s === 'no_data') return resolve([]);
        if (!Array.isArray(data.c) || !Array.isArray(data.t)) {
          return reject(new Error(`Unexpected candle response: ${JSON.stringify(data).slice(0, 80)}`));
        }
        const candles = data.t.map((ts, i) => ({
          t:     ts * 1000, // convert to ms
          close: data.c[i],
          open:  data.o[i],
          high:  data.h[i],
          low:   data.l[i],
        }));
        resolve(candles);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Finnhub candle timeout')); });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadBrief(date) {
  const p1 = path.join(BRIEF_DIR, `daily-brief-${date}.json`);
  const p2 = path.join(BRIEF_DIR, 'latest-brief.json');
  if (fs.existsSync(p1)) return readJson(p1);
  if (fs.existsSync(p2)) {
    const b = readJson(p2);
    return b?.date === date ? b : null;
  }
  return null;
}

function readJson(p, fallback = {}) {
  try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; }
  catch (_) { return fallback; }
}

function argValue(name) {
  const m = process.argv.find((a) => a.startsWith(name + '='));
  return m ? m.slice(name.length + 1) : '';
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }
