const CACHE_NAME = 'carboncredit-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/checkout.html',
  '/style.css',
  '/manifest.json',
  '/success.html'
];

// Installazione: Pre-cache degli asset e attivazione immediata
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Forza il nuovo Service Worker ad attivarsi subito
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Attivazione: Pulizia delle vecchie versioni della cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eliminazione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy: Stale-While-Revalidate con Fallback Offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve da cache e aggiorna in background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(async () => {
        // Fallback quando non c'è connessione durante la navigazione HTML
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return (
            (await caches.match('/index.html')) ||
            (await caches.match('/success.html'))
          );
        }
      });
    })
  );
});