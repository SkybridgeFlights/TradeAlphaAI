'use strict';

// Daily Market Brief generator.
// Reads: economic-calendar.json, live-market-state.json, market-regime-state.json
// Calls: surprise-scorer, directional-bias, volatility-expectation, narrative-engine
// Optionally calls OpenAI for narrative text (requires OPENAI_API_KEY)
// Writes: data/market-brief/daily-brief-YYYY-MM-DD.json
//
// Usage: node tools/generate-market-brief.js [--date=YYYY-MM-DD] [--write] [--dry-run]

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const { scoreEvents }                = require('./providers/market-brief/surprise-scorer');
const { computeBias }                = require('./providers/market-brief/directional-bias');
const { computeVolatilityExpectation } = require('./providers/market-brief/volatility-expectation');
const { buildNarrativeContext, buildPrompt } = require('./providers/market-brief/narrative-engine');
const { summarizePattern }           = require('./providers/market-brief/historical-tracker');

const ROOT          = path.resolve(__dirname, '..');
const CALENDAR_PATH = path.join(ROOT, 'data', 'economic-calendar.json');
const LIVE_STATE    = path.join(ROOT, 'data', 'live-market-state.json');
const REGIME_PATH   = path.join(ROOT, 'data', 'market-regime-state.json');
const BRIEF_DIR     = path.join(ROOT, 'data', 'market-brief');

const dateArg  = argValue('--date');
const doWrite  = process.argv.includes('--write');
const dryRun   = process.argv.includes('--dry-run');
const targetDate = dateArg || new Date().toISOString().slice(0, 10);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || 'gpt-4o-mini';
const TIMEOUT_MS     = 60000;

main().catch((err) => { console.error('[market-brief] Fatal:', err.message); process.exit(1); });

async function main() {
  console.log(`[market-brief] Generating brief for ${targetDate}`);

  const calendar    = readJson(CALENDAR_PATH, { events: [] });
  const marketState = readJson(LIVE_STATE, {});
  const regimeState = readJson(REGIME_PATH, {});

  if (regimeState.computed_regime && !marketState.computed_regime) {
    marketState.computed_regime = regimeState.computed_regime;
  }

  const events = Array.isArray(calendar.events) ? calendar.events : [];
  const todayEvents = events.filter((e) => (e.event_time || '').slice(0, 10) === targetDate);

  console.log(`[market-brief] ${events.length} total events, ${todayEvents.length} today`);

  // Score released events
  const allScored   = scoreEvents(events);
  const todayScored = allScored.filter((r) => (r.event.event_time || '').slice(0, 10) === targetDate);

  console.log(`[market-brief] ${todayScored.length} scored releases today`);

  // Directional bias
  const biases = computeBias(todayScored, marketState);

  // Volatility expectation
  const volatility = computeVolatilityExpectation(todayEvents, marketState);

  // Narrative context
  const context = buildNarrativeContext(events, biases, volatility, marketState, todayScored, targetDate);

  // Top surprises for the brief
  const topSurprises = todayScored
    .filter((r) => r.scored.magnitude >= 1.5)
    .sort((a, b) => Math.abs(b.scored.score) - Math.abs(a.scored.score))
    .slice(0, 4)
    .map((r) => ({
      name: r.event.event_name,
      label: r.scored.label,
      direction: r.scored.direction,
      magnitude_pct: r.scored.magnitude,
      historical_pattern: summarizePattern(r.event.event_name),
    }));

  // AI narrative (optional)
  let narrative_en = null;
  let narrative_ar = null;

  if (OPENAI_API_KEY && !dryRun) {
    console.log('[market-brief] Calling OpenAI for narrative...');
    const promptEn = buildPrompt(context, 'en');
    const promptAr = buildPrompt(context, 'ar');
    [narrative_en, narrative_ar] = await Promise.all([
      callOpenAI(promptEn).catch((err) => { console.warn('[market-brief] OpenAI EN failed:', err.message); return null; }),
      callOpenAI(promptAr).catch((err) => { console.warn('[market-brief] OpenAI AR failed:', err.message); return null; }),
    ]);
    if (narrative_en) console.log('[market-brief] EN narrative generated');
    if (narrative_ar) console.log('[market-brief] AR narrative generated');
  } else {
    if (!OPENAI_API_KEY) console.log('[market-brief] OPENAI_API_KEY not set — structural brief only');
    if (dryRun)         console.log('[market-brief] Dry-run mode — skipping OpenAI call');
  }

  const brief = {
    version:              '1.0',
    generated_at:         new Date().toISOString(),
    date:                 targetDate,
    data_status:          events.length ? 'live' : 'empty',
    event_count:          todayEvents.length,
    scored_count:         todayScored.length,
    top_surprises:        topSurprises,
    directional_biases:   biases,
    volatility_expectation: volatility,
    narrative_en,
    narrative_ar,
    market_regime:        context.market_regime,
    live_prices:          context.live_prices,
    disclaimer:           'Educational macro commentary only. Not investment advice.',
  };

  console.log('[market-brief] Brief summary:');
  console.log(`  Volatility: ${volatility.level} (${volatility.score}/100)`);
  console.log(`  Gold bias:  ${biases.gold?.direction} (${biases.gold?.strength})`);
  console.log(`  USD bias:   ${biases.usd?.direction}  (${biases.usd?.strength})`);
  console.log(`  SPY bias:   ${biases.spy?.direction}  (${biases.spy?.strength})`);
  console.log(`  Nasdaq bias:${biases.nasdaq?.direction} (${biases.nasdaq?.strength})`);
  if (topSurprises.length) console.log(`  Top surprise: ${topSurprises[0].name} — ${topSurprises[0].label}`);
  if (narrative_en) console.log(`  EN narrative: ${narrative_en.slice(0, 80)}...`);

  if (doWrite && !dryRun) {
    fs.mkdirSync(BRIEF_DIR, { recursive: true });
    const outPath = path.join(BRIEF_DIR, `daily-brief-${targetDate}.json`);
    const latestPath = path.join(BRIEF_DIR, 'latest-brief.json');
    fs.writeFileSync(outPath, JSON.stringify(brief, null, 2) + '\n', 'utf8');
    fs.writeFileSync(latestPath, JSON.stringify(brief, null, 2) + '\n', 'utf8');
    console.log(`[market-brief] Written: ${path.relative(ROOT, outPath)}`);
    console.log(`[market-brief] Written: ${path.relative(ROOT, latestPath)}`);
  } else if (dryRun) {
    console.log('[market-brief] Dry-run: no files written');
  } else {
    console.log('[market-brief] Add --write to persist output');
  }

  // Output JSON to stdout for subprocess use
  if (!doWrite) process.stdout.write(JSON.stringify(brief, null, 2) + '\n');

  console.log('[market-brief] Done.');
}

function callOpenAI(prompt) {
  const body = JSON.stringify({
    model: OPENAI_MODEL,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user',   content: prompt.user },
    ],
    max_tokens: 400,
    temperature: 0.4,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.openai.com',
      path:     '/v1/chat/completions',
      method:   'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Length': Buffer.byteLength(body, 'utf8'),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { return reject(new Error(`Non-JSON: ${data.slice(0, 80)}`)); }
        if (parsed.error) return reject(new Error(parsed.error.message || 'OpenAI error'));
        const text = parsed.choices?.[0]?.message?.content?.trim();
        if (!text) return reject(new Error('Empty OpenAI response'));
        resolve(text);
      });
    });
    req.on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error('OpenAI timeout')));
    req.write(body, 'utf8');
    req.end();
  });
}

function readJson(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) { /* fall through */ }
  return fallback;
}

function argValue(name) {
  const match = process.argv.find((a) => a.startsWith(name + '='));
  return match ? match.slice(name.length + 1) : '';
}
