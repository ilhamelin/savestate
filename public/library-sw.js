/* global self, caches, fetch, URL, Request */
const CACHE = 'savestate-library-shell-v1';
const ASSETS = ['/offline-library/index.html', '/offline-library/style.css', '/offline-library/app.mjs', '/offline-library/store.mjs'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { credentials: 'omit', cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('savestate-library-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate' && ['/', '/library', '/library/'].includes(url.pathname)) {
    // Network denial/redirects are authoritative. Only a transport failure opens the local reader.
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline-library/index.html')));
  } else if (ASSETS.includes(url.pathname) && !url.search) {
    event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
  }
});
