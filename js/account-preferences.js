/* /account/preferences/ — load + save user preference overrides via
 * GET/PUT/DELETE /api/account/preferences. Preference NAMES + their
 * ALLOWED VALUES are read from the static data/intelligence/preferences.json
 * artifact (already exposed via the page render or fetched at runtime).
 *
 * UI: one <select> per allowed preference key. Current override = pre-
 * selected option; "default" option (no override) is at the top.
 * Change a select → PUT to the API → toast on success.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('[data-account-app="preferences"]');
    if (!root) return;
    const helpers = window.__AccountApp__ || {};
    const isAr = document.documentElement.lang === 'ar';
    const t = (en, ar) => (isAr ? ar : en);

    let clerk;
    try { clerk = await helpers.waitForClerk(); }
    catch (err) { helpers.renderError(root, err, isAr); return; }
    if (!clerk.user) { helpers.renderSignedOutCta(root, isAr); return; }

    // Load allowed enum from the static contract artifact + current overrides
    // from the API in parallel.
    let allowed = null, overridesMap = {};
    try {
      const [contract, mine] = await Promise.all([
        fetch('/data/intelligence/preferences.json', { cache: 'no-store' }).then((r) => r.json()),
        helpers.apiFetch('/api/account/preferences'),
      ]);
      allowed = contract.allowed || {};
      const defaults = contract.defaults || {};
      for (const k of Object.keys(allowed)) overridesMap[k] = { value: defaults[k] || allowed[k][0], is_override: false, updated_at: null };
      for (const row of (mine.overrides || [])) overridesMap[row.name] = { value: row.value, is_override: true, updated_at: row.updated_at };
    } catch (err) { helpers.renderError(root, err, isAr); return; }

    const labels = {
      preferred_language: t('Language', 'اللغة'),
      preferred_homepage: t('Homepage', 'الصفحة الرئيسية'),
      preferred_entity_type: t('Default entity type', 'نوع الكيان الافتراضي'),
      preferred_research_view: t('Research view', 'عرض الأبحاث'),
      preferred_workspace_layout: t('Workspace layout', 'تخطيط مساحة العمل'),
      preferred_market_focus: t('Market focus', 'تركيز السوق'),
    };

    const tplRow = (key) => {
      const o = overridesMap[key];
      const opts = allowed[key].map((v) => '<option value="' + helpers.escapeHtml(v) + '"' + (v === o.value ? ' selected' : '') + '>' + helpers.escapeHtml(v) + '</option>').join('');
      return '<tr><td>' + helpers.escapeHtml(labels[key] || key) + '<br><code style="opacity:0.6;font-size:11px">' + helpers.escapeHtml(key) + '</code></td>'
        + '<td><select data-pref-key="' + helpers.escapeHtml(key) + '" style="background:#0b0e13;color:#eef2ec;border:1px solid #3a4250;padding:6px;border-radius:4px;min-width:160px">' + opts + '</select></td>'
        + '<td style="font-size:12px;opacity:0.7">' + (o.is_override ? t('custom', 'مخصّص') : t('default', 'افتراضي')) + '</td>'
        + '<td><button data-pref-reset="' + helpers.escapeHtml(key) + '" type="button" style="background:transparent;color:#b5523f;border:1px solid #3a4250;padding:4px 8px;border-radius:4px;cursor:pointer">' + helpers.escapeHtml(t('reset', 'إعادة')) + '</button></td></tr>';
    };

    root.innerHTML = '<div class="market-panel">'
      + '<table class="market-table" style="width:100%;border-collapse:collapse">'
      + '<thead><tr><th style="text-align:left">' + helpers.escapeHtml(t('Preference', 'التفضيل')) + '</th>'
      + '<th style="text-align:left">' + helpers.escapeHtml(t('Value', 'القيمة')) + '</th>'
      + '<th style="text-align:left">' + helpers.escapeHtml(t('State', 'الحالة')) + '</th>'
      + '<th></th></tr></thead>'
      + '<tbody>' + Object.keys(allowed).map(tplRow).join('') + '</tbody></table>'
      + '<div data-toast style="margin-top:12px;padding:8px 12px;border-radius:4px;background:#1f6f5c;color:#0b0e13;font-weight:600;opacity:0;transition:opacity 0.2s"></div>'
      + '</div>';

    const toastNode = root.querySelector('[data-toast]');

    root.addEventListener('change', async (e) => {
      const sel = e.target.closest('select[data-pref-key]');
      if (!sel) return;
      const name = sel.getAttribute('data-pref-key');
      const value = sel.value;
      sel.disabled = true;
      try {
        await helpers.apiFetch('/api/account/preferences', { method: 'PUT', body: { name, value } });
        overridesMap[name] = { value, is_override: true, updated_at: new Date().toISOString() };
        const stateCell = sel.closest('tr').children[2];
        if (stateCell) stateCell.textContent = t('custom', 'مخصّص');
        helpers.toast(toastNode, t('Saved', 'تم الحفظ'), 'ok');
      } catch (err) {
        helpers.toast(toastNode, t('Save failed: ', 'فشل الحفظ: ') + (err.message || err), 'err');
      } finally {
        sel.disabled = false;
      }
    });

    root.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-pref-reset]');
      if (!btn) return;
      const name = btn.getAttribute('data-pref-reset');
      btn.disabled = true;
      try {
        await helpers.apiFetch('/api/account/preferences?name=' + encodeURIComponent(name), { method: 'DELETE' });
        // Refresh to show the default value.
        const defaults = (await fetch('/data/intelligence/preferences.json', { cache: 'no-store' }).then((r) => r.json())).defaults || {};
        const sel = root.querySelector('select[data-pref-key="' + name + '"]');
        if (sel) sel.value = defaults[name] || allowed[name][0];
        overridesMap[name] = { value: sel.value, is_override: false, updated_at: null };
        const stateCell = sel.closest('tr').children[2];
        if (stateCell) stateCell.textContent = t('default', 'افتراضي');
        helpers.toast(toastNode, t('Reset', 'تمت الإعادة'), 'ok');
      } catch (err) {
        helpers.toast(toastNode, t('Reset failed: ', 'فشل الإعادة: ') + (err.message || err), 'err');
      } finally {
        btn.disabled = false;
      }
    });
  });
})();
