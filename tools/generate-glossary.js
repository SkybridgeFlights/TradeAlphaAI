#!/usr/bin/env node
'use strict';

// Generates the financial glossary — one page per term (EN + AR), plus an
// index page for each locale. Every term page carries:
//   - Article + FAQPage + BreadcrumbList JSON-LD schemas (rich-snippet eligible)
//   - Full canonical/hreflang tags for the bilingual pair
//   - Internal links to related glossary terms (crawl efficiency + SEO)
//   - Newsletter subscribe widget (Substack)
//
// Output:
//   /glossary/index.html + /glossary/{slug}.html                (EN)
//   /ar/glossary/index.html + /ar/glossary/{slug}.html          (AR)
//
// Idempotent: rewrites the whole directory every run. Adding a new term is
// a one-line addition to data/glossary-terms.json.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.tradealphaai.com';
const SUBSTACK_HOST = 'tradealphaai.substack.com';

const DATA_PATH = path.join(ROOT, 'data', 'glossary-terms.json');

const CATEGORY_LABEL = {
  basics:     { en: 'Investing Basics',       ar: 'أساسيات الاستثمار' },
  valuation:  { en: 'Valuation',              ar: 'التقييم' },
  risk:       { en: 'Risk & Performance',     ar: 'المخاطر والأداء' },
  macro:      { en: 'Macro & Economics',      ar: 'الماكرو والاقتصاد' },
  portfolio:  { en: 'Portfolio Management',   ar: 'إدارة المحفظة' },
  instruments:{ en: 'Instruments',            ar: 'الأدوات' },
  technical:  { en: 'Technical Analysis',     ar: 'التحليل الفني' },
  fixed:      { en: 'Fixed Income',           ar: 'الدخل الثابت' },
  options:    { en: 'Options',                ar: 'الخيارات' },
  corporate:  { en: 'Corporate Finance',      ar: 'تمويل الشركات' }
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readTerms() {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  return data.terms || [];
}

function relatedLinks(term, allTerms, isAr) {
  const bySlug = new Map(allTerms.map((t) => [t.slug, t]));
  const found = (term.related || [])
    .map((slug) => bySlug.get(slug))
    .filter(Boolean);
  if (!found.length) return '';
  const label = isAr ? 'مصطلحات ذات صلة' : 'Related terms';
  const items = found.map((t) => {
    const name = esc(isAr ? t.term_ar : t.term);
    const href = isAr ? `/ar/glossary/${t.slug}.html` : `/glossary/${t.slug}.html`;
    return `<li><a href="${href}">${name}</a></li>`;
  }).join('');
  return `<aside class="related-terms" aria-label="${label}"><h2>${label}</h2><ul>${items}</ul></aside>`;
}

function faqSchema(term, isAr) {
  const faqs = isAr ? (term.faqs_ar || []) : (term.faqs || []);
  if (!faqs.length) return null;
  return {
    '@type': 'FAQPage',
    'mainEntity': faqs.map((f) => ({
      '@type': 'Question',
      'name': f.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': f.a }
    }))
  };
}

function articleSchema(term, isAr) {
  const name = isAr ? term.term_ar : term.term;
  const desc = isAr ? term.short_def_ar : term.short_def;
  return {
    '@type': 'DefinedTerm',
    'name': name,
    'description': desc,
    'inDefinedTermSet': `${SITE}/${isAr ? 'ar/' : ''}glossary/`,
    'termCode': term.slug,
    'url': `${SITE}/${isAr ? 'ar/' : ''}glossary/${term.slug}.html`
  };
}

function breadcrumbSchema(term, isAr) {
  const glossaryLabel = isAr ? 'المصطلحات' : 'Glossary';
  const name = isAr ? term.term_ar : term.term;
  return {
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: glossaryLabel, item: `${SITE}/${isAr ? 'ar/' : ''}glossary/` },
      { '@type': 'ListItem', position: 3, name, item: `${SITE}/${isAr ? 'ar/' : ''}glossary/${term.slug}.html` }
    ]
  };
}

function renderTermPage(term, allTerms, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const name = isAr ? term.term_ar : term.term;
  const shortDef = isAr ? term.short_def_ar : term.short_def;
  const longDef = isAr ? term.long_def_ar : term.long_def;
  const example = isAr ? term.example_ar : term.example;
  const faqs = isAr ? (term.faqs_ar || []) : (term.faqs || []);

  const title = `${name}${isAr ? ' — ' : ' — Definition, Formula, and Example | '}${isAr ? 'التعريف والمعادلة والمثال · TradeAlphaAI' : 'TradeAlphaAI'}`;
  const canonical = `${SITE}/${isAr ? 'ar/' : ''}glossary/${term.slug}.html`;
  const altEn = `${SITE}/glossary/${term.slug}.html`;
  const altAr = `${SITE}/ar/glossary/${term.slug}.html`;

  const schemas = ['@context: https://schema.org', articleSchema(term, isAr), breadcrumbSchema(term, isAr)];
  const faqSch = faqSchema(term, isAr);
  if (faqSch) schemas.push(faqSch);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [articleSchema(term, isAr), breadcrumbSchema(term, isAr), ...(faqSch ? [faqSch] : [])]
  }, null, 2);

  const formulaBlock = term.formula
    ? `<section class="formula-block">
        <h2>${isAr ? 'المعادلة' : 'Formula'}</h2>
        <pre class="formula-code">${esc(term.formula)}</pre>
        ${term.formula_notes ? `<p class="formula-notes">${esc(term.formula_notes)}</p>` : ''}
      </section>` : '';

  const faqBlock = faqs.length
    ? `<section class="faq-block">
        <h2>${isAr ? 'أسئلة شائعة' : 'Frequently asked questions'}</h2>
        ${faqs.map((f) => `<details class="faq-item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
      </section>` : '';

  const category = CATEGORY_LABEL[term.category] || { en: term.category, ar: term.category };
  const categoryLabel = isAr ? category.ar : category.en;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(shortDef)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${altEn}" />
  <link rel="alternate" hreflang="ar" href="${altAr}" />
  <link rel="alternate" hreflang="x-default" href="${altEn}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(name)} — ${isAr ? 'قاموس TradeAlphaAI' : 'TradeAlphaAI Glossary'}" />
  <meta property="og:description" content="${esc(shortDef)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="article" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta property="og:locale" content="${isAr ? 'ar_SA' : 'en_US'}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(name)}" />
  <meta name="twitter:description" content="${esc(shortDef)}" />
  <meta name="twitter:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <script type="application/ld+json">
${jsonLd}
  </script>
  <style>
    .glossary-main { max-width: 780px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    .glossary-eyebrow { color: #22d3c3; font-size: .78rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: .35rem; }
    .glossary-h1 { font-size: 2rem; letter-spacing: -.02em; margin: 0 0 .35rem; }
    .glossary-lead { font-size: 1.1rem; color: #c2d3e0; margin: 0 0 1.75rem; line-height: 1.55; }
    .glossary-section { margin: 2rem 0; }
    .glossary-section h2 { font-size: 1.25rem; margin: 0 0 .75rem; color: #22d3c3; }
    .glossary-section p { line-height: 1.7; color: #d7e5ee; }
    .formula-block { background: rgba(34, 211, 195, 0.05); border: 1px solid rgba(34, 211, 195, 0.28); border-radius: 12px; padding: 1.1rem 1.25rem; }
    .formula-code { font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 1.05rem; margin: 0 0 .5rem; color: #e6f7f3; }
    .formula-notes { margin: 0; font-size: .88rem; color: #9aa8b6; }
    .example-block { border-inline-start: 3px solid #22d3c3; padding-inline-start: 1rem; }
    .faq-item { padding: .75rem 0; border-bottom: 1px solid rgba(255,255,255,.08); }
    .faq-item summary { cursor: pointer; font-weight: 600; color: #e6f7f3; }
    .faq-item p { margin: .5rem 0 0; color: #9aa8b6; }
    .related-terms { margin-top: 2rem; padding: 1.25rem; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; }
    .related-terms h2 { margin: 0 0 .75rem; font-size: 1rem; color: #22d3c3; }
    .related-terms ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: .5rem; }
    .related-terms li a { display: inline-block; padding: .4rem .8rem; background: rgba(34,211,195,.08); border: 1px solid rgba(34,211,195,.25); border-radius: 999px; text-decoration: none; color: #22d3c3; font-size: .88rem; }
    .related-terms li a:hover { background: rgba(34,211,195,.16); }
    .cat-badge { display: inline-block; padding: .25rem .65rem; background: rgba(34,211,195,.12); color: #22d3c3; border-radius: 6px; font-size: .72rem; font-weight: 700; letter-spacing: .04em; margin-bottom: .5rem; }
  </style>
</head>
<body>
  <main class="glossary-main">
    <div class="cat-badge">${esc(categoryLabel)}</div>
    <div class="glossary-eyebrow">${isAr ? 'قاموس TradeAlphaAI' : 'TradeAlphaAI Glossary'}</div>
    <h1 class="glossary-h1">${esc(name)}</h1>
    <p class="glossary-lead">${esc(shortDef)}</p>

    <section class="glossary-section">
      <h2>${isAr ? 'التعريف' : 'Definition'}</h2>
      <p>${esc(longDef)}</p>
    </section>

    ${formulaBlock}

    <section class="glossary-section example-block">
      <h2>${isAr ? 'مثال' : 'Example'}</h2>
      <p>${esc(example)}</p>
    </section>

    ${faqBlock}

    ${relatedLinks(term, allTerms, isAr)}

    <p style="margin-top:2rem"><a href="/${isAr ? 'ar/' : ''}glossary/">${isAr ? '← عودة لكل المصطلحات' : '← Back to all terms'}</a></p>
  </main>
</body>
</html>
`;
}

function renderIndex(terms, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const title = isAr
    ? 'قاموس المصطلحات المالية — TradeAlphaAI'
    : 'Financial Glossary — TradeAlphaAI';
  const desc = isAr
    ? 'قاموس شامل للمصطلحات المالية والاستثمارية — تعريفات، معادلات، أمثلة، وأسئلة شائعة.'
    : 'A comprehensive glossary of financial and investing terminology — definitions, formulas, examples, and FAQs.';

  const groups = {};
  for (const t of terms) {
    const cat = t.category || 'basics';
    (groups[cat] = groups[cat] || []).push(t);
  }

  const canonical = `${SITE}/${isAr ? 'ar/' : ''}glossary/`;

  const sections = Object.keys(groups).sort().map((cat) => {
    const catLabel = CATEGORY_LABEL[cat] ? (isAr ? CATEGORY_LABEL[cat].ar : CATEGORY_LABEL[cat].en) : cat;
    const items = groups[cat].sort((a, b) => {
      const na = isAr ? a.term_ar : a.term;
      const nb = isAr ? b.term_ar : b.term;
      return na.localeCompare(nb);
    }).map((t) => {
      const name = esc(isAr ? t.term_ar : t.term);
      const short = esc(isAr ? t.short_def_ar : t.short_def);
      return `<article class="gloss-card"><a href="${t.slug}.html"><h3>${name}</h3><p>${short}</p></a></article>`;
    }).join('');
    return `<section class="gloss-group"><h2>${esc(catLabel)}</h2><div class="gloss-grid">${items}</div></section>`;
  }).join('');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${canonical}" />
  <link rel="alternate" hreflang="en" href="${SITE}/glossary/" />
  <link rel="alternate" hreflang="ar" href="${SITE}/ar/glossary/" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/glossary/" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="/styles.css" />
  <style>
    .gloss-main { max-width: 1080px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
    .gloss-hero { text-align: center; margin-bottom: 2.5rem; }
    .gloss-hero h1 { font-size: 2.25rem; margin: .35rem 0; letter-spacing: -.02em; }
    .gloss-hero p { color: #c2d3e0; font-size: 1.05rem; max-width: 640px; margin: 0 auto; }
    .gloss-group { margin: 2.25rem 0; }
    .gloss-group h2 { font-size: 1.15rem; color: #22d3c3; margin: 0 0 1rem; letter-spacing: .01em; }
    .gloss-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: .9rem; }
    .gloss-card a { display: block; padding: 1.1rem; background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.08); border-radius: 12px; text-decoration: none; color: inherit; transition: all .12s ease; }
    .gloss-card a:hover { border-color: rgba(34,211,195,.35); background: rgba(34,211,195,.04); transform: translateY(-2px); }
    .gloss-card h3 { margin: 0 0 .5rem; font-size: 1rem; color: #e6f7f3; }
    .gloss-card p { margin: 0; color: #9aa8b6; font-size: .82rem; line-height: 1.5; }
  </style>
</head>
<body>
  <main class="gloss-main">
    <header class="gloss-hero">
      <h1>${esc(isAr ? 'قاموس TradeAlphaAI' : 'TradeAlphaAI Glossary')}</h1>
      <p>${esc(desc)}</p>
    </header>
    ${sections}
  </main>
</body>
</html>
`;
}

function writeIfChanged(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let existing = '';
  try { existing = fs.readFileSync(file, 'utf8'); } catch {}
  if (existing === content) return false;
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function main() {
  const terms = readTerms();
  if (!terms.length) {
    console.error('[glossary] no terms found in', DATA_PATH);
    process.exit(1);
  }

  let written = 0;
  for (const isAr of [false, true]) {
    const outDir = path.join(ROOT, isAr ? 'ar/glossary' : 'glossary');
    for (const term of terms) {
      const html = renderTermPage(term, terms, isAr);
      if (writeIfChanged(path.join(outDir, `${term.slug}.html`), html)) written++;
    }
    const indexHtml = renderIndex(terms, isAr);
    if (writeIfChanged(path.join(outDir, 'index.html'), indexHtml)) written++;
  }
  console.log(`[glossary] ${terms.length} terms × 2 locales = ${terms.length * 2 + 2} pages, ${written} updated`);
}

if (require.main === module) main();

module.exports = { renderTermPage, renderIndex };
