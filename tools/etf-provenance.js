'use strict';

// ETF Intelligence Center — field-level provenance.
//
// THE RULE: no field is published unless this module can say where it came from.
// Every value carried through the pipeline is wrapped in a provenance record, and
// the validators reject any factual field that cannot name a verifiable origin.
//
// Four classes, and nothing else:
//
//   FETCHED     A provider response said so. Carries the provider, endpoint,
//               response hash and fetch time. Independently checkable.
//   DERIVED     Computed by us from FETCHED inputs (returns, volatility, scores)
//               or extracted from a FETCHED string. Carries the inputs used, and
//               for extractions, the exact source text it was read from.
//   DECLARED    TradeAlphaAI's own editorial classification (category, role copy).
//               A judgement we author and label as ours — never presented as a
//               fund fact. Also covers values inherited from the pre-existing
//               repo registry.
//   UNAVAILABLE No verified source exists. Renders as an explicit status, never
//               as a blank pretending to be data and never as a guess.
//
// There is deliberately NO class for "believed to be true". A value that cannot
// be traced to one of the four above does not enter the dataset.

const FETCHED = 'fetched';
const DERIVED = 'derived';
const DECLARED = 'declared';
const UNAVAILABLE = 'unavailable';

const CLASSES = [FETCHED, DERIVED, DECLARED, UNAVAILABLE];

// Fields that assert something about the fund itself. These may only be FETCHED,
// DERIVED or UNAVAILABLE — never DECLARED, because we are not a source of record
// for facts about somebody else's product.
const FACTUAL_FIELDS = [
  'fund_name', 'issuer', 'isin', 'ter_pct', 'aum', 'domicile',
  'replication', 'distribution', 'inception', 'listing_date',
  'currency', 'exchange', 'instrument_type', 'benchmark',
];

// The ONE basis on which a factual field may be DECLARED.
//
// tools/etf-registry.js is pre-existing project data (Phase 214) that already
// ships and is validated by check:etf-registry. Those twenty funds carry an
// issuer, fund name and benchmark authored by the project. Retaining them is
// legitimate; presenting them as independently verified is not — so they are
// labelled distinctly in the audit as project-registry values, and no NEW
// factual value may use this basis.
const REGISTRY_BASIS = 'repo_registry_phase_214';

// Reasons a field can be unavailable. A closed set so "unavailable" always
// carries a diagnosable cause rather than a shrug.
const REASONS = {
  NO_FREE_SOURCE: 'no_free_verifiable_source',
  PROVIDER_OMITTED: 'provider_response_omitted_field',
  FETCH_FAILED: 'provider_fetch_failed',
  INSUFFICIENT_HISTORY: 'insufficient_observed_history',
  NOT_APPLICABLE: 'not_applicable_to_this_instrument',
};

const REASON_VALUES = Object.values(REASONS);

/** A value a provider returned. `source` must identify the response. */
function fetched(value, source) {
  return { value, provenance: FETCHED, source };
}

/**
 * A value we computed. `inputs` names what it was computed from; `from_text`
 * carries the exact provider string when the value was extracted from one, so a
 * reader can see the evidence rather than take the extraction on trust.
 */
function derived(value, inputs, fromText) {
  const record = { value, provenance: DERIVED, inputs };
  if (fromText !== undefined) record.from_text = fromText;
  return record;
}

/** A TradeAlphaAI classification or a value inherited from the repo registry. */
function declared(value, basis) {
  return { value, provenance: DECLARED, basis };
}

/** No verified source. `reason` must come from REASONS. */
function unavailable(reason, note) {
  const record = { value: null, provenance: UNAVAILABLE, reason };
  if (note) record.note = note;
  return record;
}

/** True when a record carries a usable value. */
function hasValue(record) {
  return Boolean(record) && record.provenance !== UNAVAILABLE
    && record.value !== null && record.value !== undefined && record.value !== '';
}

/** The value, or null. Never throws on a missing record. */
function valueOf(record) {
  return hasValue(record) ? record.value : null;
}

/**
 * Validate one provenance record. Returns an array of problems (empty = valid).
 * This is the single gate every validator calls, so the rules cannot drift
 * between artifacts.
 */
function validateRecord(field, record) {
  const problems = [];
  if (!record || typeof record !== 'object') return [`${field}: not a provenance record`];
  if (!CLASSES.includes(record.provenance)) {
    return [`${field}: provenance "${record.provenance}" not in ${CLASSES.join('|')}`];
  }

  if (record.provenance === FETCHED) {
    const source = record.source;
    if (!source || typeof source !== 'object') problems.push(`${field}: fetched without a source`);
    else {
      if (!source.provider) problems.push(`${field}: fetched without a provider`);
      if (typeof source.endpoint !== 'string' || !source.endpoint.startsWith('https://')) {
        problems.push(`${field}: fetched without an https endpoint`);
      }
      if (!source.response_hash) problems.push(`${field}: fetched without a response hash`);
      if (!source.fetched_at) problems.push(`${field}: fetched without a timestamp`);
    }
    if (!hasValue(record)) problems.push(`${field}: fetched but carries no value`);
  }

  if (record.provenance === DERIVED) {
    if (!Array.isArray(record.inputs) || !record.inputs.length) {
      problems.push(`${field}: derived without naming its inputs`);
    }
    if (!hasValue(record)) problems.push(`${field}: derived but carries no value`);
  }

  if (record.provenance === DECLARED) {
    if (!record.basis) problems.push(`${field}: declared without a stated basis`);
    // A fact about the fund may never be merely declared by us — the sole
    // exception being values inherited from the pre-existing repo registry,
    // which are surfaced under their own audit label.
    if (FACTUAL_FIELDS.includes(field) && record.basis !== REGISTRY_BASIS) {
      problems.push(`${field}: factual field cannot be DECLARED (basis "${record.basis}") — it must be fetched, derived or unavailable`);
    }
  }

  if (record.provenance === UNAVAILABLE) {
    if (!REASON_VALUES.includes(record.reason)) {
      problems.push(`${field}: unavailable with unrecognised reason "${record.reason}"`);
    }
    if (record.value !== null) problems.push(`${field}: unavailable yet carries a value`);
  }

  return problems;
}

/** Validate a whole field map. */
function validateFields(fields, prefix = '') {
  const problems = [];
  for (const [name, record] of Object.entries(fields || {})) {
    problems.push(...validateRecord(`${prefix}${name}`, record));
  }
  return problems;
}

/** Counts by class, for the audit surfaces. */
function summarise(fields) {
  const counts = { fetched: 0, derived: 0, declared: 0, unavailable: 0, registry: 0 };
  for (const [name, record] of Object.entries(fields || {})) {
    if (!record || counts[record.provenance] === undefined) continue;
    // Registry-inherited facts are counted separately so the audit never lets
    // them hide inside the general "classification" bucket.
    if (record.provenance === DECLARED && record.basis === REGISTRY_BASIS && FACTUAL_FIELDS.includes(name)) {
      counts.registry += 1;
    } else {
      counts[record.provenance] += 1;
    }
  }
  return counts;
}

/** The audit label class for one field — distinguishes registry facts. */
function auditClass(name, record) {
  if (!record) return UNAVAILABLE;
  if (record.provenance === DECLARED && record.basis === REGISTRY_BASIS && FACTUAL_FIELDS.includes(name)) {
    return 'registry';
  }
  return record.provenance;
}

// Reader-facing labels for the audit tables.
const LABELS = {
  fetched: ['Verified', 'موثّق'],
  derived: ['Derived', 'مشتق'],
  declared: ['TradeAlphaAI classification', 'تصنيف TradeAlphaAI'],
  registry: ['Project registry — not independently verified', 'سجل المشروع — غير موثّق بشكل مستقل'],
  unavailable: ['Awaiting verified data', 'بانتظار بيانات موثّقة'],
};

const AWAITING_EN = 'Awaiting verified data';
const AWAITING_AR = 'بانتظار بيانات موثّقة';

const REASON_LABELS = {
  no_free_verifiable_source: ['No free verifiable source publishes this field', 'لا يوجد مصدر مجاني موثّق ينشر هذا الحقل'],
  provider_response_omitted_field: ['The provider response did not include this field', 'لم تتضمن استجابة المزود هذا الحقل'],
  provider_fetch_failed: ['The provider request did not succeed', 'لم ينجح طلب المزود'],
  insufficient_observed_history: ['Not enough observed history to measure this', 'لا يوجد تاريخ مرصود كافٍ لقياس هذا'],
  not_applicable_to_this_instrument: ['Not applicable to this instrument', 'لا ينطبق على هذه الأداة'],
};

module.exports = {
  FETCHED, DERIVED, DECLARED, UNAVAILABLE, CLASSES, REGISTRY_BASIS,
  FACTUAL_FIELDS, REASONS, REASON_VALUES, LABELS, REASON_LABELS,
  AWAITING_EN, AWAITING_AR,
  fetched, derived, declared, unavailable,
  hasValue, valueOf, validateRecord, validateFields, summarise, auditClass,
};
