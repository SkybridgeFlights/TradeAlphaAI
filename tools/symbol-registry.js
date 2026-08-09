'use strict';

// Phase 229 — the single symbol source of truth.
//
// Everything that needs to answer "is this a real symbol, and what do we know
// about it?" resolves here: portfolios, ETF Center, compare, rankings,
// screener, alerts, watchlists and the assistant. There is no second list to
// maintain — this module is a VIEW over two independently-owned inputs, not a
// third registry:
//
//   RECORDABLE UNIVERSE   data/intelligence/symbol-registry.json
//     Generated from official exchange directories by build-symbol-registry.js.
//     Thousands of symbols. Identity and pricing only.
//
//   INTELLIGENCE UNIVERSE tools/etf-universe.js + asset/sector/equity registries
//     Hand-curated, provenance-carrying, small. Everything that needs verified
//     fundamentals or a research judgement.
//
// The two are INDEPENDENT ON PURPOSE. A symbol may be recordable without being
// researched, and that is a normal, expected state — not a defect and not an
// error. The coverage vocabulary below exists so every surface can say what it
// knows in a way that reads as deliberate.
//
// The words this module must never produce for a recordable symbol:
// "unsupported", "unknown", "unavailable". A holder who records a legitimate
// listing has done nothing wrong, and the interface should not imply otherwise.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'data/intelligence/symbol-registry.json');

// ---------------------------------------------------------------------------
// Coverage levels — ordered, least to most.
// ---------------------------------------------------------------------------
const COVERAGE = {
  BASIC: 'basic',
  RESEARCH: 'research',
  FULL: 'full_intelligence',
};

const COVERAGE_ORDER = [COVERAGE.BASIC, COVERAGE.RESEARCH, COVERAGE.FULL];

const COVERAGE_LABELS = {
  [COVERAGE.BASIC]: {
    en: 'Basic coverage',
    ar: 'تغطية أساسية',
    means_en: 'Identity and price history. You can hold it, track it and see its weight in your allocation.',
    means_ar: 'الهوية وسجل الأسعار. يمكنك الاحتفاظ به وتتبعه ورؤية وزنه في توزيعك.',
  },
  [COVERAGE.RESEARCH]: {
    en: 'Research coverage',
    ar: 'تغطية بحثية',
    means_en: 'Everything in basic, plus observed risk statistics, correlation and a TradeAlpha Score.',
    means_ar: 'كل ما في التغطية الأساسية، إضافة إلى إحصاءات المخاطر المرصودة والارتباط ودرجة TradeAlpha.',
  },
  [COVERAGE.FULL]: {
    en: 'Full intelligence',
    ar: 'استخبارات كاملة',
    means_en: 'Everything in research, plus verified fund facts — expense ratio, identifiers and structure — each carrying its source.',
    means_ar: 'كل ما في التغطية البحثية، إضافة إلى حقائق موثّقة عن الصندوق — نسبة المصاريف والمعرّفات والبنية — ولكل منها مصدره.',
  },
};

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

let _recordable = null;
function recordable() {
  if (_recordable) return _recordable;
  let doc = { symbols: [] };
  try { doc = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8')); } catch { /* absent in a fresh checkout */ }
  const bySymbol = new Map();
  for (const row of doc.symbols || []) bySymbol.set(row.symbol, row);
  _recordable = { doc, bySymbol };
  return _recordable;
}

// The curated tier. Loaded defensively: a missing registry must degrade the
// coverage level, never throw and take the whole surface down.
let _intel = null;
function intelligence() {
  if (_intel) return _intel;
  const bySymbol = new Map();

  const add = (symbol, entry) => {
    const key = String(symbol || '').toUpperCase();
    if (key && !bySymbol.has(key)) bySymbol.set(key, entry);
  };

  try {
    const { UNIVERSE } = require('./etf-universe');
    for (const e of UNIVERSE) {
      add(e.symbol, { instrument_type: 'etf', symbol: e.symbol, slug: e.slug, curated: true, entry: e });
    }
  } catch { /* registry unavailable */ }

  for (const [mod, type, key] of [
    ['./asset-registry', 'asset', 'ASSETS'],
    ['./sector-registry', 'sector', 'SECTORS'],
    ['./equity-registry', 'equity', 'EQUITIES'],
  ]) {
    try {
      const reg = require(mod);
      for (const e of reg[key] || []) {
        add(e.symbol, { instrument_type: type, symbol: e.symbol, slug: e.slug, curated: true, entry: e });
      }
    } catch { /* registry unavailable */ }
  }

  // Cash is a position without a listing: a holder's cash balance is part of
  // their allocation even though no exchange lists it.
  bySymbol.set('CASH', { instrument_type: 'cash', symbol: 'CASH', slug: 'cash', curated: true, entry: null });
  _intel = bySymbol;
  return _intel;
}

// ---------------------------------------------------------------------------
// Coverage assessment
// ---------------------------------------------------------------------------

/**
 * Coverage level for a slug, judged from the artifacts actually present.
 *
 * Deliberately evidence-driven rather than declared: a symbol is "research"
 * because a score and a price series exist for it, not because a list says so.
 * Callers pass the artifacts they already loaded, so this stays pure.
 */
function assessCoverage(slug, artifacts) {
  if (!slug || !artifacts) return COVERAGE.BASIC;
  const facts = artifacts.factsBySlug && artifacts.factsBySlug.get(slug);
  const score = artifacts.scoreBySlug && artifacts.scoreBySlug.get(slug);
  const series = artifacts.series && artifacts.series[slug];

  const hasResearch = !!(score && Number.isFinite(score.overall)) && Array.isArray(series) && series.length > 12;
  if (!hasResearch) return COVERAGE.BASIC;

  // Full intelligence requires at least one VERIFIED fund fact, not merely a
  // facts record — an entry whose every field is "awaiting data" is still only
  // research coverage, and saying otherwise would overstate what we hold.
  const fields = (facts && facts.fields) || {};
  const verified = Object.values(fields).some(
    (f) => f && f.provenance && f.provenance !== 'unavailable' && f.value !== null && f.value !== undefined,
  );
  return verified ? COVERAGE.FULL : COVERAGE.RESEARCH;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve a symbol across both universes.
 *
 * Returns null ONLY when the symbol appears in neither — i.e. it is not a
 * listing this platform can identify at all. Everything else resolves, with a
 * coverage level describing how much is known.
 */
function resolve(symbol, instrumentType = null, artifacts = null) {
  if (typeof symbol !== 'string') return null;
  const key = symbol.trim().toUpperCase();
  if (!key) return null;

  const curated = intelligence().get(key);
  const listed = recordable().bySymbol.get(key);
  if (!curated && !listed) return null;

  // The curated entry wins on identity: its slug is what every research surface
  // is keyed by, and its instrument_type reflects a judgement (a sector ETF is
  // an ETF) rather than a directory flag.
  const type = curated ? curated.instrument_type : listed.instrument_type;
  if (instrumentType && type !== instrumentType) return null;

  const slug = curated ? curated.slug : null;
  const coverage = curated && slug ? assessCoverage(slug, artifacts) : COVERAGE.BASIC;

  // CASH is a reserved pseudo-symbol for a holder's cash balance, and a real
  // company also lists under that ticker (Pathward Financial). The reserved
  // meaning wins, and it must not inherit the listing's name or exchange —
  // showing "Pathward Financial" beside someone's cash would be wrong.
  const reserved = type === 'cash';

  return {
    symbol: curated ? curated.symbol : listed.symbol,
    slug,
    instrument_type: type,
    name: reserved ? null : ((listed && listed.name) || null),
    exchange: reserved ? null : ((listed && listed.exchange) || null),
    coverage,
    in_recordable_universe: !!listed || !!curated,
    in_intelligence_universe: !!curated,
  };
}

/** Is this symbol something a holder may record? */
const isRecordable = (symbol) => resolve(symbol) !== null;

/** Bilingual descriptor for a coverage level, for direct use in UI copy. */
function describeCoverage(level, ar = false) {
  const l = COVERAGE_LABELS[level] || COVERAGE_LABELS[COVERAGE.BASIC];
  return { level, label: ar ? l.ar : l.en, means: ar ? l.means_ar : l.means_en };
}

function stats() {
  const r = recordable();
  return {
    recordable: (r.doc.symbols || []).length,
    recordable_generated_at: r.doc.generated_at || null,
    intelligence: intelligence().size,
    counts: r.doc.counts || null,
  };
}

module.exports = {
  COVERAGE, COVERAGE_ORDER, COVERAGE_LABELS,
  resolve, isRecordable, assessCoverage, describeCoverage, stats,
  REGISTRY_FILE,
};
