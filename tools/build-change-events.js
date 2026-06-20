'use strict';

// Phase 216 CP1 + CP2 — Change Event Engine + Classification.
// Derives discrete, evidence-backed change events from existing
// intelligence artifacts. No new engines, no fabricated events.
//
// Inputs (existing artifacts only):
//   asset-history.json / sector-history.json / equity-history.json
//   etf-history.json (entities)
//   leadership-dashboard.json (groups.{asset,sector,equity})
//   regime-history.json (timeline_entries + transition_history)
//   regime-transitions.json (current transition)
//   market-narrative.json (dominant_story → narrative_shift when supported)
//
// Outputs:
//   data/intelligence/change-events.json
//   data/intelligence/change-classifications.json
//
// Allowed change_type set (closed, validator-enforced):
//   improving / weakening / stable / deteriorating
//   leadership_gain / leadership_loss
//   confirmation_gain / confirmation_loss
//   regime_shift / narrative_shift

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const OUT_EVENTS = J('change-events.json');
const OUT_CLASS = J('change-classifications.json');
const WRITE = process.argv.includes('--write');

const ALLOWED = new Set([
  'improving', 'weakening', 'stable', 'deteriorating',
  'leadership_gain', 'leadership_loss',
  'confirmation_gain', 'confirmation_loss',
  'regime_shift', 'narrative_shift',
]);

const STATE_TO_CLASS = {
  improving: 'improving', accelerating: 'improving',
  weakening: 'weakening',
  stable: 'stable',
  deteriorating: 'deteriorating',
};

const LABELS = {
  improving: ['improving', 'يتحسن'],
  weakening: ['weakening', 'يضعف'],
  stable: ['stable', 'مستقر'],
  deteriorating: ['deteriorating', 'يتدهور'],
  leadership_gain: ['leadership gain', 'اكتساب قيادة'],
  leadership_loss: ['leadership loss', 'فقدان قيادة'],
  confirmation_gain: ['confirmation gain', 'اكتساب تأكيد'],
  confirmation_loss: ['confirmation loss', 'فقدان تأكيد'],
  regime_shift: ['regime shift', 'تحول النظام'],
  narrative_shift: ['narrative shift', 'تحول السردية'],
};

const CONFIDENCE_LABEL = { high: ['high', 'عالية'], moderate: ['moderate', 'متوسطة'], low: ['low', 'منخفضة'] };

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function hrefFor(group, slug) {
  if (!slug) return null;
  const g = String(group || '').toLowerCase();
  if (g === 'asset') return `/markets/${slug}/`;
  if (g === 'sector') return `/sectors/${slug}/`;
  if (g === 'equity') return `/equities/${slug}/`;
  if (g === 'etf') return `/research/etfs/${slug}/`;
  if (g === 'regime') return '/market-regime/';
  if (g === 'narrative') return '/market-terminal/';
  return null;
}

function researchHref(group, slug) {
  if (!slug) return null;
  const g = String(group || '').toLowerCase();
  if (g === 'asset') return `/research/assets/${slug}/`;
  if (g === 'sector') return `/research/sectors/${slug}/`;
  if (g === 'equity') return `/research/equities/${slug}/`;
  if (g === 'etf') return `/research/etfs/${slug}/`;
  return null;
}

function pushEvent(events, ev) {
  // Honesty guard — never push an event without a real allowed class + evidence.
  if (!ALLOWED.has(ev.change_type)) return;
  if (!Array.isArray(ev.evidence) || ev.evidence.length === 0) return;
  if (!ev.entity || !ev.entity_type) return;
  // Stable id for dedup across runs.
  const id = crypto.createHash('sha256').update([ev.entity_type, ev.entity, ev.change_type, ev.timestamp || '', (ev.from_state || ''), (ev.to_state || '')].join('|')).digest('hex').slice(0, 16);
  ev.id = id;
  ev.label_en = LABELS[ev.change_type][0];
  ev.label_ar = LABELS[ev.change_type][1];
  if (ev.confidence && CONFIDENCE_LABEL[ev.confidence]) {
    ev.confidence_en = CONFIDENCE_LABEL[ev.confidence][0];
    ev.confidence_ar = CONFIDENCE_LABEL[ev.confidence][1];
  }
  events.push(ev);
}

function fromEntityHistory(events, history, group, timestamp) {
  if (!history || !Array.isArray(history.items)) return;
  for (const item of history.items) {
    if (!item || item.available === false) continue;
    const state = item.overall && item.overall.state;
    if (!state || state === 'indeterminate') continue;
    const cls = STATE_TO_CLASS[state];
    if (!cls) continue;
    const band = (item.confidence_band || 'moderate').toLowerCase();
    const confidence = band === 'high' ? 'high' : band === 'low' ? 'low' : 'moderate';
    pushEvent(events, {
      entity: item.symbol,
      entity_type: group,
      slug: item.slug,
      timestamp,
      from_state: null,
      to_state: state,
      change_type: cls,
      confidence,
      source: `${group}-history`,
      href: hrefFor(group, item.slug),
      research_href: researchHref(group, item.slug),
      evidence: [
        `${group}-history overall=${state} band=${band}`,
        item.dimension_trends ? `dimension trends: ${Object.entries(item.dimension_trends).slice(0, 4).map(([k, v]) => `${k}=${(v && v.state) || 'na'}`).join(', ')}` : 'no dimension trends',
      ],
    });
  }
}

function fromEtfHistory(events, etfHistory, timestamp) {
  if (!etfHistory || !etfHistory.entities) return;
  for (const sym of Object.keys(etfHistory.entities)) {
    const e = etfHistory.entities[sym];
    if (!e) continue;
    // Prefer ledger-derived movement (real prior snapshot) when available,
    // else use the window-derived trend (real intraseries history from the
    // ETF's OWN OHLCV — honest, not fabricated).
    const usingLedger = e.movement && e.movement !== 'no_prior' && e.prior_state && e.prior_state !== 'no_prior';
    const trend = usingLedger ? e.movement : e.window_trend;
    if (!trend || trend === 'indeterminate' || trend === 'no_prior') continue;
    const cls = STATE_TO_CLASS[trend];
    if (!cls) continue;
    const band = (e.window_band || 'moderate').toLowerCase();
    const confidence = band === 'high' ? 'high' : band === 'low' ? 'low' : 'moderate';
    pushEvent(events, {
      entity: e.symbol,
      entity_type: 'etf',
      slug: e.slug,
      timestamp,
      from_state: usingLedger ? e.prior_state : null,
      to_state: e.current_state || trend,
      change_type: cls,
      confidence,
      source: usingLedger ? 'etf-history(ledger)' : 'etf-history(window)',
      href: hrefFor('etf', e.slug),
      research_href: researchHref('etf', e.slug),
      evidence: [
        usingLedger
          ? `prior ETF snapshot ${e.prior_captured_on} rank=${e.prior_state} → ${e.current_state}`
          : `intraseries window trend=${trend} band=${band} from ${e.symbol} OHLCV`,
        `current rank state=${e.current_state}`,
      ],
    });
  }
}

function fromLeadership(events, leadership, timestamp) {
  if (!leadership || !leadership.groups) return;
  for (const groupKey of ['asset', 'sector', 'equity']) {
    const g = leadership.groups[groupKey];
    if (!g) continue;
    // Two acceptable evidence paths (per spec "evidence-backed only"):
    //  (a) leadership.movement transition (real prior snapshot delta), or
    //  (b) a strongest/weakest rank PAIRED with a determinate historical
    //      direction from ranking-history (real momentum from each entity's
    //      own OHLCV windows). Either constitutes evidence — never fabricate
    //      a leadership transition without one of these.
    for (const item of g.strongest || []) {
      const mv = item.movement && item.movement.state;
      const histDir = item.historical_direction;
      const ledgerEvidence = mv && !['no_prior', 'indeterminate', 'stable'].includes(mv) && ['improving', 'accelerating'].includes(mv);
      const windowEvidence = ['improving', 'accelerating'].includes(histDir) && item.rank_label === 'strongest';
      if (!ledgerEvidence && !windowEvidence) continue;
      pushEvent(events, {
        entity: item.symbol,
        entity_type: groupKey,
        slug: item.slug,
        timestamp,
        from_state: null,
        to_state: item.rank_label,
        change_type: 'leadership_gain',
        confidence: item.confirmation_state === 'confirmed' ? 'high' : 'moderate',
        source: ledgerEvidence ? 'leadership-dashboard(ledger)' : 'leadership-dashboard(window)',
        href: hrefFor(groupKey, item.slug),
        research_href: researchHref(groupKey, item.slug),
        evidence: [
          `leadership.strongest rank=${item.rank_label} confirmation=${item.confirmation_state}`,
          ledgerEvidence ? `leadership movement=${mv}` : `historical direction=${histDir}`,
        ],
      });
    }
    for (const item of g.weakest || []) {
      const mv = item.movement && item.movement.state;
      const histDir = item.historical_direction;
      const ledgerEvidence = mv && !['no_prior', 'indeterminate', 'stable'].includes(mv) && ['weakening', 'deteriorating'].includes(mv);
      const windowEvidence = ['weakening', 'deteriorating'].includes(histDir) && item.rank_label === 'weakest';
      if (!ledgerEvidence && !windowEvidence) continue;
      pushEvent(events, {
        entity: item.symbol,
        entity_type: groupKey,
        slug: item.slug,
        timestamp,
        from_state: null,
        to_state: item.rank_label,
        change_type: 'leadership_loss',
        confidence: item.confirmation_state === 'confirmed' ? 'high' : 'moderate',
        source: ledgerEvidence ? 'leadership-dashboard(ledger)' : 'leadership-dashboard(window)',
        href: hrefFor(groupKey, item.slug),
        research_href: researchHref(groupKey, item.slug),
        evidence: [
          `leadership.weakest rank=${item.rank_label} confirmation=${item.confirmation_state}`,
          ledgerEvidence ? `leadership movement=${mv}` : `historical direction=${histDir}`,
        ],
      });
    }
  }
}

function fromRegimeHistory(events, regimeHistory) {
  if (!regimeHistory) return;
  // Per-transition events (each is a real prior→current shift recorded in
  // the regime ledger). Skip the initial_snapshot marker (it carries
  // from_state=null and is honestly not a transition).
  for (const tr of regimeHistory.transition_history || []) {
    if (!tr || !tr.to_state) continue;
    if (tr.transition_state === 'initial_snapshot' || !tr.from_state) continue;
    pushEvent(events, {
      entity: tr.to_state,
      entity_type: 'regime',
      slug: null,
      timestamp: tr.recorded_at || tr.date || null,
      from_state: tr.from_state,
      to_state: tr.to_state,
      change_type: 'regime_shift',
      confidence: 'high',
      source: 'regime-history',
      href: hrefFor('regime'),
      research_href: '/research/regime/',
      evidence: [
        `regime transitioned ${tr.from_state} → ${tr.to_state} on ${tr.date}`,
        ...(tr.evidence || []).slice(0, 2),
      ],
    });
  }
}

function fromCurrentRegimeTransition(events, regimeTransitions, dashboard) {
  if (!regimeTransitions || regimeTransitions.available !== true) return;
  const state = regimeTransitions.transition_state;
  if (!state || /stable_regime|stable/i.test(state)) return;
  const conf = (regimeTransitions.confidence_band || 'moderate').toLowerCase();
  const current = (dashboard && dashboard.current_regime && dashboard.current_regime.state) || null;
  pushEvent(events, {
    entity: state,
    entity_type: 'regime',
    slug: null,
    timestamp: regimeTransitions.generated_at || null,
    from_state: null,
    to_state: current || state,
    change_type: 'regime_shift',
    confidence: conf === 'high' ? 'high' : conf === 'low' ? 'low' : 'moderate',
    source: 'regime-transitions',
    href: hrefFor('regime'),
    research_href: '/research/regime/',
    evidence: [
      `regime-transitions transition_state=${state}`,
      ...(regimeTransitions.evidence || []).slice(0, 2),
    ],
  });
}

function fromNarrative(events, narrative, prior) {
  if (!narrative || !narrative.dominant_story) return;
  const story = narrative.dominant_story.state;
  if (!story) return;
  // We cannot fabricate a from_state when no prior narrative is recorded; only
  // emit a narrative_shift when the prior story differs from the current.
  const priorStory = prior && prior.dominant_story && prior.dominant_story.state;
  if (!priorStory || priorStory === story) return;
  pushEvent(events, {
    entity: story,
    entity_type: 'narrative',
    slug: null,
    timestamp: narrative.generated_at || null,
    from_state: priorStory,
    to_state: story,
    change_type: 'narrative_shift',
    confidence: (narrative.confidence_band || 'moderate').toLowerCase(),
    source: 'market-narrative',
    href: hrefFor('narrative'),
    research_href: '/research/regime/',
    evidence: [
      `dominant_story ${priorStory} → ${story}`,
      ...(narrative.evidence || []).slice(0, 2),
    ],
  });
}

function build() {
  const stamp = new Date().toISOString();
  const assetHistory = readJson(J('asset-history.json'));
  const sectorHistory = readJson(J('sector-history.json'));
  const equityHistory = readJson(J('equity-history.json'));
  const etfHistory = readJson(J('etf-history.json'));
  const leadership = readJson(J('leadership-dashboard.json'));
  const regimeHistory = readJson(J('regime-history.json'));
  const regimeTransitions = readJson(J('regime-transitions.json'));
  const regimeDashboard = readJson(J('market-regime-dashboard.json'));
  const narrative = readJson(J('market-narrative.json'));
  const narrativeState = readJson(J('market-narrative-state.json'));

  const events = [];
  if (assetHistory) fromEntityHistory(events, assetHistory, 'asset', assetHistory.generated_at || stamp);
  if (sectorHistory) fromEntityHistory(events, sectorHistory, 'sector', sectorHistory.generated_at || stamp);
  if (equityHistory) fromEntityHistory(events, equityHistory, 'equity', equityHistory.generated_at || stamp);
  if (etfHistory) fromEtfHistory(events, etfHistory, etfHistory.generated_at || stamp);
  if (leadership) fromLeadership(events, leadership, leadership.generated_at || stamp);
  if (regimeHistory) fromRegimeHistory(events, regimeHistory);
  if (regimeTransitions) fromCurrentRegimeTransition(events, regimeTransitions, regimeDashboard);
  // Narrative shifts only fire when narrativeState provides a determinate prior_stance.
  // narrative-continuity carries a confidence_trend but is single-snapshot — skip.
  if (narrative && narrativeState && Array.isArray(narrativeState.prior_stances) && narrativeState.prior_stances.length) {
    const priorEntry = narrativeState.prior_stances[0];
    fromNarrative(events, narrative, { dominant_story: { state: priorEntry && priorEntry.stance } });
  }

  // Dedup by id (idempotent across runs).
  const seen = new Set();
  const unique = [];
  for (const ev of events) {
    if (seen.has(ev.id)) continue;
    seen.add(ev.id);
    unique.push(ev);
  }

  // Sort newest first then by entity type bucketing.
  unique.sort((a, b) => {
    const at = a.timestamp || '';
    const bt = b.timestamp || '';
    if (at !== bt) return bt.localeCompare(at);
    return a.entity_type.localeCompare(b.entity_type) || a.entity.localeCompare(b.entity);
  });

  const counts = {};
  for (const k of ALLOWED) counts[k] = unique.filter((e) => e.change_type === k).length;
  const byCategory = {
    asset: unique.filter((e) => e.entity_type === 'asset'),
    sector: unique.filter((e) => e.entity_type === 'sector'),
    equity: unique.filter((e) => e.entity_type === 'equity'),
    etf: unique.filter((e) => e.entity_type === 'etf'),
    regime: unique.filter((e) => e.entity_type === 'regime'),
    narrative: unique.filter((e) => e.entity_type === 'narrative'),
  };
  // Significance ranking — high confidence + regime/narrative > leadership > category trends.
  const PRIO = { regime_shift: 6, narrative_shift: 5, leadership_gain: 4, leadership_loss: 4, confirmation_gain: 3, confirmation_loss: 3, improving: 2, weakening: 2, deteriorating: 2, stable: 1 };
  const CONF = { high: 3, moderate: 2, low: 1 };
  const significant = unique.slice().sort((a, b) => {
    const sa = (PRIO[a.change_type] || 0) * 10 + (CONF[a.confidence] || 0);
    const sb = (PRIO[b.change_type] || 0) * 10 + (CONF[b.confidence] || 0);
    if (sa !== sb) return sb - sa;
    return (b.timestamp || '').localeCompare(a.timestamp || '');
  }).slice(0, 12);

  const sourceHash = crypto.createHash('sha256').update(JSON.stringify(unique)).digest('hex');

  const eventsArtifact = {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'change-events',
    total: unique.length,
    counts,
    significant: significant.map((e) => e.id),
    events: unique,
    by_category: {
      asset: byCategory.asset.length,
      sector: byCategory.sector.length,
      equity: byCategory.equity.length,
      etf: byCategory.etf.length,
      regime: byCategory.regime.length,
      narrative: byCategory.narrative.length,
    },
    source_hash: sourceHash,
    attribution: {
      sources: [
        'data/intelligence/asset-history.json',
        'data/intelligence/sector-history.json',
        'data/intelligence/equity-history.json',
        'data/intelligence/etf-history.json',
        'data/intelligence/leadership-dashboard.json',
        'data/intelligence/regime-history.json',
        'data/intelligence/regime-transitions.json',
        'data/intelligence/market-narrative.json',
      ],
      note: 'Change events are derived from existing intelligence artifacts only. Every event carries an allowed change_type, a confidence band and evidence. Events without a determinate state or supporting prior are skipped (no fabrication).',
    },
  };

  // CP2 — change-classifications.json: an entity-centric view that buckets
  // every event entity by its dominant class, plus a summary per class.
  const classifications = {};
  const entityIndex = new Map();
  for (const ev of unique) {
    const key = `${ev.entity_type}:${ev.entity}`;
    if (!entityIndex.has(key)) entityIndex.set(key, []);
    entityIndex.get(key).push(ev);
  }
  for (const cls of ALLOWED) classifications[cls] = [];
  for (const [, evs] of entityIndex) {
    // Choose the highest-priority class per entity.
    const sorted = evs.slice().sort((a, b) => (PRIO[b.change_type] || 0) - (PRIO[a.change_type] || 0));
    const top = sorted[0];
    classifications[top.change_type].push({
      entity: top.entity,
      entity_type: top.entity_type,
      slug: top.slug,
      to_state: top.to_state,
      from_state: top.from_state,
      timestamp: top.timestamp,
      confidence: top.confidence,
      href: top.href,
      research_href: top.research_href,
      evidence: top.evidence,
      event_id: top.id,
    });
  }
  const classArtifact = {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'change-classifications',
    allowed_classes: [...ALLOWED],
    counts: Object.fromEntries(Object.keys(classifications).map((k) => [k, classifications[k].length])),
    classes: classifications,
    attribution: {
      sources: ['data/intelligence/change-events.json'],
      note: 'Per-entity change classification chooses the highest-priority class per entity from the change events. Classes are evidence-backed and bounded to the allowed set.',
    },
  };

  return { events: eventsArtifact, classifications: classArtifact };
}

if (require.main === module) {
  const { events, classifications } = build();
  console.log(`[change-events] total=${events.total} regime=${events.by_category.regime} narrative=${events.by_category.narrative} asset=${events.by_category.asset} sector=${events.by_category.sector} equity=${events.by_category.equity} etf=${events.by_category.etf}`);
  console.log(`[change-events] significant=${events.significant.length}`);
  for (const k of Object.keys(classifications.counts)) console.log(`  ${k.padEnd(20)} ${classifications.counts[k]}`);
  if (WRITE) {
    fs.writeFileSync(OUT_EVENTS, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
    fs.writeFileSync(OUT_CLASS, `${JSON.stringify(classifications, null, 2)}\n`, 'utf8');
    console.log('[change-events] wrote change-events.json + change-classifications.json');
  }
}

module.exports = { build, ALLOWED, LABELS };
