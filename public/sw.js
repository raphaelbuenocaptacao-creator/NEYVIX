const CACHE_PREFIX = "neyvix-shell-";
const CACHE = `${CACHE_PREFIX}v6-static-only`;
const SHELL = [
  "/manifest.webmanifest",
  "/neyvix-icon-192.svg",
  "/neyvix-icon-512.svg",
  "/neyvix-maskable-512.svg",
];
const PRIVATE_PATH = /\/(api|auth|login|logout|admin|billing|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY = /^(token|access_token|refresh_token|password|passwd|secret|session|auth|authorization|api_key|apikey|key|code|credential|credentials)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(
        (await caches.keys())
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

function hasSensitiveQuery(url) {
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY.test(key)) return true;
  }
  return false;
}

function isPrivate(request, url) {
  if (request.method !== "GET") return true;
  if (
    request.headers.has("authorization") ||
    request.headers.has("cookie") ||
    request.headers.has("range")
  ) return true;
  if (url.origin !== self.location.origin) return true;
  if (PRIVATE_PATH.test(url.pathname) || hasSensitiveQuery(url)) return true;
  return false;
}

function isShellRequest(request, url) {
  return !isPrivate(request, url) && !url.search && SHELL.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivate(request, url)) return;

  // Documents are always network-only. This prevents a page rendered for one
  // authenticated session from being replayed later from a shared PWA cache.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          return await fetch(request, { cache: "no-store" });
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  if (!isShellRequest(request, url)) return;

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request, { cache: "no-store" })),
  );
});
