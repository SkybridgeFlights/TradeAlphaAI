'use strict';

/**
 * Provider key validator — run to inspect live responses from all providers.
 *
 * Usage:
 *   node tools/validate-provider-keys.js
 *   node tools/validate-provider-keys.js --provider=finnhub
 *   node tools/validate-provider-keys.js --provider=alphavantage
 *
 * Keys are read from environment variables (same names as GitHub Secrets).
 * Never prints key values — only "present" or "missing".
 *
 * Outputs for each provider:
 *   - HTTP status code
 *   - Response content-type
 *   - First 800 chars of raw response body
 *   - Parsed event count (if successful)
 *   - Diagnosis (auth_failed / rate_limited / paid_plan / ok / no_events)
 */

const https  = require('https');
const today  = new Date().toISOString().slice(0, 10);
const future = addDays(today, 21);

const PROVIDERS = [
  {
    name: 'finnhub',
    envKey: 'FINNHUB_API_KEY',
    buildUrl: (key) =>
      `https://finnhub.io/api/v1/calendar/economic?from=${today}&to=${future}&token=${encodeURIComponent(key)}`,
    diagnose: (status, body) => {
      if (status === 403) return body.includes('Premium') || body.includes('plan')
        ? 'paid_plan_required — endpoint requires premium subscription'
        : 'auth_failed — key invalid or expired';
      if (status === 401) return 'auth_failed — invalid API key';
      if (status === 429) return 'rate_limited — slow down requests';
      if (status === 200) {
        try {
          const d = JSON.parse(body);
          const count = (d.economicCalendar || []).length;
          return count > 0 ? `ok — ${count} events returned` : 'ok_but_empty — 0 events in range';
        } catch { return 'ok_but_invalid_json'; }
      }
      return `unexpected_status_${status}`;
    },
  },
  {
    name: 'alphavantage',
    envKey: 'ALPHAVANTAGE_API_KEY',
    buildUrl: (key) =>
      `https://www.alphavantage.co/query?function=ECONOMIC_CALENDAR&horizon=3month&apikey=${encodeURIComponent(key)}`,
    diagnose: (status, body) => {
      if (status !== 200) return `http_error_${status}`;
      // AV returns JSON on error, CSV on success
      const trimmed = body.trimStart();
      if (trimmed.startsWith('{')) {
        try {
          const d = JSON.parse(trimmed);
          if (d.Note)             return 'rate_limited — ' + d.Note.slice(0, 100);
          if (d.Information)      return 'auth_failed_or_plan — ' + d.Information.slice(0, 100);
          if (d['Error Message']) return 'api_error — ' + d['Error Message'].slice(0, 100);
          return 'unexpected_json_response';
        } catch { return 'json_parse_error'; }
      }
      // CSV response
      const lines = trimmed.split('\n').filter((l) => l.trim());
      return lines.length > 1 ? `ok — ${lines.length - 1} rows in CSV` : 'ok_but_empty_csv';
    },
  },
  {
    name: 'fmp',
    envKey: 'FMP_API_KEY',
    buildUrl: (key) =>
      `https://financialmodelingprep.com/stable/economic-calendar?from=${today}&to=${future}&apikey=${encodeURIComponent(key)}`,
    diagnose: (status, body) => {
      if (status === 402) return 'paid_plan_required — economic calendar requires paid subscription';
      if (status === 401) return 'auth_failed — invalid API key';
      if (status === 200) {
        try {
          const d = JSON.parse(body);
          return Array.isArray(d)
            ? `ok — ${d.length} events returned`
            : ('error' in d ? `api_error: ${d.error}` : 'unexpected_shape');
        } catch { return 'invalid_json'; }
      }
      return `unexpected_status_${status}`;
    },
  },
  {
    name: 'trading_economics',
    envKey: 'TRADING_ECONOMICS_API_KEY',
    buildUrl: (key) => {
      // key can be "client:secret" or single key
      const auth = key.includes(':') ? key : key;
      return `https://api.tradingeconomics.com/calendar?c=${encodeURIComponent(auth)}&d1=${today}&d2=${future}&f=json`;
    },
    diagnose: (status, body) => {
      if (status === 401 || status === 403) return 'auth_failed';
      if (status === 200) {
        try {
          const d = JSON.parse(body);
          return Array.isArray(d)
            ? `ok — ${d.length} events returned`
            : (d.message ? `api_message: ${d.message}` : 'unexpected_shape');
        } catch { return 'invalid_json'; }
      }
      return `unexpected_status_${status}`;
    },
    demoKey: 'guest:guest',
    demoNote: 'Using public demo key guest:guest — limited to ~10 sample events',
  },
  {
    name: 'fred',
    envKey: 'FRED_API_KEY',
    buildUrl: (key) =>
      `https://api.stlouisfed.org/fred/releases/dates?api_key=${encodeURIComponent(key)}&file_type=json&include_release_dates_with_no_data=true&limit=50&order_by=release_date&sort_order=asc&realtime_start=${today}`,
    diagnose: (status, body) => {
      if (status === 400) {
        try {
          const d = JSON.parse(body);
          return `api_error: ${(d.error_message || '').slice(0, 100)}`;
        } catch { return `http_error_${status}`; }
      }
      if (status !== 200) return `http_error_${status}`;
      try {
        const d = JSON.parse(body);
        const count = (d.release_dates || []).length;
        return count > 0 ? `ok — ${count} release dates (including future scheduled)` : 'ok_but_empty';
      } catch { return 'invalid_json'; }
    },
  },
];

// ── HTTP helper ──────────────────────────────────────────────────────────────

function fetchRaw(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const safeUrl = `${parsed.origin}${parsed.pathname}`;
    console.log(`  → ${safeUrl}`);
    const req = https.get(parsed, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('Timeout')));
  });
}

function addDays(d, n) {
  const dt = new Date(d + 'T00:00:00Z');
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

// ── Runner ───────────────────────────────────────────────────────────────────

async function run() {
  const args   = process.argv.slice(2);
  const filter = (args.find((a) => a.startsWith('--provider=')) || '').replace('--provider=', '');

  const targets = filter
    ? PROVIDERS.filter((p) => p.name === filter)
    : PROVIDERS;

  if (!targets.length) {
    console.error(`Unknown provider: ${filter}. Valid: ${PROVIDERS.map((p) => p.name).join(', ')}`);
    process.exit(1);
  }

  console.log(`\n[validator] Testing ${targets.length} provider(s)  range=${today}..${future}\n`);

  for (const p of targets) {
    console.log(`\n═══ ${p.name.toUpperCase()} ═══════════════════════════════`);

    let key = String(process.env[p.envKey] || '').trim();
    let keySource = `env:${p.envKey}`;

    if (!key && p.demoKey) {
      key = p.demoKey;
      keySource = `demo (${p.demoNote})`;
    }

    if (!key) {
      console.log(`  key:      MISSING (set ${p.envKey})`);
      console.log(`  result:   SKIPPED — no key available\n`);
      continue;
    }

    console.log(`  key:      present (${keySource})`);

    try {
      const { status, headers, body } = await fetchRaw(p.buildUrl(key));
      const preview  = body.slice(0, 800).replace(/\n/g, '\\n');
      const diagnosis = p.diagnose(status, body);

      console.log(`  status:   ${status}`);
      console.log(`  content:  ${headers['content-type'] || '—'}`);
      console.log(`  size:     ${body.length} bytes`);
      if (headers['x-ratelimit-limit'])   console.log(`  rl-limit: ${headers['x-ratelimit-limit']}`);
      if (headers['x-ratelimit-remaining']) console.log(`  rl-left:  ${headers['x-ratelimit-remaining']}`);
      if (headers['retry-after'])         console.log(`  retry-after: ${headers['retry-after']}`);
      console.log(`  preview:  ${preview}`);
      console.log(`  result:   ${diagnosis}`);
    } catch (err) {
      console.log(`  result:   ERROR — ${err.message}`);
    }
  }

  console.log('\n[validator] done\n');
}

run().catch((err) => {
  console.error('[validator] fatal:', err.message);
  process.exit(1);
});
