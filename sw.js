// Offline cache.
// App files (same origin): network-first, bypassing the browser's HTTP cache, so pushed updates show on the next launch;
// falls back to the cached copy when offline or when the network takes longer than 3 seconds.
// Firebase SDK and fonts: cache-first with background refresh. Firestore traffic is never touched here.
const CACHE = 'leak-lab-v5';
const SHELL = ['./', 'index.html', 'firebase-config.js', 'manifest.webmanifest', 'icon-180.png', 'icon-512.png', 'solver-data.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) { e.respondWith(networkFirst(e.request)); return; }
  if (url.host === 'www.gstatic.com' || url.host.startsWith('fonts.')) e.respondWith(cacheFirst(e.request));
});

async function networkFirst(req) {
  const c = await caches.open(CACHE);
  const net = fetch(req, { cache: 'no-cache' }).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
  const timeout = new Promise(res => setTimeout(res, 3000));
  try {
    const r = await Promise.race([net, timeout]);
    if (r) return r;
  } catch (_) { /* offline: fall through to cache */ }
  const hit = await c.match(req, { ignoreSearch: true });
  return hit || net;
}
async function cacheFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
  return hit || net;
}
