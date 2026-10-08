/* Mat Sains service worker: makes the app installable and playable offline.
 * VERSION is replaced at build time (scripts/build.sh) so every deploy gets a
 * fresh cache; old caches are deleted on activate. */
const VERSION = '__BUILD_ID__';
const APP_CACHE = 'matsains-app-' + VERSION;
const FONT_CACHE = 'matsains-fonts-v1';
const GAMES = ['timbangan', 'angkot', 'katak', 'ketapel', 'perahu', 'martabak'];
const PRECACHE = [
  './', 'index.html', 'welcome.html', 'manifest.webmanifest',
  'shared/core.css', 'shared/core.js', 'shared/art.js', 'shared/auth.js', 'shared/config.js', 'shared/pwa.js', 'shared/voice.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
].concat(...GAMES.map(g => ['games/' + g + '/index.html', 'games/' + g + '/game.js']));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // Add one by one so a single missing optional file never blocks installation.
    await Promise.all(PRECACHE.map(u => cache.add(new Request(u, { cache: 'reload' })).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('matsains-app-') && k !== APP_CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: serve from cache, refresh in the background.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(FONT_CACHE, req));
    return;
  }
  if (url.origin !== self.location.origin) return; // Google sign-in etc. go straight to the network

  // Pages: network first so a new deploy shows up, cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok) (await caches.open(APP_CACHE)).put(req, res.clone());
        return res;
      } catch (e) {
        return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('index.html'));
      }
    })());
    return;
  }
  // Scripts, styles, images, audio: versioned cache first.
  event.respondWith(staleWhileRevalidate(APP_CACHE, req));
});

async function staleWhileRevalidate(cacheName, req) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}
