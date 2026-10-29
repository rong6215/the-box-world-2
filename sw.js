// THE BOX WORLD 2 - Service Worker (Auto-Purge Stale Cache & Network-First)
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Always network-first so the player always gets the latest UI, sprites, and animations!
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
