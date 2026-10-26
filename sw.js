// THE BOX WORLD 2 - Service Worker (PWA Offline & Asset Caching)
const CACHE_NAME = 'the-box-world-2-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/src/main.js',
  '/src/battle.js',
  '/src/world.js',
  '/src/ui.js',
  '/src/charselect.js',
  '/src/skills.js',
  '/src/monsters.js',
  '/src/gamedata.js',
  '/src/audio.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Dynamic endpoints: GRF streaming, Audio BGM, or GND terrain chunks are network-first
  if (url.pathname.startsWith('/grf/') || url.pathname.startsWith('/bgm/')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // Static shell assets: Cache-first fallback to network
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res && res.status === 200 && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => fetch(e.request))
  );
});
