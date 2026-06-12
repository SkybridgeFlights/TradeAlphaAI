'use strict';

// Phase 79 — Narrative convergence logic tests (synthetic, no file writes).

const {
  scoreCoherence, scoreVelocity, findUnderpriced, updateLinkHistory, chainStrength,
} = require('./build-narrative-convergence');

let failures = 0;
function assert(name, condition) {
  if (condition) { console.log(`  PASS ${name}`); } else { failures += 1; console.error(`  FAIL ${name}`); }
}

const link = (id, state) => ({ id, legs: [id, 'x'], state });

console.log('[test] regime coherence scoring');
{
  const aligned = scoreCoherence([link('a', 'confirming'), link('b', 'confirming'), link('c', 'neutral')], [], true);
  assert('aligned tape scores coherent', aligned.band === 'coherent' && aligned.score >= 70);
  const torn = scoreCoherence([link('a', 'diverging'), link('b', 'diverging'), link('c', 'confirming')], [], true);
  assert('diverging tape scores conflicted', torn.band === 'conflicted');
  const penalized = scoreCoherence(
    [link('a', 'confirming'), link('b', 'confirming')],
    [{ active_today: true, escalated: true }, { active_today: true, escalated: false }], true
  );
  // 2 active contradictions (×5) + 1 escalated (×10 extra) = -20
  assert('contradictions penalize the score', penalized.score === 80);
  assert('bands within vocabulary', ['coherent', 'tense', 'conflicted'].includes(penalized.band));
  const unv = scoreCoherence([link('a', 'confirming')], [], false);
  assert('unverified suppression', unv.band === 'unverified' && unv.score === null);
  const unobserved = scoreCoherence([link('a', 'unobserved')], [], true);
  assert('no observed links -> unverified band', unobserved.band === 'unverified');
  assert('coherence bilingual', /[؀-ۿ]/.test(aligned.ar) && aligned.en.length > 0);
}

console.log('[test] transition velocity');
{
  const today = new Date().toISOString().slice(0, 10);
  const old = '2020-01-01';
  assert('stable when quiet', scoreVelocity({ events: [{ date: old }] }, true).band === 'stable');
  assert('shifting at 2-3 recent', scoreVelocity({ events: [{ date: today }, { date: today }] }, true).band === 'shifting');
  assert('accelerating at 4+', scoreVelocity({ events: [{ date: today }, { date: today }, { date: today }, { date: today }] }, true).band === 'accelerating');
  assert('unverified suppression', scoreVelocity({ events: [] }, false).band === 'unverified');
}

console.log('[test] underpriced detection');
{
  const macro = {
    pressure: { tracks: {
      volatility_pressure: { score: 4 }, liquidity_pressure: { score: 1 },
      defensive_pressure: { score: 0 }, speculative_pressure: { score: 0 },
      concentration_pressure: { score: 3 }, yield_pressure: { score: 0 },
    } },
  };
  const cognitionNoAlerts = { alerts: [], memory_observations: [{ kind: 'divergence', flag: 'gold-vs-dollar', sessions: 3 }] };
  const found = findUnderpriced(macro, cognitionNoAlerts, true);
  assert('uncovered elevated pressure flagged', found.some((u) => u.kind === 'pressure' && u.track === 'volatility_pressure'));
  assert('capped at 2 items', found.length <= 2);
  assert('conditional framing, no prediction', found.every((u) => !/will|guaranteed|certain/i.test(u.en)));
  assert('bilingual', found.every((u) => /[؀-ۿ]/.test(u.ar)));

  const covered = findUnderpriced(macro, { alerts: [{ type: 'volatility-expansion' }, { type: 'momentum-exhaustion' }, { type: 'macro-divergence' }], memory_observations: cognitionNoAlerts.memory_observations }, true);
  assert('alert coverage suppresses the flag', !covered.some((u) => u.track === 'volatility_pressure') && !covered.some((u) => u.kind === 'divergence'));
  assert('unverified suppression', findUnderpriced(macro, cognitionNoAlerts, false).length === 0);
}

console.log('[test] link history + chain strength');
{
  const links = [link('dollar-gold', 'diverging'), link('yields-growth', 'confirming'), link('vix-equities', 'unobserved')];
  const h1 = updateLinkHistory(null, links, true);
  assert('observed states recorded', h1['dollar-gold'].length === 1 && h1['yields-growth'].length === 1);
  assert('unobserved states not recorded', (h1['vix-equities'] || []).length === 0);
  const prev = { link_history: { 'dollar-gold': [{ date: '2026-06-10', state: 'diverging' }, { date: '2026-06-11', state: 'diverging' }] } };
  const h2 = updateLinkHistory(prev, links, true);
  assert('chain strength counts trailing streak', chainStrength(h2['dollar-gold'], 'diverging') === 3);
  assert('streak breaks on different state', chainStrength([{ state: 'confirming' }, { state: 'diverging' }], 'diverging') === 1);
  const frozen = updateLinkHistory(prev, links, false);
  assert('unverified holds history without extending', frozen['dollar-gold'].length === 2);
  const sameDay = updateLinkHistory({ link_history: h2 }, links, true);
  assert('same-day rerun does not double-count', sameDay['dollar-gold'].length === h2['dollar-gold'].length);
}

if (failures) {
  console.error(`[test] ${failures} failure(s).`);
  process.exit(1);
}
console.log('[test] all narrative-convergence logic tests passed.');
