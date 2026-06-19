'use strict';

// Phase 210 CP4 — regime history timeline.
// Uses tracked snapshot ledgers and regime-transition artifacts only. When a
// historical dimension has not accumulated, it is marked no_prior/unavailable.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'intelligence', 'regime-history.json');

function readJson(rel, fallback = null) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return fallback;
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return fallback; }
}

function arRegime(state) {
  return {
    'risk-on': 'ميل للمخاطرة',
    'risk-off': 'عزوف عن المخاطرة',
    growth_momentum: 'زخم نمو',
    mixed: 'مختلط',
    defensive_rotation: 'دوران دفاعي',
    stable_regime: 'نظام مستقر',
    unverified: 'غير موثق',
    no_prior: 'لا تاريخ كاف'
  }[state] || 'غير حاسم';
}

function maxGeneratedAt(items) {
  const times = items.map((item) => Date.parse(item && (item.generated_at || item.last_updated))).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : '1970-01-01T00:00:00.000Z';
}

function snapshotEntry(snapshot, index, previous) {
  const changed = previous ? snapshot.market_regime !== previous.market_regime : false;
  return {
    date: snapshot.date,
    recorded_at: snapshot.recorded_at || snapshot.ts || null,
    regime_state: snapshot.market_regime || snapshot.macro_regime || 'indeterminate',
    regime_state_en: String(snapshot.market_regime || snapshot.macro_regime || 'indeterminate').replace(/_/g, ' '),
    regime_state_ar: arRegime(snapshot.market_regime || snapshot.macro_regime || 'indeterminate'),
    transition_marker: index === 0 ? 'initial_snapshot' : changed ? 'changed' : 'persisted',
    transition_marker_en: index === 0 ? 'initial snapshot' : changed ? 'changed from prior snapshot' : 'persisted from prior snapshot',
    transition_marker_ar: index === 0 ? 'اللقطة الأولى' : changed ? 'تغير عن اللقطة السابقة' : 'استمر من اللقطة السابقة',
    evidence: [
      `market_regime=${snapshot.market_regime || snapshot.macro_regime || 'indeterminate'}`,
      `defensive_rotation=${snapshot.defensive_rotation || 'unverified'}`,
      `ai_sector_momentum=${snapshot.ai_sector_momentum || 'unverified'}`
    ],
    observed: {
      spy_change_pct: snapshot.spy_change_pct ?? null,
      qqq_change_pct: snapshot.qqq_change_pct ?? null,
      iwm_change_pct: snapshot.iwm_change_pct ?? null,
      sector_leadership: Array.isArray(snapshot.sector_leadership) ? snapshot.sector_leadership.slice(0, 5) : []
    }
  };
}

function build() {
  const rolling = readJson('data/market-regime-history.json', {});
  const historicalSnapshots = readJson('data/intelligence/historical-snapshots.json', {});
  const transitions = readJson('data/intelligence/regime-transitions.json', {});
  const snapshots = Array.isArray(rolling.snapshots) ? rolling.snapshots.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
  const timeline_entries = snapshots.map((snapshot, index) => snapshotEntry(snapshot, index, snapshots[index - 1]));
  const transition_history = timeline_entries
    .filter((entry) => entry.transition_marker === 'changed' || entry.transition_marker === 'initial_snapshot')
    .map((entry) => ({
      date: entry.date,
      transition_state: entry.transition_marker,
      from_state: entry.transition_marker === 'initial_snapshot' ? null : timeline_entries[timeline_entries.indexOf(entry) - 1]?.regime_state || null,
      to_state: entry.regime_state,
      label_en: entry.transition_marker_en,
      label_ar: entry.transition_marker_ar,
      evidence: entry.evidence
    }));
  const historical_regime_states = {
    snapshot_count: snapshots.length,
    has_prior: snapshots.length > 1,
    current_state: timeline_entries.length ? timeline_entries[timeline_entries.length - 1].regime_state : 'no_prior',
    current_state_en: timeline_entries.length ? timeline_entries[timeline_entries.length - 1].regime_state_en : 'no prior',
    current_state_ar: timeline_entries.length ? timeline_entries[timeline_entries.length - 1].regime_state_ar : arRegime('no_prior'),
    ledger_state: snapshots.length > 1 ? 'available' : 'no_prior',
    ledger_state_en: snapshots.length > 1 ? 'available rolling history' : 'no prior rolling history',
    ledger_state_ar: snapshots.length > 1 ? 'تاريخ متدرج متاح' : 'لا تاريخ متدرج كاف'
  };
  const confidence_evolution = transitions && transitions.confidence_band ? [{
    date: transitions.generated_at ? transitions.generated_at.slice(0, 10) : null,
    confidence_band: transitions.confidence_band,
    confidence_band_en: transitions.confidence_band_en || transitions.confidence_band,
    confidence_band_ar: transitions.confidence_band_ar || 'غير حاسم',
    transition_state: transitions.transition_state || 'indeterminate',
    evidence: Array.isArray(transitions.evidence) ? transitions.evidence.slice(0, 3) : [],
    history_depth: 'current_transition_observation'
  }] : [{
    date: null,
    confidence_band: 'indeterminate',
    confidence_band_en: 'indeterminate',
    confidence_band_ar: 'غير حاسم',
    transition_state: 'no_prior',
    evidence: ['regime transition confidence history unavailable'],
    history_depth: 'no_prior'
  }];
  const digest = crypto.createHash('sha256').update(JSON.stringify({ timeline_entries, transition_history, confidence_evolution })).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: maxGeneratedAt([rolling, historicalSnapshots, transitions]),
    source_layer: 'regime-history',
    available: timeline_entries.length > 0,
    timeline_entries,
    historical_regime_states,
    transition_history,
    confidence_evolution,
    evidence_refs: [
      { source: 'data/market-regime-history.json', field: 'snapshots', value: String(snapshots.length), evidence: snapshots.slice(-3).map((s) => `${s.date}:${s.market_regime}`) },
      { source: 'data/intelligence/historical-snapshots.json', field: 'count', value: String(historicalSnapshots.count ?? 'indeterminate'), evidence: ['append-only intelligence snapshot ledger'] },
      { source: 'data/intelligence/regime-transitions.json', field: 'transition_state', value: transitions.transition_state || 'indeterminate', evidence: Array.isArray(transitions.evidence) ? transitions.evidence.slice(0, 3) : [] }
    ],
    source_hash: digest,
    attribution: {
      sources: ['data/market-regime-history.json', 'data/intelligence/historical-snapshots.json', 'data/intelligence/regime-transitions.json'],
      note: 'Historical context from tracked ledgers and transition artifacts. Missing depth is reported as no_prior or unavailable.'
    }
  };
}

if (require.main === module) {
  const history = build();
  console.log(`[regime-history] snapshots=${history.timeline_entries.length} transitions=${history.transition_history.length}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(history, null, 2)}\n`, 'utf8');
    console.log(`[regime-history] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
