const CACHE = 'aecs-shell-v3-reset-20261122';
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
      await cache.addAll([
        ...new Set(['/icon.svg', '/brand/aecs-logo.png', '/manifest.webmanifest', ...assets]),
      ]);
    })(),
  );
  self.skipWaiting();
});
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      // Purge legacy roster/draft data after the explicitly requested live-data reset.
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('aecs-attend');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const stores = Array.from(db.objectStoreNames);
          if (!stores.length) {
            db.close();
            resolve();
            return;
          }
          const tx = db.transaction(stores, 'readwrite');
          for (const store of stores) tx.objectStore(store).clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      });
      for (const name of await caches.keys())
        if (name.startsWith('aecs-shell-') && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline')));
    return;
  }
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon.svg' ||
    url.pathname.startsWith('/brand/')
  ) {
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
