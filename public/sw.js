const CACHE = "neyvix-shell-v3";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/neyvix-icon-192.svg",
  "/neyvix-icon-512.svg",
  "/neyvix-maskable-512.svg",
];
const PRIVATE_PATH = /\/(api|auth|login|logout|admin|billing|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

function isPrivate(request, url) {
  if (request.method !== "GET") return true;
  if (request.headers.has("authorization")) return true;
  if (url.origin !== self.location.origin) return true;
  return PRIVATE_PATH.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivate(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        caches.match("/").then((cached) => cached || Response.error()),
      ),
    );
    return;
  }

  if (!SHELL.includes(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request, { cache: "no-store" })),
  );
});
