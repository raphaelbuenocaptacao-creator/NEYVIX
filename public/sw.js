const CACHE = "neyvix-shell-v2";
const SHELL = ["/", "/neyvix-icon.svg", "/neyvix-maskable.svg"];
const PRIVATE_PATHS = ["/api/", "/login", "/admin", "/billing"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
      self.clients.claim(),
    ])
  );
});

function isPrivate(request, url) {
  if (request.method !== "GET") return true;
  if (request.headers.has("authorization")) return true;
  if (url.origin !== self.location.origin) return true;
  return PRIVATE_PATHS.some((path) => url.pathname.startsWith(path));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivate(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => caches.match("/").then((cached) => cached || Response.error()))
    );
    return;
  }

  if (["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      }))
    );
  }
});
