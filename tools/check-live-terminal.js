'use strict';

// Phase 75-RT validation — live terminal integrity.
// Guards the real-time layer: the orchestrated quote endpoint must exist with
// the full terminal asset registry and no fabrication paths, the frontend
// refresh engine must be honesty-compliant (no random values, visibility
// pause, bounded cadence, degraded behavior), and both homepages must carry
// the live hooks exactly once (data-symbol cells, data-dim chips, as-of
// indicator, script include).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}
function count(haystack, needle) { return haystack.split(needle).length - 1; }

// ── Endpoint ──────────────────────────────────────────────────────────────────
const endpoint = read('api/live-quotes.js');
if (!endpoint) {
  failures.push('api/live-quotes.js missing');
} else {
  const REQUIRED_ASSETS = ['gold', 'dxy', 'us10y', 'spy', 'qqq', 'nvda', 'btc', 'vix', 'oil', 'iwm'];
  for (const key of REQUIRED_ASSETS) {
    if (!new RegExp(`^\\s*(//.*\\n\\s*)*${key}:`, 'm').test(endpoint) && !endpoint.includes(`${key}: {`)) {
      failures.push(`live-quotes: asset registry missing "${key}"`);
    }
  }
  if (/Math\.random/.test(endpoint)) failures.push('live-quotes: fabrication path detected (Math.random)');
  if (!endpoint.includes('value: null')) failures.push('live-quotes: missing explicit null-on-unavailable honesty path');
  if (!/recordFailure|recordSuccess/.test(endpoint)) failures.push('live-quotes: provider health scoring missing');
  if (!/withRetry/.test(endpoint)) failures.push('live-quotes: retry backoff missing');
  if (!/STALE_QUOTE_HOURS/.test(endpoint)) failures.push('live-quotes: stale-data suppression missing');
  if (!/attribution/.test(endpoint)) failures.push('live-quotes: attribution preservation missing');
  // No mock provider import — fallback is explicit absence, never a mock value.
  if (/mock-provider|mockProvider/.test(endpoint)) failures.push('live-quotes: mock fallback wired into live endpoint');
  console.log('[live-terminal] api/live-quotes.js ok');
}

// ── Frontend engine ───────────────────────────────────────────────────────────
const engine = read('js/live-terminal.js');
if (!engine) {
  failures.push('js/live-terminal.js missing');
} else {
  if (/Math\.random/.test(engine)) failures.push('live-terminal.js: fabrication path detected (Math.random)');
  if (!engine.includes('visibilitychange')) failures.push('live-terminal.js: missing hidden-tab pause');
  if (!/entry\.live/.test(engine)) failures.push('live-terminal.js: DOM updates not gated on live verified quotes');
  if (!/failures\s*>=\s*MAX_FAILURES/.test(engine)) failures.push('live-terminal.js: missing degraded backoff');
  if (!/Math\.min\(Math\.max\(base, 30\), 300\)/.test(engine)) failures.push('live-terminal.js: cadence not bounded to 30–300s');
  if (/\breal[- ]time quotes\b|\blive prices\b/i.test(engine)) failures.push('live-terminal.js: fake realtime claim in user-facing text');
  if (!engine.includes('prefers-reduced-motion')) failures.push('live-terminal.js: motion discipline missing reduced-motion guard');
  console.log('[live-terminal] js/live-terminal.js ok');
}

// ── Vercel function registration ─────────────────────────────────────────────
const vercel = read('vercel.json');
if (vercel && !vercel.includes('api/live-quotes.js')) failures.push('vercel.json: live-quotes function not registered');

// ── Homepage hooks ────────────────────────────────────────────────────────────
for (const page of ['index.html', 'ar/index.html']) {
  const html = read(page);
  if (!html) { failures.push(`${page}: missing`); continue; }
  const section = html.split('<!-- generated:newsroom-modules:start -->')[1]?.split('<!-- generated:newsroom-modules:end -->')[0] || '';
  if (!section) continue;
  if (count(section, '/js/live-terminal.js') !== 1) failures.push(`${page}: live-terminal script include count != 1`);
  if (count(section, 'data-live-endpoint=') !== 1) failures.push(`${page}: live endpoint hook count != 1`);
  if (!section.includes('nr-live-asof')) failures.push(`${page}: live as-of indicator missing`);
  const symbols = [...section.matchAll(/data-symbol="([A-Z0-9]+)"/g)].map((m) => m[1]);
  for (const sym of ['GOLD', 'DXY', 'US10Y', 'SPY', 'QQQ', 'BTC', 'VIX', 'NVDA', 'OIL']) {
    if (!symbols.includes(sym)) failures.push(`${page}: live matrix missing data-symbol for ${sym}`);
  }
  const dims = [...section.matchAll(/data-dim="([a-z_]+)"/g)].map((m) => m[1]);
  for (const dim of ['volatility_regime', 'dollar_pressure', 'breadth_state', 'momentum_concentration', 'ai_concentration_risk']) {
    if (!dims.includes(dim)) failures.push(`${page}: macro monitor missing data-dim for ${dim}`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[live-terminal] FAIL: ${f}`));
  process.exit(1);
}
console.log('[live-terminal] check:live-terminal passed.');
