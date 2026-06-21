/* TradeAlphaAI Service Worker — Phase 227 (auth-safe rev).
 *
 * Strict rules to prevent stale signed-in/signed-out header state:
 *   • NEVER cache HTML responses or navigation requests.
 *   • Navigation requests pass straight through to the network. If the
 *     network fails we fall back to a tiny offline shell (manifest +
 *     icons), never to a cached HTML body.
 *   • Only static assets (css / svg / png / webp / jpg / jpeg / js)
 *     are cached, and only after a successful network response.
 *   • Account + auth + API requests bypass the SW entirely so that
 *     authenticated server responses can never be served from cache.
 *
 * Push CONTRACT is unchanged — no subscription registered today.
 */
'use strict';

// Bump VERSION on every change to invalidate older deploys' caches.
const VERSION = 'tradealphaai-pwa-v3-auth-safe';

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

  // Static assets only: cache-first, then network, then store.
  if (/\.(?:css|svg|png|webp|jpg|jpeg|js|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(VERSION).then((cache) => cache.put(event.request, clone));
        }
        return resp;
      }).catch(() => cached)),
    );
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
