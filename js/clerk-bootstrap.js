/* Phase 220 activation — Clerk browser SDK bootstrap.
 *
 * Loads Clerk's hosted browser SDK from the provisioned frontend API
 * (derived from CLERK_INSTANCE_URL), initializes with the PUBLIC
 * publishable key emitted by tools/inject-clerk-config.js, and mounts
 * Clerk's hosted UI components onto the page-local containers.
 *
 * Page contract (each /account/<surface>/ page declares):
 *   <div data-clerk-mount="sign-in" hidden></div>   // sign-in page
 *   <div data-clerk-mount="sign-up" hidden></div>   // sign-up page
 *   <div data-clerk-mount="user-profile" hidden></div> // profile page
 *   <div data-clerk-status="loading|signed-in|signed-out|unconfigured"></div>
 *
 * When config is missing (local dev, no provisioning, contract phase):
 * shows the unconfigured fallback message and skips SDK loading. The
 * authentication SECRET key is never read here — only the PUBLIC
 * publishable key, which is safe to embed in client code by design.
 */
(function () {
  'use strict';

  const config = window.__CLERK_CONFIG__ || { mode: 'unconfigured' };
  const statusEl = document.querySelector('[data-clerk-status]');
  const showStatus = (state, message) => {
    if (!statusEl) return;
    statusEl.setAttribute('data-clerk-status', state);
    if (message) statusEl.textContent = message;
  };

  if (config.mode !== 'hosted' || !config.publishable_key || !config.instance_url) {
    showStatus('unconfigured', '');
    return;
  }

  // Derive Clerk's frontend API host from the instance URL.
  // e.g. https://sunny-herring-70.clerk.accounts.dev -> sunny-herring-70.clerk.accounts.dev
  const frontendApi = config.instance_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = 'https://' + frontendApi + '/npm/@clerk/clerk-js@5/dist/clerk.browser.js';
  script.setAttribute('data-clerk-publishable-key', config.publishable_key);

  script.addEventListener('load', async () => {
    try {
      if (!window.Clerk) { showStatus('error', 'Clerk SDK did not register on window.'); return; }
      await window.Clerk.load();
      const user = window.Clerk.user;
      const signedIn = !!user;
      showStatus(signedIn ? 'signed-in' : 'signed-out', '');

      // Mount per-page UI components onto declared containers.
      const mounts = document.querySelectorAll('[data-clerk-mount]');
      mounts.forEach((node) => {
        const kind = node.getAttribute('data-clerk-mount');
        node.hidden = false;
        try {
          if (kind === 'sign-in' && !signedIn) {
            window.Clerk.mountSignIn(node, { afterSignInUrl: '/account/verify/', afterSignUpUrl: '/account/verify/' });
          } else if (kind === 'sign-up' && !signedIn) {
            window.Clerk.mountSignUp(node, { afterSignInUrl: '/account/verify/', afterSignUpUrl: '/account/verify/' });
          } else if (kind === 'user-profile' && signedIn) {
            window.Clerk.mountUserProfile(node);
          } else if (kind === 'user-button' && signedIn) {
            window.Clerk.mountUserButton(node, { afterSignOutUrl: '/' });
          }
        } catch (mountError) {
          // Mount failures should not break the page; surface a status hint.
          console.warn('[clerk] mount(' + kind + ') failed:', mountError);
        }
      });

      // Verify page — when Clerk processes a callback and a session lands,
      // forward the user to their profile. If still signed-out (e.g. user
      // hit the URL directly), surface a sign-in CTA.
      const verifyHook = document.querySelector('[data-clerk-verify-callback]');
      if (verifyHook) {
        if (signedIn) {
          window.location.replace('/account/profile/');
        } else {
          verifyHook.textContent = verifyHook.getAttribute('data-not-signed-in-text') || 'Not signed in.';
        }
      }
    } catch (loadError) {
      console.error('[clerk] load failed:', loadError);
      showStatus('error', 'Authentication service unavailable.');
    }
  });

  script.addEventListener('error', () => {
    showStatus('error', 'Failed to load authentication service.');
  });

  document.head.appendChild(script);
})();
