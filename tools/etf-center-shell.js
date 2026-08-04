'use strict';

// ETF Intelligence Center — shared page shell.
//
// One skeleton for every Center generator (methodology, home, categories,
// rankings, compare, portfolios, education) so chrome, metadata and the required
// disclaimer cannot drift between surfaces.
//
// Follows the established donor pattern from generate-etf-research-pages.js:
// the header/footer are sliced out of a live already-baked page at build time,
// which guarantees the canonical header, footer and fonts without a second bake.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://www.tradealphaai.com';

// check-etf-research.js requires this exact phrase on ETF detail surfaces, and
// the Center reuses it everywhere so no page can ship without a disclaimer.
const DISCLAIMER_EN = 'TradeAlphaAI ETF intelligence describes observed structure, cost and historical measurement only. It is not a trading signal, execution instruction or investment advice.';
const DISCLAIMER_AR = 'تصف استخبارات صناديق المؤشرات في TradeAlphaAI البنية والتكلفة والقياس التاريخي المرصود فقط. وهي ليست إشارة تداول أو تعليمات تنفيذ أو نصيحة استثمارية.';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Locale-aware string picker, matching the convention used across generators. */
function tr(ar) {
  return (en, arText) => (ar ? arText : en);
}

/**
 * Slice the baked header/footer out of a live page.
 *
 * Reading a real page rather than re-rendering means the Center inherits the
 * canonical nav, footer and font links exactly as apply-global-header.js baked
 * them, with zero risk of drift.
 */
function templateHeader(ar, slugPath) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-outlook/index.html' : 'market-outlook/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const header = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace('data-active-section="market-outlook"', 'data-active-section="etfs"')
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${slugPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${slugPath}$2`);
  const footer = template.slice(mainEndIdx);
  return { bodyTag, header, footer };
}

function head(options) {
  const { ar, slugPath, titleEn, titleAr, descEn, descAr, jsonLd } = options;
  const depth = (ar ? 1 : 0) + slugPath.split('/').filter(Boolean).length;
  const rel = '../'.repeat(depth);
  const url = `${SITE}/${ar ? 'ar/' : ''}${slugPath}`;
  const title = `${ar ? titleAr : titleEn} | TradeAlphaAI`;
  const desc = ar ? descAr : descEn;
  const schema = jsonLd
    ? `\n  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`
    : '';
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="${SITE}/${slugPath}" />
  <link rel="alternate" hreflang="ar" href="${SITE}/ar/${slugPath}" />
  <link rel="alternate" hreflang="x-default" href="${SITE}/${slugPath}" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${SITE}/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="${SITE}/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="${rel}styles.css" />
  <link rel="stylesheet" href="${rel}landing.css" />
  <link rel="stylesheet" href="${rel}css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/etf-center.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />${schema}
</head>`;
}

/** Breadcrumb rooted at the ETF Intelligence Center. */
function breadcrumb(ar, trail) {
  const t = tr(ar);
  const parts = [
    `<a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a>`,
    `<a href="${ar ? '/ar/etfs/' : '/etfs/'}">${esc(t('ETF Intelligence', 'استخبارات الصناديق'))}</a>`,
  ];
  for (const [label, href] of trail) {
    parts.push(href ? `<a href="${esc(href)}">${esc(label)}</a>` : `<span>${esc(label)}</span>`);
  }
  return `<nav class="breadcrumb">${parts.join('<span>/</span>')}</nav>`;
}

/** BreadcrumbList JSON-LD matching the visible trail. */
function breadcrumbSchema(ar, slugPath, titleEn, titleAr) {
  const base = `${SITE}/${ar ? 'ar/' : ''}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: ar ? 'الرئيسية' : 'Home', item: base },
      { '@type': 'ListItem', position: 2, name: ar ? 'استخبارات الصناديق' : 'ETF Intelligence', item: `${base}etfs/` },
      { '@type': 'ListItem', position: 3, name: ar ? titleAr : titleEn, item: `${SITE}/${ar ? 'ar/' : ''}${slugPath}` },
    ],
  };
}

/**
 * Full page document.
 *
 * `body` is raw section markup; `trail` is the breadcrumb tail after the Center
 * root. The hero and the disclaimer are added here so every Center page carries
 * both without each generator remembering to.
 */
function page(options) {
  const {
    ar, slugPath, titleEn, titleAr, descEn, descAr,
    eyebrowEn, eyebrowAr, body, trail = [], jsonLd, heroExtra = '',
  } = options;
  const t = tr(ar);
  const parts = templateHeader(ar, slugPath);
  const crumb = breadcrumb(ar, trail.length ? trail : [[ar ? titleAr : titleEn, null]]);

  const main = `  <main class="market-shell">
    <div class="wrap">
      ${crumb}
      <section class="market-hero"><div class="market-hero-panel">
        <span class="eyebrow">${esc(ar ? (eyebrowAr || 'مركز استخبارات الصناديق') : (eyebrowEn || 'ETF Intelligence Center'))}</span>
        <h1>${esc(ar ? titleAr : titleEn)}</h1>
        <p class="market-lead">${esc(ar ? descAr : descEn)}</p>${heroExtra}
      </div></section>
${body}
      <section class="market-section" id="etf-center-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t(DISCLAIMER_EN, DISCLAIMER_AR))}</p></div></section>
    </div>
  </main>`;

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head({ ar, slugPath, titleEn, titleAr, descEn, descAr, jsonLd: jsonLd || breadcrumbSchema(ar, slugPath, titleEn, titleAr) })}
${parts.bodyTag}${parts.header}

${main}
${parts.footer}`;
}

/** Write a page list to disk, creating directories as needed. */
function writePages(pages, label) {
  const write = process.argv.includes('--write');
  if (write) {
    for (const p of pages) {
      fs.mkdirSync(path.dirname(p.out), { recursive: true });
      fs.writeFileSync(p.out, p.html, 'utf8');
    }
  }
  console.log(`[${label}] ${write ? 'wrote' : 'dry-run'} ${pages.length} pages`);
  return pages;
}

// --- small presentational helpers shared by Center generators ---------------

/** Percentage from a decimal, or an em-dash-free omission marker. */
function pct(value, digits = 1) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : null;
}

/** Signed percentage, for return gaps. */
function signedPct(value, digits = 1) {
  if (!Number.isFinite(value)) return null;
  const v = (value * 100).toFixed(digits);
  return value > 0 ? `+${v}%` : `${v}%`;
}

/** Compact currency magnitude, e.g. 45706600000 -> "45.7B". */
function compact(value) {
  if (!Number.isFinite(value)) return null;
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

/**
 * A statistic tile. Returns an empty string when the value is absent so callers
 * can concatenate freely — omission is the house rule, never a placeholder.
 */
function stat(label, value, note) {
  if (value === null || value === undefined || value === '') return '';
  return `<div class="etf-stat"><span class="etf-stat-label">${esc(label)}</span><strong class="etf-stat-value">${esc(value)}</strong>${note ? `<span class="etf-stat-note">${esc(note)}</span>` : ''}</div>`;
}

module.exports = {
  ROOT, SITE, DISCLAIMER_EN, DISCLAIMER_AR,
  esc, tr, templateHeader, head, page, breadcrumb, breadcrumbSchema,
  writePages, pct, signedPct, compact, stat,
};
