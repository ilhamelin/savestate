/* global self, caches, fetch, URL */
const CACHE = 'savestate-guardian-shell-v3';
const ASSETS = [
  '/guardian-assets/offline.html',
  '/guardian-assets/offline.css',
  '/guardian-assets/offline.js',
  '/guardian-assets/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('savestate-guardian-shell-') && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate' && ['/guardian', '/guardian/'].includes(url.pathname)) {
    // Never cache session HTML or private API responses; only use the public shell offline.
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/guardian-assets/offline.html')),
    );
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.match(url.pathname).then((cached) => cached || fetch(event.request)));
  }
});
