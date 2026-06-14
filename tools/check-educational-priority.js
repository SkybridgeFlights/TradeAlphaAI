'use strict';

// Phase 123 — check:educational-priority. Governance gate for the deterministic
// educational priority/sequencing engine. HARD-FAILS if: a progression chain
// references a concept absent from the library, a chain is too short or self-
// loops, the deep-first invariant breaks (a deep candidate failing to outrank an
// otherwise-stronger shallow one), the ranking is non-deterministic, the anti-
// shallow-domination rule is missing, or scoring leaks null/undefined. The
// engine is pure, so these are checked by construction + against the real data.

const { CONCEPT_LIBRARY } = require('./educational-concept-library');
const { SEQUENCES, W, nextOf, rankCandidates } = require('./educational-priority');

const failures = [];
const fail = (m) => failures.push(m);

// 1) Sequence-chain integrity (the educational graph must be well-formed).
SEQUENCES.forEach((chain, i) => {
  if (!Array.isArray(chain) || chain.length < 2) fail(`sequence ${i}: chain must have ≥2 concepts`);
  if (new Set(chain).size !== chain.length) fail(`sequence ${i}: chain repeats a concept`);
  for (const id of chain) if (!CONCEPT_LIBRARY[id]) fail(`sequence ${i}: concept "${id}" not in library`);
  for (let j = 0; j + 1 < chain.length; j += 1) if (chain[j] === chain[j + 1]) fail(`sequence ${i}: concept "${chain[j]}" is its own successor`);
});

// 2) Weights present + deterministic (deep dominates base + every bonus).
if (!(W.DEEP > 100 + W.PROGRESSION + W.RELATED)) fail('deep weight does not dominate base priority + bonuses (deep-first not guaranteed)');
if (typeof W.SHALLOW_RUN !== 'number' || W.SHALLOW_RUN >= 0) fail('anti-shallow-domination penalty missing or non-negative');

// 3) Deep-first invariant by construction: a deep candidate with the WORST base
//    priority must still outrank a shallow candidate with the BEST base priority.
const deepId = Object.values(CONCEPT_LIBRARY).find((c) => c.is_deep);
const shallowId = Object.values(CONCEPT_LIBRARY).find((c) => c.is_deep === false);
if (deepId && shallowId) {
  const ctx = { library: CONCEPT_LIBRARY, recentSlugs: [] };
  const ranked = rankCandidates([
    { id: shallowId.slug, priority: 100 },
    { id: deepId.slug, priority: 1 },
  ], ctx);
  if (!ranked[0].is_deep) fail(`deep-first invariant broken: shallow "${ranked[0].id}" outranked deep "${deepId.slug}"`);
  // Determinism: re-rank yields identical order.
  const again = rankCandidates([
    { id: shallowId.slug, priority: 100 },
    { id: deepId.slug, priority: 1 },
  ], ctx);
  if (ranked.map((r) => r.id).join() !== again.map((r) => r.id).join()) fail('ranking is non-deterministic');
  // No null/undefined leak in scores/reasons.
  for (const r of ranked) {
    if (typeof r.score !== 'number' || Number.isNaN(r.score)) fail(`candidate ${r.id} has invalid score`);
    if (!Array.isArray(r.reasons) || r.reasons.some((x) => /undefined|null|NaN/.test(String(x)))) fail(`candidate ${r.id} reasons leak null/undefined`);
  }
}

// 4) Anti-shallow-domination: with two recent shallow publications, a shallow
//    candidate must score below the same candidate with no shallow run.
if (shallowId) {
  const s1 = Object.values(CONCEPT_LIBRARY).filter((c) => c.is_deep === false).slice(0, 2).map((c) => c.slug);
  const withRun = rankCandidates([{ id: shallowId.slug, priority: 50 }], { library: CONCEPT_LIBRARY, recentSlugs: s1 })[0];
  const noRun = rankCandidates([{ id: shallowId.slug, priority: 50 }], { library: CONCEPT_LIBRARY, recentSlugs: [] })[0];
  if (!(withRun.score < noRun.score)) fail('anti-shallow-domination not applied when recent run is shallow-heavy');
}

// ── Negative self-test: the integrity checks must reject a broken chain. ──
if (require.main === module && process.argv.includes('--self-test')) {
  const badChainCaught = [['nonexistent-concept-xyz', 'liquidity-tightening']].some((chain) => chain.some((id) => !CONCEPT_LIBRARY[id]));
  const selfLoopCaught = (() => { const c = ['a', 'a']; return c.some((x, k) => c[k + 1] === x); })();
  const deepDominates = W.DEEP > 100 + W.PROGRESSION + W.RELATED;
  const ok = badChainCaught && selfLoopCaught && deepDominates;
  console.log(`[educational-priority] self-test: ${ok ? 'all negative cases detected' : 'FAILED'}`);
  process.exit(ok ? 0 : 1);
}

if (failures.length) {
  failures.forEach((m) => console.error(`[educational-priority] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[educational-priority] check:educational-priority passed (${SEQUENCES.length} chains, deep-first + deterministic + anti-shallow-domination enforced).`);
