/* /account/ — personal dashboard.
 * Welcome hero with avatar + tier badge, 4 quick-stat tiles, 4 action
 * cards (Markets / Watchlists / Preferences / Alerts), recent activity
 * feed, secondary actions (Profile / Sign out).
 *
 * Pure server-truth — no fabricated counts. When signed out shows a
 * tasteful Sign-in prompt with a preview of what the dashboard offers.
 */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', async () => {
    const root = document.querySelector('[data-account-app="dashboard"]');
    if (!root) return;
    const helpers = window.__AccountApp__ || {};
    const isAr = document.documentElement.lang === 'ar';
    const t = (en, ar) => (isAr ? ar : en);
    const e = helpers.escapeHtml;

    let clerk;
    try { clerk = await helpers.waitForClerk(); }
    catch (err) { renderSignedOutTeaser(); return; }
    if (!clerk.user) { renderSignedOutTeaser(); return; }

    // Skeleton loader while the API call lands.
    root.innerHTML = '<div class="account-dash-skeleton"><div></div><div></div><div></div></div>';

    let data;
    try { data = await helpers.apiFetch('/api/account/dashboard'); }
    catch (err) { helpers.renderError(root, err, isAr); return; }

    const user = clerk.user;
    const account = data.account || {};
    const counts = data.counts || {};
    const recent = data.recent_preference_changes || [];

    const displayName = user.fullName || ((user.firstName || '') + ' ' + (user.lastName || '')).trim() || (user.primaryEmailAddress && user.primaryEmailAddress.emailAddress) || t('Member', 'عضو');
    const tier = (account.tier || 'free').toLowerCase();
    const tierLabel = {
      free: t('Free', 'مجاني'),
      premium: t('Premium', 'بريميوم'),
      institutional: t('Institutional', 'مؤسسي'),
    }[tier] || tier;
    const lastSeen = account.last_seen_at ? new Date(account.last_seen_at) : new Date();
    const since = account.created_at ? new Date(account.created_at) : null;
    const fmtDate = (d) => d ? new Intl.DateTimeFormat(isAr ? 'ar' : 'en', { dateStyle: 'medium' }).format(d) : '—';

    const avatarHtml = user.imageUrl
      ? '<img src="' + e(user.imageUrl) + '" alt="" />'
      : '<span class="account-dash-avatar-fallback">' + e((displayName.charAt(0) || '?').toUpperCase()) + '</span>';

    const stat = (label, value, hint) =>
      '<article class="account-stat-card"><span class="account-stat-label">' + e(label) + '</span><strong class="account-stat-value">' + e(value) + '</strong>' + (hint ? '<span class="account-stat-hint">' + e(hint) + '</span>' : '') + '</article>';

    const action = (icon, title, copy, href, primary) =>
      '<a class="account-action-card' + (primary ? ' is-primary' : '') + '" href="' + e((isAr ? '/ar' : '') + href) + '">'
      + '<span class="account-action-icon" aria-hidden="true">' + icon + '</span>'
      + '<span class="account-action-body"><strong>' + e(title) + '</strong><span>' + e(copy) + '</span></span>'
      + '<span class="account-action-arrow" aria-hidden="true">' + (isAr ? '←' : '→') + '</span>'
      + '</a>';

    const ICONS = {
      markets: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
      watchlist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h13l5 5v9a2 2 0 0 1-2 2H3z"/><path d="M3 9h18"/></svg>',
      preferences: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.4l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.4-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
      alerts: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></svg>',
      research: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/></svg>',
    };

    root.innerHTML =
      '<section class="account-dash-hero">'
      +   '<div class="account-dash-hero-row">'
      +     '<div class="account-dash-identity">'
      +       '<div class="account-dash-avatar">' + avatarHtml + '</div>'
      +       '<div class="account-dash-greeting">'
      +         '<span class="account-dash-eyebrow">' + e(t('Signed in', 'مسجَّل الدخول')) + '</span>'
      +         '<h1>' + e(t('Welcome back, ', 'مرحباً بعودتك، ') + displayName) + '</h1>'
      +         '<span class="account-dash-meta">'
      +           '<span class="account-tier-badge account-tier-' + e(tier) + '">' + e(tierLabel) + '</span>'
      +           ' <span>' + e(t('Member since ', 'عضو منذ ') + fmtDate(since)) + '</span>'
      +           ' · <span>' + e(t('Last seen ', 'آخر زيارة ') + fmtDate(lastSeen)) + '</span>'
      +         '</span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</section>'
      + '<section class="account-stats-grid">'
      +   stat(t('Personal watchlists', 'قوائم متابعتك'), counts.watchlists || 0, t('groups', 'مجموعات'))
      +   stat(t('Tracked entities', 'كيانات مرصودة'), counts.watchlist_entities || 0, t('symbols across watchlists', 'رمزاً عبر القوائم'))
      +   stat(t('Preference overrides', 'تجاوزات التفضيلات'), counts.preference_overrides || 0, t('vs defaults', 'مقابل الافتراضي'))
      +   stat(t('Followed targets', 'متابعات'), counts.followed || 0, t('entities, research, regimes', 'كيانات وأبحاث وأنظمة'))
      + '</section>'
      + '<section class="account-actions-grid">'
      +   action(ICONS.markets, t('Open Market Terminal', 'افتح طرفيّة السوق'), t('Live regime + macro + institutional charts', 'النظام الحيّ والماكرو والرسوم المؤسسية'), '/market-terminal/', true)
      +   action(ICONS.watchlist, t('Manage your watchlists', 'إدارة قوائم المتابعة'), t('Create, organize, add entities', 'إنشاء وتنظيم وإضافة كيانات'), '/account/watchlists/')
      +   action(ICONS.preferences, t('Personalize preferences', 'خصّص التفضيلات'), t('Language, homepage, market focus', 'اللغة والصفحة الرئيسية والتركيز'), '/account/preferences/')
      +   action(ICONS.alerts, t('Set up alerts', 'أعدّ التنبيهات'), t('Regime, ranking, leadership signals', 'إشارات النظام والترتيب والقيادة'), '/account/alerts/')
      +   action(ICONS.research, t('Browse your research', 'تصفّح أبحاثك'), t('Personalized to your watchlist', 'مخصّصة لقائمة متابعتك'), '/account/research/')
      +   action(ICONS.profile, t('Profile + identity', 'الملف الشخصي والهوية'), t('Clerk identity + server truth', 'هوية Clerk وحقيقة الخادم'), '/account/profile/')
      + '</section>'
      + (recent.length ? renderActivity(recent) : '')
      + '<section class="account-secondary-row">'
      +   '<button type="button" class="account-sign-out" data-account-signout>' + e(t('Sign out', 'تسجيل الخروج')) + '</button>'
      +   '<a class="account-secondary-link" href="' + e((isAr ? '/ar' : '') + '/account/billing/') + '">' + e(t('Billing & tiers', 'الفوترة والطبقات')) + '</a>'
      +   '<a class="account-secondary-link" href="' + e((isAr ? '/ar' : '') + '/account/mobile/') + '">' + e(t('Install mobile app', 'ثبّت تطبيق الجوال')) + '</a>'
      + '</section>';

    // Wire sign-out button to Clerk.
    const signOutBtn = root.querySelector('[data-account-signout]');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', async () => {
        signOutBtn.disabled = true;
        signOutBtn.textContent = t('Signing out…', 'يتم تسجيل الخروج…');
        try { await clerk.signOut({ redirectUrl: isAr ? '/ar/' : '/' }); }
        catch (err) {
          signOutBtn.disabled = false;
          signOutBtn.textContent = t('Sign out failed — try again', 'فشل تسجيل الخروج — أعد المحاولة');
        }
      });
    }

    function renderActivity(rows) {
      return '<section class="account-activity"><h2>' + e(t('Recent activity', 'النشاط الأخير')) + '</h2><ul>'
        + rows.map((r) => '<li><span class="account-activity-dot" aria-hidden="true"></span><span class="account-activity-text">'
          + e(t('Updated ', 'تم تحديث ') + r.name + ' → ' + r.value)
          + '</span><time>' + e(new Date(r.updated_at).toISOString().slice(0, 16).replace('T', ' ')) + ' UTC</time></li>').join('')
        + '</ul></section>';
    }

    function renderSignedOutTeaser() {
      const teaser = (icon, title, copy) =>
        '<article class="account-teaser-card"><span class="account-teaser-icon" aria-hidden="true">' + icon + '</span><strong>' + e(title) + '</strong><span>' + e(copy) + '</span></article>';
      root.innerHTML = '<section class="account-signed-out-hero">'
        + '<span class="account-dash-eyebrow">' + e(t('TradeAlpha AI account', 'حساب TradeAlpha AI')) + '</span>'
        + '<h1>' + e(t('Your personal market intelligence layer', 'طبقة استخباراتك الشخصية للسوق')) + '</h1>'
        + '<p>' + e(t('Save watchlists, customize the platform to your focus, subscribe to regime + leadership alerts, and browse research personalized to your symbols. Free to start.', 'احفظ قوائم المتابعة وخصّص المنصّة لتركيزك واشترك في تنبيهات النظام والقيادة وتصفّح أبحاثاً مخصّصة لرموزك. ابدأ مجاناً.')) + '</p>'
        + '<div class="account-signed-out-cta">'
        +   '<a class="account-cta-primary" href="' + (isAr ? '/ar' : '') + '/account/sign-up/">' + e(t('Create free account', 'أنشئ حساباً مجانياً')) + '</a>'
        +   '<a class="account-cta-secondary" href="' + (isAr ? '/ar' : '') + '/account/sign-in/">' + e(t('Sign in', 'تسجيل الدخول')) + '</a>'
        + '</div>'
        + '</section>'
        + '<section class="account-teaser-grid">'
        +   teaser(ICONS.watchlist, t('Personal watchlists', 'قوائم متابعة شخصية'), t('Up to 3 free, 25 premium, 100 institutional', 'حتى 3 مجانية و25 بريميوم و100 مؤسسية'))
        +   teaser(ICONS.preferences, t('Workspace preferences', 'تفضيلات مساحة العمل'), t('Language, homepage, market focus saved per account', 'اللغة والصفحة الرئيسية والتركيز محفوظة لكل حساب'))
        +   teaser(ICONS.alerts, t('Regime + leadership alerts', 'تنبيهات النظام والقيادة'), t('Throttled, evidence-backed, never spam', 'مُحدَّدة ومدعومة بأدلة ولا تكون إزعاجاً'))
        +   teaser(ICONS.research, t('Personalized research', 'أبحاث مخصّصة'), t('Cards derived from your symbols + entity graph', 'بطاقات مشتقّة من رموزك ومن رسم الكيانات'))
        + '</section>';
    }
  });
})();
