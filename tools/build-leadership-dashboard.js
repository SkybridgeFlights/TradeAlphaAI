'use strict';

// Phase 210 CP3 — leadership dashboard.
// Surfaces strongest/weakest assets, sectors and equities only from rankings,
// relative-strength and ranking-history artifacts. No synthetic scores.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const INTEL = path.join(ROOT, 'data', 'intelligence');
const OUT = path.join(INTEL, 'leadership-dashboard.json');

function readJson(name, fallback = null) {
  const abs = path.join(INTEL, name);
  if (!fs.existsSync(abs)) return fallback;
  try { return JSON.parse(fs.readFileSync(abs, 'utf8')); } catch { return fallback; }
}

function routeFor(group, item, ar = false) {
  const slug = item.slug || String(item.symbol || '').toLowerCase();
  if (group === 'asset') return `${ar ? '/ar' : ''}/markets/${slug}/`;
  if (group === 'sector') return `${ar ? '/ar' : ''}/sectors/${slug}/`;
  return `${ar ? '/ar' : ''}/equities/${slug}/`;
}

function historyFor(history, group, symbol) {
  const rows = (((history || {}).groups || {})[group]) || [];
  return rows.find((row) => row.symbol === symbol) || null;
}

function pairRefs(relativeStrength, group, symbol) {
  const rows = (((relativeStrength || {}).groups || {})[group]) || [];
  return rows
    .filter((row) => row.a === symbol || row.b === symbol || row.symbol === symbol)
    .slice(0, 3)
    .map((row) => ({
      id: row.id || `${row.a || symbol}_relative`,
      label_en: row.label_en || row.id || 'relative comparison',
      label_ar: row.label_ar || 'مقارنة نسبية',
      state: row.state || 'indeterminate',
      state_en: row.state_en || row.state || 'indeterminate',
      state_ar: row.state_ar || 'غير حاسم',
      evidence: Array.isArray(row.evidence) ? row.evidence.slice(0, 3) : []
    }));
}

function normalizeItem(group, item, history, relativeStrength) {
  const movement = historyFor(history, group, item.symbol);
  return {
    symbol: item.symbol,
    slug: item.slug || String(item.symbol || '').toLowerCase(),
    rank_label: item.rank_label || item.rank_label_en || 'indeterminate',
    rank_label_en: item.rank_label_en || item.rank_label || 'indeterminate',
    rank_label_ar: item.rank_label_ar || 'غير حاسم',
    historical_direction: item.direction || movement?.observed_direction || 'indeterminate',
    historical_direction_en: item.direction_en || movement?.observed_direction || 'indeterminate',
    historical_direction_ar: item.direction_ar || movement?.movement_ar || 'غير حاسم',
    confirmation_state: item.confirmation || 'indeterminate',
    confirmation_en: item.confirmation_en || item.confirmation || 'indeterminate',
    confirmation_ar: item.confirmation_ar || 'غير حاسم',
    movement: movement ? {
      state: movement.movement || 'no_prior',
      label_en: movement.movement_en || 'no prior snapshot',
      label_ar: movement.movement_ar || 'لا لقطة سابقة',
      evidence: Array.isArray(movement.evidence) ? movement.evidence.slice(0, 3) : []
    } : {
      state: 'no_prior',
      label_en: 'no prior snapshot',
      label_ar: 'لا لقطة سابقة',
      evidence: []
    },
    links: {
      en: routeFor(group, item, false),
      ar: routeFor(group, item, true)
    },
    relative_strength_refs: pairRefs(relativeStrength, group, item.symbol),
    evidence: [
      ...(Array.isArray(item.evidence) ? item.evidence.slice(0, 4) : []),
      ...(movement && Array.isArray(movement.evidence) ? movement.evidence.slice(0, 2) : [])
    ].slice(0, 6)
  };
}

function groupDashboard(group, rankings, relativeStrength, history) {
  const data = (((rankings || {}).groups || {})[group]) || {};
  const items = Array.isArray(data.items) ? data.items.filter((item) => item.available !== false) : [];
  const strongestSymbols = new Set((data.strongest || []).slice(0, 5));
  const weakestSymbols = new Set((data.weakest || []).slice(0, 5));
  const strongest = items
    .filter((item) => strongestSymbols.has(item.symbol) || ['strongest', 'strong'].includes(item.rank_label))
    .slice(0, 5)
    .map((item) => normalizeItem(group, item, history, relativeStrength));
  const weakest = items
    .filter((item) => weakestSymbols.has(item.symbol) || ['weakest', 'weak'].includes(item.rank_label))
    .slice(-5)
    .map((item) => normalizeItem(group, item, history, relativeStrength));
  return {
    group,
    title_en: group === 'asset' ? 'Asset leadership' : group === 'sector' ? 'Sector leadership' : 'Equity leadership',
    title_ar: group === 'asset' ? 'قيادة الأصول' : group === 'sector' ? 'قيادة القطاعات' : 'قيادة الأسهم',
    available: Boolean(items.length),
    strongest,
    weakest,
    source_count: items.length
  };
}

function maxGeneratedAt(artifacts) {
  const times = artifacts.map((a) => Date.parse(a && a.generated_at)).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : '1970-01-01T00:00:00.000Z';
}

function build() {
  const rankings = readJson('rankings.json', {});
  const relativeStrength = readJson('relative-strength.json', {});
  const history = readJson('ranking-history.json', {});
  const groups = {
    asset: groupDashboard('asset', rankings, relativeStrength, history),
    sector: groupDashboard('sector', rankings, relativeStrength, history),
    equity: groupDashboard('equity', rankings, relativeStrength, history)
  };
  const digest = crypto.createHash('sha256').update(JSON.stringify({ groups })).digest('hex');
  return {
    schema_version: '1.0',
    generated_at: maxGeneratedAt([rankings, relativeStrength, history]),
    source_layer: 'leadership-dashboard',
    available: Object.values(groups).some((group) => group.available),
    groups,
    evidence_refs: Object.entries(groups).flatMap(([group, data]) => [
      ...data.strongest.slice(0, 2).map((item) => ({ source: 'rankings.json', group, symbol: item.symbol, value: item.rank_label, evidence: item.evidence.slice(0, 2) })),
      ...data.weakest.slice(0, 2).map((item) => ({ source: 'rankings.json', group, symbol: item.symbol, value: item.rank_label, evidence: item.evidence.slice(0, 2) }))
    ]),
    source_hash: digest,
    attribution: {
      sources: ['rankings.json', 'relative-strength.json', 'ranking-history.json'],
      note: 'Leadership display from existing ranking, relative-strength and ranking-history artifacts. Educational context only; no directional call, recommendation, execution level or trade instruction.'
    }
  };
}

if (require.main === module) {
  const dashboard = build();
  console.log(`[leadership-dashboard] groups=${Object.keys(dashboard.groups).length} available=${dashboard.available}`);
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(dashboard, null, 2)}\n`, 'utf8');
    console.log(`[leadership-dashboard] wrote ${path.relative(ROOT, OUT)}`);
  }
}

module.exports = { build };
