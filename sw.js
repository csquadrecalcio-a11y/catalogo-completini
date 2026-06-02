// Service Worker — Completini Squadre Calcio 2.0
const CACHE = 'calcio-v1';
const ASSETS = [
  '/catalogo-completini/',
  '/catalogo-completini/index.html',
  '/catalogo-completini/hero.jpg',
  '/catalogo-completini/logo.jpg',
  '/catalogo-completini/nuovi-arrivi.jpg',
  '/catalogo-completini/coppa-del-mondo.webp',
  '/catalogo-completini/vintage-banner.png',
  '/catalogo-completini/sneakers.png',
];

// Installazione: metti in cache le risorse principali
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Attivazione: pulisci cache vecchie
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first per assets locali, network-first per Drive API
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Google Drive / API — sempre rete, no cache
  if(url.hostname.includes('googleapis') || url.hostname.includes('googleusercontent') || url.hostname.includes('tawk.to')){
    return;
  }

  // Assets locali — cache first
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        // Metti in cache solo risposte valide
        if(res && res.status === 200 && res.type !== 'opaque'){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
