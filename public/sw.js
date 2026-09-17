/**
 * Service worker: makes the website work offline after the first visit.
 *
 * This matters more here than for most sites. The whole selling point is that
 * the work happens on your device — so the page having to phone home just to
 * load would undercut it. After one visit, SizeFit runs with the network off.
 *
 * Strategy, chosen to avoid the classic "stuck on a stale build" trap:
 * - Navigations (the HTML): network first, cache as fallback. A deploy is
 *   picked up on the next online visit.
 * - Hashed build assets under /_expo/: cache first. Their filenames contain a
 *   content hash, so a cached copy can never be the wrong version.
 * - Everything else: network, falling back to cache.
 */
const VERSION = 'sizefit-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      // addAll rejects the whole batch if any single request fails, which
      // would leave the worker uninstalled; tolerate individual misses.
      .then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html').then((hit) => hit ?? Response.error())),
    );
    return;
  }

  const isHashedAsset = url.pathname.startsWith('/_expo/') || url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put(request, copy));
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request).then((hit) => hit ?? Response.error())));
});
