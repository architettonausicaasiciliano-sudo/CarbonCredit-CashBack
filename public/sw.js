const CACHE_NAME = 'mysafehaven-v2.1.0';

// Elenco degli asset critici da archiviare offline
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/checkout.html',
  '/success.html',
  '/public/success.html',
  '/premium.html',
  '/style.css',
  '/app.js',
  '/premium.js',
  '/manifest.json',
  '/protected/dashboard.html',
  '/protected/emergency.html',
  '/protected/scenarios/blackout.html',
  '/protected/scenarios/cbrn.html',
  '/protected/scenarios/conflict.html',
  '/protected/scenarios/disaster.html',
  '/offline/evacuation-guide.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
];

// Installazione: Pre-caching tollerante che impedisce il blocco dell'installazione se un file non viene trovato
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[Service Worker] Pre-caching degli asset critici');
      await Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[Service Worker] Errore salvataggio in cache per ${url}:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
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

// Fetch Strategy: Stale-While-Revalidate con Fallback Offline per le pagine HTML
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve da cache e aggiorna in background se c'è connessione
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
        // Fallback quando la rete è assente durante la navigazione HTML
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return (
            (await caches.match('/success.html')) ||
            (await caches.match('/public/success.html')) ||
            (await caches.match('/protected/dashboard.html')) ||
            (await caches.match('/offline/evacuation-guide.html'))
          );
        }
      });
    })
  );
});