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
    return segs.length >= 2 ? '../' : '';
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
    return '<a class="research-timeline-card" href="' + esc(href(base, item.href)) + '">'
      + '<div class="research-card-top">'
      + '<span class="insight-category-badge">' + esc(item.category) + '</span>'
      + '<span class="research-signal">' + esc(item.signal || 'Updated this week') + '</span>'
      + '</div>'
      + '<h3>' + esc(item.title) + '</h3>'
      + '<p>' + esc(item.summary) + '</p>'
      + '<div class="research-meta-row">'
      + '<span>' + esc(item.readingTime || '6 min') + '</span>'
      + '<time datetime="' + esc(item.updated) + '">Updated ' + esc(item.updated) + '</time>'
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
      + '<span class="eyebrow">Latest Market Research</span>'
      + '<h2>' + esc(mode === 'featured' ? 'Featured and recent research' : 'Updated market research timeline') + '</h2>'
      + '<p>Chronological research paths across AI infrastructure, semiconductors, ETFs, and macro risk. Educational content only.</p>'
      + '</div>'
      + '<div class="research-featured-row">'
      + timelineCard(featured, base)
      + '<div class="research-timeline-list">' + rest.map(function (item) { return timelineCard(item, base); }).join('') + '</div>'
      + '</div>';
  }

  function themeCard(theme, data, base) {
    var links = (theme.links || []).slice(0, 4).map(function (link) {
      return '<a class="theme-pill" href="' + esc(href(base, link)) + '">' + esc(data.linkLabels[link] || link) + '</a>';
    }).join('');
    return '<article class="research-theme-card">'
      + '<span class="research-signal">Market Focus</span>'
      + '<h3>' + esc(theme.label) + '</h3>'
      + '<p>' + esc(theme.intro) + '</p>'
      + '<div class="theme-rail">' + links + '</div>'
      + '</article>';
  }

  function renderThemes(el, data) {
    var base = rootPfx();
    var count = Number(el.getAttribute('data-count') || 4);
    var themes = rotate(data.themes, 'themes' + window.location.pathname, count);
    if (!themes.length) return;
    el.innerHTML = '<div class="research-head">'
      + '<span class="eyebrow">Rotating Market Themes</span>'
      + '<h2>Current research themes</h2>'
      + '<p>Theme clusters connect insights, stock research, ETF education, and hub pages without relying on fabricated market data.</p>'
      + '</div>'
      + '<div class="research-theme-grid">' + themes.map(function (theme) { return themeCard(theme, data, base); }).join('') + '</div>';
  }

  function renderHighlight(el, data) {
    var base = rootPfx();
    var item = rotate(data.insights, 'highlight' + window.location.pathname, 1)[0];
    if (!item) return;
    el.innerHTML = '<div class="research-highlight">'
      + '<span class="research-signal">Research Spotlight</span>'
      + '<h3>' + esc(item.title) + '</h3>'
      + '<p>' + esc(item.summary) + '</p>'
      + '<div class="research-symbol-row">' + symbolChips(item.symbols) + '</div>'
      + '<a class="market-btn" href="' + esc(href(base, item.href)) + '">Continue reading</a>'
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
