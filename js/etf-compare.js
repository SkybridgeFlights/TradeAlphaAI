/* ETF comparison — renders a side-by-side table from the dataset embedded in
 * the page. No network calls: the payload ships with the HTML.
 *
 * Selection lives in the URL hash (#voo,vwce) so a comparison can be shared.
 * A fund missing a measure renders an empty cell, never a zero.
 */
(function () {
  'use strict';

  var dataEl = document.querySelector('[data-compare-data]');
  var output = document.querySelector('[data-compare-output]');
  var emptyEl = document.querySelector('[data-compare-empty]');
  if (!output) return;

  // Small universes ship the dataset inline so the page works straight from the
  // served HTML. Larger ones fetch it once from a static file — same behaviour
  // either way, so the page scales without changing how it works.
  if (dataEl) {
    try {
      start(JSON.parse(dataEl.textContent));
    } catch (error) { /* malformed payload — leave the page static */ }
    return;
  }

  var script = document.querySelector('script[data-compare-src]');
  var src = script && script.getAttribute('data-compare-src');
  if (!src || typeof fetch !== 'function') return;
  fetch(src)
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (doc) { if (doc && doc.funds) start(doc.funds); })
    .catch(function () { /* offline — the page stays usable, just without comparison */ });
  return;

  function start(funds) {

  var bySlug = {};
  funds.forEach(function (fund) { bySlug[fund.slug] = fund; });

  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-compare-slot]'));
  var isAr = document.documentElement.lang === 'ar';
  function text(en, ar) { return isAr ? ar : en; }
  var AWAITING = text('Awaiting verified data', 'بانتظار بيانات موثّقة');

  function esc(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // --- formatters ----------------------------------------------------------

  function pct(value, digits) {
    if (value === null || value === undefined) return '';
    return (value * 100).toFixed(digits === undefined ? 1 : digits) + '%';
  }

  function signedPct(value) {
    if (value === null || value === undefined) return '';
    var v = (value * 100).toFixed(1);
    return (value > 0 ? '+' : '') + v + '%';
  }

  function compact(value) {
    if (value === null || value === undefined) return '';
    var abs = Math.abs(value);
    if (abs >= 1e12) return (value / 1e12).toFixed(1) + 'T';
    if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return String(value);
  }

  var REPLICATION = {
    physical_full: [ 'Full physical', 'مادية كاملة' ],
    physical_sampling: [ 'Sampling', 'بالعينة' ],
    synthetic: [ 'Synthetic', 'تركيبية' ],
    physical_backed: [ 'Physically backed', 'مدعوم ماديا' ]
  };

  var DISTRIBUTION = {
    accumulating: [ 'Accumulating', 'تراكمي' ],
    distributing: [ 'Distributing', 'موزِّع' ],
    none: [ 'None', 'لا يوجد' ]
  };

  function mapLabel(map, key) {
    var pair = map[key];
    if (!pair) return key || '';
    return isAr ? pair[1] : pair[0];
  }

  // Row definitions: label, accessor, and an optional CSS class for tone.
  var ROWS = [
    { en: 'Ticker', ar: 'الرمز', get: function (f) { return f.ticker; }, strong: true, align: 'start' },
    { en: 'Issuer', ar: 'الجهة المُصدِرة', get: function (f) { return f.issuer; } },
    { en: 'Benchmark', ar: 'المؤشر المرجعي', get: function (f) { return f.benchmark; } },
    { en: 'Listing', ar: 'الإدراج', get: function (f) { return f.listing; } },
    { en: 'Currency', ar: 'العملة', get: function (f) { return f.currency; } },
    { en: 'ISIN', ar: 'رقم ISIN', get: function (f) { return f.isin; } },
    { en: 'TradeAlpha Score', ar: 'مؤشر TradeAlpha', get: function (f) { return f.score === null ? '' : f.score + '/100'; }, strong: true },
    // Fixed to two decimals so 0.20% and 0.22% line up as comparable figures.
    { en: 'Total expense ratio', ar: 'نسبة المصاريف', get: function (f) { return f.ter === null ? '' : f.ter.toFixed(2) + '%'; }, best: 'low', raw: function (f) { return f.ter; } },
    { en: 'Domicile', ar: 'المقر', get: function (f) { return f.domicile; } },
    { en: 'Replication', ar: 'المحاكاة', get: function (f) { return f.replication ? mapLabel(REPLICATION, f.replication) : ''; } },
    { en: 'Distribution', ar: 'التوزيع', get: function (f) { return f.distribution ? mapLabel(DISTRIBUTION, f.distribution) : ''; } },
    { en: 'Inception', ar: 'التأسيس', get: function (f) { return f.inception; } },
    { en: '1Y return', ar: 'عائد سنة', get: function (f) { return signedPct(f.r1); }, tone: function (f) { return f.r1; } },
    { en: '3Y annualised', ar: 'سنويا 3 سنوات', get: function (f) { return signedPct(f.r3); }, tone: function (f) { return f.r3; } },
    { en: '5Y annualised', ar: 'سنويا 5 سنوات', get: function (f) { return signedPct(f.r5); }, tone: function (f) { return f.r5; } },
    { en: '10Y annualised', ar: 'سنويا 10 سنوات', get: function (f) { return signedPct(f.r10); }, tone: function (f) { return f.r10; } },
    { en: 'Volatility (1Y)', ar: 'التذبذب (سنة)', get: function (f) { return pct(f.vol); }, best: 'low', raw: function (f) { return f.vol; } },
    { en: 'Maximum drawdown', ar: 'أقصى تراجع', get: function (f) { return pct(f.dd); } },
    { en: 'Sharpe ratio', ar: 'نسبة شارب', get: function (f) { return f.sharpe === null ? '' : f.sharpe.toFixed(2); } },
    { en: 'Beta vs MSCI World', ar: 'بيتا مقابل MSCI', get: function (f) { return f.beta === null ? '' : f.beta.toFixed(2); } },
    { en: 'Median daily turnover', ar: 'وسيط التداول اليومي', get: function (f) { return f.turnover === null ? '' : compact(f.turnover) + ' ' + (f.currency || ''); } }
  ];

  function selected() {
    return slots.map(function (slot) { return slot.value; })
      .filter(function (slug) { return slug && bySlug[slug]; });
  }

  function render() {
    var chosen = selected();
    // De-duplicate: comparing a fund with itself tells the reader nothing.
    var seen = {};
    chosen = chosen.filter(function (slug) {
      if (seen[slug]) return false;
      seen[slug] = true;
      return true;
    });

    if (chosen.length < 2) {
      output.innerHTML = '';
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var picked = chosen.map(function (slug) { return bySlug[slug]; });

    // Mixed currencies make return rows non-comparable — say so rather than
    // letting the reader assume the gap is performance.
    var currencies = {};
    picked.forEach(function (f) { if (f.currency) currencies[f.currency] = true; });
    var mixed = Object.keys(currencies).length > 1;

    var head = '<th scope="col">' + esc(text('Measure', 'المقياس')) + '</th>'
      + picked.map(function (f) {
        return '<th scope="col"><a href="/research/etfs/' + esc(f.slug) + '/">' + esc(f.ticker) + '</a></th>';
      }).join('');

    var bodyRows = ROWS.map(function (row) {
      var values = picked.map(function (f) { return row.get(f); });
      // The row stays even when nothing is available: the reader learns that the
      // measure exists and is simply not verified for these funds.
      var allEmpty = values.every(function (v) { return v === '' || v === null || v === undefined; });

      var bestIndex = -1;
      if (row.best && row.raw) {
        var nums = picked.map(function (f) { return row.raw(f); });
        nums.forEach(function (n, i) {
          if (n === null || n === undefined) return;
          if (bestIndex === -1 || (row.best === 'low' ? n < nums[bestIndex] : n > nums[bestIndex])) bestIndex = i;
        });
      }

      var cells = picked.map(function (f, i) {
        var value = values[i];
        var cls = [];
        if (row.strong && row.align !== 'start') cls.push('num');
        if (row.tone) {
          var toneValue = row.tone(f);
          if (toneValue !== null && toneValue !== undefined) cls.push(toneValue >= 0 ? 'positive' : 'negative');
        }
        if (i === bestIndex) cls.push('positive');
        var missing = value === '' || value === null || value === undefined;
        if (missing) {
          return '<td class="' + cls.join(' ') + '"><span class="etf-awaiting">' + esc(AWAITING) + '</span></td>';
        }
        var content = row.strong ? '<strong>' + esc(value) + '</strong>' : esc(value);
        return '<td class="' + cls.join(' ') + '">' + content + '</td>';
      }).join('');

      return '<tr' + (allEmpty ? ' class="etf-row-awaiting"' : '') + '><th scope="row">' + esc(isAr ? row.ar : row.en) + '</th>' + cells + '</tr>';
    }).join('');

    var warning = mixed
      ? '<div class="etf-note">' + esc(text(
        'These funds are quoted in different currencies (' + Object.keys(currencies).join(', ') + '). Return rows are not directly comparable — part of any difference is the exchange rate, not the funds.',
        'هذه الصناديق مسعّرة بعملات مختلفة (' + Object.keys(currencies).join('، ') + '). وصفوف العائد غير قابلة للمقارنة المباشرة — إذ أن جزءا من أي فارق يعود إلى سعر الصرف لا إلى الصناديق.'
      )) + '</div>'
      : '';

    output.innerHTML = warning
      + '<div class="etf-table-wrap"><table class="etf-table"><thead><tr>' + head + '</tr></thead><tbody>' + bodyRows + '</tbody></table></div>';
  }

  // --- URL hash state ------------------------------------------------------

  function writeHash() {
    var chosen = selected();
    var hash = chosen.length ? '#' + chosen.join(',') : '';
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search + hash);
    }
  }

  function readHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    raw.split(',').slice(0, slots.length).forEach(function (slug, i) {
      if (bySlug[slug]) slots[i].value = slug;
    });
  }

  slots.forEach(function (slot) {
    slot.addEventListener('change', function () {
      writeHash();
      render();
    });
  });

  window.addEventListener('hashchange', function () {
    readHash();
    render();
  });

  readHash();
  render();
  }
}());
