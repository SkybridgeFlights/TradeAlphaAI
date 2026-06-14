'use strict';

// Phase 119 - strict integrity gate for the autonomous educational concept
// library. This validator owns no product data: it verifies the exact library
// exported by the publisher against the topic-selection taxonomy.

const { CONCEPT_LIBRARY } = require('./generate-educational-article');
const { CONCEPT_FAMILIES } = require('./build-educational-topics');

const MIN_CONCEPTS = 20;
const MIN_SECTIONS = 6;
const ARABIC = /[\u0600-\u06ff]/;
const PLACEHOLDER = /\b(?:todo|tbd|placeholder|lorem ipsum|coming soon|sample text|insert (?:copy|text)|draft only)\b/i;
const NULL_LEAK = /\b(?:null|undefined|nan)\b/i;
const LISTICLE = /\b(?:top\s+\d+|\d+\s+(?:best|ways|tips|reasons|stocks?|trades?)|ultimate guide|complete guide)\b/i;
const ADVICE = /\b(?:buy now|sell now|you should (?:buy|sell)|we recommend (?:buying|selling)|price target|entry point|exit point|guaranteed returns?|will (?:rally|crash|soar|plunge))\b/i;

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function deepStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => deepStrings(item, out));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => deepStrings(item, out));
  return out;
}

function normalizedTokens(value) {
  return new Set(String(value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3));
}

function jaccard(a, b) {
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union ? intersection / union : 0;
}

function sectionParts(section) {
  if (Array.isArray(section)) {
    return {
      id: section[0],
      title_en: section[1],
      title_ar: section[2],
      body_en: section[3],
      body_ar: section[4],
    };
  }
  return {
    id: section && (section.id || section.slug),
    title_en: section && (section.title_en || section.heading_en || section.head_en),
    title_ar: section && (section.title_ar || section.heading_ar || section.head_ar),
    body_en: section && (section.body_en || section.paragraphs_en || section.content_en),
    body_ar: section && (section.body_ar || section.paragraphs_ar || section.content_ar),
  };
}

function bilingualExamples(concept) {
  const examples = concept.institutional_examples || concept.examples;
  if (Array.isArray(examples)) {
    const en = examples.flatMap((item) => typeof item === 'string' ? [item] : [item && (item.en || item.example_en)]).filter(Boolean);
    const ar = examples.flatMap((item) => typeof item === 'string' ? [] : [item && (item.ar || item.example_ar)]).filter(Boolean);
    return { en, ar };
  }
  return {
    en: examples && (examples.en || examples.examples_en),
    ar: examples && (examples.ar || examples.examples_ar),
  };
}

function visualPurpose(visual) {
  if (typeof visual === 'string') return { en: visual, ar: '' };
  return {
    en: visual && (visual.purpose_en || visual.title_en || visual.description_en),
    ar: visual && (visual.purpose_ar || visual.title_ar || visual.description_ar),
  };
}

function validateLibrary(library, families) {
  const failures = [];
  const entries = Object.entries(library || {});
  const familyIds = (families || []).map((family) => family.id);
  const familySet = new Set(familyIds);

  if (entries.length < MIN_CONCEPTS) failures.push(`concept library has ${entries.length} usable candidates; minimum is ${MIN_CONCEPTS}`);
  if (familyIds.length !== new Set(familyIds).size) failures.push('topic taxonomy contains duplicate concept slugs');

  const seenSlugs = new Set();
  const fingerprints = [];
  for (const [key, concept] of entries) {
    const slug = text(concept && concept.slug) || key;
    const label = slug || key || '<unknown>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) failures.push(`${label}: invalid or missing slug`);
    if (seenSlugs.has(slug)) failures.push(`${label}: duplicate concept slug`);
    seenSlugs.add(slug);
    if (key !== slug) failures.push(`${label}: object key and slug differ`);
    if (!familySet.has(slug)) failures.push(`${label}: publisher library entry is absent from topic taxonomy`);

    if (!text(concept.category)) failures.push(`${label}: category missing`);
    if (!text(concept.title_en)) failures.push(`${label}: English title missing`);
    if (!text(concept.title_ar) || !ARABIC.test(text(concept.title_ar))) failures.push(`${label}: native Arabic title missing`);
    if (!text(concept.thesis_en) || text(concept.thesis_en).length < 80) failures.push(`${label}: English thesis is missing or shallow`);
    if (!text(concept.thesis_ar) || text(concept.thesis_ar).length < 60 || !ARABIC.test(text(concept.thesis_ar))) failures.push(`${label}: Arabic thesis is missing or shallow`);

    const sections = Array.isArray(concept.sections) ? concept.sections : [];
    if (sections.length < MIN_SECTIONS) failures.push(`${label}: ${sections.length} sections; minimum is ${MIN_SECTIONS}`);
    const sectionIds = new Set();
    sections.forEach((raw, index) => {
      const section = sectionParts(raw);
      const sectionLabel = `${label}:section-${index + 1}`;
      if (!text(section.id)) failures.push(`${sectionLabel}: id missing`);
      else if (sectionIds.has(section.id)) failures.push(`${sectionLabel}: duplicate section id ${section.id}`);
      else sectionIds.add(section.id);
      if (!text(section.title_en)) failures.push(`${sectionLabel}: English heading missing`);
      if (!text(section.title_ar) || !ARABIC.test(text(section.title_ar))) failures.push(`${sectionLabel}: Arabic heading missing`);
      const enBody = Array.isArray(section.body_en) ? section.body_en : [section.body_en].filter(Boolean);
      const arBody = Array.isArray(section.body_ar) ? section.body_ar : [section.body_ar].filter(Boolean);
      if (enBody.length < 2 || enBody.some((paragraph) => text(paragraph).length < 60)) failures.push(`${sectionLabel}: English explanation must contain two substantive paragraphs`);
      if (arBody.length < 2 || arBody.some((paragraph) => text(paragraph).length < 45 || !ARABIC.test(text(paragraph)))) failures.push(`${sectionLabel}: Arabic explanation must contain two substantive native paragraphs`);
    });

    const examples = bilingualExamples(concept);
    const enExamples = Array.isArray(examples.en) ? examples.en : [examples.en].filter(Boolean);
    const arExamples = Array.isArray(examples.ar) ? examples.ar : [examples.ar].filter(Boolean);
    if (!enExamples.length || enExamples.some((item) => text(item).length < 30)) failures.push(`${label}: substantive institutional English examples missing`);
    if (!arExamples.length || arExamples.some((item) => text(item).length < 25 || !ARABIC.test(text(item)))) failures.push(`${label}: substantive institutional Arabic examples missing`);

    const links = concept.internal_links;
    if (!Array.isArray(links) || !links.length) failures.push(`${label}: internal links missing`);
    else if (links.some((link) => {
      const href = typeof link === 'string' ? link : link && (link.href || link.url);
      return !text(href).startsWith('/');
    })) failures.push(`${label}: internal links must be repository-relative public paths`);

    const related = concept.related_concepts;
    if (!Array.isArray(related) || related.length < 2) failures.push(`${label}: at least two related concepts are required`);
    else {
      if (new Set(related).size !== related.length) failures.push(`${label}: duplicate related concepts`);
      if (related.includes(slug)) failures.push(`${label}: concept cannot relate to itself`);
    }

    const purpose = visualPurpose(concept.visual_intent);
    if (!concept.visual_intent || !text(purpose.en) || !text(purpose.ar) || !ARABIC.test(text(purpose.ar))) failures.push(`${label}: bilingual visual intent/purpose missing`);

    if (!Array.isArray(concept.forbidden_framing) || !concept.forbidden_framing.length) failures.push(`${label}: forbidden framing policy missing`);

    const all = deepStrings(concept).join(' ');
    if (PLACEHOLDER.test(all)) failures.push(`${label}: placeholder content detected`);
    if (NULL_LEAK.test(all)) failures.push(`${label}: null/undefined leak detected`);
    if (LISTICLE.test(all)) failures.push(`${label}: listicle/SEO framing detected`);
    if (ADVICE.test(all)) failures.push(`${label}: advice or directional claim detected`);

    const fingerprintText = [
      concept.title_en,
      concept.thesis_en,
      ...deepStrings(examples.en),
      ...deepStrings(concept.fingerprints || concept.fingerprint),
    ].join(' ');
    fingerprints.push({ slug, tokens: normalizedTokens(fingerprintText) });
  }

  for (const familyId of familyIds) {
    if (!seenSlugs.has(familyId)) failures.push(`${familyId}: topic taxonomy has no publisher-library concept`);
  }

  for (const [slug, concept] of entries) {
    for (const related of (concept.related_concepts || [])) {
      if (!seenSlugs.has(related)) failures.push(`${slug}: related concept ${related} is not in the publisher library`);
    }
  }

  for (let i = 0; i < fingerprints.length; i += 1) {
    for (let j = i + 1; j < fingerprints.length; j += 1) {
      const similarity = jaccard(fingerprints[i].tokens, fingerprints[j].tokens);
      if (similarity >= 0.72) failures.push(`near-duplicate concepts: ${fingerprints[i].slug} ~ ${fingerprints[j].slug} (${similarity.toFixed(2)})`);
    }
  }

  // Prospective article bodies must also remain distinct before publication.
  // Six-word shingles catch factory prose that metadata-only checks can miss.
  const articleFingerprints = entries.map(([slug, concept]) => {
    const body = (concept.sections || []).flatMap((section) => {
      const part = sectionParts(section);
      return deepStrings(part.body_en);
    }).join(' ');
    const words = body.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    const shingles = new Set();
    for (let index = 0; index + 6 <= words.length; index += 1) shingles.add(words.slice(index, index + 6).join(' '));
    return { slug, shingles };
  });
  for (let i = 0; i < articleFingerprints.length; i += 1) {
    for (let j = i + 1; j < articleFingerprints.length; j += 1) {
      const similarity = jaccard(articleFingerprints[i].shingles, articleFingerprints[j].shingles);
      if (similarity > 0.55) failures.push(`prospective articles are near-duplicates: ${articleFingerprints[i].slug} ~ ${articleFingerprints[j].slug} (${similarity.toFixed(2)})`);
    }
  }

  return failures;
}

function validFixture(slug) {
  const section = (index) => ({
    id: `section-${index}`,
    title_en: `Institutional mechanism ${index}`,
    title_ar: `\u0627\u0644\u0622\u0644\u064a\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064a\u0629 ${index}`,
    body_en: [
      'Institutional desks separate the observable market structure from the headline move because participation and transmission determine the quality of the regime.',
      'The interpretation remains conditional and evidence-led, connecting liquidity, volatility, and cross-asset confirmation without converting the observation into a forecast.',
    ],
    body_ar: [
      '\u062a\u0641\u0635\u0644 \u0627\u0644\u0645\u0643\u0627\u062a\u0628 \u0627\u0644\u0645\u0624\u0633\u0633\u064a\u0629 \u0628\u064a\u0646 \u0628\u0646\u064a\u0629 \u0627\u0644\u0633\u0648\u0642 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629 \u0648\u0627\u0644\u062d\u0631\u0643\u0629 \u0627\u0644\u0638\u0627\u0647\u0631\u0629 \u0644\u0623\u0646 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0622\u0644\u064a\u0629 \u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644 \u062a\u062d\u062f\u062f\u0627\u0646 \u062c\u0648\u062f\u0629 \u0627\u0644\u0646\u0638\u0627\u0645.',
      '\u062a\u0628\u0642\u0649 \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u0645\u0634\u0631\u0648\u0637\u0629 \u0648\u0645\u0633\u062a\u0646\u062f\u0629 \u0625\u0644\u0649 \u0627\u0644\u0623\u062f\u0644\u0629\u060c \u0648\u062a\u0631\u0628\u0637 \u0627\u0644\u0633\u064a\u0648\u0644\u0629 \u0648\u0627\u0644\u062a\u0630\u0628\u0630\u0628 \u0648\u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0639\u0628\u0631 \u0627\u0644\u0623\u0635\u0648\u0644 \u062f\u0648\u0646 \u062a\u062d\u0648\u064a\u0644 \u0627\u0644\u0645\u0644\u0627\u062d\u0638\u0629 \u0625\u0644\u0649 \u062a\u0648\u0642\u0639.',
    ],
  });
  return {
    slug,
    category: 'market-structure',
    title_en: `Institutional structure of ${slug}`,
    title_ar: `\u0627\u0644\u0628\u0646\u064a\u0629 \u0627\u0644\u0645\u0624\u0633\u0633\u064a\u0629 \u0644\u0640 ${slug}`,
    thesis_en: 'This concept explains how institutional desks distinguish the quality of participation, transmission, and confirmation from a headline market move without treating structure as a directional signal.',
    thesis_ar: '\u064a\u0634\u0631\u062d \u0647\u0630\u0627 \u0627\u0644\u0645\u0641\u0647\u0648\u0645 \u0643\u064a\u0641 \u062a\u0645\u064a\u0651\u0632 \u0627\u0644\u0645\u0643\u0627\u062a\u0628 \u0627\u0644\u0645\u0624\u0633\u0633\u064a\u0629 \u062c\u0648\u062f\u0629 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0648\u0627\u0644\u0627\u0646\u062a\u0642\u0627\u0644 \u0648\u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0639\u0646 \u0627\u0644\u062d\u0631\u0643\u0629 \u0627\u0644\u0638\u0627\u0647\u0631\u0629 \u062f\u0648\u0646 \u0627\u0639\u062a\u0628\u0627\u0631 \u0627\u0644\u0628\u0646\u064a\u0629 \u0625\u0634\u0627\u0631\u0629 \u0627\u062a\u062c\u0627\u0647\u064a\u0629.',
    sections: Array.from({ length: 6 }, (_, index) => section(index + 1)),
    institutional_examples: [{ en: 'A desk compares participation with cross-asset confirmation before assigning structural meaning.', ar: '\u064a\u0642\u0627\u0631\u0646 \u0627\u0644\u0645\u0643\u062a\u0628 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0628\u0627\u0644\u062a\u0623\u0643\u064a\u062f \u0639\u0628\u0631 \u0627\u0644\u0623\u0635\u0648\u0644 \u0642\u0628\u0644 \u0625\u0633\u0646\u0627\u062f \u062f\u0644\u0627\u0644\u0629 \u0647\u064a\u0643\u0644\u064a\u0629.' }],
    internal_links: ['/market-structure/'],
    visual_intent: { purpose_en: 'Map the causal structure without metrics.', purpose_ar: '\u0631\u0633\u0645 \u0627\u0644\u0628\u0646\u064a\u0629 \u0627\u0644\u0633\u0628\u0628\u064a\u0629 \u062f\u0648\u0646 \u0645\u0642\u0627\u064a\u064a\u0633.' },
    forbidden_framing: ['directional calls'],
    related_concepts: [],
  };
}

function runNegativeFixture(name) {
  const library = {};
  const families = [];
  for (let i = 0; i < MIN_CONCEPTS; i += 1) {
    const slug = `fixture-concept-${i + 1}`;
    library[slug] = validFixture(slug);
    families.push({ id: slug });
  }
  for (let i = 0; i < MIN_CONCEPTS; i += 1) {
    library[`fixture-concept-${i + 1}`].related_concepts = [
      `fixture-concept-${((i + 1) % MIN_CONCEPTS) + 1}`,
      `fixture-concept-${((i + 2) % MIN_CONCEPTS) + 1}`,
    ];
  }

  if (name === 'shallow') library['fixture-concept-1'].sections = [];
  else if (name === 'placeholder') library['fixture-concept-1'].thesis_en = 'TODO placeholder';
  else if (name === 'advice') library['fixture-concept-1'].thesis_en += ' You should buy now.';
  else if (name === 'listicle') library['fixture-concept-1'].title_en = 'Top 10 market structure ideas';
  else if (name === 'null') library['fixture-concept-1'].thesis_en += ' undefined';
  else if (name === 'duplicate') library['fixture-concept-2'] = { ...library['fixture-concept-1'], slug: 'fixture-concept-2' };
  else if (name === 'parity') families.pop();
  else {
    console.error(`[educational-concept-library] unknown negative fixture: ${name}`);
    process.exit(2);
  }

  const failures = validateLibrary(library, families);
  if (!failures.length) {
    console.error(`[educational-concept-library] FAIL: negative fixture "${name}" was accepted`);
    process.exit(0);
  }
  failures.forEach((failure) => console.error(`[educational-concept-library] FAIL: ${failure}`));
  process.exit(1);
}

const negativeArg = process.argv.find((arg) => arg.startsWith('--negative-fixture='));
if (negativeArg) runNegativeFixture(negativeArg.split('=')[1]);

const failures = validateLibrary(CONCEPT_LIBRARY, CONCEPT_FAMILIES);
if (failures.length) {
  failures.forEach((failure) => console.error(`[educational-concept-library] FAIL: ${failure}`));
  process.exit(1);
}

console.log(`[educational-concept-library] passed (${Object.keys(CONCEPT_LIBRARY).length} deep bilingual concepts; publisher/taxonomy parity verified).`);

module.exports = { validateLibrary };
