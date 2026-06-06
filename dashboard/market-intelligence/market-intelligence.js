(async function init() {
  const [live, memory, history, graph, calendar] = await Promise.all([
    loadJson('../../data/live-market-state.json', {}),
    loadJson('../../data/narrative-memory.json', { snapshots: [] }),
    loadJson('../../data/market-regime-history.json', { snapshots: [] }),
    loadJson('../../data/market-intelligence-graph.json', { nodes: [], edges: [] }),
    loadJson('../../data/economic-calendar.json', { events: [] })
  ]);

  const latest = memory.latest_snapshot || (memory.snapshots || []).slice(-1)[0] || {};
  const regime = live.computed_regime || {};
  const state = latest.advanced_internals || {};
  const transition = (latest.drift_notes || [])[0] || 'Narrative drift has not been established yet.';
  const sequence = latest.regime_sequence || buildSequenceFallback(latest, history);
  const divergences = buildDivergences(latest, state);

  setText('data-status', live.metadata && live.metadata.status ? live.metadata.status : 'local');
  setText('updated-at', memory.updated_at || live.metadata?.generated_at || new Date().toISOString());
  setText('macro-regime', regime.market_regime || latest.dominant_macro_narrative || 'unverified');
  setText('risk-regime', latest.dominant_risk_regime || regime.risk_regime || 'unverified');
  setText('vol-regime', latest.volatility_environment || regime.volatility_regime || 'unverified');
  setText('yield-curve', latest.yield_curve_condition || live.yield_spread_2y10y?.spread_regime || 'unverified');
  setText('breadth-quality', valueOr(latest.breadth_quality, state.sector_participation_score, 'unverified'));
  setText('concentration-score', valueOr(state.leadership_concentration, latest.concentration_risk, 'unverified'));
  setText('ai-participation', latest.ai_semiconductor_participation || state.ai_semiconductor_participation || 'unverified');
  setText('defensive-rotation', state.defensive_participation || regime.defensive_rotation || 'unverified');
  setText('drift-summary', transition);
  setText('drift-score', divergences.length ? 'active' : 'watch');
  setText('sequence-confidence', sequence.sequence_confidence ? `${sequence.sequence_confidence}` : '--');
  setText('sequence-note', sequence.note || 'No mature regime sequence is active.');
  setText('sequence-persistence', sequence.persistence_duration || '--');
  setText('sequence-maturity', sequence.transition_maturity || 'early');

  renderList('divergence-list', divergences.map((item) => `${item.signal}: ${item.commentary}`));
  setText('divergence-count', String(divergences.length));

  const sectors = latest.sector_leadership || live.sector_leadership || [];
  renderChips('sector-list', sectors.length ? sectors : ['unverified']);
  setText('sector-count', String(sectors.length || 0));

  renderGraph(graph);
  const upcoming = (calendar.events || []).filter((event) => Date.parse(event.event_time || event.date) >= Date.now()).slice(0, 6);
  renderList('calendar-list', upcoming.map((event) => `${String(event.event_time || event.date).slice(0, 16)} · ${event.event_name || event.name} · ${event.importance || event.impact_level}`));
  setText('calendar-count', upcoming.length);
  setText('expectation-status', upcoming.length ? 'active' : 'limited');
  setText('expectation-summary', upcoming[0]?.market_expectation || 'No sourced expectation is currently available.');
  setText('rates-status', live.metadata?.status || 'unverified');
  setText('rates-10y', live.us10y_yield?.value ?? '--');
  setText('rates-2y', live.us2y_yield?.value ?? '--');
  setText('rates-curve', live.yield_spread_2y10y?.spread_regime ?? '--');
  setText('cross-asset-status', live.metadata?.status === 'live' ? 'observed' : 'scenario only');
  setText('cross-asset-summary', live.metadata?.status === 'live' ? 'Monitor whether gold, DXY, and yields confirm the same policy-path interpretation.' : 'Verified reaction data is unavailable; cross-asset relationships remain conditional.');
})();

async function loadJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json();
  } catch (_) {
    return fallback;
  }
}

function buildSequenceFallback(latest) {
  const state = latest.advanced_internals || {};
  if (state.rolling_breadth_persistence === 'improving' && state.volatility_rate_state === 'compressing') {
    return { note: 'Breadth expansion is developing while volatility compresses.', sequence_confidence: 60, persistence_duration: 1, transition_maturity: 'early' };
  }
  return { note: 'Signals remain transitional across rates, breadth, volatility, and leadership.', sequence_confidence: 42, persistence_duration: 1, transition_maturity: 'early' };
}

function buildDivergences(latest, state) {
  const items = [];
  if (latest.cross_asset_divergence) items.push(latest.cross_asset_divergence);
  if (latest.qqq_change_pct > 0.35 && state.rolling_breadth_persistence === 'deteriorating') {
    items.push({ signal: 'QQQ rally with weak breadth', commentary: 'Growth strength lacks broad participation confirmation.' });
  }
  if (state.volatility_rate_state === 'compressing' && state.small_cap_confirmation === 'missing') {
    items.push({ signal: 'Falling VIX with weak small caps', commentary: 'Risk appetite remains selective despite calmer volatility pricing.' });
  }
  if (!items.length) items.push({ signal: 'No major divergence detected', commentary: 'Cross-asset contradictions are not elevated in the current local state.' });
  return items.slice(0, 5);
}

function renderList(id, values) {
  const node = document.getElementById(id);
  node.innerHTML = '';
  values.forEach((value) => {
    const li = document.createElement('li');
    li.textContent = value;
    node.appendChild(li);
  });
}

function renderChips(id, values) {
  const node = document.getElementById(id);
  node.innerHTML = '';
  values.forEach((value) => {
    const li = document.createElement('li');
    li.textContent = String(value).replace(/_/g, ' ');
    node.appendChild(li);
  });
}

function renderGraph(graph) {
  const list = document.getElementById('graph-list');
  const nodes = new Map((graph.nodes || []).map((node) => [node.id, node.label]));
  const edges = (graph.edges || []).slice(0, 9);
  setText('graph-count', `${graph.nodes?.length || 0} nodes / ${graph.edges?.length || 0} edges`);
  list.innerHTML = '';
  edges.forEach((edge) => {
    const div = document.createElement('div');
    div.className = 'edge';
    div.textContent = `${nodes.get(edge.from) || edge.from} -> ${nodes.get(edge.to) || edge.to}: ${edge.relationship} (${edge.confidence})`;
    list.appendChild(div);
  });
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value == null ? '--' : value).replace(/_/g, ' ');
}

function valueOr(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value;
  }
  return '--';
}
