(async function initMarketIntelligence() {
  const [live, memory, graph, calendar] = await Promise.all([
    loadJson('../data/live-market-state.json', {}),
    loadJson('../data/narrative-memory.json', { snapshots: [] }),
    loadJson('../data/market-intelligence-graph.json', { nodes: [], edges: [] }),
    loadJson('../data/economic-calendar.json', { events: [] })
  ]);

  const latest = memory.latest_snapshot || (memory.snapshots || []).slice(-1)[0] || {};
  const internals = latest.advanced_internals || {};
  const regime = live.computed_regime || {};
  const sequence = latest.regime_sequence || fallbackSequence(latest);
  const divergence = latest.cross_asset_divergence || fallbackDivergence(latest, internals);
  const signals = buildSignals(latest, internals, divergence);

  setText('data-status', `Data: ${live.metadata?.status || 'local static'}`);
  setText('memory-count', `Memory: ${(memory.snapshots || []).length} snapshots`);
  setText('last-updated', `Updated: ${formatDate(memory.updated_at || latest.created_at)}`);
  setText('dominant-narrative', latest.dominant_macro_narrative || 'Macro signals remain mixed while the system waits for verified regime inputs.');
  setText('primary-signal', `Signal: ${signals[0]?.name || 'baseline monitoring'}`);
  setText('primary-sequence', `Sequence: ${sequence.pattern || 'mixed-regime-transition'}`);

  renderRegimeCards(latest, internals, regime);
  renderTimeline(memory.snapshots || []);
  renderSignals(signals);
  renderStructure(latest, internals, sequence, graph);
  renderMacroCommand(live, calendar);
})();

function renderMacroCommand(live, calendar) {
  const upcoming = (calendar.events || []).filter((event) => Date.parse(event.event_time || event.date) >= Date.now()).filter((event) => (event.importance || event.impact_level) === 'high').slice(0, 5);
  document.getElementById('economic-calendar-panel').innerHTML = upcoming.length
    ? upcoming.map((event) => `<article class="signal-item"><strong>${escapeHtml(event.event_name || event.name)}</strong><p>${escapeHtml(String(event.event_time || event.date).slice(0, 16))} · forecast ${escapeHtml(event.forecast ?? 'unavailable')} · previous ${escapeHtml(event.previous ?? 'unavailable')}</p></article>`).join('')
    : '<p class="market-copy">No sourced high-impact events are currently loaded.</p>';
  setText('market-expectations-panel', upcoming[0]?.market_expectation || 'No sourced market expectation is currently available.');
  document.getElementById('macro-risk-monitor').innerHTML = upcoming.slice(0, 3).map((event) => `<article class="signal-item"><strong>${escapeHtml(event.event_name || event.name)}</strong><p>Watch Treasury yields, DXY, volatility, and equity breadth for confirmation or rejection.</p></article>`).join('') || '<p class="market-copy">Risk monitor is waiting for sourced events.</p>';
  setText('inflation-rates-panel', live.metadata?.status === 'live' ? `10Y ${live.us10y_yield?.value ?? '--'} · 2Y ${live.us2y_yield?.value ?? '--'} · curve ${live.yield_spread_2y10y?.spread_regime ?? '--'}` : 'Live rate inputs are unverified; analysis remains scenario-based.');
  const assets = [['Gold', live.gold], ['DXY', live.dxy], ['10Y yield', live.us10y_yield], ['S&P 500', live.sp500], ['NASDAQ', live.nasdaq], ['VIX', live.vix]];
  document.getElementById('cross-asset-heatmap').innerHTML = assets.map(([name, item]) => `<article class="signal-item"><strong>${escapeHtml(name)}</strong><p>${item?.change_pct == null ? 'unverified' : `${item.change_pct > 0 ? '+' : ''}${item.change_pct}%`}</p></article>`).join('');
  setText('gold-dollar-yields', live.metadata?.status === 'live' ? 'Use the joint direction of gold, DXY, and real-yield proxies to distinguish inflation hedging from liquidity stress.' : 'No verified joint reaction is available; avoid claiming a live correlation shift.');
}

async function loadJson(url, fallback) {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) return fallback;
    return await response.json();
  } catch (_) {
    return fallback;
  }
}

function renderRegimeCards(latest, internals, regime) {
  const cards = [
    card('Risk Regime', latest.dominant_risk_regime || regime.risk_regime, confidenceFromState(latest.dominant_risk_regime), trendLabel(latest.breadth_state), latest.dominant_macro_narrative),
    card('Volatility Regime', latest.volatility_environment || regime.volatility_regime, confidenceFromState(latest.volatility_environment), internals.volatility_rate_state, 'Volatility state is interpreted as uncertainty pricing, not prediction.'),
    card('Breadth Quality', percentLabel(latest.breadth_quality || internals.sector_participation_score), confidenceNumber(latest.breadth_quality), internals.rolling_breadth_persistence, 'Breadth measures how much participation exists beneath index levels.'),
    card('Leadership Concentration', latest.concentration_risk || internals.concentration_risk, confidenceFromState(latest.concentration_risk), directionFromConcentration(internals.leadership_concentration), 'Concentration compares narrow growth leadership against broader participation.'),
    card('Yield Curve Condition', latest.yield_curve_condition, confidenceFromState(latest.yield_curve_condition), 'policy sensitive', 'Curve state frames duration, cyclicals, and financial-sector transmission.'),
    card('Participation Quality', internals.small_cap_confirmation || latest.breadth_state, confidenceFromState(internals.small_cap_confirmation), internals.rolling_breadth_persistence, 'Small-cap confirmation helps distinguish broad risk appetite from selective positioning.'),
    card('Defensive Rotation', internals.defensive_participation || regime.defensive_rotation, confidenceFromState(internals.defensive_participation), internals.defensive_participation, 'Defensive sector strength can reveal caution beneath headline index stability.'),
    card('AI Leadership Strength', latest.ai_semiconductor_participation || internals.ai_semiconductor_participation, confidenceFromState(latest.ai_semiconductor_participation), internals.ai_semiconductor_participation, 'AI leadership is monitored for persistence, diffusion, and concentration risk.')
  ];
  document.getElementById('regime-cards').innerHTML = cards.map((item) => `
    <article class="regime-card">
      <h3>${escapeHtml(item.title)}</h3>
      <strong>${escapeHtml(normalize(item.state))}</strong>
      <dl>
        <dt>Confidence</dt><dd>${escapeHtml(item.confidence)}</dd>
        <dt>Change</dt><dd>${escapeHtml(normalize(item.change))}</dd>
        <dt>Context</dt><dd>${escapeHtml(item.context)}</dd>
      </dl>
    </article>`).join('');
}

function renderTimeline(snapshots) {
  const items = snapshots.slice(-7).reverse();
  const timeline = document.getElementById('narrative-timeline');
  if (!items.length) {
    timeline.innerHTML = '<div class="timeline-item"><strong>Baseline pending</strong><span>Narrative memory will populate as market outlook runs append institutional snapshots.</span></div>';
    return;
  }
  timeline.innerHTML = items.map((item) => `
    <div class="timeline-item">
      <strong>${escapeHtml(formatDate(item.created_at))} · ${escapeHtml(normalize(item.dominant_risk_regime || 'regime watch'))}</strong>
      <span>${escapeHtml(item.dominant_macro_narrative || 'Macro narrative was mixed.')} Breadth ${escapeHtml(normalize(item.breadth_state || 'unverified'))}; volatility ${escapeHtml(normalize(item.volatility_environment || 'unverified'))}.</span>
    </div>`).join('');
}

function renderSignals(signals) {
  const feed = document.getElementById('signal-feed');
  feed.innerHTML = signals.map((signal) => `
    <article class="signal-item">
      <strong><span>${escapeHtml(normalize(signal.name))}</span><span>${signal.confidence}</span></strong>
      <p>${escapeHtml(signal.commentary)}</p>
    </article>`).join('');
}

function renderStructure(latest, internals, sequence, graph) {
  const participation = clamp(Number(latest.breadth_quality || internals.sector_participation_score || 0), 0, 100);
  document.getElementById('sector-meter').style.width = `${participation}%`;
  setText('sector-copy', `${participation || '--'}% sector participation. ${normalize(internals.momentum_diffusion || 'momentum diffusion unverified')}.`);

  const breadth = clamp(participation, 0, 100);
  const concentration = clamp(50 + Number(internals.leadership_concentration || 0) * 12, 0, 100);
  const dot = document.querySelector('#breadth-plot span');
  dot.style.left = `${concentration}%`;
  dot.style.top = `${100 - breadth}%`;
  setText('breadth-copy', `Breadth ${breadth || '--'} versus concentration ${normalize(latest.concentration_risk || internals.concentration_risk || 'unverified')}.`);

  const ew = clamp(50 + Number(internals.equal_weight_vs_cap_weight_divergence || 0) * 25, 8, 100);
  document.getElementById('ew-bar').style.width = `${ew}%`;
  document.getElementById('cw-bar').style.width = `${clamp(100 - ew, 8, 100)}%`;
  setText('weight-copy', `Equal-weight versus cap-weight divergence: ${valueLabel(internals.equal_weight_vs_cap_weight_divergence)}.`);

  const strip = document.getElementById('persistence-strip');
  const active = clamp(Number(sequence.persistence_duration || 1), 1, 8);
  strip.innerHTML = Array.from({ length: 8 }, (_, index) => `<span class="${index < active ? 'active' : ''}"></span>`).join('');
  setText('persistence-copy', `${normalize(sequence.transition_maturity || 'early')} sequence with confidence ${sequence.sequence_confidence || '--'}.`);

  setText('vol-pill', latest.volatility_environment || internals.volatility_rate_state || 'unverified');
  setText('vol-copy', `Volatility rate state: ${normalize(internals.volatility_rate_state || 'unverified')}.`);
  setText('curve-pill', latest.yield_curve_condition || 'unverified');
  setText('curve-copy', graph.edges?.find((edge) => edge.from.includes('event:fomc'))?.relationship || 'Yield curve context is monitored through policy-path transmission.');
}

function buildSignals(latest, internals, divergence) {
  const signals = [];
  if (internals.participation_deterioration) signals.push(signal('participation deterioration', 78, 'Participation is weakening beneath the index surface; scenario work should distinguish index levels from breadth quality.'));
  if (internals.volatility_rate_state === 'compressing') signals.push(signal('volatility compression', 64, 'Lower implied uncertainty can support liquidity stabilization, but confirmation requires breadth and small-cap participation.'));
  if (latest.concentration_risk === 'elevated' || internals.concentration_risk === 'elevated') signals.push(signal('narrowing leadership', 80, 'Leadership concentration is elevated, increasing sensitivity to rotation out of dominant growth exposures.'));
  if (internals.ai_semiconductor_participation === 'improving' && internals.cyclical_participation !== 'improving') signals.push(signal('growth fragility', 69, 'AI participation is not being confirmed broadly by cyclicals, keeping cross-asset confirmation selective.'));
  if (divergence && divergence.signal && divergence.signal !== 'No major divergence detected') signals.push(signal(divergence.signal, 75, divergence.commentary));
  if (!signals.length) signals.push(signal('baseline monitoring', 52, 'No high-conviction divergence is active in local data. The system remains in observation mode until verified market state improves.'));
  return signals.slice(0, 6);
}

function fallbackSequence() {
  return { pattern: 'mixed-regime-transition', note: 'Signals remain transitional across rates, breadth, volatility, and leadership.', sequence_confidence: 42, persistence_duration: 1, transition_maturity: 'early' };
}

function fallbackDivergence(latest, internals) {
  if (latest.qqq_change_pct > 0.35 && internals.rolling_breadth_persistence === 'deteriorating') return { signal: 'QQQ rally with weak breadth', commentary: 'Growth strength lacks broad participation confirmation.' };
  return { signal: 'No major divergence detected', commentary: 'Cross-asset contradictions are not elevated in the current local state.' };
}

function card(title, state, confidence, change, context) {
  return { title, state: state || 'unverified', confidence, change: change || 'unverified', context: context || 'Historical context pending memory accumulation.' };
}

function signal(name, confidence, commentary) {
  return { name, confidence, commentary };
}

function confidenceFromState(value) {
  if (!value || value === 'unverified') return 'Low';
  if (String(value).includes('mixed')) return 'Medium';
  return 'Medium-high';
}

function confidenceNumber(value) {
  if (typeof value !== 'number') return 'Low';
  if (value >= 70) return 'High';
  if (value >= 40) return 'Medium';
  return 'Low';
}

function trendLabel(value) {
  return value || 'monitoring';
}

function directionFromConcentration(value) {
  if (typeof value !== 'number') return 'unverified';
  if (value > 1) return 'narrowing';
  if (value < -1) return 'broadening';
  return 'balanced';
}

function percentLabel(value) {
  return typeof value === 'number' ? `${value}%` : 'unverified';
}

function valueLabel(value) {
  return value === null || value === undefined ? 'unverified' : String(value);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = normalize(value || '--');
}

function normalize(value) {
  return String(value).replace(/_/g, ' ');
}

function formatDate(value) {
  if (!value) return '--';
  return String(value).slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
