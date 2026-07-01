#!/usr/bin/env node
'use strict';

// Generates the financial glossary — one page per term (EN + AR), plus an
// index page for each locale. Uses the site's canonical design system:
//   - global-header.css + styles.css + landing.css + market-portal.css
//   - <body class="market-page">
//   - GLOBAL_HEADER_START/END markers (apply-global-header.js fills them)
//   - <main class="market-shell"><div class="wrap"> shell
//   - .market-section / .market-panel / .insight-* / .market-copy classes
//
// Content model per term:
//   - Article + FAQPage + BreadcrumbList JSON-LD (rich-snippet eligible)
//   - Hero card with category badge and lead
//   - Definition, formula, example, FAQs
//   - Related terms as chip row (internal links)
//
// Idempotent: rewrites the whole /glossary/ + /ar/glossary/ trees each run.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.tradealphaai.com';

const DATA_PATH = path.join(ROOT, 'data', 'glossary-terms.json');

const CATEGORY_LABEL = {
  basics:      { en: 'Investing Basics',       ar: 'أساسيات الاستثمار' },
  valuation:   { en: 'Valuation',              ar: 'التقييم' },
  risk:        { en: 'Risk & Performance',     ar: 'المخاطر والأداء' },
  macro:       { en: 'Macro & Economics',      ar: 'الماكرو والاقتصاد' },
  portfolio:   { en: 'Portfolio Management',   ar: 'إدارة المحفظة' },
  instruments: { en: 'Instruments',            ar: 'الأدوات' },
  technical:   { en: 'Technical Analysis',     ar: 'التحليل الفني' },
  fixed:       { en: 'Fixed Income',           ar: 'الدخل الثابت' },
  options:     { en: 'Options',                ar: 'الخيارات' },
  corporate:   { en: 'Corporate Finance',      ar: 'تمويل الشركات' }
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function readTerms() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).terms || [];
}

function relatedChips(term, allTerms, isAr) {
  const bySlug = new Map(allTerms.map((t) => [t.slug, t]));
  const found = (term.related || []).map((slug) => bySlug.get(slug)).filter(Boolean);
  if (!found.length) return '';
  return found.map((t) => {
    const name = esc(isAr ? t.term_ar : t.term);
    const href = isAr ? `/ar/glossary/${t.slug}.html` : `/glossary/${t.slug}.html`;
    return `<a class="insight-chip" href="${href}">${name}</a>`;
  }).join('');
}

function schemaGraph(term, isAr) {
  const name = isAr ? term.term_ar : term.term;
  const desc = isAr ? term.short_def_ar : term.short_def;
  const url = `${SITE}/${isAr ? 'ar/' : ''}glossary/${term.slug}.html`;
  const glossaryUrl = `${SITE}/${isAr ? 'ar/' : ''}glossary/`;
  const glossaryLabel = isAr ? 'المصطلحات' : 'Glossary';
  const faqs = isAr ? (term.faqs_ar || []) : (term.faqs || []);

  const graph = [
    {
      '@type': 'DefinedTerm',
      name,
      description: desc,
      inDefinedTermSet: glossaryUrl,
      termCode: term.slug,
      url
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: glossaryLabel, item: glossaryUrl },
        { '@type': 'ListItem', position: 3, name, item: url }
      ]
    }
  ];
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a }
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function renderTermPage(term, allTerms, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const name = isAr ? term.term_ar : term.term;
  const shortDef = isAr ? term.short_def_ar : term.short_def;
  const longDef = isAr ? term.long_def_ar : term.long_def;
  const example = isAr ? term.example_ar : term.example;
  const faqs = isAr ? (term.faqs_ar || []) : (term.faqs || []);
  const canonical = `${SITE}/${isAr ? 'ar/' : ''}glossary/${term.slug}.html`;
  const altEn = `${SITE}/glossary/${term.slug}.html`;
  const altAr = `${SITE}/ar/glossary/${term.slug}.html`;

  const cat = CATEGORY_LABEL[term.category] || { en: term.category, ar: term.category };
  const catLabel = isAr ? cat.ar : cat.en;
  const title = `${name}: ${isAr ? 'التعريف والمعادلة والمثال' : 'Definition, Formula & Example'} | TradeAlphaAI`;
  const jsonLd = JSON.stringify(schemaGraph(term, isAr), null, 2);

  const home = isAr ? 'الرئيسية' : 'Home';
  const glossaryLabel = isAr ? 'المصطلحات' : 'Glossary';
  const backHref = isAr ? '/ar/glossary/' : '/glossary/';
  const glossaryUrl = backHref;

  const formulaBlock = term.formula ? `
              <section class="insight-summary-box" style="margin:24px 0">
                <span>${isAr ? 'المعادلة' : 'Formula'}</span>
                <p style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:1.05rem;color:var(--accent)">${esc(term.formula)}</p>
                ${term.formula_notes ? `<p class="market-copy" style="font-size:.9rem;margin-top:.5rem">${esc(term.formula_notes)}</p>` : ''}
              </section>` : '';

  const faqBlock = faqs.length ? `
            <section>
              <h2>${isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}</h2>
              ${faqs.map((f) => `<details class="market-panel" style="margin:12px 0;padding:16px 20px"><summary style="cursor:pointer;font-weight:600;color:var(--text,#e6f7f3)">${esc(f.q)}</summary><p class="market-copy" style="margin-top:12px">${esc(f.a)}</p></details>`).join('')}
            </section>` : '';

  const relatedBlock = relatedChips(term, allTerms, isAr);

  const breadcrumbCrumb = `<nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${home}</a><span>/</span><a href="${backHref}">${glossaryLabel}</a><span>/</span><span>${esc(name)}</span></nav>`;

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
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
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
  <script type="application/ld+json">
${jsonLd}
  </script>
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      ${breadcrumbCrumb}

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${esc(catLabel)}</span>
            <span class="insight-category-badge muted">${isAr ? 'قاموس' : 'Glossary'}</span>
          </div>
          <h1>${esc(name)}</h1>
          <p class="market-lead">${esc(shortDef)}</p>
          <div class="insight-summary-box">
            <span>${isAr ? 'تعريف مختصر' : 'At a glance'}</span>
            <p>${esc(shortDef)}</p>
          </div>
          ${relatedBlock ? `<div class="insight-meta-clusters"><div><strong>${isAr ? 'مصطلحات ذات صلة' : 'Related terms'}</strong><div class="insight-chip-row">${relatedBlock}</div></div></div>` : ''}
          <p class="insight-hero-disclaimer">${isAr ? 'محتوى تعليمي فقط. لا يشكل نصيحة استثمارية.' : 'Educational content only. Not investment advice.'}</p>
        </div>
      </section>

      <section class="market-section">
        <div class="insight-layout">
          <article class="insight-article-body">

            <h2>${isAr ? 'التعريف' : 'Definition'}</h2>
            <p class="market-copy">${esc(longDef)}</p>

            ${formulaBlock}

            <h2>${isAr ? 'مثال' : 'Example'}</h2>
            <p class="market-copy">${esc(example)}</p>

            ${faqBlock}

            <p class="market-copy" style="margin-top:32px"><a href="${backHref}">${isAr ? '← عودة لكل المصطلحات' : '← Back to all terms'}</a></p>

          </article>
        </div>
      </section>

    </div>
  </main>
</body>
</html>
`;
}

function renderIndex(terms, isAr) {
  const lang = isAr ? 'ar' : 'en';
  const dir = isAr ? 'rtl' : 'ltr';
  const title = isAr
    ? 'قاموس المصطلحات المالية | TradeAlphaAI'
    : 'Financial Glossary | TradeAlphaAI';
  const desc = isAr
    ? 'قاموس شامل للمصطلحات المالية والاستثمارية — تعريفات، معادلات، أمثلة، وأسئلة شائعة.'
    : 'A comprehensive glossary of financial and investing terminology — definitions, formulas, examples, and FAQs.';

  const groups = {};
  for (const t of terms) (groups[t.category || 'basics'] = groups[t.category || 'basics'] || []).push(t);

  const canonical = `${SITE}/${isAr ? 'ar/' : ''}glossary/`;
  const home = isAr ? 'الرئيسية' : 'Home';

  const sections = Object.keys(groups).sort().map((catKey) => {
    const c = CATEGORY_LABEL[catKey] || { en: catKey, ar: catKey };
    const catLabel = isAr ? c.ar : c.en;
    const items = groups[catKey]
      .sort((a, b) => (isAr ? a.term_ar : a.term).localeCompare(isAr ? b.term_ar : b.term))
      .map((t) => {
        const n = esc(isAr ? t.term_ar : t.term);
        const s = esc(isAr ? t.short_def_ar : t.short_def);
        return `<a class="insight-stat-card" href="${t.slug}.html" style="text-decoration:none"><span>${esc(catLabel)}</span><strong>${n}</strong><p>${s}</p></a>`;
      }).join('');
    return `<section class="market-section">
      <h2 style="color:var(--accent);margin-bottom:16px">${esc(catLabel)}</h2>
      <div class="insight-stat-grid">${items}</div>
    </section>`;
  }).join('');

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="utf-8" />
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
  <link rel="stylesheet" href="/landing.css" />
  <link rel="stylesheet" href="/css/market/market-portal.css" />
</head>
<body class="market-page">
  <!-- GLOBAL_HEADER_START -->
  <!-- GLOBAL_HEADER_END -->

  <main class="market-shell">
    <div class="wrap">

      <nav class="breadcrumb"><a href="/${isAr ? 'ar/' : ''}">${home}</a><span>/</span><span>${esc(isAr ? 'المصطلحات' : 'Glossary')}</span></nav>

      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row">
            <span class="insight-category-badge">${isAr ? 'قاموس' : 'Glossary'}</span>
          </div>
          <h1>${esc(isAr ? 'قاموس المصطلحات المالية' : 'Financial Glossary')}</h1>
          <p class="market-lead">${esc(desc)}</p>
          <p class="insight-hero-disclaimer">${isAr ? 'محتوى تعليمي فقط. لا يشكل نصيحة استثمارية.' : 'Educational content only. Not investment advice.'}</p>
        </div>
      </section>

      ${sections}

    </div>
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
  if (!terms.length) { console.error('[glossary] no terms'); process.exit(1); }

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
