'use strict';

// Phase 121 — check:concept-depth. Quality gate for DEEP educational concepts
// (those carrying a full `depth` object, surfaced as concept.is_deep). It does
// NOT require every concept to be deep — un-enriched concepts remain on the
// factory path covered by check:educational-concept-library. For concepts that
// DO declare depth, it HARD-FAILS on: a missing/short depth section, missing
// EN/AR parity or non-native Arabic, placeholder text, advice/retail language,
// or cross-concept boilerplate (two deep concepts sharing an identical
// paragraph — the generic-filler failure mode). Negative-tested via --self-test.

const fs = require('fs');
const path = require('path');
const { CONCEPT_LIBRARY, DEPTH_HEADINGS } = require('./educational-concept-library');

const ARABIC = /[؀-ۿ]/;
const PLACEHOLDER = /\b(?:todo|tbd|placeholder|lorem ipsum|coming soon|sample text|insert (?:copy|text)|draft only)\b/i;
const ADVICE = [/\bbuy now\b/i, /\bsell now\b/i, /\bprice target\b/i, /\btarget price\b/i, /\bbreakout trade\b/i, /\bRSI\b/, /\bMACD\b/, /\bguaranteed\b/i, /\bbullish signal\b/i, /\bbearish signal\b/i, /\bstop loss\b/i, /\btake profit\b/i];
const EN_MIN = 120;  // a deep paragraph is a full multi-sentence block, not a line
const AR_MIN = 90;

function txt(v) { return String(v == null ? '' : v).trim(); }

// Validate one built concept object; returns an array of failure strings.
function validateConcept(concept, headings) {
  const f = [];
  const label = concept.slug || concept.id || '?';
  const sectionsEn = concept.sections_en || [];
  const sectionsAr = concept.sections_ar || [];
  if (sectionsEn.length !== headings.length || sectionsAr.length !== headings.length) {
    f.push(`${label}: deep concept must have ${headings.length} sections (en=${sectionsEn.length}, ar=${sectionsAr.length})`);
    return f;
  }
  const seenEn = [];
  headings.forEach(([key], i) => {
    const en = sectionsEn[i] || {}; const ar = sectionsAr[i] || {};
    const enP = Array.isArray(en.paragraphs) ? en.paragraphs : [];
    const arP = Array.isArray(ar.paragraphs) ? ar.paragraphs : [];
    const sl = `${label}:${key}`;
    if (enP.length < 2) f.push(`${sl}: needs ≥2 EN paragraphs`);
    if (arP.length < 2) f.push(`${sl}: needs ≥2 AR paragraphs`);
    enP.forEach((p) => { if (txt(p).length < EN_MIN) f.push(`${sl}: EN paragraph too thin (${txt(p).length}<${EN_MIN})`); seenEn.push(txt(p)); });
    arP.forEach((p) => { if (txt(p).length < AR_MIN) f.push(`${sl}: AR paragraph too thin (${txt(p).length}<${AR_MIN})`); if (!ARABIC.test(txt(p))) f.push(`${sl}: AR paragraph not native Arabic`); });
  });
  const all = [...sectionsEn, ...sectionsAr].flatMap((s) => s.paragraphs || []).join(' ');
  if (PLACEHOLDER.test(all)) f.push(`${label}: placeholder content in depth`);
  for (const re of ADVICE) if (re.test(all)) f.push(`${label}: advice/retail language in depth ${re}`);
  return f;
}

if (require.main === module && process.argv.includes('--self-test')) {
  const heads = DEPTH_HEADINGS;
  const good = CONCEPT_LIBRARY['liquidity-tightening'];
  const mk = (mut) => { const c = JSON.parse(JSON.stringify(good)); mut(c); return c; };
  const cases = [
    ['placeholder', (c) => { c.sections_en[0].paragraphs[0] = 'TODO: write this section with real institutional content later on.'; }],
    ['thin EN', (c) => { c.sections_en[1].paragraphs[0] = 'Too short.'; }],
    ['missing section', (c) => { c.sections_en.pop(); }],
    ['non-native AR', (c) => { c.sections_ar[2].paragraphs[0] = 'This is English text where native Arabic prose is required for parity.'; }],
    ['advice', (c) => { c.sections_en[3].paragraphs[1] += ' This is a bullish signal to buy now.'; }],
  ];
  let ok = 0;
  for (const [name, mut] of cases) { if (validateConcept(mk(mut), heads).length) ok += 1; else console.error(`SELF-TEST FAIL: "${name}" not rejected`); }
  if (validateConcept(good, heads).length === 0) ok += 1; else console.error('SELF-TEST FAIL: clean deep concept rejected');
  console.log(`[concept-depth] self-test: ${ok}/${cases.length + 1} passed`);
  process.exit(ok === cases.length + 1 ? 0 : 1);
}

const failures = [];
const deep = Object.values(CONCEPT_LIBRARY).filter((c) => c.is_deep);
// Cross-concept boilerplate: no two deep concepts share an identical paragraph.
const paraOwner = new Map();
for (const c of deep) {
  validateConcept(c, DEPTH_HEADINGS).forEach((m) => failures.push(m));
  for (const s of (c.sections_en || [])) for (const p of (s.paragraphs || [])) {
    const k = txt(p);
    if (paraOwner.has(k) && paraOwner.get(k) !== c.slug) failures.push(`${c.slug}: shares an identical depth paragraph with ${paraOwner.get(k)} (generic boilerplate)`);
    else paraOwner.set(k, c.slug);
  }
}

if (failures.length) {
  failures.forEach((m) => console.error(`[concept-depth] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[concept-depth] check:concept-depth passed (${deep.length} deep concept(s); concept-specific, bilingual-native, no placeholders, no boilerplate).`);
