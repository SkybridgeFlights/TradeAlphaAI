'use strict';

// Phase 80: self-diffing intraday product artifact. It records urgency but
// never sends Telegram itself; workflow delivery remains suppressed unless a
// future sender explicitly requires urgency=high.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'data', 'intelligence', 'intraday-brief.json');
const URGENCY_LEVELS = ['quiet', 'notable', 'elevated', 'high'];

function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch { return fallback; }
}

function snapshotState() {
  const pulse = readJson('data/intelligence/market-pulse.json');
  const cognition = readJson('data/intelligence/market-cognition.json');
  const macro = readJson('data/intelligence/macro-cognition.json');
  const wire = readJson('data/newswire/wire-events.json');
  const live = readJson('data/live-market-state.json');
  const quoteChanges = {};
  const keys = ['gold', 'dxy', 'sp500', 'nasdaq', 'bitcoin', 'vix', 'us10y_yield', 'nvda', 'oil'];
  for (const key of keys) {
    const value = live[key]?.change_pct;
    quoteChanges[key] = Number.isFinite(value) ? value : null;
  }
  return {
    verified: pulse.verified === true && cognition.verified === true && macro.verified === true,
    dimensions: Object.fromEntries(Object.entries(pulse.dimensions || {}).filter(([key]) => key !== 'sourced')),
    quote_changes: quoteChanges,
    alert_ids: (cognition.alerts || []).map((item) => item.id),
    alerts: cognition.alerts || [],
    contradiction_ids: (macro.contradictions || []).filter((item) => item.active_today).map((item) => item.id),
    pressure: Object.fromEntries(Object.entries(macro.pressure?.tracks || {}).map(([key, value]) => [key, value.score])),
    catalysts: (pulse.catalysts_today || []).slice(0, 3).map((item) => ({ name: item.name, time: item.time })),
    wire_event: wire.top_story ? {
      headline: wire.top_story.headline,
      timestamp: wire.top_story.timestamp || null,
      urgency: wire.top_story.urgency || null,
    } : null,
  };
}

function diffBrief(previous, current) {
  const prior = previous?.snapshot || {};
  const changes = [];
  let urgency = 'quiet';
  const bump = (level) => {
    if (URGENCY_LEVELS.indexOf(level) > URGENCY_LEVELS.indexOf(urgency)) urgency = level;
  };

  if (!current.verified) {
    return {
      changes,
      urgency,
      note_en: 'Intraday change assertions are suspended because the current intelligence stack is unverified.',
      note_ar: 'تعليق رصد التحولات خلال الجلسة قائم لأن منظومة الاستخبارات الحالية غير موثقة.',
    };
  }

  for (const [dimension, value] of Object.entries(current.dimensions)) {
    const before = prior.dimensions?.[dimension];
    if (before && before !== 'unverified' && value !== 'unverified' && before !== value) {
      changes.push({
        kind: 'pulse-shift', dimension, from: before, to: value,
        en: `${dimension.replace(/_/g, ' ')} shifted from ${before} to ${value}.`,
        ar: `تحولت حالة ${dimension.replace(/_/g, ' ')} من ${before} إلى ${value}.`,
      });
      bump(['volatility_regime', 'market_fragility'].includes(dimension) ? 'elevated' : 'notable');
    }
  }

  for (const [asset, value] of Object.entries(current.quote_changes)) {
    const before = prior.quote_changes?.[asset];
    if (!Number.isFinite(value) || !Number.isFinite(before)) continue;
    const delta = value - before;
    if (Math.abs(delta) >= 0.5) {
      changes.push({
        kind: 'quote-driven-change', asset, from: before, to: value, delta,
        en: `${asset.replace(/_/g, ' ')} move changed by ${delta > 0 ? '+' : ''}${delta.toFixed(2)} percentage points.`,
        ar: `تغير تحرك ${asset.replace(/_/g, ' ')} بمقدار ${delta > 0 ? '+' : ''}${delta.toFixed(2)} نقطة مئوية.`,
      });
      bump(Math.abs(delta) >= 1.5 ? 'elevated' : 'notable');
    }
  }

  for (const alert of current.alerts) {
    if (!(prior.alert_ids || []).includes(alert.id)) {
      changes.push({
        kind: 'new-alert', id: alert.id, severity: alert.severity,
        en: alert.headline_en, ar: alert.headline_ar,
      });
      bump(alert.severity === 'high' ? 'high' : 'elevated');
    }
  }

  for (const id of current.contradiction_ids) {
    if (!(prior.contradiction_ids || []).includes(id)) {
      changes.push({
        kind: 'new-contradiction', id,
        en: `A new structural contradiction is active: ${id.replace(/-/g, ' ')}.`,
        ar: `ظهر تناقض هيكلي جديد قيد المتابعة: ${id}.`,
      });
      bump('elevated');
    }
  }

  for (const [track, score] of Object.entries(current.pressure)) {
    const before = prior.pressure?.[track];
    if (Number.isFinite(before) && score > before && score >= 3) {
      changes.push({
        kind: 'pressure-buildup', track, from: before, to: score,
        en: `${track.replace(/_/g, ' ')} built from ${before}/5 to ${score}/5.`,
        ar: `تصاعد ${track.replace(/_/g, ' ')} من ${before}/5 إلى ${score}/5.`,
      });
      bump(score >= 5 ? 'high' : 'elevated');
    }
  }

  if (current.wire_event?.headline && current.wire_event.headline !== prior.wire_event?.headline) {
    changes.push({
      kind: 'wire-event',
      en: `Wire event: ${current.wire_event.headline}`,
      ar: `حدث على الموجز: ${current.wire_event.headline}`,
      event: current.wire_event,
    });
    bump(Number(current.wire_event.urgency) >= 80 ? 'high' : 'notable');
  }

  return {
    changes: changes.slice(0, 10),
    urgency,
    note_en: changes.length ? null : 'No verified state changes since the previous intraday snapshot.',
    note_ar: changes.length ? null : 'لا تحولات حالة موثقة منذ اللقطة السابقة خلال الجلسة.',
  };
}

function buildIntradayBrief() {
  const previous = readJson('data/intelligence/intraday-brief.json', null);
  const snapshot = snapshotState();
  const diff = diffBrief(previous, snapshot);
  const catalystCountdown = snapshot.catalysts.map((item) => {
    const timestamp = Date.parse(item.time);
    return {
      ...item,
      minutes_until: Number.isFinite(timestamp) ? Math.max(0, Math.round((timestamp - Date.now()) / 60000)) : null,
    };
  });
  return {
    version: '1.0',
    updated_at: new Date().toISOString(),
    verified: snapshot.verified,
    urgency: diff.urgency,
    pulse_shift: diff.changes.filter((item) => item.kind === 'pulse-shift'),
    quote_driven_changes: diff.changes.filter((item) => item.kind === 'quote-driven-change'),
    new_contradictions: diff.changes.filter((item) => item.kind === 'new-contradiction'),
    pressure_buildup: diff.changes.filter((item) => item.kind === 'pressure-buildup'),
    new_alerts: diff.changes.filter((item) => item.kind === 'new-alert'),
    catalyst_countdown: catalystCountdown,
    wire_event: snapshot.wire_event,
    changes: diff.changes,
    note_en: diff.note_en,
    note_ar: diff.note_ar,
    telegram: {
      eligible: diff.urgency === 'high',
      sent: false,
      suppression_reason: diff.urgency === 'high' ? null : 'urgency_below_high_threshold',
    },
    snapshot,
    disclaimer: {
      en: 'Educational monitoring context only. Not investment advice.',
      ar: 'سياق متابعة تعليمي فقط، وليس نصيحة استثمارية.',
    },
  };
}

function main() {
  const brief = buildIntradayBrief();
  console.log(`[intraday] verified=${brief.verified} urgency=${brief.urgency} changes=${brief.changes.length} telegram_eligible=${brief.telegram.eligible}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
    fs.writeFileSync(OUT_PATH, JSON.stringify(brief, null, 2) + '\n', 'utf8');
    console.log('[intraday] wrote data/intelligence/intraday-brief.json');
  }
}

if (require.main === module) main();

module.exports = { URGENCY_LEVELS, buildIntradayBrief, diffBrief, snapshotState };
