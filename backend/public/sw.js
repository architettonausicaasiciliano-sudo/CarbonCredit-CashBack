const CACHE_NAME = 'mysafehaven-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/checkout.html',
  '/dashboard.html'
];

// Installazione: salva i file chiave nella cache del browser
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Attivazione: pulisce le vecchie cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Rimozione vecchia cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve i file dalla cache se manca la connessione internet
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        // Se si è offline e la risorsa non è in cache, rimanda alla dashboard salvata
        if (event.request.mode === 'navigate') {
          return caches.match('/dashboard.html');
        }
      });
    })
  );
});