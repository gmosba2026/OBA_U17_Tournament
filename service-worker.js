/* 2026 Ontario Cup U17 Boys Tournament Hub - Service Worker
 *
 * Strategy: network-first for navigation (so users always see latest scores),
 * cache-first for static icons/manifest. JSONBin API calls are NEVER cached
 * (always live). When CACHE_VERSION changes, old caches are purged so users
 * automatically pick up new index.html on next visit.
 *
 * Bump CACHE_VERSION whenever you push a meaningful index.html change to
 * force PWA users to refresh the cached app shell.
 */
const CACHE_VERSION = 'oba-u17-v1-2026-05-28';
const CACHE_NAME = 'oba-u17-cache-' + CACHE_VERSION;

/* Files we want available offline. Index.html is intentionally NOT in here —
 * we use network-first for it so users always see the latest deploy. */
const STATIC_ASSETS = [
  '/manifest.json',
  '/pwa-icons/icon-192.png',
  '/pwa-icons/icon-512.png',
  '/pwa-icons/icon-192-maskable.png',
  '/pwa-icons/icon-512-maskable.png'
];

/* Install: pre-cache static assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        /* Don't fail installation if a single asset can't be cached */
        console.warn('[OBA-U17 SW] Some assets failed to cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

/* Activate: purge old version caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key.startsWith('oba-u17-cache-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* Fetch handler: network-first for HTML/navigations, cache-first for static.
 * Skip caching entirely for JSONBin API and any cross-origin requests. */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  /* Only handle GET requests; POSTs (sync writes) go through normally */
  if (req.method !== 'GET') return;

  /* Cross-origin requests (JSONBin, Google Fonts, etc.): bypass cache, go live */
  if (url.origin !== self.location.origin) return;

  /* Navigation requests (HTML pages): network-first with cache fallback */
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((response) => {
          /* Cache successful navigation responses for offline fallback */
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return response;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  /* Static assets: cache-first, fall back to network and cache the result */
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
