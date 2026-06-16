'use strict';

// Phase 202 / Workstream G — check:network-expansion.
// Ensures the cognitive network was genuinely EXPANDED (not the original 5
// pairs) and that the new chain types are well-formed and evidence-backed.
// HARD-FAILS on: fewer relationships than the registry defines, a registry
// relationship missing from the artifact, a defensive/leadership chain with no
// evidence, a leadership chain whose leader is not one of the registry assets,
// or retail/prediction language. Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { RELATIONSHIPS } = require('./asset-registry');

const ROOT = path.resolve(__dirname, '..');
const ARTIFACT = path.join(ROOT, 'data', 'intelligence', 'cognitive-network.json');
const SYMBOLS = new Set(require('./asset-registry').ASSETS.map((a) => a.symbol));
const FORBIDDEN = [/\bbuy\b/i, /\bsell\b/i, /\bprice target\b/i, /\bstrong buy\b/i, /\bguaranteed\b/i, /\bwill (rise|fall)\b/i];

function validate(a) {
  const f = [];
  if (!a || typeof a !== 'object') return ['artifact not an object'];
  const rels = Array.isArray(a.relationships) ? a.relationships : [];
  if (rels.length < RELATIONSHIPS.length) f.push(`relationships ${rels.length} < registry ${RELATIONSHIPS.length} (network not expanded)`);
  if (RELATIONSHIPS.length < 6) f.push(`registry only defines ${RELATIONSHIPS.length} relationships (expansion expected ≥6)`);
  const ids = new Set(rels.map((r) => r.id));
  for (const rel of RELATIONSHIPS) if (!ids.has(rel.id)) f.push(`registry relationship "${rel.id}" missing from artifact`);

  if (!Array.isArray(a.defensive_chains)) f.push('missing defensive_chains array');
  else for (const c of a.defensive_chains) {
    if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`defensive chain ${c.id}: missing evidence`);
    if (c.evidence && !c.evidence.some((e) => /defensive bid|risk offered/.test(e))) f.push(`defensive chain ${c.id}: evidence does not show defensive bid vs risk offered`);
  }
  if (!Array.isArray(a.leadership_chains)) f.push('missing leadership_chains array');
  else for (const c of a.leadership_chains) {
    if (!c.leader || !SYMBOLS.has(c.leader)) f.push(`leadership chain ${c.id}: leader "${c.leader}" not a registry asset`);
    if (!Array.isArray(c.evidence) || !c.evidence.length) f.push(`leadership chain ${c.id}: missing evidence`);
  }
  const text = JSON.stringify(a);
  for (const re of FORBIDDEN) if (re.test(text)) f.push(`forbidden language ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const base = fs.existsSync(ARTIFACT) ? JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')) : require('./build-cognitive-network').build();
  const clone = () => JSON.parse(JSON.stringify(base));
  const cases = [
    ['too few relationships', (m) => { m.relationships = m.relationships.slice(0, 3); }],
    ['missing registry rel', (m) => { m.relationships = m.relationships.filter((r) => r.id !== RELATIONSHIPS[0].id); }],
    ['defensive chain no evidence', (m) => { if (!m.defensive_chains.length) m.defensive_chains.push({ id: 'd', evidence: [] }); else m.defensive_chains[0].evidence = []; }],
    ['leadership bad leader', (m) => { if (!m.leadership_chains.length) m.leadership_chains.push({ id: 'l', leader: 'DOGE', evidence: ['x'] }); else m.leadership_chains[0].leader = 'DOGE'; }],
    ['drop defensive_chains', (m) => { delete m.defensive_chains; }],
    ['forbidden language', (m) => { m.evidence = (m.evidence || []).concat('strong buy'); }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { const c = clone(); mut(c); if (validate(c).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validate(clone()).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean rejected:', validate(clone()));
  console.log(`[network-expansion] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

if (require.main === module) {
  if (!fs.existsSync(ARTIFACT)) { console.log('[network-expansion] no artifact yet — nothing to validate (non-fatal).'); process.exit(0); }
  let a;
  try { a = JSON.parse(fs.readFileSync(ARTIFACT, 'utf8')); } catch (e) { console.error(`[network-expansion] FAIL: malformed JSON: ${e.message}`); process.exit(1); }
  const failures = validate(a);
  if (failures.length) { failures.forEach((m) => console.error(`[network-expansion] FAIL: ${m}`)); process.exit(1); }
  console.log(`[network-expansion] check:network-expansion passed (${a.relationships.length} relationships, ${a.defensive_chains.length} defensive + ${a.leadership_chains.length} leadership chains; evidence-backed).`);
}

module.exports = { validate };
