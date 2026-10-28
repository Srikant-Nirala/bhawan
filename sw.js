// Bump VERSION whenever you re-host the app files.
const VERSION = 'rent-manager-v193';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];
const PAGE_WAIT_MS = 4000; // slow / half-dead connection: show the saved copy of the app instead of waiting

// Install: always download a fresh copy of every file (bypass the browser's HTTP cache).
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u =>
        fetch(new Request(u, { cache: 'reload' })).then(r => { if (!r.ok) throw new Error(u); return c.put(u, r); })
      )))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only the app files are handled here. Google (data) calls are never touched: the app's data copy lives on the phone
// and is shown when there is no internet, while every save goes straight to Google (see index.html).
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (r.mode === 'navigate') {
      // The app page: network first so updates show immediately; the saved copy is used when offline or too slow.
      const saved = async () => (await cache.match(r, { ignoreSearch: true })) || (await cache.match('index.html')) || (await cache.match('./'));
      const net = fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) cache.put('index.html', res.clone()); return res; });
      e.waitUntil(net.catch(() => {}));
      try {
        return await Promise.race([net, new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), PAGE_WAIT_MS))]);
      } catch (err) {
        return (await saved()) || Response.error();
      }
    }
    // Icons, manifest, etc.: cache first, refreshed in the background.
    const hit = await cache.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) cache.put(r, res.clone()); return res; }).catch(() => null);
    e.waitUntil(net);
    return hit || (await net) || Response.error();
  })());
});
