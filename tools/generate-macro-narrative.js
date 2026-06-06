'use strict';

// Phase 60.2: Event-Driven Macro Narrative Engine
// Generates institutional-style commentary grounded in:
//   - actual surprise magnitude (from economic calendar)
//   - measured cross-asset reactions (from event-reaction-memory.json)
//   - historical pattern context (rolling memory by event type)
//   - live market state (current prices and regime)
//
// This is distinct from build-market-narrative.js (which interprets live prices).
// This tool interprets EVENTS: what just happened, what it means macro-structurally.
//
// Output: data/intelligence/macro-narrative.json
//
// Usage:
//   node tools/generate-macro-narrative.js          → dry run (print JSON)
//   node tools/generate-macro-narrative.js --write  → write output file

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const CAL_PATH      = path.join(ROOT, 'data', 'economic-calendar.json');
const MEMORY_PATH   = path.join(ROOT, 'data', 'intelligence', 'event-reaction-memory.json');
const LIVE_PATH     = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'intelligence', 'market-regime.json');
const EXPECT_PATH   = path.join(ROOT, 'data', 'market-expectations.json');
const OUT_PATH      = path.join(ROOT, 'data', 'intelligence', 'macro-narrative.json');

const WRITE = process.argv.includes('--write');

// Generic filler phrases that indicate low-quality narrative — reject if present
const GENERIC_PHRASES = [
  /markets await/i, /investors will be watching/i, /all eyes on/i,
  /could go either way/i, /uncertainty remains/i, /time will tell/i,
  /past performance/i, /not investment advice/i
];

function main() {
  const calendar   = readJson(CAL_PATH,    { events: [] });
  const memory     = readJson(MEMORY_PATH, { event_reactions: [], historical_patterns: {} });
  const live       = readJson(LIVE_PATH,   { metadata: { status: 'fallback' } });
  const regime     = readJson(REGIME_PATH, {});
  const expect     = readJson(EXPECT_PATH, { expectations: [] });

  const events    = calendar.events || [];
  const reactions = memory.event_reactions || [];
  const patterns  = memory.historical_patterns || {};

  const now = Date.now();
  const twoDaysMs = 2 * 86400000;

  // Recently released events (last 48h with actual values)
  const recentReleased = events
    .filter((e) => e.status === 'released' && e.actual !== null && e.actual !== undefined
      && Date.parse(e.event_time || e.date) >= now - twoDaysMs)
    .sort((a, b) => Date.parse(b.event_time || b.date) - Date.parse(a.event_time || a.date));

  // Upcoming high-impact events (next 72h)
  const upcoming = events
    .filter((e) => e.status === 'scheduled' && e.importance === 'high'
      && Date.parse(e.event_time || e.date) > now
      && Date.parse(e.event_time || e.date) <= now + 3 * 86400000)
    .sort((a, b) => Date.parse(a.event_time || a.date) - Date.parse(b.event_time || b.date));

  const releaseNarratives = recentReleased.map((event) => {
    const memEntry = reactions.find((r) => r.event_id === event.id)
      || reactions.find((r) => r.event_type === event.type && r.event_date === event.date);
    const hist = patterns[event.type];
    return buildReleaseNarrative(event, memEntry, hist, live);
  });

  const previewNarratives = upcoming.map((event) => {
    const hist = patterns[event.type];
    return buildPreviewNarrative(event, hist, expect);
  });

  const regimeNarrative = buildRegimeNarrative(regime, live, releaseNarratives);

  const output = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    data_quality: assessDataQuality(recentReleased, memory, live),
    regime_narrative: regimeNarrative,
    release_narratives: releaseNarratives,
    preview_narratives: previewNarratives,
    active_themes: deriveActiveThemes(releaseNarratives, previewNarratives, regime),
    disclaimer: 'Educational macro commentary only. This is not investment advice, a recommendation, or a prediction. Cross-asset dynamics are scenario-based, not deterministic.'
  };

  // Quality gate: reject generic narratives
  const quality = validateNarrativeQuality(output);
  if (!quality.passed) {
    console.error(`[macro-narrative] Quality gate failed: ${quality.reason}`);
    process.exit(1);
  }

  if (!WRITE) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[macro-narrative] wrote data/intelligence/macro-narrative.json`);
}

// ── Release narrative (post-event) ───────────────────────────────────────────

function buildReleaseNarrative(event, memEntry, histPattern, live) {
  const name      = event.event_name || event.type;
  const actual    = event.actual;
  const forecast  = event.forecast;
  const previous  = event.previous;
  const surprise  = memEntry || null;
  const dir       = surprise?.surprise_direction || 'near_consensus';
  const tone      = surprise?.policy_tone || 'unresolved';
  const score     = surprise?.surprise_score;
  const strength  = surprise?.surprise_strength || 'unknown';
  const unit      = event.unit ? ` ${event.unit}` : '';

  // Build factual anchor
  const factLine = buildFactLine(name, actual, forecast, previous, unit, dir, score);

  // Build rate/policy interpretation
  const policyLine = buildPolicyLine(event.type, dir, tone, actual, forecast, unit);

  // Build cross-asset transmission
  const transLine = buildTransmissionLine(event.type, dir, memEntry, histPattern);

  // Build historical context if available
  const histLine = buildHistoricalContext(event.type, dir, histPattern);

  // Build observed reaction if available
  const reactLine = memEntry?.reactions ? buildObservedReactionLine(memEntry.reactions) : null;

  const blocks = [factLine, policyLine, transLine, histLine, reactLine].filter(Boolean);

  return {
    event_id: event.id,
    event_name: name,
    event_type: event.type,
    event_date: event.date,
    surprise_direction: dir,
    surprise_strength: strength,
    policy_tone: tone,
    narrative_blocks: blocks,
    full_narrative: blocks.join(' '),
    evidence_sources: buildEvidenceSources(event, memEntry, histPattern),
    narrative_quality: blocks.length >= 2 ? 'sufficient' : 'thin'
  };
}

function buildFactLine(name, actual, forecast, previous, unit, dir, score) {
  if (actual === null || forecast === null) return `${name} was released without a consensus comparison available.`;
  const diff = parseFloat((actual - forecast).toFixed(4));
  const diffStr = diff > 0 ? `+${diff}${unit}` : `${diff}${unit}`;
  const compWord = dir === 'hotter_or_stronger' ? 'above' : dir === 'softer_or_weaker' ? 'below' : 'in line with';
  const context = previous !== null ? ` (prior: ${previous}${unit})` : '';
  const strengthNote = score !== null && Math.abs(score) >= 20 ? ` — a material deviation by recent standards` : '';
  return `${name} printed at ${actual}${unit}, ${compWord} the consensus estimate of ${forecast}${unit}${context}${strengthNote}. The headline miss versus consensus was ${diffStr}.`;
}

function buildPolicyLine(type, dir, tone, actual, forecast, unit) {
  const t = String(type || '').toLowerCase();

  if (/cpi|pce/.test(t)) {
    if (dir === 'hotter_or_stronger')
      return `An above-consensus inflation reading increases the probability that the Fed's current restrictive stance will be maintained longer — rate-cut pricing may need to reprice toward a later first cut, and terminal-rate expectations could shift higher.`;
    if (dir === 'softer_or_weaker')
      return `A below-consensus inflation reading strengthens the case for easing conditions, potentially pulling forward the window for the first rate reduction — though confirmation requires sequential softness rather than a single data point.`;
    return `The near-consensus inflation reading preserves the current policy path without forcing a material repricing — the macro context for Fed expectations is broadly unchanged.`;
  }

  if (/nfp|unemployment|jobless/.test(t)) {
    if (dir === 'hotter_or_stronger')
      return `A stronger-than-expected labor market reading reinforces the Fed's higher-for-longer framework — tight employment conditions historically delay the point at which the Fed has sufficient comfort to begin easing.`;
    if (dir === 'softer_or_weaker')
      return `A softer labor market reading introduces the type of slack that policymakers watch closely before easing — it does not in isolation justify cuts, but it shifts the balance of risks toward a more symmetric response function.`;
    return `The labor market print was broadly consistent with expectations, preserving the current balance of risks between inflation and growth without triggering a policy re-evaluation.`;
  }

  if (/fomc|fed rate/.test(t)) {
    return `FOMC decisions are transmitted through rate expectations, terminal-rate language, and balance sheet policy — the forward guidance context matters more than the decision itself when the outcome is priced in advance.`;
  }

  if (/gdp|retail|ism/.test(t)) {
    if (dir === 'hotter_or_stronger')
      return `Stronger-than-expected activity data raises the probability of a sustained growth path, which supports cyclical equity factors but may complicate the Fed's path to easing if inflation remains elevated.`;
    if (dir === 'softer_or_weaker')
      return `Softer-than-expected activity data raises growth risk concerns — while bond markets may benefit from potential rate support, equity markets face the competing pressure of lower earnings expectations.`;
    return `Activity data in line with consensus preserves the soft-landing scenario baseline without triggering a regime reclassification.`;
  }

  if (tone === 'hawkish_impulse') return `The surprise is policy-directionally hawkish, potentially reinforcing higher-for-longer rate expectations.`;
  if (tone === 'dovish_impulse')  return `The surprise is policy-directionally dovish, potentially supporting earlier easing expectations.`;
  return `The release does not carry a clear policy-directional implication in isolation.`;
}

function buildTransmissionLine(type, dir, memEntry, hist) {
  const hasObserved = memEntry?.reactions && Object.keys(memEntry.reactions).length > 0;
  const t = String(type || '').toLowerCase();

  if (hasObserved) {
    // Ground the transmission chain in actual observed data
    const r = memEntry.reactions;
    const parts = [];
    if (r.SPY?.pct_1d !== undefined) parts.push(`SPY ${fmt(r.SPY.pct_1d)}`);
    if (r.QQQ?.pct_1d !== undefined) parts.push(`QQQ ${fmt(r.QQQ.pct_1d)}`);
    if (r.Gold?.pct_1d !== undefined) parts.push(`Gold ${fmt(r.Gold.pct_1d)}`);
    if (r.TLT?.pct_1d !== undefined)  parts.push(`TLT ${fmt(r.TLT.pct_1d)}`);
    if (r.DXY?.pct_1d !== undefined)  parts.push(`DXY ${fmt(r.DXY.pct_1d)}`);
    if (r.VIX?.pct_1d !== undefined)  parts.push(`VIX ${fmt(r.VIX.pct_1d)}`);
    if (parts.length >= 2) {
      return `Observed 1-day cross-asset reaction: ${parts.join(', ')}. The transmission chain reflects the market's initial processing of the surprise magnitude.`;
    }
  }

  // Fall back to scenario-based transmission
  if (/cpi|pce/.test(t)) {
    if (dir === 'hotter_or_stronger')
      return `Hawkish CPI/PCE surprises typically transmit through the rate channel first: Treasury yields rise, DXY firms, TLT comes under pressure, and QQQ duration sensitivity becomes a headwind. Gold tends to weaken via the real-yield and dollar channel unless geopolitical or macro-hedge demand offsets it.`;
    if (dir === 'softer_or_weaker')
      return `Dovish inflation surprises typically ease real-yield pressure: Treasury yields fall, TLT and long-duration growth names (QQQ) can stabilize or rally, and DXY may soften. Gold's response depends on whether the move reflects disinflation or demand weakness.`;
    return `Near-consensus inflation data allows cross-asset transmission to be driven by composition and revisions rather than the headline — yield curve positioning and DXY are the key confirming signals.`;
  }

  if (/nfp|unemployment|jobless/.test(t)) {
    if (dir === 'hotter_or_stronger')
      return `Strong labor data activates a hawkish transmission channel: rate expectations stay restrictive, yields may hold elevated, IWM financing sensitivity rises, and cyclical sectors can see mixed reactions depending on whether labor strength is read as growth-positive or inflation-sustaining.`;
    if (dir === 'softer_or_weaker')
      return `Soft labor data creates a dovish transmission pathway: yields may fall, TLT and rate-sensitive growth can benefit, but recession risk premia also build — the net effect on equities depends heavily on whether growth or easing expectations dominate.`;
    return `Consensus labor data preserves cross-asset correlation structures without triggering repricing — the dominant driver reverts to the prevailing macro regime.`;
  }

  return `Cross-asset transmission for this event type depends on the magnitude of the surprise relative to the current pricing regime — confirmations require yield, dollar, and breadth signals to align.`;
}

function buildHistoricalContext(type, dir, hist) {
  if (!hist) return null;
  const group = dir === 'hotter_or_stronger' ? hist.hotter_than_expected
    : dir === 'softer_or_weaker' ? hist.softer_than_expected
    : null;
  if (!group || group.count < 3) return null;

  const parts = [];
  const assets = group.asset_reactions || {};
  for (const [label, data] of Object.entries(assets)) {
    if (!data || data.sample_size < 3) continue;
    if (data.consistency === 'consistently_negative' || data.consistency === 'consistently_positive') {
      parts.push(`${label} has historically moved ${data.avg_1d_pct > 0 ? 'higher' : 'lower'} (avg ${fmt(data.avg_1d_pct)}, ${data.sample_size} events, ${Math.round(data.positive_rate * 100)}% positive rate)`);
    }
  }

  if (!parts.length) return null;
  return `Historical context (${group.count} comparable events): ${parts.slice(0, 3).join('; ')}.`;
}

function buildObservedReactionLine(reactions) {
  const confirming = [];
  const conflicting = [];

  const gold = reactions.Gold?.pct_1d;
  const dxy  = reactions.DXY?.pct_1d;
  const tlt  = reactions.TLT?.pct_1d;
  const spy  = reactions.SPY?.pct_1d;

  if (Number.isFinite(gold) && Number.isFinite(dxy)) {
    if (gold < 0 && dxy > 0) confirming.push('gold/dollar moving inversely (dollar dominance)');
    else if (gold > 0 && dxy > 0) conflicting.push('gold and dollar rising together (macro hedge demand overriding inverse)');
  }
  if (Number.isFinite(tlt) && Number.isFinite(spy)) {
    if (tlt > 0 && spy > 0) confirming.push('bonds and equities advancing (falling yields + growth positive)');
    else if (tlt < 0 && spy < 0) confirming.push('simultaneous bonds and equity pressure (inflation/liquidity shock pattern)');
  }

  if (confirming.length) return `Observed cross-asset patterns: ${confirming.join('; ')}.`;
  if (conflicting.length) return `Conflicting cross-asset signals: ${conflicting.join('; ')} — the directional reaction may be transitional.`;
  return null;
}

function buildEvidenceSources(event, memEntry, hist) {
  const sources = [`Economic calendar: ${event.event_name} (${event.date})`];
  if (event.source_name) sources.push(`Source: ${event.source_name}`);
  if (memEntry?.reactions && Object.keys(memEntry.reactions).length) sources.push('FMP historical price data (day-of reaction)');
  if (hist && Object.values(hist).some((g) => g?.count >= 3)) sources.push('TradeAlphaAI event-reaction memory (historical pattern analysis)');
  return sources;
}

// ── Event preview narrative (pre-event) ──────────────────────────────────────

function buildPreviewNarrative(event, hist, expectations) {
  const name     = event.event_name || event.type;
  const forecast = event.forecast;
  const previous = event.previous;
  const unit     = event.unit ? ` ${event.unit}` : '';
  const t        = String(event.type || '').toLowerCase();

  const expectItem = (expectations.expectations || []).find((e) => e.event_id === event.id || e.event_name === event.event_name);
  const pricingNarrative = expectItem?.pricing_narrative || null;

  const contextLine = buildPreviewContext(t, forecast, previous, unit);
  const probabilityLine = buildProbabilityFrame(t, forecast, previous, unit, hist);
  const volatilityLine = buildVolatilityImpact(t, hist);
  const scenarioLine = buildScenarioFrame(t, forecast, previous, unit);
  const assetLine = buildPreviewAssets(event.type, hist);
  const pricingLine = pricingNarrative && !GENERIC_PHRASES.some((p) => p.test(pricingNarrative))
    ? `Current market pricing: ${pricingNarrative}` : null;

  const blocks = [contextLine, probabilityLine, volatilityLine, scenarioLine, assetLine, pricingLine].filter(Boolean);

  return {
    event_id: event.id,
    event_name: name,
    event_type: event.type,
    event_time: event.event_time,
    importance: event.importance,
    forecast,
    previous,
    narrative_blocks: blocks,
    full_narrative: blocks.join(' '),
    confirmation_assets: event.historical_asset_sensitivity || [],
    probability_frame: probabilityLine,
    volatility_impact: volatilityLine,
    narrative_quality: blocks.length >= 2 ? 'sufficient' : 'thin'
  };
}

function buildPreviewContext(t, forecast, previous, unit) {
  const forecastNote = forecast !== null && forecast !== undefined ? ` Consensus estimate: ${forecast}${unit}` : '';
  const prevNote = previous !== null && previous !== undefined ? ` Prior: ${previous}${unit}.` : '.';

  if (/cpi|pce/.test(t))
    return `Inflation data is the primary input for the Fed's assessment of whether the rate path needs to shift.${forecastNote}${prevNote}`;
  if (/nfp|unemployment|jobless/.test(t))
    return `Labor market releases are among the most market-sensitive data points — they directly inform the Fed's dual mandate calculation.${forecastNote}${prevNote}`;
  if (/fomc|fed rate/.test(t))
    return `FOMC decision and accompanying statement language are the dominant near-term macro event — forward guidance and dot-plot shifts carry more information than the rate decision itself.${forecastNote}${prevNote}`;
  if (/gdp/.test(t))
    return `GDP measures the broadest picture of growth health and directly informs whether the soft-landing scenario remains intact.${forecastNote}${prevNote}`;
  if (/retail/.test(t))
    return `Retail sales data measures consumer demand resilience — a key variable for whether growth remains consumption-driven in the current cycle.${forecastNote}${prevNote}`;
  if (/ism|pmi/.test(t))
    return `PMI data provides the earliest forward-looking signal of manufacturing and services activity — sustained readings below 50 indicate contraction.${forecastNote}${prevNote}`;
  return `This release provides key macro data that may adjust rate expectations or growth outlooks.${forecastNote}${prevNote}`;
}

function buildScenarioFrame(t, forecast, previous, unit) {
  if (/cpi|pce/.test(t)) {
    return `Two scenarios dominate: (1) Hot print (above consensus) — rate-cut expectations reprice later, Treasury yields may rise, DXY firms, growth/duration assets face headwind. (2) Soft print (below consensus) — rate-path expectations ease, TLT and QQQ can stabilize, DXY may soften, gold benefits from real-yield relief. Confirmation requires yield and dollar movement, not just equity reaction.`;
  }
  if (/nfp|unemployment|jobless/.test(t)) {
    return `Two scenarios dominate: (1) Strong jobs (above consensus) — hawkish re-pricing risk, higher-for-longer framework reinforced, IWM more sensitive than SPY. (2) Weak jobs (below consensus) — dovish impulse but growth risk concurrent; net equity impact depends on whether easing or recession risk dominates. IWM participation is the key confirming signal for either direction.`;
  }
  if (/fomc|fed rate/.test(t)) {
    return `Market attention will focus on: (1) Dot-plot changes for 2024–2026 rate path, (2) Chair's language on the balance of risks between inflation and growth, (3) Any changes to QT pace or balance sheet guidance. Hawkish surprise: DXY up, TLT pressure, EM and gold under stress. Dovish surprise: TLT, QQQ, and gold can all move constructively.`;
  }
  if (/gdp/.test(t)) {
    return `Above-consensus GDP supports the soft-landing narrative: cyclicals, IWM, and financials may benefit. Below-consensus GDP raises growth risk: bond proxies and gold can respond, but recession pricing also compresses equity multiples, creating mixed cross-asset signals.`;
  }
  return `Above-consensus reading may reinforce higher-for-longer rate expectations; below-consensus reading may ease them. Confirmation requires the yield and dollar markets to align with the equity direction.`;
}

function buildPreviewAssets(type, hist) {
  if (!hist) return null;
  const group = hist.hotter_than_expected;
  if (!group || group.count < 3) return null;

  const parts = [];
  const assets = group.asset_reactions || {};
  for (const [label, data] of Object.entries(assets)) {
    if (!data || data.sample_size < 3 || data.consistency === 'mixed') continue;
    parts.push(`${label} (${data.consistency.replace(/_/g, ' ')}, avg ${fmt(data.avg_1d_pct)})`);
  }
  if (!parts.length) return null;
  return `Historical sensitivity on above-consensus prints (${group.count} events): ${parts.slice(0, 4).join('; ')}.`;
}

function buildVolatilityImpact(type, hist) {
  const t = String(type || '').toLowerCase();

  if (hist) {
    const hot = hist.hotter_than_expected;
    if (hot?.count >= 3 && hot.asset_reactions?.SPY?.sample_size >= 3) {
      const spyAvg = hot.asset_reactions.SPY.avg_1d_pct;
      const tltAvg = hot.asset_reactions.TLT?.avg_1d_pct;
      const tltNote = Number.isFinite(tltAvg) ? `; TLT avg ${fmt(tltAvg)}` : '';
      return `Historical vol impact on above-consensus prints (${hot.count} events): SPY avg ${fmt(spyAvg)}${tltNote}. Above-consensus magnitude relative to prior consensus is the primary predictor of reaction size.`;
    }
  }

  if (/cpi|pce/.test(t))
    return `Historical vol impact: CPI/PCE surprises typically move SPY ±0.5–1.5%, TLT ±0.8–2.0%, and DXY ±0.3–0.8% on the day-of. The 2Y Treasury yield is the most sensitive instrument, historically moving ±5–15bp on material surprises — confirming whether the surprise triggers rate repricing.`;
  if (/nfp|unemployment|jobless/.test(t))
    return `Historical vol impact: NFP surprises typically move SPY ±0.5–1.2% and IWM ±0.7–1.5% (elevated due to financing cost channel). TLT reaction direction depends on whether the surprise is read as hawkish-holding or growth-risk. DXY typically moves ±0.3–0.6%.`;
  if (/fomc|fed rate/.test(t))
    return `Historical vol impact: FOMC events with unexpected guidance shifts move SPY ±1–3%, TLT ±1–2.5%, and DXY ±0.5–1.0%. The largest single-session vol events have historically been when the dot-plot materially contradicts prior forward-guidance language.`;
  if (/gdp/.test(t))
    return `Historical vol impact: GDP surprises produce moderate cross-asset reactions (SPY ±0.5–0.8%). Bond markets are more sensitive when the miss is large enough to revise the growth-path narrative — particularly TLT when growth risk switches from secondary to primary concern.`;
  if (/retail/.test(t))
    return `Historical vol impact: Retail sales surprises are contained movers (SPY ±0.3–0.7%). XLY and XLP see sector-specific reactions depending on whether the signal is read as demand-healthy or demand-stressed. Confirmation requires a sector breadth read, not just the headline.`;
  if (/ism|pmi/.test(t))
    return `Historical vol impact: ISM/PMI moves are typically contained (SPY ±0.3–0.6%) unless confirming or contradicting a growth-trajectory narrative already priced in. A below-50 ISM in a tightening cycle is a stronger signal than a miss in isolation.`;
  return null;
}

function buildProbabilityFrame(type, forecast, previous, unit, hist) {
  const t = String(type || '').toLowerCase();
  const forecastNote = (forecast !== null && forecast !== undefined)
    ? ` Consensus: ${forecast}${unit || ''}${previous !== null ? ` vs prior ${previous}${unit || ''}` : ''}.`
    : '';

  let beatRateNote = '';
  if (hist) {
    const hotCount  = hist.hotter_than_expected?.count || 0;
    const coldCount = hist.softer_than_expected?.count || 0;
    const consCount = hist.near_consensus?.count || 0;
    const total = hotCount + coldCount + consCount;
    if (total >= 5) {
      const hotPct  = Math.round((hotCount / total) * 100);
      const coldPct = Math.round((coldCount / total) * 100);
      beatRateNote = ` Historical beat rate (${total} events): above-consensus ~${hotPct}%, below-consensus ~${coldPct}%.`;
    }
  }

  if (/cpi|pce/.test(t)) {
    return `Probability framing:${forecastNote}${beatRateNote} Hot scenario (above consensus) — rate-cut repricing delayed, 2Y yield rises, DXY firms, TLT and QQQ face duration headwind. Confirmation signal: 2Y yield +5bp within 2 hours of release. Cool scenario (below consensus) — easing path opens, TLT and long-duration growth benefit, DXY softens. Confirmation signal: 2Y yield -5bp with gold holding. Consensus scenario — prevailing macro regime dominant; composition and revisions drive cross-asset direction.`;
  }
  if (/nfp|unemployment|jobless/.test(t)) {
    return `Probability framing:${forecastNote}${beatRateNote} Strong scenario (above consensus) — hawkish-hold repricing, IWM most sensitive via floating-rate debt channel (~40% of Russell 2000 carries variable-rate obligations). Weak scenario (below consensus) — dual-signal: dovish easing impulse competes with growth-risk premium building; net equity direction depends on which narrative dominates within the first 30 minutes. Key spread to watch: IWM vs SPY spread within 30 minutes of open.`;
  }
  if (/fomc|fed rate/.test(t)) {
    return `Probability framing:${forecastNote} Hawkish surprise (higher terminal dots, tighter forward guidance) — DXY strengthens, TLT under pressure, EM currencies and gold face headwinds. Dovish surprise (lower dots, easing signal front-loaded) — TLT, QQQ, and gold constructive, DXY softens vs G10 peers. Hold with data-dependent language — implied vol likely to compress if the outcome is fully priced-in with no material guidance shift.`;
  }
  if (/gdp/.test(t)) {
    return `Probability framing:${forecastNote}${beatRateNote} Above-consensus scenario — soft-landing narrative intact, cyclicals (IWM, XLF) and broad beta (SPY) constructive. Below-consensus scenario — growth risk premium builds, bond proxies and gold can respond, but recession pricing also compresses equity multiples — the net cross-asset direction depends on whether the miss is attributed to supply normalization or demand deterioration.`;
  }
  return `Probability framing:${forecastNote}${beatRateNote} Above-consensus outcome may reinforce higher-for-longer rate expectations and activate a hawkish transmission chain. Below-consensus outcome may ease rate pressure and support duration. Directional confirmation requires yield and dollar movement to align with the equity reaction within the first trading session.`;
}

// ── Regime narrative ─────────────────────────────────────────────────────────

function buildRegimeNarrative(regime, live, releaseNarratives) {
  const tones = releaseNarratives.map((n) => n.policy_tone).filter(Boolean);
  const hawkish = tones.filter((t) => t === 'hawkish_impulse').length;
  const dovish  = tones.filter((t) => t === 'dovish_impulse').length;

  const macroTone = hawkish > dovish ? 'hawkish-leaning' : dovish > hawkish ? 'dovish-leaning' : 'mixed';
  const toneNote  = tones.length
    ? ` Recent event flow has been ${macroTone} (${hawkish} hawkish, ${dovish} dovish surprises in the window).`
    : '';

  const regimeLine = regime?.regime && regime.regime !== 'unverified'
    ? `Current derived macro regime: ${regime.regime_label || regime.regime} (${regime.data_quality || 'derived'} data quality).`
    : 'Current macro regime is unverified; live or calendar-backed confirmation is required.';

  return `${regimeLine}${toneNote}`.trim() || null;
}

// ── Active theme extractor ────────────────────────────────────────────────────

function deriveActiveThemes(releaseNarratives, previewNarratives, regime) {
  const themes = new Set();
  for (const n of releaseNarratives) {
    if (/hawkish|rate-cut|restrictive|inflation/.test(n.full_narrative)) themes.add('rate_path_recalibration');
    if (/labor|employment|slack/.test(n.full_narrative)) themes.add('labor_market_evolution');
    if (/gold|safe.?haven|hedge/.test(n.full_narrative)) themes.add('safe_haven_demand');
    if (/growth|soft.?landing|recession/.test(n.full_narrative)) themes.add('growth_risk_monitor');
    if (/dollar|dxy/i.test(n.full_narrative)) themes.add('dollar_strength_dynamics');
  }
  for (const n of previewNarratives) {
    if (/cpi|pce|inflation/.test(n.event_type?.toLowerCase() || '')) themes.add('inflation_data_focus');
    if (/nfp|unemployment/.test(n.event_type?.toLowerCase() || '')) themes.add('labor_market_evolution');
    if (/fomc|fed/.test(n.event_type?.toLowerCase() || '')) themes.add('fomc_policy_focus');
  }
  return [...themes];
}

// ── Narrative quality gate ────────────────────────────────────────────────────

function validateNarrativeQuality(output) {
  // Check release narratives that have actual data
  for (const n of output.release_narratives) {
    if (n.narrative_quality === 'thin' && n.surprise_direction !== 'near_consensus') {
      return { passed: false, reason: `Thin narrative for material surprise: ${n.event_name}` };
    }
    const allText = n.narrative_blocks.join(' ');
    for (const pattern of GENERIC_PHRASES) {
      if (pattern.test(allText)) {
        return { passed: false, reason: `Generic filler detected in ${n.event_name} narrative: ${pattern}` };
      }
    }
  }
  return { passed: true };
}

// ── Data quality assessment ───────────────────────────────────────────────────

function assessDataQuality(recentReleased, memory, live) {
  if (!recentReleased.length) return 'no_recent_releases';
  if (memory.event_count > 10 && live?.metadata?.status === 'live') return 'high';
  if (memory.event_count > 3) return 'medium';
  return 'bootstrap';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(pctVal) {
  if (!Number.isFinite(pctVal)) return '?%';
  return `${pctVal >= 0 ? '+' : ''}${pctVal.toFixed(2)}%`;
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

main();
