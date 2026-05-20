/* TradeAlphaAI static research layer: timeline, market themes, deterministic rotation. */
(function () {
  'use strict';

  var fallback = {
    updatedAt: '2026-05-20',
    insights: [],
    themes: [],
    linkLabels: {}
  };

  function rootPfx() {
    var segs = (window.location.pathname || '').replace(/^\//, '').split('/').filter(Boolean);
    if (segs.length && /\.[a-z0-9]+$/i.test(segs[segs.length - 1])) segs.pop();
    return '../'.repeat(segs.length);
  }

  function isArabic() {
    return document.documentElement.lang === 'ar' || /^\/ar(?:\/|$)/.test(window.location.pathname || '');
  }

  function tr(value) {
    if (!isArabic()) return value;
    return String(value || '')
      .replace(/Latest Market Research/g, 'أحدث أبحاث السوق')
      .replace(/Featured and recent research/g, 'أبحاث مختارة وحديثة')
      .replace(/Updated market research timeline/g, 'خط زمني محدث لأبحاث السوق')
      .replace(/Chronological research paths across AI infrastructure, semiconductors, ETFs, and macro risk\. Educational content only\./g, 'مسارات بحثية مرتبة تغطي البنية التحتية للذكاء الاصطناعي وأشباه الموصلات وصناديق المؤشرات والمخاطر الكلية. محتوى تعليمي فقط.')
      .replace(/Updated this week/g, 'محدث هذا الأسبوع')
      .replace(/Updated /g, 'آخر تحديث ')
      .replace(/Rotating Market Themes/g, 'محاور السوق المتغيرة')
      .replace(/Current research themes/g, 'محاور البحث الحالية')
      .replace(/Theme clusters connect insights, stock research, ETF education, and hub pages without relying on fabricated market data\./g, 'تربط المحاور بين الرؤى وأبحاث الأسهم وتعليم صناديق المؤشرات وصفحات المحاور دون الاعتماد على بيانات سوق مصطنعة.')
      .replace(/Market Focus/g, 'تركيز السوق')
      .replace(/Research Spotlight/g, 'بحث مختار')
      .replace(/Continue reading/g, 'تابع القراءة')
      .replace(/AI Infrastructure/g, 'البنية التحتية للذكاء الاصطناعي')
      .replace(/Semiconductors/g, 'أشباه الموصلات')
      .replace(/ETF Analysis/g, 'تحليل صناديق المؤشرات')
      .replace(/Market Research/g, 'أبحاث السوق')
      .replace(/Risk & Volatility/g, 'المخاطر والتذبذب')
      .replace(/Diversification/g, 'التنويع')
      .replace(/Cloud Computing/g, 'الحوسبة السحابية')
      .replace(/Market Cycles/g, 'دورات السوق')
      .replace(/6 min/g, '6 دقائق');
  }

  function localizedHref(base, link) {
    var raw = href(base, link);
    if (!isArabic() || /^(?:https?:|mailto:|tel:|#)/.test(raw) || raw.indexOf('../') === 0) return raw;
    return raw.charAt(0) === '/' ? '/ar' + raw : base + 'ar/' + link;
  }

  function esc(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function daySeed() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function hash(value) {
    var h = 0;
    for (var i = 0; i < value.length; i += 1) h = ((h << 5) - h + value.charCodeAt(i)) | 0;
    return Math.abs(h);
  }

  function rotate(items, key, count) {
    var list = (items || []).slice();
    if (!list.length) return [];
    var offset = (hash(key || window.location.pathname) + daySeed()) % list.length;
    return list.slice(offset).concat(list.slice(0, offset)).slice(0, count || list.length);
  }

  function href(base, link) {
    if (/^(?:https?:|mailto:|tel:|#)/.test(link)) return link;
    return base + link;
  }

  function symbolChips(symbols) {
    return (symbols || []).slice(0, 5).map(function (symbol) {
      return '<span class="research-symbol">' + esc(symbol) + '</span>';
    }).join('');
  }

  function timelineCard(item, base) {
    return '<a class="research-timeline-card" href="' + esc(localizedHref(base, item.href)) + '">'
      + '<div class="research-card-top">'
      + '<span class="insight-category-badge">' + esc(tr(item.category)) + '</span>'
      + '<span class="research-signal">' + esc(tr(item.signal || 'Updated this week')) + '</span>'
      + '</div>'
      + '<h3>' + esc(tr(item.title)) + '</h3>'
      + '<p>' + esc(tr(item.summary)) + '</p>'
      + '<div class="research-meta-row">'
      + '<span>' + esc(tr(item.readingTime || '6 min')) + '</span>'
      + '<time datetime="' + esc(item.updated) + '">' + esc(tr('Updated ')) + esc(item.updated) + '</time>'
      + '</div>'
      + '<div class="research-symbol-row">' + symbolChips(item.symbols) + '</div>'
      + '</a>';
  }

  function renderTimeline(el, data) {
    var base = rootPfx();
    var mode = el.getAttribute('data-research-timeline') || 'recent';
    var count = Number(el.getAttribute('data-count') || (mode === 'featured' ? 4 : 5));
    var items = rotate(data.insights, mode + window.location.pathname, count);
    if (!items.length) return;
    var featured = items[0];
    var rest = items.slice(1);
    el.innerHTML = '<div class="research-head">'
      + '<span class="eyebrow">' + esc(tr('Latest Market Research')) + '</span>'
      + '<h2>' + esc(tr(mode === 'featured' ? 'Featured and recent research' : 'Updated market research timeline')) + '</h2>'
      + '<p>' + esc(tr('Chronological research paths across AI infrastructure, semiconductors, ETFs, and macro risk. Educational content only.')) + '</p>'
      + '</div>'
      + '<div class="research-featured-row">'
      + timelineCard(featured, base)
      + '<div class="research-timeline-list">' + rest.map(function (item) { return timelineCard(item, base); }).join('') + '</div>'
      + '</div>';
  }

  function themeCard(theme, data, base) {
    var links = (theme.links || []).slice(0, 4).map(function (link) {
      return '<a class="theme-pill" href="' + esc(localizedHref(base, link)) + '">' + esc(tr(data.linkLabels[link] || link)) + '</a>';
    }).join('');
    return '<article class="research-theme-card">'
      + '<span class="research-signal">' + esc(tr('Market Focus')) + '</span>'
      + '<h3>' + esc(tr(theme.label)) + '</h3>'
      + '<p>' + esc(tr(theme.intro)) + '</p>'
      + '<div class="theme-rail">' + links + '</div>'
      + '</article>';
  }

  function renderThemes(el, data) {
    var base = rootPfx();
    var count = Number(el.getAttribute('data-count') || 4);
    var themes = rotate(data.themes, 'themes' + window.location.pathname, count);
    if (!themes.length) return;
    el.innerHTML = '<div class="research-head">'
      + '<span class="eyebrow">' + esc(tr('Rotating Market Themes')) + '</span>'
      + '<h2>' + esc(tr('Current research themes')) + '</h2>'
      + '<p>' + esc(tr('Theme clusters connect insights, stock research, ETF education, and hub pages without relying on fabricated market data.')) + '</p>'
      + '</div>'
      + '<div class="research-theme-grid">' + themes.map(function (theme) { return themeCard(theme, data, base); }).join('') + '</div>';
  }

  function renderHighlight(el, data) {
    var base = rootPfx();
    var item = rotate(data.insights, 'highlight' + window.location.pathname, 1)[0];
    if (!item) return;
    el.innerHTML = '<div class="research-highlight">'
      + '<span class="research-signal">' + esc(tr('Research Spotlight')) + '</span>'
      + '<h3>' + esc(tr(item.title)) + '</h3>'
      + '<p>' + esc(tr(item.summary)) + '</p>'
      + '<div class="research-symbol-row">' + symbolChips(item.symbols) + '</div>'
      + '<a class="market-btn" href="' + esc(localizedHref(base, item.href)) + '">' + esc(tr('Continue reading')) + '</a>'
      + '</div>';
  }

  function renderAll(data) {
    document.querySelectorAll('[data-research-timeline]').forEach(function (el) { renderTimeline(el, data); });
    document.querySelectorAll('[data-research-themes]').forEach(function (el) { renderThemes(el, data); });
    document.querySelectorAll('[data-research-highlight]').forEach(function (el) { renderHighlight(el, data); });
  }

  function init() {
    var base = rootPfx();
    fetch(base + 'data/research-layer.json', { cache: 'no-store' })
      .then(function (res) { return res.ok ? res.json() : fallback; })
      .then(renderAll)
      .catch(function () { renderAll(fallback); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
