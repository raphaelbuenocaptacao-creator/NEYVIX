const CACHE_PREFIX = "neyvix-shell-";
const CACHE = `${CACHE_PREFIX}v8-raster-safe-shell`;
const SHELL = [
  "/manifest.webmanifest",
  "/neyvix-icon-192.png",
  "/neyvix-icon-512.png",
  "/neyvix-maskable-512.png",
];
const PRIVATE_PATH = /\/(api|auth|login|logout|admin|billing|session|sessions|token|tokens|password|account|profile|me)(\/|$)/i;
const SENSITIVE_QUERY = /^(token|access_token|refresh_token|password|passwd|secret|session|auth|authorization|api_key|apikey|key|code|credential|credentials)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const response = await fetch(path, {
              cache: "no-store",
              credentials: "omit",
              redirect: "error",
            });
            if (isCacheableResponse(response)) {
              await cache.put(path, response);
            }
          } catch {
            // Install must not fail just because one public shell asset is unavailable.
          }
        }),
      );
    }),
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
    request.headers.has("range") ||
    request.headers.has("if-range")
  ) return true;
  if (url.origin !== self.location.origin) return true;
  if (PRIVATE_PATH.test(url.pathname) || hasSensitiveQuery(url)) return true;
  return false;
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.redirected || response.status === 206) return false;
  if (response.headers.has("content-range") || response.headers.has("set-cookie")) return false;
  const cacheControl = response.headers.get("cache-control") || "";
  return !/(private|no-store)/i.test(cacheControl);
}

function isShellRequest(request, url) {
  return !isPrivate(request, url) && !url.search && SHELL.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (isPrivate(request, url)) return;

  // Documents stay network-only so authenticated HTML is never replayed from cache.
  // A navigation Request already carries its credential/redirect semantics; only force
  // the browser HTTP cache off so the active production response is always revalidated.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload && !preload.redirected && preload.status !== 206) return preload;
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
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request, {
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
        });
        if (isCacheableResponse(response)) {
          const cache = await caches.open(CACHE);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
