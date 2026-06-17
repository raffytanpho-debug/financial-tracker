const CACHE = '₱tracker-v18';
// Static assets cached long-term. index.html is intentionally NOT precached
// here; instead the fetch handler keeps a fresh copy on every successful load
// (network-first) so online users never get stale code.
const ASSETS = [
  './manifest.json',
  './icon/icon-192.png',
  './icon/icon-512.png',
  './icon/icon-maskable-512.png',
  './icon/apple-touch-icon-180.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = req.url;

  // App shell (HTML documents): stale-while-revalidate. Serve the cached shell
  // instantly (no network wait), then refresh the cache in the background for the
  // next launch. Falls back to cache when offline. This fixes the 20-30s blank
  // screen on slow mobile networks where the old network-first wait blocked paint.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match('./index.html').then(cached => {
          const network = fetch(req).then(res => {
            if (res && res.ok) cache.put('./index.html', res.clone());
            return res;
          }).catch(() => cached || cache.match('./'));
          return cached || network;
        })
      )
    );
    return;
  }

  // API / auth calls: always go to the network, never serve stale data.
  if (url.includes('open.er-api.com') || url.includes('workers.dev') ||
      url.includes('accounts.google.com') || url.includes('googleapis.com')) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Cache-first for static assets (Chart.js, icons, manifest)
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put(req, clone)));
      }
      return res;
    }))
  );
});
