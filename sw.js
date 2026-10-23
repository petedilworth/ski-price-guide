// Offline cache for the ski gear guide. Bump VERSION when files change
// (keep it equal to APP_VERSION in index.html).
const VERSION = "skigear-2026-10-23f";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];
const WAIT_MS = 3000; // longest we wait for the network before using the saved copy

self.addEventListener("install", (e) => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never saves a stale page.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fresh from the network (revalidated), saved for offline use.
function fromNetwork(req) {
  return fetch(new Request(req.url, { cache: "no-cache", credentials: "same-origin" })).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  });
}

// Network first, but never wait more than WAIT_MS: weak signal at a swap or show
// falls back to the saved copy, and the fresh copy is saved for next time.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req, { ignoreSearch: true });
    const net = fromNetwork(req);
    if (!hit) return net.catch(() => cache.match("./index.html"));
    e.waitUntil(net.catch(() => {}));
    const slow = new Promise((resolve) => setTimeout(() => resolve(hit), WAIT_MS));
    return Promise.race([net.catch(() => hit), slow]);
  })());
});
