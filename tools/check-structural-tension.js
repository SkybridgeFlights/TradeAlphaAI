'use strict';

const fs = require('fs');
const path = require('path');
const { REGIME_CONDITIONS, TENSION_LEVELS, TRACK_STATES, TRACKS } = require('./build-structural-tension');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'data', 'intelligence', 'structural-tension.json');
const failures = [];
const PRESSURE_CHANGES = new Set(['initialized', 'intensified', 'faded', 'stable']);
const forecast = /\b(will (crash|rally|fall|rise|surge|plunge|break out)|likely (breakout|rally|selloff)|expect (a )?(rally|decline|crash)|probability|odds of|price target|buy|sell|go long|go short)\b/i;
const forecastAr = /(سوف (ينهار|يرتفع|ينخفض)|من المرجح|نتوقع (ارتفاع|هبوط|انهيار)|احتمال بنسبة|اشتر|بيع الآن|هدف سعري)/;

function fail(message) { failures.push(message); }
function hasArabic(value) { return /[\u0600-\u06ff]/.test(String(value || '')); }

let artifact = null;
try { artifact = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (error) { fail(`artifact missing or invalid: ${error.message}`); }

if (artifact) {
  if (typeof artifact.verified !== 'boolean') fail('verified flag missing');
  if (!REGIME_CONDITIONS.includes(artifact.regime_condition)) fail(`invalid regime condition ${artifact.regime_condition}`);
  if (!TENSION_LEVELS.includes(artifact.tension_level)) fail(`invalid tension level ${artifact.tension_level}`);
  if (artifact.verified === false) {
    if (artifact.status !== 'holding_unverified') fail('unverified artifact status must hold');
    if (artifact.tension_score !== null) fail('unverified artifact asserts tension score');
    if ((artifact.active_strains || []).length) fail('unverified artifact asserts active strains');
    if (artifact.internal_stability !== null) fail('unverified artifact asserts internal stability');
    if (artifact.narrative_stability !== 'unverified') fail('unverified artifact asserts narrative stability');
  } else {
    if (!Number.isInteger(artifact.tension_score) || artifact.tension_score < 0 || artifact.tension_score > 100) fail('tension score outside 0..100');
    const active = Object.values(artifact.tracks || {}).filter((item) => item.active);
    if (artifact.regime_condition === 'stable-regime' && artifact.tension_score >= 25) fail('stable regime carries pressured score');
    if (artifact.regime_condition === 'transition-forming-regime' && active.filter((item) => item.sessions >= 2).length < 3) fail('transition-forming lacks persistent multi-track evidence');
    if (artifact.regime_condition === 'internally-conflicted-regime' && !(artifact.active_strains || []).includes('cross-asset-strain')) fail('conflicted regime lacks cross-asset strain');
  }

  for (const [id, item] of Object.entries(artifact.tracks || {})) {
    if (!TRACKS[id]) fail(`unknown tension track ${id}`);
    if (!TRACK_STATES.includes(item.state)) fail(`invalid track state ${id}:${item.state}`);
    if (!Number.isInteger(item.sessions) || item.sessions < 1) fail(`invalid persistence ${id}`);
    if (!item.en || !hasArabic(item.ar)) fail(`bilingual track parity missing ${id}`);
  }

  for (const item of artifact.strain_map || []) {
    if (!(artifact.active_strains || []).includes(item.id)) fail(`strain map contains inactive ${item.id}`);
    if (!item.en || !hasArabic(item.ar)) fail(`strain map parity missing ${item.id}`);
  }

  const texts = [
    artifact.summary_en,
    artifact.summary_ar,
    artifact.catalyst_fragility && artifact.catalyst_fragility.en,
    artifact.catalyst_fragility && artifact.catalyst_fragility.ar,
    ...(artifact.strain_map || []).flatMap((item) => [item.en, item.ar]),
  ].filter(Boolean);
  for (const text of texts) {
    if (forecast.test(text) || forecastAr.test(text)) fail(`forecasting-style language detected: ${text}`);
  }

  const history = artifact.pressure_memory || [];
  if (history.length > 40) fail('pressure memory exceeds retention cap');
  const dates = history.map((item) => item.date);
  if (new Set(dates).size !== dates.length) fail('pressure memory contains duplicate dates');
  if (JSON.stringify(dates) !== JSON.stringify([...dates].sort())) fail('pressure memory not chronological');
  for (const item of history) {
    if (!PRESSURE_CHANGES.has(item.change)) fail(`invalid pressure-memory change ${item.change}`);
    if (!Number.isInteger(item.score) || item.score < 0 || item.score > 100) fail(`pressure-memory score outside bounds on ${item.date}`);
  }

  if (artifact.verified === true) {
    const sources = [
      ['market-pulse.json', 'data/intelligence/market-pulse.json'],
      ['market-cognition.json', 'data/intelligence/market-cognition.json'],
      ['macro-cognition.json', 'data/intelligence/macro-cognition.json'],
      ['narrative-convergence.json', 'data/intelligence/narrative-convergence.json'],
      ['editorial-market-memory.json', 'data/intelligence/editorial-market-memory.json'],
    ];
    for (const [name, rel] of sources) {
      let source = null;
      try { source = JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); } catch {}
      if (!source || source.verified !== true) fail(`verified tension conflicts with unverified ${name}`);
      if (source && source.run_date && source.run_date !== artifact.run_date) fail(`verified tension date conflicts with ${name}`);
    }
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(`[structural-tension-check] FAIL: ${message}`));
  process.exit(1);
}
console.log(`[structural-tension-check] passed (verified=${artifact.verified}, condition=${artifact.regime_condition}, score=${artifact.tension_score})`);
