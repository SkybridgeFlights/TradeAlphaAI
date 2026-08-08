'use strict';

// ETF Intelligence Center — validators.
//
// Follows the established repo pattern: pure validate* functions that take data
// and return an array of failure strings (no I/O, no process.exit inside), a
// thin --check=<name> dispatcher, and a --self-test that mutates a known-good
// fixture and asserts each mutation is caught.
//
//   --check=universe       coverage registry carries no factual claims
//   --check=facts          every published field has a verifiable provenance
//   --check=score-config   the single score config is internally consistent
//   --check=analytics      computed metrics, currency guard, hash integrity
//   --check=similarity     peer measurement integrity
//   --check=score          score matches its config and its own components
//   --check=pages          rendered surfaces, provenance labels, no placeholders
//   --self-test            mutate a good fixture and assert each rule fires

const fs = require('fs');
const path = require('path');

const { hash } = require('./build-institutional-charts');
const P = require('./etf-provenance');
const { isValidIsin, ALLOWED_REGIONS } = require('./etf-universe');

const ROOT = path.join(__dirname, '..');
const J = (name) => path.join(ROOT, 'data/intelligence', name);

const ARABIC = /[؀-ۿ]/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Registry-tier language bank. Structural reference data and role copy must not
// read as instruction. Bare 'signal'/'forecast' are included here because these
// artifacts never legitimately negate them in a disclaimer — pages do that, data
// files do not.
const FORBIDDEN = [
  /\bplaceholder\b/i, /\btbd\b/i, /\blorem\b/i,
  /\bbuy\b/i, /\bsell\b/i, /\bentry\b/i, /\bstop[- ]?loss\b/i, /\btarget\b/i,
  /\bsignal\b/i, /\bwill (rise|fall|rally|crash)\b/i, /\bguaranteed\b/i,
  /\brecommend(?:s|ed|ation)?\b/i,
  /(?:\bشراء\b|\bبيع\b|هدف\s*سعري|إشارة\s*تداول|مضمون)/,
];


function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function scanForbidden(payload, label, failures) {
  const text = JSON.stringify(payload);
  for (const re of FORBIDDEN) {
    if (re.test(text)) failures.push(`${label}: forbidden language ${re}`);
  }
  if (/\bNaN\b|\bInfinity\b/.test(text)) failures.push(`${label}: leaks NaN/Infinity`);
}

/** A number or explicitly null — never a string, NaN or undefined. */
function numericOrNull(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

// ---------------------------------------------------------------------------
// universe
// ---------------------------------------------------------------------------

function validateUniverse(mod) {
  const failures = [];
  const universe = Array.isArray(mod && mod.UNIVERSE) ? mod.UNIVERSE : [];
  if (universe.length < 30) failures.push(`expected at least 30 covered ETFs, got ${universe.length}`);

  // The registry file must contain NO factual claim about any fund. Coverage and
  // TradeAlphaAI classification only; facts are resolved at build time from a
  // provider or published as awaiting verified data.
  const FORBIDDEN_KEYS = ['fund_name', 'issuer', 'benchmark', 'isin', 'ter_pct', 'aum', 'domicile', 'replication', 'distribution', 'inception'];

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(mod.REGISTRY_FILE, 'utf8'));
  } catch (error) {
    return [`universe registry unreadable: ${error.message}`];
  }
  for (const entry of raw.etfs || []) {
    const id = entry.symbol || '?';
    for (const key of FORBIDDEN_KEYS) {
      if (Object.prototype.hasOwnProperty.call(entry, key)) {
        failures.push(`${id}: registry carries factual key "${key}" — facts must come from a provider, not the registry`);
      }
      if (entry.classification && Object.prototype.hasOwnProperty.call(entry.classification, key)) {
        failures.push(`${id}: classification carries factual key "${key}"`);
      }
    }
  }

  const slugs = new Set();
  const symbols = new Set();
  for (const etf of universe) {
    const id = (etf && etf.symbol) || '?';
    for (const field of ['symbol', 'ticker', 'slug', 'yahoo_symbol', 'category', 'exposure_type', 'role_en', 'role_ar']) {
      if (!etf[field] || typeof etf[field] !== 'string') failures.push(`${id}: missing ${field}`);
    }
    if (!ALLOWED_REGIONS.includes(etf.region)) failures.push(`${id}: region not in ${ALLOWED_REGIONS.join('|')}`);
    if (!ARABIC.test(String(etf.role_ar || ''))) failures.push(`${id}: role_ar not Arabic`);
    if (slugs.has(etf.slug)) failures.push(`${id}: duplicate slug ${etf.slug}`);
    if (symbols.has(etf.symbol)) failures.push(`${id}: duplicate symbol`);
    slugs.add(etf.slug);
    symbols.add(etf.symbol);
  }

  scanForbidden(universe, 'universe', failures);
  return failures;
}

// ---------------------------------------------------------------------------
// facts — the anti-model-knowledge gate
// ---------------------------------------------------------------------------

function validateFacts(artifact) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['facts artifact unreadable'];
  if (artifact.source_layer !== 'verified_provider_facts') failures.push('unexpected source_layer');

  const etfs = Array.isArray(artifact.etfs) ? artifact.etfs : [];
  if (!etfs.length) failures.push('no ETFs in facts artifact');

  for (const etf of etfs) {
    const id = etf.slug || '?';
    if (!Array.isArray(etf.evidence) || etf.evidence.length < 2) {
      failures.push(`${id}: fewer than 2 evidence lines`);
    }

    // THE gate: every field must be a well-formed provenance record. This is
    // what makes it impossible to reintroduce a value asserted from memory —
    // there is no provenance class that permits one.
    failures.push(...P.validateFields(etf.fields, `${id}.`));

    // Classification is ours and must say so.
    for (const [name, record] of Object.entries(etf.classification || {})) {
      if (!record || record.provenance !== P.DECLARED) {
        failures.push(`${id}.classification.${name}: must be declared as a TradeAlphaAI classification`);
      }
    }

    // Counts must match the fields actually published.
    const recomputed = P.summarise(etf.fields);
    if (JSON.stringify(recomputed) !== JSON.stringify(etf.provenance_counts)) {
      failures.push(`${id}: provenance_counts do not match the published fields`);
    }

    // Fields with no free source must stay unavailable until a real source
    // exists. If one of these ever carries a value, it must have arrived
    // FETCHED or DERIVED — never any other way.
    for (const name of ['isin', 'ter_pct', 'aum', 'domicile', 'replication', 'inception']) {
      const record = etf.fields[name];
      if (record && P.hasValue(record) && ![P.FETCHED, P.DERIVED].includes(record.provenance)) {
        failures.push(`${id}.${name}: carries a value without a fetched or derived provenance`);
      }
    }

    // An ISIN, if one ever appears, must still pass its check digit.
    const isin = etf.fields.isin;
    if (isin && P.hasValue(isin) && !isValidIsin(isin.value)) {
      failures.push(`${id}.isin: ${isin.value} fails ISO 6166 check digit`);
    }
  }

  if (artifact.source_hash !== hash(JSON.stringify(etfs))) {
    failures.push('source_hash does not match recomputed payload (artifact hand-edited?)');
  }

  scanForbidden(etfs, 'facts', failures);
  return failures;
}

// ---------------------------------------------------------------------------
// analytics
// ---------------------------------------------------------------------------

function validateAnalytics(artifact) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['analytics artifact unreadable'];
  if (artifact.source_layer !== 'computed_from_observed_prices') failures.push('unexpected source_layer');

  const etfs = Array.isArray(artifact.etfs) ? artifact.etfs : [];
  if (!etfs.length) failures.push('no ETFs in analytics artifact');

  const riskFreeAvailable = Boolean(artifact.risk_free && typeof artifact.risk_free.rate === 'number');

  for (const etf of etfs) {
    const id = etf.slug || '?';
    if (!Array.isArray(etf.evidence) || etf.evidence.length < 2) {
      failures.push(`${id}: fewer than 2 evidence lines`);
    }

    if (!etf.available) {
      // Unavailable funds must say so honestly and must not carry figures.
      const text = JSON.stringify(etf.evidence || []);
      if (!/proxy substitution suppressed/.test(text)) {
        failures.push(`${id}: unavailable without "proxy substitution suppressed" evidence`);
      }
      if (etf.performance || etf.risk) failures.push(`${id}: unavailable yet carries computed figures`);
      continue;
    }

    if (!['total_return', 'price_only'].includes(etf.return_basis)) {
      failures.push(`${id}: return_basis must be declared`);
    }
    if (!Number.isFinite(etf.bars) || etf.bars < 60) failures.push(`${id}: implausible bar count`);

    const risk = etf.risk || {};
    for (const key of ['volatility_1y', 'volatility_3y', 'volatility_full', 'sharpe', 'sortino', 'max_drawdown', 'beta_vs_world_proxy', 'tracking_error_vs_world_proxy', 'correlation_vs_world_proxy']) {
      if (!numericOrNull(risk[key])) failures.push(`${id}.risk.${key}: must be a number or null`);
    }
    if (numericOrNull(risk.max_drawdown) && risk.max_drawdown !== null && risk.max_drawdown > 0) {
      failures.push(`${id}: max_drawdown must be negative or zero`);
    }
    if (risk.correlation_vs_world_proxy !== null && Math.abs(risk.correlation_vs_world_proxy) > 1) {
      failures.push(`${id}: correlation outside [-1,1]`);
    }

    // Sharpe/Sortino may only exist when a real risk-free rate was observed.
    if (!riskFreeAvailable && (risk.sharpe !== null || risk.sortino !== null)) {
      failures.push(`${id}: Sharpe/Sortino published without an observed risk-free rate`);
    }

    // THE currency invariant: a suppressed comparison must carry no figures.
    const comparability = String(risk.benchmark_comparability || '');
    if (comparability.startsWith('suppressed_')) {
      if (risk.beta_vs_world_proxy !== null || risk.tracking_error_vs_world_proxy !== null || risk.correlation_vs_world_proxy !== null) {
        failures.push(`${id}: benchmark comparison suppressed yet beta/tracking-error/correlation published`);
      }
    } else if (comparability !== 'same_currency') {
      failures.push(`${id}: benchmark_comparability not declared`);
    }

    // Cross-currency relative returns must be suppressed with a reason too.
    for (const [key, block] of Object.entries(etf.relative || {})) {
      if (block && block.unavailable === 'currency_mismatch') continue;
      if (block === null) continue;
      for (const [horizon, value] of Object.entries(block)) {
        if (!numericOrNull(value)) failures.push(`${id}.relative.${key}.${horizon}: must be a number or null`);
      }
    }
  }

  if (artifact.source_hash !== hash(JSON.stringify(etfs.map((e) => ({ ...e, source: undefined }))))) {
    failures.push('source_hash does not match recomputed payload (artifact hand-edited?)');
  }

  scanForbidden(etfs.map((e) => ({ ...e, monthly_closes: undefined })), 'analytics', failures);
  return failures;
}

// ---------------------------------------------------------------------------
// similarity
// ---------------------------------------------------------------------------

function validateSimilarity(artifact) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['similarity artifact unreadable'];

  const etfs = Array.isArray(artifact.etfs) ? artifact.etfs : [];
  if (!etfs.length) failures.push('no ETFs in similarity artifact');

  for (const etf of etfs) {
    const id = etf.slug || '?';
    if (!Array.isArray(etf.evidence) || etf.evidence.length < 2) {
      failures.push(`${id}: fewer than 2 evidence lines`);
    }
    const peers = Array.isArray(etf.peers) ? etf.peers : [];
    if (etf.available && !peers.length) failures.push(`${id}: marked available with no peers`);
    if (!etf.available && peers.length) failures.push(`${id}: marked unavailable yet carries peers`);

    let previous = Infinity;
    for (const peer of peers) {
      if (peer.slug === etf.slug) failures.push(`${id}: lists itself as a peer`);
      if (!(typeof peer.similarity_pct === 'number' && peer.similarity_pct >= 0 && peer.similarity_pct <= 100)) {
        failures.push(`${id}: peer ${peer.slug} similarity outside 0-100`);
      }
      if (peer.similarity_pct > previous) failures.push(`${id}: peers not sorted by similarity`);
      previous = peer.similarity_pct;
      const c = peer.components || {};
      if (!numericOrNull(c.correlation) || (c.correlation !== null && Math.abs(c.correlation) > 1)) {
        failures.push(`${id}: peer ${peer.slug} correlation invalid`);
      }
      if (!Number.isFinite(peer.shared_months) || peer.shared_months < 2) {
        failures.push(`${id}: peer ${peer.slug} missing shared observation count`);
      }
    }
  }

  if (artifact.source_hash !== hash(JSON.stringify(etfs))) {
    failures.push('source_hash does not match recomputed payload (artifact hand-edited?)');
  }

  scanForbidden(etfs, 'similarity', failures);
  return failures;
}

// ---------------------------------------------------------------------------
// score config — the single source of truth for the model
// ---------------------------------------------------------------------------

const SCORE_CONFIG_FILE = path.join(ROOT, 'config/etf-score.json');

function validateScoreConfig(raw) {
  const failures = [];
  let config = raw;
  if (!config) {
    try {
      const { stripComments } = require('./build-etf-score');
      config = stripComments(JSON.parse(fs.readFileSync(SCORE_CONFIG_FILE, 'utf8')));
    } catch (error) {
      return [`score config unreadable: ${error.message}`];
    }
  }

  const weights = config.weights || {};
  const keys = Object.keys(weights);
  if (!keys.length) failures.push('config has no weights');

  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 1e-9) failures.push(`weights sum to ${sum}, expected exactly 1`);
  for (const [key, weight] of Object.entries(weights)) {
    if (!(typeof weight === 'number' && weight > 0 && weight <= 1)) failures.push(`weight ${key} outside (0,1]`);
  }

  if (!(typeof config.min_weight_coverage === 'number' && config.min_weight_coverage > 0 && config.min_weight_coverage <= 1)) {
    failures.push('min_weight_coverage outside (0,1]');
  }

  const bands = Array.isArray(config.bands) ? config.bands : [];
  if (bands.length < 2) failures.push('config needs at least two score bands');
  // Bands must descend so the first match is the right one.
  for (let i = 1; i < bands.length; i += 1) {
    if (!(bands[i].min < bands[i - 1].min)) failures.push(`band "${bands[i].label}" does not descend below "${bands[i - 1].label}"`);
  }
  if (bands.length && bands[bands.length - 1].min !== 0) failures.push('lowest band must start at 0 so every score lands somewhere');
  if (!config.indeterminate_label) failures.push('missing indeterminate_label');

  for (const [name, scale] of Object.entries(config.scales || {})) {
    if (name === 'volatility_penalty') continue;
    if (!(typeof scale.best === 'number' && typeof scale.worst === 'number')) failures.push(`scale ${name} missing best/worst`);
    else if (scale.best === scale.worst) failures.push(`scale ${name} has best === worst`);
  }

  if (!config.breadth_tiers || !Object.keys(config.breadth_tiers).length) failures.push('missing breadth_tiers');
  for (const [category, tier] of Object.entries(config.breadth_tiers || {})) {
    if (!(typeof tier === 'number' && tier >= 0 && tier <= 1)) failures.push(`breadth tier ${category} outside 0-1`);
  }

  // Every category in the coverage universe needs a configured breadth tier,
  // otherwise adding a fund silently makes its diversification indeterminate.
  try {
    const { UNIVERSE } = require('./etf-universe');
    for (const category of new Set(UNIVERSE.map((e) => e.category))) {
      if (config.breadth_tiers[category] === undefined) failures.push(`no breadth tier configured for universe category "${category}"`);
    }
  } catch { /* universe checked separately */ }

  return failures;
}

// ---------------------------------------------------------------------------
// score
// ---------------------------------------------------------------------------

function validateScore(artifact) {
  const failures = [];
  if (!artifact || typeof artifact !== 'object') return ['score artifact unreadable'];

  const method = artifact.method || {};
  const weights = method.weights || {};
  const labels = Array.isArray(method.labels) ? method.labels : [];
  const floor = method.min_weight_coverage;

  if (!labels.length) failures.push('method.labels missing');
  if (!Number.isFinite(floor)) failures.push('method.min_weight_coverage missing');

  // The published weights must actually sum to 1 — otherwise "model coverage"
  // percentages are meaningless.
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (Math.abs(weightSum - 1) > 1e-9) failures.push(`method weights sum to ${weightSum}, expected 1`);

  // Both tax assumptions must be published: an undeclared jurisdictional
  // assumption inside a score is exactly the kind of hidden premise this
  // platform's governance forbids.
  for (const key of ['tax_assumption_en', 'tax_assumption_ar']) {
    if (!method[key] || String(method[key]).length < 40) failures.push(`method.${key} missing or too short`);
  }

  // The artifact must declare which config produced it, so the published model
  // and the running model are provably the same file.
  if (artifact.config_file !== 'config/etf-score.json') failures.push('artifact does not name config/etf-score.json as its source');
  const configFailures = validateScoreConfig({ weights, bands: method.bands, min_weight_coverage: floor, indeterminate_label: 'indeterminate', scales: method.scales, breadth_tiers: method.breadth_tiers });
  for (const problem of configFailures) failures.push(`config mismatch: ${problem}`);

  const etfs = Array.isArray(artifact.etfs) ? artifact.etfs : [];
  if (!etfs.length) failures.push('no ETFs in score artifact');

  for (const etf of etfs) {
    const id = etf.slug || '?';
    if (!labels.includes(etf.label)) failures.push(`${id}: label "${etf.label}" not in published set`);
    if (!Array.isArray(etf.evidence) || etf.evidence.length < 2) failures.push(`${id}: fewer than 2 evidence lines`);

    const subs = etf.sub_scores || {};
    const keys = Object.keys(weights);
    for (const key of keys) {
      const sub = subs[key];
      if (!sub) { failures.push(`${id}: missing sub-score ${key}`); continue; }
      if (sub.status === 'computed') {
        if (!(typeof sub.value === 'number' && sub.value >= 0 && sub.value <= 100)) {
          failures.push(`${id}.${key}: computed value outside 0-100`);
        }
        // A published number must say where it came from.
        if (!Array.isArray(sub.evidence) || !sub.evidence.length) {
          failures.push(`${id}.${key}: computed without evidence`);
        }
      } else if (sub.status === 'indeterminate') {
        if (sub.value !== null) failures.push(`${id}.${key}: indeterminate yet carries a value`);
        if (!sub.reason) failures.push(`${id}.${key}: indeterminate without a stated reason`);
      } else {
        failures.push(`${id}.${key}: unknown status "${sub.status}"`);
      }
    }

    // Evaluated + skipped must account for every weighted component exactly once.
    const evaluated = etf.components_evaluated || [];
    const skipped = (etf.components_skipped || []).map((s) => s.component);
    const accounted = [...evaluated, ...skipped].sort();
    if (JSON.stringify(accounted) !== JSON.stringify(keys.slice().sort())) {
      failures.push(`${id}: evaluated+skipped does not account for every component`);
    }

    // Recompute the overall from the sub-scores — catches a hand-tuned headline.
    let weighted = 0;
    let used = 0;
    for (const key of keys) {
      const sub = subs[key];
      if (sub && sub.status === 'computed') { weighted += sub.value * weights[key]; used += weights[key]; }
    }
    if (Math.abs(used - (etf.model_coverage || 0)) > 1e-6) {
      failures.push(`${id}: model_coverage ${etf.model_coverage} does not match evaluated weight ${used}`);
    }
    const expected = used >= floor ? Math.round((weighted / used) * 10) / 10 : null;
    if (expected === null && etf.overall !== null) {
      failures.push(`${id}: overall published below the ${floor} coverage floor`);
    }
    if (expected !== null && Math.abs((etf.overall ?? -1) - expected) > 0.05) {
      failures.push(`${id}: overall ${etf.overall} does not match recomputed ${expected}`);
    }
  }

  if (artifact.source_hash !== hash(JSON.stringify(etfs))) {
    failures.push('source_hash does not match recomputed payload (artifact hand-edited?)');
  }

  scanForbidden(etfs, 'score', failures);
  return failures;
}

// ---------------------------------------------------------------------------
// pages
// ---------------------------------------------------------------------------

// Page-level bank. Deliberately narrower than the artifact bank above: pages
// carry disclaimers that legitimately contain words like "signal" in a negation
// ("not a trading signal"), so only instructional phrases are banned here.
// This mirrors check-etf-research.js.
const PAGE_FORBIDDEN = [
  /\bbuy now\b/i, /\bsell now\b/i, /\bentry point\b/i, /\bstop[- ]?loss\b/i,
  /\bprice target\b/i, /\bguaranteed\b/i, /\bwill (rise|fall|rally|crash)\b/i,
  /\bshould (buy|sell)\b/i, /\bwe recommend\b/i,
  /شراء\s+الآن|بيع\s+الآن|هدف\s*سعري|مضمون/,
];

const CENTER_ROUTES = [
  'etfs/', 'etfs/finder/', 'etfs/categories/', 'etfs/rankings/',
  'etfs/compare/', 'etfs/portfolio-models/', 'etfs/learn/', 'etfs/methodology/',
  'etfs/data-audit/',
];

function validatePages() {
  const failures = [];
  const fsRoot = path.join(__dirname, '..');

  for (const route of CENTER_ROUTES) {
    for (const ar of [false, true]) {
      const rel = `${ar ? 'ar/' : ''}${route}index.html`;
      const file = path.join(fsRoot, rel);
      if (!fs.existsSync(file)) { failures.push(`${rel}: missing`); continue; }
      const html = fs.readFileSync(file, 'utf8');

      if (ar && !/<html lang="ar" dir="rtl">/.test(html)) failures.push(`${rel}: missing AR RTL`);
      if (!ar && !/<html lang="en" dir="ltr">/.test(html)) failures.push(`${rel}: missing EN LTR`);
      if (!new RegExp(`<link rel="canonical" href="https://www\\.tradealphaai\\.com/${ar ? 'ar/' : ''}${route.replace(/\//g, '\\/')}"`).test(html)) {
        failures.push(`${rel}: missing or wrong canonical`);
      }
      if (!/hreflang="en"/.test(html) || !/hreflang="ar"/.test(html)) failures.push(`${rel}: missing hreflang parity`);
      if (!/<meta name="robots" content="index,follow/.test(html)) failures.push(`${rel}: not indexable`);
      // The disclaimer every Center page inherits from the shared shell.
      if (!/not a trading signal|ليست إشارة تداول/.test(html)) failures.push(`${rel}: missing safety disclaimer`);
      if (!/\/css\/etf-center\.css/.test(html)) failures.push(`${rel}: missing ETF Center stylesheet`);
      if (!/GLOBAL_HEADER_END/.test(html)) failures.push(`${rel}: missing baked global header`);
      if (!/site-footer/.test(html)) failures.push(`${rel}: missing global footer`);
      if (ar && !ARABIC.test(html)) failures.push(`${rel}: Arabic page lacks Arabic text`);
      if (/\b(undefined|NaN|\[object Object\])\b/.test(html)) failures.push(`${rel}: leaks undefined/NaN/[object Object]`);
      // A missing value must be an explicit status, never a bare dash or a
      // silent blank pretending to be data.
      if (/<td[^>]*>\s*(--|·|N\/A|n\/a)\s*<\/td>/i.test(html)) {
        failures.push(`${rel}: renders a bare placeholder instead of an explicit status`);
      }
      for (const re of PAGE_FORBIDDEN) if (re.test(html)) failures.push(`${rel}: forbidden page language ${re}`);
    }
  }

  // Every ETF detail page must carry the field-by-field provenance audit and
  // must never present a fund fact without a provenance label.
  const { UNIVERSE } = require('./etf-universe');
  for (const entry of UNIVERSE) {
    for (const ar of [false, true]) {
      const rel = `${ar ? 'ar/' : ''}research/etfs/${entry.slug}/index.html`;
      const file = path.join(fsRoot, rel);
      if (!fs.existsSync(file)) { failures.push(`${rel}: missing`); continue; }
      const html = fs.readFileSync(file, 'utf8');
      if (!html.includes('id="etf-provenance-audit"')) failures.push(`${rel}: missing the data provenance audit section`);
      if (!html.includes('id="etf-fund-information"')) failures.push(`${rel}: missing the fund information table`);
      if (!/etf-prov etf-prov-/.test(html)) failures.push(`${rel}: fund facts rendered without provenance labels`);
      // The awaiting status must appear verbatim wherever a field is absent.
      const awaitingCount = (html.match(/etf-prov-unavailable/g) || []).length;
      if (awaitingCount > 0 && !new RegExp(ar ? 'بانتظار بيانات موثّقة' : 'Awaiting verified data').test(html)) {
        failures.push(`${rel}: unavailable fields present without the awaiting-data label`);
      }
      if (/(undefined|NaN|\[object Object\])/.test(html)) failures.push(`${rel}: leaks undefined/NaN/[object Object]`);
    }
  }

  // The methodology page must publish the assumptions the score depends on.
  const methodology = path.join(fsRoot, 'etfs/methodology/index.html');
  if (fs.existsSync(methodology)) {
    const html = fs.readFileSync(methodology, 'utf8');
    for (const required of ['etf-method-components', 'etf-method-bands', 'etf-method-tiers', 'etf-method-assumption', 'etf-method-limits']) {
      if (!html.includes(`id="${required}"`)) failures.push(`etfs/methodology/: missing section ${required}`);
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------

function failFor(name, failures) {
  if (failures.length) {
    failures.forEach((failure) => console.error(`[${name}] FAIL: ${failure}`));
    return false;
  }
  console.log(`[${name}] OK`);
  return true;
}

const CHECKS = {
  universe: () => ({ name: 'check:etf-universe', failures: validateUniverse(require('./etf-universe')) }),
  facts: () => ({ name: 'check:etf-facts', failures: validateFacts(readJson(J('etf-facts.json'))) }),
  'score-config': () => ({ name: 'check:etf-score-config', failures: validateScoreConfig() }),
  analytics: () => ({ name: 'check:etf-analytics', failures: validateAnalytics(readJson(J('etf-analytics.json'))) }),
  similarity: () => ({ name: 'check:etf-similarity', failures: validateSimilarity(readJson(J('etf-similarity.json'))) }),
  score: () => ({ name: 'check:etf-score', failures: validateScore(readJson(J('etf-score.json'))) }),
  pages: () => ({ name: 'check:etf-center-pages', failures: validatePages() }),
};

function selfTest() {
  const universe = require('./etf-universe');
  const analytics = readJson(J('etf-analytics.json'));
  const facts = readJson(J('etf-facts.json'));
  const similarity = readJson(J('etf-similarity.json'));
  const score = readJson(J('etf-score.json'));

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rehashAnalytics = (a) => {
    a.source_hash = hash(JSON.stringify(a.etfs.map((e) => ({ ...e, source: undefined }))));
    return a;
  };
  const rehash = (a) => { a.source_hash = hash(JSON.stringify(a.etfs)); return a; };

  const cases = [
    // universe
    ['universe clean', () => validateUniverse(universe), false],
    ['universe registry carrying a factual key', () => {
      // Simulate a registry that reintroduces a fund fact — the exact thing
      // the new contract forbids.
      const tmp = path.join(ROOT, 'data/.selftest-universe.json');
      const raw = JSON.parse(fs.readFileSync(universe.REGISTRY_FILE, 'utf8'));
      raw.etfs[0].ter_pct = 0.07;
      fs.writeFileSync(tmp, JSON.stringify(raw));
      const result = validateUniverse({ ...universe, REGISTRY_FILE: tmp });
      fs.unlinkSync(tmp);
      return result;
    }, true],
    ['universe forbidden language', () => {
      const m = { ...universe, UNIVERSE: clone(universe.UNIVERSE) };
      m.UNIVERSE[0].role_en = 'a buy signal for investors';
      return validateUniverse(m);
    }, true],

    // facts — the anti-model-knowledge gate
    ['facts clean', () => validateFacts(facts), false],
    ['facts value without provenance', () => {
      const m = clone(facts);
      // The exact regression this guards: a factual value reappearing with no
      // verifiable origin.
      m.etfs[0].fields.ter_pct = { value: 0.07, provenance: 'unavailable', reason: 'no_free_verifiable_source' };
      m.etfs[0].provenance_counts = P.summarise(m.etfs[0].fields);
      return validateFacts(rehash(m));
    }, true],
    ['facts factual field declared by us', () => {
      const m = clone(facts);
      m.etfs[0].fields.ter_pct = { value: 0.07, provenance: 'declared', basis: 'known_from_prior_knowledge' };
      m.etfs[0].provenance_counts = P.summarise(m.etfs[0].fields);
      return validateFacts(rehash(m));
    }, true],
    ['facts fetched without a response hash', () => {
      const m = clone(facts);
      const target = m.etfs.find((e) => e.fields.fund_name.provenance === 'fetched');
      delete target.fields.fund_name.source.response_hash;
      return validateFacts(rehash(m));
    }, true],
    ['facts bad ISIN check digit', () => {
      const m = clone(facts);
      m.etfs[0].fields.isin = { value: 'US78462F1031', provenance: 'fetched', source: { provider: 'X', endpoint: 'https://x/', response_hash: 'h', fetched_at: '2026-08-04' } };
      m.etfs[0].provenance_counts = P.summarise(m.etfs[0].fields);
      return validateFacts(rehash(m));
    }, true],
    ['facts unavailable with a reason outside the closed set', () => {
      const m = clone(facts);
      m.etfs[0].fields.domicile = { value: null, provenance: 'unavailable', reason: 'we_did_not_look' };
      return validateFacts(rehash(m));
    }, true],
    ['facts hand-edited hash', () => {
      const m = clone(facts);
      m.etfs[0].ticker = 'EDITED';
      return validateFacts(m);
    }, true],

    // score config
    ['score config clean', () => validateScoreConfig(), false],
    ['score config weights not summing to 1', () => validateScoreConfig({
      weights: { cost: 0.9, liquidity: 0.2 }, bands: [{ label: 'a', min: 0 }, { label: 'b', min: 50 }],
      min_weight_coverage: 0.5, indeterminate_label: 'indeterminate', scales: {}, breadth_tiers: { broad_market: 0.9 },
    }), true],
    ['score config bands not descending', () => validateScoreConfig({
      weights: { cost: 1 }, bands: [{ label: 'low', min: 0 }, { label: 'high', min: 80 }],
      min_weight_coverage: 0.5, indeterminate_label: 'indeterminate', scales: {}, breadth_tiers: { broad_market: 0.9 },
    }), true],

    // analytics
    ['analytics clean', () => validateAnalytics(analytics), false],
    ['analytics suppressed-yet-published beta', () => {
      const m = clone(analytics);
      const target = m.etfs.find((e) => String(e.risk && e.risk.benchmark_comparability).startsWith('suppressed_'));
      if (!target) return ['fixture lacks a suppressed entry'];
      target.risk.beta_vs_world_proxy = 0.98;
      return validateAnalytics(rehashAnalytics(m));
    }, true],
    ['analytics positive drawdown', () => {
      const m = clone(analytics);
      m.etfs.find((e) => e.available).risk.max_drawdown = 0.2;
      return validateAnalytics(rehashAnalytics(m));
    }, true],
    ['analytics figures without risk-free', () => {
      const m = clone(analytics);
      m.risk_free = null;
      return validateAnalytics(rehashAnalytics(m));
    }, true],
    ['analytics hand-edited hash', () => {
      const m = clone(analytics);
      m.etfs.find((e) => e.available).risk.sharpe = 9.99;
      return validateAnalytics(m);
    }, true],

    // similarity
    ['similarity clean', () => validateSimilarity(similarity), false],
    ['similarity self-peer', () => {
      const m = clone(similarity);
      const target = m.etfs.find((e) => e.peers.length);
      target.peers[0].slug = target.slug;
      return validateSimilarity(rehash(m));
    }, true],
    ['similarity out-of-range pct', () => {
      const m = clone(similarity);
      m.etfs.find((e) => e.peers.length).peers[0].similarity_pct = 140;
      return validateSimilarity(rehash(m));
    }, true],
    ['similarity unsorted peers', () => {
      const m = clone(similarity);
      const target = m.etfs.find((e) => e.peers.length >= 2);
      target.peers.reverse();
      return validateSimilarity(rehash(m));
    }, true],

    // score
    ['score clean', () => validateScore(score), false],
    ['score hand-tuned overall', () => {
      const m = clone(score);
      m.etfs[0].overall = 99.9;
      return validateScore(rehash(m));
    }, true],
    ['score indeterminate with a value', () => {
      const m = clone(score);
      const target = m.etfs.find((e) => Object.values(e.sub_scores).some((s) => s.status === 'indeterminate'));
      const key = Object.keys(target.sub_scores).find((k) => target.sub_scores[k].status === 'indeterminate');
      target.sub_scores[key].value = 88;
      return validateScore(rehash(m));
    }, true],
    ['score component without evidence', () => {
      const m = clone(score);
      const target = m.etfs.find((e) => Object.values(e.sub_scores).some((s) => s.status === 'computed'));
      const key = Object.keys(target.sub_scores).find((k) => target.sub_scores[k].status === 'computed');
      target.sub_scores[key].evidence = [];
      return validateScore(rehash(m));
    }, true],
    ['score weights not summing to 1', () => {
      const m = clone(score);
      m.method.weights.cost = 0.9;
      return validateScore(rehash(m));
    }, true],
    ['score undeclared tax assumption', () => {
      const m = clone(score);
      delete m.method.tax_assumption_en;
      return validateScore(rehash(m));
    }, true],
    ['score label outside published set', () => {
      const m = clone(score);
      m.etfs[0].label = 'must-own';
      return validateScore(rehash(m));
    }, true],
  ];

  let ok = 0;
  for (const [label, run, shouldFail] of cases) {
    const failed = run().length > 0;
    if (failed === shouldFail) ok += 1;
    else console.error(`[etf-center] self-test MISMATCH: ${label} (expected ${shouldFail ? 'fail' : 'pass'})`);
  }
  console.log(`[etf-center] self-test: ${ok}/${cases.length} passed`);
  return ok === cases.length;
}

function main() {
  if (process.argv.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }
  let check = null;
  for (const arg of process.argv.slice(2)) {
    const match = /^--check=(.+)$/.exec(arg);
    if (match) check = match[1];
  }
  if (!check || !CHECKS[check]) {
    console.error(`usage: node tools/check-etf-center.js --check=<${Object.keys(CHECKS).join('|')}> | --self-test`);
    process.exit(2);
  }
  const { name, failures } = CHECKS[check]();
  if (!failFor(name, failures)) process.exit(1);
}

if (require.main === module) main();

module.exports = {
  validateUniverse, validateFacts, validateAnalytics,
  validateSimilarity, validateScore, validateScoreConfig, validatePages, selfTest,
  CENTER_ROUTES, PAGE_FORBIDDEN,
};
