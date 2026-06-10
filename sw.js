// Service Worker — Completini Squadre Calcio 2.0
const CACHE = 'calcio-v3';
const INDEX = '/catalogo-completini/index.html';
const ASSETS = [
  '/catalogo-completini/',
  INDEX,
  '/catalogo-completini/hero.jpg',
  '/catalogo-completini/logo.jpg',
  '/catalogo-completini/nuovi-arrivi.jpg',
  '/catalogo-completini/coppa-del-mondo.webp',
  '/catalogo-completini/vintage-banner.png',
  '/catalogo-completini/sneakers.png',
];

// Installazione: precache + attiva subito senza aspettare
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Attivazione: cancella le cache vecchie e prendi il controllo delle pagine aperte
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Drive / API / chat — sempre dalla rete, mai in cache
  if (url.hostname.includes('googleapis') || url.hostname.includes('googleusercontent') || url.hostname.includes('tawk.to')) {
    return;
  }

  // Pagina HTML (navigazione) — NETWORK FIRST:
  // quando c'è internet prende SEMPRE la versione più recente; offline usa la copia salvata
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(INDEX, clone));
        return res;
      }).catch(() =>
        caches.match(req).then(r => r || caches.match(INDEX))
      )
    );
    return;
  }

  // Altri file locali (immagini) — STALE-WHILE-REVALIDATE:
  // mostra subito la copia salvata (veloce) e intanto scarica l'aggiornamento per la prossima volta
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
