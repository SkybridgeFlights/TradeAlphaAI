'use strict';

// Phase 215 CP9 — ETF coverage transparency dashboard.
// Builds /etfs/coverage/ + /ar/etfs/coverage/ surfacing the provider audit,
// per-ETF availability, quality distribution and activation progress. Pulls
// from etf-provider-audit / etf-data-quality / etf-charts; no fabrication.

const fs = require('fs');
const path = require('path');
const { ETFS } = require('./etf-registry');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const J = (rel) => path.join(ROOT, 'data', 'intelligence', rel);
const QUALITY_FILL = { high: '#4ad17a', medium: '#f0c45f', low: '#e0824a', unavailable: '#7a808a' };

function readJson(file, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function esc(value) {
  return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function templateHeader(ar, slugPath) {
  const templatePath = path.join(ROOT, ar ? 'ar/etfs.html' : 'etfs.html');
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
  const title = ar ? 'تغطية صناديق المؤشرات | TradeAlphaAI' : 'ETF Coverage Dashboard | TradeAlphaAI';
  const desc = ar
    ? 'لوحة شفافية لتغطية بيانات صناديق المؤشرات تعرض حالة المزودين، توفر الصناديق، توزيع الجودة وتقدم التفعيل.'
    : 'A transparency dashboard for ETF data coverage — provider status, per-ETF availability, quality distribution and activation progress.';
  const url = `https://www.tradealphaai.com/${ar ? 'ar/' : ''}${slugPath}`;
  const ld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url, inLanguage: ar ? 'ar' : 'en', publisher: { '@type': 'Organization', name: 'TradeAlphaAI', url: 'https://www.tradealphaai.com' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'TradeAlphaAI', item: ar ? 'https://www.tradealphaai.com/ar/' : 'https://www.tradealphaai.com/' },
        { '@type': 'ListItem', position: 2, name: ar ? 'عالم صناديق المؤشرات' : 'ETF Universe', item: ar ? 'https://www.tradealphaai.com/ar/etfs/' : 'https://www.tradealphaai.com/etfs/' },
        { '@type': 'ListItem', position: 3, name: ar ? 'تغطية صناديق المؤشرات' : 'ETF Coverage', item: url },
      ] },
    ],
  };
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
  <link rel="stylesheet" href="../../styles.css" />
  <link rel="stylesheet" href="../../landing.css" />
  <link rel="stylesheet" href="../../css/market/market-portal.css" />
  <link rel="stylesheet" href="/css/global-layout.css" />
  <link rel="stylesheet" href="/css/responsive.css" />
  <link rel="stylesheet" href="/css/global-header-canonical.css" />
  <script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>`;
}

function providerRow(provider, ar) {
  const t = (en, arText) => (ar ? arText : en);
  return `<tr><td>${esc(provider.name)}</td><td>${esc(provider.keyed ? t('keyed', 'يتطلب مفتاح') : t('keyless', 'بدون مفتاح'))}</td><td>${esc(provider.key_present ? t('present', 'موجود') : t('absent', 'غير موجود'))}</td><td>${esc(provider.etfs_resolved + ' / ' + provider.etfs_attempted)}</td><td>${esc('ok ' + provider.outcomes.ok + ' · no_key ' + provider.outcomes.no_key + ' · errors ' + (provider.outcomes.error + provider.outcomes.rate_limited + provider.outcomes.auth_failed + provider.outcomes.insufficient_or_empty))}</td></tr>`;
}

function etfRow(etf, audit, quality, ar) {
  const t = (en, arText) => (ar ? arText : en);
  const tier = quality && quality.quality_tier || 'unavailable';
  const tierColor = QUALITY_FILL[tier] || QUALITY_FILL.unavailable;
  const tierLabel = quality ? (ar ? quality.quality_tier_ar : quality.quality_tier_en) : t('unavailable', 'غير متاحة');
  const availability = audit && audit.availability === 'available' ? t('available', 'متاح') : t('unavailable', 'غير متاح');
  const provider = (quality && quality.resolved_provider) || (audit && audit.selected_source && audit.selected_source.provider) || t('none', 'لا يوجد');
  const bars = (quality && quality.bars) || 0;
  const detailHref = (ar ? '/ar' : '') + '/research/etfs/' + etf.slug + '/';
  return `<tr><td><a href="${esc(detailHref)}">${esc(etf.symbol)}</a></td><td>${esc(etf.fund_name)}</td><td>${esc(availability)}</td><td>${esc(provider)}</td><td>${esc(bars)}</td><td><span class="market-tag" style="background:${esc(tierColor)};color:#0b0e13;padding:2px 8px;border-radius:6px;font-weight:700">${esc(tierLabel)}</span></td></tr>`;
}

function page(ar) {
  const slugPath = 'etfs/coverage/';
  const t = (en, arText) => (ar ? arText : en);
  const parts = templateHeader(ar, slugPath);
  const audit = readJson(J('etf-provider-audit.json'), { providers: [], etfs: [] });
  const quality = readJson(J('etf-data-quality.json'), { etfs: [], summary: {} });
  const charts = readJson(J('etf-charts.json'), {});
  const auditBy = new Map((audit.etfs || []).map((e) => [e.symbol, e]));
  const qualityBy = new Map((quality.etfs || []).map((e) => [e.symbol, e]));
  const summary = quality.summary || {};
  const ph = charts.provider_health || {};
  const updatedEn = `Audit captured ${charts.generated_at || 'unknown'} · ${ph.mode || 'offline'} mode · provider chain FMP -> Finnhub -> AlphaVantage -> Yahoo.`;
  const updatedAr = `جرى تسجيل التدقيق بتاريخ ${charts.generated_at || 'غير معروف'} · وضع ${ph.mode || 'offline'} · سلسلة المزودين FMP ← Finnhub ← AlphaVantage ← Yahoo.`;
  const providerRows = (audit.providers || []).map((p) => providerRow(p, ar)).join('\n');
  const etfRows = ETFS.map((etf) => etfRow(etf, auditBy.get(etf.symbol), qualityBy.get(etf.symbol), ar)).join('\n');
  const main = `  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${esc(t('Home', 'الرئيسية'))}</a><span>/</span><a href="${ar ? '/ar/etfs/' : '/etfs/'}">${esc(t('ETF Universe', 'عالم صناديق المؤشرات'))}</a><span>/</span><span>${esc(t('Coverage', 'التغطية'))}</span></nav>
      <section class="market-hero"><div class="market-hero-panel"><span class="eyebrow">${esc(t('ETF Coverage Dashboard', 'لوحة تغطية صناديق المؤشرات'))}</span><h1>${esc(t('ETF data coverage transparency', 'شفافية تغطية بيانات صناديق المؤشرات'))}</h1><p class="market-lead">${esc(t('Provider status, per-ETF availability, quality distribution and activation progress for the 20-ETF intelligence universe. Honest — unavailable ETFs remain unavailable.', 'حالة المزود، توفر الصناديق فردياً، توزيع الجودة وتقدم تفعيل عالم استخبارات الصناديق المكون من 20 صندوقا. بصدق — تبقى الصناديق غير المتاحة غير متاحة.'))}</p><p class="market-copy">${esc(ar ? updatedAr : updatedEn)}</p></div></section>

      <section class="market-section" id="etf-coverage-summary"><div class="market-section-head"><span class="eyebrow">${esc(t('Summary', 'الملخص'))}</span><h2>${esc(t('Availability and quality distribution', 'توزيع التوفر والجودة'))}</h2></div>
        <div class="market-grid three">
          <article class="market-card"><span class="market-card-kicker">${esc(t('Available', 'متاح'))}</span><h3>${esc(((summary.full_coverage) || 0) + ' / ' + ETFS.length)}</h3><p class="market-copy">${esc(t('ETFs with full coverage verified bars.', 'صناديق ذات تغطية كاملة من شموع موثقة.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Verified charts', 'الرسوم الموثقة'))}</span><h3>${esc(((summary.verified_chart) || 0) + ' / ' + ETFS.length)}</h3><p class="market-copy">${esc(t('ETFs with a verified OHLCV chart on disk.', 'صناديق تحتوي على رسم OHLCV موثق على القرص.'))}</p></article>
          <article class="market-card"><span class="market-card-kicker">${esc(t('Provider mode', 'وضع المزود'))}</span><h3>${esc(((summary.keyed_provider) || 0) + ' ' + t('keyed', 'بمفتاح') + ' · ' + ((summary.keyless_fallback) || 0) + ' ' + t('keyless', 'بدون مفتاح'))}</h3><p class="market-copy">${esc(t('Distribution between verified-provider and keyless-fallback activation.', 'التوزيع بين التفعيل عبر مزود موثق والتفعيل عبر مصدر احتياطي بلا مفتاح.'))}</p></article>
        </div>
        <div class="market-grid three">
          <article class="market-card" style="border-inline-start:4px solid ${QUALITY_FILL.high}"><span class="market-card-kicker">${esc(t('High quality', 'جودة عالية'))}</span><h3>${esc(summary.quality_high || 0)}</h3></article>
          <article class="market-card" style="border-inline-start:4px solid ${QUALITY_FILL.medium}"><span class="market-card-kicker">${esc(t('Medium quality', 'جودة متوسطة'))}</span><h3>${esc(summary.quality_medium || 0)}</h3></article>
          <article class="market-card" style="border-inline-start:4px solid ${QUALITY_FILL.low}"><span class="market-card-kicker">${esc(t('Low quality', 'جودة منخفضة'))}</span><h3>${esc(summary.quality_low || 0)}</h3></article>
          <article class="market-card" style="border-inline-start:4px solid ${QUALITY_FILL.unavailable}"><span class="market-card-kicker">${esc(t('Unavailable', 'غير متاحة'))}</span><h3>${esc(summary.quality_unavailable || 0)}</h3></article>
        </div></section>

      <section class="market-section" id="etf-coverage-providers"><div class="market-section-head"><span class="eyebrow">${esc(t('Providers', 'المزودون'))}</span><h2>${esc(t('Provider activation matrix', 'مصفوفة تفعيل المزودين'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t('Provider', 'المزود'))}</th><th>${esc(t('Type', 'النوع'))}</th><th>${esc(t('Key', 'المفتاح'))}</th><th>${esc(t('Resolved', 'المستجاب'))}</th><th>${esc(t('Outcomes', 'النتائج'))}</th></tr></thead><tbody>${providerRows}</tbody></table>
        <p class="market-copy">${esc(t('Provider chain FMP -> Finnhub -> AlphaVantage -> Yahoo. The keyless Yahoo tier is the fallback when keyed providers are unavailable; a keyed provider takes precedence when present.', 'سلسلة المزودين FMP ← Finnhub ← AlphaVantage ← Yahoo. الطبقة Yahoo بدون مفتاح هي الاحتياط عند غياب المزودين المفتاحيين؛ ويحظى المزود المفتاحي بالأولوية عند توفره.'))}</p></div></section>

      <section class="market-section" id="etf-coverage-activation"><div class="market-section-head"><span class="eyebrow">${esc(t('Per-ETF activation', 'تفعيل كل صندوق'))}</span><h2>${esc(t('Activation progress', 'تقدم التفعيل'))}</h2></div>
        <div class="market-panel"><table class="market-table" style="width:100%;border-collapse:collapse"><thead><tr><th>${esc(t('Symbol', 'الرمز'))}</th><th>${esc(t('Fund', 'الصندوق'))}</th><th>${esc(t('Availability', 'التوفر'))}</th><th>${esc(t('Selected provider', 'المزود المختار'))}</th><th>${esc(t('Bars', 'الشموع'))}</th><th>${esc(t('Quality tier', 'مستوى الجودة'))}</th></tr></thead><tbody>${etfRows}</tbody></table></div></section>

      <section class="market-section" id="etf-coverage-disclaimer"><div class="market-panel"><p class="market-copy">${esc(t('This dashboard reports observed data-coverage transparency. It is not a trading signal, recommendation or investment advice. Unavailable ETFs remain honestly unavailable rather than substituted from proxies.', 'تعرض هذه اللوحة شفافية تغطية البيانات المرصودة. وهي ليست إشارة تداول أو توصية أو نصيحة استثمارية. تبقى الصناديق غير المتاحة غير متاحة بصدق دون استبدالها ببدائل.'))}</p></div></section>
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
    [path.join(ROOT, 'etfs/coverage/index.html'), page(false)],
    [path.join(ROOT, 'ar/etfs/coverage/index.html'), page(true)],
  ];
  if (WRITE) {
    for (const [out, html] of pages) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, html, 'utf8');
    }
  }
  console.log(`[etf-coverage-pages] ${WRITE ? 'wrote' : 'dry-run'} ${pages.length} pages`);
}

if (require.main === module) main();

module.exports = { page };
