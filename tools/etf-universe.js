'use strict';

// ETF Intelligence Center — coverage universe loader.
//
// The universe now lives in data/etf-universe.json. This module only loads and
// indexes it, so adding a fund is a data edit and never a code edit — which is
// what lets the same pipeline serve 39 funds or several thousand.
//
// WHAT THIS FILE NO LONGER CONTAINS, deliberately: TER, ISIN, issuer, benchmark,
// domicile, replication, distribution, inception or fund names. Those are facts
// about somebody else's product. They are resolved at build time from a provider
// response (tools/build-etf-facts.js) or published as "awaiting verified data".
// Nothing in this repository asserts them from memory.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'data/etf-universe.json');

// ISO 6166 check digit. Retained here because it is the one structural check we
// can apply to an ISIN the moment a verified source starts supplying one.
function isValidIsin(isin) {
  if (typeof isin !== 'string' || !/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  let expanded = '';
  for (const ch of isin.slice(0, 11)) {
    expanded += /[0-9]/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
  }
  let sum = 0;
  let double = true;
  for (let i = expanded.length - 1; i >= 0; i -= 1) {
    let digit = Number(expanded[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(isin[11]);
}

function load() {
  const doc = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const etfs = Array.isArray(doc.etfs) ? doc.etfs : [];
  return etfs.map((entry) => ({
    symbol: entry.symbol,
    ticker: entry.ticker,
    slug: entry.slug,
    yahoo_symbol: entry.yahoo_symbol,
    region: entry.region,
    registry_backed: Boolean(entry.registry_backed),
    // Flattened for convenience; these are TradeAlphaAI classifications, not
    // fund facts, and are labelled as such wherever they surface.
    category: entry.classification.category,
    exposure_type: entry.classification.exposure_type,
    role_en: entry.classification.role_en,
    role_ar: entry.classification.role_ar,
    related: entry.related || [],
  }));
}

const UNIVERSE = load();
const BY_SLUG = new Map(UNIVERSE.map((e) => [e.slug, e]));
const BY_SYMBOL = new Map(UNIVERSE.map((e) => [e.symbol, e]));
const SLUGS = UNIVERSE.map((e) => e.slug);

const ALLOWED_REPLICATION = ['physical_full', 'physical_sampling', 'synthetic', 'physical_backed'];
const ALLOWED_DISTRIBUTION = ['accumulating', 'distributing', 'none'];
const ALLOWED_REGIONS = ['us', 'ucits'];

module.exports = {
  UNIVERSE, BY_SLUG, BY_SYMBOL, SLUGS, REGISTRY_FILE,
  ALLOWED_REPLICATION, ALLOWED_DISTRIBUTION, ALLOWED_REGIONS,
  isValidIsin, load,
};
