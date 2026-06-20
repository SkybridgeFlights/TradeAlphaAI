'use strict';

// Phase 215 CP1 — ETF provider audit.
// Derives a per-ETF provider attempt matrix from the etf-charts.json
// diagnostics (no fabrication). Reports provider attempts, success/failure,
// bars found, source selected, availability status and failure reason.
//
// Output: data/intelligence/etf-provider-audit.json
// Usage: node tools/build-etf-provider-audit.js [--write]

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const CHARTS = path.join(ROOT, 'data', 'intelligence', 'etf-charts.json');
const OUT = path.join(ROOT, 'data', 'intelligence', 'etf-provider-audit.json');
const WRITE = process.argv.includes('--write');
const APPROVED_PROVIDERS = ['FMP', 'Finnhub', 'AlphaVantage', 'Yahoo'];
const KEYED = new Set(['FMP', 'Finnhub', 'AlphaVantage']);

function readJson(p, f = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return f; }
}

function build() {
  const manifest = readJson(CHARTS, {});
  const diagnostics = Array.isArray(manifest.diagnostics) ? manifest.diagnostics : [];
  const charts = Array.isArray(manifest.charts) ? manifest.charts : [];
  const unavailable = Array.isArray(manifest.unavailable) ? manifest.unavailable : [];
  const diagBySymbol = new Map(diagnostics.map((d) => [d.symbol, d]));
  const chartBySymbol = new Map(charts.filter((c) => c.verified === true).map((c) => [c.symbol, c]));
  const unavBySymbol = new Map(unavailable.map((u) => [u.symbol, u]));
  const ph = manifest.provider_health || {};
  const stamp = new Date().toISOString();

  const etfs = ETFS.map((etf) => {
    const d = diagBySymbol.get(etf.symbol);
    const chart = chartBySymbol.get(etf.symbol);
    const unav = unavBySymbol.get(etf.symbol);
    const attempts = d && Array.isArray(d.attempts) ? d.attempts.map((a) => ({
      provider: a.provider,
      outcome: a.outcome,
      bars_found: Number.isFinite(a.bars_found) ? a.bars_found : null,
      note: a.note || null,
    })) : [];
    const success = !!chart;
    const selected = d && d.resolved
      ? { provider: d.resolved.provider, bars_found: d.resolved.bars_found || null, response_hash: d.resolved.response_hash || null }
      : null;
    const availability = success ? 'available' : 'unavailable';
    const failure_reason = success ? null : (unav && unav.reason) || (d && d.reason) || 'approved_ohlcv_unavailable';
    const bars_available = chart ? (chart.bar_count || (chart.series || []).length) : 0;
    return {
      symbol: etf.symbol,
      slug: etf.slug,
      category: etf.category,
      attempts,
      success,
      selected_source: selected,
      bars_available,
      availability,
      failure_reason,
      checked_at: (d && d.checked_at) || null,
    };
  });

  const providers = APPROVED_PROVIDERS.map((name) => {
    let attempted = 0; let resolved = 0; let no_key = 0; let ok = 0; let insufficient = 0; let rate_limited = 0; let auth_failed = 0; let errors = 0;
    for (const d of diagnostics) {
      const att = (d.attempts || []).filter((a) => a.provider === name);
      if (att.length) attempted += 1;
      for (const a of att) {
        if (a.outcome === 'no_key') no_key += 1;
        else if (a.outcome === 'ok') ok += 1;
        else if (a.outcome === 'insufficient_bars' || a.outcome === 'empty') insufficient += 1;
        else if (a.outcome === 'rate_limited') rate_limited += 1;
        else if (a.outcome === 'auth_failed') auth_failed += 1;
        else errors += 1;
      }
      if (d.resolved && d.resolved.provider === name) resolved += 1;
    }
    const keyPresent = !KEYED.has(name) || diagnostics.some((d) => (d.attempts || []).some((a) => a.provider === name && a.outcome !== 'no_key'));
    return {
      name,
      keyed: KEYED.has(name),
      key_present: keyPresent,
      etfs_attempted: attempted,
      etfs_resolved: resolved,
      outcomes: { ok, no_key, insufficient_or_empty: insufficient, rate_limited, auth_failed, error: errors },
    };
  });

  const available = etfs.filter((e) => e.availability === 'available').length;
  return {
    schema_version: '1.0',
    generated_at: stamp,
    source_layer: 'etf-provider-audit',
    mode: ph.mode || 'offline',
    etfs_total: ETFS.length,
    etfs_available: available,
    etfs_unavailable: ETFS.length - available,
    rate_limited_run: !!ph.rate_limited,
    providers,
    etfs,
    attribution: {
      sources: ['data/intelligence/etf-charts.json'],
      note: 'Honest per-ETF provider audit derived from the ETF chart-build diagnostics. A provider is only credited where it actually resolved sourced OHLCV. Unavailable ETFs remain unavailable.',
    },
  };
}

if (require.main === module) {
  const audit = build();
  console.log(`[etf-provider-audit] mode=${audit.mode} available=${audit.etfs_available}/${audit.etfs_total} unavailable=${audit.etfs_unavailable}`);
  for (const p of audit.providers) {
    console.log(`  ${p.name.padEnd(13)} key=${p.key_present} resolved=${p.etfs_resolved}/${p.etfs_attempted} ok=${p.outcomes.ok} no_key=${p.outcomes.no_key}`);
  }
  if (WRITE) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
    console.log(`[etf-provider-audit] wrote ${OUT}`);
  }
}

module.exports = { build, APPROVED_PROVIDERS };
