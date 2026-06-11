'use strict';

// Phase 71 — Live Newswire Engine (data layer).
// Derives Reuters-style wire events exclusively from the platform's sourced
// data, in line with the news policy ("platform_market_data" and official
// release types only — no fabricated, inferred, or AI-asserted news):
//
//   1. Economic calendar releases (actual vs forecast → surprise wire)
//   2. Upcoming high-impact catalysts (scheduled-event wire)
//   3. Significant sourced market moves from live-market-state.json
//
// Every wire item carries: urgency score, market impact score, sector/asset
// tags, cluster key, timestamp, and source attribution. Duplicate suppression
// is id-based; stale suppression drops items older than STALE_HOURS.
//
// Output: data/newswire/wire-events.json
// Usage:  node tools/build-newswire-events.js --write

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'newswire', 'wire-events.json');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const LIVE_PATH = path.join(ROOT, 'data', 'live-market-state.json');

const STALE_HOURS = 48;
const NOW = Date.now();

function readJson(p, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function hoursAgo(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (NOW - t) / 3600000 : Infinity;
}

function clusterFor(name) {
  const n = String(name || '').toLowerCase();
  if (/cpi|pce|ppi|inflation/.test(n)) return 'inflation';
  if (/payroll|jobless|unemployment|nfp|labor/.test(n)) return 'labor';
  if (/fomc|fed|rate decision|powell/.test(n)) return 'fed';
  if (/gdp|retail sales|ism|pmi|industrial/.test(n)) return 'growth';
  if (/treasury|auction|yield/.test(n)) return 'rates';
  return 'macro';
}

const ASSET_SECTORS = {
  sp500: { symbol: 'SPY', sector: 'broad-market' },
  nasdaq: { symbol: 'QQQ', sector: 'technology' },
  russell2000: { symbol: 'IWM', sector: 'small-cap' },
  vix: { symbol: 'VIX', sector: 'volatility' },
  dxy: { symbol: 'DXY', sector: 'currency' },
  gold: { symbol: 'GLD', sector: 'metals' },
  bitcoin: { symbol: 'BTC', sector: 'crypto' },
  nvda: { symbol: 'NVDA', sector: 'ai-semiconductors' },
  tlt: { symbol: 'TLT', sector: 'rates' },
  us10y_yield: { symbol: 'US10Y', sector: 'rates' },
};

function moveUrgency(absPct, symbol) {
  // VIX and BTC move more; calibrate thresholds per asset class.
  const big = symbol === 'VIX' ? 12 : symbol === 'BTC' ? 6 : 3;
  const notable = symbol === 'VIX' ? 7 : symbol === 'BTC' ? 4 : 1.8;
  if (absPct >= big) return 90;
  if (absPct >= notable) return 65;
  return 0; // below wire threshold
}

function fmtPct(pct) {
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function calendarWireEvents(calendar) {
  const items = [];
  for (const event of calendar.events || []) {
    const name = event.event_name || event.name || 'Economic release';
    const time = event.event_time || `${event.date}T00:00:00Z`;
    const importance = String(event.importance || event.impact_level || 'medium').toLowerCase();
    const released = event.actual !== null && event.actual !== undefined;
    const age = hoursAgo(time);

    if (released && age <= STALE_HOURS) {
      const surprise = (event.forecast !== null && event.forecast !== undefined)
        ? `${event.actual} vs ${event.forecast} expected`
        : `${event.actual}${event.previous !== null && event.previous !== undefined ? ` (prior ${event.previous})` : ''}`;
      items.push({
        id: `release::${event.id || `${name}-${event.date}`}`,
        kind: 'economic_release',
        headline: `${name}: ${surprise}`,
        urgency: importance === 'high' ? 90 : importance === 'medium' ? 60 : 35,
        market_impact: importance === 'high' ? 85 : 50,
        cluster: clusterFor(name),
        asset_tags: event.historical_asset_sensitivity || [],
        sector_tags: [clusterFor(name)],
        timestamp: time,
        source: event.provider || event.source || 'economic-calendar',
        attribution: 'official economic release via platform calendar providers',
      });
    } else if (!released && age >= -36 && age <= 0 && importance === 'high') {
      // Upcoming high-impact catalyst inside the next 36 hours.
      items.push({
        id: `upcoming::${event.id || `${name}-${event.date}`}`,
        kind: 'scheduled_catalyst',
        headline: `On deck: ${name} (${event.date}${event.time_precision === 'time_estimate' ? ', time estimated' : ''})`,
        urgency: 45,
        market_impact: 70,
        cluster: clusterFor(name),
        asset_tags: event.historical_asset_sensitivity || [],
        sector_tags: [clusterFor(name)],
        timestamp: time,
        source: event.provider || event.source || 'economic-calendar',
        attribution: 'scheduled release via platform calendar providers',
      });
    }
  }
  return items;
}

function marketMoveWireEvents(live) {
  const items = [];
  const liveOk = live && live.metadata && ['live', 'partial'].includes(live.metadata.status);
  if (!liveOk) return items;
  for (const [key, meta] of Object.entries(ASSET_SECTORS)) {
    const node = live[key];
    if (!node || !Number.isFinite(node.change_pct)) continue;
    const urgency = moveUrgency(Math.abs(node.change_pct), meta.symbol);
    if (!urgency) continue;
    const direction = node.change_pct > 0 ? 'jumps' : 'drops';
    items.push({
      id: `move::${meta.symbol}::${new Date(NOW).toISOString().slice(0, 13)}`,
      kind: 'market_move',
      headline: `${meta.symbol} ${direction} ${fmtPct(node.change_pct)}${Number.isFinite(node.value) ? ` to ${node.value}` : ''}`,
      urgency,
      market_impact: Math.min(95, urgency + 5),
      cluster: meta.sector === 'volatility' ? 'volatility' : meta.sector === 'ai-semiconductors' ? 'ai-momentum' : 'tape',
      asset_tags: [meta.symbol],
      sector_tags: [meta.sector],
      timestamp: node.fetched_at || new Date(NOW).toISOString(),
      source: node.source_name || 'platform market data',
      attribution: node.source_url ? `sourced: ${node.source_url}` : 'platform market data providers',
    });
  }
  return items;
}

function buildWire() {
  const calendar = readJson(CALENDAR_PATH, { events: [] });
  const live = readJson(LIVE_PATH, {});
  const previous = readJson(OUT_PATH, { items: [] });

  const fresh = [...calendarWireEvents(calendar), ...marketMoveWireEvents(live)];

  // Duplicate suppression: keep prior items still fresh, never re-add same id.
  const seen = new Set();
  const merged = [];
  for (const item of [...fresh, ...(previous.items || [])]) {
    if (seen.has(item.id)) continue;
    if (hoursAgo(item.timestamp) > STALE_HOURS) continue; // stale suppression
    seen.add(item.id);
    merged.push(item);
  }
  merged.sort((a, b) => b.urgency - a.urgency || String(b.timestamp).localeCompare(String(a.timestamp)));

  // Event clustering summary.
  const clusters = {};
  for (const item of merged) clusters[item.cluster] = (clusters[item.cluster] || 0) + 1;

  return {
    version: '1.0',
    updated_at: new Date(NOW).toISOString(),
    status: merged.length ? 'live' : 'quiet',
    item_count: merged.length,
    clusters,
    top_story: merged[0] || null,
    items: merged.slice(0, 40),
  };
}

function main() {
  const write = process.argv.includes('--write');
  const wire = buildWire();
  console.log(`[newswire] status=${wire.status} items=${wire.item_count} clusters=${JSON.stringify(wire.clusters)}`);
  if (wire.top_story) console.log(`[newswire] top: ${wire.top_story.headline} (urgency=${wire.top_story.urgency})`);
  if (write) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(wire, null, 2) + '\n', 'utf8');
    console.log('[newswire] wrote data/newswire/wire-events.json');
  }
}

if (require.main === module) main();

module.exports = { buildWire };
