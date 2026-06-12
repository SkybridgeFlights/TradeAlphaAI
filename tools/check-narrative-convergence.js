'use strict';

// Phase 79 validation — narrative convergence integrity.
// Guards the top of the intelligence stack: coherence scoring bounds and
// vocabulary, transition-velocity vocabulary, evidence-backed underpriced
// items (no prediction language, alert-coverage respected), link-history
// chain integrity, verified-only narrative composition, and cross-layer
// agreement with the cognition and macro layers.
// Files not built yet pass with a note (CI builds them each run).

const fs = require('fs');
const path = require('path');
const { COHERENCE_BANDS, VELOCITY_BANDS, PRESSURE_ALERT_COVERAGE } = require('./build-narrative-convergence');
const { PRESSURE_TRACKS } = require('./build-macro-cognition');
const { CAUSAL_EDGES } = require('./build-market-cognition');

const ROOT = path.resolve(__dirname, '..');
const failures = [];

function readJson(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) {
    failures.push(`${rel}: parse error ${e.message}`);
    return null;
  }
}

const convergence = readJson('data/intelligence/narrative-convergence.json');
const cognition = readJson('data/intelligence/market-cognition.json');
const macro = readJson('data/intelligence/macro-cognition.json');

if (convergence) {
  if (typeof convergence.verified !== 'boolean') failures.push('convergence: missing verified flag');

  // Coherence
  const coherence = convergence.coherence || {};
  if (!COHERENCE_BANDS.includes(coherence.band)) failures.push(`convergence: coherence band "${coherence.band}" outside vocabulary`);
  if (coherence.score !== null && (!Number.isFinite(coherence.score) || coherence.score < 0 || coherence.score > 100)) {
    failures.push(`convergence: coherence score ${coherence.score} out of bounds`);
  }
  if (convergence.verified === false && coherence.band !== 'unverified') failures.push('convergence: coherence asserted without verified inputs');

  // Velocity
  const velocity = convergence.transition_velocity || {};
  if (!VELOCITY_BANDS.includes(velocity.band)) failures.push(`convergence: velocity band "${velocity.band}" outside vocabulary`);

  // Links
  const edgeIds = new Set(CAUSAL_EDGES.map((e) => e.id));
  for (const list of [convergence.confirms || [], convergence.diverges || []]) {
    for (const l of list) {
      if (!edgeIds.has(l.id)) failures.push(`convergence: unknown link ${l.id}`);
      if (!Number.isFinite(l.chain_strength) || l.chain_strength < 1) failures.push(`convergence: link ${l.id} invalid chain strength`);
    }
  }
  if (convergence.verified === false && ((convergence.confirms || []).length || (convergence.diverges || []).length)) {
    failures.push('convergence: link observations emitted without verified inputs');
  }

  // Link history integrity
  for (const [id, entries] of Object.entries(convergence.link_history || {})) {
    if (!edgeIds.has(id)) failures.push(`convergence: link history for unknown edge ${id}`);
    const dates = (entries || []).map((e) => e.date);
    if (new Set(dates).size !== dates.length) failures.push(`convergence: duplicate dates in ${id} history`);
    if (entries.length > 10) failures.push(`convergence: ${id} history exceeds cap`);
    for (const e of entries || []) {
      if (!['confirming', 'diverging', 'neutral'].includes(e.state)) failures.push(`convergence: ${id} history state "${e.state}" invalid`);
    }
  }

  // Underpriced realism
  for (const u of convergence.underpriced || []) {
    if (!['pressure', 'divergence'].includes(u.kind)) failures.push(`convergence: underpriced kind "${u.kind}" invalid`);
    if (u.kind === 'pressure') {
      if (!PRESSURE_TRACKS.includes(u.track)) failures.push(`convergence: underpriced track "${u.track}" unknown`);
      if (!Number.isFinite(u.score) || u.score < 3) failures.push(`convergence: underpriced ${u.track} below evidence threshold`);
      if (!PRESSURE_ALERT_COVERAGE[u.track]) failures.push(`convergence: underpriced ${u.track} has no coverage mapping`);
    }
    if (!u.en || !u.ar || !/[؀-ۿ]/.test(u.ar)) failures.push('convergence: underpriced item missing bilingual text');
    if (/will (rise|fall|rally|crash)|guaranteed|buy|sell/i.test(String(u.en))) failures.push('convergence: underpriced item reads like a call');
  }
  if (convergence.verified === false && (convergence.underpriced || []).length) failures.push('convergence: underpriced asserted without verified inputs');

  // Narrative
  if (convergence.verified === false && (convergence.narrative_en || []).length) failures.push('convergence: narrative composed without verified inputs');
  if ((convergence.narrative_en || []).length !== (convergence.narrative_ar || []).length) failures.push('convergence: EN/AR narrative length mismatch');
  for (const s of convergence.narrative_en || []) {
    if (/will (rally|crash|surge|plunge)|\b\d+(\.\d+)?\s*%\s*(chance|probability)/i.test(s)) failures.push('convergence: narrative contains prediction language');
  }
  for (const s of convergence.narrative_ar || []) {
    if (!/[؀-ۿ]/.test(s)) failures.push('convergence: Arabic narrative line contains no Arabic');
  }

  // Cross-layer agreement
  if (convergence.verified === true) {
    if (cognition && cognition.verified !== true) failures.push('convergence: verified while cognition unverified — one market brain violated');
    if (macro && macro.verified !== true) failures.push('convergence: verified while macro layer unverified — one market brain violated');
  }

  console.log(`[convergence-check] ok (verified=${convergence.verified}, coherence=${coherence.band}, velocity=${velocity.band}, underpriced=${(convergence.underpriced || []).length})`);
} else {
  console.log('[convergence-check] narrative-convergence not built yet — CI builds it each run (non-fatal)');
}

if (failures.length) {
  failures.forEach((f) => console.error(`[convergence-check] FAIL: ${f}`));
  process.exit(1);
}
console.log('[convergence-check] check:narrative-convergence passed.');
