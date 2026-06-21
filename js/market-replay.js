(function () {
  'use strict';

  var HISTORY_URL    = '/data/intelligence/historical-memory.json';
  var CONTINUITY_URL = '/data/intelligence/narrative-continuity.json';
  var locale         = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var ar             = locale === 'ar';

  var LABEL = {
    loading:         ar ? 'جارٍ التحميل…'          : 'Loading…',
    noData:          ar ? 'لا توجد بيانات تاريخية'  : 'No historical data available',
    latestSnapshot:  ar ? 'أحدث لقطة'               : 'Latest Snapshot',
    marketTone:      ar ? 'نبرة السوق'               : 'Market Tone',
    volatility:      ar ? 'التذبذب'                  : 'Volatility',
    ratePath:        ar ? 'مسار الفائدة'              : 'Rate Path',
    yieldCurve:      ar ? 'منحنى العائد'             : 'Yield Curve',
    confidence:      ar ? 'الثقة'                    : 'Confidence',
    dataQuality:     ar ? 'جودة البيانات'            : 'Data Quality',
    sectorLeaders:   ar ? 'القطاعات الرائدة'         : 'Sector Leaders',
    narratives:      ar ? 'الروايات السائدة'          : 'Dominant Narratives',
    timeline:        ar ? 'الجدول الزمني للسوق'      : 'Market Timeline',
    insights:        ar ? 'رؤى الاستمرارية'          : 'Continuity Insights',
    noInsights:      ar ? 'لا توجد رؤى حالياً'       : 'No insights available yet',
    confidenceTrend: ar ? 'اتجاه الثقة'              : 'Confidence Trend',
    regimeStability: ar ? 'استقرار النظام'            : 'Regime Stability',
    snapshotCount:   ar ? 'عدد اللقطات'              : 'Snapshot Count',
  };

  function fetchJSON(url, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      try {
        cb(null, JSON.parse(xhr.responseText));
      } catch (e) {
        cb(e, null);
      }
    };
    xhr.onerror = function () { cb(new Error('network'), null); };
    xhr.send();
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setHtml(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  function pill(value) {
    if (!value || value === 'unknown' || value === 'unverified' || value === 'uncertain') {
      return '<span class="replay-pill replay-pill--unknown">' + esc(value || 'unknown') + '</span>';
    }
    return '<span class="replay-pill">' + esc(String(value).replace(/_/g, ' ')) + '</span>';
  }

  function confBar(pct) {
    var p   = Math.max(0, Math.min(100, pct || 0));
    var cls = p >= 70 ? 'high' : p >= 45 ? 'medium' : 'low';
    return '<div class="replay-conf-bar" aria-label="' + esc(LABEL.confidence) + ' ' + p + '%">' +
           '<div class="replay-conf-fill replay-conf-fill--' + cls + '" style="width:' + p + '%"></div>' +
           '</div><span class="replay-conf-value">' + p + '%</span>';
  }

  function renderLatestSnapshot(snap) {
    if (!snap) return '<p class="replay-empty">' + esc(LABEL.noData) + '</p>';
    var sectors   = (snap.sector_leadership || []).map(function (s) { return pill(s); }).join(' ') || pill('none');
    var narratives = (snap.dominant_narratives || []).map(function (n) {
      return '<li class="replay-narrative-item">' + esc(n) + '</li>';
    }).join('') || '<li>' + esc(LABEL.noData) + '</li>';

    return '<div class="replay-latest-grid">' +
      '<div class="replay-stat-card"><span class="replay-stat-label">' + esc(LABEL.marketTone) + '</span>' + pill(snap.market_tone) + '</div>' +
      '<div class="replay-stat-card"><span class="replay-stat-label">' + esc(LABEL.volatility) + '</span>' + pill(snap.volatility_state) + '</div>' +
      '<div class="replay-stat-card"><span class="replay-stat-label">' + esc(LABEL.ratePath) + '</span>' + pill(snap.rate_path) + '</div>' +
      '<div class="replay-stat-card"><span class="replay-stat-label">' + esc(LABEL.yieldCurve) + '</span>' + pill(snap.yield_curve_state) + '</div>' +
      '<div class="replay-stat-card replay-stat-card--wide"><span class="replay-stat-label">' + esc(LABEL.confidence) + '</span>' + confBar(snap.confidence) + '</div>' +
      '<div class="replay-stat-card"><span class="replay-stat-label">' + esc(LABEL.dataQuality) + '</span>' + pill(snap.data_quality) + '</div>' +
    '</div>' +
    '<div class="replay-sector-row"><span class="replay-stat-label">' + esc(LABEL.sectorLeaders) + ':</span> ' + sectors + '</div>' +
    '<ul class="replay-narratives-list">' + narratives + '</ul>';
  }

  function renderTimeline(snapshots) {
    if (!snapshots || !snapshots.length) {
      return '<p class="replay-empty">' + esc(LABEL.noData) + '</p>';
    }
    var items = snapshots.slice().reverse().slice(0, 60).map(function (snap) {
      var tone = snap.market_tone || 'unknown';
      var cls  = tone === 'risk_on'  ? 'timeline-dot--positive' :
                 tone === 'risk_off' ? 'timeline-dot--negative' :
                 tone === 'neutral'  ? 'timeline-dot--neutral'  : 'timeline-dot--unknown';
      return '<li class="replay-timeline-item">' +
        '<span class="replay-timeline-dot ' + cls + '" aria-hidden="true"></span>' +
        '<span class="replay-timeline-date">' + esc(snap.date) + '</span>' +
        '<span class="replay-timeline-tone">' + esc(String(tone).replace(/_/g, ' ')) + '</span>' +
        '<span class="replay-timeline-vol">' + esc(String(snap.volatility_state || '—').replace(/_/g, ' ')) + '</span>' +
        '<span class="replay-timeline-conf">' + (snap.confidence || 0) + '%</span>' +
      '</li>';
    }).join('');

    return '<div class="replay-timeline-header">' +
      '<span>' + esc(ar ? 'التاريخ' : 'Date') + '</span>' +
      '<span>' + esc(LABEL.marketTone) + '</span>' +
      '<span>' + esc(LABEL.volatility) + '</span>' +
      '<span>' + esc(LABEL.confidence) + '</span>' +
    '</div>' +
    '<ul class="replay-timeline-list">' + items + '</ul>';
  }

  function renderInsights(insights, summary) {
    var summaryHtml = '';
    if (summary) {
      summaryHtml =
        '<div class="replay-summary-row">' +
        '<span class="replay-stat-label">' + esc(LABEL.regimeStability) + ':</span> ' + pill(summary.regime_stability) +
        ' &nbsp; <span class="replay-stat-label">' + esc(LABEL.confidenceTrend) + ':</span> ' + pill(summary.confidence_trend) +
        '</div>' +
        (summary.headline_en && !ar ? '<p class="replay-summary-headline">' + esc(summary.headline_en) + '</p>' : '') +
        (summary.headline_ar &&  ar ? '<p class="replay-summary-headline">' + esc(summary.headline_ar) + '</p>' : '');
    }

    if (!insights || !insights.length) {
      return summaryHtml + '<p class="replay-empty">' + esc(LABEL.noInsights) + '</p>';
    }

    var cards = insights.map(function (i) {
      var text = ar ? (i.reason_ar || i.reason_en || '') : (i.reason_en || '');
      return '<article class="replay-insight-card replay-insight--' + esc(i.type || 'info') + '">' +
        '<span class="replay-insight-type">' + esc(String(i.type || 'insight').replace(/_/g, ' ')) + '</span>' +
        '<p class="replay-insight-text">' + esc(text) + '</p>' +
        (typeof i.confidence === 'number' ? '<span class="replay-insight-conf">' + esc(LABEL.confidence) + ': ' + i.confidence + '%</span>' : '') +
      '</article>';
    }).join('');

    return summaryHtml + '<div class="replay-insights-grid">' + cards + '</div>';
  }

  function renderStats(history, continuity) {
    var snaps = history?.total_snapshots || 0;
    var range = history?.date_range ? (history.date_range.from + ' → ' + history.date_range.to) : '—';
    var trend = continuity?.confidence_trend?.direction || '—';
    return '<div class="replay-stats-row">' +
      '<div class="replay-stat-badge"><strong>' + snaps + '</strong><span>' + esc(LABEL.snapshotCount) + '</span></div>' +
      '<div class="replay-stat-badge"><strong>' + esc(range) + '</strong><span>' + esc(ar ? 'النطاق الزمني' : 'Date Range') + '</span></div>' +
      '<div class="replay-stat-badge"><strong>' + esc(String(trend).replace(/_/g, ' ')) + '</strong><span>' + esc(LABEL.confidenceTrend) + '</span></div>' +
    '</div>';
  }

  function setLoading(id) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = '<p class="replay-loading">' + esc(LABEL.loading) + '</p>';
  }

  function init() {
    ['replay-latest', 'replay-timeline', 'replay-insights', 'replay-stats'].forEach(setLoading);

    fetchJSON(HISTORY_URL, function (errH, history) {
      fetchJSON(CONTINUITY_URL, function (errC, continuity) {
        var snapshots = (!errH && history && Array.isArray(history.snapshots)) ? history.snapshots : [];
        var latest    = snapshots[snapshots.length - 1] || null;
        var insights  = (!errC && continuity && Array.isArray(continuity.insights)) ? continuity.insights : [];
        var summary   = (!errC && continuity) ? continuity.summary : null;

        setHtml('replay-stats',    renderStats(history, continuity));
        setHtml('replay-latest',   renderLatestSnapshot(latest));
        setHtml('replay-timeline', renderTimeline(snapshots));
        setHtml('replay-insights', renderInsights(insights, summary));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
