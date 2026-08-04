'use strict';

// ETF Intelligence Center — verified fund facts.
//
// Replaces build-etf-fundamentals.js. The difference is the whole point of this
// file: NOTHING here is asserted from memory. Every published field is either
//
//   FETCHED     straight out of a provider response, with that response's hash;
//   DERIVED     extracted from a fetched string, quoting the string it read;
//   DECLARED    a TradeAlphaAI classification, or a value inherited from the
//               pre-existing repo registry and labelled as such;
//   UNAVAILABLE explicitly awaiting a verified source.
//
// TER, ISIN, domicile, replication, fund size and inception date have no free
// verifiable source, so they are published as UNAVAILABLE with a reason. They
// are not guessed, not approximated and not carried over from prior versions of
// this pipeline.
//
// Usage: node tools/build-etf-facts.js [--write] [--no-cache]

const fs = require('fs');
const path = require('path');

const { UNIVERSE } = require('./etf-universe');
const ps = require('./etf-price-source');
const P = require('./etf-provenance');
const { hash } = require('./build-institutional-charts');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data/intelligence/etf-facts.json');
const SCHEMA_VERSION = 2;

// Registry values inherited from tools/etf-registry.js (Phase 214). Loaded
// lazily so a missing registry degrades rather than crashes.
const REGISTRY = (() => {
  try {
    const { ETFS } = require('./etf-registry');
    return new Map(ETFS.map((e) => [e.slug, e]));
  } catch {
    return new Map();
  }
})();

// Issuer brands recognised inside a FETCHED fund name. Matching is conservative:
// a whole-word match against this closed list only. Anything unrecognised stays
// unavailable rather than being guessed from the first word of the name.
const ISSUER_BRANDS = [
  'Vanguard', 'iShares', 'SPDR', 'Invesco', 'Schwab', 'VanEck',
  'Xtrackers', 'Amundi', 'Fidelity', 'JPMorgan', 'Global X', 'ARK', 'WisdomTree',
];

// Distribution policy as stated inside a FETCHED fund name. Only these explicit
// spellings count; silence is not evidence of either policy.
const DISTRIBUTION_PATTERNS = [
  { re: /\b(?:acc|accumulating|accumulation)\b/i, value: 'accumulating' },
  { re: /\b(?:dist|distributing|distribution|income)\b/i, value: 'distributing' },
];

function sourceRecord(series) {
  return {
    provider: series.source.provider,
    endpoint: series.source.endpoint,
    response_hash: series.source.response_hash,
    fetched_at: series.source.fetched_at,
  };
}

/** Issuer read out of the fetched fund name, or unavailable. */
function issuerFrom(longName, series) {
  if (!longName) return P.unavailable(P.REASONS.PROVIDER_OMITTED);
  for (const brand of ISSUER_BRANDS) {
    const re = new RegExp(`(^|\\s)${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
    if (re.test(longName)) {
      return P.derived(brand, [`provider fund name for ${series.symbol}`], longName);
    }
  }
  return P.unavailable(P.REASONS.NO_FREE_SOURCE, 'fund name does not contain a recognised issuer brand');
}

/** Distribution policy read out of the fetched fund name, or unavailable. */
function distributionFrom(longName, series) {
  if (!longName) return P.unavailable(P.REASONS.PROVIDER_OMITTED);
  const matches = DISTRIBUTION_PATTERNS.filter((p) => p.re.test(longName));
  // Ambiguous names (both spellings present) yield nothing rather than a coin flip.
  if (matches.length !== 1) {
    return P.unavailable(P.REASONS.NO_FREE_SOURCE, 'fund name does not state a single distribution policy');
  }
  return P.derived(matches[0].value, [`provider fund name for ${series.symbol}`], longName);
}

function factsFor(entry, series) {
  const fields = {};
  const registry = REGISTRY.get(entry.slug);

  if (series && series.ok) {
    const meta = series.meta;
    const src = sourceRecord(series);

    fields.fund_name = meta.long_name
      ? P.fetched(meta.long_name, src)
      : P.unavailable(P.REASONS.PROVIDER_OMITTED);
    fields.currency = meta.currency
      ? P.fetched(meta.currency, src)
      : P.unavailable(P.REASONS.PROVIDER_OMITTED);
    fields.exchange = meta.full_exchange_name || meta.exchange_name
      ? P.fetched(meta.full_exchange_name || meta.exchange_name, src)
      : P.unavailable(P.REASONS.PROVIDER_OMITTED);
    fields.instrument_type = meta.instrument_type
      ? P.fetched(meta.instrument_type, src)
      : P.unavailable(P.REASONS.PROVIDER_OMITTED);
    // The provider reports first trade date. That is a LISTING date, which is
    // not the same thing as fund inception — so it is published under its own
    // name and inception stays unavailable.
    fields.listing_date = meta.first_trade_date
      ? P.fetched(meta.first_trade_date, src)
      : P.unavailable(P.REASONS.PROVIDER_OMITTED);

    fields.issuer = issuerFrom(meta.long_name, series);
    fields.distribution = distributionFrom(meta.long_name, series);
  } else {
    const reason = P.REASONS.FETCH_FAILED;
    for (const field of ['fund_name', 'currency', 'exchange', 'instrument_type', 'listing_date', 'issuer', 'distribution']) {
      fields[field] = P.unavailable(reason);
    }
  }

  // Benchmark: carried from the repo registry where one exists, clearly labelled
  // as project data. Never invented for the wider universe.
  fields.benchmark = registry && registry.benchmark
    ? P.declared(registry.benchmark, P.REGISTRY_BASIS)
    : P.unavailable(P.REASONS.NO_FREE_SOURCE);

  // No free source publishes these. Stated plainly rather than approximated.
  for (const field of ['isin', 'ter_pct', 'aum', 'domicile', 'replication', 'inception']) {
    fields[field] = P.unavailable(P.REASONS.NO_FREE_SOURCE);
  }

  return fields;
}

async function build(options = {}) {
  ps.pruneCache();

  const series = await ps.mapWithConcurrency(
    UNIVERSE,
    (entry) => ps.fetchDailySeries(entry.yahoo_symbol, '5d', { noCache: options.noCache }),
    options.concurrency || ps.DEFAULT_CONCURRENCY,
  );

  const etfs = UNIVERSE.map((entry, index) => {
    const fields = factsFor(entry, series[index]);
    const counts = P.summarise(fields);
    return {
      slug: entry.slug,
      symbol: entry.symbol,
      ticker: entry.ticker,
      yahoo_symbol: entry.yahoo_symbol,
      region: entry.region,
      registry_backed: entry.registry_backed,
      // Classification is ours and is labelled as ours wherever it appears.
      classification: {
        category: P.declared(entry.category, 'tradealphaai_exposure_classification'),
        exposure_type: P.declared(entry.exposure_type, 'tradealphaai_exposure_classification'),
      },
      fields,
      provenance_counts: counts,
      evidence: [
        `${counts.fetched} field(s) verified from a provider response, ${counts.derived} derived from verified text`,
        `${counts.unavailable} field(s) awaiting a verified source; ${counts.registry} inherited from the project registry`,
      ],
    };
  });

  const totals = etfs.reduce((acc, e) => {
    for (const [key, value] of Object.entries(e.provenance_counts)) acc[key] = (acc[key] || 0) + value;
    return acc;
  }, {});

  const artifact = {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    source_layer: 'verified_provider_facts',
    method: {
      note_en: 'Every field on this page states where it came from. Values marked verified were returned by a data provider and are stored with that response\'s hash. Values marked derived were read out of a verified string, which is quoted. Values marked awaiting verified data have no free, checkable source — they are published as absent rather than estimated.',
      note_ar: 'يوضح كل حقل هنا مصدره. فالقيم الموسومة بـ"موثّق" وردت من مزود بيانات وتُخزَّن مع بصمة استجابته. والقيم الموسومة بـ"مشتق" قُرئت من نص موثّق يُقتبس نصه. أما الموسومة بـ"بانتظار بيانات موثّقة" فلا يوجد لها مصدر مجاني قابل للتحقق، وتُنشر كغائبة بدلا من تقديرها.',
      no_model_knowledge_en: 'No field in this dataset is asserted from prior knowledge. Fund expense ratios, identifiers, domicile, replication method, fund size and inception dates are not published because no free verifiable source supplies them.',
      no_model_knowledge_ar: 'لا يُؤكَّد أي حقل في هذه البيانات استنادا إلى معرفة سابقة. ولا تُنشر نسب المصاريف والمعرّفات والمقر وطريقة المحاكاة وحجم الصندوق وتواريخ التأسيس لعدم توفر مصدر مجاني قابل للتحقق يوفرها.',
      provenance_classes: P.CLASSES,
      issuer_brands_recognised: ISSUER_BRANDS,
    },
    coverage: {
      total: UNIVERSE.length,
      resolved: series.filter((s) => s && s.ok).length,
      totals,
    },
    etfs,
    attribution: {
      sources: [{ provider: 'Yahoo', source_url: ps.SOURCE_URL, role: 'instrument metadata (fund name, currency, exchange, listing date)' }],
      computed_by: 'tools/build-etf-facts.js',
    },
  };
  artifact.source_hash = hash(JSON.stringify(etfs));
  return artifact;
}

async function main() {
  const artifact = await build({ noCache: process.argv.includes('--no-cache') });
  if (process.argv.includes('--write')) {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    console.log(`[etf-facts] wrote ${path.relative(ROOT, OUT)} (${artifact.coverage.resolved}/${artifact.coverage.total} resolved)`);
  } else {
    console.log(`[etf-facts] dry run — ${artifact.coverage.resolved}/${artifact.coverage.total} resolved`);
  }
  const t = artifact.coverage.totals;
  console.log(`[etf-facts] fields: ${t.fetched || 0} verified, ${t.derived || 0} derived, ${t.registry || 0} registry, ${t.declared || 0} classification, ${t.unavailable || 0} awaiting verified data`);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[etf-facts] FAILED: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { build, factsFor, issuerFrom, distributionFrom, ISSUER_BRANDS, DISTRIBUTION_PATTERNS };
