/* /account/profile/ — renders the Clerk identity + the Postgres
 * account row side-by-side. The Clerk-hosted user-profile mount
 * (managed by clerk-bootstrap.js) handles the editable fields;
 * this app adds a server-truth panel showing what TradeAlphaAI's
 * own backend knows about the account (account_id, tier,
 * created_at, last_seen_at, primary_email_hash for verification).
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('[data-account-app="profile"]');
    if (!root) return;
    const helpers = window.__AccountApp__ || {};
    const isAr = document.documentElement.lang === 'ar';
    const t = (en, ar) => (isAr ? ar : en);
    const e = helpers.escapeHtml;

    let clerk;
    try { clerk = await helpers.waitForClerk(); }
    catch (err) { helpers.renderError(root, err, isAr); return; }
    if (!clerk.user) { helpers.renderSignedOutCta(root, isAr); return; }

    // Identity from Clerk + account row from Postgres.
    const u = clerk.user;
    const clerkData = {
      sub: u.id,
      primary_email: (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || null,
      full_name: u.fullName || ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || null,
      created_at: u.createdAt ? new Date(u.createdAt).toISOString() : null,
      image_url: u.imageUrl || null,
    };

    let pg = null;
    try {
      const r = await helpers.apiFetch('/api/account/init');
      pg = r.account;
    } catch (err) { helpers.renderError(root, err, isAr); return; }

    const fmt = (iso) => iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 19) + ' UTC' : '—';
    const rowHtml = (label, value) => '<tr><td style="opacity:0.7;padding:4px 12px 4px 0">' + e(label) + '</td><td><code style="word-break:break-all">' + e(value || '—') + '</code></td></tr>';

    root.innerHTML = '<div class="market-panel">'
      + '<div style="display:flex;gap:16px;align-items:center;margin-bottom:16px">'
      + (clerkData.image_url ? '<img src="' + e(clerkData.image_url) + '" alt="" width="48" height="48" style="border-radius:50%;border:1px solid #3a4250" />' : '')
      + '<div><strong style="font-size:16px">' + e(clerkData.full_name || clerkData.primary_email || clerkData.sub) + '</strong><br><span style="opacity:0.7;font-size:12px">' + e(t('Signed in', 'مسجَّل الدخول')) + '</span></div>'
      + '</div>'
      + '<div class="market-grid two" style="gap:16px">'
      + '<div><h4 style="margin:0 0 8px">' + e(t('Clerk identity', 'هوية Clerk')) + '</h4><table style="font-size:13px;border-collapse:collapse;width:100%">'
      + rowHtml(t('user_id (sub)', 'user_id (sub)'), clerkData.sub)
      + rowHtml(t('primary_email', 'البريد الرئيسي'), clerkData.primary_email)
      + rowHtml(t('full_name', 'الاسم الكامل'), clerkData.full_name)
      + rowHtml(t('clerk created_at', 'إنشاء Clerk'), fmt(clerkData.created_at))
      + '</table></div>'
      + '<div><h4 style="margin:0 0 8px">' + e(t('TradeAlphaAI account (Postgres)', 'حساب TradeAlphaAI (Postgres)')) + '</h4><table style="font-size:13px;border-collapse:collapse;width:100%">'
      + rowHtml(t('account_id', 'account_id'), pg ? pg.account_id : null)
      + rowHtml(t('tier', 'الطبقة'), pg ? pg.tier : null)
      + rowHtml(t('locale', 'اللغة'), pg ? pg.locale : null)
      + rowHtml(t('primary_email_hash', 'تجزئة البريد'), pg && pg.primary_email_hash ? pg.primary_email_hash.slice(0, 16) + '…' : null)
      + rowHtml(t('db created_at', 'إنشاء قاعدة البيانات'), pg ? fmt(pg.created_at) : null)
      + rowHtml(t('db last_seen_at', 'آخر زيارة'), pg ? fmt(pg.last_seen_at) : null)
      + '</table></div>'
      + '</div>'
      + (pg ? '' : '<p class="market-copy" style="margin-top:12px;color:#b58b56">' + e(t('No Postgres row yet — refresh the page to call /api/account/init.', 'لا يوجد صفّ في Postgres بعد — أعد تحميل الصفحة لاستدعاء /api/account/init.')) + '</p>')
      + '</div>';
  });
})();
