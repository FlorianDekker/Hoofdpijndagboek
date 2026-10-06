// Bij elke deploy VERSIE ophogen en de ?v= in index.html gelijk trekken.
const VERSIE = 3;
const CACHE = `hoofdpijndagboek-v${VERSIE}`;
const BESTANDEN = [
  './',
  './index.html',
  `./style.css?v=${VERSIE}`,
  `./app.js?v=${VERSIE}`,
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(BESTANDEN)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // Pagina zelf: eerst netwerk (zodat updates doorkomen), offline uit de cache.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => { const kopie = r.clone(); caches.open(CACHE).then(c => c.put('./index.html', kopie)); return r; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
