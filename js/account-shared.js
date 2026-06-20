/* Shared helpers for /account/* app modules.
 * - waitForClerk(): resolves when window.Clerk is loaded + ready
 * - apiFetch(path, opts): adds Bearer token + JSON content-type, parses response
 * - escapeHtml: tiny xss-safe rendering helper
 * - toast(node, text, kind): inline status pill
 *
 * Each account-app JS file calls waitForClerk() first; if no user is
 * signed in it renders a "sign in to continue" CTA and bails. Otherwise
 * it fetches data via apiFetch() and renders.
 */
(function () {
  'use strict';

  const POLL_INTERVAL_MS = 60;
  const MAX_POLL_MS = 8000;

  async function waitForClerk() {
    const start = Date.now();
    while (Date.now() - start < MAX_POLL_MS) {
      if (window.Clerk && window.Clerk.loaded) return window.Clerk;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('Clerk SDK did not load within ' + MAX_POLL_MS + 'ms');
  }

  async function apiFetch(path, opts) {
    opts = opts || {};
    const clerk = await waitForClerk();
    if (!clerk.user) throw Object.assign(new Error('not signed in'), { status: 401 });
    const token = await clerk.session.getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, opts.headers || {});
    const resp = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    });
    const text = await resp.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
    if (!resp.ok) {
      const err = new Error((json && json.error) || ('HTTP ' + resp.status));
      err.status = resp.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(node, text, kind) {
    if (!node) return;
    node.textContent = text;
    node.setAttribute('data-toast-kind', kind || 'info');
    node.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { node.style.opacity = '0'; }, 2400);
  }

  function renderSignedOutCta(root, isAr) {
    const t = (en, ar) => (isAr ? ar : en);
    root.innerHTML = '<div class="market-panel"><p class="market-copy">'
      + escapeHtml(t('Sign in to load your account data.', 'سجّل الدخول لتحميل بيانات حسابك.'))
      + ' <a href="' + (isAr ? '/ar' : '') + '/account/sign-in/">' + escapeHtml(t('Sign in', 'تسجيل الدخول')) + '</a></p></div>';
  }

  function renderError(root, err, isAr) {
    const t = (en, ar) => (isAr ? ar : en);
    const msg = (err && err.message) ? err.message : String(err);
    root.innerHTML = '<div class="market-panel"><p class="market-copy" style="color:#b5523f">'
      + escapeHtml(t('Could not load: ', 'تعذّر التحميل: ') + msg)
      + '</p></div>';
  }

  window.__AccountApp__ = { waitForClerk, apiFetch, escapeHtml, toast, renderSignedOutCta, renderError };
})();
