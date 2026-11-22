const CACHE = 'aecs-shell-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const page = await fetch('/offline');
      if (!page.ok) throw new Error('Offline shell unavailable');
      await cache.put('/offline', page.clone());
      const html = await page.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
        .map((m) => m[1].replaceAll('&amp;', '&'))
        .filter((url) => url.startsWith('/_next/static/'));
      await cache.addAll([...new Set(['/icon.svg', '/manifest.webmanifest', ...assets])]);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg') {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const response = await fetch(event.request);
        if (response.ok) await cache.put(event.request, response.clone());
        return response;
      }),
    );
  }
});
