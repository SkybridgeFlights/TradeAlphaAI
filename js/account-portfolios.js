/* Phase 228 CP2/E — portfolio surface.
 *
 * Minimum production UI to exercise every portfolio operation. Correctness
 * first: no animation, no decoration, nothing that is not required to create,
 * read, edit and delete a holder's own records.
 *
 * Two views on one page:
 *   /account/portfolios/            list + create form
 *   /account/portfolios/?slug=x     detail — positions, targets, snapshot, analytics
 *
 * Every request goes through AccountShared.apiFetch, which attaches the Clerk
 * bearer token; an unauthenticated visitor is shown the sign-in CTA and no
 * request is made. Rendering is done with textContent and explicit element
 * creation rather than innerHTML interpolation, so a holder's own note or
 * portfolio name can never become markup.
 */
(function () {
  'use strict';

  var S = window.__AccountApp__;
  if (!S) return;

  var root = document.querySelector('[data-account-app="portfolios"]');
  if (!root) return;

  var isAr = document.documentElement.lang === 'ar';
  var base = isAr ? '/ar' : '';
  function t(en, ar) { return isAr ? ar : en; }

  var params = new URLSearchParams(window.location.search);
  var slug = (params.get('slug') || '').trim().toLowerCase();

  // ---------------------------------------------------------------------
  // DOM helpers — build nodes, never concatenate markup.
  // ---------------------------------------------------------------------
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'html') n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function status(node, text, kind) {
    node.textContent = text;
    node.setAttribute('data-kind', kind || 'info');
    node.style.color = kind === 'error' ? '#b3261e' : 'inherit';
  }

  // A failed request must say what went wrong and what to do about it, not
  // just that something failed.
  function describeError(err) {
    if (err && err.status === 401) return t('Your session expired. Sign in again to continue.', 'انتهت جلستك. سجّل الدخول مجددا للمتابعة.');
    if (err && err.status === 403) return err.message || t('That exceeds a limit on your plan.', 'يتجاوز ذلك حدا في خطتك.');
    if (err && err.status === 404) return t('That portfolio no longer exists.', 'لم تعد تلك المحفظة موجودة.');
    if (err && err.status === 409) return err.message || t('That name is already in use.', 'ذلك الاسم مستخدم بالفعل.');
    if (err && err.message) return err.message;
    return t('Something went wrong. Try again.', 'حدث خطأ ما. حاول مرة أخرى.');
  }

  function busy(on, label) {
    var b = document.getElementById('pf-busy');
    if (!b) return;
    b.textContent = on ? (label || t('Working…', 'جارٍ العمل…')) : '';
    b.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function panel(kids) { return el('div', { 'class': 'market-panel' }, kids); }

  function field(labelText, input) {
    var id = input.getAttribute('id');
    return el('p', { style: 'margin:0 0 10px' }, [
      el('label', { 'for': id, text: labelText, style: 'display:block;font-size:.85rem;margin-bottom:4px' }),
      input,
    ]);
  }

  function input(id, attrs) {
    var a = attrs || {};
    a.id = id;
    a.style = 'width:100%;max-width:340px;padding:8px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit';
    return el('input', a);
  }

  function button(text, onClick, kind) {
    var b = el('button', {
      type: 'button',
      text: text,
      style: 'padding:8px 14px;margin-inline-end:8px;margin-block-start:4px;border:1px solid currentColor;border-radius:4px;background:transparent;color:inherit;cursor:pointer;min-height:40px',
    });
    if (kind === 'danger') b.style.color = '#b3261e';
    b.addEventListener('click', onClick);
    return b;
  }

  // Wide tables must scroll inside their own container so the page body never
  // scrolls sideways on a phone.
  function scroller(node) {
    return el('div', { style: 'overflow-x:auto;-webkit-overflow-scrolling:touch' }, [node]);
  }

  // Coverage is a property of what we have researched, not a judgement of the
  // holding. A basic-coverage symbol is fully supported: it is held, priced and
  // weighted like any other. The chip says what we know, never what is missing.
  var COVERAGE_TEXT = {
    basic: { en: 'Basic', ar: 'أساسية', title_en: 'Identity and price history — held, priced and included in your allocation.', title_ar: 'الهوية وسجل الأسعار — محتفَظ به ومسعّر ومُدرَج في توزيعك.' },
    research: { en: 'Research', ar: 'بحثية', title_en: 'Adds observed risk statistics, correlation and a TradeAlpha Score.', title_ar: 'يضيف إحصاءات المخاطر المرصودة والارتباط ودرجة TradeAlpha.' },
    full_intelligence: { en: 'Full intelligence', ar: 'استخبارات كاملة', title_en: 'Adds verified fund facts, each carrying its source.', title_ar: 'يضيف حقائق موثّقة عن الصندوق، ولكل منها مصدره.' },
  };

  function coverageChip(level) {
    var c = COVERAGE_TEXT[level] || COVERAGE_TEXT.basic;
    var span = el('span', {
      text: isAr ? c.ar : c.en,
      title: isAr ? c.title_ar : c.title_en,
      style: 'display:inline-block;font-size:.72rem;padding:1px 7px;border:1px solid currentColor;border-radius:10px;opacity:.75;white-space:nowrap',
    });
    return span;
  }

  function coverageLegend() {
    var items = ['basic', 'research', 'full_intelligence'].map(function (lv) {
      var c = COVERAGE_TEXT[lv];
      return el('li', { style: 'margin-bottom:4px' }, [
        coverageChip(lv),
        el('span', { text: ' ' + (isAr ? c.title_ar : c.title_en), style: 'font-size:.88rem;opacity:.85' }),
      ]);
    });
    return el('details', { style: 'margin-block-start:10px' }, [
      el('summary', {
        text: t('What the coverage labels mean', 'ما تعنيه علامات التغطية'),
        style: 'cursor:pointer;font-size:.88rem',
      }),
      el('ul', { style: 'margin:8px 0 0;padding-inline-start:18px;list-style:none' }, items),
    ]);
  }

  function table(headers, rows) {
    var thead = el('thead', null, [el('tr', null, headers.map(function (h) {
      return el('th', { text: h, style: 'text-align:start;padding:6px 10px;white-space:nowrap;font-size:.8rem' });
    }))]);
    var tbody = el('tbody', null, rows);
    var tb = el('table', { style: 'width:100%;border-collapse:collapse;min-width:420px' }, [thead, tbody]);
    return scroller(tb);
  }
  function td(text) { return el('td', { text: text, style: 'padding:6px 10px;border-top:1px solid rgba(128,128,128,.3)' }); }

  // ---------------------------------------------------------------------
  // List view
  // ---------------------------------------------------------------------
  function renderList(data) {
    clear(root);
    var list = (data && data.portfolios) || [];

    root.appendChild(el('p', { id: 'pf-busy', role: 'status', 'aria-live': 'polite', style: 'min-height:1.2em;margin:0 0 8px' }));
    var msg = el('p', { id: 'pf-msg', role: 'status', 'aria-live': 'polite', style: 'min-height:1.2em;margin:0 0 8px' });
    root.appendChild(msg);

    if (!list.length) {
      root.appendChild(panel([el('p', {
        'class': 'market-copy',
        text: t('You have no portfolios yet. Create one below to start recording what you hold.',
          'ليس لديك محافظ بعد. أنشئ واحدة أدناه لتبدأ تسجيل ما تملكه.'),
      })]));
    } else {
      var rows = list.map(function (p) {
        var link = el('a', { href: base + '/account/portfolios/?slug=' + encodeURIComponent(p.slug), text: p.name });
        return el('tr', null, [
          el('td', { style: 'padding:6px 10px;border-top:1px solid rgba(128,128,128,.3)' }, [link]),
          td(p.base_currency),
          td(String(p.position_count)),
          td(p.portfolio_type),
        ]);
      });
      root.appendChild(panel([table(
        [t('Name', 'الاسم'), t('Currency', 'العملة'), t('Positions', 'المراكز'), t('Type', 'النوع')],
        rows
      )]));
    }

    // Create form
    var slugIn = input('pf-slug', { type: 'text', placeholder: 'my-portfolio', maxlength: '64' });
    var nameIn = input('pf-name', { type: 'text', placeholder: t('My Portfolio', 'محفظتي'), maxlength: '120' });
    var curIn = input('pf-cur', { type: 'text', value: 'USD', maxlength: '3' });
    var form = panel([
      el('h3', { text: t('Create a portfolio', 'أنشئ محفظة'), style: 'margin-top:0' }),
      field(t('Short id (lowercase letters, digits, dashes)', 'معرّف قصير (حروف صغيرة وأرقام وشرطات)'), slugIn),
      field(t('Name', 'الاسم'), nameIn),
      field(t('Base currency', 'العملة الأساسية'), curIn),
      button(t('Create portfolio', 'إنشاء محفظة'), function () {
        var body = {
          slug: slugIn.value.trim().toLowerCase(),
          name: nameIn.value.trim(),
          base_currency: curIn.value.trim().toUpperCase() || 'USD',
        };
        if (!body.slug || !body.name) {
          status(msg, t('Enter both a short id and a name.', 'أدخل المعرّف والاسم معا.'), 'error');
          return;
        }
        busy(true, t('Creating…', 'جارٍ الإنشاء…'));
        S.apiFetch('/api/account/portfolios', { method: 'POST', body: body })
          .then(function () { window.location.search = '?slug=' + encodeURIComponent(body.slug); })
          .catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
    ]);
    root.appendChild(form);
  }

  // ---------------------------------------------------------------------
  // Detail view
  // ---------------------------------------------------------------------
  function renderDetail(data) {
    clear(root);
    var p = data.portfolio;

    root.appendChild(el('p', null, [el('a', { href: base + '/account/portfolios/', text: t('← All portfolios', '← كل المحافظ') })]));
    root.appendChild(el('p', { id: 'pf-busy', role: 'status', 'aria-live': 'polite', style: 'min-height:1.2em;margin:0 0 8px' }));
    var msg = el('p', { id: 'pf-msg', role: 'status', 'aria-live': 'polite', style: 'min-height:1.2em;margin:0 0 8px' });
    root.appendChild(msg);

    // --- header + rename + delete
    var nameIn = input('pf-rename', { type: 'text', value: p.name, maxlength: '120' });
    root.appendChild(panel([
      el('h3', { text: p.name, style: 'margin-top:0' }),
      el('p', { 'class': 'market-copy', text: p.base_currency + ' · ' + p.portfolio_type }),
      field(t('Rename', 'إعادة تسمية'), nameIn),
      button(t('Save name', 'حفظ الاسم'), function () {
        busy(true, t('Saving…', 'جارٍ الحفظ…'));
        S.apiFetch('/api/account/portfolios?slug=' + encodeURIComponent(p.slug), { method: 'PATCH', body: { name: nameIn.value.trim() } })
          .then(load).catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
      button(t('Delete portfolio', 'حذف المحفظة'), function () {
        busy(true, t('Deleting…', 'جارٍ الحذف…'));
        S.apiFetch('/api/account/portfolios?slug=' + encodeURIComponent(p.slug) + '&purge=1', { method: 'DELETE' })
          .then(function () { window.location.search = ''; })
          .catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }, 'danger'),
    ]));

    // --- positions
    var posRows = (p.positions || []).map(function (pos) {
      var qty = input('pf-q-' + pos.symbol, { type: 'text', value: String(pos.quantity), inputmode: 'decimal' });
      qty.style.maxWidth = '130px';
      // The endpoint upserts the whole row, so a partial body would blank the
      // fields it omits. Editing a quantity must not silently discard the cost
      // the holder recorded, so every stored field is sent back with it.
      var save = button(t('Save', 'حفظ'), function () {
        var body = { portfolio_slug: p.slug, symbol: pos.symbol, quantity: qty.value.trim() };
        if (pos.average_cost !== null && pos.average_cost !== undefined) body.average_cost = String(pos.average_cost);
        if (pos.current_value_override !== null && pos.current_value_override !== undefined) body.current_value_override = String(pos.current_value_override);
        if (pos.contribution_amount !== null && pos.contribution_amount !== undefined) body.contribution_amount = String(pos.contribution_amount);
        if (pos.note) body.note = pos.note;
        busy(true, t('Saving…', 'جارٍ الحفظ…'));
        S.apiFetch('/api/account/portfolios/positions', { method: 'POST', body: body })
          .then(load).catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      });
      var del = button(t('Remove', 'إزالة'), function () {
        busy(true, t('Removing…', 'جارٍ الإزالة…'));
        S.apiFetch('/api/account/portfolios/positions?portfolio_slug=' + encodeURIComponent(p.slug)
          + '&symbol=' + encodeURIComponent(pos.symbol), { method: 'DELETE' })
          .then(load).catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }, 'danger');
      var symCell = el('td', { style: 'padding:6px 10px;border-top:1px solid rgba(128,128,128,.3)' }, [
        el('div', null, [
          el('strong', { text: pos.symbol }),
          el('span', { text: ' ' }),
          coverageChip(pos.coverage || 'basic'),
        ]),
        pos.listing_name
          ? el('div', { text: pos.listing_name, style: 'font-size:.8rem;opacity:.7;margin-block-start:2px' })
          : null,
      ]);
      return el('tr', null, [
        symCell,
        td(pos.instrument_type),
        el('td', { style: 'padding:6px 10px;border-top:1px solid rgba(128,128,128,.3)' }, [qty]),
        el('td', { style: 'padding:6px 10px;border-top:1px solid rgba(128,128,128,.3)' }, [save, del]),
      ]);
    });

    var symIn = input('pf-sym', { type: 'text', placeholder: 'VOO', maxlength: '16' });
    var qIn = input('pf-qty', { type: 'text', placeholder: '10', inputmode: 'decimal' });
    var costIn = input('pf-cost', { type: 'text', placeholder: t('optional', 'اختياري'), inputmode: 'decimal' });

    root.appendChild(panel([
      el('h3', { text: t('Positions', 'المراكز'), style: 'margin-top:0' }),
      posRows.length
        ? table([t('Symbol', 'الرمز'), t('Type', 'النوع'), t('Quantity', 'الكمية'), t('Actions', 'إجراءات')], posRows)
        : el('p', { 'class': 'market-copy', text: t('No positions yet.', 'لا توجد مراكز بعد.') }),
      posRows.length ? coverageLegend() : null,
      el('h4', { text: t('Add or update a position', 'أضف مركزا أو حدّثه'), style: 'margin-block-end:6px' }),
      field(t('Symbol — any US-listed stock or ETF', 'الرمز — أي سهم أو صندوق مدرج في الولايات المتحدة'), symIn),
      field(t('Quantity', 'الكمية'), qIn),
      field(t('Average cost (optional)', 'متوسط التكلفة (اختياري)'), costIn),
      button(t('Save position', 'حفظ المركز'), function () {
        var body = { portfolio_slug: p.slug, symbol: symIn.value.trim().toUpperCase(), quantity: qIn.value.trim() };
        if (costIn.value.trim()) body.average_cost = costIn.value.trim();
        if (!body.symbol || !body.quantity) {
          status(msg, t('Enter a symbol and a quantity.', 'أدخل الرمز والكمية.'), 'error');
          return;
        }
        busy(true, t('Saving…', 'جارٍ الحفظ…'));
        S.apiFetch('/api/account/portfolios/positions', { method: 'POST', body: body })
          .then(load).catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
    ]));

    // --- targets
    var tgtRows = (p.targets || []).map(function (tg) {
      return el('tr', null, [td(tg.symbol), td(String(tg.target_weight) + '%')]);
    });
    var tSym = input('pf-tsym', { type: 'text', placeholder: 'VOO', maxlength: '16' });
    var tW = input('pf-tw', { type: 'text', placeholder: '60', inputmode: 'decimal' });
    root.appendChild(panel([
      el('h3', { text: t('Target weights', 'الأوزان المستهدفة'), style: 'margin-top:0' }),
      el('p', {
        'class': 'market-copy',
        text: t('Targets need not add up to 100. The total you state is reported back as it is.',
          'لا يلزم أن تبلغ الأوزان 100. ويُعاد إليك المجموع الذي تذكره كما هو.'),
      }),
      tgtRows.length ? table([t('Symbol', 'الرمز'), t('Target', 'المستهدف')], tgtRows)
        : el('p', { 'class': 'market-copy', text: t('No targets set.', 'لا توجد أوزان مستهدفة.') }),
      field(t('Symbol', 'الرمز'), tSym),
      field(t('Target weight %', 'الوزن المستهدف %'), tW),
      button(t('Add target', 'إضافة هدف'), function () {
        var next = (p.targets || []).map(function (x) { return { symbol: x.symbol, target_weight: String(x.target_weight) }; })
          .filter(function (x) { return x.symbol !== tSym.value.trim().toUpperCase(); });
        next.push({ symbol: tSym.value.trim().toUpperCase(), target_weight: tW.value.trim() });
        busy(true, t('Saving…', 'جارٍ الحفظ…'));
        S.apiFetch('/api/account/portfolios/targets', { method: 'PUT', body: { portfolio_slug: p.slug, targets: next } })
          .then(load).catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
    ]));

    // --- snapshot + analytics
    var analyticsBox = el('div', { id: 'pf-analytics' }, [
      el('p', { 'class': 'market-copy', text: t('Not loaded.', 'غير محمّل.') }),
    ]);
    root.appendChild(panel([
      el('h3', { text: t('Measurement', 'القياس'), style: 'margin-top:0' }),
      button(t('Load analysis', 'تحميل التحليل'), function () {
        busy(true, t('Computing…', 'جارٍ الحساب…'));
        S.apiFetch('/api/account/portfolios/analytics?portfolio_slug=' + encodeURIComponent(p.slug))
          .then(function (res) { busy(false); renderAnalytics(analyticsBox, res); })
          .catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
      button(t('Save snapshot', 'حفظ لقطة'), function () {
        busy(true, t('Saving…', 'جارٍ الحفظ…'));
        S.apiFetch('/api/account/portfolios/snapshots', { method: 'POST', body: { portfolio_slug: p.slug } })
          .then(function (res) {
            busy(false);
            var d = (res && res.snapshot && res.snapshot.snapshot_date) || '';
            status(msg, t('Snapshot saved for ', 'حُفظت اللقطة لتاريخ ') + String(d).slice(0, 10), 'info');
          })
          .catch(function (e) { busy(false); status(msg, describeError(e), 'error'); });
      }),
      analyticsBox,
    ]));
  }

  // A withheld figure is shown as withheld, with its reason — never as zero.
  function renderAnalytics(box, res) {
    clear(box);
    var a = res && res.analytics;
    if (!a || !a.available) {
      box.appendChild(el('p', { 'class': 'market-copy', text: t('No analysis available: ', 'لا يتوفر تحليل: ') + ((a && a.reason) || 'unknown') }));
      return;
    }
    var rows = [];
    function row(label, value) { rows.push(el('tr', null, [td(label), td(value)])); }
    var withheld = t('withheld — insufficient data', 'محجوب — بيانات غير كافية');

    row(t('Positions', 'المراكز'), String(a.position_count));
    row(t('Total value', 'القيمة الإجمالية'),
      a.value && a.value.available ? (a.value.total + ' ' + (a.value.currency || '')) : withheld);
    if (a.concentration && a.concentration.available) {
      row('HHI', String(a.concentration.hhi));
      row(t('Effective positions', 'المراكز الفعّالة'), String(a.concentration.effective_positions));
      row(t('Largest holding', 'أكبر مركز'),
        a.concentration.top_position.symbol + ' · ' + (a.concentration.top_position.weight * 100).toFixed(2) + '%');
    }
    if (a.diversification) row(t('Diversification', 'التنويع'), a.diversification.label);
    row(t('Weighted cost', 'التكلفة المرجّحة'),
      a.cost && a.cost.available ? a.cost.weighted_ter_pct + '%' : withheld);
    row(t('Weighted score', 'الدرجة المرجّحة'),
      a.score && a.score.available && a.score.weighted_score !== null ? String(a.score.weighted_score) : withheld);
    row(t('Volatility', 'التقلب'),
      a.risk && a.risk.available ? (a.risk.volatility * 100).toFixed(2) + '%' : withheld);
    row(t('Max drawdown', 'أقصى تراجع'),
      a.risk && a.risk.available ? (a.risk.max_drawdown * 100).toFixed(2) + '%' : withheld);

    box.appendChild(table([t('Measure', 'المقياس'), t('Value', 'القيمة')], rows));

    if (a.allocation && a.allocation.available) {
      var allocRows = a.allocation.positions.map(function (x) {
        return el('tr', null, [td(x.symbol), td((x.weight * 100).toFixed(2) + '%'), td(x.basis)]);
      });
      box.appendChild(el('h4', { text: t('Allocation', 'التوزيع') }));
      box.appendChild(table([t('Symbol', 'الرمز'), t('Weight', 'الوزن'), t('Valued by', 'أساس التقييم')], allocRows));
    }
    box.appendChild(el('p', {
      'class': 'market-copy',
      text: isAr ? a.disclaimer_ar : a.disclaimer_en,
      style: 'margin-block-start:12px;font-size:.9rem',
    }));
  }

  // ---------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------
  function load() {
    var path = slug
      ? '/api/account/portfolios?slug=' + encodeURIComponent(slug)
      : '/api/account/portfolios';
    return S.apiFetch(path)
      .then(function (data) { if (slug) renderDetail(data); else renderList(data); })
      .catch(function (err) {
        clear(root);
        if (err && err.status === 401) { S.renderSignedOutCta(root, isAr); return; }
        root.appendChild(panel([
          el('p', { 'class': 'market-copy', text: describeError(err) }),
          button(t('Try again', 'حاول مجددا'), function () { load(); }),
        ]));
      });
  }

  S.waitForClerk()
    .then(function (clerk) {
      if (!clerk.user) { clear(root); S.renderSignedOutCta(root, isAr); return null; }
      return load();
    })
    .catch(function (err) {
      clear(root);
      root.appendChild(panel([el('p', { 'class': 'market-copy', text: describeError(err) })]));
    });
}());
