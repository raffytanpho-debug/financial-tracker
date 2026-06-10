const CACHE = '₱tracker-v15';
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

  // App shell (HTML documents): network-first so online users always get the
  // freshest app code, but cache each successful response and fall back to that
  // cached shell when the network fails — instead of letting the browser show a
  // dead error page. This is the fix for "the app won't load" on flaky networks.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        e.waitUntil(caches.open(CACHE).then(c => c.put('./index.html', clone)));
        return res;
      }).catch(() =>
        caches.match('./index.html').then(c => c || caches.match('./'))
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
