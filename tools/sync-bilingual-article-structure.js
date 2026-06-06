'use strict';

// Phase 62.2 — Bilingual Article Structure Synchronizer
// Removes orphan sections from the over-count side of a draft/published pair,
// or adds minimal placeholders to the under-count side.
//
// Usage:
//   node tools/sync-bilingual-article-structure.js --slug=<slug>
//     [--remove-orphans]   remove extra sections instead of adding placeholders
//     [--write]            write changes to disk (dry run by default)
//     [--verbose]          print section IDs before/after

const fs   = require('fs');
const path = require('path');

const ROOT       = path.resolve(__dirname, '..');
const DRAFTS_DIR = path.join(ROOT, 'drafts', 'editorial');
const EN_PUB     = path.join(ROOT, 'insights');
const AR_PUB     = path.join(ROOT, 'ar', 'insights');
const EN_LOC     = path.join(ROOT, 'en', 'insights');

const SLUG           = argValue('--slug')  || null;
const WRITE          = process.argv.includes('--write');
const REMOVE_ORPHANS = process.argv.includes('--remove-orphans');
const VERBOSE        = process.argv.includes('--verbose');

const FIXED_SECTION_IDS = new Set(['related-research', 'continue-learning', 'faq']);

function main() {
  if (!SLUG) {
    console.error('[sync] --slug=<slug> is required');
    process.exit(1);
  }

  const enDraft = path.join(DRAFTS_DIR, SLUG, 'en.html');
  const arDraft = path.join(DRAFTS_DIR, SLUG, 'ar.html');
  if (!fs.existsSync(enDraft) || !fs.existsSync(arDraft)) {
    console.error(`[sync] Draft pair not found for: ${SLUG}`);
    process.exit(1);
  }

  let enDraftHtml = fs.readFileSync(enDraft, 'utf8');
  let arDraftHtml = fs.readFileSync(arDraft, 'utf8');

  const draftResult = syncPair(enDraftHtml, arDraftHtml, 'draft');
  enDraftHtml = draftResult.en;
  arDraftHtml = draftResult.ar;

  if (WRITE && draftResult.changed) {
    fs.writeFileSync(enDraft, enDraftHtml, 'utf8');
    fs.writeFileSync(arDraft, arDraftHtml, 'utf8');
    console.log(`[sync] Wrote draft pair: ${SLUG}`);
  }

  // Also sync published files if they exist
  const enPubFile  = path.join(EN_PUB, `${SLUG}.html`);
  const arPubFile  = path.join(AR_PUB, `${SLUG}.html`);
  const enLocFile  = path.join(EN_LOC, `${SLUG}.html`);

  for (const [enFile, arFile, label] of [
    [enPubFile, arPubFile, 'insights'],
    [enLocFile, arPubFile, 'en/insights']
  ]) {
    if (!fs.existsSync(enFile) || !fs.existsSync(arFile)) continue;
    const enHtml = fs.readFileSync(enFile, 'utf8');
    const arHtml = fs.readFileSync(arFile, 'utf8');
    const pubResult = syncPair(enHtml, arHtml, label);
    if (WRITE && pubResult.changed) {
      fs.writeFileSync(enFile, pubResult.en, 'utf8');
      if (label === 'insights') fs.writeFileSync(arFile, pubResult.ar, 'utf8');
      console.log(`[sync] Wrote published ${label}/${SLUG}.html`);
    }
  }

  if (!WRITE) console.log('[sync] DRY RUN — pass --write to apply changes');
}

function syncPair(enHtml, arHtml, label) {
  const enBefore = countSections(enHtml);
  const arBefore = countSections(arHtml);

  if (VERBOSE) {
    console.log(`[sync] ${label} before: EN=${enBefore} AR=${arBefore}`);
    listSectionIds(enHtml, 'EN');
    listSectionIds(arHtml, 'AR');
  } else {
    console.log(`[sync] ${label}: EN=${enBefore} AR=${arBefore}`);
  }

  if (enBefore === arBefore) {
    console.log(`[sync] ${label}: counts match — no sync needed`);
    return { en: enHtml, ar: arHtml, changed: false };
  }

  let changed = false;

  if (enBefore > arBefore) {
    const orphanIds = getOrphanEnIds(enHtml, arHtml);
    console.log(`[sync] ${label}: EN has ${enBefore - arBefore} extra section(s): [${orphanIds.join(', ') || '(no-id)'}]`);

    if (REMOVE_ORPHANS && orphanIds.length) {
      for (const id of orphanIds) {
        const before = countSections(enHtml);
        enHtml = removeSectionById(enHtml, id);
        const after = countSections(enHtml);
        if (before !== after) {
          console.log(`[sync] ${label}: removed section id="${id}" from EN (${before}→${after})`);
          changed = true;
        } else {
          console.warn(`[sync] ${label}: could not remove section id="${id}" — not found or nested`);
        }
      }
    } else if (!REMOVE_ORPHANS) {
      for (const id of orphanIds) {
        const placeholder = buildArPlaceholder(id, enHtml);
        arHtml = injectBeforeFixedSections(arHtml, placeholder);
        console.log(`[sync] ${label}: added AR placeholder for en section id="${id}"`);
        changed = true;
      }
    }
  } else {
    const orphanIds = getOrphanArIds(enHtml, arHtml);
    console.log(`[sync] ${label}: AR has ${arBefore - enBefore} extra section(s): [${orphanIds.join(', ') || '(no-id)'}]`);

    if (REMOVE_ORPHANS && orphanIds.length) {
      for (const id of orphanIds) {
        const before = countSections(arHtml);
        arHtml = removeSectionById(arHtml, id);
        const after = countSections(arHtml);
        if (before !== after) {
          console.log(`[sync] ${label}: removed section id="${id}" from AR (${before}→${after})`);
          changed = true;
        }
      }
    } else if (!REMOVE_ORPHANS) {
      for (const id of orphanIds) {
        const placeholder = buildEnPlaceholder(id);
        enHtml = injectBeforeFixedSections(enHtml, placeholder);
        console.log(`[sync] ${label}: added EN placeholder for ar section id="${id}"`);
        changed = true;
      }
    }
  }

  const enAfter = countSections(enHtml);
  const arAfter = countSections(arHtml);
  console.log(`[sync] ${label}: after sync EN=${enAfter} AR=${arAfter}${enAfter === arAfter ? ' ✓' : ' ✗ still mismatched'}`);

  return { en: enHtml, ar: arHtml, changed };
}

// Depth-aware section removal — handles sections with nested <section> tags
function removeSectionById(html, sectionId) {
  const startMarker = `id="${sectionId}"`;
  const startTagRe = new RegExp(`<section[^>]+id="${escapeRegex(sectionId)}"[^>]*>`, 'i');
  const tagMatch = startTagRe.exec(html);
  if (!tagMatch) return html;

  const tagStart = tagMatch.index;
  let depth = 0;
  let i = tagStart;

  while (i < html.length) {
    if (html.startsWith('<section', i)) {
      depth++;
      i += 8;
    } else if (html.startsWith('</section>', i)) {
      depth--;
      if (depth === 0) {
        const end = i + '</section>'.length;
        // Remove trailing whitespace/newline after the closing tag
        const post = html.slice(end).match(/^[\r\n]+/);
        const removeEnd = end + (post ? post[0].length : 0);
        return html.slice(0, tagStart) + html.slice(removeEnd);
      }
      i += 10;
    } else {
      i++;
    }
  }

  return html;
}

function countSections(html) {
  return (html.match(/<section\b/g) || []).length;
}

// EN/AR articles use different-language IDs for the same positional sections
// (e.g. "research-context" in EN ↔ "سياق-البحث" in AR).
// Orphans are identified by COUNT difference, not by ID string matching.
// Extra sections are assumed to be the LAST content sections (repair engine
// injects before fixed sections, never at the beginning).
function getOrphanEnIds(enHtml, arHtml) {
  const enIds = getContentSectionIds(enHtml);
  const arCount = getContentSectionIds(arHtml).length;
  const orphanCount = enIds.length - arCount;
  return orphanCount > 0 ? enIds.slice(-orphanCount) : [];
}

function getOrphanArIds(enHtml, arHtml) {
  const arIds = getContentSectionIds(arHtml);
  const enCount = getContentSectionIds(enHtml).length;
  const orphanCount = arIds.length - enCount;
  return orphanCount > 0 ? arIds.slice(-orphanCount) : [];
}

function getContentSectionIds(html) {
  return [...html.matchAll(/<section[^>]+\bid="([^"]+)"/gi)]
    .map(m => m[1])
    .filter(id => !FIXED_SECTION_IDS.has(id));
}

function buildArPlaceholder(enId, enHtml) {
  const sectionRe = new RegExp(`<section[^>]+id="${escapeRegex(enId)}"[^>]*>[\\s\\S]*?(?=<section\\b|$)`, 'i');
  const sectionMatch = sectionRe.exec(enHtml);
  const h2Match = sectionMatch ? sectionMatch[0].match(/<h2[^>]*>([\s\S]*?)<\/h2>/i) : null;
  const enHeading = h2Match ? h2Match[1].replace(/<[^>]+>/g, '').trim() : enId;

  return `\n      <section id="${enId}" data-sync="placeholder">
        <h2>${enHeading}</h2>
        <p class="market-copy" lang="ar" dir="rtl">يعكس هذا القسم المحتوى المؤسسي المقابل من النسخة الإنجليزية. تتم مزامنة البنية الهيكلية للحفاظ على تكافؤ المحتوى ثنائي اللغة.</p>
      </section>`;
}

function buildEnPlaceholder(arId) {
  return `\n      <section id="${arId}" data-sync="placeholder">
        <h2>Institutional Analysis</h2>
        <p class="market-copy">This section mirrors institutional content from the Arabic version. Structure synchronized to maintain bilingual content parity.</p>
      </section>`;
}

function injectBeforeFixedSections(html, sectionHtml) {
  const relatedMatch = html.match(/<section[^>]+id="related-research"/i);
  if (relatedMatch) {
    const idx = relatedMatch.index;
    return html.slice(0, idx) + sectionHtml + '\n      ' + html.slice(idx);
  }
  return html.replace(/<\/main>/i, `${sectionHtml}\n    </main>`);
}

function listSectionIds(html, lang) {
  const matches = [...html.matchAll(/<section\b([^>]*)>/gi)];
  const ids = matches.map(m => {
    const id = m[1].match(/\bid="([^"]+)"/);
    return id ? id[1] : '(no-id)';
  });
  console.log(`  ${lang}: [${ids.join(', ')}]`);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function argValue(name) {
  const m = process.argv.find(a => a.startsWith(`${name}=`));
  return m ? m.slice(name.length + 1) : '';
}

main();
