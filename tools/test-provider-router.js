'use strict';

// Part 2 — Live provider router test
// Tests the FMP → Finnhub → FRED fallback chain against live endpoints.
// Outputs: active provider, event count, normalized event sample,
//          attempt log with HTTP status and fallback reason, total latency.
// Does NOT write any data files.
//
// Usage:
//   node tools/test-provider-router.js
//   FMP_API_KEY=xxx FINNHUB_API_KEY=yyy FRED_API_KEY=zzz node tools/test-provider-router.js

const path = require('path');
const { fetchEconomicCalendar } = require('./providers/economic-calendar/provider-router');

function dateString(offsetDays) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  const from = dateString(0);
  const to   = dateString(7);

  console.log('[provider-test] Provider chain: FMP → Finnhub → FRED');
  console.log(`[provider-test] Test date range: ${from} → ${to}`);
  console.log(`[provider-test] API key availability:`);
  console.log(`  FMP_API_KEY:          ${process.env.FMP_API_KEY           ? 'set' : 'not set'}`);
  console.log(`  FINNHUB_API_KEY:      ${process.env.FINNHUB_API_KEY       ? 'set' : 'not set'}`);
  console.log(`  FRED_API_KEY:         ${process.env.FRED_API_KEY          ? 'set' : 'not set'}`);
  console.log(`  ALPHAVANTAGE_API_KEY: ${process.env.ALPHAVANTAGE_API_KEY  ? 'set' : 'not set'}`);
  console.log('');

  const start = Date.now();
  let result;
  try {
    result = await fetchEconomicCalendar({ from, to, env: process.env });
  } catch (err) {
    console.error(`[provider-test] Unhandled error: ${err.message}`);
    process.exit(1);
  }
  const latencyMs = Date.now() - start;

  const degraded    = result.provider === 'degraded';
  const cacheUsed   = result.cacheUsed === true;
  const fallbackUsed = result.fallbackUsed === true;

  console.log('[provider-test] Result:');
  console.log(`  active_provider: ${result.provider}`);
  console.log(`  event_count:     ${result.events.length}`);
  console.log(`  fallback_used:   ${fallbackUsed}`);
  console.log(`  cache_used:      ${cacheUsed}`);
  console.log(`  latency_ms:      ${latencyMs}`);
  console.log(`  endpoint:        ${result.endpoint || '(none)'}`);

  if (result.attempts?.length) {
    console.log('\n[provider-test] Provider attempt log:');
    result.attempts.forEach((a) => {
      const status = a.status === 'ok' ? '✓ ok' : '✗ unavailable';
      const reason = a.reason ? ` — ${a.reason}` : '';
      const events = a.status === 'ok' ? ` [${a.event_count} events]` : '';
      console.log(`  ${a.provider.padEnd(10)} ${status}${events}${reason}`);
    });
  }

  if (result.events.length > 0) {
    console.log('\n[provider-test] Normalized event sample (first 5):');
    result.events.slice(0, 5).forEach((e) => {
      const forecast = e.forecast != null ? e.forecast : 'N/A';
      const actual   = e.actual   != null ? e.actual   : 'N/A';
      console.log(`  [${e.date}] ${(e.event_name || e.name || '').slice(0, 50).padEnd(50)} | forecast=${String(forecast).padStart(8)} actual=${String(actual).padStart(8)}`);
    });
  }

  console.log('');
  if (degraded && !cacheUsed) {
    console.log('[provider-test] STATUS: DEGRADED — all live providers unavailable, no cache. Empty calendar active.');
    process.exit(0);
  } else if (cacheUsed) {
    console.log(`[provider-test] STATUS: CACHE FALLBACK — ${result.events.length} cached events served. Live providers unavailable.`);
  } else if (fallbackUsed) {
    console.log(`[provider-test] STATUS: LIVE (FALLBACK) — active provider: ${result.provider} (FMP was unavailable)`);
  } else {
    console.log(`[provider-test] STATUS: LIVE — active provider: ${result.provider}, ${result.events.length} events`);
  }
}

main().catch((err) => {
  console.error('[provider-test] Fatal:', err.message);
  process.exit(1);
});
