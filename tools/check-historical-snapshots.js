'use strict';

// Phase 207 / Workstream K — check:historical-snapshots.
// Validates the append-only snapshot ledger: well-formed schema, every snapshot
// has a valid date + ISO timestamp, dates are non-decreasing and NOT in the
// future (no fabricated/forward-dated history), per-snapshot state maps present,
// capped, and no retail/prediction language. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'historical-snapshots.json');
const CAP = 120;
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bwill (rise|fall)\b/i, /\bwill forecast\b/i, /\bguaranteed\b/i];

function validate(a, now = Date.now()) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  if (a.source_layer !== 'historical-snapshots') f.push('bad source_layer');
  if (a.schema_version !== '1.0') f.push('unexpected schema_version');
  const snaps = Array.isArray(a.snapshots) ? a.snapshots : null;
  if (!snaps || !snaps.length) { f.push('no snapshots'); return f; }
  if (snaps.length > CAP) f.push(`snapshots ${snaps.length} exceed cap ${CAP}`);
  if (a.count !== snaps.length) f.push('count != snapshots length');
  let prevDate = '';
  const future = now + 36 * 3600 * 1000; // allow timezone slack
  for (const s of snaps) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.date))) { f.push(`bad snapshot date ${s.date}`); continue; }
    const t = Date.parse(s.ts);
    if (!Number.isFinite(t)) f.push(`${s.date}: bad ts`);
    else if (t > future) f.push(`${s.date}: future-dated snapshot (fabricated history)`);
    if (s.date < prevDate) f.push(`${s.date}: snapshots not chronologically ordered`);
    prevDate = s.date;
    for (const k of ['macro_regime', 'sector_rotation', 'network_dominant']) if (typeof s[k] !== 'string' || !s[k]) f.push(`${s.date}: missing ${k}`);
    for (const k of ['asset_scores', 'sector_states', 'equity_scores']) if (!s[k] || typeof s[k] !== 'object') f.push(`${s.date}: missing ${k} map`);
  }
  const text = JSON.stringify(a);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-historical-snapshots').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['bad source_layer', (m) => { m.source_layer = 'x'; }],
    ['no snapshots', (m) => { m.snapshots = []; }],
    ['future-dated', (m) => { m.snapshots[m.snapshots.length - 1].ts = new Date(Date.now() + 90 * 86400000).toISOString(); }],
    ['count mismatch', (m) => { m.count = 999; }],
    ['missing state map', (m) => { delete m.snapshots[m.snapshots.length - 1].asset_scores; }],
    ['forbidden language', (m) => { m.note = 'guaranteed buy forecast'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}"`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL clean:', validate(clone()));
  console.log(`[historical-snapshots] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[historical-snapshots] no ledger yet (non-fatal).'); process.exit(0); }
  let a; try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[historical-snapshots] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[historical-snapshots] FAIL: ${m}`)); process.exit(1); }
  console.log(`[historical-snapshots] check:historical-snapshots passed (${a.count} snapshot(s); chronological, no fabricated/future history).`);
}

module.exports = { validate };
