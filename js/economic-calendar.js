(function () {
  'use strict';

  // ── i18n ──────────────────────────────────────────────────────────────────
  var T = {
    en: {
      today: 'Today', tomorrow: 'Tomorrow', thisWeek: 'This Week', nextWeek: 'Next Week',
      allImpact: 'All Impact', allCountries: 'All Countries', search: 'Search events…',
      colTime: 'Time (Local)', colCountry: 'Country', colEvent: 'Event',
      colImpact: 'Impact', colActual: 'Actual', colForecast: 'Forecast', colPrevious: 'Previous',
      noEvents: 'No events found for this period.',
      noEventsHint: 'Try adjusting the date range or check provider status.',
      loading: 'Loading calendar…',
      high: 'High', medium: 'Medium', low: 'Low', holiday: 'Holiday',
      srcLive: 'Live data', srcCache: 'Cached data', srcDegraded: 'Provider unavailable',
      labelSrc: 'Source', labelUpdated: 'Updated', labelEvents: 'events',
      detailCountry: 'Country / Currency',
      detailActual: 'Actual', detailForecast: 'Forecast', detailPrevious: 'Previous',
      detailAssets: 'Asset sensitivity',
      detailWhat: 'What it measures', detailWhy: 'Why it matters',
      detailSurpriseAbove: 'Above forecast', detailSurpriseBelow: 'Below forecast',
      detailSurpriseInline: 'In line with forecast',
      disclaimer: 'Economic calendar information only. Not financial advice.',
    },
    ar: {
      today: 'اليوم', tomorrow: 'غداً', thisWeek: 'هذا الأسبوع', nextWeek: 'الأسبوع القادم',
      allImpact: 'كل التأثيرات', allCountries: 'كل الدول', search: 'ابحث عن أحداث…',
      colTime: 'الوقت المحلي', colCountry: 'الدولة / العملة', colEvent: 'الحدث',
      colImpact: 'التأثير', colActual: 'الفعلي', colForecast: 'التوقع', colPrevious: 'السابق',
      noEvents: 'لا توجد أحداث لهذه الفترة.',
      noEventsHint: 'جرّب نطاقاً زمنياً مختلفاً أو تحقق من حالة المزود.',
      loading: 'جارٍ التحميل…',
      high: 'مرتفع', medium: 'متوسط', low: 'منخفض', holiday: 'عطلة',
      srcLive: 'بيانات حية', srcCache: 'بيانات مخزنة', srcDegraded: 'المزود غير متاح',
      labelSrc: 'المصدر', labelUpdated: 'آخر تحديث', labelEvents: 'أحداث',
      detailCountry: 'الدولة / العملة',
      detailActual: 'الفعلي', detailForecast: 'التوقع', detailPrevious: 'السابق',
      detailAssets: 'حساسية الأصول',
      detailWhat: 'ما الذي يقيسه', detailWhy: 'لماذا يهم',
      detailSurpriseAbove: 'أعلى من التوقع', detailSurpriseBelow: 'أقل من التوقع',
      detailSurpriseInline: 'مطابق للتوقع',
      disclaimer: 'معلومات التقويم الاقتصادي فقط. لا تمثل نصيحة مالية.',
    }
  };

  var lang  = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var L     = T[lang];
  var isRTL = document.documentElement.dir === 'rtl';

  // ── Category descriptions (client-side, educational only) ─────────────────
  var CAT_DESC = {
    inflation:    { en: { what: 'Measures changes in the price level of consumer goods and services.', why: 'Central banks use inflation data to calibrate interest rate policy.' }, ar: { what: 'يقيس التغيرات في مستوى أسعار السلع والخدمات الاستهلاكية.', why: 'تستخدم البنوك المركزية بيانات التضخم لضبط سياسة أسعار الفائدة.' } },
    labor:        { en: { what: 'Tracks employment levels, job creation, wage growth, and unemployment.', why: 'Employment reflects the underlying health of the economy and consumer spending power.' }, ar: { what: 'يتتبع مستويات التوظيف وخلق الوظائف ونمو الأجور والبطالة.', why: 'يعكس التوظيف صحة الاقتصاد الأساسية وقدرة المستهلك على الإنفاق.' } },
    central_bank: { en: { what: 'Sets the benchmark interest rate, influencing borrowing costs across the economy.', why: 'Rate decisions signal the future direction of monetary policy — among the highest-impact events in global markets.' }, ar: { what: 'يحدد المعدل المرجعي للاقتصاد، ويؤثر على تكاليف الاقتراض.', why: 'تشير قرارات الأسعار إلى الاتجاه المستقبلي للسياسة النقدية — من أعلى الأحداث تأثيراً في الأسواق.' } },
    growth:       { en: { what: 'Measures total economic output (Gross Domestic Product).', why: 'GDP growth signals overall economic health and influences corporate earnings expectations.' }, ar: { what: 'يقيس إجمالي الناتج الاقتصادي (الناتج المحلي الإجمالي).', why: 'يشير نمو الناتج إلى الصحة الاقتصادية ويؤثر على توقعات أرباح الشركات.' } },
    consumption:  { en: { what: 'Tracks household spending on goods and services.', why: 'Consumer spending drives a large portion of economic output in developed economies.' }, ar: { what: 'يتتبع إنفاق الأسر على السلع والخدمات.', why: 'الإنفاق الاستهلاكي يحرّك جزءاً كبيراً من الناتج الاقتصادي في الدول المتقدمة.' } },
    pmi:          { en: { what: 'Purchasing Managers\' Index surveys business conditions. A reading above 50 indicates expansion.', why: 'PMI is a leading indicator for GDP growth, employment, and corporate earnings.' }, ar: { what: 'يستطلع مؤشر مديري المشتريات الأوضاع التجارية. قراءة فوق 50 = توسع.', why: 'مؤشر مديري المشتريات مؤشر قيادي للنمو والتوظيف وأرباح الشركات.' } },
    housing:      { en: { what: 'Tracks construction starts, building permits, home sales, and prices.', why: 'Housing reflects interest rate sensitivity and consumer credit conditions.' }, ar: { what: 'يتتبع مبادرات البناء وتصاريح البناء ومبيعات المنازل والأسعار.', why: 'يعكس الإسكان حساسية أسعار الفائدة وأوضاع ائتمان المستهلك.' } },
    trade:        { en: { what: 'Measures the difference between a country\'s exports and imports.', why: 'Trade balances reflect international competitiveness and can influence currency valuations.' }, ar: { what: 'يقيس الفرق بين صادرات الدولة وواردتها.', why: 'يعكس التوازن التجاري القدرة التنافسية الدولية ويؤثر على تقييمات العملات.' } },
    energy:       { en: { what: 'Tracks oil inventories, production levels, and related commodity metrics.', why: 'Energy prices affect production costs across industries and influence inflation readings.' }, ar: { what: 'يتتبع مخزونات النفط ومستويات الإنتاج والمقاييس ذات الصلة.', why: 'أسعار الطاقة تؤثر على تكاليف الإنتاج في جميع الصناعات وعلى التضخم.' } },
    treasury:     { en: { what: 'Auctions of government debt securities to market participants.', why: 'Auction results signal market appetite for government debt and influence benchmark yields.' }, ar: { what: 'مزادات أوراق الدين الحكومية لمشاركي السوق.', why: 'تشير نتائج المزادات إلى شهية السوق للديون الحكومية وتؤثر على عوائد المؤشرات.' } },
    holiday:      { en: { what: 'A market holiday — financial markets may be closed or operating with reduced liquidity.', why: 'Market closures affect liquidity and volume across all asset classes.' }, ar: { what: 'عطلة سوق — قد تكون الأسواق مغلقة أو تعمل بسيولة منخفضة.', why: 'إغلاقات السوق تؤثر على السيولة وحجم التداول في جميع فئات الأصول.' } },
    other:        { en: { what: 'Economic data relevant to the current macroeconomic environment.', why: 'Economic releases contribute to the overall picture of economic health and policy expectations.' }, ar: { what: 'بيانات اقتصادية ذات صلة بالبيئة الاقتصادية الكلية.', why: 'تساهم الإصدارات في الصورة الشاملة للصحة الاقتصادية وتوقعات السياسة.' } },
  };

  // ── DOM refs ──────────────────────────────────────────────────────────────
  var elPrev          = document.getElementById('ec-prev');
  var elNext          = document.getElementById('ec-next');
  var elToday         = document.getElementById('ec-today');
  var elTomorrow      = document.getElementById('ec-tomorrow');
  var elWeek          = document.getElementById('ec-week');
  var elNextWeek      = document.getElementById('ec-next-week');
  var elRefresh       = document.getElementById('ec-refresh');
  var elDatePicker    = document.getElementById('ec-date-picker');
  var elFilterImpact  = document.getElementById('ec-filter-impact');
  var elFilterCountry = document.getElementById('ec-filter-country');
  var elSearch        = document.getElementById('ec-search');
  var elTableWrap     = document.getElementById('ec-table-wrap');
  var elStatus        = document.getElementById('ec-status');

  if (!elTableWrap) return;

  // ── State ─────────────────────────────────────────────────────────────────
  var allEvents     = [];
  var calMeta       = {};
  var selectedDate  = todayStr();
  var viewMode      = 'day';
  var filterImpact  = '';
  var filterCountry = '';
  var searchText    = '';
  var isLoading     = false;

  // ── Date utilities ────────────────────────────────────────────────────────
  function todayStr() { return new Date().toISOString().slice(0, 10); }

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
      // All-day / date-only events from FRED — no local time to show
      if (/T00:00:00Z$/.test(dtStr)) return '—';
      var d = new Date(dtStr);
      if (isNaN(d.valueOf())) return String(dtStr).slice(11, 16);
      return d.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US', {
        hour: '2-digit', minute: '2-digit', hour12: false
      });
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

  function fmtDateGroupLabel(d) {
    try {
      return new Date(d + 'T12:00:00Z').toLocaleDateString(
        lang === 'ar' ? 'ar-SA' : 'en-US',
        { weekday: 'long', month: 'long', day: 'numeric' }
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
    return esc(String(n)) + (unit ? ' ' + esc(unit) : '');
  }

  // ── Country / currency ────────────────────────────────────────────────────
  var FLAG = { US: '🇺🇸', EU: '🇪🇺', GB: '🇬🇧',
               JP: '🇯🇵', CN: '🇨🇳', DE: '🇩🇪',
               FR: '🇫🇷', CA: '🇨🇦', AU: '🇦🇺',
               NZ: '🇳🇿', CH: '🇨🇭', IT: '🇮🇹' };
  var CCY  = { US: 'USD', EU: 'EUR', GB: 'GBP', JP: 'JPY', CN: 'CNY', DE: 'EUR',
               FR: 'EUR', IT: 'EUR', CA: 'CAD', AU: 'AUD', NZ: 'NZD', CH: 'CHF' };

  function countryCurrency(country) {
    var c   = String(country || '').toUpperCase();
    var ccy = CCY[c];
    return ccy ? c + ' · ' + ccy : (c || '—');
  }

  // ── Arabic event name translations ────────────────────────────────────────
  var AR_EVENTS = [
    { p: /\bunemployment\s+rate\b/i,               ar: 'معدل البطالة' },
    { p: /\binflation\s+rate\s+mom\b/i,            ar: 'معدل التضخم الشهري' },
    { p: /\binflation\s+rate\s+yoy\b/i,            ar: 'معدل التضخم السنوي' },
    { p: /\binflation\s+rate\b/i,                  ar: 'معدل التضخم' },
    { p: /\bconsumer\s+confidence\b/i,             ar: 'ثقة المستهلك' },
    { p: /\bbusiness\s+confidence\b/i,             ar: 'ثقة الأعمال' },
    { p: /\bconstruction\s+pmi\b/i,                ar: 'مؤشر مديري مشتريات البناء' },
    { p: /\bservices?\s+pmi\b/i,                   ar: 'مؤشر مديري مشتريات الخدمات' },
    { p: /\bmanufacturing\s+pmi\b/i,               ar: 'مؤشر مديري مشتريات التصنيع' },
    { p: /\bbalance\s+of\s+trade\b/i,              ar: 'الميزان التجاري' },
    { p: /\btrade\s+balance\b/i,                   ar: 'الميزان التجاري' },
    { p: /\bexports?\b/i,                          ar: 'الصادرات' },
    { p: /\bimports?\b/i,                          ar: 'الواردات' },
    { p: /\bexisting\s+home\s+sales\b/i,           ar: 'مبيعات المنازل القائمة' },
    { p: /\bfed\s+(?:chair(?:man)?)\s+speech\b/i, ar: 'خطاب رئيس الاحتياطي الفيدرالي' },
    { p: /\bfed\s+speech\b/i,                      ar: 'خطاب الاحتياطي الفيدرالي' },
    { p: /\binitial\s+jobless\s+claims\b/i,        ar: 'طلبات إعانة البطالة الأولية' },
    { p: /\bjobless\s+claims\b/i,                  ar: 'طلبات إعانة البطالة' },
    { p: /\bcore\s+cpi\b/i,                        ar: 'مؤشر أسعار المستهلك الأساسي' },
    { p: /\bcpi\b/i,                               ar: 'مؤشر أسعار المستهلك' },
    { p: /\bgdp\b/i,                               ar: 'الناتج المحلي الإجمالي' },
    { p: /\bretail\s+sales\b/i,                    ar: 'مبيعات التجزئة' },
    { p: /\bcore\s+pce\b/i,                        ar: 'نفقات الاستهلاك الشخصي الأساسية' },
    { p: /\bpce\b/i,                               ar: 'نفقات الاستهلاك الشخصي' },
    { p: /\binterest\s+rate\s+decision\b/i,        ar: 'قرار أسعار الفائدة' },
    { p: /\bfomc\b/i,                              ar: 'لجنة السوق المفتوحة الفيدرالية' },
    { p: /\bnonfarm\s+payrolls?\b/i,               ar: 'الرواتب غير الزراعية' },
  ];

  function translateEventName(name, locale) {
    if (locale !== 'ar') return name;
    var s = String(name || '');
    for (var i = 0; i < AR_EVENTS.length; i++) {
      if (AR_EVENTS[i].p.test(s)) return AR_EVENTS[i].ar;
    }
    return s;
  }

  // ── Filtering ─────────────────────────────────────────────────────────────
  function eventsForPeriod() {
    var from, to;
    if (viewMode === 'week') { from = weekStart(selectedDate); to = weekEnd(selectedDate); }
    else { from = to = selectedDate; }
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

  // ── Impact badge ──────────────────────────────────────────────────────────
  function badgeHtml(imp) {
    var cls = imp === 'high'    ? 'ec-badge-high'
            : imp === 'medium'  ? 'ec-badge-medium'
            : imp === 'low'     ? 'ec-badge-low'
            : imp === 'holiday' ? 'ec-badge-holiday'
            : 'ec-badge-low';
    return '<span class="ec-badge ' + cls + '">' + esc(L[imp] || imp || '') + '</span>';
  }

  // ── Intelligence panel ────────────────────────────────────────────────────
  function intelligenceHtml(e) {
    var intel = e.intelligence;
    if (!intel || !intel.category) return '';
    var catKey  = intel.category;
    var catData = CAT_DESC[catKey] || CAT_DESC.other;
    var desc    = catData[lang] || catData.en;
    var html    = '';
    if (desc.what) html += '<dt>' + esc(L.detailWhat) + '</dt><dd>' + esc(desc.what) + '</dd>';
    if (desc.why)  html += '<dt>' + esc(L.detailWhy)  + '</dt><dd>' + esc(desc.why)  + '</dd>';
    var sur = intel.surprise;
    if (sur && sur.available && sur.direction !== 'unknown') {
      var sLabel = sur.direction === 'above' ? L.detailSurpriseAbove
                 : sur.direction === 'below' ? L.detailSurpriseBelow
                 : L.detailSurpriseInline;
      var sCls   = sur.direction === 'above' ? 'ec-surprise-hot'
                 : sur.direction === 'below' ? 'ec-surprise-soft'
                 : 'ec-surprise-inline';
      html += '<dt>Surprise</dt><dd class="' + sCls + '">' + esc(sLabel) +
              ' <small>(' + esc(sur.magnitude || '') + ')</small></dd>';
    }
    if (!html) return '';
    return '<div class="ec-detail-intelligence"><dl>' + html + '</dl></div>';
  }

  // ── Detail panel content ──────────────────────────────────────────────────
  function detailContent(e) {
    var assets = Array.isArray(e.historical_asset_sensitivity) ? e.historical_asset_sensitivity : [];
    if (!assets.length && e.intelligence && Array.isArray(e.intelligence.market_sensitivity)) {
      assets = e.intelligence.market_sensitivity;
    }
    var tags = assets.map(function (a) {
      return '<span class="ec-asset-tag">' + esc(a) + '</span>';
    }).join('');

    var html = '<dt>' + esc(L.detailCountry)  + '</dt><dd>' + esc(countryCurrency(e.country)) + '</dd>';
    html    += '<dt>' + esc(L.detailActual)    + '</dt><dd>' + numVal(e.actual,   e.unit) + '</dd>';
    html    += '<dt>' + esc(L.detailForecast)  + '</dt><dd>' + numVal(e.forecast, e.unit) + '</dd>';
    html    += '<dt>' + esc(L.detailPrevious)  + '</dt><dd>' + numVal(e.previous, e.unit) + '</dd>';

    var out = '<dl>' + html + '</dl>';
    out += intelligenceHtml(e);
    if (tags) {
      out += '<div class="ec-detail-assets">'
          +  '<dt>' + esc(L.detailAssets) + '</dt>'
          +  '<div class="ec-asset-tags">' + tags + '</div>'
          +  '</div>';
    }
    out += '<p class="ec-detail-disclaimer">' + esc(L.disclaimer) + '</p>';
    return out;
  }

  // ── Date grouping ─────────────────────────────────────────────────────────
  function groupByDate(events) {
    var groups = [];
    var lastDate = null;
    events.forEach(function (e) {
      var d = String(e.event_time || e.date || '').slice(0, 10);
      if (d !== lastDate) { groups.push({ date: d, events: [] }); lastDate = d; }
      groups[groups.length - 1].events.push(e);
    });
    return groups;
  }

  // ── Table build ───────────────────────────────────────────────────────────
  function buildTable(events) {
    var cols = 7;
    var ths;
    if (isRTL) {
      ths = '<th>' + L.colPrevious + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colActual   + '</th><th>' + L.colImpact   + '</th>' +
            '<th>' + L.colEvent    + '</th><th>' + L.colCountry  + '</th>' +
            '<th>' + L.colTime     + '</th>';
    } else {
      ths = '<th>' + L.colTime     + '</th><th>' + L.colCountry  + '</th>' +
            '<th>' + L.colEvent    + '</th><th>' + L.colImpact   + '</th>' +
            '<th>' + L.colActual   + '</th><th>' + L.colForecast + '</th>' +
            '<th>' + L.colPrevious + '</th>';
    }

    var tbody  = '';
    var rowIdx = 0;
    var groups = viewMode === 'week' ? groupByDate(events) : [{ date: null, events: events }];
    groups.forEach(function (group) {
      if (viewMode === 'week' && group.date) {
        tbody += '<tr class="ec-date-group-row"><td colspan="' + cols + '" class="ec-date-group-cell">'
              +  esc(fmtDateGroupLabel(group.date)) + '</td></tr>';
      }
      group.events.forEach(function (e) {
        var intel      = e.intelligence || {};
        var sur        = intel.surprise  || {};
        var released   = e.actual !== null && e.actual !== undefined;
        var actualCls  = 'ec-col-num';
        if (released) {
          var dir = e.surprise_direction || (sur.direction === 'above' ? 'hotter_or_stronger' : sur.direction === 'below' ? 'softer_or_weaker' : '');
          if (dir === 'hotter_or_stronger' || sur.direction === 'above') actualCls += ' ec-val-hot';
          else if (dir === 'softer_or_weaker' || sur.direction === 'below') actualCls += ' ec-val-soft';
          else actualCls += ' ec-val-set';
        }
        var evtDisplayName = esc(translateEventName(e.event_name || '—', lang));
        var evtSub    = e.type && e.type !== e.event_name ? '<small>' + esc(e.type) + '</small>' : '';
        var tdTime    = '<td class="ec-col-time">'    + esc(fmtTime(e.event_time)) + '</td>';
        var tdCountry = '<td class="ec-col-country">' + esc(countryCurrency(e.country)) + '</td>';
        var tdEvent   = '<td class="ec-col-event"><strong>' + evtDisplayName + '</strong>' + evtSub + '</td>';
        var tdImpact  = '<td>' + badgeHtml(e.importance) + '</td>';
        var tdActual  = '<td class="' + actualCls + '">' + numVal(e.actual,   e.unit) + '</td>';
        var tdFcast   = '<td class="ec-col-num">'         + numVal(e.forecast, e.unit) + '</td>';
        var tdPrev    = '<td class="ec-col-num">'         + numVal(e.previous, e.unit) + '</td>';
        var cells     = isRTL
          ? tdPrev + tdFcast + tdActual + tdImpact + tdEvent + tdCountry + tdTime
          : tdTime + tdCountry + tdEvent + tdImpact + tdActual + tdFcast + tdPrev;
        tbody += '<tr class="ec-row" data-ec-i="' + rowIdx + '" tabindex="0" role="button" aria-expanded="false">' +
          cells + '</tr>';
        rowIdx++;
      });
    });

    return {
      html: '<table class="ec-table"><thead><tr>' + ths + '</tr></thead><tbody>' + tbody + '</tbody></table>',
      cols: cols,
    };
  }

  // ── Card build (mobile) ───────────────────────────────────────────────────
  function buildCards(events) {
    var parts  = [];
    var groups = viewMode === 'week' ? groupByDate(events) : [{ date: null, events: events }];
    var cardIdx = 0;
    groups.forEach(function (group) {
      if (viewMode === 'week' && group.date) {
        parts.push('<div class="ec-date-group-header">' + esc(fmtDateGroupLabel(group.date)) + '</div>');
      }
      group.events.forEach(function (e) {
        var assets = Array.isArray(e.historical_asset_sensitivity) ? e.historical_asset_sensitivity :
                     (e.intelligence && Array.isArray(e.intelligence.market_sensitivity) ? e.intelligence.market_sensitivity : []);
        var tags = assets.map(function (a) {
          return '<span class="ec-asset-tag">' + esc(a) + '</span>';
        }).join('');
        parts.push(
          '<div class="ec-card" data-ec-i="' + cardIdx + '" tabindex="0" role="button" aria-expanded="false">' +
          '<div class="ec-card-header">' +
            '<div class="ec-card-event"><strong>' + esc(translateEventName(e.event_name || '—', lang)) + '</strong>' +
              '<small>' + esc(countryCurrency(e.country)) + '</small></div>' +
            badgeHtml(e.importance) +
          '</div>' +
          '<div class="ec-card-time">' + esc(fmtTime(e.event_time)) + '</div>' +
          '<div class="ec-card-nums">' +
            '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colActual)   + '</span><span class="ec-card-num-val">' + numVal(e.actual,   e.unit) + '</span></div>' +
            '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colForecast) + '</span><span class="ec-card-num-val">' + numVal(e.forecast, e.unit) + '</span></div>' +
            '<div class="ec-card-num-cell"><span class="ec-card-num-label">' + esc(L.colPrevious) + '</span><span class="ec-card-num-val">' + numVal(e.previous, e.unit) + '</span></div>' +
          '</div>' +
          '<div class="ec-card-detail">' +
            intelligenceHtml(e) +
            (tags ? '<div class="ec-card-assets">' + tags + '</div>' : '') +
            '<p class="ec-card-disclaimer">' + esc(L.disclaimer) + '</p>' +
          '</div>' +
          '</div>'
        );
        cardIdx++;
      });
    });
    return '<div class="ec-cards">' + parts.join('') + '</div>';
  }

  // ── Render ────────────────────────────────────────────────────────────────
  function render() {
    updateQuickBtns();
    if (elDatePicker && viewMode !== 'week') elDatePicker.value = selectedDate;

    var events = eventsForPeriod();
    var label  = viewMode === 'week'
      ? fmtDateLabel(weekStart(selectedDate)) + ' – ' + fmtDateLabel(weekEnd(selectedDate))
      : fmtDateLabel(selectedDate);

    // Update status with event count before rendering content
    updateStatus(events.length);

    if (!events.length) {
      elTableWrap.innerHTML =
        '<div class="ec-empty-state"><strong>' + esc(label) + '</strong>' +
        '<p>' + esc(L.noEvents) + '</p>' +
        '<p class="ec-empty-hint">' + esc(L.noEventsHint) + '</p>' +
        '</div>';
      return;
    }

    var tbl   = buildTable(events);
    var cards = buildCards(events);
    elTableWrap.innerHTML = tbl.html + cards;
    attachListeners(tbl.cols, events);
  }

  // ── Row expand (desktop) ──────────────────────────────────────────────────
  function attachListeners(cols, events) {
    var rows = elTableWrap.querySelectorAll('tr.ec-row');
    rows.forEach(function (row) {
      row.addEventListener('click', function () { toggleRow(this, cols, events); });
      row.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleRow(this, cols, events); }
      });
    });
    var cards = elTableWrap.querySelectorAll('.ec-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        this.classList.toggle('ec-card-expanded');
        this.setAttribute('aria-expanded', this.classList.contains('ec-card-expanded') ? 'true' : 'false');
      });
      card.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); this.click(); }
      });
    });
  }

  function toggleRow(row, cols, events) {
    var idx      = Number(row.getAttribute('data-ec-i'));
    var e        = events[idx];
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
  function updateStatus(eventCount) {
    if (!elStatus) return;
    var src  = calMeta.source || calMeta.provider || '';
    var upd  = calMeta.updated_at || '';
    var isLive = (src === 'live' || src === 'fmp' || src === 'finnhub' || src === 'fred');
    var cls    = isLive ? 'ec-status-live' : src === 'cache' ? 'ec-status-cache' : 'ec-status-degraded';
    elStatus.className = 'ec-status-bar ' + cls;

    var srcLabel = src === 'degraded'   ? L.srcDegraded
                 : src === 'cache'       ? L.srcCache
                 : isLive                ? (L.srcLive + (src !== 'live' ? ' (' + src + ')' : ''))
                 : L.srcCache;

    var updLabel = upd ? ' \xB7 ' + L.labelUpdated + ': ' + new Date(upd).toLocaleString(
      lang === 'ar' ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    ) : '';

    // Provider status summary from schema 2.1
    var provText = '';
    if (calMeta.providers && typeof calMeta.providers === 'object') {
      var okProviders = Object.keys(calMeta.providers).filter(function (k) {
        return calMeta.providers[k].status === 'ok';
      });
      if (okProviders.length) {
        provText = ' \xB7 ' + okProviders.join('+');
      }
    }

    var countText = (eventCount !== undefined)
      ? ' \xB7 ' + eventCount + ' ' + L.labelEvents
      : '';

    elStatus.textContent = L.labelSrc + ': ' + srcLabel + updLabel + provText + countText;
  }

  // ── Quick button active state ─────────────────────────────────────────────
  function updateQuickBtns() {
    var today         = todayStr();
    var tomorrow      = addDays(today, 1);
    var nextWeekStart = weekStart(addDays(today, 7));
    [elToday, elTomorrow, elWeek, elNextWeek].forEach(function (el) {
      if (el) el.classList.remove('ec-active');
    });
    if (viewMode === 'week') {
      if (weekStart(selectedDate) === nextWeekStart) {
        if (elNextWeek) elNextWeek.classList.add('ec-active');
      } else {
        if (elWeek) elWeek.classList.add('ec-active');
      }
    } else if (selectedDate === today) {
      if (elToday) elToday.classList.add('ec-active');
    } else if (selectedDate === tomorrow) {
      if (elTomorrow) elTomorrow.classList.add('ec-active');
    }
  }

  // ── Bind controls ─────────────────────────────────────────────────────────
  function bindControls() {
    if (elPrev) elPrev.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? -7 : -1); load();
    });
    if (elNext) elNext.addEventListener('click', function () {
      selectedDate = addDays(selectedDate, viewMode === 'week' ? 7 : 1); load();
    });
    if (elToday)    elToday.addEventListener('click',    function () { viewMode = 'day';  selectedDate = todayStr();             load(); });
    if (elTomorrow) elTomorrow.addEventListener('click', function () { viewMode = 'day';  selectedDate = addDays(todayStr(), 1); load(); });
    if (elWeek)     elWeek.addEventListener('click',     function () { viewMode = 'week'; selectedDate = todayStr();             load(); });
    if (elNextWeek) elNextWeek.addEventListener('click', function () { viewMode = 'week'; selectedDate = addDays(todayStr(), 7); load(); });
    if (elRefresh)  elRefresh.addEventListener('click',  function () { load(); });
    if (elDatePicker) {
      elDatePicker.value = selectedDate;
      elDatePicker.addEventListener('change', function () {
        if (this.value) { viewMode = 'day'; selectedDate = this.value; load(); }
      });
    }
    // Filters are client-side only — no reload needed
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

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  function fetchJson(url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function endpointQuery() {
    var from, to;
    if (viewMode === 'week') {
      from = weekStart(selectedDate);
      to   = weekEnd(selectedDate);
    } else {
      from = addDays(selectedDate, -1);
      to   = addDays(selectedDate, 7);
    }
    return '?from=' + from + '&to=' + to;
  }

  // ── Load data ─────────────────────────────────────────────────────────────
  function load() {
    if (isLoading) return;
    isLoading = true;
    elTableWrap.innerHTML = '<p class="calendar-loading">' + esc(L.loading) + '</p>';
    if (elRefresh) { elRefresh.disabled = true; elRefresh.setAttribute('aria-busy', 'true'); }

    var qs = endpointQuery();
    var usedFallback = false;
    fetchJson('/api/economic-calendar' + qs)
      .catch(function () { return fetchJson('/.netlify/functions/economic-calendar' + qs); })
      .catch(function () {
        usedFallback = true;
        return fetchJson('/data/economic-calendar.json');
      })
      .then(function (data) {
        isLoading = false;
        if (elRefresh) { elRefresh.disabled = false; elRefresh.removeAttribute('aria-busy'); }
        calMeta = data;
        if (usedFallback && calMeta.source !== 'degraded') {
          calMeta = Object.assign({}, calMeta, { source: 'cache' });
        }
        allEvents = Array.isArray(data.events) ? data.events : [];
        populateCountries();
        render();
      })
      .catch(function () {
        isLoading = false;
        if (elRefresh) { elRefresh.disabled = false; elRefresh.removeAttribute('aria-busy'); }
        elTableWrap.innerHTML =
          '<div class="ec-empty-state"><strong>' + esc(L.srcDegraded) + '</strong>' +
          '<p>' + esc(L.noEvents) + '</p></div>';
        if (elStatus) {
          elStatus.className = 'ec-status-bar ec-status-degraded';
          elStatus.textContent = L.srcDegraded;
        }
      });
  }

  bindControls();
  load();
})();
