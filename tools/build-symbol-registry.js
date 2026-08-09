'use strict';

// Phase 229 — Recordable Universe registry generation.
//
//   Source -> Normalize -> Deduplicate -> Validate -> Generate -> Publish
//
// This produces the RECORDABLE universe: every symbol a holder is allowed to
// enter into a portfolio. It is deliberately NOT the Intelligence Universe.
// A symbol here carries identity and can be priced; it does not thereby earn a
// score, a similarity peer set, an overlap verdict or a fundamentals record.
// Those live in the curated registries (tools/etf-universe.js and friends) and
// are unchanged by this file.
//
// The distinction matters because the two have different truth standards. A
// recordable symbol needs only to exist and be identifiable — an official
// exchange listing file is sufficient evidence. An intelligence symbol needs
// verified fundamentals that no free source publishes, which is why that tier
// stays hand-curated and small.
//
// SOURCE (verified reachable 2026-08-09, keyless, no terms requiring a licence
// for symbol directories): Nasdaq Trader's official daily symbol directory.
//   nasdaqlisted.txt  — NASDAQ-listed issues
//   otherlisted.txt   — NYSE, NYSE American, NYSE Arca, BATS, IEX
// Both carry an official ETF flag, which is how ETFs are classified here rather
// than by guessing from the security name.
//
// ANTI-FABRICATION: every field written comes from a source column. Nothing is
// inferred, defaulted or filled. A row missing a required field is dropped and
// counted, never repaired.

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'data/intelligence/symbol-registry.json');
const WRITE = process.argv.includes('--write');

const SOURCES = [
  {
    id: 'nasdaqlisted',
    url: 'https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt',
    symbolCol: 'Symbol',
    nameCol: 'Security Name',
    exchangeCol: null,          // implied
    exchange: 'NASDAQ',
  },
  {
    id: 'otherlisted',
    url: 'https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt',
    symbolCol: 'ACT Symbol',
    nameCol: 'Security Name',
    exchangeCol: 'Exchange',
    exchange: null,
  },
];

// otherlisted.txt encodes venue as a single letter.
const EXCHANGE_CODES = {
  A: 'NYSE American', N: 'NYSE', P: 'NYSE Arca', Z: 'Cboe BZX', V: 'IEX',
};

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'TradeAlphaAI/1.0 (+https://www.tradealphaai.com)' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`${url} -> HTTP ${res.statusCode}`)); return; }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(body));
    }).on('error', reject);
  });
}

// --- Normalize -------------------------------------------------------------
//
// Instrument classes we deliberately exclude. These are tradeable but are not
// things a long-horizon holder records as a position, and admitting them would
// bloat the registry with symbols the pricing layer often cannot resolve.
const EXCLUDE_NAME = /\b(warrant|right|unit|preferred|depositary|when[- ]issued|notes? due|convertible)\b/i;
// Class/warrant/unit suffixes and non-equity share classes.
const EXCLUDE_SYMBOL = /[.$]|[-][WRUP]$/;

function parsePipeFile(text, source) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) throw new Error(`${source.id}: empty file`);
  const header = lines[0].split('|');
  const idx = (name) => header.indexOf(name);

  const iSym = idx(source.symbolCol);
  const iName = idx(source.nameCol);
  const iEtf = idx('ETF');
  const iTest = idx('Test Issue');
  const iExch = source.exchangeCol ? idx(source.exchangeCol) : -1;
  if (iSym < 0 || iName < 0) throw new Error(`${source.id}: expected columns missing (header changed)`);

  const rows = [];
  const dropped = { test_issue: 0, excluded_class: 0, malformed: 0 };

  for (const line of lines.slice(1)) {
    // The directory files end with a "File Creation Time" trailer row.
    if (/^File Creation Time/i.test(line)) continue;
    const cols = line.split('|');
    const symbol = (cols[iSym] || '').trim().toUpperCase();
    const name = (cols[iName] || '').trim();
    if (!symbol || !name) { dropped.malformed += 1; continue; }
    if (iTest >= 0 && (cols[iTest] || '').trim() === 'Y') { dropped.test_issue += 1; continue; }
    if (EXCLUDE_SYMBOL.test(symbol) || EXCLUDE_NAME.test(name)) { dropped.excluded_class += 1; continue; }
    if (!/^[A-Z]{1,6}$/.test(symbol)) { dropped.excluded_class += 1; continue; }

    const isEtf = iEtf >= 0 ? (cols[iEtf] || '').trim() === 'Y' : false;
    const exchange = source.exchange
      || EXCHANGE_CODES[(cols[iExch] || '').trim()]
      || null;
    if (!exchange) { dropped.malformed += 1; continue; }

    rows.push({
      symbol,
      // Directory names carry a trailing class descriptor; keep the issuer name
      // and drop the boilerplate, without inventing anything.
      name: name.replace(/\s*-\s*(Common Stock|Class [A-Z]( Common Stock)?|Ordinary Shares).*$/i, '').trim() || name,
      exchange,
      instrument_type: isEtf ? 'etf' : 'equity',
      source: source.id,
    });
  }
  return { rows, dropped };
}

// --- Deduplicate -----------------------------------------------------------
//
// A symbol can appear on more than one venue file. First writer wins, ordered
// by source precedence, and the collision is counted rather than silently
// resolved — a spike in collisions means a source changed shape.
function deduplicate(all) {
  const bySymbol = new Map();
  let collisions = 0;
  for (const row of all) {
    if (bySymbol.has(row.symbol)) { collisions += 1; continue; }
    bySymbol.set(row.symbol, row);
  }
  return { rows: [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)), collisions };
}

// --- Validate --------------------------------------------------------------
//
// Structural gate before anything is published. A failure here aborts the
// write: a half-built registry is worse than yesterday's complete one, because
// every surface downstream treats it as the source of truth.
function validate(rows) {
  const problems = [];
  if (rows.length < 3000) problems.push(`only ${rows.length} symbols — source likely truncated`);
  const etfs = rows.filter((r) => r.instrument_type === 'etf').length;
  if (etfs < 1000) problems.push(`only ${etfs} ETFs — ETF flag column may have moved`);
  const seen = new Set();
  for (const r of rows) {
    if (seen.has(r.symbol)) problems.push(`duplicate symbol survived dedupe: ${r.symbol}`);
    seen.add(r.symbol);
    if (!/^[A-Z]{1,6}$/.test(r.symbol)) problems.push(`malformed symbol: ${r.symbol}`);
    if (!r.name || !r.exchange) problems.push(`incomplete row: ${r.symbol}`);
    if (!['etf', 'equity'].includes(r.instrument_type)) problems.push(`bad type: ${r.symbol}`);
  }
  // Sanity anchors: if these well-known listings vanish, the parse is wrong.
  for (const anchor of ['AAPL', 'MSFT', 'SPY', 'VOO', 'QQQ']) {
    if (!seen.has(anchor)) problems.push(`sanity anchor missing: ${anchor}`);
  }
  return problems;
}

async function main() {
  const fetched = [];
  const dropped = { test_issue: 0, excluded_class: 0, malformed: 0 };
  const sourceMeta = [];

  for (const source of SOURCES) {
    const text = await fetchText(source.url);
    const parsed = parsePipeFile(text, source);
    fetched.push(...parsed.rows);
    for (const k of Object.keys(dropped)) dropped[k] += parsed.dropped[k];
    sourceMeta.push({
      id: source.id,
      url: source.url,
      rows_accepted: parsed.rows.length,
      retrieved_at: new Date().toISOString(),
    });
    console.log(`[symbol-registry] ${source.id}: ${parsed.rows.length} accepted`);
  }

  const { rows, collisions } = deduplicate(fetched);
  const problems = validate(rows);
  if (problems.length) {
    console.error('[symbol-registry] VALIDATION FAILED — nothing written:');
    for (const p of problems.slice(0, 10)) console.error(`   ${p}`);
    process.exit(1);
  }

  const doc = {
    generated_at: new Date().toISOString(),
    universe: 'recordable',
    note_en: 'Symbols a holder may record in a portfolio. Identity and pricing only — research coverage is tracked separately in the intelligence universe.',
    note_ar: 'الرموز التي يمكن لصاحب المحفظة تسجيلها. الهوية والتسعير فقط — أما تغطية الأبحاث فتُتابَع بشكل منفصل.',
    provenance: {
      basis: 'fetched',
      sources: sourceMeta,
      fields_from_source: ['symbol', 'name', 'exchange', 'instrument_type'],
      fields_never_inferred: ['isin', 'ter', 'aum', 'holdings', 'benchmark', 'domicile', 'distribution_policy'],
    },
    counts: {
      total: rows.length,
      etf: rows.filter((r) => r.instrument_type === 'etf').length,
      equity: rows.filter((r) => r.instrument_type === 'equity').length,
      dropped,
      duplicate_symbols_collapsed: collisions,
    },
    symbols: rows,
  };

  console.log(`[symbol-registry] ${rows.length} symbols (${doc.counts.etf} ETF, ${doc.counts.equity} equity), ${collisions} collisions collapsed`);
  console.log(`[symbol-registry] dropped: ${JSON.stringify(dropped)}`);

  if (!WRITE) { console.log('[symbol-registry] dry-run — pass --write to publish'); return; }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(doc)}\n`, 'utf8');
  const kb = Math.round(fs.statSync(OUT).size / 1024);
  console.log(`[symbol-registry] wrote ${path.relative(ROOT, OUT)} (${kb} KB)`);
}

if (require.main === module) {
  main().catch((e) => { console.error('[symbol-registry] FAIL:', e.message); process.exit(1); });
}

module.exports = { parsePipeFile, deduplicate, validate, EXCHANGE_CODES };
