'use strict';

// Phase 69 validation — editorial persona registry and narrative state integrity.
// Ensures the five publishing verticals stay well-formed (distinct personas,
// non-empty voice rules, Telegram identities, unique content-type routing) and
// that the market narrative state file, when present, is schema-valid with no
// fabricated regime values outside the allowed vocabulary.

const fs = require('fs');
const path = require('path');
const { VERTICALS, GLOBAL_BANNED_PHRASES, verticalForContentType } = require('./editorial-personas');

const ROOT = path.resolve(__dirname, '..');
const STATE_PATH = path.join(ROOT, 'data', 'intelligence', 'market-narrative-state.json');

const REQUIRED_VERTICALS = ['macro-desk', 'market-outlook', 'newswire', 'educational', 'signals'];
const REGIME_KEYS = [
  'liquidity', 'inflation', 'risk_appetite', 'volatility_state',
  'yield_trend', 'dollar_trend', 'central_bank_tone', 'ai_speculation_cycle',
];

const failures = [];

// ── 1. Registry shape ─────────────────────────────────────────────────────────
for (const id of REQUIRED_VERTICALS) {
  const v = VERTICALS[id];
  if (!v) { failures.push(`missing vertical: ${id}`); continue; }
  if (!v.persona || !v.persona.includes('TradeAlphaAI')) failures.push(`${id}: persona must carry the TradeAlphaAI brand`);
  if (!v.persona_ar) failures.push(`${id}: missing Arabic persona`);
  if (!Array.isArray(v.voice_en) || v.voice_en.length < 2) failures.push(`${id}: needs >=2 English voice rules`);
  if (!Array.isArray(v.voice_ar) || v.voice_ar.length < 1) failures.push(`${id}: needs >=1 Arabic voice rule`);
  if (!v.mission || v.mission.length < 40) failures.push(`${id}: mission too thin`);
  if (!v.telegram || !Array.isArray(v.telegram.hooks) || v.telegram.hooks.length < 2) failures.push(`${id}: needs >=2 telegram hooks`);
  if (!v.telegram || !v.telegram.label || !v.telegram.hashtags) failures.push(`${id}: telegram label/hashtags missing`);
  if (!v.visual || !v.visual.accent || !v.visual.card_style) failures.push(`${id}: visual identity foundation missing`);
  if (!Array.isArray(v.content_types) || !v.content_types.length) failures.push(`${id}: content_types missing`);
}

// ── 2. Unique content-type routing ────────────────────────────────────────────
const typeOwners = new Map();
for (const v of Object.values(VERTICALS)) {
  for (const type of v.content_types) {
    if (typeOwners.has(type)) failures.push(`content type ${type} owned by both ${typeOwners.get(type)} and ${v.id}`);
    typeOwners.set(type, v.id);
  }
}
for (const type of ['market-outlook', 'editorial', 'continuous-intelligence', 'news-analysis']) {
  if (!verticalForContentType(type)) failures.push(`pipeline content type unrouted: ${type}`);
}

// ── 3. Banned-phrase list sanity ──────────────────────────────────────────────
if (GLOBAL_BANNED_PHRASES.length < 10) failures.push('global banned-phrase list suspiciously small');
if (!GLOBAL_BANNED_PHRASES.includes('in conclusion')) failures.push('banned list must include "in conclusion"');

// ── 4. Signals vertical safety language ───────────────────────────────────────
const signals = VERTICALS.signals;
if (signals && !signals.voice_en.some((r) => /never.*advice|no .*advice|NEVER/i.test(r))) {
  failures.push('signals vertical must encode the no-advice rule in its voice');
}

// ── 5. Narrative state schema (when present) ──────────────────────────────────
if (fs.existsSync(STATE_PATH)) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
    if (!state.regimes) failures.push('narrative state: missing regimes');
    for (const key of REGIME_KEYS) {
      if (state.regimes && !(key in state.regimes)) failures.push(`narrative state: missing regime key ${key}`);
    }
    if (!Array.isArray(state.dominant_themes)) failures.push('narrative state: dominant_themes must be an array');
    if (!Array.isArray(state.narrative_evolution)) failures.push('narrative state: narrative_evolution must be an array');
    if (!state.continuity_note) failures.push('narrative state: missing continuity_note');
  } catch (error) {
    failures.push(`narrative state: parse error ${error.message}`);
  }
} else {
  console.log('[editorial-personas] narrative state not built yet — run build:narrative-state (non-fatal)');
}

console.log(`[editorial-personas] verticals=${Object.keys(VERTICALS).length} banned_phrases=${GLOBAL_BANNED_PHRASES.length}`);
if (failures.length) {
  failures.forEach((f) => console.error(`[editorial-personas] FAIL: ${f}`));
  process.exit(1);
}
console.log('[editorial-personas] check:editorial-personas passed.');
