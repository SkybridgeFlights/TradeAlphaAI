'use strict';

// Phase 62.2 — Bilingual Structural Integrity Check
// Validates that EN and AR article pairs have equal section counts and
// structural parity. Checks draft pairs and published pairs.
//
// Usage:
//   node tools/check-bilingual-structure.js               → check all slugs
//   node tools/check-bilingual-structure.js --slug=<slug> → check one slug
//   node tools/check-bilingual-structure.js --drafts-only → skip published
//   node tools/check-bilingual-structure.js --verbose     → show all section IDs

const fs   = require('fs');
const path = require('path');

const ROOT          = path.resolve(__dirname, '..');
const DRAFTS_DIR    = path.join(ROOT, 'drafts', 'editorial');
const EN_INSIGHTS   = path.join(ROOT, 'insights');
const AR_INSIGHTS   = path.join(ROOT, 'ar', 'insights');
const EN_LOC        = path.join(ROOT, 'en', 'insights');
const EN_ARTICLES   = path.join(ROOT, 'articles');
const AR_ARTICLES   = path.join(ROOT, 'ar', 'articles');

const SLUG         = argValue('--slug')   || null;
const DRAFTS_ONLY  = process.argv.includes('--drafts-only');
const VERBOSE      = process.argv.includes('--verbose');

const FIXED_SECTION_IDS = new Set(['related-research', 'continue-learning', 'faq']);

function main() {
  const educationalSlugs = fs.existsSync(EN_ARTICLES)
    ? fs.readdirSync(EN_ARTICLES)
      .filter((file) => file.endsWith('.html') && file !== 'index.html' && fs.readFileSync(path.join(EN_ARTICLES, file), 'utf8').includes('data-educational-article='))
      .map((file) => file.replace(/\.html$/, ''))
    : [];
  const slugs = SLUG ? [SLUG] : [...new Set([...getDraftSlugs(), ...educationalSlugs])];
  const results  = [];
  const failures = [];
  let totalChecked = 0;

  for (const slug of slugs) {
    const enDraft = path.join(DRAFTS_DIR, slug, 'en.html');
    const arDraft = path.join(DRAFTS_DIR, slug, 'ar.html');
    if (fs.existsSync(enDraft) && fs.existsSync(arDraft)) {
      totalChecked++;
      const result = checkPair(slug, 'draft', enDraft, arDraft);
      results.push(result);
      if (!result.passed) failures.push(result);
      else if (VERBOSE) console.log(`[bilingual-check] PASS  draft/${slug}`);
    }

    if (!DRAFTS_ONLY) {
      const enPub = path.join(EN_INSIGHTS, `${slug}.html`);
      const arPub = path.join(AR_INSIGHTS, `${slug}.html`);
      if (fs.existsSync(enPub) && fs.existsSync(arPub)) {
        totalChecked++;
        const result = checkPair(slug, 'published', enPub, arPub);
        results.push(result);
        if (!result.passed) failures.push(result);
        else if (VERBOSE) console.log(`[bilingual-check] PASS  insights/${slug}`);
      }

      const enLoc = path.join(EN_LOC, `${slug}.html`);
      const arLoc = path.join(AR_INSIGHTS, `${slug}.html`);
      if (fs.existsSync(enLoc) && fs.existsSync(arLoc)) {
        totalChecked++;
        const result = checkPair(slug, 'en-localized', enLoc, arLoc);
        results.push(result);
        if (!result.passed) failures.push(result);
        else if (VERBOSE) console.log(`[bilingual-check] PASS  en/insights/${slug}`);
      }

      const enArticle = path.join(EN_ARTICLES, `${slug}.html`);
      const arArticle = path.join(AR_ARTICLES, `${slug}.html`);
      if (fs.existsSync(enArticle) && fs.existsSync(arArticle)) {
        totalChecked++;
        const result = checkPair(slug, 'educational', enArticle, arArticle);
        results.push(result);
        if (!result.passed) failures.push(result);
        else if (VERBOSE) console.log(`[bilingual-check] PASS  articles/${slug}`);
      }
    }
  }

  const allWarnings = results
    .flatMap(r => r.issues.filter(i => i.warn_only).map(i => `${r.slug} (${r.type}): ${i.type}: ${i.detail}`));
  if (allWarnings.length) {
    console.warn(`[bilingual-check] WARNINGS (${allWarnings.length}) — non-blocking:`);
    allWarnings.forEach(w => console.warn(`  [warn] ${w}`));
  }

  if (failures.length === 0) {
    console.log(`[bilingual-check] All ${totalChecked} pair check(s) passed. Slugs: ${slugs.length}.`);
    process.exit(0);
  }


  console.error(`[bilingual-check] FAILED — ${failures.length} structural parity violation(s):\n`);
  for (const r of failures) {
    const label = `${r.slug} (${r.type})`;
    console.error(`  ${label}`);
    for (const issue of r.issues.filter(i => !i.warn_only)) {
      console.error(`    - ${issue.type}: ${issue.detail}`);
      if (issue.missing_in_ar && issue.missing_in_ar.length)
        console.error(`      missing_in_ar: ${issue.missing_in_ar.join(', ')}`);
      if (issue.missing_in_en && issue.missing_in_en.length)
        console.error(`      missing_in_en: ${issue.missing_in_en.join(', ')}`);
    }
    console.error('');
  }
  process.exit(1);
}

function checkPair(slug, type, enFile, arFile) {
  const enHtml = fs.readFileSync(enFile, 'utf8');
  const arHtml = fs.readFileSync(arFile, 'utf8');
  const issues = [];

  const enCount = countSections(enHtml);
  const arCount = countSections(arHtml);
  if (enCount !== arCount) {
    const missingInAr = getOrphanIds(enHtml, arHtml);
    const missingInEn = getOrphanIds(arHtml, enHtml);
    issues.push({
      type: 'section_count_mismatch',
      detail: `en=${enCount} ar=${arCount}`,
      missing_in_ar: missingInAr,
      missing_in_en: missingInEn
    });
  }

  const enFaq   = count(enHtml, /<details\b/g);
  const arFaq   = count(arHtml, /<details\b/g);
  if (enFaq !== arFaq)
    issues.push({ type: 'faq_count_mismatch', detail: `en=${enFaq} ar=${arFaq}` });

  const enTable = count(enHtml, /class="editorial-comparison-table"/g);
  const arTable = count(arHtml, /class="editorial-comparison-table"/g);
  if (enTable !== arTable)
    issues.push({ type: 'comparison_table_mismatch', detail: `en=${enTable} ar=${arTable}`, warn_only: true });

  for (const fixedId of FIXED_SECTION_IDS) {
    const inEn = enHtml.includes(`id="${fixedId}"`);
    const inAr = arHtml.includes(`id="${fixedId}"`);
    if (inEn !== inAr)
      issues.push({
        type: 'fixed_section_missing',
        detail: `"${fixedId}" present in ${inEn ? 'EN' : 'AR'} only`
      });
  }

  const hardIssues = issues.filter(i => !i.warn_only);
  return { slug, type, passed: hardIssues.length === 0, issues };
}

function countSections(html) {
  return (html.match(/<section\b/g) || []).length;
}

function count(html, pattern) {
  return (html.match(pattern) || []).length;
}

// EN/AR use different-language IDs for positionally-equivalent sections.
// Orphans are extra sections from ONE side identified by count diff; extras
// are assumed to be the LAST content sections (repair engine injects at end).
function getOrphanIds(html1, html2) {
  const ids1 = [...html1.matchAll(/<section[^>]+\bid="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(id => !FIXED_SECTION_IDS.has(id));
  const count2 = [...html2.matchAll(/<section[^>]+\bid="([^"]+)"/gi)]
    .filter(m => !FIXED_SECTION_IDS.has(m[1])).length;
  const orphanCount = ids1.length - count2;
  return orphanCount > 0 ? ids1.slice(-orphanCount) : [];
}

function getDraftSlugs() {
  if (!fs.existsSync(DRAFTS_DIR)) return [];
  return fs.readdirSync(DRAFTS_DIR).filter(d =>
    fs.statSync(path.join(DRAFTS_DIR, d)).isDirectory()
  );
}

function argValue(name) {
  const m = process.argv.find(a => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

main();
