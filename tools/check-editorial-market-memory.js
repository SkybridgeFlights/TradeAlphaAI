'use strict';

const fs = require('fs');
const path = require('path');
const { LIFECYCLE_STATES, NARRATIVE_DEFINITIONS } = require('./build-editorial-market-memory');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'editorial-market-memory.json');
const failures = [];
const TIMELINE_KINDS = new Set(['changed', 'persisted', 'failed', 'intensified', 'ignored', 'repriced']);
const EXPECTATION_STATES = new Set(['monitoring', 'fulfilled', 'failed']);

function fail(message) { failures.push(message); }
function hasArabic(value) { return /[\u0600-\u06ff]/.test(String(value || '')); }
function unsafe(value) {
  return /\b(buy|sell|entry|exit|target price|guaranteed|will rally|will fall|go long|go short|long position|short position)\b/i.test(String(value || ''))
    || /(اشتر|بيع الآن|دخول|خروج|هدف سعري)/.test(String(value || ''));
}

if (!fs.existsSync(FILE)) fail('editorial memory artifact missing');
let memory = null;
try { memory = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (error) { fail(`artifact parse error: ${error.message}`); }

if (memory) {
  if (typeof memory.verified !== 'boolean') fail('verified flag missing');
  if (!['verified', 'holding_unverified'].includes(memory.status)) fail(`invalid status ${memory.status}`);
  if (!Array.isArray(memory.narratives) || !Array.isArray(memory.timeline)) fail('narratives/timeline arrays missing');
  if (memory.verified === false) {
    if (memory.continuity_available !== false) fail('unverified run exposes continuity as current');
    if ((memory.current_focus || []).length) fail('unverified run exposes current focus');
    if ((memory.failed_expectations || []).length) fail('unverified run creates failed expectations');
    if ((memory.unresolved_tensions || []).length) fail('unverified run asserts unresolved current tensions');
    if (memory.market_character !== null) fail('unverified run asserts market character');
  }

  const narrativeIds = new Set();
  for (const item of memory.narratives || []) {
    if (!NARRATIVE_DEFINITIONS[item.id]) fail(`unknown narrative ${item.id}`);
    if (narrativeIds.has(item.id)) fail(`duplicate narrative ${item.id}`);
    narrativeIds.add(item.id);
    if (!LIFECYCLE_STATES.includes(item.state)) fail(`invalid lifecycle ${item.id}:${item.state}`);
    if (!Number.isInteger(item.sessions) || item.sessions < 1) fail(`invalid persistence count ${item.id}`);
    if (!item.en || !hasArabic(item.ar)) fail(`bilingual parity missing for ${item.id}`);
    if (unsafe(item.en) || unsafe(item.ar)) fail(`unsafe editorial language in ${item.id}`);
    if (item.active && !(item.evidence || []).length) fail(`active narrative ${item.id} lacks evidence`);
  }

  for (const item of memory.expectations || []) {
    if (!EXPECTATION_STATES.has(item.status)) fail(`invalid expectation status ${item.id}`);
    if (!item.expected_dimension || !(item.expected_values || []).length) fail(`expectation ${item.id} lacks test contract`);
    if (!item.en || !hasArabic(item.ar)) fail(`expectation ${item.id} lacks bilingual text`);
  }
  for (const item of memory.failed_expectations || []) {
    if (item.status !== 'failed') fail(`failed expectation list contains ${item.status}`);
    if (item.observed_value === 'unverified') fail(`failed expectation ${item.id} evaluated from unverified state`);
  }

  const timelineIds = new Set();
  let priorDate = '';
  for (const item of memory.timeline || []) {
    if (timelineIds.has(item.id)) fail(`duplicate timeline event ${item.id}`);
    timelineIds.add(item.id);
    if (!TIMELINE_KINDS.has(item.kind)) fail(`invalid timeline kind ${item.kind}`);
    if (priorDate && String(item.date) < priorDate) fail('timeline not chronological');
    priorDate = String(item.date);
    if (!item.en || !hasArabic(item.ar)) fail(`timeline ${item.id} lacks bilingual text`);
    if (!(item.evidence || []).length) fail(`timeline ${item.id} lacks evidence`);
  }

  if ((memory.timeline || []).length > 90) fail('timeline exceeds retention cap');
  if ((memory.archive || []).length > 24) fail('archive exceeds retention cap');
}

if (failures.length) {
  failures.forEach((message) => console.error(`[editorial-memory-check] FAIL: ${message}`));
  process.exit(1);
}
console.log(`[editorial-memory-check] passed (verified=${memory.verified}, narratives=${memory.narratives.length}, timeline=${memory.timeline.length})`);
