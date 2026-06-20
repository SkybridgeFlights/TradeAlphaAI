/* /account/watchlists/ — personal watchlists CRUD + entity CRUD.
 *
 * Flow:
 *  1. GET /api/account/watchlists → render list
 *  2. "New watchlist" → POST /api/account/watchlists
 *  3. Per-watchlist: delete button → DELETE; add entity form → POST
 *     /api/account/watchlists/entities; remove entity → DELETE
 *
 * The Postgres tier ceiling is enforced server-side. Symbol validation
 * against the asset/sector/equity/etf registry is a future hardening
 * pass — today the server accepts any non-empty string for the
 * symbol + slug.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('[data-account-app="watchlists"]');
    if (!root) return;
    const helpers = window.__AccountApp__ || {};
    const isAr = document.documentElement.lang === 'ar';
    const t = (en, ar) => (isAr ? ar : en);
    const e = helpers.escapeHtml;

    let clerk;
    try { clerk = await helpers.waitForClerk(); }
    catch (err) { helpers.renderError(root, err, isAr); return; }
    if (!clerk.user) { helpers.renderSignedOutCta(root, isAr); return; }

    async function render() {
      let data;
      try { data = await helpers.apiFetch('/api/account/watchlists'); }
      catch (err) { helpers.renderError(root, err, isAr); return; }
      const lists = data.watchlists || [];
      const tplWl = (w) => {
        const entitiesHtml = (w.entities || []).map((en) =>
          '<li>' + e(en.symbol) + ' · ' + e(en.type)
          + ' <button data-rm-entity="1" data-wl-slug="' + e(w.slug) + '" data-type="' + e(en.type) + '" data-symbol="' + e(en.symbol) + '" type="button" style="margin-left:6px;background:transparent;color:#b5523f;border:1px solid #3a4250;padding:2px 6px;border-radius:3px;cursor:pointer;font-size:11px">×</button></li>').join('');
        return '<article class="market-card" data-wl="' + e(w.slug) + '">'
          + '<span class="market-card-kicker">' + e(t('Watchlist', 'قائمة متابعة')) + ' · ' + e(w.slug) + '</span>'
          + '<h3>' + e(isAr ? w.title_ar : w.title_en) + '</h3>'
          + (w.thesis_en || w.thesis_ar ? '<p class="market-copy">' + e(isAr ? (w.thesis_ar || w.thesis_en) : (w.thesis_en || w.thesis_ar)) + '</p>' : '')
          + '<ul class="market-copy" style="padding-left:18px;margin:8px 0">' + (entitiesHtml || '<li style="opacity:0.6">' + e(t('no entities yet', 'لا توجد كيانات بعد')) + '</li>') + '</ul>'
          + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'
          + '<select data-add-type style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:4px;border-radius:3px;font-size:12px">'
          + ['asset', 'sector', 'equity', 'etf'].map((tt) => '<option value="' + tt + '">' + tt + '</option>').join('') + '</select>'
          + '<input data-add-symbol placeholder="' + e(t('SYMBOL', 'الرمز')) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:4px;border-radius:3px;font-size:12px;width:80px;text-transform:uppercase" />'
          + '<input data-add-slug placeholder="' + e(t('slug', 'الرابط')) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:4px;border-radius:3px;font-size:12px;width:80px" />'
          + '<button data-add-entity="1" data-wl-slug="' + e(w.slug) + '" type="button" style="background:#1f6f5c;color:#0b0e13;border:none;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:12px;font-weight:600">' + e(t('Add', 'أضف')) + '</button>'
          + '<button data-del-wl="1" data-wl-slug="' + e(w.slug) + '" type="button" style="margin-left:auto;background:transparent;color:#b5523f;border:1px solid #3a4250;padding:4px 10px;border-radius:3px;cursor:pointer;font-size:12px">' + e(t('Delete watchlist', 'احذف القائمة')) + '</button>'
          + '</div></article>';
      };
      root.innerHTML = '<div class="market-panel">'
        + '<h3 style="margin-top:0">' + e(t('Your personal watchlists', 'قوائم متابعتك الشخصية')) + ' <span style="opacity:0.6;font-weight:400">(' + lists.length + ')</span></h3>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">'
        + '<input data-new-slug placeholder="' + e(t('slug (e.g. my-tech)', 'الرابط (مثلاً my-tech)')) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:6px 10px;border-radius:4px;width:160px" />'
        + '<input data-new-en placeholder="' + e(t('Title (EN)', 'العنوان (EN)')) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:6px 10px;border-radius:4px;width:180px" />'
        + '<input data-new-ar placeholder="' + e(t('Title (AR)', 'العنوان (عربي)')) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:6px 10px;border-radius:4px;width:180px" />'
        + '<button data-new-create type="button" style="background:#1f6f5c;color:#0b0e13;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600">' + e(t('Create watchlist', 'أنشئ قائمة')) + '</button>'
        + '</div>'
        + '<div class="market-grid three">' + (lists.map(tplWl).join('') || ('<p class="market-copy">' + e(t('No personal watchlists yet. Create one above.', 'لا توجد قوائم متابعة شخصية بعد. أنشئ واحدة أعلاه.')) + '</p>')) + '</div>'
        + '<div data-toast style="margin-top:12px;padding:8px 12px;border-radius:4px;background:#1f6f5c;color:#0b0e13;font-weight:600;opacity:0;transition:opacity 0.2s"></div>'
        + '</div>';
    }

    await render();

    const toastNode = () => root.querySelector('[data-toast]');

    root.addEventListener('click', async (ev) => {
      const t = (en, ar) => (isAr ? ar : en);
      // CREATE new watchlist
      if (ev.target.matches('[data-new-create]')) {
        const slug = root.querySelector('[data-new-slug]').value.trim();
        const title_en = root.querySelector('[data-new-en]').value.trim();
        const title_ar = root.querySelector('[data-new-ar]').value.trim();
        if (!slug || !title_en || !title_ar) { helpers.toast(toastNode(), t('slug + EN + AR titles required', 'الرابط + EN + AR مطلوب'), 'err'); return; }
        try { await helpers.apiFetch('/api/account/watchlists', { method: 'POST', body: { slug, title_en, title_ar } }); helpers.toast(toastNode(), t('Created', 'تم الإنشاء'), 'ok'); await render(); }
        catch (err) { helpers.toast(toastNode(), t('Create failed: ', 'فشل الإنشاء: ') + (err.message || err), 'err'); }
        return;
      }
      // DELETE watchlist
      if (ev.target.matches('[data-del-wl]')) {
        const slug = ev.target.getAttribute('data-wl-slug');
        if (!confirm(t('Delete watchlist "' + slug + '" and all its entities?', 'حذف القائمة "' + slug + '" وكلّ كياناتها؟'))) return;
        try { await helpers.apiFetch('/api/account/watchlists?slug=' + encodeURIComponent(slug), { method: 'DELETE' }); helpers.toast(toastNode(), t('Deleted', 'تم الحذف'), 'ok'); await render(); }
        catch (err) { helpers.toast(toastNode(), t('Delete failed: ', 'فشل الحذف: ') + (err.message || err), 'err'); }
        return;
      }
      // ADD entity to watchlist
      if (ev.target.matches('[data-add-entity]')) {
        const wlNode = ev.target.closest('[data-wl]');
        const wl_slug = ev.target.getAttribute('data-wl-slug');
        const type = wlNode.querySelector('[data-add-type]').value;
        const symbol = (wlNode.querySelector('[data-add-symbol]').value || '').toUpperCase().trim();
        const slug = (wlNode.querySelector('[data-add-slug]').value || '').toLowerCase().trim();
        if (!symbol || !slug) { helpers.toast(toastNode(), t('symbol + slug required', 'الرمز + slug مطلوب'), 'err'); return; }
        try { await helpers.apiFetch('/api/account/watchlists/entities', { method: 'POST', body: { watchlist_slug: wl_slug, type, symbol, slug } }); helpers.toast(toastNode(), t('Added', 'تم الإضافة'), 'ok'); await render(); }
        catch (err) { helpers.toast(toastNode(), t('Add failed: ', 'فشل الإضافة: ') + (err.message || err), 'err'); }
        return;
      }
      // REMOVE entity
      if (ev.target.matches('[data-rm-entity]')) {
        const wl_slug = ev.target.getAttribute('data-wl-slug');
        const type = ev.target.getAttribute('data-type');
        const symbol = ev.target.getAttribute('data-symbol');
        try { await helpers.apiFetch('/api/account/watchlists/entities?watchlist_slug=' + encodeURIComponent(wl_slug) + '&type=' + encodeURIComponent(type) + '&symbol=' + encodeURIComponent(symbol), { method: 'DELETE' }); helpers.toast(toastNode(), t('Removed', 'تمت الإزالة'), 'ok'); await render(); }
        catch (err) { helpers.toast(toastNode(), t('Remove failed: ', 'فشل الإزالة: ') + (err.message || err), 'err'); }
      }
    });
  });
})();
