// Bump VERSION whenever you re-host index.html so phones pick up the new app.
const VERSION = 'rent-manager-v1';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Same-origin GETs: answer from cache instantly, refresh the cache in the background.
// Google Apps Script calls (POST / other origin) are never touched.
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res.ok) cache.put(r, res.clone()); return res; }).catch(() => null);
    e.waitUntil(net);
    return hit || (await net) || (r.mode === 'navigate' ? cache.match('index.html') : Response.error());
  })());
});
