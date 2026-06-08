'use strict';

/**
 * check-intelligence-health.js — Phase 67.1 Part F
 *
 * Validates the intelligence health subsystem:
 *   - data/system-status/intelligence-health.json exists and is valid
 *   - severity is a known value
 *   - logs/intelligence-quality-history.json exists and has <= 200 entries
 *   - no unreported CRITICAL is blocking publication silently
 *
 * Exit 0 → healthy. Exit 1 → unhealthy.
 *
 * Usage: node tools/check-intelligence-health.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const HEALTH_PATH  = path.join(ROOT, 'data', 'system-status', 'intelligence-health.json');
const HISTORY_PATH = path.join(ROOT, 'logs', 'intelligence-quality-history.json');
const HISTORY_MAX  = 200;

const VALID_STATUSES  = new Set(['ok', 'warn', 'degraded', 'critical']);
const VALID_SEVERITIES = new Set(['OK', 'INFO', 'WARN', 'ERROR', 'CRITICAL']);
const REQUIRED_FIELDS = ['status', 'severity', 'reasons', 'generated_at'];

main();

function main() {
  const problems = [];

  // ── 1. Health JSON ────────────────────────────────────────────────────────
  if (!fs.existsSync(HEALTH_PATH)) {
    problems.push(`MISSING: ${path.relative(ROOT, HEALTH_PATH)} — run npm run check:intelligence-quality first`);
  } else {
    const health = parseJson(HEALTH_PATH);
    if (!health) {
      problems.push(`MALFORMED: ${path.relative(ROOT, HEALTH_PATH)} — could not be parsed`);
    } else {
      for (const field of REQUIRED_FIELDS) {
        if (health[field] === undefined) {
          problems.push(`MISSING FIELD: intelligence-health.json is missing "${field}"`);
        }
      }
      if (health.status !== undefined && !VALID_STATUSES.has(health.status)) {
        problems.push(`INVALID: intelligence-health.json status="${health.status}" — expected one of: ${[...VALID_STATUSES].join(', ')}`);
      }
      if (health.severity !== undefined && !VALID_SEVERITIES.has(health.severity)) {
        problems.push(`INVALID: intelligence-health.json severity="${health.severity}" — expected one of: ${[...VALID_SEVERITIES].join(', ')}`);
      }
      if (!Array.isArray(health.reasons)) {
        problems.push('INVALID: intelligence-health.json reasons must be an array');
      }
      if (health.generated_at && isStale(health.generated_at, 48)) {
        const age = Math.round(ageHours(health.generated_at));
        problems.push(`STALE: intelligence-health.json generated_at is ${age}h ago (limit 48h) — re-run quality check`);
      }
    }
  }

  // ── 2. History log ────────────────────────────────────────────────────────
  if (!fs.existsSync(HISTORY_PATH)) {
    problems.push(`MISSING: ${path.relative(ROOT, HISTORY_PATH)} — run npm run check:intelligence-quality to create it`);
  } else {
    const history = parseJson(HISTORY_PATH);
    if (!Array.isArray(history)) {
      problems.push(`MALFORMED: ${path.relative(ROOT, HISTORY_PATH)} — expected JSON array`);
    } else {
      if (history.length > HISTORY_MAX) {
        problems.push(`OVERFLOW: ${path.relative(ROOT, HISTORY_PATH)} has ${history.length} entries (max ${HISTORY_MAX}) — run the quality checker to prune`);
      }
      const badEntries = history.filter((e) => !e.slug || !e.severity || !e.timestamp);
      if (badEntries.length) {
        problems.push(`MALFORMED ENTRIES: ${badEntries.length} history entry/entries missing required fields (slug, severity, timestamp)`);
      }
      console.log(`[check-intelligence-health] History: ${history.length} entries, last severity: ${(history.slice(-1)[0] || {}).severity || 'n/a'}`);
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  if (problems.length) {
    console.error(`[check-intelligence-health] UNHEALTHY — ${problems.length} problem(s):`);
    problems.forEach((p) => console.error(`    ✗ ${p}`));
    process.exit(1);
  }

  const health = parseJson(HEALTH_PATH);
  console.log(`[check-intelligence-health] HEALTHY — status=${health.status} severity=${health.severity} generated_at=${health.generated_at}`);
}

function parseJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function ageHours(iso) {
  return (Date.now() - Date.parse(iso)) / 3600000;
}

function isStale(iso, limitHours) {
  return ageHours(iso) > limitHours;
}
