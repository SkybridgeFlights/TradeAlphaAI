'use strict';

/**
 * Phase 69 Part B — Narrative Continuity Engine
 * Reads data/intelligence/historical-memory.json and detects:
 * - narrative persistence, reversals, transitions
 * - sector leadership transitions
 * - volatility shifts
 * - failed / strengthening / crowded narratives
 * Writes data/intelligence/narrative-continuity.json
 */

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '..');
const WRITE        = process.argv.includes('--write');
const HISTORY_PATH = path.join(ROOT, 'data', 'intelligence', 'historical-memory.json');
const OUTPUT_PATH  = path.join(ROOT, 'data', 'intelligence', 'narrative-continuity.json');

const MIN_SNAPSHOTS_FOR_ANALYSIS = 2;

function readJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function labelChanged(a, b) { return a && b && a !== b && b !== 'unknown' && b !== 'uncertain'; }

function calcPersistenceRuns(snapshots, field) {
  if (!snapshots.length) return { current_value: 'unknown', run_length: 0, stable: false };
  const latest = snapshots[snapshots.length - 1][field] || 'unknown';
  let run = 1;
  for (let i = snapshots.length - 2; i >= 0; i--) {
    if ((snapshots[i][field] || 'unknown') === latest) run++;
    else break;
  }
  return { current_value: latest, run_length: run, stable: run >= 3 };
}

function detectTransitions(snapshots, field, label) {
  const transitions = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1][field] || 'unknown';
    const curr = snapshots[i][field]     || 'unknown';
    if (labelChanged(prev, curr)) {
      transitions.push({
        date:  snapshots[i].date,
        from:  prev,
        to:    curr,
        field: label,
      });
    }
  }
  return transitions;
}

function confidenceTrend(snapshots) {
  if (snapshots.length < 2) return { direction: 'insufficient_data', delta: 0, latest: 0 };
  const recent = snapshots.slice(-5);
  const first  = recent[0].confidence || 0;
  const last   = recent[recent.length - 1].confidence || 0;
  const delta  = last - first;
  return {
    direction: delta > 5 ? 'rising' : delta < -5 ? 'falling' : 'stable',
    delta:     Math.round(delta),
    latest:    last,
    values:    recent.map((s) => ({ date: s.date, confidence: s.confidence })),
  };
}

function narrativePersistenceInsights(snapshots) {
  if (snapshots.length < MIN_SNAPSHOTS_FOR_ANALYSIS) return [];
  const insights = [];

  const marketTonePersist  = calcPersistenceRuns(snapshots, 'market_tone');
  const volStatePersist    = calcPersistenceRuns(snapshots, 'volatility_state');
  const ratePersist        = calcPersistenceRuns(snapshots, 'rate_path');
  const inflationPersist   = calcPersistenceRuns(snapshots, 'inflation_regime');

  if (marketTonePersist.stable) {
    insights.push({
      type:       'narrative_persistence',
      field:      'market_tone',
      value:      marketTonePersist.current_value,
      run_days:   marketTonePersist.run_length,
      confidence: Math.min(90, 50 + marketTonePersist.run_length * 5),
      reason_en:  `Market tone "${marketTonePersist.current_value}" has persisted for ${marketTonePersist.run_length} consecutive snapshots.`,
      reason_ar:  `نبرة السوق "${marketTonePersist.current_value}" استمرت على مدى ${marketTonePersist.run_length} لقطات متتالية.`,
    });
  }

  if (ratePersist.stable) {
    insights.push({
      type:       'narrative_persistence',
      field:      'rate_path',
      value:      ratePersist.current_value,
      run_days:   ratePersist.run_length,
      confidence: Math.min(85, 50 + ratePersist.run_length * 4),
      reason_en:  `Rate path "${ratePersist.current_value}" has been stable for ${ratePersist.run_length} consecutive periods.`,
      reason_ar:  `مسار الفائدة "${ratePersist.current_value}" استقر على مدى ${ratePersist.run_length} فترات متتالية.`,
    });
  }

  if (inflationPersist.stable) {
    insights.push({
      type:       'narrative_persistence',
      field:      'inflation_regime',
      value:      inflationPersist.current_value,
      run_days:   inflationPersist.run_length,
      confidence: Math.min(80, 45 + inflationPersist.run_length * 4),
      reason_en:  `Inflation regime "${inflationPersist.current_value}" has persisted for ${inflationPersist.run_length} consecutive periods.`,
      reason_ar:  `نظام التضخم "${inflationPersist.current_value}" استمر على مدى ${inflationPersist.run_length} فترات متتالية.`,
    });
  }

  if (volStatePersist.stable) {
    insights.push({
      type:       'narrative_persistence',
      field:      'volatility_state',
      value:      volStatePersist.current_value,
      run_days:   volStatePersist.run_length,
      confidence: Math.min(80, 45 + volStatePersist.run_length * 4),
      reason_en:  `Volatility state "${volStatePersist.current_value}" has been stable for ${volStatePersist.run_length} consecutive snapshots.`,
      reason_ar:  `حالة التذبذب "${volStatePersist.current_value}" استقرت على مدى ${volStatePersist.run_length} لقطات متتالية.`,
    });
  }

  return insights;
}

function recentTransitionInsights(snapshots) {
  if (snapshots.length < 2) return [];
  const window = snapshots.slice(-14); // Last 14 snapshots
  const insights = [];

  const fields = [
    ['market_tone',      'Market tone'],
    ['volatility_state', 'Volatility state'],
    ['rate_path',        'Rate path'],
    ['yield_curve_state','Yield curve'],
    ['inflation_regime', 'Inflation regime'],
    ['growth_regime',    'Growth regime'],
  ];

  for (const [field, label] of fields) {
    const transitions = detectTransitions(window, field, label);
    if (transitions.length > 0) {
      const last = transitions[transitions.length - 1];
      insights.push({
        type:       'regime_transition',
        field,
        from:       last.from,
        to:         last.to,
        date:       last.date,
        confidence: 65,
        reason_en:  `${label} transitioned from "${last.from}" to "${last.to}" on ${last.date}.`,
        reason_ar:  `${label} انتقل من "${last.from}" إلى "${last.to}" بتاريخ ${last.date}.`,
      });
    }
  }

  return insights;
}

function sectorLeadershipInsights(snapshots) {
  if (snapshots.length < 2) return [];
  const recent    = snapshots.slice(-5);
  const prev      = snapshots.slice(-10, -5);
  const insights  = [];

  const recentLeaders  = recent.flatMap((s) => s.sector_leadership || []);
  const prevLeaders    = prev.flatMap((s) => s.sector_leadership || []);

  // Count frequency
  const recentCounts = {};
  for (const s of recentLeaders) recentCounts[s] = (recentCounts[s] || 0) + 1;
  const prevCounts = {};
  for (const s of prevLeaders) prevCounts[s] = (prevCounts[s] || 0) + 1;

  const emerging = Object.keys(recentCounts).filter((s) => !prevCounts[s] && recentCounts[s] >= 2);
  const fading   = Object.keys(prevCounts).filter((s) => !recentCounts[s] && prevCounts[s] >= 2);
  const dominant = Object.keys(recentCounts).filter((s) => recentCounts[s] >= 3);

  if (emerging.length) {
    insights.push({
      type:       'sector_leadership_transition',
      direction:  'emerging',
      sectors:    emerging,
      confidence: 60,
      reason_en:  `Emerging sector leadership: ${emerging.join(', ')} recently appeared in multiple consecutive snapshots.`,
      reason_ar:  `قيادة قطاعية ناشئة: ${emerging.join(', ')} ظهرت في لقطات متتالية أخيرة.`,
    });
  }
  if (fading.length) {
    insights.push({
      type:       'sector_leadership_transition',
      direction:  'fading',
      sectors:    fading,
      confidence: 60,
      reason_en:  `Fading sector leadership: ${fading.join(', ')} no longer appear in recent snapshots.`,
      reason_ar:  `تراجع القيادة القطاعية: ${fading.join(', ')} لم تعد تظهر في اللقطات الأخيرة.`,
    });
  }
  if (dominant.length) {
    insights.push({
      type:       'sector_leadership_dominant',
      sectors:    dominant,
      confidence: 70,
      reason_en:  `Consistent sector leadership: ${dominant.join(', ')} appeared in 3+ of the last 5 snapshots.`,
      reason_ar:  `قيادة قطاعية ثابتة: ${dominant.join(', ')} ظهرت في 3 أو أكثر من اللقطات الخمس الأخيرة.`,
    });
  }

  return insights;
}

function volatilityShiftInsights(snapshots) {
  if (snapshots.length < 2) return [];
  const transitions = detectTransitions(snapshots.slice(-7), 'volatility_state', 'Volatility');
  if (!transitions.length) return [];
  const last = transitions[transitions.length - 1];
  const isEscalation = ['elevated', 'high', 'spike'].some((t) => last.to.includes(t));
  return [{
    type:       'volatility_shift',
    from:       last.from,
    to:         last.to,
    date:       last.date,
    escalating: isEscalation,
    confidence: 65,
    reason_en:  `Volatility shifted from "${last.from}" to "${last.to}" on ${last.date}. ${isEscalation ? 'Risk escalation detected.' : 'Volatility compression detected.'}`,
    reason_ar:  `التذبذب انتقل من "${last.from}" إلى "${last.to}" بتاريخ ${last.date}. ${isEscalation ? 'رصد تصاعد في المخاطر.' : 'رصد انضغاط في التذبذب.'}`,
  }];
}

function crowdedThemeInsights(snapshots) {
  if (snapshots.length < 5) return [];
  const recent = snapshots.slice(-10);
  const narrativeCounts = {};
  for (const s of recent) {
    for (const n of (s.dominant_narratives || [])) {
      const key = n.slice(0, 60);
      narrativeCounts[key] = (narrativeCounts[key] || 0) + 1;
    }
  }
  const crowded = Object.entries(narrativeCounts)
    .filter(([, count]) => count >= 4)
    .map(([n]) => n);
  if (!crowded.length) return [];
  return [{
    type:       'crowded_theme',
    themes:     crowded,
    confidence: 55,
    reason_en:  `Crowded narrative themes (repeated 4+ times in recent snapshots): ${crowded.slice(0, 2).join('; ')}.`,
    reason_ar:  `روايات سوقية مكتظة (تكررت 4+ مرات في اللقطات الأخيرة): ${crowded.slice(0, 2).join('; ')}.`,
  }];
}

function buildSummary(insights, confidenceTrendData, snapshots) {
  const latest      = snapshots[snapshots.length - 1] || {};
  const transitions = insights.filter((i) => i.type === 'regime_transition');
  const persistent  = insights.filter((i) => i.type === 'narrative_persistence');
  const hasTransition = transitions.length > 0;
  const hasPersistence = persistent.length > 0;

  let headline_en = `Market regime showing ${hasPersistence ? 'persistent' : 'transitioning'} conditions`;
  let headline_ar = `النظام السوقي يُظهر ظروف ${hasPersistence ? 'مستقرة' : 'انتقالية'}`;

  if (hasTransition) {
    const last = transitions[transitions.length - 1];
    headline_en = `Recent regime transition: ${last.field} shifted from ${last.from} to ${last.to}`;
    headline_ar = `انتقال حديث في النظام: ${last.field} تحول من ${last.from} إلى ${last.to}`;
  }

  const regimeStability = hasPersistence && !hasTransition ? 'stable' :
                          hasTransition ? 'transitioning' : 'uncertain';

  return {
    headline_en,
    headline_ar,
    regime_stability:    regimeStability,
    confidence_trend:    confidenceTrendData.direction,
    latest_date:         latest.date || null,
    latest_market_tone:  latest.market_tone || 'unknown',
    total_insights:      insights.length,
    has_recent_transition: hasTransition,
    key_persistent_fields: persistent.map((i) => i.field),
  };
}

function main() {
  const history = readJson(HISTORY_PATH, null);
  if (!history || !Array.isArray(history.snapshots) || history.snapshots.length < MIN_SNAPSHOTS_FOR_ANALYSIS) {
    console.log('[narrative-continuity] Insufficient historical snapshots — writing minimal output.');
    const minimal = {
      schema_version: '1.0',
      generated_at:   new Date().toISOString(),
      status:         'insufficient_data',
      min_snapshots_required: MIN_SNAPSHOTS_FOR_ANALYSIS,
      available_snapshots:    history?.snapshots?.length || 0,
      insights:               [],
      confidence_trend:       { direction: 'insufficient_data', delta: 0, latest: 0 },
      summary:                { headline_en: 'Insufficient historical data for continuity analysis', headline_ar: 'بيانات تاريخية غير كافية للتحليل', regime_stability: 'unknown' },
    };
    if (WRITE) {
      fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(minimal, null, 2), 'utf8');
      console.log(`[narrative-continuity] Written minimal output → ${path.relative(ROOT, OUTPUT_PATH)}`);
    } else {
      console.log('[narrative-continuity] Dry run — pass --write to persist.');
    }
    return;
  }

  const snapshots = history.snapshots;
  console.log(`[narrative-continuity] Analyzing ${snapshots.length} snapshots...`);

  const insights = [
    ...narrativePersistenceInsights(snapshots),
    ...recentTransitionInsights(snapshots),
    ...sectorLeadershipInsights(snapshots),
    ...volatilityShiftInsights(snapshots),
    ...crowdedThemeInsights(snapshots),
  ];

  // Add freshness score to each insight
  const now = Date.now();
  for (const insight of insights) {
    if (insight.date) {
      const ageHours = (now - new Date(insight.date).getTime()) / 3600000;
      insight.freshness_score = ageHours < 24 ? 100 : ageHours < 72 ? 80 : ageHours < 168 ? 60 : 40;
    } else {
      insight.freshness_score = 100;
    }
  }

  const confTrend = confidenceTrend(snapshots);
  const summary   = buildSummary(insights, confTrend, snapshots);

  const output = {
    schema_version:     '1.0',
    generated_at:       new Date().toISOString(),
    status:             'ok',
    total_snapshots:    snapshots.length,
    date_range:         history.date_range || null,
    confidence_trend:   confTrend,
    summary,
    insights,
  };

  console.log(`[narrative-continuity] ${insights.length} insight(s) generated.`);
  console.log(`[narrative-continuity] Summary: ${summary.headline_en}`);

  if (WRITE) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`[narrative-continuity] Written → ${path.relative(ROOT, OUTPUT_PATH)}`);
  } else {
    console.log('[narrative-continuity] Dry run — pass --write to persist.');
    console.log(JSON.stringify(output, null, 2).slice(0, 600) + '\n...');
  }
}

main();
