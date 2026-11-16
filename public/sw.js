// Keeps what the experiences load on the visitor's device, so that after the first visit a demo
// does not depend on the venue's network: the satellite copies (~7 MB for the hurricane), the
// fonts and the app's own files come from disk. Live NASA requests (other origins) are never
// touched. Bump VERSION to drop everything cached by an older version.
const VERSION = 'v1';
const ASSETS = `earth-jukebox-assets-${VERSION}`; // hashed files: never change, cache first
const FILES = `earth-jukebox-files-${VERSION}`; // images, data, pages: serve the copy, refresh behind it

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![ASSETS, FILES].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  // Pages: the network first (a deploy shows at once), the stored copy when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((res) => keep(FILES, request, res), () => caches.match(request, { ignoreSearch: true })));
    return;
  }
  // Built files carry a hash in their name: a stored copy is always the right one.
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request).then((res) => keep(ASSETS, request, res))));
    return;
  }
  // The recorded tracks (2 to 3 MB each): the stored copy, without asking the network again. A
  // track replaced under the same name needs VERSION bumped.
  if (url.pathname.startsWith('/audio/') && !request.headers.has('range')) {
    event.respondWith(
      caches.open(FILES).then((cache) => cache.match(request).then((hit) => hit || fetch(request).then((res) => keep(FILES, request, res)))),
    );
    return;
  }
  // Images and data keep their names: show the stored copy and refresh it for next time.
  if (url.pathname.startsWith('/img/') || url.pathname.startsWith('/data/')) {
    event.respondWith(
      caches.open(FILES).then((cache) =>
        cache.match(request).then((hit) => {
          const refresh = fetch(request).then((res) => keep(FILES, request, res), () => hit);
          return hit || refresh;
        }),
      ),
    );
  }
});

// Stores a good response (and hands the original on); anything else passes through untouched.
function keep(name, request, response) {
  if (response && response.ok && response.type === 'basic') {
    const copy = response.clone();
    caches.open(name).then((cache) => cache.put(request, copy));
  }
  return response;
}
