/**
 * visual-intelligence.js — Phase 68 Part D
 *
 * Client-side renderer for market intelligence dashboards.
 * Loads static JSON from /data/visual/ and renders:
 *   - Regime gauge cards with SVG arc gauges
 *   - Cross-asset impact grid
 *   - Sector rotation heatmap
 *   - Yield curve / rate path panels
 *   - Volatility dashboard with VIX display
 *   - ETF relationship map
 *   - Latest market outlook links
 *
 * No external libraries. Works in desktop, mobile Safari/Chrome,
 * and Telegram in-app browser.
 */

(function () {
  'use strict';

  var LOCALE        = window.DASHBOARD_LOCALE || 'en';
  var AR            = LOCALE === 'ar';
  var BASE_DATA_URL = '/data/visual/';
  var QUEUE_URL     = '/data/market-outlook-queue.json';

  // ── Bootstrap ───────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Kick off all fetches in parallel
    var fetches = [
      fetchJson(BASE_DATA_URL + 'regime-gauge.json').then(renderRegimeGauge),
      fetchJson(BASE_DATA_URL + 'cross-asset-impact-map.json').then(renderCrossAsset),
      fetchJson(BASE_DATA_URL + 'sector-rotation-map.json').then(renderSectorRotation),
      fetchJson(BASE_DATA_URL + 'yield-curve-context.json').then(renderYieldCurve),
      fetchJson(BASE_DATA_URL + 'volatility-dashboard.json').then(renderVolatility),
      fetchJson(BASE_DATA_URL + 'etf-relationship-map.json').then(renderEtfMap),
      fetchJson(QUEUE_URL).then(renderOutlookLinks),
    ];

    Promise.allSettled(fetches).then(function (results) {
      results.forEach(function (r) {
        if (r.status === 'rejected') console.warn('[visual-intelligence] fetch error:', r.reason);
      });
    });

    initReadingProgress();
  });

  // ── Regime gauge renderer ────────────────────────────────────────────────────

  function renderRegimeGauge(data) {
    if (!data) return;

    var headline = AR ? data.headline_ar : data.headline_en;
    setText('dashboard-headline', headline || '');

    var dqBadge = qs('#dashboard-meta .data-quality-badge');
    if (dqBadge) {
      dqBadge.setAttribute('data-quality', data.data_quality || 'structural');
      dqBadge.textContent = dqLabel(data.data_quality);
    }

    var freshEl = id('data-freshness');
    if (freshEl && data.freshness_score != null) {
      freshEl.textContent = (AR ? 'الحداثة: ' : 'Freshness: ') + data.freshness_score + '%';
    }

    var container = id('regime-gauge-grid');
    if (!container) return;

    var gauges = data.gauges || {};
    var LABELS_EN = {
      risk_appetite:     'Risk Appetite',
      volatility_regime: 'Volatility',
      rate_path:         'Rate Path',
      growth_regime:     'Growth',
      inflation_regime:  'Inflation',
      dollar_regime:     'Dollar',
      duration_regime:   'Duration',
    };
    var LABELS_AR = {
      risk_appetite:     'شهية المخاطرة',
      volatility_regime: 'التقلب',
      rate_path:         'مسار الفائدة',
      growth_regime:     'النمو',
      inflation_regime:  'التضخم',
      dollar_regime:     'الدولار',
      duration_regime:   'المدة',
    };

    var html = '';
    Object.keys(LABELS_EN).forEach(function (key) {
      var g = gauges[key];
      if (!g) return;
      var label    = AR ? LABELS_AR[key] : LABELS_EN[key];
      var value    = AR ? (g.label_ar || g.label) : g.label;
      var reason   = AR ? g.reason_ar : g.reason_en;
      var conf     = g.confidence || 0;
      var color    = gaugeColor(g.label);
      var arcHtml  = renderArcGauge(g.value || 50, color);

      html += '<div class="regime-gauge-card vi-card" role="listitem" title="' + escHtml(reason) + '">'
        + '<span class="regime-gauge-card__label vi-card__label">' + escHtml(label) + '</span>'
        + arcHtml
        + '<strong class="regime-gauge-card__value vi-card__value">' + escHtml(value.replace(/_/g, ' ')) + '</strong>'
        + '<div class="vi-confidence-bar" title="' + conf + '% confidence">'
        +   '<div class="vi-confidence-bar__fill" style="width:' + conf + '%"></div>'
        + '</div>'
        + '<span class="vi-card__confidence">' + conf + '% ' + (AR ? 'ثقة' : 'confidence') + '</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  function renderArcGauge(value, color) {
    var R = 30, CX = 40, CY = 38;
    var startAngle = -180, sweep = 180;
    var circumference = Math.PI * R;
    var fillRatio = Math.max(0, Math.min(1, value / 100));
    var dashOffset = circumference * (1 - fillRatio);

    var bgPath = describeArc(CX, CY, R, -180, 0);
    var fgPath = describeArc(CX, CY, R, -180, 0);

    return '<svg class="vi-arc-gauge" viewBox="0 0 80 42" aria-hidden="true">'
      + '<path class="vi-arc-gauge__bg" d="' + fgPath + '" />'
      + '<path class="vi-arc-gauge__fill" d="' + fgPath + '"'
      +   ' stroke="' + color + '"'
      +   ' stroke-dasharray="' + circumference + '"'
      +   ' stroke-dashoffset="' + dashOffset + '"'
      + ' />'
      + '<text class="vi-arc-gauge__label" x="' + CX + '" y="' + (CY + 2) + '" fill="' + color + '">'
      +   value
      + '</text>'
      + '</svg>';
  }

  function describeArc(cx, cy, r, startDeg, endDeg) {
    var s = polarToCartesian(cx, cy, r, startDeg);
    var e = polarToCartesian(cx, cy, r, endDeg);
    return 'M ' + s.x + ' ' + s.y + ' A ' + r + ' ' + r + ' 0 0 1 ' + e.x + ' ' + e.y;
  }

  function polarToCartesian(cx, cy, r, deg) {
    var rad = (deg - 90) * Math.PI / 180;
    return { x: +(cx + r * Math.cos(rad)).toFixed(2), y: +(cy + r * Math.sin(rad)).toFixed(2) };
  }

  function gaugeColor(label) {
    var map = {
      risk_on: '#4ade80', growth_resilience: '#4ade80', volatility_compression: '#4ade80',
      disinflation: '#6ee7d8', hold_bias: '#6ee7d8', duration_supportive: '#6ee7d8',
      neutral: '#94a3b8', uncertain: '#475569',
      risk_off: '#ef4444', growth_slowdown: '#f59e0b', volatility_expansion: '#f59e0b',
      inflation_pressure: '#fb923c', rate_hike_bias: '#fb923c',
      rate_cut_bias: '#6ee7d8', dollar_strength: '#f59e0b', dollar_weakness: '#6ee7d8',
      duration_pressure: '#ef4444',
    };
    return map[label] || '#94a3b8';
  }

  // ── Cross-asset renderer ─────────────────────────────────────────────────────

  function renderCrossAsset(data) {
    if (!data) return;

    var grid = id('cross-asset-grid');
    if (grid) {
      var html = '';
      (data.assets || []).forEach(function (a) {
        var name    = AR ? a.name_ar : a.name;
        var change  = a.change_pct;
        var changeCls = change > 0 ? 'pos' : change < 0 ? 'neg' : 'neu';
        var changeStr = change != null ? (change > 0 ? '+' : '') + change.toFixed(2) + '%' : '—';

        html += '<div class="ca-card vi-card" data-trend="' + escHtml(a.trend) + '" role="listitem">'
          + '<span class="ca-card__name">' + escHtml(name) + '</span>'
          + '<span class="ca-card__trend">' + escHtml(trendLabel(a.trend)) + '</span>'
          + '<span class="ca-card__change ' + changeCls + '">' + changeStr + '</span>'
          + '</div>';
      });
      grid.innerHTML = html;
    }

    var chainList = id('chain-list');
    if (chainList && data.transmission_chains) {
      var chainHtml = '';
      data.transmission_chains.slice(0, 5).forEach(function (chain) {
        var trigger = AR ? chain.trigger_ar : chain.trigger;
        chainHtml += '<div class="chain-item">'
          + '<span class="chain-item__trigger">' + escHtml(trigger) + '</span>'
          + '<div class="chain-item__links">';
        chain.chain.forEach(function (link, i) {
          if (i > 0) chainHtml += '<span class="chain-arrow">→</span>';
          var dirCls = /up|bull|rise|strength/.test(link.direction) ? 'direction-up'
                     : /down|bear|fall|weak/.test(link.direction) ? 'direction-down' : '';
          chainHtml += '<span class="chain-link ' + dirCls + '" title="' + escHtml(link.reason) + '">'
            + escHtml(link.asset) + '</span>';
        });
        chainHtml += '</div></div>';
      });
      chainList.innerHTML = chainHtml || (AR ? 'لا توجد سلاسل انتقال متاحة' : 'No transmission chains available.');
    }
  }

  function trendLabel(trend) {
    var map = {
      'strong-uptrend':    AR ? '↑↑ صعود قوي' : '↑↑ Strong uptrend',
      'uptrend':           AR ? '↑ صعود'       : '↑ Uptrend',
      'flat':              AR ? '→ مستقر'      : '→ Flat',
      'downtrend':         AR ? '↓ هبوط'       : '↓ Downtrend',
      'strong-downtrend':  AR ? '↓↓ هبوط قوي'  : '↓↓ Strong downtrend',
      'unverified':        AR ? 'غير مؤكد'      : 'Unverified',
    };
    return map[trend] || trend;
  }

  // ── Sector rotation renderer ─────────────────────────────────────────────────

  function renderSectorRotation(data) {
    if (!data) return;

    var container = id('sector-heatmap');
    if (!container) return;

    var html = '';
    (data.sectors || []).forEach(function (s) {
      var name = AR ? s.name_ar : s.name_en;
      var mLabel = momentumLabel(s.momentum);
      html += '<div class="sector-card" data-momentum="' + escHtml(s.momentum) + '" role="listitem">'
        + '<span class="sector-card__name">' + escHtml(name) + '</span>'
        + '<span class="sector-card__etf">' + escHtml(s.etf) + '</span>'
        + '<span class="sector-card__momentum">' + escHtml(mLabel) + '</span>'
        + '</div>';
    });
    container.innerHTML = html;
  }

  function momentumLabel(m) {
    var map = {
      leading:       AR ? 'قائد' : 'Leading',
      'rotating-in': AR ? 'دوران داخل' : 'Rotating in',
      neutral:       AR ? 'محايد' : 'Neutral',
      'rotating-out':AR ? 'دوران خارج' : 'Rotating out',
      lagging:       AR ? 'متأخر' : 'Lagging',
      unverified:    AR ? 'غير مؤكد' : 'Unverified',
    };
    return map[m] || m;
  }

  // ── Yield curve renderer ─────────────────────────────────────────────────────

  function renderYieldCurve(data) {
    if (!data) return;

    var stateCard = id('yield-state-card');
    if (stateCard) {
      var curveState = AR ? data.curve.state_ar : data.curve.state;
      var spread     = data.curve.spread_bps;
      var us10y      = data.curve.us10y;
      stateCard.innerHTML = '<div class="yield-card-label">' + (AR ? 'حالة منحنى العائد' : 'Yield Curve State') + '</div>'
        + '<div class="yield-card-value">' + escHtml(curveState || '—') + '</div>'
        + (spread != null ? '<div class="yield-card-narrative">2Y/10Y: ' + spread + ' bps</div>' : '')
        + (us10y  != null ? '<div class="yield-card-narrative">10Y: ' + us10y.toFixed(2) + '%</div>' : '')
        + '<div class="yield-card-narrative" style="margin-top:10px">' + escHtml(truncate(data.curve.narrative || '', 200)) + '</div>';
    }

    var fedCard = id('fed-path-card');
    if (fedCard && data.fed_path) {
      var fp = data.fed_path;
      var biasLabel = AR ? fp.bias_ar : fp.bias;
      var probRows = [
        { label: AR ? 'ثبات'  : 'Hold', pct: fp.hold_pct },
        { label: AR ? 'خفض'   : 'Cut',  pct: fp.cut_pct  },
        { label: AR ? 'رفع'   : 'Hike', pct: fp.hike_pct },
      ];
      var probHtml = probRows.map(function (row) {
        if (row.pct == null) return '';
        return '<div class="prob-bar-row">'
          + '<span class="prob-bar-label">' + escHtml(row.label) + '</span>'
          + '<div class="prob-bar-track"><div class="prob-bar-fill" style="width:' + Math.min(100, row.pct) + '%"></div></div>'
          + '<span class="prob-bar-pct">' + row.pct + '%</span>'
          + '</div>';
      }).join('');

      fedCard.innerHTML = '<div class="yield-card-label">' + (AR ? 'مسار الاحتياطي الفيدرالي' : 'Fed Rate Path') + '</div>'
        + '<div class="yield-card-value">' + escHtml(biasLabel || '—') + '</div>'
        + probHtml
        + '<div class="yield-card-narrative" style="margin-top:8px">' + escHtml(truncate(fp.narrative || '', 180)) + '</div>';
    }

    var durCard = id('duration-sensitivity-card');
    if (durCard && data.duration_sensitivity) {
      var durRows = data.duration_sensitivity.slice(0, 6).map(function (d) {
        return '<div class="duration-row">'
          + '<span class="duration-asset">' + escHtml(d.asset) + '</span>'
          + '<span class="duration-sens">' + escHtml(AR ? d.direction_ar : d.sensitivity) + '</span>'
          + '</div>';
      }).join('');
      durCard.innerHTML = '<div class="yield-card-label">' + (AR ? 'حساسية المدة' : 'Duration Sensitivity') + '</div>'
        + durRows;
    }
  }

  // ── Volatility renderer ──────────────────────────────────────────────────────

  function renderVolatility(data) {
    if (!data) return;

    var gaugeContainer = id('vix-gauge-container');
    if (gaugeContainer) {
      var vix = data.vix || {};
      var level     = vix.level;
      var regime    = vix.regime || 'unknown';
      var regimeAr  = vix.regime_ar || regime;
      var regimeLbl = AR ? regimeAr : regime;
      var cls       = vixClass(regime);

      var bands = (data.vix_zone_bands || []).map(function (b) {
        var active = level != null && level >= b.min && level <= b.max;
        var colorCls = 'vix-zone-' + b.color;
        return '<div class="vix-zone-segment ' + colorCls + ' ' + (active ? 'active' : 'inactive') + '" title="' + escHtml(AR ? b.label_ar : b.label_en) + '"></div>';
      }).join('');

      gaugeContainer.innerHTML =
          '<div class="vix-regime-label">' + (AR ? 'مؤشر VIX' : 'VIX Index') + '</div>'
        + '<div class="vix-number ' + cls + '">' + (level != null ? level.toFixed(1) : '—') + '</div>'
        + '<div class="vix-regime-label">' + escHtml(regimeLbl) + '</div>'
        + '<div class="vix-zone-bar">' + bands + '</div>';
    }

    var detailCard = id('vol-regime-detail');
    if (detailCard) {
      var vr = data.volatility_regime || {};
      var vrLabel = AR ? vr.label_ar : vr.label;
      var vrReason = AR ? vr.reason_ar : vr.reason_en;
      var historical = AR ? data.historical_context_ar : data.historical_context_en;
      detailCard.innerHTML =
          '<div class="vol-regime-title">' + escHtml(vrLabel || 'Unverified') + ' (' + (vr.confidence || 0) + '%)</div>'
        + '<div class="vol-regime-reason">' + escHtml(vrReason || '') + '</div>'
        + '<div class="vol-historical">' + escHtml(historical || '') + '</div>';
    }
  }

  function vixClass(regime) {
    var map = { complacency: 'vix-calm', calm: 'vix-calm', elevated: 'vix-elevated',
                high: 'vix-high', extreme: 'vix-extreme' };
    return map[regime] || 'vix-unknown';
  }

  // ── ETF map renderer ─────────────────────────────────────────────────────────

  function renderEtfMap(data) {
    if (!data) return;

    var grid = id('etf-grid');
    if (grid) {
      var html = '';
      (data.nodes || []).forEach(function (n) {
        var name  = AR ? n.name_ar : n.name_en;
        var flow  = AR ? n.flow_ar : (n.flow_signal || 'unverified');
        var trend = trendLabel(n.trend);
        html += '<div class="etf-card vi-card" role="listitem">'
          + '<span class="etf-card__ticker">' + escHtml(n.id) + '</span>'
          + '<span class="etf-card__name">' + escHtml(name) + '</span>'
          + '<span class="etf-card__trend">' + escHtml(trend) + '</span>'
          + '<span class="etf-card__flow">' + (AR ? 'تدفق: ' : 'Flow: ') + escHtml(flow) + '</span>'
          + '</div>';
      });
      grid.innerHTML = html;
    }

    var relList = id('relationship-list');
    if (relList && data.relationships) {
      var rHtml = '';
      data.relationships.forEach(function (r) {
        var desc = AR ? r.description_ar : r.description_en;
        rHtml += '<div class="rel-item">'
          + '<span class="rel-item__pair">' + escHtml(r.from) + ' → ' + escHtml(r.to) + '</span>'
          + '<span class="rel-item__type">' + escHtml(r.type) + '</span>'
          + '<span class="rel-item__desc">' + escHtml(desc) + '</span>'
          + '</div>';
      });
      relList.innerHTML = rHtml || (AR ? 'لا توجد بيانات' : 'No data.');
    }
  }

  // ── Outlook links renderer ───────────────────────────────────────────────────

  function renderOutlookLinks(queue) {
    var container = id('outlook-links');
    if (!container || !queue) return;

    var published = (queue.topics || []).filter(function (t) { return t.status === 'published'; });
    var recent    = published.slice(-4).reverse();

    if (!recent.length) {
      container.innerHTML = '<p class="market-copy">' + (AR ? 'لا توجد تقارير منشورة بعد.' : 'No published reports yet.') + '</p>';
      return;
    }

    var baseUrl = AR ? '/ar/market-outlook/' : '/market-outlook/';
    var html = '';
    recent.forEach(function (t) {
      var title  = AR ? (t.title_ar || t.title_en || t.title || t.slug)
                      : (t.title_en || t.title    || t.slug);
      var date   = (t.target_publish_date || t.publish_date || '').slice(0, 10);
      var href   = baseUrl + t.slug + '.html';
      html += '<a href="' + escHtml(href) + '" class="outlook-link-card">'
        + '<span class="outlook-link-card__date">' + escHtml(date) + '</span>'
        + '<span class="outlook-link-card__title">' + escHtml(title) + '</span>'
        + '</a>';
    });
    container.innerHTML = html;
  }

  // ── Reading progress ─────────────────────────────────────────────────────────

  function initReadingProgress() {
    var bar   = qs('.reading-progress span');
    var shell = qs('.dashboard-shell') || qs('main');
    if (!bar || !shell) return;
    function update() {
      var rect  = shell.getBoundingClientRect();
      var total = shell.offsetHeight - window.innerHeight;
      if (total <= 0) { bar.style.width = '100%'; return; }
      var pct = Math.min(100, Math.max(0, Math.round((-rect.top / total) * 100)));
      bar.style.width = pct + '%';
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ── Utilities ────────────────────────────────────────────────────────────────

  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return r.json();
    });
  }

  function id(elId)       { return document.getElementById(elId); }
  function qs(sel)        { return document.querySelector(sel); }
  function setText(elId, text) { var el = id(elId); if (el) el.textContent = text; }

  function dqLabel(q) {
    if (AR) {
      var map = { live: 'بيانات مباشرة', cached: 'بيانات مخزنة', structural: 'هيكلي', none: 'غير متاح' };
      return map[q] || q;
    }
    var map = { live: 'Live data', cached: 'Cached data', structural: 'Structural', none: 'Unavailable' };
    return map[q] || q;
  }

  function truncate(str, max) {
    if (!str || str.length <= max) return str;
    return str.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

}());
