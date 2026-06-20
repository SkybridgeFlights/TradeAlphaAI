/* TradeAlphaAI Service Worker — Phase 227.
 * Minimal offline shell for the account-ready surfaces. Caches the
 * core navigation pages on install; on fetch falls back to the cache
 * for navigation requests when the network fails. NO push subscription
 * is registered today (push is a contract layer until a future phase).
 */
'use strict';

const VERSION = 'tradealphaai-pwa-v1';
const CORE = [
  '/',
  '/intelligence/',
  '/account/',
  '/workspace/',
  '/changes/',
  '/explorer/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((resp) => {
      if (resp && resp.status === 200 && resp.type === 'basic' && /\.(?:css|svg|png|webp|jpg|jpeg|js)$/i.test(new URL(event.request.url).pathname)) {
        const clone = resp.clone();
        caches.open(VERSION).then((cache) => cache.put(event.request, clone));
      }
      return resp;
    }).catch(() => cached))
  );
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
