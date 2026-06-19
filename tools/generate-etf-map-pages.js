'use strict';

// Phase 214 CP7 - ETF visual map pages.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const MAP_FILE = path.join(ROOT, 'data', 'visual', 'etf-map.json');
const COLOR = { strongest: '#1f6f5c', strong: '#2f8f76', constructive: '#5a8f7a', neutral: '#46505f', mixed: '#b58b56', weakening: '#b58b56', weak: '#c2703c', weakest: '#b5523f', indeterminate: '#3a4250' };

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function templateHeader(ar, slugPath) {
  const templatePath = path.join(ROOT, ar ? 'ar/market-map/assets/index.html' : 'market-map/assets/index.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const bodyOpenIdx = template.indexOf('<body');
  const bodyOpenTagEnd = template.indexOf('>', bodyOpenIdx) + 1;
  const headerEndMarker = '<!-- GLOBAL_HEADER_END -->';
  const headerEndIdx = template.indexOf(headerEndMarker) + headerEndMarker.length;
  const mainEndIdx = template.indexOf('</main>') + '</main>'.length;
  const bodyTag = template.slice(bodyOpenIdx, bodyOpenTagEnd);
  const header = template.slice(bodyOpenTagEnd, headerEndIdx)
    .replace(/(class="lang-switch"\s+data-locale-route="ar"\s+href=")[^"]*(")/, `$1/ar/${slugPath}$2`)
    .replace(/(class="lang-switch"\s+data-locale-route="en"\s+href=")[^"]*(")/, `$1/${slugPath}$2`);
  const footer = template.slice(mainEndIdx);
  return { bodyTag, header, footer };
}

function head(ar, slugPath) {
  const depth = (ar ? 1 : 0) + slugPath.split('/').filter(Boolean).length;
  const rel = '../'.repeat(depth);
  const title = ar ? 'خريطة صناديق المؤشرات | TradeAlphaAI' : 'ETF Map | TradeAlphaAI';
  const desc = ar
    ? 'خريطة مرئية لعالم صناديق المؤشرات، مركبة من الترتيب والقوة النسبية والسياق المؤسسي.'
    : 'A visual ETF universe map composed from ETF rankings, relative strength and institutional context.';
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  return `<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="robots" content="index,follow,max-image-preview:large" />
  <link rel="canonical" href="${url}" />
  <link rel="alternate" hreflang="en" href="https://www.tradealphaai.com/${slugPath}" />
  <link rel="alternate" hreflang="ar" href="https://www.tradealphaai.com/ar/${slugPath}" />
  <link rel="alternate" hreflang="x-default" href="https://www.tradealphaai.com/${slugPath}" />
  <meta property="og:locale" content="${ar ? 'ar_AR' : 'en_US'}" />
  <meta property="og:site_name" content="TradeAlphaAI" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(desc)}" />
  <meta name="twitter:image" content="https://www.tradealphaai.com/Image/og-image.svg" />
  <link rel="stylesheet" href="/css/global-header.css" />
  <link rel="stylesheet" href="${rel}styles.css" />
  <link rel="stylesheet" href="${rel}landing.css" />
  <link rel="stylesheet" href="${rel}css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
</head>`;
}

function svg(map, ar) {
  const nodes = map.nodes || [];
  const w = 1220;
  const tileW = 224;
  const tileH = 112;
  const gap = 18;
  const cols = 5;
  const rows = Math.ceil(nodes.length / cols);
  const h = 58 + rows * (tileH + gap) + 28;
  const label = ar ? 'خريطة صناديق المؤشرات' : 'ETF universe map';
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" preserveAspectRatio="xMidYMid meet" class="market-map-svg" ${ar ? 'direction="rtl"' : ''}>`, `<rect width="${w}" height="${h}" fill="#0b0e13"/>`];
  nodes.forEach((node, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = 24 + col * (tileW + gap);
    const y = 38 + row * (tileH + gap);
    const color = COLOR[node.rank_label] || COLOR.indeterminate;
    const href = `${ar ? '/ar' : ''}/research/etfs/${node.slug}/`;
    parts.push(`<a href="${href}"><rect x="${x}" y="${y}" width="${tileW}" height="${tileH}" rx="10" fill="${color}" opacity="0.92"/>`);
    parts.push(`<text x="${x + tileW / 2}" y="${y + 34}" text-anchor="middle" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="24" font-weight="760" fill="#f4f7f1">${esc(node.symbol)}</text>`);
    parts.push(`<text x="${x + tileW / 2}" y="${y + 64}" text-anchor="middle" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="14" fill="#eef2ec">${esc(ar ? node.rank_label_ar : node.rank_label_en)}</text>`);
    parts.push(`<text x="${x + tileW / 2}" y="${y + 90}" text-anchor="middle" font-family="'Inter','Segoe UI',Arial,sans-serif" font-size="12" fill="#d7ded6">${esc(ar ? node.confirmation_ar : node.confirmation_en)}</text></a>`);
  });
  parts.push('</svg>');
  return parts.join('\n');
}

function card(kicker, title, href, color) {
  return `<article class="market-card"${color ? ` style="border-inline-start:4px solid ${esc(color)}"` : ''}><span class="market-card-kicker">${esc(kicker)}</span><h3><a href="${esc(href)}">${esc(title)}</a></h3></article>`;
}

function page(ar) {
  const slugPath = 'market-map/etfs/';
  const map = readJson(MAP_FILE, {});
  const t = (en, arText) => (ar ? arText : en);
  const parts = templateHeader(ar, slugPath);
  const lead = t('A visual map of the ETF universe, grouped by observed ranking state, confirmation and regime context. Educational context only.', 'خريطة مرئية لعالم صناديق المؤشرات، مرتبة حسب حالة الترتيب المرصودة والتأكيد وسياق النظام. سياق تعليمي فقط.');
  const strongest = (map.nodes || []).filter((node) => node.available).slice(0, 5).map((node) => card(node.symbol, ar ? node.rank_label_ar : node.rank_label_en, `${ar ? '/ar' : ''}/research/etfs/${node.slug}/`, COLOR[node.rank_label])).join('\n');
  const unavailable = (map.nodes || []).filter((node) => !node.available).slice(0, 5).map((node) => card(node.symbol, t('Direct ranking unavailable', 'الترتيب المباشر غير متاح'), `${ar ? '/ar' : ''}/research/etfs/${node.slug}/`, COLOR.indeterminate)).join('\n');
  const main = `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/market-terminal/' : '/market-terminal/'}">${esc(t('Market Terminal', 'محطة السوق'))}</a><span>/</span><span>${esc(t('ETF Map', 'خريطة صناديق المؤشرات'))}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('Visual Market Maps', 'خرائط السوق المرئية'))}</span><h1>${esc(t('ETF Map', 'خريطة صناديق المؤشرات'))}</h1><p class="market-lead">${esc(lead)}</p></div></section>
      <section class="market-section" id="etf-map"><div class="market-section-head"><span class="eyebrow">${esc(t('ETF universe', 'عالم الصناديق'))}</span><h2>${esc(t('Ranking and confirmation map', 'خريطة الترتيب والتأكيد'))}</h2></div><div class="market-panel"><div class="ic-svg">${svg(map, ar)}</div></div></section>
      <section class="market-section" id="etf-map-context"><div class="market-section-head"><span class="eyebrow">${esc(t('Context', 'السياق'))}</span><h2>${esc(t('What the map can and cannot show', 'ما تعرضه الخريطة وما لا تعرضه'))}</h2></div><div class="market-grid three">
${strongest}
${unavailable}
        </div><p class="market-copy">${esc(t('The map uses direct ETF ranking coverage only. ETFs without direct coverage remain visibly indeterminate rather than being inferred from proxies.', 'تستخدم الخريطة تغطية ترتيب مباشرة للصندوق فقط. وتبقى الصناديق التي لا تملك تغطية مباشرة ظاهرة كغير محددة بدلا من استنتاجها من بدائل.'))}</p></section>
      <section class="market-section" id="etf-map-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('This visual map is not a trading signal or investment advice.', 'هذه الخريطة المرئية ليست إشارة تداول أو نصيحة استثمارية.'))}</p></div></section>
    </div>
  </main>`;
  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
${head(ar, slugPath)}
${parts.bodyTag}${parts.header}

${main}
${parts.footer}`;
}

function main() {
  const pages = [
    [path.join(ROOT, 'market-map/etfs/index.html'), page(false)],
    [path.join(ROOT, 'ar/market-map/etfs/index.html'), page(true)]
  ];
  if (WRITE) {
    for (const [out, html] of pages) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html, 'utf8');
    }
  }
  console.log(`[etf-map-pages] ${WRITE ? 'wrote' : 'dry-run'} ${pages.length} pages`);
}

if (require.main === module) main();

module.exports = { page };
