/* Solo Jam Room service worker.
 *
 * The build fills in the cache version and the list of files to precache (see vite.config.ts).
 * Everything the app needs is cached on install, so after the first visit it works with no signal. */
const CACHE = 'solo-jam-room-__VERSION__';
const PRECACHE = __PRECACHE__;

const scope = self.registration.scope;
const url = (path) => new URL(path, scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map(url)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith('solo-jam-room-') && k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(scope)) return;

  // Pages: answer from the cache straight away, and refresh the cache in the background so the
  // next visit gets any update. The app is a single page behind hash routes.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(url('index.html')).then((cached) => {
        const refresh = fetch(request)
          .then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(url('index.html'), res.clone()));
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      }),
    );
    return;
  }

  // Everything else is content-hashed or static: cache first, then network (and remember it).
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        }),
    ),
  );
});
