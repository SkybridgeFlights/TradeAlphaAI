/* ETF Finder — client-side filtering and sorting.
 *
 * Operates entirely on data-* attributes already present in the rendered table,
 * so there is no second data fetch and the page works from the served HTML. The
 * table is fully readable with JavaScript disabled; this only narrows it.
 *
 * Mirrors the conventions used by js/market/screener-engine.js: debounced input,
 * a bilingual text() helper keyed off the document language, and in-place DOM
 * sorting rather than a re-render.
 */
(function () {
  'use strict';

  var DEBOUNCE_MS = 140;

  var table = document.querySelector('[data-etf-table]');
  if (!table) return;

  var tbody = table.querySelector('tbody');
  var rows = Array.prototype.slice.call(tbody.querySelectorAll('tr'));
  var countEl = document.querySelector('[data-etf-count]');
  var emptyEl = document.querySelector('[data-etf-empty]');
  var controls = Array.prototype.slice.call(document.querySelectorAll('[data-etf-filter]'));

  var isAr = document.documentElement.lang === 'ar';
  function text(en, ar) { return isAr ? ar : en; }

  function readFilters() {
    var state = {};
    controls.forEach(function (control) {
      state[control.getAttribute('data-etf-filter')] = String(control.value || '').trim();
    });
    return state;
  }

  function matches(row, state) {
    if (state.query) {
      var needle = state.query.toLowerCase();
      var ticker = (row.getAttribute('data-ticker') || '').toLowerCase();
      var name = row.getAttribute('data-name') || '';
      if (ticker.indexOf(needle) === -1 && name.indexOf(needle) === -1) return false;
    }
    if (state.region && row.getAttribute('data-region') !== state.region) return false;
    if (state.issuer && row.getAttribute('data-issuer') !== state.issuer) return false;
    if (state.category && row.getAttribute('data-category') !== state.category) return false;
    if (state.distribution && row.getAttribute('data-distribution') !== state.distribution) return false;
    if (state.replication && row.getAttribute('data-replication') !== state.replication) return false;

    if (state.maxTer) {
      var ter = row.getAttribute('data-ter');
      // A fund with no published TER cannot satisfy a cost ceiling, so it is
      // excluded rather than silently treated as free.
      if (ter === '' || ter === null) return false;
      if (parseFloat(ter) > parseFloat(state.maxTer)) return false;
    }
    if (state.minScore) {
      var score = row.getAttribute('data-score');
      if (score === '' || score === null) return false;
      if (parseFloat(score) < parseFloat(state.minScore)) return false;
    }
    return true;
  }

  function apply() {
    var state = readFilters();
    var shown = 0;
    rows.forEach(function (row) {
      var ok = matches(row, state);
      row.hidden = !ok;
      if (ok) shown += 1;
    });
    if (countEl) {
      countEl.textContent = shown === rows.length
        ? text('Showing all ' + rows.length + ' funds', 'عرض جميع الصناديق البالغة ' + rows.length)
        : text('Showing ' + shown + ' of ' + rows.length + ' funds', 'عرض ' + shown + ' من ' + rows.length + ' صندوقا');
    }
    if (emptyEl) emptyEl.hidden = shown !== 0;
  }

  var timer = null;
  function schedule() {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(apply, DEBOUNCE_MS);
  }

  controls.forEach(function (control) {
    var event = control.tagName === 'SELECT' ? 'change' : 'input';
    control.addEventListener(event, schedule);
  });

  // --- sorting -------------------------------------------------------------

  var sortState = { key: null, dir: 1 };

  function sortValue(row, key) {
    var raw = row.getAttribute('data-' + key);
    if (raw === null || raw === '') return null;
    var num = parseFloat(raw);
    return isNaN(num) ? null : num;
  }

  function sortBy(key) {
    sortState.dir = sortState.key === key ? -sortState.dir : 1;
    sortState.key = key;

    var sorted = rows.slice().sort(function (a, b) {
      var va = sortValue(a, key);
      var vb = sortValue(b, key);
      // Rows without a value always sink to the bottom, in either direction —
      // absent data is not the same as a low value.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va - vb) * sortState.dir;
    });

    var fragment = document.createDocumentFragment();
    sorted.forEach(function (row) { fragment.appendChild(row); });
    tbody.appendChild(fragment);

    table.querySelectorAll('th.sortable').forEach(function (th) {
      var icon = th.querySelector('.sort-icon');
      if (!icon) return;
      icon.textContent = th.getAttribute('data-sort') === key ? (sortState.dir === 1 ? '↑' : '↓') : '↕';
    });
  }

  table.querySelectorAll('th.sortable').forEach(function (th) {
    th.setAttribute('tabindex', '0');
    th.setAttribute('role', 'button');
    var key = th.getAttribute('data-sort');
    th.addEventListener('click', function () { sortBy(key); });
    th.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        sortBy(key);
      }
    });
  });

  apply();
}());
