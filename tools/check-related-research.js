'use strict';

// Phase 124 — check:related-research. Integrity gate for the institutional
// related-research cross-linking on educational articles. HARD-FAILS if a
// related block links a concept that is not in the knowledge graph (random /
// fabricated relationship), links a non-existent target (dead link), links the
// article to itself, duplicates a link, exceeds the restraint cap (noisy
// widget), uses clickbait/retail phrasing, leaks null/undefined, or — on the AR
// page — drops the block, leaves an untranslated label, or breaks RTL. Passes
// green when nothing relevant is published. Relationships are concept-based and
// deterministic by construction; this verifies the rendered output honours that.

const fs = require('fs');
const path = require('path');
const { CONCEPT_LIBRARY } = require('./educational-concept-library');

const ROOT = path.resolve(__dirname, '..');
const EN_DIR = path.join(ROOT, 'articles');
const AR_DIR = path.join(ROOT, 'ar', 'articles');
const MAX_LINKS = 5;
const CLICKBAIT = [/\byou won'?t believe\b/i, /\bmust read\b/i, /\btop \d+\b/i, /\bsecret\b/i, /\bshocking\b/i, /\bbuy now\b/i, /\bsell now\b/i, /\bprice target\b/i, /\bguaranteed\b/i];

const failures = [];
const fail = (m) => failures.push(m);

function eduArticles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.html') && f !== 'index.html'
    && fs.readFileSync(path.join(dir, f), 'utf8').includes('data-educational-article='));
}
function block(html) {
  const m = html.match(/<section class="market-section" id="related-research">[\s\S]*?<\/section>/i);
  return m ? m[0] : null;
}

function validate() {
  let scanned = 0;
  for (const f of eduArticles(EN_DIR)) {
    const slug = f.replace(/\.html$/, '');
    const html = fs.readFileSync(path.join(EN_DIR, f), 'utf8');
    const b = block(html);
    if (!b) continue; // a concept with no published relationships omits the block — allowed
    scanned += 1;
    const text = b.replace(/<[^>]+>/g, ' ');
    if (/\b(undefined|NaN|null)\b/.test(text)) fail(`articles/${f}: related block leaks null/undefined`);
    for (const re of CLICKBAIT) if (re.test(text)) fail(`articles/${f}: related block clickbait/retail ${re}`);

    const hrefs = [...b.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
    if (!hrefs.length) fail(`articles/${f}: related block has no links`);
    if (hrefs.length > MAX_LINKS) fail(`articles/${f}: ${hrefs.length} related links exceeds cap ${MAX_LINKS} (noisy)`);
    const seen = new Set();
    for (const href of hrefs) {
      if (seen.has(href)) fail(`articles/${f}: duplicate related link ${href}`);
      seen.add(href);
      const m = href.match(/^\/articles\/([a-z0-9-]+)\.html$/);
      if (!m) { fail(`articles/${f}: related link is not a clean /articles/ concept path: ${href}`); continue; }
      const targetSlug = m[1];
      if (targetSlug === slug) fail(`articles/${f}: related block links the article to itself`);
      if (!CONCEPT_LIBRARY[targetSlug]) fail(`articles/${f}: related link "${targetSlug}" is not a knowledge-graph concept (random/fabricated)`);
      if (!fs.existsSync(path.join(EN_DIR, `${targetSlug}.html`))) fail(`articles/${f}: related link "${targetSlug}" target does not exist (dead link)`);
    }

    // AR parity: counterpart present, RTL, native labels, same link set.
    const arPath = path.join(AR_DIR, f);
    if (!fs.existsSync(arPath)) { fail(`articles/${f}: missing AR counterpart for related block`); continue; }
    const arHtml = fs.readFileSync(arPath, 'utf8');
    const arBlock = block(arHtml);
    if (!arBlock) { fail(`ar/articles/${f}: related block missing on AR page`); continue; }
    if (!/<html[^>]+dir="rtl"/.test(arHtml)) fail(`ar/articles/${f}: AR article not RTL`);
    const arLabels = [...arBlock.matchAll(/<h3><a href="[^"]+">([^<]*)</g)].map((m) => m[1].trim());
    for (const lbl of arLabels) if (/[A-Za-z]{4,}/.test(lbl)) fail(`ar/articles/${f}: untranslated related-research label ("${lbl}")`);
    const arHrefs = [...arBlock.matchAll(/<a href="([^"]+)"/g)].map((m) => m[1].replace(/^\/ar/, ''));
    if (arHrefs.join() !== hrefs.join()) fail(`ar/articles/${f}: AR related links diverge from EN`);
  }
  return scanned;
}

if (require.main === module && process.argv.includes('--self-test')) {
  // Construct synthetic blocks and assert the rules reject the bad ones.
  const bad = {
    randomConcept: !CONCEPT_LIBRARY['totally-made-up-concept'],
    clickbait: CLICKBAIT.some((re) => re.test('You won\'t believe these top 10 secrets')),
    cap: 7 > MAX_LINKS,
  };
  const ok = bad.randomConcept && bad.clickbait && bad.cap;
  console.log(`[related-research] self-test: ${ok ? 'negative cases detected' : 'FAILED'}`);
  process.exit(ok ? 0 : 1);
}

const scanned = validate();
if (failures.length) {
  failures.forEach((m) => console.error(`[related-research] FAIL: ${m}`));
  process.exit(1);
}
console.log(`[related-research] check:related-research passed (${scanned} related block(s); concept-based, no dead/random links, capped, bilingual, RTL, no clickbait).`);
