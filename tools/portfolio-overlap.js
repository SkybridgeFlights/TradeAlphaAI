'use strict';

// Phase 228 CP7 — ETF overlap intelligence.
//
// Answers one question about a pair of holdings: what evidence exists that they
// represent the same exposure? Each finding is stamped with the class of evidence
// behind it, strongest first, so a reader can tell a fact from an inference:
//
//   verified_same_fund      Both funds' VERIFIED provider names are identical.
//                           Two listings of one fund. This is a fact.
//   verified_share_class    Same issuer and the same fund name once share-class
//                           and currency suffixes are removed. Accumulating and
//                           distributing classes of one strategy.
//   measured_co_movement    Observed return correlation. A measurement of how
//                           they have behaved, not of what they hold.
//   registry_same_benchmark Both funds declare the same benchmark in the project
//                           registry. Project data, not independently verified.
//   likely_category_overlap Both carry the same TradeAlphaAI category. Our own
//                           classification — the weakest class, labelled as ours.
//
// AND ONE ABSENCE, STATED EVERY TIME:
//
//   verified_holdings_overlap  UNAVAILABLE. No free source publishes holdings for
//                           this universe, so true overlap — the share of
//                           underlying companies two funds have in common —
//                           cannot be computed. High correlation is not holdings
//                           overlap, and this module never presents it as such.
//
// Nothing here tells a holder to do anything about an overlap it finds.

const P = require('./etf-provenance');

// Correlation bands. Above 0.99 two funds have moved essentially as one; the
// bands exist so a reader sees a described strength, not a bare decimal.
const CO_MOVEMENT_BANDS = [
  { min: 0.99, band: 'near_identical' },
  { min: 0.95, band: 'very_high' },
  { min: 0.85, band: 'high' },
  { min: 0.70, band: 'moderate' },
];

const CO_MOVEMENT_FLOOR = 0.85;
const SHARE_CLASS_CORRELATION_FLOOR = 0.97;

const EVIDENCE_CLASSES = [
  'verified_same_fund',
  'verified_share_class',
  'measured_co_movement',
  'registry_same_benchmark',
  'likely_category_overlap',
];

// Share-class and currency markers that distinguish two listings of the same
// strategy. Removing them reveals whether the underlying fund name is the same.
const SHARE_CLASS_TOKENS = /\b(acc|accumulating|accumulation|dist|distributing|distribution|income|inc|hedged|unhedged)\b/gi;
const CURRENCY_TOKENS = /\b(usd|eur|gbp|chf|jpy|sek|cad)\b/gi;

function verifiedValue(facts, field) {
  const record = facts && facts.fields && facts.fields[field];
  return record && P.hasValue(record) ? record.value : null;
}

/** Fund name reduced to its strategy: share class and currency removed. */
function normaliseFundName(name) {
  if (!name) return null;
  return String(name)
    .toLowerCase()
    .replace(/[()\-–,.]/g, ' ')
    .replace(SHARE_CLASS_TOKENS, ' ')
    .replace(CURRENCY_TOKENS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coMovementBand(correlation) {
  for (const b of CO_MOVEMENT_BANDS) if (correlation >= b.min) return b.band;
  return 'low';
}

/** Measured correlation between two slugs, from the similarity artifact. */
function measuredCorrelation(slugA, slugB, similarityBySlug) {
  const entry = similarityBySlug.get(slugA);
  const peer = entry && Array.isArray(entry.peers) ? entry.peers.find((p) => p.slug === slugB) : null;
  if (peer && peer.components && Number.isFinite(peer.components.correlation)) {
    return { correlation: peer.components.correlation, shared_months: peer.shared_months };
  }
  // Similarity is capped per fund, so check the reverse direction too.
  const reverse = similarityBySlug.get(slugB);
  const back = reverse && Array.isArray(reverse.peers) ? reverse.peers.find((p) => p.slug === slugA) : null;
  if (back && back.components && Number.isFinite(back.components.correlation)) {
    return { correlation: back.components.correlation, shared_months: back.shared_months };
  }
  return null;
}

/**
 * Assess one pair. Returns null when no evidence class applies — silence is the
 * correct output for two unrelated holdings.
 */
function assessPair(a, b, artifacts) {
  const { factsBySlug, similarityBySlug } = artifacts;
  const factsA = factsBySlug.get(a.slug);
  const factsB = factsBySlug.get(b.slug);

  const nameA = verifiedValue(factsA, 'fund_name');
  const nameB = verifiedValue(factsB, 'fund_name');
  const issuerA = verifiedValue(factsA, 'issuer');
  const issuerB = verifiedValue(factsB, 'issuer');
  const benchA = verifiedValue(factsA, 'benchmark');
  const benchB = verifiedValue(factsB, 'benchmark');
  const catA = factsA && factsA.classification && factsA.classification.category ? factsA.classification.category.value : null;
  const catB = factsB && factsB.classification && factsB.classification.category ? factsB.classification.category.value : null;

  const measured = measuredCorrelation(a.slug, b.slug, similarityBySlug);
  const findings = [];

  // 1. Identical verified names — one fund, two listings.
  if (nameA && nameB && nameA.trim() === nameB.trim()) {
    findings.push({
      evidence: 'verified_same_fund',
      provenance: 'fetched',
      detail_en: `Both listings return the identical fund name from the data provider: "${nameA}". These are two listings of one fund, not two holdings.`,
      detail_ar: `يعيد الإدراجان اسم الصندوق نفسه حرفيا من مزود البيانات: "${nameA}". وهما إدراجان لصندوق واحد، لا حيازتان منفصلتان.`,
    });
  } else if (nameA && nameB && issuerA && issuerB && issuerA === issuerB
    && normaliseFundName(nameA) === normaliseFundName(nameB)
    && measured && measured.correlation >= SHARE_CLASS_CORRELATION_FLOOR) {
    // 2. Same issuer, same strategy name, only share class differs.
    const distA = verifiedValue(factsA, 'distribution');
    const distB = verifiedValue(factsB, 'distribution');
    const classNote = distA && distB && distA !== distB
      ? ` One is ${distA}, the other ${distB}.`
      : '';
    findings.push({
      evidence: 'verified_share_class',
      provenance: 'derived_from_verified_names',
      detail_en: `Same issuer (${issuerA}) and the same fund name once share-class and currency suffixes are removed, with observed correlation ${measured.correlation.toFixed(4)}.${classNote} These represent share classes of one strategy.`,
      detail_ar: `الجهة المُصدِرة نفسها (${issuerA}) واسم الصندوق نفسه بعد إزالة لواحق فئة الأسهم والعملة، مع ارتباط مرصود ${measured.correlation.toFixed(4)}.${classNote ? ' إحداهما ' + distA + ' والأخرى ' + distB + '.' : ''} وهما فئتان من استراتيجية واحدة.`,
    });
  }

  // 3. Measured co-movement — reported on its own terms, never as holdings overlap.
  if (measured && measured.correlation >= CO_MOVEMENT_FLOOR) {
    findings.push({
      evidence: 'measured_co_movement',
      provenance: 'derived',
      correlation: measured.correlation,
      band: coMovementBand(measured.correlation),
      shared_months: measured.shared_months,
      detail_en: `Observed return correlation ${measured.correlation.toFixed(4)} across ${measured.shared_months} shared monthly observations (${coMovementBand(measured.correlation).replace(/_/g, ' ')}). This measures how the two have moved together, not what they hold.`,
      detail_ar: `ارتباط العوائد المرصود ${measured.correlation.toFixed(4)} عبر ${measured.shared_months} مشاهدة شهرية مشتركة. وهذا يقيس مدى تحركهما معا، لا ما يحتويانه.`,
    });
  }

  // 4. Registry-declared benchmark match.
  if (benchA && benchB && benchA === benchB) {
    findings.push({
      evidence: 'registry_same_benchmark',
      provenance: 'project_registry',
      detail_en: `Both funds are recorded in the project registry as tracking ${benchA}. This is project data, not independently verified.`,
      detail_ar: `كلا الصندوقين مسجّل في سجل المشروع على أنه يتتبع ${benchA}. وهذه بيانات مشروع غير موثّقة بشكل مستقل.`,
    });
  }

  // 5. Weakest class: our own category classification.
  if (catA && catB && catA === catB) {
    findings.push({
      evidence: 'likely_category_overlap',
      provenance: 'tradealphaai_classification',
      category: catA,
      detail_en: `Both are classified by TradeAlphaAI as ${catA.replace(/_/g, ' ')} exposure. This is our editorial classification, not a statement about the underlying holdings.`,
      detail_ar: `يُصنّف كلاهما لدى TradeAlphaAI كتعرض من نوع ${catA.replace(/_/g, ' ')}. وهذا تصنيفنا التحريري، وليس بيانا عن المكونات الأساسية.`,
    });
  }

  if (!findings.length) return null;

  return {
    a: a.symbol,
    b: b.symbol,
    a_slug: a.slug,
    b_slug: b.slug,
    strongest: findings[0].evidence,
    findings,
    // The absence is part of the finding, not a footnote.
    holdings_overlap: {
      available: false,
      reason: P.REASONS.NO_FREE_SOURCE,
      note_en: 'True holdings overlap cannot be computed: no free verifiable source publishes the constituents of these funds. Correlation is not a substitute for it.',
      note_ar: 'لا يمكن حساب التداخل الفعلي في المكونات: لا يوجد مصدر مجاني موثّق ينشر مكونات هذه الصناديق. والارتباط ليس بديلا عنه.',
    },
  };
}

/**
 * Redundancy clusters: groups of holdings joined by same-fund or share-class
 * evidence. A cluster's combined weight is the concentration a holder may not
 * realise they have, since it looks like several positions.
 */
function buildClusters(pairs, weightBySymbol) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  const union = (x, y) => {
    if (!parent.has(x)) parent.set(x, x);
    if (!parent.has(y)) parent.set(y, y);
    const rx = find(x);
    const ry = find(y);
    if (rx !== ry) parent.set(rx, ry);
  };

  // Only the two verified classes create a cluster. Correlation alone does not:
  // two genuinely different funds can move together without being the same
  // exposure, and merging them would overstate redundancy.
  for (const p of pairs) {
    if (p.strongest === 'verified_same_fund' || p.strongest === 'verified_share_class') union(p.a, p.b);
  }

  const groups = new Map();
  for (const symbol of parent.keys()) {
    const root = find(symbol);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(symbol);
  }

  return [...groups.values()]
    .filter((members) => members.length > 1)
    .map((members) => {
      const weights = members.map((s) => weightBySymbol.get(s)).filter(Number.isFinite);
      const combined = weights.reduce((a, b) => a + b, 0);
      return {
        members: members.sort(),
        combined_weight: weights.length === members.length ? Math.round(combined * 1e6) / 1e6 : null,
        weight_complete: weights.length === members.length,
      };
    })
    .sort((a, b) => (b.combined_weight || 0) - (a.combined_weight || 0));
}

/**
 * Analyse overlap across a portfolio.
 *
 * @param {Array}  positions  valued positions, each { symbol, slug, weight? }
 * @param {Object} artifacts  from tools/portfolio-artifacts
 */
function analyseOverlap(positions, artifacts) {
  const rows = (Array.isArray(positions) ? positions : []).filter((p) => p.instrument_type !== 'cash' && p.slug);
  if (rows.length < 2) {
    return {
      available: false,
      reason: rows.length ? 'single_instrument' : 'no_instruments',
      pairs: [],
      clusters: [],
      evidence_classes: EVIDENCE_CLASSES,
      holdings_overlap_available: false,
    };
  }

  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const result = assessPair(rows[i], rows[j], artifacts);
      if (result) pairs.push(result);
    }
  }

  // Strongest evidence first, then by correlation where present.
  const rank = (e) => EVIDENCE_CLASSES.indexOf(e);
  pairs.sort((x, y) => {
    const d = rank(x.strongest) - rank(y.strongest);
    if (d !== 0) return d;
    const cx = (x.findings.find((f) => f.evidence === 'measured_co_movement') || {}).correlation || 0;
    const cy = (y.findings.find((f) => f.evidence === 'measured_co_movement') || {}).correlation || 0;
    return cy - cx;
  });

  const weightBySymbol = new Map(rows.filter((p) => Number.isFinite(p.weight)).map((p) => [p.symbol, p.weight]));
  const clusters = buildClusters(pairs, weightBySymbol);

  const duplicates = pairs.filter((p) => p.strongest === 'verified_same_fund');
  const shareClasses = pairs.filter((p) => p.strongest === 'verified_share_class');

  return {
    available: true,
    pair_count: pairs.length,
    pairs,
    clusters,
    summary: {
      duplicate_listings: duplicates.length,
      share_class_pairs: shareClasses.length,
      high_co_movement_pairs: pairs.filter((p) => p.findings.some((f) => f.evidence === 'measured_co_movement' && f.correlation >= 0.95)).length,
      category_overlaps: pairs.filter((p) => p.strongest === 'likely_category_overlap').length,
      largest_redundant_cluster_weight: clusters.length ? clusters[0].combined_weight : null,
    },
    evidence_classes: EVIDENCE_CLASSES,
    holdings_overlap_available: false,
    holdings_overlap_note_en: 'Verified holdings overlap is unavailable across this universe: no free source publishes fund constituents. Every finding above is based on verified fund identity, observed co-movement, project registry data or TradeAlphaAI classification — each labelled individually.',
    holdings_overlap_note_ar: 'التداخل الموثّق في المكونات غير متاح في هذا العالم من الصناديق: لا يوجد مصدر مجاني ينشر مكونات الصناديق. وكل نتيجة أعلاه تستند إلى هوية صندوق موثّقة أو تحرك مرصود أو بيانات سجل المشروع أو تصنيف TradeAlphaAI — وكل منها موسوم على حدة.',
    disclaimer_en: 'Overlap is described, not judged. Holding related funds is not necessarily a problem, and this section does not suggest changing anything.',
    disclaimer_ar: 'يوصف التداخل ولا يُحكم عليه. فالاحتفاظ بصناديق مترابطة ليس مشكلة بالضرورة، ولا يقترح هذا القسم تغيير أي شيء.',
  };
}

module.exports = {
  analyseOverlap, assessPair, buildClusters, normaliseFundName,
  measuredCorrelation, coMovementBand,
  EVIDENCE_CLASSES, CO_MOVEMENT_BANDS, CO_MOVEMENT_FLOOR, SHARE_CLASS_CORRELATION_FLOOR,
};
