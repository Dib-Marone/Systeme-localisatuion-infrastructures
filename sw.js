/* Service worker : fonctionne hors-ligne après la 1re visite */
const VER = 'ft-v2';
const SHELL = ['./', 'index.html', 'css/style.css', 'js/app.js', 'js/data.js', 'js/forms.js', 'libs/leaflet/leaflet.js', 'libs/leaflet/leaflet.css', 'libs/xlsx.full.min.js', 'libs/proj4.js',
  'libs/leaflet/images/layers.png', 'libs/leaflet/images/layers-2x.png', 'libs/leaflet/images/marker-icon.png', 'libs/leaflet/images/marker-shadow.png', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
const TILES = 'ft-tiles';
self.addEventListener('install', e => { e.waitUntil(caches.open(VER).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VER && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'routing.openstreetmap.de') return; // itinéraires : réseau uniquement
  if (/tile\.openstreetmap\.fr$/.test(u.hostname) || u.hostname === 'server.arcgisonline.com') { // tuiles : cache d'abord
    e.respondWith(caches.open(TILES).then(c => c.match(r).then(hit => hit || fetch(r).then(res => { if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone()); return res; }).catch(() => new Response('', { status: 504 })))));
    return;
  }
  if (u.origin === location.origin) { // appli : réseau d'abord (mises à jour), cache en secours
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(VER).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match('index.html'))));
  }
});
