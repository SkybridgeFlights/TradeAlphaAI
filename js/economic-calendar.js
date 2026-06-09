(function () {
  'use strict';

  // ── i18n ──────────────────────────────────────────────────────────────────
  var T = {
    en: {
      today: 'Today', tomorrow: 'Tomorrow', thisWeek: 'This Week',
      allImpact: 'All Impact', allCountries: 'All Countries', search: 'Search events…',
      colTime: 'Time (ET)', colCountry: 'Country', colEvent: 'Event',
      colImpact: 'Impact', colActual: 'Actual', colForecast: 'Forecast', colPrevious: 'Previous',
      noEvents: 'No events found for this period.',
      loading: 'Loading calendar…',
      high: 'High', medium: 'Medium', low: 'Low',
      srcLive: 'Live data', srcCache: 'Cached data', srcDegraded: 'Provider unavailable',
      labelSrc: 'Source', labelUpdated: 'Updated',
      detailCountry: 'Country / Currency',
      detailActual: 'Actual', detailForecast: 'Forecast', detailPrevious: 'Previous',
      detailAssets: 'Asset sensitivity',
      disclaimer: 'Economic calendar information only. Not financial advice.',
    },
    ar: {
      today: 'اليوم',
      tomorrow: 'غداً',
      thisWeek: 'هذا الأسبوع',
      allImpact: 'كل التأثيرات',
      allCountries: 'كل الدول',
      search: 'ابحث عن أحداث…',
      colTime: 'الوقت (ET)',
      colCountry: 'الدولة',
      colEvent: 'الحدث',
      colImpact: 'التأثير',
      colActual: 'الفعلي',
      colForecast: 'التوقع',
      colPrevious: 'السابق',
      noEvents: 'لا توجد أحداث لهذه الفترة.',
      loading: 'جارٍ التحميل…',
      high: 'مرتفع', medium: 'متوسط', low: 'منخفض',
      srcLive: 'بيانات حية',
      srcCache: 'بيانات مخزنة',
      srcDegraded: 'المزود غير متاح',
      labelSrc: 'المصدر', labelUpdated: 'آخر تحديث',
      detailCountry: 'الدولة / العملة',
      detailActual: 'الفعلي',
      detailForecast: 'التوقع',
      detailPrevious: 'السابق',
      detailAssets: 'حساسية الأصول',
      disclaimer: 'معلومات التقويم الاقتصادي فقط. لا تمثل نصيحة مالية.',
    }
  };

  var lang  = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var L     = T[lang];
  var isRTL = document.documentElement.dir === 'rtl';

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elPrev          = document.getElementById('ec-prev');
  var elNext          = document.getElementById('ec-next');
  var elToday         = document.getElementById('ec-today');
  var elTomorrow      = document.getElementById('ec-tomorrow');
  var elWeek          = document.getElementById('ec-week');
  var elDatePicker    = document.getElementById('ec-date-picker');
  var elFilterImpact  = document.getElementById('ec-filter-impact');
  var elFilterCountry = document.getElementById('ec-filter-country');
  var elSearch        = document.getElementById('ec-search');
  var elTableWrap     = document.getElementById('ec-table-wrap');
  var elStatus        = document.getElementById('ec-status');

  if (!elTableWrap) return; // section not present on this page

  // ── State ─────────────────────────────────────────────────────────────────
  var allEvents     = [];
  var calMeta       = {};
  var selectedDate  = todayStr();
  var viewMode      = 'day'; // 'day' | 'week'
  var filterImpact  = '';
  var filterCountry = '';
  var searchText    = '';

  // ── Date utilities ────────────────────────────────────────────────────────
  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(d, n) {
    var dt = new Date(d + 'T00:00:00');
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  }

  function weekStart(d) {
    var dt = new Date(d + 'T00:00:00');
    dt.setDate(dt.getDate() - dt.getDay());
    return dt.toISOString().slice(0, 10);
  }

  function weekEnd(d) { return addDays(weekStart(d), 6); }

  function fmtTime(dtStr) {
    if (!dtStr) return '—';
    try {
      return new Date(dtStr).toLocaleString('en-US', {
        hour: '2-digit', minute: '2-digit',
        timeZone: 'America/New_York', hour12: false
      }) + ' ET';
    } catch (_) { return String(dtStr).slice(11, 16); }
  }

  function fmtDateLabel(d) {
    try {
      return new Date(d + 'T12:00:00Z').toLocaleDateString(
        lang === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }
      );
    } catch (_) { return d; }
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function numVal(n, unit) {
    if (n === null || n === undefined || n === '') return '—';
    return esc(String(n)) + (unit ? ' ' + esc(unit) : '');
  }

  function countryCurrency(country) {
    var map = {
      US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY',
      CN: 'CNY', CA: 'CAD', AU: 'AUD', CH: 'CHF',
      DE: 'EUR', FR: 'EUR', IT: 'EUR', NZ: 'NZD'
    };
    var c = String(country || '').toUpperCase();
    return map[c] ? c + ' \xB7 ' + map[c] : c || '—';
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  function eventsForPeriod() {
    var from, to;
    if (viewMode === 'week') {
      from = weekStart(selectedDate);
      to   = weekEnd(selectedDate);
    } else {
      from = to = selectedDate;
    }
    return allEvents.filter(function (e) {
      var d = String(e.event_time || e.date || '').slice(0, 10);
      if (d < from || d > to) return false;
      if (filterImpact  && e.importance !== filterImpact)  return false;
      if (filterCountry && e.country    !== filterCountry) return false;
      if (searchText) {
        var nm = String(e.event_name || '').toLowerCase();
        if (!nm.includes(searchText.toLowerCase())) return false;
      }
      return true;
    });
  }

  // ── Country dropdown ──────────────────────────────────────────────────────
  function populateCountries() {
    if (!elFilterCountry) return;
    var seen = {};
    allEvents.forEach(function (e) { if (e.country) seen[e.country] = true; });
    var countries = Object.keys(seen).sort();
    while (elFilterCountry.options.length > 1) elFilterCountry.remove(1);
    countries.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      elFilterCountry.appendChild(o);
    });
  }

  // ── Badge HTML ────────────────────────────────────────────────────────────
  function badgeHtml(imp) {
    var cls = imp === 'high' ? 'ec-badge-high' : imp === 'medium' ? 'ec-badge-medium' : 'ec-badge-low';
    return '<span class="ec-badge ' + cls + '">' + esc(L[imp] || imp || '') + '</span>';
  }

  // ── Detail content ────────────────────────────────────────────────────────
  function detailContent(e) {
    var assets = Array.isArray(e.historical_asset_sensitivity) ? e.historical_asset_sensitivity : [];
    var tags   = assets.map(function (a) {
      return '<span class="ec-asset-tag">' + esc(a) + '</span>';
    }).join('');

    var html = '<dt>' + esc(L.detailCountry) + '</dt><dd>' + esc(countryCurrency(e.country)) + '</dd>';
    html    += '<dt>' + esc(L.detailActual)   + '</dt><dd>' + numVal(e.actual,   e.unit) + '</dd>';
    html    += '<dt>' + esc(L.detailForecast) + '</dt><dd>' + numVal(e.forecast, e.unit) + '</dd>';
    html    += '<dt>' + esc(L.detailPrevious) + '</dt><dd>' + numVal(e.previous, e.unit) + '</dd>';

    var out = '<dl>' + html + '</dl>';
    if (tags) {
      out += '<div class="ec-detail-assets">'
          +  '<dt>' + esc(L.detailAssets) + '</dt>'
          +  '<div class="ec-asset-tags">' + tags + '</div>'
          +  '</div>';
    }
    out += '<p class="ec-detail-disclaimer">' + esc(L.disclaimer) + '</p>';
    return out;
  }

  // ── Table build ───────────────────────────────────────────────────────────
  function buildTable(events) {
    var cols = 7;
    var rows = events.map(function (e, i) {
      var released  = e.actual !== null && e.actual !== undefined;
      var actualCls = 'ec-col-num';
      if (released) {
        if (e.surprise_direction === 'hotter_or_stronger') actualCls += ' ec-val-hot';
        else if (e.surprise_direction === 'softer_or_weaker') actualCls += ' ec-val-soft';
        else actualCls += ' ec-val-set';
      }
      return '<tr class="ec-row" data-ec-i="' + i + '" tabindex="0" role="button" aria-expanded="false">' +
        '<td class="ec-col-time">'    + esc(fmtTime(e.event_time)) + '</td>' +
        '<td class="ec-col-country">' + esc(countryCurrency(e.country)) + '</td>' +
        '<td class="ec-col-event"><strong>' + esc(e.event_name || '—') + '</strong>' +
          (e.type && e.type !== e.event_name ? '<small>' + esc(e.type) + '</small>' : '') +
        '</td>' +
        '<td>' + badgeHtml(e.importance) + '</td>' +
        '<td class="' + actualCls + '">' + numVal(e.actual,   e.unit) + '</td>' +
        '<td class="ec-col-num">'         + numVal(e.forecast, e.unit) + '</td>' +
        '<td class="ec-col-num">'         + numVal(e.previous, e.unit) + '</td>' +
        '</tr>';
    }).join('');

    var ths;
    if (isRTL) {
      ths = '<th>' + L.colPrevious + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colActual   + '</th><th>' + L.colImpact   + '</th>' +
            '<th>' + L.colEvent    + '</th><th>' + L.colCountry  + '</th>' +
            '<th>' + L.colTime     + '</th>';
    } else {
      ths = '<th>' + L.colTime    + '</th><th>' + L.colCountry + '</th>' +
            '<th>' + L.colEvent   + '</th><th>' + L.colImpact  + '</th>' +
            '<th>' + L.colActual  + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colPrevious + '</th>';
    }

    return { html: '<table class="ec-table"><thead><tr>' + ths + '</tr></thead><tbody>' + rows + '</tbody></table>', cols: cols };
  }

  // ── Card build (mobile) ───────────────────────────────────────────────────
  function buildCards(events) {
    var cards = events.map(function (e, i) {
      var assets = Array.isArray(e.historical_asset_sensitivity) ? e.historical_asset_sensitivity : [];
      var tags   = assets.map(function (a) {
        return '<span class="ec-asset-tag">' + esc(a) + '</span>';
      }).join('');

      return '<div class="ec-card" data-ec-i="' + i + '" tabindex="0" role="button" aria-expanded="false">' +
        '<div class="ec-card-header">' +
          '<div class="ec-card-event">' +
            '<strong>' + esc(e.event_name || '—') + '</strong>' +
            '<small>' + esc(countryCurrency(e.country)) + '</small>' +
          '</div>' +
          badgeHtml(e.importance) +
        '</div>' +
        '<div class="ec-card-time">' + esc(fmtTime(e.event_time)) + '</div>' +
        '<div class="ec-card-nums">' +
          '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colActual)   + '</span><span class="ec-card-num-val">' + numVal(e.actual,   e.unit) + '</span></div>' +
          '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colForecast) + '</span><span class="ec-card-num-val">' + numVal(e.forecast, e.unit) + '</span></div>' +
          '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colPrevious) + '</span><span class="ec-card-num-val">' + numVal(e.previous, e.unit) + '</span></div>' +
        '</div>' +
        '<div class="ec-card-detail">' +
          (tags ? '<div class="ec-card-assets">' + tags + '</div>' : '') +
          '<p class="ec-card-disclaimer">' + esc(L.disclaimer) + '</p>' +
        '</div>' +
        '</div>';
    }).join('');
    return '<div class="ec-cards">' + cards + '</div>';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    updateQuickBtns();
    if (elDatePicker && viewMode !== 'week') elDatePicker.value = selectedDate;

    var events = eventsForPeriod();
    var label  = viewMode === 'week'
      ? fmtDateLabel(weekStart(selectedDate)) + ' – ' + fmtDateLabel(weekEnd(selectedDate))
      : fmtDateLabel(selectedDate);

    if (!events.length) {
      elTableWrap.innerHTML =
        '<div class="ec-empty-state"><strong>' + esc(label) + '</strong>' + esc(L.noEvents) + '</div>';
      return;
    }

    var tbl   = buildTable(events);
    var cards = buildCards(events);
    elTableWrap.innerHTML = tbl.html + cards;
    attachListeners(tbl.cols);
  }

  // ── Row expand (desktop) ──────────────────────────────────────────────────
  function attachListeners(cols) {
    var rows = elTableWrap.querySelectorAll('tr.ec-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () { toggleRow(this, cols); });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleRow(this, cols); }
      });
    });
    var cards = elTableWrap.querySelectorAll('.ec-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () { this.classList.toggle('ec-card-expanded'); this.setAttribute('aria-expanded', this.classList.contains('ec-card-expanded') ? 'true' : 'false'); });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.click(); }
      });
    });
  }

  function toggleRow(row, cols) {
    var idx      = Number(row.getAttribute('data-ec-i'));
    var e        = eventsForPeriod()[idx];
    var expanded = row.classList.contains('ec-row-expanded');
    var next     = row.nextElementSibling;
    if (next && next.classList.contains('ec-detail-row')) next.remove();
    if (!expanded) {
      row.classList.add('ec-row-expanded');
      row.setAttribute('aria-expanded', 'true');
      var tr = document.createElement('tr');
      tr.className = 'ec-detail-row';
      var td = document.createElement('td');
      td.colSpan = cols;
      td.innerHTML = '<div class="ec-detail-inner">' + detailContent(e) + '</div>';
      tr.appendChild(td);
      row.parentNode.insertBefore(tr, row.nextSibling);
    } else {
      row.classList.remove('ec-row-expanded');
      row.setAttribute('aria-expanded', 'false');
    }
  }

  // ── Status bar ────────────────────────────────────────────────────────────
  function updateStatus() {
    if (!elStatus) return;
    var src  = calMeta.source || calMeta.provider || '';
    var upd  = calMeta.updated_at || '';
    var live = (src === 'fmp' || src === 'finnhub' || src === 'fred');
    var cls  = live ? 'ec-status-live' : src === 'cache' ? 'ec-status-cache' : 'ec-status-degraded';
    elStatus.className = 'ec-status-bar ' + cls;
    var srcLabel = src === 'degraded' ? L.srcDegraded : src === 'cache' ? L.srcCache : (L.srcLive + ' (' + src + ')');
    var updLabel = upd ? ' \xB7 ' + L.labelUpdated + ': ' + new Date(upd).toLocaleString(
      lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ) : '';
    elStatus.textContent = L.labelSrc + ': ' + srcLabel + updLabel;
  }

  // ── Quick button active state ─────────────────────────────────────────────
  function updateQuickBtns() {
    var today    = todayStr();
    var tomorrow = addDays(today, 1);
    [elToday, elTomorrow, elWeek].forEach(function (el) { if (el) el.classList.remove('ec-active'); });
    if (viewMode === 'week') {
      if (elWeek) elWeek.classList.add('ec-active');
    } else if (selectedDate === today) {
      if (elToday) elToday.classList.add('ec-active');
    } else if (selectedDate === tomorrow) {
      if (elTomorrow) elTomorrow.classList.add('ec-active');
    }
  }

  // ── Bind controls ─────────────────────────────────────────────────────────
  function bindControls() {
    if (elPrev) elPrev.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? -7 : -1); render();
    });
    if (elNext) elNext.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? 7 : 1); render();
    });
    if (elToday)    elToday.addEventListener('click',    function () { viewMode = 'day';  selectedDate = todayStr();             render(); });
    if (elTomorrow) elTomorrow.addEventListener('click', function () { viewMode = 'day';  selectedDate = addDays(todayStr(), 1); render(); });
    if (elWeek)     elWeek.addEventListener('click',     function () { viewMode = 'week'; selectedDate = todayStr();             render(); });
    if (elDatePicker) {
      elDatePicker.value = selectedDate;
      elDatePicker.addEventListener('change', function () {
        if (this.value) { viewMode = 'day'; selectedDate = this.value; render(); }
      });
    }
    if (elFilterImpact)  elFilterImpact.addEventListener('change',  function () { filterImpact  = this.value; render(); });
    if (elFilterCountry) elFilterCountry.addEventListener('change', function () { filterCountry = this.value; render(); });
    if (elSearch) {
      var t;
      elSearch.addEventListener('input', function () {
        var v = this.value;
        clearTimeout(t);
        t = setTimeout(function () { searchText = v; render(); }, 220);
      });
    }
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function liveUrl() {
    var from = addDays(todayStr(), -1);
    var to   = addDays(todayStr(), 14);
    return '/.netlify/functions/economic-calendar?from=' + from + '&to=' + to;
  }

  function load() {
    elTableWrap.innerHTML = '<p class="calendar-loading">' + esc(L.loading) + '</p>';
    var usedFallback = false;
    fetchJson(liveUrl())
      .catch(function () {
        usedFallback = true;
        return fetchJson('/data/economic-calendar.json');
      })
      .then(function (data) {
        calMeta = data;
        if (usedFallback && calMeta.source !== 'degraded') {
          calMeta = Object.assign({}, calMeta, { source: 'cache' });
        }
        allEvents = Array.isArray(data.events) ? data.events : [];
        populateCountries();
        updateStatus();
        render();
      })
      .catch(function () {
        elTableWrap.innerHTML = '<div class="ec-empty-state"><strong>' + esc(L.srcDegraded) + '</strong>' + esc(L.noEvents) + '</div>';
        if (elStatus) { elStatus.className = 'ec-status-bar ec-status-degraded'; elStatus.textContent = L.srcDegraded; }
      });
  }

  bindControls();
  load();
})();
