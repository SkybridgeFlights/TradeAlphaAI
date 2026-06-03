'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'live-market-state.json');
const sourcePath = argValue('--source');
const write = process.argv.includes('--write');
const validateOnly = process.argv.includes('--validate-only');

// ── Numeric field bounds [min, max] ───────────────────────────────────────────
const NUMERIC_BOUNDS = {
  sp500:       [100,    100000],
  nasdaq:      [100,    100000],
  dowjones:    [1000,   200000],
  russell2000: [50,     10000],
  vix:         [1,      200],
  us10y_yield: [-5,     25],
  dxy:         [50,     200],
  gold:        [100,    15000],
  bitcoin:     [100,    10000000]
};

// ── String field allowed values ───────────────────────────────────────────────
const STRING_ALLOWED = {
  ai_sector_momentum:     new Set(['bullish', 'bearish', 'neutral', 'mixed', 'unverified']),
  semiconductor_momentum: new Set(['bullish', 'bearish', 'neutral', 'mixed', 'unverified']),
  market_regime:          new Set(['risk-on', 'risk-off', 'mixed', 'unverified']),
  risk_state:             new Set(['elevated', 'moderate', 'low', 'unverified']),
  volatility_state:       new Set(['elevated', 'moderate', 'low', 'unverified'])
};

const STALENESS_HOURS = 26;

// ── No source: report current state ──────────────────────────────────────────
if (!sourcePath) {
  const current = readCurrentState();
  const status = current.metadata && current.metadata.status;
  console.log(`Live market state: status=${status || 'unknown'}, generated_at=${current.generated_at || 'unknown'}`);
  if (status === 'live') {
    for (const field of Object.keys(NUMERIC_BOUNDS).concat(Object.keys(STRING_ALLOWED))) {
      const entry = current[field];
      if (entry && entry.value !== null) console.log(`  ${field}: ${entry.value} (fetched ${entry.fetched_at || '?'})`);
    }
  } else {
    console.log('Market state is in fallback mode. Use --source=<file> --write to update with real data.');
  }
  process.exit(0);
}

// ── Source provided: validate ─────────────────────────────────────────────────
const sourceFile = path.resolve(ROOT, sourcePath);
if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

let input;
try {
  input = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
} catch (err) {
  console.error(`Cannot parse source file: ${err.message}`);
  process.exit(1);
}

const failures = [];
const now = Date.now();
const staleThresholdMs = STALENESS_HOURS * 3600 * 1000;

// Validate numeric fields
for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
  const entry = input[field];
  if (!entry) continue;
  if (entry.value !== null && entry.value !== undefined) {
    if (typeof entry.value !== 'number' || !isFinite(entry.value)) {
      failures.push(`${field}: value must be a finite number, got ${JSON.stringify(entry.value)}`);
    } else if (entry.value < min || entry.value > max) {
      failures.push(`${field}: value ${entry.value} is outside valid range [${min}, ${max}]`);
    }
    if (!entry.source_url || !/^https?:\/\/.+/.test(entry.source_url)) {
      failures.push(`${field}: non-null value requires a valid https:// source_url`);
    }
    if (!entry.source_name || !String(entry.source_name).trim()) {
      failures.push(`${field}: non-null value requires source_name`);
    }
    if (!entry.fetched_at || !/^\d{4}-\d{2}-\d{2}T/.test(entry.fetched_at)) {
      failures.push(`${field}: fetched_at must be an ISO timestamp (YYYY-MM-DDT...)`);
    } else {
      const age = now - new Date(entry.fetched_at).getTime();
      if (age > staleThresholdMs) {
        failures.push(`${field}: fetched_at ${entry.fetched_at} is stale (>${STALENESS_HOURS}h old)`);
      }
    }
  }
}

// Validate string fields
for (const [field, allowed] of Object.entries(STRING_ALLOWED)) {
  const entry = input[field];
  if (!entry) continue;
  if (entry.value !== null && entry.value !== undefined) {
    if (!allowed.has(entry.value)) {
      failures.push(`${field}: value "${entry.value}" not in allowed set [${[...allowed].join(', ')}]`);
    }
    if (!entry.source_url || !/^https?:\/\/.+/.test(entry.source_url)) {
      failures.push(`${field}: non-null value requires a valid https:// source_url`);
    }
  }
}

if (failures.length) {
  console.error('Live market state validation failed:');
  failures.forEach((f) => console.error(`  - ${f}`));
  console.error('No files were modified. Previous state preserved.');
  process.exit(1);
}

const validatedFields = [
  ...Object.keys(NUMERIC_BOUNDS),
  ...Object.keys(STRING_ALLOWED)
];
const nonNullCount = validatedFields.filter((f) => input[f] && input[f].value !== null).length;
console.log(`Validation passed: ${nonNullCount} / ${validatedFields.length} fields populated.`);

if (validateOnly || !write) {
  console.log(write ? '' : 'DRY_RUN: use --write to update data/live-market-state.json.');
  process.exit(0);
}

// ── Build output ──────────────────────────────────────────────────────────────
const current = readCurrentState();
const output = {
  version: '1.0',
  generated_at: new Date().toISOString(),
  metadata: {
    status: nonNullCount > 0 ? 'live' : 'fallback',
    source_policy: (current.metadata && current.metadata.source_policy) || {}
  }
};

for (const field of validatedFields) {
  output[field] = input[field] || { value: null, source_url: null, source_name: null, fetched_at: null };
}

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Updated data/live-market-state.json — status=${output.metadata.status}`);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCurrentState() {
  try {
    return fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : {};
  } catch (_) {
    return {};
  }
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
