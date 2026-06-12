'use strict';

// Phase 72 validation — newsroom UI integrity.
// Ensures both homepages carry exactly one newsroom module section, the
// newsroom stylesheet is linked, rendered output contains no leaked template
// values, the AR section is genuinely Arabic and RTL, and no fake realtime
// claims appear (the section must carry a verified data timestamp or an
// explicit awaiting-data note).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const BEHAVIOR_MODES = ['calm-monitoring', 'elevated-volatility', 'major-catalyst', 'cross-asset-conflict', 'speculative-momentum', 'defensive-rotation'];
const INTENSITIES = ['quiet', 'measured', 'elevated'];
const PACING = ['open', 'balanced', 'compressed'];
const CATALYST_FOCUS = ['none', 'watch', 'near', 'imminent'];
const DIVERGENCE_FOCUS = ['none', 'watch', 'elevated'];
const REGIME_PRESSURE = ['stable-regime', 'pressured-regime', 'unstable-regime', 'transition-forming-regime', 'internally-conflicted-regime', 'unverified'];
const TENSION_LEVELS = ['contained', 'building', 'elevated', 'acute', 'unverified'];

function read(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return null; }
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}

for (const page of ['index.html', 'ar/index.html']) {
  const html = read(page);
  if (!html) { failures.push(`${page}: missing`); continue; }

  if (count(html, '<!-- generated:newsroom-modules:start -->') !== 1) failures.push(`${page}: newsroom start marker count != 1`);
  if (count(html, '<!-- generated:newsroom-modules:end -->') !== 1) failures.push(`${page}: newsroom end marker count != 1`);
  if (!html.includes('/css/newsroom.css')) failures.push(`${page}: newsroom.css not linked`);

  const section = html.split('<!-- generated:newsroom-modules:start -->')[1]?.split('<!-- generated:newsroom-modules:end -->')[0] || '';
  if (section.includes('id="newsroom-live"')) {
    if (count(html, 'id="newsroom-live"') !== 1) failures.push(`${page}: duplicate newsroom-live sections`);
    if (/undefined|NaN|\[object Object\]/.test(section)) failures.push(`${page}: leaked template value in newsroom section`);
    if (!/Data as of|البيانات حتى|Awaiting first data cycle|بانتظار دورة البيانات الأولى/.test(section)) {
      failures.push(`${page}: newsroom section missing verified timestamp / awaiting-data note`);
    }
    if (/\blive prices\b|\breal[- ]time quotes\b/i.test(section)) failures.push(`${page}: fake realtime claim detected`);

    // Phase 73 terminal checks: asset strip rendered once with unique symbols,
    // edition label present, desk modules present.
    if (count(section, 'nr-asset-strip') !== 1) failures.push(`${page}: asset strip count != 1`);
    const symbols = [...section.matchAll(/nr-asset-sym">([A-Z0-9]+)</g)].map((m) => m[1]);
    if (symbols.length && new Set(symbols).size !== symbols.length) failures.push(`${page}: duplicate asset symbols in strip`);
    if (!section.includes('nr-edition')) failures.push(`${page}: session edition label missing`);
    if (!section.includes('nr-hero-ribbon')) failures.push(`${page}: hero intelligence ribbon missing`);
    if (count(section, 'class="newsroom-flow"') !== 1) failures.push(`${page}: institutional newsroom flow missing or duplicated`);
    if (section.includes('class="newsroom-grid"')) failures.push(`${page}: legacy flat newsroom grid still rendered`);
    if (count(section, 'data-desk="risk"') !== 1 || count(section, 'data-desk="macro"') !== 1) {
      failures.push(`${page}: desk modules missing or duplicated`);
    }

    // Phase 82 behavioral contract. Every render exposes a bounded state
    // vocabulary. Current unverified source artifacts must remain calm,
    // open-paced and non-escalated.
    const behaviorMatch = section.match(/class="section-panel newsroom" data-session="([^"]+)" data-behavior="([^"]+)" data-intensity="([^"]+)" data-pacing="([^"]+)" data-catalyst-focus="([^"]+)" data-divergence-focus="([^"]+)" data-stress="([^"]+)" data-behavior-verified="([^"]+)" data-memory-status="([^"]+)" data-memory-character="([^"]+)" data-tension-status="([^"]+)" data-regime-pressure="([^"]+)" data-tension-level="([^"]+)" data-desk-bias="([^"]*)"/);
    if (!behaviorMatch) {
      failures.push(`${page}: behavioral newsroom metadata missing`);
    } else {
      const [, session, mode, intensity, pacing, catalystFocus, divergenceFocus, stressRaw, behaviorVerified, memoryStatus, memoryCharacter, tensionStatus, regimePressure, tensionLevel, deskBias] = behaviorMatch;
      const stress = Number(stressRaw);
      if (!['asia', 'europe', 'us-premarket', 'us-cash', 'after-hours', 'weekend'].includes(session)) failures.push(`${page}: invalid session personality "${session}"`);
      if (!BEHAVIOR_MODES.includes(mode)) failures.push(`${page}: invalid behavioral mode "${mode}"`);
      if (!INTENSITIES.includes(intensity)) failures.push(`${page}: invalid editorial intensity "${intensity}"`);
      if (!PACING.includes(pacing)) failures.push(`${page}: invalid pacing density "${pacing}"`);
      if (!CATALYST_FOCUS.includes(catalystFocus)) failures.push(`${page}: invalid catalyst focus "${catalystFocus}"`);
      if (!DIVERGENCE_FOCUS.includes(divergenceFocus)) failures.push(`${page}: invalid divergence focus "${divergenceFocus}"`);
      if (!Number.isInteger(stress) || stress < 0 || stress > 3) failures.push(`${page}: stress level outside 0..3`);
      if (!deskBias.split(',').filter(Boolean).length) failures.push(`${page}: behavioral desk bias missing`);
      if (!['verified', 'holding'].includes(memoryStatus)) failures.push(`${page}: invalid editorial memory status "${memoryStatus}"`);
      if (memoryStatus === 'holding' && memoryCharacter !== 'unavailable') failures.push(`${page}: held memory asserts a current market character`);
      if (memoryStatus === 'holding' && section.includes('data-memory-state=')) failures.push(`${page}: held memory exposes current lifecycle claims`);
      if (memoryStatus === 'holding' && section.includes('data-memory-thread=')) failures.push(`${page}: held memory leaks continuity into an active desk`);
      if (!['verified', 'holding'].includes(tensionStatus)) failures.push(`${page}: invalid structural tension status "${tensionStatus}"`);
      if (!REGIME_PRESSURE.includes(regimePressure)) failures.push(`${page}: invalid regime pressure "${regimePressure}"`);
      if (!TENSION_LEVELS.includes(tensionLevel)) failures.push(`${page}: invalid tension level "${tensionLevel}"`);
      if (tensionStatus === 'holding' && (regimePressure !== 'unverified' || tensionLevel !== 'unverified')) failures.push(`${page}: held tension asserts a structural condition`);
      if (tensionStatus === 'holding' && (section.includes('data-tension-thread=') || section.includes('nr-tension-window'))) failures.push(`${page}: held tension leaks structural emphasis`);
      if (behaviorVerified === 'false' && (mode !== 'calm-monitoring' || intensity !== 'quiet' || pacing !== 'open' || stress !== 0 || catalystFocus !== 'none' || divergenceFocus !== 'none')) {
        failures.push(`${page}: unverified behavior escalated beyond calm mode`);
      }
      if (mode === 'elevated-volatility' && (intensity !== 'elevated' || pacing !== 'compressed' || stress < 1)) {
        failures.push(`${page}: volatility escalation lacks disciplined intensity/pacing`);
      }
    }
    if (!section.includes('data-lead-mode=')) failures.push(`${page}: state-aware lead mode missing`);
    if (!section.includes(page === 'ar/index.html' ? 'الذاكرة التحريرية للسوق' : 'Editorial Market Memory')) failures.push(`${page}: editorial memory desk title missing`);

    // Phase 81 density and hierarchy: stable band order, every desk carries
    // adaptive metadata, passive desks remain compact, and high-signal desks
    // cannot fall below the priority band.
    const priorityAt = section.indexOf('data-band="priority"');
    const secondaryAt = section.indexOf('data-band="secondary"');
    const continuityAt = section.indexOf('data-band="continuity"');
    if (!(priorityAt >= 0 && secondaryAt > priorityAt && continuityAt > secondaryAt)) {
      failures.push(`${page}: desk bands missing or outside priority > structure > continuity order`);
    }
    for (const band of ['priority', 'secondary', 'continuity']) {
      if (count(section, `data-band="${band}"`) !== 1) failures.push(`${page}: desk band "${band}" missing or duplicated`);
    }
    const modules = [...section.matchAll(/<div class="nr-module" data-desk="([^"]+)" data-density="([^"]+)" data-priority="([^"]+)" data-state="([^"]+)">([\s\S]*?)<\/div>/g)];
    if (modules.length !== 13) failures.push(`${page}: expected 13 density-aware desk modules, found ${modules.length}`);
    for (const [, desk, density, priority, state, body] of modules) {
      if (!['quiet', 'compact', 'standard', 'expanded'].includes(density)) failures.push(`${page}: ${desk} invalid density "${density}"`);
      if (!['quiet', 'normal', 'high', 'critical'].includes(priority)) failures.push(`${page}: ${desk} invalid priority "${priority}"`);
      if (!['monitoring', 'active'].includes(state)) failures.push(`${page}: ${desk} invalid state "${state}"`);
      if (state === 'monitoring' && density !== 'quiet') failures.push(`${page}: monitoring desk ${desk} is not compact`);
      if (state === 'active' && density === 'quiet') failures.push(`${page}: active desk ${desk} has quiet density`);
      if (state === 'monitoring' && !body.includes('nr-empty')) failures.push(`${page}: monitoring desk ${desk} lacks intentional empty-state copy`);
    }
    const priorityBand = section.slice(priorityAt, secondaryAt);
    for (const match of section.matchAll(/<div class="nr-module" data-desk="([^"]+)" data-density="[^"]+" data-priority="(high|critical)"/g)) {
      if (!priorityBand.includes(`data-desk="${match[1]}"`)) failures.push(`${page}: high-priority desk ${match[1]} rendered below priority band`);
    }

    // Phase 74 cognition checks: alerts/memory/timeline desks rendered exactly
    // once, continuity indicator present, and no alert badge without the
    // cognition artifact actually carrying alerts.
    for (const desk of ['alerts', 'memory', 'timeline', 'conviction', 'scenarios', 'crossasset', 'positioning']) {
      if (count(section, `data-desk="${desk}"`) !== 1) failures.push(`${page}: cognition desk "${desk}" missing or duplicated`);
    }
    // Phase 75: contradiction markers and conviction content require the macro
    // cognition artifact to actually carry them (no decorative intelligence).
    if (section.includes('data-contradiction=') || section.includes('data-escalated="true"')) {
      let macro = null;
      try { macro = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intelligence/macro-cognition.json'), 'utf8')); } catch {}
      const active = ((macro && macro.contradictions) || []).filter((c) => c.active_today);
      if (!active.length) failures.push(`${page}: rendered contradictions without macro-cognition source`);
    }
    if (!section.includes('nr-continuity')) failures.push(`${page}: continuity indicator missing`);
    if (count(section, 'class="nr-lead"') !== 1) failures.push(`${page}: desk lead block missing or duplicated`);
    if (!section.includes('nr-lead-headline')) failures.push(`${page}: desk lead headline missing`);
    if (count(section, 'class="nr-watch"') !== 1) failures.push(`${page}: What to Watch block missing or duplicated`);
    if (!section.includes('data-intelligence-product="phase-80"')) failures.push(`${page}: Phase 80 product marker missing`);
    if (section.includes('data-severity=')) {
      let cognition = null;
      try { cognition = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/intelligence/market-cognition.json'), 'utf8')); } catch {}
      if (!cognition || !(cognition.alerts || []).length) failures.push(`${page}: rendered alerts without cognition alert source`);
    }
    if (page === 'ar/index.html') {
      if (!section.includes('dir="rtl"')) failures.push('ar/index.html: newsroom section missing dir="rtl"');
      if (!/[؀-ۿ]/.test(section)) failures.push('ar/index.html: newsroom section contains no Arabic text');
    }
  }
}

if (!fs.existsSync(path.join(ROOT, 'css', 'newsroom.css'))) failures.push('css/newsroom.css missing');
else {
  const css = read('css/newsroom.css') || '';
  for (const token of ['.newsroom-flow', '.nr-desk-band', '[data-state="monitoring"]', '.nr-empty::before', '[data-behavior="elevated-volatility"]', '[data-behavior="major-catalyst"]', '[data-divergence-focus="elevated"]', '[data-memory-state="unresolved"]', '[data-tension-level="elevated"]']) {
    if (!css.includes(token)) failures.push(`css/newsroom.css: missing Phase 81 density rule ${token}`);
  }
}

if (failures.length) {
  failures.forEach((f) => console.error(`[newsroom-ui] FAIL: ${f}`));
  process.exit(1);
}
console.log('[newsroom-ui] check:newsroom-ui passed.');
