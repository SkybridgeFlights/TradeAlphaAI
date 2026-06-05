'use strict';

const fs = require('fs');
const path = require('path');
const { readMemory } = require('./macro-intelligence-core');

const ROOT = path.resolve(__dirname, '..');
const slug = argValue('--slug');
const dir = slug ? path.join(ROOT, 'drafts', 'market-outlook', slug) : null;
const html = dir && fs.existsSync(path.join(dir, 'en.html')) ? fs.readFileSync(path.join(dir, 'en.html'), 'utf8') : '';
const text = bodyText(html);
const memory = readMemory();

const checks = {
  continuity_depth: scoreContinuity(text, memory),
  cross_asset_reasoning: scorePatterns(text, [/cross-asset/i, /\bTLT\b|\bDXY\b|\bGLD\b|\bVIX\b|\bQQQ\b|\bIWM\b/, /yield|duration|dollar|gold|volatility/i], 3),
  macro_coherence: scorePatterns(text, [/policy|inflation|growth|earnings|liquidity|rates/i, /transmission|mechanism|repric/i, /scenario|conditional|catalyst/i], 3),
  institutional_density: scorePatterns(text, [/yield curve|duration|breadth|participation|liquidity|volatility regime|risk appetite|positioning|sector rotation|transmission mechanism|credit spread|risk premium|real yield/i], 5),
  scenario_realism: scorePatterns(text, [/\bif\b|\bwhen\b|\bshould\b/i, /catalyst|trigger|print|release|above|below/i, /would|could|implies|pressure|support|reprice/i], 3),
  transmission_chain_quality: scorePatterns(text, [/->|→|transmission|mechanism|leads to|results in/i, /instrument|ETF|yield|spread|sector/i], 2),
  narrative_originality: hasRepetitiveNarrative(text) ? 35 : 85,
  regime_awareness: scorePatterns(text, [/regime|risk-on|risk-off|defensive|growth momentum|volatility|breadth/i, /improving|deteriorating|persist|shift|transition|mature/i], 2)
};

const score = Math.round(Object.values(checks).reduce((sum, value) => sum + value, 0) / Object.keys(checks).length);
const report = {
  version: '1.0',
  slug: slug || null,
  scored_at: new Date().toISOString(),
  checks,
  intelligence_score: score,
  recommendation: score >= 82 ? 'institutional_intelligence_pass' : 'needs_macro_intelligence_revision'
};

console.log(JSON.stringify(report, null, 2));
if (argValue('--min-score') && score < Number(argValue('--min-score'))) process.exit(1);

function scoreContinuity(value, mem) {
  const hasMemory = (mem.snapshots || []).length > 0;
  const continuityTerms = /(prior|previous|earlier|extends|persists|deteriorat|improv|unlike|transition|continuity|regime shift|memory window)/i.test(value);
  if (hasMemory && continuityTerms) return 90;
  if (!hasMemory && /baseline|subsequent|continuity/i.test(value)) return 75;
  return hasMemory ? 45 : 65;
}

function scorePatterns(value, patterns, target) {
  const hits = patterns.filter((pattern) => pattern.test(value)).length;
  return Math.min(100, Math.round((hits / target) * 100));
}

function hasRepetitiveNarrative(value) {
  const sentences = value.split(/[.!?]+/).map((s) => s.trim().toLowerCase()).filter((s) => s.length > 40);
  return new Set(sentences).size < sentences.length * 0.85;
}

function bodyText(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function argValue(name) {
  const match = process.argv.find((arg) => arg.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : '';
}
