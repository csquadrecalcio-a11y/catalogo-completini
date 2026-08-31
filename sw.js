// Service Worker — Completini Squadre Calcio 2.0
// Fa due cose: (1) il sito funziona anche senza rete e si installa come app,
// (2) riceve le notifiche del tracking e le mostra sul telefono del cliente.
const CACHE = 'calcio-v4';
const INDEX = '/index.html';
// Percorsi dalla RADICE del dominio: prima erano /catalogo-completini/... —
// il vecchio indirizzo di GitHub Pages — quindi su completinicalcio.it davano
// 404 e l'installazione falliva in silenzio (31/08/26).
const ASSETS = [
  '/',
  INDEX,
  '/tracking.html',
  '/logo.jpg',
  '/icona-192.png',
  '/icona-512.png',
];

// Installazione: precache tollerante (un file mancante non blocca tutto)
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => null))))
      .then(() => self.skipWaiting())
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

  // Solo il nostro dominio: API esterne, Drive e chat vanno sempre in rete
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // tracking.json cambia in continuazione: sempre dalla rete, mai dalla cache,
  // altrimenti il cliente vedrebbe uno stato vecchio del suo pacco.
  if (url.pathname.endsWith('tracking.json') || url.pathname.endsWith('clienti_noti.json')) return;

  // Pagine HTML — NETWORK FIRST: online prende sempre la versione aggiornata,
  // offline usa la copia salvata.
  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() =>
        caches.match(req).then(r => r || caches.match(INDEX))
      )
    );
    return;
  }

  // Immagini e file statici — mostra subito la copia salvata e intanto aggiorna
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

// ─── NOTIFICHE DEL TRACKING ──────────────────────────────────────────────────
self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch (err) { d = {}; }

    // Notifica "vuota" mandata dal servizio sempre acceso: non contiene testo,
    // quindi andiamo a leggere noi cosa e' successo al pacco.
    if (!d.titolo) {
      try {
        const reg = await self.registration;
        const subs = await reg.pushManager.getSubscription();
        const r = await fetch('https://csc-gruppi.worker-gruppi.workers.dev/sub/mio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subs && subs.endpoint }),
        });
        const info = await r.json();
        if (info && info.ok && info.eventi && info.eventi.length) {
          const ev = info.eventi[0];
          d = {
            titolo: info.stato_corriere === 'consegnato' ? '\uD83C\uDF89 Il tuo ordine e\u0027 arrivato!'
                  : info.stato_corriere === 'in_consegna' ? '\uD83D\uDE9A Il pacco e\u0027 in consegna oggi!'
                  : '\uD83D\uDCE6 Il tuo pacco si e\u0027 mosso',
            testo: ev.stato + (ev.luogo ? ' \u00b7 ' + ev.luogo : ''),
            url: 'https://completinicalcio.it/tracking.html?ordine=' + info.codice,
          };
        }
      } catch (err) {}
    }

    await self.registration.showNotification(d.titolo || '\uD83D\uDCE6 Aggiornamento spedizione', {
      body: d.testo || 'Il tuo pacco si e\u0027 mosso, tocca per vedere dov\u0027e\u0027.',
      icon: '/icona-192.png',
      badge: '/icona-192.png',
      tag: d.url || 'tracking',
      renotify: true,
      data: { url: d.url || '/tracking.html' },
    });
  })());
});

// Toccando la notifica si apre il link dell'ordine (riusa la scheda già aperta)
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const dest = (e.notification.data && e.notification.data.url) || '/tracking.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
      for (const c of lista) {
        if (c.url.includes('tracking.html') && 'focus' in c) { c.focus(); c.navigate(dest); return; }
      }
      return clients.openWindow(dest);
    })
  );
});
