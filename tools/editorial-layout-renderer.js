'use strict';

const fs = require('fs');
const path = require('path');
const { renderSiteFooter, renderSiteHeader } = require('./global-layout-renderer');

const SITE_URL = 'https://www.tradealphaai.com';
const ETF_FLOW_PATH = path.resolve(__dirname, '..', 'data', 'intelligence', 'etf-flow-intelligence.json');
const ETF_KNOWN_TICKERS = new Set([
  'SPY','QQQ','IWM','XLV','TLT','GLD','SOXX','DIA','XLE','XLF','XLU','XLP','UUP',
  'VTI','IVV','AGG','LQD','HYG','XLK','XLY','XLB','XLRE','XLC','IEF','SHY',
  'ARKK','SCHD','JEPI','JEPQ','VIG','VYM','BND','EEM','EFA','VEA','VWO'
]);

function hasProductionEditorialLayout(html, ar = false) {
  const text = String(html || '');
  return [
    /<body[^>]+class="[^"]*\bmarket-page\b/i,
    /class="[^"]*\btopbar\b[^"]*"/,
    /data-global-header="homepage"/,
    /class="[^"]*\bmarket-shell\b[^"]*"/,
    /class="[^"]*\bwrap\b[^"]*"/,
    /class="[^"]*\binsight-hero-card\b[^"]*"/,
    /class="[^"]*\binsight-layout\b[^"]*"/,
    /class="[^"]*\binsight-article-body\b[^"]*"/,
    /class="[^"]*\binsight-sidebar\b[^"]*"/,
    /css\/market\/market-portal\.css/,
    /css\/global-layout\.css/,
    /js\/language-router\.js/,
    /js\/mobile-nav\.js/,
    /data-locale-route="ar"|data-locale-route="en"/
  ].every((pattern) => pattern.test(text)) && (!ar || /<html[^>]+lang="ar"[^>]+dir="rtl"/i.test(text));
}

function ensureProductionEditorialLayout(html, topic, locale) {
  const ar = locale === 'ar';
  if (hasProductionEditorialLayout(html, ar)) return html;

  const original = String(html || '');
  const title = extractText(original, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    (ar ? topic.title_ar : topic.title_en) ||
    topic.title_en ||
    titleFromSlug(topic.slug);
  const description = extractText(original, /<meta name="description" content="([^"]+)"/i) ||
    extractText(original, /class="market-lead"[^>]*>([\s\S]*?)<\/p>/i) ||
    title;
  const category = extractText(original, /class="insight-category-badge"[^>]*>([\s\S]*?)<\/span>/i) ||
    topic.category ||
    (ar ? 'Research' : 'Research');
  const articleHtml = extractRaw(original, /<article[^>]*>([\s\S]*?)<\/article>/i) ||
    extractRaw(original, /<main[^>]*>([\s\S]*?)<\/main>/i) ||
    extractRaw(original, /<body[^>]*>([\s\S]*?)<\/body>/i) ||
    '';
  const articleBody = articleHtml.replace(/<header[\s\S]*?<\/header>/i, '').trim();
  const existingHead = extractRaw(original, /<head[^>]*>([\s\S]*?)<\/head>/i);
  const head = normalizeHead(existingHead, { topic, title, description, ar });
  const prefix = ar ? '../../' : '../';
  const canonicalPath = `${ar ? '/ar' : ''}/insights/${topic.slug}.html`;
  const nav = renderSiteHeader({
    locale: ar ? 'ar' : 'en',
    active: 'insights',
    languageHref: ar ? `/insights/${topic.slug}.html` : `/ar/insights/${topic.slug}.html`
  });
  const sidebar = renderSidebar(articleBody, topic, ar);

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
${head}
</head>
<body class="market-page">
  <div class="insight-progress-bar" id="read-progress"></div>
  ${nav}
  <main class="market-shell">
    <div class="wrap">
      <nav class="breadcrumb"><a href="${ar ? '/ar/' : '/'}">${ar ? 'الرئيسية' : 'Home'}</a><span>/</span><a href="${ar ? '/ar/insights/' : '/insights/'}">${ar ? 'المقالات' : 'Articles'}</a><span>/</span><span>${escapeHtml(title)}</span></nav>
      <section class="market-section">
        <div class="market-panel insight-hero-card">
          <div class="insight-label-row"><span class="insight-category-badge">${escapeHtml(category)}</span><span class="insight-category-badge muted">${ar ? 'بحث تعليمي' : 'Educational Research'}</span></div>
          <h1>${escapeHtml(title)}</h1>
          <div class="insight-meta-bar"><span>${ar ? 'نشر' : 'Published'} <strong><time datetime="${escapeHtml(topic.target_publish_date || '')}">${escapeHtml(topic.target_publish_date || '')}</time></strong></span><span><strong>${escapeHtml(String(topic.estimated_read_time || 7))} ${ar ? 'دقائق قراءة' : 'min read'}</strong></span><span><strong>TradeAlphaAI</strong></span></div>
          <p class="market-lead">${escapeHtml(description)}</p>
          <div class="insight-summary-box"><span>${ar ? 'ملخص تنفيذي' : 'Executive summary'}</span><p>${escapeHtml(description)}</p></div>
        </div>
      </section>
      <section class="market-section"><div class="insight-layout"><article class="insight-article-body" data-editorial-draft="true" data-status="in_review">
${normalizeArticleBody(articleBody, topic, ar)}
      </article>${sidebar}</div></section>
    </div>
  </main>
  ${renderSiteFooter({ locale: ar ? 'ar' : 'en' })}
  <script>(function(){var bar=document.getElementById('read-progress');if(!bar)return;window.addEventListener('scroll',function(){var d=document.documentElement;var p=Math.min(d.scrollTop/(d.scrollHeight-d.clientHeight)||0,1);bar.style.width=(p*100).toFixed(1)+'%';},{passive:true});})();</script>
  <script src="${prefix}js/research-layer.js"></script>
  <script src="${prefix}js/language-router.js" defer></script>
  <script src="${prefix}js/mobile-nav.js" defer></script>
  <script type="module">import { trackRecentlyViewed } from "/js/market/recently-viewed.js"; trackRecentlyViewed({ title: document.title, url: location.pathname || "${canonicalPath}", type: "insight" });</script>
</body>
</html>
`;
}

function normalizeHead(head, { topic, title, description, ar }) {
  let out = String(head || '').trim();
  const prefix = ar ? '../../' : '../';
  const canonical = `${SITE_URL}${ar ? '/ar' : ''}/insights/${topic.slug}.html`;
  const enUrl = `${SITE_URL}/insights/${topic.slug}.html`;
  const enLocale = `${SITE_URL}/en/insights/${topic.slug}.html`;
  const arUrl = `${SITE_URL}/ar/insights/${topic.slug}.html`;
  if (!out) {
    out = [
      '  <meta charset="utf-8" />',
      '  <meta name="viewport" content="width=device-width,initial-scale=1" />',
      '  <meta name="robots" content="index,follow,max-image-preview:large" />',
      `  <title>${escapeHtml(title)} | TradeAlphaAI</title>`,
      `  <meta name="description" content="${escapeHtml(description)}" />`
    ].join('\n');
  }
  out = upsert(out, /<meta name="robots"[^>]*>/i, '  <meta name="robots" content="index,follow,max-image-preview:large" />');
  out = upsert(out, /<link rel="canonical"[^>]*>/i, `  <link rel="canonical" href="${canonical}" />`);
  if (!/hreflang="en-US"/i.test(out)) out += `\n  <link rel="alternate" hreflang="en-US" href="${enLocale}" />`;
  if (!new RegExp(`hreflang="en"[\\s\\S]*${escapeRegExp(enUrl)}`, 'i').test(out)) out += `\n  <link rel="alternate" hreflang="en" href="${enUrl}" />`;
  if (!new RegExp(`hreflang="ar"[\\s\\S]*${escapeRegExp(arUrl)}`, 'i').test(out)) out += `\n  <link rel="alternate" hreflang="ar" href="${arUrl}" />`;
  if (!/hreflang="x-default"/i.test(out)) out += `\n  <link rel="alternate" hreflang="x-default" href="${enUrl}" />`;
  for (const href of [`${prefix}styles.css`, `${prefix}landing.css`, `${prefix}css/market/market-portal.css`]) {
    if (!out.includes(href)) out += `\n  <link rel="stylesheet" href="${href}" />`;
  }
  if (!out.includes('/css/responsive.css')) out += '\n  <link rel="stylesheet" href="/css/responsive.css" />';
  if (!out.includes('/css/global-layout.css')) out += '\n  <link rel="stylesheet" href="/css/global-layout.css" />';
  return out;
}

function renderNav(slug, ar) {
  if (ar) {
    return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/ar/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>منصة الأبحاث</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="التنقل الرئيسي"><a href="/ar/" class="nav-link">الرئيسية</a><a href="/ar/stocks.html" class="nav-link">أبحاث الأسهم</a><a href="/ar/etfs.html" class="nav-link">صناديق المؤشرات</a><a href="/ar/rankings.html" class="nav-link">التصنيفات</a><a href="/ar/insights/" class="nav-link">المقالات</a></nav><div class="locale-links" aria-label="اختيار اللغة"><a class="lang-switch" data-locale-route="en" href="/insights/${slug}.html">English</a><a class="lang-switch" data-locale-route="ar" href="/ar/insights/${slug}.html">العربية</a></div><button class="mobile-menu-toggle" type="button" aria-label="فتح القائمة" aria-expanded="false" aria-controls="mobile-nav-drawer"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button></div></div></div>`;
  }
  return `<div class="topbar"><div class="wrap topbar-inner"><a class="brand" href="/"><span class="brand-mark" aria-hidden="true"></span><span class="brand-copy"><strong>TradeAlphaAI</strong><span>Research Platform</span></span></a><div class="top-actions"><nav class="nav-group" aria-label="Primary"><a href="/" class="nav-link">Home</a><a href="/stocks.html" class="nav-link">Global Stock Research</a><a href="/etfs.html" class="nav-link">ETF Analyzer</a><a href="/ai-stock-screener.html" class="nav-link">Market Screener</a><a href="/rankings.html" class="nav-link">Top Picks</a><a href="/insights/" class="nav-link">Articles</a><a href="/methodology.html" class="nav-link">Methodology</a></nav><div class="locale-links" aria-label="Language"><a class="lang-switch" data-locale-route="ar" href="/ar/insights/${slug}.html">Arabic</a><a class="lang-switch" data-locale-route="en" href="/insights/${slug}.html">English</a></div><button class="mobile-menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-nav-drawer"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button></div></div></div>`;
}

function renderSidebar(articleBody, topic, ar) {
  const headings = [...String(articleBody || '').matchAll(/<h2[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/gi)]
    .slice(0, 6)
    .map((match) => `<li><a href="#${escapeHtml(match[1])}">${escapeHtml(strip(match[2]))}</a></li>`)
    .join('');
  const links = [
    [ar ? '/ar/insights/' : '/insights/', ar ? 'مكتبة المقالات' : 'Insights library'],
    [ar ? '/ar/etfs.html' : '/etfs.html', ar ? 'أبحاث الصناديق' : 'ETF research'],
    [ar ? '/ar/stocks.html' : '/stocks.html', ar ? 'أبحاث الأسهم' : 'Stock research'],
    [ar ? '/ar/rankings.html' : '/rankings.html', ar ? 'التصنيفات' : 'Rankings']
  ].map(([href, label]) => `<a href="${href}" class="related-link"><strong>${escapeHtml(label)}</strong><span>${ar ? 'مسار بحثي' : 'Research navigation'}</span></a>`).join('');
  return `<aside class="insight-sidebar"><div class="insight-toc"><h3>${ar ? 'المحتويات' : 'Contents'}</h3><ol>${headings || `<li><a href="#related-research">${ar ? 'أبحاث مرتبطة' : 'Related research'}</a></li>`}</ol></div><div class="market-panel" style="padding:20px;margin-top:20px"><span class="eyebrow" style="font-size:10px">${ar ? 'أبحاث مرتبطة' : 'Related Research'}</span><div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">${links}</div></div></aside>`;
}

function normalizeArticleBody(body, topic = {}, ar = false) {
  let out = String(body || '').trim();
  out = out.replace(/<p(?![^>]*class=)/g, '<p class="market-copy"');
  out = out.replace(/<ul(?![^>]*class=)/g, '<ul class="market-copy"');
  out = out.replace(/<footer[\s\S]*?<\/footer>/gi, (match) => `<div class="insight-disclaimer">${match.replace(/<\/?footer[^>]*>/gi, '')}</div>`);
  if (!ar && !out.includes('institutional-comparison-block')) {
    const explicit = (topic.related_etfs || [])
      .map((ticker) => String(ticker).toUpperCase())
      .filter((ticker) => ETF_KNOWN_TICKERS.has(ticker));
    const etfs = [...new Set([...explicit, ...detectEtfMentions(out)])];
    if (etfs.length >= 2) {
      const panel = buildInstitutionalComparisonPanel(etfs, loadEtfProfiles());
      if (panel) out += panel;
    }
  }
  return out || '<h2 id="research-framework">Research framework</h2><p class="market-copy">This educational research draft requires editorial content before publication.</p>';
}

function loadEtfProfiles() {
  try { return JSON.parse(fs.readFileSync(ETF_FLOW_PATH, 'utf8')).etf_profiles || {}; } catch { return {}; }
}

function detectEtfMentions(body) {
  return [...ETF_KNOWN_TICKERS]
    .map((ticker) => ({ ticker, index: String(body || '').search(new RegExp(`\\b${ticker}\\b`)) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.ticker);
}

function buildInstitutionalComparisonPanel(tickers, profiles) {
  const pair = tickers.filter((t) => profiles[t]).slice(0, 2);
  if (pair.length < 2) return '';
  const [a, b] = pair;
  const pA = profiles[a];
  const pB = profiles[b];

  const comparisonRow = (ticker, profile) => {
    const characteristics = profile.characteristics || {};
    const volatility = [characteristics.defensiveness, characteristics.cyclicality]
      .filter(Boolean)
      .join(' defensiveness / ') || 'Review historical volatility';
    const concentration = [
      profile.category?.replace(/_/g, ' '),
      characteristics.mega_cap_concentration && `concentration: ${characteristics.mega_cap_concentration}`
    ].filter(Boolean).join('; ');
    const topInfluence = Number.isFinite(characteristics.top10_weight_est_pct)
      ? `Top 10 approximately ${characteristics.top10_weight_est_pct}%`
      : 'Review current holdings concentration';
    return `<tr>
      <td>${escapeHtml(ticker)}</td>
      <td>${escapeHtml(profile.expense_ratio || 'Verify current issuer schedule')}</td>
      <td>${escapeHtml(profile.approx_holdings || 'Varies with rebalancing')}</td>
      <td>${escapeHtml(concentration || 'Review index methodology')}</td>
      <td>${escapeHtml(topInfluence)}</td>
      <td>${escapeHtml(volatility)}</td>
      <td>${escapeHtml(characteristics.liquidity_tier || 'Review current trading conditions')}</td>
    </tr>`;
  };
  const tableHtml = comparisonRow(a, pA) + comparisonRow(b, pB);

  const noteA     = pA.institutional_interpretation ? `<p class="market-copy" style="margin:10px 0 0"><strong>${escapeHtml(a)}:</strong> ${escapeHtml(pA.institutional_interpretation)}</p>` : '';
  const noteB     = pB.institutional_interpretation ? `<p class="market-copy" style="margin:8px 0 0"><strong>${escapeHtml(b)}:</strong> ${escapeHtml(pB.institutional_interpretation)}</p>` : '';
  const rateTxA   = pA.rate_transmission ? `<p class="market-copy" style="margin:8px 0 0"><strong>${escapeHtml(a)} rate channel:</strong> ${escapeHtml(pA.rate_transmission)}</p>` : '';
  const rateTxB   = pB.rate_transmission ? `<p class="market-copy" style="margin:8px 0 0"><strong>${escapeHtml(b)} rate channel:</strong> ${escapeHtml(pB.rate_transmission)}</p>` : '';
  const compNote  = (pA.comparison_note || pB.comparison_note)
    ? `<p class="market-copy" style="margin:12px 0 0;padding-top:10px;border-top:1px solid var(--border)"><strong>Structural comparison:</strong> ${escapeHtml(pA.comparison_note || pB.comparison_note || '')}</p>`
    : '';

  return `<div class="institutional-comparison-block market-panel" style="margin-top:2rem">
  <span class="eyebrow" style="font-size:10px;letter-spacing:.08em;display:block;margin-bottom:10px">Institutional Comparison: ${escapeHtml(a)} vs ${escapeHtml(b)}</span>
  <div class="editorial-table-wrap" style="overflow-x:auto"><table class="editorial-comparison-table" style="width:100%;border-collapse:collapse"><thead><tr style="border-bottom:2px solid var(--border)"><th>ETF</th><th>Expense ratio</th><th>Approx. holdings</th><th>Concentration style</th><th>Top-holdings influence</th><th>Typical volatility profile</th><th>Liquidity profile</th></tr></thead><tbody>${tableHtml}</tbody></table></div>
  ${noteA}${noteB}${rateTxA}${rateTxB}${compNote}
</div>`;
}

function extractRaw(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? match[1].trim() : '';
}

function extractText(text, pattern) {
  const match = String(text || '').match(pattern);
  return match ? strip(match[1]).trim() : '';
}

function upsert(text, pattern, replacement) {
  return pattern.test(text) ? text.replace(pattern, replacement) : `${text}\n${replacement}`;
}

function strip(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function titleFromSlug(slug) {
  return String(slug || 'editorial article').replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  ensureProductionEditorialLayout,
  hasProductionEditorialLayout,
  buildInstitutionalComparisonPanel,
  detectEtfMentions
};
