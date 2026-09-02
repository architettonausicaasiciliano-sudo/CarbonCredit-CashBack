const CACHE_NAME = 'carboncredit-v3';
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
  self.skipWaiting();
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

// Fetch Strategy: Bypass per Certificate e API, Stale-While-Revalidate per il resto
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Esclude dal Service Worker il certificato B2B, le API e la cartella uploads
  if (
    url.pathname.includes('b2b-certificate.html') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/uploads/')
  ) {
    return; // Passa direttamente alla rete senza intercettazione
  }

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
        // Fallback offline escludendo la pagina del certificato
        if (
          event.request.headers.get('accept')?.includes('text/html') &&
          !url.pathname.includes('b2b-certificate.html')
        ) {
          return (
            (await caches.match('/index.html')) ||
            (await caches.match('/success.html'))
          );
        }
      });
    })
  );
});