// sw.js — Namaz Times Service Worker (v1.4.0)
// High-performance offline caching & instant startup for Android 9+ and modern devices

const CACHE_NAME = 'namaz-times-v1.4.0';
const SHELL_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon.svg'
];

// Install: Pre-cache core app shell assets for instant cold start
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up older cache versions immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch:
// 1. version.json -> Network-First (so update notifications fire immediately)
// 2. Shell assets -> Cache-First with background revalidation (sub-50ms instant boot)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always check remote version.json with fresh network request
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Core shell assets: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Offline fallback
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
