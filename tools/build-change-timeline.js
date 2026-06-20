'use strict';

// Phase 216 CP6 — Change Timeline.
// Composes a chronological change stream from data/intelligence/change-events
// and the regime-history transition ledger. Real history only.
//
// Output: data/intelligence/change-timeline.json

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const J = (n) => path.join(ROOT, 'data', 'intelligence', n);
const OUT = J('change-timeline.json');
const WRITE = process.argv.includes('--write');
const MAX_ENTRIES = 200;

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function build() {
  const events = readJson(J('change-events.json'), { events: [] });
  const regimeHistory = readJson(J('regime-history.json'), { transition_history: [], timeline_entries: [] });
  const stamp = new Date().toISOString();

  const entries = [];
  for (const ev of events.events || []) {
    entries.push({
      id: ev.id,
      timestamp: ev.timestamp || null,
      entity: ev.entity,
      entity_type: ev.entity_type,
      slug: ev.slug || null,
      change_type: ev.change_type,
      label_en: ev.label_en,
      label_ar: ev.label_ar,
      from_state: ev.from_state || null,
      to_state: ev.to_state || null,
      confidence: ev.confidence || 'moderate',
      href: ev.href || null,
      research_href: ev.research_href || null,
      evidence: (ev.evidence || []).slice(0, 2),
      source: ev.source,
    });
  }
  // Regime ledger entries that are not yet emitted as transitions are still
  // worth surfacing on the timeline (with transition_marker context).
  for (const e of regimeHistory.timeline_entries || []) {
    if (!e || !e.date) continue;
    entries.push({
      id: crypto.createHash('sha256').update('regime_timeline|' + e.date + '|' + e.regime_state).digest('hex').slice(0, 16),
      timestamp: e.recorded_at || e.date,
      entity: e.regime_state,
      entity_type: 'regime',
      slug: null,
      change_type: e.transition_marker === 'initial_snapshot' ? 'stable' : 'regime_shift',
      label_en: e.transition_marker_en || e.transition_marker,
      label_ar: e.transition_marker_ar || e.transition_marker,
      from_state: null,
      to_state: e.regime_state,
      confidence: 'high',
      href: '/market-regime/',
      research_href: '/research/regime/',
      evidence: (e.evidence || []).slice(0, 2),
      source: 'regime-history-timeline',
    });
  }

  // Dedup by id.
  const seen = new Set();
  const unique = [];
  for (const x of entries) {
    if (!x.id || seen.has(x.id)) continue;
    seen.add(x.id);
    unique.push(x);
  }
  // Newest first.
  unique.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
  const capped = unique.slice(0, MAX_ENTRIES);

  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(capped)).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'change-timeline',
    total: capped.length,
    cap: MAX_ENTRIES,
    entries: capped,
    source_hash: sourceHash,
    attribution: {
      sources: ['data/intelligence/change-events.json', 'data/intelligence/regime-history.json'],
      note: 'Chronological change stream from real change events and the regime history ledger. Capped at ' + MAX_ENTRIES + ' newest entries. No fabricated entries.',
    },
  };
}

if (require.main === module) {
  const t = build();
  console.log(`[change-timeline] total=${t.total} cap=${t.cap}`);
  if (WRITE) {
    fs.writeFileSync(OUT, `${JSON.stringify(t, null, 2)}\n`, 'utf8');
    console.log('[change-timeline] wrote ' + path.relative(ROOT, OUT));
  }
}

module.exports = { build };
