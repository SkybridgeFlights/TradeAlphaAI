/* TradeAlphaAI Service Worker — Phase 227 (always-fresh rev).
 *
 * Goal: the user NEVER has to hard-reload (Ctrl+Shift+R) to see new
 * site content. Every navigation pulls fresh HTML. Every CSS / JS /
 * image is "stale-while-revalidate": the cached copy renders instantly
 * (no flash), and the network copy replaces it in the cache for next
 * load. So the second normal refresh always shows the new design.
 *
 * Rules:
 *   • NEVER cache HTML responses or navigation requests.
 *   • Navigation = network-only with a tiny offline fallback.
 *   • Static assets (css/svg/png/webp/jpg/jpeg/js/ico/woff2) =
 *     stale-while-revalidate: serve cache immediately, fetch network
 *     in the background, update the cache for next time. No more
 *     month-old CSS lingering in the SW cache.
 *   • Account + auth + API + Clerk bootstrap bypass the SW entirely.
 *
 * Push CONTRACT is unchanged — no subscription registered today.
 */
'use strict';

// Bump VERSION on every change to invalidate older deploys' caches.
const VERSION = 'tradealphaai-pwa-v4-swr';

self.addEventListener('install', (event) => {
  // No HTML pre-cache. The PWA install no longer ships a stale
  // homepage / account home; those must always come from the network
  // so Clerk session state has a fresh shell to hydrate.
  event.waitUntil(caches.open(VERSION));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Auth-sensitive paths must always go to the network — never the SW.
  if (/^\/(account|api)\//.test(url.pathname) || /\/clerk-(config|bootstrap)/.test(url.pathname)) {
    return; // default browser fetch
  }

  // Navigation requests: network-only. If the network fails we surface
  // a minimal text response rather than a cached HTML page (which
  // could carry stale auth state).
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => new Response(
        '<!doctype html><meta charset="utf-8"><title>Offline</title><p>You are offline.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )),
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  //   1. Return the cached copy immediately if we have one (fast paint).
  //   2. In parallel, fetch the network copy and overwrite the cache.
  //   3. Next page load (even a normal F5 / pull-to-refresh) gets the
  //      fresh version. No hard-reload required.
  if (/\.(?:css|svg|png|webp|jpg|jpeg|js|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(VERSION).then((cache) => cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((resp) => {
          if (resp && resp.status === 200 && resp.type === 'basic') {
            cache.put(event.request, resp.clone());
          }
          return resp;
        }).catch(() => cached);
        return cached || networkFetch;
      })),
    );
  }
});

// Allow the page to tell us "skip waiting" so a new SW takes control
// without forcing the user to close every tab. Combined with the
// updatefound listener in global-header.js, the user gets fresh
// content within one normal reload.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Push CONTRACT — no subscription registered today. Future activation
// will add a subscribe() call gated behind an opt-in user gesture.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(self.registration.showNotification(data.title || 'TradeAlphaAI alert', {
      body: data.body || '',
      icon: '/Image/og-image.svg',
      data: { url: data.href || '/' },
    }));
  } catch { /* ignore malformed push payloads */ }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(target));
});
