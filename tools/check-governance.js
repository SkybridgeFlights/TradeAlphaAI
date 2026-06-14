'use strict';

// Phase 111 — check:governance. Ensures the multi-agent engineering governance
// layer exists and remains internally consistent. HARD-FAILS if any required
// governance file is missing or empty, the constitution omits a non-negotiable
// rule, an agent/skill file is missing a required section, or package.json lacks
// the check:governance script. This validator enforces operating discipline; it
// touches no product logic.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const fail = (m) => failures.push(m);

const DOCS = ['ENGINEERING_CONSTITUTION.md', 'AGENT_OPERATING_MODEL.md', 'PHASE_EXECUTION_PROTOCOL.md'].map((f) => `docs/${f}`);
const AGENTS = [
  'macro-intelligence-agent', 'editorial-agent', 'visual-intelligence-agent', 'workflow-agent',
  'validator-agent', 'distribution-agent', 'ui-agent', 'seo-agent', 'integration-governor-agent', 'safety-agent',
].map((f) => `agents/${f}.md`);
const SKILLS = [
  'surgical-editing', 'validator-first-development', 'safe-workflow-editing', 'bilingual-safety', 'anti-fabrication',
  'deterministic-generation', 'editorial-narrative-quality', 'visual-evidence-design', 'social-distribution-safety', 'integration-governance',
].map((f) => `skills/${f}.md`);

// Non-negotiable phrases the constitution MUST contain (case-insensitive).
const CONSTITUTION_PHRASES = [
  'extend, do not rebuild', 'push only green', 'never weaken validators', 'never fabricate',
  'never commit secrets', 'preview-only', 'bilingual', 'rtl', 'deterministic',
  'telegram', 'surgical', 'go/no-go',
];

// Required sections (matched as case-insensitive substrings of the file body).
const AGENT_SECTIONS = ['mission', 'allowed', 'forbidden', 'required validators', 'safety rules', 'output requirements', 'handoff', 'failure policy'];
const SKILL_SECTIONS = ['purpose', 'when to use', 'do-not-use', 'checklist', 'common failure modes', 'required validators', 'example prompt'];

function readFile(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { fail(`missing required governance file: ${rel}`); return null; }
  const body = fs.readFileSync(abs, 'utf8');
  if (!body.trim()) { fail(`empty governance file: ${rel}`); return null; }
  return body;
}

// Docs
const constitution = readFile(DOCS[0]);
readFile(DOCS[1]);
readFile(DOCS[2]);
if (constitution) {
  const lower = constitution.toLowerCase();
  for (const ph of CONSTITUTION_PHRASES) {
    if (!lower.includes(ph)) fail(`ENGINEERING_CONSTITUTION.md: missing non-negotiable phrase "${ph}"`);
  }
}

// Agents
for (const rel of AGENTS) {
  const body = readFile(rel);
  if (!body) continue;
  const lower = body.toLowerCase();
  for (const sec of AGENT_SECTIONS) if (!lower.includes(sec)) fail(`${rel}: missing required section "${sec}"`);
}

// Skills
for (const rel of SKILLS) {
  const body = readFile(rel);
  if (!body) continue;
  const lower = body.toLowerCase();
  for (const sec of SKILL_SECTIONS) if (!lower.includes(sec)) fail(`${rel}: missing required section "${sec}"`);
}

// package.json wiring
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts['check:governance']) fail('package.json: missing "check:governance" script');
} catch {
  fail('package.json: unreadable');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[governance] FAIL: ${f}`));
  process.exit(1);
}
console.log(`[governance] check:governance passed (${DOCS.length} docs, ${AGENTS.length} agents, ${SKILLS.length} skills present + complete).`);
